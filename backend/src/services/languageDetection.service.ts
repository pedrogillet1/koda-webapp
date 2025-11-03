/**
 * Language Detection Service - Enhanced for Multilingual Support
 * Detects language and handles greetings in multiple languages
 * Supports: English, Portuguese (pt), Spanish (es), French (fr)
 */

/**
 * Detect language from user input
 * Uses keyword-based detection for common patterns
 */
export function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase().trim();

  // Portuguese patterns
  const portuguesePatterns = [
    'olá', 'oi', 'bom dia', 'boa tarde', 'boa noite',
    'como está', 'tudo bem', 'obrigado', 'obrigada',
    'por favor', 'arquivo', 'documento', 'pasta'
  ];

  // Spanish patterns
  const spanishPatterns = [
    'hola', 'buenos días', 'buenas tardes', 'buenas noches',
    'cómo estás', 'gracias', 'por favor', 'archivo', 'documento', 'carpeta'
  ];

  // French patterns
  const frenchPatterns = [
    'bonjour', 'bonsoir', 'salut', 'comment allez-vous',
    'merci', 's\'il vous plaît', 'fichier', 'document', 'dossier'
  ];

  // Check for Portuguese
  if (portuguesePatterns.some(pattern => lowerText.includes(pattern))) {
    return 'pt';
  }

  // Check for Spanish
  if (spanishPatterns.some(pattern => lowerText.includes(pattern))) {
    return 'es';
  }

  // Check for French
  if (frenchPatterns.some(pattern => lowerText.includes(pattern))) {
    return 'fr';
  }

  // Default to English
  return 'en';
}

/**
 * Create language-specific instruction for LLM
 */
export function createLanguageInstruction(language: string): string {
  const instructions: Record<string, string> = {
    en: 'Please respond in English.',
    pt: 'Por favor, responda em Português.',
    es: 'Por favor, responde en Español.',
    fr: 'Veuillez répondre en Français.'
  };

  return instructions[language] || instructions.en;
}

/**
 * Detect if query is a greeting in any supported language
 */
export function isGreeting(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  const greetingPatterns = [
    // English
    /^(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings|what's up|sup|yo)[\s!?]*$/i,

    // Portuguese
    /^(olá|oi|ola|bom dia|boa tarde|boa noite|e aí|e ai|eai|tudo bem|como vai|como está|como estas)[\s!?]*$/i,

    // Spanish
    /^(hola|buenos días|buenos dias|buenas tardes|buenas noches|qué tal|que tal|cómo estás|como estas|saludos)[\s!?]*$/i,

    // French
    /^(bonjour|bonsoir|salut|coucou|comment allez-vous|comment vas-tu|ça va|ca va)[\s!?]*$/i
  ];

  return greetingPatterns.some(pattern => pattern.test(lowerQuery));
}

/**
 * Get localized greeting response based on detected language
 */
export function getLocalizedGreeting(language: string): string {
  const greetings: Record<string, string> = {
    en: 'Hello! I\'m KODA, your intelligent document assistant. How can I help you today?',
    pt: 'Olá! Sou a KODA, sua assistente inteligente de documentos. Como posso ajudá-lo hoje?',
    es: '¡Hola! Soy KODA, tu asistente inteligente de documentos. ¿Cómo puedo ayudarte hoy?',
    fr: 'Bonjour! Je suis KODA, votre assistante intelligente de documents. Comment puis-je vous aider aujourd\'hui?'
  };

  return greetings[language] || greetings.en;
}

/**
 * Get localized error message
 */
export function getLocalizedError(errorType: string, language: string): string {
  const errors: Record<string, Record<string, string>> = {
    no_documents: {
      en: 'I couldn\'t find any relevant documents to answer your question.',
      pt: 'Não consegui encontrar nenhum documento relevante para responder sua pergunta.',
      es: 'No pude encontrar ningún documento relevante para responder a tu pregunta.',
      fr: 'Je n\'ai pas pu trouver de documents pertinents pour répondre à votre question.'
    },
    general_error: {
      en: 'Sorry, I encountered an error while processing your request.',
      pt: 'Desculpe, encontrei um erro ao processar sua solicitação.',
      es: 'Lo siento, encontré un error al procesar tu solicitud.',
      fr: 'Désolé, j\'ai rencontré une erreur lors du traitement de votre demande.'
    },
    file_not_found: {
      en: 'I couldn\'t find the file you\'re looking for.',
      pt: 'Não consegui encontrar o arquivo que você está procurando.',
      es: 'No pude encontrar el archivo que estás buscando.',
      fr: 'Je n\'ai pas pu trouver le fichier que vous recherchez.'
    },
    no_context: {
      en: 'I don\'t have enough context to answer that question.',
      pt: 'Não tenho contexto suficiente para responder essa pergunta.',
      es: 'No tengo suficiente contexto para responder esa pregunta.',
      fr: 'Je n\'ai pas assez de contexte pour répondre à cette question.'
    }
  };

  return errors[errorType]?.[language] || errors[errorType]?.en || 'An error occurred.';
}

/**
 * Get localized capabilities description
 */
export function getLocalizedCapabilities(language: string): string {
  const capabilities: Record<string, string> = {
    en: `I can help you with:
- Answering questions about your documents
- Finding and locating files
- Summarizing document content
- Extracting specific information
- Comparing documents
- General knowledge questions`,

    pt: `Posso ajudá-lo com:
- Responder perguntas sobre seus documentos
- Encontrar e localizar arquivos
- Resumir conteúdo de documentos
- Extrair informações específicas
- Comparar documentos
- Perguntas de conhecimento geral`,

    es: `Puedo ayudarte con:
- Responder preguntas sobre tus documentos
- Encontrar y localizar archivos
- Resumir contenido de documentos
- Extraer información específica
- Comparar documentos
- Preguntas de conocimiento general`,

    fr: `Je peux vous aider avec:
- Répondre à des questions sur vos documents
- Trouver et localiser des fichiers
- Résumer le contenu des documents
- Extraire des informations spécifiques
- Comparer des documents
- Questions de connaissances générales`
  };

  return capabilities[language] || capabilities.en;
}
