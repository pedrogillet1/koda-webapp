/**
 * Document Search Service
 *
 * Provides document search functionality by:
 * - Title/filename
 * - Tags
 * - Content keywords
 */

import prisma from '../config/database';
import type { DocumentSearchResult } from '../types/ragV2.types';

class DocumentSearchService {
  /**
   * Search documents by title, filename, or tags
   */
  async searchDocuments(
    userId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<DocumentSearchResult> {
    const startTime = Date.now();

    try {
      const docs = await prisma.document.findMany({
        where: {
          userId,
          status: 'completed',
          OR: [
            {
              filename: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              displayTitle: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: {
          id: true,
          filename: true,
          displayTitle: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return {
        documents: docs.map(d => ({
          documentId: d.id,
          title: d.displayTitle || d.filename,
          mimeType: d.mimeType,
          uploadedAt: d.createdAt,
        })),
        totalFound: docs.length,
        searchTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DocumentSearch] Error:', error);
      return {
        documents: [],
        totalFound: 0,
        searchTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Search documents by content using embeddings search
   * (Simplified version - can be enhanced with Pinecone)
   */
  async searchByContent(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<DocumentSearchResult> {
    const startTime = Date.now();

    // For now, fall back to title search
    // This can be enhanced to use Pinecone semantic search
    return this.searchDocuments(userId, query, limit);
  }

  /**
   * Search documents by file type
   */
  async searchByType(
    userId: string,
    fileType: string,
    limit: number = 50
  ): Promise<DocumentSearchResult> {
    const startTime = Date.now();
    const mimeType = this.getMimeType(fileType);

    if (!mimeType) {
      return {
        documents: [],
        totalFound: 0,
        searchTimeMs: Date.now() - startTime,
      };
    }

    try {
      const docs = await prisma.document.findMany({
        where: {
          userId,
          status: 'completed',
          mimeType,
        },
        select: {
          id: true,
          filename: true,
          displayTitle: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return {
        documents: docs.map(d => ({
          documentId: d.id,
          title: d.displayTitle || d.filename,
          mimeType: d.mimeType,
          uploadedAt: d.createdAt,
        })),
        totalFound: docs.length,
        searchTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DocumentSearch] Error:', error);
      return {
        documents: [],
        totalFound: 0,
        searchTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Search documents by folder
   */
  async searchByFolder(
    userId: string,
    folderName: string,
    limit: number = 50
  ): Promise<DocumentSearchResult> {
    const startTime = Date.now();

    try {
      // Find folder by name
      const folder = await prisma.folder.findFirst({
        where: {
          userId,
          name: {
            contains: folderName,
            mode: 'insensitive',
          },
        },
      });

      if (!folder) {
        return {
          documents: [],
          totalFound: 0,
          searchTimeMs: Date.now() - startTime,
        };
      }

      const docs = await prisma.document.findMany({
        where: {
          userId,
          status: 'completed',
          folderId: folder.id,
        },
        select: {
          id: true,
          filename: true,
          displayTitle: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return {
        documents: docs.map(d => ({
          documentId: d.id,
          title: d.displayTitle || d.filename,
          mimeType: d.mimeType,
          uploadedAt: d.createdAt,
        })),
        totalFound: docs.length,
        searchTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DocumentSearch] Error:', error);
      return {
        documents: [],
        totalFound: 0,
        searchTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Convert user-friendly extension to MIME type
   */
  private getMimeType(extension: string): string | null {
    const map: Record<string, string> = {
      'PDF': 'application/pdf',
      'DOCX': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'XLSX': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'PPTX': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'DOC': 'application/msword',
      'XLS': 'application/vnd.ms-excel',
      'PPT': 'application/vnd.ms-powerpoint',
      'TXT': 'text/plain',
      'CSV': 'text/csv',
    };
    return map[extension.toUpperCase()] || null;
  }
}

export const documentSearchService = new DocumentSearchService();
export default documentSearchService;
