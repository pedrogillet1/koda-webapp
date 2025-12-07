/**
 * Psychological Safety Framework
 *
 * Ensures all responses (fallback and regular) make users feel:
 * - Safe (not blamed or judged)
 * - Guided (clear next steps)
 * - Confident (system is competent)
 * - Understood (intent is recognized)
 *
 * Based on ChatGPT/Manus principles
 */

export interface SafetyCheckResult {
  isSafe: boolean;
  issues: string[];
  suggestions: string[];
}

class PsychologicalSafetyService {
  /**
   * Check if a response follows psychological safety principles
   */
  checkResponseSafety(response: string): SafetyCheckResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Rule 1: Never blame the user
    const blamePatterns = [
      /your (question|query) is (unclear|vague|incomplete|wrong)/i,
      /you (didn't|did not) (specify|provide|mention)/i,
      /you need to be more (specific|clear)/i,
      /that'?s not (clear|specific) enough/i,
      /please be more (specific|clear)/i,
    ];

    for (const pattern of blamePatterns) {
      if (pattern.test(response)) {
        issues.push('Response blames the user');
        suggestions.push('Rephrase to acknowledge intent: "I want to help you find..."');
        break;
      }
    }

    // Rule 2: Always offer alternatives
    const hasAlternatives = this.checkForAlternatives(response);
    if (!hasAlternatives) {
      issues.push('No alternatives offered');
      suggestions.push('Add 2-3 specific alternatives or next steps');
    }

    // Rule 3: Maintain competence (don't sound helpless)
    const incompetencePatterns = [
      /i (don't know|can't help|have no idea)/i,
      /i'?m not sure what/i,
      /i (can't|cannot) do (that|this|anything)/i,
      /sorry,? i'?m (useless|unable)/i,
    ];

    for (const pattern of incompetencePatterns) {
      if (pattern.test(response)) {
        issues.push('Response sounds incompetent');
        suggestions.push("Focus on what you CAN do, not what you can't");
        break;
      }
    }

    // Rule 4: Avoid technical jargon in errors
    const technicalPatterns = [
      /error \d+/i,
      /stack trace/i,
      /exception/i,
      /null pointer/i,
      /undefined reference/i,
      /internal server error/i,
    ];

    for (const pattern of technicalPatterns) {
      if (pattern.test(response)) {
        issues.push('Contains technical jargon');
        suggestions.push('Use plain language: "I ran into an issue" instead of "Error 500"');
        break;
      }
    }

    // Rule 5: Provide clear next steps
    const hasNextSteps = this.checkForNextSteps(response);
    if (!hasNextSteps) {
      issues.push('No clear next steps provided');
      suggestions.push('Add actionable suggestions: "Try...", "Would you like...", "You could..."');
    }

    // Rule 6: Acknowledge user intent
    const acknowledgesIntent = this.checkIntentAcknowledgment(response);
    if (!acknowledgesIntent) {
      issues.push('Does not acknowledge user intent');
      suggestions.push(
        'Start with: "I understand you\'re looking for..." or "I want to help you find..."'
      );
    }

    // Rule 7: Be warm and encouraging (not cold/robotic)
    const warmthIndicators = [
      /i('d love to|want to|'m here to) help/i,
      /let me help/i,
      /i can (help|assist|show)/i,
      /would you like/i,
      /happy to/i,
    ];

    const hasWarmth = warmthIndicators.some((pattern) => pattern.test(response));
    if (!hasWarmth) {
      issues.push('Response feels cold or robotic');
      suggestions.push('Add warmth: "I\'m here to help", "Let me assist you", "I\'d love to help"');
    }

    return {
      isSafe: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Check if response offers alternatives
   */
  private checkForAlternatives(response: string): boolean {
    // Look for bullet points, numbered lists, or "or" alternatives
    const alternativeIndicators = [
      /[•\-\*]\s+/g, // Bullet points
      /\d+\.\s+/g, // Numbered lists
      /\n.*\n.*\n/g, // Multiple lines (likely alternatives)
      /\bor\b.*\bor\b/i, // Multiple "or" statements
      /(would you like|you could|try|consider).*\?/i, // Offering options
    ];

    return alternativeIndicators.some((pattern) => pattern.test(response));
  }

  /**
   * Check if response provides next steps
   */
  private checkForNextSteps(response: string): boolean {
    const nextStepIndicators = [
      /try (to |asking |rephrasing )?/i,
      /you (could|can|might)/i,
      /would you like (to |me to )?/i,
      /let me know/i,
      /feel free to/i,
      /consider/i,
      /how about/i,
    ];

    return nextStepIndicators.some((pattern) => pattern.test(response));
  }

  /**
   * Check if response acknowledges user intent
   */
  private checkIntentAcknowledgment(response: string): boolean {
    const intentIndicators = [
      /i (understand|see|know) (you'?re|that you'?re)/i,
      /i want to help you/i,
      /let me help you/i,
      /i'?d love to help/i,
      /i can help/i,
    ];

    return intentIndicators.some((pattern) => pattern.test(response));
  }

  /**
   * Improve a response to make it psychologically safe
   */
  improveSafety(response: string, issues: string[]): string {
    let improved = response;

    // Fix blame patterns
    if (issues.includes('Response blames the user')) {
      improved = improved.replace(
        /your (question|query) is (unclear|vague)/i,
        'I want to help you find that information'
      );
      improved = improved.replace(
        /you need to be more specific/i,
        'To help you better, could you tell me'
      );
    }

    // Add warmth if missing
    if (issues.includes('Response feels cold or robotic')) {
      if (!improved.startsWith('I')) {
        improved = "I'm here to help. " + improved;
      }
    }

    // Add alternatives if missing
    if (issues.includes('No alternatives offered')) {
      improved +=
        '\n\nWould you like to try a different approach, or is there something else I can help you with?';
    }

    return improved;
  }

  /**
   * Get safety guidelines for response generation
   */
  getSafetyGuidelines(): string {
    return `
**Psychological Safety Guidelines:**

1. **Never Blame the User**
   - "Your question is unclear"
   + "I want to help you find that information"

2. **Always Offer Alternatives**
   - "I don't have that information"
   + "I don't have that specific information, but I can show you X, Y, or Z"

3. **Maintain Competence**
   - "I don't know" / "I can't do that"
   + "I searched through your documents and found..." / "I can help you with..."

4. **Acknowledge Intent**
   - Jump straight to "No results found"
   + "I understand you're looking for... I searched and found..."

5. **Provide Clear Next Steps**
   - "Try again later"
   + "Try rephrasing your question, or let me know which document you're asking about"

6. **Be Warm and Encouraging**
   - "Error. Please retry."
   + "I ran into an issue. Let me help you differently..."

7. **No Technical Jargon**
   - "Error 500: Internal server error"
   + "I ran into a technical issue"

8. **Focus on What You CAN Do**
   - "I can't access real-time data"
   + "I focus on analyzing documents. I can help you with X, Y, Z"
`;
  }

  /**
   * Validate response length (not too short, not too long)
   */
  checkResponseLength(
    response: string,
    type: 'fallback' | 'regular'
  ): {
    isValid: boolean;
    issue?: string;
  } {
    const wordCount = response.trim().split(/\s+/).length;

    if (type === 'fallback') {
      // Fallbacks should be 50-200 words
      if (wordCount < 30) {
        return {
          isValid: false,
          issue: 'Fallback too short (< 30 words). Add more context or alternatives.',
        };
      }
      if (wordCount > 250) {
        return {
          isValid: false,
          issue: 'Fallback too long (> 250 words). Be more concise.',
        };
      }
    } else {
      // Regular answers should be 50-500 words
      if (wordCount < 20) {
        return {
          isValid: false,
          issue: 'Answer too short (< 20 words). Provide more detail.',
        };
      }
      if (wordCount > 600) {
        return {
          isValid: false,
          issue: 'Answer too long (> 600 words). Summarize key points.',
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Check if response has proper formatting
   */
  checkFormatting(response: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for emojis (should not have them)
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(response)) {
      issues.push('Contains emojis (should not have them)');
    }

    // Check for excessive punctuation
    if (/!!!+/.test(response) || /\?\?\?+/.test(response)) {
      issues.push('Excessive punctuation (!!!, ???)');
    }

    // Check for ALL CAPS (shouting)
    const words = response.split(/\s+/);
    const allCapsWords = words.filter(
      (word) => word.length > 3 && word === word.toUpperCase() && /[A-Z]/.test(word)
    );
    if (allCapsWords.length > 2) {
      issues.push('Too many ALL CAPS words (sounds like shouting)');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

export default new PsychologicalSafetyService();
