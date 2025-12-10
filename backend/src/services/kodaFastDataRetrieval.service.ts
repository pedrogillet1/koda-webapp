/**
 * Koda Fast Data Retrieval Service
 *
 * Provides raw data retrieval optimized for fast-path queries.
 * Target response time: 80-150ms for database operations.
 *
 * This service retrieves raw data without LLM processing,
 * which is then formatted by the micro-prompt generator.
 *
 * @version 1.0.0
 */

import prisma from '../config/database';
import type { FastPathIntentType, FastPathClassification } from './kodaFastPathIntent.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface FastDataResult {
  success: boolean;
  intent: FastPathIntentType;
  data: unknown;
  retrievalTimeMs: number;
  error?: string;
}

export interface FileListData {
  files: Array<{
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    folderPath: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  totalCount: number;
  hasMore: boolean;
}

export interface FileCountData {
  totalCount: number;
  byType?: Record<string, number>;
}

export interface FolderPathData {
  found: boolean;
  folderName: string;
  path: string | null;
  folderId?: string;
}

export interface RecentActivityData {
  files: Array<{
    id: string;
    filename: string;
    mimeType: string;
    action: 'uploaded' | 'modified';
    timestamp: Date;
    folderPath: string;
  }>;
}

export interface MetadataData {
  found: boolean;
  fileName: string;
  metadata?: {
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    sizeFormatted: string;
    createdAt: Date;
    updatedAt: Date;
    folderPath: string;
    pageCount?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getTimeRangeDate(timeRange?: string): Date | null {
  if (!timeRange) return null;

  const now = new Date();
  switch (timeRange) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'this_week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    case 'this_month':
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return monthAgo;
    case 'recent':
    default:
      // Last 7 days for "recent"
      const recent = new Date(now);
      recent.setDate(recent.getDate() - 7);
      return recent;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Retrieval Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve file list for a user
 */
async function retrieveFileList(
  userId: string,
  entities: FastPathClassification['extractedEntities']
): Promise<FileListData> {
  const limit = entities.limit || 20;
  const fileType = entities.fileType;
  const timeRange = getTimeRangeDate(entities.timeRange);

  const whereClause: Record<string, unknown> = { userId };

  if (fileType) {
    // Map common file type names to MIME types
    const mimeTypeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'image': 'image/',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
    };
    const mimeType = mimeTypeMap[fileType.toLowerCase()];
    if (mimeType) {
      if (mimeType.endsWith('/')) {
        // For partial matches like 'image/'
        whereClause.mimeType = { startsWith: mimeType };
      } else {
        whereClause.mimeType = mimeType;
      }
    }
  }

  if (timeRange) {
    whereClause.createdAt = { gte: timeRange };
  }

  const [files, totalCount] = await Promise.all([
    prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        filename: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
        folder: {
          select: {
            path: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // +1 to check if there's more
    }),
    prisma.document.count({ where: whereClause }),
  ]);

  const hasMore = files.length > limit;
  const resultFiles = hasMore ? files.slice(0, limit) : files;

  return {
    files: resultFiles.map(f => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      fileSize: f.fileSize,
      folderPath: f.folder?.path || '/',
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    })),
    totalCount,
    hasMore,
  };
}

/**
 * Retrieve file count for a user
 */
async function retrieveFileCount(
  userId: string,
  entities: FastPathClassification['extractedEntities']
): Promise<FileCountData> {
  const fileType = entities.fileType;

  if (fileType) {
    // Map common file type names to MIME types
    const mimeTypeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    const mimeType = mimeTypeMap[fileType.toLowerCase()];
    if (mimeType) {
      const count = await prisma.document.count({
        where: {
          userId,
          mimeType,
        },
      });
      return { totalCount: count };
    }
    // If no mapping found, return total count
    const totalCount = await prisma.document.count({ where: { userId } });
    return { totalCount };
  }

  // Get count grouped by mimeType
  const counts = await prisma.document.groupBy({
    by: ['mimeType'],
    where: { userId },
    _count: { mimeType: true },
  });

  const byType: Record<string, number> = {};
  let totalCount = 0;

  // Map MIME types to friendly names for display
  const friendlyNameMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'image/png': 'png',
    'image/jpeg': 'jpg',
  };

  for (const item of counts) {
    const friendlyName = friendlyNameMap[item.mimeType] || item.mimeType.split('/').pop() || item.mimeType;
    byType[friendlyName] = item._count.mimeType;
    totalCount += item._count.mimeType;
  }

  return { totalCount, byType };
}

/**
 * Retrieve folder path information
 */
async function retrieveFolderPath(
  userId: string,
  entities: FastPathClassification['extractedEntities']
): Promise<FolderPathData> {
  const folderName = entities.folderName;

  if (!folderName) {
    return {
      found: false,
      folderName: '',
      path: null,
    };
  }

  // Search for folder by name (case-insensitive)
  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      name: {
        contains: folderName,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      path: true,
    },
  });

  if (!folder) {
    return {
      found: false,
      folderName,
      path: null,
    };
  }

  return {
    found: true,
    folderName: folder.name,
    path: folder.path || '/' + folder.name,
    folderId: folder.id,
  };
}

/**
 * Retrieve recent activity
 */
async function retrieveRecentActivity(
  userId: string,
  entities: FastPathClassification['extractedEntities']
): Promise<RecentActivityData> {
  const limit = entities.limit || 10;
  const timeRange = getTimeRangeDate(entities.timeRange || 'recent');

  const whereClause: Record<string, unknown> = { userId };

  if (timeRange) {
    whereClause.OR = [
      { createdAt: { gte: timeRange } },
      { updatedAt: { gte: timeRange } },
    ];
  }

  const files = await prisma.document.findMany({
    where: whereClause,
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
      updatedAt: true,
      folder: {
        select: {
          path: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return {
    files: files.map(f => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      action: f.createdAt.getTime() === f.updatedAt.getTime() ? 'uploaded' : 'modified',
      timestamp: f.updatedAt,
      folderPath: f.folder?.path || '/',
    })),
  };
}

/**
 * Retrieve file metadata
 */
async function retrieveMetadata(
  userId: string,
  entities: FastPathClassification['extractedEntities']
): Promise<MetadataData> {
  const fileName = entities.fileName;

  if (!fileName) {
    return {
      found: false,
      fileName: '',
    };
  }

  // Search for file by filename (case-insensitive)
  const file = await prisma.document.findFirst({
    where: {
      userId,
      filename: {
        contains: fileName,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      updatedAt: true,
      folder: {
        select: {
          path: true,
        },
      },
    },
  });

  if (!file) {
    return {
      found: false,
      fileName,
    };
  }

  return {
    found: true,
    fileName: file.filename,
    metadata: {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      sizeFormatted: formatFileSize(file.fileSize),
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      folderPath: file.folder?.path || '/',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Retrieval Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve data based on classified intent
 */
export async function retrieveFastData(
  userId: string,
  classification: FastPathClassification
): Promise<FastDataResult> {
  const startTime = Date.now();

  try {
    let data: unknown;

    switch (classification.intent) {
      case 'FILE_LIST':
        data = await retrieveFileList(userId, classification.extractedEntities);
        break;

      case 'FILE_COUNT':
        data = await retrieveFileCount(userId, classification.extractedEntities);
        break;

      case 'FOLDER_PATH_QUERY':
        data = await retrieveFolderPath(userId, classification.extractedEntities);
        break;

      case 'RECENT_ACTIVITY':
        data = await retrieveRecentActivity(userId, classification.extractedEntities);
        break;

      case 'METADATA_QUERY':
        data = await retrieveMetadata(userId, classification.extractedEntities);
        break;

      case 'SIMPLE_FACT':
        // Simple fact requires RAG retrieval - return null
        data = null;
        break;

      case 'GREETING':
        // Greetings don't need data retrieval
        data = { greeting: true };
        break;

      default:
        data = null;
    }

    return {
      success: true,
      intent: classification.intent,
      data,
      retrievalTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[FAST-DATA] Error retrieving data:', error);
    return {
      success: false,
      intent: classification.intent,
      data: null,
      retrievalTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Quick data retrieval for simple queries (combined classification + retrieval)
 */
export async function quickRetrieve(
  userId: string,
  query: string
): Promise<FastDataResult | null> {
  // Import dynamically to avoid circular dependency
  const { classifyFastPathIntent } = await import('./kodaFastPathIntent.service');

  const classification = classifyFastPathIntent(query);

  if (!classification.isFastPath) {
    return null;
  }

  return retrieveFastData(userId, classification);
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export default {
  retrieveFastData,
  quickRetrieve,
};
