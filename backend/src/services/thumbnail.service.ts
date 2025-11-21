import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { Canvas, createCanvas } from 'canvas';
import s3StorageService from './s3Storage.service';

// Polyfill DOM APIs for pdfjs-dist in Node.js environment
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

// Lazy-load pdfjs-dist only when needed (for PDF thumbnail generation)
let pdfjsLib: any = null;
async function getPdfJsLib() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
  }
  return pdfjsLib;
}

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
    // Lazy-load pdfjs-dist
    const pdfjs = await getPdfJsLib();

    // Read PDF file
    const pdfData = new Uint8Array(fs.readFileSync(filePath));

    // Load PDF document
    const loadingTask = pdfjs.getDocument({
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
    const thumbnailBuffer = await sharp(buffer)
      .jpeg({ quality })
      .toBuffer();

    // Upload thumbnail to S3
    const storagePath = `thumbnails/${thumbnailFilename}`;
    await s3StorageService.uploadFile(storagePath, thumbnailBuffer, 'image/jpeg');

    return storagePath; // Store the S3 path
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
    const thumbnailBuffer = await sharp(filePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality })
      .toBuffer();

    // Upload thumbnail to S3
    const storagePath = `thumbnails/${thumbnailFilename}`;
    await s3StorageService.uploadFile(storagePath, thumbnailBuffer, 'image/jpeg');

    return storagePath; // Store the S3 path
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
    const exists = await s3StorageService.fileExists(thumbnailPath);

    if (!exists) {
      return null;
    }

    const url = await s3StorageService.generatePresignedDownloadUrl(thumbnailPath, 7 * 24 * 60 * 60); // 7 days

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
    const exists = await s3StorageService.fileExists(thumbnailPath);

    if (exists) {
      await s3StorageService.deleteFile(thumbnailPath);
    }

    return true;
  } catch (error) {
    console.error('Error deleting thumbnail:', error);
    return false;
  }
};

