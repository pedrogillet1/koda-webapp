import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env';
import { redisConnection } from '../config/redis';
import { downloadFile } from '../config/storage';
import { extractText, ExtractionResult } from '../services/textExtraction.service';
import * as imageProcessing from '../services/imageProcessing.service';
import markdownConversionService from '../services/markdownConversion.service';
import embeddingService from '../services/embedding.service';
import pineconeService from '../services/pinecone.service';
import { createBM25Chunks } from '../services/bm25ChunkCreation.service';
import prisma from '../config/database';

// ============================================================================
// SAFETY AND CONFIGURATION CONSTANTS
// ============================================================================
const MAX_FILE_SIZE_MB = 100;
const MAX_TEXT_LENGTH = 500000; // 500k characters
const EXTRACTION_TIMEOUT_MS = 180000; // 3 minutes
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
];

// ============================================================================
// CUSTOM ERROR CLASS FOR CONTROLLED FAILURES
// ============================================================================
class ProcessingError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

// ============================================================================
// PRISMA READY CHECK (PRESERVED FROM ORIGINAL)
// ============================================================================
let prismaReady = false;

async function ensurePrismaReady(): Promise<void> {
  if (prismaReady) return;

  console.log('⏳ [PRISMA] Waiting for Prisma client to be ready...');

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    prismaReady = true;
    console.log('✅ [PRISMA] Prisma client is ready');
  } catch (error) {
    console.error('❌ [PRISMA] Failed to connect:', error);
    throw new Error('Prisma client not ready');
  }
}

// ============================================================================
// EMBEDDING VALIDATION (PRESERVED FROM ORIGINAL)
// ============================================================================
function validateEmbedding(embedding: number[], chunkContent: string): boolean {
  const hasNonZero = embedding.some(val => val !== 0);

  if (!hasNonZero) {
    console.warn(`⚠️  [EMBEDDING] Zero-vector detected for chunk: "${chunkContent.substring(0, 100)}..."`);
    return false;
  }

  const maxValue = Math.max(...embedding.map(Math.abs));
  if (maxValue > 10) {
    console.warn(`⚠️  [EMBEDDING] Abnormal embedding values (max: ${maxValue}) for chunk: "${chunkContent.substring(0, 100)}..."`);
    return false;
  }

  return true;
}

// ============================================================================
// SOCKET.IO DYNAMIC IMPORT
// ============================================================================
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

// ============================================================================
// REDIS PROGRESS TRACKING
// ============================================================================
const setDocumentProgress = async (
  documentId: string,
  progress: number,
  stage: string,
  message: string
) => {
  try {
    if (!redisConnection) return;
    const progressData = JSON.stringify({
      progress,
      stage,
      message,
      updatedAt: new Date().toISOString(),
    });
    await redisConnection.setex(`progress:${documentId}`, 3600, progressData);
  } catch (error) {
    console.warn(`⚠️  Failed to store progress for ${documentId}:`, error);
  }
};

// ============================================================================
// WEBSOCKET AND REDIS UPDATE EMITTER
// ============================================================================
const emitProcessingUpdate = async (
  userId: string,
  documentId: string,
  data: any
) => {
  const socketIO = getIO();
  if (socketIO) {
    socketIO.to(`user:${userId}`).emit('document-processing-update', {
      documentId,
      ...data,
    });
  }
  if (data.progress !== undefined) {
    await setDocumentProgress(
      documentId,
      data.progress,
      data.stage || '',
      data.message || ''
    );
  }
};

// ============================================================================
// TEXT CHUNKING LOGIC (PRESERVED FROM ORIGINAL)
// ============================================================================
async function chunkText(
  text: string,
  filename: string = 'document'
): Promise<Array<{ content: string; metadata: any }>> {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: Array<{ content: string; metadata: any }> = [];
  let currentChunk = '';
  let currentWordCount = 0;
  let chunkIndex = 0;
  const maxWords = 500;
  const CHUNK_OVERLAP = 50;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    const sentenceWordCount = words.length;

    if (
      currentWordCount + sentenceWordCount > maxWords &&
      currentChunk.length > 0
    ) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          chunkIndex,
          startChar: text.indexOf(currentChunk),
          endChar: text.indexOf(currentChunk) + currentChunk.length,
        },
      });
      chunkIndex++;
      const overlapSentences = currentChunk
        .split(/[.!?]+/)
        .slice(-2)
        .join('. ');
      currentChunk = overlapSentences ? overlapSentences + '. ' : '';
      currentWordCount = overlapSentences
        ? overlapSentences.split(/\s+/).length
        : 0;
    }

    currentChunk += sentence + ' ';
    currentWordCount += sentenceWordCount;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        chunkIndex,
        startChar: text.indexOf(currentChunk),
        endChar: text.indexOf(currentChunk) + currentChunk.length,
      },
    });
  }

  console.log(
    `📊 [Chunking] Created ${chunks.length} chunks (~${maxWords} words each) for "${filename}"`
  );
  return chunks;
}

// ============================================================================
// JOB INTERFACE AND QUEUE/WORKER SETUP
// ============================================================================
export interface DocumentProcessingJob {
  documentId: string;
  userId: string;
  encryptedFilename: string;
  mimeType: string;
  fileSize: number; // NEW: Added for size validation
}

let documentQueue: Queue<DocumentProcessingJob> | null = null;
let documentWorker: Worker<DocumentProcessingJob> | null = null;

if (redisConnection && process.env.REDIS_URL) {
  try {
    const redisUrl = new URL(process.env.REDIS_URL);
    documentQueue = new Queue<DocumentProcessingJob>('document-processing', {
      connection: {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port) || 6379,
        password: redisUrl.password,
        tls: {},
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 5, // Increased from 3 for better retry handling
        backoff: {
          type: 'exponential',
          delay: 15000, // 15 seconds (increased from 5s)
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000, // Increased from 100
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
      },
    });
  } catch (error) {
    console.warn('⚠️  Could not initialize document queue:', error);
    documentQueue = null;
  }
}

export const addDocumentProcessingJob = async (
  data: DocumentProcessingJob
) => {
  if (!documentQueue) {
    console.warn(
      '⚠️  Document queue not available, skipping background processing'
    );
    return null;
  }
  return await documentQueue.add('process-document', data, {
    jobId: `doc-${data.documentId}`,
  });
};

// ============================================================================
// MAIN DOCUMENT PROCESSING WORKER
// ============================================================================
const processDocument = async (job: Job<DocumentProcessingJob>) => {
  const { documentId, userId, encryptedFilename, mimeType, fileSize } =
    job.data;

  console.log(
    `📄 [DOC:${documentId}] Starting processing for user ${userId}, MIME: ${mimeType}, Size: ${fileSize} bytes`
  );

  // Ensure Prisma is ready before processing
  try {
    await ensurePrismaReady();
  } catch (error) {
    console.error(`❌ [DOC:${documentId}] Prisma not ready, failing job:`, error);
    throw new Error('Prisma client not initialized');
  }

  try {
    // ========================================================================
    // STEP 1: INITIAL VALIDATION (NEW)
    // ========================================================================
    await emitProcessingUpdate(userId, documentId, {
      progress: 5,
      stage: 'validation',
      message: 'Validating file...',
    });

    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      throw new ProcessingError(
        `Unsupported file type: ${mimeType}`,
        'validation'
      );
    }

    if (fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new ProcessingError(
        `File exceeds size limit of ${MAX_FILE_SIZE_MB}MB`,
        'validation'
      );
    }

    // ========================================================================
    // STEP 2: DOWNLOAD FILE
    // ========================================================================
    await emitProcessingUpdate(userId, documentId, {
      progress: 15,
      stage: 'downloading',
      message: 'Downloading file...',
    });

    const fileBuffer = await downloadFile(encryptedFilename);

    // ========================================================================
    // STEP 3: TEXT & METADATA EXTRACTION (WITH TIMEOUT)
    // ========================================================================
    await emitProcessingUpdate(userId, documentId, {
      progress: 30,
      stage: 'extracting',
      message: 'Extracting text and metadata...',
    });

    let extractionResult: ExtractionResult;
    try {
      const extractionPromise = extractText(fileBuffer, mimeType);
      extractionResult = await Promise.race([
        extractionPromise,
        new Promise<ExtractionResult>((_, reject) =>
          setTimeout(
            () => reject(new Error('Extraction timed out')),
            EXTRACTION_TIMEOUT_MS
          )
        ),
      ]);
    } catch (error) {
      throw new ProcessingError(
        `Text extraction failed: ${(error as Error).message}`,
        'extraction',
        true // Retryable
      );
    }

    const extractedText = extractionResult.text || '';
    if (extractedText.length > MAX_TEXT_LENGTH) {
      throw new ProcessingError(
        `Extracted text exceeds limit of ${MAX_TEXT_LENGTH} characters`,
        'extraction'
      );
    }

    // ========================================================================
    // STEP 4: PARALLEL PROCESSING (Markdown, DOCX->PDF, PowerPoint)
    // ========================================================================
    let markdownContent: string | null = null;
    let markdownStructure: string | null = null;
    let pdfConversionPath: string | null = null;
    let pptxMetadata: any = {};

    // Run markdown conversion, DOCX->PDF conversion, and PowerPoint extraction in parallel
    const [markdownResult, docxConversionResult, pptxResult] = await Promise.allSettled([
      // Task 1: Convert document to markdown for deep linking
      (async () => {
        console.log(`📝 [DOC:${documentId}] Converting to markdown...`);
        try {
          const conversionResult = await markdownConversionService.convertToMarkdown(
            fileBuffer,
            mimeType,
            encryptedFilename,
            documentId
          );
          console.log(`✅ [DOC:${documentId}] Converted to markdown (${conversionResult.markdownContent.length} chars)`);
          return conversionResult;
        } catch (error) {
          console.warn(`⚠️  [DOC:${documentId}] Markdown conversion failed: ${(error as Error).message}`);
          return null;
        }
      })(),

      // Task 2: Convert DOCX to PDF during upload (pre-conversion)
      (async () => {
        const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (!isDocx) {
          return null;
        }

        console.log(`📄 [DOC:${documentId}] DOCX detected - starting pre-conversion to PDF...`);
        try {
          const { convertDocxToPdf } = await import('../services/docx-converter.service');
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');

          const tempDir = os.tmpdir();
          const tempDocxPath = path.join(tempDir, `${documentId}.docx`);
          fs.writeFileSync(tempDocxPath, fileBuffer);

          const conversionResult = await convertDocxToPdf(tempDocxPath, tempDir);

          if (conversionResult.success && conversionResult.pdfPath) {
            const { uploadFile } = await import('../config/storage');
            const pdfBuffer = fs.readFileSync(conversionResult.pdfPath);
            const pdfStoragePath = `${userId}/${documentId}-converted.pdf`;
            await uploadFile(pdfStoragePath, pdfBuffer, 'application/pdf');

            fs.unlinkSync(tempDocxPath);
            fs.unlinkSync(conversionResult.pdfPath);

            console.log(`✅ [DOC:${documentId}] DOCX pre-converted to PDF: ${pdfStoragePath}`);
            return pdfStoragePath;
          } else {
            console.warn(`⚠️  [DOC:${documentId}] DOCX pre-conversion failed: ${conversionResult.error}`);
            return null;
          }
        } catch (error) {
          console.warn(`⚠️  [DOC:${documentId}] DOCX pre-conversion error: ${(error as Error).message}`);
          return null;
        }
      })(),

      // Task 3: Extract PowerPoint slides data
      (async () => {
        const isPPTX = mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        if (!isPPTX) {
          return null;
        }

        console.log(`📊 [DOC:${documentId}] PowerPoint detected - extracting slides data...`);
        try {
          const crypto = await import('crypto');
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');

          const tempDir = os.tmpdir();
          const tempFilePath = path.join(tempDir, `pptx-${crypto.randomUUID()}.pptx`);
          fs.writeFileSync(tempFilePath, fileBuffer);

          const { pptxExtractorService } = await import('../services/pptxExtractor.service');
          const result = await pptxExtractorService.extractText(tempFilePath);

          fs.unlinkSync(tempFilePath);

          if (result.success) {
            const extractedSlides = result.slides || [];
            return {
              slideCount: result.totalSlides || 0,
              slides: extractedSlides.map((slide: any) => ({
                slideNumber: slide.slide_number,
                content: slide.content,
                textCount: slide.text_count,
                imageUrl: null,
              })),
              metadata: result.metadata || {},
            };
          }
          return null;
        } catch (error) {
          console.warn(`⚠️  [DOC:${documentId}] PowerPoint extraction error: ${(error as Error).message}`);
          return null;
        }
      })(),
    ]);

    // Extract results from parallel execution
    if (markdownResult.status === 'fulfilled' && markdownResult.value) {
      markdownContent = markdownResult.value.markdownContent;
      markdownStructure = JSON.stringify(markdownResult.value.structure);
    }

    if (docxConversionResult.status === 'fulfilled' && docxConversionResult.value) {
      pdfConversionPath = docxConversionResult.value;
    }

    if (pptxResult.status === 'fulfilled' && pptxResult.value) {
      pptxMetadata = pptxResult.value;
      console.log(`✅ [DOC:${documentId}] Extracted metadata from ${pptxMetadata.slideCount} slides`);
    }

    // ========================================================================
    // STEP 5: SAVE INITIAL METADATA
    // ========================================================================
    await emitProcessingUpdate(userId, documentId, {
      progress: 50,
      stage: 'saving_metadata',
      message: 'Saving metadata...',
    });

    // If DOCX was pre-converted to PDF, store the PDF path in renderableContent
    if (pdfConversionPath) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          renderableContent: JSON.stringify({
            type: 'docx-pdf-conversion',
            pdfPath: pdfConversionPath,
            convertedAt: new Date().toISOString(),
          }),
        },
      });
      console.log(`✅ [DOC:${documentId}] Stored PDF conversion path in renderableContent`);
    }

    await prisma.documentMetadata.upsert({
      where: { documentId },
      create: {
        documentId,
        extractedText,
        ocrConfidence: extractionResult.confidence || null,
        pageCount: extractionResult.pageCount || null,
        wordCount: extractionResult.wordCount || null,
        sheetCount: (extractionResult as any).sheetCount || null, // Excel sheets
        // Markdown content
        markdownContent,
        markdownStructure,
        // PowerPoint data
        slideCount: pptxMetadata.slideCount || null,
        slidesData: pptxMetadata.slides ? JSON.stringify(pptxMetadata.slides) : null,
        pptxMetadata: pptxMetadata.metadata ? JSON.stringify(pptxMetadata.metadata) : null,
        // DISABLED (as per original code)
        thumbnailUrl: null,
        classification: 'unknown',
        entities: '{}',
      },
      update: {
        extractedText,
        ocrConfidence: extractionResult.confidence || null,
        pageCount: extractionResult.pageCount || null,
        wordCount: extractionResult.wordCount || null,
        sheetCount: (extractionResult as any).sheetCount || null,
        markdownContent,
        markdownStructure,
        slideCount: pptxMetadata.slideCount || null,
        slidesData: pptxMetadata.slides ? JSON.stringify(pptxMetadata.slides) : null,
        pptxMetadata: pptxMetadata.metadata ? JSON.stringify(pptxMetadata.metadata) : null,
      },
    });

    // ========================================================================
    // STEP 6: EMBEDDINGS & VECTOR STORAGE
    // ========================================================================
    if (extractedText && extractedText.length > 50) {
      await emitProcessingUpdate(userId, documentId, {
        progress: 70,
        stage: 'embedding',
        message: 'Generating embeddings...',
      });

      const documentRecord = await prisma.document.findUnique({
        where: { id: documentId },
        include: { folder: true },
      });

      // Create BM25 chunks for keyword search
      console.log(`🔍 [DOC:${documentId}] Creating BM25 chunks...`);
      const bm25ChunkCount = await createBM25Chunks(
        documentId,
        extractedText,
        extractionResult.pageCount || null
      );
      console.log(`✅ [DOC:${documentId}] Created ${bm25ChunkCount} BM25 chunks`);

      const chunks = await chunkText(
        extractedText,
        documentRecord?.filename || 'document.bin'
      );
      const chunksWithEmbeddings = [];

      for (let i = 0; i < chunks.length; i++) {
        try {
          const embeddingResult = await embeddingService.generateEmbedding(
            chunks[i].content
          );

          // Validate embedding before using
          if (!validateEmbedding(embeddingResult.embedding, chunks[i].content)) {
            console.warn(`⚠️  [DOC:${documentId}] Skipping chunk ${i} due to invalid embedding`);
            continue;
          }

          chunksWithEmbeddings.push({
            chunkIndex: i,
            content: chunks[i].content,
            embedding: embeddingResult.embedding,
            metadata: chunks[i].metadata,
          });
        } catch (chunkError) {
          console.warn(
            `⚠️ [DOC:${documentId}] Failed to embed chunk ${i}:`,
            chunkError
          );
        }
      }

      if (documentRecord && chunksWithEmbeddings.length > 0) {
        await pineconeService.upsertDocumentEmbeddings(
          documentId,
          userId,
          {
            filename: documentRecord.filename,
            mimeType: documentRecord.mimeType,
            createdAt: documentRecord.createdAt,
            status: 'completed',
            folderId: documentRecord.folderId || undefined,
            folderName: documentRecord.folder?.name || undefined,
            folderPath: documentRecord.folder?.path || undefined,
          },
          chunksWithEmbeddings
        );

        await prisma.document.update({
          where: { id: documentId },
          data: {
            embeddingsGenerated: true,
            chunksCount: chunksWithEmbeddings.length,
          },
        });

        console.log(
          `✅ [DOC:${documentId}] Stored ${chunksWithEmbeddings.length} embeddings in Pinecone`
        );
      }
    }

    // ========================================================================
    // STEP 7: FINAL STATUS UPDATE
    // ========================================================================
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'completed' },
    });

    await emitProcessingUpdate(userId, documentId, {
      progress: 100,
      stage: 'completed',
      message: 'Processing complete!',
    });

    // ========================================================================
    // STEP 8: POWERPOINT IMAGE EXTRACTION (PRESERVED, NON-BLOCKING)
    // ========================================================================
    if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      console.log(
        `🖼️  [DOC:${documentId}] Starting PowerPoint image extraction in background...`
      );

      (async () => {
        try {
          const crypto = await import('crypto');
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');

          // Download file from storage
          const pptxBuffer = await downloadFile(encryptedFilename);

          // Save to temp file
          const tempDir = os.tmpdir();
          const tempFilePath = path.join(
            tempDir,
            `pptx-img-${crypto.randomUUID()}.pptx`
          );
          fs.writeFileSync(tempFilePath, pptxBuffer);

          // Extract images
          const { PPTXImageExtractorService } = await import(
            '../services/pptxImageExtractor.service'
          );
          const extractor = new PPTXImageExtractorService();

          const imageResult = await extractor.extractImages(
            tempFilePath,
            documentId,
            {
              uploadToGCS: true,
              signedUrlExpiration: 604800, // 7 days
            }
          );

          if (
            imageResult.success &&
            imageResult.slides &&
            imageResult.slides.length > 0
          ) {
            console.log(
              `✅ [DOC:${documentId}] Extracted ${imageResult.totalImages} images from ${imageResult.slides.length} slides`
            );

            // Fetch existing slidesData
            const existingMetadata = await prisma.documentMetadata.findUnique({
              where: { documentId },
            });

            let existingSlidesData: any[] = [];
            try {
              if (existingMetadata?.slidesData) {
                existingSlidesData =
                  typeof existingMetadata.slidesData === 'string'
                    ? JSON.parse(existingMetadata.slidesData)
                    : (existingMetadata.slidesData as any[]);
              }
            } catch (e) {
              console.warn(
                `⚠️  [DOC:${documentId}] Failed to parse existing slidesData`
              );
            }

            // Merge extracted images with existing slide data
            const mergedSlidesData = existingSlidesData.map(
              (existingSlide: any) => {
                const slideNum =
                  existingSlide.slideNumber || existingSlide.slide_number;
                const extractedSlide = imageResult.slides!.find(
                  (s: any) => s.slideNumber === slideNum
                );

                const imageUrl =
                  extractedSlide?.compositeImageUrl ||
                  (extractedSlide?.images && extractedSlide.images.length > 0
                    ? extractedSlide.images[0].imageUrl
                    : null);

                return {
                  slideNumber: slideNum,
                  content: existingSlide.content || '',
                  textCount:
                    existingSlide.textCount || existingSlide.text_count || 0,
                  imageUrl: imageUrl || existingSlide.imageUrl,
                };
              }
            );

            // Update metadata with image URLs
            await prisma.documentMetadata.update({
              where: { documentId },
              data: {
                slidesData: JSON.stringify(mergedSlidesData),
              },
            });

            console.log(
              `✅ [DOC:${documentId}] Updated slidesData with image URLs`
            );
          }

          // Clean up temp file
          fs.unlinkSync(tempFilePath);
        } catch (error) {
          console.error(
            `❌ [DOC:${documentId}] PowerPoint image extraction failed:`,
            error
          );
        }
      })();
    }

    // ========================================================================
    // STEP 9: BACKWARD COMPATIBILITY - EMIT LEGACY EVENT (PRESERVED)
    // ========================================================================
    setTimeout(() => {
      const socketIO = getIO();
      if (socketIO) {
        socketIO.to(`user:${userId}`).emit('processing-complete', {
          documentId,
          classification: 'unknown',
          hasText: !!extractedText,
          hasThumbnail: false,
        });
        console.log(
          `📡 [DOC:${documentId}] Emitted legacy 'processing-complete' event`
        );
      }
    }, 500);

    console.log(`✅ [DOC:${documentId}] Document processed successfully`);
    return { success: true, documentId };
  } catch (error) {
    const isProcessingError = error instanceof ProcessingError;
    const errorMessage = (error as Error).message;
    const errorStage = isProcessingError
      ? (error as ProcessingError).stage
      : 'unknown';
    const isRetryable = isProcessingError
      ? (error as ProcessingError).isRetryable
      : false;

    console.error(
      `❌ [DOC:${documentId}] Error during stage '${errorStage}':`,
      errorMessage
    );

    await emitProcessingUpdate(userId, documentId, {
      progress: 100,
      stage: 'failed',
      message: errorMessage,
      error: true,
    });

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'failed',
        error: errorMessage.substring(0, 500),
      },
    });

    if (isRetryable && job.attemptsMade < (job.opts.attempts || 5)) {
      console.log(
        `🔄 [DOC:${documentId}] Retrying job, attempt ${
          job.attemptsMade + 1
        }...`
      );
      throw error; // Re-throw to let BullMQ handle the retry
    } else {
      console.log(
        `🚫 [DOC:${documentId}] Job failed permanently after ${job.attemptsMade} attempts`
      );
      return { success: false, documentId, error: errorMessage };
    }
  }
};

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================
if (documentQueue && redisConnection && process.env.REDIS_URL) {
  try {
    const redisUrl = new URL(process.env.REDIS_URL);
    documentWorker = new Worker<DocumentProcessingJob>(
      'document-processing',
      processDocument,
      {
        connection: {
          host: redisUrl.hostname,
          port: parseInt(redisUrl.port) || 6379,
          password: redisUrl.password,
          tls: {},
          maxRetriesPerRequest: null,
        },
        concurrency: 5, // Reduced from 10 for better stability
        lockDuration: 300000, // 5 minutes
        lockRenewTime: 150000, // 2.5 minutes
      }
    );

    console.log('✅ ========================================');
    console.log('✅ Document Processing Worker STARTED');
    console.log('✅ Queue: document-processing');
    console.log('✅ Concurrency: 5 jobs in parallel');
    console.log('✅ Redis connection: OK');
    console.log('✅ ========================================');

    documentWorker.on('ready', () => {
      console.log('✅ Worker is ready and waiting for jobs...');
    });

    documentWorker.on('active', (job) => {
      console.log(`🔄 Worker picked up job ${job.id} - Processing document...`);
    });

    documentWorker.on('completed', (job) => {
      console.log(`✅ Worker completed job ${job.id}`);
    });

    documentWorker.on('failed', (job, err) => {
      console.error(`❌ Worker failed job ${job?.id}:`, err.message);
    });

    documentWorker.on('error', (err) => {
      console.error(`❌ Worker error:`, err);
    });
  } catch (error) {
    console.warn('⚠️  Could not initialize document worker');
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
process.on('SIGTERM', async () => {
  if (documentWorker) await documentWorker.close();
  if (documentQueue) await documentQueue.close();
});

export { documentQueue, documentWorker };
export default documentQueue;
