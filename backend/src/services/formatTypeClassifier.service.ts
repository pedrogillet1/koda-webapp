/**
 * Format Type Classifier Service
 *
 * Classifies queries into 6 response format types based on ChatGPT Format Analysis
 *
 * IMPORTANT: All formatters use bullet points (•) and NO emoji
 */

export enum ResponseFormatType {
  FEATURE_LIST = 'feature_list',           // Comprehensive overview queries
  STRUCTURED_LIST = 'structured_list',     // Specific attribute queries with closing statement
  DOCUMENT_LIST = 'document_list',         // "Which documents mention X?" queries
  TABLE = 'table',                         // Comparison/categorization queries
  DIRECT_ANSWER = 'direct_answer',         // Factual queries with breakdown
  SIMPLE_LIST = 'simple_list',             // Entity extraction queries
}

export interface FormatClassification {
  formatType: ResponseFormatType;
  reason: string;
  shouldBypassAI?: boolean; // For DOCUMENT_LIST - bypass AI and format directly
}

export class FormatTypeClassifierService {

  /**
   * Classify query into appropriate response format type
   */
  classify(query: string): FormatClassification {
    const queryLower = query.toLowerCase().trim();

    // Type 3: documents List Queries
    // "Which documents mention X?", "Show me all documents", "What files contain Y?"
    if (this.isDocumentListQuery(queryLower)) {
      console.log(`   📋 Format Type: DOCUMENT_LIST`);
      return {
        formatType: ResponseFormatType.DOCUMENT_LIST,
        reason: 'User asking for document/file listing',
        shouldBypassAI: true // Extract filenames directly, don't use AI
      };
    }

    // Type 4: Table Queries
    // "Compare X and Y", "Categorize documents", "Technical vs business docs"
    if (this.isTableQuery(queryLower)) {
      console.log(`   📊 Format Type: TABLE`);
      return {
        formatType: ResponseFormatType.TABLE,
        reason: 'User requesting comparison or categorization'
      };
    }

    // Type 5: Direct Answer Queries
    // "What is the expiration date?", "How much revenue?", "When was X created?"
    if (this.isDirectAnswerQuery(queryLower)) {
      console.log(`   🎯 Format Type: DIRECT_ANSWER`);
      return {
        formatType: ResponseFormatType.DIRECT_ANSWER,
        reason: 'User asking for specific fact or value'
      };
    }

    // Type 6: Simple List Queries
    // "List all X", "Show me Y", entity extraction
    if (this.isSimpleListQuery(queryLower)) {
      console.log(`   📝 Format Type: SIMPLE_LIST`);
      return {
        formatType: ResponseFormatType.SIMPLE_LIST,
        reason: 'User requesting simple entity list'
      };
    }

    // Type 2: Structured List Queries
    // "What features does X have?", "What are the benefits of Y?"
    if (this.isStructuredListQuery(queryLower)) {
      console.log(`   📋 Format Type: STRUCTURED_LIST`);
      return {
        formatType: ResponseFormatType.STRUCTURED_LIST,
        reason: 'User asking for specific attributes with context'
      };
    }

    // Type 1: Feature List Queries (Default for comprehensive queries)
    // "Tell me about X", "What does the business plan say?", "Explain Y"
    console.log(`   📄 Format Type: FEATURE_LIST (default)`);
    return {
      formatType: ResponseFormatType.FEATURE_LIST,
      reason: 'User asking for comprehensive overview'
    };
  }

  /**
   * Type 3: documents List Queries
   * "Which documents mention X?", "Show me all files", "What PDFs do I have?"
   */
  private isDocumentListQuery(query: string): boolean {
    const patterns = [
      /^(show me|list|display|give me)\s+(all|the)?\s*(documents?|files?)/i,
      /^which (documents?|files?)/i,
      /^what (documents?|files?) (do i have|are|contain|mention)/i,
      /^find (all|the)?\s*(documents?|files?)/i,
      /documents?\s+(about|related to|regarding|concerning)/i,
      /all.*documents?.*mention/i,
      /do i have.*(pdf|excel|word|powerpoint|documents?|files?)/i,
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Type 4: Table Queries
   * "Compare X and Y", "Categorize documents by type", "Technical vs business"
   */
  private isTableQuery(query: string): boolean {
    const patterns = [
      /compare|comparison|versus|vs\.?/i,
      /categorize|group by|organize by/i,
      /technical (vs|versus) business/i,
      /difference between/i,
      /side by side/i,
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Type 5: Direct Answer Queries
   * "What is X?", "When was Y?", "How much Z?", "Who is A?"
   */
  private isDirectAnswerQuery(query: string): boolean {
    const patterns = [
      /^what is (the|my)? ?(expiration date|date|amount|value|price|revenue|cost)/i,
      /^when (does|did|is|was)/i,
      /^how much/i,
      /^who (is|was)/i,
      /^where (is|was)/i,
      /^what (are|is) the (total|amount|value|price)/i,
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Type 6: Simple List Queries
   * "List all X", "Show me categories", entity extraction
   */
  private isSimpleListQuery(query: string): boolean {
    const patterns = [
      /^list (all|the)/i,
      /^show me (the|all)? ?(categories|tags|folders)/i,
      /^what (categories|tags|folders)/i,
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Type 2: Structured List Queries
   * "What features does X have?", "What are the benefits?", "What capabilities?"
   */
  private isStructuredListQuery(query: string): boolean {
    const patterns = [
      /what (features|benefits|capabilities|advantages)/i,
      /what does .* (offer|provide|include)/i,
      /what are the (key|main|primary) (features|benefits|points)/i,
    ];

    return patterns.some(pattern => pattern.test(query));
  }
}

export default new FormatTypeClassifierService();
