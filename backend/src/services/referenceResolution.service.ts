/**
 * ============================================================================
 * REFERENCE RESOLUTION SERVICE
 * ============================================================================
 *
 * Memory Engine 3.0 - Resolves document references in user queries
 *
 * Handles:
 * - Ordinal references: "the first one", "the second document", "the last file"
 * - Pronoun references: "it", "this", "that", "this document", "that file"
 * - Multi-language support: English, Portuguese, Spanish
 *
 * Example flows:
 * 1. User: "Show my files" -> Koda lists 5 files
 * 2. User: "Open the first one" -> Resolves to file[0]
 * 3. User: "Tell me about it" -> Resolves to last referenced document
 */

import { documentListStateManager, DocumentListItem } from './documentListStateManager.service';

// ============================================================================
// TYPES
// ============================================================================

export interface ResolvedReference {
  document: DocumentListItem | null;
  referenceType: 'ordinal' | 'pronoun' | 'name' | 'last' | 'none';
  confidence: number;
  originalQuery: string;
  resolvedQuery?: string;  // Query with reference replaced by document name
}

// ============================================================================
// ORDINAL PATTERNS (first, second, third, etc.)
// ============================================================================

const ORDINAL_PATTERNS: { pattern: RegExp; index: number | 'last' }[] = [
  // English
  { pattern: /\b(the\s+)?first(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 0 },
  { pattern: /\b(the\s+)?second(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 1 },
  { pattern: /\b(the\s+)?third(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 2 },
  { pattern: /\b(the\s+)?fourth(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 3 },
  { pattern: /\b(the\s+)?fifth(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 4 },
  { pattern: /\b(the\s+)?sixth(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 5 },
  { pattern: /\b(the\s+)?seventh(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 6 },
  { pattern: /\b(the\s+)?eighth(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 7 },
  { pattern: /\b(the\s+)?ninth(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 8 },
  { pattern: /\b(the\s+)?tenth(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 9 },
  { pattern: /\b(the\s+)?last(\s+one|\s+document|\s+file|\s+pdf|\s+item)?\b/i, index: 'last' },

  // Numeric ordinals: "the 1st", "the 2nd", etc.
  { pattern: /\b(the\s+)?1st(\s+one|\s+document|\s+file)?\b/i, index: 0 },
  { pattern: /\b(the\s+)?2nd(\s+one|\s+document|\s+file)?\b/i, index: 1 },
  { pattern: /\b(the\s+)?3rd(\s+one|\s+document|\s+file)?\b/i, index: 2 },
  { pattern: /\b(the\s+)?(\d+)(?:th|st|nd|rd)(\s+one|\s+document|\s+file)?\b/i, index: -1 }, // Dynamic

  // Portuguese
  { pattern: /\b(o\s+)?primeir[oa](\s+documento|\s+arquivo)?\b/i, index: 0 },
  { pattern: /\b(o\s+)?segund[oa](\s+documento|\s+arquivo)?\b/i, index: 1 },
  { pattern: /\b(o\s+)?terceir[oa](\s+documento|\s+arquivo)?\b/i, index: 2 },
  { pattern: /\b(o\s+)?quart[oa](\s+documento|\s+arquivo)?\b/i, index: 3 },
  { pattern: /\b(o\s+)?quint[oa](\s+documento|\s+arquivo)?\b/i, index: 4 },
  { pattern: /\b(o\s+)?[uú]ltim[oa](\s+documento|\s+arquivo)?\b/i, index: 'last' },

  // Spanish
  { pattern: /\b(el\s+)?primer[oa]?(\s+documento|\s+archivo)?\b/i, index: 0 },
  { pattern: /\b(el\s+)?segund[oa](\s+documento|\s+archivo)?\b/i, index: 1 },
  { pattern: /\b(el\s+)?tercer[oa]?(\s+documento|\s+archivo)?\b/i, index: 2 },
  { pattern: /\b(el\s+)?cuart[oa](\s+documento|\s+archivo)?\b/i, index: 3 },
  { pattern: /\b(el\s+)?quint[oa](\s+documento|\s+archivo)?\b/i, index: 4 },
  { pattern: /\b(el\s+)?[uú]ltim[oa](\s+documento|\s+archivo)?\b/i, index: 'last' },
];

// ============================================================================
// PRONOUN PATTERNS (it, this, that, etc.)
// ============================================================================

const PRONOUN_PATTERNS: RegExp[] = [
  // English - pronouns referring to documents
  /\b(about\s+)?it\b/i,
  /\bthis(\s+document|\s+file|\s+one)?\b/i,
  /\bthat(\s+document|\s+file|\s+one)?\b/i,
  /\bthe\s+document\b/i,
  /\bthe\s+file\b/i,
  /\bopen\s+it\b/i,
  /\bread\s+it\b/i,
  /\bsummarize\s+it\b/i,
  /\banalyze\s+it\b/i,
  /\btell\s+me\s+(more\s+)?about\s+it\b/i,
  /\bwhat('s|\s+is)\s+(in\s+)?it\b/i,

  // Portuguese
  /\b(sobre\s+)?ele\b/i,
  /\b(sobre\s+)?ela\b/i,
  /\best[ea](\s+documento|\s+arquivo)?\b/i,
  /\bess[ea](\s+documento|\s+arquivo)?\b/i,
  /\bo\s+documento\b/i,
  /\bo\s+arquivo\b/i,
  /\babr[ae]\s+(ele|ela|isso)\b/i,

  // Spanish
  /\b(sobre\s+)?[eé]l\b/i,
  /\b(sobre\s+)?ella\b/i,
  /\best[ea](\s+documento|\s+archivo)?\b/i,
  /\bes[ea](\s+documento|\s+archivo)?\b/i,
  /\bel\s+documento\b/i,
  /\bel\s+archivo\b/i,
  /\babr[ei]\s+(lo|la|esto)\b/i,
];

// ============================================================================
// REFERENCE RESOLUTION SERVICE
// ============================================================================

class ReferenceResolutionService {

  /**
   * Main entry point: Resolve document references in a query
   */
  public async resolveReference(
    conversationId: string,
    query: string
  ): Promise<ResolvedReference> {
    const lowerQuery = query.toLowerCase();

    // 1. Try ordinal resolution first ("the first one", "the second document")
    const ordinalResult = await this.resolveOrdinalReference(conversationId, query);
    if (ordinalResult.document) {
      console.log(`[ReferenceResolution] Resolved ordinal: "${query}" -> ${ordinalResult.document.name}`);
      return ordinalResult;
    }

    // 2. Try pronoun resolution ("it", "this", "that document")
    const pronounResult = await this.resolvePronounReference(conversationId, query);
    if (pronounResult.document) {
      console.log(`[ReferenceResolution] Resolved pronoun: "${query}" -> ${pronounResult.document.name}`);
      return pronounResult;
    }

    // 3. No reference found
    return {
      document: null,
      referenceType: 'none',
      confidence: 0,
      originalQuery: query,
    };
  }

  /**
   * Resolve ordinal references: "the first one", "second document", etc.
   */
  private async resolveOrdinalReference(
    conversationId: string,
    query: string
  ): Promise<ResolvedReference> {
    const documents = await documentListStateManager.getDocumentList(conversationId);

    if (documents.length === 0) {
      return { document: null, referenceType: 'ordinal', confidence: 0, originalQuery: query };
    }

    for (const { pattern, index } of ORDINAL_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        let resolvedIndex: number;

        if (index === 'last') {
          resolvedIndex = documents.length - 1;
        } else if (index === -1) {
          // Dynamic numeric ordinal (4th, 5th, etc.)
          const numMatch = query.match(/(\d+)(?:th|st|nd|rd)/i);
          if (numMatch) {
            resolvedIndex = parseInt(numMatch[1], 10) - 1; // Convert to 0-based
          } else {
            continue;
          }
        } else {
          resolvedIndex = index;
        }

        if (resolvedIndex >= 0 && resolvedIndex < documents.length) {
          const doc = documents[resolvedIndex];

          // Update last document reference
          await documentListStateManager.setLastDocument(conversationId, doc.id);

          return {
            document: doc,
            referenceType: 'ordinal',
            confidence: 0.95,
            originalQuery: query,
            resolvedQuery: query.replace(match[0], `"${doc.name}"`),
          };
        }
      }
    }

    return { document: null, referenceType: 'ordinal', confidence: 0, originalQuery: query };
  }

  /**
   * Resolve pronoun references: "it", "this document", "that file", etc.
   */
  private async resolvePronounReference(
    conversationId: string,
    query: string
  ): Promise<ResolvedReference> {
    // Check if query contains a pronoun reference
    const hasPronoun = PRONOUN_PATTERNS.some(p => p.test(query));

    if (!hasPronoun) {
      return { document: null, referenceType: 'pronoun', confidence: 0, originalQuery: query };
    }

    // Try to get the last referenced document
    const lastDocId = await documentListStateManager.getLastDocument(conversationId);

    if (lastDocId) {
      // Get document from list
      const documents = await documentListStateManager.getDocumentList(conversationId);
      const doc = documents.find(d => d.id === lastDocId);

      if (doc) {
        return {
          document: doc,
          referenceType: 'pronoun',
          confidence: 0.85,
          originalQuery: query,
          resolvedQuery: query.replace(/\bit\b/gi, `"${doc.name}"`),
        };
      }
    }

    // Fallback: If no last document, try the first in the list
    const documents = await documentListStateManager.getDocumentList(conversationId);
    if (documents.length > 0) {
      const doc = documents[0];

      // Set as last document
      await documentListStateManager.setLastDocument(conversationId, doc.id);

      return {
        document: doc,
        referenceType: 'pronoun',
        confidence: 0.70, // Lower confidence for fallback
        originalQuery: query,
        resolvedQuery: query.replace(/\bit\b/gi, `"${doc.name}"`),
      };
    }

    return { document: null, referenceType: 'pronoun', confidence: 0, originalQuery: query };
  }

  /**
   * Check if a query contains a document reference that needs resolution
   */
  public hasDocumentReference(query: string): boolean {
    // Check ordinals
    for (const { pattern } of ORDINAL_PATTERNS) {
      if (pattern.test(query)) return true;
    }

    // Check pronouns
    for (const pattern of PRONOUN_PATTERNS) {
      if (pattern.test(query)) return true;
    }

    return false;
  }

  /**
   * Extract the reference text from a query
   */
  public extractReference(query: string): string | null {
    // Check ordinals
    for (const { pattern } of ORDINAL_PATTERNS) {
      const match = query.match(pattern);
      if (match) return match[0];
    }

    // Check pronouns
    for (const pattern of PRONOUN_PATTERNS) {
      const match = query.match(pattern);
      if (match) return match[0];
    }

    return null;
  }
}

// Export singleton instance
export const referenceResolutionService = new ReferenceResolutionService();
export default referenceResolutionService;
