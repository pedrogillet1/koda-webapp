/**
 * Proactive Suggestions Service - Phase 1 Week 4
 * Provides proactive next-step suggestions based on query context
 * Makes KODA feel like a secretary that anticipates needs
 */

export interface ProactiveSuggestion {
  suggestion: string;
  category: 'analysis' | 'action' | 'navigation' | 'comparison' | 'follow_up';
  priority: 'high' | 'medium' | 'low';
}

class ProactiveSuggestionsService {
  /**
   * Generate proactive suggestions based on query and sources
   */
  generateSuggestions(
    query: string,
    sources: any[],
    intent: string
  ): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];

    // Analyze query context
    const queryLower = query.toLowerCase();
    const documentNames = sources.map(s => s.documentName);
    const uniqueDocs = [...new Set(documentNames)];

    // 1. Comparison suggestions - if user looked at one document, suggest related ones
    if (uniqueDocs.length === 1 && this.hasMultipleVersions(uniqueDocs[0], sources)) {
      suggestions.push({
        suggestion: `Would you like to compare this with other versions of the same document?`,
        category: 'comparison',
        priority: 'high',
      });
    }

    // 2. Related documents suggestions
    if (uniqueDocs.length === 1) {
      suggestions.push({
        suggestion: `Want to see related documents on the same topic?`,
        category: 'navigation',
        priority: 'medium',
      });
    }

    // 3. Deep dive suggestions - if answer is high-level, offer details
    if (intent === 'summarize' || queryLower.includes('summary') || queryLower.includes('overview')) {
      suggestions.push({
        suggestion: `Need more details on any specific section?`,
        category: 'follow_up',
        priority: 'high',
      });
    }

    // 4. Multi-document analysis - if user asked about multiple docs, suggest synthesis
    if (uniqueDocs.length >= 2) {
      suggestions.push({
        suggestion: `Would you like me to analyze trends or patterns across these documents?`,
        category: 'analysis',
        priority: 'high',
      });
    }

    // 5. Financial data suggestions
    if (this.hasFinancialData(sources)) {
      if (!queryLower.includes('trend') && !queryLower.includes('change')) {
        suggestions.push({
          suggestion: `Want to see trends or changes over time?`,
          category: 'analysis',
          priority: 'medium',
        });
      }
    }

    // 6. Action-oriented suggestions for contracts/agreements
    if (this.isContractOrAgreement(uniqueDocs)) {
      suggestions.push({
        suggestion: `Should I highlight key dates, obligations, or renewal terms?`,
        category: 'action',
        priority: 'high',
      });
    }

    // 7. Presentation suggestions - offer to create summary or export
    if (this.isPresentationDocument(sources)) {
      suggestions.push({
        suggestion: `Would you like a summary of key slides or talking points?`,
        category: 'analysis',
        priority: 'medium',
      });
    }

    // 8. Spreadsheet analysis suggestions
    if (this.hasSpreadsheetData(sources)) {
      suggestions.push({
        suggestion: `Want me to analyze calculations or formulas in the spreadsheet?`,
        category: 'analysis',
        priority: 'medium',
      });
    }

    // 9. Comparison trigger - if user viewed similar named docs
    if (this.hasSimilarNamedDocuments(uniqueDocs)) {
      suggestions.push({
        suggestion: `These documents have similar names. Should I compare them?`,
        category: 'comparison',
        priority: 'high',
      });
    }

    // 10. Follow-up clarification - if answer might be ambiguous
    if (sources.length > 5) {
      suggestions.push({
        suggestion: `This information comes from multiple sources. Want me to focus on a specific document?`,
        category: 'follow_up',
        priority: 'medium',
      });
    }

    // Limit to top 3 suggestions, prioritized by priority
    return this.prioritizeAndLimit(suggestions, 3);
  }

  /**
   * Check if there are multiple versions of the same document
   */
  private hasMultipleVersions(docName: string, sources: any[]): boolean {
    const baseName = docName.replace(/\s*\(?\d+\)?\..*$/, ''); // Remove (1), (2), etc.
    const similarDocs = sources.filter(s =>
      s.documentName.includes(baseName) && s.documentName !== docName
    );
    return similarDocs.length > 0;
  }

  /**
   * Check if sources contain financial data patterns
   */
  private hasFinancialData(sources: any[]): boolean {
    const financialPatterns = [
      /\$\d+/,
      /revenue|expense|profit|loss|budget|cost/i,
      /\d+%/,
      /Q[1-4]|quarter|annual|fiscal/i,
    ];

    return sources.some(s =>
      financialPatterns.some(pattern => pattern.test(s.content))
    );
  }

  /**
   * Check if document is a contract or agreement
   */
  private isContractOrAgreement(docNames: string[]): boolean {
    const contractPatterns = [
      /contract|agreement|terms|license|NDA/i,
    ];

    return docNames.some(name =>
      contractPatterns.some(pattern => pattern.test(name))
    );
  }

  /**
   * Check if source is from a presentation
   */
  private isPresentationDocument(sources: any[]): boolean {
    return sources.some(s =>
      s.document_metadata?.slideNumber !== undefined ||
      s.documentName.match(/\.pptx?$/i)
    );
  }

  /**
   * Check if source is from a spreadsheet
   */
  private hasSpreadsheetData(sources: any[]): boolean {
    return sources.some(s =>
      s.document_metadata?.sheetName !== undefined ||
      s.document_metadata?.cellRef !== undefined ||
      s.documentName.match(/\.xlsx?$/i)
    );
  }

  /**
   * Check if documents have similar names (might be versions/variations)
   */
  private hasSimilarNamedDocuments(docNames: string[]): boolean {
    if (docNames.length < 2) return false;

    for (let i = 0; i < docNames.length; i++) {
      for (let j = i + 1; j < docNames.length; j++) {
        const name1 = docNames[i].toLowerCase().replace(/[^a-z0-9]/g, '');
        const name2 = docNames[j].toLowerCase().replace(/[^a-z0-9]/g, '');

        // Calculate similarity (simple approach: check if one contains the other)
        if (name1.includes(name2) || name2.includes(name1)) {
          return true;
        }

        // Check for common prefixes (first 60% of characters)
        const minLength = Math.min(name1.length, name2.length);
        const prefixLength = Math.floor(minLength * 0.6);
        if (name1.substring(0, prefixLength) === name2.substring(0, prefixLength)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Prioritize and limit suggestions
   */
  private prioritizeAndLimit(
    suggestions: ProactiveSuggestion[],
    limit: number
  ): ProactiveSuggestion[] {
    // Sort by priority (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const sorted = suggestions.sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    return sorted.slice(0, limit);
  }

  /**
   * Format suggestions for display
   */
  formatSuggestions(suggestions: ProactiveSuggestion[]): string {
    if (suggestions.length === 0) {
      return '';
    }

    let formatted = '\n\n**Next steps:**\n';
    suggestions.forEach((s, idx) => {
      formatted += `• ${s.suggestion}\n`;
    });

    return formatted;
  }

  /**
   * Generate suggestions and format them in one call
   */
  generateAndFormat(query: string, sources: any[], intent: string): string {
    const suggestions = this.generateSuggestions(query, sources, intent);
    return this.formatSuggestions(suggestions);
  }
}

export const proactiveSuggestionsService = new ProactiveSuggestionsService();
export default proactiveSuggestionsService;
