/**
 * Storage Configuration - Now using Supabase Storage
 * Provides the same interface as GCS for backward compatibility
 */

import supabaseStorageService from '../services/supabaseStorage.service';

// For backward compatibility, export a bucket-like object
export const bucket = {
  file: (fileName: string) => ({
    save: async (buffer: Buffer, options: any) => {
      await supabaseStorageService.upload(fileName, buffer, {
        contentType: options.contentType,
        cacheControl: options.metadata?.cacheControl
      });
    },
    download: async () => {
      const result = await supabaseStorageService.download(fileName);
      return [result.data];
    },
    delete: async () => {
      await supabaseStorageService.delete(fileName);
    },
    exists: async () => {
      return [await supabaseStorageService.exists(fileName)];
    },
    getSignedUrl: async (options: any) => {
      const expiresIn = Math.floor((options.expires - Date.now()) / 1000);
      const url = await supabaseStorageService.getSignedUrl(fileName, expiresIn);
      return [url];
    }
  })
};

console.log('✅ Supabase Storage initialized');

/**
 * Upload a file to Supabase Storage
 */
export const uploadFile = async (
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> => {
  await supabaseStorageService.upload(fileName, fileBuffer, {
    contentType: mimeType
  });
  return fileName;
};

/**
 * Download a file from Supabase Storage
 */
export const downloadFile = async (fileName: string): Promise<Buffer> => {
  const result = await supabaseStorageService.download(fileName);
  return result.data;
};

/**
 * Generate a signed URL for temporary file access (download)
 */
export const getSignedUrl = async (
  fileName: string,
  expiresIn: number = 3600,
  forceDownload: boolean = false,
  downloadFilename?: string
): Promise<string> => {
  // Note: Supabase signed URLs don't support custom response-disposition
  // For downloads, we'll use the signed URL directly
  const url = await supabaseStorageService.getSignedUrl(fileName, expiresIn);
  return url;
};

/**
 * Generate a signed URL for direct upload to Supabase Storage
 * Note: Supabase uses different mechanism for uploads (not signed URLs)
 * This function creates a signed URL for download and returns it for compatibility
 */
export const getSignedUploadUrl = async (
  fileName: string,
  mimeType: string,
  expiresIn: number = 600 // 10 minutes for upload
): Promise<string> => {
  // For Supabase, uploads are typically done server-side
  // This is a compatibility shim - actual uploads should use uploadFile()
  console.warn('⚠️ getSignedUploadUrl called - Supabase uploads should use server-side uploadFile()');

  // Return a placeholder - the actual upload will need to be done server-side
  return `/api/upload/placeholder`;
};

/**
 * Delete a file from Supabase Storage
 */
export const deleteFile = async (fileName: string): Promise<void> => {
  await supabaseStorageService.delete(fileName);
};

/**
 * Check if a file exists in Supabase Storage
 */
export const fileExists = async (fileName: string): Promise<boolean> => {
  return await supabaseStorageService.exists(fileName);
};

// Export null for storage to maintain compatibility
export default null;
