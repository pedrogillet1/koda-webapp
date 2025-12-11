/**
 * ============================================================================
 * INTENT CLASSIFIER SERVICE - Question Classification for Orchestrator
 * ============================================================================
 *
 * Classifies user questions into:
 * - questionType (simple_factual, comparison, summary, etc.)
 * - domain (doc_content, analytics, generic)
 * - scope (specific_docs, all_docs, none)
 *
 * Wraps simpleIntentDetection.service.ts and maps to orchestrator types.
 *
 * @version 2.0.0
 * @date 2024-12-10
 */

import { classifyQuestion, detectTemporalExpression, type ClassifiedQuestion, type QuestionType as SimpleQuestionType } from './simpleIntentDetection.service';
import type { IntentClassification, QuestionType, Domain, Scope } from '../types/orchestrator.types';

// =============================================================================
// TYPE MAPPINGS
// =============================================================================

/**
 * Map simpleIntentDetection types to orchestrator types
 */
const QUESTION_TYPE_MAP: Record<SimpleQuestionType, QuestionType> = {
  meta: 'capability',
  greeting: 'greeting',
  simple_factual: 'simple_factual',
  medium: 'simple_factual',
  medium_specific: 'simple_factual',
  complex_analysis: 'summary',
  complex_multidoc: 'multi_point_extraction',
  comparison: 'comparison',
  list: 'list',
  followup: 'followup',
};

/**
 * Determine domain from question type and content
 */
function determineDomain(query: string, questionType: QuestionType): Domain {
  const lowerQuery = query.toLowerCase();

  // Analytics patterns (metadata about documents)
  const analyticsPatterns = [
    /quantos? documentos?/i,
    /quais? documentos?/i,
    /lista(r)? (todos? )?(os )?(meus )?arquivos/i,
    /tipos? de arquivos?/i,
    /documentos? mais recentes?/i,
    /how many (documents?|files?)/i,
    /list (all )?(my )?(documents?|files?)/i,
    /what (documents?|files?) do i have/i,
  ];

  if (analyticsPatterns.some(p => p.test(lowerQuery))) {
    return 'analytics';
  }

  // Generic patterns (no documents needed)
  if (questionType === 'greeting' || questionType === 'capability') {
    return 'generic';
  }

  // Generic patterns
  const genericPatterns = [
    /^(oi|olá|hey|hi|hello|bom dia|boa tarde|boa noite)/i,
    /como (você|voce|vc) (está|esta|se chama|funciona)/i,
    /o que (você|voce|vc) (faz|pode fazer|sabe fazer)/i,
    /quem (é|e) (você|voce|vc)/i,
    /what can you do/i,
    /who are you/i,
    /how are you/i,
  ];

  if (genericPatterns.some(p => p.test(lowerQuery))) {
    return 'generic';
  }

  // Default: needs document content (RAG)
  return 'doc_content';
}

/**
 * Determine scope from query
 */
function determineScope(query: string): { scope: Scope; docIds?: string[] } {
  const lowerQuery = query.toLowerCase();

  // Specific document references
  const thisDocPatterns = [
    /n(esse|este|o) (documento|arquivo|pdf|planilha)/i,
    /this (document|file)/i,
    /in this (document|file)/i,
  ];

  if (thisDocPatterns.some(p => p.test(lowerQuery))) {
    return { scope: 'specific_docs' };
  }

  // Multiple document references
  const theseDocsPatterns = [
    /n(esses|estes|os) (documentos|arquivos)/i,
    /these (documents|files)/i,
    /in these (documents|files)/i,
  ];

  if (theseDocsPatterns.some(p => p.test(lowerQuery))) {
    return { scope: 'specific_docs' };
  }

  // All documents
  const allDocsPatterns = [
    /em todos? (os )?(meus )?(documentos|arquivos)/i,
    /in all (my )?(documents|files)/i,
  ];

  if (allDocsPatterns.some(p => p.test(lowerQuery))) {
    return { scope: 'all_docs' };
  }

  // Default
  return { scope: 'all_docs' };
}

/**
 * Detect language from query
 */
function detectLanguage(query: string): 'pt' | 'en' | 'es' | 'fr' {
  // Portuguese indicators
  const ptPatterns = [
    /\b(é|são|está|como|qual|quais|quanto|quando|onde|porque|para|com|sem|não|sim)\b/i,
    /\b(documento|arquivo|planilha|apresentação)\b/i,
    /[áàâãéèêíìîóòôõúùûç]/i,
  ];

  if (ptPatterns.some(p => p.test(query))) {
    return 'pt';
  }

  // Spanish indicators
  const esPatterns = [
    /\b(qué|cómo|cuál|cuáles|cuánto|cuándo|dónde|por qué|para|con|sin|sí|documento)\b/i,
    /[ñ¿¡]/i,
  ];

  if (esPatterns.some(p => p.test(query))) {
    return 'es';
  }

  // French indicators
  const frPatterns = [
    /\b(qu'est-ce|comment|quel|quels|combien|quand|où|pourquoi|avec|sans|oui|non)\b/i,
    /[àâæçéèêëîïôœùûüÿ]/i,
  ];

  if (frPatterns.some(p => p.test(query))) {
    return 'fr';
  }

  // Default to English
  return 'en';
}

/**
 * Detect memory patterns (references to previous context)
 */
function detectMemoryPattern(query: string): IntentClassification['memoryPattern'] | undefined {
  const lowerQuery = query.toLowerCase();

  // "this document" pattern
  if (/n(esse|este|o) (documento|arquivo)/i.test(lowerQuery) || /this (document|file)/i.test(lowerQuery)) {
    return { type: 'this_document' };
  }

  // "these documents" pattern
  if (/n(esses|estes|os) (documentos|arquivos)/i.test(lowerQuery) || /these (documents|files)/i.test(lowerQuery)) {
    return { type: 'these_documents' };
  }

  return undefined;
}

// =============================================================================
// INTENT CLASSIFIER SERVICE CLASS
// =============================================================================

class IntentClassifierService {
  /**
   * Classify a user message
   */
  async classify(
    message: string,
    conversationState?: any
  ): Promise<IntentClassification> {
    // Use existing simpleIntentDetection for base classification
    const simpleClassification = classifyQuestion(message);

    // Map question type
    const questionType = QUESTION_TYPE_MAP[simpleClassification.type] || 'generic';

    // Determine domain
    const domain = determineDomain(message, questionType);

    // Determine scope
    const { scope, docIds } = determineScope(message);

    // Detect language
    const language = detectLanguage(message);

    // Detect memory patterns
    const memoryPattern = detectMemoryPattern(message);

    // Get scope doc IDs from conversation state if applicable
    let scopeDocIds: string[] | undefined;
    if (scope === 'specific_docs' && conversationState?.activeDocIds) {
      scopeDocIds = conversationState.activeDocIds;
    }

    // Build classification result
    const classification: IntentClassification = {
      questionType,
      domain,
      scope,
      confidence: simpleClassification.confidence,
      language,
      memoryPattern,
      scopeDocIds,
    };

    console.log(`[INTENT_CLASSIFIER] ${message.slice(0, 50)}... => ${questionType}, ${domain}, ${scope}`);

    return classification;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

const intentClassifierService = new IntentClassifierService();
export default intentClassifierService;
export { IntentClassifierService };
