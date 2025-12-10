/**
 * ============================================================================
 * KODA VISION SERVICE
 * ============================================================================
 *
 * PURPOSE: High-level vision API that wraps the OCR services
 *
 * This service provides a clean API for:
 * - Image analysis (description, labels, objects)
 * - Text extraction from images (OCR)
 * - Text extraction from scanned PDFs
 *
 * Uses: ocr.service.ts (primary) with fallbacks
 */

import ocrService from './ocr.service';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Types
export interface OCRResult {
  text: string;
  confidence?: number;
  language?: string;
  pageCount?: number;
}

export interface ImageAnalysisResult {
  description: string;
  labels: string[];
  text: string;
}

/**
 * Helper to save buffer to temp file and return path
 */
async function saveBufferToTempFile(buffer: Buffer, extension: string = '.png'): Promise<string> {
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `ocr-${crypto.randomUUID()}${extension}`);
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

/**
 * Helper to clean up temp file
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`[VISION] Failed to clean up temp file: ${filePath}`);
  }
}

/**
 * Analyze an image and get description, labels, and text
 */
export const analyzeImage = async (input: Buffer | string): Promise<ImageAnalysisResult> => {
  console.log('[VISION] Analyzing image...');
  try {
    if (!ocrService.isAvailable()) {
      console.warn('[VISION] OCR service not available');
      return { description: '', labels: [], text: '' };
    }

    let text = '';
    let tempPath = '';

    try {
      if (Buffer.isBuffer(input)) {
        tempPath = await saveBufferToTempFile(input, '.png');
        const result = await ocrService.extractTextFromImage(tempPath);
        text = result.text;
      } else {
        const result = await ocrService.extractTextFromImage(input);
        text = result.text;
      }
    } finally {
      if (tempPath) await cleanupTempFile(tempPath);
    }

    console.log(`[VISION] Analysis complete. Text found: ${text.length > 0}`);
    return {
      description: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
      labels: [],
      text,
    };
  } catch (error: any) {
    console.error('[VISION] Error analyzing image:', error.message);
    return {
      description: '',
      labels: [],
      text: '',
    };
  }
};

/**
 * Extract text from an image using OCR
 */
export const extractTextFromImage = async (input: Buffer | string): Promise<OCRResult> => {
  console.log('[VISION] Extracting text from image...');
  try {
    if (!ocrService.isAvailable()) {
      console.warn('[VISION] OCR service not available');
      return { text: '', confidence: 0 };
    }

    let tempPath = '';

    try {
      if (Buffer.isBuffer(input)) {
        tempPath = await saveBufferToTempFile(input, '.png');
        const result = await ocrService.extractTextFromImage(tempPath);
        console.log(`[VISION] OCR complete. Extracted ${result.text.length} characters`);
        return {
          text: result.text,
          confidence: result.confidence / 100, // Convert from percentage to 0-1
        };
      } else {
        const result = await ocrService.extractTextFromImage(input);
        console.log(`[VISION] OCR complete. Extracted ${result.text.length} characters`);
        return {
          text: result.text,
          confidence: result.confidence / 100,
        };
      }
    } finally {
      if (tempPath) await cleanupTempFile(tempPath);
    }
  } catch (error: any) {
    console.error('[VISION] Error extracting text:', error.message);
    return {
      text: '',
      confidence: 0,
    };
  }
};

/**
 * Extract text from a scanned PDF (image-based PDF)
 */
export const extractTextFromScannedPDF = async (input: Buffer | string): Promise<OCRResult> => {
  console.log('[VISION] Extracting text from scanned PDF...');
  try {
    if (!ocrService.isAvailable()) {
      console.warn('[VISION] OCR service not available');
      return { text: '', confidence: 0 };
    }

    let tempPath = '';

    try {
      if (Buffer.isBuffer(input)) {
        tempPath = await saveBufferToTempFile(input, '.pdf');
        // processScannedPDF returns a string directly
        const text = await ocrService.processScannedPDF(tempPath);
        console.log(`[VISION] PDF OCR complete. Extracted ${text.length} characters`);
        return {
          text,
          confidence: text.length > 0 ? 0.85 : 0,
        };
      } else {
        const text = await ocrService.processScannedPDF(input);
        console.log(`[VISION] PDF OCR complete. Extracted ${text.length} characters`);
        return {
          text,
          confidence: text.length > 0 ? 0.85 : 0,
        };
      }
    } finally {
      if (tempPath) await cleanupTempFile(tempPath);
    }
  } catch (error: any) {
    console.error('[VISION] Error extracting PDF text:', error.message);
    return {
      text: '',
      confidence: 0,
    };
  }
};

/**
 * Check if a PDF is scanned (image-based) vs native
 */
export const isScannedPDF = async (input: Buffer | string): Promise<boolean> => {
  console.log('[VISION] Checking if PDF is scanned...');
  try {
    let tempPath = '';

    try {
      if (Buffer.isBuffer(input)) {
        tempPath = await saveBufferToTempFile(input, '.pdf');
        const result = await ocrService.isScannedPDF(tempPath);
        console.log(`[VISION] PDF scan check: ${result ? 'SCANNED' : 'NATIVE'}`);
        return result;
      } else {
        const result = await ocrService.isScannedPDF(input);
        console.log(`[VISION] PDF scan check: ${result ? 'SCANNED' : 'NATIVE'}`);
        return result;
      }
    } finally {
      if (tempPath) await cleanupTempFile(tempPath);
    }
  } catch (error: any) {
    console.error('[VISION] Error checking PDF type:', error.message);
    return false;
  }
};

/**
 * Check if a MIME type is supported for OCR
 */
export const isSupportedImageType = (mimeType: string): boolean => {
  const supportedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ];
  return supportedTypes.includes(mimeType);
};

/**
 * Process a document for OCR if needed
 * Automatically detects if OCR is needed and extracts text
 */
export const processDocumentOCR = async (
  input: Buffer | string,
  mimeType: string
): Promise<OCRResult> => {
  console.log(`[VISION] Processing document for OCR. MIME: ${mimeType}`);

  // Check if it's an image
  if (mimeType.startsWith('image/')) {
    return extractTextFromImage(input);
  }

  // Check if it's a PDF
  if (mimeType === 'application/pdf') {
    // Check if it's a scanned PDF
    const isScanned = await isScannedPDF(input);
    if (isScanned) {
      console.log('[VISION] Detected scanned PDF, running OCR...');
      return extractTextFromScannedPDF(input);
    } else {
      console.log('[VISION] Native PDF detected, OCR not needed');
      return {
        text: '',
        confidence: 100,
      };
    }
  }

  // Unsupported type
  console.log('[VISION] Unsupported MIME type for OCR');
  return {
    text: '',
    confidence: 0,
  };
};

// Default export with all functions
export default {
  analyzeImage,
  extractTextFromImage,
  extractTextFromScannedPDF,
  isScannedPDF,
  isSupportedImageType,
  processDocumentOCR,
};
