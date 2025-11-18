/**
 * Mistral OCR Service
 *
 * High-quality OCR for scanned PDFs and images using Mistral's OCR API.
 *
 * BENEFITS:
 * - 95-98% accuracy (vs 70-85% with Tesseract.js)
 * - Handles handwriting
 * - Preserves formatting (markdown output)
 * - Fast cloud processing
 *
 * USAGE:
 * - Automatically used when Google Cloud Vision is unavailable
 * - Requires MISTRAL_API_KEY in .env
 * - Supports PDF and image files
 */

import { Mistral } from '@mistralai/mistralai';
import fs from 'fs/promises';
import { fromBuffer } from 'pdf2pic';
import path from 'path';
import os from 'os';
import * as pdfParseModule from 'pdf-parse';

// Extract PDFParse class from the pdf-parse module
const PDFParse = (pdfParseModule as any).PDFParse;

class MistralOCRService {
  private client: Mistral | null = null;

  constructor() {
    if (process.env.MISTRAL_API_KEY) {
      this.client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
      console.log('✅ Mistral OCR service initialized');
    } else {
      console.warn('⚠️ MISTRAL_API_KEY not configured - OCR will not be available');
    }
  }

  /**
   * Check if Mistral OCR is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Detect if PDF is scanned (image-based) vs text-based
   *
   * Strategy: Count text content. If < 50 words per page, likely scanned.
   *
   * @param pdfBuffer - PDF file buffer
   * @returns true if scanned, false if text-based
   */
  async isScannedPDF(pdfBuffer: Buffer): Promise<boolean> {
    try {
      const parser = new PDFParse({ verbosity: 0, data: pdfBuffer });
      const data = await parser.getText();
      const wordCount = data.text.split(/\s+/).filter(Boolean).length;
      const pageCount = data.numpages;
      const wordsPerPage = wordCount / pageCount;

      console.log(`📊 [OCR] PDF analysis: ${wordCount} words, ${pageCount} pages (${wordsPerPage.toFixed(1)} words/page)`);

      // TEMPORARILY DISABLED: OCR path is broken (pdf2pic fails)
      // Always treat PDFs as text-based to avoid 20s timeout
      const isScanned = false; // Was: wordsPerPage < 50

      console.log('📝 [OCR] Treating as TEXT-BASED PDF (OCR disabled)');

      return isScanned;
    } catch (error) {
      console.error('❌ [OCR] Error analyzing PDF:', error);
      // If we can't parse it, assume text-based (not scanned) to avoid OCR timeout
      return false; // Was: true
    }
  }

  /**
   * Process scanned PDF using Mistral OCR
   *
   * @param pdfBuffer - PDF file buffer
   * @returns Extracted text with markdown formatting
   */
  async processScannedPDF(pdfBuffer: Buffer): Promise<string> {
    if (!this.client) {
      throw new Error('Mistral OCR is not available. Please set MISTRAL_API_KEY in .env');
    }

    try {
      console.log('🔄 [OCR] Processing scanned PDF with Mistral OCR...');

      // Convert PDF pages to images (Mistral API only accepts image formats)
      const options = {
        density: 200, // DPI - higher = better quality but slower
        saveFilename: 'temp-pdf-page',
        savePath: os.tmpdir(),
        format: 'png',
        width: 2000, // Max width in pixels
        height: 2000, // Max height in pixels
      };

      const converter = fromBuffer(pdfBuffer, options);

      // Get first page as image (for multi-page PDFs, we'll process the first page)
      console.log('📸 [OCR] Converting PDF to image...');
      const pageImage = await converter(1, { responseType: 'buffer' });

      if (!pageImage || !pageImage.buffer) {
        throw new Error('Failed to convert PDF to image');
      }

      console.log('✅ [OCR] PDF converted to image successfully');

      // Convert image buffer to base64
      const base64Image = pageImage.buffer.toString('base64');

      // Validate base64 image is not empty
      if (!base64Image || base64Image.length === 0) {
        throw new Error('PDF to image conversion resulted in empty image');
      }

      console.log(`📊 [OCR] Image size: ${(base64Image.length / 1024).toFixed(2)} KB`);

      const dataUrl = `data:image/png;base64,${base64Image}`;

      // Call Mistral OCR API with image
      const response = await this.client.chat.complete({
        model: 'pixtral-12b-2409',
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
                text: 'Extract all text from this document. Preserve the original formatting, structure, and layout. Return the text in markdown format.',
              },
            ],
          },
        ],
      });

      const extractedText = response.choices?.[0]?.message?.content || '';

      if (!extractedText) {
        throw new Error('No text extracted from PDF');
      }

      console.log(`✅ [OCR] Extracted ${extractedText.length} characters from scanned PDF`);

      return extractedText;
    } catch (error) {
      console.error('❌ [OCR] Error processing scanned PDF:', error);
      throw error;
    }
  }

  /**
   * Process scanned image using Mistral OCR
   *
   * @param imageBuffer - Image file buffer
   * @param mimeType - Image MIME type (e.g., 'image/png', 'image/jpeg')
   * @returns Extracted text with markdown formatting
   */
  async processScannedImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    if (!this.client) {
      throw new Error('Mistral OCR is not available. Please set MISTRAL_API_KEY in .env');
    }

    try {
      console.log(`🔄 [OCR] Processing scanned image (${mimeType}) with Mistral OCR...`);

      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      // Call Mistral OCR API
      const response = await this.client.chat.complete({
        model: 'pixtral-12b-2409',
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
                text: 'Extract all text from this image. Preserve the original formatting, structure, and layout. Return the text in markdown format.',
              },
            ],
          },
        ],
      });

      const extractedText = response.choices?.[0]?.message?.content || '';

      if (!extractedText) {
        throw new Error('No text extracted from image');
      }

      console.log(`✅ [OCR] Extracted ${extractedText.length} characters from scanned image`);

      return extractedText;
    } catch (error) {
      console.error('❌ [OCR] Error processing scanned image:', error);
      throw error;
    }
  }
}

export default new MistralOCRService();
