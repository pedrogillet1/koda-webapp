/**
 * Storage Configuration - AWS S3
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const bucketName = process.env.AWS_S3_BUCKET_NAME || 'koda-user-file';

console.log('✅ AWS S3 initialized');

/**
 * Upload a file to AWS S3
 */
export const uploadFile = async (
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=3600'
  });

  await s3Client.send(command);
  return fileName;
};

/**
 * Download a file from AWS S3
 */
export const downloadFile = async (fileName: string): Promise<Buffer> => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileName
  });

  const response = await s3Client.send(command);

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
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
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    ...(forceDownload && downloadFilename ? {
      ResponseContentDisposition: `attachment; filename="${downloadFilename}"`
    } : {})
  });

  const url = await getS3SignedUrl(s3Client, command, { expiresIn });
  return url;
};

/**
 * Generate a signed URL for direct upload to S3
 */
export const getSignedUploadUrl = async (
  fileName: string,
  mimeType: string,
  expiresIn: number = 600 // 10 minutes for upload
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    ContentType: mimeType
  });

  const url = await getS3SignedUrl(s3Client, command, { expiresIn });
  return url;
};

/**
 * Delete a file from AWS S3
 */
export const deleteFile = async (fileName: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: fileName
  });

  await s3Client.send(command);
};

/**
 * Check if a file exists in AWS S3
 */
export const fileExists = async (fileName: string): Promise<boolean> => {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: fileName
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
};

// Export the bucket for backward compatibility
export const bucket = {
  name: bucketName,
  file: (fileName: string) => ({
    save: async (buffer: Buffer, options: any) => uploadFile(fileName, buffer, options.contentType),
    download: async () => [await downloadFile(fileName)],
    getSignedUrl: async (options: any) => [await getSignedUrl(fileName, options.expires || 3600)],
    delete: async () => deleteFile(fileName),
    exists: async () => [await fileExists(fileName)]
  })
};

export default s3Client;
