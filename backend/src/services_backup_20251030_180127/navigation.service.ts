/**
 * Navigation Service
 * Helps locate files and folders, and provides navigation actions
 */

import prisma from '../config/database';

export interface NavigationAction {
  type: 'open_file' | 'navigate_folder';
  label: string;
  documentId?: string;
  folderId?: string;
}

export interface NavigationResult {
  found: boolean;
  message: string;
  actions: NavigationAction[];
  folderPath?: string[];
}

class NavigationService {
  /**
   * Find a file by name (fuzzy matching)
   */
  async findFile(userId: string, filename: string): Promise<NavigationResult> {
    // Search for files matching the name with full metadata
    const documents = await prisma.documents.findMany({
      where: {
        userId,
        status: 'completed',
      },
      include: {
        folders: true,
        categories: {
          include: {
            category: true
          }
        },
      },
    });

    // Fuzzy match filename
    const filenameLower = filename.toLowerCase();
    const matches = documents.filter(doc =>
      doc.filename.toLowerCase().includes(filenameLower)
    );

    if (matches.length === 0) {
      return {
        found: false,
        message: `I couldn't find a file named "${filename}". Please check the spelling or try a different search term.`,
        actions: [],
      };
    }

    // Get the best match (exact match or first result)
    const bestMatch = matches.find(doc =>
      doc.filename.toLowerCase() === filenameLower
    ) || matches[0];

    // Build folder path
    const folderPath = await this.getFolderPath(bestMatch.folderId);

    // Determine location text with rich context
    let locationText = '';
    if (folderPath.length > 0) {
      locationText = `in the **${folderPath.join(' > ')}** folder`;
    } else {
      locationText = 'in **Recently Added**';
    }

    // Get categories
    const categories = bestMatch.categories.map(c => c.category.name);
    const categoryText = categories.length > 0
      ? `\n\nThis file is tagged as: **${categories.join(', ')}**`
      : '';

    const message = matches.length === 1
      ? `The file **${bestMatch.filename}** is located ${locationText}.${categoryText}`
      : `I found ${matches.length} files matching "${filename}". The closest match is **${bestMatch.filename}** located ${locationText}.${categoryText}`;

    return {
      found: true,
      message,
      actions: [
        {
          type: 'open_file',
          label: 'View File',
          documentId: bestMatch.id,
        },
        ...(bestMatch.folderId ? [{
          type: 'navigate_folder' as const,
          label: 'Go to Folder',
          folderId: bestMatch.folderId,
        }] : []),
      ],
      folderPath,
    };
  }

  /**
   * Find a folder by name and show its contents
   */
  async findFolder(userId: string, folderName: string): Promise<NavigationResult> {
    const folders = await prisma.folders.findMany({
      where: {
        userId,
      },
      include: {
        documents: {
          where: { status: 'completed' },
          select: { id: true, filename: true },
        },
        subfolders: {
          select: { id: true, name: true },
        },
      },
    });

    // Fuzzy match folder name
    const folderNameLower = folderName.toLowerCase();
    const matches = folders.filter(folder =>
      folder.name.toLowerCase().includes(folderNameLower)
    );

    if (matches.length === 0) {
      return {
        found: false,
        message: `I couldn't find a folder named "${folderName}". Please check the spelling or try a different search term.`,
        actions: [],
      };
    }

    const bestMatch = matches[0];
    const fileCount = bestMatch.documents.length;
    const subfolderCount = bestMatch.subfolders.length;

    // Build folder path
    const folderPath = await this.getFolderPath(bestMatch.id);

    // Build detailed contents list
    let contentsText = '';

    if (fileCount === 0 && subfolderCount === 0) {
      contentsText = 'The folder is currently empty.';
    } else {
      const contentsParts: string[] = [];

      // List documents
      if (fileCount > 0) {
        const docList = bestMatch.documents.map(doc => `- ${doc.filename}`).join('\n');
        contentsParts.push(`**Documents (${fileCount}):**\n${docList}`);
      }

      // List subfolders
      if (subfolderCount > 0) {
        const folderList = bestMatch.subfolders.map(folder => `- ${folder.name}`).join('\n');
        contentsParts.push(`**Subfolders (${subfolderCount}):**\n${folderList}`);
      }

      contentsText = `The folder **${bestMatch.name}** contains:\n\n${contentsParts.join('\n\n')}`;
    }

    const message = contentsText;

    return {
      found: true,
      message,
      actions: [
        {
          type: 'navigate_folder',
          label: 'Open Folder',
          folderId: bestMatch.id,
        },
      ],
      folderPath,
    };
  }

  /**
   * Get folder path breadcrumbs
   */
  private async getFolderPath(folderId: string | null): Promise<string[]> {
    if (!folderId) return [];

    const path: string[] = [];
    let currentFolderId: string | null = folderId;

    while (currentFolderId) {
      type FolderResult = { name: string; parentFolderId: string | null } | null;
      const folder: FolderResult = await prisma.folders.findUnique({
        where: { id: currentFolderId },
        select: { name: true, parentFolderId: true },
      });

      if (!folder) break;

      path.unshift(folder.name);
      currentFolderId = folder.parentFolderId;
    }

    return path;
  }

  /**
   * Get all files and folders for AI context
   */
  async getWorkspaceStructure(userId: string) {
    const [documents, folders] = await Promise.all([
      prisma.documents.findMany({
        where: { userId, status: 'completed' },
        select: {
          id: true,
          filename: true,
          folderId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.folders.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          parentFolderId: true,
          emoji: true,
          _count: {
            select: { documents: true, subfolders: true },
          },
        },
      }),
    ]);

    // Build folder hierarchy
    const folderMap = new Map(folders.map(f => [f.id, f]));
    const rootFolders = folders.filter(f => !f.parentFolderId);

    interface FolderHierarchy {
      id: string;
      name: string;
      emoji: string | null;
      fileCount: number;
      subfolders: FolderHierarchy[];
    }

    const buildHierarchy = (folder: typeof folders[0]): FolderHierarchy => {
      const subfolders = folders
        .filter(f => f.parentFolderId === folder.id)
        .map(buildHierarchy);

      return {
        id: folder.id,
        name: folder.name,
        emoji: folder.emoji,
        fileCount: folder._count.documents,
        subfolders,
      };
    };

    const hierarchy = rootFolders.map(buildHierarchy);

    // Group files by folder
    const filesByFolder: { [key: string]: any[] } = {};
    const rootFiles: any[] = [];

    documents.forEach(doc => {
      if (doc.folderId) {
        if (!filesByFolder[doc.folderId]) {
          filesByFolder[doc.folderId] = [];
        }
        filesByFolder[doc.folderId].push(doc);
      } else {
        rootFiles.push(doc);
      }
    });

    return {
      totalFiles: documents.length,
      totalFolders: folders.length,
      hierarchy,
      filesByFolder,
      rootFiles,
      allFiles: documents,
      allFolders: folders,
    };
  }
}

export default new NavigationService();
export { NavigationService };
