/**
 * Multi-Document Query Service
 *
 * Detects when queries require information from multiple documents
 * (e.g., comparisons, cross-document searches)
 *
 * Examples:
 * - "Compare document A and B"
 * - "What information appears in both X and Y?"
 * - "Differences between X and Y"
 */

export class MultiDocumentQueryService {

  /**
   * Detect if query requires multiple documents
   */
  isMultiDocumentQuery(query: string): boolean {
    const multiDocPatterns = [
      // Comparison queries
      /compare/i,
      /comparison/i,
      /difference.*between/i,
      /similarities.*between/i,
      /versus|vs\.?/i,
      /contrast/i,

      // Both/And queries
      /both.*and/i,
      /\band\b.*\band\b/i,  // "X and Y" (multiple "and"s)
      /in (both|all)/i,

      // Multiple document references
      /which (documents|files).*mention/i,
      /all (documents|files) (that|which)/i,
      /across (all|multiple) (documents|files)/i,
    ];

    const isMultiDoc = multiDocPatterns.some(pattern => pattern.test(query));

    if (isMultiDoc) {
      console.log(`   🔄 Multi-document query detected`);
    }

    return isMultiDoc;
  }

  /**
   * Detect query type for multi-document handling
   */
  getMultiDocumentQueryType(query: string): 'comparison' | 'cross_search' | 'aggregation' | 'general' {
    const queryLower = query.toLowerCase();

    // Comparison query
    if (/compare|comparison|difference|versus|vs\.?|contrast/.test(queryLower)) {
      return 'comparison';
    }

    // Cross-document search
    if (/which.*mention|all.*that.*contain|across.*documents/.test(queryLower)) {
      return 'cross_search';
    }

    // Aggregation query
    if (/total|sum|count|all.*combined/.test(queryLower)) {
      return 'aggregation';
    }

    return 'general';
  }

  /**
   * Extract comparison subjects from query
   * e.g., "Compare X and Y" → ["X", "Y"]
   */
  extractComparisonSubjects(query: string): string[] {
    const subjects: string[] = [];

    // Pattern 1: "Compare X and Y"
    const pattern1 = /compare\s+(.+?)\s+and\s+(.+?)(?:\s|$|\.|\?)/i;
    const match1 = query.match(pattern1);
    if (match1) {
      subjects.push(match1[1].trim(), match1[2].trim());
    }

    // Pattern 2: "X versus Y"
    const pattern2 = /(.+?)\s+(?:versus|vs\.?)\s+(.+?)(?:\s|$|\.|\?)/i;
    const match2 = query.match(pattern2);
    if (match2) {
      subjects.push(match2[1].trim(), match2[2].trim());
    }

    // Pattern 3: "Differences between X and Y"
    const pattern3 = /between\s+(.+?)\s+and\s+(.+?)(?:\s|$|\.|\?)/i;
    const match3 = query.match(pattern3);
    if (match3) {
      subjects.push(match3[1].trim(), match3[2].trim());
    }

    return subjects.filter(s => s.length > 0);
  }
}

export default new MultiDocumentQueryService();
