import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { bucket } from '../config/storage';

const execAsync = promisify(exec);

interface SlideImage {
  slideNumber: number;
  localPath: string;
  gcsPath?: string;
  publicUrl?: string;
  width?: number;
  height?: number;
}

interface SlideGenerationResult {
  success: boolean;
  slides?: SlideImage[];
  totalSlides?: number;
  error?: string;
}

export class PPTXSlideGeneratorService {
  private libreOfficePath: string;

  constructor() {
    // Common LibreOffice installation paths on Windows
    const possiblePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
      'C:\\Program Files\\LibreOffice 24\\program\\soffice.exe',
      'soffice', // If in PATH
    ];

    // Find the first existing path
    this.libreOfficePath = possiblePaths.find(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || possiblePaths[0];

    console.log(`[PPTX Slide Generator] Using LibreOffice path: ${this.libreOfficePath}`);
  }

  /**
   * Check if LibreOffice is installed and accessible
   */
  async checkLibreOffice(): Promise<{ installed: boolean; version?: string; path?: string; message: string }> {
    try {
      // Try to find LibreOffice
      const { stdout } = await execAsync(`"${this.libreOfficePath}" --version`, {
        timeout: 10000
      });

      const version = stdout.trim();
      console.log(`✅ [PPTX Slide Generator] LibreOffice found: ${version}`);

      return {
        installed: true,
        version: version,
        path: this.libreOfficePath,
        message: `LibreOffice is installed: ${version}`
      };
    } catch (error: any) {
      // Try alternate paths
      for (const altPath of [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
      ]) {
        try {
          const { stdout } = await execAsync(`"${altPath}" --version`, { timeout: 10000 });
          this.libreOfficePath = altPath;
          console.log(`✅ [PPTX Slide Generator] LibreOffice found at: ${altPath}`);
          return {
            installed: true,
            version: stdout.trim(),
            path: altPath,
            message: `LibreOffice is installed at: ${altPath}`
          };
        } catch (e) {
          continue;
        }
      }

      console.error('❌ [PPTX Slide Generator] LibreOffice not found');
      return {
        installed: false,
        message: 'LibreOffice is not installed. Please install from https://www.libreoffice.org/'
      };
    }
  }

  /**
   * Generate slide images from PPTX file
   * Process: PPTX → PDF → PNG images
   */
  async generateSlideImages(
    pptxFilePath: string,
    documentId: string,
    options: {
      uploadToGCS?: boolean;
      maxWidth?: number;
      quality?: number;
    } = {}
  ): Promise<SlideGenerationResult> {
    const {
      uploadToGCS = true,
      maxWidth = 1920,
      quality = 90
    } = options;

    console.log(`📊 [PPTX Slide Generator] Starting slide generation for: ${path.basename(pptxFilePath)}`);
    console.time('Total slide generation time');

    try {
      // 1. Check if file exists
      if (!fs.existsSync(pptxFilePath)) {
        throw new Error(`PPTX file not found: ${pptxFilePath}`);
      }

      // 2. Check LibreOffice installation
      const libreOfficeCheck = await this.checkLibreOffice();
      if (!libreOfficeCheck.installed) {
        throw new Error(libreOfficeCheck.message);
      }

      // 3. Create temp directory for processing
      const relativeTempDir = path.join('temp', `pptx-${documentId}-${Date.now()}`);
      const tempDir = path.join(process.cwd(), relativeTempDir);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      console.log(`📁 [PPTX Slide Generator] Created temp directory: ${tempDir}`);

      // 4. Convert PPTX to PDF using LibreOffice
      console.log(`📄 [PPTX Slide Generator] Converting PPTX to PDF...`);
      console.time('PPTX → PDF conversion');

      // Standard PDF conversion - fonts will be embedded automatically
      await execAsync(
        `"${this.libreOfficePath}" --headless --convert-to pdf --outdir "${tempDir}" "${pptxFilePath}"`,
        {
          timeout: 120000, // 2 minute timeout
          maxBuffer: 50 * 1024 * 1024 // 50MB buffer
        }
      );

      console.timeEnd('PPTX → PDF conversion');

      // 5. Find the generated PDF
      const pdfFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        throw new Error('PDF conversion failed - no PDF file generated');
      }

      const pdfPath = path.join(tempDir, pdfFiles[0]);
      console.log(`✅ [PPTX Slide Generator] PDF created: ${pdfFiles[0]}`);

      // 6. Convert PDF pages to PNG images
      console.log(`🖼️  [PPTX Slide Generator] Converting PDF to images...`);
      console.time('PDF → PNG conversion');

      let pngFiles: string[] = [];

      // Try Ghostscript first (best font support)
      try {
        const gsPath = 'C:\\Program Files\\gs\\gs10.06.0\\bin\\gswin64c.exe';
        if (fs.existsSync(gsPath)) {
          console.log('   Using Ghostscript for PDF conversion...');

          // Convert each page of PDF to PNG using Ghostscript
          // -dNOPAUSE -dBATCH: Non-interactive mode
          // -sDEVICE=png16m: 24-bit PNG output
          // -r150: 150 DPI resolution
          // -dTextAlphaBits=4 -dGraphicsAlphaBits=4: Anti-aliasing
          await execAsync(
            `"${gsPath}" -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile="${path.join(tempDir, 'slide-%d.png')}" "${pdfPath}"`,
            {
              timeout: 120000,
              maxBuffer: 50 * 1024 * 1024
            }
          );

          // Get generated PNG files
          pngFiles = fs.readdirSync(tempDir)
            .filter(f => f.endsWith('.png') && f.startsWith('slide-'))
            .sort((a, b) => {
              const getPageNum = (filename: string) => {
                const match = filename.match(/slide-(\d+)\.png/);
                return match ? parseInt(match[1], 10) : 0;
              };
              return getPageNum(a) - getPageNum(b);
            });

          console.log(`✅ [Ghostscript] Converted PDF to ${pngFiles.length} PNG images`);
          console.timeEnd('PDF → PNG conversion');
        } else {
          throw new Error('Ghostscript not found');
        }
      } catch (ghostscriptError: any) {
        console.warn('   Ghostscript failed, trying ImageMagick...');

        // Try ImageMagick as fallback (better font support)
      let magickCommand = 'magick';
      let imageMagickFound = false;

      try {
        // Try user directory installation first (most likely location)
        const userMagickPath = path.join(process.env.USERPROFILE || '', 'ImageMagick', 'magick.exe');
        if (fs.existsSync(userMagickPath)) {
          magickCommand = `"${userMagickPath}"`;
          try {
            await execAsync(`${magickCommand} -version`, { timeout: 5000 });
            imageMagickFound = true;
            console.log(`   Using ImageMagick from: ${userMagickPath}`);
          } catch (e) {
            console.warn(`   ImageMagick found at ${userMagickPath} but failed to execute`);
          }
        }

        // If not found in user directory, try system PATH
        if (!imageMagickFound) {
          try {
            await execAsync(`magick -version`, { timeout: 5000 });
            magickCommand = 'magick';
            imageMagickFound = true;
            console.log('   Using ImageMagick from PATH');
          } catch (e) {
            throw new Error('ImageMagick not found');
          }
        }

        console.log('   Using ImageMagick for better font rendering...');

        // Convert each page of PDF to PNG using ImageMagick
        // -density 150: High quality (150 DPI)
        // -quality 90: PNG compression quality
        // -alpha remove: Remove transparency
        // -background white: Set white background
        await execAsync(
          `${magickCommand} -density 150 -quality 90 -alpha remove -background white "${pdfPath}" "${path.join(tempDir, 'slide-%d.png')}"`,
          {
            timeout: 120000,
            maxBuffer: 50 * 1024 * 1024
          }
        );

        // Get generated PNG files
        pngFiles = fs.readdirSync(tempDir)
          .filter(f => f.endsWith('.png') && f.startsWith('slide-'))
          .sort((a, b) => {
            const getPageNum = (filename: string) => {
              const match = filename.match(/slide-(\d+)\.png/);
              return match ? parseInt(match[1], 10) : 0;
            };
            return getPageNum(a) - getPageNum(b);
          });

        console.log(`✅ [ImageMagick] Converted PDF to ${pngFiles.length} PNG images`);

      } catch (imageMagickError: any) {
        // Fallback to pdf-to-png-converter
        console.warn('   ImageMagick failed with error:');
        console.warn(`   ${imageMagickError.message}`);
        console.warn('   Falling back to pdf-to-png-converter...');
        console.warn('   Note: Install ImageMagick for better font rendering (run scripts/install-imagemagick.ps1)');

        const pdfConverter = require('pdf-to-png-converter');

        const pngPages = await pdfConverter.pdfToPng(pdfPath, {
          disableFontFace: false,
          useSystemFonts: true,
          viewportScale: 2.0,
          outputFolder: relativeTempDir,
          outputFileMask: 'slide',
          pdfFilePassword: ''
        });

        console.log(`✅ [pdf-to-png-converter] Converted PDF to ${pngPages.length} PNG images`);

        // Get all generated PNG files
        pngFiles = fs.readdirSync(tempDir)
          .filter(f => f.endsWith('.png') && f.includes('_page_'))
          .sort((a, b) => {
            const getPageNum = (filename: string) => {
              const match = filename.match(/_page_(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            };
            return getPageNum(a) - getPageNum(b);
          });
      }
      }

      if (pngFiles.length === 0) {
        throw new Error('No slide images were generated');
      }

      console.log(`✅ [PPTX Slide Generator] Generated ${pngFiles.length} slide images`);

      // 8. Optimize images with Sharp
      console.log(`⚡ [PPTX Slide Generator] Optimizing images...`);
      console.time('Image optimization');

      const slides: SlideImage[] = [];

      for (let i = 0; i < pngFiles.length; i++) {
        const inputPath = path.join(tempDir, pngFiles[i]);
        const optimizedFilename = `slide-${i + 1}.webp`;
        const outputPath = path.join(tempDir, optimizedFilename);

        // Optimize with Sharp (resize and convert to WebP)
        const metadata = await sharp(inputPath)
          .resize(maxWidth, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality })
          .toFile(outputPath);

        console.log(`📸 [PPTX Slide Generator] Optimized slide ${i + 1}: ${metadata.width}x${metadata.height}, ${Math.round(metadata.size / 1024)}KB`);

        // Delete original PNG to save space
        fs.unlinkSync(inputPath);

        slides.push({
          slideNumber: i + 1,
          localPath: outputPath,
          width: metadata.width,
          height: metadata.height
        });
      }

      console.timeEnd('Image optimization');

      // 9. Upload to GCS if requested
      if (uploadToGCS && bucket) {
        console.log(`☁️  [PPTX Slide Generator] Uploading to GCS...`);
        console.time('GCS upload');

        for (const slide of slides) {
          const gcsPath = `slides/${documentId}/slide-${slide.slideNumber}.webp`;

          try {
            // Read file and upload to GCS
            const fileBuffer = fs.readFileSync(slide.localPath);
            const file = bucket.file(gcsPath);

            await file.save(fileBuffer, {
              contentType: 'image/webp',
              metadata: {
                cacheControl: 'public, max-age=31536000',
              }
            });

            slide.gcsPath = gcsPath;
            // Note: Files are stored in GCS but need signed URLs for access
            // The frontend can request signed URLs via the API
            slide.publicUrl = `gcs://${bucket.name}/${gcsPath}`;

            console.log(`☁️  Uploaded slide ${slide.slideNumber}: ${slide.publicUrl}`);
          } catch (uploadError: any) {
            console.error(`❌ Failed to upload slide ${slide.slideNumber}:`, uploadError.message);
            // Continue with other slides even if one fails
          }
        }

        console.timeEnd('GCS upload');
      } else if (uploadToGCS && !bucket) {
        console.warn('⚠️  GCS not configured, skipping upload');
      }

      // 10. Cleanup temp directory
      console.log(`🗑️  [PPTX Slide Generator] Cleaning up temp files...`);
      try {
        // Delete local slide images
        for (const slide of slides) {
          if (fs.existsSync(slide.localPath)) {
            fs.unlinkSync(slide.localPath);
          }
        }

        // Delete PDF
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }

        // Delete temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.warn('⚠️  Cleanup error (non-critical):', cleanupError);
      }

      console.timeEnd('Total slide generation time');
      console.log(`✅ [PPTX Slide Generator] Successfully generated ${slides.length} slide images`);

      return {
        success: true,
        slides,
        totalSlides: slides.length
      };

    } catch (error: any) {
      console.error('❌ [PPTX Slide Generator] Error:', error.message);
      console.timeEnd('Total slide generation time');

      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const pptxSlideGeneratorService = new PPTXSlideGeneratorService();
