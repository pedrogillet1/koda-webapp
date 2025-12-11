/**
 * ============================================================================
 * CITATION FORMAT SERVICE - Citation Building for Orchestrator
 * ============================================================================
 *
 * Builds CitationSource[] from RAG chunks for the orchestrator.
 *
 * @version 2.0.0
 * @date 2024-12-10
 */

import type { CitationSource, RagContext } from '../types/orchestrator.types';

// =============================================================================
// CITATION FORMAT SERVICE CLASS
// =============================================================================

class CitationFormatService {
  /**
   * Build citations from RAG chunks and documents
   */
  buildFromChunks(
    chunks: RagContext['chunks'],
    docsUsed: RagContext['docsUsed']
  ): CitationSource[] {
    const citations: CitationSource[] = [];
    const seenDocs = new Set<string>();

    // Process chunks in order to maintain relevance ranking
    for (const chunk of chunks) {
      if (seenDocs.has(chunk.docId)) continue;
      seenDocs.add(chunk.docId);

      // Find document info
      const docInfo = docsUsed.find(d => d.id === chunk.docId);

      // Build location string
      let location: string | undefined;
      if (chunk.location) {
        if (chunk.location.page) {
          location = `Página ${chunk.location.page}`;
        } else if (chunk.location.slide) {
          location = `Slide ${chunk.location.slide}`;
        } else if (chunk.location.sheet) {
          location = `Planilha ${chunk.location.sheet}`;
        }
      }

      citations.push({
        id: chunk.docId,
        title: docInfo?.title || this.cleanTitle(chunk.docId),
        filename: docInfo?.filename || chunk.docId,
        label: `[${citations.length + 1}]`,
        location,
        mimeType: docInfo?.mimeType,
      });
    }

    console.log(`[CITATION_FORMAT] Built ${citations.length} citations from ${chunks.length} chunks`);

    return citations;
  }

  /**
   * Format citations for LLM prompt
   */
  formatForPrompt(citations: CitationSource[]): string {
    if (citations.length === 0) return '';

    const lines = citations.map(
      (c, idx) => `[${idx + 1}] ${c.title}${c.location ? ` (${c.location})` : ''}`
    );

    return `Available sources:\n${lines.join('\n')}`;
  }

  /**
   * Clean document title from ID or filename
   */
  private cleanTitle(input: string): string {
    // Remove file extension
    let title = input.replace(/\.[^/.]+$/, '');

    // Replace underscores and hyphens with spaces
    title = title.replace(/[_-]/g, ' ');

    // Capitalize first letter of each word
    title = title.replace(/\b\w/g, c => c.toUpperCase());

    return title.trim() || 'Unknown Document';
  }

  /**
   * Map [src:N] markers to actual document titles
   */
  mapMarkersToTitles(text: string, citations: CitationSource[]): string {
    let result = text;

    for (let i = 0; i < citations.length; i++) {
      const marker = `[src:${i + 1}]`;
      const replacement = `**${citations[i].title}**[${i + 1}]`;
      result = result.replace(new RegExp(marker.replace(/[[\]]/g, '\\$&'), 'g'), replacement);
    }

    return result;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

const citationFormatService = new CitationFormatService();
export default citationFormatService;
export { CitationFormatService };
