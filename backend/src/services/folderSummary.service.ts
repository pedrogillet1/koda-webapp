/**
 * Folder Summary Service
 * Pre-computes and caches folder summaries based on document contents
 * Enables Koda to have comprehensive knowledge of all folders and their contents
 */

import prisma from '../config/database';

interface FolderWithDocs {
  id: string;
  name: string;
  path: string;
  documentCount: number;
  summary: string;
  documents: Array<{
    filename: string;
    mimeType: string;
  }>;
}

interface FolderInfo {
  id: string;
  name: string;
  path: string;
  summary: string;
  documentCount: number;
}

class FolderSummaryService {
  /**
   * Generate summary for a folder based on its documents
   * Uses simple file type counting (no LLM needed)
   */
  async generateFolderSummary(folderId: string): Promise<string> {
    console.log(`📁 [FOLDER SUMMARY] Generating summary for folder ${folderId}`);

    // Get all documents in this folder
    const documents = await prisma.documents.findMany({
      where: {
        folderId,
        status: 'completed'
      },
      select: {
        filename: true,
        mimeType: true,
      },
    });

    if (documents.length === 0) {
      return 'Empty folder';
    }

    // Count by file type
    const typeCounts: Record<string, number> = {};

    for (const doc of documents) {
      const ext = doc.filename.split('.').pop()?.toUpperCase() || 'OTHER';
      typeCounts[ext] = (typeCounts[ext] || 0) + 1;
    }

    // Build summary
    const typeList = Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    return `Contains ${documents.length} files (${typeList})`;
  }

  /**
   * Update folder summary in database
   * NOTE: Summary field not yet in schema - storing in description for now
   */
  async updateFolderSummary(folderId: string): Promise<void> {
    const summary = await this.generateFolderSummary(folderId);

    // TODO: Add summary field to Folder schema
    // await prisma.folders.update({
    //   where: { id: folderId },
    //   data: {
    //     summary,
    //     summaryUpdatedAt: new Date(),
    //   },
    // });

    console.log(`✅ [FOLDER SUMMARY] Generated summary for folder ${folderId}: "${summary}"`);
  }

  /**
   * Update folder summary and all parent folders recursively
   */
  async updateFolderHierarchy(folderId: string | null): Promise<void> {
    if (!folderId) return;

    // Update this folder
    await this.updateFolderSummary(folderId);

    // Get parent folder
    const folder = await prisma.folders.findUnique({
      where: { id: folderId },
      select: { parentFolderId: true },
    });

    // Recursively update parent
    if (folder?.parentFolderId) {
      await this.updateFolderHierarchy(folder.parentFolderId);
    }
  }

  /**
   * Get all folders with summaries for a user
   */
  async getUserFolderIndex(userId: string): Promise<FolderInfo[]> {
    const folders = await prisma.folders.findMany({
      where: { userId },
      include: {
        _count: {
          select: { documents: true }
        },
        parentFolder: {
          select: {
            id: true,
            name: true,
            parentFolder: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      path: folder.path || this.buildFolderPath(folder),
      summary: folder.description || 'No summary',
      documentCount: folder._count.documents,
    }));
  }

  /**
   * Build folder path string from folder hierarchy
   */
  private buildFolderPath(folder: any): string {
    const path: string[] = [];
    let current = folder;

    while (current) {
      path.unshift(current.name);
      current = current.parentFolder;
    }

    return path.join('/');
  }

  /**
   * Get comprehensive folder index with document details
   */
  async getUserFolderIndexWithDocs(userId: string): Promise<FolderWithDocs[]> {
    const folders = await prisma.folders.findMany({
      where: { userId },
      include: {
        documents: {
          where: { status: 'completed' },
          select: {
            filename: true,
            mimeType: true,
          },
        },
        parentFolder: {
          select: {
            id: true,
            name: true,
            parentFolder: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      path: folder.path || this.buildFolderPath(folder),
      documentCount: folder.documents.length,
      summary: folder.description || 'No summary',
      documents: folder.documents,
    }));
  }

  /**
   * Backfill summaries for all folders without summaries
   */
  async backfillMissingSummaries(userId: string): Promise<number> {
    const foldersWithoutSummaries = await prisma.folders.findMany({
      where: {
        userId,
        description: null,
      },
      select: { id: true },
    });

    console.log(`📁 [FOLDER SUMMARY] Backfilling ${foldersWithoutSummaries.length} folder summaries for user ${userId}`);

    let count = 0;
    for (const folder of foldersWithoutSummaries) {
      try {
        await this.updateFolderSummary(folder.id);
        count++;
      } catch (error) {
        console.error(`❌ [FOLDER SUMMARY] Failed to update folder ${folder.id}:`, error);
      }
    }

    console.log(`✅ [FOLDER SUMMARY] Backfilled ${count} folder summaries`);
    return count;
  }

  /**
   * Get folder by name (case-insensitive)
   */
  async getFolderByName(userId: string, folderName: string): Promise<FolderInfo | null> {
    const folder = await prisma.folders.findFirst({
      where: {
        userId,
        name: {
          equals: folderName,
          mode: 'insensitive',
        },
      },
      include: {
        _count: {
          select: { documents: true }
        },
      },
    });

    if (!folder) return null;

    return {
      id: folder.id,
      name: folder.name,
      path: folder.path || `/${folder.name}`,
      summary: folder.description || 'No summary',
      documentCount: folder._count.documents,
    };
  }

  /**
   * Get documents in a specific folder
   */
  async getFolderDocuments(folderId: string): Promise<Array<{ id: string; filename: string; mimeType: string }>> {
    const documents = await prisma.documents.findMany({
      where: {
        folderId,
        status: 'completed',
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
      },
    });

    return documents;
  }
}

export default new FolderSummaryService();
