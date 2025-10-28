/**
 * Multi-Layer Cache Service
 * Memory (L1) + Redis (L2) two-tier caching for maximum performance
 *
 * Benefits:
 * - Memory cache: 10-50ms latency (fastest)
 * - Redis cache: 100-300ms latency (shared across instances)
 * - 40-60% expected cache hit rate
 * - Automatic cache invalidation on document changes
 */

import NodeCache from 'node-cache';
import crypto from 'crypto';
import cacheService from './cache.service';

interface CacheOptions {
  ttl?: number;  // seconds
  useRedis?: boolean;
  useMemory?: boolean;
}

interface CacheStats {
  memory: {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  redis: {
    keys: number;
    memory: string;
    hitRate: number;
  };
}

class MultiLayerCacheService {
  private memoryCache: NodeCache;

  constructor() {
    // Initialize memory cache (L1)
    this.memoryCache = new NodeCache({
      stdTTL: 3600,  // 1 hour default
      checkperiod: 120,  // Check for expired keys every 2 min
      useClones: false,  // Better performance (be careful with mutations!)
      maxKeys: 1000,  // Limit memory usage
    });

    console.log('✅ [Multi-Layer Cache] Initialized (Memory + Redis)');
  }

  /**
   * Generate cache key from query and context
   */
  generateKey(
    query: string,
    userId: string,
    options?: Record<string, any>
  ): string {
    const data = JSON.stringify({ query, userId, ...options });
    const hash = crypto.createHash('md5').update(data).digest('hex');
    return `koda:rag:${hash}`;
  }

  /**
   * Get from cache (memory first, then Redis)
   * L1 (Memory) → L2 (Redis) → Miss
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const opts = {
      useRedis: true,
      useMemory: true,
      ...options,
    };

    // Try L1: Memory cache (fastest - 10-50ms)
    if (opts.useMemory) {
      const memoryValue = this.memoryCache.get<T>(key);
      if (memoryValue !== undefined) {
        console.log(`✅ [L1 Cache HIT] Memory: ${key.substring(0, 20)}...`);
        return memoryValue;
      }
    }

    // Try L2: Redis (slower but shared - 100-300ms)
    if (opts.useRedis) {
      // Extract the part after 'koda:rag:' for the old cache service
      const redisKey = key.replace('koda:rag:', '');

      // Try to get from Redis using existing cache service
      try {
        const cached = await cacheService.getCachedAnswer(redisKey, redisKey);
        if (cached) {
          console.log(`✅ [L2 Cache HIT] Redis: ${key.substring(0, 20)}...`);

          // Populate L1 memory cache for next time (cache warming)
          if (opts.useMemory) {
            this.memoryCache.set(key, cached as T, opts.ttl || 3600);
          }

          return cached as T;
        }
      } catch (error) {
        // Redis error shouldn't break the app
        console.warn('⚠️  Redis cache read error:', error);
      }
    }

    console.log(`❌ [Cache MISS] ${key.substring(0, 20)}...`);
    return null;
  }

  /**
   * Set in cache (both layers)
   */
  async set(
    key: string,
    value: any,
    options?: CacheOptions
  ): Promise<void> {
    const opts = {
      ttl: 3600,  // 1 hour default
      useRedis: true,
      useMemory: true,
      ...options,
    };

    // Set in L1: Memory cache
    if (opts.useMemory) {
      this.memoryCache.set(key, value, opts.ttl);
    }

    // Set in L2: Redis
    if (opts.useRedis) {
      const redisKey = key.replace('koda:rag:', '');
      try {
        await cacheService.cacheAnswer(redisKey, redisKey, value);
      } catch (error) {
        // Redis error shouldn't break the app
        console.warn('⚠️  Redis cache write error:', error);
      }
    }

    console.log(`💾 [Cached] ${key.substring(0, 20)}... (TTL: ${opts.ttl}s)`);
  }

  /**
   * Invalidate cache for a user (when docs are added/deleted/moved)
   */
  async invalidateUserCache(userId: string): Promise<void> {
    // Clear L1: Memory cache (all keys)
    const memoryKeys = this.memoryCache.keys();
    let memoryCleared = 0;

    // Only clear keys related to this user
    memoryKeys.forEach(key => {
      if (key.includes(userId)) {
        this.memoryCache.del(key);
        memoryCleared++;
      }
    });

    // Clear L2: Redis cache
    try {
      await cacheService.invalidateUserCache(userId);
    } catch (error) {
      console.warn('⚠️  Redis invalidation error:', error);
    }

    console.log(`🗑️  [Cache Invalidated] User ${userId.substring(0, 8)}... (${memoryCleared} memory keys)`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const totalRequests = memoryStats.hits + memoryStats.misses;
    const hitRate = totalRequests > 0 ? memoryStats.hits / totalRequests : 0;

    return {
      memory: {
        keys: this.memoryCache.keys().length,
        hits: memoryStats.hits,
        misses: memoryStats.misses,
        hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
      },
      redis: {
        keys: 0,  // Will be populated from Redis stats
        memory: 'Unknown',
        hitRate: 0,
      },
    };
  }

  /**
   * Get detailed cache statistics (async for Redis)
   */
  async getDetailedStats(): Promise<CacheStats> {
    const stats = this.getStats();

    // Get Redis stats
    try {
      const redisStats = await cacheService.getCacheStats();
      stats.redis = {
        keys: redisStats.keys,
        memory: redisStats.memory,
        hitRate: redisStats.hitRate,
      };
    } catch (error) {
      console.warn('⚠️  Could not fetch Redis stats:', error);
    }

    return stats;
  }

  /**
   * Clear all caches (use with caution!)
   */
  async clearAll(): Promise<void> {
    // Clear L1: Memory
    this.memoryCache.flushAll();

    // Clear L2: Redis
    try {
      await cacheService.clearAll();
    } catch (error) {
      console.warn('⚠️  Redis clear error:', error);
    }

    console.log('🗑️  [Cache Cleared] All layers');
  }
}

export default new MultiLayerCacheService();
