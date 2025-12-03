/**
 * Folder Contents Handler
 * Handles "what's in X folder?" queries for Issue #2
 */

import prisma from '../../config/database';
import { RAGResponse, ActionType } from '../../types/rag.types';
import { getFolderPath, formatFileSize, formatDate, calculateTextSimilarity } from '../../utils/rag.utils';

class FolderContentsHandler {
  /**
   * Handle folder contents queries like "what's in the Finance folder?"
   */
  async handle(folderOrCategoryName: string, userId: string): Promise<RAGResponse> {
    console.log(`\n📂 FOLDER CONTENTS QUERY: Looking for "${folderOrCategoryName}" for user ${userId.substring(0, 8)}...`);

    // Try to find folder first (exact match)
    let folder = await prisma.folders.findFirst({
      where: {
        userId: userId,
        name: { equals: folderOrCategoryName }
      },
      // NOTE: category relation not in schema
      include: {
        _count: {
          select: {
            documents: true
          }
        }
      }
    });

    // Try fuzzy matching for folder if not found
    if (!folder) {
      const allFolders = await prisma.folders.findMany({
        where: { userId: userId },
        // NOTE: category relation not in schema
        include: {
          _count: {
            select: {
              documents: true
            }
          }
        }
      });

      const fuzzyMatches = allFolders
        .map(f => ({
          folder: f,
          similarity: calculateTextSimilarity(folderOrCategoryName.toLowerCase(), f.name.toLowerCase())
        }))
        .filter(m => m.similarity >= 0.3)
        .sort((a, b) => b.similarity - a.similarity);

      if (fuzzyMatches.length > 0) {
        folder = fuzzyMatches[0].folder;
        console.log(`   Found fuzzy match: "${folder.name}" (${(fuzzyMatches[0].similarity * 100).toFixed(0)}% similar)`);
      }
    }

    // Try to find category if folder not found
    let category = null;
    if (!folder) {
      category = await prisma.categories.findFirst({
        where: {
          userId: userId,
          name: { equals: folderOrCategoryName }
        }
      });

      // Try fuzzy matching for category
      if (!category) {
        const allCategories = await prisma.categories.findMany({
          where: { userId: userId }
        });

        const fuzzyMatches = allCategories
          .map(c => ({
            category: c,
            similarity: calculateTextSimilarity(folderOrCategoryName.toLowerCase(), c.name.toLowerCase())
          }))
          .filter(m => m.similarity >= 0.3)
          .sort((a, b) => b.similarity - a.similarity);

        if (fuzzyMatches.length > 0) {
          category = fuzzyMatches[0].categories;
          console.log(`   Found fuzzy category match: "${category.name}" (${(fuzzyMatches[0].similarity * 100).toFixed(0)}% similar)`);
        }
      }
    }

    // Neither folder nor category found
    if (!folder && !category) {
      return {
        answer: `I couldn't find a folder or category named **"${folderOrCategoryName}"** in your workspace.\n\n` +
          `Would you like me to:\n` +
          `- Show you all your folders and categories?\n` +
          `- Search for documents instead?`,
        sources: [],
        actions: []
      };
    }

    // Handle folder contents
    if (folder) {
      return await this.handleFolderContents(folder, userId);
    }

    // Handle category contents
    if (category) {
      return await this.handleCategoryContents(category, userId);
    }

    // Should never reach here
    return {
      answer: `Something went wrong while retrieving folder contents.`,
      sources: [],
      actions: []
    };
  }

  /**
   * Handle folder contents display
   */
  private async handleFolderContents(folder: any, userId: string): Promise<RAGResponse> {
    const folderPath = await getFolderPath(folder.id);
    // Note: Folders don't have categories in the schema, using folder emoji/name instead
    const categoryEmoji = folder.emoji || '📁';

    // Get documents in this folder
    const documents = await prisma.documents.findMany({
      where: {
        userId: userId,
        folderId: folder.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get subfolders
    const subfolders = await prisma.folders.findMany({
      where: {
        userId: userId,
        parentFolderId: folder.id
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Build response
    let answer = `**${folder.name}**\n\n`;
    answer += `**Location:** ${folderPath}\n`;
    answer += `**Category:** ${categoryName}\n\n`;

    // List subfolders
    if (subfolders.length > 0) {
      answer += `**Subfolders (${subfolders.length}):**\n`;
      subfolders.forEach(subfolder => {
        answer += `   • ${subfolder.name}\n`;
      });
      answer += `\n`;
    }

    // List documents
    if (documents.length > 0) {
      answer += `**Documents (${documents.length}):**\n\n`;
      documents.forEach((doc, index) => {
        answer += `**${index + 1}. ${doc.filename}**\n`;
        answer += `   Size: ${formatFileSize(doc.fileSize)}\n`;
        answer += `   Added: ${formatDate(doc.createdAt)}\n`;
        answer += `   Type: ${this.formatMimeType(doc.mimeType)}\n\n`;
      });
    } else {
      answer += `**Documents:** None\n\n`;
    }

    // Summary
    if (documents.length === 0 && subfolders.length === 0) {
      answer += `This folder is empty.`;
    } else {
      answer += `Would you like to open any of these documents or subfolders?`;
    }

    // Create action buttons
    const actions: any[] = [];

    // Button to open the folder
    actions.push({
      label: `Open ${folder.name} folder`,
      action: ActionType.OPEN_FOLDER,
      folderId: folder.id,
      variant: 'primary' as const
    });

    // Buttons for each document (limit to first 5)
    documents.slice(0, 5).forEach(doc => {
      actions.push({
        label: `Open ${doc.filename}`,
        action: ActionType.OPEN_DOCUMENT,
        documentId: doc.id,
        variant: 'outline' as const
      });
    });

    // Buttons for subfolders (limit to first 3)
    subfolders.slice(0, 3).forEach(subfolder => {
      actions.push({
        label: `Open ${subfolder.name}`,
        action: ActionType.OPEN_FOLDER,
        folderId: subfolder.id,
        variant: 'outline' as const
      });
    });

    return {
      answer: answer,
      sources: [],
      actions: actions
    };
  }

  /**
   * Handle category contents display
   */
  private async handleCategoryContents(category: any, userId: string): Promise<RAGResponse> {
    const categoryEmoji = category.emoji || '📁';

    // Get all documents in this category
    const documents = await prisma.documents.findMany({
      where: {
        userId: userId,
      },
      include: {
        folders: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get all folders in this category
    const folders = await prisma.folders.findMany({
      where: {
        userId: userId,
        parentFolderId: null // Only root folders
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Build response
    let answer = `**${category.name} Category**\n\n`;

    // List root folders
    if (folders.length > 0) {
      answer += `**Folders (${folders.length}):**\n`;
      folders.forEach(folder => {
        answer += `   • ${folder.name}\n`;
      });
      answer += `\n`;
    }

    // List documents
    if (documents.length > 0) {
      answer += `**Documents (${documents.length}):**\n\n`;

      // Group by folder
      const documentsInRoot = documents.filter(d => !d.folderId);
      const documentsInFolders = documents.filter(d => d.folderId);

      // Root documents
      if (documentsInRoot.length > 0) {
        answer += `**Root Level:**\n`;
        documentsInRoot.forEach((doc, index) => {
          answer += `${index + 1}. ${doc.filename}\n`;
          answer += `   ${formatFileSize(doc.fileSize)} • ${formatDate(doc.createdAt)}\n\n`;
        });
      }

      // Documents in folders (show first 10)
      if (documentsInFolders.length > 0) {
        answer += `**In Folders:**\n`;
        documentsInFolders.slice(0, 10).forEach((doc, index) => {
          // NOTE: folder relation needs to be included in query above
          const folderName = 'Folder';
          answer += `${index + 1}. ${doc.filename}\n`;
          answer += `   ${folderName} • ${formatFileSize(doc.fileSize)}\n\n`;
        });

        if (documentsInFolders.length > 10) {
          answer += `_...and ${documentsInFolders.length - 10} more documents_\n\n`;
        }
      }
    } else {
      answer += `**Documents:** None\n\n`;
    }

    // Summary
    if (documents.length === 0 && folders.length === 0) {
      answer += `This category is empty.`;
    } else {
      answer += `Would you like to open any of these documents or folders?`;
    }

    // Create action buttons
    const actions: any[] = [];

    // Button to open the category
    actions.push({
      label: `Open ${category.name} category`,
      action: ActionType.OPEN_CATEGORY,
      userId: userId,
      variant: 'primary' as const
    });

    // Buttons for folders (limit to first 3)
    folders.slice(0, 3).forEach(folder => {
      actions.push({
        label: `Open ${folder.name}`,
        action: ActionType.OPEN_FOLDER,
        folderId: folder.id,
        variant: 'outline' as const
      });
    });

    // Buttons for documents (limit to first 5)
    documents.slice(0, 5).forEach(doc => {
      actions.push({
        label: `Open ${doc.filename}`,
        action: ActionType.OPEN_DOCUMENT,
        documentId: doc.id,
        variant: 'outline' as const
      });
    });

    return {
      answer: answer,
      sources: [],
      actions: actions
    };
  }

  /**
   * Format MIME type for display
   */
  private formatMimeType(mimeType: string): string {
    const typeMap: Record<string, string> = {
      'application/pdf': 'PDF Document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation',
      'text/plain': 'Text File',
      'image/png': 'PNG Image',
      'image/jpeg': 'JPEG Image'
    };

    return typeMap[mimeType] || mimeType;
  }
}

export default new FolderContentsHandler();
