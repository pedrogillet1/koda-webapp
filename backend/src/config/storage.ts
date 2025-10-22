import { Storage } from '@google-cloud/storage';
import { config } from './env';
import fs from 'fs';

let storage: Storage | null = null;
let bucket: any = null;

// Initialize Google Cloud Storage only if credentials are available
try {
  if (fs.existsSync(config.GCS_KEY_FILE)) {
    storage = new Storage({
      projectId: config.GCS_PROJECT_ID,
      keyFilename: config.GCS_KEY_FILE,
    });
    bucket = storage.bucket(config.GCS_BUCKET_NAME);
    console.log('✅ GCS initialized');
  } else {
    console.warn('⚠️  GCS key file not found. File upload will be disabled.');
  }
} catch (error) {
  console.warn('⚠️  GCS initialization failed. File upload will be disabled.');
}

export { bucket };

/**
 * Upload a file to GCS
 */
export const uploadFile = async (
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> => {
  if (!bucket) {
    throw new Error('GCS not configured. File upload disabled.');
  }
  const file = bucket.file(fileName);
  await file.save(fileBuffer, {
    contentType: mimeType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });
  return fileName;
};

/**
 * Download a file from GCS
 */
export const downloadFile = async (fileName: string): Promise<Buffer> => {
  if (!bucket) {
    throw new Error('GCS not configured');
  }
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
  if (!bucket) {
    throw new Error('GCS not configured');
  }
  const file = bucket.file(fileName);

  const options: any = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresIn * 1000,
  };

  // Force download with proper filename
  if (forceDownload && downloadFilename) {
    // Escape quotes in filename for safety
    const safeFilename = downloadFilename.replace(/"/g, '\\"');
    options.responseDisposition = `attachment; filename="${safeFilename}"`;
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
  if (!bucket) {
    throw new Error('GCS not configured');
  }
  const file = bucket.file(fileName);

  const options: any = {
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresIn * 1000,
    contentType: mimeType,
  };

  const [url] = await file.getSignedUrl(options);
  return url;
};

/**
 * Delete a file from GCS
 */
export const deleteFile = async (fileName: string): Promise<void> => {
  if (!bucket) {
    throw new Error('GCS not configured');
  }
  const file = bucket.file(fileName);
  await file.delete();
};

/**
 * Check if a file exists in GCS
 */
export const fileExists = async (fileName: string): Promise<boolean> => {
  if (!bucket) {
    return false;
  }
  const file = bucket.file(fileName);
  const [exists] = await file.exists();
  return exists;
};

export default storage;
