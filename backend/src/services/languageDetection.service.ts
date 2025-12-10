/**
 * Language Detection Service - Enhanced for Multilingual Support
 * Detects language and handles greetings in multiple languages
 * Supports: English, Portuguese (pt), Spanish (es)
 */

/**
 * Detect language from user input
 * Uses keyword-based detection for common patterns
 * ✅ FIX: English is the default, only switch if strong non-English signals
 * ✅ FIX #2: Single-word greetings are now detected correctly
 */
export function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase().trim();

  // ✅ FIX #2: Check for single-word greetings FIRST (these need special handling)
  // Single-word greetings should immediately return the correct language
  const greetingLanguageMap: Record<string, string> = {
    // Portuguese greetings
    'olá': 'pt', 'ola': 'pt', 'oi': 'pt', 'e aí': 'pt', 'eai': 'pt',
    'bom dia': 'pt', 'boa tarde': 'pt', 'boa noite': 'pt', 'tudo bem': 'pt',
    // Spanish greetings
    'hola': 'es', 'buenos días': 'es', 'buenos dias': 'es',
    'buenas tardes': 'es', 'buenas noches': 'es', 'qué tal': 'es', 'que tal': 'es',
    // French greetings
    'bonjour': 'fr', 'bonsoir': 'fr', 'salut': 'fr', 'coucou': 'fr', 'ça va': 'fr',
  };

  // Check if the text is a greeting (with optional punctuation)
  const cleanText = lowerText.replace(/[!?.]+$/, '').trim();
  if (greetingLanguageMap[cleanText]) {
    const detectedLang = greetingLanguageMap[cleanText];
    console.log(`🌐 [LANG] Detected ${detectedLang} from greeting: "${cleanText}"`);
    return detectedLang;
  }

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

  // Portuguese patterns (comprehensive list - EXPANDED)
  const portuguesePatterns = [
    // Greetings
    'olá', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite',
    'como está', 'como esta', 'tudo bem', 'como vai', 'e aí', 'eai',
    'obrigado', 'obrigada', 'por favor',
    // Question words
    'quantos', 'quantas', 'quais', 'qual é', 'qual', 'onde', 'quando', 'como', 'porque', 'por que', 'quem',
    'o que', 'que é', 'que e', 'como é', 'como e', 'onde está', 'onde esta',
    // Common verbs (including conjugations)
    'tenho', 'posso', 'pode', 'preciso', 'quero', 'gostaria',
    'ajudar', 'mostrar', 'mostra', 'mostre', 'me mostra', 'explicar', 'encontrar', 'buscar', 'procurar',
    'abre', 'abra', 'abrir', 'exibe', 'exiba', 'exibir',
    'são', 'sao', 'foi', 'fazer', 'ver', 'ler',
    // File/document terms
    'arquivo', 'arquivos', 'documento', 'documentos', 'pasta', 'pastas',
    'contrato', 'contratos', 'análise', 'analise', 'relatório', 'relatorio',
    'projeto', 'projetos', 'planilha', 'planilhas',
    // Actions
    'criar', 'deletar', 'apagar', 'mover', 'renomear', 'excluir',
    // Common words
    'sobre', 'para', 'isso', 'este', 'esta', 'esse', 'essa',
    'meu', 'minha', 'meus', 'minhas', 'seu', 'sua',
    'não', 'nao', 'sim', 'muito', 'mais', 'menos', 'também', 'tambem',
    // Financial/business terms
    'total', 'valor', 'preço', 'preco', 'custo', 'data', 'nome',
    'lucro', 'receita', 'despesa', 'investimento', 'roi', 'cálculo', 'calculo',
    // Adjectives
    'principal', 'principais', 'melhor', 'pior', 'maior', 'menor',
    // Portuguese-specific characters/suffixes
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
    // Common verbs (including conjugations)
    'tengo', 'puedo', 'necesito', 'quiero', 'quisiera',
    'ayudar', 'mostrar', 'muestra', 'muéstrame', 'muestrame', 'explicar', 'buscar', 'encontrar',
    'abre', 'abra', 'abrir', 'enseña', 'enseñar', 'déjame', 'dejame',
    // File/document terms
    'archivo', 'archivos', 'documento', 'documentos', 'carpeta', 'carpetas',
    // Actions
    'crear', 'borrar', 'eliminar', 'mover', 'renombrar',
    // Common words
    'esto', 'mi', 'mis', 'tu', 'tus', 'sí', 'mucho', 'más', 'mas', 'menos',
    // Spanish-specific
    'ñ', '¿', '¡'
  ];

  // French patterns
  const frenchPatterns = [
    // Greetings (already handled above but add more)
    'bonjour', 'bonsoir', 'salut', 'coucou', 'ça va', 'merci', 's\'il vous plaît', 'svp',
    // Question words
    'combien', 'quels', 'quelle', 'quel', 'où', 'quand', 'comment', 'pourquoi', 'qui',
    // Common verbs (including conjugations)
    'j\'ai', 'je peux', 'je veux', 'j\'aimerais', 'je voudrais',
    'montrer', 'montre', 'montrez', 'montre-moi', 'afficher', 'affiche', 'ouvrir', 'ouvre',
    'voir', 'regarder', 'chercher', 'trouver',
    // File/document terms
    'fichier', 'fichiers', 'document', 'documents', 'dossier', 'dossiers',
    // Actions
    'créer', 'supprimer', 'déplacer', 'renommer', 'effacer',
    // Common words
    'le', 'la', 'les', 'mon', 'ma', 'mes', 'ce', 'cette', 'oui', 'non',
    // French-specific
    'é', 'è', 'ê', 'ç', 'à', 'ù', 'û', 'î', 'ô'
  ];

  // Count matches for each language
  const ptCount = countMatches(lowerText, portuguesePatterns);
  const esCount = countMatches(lowerText, spanishPatterns);
  const frCount = countMatches(lowerText, frenchPatterns);

  // ✅ FIX: Lowered from 2 to 1 to handle short queries like "Qual é o total?"
  // Single matches for language-specific words are now sufficient
  const MIN_MATCHES_FOR_LANGUAGE_SWITCH = 1;

  // Return language with most matches, only if above threshold
  // Priority: pt > es > fr (in case of ties, prefer in this order)
  const maxCount = Math.max(ptCount, esCount, frCount);

  if (maxCount >= MIN_MATCHES_FOR_LANGUAGE_SWITCH) {
    if (ptCount === maxCount) {
      console.log(`🌐 [LANG] Detected Portuguese (${ptCount} matches)`);
      return 'pt';
    }
    if (esCount === maxCount) {
      console.log(`🌐 [LANG] Detected Spanish (${esCount} matches)`);
      return 'es';
    }
    if (frCount === maxCount) {
      console.log(`🌐 [LANG] Detected French (${frCount} matches)`);
      return 'fr';
    }
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
 * Get human-readable language name from code
 */
export function getLanguageName(languageCode: string): string {
  const names: Record<string, string> = {
    en: 'English',
    pt: 'Portuguese',
    es: 'Spanish',
    fr: 'French',
  };

  return names[languageCode] || 'English';
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
    /^(hola|buenos días|buenos dias|buenas tardes|buenas noches|qué tal|que tal|cómo estás|como estas|saludos)[\s!?]*$/i
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
    fr: 'Bonjour! Je suis KODA, votre assistant intelligent de documents. Comment puis-je vous aider aujourd\'hui?'
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
      es: 'No pude encontrar ningún documento relevante para responder a tu pregunta.'
    },
    general_error: {
      en: 'Something went wrong while processing your question. Could you try rephrasing it or asking something else?',
      pt: 'Algo deu errado ao processar sua pergunta. Você poderia reformulá-la ou perguntar outra coisa?',
      es: 'Algo salió mal al procesar tu pregunta. ¿Podrías reformularla o preguntar otra cosa?'
    },
    file_not_found: {
      en: 'I couldn\'t find the file you\'re looking for.',
      pt: 'Não consegui encontrar o arquivo que você está procurando.',
      es: 'No pude encontrar el archivo que estás buscando.'
    },
    no_context: {
      en: 'I don\'t have enough context to answer that question.',
      pt: 'Não tenho contexto suficiente para responder essa pergunta.',
      es: 'No tengo suficiente contexto para responder esa pregunta.'
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
- Répondre aux questions sur vos documents
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
