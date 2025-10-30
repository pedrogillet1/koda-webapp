import { Request, Response } from 'express';
import * as folderService from '../services/folder.service';
import { emitFolderEvent } from '../services/websocket.service';

/**
 * Create folder
 */
export const createFolder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, emoji, parentFolderId } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Folder name is required' });
      return;
    }

    // Validate folder name - prevent invalid names like ".", "..", or empty strings
    const trimmedName = name.trim();
    if (trimmedName === '.' || trimmedName === '..' || trimmedName.length === 0) {
      res.status(400).json({ error: 'Invalid folder name. Folder names cannot be ".", "..", or empty.' });
      return;
    }

    const folder = await folderService.createFolder(req.user.id, trimmedName, emoji, parentFolderId);

    // Emit real-time event for folder creation
    emitFolderEvent(req.user.id, 'created', folder.id);

    res.status(201).json({ folder });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Get folder tree
 */
export const getFolderTree = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if we should include all folders (including subfolders)
    const includeAll = req.query.includeAll === 'true';
    console.log(`📊 getFolderTree API called, includeAll=${includeAll}, user=${req.user.id}`);

    const folders = await folderService.getFolderTree(req.user.id, includeAll);

    // Log the actual folders being returned with count data
    console.log(`🔍 getFolderTree returning: ${folders.length} folders (includeAll: ${includeAll})`);
    folders.forEach(f => {
      const countInfo = (f as any)._count;
      console.log(`  - ${f.emoji || '📁'} ${f.name} (parent: ${f.parentFolderId || 'null'}) | docs: ${countInfo?.documents || 'N/A'} | total: ${countInfo?.totalDocuments || 'N/A'} | subfolders: ${countInfo?.subfolders || 'N/A'}`);
    });

    // Disable caching to ensure fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json({ folders });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get single folder
 */
export const getFolder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const folder = await folderService.getFolder(id, req.user.id);

    res.status(200).json({ folder });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Update folder
 */
export const updateFolder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, emoji, parentFolderId } = req.body;

    const folder = await folderService.updateFolder(id, req.user.id, name, emoji, parentFolderId);

    // Emit real-time event for folder update
    emitFolderEvent(req.user.id, 'updated', id);

    res.status(200).json({ folder });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Bulk create folders from folder tree structure
 */
export const bulkCreateFolders = async (req: Request, res: Response): Promise<void> => {
  const requestId = Math.random().toString(36).substring(7);
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { folderTree, defaultEmoji, parentFolderId } = req.body;

    if (!folderTree || !Array.isArray(folderTree)) {
      res.status(400).json({ error: 'Invalid folder tree structure' });
      return;
    }

    console.log(`\n🆔 [${requestId}] ===== NEW BULK CREATE REQUEST =====`);
    console.log(`📁 [${requestId}] Bulk creating ${folderTree.length} folders for user ${req.user.id}${parentFolderId ? ` under parent ${parentFolderId}` : ''}`);
    console.log(`📁 [${requestId}] Received folderTree array:`);
    folderTree.forEach((folder: any, index: number) => {
      console.log(`  [${requestId}][${index}] name="${folder.name}", path="${folder.path}", parentPath="${folder.parentPath || 'null'}"`);
    });

    const folderMap = await folderService.bulkCreateFolders(req.user.id, folderTree, defaultEmoji, parentFolderId);

    console.log(`✅ [${requestId}] Successfully created ${Object.keys(folderMap).length} folders`);
    console.log(`🆔 [${requestId}] ===== REQUEST COMPLETE =====\n`);

    // Emit real-time event for bulk folder creation (emit generic folders-changed)
    emitFolderEvent(req.user.id, 'created');

    res.status(201).json({
      success: true,
      folderMap, // Returns mapping of folder paths to database IDs
      count: Object.keys(folderMap).length
    });
  } catch (error) {
    const err = error as Error;
    console.error(`❌ [${requestId}] Error in bulkCreateFolders:`, err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Delete folder
 */
export const deleteFolder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await folderService.deleteFolder(id, req.user.id);

    // Emit real-time event for folder deletion
    emitFolderEvent(req.user.id, 'deleted', id);

    res.status(200).json({ message: 'Folder deleted successfully' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};
