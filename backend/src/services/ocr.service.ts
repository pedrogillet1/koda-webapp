/**
 * OCR Service - Optical Character Recognition for Scanned Documents
 *
 * Handles processing of scanned PDFs and images using Google Cloud Vision API
 * Enables KODA to extract text from image-based documents
 */

import vision from '@google-cloud/vision';
import { convert } from 'pdf-poppler';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import pdfParse from 'pdf-parse';

class OCRService {
  private client: vision.ImageAnnotatorClient | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Google Cloud Vision client
   */
  private async initialize() {
    try {
      const keyPath = process.env.GOOGLE_CLOUD_VISION_KEY_PATH;

      if (!keyPath) {
        console.warn('⚠️  [OCR] Google Cloud Vision API key not configured');
        console.warn('   Set GOOGLE_CLOUD_VISION_KEY_PATH environment variable to enable OCR');
        return;
      }

      this.client = new vision.ImageAnnotatorClient({
        keyFilename: keyPath,
      });

      this.isInitialized = true;
      console.log('✅ [OCR] Google Cloud Vision initialized successfully');
    } catch (error) {
      console.error('❌ [OCR] Failed to initialize Google Cloud Vision:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if OCR is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Check if PDF is scanned (image-based) or text-based
   *
   * @param pdfPath - Path to PDF file
   * @returns true if PDF is scanned, false if text-based
   */
  async isScannedPDF(pdfPath: string): Promise<boolean> {
    try {
      console.log(`🔍 [OCR] Checking if PDF is scanned: ${path.basename(pdfPath)}`);

      // Try to extract text using pdf-parse
      const dataBuffer = await fs.readFile(pdfPath);
      const pdfData = await pdfParse(dataBuffer);

      const extractedText = pdfData.text.trim();
      const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;

      console.log(`   📝 Extracted ${wordCount} words from PDF`);

      // Threshold: < 50 words = likely scanned
      // This handles edge cases where PDFs have some metadata but are mostly images
      const isScanned = wordCount < 50;

      if (isScanned) {
        console.log(`   🔍 PDF appears to be scanned (${wordCount} words < 50 threshold)`);
      } else {
        console.log(`   📄 PDF is text-based (${wordCount} words)`);
      }

      return isScanned;
    } catch (error) {
      console.error('❌ [OCR] Error checking if PDF is scanned:', error);
      // If we can't determine, assume it's NOT scanned and let normal processing handle it
      return false;
    }
  }

  /**
   * Process scanned PDF with OCR
   *
   * @param pdfPath - Path to scanned PDF file
   * @returns Extracted text from all pages
   */
  async processScannedPDF(pdfPath: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('OCR is not available. Please configure Google Cloud Vision API.');
    }

    console.log(`🔍 [OCR] Processing scanned PDF: ${path.basename(pdfPath)}`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koda-ocr-'));

    try {
      // Step 1: Convert PDF pages to images
      console.log(`   📄 Converting PDF to images...`);
      const imageFiles = await this.convertPDFToImages(pdfPath, tempDir);
      console.log(`   ✅ Converted ${imageFiles.length} pages`);

      // Step 2: Run OCR on each image
      console.log(`   🔤 Running OCR on ${imageFiles.length} pages...`);
      const ocrResults: string[] = [];

      // Process pages in parallel (5 at a time for better performance)
      const BATCH_SIZE = 5;
      for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, Math.min(i + BATCH_SIZE, imageFiles.length));

        const batchPromises = batch.map(async (imagePath, idx) => {
          const pageNum = i + idx + 1;
          console.log(`      📖 Processing page ${pageNum}/${imageFiles.length}...`);

          const text = await this.runOCROnImage(imagePath);
          return { pageNum, text };
        });

        const batchResults = await Promise.all(batchPromises);

        // Add results in order
        batchResults.forEach(({ text }) => {
          ocrResults.push(text);
        });
      }

      // Step 3: Combine all text
      const fullText = ocrResults
        .map((text, idx) => `--- Page ${idx + 1} ---\n\n${text}`)
        .join('\n\n');

      console.log(`   ✅ OCR complete. Extracted ${fullText.length} characters from ${imageFiles.length} pages`);

      // Calculate cost
      const cost = this.getCostEstimate(imageFiles.length);
      console.log(`   💰 OCR cost estimate: $${cost.toFixed(4)}`);

      return fullText;

    } finally {
      // Clean up temp directory
      await this.cleanupTempDir(tempDir);
    }
  }

  /**
   * Convert PDF pages to images
   *
   * @param pdfPath - Path to PDF file
   * @param outputDir - Directory to save images
   * @returns Array of image file paths
   */
  private async convertPDFToImages(
    pdfPath: string,
    outputDir: string
  ): Promise<string[]> {
    const options = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: 'page',
      page: null, // Convert all pages
    };

    await convert(pdfPath, options);

    // Get list of generated images
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(f => f.endsWith('.png'))
      .sort((a, b) => {
        // Sort numerically (page-1.png, page-2.png, ...)
        const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      })
      .map(f => path.join(outputDir, f));

    return imageFiles;
  }

  /**
   * Run OCR on a single image
   *
   * @param imagePath - Path to image file
   * @returns Extracted text
   */
  private async runOCROnImage(imagePath: string): Promise<string> {
    if (!this.client) {
      throw new Error('OCR client not initialized');
    }

    try {
      // Optimize image for OCR (resize if too large, enhance contrast)
      const optimizedImagePath = await this.optimizeImageForOCR(imagePath);

      // Run Google Cloud Vision OCR
      const [result] = await this.client.textDetection(optimizedImagePath);
      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        console.warn(`      ⚠️  No text detected in ${path.basename(imagePath)}`);
        return '';
      }

      // First annotation contains full text
      const fullText = detections[0].description || '';

      return fullText.trim();

    } catch (error) {
      console.error(`      ❌ OCR failed for ${path.basename(imagePath)}:`, error);
      return '';
    }
  }

  /**
   * Optimize image for better OCR results
   *
   * @param imagePath - Path to original image
   * @returns Path to optimized image
   */
  private async optimizeImageForOCR(imagePath: string): Promise<string> {
    const optimizedPath = imagePath.replace('.png', '-optimized.png');

    try {
      await sharp(imagePath)
        .resize(2000, null, {
          // Resize to max width 2000px
          withoutEnlargement: true,
          fit: 'inside',
        })
        .normalize() // Enhance contrast
        .sharpen() // Sharpen text
        .toFile(optimizedPath);

      return optimizedPath;
    } catch (error) {
      console.error('      ⚠️  Image optimization failed, using original:', error);
      return imagePath;
    }
  }

  /**
   * Clean up temporary directory
   *
   * @param dirPath - Path to temporary directory
   */
  private async cleanupTempDir(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      console.log(`   🧹 Cleaned up temp directory`);
    } catch (error) {
      console.error(`   ⚠️  Failed to clean up temp directory:`, error);
    }
  }

  /**
   * Get OCR cost estimate
   *
   * Google Cloud Vision pricing: $1.50 per 1000 pages (first 1000 pages/month free)
   *
   * @param pageCount - Number of pages
   * @returns Estimated cost in USD
   */
  getCostEstimate(pageCount: number): number {
    // Google Cloud Vision: $1.50 per 1000 pages
    return (pageCount / 1000) * 1.50;
  }
}

export default new OCRService();
