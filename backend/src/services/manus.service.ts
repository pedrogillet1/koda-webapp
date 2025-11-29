import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Manus Slide System
 * Creates professional presentations with HTML-based slides
 */

interface SlideProject {
  id: string;
  title: string;
  styleInstructions: string;
  slides: Slide[];
  outputDir: string;
}

interface Slide {
  id: number;
  html: string;
}

class ManusService {
  private projects: Map<string, SlideProject> = new Map();
  private baseOutputDir = path.join(process.cwd(), 'uploads', 'presentations');

  constructor() {
    this.ensureOutputDirExists();
  }

  private async ensureOutputDirExists() {
    try {
      await fs.mkdir(this.baseOutputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating presentations directory:', error);
    }
  }

  /**
   * STEP 1: Initialize a new slide project
   */
  async slide_initialize(title: string, styleInstructions: string): Promise<string> {
    const projectId = `slide_${Date.now()}`;
    const outputDir = path.join(this.baseOutputDir, projectId);

    await fs.mkdir(outputDir, { recursive: true });

    const project: SlideProject = {
      id: projectId,
      title,
      styleInstructions,
      slides: [],
      outputDir,
    };

    this.projects.set(projectId, project);

    console.log(`✅ [MANUS] Initialized project: ${projectId}`);
    console.log(`📋 Style: ${styleInstructions}`);

    return projectId;
  }

  /**
   * STEP 2: Create/edit individual slides
   */
  async slide_edit(projectId: string, slideNumber: number, html: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Add or update slide
    const existingIndex = project.slides.findIndex((s) => s.id === slideNumber);
    if (existingIndex !== -1) {
      project.slides[existingIndex].html = html;
    } else {
      project.slides.push({ id: slideNumber, html });
    }

    // Save slide HTML to disk
    const slideFile = path.join(project.outputDir, `slide_${slideNumber}.html`);
    await fs.writeFile(slideFile, html);

    console.log(`✅ [MANUS] Slide ${slideNumber} created/updated`);
  }

  /**
   * STEP 3: Generate the final presentation
   */
  async slide_present(projectId: string): Promise<string> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (project.slides.length === 0) {
      throw new Error('No slides to present');
    }

    // Sort slides by ID
    project.slides.sort((a, b) => a.id - b.id);

    // Generate combined HTML presentation
    const presentationHTML = this.generatePresentationHTML(project);
    const htmlFile = path.join(project.outputDir, 'presentation.html');
    await fs.writeFile(htmlFile, presentationHTML);

    console.log(`✅ [MANUS] Presentation HTML generated: ${htmlFile}`);

    // Convert HTML to PPTX (using external tools if available)
    // For now, we'll return the HTML path and handle conversion separately
    return htmlFile;
  }

  /**
   * Generate complete presentation HTML
   */
  private generatePresentationHTML(project: SlideProject): string {
    const slidesHTML = project.slides.map((slide) => slide.html).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: #1a1a1a;
      overflow-x: hidden;
    }

    .slide {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      scroll-snap-align: start;
    }

    .slides-container {
      scroll-snap-type: y mandatory;
      overflow-y: scroll;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div class="slides-container">
    ${slidesHTML}
  </div>

  <script>
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const slides = document.querySelectorAll('.slide');
      const currentSlide = Array.from(slides).findIndex(slide => {
        const rect = slide.getBoundingClientRect();
        return rect.top >= 0 && rect.top < window.innerHeight / 2;
      });

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        if (currentSlide < slides.length - 1) {
          slides[currentSlide + 1].scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        if (currentSlide > 0) {
          slides[currentSlide - 1].scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Convert HTML presentation to PPTX buffer
   * This is a placeholder - actual conversion would use external tools or libraries
   */
  async convertHTMLToPPTX(htmlPath: string, outputPath: string): Promise<Buffer> {
    // For now, we'll use a workaround:
    // 1. Read the HTML
    // 2. Use PptxGenJS to create slides from the HTML structure
    // This maintains compatibility while using the Manus slide system

    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();

    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const slides = htmlContent.match(/<div class="slide"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="slide"|<\/div>\s*<script>)/g) || [];

    for (const slideHTML of slides) {
      const slide = pptx.addSlide();

      // Extract text content (simplified)
      const textContent = slideHTML
        .replace(/<[^>]+>/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();

      // Check if it's a title slide
      if (slideHTML.includes('text-6xl') || slideHTML.includes('text-7xl')) {
        // Title slide
        const lines = textContent.split('\n').filter(l => l.trim());
        slide.background = { color: '6366F1' };

        slide.addText(lines[0] || '', {
          x: 0.5,
          y: 2.5,
          w: 9,
          h: 1.5,
          fontSize: 44,
          bold: true,
          align: 'center',
          color: 'FFFFFF',
        });

        if (lines[1]) {
          slide.addText(lines[1], {
            x: 0.5,
            y: 4,
            w: 9,
            h: 0.75,
            fontSize: 24,
            align: 'center',
            color: 'FFFFFF',
          });
        }
      } else {
        // Content slide
        slide.background = { color: 'FFFFFF' };
        const lines = textContent.split('\n').filter(l => l.trim());

        if (lines[0]) {
          slide.addText(lines[0], {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 0.75,
            fontSize: 32,
            bold: true,
            color: '363636',
          });
        }

        const bullets = lines.slice(1).filter(l => l.length > 2);
        if (bullets.length > 0) {
          slide.addText(bullets.map(b => ({ text: b, options: { bullet: true } })), {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 4,
            fontSize: 18,
            color: '363636',
          });
        }
      }
    }

    // Write to file first
    await pptx.writeFile({ fileName: outputPath });

    // Read back as buffer
    const buffer = await fs.readFile(outputPath);
    return buffer;
  }

  /**
   * Cleanup project files
   */
  async cleanup(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      try {
        await fs.rm(project.outputDir, { recursive: true, force: true });
        this.projects.delete(projectId);
        console.log(`🧹 [MANUS] Cleaned up project: ${projectId}`);
      } catch (error) {
        console.error('Error cleaning up project:', error);
      }
    }
  }
}

const manusService = new ManusService();
export default manusService;
