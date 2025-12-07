/**
 * Stub file - mistralOCR service was consolidated into ocr.service.ts
 * This stub prevents runtime errors for any remaining imports
 */

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

// Stub implementation - delegates to ocr.service.ts
import * as ocrService from './ocr.service';

const mistralOCR = {
  extractText: async (input: Buffer | string): Promise<OCRResult> => {
    console.warn('[MISTRAL-OCR-STUB] Using ocr.service.ts instead');
    const result = await ocrService.performOCR(input);
    return {
      text: result.text || '',
      confidence: result.confidence,
      metadata: result
    };
  },

  analyzeImage: async (input: Buffer | string): Promise<ImageAnalysisResult> => {
    console.warn('[MISTRAL-OCR-STUB] Using ocr.service.ts instead');
    const result = await ocrService.performOCR(input);
    return {
      description: result.text || '',
      text: result.text,
      metadata: result
    };
  }
};

export default mistralOCR;
