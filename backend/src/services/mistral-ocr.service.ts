/**
 * ============================================================================
 * MISTRAL OCR SERVICE - Real Implementation
 * ============================================================================
 *
 * PURPOSE: Extract text from scanned PDFs and images using Mistral's Pixtral model
 *
 * FEATURES:
 * - Scanned PDF detection (text-based vs image-based)
 * - PDF to image conversion using pdf2pic
 * - OCR via Mistral Pixtral-12b-2409 vision model
 * - Batch processing for multi-page PDFs
 * - Fallback handling when API is unavailable
 *
 * REQUIREMENTS:
 * - MISTRAL_API_KEY in .env
 * - pdf2pic, sharp dependencies
 */

import { Mistral } from '@mistralai/mistralai';
import { fromBuffer } from 'pdf2pic';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

class MistralOCRService {
  private client: Mistral | null = null;
  private isInitialized = false;
  private model = 'pixtral-12b-2409';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Mistral client
   */
  private initialize() {
    try {
      const apiKey = process.env.MISTRAL_API_KEY;

      if (!apiKey) {
        console.warn('[MISTRAL-OCR] API key not configured. Set MISTRAL_API_KEY in .env');
        return;
      }

      this.client = new Mistral({ apiKey });
      this.isInitialized = true;
      console.log('[MISTRAL-OCR] Service initialized successfully');
    } catch (error) {
      console.error('[MISTRAL-OCR] Failed to initialize:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if Mistral OCR service is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Check if a PDF is scanned (image-based) vs text-based
   *
   * @param pdfBuffer - PDF file as Buffer
   * @returns true if PDF is scanned, false if text-based
   */
  async isScannedPDF(pdfBuffer: Buffer): Promise<boolean> {
    try {
      console.log('[MISTRAL-OCR] Checking if PDF is scanned...');

      // Try to extract text using pdf-parse v2
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: pdfBuffer });
      const pdfData = await parser.getText();

      const extractedText = pdfData.text?.trim() || '';
      const pageCount = pdfData.numpages || 1;
      const charsPerPage = extractedText.length / pageCount;

      console.log(`[MISTRAL-OCR] PDF analysis: ${pageCount} pages, ${charsPerPage.toFixed(0)} chars/page`);

      // If less than 100 chars per page, it's likely scanned
      const isScanned = charsPerPage < 100;

      if (isScanned) {
        console.log('[MISTRAL-OCR] PDF detected as SCANNED (image-based)');
      } else {
        console.log('[MISTRAL-OCR] PDF detected as TEXT-BASED (native)');
      }

      return isScanned;
    } catch (error: any) {
      console.error('[MISTRAL-OCR] Error checking PDF type:', error.message);
      // If we can't determine, assume it's NOT scanned
      return false;
    }
  }

  /**
   * Process a scanned PDF and extract text using Mistral OCR
   *
   * @param pdfBuffer - PDF file as Buffer
   * @returns Extracted text from all pages
   */
  async processScannedPDF(pdfBuffer: Buffer): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Mistral OCR service is not available. Check MISTRAL_API_KEY.');
    }

    console.log('[MISTRAL-OCR] Processing scanned PDF...');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mistral-ocr-'));

    try {
      // Step 1: Convert PDF pages to images
      console.log('[MISTRAL-OCR] Converting PDF to images...');
      const images = await this.convertPDFToImages(pdfBuffer, tempDir);
      console.log(`[MISTRAL-OCR] Converted ${images.length} pages to images`);

      // Step 2: Run OCR on each image
      const extractedTexts: string[] = [];
      const BATCH_SIZE = 3; // Process 3 pages at a time to avoid rate limits

      for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, Math.min(i + BATCH_SIZE, images.length));

        const batchPromises = batch.map(async (imagePath, idx) => {
          const pageNum = i + idx + 1;
          console.log(`[MISTRAL-OCR] Processing page ${pageNum}/${images.length}...`);

          const text = await this.extractTextFromImage(imagePath);
          return { pageNum, text };
        });

        const batchResults = await Promise.all(batchPromises);

        // Sort by page number and add to results
        batchResults.sort((a, b) => a.pageNum - b.pageNum);
        batchResults.forEach(({ text }) => extractedTexts.push(text));

        // Small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < images.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Step 3: Combine all text
      const fullText = extractedTexts
        .map((text, idx) => `--- Page ${idx + 1} ---\n\n${text}`)
        .join('\n\n');

      console.log(`[MISTRAL-OCR] OCR complete. Extracted ${fullText.length} characters from ${images.length} pages`);

      return fullText;

    } finally {
      // Clean up temp directory
      await this.cleanupTempDir(tempDir);
    }
  }

  /**
   * Extract text from a single image using Mistral Pixtral
   *
   * @param imagePath - Path to image file
   * @returns Extracted text
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    if (!this.client) {
      throw new Error('Mistral client not initialized');
    }

    try {
      // Read and encode image as base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Determine mime type
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      // Call Mistral API with Pixtral model
      const response = await this.client.chat.complete({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                imageUrl: dataUrl,
              },
              {
                type: 'text',
                text: `Extract ALL text from this document image.

Instructions:
- Extract every word, number, and symbol visible in the image
- Preserve the original formatting and structure as much as possible
- Include headers, footers, page numbers, tables, and any other text
- For tables, format them in a readable way
- If text is unclear, indicate with [unclear]
- Do NOT add any commentary or explanations
- Return ONLY the extracted text`,
              },
            ],
          },
        ],
      });

      const extractedText = (response.choices?.[0]?.message?.content as string) || '';
      return extractedText.trim();

    } catch (error: any) {
      console.error(`[MISTRAL-OCR] Error extracting text from image:`, error.message);
      return '';
    }
  }

  /**
   * Extract text from image buffer directly
   *
   * @param imageBuffer - Image as Buffer
   * @param mimeType - MIME type of image
   * @returns Extracted text
   */
  async extractTextFromImageBuffer(imageBuffer: Buffer, mimeType: string): Promise<string> {
    if (!this.client) {
      throw new Error('Mistral client not initialized');
    }

    try {
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const response = await this.client.chat.complete({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                imageUrl: dataUrl,
              },
              {
                type: 'text',
                text: `Extract ALL text from this image. Return only the extracted text, nothing else.`,
              },
            ],
          },
        ],
      });

      const extractedText = (response.choices?.[0]?.message?.content as string) || '';
      return extractedText.trim();

    } catch (error: any) {
      console.error(`[MISTRAL-OCR] Error extracting text from image buffer:`, error.message);
      return '';
    }
  }

  /**
   * Convert PDF buffer to images
   */
  private async convertPDFToImages(pdfBuffer: Buffer, outputDir: string): Promise<string[]> {
    try {
      // Configure pdf2pic
      const converter = fromBuffer(pdfBuffer, {
        density: 200, // DPI - higher = better quality but larger files
        saveFilename: 'page',
        savePath: outputDir,
        format: 'png',
        width: 2000, // Max width
        height: 2800, // Max height (A4 ratio)
      });

      // Get page count first using pdf-parse v2
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: pdfBuffer });
      const pdfData = await parser.getText();
      const pageCount = pdfData.numpages || 1;

      console.log(`[MISTRAL-OCR] Converting ${pageCount} PDF pages to images...`);

      // Convert all pages
      const imageFiles: string[] = [];

      for (let page = 1; page <= pageCount; page++) {
        try {
          const result = await converter(page, { responseType: 'image' });
          if (result.path) {
            imageFiles.push(result.path);
          }
        } catch (pageError: any) {
          console.warn(`[MISTRAL-OCR] Failed to convert page ${page}:`, pageError.message);
        }
      }

      return imageFiles;

    } catch (error: any) {
      console.error('[MISTRAL-OCR] PDF conversion failed:', error.message);
      throw new Error(`Failed to convert PDF to images: ${error.message}`);
    }
  }

  /**
   * Clean up temporary directory
   */
  private async cleanupTempDir(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      console.log('[MISTRAL-OCR] Cleaned up temp directory');
    } catch (error) {
      console.warn('[MISTRAL-OCR] Failed to clean up temp directory:', error);
    }
  }

  /**
   * Get cost estimate for OCR
   * Mistral Pixtral pricing: ~$0.50 per 1000 images
   */
  getCostEstimate(pageCount: number): number {
    return (pageCount / 1000) * 0.50;
  }
}

// Export singleton instance
const mistralOCRService = new MistralOCRService();
export default mistralOCRService;

// Also export the class for testing
export { MistralOCRService };
