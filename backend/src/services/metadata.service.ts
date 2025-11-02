/**
 * Metadata Service
 *
 * Handles database queries for file metadata, locations, and folder contents.
 * This service is used to answer metadata queries WITHOUT using RAG/Pinecone.
 *
 * Examples of metadata queries:
 * - "where is comprovante1"
 * - "how many files do I have"
 * - "what files are in the pedro1 folder"
 * - "show me all PDFs"
 *
 * This prevents hallucination by querying the database directly instead of using
 * semantic search which can return wrong results.
 */

import prisma from '../config/database';

export interface FileMetadata {
  id: string;
  filename: string;
  folderId: string | null;
  folderName: string | null;
  folderPath: string | null;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
}

export interface FolderContents {
  folderName: string;
  folderId: string;
  files: FileMetadata[];
  subfolders: {
    id: string;
    name: string;
    documentCount: number;
  }[];
}

export class MetadataService {
  /**
   * Find a file by name (exact or partial match)
   * Returns file location and metadata
   */
  async findFileByName(userId: string, filename: string): Promise<FileMetadata[]> {
    console.log(`🔍 [MetadataService] Searching for file: "${filename}" for user: ${userId}`);

    try {
      // Search for files with partial match (case insensitive)
      const files = await prisma.document.findMany({
        where: {
          userId,
          status: { not: 'deleted' },
          filename: {
            contains: filename,
          },
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
              path: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log(`📊 [MetadataService] Found ${files.length} matching files`);

      return files.map((file) => ({
        id: file.id,
        filename: file.filename,
        folderId: file.folderId,
        folderName: file.folder?.name || null,
        folderPath: file.folder?.path || null,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        createdAt: file.createdAt,
      }));
    } catch (error) {
      console.error(`❌ [MetadataService] Error finding file "${filename}":`, error);
      console.error(`   Error details:`, error instanceof Error ? error.message : error);
      throw error; // Re-throw so handleMetadataQuery can catch it
    }
  }

  /**
   * Get total file count for a user
   */
  async getFileCount(userId: string): Promise<number> {
    console.log(`📊 [MetadataService] Counting files for user: ${userId}`);

    const count = await prisma.document.count({
      where: {
        userId,
        status: { not: 'deleted' },
      },
    });

    console.log(`📊 [MetadataService] User has ${count} files`);
    return count;
  }

  /**
   * Get file count by type (PDF, Excel, Word, etc.)
   */
  async getFileCountByType(userId: string, mimeType?: string): Promise<{ mimeType: string; count: number }[]> {
    console.log(`📊 [MetadataService] Counting files by type for user: ${userId}`);

    if (mimeType) {
      // Count specific type
      const count = await prisma.document.count({
        where: {
          userId,
          status: { not: 'deleted' },
          mimeType: {
            contains: mimeType,
          },
        },
      });

      return [{ mimeType, count }];
    }

    // Count all types
    const files = await prisma.document.groupBy({
      by: ['mimeType'],
      where: {
        userId,
        status: { not: 'deleted' },
      },
      _count: {
        mimeType: true,
      },
    });

    return files.map((file) => ({
      mimeType: file.mimeType,
      count: file._count.mimeType,
    }));
  }

  /**
   * Get folder contents (files and subfolders)
   */
  async getFolderContents(userId: string, folderName: string): Promise<FolderContents | null> {
    console.log(`📁 [MetadataService] Getting contents of folder: "${folderName}" for user: ${userId}`);

    // Find folder by name (case insensitive)
    const folder = await prisma.folder.findFirst({
      where: {
        userId,
        name: {
          contains: folderName,
        },
      },
    });

    if (!folder) {
      console.log(`❌ [MetadataService] Folder "${folderName}" not found`);
      return null;
    }

    // Get files in folder
    const files = await prisma.document.findMany({
      where: {
        userId,
        folderId: folder.id,
        status: { not: 'deleted' },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get subfolders
    const subfolders = await prisma.folder.findMany({
      where: {
        userId,
        parentFolderId: folder.id,
      },
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    console.log(`📊 [MetadataService] Folder "${folderName}" has ${files.length} files and ${subfolders.length} subfolders`);

    return {
      folderName: folder.name,
      folderId: folder.id,
      files: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        folderId: file.folderId,
        folderName: folder.name,
        folderPath: folder.path,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        createdAt: file.createdAt,
      })),
      subfolders: subfolders.map((subfolder) => ({
        id: subfolder.id,
        name: subfolder.name,
        documentCount: subfolder._count.documents,
      })),
    };
  }

  /**
   * Get all folders for a user
   */
  async getAllFolders(userId: string): Promise<{ id: string; name: string; path: string | null; documentCount: number }[]> {
    console.log(`📁 [MetadataService] Getting all folders for user: ${userId}`);

    const folders = await prisma.folder.findMany({
      where: {
        userId,
      },
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      path: folder.path,
      documentCount: folder._count.documents,
    }));
  }

  /**
   * Get all files for a user (paginated)
   */
  async getAllFiles(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: 'createdAt' | 'filename' | 'fileSize';
      order?: 'asc' | 'desc';
    }
  ): Promise<FileMetadata[]> {
    console.log(`📄 [MetadataService] Getting all files for user: ${userId}`);

    const files = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            path: true,
          },
        },
      },
      orderBy: {
        [options?.orderBy || 'createdAt']: options?.order || 'desc',
      },
      skip: options?.skip || 0,
      take: options?.take || 100,
    });

    return files.map((file) => ({
      id: file.id,
      filename: file.filename,
      folderId: file.folderId,
      folderName: file.folder?.name || null,
      folderPath: file.folder?.path || null,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      createdAt: file.createdAt,
    }));
  }

  /**
   * Format metadata query response
   * Generates a natural language response with file metadata
   */
  formatMetadataResponse(query: string, data: any): string {
    const queryLower = query.toLowerCase();

    // File location query: "where is X"
    if (queryLower.includes('where is') || queryLower.includes('where can i find')) {
      if (!data || data.length === 0) {
        return `I couldn't find any files matching that name in your documents.`;
      }

      if (data.length === 1) {
        const file = data[0];
        const location = file.folderName ? `**${file.folderName}** folder` : 'your root directory';
        return `**${file.filename}** is located in ${location}.`;
      }

      // Multiple files found
      const response = `Found **${data.length} files** matching that name:\n\n`;
      const bullets = data
        .map((file: FileMetadata) => {
          const location = file.folderName ? `**${file.folderName}** folder` : 'root directory';
          return `• **${file.filename}** — ${location}`;
        })
        .join('\n');

      return response + bullets;
    }

    // File count query: "how many files"
    if (queryLower.includes('how many files') || queryLower.includes('file count')) {
      return `You have **${data} files** in your document library.`;
    }

    // Folder contents query: "what's in folder X" / "which files are inside X"
    if (queryLower.includes('what is inside') ||
        queryLower.includes('what files are in') ||
        queryLower.includes('which files are in') ||
        queryLower.includes('which files are inside') ||
        queryLower.includes('show me the contents') ||
        queryLower.includes('files inside')) {
      if (!data) {
        return `I couldn't find that folder in your documents.`;
      }

      const { folderName, files, subfolders } = data;

      if (files.length === 0 && subfolders.length === 0) {
        return `The **${folderName}** folder is empty.`;
      }

      let response = `Contents of **${folderName}** folder:\n\n`;

      if (files.length > 0) {
        response += `**Files (${files.length}):**\n`;
        response += files.map((file: FileMetadata) => `• **${file.filename}**`).join('\n');
      }

      if (subfolders.length > 0) {
        if (files.length > 0) response += '\n\n';
        response += `**Subfolders (${subfolders.length}):**\n`;
        response += subfolders.map((folder: any) => `• **${folder.name}** (${folder.documentCount} files)`).join('\n');
      }

      return response;
    }

    // Default: return data as-is
    return JSON.stringify(data, null, 2);
  }
}

export default new MetadataService();
