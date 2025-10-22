/**
 * Dynamic Summary Scaler
 * Generates dynamic summary requirements based on document size
 * Ensures summaries are proportional to source document length
 */

interface SummaryRequirements {
  lengthDescription: string;
  structureDescription: string;
  useHeaders: boolean;
  isLargeDocument: boolean;
  recommendedParagraphs?: string;
  minTokens?: number;
  maxTokens?: number;
}

class DynamicSummaryScaler {
  /**
   * Get summary requirements based on document page count
   */
  getSummaryRequirements(pageCount: number): SummaryRequirements {
    if (pageCount <= 2) {
      return {
        lengthDescription: '2-3 paragraphs',
        structureDescription: 'Use simple paragraphs. No headers are needed.',
        useHeaders: false,
        isLargeDocument: false,
        recommendedParagraphs: '2-3',
        minTokens: 150,
        maxTokens: 300,
      };
    } else if (pageCount <= 5) {
      return {
        lengthDescription: '3-5 paragraphs',
        structureDescription: 'Use simple paragraphs. Headers are optional but can be used for clarity.',
        useHeaders: false,
        isLargeDocument: false,
        recommendedParagraphs: '3-5',
        minTokens: 250,
        maxTokens: 500,
      };
    } else if (pageCount <= 10) {
      return {
        lengthDescription: '5-7 paragraphs',
        structureDescription: 'You SHOULD use bold section headers to organize the summary for better readability.',
        useHeaders: true,
        isLargeDocument: false,
        recommendedParagraphs: '5-7',
        minTokens: 400,
        maxTokens: 700,
      };
    } else if (pageCount <= 20) {
      return {
        lengthDescription: '7-10 paragraphs',
        structureDescription:
          'You MUST use bold section headers to organize the summary. This is a substantial document and requires structured organization.',
        useHeaders: true,
        isLargeDocument: false,
        recommendedParagraphs: '7-10',
        minTokens: 600,
        maxTokens: 1000,
      };
    } else if (pageCount <= 50) {
      return {
        lengthDescription: '10-15 paragraphs',
        structureDescription:
          'You MUST use bold section headers for each major topic. You can also use nested bullet points for lists of items within sections.',
        useHeaders: true,
        isLargeDocument: true,
        recommendedParagraphs: '10-15',
        minTokens: 1000,
        maxTokens: 1500,
      };
    } else if (pageCount <= 100) {
      return {
        lengthDescription: '15-20 paragraphs',
        structureDescription:
          'You MUST use bold section headers for each major topic. Create a comprehensive, well-organized summary with multiple sections. Include an introductory overview and cover all major themes.',
        useHeaders: true,
        isLargeDocument: true,
        recommendedParagraphs: '15-20',
        minTokens: 1500,
        maxTokens: 2000,
      };
    } else {
      // 100+ pages
      return {
        lengthDescription: 'a comprehensive, multi-section report',
        structureDescription:
          'This is a massive document. Your summary must be a detailed report with an introduction, multiple sections with bold headers, and a conclusion. Consider this a mini-document that captures all major themes, findings, and insights.',
        useHeaders: true,
        isLargeDocument: true,
        recommendedParagraphs: '20+',
        minTokens: 2000,
        maxTokens: 3000,
      };
    }
  }

  /**
   * Build summary prompt instructions based on page count
   */
  buildSummaryPrompt(pageCount: number, documentName: string, userQuery: string): string {
    const requirements = this.getSummaryRequirements(pageCount);

    const promptParts = [
      '=== SUMMARY REQUIREMENTS ===',
      `**CRITICAL:** This is a ${pageCount}-page document. Your summary MUST be **${requirements.lengthDescription}** long.`,
      `**STRUCTURE:** ${requirements.structureDescription}`,
      `**QUALITY:** Your summary must be comprehensive, accurate, and cover all major sections of the document.`,
      `**DETAILS:** Include specific details, numbers, key findings, names, dates, and concrete information from the document.`,
      `**AVOID VAGUENESS:** Do not be generic. Reference actual content from "${documentName}".`,
      '',
    ];

    if (requirements.isLargeDocument) {
      promptParts.push('**LARGE DOCUMENT GUIDELINES:**');
      promptParts.push('- Start with a brief overview paragraph');
      promptParts.push('- Organize content into logical sections with bold headers');
      promptParts.push('- Cover all major themes and topics');
      promptParts.push('- Include key data points, figures, and findings');
      promptParts.push('- End with key takeaways or conclusions if applicable');
      promptParts.push('');
    }

    return promptParts.join('\n');
  }

  /**
   * Check if a summary meets length requirements
   */
  validateSummaryLength(summary: string, pageCount: number): {
    isValid: boolean;
    message: string;
    actualLength: number;
    expectedRange: string;
  } {
    const requirements = this.getSummaryRequirements(pageCount);

    // Count paragraphs (separated by double newlines)
    const paragraphs = summary.split(/\n\n+/).filter(p => p.trim().length > 0);
    const actualLength = paragraphs.length;

    // Parse expected range
    const rangeMatch = requirements.lengthDescription.match(/(\d+)-(\d+)/);

    if (!rangeMatch) {
      // Handle "comprehensive" or other non-numeric descriptions
      return {
        isValid: actualLength >= 10,
        message:
          actualLength >= 10
            ? 'Summary length is adequate'
            : `Summary is too short for a ${pageCount}-page document`,
        actualLength,
        expectedRange: requirements.lengthDescription,
      };
    }

    const minParagraphs = parseInt(rangeMatch[1]);
    const maxParagraphs = parseInt(rangeMatch[2]);

    const isValid = actualLength >= minParagraphs && actualLength <= maxParagraphs * 1.5; // Allow some flexibility

    return {
      isValid,
      message: isValid
        ? 'Summary length is appropriate'
        : `Summary should be ${requirements.lengthDescription} (got ${actualLength} paragraphs)`,
      actualLength,
      expectedRange: `${minParagraphs}-${maxParagraphs} paragraphs`,
    };
  }

  /**
   * Detect if query is asking for a summary
   */
  isSummaryRequest(query: string): boolean {
    const queryLower = query.toLowerCase();

    const summaryKeywords = [
      'summary',
      'summarize',
      'summarise',
      'overview',
      'brief',
      'tldr',
      'tl;dr',
      'main points',
      'key points',
      'give me a',
      'what is this about',
      'what does this document say',
    ];

    return summaryKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Determine if query is asking for an in-depth/detailed summary
   */
  isInDepthSummaryRequest(query: string): boolean {
    const queryLower = query.toLowerCase();

    const inDepthKeywords = [
      'in depth',
      'in-depth',
      'detailed',
      'comprehensive',
      'thorough',
      'complete',
      'full summary',
      'tell me everything',
      'break down',
      'elaborate',
    ];

    return inDepthKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Adjust page count for in-depth requests (treat as larger document)
   */
  getAdjustedPageCount(pageCount: number, isInDepthRequest: boolean): number {
    if (isInDepthRequest) {
      // Treat as 1.5x larger for in-depth requests
      return Math.ceil(pageCount * 1.5);
    }
    return pageCount;
  }

  /**
   * Generate appropriate follow-up suggestion based on summary type
   */
  generateSummaryFollowUp(pageCount: number, wasDetailed: boolean): string {
    if (pageCount > 20) {
      if (wasDetailed) {
        return 'Would you like me to focus on a specific section or aspect of this document?';
      } else {
        return 'Would you like a more detailed summary with additional insights?';
      }
    } else if (pageCount > 5) {
      return 'Would you like me to elaborate on any specific section?';
    } else {
      return 'Do you have any questions about specific details in the document?';
    }
  }
}

export default new DynamicSummaryScaler();
export { DynamicSummaryScaler, SummaryRequirements };
