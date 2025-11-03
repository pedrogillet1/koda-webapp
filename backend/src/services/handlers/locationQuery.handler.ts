/**
 * Location Query Handler
 * Handles "where is X?" queries for Issue #2
 */

import { PrismaClient } from '@prisma/client';
import { RAGResponse, ActionType } from '../../types/rag.types';
import { getFolderPath, formatFileSize, formatDate, fuzzyMatchDocuments } from '../../utils/rag.utils';

const prisma = new PrismaClient();

class LocationQueryHandler {
  /**
   * Handle location queries like "where is the business plan?"
   */
  async handle(documentName: string, userId: string): Promise<RAGResponse> {
    console.log(`\n📍 LOCATION QUERY: Finding "${documentName}" for user ${userId.substring(0, 8)}...`);

    // Try exact match first
    let documents = await prisma.document.findMany({
      where: {
        userId: userId,
        filename: { contains: documentName }
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            emoji: true
          }
        },
        folder: {
          select: {
            id: true,
            name: true,
            parentId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // If no exact matches, try fuzzy matching
    if (documents.length === 0) {
      console.log(`   No exact matches, trying fuzzy search...`);
      const fuzzyMatches = await fuzzyMatchDocuments(documentName, userId, 0.3);

      if (fuzzyMatches.length > 0) {
        // Fetch full document data for fuzzy matches
        const documentIds = fuzzyMatches.map(m => m.id);
        documents = await prisma.document.findMany({
          where: {
            id: { in: documentIds }
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                emoji: true
              }
            },
            folder: {
              select: {
                id: true,
                name: true,
                parentId: true
              }
            }
          }
        });
      }
    }

    // No documents found
    if (documents.length === 0) {
      return {
        answer: `I couldn't find a document matching **"${documentName}"** in your workspace.\n\n` +
          `Would you like me to:\n` +
          `- Search for a similar name?\n` +
          `- Show you all your documents?\n` +
          `- Search in a specific folder?`,
        sources: [],
        actions: []
      };
    }

    // Single match - provide detailed location
    if (documents.length === 1) {
      return await this.formatSingleDocumentResponse(documents[0]);
    }

    // Multiple matches - list all with locations
    return await this.formatMultipleDocumentsResponse(documents, documentName);
  }

  /**
   * Format response for single document match
   */
  private async formatSingleDocumentResponse(doc: any): Promise<RAGResponse> {
    const folderPath = doc.folder ? await getFolderPath(doc.folder.id) : 'Root';
    const categoryName = doc.category?.name || 'Uncategorized';
    const categoryEmoji = doc.category?.emoji || '📁';

    const answer = `I found **${doc.filename}**! Here's where it's located:\n\n` +
      `📂 **Folder Path:** ${folderPath}\n` +
      `${categoryEmoji} **Category:** ${categoryName}\n` +
      `📅 **Date Added:** ${formatDate(doc.createdAt)}\n` +
      `📊 **File Size:** ${formatFileSize(doc.fileSize)}\n` +
      `📄 **File Type:** ${this.formatMimeType(doc.mimeType)}\n\n` +
      `Would you like me to open this document or its folder?`;

    return {
      answer: answer,
      sources: [],
      actions: [
        {
          label: `Open ${doc.filename}`,
          action: ActionType.OPEN_DOCUMENT,
          documentId: doc.id,
          variant: 'primary',
          icon: '📄'
        },
        {
          label: doc.folder ? `Open ${doc.folder.name} folder` : 'Open Root folder',
          action: ActionType.OPEN_FOLDER,
          folderId: doc.folder?.id || 'root',
          variant: 'secondary',
          icon: '📁'
        }
      ]
    };
  }

  /**
   * Format response for multiple document matches
   */
  private async formatMultipleDocumentsResponse(
    documents: any[],
    searchTerm: string
  ): Promise<RAGResponse> {
    let answer = `I found **${documents.length} documents** matching "${searchTerm}":\n\n`;

    const docDetails = await Promise.all(
      documents.map(async (doc, index) => {
        const folderPath = doc.folder ? await getFolderPath(doc.folder.id) : 'Root';
        const categoryName = doc.category?.name || 'Uncategorized';
        const categoryEmoji = doc.category?.emoji || '📁';

        return {
          index: index + 1,
          filename: doc.filename,
          folderPath: folderPath,
          categoryName: categoryName,
          categoryEmoji: categoryEmoji,
          createdAt: doc.createdAt,
          id: doc.id
        };
      })
    );

    // Format list
    docDetails.forEach(doc => {
      answer += `**${doc.index}. ${doc.filename}**\n`;
      answer += `   📂 Location: ${doc.folderPath}\n`;
      answer += `   ${doc.categoryEmoji} Category: ${doc.categoryName}\n`;
      answer += `   📅 Added: ${formatDate(doc.createdAt)}\n\n`;
    });

    answer += `Which one would you like to open?`;

    // Create action buttons for each document
    const actions = documents.map(doc => ({
      label: `Open ${doc.filename}`,
      action: ActionType.OPEN_DOCUMENT,
      documentId: doc.id,
      variant: 'outline' as const,
      icon: '📄'
    }));

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

export default new LocationQueryHandler();
