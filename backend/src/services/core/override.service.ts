/**
 * Intent Override Service
 *
 * Applies deterministic rules to override intent classification
 * based on workspace context and query patterns.
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
   * 2. If query starts with / and is short → COMMAND
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

    // Rule 2: Short command-like query → COMMAND
    if (
      normalizedQuery.startsWith('/') &&
      normalizedQuery.length <= 10 &&
      intent.primaryIntent !== 'COMMAND'
    ) {
      return {
        ...intent,
        primaryIntent: 'COMMAND',
        confidence: 1.0,
        overrideReason: 'Query starting with "/" treated as COMMAND',
      };
    }

    // Rule 3: Document query but no documents → Add guidance
    if (
      workspaceStats.docCount === 0 &&
      (intent.primaryIntent === 'DOCUMENT_QNA' || intent.primaryIntent === 'SEARCH')
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

export const overrideService = new OverrideService();
export { OverrideService };
export default overrideService;
