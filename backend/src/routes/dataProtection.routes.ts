import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission, requireRole } from '../middleware/permission.middleware';
import gdprService from '../services/gdpr.service';
import dataRetentionService from '../services/dataRetention.service';
import backupEncryptionService from '../services/backupEncryption.service';
import keyRotationService from '../services/keyRotation.service';
import piiService from '../services/pii.service';

const router = Router();

// All data protection routes require authentication
router.use(authenticateToken);

/**
 * GDPR COMPLIANCE ENDPOINTS
 */

/**
 * POST /api/data-protection/gdpr/export
 * Export all user data (Right to Access / Data Portability)
 */
router.post('/gdpr/export', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { format = 'json', includeDocuments = false } = req.body;

    const result = await gdprService.exportUserData({
      userId: req.user.id,
      format,
      includeDocuments,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json({
      message: 'Data export initiated',
      exportId: result.exportId,
      downloadUrl: result.downloadUrl,
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * POST /api/data-protection/gdpr/delete
 * Delete all user data (Right to Erasure / Right to be Forgotten)
 */
router.post('/gdpr/delete', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason, confirmDeletion } = req.body;

    if (!confirmDeletion) {
      return res.status(400).json({
        error: 'Deletion confirmation required',
        message: 'Please confirm deletion by setting confirmDeletion: true',
      });
    }

    const result = await gdprService.deleteUserData({
      userId: req.user.id,
      reason,
      requestedBy: req.user.id,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json({
      message: 'User data deleted successfully',
      deletedData: result.deletedData,
    });
  } catch (error) {
    console.error('Error deleting user data:', error);
    return res.status(500).json({ error: 'Failed to delete data' });
  }
});

/**
 * GET /api/data-protection/gdpr/compliance-report
 * Get GDPR compliance report for current user
 */
router.get('/gdpr/compliance-report', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const report = await gdprService.getComplianceReport(req.user.id);
    return res.json(report);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    return res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

/**
 * POST /api/data-protection/gdpr/consent
 * Record user consent
 */
router.post('/gdpr/consent', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { consentType, version } = req.body;

    if (!consentType || !version) {
      return res.status(400).json({ error: 'consentType and version are required' });
    }

    const success = await gdprService.recordConsent(req.user.id, consentType, version);

    if (!success) {
      return res.status(500).json({ error: 'Failed to record consent' });
    }

    return res.json({ message: 'Consent recorded successfully' });
  } catch (error) {
    console.error('Error recording consent:', error);
    return res.status(500).json({ error: 'Failed to record consent' });
  }
});

/**
 * DATA RETENTION ENDPOINTS
 */

/**
 * GET /api/data-protection/retention/stats
 * Get data retention statistics (admin only)
 */
router.get(
  '/retention/stats',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const stats = await dataRetentionService.getRetentionStats();
      return res.json(stats);
    } catch (error) {
      console.error('Error fetching retention stats:', error);
      return res.status(500).json({ error: 'Failed to fetch retention stats' });
    }
  }
);

/**
 * GET /api/data-protection/retention/policies
 * Get all retention policies (admin only)
 */
router.get(
  '/retention/policies',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const policies = dataRetentionService.getAllPolicies();
      return res.json({ policies });
    } catch (error) {
      console.error('Error fetching retention policies:', error);
      return res.status(500).json({ error: 'Failed to fetch retention policies' });
    }
  }
);

/**
 * POST /api/data-protection/retention/cleanup
 * Manually trigger cleanup for specific data type (admin only)
 */
router.post(
  '/retention/cleanup',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { dataType } = req.body;

      if (!dataType) {
        return res.status(400).json({ error: 'dataType is required' });
      }

      const result = await dataRetentionService.cleanupDataType(dataType);

      return res.json({
        message: 'Cleanup completed',
        result,
      });
    } catch (error) {
      console.error('Error running cleanup:', error);
      return res.status(500).json({ error: 'Failed to run cleanup' });
    }
  }
);

/**
 * POST /api/data-protection/retention/cleanup-all
 * Run all cleanup tasks (admin only)
 */
router.post(
  '/retention/cleanup-all',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const results = await dataRetentionService.runAllCleanupTasks();

      return res.json({
        message: 'All cleanup tasks completed',
        results,
      });
    } catch (error) {
      console.error('Error running all cleanup tasks:', error);
      return res.status(500).json({ error: 'Failed to run cleanup tasks' });
    }
  }
);

/**
 * BACKUP ENDPOINTS
 */

/**
 * POST /api/data-protection/backup/create
 * Create a backup (admin only)
 */
router.post(
  '/backup/create',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const options = req.body;
      const result = await backupEncryptionService.createBackup(options);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json({
        message: 'Backup created successfully',
        backupId: result.backupId,
        metadata: result.metadata,
      });
    } catch (error) {
      console.error('Error creating backup:', error);
      return res.status(500).json({ error: 'Failed to create backup' });
    }
  }
);

/**
 * GET /api/data-protection/backup/list
 * List all backups (admin only)
 */
router.get(
  '/backup/list',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const backups = await backupEncryptionService.listBackups();
      return res.json({ backups });
    } catch (error) {
      console.error('Error listing backups:', error);
      return res.status(500).json({ error: 'Failed to list backups' });
    }
  }
);

/**
 * GET /api/data-protection/backup/stats
 * Get backup statistics (admin only)
 */
router.get(
  '/backup/stats',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const stats = await backupEncryptionService.getBackupStats();
      return res.json(stats);
    } catch (error) {
      console.error('Error fetching backup stats:', error);
      return res.status(500).json({ error: 'Failed to fetch backup stats' });
    }
  }
);

/**
 * KEY ROTATION ENDPOINTS
 */

/**
 * POST /api/data-protection/keys/rotate
 * Initiate key rotation (admin only)
 */
router.post(
  '/keys/rotate',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await keyRotationService.rotateMasterKey(req.user.id);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json({
        message: 'Key rotation completed successfully',
        result,
      });
    } catch (error) {
      console.error('Error rotating keys:', error);
      return res.status(500).json({ error: 'Failed to rotate keys' });
    }
  }
);

/**
 * GET /api/data-protection/keys/status
 * Get key rotation status (admin only)
 */
router.get(
  '/keys/status',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const progress = keyRotationService.getRotationProgress();
      const versionInfo = await keyRotationService.getKeyVersionInfo();

      return res.json({
        currentVersion: versionInfo,
        rotationInProgress: progress !== null,
        progress,
      });
    } catch (error) {
      console.error('Error fetching key status:', error);
      return res.status(500).json({ error: 'Failed to fetch key status' });
    }
  }
);

/**
 * GET /api/data-protection/keys/history
 * Get key rotation history (admin only)
 */
router.get(
  '/keys/history',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const history = await keyRotationService.getRotationHistory();
      return res.json({ history });
    } catch (error) {
      console.error('Error fetching key history:', error);
      return res.status(500).json({ error: 'Failed to fetch key history' });
    }
  }
);

/**
 * POST /api/data-protection/keys/test
 * Test key rotation (admin only)
 */
router.post(
  '/keys/test',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const success = await keyRotationService.testRotation();

      return res.json({
        success,
        message: success ? 'Key rotation test passed' : 'Key rotation test failed',
      });
    } catch (error) {
      console.error('Error testing key rotation:', error);
      return res.status(500).json({ error: 'Failed to test key rotation' });
    }
  }
);

/**
 * PII DETECTION ENDPOINTS
 */

/**
 * POST /api/data-protection/pii/detect
 * Detect PII in text
 */
router.post('/pii/detect', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const result = piiService.detectPII(text);
    return res.json(result);
  } catch (error) {
    console.error('Error detecting PII:', error);
    return res.status(500).json({ error: 'Failed to detect PII' });
  }
});

/**
 * POST /api/data-protection/pii/mask
 * Mask PII in text
 */
router.post('/pii/mask', async (req: Request, res: Response) => {
  try {
    const { text, options } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const maskedText = piiService.maskPII(text, options);
    return res.json({ maskedText });
  } catch (error) {
    console.error('Error masking PII:', error);
    return res.status(500).json({ error: 'Failed to mask PII' });
  }
});

/**
 * POST /api/data-protection/pii/stats
 * Get PII statistics for text
 */
router.post('/pii/stats', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const stats = piiService.getPIIStats(text);
    return res.json({ stats });
  } catch (error) {
    console.error('Error getting PII stats:', error);
    return res.status(500).json({ error: 'Failed to get PII stats' });
  }
});

export default router;
