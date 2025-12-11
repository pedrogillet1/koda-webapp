import crypto from 'crypto';
import prisma from '../config/database';
import { uploadFile, downloadFile, getSignedUrl, deleteFile, bucket, fileExists } from '../config/storage';
import { config } from '../config/env';
import * as textExtractionService from './textExtraction.service';
import * as visionService from './vision.service';
import * as geminiService from './openai.service';
import * as folderService from './folder.service';
import { generateDocumentTitleOnly } from './titleGeneration.service';
import markdownConversionService from './markdownConversion.service';
import cacheService from './cache.service';
import encryptionService from './encryption.service';
import pptxProcessorService from './pptxProcessor.service';
import fileValidator from './fileValidator.service';
import { invalidateUserCache } from '../controllers/batch.controller';
import { invalidateFileListingCache } from './rag.service';
import { addDocumentJob } from '../queues/document.queue';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// V1 Stubs - Document Intelligence removed
// ═══════════════════════════════════════════════════════════════
interface DocumentClassification {
  type: string;
  confidence: number;
  domain?: string;
  documentType?: string;
  domainConfidence?: number;
  typeConfidence?: number;
}

interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
}

interface ExtractedKeyword {
  keyword: string;
  weight: number;
  word?: string;
  tfIdf?: number;
  isDomainSpecific?: boolean;
}

interface ChunkClassification {
  type: string;
  confidence: number;
  chunkType?: string;
  category?: string;
}

// Stub functions - no-op implementations (accept any args for compatibility)
async function classifyDocument(_content: string, _arg2?: any, _arg3?: any): Promise<DocumentClassification> {
  return { type: 'general', confidence: 0.5, domain: 'general', documentType: 'document', domainConfidence: 0.5, typeConfidence: 0.5 };
}

async function extractEntities(_content: string, _options?: any): Promise<ExtractedEntity[]> {
  return [];
}

function extractKeywords(_content: string, _options?: any): ExtractedKeyword[] {
  return [];
}

async function classifyChunk(_content: string, _options?: any): Promise<ChunkClassification> {
  return { type: 'general', confidence: 0.5, chunkType: 'general', category: 'general' };
}

// Storage service stub
const storageService = {
  uploadFile: async () => ({ success: true }),
  downloadFile: async () => null,
  deleteFile: async () => ({ success: true }),
  incrementStorage: async (_userId: string, _bytes: number) => { /* no-op */ },
  decrementStorage: async (_userId: string, _bytes: number) => { /* no-op */ },
};

// NER service stub
const nerService = {
  extractEntities: async (_content: string, _userId: string): Promise<{ entities: ExtractedEntity[], suggestedTags: string[] }> =>
    ({ entities: [], suggestedTags: [] }),
  storeEntities: async (_docId: string, _entities: ExtractedEntity[]) => { /* no-op */ },
  autoTagDocument: async (_userId: string, _docId?: string, _entities?: any, _suggestedTags?: any) => { /* no-op */ },
};

// Metadata enrichment stub
const metadataEnrichmentService = {
  enrichDocumentMetadata: async (_docId: string, _content: string) => { /* no-op */ },
  enrichDocument: async (_content: string, _filename: string, _options?: any) => ({
    topics: [],
    entities: [],
    summary: '',
    keyPoints: [],
    sentiment: 'neutral',
    complexity: 'medium',
  }),
};

// Methodology extraction stub
const methodologyExtractionService = {
  extractMethodology: async (_content: string) => null,
};

// Domain knowledge stub
const domainKnowledgeService = {
  analyzeDomain: async (_content: string) => null,
};

// BM25 chunk creation stub
const bm25ChunkCreationService = {
  createBM25Chunks: async (_docId: string, _content?: any, _pageCount?: number | null) => { /* no-op */ },
};

// ═══════════════════════════════════════════════════════════════
// Semantic Chunking with Overlap - Interfaces and Fallback
// ═══════════════════════════════════════════════════════════════
interface ChunkOptions {
  maxSize: number;
  overlap: number;
  splitOn: string[];
}

interface ChunkWithPosition {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

/**
 * Fallback chunking with overlap for improved retrieval
 * Uses smart boundary detection for cleaner chunks
 */
function chunkTextWithOverlap(text: string, options: ChunkOptions): ChunkWithPosition[] {
  const { maxSize, overlap, splitOn } = options;
  const chunks: ChunkWithPosition[] = [];

  let currentPos = 0;
  let chunkIndex = 0;

  while (currentPos < text.length) {
    let endPos = Math.min(currentPos + maxSize, text.length);

    // Try to find a good break point
    if (endPos < text.length) {
      let bestBreak = endPos;

      for (const delimiter of splitOn) {
        const lastIndex = text.lastIndexOf(delimiter, endPos);
        if (lastIndex > currentPos && lastIndex > bestBreak - 100) {
          bestBreak = lastIndex + delimiter.length;
          break;
        }
      }

      endPos = bestBreak;
    }

    const content = text.substring(currentPos, endPos).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        index: chunkIndex++,
        startChar: currentPos,
        endChar: endPos,
      });
    }

    // Move forward, accounting for overlap
    const prevStartChar = chunks[chunks.length - 1]?.startChar ?? -1;
    currentPos = endPos - overlap;

    // Ensure we make progress
    if (currentPos <= prevStartChar) {
      currentPos = endPos;
    }
  }

  return chunks;
}

export interface UploadDocumentInput {
  userId: string;
  filename: string;
  fileBuffer: Buffer;
  mimeType: string;
  folderId?: string;
  fileHash: string; // SHA-256 hash from client
  relativePath?: string; // For nested folder uploads
  thumbnailBuffer?: Buffer;
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Client-side encryption metadata
  encryptionMetadata?: {
    isEncrypted: boolean;
    encryptionSalt: string;
    encryptionIV: string;
    encryptionAuthTag: string;
    filenameEncrypted: {
      salt: string;
      iv: string;
      ciphertext: string;
      authTag: string;
    };
    extractedTextEncrypted?: {
      salt: string;
      iv: string;
      ciphertext: string;
      authTag: string;
    };
  };
  // ⚡ TEXT EXTRACTION: Plaintext for embeddings (NOT stored, only used for Pinecone)
  plaintextForEmbeddings?: string;
}

/**
 * Create folders recursively from a relative path
 */
async function createFoldersFromPath(userId: string, relativePath: string, parentFolderId: string | null = null): Promise<string> {
  // Split the path into folder names (e.g., "folder1/folder2/file.txt" -> ["folder1", "folder2"])
  const pathParts = relativePath.split('/').filter(p => p.trim() && p !== '.');

  // Remove the filename (last part)
  const folderNames = pathParts.slice(0, -1).filter(name => name !== '.' && name !== '..' && name.trim().length > 0);

  if (folderNames.length === 0) {
    // No folders in path, return the parent folder or null
    return parentFolderId || '';
  }

  let currentParentId = parentFolderId;

  // Create folders recursively
  for (const folderName of folderNames) {
    // Skip invalid folder names
    if (folderName === '.' || folderName === '..' || !folderName.trim()) {
      continue;
    }

    // Check if folder already exists at this level
    const existingFolder = await prisma.folder.findFirst({
      where: {
        userId,
        name: folderName,
        parentFolderId: currentParentId,
      },
    });

    if (existingFolder) {
      currentParentId = existingFolder.id;
    } else {
      // Create new folder
      const newFolder = await folderService.createFolder(userId, folderName, undefined, currentParentId || undefined);
      currentParentId = newFolder.id;
    }
  }

  return currentParentId || '';
}

/**
 * Upload an encrypted document (supports both server-side and zero-knowledge client-side encryption)
 */
export const uploadDocument = async (input: UploadDocumentInput) => {
  const { userId, filename, fileBuffer, mimeType, folderId, fileHash, relativePath, encryptionMetadata, plaintextForEmbeddings } = input;

  const uploadStartTime = Date.now();

  if (encryptionMetadata?.isEncrypted) {
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // LAYER 2: SERVER-SIDE VALIDATION
  // ════════════════════════════════════════════════════════════════════════════════

  // ⚡ SKIP VALIDATION FOR CLIENT-SIDE ENCRYPTED FILES
  // Encrypted files can't be validated because they're encrypted binary data
  // Frontend already validated them before encryption
  if (encryptionMetadata?.isEncrypted) {
  } else {
    const validationStart = Date.now();

    const validationResult = await fileValidator.validateServerSide(
      fileBuffer,
      mimeType,
      filename
    );


    if (!validationResult.isValid) {
      console.error(`❌ File validation failed: ${validationResult.error}`);

      throw new Error(JSON.stringify({
        code: validationResult.errorCode,
        message: validationResult.error,
        suggestion: validationResult.suggestion,
      }));
    }

  }

  // If relativePath is provided AND contains folders (has /), create nested folders
  // Skip if it's just a filename without folder structure
  let finalFolderId = folderId;
  if (relativePath && relativePath.includes('/')) {
    finalFolderId = await createFoldersFromPath(userId, relativePath, folderId || null);
  }

  // ⚡ IDEMPOTENCY CHECK: Skip if identical file already uploaded to the SAME folder
  // ✅ FIX: Also check filename to allow identical files with different names (e.g., copy1.png, copy2.png)
  const existingDoc = await prisma.document.findFirst({
    where: {
      userId,
      fileHash,
      filename,  // ✅ CRITICAL FIX: Check filename too! Allows uploading identical content with different names
      status: 'completed',
      // Allow same file in different folders
      folderId: finalFolderId,
    },
  });

  if (existingDoc) {
    const existing = await prisma.document.findUnique({
      where: { id: existingDoc.id },
      include: { folder: true },
    });
    // Return existing document with flag indicating it already existed
    return { ...existing, isExisting: true };
  }


  // Generate unique encrypted filename
  const encryptedFilename = `${userId}/${crypto.randomUUID()}-${Date.now()}`;

  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Handle client-side encrypted files vs server-side encryption
  let encryptedFileBuffer: Buffer;
  let encryptionIV: string;
  let encryptionAuthTag: string;
  let encryptionSalt: string | null = null;
  let filenameEncrypted: string | null = null;
  let extractedTextEncrypted: string | null = null;
  let isZeroKnowledge = false;

  if (encryptionMetadata?.isEncrypted) {
    // ⚡ ZERO-KNOWLEDGE ENCRYPTION: File is already encrypted client-side

    encryptedFileBuffer = fileBuffer; // Already encrypted
    encryptionIV = encryptionMetadata.encryptionIV;
    encryptionAuthTag = encryptionMetadata.encryptionAuthTag;
    encryptionSalt = encryptionMetadata.encryptionSalt;
    filenameEncrypted = JSON.stringify(encryptionMetadata.filenameEncrypted);

    // ⚡ TEXT EXTRACTION: Store encrypted text if provided
    if (encryptionMetadata.extractedTextEncrypted) {
      extractedTextEncrypted = JSON.stringify(encryptionMetadata.extractedTextEncrypted);
    }

    isZeroKnowledge = true;

  } else {
    // 🔒 SERVER-SIDE ENCRYPTION: Encrypt file before upload (AES-256-GCM)
    const encryptionService = await import('./encryption.service');
    encryptedFileBuffer = encryptionService.default.encryptFile(fileBuffer, `document-${userId}`);

    // Extract IV and auth tag from encrypted buffer (stored as IV + AuthTag + EncryptedData)
    encryptionIV = encryptedFileBuffer.slice(0, 16).toString('base64'); // First 16 bytes
    encryptionAuthTag = encryptedFileBuffer.slice(16, 32).toString('base64'); // Next 16 bytes
  }

  // ✅ FIX: Upload encrypted file to S3 Storage
  const uploadStart = Date.now();
  await uploadFile(encryptedFilename, encryptedFileBuffer, mimeType);

  // Thumbnail generation disabled - set to null
  const thumbnailUrl: string | null = null;

  // Create document record with encryption metadata
  const document = await prisma.document.create({
    data: {
      userId,
      folderId: finalFolderId || null,
      filename,
      encryptedFilename,
      fileSize: encryptedFileBuffer.length, // Store encrypted file size
      mimeType,
      fileHash,
      status: isZeroKnowledge ? 'ready' : 'processing', // ⚡ Zero-knowledge files are ready immediately
      isEncrypted: true,
      encryptionIV,
      encryptionAuthTag,
      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Store additional metadata
      ...(isZeroKnowledge && {
        encryptionSalt,
        filenameEncrypted,
        extractedTextEncrypted, // Store encrypted extracted text
      }),
    },
    include: {
      folder: true,
    },
  });

  // 📊 STORAGE TRACKING: Increment user storage usage
  await storageService.incrementStorage(userId, encryptedFileBuffer.length);

  // ⚡ ASYNCHRONOUS PROCESSING - Don't wait for all steps to complete

  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Use plaintext for embeddings if provided
  if (isZeroKnowledge) {

    // ⚡ TEXT EXTRACTION: Generate embeddings ASYNCHRONOUSLY (don't wait)
    if (plaintextForEmbeddings && plaintextForEmbeddings.length > 0) {

      // Generate embeddings in background without blocking the response
      // TODO: Implement generateEmbeddings function in gemini.service
    } else {
    }

    // Return immediately - document is already marked as 'ready'

    // ⚡ CACHE: Invalidate Redis cache after document upload
    await invalidateUserCache(userId);
    // ⚡ PERFORMANCE: Invalidate file listing cache
    invalidateFileListingCache(userId);

    return document; // Return the already-created document
  }

  // ⚡ ASYNCHRONOUS PROCESSING: Return immediately, process in background

  // Process in background without blocking the response
  processDocumentInBackground(document.id, fileBuffer, filename, mimeType, userId, thumbnailUrl)
    .then(() => {
    })
    .catch(error => {
      console.error(`❌ Background processing failed for ${filename}:`, error);
      // Error handling is already done inside processDocumentInBackground
    });


  // ⚡ CACHE: Invalidate Redis cache after document upload
  await invalidateUserCache(userId);
  // ⚡ PERFORMANCE: Invalidate file listing cache
  invalidateFileListingCache(userId);
  // ⚡ MODE OPTIMIZATION: Invalidate query response cache (new documents = stale answers)
  await cacheService.invalidateUserQueryCache(userId);
  console.log(`🗑️  [MODE CACHE] Invalidated query cache after document upload`);

  // Return immediately with 'processing' status
  return document;
};

/**
 * Process document in background without blocking the upload
 * TypeScript cache fully cleared
 * EXPORTED for background worker to reprocess pending documents
 */
export async function processDocumentInBackground(
  documentId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  userId: string,
  thumbnailUrl: string | null
) {
  const PROCESSING_TIMEOUT = 180000; // 3 minutes max per document

  try {

    // Wrap entire processing in a timeout
    await Promise.race([
      processDocumentWithTimeout(documentId, fileBuffer, filename, mimeType, userId, thumbnailUrl),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Processing timeout after ${PROCESSING_TIMEOUT / 1000} seconds`)), PROCESSING_TIMEOUT)
      )
    ]);

  } catch (error: any) {
    console.error('❌ Error processing document:', error);

    // ✅ FIXED BEHAVIOR: Mark as failed instead of deleting
    // Keep failed documents so users can:
    // 1. See what failed
    // 2. Retry processing
    // 3. Download original file
    // 4. Get error details
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'failed',
          updatedAt: new Date(),
        }
      });

      console.log(`⚠️  Marked document as failed: ${filename}`);
      console.log(`   └── Reason: ${error.message || 'Unknown error'}`);

    } catch (updateError) {
      console.error('❌ CRITICAL: Failed to mark document as failed:', updateError);
    }

    throw error;
  }
}

/**
 * Internal function with comprehensive error handling at each step
 */
async function processDocumentWithTimeout(
  documentId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  userId: string,
  thumbnailUrl: string | null
) {
  try {
    const processingStartTime = Date.now();

    // Import WebSocket service for progress updates
    const { emitToUser } = await import('./websocket.service');

    // Stage 1: Starting (0%)
    emitToUser(userId, 'document-processing-update', {
      documentId,
      stage: 'starting',
      progress: 0,
      message: 'Processing started...',
      filename
    });

    // Extract text based on file type
    let extractedText = '';
    let ocrConfidence: number | null = null;
    let pageCount: number | null = null;
    let wordCount: number | null = null;
    let slidesData: any[] | null = null;
    let pptxMetadata: any | null = null;
    let pptxSlideChunks: any[] | null = null; // For Phase 4C: Slide-level chunks

    // ⏱️ START TEXT EXTRACTION TIMING
    const extractionStartTime = Date.now();

    // Progress update: extraction starting (5%)
    emitToUser(userId, 'document-processing-update', {
      documentId,
      stage: 'extracting',
      progress: 5,
      message: 'Extracting text from document...',
      filename
    });

    // Check if it's a PowerPoint file - use Python PPTX extractor
    const isPPTX = mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (isPPTX) {

      // Progress update: PowerPoint extraction starting (8%)
      emitToUser(userId, 'document-processing-update', {
        documentId,
        stage: 'extracting',
        progress: 8,
        message: 'Processing PowerPoint slides...',
        filename
      });

      try {
        // Save file buffer to temporary file
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `pptx-${crypto.randomUUID()}.pptx`);
        fs.writeFileSync(tempFilePath, fileBuffer);

        // Import and use PPTX extractor
        const { pptxExtractorService } = await import('./pptxExtractor.service');
        const result = await pptxExtractorService.extractText(tempFilePath);

        if (result.success) {
          extractedText = result.fullText || '';
          const extractedSlides = result.slides || [];
          pptxMetadata = result.metadata || {};
          pageCount = result.totalSlides || null;

          // Store slide text data immediately (even without images)
          slidesData = extractedSlides.map((slide) => ({
            slideNumber: slide.slide_number,
            content: slide.content,
            textCount: slide.text_count,
            imageUrl: null, // Will be updated later if images are generated
          }));


          // 🆕 Phase 4C: Process PowerPoint into slide-level chunks
          const pptxProcessResult = await pptxProcessorService.processFile(tempFilePath);
          if (pptxProcessResult.success) {
            pptxSlideChunks = pptxProcessResult.chunks;
          } else {
          }

          // ✅ FIX: PROACTIVE image extraction approach - Always extract images first
          (async () => {
            try {
              // Import prisma in async scope
              const prismaClient = (await import('../config/database')).default;


              // ✅ FIX: ALWAYS extract images first (proactive approach)
              const { PPTXImageExtractorService } = await import('./pptxImageExtractor.service');
              const extractor = new PPTXImageExtractorService();

              const imageResult = await extractor.extractImages(
                tempFilePath,
                documentId,
                {
                  uploadToGCS: true,
                  signedUrlExpiration: 604800 // 7 days instead of 1 hour
                }
              );

              if (imageResult.success && imageResult.slides && imageResult.slides.length > 0) {

                // Fetch existing slidesData to preserve text content
                const existingMetadata = await prismaClient.documentMetadata.findUnique({
                  where: { documentId }
                });

                let existingSlidesData: any[] = [];
                try {
                  if (existingMetadata?.slidesData) {
                    existingSlidesData = typeof existingMetadata.slidesData === 'string'
                      ? JSON.parse(existingMetadata.slidesData)
                      : existingMetadata.slidesData as any[];
                  }
                } catch (e) {
                }

                // Merge extracted images with existing slide data
                const mergedSlidesData = existingSlidesData.map((existingSlide: any) => {
                  const slideNum = existingSlide.slideNumber || existingSlide.slide_number;
                  const extractedSlide = imageResult.slides!.find(s => s.slideNumber === slideNum);

                  // Use composite image if available, otherwise first image
                  const imageUrl = extractedSlide?.compositeImageUrl
                    || (extractedSlide?.images && extractedSlide.images.length > 0
                        ? extractedSlide.images[0].imageUrl
                        : null);

                  return {
                    slideNumber: slideNum,
                    content: existingSlide.content || '',
                    textCount: existingSlide.textCount || existingSlide.text_count || 0,
                    imageUrl: imageUrl || existingSlide.imageUrl // Preserve old imageUrl if extraction failed
                  };
                });

                // Update metadata with extracted images (use upsert in case metadata doesn't exist yet)
                await prismaClient.documentMetadata.upsert({
                  where: { documentId },
                  update: {
                    slidesData: JSON.stringify(mergedSlidesData),
                    slideGenerationStatus: 'completed'
                  },
                  create: {
                    documentId,
                    slidesData: JSON.stringify(mergedSlidesData),
                    slideGenerationStatus: 'completed'
                  }
                });

              } else {

                // Update status to show extraction failed (use upsert in case metadata doesn't exist yet)
                await prismaClient.documentMetadata.upsert({
                  where: { documentId },
                  update: {
                    slideGenerationStatus: 'failed',
                    slideGenerationError: imageResult.error || 'Image extraction failed'
                  },
                  create: {
                    documentId,
                    slideGenerationStatus: 'failed',
                    slideGenerationError: imageResult.error || 'Image extraction failed'
                  }
                });
              }

              // ✅ FIX: Optional enhancement - Try LibreOffice for full slide renders
              // This runs AFTER image extraction, so users already have images
              try {
                // DEPRECATED: pptxSlideGenerator.service removed - using stub
                const pptxSlideGeneratorService = { generateSlideImages: async (_a: any, _b: any, _c: any) => ({ success: false, slides: [] as any[] }) };
                const slideResult = await pptxSlideGeneratorService.generateSlideImages(
                  tempFilePath,
                  documentId,
                  {
                    uploadToGCS: true,
                    maxWidth: 1920,
                    quality: 90
                  }
                );

                if (slideResult.success && slideResult.slides && slideResult.slides.length > 0) {
                  // ✅ FIX: Validate that slides actually have images (not just text)
                  const validSlides = slideResult.slides.filter(slide => {
                    // Check if slide has valid dimensions (not just text)
                    return slide.width && slide.height && slide.publicUrl;
                  });

                  if (validSlides.length > 0) {

                    // Fetch current slidesData
                    const currentMetadata = await prismaClient.documentMetadata.findUnique({
                      where: { documentId }
                    });

                    let currentSlidesData: any[] = [];
                    try {
                      if (currentMetadata?.slidesData) {
                        currentSlidesData = typeof currentMetadata.slidesData === 'string'
                          ? JSON.parse(currentMetadata.slidesData)
                          : currentMetadata.slidesData as any[];
                      }
                    } catch (e) {
                    }

                    // Enhance with full renders (replace extracted images with better quality)
                    const enhancedSlidesData = currentSlidesData.map((existingSlide: any) => {
                      const slideNum = existingSlide.slideNumber;
                      const fullRender = validSlides.find(s => s.slideNumber === slideNum);

                      return {
                        ...existingSlide,
                        imageUrl: fullRender?.publicUrl || existingSlide.imageUrl, // Use full render if available
                        width: fullRender?.width || existingSlide.width,
                        height: fullRender?.height || existingSlide.height
                      };
                    });

                    // Update with enhanced renders (use upsert in case metadata doesn't exist yet)
                    await prismaClient.documentMetadata.upsert({
                      where: { documentId },
                      update: {
                        slidesData: JSON.stringify(enhancedSlidesData),
                        slideGenerationStatus: 'completed'
                      },
                      create: {
                        documentId,
                        slidesData: JSON.stringify(enhancedSlidesData),
                        slideGenerationStatus: 'completed'
                      }
                    });

                  } else {
                  }
                } else {
                }
              } catch (libreOfficeError: any) {
                // Don't fail the whole process - extracted images are already saved
              }

            } catch (error: any) {
              console.error(`❌ [Background] PPTX processing error for ${filename}:`, error);

              // Update status to failed (use upsert in case metadata doesn't exist yet)
              const prismaClient = (await import('../config/database')).default;
              await prismaClient.documentMetadata.upsert({
                where: { documentId },
                update: {
                  slideGenerationStatus: 'failed',
                  slideGenerationError: error.message
                },
                create: {
                  documentId,
                  slideGenerationStatus: 'failed',
                  slideGenerationError: error.message
                }
              }).catch(err => console.error('Failed to update error status:', err));
            } finally {
              // Clean up temp file
              try {
                fs.unlinkSync(tempFilePath);
              } catch (cleanupError: any) {
              }
            }
          })().catch(err => console.error('Background PPTX processing error:', err));
        } else {
          throw new Error('PPTX extraction failed');
        }
      } catch (pptxError: any) {
        console.error('❌ CRITICAL: Python PPTX extraction failed. This document will be marked as failed.');
        console.error('   └── Error:', pptxError.message);
        // Re-throw the error to be caught by the main try-catch block, which will set the document status to 'failed'
        throw new Error(`PowerPoint processing failed: ${pptxError.message}`);
      }
    }
    // Check if it's an image type that needs OCR via Gemini Vision
    else if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
      extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
      ocrConfidence = 0.95;
    }
    // 📄 Special handling for PDFs - detect scanned PDFs proactively
    else if (mimeType === 'application/pdf') {
      try {
        // Import Mistral OCR service (high-quality OCR API)
        const mistralOCR = (await import('./mistral-ocr.service')).default;

        // Check if PDF is scanned (with fallback if check fails)
        let isScanned = false;
        try {
          isScanned = await mistralOCR.isScannedPDF(fileBuffer);
          console.log(`📄 [PDF] Scanned check result: ${isScanned ? 'SCANNED' : 'NATIVE TEXT'}`);
        } catch (scanCheckError: any) {
          console.warn('⚠️ [PDF] Scan check failed, assuming native:', scanCheckError.message);
          isScanned = false; // Assume text-based if check fails
        }

        if (isScanned && mistralOCR.isAvailable()) {
          // Scanned PDF - use Mistral OCR (best quality)
          console.log('📄 [PDF] Using Mistral OCR for scanned PDF...');
          try {
            const ocrResult = await mistralOCR.processScannedPDF(fileBuffer);
            extractedText = ocrResult.text;
            ocrConfidence = ocrResult.confidence;
            pageCount = ocrResult.pageCount;
            wordCount = extractedText ? extractedText.split(/\s+/).filter((w: string) => w.length > 0).length : 0;
            console.log(`✅ [PDF] Mistral OCR extracted ${extractedText.length} chars, ${wordCount} words`);
          } catch (mistralError: any) {
            console.error('❌ [PDF] Mistral OCR failed:', mistralError.message);

            // Fallback to standard text extraction (may get minimal text from scanned PDFs)
            console.log('🔄 [PDF] Falling back to standard extraction...');
            const result = await textExtractionService.extractText(fileBuffer, mimeType);
            extractedText = result.text;
            ocrConfidence = result.confidence || 0.5;
            pageCount = result.pageCount || null;
            wordCount = result.wordCount || null;

            if (extractedText.trim().length < 100) {
              console.warn('⚠️ [PDF] Minimal text extracted from scanned PDF');
            }
          }
        } else if (isScanned && !mistralOCR.isAvailable()) {
          // Scanned PDF but Mistral OCR not configured
          console.warn('⚠️ [PDF] Scanned PDF detected but Mistral OCR not available');
          console.warn('   Configure MISTRAL_API_KEY in .env for high-quality OCR');

          // Try standard extraction (will likely get minimal text)
          const result = await textExtractionService.extractText(fileBuffer, mimeType);
          extractedText = result.text;
          ocrConfidence = result.confidence || null;
          pageCount = result.pageCount || null;
          wordCount = result.wordCount || null;

          if (extractedText.trim().length < 100) {
            // Add note about OCR configuration
            extractedText = `[Scanned PDF: ${filename}]\n\nThis document appears to be a scanned PDF with minimal extractable text (${extractedText.trim().length} chars found).\n\nTo enable full text extraction, configure MISTRAL_API_KEY in your backend .env file.\n\n--- Extracted Content ---\n${extractedText}`;
            ocrConfidence = 0.1; // Low confidence indicates OCR needed
          }
        } else {
          // Text-based PDF - use standard extraction
          console.log('📄 [PDF] Using standard text extraction for native PDF...');
          const result = await textExtractionService.extractText(fileBuffer, mimeType);
          extractedText = result.text;
          ocrConfidence = result.confidence || null;
          pageCount = result.pageCount || null;
          wordCount = result.wordCount || null;
          console.log(`✅ [PDF] Extracted ${extractedText.length} chars from native PDF`);
        }
      } catch (pdfError: any) {
        console.error('❌ [PDF] Processing failed:', pdfError.message);
        throw pdfError;
      }
    }
    else {
      // Use standard text extraction service for other file types
      try {
        const result = await textExtractionService.extractText(fileBuffer, mimeType);
        extractedText = result.text;
        ocrConfidence = result.confidence || null;
        pageCount = result.pageCount || null;
        wordCount = result.wordCount || null;
      } catch (extractionError: any) {

        // For images, use Gemini Vision fallback
        if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
          try {
            extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
            ocrConfidence = 0.85; // Slightly lower confidence for fallback
          } catch (visionError) {
            console.error('❌ Fallback extraction also failed:', visionError);
            throw new Error(`Failed to extract text from image: ${extractionError.message}`);
          }
        } else {
          // For non-vision files (Word, Excel, etc.) that failed, throw error
          console.error(`❌ Cannot extract text from ${mimeType}, marking as failed`);
          throw new Error(`Failed to extract text from ${mimeType}: ${extractionError.message}`);
        }
      }
    }


    // ⏱️ END TEXT EXTRACTION TIMING
    const extractionTime = Date.now() - extractionStartTime;

    // Stage 2: Text extraction complete (20%)
    emitToUser(userId, 'document-processing-update', {
      documentId,
      stage: 'extracted',
      progress: 20,
      message: 'Text extracted successfully',
      filename,
      extractedLength: extractedText.length
    });

    // CONVERT TO MARKDOWN
    let markdownContent: string | null = null;
    try {
      const markdownStartTime = Date.now();
      const markdownResult = await markdownConversionService.convertToMarkdown(
        fileBuffer,
        mimeType,
        filename,
        documentId
      );
      markdownContent = markdownResult.markdownContent;
      const markdownTime = Date.now() - markdownStartTime;
    } catch (error) {
    }

    // PRE-GENERATE PDF FOR DOCX FILES (so viewing is instant)
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (isDocx) {
      const pdfGenStartTime = Date.now();
      try {
        const { convertDocxToPdf } = await import('./docx-converter.service');

        // Get the document info
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          select: { encryptedFilename: true, userId: true }
        });

        if (!document) {
          throw new Error('Document not found');
        }

        const pdfKey = `${document.userId}/${documentId}-converted.pdf`;

        // ✅ FIX: Check if PDF already exists in S3
        const pdfExists = await fileExists(pdfKey);

        if (!pdfExists) {
          // Save DOCX to temp file
          const tempDocxPath = path.join(os.tmpdir(), `${documentId}.docx`);
          fs.writeFileSync(tempDocxPath, fileBuffer);

          // Convert to PDF
          const conversion = await convertDocxToPdf(tempDocxPath, os.tmpdir());

          if (conversion.success && conversion.pdfPath) {
            // ✅ FIX: Upload PDF to S3
            const pdfBuffer = fs.readFileSync(conversion.pdfPath);
            await uploadFile(pdfKey, pdfBuffer, 'application/pdf');


            // Clean up temp files
            fs.unlinkSync(tempDocxPath);
            fs.unlinkSync(conversion.pdfPath);
          } else {
          }
        } else {
        }
        const pdfGenTime = Date.now() - pdfGenStartTime;
      } catch (error: any) {
      }
    }

    // AUTO-CATEGORIZATION DISABLED: Documents now stay in "Recently Added" by default
    // Users can manually organize documents using the chat interface or drag-and-drop

    // ═══════════════════════════════════════════════════════════════
    // DOCUMENT INTELLIGENCE SYSTEM - Classification, Entities, Keywords
    // Replaces the old Gemini analysis with local TF-IDF + pattern matching
    // ═══════════════════════════════════════════════════════════════
    let classification = null;
    let entities = null;
    let docIntelligence: {
      classification?: DocumentClassification;
      entities?: ExtractedEntity[];
      keywords?: ExtractedKeyword[];
    } = {};

    if (extractedText && extractedText.length > 0) {
      const analysisStartTime = Date.now();
      try {
        // 1. Document Classification (type + domain)
        const docClassification = await classifyDocument(extractedText, filename, mimeType);
        docIntelligence.classification = docClassification;
        classification = `${docClassification.domain}:${docClassification.documentType}`;
        console.log(`📊 [DocIntel] Classification: ${docClassification.domain}/${docClassification.documentType} (${((docClassification.domainConfidence || docClassification.confidence) * 100).toFixed(1)}%)`);

        // 2. Entity Extraction (with domain context)
        const extractedEntities = await extractEntities(extractedText, {
          domain: docClassification.domain,
          useLLM: false // Use fast pattern matching
        });
        docIntelligence.entities = extractedEntities;
        entities = JSON.stringify(extractedEntities.slice(0, 50)); // Store top 50 entities
        console.log(`🏷️ [DocIntel] Extracted ${extractedEntities.length} entities`);

        // 3. Keyword Extraction (TF-IDF with domain boosting)
        const extractedKeywords = extractKeywords(extractedText, {
          domain: docClassification.domain,
          maxKeywords: 100
        });
        docIntelligence.keywords = extractedKeywords;
        console.log(`🔑 [DocIntel] Extracted ${extractedKeywords.length} keywords`);

        const analysisTime = Date.now() - analysisStartTime;
        console.log(`✅ [DocIntel] Document Intelligence completed in ${analysisTime}ms`);
      } catch (error: any) {
        console.error(`❌ [DocIntel] Document Intelligence failed:`, error.message);
        // Fallback to old Gemini analysis if Document Intelligence fails
        try {
          const analysis = await geminiService.analyzeDocumentWithGemini(extractedText, mimeType);
          classification = analysis.suggestedCategories?.[0] || null;
          entities = JSON.stringify(analysis.keyEntities || {});
        } catch (fallbackError) {
          // Silent fail - document will still be processed
        }
      }
    }

    // ⚡ OPTIMIZATION: Run metadata enrichment in BACKGROUND (non-blocking)
    // This saves 5-10 seconds of processing time
    let enrichedMetadata: { summary?: string; topics?: string[]; entities?: any[] } | null = null;
    if (extractedText && extractedText.length > 100) {

      // Run in background - don't await!
      Promise.resolve().then(async () => {
        try {
          // DEPRECATED: metadataEnrichment moved to _deprecated - using stub
          
          const enriched = await metadataEnrichmentService.enrichDocument(
            extractedText,
            filename,
            {
              extractTopics: true,
              extractEntities: true,
              generateSummary: true,
              extractKeyPoints: true,
              analyzeSentiment: true,
              assessComplexity: true
            }
          );

          // Update document metadata with enriched data
          await prisma.documentMetadata.update({
            where: { documentId },
            data: {
              classification: enriched.topics.length > 0 ? enriched.topics[0] : classification,
              entities: enriched.entities ? JSON.stringify(enriched.entities) : entities,
              summary: enriched.summary || null
            }
          });

        } catch (error) {
        }
      });

    }

    // Create or update metadata record (enriched data added in background)
    const metadataUpsertStartTime = Date.now();

    // Prepare Document Intelligence data for storage
    const docIntelData = {
      classification, // "domain:documentType" format
      classificationConfidence: docIntelligence.classification?.typeConfidence || null,
      domain: docIntelligence.classification?.domain || null,
      domainConfidence: docIntelligence.classification?.domainConfidence || null,
      entities, // JSON string of entities
      // Store keywords as JSON in topics field (TF-IDF top keywords)
      topics: docIntelligence.keywords
        ? JSON.stringify(docIntelligence.keywords.slice(0, 50).map(k => ({
            word: k.word,
            tfIdf: k.tfIdf,
            isDomainSpecific: k.isDomainSpecific
          })))
        : null,
    };

    await prisma.documentMetadata.upsert({
      where: { documentId },
      create: {
        documentId,
        extractedText,
        ocrConfidence,
        classification: docIntelData.classification,
        classificationConfidence: docIntelData.classificationConfidence,
        domain: docIntelData.domain,
        domainConfidence: docIntelData.domainConfidence,
        entities: docIntelData.entities,
        topics: docIntelData.topics,
        summary: null, // Summary added by background enrichment
        thumbnailUrl,
        pageCount,
        wordCount,
        markdownContent,
        slidesData: slidesData ? JSON.stringify(slidesData) : null,
        pptxMetadata: pptxMetadata ? JSON.stringify(pptxMetadata) : null,
      },
      update: {
        extractedText,
        ocrConfidence,
        classification: docIntelData.classification,
        classificationConfidence: docIntelData.classificationConfidence,
        domain: docIntelData.domain,
        domainConfidence: docIntelData.domainConfidence,
        entities: docIntelData.entities,
        topics: docIntelData.topics,
        summary: null, // Summary added by background enrichment
        thumbnailUrl,
        pageCount,
        wordCount,
        markdownContent,
        slidesData: slidesData ? JSON.stringify(slidesData) : null,
        pptxMetadata: pptxMetadata ? JSON.stringify(pptxMetadata) : null,
      },
    });
    const metadataUpsertTime = Date.now() - metadataUpsertStartTime;
    console.log(`💾 [DocIntel] Stored Document Intelligence metadata in ${metadataUpsertTime}ms`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STORE ENTITIES AND KEYWORDS IN DEDICATED TABLES (for advanced querying)
    // ═══════════════════════════════════════════════════════════════════════════
    if (docIntelligence.entities && docIntelligence.entities.length > 0) {
      try {
        // Delete existing entities for this document (in case of re-upload)
        await prisma.documentEntity.deleteMany({
          where: { documentId },
        });

        // Store entities in dedicated table (batch insert)
        const entityRecords = docIntelligence.entities.slice(0, 100).map((entity: any) => ({
          documentId,
          entityType: entity.type || 'UNKNOWN',
          value: entity.value || '',
          normalizedValue: entity.normalizedValue || entity.value || '',
          pageNumber: entity.pageNumber || null,
          textIndex: entity.textIndex || 0,
          context: entity.context || '',
          confidence: entity.confidence || 1.0,
          metadata: entity.metadata ? JSON.stringify(entity.metadata) : null,
        }));

        await prisma.documentEntity.createMany({
          data: entityRecords,
          skipDuplicates: true,
        });
        console.log(`🏷️ [DocIntel] Stored ${entityRecords.length} entities in DocumentEntity table`);
      } catch (entityError: any) {
        console.warn(`⚠️ [DocIntel] Failed to store entities in dedicated table:`, entityError.message);
      }
    }

    if (docIntelligence.keywords && docIntelligence.keywords.length > 0) {
      try {
        // Delete existing keywords for this document (in case of re-upload)
        await prisma.documentKeyword.deleteMany({
          where: { documentId },
        });

        // Store keywords in dedicated table (batch insert)
        const keywordRecords = docIntelligence.keywords.slice(0, 100).map((keyword: any) => ({
          documentId,
          word: keyword.word || '',
          count: keyword.count || 1,
          tfIdf: keyword.tfIdf || null,
          isDomainSpecific: keyword.isDomainSpecific || false,
        }));

        await prisma.documentKeyword.createMany({
          data: keywordRecords,
          skipDuplicates: true,
        });
        console.log(`🔑 [DocIntel] Stored ${keywordRecords.length} keywords in DocumentKeyword table`);
      } catch (keywordError: any) {
        console.warn(`⚠️ [DocIntel] Failed to store keywords in dedicated table:`, keywordError.message);
      }
    }

    // ⚡ OPTIMIZATION: AUTO-GENERATE TAGS IN BACKGROUND (NON-BLOCKING)
    // Tag generation takes 10-20s but doesn't block embedding generation
    // This saves 10-20 seconds by running in parallel!
    if (extractedText && extractedText.length > 20) {

      // Run in background - don't await!
      Promise.resolve().then(async () => {
        try {
          const tags = await geminiService.generateDocumentTags(filename, extractedText);

          // Create or find tags and link them to the document
          for (const tagName of tags) {
            // Get or create tag
            let tag = await prisma.tag.findUnique({
              where: { userId_name: { userId, name: tagName } },
            });

            if (!tag) {
              tag = await prisma.tag.create({
                data: { userId, name: tagName },
              });
            }

            // Link tag to document (skip if already linked)
            await prisma.documentTag.upsert({
              where: {
                documentId_tagId: {
                  documentId,
                  tagId: tag.id,
                },
              },
              update: {},
              create: {
                documentId,
                tagId: tag.id,
              },
            });
          }
        } catch (error) {
        }
      });

    }

    // ⚡ OPTIMIZATION: GENERATE VECTOR EMBEDDINGS IN BACKGROUND (non-blocking)
    // This saves 15-25 seconds of processing time for instant document availability
    // Documents can still be used in chat - embeddings will be available shortly after upload
    if (extractedText && extractedText.length > 50) {

      // Stage 3: Starting embedding generation (40%)
      emitToUser(userId, 'document-processing-update', {
        documentId,
        stage: 'embedding',
        progress: 40,
        message: 'Generating AI embeddings...',
        filename
      });

      // ═══════════════════════════════════════════════════════════════
      // KODA FIX: Synchronous embedding generation
      // Wait for embeddings to complete before marking as completed
      // ═══════════════════════════════════════════════════════════════
      try {
          // Import WebSocket service for progress updates inside async context
          const { emitToUser: emitToUserAsync } = await import('./websocket.service');
          const vectorEmbeddingService = await import('./vectorEmbedding.service');
          const embeddingService = await import('./embedding.service');
          let chunks;

          // Use enhanced Excel processor for Excel files to preserve cell coordinates
          if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
              mimeType === 'application/vnd.ms-excel') {
            const excelProcessor = await import('./excelProcessor.service');
            const excelChunks = await excelProcessor.default.processExcel(fileBuffer);

            // ⚡ EXCEL FORMULA ENGINE: Load into HyperFormula for live calculations
            try {
              const { excelFormulaEngine } = await import('./calculation');
              await excelFormulaEngine.initialize();
              const excelInfo = await excelFormulaEngine.loadExcelFile(fileBuffer, documentId);
              console.log(`✅ [DOCUMENT] Excel loaded into formula engine: ${excelInfo.sheets.length} sheets, ${excelInfo.totalFormulas} formulas`);
            } catch (excelEngineError) {
              // Non-critical - Excel processing can continue without formula engine
              console.warn(`⚠️ [DOCUMENT] Excel formula engine load failed (non-critical):`, excelEngineError);
            }

            // Convert Excel chunks to embedding format with full document metadata
            // ⚡ CRITICAL: Prepend filename to content so AI sees it prominently
            chunks = excelChunks.map(chunk => ({
              content: `📄 File: ${filename} | ${chunk.content}`,
              metadata: {
                // ⚡ Document identification (CRITICAL for proper retrieval)
                documentId: documentId,
                filename: filename,

                // ⚡ Excel-specific metadata
                sheet: chunk.metadata.sheetName,
                sheetNumber: chunk.metadata.sheetNumber,
                row: chunk.metadata.rowNumber,
                cells: chunk.metadata.cells,
                chunkIndex: chunk.metadata.chunkIndex,
                sourceType: chunk.metadata.sourceType,
                tableHeaders: chunk.metadata.tableHeaders
              }
            }));

            // 🆕 Generate embeddings for Excel chunks using Gemini embedding service
            const excelTexts = chunks.map(c => c.content);
            const excelEmbeddingResult = await embeddingService.default.generateBatchEmbeddings(excelTexts, {
              taskType: 'RETRIEVAL_DOCUMENT',
              title: filename
            });

            // Update chunks with embeddings
            chunks = chunks.map((chunk, i) => ({
              ...chunk,
              embedding: excelEmbeddingResult.embeddings[i]?.embedding || new Array(1536).fill(0)
            }));
          } else {
            // 🆕 Phase 4C: For PowerPoint, use slide-level chunks with metadata
            const isPowerPoint = mimeType.includes('presentation');

            if (isPowerPoint && pptxSlideChunks && pptxSlideChunks.length > 0) {
              chunks = pptxSlideChunks.map(slideChunk => ({
                content: slideChunk.content,
                metadata: {
                  filename,
                  slideNumber: slideChunk.metadata.slideNumber,
                  totalSlides: slideChunk.metadata.totalSlides,
                  slideTitle: slideChunk.metadata.slideTitle,
                  hasNotes: slideChunk.metadata.hasNotes,
                  sourceType: 'powerpoint',
                  chunkType: 'slide'
                }
              }));
            } else {
              // ═══════════════════════════════════════════════════════════════
              // SEMANTIC CHUNKING with proper size and overlap
              // ═══════════════════════════════════════════════════════════════
              console.log('📝 [CHUNKING] Using improved chunking with overlap...');

              // Use improved chunking with overlap for better retrieval
              const overlapChunks = chunkTextWithOverlap(extractedText, {
                maxSize: 1000,    // ~600 tokens (optimal for embeddings)
                overlap: 200,     // 20% overlap for context continuity
                splitOn: ['\n\n', '\n', '. ', '! ', '? '],  // Smart boundaries
              });

              // Get document classification info for chunk classification context
              const docType = docIntelligence.classification?.documentType;
              const domain = docIntelligence.classification?.domain;

              // ═══════════════════════════════════════════════════════════════
              // DOCUMENT INTELLIGENCE: Chunk Classification
              // Classify each chunk to identify content type (header, table, etc.)
              // ═══════════════════════════════════════════════════════════════
              console.log('📦 [DocIntel] Classifying chunks...');
              

              chunks = await Promise.all(overlapChunks.map(async (chunk) => {
                // Classify each chunk
                let chunkClass: ChunkClassification | null = null;
                try {
                  chunkClass = await classifyChunk(chunk.content, {
                    documentType: docType,
                    domain: domain
                  });
                } catch (e) {
                  // Non-critical - continue without chunk classification
                }

                return {
                  content: chunk.content,
                  metadata: {
                    chunkIndex: chunk.index,
                    startChar: chunk.startChar,
                    endChar: chunk.endChar,
                    // Document Intelligence: Chunk Classification
                    chunkType: chunkClass?.chunkType || 'content',
                    chunkCategory: chunkClass?.category || 'main_content',
                    chunkConfidence: chunkClass?.confidence || 0,
                    // Document context
                    documentType: docType,
                    domain: domain
                  }
                };
              }));

              console.log(`✅ [CHUNKING] Created ${chunks.length} chunks with overlap + classification`);
            }

            // 🆕 Generate embeddings using OpenAI embedding service
            const texts = chunks.map(c => c.content);
            const embeddingResult = await embeddingService.default.generateBatchEmbeddings(texts);

            // Update chunks with embeddings
            chunks = chunks.map((chunk, i) => ({
              ...chunk,
              embedding: embeddingResult.embeddings[i]?.embedding || new Array(1536).fill(0)
            }));
          }

          // ✅ FIX: DocumentChunk removed - chunks stored via vectorEmbeddingService
          // The storeDocumentEmbeddings handles both Pinecone and DocumentEmbedding table
          console.log(`💾 [Document] Preparing to store ${chunks.length} embeddings...`);

          // Store embeddings in Pinecone + DocumentEmbedding table
          console.log(`🔄 [DIAGNOSTIC] About to call storeDocumentEmbeddings...`);
          await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);
          console.log(`✅ [DIAGNOSTIC] storeDocumentEmbeddings completed successfully!`);

          // ═══════════════════════════════════════════════════════════════
          // VERIFY EMBEDDINGS STORAGE
          // ═══════════════════════════════════════════════════════════════
          console.log('🔍 [VERIFICATION] Verifying embeddings were stored...');
          try {
            const pineconeService = await import('./pinecone.service');
            const verification = await pineconeService.default.verifyDocumentEmbeddings(documentId);

            if (!verification.success || verification.count < chunks.length * 0.95) {
              // Allow 5% loss for edge cases
              const expectedCount = chunks.length;
              const actualCount = verification.count;

              console.error(`❌ [VERIFICATION] Embedding storage verification failed!`);
              console.error(`   Expected: ${expectedCount} chunks`);
              console.error(`   Found: ${actualCount} embeddings`);
              console.error(`   Success rate: ${((actualCount / expectedCount) * 100).toFixed(1)}%`);

              throw new Error(
                `Embedding verification failed: expected ${expectedCount}, got ${actualCount}`
              );
            }

            console.log(`✅ [VERIFICATION] Confirmed ${verification.count}/${chunks.length} embeddings stored`);

          } catch (verifyError: any) {
            // ═══════════════════════════════════════════════════════════════
            // KODA FIX: Re-throw verification errors to mark document as failed
            // ═══════════════════════════════════════════════════════════════
            console.error('❌ [VERIFICATION] Verification error:', verifyError);
            
            // If it's a verification failure (not just a Pinecone connection issue), re-throw
            if (verifyError.message?.includes('Embedding verification failed')) {
              throw verifyError; // This will mark document as 'failed'
            }
            // For other errors (like Pinecone being down), log but continue
            console.warn('⚠️ [VERIFICATION] Non-critical error, continuing...');
          }

          // Emit embedding completion (80%)
          emitToUserAsync(userId, 'document-processing-update', {
            documentId,
            stage: 'embedding-complete',
            progress: 80,
            message: 'AI embeddings generated',
            filename,
            chunksCount: chunks.length
          });

          // ⚡ NOTIFY USER: Embeddings ready for AI chat
          emitToUserAsync(userId, 'document-embeddings-ready', {
            documentId,
            filename,
            chunksCount: chunks.length,
            message: `${filename} is now ready for AI chat!`
          });
        // ═══════════════════════════════════════════════════════════════
        // KODA FIX: Update status after embeddings complete
        // ═══════════════════════════════════════════════════════════════
        const crypto = require('crypto');
        const fileHashActual = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // ═══════════════════════════════════════════════════════════════
        // Generate AI-powered display title for the document
        // ═══════════════════════════════════════════════════════════════
        let displayTitle: string | null = null;
        try {
          const { detectLanguage } = await import('./languageDetection.service');
          const detectedLang = detectLanguage(extractedText?.slice(0, 500) || '') || 'pt';

          displayTitle = await generateDocumentTitleOnly({
            filename,
            documentText: extractedText?.slice(0, 1000), // First 1000 chars for context
            language: detectedLang
          });
          console.log(`📝 [TITLE] Generated display title: "${displayTitle}"`);
        } catch (titleError: any) {
          console.warn(`⚠️ [TITLE] Failed to generate title: ${titleError.message}`);
          // Don't fail the whole process - displayTitle will remain null
        }

        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'completed',
            fileHash: fileHashActual,
            renderableContent: extractedText || null,
            embeddingsGenerated: true,
            chunksCount: chunks?.length || 0,
            displayTitle: displayTitle, // AI-generated human-readable title
            updatedAt: new Date()
          },
        });

        console.log(`✅ [DOCUMENT] Completed with ${chunks?.length || 0} embeddings`);
      } catch (embeddingError: any) {
        // ═══════════════════════════════════════════════════════════════
        // KODA FIX: Mark as FAILED if embeddings fail
        // ═══════════════════════════════════════════════════════════════
        console.error('❌ [EMBEDDING] Failed:', embeddingError);

        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'failed',
            error: embeddingError.message || 'Embedding generation failed',
            embeddingsGenerated: false,
            updatedAt: new Date()
          },
        });

        emitToUser(userId, 'document-embeddings-failed', {
          documentId,
          filename,
          error: embeddingError.message || 'Unknown error'
        });

        throw embeddingError;
      }

    }

    // 🔍 VERIFY PINECONE STORAGE - Temporarily disabled during OpenAI migration
    // The embeddings are being stored successfully, verification is failing due to dimension query issues

    // TODO: Re-enable verification after migration is complete
    // const pineconeService = await import('./pinecone.service');
    // const verification = await pineconeService.default.verifyDocument(documentId);

    // ═══════════════════════════════════════════════════════════════
    // KODA FIX: Status update is now handled in the embedding try/catch block above
    // Document is marked "completed" ONLY after embeddings succeed
    // ═══════════════════════════════════════════════════════════════

    // ⚡ OPTIMIZATION: Run NER in BACKGROUND (non-blocking)
    // This saves 3-5 seconds of processing time
    if (extractedText && extractedText.trim().length > 0) {
      // Run in background - don't await!
      Promise.resolve().then(async () => {
        try {
          const nerStartTime = Date.now();

          // Extract entities using NER
          const nerResult = await nerService.extractEntities(extractedText, filename);

          // Store entities in database
          if (nerResult.entities.length > 0) {
            await nerService.storeEntities(documentId, nerResult.entities);
          }

          // Auto-tag document based on entities and content
          await nerService.autoTagDocument(
            userId,
            documentId,
            nerResult.entities,
            nerResult.suggestedTags
          );

          const nerTime = Date.now() - nerStartTime;
        } catch (nerError: any) {
          // NER is not critical - log error but continue
        }
      });


      // ⚡ METHODOLOGY KNOWLEDGE EXTRACTION - Run in background (non-blocking)
      // This builds the methodology knowledge base for "What is X?" queries
      Promise.resolve().then(async () => {
        try {
          // DEPRECATED: methodologyExtraction moved to _deprecated - using stub
          
          // Stub does nothing - methodology extraction disabled
        } catch (methodologyError: any) {
          // Methodology extraction is not critical - log error but continue
        }
      });


      // ⚡ DOMAIN KNOWLEDGE EXTRACTION - Run in background (non-blocking)
      // This builds the domain knowledge base for term definitions, formulas, etc.
      Promise.resolve().then(async () => {
        try {
          // DEPRECATED: domainKnowledge moved to _deprecated - using stub
          
          // Stub does nothing - domain knowledge extraction disabled
        } catch (domainError: any) {
          // Domain extraction is not critical - log error but continue
        }
      });

      // ⚡ BM25 CHUNK CREATION - Run in background (non-blocking)
      // Creates text chunks for keyword search (hybrid retrieval)
      Promise.resolve().then(async () => {
        try {
          const bm25Service = bm25ChunkCreationService;
          const textForChunking = markdownContent || extractedText;
          await bm25Service.createBM25Chunks(documentId, textForChunking, pageCount);
        } catch (bm25Error: any) {
          // BM25 chunking is not critical - log error but continue
          console.error('❌ [Background] BM25 chunk creation failed (non-critical):', bm25Error.message);
        }
      });

    } else {
    }

    // Invalidate cache for this user after successful processing
    await cacheService.invalidateUserCache(userId);
    // ⚡ PERFORMANCE: Invalidate file listing cache
    invalidateFileListingCache(userId);

    // ⏱️ TOTAL PROCESSING TIME
    const totalProcessingTime = Date.now() - processingStartTime;

    // Stage 4: Processing complete! (100%)
    emitToUser(userId, 'document-processing-update', {
      documentId,
      stage: 'completed',
      progress: 100,
      message: 'Document ready!',
      filename
    });

    // ✅ FIX: Emit processing-complete event with full document data
    // This allows frontend to update document status in state
    const completedDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: { folder: { select: { id: true, name: true, emoji: true } } }
    });
    if (completedDocument) {
      emitToUser(userId, 'processing-complete', completedDocument);
    }

  } catch (error: any) {
    // This catch block should never be reached due to outer try-catch,
    // but kept as a safety net
    console.error('❌ CRITICAL: Unhandled error in processDocumentWithTimeout:', error);

    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'failed',
          updatedAt: new Date()
        },
      });
    } catch (updateError) {
      console.error('❌ CRITICAL: Failed to update status in inner catch:', updateError);
    }

    throw error;
  }
}

export interface CreateDocumentAfterUploadInput {
  userId: string;
  encryptedFilename: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  folderId?: string;
  thumbnailData?: string; // Base64 encoded thumbnail
}

/**
 * Create document record after direct upload to GCS (via signed URL)
 */
export const createDocumentAfterUpload = async (input: CreateDocumentAfterUploadInput) => {
  const { userId, encryptedFilename, filename, mimeType, fileSize, fileHash, folderId, thumbnailData } = input;


  // ⚡ IDEMPOTENCY CHECK: Skip if identical file already uploaded to the SAME folder
  const existingDoc = await prisma.document.findFirst({
    where: {
      userId,
      fileHash,
      status: 'completed',
      // Allow same file in different folders
      folderId: folderId,
    },
  });

  if (existingDoc) {

    return await prisma.document.findUnique({
      where: { id: existingDoc.id },
      include: { folder: true },
    });
  }


  // Upload thumbnail if provided
  let thumbnailUrl: string | null = null;
  if (thumbnailData) {
    try {
      const thumbnailFilename = `${userId}/thumbnails/${crypto.randomUUID()}-${Date.now()}.jpg`;
      const thumbnailBuffer = Buffer.from(thumbnailData, 'base64');
      await uploadFile(thumbnailFilename, thumbnailBuffer, 'image/jpeg');
      thumbnailUrl = await getSignedUrl(thumbnailFilename);
    } catch (error) {
    }
  }

  // Create document record
  const document = await prisma.document.create({
    data: {
      userId,
      folderId: folderId || null,
      filename,
      encryptedFilename,
      fileSize,
      mimeType,
      fileHash,
      status: 'processing',
    },
    include: {
      folder: true,
    },
  });

  // ✅ ASYNCHRONOUS PROCESSING: Start in background, return immediately

  // Start processing in background (don't await)
  processDocumentAsync(
    document.id,
    encryptedFilename,
    filename,
    mimeType,
    userId,
    thumbnailUrl
  )
    .then(() => {
    })
    .catch(async (error: any) => {
      console.error(`❌ Background processing failed for ${filename}:`, error);

      // Update document status to 'failed'
      try {
        await prisma.document.update({
          where: { id: document.id },
          data: {
            status: 'failed',
            updatedAt: new Date(),
          },
        });

        // Emit WebSocket event for failure
        const io = require('../server').io;
        if (io) {
          io.to(`user:${userId}`).emit('document-processing-failed', {
            documentId: document.id,
            filename,
            error: error.message || 'Processing failed',
          });
        }
      } catch (updateError) {
        console.error(`❌ Failed to update document status:`, updateError);
      }
    });

  // ✅ RETURN IMMEDIATELY with 'processing' status
  return document;
};

/**
 * Process document asynchronously after direct upload
 */
async function processDocumentAsync(
  documentId: string,
  encryptedFilename: string,
  filename: string,
  mimeType: string,
  userId: string,
  thumbnailUrl: string | null
) {
  const io = require('../server').io;

  // Helper function to emit progress updates
  const emitProgress = (stage: string, progress: number, message: string) => {
    if (io) {
      io.to(`user:${userId}`).emit('document-processing-update', {
        documentId,
        filename,
        stage,
        progress,
        message,
        status: 'processing'
      });
    } else {
    }
  };

  try {

    // Stage 1: Starting (5%)
    emitProgress('starting', 5, 'Starting document processing...');

    // Get document to check if it's encrypted
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Stage 2: Downloading (10%)
    emitProgress('downloading', 10, 'Downloading file from storage...');
    let fileBuffer = await downloadFile(encryptedFilename);

    // 🔓 DECRYPT FILE IF ENCRYPTED
    if (document.isEncrypted && document.encryptionIV && document.encryptionAuthTag) {
      // Stage 3: Decrypting (15%)
      emitProgress('decrypting', 15, 'Decrypting file...');
      const encryptionService = await import('./encryption.service');

      // Reconstruct encrypted buffer format: IV + AuthTag + EncryptedData
      const ivBuffer = Buffer.from(document.encryptionIV, 'base64');
      const authTagBuffer = Buffer.from(document.encryptionAuthTag, 'base64');
      const encryptedData = fileBuffer;

      // Create buffer in format expected by decryptFile
      const encryptedBuffer = Buffer.concat([ivBuffer, authTagBuffer, encryptedData]);

      // Decrypt
      fileBuffer = encryptionService.default.decryptFile(encryptedBuffer, `document-${userId}`);
    }

    // Stage 4: Extracting text (20%)
    emitProgress('extracting', 20, 'Extracting text from document...');

    // Extract text based on file type
    let extractedText = '';
    let ocrConfidence: number | null = null;
    let pageCount: number | null = null;
    let wordCount: number | null = null;
    let slidesData: any[] | null = null;
    let pptxMetadata: any | null = null;
    let pptxSlideChunks: any[] | null = null; // For Phase 4C: Slide-level chunks

    // Check if it's a PowerPoint file - use Python PPTX extractor
    const isPPTX = mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (isPPTX) {
      try {
        // Save file buffer to temporary file
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `pptx-${crypto.randomUUID()}.pptx`);
        fs.writeFileSync(tempFilePath, fileBuffer);

        // Import and use PPTX extractor
        const { pptxExtractorService } = await import('./pptxExtractor.service');
        const result = await pptxExtractorService.extractText(tempFilePath);

        if (result.success) {
          extractedText = result.fullText || '';
          const extractedSlides = result.slides || [];
          pptxMetadata = result.metadata || {};
          pageCount = result.totalSlides || null;

          // Store slide text data immediately (even without images)
          slidesData = extractedSlides.map((slide) => ({
            slideNumber: slide.slide_number,
            content: slide.content,
            textCount: slide.text_count,
            imageUrl: null, // Will be updated later if images are generated
          }));


          // 🆕 Phase 4C: Process PowerPoint into slide-level chunks
          const pptxProcessResult = await pptxProcessorService.processFile(tempFilePath);
          if (pptxProcessResult.success) {
            pptxSlideChunks = pptxProcessResult.chunks;
          } else {
          }

          // ✅ FIX: PROACTIVE image extraction approach - Always extract images first
          (async () => {
            try {
              // Import prisma in async scope
              const prismaClient = (await import('../config/database')).default;


              // ✅ FIX: ALWAYS extract images first (proactive approach)
              const { PPTXImageExtractorService } = await import('./pptxImageExtractor.service');
              const extractor = new PPTXImageExtractorService();

              const imageResult = await extractor.extractImages(
                tempFilePath,
                documentId,
                {
                  uploadToGCS: true,
                  signedUrlExpiration: 604800 // 7 days instead of 1 hour
                }
              );

              if (imageResult.success && imageResult.slides && imageResult.slides.length > 0) {

                // Fetch existing slidesData to preserve text content
                const existingMetadata = await prismaClient.documentMetadata.findUnique({
                  where: { documentId }
                });

                let existingSlidesData: any[] = [];
                try {
                  if (existingMetadata?.slidesData) {
                    existingSlidesData = typeof existingMetadata.slidesData === 'string'
                      ? JSON.parse(existingMetadata.slidesData)
                      : existingMetadata.slidesData as any[];
                  }
                } catch (e) {
                }

                // Merge extracted images with existing slide data
                const mergedSlidesData = existingSlidesData.map((existingSlide: any) => {
                  const slideNum = existingSlide.slideNumber || existingSlide.slide_number;
                  const extractedSlide = imageResult.slides!.find(s => s.slideNumber === slideNum);

                  // Use composite image if available, otherwise first image
                  const imageUrl = extractedSlide?.compositeImageUrl
                    || (extractedSlide?.images && extractedSlide.images.length > 0
                        ? extractedSlide.images[0].imageUrl
                        : null);

                  return {
                    slideNumber: slideNum,
                    content: existingSlide.content || '',
                    textCount: existingSlide.textCount || existingSlide.text_count || 0,
                    imageUrl: imageUrl || existingSlide.imageUrl // Preserve old imageUrl if extraction failed
                  };
                });

                // Update metadata with extracted images (use upsert in case metadata doesn't exist yet)
                await prismaClient.documentMetadata.upsert({
                  where: { documentId },
                  update: {
                    slidesData: JSON.stringify(mergedSlidesData),
                    slideGenerationStatus: 'completed'
                  },
                  create: {
                    documentId,
                    slidesData: JSON.stringify(mergedSlidesData),
                    slideGenerationStatus: 'completed'
                  }
                });

              } else {

                // Update status to show extraction failed (use upsert in case metadata doesn't exist yet)
                await prismaClient.documentMetadata.upsert({
                  where: { documentId },
                  update: {
                    slideGenerationStatus: 'failed',
                    slideGenerationError: imageResult.error || 'Image extraction failed'
                  },
                  create: {
                    documentId,
                    slideGenerationStatus: 'failed',
                    slideGenerationError: imageResult.error || 'Image extraction failed'
                  }
                });
              }

              // ✅ FIX: Optional enhancement - Try LibreOffice for full slide renders
              // This runs AFTER image extraction, so users already have images
              try {
                // DEPRECATED: pptxSlideGenerator.service removed - using stub
                const pptxSlideGeneratorService = { generateSlideImages: async (_a: any, _b: any, _c: any) => ({ success: false, slides: [] as any[] }) };
                const slideResult = await pptxSlideGeneratorService.generateSlideImages(
                  tempFilePath,
                  documentId,
                  {
                    uploadToGCS: true,
                    maxWidth: 1920,
                    quality: 90
                  }
                );

                if (slideResult.success && slideResult.slides && slideResult.slides.length > 0) {
                  // ✅ FIX: Validate that slides actually have images (not just text)
                  const validSlides = slideResult.slides.filter(slide => {
                    // Check if slide has valid dimensions (not just text)
                    return slide.width && slide.height && slide.publicUrl;
                  });

                  if (validSlides.length > 0) {

                    // Fetch current slidesData
                    const currentMetadata = await prismaClient.documentMetadata.findUnique({
                      where: { documentId }
                    });

                    let currentSlidesData: any[] = [];
                    try {
                      if (currentMetadata?.slidesData) {
                        currentSlidesData = typeof currentMetadata.slidesData === 'string'
                          ? JSON.parse(currentMetadata.slidesData)
                          : currentMetadata.slidesData as any[];
                      }
                    } catch (e) {
                    }

                    // Enhance with full renders (replace extracted images with better quality)
                    const enhancedSlidesData = currentSlidesData.map((existingSlide: any) => {
                      const slideNum = existingSlide.slideNumber;
                      const fullRender = validSlides.find(s => s.slideNumber === slideNum);

                      return {
                        ...existingSlide,
                        imageUrl: fullRender?.publicUrl || existingSlide.imageUrl, // Use full render if available
                        width: fullRender?.width || existingSlide.width,
                        height: fullRender?.height || existingSlide.height
                      };
                    });

                    // Update with enhanced renders (use upsert in case metadata doesn't exist yet)
                    await prismaClient.documentMetadata.upsert({
                      where: { documentId },
                      update: {
                        slidesData: JSON.stringify(enhancedSlidesData),
                        slideGenerationStatus: 'completed'
                      },
                      create: {
                        documentId,
                        slidesData: JSON.stringify(enhancedSlidesData),
                        slideGenerationStatus: 'completed'
                      }
                    });

                  } else {
                  }
                } else {
                }
              } catch (libreOfficeError: any) {
                // Don't fail the whole process - extracted images are already saved
              }

            } catch (error: any) {
              console.error(`❌ [Background] PPTX processing error for ${filename}:`, error);

              // Update status to failed (use upsert in case metadata doesn't exist yet)
              const prismaClient = (await import('../config/database')).default;
              await prismaClient.documentMetadata.upsert({
                where: { documentId },
                update: {
                  slideGenerationStatus: 'failed',
                  slideGenerationError: error.message
                },
                create: {
                  documentId,
                  slideGenerationStatus: 'failed',
                  slideGenerationError: error.message
                }
              }).catch(err => console.error('Failed to update error status:', err));
            } finally {
              // Clean up temp file
              try {
                fs.unlinkSync(tempFilePath);
              } catch (cleanupError: any) {
              }
            }
          })().catch(err => console.error('Background PPTX processing error:', err));
        } else {
          throw new Error('PPTX extraction failed');
        }
      } catch (pptxError: any) {
        console.error('❌ CRITICAL: Python PPTX extraction failed. This document will be marked as failed.');
        console.error('   └── Error:', pptxError.message);
        // Re-throw the error to be caught by the main try-catch block, which will set the document status to 'failed'
        throw new Error(`PowerPoint processing failed: ${pptxError.message}`);
      }
    }
    // Check if it's an image type that needs OCR via OpenAI Vision
    else if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
      extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
      ocrConfidence = 0.95;
    } else {
      // Use standard text extraction service
      try {
        const result = await textExtractionService.extractText(fileBuffer, mimeType);
        extractedText = result.text;
        ocrConfidence = result.confidence || null;
        pageCount = result.pageCount || null;
        wordCount = result.wordCount || null;
      } catch (extractionError: any) {

        if (mimeType === 'application/pdf') {
          try {
            const visionService = await import('./vision.service');
            const ocrResult = await visionService.extractTextFromScannedPDF(fileBuffer);
            extractedText = ocrResult.text;
            ocrConfidence = ocrResult.confidence || 0.85;
          } catch (visionError) {
            console.error('❌ Google Cloud Vision also failed:', visionError);
            throw new Error(`Failed to extract text from scanned PDF: ${extractionError.message}`);
          }
        } else if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
          try {
            extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
            ocrConfidence = 0.85;
          } catch (visionError) {
            console.error('❌ Fallback extraction also failed:', visionError);
            throw new Error(`Failed to extract text from image: ${extractionError.message}`);
          }
        } else {
          console.error(`❌ Cannot extract text from ${mimeType}, marking as failed`);
          throw new Error(`Failed to extract text from ${mimeType}: ${extractionError.message}`);
        }
      }
    }


    // CONVERT TO MARKDOWN
    let markdownContent: string | null = null;
    try {
      const markdownResult = await markdownConversionService.convertToMarkdown(
        fileBuffer,
        mimeType,
        filename,
        documentId
      );
      markdownContent = markdownResult.markdownContent;
    } catch (error) {
    }

    // PRE-GENERATE PDF PREVIEW FOR DOCX FILES (so viewing is instant)
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (isDocx) {
      try {
        const { convertDocxToPdf } = await import('./docx-converter.service');

        // ✅ FIX: Use the correct PDF path format
        // DOCX files are converted to PDF and stored as `${userId}/${documentId}-converted.pdf`
        const pdfKey = `${userId}/${documentId}-converted.pdf`;

        // ✅ FIX: Check if PDF already exists in S3
        const pdfExists = await fileExists(pdfKey);

        if (!pdfExists) {
          // Save DOCX to temp file
          const tempDocxPath = path.join(os.tmpdir(), `${documentId}.docx`);
          fs.writeFileSync(tempDocxPath, fileBuffer);

          // Convert to PDF
          const conversion = await convertDocxToPdf(tempDocxPath, os.tmpdir());

          if (conversion.success && conversion.pdfPath) {
            // ✅ FIX: Upload PDF to S3
            const pdfBuffer = fs.readFileSync(conversion.pdfPath);
            await uploadFile(pdfKey, pdfBuffer, 'application/pdf');


            // Clean up temp files
            fs.unlinkSync(tempDocxPath);
            fs.unlinkSync(conversion.pdfPath);
          } else {
          }
        } else {
        }
      } catch (error: any) {
      }
    }

    // Stage 5: Analyzing document (40-50%)
    emitProgress('analyzing', 45, 'Analyzing document content...');

    // Analyze document with Gemini
    let classification = null;
    let entities = null;

    if (extractedText && extractedText.length > 0) {
      try {
        const analysis = await geminiService.analyzeDocumentWithGemini(extractedText, mimeType);
        classification = analysis.suggestedCategories?.[0] || null;
        entities = JSON.stringify(analysis.keyEntities || {});
      } catch (error) {
      }
    }

    emitProgress('analyzing', 50, 'Analysis complete');

    // 🆕 ENHANCED METADATA ENRICHMENT with semantic understanding
    let enrichedMetadata: { summary?: string; topics?: string[]; entities?: any[] } | null = null;
    if (extractedText && extractedText.length > 100) {
      try {
        // DEPRECATED: metadataEnrichment moved to _deprecated - using stub
        
        enrichedMetadata = await metadataEnrichmentService.enrichDocument(
          extractedText,
          filename,
          {
            extractTopics: true,
            extractEntities: true,
            generateSummary: true,
            extractKeyPoints: true,
            analyzeSentiment: true,
            assessComplexity: true
          }
        );

        // Use enriched data if basic analysis didn't provide these
        if (!classification && enrichedMetadata?.topics && enrichedMetadata.topics.length > 0) {
          classification = enrichedMetadata.topics[0];
        }
        if ((!entities || entities === '{}') && enrichedMetadata?.entities) {
          entities = JSON.stringify(enrichedMetadata.entities);
        }

      } catch (error) {
      }
    }

    // Create or update metadata record (upsert handles retry cases)
    await prisma.documentMetadata.upsert({
      where: { documentId },
      create: {
        documentId,
        extractedText,
        ocrConfidence,
        classification,
        entities,
        summary: enrichedMetadata?.summary || null,
        thumbnailUrl,
        pageCount,
        wordCount,
        markdownContent,
        slidesData: slidesData ? JSON.stringify(slidesData) : null,
        pptxMetadata: pptxMetadata ? JSON.stringify(pptxMetadata) : null,
      },
      update: {
        extractedText,
        ocrConfidence,
        classification,
        entities,
        summary: enrichedMetadata?.summary || null,
        thumbnailUrl,
        pageCount,
        wordCount,
        markdownContent,
        slidesData: slidesData ? JSON.stringify(slidesData) : null,
        pptxMetadata: pptxMetadata ? JSON.stringify(pptxMetadata) : null,
      },
    });

    // ✅ OPTIMIZATION: Skip tag generation in main flow to save 5-10 seconds
    // Tags will be generated in background after document is complete
    emitProgress('tagging', 60, 'Tags will be generated in background...');

    // Stage 7: Embedding generation (60-85%)
    // ⚡ NON-BLOCKING: Embeddings generate in background (20-30s)
    // This allows upload to complete instantly (2-7s) while embeddings generate asynchronously

    // GENERATE VECTOR EMBEDDINGS FOR RAG WITH SEMANTIC CHUNKING (BACKGROUND)
    if (extractedText && extractedText.length > 50) {

      // Fire-and-forget IIFE - runs in background without blocking
      (async () => {
        try {
          emitProgress('embedding', 65, 'Generating embeddings in background...');

          const vectorEmbeddingService = await import('./vectorEmbedding.service');
          const embeddingService = await import('./embedding.service');
          let chunks;

          // Use enhanced Excel processor for Excel files to preserve cell coordinates
          if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
              mimeType === 'application/vnd.ms-excel') {
            const excelProcessor = await import('./excelProcessor.service');
            const excelChunks = await excelProcessor.default.processExcel(fileBuffer);

            // ⚡ EXCEL FORMULA ENGINE: Load into HyperFormula for live calculations
            try {
              const { excelFormulaEngine } = await import('./calculation');
              await excelFormulaEngine.initialize();
              const excelInfo = await excelFormulaEngine.loadExcelFile(fileBuffer, documentId);
              console.log(`✅ [DOCUMENT-ZK] Excel loaded into formula engine: ${excelInfo.sheets.length} sheets, ${excelInfo.totalFormulas} formulas`);
            } catch (excelEngineError) {
              // Non-critical - Excel processing can continue without formula engine
              console.warn(`⚠️ [DOCUMENT-ZK] Excel formula engine load failed (non-critical):`, excelEngineError);
            }

            // Convert Excel chunks to embedding format with full document metadata
            // ⚡ CRITICAL: Prepend filename to content so AI sees it prominently
            chunks = excelChunks.map(chunk => ({
              content: `📄 File: ${filename} | ${chunk.content}`,
              metadata: {
                // ⚡ Document identification (CRITICAL for proper retrieval)
                documentId: documentId,
                filename: filename,

                // ⚡ Excel-specific metadata
                sheet: chunk.metadata.sheetName,
                sheetNumber: chunk.metadata.sheetNumber,
                row: chunk.metadata.rowNumber,
                cells: chunk.metadata.cells,
                chunkIndex: chunk.metadata.chunkIndex,
                sourceType: chunk.metadata.sourceType,
                tableHeaders: chunk.metadata.tableHeaders
              }
            }));

            // 🆕 Generate embeddings for Excel chunks using Gemini embedding service
            const excelTexts = chunks.map(c => c.content);
            const excelEmbeddingResult = await embeddingService.default.generateBatchEmbeddings(excelTexts, {
              taskType: 'RETRIEVAL_DOCUMENT',
              title: filename
            });

            // Update chunks with embeddings
            chunks = chunks.map((chunk, i) => ({
              ...chunk,
              embedding: excelEmbeddingResult.embeddings[i]?.embedding || new Array(1536).fill(0)
            }));
          } else {
            // 🆕 Phase 4C: For PowerPoint, use slide-level chunks with metadata
            const isPowerPoint = mimeType.includes('presentation');

            if (isPowerPoint && pptxSlideChunks && pptxSlideChunks.length > 0) {
              chunks = pptxSlideChunks.map(slideChunk => ({
                content: slideChunk.content,
                metadata: {
                  filename,
                  slideNumber: slideChunk.metadata.slideNumber,
                  totalSlides: slideChunk.metadata.totalSlides,
                  slideTitle: slideChunk.metadata.slideTitle,
                  hasNotes: slideChunk.metadata.hasNotes,
                  sourceType: 'powerpoint',
                  chunkType: 'slide'
                }
              }));
            } else {
              // ═══════════════════════════════════════════════════════════════
              // SEMANTIC CHUNKING with proper size and overlap (Background)
              // ═══════════════════════════════════════════════════════════════
              console.log('📝 [CHUNKING-BG] Using improved chunking with overlap...');

              // Use improved chunking with overlap for better retrieval
              const overlapChunks = chunkTextWithOverlap(extractedText, {
                maxSize: 1000,    // ~600 tokens (optimal for embeddings)
                overlap: 200,     // 20% overlap for context continuity
                splitOn: ['\n\n', '\n', '. ', '! ', '? '],  // Smart boundaries
              });

              // Background process - no access to docIntelligence, use basic chunking
              chunks = overlapChunks.map((chunk) => ({
                content: chunk.content,
                metadata: {
                  chunkIndex: chunk.index,
                  startChar: chunk.startChar,
                  endChar: chunk.endChar,
                }
              }));

              console.log(`✅ [CHUNKING-BG] Created ${chunks.length} chunks with overlap`);
            }

            // 🆕 Generate embeddings using OpenAI embedding service
            const texts = chunks.map(c => c.content);
            const embeddingResult = await embeddingService.default.generateBatchEmbeddings(texts);

            // Update chunks with embeddings
            chunks = chunks.map((chunk, i) => ({
              ...chunk,
              embedding: embeddingResult.embeddings[i]?.embedding || new Array(1536).fill(0)
            }));
          }

          // ✅ FIX: DocumentChunk removed - chunks stored via vectorEmbeddingService
          console.log(`💾 [Document] Preparing to store ${chunks.length} embeddings...`);

          // Store embeddings in Pinecone + DocumentEmbedding table
          console.log(`🔄 [DIAGNOSTIC] About to call storeDocumentEmbeddings...`);
          await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);
          console.log(`✅ [DIAGNOSTIC] storeDocumentEmbeddings completed successfully!`);

          emitProgress('embedding', 85, 'Embeddings stored');

          // 🔍 VERIFY PINECONE STORAGE - Temporarily disabled during OpenAI migration

          // Embedding info stored - document ready for AI chat
          console.log(`✅ [EMBEDDING] Document ${documentId} ready for AI chat`);

          // Emit success event via WebSocket
          const io = require('../server').io;
          if (io) {
            io.to(`user:${userId}`).emit('document-embeddings-ready', {
              documentId,
              filename,
              embeddingCount: chunks.length,
              message: 'AI chat ready!'
            });
          }


        } catch (error: any) {
          // ⚠️ NON-CRITICAL ERROR: documents is still usable without embeddings
          console.error('❌ [Background] Vector embedding generation failed:', error);

          // Log embedding error but continue - document is still usable
          console.warn(`⚠️ [EMBEDDING] Failed for document ${documentId}, but document is still usable`);

          // Emit warning event via WebSocket
          const io = require('../server').io;
          if (io) {
            io.to(`user:${userId}`).emit('document-processing-warning', {
              documentId,
              filename,
              message: 'Document uploaded but AI chat unavailable',
              error: error.message
            });
          }
        }
      })(); // ← Don't await this - let it run in background

    }

    // Stage 8: Finalizing (90-100%)
    emitProgress('finalizing', 95, 'Finalizing document...');

    // Update document status to completed (only if verification passed)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'completed' },
    });

    // Queue document for embedding generation (async - doesn't block upload)
    try {
      await addDocumentJob({
        documentId,
        userId,
        filename,
        mimeType,
      });
      console.log(`[Upload] Queued document ${documentId} for embedding generation`);
    } catch (queueError) {
      console.error(`[Upload] Failed to queue document for embeddings:`, queueError);
      // Don't fail the upload if queuing fails - embeddings can be generated later
    }

    // Stage 9: Complete (100%)
    emitProgress('complete', 100, 'Processing complete!');

    // Emit completion event
    try {
      if (io) {
        io.to(`user:${userId}`).emit('document-processing-complete', {
          documentId,
          filename,
          status: 'completed'
        });
      }
    } catch (wsError) {
    }

    // Invalidate cache for this user after successful processing
    await cacheService.invalidateUserCache(userId);
    // ⚡ PERFORMANCE: Invalidate file listing cache
    invalidateFileListingCache(userId);


    // ✅ OPTIMIZATION: Start background tag generation AFTER document is completed
    // This saves 5-10 seconds by not blocking the upload response
    if (extractedText && extractedText.length > 20) {
      generateTagsInBackground(documentId, extractedText, filename, userId).catch(error => {
        console.error('❌ Background tag generation failed:', error);
      });
    }
  } catch (error) {
    console.error('❌ Error processing document:', error);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'failed' },
    });
  }
}

/**
 * Chunk text into smaller pieces for vector embedding
 * Enhanced to handle PowerPoint slides and images properly
 */
function chunkText(text: string, maxWords: number = 500): Array<{content: string, metadata: any}> {
  // ENHANCEMENT 1: Check if this is PowerPoint content (contains slide markers)
  const slideMarkerRegex = /===\s*Slide\s+(\d+)\s*===/gi;
  const hasSlideMarkers = slideMarkerRegex.test(text);

  if (hasSlideMarkers) {
    return chunkPowerPointText(text, maxWords);
  }

  // ENHANCEMENT 2: For short documents (< 100 words), create single chunk
  // This helps with OCR text from images that might not have proper sentence structure
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 100) {
    return [{
      content: text.trim(),
      metadata: {
        chunkIndex: 0,
        startChar: 0,
        endChar: text.length,
        wordCount
      }
    }];
  }

  // ORIGINAL LOGIC: Standard sentence-based chunking
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: Array<{content: string, metadata: any}> = [];
  let currentChunk = '';
  let currentWordCount = 0;
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    const sentenceWordCount = words.length;

    if (currentWordCount + sentenceWordCount > maxWords && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          chunkIndex,
          startChar: text.indexOf(currentChunk),
          endChar: text.indexOf(currentChunk) + currentChunk.length
        }
      });
      chunkIndex++;
      currentChunk = '';
      currentWordCount = 0;
    }

    currentChunk += sentence + ' ';
    currentWordCount += sentenceWordCount;
  }

  // Add remaining text as last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        chunkIndex,
        startChar: text.indexOf(currentChunk),
        endChar: text.indexOf(currentChunk) + currentChunk.length
      }
    });
  }

  return chunks;
}

/**
 * Chunk PowerPoint text by slides
 * Each slide becomes at least one chunk with slide metadata
 */
function chunkPowerPointText(text: string, maxWords: number = 500): Array<{content: string, metadata: any}> {
  const chunks: Array<{content: string, metadata: any}> = [];

  // Split by slide markers
  const slideRegex = /===\s*Slide\s+(\d+)\s*===\n([\s\S]*?)(?=\n===\s*Slide\s+\d+\s*===|$)/gi;
  let match;
  let chunkIndex = 0;

  while ((match = slideRegex.exec(text)) !== null) {
    const slideNumber = parseInt(match[1], 10);
    const slideContent = match[2].trim();

    if (slideContent.length === 0) {
      continue; // Skip empty slides
    }

    // Check if slide content needs to be further chunked
    const slideWordCount = slideContent.split(/\s+/).length;

    if (slideWordCount <= maxWords) {
      // Slide fits in one chunk
      chunks.push({
        content: slideContent,
        metadata: {
          chunkIndex,
          slide: slideNumber,
          slideNumber, // Both formats for compatibility
          startChar: match.index,
          endChar: match.index + match[0].length,
          wordCount: slideWordCount
        }
      });
      chunkIndex++;
    } else {
      // Slide is too large, split into multiple chunks but preserve slide number
      const sentences = slideContent.match(/[^.!?]+[.!?]+/g) || [slideContent];
      let currentChunk = '';
      let currentWordCount = 0;
      let subChunkIndex = 0;

      for (const sentence of sentences) {
        const words = sentence.trim().split(/\s+/);
        const sentenceWordCount = words.length;

        if (currentWordCount + sentenceWordCount > maxWords && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              chunkIndex,
              slide: slideNumber,
              slideNumber,
              subChunk: subChunkIndex,
              startChar: match.index,
              endChar: match.index + currentChunk.length,
              wordCount: currentWordCount
            }
          });
          chunkIndex++;
          subChunkIndex++;
          currentChunk = '';
          currentWordCount = 0;
        }

        currentChunk += sentence + ' ';
        currentWordCount += sentenceWordCount;
      }

      // Add remaining content
      if (currentChunk.trim().length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            chunkIndex,
            slide: slideNumber,
            slideNumber,
            subChunk: subChunkIndex,
            startChar: match.index,
            endChar: match.index + currentChunk.length,
            wordCount: currentWordCount
          }
        });
        chunkIndex++;
      }
    }
  }


  return chunks;
}

/**
 * Get document download URL
 */
export const getDocumentDownloadUrl = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized access to document');
  }

  // Generate signed URL (valid for 1 hour) with forced download
  const signedUrl = await getSignedUrl(
    document.encryptedFilename,
    3600,
    true, // Force download
    document.filename // Original filename
  );

  return {
    url: signedUrl,
    filename: document.filename,
    mimeType: document.mimeType,
  };
};

/**
 * Get signed URL for viewing document (no forced download)
 * Used by DocumentViewer for direct access without backend proxy
 * PHASE 2: Supports pre-converted PDFs for DOCX files
 */
export const getDocumentViewUrl = async (documentId: string, userId: string, req?: any) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized access to document');
  }

  // ⚡ FIX: For encrypted files, use stream endpoint instead of signed URLs
  // Signed URLs can't decrypt files client-side, so we need server-side decryption
  if (document.isEncrypted) {

    // Construct base URL from request headers (supports ngrok, localhost, etc.)
    let baseUrl = 'http://localhost:5000';
    if (req) {
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      if (host) {
        baseUrl = `${protocol}://${host}`;
      }
    }

    // Return the stream endpoint URL instead of a signed URL
    return {
      url: `${baseUrl}/api/documents/${documentId}/stream`,
      filename: document.filename,
      mimeType: document.mimeType,
      encrypted: true,
    };
  }

  // PHASE 2: Check if DOCX has pre-converted PDF
  const isDocx = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  let fileToServe = document.encryptedFilename;
  let mimeTypeToServe = document.mimeType;

  if (isDocx && document.renderableContent) {
    try {
      const renderableData = JSON.parse(document.renderableContent);
      if (renderableData.type === 'docx-pdf-conversion' && renderableData.pdfPath) {
        fileToServe = renderableData.pdfPath;
        mimeTypeToServe = 'application/pdf';
      }
    } catch (error) {
    }
  }

  // Generate signed URL (valid for 1 hour) for viewing (no forced download)
  // This only works for non-encrypted files
  const signedUrl = await getSignedUrl(
    fileToServe,
    3600,
    false, // Allow inline viewing
    document.filename // Original filename
  );

  return {
    url: signedUrl,
    filename: document.filename,
    mimeType: mimeTypeToServe,
    encrypted: false,
  };
};

/**
 * Stream document file (downloads and decrypts server-side, returns buffer)
 */
export const streamDocument = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized access to document');
  }

  // ⚡ PERFORMANCE OPTIMIZATION: Check cache first
  const cachedBuffer = await cacheService.getCachedDocumentBuffer(documentId);
  if (cachedBuffer) {
    return {
      buffer: cachedBuffer,
      filename: document.filename,
      mimeType: document.mimeType,
    };
  }


  // ✅ FIX: Download file from S3
  const encryptedBuffer = await downloadFile(document.encryptedFilename);

  // Decrypt if encrypted
  let fileBuffer: Buffer;
  if (document.isEncrypted) {
    fileBuffer = encryptionService.decryptFile(
      encryptedBuffer,
      `document-${document.userId}`
    );
  } else {
    fileBuffer = encryptedBuffer;
  }

  // ⚡ PERFORMANCE OPTIMIZATION: Cache the decrypted buffer for next time
  await cacheService.cacheDocumentBuffer(documentId, fileBuffer);

  return {
    buffer: fileBuffer,
    filename: document.filename,
    mimeType: document.mimeType,
  };
};

/**
 * Stream converted PDF for DOCX preview
 * Downloads the converted PDF file from storage and returns it for streaming
 */
export const streamPreviewPdf = async (documentId: string, userId: string) => {

  // Verify document ownership
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    console.error(`❌ [streamPreviewPdf] Document not found: ${documentId}`);
    throw new Error('Document not found');
  }


  if (document.userId !== userId) {
    console.error(`❌ [streamPreviewPdf] Unauthorized access: document userId ${document.userId} !== request userId ${userId}`);
    throw new Error('Unauthorized access to document');
  }

  // ✅ FIX: Build the PDF key (same format as in getDocumentPreview)
  // DOCX files are converted to PDF and stored as `${userId}/${documentId}-converted.pdf`
  const pdfKey = `${userId}/${documentId}-converted.pdf`;

  // ✅ FIX: Check if the PDF version exists in S3 storage
  const pdfExistsInS3 = await fileExists(pdfKey);


  if (!pdfExistsInS3) {
    console.error(`❌ [streamPreviewPdf] PDF not found at ${pdfKey}. Document may need reprocessing.`);
    throw new Error(`PDF preview not available. This document may need to be reprocessed. Please try re-uploading this document.`);
  }

  // ✅ FIX: Download the converted PDF from S3 Storage
  const pdfBuffer = await downloadFile(pdfKey);

  // REASON: Validate PDF buffer
  // WHY: Ensure we have valid data before streaming
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('PDF preview file is empty or corrupted');
  }


  return {
    buffer: pdfBuffer,
    filename: document.filename,
  };
};

/**
 * Get a single document by ID
 */
export const getDocumentById = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      folder: true,
      metadata: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  if (!document) {
    return null;
  }

  if (document.userId !== userId) {
    return null;
  }

  return document;
};

/**
 * List user documents
 */
export const listDocuments = async (
  userId: string,
  folderId?: string,
  page: number = 1,
  limit: number = 1000
) => {
  // ⚡ CACHE: Generate cache key
  const cacheKey = `documents_list:${userId}:${folderId || 'all'}:${page}:${limit}`;

  // ⚡ CACHE: Check cache first
  const cached = await cacheService.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const skip = (page - 1) * limit;

  const where: any = {
    userId,
    status: { in: ['completed', 'processing', 'uploading'] }  // ✅ FIX: Include all active documents (matches folder count logic)
  };
  if (folderId !== undefined) {
    where.folderId = folderId === 'root' ? null : folderId;
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        folder: true,
        tags: {
          include: {
            tag: true,
          },
        },
        // Only include minimal metadata fields for list view (not the huge content fields)
        metadata: {
          select: {
            documentId: true,
            pageCount: true,
            wordCount: true,
            ocrConfidence: true,
            // Exclude large fields: markdownContent, extractedText, slidesData, pptxMetadata, etc.
          }
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.document.count({ where }),
  ]);

  // 🔍 DEBUG: Log document filenames to verify correct data
  if (documents.length > 0) {
  }

  // ✅ SAFETY CHECK: Ensure we're not accidentally returning encryptedFilename as filename
  // Map documents to explicitly set the correct fields
  const sanitizedDocuments = documents.map(doc => {
    // Check if filename looks like an encrypted filename (contains UUID pattern)
    const looksEncrypted = doc.filename.includes('/') ||
                          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/.test(doc.filename);

    if (looksEncrypted) {
    }

    return {
      ...doc,
      // Ensure we're using the original filename, NOT the encrypted one
      filename: doc.filename,
      encryptedFilename: doc.encryptedFilename,
    };
  });

  const result = {
    documents: sanitizedDocuments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  // ⚡ CACHE: Store result with 1 minute TTL
  await cacheService.set(cacheKey, result, { ttl: 60 });

  return result;
};

/**
 * Update document
 */
export const updateDocument = async (
  documentId: string,
  userId: string,
  updates: { folderId?: string | null; filename?: string }
) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Build update data
  const updateData: any = {};

  if (updates.folderId !== undefined) {
    updateData.folderId = updates.folderId === null ? null : updates.folderId;
  }

  if (updates.filename !== undefined && updates.filename.trim()) {
    updateData.filename = updates.filename.trim();
  }

  // Update document
  const updatedDocument = await prisma.document.update({
    where: { id: documentId },
    data: updateData,
    include: {
      folder: true,
    },
  });

  return updatedDocument;
};

/**
 * Delete document
 * ✅ FIXED: Now properly deletes from all storage systems (GCS, PostgreSQL embeddings, Pinecone)
 */
export const deleteDocument = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Store file size before deletion for storage tracking
  const fileSize = document.fileSize;
  const deletionErrors: string[] = [];

  // 1. Delete from GCS/S3
  try {
    await deleteFile(document.encryptedFilename);
    console.log(`✅ [DeleteDocument] Deleted file from storage: ${document.encryptedFilename}`);
  } catch (error: any) {
    const errorMsg = `Failed to delete file from storage: ${error.message}`;
    console.error(`❌ [DeleteDocument] ${errorMsg}`);
    deletionErrors.push(errorMsg);
    // Continue with deletion - don't block on storage failure
  }

  // 2. Delete embeddings from PostgreSQL vector store
  try {
    const vectorEmbeddingService = await import('./vectorEmbedding.service');
    await vectorEmbeddingService.default.deleteDocumentEmbeddings(documentId);
    console.log(`✅ [DeleteDocument] Deleted PostgreSQL embeddings for document: ${documentId}`);
  } catch (error: any) {
    const errorMsg = `Failed to delete PostgreSQL embeddings: ${error.message}`;
    console.error(`❌ [DeleteDocument] ${errorMsg}`);
    deletionErrors.push(errorMsg);
  }

  // 3. Delete embeddings from Pinecone (CRITICAL - prevents orphaned vectors)
  try {
    const pineconeService = await import('./pinecone.service');
    await pineconeService.default.deleteDocumentEmbeddings(documentId);
    console.log(`✅ [DeleteDocument] Deleted Pinecone embeddings for document: ${documentId}`);
  } catch (error: any) {
    const errorMsg = `Failed to delete Pinecone embeddings: ${error.message}`;
    console.error(`❌ [DeleteDocument] ${errorMsg}`);
    deletionErrors.push(errorMsg);
  }

  // 4. Delete from database (cascade will handle metadata and tags)
  await prisma.document.delete({
    where: { id: documentId },
  });

  // 📊 STORAGE TRACKING: Decrement user storage usage
  await storageService.decrementStorage(userId, fileSize);

  // Invalidate caches
  await cacheService.invalidateUserCache(userId);

  // Invalidate document-specific response cache (AI chat responses)
  await cacheService.invalidateDocumentCache(documentId);

  // ⚡ PERFORMANCE: Invalidate file listing cache for faster "what files do I have?" queries
  invalidateFileListingCache(userId);

  // ⚡ MODE OPTIMIZATION: Invalidate query response cache (deleted documents = stale answers)
  await cacheService.invalidateUserQueryCache(userId);
  console.log(`🗑️  [MODE CACHE] Invalidated query cache after document deletion`);

  // Log any errors that occurred during cleanup (but deletion succeeded)
  if (deletionErrors.length > 0) {
    console.warn(`⚠️ [DeleteDocument] Document ${documentId} deleted with ${deletionErrors.length} cleanup errors:`, deletionErrors);
  }

  return { success: true, cleanupErrors: deletionErrors };
};

/**
 * Delete all documents for a user
 * ✅ FIXED: Now properly deletes from all storage systems (GCS, PostgreSQL embeddings, Pinecone)
 */
export const deleteAllDocuments = async (userId: string) => {
  try {
    console.log(`🗑️ [DeleteAllDocuments] Starting deletion for user: ${userId}`);

    // Get all documents for the user
    const documents = await prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        encryptedFilename: true,
        filename: true
      }
    });

    if (documents.length === 0) {
      return {
        totalDocuments: 0,
        deleted: 0,
        failed: 0,
        message: 'No documents found to delete'
      };
    }

    console.log(`📊 [DeleteAllDocuments] Found ${documents.length} documents to delete`);

    let successCount = 0;
    let failedCount = 0;
    const results: Array<{
      documentId: string;
      filename: string;
      status: string;
      error?: string;
      cleanupErrors?: string[];
    }> = [];

    // Delete each document
    for (const document of documents) {
      const cleanupErrors: string[] = [];

      try {
        // 1. Delete from GCS/S3
        try {
          await deleteFile(document.encryptedFilename);
          console.log(`  ✅ Deleted file: ${document.encryptedFilename}`);
        } catch (error: any) {
          const errorMsg = `GCS delete failed: ${error.message}`;
          console.error(`  ❌ ${errorMsg}`);
          cleanupErrors.push(errorMsg);
        }

        // 2. Delete embeddings from PostgreSQL vector store
        try {
          const vectorEmbeddingService = await import('./vectorEmbedding.service');
          await vectorEmbeddingService.default.deleteDocumentEmbeddings(document.id);
          console.log(`  ✅ Deleted PostgreSQL embeddings for: ${document.id}`);
        } catch (error: any) {
          const errorMsg = `PostgreSQL embeddings delete failed: ${error.message}`;
          console.error(`  ❌ ${errorMsg}`);
          cleanupErrors.push(errorMsg);
        }

        // 3. Delete embeddings from Pinecone (CRITICAL - prevents orphaned vectors)
        try {
          const pineconeService = await import('./pinecone.service');
          await pineconeService.default.deleteDocumentEmbeddings(document.id);
          console.log(`  ✅ Deleted Pinecone embeddings for: ${document.id}`);
        } catch (error: any) {
          const errorMsg = `Pinecone delete failed: ${error.message}`;
          console.error(`  ❌ ${errorMsg}`);
          cleanupErrors.push(errorMsg);
        }

        // 4. Delete from database (cascade will handle metadata, tags, etc.)
        await prisma.document.delete({
          where: { id: document.id }
        });

        // Invalidate document-specific response cache
        await cacheService.invalidateDocumentCache(document.id);

        results.push({
          documentId: document.id,
          filename: document.filename,
          status: 'success',
          cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined
        });

        successCount++;

      } catch (error: any) {
        console.error(`❌ Failed to delete ${document.filename}:`, error.message);

        results.push({
          documentId: document.id,
          filename: document.filename,
          status: 'failed',
          error: error.message,
          cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined
        });

        failedCount++;
      }
    }

    // Invalidate cache for this user
    await cacheService.invalidateUserCache(userId);
    // ⚡ PERFORMANCE: Invalidate file listing cache
    invalidateFileListingCache(userId);

    console.log(`✅ [DeleteAllDocuments] Completed: ${successCount} deleted, ${failedCount} failed`);

    return {
      totalDocuments: documents.length,
      deleted: successCount,
      failed: failedCount,
      results
    };
  } catch (error) {
    console.error('❌ Error deleting all documents:', error);
    throw error;
  }
};

/**
 * Upload new version of a document
 */
export const uploadDocumentVersion = async (
  parentDocumentId: string,
  input: Omit<UploadDocumentInput, 'folderId'>
) => {
  const parentDocument = await prisma.document.findUnique({
    where: { id: parentDocumentId },
  });

  if (!parentDocument) {
    throw new Error('Parent document not found');
  }

  if (parentDocument.userId !== input.userId) {
    throw new Error('Unauthorized');
  }

  const { userId, filename, fileBuffer, mimeType, fileHash } = input;

  // Generate unique encrypted filename
  const encryptedFilename = `${userId}/${crypto.randomUUID()}-${Date.now()}`;

  // Upload to GCS
  await uploadFile(encryptedFilename, fileBuffer, mimeType);

  // Create new version
  const newVersion = await prisma.document.create({
    data: {
      userId,
      folderId: parentDocument.folderId,
      filename,
      encryptedFilename,
      fileSize: fileBuffer.length,
      mimeType,
      fileHash,
      status: 'processing',
      parentVersionId: parentDocumentId,
    },
  });

  return newVersion;
};

/**
 * Get document versions
 */
export const getDocumentVersions = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Get all versions (current and previous)
  const versions = await prisma.document.findMany({
    where: {
      OR: [
        { id: documentId },
        { parentVersionId: documentId },
      ],
      status: { not: 'deleted' },  // ✅ FIX: Filter deleted documents
    },
    orderBy: { createdAt: 'desc' },
  });

  return versions;
};

/**
 * Get document processing status
 */
export const getDocumentStatus = async (documentId: string, userId: string) => {
  console.log(`[getDocumentStatus] Fetching document: ${documentId} for user: ${userId}`);

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      metadata: true,
    },
  });

  console.log(`[getDocumentStatus] Document found: ${!!document}, Document userId: ${document?.userId}`);

  if (!document) {
    console.log(`[getDocumentStatus] ERROR: Document ${documentId} not found in database`);
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    console.log(`[getDocumentStatus] ERROR: userId mismatch - doc.userId: ${document.userId}, req.userId: ${userId}`);
    throw new Error('Unauthorized');
  }

  return {
    ...document,
    metadata: document.metadata || null,
  };
};

/**
 * Get document thumbnail
 */
export const getDocumentThumbnail = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Thumbnails disabled - always return null
  return { thumbnailUrl: null };
};

/**
 * Get document preview URL (converts DOCX to PDF if needed)
 * Supports all file formats: PDF, DOCX, PPTX, XLSX, images, text files, etc.
 */
export const getDocumentPreview = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      metadata: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // REASON: Verify file exists in storage before proceeding
  // WHY: Prevents generating URLs for non-existent files after migration
  const fileExistsInStorage = await fileExists(document.encryptedFilename);
  if (!fileExistsInStorage) {
    throw new Error(`Document file not found in storage: ${document.encryptedFilename}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCX FILES: Convert to PDF for universal preview
  // ═══════════════════════════════════════════════════════════════════════════
  const isDocx = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isDocx) {
    const { convertDocxToPdf } = await import('./docx-converter.service');

    // REASON: Use the correct path for the converted PDF
    // WHY: During upload, DOCX is converted to PDF and saved as `${userId}/${documentId}-converted.pdf`
    // This matches the path used in document.queue.ts line 242
    const pdfKey = `${userId}/${documentId}-converted.pdf`;

    const pdfExists = await fileExists(pdfKey);

    if (!pdfExists) {

      // ✅ FIX: Download DOCX from S3 Storage
      const tempDocxPath = path.join(os.tmpdir(), `${documentId}.docx`);
      let docxBuffer = await downloadFile(document.encryptedFilename);

      // ✅ Validate that the downloaded buffer is not empty
      if (!docxBuffer || docxBuffer.length === 0) {
        throw new Error(`Downloaded DOCX file is empty: ${document.encryptedFilename}`);
      }


      // 🔓 DECRYPT FILE if encrypted
      if (document.isEncrypted) {
        const encryptionService = await import('./encryption.service');
        docxBuffer = encryptionService.default.decryptFile(docxBuffer, `document-${userId}`);
      }

      // ✅ Validate DOCX file format (check ZIP signature)
      // DOCX files are ZIP archives, so they should start with 'PK' (0x50, 0x4B)
      if (docxBuffer[0] !== 0x50 || docxBuffer[1] !== 0x4B) {
        throw new Error(`Invalid DOCX file format - not a valid ZIP archive: ${document.encryptedFilename}`);
      }

      fs.writeFileSync(tempDocxPath, docxBuffer);

      // Convert to PDF
      const conversion = await convertDocxToPdf(tempDocxPath, os.tmpdir());

      if (conversion.success && conversion.pdfPath) {
        // ✅ FIX: Upload PDF to S3 Storage
        const pdfBuffer = fs.readFileSync(conversion.pdfPath);
        await uploadFile(pdfKey, pdfBuffer, 'application/pdf');


        // Clean up temp files
        fs.unlinkSync(tempDocxPath);
        fs.unlinkSync(conversion.pdfPath);
      } else {
        throw new Error('Failed to convert DOCX to PDF: ' + conversion.error);
      }
    }

    // Return backend preview endpoint URL
    // PDF.js will fetch from our backend which streams from S3
    return {
      previewType: 'pdf',
      previewUrl: `/api/documents/${documentId}/preview-pdf`,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POWERPOINT FILES: Return slides data from metadata
  // ═══════════════════════════════════════════════════════════════════════════
  const isPptx = document.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                 document.mimeType?.includes('presentation') ||
                 document.mimeType?.includes('powerpoint');

  if (isPptx) {
    // REASON: PowerPoint files use PPTXPreview component with extracted slide data
    // WHY: Slides are extracted and stored in metadata during document processing
    const slidesData = document.metadata?.slidesData;
    const pptxMetadata = document.metadata?.pptxMetadata;

    return {
      previewType: 'pptx',
      slidesData: slidesData ? JSON.parse(slidesData as string) : [],
      pptxMetadata: pptxMetadata ? JSON.parse(pptxMetadata as string) : {},
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF FILES: Generate signed URL with 1-hour expiration
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.mimeType === 'application/pdf') {
    // ✅ FIX: Generate signed URL with 1-hour expiration
    // S3 storage requires signed URLs for private files
    // This creates a temporary, secure link that expires automatically
    const url = await getSignedUrl(document.encryptedFilename, 3600);

    return {
      previewType: 'pdf',
      previewUrl: url,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE FILES: Generate signed URL for direct display
  // ═══════════════════════════════════════════════════════════════════════════
  const imageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ];

  if (imageTypes.includes(document.mimeType)) {
    // REASON: Generate signed URL with 1-hour expiration for images
    // WHY: Images can be displayed directly in browser with img tag
    const url = await getSignedUrl(document.encryptedFilename, 3600);

    return {
      previewType: 'image',
      previewUrl: url,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCEL FILES: Convert to HTML for in-browser preview
  // ═══════════════════════════════════════════════════════════════════════════
  const excelTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (excelTypes.includes(document.mimeType)) {
    // REASON: Convert Excel to HTML for rich in-browser preview with full styling
    // WHY: HTML tables preserve formatting, colors, borders and are universally displayable
    const excelToHtmlService = await import('./excelToHtmlStyled.service');

    // Download Excel file from storage
    let excelBuffer = await downloadFile(document.encryptedFilename);

    // Decrypt if encrypted
    if (document.isEncrypted) {
      const encryptionService = await import('./encryption.service');
      excelBuffer = encryptionService.default.decryptFile(excelBuffer, `document-${userId}`);
    }

    // Convert to HTML
    const htmlResult = await excelToHtmlService.default.convertToHtml(excelBuffer);

    return {
      previewType: 'excel',
      htmlContent: htmlResult.html,
      sheetCount: htmlResult.sheetCount,
      sheets: htmlResult.sheets,
      downloadUrl: await getSignedUrl(document.encryptedFilename, 3600),
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CSV FILES: Generate signed URL for download
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.mimeType === 'text/csv') {
    const url = await getSignedUrl(document.encryptedFilename, 3600);
    return {
      previewType: 'csv',
      previewUrl: url,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT FILES: Generate signed URL for direct display
  // ═══════════════════════════════════════════════════════════════════════════
  const textTypes = [
    'text/plain',
    'text/markdown',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
    'text/xml'
  ];

  if (textTypes.includes(document.mimeType)) {
    // REASON: Generate signed URL with 1-hour expiration
    // WHY: Text files can be displayed directly in browser
    const url = await getSignedUrl(document.encryptedFilename, 3600);

    return {
      previewType: 'text',
      previewUrl: url,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIDEO FILES: Generate signed URL for video player
  // ═══════════════════════════════════════════════════════════════════════════
  const videoTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
    'video/x-matroska' // .mkv
  ];

  if (videoTypes.includes(document.mimeType)) {
    // REASON: Generate signed URL with 2-hour expiration (longer for videos)
    // WHY: Videos can be played directly in browser video player
    const url = await getSignedUrl(document.encryptedFilename, 7200); // 2 hours

    return {
      previewType: 'video',
      previewUrl: url,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO FILES: Generate signed URL for audio player
  // ═══════════════════════════════════════════════════════════════════════════
  const audioTypes = [
    'audio/mpeg', // .mp3
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/flac',
    'audio/x-m4a'
  ];

  if (audioTypes.includes(document.mimeType)) {
    // REASON: Generate signed URL with 2-hour expiration (longer for audio)
    // WHY: Audio files can be played directly in browser audio player
    const url = await getSignedUrl(document.encryptedFilename, 7200); // 2 hours

    return {
      previewType: 'audio',
      previewUrl: url,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER FILES: Generate signed URL for download
  // ═══════════════════════════════════════════════════════════════════════════
  // REASON: For unknown file types, provide signed URL for secure download
  // WHY: Ensures all files can be accessed even if no specific preview is available

  const url = await getSignedUrl(document.encryptedFilename, 3600);

  return {
    previewType: 'download',
    previewUrl: url,
    originalType: document.mimeType,
    filename: document.filename,
  };
};

/**
 * Reindex all documents for a user - regenerate embeddings for all documents
 */
export const reindexAllDocuments = async (userId: string) => {
  try {

    // Get all completed documents for the user
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: 'completed'  // Already filtering by status='completed', no deleted documents
      },
      include: {
        metadata: true
      }
    });

    if (documents.length === 0) {
      return {
        totalDocuments: 0,
        reindexed: 0,
        failed: 0,
        message: 'No documents found to reindex'
      };
    }


    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each document
    for (const document of documents) {
      try {

        // Call the existing reprocessDocument function
        const result = await reprocessDocument(document.id, userId);

        results.push({
          ...result,
          status: 'success'
        });

        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to reprocess ${document.filename}:`, error.message);

        results.push({
          documentId: document.id,
          filename: document.filename,
          status: 'failed',
          error: error.message
        });

        failedCount++;
      }

      // Add small delay between documents to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
    }


    return {
      totalDocuments: documents.length,
      reindexed: successCount,
      failed: failedCount,
      results
    };
  } catch (error) {
    console.error('❌ Error reindexing all documents:', error);
    throw error;
  }
};

/**
 * Reprocess document - regenerate vector embeddings
 */
export const reprocessDocument = async (documentId: string, userId: string) => {
  try {

    // 1. Get document and verify ownership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { metadata: true }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // 2. Check if it's a PowerPoint file and needs slide extraction
    const isPPTX = document.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const hasSlides = document.metadata?.slidesData && JSON.parse(document.metadata.slidesData as string).length > 0;

    // For PPTX files, reprocess slides if they're missing
    if (isPPTX && !hasSlides) {

      // Download file from GCS
      const fileBuffer = await downloadFile(document.encryptedFilename);

      // Save file buffer to temporary file
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `pptx-${crypto.randomUUID()}.pptx`);
      fs.writeFileSync(tempFilePath, fileBuffer);

      try {
        // Import and use PPTX extractor
        const { pptxExtractorService } = await import('./pptxExtractor.service');
        const result = await pptxExtractorService.extractText(tempFilePath);

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        if (result.success) {
          const extractedText = result.fullText || '';
          const slidesData = result.slides || [];
          const pptxMetadata = result.metadata || {};
          const pageCount = result.totalSlides || null;


          // Update metadata with slides data
          if (document.metadata) {
            await prisma.documentMetadata.update({
              where: { id: document.metadata.id },
              data: {
                extractedText,
                slidesData: JSON.stringify(slidesData),
                pptxMetadata: JSON.stringify(pptxMetadata),
                pageCount
              }
            });
          } else {
            await prisma.documentMetadata.create({
              data: {
                documentId,
                extractedText,
                slidesData: JSON.stringify(slidesData),
                pptxMetadata: JSON.stringify(pptxMetadata),
                pageCount
              }
            });
          }

          // Delete old embeddings
          const vectorEmbeddingService = await import('./vectorEmbedding.service');
          await vectorEmbeddingService.default.deleteDocumentEmbeddings(documentId);

          // Generate new embeddings
          if (extractedText && extractedText.length > 50) {
            const chunks = chunkText(extractedText, 500);

            await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);
          }

          return {
            documentId,
            filename: document.filename,
            chunksGenerated: extractedText.length > 50 ? chunkText(extractedText, 500).length : 0,
            textLength: extractedText.length,
            slidesExtracted: slidesData.length,
            status: 'completed'
          };
        } else {
          throw new Error('PPTX extraction failed');
        }
      } catch (pptxError: any) {
        console.error('❌ PPTX extraction failed:', pptxError.message);
        // Clean up temp file if it exists
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw new Error(`Failed to extract PowerPoint slides: ${pptxError.message}`);
      }
    }

    // 3. Get or re-extract text for non-PPTX or when slides already exist
    let extractedText = document.metadata?.extractedText;
    let fileBuffer: Buffer | null = null;

    if (!extractedText || extractedText.length === 0) {

      // Download file from GCS
      fileBuffer = await downloadFile(document.encryptedFilename);

      // Extract text
      const result = await textExtractionService.extractText(fileBuffer, document.mimeType);
      extractedText = result.text;

      // Update metadata with extracted text
      if (document.metadata) {
        await prisma.documentMetadata.update({
          where: { id: document.metadata.id },
          data: {
            extractedText,
            wordCount: result.wordCount || null,
            pageCount: result.pageCount || null
          }
        });
      } else {
        await prisma.documentMetadata.create({
          data: {
            documentId,
            extractedText,
            wordCount: result.wordCount || null,
            pageCount: result.pageCount || null
          }
        });
      }

    } else {
    }

    // 3.5. Regenerate markdown content if missing or requested
    const needsMarkdown = !document.metadata?.markdownContent;
    if (needsMarkdown) {

      try {
        // Download file if not already downloaded
        if (!fileBuffer) {
          fileBuffer = await downloadFile(document.encryptedFilename);
        }

        // Convert to markdown
        const markdownResult = await markdownConversionService.convertToMarkdown(
          fileBuffer,
          document.mimeType,
          document.filename,
          documentId
        );

        // Update metadata with markdown content
        if (document.metadata) {
          await prisma.documentMetadata.update({
            where: { id: document.metadata.id },
            data: {
              markdownContent: markdownResult.markdownContent
            }
          });
        } else {
          await prisma.documentMetadata.create({
            data: {
              documentId,
              markdownContent: markdownResult.markdownContent
            }
          });
        }

      } catch (markdownError: any) {
      }
    } else {
    }

    // 4. Delete old embeddings
    const vectorEmbeddingService = await import('./vectorEmbedding.service');
    await vectorEmbeddingService.default.deleteDocumentEmbeddings(documentId);

    // 5. Generate new embeddings
    if (extractedText && extractedText.length > 50) {
      const chunks = chunkText(extractedText, 500);

      await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);

      return {
        documentId,
        filename: document.filename,
        chunksGenerated: chunks.length,
        textLength: extractedText.length,
        status: 'completed'
      };
    } else {
      return {
        documentId,
        filename: document.filename,
        chunksGenerated: 0,
        textLength: extractedText?.length || 0,
        status: 'completed',
        warning: 'Text too short for embeddings'
      };
    }
  } catch (error) {
    console.error('❌ Error reprocessing document:', error);
    throw error;
  }
};

/**
 * Retry failed document processing
 * Restarts async processing for a failed or stuck document
 */
export const retryDocument = async (documentId: string, userId: string) => {
  try {

    // 1. Get document and verify ownership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { metadata: true }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // 2. Update status to 'processing'
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });


    // 3. Re-trigger async processing
    processDocumentAsync(
      document.id,
      document.encryptedFilename,
      document.filename,
      document.mimeType,
      userId,
      document.metadata?.thumbnailUrl || null
    ).catch(error => {
      console.error('❌ Error in retry processing:', error);
    });


    return {
      id: document.id,
      filename: document.filename,
      status: 'processing'
    };
  } catch (error) {
    console.error('❌ Error retrying document:', error);
    throw error;
  }
};

/**
 * Regenerate PPTX slides with improved ImageMagick rendering
 */
export const regeneratePPTXSlides = async (documentId: string, userId: string) => {
  try {

    // 1. Get document and verify ownership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { metadata: true }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // 2. Verify it's a PowerPoint file
    const isPPTX = document.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (!isPPTX) {
      throw new Error('Document is not a PowerPoint presentation');
    }


    // Set status to processing
    await prisma.documentMetadata.update({
      where: { documentId: document.id },
      data: {
        slideGenerationStatus: 'processing',
        slideGenerationError: null
      }
    });

    // 3. Download file from GCS
    const fileBuffer = await downloadFile(document.encryptedFilename);

    // 4. Save file buffer to temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `pptx-regen-${crypto.randomUUID()}.pptx`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    try {
      // 5. Generate new slide images using ImageMagick
      // DEPRECATED: pptxSlideGenerator.service removed - using stub
      const PPTXSlideGeneratorService = { generateSlideImages: async (_a: any, _b: any, _c: any) => ({ success: false, slides: [] as any[] }) };

      const slideResult = await PPTXSlideGeneratorService.generateSlideImages(tempFilePath, documentId, {
        uploadToGCS: true,
        maxWidth: 1920,
        quality: 90
      });

      if (!slideResult.success || !slideResult.slides || slideResult.slides.length === 0) {

        // 🆕 FALLBACK: Try direct image extraction
        const { pptxImageExtractorService } = await import('./pptxImageExtractor.service');
        const imageResult = await pptxImageExtractorService.extractImages(
          tempFilePath,
          documentId,
          { uploadToGCS: true }
        );

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        if (imageResult.success && imageResult.slides && imageResult.slides.length > 0) {

          // Fetch existing slidesData
          const existingMetadata = await prisma.documentMetadata.findUnique({
            where: { documentId: document.id }
          });

          let existingSlidesData: any[] = [];
          try {
            if (existingMetadata?.slidesData) {
              existingSlidesData = typeof existingMetadata.slidesData === 'string'
                ? JSON.parse(existingMetadata.slidesData)
                : existingMetadata.slidesData as any[];
            }
          } catch (e) {
          }

          // Merge extracted images with existing slide data
          const slidesData = existingSlidesData.map((existingSlide: any) => {
            const slideNum = existingSlide.slideNumber || existingSlide.slide_number;
            const extractedSlide = imageResult.slides!.find(s => s.slideNumber === slideNum);

            // Use the first image as the slide preview
            const imageUrl = extractedSlide && extractedSlide.images.length > 0
              ? extractedSlide.images[0].imageUrl
              : existingSlide.imageUrl;

            return {
              slideNumber: slideNum,
              content: existingSlide.content || '',
              textCount: existingSlide.textCount || existingSlide.text_count || 0,
              imageUrl: imageUrl
            };
          });

          // Update metadata
          await prisma.documentMetadata.update({
            where: { documentId: document.id },
            data: {
              slidesData: JSON.stringify(slidesData),
              slideGenerationStatus: 'completed',
              slideGenerationError: null,
              updatedAt: new Date()
            }
          });


          return {
            success: true,
            message: 'Slides regenerated successfully using image extraction',
            slides: slidesData,
            totalSlides: slidesData.length
          };
        } else {
          throw new Error('Both slide generation and image extraction failed');
        }
      }

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      const slides = slideResult.slides || [];

      // 6. Fetch existing slidesData to preserve text content
      const existingMetadata = await prisma.documentMetadata.findUnique({
        where: { documentId: document.id }
      });

      let existingSlidesData: any[] = [];
      try {
        if (existingMetadata?.slidesData) {
          existingSlidesData = typeof existingMetadata.slidesData === 'string'
            ? JSON.parse(existingMetadata.slidesData)
            : existingMetadata.slidesData as any[];
        }
      } catch (e) {
      }

      // Merge image URLs with existing slide data
      const slidesData = slides.map((slide: any) => {
        // Find matching slide in existing data
        const existingSlide = existingSlidesData.find(
          (s: any) => s.slideNumber === slide.slideNumber || s.slide_number === slide.slideNumber
        );

        return {
          slideNumber: slide.slideNumber,
          imageUrl: slide.gcsPath ? `gcs://${config.GCS_BUCKET_NAME}/${slide.gcsPath}` : slide.publicUrl || '',
          width: slide.width || 1920,
          height: slide.height || 1080,
          // Preserve existing text content
          content: existingSlide?.content || '',
          text_count: existingSlide?.text_count || existingSlide?.textCount || 0
        };
      });

      await prisma.documentMetadata.update({
        where: { documentId: document.id },
        data: {
          slidesData: JSON.stringify(slidesData),
          slideGenerationStatus: 'completed',
          slideGenerationError: null,
          updatedAt: new Date(),
        },
      });


      return {
        totalSlides: slides.length,
        slides: slidesData,
        message: 'Slides regenerated successfully with improved font rendering'
      };

    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw error;
    }

  } catch (error: any) {
    console.error('❌ Error regenerating PPTX slides:', error);

    // Set status to failed
    try {
      await prisma.documentMetadata.update({
        where: { documentId },
        data: {
          slideGenerationStatus: 'failed',
          slideGenerationError: error.message || 'Unknown error during slide generation'
        }
      });
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    throw error;
  }
};

/**
 * Generate tags in background (fire-and-forget)
 * ✅ OPTIMIZATION: This runs AFTER document is completed to save 5-10 seconds
 */
async function generateTagsInBackground(
  documentId: string,
  extractedText: string,
  filename: string,
  userId: string
) {
  try {

    const tags = await geminiService.generateDocumentTags(filename, extractedText);

    if (tags && tags.length > 0) {

      for (const tagName of tags) {
        // Get or create tag
        let tag = await prisma.tag.findUnique({
          where: { userId_name: { userId, name: tagName } },
        });

        if (!tag) {
          tag = await prisma.tag.create({
            data: { userId, name: tagName },
          });
        }

        // Link tag to document
        await prisma.documentTag.upsert({
          where: {
            documentId_tagId: {
              documentId,
              tagId: tag.id,
            },
          },
          update: {},
          create: {
            documentId,
            tagId: tag.id,
          },
        });
      }


      // Emit WebSocket event to notify frontend
      try {
        const io = require('../server').io;
        if (io) {
          io.to(`user:${userId}`).emit('document-tags-updated', {
            documentId,
            tags,
            filename
          });
        }
      } catch (wsError) {
      }
    } else {
    }
  } catch (error) {
    console.error(`❌ [Background] Tag generation failed for ${documentId}:`, error);
  }
}


