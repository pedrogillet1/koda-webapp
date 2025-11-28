import { Request, Response } from 'express';
import storageService from '../services/storage.service';

/**
 * Get storage info for the current user
 * GET /api/storage
 */
export const getStorageInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const storageInfo = await storageService.getStorageInfo(req.user.id);

    res.status(200).json(storageInfo);
  } catch (error) {
    const err = error as Error;
    console.error('❌ [Storage] Error getting storage info:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Check if user has capacity for a file
 * POST /api/storage/check-capacity
 * Body: { fileSize: number } (in bytes)
 */
export const checkCapacity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { fileSize } = req.body;

    if (typeof fileSize !== 'number' || fileSize <= 0) {
      res.status(400).json({ error: 'Invalid fileSize. Must be a positive number.' });
      return;
    }

    const capacityInfo = await storageService.hasCapacity(req.user.id, fileSize);

    res.status(200).json({
      ...capacityInfo,
      requiredFormatted: storageService.formatBytes(capacityInfo.required),
      availableFormatted: storageService.formatBytes(capacityInfo.available),
      shortfallFormatted: capacityInfo.shortfall > 0
        ? storageService.formatBytes(capacityInfo.shortfall)
        : null
    });
  } catch (error) {
    const err = error as Error;
    console.error('❌ [Storage] Error checking capacity:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Recalculate storage usage (admin/repair endpoint)
 * POST /api/storage/recalculate
 */
export const recalculateStorage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await storageService.recalculateStorage(req.user.id);

    res.status(200).json({
      message: 'Storage recalculated successfully',
      previousUsage: result.previousUsage,
      actualUsage: result.actualUsage,
      difference: result.difference,
      previousUsageFormatted: storageService.formatBytes(result.previousUsage),
      actualUsageFormatted: storageService.formatBytes(result.actualUsage),
      differenceFormatted: result.difference !== 0
        ? storageService.formatBytes(Math.abs(result.difference))
        : '0 B'
    });
  } catch (error) {
    const err = error as Error;
    console.error('❌ [Storage] Error recalculating storage:', err.message);
    res.status(500).json({ error: err.message });
  }
};
