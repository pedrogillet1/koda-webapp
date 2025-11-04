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
import { llmIntentDetectorService } from './llmIntentDetector.service';
import { findBestMatch } from 'string-similarity';

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
   * Parse natural language file action query using LLM
   * Replaces rigid regex patterns with flexible AI understanding
   */
  async parseFileAction(query: string): Promise<{
    action: string;
    params: Record<string, string>;
  } | null> {
    try {
      // Use LLM to detect intent
      const intentResult = await llmIntentDetectorService.detectIntent(query);
      console.log(`📊 [parseFileAction] Intent detected:`, intentResult);

      // Map LLM intent to file actions
      const fileActionIntents = [
        'create_folder',
        'move_files',
        'list_files',
        'search_files',
        'file_location',
        'rename_file',
        'delete_file'
      ];

      // Only process if it's a file action intent with high confidence
      if (!fileActionIntents.includes(intentResult.intent)) {
        console.log(`❌ [parseFileAction] Intent "${intentResult.intent}" not in fileActionIntents`);
        return null;
      }

      if (intentResult.confidence < 0.7) {
        console.log(`❌ [parseFileAction] Confidence ${intentResult.confidence} is below 0.7`);
        return null;
      }

      // Map LLM intent to our action names
      const actionMapping: Record<string, string> = {
        'create_folder': 'createFolder',
        'move_files': 'moveFile',
        'list_files': 'listFiles',
        'search_files': 'searchFiles',
        'file_location': 'fileLocation',
        'rename_file': 'renameFile',
        'delete_file': 'deleteFile'
      };

      const action = actionMapping[intentResult.intent];
      if (!action) {
        console.log(`❌ [parseFileAction] No action mapping for intent "${intentResult.intent}"`);
        return null;
      }

      console.log(`✅ [parseFileAction] Mapped to action: "${action}" with params:`, intentResult.parameters);

      return {
        action,
        params: intentResult.parameters
      };
    } catch (error) {
      console.error('❌ Error parsing file action with LLM:', error);
      return null;
    }
  }

  /**
   * Find document by filename with fuzzy matching for typos
   * @param filename - Filename to search for (may have typos)
   * @param userId - User ID
   * @returns Document if found, null otherwise
   */
  private async findDocumentWithFuzzyMatch(
    filename: string,
    userId: string
  ): Promise<Document | null> {
    // First try exact match
    let document = await prisma.document.findFirst({
      where: {
        filename: filename,
        userId: userId,
        status: { not: 'deleted' },
      },
    });

    if (document) {
      console.log(`✅ [FUZZY] Exact match found: ${filename}`);
      return document;
    }

    // If no exact match, try fuzzy matching
    console.log(`🔍 [FUZZY] No exact match for "${filename}", trying fuzzy search...`);

    // Get all user's documents
    const allDocuments = await prisma.document.findMany({
      where: {
        userId: userId,
        status: { not: 'deleted' },
      },
      select: {
        id: true,
        filename: true,
        userId: true,
        folderId: true,
        encryptedFilename: true,
        mimeType: true,
        classification: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        parentVersionId: true,
      },
    });

    if (allDocuments.length === 0) {
      console.log(`❌ [FUZZY] No documents found for user`);
      return null;
    }

    // Find best match using string similarity
    const filenames = allDocuments.map(d => d.filename);
    const matches = findBestMatch(filename, filenames);
    const bestMatch = matches.bestMatch;

    console.log(`🎯 [FUZZY] Best match: "${bestMatch.target}" (similarity: ${bestMatch.rating.toFixed(2)})`);

    // If similarity is above threshold (0.6 = 60% similar), use it
    if (bestMatch.rating >= 0.6) {
      document = allDocuments.find(d => d.filename === bestMatch.target) || null;
      console.log(`✅ [FUZZY] Using fuzzy match: "${filename}" → "${document?.filename}"`);
      return document;
    }

    console.log(`❌ [FUZZY] No good match found (best similarity: ${bestMatch.rating.toFixed(2)})`);
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
   * Find document by filename with fuzzy matching
   */
  async findDocumentByName(userId: string, filename: string): Promise<Document | null> {
    // ✅ FIX: Use fuzzy matching to handle typos
    return await this.findDocumentWithFuzzyMatch(filename, userId);
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
    // Parse the query using LLM
    const parsed = await this.parseFileAction(query);

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
        // SMART DETECTION: Check if it's a folder first, then file
        // This allows "rename pedro1 to pedro2" to work for both files and folders

        // First, try to find a folder with this name
        const folder = await this.findFolderByName(userId, params.oldFilename);
        if (folder) {
          // It's a folder - rename the folder
          console.log(`   📁 Detected folder rename: ${params.oldFilename} → ${params.newFilename}`);
          return await this.renameFolder(userId, folder.id, params.newFilename);
        }

        // Not a folder, try to find a file
        const document = await this.findDocumentByName(userId, params.oldFilename);
        if (document) {
          // It's a file - rename the file
          console.log(`   📄 Detected file rename: ${params.oldFilename} → ${params.newFilename}`);
          return await this.renameFile({
            userId,
            documentId: document.id,
            newFilename: params.newFilename
          });
        }

        // Neither file nor folder found
        return {
          success: false,
          message: `File or folder "${params.oldFilename}" not found`,
          error: 'NOT_FOUND'
        };
      }

      case 'deleteFile': {
        // SMART DETECTION: Check if it's a folder first, then file
        // This allows "delete pedro1" to work for both files and folders

        // First, try to find a folder with this name
        const folder = await this.findFolderByName(userId, params.filename);
        if (folder) {
          // It's a folder - delete the folder
          console.log(`   📁 Detected folder delete: ${params.filename}`);
          return await this.deleteFolder(userId, folder.id);
        }

        // Not a folder, try to find a file
        const document = await this.findDocumentByName(userId, params.filename);
        if (document) {
          // It's a file - delete the file
          console.log(`   📄 Detected file delete: ${params.filename}`);
          return await this.deleteFile({
            userId,
            documentId: document.id
          });
        }

        // Neither file nor folder found
        return {
          success: false,
          message: `File or folder "${params.filename}" not found`,
          error: 'NOT_FOUND'
        };
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

      case 'deleteFolder': {
        // Find folder by name
        const folder = await this.findFolderByName(userId, params.folderName);
        if (!folder) {
          return {
            success: false,
            message: `Folder "${params.folderName}" not found`,
            error: 'FOLDER_NOT_FOUND'
          };
        }

        return await this.deleteFolder(userId, folder.id);
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
   * Delete a folder and all its contents
   */
  async deleteFolder(userId: string, folderId: string): Promise<FileActionResult> {
    try {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId },
        include: {
          _count: {
            select: {
              documents: true,
            }
          }
        }
      });

      if (!folder) {
        return {
          success: false,
          message: 'Folder not found',
          error: 'FOLDER_NOT_FOUND'
        };
      }

      // Soft delete all documents in the folder
      await prisma.document.updateMany({
        where: {
          folderId: folderId,
          userId: userId
        },
        data: { status: 'deleted' }
      });

      // Delete the folder
      await prisma.folder.delete({
        where: { id: folderId }
      });

      const documentCount = folder._count.documents;
      const fileText = documentCount === 1 ? 'file' : 'files';

      return {
        success: true,
        message: `Deleted folder "${folder.name}" and ${documentCount} ${fileText}`,
        data: { folderId, deletedFiles: documentCount }
      };
    } catch (error: any) {
      console.error('❌ Delete folder failed:', error);
      return {
        success: false,
        message: 'Failed to delete folder',
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
