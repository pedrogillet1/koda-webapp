/**
 * Document Processing Queue
 *
 * Handles async document processing after upload:
 * 1. Text extraction
 * 2. Chunking
 * 3. Embedding generation
 * 4. Pinecone storage
 *
 * This enables fast upload responses (1-2s) by moving heavy
 * processing to a background queue.
 */

import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════
// Queue Configuration
// ═══════════════════════════════════════════════════════════════

const connection = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
};

// Create the document processing queue
export const documentQueue = new Queue('document-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 3600, // Remove jobs older than 1 hour
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs for debugging
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// Job Types
// ═══════════════════════════════════════════════════════════════

export interface ProcessDocumentJobData {
  documentId: string;
  userId: string;
  filename: string;
  mimeType: string;
}

// ═══════════════════════════════════════════════════════════════
// Queue Worker
// ═══════════════════════════════════════════════════════════════

let worker: Worker | null = null;

export function startDocumentWorker() {
  if (worker) {
    console.log('[DocumentQueue] Worker already running');
    return;
  }

  worker = new Worker(
    'document-processing',
    async (job: Job<ProcessDocumentJobData>) => {
      const { documentId, userId, filename, mimeType } = job.data;

      console.log(`[DocumentQueue] Processing job ${job.id}: ${filename}`);

      try {
        // Import the document service dynamically to avoid circular deps
        const documentService = await import('../services/document.service');

        // Use reprocessDocument for retrying/processing documents
        // This function handles downloading from storage and full processing
        await documentService.reprocessDocument(documentId, userId);

        console.log(`[DocumentQueue] Job ${job.id} completed: ${filename}`);

        return { success: true, documentId };
      } catch (error: any) {
        console.error(`[DocumentQueue] Job ${job.id} failed:`, error.message);

        // Update document status to failed
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'processing_failed',
            updatedAt: new Date(),
          },
        });

        // Emit WebSocket event for failure
        try {
          const io = require('../server').io;
          if (io) {
            io.to(`user:${userId}`).emit('document-processing-failed', {
              documentId,
              filename,
              error: error.message || 'Processing failed',
            });
          }
        } catch (wsError) {
          console.error('[DocumentQueue] Failed to emit WebSocket event:', wsError);
        }

        throw error; // Re-throw to trigger retry
      }
    },
    {
      connection,
      concurrency: 3, // Process up to 3 documents simultaneously
    }
  );

  // Worker event handlers
  worker.on('completed', (job) => {
    console.log(`[DocumentQueue] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[DocumentQueue] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[DocumentQueue] Worker error:', err);
  });

  console.log('[DocumentQueue] Worker started');
}

export function stopDocumentWorker() {
  if (worker) {
    worker.close();
    worker = null;
    console.log('[DocumentQueue] Worker stopped');
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

export async function addDocumentJob(data: ProcessDocumentJobData) {
  const job = await documentQueue.add('process-document', data, {
    jobId: `doc-${data.documentId}`, // Prevent duplicate jobs
  });

  console.log(`[DocumentQueue] Added job ${job.id} for document ${data.documentId}`);

  return job;
}

export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    documentQueue.getWaitingCount(),
    documentQueue.getActiveCount(),
    documentQueue.getCompletedCount(),
    documentQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

export default {
  documentQueue,
  startDocumentWorker,
  stopDocumentWorker,
  addDocumentJob,
  getQueueStats,
};
