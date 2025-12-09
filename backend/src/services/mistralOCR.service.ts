/**
 * ============================================================================
 * MISTRAL OCR SERVICE - With Tesseract Fallback
 * ============================================================================
 *
 * PRIMARY: Uses Mistral Pixtral API (requires MISTRAL_API_KEY)
 * FALLBACK: Uses Tesseract.js via ocr.service.ts when Mistral unavailable
 *
 * FIX: Previously returned empty result when Mistral unavailable,
 *      now falls back to Tesseract OCR for reliable image processing
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface OCRResult {
  text: string;
  confidence?: number;
  metadata?: any;
}

export interface ImageAnalysisResult {
  description: string;
  labels?: string[];
  text?: string;
  metadata?: any;
}

// Import both OCR services
import mistralOCRService from './mistral-ocr.service';
import ocrService from './ocr.service';

/**
 * Save Buffer to temporary file for Tesseract processing
 */
async function saveBufferToTempFile(buffer: Buffer, extension: string = '.png'): Promise<string> {
  const tempDir = os.tmpdir();
  const filename = 'ocr-' + crypto.randomBytes(16).toString('hex') + extension;
  const tempPath = path.join(tempDir, filename);
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

/**
 * Extract text using Tesseract fallback (for when Mistral is unavailable)
 */
async function extractWithTesseractFallback(input: Buffer | string): Promise<OCRResult> {
  let tempPath: string | null = null;
  let shouldCleanup = false;

  try {
    // Convert Buffer to file path if needed
    if (Buffer.isBuffer(input)) {
      tempPath = await saveBufferToTempFile(input, '.png');
      shouldCleanup = true;
    } else {
      tempPath = input;
    }

    console.log('[MISTRAL-OCR] Using Tesseract fallback for: ' + path.basename(tempPath));

    // Call Tesseract OCR service
    const result = await ocrService.extractTextFromImage(tempPath);

    console.log('[MISTRAL-OCR] Tesseract OCR complete. Text: ' + result.text.length + ' chars, Confidence: ' + result.confidence + '%');

    return {
      text: result.text || '',
      confidence: result.confidence || 0,
      metadata: {
        method: 'tesseract-fallback',
        warnings: result.warnings || [],
      },
    };
  } catch (error: any) {
    console.error('[MISTRAL-OCR] Tesseract fallback failed:', error.message);
    return {
      text: '',
      confidence: 0,
      metadata: {
        error: error.message,
        method: 'tesseract-fallback',
      },
    };
  } finally {
    // Clean up temp file
    if (shouldCleanup && tempPath) {
      try {
        await fs.unlink(tempPath);
        console.log('[MISTRAL-OCR] Cleaned up temp file: ' + path.basename(tempPath));
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

const mistralOCR = {
  extractText: async (input: Buffer | string): Promise<OCRResult> => {
    console.log('[MISTRAL-OCR] Starting text extraction...');

    // Try Mistral first if available
    if (mistralOCRService.isAvailable()) {
      console.log('[MISTRAL-OCR] Using Mistral Pixtral API');

      try {
        if (Buffer.isBuffer(input)) {
          const text = await mistralOCRService.extractTextFromImageBuffer(input, 'image/png');
          if (text && text.length > 0) {
            return {
              text,
              confidence: 0.95,
              metadata: { method: 'mistral-pixtral' },
            };
          }
        } else {
          const text = await mistralOCRService.extractTextFromImage(input);
          if (text && text.length > 0) {
            return {
              text,
              confidence: 0.95,
              metadata: { method: 'mistral-pixtral' },
            };
          }
        }
      } catch (error: any) {
        console.warn('[MISTRAL-OCR] Mistral API failed, falling back to Tesseract:', error.message);
      }
    } else {
      console.log('[MISTRAL-OCR] Mistral not available, using Tesseract fallback');
    }

    // Fallback to Tesseract
    return extractWithTesseractFallback(input);
  },

  analyzeImage: async (input: Buffer | string): Promise<ImageAnalysisResult> => {
    console.log('[MISTRAL-OCR] Starting image analysis...');

    // Try Mistral first if available
    if (mistralOCRService.isAvailable()) {
      console.log('[MISTRAL-OCR] Using Mistral Pixtral API for analysis');

      try {
        let text = '';
        if (Buffer.isBuffer(input)) {
          text = await mistralOCRService.extractTextFromImageBuffer(input, 'image/png');
        } else {
          text = await mistralOCRService.extractTextFromImage(input);
        }

        if (text && text.length > 0) {
          return {
            description: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
            labels: [],
            text,
            metadata: { method: 'mistral-pixtral' },
          };
        }
      } catch (error: any) {
        console.warn('[MISTRAL-OCR] Mistral API failed for analysis, falling back to Tesseract:', error.message);
      }
    } else {
      console.log('[MISTRAL-OCR] Mistral not available, using Tesseract fallback for analysis');
    }

    // Fallback to Tesseract
    const result = await extractWithTesseractFallback(input);
    return {
      description: result.text ? result.text.slice(0, 200) + (result.text.length > 200 ? '...' : '') : 'No text found in image',
      labels: [],
      text: result.text,
      metadata: result.metadata,
    };
  },

  // Service is always "available" because we have Tesseract fallback
  isAvailable: () => true,

  // Expose which method is primary
  getPrimaryMethod: () => mistralOCRService.isAvailable() ? 'mistral-pixtral' : 'tesseract',
};

export default mistralOCR;
