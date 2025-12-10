/**
 * ============================================================================
 * KODA METADATA SERVICE
 * ============================================================================
 *
 * Handles all metadata queries - NO content retrieval needed
 *
 * This service provides fast responses for:
 * - Document counts (total, by folder, by type)
 * - Document listings
 * - Folder information
 * - File type statistics
 *
 * PERFORMANCE TARGET: < 500ms for all operations
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import prisma from '../config/database';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface DocumentCountResult {
  total: number;
  byType: Record<string, number>;
  byFolder: Record<string, number>;
}

export interface DocumentListItem {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: Date;
  folderId?: string | null;
  folderName?: string;
  fileSize?: number;
}

export interface FolderInfo {
  id: string;
  name: string;
  documentCount: number;
  createdAt: Date;
}

export interface MetadataResponse {
  text: string;
  data?: any;
}

// ============================================================================
// DOCUMENT COUNT FUNCTIONS
// ============================================================================

/**
 * Get total document count for a user
 */
export async function getDocumentCount(
  userId: string,
  folderName?: string,
  fileType?: string
): Promise<number> {
  console.log(`[METADATA-SERVICE] Getting document count for user ${userId.substring(0, 8)}...`);

  let where: any = {
    userId,
    status: { not: 'deleted' }
  };

  // Filter by folder if specified
  if (folderName) {
    const folder = await prisma.folder.findFirst({
      where: {
        userId,
        name: { contains: folderName, mode: 'insensitive' }
      }
    });

    if (folder) {
      where.folderId = folder.id;
    } else {
      // Folder not found, return 0
      console.log(`[METADATA-SERVICE] Folder "${folderName}" not found`);
      return 0;
    }
  }

  // Filter by file type if specified
  if (fileType) {
    const normalizedType = normalizeFileType(fileType);
    where.mimeType = getMimeTypeFilter(normalizedType);
  }

  const count = await prisma.document.count({ where });
  console.log(`[METADATA-SERVICE] Document count: ${count}`);

  return count;
}

/**
 * Get document counts grouped by file type
 */
export async function getDocumentsByType(userId: string): Promise<Record<string, number>> {
  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' }
    },
    select: { filename: true, mimeType: true }
  });

  const byType: Record<string, number> = {};

  documents.forEach(doc => {
    const ext = getFileExtension(doc.filename).toUpperCase();
    byType[ext] = (byType[ext] || 0) + 1;
  });

  return byType;
}

/**
 * Get document counts grouped by folder
 */
export async function getDocumentsByFolder(userId: string): Promise<Record<string, number>> {
  const folders = await prisma.folder.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          documents: {
            where: { status: { not: 'deleted' } }
          }
        }
      }
    }
  });

  const byFolder: Record<string, number> = {};

  folders.forEach(folder => {
    byFolder[folder.name] = folder._count.documents;
  });

  // Count documents without folder
  const noFolderCount = await prisma.document.count({
    where: {
      userId,
      status: { not: 'deleted' },
      folderId: null
    }
  });

  if (noFolderCount > 0) {
    byFolder['Sem pasta'] = noFolderCount;
  }

  return byFolder;
}

/**
 * Get complete document statistics
 */
export async function getDocumentStats(userId: string): Promise<DocumentCountResult> {
  const [total, byType, byFolder] = await Promise.all([
    getDocumentCount(userId),
    getDocumentsByType(userId),
    getDocumentsByFolder(userId)
  ]);

  return { total, byType, byFolder };
}

// ============================================================================
// DOCUMENT LISTING FUNCTIONS
// ============================================================================

/**
 * Get recent documents for a user
 */
export async function getRecentDocuments(
  userId: string,
  limit: number = 15
): Promise<DocumentListItem[]> {
  const documents = await prisma.document.findMany({
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
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return documents.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt,
    folderId: doc.folderId,
    folderName: doc.folder?.name
  }));
}

/**
 * Get documents in a specific folder
 */
export async function getDocumentsInFolder(
  userId: string,
  folderName: string
): Promise<{ documents: DocumentListItem[]; folderFound: boolean }> {
  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      name: { contains: folderName, mode: 'insensitive' }
    }
  });

  if (!folder) {
    return { documents: [], folderFound: false };
  }

  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
      folderId: folder.id
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
      folderId: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return {
    documents: documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt,
      folderId: doc.folderId,
      folderName: folder.name
    })),
    folderFound: true
  };
}

/**
 * Get documents by file type
 */
export async function getDocumentsByFileType(
  userId: string,
  fileType: string
): Promise<DocumentListItem[]> {
  const normalizedType = normalizeFileType(fileType);
  const mimeTypeFilter = getMimeTypeFilter(normalizedType);

  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
      mimeType: mimeTypeFilter
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
      folderId: true,
      folder: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return documents.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt,
    folderId: doc.folderId,
    folderName: doc.folder?.name
  }));
}

// ============================================================================
// FOLDER FUNCTIONS
// ============================================================================

/**
 * Get all folders for a user
 */
export async function getFolders(userId: string): Promise<FolderInfo[]> {
  const folders = await prisma.folder.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          documents: {
            where: { status: { not: 'deleted' } }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return folders.map(folder => ({
    id: folder.id,
    name: folder.name,
    documentCount: folder._count.documents,
    createdAt: folder.createdAt
  }));
}

// ============================================================================
// RESPONSE GENERATORS
// ============================================================================

/**
 * Generate a natural language response for document count queries
 */
export async function generateCountResponse(
  userId: string,
  language: string = 'pt',
  folderName?: string,
  fileType?: string
): Promise<MetadataResponse> {
  const count = await getDocumentCount(userId, folderName, fileType);

  let text = '';

  if (language === 'pt') {
    if (folderName && fileType) {
      text = `Você tem ${count} ${fileType.toUpperCase()}${count !== 1 ? 's' : ''} na pasta "${folderName}".`;
    } else if (folderName) {
      text = `Você tem ${count} documento${count !== 1 ? 's' : ''} na pasta "${folderName}".`;
    } else if (fileType) {
      text = `Você tem ${count} arquivo${count !== 1 ? 's' : ''} ${fileType.toUpperCase()}.`;
    } else {
      text = `Você tem ${count} documento${count !== 1 ? 's' : ''} no total.`;
    }
  } else {
    if (folderName && fileType) {
      text = `You have ${count} ${fileType.toUpperCase()} file${count !== 1 ? 's' : ''} in the "${folderName}" folder.`;
    } else if (folderName) {
      text = `You have ${count} document${count !== 1 ? 's' : ''} in the "${folderName}" folder.`;
    } else if (fileType) {
      text = `You have ${count} ${fileType.toUpperCase()} file${count !== 1 ? 's' : ''}.`;
    } else {
      text = `You have ${count} document${count !== 1 ? 's' : ''} in total.`;
    }
  }

  return { text, data: { count, folderName, fileType } };
}

/**
 * Generate a natural language response for document type breakdown
 */
export async function generateTypeBreakdownResponse(
  userId: string,
  language: string = 'pt'
): Promise<MetadataResponse> {
  const byType = await getDocumentsByType(userId);
  const total = Object.values(byType).reduce((sum, count) => sum + count, 0);

  const typesList = Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .map(([ext, count]) => `- **${ext}**: ${count}`)
    .join('\n');

  let text = '';

  if (language === 'pt') {
    text = `Você tem **${total} documentos** divididos em:\n\n${typesList}`;
  } else {
    text = `You have **${total} documents** divided into:\n\n${typesList}`;
  }

  return { text, data: { total, byType } };
}

/**
 * Generate a natural language response for document listing
 */
export async function generateDocumentListResponse(
  userId: string,
  language: string = 'pt',
  limit: number = 15
): Promise<MetadataResponse> {
  const documents = await getRecentDocuments(userId, limit);
  const total = await getDocumentCount(userId);

  if (documents.length === 0) {
    const text = language === 'pt'
      ? 'Você ainda não tem documentos. Faça upload de arquivos para começar!'
      : 'You don\'t have any documents yet. Upload files to get started!';

    return { text, data: { documents: [], total: 0 } };
  }

  const docList = documents
    .map((doc, i) => `${i + 1}. **${doc.filename}**${doc.folderName ? ` (${doc.folderName})` : ''}`)
    .join('\n');

  let text = '';

  if (language === 'pt') {
    text = total > limit
      ? `Aqui estão seus ${limit} documentos mais recentes (de ${total} no total):\n\n${docList}`
      : `Aqui estão seus ${total} documento${total !== 1 ? 's' : ''}:\n\n${docList}`;
  } else {
    text = total > limit
      ? `Here are your ${limit} most recent documents (out of ${total} total):\n\n${docList}`
      : `Here are your ${total} document${total !== 1 ? 's' : ''}:\n\n${docList}`;
  }

  return { text, data: { documents, total } };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
}

/**
 * Normalize file type string
 */
function normalizeFileType(fileType: string): string {
  const normalized = fileType.toLowerCase().replace(/s$/, ''); // Remove trailing 's'

  const aliases: Record<string, string> = {
    'documento': 'pdf',
    'planilha': 'xlsx',
    'apresentacao': 'pptx',
    'apresentação': 'pptx',
    'texto': 'txt',
    'imagem': 'png',
    'doc': 'docx'
  };

  return aliases[normalized] || normalized;
}

/**
 * Get MIME type filter for a file type
 */
function getMimeTypeFilter(fileType: string): any {
  const mimeTypes: Record<string, string[]> = {
    'pdf': ['application/pdf'],
    'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
    'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'],
    'txt': ['text/plain'],
    'csv': ['text/csv'],
    'png': ['image/png'],
    'jpg': ['image/jpeg'],
    'jpeg': ['image/jpeg']
  };

  const types = mimeTypes[fileType];
  if (types) {
    return types.length === 1 ? types[0] : { in: types };
  }

  // Fallback: match by extension in filename
  return { contains: `.${fileType}` };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const kodaMetadataService = {
  // Count functions
  getDocumentCount,
  getDocumentsByType,
  getDocumentsByFolder,
  getDocumentStats,

  // Listing functions
  getRecentDocuments,
  getDocumentsInFolder,
  getDocumentsByFileType,

  // Folder functions
  getFolders,

  // Response generators
  generateCountResponse,
  generateTypeBreakdownResponse,
  generateDocumentListResponse
};

export default kodaMetadataService;
