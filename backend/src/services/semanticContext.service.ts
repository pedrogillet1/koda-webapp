/**
 * Semantic Context Analyzer
 * Analyzes queries to understand true intent and context
 */

interface SemanticAnalysis {
  interpretedQuery: string;
  contextType: 'business' | 'technical' | 'general';
  complexity: 'simple' | 'moderate' | 'complex';
  requiresDocuments: boolean;
  acronymsFound: Array<{acronym: string; expansion: string}>;
}

interface DocumentContext {
  id?: string;
  name?: string;
  type?: string;
  content?: string;
  pageCount?: number;
}

class SemanticContextAnalyzer {
  private businessAcronyms: Record<string, string> = {
    icp: 'Ideal Customer Profile',
    tam: 'Total Addressable Market',
    sam: 'Serviceable Addressable Market',
    som: 'Serviceable Obtainable Market',
    cac: 'Customer Acquisition Cost',
    ltv: 'Lifetime Value',
    clv: 'Customer Lifetime Value',
    arr: 'Annual Recurring Revenue',
    mrr: 'Monthly Recurring Revenue',
    roi: 'Return on Investment',
    mvp: 'Minimum Viable Product',
    gtm: 'Go-To-Market',
    b2b: 'Business to Business',
    b2c: 'Business to Consumer',
    saas: 'Software as a Service',
    kpi: 'Key Performance Indicator',
    cogs: 'Cost of Goods Sold',
    ebitda: 'Earnings Before Interest, Taxes, Depreciation, and Amortization',
    yoy: 'Year over Year',
    qoq: 'Quarter over Quarter',
    p2p: 'Peer to Peer',
  };

  private technicalAcronyms: Record<string, string> = {
    api: 'Application Programming Interface',
    ui: 'User Interface',
    ux: 'User Experience',
    ai: 'Artificial Intelligence',
    ml: 'Machine Learning',
    rag: 'Retrieval-Augmented Generation',
    llm: 'Large Language Model',
    nlp: 'Natural Language Processing',
    sdk: 'Software Development Kit',
    ide: 'Integrated Development Environment',
    orm: 'Object-Relational Mapping',
    crud: 'Create, Read, Update, Delete',
    rest: 'Representational State Transfer',
    json: 'JavaScript Object Notation',
    xml: 'Extensible Markup Language',
    sql: 'Structured Query Language',
    nosql: 'Not Only SQL',
    cicd: 'Continuous Integration/Continuous Deployment',
    aws: 'Amazon Web Services',
    gcp: 'Google Cloud Platform',
  };

  /**
   * Analyze query in semantic context to understand true intent
   */
  analyzeQueryContext(
    userQuery: string,
    documentsAvailable: DocumentContext[],
    conversationContext?: string
  ): SemanticAnalysis {
    const queryLower = userQuery.toLowerCase();

    // Detect context type
    const contextType = this.detectContextType(queryLower, documentsAvailable);

    // Expand acronyms based on context
    const { interpretedQuery, acronymsFound } = this.expandAcronyms(userQuery, contextType);

    // Assess query complexity
    const complexity = this.assessComplexity(userQuery);

    // Check if documents are needed
    const requiresDocuments = this.requiresDocuments(queryLower, documentsAvailable);

    return {
      interpretedQuery,
      contextType,
      complexity,
      requiresDocuments,
      acronymsFound,
    };
  }

  /**
   * Detect whether query is business, technical, or general context
   */
  private detectContextType(
    queryLower: string,
    documentsAvailable: DocumentContext[]
  ): 'business' | 'technical' | 'general' {
    // Check document names and types for context clues
    const docContext = documentsAvailable
      .map(d => `${d.name || ''} ${d.type || ''}`)
      .join(' ')
      .toLowerCase();

    // Business context indicators
    const businessIndicators = [
      'business plan',
      'financial',
      'revenue',
      'profit',
      'investment',
      'market',
      'customer',
      'strategy',
      'sales',
      'growth',
      'funding',
      'valuation',
      'budget',
      'forecast',
      'p&l',
      'balance sheet',
      'income statement',
      'cash flow',
    ];

    // Technical context indicators
    const technicalIndicators = [
      'code',
      'system',
      'architecture',
      'api',
      'database',
      'server',
      'implementation',
      'technical',
      'development',
      'software',
      'programming',
      'algorithm',
      'infrastructure',
    ];

    // Check query and documents
    const combinedText = queryLower + ' ' + docContext;

    const businessScore = businessIndicators.filter(ind => combinedText.includes(ind)).length;
    const technicalScore = technicalIndicators.filter(ind => combinedText.includes(ind)).length;

    if (businessScore > technicalScore) {
      return 'business';
    } else if (technicalScore > businessScore) {
      return 'technical';
    } else {
      return 'general';
    }
  }

  /**
   * Expand acronyms based on context
   */
  private expandAcronyms(
    query: string,
    contextType: 'business' | 'technical' | 'general'
  ): { interpretedQuery: string; acronymsFound: Array<{acronym: string; expansion: string}> } {
    // Choose acronym dictionary based on context
    let acronymDict: Record<string, string>;
    if (contextType === 'business') {
      acronymDict = this.businessAcronyms;
    } else if (contextType === 'technical') {
      acronymDict = this.technicalAcronyms;
    } else {
      acronymDict = { ...this.businessAcronyms, ...this.technicalAcronyms };
    }

    const acronymsFound: Array<{acronym: string; expansion: string}> = [];
    const words = query.split(/\s+/);

    for (const word of words) {
      const wordClean = word.toLowerCase().replace(/[.,!?;:()]/g, '');
      if (acronymDict[wordClean]) {
        acronymsFound.push({
          acronym: wordClean.toUpperCase(),
          expansion: acronymDict[wordClean],
        });
      }
    }

    // Return original query (we'll use acronyms in prompt context)
    return { interpretedQuery: query, acronymsFound };
  }

  /**
   * Assess query complexity to guide response length
   */
  private assessComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = query.split(/\s+/).length;
    const queryLower = query.toLowerCase();

    // Simple: Short, direct questions
    const simplePatterns = [
      /^what is \w+/,
      /^who is \w+/,
      /^when is \w+/,
      /^where is \w+/,
      /^how much/,
      /^how many/,
    ];

    // Complex: Multi-part, analytical questions
    const complexIndicators = [
      'analyze',
      'compare',
      'explain in detail',
      'comprehensive',
      'in depth',
      'elaborate',
      'break down',
      'walk me through',
      'tell me everything',
      'full analysis',
      'thorough',
      'detailed summary',
    ];

    // Check for simple patterns
    if (simplePatterns.some(pattern => pattern.test(queryLower))) {
      return 'simple';
    }

    // Check for complex indicators
    if (complexIndicators.some(indicator => queryLower.includes(indicator))) {
      return 'complex';
    }

    // Use word count as fallback
    if (wordCount <= 5) {
      return 'simple';
    } else if (wordCount <= 12) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  /**
   * Determine if query requires document content
   */
  private requiresDocuments(queryLower: string, documentsAvailable: DocumentContext[]): boolean {
    // General knowledge patterns (don't need documents)
    const generalPatterns = [
      /what is the definition of/,
      /what does .* mean/,
      /explain the concept of/,
      /how does .* work in general/,
    ];

    // If no documents available, it's general knowledge
    if (!documentsAvailable || documentsAvailable.length === 0) {
      return false;
    }

    // Check if query matches general knowledge patterns
    if (generalPatterns.some(pattern => pattern.test(queryLower))) {
      // But if documents are highly relevant, still use them
      const docNames = documentsAvailable.map(d => d.name || '').join(' ').toLowerCase();
      const queryWords = new Set(queryLower.split(/\s+/));
      const docWords = new Set(docNames.split(/\s+/));

      const overlap = [...queryWords].filter(word => docWords.has(word)).length;

      return overlap >= 2; // Significant overlap suggests document relevance
    }

    return true; // Default: use documents if available
  }

  /**
   * Build semantic context prompt addition
   */
  buildSemanticPrompt(analysis: SemanticAnalysis): string {
    const parts: string[] = [];

    if (analysis.acronymsFound.length > 0) {
      parts.push('=== SEMANTIC CONTEXT ===');
      parts.push('The following acronyms were detected in the query:');

      for (const { acronym, expansion } of analysis.acronymsFound) {
        parts.push(`- ${acronym} = ${expansion}`);
      }

      parts.push(`\nContext type: ${analysis.contextType}`);
      parts.push(`Query complexity: ${analysis.complexity}`);
      parts.push('');
      parts.push('IMPORTANT: Use the correct expansion for these acronyms based on the context above.');
      parts.push('Do NOT use generic definitions when a specific meaning is provided.');
      parts.push('');
    }

    return parts.join('\n');
  }
}

export default new SemanticContextAnalyzer();
export { SemanticContextAnalyzer, SemanticAnalysis, DocumentContext };
