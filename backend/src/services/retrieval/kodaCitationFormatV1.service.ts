/**
 * Koda Citation Format Service V1
 *
 * Handles citation formatting:
 * - Build citations from RagContext
 * - Normalize citation format
 * - Deduplicate citations
 * - Assign citation IDs [1], [2], [3]
 * - Format inline citations
 * - Format list citations
 */

import type { RagContext, Citation, SourceDocument } from '../../types/ragV1.types';

class KodaCitationFormatServiceV1 {
  buildCitations(ragContext: RagContext): Citation[] {
    const citations: Citation[] = [];
    const seen = new Set<string>();
    let citationId = 1;

    for (const doc of ragContext.rawSourceData) {
      if (!seen.has(doc.documentId)) {
        seen.add(doc.documentId);
        citations.push({
          id: String(citationId++),
          documentId: doc.documentId,
          title: doc.title,
          filename: doc.filename,
          type: 'inline',
          occurrences: 1,
        });
      }
    }

    return citations;
  }

  normalizeCitation(citation: Citation): Citation {
    return {
      ...citation,
      title: citation.title.trim(),
    };
  }

  deduplicateCitations(citations: Citation[]): Citation[] {
    const seen = new Set<string>();
    const unique: Citation[] = [];

    for (const citation of citations) {
      if (!seen.has(citation.documentId)) {
        seen.add(citation.documentId);
        unique.push(citation);
      }
    }

    return unique;
  }

  assignCitationIds(citations: Citation[]): Citation[] {
    return citations.map((citation, index) => ({
      ...citation,
      id: String(index + 1),
    }));
  }

  formatInlineCitation(citation: Citation): string {
    return `**${citation.title}** [${citation.id}]`;
  }

  formatListCitation(citation: Citation): string {
    return `${citation.id}. ${citation.title}`;
  }

  formatSourcesSection(citations: Citation[]): string {
    if (citations.length === 0) {
      return '';
    }

    const list = citations
      .map(c => this.formatListCitation(c))
      .join('\n');

    return `**Fontes:**\n${list}`;
  }

  /**
   * Convert [[DOC:id|Title]] to formatted citation
   */
  convertDocPlaceholder(text: string): { text: string; citations: Citation[] } {
    const citations: Citation[] = [];
    let citationId = 1;

    // Find all [[DOC:id|Title]] patterns
    const pattern = /\[\[DOC:([^\|]+)\|([^\]]+)\]\]/g;

    const converted = text.replace(pattern, (match, docId, title) => {
      citations.push({
        id: String(citationId),
        documentId: docId.trim(),
        title: title.trim(),
        filename: title.trim(),
        type: 'inline',
        occurrences: 1,
      });

      const result = `**${title.trim()}** [${citationId}]`;
      citationId++;

      return result;
    });

    return { text: converted, citations };
  }

  /**
   * Add sources section to answer if not present
   */
  addSourcesSection(text: string, citations: Citation[]): string {
    // Don't add if already exists
    if (text.includes('Fontes:') || text.includes('Sources:')) {
      return text;
    }

    if (citations.length === 0) {
      return text;
    }

    const sourcesSection = this.formatSourcesSection(citations);
    return `${text}\n\n${sourcesSection}`;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const kodaCitationFormatServiceV1 = new KodaCitationFormatServiceV1();
export default kodaCitationFormatServiceV1;
