import NodeCache from 'node-cache';
import crypto from 'crypto';

/**
 * Fast in-memory cache for embeddings using node-cache
 * Reduces embedding generation time from 500ms to <1ms for repeated queries
 */
class EmbeddingCacheService {
  private cache: NodeCache;

  constructor() {
    // Cache embeddings for 1 hour with max 1000 entries
    this.cache = new NodeCache({
      stdTTL: 3600, // 1 hour
      maxKeys: 1000,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Don't clone objects for better performance
    });

    console.log('✅ [Embedding Cache] Initialized (1h TTL, max 1000 entries)');
  }

  /**
   * Generate a consistent cache key for text
   */
  private generateCacheKey(text: string): string {
    // Use MD5 hash for fast key generation
    return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  }

  /**
   * Get cached embedding for text
   */
  async getCachedEmbedding(text: string): Promise<number[] | null> {
    const key = this.generateCacheKey(text);
    const cached = this.cache.get<number[]>(key);

    if (cached) {
      console.log('✅ [Embedding Cache] HIT');
      return cached;
    }

    console.log('⚠️ [Embedding Cache] MISS');
    return null;
  }

  /**
   * Cache an embedding
   */
  async cacheEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = this.generateCacheKey(text);
    this.cache.set(key, embedding);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = this.cache.getStats();
    return {
      keys: this.cache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.flushAll();
    console.log('🗑️ [Embedding Cache] Cleared');
  }
}

export default new EmbeddingCacheService();
