/**
 * Dynamic Response System
 *
 * Replaces ALL hardcoded answers with dynamic, context-aware, AI-generated responses.
 *
 * PROBLEM WITH HARDCODED ANSWERS:
 * - Always the same (robotic, repetitive)
 * - Ignore context (user's documents, language, history)
 * - Can't adapt to different situations
 * - Feel unnatural and template-based
 *
 * SOLUTION:
 * - Generate responses dynamically using AI
 * - Consider user context (documents, language, conversation history)
 * - Vary phrasing to prevent repetition
 * - Adapt to user's needs and situation
 *
 * EXAMPLES OF HARDCODED ANSWERS TO REPLACE:
 * 1. "How do you work?" → Hardcoded capabilities list
 * 2. Greetings → Hardcoded "Hello! How can I help?"
 * 3. Error messages → Hardcoded "Something went wrong"
 * 4. Help responses → Hardcoded feature list
 * 5. Empty state messages → Hardcoded "Upload a document to start"
 */

// ✅ FIX: Use singleton instead of creating new instances per request
import geminiClient from './geminiClient.service';
import contextEngineering from './contextEngineering.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserContext {
  userId: string;
  documentCount: number;
  language: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  lastQuery?: string;
  hasUploadedDocuments: boolean;
}

export interface ResponseConfig {
  type: 'greeting' | 'help' | 'capabilities' | 'error' | 'empty_state' | 'general';
  context: UserContext;
  specificQuery?: string;
  errorDetails?: string;
}

// ============================================================================
// DYNAMIC GREETING GENERATION
// ============================================================================

/**
 * Generate dynamic greeting based on user context
 * Replaces hardcoded "Hello! How can I help?"
 */
export async function generateDynamicGreeting(context: UserContext): Promise<string> {
  const { documentCount, language, conversationHistory } = context;

  // Use context engineering for variation
  const hasDocuments = documentCount > 0;
  const isReturningUser = conversationHistory && conversationHistory.length > 0;

  // ✅ FIX: Use singleton client instead of new GoogleGenerativeAI()
  const model = geminiClient.getModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.9, // High temperature for variation
      maxOutputTokens: 100,
    },
  });

  const prompt = `Generate a natural, warm greeting for a document assistant.

**Context:**
- User has ${documentCount} document${documentCount !== 1 ? 's' : ''} uploaded
- ${isReturningUser ? 'Returning user (has conversation history)' : 'New user (first interaction)'}
- Language: ${language}

**Requirements:**
- Keep it SHORT (1 sentence, max 15 words)
- Be warm and friendly, not robotic
- ${hasDocuments ? 'Ask what they want to know about their documents' : 'Encourage them to upload a document'}
- ${isReturningUser ? 'Welcome them back naturally' : 'Make them feel welcome'}
- NO emojis, NO exclamation marks at the end
- Respond in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'}

**Examples of GOOD greetings:**
- "Hi! What would you like to know about your documents?"
- "Welcome back! Ready to explore your files?"
- "Hello! Upload a document and I'll help you understand it."

**Examples of BAD greetings:**
- "Hello! How can I help you today?" (too generic)
- "Welcome to KODA! 🎉" (emoji, too formal)
- "Greetings, user!" (robotic)

Generate ONE natural greeting now:`;

  try {
    const result = await model.generateContent(prompt);

    // Debug: Log the full response structure
    console.log('[DynamicResponse] Raw response:', JSON.stringify({
      candidates: result.response.candidates?.length,
      promptFeedback: result.response.promptFeedback,
      text: result.response.text?.()
    }, null, 2));

    const greeting = result.response.text().trim();

    // Check for empty response and use fallback
    if (!greeting || greeting.length === 0) {
      console.warn('[DynamicResponse] Gemini returned empty greeting, using fallback');
      return contextEngineering.createContextAwareGreeting(hasDocuments);
    }

    console.log(`[DynamicResponse] Generated greeting: "${greeting}"`);
    return greeting;
  } catch (error) {
    console.error('[DynamicResponse] Greeting generation failed:', error);
    // Fallback to context engineering service
    return contextEngineering.createContextAwareGreeting(hasDocuments);
  }
}

// ============================================================================
// DYNAMIC CAPABILITIES EXPLANATION
// ============================================================================

/**
 * Generate dynamic capabilities explanation
 * Replaces hardcoded "I can help you: Ask Questions, Search & Find, etc."
 */
export async function generateDynamicCapabilities(context: UserContext): Promise<string> {
  const { documentCount, language } = context;

  // ✅ FIX: Use singleton client instead of new GoogleGenerativeAI()
  const model = geminiClient.getModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.8, // High temperature for natural variation
      maxOutputTokens: 300,
    },
  });

  const prompt = `Explain what you can do as a document assistant, naturally and conversationally.

**Context:**
- User has ${documentCount} document${documentCount !== 1 ? 's' : ''} uploaded
- Language: ${language}

**Your Capabilities:**
1. **Answer questions** about uploaded documents
2. **Search and find** specific information across all documents
3. **Compare** information across multiple documents
4. **Summarize** long documents into key points
5. **Extract data** like dates, numbers, names, tables
6. **Create documents** (markdown, PDF, Word)
7. **Manage files** (organize, rename, move, delete)

**Requirements:**
- Write 2-3 short paragraphs (~150 words total)
- Be conversational and natural, like explaining to a friend
- ${documentCount > 0 ? `Mention that they can ask about their ${documentCount} documents` : 'Encourage them to upload documents to get started'}
- Use **bold** for key capabilities
- NO bullet points, NO numbered lists (write in paragraphs)
- NO emojis, NO robotic phrases like "I am capable of"
- Vary your phrasing - don't repeat the same structure
- Respond in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'}

**Example of GOOD explanation:**

"I can help you understand your documents by answering questions, finding specific information, and comparing data across files. Whether you need a quick summary or want to extract specific details like dates and numbers, just ask.

I can also create new documents for you - markdown files, PDFs, or Word documents - and help you organize your files by renaming, moving, or deleting them. Think of me as your personal document assistant who's always ready to help."

**Example of BAD explanation:**

"I am KODA, your AI assistant. I am capable of:
- Answering questions
- Searching documents
- Creating files

Please let me know how I can assist you today."

Now, explain your capabilities naturally:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[DynamicResponse] Capabilities generation failed:', error);
    // Fallback
    return language === 'pt'
      ? 'Posso ajudar você a analisar, pesquisar e entender seus documentos. Também posso criar novos arquivos e organizar sua biblioteca. É só perguntar!'
      : 'I can help you analyze, search, and understand your documents. I can also create new files and organize your library. Just ask!';
  }
}

// ============================================================================
// DYNAMIC ERROR MESSAGES
// ============================================================================

/**
 * Generate dynamic error message
 * Replaces hardcoded "Something went wrong. Please try again."
 */
export async function generateDynamicError(
  context: UserContext,
  errorDetails?: string
): Promise<string> {
  const { language, lastQuery } = context;

  // ✅ FIX: Use singleton client instead of new GoogleGenerativeAI()
  const model = geminiClient.getModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 150,
    },
  });

  const prompt = `Generate a helpful error message for a user.

**Context:**
- User's last query: "${lastQuery || 'unknown'}"
- Error details: ${errorDetails || 'unknown error'}
- Language: ${language}

**Requirements:**
- Be empathetic and helpful, not robotic
- Acknowledge the issue without technical jargon
- Suggest what the user can do next
- Keep it SHORT (2-3 sentences, ~50 words)
- NO generic "Something went wrong" messages
- NO technical error codes or stack traces
- Respond in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'}

**Examples of GOOD error messages:**

"I had trouble processing your question. Could you try rephrasing it or asking something else?"

"I couldn't find an answer in your documents. Would you like to try a different search term?"

"I encountered an issue generating that file. Would you like me to try a different format?"

**Examples of BAD error messages:**

"Error 500: Internal server error occurred."

"Something went wrong. Please try again later."

"An unexpected error has occurred. Contact support."

Generate a helpful error message now:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[DynamicResponse] Error message generation failed:', error);
    // Fallback
    return language === 'pt'
      ? 'Encontrei um problema ao processar sua solicitação. Poderia tentar novamente ou reformular sua pergunta?'
      : 'I had trouble processing your request. Could you try again or rephrase your question?';
  }
}

// ============================================================================
// DYNAMIC EMPTY STATE MESSAGES
// ============================================================================

/**
 * Generate dynamic empty state message
 * Replaces hardcoded "Upload a document to get started"
 */
export async function generateDynamicEmptyState(context: UserContext): Promise<string> {
  const { language } = context;

  // ✅ FIX: Use singleton client instead of new GoogleGenerativeAI()
  const model = geminiClient.getModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.9, // High for variation
      maxOutputTokens: 100,
    },
  });

  const prompt = `Generate an encouraging message for a user who hasn't uploaded any documents yet.

**Context:**
- User has NO documents uploaded
- Language: ${language}

**Requirements:**
- Be warm and encouraging, not pushy
- Explain briefly what they can do once they upload
- Keep it SHORT (2 sentences, ~30 words)
- NO robotic phrases like "Please upload a document to proceed"
- Respond in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'}

**Examples of GOOD messages:**

"Upload a document and I'll help you understand it - ask questions, find information, or get a summary."

"Start by adding a file, and I can answer questions, extract data, or create summaries for you."

"Add your first document to get started. I'll help you analyze, search, and understand it."

**Examples of BAD messages:**

"No documents found. Please upload a document to proceed."

"You have not uploaded any files yet."

"Welcome! To begin, upload a document."

Generate an encouraging message now:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[DynamicResponse] Empty state generation failed:', error);
    // Fallback
    return language === 'pt'
      ? 'Faça upload de um documento e eu ajudo você a entendê-lo - pergunte o que quiser, encontre informações ou obtenha um resumo.'
      : 'Upload a document and I\'ll help you understand it - ask questions, find information, or get a summary.';
  }
}

// ============================================================================
// UNIVERSAL DYNAMIC RESPONSE GENERATOR
// ============================================================================

/**
 * Generate dynamic response for any query
 * Universal fallback for all hardcoded responses
 */
export async function generateDynamicResponse(config: ResponseConfig): Promise<string> {
  const { type, context } = config;

  switch (type) {
    case 'greeting':
      return generateDynamicGreeting(context);

    case 'capabilities':
    case 'help':
      return generateDynamicCapabilities(context);

    case 'error':
      return generateDynamicError(context, config.errorDetails);

    case 'empty_state':
      return generateDynamicEmptyState(context);

    case 'general':
    default:
      // For general queries, use adaptive answer generation
      return generateGeneralResponse(context, config.specificQuery || '');
  }
}

/**
 * Generate general dynamic response
 * For any query that doesn't fit other categories
 */
async function generateGeneralResponse(
  context: UserContext,
  query: string
): Promise<string> {
  const { documentCount, language, conversationHistory } = context;

  // ✅ FIX: Use singleton client instead of new GoogleGenerativeAI()
  const model = geminiClient.getModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  });

  // Build conversation context
  const historyContext = conversationHistory && conversationHistory.length > 0
    ? `\n**Previous conversation:**\n${conversationHistory.slice(-3).map(turn => `${turn.role}: ${turn.content}`).join('\n')}`
    : '';

  const prompt = `Answer the user's query naturally and helpfully.

**User Query:**
${query}

**Context:**
- User has ${documentCount} document${documentCount !== 1 ? 's' : ''} uploaded
- Language: ${language}${historyContext}

**Requirements:**
- Be natural, conversational, and helpful
- ${documentCount > 0 ? 'Reference their documents when relevant' : 'Encourage them to upload documents if needed'}
- Keep it concise but comprehensive
- Use **bold** for key terms
- NO emojis, NO robotic phrases
- Respond in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'}

Answer the query now:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[DynamicResponse] General response generation failed:', error);
    return language === 'pt'
      ? 'Desculpe, não consegui processar sua solicitação. Poderia tentar de outra forma?'
      : 'Sorry, I couldn\'t process your request. Could you try asking differently?';
  }
}

// ============================================================================
// RESPONSE CACHING WITH VARIATION
// ============================================================================

/**
 * Cache for frequently generated responses
 * Reduces API calls while maintaining variation
 */
const responseCache = new Map<string, { responses: string[]; lastUsedIndex: number }>();

/**
 * Get cached response with variation
 * Returns different response each time from a pool of generated responses
 */
export async function getCachedDynamicResponse(
  config: ResponseConfig,
  cacheKey: string
): Promise<string> {
  if (!responseCache.has(cacheKey)) {
    // Generate 3 variations and cache them
    const variations = await Promise.all([
      generateDynamicResponse(config),
      generateDynamicResponse(config),
      generateDynamicResponse(config),
    ]);

    responseCache.set(cacheKey, {
      responses: variations,
      lastUsedIndex: -1,
    });
  }

  const cached = responseCache.get(cacheKey)!;

  // Rotate through variations
  cached.lastUsedIndex = (cached.lastUsedIndex + 1) % cached.responses.length;

  return cached.responses[cached.lastUsedIndex];
}

/**
 * Clear cached responses
 */
export function clearResponseCache(): void {
  responseCache.clear();
}

/**
 * Get cache size for monitoring
 */
export function getResponseCacheSize(): number {
  return responseCache.size;
}

// ============================================================================
// QUICK RESPONSE HELPERS (for synchronous fallbacks)
// ============================================================================

/**
 * Quick greeting without async (uses context engineering)
 */
export function getQuickGreeting(hasDocuments: boolean, language: string = 'en'): string {
  return contextEngineering.createContextAwareGreeting(hasDocuments);
}

/**
 * Quick error message without async
 */
export function getQuickError(errorType: string, language: string = 'en'): string {
  const errors: Record<string, Record<string, string>> = {
    upload_failed: {
      en: 'There was an issue processing your file. Please try uploading again.',
      pt: 'Houve um problema ao processar seu arquivo. Por favor, tente fazer o upload novamente.',
      es: 'Hubo un problema al procesar tu archivo. Por favor, intenta subirlo de nuevo.',
    },
    search_failed: {
      en: 'The search encountered an issue. Please try a different term.',
      pt: 'A busca encontrou um problema. Por favor, tente um termo diferente.',
      es: 'La búsqueda encontró un problema. Por favor, intenta con otro término.',
    },
    not_found: {
      en: 'I couldn\'t find what you\'re looking for in your documents.',
      pt: 'Não consegui encontrar o que você procura em seus documentos.',
      es: 'No pude encontrar lo que buscas en tus documentos.',
    },
    rate_limit: {
      en: 'Too many requests. Please wait a moment and try again.',
      pt: 'Muitas solicitações. Por favor, aguarde um momento e tente novamente.',
      es: 'Demasiadas solicitudes. Por favor, espera un momento e intenta de nuevo.',
    },
    generic: {
      en: 'Something unexpected happened. Please try again.',
      pt: 'Algo inesperado aconteceu. Por favor, tente novamente.',
      es: 'Algo inesperado ocurrió. Por favor, inténtalo de nuevo.',
    },
  };

  return errors[errorType]?.[language] || errors.generic[language] || errors.generic.en;
}

/**
 * Quick empty state message without async
 */
export function getQuickEmptyState(language: string = 'en'): string {
  const messages: Record<string, string> = {
    en: 'Upload a document and I\'ll help you understand it - ask questions, find information, or get a summary.',
    pt: 'Faça upload de um documento e eu ajudo você a entendê-lo - pergunte o que quiser, encontre informações ou obtenha um resumo.',
    es: 'Sube un documento y te ayudaré a entenderlo - haz preguntas, encuentra información o consigue un resumen.',
  };

  return messages[language] || messages.en;
}

// ============================================================================
// SERVICE CLASS (for dependency injection)
// ============================================================================

export class DynamicResponseSystemService {
  async generateGreeting(context: UserContext): Promise<string> {
    return generateDynamicGreeting(context);
  }

  async generateCapabilities(context: UserContext): Promise<string> {
    return generateDynamicCapabilities(context);
  }

  async generateError(context: UserContext, errorDetails?: string): Promise<string> {
    return generateDynamicError(context, errorDetails);
  }

  async generateEmptyState(context: UserContext): Promise<string> {
    return generateDynamicEmptyState(context);
  }

  async generateResponse(config: ResponseConfig): Promise<string> {
    return generateDynamicResponse(config);
  }

  async getCachedResponse(config: ResponseConfig, cacheKey: string): Promise<string> {
    return getCachedDynamicResponse(config, cacheKey);
  }

  clearCache(): void {
    clearResponseCache();
  }

  // Quick synchronous methods
  getQuickGreeting = getQuickGreeting;
  getQuickError = getQuickError;
  getQuickEmptyState = getQuickEmptyState;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const dynamicResponseSystemService = new DynamicResponseSystemService();

export default {
  generateDynamicGreeting,
  generateDynamicCapabilities,
  generateDynamicError,
  generateDynamicEmptyState,
  generateDynamicResponse,
  getCachedDynamicResponse,
  clearResponseCache,
  getResponseCacheSize,
  getQuickGreeting,
  getQuickError,
  getQuickEmptyState,
  DynamicResponseSystemService,
  dynamicResponseSystemService,
};
