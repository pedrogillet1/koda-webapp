import { QueryType } from './queryClassifier.service';

/**
 * Template Response Service
 * Provides instant, pre-defined responses for simple queries
 * No LLM needed - saves API costs and provides sub-second responses
 */

export interface TemplateResponse {
  content: string;
  responseTimeMs: number;
}

class TemplateResponseService {
  /**
   * Generate template response based on query type
   */
  generateResponse(queryType: QueryType, query: string): TemplateResponse | null {
    const startTime = Date.now();

    let content: string | null = null;

    switch (queryType) {
      case QueryType.SIMPLE_GREETING:
        content = this.getGreetingResponse(query);
        break;

      case QueryType.SIMPLE_CONVERSATION:
        content = this.getConversationResponse(query);
        break;

      default:
        return null;  // No template available, use RAG
    }

    if (content === null) {
      return null;
    }

    const responseTimeMs = Date.now() - startTime;

    return {
      content,
      responseTimeMs
    };
  }

  /**
   * Get greeting response
   */
  private getGreetingResponse(query: string): string {
    const greetingResponses = [
      "Hello! I'm KODA, your AI document assistant. I can help you find information in your uploaded documents. What would you like to know?",
      "Hi there! I'm here to help you explore your documents. What can I assist you with today?",
      "Hey! I'm KODA, ready to help you find anything in your document library. What are you looking for?",
      "Good to see you! I can search through your documents and answer questions about them. How can I help?"
    ];

    // Use query hash to consistently select the same response for the same greeting
    const index = Math.abs(this.hashString(query)) % greetingResponses.length;
    return greetingResponses[index];
  }

  /**
   * Get conversational response
   */
  private getConversationResponse(query: string): string {
    const normalizedQuery = query.toLowerCase().trim();

    // Thanks/Thank you
    if (normalizedQuery.match(/^thanks?$|^thank you$/i)) {
      return "You're welcome! Let me know if you need anything else.";
    }

    // OK/Okay/Got it
    if (normalizedQuery.match(/^ok$|^okay$|^got it$|^understood$/i)) {
      return "Great! Feel free to ask if you have more questions.";
    }

    // Cool/Great/Perfect/Awesome
    if (normalizedQuery.match(/^cool$|^great$|^perfect$|^awesome$/i)) {
      return "Glad I could help! Let me know if you need anything else.";
    }

    // Bye/Goodbye
    if (normalizedQuery.match(/^bye$|^goodbye$|^see you$/i)) {
      return "Goodbye! Come back anytime you need help with your documents.";
    }

    // Yes/Yeah/Yep
    if (normalizedQuery.match(/^yes$|^yeah$|^yep$/i)) {
      return "Understood! What would you like to know?";
    }

    // No/Nope
    if (normalizedQuery.match(/^no$|^nope$/i)) {
      return "No problem! Let me know if you change your mind or need something else.";
    }

    // Default conversational response
    return "I'm here to help! What would you like to know about your documents?";
  }

  /**
   * Simple string hash function for consistent response selection
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Get response statistics
   */
  getResponseStats(responses: TemplateResponse[]): {
    averageResponseTime: number;
    totalResponses: number;
    fastestResponse: number;
    slowestResponse: number;
  } {
    if (responses.length === 0) {
      return {
        averageResponseTime: 0,
        totalResponses: 0,
        fastestResponse: 0,
        slowestResponse: 0
      };
    }

    const responseTimes = responses.map(r => r.responseTimeMs);
    const sum = responseTimes.reduce((a, b) => a + b, 0);

    return {
      averageResponseTime: sum / responses.length,
      totalResponses: responses.length,
      fastestResponse: Math.min(...responseTimes),
      slowestResponse: Math.max(...responseTimes)
    };
  }
}

export default new TemplateResponseService();
