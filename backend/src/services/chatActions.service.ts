/**
 * Chat Actions Service - AI-First Document Management
 * Centralized handler for all chat-based actions
 *
 * Handles:
 * - File actions (create/move/rename/delete)
 * - Upload requests
 * - List/show commands
 * - UI update notifications
 */

import prisma from '../config/database';
import fileActionsService from './fileActions.service';

export interface ActionResult {
  isAction: boolean;
  actionType?: string;
  result?: any;
  uiUpdate?: {
    type: 'refresh_folders' | 'refresh_documents' | 'refresh_all' | 'navigate';
    data?: any;
  };
  response: string;
}

class ChatActionsService {
  /**
   * Detect and execute any action from chat message
   * Returns structured response for UI updates
   */
  async detectAndExecute(
    userId: string,
    message: string,
    conversationId: string
  ): Promise<ActionResult> {
    const lowerMessage = message.toLowerCase().trim();

    // Check for file actions first
    if (this.isFileAction(lowerMessage)) {
      return await this.handleFileAction(userId, message, conversationId);
    }

    // Check for upload requests
    if (this.isUploadRequest(lowerMessage)) {
      return {
        isAction: true,
        actionType: 'upload_request',
        response: '📎 Please attach the file(s) you want to upload, and I\'ll process them automatically.',
      };
    }

    // Check for list/show actions
    if (this.isListAction(lowerMessage)) {
      return await this.handleListAction(userId, lowerMessage);
    }

    // Not an action, proceed with normal RAG query
    return {
      isAction: false,
      response: '',
    };
  }

  /**
   * Check if message is a file action
   */
  private isFileAction(message: string): boolean {
    const patterns = [
      /^create (?:a |an |new )?(?:folder|pasta|directory)/i,
      /^make (?:a |an |new )?(?:folder|pasta)/i,
      /^new folder/i,
      /^move .+ to /i,
      /^rename .+ to /i,
      /^delete /i,
      /^remove /i,
    ];
    return patterns.some(p => p.test(message));
  }

  /**
   * Check if message is an upload request
   */
  private isUploadRequest(message: string): boolean {
    const patterns = [
      /^upload/i,
      /^add (file|document)/i,
      /^i want to upload/i,
      /^can you upload/i,
    ];
    return patterns.some(p => p.test(message));
  }

  /**
   * Check if message is a list action
   */
  private isListAction(message: string): boolean {
    const patterns = [
      /^(list|show|what|display) (folders|documents|files)/i,
      /^what do i have/i,
      /^show me my (folders|files|documents)/i,
      /^what (folders|files|documents) do i have/i,

      // NEW: Detect folder content queries
      /what(?:'s| is) (?:inside|in) (?:the )?([a-zA-Z0-9_-]+) folder/i,
      /what (?:files|documents) (?:are )?(?:inside|in) (?:the )?([a-zA-Z0-9_-]+) folder/i,
      /(?:show|list) (?:me )?(?:files|documents|contents) (?:in|inside) (?:the )?([a-zA-Z0-9_-]+) folder/i,
    ];
    return patterns.some(p => p.test(message));
  }

  /**
   * Handle file actions (create/move/rename/delete)
   */
  private async handleFileAction(
    userId: string,
    message: string,
    conversationId: string
  ): Promise<ActionResult> {
    console.log(`🔧 [ChatActions] Handling file action: "${message}"`);

    const result = await fileActionsService.executeAction(message, userId);

    if (!result.success) {
      return {
        isAction: true,
        actionType: 'file_action_error',
        response: `❌ ${result.message || result.error}`,
      };
    }

    // Determine response and UI update based on action
    let response = '';
    let uiUpdate: ActionResult['uiUpdate'] = { type: 'refresh_all' };

    // Parse the result to determine action type
    if (message.toLowerCase().includes('create') && message.toLowerCase().includes('folder')) {
      response = `✅ ${result.message}\n\nYou can now see it in your Categories page.`;
      uiUpdate = {
        type: 'refresh_folders',
        data: result.data,
      };
    } else if (message.toLowerCase().includes('move')) {
      response = `✅ ${result.message}\n\nThe file is now in its new location.`;
      uiUpdate = { type: 'refresh_documents' };
    } else if (message.toLowerCase().includes('rename')) {
      response = `✅ ${result.message}`;
      uiUpdate = { type: 'refresh_documents' };
    } else if (message.toLowerCase().includes('delete') || message.toLowerCase().includes('remove')) {
      response = `✅ ${result.message}`;
      uiUpdate = { type: 'refresh_documents' };
    } else {
      response = `✅ ${result.message}`;
    }

    return {
      isAction: true,
      actionType: 'file_action',
      result: result.data,
      uiUpdate,
      response,
    };
  }

  /**
   * Handle list actions (show folders/documents)
   */
  private async handleListAction(userId: string, message: string): Promise<ActionResult> {
    console.log(`📋 [ChatActions] Handling list action: "${message}"`);

    // NEW: Check if asking for folder contents (specific folder)
    const folderContentMatch = message.match(/(?:inside|in) (?:the )?([a-zA-Z0-9_-]+) folder/i);

    if (folderContentMatch) {
      const folderName = folderContentMatch[1];
      console.log(`   Looking for contents of folder: "${folderName}"`);

      // Find the folder
      const folder = await prisma.folder.findFirst({
        where: {
          userId,
          name: {
            equals: folderName,
            mode: 'insensitive', // Case-insensitive search
          },
        },
        include: {
          documents: {
            where: { status: { not: 'deleted' } },
            select: {
              id: true,
              filename: true,
              fileSize: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          subfolders: {
            select: {
              id: true,
              name: true,
              _count: {
                select: { documents: true },
              },
            },
          },
        },
      });

      if (!folder) {
        return {
          isAction: true,
          actionType: 'list_folder_contents',
          result: null,
          response: `❌ Folder "${folderName}" not found.\n\nYou can see all your folders by asking "what folders do I have?"`,
        };
      }

      // Build response
      const parts: string[] = [];

      // List subfolders
      if (folder.subfolders.length > 0) {
        const subfolderList = folder.subfolders
          .map(sf => {
            const count = sf._count.documents;
            const countStr = count > 0 ? ` (${count} file${count !== 1 ? 's' : ''})` : ' (empty)';
            return `  📁 ${sf.name}${countStr}`;
          })
          .join('\n');
        parts.push(`**Subfolders:**\n${subfolderList}`);
      }

      // List documents
      if (folder.documents.length > 0) {
        const docList = folder.documents
          .map((d, i) => {
            const size = (d.fileSize / 1024).toFixed(1);
            return `  ${i + 1}. ${d.filename} (${size} KB)`;
          })
          .join('\n');
        parts.push(`**Files:**\n${docList}`);
      }

      if (parts.length === 0) {
        return {
          isAction: true,
          actionType: 'list_folder_contents',
          result: folder,
          response: `📁 **Folder "${folder.name}" is empty.**\n\nYou can upload files to this folder or create subfolders.`,
        };
      }

      const response = `📁 **Contents of folder "${folder.name}":**\n\n${parts.join('\n\n')}`;

      return {
        isAction: true,
        actionType: 'list_folder_contents',
        result: folder,
        response,
      };
    }

    // Original: List all folders
    if (message.match(/folder/i)) {
      const folders = await prisma.folder.findMany({
        where: { userId, parentFolderId: null },
        include: {
          _count: {
            select: { documents: true, subfolders: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      if (folders.length === 0) {
        return {
          isAction: true,
          actionType: 'list_folders',
          result: [],
          response: '📁 You don\'t have any folders yet.\n\nYou can create one by saying "Create folder [name]".',
        };
      }

      const folderList = folders
        .map(f => {
          const docCount = f._count.documents;
          const subCount = f._count.subfolders;
          const parts = [];
          if (docCount > 0) parts.push(`${docCount} file${docCount !== 1 ? 's' : ''}`);
          if (subCount > 0) parts.push(`${subCount} subfolder${subCount !== 1 ? 's' : ''}`);
          const counts = parts.length > 0 ? ` (${parts.join(', ')})` : ' (empty)';
          return `  • ${f.name}${counts}`;
        })
        .join('\n');

      return {
        isAction: true,
        actionType: 'list_folders',
        result: folders,
        response: `📁 **Your folders:**\n${folderList}`,
      };
    }

    if (message.match(/document|file/i)) {
      const documents = await prisma.document.findMany({
        where: { userId, status: { not: 'deleted' } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          filename: true,
          fileSize: true,
          createdAt: true,
          folder: {
            select: { name: true },
          },
        },
      });

      if (documents.length === 0) {
        return {
          isAction: true,
          actionType: 'list_documents',
          result: [],
          response: '📄 You don\'t have any documents yet.\n\nYou can upload files by attaching them to this chat.',
        };
      }

      const docList = documents
        .map((d, i) => {
          const size = (d.fileSize / 1024).toFixed(1);
          const folder = d.folder ? ` [${d.folder.name}]` : '';
          return `  ${i + 1}. ${d.filename} (${size} KB)${folder}`;
        })
        .join('\n');

      const total = await prisma.document.count({
        where: { userId, status: { not: 'deleted' } },
      });

      const more = total > 15 ? `\n\n...and ${total - 15} more. View all in the Documents page.` : '';

      return {
        isAction: true,
        actionType: 'list_documents',
        result: documents,
        response: `📄 **Your recent documents:**\n${docList}${more}`,
      };
    }

    return {
      isAction: false,
      response: '',
    };
  }
}

export default new ChatActionsService();
