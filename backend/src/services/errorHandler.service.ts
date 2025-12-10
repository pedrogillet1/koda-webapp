/**
 * Error Handler Service
 *
 * Provides instant, template-based error responses with NO LLM calls.
 * Part of the fast-path optimization strategy for < 2 second error responses.
 *
 * Error Types:
 * - noDocuments: User has no uploaded documents
 * - documentNotFound: Specific document not found
 * - ambiguousQuery: Query too vague to process
 * - unsupportedAction: Action not supported
 * - processingError: General processing failure
 * - outOfScope: Question outside document scope
 * - rateLimitExceeded: Too many requests
 * - general: Catch-all error
 *
 * @version 1.0.0
 * Performance target: < 5ms (template lookup, no LLM)
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

export type ErrorType =
  | 'noDocuments'
  | 'documentNotFound'
  | 'ambiguousQuery'
  | 'unsupportedAction'
  | 'processingError'
  | 'outOfScope'
  | 'rateLimitExceeded'
  | 'connectionError'
  | 'timeout'
  | 'invalidInput'
  | 'general';

export type SupportedLanguage = 'en' | 'pt' | 'es';

export interface ErrorContext {
  errorType: ErrorType;
  language?: SupportedLanguage;
  documentName?: string;
  documentCount?: number;
  query?: string;
  actionName?: string;
  retryInSeconds?: number;
}

export interface FormattedError {
  message: string;
  suggestions?: string[];
  errorType: ErrorType;
  recoverable: boolean;
}

// ============================================================================
// ERROR TEMPLATES - Multi-language, NO LLM needed
// ============================================================================

const ERROR_TEMPLATES: Record<ErrorType, Record<SupportedLanguage, string[]>> = {
  noDocuments: {
    en: [
      "I don't have any documents to search through yet. Upload some files and I'll be ready to help! 📄",
      "Looks like you haven't uploaded any documents yet. Once you do, I can help answer your questions!",
      "No documents here yet! Upload your files and I'll be able to answer questions about them.",
      "I'd love to help, but there aren't any documents in your workspace yet. Upload some files and let's get started!",
    ],
    pt: [
      "Ainda não tenho nenhum documento para pesquisar. Faça upload de alguns arquivos e poderei ajudar! 📄",
      "Parece que você ainda não fez upload de nenhum documento. Envie seus arquivos e vamos começar!",
      "Nenhum documento aqui ainda! Faça upload e poderei responder suas perguntas.",
      "Adoraria ajudar, mas não há documentos no seu workspace ainda. Faça upload e começamos!",
    ],
    es: [
      "Todavía no tengo documentos para buscar. ¡Sube algunos archivos y podré ayudarte! 📄",
      "Parece que aún no has subido ningún documento. ¡Envía tus archivos y empezamos!",
      "¡No hay documentos aquí todavía! Sube tus archivos y podré responder tus preguntas.",
      "Me encantaría ayudar, pero no hay documentos en tu espacio todavía. ¡Sube algunos y comenzamos!",
    ],
  },

  documentNotFound: {
    en: [
      "I couldn't find that document. Could you check the name and try again?",
      "That document doesn't seem to exist in your workspace. Maybe it was renamed or deleted?",
      "I'm not seeing that file. Want to try a different name, or upload it if it's missing?",
      "Document not found. You can use 'list my files' to see what's available.",
    ],
    pt: [
      "Não consegui encontrar esse documento. Pode verificar o nome e tentar novamente?",
      "Esse documento não parece existir no seu workspace. Talvez foi renomeado ou deletado?",
      "Não estou vendo esse arquivo. Quer tentar outro nome, ou fazer upload se estiver faltando?",
      "Documento não encontrado. Use 'listar meus arquivos' para ver o que está disponível.",
    ],
    es: [
      "No pude encontrar ese documento. ¿Puedes verificar el nombre e intentar de nuevo?",
      "Ese documento no parece existir en tu espacio. ¿Tal vez fue renombrado o eliminado?",
      "No veo ese archivo. ¿Quieres probar otro nombre, o subirlo si falta?",
      "Documento no encontrado. Usa 'listar mis archivos' para ver qué está disponible.",
    ],
  },

  ambiguousQuery: {
    en: [
      "I'm not sure what you're looking for. Could you be more specific?",
      "That's a bit vague. Can you add more details or mention a specific document?",
      "I'd like to help, but I need a bit more context. What exactly are you looking for?",
      "Could you rephrase that? I'm not quite sure what information you need.",
    ],
    pt: [
      "Não tenho certeza do que você está procurando. Pode ser mais específico?",
      "Isso está um pouco vago. Pode adicionar mais detalhes ou mencionar um documento específico?",
      "Gostaria de ajudar, mas preciso de mais contexto. O que exatamente você está procurando?",
      "Pode reformular? Não tenho certeza de qual informação você precisa.",
    ],
    es: [
      "No estoy seguro de lo que estás buscando. ¿Puedes ser más específico?",
      "Eso es un poco vago. ¿Puedes agregar más detalles o mencionar un documento específico?",
      "Me gustaría ayudar, pero necesito más contexto. ¿Qué exactamente estás buscando?",
      "¿Puedes reformular? No estoy seguro de qué información necesitas.",
    ],
  },

  unsupportedAction: {
    en: [
      "I can't do that action right now. Try asking me to search, summarize, or answer questions about your documents.",
      "That's not something I can help with. I'm best at answering questions about your uploaded documents!",
      "I don't support that action. But I can search your documents, create summaries, and answer questions!",
      "Not sure how to do that. Want me to help you find information in your documents instead?",
    ],
    pt: [
      "Não consigo fazer essa ação agora. Tente me pedir para buscar, resumir ou responder perguntas sobre seus documentos.",
      "Isso não é algo com que posso ajudar. Sou melhor em responder perguntas sobre seus documentos enviados!",
      "Não suporto essa ação. Mas posso buscar em seus documentos, criar resumos e responder perguntas!",
      "Não sei como fazer isso. Quer que eu ajude a encontrar informações nos seus documentos?",
    ],
    es: [
      "No puedo hacer esa acción ahora. Intenta pedirme buscar, resumir o responder preguntas sobre tus documentos.",
      "Eso no es algo con lo que pueda ayudar. ¡Soy mejor respondiendo preguntas sobre tus documentos subidos!",
      "No soporto esa acción. ¡Pero puedo buscar en tus documentos, crear resúmenes y responder preguntas!",
      "No sé cómo hacer eso. ¿Quieres que te ayude a encontrar información en tus documentos?",
    ],
  },

  processingError: {
    en: [
      "Something went wrong on my end. Please try again in a few seconds.",
      "Oops! I ran into an unexpected issue. Could you try that again?",
      "Sorry, something didn't work as expected. Want to give it another shot?",
      "I hit a snag trying to process that. Mind trying again?",
    ],
    pt: [
      "Algo deu errado do meu lado. Por favor, tente novamente em alguns segundos.",
      "Ops! Encontrei um problema inesperado. Pode tentar novamente?",
      "Desculpe, algo não funcionou como esperado. Quer tentar de novo?",
      "Tive um problema ao processar isso. Pode tentar novamente?",
    ],
    es: [
      "Algo salió mal de mi lado. Por favor, intenta de nuevo en unos segundos.",
      "¡Ups! Encontré un problema inesperado. ¿Puedes intentar de nuevo?",
      "Lo siento, algo no funcionó como esperaba. ¿Quieres intentar otra vez?",
      "Tuve un problema al procesar eso. ¿Puedes intentar de nuevo?",
    ],
  },

  outOfScope: {
    en: [
      "That information doesn't seem to be in your documents. I can only answer based on what you've uploaded.",
      "I didn't find that in your documents. My knowledge is limited to your uploaded files.",
      "I can't find that info—it might not be in your documents. Try uploading relevant files!",
      "That's outside what I can see in your documents. Want to upload a file that might have this info?",
    ],
    pt: [
      "Essa informação não parece estar nos seus documentos. Só posso responder com base no que você enviou.",
      "Não encontrei isso nos seus documentos. Meu conhecimento é limitado aos seus arquivos enviados.",
      "Não consegui achar essa info—pode não estar nos seus documentos. Tente enviar arquivos relevantes!",
      "Isso está fora do que posso ver nos seus documentos. Quer enviar um arquivo que tenha essa info?",
    ],
    es: [
      "Esa información no parece estar en tus documentos. Solo puedo responder basándome en lo que has subido.",
      "No encontré eso en tus documentos. Mi conocimiento está limitado a tus archivos subidos.",
      "No puedo encontrar esa info—puede no estar en tus documentos. ¡Intenta subir archivos relevantes!",
      "Eso está fuera de lo que puedo ver en tus documentos. ¿Quieres subir un archivo que tenga esta info?",
    ],
  },

  rateLimitExceeded: {
    en: [
      "You're sending questions faster than I can keep up! Give me a moment, then try again.",
      "Whoa, that's a lot of requests! Wait a few seconds and try again.",
      "I need a moment to catch up. Please wait a bit before sending another question.",
      "Too many questions at once! Take a breather and try again in a few seconds.",
    ],
    pt: [
      "Você está enviando perguntas mais rápido do que consigo acompanhar! Aguarde um momento e tente novamente.",
      "Muitas solicitações de uma vez! Espere alguns segundos e tente de novo.",
      "Preciso de um momento para processar. Aguarde um pouco antes de enviar outra pergunta.",
      "Muitas perguntas de uma vez! Respire e tente novamente em alguns segundos.",
    ],
    es: [
      "¡Estás enviando preguntas más rápido de lo que puedo seguir! Dame un momento, luego intenta de nuevo.",
      "¡Muchas solicitudes a la vez! Espera unos segundos e intenta de nuevo.",
      "Necesito un momento para ponerme al día. Por favor espera un poco antes de enviar otra pregunta.",
      "¡Demasiadas preguntas a la vez! Respira e intenta de nuevo en unos segundos.",
    ],
  },

  connectionError: {
    en: [
      "I'm having trouble connecting to the service. Please check your connection and try again.",
      "Connection issue detected. Give it a moment and try again.",
      "Seems like there's a network problem. Try again in a few seconds.",
    ],
    pt: [
      "Estou tendo problemas de conexão com o serviço. Verifique sua conexão e tente novamente.",
      "Problema de conexão detectado. Aguarde um momento e tente novamente.",
      "Parece haver um problema de rede. Tente novamente em alguns segundos.",
    ],
    es: [
      "Tengo problemas para conectarme al servicio. Por favor verifica tu conexión e intenta de nuevo.",
      "Problema de conexión detectado. Espera un momento e intenta de nuevo.",
      "Parece que hay un problema de red. Intenta de nuevo en unos segundos.",
    ],
  },

  timeout: {
    en: [
      "That took too long to process. Try a simpler question or break it into smaller parts.",
      "Request timed out. The query might be too complex—try simplifying it.",
      "I ran out of time processing that. Could you try a shorter or more focused question?",
    ],
    pt: [
      "Isso demorou muito para processar. Tente uma pergunta mais simples ou divida em partes menores.",
      "A solicitação expirou. A pergunta pode ser muito complexa—tente simplificá-la.",
      "Fiquei sem tempo processando isso. Pode tentar uma pergunta mais curta ou focada?",
    ],
    es: [
      "Eso tardó demasiado en procesar. Intenta una pregunta más simple o divídela en partes más pequeñas.",
      "La solicitud expiró. La consulta puede ser muy compleja—intenta simplificarla.",
      "Me quedé sin tiempo procesando eso. ¿Puedes intentar una pregunta más corta o enfocada?",
    ],
  },

  invalidInput: {
    en: [
      "I couldn't understand that input. Could you rephrase your question?",
      "That input doesn't look quite right. Try rephrasing it.",
      "I'm having trouble understanding that. Could you say it differently?",
    ],
    pt: [
      "Não consegui entender essa entrada. Pode reformular sua pergunta?",
      "Essa entrada não parece correta. Tente reformulá-la.",
      "Estou tendo dificuldade em entender isso. Pode dizer de outra forma?",
    ],
    es: [
      "No pude entender esa entrada. ¿Puedes reformular tu pregunta?",
      "Esa entrada no parece correcta. Intenta reformularla.",
      "Tengo problemas para entender eso. ¿Puedes decirlo de otra manera?",
    ],
  },

  general: {
    en: [
      "Something went wrong. Please try again.",
      "I encountered an issue. Could you try that again?",
      "Unexpected error occurred. Please try your request again.",
      "Oops! Something didn't work. Let's try again.",
    ],
    pt: [
      "Algo deu errado. Por favor, tente novamente.",
      "Encontrei um problema. Pode tentar de novo?",
      "Erro inesperado ocorreu. Por favor, tente sua solicitação novamente.",
      "Ops! Algo não funcionou. Vamos tentar de novo.",
    ],
    es: [
      "Algo salió mal. Por favor, intenta de nuevo.",
      "Encontré un problema. ¿Puedes intentar de nuevo?",
      "Ocurrió un error inesperado. Por favor, intenta tu solicitud de nuevo.",
      "¡Ups! Algo no funcionó. Intentemos de nuevo.",
    ],
  },
};

// ============================================================================
// SUGGESTION TEMPLATES
// ============================================================================

const SUGGESTIONS: Record<ErrorType, Record<SupportedLanguage, string[]>> = {
  noDocuments: {
    en: [
      "Click the attachment button to upload files",
      "Supported formats: PDF, Word, Excel, PowerPoint, images",
      "You can upload multiple files at once",
    ],
    pt: [
      "Clique no botão de anexo para enviar arquivos",
      "Formatos suportados: PDF, Word, Excel, PowerPoint, imagens",
      "Você pode enviar vários arquivos de uma vez",
    ],
    es: [
      "Haz clic en el botón de adjuntar para subir archivos",
      "Formatos soportados: PDF, Word, Excel, PowerPoint, imágenes",
      "Puedes subir varios archivos a la vez",
    ],
  },
  documentNotFound: {
    en: [
      "Try 'list my files' to see available documents",
      "Check if the filename is spelled correctly",
      "The file may have been moved or deleted",
    ],
    pt: [
      "Tente 'listar meus arquivos' para ver documentos disponíveis",
      "Verifique se o nome do arquivo está correto",
      "O arquivo pode ter sido movido ou deletado",
    ],
    es: [
      "Intenta 'listar mis archivos' para ver documentos disponibles",
      "Verifica si el nombre del archivo está bien escrito",
      "El archivo puede haber sido movido o eliminado",
    ],
  },
  ambiguousQuery: {
    en: [
      "Mention a specific document name",
      "Ask about a specific topic or section",
      "Try: 'What does [document] say about [topic]?'",
    ],
    pt: [
      "Mencione um documento específico",
      "Pergunte sobre um tópico ou seção específica",
      "Tente: 'O que [documento] diz sobre [tópico]?'",
    ],
    es: [
      "Menciona un documento específico",
      "Pregunta sobre un tema o sección específica",
      "Intenta: '¿Qué dice [documento] sobre [tema]?'",
    ],
  },
  unsupportedAction: {
    en: [
      "Try: 'Summarize my documents'",
      "Try: 'What are the key points in [document]?'",
      "Try: 'Search for [keyword] in my files'",
    ],
    pt: [
      "Tente: 'Resumir meus documentos'",
      "Tente: 'Quais são os pontos principais em [documento]?'",
      "Tente: 'Buscar [palavra-chave] nos meus arquivos'",
    ],
    es: [
      "Intenta: 'Resumir mis documentos'",
      "Intenta: '¿Cuáles son los puntos principales en [documento]?'",
      "Intenta: 'Buscar [palabra clave] en mis archivos'",
    ],
  },
  processingError: {
    en: ["Wait a few seconds and try again", "Try simplifying your question"],
    pt: ["Aguarde alguns segundos e tente novamente", "Tente simplificar sua pergunta"],
    es: ["Espera unos segundos e intenta de nuevo", "Intenta simplificar tu pregunta"],
  },
  outOfScope: {
    en: [
      "Upload documents containing this information",
      "Ask about topics in your existing documents",
    ],
    pt: [
      "Envie documentos contendo essa informação",
      "Pergunte sobre tópicos nos seus documentos existentes",
    ],
    es: [
      "Sube documentos que contengan esta información",
      "Pregunta sobre temas en tus documentos existentes",
    ],
  },
  rateLimitExceeded: {
    en: ["Wait 30 seconds before trying again"],
    pt: ["Aguarde 30 segundos antes de tentar novamente"],
    es: ["Espera 30 segundos antes de intentar de nuevo"],
  },
  connectionError: {
    en: ["Check your internet connection", "Refresh the page and try again"],
    pt: ["Verifique sua conexão com a internet", "Atualize a página e tente novamente"],
    es: ["Verifica tu conexión a internet", "Actualiza la página e intenta de nuevo"],
  },
  timeout: {
    en: ["Try a shorter or simpler question", "Break complex queries into smaller parts"],
    pt: ["Tente uma pergunta mais curta ou simples", "Divida consultas complexas em partes menores"],
    es: ["Intenta una pregunta más corta o simple", "Divide consultas complejas en partes más pequeñas"],
  },
  invalidInput: {
    en: ["Rephrase your question", "Check for special characters"],
    pt: ["Reformule sua pergunta", "Verifique caracteres especiais"],
    es: ["Reformula tu pregunta", "Verifica caracteres especiales"],
  },
  general: {
    en: ["Try again", "Refresh the page if the issue persists"],
    pt: ["Tente novamente", "Atualize a página se o problema persistir"],
    es: ["Intenta de nuevo", "Actualiza la página si el problema persiste"],
  },
};

// ============================================================================
// ERROR RECOVERY FLAGS
// ============================================================================

const RECOVERABLE_ERRORS: Record<ErrorType, boolean> = {
  noDocuments: true,        // User can upload documents
  documentNotFound: true,   // User can try different name
  ambiguousQuery: true,     // User can rephrase
  unsupportedAction: true,  // User can try different action
  processingError: true,    // Transient, retry may work
  outOfScope: true,         // User can upload relevant docs
  rateLimitExceeded: true,  // Wait and retry
  connectionError: true,    // Wait and retry
  timeout: true,            // Simplify and retry
  invalidInput: true,       // Rephrase
  general: true,            // Usually recoverable
};

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

class ErrorHandlerService {
  /**
   * Get a formatted error response
   * NO LLM CALL - instant template lookup (~1ms)
   */
  formatUserError(context: ErrorContext): FormattedError {
    const { errorType, language = 'en' } = context;

    // Get templates for this error type and language
    const templates = ERROR_TEMPLATES[errorType]?.[language] || ERROR_TEMPLATES.general[language];
    const suggestions = SUGGESTIONS[errorType]?.[language] || [];

    // Randomly select a template for natural feel
    const message = this.selectRandomTemplate(templates, context);

    return {
      message,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      errorType,
      recoverable: RECOVERABLE_ERRORS[errorType] ?? true,
    };
  }

  /**
   * Quick error message (just the message string)
   */
  getErrorMessage(errorType: ErrorType, language: SupportedLanguage = 'en'): string {
    const templates = ERROR_TEMPLATES[errorType]?.[language] || ERROR_TEMPLATES.general[language];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Select a random template and apply context substitutions
   */
  private selectRandomTemplate(templates: string[], context: ErrorContext): string {
    let message = templates[Math.floor(Math.random() * templates.length)];

    // Apply context substitutions
    if (context.documentName) {
      message = message.replace(/\[document\]/gi, `"${context.documentName}"`);
    }
    if (context.actionName) {
      message = message.replace(/\[action\]/gi, context.actionName);
    }
    if (context.retryInSeconds) {
      message = message.replace(/a few seconds/gi, `${context.retryInSeconds} seconds`);
      message = message.replace(/alguns segundos/gi, `${context.retryInSeconds} segundos`);
      message = message.replace(/unos segundos/gi, `${context.retryInSeconds} segundos`);
    }

    return message;
  }

  /**
   * Detect error type from error object or message
   */
  detectErrorType(error: Error | string): ErrorType {
    const message = typeof error === 'string' ? error.toLowerCase() : error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429') || message.includes('too many')) {
      return 'rateLimitExceeded';
    }
    if (message.includes('timeout') || message.includes('timed out') || message.includes('deadline')) {
      return 'timeout';
    }
    if (message.includes('connection') || message.includes('network') || message.includes('econnrefused')) {
      return 'connectionError';
    }
    if (message.includes('not found') || message.includes('does not exist') || message.includes('no such')) {
      return 'documentNotFound';
    }
    if (message.includes('no documents') || message.includes('empty') || message.includes('no files')) {
      return 'noDocuments';
    }
    if (message.includes('invalid') || message.includes('malformed') || message.includes('parse')) {
      return 'invalidInput';
    }
    if (message.includes('scope') || message.includes('outside') || message.includes('not in documents')) {
      return 'outOfScope';
    }

    return 'general';
  }

  /**
   * Format error for streaming response
   */
  formatStreamingError(context: ErrorContext): string {
    const { message } = this.formatUserError(context);
    return message;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const errorHandlerService = new ErrorHandlerService();

export default errorHandlerService;

// Convenience functions for direct use
export const formatUserError = (context: ErrorContext) => errorHandlerService.formatUserError(context);
export const getErrorMessage = (errorType: ErrorType, language?: SupportedLanguage) =>
  errorHandlerService.getErrorMessage(errorType, language);
export const detectErrorType = (error: Error | string) => errorHandlerService.detectErrorType(error);
