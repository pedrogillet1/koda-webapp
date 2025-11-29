/**
 * File Generation Modal Service
 * Ensures preview modal shows after file generation completes
 */

import { prisma } from '../config/database';

export interface FileGenerationResult {
  success: boolean;
  document?: {
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    storageUrl: string;
  };
  error?: string;
}

/**
 * Format file generation result for chat response
 * This ensures the preview modal shows after generation
 */
export function formatFileGenerationResponse(
  result: FileGenerationResult,
  actionType: 'file_created' | 'presentation_created' | 'document_created' = 'file_created'
): {
  content: string;
  metadata: {
    actionType: string;
    success: boolean;
    document?: any;
  };
} {
  if (!result.success || !result.document) {
    return {
      content: `❌ Failed to generate file: ${result.error || 'Unknown error'}`,
      metadata: {
        actionType,
        success: false,
      },
    };
  }

  const { document } = result;
  
  // Determine file type for message
  const fileType = document.mimeType.includes('presentation') || document.filename.endsWith('.pptx')
    ? 'presentation'
    : document.mimeType.includes('document') || document.filename.endsWith('.docx')
    ? 'document'
    : 'file';

  return {
    content: `✅ I've created your ${fileType}: **${document.filename}**\n\nClick below to preview it.`,
    metadata: {
      actionType,
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        storageUrl: document.storageUrl,
      },
    },
  };
}

/**
 * Create document record after file generation
 */
export async function createDocumentRecord(params: {
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string;
  folderId?: string;
}): Promise<FileGenerationResult> {
  try {
    const document = await prisma.document.create({
      data: {
        userId: params.userId,
        filename: params.filename,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
        storageUrl: params.storageUrl,
        folderId: params.folderId,
        status: 'completed',
        uploadedAt: new Date(),
      },
    });

    return {
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        storageUrl: document.storageUrl,
      },
    };
  } catch (error) {
    console.error('❌ [FILE_GENERATION] Failed to create document record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create document record',
    };
  }
}

export default {
  formatFileGenerationResponse,
  createDocumentRecord,
};
