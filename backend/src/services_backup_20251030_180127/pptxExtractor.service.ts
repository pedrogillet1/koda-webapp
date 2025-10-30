import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface SlideData {
  slide_number: number;
  content: string;
  text_count: number;
}

interface PPTXMetadata {
  title: string;
  author: string;
  subject: string;
  created: string;
  modified: string;
  slide_count: number;
  slide_width?: number;
  slide_height?: number;
}

interface PPTXExtractionResult {
  success: boolean;
  fullText?: string;
  slides?: SlideData[];
  metadata?: PPTXMetadata;
  totalSlides?: number;
  slidesWithText?: number;
  totalCharacters?: number;
  error?: string;
}

export class PPTXExtractorService {

  /**
   * Extract text from PPTX file using Python script
   */
  async extractText(filePath: string): Promise<PPTXExtractionResult> {
    try {
      console.log(`📊 [PPTX Extractor] Starting extraction: ${path.basename(filePath)}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file size for logging
      const stats = fs.statSync(filePath);
      console.log(`📊 [PPTX Extractor] File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Run Python extraction script
      const scriptPath = path.join(__dirname, '../../scripts/extract_pptx.py');

      // Check if Python script exists
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Python extraction script not found: ${scriptPath}`);
      }

      // Execute Python script with timeout
      const { stdout, stderr } = await execAsync(
        `python "${scriptPath}" "${filePath}"`,
        {
          timeout: 120000, // 2 minute timeout
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );

      if (stderr) {
        console.warn(`📊 [PPTX Extractor] Python stderr:`, stderr);
      }

      // Parse JSON output
      const result = JSON.parse(stdout);

      if (!result.success) {
        throw new Error(result.error || 'Failed to extract text from PPTX');
      }

      console.log(`✅ [PPTX Extractor] Extraction successful:`);
      console.log(`   - Total slides: ${result.total_slides}`);
      console.log(`   - Slides with text: ${result.slides_with_text}`);
      console.log(`   - Total characters: ${result.total_characters}`);
      console.log(`   - Title: ${result.metadata?.title || 'N/A'}`);
      console.log(`   - Author: ${result.metadata?.author || 'N/A'}`);

      return {
        success: true,
        fullText: result.full_text,
        slides: result.slides,
        metadata: result.metadata,
        totalSlides: result.total_slides,
        slidesWithText: result.slides_with_text,
        totalCharacters: result.total_characters
      };

    } catch (error: any) {
      console.error('❌ [PPTX Extractor] Error:', error.message);

      // Check if it's a Python dependency issue
      if (error.message.includes('python-pptx')) {
        return {
          success: false,
          error: 'Python dependency "python-pptx" not installed. Run: pip install python-pptx'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if Python and required dependencies are installed
   */
  async checkDependencies(): Promise<{ installed: boolean; message: string }> {
    try {
      // Check Python
      const { stdout: pythonVersion } = await execAsync('python --version');
      console.log(`🐍 Python version: ${pythonVersion.trim()}`);

      // Check python-pptx
      const { stdout: pptxCheck } = await execAsync('python -c "import pptx; print(pptx.__version__)"');
      console.log(`📦 python-pptx version: ${pptxCheck.trim()}`);

      return {
        installed: true,
        message: `Python ${pythonVersion.trim()}, python-pptx ${pptxCheck.trim()}`
      };

    } catch (error: any) {
      return {
        installed: false,
        message: `Missing dependencies: ${error.message}. Install with: pip install python-pptx`
      };
    }
  }
}

export const pptxExtractorService = new PPTXExtractorService();
