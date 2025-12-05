import { Pinecone } from '@pinecone-database/pinecone';

/**
 * Pinecone Service - Fast vector database for semantic search
 * Provides 10x faster vector search compared to PostgreSQL pgvector
 *
 * Expected performance: 2-5s → 0.3-0.8s for vector search
 */
class PineconeService {
  private pinecone: Pinecone | null = null;
  private indexName: string;
  private isInitialized = false;

  constructor() {
    // Force reload from environment on each initialization
    this.indexName = process.env.PINECONE_INDEX_NAME || 'koda-gemini';
    console.log(`🔧 [Pinecone] Constructor: indexName set to "${this.indexName}"`);
    this.initialize();
  }

  /**
   * Initialize Pinecone client
   */
  private async initialize() {
    try {
      const apiKey = process.env.PINECONE_API_KEY;

      if (!apiKey) {
        console.warn('⚠️ [Pinecone] API key not configured - using PostgreSQL fallback');
        return;
      }

      this.pinecone = new Pinecone({
        apiKey: apiKey,
      });

      this.isInitialized = true;
      console.log(`✅ [Pinecone] Initialized successfully with index: "${this.indexName}"`);
    } catch (error) {
      console.error('❌ [Pinecone] Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if Pinecone is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.pinecone !== null;
  }

  /**
   * Upsert document embeddings to Pinecone with FULL metadata
   * ⚡ PERFORMANCE: Stores all document metadata to eliminate PostgreSQL query (15s → 0s!)
   * @param documentId - Document ID
   * @param userId - User ID for filtering
   * @param documentMetadata - Document metadata (filename, mimeType, createdAt, etc.)
   * @param chunks - Array of chunks with embeddings and metadata
   */
  async upsertDocumentEmbeddings(
    documentId: string,
    userId: string,
    documentMetadata: {
      filename: string;
      mimeType: string;
      createdAt: Date;
      status: string;
      // Enhanced metadata for Issue #1
      originalName?: string;
      categoryId?: string;
      categoryName?: string;
      categoryEmoji?: string;
      folderId?: string;
      folderName?: string;
      folderPath?: string;
    },
    chunks: Array<{
      chunkIndex: number;
      content: string;
      embedding: number[];
      metadata: any;
    }>
  ): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('⚠️ [Pinecone] Not available, skipping upsert');
      return;
    }

    try {
      const index = this.pinecone!.index(this.indexName);

      // Prepare vectors with FULL metadata (no PostgreSQL query needed later!)
      const vectors = chunks.map(chunk => ({
        id: `${documentId}-${chunk.chunkIndex}`,
        values: chunk.embedding,
        metadata: {
          // ⚡ User identification (for filtering)
          userId,

          // ⚡ Document identification and metadata
          documentId,
          filename: documentMetadata.filename,
          originalName: documentMetadata.originalName,
          mimeType: documentMetadata.mimeType,
          status: documentMetadata.status,
          createdAt: documentMetadata.createdAt.toISOString(),

          // ⚡ Hierarchy metadata (Issue #1 enhancement)
          categoryId: documentMetadata.categoryId,
          categoryName: documentMetadata.categoryName,
          categoryEmoji: documentMetadata.categoryEmoji,
          folderId: documentMetadata.folderId,
          folderName: documentMetadata.folderName,
          folderPath: documentMetadata.folderPath,

          // ⚡ Chunk data
          chunkIndex: chunk.chunkIndex,
          content: chunk.content.substring(0, 5000), // Store up to 5000 chars

          // ⚡ Additional chunk metadata
          ...chunk.metadata,
        },
      }));

      // Upsert in batches of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, Math.min(i + BATCH_SIZE, vectors.length));
        await index.upsert(batch);
        console.log(`✅ [Pinecone] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vectors.length / BATCH_SIZE)}`);
      }

      console.log(`✅ [Pinecone] Upserted ${chunks.length} embeddings with full metadata for document ${documentId}`);
    } catch (error) {
      console.error('❌ [Pinecone] Upsert failed:', error);
      throw error;
    }
  }

  /**
   * Search for similar chunks using Pinecone with FULL metadata
   * ⚡ PERFORMANCE: Returns document metadata directly from Pinecone (no PostgreSQL query!)
   * @param queryEmbedding - Query embedding vector
   * @param userId - User ID to filter results
   * @param topK - Number of results to return
   * @param minSimilarity - Minimum similarity threshold
   * @param attachedDocumentId - Optional document ID to filter results (for document attachment feature)
   * @returns Array of matching chunks with document metadata
   */
  async searchSimilarChunks(
    queryEmbedding: number[],
    userId: string,
    topK: number = 5,
    minSimilarity: number = 0.3, // Lowered from 0.5 to 0.3 for better recall
    attachedDocumentId?: string,
    folderId?: string
  ): Promise<Array<{
    documentId: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    metadata: any;
    // ⚡ Document metadata (from Pinecone - no PostgreSQL query!)
    document: {
      id: string;
      filename: string;
      mimeType: string;
      createdAt: string;
      status: string;
    };
  }>> {
    if (!this.isAvailable()) {
      console.warn('⚠️ [Pinecone] Not available, returning empty results');
      return [];
    }

    try {
      console.time('⏱️ [Pinecone Search]');
      console.log(`🔍 [Pinecone] Searching in index "${this.indexName}" for userId: ${userId.substring(0, 8)}...`);

      const index = this.pinecone!.index(this.indexName);

      // Build filter - always filter by userId, optionally by documentId/folderId
      const filter: any = {
        userId: { $eq: userId } // ⚡ Filter by userId in Pinecone for speed
      };

      // ⚡ Add document filter if attachedDocumentId is provided
      if (attachedDocumentId) {
        console.log(`📎 [Pinecone] Filtering by attached document: ${attachedDocumentId}`);
        filter.$and = [
          { userId: { $eq: userId } },
          { documentId: { $eq: attachedDocumentId } }
        ];
        // Remove the top-level userId filter since it's in $and
        delete filter.userId;
      }
      // ⚡ Add folder filter if folderId is provided (for folder-scoped queries)
      else if (folderId) {
        console.log(`📁 [Pinecone] Filtering by folder: ${folderId}`);
        filter.$and = [
          { userId: { $eq: userId } },
          { folderId: { $eq: folderId } }
        ];
        // Remove the top-level userId filter since it's in $and
        delete filter.userId;
      }

      // Query Pinecone with userId filter for MUCH faster results
      // ⚡ PERFORMANCE: Filtering at database level (10-100x faster than post-filtering)
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: topK, // No need for multiplier with userId filtering
        includeMetadata: true,
        filter
      });

      console.timeEnd('⏱️ [Pinecone Search]');

      // Filter and format results with full metadata (NO PostgreSQL query!)
      const preliminaryResults = queryResponse.matches
        .filter(match => {
          // Filter by similarity threshold
          if ((match.score || 0) < minSimilarity) return false;
          return true;
        })
        .slice(0, topK)
        .map(match => ({
          documentId: match.metadata?.documentId as string,
          chunkIndex: match.metadata?.chunkIndex as number,
          content: match.metadata?.content as string,
          similarity: match.score || 0,
          metadata: match.metadata || {},
          // ⚡ Document metadata from Pinecone (eliminates 15s PostgreSQL query!)
          document: {
            id: match.metadata?.documentId as string,
            filename: match.metadata?.filename as string,
            mimeType: match.metadata?.mimeType as string,
            createdAt: match.metadata?.createdAt as string,
            status: match.metadata?.status as string,
          },
        }));

      // ✅ FIX: Filter out deleted documents
      const documentIds = [...new Set(preliminaryResults.map(r => r.documentId))];

      if (documentIds.length > 0) {
        const prisma = (await import('../config/database')).default;

        try {
          const validDocuments = await prisma.documents.findMany({
            where: {
              id: { in: documentIds },
              userId: userId,
              status: { not: 'deleted' },  // ✅ Only include non-deleted documents
            },
            select: {
              id: true,
            },
          });

          const validDocumentIds = new Set(validDocuments.map(d => d.id));
          const results = preliminaryResults.filter(r => validDocumentIds.has(r.documentId));

          console.log(`🗑️ [PINECONE] Filtered deleted documents: ${preliminaryResults.length} → ${results.length}`);
          console.log(`✅ [Pinecone] Found ${results.length} results with full metadata`);

          await prisma.$disconnect();
          return results;
        } catch (error) {
          console.error('❌ [Pinecone] Error filtering deleted documents:', error);
          await prisma.$disconnect();
          return preliminaryResults; // Fallback to unfiltered results
        }
      }

      console.log(`✅ [Pinecone] Found ${preliminaryResults.length} results with full metadata (no PostgreSQL query!)`);
      return preliminaryResults;
    } catch (error) {
      console.error('❌ [Pinecone] Search failed:', error);
      return [];
    }
  }

  /**
   * Unified query method for RAG service
   * Wrapper around searchSimilarChunks for backward compatibility
   */
  async query(
    embedding: number[],
    options: {
      userId: string;
      topK?: number;
      minSimilarity?: number;
      documentId?: string;
      folderId?: string;
    }
  ): Promise<Array<{
    documentId: string;
    content: string;
    filename: string;
    similarity: number;
    chunkIndex: number;
    metadata: any;
  }>> {
    console.log(`🔍 [Pinecone.query] Wrapper called for userId: ${options.userId.substring(0, 8)}...`);

    // Call the actual search method
    const results = await this.searchSimilarChunks(
      embedding,
      options.userId,
      options.topK || 10,
      options.minSimilarity || 0.5,
      options.documentId,
      options.folderId
    );

    console.log(`✅ [Pinecone.query] Returning ${results.length} results with filenames`);

    // Transform results to match expected format
    return results.map(result => ({
      documentId: result.documentId,
      content: result.content,
      filename: result.document.filename,  // ✅ Extract filename
      similarity: result.similarity,
      chunkIndex: result.chunkIndex,
      metadata: {
        ...result.metadata,
        // ✅ Ensure filename is in metadata
        filename: result.document.filename,
        mimeType: result.document.mimeType,
        createdAt: result.document.createdAt,
        documentId: result.documentId,
      }
    }));
  }

  /**
   * Delete document embeddings from Pinecone
   * @param documentId - Document ID
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('⚠️ [Pinecone] Not available, skipping delete');
      return;
    }

    try {
      const index = this.pinecone!.index(this.indexName);

      console.log(`🗑️ [Pinecone] Deleting all vectors for document: ${documentId}`);

      // Step 1: Query to find all vector IDs for this document
      const dummyVector = new Array(1536).fill(0); // ✅ Updated to OpenAI dimensions
      const queryResponse = await index.query({
        vector: dummyVector,
        filter: { documentId: { $eq: documentId } },
        topK: 10000, // Get all vectors (Pinecone max is 10k per query)
        includeMetadata: false, // Don't need metadata, just IDs
      });

      const vectorIds = queryResponse.matches?.map(match => match.id) || [];

      if (vectorIds.length === 0) {
        console.log(`⚠️ [Pinecone] No vectors found for document ${documentId}`);
        return;
      }

      console.log(`🔍 [Pinecone] Found ${vectorIds.length} vectors to delete`);

      // Step 2: Delete vectors by ID in batches (Pinecone limit: 1000 per batch)
      const BATCH_SIZE = 1000;
      for (let i = 0; i < vectorIds.length; i += BATCH_SIZE) {
        const batch = vectorIds.slice(i, Math.min(i + BATCH_SIZE, vectorIds.length));
        await index.deleteMany(batch);
        console.log(`🗑️ [Pinecone] Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vectorIds.length / BATCH_SIZE)}`);
      }

      console.log(`✅ [Pinecone] Successfully deleted ${vectorIds.length} embeddings for document ${documentId}`);

    } catch (error: any) {
      console.error(`❌ [Pinecone] Failed to delete embeddings for document ${documentId}:`, error.message);
      // Don't throw - deletion failure shouldn't break document deletion
      return;
    }
  }

  /**
   * Search for specific slide using metadata filter
   * ⚡ SMART RETRIEVAL: Directly query by slide number for precise results
   * @param userId - User ID to filter results
   * @param slideNumber - Specific slide number to retrieve
   * @param topK - Number of results to return (default 5)
   * @param attachedDocumentId - Optional document ID to filter results (for document attachment feature)
   * @returns Array of chunks from the specific slide
   */
  async searchBySlideNumber(
    userId: string,
    slideNumber: number,
    topK: number = 5,
    attachedDocumentId?: string
  ): Promise<Array<{
    documentId: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    metadata: any;
    document: {
      id: string;
      filename: string;
      mimeType: string;
      createdAt: string;
      status: string;
    };
  }>> {
    if (!this.isAvailable()) {
      console.warn('⚠️ [Pinecone] Not available, returning empty results');
      return [];
    }

    try {
      console.log(`🎯 [Pinecone] Searching for slide ${slideNumber} for userId: ${userId.substring(0, 8)}...`);
      const index = this.pinecone!.index(this.indexName);

      // Use a dummy vector (zeros) since we're filtering by metadata only
      const dummyVector = new Array(1536).fill(0);

      // Build filter - always filter by userId and slide, optionally by documentId
      const filterConditions: any[] = [
        { userId: { $eq: userId } },
        { slide: { $eq: slideNumber } }
      ];

      // ⚡ Add document filter if attachedDocumentId is provided
      if (attachedDocumentId) {
        console.log(`📎 [Pinecone] Filtering slide search by attached document: ${attachedDocumentId}`);
        filterConditions.push({ documentId: { $eq: attachedDocumentId } });
      }

      const queryResponse = await index.query({
        vector: dummyVector,
        topK: topK,
        includeMetadata: true,
        filter: {
          $and: filterConditions
        }
      });

      const results = queryResponse.matches.map(match => ({
        documentId: match.metadata?.documentId as string,
        chunkIndex: match.metadata?.chunkIndex as number,
        content: match.metadata?.content as string,
        similarity: match.score || 0,
        metadata: match.metadata || {},
        document: {
          id: match.metadata?.documentId as string,
          filename: match.metadata?.filename as string,
          mimeType: match.metadata?.mimeType as string,
          createdAt: match.metadata?.createdAt as string,
          status: match.metadata?.status as string,
        },
      }));

      console.log(`✅ [Pinecone] Found ${results.length} chunks for slide ${slideNumber}`);
      return results;
    } catch (error) {
      console.error('❌ [Pinecone] Slide search failed:', error);
      return [];
    }
  }

  /**
   * Search for specific Excel sheet using metadata filter
   * ⚡ SMART RETRIEVAL: Directly query by sheet number for precise results
   * @param userId - User ID to filter results
   * @param sheetNumber - Specific sheet number to retrieve (1-indexed)
   * @param topK - Number of results to return (default 100 to get all rows)
   * @param attachedDocumentId - Optional document ID to filter results (for document attachment feature)
   * @returns Array of chunks from the specific sheet
   */
  async searchBySheetNumber(
    userId: string,
    sheetNumber: number,
    topK: number = 100,
    attachedDocumentId?: string
  ): Promise<Array<{
    documentId: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    metadata: any;
    document: {
      id: string;
      filename: string;
      mimeType: string;
      createdAt: string;
      status: string;
    };
  }>> {
    if (!this.isAvailable()) {
      console.warn('⚠️ [Pinecone] Not available, returning empty results');
      return [];
    }

    try {
      console.log(`📊 [Pinecone] Searching for Excel sheet ${sheetNumber} for userId: ${userId.substring(0, 8)}...`);
      const index = this.pinecone!.index(this.indexName);

      // Use a dummy vector (zeros) since we're filtering by metadata only
      const dummyVector = new Array(1536).fill(0);

      // Build filter - always filter by userId and sheetNumber, optionally by documentId
      const filterConditions: any[] = [
        { userId: { $eq: userId } },
        { sheetNumber: { $eq: sheetNumber } }
      ];

      // ⚡ Add document filter if attachedDocumentId is provided
      if (attachedDocumentId) {
        console.log(`📎 [Pinecone] Filtering sheet search by attached document: ${attachedDocumentId}`);
        filterConditions.push({ documentId: { $eq: attachedDocumentId } });
      }

      const queryResponse = await index.query({
        vector: dummyVector,
        topK: topK,
        includeMetadata: true,
        filter: {
          $and: filterConditions
        }
      });

      const results = queryResponse.matches.map(match => ({
        documentId: match.metadata?.documentId as string,
        chunkIndex: match.metadata?.chunkIndex as number,
        content: match.metadata?.content as string,
        similarity: match.score || 0,
        metadata: match.metadata || {},
        document: {
          id: match.metadata?.documentId as string,
          filename: match.metadata?.filename as string,
          mimeType: match.metadata?.mimeType as string,
          createdAt: match.metadata?.createdAt as string,
          status: match.metadata?.status as string,
        },
      }));

      console.log(`✅ [Pinecone] Found ${results.length} chunks for sheet ${sheetNumber}`);
      return results;
    } catch (error) {
      console.error('❌ [Pinecone] Sheet search failed:', error);
      return [];
    }
  }

  /**
   * Get Pinecone index stats
   */
  async getIndexStats(): Promise<any> {
    if (!this.isAvailable()) {
      return { available: false };
    }

    try {
      const index = this.pinecone!.index(this.indexName);
      const stats = await index.describeIndexStats();

      return {
        available: true,
        totalVectorCount: stats.totalRecordCount,
        dimension: stats.dimension,
        indexFullness: stats.indexFullness,
      };
    } catch (error) {
      console.error('❌ [Pinecone] Failed to get stats:', error);
      return { available: false, error: String(error) };
    }
  }

  /**
   * Verify that document embeddings are stored and retrievable
   * @param documentId - Document ID to verify
   * @returns Verification result with success status, vector count, and error if any
   */
  async verifyDocument(documentId: string): Promise<{
    success: boolean;
    vectorCount: number;
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        vectorCount: 0,
        error: 'Pinecone not available',
      };
    }

    try {
      console.log(`🔍 Verifying document ${documentId} in Pinecone...`);
      const index = this.pinecone!.index(this.indexName);

      // Query for vectors with this documentId using a zero vector
      // We only care about the metadata filter, not the actual similarity
      // ✅ Using 1536 dimensions for OpenAI embeddings
      const queryResponse = await index.query({
        vector: new Array(1536).fill(0),
        filter: { documentId: { $eq: documentId } },
        topK: 100,
        includeMetadata: true,
      });

      const vectorCount = queryResponse.matches?.length || 0;

      if (vectorCount === 0) {
        return {
          success: false,
          vectorCount: 0,
          error: 'No vectors found in Pinecone for this document',
        };
      }

      console.log(`✅ Verification passed: Found ${vectorCount} vectors`);
      return {
        success: true,
        vectorCount,
      };
    } catch (error: any) {
      console.error('❌ Pinecone verification failed:', error.message);
      return {
        success: false,
        vectorCount: 0,
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Verify Document Embeddings Storage
  // ═══════════════════════════════════════════════════════════════
  async verifyDocumentEmbeddings(documentId: string): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    try {
      console.log(`🔍 [VERIFY] Checking embeddings for document: ${documentId}`);

      if (!this.isAvailable()) {
        console.warn(`⚠️ [VERIFY] Pinecone not available`);
        return {
          success: false,
          count: 0,
          message: 'Pinecone not available',
        };
      }

      const index = this.pinecone!.index(this.indexName);

      const queryResponse = await index.query({
        vector: new Array(1536).fill(0),
        topK: 1000,
        filter: {
          documentId: documentId,
        },
        includeMetadata: false,
      });

      const count = queryResponse.matches?.length || 0;

      if (count > 0) {
        console.log(`✅ [VERIFY] Found ${count} embeddings for document ${documentId}`);
        return {
          success: true,
          count,
          message: `Successfully verified ${count} embeddings`,
        };
      } else {
        console.warn(`⚠️ [VERIFY] No embeddings found for document ${documentId}`);
        return {
          success: false,
          count: 0,
          message: 'No embeddings found in Pinecone',
        };
      }

    } catch (error: any) {
      console.error(`❌ [VERIFY] Verification failed for document ${documentId}:`, error);
      return {
        success: false,
        count: 0,
        message: `Verification error: ${error.message}`,
      };
    }
  }
}

export default new PineconeService();
