import sharp from 'sharp';
import { uploadFile } from '../config/storage';

export interface ThumbnailResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
}

export interface ImageOptimizationResult {
  buffer: Buffer;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}

/**
 * Generate thumbnail from image buffer
 * @param buffer - Original image buffer
 * @param maxWidth - Maximum width of thumbnail (default: 300)
 * @param maxHeight - Maximum height of thumbnail (default: 300)
 * @returns Thumbnail buffer and metadata
 */
export const generateThumbnail = async (
  buffer: Buffer,
  maxWidth: number = 300,
  maxHeight: number = 300
): Promise<ThumbnailResult> => {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Resize while maintaining aspect ratio
    const thumbnail = await image
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailMetadata = await sharp(thumbnail).metadata();

    return {
      buffer: thumbnail,
      width: thumbnailMetadata.width || 0,
      height: thumbnailMetadata.height || 0,
      size: thumbnail.length,
    };
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw new Error('Failed to generate thumbnail');
  }
};

/**
 * Generate thumbnail from PDF first page
 * @param pdfBuffer - PDF buffer
 * @returns Thumbnail buffer and metadata
 */
export const generatePDFThumbnail = async (pdfBuffer: Buffer): Promise<ThumbnailResult | null> => {
  try {
    // For PDF thumbnails, we'd need a library like pdf-to-img or sharp-pdf
    // For now, return null. In production, implement PDF → Image conversion
    console.log('PDF thumbnail generation not yet implemented');
    return null;
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error);
    return null;
  }
};

/**
 * Optimize image file size while maintaining quality
 * @param buffer - Original image buffer
 * @param quality - JPEG quality (1-100, default: 85)
 * @returns Optimized image buffer and compression stats
 */
export const optimizeImage = async (
  buffer: Buffer,
  quality: number = 85
): Promise<ImageOptimizationResult> => {
  try {
    const originalSize = buffer.length;
    const image = sharp(buffer);
    const metadata = await image.metadata();

    let optimizedBuffer: Buffer;

    // Optimize based on format
    switch (metadata.format) {
      case 'jpeg':
      case 'jpg':
        optimizedBuffer = await image.jpeg({ quality, progressive: true }).toBuffer();
        break;

      case 'png':
        optimizedBuffer = await image.png({ compressionLevel: 9 }).toBuffer();
        break;

      case 'webp':
        optimizedBuffer = await image.webp({ quality }).toBuffer();
        break;

      default:
        // Convert other formats to JPEG
        optimizedBuffer = await image.jpeg({ quality }).toBuffer();
    }

    const optimizedSize = optimizedBuffer.length;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      buffer: optimizedBuffer,
      originalSize,
      optimizedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw new Error('Failed to optimize image');
  }
};

/**
 * Extract first frame from animated image or GIF
 * @param buffer - Animated image buffer
 * @returns First frame as static image
 */
export const extractFirstFrame = async (buffer: Buffer): Promise<Buffer> => {
  try {
    // Sharp automatically extracts the first frame from GIFs
    const staticImage = await sharp(buffer, { pages: 1 }).jpeg({ quality: 90 }).toBuffer();

    return staticImage;
  } catch (error) {
    console.error('Error extracting first frame:', error);
    throw new Error('Failed to extract first frame');
  }
};

/**
 * Get image metadata without loading full image
 * @param buffer - Image buffer
 * @returns Image metadata
 */
export const getImageMetadata = async (buffer: Buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
    };
  } catch (error) {
    console.error('Error getting image metadata:', error);
    throw new Error('Failed to get image metadata');
  }
};

/**
 * Generate and upload thumbnail to GCS
 * @param imageBuffer - Original image buffer
 * @param userId - User ID for folder organization
 * @param documentId - Document ID for naming
 * @returns GCS URL of the thumbnail
 */
export const generateAndUploadThumbnail = async (
  imageBuffer: Buffer,
  userId: string,
  documentId: string
): Promise<string> => {
  try {
    const thumbnail = await generateThumbnail(imageBuffer);
    const thumbnailFileName = `thumbnails/${userId}/${documentId}_thumb.jpg`;

    // Upload to GCS
    await uploadFile(thumbnailFileName, thumbnail.buffer, 'image/jpeg');

    // Return the GCS path (you can construct full URL if needed)
    return thumbnailFileName;
  } catch (error) {
    console.error('Error generating and uploading thumbnail:', error);
    throw new Error('Failed to generate and upload thumbnail');
  }
};

/**
 * Check if file is an image based on MIME type
 * @param mimeType - MIME type of the file
 * @returns True if file is an image
 */
export const isImage = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

/**
 * Check if file is a PDF
 * @param mimeType - MIME type of the file
 * @returns True if file is a PDF
 */
export const isPDF = (mimeType: string): boolean => {
  return mimeType === 'application/pdf';
};
