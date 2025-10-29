/**
 * Response Post-Processor Service
 * Enforces response quality rules as a safety net
 * - Removes inline citations
 * - Enforces length limits
 * - Standardizes formatting
 * - Improves fallback messages
 */

interface ProcessingOptions {
  removeInlineCitations?: boolean;
  enforceLength?: boolean;
  addContext?: boolean;
  standardizeFormat?: boolean;
}

interface QuestionType {
  isSimple: boolean;
  isNumerical: boolean;
  isNavigation: boolean;
  isComplex: boolean;
}

class ResponsePostProcessorService {

  /**
   * Main processing function
   */
  async processAnswer(
    answer: string,
    question: string,
    options: ProcessingOptions = {
      removeInlineCitations: true,
      enforceLength: true,
      addContext: false,
      standardizeFormat: true
    }
  ): Promise<string> {

    let processed = answer;

    // Step 1: Remove inline citations
    if (options.removeInlineCitations) {
      processed = this.removeInlineCitations(processed);
    }

    // Step 2: Enforce length limits based on question type
    if (options.enforceLength) {
      processed = this.enforceLength(processed, question);
    }

    // Step 3: Add context to very short answers
    if (options.addContext) {
      processed = this.addContextToShortAnswers(processed, question);
    }

    // Step 4: Standardize format for navigation responses
    if (options.standardizeFormat) {
      processed = this.standardizeFormat(processed, question);
    }

    return processed.trim();
  }

  /**
   * Remove "According to" and other repetitive citation patterns
   */
  private removeInlineCitations(answer: string): string {
    let cleaned = answer;

    // Remove "According to [document]," patterns at start of sentences
    cleaned = cleaned.replace(/According to [^,]+,\s*/gi, '');
    cleaned = cleaned.replace(/Based on [^,]+,\s*/gi, '');
    cleaned = cleaned.replace(/As stated in [^,]+,\s*/gi, '');
    cleaned = cleaned.replace(/As mentioned in [^,]+,\s*/gi, '');

    // Remove "in [document]" at end of sentences
    cleaned = cleaned.replace(/\s+in [^.]+\.pdf\./gi, '.');
    cleaned = cleaned.replace(/\s+from [^.]+\.pdf\./gi, '.');

    // Remove inline [Source: ...] citations
    cleaned = cleaned.replace(/\[Source:[^\]]+\]/gi, '');

    // Remove document names in parentheses like (Business Plan.pdf)
    cleaned = cleaned.replace(/\s*\([^)]*\.pdf\)/gi, '');
    cleaned = cleaned.replace(/\s*\([^)]*\.docx\)/gi, '');
    cleaned = cleaned.replace(/\s*\([^)]*\.xlsx\)/gi, '');
    cleaned = cleaned.replace(/\s*\([^)]*\.pptx\)/gi, '');

    // Clean up double spaces and punctuation issues
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/\s+\./g, '.');
    cleaned = cleaned.replace(/\s+,/g, ',');
    cleaned = cleaned.replace(/,,+/g, ',');

    return cleaned.trim();
  }

  /**
   * Enforce length limits based on question type
   */
  private enforceLength(answer: string, question: string): string {
    const questionType = this.detectQuestionType(question);
    const sentences = this.splitIntoSentences(answer);

    // Determine max sentences based on question type
    let maxSentences: number;

    if (questionType.isSimple || questionType.isNumerical) {
      maxSentences = 2; // Simple/numerical: max 2 sentences
    } else if (questionType.isNavigation) {
      // Navigation queries can be longer (structured lists)
      return answer;
    } else if (questionType.isComplex) {
      maxSentences = 4; // Complex: max 4 sentences
    } else {
      maxSentences = 5; // Default: max 5 sentences
    }

    // If under limit, return as-is
    if (sentences.length <= maxSentences) {
      return answer;
    }

    // Truncate to max sentences
    console.warn(`⚠️ [Post-Processor] Truncated response from ${sentences.length} to ${maxSentences} sentences`);
    return sentences.slice(0, maxSentences).join('. ') + '.';
  }

  /**
   * Add context to very short numerical answers
   */
  private addContextToShortAnswers(answer: string, question: string): string {
    // Skip if answer is already long enough
    if (answer.length > 50) return answer;

    // Check if answer is just a number or very short
    const isJustNumber = /^[\d$,.\s%]+$/.test(answer.trim());
    const isVeryShort = answer.length < 30;

    if (isJustNumber || isVeryShort) {
      const subject = this.extractSubject(question);
      if (subject && !answer.toLowerCase().includes(subject.toLowerCase())) {
        return `The ${subject} is ${answer.trim()}.`;
      }
    }

    return answer;
  }

  /**
   * Standardize navigation response format
   */
  private standardizeFormat(answer: string, question: string): string {
    const questionType = this.detectQuestionType(question);

    if (!questionType.isNavigation) {
      return answer;
    }

    let formatted = answer;

    // Convert "Documents (1): File.pdf" to "• Documents (1): File.pdf"
    formatted = formatted.replace(/^(Documents|Subfolders|Categories|Tags)(\s*\(\d+\):)/gm, '• $1$2');

    // Remove redundant "total items" statements
    formatted = formatted.replace(/This (folder|category) contains \d+ total items\.?/gi, '');
    formatted = formatted.replace(/Total items:\s*\d+/gi, '');

    // Clean up extra whitespace
    formatted = formatted.replace(/\n\n+/g, '\n');
    formatted = formatted.replace(/\n\s*\n/g, '\n');

    return formatted.trim();
  }

  /**
   * Detect question type
   */
  private detectQuestionType(question: string): QuestionType {
    const lower = question.toLowerCase();

    const isSimple = /^(what is|who is|when|where|which)/.test(lower);
    const isNumerical = /^(how much|how many|what('s| is) the (number|amount|count|total|revenue|cost|price))/.test(lower);
    const isNavigation = /^(what's in|show me|list|where is|find|what (folder|category|document))/.test(lower);
    const isComplex = /^(explain|describe|tell me about|what are (all )?the|how does)/.test(lower);

    return { isSimple, isNumerical, isNavigation, isComplex };
  }

  /**
   * Split text into sentences intelligently
   */
  private splitIntoSentences(text: string): string[] {
    // Split on periods, question marks, exclamation marks
    // But preserve decimals and abbreviations
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim());

    return sentences;
  }

  /**
   * Extract subject from question
   */
  private extractSubject(question: string): string | null {
    // "What is the IRR?" -> "IRR"
    const match1 = question.match(/what(?:'s| is) the (.+?)\?/i);
    if (match1) return match1[1];

    // "How much capital is being raised?" -> "capital raise"
    const match2 = question.match(/how (much|many) (.+?)(?: is| are|\?)/i);
    if (match2) return match2[2];

    // "What was total revenue?" -> "total revenue"
    const match3 = question.match(/what (?:was|were) (.+?)\?/i);
    if (match3) return match3[1];

    return null;
  }

  /**
   * Improve "unable to locate" fallback messages
   */
  improveFallbackMessage(
    originalMessage: string,
    query: string,
    suggestions: string[] = []
  ): string {
    // If not a fallback message, return as-is
    if (!originalMessage.toLowerCase().includes('unable to locate') &&
        !originalMessage.toLowerCase().includes('couldn\'t find') &&
        !originalMessage.toLowerCase().includes('could not find')) {
      return originalMessage;
    }

    let improved = `I couldn't find information about "${query}" in your documents.`;

    // Add suggestions if provided
    if (suggestions.length > 0) {
      improved += `\n\nDid you mean:\n• ${suggestions.join('\n• ')}`;
    } else {
      // Generic helpful suggestions
      improved += `\n\nTry:\n• Rephrasing your question\n• Checking if the document has been uploaded\n• Searching for related topics`;
    }

    return improved;
  }

  /**
   * Replace terminology (e.g., "keys" -> "rooms")
   */
  replaceJargon(answer: string): string {
    let cleaned = answer;

    // Hospitality: "keys" -> "rooms"
    cleaned = cleaned.replace(/\b(\d+)\s+keys\b/gi, '$1 rooms');
    cleaned = cleaned.replace(/\bthe keys\b/gi, 'the rooms');

    return cleaned;
  }

  /**
   * Full pipeline with all improvements
   */
  async processWithAllImprovements(
    answer: string,
    question: string,
    suggestions: string[] = []
  ): Promise<string> {
    let processed = answer;

    // Step 1: Remove citations
    processed = this.removeInlineCitations(processed);

    // Step 2: Replace jargon
    processed = this.replaceJargon(processed);

    // Step 3: Enforce length
    processed = this.enforceLength(processed, question);

    // Step 4: Standardize format
    processed = this.standardizeFormat(processed, question);

    // Step 5: Improve fallback if needed
    processed = this.improveFallbackMessage(processed, question, suggestions);

    return processed.trim();
  }
}

export default new ResponsePostProcessorService();
