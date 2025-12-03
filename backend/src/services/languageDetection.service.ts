/**
 * Language Detection Service - Enhanced for Multilingual Support
 * Detects language and handles greetings in multiple languages
 * Supports: English, Portuguese (pt), Spanish (es), French (fr)
 */

/**
 * Detect language from user input
 * Uses keyword-based detection for common patterns
 * ✅ FIX: English is the default, only switch if strong non-English signals
 */
export function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase().trim();

  // ✅ FIX: Check for explicit English patterns first
  // If the text is clearly English, return early
  const strongEnglishPatterns = [
    /\bwhat\s+is\b/i,
    /\bhow\s+(many|much|is|are|does|do)\b/i,
    /\bwhy\s+(is|are|does|do)\b/i,
    /\bwhat\s+are\b/i,
    /\bwhich\s+(is|are|property|properties)\b/i,
    /\bshould\s+i\b/i,
    /\bcan\s+(you|i)\b/i,
    /\bif\s+i\s+have\b/i,
    /\bbased\s+on\b/i,
    /\baccording\s+to\b/i,
    /\bplease\b/i,
    /\bthe\s+(total|average|sum|revenue|investment|budget)\b/i,
    /\b(calculate|compare|analyze|explain|show|find|get)\b/i,
  ];

  // If query matches strong English patterns, return English
  if (strongEnglishPatterns.some(pattern => pattern.test(lowerText))) {
    return 'en';
  }

  // Helper function to count matches
  const countMatches = (text: string, words: string[]): number => {
    return words.filter(word => text.includes(word)).length;
  };

  // Portuguese patterns (comprehensive list)
  const portuguesePatterns = [
    // Greetings
    'olá', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite',
    'como está', 'como esta', 'tudo bem', 'como vai',
    'obrigado', 'obrigada', 'por favor',
    // Question words
    'quantos', 'quantas', 'quais', 'qual', 'onde', 'quando', 'como', 'porque', 'por que', 'quem',
    // Common verbs
    'tenho', 'posso', 'pode', 'preciso', 'quero', 'gostaria',
    'ajudar', 'mostrar', 'explicar', 'encontrar', 'buscar', 'procurar',
    // File/document terms
    'arquivo', 'arquivos', 'documento', 'documentos', 'pasta', 'pastas',
    // Actions
    'criar', 'deletar', 'apagar', 'mover', 'renomear',
    // Common words
    'sobre', 'para', 'isso', 'este', 'esta', 'esse', 'essa',
    'meu', 'minha', 'meus', 'minhas', 'seu', 'sua',
    'não', 'nao', 'sim', 'muito', 'mais', 'menos', 'também', 'tambem',
    // Portuguese-specific characters
    'ção', 'ões', 'ã', 'õ'
  ];

  // Spanish patterns (comprehensive list)
  const spanishPatterns = [
    // Greetings
    'hola', 'buenos días', 'buenos dias', 'buenas tardes', 'buenas noches',
    'cómo estás', 'como estas', 'gracias', 'por favor',
    // Question words
    'cuántos', 'cuantos', 'cuántas', 'cuantas', 'cuáles', 'cuales', 'cuál', 'cual',
    'dónde', 'donde', 'cuándo', 'cuando', 'cómo', 'por qué', 'quién', 'quien',
    // Common verbs
    'tengo', 'puedo', 'necesito', 'quiero', 'quisiera',
    'ayudar', 'mostrar', 'explicar', 'buscar', 'encontrar',
    // File/document terms
    'archivo', 'archivos', 'documento', 'documentos', 'carpeta', 'carpetas',
    // Actions
    'crear', 'borrar', 'eliminar', 'mover', 'renombrar',
    // Common words
    'esto', 'mi', 'mis', 'tu', 'tus', 'sí', 'mucho', 'más', 'mas', 'menos',
    // Spanish-specific
    'ñ', '¿', '¡'
  ];

  // French patterns (comprehensive list)
  const frenchPatterns = [
    // Greetings
    'bonjour', 'bonsoir', 'salut', 'merci', 's\'il vous plaît', 'sil vous plait',
    'comment allez-vous', 'comment vas-tu', 'ça va', 'ca va',
    // Question words
    'combien', 'quels', 'quelles', 'quel', 'quelle', 'où', 'quand', 'comment', 'pourquoi', 'qui',
    // Common verbs
    'avoir', 'être', 'etre', 'pouvoir', 'vouloir', 'faire',
    'montrer', 'expliquer', 'chercher', 'trouver', 'aider',
    // File/document terms
    'fichier', 'fichiers', 'document', 'documents', 'dossier', 'dossiers',
    // Actions
    'créer', 'creer', 'supprimer', 'déplacer', 'deplacer', 'renommer',
    // Common words
    'sur', 'pour', 'ceci', 'cela', 'ce', 'cette', 'mon', 'ma', 'mes',
    'non', 'oui', 'très', 'tres', 'plus', 'moins', 'aussi',
    // French-specific characters
    'è', 'ê', 'ë', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'œ'
  ];

  // Count matches for each language
  const ptCount = countMatches(lowerText, portuguesePatterns);
  const esCount = countMatches(lowerText, spanishPatterns);
  const frCount = countMatches(lowerText, frenchPatterns);

  // ✅ FIX: Require MINIMUM of 2 strong matches to switch from English
  // This prevents false positives from partial word matches
  const MIN_MATCHES_FOR_LANGUAGE_SWITCH = 2;

  // Return language with most matches, only if above threshold
  if (ptCount > esCount && ptCount > frCount && ptCount >= MIN_MATCHES_FOR_LANGUAGE_SWITCH) {
    console.log(`🌐 [LANG] Detected Portuguese (${ptCount} matches)`);
    return 'pt';
  }
  if (esCount > ptCount && esCount > frCount && esCount >= MIN_MATCHES_FOR_LANGUAGE_SWITCH) {
    console.log(`🌐 [LANG] Detected Spanish (${esCount} matches)`);
    return 'es';
  }
  if (frCount > ptCount && frCount > esCount && frCount >= MIN_MATCHES_FOR_LANGUAGE_SWITCH) {
    console.log(`🌐 [LANG] Detected French (${frCount} matches)`);
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
      en: 'Something went wrong while processing your question. Could you try rephrasing it or asking something else?',
      pt: 'Algo deu errado ao processar sua pergunta. Você poderia reformulá-la ou perguntar outra coisa?',
      es: 'Algo salió mal al procesar tu pregunta. ¿Podrías reformularla o preguntar otra cosa?',
      fr: 'Quelque chose s\'est mal passé lors du traitement de votre question. Pourriez-vous la reformuler ou poser une autre question?'
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

// ============================================================================
// Cultural Profile System
// ============================================================================

interface CulturalContext {
  languageCode: string;
  systemPrompt: string;
  tone: string;
  currency: string | null;
}

const CULTURAL_PROFILES: Record<string, CulturalContext> = {
  en: {
    languageCode: 'en',
    systemPrompt:
      'You are Koda, a helpful and efficient AI assistant. Your tone should be professional yet friendly.',
    tone: 'friendly',
    currency: 'USD',
  },
  pt: {
    languageCode: 'pt',
    systemPrompt:
      'Você é a KODA, uma assistente de IA prestativa e eficiente. Seu tom deve ser formal e respeitoso. Use a moeda BRL para exemplos financeiros.',
    tone: 'formal',
    currency: 'BRL',
  },
  es: {
    languageCode: 'es',
    systemPrompt:
      'Eres KODA, un asistente de IA servicial y eficiente. Tu tono debe ser amigable. Utiliza la moneda EUR para ejemplos financieros.',
    tone: 'friendly',
    currency: 'EUR',
  },
  fr: {
    languageCode: 'fr',
    systemPrompt:
      'Vous êtes KODA, un assistant IA serviable et efficace. Votre ton doit être poli et professionnel. Utilisez la monnaie EUR pour les exemples financiers.',
    tone: 'formal',
    currency: 'EUR',
  },
};

/**
 * Get cultural profile for a language
 */
export function getCulturalProfile(languageCode: string): CulturalContext {
  return CULTURAL_PROFILES[languageCode] || CULTURAL_PROFILES.en;
}

/**
 * Build a culturally-aware system prompt
 */
export async function buildCulturalSystemPrompt(
  languageCode: string,
  additionalContext?: string
): Promise<string> {
  const profile = getCulturalProfile(languageCode);

  let systemPrompt = profile.systemPrompt;

  // Add tone guidance
  if (profile.tone === 'formal') {
    systemPrompt += ' Maintain a formal and respectful tone throughout the conversation.';
  } else if (profile.tone === 'friendly') {
    systemPrompt += ' Keep your responses warm and approachable.';
  }

  // Add currency context if available
  if (profile.currency) {
    systemPrompt += ` When discussing monetary values, use ${profile.currency} as the default currency.`;
  }

  // Add any additional context
  if (additionalContext) {
    systemPrompt += ` ${additionalContext}`;
  }

  return systemPrompt;
}
