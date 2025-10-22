/**
 * Query Classifier Service
 * Classifies user queries into response types for adaptive AI responses
 */

export interface QueryClassification {
  type: 'greeting' | 'simple' | 'factual' | 'explanation' | 'comprehensive';
  confidence: number;
  responseTime: string;
  contextNeeded: boolean;
  maxTokens: number;
  retrievalCount?: number;
}

class QueryClassifier {
  /**
   * Classify query into response type
   * Returns: { type, confidence, suggestedContext }
   */
  classify(query: string): QueryClassification {
    const normalized = query.toLowerCase().trim();

    // 1. Greeting (instant response)
    if (this.isGreeting(normalized)) {
      return {
        type: 'greeting',
        confidence: 1.0,
        responseTime: '1-2s',
        contextNeeded: false,
        maxTokens: 50,
      };
    }

    // 2. Simple location/navigation query
    if (this.isLocationQuery(normalized)) {
      return {
        type: 'simple',
        confidence: 0.9,
        responseTime: '2-5s',
        contextNeeded: true,
        maxTokens: 100,
        retrievalCount: 3,
      };
    }

    // 3. Factual question (specific data point)
    if (this.isFactualQuery(normalized)) {
      return {
        type: 'factual',
        confidence: 0.85,
        responseTime: '5-8s',
        contextNeeded: true,
        maxTokens: 150,
        retrievalCount: 5,
      };
    }

    // 4. Explanation request
    if (this.isExplanationQuery(normalized)) {
      return {
        type: 'explanation',
        confidence: 0.8,
        responseTime: '10-15s',
        contextNeeded: true,
        maxTokens: 300,
        retrievalCount: 7,
      };
    }

    // 5. Comprehensive guide request
    if (this.isComprehensiveQuery(normalized)) {
      return {
        type: 'comprehensive',
        confidence: 0.9,
        responseTime: '15-20s',
        contextNeeded: true,
        maxTokens: 500,
        retrievalCount: 10,
      };
    }

    // Default: factual (safe middle ground)
    return {
      type: 'factual',
      confidence: 0.5,
      responseTime: '5-8s',
      contextNeeded: true,
      maxTokens: 150,
      retrievalCount: 5,
    };
  }

  /**
   * Check if query is a greeting
   */
  private isGreeting(query: string): boolean {
    const greetings = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
      'greetings',
      'howdy',
      "what's up",
      'sup',
      'yo',
      'olá',
      'oi',
      'bom dia',
      'boa tarde',
      'boa noite', // Portuguese
    ];

    // Check if query is ONLY a greeting (no other content)
    const words = query.split(' ').filter((w) => w.length > 0);

    if (words.length <= 3) {
      return greetings.some((greeting) => query.includes(greeting));
    }

    return false;
  }

  /**
   * Check if query is asking for location/navigation
   */
  private isLocationQuery(query: string): boolean {
    const locationPatterns = [
      /where is/i,
      /where can i find/i,
      /location of/i,
      /which folder/i,
      /in which/i,
      /find document/i,
      /show me/i,
      /locate/i,
      /onde está/i, // Portuguese: where is
      /onde fica/i, // Portuguese: where is located
      /em qual pasta/i, // Portuguese: in which folder
      /mostrar/i, // Portuguese: show
    ];

    return locationPatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Check if query is asking for specific fact
   */
  private isFactualQuery(query: string): boolean {
    const factualPatterns = [
      /what is the/i,
      /when is/i,
      /when does/i,
      /when did/i,
      /how much/i,
      /how many/i,
      /who is/i,
      /which/i,
      /what date/i,
      /what time/i,
      /what was/i,
      /o que é/i, // Portuguese: what is
      /quando/i, // Portuguese: when
      /quanto/i, // Portuguese: how much
      /quem/i, // Portuguese: who
      /qual/i, // Portuguese: which
    ];

    // Factual queries are usually short and specific
    const wordCount = query.split(' ').length;
    const hasFactualPattern = factualPatterns.some((pattern) => pattern.test(query));

    return hasFactualPattern && wordCount < 15;
  }

  /**
   * Check if query requests explanation
   */
  private isExplanationQuery(query: string): boolean {
    const explanationPatterns = [
      /how does/i,
      /how do/i,
      /explain/i,
      /why/i,
      /what does.*mean/i,
      /can you explain/i,
      /tell me about/i,
      /describe/i,
      /what is the process/i,
      /how to/i,
      /como funciona/i, // Portuguese: how does it work
      /explique/i, // Portuguese: explain
      /por que/i, // Portuguese: why
      /me fale sobre/i, // Portuguese: tell me about
      /descreva/i, // Portuguese: describe
    ];

    return explanationPatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Check if query requests comprehensive guide
   */
  private isComprehensiveQuery(query: string): boolean {
    const comprehensivePatterns = [
      /guide/i,
      /tutorial/i,
      /step by step/i,
      /detailed/i,
      /comprehensive/i,
      /in depth/i,
      /complete/i,
      /everything about/i,
      /all information/i,
      /full explanation/i,
      /give me all/i,
      /guia/i, // Portuguese: guide
      /passo a passo/i, // Portuguese: step by step
      /detalhado/i, // Portuguese: detailed
      /completo/i, // Portuguese: complete
      /tudo sobre/i, // Portuguese: everything about
    ];

    const hasComprehensivePattern = comprehensivePatterns.some((pattern) => pattern.test(query));
    const wordCount = query.split(' ').length;

    // Comprehensive queries are usually longer or explicitly request detailed info
    return hasComprehensivePattern || wordCount > 20;
  }

  /**
   * Generate follow-up suggestion based on query type
   */
  generateFollowUp(queryType: string, context: any = {}): string {
    const followUps: Record<string, string[]> = {
      greeting: [
        'How can I help you with your documents today?',
        'What would you like to know?',
        'Feel free to ask me anything about your documents!',
      ],
      simple: [
        'Would you like to know anything else about this document?',
        'Need help with anything specific?',
        'Is there anything else I can help you find?',
      ],
      factual: [
        'Would you like more details about this?',
        'Do you need any clarification?',
        "Is there anything specific you'd like to know?",
      ],
      explanation: [
        'Would you like me to elaborate on any part?',
        'Do you need a more detailed guide?',
        "Is there anything you'd like me to clarify?",
      ],
      comprehensive: [
        'Would you like me to focus on any specific section?',
        'Do you need examples or additional context?',
        'Is there anything else you\'d like me to explain?',
      ],
    };

    const options = followUps[queryType] || followUps.factual;
    return options[Math.floor(Math.random() * options.length)];
  }
}

export default new QueryClassifier();
