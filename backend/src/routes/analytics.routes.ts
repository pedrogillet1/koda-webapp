/**
 * Analytics Routes
 *
 * PURPOSE: Define API routes for admin analytics dashboard
 * BASE: /api/admin/analytics
 */

import { Router } from 'express';
import analyticsController from '../controllers/analytics.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { isAdmin, adminRateLimiter } from '../middleware/admin.middleware';

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

export default router;
