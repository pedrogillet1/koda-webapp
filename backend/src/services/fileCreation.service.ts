/**
 * File Creation Service - STUB (service removed)
 */

interface FileCreationParams {
  userId: string;
  conversationId: string;
  topic: string;
  fileType: string;
  additionalContext?: string;
}

interface FileCreationResult {
  success: boolean;
  error?: string;
  fileName?: string;
  filePath?: string;
  documentId?: string;
}

export const createFile = async (_params?: FileCreationParams): Promise<FileCreationResult> => ({
  success: false,
  error: 'Service removed',
  fileName: '',
  filePath: '',
  documentId: ''
});

export default { createFile };
