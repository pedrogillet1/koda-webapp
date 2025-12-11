/**
 * ============================================================================
 * CITATION PARSER SERVICE
 * ============================================================================
 * 
 * Parses [src:N] markers in LLM output and maps them to citations.
 * Ensures every answer with citations has at least one clickable title.
 * 
 * Input: "O custo é R$ 500 segundo **analise_mezanino.pdf**[src:1]."
 * Output: Parsed text + citation markers + guarantee check
 * 
 * @version 2.0.0
 * @date 2024-12-10
 */

import type {
  Citation,
  CitationMarker,
  CitationParsingResult,
} from '../types/rag.types';

// ============================================================================
// REGEX PATTERNS
// ============================================================================

// Matches [src:1], [src:2], etc.
const CITATION_MARKER_REGEX = /\[src:(\d+)\]/g;

// Matches common document extensions
const DOC_EXTENSION_REGEX = /\.(pdf|docx?|xlsx?|pptx?|txt|html?|png|jpe?g|gif)(\s|$|[,.])/i;

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class CitationParserService {
  /**
   * Parse citations from answer text
   * 
   * @param answerText - LLM output with [src:N] markers
   * @param citations - Array of citations (indexed from 1)
   * @returns Parsing result with markers and guarantees
   */
  parseCitations(
    answerText: string,
    citations: Citation[]
  ): CitationParsingResult {
    const startTime = Date.now();

    // Find all [src:N] markers
    const markers = this.findMarkers(answerText, citations);

    // Find document titles near markers
    const markersWithTitles = this.findNearestTitles(answerText, markers, citations);

    // Remove markers from text (frontend will render pills)
    const parsedText = this.removeMarkers(answerText);

    // Check if at least one title is clickable
    const guaranteedClickable = this.checkGuarantee(markersWithTitles, citations);

    // If not guaranteed, append fallback
    let finalText = parsedText;
    let finalMarkers = markersWithTitles;

    if (!guaranteedClickable && citations.length > 0) {
      const fallback = this.createFallback(citations);
      finalText = `${parsedText}\n\n${fallback.text}`;
      finalMarkers = [...markersWithTitles, ...fallback.markers];
    }

    const processingTime = Date.now() - startTime;

    console.log(`[CITATION_PARSER] Parsed in ${processingTime}ms: ${markers.length} markers, ${citations.length} citations, guaranteed=${guaranteedClickable}`);

    return {
      originalText: answerText,
      parsedText: finalText,
      markers: finalMarkers,
      citations,
      guaranteedClickable: guaranteedClickable || citations.length === 0,
    };
  }

  /**
   * Find all [src:N] markers in text
   */
  private findMarkers(text: string, citations: Citation[]): CitationMarker[] {
    const markers: CitationMarker[] = [];
    let match: RegExpExecArray | null;

    const regex = new RegExp(CITATION_MARKER_REGEX);

    while ((match = regex.exec(text)) !== null) {
      const citationIndex = parseInt(match[1], 10);

      // Validate index
      if (citationIndex < 1 || citationIndex > citations.length) {
        console.warn(`[CITATION_PARSER] Invalid citation index: ${citationIndex} (max: ${citations.length})`);
        continue;
      }

      markers.push({
        markerText: match[0],
        citationIndex,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return markers;
  }

  /**
   * Find nearest document title before each marker
   */
  private findNearestTitles(
    text: string,
    markers: CitationMarker[],
    citations: Citation[]
  ): CitationMarker[] {
    return markers.map((marker) => {
      const citation = citations[marker.citationIndex - 1];
      if (!citation) return marker;

      // Search backward from marker for document title
      const searchText = text.substring(0, marker.startIndex);
      const title = citation.title;

      // Try exact match first
      let titleIndex = searchText.lastIndexOf(title);

      // If not found, try filename
      if (titleIndex === -1 && citation.filename !== title) {
        titleIndex = searchText.lastIndexOf(citation.filename);
      }

      // If still not found, try partial match (last 20 chars of title)
      if (titleIndex === -1 && title.length > 20) {
        const partialTitle = title.substring(title.length - 20);
        titleIndex = searchText.lastIndexOf(partialTitle);
      }

      if (titleIndex !== -1) {
        return {
          ...marker,
          nearestTitle: title,
          titleStartIndex: titleIndex,
          titleEndIndex: titleIndex + title.length,
        };
      }

      return marker;
    });
  }

  /**
   * Remove [src:N] markers from text
   */
  private removeMarkers(text: string): string {
    return text.replace(CITATION_MARKER_REGEX, '').trim();
  }

  /**
   * Check if at least one title is clickable
   */
  private checkGuarantee(
    markers: CitationMarker[],
    citations: Citation[]
  ): boolean {
    if (citations.length === 0) return true;

    // At least one marker must have a nearest title
    return markers.some((marker) => marker.nearestTitle !== undefined);
  }

  /**
   * Create fallback "Fontes:" section
   */
  private createFallback(citations: Citation[]): {
    text: string;
    markers: CitationMarker[];
  } {
    let text = '**Fontes:**\n';
    const markers: CitationMarker[] = [];
    let currentIndex = text.length;

    citations.forEach((citation, index) => {
      const citationIndex = index + 1;
      const line = `${citationIndex}. **${citation.title}**[src:${citationIndex}]\n`;

      markers.push({
        markerText: `[src:${citationIndex}]`,
        citationIndex,
        startIndex: currentIndex + line.indexOf(`[src:${citationIndex}]`),
        endIndex: currentIndex + line.indexOf(`[src:${citationIndex}]`) + `[src:${citationIndex}]`.length,
        nearestTitle: citation.title,
        titleStartIndex: currentIndex + line.indexOf(citation.title),
        titleEndIndex: currentIndex + line.indexOf(citation.title) + citation.title.length,
      });

      text += line;
      currentIndex += line.length;
    });

    return { text, markers };
  }

  /**
   * Extract document titles from text (for validation)
   */
  extractDocumentTitles(text: string): string[] {
    const titles: string[] = [];

    // Find anything that looks like a filename
    const words = text.split(/\s+/);

    for (const word of words) {
      if (DOC_EXTENSION_REGEX.test(word)) {
        // Clean up punctuation
        const cleaned = word.replace(/[,.]$/, '');
        titles.push(cleaned);
      }
    }

    return [...new Set(titles)];
  }

  /**
   * Validate that all citations are referenced
   */
  validateCitations(
    markers: CitationMarker[],
    citations: Citation[]
  ): {
    valid: boolean;
    unreferenced: number[];
    invalid: number[];
  } {
    const referencedIndices = new Set(markers.map((m) => m.citationIndex));
    const unreferenced: number[] = [];
    const invalid: number[] = [];

    citations.forEach((_, index) => {
      const citationIndex = index + 1;
      if (!referencedIndices.has(citationIndex)) {
        unreferenced.push(citationIndex);
      }
    });

    markers.forEach((marker) => {
      if (marker.citationIndex < 1 || marker.citationIndex > citations.length) {
        invalid.push(marker.citationIndex);
      }
    });

    return {
      valid: unreferenced.length === 0 && invalid.length === 0,
      unreferenced,
      invalid,
    };
  }

  /**
   * Build citations array from retrieved chunks
   */
  buildCitationsFromChunks(chunks: any[]): Citation[] {
    const citationMap = new Map<string, Citation>();

    chunks.forEach((chunk) => {
      if (!citationMap.has(chunk.documentId)) {
        citationMap.set(chunk.documentId, {
          id: chunk.documentId,
          docId: chunk.documentId,
          title: chunk.metadata.documentTitle,
          label: chunk.metadata.documentTitle,
          filename: chunk.metadata.filename,
          page: chunk.metadata.page,
          slide: chunk.metadata.slide,
          sheet: chunk.metadata.sheet,
          mimeType: chunk.metadata.mimeType,
          score: chunk.score,
        });
      }
    });

    return Array.from(citationMap.values());
  }

  /**
   * Format citations for LLM prompt
   * 
   * Creates a numbered list that the LLM can reference
   */
  formatCitationsForPrompt(citations: Citation[]): string {
    if (citations.length === 0) return '';

    let text = 'Available sources:\n';

    citations.forEach((citation, index) => {
      const citationIndex = index + 1;
      text += `[${citationIndex}] ${citation.title}`;

      if (citation.page) text += ` (page ${citation.page})`;
      if (citation.slide) text += ` (slide ${citation.slide})`;
      if (citation.sheet) text += ` (sheet ${citation.sheet})`;

      text += '\n';
    });

    text += '\nWhen you reference a source, mention its title and add [src:N] where N is the source number.';

    return text;
  }

  /**
   * Clean up nested/broken Markdown links
   * 
   * Fixes patterns like: [[**[**file.pdf**](#doc-...)**](#doc-...)]
   */
  cleanupBrokenLinks(text: string): string {
    // Remove nested brackets
    let cleaned = text.replace(/\[\[/g, '[').replace(/\]\]/g, ']');

    // Remove Markdown links (we use [src:N] instead)
    cleaned = cleaned.replace(/\[([^\]]+)\]\(#doc-[a-f0-9-]+\)/g, '$1');

    // Remove broken bold markers
    cleaned = cleaned.replace(/\*\*\*\*/g, '**');

    // Remove trailing **
    cleaned = cleaned.replace(/\*\*(\s|$)/g, '$1');

    return cleaned;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default new CitationParserService();
