/**
 * KODA LANGUAGE SERVICE - Single Source of Truth for Language Detection
 *
 * This is the ONLY service that should handle language detection in Koda.
 * All other services MUST use this service for language-related functionality.
 *
 * Features:
 * - Query-level language detection with confidence scoring
 * - Conversation-level language tracking (dominant language)
 * - Language persistence across conversation turns
 * - Multi-language support: Portuguese (pt-BR), English (en), Spanish (es)
 * - System prompt generation for language enforcement
 *
 * @version 2.0.0
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SupportedLanguage = 'pt-BR' | 'en' | 'es';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;  // 0-1
  detectedPatterns: string[];
  source: 'query' | 'conversation' | 'default';
}

export interface ConversationLanguageState {
  dominantLanguage: SupportedLanguage;
  languageCounts: Record<SupportedLanguage, number>;
  lastDetectedLanguage: SupportedLanguage;
  totalMessages: number;
}

export interface LanguageInstruction {
  systemPrompt: string;
  shortInstruction: string;
  languageCode: SupportedLanguage;
}

// ============================================================================
// LANGUAGE DETECTION PATTERNS
// ============================================================================

const LANGUAGE_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  'pt-BR': [
    // Portuguese accents and special characters
    /[áéíóúàèìòùâêîôûãõç]/i,
    // Common Portuguese words
    /\b(você|voce|vocês|não|nao|sim|obrigado|obrigada)\b/i,
    /\b(onde|como|quando|porque|porquê|qual|quais|quem)\b/i,
    /\b(está|estão|estou|estava|tenho|temos|tinha)\b/i,
    /\b(fazer|faço|faz|fazendo|posso|pode|podem)\b/i,
    /\b(meu|meus|minha|minhas|seu|seus|sua|suas)\b/i,
    /\b(arquivo|arquivos|documento|documentos|pasta|pastas)\b/i,
    /\b(olá|oi|bom dia|boa tarde|boa noite)\b/i,
    /\b(por favor|desculpe|desculpa|ajuda|ajudar)\b/i,
    /\b(listar|mostrar|exibir|abrir|criar|deletar)\b/i,
    /\b(sobre|para|com|sem|entre|depois|antes)\b/i,
    /\b(esse|essa|esses|essas|este|esta|estes|estas)\b/i,
    /\b(aqui|ali|lá|cá|agora|hoje|ontem|amanhã)\b/i,
    // Portuguese verb endings
    /\b\w+(ção|ções|mente|ando|endo|indo)\b/i,
    // Common typos in Portuguese
    /\b(tneh|tneho|arquivso|documetnos)\b/i,
  ],
  'es': [
    // Spanish-specific characters
    /[ñ¿¡]/i,
    // Common Spanish words
    /\b(usted|ustedes|tú|vosotros|nosotros)\b/i,
    /\b(sí|si|gracias|por favor|hola)\b/i,
    /\b(dónde|donde|cómo|como|cuándo|cuando)\b/i,
    /\b(está|están|estoy|estaba|tengo|tenemos)\b/i,
    /\b(hacer|hago|hace|haciendo|puedo|puede)\b/i,
    /\b(mi|mis|tu|tus|su|sus|nuestro|nuestra)\b/i,
    /\b(archivo|archivos|documento|documentos|carpeta)\b/i,
    /\b(buenos días|buenas tardes|buenas noches)\b/i,
    /\b(ayuda|ayudar|ayúdame|necesito)\b/i,
    /\b(listar|mostrar|abrir|crear|borrar)\b/i,
    /\b(sobre|para|con|sin|entre|después|antes)\b/i,
    /\b(ese|esa|esos|esas|este|esta|estos|estas)\b/i,
    // Spanish verb endings
    /\b\w+(ción|ciones|mente|ando|iendo)\b/i,
  ],
  'en': [
    // Common English words
    /\b(the|a|an|is|are|was|were|been|being)\b/i,
    /\b(you|your|yours|i|me|my|mine|we|our)\b/i,
    /\b(what|where|when|why|how|which|who)\b/i,
    /\b(have|has|had|having|do|does|did)\b/i,
    /\b(can|could|would|should|will|shall|may|might)\b/i,
    /\b(file|files|document|documents|folder|folders)\b/i,
    /\b(hello|hi|hey|good morning|good afternoon)\b/i,
    /\b(please|thank|thanks|sorry|excuse)\b/i,
    /\b(help|assist|find|search|show|list|create|delete)\b/i,
    /\b(about|with|from|into|through|after|before)\b/i,
    /\b(this|that|these|those|here|there)\b/i,
    // English verb endings
    /\b\w+(ing|tion|ness|ment|able|ible)\b/i,
  ],
};

// Language-specific system prompts
const LANGUAGE_INSTRUCTIONS: Record<SupportedLanguage, LanguageInstruction> = {
  'pt-BR': {
    systemPrompt: `
REGRA CRÍTICA DE IDIOMA - PORTUGUÊS BRASILEIRO:
- Você DEVE responder APENAS em português brasileiro
- NUNCA misture idiomas na sua resposta
- Use português natural e conversacional
- Mantenha a consistência do idioma em toda a resposta
- Mesmo que o usuário escreva em outro idioma, responda em português`,
    shortInstruction: 'Responda sempre em português brasileiro.',
    languageCode: 'pt-BR',
  },
  'en': {
    systemPrompt: `
CRITICAL LANGUAGE RULE - ENGLISH:
- You MUST respond ONLY in English
- Never mix languages in your response
- Use natural, conversational English
- Maintain language consistency throughout your response`,
    shortInstruction: 'Always respond in English.',
    languageCode: 'en',
  },
  'es': {
    systemPrompt: `
REGLA CRÍTICA DE IDIOMA - ESPAÑOL:
- DEBES responder SOLO en español
- NUNCA mezcles idiomas en tu respuesta
- Usa español natural y conversacional
- Mantén la consistencia del idioma en toda tu respuesta`,
    shortInstruction: 'Responde siempre en español.',
    languageCode: 'es',
  },
};

// ============================================================================
// IN-MEMORY CONVERSATION LANGUAGE CACHE
// ============================================================================

const conversationLanguageCache = new Map<string, ConversationLanguageState>();

// ============================================================================
// CORE DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect language from a single text query
 * Returns language with confidence score
 */
export function detectLanguageFromQuery(text: string): LanguageDetectionResult {
  const normalizedText = text.toLowerCase().trim();

  const scores: Record<SupportedLanguage, { count: number; patterns: string[] }> = {
    'pt-BR': { count: 0, patterns: [] },
    'en': { count: 0, patterns: [] },
    'es': { count: 0, patterns: [] },
  };

  // Check each language's patterns
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        scores[lang as SupportedLanguage].count++;
        scores[lang as SupportedLanguage].patterns.push(match[0]);
      }
    }
  }

  // Find the language with highest score
  let maxScore = 0;
  let detectedLang: SupportedLanguage = 'pt-BR'; // Default to Portuguese
  let detectedPatterns: string[] = [];

  for (const [lang, data] of Object.entries(scores)) {
    if (data.count > maxScore) {
      maxScore = data.count;
      detectedLang = lang as SupportedLanguage;
      detectedPatterns = data.patterns;
    }
  }

  // Calculate confidence (0-1)
  const totalPatterns = Object.values(scores).reduce((sum, d) => sum + d.count, 0);
  const confidence = totalPatterns > 0 ? maxScore / Math.max(totalPatterns, 3) : 0.3;

  // If confidence is too low, return default with low confidence
  if (confidence < 0.3 || maxScore === 0) {
    return {
      language: 'pt-BR', // Default to Portuguese for Brazilian users
      confidence: 0.3,
      detectedPatterns: [],
      source: 'default',
    };
  }

  return {
    language: detectedLang,
    confidence: Math.min(confidence, 1),
    detectedPatterns,
    source: 'query',
  };
}

/**
 * Get or create conversation language state
 */
function getConversationLanguageState(conversationId: string): ConversationLanguageState {
  if (!conversationLanguageCache.has(conversationId)) {
    conversationLanguageCache.set(conversationId, {
      dominantLanguage: 'pt-BR',
      languageCounts: { 'pt-BR': 0, 'en': 0, 'es': 0 },
      lastDetectedLanguage: 'pt-BR',
      totalMessages: 0,
    });
  }
  return conversationLanguageCache.get(conversationId)!;
}

/**
 * Update conversation language state after detecting a new message
 */
export function updateConversationLanguage(
  conversationId: string,
  detectedLanguage: SupportedLanguage,
  confidence: number
): ConversationLanguageState {
  const state = getConversationLanguageState(conversationId);

  // Weight the language count by confidence
  const weight = Math.max(confidence, 0.5); // Minimum weight of 0.5
  state.languageCounts[detectedLanguage] += weight;
  state.lastDetectedLanguage = detectedLanguage;
  state.totalMessages++;

  // Recalculate dominant language
  let maxCount = 0;
  let dominant: SupportedLanguage = 'pt-BR';

  for (const [lang, count] of Object.entries(state.languageCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = lang as SupportedLanguage;
    }
  }

  state.dominantLanguage = dominant;

  console.log(`🌍 [KODA-LANGUAGE] Updated conversation ${conversationId.slice(0, 8)}: dominant=${dominant}, counts=${JSON.stringify(state.languageCounts)}`);

  return state;
}

/**
 * MAIN FUNCTION: Detect language for a query within a conversation context
 *
 * This is the primary function that should be used by all services.
 * It considers both the current query AND the conversation history.
 */
export async function detectLanguage(
  query: string,
  conversationId?: string,
  options?: {
    forceQueryLanguage?: boolean;  // If true, always use query language
    minConfidenceForSwitch?: number; // Min confidence to switch from conversation language
  }
): Promise<LanguageDetectionResult> {
  const { forceQueryLanguage = false, minConfidenceForSwitch = 0.7 } = options || {};

  // Step 1: Detect language from the query itself
  const queryResult = detectLanguageFromQuery(query);

  console.log(`🌍 [KODA-LANGUAGE] Query detection: ${queryResult.language} (confidence: ${queryResult.confidence.toFixed(2)})`);

  // If no conversation context or forced query language, use query result
  if (!conversationId || forceQueryLanguage) {
    return queryResult;
  }

  // Step 2: Get conversation language state
  const convState = getConversationLanguageState(conversationId);

  // If this is a new conversation (no messages yet), use query language
  if (convState.totalMessages === 0) {
    updateConversationLanguage(conversationId, queryResult.language, queryResult.confidence);
    return queryResult;
  }

  // Step 3: Decide whether to use query language or conversation language
  // Use query language only if:
  // - High confidence in query language detection
  // - Query language is different from conversation language
  if (
    queryResult.confidence >= minConfidenceForSwitch &&
    queryResult.language !== convState.dominantLanguage
  ) {
    console.log(`🌍 [KODA-LANGUAGE] Language switch detected: ${convState.dominantLanguage} -> ${queryResult.language}`);
    updateConversationLanguage(conversationId, queryResult.language, queryResult.confidence);
    return queryResult;
  }

  // Use conversation's dominant language
  updateConversationLanguage(conversationId, queryResult.language, queryResult.confidence);

  return {
    language: convState.dominantLanguage,
    confidence: 0.9, // High confidence since we're using conversation context
    detectedPatterns: queryResult.detectedPatterns,
    source: 'conversation',
  };
}

/**
 * Simple synchronous language detection (for backward compatibility)
 * Detects language from query only, no conversation context
 */
export function detectLanguageSimple(text: string): SupportedLanguage {
  return detectLanguageFromQuery(text).language;
}

// ============================================================================
// LANGUAGE INSTRUCTION GENERATION
// ============================================================================

/**
 * Get the full language instruction for system prompts
 */
export function getLanguageInstruction(language: SupportedLanguage): LanguageInstruction {
  return LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS['pt-BR'];
}

/**
 * Get system prompt suffix for language enforcement
 */
export function getLanguageSystemPrompt(language: SupportedLanguage): string {
  return LANGUAGE_INSTRUCTIONS[language]?.systemPrompt || LANGUAGE_INSTRUCTIONS['pt-BR'].systemPrompt;
}

/**
 * Get short instruction for language (for inline use)
 */
export function getShortLanguageInstruction(language: SupportedLanguage): string {
  return LANGUAGE_INSTRUCTIONS[language]?.shortInstruction || LANGUAGE_INSTRUCTIONS['pt-BR'].shortInstruction;
}

// ============================================================================
// CONVERSATION LANGUAGE PERSISTENCE
// ============================================================================

/**
 * Load conversation language state from database
 */
export async function loadConversationLanguage(conversationId: string): Promise<SupportedLanguage> {
  try {
    // First check cache
    if (conversationLanguageCache.has(conversationId)) {
      return conversationLanguageCache.get(conversationId)!.dominantLanguage;
    }

    // Try to load from conversation state in database
    const state = await prisma.conversationState.findUnique({
      where: { conversationId },
      select: { language: true },
    });

    if (state?.language) {
      const lang = state.language as SupportedLanguage;
      // Initialize cache from database
      conversationLanguageCache.set(conversationId, {
        dominantLanguage: lang,
        languageCounts: { 'pt-BR': 0, 'en': 0, 'es': 0, [lang]: 1 },
        lastDetectedLanguage: lang,
        totalMessages: 1,
      });
      return lang;
    }

    // If no state, analyze recent messages to detect dominant language
    const messages = await prisma.message.findMany({
      where: { conversationId, role: 'user' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { content: true },
    });

    if (messages.length === 0) {
      return 'pt-BR'; // Default
    }

    // Detect language from each message and count
    const langCounts: Record<SupportedLanguage, number> = { 'pt-BR': 0, 'en': 0, 'es': 0 };

    for (const msg of messages) {
      const result = detectLanguageFromQuery(msg.content);
      langCounts[result.language] += result.confidence;
    }

    // Find dominant language
    let dominant: SupportedLanguage = 'pt-BR';
    let maxCount = 0;

    for (const [lang, count] of Object.entries(langCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = lang as SupportedLanguage;
      }
    }

    // Cache it
    conversationLanguageCache.set(conversationId, {
      dominantLanguage: dominant,
      languageCounts: langCounts,
      lastDetectedLanguage: dominant,
      totalMessages: messages.length,
    });

    console.log(`🌍 [KODA-LANGUAGE] Loaded conversation language from history: ${dominant}`);

    return dominant;
  } catch (error) {
    console.error('Error loading conversation language:', error);
    return 'pt-BR';
  }
}

/**
 * Save conversation language to database
 */
export async function saveConversationLanguage(
  conversationId: string,
  language: SupportedLanguage,
  userId?: string
): Promise<void> {
  try {
    // If userId not provided, try to get it from the conversation
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });
      resolvedUserId = conversation?.userId || 'system';
    }

    await prisma.conversationState.upsert({
      where: { conversationId },
      update: { language },
      create: {
        conversationId,
        userId: resolvedUserId,
        language,
      },
    });
    console.log(`🌍 [KODA-LANGUAGE] Saved conversation language: ${language}`);
  } catch (error) {
    console.error('Error saving conversation language:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if text is a greeting in any language
 */
export function isGreeting(text: string): boolean {
  const lowerText = text.toLowerCase().trim();

  const greetingPatterns = [
    // English
    /^(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings)[\s!?.,]*$/i,
    // Portuguese
    /^(olá|ola|oi|bom dia|boa tarde|boa noite|e aí|eai|tudo bem)[\s!?.,]*$/i,
    // Spanish
    /^(hola|buenos días|buenos dias|buenas tardes|buenas noches|qué tal|que tal)[\s!?.,]*$/i,
  ];

  return greetingPatterns.some(pattern => pattern.test(lowerText));
}

/**
 * Get localized greeting response
 */
export function getLocalizedGreeting(language: SupportedLanguage): string {
  const greetings: Record<SupportedLanguage, string> = {
    'pt-BR': 'Olá! Sou a KODA, sua assistente inteligente de documentos. Como posso ajudá-lo hoje?',
    'en': "Hello! I'm KODA, your intelligent document assistant. How can I help you today?",
    'es': '¡Hola! Soy KODA, tu asistente inteligente de documentos. ¿Cómo puedo ayudarte hoy?',
  };
  return greetings[language] || greetings['pt-BR'];
}

/**
 * Get human-readable language name
 */
export function getLanguageName(language: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    'pt-BR': 'Português (Brasil)',
    'en': 'English',
    'es': 'Español',
  };
  return names[language] || 'Português (Brasil)';
}

/**
 * Clear conversation language cache (for testing)
 */
export function clearLanguageCache(conversationId?: string): void {
  if (conversationId) {
    conversationLanguageCache.delete(conversationId);
  } else {
    conversationLanguageCache.clear();
  }
}

/**
 * Get conversation language state (for debugging)
 */
export function getLanguageState(conversationId: string): ConversationLanguageState | undefined {
  return conversationLanguageCache.get(conversationId);
}

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * @deprecated Use detectLanguage() instead
 */
export function createLanguageInstruction(language: string): string {
  const lang = language === 'pt' ? 'pt-BR' : (language as SupportedLanguage);
  return getShortLanguageInstruction(lang);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  detectLanguage,
  detectLanguageSimple,
  detectLanguageFromQuery,
  updateConversationLanguage,
  loadConversationLanguage,
  saveConversationLanguage,
  getLanguageInstruction,
  getLanguageSystemPrompt,
  getShortLanguageInstruction,
  isGreeting,
  getLocalizedGreeting,
  getLanguageName,
  clearLanguageCache,
  getLanguageState,
  createLanguageInstruction,
};
