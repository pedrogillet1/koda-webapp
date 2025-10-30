import Redis from 'ioredis';
import crypto from 'crypto';

/**
 * Response Cache Service - Caches LLM responses for instant retrieval
 * Target: Instant response for repeated queries (cache hit = <100ms)
 */
class ResponseCacheService {
  private redis: Redis | null = null;
  private isAvailable = false;

  constructor() {
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379');

      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('⚠️ [Response Cache] Redis unavailable - cache disabled');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000);
        },
      });

      this.redis.on('connect', () => {
        this.isAvailable = true;
        console.log('✅ [Response Cache] Connected to Redis');
      });

      this.redis.on('error', (err) => {
        this.isAvailable = false;
        console.warn('⚠️ [Response Cache] Redis error:', err.message);
      });
    } catch (error) {
      console.warn('⚠️ [Response Cache] Failed to initialize Redis');
      this.isAvailable = false;
    }
  }

  /**
   * Generate cache key from query and document context
   */
  private generateCacheKey(query: string, documentId?: string): string {
    const normalized = query.trim().toLowerCase();
    const keyData = documentId ? `${normalized}:${documentId}` : normalized;
    return `response:${crypto.createHash('md5').update(keyData).digest('hex')}`;
  }

  /**
   * Get cached response
   * @param query - User query
   * @param documentId - Optional document ID for context-specific caching
   * @returns Cached response or null
   */
  async getCachedResponse(query: string, documentId?: string): Promise<string | null> {
    if (!this.isAvailable || !this.redis) {
      return null;
    }

    try {
      const key = this.generateCacheKey(query, documentId);
      const cached = await this.redis.get(key);

      if (cached) {
        console.log('✅ [Response Cache] HIT - Instant response!');
        return cached;
      }

      console.log('⚠️ [Response Cache] MISS');
      return null;
    } catch (error) {
      console.error('❌ [Response Cache] Error getting cached response:', error);
      return null;
    }
  }

  /**
   * Cache a response
   * @param query - User query
   * @param response - LLM response
   * @param documentId - Optional document ID
   * @param ttl - Time to live in seconds (default: 1 hour)
   */
  async cacheResponse(
    query: string,
    response: string,
    documentId?: string,
    ttl: number = 3600
  ): Promise<void> {
    if (!this.isAvailable || !this.redis) {
      return;
    }

    try {
      const key = this.generateCacheKey(query, documentId);
      await this.redis.setex(key, ttl, response);
      console.log('💾 [Response Cache] Cached response (TTL: 1h)');
    } catch (error) {
      console.error('❌ [Response Cache] Error caching response:', error);
    }
  }

  /**
   * Invalidate cache for a specific document
   * @param documentId - Document ID
   */
  async invalidateDocumentCache(documentId: string): Promise<void> {
    if (!this.isAvailable || !this.redis) {
      return;
    }

    try {
      // Get all keys matching the document pattern
      const pattern = `response:*:${documentId}`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ [Response Cache] Invalidated ${keys.length} cached responses for document`);
      }
    } catch (error) {
      console.error('❌ [Response Cache] Error invalidating cache:', error);
    }
  }

  /**
   * Clear all cached responses
   */
  async clearAll(): Promise<void> {
    if (!this.isAvailable || !this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys('response:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ [Response Cache] Cleared ${keys.length} cached responses`);
      }
    } catch (error) {
      console.error('❌ [Response Cache] Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalKeys: number; isAvailable: boolean }> {
    if (!this.isAvailable || !this.redis) {
      return { totalKeys: 0, isAvailable: false };
    }

    try {
      const keys = await this.redis.keys('response:*');
      return {
        totalKeys: keys.length,
        isAvailable: this.isAvailable,
      };
    } catch (error) {
      return { totalKeys: 0, isAvailable: false };
    }
  }
}

export default new ResponseCacheService();
