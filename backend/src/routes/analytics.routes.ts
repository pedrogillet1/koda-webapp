/**
 * Analytics Routes
 *
 * PURPOSE: Define API routes for admin analytics dashboard
 * BASE: /api/admin/analytics
 */

import { Router, Request, Response } from 'express';
import analyticsController from '../controllers/analytics.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { isAdmin, adminRateLimiter } from '../middleware/admin.middleware';
import { performanceMonitor } from '../services/performanceMonitor.service';
import { getCacheStats as getRagCacheStats } from '../services/ragOrchestrator.service';
import { getAllPerformanceStats } from '../utils/budgetEnforcer';

const router = Router();

// All analytics routes require authentication and admin privileges
// Apply rate limiting (100 requests per minute per admin)
router.use(authenticateToken);
router.use(isAdmin);
router.use(adminRateLimiter(60000, 100));

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYTICS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/overview
 * Get complete analytics overview (all metrics)
 */
router.get('/overview', analyticsController.getOverview);

/**
 * GET /api/admin/analytics/quick-stats
 * Get lightweight quick stats for dashboard header
 */
router.get('/quick-stats', analyticsController.getQuickStats);

/**
 * GET /api/admin/analytics/users
 * Get detailed user analytics
 */
router.get('/users', analyticsController.getUserAnalytics);

/**
 * GET /api/admin/analytics/conversations
 * Get detailed conversation analytics
 */
router.get('/conversations', analyticsController.getConversationAnalytics);

/**
 * GET /api/admin/analytics/documents
 * Get detailed document analytics
 */
router.get('/documents', analyticsController.getDocumentAnalytics);

/**
 * GET /api/admin/analytics/system-health
 * Get system health metrics
 */
router.get('/system-health', analyticsController.getSystemHealth);

/**
 * GET /api/admin/analytics/costs
 * Get cost analytics
 */
router.get('/costs', analyticsController.getCostAnalytics);

/**
 * GET /api/admin/analytics/feature-usage
 * Get feature usage analytics
 */
router.get('/feature-usage', analyticsController.getFeatureUsage);

// ═══════════════════════════════════════════════════════════════════════════
// HISTORICAL DATA ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/daily
 * Get daily stats for a date range
 * Query params: startDate, endDate (YYYY-MM-DD format)
 */
router.get('/daily', analyticsController.getDailyStats);

/**
 * GET /api/admin/analytics/comparison
 * Get period comparison (current vs previous)
 * Query params: period ('week' | 'month')
 */
router.get('/comparison', analyticsController.getPeriodComparison);

// ═══════════════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/cache-stats
 * Get cache statistics
 */
router.get('/cache-stats', analyticsController.getCacheStats);

/**
 * POST /api/admin/analytics/refresh
 * Force refresh cache (all or specific key)
 * Body: { key?: string }
 */
router.post('/refresh', analyticsController.refreshCache);

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/export
 * Export analytics data
 * Query params:
 *   - type: 'users' | 'conversations' | 'documents' | 'daily'
 *   - format: 'json' | 'csv'
 *   - startDate, endDate (for daily export)
 */
router.get('/export', analyticsController.exportData);

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/analytics/aggregate
 * Manually trigger aggregation job
 * Body: { type: 'daily' | 'weekly' | 'monthly' }
 */
router.post('/aggregate', analyticsController.runAggregation);

// ═══════════════════════════════════════════════════════════════════════════
// NEW: PERFORMANCE TRACKING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/rag-performance
 * Get RAG query performance metrics
 * Query params: days (default: 7)
 */
router.get('/rag-performance', analyticsController.getRAGPerformance);

/**
 * GET /api/admin/analytics/api-performance
 * Get API performance metrics
 * Query params: service, hours (default: 24)
 */
router.get('/api-performance', analyticsController.getAPIPerformance);

/**
 * GET /api/admin/analytics/feature-usage-stats
 * Get detailed feature usage statistics from tracking
 * Query params: days (default: 30)
 */
router.get('/feature-usage-stats', analyticsController.getFeatureUsageStats);

/**
 * GET /api/admin/analytics/conversations/:conversationId/feedback
 * Get feedback statistics for a specific conversation
 */
router.get('/conversations/:conversationId/feedback', analyticsController.getConversationFeedbackStats);

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN USAGE & COST ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/token-usage
 * Get token usage statistics
 * Query params: userId, startDate, endDate, groupBy (model|provider|requestType)
 */
router.get('/token-usage', analyticsController.getTokenUsage);

/**
 * GET /api/admin/analytics/token-usage/daily
 * Get daily token usage for cost trends
 * Query params: days (default: 30)
 */
router.get('/token-usage/daily', analyticsController.getDailyTokenUsage);

// ═══════════════════════════════════════════════════════════════════════════
// ERROR ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/errors
 * Get error statistics
 * Query params: days (default: 7)
 */
router.get('/errors', analyticsController.getErrorStats);

// ═══════════════════════════════════════════════════════════════════════════
// DAILY AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/daily-aggregates
 * Get pre-aggregated daily analytics
 * Query params: days (default: 30)
 */
router.get('/daily-aggregates', analyticsController.getDailyAnalyticsAggregates);

/**
 * POST /api/admin/analytics/aggregate-daily
 * Manually trigger daily aggregation
 * Body: { date?: string } - ISO date string, defaults to today
 */
router.post('/aggregate-daily', analyticsController.runDailyAggregation);

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME PERFORMANCE MONITORING (RAG Pipeline)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/analytics/performance/report
 * Get comprehensive performance report
 */
router.get('/performance/report', async (req: Request, res: Response) => {
  try {
    const report = performanceMonitor.getPerformanceReport();
    const ragCache = getRagCacheStats();
    const budgetStats = getAllPerformanceStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: {
        ...report,
        ragCache,
        budgetEnforcement: budgetStats,
      },
    });
  } catch (error: any) {
    console.error('[Performance Report] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate performance report',
    });
  }
});

/**
 * GET /api/admin/analytics/performance/cache
 * Get cache statistics
 */
router.get('/performance/cache', async (req: Request, res: Response) => {
  try {
    const performanceCache = performanceMonitor.getCacheStats();
    const ragCache = getRagCacheStats();

    res.json({
      success: true,
      cache: {
        performanceMonitor: performanceCache,
        ragOrchestrator: ragCache,
      },
    });
  } catch (error: any) {
    console.error('[Cache Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get cache statistics',
    });
  }
});

/**
 * GET /api/admin/analytics/performance/query-types
 * Get query type distribution
 */
router.get('/performance/query-types', async (req: Request, res: Response) => {
  try {
    const distribution = performanceMonitor.getQueryTypeDistribution();

    res.json({
      success: true,
      queryTypes: distribution,
    });
  } catch (error: any) {
    console.error('[Query Types] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get query type distribution',
    });
  }
});

/**
 * GET /api/admin/analytics/performance/latency
 * Get latency percentiles
 */
router.get('/performance/latency', async (req: Request, res: Response) => {
  try {
    const percentiles = performanceMonitor.getLatencyPercentiles();

    res.json({
      success: true,
      latency: percentiles,
    });
  } catch (error: any) {
    console.error('[Latency Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get latency percentiles',
    });
  }
});

/**
 * GET /api/admin/analytics/performance/slow-queries
 * Get recent slow queries
 * Query params: threshold (ms), limit
 */
router.get('/performance/slow-queries', async (req: Request, res: Response) => {
  try {
    const threshold = parseInt(req.query.threshold as string) || 5000;
    const limit = parseInt(req.query.limit as string) || 10;

    const slowQueries = performanceMonitor.getSlowQueries(threshold, limit);

    res.json({
      success: true,
      threshold,
      limit,
      slowQueries,
    });
  } catch (error: any) {
    console.error('[Slow Queries] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get slow queries',
    });
  }
});

/**
 * POST /api/admin/analytics/performance/reset
 * Reset performance statistics
 */
router.post('/performance/reset', async (req: Request, res: Response) => {
  try {
    performanceMonitor.resetStats();

    res.json({
      success: true,
      message: 'Performance statistics reset successfully',
    });
  } catch (error: any) {
    console.error('[Reset Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset statistics',
    });
  }
});

export default router;
