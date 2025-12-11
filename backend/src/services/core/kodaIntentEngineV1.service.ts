/**
 * Koda Intent Engine V1
 *
 * Classifies user queries into:
 * - Domain: analytics | doc_content | doc_search | generic
 * - Question Type: 12 types (doc_count, simple_factual, comparison, etc.)
 * - Scope: single_document | multiple_documents | all_documents | no_documents
 *
 * Uses pattern matching + keyword detection for fast classification (<10ms)
 */

import type {
  IntentClassification,
  QueryDomain,
  QuestionType,
  QueryScope,
  ConversationContext,
} from '../../types/ragV1.types';

// ============================================================================
// Keywords & Patterns
// ============================================================================

const ANALYTICS_KEYWORDS = {
  count: ['quantos', 'how many', 'cuántos', 'combien', 'total', 'número'],
  list: ['liste', 'list', 'lista', 'mostrar', 'show', 'quais são'],
  recent: ['últimos', 'recent', 'recentes', 'newest', 'latest'],
  type: ['tipo', 'type', 'formato', 'format', 'extensão'],
};

const COMPARISON_KEYWORDS = [
  'compare', 'comparar', 'diferença', 'difference', 'versus', 'vs',
  'entre', 'between', 'qual é melhor', 'which is better',
];

const MULTI_POINT_KEYWORDS = [
  'quais são', 'what are', 'liste', 'list', 'todos os', 'all the',
  'principais', 'main', 'key', 'riscos', 'risks', 'benefícios', 'benefits',
];

const SEARCH_KEYWORDS = [
  'quais documentos', 'which documents', 'quais arquivos', 'which files',
  'encontre documentos', 'find documents', 'buscar', 'search',
  'documentos sobre', 'documents about',
];

const GREETING_KEYWORDS = [
  'oi', 'olá', 'hi', 'hello', 'hey', 'bom dia', 'boa tarde', 'boa noite',
];

const CAPABILITY_KEYWORDS = [
  'o que você faz', 'what can you do', 'como funciona', 'how does it work',
  'ajuda', 'help', 'o que é', 'what is',
];

// Document reference patterns
const SINGLE_DOC_PATTERNS = [
  /no (?:arquivo|documento) (?:chamado )?["""]?([^"""]+)["""]?/i,
  /in (?:the )?(?:file|document) (?:called )?["""]?([^"""]+)["""]?/i,
  /em ["""]?([^"""]+\.(?:pdf|docx|xlsx|pptx))["""]?/i,
];

const MULTI_DOC_PATTERNS = [
  /(?:todos|all) (?:os )?(?:documentos|arquivos|docs|files)/i,
  /(?:nos|in) (?:meus )?documentos/i,
  /em (?:todos|all)/i,
];

// ============================================================================
// Intent Engine Class
// ============================================================================

class KodaIntentEngineV1 {
  /**
   * Main classification function
   */
  classifyIntent(
    query: string,
    context?: ConversationContext
  ): IntentClassification {
    const normalized = query.toLowerCase().trim();

    // Detect domain
    const domain = this.detectDomain(normalized);

    // Detect question type
    const questionType = this.detectQuestionType(normalized, domain);

    // Detect scope
    const scope = this.detectScope(normalized, context);

    // Resolve target documents
    const { targetDocId, targetDocIds } = this.resolveTargetDocuments(
      normalized,
      scope,
      context
    );

    // Determine if RAG is needed
    const requiresRAG = this.requiresRAG(domain, questionType);

    // Calculate confidence
    const confidence = this.calculateConfidence(
      domain,
      questionType,
      scope,
      normalized
    );

    return {
      domain,
      questionType,
      scope,
      confidence,
      targetDocId,
      targetDocIds,
      requiresRAG,
      metadata: {
        queryLength: query.length,
        hasContext: !!context,
      },
    };
  }

  /**
   * Detect domain: analytics | doc_content | doc_search | generic
   */
  private detectDomain(query: string): QueryDomain {
    if (this.isAnalyticsQuery(query)) {
      return 'analytics';
    }

    if (this.isDocSearchQuery(query)) {
      return 'doc_search';
    }

    if (this.isGreeting(query) || this.isCapabilityQuery(query)) {
      return 'generic';
    }

    return 'doc_content';
  }

  /**
   * Detect question type (12 types)
   */
  private detectQuestionType(
    query: string,
    domain: QueryDomain
  ): QuestionType {
    if (domain === 'analytics') {
      if (this.hasKeywords(query, ANALYTICS_KEYWORDS.count)) {
        return 'doc_count';
      }
      if (this.hasKeywords(query, ANALYTICS_KEYWORDS.type)) {
        return 'type_distribution';
      }
      if (this.hasKeywords(query, ANALYTICS_KEYWORDS.recent)) {
        return 'recent_docs';
      }
      return 'doc_count';
    }

    if (domain === 'doc_search') {
      return 'document_filter';
    }

    if (domain === 'generic') {
      if (this.isGreeting(query)) {
        return 'greeting';
      }
      if (this.isCapabilityQuery(query)) {
        return 'capability';
      }
      return 'generic_chat';
    }

    if (this.hasKeywords(query, COMPARISON_KEYWORDS)) {
      return 'comparison';
    }

    if (this.hasKeywords(query, MULTI_POINT_KEYWORDS)) {
      return 'multi_point_extraction';
    }

    if (this.isFollowUp(query)) {
      return 'follow_up';
    }

    return 'simple_factual';
  }

  /**
   * Detect scope: single | multiple | all | no documents
   */
  private detectScope(
    query: string,
    context?: ConversationContext
  ): QueryScope {
    if (MULTI_DOC_PATTERNS.some(pattern => pattern.test(query))) {
      return 'all_documents';
    }

    if (SINGLE_DOC_PATTERNS.some(pattern => pattern.test(query))) {
      return 'single_document';
    }

    if (this.isFollowUp(query) && context?.activeDocIds?.length === 1) {
      return 'single_document';
    }

    if (this.isFollowUp(query) && context?.activeDocIds && context.activeDocIds.length > 1) {
      return 'multiple_documents';
    }

    if (this.hasKeywords(query, COMPARISON_KEYWORDS)) {
      return 'multiple_documents';
    }

    return 'all_documents';
  }

  /**
   * Resolve target document IDs from query or context
   */
  private resolveTargetDocuments(
    query: string,
    scope: QueryScope,
    context?: ConversationContext
  ): { targetDocId?: string; targetDocIds?: string[] } {
    if (scope === 'single_document' && context?.activeDocIds?.length === 1) {
      return { targetDocId: context.activeDocIds[0] };
    }

    if (scope === 'multiple_documents' && context?.activeDocIds) {
      return { targetDocIds: context.activeDocIds };
    }

    return {};
  }

  /**
   * Check if query requires RAG
   */
  private requiresRAG(domain: QueryDomain, questionType: QuestionType): boolean {
    if (domain === 'analytics') return false;
    if (domain === 'doc_search') return false;
    if (questionType === 'greeting' || questionType === 'capability') return false;
    return true;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    domain: QueryDomain,
    questionType: QuestionType,
    scope: QueryScope,
    query: string
  ): number {
    let confidence = 0.5;

    if (domain === 'analytics' && this.hasKeywords(query, ANALYTICS_KEYWORDS.count)) {
      confidence = 0.95;
    }

    if (this.hasKeywords(query, COMPARISON_KEYWORDS)) {
      confidence = 0.9;
    }

    if (SINGLE_DOC_PATTERNS.some(p => p.test(query))) {
      confidence = 0.85;
    }

    if (this.isGreeting(query)) {
      confidence = 0.95;
    }

    if (this.hasKeywords(query, MULTI_POINT_KEYWORDS)) {
      confidence = 0.75;
    }

    if (query.length < 10) {
      confidence *= 0.9;
    }

    return Math.min(confidence, 1.0);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private isAnalyticsQuery(query: string): boolean {
    return Object.values(ANALYTICS_KEYWORDS).some(keywords =>
      this.hasKeywords(query, keywords)
    );
  }

  private isDocSearchQuery(query: string): boolean {
    return this.hasKeywords(query, SEARCH_KEYWORDS);
  }

  private isGreeting(query: string): boolean {
    return this.hasKeywords(query, GREETING_KEYWORDS);
  }

  private isCapabilityQuery(query: string): boolean {
    return this.hasKeywords(query, CAPABILITY_KEYWORDS);
  }

  private isFollowUp(query: string): boolean {
    const followUpPatterns = [
      /^e /i,
      /^and /i,
      /^também /i,
      /^also /i,
      /nesse|neste|esse|este|this|that/i,
    ];

    return followUpPatterns.some(pattern => pattern.test(query));
  }

  private hasKeywords(query: string, keywords: string[]): boolean {
    return keywords.some(keyword => query.includes(keyword));
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const kodaIntentEngineV1 = new KodaIntentEngineV1();
export default kodaIntentEngineV1;
