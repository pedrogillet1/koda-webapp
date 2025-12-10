/**
 * Cache Manager Service - A+ Implementation
 * Provides a unified caching layer (Redis or in-memory fallback)
 *
 * Features:
 * - Abstracted interface (pluggable backend)
 * - Automatic JSON serialization/deserialization
 * - TTL support
 * - Graceful fallback to in-memory cache if Redis fails
 */

import { logger, logError } from './logger.service';

// In-memory cache for fallback (and when Redis isn't configured)
const memoryCache = new Map<string, { value: string; expires: number }>();

let redisClient: any = null;
let isRedisConnected = false;

// Try to initialize Redis if available
async function initializeRedis() {
  if (process.env.REDIS_URL) {
    try {
      const Redis = (await import('ioredis')).default;
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      redisClient.on('connect', () => {
        isRedisConnected = true;
        logger.info({ service: 'CacheManager' }, 'Connected to Redis');
      });

      redisClient.on('error', (err: Error) => {
        isRedisConnected = false;
        logger.warn({ service: 'CacheManager', error: err.message }, 'Redis connection error, using memory cache');
      });
    } catch (error) {
      logger.info({ service: 'CacheManager' }, 'Redis not available, using memory cache');
    }
  }
}

// Initialize on module load
initializeRedis().catch(() => {});

/**
 * Get a value from the cache (Redis first, then memory)
 */
async function get<T>(key: string): Promise<T | null> {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (error) {
      logError(error as Error, { key }, 'Redis GET failed');
      isRedisConnected = false;
    }
  }

  // Fallback to memory cache
  const memData = memoryCache.get(key);
  if (memData && memData.expires > Date.now()) {
    return JSON.parse(memData.value) as T;
  }

  return null;
}

/**
 * Set a value in the cache
 */
async function set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const stringValue = JSON.stringify(value);

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, stringValue, 'EX', ttlSeconds);
      return;
    } catch (error) {
      logError(error as Error, { key }, 'Redis SET failed');
      isRedisConnected = false;
    }
  }

  // Fallback to memory cache
  memoryCache.set(key, {
    value: stringValue,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate a key from the cache
 */
async function invalidate(key: string): Promise<void> {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logError(error as Error, { key }, 'Redis DEL failed');
      isRedisConnected = false;
    }
  }

  memoryCache.delete(key);
}

/**
 * Clean up expired items from memory cache (run periodically)
 */
function cleanupMemoryCache() {
  const now = Date.now();
  const keys = Array.from(memoryCache.keys());
  for (const key of keys) {
    const value = memoryCache.get(key);
    if (value && value.expires <= now) {
      memoryCache.delete(key);
    }
  }
}

// Periodically clean memory cache
setInterval(cleanupMemoryCache, 60 * 1000);

export const cacheManager = {
  get,
  set,
  invalidate,
};
