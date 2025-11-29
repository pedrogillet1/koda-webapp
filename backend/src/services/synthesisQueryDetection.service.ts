/**
 * Synthesis Query Detection Service
 *
 * PURPOSE: Detect queries that require cross-document synthesis
 * WHY: Enable intelligent responses that aggregate across documents
 * HOW: Pattern matching for methodology, trend, and aggregation queries
 *
 * This service works alongside the main intent.service.ts to detect
 * queries that need special handling for cross-document synthesis.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SynthesisQueryType =
  | 'methodology'      // "What approaches do my papers use?"
  | 'comparison'       // "Compare the methods across documents"
  | 'trend'            // "How have approaches changed over time?"
  | 'pattern'          // "What patterns exist across my documents?"
  | 'aggregation'      // "Summarize findings across all papers"
  | 'none';

export interface SynthesisQueryResult {
  isSynthesisQuery: boolean;
  type: SynthesisQueryType;
  topic?: string;
  confidence: number;
  reasoning?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const SYNTHESIS_PATTERNS = {
  methodology: [
    // "What approaches/methods/methodologies"
    /what (?:are )?(?:the )?(?:main|primary|key|different|various) (?:approaches|methods|methodologies|techniques)/i,
    /(?:how many|which) (?:approaches|methods|methodologies|techniques)/i,
    /what (?:approaches|methods|methodologies|techniques) (?:are|do|does)/i,
    /(?:approaches|methods|methodologies|techniques) (?:used|employed|applied)/i,
    /(?:summarize|overview|summary) (?:of )?(?:the )?(?:approaches|methods|methodologies)/i,
    /what (?:are )?(?:the )?(?:research )?methods? (?:in|across|used)/i,
    // Portfolio/finance specific
    /what (?:optimization|investment|trading) (?:methods?|approaches?|strategies?)/i,
    /what (?:machine learning|ml|ai) (?:methods?|models?|approaches?)/i,
  ],
  comparison: [
    /compare (?:the )?(?:approaches|methods|methodologies|techniques)/i,
    /(?:differences?|similarities?) (?:between|among|in) (?:the )?(?:approaches|methods)/i,
    /how (?:do|does) (?:the )?(?:approaches|methods) (?:differ|compare)/i,
  ],
  trend: [
    /(?:trends?|shifts?|changes?) (?:in|across|over)/i,
    /(?:how|what) (?:has|have) (?:the )?(?:approaches|methods) (?:changed|evolved)/i,
    /(?:evolution|development|progression) (?:of|in) (?:the )?(?:approaches|methods)/i,
    /(?:older|newer|recent) (?:papers?|documents?|studies?) (?:use|employ|prefer)/i,
  ],
  pattern: [
    /(?:patterns?|themes?|commonalities?) (?:across|in|among)/i,
    /what (?:do|does) (?:the )?(?:papers?|documents?|studies?) (?:have in common|share)/i,
    /(?:recurring|common|frequent) (?:themes?|patterns?|topics?)/i,
  ],
  aggregation: [
    /(?:across|all|every) (?:my )?(?:papers?|documents?|files?|studies?)/i,
    /(?:summarize|overview|summary) (?:of )?(?:all|my) (?:papers?|documents?)/i,
    /(?:overall|combined|total) (?:findings?|results?|conclusions?)/i,
    // "Create a summary report" patterns
    /(?:create|make|generate|write|produce) (?:a |an )?(?:summary|comprehensive|detailed)? ?(?:report|document|analysis|overview) (?:of|from|based on|using) (?:my |the |all )?(?:documents?|files?|papers?)/i,
    /(?:create|make|generate|write|produce) (?:a |an )?(?:summary|comprehensive|detailed)? ?(?:report|document|analysis|overview)/i,
  ],
};

// Topic extraction patterns
const TOPIC_PATTERNS = [
  /(?:in|from|across) (?:my |the )?(.+?) (?:papers?|documents?|files?|studies?)/i,
  /(?:papers?|documents?|files?|studies?) (?:about|on|regarding) (.+)/i,
  /(.+?) (?:papers?|documents?|files?|studies?)/i,
  /(?:on|about|regarding) (.+)$/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class SynthesisQueryDetectionService {
  /**
   * Detect if a query requires cross-document synthesis
   */
  detect(query: string): SynthesisQueryResult {
    const queryLower = query.toLowerCase().trim();

    // Check each pattern type
    for (const [type, patterns] of Object.entries(SYNTHESIS_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(queryLower)) {
          const topic = this.extractTopic(queryLower);

          return {
            isSynthesisQuery: true,
            type: type as SynthesisQueryType,
            topic,
            confidence: 0.9,
            reasoning: `Query matches ${type} synthesis pattern`,
          };
        }
      }
    }

    // Check for implicit synthesis queries
    const aggregationWords = ['all', 'across', 'overall', 'together', 'combined', 'total', 'average', 'summary'];
    const documentWords = ['papers', 'documents', 'files', 'studies', 'articles', 'reports'];

    const hasAggregation = aggregationWords.some(w => queryLower.includes(w));
    const hasDocumentRef = documentWords.some(w => queryLower.includes(w));

    if (hasAggregation && hasDocumentRef) {
      return {
        isSynthesisQuery: true,
        type: 'aggregation',
        topic: this.extractTopic(queryLower),
        confidence: 0.7,
        reasoning: 'Query contains aggregation words with document references',
      };
    }

    return {
      isSynthesisQuery: false,
      type: 'none',
      confidence: 0,
    };
  }

  /**
   * Extract the topic from a synthesis query
   */
  private extractTopic(query: string): string | undefined {
    for (const pattern of TOPIC_PATTERNS) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const topic = match[1].trim();
        // Filter out common words that aren't topics
        if (!['my', 'the', 'all', 'these', 'those'].includes(topic.toLowerCase())) {
          return topic;
        }
      }
    }
    return undefined;
  }

  /**
   * Check if query is asking about methodologies specifically
   */
  isMethodologyQuery(query: string): boolean {
    const result = this.detect(query);
    return result.isSynthesisQuery && result.type === 'methodology';
  }

  /**
   * Check if query is asking about trends
   */
  isTrendQuery(query: string): boolean {
    const result = this.detect(query);
    return result.isSynthesisQuery && result.type === 'trend';
  }
}

export const synthesisQueryDetectionService = new SynthesisQueryDetectionService();
export default synthesisQueryDetectionService;
