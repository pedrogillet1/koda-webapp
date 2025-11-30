/**
 * Presentation Export Service
 * 
 * Compiles individual HTML slides into downloadable presentations (PDF/PPTX)
 */

import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

interface ExportOptions {
  presentationId: string;
  format: 'pdf' | 'pptx' | 'html';
  userId: string;
}

class PresentationExportService {
  
  /**
   * Export presentation to specified format
   */
  async exportPresentation(options: ExportOptions): Promise<{ filePath: string; filename: string }> {
    const { presentationId, format, userId } = options;

    // Verify presentation ownership
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        slides: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!presentation) {
      throw new Error('Presentation not found');
    }

    if (presentation.userId !== userId) {
      throw new Error('Unauthorized access to presentation');
    }

    if (presentation.slides.length === 0) {
      throw new Error('Presentation has no slides');
    }

    // Generate export based on format
    switch (format) {
      case 'pdf':
        return await this.exportToPDF(presentation);
      case 'pptx':
        return await this.exportToPPTX(presentation);
      case 'html':
        return await this.exportToHTML(presentation);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export to PDF using Puppeteer
   */
  private async exportToPDF(presentation: any): Promise<{ filePath: string; filename: string }> {
    console.log(`📄 [PDF Export] Starting export for: ${presentation.title}`);

    // Create combined HTML file
    const htmlContent = this.generateCombinedHTML(presentation);
    
    // Create temp directory
    const tempDir = path.join('/tmp', `presentation-${presentation.id}`);
    await fs.mkdir(tempDir, { recursive: true });

    const htmlPath = path.join(tempDir, 'presentation.html');
    const pdfPath = path.join(tempDir, `${this.sanitizeFilename(presentation.title)}.pdf`);

    // Write HTML to file
    await fs.writeFile(htmlPath, htmlContent, 'utf-8');

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Set viewport to slide dimensions (16:9 aspect ratio)
      await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 2
      });

      // Load HTML
      await page.goto(`file://${htmlPath}`, {
        waitUntil: 'networkidle0'
      });

      // Generate PDF with one slide per page
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      });

      console.log(`✅ [PDF Export] Generated: ${pdfPath}`);

      return {
        filePath: pdfPath,
        filename: path.basename(pdfPath)
      };

    } finally {
      await browser.close();
    }
  }

  /**
   * Export to PPTX using LibreOffice
   */
  private async exportToPPTX(presentation: any): Promise<{ filePath: string; filename: string }> {
    console.log(`📊 [PPTX Export] Starting export for: ${presentation.title}`);

    // First generate PDF
    const { filePath: pdfPath } = await this.exportToPDF(presentation);

    // Convert PDF to PPTX using LibreOffice
    const tempDir = path.dirname(pdfPath);
    const pptxFilename = `${this.sanitizeFilename(presentation.title)}.pptx`;
    const pptxPath = path.join(tempDir, pptxFilename);

    try {
      // Use LibreOffice to convert PDF to PPTX
      await execAsync(
        `libreoffice --headless --convert-to pptx --outdir "${tempDir}" "${pdfPath}"`
      );

      console.log(`✅ [PPTX Export] Generated: ${pptxPath}`);

      return {
        filePath: pptxPath,
        filename: pptxFilename
      };

    } catch (error) {
      console.error('❌ [PPTX Export] LibreOffice conversion failed:', error);
      
      // Fallback: Return PDF if PPTX conversion fails
      console.log('⚠️  [PPTX Export] Falling back to PDF');
      return {
        filePath: pdfPath,
        filename: path.basename(pdfPath)
      };
    }
  }

  /**
   * Export to standalone HTML file
   */
  private async exportToHTML(presentation: any): Promise<{ filePath: string; filename: string }> {
    console.log(`🌐 [HTML Export] Starting export for: ${presentation.title}`);

    const htmlContent = this.generateCombinedHTML(presentation);
    
    const tempDir = path.join('/tmp', `presentation-${presentation.id}`);
    await fs.mkdir(tempDir, { recursive: true });

    const htmlFilename = `${this.sanitizeFilename(presentation.title)}.html`;
    const htmlPath = path.join(tempDir, htmlFilename);

    await fs.writeFile(htmlPath, htmlContent, 'utf-8');

    console.log(`✅ [HTML Export] Generated: ${htmlPath}`);

    return {
      filePath: htmlPath,
      filename: htmlFilename
    };
  }

  /**
   * Generate combined HTML with all slides
   */
  private generateCombinedHTML(presentation: any): string {
    const slides = presentation.slides.map((slide: any) => slide.htmlContent).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${presentation.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: #000;
      overflow: hidden;
    }

    .slide-container {
      width: 100vw;
      height: 100vh;
      display: none;
      page-break-after: always;
    }

    .slide-container.active {
      display: block;
    }

    /* Print styles for PDF */
    @media print {
      .slide-container {
        display: block !important;
        width: 100%;
        height: 100vh;
        page-break-after: always;
      }

      .slide-controls {
        display: none !important;
      }
    }

    /* Slide navigation controls */
    .slide-controls {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      padding: 12px 24px;
      border-radius: 30px;
      display: flex;
      gap: 16px;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
    }

    .slide-controls button {
      background: #6366F1;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .slide-controls button:hover {
      background: #4F46E5;
      transform: translateY(-1px);
    }

    .slide-controls button:disabled {
      background: #D1D5DB;
      cursor: not-allowed;
      transform: none;
    }

    .slide-counter {
      font-weight: 600;
      color: #1F2937;
      font-size: 14px;
    }
  </style>
</head>
<body>
  ${slides}

  <!-- Slide Navigation Controls -->
  <div class="slide-controls">
    <button id="prevBtn" onclick="previousSlide()">← Previous</button>
    <span class="slide-counter">
      <span id="currentSlide">1</span> / <span id="totalSlides">${presentation.slides.length}</span>
    </span>
    <button id="nextBtn" onclick="nextSlide()">Next →</button>
  </div>

  <script>
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide-container');
    const totalSlides = slides.length;

    function showSlide(index) {
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
      });

      document.getElementById('currentSlide').textContent = index + 1;
      document.getElementById('prevBtn').disabled = index === 0;
      document.getElementById('nextBtn').disabled = index === totalSlides - 1;
    }

    function nextSlide() {
      if (currentSlide < totalSlides - 1) {
        currentSlide++;
        showSlide(currentSlide);
      }
    }

    function previousSlide() {
      if (currentSlide > 0) {
        currentSlide--;
        showSlide(currentSlide);
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        previousSlide();
      }
    });

    // Initialize
    showSlide(0);
  </script>
</body>
</html>`;
  }

  /**
   * Sanitize filename for file system
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  /**
   * Clean up temp files
   */
  async cleanupTempFiles(presentationId: string): Promise<void> {
    const tempDir = path.join('/tmp', `presentation-${presentationId}`);
    
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`🗑️  [Cleanup] Removed temp directory: ${tempDir}`);
    } catch (error) {
      console.error('❌ [Cleanup] Failed to remove temp directory:', error);
    }
  }
}

export default new PresentationExportService();
