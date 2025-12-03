/**
 * PowerPoint Processor Service - Phase 4C
 * Processes PowerPoint files with slide-level chunking and metadata
 *
 * Features:
 * - One chunk per slide for precise retrieval
 * - Slide metadata (slideNumber, totalSlides, slideTitle)
 * - Preserves slide markers for context
 * - Enables queries like "What's on slide 3?" and "List all slide topics"
 */

import { pptxExtractorService } from './pptxExtractor.service';

export interface PPTXChunk {
  content: string;
  metadata: {
    slideNumber: number;
    totalSlides: number;
    slideTitle?: string;
    hasNotes: boolean;
    textBlockCount: number;
  };
}

export interface PPTXProcessingResult {
  success: boolean;
  chunks: PPTXChunk[];
  metadata: {
    title?: string;
    author?: string;
    totalSlides: number;
    slidesWithText: number;
  };
  error?: string;
}

class PPTXProcessorService {
  /**
   * Extract slide title from content (first line or first significant text)
   */
  private extractSlideTitle(content: string): string | undefined {
    if (!content) return undefined;

    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return undefined;

    // First non-empty line is usually the title
    const firstLine = lines[0].trim();

    // Limit title length to avoid capturing too much
    if (firstLine.length > 100) {
      return firstLine.substring(0, 100) + '...';
    }

    return firstLine;
  }

  /**
   * Check if slide content includes speaker notes
   */
  private hasNotes(content: string): boolean {
    return content.includes('Speaker Notes:');
  }

  /**
   * Process PowerPoint file into slide-level chunks
   */
  async processFile(filePath: string): Promise<PPTXProcessingResult> {
    try {
      console.log('📊 [PPTX Processor] Processing PowerPoint file...');

      // Extract text and slide data using existing service
      const extractionResult = await pptxExtractorService.extractText(filePath);

      if (!extractionResult.success) {
        return {
          success: false,
          chunks: [],
          metadata: {
            totalSlides: 0,
            slidesWithText: 0
          },
          error: extractionResult.error
        };
      }

      const { slides, metadata, totalSlides, slidesWithText } = extractionResult;

      if (!slides || slides.length === 0) {
        console.warn('⚠️ [PPTX Processor] No slides found in PowerPoint file');
        return {
          success: true,
          chunks: [],
          metadata: {
            title: metadata?.title,
            author: metadata?.author,
            totalSlides: 0,
            slidesWithText: 0
          }
        };
      }

      // Create one chunk per slide with metadata
      const chunks: PPTXChunk[] = slides
        .filter(slide => slide.content && slide.content.trim().length > 0) // Only slides with content
        .map(slide => {
          // Format content with slide marker for context
          const content = `=== Slide ${slide.slide_number} ===\n${slide.content}`;

          return {
            content,
            metadata: {
              slideNumber: slide.slide_number,
              totalSlides: totalSlides || slides.length,
              slideTitle: this.extractSlideTitle(slide.content),
              hasNotes: this.hasNotes(slide.content),
              textBlockCount: slide.text_count || 0
            }
          };
        });

      console.log(`✅ [PPTX Processor] Created ${chunks.length} slide chunks`);
      console.log(`   - Total slides: ${totalSlides}`);
      console.log(`   - Slides with text: ${slidesWithText}`);

      // Log sample of slide titles
      const sampleTitles = chunks.slice(0, 3).map(chunk =>
        `Slide ${chunk.document_metadata.slideNumber}: ${chunk.document_metadata.slideTitle || 'Untitled'}`
      );
      if (sampleTitles.length > 0) {
        console.log(`   - Sample titles:`, sampleTitles);
      }

      return {
        success: true,
        chunks,
        metadata: {
          title: metadata?.title,
          author: metadata?.author,
          totalSlides: totalSlides || slides.length,
          slidesWithText: slidesWithText || chunks.length
        }
      };

    } catch (error: any) {
      console.error('❌ [PPTX Processor] Error:', error.message);
      return {
        success: false,
        chunks: [],
        metadata: {
          totalSlides: 0,
          slidesWithText: 0
        },
        error: error.message
      };
    }
  }

  /**
   * Format chunks for embedding with additional context
   */
  formatChunksForEmbedding(chunks: PPTXChunk[], filename: string): Array<{
    text: string;
    metadata: any;
  }> {
    return chunks.map(chunk => ({
      text: chunk.content,
      metadata: {
        filename,
        slideNumber: chunk.document_metadata.slideNumber,
        totalSlides: chunk.document_metadata.totalSlides,
        slideTitle: chunk.document_metadata.slideTitle,
        hasNotes: chunk.document_metadata.hasNotes,
        sourceType: 'powerpoint',
        chunkType: 'slide'
      }
    }));
  }
}

export default new PPTXProcessorService();
