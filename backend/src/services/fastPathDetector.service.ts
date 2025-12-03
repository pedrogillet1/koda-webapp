/**
 * Fast Path Detector Service
 *
 * Detects simple queries that don't require RAG pipeline.
 * Inspired by ChatGPT's fast path optimization.
 *
 * Impact: 20+ seconds → < 1 second for 30-40% of queries
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { outputIntegration } from './outputIntegration.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Query types that can use fast path
 */
export enum FastPathType {
  GREETING = 'greeting', // "hello", "hi", "hey"
  HELP = 'help', // "what can you do", "help"
  GENERAL = 'general', // "how are you", "what's your name"
  NONE = 'none' // Requires RAG pipeline
}

export interface FastPathResult {
  isFastPath: boolean;
  type: FastPathType;
  response?: string;
}

class FastPathDetectorService {
  /**
   * Greeting patterns (case-insensitive)
   * Matches: "hello", "hi", "hey", "good morning", etc.
   */
  private greetingPatterns = [
    /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day))[\s!.]*$/i,
    /^(what's\s+up|sup|yo|howdy)[\s!.]*$/i,
  ];

  /**
   * Help request patterns
   * Matches: "help", "what can you do", "how do you work", etc.
   */
  private helpPatterns = [
    /^(help|assist|support)[\s!.]*$/i,
    /^(what\s+can\s+you\s+do|how\s+do\s+you\s+work|what\s+are\s+your\s+capabilities)[\s!.?]*$/i,
    /^(show\s+me\s+what\s+you\s+can\s+do|tell\s+me\s+about\s+yourself)[\s!.?]*$/i,
  ];

  /**
   * General conversation patterns
   * Matches: "how are you", "what's your name", etc.
   */
  private generalPatterns = [
    /^(how\s+are\s+you|how's\s+it\s+going)[\s!.?]*$/i,
    /^(what's\s+your\s+name|who\s+are\s+you)[\s!.?]*$/i,
    /^(nice\s+to\s+meet\s+you|pleased\s+to\s+meet\s+you)[\s!.?]*$/i,
  ];

  /**
   * Detect if query can use fast path
   *
   * @param query - User's query
   * @param language - User's preferred language (default: 'en')
   * @param documentCount - Number of documents the user has uploaded (default: 0)
   * @returns FastPathResult with type and optional response
   */
  async detect(query: string, language: string = 'en', documentCount: number = 0): Promise<FastPathResult> {
    const trimmedQuery = query.trim();

    // Check for greetings
    if (this.greetingPatterns.some(pattern => pattern.test(trimmedQuery))) {
      return {
        isFastPath: true,
        type: FastPathType.GREETING,
        response: await this.generateGreetingResponse(language, documentCount),
      };
    }

    // Check for help requests
    if (this.helpPatterns.some(pattern => pattern.test(trimmedQuery))) {
      return {
        isFastPath: true,
        type: FastPathType.HELP,
        response: await this.generateHelpResponse(language, documentCount),
      };
    }

    // Check for general conversation
    if (this.generalPatterns.some(pattern => pattern.test(trimmedQuery))) {
      return {
        isFastPath: true,
        type: FastPathType.GENERAL,
        response: await this.generateGeneralResponse(trimmedQuery, language),
      };
    }

    // Not a fast path query - requires RAG
    return {
      isFastPath: false,
      type: FastPathType.NONE,
    };
  }

  /**
   * Generate natural greeting response using unified formatting
   * Uses outputIntegration for dynamic, context-aware greetings
   *
   * Target: < 1 second response time
   */
  private async generateGreetingResponse(language: string, documentCount: number): Promise<string> {
    return await outputIntegration.generateGreeting(language, documentCount);
  }

  /**
   * Generate help response explaining capabilities
   * Uses outputIntegration for dynamic, context-aware capabilities
   *
   * NOTE: This is NOT a robotic capabilities dump.
   * It's conversational and only shown when user asks for help.
   */
  private async generateHelpResponse(language: string, documentCount: number): Promise<string> {
    return await outputIntegration.generateCapabilities(language, documentCount);
  }

  /**
   * Generate response to general conversation
   * Uses Gemini with minimal context for natural responses
   */
  private async generateGeneralResponse(query: string, language: string): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100, // Keep it brief
        },
      });

      const languageName = language === 'pt' ? 'Portuguese' :
                           language === 'es' ? 'Spanish' :
                           language === 'fr' ? 'French' : 'English';

      const prompt = `You are KODA, a friendly AI document assistant.
Respond naturally and briefly to: "${query}"
Keep your response conversational and under 2 sentences.
Respond in ${languageName}.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('[FastPathDetector] Error generating general response:', error);
      // Fallback response
      const fallbacks: Record<string, string> = {
        en: "I'm KODA, your AI document assistant. I'm here to help you work with your documents!",
        pt: "Sou a KODA, sua assistente de documentos com IA. Estou aqui para ajudar com seus documentos!",
        es: "Soy KODA, tu asistente de documentos con IA. ¡Estoy aquí para ayudarte con tus documentos!",
        fr: "Je suis KODA, votre assistant de documents IA. Je suis là pour vous aider avec vos documents!",
      };
      return fallbacks[language] || fallbacks.en;
    }
  }
}

export default new FastPathDetectorService();
