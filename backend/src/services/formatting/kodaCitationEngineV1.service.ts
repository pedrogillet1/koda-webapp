/**
 * Koda Citation Engine V1
 *
 * KODA FIX: Converts LLM citation markers to frontend-compatible format
 *
 * Flow:
 * 1. LLM outputs [SRC:1], [SRC:2] markers (simple for LLM to generate)
 * 2. This engine converts them to {{DOC:::id:::name:::mimeType:::size:::}}
 * 3. Frontend parses {{DOC:::}} markers and renders clickable document pills
 *
 * MUST run BEFORE structure engine to protect markers from being mangled
 */

import type { FormattingContext, SourceDocument, Citation } from '../../types/ragV1.types';

export interface CitationEngineResult {
  text: string;
  citations: Citation[];
  documentMap: Map<number, SourceDocument>;
}

class KodaCitationEngineV1 {
  /**
   * Convert [SRC:X] markers to {{DOC:::}} format
   * Must run FIRST in the formatting pipeline
   */
  process(
    text: string,
    sourceDocuments: SourceDocument[]
  ): CitationEngineResult {
    // Build document lookup map (1-indexed for LLM convenience)
    const documentMap = this.buildDocumentMap(sourceDocuments);
    const citations: Citation[] = [];
    const seenDocs = new Set<string>();

    // Pattern: [SRC:1], [SRC:2], etc.
    const srcPattern = /\[SRC:(\d+)\]/g;

    const converted = text.replace(srcPattern, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      const doc = documentMap.get(index);

      if (!doc) {
        // Unknown source reference - remove marker
        console.warn(`[KodaCitationEngineV1] Unknown source index: ${index}`);
        return '';
      }

      // Track citation
      if (!seenDocs.has(doc.documentId)) {
        seenDocs.add(doc.documentId);
        citations.push({
          id: String(citations.length + 1),
          documentId: doc.documentId,
          title: doc.title,
          filename: doc.filename,
          type: 'inline',
          occurrences: 1,
        });
      } else {
        // Increment occurrence count
        const existing = citations.find(c => c.documentId === doc.documentId);
        if (existing) {
          existing.occurrences++;
        }
      }

      // Convert to frontend format: {{DOC:::id:::name:::mimeType:::size:::}}
      return this.buildDocMarker(doc);
    });

    return {
      text: converted,
      citations,
      documentMap,
    };
  }

  /**
   * Build 1-indexed document map for LLM references
   */
  private buildDocumentMap(docs: SourceDocument[]): Map<number, SourceDocument> {
    const map = new Map<number, SourceDocument>();
    docs.forEach((doc, idx) => {
      map.set(idx + 1, doc);  // 1-indexed
    });
    return map;
  }

  /**
   * Build frontend-compatible document marker
   * Format: {{DOC:::documentId:::displayName:::mimeType:::fileSize:::}}
   */
  private buildDocMarker(doc: SourceDocument): string {
    const displayName = doc.displayTitle || doc.title || doc.filename;
    const mimeType = doc.mimeType || 'application/octet-stream';
    const fileSize = doc.fileSize || 0;

    // Escape any ::: in the values to prevent parsing issues
    const safeName = displayName.replace(/:::/g, ':');
    const safeMime = mimeType.replace(/:::/g, ':');

    return `{{DOC:::${doc.documentId}:::${safeName}:::${safeMime}:::${fileSize}:::}}`;
  }

  /**
   * Build source reference instructions for LLM prompts
   * This tells the LLM how to cite documents
   */
  buildSourceInstructions(docs: SourceDocument[]): string {
    if (docs.length === 0) {
      return '';
    }

    const sourceList = docs.map((doc, idx) => {
      const name = doc.displayTitle || doc.title || doc.filename;
      return `[SRC:${idx + 1}] = "${name}"`;
    }).join('\n');

    return `
CITATION INSTRUCTIONS:
When referencing information from documents, use these source markers:

${sourceList}

Example usage:
- "The cost is R$ 500 per m² [SRC:1]"
- "According to the report [SRC:2], the deadline is January 2025"

Rules:
- Place [SRC:X] immediately after the fact being cited
- Use multiple markers if information comes from multiple sources
- Do NOT invent source numbers - only use the ones listed above
`;
  }

  /**
   * Also handle legacy [[DOC:id|Title]] format for backward compatibility
   * Converts to new {{DOC:::}} format
   */
  convertLegacyFormat(
    text: string,
    sourceDocuments: SourceDocument[]
  ): string {
    // Pattern: [[DOC:documentId|Title]]
    const legacyPattern = /\[\[DOC:([^\|]+)\|([^\]]+)\]\]/g;

    return text.replace(legacyPattern, (match, docId, title) => {
      // Find the document by ID
      const doc = sourceDocuments.find(d => d.documentId === docId.trim());

      if (doc) {
        return this.buildDocMarker(doc);
      }

      // If document not found, create marker from the captured values
      const mimeType = 'application/octet-stream';
      const fileSize = 0;
      return `{{DOC:::${docId.trim()}:::${title.trim()}:::${mimeType}:::${fileSize}:::}}`;
    });
  }

  /**
   * Check if text contains any citation markers
   */
  hasCitationMarkers(text: string): boolean {
    return /\[SRC:\d+\]/.test(text) || /\[\[DOC:[^\]]+\]\]/.test(text);
  }

  /**
   * Check if text contains converted document markers
   */
  hasDocumentMarkers(text: string): boolean {
    return /\{\{DOC:::[^}]+:::\}\}/.test(text);
  }
}

export const kodaCitationEngineV1 = new KodaCitationEngineV1();
export default kodaCitationEngineV1;
