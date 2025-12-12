/**
 * Intent Override Service (V3)
 *
 * Applies deterministic rules to override intent classification
 * based on workspace context and query patterns.
 *
 * NOTE: Uses V3 intent names (DOC_QA, DOC_SEARCH) not legacy names (DOCUMENT_QNA, SEARCH)
 */

import { IntentClassificationV3 } from '../../types/ragV3.types';

export interface OverrideParams {
  intent: IntentClassificationV3;
  userId: string;
  query: string;
  workspaceStats: {
    docCount: number;
  };
}

export type OverrideResult = IntentClassificationV3;

class OverrideService {
  // Help-related keywords in multiple languages
  private readonly helpKeywords = [
    // English
    'help', 'how do i', 'how to', 'usage', 'tutorial', 'guide', 'assist', 'support',
    // Portuguese
    'ajuda', 'como eu', 'como faço', 'uso', 'tutorial', 'guia', 'documentação', 'manual',
    // Spanish
    'ayuda', 'cómo', 'uso', 'tutorial', 'guía', 'soporte', 'manual',
  ];

  /**
   * Apply override rules to intent classification.
   *
   * Rules:
   * 1. If no documents and asking for help → PRODUCT_HELP
   * 2. (Removed) Slash commands handled at application layer
   * 3. If asking about documents but none exist → PRODUCT_HELP with guidance
   */
  public async override(params: OverrideParams): Promise<OverrideResult> {
    const { intent, query, workspaceStats } = params;
    const normalizedQuery = query.trim().toLowerCase();

    // Rule 1: No documents + help keywords → PRODUCT_HELP
    if (
      workspaceStats.docCount === 0 &&
      this.containsHelpKeyword(normalizedQuery) &&
      intent.primaryIntent !== 'PRODUCT_HELP'
    ) {
      return {
        ...intent,
        primaryIntent: 'PRODUCT_HELP',
        confidence: 1.0,
        overrideReason: 'No documents and query contains help keywords',
      };
    }

    // Rule 2: Short command-like query (removed)
    // NOTE: Slash commands are handled at the application/route layer, not intent system.
    // Queries like "/help" or "/clear" should be intercepted before reaching orchestrator.

    // Rule 3: Document query but no documents → Add guidance
    // NOTE: Uses V3 intent names (DOC_QA, DOC_SEARCH, DOC_SUMMARIZE, DOC_ANALYTICS)
    if (
      workspaceStats.docCount === 0 &&
      (intent.primaryIntent === 'DOC_QA' ||
        intent.primaryIntent === 'DOC_SEARCH' ||
        intent.primaryIntent === 'DOC_SUMMARIZE' ||
        intent.primaryIntent === 'DOC_ANALYTICS')
    ) {
      return {
        ...intent,
        primaryIntent: 'PRODUCT_HELP',
        confidence: 0.9,
        overrideReason: 'No documents available for document-based query',
        noDocsGuidance: true,
      } as IntentClassificationV3;
    }

    // Rule 4: Very high confidence pattern match should not be overridden
    if (intent.confidence >= 0.95 && intent.matchedPattern) {
      return intent;
    }

    // No override needed
    return intent;
  }

  /**
   * Check if query contains any help-related keywords.
   */
  private containsHelpKeyword(normalizedQuery: string): boolean {
    return this.helpKeywords.some(keyword => normalizedQuery.includes(keyword));
  }

  /**
   * Check if query is asking about documents.
   */
  public isDocumentQuery(query: string): boolean {
    const docKeywords = [
      'document', 'file', 'arquivo', 'documento', 'fichero', 'archivo',
      'upload', 'enviar', 'carregar', 'subir',
    ];
    const normalized = query.toLowerCase();
    return docKeywords.some(kw => normalized.includes(kw));
  }
}

// Export class for DI container injection
export { OverrideService };

// Singleton for backward compatibility (prefer DI injection via constructor)
export const overrideService = new OverrideService();
export default overrideService;
