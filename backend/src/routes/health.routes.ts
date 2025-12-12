import express from 'express';
import prisma from '../config/database';
import { DATA_DIR, verifyAllDataFiles, REQUIRED_DATA_FILES } from '../config/dataPaths';
import { isContainerReady } from '../middleware/containerGuard.middleware';

const router = express.Router();

/**
 * General health check
 * Now includes container initialization status
 */
router.get('/health', async (req, res) => {
  try {
    // Check container initialization (critical for V3 services)
    const containerInitialized = isContainerReady();

    // Check database connection
    let dbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    // Overall health: both container and DB must be ready
    const isHealthy = containerInitialized && dbConnected;
    const httpStatus = isHealthy ? 200 : 503;

    res.status(httpStatus).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        container: containerInitialized ? 'initialized' : 'NOT_INITIALIZED',
        database: dbConnected ? 'connected' : 'disconnected',
      },
      // Include details if unhealthy
      ...(isHealthy ? {} : {
        issues: [
          ...(!containerInitialized ? ['Service container not initialized - V3 services unavailable'] : []),
          ...(!dbConnected ? ['Database connection failed'] : []),
        ],
      }),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        container: 'unknown',
        database: 'unknown',
      },
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

/**
 * Data files health check
 * Returns status of all required JSON data files
 */
router.get('/health/data-health', async (_req, res) => {
  try {
    const { ok, problems } = verifyAllDataFiles();

    const status = problems.length === 0 ? 'healthy' : 'unhealthy';
    const httpStatus = problems.length === 0 ? 200 : 503;

    res.status(httpStatus).json({
      status,
      timestamp: new Date().toISOString(),
      dataDir: DATA_DIR,
      totalFiles: REQUIRED_DATA_FILES.length,
      okFiles: ok.length,
      problemFiles: problems.length,
      files: {
        ok,
        problems: problems.map(p => ({
          file: p.file,
          error: p.error,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
