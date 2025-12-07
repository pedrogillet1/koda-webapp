/**
 * ============================================================================
 * KODA OCR SERVICE (using Gemini 2.5 Flash Vision)
 * ============================================================================
 *
 * PURPOSE: Extract text from images and scanned PDFs using Gemini's vision capabilities
 *
 * FEATURES:
 * - Image text extraction (PNG, JPG, WEBP, GIF)
 * - Scanned PDF text extraction
 * - Multi-language support
 * - Confidence scoring
 * - Table and structured data extraction
 */

import geminiClient from './geminiClient.service';
import * as fs from 'fs';
import * as path from 'path';

export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  pageCount?: number;
  structuredData?: {
    tables?: string[][];
    lists?: string[];
    headers?: string[];
  };
}

export interface ImageAnalysisResult {
  description: string;
  labels: string[];
  text: string;
  objects?: string[];
}

// Supported image MIME types
const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
];

// Model configuration
const OCR_MODEL = 'gemini-2.5-flash';

class MistralOCRService {
  private static instance: MistralOCRService;

  private constructor() {
    console.log('✅ [MISTRAL-OCR] Service initialized with Gemini 2.5 Flash');
  }

  public static getInstance(): MistralOCRService {
    if (!MistralOCRService.instance) {
      MistralOCRService.instance = new MistralOCRService();
    }
    return MistralOCRService.instance;
  }

  /**
   * Extract text from an image using Gemini Vision
   */
  async extractTextFromImage(input: Buffer | string): Promise<OCRResult> {
    const startTime = Date.now();
    console.log('[MISTRAL-OCR] Starting image text extraction...');

    try {
      // Get image data
      const { base64Data, mimeType } = await this.prepareImageData(input);

      // Create prompt for OCR
      const prompt = `You are an expert OCR system. Extract ALL text from this image with high accuracy.

INSTRUCTIONS:
1. Extract every piece of text visible in the image
2. Maintain the original layout and formatting as much as possible
3. If there are tables, preserve their structure
4. If there are lists, preserve bullet points or numbering
5. Detect the primary language of the text
6. Rate your confidence in the extraction (0-100)

OUTPUT FORMAT:
Return ONLY a JSON object with this structure:
{
  "text": "extracted text here",
  "confidence": 85,
  "language": "en",
  "structuredData": {
    "tables": [["header1", "header2"], ["cell1", "cell2"]],
    "lists": ["item 1", "item 2"],
    "headers": ["Main Title", "Section 1"]
  }
}

If no text is found, return: {"text": "", "confidence": 100, "language": "unknown"}`;

      // Call Gemini Vision
      const model = geminiClient.getModel({
        model: OCR_MODEL,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
        }
      });

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]);

      const response = result.response.text();
      const parsed = this.parseOCRResponse(response);

      const elapsed = Date.now() - startTime;
      console.log(`[MISTRAL-OCR] Extraction complete in ${elapsed}ms. Confidence: ${parsed.confidence}%`);

      return parsed;
    } catch (error: any) {
      console.error('[MISTRAL-OCR] Error extracting text:', error.message);
      return {
        text: '',
        confidence: 0,
        language: 'unknown'
      };
    }
  }

  /**
   * Extract text from a scanned PDF (page by page)
   */
  async extractTextFromScannedPDF(input: Buffer | string, maxPages: number = 50): Promise<OCRResult> {
    const startTime = Date.now();
    console.log('[MISTRAL-OCR] Starting scanned PDF text extraction...');

    try {
      // For PDFs, we need to convert to images first
      // Using pdf-lib or similar would be ideal, but for now we'll use Gemini's native PDF support

      const { base64Data, mimeType } = await this.preparePDFData(input);

      const prompt = `You are an expert OCR system. This is a scanned PDF document. Extract ALL text from every page.

INSTRUCTIONS:
1. Process each page of the PDF
2. Extract all text, maintaining document structure
3. Separate pages with "--- PAGE X ---" markers
4. Preserve tables, lists, headers, and formatting
5. Detect the primary language
6. Rate your confidence in the extraction (0-100)

OUTPUT FORMAT:
Return ONLY a JSON object:
{
  "text": "full extracted text with page markers",
  "confidence": 85,
  "language": "en",
  "pageCount": 3,
  "structuredData": {
    "tables": [],
    "lists": [],
    "headers": []
  }
}`;

      const model = geminiClient.getModel({
        model: OCR_MODEL,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 32768, // Larger for multi-page PDFs
        }
      });

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]);

      const response = result.response.text();
      const parsed = this.parseOCRResponse(response);

      const elapsed = Date.now() - startTime;
      console.log(`[MISTRAL-OCR] PDF extraction complete in ${elapsed}ms. Pages: ${parsed.pageCount || 'unknown'}`);

      return parsed;
    } catch (error: any) {
      console.error('[MISTRAL-OCR] Error extracting PDF text:', error.message);
      return {
        text: '',
        confidence: 0,
        language: 'unknown'
      };
    }
  }

  /**
   * Analyze an image for content (not just text)
   */
  async analyzeImage(input: Buffer | string): Promise<ImageAnalysisResult> {
    const startTime = Date.now();
    console.log('[MISTRAL-OCR] Starting image analysis...');

    try {
      const { base64Data, mimeType } = await this.prepareImageData(input);

      const prompt = `Analyze this image and provide a detailed description.

OUTPUT FORMAT (JSON only):
{
  "description": "A detailed description of what's in the image",
  "labels": ["label1", "label2", "label3"],
  "text": "Any text visible in the image",
  "objects": ["object1", "object2"]
}`;

      const model = geminiClient.getModel({
        model: OCR_MODEL,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        }
      });

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]);

      const response = result.response.text();
      const parsed = this.parseAnalysisResponse(response);

      const elapsed = Date.now() - startTime;
      console.log(`[MISTRAL-OCR] Analysis complete in ${elapsed}ms`);

      return parsed;
    } catch (error: any) {
      console.error('[MISTRAL-OCR] Error analyzing image:', error.message);
      return {
        description: '',
        labels: [],
        text: '',
        objects: []
      };
    }
  }

  /**
   * Check if a document might be scanned (image-based PDF)
   */
  async isScannedDocument(input: Buffer | string): Promise<boolean> {
    try {
      // Simple heuristic: if PDF has very little text layer, it's likely scanned
      // For now, we'll use Gemini to detect
      const { base64Data, mimeType } = await this.preparePDFData(input);

      const prompt = `Look at this PDF and determine if it appears to be a scanned document (image-based) or a native/digital PDF with selectable text.

Return ONLY: {"isScanned": true} or {"isScanned": false}`;

      const model = geminiClient.getModel({
        model: OCR_MODEL,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 50,
        }
      });

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]);

      const response = result.response.text();
      const match = response.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return parsed.isScanned === true;
      }
      return false;
    } catch (error) {
      console.error('[MISTRAL-OCR] Error detecting scanned document:', error);
      return false;
    }
  }

  /**
   * Prepare image data for Gemini API
   */
  private async prepareImageData(input: Buffer | string): Promise<{ base64Data: string; mimeType: string }> {
    let buffer: Buffer;
    let mimeType = 'image/png';

    if (typeof input === 'string') {
      // File path
      if (fs.existsSync(input)) {
        buffer = fs.readFileSync(input);
        mimeType = this.getMimeType(input);
      } else if (input.startsWith('data:')) {
        // Data URL
        const matches = input.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          return { base64Data: matches[2], mimeType };
        }
        throw new Error('Invalid data URL format');
      } else if (input.startsWith('http')) {
        // URL - fetch it
        const response = await fetch(input);
        buffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get('content-type') || 'image/png';
      } else {
        // Assume base64 string
        return { base64Data: input, mimeType: 'image/png' };
      }
    } else {
      buffer = input;
    }

    return {
      base64Data: buffer.toString('base64'),
      mimeType
    };
  }

  /**
   * Prepare PDF data for Gemini API
   */
  private async preparePDFData(input: Buffer | string): Promise<{ base64Data: string; mimeType: string }> {
    let buffer: Buffer;

    if (typeof input === 'string') {
      if (fs.existsSync(input)) {
        buffer = fs.readFileSync(input);
      } else {
        // Assume base64 string
        return { base64Data: input, mimeType: 'application/pdf' };
      }
    } else {
      buffer = input;
    }

    return {
      base64Data: buffer.toString('base64'),
      mimeType: 'application/pdf'
    };
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
      '.pdf': 'application/pdf',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/png';
  }

  /**
   * Parse OCR response from Gemini
   */
  private parseOCRResponse(response: string): OCRResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          text: parsed.text || '',
          confidence: parsed.confidence || 0,
          language: parsed.language || 'unknown',
          pageCount: parsed.pageCount,
          structuredData: parsed.structuredData
        };
      }
    } catch (error) {
      console.warn('[MISTRAL-OCR] Failed to parse JSON response, using raw text');
    }

    // Fallback: use raw response as text
    return {
      text: response,
      confidence: 50,
      language: 'unknown'
    };
  }

  /**
   * Parse analysis response from Gemini
   */
  private parseAnalysisResponse(response: string): ImageAnalysisResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || '',
          labels: parsed.labels || [],
          text: parsed.text || '',
          objects: parsed.objects || []
        };
      }
    } catch (error) {
      console.warn('[MISTRAL-OCR] Failed to parse analysis response');
    }

    return {
      description: response,
      labels: [],
      text: '',
      objects: []
    };
  }

  /**
   * Check if MIME type is supported
   */
  isSupportedImageType(mimeType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.includes(mimeType);
  }
}

// Export singleton instance
export const mistralOCR = MistralOCRService.getInstance();
export default mistralOCR;
