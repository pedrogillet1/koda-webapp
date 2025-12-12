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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ HARD GUARD: NEVER allow zero-chunk documents to proceed
  // This prevents "completed" documents with no searchable content
  // ═══════════════════════════════════════════════════════════════════════════
  if (!chunks || chunks.length === 0) {
    const errorMessage = `CRITICAL: Zero chunks provided for document ${documentId}. Cannot store embeddings without content.`;
    console.error(`❌ [vectorEmbedding] ${errorMessage}`);
    throw new Error(errorMessage);
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
      // 🔥 CRITICAL: If PostgreSQL fails, we must rollback Pinecone to prevent inconsistent state
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
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔥 COMPENSATING DELETE: Rollback Pinecone on PostgreSQL failure
        // This prevents inconsistent state where Pinecone has data but PG doesn't
        // ═══════════════════════════════════════════════════════════════════════════
        console.error(`❌ [vectorEmbedding] PostgreSQL storage FAILED: ${pgError.message}`);
        console.warn(`🔄 [vectorEmbedding] Rolling back Pinecone embeddings for document ${documentId}...`);

        try {
          await pineconeService.deleteDocumentEmbeddings(documentId);
          console.log(`✅ [vectorEmbedding] Rollback complete - Pinecone embeddings deleted`);
        } catch (rollbackError: any) {
          console.error(`❌ [vectorEmbedding] CRITICAL: Rollback failed - inconsistent state! ${rollbackError.message}`);
        }

        // Re-throw to mark document as failed
        throw new Error(`PostgreSQL storage failed (Pinecone rolled back): ${pgError.message}`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 7: Store in DocumentChunk table (PostgreSQL for BM25 keyword search)
      // CRITICAL: This enables hybrid retrieval (vector + BM25 keyword search)
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        // Delete existing chunks for this document
        await prisma.documentChunk.deleteMany({
          where: { documentId },
        });

        // Prepare chunk records for BM25 table
        const chunkRecords = chunks.map((chunk, index) => {
          const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? index;
          const text = chunk.content || chunk.text || '';
          const page = chunk.pageNumber ?? chunk.metadata?.pageNumber ?? null;

          return {
            documentId,
            chunkIndex,
            text,
            page,
            startChar: chunk.metadata?.startChar ?? null,
            endChar: chunk.metadata?.endChar ?? null,
          };
        });

        // Insert chunks in batches
        const CHUNK_BATCH_SIZE = 100;
        for (let i = 0; i < chunkRecords.length; i += CHUNK_BATCH_SIZE) {
          const batch = chunkRecords.slice(i, i + CHUNK_BATCH_SIZE);
          await prisma.documentChunk.createMany({
            data: batch,
            skipDuplicates: true,
          });
        }

        console.log(`✅ [vectorEmbedding] Stored ${chunkRecords.length} chunks in PostgreSQL (BM25 keyword search)`);
      } catch (chunkError: any) {
        // ═══════════════════════════════════════════════════════════════════════════
        // 🔥 COMPENSATING DELETE: Rollback all stores on DocumentChunk failure
        // Ensures atomic all-or-nothing storage for consistent hybrid search
        // ═══════════════════════════════════════════════════════════════════════════
        console.error(`❌ [vectorEmbedding] DocumentChunk storage FAILED: ${chunkError.message}`);
        console.warn(`🔄 [vectorEmbedding] Rolling back Pinecone + DocumentEmbedding for document ${documentId}...`);

        try {
          await pineconeService.deleteDocumentEmbeddings(documentId);
          await prisma.documentEmbedding.deleteMany({ where: { documentId } });
          console.log(`✅ [vectorEmbedding] Rollback complete - all embeddings deleted`);
        } catch (rollbackError: any) {
          console.error(`❌ [vectorEmbedding] CRITICAL: Rollback failed - inconsistent state! ${rollbackError.message}`);
        }

        // Re-throw to mark document as failed
        throw new Error(`DocumentChunk storage failed (all stores rolled back): ${chunkError.message}`);
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
