/**
 * Fallback Engine Service
 *
 * Generates appropriate fallback responses when:
 * - No documents are found
 * - Intent cannot be determined
 * - Errors occur during processing
 */

import { SupportedLanguage } from './languageDetector.service';

export interface FallbackParams {
  intent: string;
  query: string;
  language: SupportedLanguage;
  reason: 'no_documents' | 'no_results' | 'error' | 'low_confidence' | 'empty_workspace';
  errorMessage?: string;
}

export interface FallbackResponse {
  answer: string;
  isFallback: true;
  reason: string;
  suggestions?: string[];
}

class FallbackEngineService {
  private readonly fallbackMessages: Record<string, Record<SupportedLanguage, string>> = {
    no_documents: {
      en: "I don't have any documents in your workspace yet. Please upload some documents first so I can help you find information.",
      pt: "Ainda não tenho documentos no seu workspace. Por favor, envie alguns documentos primeiro para que eu possa ajudá-lo a encontrar informações.",
      es: "Aún no tengo documentos en tu espacio de trabajo. Por favor, sube algunos documentos primero para que pueda ayudarte a encontrar información.",
    },
    no_results: {
      en: "I couldn't find any relevant information for your question in the available documents. Try rephrasing your question or be more specific.",
      pt: "Não consegui encontrar informações relevantes para sua pergunta nos documentos disponíveis. Tente reformular sua pergunta ou seja mais específico.",
      es: "No pude encontrar información relevante para tu pregunta en los documentos disponibles. Intenta reformular tu pregunta o sé más específico.",
    },
    error: {
      en: "I encountered an error while processing your request. Please try again in a moment.",
      pt: "Encontrei um erro ao processar sua solicitação. Por favor, tente novamente em um momento.",
      es: "Encontré un error al procesar tu solicitud. Por favor, inténtalo de nuevo en un momento.",
    },
    low_confidence: {
      en: "I'm not sure I understood your question correctly. Could you please rephrase it or provide more context?",
      pt: "Não tenho certeza se entendi sua pergunta corretamente. Você poderia reformulá-la ou fornecer mais contexto?",
      es: "No estoy seguro de haber entendido tu pregunta correctamente. ¿Podrías reformularla o proporcionar más contexto?",
    },
    empty_workspace: {
      en: "Your workspace is empty. Start by uploading documents using the upload button, then ask me questions about them!",
      pt: "Seu workspace está vazio. Comece enviando documentos usando o botão de upload, depois me faça perguntas sobre eles!",
      es: "Tu espacio de trabajo está vacío. ¡Comienza subiendo documentos usando el botón de subida, luego hazme preguntas sobre ellos!",
    },
  };

  private readonly suggestions: Record<string, Record<SupportedLanguage, string[]>> = {
    no_documents: {
      en: ['Upload a document', 'Learn how to use Koda', 'What can you do?'],
      pt: ['Enviar um documento', 'Aprender a usar o Koda', 'O que você pode fazer?'],
      es: ['Subir un documento', 'Aprender a usar Koda', '¿Qué puedes hacer?'],
    },
    empty_workspace: {
      en: ['How do I upload files?', 'What file types are supported?', 'Show me a demo'],
      pt: ['Como envio arquivos?', 'Quais tipos de arquivo são suportados?', 'Mostre-me uma demonstração'],
      es: ['¿Cómo subo archivos?', '¿Qué tipos de archivo se admiten?', 'Muéstrame una demostración'],
    },
  };

  /**
   * Generate a fallback response based on the reason and context.
   */
  public generate(params: FallbackParams): FallbackResponse {
    const { language, reason, errorMessage } = params;

    // Get base message
    let message = this.fallbackMessages[reason]?.[language]
      || this.fallbackMessages[reason]?.['en']
      || this.fallbackMessages.error[language];

    // Append error details if available and safe
    if (reason === 'error' && errorMessage && !this.containsSensitiveInfo(errorMessage)) {
      const detailPrefix = language === 'pt' ? 'Detalhes: ' : language === 'es' ? 'Detalles: ' : 'Details: ';
      message += ` ${detailPrefix}${errorMessage}`;
    }

    // Get suggestions if available
    const suggestionList = this.suggestions[reason]?.[language];

    return {
      answer: message,
      isFallback: true,
      reason,
      suggestions: suggestionList,
    };
  }

  /**
   * Check if error message contains sensitive information.
   */
  private containsSensitiveInfo(message: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /credential/i,
      /auth/i,
    ];
    return sensitivePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Generate a greeting response.
   */
  public generateGreeting(language: SupportedLanguage, hasDocuments: boolean): FallbackResponse {
    const greetings: Record<SupportedLanguage, string> = {
      en: hasDocuments
        ? "Hello! I'm Koda, your document assistant. I can help you find information in your documents. What would you like to know?"
        : "Hello! I'm Koda, your document assistant. Upload some documents and I'll help you find information in them!",
      pt: hasDocuments
        ? "Olá! Sou o Koda, seu assistente de documentos. Posso ajudá-lo a encontrar informações nos seus documentos. O que você gostaria de saber?"
        : "Olá! Sou o Koda, seu assistente de documentos. Envie alguns documentos e eu ajudarei você a encontrar informações neles!",
      es: hasDocuments
        ? "¡Hola! Soy Koda, tu asistente de documentos. Puedo ayudarte a encontrar información en tus documentos. ¿Qué te gustaría saber?"
        : "¡Hola! Soy Koda, tu asistente de documentos. ¡Sube algunos documentos y te ayudaré a encontrar información en ellos!",
    };

    return {
      answer: greetings[language],
      isFallback: true,
      reason: 'greeting',
    };
  }
}

export const fallbackEngineService = new FallbackEngineService();
export default fallbackEngineService;
