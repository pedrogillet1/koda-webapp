/**
 * ============================================================================
 * KODA CITATION FORMAT SERVICE
 * ============================================================================
 *
 * PURPOSE: Format citations with 100% confidence-based location detection
 *
 * RULES:
 * - ONLY show location (Page/Slide/Sheet) if 100% confident
 * - PDF -> "Page X" (only if page number exists and > 0)
 * - Excel -> "Sheet X" (only if sheet name/number exists)
 * - PPTX -> "Slide X" (only if slide number exists and > 0)
 * - If not confident: Show document name only, NO location
 *
 * FRONTEND FORMAT:
 * {
 *   documentId: string,
 *   filename: string,
 *   location: string,  // "Page 5" or "Slide 3" or just document name
 *   relevanceScore: number,  // 0-100
 *   relevanceExplanation: string,
 *   folderPath: string,
 *   categoryName: string,
 *   viewUrl: string,
 *   downloadUrl: string
 * }
 */

interface ChunkMetadata {
  documentId?: string;
  filename?: string;
  mimeType?: string;
  page?: number;
  pageNumber?: number;
  slide?: number;
  slideNumber?: number;
  sheet?: string;
  sheetNumber?: number;
  sheetName?: string;
  text?: string;
  content?: string;
  folderPath?: string;
  categoryName?: string;
}

export interface CitationSource {
  documentId: string;
  filename: string;
  location: string;  // Formatted location or just filename
  relevanceScore: number;  // 0-100
  relevanceExplanation?: string;
  folderPath?: string;
  categoryName?: string;
  viewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
}

export class KodaCitationFormatService {

  /**
   * Format sources for frontend with confidence-based location
   */
  formatSources(chunks: any[], baseUrl: string = ''): CitationSource[] {
    console.log('[KODA CITATION] Formatting sources...');
    console.log(`[KODA CITATION] Input chunks: ${chunks.length}`);

    // Group chunks by document
    const documentMap = new Map<string, {
      documentId: string;
      filename: string;
      mimeType: string;
      locations: Set<string>;
      scores: number[];
      metadata: ChunkMetadata;
    }>();

    chunks.forEach(chunk => {
      const metadata = chunk.metadata || {};
      const docId = metadata.documentId || chunk.documentId;

      if (!docId) {
        console.warn('[KODA CITATION] Chunk missing documentId, skipping');
        return;
      }

      const filename = metadata.filename || metadata.originalName || 'Unknown Document';
      const mimeType = metadata.mimeType || '';
      const score = chunk.score || chunk.rerankScore || chunk.hybridScore || 0;

      // Detect location with 100% confidence
      const location = this.detectLocation(metadata, mimeType);

      if (!documentMap.has(docId)) {
        documentMap.set(docId, {
          documentId: docId,
          filename,
          mimeType,
          locations: new Set(),
          scores: [],
          metadata
        });
      }

      const doc = documentMap.get(docId)!;
      if (location) {
        doc.locations.add(location);
      }
      doc.scores.push(score);
    });

    // Convert to CitationSource array
    const sources: CitationSource[] = [];

    documentMap.forEach((doc, docId) => {
      // Calculate average relevance score (0-100)
      const avgScore = doc.scores.reduce((a, b) => a + b, 0) / doc.scores.length;
      const relevanceScore = Math.min(100, Math.round(avgScore * 100));

      // Format location string
      const locationStr = this.formatLocationString(
        doc.filename,
        Array.from(doc.locations),
        doc.mimeType
      );

      // Generate relevance explanation
      const explanation = this.generateRelevanceExplanation(relevanceScore, doc.locations.size);

      sources.push({
        documentId: docId,
        filename: doc.filename,
        location: locationStr,
        relevanceScore,
        relevanceExplanation: explanation,
        folderPath: doc.metadata.folderPath,
        categoryName: doc.metadata.categoryName,
        viewUrl: `${baseUrl}/documents/${docId}/view`,
        downloadUrl: `${baseUrl}/documents/${docId}/download`,
        mimeType: doc.mimeType
      });
    });

    // Sort by relevance score descending
    sources.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`[KODA CITATION] Formatted ${sources.length} sources`);
    sources.forEach((src, idx) => {
      console.log(`   [${idx + 1}] ${src.filename} - ${src.location} (${src.relevanceScore}%)`);
    });

    return sources;
  }

  /**
   * Detect location with 100% confidence
   * Returns location string ONLY if confident, otherwise null
   */
  private detectLocation(metadata: ChunkMetadata, mimeType: string): string | null {
    // PDF: Check for page number
    if (mimeType.includes('pdf')) {
      const page = metadata.page || metadata.pageNumber;
      if (page && page > 0) {
        return `Page ${page}`;
      }
      return null;  // Not confident, don't show page
    }

    // PPTX: Check for slide number
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      const slide = metadata.slide || metadata.slideNumber;
      if (slide && slide > 0) {
        return `Slide ${slide}`;
      }
      return null;  // Not confident, don't show slide
    }

    // Excel: Check for sheet name or number
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      const sheetName = metadata.sheetName || metadata.sheet;
      const sheetNumber = metadata.sheetNumber;

      if (sheetName && typeof sheetName === 'string' && sheetName.trim()) {
        return `Sheet: ${sheetName}`;
      }
      if (sheetNumber && sheetNumber > 0) {
        return `Sheet ${sheetNumber}`;
      }
      return null;  // Not confident, don't show sheet
    }

    // Other file types: No location
    return null;
  }

  /**
   * Format location string for display
   */
  private formatLocationString(
    filename: string,
    locations: string[],
    mimeType: string
  ): string {
    if (locations.length === 0) {
      // No confident location, just return filename
      return filename;
    }

    // Sort locations
    const sorted = this.sortLocations(locations, mimeType);

    if (sorted.length === 1) {
      // Single location
      return `${filename} (${sorted[0]})`;
    }

    if (sorted.length <= 3) {
      // Few locations, list them
      return `${filename} (${sorted.join(', ')})`;
    }

    // Many locations, show range
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return `${filename} (${first}-${last})`;
  }

  /**
   * Sort locations by number
   */
  private sortLocations(locations: string[], mimeType: string): string[] {
    return locations.sort((a, b) => {
      // Extract number from location string
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
  }

  /**
   * Generate relevance explanation
   */
  private generateRelevanceExplanation(score: number, locationCount: number): string {
    if (score >= 80) {
      return `Highly relevant content found${locationCount > 1 ? ` across ${locationCount} locations` : ''}`;
    }
    if (score >= 60) {
      return `Moderately relevant content found${locationCount > 1 ? ` across ${locationCount} locations` : ''}`;
    }
    return `Some relevant content found${locationCount > 1 ? ` across ${locationCount} locations` : ''}`;
  }

  /**
   * Build citation markers in text ([1], [2], etc.)
   */
  buildCitationMarkers(text: string, sources: CitationSource[]): string {
    // Check if text already has citation markers
    if (text.match(/\[\d+\]/)) {
      return text;  // Already has citations
    }

    // Add citation markers at end of key sentences
    // This is a simple implementation - can be enhanced
    const sentences = text.split(/\. /);

    if (sentences.length > 0 && sources.length > 0) {
      // Add citation to first sentence
      sentences[0] += ' [1]';
    }

    return sentences.join('. ');
  }

  /**
   * Format sources section for markdown
   * ✅ DISABLED: Sources now appear as inline hyperlinks, not a separate section
   */
  formatSourcesSection(sources: CitationSource[]): string {
    // Return empty - sources are displayed as inline hyperlinks only
    return '';
  }

  /**
   * Validate citation format
   */
  validateCitationFormat(sources: CitationSource[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    sources.forEach((source, idx) => {
      if (!source.documentId) {
        errors.push(`Source ${idx + 1}: Missing documentId`);
      }
      if (!source.filename) {
        errors.push(`Source ${idx + 1}: Missing filename`);
      }
      if (!source.location) {
        errors.push(`Source ${idx + 1}: Missing location`);
      }
      if (source.relevanceScore < 0 || source.relevanceScore > 100) {
        errors.push(`Source ${idx + 1}: Invalid relevance score ${source.relevanceScore}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Deduplicate sources by documentId
   */
  deduplicateSources(sources: CitationSource[]): CitationSource[] {
    const seen = new Set<string>();
    return sources.filter(source => {
      if (seen.has(source.documentId)) {
        return false;
      }
      seen.add(source.documentId);
      return true;
    });
  }

  /**
   * Filter sources by minimum relevance score
   */
  filterByRelevance(sources: CitationSource[], minScore: number = 30): CitationSource[] {
    return sources.filter(source => source.relevanceScore >= minScore);
  }

  /**
   * Limit sources to top N
   */
  limitSources(sources: CitationSource[], limit: number = 5): CitationSource[] {
    return sources.slice(0, limit);
  }
}

export const kodaCitationFormatService = new KodaCitationFormatService();
export default kodaCitationFormatService;
