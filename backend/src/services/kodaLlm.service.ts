/**
 * =============================================================================
 * KODA LLM SERVICE - High-Level Gemini Interface
 * =============================================================================
 *
 * Business-level LLM service that wraps GeminiGateway with:
 * - Question type-aware configurations
 * - KODA-specific prompt engineering
 * - Specialized methods for different use cases
 * - Response post-processing
 *
 * LAYER ARCHITECTURE:
 * 1. GeminiGateway (low-level) - Direct API calls, retries, connection pooling
 * 2. KodaLlmService (this) - Business logic, question types, prompts
 * 3. RAG/Chat Services - Use KodaLlmService for all LLM needs
 *
 * =============================================================================
 */

import geminiGateway, { GeminiModel, GeminiResponse } from './geminiGateway.service';
import { classifyQuestion, type QuestionType, type RagMode } from './simpleIntentDetection.service';

// =============================================================================
// TYPES
// =============================================================================

export interface KodaLlmRequest {
  query: string;
  context?: string;
  systemPrompt?: string;
  questionType?: QuestionType;
  ragMode?: RagMode;
  language?: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; content: string }>;
  streaming?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface KodaLlmResponse {
  answer: string;
  questionType: QuestionType;
  ragMode: RagMode;
  model: GeminiModel;
  tokensUsed?: number;
  latencyMs: number;
  confidence?: number;
}

// =============================================================================
// QUESTION TYPE CONFIGURATIONS
// =============================================================================

/**
 * Optimal configurations for each question type
 * Based on empirical testing with KODA RAG system
 */
const QUESTION_TYPE_CONFIGS: Record<QuestionType, {
  temperature: number;
  maxTokens: number;
  topK: number;
  topP: number;
  model: GeminiModel;
}> = {
  // No RAG needed - quick responses
  meta: {
    temperature: 0.3,
    maxTokens: 500,
    topK: 20,
    topP: 0.9,
    model: 'gemini-2.5-flash',
  },
  greeting: {
    temperature: 0.7,
    maxTokens: 300,
    topK: 40,
    topP: 0.95,
    model: 'gemini-2.5-flash',
  },

  // Light RAG - factual extraction
  simple_factual: {
    temperature: 0.1,
    maxTokens: 800,
    topK: 20,
    topP: 0.85,
    model: 'gemini-2.5-flash',
  },
  medium: {
    temperature: 0.3,
    maxTokens: 1500,
    topK: 30,
    topP: 0.9,
    model: 'gemini-2.5-flash',
  },
  medium_specific: {
    temperature: 0.2,
    maxTokens: 1200,
    topK: 25,
    topP: 0.9,
    model: 'gemini-2.5-flash',
  },

  // Full RAG - complex analysis
  complex_analysis: {
    temperature: 0.4,
    maxTokens: 3000,
    topK: 40,
    topP: 0.95,
    model: 'gemini-2.5-flash',
  },
  complex_multidoc: {
    temperature: 0.4,
    maxTokens: 4000,
    topK: 50,
    topP: 0.95,
    model: 'gemini-2.5-flash',
  },
  comparison: {
    temperature: 0.3,
    maxTokens: 3500,
    topK: 40,
    topP: 0.9,
    model: 'gemini-2.5-flash',
  },
  list: {
    temperature: 0.2,
    maxTokens: 2500,
    topK: 30,
    topP: 0.9,
    model: 'gemini-2.5-flash',
  },

  // Follow-up with context
  followup: {
    temperature: 0.4,
    maxTokens: 2000,
    topK: 35,
    topP: 0.9,
    model: 'gemini-2.5-flash',
  },
};

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

const BASE_SYSTEM_PROMPT = `You are KODA, an intelligent document assistant that helps users find information in their documents.

CRITICAL RULES:
1. ONLY use information from the provided document context
2. NEVER make up or hallucinate information
3. If information is not in the context, say "I couldn't find this information in the documents"
4. Quote exact values for numbers, dates, and names
5. Cite which document contains the information when possible
6. Be concise but complete
7. Use markdown formatting for readability`;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  pt: '\n\nIMPORTANT: Respond in Portuguese (Brazilian). Use natural Portuguese phrasing.',
  en: '\n\nIMPORTANT: Respond in English. Use clear, professional language.',
  es: '\n\nIMPORTANT: Respond in Spanish. Use natural Spanish phrasing.',
  fr: '\n\nIMPORTANT: Respond in French. Use natural French phrasing.',
};

// =============================================================================
// KODA LLM SERVICE CLASS
// =============================================================================

class KodaLlmService {
  private static instance: KodaLlmService;

  private constructor() {
    console.log('✅ [KODA-LLM] Service initialized');
  }

  public static getInstance(): KodaLlmService {
    if (!KodaLlmService.instance) {
      KodaLlmService.instance = new KodaLlmService();
    }
    return KodaLlmService.instance;
  }

  /**
   * =============================================================================
   * MAIN API: Generate Answer
   * =============================================================================
   *
   * Automatically classifies the question, selects optimal config, and generates
   */
  public async generateAnswer(request: KodaLlmRequest): Promise<KodaLlmResponse> {
    const startTime = Date.now();

    // Classify question if not provided
    const classification = request.questionType
      ? { type: request.questionType, ragMode: request.ragMode || 'full_rag' as RagMode }
      : classifyQuestion(request.query);

    const questionType = classification.type;
    const ragMode = classification.ragMode;
    const config = QUESTION_TYPE_CONFIGS[questionType];

    console.log(`🧠 [KODA-LLM] Question: "${request.query.slice(0, 50)}..."`);
    console.log(`📊 [KODA-LLM] Type: ${questionType}, RAG: ${ragMode}`);

    // Build system prompt
    let systemPrompt = request.systemPrompt || BASE_SYSTEM_PROMPT;
    if (request.language && LANGUAGE_INSTRUCTIONS[request.language]) {
      systemPrompt += LANGUAGE_INSTRUCTIONS[request.language];
    }

    // Build full prompt with context
    let fullPrompt = '';
    if (request.context) {
      fullPrompt += `# Document Context\n\n${request.context}\n\n`;
    }
    fullPrompt += `# Question\n\n${request.query}`;

    // Convert history format
    const history = request.conversationHistory?.map(msg => ({
      role: msg.role as 'user' | 'model',
      parts: [{ text: msg.content }],
    }));

    let response: GeminiResponse;

    if (request.streaming && request.onChunk) {
      // Streaming response
      response = await geminiGateway.generateContentStream({
        prompt: fullPrompt,
        systemInstruction: systemPrompt,
        model: config.model,
        config: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          topK: config.topK,
          topP: config.topP,
        },
        history,
        onChunk: request.onChunk,
        safetySettings: 'permissive',
      });
    } else {
      // Non-streaming response
      response = await geminiGateway.generateContent({
        prompt: fullPrompt,
        systemInstruction: systemPrompt,
        model: config.model,
        config: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          topK: config.topK,
          topP: config.topP,
        },
        history,
        safetySettings: 'permissive',
      });
    }

    const latencyMs = Date.now() - startTime;

    console.log(`✅ [KODA-LLM] Answer generated in ${latencyMs}ms (${response.text.length} chars)`);

    return {
      answer: response.text,
      questionType,
      ragMode,
      model: response.model,
      tokensUsed: response.totalTokens,
      latencyMs,
    };
  }

  /**
   * =============================================================================
   * SPECIALIZED METHODS
   * =============================================================================
   */

  /**
   * Simple factual extraction - optimized for dates, numbers, names
   */
  public async extractFact(
    query: string,
    context: string,
    language?: string
  ): Promise<string> {
    const response = await this.generateAnswer({
      query,
      context,
      language,
      questionType: 'simple_factual',
      ragMode: 'light_rag',
    });
    return response.answer;
  }

  /**
   * Complex analysis with full context
   */
  public async analyzeDocument(
    query: string,
    context: string,
    language?: string,
    onChunk?: (chunk: string) => void
  ): Promise<KodaLlmResponse> {
    return this.generateAnswer({
      query,
      context,
      language,
      questionType: 'complex_analysis',
      ragMode: 'full_rag',
      streaming: !!onChunk,
      onChunk,
    });
  }

  /**
   * Document comparison
   */
  public async compareDocuments(
    query: string,
    context: string,
    language?: string,
    onChunk?: (chunk: string) => void
  ): Promise<KodaLlmResponse> {
    return this.generateAnswer({
      query,
      context,
      language,
      questionType: 'comparison',
      ragMode: 'full_rag',
      streaming: !!onChunk,
      onChunk,
    });
  }

  /**
   * List generation from documents
   */
  public async generateList(
    query: string,
    context: string,
    language?: string
  ): Promise<string> {
    const response = await this.generateAnswer({
      query,
      context,
      language,
      questionType: 'list',
      ragMode: 'full_rag',
    });
    return response.answer;
  }

  /**
   * Conversational follow-up with history
   */
  public async continueConversation(
    query: string,
    context: string,
    conversationHistory: Array<{ role: 'user' | 'model'; content: string }>,
    language?: string,
    onChunk?: (chunk: string) => void
  ): Promise<KodaLlmResponse> {
    return this.generateAnswer({
      query,
      context,
      language,
      conversationHistory,
      questionType: 'followup',
      ragMode: 'full_rag',
      streaming: !!onChunk,
      onChunk,
    });
  }

  /**
   * =============================================================================
   * UTILITY METHODS
   * =============================================================================
   */

  /**
   * Generate JSON response
   */
  public async generateJSON<T = any>(
    prompt: string,
    context?: string
  ): Promise<T> {
    let fullPrompt = '';
    if (context) {
      fullPrompt += `# Context\n\n${context}\n\n`;
    }
    fullPrompt += prompt;

    return geminiGateway.generateJSON<T>(fullPrompt, {
      model: 'gemini-2.5-flash',
      temperature: 0.2,
    });
  }

  /**
   * Simple generation without RAG context
   */
  public async quickGenerate(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    return geminiGateway.quickGenerate(prompt, {
      temperature: options?.temperature ?? 0.5,
      maxTokens: options?.maxTokens ?? 1000,
      model: 'gemini-2.5-flash',
    });
  }

  /**
   * Summarize text
   */
  public async summarize(
    text: string,
    options?: { maxLength?: number; style?: 'brief' | 'detailed' }
  ): Promise<string> {
    const style = options?.style || 'brief';
    const maxLength = options?.maxLength || (style === 'brief' ? 150 : 500);

    const prompt = style === 'brief'
      ? `Summarize this in ${maxLength} characters or less:\n\n${text}`
      : `Provide a detailed summary with key points:\n\n${text}`;

    return this.quickGenerate(prompt, {
      temperature: 0.3,
      maxTokens: style === 'brief' ? 200 : 800,
    });
  }

  /**
   * Classify text into categories
   */
  public async classify<T extends string>(
    text: string,
    categories: T[],
    description?: string
  ): Promise<T> {
    const prompt = `Classify the following text into one of these categories: ${categories.join(', ')}

${description ? `Context: ${description}\n\n` : ''}Text: "${text}"

Respond with ONLY the category name, nothing else.`;

    const result = await this.quickGenerate(prompt, { temperature: 0.1 });
    const normalized = result.trim().toLowerCase();

    // Find matching category
    for (const category of categories) {
      if (normalized.includes(category.toLowerCase())) {
        return category;
      }
    }

    return categories[0]; // Default to first category
  }

  /**
   * Extract structured data from text
   */
  public async extractStructured<T>(
    text: string,
    schema: { fields: Array<{ name: string; type: string; description: string }> }
  ): Promise<T> {
    const fieldDescriptions = schema.fields
      .map(f => `- ${f.name} (${f.type}): ${f.description}`)
      .join('\n');

    const prompt = `Extract the following information from the text:

${fieldDescriptions}

Text:
${text}

Return as JSON with the field names as keys.`;

    return this.generateJSON<T>(prompt);
  }

  /**
   * Get optimal config for question type
   */
  public getConfigForQuestionType(questionType: QuestionType): typeof QUESTION_TYPE_CONFIGS[QuestionType] {
    return QUESTION_TYPE_CONFIGS[questionType];
  }

  /**
   * Get gateway stats
   */
  public getStats() {
    return geminiGateway.getStats();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

const kodaLlm = KodaLlmService.getInstance();

export default kodaLlm;
export { KodaLlmService };
