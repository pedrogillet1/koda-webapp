/**
 * Metadata Query Service
 * Handles queries about file organization (categories, folders, file lists)
 * WITHOUT using RAG - direct database queries
 */

// @ts-nocheck - Temporary: TypeScript has issues with Prisma circular references
import prisma from '../config/database';

interface MetadataQueryResult {
  answer: string;
  metadata: {
    type: 'file_list' | 'category_list' | 'folder_list' | 'count';
    items: any[];
    totalCount: number;
  };
}

class MetadataQueryService {
  /**
   * Handle metadata query - list files in a category
   */
  async listFilesInCategory(userId: string, categoryName: string): Promise<MetadataQueryResult> {
    console.log(`📂 Listing files in category: "${categoryName}"`);

    // Find the category (tag)
    const category = await prisma.tag.findFirst({
      where: {
        userId,
        name: categoryName
      }
    });

    if (!category) {
      return {
        answer: `❌ **Category Not Found**\n\nI couldn't find a category named "${categoryName}".\n\nWould you like me to:\n- List all your categories?\n- Search for files with similar names?`,
        metadata: {
          type: 'file_list',
          items: [],
          totalCount: 0
        }
      };
    }

    // Get documents with this category
    const documentTags = await prisma.documentTag.findMany({
      where: { tagId: category.id },
      include: {
        document: {
          include: {
            metadata: true
          }
        }
      }
    });

    if (documentTags.length === 0) {
      return {
        answer: `📂 **Category: ${categoryName}**\n\nThis category exists but has no files yet.\n\nYou can add files to this category from the Documents page.`,
        metadata: {
          type: 'file_list',
          items: [],
          totalCount: 0
        }
      };
    }

    // Format the response
    const fileList = documentTags.map((dt) => {
      return `• ${dt.document.filename}`;
    }).join('\n');

    const count = documentTags.length;
    const header = count === 1 ? `Files in category "${categoryName}" (1 file):` : `Files in category "${categoryName}" (${count} files):`;
    const answer = `${header}\n${fileList}`;

    return {
      answer,
      metadata: {
        type: 'file_list',
        items: documentTags.map(dt => ({
          id: dt.document.id,
          filename: dt.document.filename,
          mimeType: dt.document.mimeType,
          fileSize: dt.document.fileSize,
          createdAt: dt.document.createdAt
        })),
        totalCount: documentTags.length
      }
    };
  }

  /**
   * List all categories with file counts
   */
  async listAllCategories(userId: string): Promise<MetadataQueryResult> {
    console.log(`📋 Listing all categories for user`);

    const tags = await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { documents: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (tags.length === 0) {
      return {
        answer: `📋 **Your Categories**\n\nYou don't have any categories yet.\n\nYou can create categories to organize your documents from the Documents page.`,
        metadata: {
          type: 'category_list',
          items: [],
          totalCount: 0
        }
      };
    }

    const categoryList = tags.map((tag, index) => {
      const fileCount = tag._count.documents;
      const emoji = tag.color ? this.getEmojiForColor(tag.color) : '📁';
      return `${index + 1}. ${emoji} **${tag.name}** • ${fileCount} file${fileCount === 1 ? '' : 's'}`;
    }).join('\n');

    const totalFiles = tags.reduce((sum, tag) => sum + tag._count.documents, 0);

    const answer = `📋 **Your Categories**\n\n${categoryList}\n\n**Total:** ${tags.length} categor${tags.length === 1 ? 'y' : 'ies'} • ${totalFiles} file${totalFiles === 1 ? '' : 's'}\n\n💡 *Ask me "what's inside category [name]" to see files in a specific category.*`;

    return {
      answer,
      metadata: {
        type: 'category_list',
        items: tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          fileCount: tag._count.documents
        })),
        totalCount: tags.length
      }
    };
  }

  /**
   * List all files (optionally filtered by type)
   */
  async listAllFiles(userId: string, mimeTypes?: string[]): Promise<MetadataQueryResult> {
    console.log(`📄 Listing files${mimeTypes ? ` (types: ${mimeTypes.join(', ')})` : ''}`);

    const where: any = { userId };
    if (mimeTypes && mimeTypes.length > 0) {
      where.mimeType = { in: mimeTypes };
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        metadata: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to 50 most recent
    });

    if (documents.length === 0) {
      const typeFilter = mimeTypes ? ` ${this.getMimeTypeDescription(mimeTypes)}` : '';
      return {
        answer: `You don't have any${typeFilter} files yet.`,
        metadata: {
          type: 'file_list',
          items: [],
          totalCount: 0
        }
      };
    }

    const fileList = documents.map((doc) => {
      return `• ${doc.filename}`;
    }).join('\n');

    const typeFilter = mimeTypes ? ` (${this.getMimeTypeDescription(mimeTypes)})` : '';
    const count = documents.length;
    const header = count === 1 ? `You have one file${typeFilter}:` : `You have ${count} files${typeFilter}:`;
    const answer = `${header}\n${fileList}`;

    return {
      answer,
      metadata: {
        type: 'file_list',
        items: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt
        })),
        totalCount: documents.length
      }
    };
  }

  /**
   * Get file count statistics
   */
  async getFileCount(userId: string): Promise<MetadataQueryResult> {
    console.log(`🔢 Counting files for user`);

    const [totalFiles, categories, filesByType] = await Promise.all([
      prisma.document.count({ where: { userId } }),
      prisma.tag.count({ where: { userId } }),
      prisma.document.groupBy({
        by: ['mimeType'],
        where: { userId },
        _count: { id: true }
      })
    ]);

    const typeBreakdown = filesByType
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 5)
      .map(item => {
        const typeName = this.getMimeTypeDescription([item.mimeType || 'unknown']);
        return `- ${typeName}: ${item._count.id} file${item._count.id === 1 ? '' : 's'}`;
      })
      .join('\n');

    const answer = `📊 **Your Document Statistics**\n\n**Total Files:** ${totalFiles}\n**Categories:** ${categories}\n\n**By Type:**\n${typeBreakdown}\n\n💡 *Use "list all files" to see your documents.*`;

    return {
      answer,
      metadata: {
        type: 'count',
        items: filesByType,
        totalCount: totalFiles
      }
    };
  }

  /**
   * Get emoji for color
   */
  private getEmojiForColor(color: string): string {
    const colorMap: { [key: string]: string } = {
      'red': '🔴',
      'orange': '🟠',
      'yellow': '🟡',
      'green': '🟢',
      'blue': '🔵',
      'purple': '🟣',
      'pink': '🌸',
      'gray': '⚪',
    };

    return colorMap[color.toLowerCase()] || '📁';
  }

  /**
   * Main entry point for handling metadata queries
   * Routes to appropriate specialized methods based on query patterns
   */
  async handleQuery(query: string, userId: string, metadata?: any): Promise<{
    answer: string;
    sources?: any[];
    actions?: any[];
  }> {
    console.log(`🗄️  [METADATA] Handling query: "${query}"`);

    // Route based on metadata from classifier
    if (metadata?.mimeType) {
      // Filter by file type
      const mimeTypes = Array.isArray(metadata.mimeType) ? metadata.mimeType : [metadata.mimeType];
      return await this.listAllFiles(userId, mimeTypes);
    }

    if (metadata?.filename) {
      // Find specific file location
      return await this.findDocumentLocation(userId, metadata.filename);
    }

    if (metadata?.categoryName) {
      // List files in category
      return await this.listFilesInCategory(userId, metadata.categoryName);
    }

    // Check query patterns
    const normalized = query.toLowerCase().trim();

    // File count queries
    if (
      /^how many (files|documents)(\?)?$/i.test(normalized) ||
      /^(file|document) count$/i.test(normalized)
    ) {
      return await this.getFileCount(userId);
    }

    // Category list queries
    if (
      /^(list|show|what) (my )?(categories|tags)(\?)?$/i.test(normalized) ||
      /^what categories/i.test(normalized)
    ) {
      return await this.listAllCategories(userId);
    }

    // Folder list queries
    if (
      /^(list|show|what) (my )?(folders)(\?)?$/i.test(normalized) ||
      /^what folders/i.test(normalized)
    ) {
      return await this.listAllFolders(userId);
    }

    // Default: list all files
    return await this.listAllFiles(userId);
  }

  /**
   * Get human-readable description for MIME types
   */
  private getMimeTypeDescription(mimeTypes: string[]): string {
    const descriptions = mimeTypes.map(mt => {
      if (mt.includes('pdf')) return 'PDF';
      if (mt.includes('word')) return 'Word';
      if (mt.includes('sheet')) return 'Excel';
      if (mt.includes('presentation')) return 'PowerPoint';
      if (mt.includes('text')) return 'Text';
      if (mt.includes('image')) return 'Image';
      return mt.split('/')[1]?.toUpperCase() || 'Unknown';
    });

    return descriptions.join(', ');
  }

  /**
   * List all folders with full hierarchical paths
   * Task #4: Folder-aware queries with deterministic file system introspection
   */
  async listAllFolders(userId: string): Promise<MetadataQueryResult> {
    console.log(`📁 Listing all folders with paths for user`);

    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            documents: true,
            subfolders: true
          }
        },
        parentFolder: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (folders.length === 0) {
      return {
        answer: `📁 **Your Folders**\n\nYou don't have any folders yet.\n\nCreate folders to organize your documents from the Documents page.`,
        metadata: {
          type: 'folder_list',
          items: [],
          totalCount: 0
        }
      };
    }

    // Build folder paths
    const folderPaths = await Promise.all(
      folders.map(async (folder) => {
        const path = await this.buildFolderPath(folder.id, userId);
        return {
          folder,
          path
        };
      })
    );

    // Organize by hierarchy (root folders first, then children)
    const rootFolders = folderPaths.filter(fp => !fp.folder.parentFolderId);
    const childFolders = folderPaths.filter(fp => fp.folder.parentFolderId);

    let answer = `📁 **Your Folder Structure**\n\n`;

    // List root folders
    if (rootFolders.length > 0) {
      answer += `**Root Folders:**\n`;
      rootFolders.forEach(({ folder, path }) => {
        const emoji = folder.emoji || '📁';
        const docCount = folder._count.documents;
        const subfolderCount = folder._count.subfolders;
        answer += `${emoji} **${folder.name}**\n`;
        answer += `   📍 Path: ${path}\n`;
        answer += `   📄 ${docCount} file${docCount === 1 ? '' : 's'}`;
        if (subfolderCount > 0) {
          answer += ` • 📁 ${subfolderCount} subfolder${subfolderCount === 1 ? '' : 's'}`;
        }
        answer += `\n\n`;
      });
    }

    // List child folders organized by parent
    if (childFolders.length > 0) {
      answer += `**Subfolders:**\n`;
      childFolders.forEach(({ folder, path }) => {
        const emoji = folder.emoji || '📂';
        const docCount = folder._count.documents;
        answer += `${emoji} **${folder.name}**\n`;
        answer += `   📍 Path: ${path}\n`;
        answer += `   📄 ${docCount} file${docCount === 1 ? '' : 's'}\n\n`;
      });
    }

    const totalDocs = folders.reduce((sum, f) => sum + f._count.documents, 0);
    answer += `**Total:** ${folders.length} folder${folders.length === 1 ? '' : 's'} • ${totalDocs} file${totalDocs === 1 ? '' : 's'}`;

    return {
      answer,
      metadata: {
        type: 'folder_list',
        items: folderPaths.map(({ folder, path }) => ({
          id: folder.id,
          name: folder.name,
          path,
          emoji: folder.emoji,
          documentCount: folder._count.documents,
          subfolderCount: folder._count.subfolders
        })),
        totalCount: folders.length
      }
    };
  }

  /**
   * Find document location by filename
   * Task #5: Document location queries with exact folder paths
   */
  async findDocumentLocation(userId: string, filename: string): Promise<MetadataQueryResult> {
    console.log(`📍 Finding location for document: "${filename}"`);

    // Search for documents with similar filenames
    const documents = await prisma.document.findMany({
      where: {
        userId,
        filename: {
          contains: filename
        }
      },
      include: {
        folder: {
          include: {
            parentFolder: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        metadata: true
      },
      take: 10
    });

    if (documents.length === 0) {
      return {
        answer: `📍 **Document Not Found**\n\nI couldn't find any documents matching "${filename}".\n\nTry:\n- Checking the spelling\n- Using fewer words\n- Listing all files to browse`,
        metadata: {
          type: 'file_list',
          items: [],
          totalCount: 0
        }
      };
    }

    // Build answer with exact locations
    let answer = `📍 **Document Location${documents.length > 1 ? 's' : ''}**\n\n`;

    if (documents.length > 1) {
      answer += `Found ${documents.length} matching documents:\n\n`;
    }

    for (const doc of documents) {
      answer += `📄 **${doc.filename}**\n`;

      // Build full folder path
      if (doc.folderId && doc.folder) {
        const folderPath = await this.buildFolderPath(doc.folderId, userId);
        answer += `   📁 Location: ${folderPath}\n`;
      } else {
        answer += `   📁 Location: Root / Uncategorized\n`;
      }

      // Add file details
      const fileSize = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown size';
      const pageCount = doc.metadata?.pageCount ? ` • ${doc.metadata.pageCount} pages` : '';
      answer += `   📊 ${fileSize}${pageCount}\n`;
      answer += `   📅 Added: ${doc.createdAt.toLocaleDateString()}\n\n`;
    }

    return {
      answer,
      metadata: {
        type: 'file_list',
        items: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          folderId: doc.folderId,
          folderName: doc.folder?.name,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt
        })),
        totalCount: documents.length
      }
    };
  }

  /**
   * List files in a specific folder by path
   * Task #4: Folder-aware queries with exact paths
   */
  async listFilesInFolderPath(userId: string, folderPath: string): Promise<MetadataQueryResult> {
    console.log(`📂 Listing files in folder path: "${folderPath}"`);

    // Parse folder path (e.g., "Work/Projects/2024")
    const pathParts = folderPath.split('/').filter(p => p.trim());

    if (pathParts.length === 0) {
      // List root files
      return await this.listRootFiles(userId);
    }

    // Find the folder by following the path
    let currentFolder: { id: string; name: string; emoji: string | null } | null = null;
    let currentParentId: string | null = null;

    for (const folderName of pathParts) {
      type FolderResult = { id: string; name: string; emoji: string | null } | null;
      const folder: FolderResult = await prisma.folder.findFirst({
        where: {
          userId,
          name: { equals: folderName },
          parentFolderId: currentParentId
        },
        select: {
          id: true,
          name: true,
          emoji: true
        }
      });

      if (!folder) {
        return {
          answer: `📂 **Folder Not Found**\n\nCouldn't find folder "${folderName}" in path "${folderPath}".\n\nThe folder structure may have changed or the path may be incorrect.`,
          metadata: {
            type: 'file_list',
            items: [],
            totalCount: 0
          }
        };
      }

      currentFolder = folder;
      currentParentId = folder.id;
    }

    // Guard against null currentFolder
    if (!currentFolder) {
      return {
        answer: `📂 **Folder Not Found**\n\nCouldn't complete the folder path "${folderPath}".`,
        metadata: {
          type: 'file_list',
          items: [],
          totalCount: 0
        }
      };
    }

    // Get files in the found folder
    const documents = await prisma.document.findMany({
      where: {
        userId,
        folderId: currentFolder.id
      },
      include: {
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get subfolders
    const subfolders = await prisma.folder.findMany({
      where: {
        userId,
        parentFolderId: currentFolder.id
      },
      orderBy: { name: 'asc' }
    });

    let answer = `📂 **${currentFolder.name}**\n`;
    answer += `📍 **Path:** ${folderPath}\n\n`;

    if (subfolders.length > 0) {
      answer += `**📁 Subfolders (${subfolders.length}):**\n`;
      subfolders.forEach(sf => {
        const emoji = sf.emoji || '📁';
        answer += `   ${emoji} ${sf.name}\n`;
      });
      answer += `\n`;
    }

    if (documents.length > 0) {
      answer += `**📄 Files (${documents.length}):**\n\n`;
      documents.forEach((doc, idx) => {
        answer += `${idx + 1}. **${doc.filename}**\n`;
        const fileSize = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown';
        const pageCount = doc.metadata?.pageCount ? ` • ${doc.metadata.pageCount} pages` : '';
        answer += `   📊 ${fileSize}${pageCount}\n`;
        answer += `   📅 ${doc.createdAt.toLocaleDateString()}\n\n`;
      });
    } else {
      answer += `**📄 Files:** None\n\n`;
    }

    if (documents.length === 0 && subfolders.length === 0) {
      answer += `This folder is empty.`;
    }

    return {
      answer,
      metadata: {
        type: 'file_list',
        items: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt
        })),
        totalCount: documents.length
      }
    };
  }

  /**
   * List files in root (not in any folder)
   */
  private async listRootFiles(userId: string): Promise<MetadataQueryResult> {
    const documents = await prisma.document.findMany({
      where: {
        userId,
        folderId: null
      },
      include: {
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    });

    let answer = `📂 **Root Level Files**\n\n`;

    if (documents.length > 0) {
      answer += `**📄 Files (${documents.length}):**\n\n`;
      documents.forEach((doc, idx) => {
        answer += `${idx + 1}. **${doc.filename}**\n`;
        const fileSize = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown';
        const pageCount = doc.metadata?.pageCount ? ` • ${doc.metadata.pageCount} pages` : '';
        answer += `   📊 ${fileSize}${pageCount}\n`;
        answer += `   📅 ${doc.createdAt.toLocaleDateString()}\n\n`;
      });
    } else {
      answer += `No files in root level.`;
    }

    return {
      answer,
      metadata: {
        type: 'file_list',
        items: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt
        })),
        totalCount: documents.length
      }
    };
  }

  /**
   * Build full folder path recursively
   */
  private async buildFolderPath(folderId: string, userId: string): Promise<string> {
    const pathParts: string[] = [];
    let currentFolderId: string | null = folderId;

    while (currentFolderId) {
      const folder: { name: string; parentFolderId: string | null } | null = await prisma.folder.findFirst({
        where: { id: currentFolderId, userId },
        select: {
          name: true,
          parentFolderId: true
        }
      });

      if (!folder) break;

      pathParts.unshift(folder.name);
      currentFolderId = folder.parentFolderId;
    }

    return pathParts.length > 0 ? pathParts.join(' / ') : 'Root';
  }
}

export default new MetadataQueryService();
export { MetadataQueryService };
