import crypto from 'crypto';
import prisma from '../config/database';
import { uploadFile, downloadFile, getSignedUrl, deleteFile, bucket, fileExists } from '../config/storage';
import { config } from '../config/env';
import * as textExtractionService from './textExtraction.service';
import * as geminiService from './gemini.service';
import * as folderService from './folder.service';
import * as thumbnailService from './thumbnail.service';
import markdownConversionService from './markdownConversion.service';
import cacheService from './cache.service';
import encryptionService from './encryption.service';
import pptxProcessorService from './pptxProcessor.service';
import nerService from './ner.service';
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
  thumbnailBuffer?: Buffer; // Optional thumbnail
  relativePath?: string; // For nested folder uploads
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
 * Upload an encrypted document
 */
export const uploadDocument = async (input: UploadDocumentInput) => {
  const { userId, filename, fileBuffer, mimeType, folderId, fileHash, thumbnailBuffer, relativePath } = input;

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`📤 UPLOADING DOCUMENT: ${filename}`);
  console.log(`👤 User: ${userId}`);
  console.log(`🔐 Hash: ${fileHash}`);
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

  // 🔒 ENCRYPT FILE BEFORE UPLOAD (AES-256-GCM)
  console.log(`🔒 Encrypting file: ${filename} (${fileBuffer.length} bytes)`);
  const encryptionService = await import('./encryption.service');
  const encryptedFileBuffer = encryptionService.default.encryptFile(fileBuffer, `document-${userId}`);

  // Extract IV and auth tag from encrypted buffer (stored as IV + AuthTag + EncryptedData)
  const encryptionIV = encryptedFileBuffer.slice(0, 16).toString('base64'); // First 16 bytes
  const encryptionAuthTag = encryptedFileBuffer.slice(16, 32).toString('base64'); // Next 16 bytes
  console.log(`✅ File encrypted successfully (${encryptedFileBuffer.length} bytes)`);

  // Upload encrypted file to GCS
  await uploadFile(encryptedFilename, encryptedFileBuffer, mimeType);

  // Upload thumbnail if provided, otherwise generate one
  let thumbnailUrl: string | null = null;
  if (thumbnailBuffer) {
    const thumbnailFilename = `${userId}/thumbnails/${crypto.randomUUID()}-${Date.now()}.jpg`;
    await uploadFile(thumbnailFilename, thumbnailBuffer, 'image/jpeg');
    // Get public URL for thumbnail
    thumbnailUrl = await getSignedUrl(thumbnailFilename);
    console.log('✅ Thumbnail uploaded:', thumbnailFilename);
  } else {
    // Generate thumbnail on server if not provided
    console.log('🖼️ Generating thumbnail on server...');
    try {
      // Save file to temp location for thumbnail generation
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `upload-${crypto.randomUUID()}`);
      fs.writeFileSync(tempFilePath, fileBuffer);

      // Generate thumbnail
      const thumbnailPath = await thumbnailService.generateThumbnail(tempFilePath, mimeType);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      if (thumbnailPath) {
        thumbnailUrl = thumbnailPath; // Store GCS path
        console.log('✅ Thumbnail generated:', thumbnailPath);
      }
    } catch (error) {
      console.warn('⚠️ Thumbnail generation failed (non-critical):', error);
    }
  }

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
      status: 'processing',
      isEncrypted: true,
      encryptionIV,
      encryptionAuthTag,
    },
    include: {
      folder: true,
    },
  });

  // ⚡ SYNCHRONOUS PROCESSING - Wait for all steps to complete
  console.log('🔄 Processing document synchronously...');

  try {
    await processDocumentInBackground(document.id, fileBuffer, filename, mimeType, userId, thumbnailUrl);

    // Fetch updated document with all relationships
    const completedDocument = await prisma.document.findUnique({
      where: { id: document.id },
      include: { folder: true },
    });

    console.log(`✅ Document processing complete: ${filename}`);
    return completedDocument!;
  } catch (error: any) {
    console.error('❌ Document processing failed:', error.message);

    // Mark document as failed
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'failed' },
    });

    throw new Error(`Document processing failed: ${error.message}`);
  }
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
          slidesData = result.slides || [];
          pptxMetadata = result.metadata || {};
          pageCount = result.totalSlides || null;
          console.log(`✅ PPTX extracted: ${slidesData?.length || 0} slides, ${extractedText.length} characters`);

          // 🆕 Phase 4C: Process PowerPoint into slide-level chunks
          console.log('📊 Processing PowerPoint into slide-level chunks...');
          const pptxProcessResult = await pptxProcessorService.processFile(tempFilePath);
          if (pptxProcessResult.success) {
            pptxSlideChunks = pptxProcessResult.chunks;
            console.log(`✅ Created ${pptxSlideChunks.length} slide-level chunks`);
          } else {
            console.warn(`⚠️ PowerPoint processor failed: ${pptxProcessResult.error}`);
          }

          // 🚀 OPTIMIZATION: Generate slide images in background (non-blocking)
          console.log('📊 Starting slide image generation in background...');
          (async () => {
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

              if (slideResult.success && slideResult.slides) {
                // Update metadata with image URLs
                await prisma.document_metadata.update({
                  where: { documentId },
                  data: {
                    slidesData: JSON.stringify(slideResult.slides.map(slide => ({
                      slideNumber: slide.slideNumber,
                      imageUrl: slide.publicUrl,
                      width: slide.width,
                      height: slide.height
                    })))
                  }
                });
                console.log(`✅ [Background] Generated ${slideResult.totalSlides} slide images for ${filename}`);
              } else {
                console.warn(`⚠️ [Background] Slide image generation failed for ${filename}:`, slideResult.error);
              }
            } catch (slideError: any) {
              console.warn(`⚠️ [Background] Slide image generation error for ${filename}:`, slideError.message);
            }
          })().catch(err => console.error('Background slide generation error:', err));
        } else {
          throw new Error('PPTX extraction failed');
        }

        // Clean up temp file
        fs.unlinkSync(tempFilePath);
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

    // PRE-GENERATE PDF FOR DOCX FILES (so viewing is instant)
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (isDocx) {
      console.log('📄 Pre-generating PDF preview for DOCX...');
      try {
        const { convertDocxToPdf } = await import('./docx-converter.service');
        const { Storage } = await import('@google-cloud/storage');

        const storage = new Storage({
          keyFilename: process.env.GCS_KEY_FILE,
          projectId: process.env.GCS_PROJECT_ID,
        });

        // Get the encrypted filename from the document
        const doc = await prisma.document.findUnique({
          where: { id: documentId },
          select: { encryptedFilename: true }
        });

        if (!doc) {
          throw new Error('Document not found');
        }

        const pdfKey = `${doc.encryptedFilename}.pdf`;
        const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);
        const pdfFile = bucket.file(pdfKey);

        // Check if PDF already exists
        const [pdfExists] = await pdfFile.exists();

        if (!pdfExists) {
          // Save DOCX to temp file
          const tempDocxPath = path.join(os.tmpdir(), `${documentId}.docx`);
          fs.writeFileSync(tempDocxPath, fileBuffer);

          // Convert to PDF
          const conversion = await convertDocxToPdf(tempDocxPath, os.tmpdir());

          if (conversion.success && conversion.pdfPath) {
            // Upload PDF to GCS
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

    // 🔍 VERIFY PINECONE STORAGE - Critical step!
    console.log('🔍 Step 7: Verifying Pinecone storage...');
    const pineconeService = await import('./pinecone.service');
    const verification = await pineconeService.default.verifyDocument(documentId);

    if (!verification.success) {
      throw new Error(`Pinecone verification failed: ${verification.error || 'No vectors found'}`);
    }

    console.log(`✅ Verification passed: Found ${verification.vectorCount} vectors in Pinecone`);

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
          slidesData = result.slides || [];
          pptxMetadata = result.metadata || {};
          pageCount = result.totalSlides || null;
          console.log(`✅ PPTX extracted: ${slidesData?.length || 0} slides, ${extractedText.length} characters`);

          // 🆕 Phase 4C: Process PowerPoint into slide-level chunks
          console.log('📊 Processing PowerPoint into slide-level chunks...');
          const pptxProcessResult = await pptxProcessorService.processFile(tempFilePath);
          if (pptxProcessResult.success) {
            pptxSlideChunks = pptxProcessResult.chunks;
            console.log(`✅ Created ${pptxSlideChunks.length} slide-level chunks`);
          } else {
            console.warn(`⚠️ PowerPoint processor failed: ${pptxProcessResult.error}`);
          }

          // 🚀 OPTIMIZATION: Generate slide images in background (non-blocking)
          console.log('📊 Starting slide image generation in background...');
          (async () => {
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

              if (slideResult.success && slideResult.slides) {
                // Update metadata with image URLs
                await prisma.document_metadata.update({
                  where: { documentId },
                  data: {
                    slidesData: JSON.stringify(slideResult.slides.map(slide => ({
                      slideNumber: slide.slideNumber,
                      imageUrl: slide.publicUrl,
                      width: slide.width,
                      height: slide.height
                    })))
                  }
                });
                console.log(`✅ [Background] Generated ${slideResult.totalSlides} slide images for ${filename}`);
              } else {
                console.warn(`⚠️ [Background] Slide image generation failed for ${filename}:`, slideResult.error);
              }
            } catch (slideError: any) {
              console.warn(`⚠️ [Background] Slide image generation error for ${filename}:`, slideError.message);
            }
          })().catch(err => console.error('Background slide generation error:', err));
        } else {
          throw new Error('PPTX extraction failed');
        }

        // Clean up temp file
        fs.unlinkSync(tempFilePath);
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
        const { convertDocxToPdf } = await import('./docx-converter.service');
        const { Storage } = await import('@google-cloud/storage');

        const storage = new Storage({
          keyFilename: process.env.GCS_KEY_FILE,
          projectId: process.env.GCS_PROJECT_ID,
        });

        const pdfKey = `${encryptedFilename}.pdf`;
        const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);
        const pdfFile = bucket.file(pdfKey);

        // Check if PDF already exists
        const [pdfExists] = await pdfFile.exists();

        if (!pdfExists) {
          // Save DOCX to temp file
          const tempDocxPath = path.join(os.tmpdir(), `${documentId}.docx`);
          fs.writeFileSync(tempDocxPath, fileBuffer);

          // Convert to PDF
          const conversion = await convertDocxToPdf(tempDocxPath, os.tmpdir());

          if (conversion.success && conversion.pdfPath) {
            // Upload PDF to GCS
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

  // Download file from GCS
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

  return {
    buffer: fileBuffer,
    filename: document.filename,
    mimeType: document.mimeType,
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
        metadata: true,
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

  return {
    documents: sanitizedDocuments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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
    documentId: document.id,
    filename: document.filename,
    status: document.status,
    uploadedAt: document.createdAt,
    metadata: document.metadata
      ? {
          hasExtractedText: !!document.metadata.extractedText,
          textLength: document.metadata.extractedText?.length || 0,
          ocrConfidence: document.metadata.ocrConfidence,
          hasThumbnail: !!document.metadata.thumbnailUrl,
          classification: document.metadata.classification,
          entities: document.metadata.entities
            ? JSON.parse(document.metadata.entities)
            : {},
        }
      : null,
  };
};

/**
 * Get document thumbnail
 */
export const getDocumentThumbnail = async (documentId: string, userId: string) => {
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

  if (!document.metadata?.thumbnailUrl) {
    return { thumbnailUrl: null };
  }

  // Get signed URL for the thumbnail
  const thumbnailUrl = await thumbnailService.getThumbnailUrl(document.metadata.thumbnailUrl);

  return { thumbnailUrl };
};

/**
 * Get document preview URL (converts DOCX to PDF if needed)
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

  // If it's a DOCX file, convert to PDF for preview
  const isDocx = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isDocx) {
    const { convertDocxToPdf } = await import('./docx-converter.service');
    const { Storage } = await import('@google-cloud/storage');

    const storage = new Storage({
      keyFilename: process.env.GCS_KEY_FILE,
      projectId: process.env.GCS_PROJECT_ID,
    });

    // Check if PDF version already exists
    // Note: encryptedFilename might not have an extension, so we append .pdf instead of replacing
    const pdfKey = `${document.encryptedFilename}.pdf`;
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);
    const pdfFile = bucket.file(pdfKey);

    const [pdfExists] = await pdfFile.exists();

    if (!pdfExists) {
      console.log('📄 PDF not found, converting DOCX to PDF...');

      // ✅ First, check if DOCX file exists in GCS
      const docxFile = bucket.file(document.encryptedFilename);
      const [docxExists] = await docxFile.exists();

      if (!docxExists) {
        throw new Error(`Document file not found in storage: ${document.encryptedFilename}`);
      }

      // Download DOCX from GCS
      const tempDocxPath = path.join(os.tmpdir(), `${documentId}.docx`);
      console.log(`⬇️  Downloading DOCX from GCS: ${document.encryptedFilename}`);
      let docxBuffer = await downloadFile(document.encryptedFilename);

      // ✅ Validate that the downloaded buffer is not empty
      if (!docxBuffer || docxBuffer.length === 0) {
        throw new Error(`Downloaded DOCX file is empty: ${document.encryptedFilename}`);
      }

      console.log(`✅ Downloaded ${docxBuffer.length} bytes`);

      // 🔓 DECRYPT FILE if encrypted
      if (document.isEncrypted) {
        console.log('🔓 Decrypting file...');
        const encryptionService = await import('./encryption.service');
        docxBuffer = encryptionService.default.decryptFile(docxBuffer, `document-${userId}`);
        console.log(`✅ File decrypted successfully (${docxBuffer.length} bytes)`);
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
        // Upload PDF to GCS
        const pdfBuffer = fs.readFileSync(conversion.pdfPath);
        await uploadFile(pdfKey, pdfBuffer, 'application/pdf');

        console.log('✅ PDF uploaded to GCS:', pdfKey);

        // Clean up temp files
        fs.unlinkSync(tempDocxPath);
        fs.unlinkSync(conversion.pdfPath);
      } else {
        throw new Error('Failed to convert DOCX to PDF: ' + conversion.error);
      }
    }

    // Generate signed URL for PDF
    const pdfUrl = await getSignedUrl(pdfKey, 3600); // 1 hour expiry

    return {
      previewType: 'pdf',
      previewUrl: pdfUrl,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // For PowerPoint files, return slides data for custom preview
  if (document.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
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

  // For PDF files, return direct URL
  if (document.mimeType === 'application/pdf') {
    // ✅ Check if PDF file exists in GCS before generating signed URL
    const pdfExists = await fileExists(document.encryptedFilename);

    if (!pdfExists) {
      throw new Error(`PDF file not found in storage: ${document.encryptedFilename}`);
    }

    const url = await getSignedUrl(document.encryptedFilename, 3600);

    return {
      previewType: 'pdf',
      previewUrl: url,
      originalType: document.mimeType,
      filename: document.filename,
    };
  }

  // For other files, return stream URL
  return {
    previewType: 'original',
    previewUrl: `/api/documents/${documentId}/stream`,
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

    if (!extractedText || extractedText.length === 0) {
      console.log('📥 No extracted text found, downloading and extracting...');

      // Download file from GCS
      const fileBuffer = await downloadFile(document.encryptedFilename);

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

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      if (!slideResult.success) {
        throw new Error(slideResult.error || 'Failed to generate slides');
      }

      const slides = slideResult.slides || [];
      console.log(`✅ Successfully regenerated ${slides.length} slides`);

      // 6. Update metadata with new slides data
      const slidesData = slides.map((slide) => ({
        slideNumber: slide.slideNumber,
        imageUrl: slide.gcsPath ? `gcs://${config.GCS_BUCKET_NAME}/${slide.gcsPath}` : slide.publicUrl || '',
        width: slide.width || 1920,
        height: slide.height || 1080,
      }));

      await prisma.documentMetadata.update({
        where: { documentId: document.id },
        data: {
          slidesData: JSON.stringify(slidesData),
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

  } catch (error) {
    console.error('❌ Error regenerating PPTX slides:', error);
    throw error;
  }
};
