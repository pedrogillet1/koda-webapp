import sharp from 'sharp';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import * as pdfjsLib from 'pdfjs-dist';
import { createCanvas } from 'canvas';

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE,
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');

interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
}

/**
 * Generate thumbnail for PDF files
 */
export const generatePDFThumbnail = async (
  filePath: string,
  options: ThumbnailOptions = {}
): Promise<string | null> => {
  const { width = 300, height = 400, quality = 85 } = options;

  try {
    // Read PDF file
    const pdfData = new Uint8Array(fs.readFileSync(filePath));

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    // Get first page
    const page = await pdf.getPage(1);

    // Calculate viewport dimensions
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(width / viewport.width, height / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    // Create canvas
    const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
    const context = canvas.getContext('2d');

    // Render PDF page to canvas
    const renderContext:any = {
      canvasContext: context,
      viewport: scaledViewport,
    };
    await page.render(renderContext).promise;

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');

    // Create temp file for thumbnail
    const tempDir = os.tmpdir();
    const thumbnailFilename = `thumb-${crypto.randomUUID()}.jpg`;
    const thumbnailPath = path.join(tempDir, thumbnailFilename);

    // Convert to JPEG using sharp for better compression
    await sharp(buffer)
      .jpeg({ quality })
      .toFile(thumbnailPath);

    // Upload thumbnail to GCS
    const gcsPath = `thumbnails/${thumbnailFilename}`;
    await bucket.upload(thumbnailPath, {
      destination: gcsPath,
      metadata: {
        contentType: 'image/jpeg',
      },
    });

    // Clean up temp file
    fs.unlinkSync(thumbnailPath);

    return gcsPath; // Store the GCS path
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error);
    return null;
  }
};

/**
 * Generate thumbnail for image files
 */
export const generateImageThumbnail = async (
  filePath: string,
  options: ThumbnailOptions = {}
): Promise<string | null> => {
  const { width = 300, height = 400, quality = 85 } = options;

  try {
    // Create temp file for thumbnail
    const tempDir = os.tmpdir();
    const thumbnailFilename = `thumb-${crypto.randomUUID()}.jpg`;
    const thumbnailPath = path.join(tempDir, thumbnailFilename);

    // Generate thumbnail using sharp
    await sharp(filePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality })
      .toFile(thumbnailPath);

    // Upload thumbnail to GCS
    const gcsPath = `thumbnails/${thumbnailFilename}`;
    await bucket.upload(thumbnailPath, {
      destination: gcsPath,
      metadata: {
        contentType: 'image/jpeg',
      },
    });

    // Clean up temp file
    fs.unlinkSync(thumbnailPath);

    // Return public URL
    const file = bucket.file(gcsPath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    return gcsPath; // Store the GCS path, not the signed URL
  } catch (error) {
    console.error('Error generating image thumbnail:', error);
    return null;
  }
};

/**
 * Universal thumbnail generator
 * Routes to appropriate handler based on file type
 */
export const generateThumbnail = async (
  filePath: string,
  mimeType: string,
  options: ThumbnailOptions = {}
): Promise<string | null> => {
  try {
    // Determine file type
    if (mimeType.startsWith('image/')) {
      return await generateImageThumbnail(filePath, options);
    } else if (mimeType === 'application/pdf') {
      return await generatePDFThumbnail(filePath, options);
    } else if (
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation')
    ) {
      // Office documents - would need conversion to PDF first
      console.log('Office document thumbnail generation not yet implemented');
      return null;
    }

    // Unsupported file type
    return null;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
};

/**
 * Get signed URL for thumbnail
 */
export const getThumbnailUrl = async (thumbnailPath: string): Promise<string | null> => {
  if (!thumbnailPath) return null;

  try {
    const file = bucket.file(thumbnailPath);
    const [exists] = await file.exists();

    if (!exists) {
      return null;
    }

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return url;
  } catch (error) {
    console.error('Error getting thumbnail URL:', error);
    return null;
  }
};

/**
 * Delete thumbnail from storage
 */
export const deleteThumbnail = async (thumbnailPath: string): Promise<boolean> => {
  if (!thumbnailPath) return true;

  try {
    const file = bucket.file(thumbnailPath);
    const [exists] = await file.exists();

    if (exists) {
      await file.delete();
    }

    return true;
  } catch (error) {
    console.error('Error deleting thumbnail:', error);
    return false;
  }
};

