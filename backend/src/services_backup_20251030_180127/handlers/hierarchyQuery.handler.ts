/**
 * Hierarchy Query Handler
 * Handles "show me my document structure" queries for Issue #2
 */

import { PrismaClient } from '@prisma/client';
import { RAGResponse, ActionType } from '../../types/rag.types';
import { getFolderPath } from '../../utils/rag.utils';

const prisma = new PrismaClient();

class HierarchyQueryHandler {
  /**
   * Handle hierarchy queries like "show me my document structure"
   */
  async handle(userId: string): Promise<RAGResponse> {
    console.log(`\n🌲 HIERARCHY QUERY: Building document structure for user ${userId.substring(0, 8)}...`);

    // Get all categories
    const categories = await prisma.category.findMany({
      where: { userId: userId },
      include: {
        _count: {
          select: {
            documents: true,
            folders: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Get all root folders (no parent)
    const rootFolders = await prisma.folder.findMany({
      where: {
        userId: userId,
        parentId: null
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            emoji: true
          }
        },
        _count: {
          select: {
            documents: true,
            subfolders: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Get total document count
    const totalDocuments = await prisma.document.count({
      where: { userId: userId }
    });

    // Build response
    let answer = `📊 **Your Document Structure**\n\n`;
    answer += `**Total Documents:** ${totalDocuments}\n`;
    answer += `**Categories:** ${categories.length}\n`;
    answer += `**Root Folders:** ${rootFolders.length}\n\n`;

    // List categories
    if (categories.length > 0) {
      answer += `**📁 Categories:**\n\n`;

      for (const category of categories) {
        const emoji = category.emoji || '📁';
        answer += `${emoji} **${category.name}**\n`;
        answer += `   • ${category._count.folders} folders, ${category._count.documents} documents\n`;
      }

      answer += `\n`;
    }

    // List root folders by category
    if (rootFolders.length > 0) {
      answer += `**📂 Folder Structure:**\n\n`;

      // Group by category
      const byCategory = new Map<string, typeof rootFolders>();

      for (const folder of rootFolders) {
        const categoryId = folder.category?.id || 'uncategorized';
        const existing = byCategory.get(categoryId) || [];
        existing.push(folder);
        byCategory.set(categoryId, existing);
      }

      for (const category of categories) {
        const folders = byCategory.get(category.id) || [];

        if (folders.length > 0) {
          const emoji = category.emoji || '📁';
          answer += `**${emoji} ${category.name}:**\n`;

          for (const folder of folders) {
            answer += `   └─ ${folder.name}`;
            if (folder._count.subfolders > 0) {
              answer += ` (${folder._count.subfolders} subfolders)`;
            }
            if (folder._count.documents > 0) {
              answer += ` [${folder._count.documents} docs]`;
            }
            answer += `\n`;
          }

          answer += `\n`;
        }
      }

      // Uncategorized folders
      const uncategorized = byCategory.get('uncategorized') || [];
      if (uncategorized.length > 0) {
        answer += `**📁 Uncategorized:**\n`;
        for (const folder of uncategorized) {
          answer += `   └─ ${folder.name}`;
          if (folder._count.subfolders > 0) {
            answer += ` (${folder._count.subfolders} subfolders)`;
          }
          if (folder._count.documents > 0) {
            answer += ` [${folder._count.documents} docs]`;
          }
          answer += `\n`;
        }
        answer += `\n`;
      }
    }

    answer += `Would you like to explore any specific category or folder?`;

    // Create action buttons
    const actions: any[] = [];

    // Buttons for top 3 categories
    categories.slice(0, 3).forEach(category => {
      const emoji = category.emoji || '📁';
      actions.push({
        label: `Open ${category.name}`,
        action: ActionType.OPEN_CATEGORY,
        categoryId: category.id,
        variant: 'outline' as const,
        icon: emoji
      });
    });

    // Buttons for top 3 root folders
    rootFolders.slice(0, 3).forEach(folder => {
      actions.push({
        label: `Open ${folder.name}`,
        action: ActionType.OPEN_FOLDER,
        folderId: folder.id,
        variant: 'outline' as const,
        icon: '📂'
      });
    });

    return {
      answer: answer,
      sources: [],
      actions: actions
    };
  }

  /**
   * Get detailed folder tree for a specific folder
   */
  async getFolderTree(folderId: string, userId: string, depth: number = 2): Promise<any> {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        category: true,
        _count: {
          select: {
            documents: true,
            subfolders: true
          }
        }
      }
    });

    if (!folder || folder.userId !== userId) {
      return null;
    }

    const tree: any = {
      id: folder.id,
      name: folder.name,
      documentCount: folder._count.documents,
      subfolderCount: folder._count.subfolders,
      category: folder.category,
      subfolders: []
    };

    // Recursively get subfolders if depth > 0
    if (depth > 0 && folder._count.subfolders > 0) {
      const subfolders = await prisma.folder.findMany({
        where: {
          parentId: folderId,
          userId: userId
        },
        orderBy: { name: 'asc' }
      });

      tree.subfolders = await Promise.all(
        subfolders.map(sf => this.getFolderTree(sf.id, userId, depth - 1))
      );
    }

    return tree;
  }
}

export default new HierarchyQueryHandler();
