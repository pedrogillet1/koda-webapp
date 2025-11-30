/**
 * Slide Generation Service
 * 
 * Implements Manus-style professional slide generation with Koda branding.
 * Creates HTML-based presentations with rich layouts, charts, and design.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ════════════════════════════════════════════════════════════════════════════════
// KODA DESIGN SYSTEM
// ════════════════════════════════════════════════════════════════════════════════

export const KODA_COLORS = {
  primary: '#6366F1',      // Indigo (Koda brand color)
  secondary: '#8B5CF6',    // Purple
  accent: '#EC4899',       // Pink
  background: '#FFFFFF',   // White
  text: {
    primary: '#1F2937',    // Dark gray
    secondary: '#6B7280',  // Medium gray
    light: '#9CA3AF'       // Light gray
  },
  success: '#10B981',      // Green
  warning: '#F59E0B',      // Amber
  error: '#EF4444'         // Red
};

export const KODA_TYPOGRAPHY = {
  fontFamily: {
    heading: '"Inter", "SF Pro Display", -apple-system, sans-serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace'
  },
  fontSize: {
    title: '64px',         // Front page title
    subtitle: '32px',      // Front page subtitle
    h1: '48px',            // Slide title
    h2: '32px',            // Section heading
    body: '20px',          // Body text
    caption: '16px'        // Captions, footnotes
  },
  fontWeight: {
    bold: 700,
    semibold: 600,
    medium: 500,
    regular: 400
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface PresentationOutline {
  id: string;
  title: string;
  summary: string;
  layout?: 'title' | 'content' | 'two-column' | 'chart' | 'image' | 'custom';
}

export interface StyleInstruction {
  colorPalette?: string;
  typography?: string;
  aestheticDirection?: string;
}

export interface InitializePresentationParams {
  userId: string;
  title: string;
  description?: string;
  outline: PresentationOutline[];
  styleInstruction?: StyleInstruction;
}

export interface GenerateSlideParams {
  presentationId: string;
  slideId: string;
  content: string;
  layout?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ════════════════════════════════════════════════════════════════════════════════

class SlideGenerationService {
  
  /**
   * Initialize a new presentation project
   */
  async initializePresentation(params: InitializePresentationParams) {
    const {
      userId,
      title,
      description,
      outline,
      styleInstruction
    } = params;

    console.log(`🎨 [Slide Gen] Initializing presentation: ${title}`);
    console.log(`📊 [Slide Gen] Slides to create: ${outline.length}`);

    // Create presentation record
    const presentation = await prisma.presentation.create({
      data: {
        userId,
        title,
        description,
        status: 'draft',
        totalSlides: outline.length,
        colorPalette: styleInstruction?.colorPalette || JSON.stringify(KODA_COLORS),
        typography: styleInstruction?.typography || JSON.stringify(KODA_TYPOGRAPHY),
        aestheticDirection: styleInstruction?.aestheticDirection || 
          'Modern, clean, tech-forward design with emphasis on clarity and data visualization'
      }
    });

    // Create slide records
    const slides = await Promise.all(
      outline.map((slide, index) =>
        prisma.slide.create({
          data: {
            presentationId: presentation.id,
            slideNumber: index + 1,
            title: slide.title,
            summary: slide.summary,
            layout: slide.layout || (index === 0 ? 'title' : 'content'),
            htmlContent: '', // Will be generated later
            status: 'pending'
          }
        })
      )
    );

    console.log(`✅ [Slide Gen] Created presentation ${presentation.id} with ${slides.length} slides`);

    return {
      presentationId: presentation.id,
      slides: slides.map(s => ({
        slideId: s.id,
        slideNumber: s.slideNumber,
        title: s.title,
        status: s.status
      }))
    };
  }

  /**
   * Generate HTML content for a slide
   */
  async generateSlide(params: GenerateSlideParams) {
    const { presentationId, slideId, content, layout } = params;

    console.log(`🎨 [Slide Gen] Generating slide ${slideId}`);

    // Get slide and presentation
    const slide = await prisma.slide.findUnique({
      where: { id: slideId },
      include: { presentation: true }
    });

    if (!slide) {
      throw new Error('Slide not found');
    }

    if (slide.presentationId !== presentationId) {
      throw new Error('Slide does not belong to this presentation');
    }

    // Update slide status
    await prisma.slide.update({
      where: { id: slideId },
      data: { status: 'generating' }
    });

    const startTime = Date.now();

    try {
      // Generate HTML based on layout
      const htmlContent = await this.generateSlideHTML({
        slideNumber: slide.slideNumber,
        title: slide.title,
        content,
        layout: layout || slide.layout,
        presentation: slide.presentation
      });

      const renderTime = Date.now() - startTime;

      // Update slide with generated content
      const updatedSlide = await prisma.slide.update({
        where: { id: slideId },
        data: {
          htmlContent,
          status: 'completed',
          generatedAt: new Date(),
          renderTime
        }
      });

      console.log(`✅ [Slide Gen] Slide ${slideId} generated in ${renderTime}ms`);

      return {
        slideId: updatedSlide.id,
        slideNumber: updatedSlide.slideNumber,
        htmlContent: updatedSlide.htmlContent,
        status: updatedSlide.status
      };

    } catch (error: any) {
      console.error(`❌ [Slide Gen] Failed to generate slide ${slideId}:`, error);

      // Update slide with error
      await prisma.slide.update({
        where: { id: slideId },
        data: {
          status: 'failed',
          errorMessage: error.message
        }
      });

      throw error;
    }
  }

  /**
   * Generate HTML content based on layout type
   */
  private async generateSlideHTML(params: {
    slideNumber: number;
    title: string;
    content: string;
    layout: string;
    presentation: any;
  }) {
    const { slideNumber, title, content, layout, presentation } = params;

    // Parse style configuration
    const colors = JSON.parse(presentation.colorPalette || JSON.stringify(KODA_COLORS));
    const typography = JSON.parse(presentation.typography || JSON.stringify(KODA_TYPOGRAPHY));

    switch (layout) {
      case 'title':
        return this.generateTitleSlide(title, content, colors, typography);
      
      case 'content':
        return this.generateContentSlide(title, content, colors, typography);
      
      case 'two-column':
        return this.generateTwoColumnSlide(title, content, colors, typography);
      
      case 'chart':
        return this.generateChartSlide(title, content, colors, typography);
      
      case 'image':
        return this.generateImageSlide(title, content, colors, typography);
      
      default:
        return this.generateContentSlide(title, content, colors, typography);
    }
  }

  /**
   * Generate title slide HTML
   */
  private generateTitleSlide(title: string, subtitle: string, colors: any, typography: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: ${typography.fontFamily.body}; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div class="slide-container" style="min-height: 720px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%); display: flex; align-items: center; justify-content: center; padding: 60px 80px;">
    <div class="flex flex-col items-center justify-center text-white text-center">
      <h1 style="font-size: ${typography.fontSize.title}; font-weight: ${typography.fontWeight.bold}; margin-bottom: 24px; line-height: 1.1;">
        ${title}
      </h1>
      <p style="font-size: ${typography.fontSize.subtitle}; font-weight: ${typography.fontWeight.regular}; opacity: 0.9; max-width: 800px;">
        ${subtitle}
      </p>
      <div style="margin-top: 48px; font-size: ${typography.fontSize.body}; opacity: 0.75;">
        <span>Powered by Koda AI</span>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate content slide HTML
   */
  private generateContentSlide(title: string, content: string, colors: any, typography: any): string {
    // Parse content into bullet points
    const points = content.split('\n').filter(p => p.trim().length > 0);

    const bulletPoints = points.map(point => `
      <div class="flex items-start mb-6">
        <div style="width: 12px; height: 12px; background: ${colors.primary}; border-radius: 50%; margin-top: 8px; margin-right: 16px; flex-shrink: 0;"></div>
        <p style="font-size: ${typography.fontSize.body}; color: ${colors.text.primary}; line-height: 1.6; margin: 0;">
          ${point.replace(/^[-•*]\s*/, '')}
        </p>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: ${typography.fontFamily.body}; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div class="slide-container" style="min-height: 720px; background: ${colors.background}; padding: 60px 80px;">
    <h2 style="font-size: ${typography.fontSize.h1}; font-weight: ${typography.fontWeight.bold}; color: ${colors.text.primary}; margin-bottom: 48px;">
      ${title}
    </h2>
    
    <div class="space-y-6">
      ${bulletPoints}
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate two-column slide HTML
   */
  private generateTwoColumnSlide(title: string, content: string, colors: any, typography: any): string {
    // Split content into left and right columns
    const parts = content.split('---').map(p => p.trim());
    const leftContent = parts[0] || '';
    const rightContent = parts[1] || '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: ${typography.fontFamily.body}; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div class="slide-container" style="min-height: 720px; background: ${colors.background}; padding: 60px 80px;">
    <h2 style="font-size: ${typography.fontSize.h1}; font-weight: ${typography.fontWeight.bold}; color: ${colors.text.primary}; margin-bottom: 48px;">
      ${title}
    </h2>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; height: calc(100% - 120px);">
      <!-- Left Column -->
      <div style="font-size: ${typography.fontSize.body}; color: ${colors.text.primary}; line-height: 1.6;">
        ${leftContent.split('\n').map(p => `<p style="margin-bottom: 16px;">${p}</p>`).join('')}
      </div>
      
      <!-- Right Column -->
      <div style="display: flex; align-items: center; justify-center; font-size: ${typography.fontSize.body}; color: ${colors.text.secondary};">
        ${rightContent.split('\n').map(p => `<p style="margin-bottom: 16px;">${p}</p>`).join('')}
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate chart slide HTML
   */
  private generateChartSlide(title: string, content: string, colors: any, typography: any): string {
    // TODO: Parse chart data from content and generate Chart.js configuration
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: ${typography.fontFamily.body}; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div class="slide-container" style="min-height: 720px; background: ${colors.background}; padding: 60px 80px;">
    <h2 style="font-size: ${typography.fontSize.h1}; font-weight: ${typography.fontWeight.bold}; color: ${colors.text.primary}; margin-bottom: 48px;">
      ${title}
    </h2>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
      <!-- Chart -->
      <div style="height: 500px;">
        <canvas id="chart"></canvas>
      </div>
      
      <!-- Insights -->
      <div>
        <div style="background: ${colors.primary}15; padding: 24px; border-radius: 8px;">
          <h3 style="font-size: ${typography.fontSize.h2}; font-weight: ${typography.fontWeight.semibold}; color: ${colors.primary}; margin-bottom: 12px;">
            Key Insight
          </h3>
          <p style="font-size: ${typography.fontSize.body}; color: ${colors.text.primary}; line-height: 1.6;">
            ${content}
          </p>
        </div>
      </div>
    </div>
    
    <script>
      // Sample chart - will be replaced with actual data
      const ctx = document.getElementById('chart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
          datasets: [{
            label: 'Revenue',
            data: [12, 19, 15, 25],
            backgroundColor: '${colors.primary}',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    </script>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate image slide HTML
   */
  private generateImageSlide(title: string, content: string, colors: any, typography: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: ${typography.fontFamily.body}; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div class="slide-container" style="min-height: 720px; background: ${colors.background}; padding: 60px 80px;">
    <h2 style="font-size: ${typography.fontSize.h1}; font-weight: ${typography.fontWeight.bold}; color: ${colors.text.primary}; margin-bottom: 48px;">
      ${title}
    </h2>
    
    <div style="display: flex; align-items: center; justify-center; height: calc(100% - 120px);">
      <div style="text-align: center; font-size: ${typography.fontSize.body}; color: ${colors.text.secondary};">
        ${content}
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get presentation with all slides
   */
  async getPresentation(presentationId: string, userId: string) {
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        slides: {
          orderBy: { slideNumber: 'asc' }
        }
      }
    });

    if (!presentation) {
      throw new Error('Presentation not found');
    }

    if (presentation.userId !== userId) {
      throw new Error('Unauthorized access to presentation');
    }

    return presentation;
  }

  /**
   * Delete presentation
   */
  async deletePresentation(presentationId: string, userId: string) {
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId }
    });

    if (!presentation) {
      throw new Error('Presentation not found');
    }

    if (presentation.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await prisma.presentation.delete({
      where: { id: presentationId }
    });

    console.log(`🗑️ [Slide Gen] Deleted presentation ${presentationId}`);
  }
}

export default new SlideGenerationService();
