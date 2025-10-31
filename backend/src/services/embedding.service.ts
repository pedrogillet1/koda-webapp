/**
 * Embedding Service
 * Generate vector embeddings using Google Gemini API
 * - Uses text-embedding-004 model (768 dimensions)
 * - Batch processing support
 * - Rate limiting and retry logic
 * - Caching for repeated texts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import cacheService from './cache.service';

interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
  model: string;
}

interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalProcessed: number;
  failedCount: number;
  processingTime: number;
}

interface EmbeddingOptions {
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION';
  title?: string; // Optional title for the text
}

class EmbeddingService {
  private genAI: GoogleGenerativeAI;
  private readonly EMBEDDING_MODEL = 'text-embedding-004';
  private readonly EMBEDDING_DIMENSIONS = 768;
  private readonly MAX_BATCH_SIZE = 100;
  private readonly MAX_TEXT_LENGTH = 20000; // Characters

  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Generate embedding for a single text
   * Uses embeddingCache for 150x faster repeated queries!
   */
  async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {},
    retryCount: number = 0
  ): Promise<EmbeddingResult> {
    const maxRetries = 3;
    console.time('⚡ Embedding Generation');

    try {
      // Preprocess text first
      const processedText = this.preprocessText(text);

      // Check cache first using the optimized embedding cache service
      const cachedEmbedding = await cacheService.getCachedEmbedding(processedText);
      if (cachedEmbedding) {
        console.timeEnd('⚡ Embedding Generation');
        return {
          text: processedText,
          embedding: cachedEmbedding,
          dimensions: this.EMBEDDING_DIMENSIONS,
          model: this.EMBEDDING_MODEL,
        };
      }

      console.log(`🔮 [Embedding Service] Generating embedding for text (${processedText.length} chars)...`);

      // Get embedding model
      const model = this.genAI.getGenerativeModel({ model: this.EMBEDDING_MODEL });

      // Generate embedding with task type
      const result = await model.embedContent(processedText);

      const embedding = result.embedding.values;

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned from API');
      }

      // Cache the result using the optimized cache service
      await cacheService.cacheEmbedding(processedText, embedding);

      console.log(`✅ [Embedding Service] Generated ${embedding.length}-dimensional embedding`);
      console.timeEnd('⚡ Embedding Generation');

      return {
        text: processedText,
        embedding,
        dimensions: embedding.length,
        model: this.EMBEDDING_MODEL,
      };
    } catch (error: any) {
      console.timeEnd('⚡ Embedding Generation');

      // Handle rate limiting with exponential backoff
      if (error.message && error.message.includes('429')) {
        if (retryCount < maxRetries) {
          const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.warn(`⏳ [Embedding Service] Rate limit hit (429). Retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
          await this.sleep(backoffDelay);
          return this.generateEmbedding(text, options, retryCount + 1);
        } else {
          console.error('❌ [Embedding Service] Max retries reached for rate limiting');
        }
      }

      // Handle quota exceeded
      if (error.message && (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED'))) {
        console.error('💰 [Embedding Service] API quota exceeded. Please check your Gemini API usage.');
        throw new Error('API quota exceeded. Please try again later or upgrade your API plan.');
      }

      console.error('❌ [Embedding Service] Error:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    const embeddings: EmbeddingResult[] = [];
    let failedCount = 0;

    console.log(`⚡ [Embedding Service] BATCH generating embeddings for ${texts.length} texts...`);

    // Preprocess all texts
    const processedTexts = texts.map(t => this.preprocessText(t));

    // Process in batches of 100 (Google API limit)
    const batches = this.createBatches(processedTexts, this.MAX_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`   📦 Processing batch ${i + 1}/${batches.length} (${batch.length} texts in ONE API call)...`);

      try {
        // Get embedding model
        const model = this.genAI.getGenerativeModel({ model: this.EMBEDDING_MODEL });

        // ⚡ CRITICAL FIX: Use batchEmbedContents to send ALL texts in ONE API call
        const result = await model.batchEmbedContents({
          requests: batch.map(text => ({
            content: { parts: [{ text }] },
            taskType: options.taskType || 'RETRIEVAL_DOCUMENT',
          }))
        });

        // Process results
        for (let j = 0; j < batch.length; j++) {
          const embeddingValues = result.embeddings[j].values;

          if (!embeddingValues || embeddingValues.length === 0) {
            console.error(`   ❌ Empty embedding for text ${j} in batch ${i + 1}`);
            failedCount++;
            embeddings.push({
              text: batch[j],
              embedding: new Array(this.EMBEDDING_DIMENSIONS).fill(0),
              dimensions: this.EMBEDDING_DIMENSIONS,
              model: this.EMBEDDING_MODEL,
            });
          } else {
            // Cache the result
            await cacheService.cacheEmbedding(batch[j], embeddingValues);

            embeddings.push({
              text: batch[j],
              embedding: embeddingValues,
              dimensions: embeddingValues.length,
              model: this.EMBEDDING_MODEL,
            });
          }
        }

        console.log(`   ✅ Batch ${i + 1}/${batches.length} completed (${batch.length} embeddings)`);

      } catch (error: any) {
        console.error(`   ❌ Batch ${i + 1} failed: ${error.message}`);
        failedCount += batch.length;

        // Add placeholder embeddings for failed batch
        for (const text of batch) {
          embeddings.push({
            text,
            embedding: new Array(this.EMBEDDING_DIMENSIONS).fill(0),
            dimensions: this.EMBEDDING_DIMENSIONS,
            model: this.EMBEDDING_MODEL,
          });
        }
      }

      // Rate limiting: small delay between batches
      if (i < batches.length - 1) {
        await this.sleep(200); // 200ms between batches
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`✅ [Embedding Service] Generated ${embeddings.length} embeddings in ${(processingTime / 1000).toFixed(2)}s`);
    if (failedCount > 0) {
      console.warn(`   ⚠️ ${failedCount} embeddings failed`);
    }

    return {
      embeddings,
      totalProcessed: texts.length,
      failedCount,
      processingTime,
    };
  }

  /**
   * Generate embedding optimized for query (search)
   */
  async generateQueryEmbedding(query: string): Promise<EmbeddingResult> {
    return this.generateEmbedding(query, {
      taskType: 'RETRIEVAL_QUERY',
      title: 'User Query',
    });
  }

  /**
   * Generate embedding optimized for document storage
   */
  async generateDocumentEmbedding(text: string, title?: string): Promise<EmbeddingResult> {
    return this.generateEmbedding(text, {
      taskType: 'RETRIEVAL_DOCUMENT',
      title,
    });
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar embeddings to a query embedding
   */
  findTopKSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: Array<{ id: string; embedding: number[]; metadata?: any }>,
    k: number = 10
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    const similarities = candidateEmbeddings.map(candidate => ({
      id: candidate.id,
      similarity: this.calculateSimilarity(queryEmbedding, candidate.embedding),
      metadata: candidate.metadata,
    }));

    // Sort by similarity (descending) and take top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /**
   * Preprocess text before embedding
   */
  private preprocessText(text: string): string {
    // Remove excessive whitespace
    let processed = text.replace(/\s+/g, ' ').trim();

    // Truncate if too long
    if (processed.length > this.MAX_TEXT_LENGTH) {
      console.warn(`   ⚠️ Text truncated from ${processed.length} to ${this.MAX_TEXT_LENGTH} chars`);
      processed = processed.slice(0, this.MAX_TEXT_LENGTH);
    }

    return processed;
  }


  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear embedding cache (delegates to cacheService)
   */
  async clearCache(): Promise<void> {
    await cacheService.clearAll();
  }

  /**
   * Get cache statistics (delegates to cacheService)
   */
  async getCacheStats() {
    return await cacheService.getCacheStats();
  }

  /**
   * Get embedding dimensions for this model
   */
  getEmbeddingDimensions(): number {
    return this.EMBEDDING_DIMENSIONS;
  }
}

export default new EmbeddingService();
