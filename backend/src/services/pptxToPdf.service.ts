import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { uploadFile, getSignedUrl } from '../config/storage';

const execAsync = promisify(exec);

interface ConversionResult {
  success: boolean;
  pdfPath?: string;
  pdfUrl?: string;
  error?: string;
}

class PptxToPdfService {
  /**
   * Convert PPTX file to PDF using LibreOffice
   */
  async convertToPdf(pptxPath: string, userId: string): Promise<ConversionResult> {
    const tempDir = os.tmpdir();
    const outputDir = path.join(tempDir, `pptx-pdf-${crypto.randomUUID()}`);

    try {
      console.log('📄 Converting PPTX to PDF...');

      // Create output directory
      fs.mkdirSync(outputDir, { recursive: true });

      // Convert using LibreOffice
      // Try different LibreOffice command locations
      const commands = [
        `libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${pptxPath}"`,
        `"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --headless --convert-to pdf --outdir "${outputDir}" "${pptxPath}"`,
        `soffice --headless --convert-to pdf --outdir "${outputDir}" "${pptxPath}"`
      ];

      let conversionSucceeded = false;
      let lastError = null;

      for (const command of commands) {
        try {
          console.log(`Trying command: ${command.substring(0, 50)}...`);
          await execAsync(command, {
            timeout: 120000, // 2 minutes
            maxBuffer: 50 * 1024 * 1024 // 50MB
          });
          conversionSucceeded = true;
          break;
        } catch (error: any) {
          lastError = error;
          continue;
        }
      }

      if (!conversionSucceeded) {
        throw new Error(`LibreOffice conversion failed: ${lastError?.message || 'Unknown error'}`);
      }

      // Find generated PDF
      const files = fs.readdirSync(outputDir);
      const pdfFile = files.find(f => f.endsWith('.pdf'));

      if (!pdfFile) {
        throw new Error('PDF conversion failed: No PDF generated');
      }

      const pdfPath = path.join(outputDir, pdfFile);
      console.log(`✅ PDF generated: ${pdfFile}`);

      // Upload to GCS
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfGcsPath = `users/${userId}/previews/${crypto.randomUUID()}.pdf`;

      await uploadFile(pdfGcsPath, pdfBuffer, 'application/pdf');
      console.log(`✅ PDF uploaded to GCS`);

      // Generate signed URL (7 days)
      const pdfUrl = await getSignedUrl(pdfGcsPath, 7 * 24 * 60);

      // Cleanup
      fs.unlinkSync(pdfPath);
      fs.rmdirSync(outputDir, { recursive: true });

      return {
        success: true,
        pdfPath: pdfGcsPath,
        pdfUrl
      };

    } catch (error: any) {
      console.error('❌ PPTX to PDF conversion failed:', error.message);

      // Cleanup on error
      try {
        if (fs.existsSync(outputDir)) {
          fs.rmdirSync(outputDir, { recursive: true });
        }
      } catch {}

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert PPTX buffer to PDF
   */
  async convertBufferToPdf(pptxBuffer: Buffer, userId: string, filename: string): Promise<ConversionResult> {
    const tempPptxPath = path.join(os.tmpdir(), `temp-${crypto.randomUUID()}-${filename}`);

    try {
      fs.writeFileSync(tempPptxPath, pptxBuffer);
      const result = await this.convertToPdf(tempPptxPath, userId);
      fs.unlinkSync(tempPptxPath);
      return result;
    } catch (error: any) {
      try {
        if (fs.existsSync(tempPptxPath)) {
          fs.unlinkSync(tempPptxPath);
        }
      } catch {}

      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new PptxToPdfService();
