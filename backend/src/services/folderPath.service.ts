/**
 * Folder Path Service
 *
 * Manages folder path computation and caching for O(1) path lookups.
 * When folders are created, renamed, or moved, this service updates
 * the path field for the folder and all its descendants.
 *
 * @version 1.0.0
 */

import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// Path Computation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the full path for a folder by traversing parent hierarchy
 */
async function computeFolderPath(folderId: string): Promise<string> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      name: true,
      parentFolderId: true,
    },
  });

  if (!folder) {
    return '/';
  }

  // Build path by traversing up the hierarchy
  const pathParts: string[] = [folder.name];
  let currentParentId = folder.parentFolderId;

  while (currentParentId) {
    const parent = await prisma.folder.findUnique({
      where: { id: currentParentId },
      select: {
        id: true,
        name: true,
        parentFolderId: true,
      },
    });

    if (!parent) break;

    pathParts.unshift(parent.name);
    currentParentId = parent.parentFolderId;
  }

  return '/' + pathParts.join('/');
}

/**
 * Update the path for a folder and all its descendants
 */
async function updateFolderAndDescendants(folderId: string): Promise<number> {
  let updatedCount = 0;

  // Update this folder's path
  const newPath = await computeFolderPath(folderId);
  await prisma.folder.update({
    where: { id: folderId },
    data: { path: newPath },
  });
  updatedCount++;

  // Find all descendant folders (direct children)
  const children = await prisma.folder.findMany({
    where: { parentFolderId: folderId },
    select: { id: true },
  });

  // Recursively update descendants
  for (const child of children) {
    updatedCount += await updateFolderAndDescendants(child.id);
  }

  return updatedCount;
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Handlers (called from folder.service.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Called when a new folder is created
 * Sets the initial path for the folder
 */
export async function onFolderCreated(folderId: string): Promise<void> {
  try {
    const path = await computeFolderPath(folderId);
    await prisma.folder.update({
      where: { id: folderId },
      data: { path },
    });
    console.log(`[FOLDER-PATH] Set path for new folder: ${path}`);
  } catch (error) {
    console.error(`[FOLDER-PATH] Error setting path for folder ${folderId}:`, error);
  }
}

/**
 * Called when a folder is renamed
 * Updates the path for the folder and all its descendants
 */
export async function onFolderRenamed(folderId: string): Promise<void> {
  try {
    const updatedCount = await updateFolderAndDescendants(folderId);
    console.log(`[FOLDER-PATH] Updated ${updatedCount} folder(s) after rename`);
  } catch (error) {
    console.error(`[FOLDER-PATH] Error updating paths after rename for ${folderId}:`, error);
  }
}

/**
 * Called when a folder is moved to a new parent
 * Updates the path for the folder and all its descendants
 */
export async function onFolderMoved(folderId: string): Promise<void> {
  try {
    const updatedCount = await updateFolderAndDescendants(folderId);
    console.log(`[FOLDER-PATH] Updated ${updatedCount} folder(s) after move`);
  } catch (error) {
    console.error(`[FOLDER-PATH] Error updating paths after move for ${folderId}:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Initialization Functions (for migration scripts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initialize paths for all folders in the database
 * Used for one-time migration
 */
export async function initializeAllFolderPaths(): Promise<number> {
  console.log('[FOLDER-PATH] Initializing all folder paths...');

  // Get all root folders (no parent)
  const rootFolders = await prisma.folder.findMany({
    where: { parentFolderId: null },
    select: { id: true },
  });

  let totalUpdated = 0;

  for (const folder of rootFolders) {
    totalUpdated += await updateFolderAndDescendants(folder.id);
  }

  console.log(`[FOLDER-PATH] Initialized ${totalUpdated} folder paths`);
  return totalUpdated;
}

/**
 * Initialize paths for all folders belonging to a specific user
 */
export async function initializeUserFolderPaths(userId: string): Promise<number> {
  console.log(`[FOLDER-PATH] Initializing folder paths for user ${userId}...`);

  // Get user's root folders
  const rootFolders = await prisma.folder.findMany({
    where: {
      userId,
      parentFolderId: null,
    },
    select: { id: true },
  });

  let totalUpdated = 0;

  for (const folder of rootFolders) {
    totalUpdated += await updateFolderAndDescendants(folder.id);
  }

  console.log(`[FOLDER-PATH] Initialized ${totalUpdated} folder paths for user ${userId}`);
  return totalUpdated;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the full path for a folder (uses cached path if available)
 */
export async function getFolderPath(folderId: string): Promise<string> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { path: true },
  });

  if (folder?.path) {
    return folder.path;
  }

  // Fallback: compute path if not cached
  return computeFolderPath(folderId);
}

// ═══════════════════════════════════════════════════════════════════════════
// Document With Path - For File Listings
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Document with full folder path information
 * Used for file listing answers where we show the complete path hierarchy
 */
export interface DocumentWithPath {
  id: string;
  filename: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: Date;
  folderPath: {
    pathString: string;  // e.g., "Work / Projects / 2024"
    folderId: string | null;
    folderName: string | null;
  };
}

/**
 * Format a raw path like "/Work/Projects/2024" into "Work / Projects / 2024"
 */
function formatPathString(rawPath: string | null | undefined): string {
  if (!rawPath || rawPath === '/' || rawPath === '') {
    return 'Root';  // Or 'Raiz' for Portuguese - handled by caller
  }
  // Remove leading slash and replace / with " / "
  return rawPath.replace(/^\//, '').replace(/\//g, ' / ');
}

/**
 * Get documents with their full folder path
 * This is used ONLY for document listing answers, not for inline mentions
 */
export async function getDocumentsWithPath(
  where: {
    userId: string;
    folderId?: string;
    filename?: { contains: string; mode: 'insensitive' };
    mimeType?: { contains: string };
    status?: { not: string };
  },
  options: {
    take?: number;
    orderBy?: { [key: string]: 'asc' | 'desc' };
  } = {}
): Promise<DocumentWithPath[]> {
  const { take = 50, orderBy = { createdAt: 'desc' } } = options;

  const documents = await prisma.document.findMany({
    where: {
      ...where,
      status: where.status || { not: 'deleted' },
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      folderId: true,
      folder: {
        select: {
          id: true,
          name: true,
          path: true,
        },
      },
    },
    take,
    orderBy,
  });

  return documents.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt,
    folderPath: {
      pathString: formatPathString(doc.folder?.path),
      folderId: doc.folder?.id || null,
      folderName: doc.folder?.name || null,
    },
  }));
}

export default {
  onFolderCreated,
  onFolderRenamed,
  onFolderMoved,
  initializeAllFolderPaths,
  initializeUserFolderPaths,
  getFolderPath,
  getDocumentsWithPath,
  formatPathString,
};
