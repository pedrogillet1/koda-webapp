/**
 * Presentation Controller
 * 
 * API endpoints for Manus-style presentation generation
 */

import { Request, Response } from 'express';
import slideGenerationService from '../services/slideGeneration.service';
import presentationExportService from '../services/presentationExport.service';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';

const prisma = new PrismaClient();

/**
 * Initialize a new presentation
 * POST /api/presentations/initialize
 */
export const initializePresentation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, description, outline, styleInstruction } = req.body;

    if (!title || !outline || !Array.isArray(outline)) {
      res.status(400).json({ error: 'Missing required fields: title, outline' });
      return;
    }

    const result = await slideGenerationService.initializePresentation({
      userId: req.user.id,
      title,
      description,
      outline,
      styleInstruction
    });

    res.status(201).json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Initialize presentation error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate content for a specific slide
 * POST /api/presentations/:presentationId/slides/:slideId
 */
export const generateSlide = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { presentationId, slideId } = req.params;
    const { content, layout } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Missing required field: content' });
      return;
    }

    // Verify presentation ownership
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId }
    });

    if (!presentation) {
      res.status(404).json({ error: 'Presentation not found' });
      return;
    }

    if (presentation.userId !== req.user.id) {
      res.status(403).json({ error: 'Unauthorized access to presentation' });
      return;
    }

    const result = await slideGenerationService.generateSlide({
      presentationId,
      slideId,
      content,
      layout
    });

    res.status(200).json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Generate slide error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get presentation with all slides
 * GET /api/presentations/:presentationId
 */
export const getPresentation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { presentationId } = req.params;

    const presentation = await slideGenerationService.getPresentation(
      presentationId,
      req.user.id
    );

    res.status(200).json({
      success: true,
      presentation
    });

  } catch (error: any) {
    console.error('Get presentation error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get list of user's presentations
 * GET /api/presentations
 */
export const listPresentations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const presentations = await prisma.presentation.findMany({
      where: { userId: req.user.id },
      include: {
        _count: {
          select: { slides: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      presentations: presentations.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        totalSlides: p.totalSlides,
        slideCount: p._count.slides,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    });

  } catch (error: any) {
    console.error('List presentations error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * View presentation (HTML viewer)
 * GET /api/presentations/:presentationId/view
 */
export const viewPresentation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { presentationId } = req.params;

    const presentation = await slideGenerationService.getPresentation(
      presentationId,
      req.user.id
    );

    // Update view count
    await prisma.presentation.update({
      where: { id: presentationId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date()
      }
    });

    // Generate HTML viewer
    const viewerHTML = generatePresentationViewer(presentation);

    res.setHeader('Content-Type', 'text/html');
    res.send(viewerHTML);

  } catch (error: any) {
    console.error('View presentation error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete presentation
 * DELETE /api/presentations/:presentationId
 */
export const deletePresentation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { presentationId } = req.params;

    await slideGenerationService.deletePresentation(presentationId, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Presentation deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete presentation error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate HTML presentation viewer
 */
function generatePresentationViewer(presentation: any): string {
  const slides = presentation.slides || [];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${presentation.title} - Koda Presentation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #000;
      overflow: hidden;
    }
    
    .presentation-container {
      width: 100vw;
      height: 100vh;
      position: relative;
    }
    
    .slide {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      transition: opacity 0.3s ease;
      display: none;
    }
    
    .slide.active {
      opacity: 1;
      display: block;
    }
    
    .slide iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    
    .controls {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      padding: 12px 24px;
      border-radius: 30px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
    }
    
    .controls button {
      background: #6366F1;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }
    
    .controls button:hover {
      background: #5558E3;
    }
    
    .controls button:disabled {
      background: #D1D5DB;
      cursor: not-allowed;
    }
    
    .slide-counter {
      font-size: 14px;
      color: #374151;
      font-weight: 500;
    }
    
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: #E5E7EB;
      z-index: 1001;
    }
    
    .progress-fill {
      height: 100%;
      background: #6366F1;
      transition: width 0.3s ease;
    }
  </style>
</head>
<body>
  <div class="progress-bar">
    <div class="progress-fill" id="progress"></div>
  </div>
  
  <div class="presentation-container">
    ${slides.map((slide: any, index: number) => `
      <div class="slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
        <iframe srcdoc="${escapeHTML(slide.htmlContent)}"></iframe>
      </div>
    `).join('')}
  </div>
  
  <div class="controls">
    <button id="prevBtn" onclick="previousSlide()">← Previous</button>
    <span class="slide-counter">
      <span id="currentSlide">1</span> / <span id="totalSlides">${slides.length}</span>
    </span>
    <button id="nextBtn" onclick="nextSlide()">Next →</button>
  </div>
  
  <script>
    let currentSlide = 0;
    const totalSlides = ${slides.length};
    
    function showSlide(index) {
      // Hide all slides
      document.querySelectorAll('.slide').forEach(slide => {
        slide.classList.remove('active');
      });
      
      // Show current slide
      const slide = document.querySelector(\`[data-slide="\${index}"]\`);
      if (slide) {
        slide.classList.add('active');
      }
      
      // Update counter
      document.getElementById('currentSlide').textContent = index + 1;
      
      // Update progress bar
      const progress = ((index + 1) / totalSlides) * 100;
      document.getElementById('progress').style.width = progress + '%';
      
      // Update button states
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
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousSlide();
      }
    });
    
    // Initialize
    showSlide(0);
  </script>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML for use in srcdoc attribute
 */
function escapeHTML(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


/**
 * Export presentation to PDF/PPTX/HTML
 * GET /api/presentations/:presentationId/export/:format
 */
export const exportPresentation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { presentationId, format } = req.params;

    if (!['pdf', 'pptx', 'html'].includes(format)) {
      res.status(400).json({ error: 'Invalid format. Must be pdf, pptx, or html' });
      return;
    }

    console.log(`📦 [Export] Starting ${format.toUpperCase()} export for presentation: ${presentationId}`);

    // Export presentation
    const { filePath, filename } = await presentationExportService.exportPresentation({
      presentationId,
      format: format as 'pdf' | 'pptx' | 'html',
      userId: req.user.id
    });

    // Set appropriate content type
    const contentTypes = {
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      html: 'text/html'
    };

    // Send file
    res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);

    // Cleanup temp files after sending
    setTimeout(async () => {
      await presentationExportService.cleanupTempFiles(presentationId);
    }, 5000);

    console.log(`✅ [Export] Successfully sent ${format.toUpperCase()}: ${filename}`);

  } catch (error: any) {
    console.error('❌ [Export] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
