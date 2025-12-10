/**
 * Koda Fast Cache Service
 *
 * In-memory caching for fast-path query responses.
 * Uses LRU eviction with configurable TTL.
 *
 * Cache keys are generated from:
 * - User ID
 * - Query intent
 * - Extracted entities (normalized)
 *
 * @version 1.0.0
 */

import type { FastPathIntentType, FastPathClassification } from './kodaFastPathIntent.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface CacheEntry {
  key: string;
  response: string;
  intent: FastPathIntentType;
  language: string;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessedAt: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsageBytes: number;
  oldestEntryAge: number;
}

export interface CacheConfig {
  maxEntries: number;
  defaultTTL: number;       // milliseconds
  cleanupInterval: number;  // milliseconds
  enableStats: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cache Configuration
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
  enableStats: true,
};

// TTL by intent type (some data changes more frequently)
const INTENT_TTL: Record<FastPathIntentType, number> = {
  FILE_LIST: 2 * 60 * 1000,       // 2 min - files can be added
  FILE_COUNT: 2 * 60 * 1000,      // 2 min
  FOLDER_PATH_QUERY: 10 * 60 * 1000, // 10 min - folders rarely change
  RECENT_ACTIVITY: 1 * 60 * 1000, // 1 min - activity is time-sensitive
  METADATA_QUERY: 5 * 60 * 1000,  // 5 min
  SIMPLE_FACT: 5 * 60 * 1000,     // 5 min
  GREETING: 60 * 60 * 1000,       // 1 hour - greetings don't change
  CALCULATION: 60 * 60 * 1000,    // 1 hour - calculations are deterministic
  APP_HELP: 60 * 60 * 1000,       // 1 hour - app help doesn't change
  MEMORY_CHECK: 1 * 60 * 1000,    // 1 min - memory is time-sensitive
  ERROR_EXPLANATION: 5 * 60 * 1000, // 5 min - errors may be context-dependent
  NONE: 0,                        // Don't cache
};

// ═══════════════════════════════════════════════════════════════════════════
// Cache Storage
// ═══════════════════════════════════════════════════════════════════════════

class FastCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
  };
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Key Generation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a cache key from user ID and classification
   */
  generateKey(
    userId: string,
    classification: FastPathClassification
  ): string {
    const parts = [
      userId,
      classification.intent,
      classification.language,
    ];

    // Add relevant entities to key
    const entities = classification.extractedEntities;
    if (entities.fileType) parts.push(`type:${entities.fileType}`);
    if (entities.folderName) parts.push(`folder:${entities.folderName.toLowerCase()}`);
    if (entities.fileName) parts.push(`file:${entities.fileName.toLowerCase()}`);
    if (entities.timeRange) parts.push(`time:${entities.timeRange}`);
    if (entities.limit) parts.push(`limit:${entities.limit}`);

    return parts.join('|');
  }

  /**
   * Generate a simple key from user ID and raw query
   */
  generateSimpleKey(userId: string, query: string): string {
    const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ');
    return `${userId}|${normalizedQuery}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cache Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a cached response
   */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.hitCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;

    return entry;
  }

  /**
   * Store a response in cache
   */
  set(
    key: string,
    response: string,
    intent: FastPathIntentType,
    language: string,
    ttl?: number
  ): void {
    // Don't cache NONE intent
    if (intent === 'NONE') return;

    // Use intent-specific TTL if not provided
    const finalTTL = ttl ?? INTENT_TTL[intent] ?? this.config.defaultTTL;
    if (finalTTL === 0) return;

    // Enforce max entries (LRU eviction)
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry = {
      key,
      response,
      intent,
      language,
      createdAt: now,
      expiresAt: now + finalTTL,
      hitCount: 0,
      lastAccessedAt: now,
    };

    this.cache.set(key, entry);
  }

  /**
   * Remove a specific entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries for a user
   */
  clearUser(userId: string): number {
    let cleared = 0;
    for (const [key] of this.cache) {
      if (key.startsWith(userId + '|')) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Eviction & Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Ensure timer doesn't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    let oldestAge = 0;
    let memoryUsage = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      const age = now - entry.createdAt;
      if (age > oldestAge) oldestAge = age;

      // Rough memory estimate: key + response + overhead
      memoryUsage += entry.key.length * 2;
      memoryUsage += entry.response.length * 2;
      memoryUsage += 100; // overhead per entry
    }

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate,
      memoryUsageBytes: memoryUsage,
      oldestEntryAge: oldestAge,
    };
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════

const fastCache = new FastCache();

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get cached response for a classification
 */
export function getCachedResponse(
  userId: string,
  classification: FastPathClassification
): string | null {
  const key = fastCache.generateKey(userId, classification);
  const entry = fastCache.get(key);
  return entry?.response ?? null;
}

/**
 * Cache a response
 */
export function cacheResponse(
  userId: string,
  classification: FastPathClassification,
  response: string
): void {
  const key = fastCache.generateKey(userId, classification);
  fastCache.set(key, response, classification.intent, classification.language);
}

/**
 * Get cached response by raw query
 */
export function getCachedByQuery(
  userId: string,
  query: string
): string | null {
  const key = fastCache.generateSimpleKey(userId, query);
  const entry = fastCache.get(key);
  return entry?.response ?? null;
}

/**
 * Cache response by raw query
 */
export function cacheByQuery(
  userId: string,
  query: string,
  response: string,
  intent: FastPathIntentType,
  language: string
): void {
  const key = fastCache.generateSimpleKey(userId, query);
  fastCache.set(key, response, intent, language);
}

/**
 * Invalidate cache for a user (call after data changes)
 */
export function invalidateUserCache(userId: string): number {
  return fastCache.clearUser(userId);
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  fastCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return fastCache.getStats();
}

/**
 * Check if cache has entry
 */
export function hasCache(userId: string, classification: FastPathClassification): boolean {
  const key = fastCache.generateKey(userId, classification);
  return fastCache.has(key);
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export default {
  getCachedResponse,
  cacheResponse,
  getCachedByQuery,
  cacheByQuery,
  invalidateUserCache,
  clearAllCache,
  getCacheStats,
  hasCache,
  INTENT_TTL,
};
