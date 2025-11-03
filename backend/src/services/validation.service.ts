/**
 * Validation Service - Phase 1 Week 2
 * Validates AI responses before showing to user
 * Ensures high-quality answers and graceful degradation
 */

export interface ValidationResult {
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  suggestions: string[];
  shouldShow: boolean;
}

class ValidationService {
  /**
   * Validate an AI-generated answer
   * Checks for quality issues and provides confidence score
   */
  validateAnswer(
    answer: string,
    query: string,
    sources: any[],
    avgConfidence: number
  ): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check 1: Answer length (too short might indicate low quality)
    if (answer.trim().length < 10) {
      issues.push('Answer is too short');
      suggestions.push('The AI response is unusually brief, which may indicate insufficient information.');
    }

    // Check 2: Answer completeness (incomplete sentences)
    if (this.detectIncompleteSentence(answer)) {
      issues.push('Answer appears truncated or incomplete');
      suggestions.push('The response may have been cut off. Try asking for a shorter answer.');
    }

    // Check 3: Hallucination patterns
    if (this.detectHallucinationPatterns(answer)) {
      issues.push('Response contains uncertain language patterns');
      suggestions.push('The AI may be uncertain about this information.');
    }

    // Check 4: Source relevance
    if (sources.length === 0) {
      issues.push('No document sources found');
      suggestions.push('No relevant documents were found. Try rephrasing your question.');
    }

    // Check 5: Confidence threshold from retrieval
    const confidenceLevel = this.calculateConfidenceLevel(avgConfidence, sources.length, answer);

    // Determine if answer should be shown
    const shouldShow = this.shouldShowAnswer(confidenceLevel, issues);

    return {
      isValid: issues.length === 0,
      confidence: confidenceLevel,
      issues,
      suggestions,
      shouldShow,
    };
  }

  /**
   * Detect if answer ends abruptly or incompletely
   */
  private detectIncompleteSentence(answer: string): boolean {
    const trimmed = answer.trim();

    // Check for common incomplete patterns
    const incompletePatterns = [
      /\b(and|or|but|however|therefore|because)\s*$/i,  // Ends with conjunction
      /,\s*$/,  // Ends with comma
      /:\s*$/,  // Ends with colon
      /\|\s*$/,  // Ends with pipe (incomplete table)
      /\*\*\s*$/,  // Ends with incomplete bold
      /\[\s*$/,  // Ends with incomplete bracket
    ];

    return incompletePatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Detect patterns that suggest hallucination or uncertainty
   */
  private detectHallucinationPatterns(answer: string): boolean {
    const hallucinationPatterns = [
      /I (don't have|cannot find|don't see|couldn't locate)/i,
      /based on (my training|general knowledge|what I know)/i,
      /I (think|believe|assume|guess)/i,
      /(unfortunately|sorry|apologize).*I (don't|can't|cannot)/i,
    ];

    return hallucinationPatterns.some(pattern => pattern.test(answer));
  }

  /**
   * Calculate overall confidence level
   */
  private calculateConfidenceLevel(
    avgConfidence: number,
    sourceCount: number,
    answer: string
  ): 'high' | 'medium' | 'low' {
    // High confidence: Strong retrieval + multiple sources
    if (avgConfidence >= 0.8 && sourceCount >= 2) {
      return 'high';
    }

    // Medium confidence: Decent retrieval OR single good source
    if (avgConfidence >= 0.6 || sourceCount >= 1) {
      return 'medium';
    }

    // Low confidence: Weak retrieval and few sources
    return 'low';
  }

  /**
   * Determine if answer should be shown to user
   */
  private shouldShowAnswer(
    confidence: 'high' | 'medium' | 'low',
    issues: string[]
  ): boolean {
    // Always show high confidence answers
    if (confidence === 'high') {
      return true;
    }

    // Show medium confidence unless there are critical issues
    if (confidence === 'medium' && issues.length < 3) {
      return true;
    }

    // Show low confidence only if no issues detected
    if (confidence === 'low' && issues.length === 0) {
      return true;
    }

    return false;
  }

  /**
   * Generate fallback message when answer shouldn't be shown
   */
  generateFallbackMessage(validation: ValidationResult, query: string): string {
    const baseMessage = "I couldn't find enough information to answer that confidently.";

    const suggestions = [
      'Try rephrasing your question',
      'Check if the relevant document is uploaded',
      'Ask about a specific document or topic',
      'Break down your question into smaller parts',
    ];

    return `${baseMessage}\n\n**Suggestions:**\n${suggestions.map(s => `• ${s}`).join('\n')}`;
  }

  /**
   * Enhance answer with confidence indicator (for medium/low confidence)
   */
  addConfidenceIndicator(answer: string, confidence: 'high' | 'medium' | 'low'): string {
    if (confidence === 'high') {
      return answer;  // No indicator needed for high confidence
    }

    const indicators = {
      medium: '⚠️ **Note**: This answer is based on partial information from your documents.',
      low: '⚠️ **Limited confidence**: I found limited information about this in your documents.',
    };

    const indicator = indicators[confidence];
    return `${indicator}\n\n${answer}`;
  }
}

export const validationService = new ValidationService();
export default validationService;
