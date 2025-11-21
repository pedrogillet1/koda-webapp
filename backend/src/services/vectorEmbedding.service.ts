import prisma from '../config/database';
import cacheService from './cache.service';
import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';

// ✅ Now using OpenAI embeddings via embedding.service.ts (1536 dimensions)

interface EmbeddingMetadata {
  page?: number;
  pageCount?: number;
  cell?: string;
  sheet?: string;
  row?: number;
  slide?: number;
  paragraph?: number;
  section?: string;
  startChar?: number;
  endChar?: number;
}

interface ChunkWithMetadata {
  content: string;
  metadata: EmbeddingMetadata;
}

class VectorEmbeddingService {
  /**
   * Generate embedding for a text using OpenAI API
   * @param text - Text to embed
   * @returns Array of 1536 floats (OpenAI text-embedding-3-small)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.time('⏱️ [Embedding] Total time');

      // Use the centralized embedding service (which handles caching internally)
      const result = await embeddingService.generateEmbedding(text);

      console.timeEnd('⏱️ [Embedding] Total time');
      return result.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate embeddings for multiple texts in batch (parallel processing)
   * 🚀 PERFORMANCE OPTIMIZATION: Using OpenAI batch embedding API
   * @param texts - Array of texts to embed
   * @returns Array of embeddings
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      console.log(`⚡ [Batch Embedding] Processing ${texts.length} chunks with OpenAI...`);
      const startTime = Date.now();

      // Use the centralized embedding service which handles batching and caching
      const result = await embeddingService.generateBatchEmbeddings(texts);

      const duration = Date.now() - startTime;
      console.log(`⚡ [Batch Embedding] Completed in ${duration}ms (${(duration / texts.length).toFixed(0)}ms per chunk)`);

      return result.embeddings.map(e => e.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw new Error('Failed to generate batch embeddings');
    }
  }

  /**
   * Store document embeddings in Pinecone only
   * 🚀 PERFORMANCE OPTIMIZATION: Fast batch processing with Pinecone
   * @param documentId - Document ID
   * @param chunks - Array of text chunks with metadata
   */
  async storeDocumentEmbeddings(
    documentId: string,
    chunks: ChunkWithMetadata[]
  ): Promise<void> {
    try {
      console.log(`⚡ [Store Embeddings] Processing ${chunks.length} chunks for document ${documentId}...`);
      const startTime = Date.now();

      // Step 1: Delete existing embeddings from Pinecone
      await pineconeService.deleteDocumentEmbeddings(documentId);

      // Step 2: Generate ALL embeddings in batch (parallel)
      const chunkTexts = chunks.map(c => c.content);
      const embeddings = await this.generateEmbeddingsBatch(chunkTexts);

      // Step 3: Store in Pinecone only
      console.log(`💾 [Store Embeddings] Saving to Pinecone...`);

      // Get document metadata for Pinecone
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          userId: true,
          filename: true,
          mimeType: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          fileSize: true,
          folderId: true,
          folder: {
            select: {
              name: true,
              path: true
            }
          }
        }
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (!pineconeService.isAvailable()) {
        throw new Error('Pinecone is not available - cannot store embeddings');
      }

      // Store embeddings in Pinecone with enhanced metadata
      await pineconeService.upsertDocumentEmbeddings(
        documentId,
        document.userId,
        {
          filename: document.filename,
          mimeType: document.mimeType,
          createdAt: document.createdAt,
          status: document.status,
          folderId: document.folderId ?? undefined,
          folderName: document.folder?.name ?? undefined,
          folderPath: document.folder?.path ?? undefined
        },
        chunks.map((chunk, i) => ({
          chunkIndex: i,
          content: chunk.content,
          embedding: embeddings[i],
          metadata: chunk.metadata
        }))
      );

      const duration = Date.now() - startTime;
      console.log(`✅ [Store Embeddings] Completed in ${(duration / 1000).toFixed(1)}s (${(duration / chunks.length).toFixed(0)}ms per chunk)`);

    } catch (error) {
      console.error('Error storing document embeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vecA - First vector
   * @param vecB - Second vector
   * @returns Similarity score between -1 and 1
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Extract sheet reference from query text
   * @param queryText - Search query text
   * @returns Sheet name/number or null
   */
  private extractSheetReference(queryText: string): string | null {
    const lowerQuery = queryText.toLowerCase();

    // Match patterns - prioritize "sheet" keyword patterns first
    const patterns = [
      /sheet\s+['"]?([a-z]+\s*\d+)['"]?/i,  // "sheet ex2" or "sheet ex 2" or "sheet 'ex 2'"
      /sheet\s+(\d+)/i,                      // "sheet 2"
      /sheet\s+named\s+['"]?([a-z0-9_\s]+)['"]?/i,  // "sheet named ex2"
      /\bon\s+sheet\s+['"]?([a-z]+\s*\d+)['"]?/i,   // "on sheet ex2"
      /\bin\s+sheet\s+['"]?([a-z]+\s*\d+)['"]?/i,   // "in sheet ex2"
    ];

    for (const pattern of patterns) {
      const match = lowerQuery.match(pattern);
      if (match && match[1]) {
        // Remove spaces and return (e.g., "ex 2" becomes "ex2")
        return match[1].trim().replace(/\s+/g, '');
      }
    }

    return null;
  }

  /**
   * Extract slide reference from query text
   * @param queryText - Search query text
   * @returns Slide number or null
   */
  private extractSlideReference(queryText: string): number | null {
    const lowerQuery = queryText.toLowerCase();

    // Match patterns for slide references
    const patterns = [
      /slide\s+(?:number\s+)?(\d+)/i,        // "slide 2" or "slide number 2"
      /\bon\s+slide\s+(\d+)/i,               // "on slide 2"
      /\bin\s+slide\s+(\d+)/i,               // "in slide 2"
      /\bof\s+slide\s+(\d+)/i,               // "of slide 2"
      /\bfrom\s+slide\s+(\d+)/i,             // "from slide 2"
      /slide\s+#?(\d+)/i,                    // "slide #2"
    ];

    for (const pattern of patterns) {
      const match = lowerQuery.match(pattern);
      if (match && match[1]) {
        const slideNum = parseInt(match[1], 10);
        if (slideNum > 0 && slideNum < 1000) { // Sanity check
          return slideNum;
        }
      }
    }

    return null;
  }

  /**
   * Extract page reference from query text
   * @param queryText - Search query text
   * @returns Page number or null
   */
  private extractPageReference(queryText: string): number | null {
    const lowerQuery = queryText.toLowerCase();

    // Match patterns for page references
    const patterns = [
      /page\s+(?:number\s+)?(\d+)/i,         // "page 2" or "page number 2"
      /\bon\s+page\s+(\d+)/i,                // "on page 2"
      /\bin\s+page\s+(\d+)/i,                // "in page 2"
      /\bof\s+page\s+(\d+)/i,                // "of page 2"
      /\bfrom\s+page\s+(\d+)/i,              // "from page 2"
      /page\s+#?(\d+)/i,                     // "page #2"
      /p\.?\s*(\d+)/i,                       // "p.2" or "p 2"
    ];

    for (const pattern of patterns) {
      const match = lowerQuery.match(pattern);
      if (match && match[1]) {
        const pageNum = parseInt(match[1], 10);
        if (pageNum > 0 && pageNum < 10000) { // Sanity check
          return pageNum;
        }
      }
    }

    return null;
  }

  /**
   * Search for similar document chunks using Pinecone only
   * @param userId - User ID to filter documents
   * @param queryText - Search query text
   * @param topK - Number of results to return
   * @param minSimilarity - Minimum similarity threshold (0-1)
   * @returns Array of relevant chunks with similarity scores
   */
  async searchSimilarChunks(
    userId: string,
    queryText: string,
    topK: number = 5,
    minSimilarity: number = 0.3  // Lowered from 0.5 to improve recall for PDF content
  ) {
    try {
      console.log('\n🔍 === SEARCH DEBUG START ===');
      console.time('⏱️ [Total Search Time]');
      const startTime = Date.now();

      // 1. Extract location references (sheet, slide, page)
      console.time('1️⃣ Extract location references');
      const sheetRef = this.extractSheetReference(queryText);
      const slideRef = this.extractSlideReference(queryText);
      const pageRef = this.extractPageReference(queryText);
      console.timeEnd('1️⃣ Extract location references');
      console.log(`   Sheet reference: ${sheetRef || 'none'}`);
      console.log(`   Slide reference: ${slideRef || 'none'}`);
      console.log(`   Page reference: ${pageRef || 'none'}`);

      // 2. Generate embedding for query
      console.time('2️⃣ Generate query embedding');
      const embeddingStart = Date.now();
      const queryEmbedding = await this.generateEmbedding(queryText);
      const embeddingDuration = Date.now() - embeddingStart;
      console.timeEnd('2️⃣ Generate query embedding');
      console.log(`   Embedding generated: ${queryEmbedding.length} dimensions in ${embeddingDuration}ms`);

      // 3. Check Pinecone availability
      if (!pineconeService.isAvailable()) {
        throw new Error('Pinecone is not available - cannot perform search');
      }

      // 4. Query Pinecone (get more results if filtering by location)
      const fetchK = (slideRef || pageRef || sheetRef) ? topK * 3 : topK;
      console.time('3️⃣ Pinecone vector search');
      const pineconeStart = Date.now();
      let pineconeResults = await pineconeService.searchSimilarChunks(
        queryEmbedding,
        userId,
        fetchK,
        minSimilarity
      );
      const pineconeDuration = Date.now() - pineconeStart;
      console.timeEnd('3️⃣ Pinecone vector search');
      console.log(`   Pinecone query completed in ${pineconeDuration}ms`);
      console.log(`   Results found: ${pineconeResults.length}`);

      // 5. Apply location-based boosting
      console.time('4️⃣ Apply location boost & re-rank');
      if (slideRef || pageRef || sheetRef) {
        pineconeResults = pineconeResults.map((result: any) => {
          let boost = 0;
          const metadata = result.metadata || {};

          // Boost results that match the specified slide
          if (slideRef && metadata.slide === slideRef) {
            boost = 0.3; // Significant boost for exact slide match
            console.log(`   🎯 Boosting slide ${slideRef} match: "${result.document?.filename}"`);
          }

          // Boost results that match the specified page
          if (pageRef && metadata.page === pageRef) {
            boost = 0.3; // Significant boost for exact page match
            console.log(`   🎯 Boosting page ${pageRef} match: "${result.document?.filename}"`);
          }

          // Boost results that match the specified sheet
          if (sheetRef && metadata.sheet) {
            const normalizedSheet = String(metadata.sheet).toLowerCase().replace(/\s+/g, '');
            if (normalizedSheet === sheetRef.toLowerCase()) {
              boost = 0.3; // Significant boost for exact sheet match
              console.log(`   🎯 Boosting sheet ${sheetRef} match: "${result.document?.filename}"`);
            }
          }

          return {
            ...result,
            similarity: Math.min(1.0, (result.similarity || 0) + boost),
            originalSimilarity: result.similarity
          };
        });

        // Re-sort by boosted similarity
        pineconeResults.sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0));

        // Trim back to topK
        pineconeResults = pineconeResults.slice(0, topK);

        console.log(`   ✅ Re-ranked results with location boost`);
      }
      console.timeEnd('4️⃣ Apply location boost & re-rank');

      // 6. Process results
      console.time('5️⃣ Process results');
      if (pineconeResults.length > 0) {
        const topScore = Math.max(...pineconeResults.map((r: any) => r.similarity || 0));
        const avgScore = pineconeResults.reduce((sum: number, r: any) => sum + (r.similarity || 0), 0) / pineconeResults.length;
        const uniqueDocs = [...new Set(pineconeResults.map((r: any) => r.document?.filename || 'unknown'))];

        console.log(`   📊 Top score: ${topScore.toFixed(4)}`);
        console.log(`   📊 Avg score: ${avgScore.toFixed(4)}`);
        console.log(`   📊 Documents: ${uniqueDocs.join(', ')}`);

        // Log detailed results for debugging Excel retrieval
        console.log('\n   📄 DETAILED RESULTS:');
        pineconeResults.slice(0, 5).forEach((r: any, idx: number) => {
          console.log(`   ${idx + 1}. ${r.document?.filename || 'unknown'} (score: ${(r.similarity || 0).toFixed(4)})`);
          console.log(`      Metadata:`, JSON.stringify(r.metadata || {}, null, 2).split('\n').join('\n      '));
          console.log(`      Content preview: ${(r.content || '').substring(0, 100)}...`);
        });
      }
      console.timeEnd('5️⃣ Process results');

      const totalDuration = Date.now() - startTime;
      console.timeEnd('⏱️ [Total Search Time]');
      console.log(`\n📊 TIMING BREAKDOWN:`);
      console.log(`   Embedding:  ${embeddingDuration}ms`);
      console.log(`   Pinecone:   ${pineconeDuration}ms`);
      console.log(`   Other:      ${totalDuration - embeddingDuration - pineconeDuration}ms`);
      console.log(`   TOTAL:      ${totalDuration}ms`);
      console.log('=========================\n');

      if (pineconeResults.length > 0) {
        return pineconeResults;
      }

      console.log(`⚠️ [Pinecone] No results found`);
      return [];
    } catch (error) {
      console.error('Error searching similar chunks:', error);
      throw error;
    }
  }

  /**
   * Delete embeddings for a document from Pinecone
   * @param documentId - Document ID
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    try {
      await pineconeService.deleteDocumentEmbeddings(documentId);
      console.log(`Deleted embeddings for document ${documentId} from Pinecone`);
    } catch (error) {
      console.error('Error deleting document embeddings:', error);
      throw error;
    }
  }

  /**
   * Get statistics about embeddings from Pinecone
   */
  async getEmbeddingStats() {
    try {
      const stats = await pineconeService.getIndexStats();
      return {
        available: stats.available,
        totalVectorCount: stats.totalVectorCount || 0,
        dimension: stats.dimension || 768,
        indexFullness: stats.indexFullness || 0
      };
    } catch (error) {
      console.error('Error getting embedding stats:', error);
      throw error;
    }
  }
}

export default new VectorEmbeddingService();
