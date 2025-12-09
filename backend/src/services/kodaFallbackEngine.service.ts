/**
 * ============================================================================
 * KODA FALLBACK ENGINE - UNIFIED ERROR RECOVERY
 * ============================================================================
 *
 * This service consolidates ALL fallback logic.
 *
 * CONSOLIDATES:
 * - fallbackDetection.service.ts
 * - fallbackResponse.service.ts
 * - fallbackStrategy.service.ts
 * - gracefulDegradation.service.ts
 * - psychologicalSafety.service.ts
 *
 * RESPONSIBILITIES:
 * 1. Empty answer prevention
 * 2. Low confidence fallback
 * 3. Missing document recovery
 * 4. Clarification fallback
 * 5. Partial answer reconstruction
 * 6. Persona-safe fallback
 *
 * @version 2.0.0
 * @date 2025-12-08
 */

export interface FallbackOptions {
  error?: Error;
  query: string;
  language: string;
  context?: any;
  errorType?: 'empty' | 'timeout' | 'api_error' | 'no_documents' | 'general';
}

export interface FallbackResult {
  message: string;
  type: 'empty' | 'error' | 'clarification' | 'partial' | 'no_documents';
  suggestedAction?: string;
}

// Fallback messages by language
const FALLBACK_MESSAGES: Record<string, Record<string, string>> = {
  'pt': {
    empty: 'Desculpe, não encontrei informações suficientes nos seus documentos para responder essa pergunta. Poderia reformulá-la ou especificar qual documento devo consultar?',
    timeout: 'A consulta demorou mais do que o esperado. Por favor, tente novamente ou simplifique sua pergunta.',
    api_error: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente em alguns instantes.',
    no_documents: 'Você ainda não tem documentos carregados. Faça o upload de alguns documentos para que eu possa ajudá-lo a encontrar informações.',
    general: 'Desculpe, não consegui processar sua solicitação. Por favor, tente novamente.',
    clarification: 'Não entendi completamente sua pergunta. Poderia fornecer mais detalhes ou reformulá-la?',
  },
  'en': {
    empty: 'Sorry, I could not find enough information in your documents to answer this question. Could you rephrase it or specify which document I should consult?',
    timeout: 'The query took longer than expected. Please try again or simplify your question.',
    api_error: 'An error occurred while processing your request. Please try again in a moment.',
    no_documents: 'You don\'t have any documents uploaded yet. Upload some documents so I can help you find information.',
    general: 'Sorry, I couldn\'t process your request. Please try again.',
    clarification: 'I didn\'t fully understand your question. Could you provide more details or rephrase it?',
  },
};

/**
 * Generate appropriate fallback response
 */
export function generateFallback(options: FallbackOptions): FallbackResult {
  const { error, query, language, context, errorType } = options;

  const langKey = language.startsWith('pt') ? 'pt' : 'en';
  const messages = FALLBACK_MESSAGES[langKey];

  // Determine error type if not provided
  let type: FallbackResult['type'] = 'error';
  let messageKey = 'general';

  if (errorType) {
    messageKey = errorType;
    type = errorType === 'no_documents' ? 'no_documents' : errorType === 'empty' ? 'empty' : 'error';
  } else if (error) {
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      messageKey = 'timeout';
    } else if (error.message.includes('429') || error.message.includes('rate limit')) {
      messageKey = 'api_error';
    } else if (error.message.includes('no documents') || error.message.includes('sem documentos')) {
      messageKey = 'no_documents';
      type = 'no_documents';
    }
  } else {
    // No error means empty response
    messageKey = 'empty';
    type = 'empty';
  }

  return {
    message: messages[messageKey] || messages.general,
    type,
    suggestedAction: getSuggestedAction(type, langKey),
  };
}

/**
 * Get suggested action for the error type
 */
function getSuggestedAction(type: FallbackResult['type'], language: string): string {
  const actions: Record<string, Record<string, string>> = {
    'pt': {
      empty: 'Tente ser mais específico ou mencione o nome do documento.',
      error: 'Aguarde alguns segundos e tente novamente.',
      clarification: 'Forneça mais contexto ou detalhes.',
      no_documents: 'Clique no botão de upload para adicionar documentos.',
      partial: 'A resposta pode estar incompleta. Tente refinar sua pergunta.',
    },
    'en': {
      empty: 'Try being more specific or mention the document name.',
      error: 'Wait a few seconds and try again.',
      clarification: 'Provide more context or details.',
      no_documents: 'Click the upload button to add documents.',
      partial: 'The response may be incomplete. Try refining your question.',
    },
  };

  return actions[language]?.[type] || actions['en'][type] || '';
}

/**
 * Check if a response needs fallback
 */
export function needsFallback(response: string | null | undefined): boolean {
  if (!response) return true;
  if (response.trim().length < 10) return true;
  if (response.includes('I cannot') && response.includes('sorry')) return true;
  if (response.includes('não consigo') && response.includes('desculpe')) return true;
  return false;
}

/**
 * Generate a clarification request when the query is ambiguous
 */
export function generateClarificationRequest(query: string, language: string, ambiguousTerms: string[]): FallbackResult {
  const langKey = language.startsWith('pt') ? 'pt' : 'en';

  let message = '';
  if (langKey === 'pt') {
    message = `Sua pergunta menciona "${ambiguousTerms.join('", "')}" que pode ter múltiplos significados. Poderia especificar a qual você se refere?`;
  } else {
    message = `Your question mentions "${ambiguousTerms.join('", "')}" which could have multiple meanings. Could you specify which one you're referring to?`;
  }

  return {
    message,
    type: 'clarification',
    suggestedAction: langKey === 'pt' ? 'Seja mais específico.' : 'Be more specific.',
  };
}

/**
 * Generate a response when no documents match the query
 */
export function generateNoMatchResponse(query: string, language: string, availableDocuments: string[]): FallbackResult {
  const langKey = language.startsWith('pt') ? 'pt' : 'en';

  let message = '';
  if (availableDocuments.length > 0) {
    if (langKey === 'pt') {
      message = `Não encontrei informações sobre "${query.slice(0, 50)}" nos seus documentos. Seus documentos disponíveis são:\n\n${availableDocuments.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nDeseja que eu procure em algum específico?`;
    } else {
      message = `I couldn't find information about "${query.slice(0, 50)}" in your documents. Your available documents are:\n\n${availableDocuments.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nWould you like me to search in a specific one?`;
    }
  } else {
    message = FALLBACK_MESSAGES[langKey].no_documents;
  }

  return {
    message,
    type: 'empty',
    suggestedAction: langKey === 'pt' ? 'Especifique o documento desejado.' : 'Specify the desired document.',
  };
}

export default {
  generateFallback,
  needsFallback,
  generateClarificationRequest,
  generateNoMatchResponse,
};
