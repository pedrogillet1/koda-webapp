/**
 * RAG Helper Functions
 *
 * Additional helper functions for RAG system improvements:
 * - Inline citation injection
 * - Answer completeness check
 * - General knowledge detection
 */

import { createInlineDocumentMarker } from '../utils/inlineDocumentInjector';

// ============================================================================
// INLINE CITATION INJECTION
// ============================================================================

/**
 * Inject inline document markers into RAG answer text
 * Creates clickable citation buttons in the frontend
 */
export function injectInlineCitations(
  sources: Array<{ documentId: string; documentName: string; mimeType?: string; pageNumber?: number }>,
  onChunk: (chunk: string) => void,
  maxSources: number = 5
): void {
  if (!sources || sources.length === 0 || !onChunk) return;

  try {
    const topSources = sources.slice(0, maxSources);
    const markers = topSources.map(src => {
      return createInlineDocumentMarker({
        documentId: src.documentId,
        filename: src.documentName,
        mimeType: src.mimeType || 'application/pdf',
        fileSize: undefined,
        folderPath: undefined
      });
    }).join('\n');

    const citationSection = '\n\n**Sources:**\n\n' + markers;
    onChunk(citationSection);
    console.log(`✅ [INLINE CITATIONS] Injected ${topSources.length} inline document markers`);
  } catch (error) {
    console.error('[INLINE CITATIONS] Error injecting markers:', error);
  }
}

// ============================================================================
// ANSWER QUALITY CHECK
// ============================================================================

export interface QualityCheckResult {
  isComplete: boolean;
  issues: string[];
}

/**
 * Check if answer has incomplete values or blank data
 */
export function checkAnswerCompleteness(answer: string, query: string): QualityCheckResult {
  const issues: string[] = [];

  // Check for very short answers to complex questions
  const answerLength = answer.trim().length;
  const queryLength = query.length;

  if (queryLength > 50 && answerLength < 50) {
    issues.push(`Answer too short (${answerLength} chars) for complex query (${queryLength} chars)`);
  }

  // Check for blank R$ values (common in Portuguese financial documents)
  if (answer.includes('R$') && !answer.match(/R\$\s*[\d.,]+/)) {
    issues.push('Found R$ without a number value');
  }

  // Check for incomplete bullet points (bullet with no content after)
  const bulletPattern = /^[•\-\*]\s*$/gm;
  const emptyBullets = answer.match(bulletPattern);
  if (emptyBullets && emptyBullets.length > 0) {
    issues.push(`Found ${emptyBullets.length} empty bullet points`);
  }

  if (issues.length > 0) {
    console.log('[QUALITY CHECK] Answer issues found:', issues);
  }

  return {
    isComplete: issues.length === 0,
    issues
  };
}

// ============================================================================
// GENERAL KNOWLEDGE DETECTION
// ============================================================================

/**
 * Detect if query is a general knowledge question (not document-specific)
 */
export function detectGeneralKnowledgeQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Patterns for general knowledge questions
  const generalPatterns = [
    /^o que [eé] /i,                    // "O que é LGPD?"
    /^what is /i,                       // "What is LGPD?"
    /^define /i,                        // "Define LGPD"
    /^explain /i,                       // "Explain LGPD"
    /^tell me about /i,                 // "Tell me about LGPD"
    /^what does .+ mean/i,              // "What does X mean?"
    /^how does .+ work/i,               // "How does X work?"
    /^what are the benefits of/i,       // "What are the benefits of..."
    /^quais são os benefícios/i,        // Portuguese version
    /^como funciona/i,                  // "Como funciona..."
  ];

  // Check if query matches general knowledge patterns
  const isGeneral = generalPatterns.some(pattern => pattern.test(lowerQuery));

  // Also check if query doesn't mention any document-like terms
  const documentTerms = [
    'documento', 'document', 'arquivo', 'file', 'pdf',
    'planilha', 'spreadsheet', 'relatório', 'report',
    '.pdf', '.xlsx', '.docx', '.pptx'
  ];

  const mentionsDocument = documentTerms.some(term => lowerQuery.includes(term));

  return isGeneral && !mentionsDocument;
}

/**
 * Generate offer to explain general knowledge topic
 */
export function generateGeneralKnowledgeOffer(query: string, language: 'en' | 'pt' | 'es'): string {
  // Extract the topic from the query
  const topic = query
    .replace(/^(o que [eé]|what is|define|explain|tell me about)\s*/i, '')
    .replace(/\?$/, '')
    .trim();

  if (language === 'pt') {
    return `Não encontrei informações sobre "${topic}" nos seus documentos.

Este parece ser um conceito geral. Deseja que eu explique o que é ${topic}?

Alternativamente, você pode:
• Carregar um documento que contenha informações sobre ${topic}
• Fazer uma pergunta sobre seus documentos existentes`;
  }

  if (language === 'es') {
    return `No encontré información sobre "${topic}" en tus documentos.

Esto parece ser un concepto general. ¿Quieres que te explique qué es ${topic}?

Alternativamente, puedes:
• Cargar un documento que contenga información sobre ${topic}
• Hacer una pregunta sobre tus documentos existentes`;
  }

  return `I couldn't find information about "${topic}" in your documents.

This seems to be a general concept. Would you like me to explain what ${topic} is?

Alternatively, you can:
• Upload a document that contains information about ${topic}
• Ask a question about your existing documents`;
}

export default {
  injectInlineCitations,
  checkAnswerCompleteness,
  detectGeneralKnowledgeQuery,
  generateGeneralKnowledgeOffer
};
