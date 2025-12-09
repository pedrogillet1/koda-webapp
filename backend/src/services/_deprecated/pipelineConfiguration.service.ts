/**
 * ============================================================================
 * PIPELINE CONFIGURATION SERVICE
 * ============================================================================
 *
 * Maps intent classification results to specific pipeline configurations.
 * Each intent gets its own:
 * - Routing strategy (single, multi-document, all-documents)
 * - Retrieval strategy (standard, high-level, purpose-relevant, per-dimension)
 * - Reranking methods (chunk-type, micro-summary, document-router)
 * - Answer template (direct, overview, reasoning, comparison, transformation)
 * - Target word count and structure
 *
 * This is the key to making intent classification actually useful.
 */

// DEPRECATED: Replaced by KodaIntentEngine
// import { IntentResult, IntentCategory, ComplexityLevel } from './hierarchicalIntentClassifier.service';
import { IntentResult } from './deletedServiceStubs';

// Type aliases for backward compatibility
type IntentCategory = string;
type ComplexityLevel = 'simple' | 'medium' | 'complex';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface PipelineConfig {
  // Routing
  routing: 'single' | 'multi-document' | 'all-documents';

  // Retrieval
  retrieval: {
    strategy: 'standard' | 'high-level' | 'purpose-relevant' | 'per-dimension';
    topK: number;
    chunkTypeBoosts?: Record<string, number>;
  };

  // Reranking
  reranking: {
    enabled: boolean;
    methods: Array<'chunk-type' | 'micro-summary' | 'document-router'>;
    weights?: Record<string, number>;
  };

  // Answer generation
  answer: {
    template: 'direct' | 'overview' | 'reasoning' | 'comparison' | 'transformation';
    targetWords: number;
    sections: number;
    useHeadings: boolean;
    useBullets: boolean;
    useNumberedLists: boolean;
  };
}

// ============================================================================
// CHUNK TYPE BOOST PRESETS
// ============================================================================

const CHUNK_TYPE_BOOSTS = {
  // For summarization queries
  highLevel: {
    'introduction': 2.5,
    'conclusion': 2.5,
    'summary_section': 3.0,
    'executive_summary': 3.0,
    'abstract': 2.5,
    'key_findings': 2.0,
  },

  // For explanation queries
  purposeRelevant: {
    'definition': 2.0,
    'explanation': 2.5,
    'example': 1.8,
    'procedure': 1.8,
    'purpose': 2.0,
    'rationale': 2.0,
  },

  // For comparison queries
  comparison: {
    'pricing_section': 2.0,
    'terms_section': 1.8,
    'comparison_table': 2.5,
    'specifications': 1.8,
    'features': 1.8,
  },

  // For calculation queries
  numerical: {
    'table': 2.5,
    'financial_data': 3.0,
    'statistics': 2.5,
    'metrics': 2.0,
  },
};

// ============================================================================
// BASE CONFIGURATION
// ============================================================================

const BASE_CONFIG: PipelineConfig = {
  routing: 'single',
  retrieval: {
    strategy: 'standard',
    topK: 20, // PERF FIX: Reduced from 50
  },
  reranking: {
    enabled: true,
    methods: ['chunk-type'],
  },
  answer: {
    template: 'direct',
    targetWords: 150,
    sections: 1,
    useHeadings: false,
    useBullets: false,
    useNumberedLists: false,
  },
};

// ============================================================================
// INTENT-TO-PIPELINE MAPPING
// ============================================================================

export function getPipelineConfig(intent: IntentResult): PipelineConfig {
  const config: PipelineConfig = JSON.parse(JSON.stringify(BASE_CONFIG));

  // Adjust based on primary intent
  switch (intent.primaryIntent) {
    case 'comparison':
      config.routing = 'multi-document';
      config.retrieval = {
        strategy: 'per-dimension',
        topK: 20,  // Per document // PERF FIX: Reduced from 30
        chunkTypeBoosts: CHUNK_TYPE_BOOSTS.comparison,
      };
      config.reranking = {
        enabled: true,
        methods: ['chunk-type', 'micro-summary', 'document-router'],
      };
      config.answer = {
        template: 'comparison',
        targetWords: intent.complexity === 'complex' ? 900 : intent.complexity === 'medium' ? 600 : 400,
        sections: 3,  // Per-doc summary + Side-by-side + Conclusion
        useHeadings: true,
        useBullets: true,
        useNumberedLists: false,
      };
      break;

    case 'summarization':
      config.routing = intent.entities.length > 1 ? 'multi-document' : 'single';
      config.retrieval = {
        strategy: 'high-level',
        topK: 20,
        chunkTypeBoosts: CHUNK_TYPE_BOOSTS.highLevel,
      };
      config.reranking = {
        enabled: true,
        methods: ['chunk-type'],
      };
      config.answer = {
        template: 'overview',
        targetWords: intent.complexity === 'complex' ? 500 : intent.complexity === 'medium' ? 350 : 250,
        sections: 2,  // Overview + Key takeaways
        useHeadings: true,
        useBullets: true,
        useNumberedLists: false,
      };
      break;

    case 'explanation':
      config.routing = 'single';
      config.retrieval = {
        strategy: 'purpose-relevant',
        topK: 20, // PERF FIX: Reduced from 30
        chunkTypeBoosts: CHUNK_TYPE_BOOSTS.purposeRelevant,
      };
      config.reranking = {
        enabled: true,
        methods: ['micro-summary', 'chunk-type'],
      };
      config.answer = {
        template: 'reasoning',
        targetWords: intent.complexity === 'complex' ? 400 : intent.complexity === 'medium' ? 280 : 180,
        sections: intent.complexity === 'complex' ? 3 : 2,  // Context + Breakdown + (Implications)
        useHeadings: true,
        useBullets: true,
        useNumberedLists: false,
      };
      break;

    case 'transformation':
      config.routing = 'single';
      config.retrieval = {
        strategy: 'standard',
        topK: 5,  // Only need the target chunk
      };
      config.reranking = {
        enabled: false,  // Not needed for transformation
        methods: [],
      };
      config.answer = {
        template: 'transformation',
        targetWords: intent.complexity === 'complex' ? 400 : intent.complexity === 'medium' ? 250 : 150,
        sections: 1,
        useHeadings: false,
        useBullets: false,
        useNumberedLists: false,
      };
      break;

    case 'calculation':
      config.routing = intent.entities.length > 1 ? 'multi-document' : 'single';
      config.retrieval = {
        strategy: 'standard',
        topK: 20,
        chunkTypeBoosts: CHUNK_TYPE_BOOSTS.numerical,
      };
      config.reranking = {
        enabled: true,
        methods: ['chunk-type'],
      };
      config.answer = {
        template: 'direct',
        targetWords: intent.complexity === 'complex' ? 300 : 200,
        sections: 1,
        useHeadings: false,
        useBullets: true,
        useNumberedLists: true,
      };
      break;

    case 'synthesis':
      config.routing = 'all-documents';
      config.retrieval = {
        strategy: 'standard',
        topK: 30,  // Need broad coverage // PERF FIX: Reduced from 100
      };
      config.reranking = {
        enabled: true,
        methods: ['chunk-type', 'micro-summary'],
      };
      config.answer = {
        template: 'overview',
        targetWords: intent.complexity === 'complex' ? 700 : 500,
        sections: 3,
        useHeadings: true,
        useBullets: true,
        useNumberedLists: false,
      };
      break;

    case 'content_question':
      config.routing = 'single';
      config.retrieval = {
        strategy: 'standard',
        topK: 30,
      };
      config.reranking = {
        enabled: true,
        methods: ['chunk-type'],
      };
      config.answer = {
        template: 'direct',
        targetWords: intent.complexity === 'complex' ? 300 : intent.complexity === 'medium' ? 200 : 150,
        sections: 1,
        useHeadings: false,
        useBullets: intent.complexity !== 'simple',
        useNumberedLists: false,
      };
      break;

    case 'clarification_needed':
      config.routing = 'all-documents';  // Show available options
      config.retrieval = {
        strategy: 'standard',
        topK: 0,  // No retrieval needed
      };
      config.reranking = {
        enabled: false,
        methods: [],
      };
      config.answer = {
        template: 'direct',
        targetWords: 100,
        sections: 1,
        useHeadings: false,
        useBullets: true,
        useNumberedLists: true,
      };
      break;

    case 'metadata_query':
      config.routing = 'all-documents';
      config.retrieval = {
        strategy: 'standard',
        topK: 0,  // Metadata only, no content retrieval
      };
      config.reranking = {
        enabled: false,
        methods: [],
      };
      config.answer = {
        template: 'direct',
        targetWords: 100,
        sections: 1,
        useHeadings: false,
        useBullets: true,
        useNumberedLists: false,
      };
      break;

    case 'document_listing':
      config.routing = 'all-documents';
      config.retrieval = {
        strategy: 'standard',
        topK: 0,
      };
      config.reranking = {
        enabled: false,
        methods: [],
      };
      config.answer = {
        template: 'direct',
        targetWords: 150,
        sections: 1,
        useHeadings: false,
        useBullets: true,
        useNumberedLists: true,
      };
      break;

    case 'greeting':
    case 'capability':
      config.routing = 'single';
      config.retrieval = {
        strategy: 'standard',
        topK: 0,
      };
      config.reranking = {
        enabled: false,
        methods: [],
      };
      config.answer = {
        template: 'direct',
        targetWords: 80,
        sections: 1,
        useHeadings: false,
        useBullets: false,
        useNumberedLists: false,
      };
      break;

    default:
      // Use base config
      break;
  }

  return config;
}

// ============================================================================
// ANSWER SHAPE PLANNING
// ============================================================================

export interface AnswerPlan {
  targetWords: number;
  sections: AnswerSection[];
  useHeadings: boolean;
  useBullets: boolean;
  useNumberedLists: boolean;
  template: string;
}

export interface AnswerSection {
  title: string;
  targetWords: number;
  bulletPoints?: number;
  subsections?: AnswerSection[];
}

export function planAnswerShape(
  intent: IntentResult,
  pipelineConfig: PipelineConfig
): AnswerPlan {
  const { template, targetWords, sections, useHeadings, useBullets, useNumberedLists } = pipelineConfig.answer;

  let answerSections: AnswerSection[] = [];

  switch (template) {
    case 'comparison':
      answerSections = [
        {
          title: 'Per-Document Summary',
          targetWords: Math.floor(targetWords * 0.4),
          bulletPoints: 3,
        },
        {
          title: 'Side-by-Side Comparison',
          targetWords: Math.floor(targetWords * 0.4),
          bulletPoints: 5,
        },
        {
          title: 'Recommendation',
          targetWords: Math.floor(targetWords * 0.2),
          bulletPoints: 2,
        },
      ];
      break;

    case 'overview':
      answerSections = [
        {
          title: 'Overview',
          targetWords: Math.floor(targetWords * 0.6),
          bulletPoints: 5,
        },
        {
          title: 'Key Takeaways',
          targetWords: Math.floor(targetWords * 0.4),
          bulletPoints: 3,
        },
      ];
      break;

    case 'reasoning':
      if (intent.complexity === 'complex') {
        answerSections = [
          {
            title: 'Context',
            targetWords: Math.floor(targetWords * 0.25),
            bulletPoints: 0,
          },
          {
            title: 'Explanation',
            targetWords: Math.floor(targetWords * 0.5),
            bulletPoints: 4,
          },
          {
            title: 'Implications',
            targetWords: Math.floor(targetWords * 0.25),
            bulletPoints: 2,
          },
        ];
      } else {
        answerSections = [
          {
            title: 'Explanation',
            targetWords: Math.floor(targetWords * 0.7),
            bulletPoints: 3,
          },
          {
            title: 'Key Points',
            targetWords: Math.floor(targetWords * 0.3),
            bulletPoints: 2,
          },
        ];
      }
      break;

    case 'direct':
      answerSections = [
        {
          title: 'Answer',
          targetWords,
          bulletPoints: useBullets ? 3 : 0,
        },
      ];
      break;

    case 'transformation':
      answerSections = [
        {
          title: 'Rewritten Version',
          targetWords,
          bulletPoints: 0,
        },
      ];
      break;
  }

  return {
    targetWords,
    sections: answerSections,
    useHeadings,
    useBullets,
    useNumberedLists,
    template,
  };
}

// ============================================================================
// PROMPT BUILDER (with answer plan)
// ============================================================================

export function buildPromptWithPlan(
  query: string,
  context: string,
  answerPlan: AnswerPlan,
  intent: IntentResult
): string {
  const sectionsPrompt = answerPlan.sections
    .map((section, idx) => {
      let sectionText = `${idx + 1}. **${section.title}** (${section.targetWords} words)`;
      if (section.bulletPoints && section.bulletPoints > 0) {
        sectionText += `\n   - Include ${section.bulletPoints} bullet points`;
      }
      return sectionText;
    })
    .join('\n');

  const structureInstructions = `
Structure your answer with the following sections:

${sectionsPrompt}

${answerPlan.useHeadings ? '- Use markdown headings (##) for section titles' : ''}
${answerPlan.useBullets ? '- Use bullet points (-) for lists' : ''}
${answerPlan.useNumberedLists ? '- Use numbered lists (1., 2., 3.) where appropriate' : ''}

Total target length: ${answerPlan.targetWords} words.
`;

  const templateInstructions = getTemplateInstructions(answerPlan.template, intent);

  return `${templateInstructions}

Context from documents:
${context}

User's question: "${query}"

${structureInstructions}

Answer:`;
}

function getTemplateInstructions(template: string, intent: IntentResult): string {
  switch (template) {
    case 'comparison':
      return `You are answering a comparison question. Your answer should:
1. Summarize each document/option individually
2. Compare them side-by-side on the requested dimensions
3. Provide a clear recommendation based on the comparison

Be objective and cite specific details from the documents.`;

    case 'overview':
      return `You are providing a summary/overview. Your answer should:
1. Start with a high-level overview of the main points
2. Highlight the key takeaways or most important information
3. Be concise but comprehensive

Focus on the big picture, not minor details.`;

    case 'reasoning':
      return `You are explaining a concept or providing reasoning. Your answer should:
1. Provide context and background
2. Break down the explanation into clear, logical steps
3. Explain the implications or practical meaning

Use simple language and provide examples where helpful.`;

    case 'transformation':
      return `You are rewriting or transforming content. Your answer should:
1. Preserve the core meaning and facts from the original
2. Adapt the style, tone, or format as requested
3. Ensure the rewritten version is clear and natural

Do not add information not present in the original.`;

    case 'direct':
    default:
      return `You are answering a direct question. Your answer should:
1. Directly address the user's question
2. Cite specific information from the documents
3. Be clear, concise, and accurate

Include citations in the format [Doc: filename, Page: X].`;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const pipelineConfigurationService = {
  getPipelineConfig,
  planAnswerShape,
  buildPromptWithPlan,
};
