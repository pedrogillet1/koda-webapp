/**
 * Empty Response Prevention Service
 * CRITICAL: Prevents "sources only" bug where LLM generates title + sources but no content
 *
 * This replaces the stub in deletedServiceStubs.ts that always returned isValid: true
 */

export interface ResponseValidation {
  isValid: boolean;
  issues: string[];
  reason?: string;
  suggestions?: string[];
  score?: number;
}

interface ValidationContext {
  query?: string;
  intent?: string;
  hasDocuments?: boolean;
  documentCount?: number;
}

interface ValidationOptions {
  answerLength?: 'short' | 'medium' | 'long' | 'detailed';
}

/**
 * Validates that a response has actual content and not just structural elements
 */
export function validateResponse(
  response: string,
  context: ValidationContext = {},
  options: ValidationOptions = {}
): ResponseValidation {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!response || typeof response !== 'string') {
    return {
      isValid: false,
      issues: ['Response is empty or invalid'],
      reason: 'No response provided',
      suggestions: ['Regenerate the response'],
      score: 0
    };
  }

  const trimmedResponse = response.trim();

  // Check 1: Minimum length check
  const minLengthByType: Record<string, number> = {
    short: 50,
    medium: 150,
    long: 300,
    detailed: 500
  };
  const minLength = minLengthByType[options.answerLength || 'medium'] || 150;

  if (trimmedResponse.length < minLength) {
    issues.push(`Response too short (${trimmedResponse.length} chars, expected ${minLength}+)`);
    score -= 30;
  }

  // Check 2: Has only title/header with no content
  const lines = trimmedResponse.split('\n').filter(line => line.trim());
  const titlePattern = /^#+\s+|^\*\*[^*]+\*\*$|^#{1,3}\s/;
  const sourcePattern = /^(source|fonte|fuente|📄|📁|🔗|\[.*\]\(.*\))/i;

  let titleLines = 0;
  let contentLines = 0;
  let sourceLines = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (titlePattern.test(trimmedLine)) {
      titleLines++;
    } else if (sourcePattern.test(trimmedLine) || trimmedLine.startsWith('---')) {
      sourceLines++;
    } else if (trimmedLine.length > 20) {
      contentLines++;
    }
  }

  // Check 3: "Sources only" detection - the critical bug
  if (contentLines === 0 && (titleLines > 0 || sourceLines > 0)) {
    issues.push('Response contains only title/sources with no actual content');
    suggestions.push('Response needs substantive content explaining the topic');
    score -= 50;
  }

  // Check 4: Content-to-structure ratio
  const structureLines = titleLines + sourceLines;
  const totalLines = lines.length;
  if (totalLines > 3 && contentLines < structureLines) {
    issues.push('Response has more structure than content');
    score -= 20;
  }

  // Check 5: Truncation detection
  const truncationPatterns = [
    /\.{3,}$/,           // Ends with ...
    /[^.!?]$/,           // Doesn't end with punctuation
    /\b(and|e|y|ou|or)$/i, // Ends with conjunction
    /,$/,                 // Ends with comma
    /\b\w+$/              // Ends with incomplete word after truncation
  ];

  const lastLine = lines[lines.length - 1]?.trim() || '';
  const seemsTruncated = truncationPatterns.some(p => p.test(lastLine)) &&
                         !lastLine.endsWith('.') &&
                         !lastLine.endsWith('!') &&
                         !lastLine.endsWith('?') &&
                         !lastLine.endsWith(':') &&
                         lastLine.length > 10;

  if (seemsTruncated && trimmedResponse.length > 200) {
    issues.push('Response appears truncated');
    suggestions.push('Increase token limit or check for generation cutoff');
    score -= 15;
  }

  // Check 6: Repetitive content detection
  const sentences = trimmedResponse.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
  if (sentences.length > 3 && uniqueSentences.size < sentences.length * 0.7) {
    issues.push('Response contains repetitive content');
    score -= 10;
  }

  // Check 7: Access denial detection (backup check)
  const accessDenialPatterns = [
    /i do not have access/i,
    /cannot access your/i,
    /don't have access/i,
    /no tengo acceso/i,
    /nao tenho acesso/i
  ];

  if (accessDenialPatterns.some(p => p.test(trimmedResponse))) {
    issues.push('Response incorrectly claims no access to documents');
    suggestions.push('Check document retrieval pipeline');
    score -= 40;
  }

  // Check 8: Document-based query validation
  if (context.hasDocuments && context.documentCount && context.documentCount > 0) {
    // If we have documents, response should reference them
    const hasDocumentReference = /document|arquivo|documento|file|pdf|excel|word/i.test(trimmedResponse);
    const hasFactualContent = trimmedResponse.length > 200 && contentLines >= 2;

    if (!hasDocumentReference && !hasFactualContent) {
      issues.push('Response does not appear to use provided document context');
      score -= 15;
    }
  }

  // Determine final validity
  const isValid = score >= 50 && !issues.some(i =>
    i.includes('only title/sources') ||
    i.includes('claims no access')
  );

  return {
    isValid,
    issues,
    reason: issues.length > 0 ? issues[0] : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    score: Math.max(0, score)
  };
}

/**
 * Quick check if response needs regeneration
 */
export function needsRegeneration(response: string, context: ValidationContext = {}): boolean {
  const validation = validateResponse(response, context);
  return !validation.isValid || (validation.score !== undefined && validation.score < 40);
}

/**
 * Chunk quality validation result
 */
interface ChunkValidation {
  isValid: boolean;
  score: number;
  reason?: string;
}

/**
 * Validates retrieved chunks for quality before answer generation
 */
export function validateChunks(chunks: any[], query: string): ChunkValidation {
  if (!chunks || chunks.length === 0) {
    return {
      isValid: false,
      score: 0,
      reason: 'No chunks retrieved'
    };
  }

  let score = 1.0;
  const reasons: string[] = [];

  // Check 1: Minimum chunk count
  if (chunks.length < 2) {
    score -= 0.2;
    reasons.push('Too few chunks');
  }

  // Check 2: Chunk relevance (using Pinecone scores if available)
  const avgScore = chunks.reduce((sum, c) => {
    const chunkScore = c.score || c.metadata?.score || 0.5;
    return sum + chunkScore;
  }, 0) / chunks.length;

  if (avgScore < 0.3) {
    score -= 0.3;
    reasons.push('Low relevance scores');
  }

  // Check 3: Check if chunks have content
  const chunksWithContent = chunks.filter(c => {
    const content = c.text || c.content || c.pageContent || '';
    return content.trim().length > 50;
  });

  if (chunksWithContent.length < chunks.length * 0.5) {
    score -= 0.2;
    reasons.push('Many chunks have insufficient content');
  }

  // Check 4: Query term presence in chunks
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  if (queryTerms.length > 0) {
    const chunksWithQueryTerms = chunks.filter(c => {
      const content = (c.text || c.content || c.pageContent || '').toLowerCase();
      return queryTerms.some(term => content.includes(term));
    });

    if (chunksWithQueryTerms.length < chunks.length * 0.3) {
      score -= 0.15;
      reasons.push('Query terms not found in most chunks');
    }
  }

  return {
    isValid: score >= 0.5,
    score: Math.max(0, score),
    reason: reasons.length > 0 ? reasons.join('; ') : undefined
  };
}

/**
 * Returns a context-aware fallback response when generation fails
 */
export function getFallbackResponse(context: any, lang: string): string {
  const hasDocuments = context?.hasDocuments || context?.documentCount > 0;

  const messages: Record<string, { withDocs: string; withoutDocs: string }> = {
    pt: {
      withDocs: 'Desculpe, não consegui processar sua pergunta sobre os documentos. Por favor, tente reformular sua pergunta ou seja mais específico sobre qual informação você procura.',
      withoutDocs: 'Desculpe, não consegui gerar uma resposta. Por favor, tente reformular sua pergunta.'
    },
    es: {
      withDocs: 'Lo siento, no pude procesar tu pregunta sobre los documentos. Por favor, intenta reformular tu pregunta o sé más específico sobre qué información buscas.',
      withoutDocs: 'Lo siento, no pude generar una respuesta. Por favor, intenta reformular tu pregunta.'
    },
    en: {
      withDocs: 'Sorry, I couldn\'t process your question about the documents. Please try rephrasing your question or be more specific about what information you\'re looking for.',
      withoutDocs: 'Sorry, I couldn\'t generate a response. Please try rephrasing your question.'
    }
  };

  const langMessages = messages[lang] || messages.en;
  return hasDocuments ? langMessages.withDocs : langMessages.withoutDocs;
}

/**
 * Export as object for compatibility with existing imports
 */
export const emptyResponsePrevention = {
  validateResponse,
  needsRegeneration,
  validateChunks,
  getFallbackResponse
};

export default emptyResponsePrevention;
