import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env';
import { redisConnection } from '../config/redis';
import { downloadFile } from '../config/storage';
import { extractText } from '../services/textExtraction.service';
import * as imageProcessing from '../services/imageProcessing.service';
import * as visionService from '../services/vision.service';
import markdownConversionService from '../services/markdownConversion.service';
import vectorEmbeddingService from '../services/vectorEmbedding.service';
// import { documentPreProcessor } from '../services/documentPreProcessor.service';
import prisma from '../config/database';

// Import io dynamically to avoid circular dependency
let io: any = null;
const getIO = () => {
  if (!io) {
    try {
      const serverModule = require('../server');
      io = serverModule.io;
    } catch (error) {
      console.warn('Socket.IO not available yet');
    }
  }
  return io;
};

// Emit processing update via WebSocket
const emitProcessingUpdate = (userId: string, documentId: string, data: any) => {
  const socketIO = getIO();
  if (socketIO) {
    socketIO.to(`user:${userId}`).emit('document-processing-update', {
      documentId,
      ...data,
    });
  }
};

/**
 * Chunk text into smaller pieces for vector embedding
 */
function chunkText(text: string, maxWords: number = 500): Array<{content: string, metadata: any}> {
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

// Document processing job data interface
export interface DocumentProcessingJob {
  documentId: string;
  userId: string;
  encryptedFilename: string;
  mimeType: string;
}

let documentQueue: Queue<DocumentProcessingJob> | null = null;
let documentWorker: Worker<DocumentProcessingJob> | null = null;

// Only initialize if Redis is available
if (redisConnection) {
  try {
    // Create document processing queue
    documentQueue = new Queue<DocumentProcessingJob>('document-processing', {
      connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 100,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
      },
    });
  } catch (error) {
    console.warn('⚠️  Could not initialize document queue');
    documentQueue = null;
  }
}

// Add job to queue
export const addDocumentProcessingJob = async (data: DocumentProcessingJob) => {
  if (!documentQueue) {
    console.warn('⚠️  Document queue not available, skipping background processing');
    return null;
  }
  return await documentQueue.add('process-document', data, {
    jobId: `doc-${data.documentId}`,
  });
};

// Document processing worker
const processDocument = async (job: Job<DocumentProcessingJob>) => {
  const { documentId, userId, encryptedFilename, mimeType } = job.data;

  console.log(`📄 [DOC:${documentId}] Processing for user ${userId}`);
  console.log(`📄 [DOC:${documentId}] Filename: ${encryptedFilename}, MIME: ${mimeType}`);

  try {
    await job.updateProgress(10);
    emitProcessingUpdate(userId, documentId, {
      progress: 10,
      stage: 'starting',
      message: 'Processing started',
    });

    // Step 1: Download encrypted file from GCS
    console.log(`⬇️  Downloading file: ${encryptedFilename}`);
    const fileBuffer = await downloadFile(encryptedFilename);
    await job.updateProgress(20);
    emitProcessingUpdate(userId, documentId, {
      progress: 20,
      stage: 'downloaded',
      message: 'File downloaded from storage',
    });

    // Step 2: Extract text from document
    console.log(`📝 [DOC:${documentId}] Extracting text from ${mimeType}...`);
    let extractedText = '';
    let ocrConfidence = null;
    let language = null;

    try {
      const extractionResult = await extractText(fileBuffer, mimeType);
      extractedText = extractionResult.text || '';
      ocrConfidence = extractionResult.confidence || null;
      language = extractionResult.language || null;
      console.log(
        `✅ [DOC:${documentId}] Extracted ${extractionResult.wordCount || 0} words (confidence: ${ocrConfidence})`
      );
      console.log(`✅ [DOC:${documentId}] Text preview: "${extractedText.substring(0, 100)}..."`);
    } catch (error) {
      console.warn(`⚠️  [DOC:${documentId}] Text extraction failed: ${(error as Error).message}`);
    }

    await job.updateProgress(50);
    emitProcessingUpdate(userId, documentId, {
      progress: 50,
      stage: 'text-extracted',
      message: `Extracted ${extractedText.split(/\s+/).length} words`,
      ocrConfidence,
    });

    // Step 2.5: Convert document to markdown for deep linking
    console.log(`📝 [DOC:${documentId}] Converting to markdown...`);
    let markdownContent = null;
    let markdownStructure = null;
    let images: string[] = [];
    let metadata: { pageCount?: number; wordCount?: number; sheetCount?: number; slideCount?: number } = {};

    try {
      const conversionResult = await markdownConversionService.convertToMarkdown(
        fileBuffer,
        mimeType,
        encryptedFilename,
        documentId
      );

      markdownContent = conversionResult.markdownContent;
      markdownStructure = JSON.stringify(conversionResult.structure);
      images = conversionResult.images;
      metadata = conversionResult.metadata;

      console.log(`✅ [DOC:${documentId}] Converted to markdown (${markdownContent.length} chars, ${conversionResult.structure.headings.length} headings)`);
    } catch (error) {
      console.warn(`⚠️  [DOC:${documentId}] Markdown conversion failed: ${(error as Error).message}`);
    }


    await job.updateProgress(60);
    emitProcessingUpdate(userId, documentId, {
      progress: 60,
      stage: 'markdown-converted',
      message: 'Document converted to markdown',
    });

    // Step 3: Generate thumbnail for images and PDFs
    console.log(`🖼️  Generating thumbnail...`);
    let thumbnailUrl = null;

    try {
      if (imageProcessing.isImage(mimeType)) {
        thumbnailUrl = await imageProcessing.generateAndUploadThumbnail(
          fileBuffer,
          userId,
          documentId
        );
        console.log(`✅ Thumbnail generated: ${thumbnailUrl}`);
      } else if (imageProcessing.isPDF(mimeType)) {
        const pdfThumb = await imageProcessing.generatePDFThumbnail(fileBuffer);
        if (pdfThumb) {
          // Upload PDF thumbnail to GCS
          const thumbFileName = `thumbnails/${userId}/${documentId}_thumb.jpg`;
          await imageProcessing.generateAndUploadThumbnail(fileBuffer, userId, documentId);
          thumbnailUrl = thumbFileName;
          console.log(`✅ PDF thumbnail generated: ${thumbnailUrl}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Thumbnail generation failed: ${(error as Error).message}`);
    }

    await job.updateProgress(75);
    emitProcessingUpdate(userId, documentId, {
      progress: 75,
      stage: 'thumbnail-generated',
      message: thumbnailUrl ? 'Thumbnail created' : 'Thumbnail skipped',
    });

    // Step 4: Document classification and entity extraction
    console.log(`🏷️  Classifying document...`);
    let classification = 'unknown';
    let entities = {};

    try {
      if (imageProcessing.isImage(mimeType)) {
        const docInfo = await visionService.detectDocumentType(fileBuffer);
        classification = docInfo.type;
        entities = docInfo.entities;
        console.log(`✅ Document classified as: ${classification}`);
      } else {
        // For non-image documents, use simple text-based classification
        const lowerText = extractedText.toLowerCase();
        if (lowerText.includes('invoice') || lowerText.includes('bill')) {
          classification = 'invoice';
        } else if (lowerText.includes('receipt')) {
          classification = 'receipt';
        } else if (lowerText.includes('contract')) {
          classification = 'contract';
        } else if (lowerText.includes('report')) {
          classification = 'report';
        }
      }
    } catch (error) {
      console.warn(`⚠️  Classification failed: ${(error as Error).message}`);
    }

    await job.updateProgress(85);
    emitProcessingUpdate(userId, documentId, {
      progress: 85,
      stage: 'classified',
      message: `Document classified as: ${classification}`,
    });

    // Step 5: Save metadata (entity extraction disabled temporarily)
    await job.updateProgress(95);

    // Step 6: Save metadata to database with explicit logging
    console.log(`💾 [DOC:${documentId}] Saving metadata to database...`);
    console.log(`💾 [DOC:${documentId}] Text to save (first 150 chars): "${extractedText.substring(0, 150)}..."`);

    // Use transaction to ensure atomicity and prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Verify document belongs to this user (security check)
      const doc = await tx.document.findUnique({
        where: { id: documentId },
        select: { userId: true, filename: true }
      });

      if (!doc) {
        throw new Error(`Document ${documentId} not found during metadata save`);
      }

      if (doc.userId !== userId) {
        throw new Error(`SECURITY BREACH PREVENTED: Document ${documentId} belongs to user ${doc.userId}, not ${userId}`);
      }

      console.log(`✅ [DOC:${documentId}] Verified document belongs to user ${userId} (filename: ${doc.filename})`);

      // Save metadata (including markdown)
      await tx.documentMetadata.upsert({
        where: { documentId },
        create: {
          documentId,
          extractedText,
          ocrConfidence,
          thumbnailUrl,
          entities: JSON.stringify(entities),
          classification,
          markdownContent,
          markdownStructure,
          pageCount: metadata.pageCount || null,
          wordCount: metadata.wordCount || null,
          sheetCount: metadata.sheetCount || null,
          slideCount: metadata.slideCount || null,
        },
        update: {
          extractedText,
          ocrConfidence,
          thumbnailUrl,
          entities: JSON.stringify(entities),
          classification,
          markdownContent,
          markdownStructure,
          pageCount: metadata.pageCount || null,
          wordCount: metadata.wordCount || null,
          sheetCount: metadata.sheetCount || null,
          slideCount: metadata.slideCount || null,
        },
      });

      console.log(`✅ [DOC:${documentId}] Metadata saved successfully`);

      // Update document status to completed
      await tx.document.update({
        where: { id: documentId },
        data: { status: 'completed' },
      });

      console.log(`✅ [DOC:${documentId}] Status updated to completed`);
    });

    // Step 7: Generate vector embeddings for RAG search
    console.log(`🧠 [DOC:${documentId}] Generating vector embeddings...`);

    try {
      if (extractedText && extractedText.length > 50) {
        const chunks = chunkText(extractedText, 500);
        console.log(`📦 [DOC:${documentId}] Split document into ${chunks.length} chunks`);

        await vectorEmbeddingService.storeDocumentEmbeddings(documentId, chunks);
        console.log(`✅ [DOC:${documentId}] Stored ${chunks.length} vector embeddings`);
      } else {
        console.log(`⚠️  [DOC:${documentId}] Skipping embeddings: text too short (${extractedText.length} chars)`);
      }
    } catch (embeddingError) {
      // Don't fail the entire job if embedding generation fails
      console.error(`❌ [DOC:${documentId}] Embedding generation failed (non-critical):`, embeddingError);
    }

    await job.updateProgress(100);
    emitProcessingUpdate(userId, documentId, {
      progress: 100,
      stage: 'completed',
      message: 'Processing completed successfully',
      classification,
      hasText: !!extractedText,
      hasThumbnail: !!thumbnailUrl,
    });
    console.log(`✅ [DOC:${documentId}] Document processed successfully`);
    console.log(`✅ [DOC:${documentId}] Final saved text preview: "${extractedText.substring(0, 150)}..."`);

    return {
      success: true,
      documentId,
      extractedText: extractedText.substring(0, 200), // First 200 chars for logging
      classification,
      ocrConfidence,
    };
  } catch (error) {
    console.error(`❌ [DOC:${documentId}] Error processing document:`, error);

    // Emit failure event
    emitProcessingUpdate(userId, documentId, {
      progress: 0,
      stage: 'failed',
      message: 'Processing failed',
      error: (error as Error).message,
    });

    // Update document status to failed
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'failed' },
      });
    } catch (dbError) {
      console.error('Failed to update document status:', dbError);
    }

    throw error;
  }
};

// Create worker only if queue is available
if (documentQueue && redisConnection) {
  try {
    documentWorker = new Worker<DocumentProcessingJob>(
      'document-processing',
      processDocument,
      {
        connection: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD || undefined,
        },
        concurrency: 5, // Process 5 documents simultaneously for 5x throughput
      }
    );

    documentWorker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    documentWorker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    documentWorker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  } catch (error) {
    console.warn('⚠️  Could not initialize document worker');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (documentWorker) await documentWorker.close();
  if (documentQueue) await documentQueue.close();
});

export { documentQueue, documentWorker };
export default documentQueue;
