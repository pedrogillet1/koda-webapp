/**
 * Cache Service
 * Provides intelligent caching for embeddings, search results, and frequent queries
 */

import Redis from 'ioredis';
import crypto from 'crypto';

class CacheService {
  private redis: Redis;
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly EMBEDDING_TTL = 86400 * 7; // 7 days
  private readonly SEARCH_TTL = 1800; // 30 minutes
  private readonly ANSWER_TTL = 3600; // 1 hour

  constructor() {
    // Railway sets REDIS_URL, local dev uses REDIS_HOST/REDIS_PORT
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
    } else {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
    }

    this.redis.on('connect', () => {
      console.log('✅ Cache service connected to Redis');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
  }

  /**
   * Generate cache key from multiple arguments
   */
  generateKey(prefix: string, ...args: any[]): string {
    const dataString = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join('|');

    const hash = crypto
      .createHash('md5')
      .update(dataString)
      .digest('hex');

    return `${prefix}:${hash}`;
  }

  /**
   * Cache an embedding
   */
  async cacheEmbedding(text: string, embedding: number[]): Promise<void> {
    try {
      const key = this.generateKey('embedding', text);
      await this.redis.setex(
        key,
        this.EMBEDDING_TTL,
        JSON.stringify(embedding)
      );
      console.log(`💾 Cached embedding for text (length: ${text.length})`);
    } catch (error) {
      console.error('Error caching embedding:', error);
      // Don't throw - caching failures should not break the app
    }
  }

  /**
   * Get cached embedding
   */
  async getCachedEmbedding(text: string): Promise<number[] | null> {
    try {
      const key = this.generateKey('embedding', text);
      const cached = await this.redis.get(key);

      if (cached) {
        console.log(`✅ Cache hit for embedding (length: ${text.length})`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('Error getting cached embedding:', error);
      return null;
    }
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(
    userId: string,
    query: string,
    results: any[]
  ): Promise<void> {
    try {
      const key = this.generateKey('search', userId, query);
      await this.redis.setex(
        key,
        this.SEARCH_TTL,
        JSON.stringify(results)
      );
      console.log(`💾 Cached search results for query: "${query.substring(0, 50)}..."`);
    } catch (error) {
      console.error('Error caching search results:', error);
    }
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(
    userId: string,
    query: string
  ): Promise<any[] | null> {
    try {
      const key = this.generateKey('search', userId, query);
      const cached = await this.redis.get(key);

      if (cached) {
        console.log(`✅ Cache hit for search: "${query.substring(0, 50)}..."`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('Error getting cached search results:', error);
      return null;
    }
  }

  /**
   * Cache RAG answer
   */
  async cacheAnswer(
    userId: string,
    query: string,
    answer: any
  ): Promise<void> {
    try {
      const key = this.generateKey('answer', userId, query);
      await this.redis.setex(
        key,
        this.ANSWER_TTL,
        JSON.stringify(answer)
      );
      console.log(`💾 Cached answer for query: "${query.substring(0, 50)}..."`);
    } catch (error) {
      console.error('Error caching answer:', error);
    }
  }

  /**
   * Get cached answer
   */
  async getCachedAnswer(
    userId: string,
    query: string
  ): Promise<any | null> {
    try {
      const key = this.generateKey('answer', userId, query);
      const cached = await this.redis.get(key);

      if (cached) {
        console.log(`✅ Cache hit for answer: "${query.substring(0, 50)}..."`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('Error getting cached answer:', error);
      return null;
    }
  }

  /**
   * Cache query expansion results
   */
  async cacheQueryExpansion(
    query: string,
    expandedQueries: string[]
  ): Promise<void> {
    try {
      const key = this.generateKey('query_expansion', query);
      await this.redis.setex(
        key,
        this.SEARCH_TTL,
        JSON.stringify(expandedQueries)
      );
      console.log(`💾 Cached query expansion for: "${query.substring(0, 50)}..."`);
    } catch (error) {
      console.error('Error caching query expansion:', error);
    }
  }

  /**
   * Get cached query expansion
   */
  async getCachedQueryExpansion(query: string): Promise<string[] | null> {
    try {
      const key = this.generateKey('query_expansion', query);
      const cached = await this.redis.get(key);

      if (cached) {
        console.log(`✅ Cache hit for query expansion: "${query.substring(0, 50)}..."`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('Error getting cached query expansion:', error);
      return null;
    }
  }

  /**
   * Invalidate cache for a user (when they upload/delete documents)
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `*:*${userId}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Invalidated ${keys.length} cache entries for user ${userId}`);
      }
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }

  /**
   * Invalidate specific document cache
   */
  async invalidateDocumentCache(documentId: string): Promise<void> {
    try {
      const pattern = `*:*${documentId}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Invalidated ${keys.length} cache entries for document ${documentId}`);
      }
    } catch (error) {
      console.error('Error invalidating document cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    keys: number;
    memory: string;
    hitRate: number;
  }> {
    try {
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');

      // Parse info strings
      const keyspaceHits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
      const keyspaceMisses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
      const totalKeys = await this.redis.dbsize();
      const usedMemory = memory.match(/used_memory_human:(.+)/)?.[1] || 'Unknown';

      const hitRate = keyspaceHits + keyspaceMisses > 0
        ? (keyspaceHits / (keyspaceHits + keyspaceMisses)) * 100
        : 0;

      return {
        keys: totalKeys,
        memory: usedMemory,
        hitRate: Math.round(hitRate * 100) / 100
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        keys: 0,
        memory: 'Unknown',
        hitRate: 0
      };
    }
  }

  /**
   * Generic get method for any cache key
   */
  async get<T>(key: string, options?: { ttl?: number; useMemory?: boolean; useRedis?: boolean }): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        console.log(`✅ Cache hit for key: ${key.substring(0, 50)}...`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Error getting cached value:', error);
      return null;
    }
  }

  /**
   * Generic set method for any cache key
   */
  async set<T>(key: string, value: T, options?: { ttl?: number; useMemory?: boolean; useRedis?: boolean }): Promise<void> {
    try {
      const ttl = options?.ttl || this.DEFAULT_TTL;
      await this.redis.setex(key, ttl, JSON.stringify(value));
      console.log(`💾 Cached value for key: ${key.substring(0, 50)}... (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('Error caching value:', error);
      // Don't throw - caching failures should not break the app
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clearAll(): Promise<void> {
    try {
      await this.redis.flushdb();
      console.log('🗑️ Cleared all cache');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export default new CacheService();
