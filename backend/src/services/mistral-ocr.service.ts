/**
 * Mistral OCR Service
 *
 * High-quality OCR for scanned PDFs and images using Mistral's OCR API.
 * This service uses the mistral-ocr-latest model which provides excellent
 * accuracy for scanned documents and images.
 *
 * Features:
 * - PDF OCR with page-by-page processing
 * - Image OCR for JPG, PNG, etc.
 * - Automatic scanned PDF detection
 * - Markdown output with structure preservation
 */

import { Mistral } from '@mistralai/mistralai';
import * as crypto from 'crypto';

// Types
export interface OCRResult {
  text: string;
  markdown: string;
  pageCount: number;
  confidence: number;
  pages: Array<{
    index: number;
    markdown: string;
    images: Array<{
      id: string;
      topLeftX?: number;
      topLeftY?: number;
      bottomRightX?: number;
      bottomRightY?: number;
    }>;
  }>;
}

export interface OCROptions {
  includeImages?: boolean;
  imageLimit?: number;
  pages?: number[];
}

class MistralOCRService {
  private client: Mistral | null = null;
  private isInitialized = false;
  private initializationError: string | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Mistral client
   */
  private initialize(): void {
    try {
      const apiKey = process.env.MISTRAL_API_KEY;

      if (!apiKey) {
        this.initializationError = 'MISTRAL_API_KEY not configured';
        console.warn('[Mistral-OCR] ⚠️ MISTRAL_API_KEY not found in environment');
        return;
      }

      this.client = new Mistral({ apiKey });
      this.isInitialized = true;
      console.log('[Mistral-OCR] ✅ Mistral OCR initialized successfully');
    } catch (error: any) {
      this.initializationError = error.message;
      console.error('[Mistral-OCR] ❌ Failed to initialize:', error.message);
    }
  }

  /**
   * Check if Mistral OCR is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get initialization error if any
   */
  getInitializationError(): string | null {
    return this.initializationError;
  }

  /**
   * Check if a PDF is scanned (image-based) vs native text
   *
   * We try to extract text using pdf-parse first:
   * - If text extraction yields < 100 chars per page, it's likely scanned
   * - This is more reliable than trying OCR first
   */
  async isScannedPDF(fileBuffer: Buffer): Promise<boolean> {
    try {
      // Try to extract text using pdf-parse
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: fileBuffer });
      const data = await parser.getText();

      const text = data.text?.trim() || '';
      const pageCount = data.numpages || 1;
      const avgCharsPerPage = text.length / pageCount;

      // Threshold: less than 100 chars per page = likely scanned
      const isScanned = avgCharsPerPage < 100;

      console.log(`[Mistral-OCR] PDF scan check: ${avgCharsPerPage.toFixed(0)} chars/page (threshold: 100)`);
      console.log(`[Mistral-OCR] Result: ${isScanned ? 'SCANNED' : 'NATIVE TEXT'}`);

      return isScanned;
    } catch (error: any) {
      console.error('[Mistral-OCR] Error checking PDF type:', error.message);
      // If we can't parse it, assume it might be scanned
      return true;
    }
  }

  /**
   * Process a scanned PDF with OCR
   *
   * @param fileBuffer - PDF file buffer
   * @param options - OCR options
   * @returns Extracted text and metadata
   */
  async processScannedPDF(fileBuffer: Buffer, options: OCROptions = {}): Promise<OCRResult> {
    if (!this.client) {
      throw new Error('Mistral OCR not initialized. Check MISTRAL_API_KEY.');
    }

    const startTime = Date.now();
    console.log('[Mistral-OCR] 📄 Starting PDF OCR...');

    try {
      // Step 1: Upload file to Mistral
      console.log('[Mistral-OCR]   📤 Uploading PDF to Mistral...');
      const uploadStartTime = Date.now();

      const uploadedFile = await this.client.files.upload({
        file: {
          fileName: `ocr-${crypto.randomUUID()}.pdf`,
          content: fileBuffer,
        },
        purpose: 'ocr' as any,
      });

      const uploadTime = Date.now() - uploadStartTime;
      console.log(`[Mistral-OCR]   ✅ Upload complete (${uploadTime}ms), file ID: ${uploadedFile.id}`);

      // Step 2: Run OCR
      console.log('[Mistral-OCR]   🔍 Running OCR...');
      const ocrStartTime = Date.now();

      const ocrResponse = await this.client.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'file',
          fileId: uploadedFile.id,
        },
        includeImageBase64: options.includeImages ?? false,
        imageLimit: options.imageLimit,
        pages: options.pages,
      });

      const ocrTime = Date.now() - ocrStartTime;
      console.log(`[Mistral-OCR]   ✅ OCR complete (${ocrTime}ms)`);

      // Step 3: Process results
      const pages = ocrResponse.pages.map(page => ({
        index: page.index,
        markdown: page.markdown,
        images: page.images.map(img => ({
          id: img.id,
          topLeftX: img.topLeftX ?? undefined,
          topLeftY: img.topLeftY ?? undefined,
          bottomRightX: img.bottomRightX ?? undefined,
          bottomRightY: img.bottomRightY ?? undefined,
        })),
      }));

      // Combine all markdown from all pages
      const fullMarkdown = pages.map(p => p.markdown).join('\n\n---\n\n');

      // Convert markdown to plain text for embedding
      const plainText = this.markdownToPlainText(fullMarkdown);

      const totalTime = Date.now() - startTime;
      console.log(`[Mistral-OCR] ✅ PDF OCR complete:`);
      console.log(`   - Pages: ${pages.length}`);
      console.log(`   - Characters: ${plainText.length}`);
      console.log(`   - Words: ${plainText.split(/\s+/).length}`);
      console.log(`   - Total time: ${totalTime}ms`);

      // Step 4: Clean up uploaded file (fire and forget)
      this.deleteUploadedFile(uploadedFile.id).catch(err => {
        console.warn('[Mistral-OCR] Failed to delete uploaded file:', err.message);
      });

      return {
        text: plainText,
        markdown: fullMarkdown,
        pageCount: pages.length,
        confidence: 0.95, // Mistral OCR has high accuracy
        pages,
      };

    } catch (error: any) {
      console.error('[Mistral-OCR] ❌ OCR failed:', error.message);

      // Provide more specific error messages
      if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
        throw new Error('Mistral API key is invalid or expired');
      }
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        throw new Error('Mistral API rate limit exceeded. Please try again later.');
      }
      if (error.message?.includes('400') || error.message?.includes('invalid')) {
        throw new Error('Invalid PDF file or format not supported');
      }

      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from an image using OCR
   *
   * @param imageBuffer - Image file buffer (JPG, PNG, etc.)
   * @param mimeType - Image MIME type
   * @returns Extracted text
   */
  async extractTextFromImage(imageBuffer: Buffer, mimeType: string = 'image/jpeg'): Promise<OCRResult> {
    if (!this.client) {
      throw new Error('Mistral OCR not initialized. Check MISTRAL_API_KEY.');
    }

    const startTime = Date.now();
    console.log('[Mistral-OCR] 🖼️ Starting image OCR...');

    try {
      // Convert image to base64 data URL
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // Run OCR directly with image URL
      const ocrResponse = await this.client.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'image_url',
          imageUrl: dataUrl,
        } as any,
        includeImageBase64: false,
      });

      // Process results
      const pages = ocrResponse.pages.map(page => ({
        index: page.index,
        markdown: page.markdown,
        images: page.images.map(img => ({
          id: img.id,
          topLeftX: img.topLeftX ?? undefined,
          topLeftY: img.topLeftY ?? undefined,
          bottomRightX: img.bottomRightX ?? undefined,
          bottomRightY: img.bottomRightY ?? undefined,
        })),
      }));

      const fullMarkdown = pages.map(p => p.markdown).join('\n\n');
      const plainText = this.markdownToPlainText(fullMarkdown);

      const totalTime = Date.now() - startTime;
      console.log(`[Mistral-OCR] ✅ Image OCR complete (${totalTime}ms): ${plainText.length} chars`);

      return {
        text: plainText,
        markdown: fullMarkdown,
        pageCount: 1,
        confidence: 0.95,
        pages,
      };

    } catch (error: any) {
      console.error('[Mistral-OCR] ❌ Image OCR failed:', error.message);
      throw new Error(`Image OCR failed: ${error.message}`);
    }
  }

  /**
   * Delete an uploaded file from Mistral (cleanup)
   */
  private async deleteUploadedFile(fileId: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.files.delete({ fileId });
      console.log(`[Mistral-OCR] 🗑️ Deleted uploaded file: ${fileId}`);
    } catch (error: any) {
      // Log but don't throw - cleanup failure shouldn't break the flow
      console.warn(`[Mistral-OCR] Failed to delete file ${fileId}:`, error.message);
    }
  }

  /**
   * Convert markdown to plain text
   * Preserves structure but removes markdown syntax
   */
  private markdownToPlainText(markdown: string): string {
    if (!markdown) return '';

    let text = markdown;

    // Remove images: ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

    // Convert links to just text: [text](url) -> text
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

    // Remove bold/italic: **text** or __text__ or *text* or _text_
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');

    // Remove code blocks: ```code``` or `code`
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`([^`]*)`/g, '$1');

    // Remove headers: # ## ### etc - keep the text
    text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

    // Remove horizontal rules
    text = text.replace(/^[-*_]{3,}$/gm, '');

    // Remove blockquotes
    text = text.replace(/^>\s+/gm, '');

    // Remove list markers
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // Normalize whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }
}

// Export singleton instance
const mistralOCR = new MistralOCRService();
export default mistralOCR;
