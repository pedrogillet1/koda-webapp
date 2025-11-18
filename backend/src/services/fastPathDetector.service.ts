/**
 * Fast Path Detector Service
 *
 * Detects simple queries that don't require RAG pipeline.
 * Inspired by ChatGPT's fast path optimization.
 *
 * Impact: 20+ seconds → < 1 second for 30-40% of queries
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

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
   * @returns FastPathResult with type and optional response
   */
  async detect(query: string): Promise<FastPathResult> {
    const trimmedQuery = query.trim();

    // Check for greetings
    if (this.greetingPatterns.some(pattern => pattern.test(trimmedQuery))) {
      return {
        isFastPath: true,
        type: FastPathType.GREETING,
        response: await this.generateGreeting(),
      };
    }

    // Check for help requests
    if (this.helpPatterns.some(pattern => pattern.test(trimmedQuery))) {
      return {
        isFastPath: true,
        type: FastPathType.HELP,
        response: this.generateHelpResponse(),
      };
    }

    // Check for general conversation
    if (this.generalPatterns.some(pattern => pattern.test(trimmedQuery))) {
      return {
        isFastPath: true,
        type: FastPathType.GENERAL,
        response: await this.generateGeneralResponse(trimmedQuery),
      };
    }

    // Not a fast path query - requires RAG
    return {
      isFastPath: false,
      type: FastPathType.NONE,
    };
  }

  /**
   * Generate natural greeting response
   * Uses variety for natural feel
   *
   * Target: < 1 second response time
   */
  private async generateGreeting(): Promise<string> {
    const greetings = [
      "Hi! How can I help you with your documents today?",
      "Hello! What would you like to know?",
      "Hey there! I'm ready to help with your documents.",
      "Hi! Ask me anything about your uploaded documents.",
      "Hello! What can I do for you today?",
    ];

    // Return random greeting for variety
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Generate help response explaining capabilities
   *
   * NOTE: This is NOT a robotic capabilities dump.
   * It's conversational and only shown when user asks for help.
   */
  private generateHelpResponse(): string {
    return `I'm KODA, your AI document assistant. I can help you:

**Ask Questions** — Ask me anything about your uploaded documents and I'll find the answer.
**Search & Find** — Search across all your documents to find specific information.
**Compare Documents** — Compare information across multiple documents.
**Summarize Content** — Get quick summaries of long documents.
**Extract Data** — Pull out specific data like dates, numbers, or names.

Just ask me a question or upload a document to get started!`;
  }

  /**
   * Generate response to general conversation
   * Uses Gemini with minimal context for natural responses
   */
  private async generateGeneralResponse(query: string): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100, // Keep it brief
        },
      });

      const prompt = `You are KODA, a friendly AI document assistant.
Respond naturally and briefly to: "${query}"
Keep your response conversational and under 2 sentences.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Error generating general response:', error);
      // Fallback response
      return "I'm KODA, your AI document assistant. I'm here to help you work with your documents!";
    }
  }
}

export default new FastPathDetectorService();
