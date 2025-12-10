/**
 * AWS S3 Storage Service
 * Handles file uploads, downloads, and presigned URL generation
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

// AWS Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'koda-user-file';

// Validate configuration
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  throw new Error('AWS credentials not configured! Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
}

// Create S3 client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

console.log(`✅ S3 Storage Service initialized (Region: ${AWS_REGION}, Bucket: ${AWS_S3_BUCKET})`);

/**
 * Upload file to S3
 */
export const uploadFile = async (
  filename: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename,
      Body: fileBuffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256' // Enable server-side encryption
    });

    await s3Client.send(command);

    console.log(`✅ Uploaded file to S3: ${filename}`);
    return filename;
  } catch (error: any) {
    console.error(`❌ Error uploading file to S3:`, error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Download file from S3
 */
export const downloadFile = async (filename: string): Promise<[Buffer, string]> => {
  try {
    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename
    });

    const response = await s3Client.send(command);

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const fileBuffer = Buffer.concat(chunks);
    const mimeType = response.ContentType || 'application/octet-stream';

    console.log(`✅ Downloaded file from S3: ${filename}`);
    return [fileBuffer, mimeType];
  } catch (error: any) {
    console.error(`❌ Error downloading file from S3:`, error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

/**
 * Delete file from S3
 */
export const deleteFile = async (filename: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename
    });

    await s3Client.send(command);

    console.log(`✅ Deleted file from S3: ${filename}`);
  } catch (error: any) {
    console.error(`❌ Error deleting file from S3:`, error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Check if file exists in S3
 */
export const fileExists = async (filename: string): Promise<boolean> => {
  try {
    const command = new HeadObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * Generate presigned URL for upload
 */
export const generatePresignedUploadUrl = async (
  filename: string,
  mimeType: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256'
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    console.log(`✅ Generated presigned upload URL for: ${filename}`);
    return presignedUrl;
  } catch (error: any) {
    console.error(`❌ Error generating presigned upload URL:`, error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

/**
 * Generate presigned URL for download
 */
export const generatePresignedDownloadUrl = async (
  filename: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    console.log(`✅ Generated presigned download URL for: ${filename}`);
    return presignedUrl;
  } catch (error: any) {
    console.error(`❌ Error generating presigned download URL:`, error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

/**
 * Get file metadata
 */
export const getFileMetadata = async (filename: string) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename
    });

    const response = await s3Client.send(command);

    return {
      size: response.ContentLength,
      mimeType: response.ContentType,
      lastModified: response.LastModified,
      etag: response.ETag
    };
  } catch (error: any) {
    console.error(`❌ Error getting file metadata:`, error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
};

export default {
  uploadFile,
  downloadFile,
  deleteFile,
  fileExists,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  getFileMetadata
};
