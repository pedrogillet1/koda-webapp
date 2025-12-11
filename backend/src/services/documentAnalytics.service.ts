/**
 * ============================================================================
 * DOCUMENT ANALYTICS SERVICE
 * ============================================================================
 * 
 * Handles all metadata/analytics questions about documents.
 * NO RAG, NO LLM - just fast DB queries.
 * 
 * Examples:
 * - "Quantos documentos eu tenho?"
 * - "Quantos arquivos são PDF e quantos são DOCX?"
 * - "Liste os 5 documentos mais recentes"
 * - "Quais documentos falam sobre Guarda Bens no título?"
 * 
 * @version 2.0.0
 * @date 2024-12-10
 */

import { PrismaClient } from '@prisma/client';
import type {
  DocumentSummaryResponse,
  RecentDocumentsResponse,
  SearchDocumentsResponse,
  DocumentTypesResponse,
  DocumentTypeInfo,
  DocumentSummary,
} from '../types/rag.types';

const prisma = new PrismaClient();

// ============================================================================
// MIME TYPE LABELS
// ============================================================================

const MIME_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.ms-powerpoint': 'PPT',
  'text/plain': 'TXT',
  'text/html': 'HTML',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/gif': 'GIF',
};

const MIME_TYPE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📊',
  'application/vnd.ms-powerpoint': '📊',
  'text/plain': '📃',
  'text/html': '🌐',
  'image/png': '🖼️',
  'image/jpeg': '🖼️',
  'image/gif': '🖼️',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMimeTypeLabel(mimeType: string): string {
  return MIME_TYPE_LABELS[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'FILE';
}

function getMimeTypeIcon(mimeType: string): string {
  return MIME_TYPE_ICONS[mimeType] || '📁';
}

function mapDocumentToSummary(doc: any): DocumentSummary {
  return {
    id: doc.id,
    title: doc.title || doc.filename,
    filename: doc.filename,
    mimeType: doc.mimeType,
    folderName: doc.folderName || doc.folder?.name,
    uploadedAt: doc.uploadedAt || doc.createdAt,
    size: doc.size,
  };
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class DocumentAnalyticsService {
  /**
   * Get document summary: total count + counts by type
   * 
   * Example response:
   * {
   *   total: 50,
   *   byType: { pdf: 10, docx: 30, pptx: 5, xlsx: 5 },
   *   byFolder: { "Finance": 20, "Projects": 30 }
   * }
   */
  async getDocumentSummary(userId: string): Promise<DocumentSummaryResponse> {
    try {
      // Total count
      const total = await prisma.document.count({
        where: { userId, deletedAt: null },
      });

      // Count by mime type
      const byTypeRaw = await prisma.document.groupBy({
        by: ['mimeType'],
        where: { userId, deletedAt: null },
        _count: true,
      });

      const byType: Record<string, number> = {};
      byTypeRaw.forEach((item) => {
        const label = getMimeTypeLabel(item.mimeType);
        byType[label] = item._count;
      });

      // Count by folder (optional)
      const byFolderRaw = await prisma.document.groupBy({
        by: ['folderId'],
        where: { userId, deletedAt: null, folderId: { not: null } },
        _count: true,
      });

      const byFolder: Record<string, number> = {};
      for (const item of byFolderRaw) {
        if (item.folderId) {
          const folder = await prisma.folder.findUnique({
            where: { id: item.folderId },
            select: { name: true },
          });
          if (folder) {
            byFolder[folder.name] = item._count;
          }
        }
      }

      return {
        total,
        byType,
        byFolder: Object.keys(byFolder).length > 0 ? byFolder : undefined,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error getting document summary:', error);
      throw new Error('Failed to get document summary');
    }
  }

  /**
   * Get recent documents
   * 
   * Example response:
   * {
   *   documents: [
   *     { id, title, filename, mimeType, folderName, uploadedAt, size },
   *     ...
   *   ],
   *   total: 50,
   *   limit: 5
   * }
   */
  async getRecentDocuments(
    userId: string,
    limit: number = 5
  ): Promise<RecentDocumentsResponse> {
    try {
      const documents = await prisma.document.findMany({
        where: { userId, deletedAt: null },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        include: {
          folder: {
            select: { name: true },
          },
        },
      });

      const total = await prisma.document.count({
        where: { userId, deletedAt: null },
      });

      return {
        documents: documents.map(mapDocumentToSummary),
        total,
        limit,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error getting recent documents:', error);
      throw new Error('Failed to get recent documents');
    }
  }

  /**
   * Search documents by title/filename
   * 
   * Example: titleContains = "Guarda Bens"
   * Returns all documents with "Guarda Bens" in title or filename
   */
  async searchDocuments(
    userId: string,
    titleContains: string,
    limit: number = 50
  ): Promise<SearchDocumentsResponse> {
    try {
      const documents = await prisma.document.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { title: { contains: titleContains, mode: 'insensitive' } },
            { filename: { contains: titleContains, mode: 'insensitive' } },
          ],
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        include: {
          folder: {
            select: { name: true },
          },
        },
      });

      return {
        documents: documents.map(mapDocumentToSummary),
        total: documents.length,
        query: titleContains,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error searching documents:', error);
      throw new Error('Failed to search documents');
    }
  }

  /**
   * Get document types with counts
   * 
   * Example response:
   * {
   *   types: [
   *     { mimeType: "application/pdf", label: "PDF", count: 10, icon: "📄" },
   *     { mimeType: "application/vnd...docx", label: "DOCX", count: 30, icon: "📝" },
   *     ...
   *   ]
   * }
   */
  async getDocumentTypes(userId: string): Promise<DocumentTypesResponse> {
    try {
      const byTypeRaw = await prisma.document.groupBy({
        by: ['mimeType'],
        where: { userId, deletedAt: null },
        _count: true,
      });

      const types: DocumentTypeInfo[] = byTypeRaw.map((item) => ({
        mimeType: item.mimeType,
        label: getMimeTypeLabel(item.mimeType),
        count: item._count,
        icon: getMimeTypeIcon(item.mimeType),
      }));

      // Sort by count descending
      types.sort((a, b) => b.count - a.count);

      return { types };
    } catch (error) {
      console.error('[ANALYTICS] Error getting document types:', error);
      throw new Error('Failed to get document types');
    }
  }

  /**
   * Get documents by folder
   */
  async getDocumentsByFolder(
    userId: string,
    folderName: string,
    limit: number = 50
  ): Promise<SearchDocumentsResponse> {
    try {
      const folder = await prisma.folder.findFirst({
        where: {
          userId,
          name: { contains: folderName, mode: 'insensitive' },
        },
      });

      if (!folder) {
        return {
          documents: [],
          total: 0,
          query: folderName,
        };
      }

      const documents = await prisma.document.findMany({
        where: {
          userId,
          deletedAt: null,
          folderId: folder.id,
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        include: {
          folder: {
            select: { name: true },
          },
        },
      });

      return {
        documents: documents.map(mapDocumentToSummary),
        total: documents.length,
        query: folderName,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error getting documents by folder:', error);
      throw new Error('Failed to get documents by folder');
    }
  }

  /**
   * Get documents by mime type
   */
  async getDocumentsByType(
    userId: string,
    mimeTypeLabel: string,
    limit: number = 50
  ): Promise<SearchDocumentsResponse> {
    try {
      // Find mime type from label
      const mimeType = Object.keys(MIME_TYPE_LABELS).find(
        (key) => MIME_TYPE_LABELS[key].toLowerCase() === mimeTypeLabel.toLowerCase()
      );

      if (!mimeType) {
        return {
          documents: [],
          total: 0,
          query: mimeTypeLabel,
        };
      }

      const documents = await prisma.document.findMany({
        where: {
          userId,
          deletedAt: null,
          mimeType,
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        include: {
          folder: {
            select: { name: true },
          },
        },
      });

      return {
        documents: documents.map(mapDocumentToSummary),
        total: documents.length,
        query: mimeTypeLabel,
      };
    } catch (error) {
      console.error('[ANALYTICS] Error getting documents by type:', error);
      throw new Error('Failed to get documents by type');
    }
  }

  /**
   * Format analytics result for LLM (optional phrasing)
   * 
   * Takes structured data and creates a concise text summary
   * that can be sent to Gemini for natural language phrasing.
   */
  formatSummaryForLLM(summary: DocumentSummaryResponse): string {
    const { total, byType, byFolder } = summary;

    let text = `Total documents: ${total}\n\n`;

    if (Object.keys(byType).length > 0) {
      text += 'Documents by type:\n';
      Object.entries(byType).forEach(([type, count]) => {
        text += `- ${type}: ${count}\n`;
      });
    }

    if (byFolder && Object.keys(byFolder).length > 0) {
      text += '\nDocuments by folder:\n';
      Object.entries(byFolder).forEach(([folder, count]) => {
        text += `- ${folder}: ${count}\n`;
      });
    }

    return text;
  }

  /**
   * Format recent documents for LLM
   */
  formatRecentForLLM(recent: RecentDocumentsResponse): string {
    const { documents, total, limit } = recent;

    let text = `Showing ${documents.length} of ${total} most recent documents:\n\n`;

    documents.forEach((doc, index) => {
      text += `${index + 1}. ${doc.title} (${getMimeTypeLabel(doc.mimeType)})`;
      if (doc.folderName) {
        text += ` - Folder: ${doc.folderName}`;
      }
      text += `\n`;
    });

    return text;
  }

  /**
   * Format search results for LLM
   */
  formatSearchForLLM(search: SearchDocumentsResponse): string {
    const { documents, total, query } = search;

    if (documents.length === 0) {
      return `No documents found with "${query}" in title or filename.`;
    }

    let text = `Found ${total} document(s) with "${query}":\n\n`;

    documents.forEach((doc, index) => {
      text += `${index + 1}. ${doc.title} (${getMimeTypeLabel(doc.mimeType)})`;
      if (doc.folderName) {
        text += ` - Folder: ${doc.folderName}`;
      }
      text += `\n`;
    });

    return text;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default new DocumentAnalyticsService();
