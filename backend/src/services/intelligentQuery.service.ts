/**
 * Intelligent Query Service
 *
 * PURPOSE: Enhance RAG answers with extracted knowledge from the knowledge graph
 * WHY: Transform generic RAG responses into ChatGPT-level intelligent answers
 * HOW: Detect query type, then augment with definitions, causal reasoning, trends, etc.
 *
 * Query Types Supported:
 * 1. Definition: "What is X?" → Add stored definition + formula + interpretation
 * 2. Comparison: "Compare X vs Y" → Add structured comparison data
 * 3. Why/Causal: "Why did X happen?" → Add causal relationships
 * 4. Trend: "How has X changed?" → Add trend analysis
 * 5. Methodology: "What approaches..." → Add methodology aggregation
 *
 * Example:
 * Q: "Why did portfolio returns decrease?"
 * RAG Answer: "Returns decreased as mentioned in doc1, doc2..."
 * Enhanced: "Returns decreased for 3 key reasons:
 *            1. Market volatility (high confidence)
 *            2. Interest rate increases
 *            3. Sector rotation
 *            [Original RAG answer follows]"
 */

import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type QueryType =
  | 'definition'      // "What is X?"
  | 'comparison'      // "Compare X vs Y"
  | 'why'             // "Why did X happen?"
  | 'how'             // "How does X work?"
  | 'trend'           // "How has X changed?"
  | 'methodology'     // "What approaches/methods..."
  | 'aggregation'     // "Across all documents..."
  | 'recommendation'  // "What should I do?"
  | 'general';        // Default RAG query

export interface EnhancementResult {
  enhancedAnswer: string;
  queryType: QueryType;
  knowledgeUsed: boolean;
  sourceCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY TYPE DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const QUERY_TYPE_PATTERNS: Record<QueryType, RegExp[]> = {
  definition: [
    /what (?:is|are) (?:a |an |the )?([a-zA-Z\s\-]+)\??$/i,
    /define (?:the )?([a-zA-Z\s\-]+)/i,
    /(?:explain|describe) (?:what )?(?:a |an |the )?([a-zA-Z\s\-]+) (?:is|means)/i,
    /what (?:does|do) ([a-zA-Z\s\-]+) mean/i,
  ],
  comparison: [
    /compare ([a-zA-Z\s\-]+) (?:and|vs\.?|versus|with|to) ([a-zA-Z\s\-]+)/i,
    /(?:what (?:is|are) )?(?:the )?difference(?:s)? between ([a-zA-Z\s\-]+) and ([a-zA-Z\s\-]+)/i,
    /([a-zA-Z\s\-]+) vs\.? ([a-zA-Z\s\-]+)/i,
    /how (?:does|do) ([a-zA-Z\s\-]+) compare to ([a-zA-Z\s\-]+)/i,
  ],
  why: [
    /why (?:did|does|do|is|are|was|were|has|have) ([^?]+)\??/i,
    /what (?:caused|causes|is causing) ([^?]+)\??/i,
    /(?:what (?:is|are) )?(?:the )?reason(?:s)? (?:for|why|behind) ([^?]+)\??/i,
    /how come ([^?]+)\??/i,
  ],
  how: [
    /how (?:does|do|can|could|should|would) ([^?]+) work\??/i,
    /how (?:to|can I|do I|should I) ([^?]+)\??/i,
    /explain how ([^?]+)/i,
  ],
  trend: [
    /how ha(?:s|ve) ([a-zA-Z\s\-]+) (?:changed|evolved|developed|progressed)/i,
    /(?:what (?:is|are) )?(?:the )?trend(?:s)? (?:in|of|for) ([^?]+)\??/i,
    /(?:is|are) ([a-zA-Z\s\-]+) (?:increasing|decreasing|growing|declining)/i,
    /evolution of ([a-zA-Z\s\-]+)/i,
  ],
  methodology: [
    /what (?:are )?(?:the )?(?:main |primary |key )?(?:approaches|methods|methodologies|techniques)/i,
    /which (?:approaches|methods|methodologies|techniques)/i,
    /how (?:is|are|was|were) ([a-zA-Z\s\-]+) (?:done|performed|conducted|implemented)/i,
  ],
  aggregation: [
    /(?:across|in) all (?:my )?(?:documents?|papers?|files?)/i,
    /(?:summarize|overview|summary) (?:of )?all/i,
    /what do (?:my |the )?(?:documents?|papers?) say about/i,
  ],
  recommendation: [
    /what should (?:I|we) (?:do|use|choose|select)/i,
    /(?:which|what) (?:is|would be) (?:the )?best/i,
    /(?:recommend|suggest|advise)/i,
  ],
  general: [], // Default fallback
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENT QUERY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class IntelligentQueryService {
  /**
   * Enhance RAG answer with extracted knowledge
   */
  async enhanceAnswer(
    query: string,
    ragAnswer: string,
    userId: string
  ): Promise<EnhancementResult> {
    console.log(`🧠 [INTELLIGENT QUERY] Enhancing answer for: "${query.substring(0, 50)}..."`);

    // Detect query type
    const queryType = this.detectQueryType(query);
    console.log(`   Query type detected: ${queryType}`);

    let enhancedAnswer = ragAnswer;
    let knowledgeUsed = false;
    let sourceCount = 0;

    try {
      switch (queryType) {
        case 'definition':
          const defResult = await this.enhanceWithDefinition(query, ragAnswer, userId);
          enhancedAnswer = defResult.answer;
          knowledgeUsed = defResult.used;
          sourceCount = defResult.sources;
          break;

        case 'comparison':
          const compResult = await this.enhanceWithComparison(query, ragAnswer, userId);
          enhancedAnswer = compResult.answer;
          knowledgeUsed = compResult.used;
          sourceCount = compResult.sources;
          break;

        case 'why':
          const whyResult = await this.enhanceWithCausalReasoning(query, ragAnswer, userId);
          enhancedAnswer = whyResult.answer;
          knowledgeUsed = whyResult.used;
          sourceCount = whyResult.sources;
          break;

        case 'how':
          const howResult = await this.enhanceWithHowExplanation(query, ragAnswer, userId);
          enhancedAnswer = howResult.answer;
          knowledgeUsed = howResult.used;
          sourceCount = howResult.sources;
          break;

        case 'trend':
          const trendResult = await this.enhanceWithTrendAnalysis(query, ragAnswer, userId);
          enhancedAnswer = trendResult.answer;
          knowledgeUsed = trendResult.used;
          sourceCount = trendResult.sources;
          break;

        case 'methodology':
          const methResult = await this.enhanceWithMethodologies(query, ragAnswer, userId);
          enhancedAnswer = methResult.answer;
          knowledgeUsed = methResult.used;
          sourceCount = methResult.sources;
          break;

        default:
          // No enhancement for general queries
          break;
      }
    } catch (error) {
      console.warn(`⚠️ [INTELLIGENT QUERY] Enhancement failed:`, error);
      // Return original answer on error
    }

    if (knowledgeUsed) {
      console.log(`   ✅ Enhanced with ${sourceCount} knowledge sources`);
    }

    return {
      enhancedAnswer,
      queryType,
      knowledgeUsed,
      sourceCount,
    };
  }

  /**
   * Detect the type of query
   */
  detectQueryType(query: string): QueryType {
    const queryLower = query.toLowerCase().trim();

    for (const [type, patterns] of Object.entries(QUERY_TYPE_PATTERNS)) {
      if (type === 'general') continue;

      for (const pattern of patterns) {
        if (pattern.test(queryLower)) {
          return type as QueryType;
        }
      }
    }

    return 'general';
  }

  /**
   * Enhance with definition from knowledge base
   */
  private async enhanceWithDefinition(
    query: string,
    ragAnswer: string,
    userId: string
  ): Promise<{ answer: string; used: boolean; sources: number }> {
    const term = this.extractTerm(query);

    if (!term) {
      return { answer: ragAnswer, used: false, sources: 0 };
    }

    const knowledge = await prisma.domainKnowledge.findFirst({
      where: {
        userId,
        term: {
          contains: term,
          mode: 'insensitive',
        },
      },
    });

    if (knowledge && knowledge.definition) {
      // Parse source documents
      let sourceCount = 0;
      try {
        const sources = knowledge.sourceDocuments ? JSON.parse(knowledge.sourceDocuments) : [];
        sourceCount = sources.length;
      } catch {
        sourceCount = 1;
      }

      // Build enhanced answer
      const parts: string[] = [];

      // Main definition
      parts.push(`**${knowledge.term}**: ${knowledge.definition}`);

      // Add formula if available
      if (knowledge.formula) {
        parts.push(`\n**Formula**: ${knowledge.formula}`);
      }

      // Add interpretation if available
      if (knowledge.interpretation) {
        parts.push(`\n**Interpretation**: ${knowledge.interpretation}`);
      }

      // Add example if available
      if (knowledge.example) {
        parts.push(`\n**Example**: ${knowledge.example}`);
      }

      // Add the original RAG answer as supporting context
      parts.push(`\n\n---\n\n**From your documents:**\n${ragAnswer}`);

      return {
        answer: parts.join(''),
        used: true,
        sources: sourceCount,
      };
    }

    return { answer: ragAnswer, used: false, sources: 0 };
  }

  /**
   * Enhance with comparison data
   */
  private async enhanceWithComparison(
    query: string,
    ragAnswer: string,
    userId: string
  ): Promise<{ answer: string; used: boolean; sources: number }> {
    const concepts = this.extractComparisonConcepts(query);

    if (!concepts || concepts.length < 2) {
      return { answer: ragAnswer, used: false, sources: 0 };
    }

    const [conceptA, conceptB] = concepts;

    // Look for comparison in database
    const comparison = await prisma.comparativeData.findFirst({
      where: {
        userId,
        OR: [
          {
            conceptA: { contains: conceptA, mode: 'insensitive' },
            conceptB: { contains: conceptB, mode: 'insensitive' },
          },
          {
            conceptA: { contains: conceptB, mode: 'insensitive' },
            conceptB: { contains: conceptA, mode: 'insensitive' },
          },
        ],
      },
    });

    if (comparison) {
      const parts: string[] = [];

      // Header
      parts.push(`## ${comparison.conceptA} vs ${comparison.conceptB}\n`);

      // Key insight
      if (comparison.keyInsight) {
        parts.push(`**Key Insight**: ${comparison.keyInsight}\n`);
      }

      // Differences
      if (comparison.differences) {
        try {
          const diffs = JSON.parse(comparison.differences);
          if (diffs.length > 0) {
            parts.push(`\n**Key Differences:**`);
            for (const diff of diffs.slice(0, 5)) {
              parts.push(`- ${diff}`);
            }
          }
        } catch { /* ignore parse errors */ }
      }

      // Similarities
      if (comparison.similarities) {
        try {
          const sims = JSON.parse(comparison.similarities);
          if (sims.length > 0) {
            parts.push(`\n**Similarities:**`);
            for (const sim of sims.slice(0, 3)) {
              parts.push(`- ${sim}`);
            }
          }
        } catch { /* ignore parse errors */ }
      }

      // Add RAG answer
      parts.push(`\n\n---\n\n**From your documents:**\n${ragAnswer}`);

      return {
        answer: parts.join('\n'),
        used: true,
        sources: comparison.documentCount || 1,
      };
    }

    return { answer: ragAnswer, used: false, sources: 0 };
  }

  /**
   * Enhance with causal reasoning
   */
  private async enhanceWithCausalReasoning(
    query: string,
    ragAnswer: string,
    userId: string
  ): Promise<{ answer: string; used: boolean; sources: number }> {
    const effect = this.extractEffect(query);

    if (!effect) {
      return { answer: ragAnswer, used: false, sources: 0 };
    }

    const causalRels = await prisma.causalRelationship.findMany({
      where: {
        userId,
        effect: {
          contains: effect.substring(0, 50), // Use first 50 chars to match
          mode: 'insensitive',
        },
      },
      orderBy: { confidence: 'desc' },
      take: 5,
    });

    if (causalRels.length > 0) {
      const parts: string[] = [];

      // Header
      parts.push(`This occurred for **${causalRels.length}** key reason${causalRels.length > 1 ? 's' : ''}:\n`);

      // List causes
      for (let i = 0; i < causalRels.length; i++) {
        const rel = causalRels[i];
        let causes: any[] = [];

        try {
          causes = JSON.parse(rel.causes);
        } catch {
          causes = [{ cause: rel.causes, confidence: rel.confidence }];
        }

        for (const cause of causes.slice(0, 3)) {
          const confidenceStr = cause.confidence > 0.8 ? '(high confidence)' :
                               cause.confidence > 0.5 ? '(medium confidence)' : '';
          parts.push(`**${i + 1}. ${cause.cause}** ${confidenceStr}`);

          if (rel.mechanism) {
            parts.push(`   *Mechanism*: ${rel.mechanism}`);
          }
        }
      }

      // Add evidence if available
      const withEvidence = causalRels.filter(r => r.evidence);
      if (withEvidence.length > 0) {
        parts.push(`\n**Supporting Evidence:**`);
        for (const rel of withEvidence.slice(0, 2)) {
          parts.push(`- ${rel.evidence}`);
        }
      }

      // Add RAG answer
      parts.push(`\n\n---\n\n**From your documents:**\n${ragAnswer}`);

      const totalSources = causalRels.reduce((sum, r) => sum + (r.documentCount || 1), 0);

      return {
        answer: parts.join('\n'),
        used: true,
        sources: totalSources,
      };
    }

    return { answer: ragAnswer, used: false, sources: 0 };
  }

  /**
   * Enhance with how/mechanism explanation
   */
  private async enhanceWithHowExplanation(
    query: string,
    ragAnswer: string,
    userId: string
  ): Promise<{ answer: string; used: boolean; sources: number }> {
    const topic = this.extractTopic(query);

    if (!topic) {
      return { answer: ragAnswer, used: false, sources: 0 };
    }

    // Check methodology knowledge for "how it works"
    const methodology = await prisma.methodologyKnowledge.findFirst({
      where: {
        userId,
        name: { contains: topic.toLowerCase(), mode: 'insensitive' },
      },
    });

    if (methodology && methodology.howItWorks) {
      const parts: string[] = [];

      parts.push(`## How ${methodology.name} Works\n`);
      parts.push(methodology.howItWorks);

      if (methodology.whyUsed) {
        parts.push(`\n**Why it's used**: ${methodology.whyUsed}`);
      }

      if (methodology.limitations) {
        parts.push(`\n**Limitations**: ${methodology.limitations}`);
      }

      parts.push(`\n\n---\n\n**From your documents:**\n${ragAnswer}`);

      return {
        answer: parts.join('\n'),
        used: true,
        sources: methodology.documentCount || 1,
      };
    }

    return { answer: ragAnswer, used: false, sources: 0 };
  }

  /**
   * Enhance with trend analysis
   */
  private async enhanceWithTrendAnalysis(
    query: string,
    ragAnswer: string,
    userId: string
  ): Promise<{ answer: string; used: boolean; sources: number }> {
    const topic = this.extractTopic(query);

    if (!topic) {
      return { answer: ragAnswer, used: false, sources: 0 };
    }

    // Get methodologies to analyze trends
    const methodologies = await prisma.methodologyKnowledge.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: topic.toLowerCase(), mode: 'insensitive' } },
          { useCases: { contains: topic, mode: 'insensitive' } },
        ],
      },
      orderBy: { documentCount: 'desc' },
      take: 10,
    });

    if (methodologies.length >= 2) {
      // Analyze trend based on document count and confidence
      const parts: string[] = [];

      parts.push(`## Trends in ${topic}\n`);

      // Sort by document count to identify popular approaches
      const sorted = [...methodologies].sort((a, b) => (b.documentCount || 0) - (a.documentCount || 0));

      parts.push(`**Most common approaches** (by usage in your documents):`);
      for (let i = 0; i < Math.min(5, sorted.length); i++) {
        const m = sorted[i];
        parts.push(`${i + 1}. **${m.name}** — found in ${m.documentCount || 1} document${(m.documentCount || 1) > 1 ? 's' : ''}`);
      }

      // Check for emerging trends (high confidence, lower count)
      const emerging = methodologies.filter(m =>
        (m.confidence || 0) > 0.7 && (m.documentCount || 0) <= 2
      );

      if (emerging.length > 0) {
        parts.push(`\n**Emerging approaches:**`);
        for (const m of emerging.slice(0, 3)) {
          parts.push(`- ${m.name}`);
        }
      }

      parts.push(`\n\n---\n\n**From your documents:**\n${ragAnswer}`);

      return {
        answer: parts.join('\n'),
        used: true,
        sources: methodologies.reduce((sum, m) => sum + (m.documentCount || 1), 0),
      };
    }

    return { answer: ragAnswer, used: false, sources: 0 };
  }

  /**
   * Enhance with methodology aggregation
   */
  private async enhanceWithMethodologies(
    query: string,
    ragAnswer: string,
    userId: string
  ): Promise<{ answer: string; used: boolean; sources: number }> {
    const methodologies = await prisma.methodologyKnowledge.findMany({
      where: { userId },
      orderBy: { documentCount: 'desc' },
      take: 10,
    });

    if (methodologies.length > 0) {
      const parts: string[] = [];

      const totalDocs = methodologies.reduce((sum, m) => sum + (m.documentCount || 1), 0);
      parts.push(`Your documents use **${methodologies.length}** main approaches:\n`);

      for (const m of methodologies.slice(0, 7)) {
        const percentage = Math.round(((m.documentCount || 1) / totalDocs) * 100);
        parts.push(`• **${m.name}** — ${m.documentCount || 1} document${(m.documentCount || 1) > 1 ? 's' : ''} (${percentage}%)`);
        if (m.definition) {
          parts.push(`  *${m.definition.substring(0, 100)}${m.definition.length > 100 ? '...' : ''}*`);
        }
      }

      if (methodologies.length > 7) {
        parts.push(`\n*Plus ${methodologies.length - 7} other approaches mentioned less frequently.*`);
      }

      parts.push(`\n\n---\n\n**From your documents:**\n${ragAnswer}`);

      return {
        answer: parts.join('\n'),
        used: true,
        sources: totalDocs,
      };
    }

    return { answer: ragAnswer, used: false, sources: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Extract term from definition query
   */
  private extractTerm(query: string): string | null {
    for (const pattern of QUERY_TYPE_PATTERNS.definition) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Extract concepts from comparison query
   */
  private extractComparisonConcepts(query: string): string[] | null {
    for (const pattern of QUERY_TYPE_PATTERNS.comparison) {
      const match = query.match(pattern);
      if (match && match[1] && match[2]) {
        return [match[1].trim(), match[2].trim()];
      }
    }
    return null;
  }

  /**
   * Extract effect from why query
   */
  private extractEffect(query: string): string | null {
    for (const pattern of QUERY_TYPE_PATTERNS.why) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Extract topic from query
   */
  private extractTopic(query: string): string | null {
    // Try trend patterns first
    for (const pattern of QUERY_TYPE_PATTERNS.trend) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Try how patterns
    for (const pattern of QUERY_TYPE_PATTERNS.how) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: extract nouns
    const words = query.split(/\s+/);
    const stopWords = new Set(['what', 'how', 'why', 'when', 'where', 'is', 'are', 'the', 'a', 'an', 'do', 'does', 'did', 'has', 'have', 'my', 'your', 'in', 'on', 'at', 'to', 'for']);
    const significant = words.filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2);

    return significant.length > 0 ? significant.join(' ') : null;
  }
}

export const intelligentQueryService = new IntelligentQueryService();
export default intelligentQueryService;
