/**
 * Performance Monitor Service
 *
 * Centralized performance tracking and monitoring for Koda RAG pipeline.
 *
 * Features:
 * - Real-time latency tracking
 * - Query type distribution
 * - Cache hit/miss rates
 * - Percentile calculations (P50, P95, P99)
 * - Historical trend analysis
 */

interface PerformanceMetric {
  context: string;
  operation: string;
  latency: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  count: number;
  avg: number;
  median: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  recentLatencies: number[];
}

// Metric storage
const metrics: PerformanceMetric[] = [];
const MAX_METRICS = 10000; // Keep last 10k metrics

// Cache stats
const cacheStats = {
  l1: { hits: 0, misses: 0 },
  l2: { hits: 0, misses: 0 },
};

// Query type counts
const queryTypeCounts: Map<string, number> = new Map();

// Latency thresholds for alerting
const LATENCY_THRESHOLDS: Record<string, number> = {
  L1_CACHE: 10,
  L2_CACHE: 100,
  INTENT_DETECTION: 500,
  RAG_RETRIEVAL: 2000,
  RAG_GENERATION: 5000,
  TOTAL_REQUEST: 8000,
};

/**
 * Record a performance metric
 */
export function recordMetric(
  context: string,
  operation: string,
  latency: number,
  metadata?: Record<string, any>
): void {
  const metric: PerformanceMetric = {
    context,
    operation,
    latency,
    timestamp: Date.now(),
    metadata,
  };

  metrics.push(metric);

  // Keep only last N metrics
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }

  // Log slow operations
  const threshold = LATENCY_THRESHOLDS[operation] || 1000;
  if (latency > threshold) {
    console.warn(
      `⚠️ [PERF] Slow ${operation} in ${context}: ${latency}ms (threshold: ${threshold}ms)`
    );
  }
}

/**
 * Record cache hit/miss
 */
export function recordCacheEvent(level: 'l1' | 'l2', hit: boolean): void {
  if (hit) {
    cacheStats[level].hits++;
  } else {
    cacheStats[level].misses++;
  }
}

/**
 * Record query type
 */
export function recordQueryType(type: string): void {
  const count = queryTypeCounts.get(type) || 0;
  queryTypeCounts.set(type, count + 1);
}

/**
 * Get statistics for a specific context/operation
 */
export function getStats(context: string, operation?: string): PerformanceStats | null {
  let filtered = metrics.filter((m) => m.context === context);

  if (operation) {
    filtered = filtered.filter((m) => m.operation === operation);
  }

  if (filtered.length === 0) {
    return null;
  }

  const latencies = filtered.map((m) => m.latency).sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);

  return {
    count: latencies.length,
    avg: Math.round(sum / latencies.length),
    median: latencies[Math.floor(latencies.length * 0.5)],
    p50: latencies[Math.floor(latencies.length * 0.5)],
    p95: latencies[Math.floor(latencies.length * 0.95)],
    p99: latencies[Math.floor(latencies.length * 0.99)],
    min: latencies[0],
    max: latencies[latencies.length - 1],
    recentLatencies: latencies.slice(-10), // Last 10
  };
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const l1Total = cacheStats.l1.hits + cacheStats.l1.misses;
  const l2Total = cacheStats.l2.hits + cacheStats.l2.misses;

  return {
    l1: {
      hits: cacheStats.l1.hits,
      misses: cacheStats.l1.misses,
      total: l1Total,
      hitRate: l1Total > 0 ? ((cacheStats.l1.hits / l1Total) * 100).toFixed(2) + '%' : '0%',
    },
    l2: {
      hits: cacheStats.l2.hits,
      misses: cacheStats.l2.misses,
      total: l2Total,
      hitRate: l2Total > 0 ? ((cacheStats.l2.hits / l2Total) * 100).toFixed(2) + '%' : '0%',
    },
  };
}

/**
 * Get query type distribution
 */
export function getQueryTypeDistribution() {
  const total = Array.from(queryTypeCounts.values()).reduce((a, b) => a + b, 0);

  const distribution: Record<string, { count: number; percentage: string }> = {};
  queryTypeCounts.forEach((count, type) => {
    distribution[type] = {
      count,
      percentage: ((count / total) * 100).toFixed(2) + '%',
    };
  });

  return distribution;
}

/**
 * Get comprehensive performance report
 */
export function getPerformanceReport() {
  return {
    cache: getCacheStats(),
    queryTypes: getQueryTypeDistribution(),
    operations: {
      l1Cache: getStats('CACHE', 'L1_CACHE'),
      l2Cache: getStats('CACHE', 'L2_CACHE'),
      intentDetection: getStats('RAG', 'INTENT_DETECTION'),
      ragRetrieval: getStats('RAG', 'RAG_RETRIEVAL'),
      ragGeneration: getStats('RAG', 'RAG_GENERATION'),
      totalRequest: getStats('RAG', 'TOTAL_REQUEST'),
    },
    summary: {
      totalRequests: metrics.length,
      timeRange: {
        start: metrics[0]?.timestamp || 0,
        end: metrics[metrics.length - 1]?.timestamp || 0,
      },
    },
  };
}

/**
 * Get latency percentiles for all contexts
 */
export function getLatencyPercentiles(): Record<string, { p50: number; p95: number; p99: number }> {
  const contexts = new Set(metrics.map((m) => m.context));
  const result: Record<string, { p50: number; p95: number; p99: number }> = {};

  contexts.forEach((context) => {
    const stats = getStats(context);
    if (stats) {
      result[context] = {
        p50: stats.p50,
        p95: stats.p95,
        p99: stats.p99,
      };
    }
  });

  return result;
}

/**
 * Get recent slow queries
 */
export function getSlowQueries(threshold: number = 5000, limit: number = 10): PerformanceMetric[] {
  return metrics
    .filter((m) => m.latency > threshold)
    .sort((a, b) => b.latency - a.latency)
    .slice(0, limit);
}

/**
 * Reset all statistics
 */
export function resetStats(): void {
  metrics.length = 0;
  cacheStats.l1 = { hits: 0, misses: 0 };
  cacheStats.l2 = { hits: 0, misses: 0 };
  queryTypeCounts.clear();
}

/**
 * Export for use in routes
 */
export const performanceMonitor = {
  recordMetric,
  recordCacheEvent,
  recordQueryType,
  getStats,
  getCacheStats,
  getQueryTypeDistribution,
  getPerformanceReport,
  getLatencyPercentiles,
  getSlowQueries,
  resetStats,
};
