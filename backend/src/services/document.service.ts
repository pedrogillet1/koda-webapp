// Document Service - handles document upload and processing
import crypto from 'crypto';
import prisma from '../config/database';
import { uploadFile, downloadFile, getSignedUrl, deleteFile, bucket, fileExists } from '../config/storage';
import { config } from '../config/env';
import * as textExtractionService from './textExtraction.service';
import * as geminiService from './gemini.service';
import * as folderService from './folder.service';
import markdownConversionService from './markdownConversion.service';
import cacheService from './cache.service';
import encryptionService from './encryption.service';
import pptxProcessorService from './pptxProcessor.service';
import nerService from './ner.service';
import { convertOfficeToPdf } from './office-converter.service';
import fs from 'fs';
import os from 'os';
import path from 'path';

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
  const { userId, filename, fileBuffer, mimeType, folderId, fileHash, relativePath, encryptionMetadata } = input;

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`📤 UPLOADING DOCUMENT: ${filename}`);
  console.log(`👤 User: ${userId}`);
  console.log(`🔐 Hash: ${fileHash}`);
  if (encryptionMetadata?.isEncrypted) {
    console.log(`🔐 Zero-Knowledge Encryption: YES (client-side encrypted)`);
  }
  console.log(`═══════════════════════════════════════════════════════\n`);

  // If relativePath is provided AND contains folders (has /), create nested folders
  // Skip if it's just a filename without folder structure
  let finalFolderId = folderId;
  if (relativePath && relativePath.includes('/')) {
    finalFolderId = await createFoldersFromPath(userId, relativePath, folderId || null);
  }

  // ⚡ IDEMPOTENCY CHECK: Skip if identical file already uploaded to the SAME folder
  const existingDoc = await prisma.document.findFirst({
    where: {
      userId,
      fileHash,
      status: 'completed',
      // Allow same file in different folders
      folderId: finalFolderId,
    },
  });

  if (existingDoc) {
    console.log(`⚡ IDEMPOTENCY: File already uploaded in this folder (${existingDoc.filename})`);
    console.log(`  Skipping re-processing. Returning existing document.`);

    return await prisma.document.findUnique({
      where: { id: existingDoc.id },
      include: { folder: true },
    });
  }

  console.log('✅ New file detected, proceeding with upload...');

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
    console.log(`🔐 [Zero-Knowledge] File already encrypted on client (${fileBuffer.length} bytes)`);

    encryptedFileBuffer = fileBuffer; // Already encrypted
    encryptionIV = encryptionMetadata.encryptionIV;
    encryptionAuthTag = encryptionMetadata.encryptionAuthTag;
    encryptionSalt = encryptionMetadata.encryptionSalt;
    filenameEncrypted = JSON.stringify(encryptionMetadata.filenameEncrypted);

    // ⚡ TEXT EXTRACTION: Store encrypted text if provided
    if (encryptionMetadata.extractedTextEncrypted) {
      extractedTextEncrypted = JSON.stringify(encryptionMetadata.extractedTextEncrypted);
      console.log(`📄 [Text Extraction] Encrypted text provided (${extractedTextEncrypted.length} chars)`);
    }

    isZeroKnowledge = true;

    console.log(`✅ [Zero-Knowledge] Metadata extracted successfully`);
  } else {
    // 🔒 SERVER-SIDE ENCRYPTION: Encrypt file before upload (AES-256-GCM)
    console.log(`🔒 [Server-Side] Encrypting file: ${filename} (${fileBuffer.length} bytes)`);
    const encryptionService = await import('./encryption.service');
    encryptedFileBuffer = encryptionService.default.encryptFile(fileBuffer, `document-${userId}`);

    // Extract IV and auth tag from encrypted buffer (stored as IV + AuthTag + EncryptedData)
    encryptionIV = encryptedFileBuffer.slice(0, 16).toString('base64'); // First 16 bytes
    encryptionAuthTag = encryptedFileBuffer.slice(16, 32).toString('base64'); // Next 16 bytes
    console.log(`✅ [Server-Side] File encrypted successfully (${encryptedFileBuffer.length} bytes)`);
  }

  // Upload encrypted file to S3 Storage
  console.log(`📤 Uploading to S3: ${encryptedFilename} (${encryptedFileBuffer.length} bytes)`);
  const s3Start = Date.now();
  await uploadFile(encryptedFilename, encryptedFileBuffer, mimeType);
  console.log(`⏱️  S3 upload took: ${Date.now() - s3Start}ms`);
  console.log(`✅ Uploaded to S3: ${encryptedFilename} (${encryptedFileBuffer.length} bytes)`);

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

  // ⚡ ASYNCHRONOUS PROCESSING - Don't wait for all steps to complete
  console.log('🔄 Starting document processing asynchronously...');

  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Use plaintext for embeddings if provided
  if (isZeroKnowledge) {
    console.log('🔐 [Zero-Knowledge] Client-side encrypted file detected');

    // ⚡ TEXT EXTRACTION: Generate embeddings ASYNCHRONOUSLY (don't wait)
    if (plaintextForEmbeddings && plaintextForEmbeddings.length > 0) {
      console.log(`📄 [Text Extraction] Received plaintext for embeddings (${plaintextForEmbeddings.length} characters)`);

      // Generate embeddings in background without blocking the response
      (async () => {
        try {
          await geminiService.generateEmbeddings(document.id, plaintextForEmbeddings);
          console.log('✅ [Embeddings] Generated embeddings from plaintext');
        } catch (error) {
          console.error('❌ [Embeddings] Failed to generate embeddings:', error);
        } finally {
          // ⚠️ IMPORTANT: Delete plaintext from memory after embeddings
          (plaintextForEmbeddings as any) = null;
          console.log('🗑️ [Security] Plaintext deleted from memory');
        }
      })();

      console.log('🚀 [Embeddings] Background generation started (non-blocking)');
    } else {
      console.log('⚠️ [Text Extraction] No plaintext provided, skipping embeddings');
    }

    // Return immediately - document is already marked as 'ready'
    console.log(`✅ Document uploaded successfully (zero-knowledge encrypted): ${filename}`);
    return document; // Return the already-created document
  }

  // Start processing in the background without awaiting (for server-side encrypted files)
  processDocumentInBackground(document.id, fileBuffer, filename, mimeType, userId, thumbnailUrl)
    .then(() => {
      console.log(`✅ Document processing complete: ${filename}`);
    })
    .catch((error: any) => {
      console.error('❌ Document processing failed:', error.message);
    });

  // Return immediately with the document in 'processing' status
  console.log(`✅ Document created, processing in background: ${filename}`);
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
    console.log(`📄 Processing document in background: ${filename}`);

    // Wrap entire processing in a timeout
    await Promise.race([
      processDocumentWithTimeout(documentId, fileBuffer, filename, mimeType, userId, thumbnailUrl),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Processing timeout after ${PROCESSING_TIMEOUT / 1000} seconds`)), PROCESSING_TIMEOUT)
      )
    ]);

  } catch (error: any) {
    console.error('❌ Error processing document:', error);

    // ALWAYS update status to failed, even if database update fails
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'failed',
          updatedAt: new Date() // Ensure timestamp is updated
        },
      });
      console.log(`✅ Status updated to 'failed' for ${filename}`);
    } catch (updateError) {
      console.error('❌ CRITICAL: Failed to update document status:', updateError);
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
    console.log(`🔄 Starting document processing pipeline for: ${filename}`);

    // Extract text based on file type
    let extractedText = '';
    let ocrConfidence: number | null = null;
    let pageCount: number | null = null;
    let wordCount: number | null = null;
    let slidesData: any[] | null = null;
    let pptxMetadata: any | null = null;
    let pptxSlideChunks: any[] | null = null; // For Phase 4C: Slide-level chunks
    let pdfPreviewPath: string | null = null; // For PPTX PDF preview
    let pdfPreviewUrl: string | null = null; // For PPTX PDF preview

    // Check if it's a PowerPoint file - use Python PPTX extractor
    const isPPTX = mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (isPPTX) {
      console.log('📊 Using Python PPTX extractor for PowerPoint...');
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

          console.log(`✅ PPTX extracted: ${slidesData.length} slides, ${extractedText.length} characters`);

          // 🆕 Phase 4C: Process PowerPoint into slide-level chunks
          console.log('📊 Processing PowerPoint into slide-level chunks...');
          const pptxProcessResult = await pptxProcessorService.processFile(tempFilePath);
          if (pptxProcessResult.success) {
            pptxSlideChunks = pptxProcessResult.chunks;
            console.log(`✅ Created ${pptxSlideChunks.length} slide-level chunks`);
          } else {
            console.warn(`⚠️ PowerPoint processor failed: ${pptxProcessResult.error}`);
          }

          // NOTE: PDF preview generation now handled by unified office converter above
          // This ensures consistent PDF generation for both DOCX and PPTX files

          // ✅ FIX: PROACTIVE image extraction approach - Always extract images first
          console.log('📊 Starting PPTX image processing in background...');
          (async () => {
            try {
              // Import prisma in async scope
              const prismaClient = (await import('../config/database')).default;

              console.log(`🖼️  [Background] Starting PPTX image processing for ${filename}...`);

              // ✅ FIX: ALWAYS extract images first (proactive approach)
              console.log('📸 [Step 1/2] Extracting images directly from PPTX...');
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
                console.log(`✅ [Step 1/2] Extracted ${imageResult.totalImages} images from ${imageResult.slides.length} slides`);

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
                  console.warn('Failed to parse existing slidesData');
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

                console.log(`✅ [Step 1/2] Updated metadata with ${imageResult.totalImages} extracted images`);
              } else {
                console.warn(`⚠️ [Step 1/2] Direct image extraction failed:`, imageResult.error);

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
              console.log('🎨 [Step 2/2] Generating full slide renders with LibreOffice (optional)...');
              try {
                const { pptxSlideGeneratorService } = await import('./pptxSlideGenerator.service');
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
                    console.log(`✅ [Step 2/2] Generated ${validSlides.length} full slide renders`);

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
                      console.warn('Failed to parse current slidesData');
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

                    console.log(`✅ [Step 2/2] Enhanced slides with full renders`);
                  } else {
                    console.warn(`⚠️ [Step 2/2] LibreOffice renders had no valid images, keeping extracted images`);
                  }
                } else {
                  console.warn(`⚠️ [Step 2/2] LibreOffice rendering failed, keeping extracted images`);
                }
              } catch (libreOfficeError: any) {
                console.warn(`⚠️ [Step 2/2] LibreOffice rendering error (non-critical):`, libreOfficeError.message);
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
                console.log(`🗑️  [Background] Cleaned up temp file for ${filename}`);
              } catch (cleanupError: any) {
                console.warn(`⚠️  [Background] Failed to clean up temp file:`, cleanupError.message);
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
      console.log('🖼️ Using Gemini Vision for image OCR...');
      extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
      ocrConfidence = 0.95;
    }
    // 📄 Special handling for PDFs - detect scanned PDFs proactively
    else if (mimeType === 'application/pdf') {
      console.log('📄 Processing PDF document...');

      // Save PDF to temporary file for OCR service
      const tempDir = os.tmpdir();
      const tempPdfPath = path.join(tempDir, `pdf-${crypto.randomUUID()}.pdf`);
      fs.writeFileSync(tempPdfPath, fileBuffer);

      try {
        // Import OCR service
        const ocrService = (await import('./ocr.service')).default;

        // Check if PDF is scanned
        const isScanned = await ocrService.isScannedPDF(tempPdfPath);

        if (isScanned && ocrService.isAvailable()) {
          // Scanned PDF - use OCR
          console.log('🔍 Detected scanned PDF - processing with OCR...');
          extractedText = await ocrService.processScannedPDF(tempPdfPath);
          ocrConfidence = 0.90; // High confidence for Google Cloud Vision
          console.log(`✅ OCR complete - extracted ${extractedText.length} characters`);
        } else if (isScanned && !ocrService.isAvailable()) {
          // Scanned PDF but OCR not configured - try fallback
          console.warn('⚠️ Detected scanned PDF but OCR is not configured');
          console.warn('   Set GOOGLE_CLOUD_VISION_KEY_PATH to enable OCR');

          // Try standard extraction (will likely get minimal text)
          const result = await textExtractionService.extractText(fileBuffer, mimeType);
          extractedText = result.text;
          ocrConfidence = result.confidence || null;
          pageCount = result.pageCount || null;
          wordCount = result.wordCount || null;

          if (extractedText.trim().length < 100) {
            throw new Error('Scanned PDF detected but OCR is not configured. Please configure Google Cloud Vision API.');
          }
        } else {
          // Text-based PDF - use standard extraction
          console.log('📝 Text-based PDF - using standard extraction...');
          const result = await textExtractionService.extractText(fileBuffer, mimeType);
          extractedText = result.text;
          ocrConfidence = result.confidence || null;
          pageCount = result.pageCount || null;
          wordCount = result.wordCount || null;
          console.log(`✅ Extracted ${extractedText.length} characters`);
        }

        // Clean up temp file
        fs.unlinkSync(tempPdfPath);

      } catch (pdfError: any) {
        // Clean up temp file on error
        if (fs.existsSync(tempPdfPath)) {
          fs.unlinkSync(tempPdfPath);
        }
        throw pdfError;
      }
    }
    else {
      // Use standard text extraction service for other file types
      console.log('📝 Using text extraction service...');
      try {
        const result = await textExtractionService.extractText(fileBuffer, mimeType);
        extractedText = result.text;
        ocrConfidence = result.confidence || null;
        pageCount = result.pageCount || null;
        wordCount = result.wordCount || null;
      } catch (extractionError: any) {
        console.warn('⚠️ Standard extraction failed');
        console.warn('Error:', extractionError.message);

        // For images, use Gemini Vision fallback
        if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
          console.log('📸 Trying Gemini Vision fallback for image...');
          try {
            extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
            ocrConfidence = 0.85; // Slightly lower confidence for fallback
            console.log('✅ Fallback extraction successful');
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

    console.log(`✅ Text extracted (${extractedText.length} characters)`);

    // CONVERT TO MARKDOWN
    let markdownContent: string | null = null;
    try {
      console.log('📝 Converting document to markdown...');
      const markdownResult = await markdownConversionService.convertToMarkdown(
        fileBuffer,
        mimeType,
        filename,
        documentId
      );
      markdownContent = markdownResult.markdownContent;
      console.log(`✅ Markdown generated (${markdownContent.length} characters)`);
    } catch (error) {
      console.warn('⚠️ Markdown conversion failed (non-critical):', error);
    }

    // PRE-GENERATE PDF FOR DOCX AND PPTX FILES (unified approach for instant viewing)
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isPptxForPdf = mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    if (isDocx || isPptxForPdf) {
      const fileType = isDocx ? 'DOCX' : 'PPTX';
      console.log(`📄 [Preview] Pre-generating PDF preview for ${fileType}...`);
      try {
        // 1. Write original file to a temporary location
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `${documentId}${isDocx ? '.docx' : '.pptx'}`);
        fs.writeFileSync(tempFilePath, fileBuffer);

        // 2. Convert the temporary file to PDF
        const conversion = await convertOfficeToPdf(tempFilePath, tempDir);

        if (conversion.success && conversion.pdfPath) {
          const pdfBuffer = fs.readFileSync(conversion.pdfPath);
          const pdfKey = `${userId}/${documentId}-preview.pdf`;

          // 3. Upload the generated PDF to cloud storage
          await uploadFile(pdfKey, pdfBuffer, 'application/pdf');
          pdfPreviewPath = pdfKey; // Store the path to save in metadata
          console.log(`✅ [Preview] PDF preview uploaded to: ${pdfKey}`);

          // 4. Clean up temporary files
          fs.unlinkSync(tempFilePath);
          fs.unlinkSync(conversion.pdfPath);
        } else {
          console.warn(`⚠️ [Preview] PDF preview generation failed: ${conversion.error}`);
        }
      } catch (error: any) {
        console.warn(`⚠️ [Preview] PDF preview generation failed: ${error.message}`);
      }
    }

    // AUTO-CATEGORIZATION DISABLED: Documents now stay in "Recently Added" by default
    // Users can manually organize documents using the chat interface or drag-and-drop
    console.log('📁 Document will appear in Recently Added (auto-categorization disabled)');

    // Analyze document with OpenAI to get classification and entities
    let classification = null;
    let entities = null;

    if (extractedText && extractedText.length > 0) {
      console.log('🤖 Analyzing document with OpenAI...');
      try {
        const analysis = await geminiService.analyzeDocumentWithGemini(extractedText, mimeType);
        classification = analysis.suggestedCategories?.[0] || null;
        entities = JSON.stringify(analysis.keyEntities || {});
        console.log('✅ Document analyzed');
      } catch (error) {
        console.warn('⚠️ Document analysis failed (non-critical):', error);
      }
    }

    // 🆕 ENHANCED METADATA ENRICHMENT with semantic understanding
    let enrichedMetadata = null;
    if (extractedText && extractedText.length > 100) {
      console.log('🔍 Enriching document metadata with semantic analysis...');
      try {
        const metadataEnrichmentService = await import('./metadataEnrichment.service');
        enrichedMetadata = await metadataEnrichmentService.default.enrichDocument(
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
        if (!classification && enrichedMetadata.topics.length > 0) {
          classification = enrichedMetadata.topics[0];
        }
        if (!entities || entities === '{}') {
          entities = JSON.stringify(enrichedMetadata.entities);
        }

        console.log(`✅ Metadata enriched: ${enrichedMetadata.topics.length} topics, ${enrichedMetadata.keyPoints.length} key points, sentiment: ${enrichedMetadata.sentiment}`);
      } catch (error) {
        console.warn('⚠️ Metadata enrichment failed (non-critical):', error);
      }
    }

    // Create or update metadata record with enriched data
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

    // AUTO-GENERATE TAGS: Generate smart tags for the document
    if (extractedText && extractedText.length > 20) {
      console.log('🏷️ Auto-generating tags...');
      try {
        const tags = await geminiService.generateDocumentTags(filename, extractedText);
        console.log(`✅ Generated ${tags.length} tags: ${tags.join(', ')}`);

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
        console.warn('⚠️ Auto-tag generation failed (non-critical):', error);
      }
    }

    // GENERATE VECTOR EMBEDDINGS FOR RAG WITH SEMANTIC CHUNKING
    if (extractedText && extractedText.length > 50) {
      console.log('🔮 Generating semantic chunks and vector embeddings...');
      try {
        const vectorEmbeddingService = await import('./vectorEmbedding.service');
        const embeddingService = await import('./embedding.service');
        let chunks;

        // Use enhanced Excel processor for Excel files to preserve cell coordinates
        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel') {
          console.log('📊 Using enhanced Excel processor for cell-level metadata...');
          const excelProcessor = await import('./excelProcessor.service');
          const excelChunks = await excelProcessor.default.processExcel(fileBuffer);

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
          console.log(`📦 Created ${chunks.length} Excel chunks with filename "${filename}" in metadata`);

          // 🆕 Generate embeddings for Excel chunks using Gemini embedding service
          console.log('🔮 Generating embeddings for Excel chunks...');
          const excelTexts = chunks.map(c => c.content);
          const excelEmbeddingResult = await embeddingService.default.generateBatchEmbeddings(excelTexts, {
            taskType: 'RETRIEVAL_DOCUMENT',
            title: filename
          });

          // Update chunks with embeddings
          chunks = chunks.map((chunk, i) => ({
            ...chunk,
            embedding: excelEmbeddingResult.embeddings[i].embedding
          }));
          console.log(`✅ Generated ${chunks.length} embeddings for Excel chunks`);
        } else {
          // 🆕 Phase 4C: For PowerPoint, use slide-level chunks with metadata
          const isPowerPoint = mimeType.includes('presentation');

          if (isPowerPoint && pptxSlideChunks && pptxSlideChunks.length > 0) {
            console.log('📝 Using slide-level chunks for PowerPoint (Phase 4C)...');
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
            console.log(`📦 Created ${chunks.length} slide-level chunks from PowerPoint`);
          } else if (markdownContent && markdownContent.length > 100) {
            console.log('📝 Using text chunking for markdown content...');
            chunks = chunkText(markdownContent, 500);
            console.log(`📦 Created ${chunks.length} chunks from markdown`);
          } else {
            // Fallback to standard text chunking if no markdown
            console.log('📝 Using standard text chunking...');
            chunks = chunkText(extractedText, 500);
            console.log(`📦 Split document into ${chunks.length} chunks`);
          }

          // 🆕 Generate embeddings using Gemini embedding service
          console.log('🔮 Generating embeddings with Gemini...');
          const texts = chunks.map(c => c.content);
          const embeddingResult = await embeddingService.default.generateBatchEmbeddings(texts, {
            taskType: 'RETRIEVAL_DOCUMENT',
            title: filename
          });

          // Update chunks with embeddings
          chunks = chunks.map((chunk, i) => ({
            ...chunk,
            embedding: embeddingResult.embeddings[i].embedding
          }));
        }

        // Store embeddings
        await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);
        console.log(`✅ Stored ${chunks.length} vector embeddings`);
      } catch (error: any) {
        // ❌ CRITICAL ERROR: Embedding generation is NOT optional!
        console.error('❌ CRITICAL: Vector embedding generation failed:', error);
        throw new Error(`Embedding generation failed: ${error.message || error}`);
      }
    }

    // 🔍 VERIFY PINECONE STORAGE - Critical step with retry logic for eventual consistency!
    console.log('🔍 Step 7: Verifying Pinecone storage...');
    const pineconeService = await import('./pinecone.service');

    // Pinecone has eventual consistency, so we need to retry with delays
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds between retries
    let verification = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Verification attempt ${attempt}/${maxRetries}...`);
      verification = await pineconeService.default.verifyDocument(documentId);

      if (verification.success) {
        console.log(`✅ Verification passed: Found ${verification.vectorCount} vectors in Pinecone`);
        break;
      }

      if (attempt < maxRetries) {
        console.log(`⏳ Vectors not found yet, waiting ${retryDelay}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!verification || !verification.success) {
      throw new Error(`Pinecone verification failed after ${maxRetries} attempts: ${verification?.error || 'No vectors found'}`);
    }

    // 🔍 PHASE 3 WEEK 9-10: Extract entities and auto-tag document
    console.log('🔍 Step 8: Extracting entities and auto-tagging...');
    try {
      if (extractedText && extractedText.trim().length > 0) {
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

        console.log(`✅ Entity extraction complete: ${nerResult.entities.length} entities, ${nerResult.suggestedTags.length} tags`);
      } else {
        console.log(`⚠️ Skipping NER: No extracted text available`);
      }
    } catch (nerError: any) {
      // NER is not critical - log error but continue
      console.warn(`⚠️ NER extraction failed (non-critical):`, nerError.message);
    }

    // Update document status to completed (only if verification passed)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'completed',
        pdfPreviewPath,
        pdfPreviewUrl,
        updatedAt: new Date()
      },
    });

    // Invalidate cache for this user after successful processing
    await cacheService.invalidateUserCache(userId);
    console.log(`🗑️ Invalidated cache for user ${userId} after document upload`);

    console.log(`✅ Document processing completed: ${filename}`);

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

  console.log(`📝 [createDocumentAfterUpload] Processing upload:`);
  console.log(`   Filename: ${filename}`);
  console.log(`   File hash: ${fileHash}`);
  console.log(`   File size: ${fileSize}`);
  console.log(`   Folder ID: ${folderId || 'null (no folder)'}`);

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
    console.log(`⚡ IDEMPOTENCY: File already uploaded in this folder (${existingDoc.filename})`);
    console.log(`   Existing file: ${existingDoc.filename} (${existingDoc.fileSize} bytes, hash: ${existingDoc.fileHash})`);
    console.log(`   New file: ${filename} (${fileSize} bytes, hash: ${fileHash})`);
    console.log(`   Skipping re-processing. Returning existing document ID: ${existingDoc.id}`);

    return await prisma.document.findUnique({
      where: { id: existingDoc.id },
      include: { folder: true },
    });
  }

  console.log(`✅ New file detected: ${filename}`);

  // Upload thumbnail if provided
  let thumbnailUrl: string | null = null;
  if (thumbnailData) {
    try {
      const thumbnailFilename = `${userId}/thumbnails/${crypto.randomUUID()}-${Date.now()}.jpg`;
      const thumbnailBuffer = Buffer.from(thumbnailData, 'base64');
      await uploadFile(thumbnailFilename, thumbnailBuffer, 'image/jpeg');
      thumbnailUrl = await getSignedUrl(thumbnailFilename);
      console.log('✅ Thumbnail uploaded:', thumbnailFilename);
    } catch (error) {
      console.warn('⚠️ Thumbnail upload failed (non-critical):', error);
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

  // ⚡ FAST ASYNC PROCESSING: Return immediately, process in background
  console.log(`🚀 Starting async processing for: ${filename} (Document ID: ${document.id})`);

  // Process in background with proper error handling
  (async () => {
    try {
      await processDocumentAsync(
        document.id,
        encryptedFilename,
        filename,
        mimeType,
        userId,
        thumbnailUrl
      );
      console.log(`✅ Document processing completed: ${filename}`);
    } catch (error: any) {
      console.error(`❌ Error in async document processing for ${filename}:`, error);

      // Update document status to 'failed' so frontend can show error
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'failed' },
      });

      // Emit WebSocket event to notify frontend of failure
      try {
        const io = require('../server').io;
        if (io) {
          io.to(`user:${userId}`).emit('document-processing-update', {
            documentId: document.id,
            filename: filename,
            status: 'failed',
            stage: 'failed',
            progress: 0,
            error: error.message || 'Processing failed'
          });
        }
      } catch (wsError) {
        console.warn('Failed to emit WebSocket event:', wsError);
      }
    }
  })();

  // Return document immediately with 'processing' status
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
  try {
    console.log(`📄 Processing document: ${filename}`);

    // Get document to check if it's encrypted
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Download file from GCS
    let fileBuffer = await downloadFile(encryptedFilename);

    // 🔓 DECRYPT FILE IF ENCRYPTED
    if (document.isEncrypted && document.encryptionIV && document.encryptionAuthTag) {
      console.log(`🔓 Decrypting file: ${filename}`);
      const encryptionService = await import('./encryption.service');

      // Reconstruct encrypted buffer format: IV + AuthTag + EncryptedData
      const ivBuffer = Buffer.from(document.encryptionIV, 'base64');
      const authTagBuffer = Buffer.from(document.encryptionAuthTag, 'base64');
      const encryptedData = fileBuffer;

      // Create buffer in format expected by decryptFile
      const encryptedBuffer = Buffer.concat([ivBuffer, authTagBuffer, encryptedData]);

      // Decrypt
      fileBuffer = encryptionService.default.decryptFile(encryptedBuffer, `document-${userId}`);
      console.log(`✅ File decrypted successfully (${fileBuffer.length} bytes)`);
    }

    // Extract text based on file type
    let extractedText = '';
    let ocrConfidence: number | null = null;
    let pageCount: number | null = null;
    let wordCount: number | null = null;
    let slidesData: any[] | null = null;
    let pptxMetadata: any | null = null;
    let pptxSlideChunks: any[] | null = null; // For Phase 4C: Slide-level chunks
    let pdfPreviewPath: string | null = null; // For PPTX PDF preview
    let pdfPreviewUrl: string | null = null; // For PPTX PDF preview

    // Check if it's a PowerPoint file - use Python PPTX extractor
    const isPPTX = mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (isPPTX) {
      console.log('📊 Using Python PPTX extractor for PowerPoint...');
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

          console.log(`✅ PPTX extracted: ${slidesData.length} slides, ${extractedText.length} characters`);

          // 🆕 Phase 4C: Process PowerPoint into slide-level chunks
          console.log('📊 Processing PowerPoint into slide-level chunks...');
          const pptxProcessResult = await pptxProcessorService.processFile(tempFilePath);
          if (pptxProcessResult.success) {
            pptxSlideChunks = pptxProcessResult.chunks;
            console.log(`✅ Created ${pptxSlideChunks.length} slide-level chunks`);
          } else {
            console.warn(`⚠️ PowerPoint processor failed: ${pptxProcessResult.error}`);
          }

          // NOTE: PDF preview generation now handled by unified office converter above
          // This ensures consistent PDF generation for both DOCX and PPTX files

          // ✅ FIX: PROACTIVE image extraction approach - Always extract images first
          console.log('📊 Starting PPTX image processing in background...');
          (async () => {
            try {
              // Import prisma in async scope
              const prismaClient = (await import('../config/database')).default;

              console.log(`🖼️  [Background] Starting PPTX image processing for ${filename}...`);

              // ✅ FIX: ALWAYS extract images first (proactive approach)
              console.log('📸 [Step 1/2] Extracting images directly from PPTX...');
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
                console.log(`✅ [Step 1/2] Extracted ${imageResult.totalImages} images from ${imageResult.slides.length} slides`);

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
                  console.warn('Failed to parse existing slidesData');
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

                console.log(`✅ [Step 1/2] Updated metadata with ${imageResult.totalImages} extracted images`);
              } else {
                console.warn(`⚠️ [Step 1/2] Direct image extraction failed:`, imageResult.error);

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
              console.log('🎨 [Step 2/2] Generating full slide renders with LibreOffice (optional)...');
              try {
                const { pptxSlideGeneratorService } = await import('./pptxSlideGenerator.service');
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
                    console.log(`✅ [Step 2/2] Generated ${validSlides.length} full slide renders`);

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
                      console.warn('Failed to parse current slidesData');
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

                    console.log(`✅ [Step 2/2] Enhanced slides with full renders`);
                  } else {
                    console.warn(`⚠️ [Step 2/2] LibreOffice renders had no valid images, keeping extracted images`);
                  }
                } else {
                  console.warn(`⚠️ [Step 2/2] LibreOffice rendering failed, keeping extracted images`);
                }
              } catch (libreOfficeError: any) {
                console.warn(`⚠️ [Step 2/2] LibreOffice rendering error (non-critical):`, libreOfficeError.message);
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
                console.log(`🗑️  [Background] Cleaned up temp file for ${filename}`);
              } catch (cleanupError: any) {
                console.warn(`⚠️  [Background] Failed to clean up temp file:`, cleanupError.message);
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
      console.log('🖼️ Using OpenAI Vision for image OCR...');
      extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
      ocrConfidence = 0.95;
    } else {
      // Use standard text extraction service
      console.log('📝 Using text extraction service...');
      try {
        const result = await textExtractionService.extractText(fileBuffer, mimeType);
        extractedText = result.text;
        ocrConfidence = result.confidence || null;
        pageCount = result.pageCount || null;
        wordCount = result.wordCount || null;
      } catch (extractionError: any) {
        console.warn('⚠️ Standard extraction failed');
        console.warn('Error:', extractionError.message);

        if (mimeType === 'application/pdf') {
          console.log('📸 Trying Google Cloud Vision for scanned PDF...');
          try {
            const visionService = await import('./vision.service');
            const ocrResult = await visionService.extractTextFromScannedPDF(fileBuffer);
            extractedText = ocrResult.text;
            ocrConfidence = ocrResult.confidence || 0.85;
            console.log('✅ Google Cloud Vision extraction successful');
          } catch (visionError) {
            console.error('❌ Google Cloud Vision also failed:', visionError);
            throw new Error(`Failed to extract text from scanned PDF: ${extractionError.message}`);
          }
        } else if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
          console.log('📸 Trying Gemini Vision fallback for image...');
          try {
            extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, mimeType);
            ocrConfidence = 0.85;
            console.log('✅ Fallback extraction successful');
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

    console.log(`✅ Text extracted (${extractedText.length} characters)`);

    // CONVERT TO MARKDOWN
    let markdownContent: string | null = null;
    try {
      console.log('📝 Converting document to markdown...');
      const markdownResult = await markdownConversionService.convertToMarkdown(
        fileBuffer,
        mimeType,
        filename,
        documentId
      );
      markdownContent = markdownResult.markdownContent;
      console.log(`✅ Markdown generated (${markdownContent.length} characters)`);
    } catch (error) {
      console.warn('⚠️ Markdown conversion failed (non-critical):', error);
    }

    // PRE-GENERATE PDF PREVIEW FOR DOCX FILES (so viewing is instant)
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (isDocx) {
      console.log('📄 Pre-generating PDF preview for DOCX...');
      try {
        // REASON: Use the new universal office-converter service with enhanced flags and temp profile
        // WHY: Provides more stable conversions with proper isolation
        const supabaseStorageService = await import('./supabaseStorage.service');

        // REASON: Use the correct PDF path format
        // WHY: DOCX files are converted to PDF and stored as `${userId}/${documentId}-converted.pdf`
        const pdfKey = `${userId}/${documentId}-converted.pdf`;

        // Check if PDF already exists in Supabase
        const pdfExists = await supabaseStorageService.default.exists(pdfKey);

        if (!pdfExists) {
          // Save DOCX to temp file
          const tempDocxPath = path.join(os.tmpdir(), `${documentId}.docx`);
          fs.writeFileSync(tempDocxPath, fileBuffer);

          // Convert to PDF using the new universal converter
          const conversion = await convertOfficeToPdf(tempDocxPath, os.tmpdir());

          if (conversion.success && conversion.pdfPath) {
            // Upload PDF to Supabase
            const pdfBuffer = fs.readFileSync(conversion.pdfPath);
            await uploadFile(pdfKey, pdfBuffer, 'application/pdf');

            console.log('✅ PDF preview pre-generated:', pdfKey);

            // Clean up temp files
            fs.unlinkSync(tempDocxPath);
            fs.unlinkSync(conversion.pdfPath);
          } else {
            console.warn('⚠️ PDF preview generation failed (non-critical):', conversion.error);
          }
        } else {
          console.log('✅ PDF preview already exists');
        }
      } catch (error: any) {
        console.warn('⚠️ PDF preview generation failed (non-critical):', error.message);
      }
    }

    // Analyze document with Gemini
    let classification = null;
    let entities = null;

    if (extractedText && extractedText.length > 0) {
      console.log('🤖 Analyzing document with Gemini...');
      try {
        const analysis = await geminiService.analyzeDocumentWithGemini(extractedText, mimeType);
        classification = analysis.suggestedCategories?.[0] || null;
        entities = JSON.stringify(analysis.keyEntities || {});
        console.log('✅ Document analyzed');
      } catch (error) {
        console.warn('⚠️ Document analysis failed (non-critical):', error);
      }
    }

    // 🆕 ENHANCED METADATA ENRICHMENT with semantic understanding
    let enrichedMetadata = null;
    if (extractedText && extractedText.length > 100) {
      console.log('🔍 Enriching document metadata with semantic analysis...');
      try {
        const metadataEnrichmentService = await import('./metadataEnrichment.service');
        enrichedMetadata = await metadataEnrichmentService.default.enrichDocument(
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
        if (!classification && enrichedMetadata.topics.length > 0) {
          classification = enrichedMetadata.topics[0];
        }
        if (!entities || entities === '{}') {
          entities = JSON.stringify(enrichedMetadata.entities);
        }

        console.log(`✅ Metadata enriched: ${enrichedMetadata.topics.length} topics, ${enrichedMetadata.keyPoints.length} key points, sentiment: ${enrichedMetadata.sentiment}`);
      } catch (error) {
        console.warn('⚠️ Metadata enrichment failed (non-critical):', error);
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

    // AUTO-GENERATE TAGS
    if (extractedText && extractedText.length > 20) {
      console.log('🏷️ Auto-generating tags...');
      try {
        const tags = await geminiService.generateDocumentTags(filename, extractedText);
        console.log(`✅ Generated ${tags.length} tags: ${tags.join(', ')}`);

        for (const tagName of tags) {
          let tag = await prisma.tag.findUnique({
            where: { userId_name: { userId, name: tagName } },
          });

          if (!tag) {
            tag = await prisma.tag.create({
              data: { userId, name: tagName },
            });
          }

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
        console.warn('⚠️ Auto-tag generation failed (non-critical):', error);
      }
    }

    // GENERATE VECTOR EMBEDDINGS FOR RAG WITH SEMANTIC CHUNKING
    if (extractedText && extractedText.length > 50) {
      console.log('🔮 Generating semantic chunks and vector embeddings...');
      try {
        const vectorEmbeddingService = await import('./vectorEmbedding.service');
        const embeddingService = await import('./embedding.service');
        let chunks;

        // Use enhanced Excel processor for Excel files to preserve cell coordinates
        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel') {
          console.log('📊 Using enhanced Excel processor for cell-level metadata...');
          const excelProcessor = await import('./excelProcessor.service');
          const excelChunks = await excelProcessor.default.processExcel(fileBuffer);

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
          console.log(`📦 Created ${chunks.length} Excel chunks with filename "${filename}" in metadata`);

          // 🆕 Generate embeddings for Excel chunks using Gemini embedding service
          console.log('🔮 Generating embeddings for Excel chunks...');
          const excelTexts = chunks.map(c => c.content);
          const excelEmbeddingResult = await embeddingService.default.generateBatchEmbeddings(excelTexts, {
            taskType: 'RETRIEVAL_DOCUMENT',
            title: filename
          });

          // Update chunks with embeddings
          chunks = chunks.map((chunk, i) => ({
            ...chunk,
            embedding: excelEmbeddingResult.embeddings[i].embedding
          }));
          console.log(`✅ Generated ${chunks.length} embeddings for Excel chunks`);
        } else {
          // 🆕 Phase 4C: For PowerPoint, use slide-level chunks with metadata
          const isPowerPoint = mimeType.includes('presentation');

          if (isPowerPoint && pptxSlideChunks && pptxSlideChunks.length > 0) {
            console.log('📝 Using slide-level chunks for PowerPoint (Phase 4C)...');
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
            console.log(`📦 Created ${chunks.length} slide-level chunks from PowerPoint`);
          } else if (markdownContent && markdownContent.length > 100) {
            console.log('📝 Using text chunking for markdown content...');
            chunks = chunkText(markdownContent, 500);
            console.log(`📦 Created ${chunks.length} chunks from markdown`);
          } else {
            // Fallback to standard text chunking if no markdown
            console.log('📝 Using standard text chunking...');
            chunks = chunkText(extractedText, 500);
            console.log(`📦 Split document into ${chunks.length} chunks`);
          }

          // 🆕 Generate embeddings using Gemini embedding service
          console.log('🔮 Generating embeddings with Gemini...');
          const texts = chunks.map(c => c.content);
          const embeddingResult = await embeddingService.default.generateBatchEmbeddings(texts, {
            taskType: 'RETRIEVAL_DOCUMENT',
            title: filename
          });

          // Update chunks with embeddings
          chunks = chunks.map((chunk, i) => ({
            ...chunk,
            embedding: embeddingResult.embeddings[i].embedding
          }));
        }

        // Store embeddings
        await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);
        console.log(`✅ Stored ${chunks.length} vector embeddings`);

        // 🔍 VERIFY PINECONE STORAGE - Critical step!
        console.log('🔍 Verifying Pinecone storage...');
        const pineconeService = await import('./pinecone.service');
        const verification = await pineconeService.default.verifyDocument(documentId);

        if (!verification.success) {
          throw new Error(`Pinecone verification failed: ${verification.error || 'No vectors found'}`);
        }

        console.log(`✅ Verification passed: Found ${verification.vectorCount} vectors in Pinecone`);
      } catch (error: any) {
        // ❌ CRITICAL ERROR: Embedding generation is NOT optional!
        console.error('❌ CRITICAL: Vector embedding generation failed:', error);
        throw new Error(`Embedding generation failed: ${error.message || error}`);
      }
    }

    // Update document status to completed (only if verification passed)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'completed' },
    });

    // Emit WebSocket event to notify frontend of success
    try {
      const io = require('../server').io;
      if (io) {
        io.to(`user:${userId}`).emit('document-processing-update', {
          documentId: documentId,
          filename: filename,
          status: 'completed',
          stage: 'completed',
          progress: 100,
          message: 'Processing completed successfully'
        });
      }
    } catch (wsError) {
      console.warn('Failed to emit WebSocket completion event:', wsError);
    }

    // Invalidate cache for this user after successful processing
    await cacheService.invalidateUserCache(userId);
    console.log(`🗑️ Invalidated cache for user ${userId} after document processing`);

    console.log(`✅ Document processing completed: ${filename}`);
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
    console.log('📊 Detected PowerPoint content - splitting by slides...');
    return chunkPowerPointText(text, maxWords);
  }

  // ENHANCEMENT 2: For short documents (< 100 words), create single chunk
  // This helps with OCR text from images that might not have proper sentence structure
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 100) {
    console.log(`📄 Short document (${wordCount} words) - creating single chunk`);
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

  console.log(`   ✅ Created ${chunks.length} chunks from PowerPoint (${new Set(chunks.map(c => c.metadata.slide)).size} unique slides)`);

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
    console.log(`🔐 [VIEW-URL] Document is encrypted, using stream endpoint for server-side decryption`);

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
        console.log(`⚡ [VIEW-URL] Using pre-converted PDF for DOCX: ${renderableData.pdfPath}`);
        fileToServe = renderableData.pdfPath;
        mimeTypeToServe = 'application/pdf';
      }
    } catch (error) {
      console.warn('⚠️  [VIEW-URL] Could not parse renderableContent, using original DOCX');
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
    console.log(`🚀 [CACHE HIT] Serving document ${documentId} from cache`);
    return {
      buffer: cachedBuffer,
      filename: document.filename,
      mimeType: document.mimeType,
    };
  }

  console.log(`⬇️ [CACHE MISS] Downloading document ${documentId} from Supabase...`);

  // Download file from Supabase
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
 * Downloads the converted PDF file from Supabase and returns it for streaming
 */
export const streamPreviewPdf = async (documentId: string, userId: string) => {
  console.log(`📄 [streamPreviewPdf] Starting for documentId: ${documentId}`);

  // Verify document ownership
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    console.error(`❌ [streamPreviewPdf] Document not found: ${documentId}`);
    throw new Error('Document not found');
  }

  console.log(`📄 [streamPreviewPdf] Document found: ${document.filename}, userId: ${document.userId}`);

  if (document.userId !== userId) {
    console.error(`❌ [streamPreviewPdf] Unauthorized access: document userId ${document.userId} !== request userId ${userId}`);
    throw new Error('Unauthorized access to document');
  }

  // REASON: Build the PDF key (same format as in getDocumentPreview)
  // WHY: DOCX files are converted to PDF and stored as `${userId}/${documentId}-converted.pdf`
  // This matches the path used in document.queue.ts line 242
  const pdfKey = `${userId}/${documentId}-converted.pdf`;
  console.log(`📄 [streamPreviewPdf] Looking for PDF at: ${pdfKey}`);

  // REASON: Check if the PDF version exists in storage
  // WHY: The PDF might not be converted yet
  const supabaseStorageService = await import('./supabaseStorage.service');
  const pdfExists = await supabaseStorageService.default.exists(pdfKey);

  console.log(`📄 [streamPreviewPdf] PDF exists in Supabase: ${pdfExists}`);

  if (!pdfExists) {
    console.error(`❌ [streamPreviewPdf] PDF not found at ${pdfKey}. Document may need reprocessing.`);
    throw new Error(`PDF preview not available. This document was uploaded before the Supabase migration and needs to be re-uploaded or reprocessed. Please delete and re-upload this document.`);
  }

  // REASON: Download the converted PDF from Supabase Storage
  // WHY: We need the file buffer to stream it to the client
  const pdfBuffer = await downloadFile(pdfKey);

  // REASON: Validate PDF buffer
  // WHY: Ensure we have valid data before streaming
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('PDF preview file is empty or corrupted');
  }

  console.log(`✅ Streaming PDF preview for ${document.filename} (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  return {
    buffer: pdfBuffer,
    filename: document.filename,
  };
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
    console.log(`✅ [Cache] HIT for documents list (user: ${userId.substring(0, 8)}...)`);
    return cached;
  }

  const skip = (page - 1) * limit;

  const where: any = {
    userId,
    status: { not: 'deleted' }  // ✅ FIX: Filter deleted documents
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
    console.log('\n📄 [LIST DOCUMENTS] Sample document fields:');
    console.log(`   Document ID: ${documents[0].id}`);
    console.log(`   filename: "${documents[0].filename}"`);
    console.log(`   encryptedFilename: "${documents[0].encryptedFilename}"`);
    console.log(`   mimeType: "${documents[0].mimeType}"`);
  }

  // ✅ SAFETY CHECK: Ensure we're not accidentally returning encryptedFilename as filename
  // Map documents to explicitly set the correct fields
  const sanitizedDocuments = documents.map(doc => {
    // Check if filename looks like an encrypted filename (contains UUID pattern)
    const looksEncrypted = doc.filename.includes('/') ||
                          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/.test(doc.filename);

    if (looksEncrypted) {
      console.warn(`⚠️  [CORRUPT DATA] Document ${doc.id} has encrypted filename in filename field!`);
      console.warn(`   Current filename: "${doc.filename}"`);
      console.warn(`   This should be the original filename, not the storage path!`);
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
  console.log(`💾 [Cache] Stored documents list (user: ${userId.substring(0, 8)}...)`);

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

  // Delete from GCS
  await deleteFile(document.encryptedFilename);

  // Delete embeddings from vector store
  try {
    const vectorEmbeddingService = await import('./vectorEmbedding.service');
    await vectorEmbeddingService.default.deleteDocumentEmbeddings(documentId);
    console.log(`🗑️ Deleted embeddings for document ${documentId}`);
  } catch (error) {
    console.warn('⚠️ Failed to delete embeddings (non-critical):', error);
  }

  // Delete from database (cascade will handle metadata and tags)
  await prisma.document.delete({
    where: { id: documentId },
  });

  // Invalidate caches
  await cacheService.invalidateUserCache(userId);
  console.log(`🗑️ Invalidated user cache for ${userId} after document deletion`);

  // Invalidate document-specific response cache (AI chat responses)
  await cacheService.invalidateDocumentCache(documentId);
  console.log(`🗑️ Invalidated response cache for document ${documentId}`);

  return { success: true };
};

/**
 * Delete all documents for a user
 */
export const deleteAllDocuments = async (userId: string) => {
  try {
    console.log(`🗑️ Starting deletion of all documents for user: ${userId}`);

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

    console.log(`📊 Found ${documents.length} documents to delete`);

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Delete each document
    for (const document of documents) {
      try {
        console.log(`🗑️ Deleting: ${document.filename} (${document.id})`);

        // Delete from GCS
        try {
          await deleteFile(document.encryptedFilename);
          console.log(`✅ Deleted file from GCS: ${document.filename}`);
        } catch (error) {
          console.warn(`⚠️ Failed to delete GCS file (continuing): ${document.filename}`, error);
        }

        // Delete embeddings from vector store
        try {
          const vectorEmbeddingService = await import('./vectorEmbedding.service');
          await vectorEmbeddingService.default.deleteDocumentEmbeddings(document.id);
          console.log(`✅ Deleted embeddings for: ${document.filename}`);
        } catch (error) {
          console.warn(`⚠️ Failed to delete embeddings (continuing): ${document.filename}`, error);
        }

        // Delete from database (cascade will handle metadata, tags, etc.)
        await prisma.document.delete({
          where: { id: document.id }
        });

        // Invalidate document-specific response cache
        await cacheService.invalidateDocumentCache(document.id);

        results.push({
          documentId: document.id,
          filename: document.filename,
          status: 'success'
        });

        successCount++;
        console.log(`✅ Successfully deleted: ${document.filename}`);

      } catch (error: any) {
        console.error(`❌ Failed to delete ${document.filename}:`, error.message);

        results.push({
          documentId: document.id,
          filename: document.filename,
          status: 'failed',
          error: error.message
        });

        failedCount++;
      }
    }

    // Invalidate cache for this user
    await cacheService.invalidateUserCache(userId);
    console.log(`🗑️ Invalidated cache for user ${userId}`);

    console.log(`✅ Deletion complete: ${successCount} succeeded, ${failedCount} failed`);

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
  // OFFICE FILES (DOCX & PPTX): Use pre-generated PDF preview for universal display
  // ═══════════════════════════════════════════════════════════════════════════
  const isOfficeDoc = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' // PPTX
  ].includes(document.mimeType);

  // REASON: For Office documents, use the pre-converted PDF preview when available.
  // WHY: This is the core of the fix. We check if a pdfPreviewPath exists in the metadata or document
  //      and, if so, generate a signed URL for it. This is much faster and more reliable.
  if (isOfficeDoc) {
    const pdfPath = document.pdfPreviewPath || document.metadata?.pdfPreviewPath;

    if (pdfPath) {
      console.log(`📄 Using pre-generated PDF preview: ${pdfPath}`);
      const url = await getSignedUrl(pdfPath, 3600); // 1-hour expiry
      return {
        previewType: 'pdf',
        previewUrl: url,
        originalType: document.mimeType,
        filename: document.filename,
      };
    }

    // REASON: On-demand conversion as fallback for documents without pre-generated PDFs
    // WHY: Ensures backward compatibility with older documents and provides a safety net
    console.log(`📄 [Preview] PDF not found for ${document.filename}. Converting on-demand...`);
    const pdfKey = `${userId}/${documentId}-preview.pdf`;
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, document.filename);

    try {
      // 1. Download the original file
      let fileBuffer = await downloadFile(document.encryptedFilename);

      // 2. Decrypt if necessary
      if (document.isEncrypted) {
        console.log('🔓 Decrypting file...');
        const encryptionService = await import('./encryption.service');
        fileBuffer = encryptionService.default.decryptFile(fileBuffer, `document-${userId}`);
      }

      fs.writeFileSync(tempFilePath, fileBuffer);

      // 3. Convert to PDF using the universal converter
      const conversion = await convertOfficeToPdf(tempFilePath, tempDir);

      if (conversion.success && conversion.pdfPath) {
        // 4. Upload the converted PDF for future use
        const pdfBuffer = fs.readFileSync(conversion.pdfPath);
        await uploadFile(pdfKey, pdfBuffer, 'application/pdf');
        console.log(`✅ [Preview] PDF created and uploaded to ${pdfKey}`);

        // 5. Update document record with the new PDF path
        await prisma.document.update({
          where: { id: documentId },
          data: { pdfPreviewPath: pdfKey }
        });

        // 6. Return signed URL
        const signedUrl = await getSignedUrl(pdfKey, 3600);
        return {
          previewType: 'pdf',
          previewUrl: signedUrl,
          originalType: document.mimeType,
          filename: document.filename,
        };
      } else {
        throw new Error(`Failed to convert to PDF: ${conversion.error}`);
      }
    } catch (conversionError: any) {
      console.error(`❌ [Preview] On-demand conversion failed: ${conversionError.message}`);
      return {
        previewType: 'none',
        previewUrl: null,
        originalType: document.mimeType,
        filename: document.filename,
        message: 'Preview conversion failed. Please try re-uploading this document.',
      };
    } finally {
      // 7. Clean up temporary files
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      const convertedPdfPath = path.join(tempDir, `${path.basename(document.filename, path.extname(document.filename))}.pdf`);
      if (fs.existsSync(convertedPdfPath)) fs.unlinkSync(convertedPdfPath);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF FILES: Generate signed URL with 1-hour expiration
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.mimeType === 'application/pdf') {
    // REASON: Generate signed URL with 1-hour expiration
    // WHY: Supabase storage requires signed URLs for private files
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
  // EXCEL FILES: Generate signed URL for download/preview
  // ═══════════════════════════════════════════════════════════════════════════
  const excelTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];

  if (excelTypes.includes(document.mimeType)) {
    // REASON: Generate signed URL with 1-hour expiration
    // WHY: Excel files can be downloaded and opened in appropriate applications
    const url = await getSignedUrl(document.encryptedFilename, 3600);

    return {
      previewType: 'excel',
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
  console.log(`⚠️  Unknown file type for preview: ${document.mimeType}, generating download URL`);

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
    console.log(`🔄 Starting reindexing for all documents for user: ${userId}`);

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

    console.log(`📊 Found ${documents.length} documents to reindex`);

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each document
    for (const document of documents) {
      try {
        console.log(`🔄 Reprocessing: ${document.filename} (${document.id})`);

        // Call the existing reprocessDocument function
        const result = await reprocessDocument(document.id, userId);

        results.push({
          ...result,
          status: 'success'
        });

        successCount++;
        console.log(`✅ Successfully reprocessed: ${document.filename}`);
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

    console.log(`✅ Reindexing complete: ${successCount} succeeded, ${failedCount} failed`);

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
    console.log(`🔄 Reprocessing document: ${documentId}`);

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
      console.log('📊 PowerPoint file detected without slides data, extracting...');

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

          console.log(`✅ PPTX extracted: ${slidesData.length} slides, ${extractedText.length} characters`);

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
          console.log('🗑️ Deleted old embeddings');

          // Generate new embeddings
          if (extractedText && extractedText.length > 50) {
            const chunks = chunkText(extractedText, 500);
            console.log(`📦 Split document into ${chunks.length} chunks`);

            await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);
            console.log(`✅ Stored ${chunks.length} new vector embeddings`);
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
      console.log('📥 No extracted text found, downloading and extracting...');

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

      console.log(`✅ Text extracted (${extractedText.length} characters)`);
    } else {
      console.log(`✅ Using existing extracted text (${extractedText.length} characters)`);
    }

    // 3.5. Regenerate markdown content if missing or requested
    const needsMarkdown = !document.metadata?.markdownContent;
    if (needsMarkdown) {
      console.log('📝 Markdown content missing, regenerating...');

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

        console.log(`✅ Markdown regenerated (${markdownResult.markdownContent.length} characters)`);
      } catch (markdownError: any) {
        console.warn('⚠️ Markdown regeneration failed (non-critical):', markdownError.message);
      }
    } else {
      console.log('✅ Markdown content already exists');
    }

    // 4. Delete old embeddings
    const vectorEmbeddingService = await import('./vectorEmbedding.service');
    await vectorEmbeddingService.default.deleteDocumentEmbeddings(documentId);
    console.log('🗑️ Deleted old embeddings');

    // 5. Generate new embeddings
    if (extractedText && extractedText.length > 50) {
      const chunks = chunkText(extractedText, 500);
      console.log(`📦 Split document into ${chunks.length} chunks`);

      await vectorEmbeddingService.default.storeDocumentEmbeddings(documentId, chunks);
      console.log(`✅ Stored ${chunks.length} new vector embeddings`);

      return {
        documentId,
        filename: document.filename,
        chunksGenerated: chunks.length,
        textLength: extractedText.length,
        status: 'completed'
      };
    } else {
      console.warn('⚠️ Extracted text too short for embeddings');
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
    console.log(`🔄 Retrying document processing: ${documentId}`);

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

    console.log(`✅ Status updated to 'processing'`);

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

    console.log(`🚀 Async processing restarted`);

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
    console.log(`🔄 Regenerating PPTX slides: ${documentId}`);

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

    console.log('📊 PowerPoint file confirmed, regenerating slides with ImageMagick...');

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
      const { PPTXSlideGeneratorService } = await import('./pptxSlideGenerator.service');
      const slideGenerator = new PPTXSlideGeneratorService();

      const slideResult = await slideGenerator.generateSlideImages(tempFilePath, documentId, {
        uploadToGCS: true,
        maxWidth: 1920,
        quality: 90
      });

      if (!slideResult.success || !slideResult.slides || slideResult.slides.length === 0) {
        console.warn(`⚠️  Slide generation failed, trying direct image extraction...`);

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
          console.log(`✅ [Fallback] Extracted ${imageResult.totalImages} images from ${imageResult.slides.length} slides`);

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
            console.warn('Failed to parse existing slidesData');
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

          console.log(`✅ [Fallback] Updated metadata with extracted images`);

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
      console.log(`✅ Successfully regenerated ${slides.length} slides`);

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
        console.warn('Failed to parse existing slidesData, will create new');
      }

      // Merge image URLs with existing slide data
      const slidesData = slides.map((slide) => {
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

      console.log(`✅ Updated metadata with ${slidesData.length} slides`);

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
