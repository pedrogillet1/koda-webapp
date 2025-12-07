/**
 * ============================================================================
 * KODA VISION SERVICE
 * ============================================================================
 *
 * PURPOSE: High-level vision API that wraps the OCR service
 *
 * This service provides a clean API for:
 * - Image analysis (description, labels, objects)
 * - Text extraction from images (OCR)
 * - Text extraction from scanned PDFs
 */

import mistralOCR, { OCRResult, ImageAnalysisResult } from './mistralOCR.service';

// Re-export types for convenience
export { OCRResult, ImageAnalysisResult };

/**
 * Analyze an image and get description, labels, and text
 */
export const analyzeImage = async (input: Buffer | string): Promise<ImageAnalysisResult> => {
  console.log('[VISION] Analyzing image...');
  try {
    const result = await mistralOCR.analyzeImage(input);
    console.log(`[VISION] Analysis complete. Labels: ${result.labels.length}, Text found: ${result.text.length > 0}`);
    return result;
  } catch (error: any) {
    console.error('[VISION] Error analyzing image:', error.message);
    return {
      description: '',
      labels: [],
      text: ''
    };
  }
};

/**
 * Extract text from an image using OCR
 */
export const extractTextFromImage = async (input: Buffer | string): Promise<OCRResult> => {
  console.log('[VISION] Extracting text from image...');
  try {
    const result = await mistralOCR.extractTextFromImage(input);
    console.log(`[VISION] OCR complete. Confidence: ${result.confidence}%, Language: ${result.language}`);
    return result;
  } catch (error: any) {
    console.error('[VISION] Error extracting text:', error.message);
    return {
      text: '',
      confidence: 0,
      language: 'en'
    };
  }
};

/**
 * Extract text from a scanned PDF (image-based PDF)
 */
export const extractTextFromScannedPDF = async (input: Buffer | string): Promise<OCRResult> => {
  console.log('[VISION] Extracting text from scanned PDF...');
  try {
    const result = await mistralOCR.extractTextFromScannedPDF(input);
    console.log(`[VISION] PDF OCR complete. Pages: ${result.pageCount || 'unknown'}, Confidence: ${result.confidence}%`);
    return result;
  } catch (error: any) {
    console.error('[VISION] Error extracting PDF text:', error.message);
    return {
      text: '',
      confidence: 0,
      language: 'en'
    };
  }
};

/**
 * Check if a PDF is scanned (image-based) vs native
 */
export const isScannedPDF = async (input: Buffer | string): Promise<boolean> => {
  console.log('[VISION] Checking if PDF is scanned...');
  try {
    const result = await mistralOCR.isScannedDocument(input);
    console.log(`[VISION] PDF scan check: ${result ? 'SCANNED' : 'NATIVE'}`);
    return result;
  } catch (error: any) {
    console.error('[VISION] Error checking PDF type:', error.message);
    return false;
  }
};

/**
 * Check if a MIME type is supported for OCR
 */
export const isSupportedImageType = (mimeType: string): boolean => {
  return mistralOCR.isSupportedImageType(mimeType);
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
        language: 'unknown'
      };
    }
  }

  // Unsupported type
  console.log('[VISION] Unsupported MIME type for OCR');
  return {
    text: '',
    confidence: 0,
    language: 'unknown'
  };
};

// Default export with all functions
export default {
  analyzeImage,
  extractTextFromImage,
  extractTextFromScannedPDF,
  isScannedPDF,
  isSupportedImageType,
  processDocumentOCR
};
