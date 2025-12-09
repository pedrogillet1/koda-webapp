/**
 * Language Detection Service - Enhanced for Multilingual Support
 * Detects language and handles greetings in multiple languages
 * Supports: English, Portuguese (pt), Spanish (es)
 *
 * NOTE: This service now uses the centralized languageEngine.service.ts
 * for primary detection. Helper functions remain here for backward compatibility.
 *
 * @deprecated Use languageEngine.service.ts for new code
 */

import { detectLanguageSimple, isGreeting as isGreetingEngine } from './languageEngine.service';

/**
 * Detect language from user input
 * Uses centralized language engine for detection
 * @deprecated Use detectLanguageSimple from languageEngine.service.ts
 */
export function detectLanguage(text: string): string {
  const detected = detectLanguageSimple(text, 'pt-BR');
  // Map SupportedLanguage to legacy format
  if (detected === 'pt-BR') return 'pt';
  return detected;
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
