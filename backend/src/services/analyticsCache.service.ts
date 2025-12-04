/**
 * Analytics Cache Service
 *
 * PURPOSE: Cache analytics data to avoid expensive database queries
 * STRATEGY: In-memory cache with configurable TTL, background refresh
 */

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  key: string;
}

interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  lastCleanup: Date | null;
  memoryUsageEstimate: string;
}

class AnalyticsCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;
  private lastCleanup: Date | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Default TTLs for different data types
  private readonly TTL_CONFIG = {
    overview: 5 * 60 * 1000,        // 5 minutes
    users: 5 * 60 * 1000,           // 5 minutes
    conversations: 5 * 60 * 1000,   // 5 minutes
    documents: 5 * 60 * 1000,       // 5 minutes
    'system-health': 1 * 60 * 1000, // 1 minute (more frequent for health)
    costs: 10 * 60 * 1000,          // 10 minutes (costs don't change often)
    'feature-usage': 5 * 60 * 1000, // 5 minutes
    'quick-stats': 1 * 60 * 1000,   // 1 minute
    default: 5 * 60 * 1000          // 5 minutes default
  };

  constructor() {
    // Start automatic cleanup every 10 minutes
    this.startAutoCleanup();
    console.log('📦 [ANALYTICS CACHE] Initialized');
  }

  /**
   * Get cached data or null if expired/missing
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      console.log(`📦 [CACHE MISS] ${key}`);
      return null;
    }

    const now = new Date();
    if (now > entry.expiresAt) {
      // Expired, remove from cache
      this.cache.delete(key);
      this.missCount++;
      console.log(`📦 [CACHE EXPIRED] ${key}`);
      return null;
    }

    this.hitCount++;
    const ageSeconds = Math.round((now.getTime() - entry.timestamp.getTime()) / 1000);
    console.log(`📦 [CACHE HIT] ${key} (age: ${ageSeconds}s)`);
    return entry.data as T;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.getTTLForKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
      key
    });

    const ttlSeconds = Math.round(ttl / 1000);
    console.log(`📦 [CACHE SET] ${key} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Get appropriate TTL for a cache key
   */
  private getTTLForKey(key: string): number {
    // Check for exact match first
    if (key in this.TTL_CONFIG) {
      return this.TTL_CONFIG[key as keyof typeof this.TTL_CONFIG];
    }

    // Check for prefix match
    for (const [prefix, ttl] of Object.entries(this.TTL_CONFIG)) {
      if (key.startsWith(prefix)) {
        return ttl;
      }
    }

    return this.TTL_CONFIG.default;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = new Date();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get time remaining until expiration (in seconds)
   */
  getTTLRemaining(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = new Date();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return Math.round((entry.expiresAt.getTime() - now.getTime()) / 1000);
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    if (existed) {
      console.log(`📦 [CACHE INVALIDATE] ${key}`);
    }
    return existed;
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      console.log(`📦 [CACHE INVALIDATE PATTERN] ${pattern} (${count} keys)`);
    }
    return count;
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`📦 [CACHE INVALIDATE ALL] Cleared ${count} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = new Date();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now <= entry.expiresAt) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    const totalHits = this.hitCount + this.missCount;
    const hitRate = totalHits > 0
      ? Math.round((this.hitCount / totalHits) * 10000) / 100
      : 0;

    // Rough memory estimate
    let memoryBytes = 0;
    for (const entry of this.cache.values()) {
      memoryBytes += JSON.stringify(entry.data).length * 2; // UTF-16
    }
    const memoryUsageEstimate = memoryBytes < 1024
      ? `${memoryBytes} bytes`
      : memoryBytes < 1024 * 1024
        ? `${Math.round(memoryBytes / 1024)} KB`
        : `${Math.round(memoryBytes / (1024 * 1024) * 100) / 100} MB`;

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      lastCleanup: this.lastCleanup,
      memoryUsageEstimate
    };
  }

  /**
   * Get all cached keys with their expiration status
   */
  getKeys(): Array<{ key: string; expiresIn: number; isExpired: boolean }> {
    const now = new Date();
    const keys: Array<{ key: string; expiresIn: number; isExpired: boolean }> = [];

    for (const [key, entry] of this.cache.entries()) {
      const expiresIn = Math.round((entry.expiresAt.getTime() - now.getTime()) / 1000);
      keys.push({
        key,
        expiresIn,
        isExpired: expiresIn <= 0
      });
    }

    return keys.sort((a, b) => a.expiresIn - b.expiresIn);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.lastCleanup = now;

    if (cleaned > 0) {
      console.log(`📦 [CACHE CLEANUP] Removed ${cleaned} expired entries`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    // Clean up every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);

    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop automatic cleanup (for graceful shutdown)
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('📦 [ANALYTICS CACHE] Auto-cleanup stopped');
    }
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    console.log('📦 [CACHE STATS RESET]');
  }

  /**
   * Warm up cache with common queries
   */
  async warmup(fetchFunctions: Record<string, () => Promise<any>>): Promise<void> {
    console.log('📦 [CACHE WARMUP] Starting...');

    const results = await Promise.allSettled(
      Object.entries(fetchFunctions).map(async ([key, fetchFn]) => {
        try {
          const data = await fetchFn();
          this.set(key, data);
          return { key, success: true };
        } catch (error) {
          console.error(`📦 [CACHE WARMUP ERROR] ${key}:`, error);
          return { key, success: false, error };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - successful;

    console.log(`📦 [CACHE WARMUP] Complete: ${successful} succeeded, ${failed} failed`);
  }

  /**
   * Get or fetch - returns cached data or fetches fresh data
   */
  async getOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttlMs?: number): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Cache it
    this.set(key, data, ttlMs);

    return data;
  }
}

// Singleton instance
const analyticsCache = new AnalyticsCache();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  analyticsCache.stopAutoCleanup();
});

process.on('SIGINT', () => {
  analyticsCache.stopAutoCleanup();
});

export default analyticsCache;
export { AnalyticsCache, CacheStats };
