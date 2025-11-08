/**
 * Storage Configuration - Google Cloud Storage
 */

import { Storage } from '@google-cloud/storage';

// Initialize GCS
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GCS_KEY_FILE
});

const bucketName = process.env.GCS_BUCKET_NAME || 'koda-documents-dev';
export const bucket = storage.bucket(bucketName);

console.log('✅ GCS initialized');

/**
 * Upload a file to Google Cloud Storage
 */
export const uploadFile = async (
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> => {
  const file = bucket.file(fileName);
  await file.save(fileBuffer, {
    contentType: mimeType,
    metadata: {
      cacheControl: 'public, max-age=3600'
    }
  });
  return fileName;
};

/**
 * Download a file from Google Cloud Storage
 */
export const downloadFile = async (fileName: string): Promise<Buffer> => {
  const file = bucket.file(fileName);
  const [buffer] = await file.download();
  return buffer;
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
  const file = bucket.file(fileName);

  const options: any = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresIn * 1000
  };

  if (forceDownload && downloadFilename) {
    options.responseDisposition = `attachment; filename="${downloadFilename}"`;
  }

  const [url] = await file.getSignedUrl(options);
  return url;
};

/**
 * Generate a signed URL for direct upload to GCS
 */
export const getSignedUploadUrl = async (
  fileName: string,
  mimeType: string,
  expiresIn: number = 600 // 10 minutes for upload
): Promise<string> => {
  const file = bucket.file(fileName);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresIn * 1000,
    contentType: mimeType
  });

  return url;
};

/**
 * Delete a file from Google Cloud Storage
 */
export const deleteFile = async (fileName: string): Promise<void> => {
  const file = bucket.file(fileName);
  await file.delete();
};

/**
 * Check if a file exists in Google Cloud Storage
 */
export const fileExists = async (fileName: string): Promise<boolean> => {
  const file = bucket.file(fileName);
  const [exists] = await file.exists();
  return exists;
};

export default storage;
