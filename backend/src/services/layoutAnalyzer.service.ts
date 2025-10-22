/**
 * Layout Analyzer Service
 * Analyzes and preserves document layout for multi-column documents
 * - Detects single vs multi-column layouts
 * - Determines correct reading order (left-to-right, top-to-bottom)
 * - Preserves column structure in extracted text
 * - Handles complex layouts (newspapers, academic papers, magazines)
 */

import vision from '@google-cloud/vision';
import { config } from '../config/env';

const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: config.GCS_KEY_FILE,
  projectId: config.GCS_PROJECT_ID,
});

interface TextBlock {
  text: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

interface Column {
  columnNumber: number;
  xStart: number;
  xEnd: number;
  blocks: TextBlock[];
}

interface PageLayout {
  pageNumber: number;
  layoutType: 'single-column' | 'two-column' | 'three-column' | 'complex';
  columnCount: number;
  columns: Column[];
  columnBreaks: number[]; // X-coordinates of column separators
  text: string; // Text in correct reading order
}

interface LayoutAnalysisResult {
  pages: PageLayout[];
  hasMultiColumn: boolean;
  averageColumns: number;
  combinedText: string;
}

class LayoutAnalyzerService {
  private readonly COLUMN_GAP_THRESHOLD = 50; // Minimum gap between columns (pixels)
  private readonly MIN_COLUMN_WIDTH = 100; // Minimum width for a valid column

  /**
   * Analyze layout of PDF document
   */
  async analyzePDFLayout(pdfBuffer: Buffer): Promise<LayoutAnalysisResult> {
    try {
      console.log('📐 [Layout Analyzer] Analyzing PDF layout...');

      const [result] = await visionClient.documentTextDetection(pdfBuffer);

      if (!result.fullTextAnnotation) {
        console.log('   No text detected');
        return {
          pages: [],
          hasMultiColumn: false,
          averageColumns: 1,
          combinedText: '',
        };
      }

      const pages = result.fullTextAnnotation.pages || [];
      const pageLayouts: PageLayout[] = [];

      for (let i = 0; i < pages.length; i++) {
        const pageLayout = this.analyzePageLayout(pages[i], i + 1);
        pageLayouts.push(pageLayout);
      }

      const hasMultiColumn = pageLayouts.some(p => p.columnCount > 1);
      const averageColumns = pageLayouts.length > 0
        ? pageLayouts.reduce((sum, p) => sum + p.columnCount, 0) / pageLayouts.length
        : 1;

      const combinedText = pageLayouts.map(p => p.text).join('\n\n');

      console.log(`✅ [Layout Analyzer] Analyzed ${pageLayouts.length} pages`);
      console.log(`   Multi-column: ${hasMultiColumn ? 'Yes' : 'No'}`);
      console.log(`   Average columns: ${averageColumns.toFixed(1)}`);

      return {
        pages: pageLayouts,
        hasMultiColumn,
        averageColumns,
        combinedText,
      };
    } catch (error: any) {
      console.error('❌ [Layout Analyzer] Error:', error);
      throw new Error(`Failed to analyze layout: ${error.message}`);
    }
  }

  /**
   * Analyze layout of image document
   */
  async analyzeImageLayout(imageBuffer: Buffer): Promise<LayoutAnalysisResult> {
    try {
      console.log('📐 [Layout Analyzer] Analyzing image layout...');

      const [result] = await visionClient.documentTextDetection(imageBuffer);

      if (!result.fullTextAnnotation || !result.fullTextAnnotation.pages) {
        return {
          pages: [],
          hasMultiColumn: false,
          averageColumns: 1,
          combinedText: '',
        };
      }

      const pages = result.fullTextAnnotation.pages;
      const pageLayouts: PageLayout[] = [];

      for (let i = 0; i < pages.length; i++) {
        const pageLayout = this.analyzePageLayout(pages[i], i + 1);
        pageLayouts.push(pageLayout);
      }

      const hasMultiColumn = pageLayouts.some(p => p.columnCount > 1);
      const averageColumns = pageLayouts.length > 0
        ? pageLayouts.reduce((sum, p) => sum + p.columnCount, 0) / pageLayouts.length
        : 1;

      const combinedText = pageLayouts.map(p => p.text).join('\n\n');

      console.log(`✅ [Layout Analyzer] Analyzed ${pageLayouts.length} pages`);

      return {
        pages: pageLayouts,
        hasMultiColumn,
        averageColumns,
        combinedText,
      };
    } catch (error: any) {
      console.error('❌ [Layout Analyzer] Error:', error);
      throw new Error(`Failed to analyze image layout: ${error.message}`);
    }
  }

  /**
   * Analyze layout of a single page
   */
  private analyzePageLayout(page: any, pageNumber: number): PageLayout {
    // Extract text blocks with bounding boxes
    const textBlocks: TextBlock[] = [];

    if (page.blocks) {
      for (const block of page.blocks) {
        if (!block.boundingBox || !block.boundingBox.vertices) continue;

        const text = this.extractBlockText(block);
        if (!text.trim()) continue;

        const vertices = block.boundingBox.vertices;
        const boundingBox = {
          x: Math.min(...vertices.map((v: any) => v.x || 0)),
          y: Math.min(...vertices.map((v: any) => v.y || 0)),
          width: Math.max(...vertices.map((v: any) => v.x || 0)) - Math.min(...vertices.map((v: any) => v.x || 0)),
          height: Math.max(...vertices.map((v: any) => v.y || 0)) - Math.min(...vertices.map((v: any) => v.y || 0)),
        };

        textBlocks.push({
          text,
          boundingBox,
          confidence: block.confidence || 0.8,
        });
      }
    }

    if (textBlocks.length === 0) {
      return {
        pageNumber,
        layoutType: 'single-column',
        columnCount: 1,
        columns: [],
        columnBreaks: [],
        text: '',
      };
    }

    // Detect column structure
    const columnBreaks = this.detectColumnBreaks(textBlocks);
    const columnCount = columnBreaks.length + 1;

    // Classify layout type
    let layoutType: PageLayout['layoutType'];
    if (columnCount === 1) {
      layoutType = 'single-column';
    } else if (columnCount === 2) {
      layoutType = 'two-column';
    } else if (columnCount === 3) {
      layoutType = 'three-column';
    } else {
      layoutType = 'complex';
    }

    // Group blocks into columns
    const columns = this.groupBlocksIntoColumns(textBlocks, columnBreaks);

    // Extract text in correct reading order
    const text = this.extractTextInReadingOrder(columns);

    console.log(`   Page ${pageNumber}: ${layoutType} (${columnCount} columns)`);

    return {
      pageNumber,
      layoutType,
      columnCount,
      columns,
      columnBreaks,
      text,
    };
  }

  /**
   * Detect column breaks by analyzing X-coordinate gaps
   */
  private detectColumnBreaks(textBlocks: TextBlock[]): number[] {
    if (textBlocks.length === 0) return [];

    // Get all X positions (left edges of blocks)
    const xPositions = textBlocks.map(b => b.boundingBox.x).sort((a, b) => a - b);

    // Find gaps in X positions that indicate column breaks
    const gaps: Array<{ position: number; size: number }> = [];

    for (let i = 1; i < xPositions.length; i++) {
      const gap = xPositions[i] - xPositions[i - 1];
      if (gap > this.COLUMN_GAP_THRESHOLD) {
        gaps.push({
          position: (xPositions[i - 1] + xPositions[i]) / 2,
          size: gap,
        });
      }
    }

    // Sort gaps by size (largest first) and take the most significant ones
    gaps.sort((a, b) => b.size - a.size);

    // Typically documents have at most 3 columns
    const columnBreaks = gaps.slice(0, 2).map(g => g.position).sort((a, b) => a - b);

    return columnBreaks;
  }

  /**
   * Group blocks into columns based on column breaks
   */
  private groupBlocksIntoColumns(textBlocks: TextBlock[], columnBreaks: number[]): Column[] {
    const columns: Column[] = [];

    // Define column boundaries
    const boundaries: Array<{ xStart: number; xEnd: number }> = [];

    if (columnBreaks.length === 0) {
      // Single column
      boundaries.push({
        xStart: 0,
        xEnd: Infinity,
      });
    } else {
      // Multiple columns
      boundaries.push({
        xStart: 0,
        xEnd: columnBreaks[0],
      });

      for (let i = 1; i < columnBreaks.length; i++) {
        boundaries.push({
          xStart: columnBreaks[i - 1],
          xEnd: columnBreaks[i],
        });
      }

      boundaries.push({
        xStart: columnBreaks[columnBreaks.length - 1],
        xEnd: Infinity,
      });
    }

    // Assign blocks to columns
    boundaries.forEach((boundary, index) => {
      const columnBlocks = textBlocks.filter(block => {
        const blockCenter = block.boundingBox.x + block.boundingBox.width / 2;
        return blockCenter >= boundary.xStart && blockCenter < boundary.xEnd;
      });

      // Sort blocks by Y position (top to bottom)
      columnBlocks.sort((a, b) => a.boundingBox.y - b.boundingBox.y);

      columns.push({
        columnNumber: index + 1,
        xStart: boundary.xStart,
        xEnd: boundary.xEnd,
        blocks: columnBlocks,
      });
    });

    return columns;
  }

  /**
   * Extract text in correct reading order (left-to-right, top-to-bottom)
   */
  private extractTextInReadingOrder(columns: Column[]): string {
    const textParts: string[] = [];

    // Read columns left-to-right
    for (const column of columns) {
      // Within each column, read top-to-bottom
      const columnText = column.blocks.map(block => block.text).join('\n');
      if (columnText.trim()) {
        textParts.push(columnText);
      }
    }

    return textParts.join('\n\n');
  }

  /**
   * Extract text from a block
   */
  private extractBlockText(block: any): string {
    let text = '';

    if (block.paragraphs) {
      for (const paragraph of block.paragraphs) {
        if (paragraph.words) {
          for (const word of paragraph.words) {
            if (word.symbols) {
              for (const symbol of word.symbols) {
                text += symbol.text || '';
              }
              text += ' ';
            }
          }
        }
        text += '\n';
      }
    }

    return text.trim();
  }

  /**
   * Simple heuristic-based column detection (fallback)
   * Used when Vision API is not available
   */
  detectColumnsFromText(text: string, pageWidth: number = 800): { columnCount: number; text: string } {
    const lines = text.split('\n');

    // Analyze line lengths to detect if text flows in columns
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;

    // If lines are consistently short relative to page width, might be multi-column
    const expectedSingleColumnLength = pageWidth / 10; // Rough estimate: ~80 chars

    if (avgLineLength < expectedSingleColumnLength * 0.6) {
      // Likely multi-column
      return {
        columnCount: 2,
        text, // Return as-is since we can't reorder without position data
      };
    }

    return {
      columnCount: 1,
      text,
    };
  }
}

export default new LayoutAnalyzerService();
