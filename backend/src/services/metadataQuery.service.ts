/**
 * Metadata Query Service
 * Handles queries about file organization (categories, folders, file lists)
 * WITHOUT using RAG - direct database queries
 */

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
        name: {
          equals: categoryName,
          mode: 'insensitive' // Case-insensitive search
        }
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
    const fileList = documentTags.map((dt, index) => {
      const doc = dt.document;
      const fileSize = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown size';
      const pageCount = doc.metadata?.pageCount ? ` • ${doc.metadata.pageCount} pages` : '';

      return `${index + 1}. **${doc.filename}**\n   📄 ${doc.mimeType?.split('/')[1]?.toUpperCase() || 'File'} • ${fileSize}${pageCount}`;
    }).join('\n\n');

    const answer = `📂 **Files in Category: ${categoryName}**\n\n${fileList}\n\n**Total:** ${documentTags.length} file${documentTags.length === 1 ? '' : 's'}\n\n💡 *Click on any file to view or download it.*`;

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
      const typeFilter = mimeTypes ? ` of type ${this.getMimeTypeDescription(mimeTypes)}` : '';
      return {
        answer: `📄 **Your Files**\n\nYou don't have any files${typeFilter} yet.\n\nUpload documents to get started!`,
        metadata: {
          type: 'file_list',
          items: [],
          totalCount: 0
        }
      };
    }

    const fileList = documents.map((doc, index) => {
      const fileSize = doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown size';
      const pageCount = doc.metadata?.pageCount ? ` • ${doc.metadata.pageCount} pages` : '';
      const categories = doc.tags.map(dt => dt.tag.name).join(', ');
      const categoryLine = categories ? `\n   📂 ${categories}` : '';

      return `${index + 1}. **${doc.filename}**\n   📄 ${doc.mimeType?.split('/')[1]?.toUpperCase() || 'File'} • ${fileSize}${pageCount}${categoryLine}`;
    }).join('\n\n');

    const typeFilter = mimeTypes ? ` (${this.getMimeTypeDescription(mimeTypes)})` : '';
    const answer = `📄 **Your Files${typeFilter}**\n\n${fileList}\n\n**Total:** ${documents.length} file${documents.length === 1 ? '' : 's'}${documents.length === 50 ? ' (showing 50 most recent)' : ''}\n\n💡 *Click on any file to view or download it.*`;

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
}

export default new MetadataQueryService();
export { MetadataQueryService };
