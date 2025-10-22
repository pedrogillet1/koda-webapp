/**
 * Query Rewriter Service
 * Normalizes and expands queries before retrieval to improve search accuracy
 * Handles acronym expansion, synonym normalization, and semantic context injection
 */

import semanticContextService from './semanticContext.service';
import { detectLanguage } from './languageDetection.service';

interface RewrittenQuery {
  original: string;
  rewritten: string;
  expansions: Array<{ term: string; expansion: string }>;
  normalizations: string[];
  language: string;
}

interface QueryRewriteContext {
  conversationHistory?: Array<{ query: string; response: string }>;
  documents?: Array<{ name: string; type: string }>;
}

class QueryRewriterService {
  /**
   * Main query rewriting function
   */
  async rewriteQuery(
    query: string,
    context: QueryRewriteContext = {}
  ): Promise<string> {
    console.log(`🔄 Query rewriting: "${query}"`);

    const result = this.rewriteQueryDetailed(query, context);

    if (result.expansions.length > 0) {
      console.log(`   Acronym expansions: ${result.expansions.map(e => `${e.term} → ${e.expansion}`).join(', ')}`);
    }

    if (result.normalizations.length > 0) {
      console.log(`   Normalizations: ${result.normalizations.join(', ')}`);
    }

    console.log(`   Rewritten: "${result.rewritten}"`);

    return result.rewritten;
  }

  /**
   * Detailed query rewriting with full metadata
   */
  rewriteQueryDetailed(
    query: string,
    context: QueryRewriteContext = {}
  ): RewrittenQuery {
    const language = detectLanguage(query);

    let rewritten = query;
    const expansions: Array<{ term: string; expansion: string }> = [];
    const normalizations: string[] = [];

    // Step 1: Normalize query
    rewritten = this.normalizeQuery(rewritten, normalizations);

    // Step 2: Expand acronyms
    rewritten = this.expandAcronyms(rewritten, language, expansions);

    // Step 3: Add conversational context if available
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      rewritten = this.addConversationalContext(rewritten, context.conversationHistory);
    }

    // Step 4: Expand synonyms for better matching
    rewritten = this.expandSynonyms(rewritten, language);

    return {
      original: query,
      rewritten,
      expansions,
      normalizations,
      language
    };
  }

  /**
   * Normalizes query (lowercase, trim, remove extra spaces, etc.)
   */
  private normalizeQuery(query: string, normalizations: string[]): string {
    let normalized = query;

    // Trim whitespace
    normalized = normalized.trim();

    // Remove multiple spaces
    const before = normalized;
    normalized = normalized.replace(/\s+/g, ' ');
    if (before !== normalized) {
      normalizations.push('removed extra spaces');
    }

    // Normalize quotes
    normalized = normalized.replace(/[""]/g, '"');
    normalized = normalized.replace(/['']/g, "'");

    return normalized;
  }

  /**
   * Expands acronyms based on context
   */
  private expandAcronyms(
    query: string,
    language: string,
    expansions: Array<{ term: string; expansion: string }>
  ): string {
    // Detect context type to choose appropriate acronym dictionary
    const words = query.toLowerCase().split(/\s+/);

    // Business acronyms (from semanticContext.service.ts)
    const businessAcronyms: Record<string, string> = {
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

    // Technical acronyms
    const technicalAcronyms: Record<string, string> = {
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

    // Combine dictionaries
    const allAcronyms = { ...businessAcronyms, ...technicalAcronyms };

    // Expand acronyms in query
    let expanded = query;

    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:()]/g, '');

      if (allAcronyms[cleanWord]) {
        const expansion = allAcronyms[cleanWord];

        // Replace in query (case-insensitive)
        const regex = new RegExp(`\\b${cleanWord}\\b`, 'gi');
        expanded = expanded.replace(regex, `${cleanWord.toUpperCase()} (${expansion})`);

        expansions.push({
          term: cleanWord.toUpperCase(),
          expansion
        });
      }
    }

    return expanded;
  }

  /**
   * Adds conversational context for follow-up questions
   */
  private addConversationalContext(
    query: string,
    conversationHistory: Array<{ query: string; response: string }>
  ): string {
    // If query is very short or uses pronouns, it's likely a follow-up
    const isFollowUp = this.detectFollowUpPattern(query);

    if (!isFollowUp) {
      return query;
    }

    // Get last query and response
    const lastTurn = conversationHistory[conversationHistory.length - 1];

    if (!lastTurn) {
      return query;
    }

    // Extract key terms from previous query
    const previousKeyTerms = this.extractKeyTerms(lastTurn.query);

    // If current query is short and previous had substance, add context
    if (query.split(/\s+/).length < 5 && previousKeyTerms.length > 0) {
      return `${query} (context: ${previousKeyTerms.join(', ')})`;
    }

    return query;
  }

  /**
   * Detects if query is a follow-up question
   */
  private detectFollowUpPattern(query: string): boolean {
    const queryLower = query.toLowerCase();

    const followUpPatterns = [
      /^(tell me |give me |show me )?more/i,
      /^(can you |could you )?explain/i,
      /^(what|how|why) about (it|that|this|them)/i,
      /^(and |also )?what (about|is)/i,
      /^(the |a |an )?(same|similar)/i,
      /\b(it|that|this|them|they)\b/i, // Contains pronouns
    ];

    return followUpPatterns.some(pattern => pattern.test(queryLower));
  }

  /**
   * Extracts key terms from a query (nouns, proper nouns)
   */
  private extractKeyTerms(query: string): string[] {
    const words = query.split(/\s+/);
    const keyTerms: string[] = [];

    for (const word of words) {
      const cleanWord = word.replace(/[.,!?;:()]/g, '');

      // Skip common words
      const commonWords = ['what', 'is', 'the', 'a', 'an', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'should'];
      if (commonWords.includes(cleanWord.toLowerCase())) {
        continue;
      }

      // Keep capitalized words (likely proper nouns) and longer words
      if (cleanWord[0] === cleanWord[0].toUpperCase() || cleanWord.length > 5) {
        keyTerms.push(cleanWord);
      }
    }

    return keyTerms.slice(0, 3); // Limit to top 3
  }

  /**
   * Expands synonyms for better semantic matching
   */
  private expandSynonyms(query: string, language: string): string {
    // English synonyms
    const synonyms: Record<string, string[]> = {
      summary: ['summary', 'overview', 'synopsis', 'abstract'],
      explain: ['explain', 'describe', 'clarify', 'elaborate'],
      compare: ['compare', 'contrast', 'difference', 'versus'],
      list: ['list', 'enumerate', 'outline'],
      find: ['find', 'search', 'locate', 'identify'],
      show: ['show', 'display', 'present', 'demonstrate'],
    };

    // Portuguese synonyms
    const synonymsPt: Record<string, string[]> = {
      resumo: ['resumo', 'sumário', 'síntese'],
      explicar: ['explicar', 'descrever', 'esclarecer'],
      comparar: ['comparar', 'contrastar', 'diferença'],
      listar: ['listar', 'enumerar'],
    };

    // Spanish synonyms
    const synonymsEs: Record<string, string[]> = {
      resumen: ['resumen', 'síntesis', 'sumario'],
      explicar: ['explicar', 'describir', 'aclarar'],
      comparar: ['comparar', 'contrastar', 'diferencia'],
      listar: ['listar', 'enumerar'],
    };

    // Choose synonyms based on language
    let activeSynonyms = synonyms;
    if (language === 'pt') {
      activeSynonyms = { ...synonyms, ...synonymsPt };
    } else if (language === 'es') {
      activeSynonyms = { ...synonyms, ...synonymsEs };
    }

    // For now, just return query as-is
    // Full synonym expansion would make queries too long
    // Better to rely on semantic embeddings for this

    return query;
  }

  /**
   * Detects query type for better processing
   */
  detectQueryType(query: string): string {
    const queryLower = query.toLowerCase();

    // Summary requests
    if (/\b(summ?ari[sz]e?|overview|synopsis|resumo|resumen)\b/i.test(queryLower)) {
      return 'summary';
    }

    // Comparison requests
    if (/\b(compar[ae]|contrast|difference|versus|vs|diferença)\b/i.test(queryLower)) {
      return 'comparison';
    }

    // List requests
    if (/\b(list|enumerate|outline|listar|enumerar)\b/i.test(queryLower)) {
      return 'list';
    }

    // Explanation requests
    if (/\b(explain|describe|clarify|elaborate|what is|explicar|descrever)\b/i.test(queryLower)) {
      return 'explanation';
    }

    // Factual queries
    if (/\b(how much|how many|when|where|who|quanto|quantos|quando|onde|quem)\b/i.test(queryLower)) {
      return 'factual';
    }

    return 'general';
  }
}

export default new QueryRewriterService();
export { QueryRewriterService, RewrittenQuery, QueryRewriteContext };
