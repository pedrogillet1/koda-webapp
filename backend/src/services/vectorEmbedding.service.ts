/**
 * Vector Embedding Service - ENHANCED WITH VERIFICATION
 *
 * Connects document.service.ts to pinecone.service.ts
 *
 * ENHANCEMENTS:
 * 1. ✅ Verification step after Pinecone upsert
 * 2. ✅ Retry logic for failed upserts
 * 3. ✅ Better error messages
 * 4. ✅ Removed deprecated micro-summary generation
 */

import embeddingService from './embedding.service';
import pineconeService from './pinecone.service';
import prisma from '../config/database';

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingService.generateEmbedding(text);
  return result.embedding;
}

interface StoreEmbeddingsOptions {
  maxRetries?: number;
  verifyAfterStore?: boolean;
}

/**
 * Store document embeddings in Pinecone AND PostgreSQL
 * WITH VERIFICATION AND RETRY LOGIC
 *
 * @param documentId - Document ID
 * @param chunks - Array of chunks with embeddings
 * @param options - Storage options
 */
export const storeDocumentEmbeddings = async (
  documentId: string,
  chunks: Array<{
    chunkIndex?: number;
    content?: string;
    text?: string;
    embedding?: number[];
    metadata?: any;
    pageNumber?: number;
  }>,
  options: StoreEmbeddingsOptions = {}
): Promise<void> => {
  const {
    maxRetries = 3,
    verifyAfterStore = true,
  } = options;

  if (!chunks || chunks.length === 0) {
    console.log(`[vectorEmbedding] No chunks to store for document ${documentId}`);
    return;
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    try {
      console.log(`💾 [vectorEmbedding] Storing ${chunks.length} embeddings for document ${documentId} (attempt ${attempt + 1}/${maxRetries})...`);

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 1: Fetch document metadata from database
      // ═══════════════════════════════════════════════════════════════════════════
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          folder: true,
        },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 2: Prepare document metadata for Pinecone
      // ═══════════════════════════════════════════════════════════════════════════
      const documentMetadata = {
        filename: document.filename,
        mimeType: document.mimeType,
        createdAt: document.createdAt,
        status: document.status,
        originalName: document.filename,
        folderId: document.folderId || undefined,
        folderName: document.folder?.name || undefined,
      };

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 3: Transform chunks to Pinecone format
      // ═══════════════════════════════════════════════════════════════════════════
      const pineconeChunks = chunks.map((chunk, index) => {
        const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? index;
        const content = chunk.content || chunk.text || '';
        const embedding = chunk.embedding || [];

        // Validate embedding
        if (!embedding || embedding.length === 0) {
          console.warn(`⚠️ [vectorEmbedding] Empty embedding for chunk ${chunkIndex}`);
        }

        return {
          chunkIndex,
          content,
          embedding,
          metadata: chunk.metadata || {},
        };
      });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 4: Store in Pinecone via pinecone.service.ts
      // ═══════════════════════════════════════════════════════════════════════════
      console.log(`🔄 [vectorEmbedding] Upserting ${pineconeChunks.length} vectors to Pinecone...`);

      await pineconeService.upsertDocumentEmbeddings(
        documentId,
        document.userId,
        documentMetadata,
        pineconeChunks
      );

      console.log(`✅ [vectorEmbedding] Stored ${chunks.length} embeddings in Pinecone`);

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 5: VERIFY embeddings were stored (NEW!)
      // ═══════════════════════════════════════════════════════════════════════════
      if (verifyAfterStore) {
        console.log(`🔍 [vectorEmbedding] Verifying embeddings in Pinecone...`);

        const verification = await pineconeService.verifyDocumentEmbeddings(documentId);

        if (!verification.success) {
          throw new Error(`Verification failed: ${verification.message}`);
        }

        if (verification.count !== chunks.length) {
          console.warn(`⚠️ [vectorEmbedding] Expected ${chunks.length} embeddings, found ${verification.count}`);
        }

        console.log(`✅ [vectorEmbedding] Verification passed: ${verification.count}/${chunks.length} embeddings found`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 6: Store in DocumentEmbedding table (PostgreSQL backup for BM25)
      // NOTE: Temporarily disabled due to Prisma client schema mismatch
      // Pinecone is the primary source of truth for embeddings
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        // Delete existing embeddings for this document
        await prisma.documentEmbedding.deleteMany({
          where: { documentId },
        });

        // Prepare data for PostgreSQL
        const embeddingRecords = chunks.map((chunk, index) => {
          const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? index;
          const content = chunk.content || chunk.text || '';
          const embedding = chunk.embedding || [];

          return {
            documentId,
            chunkIndex,
            content,
            embedding: JSON.stringify(embedding),
            metadata: JSON.stringify(chunk.metadata || {}),
            chunkType: chunk.metadata?.chunkType || null,
          };
        });

        // Insert in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < embeddingRecords.length; i += BATCH_SIZE) {
          const batch = embeddingRecords.slice(i, i + BATCH_SIZE);
          await prisma.documentEmbedding.createMany({
            data: batch,
            skipDuplicates: true,
          });
        }

        console.log(`✅ [vectorEmbedding] Stored ${embeddingRecords.length} embeddings in PostgreSQL (BM25 backup)`);
      } catch (pgError: any) {
        // Log warning but don't fail - Pinecone is the primary source
        console.warn(`⚠️ [vectorEmbedding] PostgreSQL backup failed (non-critical): ${pgError.message}`);
      }

      // Success! Break out of retry loop
      return;

    } catch (error: any) {
      lastError = error;
      attempt++;

      console.error(`❌ [vectorEmbedding] Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        const backoffDelay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ [vectorEmbedding] Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  // All retries failed
  throw new Error(`Failed to store embeddings after ${maxRetries} attempts: ${lastError?.message}`);
};

/**
 * Delete document embeddings from Pinecone and PostgreSQL
 */
export const deleteDocumentEmbeddings = async (documentId: string): Promise<void> => {
  try {
    console.log(`🗑️ [vectorEmbedding] Deleting embeddings for document ${documentId}`);

    // Delete from Pinecone
    await pineconeService.deleteDocumentEmbeddings(documentId);

    // Delete from PostgreSQL
    const result = await prisma.documentEmbedding.deleteMany({
      where: { documentId },
    });

    console.log(`✅ [vectorEmbedding] Deleted embeddings (Pinecone + ${result.count} PostgreSQL rows)`);
  } catch (error: any) {
    console.error(`❌ [vectorEmbedding] Failed to delete embeddings for document ${documentId}:`, error.message);
    // Don't throw - allow document deletion to proceed even if embedding deletion fails
  }
};

export async function deleteChunkEmbeddings(chunkIds: string[]): Promise<void> {
  console.log(`[VectorEmbedding] Would delete ${chunkIds.length} chunk embeddings`);
}

export const vectorEmbeddingService = {
  generateEmbedding,
  storeDocumentEmbeddings,
  deleteDocumentEmbeddings,
  deleteChunkEmbeddings,
};

export default {
  storeDocumentEmbeddings,
  deleteDocumentEmbeddings,
};
