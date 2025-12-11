/**
 * Image Processing Service Stub
 *
 * This service was removed during cleanup. This stub provides no-op implementations
 * to maintain backward compatibility.
 *
 * TODO: Remove usages of this service from document.queue.ts
 */

/**
 * Process an image file (stub - returns empty result)
 */
export async function processImage(_filePath: string): Promise<{
  text: string;
  confidence: number;
}> {
  console.warn('[IMAGE PROCESSING STUB] processImage called - service is disabled');
  return {
    text: '',
    confidence: 0,
  };
}

/**
 * Extract text from image using OCR (stub - returns empty string)
 */
export async function extractTextFromImage(_imageBuffer: Buffer): Promise<string> {
  console.warn('[IMAGE PROCESSING STUB] extractTextFromImage called - service is disabled');
  return '';
}

/**
 * Resize image (stub - returns original buffer)
 */
export async function resizeImage(imageBuffer: Buffer, _options?: {
  width?: number;
  height?: number;
  quality?: number;
}): Promise<Buffer> {
  console.warn('[IMAGE PROCESSING STUB] resizeImage called - service is disabled');
  return imageBuffer;
}

/**
 * Generate thumbnail (stub - returns original buffer)
 */
export async function generateThumbnail(imageBuffer: Buffer, _size?: number): Promise<Buffer> {
  console.warn('[IMAGE PROCESSING STUB] generateThumbnail called - service is disabled');
  return imageBuffer;
}

/**
 * Get image metadata (stub - returns empty metadata)
 */
export async function getImageMetadata(_imageBuffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
}> {
  console.warn('[IMAGE PROCESSING STUB] getImageMetadata called - service is disabled');
  return {
    width: 0,
    height: 0,
    format: 'unknown',
  };
}

export default {
  processImage,
  extractTextFromImage,
  resizeImage,
  generateThumbnail,
  getImageMetadata,
};
