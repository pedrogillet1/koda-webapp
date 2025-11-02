/**
 * File Actions Service - Phase 4A
 * Handles file and folder operations via natural language
 *
 * Supported Actions:
 * - createFolder: Create new folders
 * - moveFile: Move files between folders
 * - renameFile: Rename documents
 * - deleteFile: Delete documents
 */

import prisma from '../config/database';
import { Document, Folder } from '@prisma/client';

export interface FileActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface CreateFolderParams {
  userId: string;
  folderName: string;
  parentFolderId?: string;
  color?: string;
}

export interface MoveFileParams {
  userId: string;
  documentId: string;
  targetFolderId: string;
}

export interface RenameFileParams {
  userId: string;
  documentId: string;
  newFilename: string;
}

export interface DeleteFileParams {
  userId: string;
  documentId: string;
}

class FileActionsService {
  /**
   * Parse natural language file action query
   */
  parseFileAction(query: string): {
    action: string;
    params: Record<string, string>;
  } | null {
    const queryLower = query.toLowerCase().trim();

    // RENAME FOLDER (check this first, before generic rename)
    const renameFolderPatterns = [
      /rename\s+(?:the\s+)?folder\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
      /change\s+folder\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of renameFolderPatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          action: 'renameFolder',
          params: {
            oldFolderName: match[1].trim(),
            newFolderName: match[2].trim()
          }
        };
      }
    }

    // CREATE FOLDER
    const createFolderPatterns = [
      /create\s+(?:a\s+)?(?:new\s+)?folder\s+(?:named\s+|called\s+)?["']?([^"']+)["']?/i,
      /make\s+(?:a\s+)?(?:new\s+)?folder\s+(?:named\s+|called\s+)?["']?([^"']+)["']?/i,
      /new\s+folder\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of createFolderPatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          action: 'createFolder',
          params: { folderName: match[1].trim() }
        };
      }
    }

    // MOVE FILE
    const moveFilePatterns = [
      /move\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
      /put\s+["']?([^"']+)["']?\s+in\s+["']?([^"']+)["']?/i,
      /transfer\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of moveFilePatterns) {
      const match = query.match(pattern);
      if (match) {
        let targetFolder = match[2].trim();

        // Strip descriptor words like "folder" or "category" from the end
        targetFolder = targetFolder.replace(/\s+(folder|category)$/i, '');

        return {
          action: 'moveFile',
          params: {
            filename: match[1].trim(),
            targetFolder: targetFolder
          }
        };
      }
    }

    // RENAME FILE
    const renameFilePatterns = [
      /rename\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
      /change\s+(?:the\s+)?name\s+of\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of renameFilePatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          action: 'renameFile',
          params: {
            oldFilename: match[1].trim(),
            newFilename: match[2].trim()
          }
        };
      }
    }

    // DELETE FILE
    const deleteFilePatterns = [
      /delete\s+["']?([^"']+)["']?/i,
      /remove\s+["']?([^"']+)["']?/i,
      /trash\s+["']?([^"']+)["']?/i,
    ];

    for (const pattern of deleteFilePatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          action: 'deleteFile',
          params: { filename: match[1].trim() }
        };
      }
    }

    return null;
  }

  /**
   * Create a new folder
   */
  async createFolder(params: CreateFolderParams): Promise<FileActionResult> {
    try {
      // Check if folder already exists
      const existingFolder = await prisma.folder.findFirst({
        where: {
          userId: params.userId,
          name: params.folderName,
          parentFolderId: params.parentFolderId || null,
        }
      });

      if (existingFolder) {
        return {
          success: false,
          message: `Folder "${params.folderName}" already exists`,
          error: 'FOLDER_EXISTS'
        };
      }

      // Create folder
      const folder = await prisma.folder.create({
        data: {
          userId: params.userId,
          name: params.folderName,
          parentFolderId: params.parentFolderId || null,
          color: params.color || '#3B82F6', // Default blue
        }
      });

      return {
        success: true,
        message: `Folder "${params.folderName}" created successfully`,
        data: { folder }
      };
    } catch (error: any) {
      console.error('❌ Create folder failed:', error);
      return {
        success: false,
        message: 'Failed to create folder',
        error: error.message
      };
    }
  }

  /**
   * Move file to a different folder
   */
  async moveFile(params: MoveFileParams): Promise<FileActionResult> {
    try {
      // Verify document exists and belongs to user
      const document = await prisma.document.findFirst({
        where: {
          id: params.documentId,
          userId: params.userId,
        }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found',
          error: 'DOCUMENT_NOT_FOUND'
        };
      }

      // Verify target folder exists and belongs to user
      const targetFolder = await prisma.folder.findFirst({
        where: {
          id: params.targetFolderId,
          userId: params.userId,
        }
      });

      if (!targetFolder) {
        return {
          success: false,
          message: 'Target folder not found',
          error: 'FOLDER_NOT_FOUND'
        };
      }

      // Move document
      const updatedDocument = await prisma.document.update({
        where: { id: params.documentId },
        data: { folderId: params.targetFolderId }
      });

      return {
        success: true,
        message: `Moved "${document.filename}" to "${targetFolder.name}"`,
        data: { document: updatedDocument }
      };
    } catch (error: any) {
      console.error('❌ Move file failed:', error);
      return {
        success: false,
        message: 'Failed to move file',
        error: error.message
      };
    }
  }

  /**
   * Rename a file
   */
  async renameFile(params: RenameFileParams): Promise<FileActionResult> {
    try {
      // Verify document exists and belongs to user
      const document = await prisma.document.findFirst({
        where: {
          id: params.documentId,
          userId: params.userId,
        }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found',
          error: 'DOCUMENT_NOT_FOUND'
        };
      }

      // Rename document
      const updatedDocument = await prisma.document.update({
        where: { id: params.documentId },
        data: { filename: params.newFilename }
      });

      return {
        success: true,
        message: `Renamed "${document.filename}" to "${params.newFilename}"`,
        data: { document: updatedDocument }
      };
    } catch (error: any) {
      console.error('❌ Rename file failed:', error);
      return {
        success: false,
        message: 'Failed to rename file',
        error: error.message
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(params: DeleteFileParams): Promise<FileActionResult> {
    try {
      // Verify document exists and belongs to user
      const document = await prisma.document.findFirst({
        where: {
          id: params.documentId,
          userId: params.userId,
        }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found',
          error: 'DOCUMENT_NOT_FOUND'
        };
      }

      // Delete document (soft delete by updating status)
      await prisma.document.update({
        where: { id: params.documentId },
        data: { status: 'deleted' }
      });

      return {
        success: true,
        message: `Deleted "${document.filename}"`,
        data: { documentId: params.documentId }
      };
    } catch (error: any) {
      console.error('❌ Delete file failed:', error);
      return {
        success: false,
        message: 'Failed to delete file',
        error: error.message
      };
    }
  }

  /**
   * Find document by filename
   */
  async findDocumentByName(userId: string, filename: string): Promise<Document | null> {
    // Try exact match first (case-sensitive)
    let document = await prisma.document.findFirst({
      where: {
        userId,
        filename: filename,
        status: { not: 'deleted' }
      }
    });

    // If not found, try partial match
    if (!document) {
      document = await prisma.document.findFirst({
        where: {
          userId,
          filename: { contains: filename },
          status: { not: 'deleted' }
        }
      });
    }

    return document;
  }

  /**
   * Find folder by name
   */
  async findFolderByName(userId: string, folderName: string): Promise<Folder | null> {
    // Try exact match first
    let folder = await prisma.folder.findFirst({
      where: {
        userId,
        name: folderName
      }
    });

    // If not found, try partial match
    if (!folder) {
      folder = await prisma.folder.findFirst({
        where: {
          userId,
          name: { contains: folderName }
        }
      });
    }

    return folder;
  }

  /**
   * Execute file action from natural language query
   */
  async executeAction(query: string, userId: string): Promise<FileActionResult> {
    // Parse the query
    const parsed = this.parseFileAction(query);

    if (!parsed) {
      return {
        success: false,
        message: 'Could not understand file action',
        error: 'PARSE_FAILED'
      };
    }

    const { action, params } = parsed;

    // Execute the action
    switch (action) {
      case 'createFolder':
        return await this.createFolder({
          userId,
          folderName: params.folderName
        });

      case 'moveFile': {
        // Find document by filename
        const document = await this.findDocumentByName(userId, params.filename);
        if (!document) {
          return {
            success: false,
            message: `File "${params.filename}" not found`,
            error: 'DOCUMENT_NOT_FOUND'
          };
        }

        // Find target folder
        const folder = await this.findFolderByName(userId, params.targetFolder);
        if (!folder) {
          return {
            success: false,
            message: `Folder "${params.targetFolder}" not found`,
            error: 'FOLDER_NOT_FOUND'
          };
        }

        return await this.moveFile({
          userId,
          documentId: document.id,
          targetFolderId: folder.id
        });
      }

      case 'renameFile': {
        // Find document by old filename
        const document = await this.findDocumentByName(userId, params.oldFilename);
        if (!document) {
          return {
            success: false,
            message: `File "${params.oldFilename}" not found`,
            error: 'DOCUMENT_NOT_FOUND'
          };
        }

        return await this.renameFile({
          userId,
          documentId: document.id,
          newFilename: params.newFilename
        });
      }

      case 'deleteFile': {
        // Find document by filename
        const document = await this.findDocumentByName(userId, params.filename);
        if (!document) {
          return {
            success: false,
            message: `File "${params.filename}" not found`,
            error: 'DOCUMENT_NOT_FOUND'
          };
        }

        return await this.deleteFile({
          userId,
          documentId: document.id
        });
      }

      case 'renameFolder': {
        // Find folder by old name
        const folder = await this.findFolderByName(userId, params.oldFolderName);
        if (!folder) {
          return {
            success: false,
            message: `Folder "${params.oldFolderName}" not found`,
            error: 'FOLDER_NOT_FOUND'
          };
        }

        return await this.renameFolder(userId, folder.id, params.newFolderName);
      }

      default:
        return {
          success: false,
          message: `Unknown action: ${action}`,
          error: 'UNKNOWN_ACTION'
        };
    }
  }

  /**
   * Rename a folder
   */
  async renameFolder(userId: string, folderId: string, newName: string): Promise<FileActionResult> {
    try {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId }
      });

      if (!folder) {
        return {
          success: false,
          message: 'Folder not found',
          error: 'FOLDER_NOT_FOUND'
        };
      }

      await prisma.folder.update({
        where: { id: folderId },
        data: { name: newName }
      });

      return {
        success: true,
        message: `Folder renamed to "${newName}"`,
        data: { folderId, newName }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to rename folder',
        error: error.message
      };
    }
  }

  /**
   * Move multiple files to a folder
   */
  async moveFiles(userId: string, documentIds: string[], targetFolderId: string): Promise<FileActionResult> {
    try {
      const results = [];
      for (const documentId of documentIds) {
        const result = await this.moveFile({
          userId,
          documentId,
          targetFolderId
        });
        results.push(result);
      }

      const successCount = results.filter(r => r.success).length;
      return {
        success: successCount > 0,
        message: `Moved ${successCount} of ${documentIds.length} files`,
        data: { results }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to move files',
        error: error.message
      };
    }
  }

  /**
   * Find duplicate files
   */
  async findDuplicates(userId: string, criteria?: string): Promise<FileActionResult> {
    try {
      // Simple implementation: Find files with same filename
      const documents = await prisma.document.findMany({
        where: { userId },
        select: { id: true, filename: true, filesize: true }
      });

      const duplicates: any[] = [];
      const seen = new Map<string, string[]>();

      documents.forEach(doc => {
        const key = criteria === 'size' ? `${doc.filesize}` : doc.filename;
        if (!seen.has(key)) {
          seen.set(key, []);
        }
        seen.get(key)!.push(doc.id);
      });

      seen.forEach((ids, key) => {
        if (ids.length > 1) {
          duplicates.push({ key, count: ids.length, documentIds: ids });
        }
      });

      return {
        success: true,
        message: `Found ${duplicates.length} duplicate groups`,
        data: { duplicates }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to find duplicates',
        error: error.message
      };
    }
  }
}

export default new FileActionsService();
