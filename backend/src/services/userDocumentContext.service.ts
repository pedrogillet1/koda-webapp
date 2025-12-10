/**
 * ============================================================================
 * USER DOCUMENT CONTEXT SERVICE
 * ============================================================================
 *
 * SINGLE SOURCE OF TRUTH for user's document state
 *
 * Purpose:
 * - Centralize all document count/list queries
 * - Prevent mixing test data with real data
 * - Provide consistent document state across all services
 */

import prisma from '../config/database';

export interface UserDocumentState {
  hasDocuments: boolean;
  totalCount: number;
  byType: Record<string, number>;
  byFolder: Record<string, number>;
  recentDocuments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    createdAt: Date;
  }>;
}

/**
 * Get complete document state for a user
 * This is the ONLY function that should be used to check if user has documents
 */
export async function getUserDocumentState(userId: string): Promise<UserDocumentState> {
  console.log(`[USER-DOC-CONTEXT] Getting document state for user: ${userId}`);

  // Get all non-deleted documents for this user
  const documents = await prisma.documents.findMany({
    where: {
      userId,
      status: { not: 'deleted' }
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
      folderId: true,
      folder: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const totalCount = documents.length;
  const hasDocuments = totalCount > 0;

  console.log(`[USER-DOC-CONTEXT] Found ${totalCount} documents`);

  // Group by type
  const byType: Record<string, number> = {};
  documents.forEach(doc => {
    const ext = getFileExtension(doc.filename);
    byType[ext] = (byType[ext] || 0) + 1;
  });

  // Group by folder
  const byFolder: Record<string, number> = {};
  documents.forEach(doc => {
    const folderName = doc.folder?.name || 'Root';
    byFolder[folderName] = (byFolder[folderName] || 0) + 1;
  });

  // Get recent documents (last 15)
  const recentDocuments = documents.slice(0, 15).map(doc => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt
  }));

  return {
    hasDocuments,
    totalCount,
    byType,
    byFolder,
    recentDocuments
  };
}

/**
 * Quick check if user has any documents
 * Use this for fast boolean checks
 */
export async function userHasDocuments(userId: string): Promise<boolean> {
  const count = await prisma.documents.count({
    where: {
      userId,
      status: { not: 'deleted' }
    }
  });

  console.log(`[USER-DOC-CONTEXT] User ${userId} has ${count} documents`);
  return count > 0;
}

/**
 * Get document count for user
 * Use this when you only need the count
 */
export async function getUserDocumentCount(userId: string): Promise<number> {
  const count = await prisma.documents.count({
    where: {
      userId,
      status: { not: 'deleted' }
    }
  });

  console.log(`[USER-DOC-CONTEXT] User ${userId} document count: ${count}`);
  return count;
}

/**
 * Get documents by folder
 */
export async function getDocumentsByFolder(
  userId: string,
  folderName: string
): Promise<{ count: number; folderId: string | null; folderName: string | null }> {
  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      name: {
        contains: folderName,
        mode: 'insensitive'
      }
    }
  });

  if (!folder) {
    return { count: 0, folderId: null, folderName: null };
  }

  const count = await prisma.documents.count({
    where: {
      userId,
      folderId: folder.id,
      status: { not: 'deleted' }
    }
  });

  return { count, folderId: folder.id, folderName: folder.name };
}

/**
 * Get documents by type
 */
export async function getDocumentsByType(
  userId: string,
  fileType: string
): Promise<number> {
  // Normalize file type
  const normalizedType = fileType.toLowerCase().replace(/^\./, '');

  const documents = await prisma.documents.findMany({
    where: {
      userId,
      status: { not: 'deleted' }
    },
    select: {
      filename: true
    }
  });

  // Filter by extension
  const count = documents.filter(doc => {
    const ext = getFileExtension(doc.filename);
    return ext === normalizedType;
  }).length;

  return count;
}

/**
 * Helper: Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  if (!match) return 'unknown';
  return match[1].toLowerCase();
}

/**
 * Format document state for user-facing messages
 */
export function formatDocumentStateSummary(
  state: UserDocumentState,
  language: 'en' | 'pt' | 'es' = 'en'
): string {
  if (!state.hasDocuments) {
    const messages = {
      en: 'You have no documents uploaded yet.',
      pt: 'Você ainda não tem documentos.',
      es: 'Aún no tienes documentos.'
    };
    return messages[language];
  }

  const { totalCount, byType } = state;
  const typesList = Object.entries(byType)
    .map(([ext, count]) => `${count} ${ext.toUpperCase()}`)
    .join(', ');

  const messages = {
    en: `You have ${totalCount} document${totalCount !== 1 ? 's' : ''}: ${typesList}`,
    pt: `Você tem ${totalCount} documento${totalCount !== 1 ? 's' : ''}: ${typesList}`,
    es: `Tienes ${totalCount} documento${totalCount !== 1 ? 's' : ''}: ${typesList}`
  };

  return messages[language];
}

export const userDocumentContextService = {
  getUserDocumentState,
  userHasDocuments,
  getUserDocumentCount,
  getDocumentsByFolder,
  getDocumentsByType,
  formatDocumentStateSummary
};

export default userDocumentContextService;
