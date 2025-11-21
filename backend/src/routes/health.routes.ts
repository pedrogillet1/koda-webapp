import express from 'express';
import prisma from '../config/database';

const router = express.Router();

/**
 * General health check
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      database: 'disconnected'
    });
  }
});

/**
 * Stuck documents health check
 * Returns count of documents stuck in "processing" for > 10 minutes
 */
router.get('/health/stuck-documents', async (req, res) => {
  try {
    const STUCK_THRESHOLD = 10 * 60 * 1000; // 10 minutes
    const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD);

    const stuckDocuments = await prisma.document.findMany({
      where: {
        status: 'processing',
        updatedAt: {
          lt: stuckCutoff
        }
      },
      select: {
        id: true,
        filename: true,
        updatedAt: true
      }
    });

    const stuckCount = stuckDocuments.length;
    const status = stuckCount === 0 ? 'healthy' : 'warning';

    res.json({
      status,
      stuck_documents: stuckCount,
      threshold_minutes: 10,
      timestamp: new Date().toISOString(),
      documents: stuckDocuments.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        stuck_for_minutes: Math.floor(
          (Date.now() - new Date(doc.updatedAt).getTime()) / 1000 / 60
        )
      }))
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Document processing statistics
 */
router.get('/health/document-stats', async (req, res) => {
  try {
    const statusCounts = await prisma.document.groupBy({
      by: ['status'],
      _count: true
    });

    const stats: Record<string, number> = {};
    statusCounts.forEach(item => {
      stats[item.status] = item._count;
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      statistics: stats,
      total: Object.values(stats).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
