/**
 * Koda Complex Query Planner Service
 *
 * Detects complex multi-part queries and creates execution plans.
 * Implements ChatGPT-style query decomposition for better accuracy.
 *
 * Examples of complex queries:
 * - "Compare the revenue of Q1 and Q2, and also tell me the biggest expense"
 * - "What are my obligations in the contract and what happens if I breach them?"
 * - "List all documents from 2024 and summarize the financial ones"
 *
 * @version 1.0.0
 * @date 2025-12-09
 */

import { detectLanguage } from './languageDetection.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type QueryComplexity = 'simple' | 'medium' | 'complex';

export type ResponseProfile =
  | 'short_fact'        // Single fact answer
  | 'medium_explanation' // 2-3 paragraph explanation
  | 'deep_analysis'      // Comprehensive analysis
  | 'comparison'         // Side-by-side comparison
  | 'list'               // Enumerated items
  | 'summary';           // Document summary

export interface SubQuestion {
  id: string;
  text: string;
  type: 'factual' | 'analytical' | 'comparison' | 'listing' | 'summarization';
  priority: number;             // 1 = highest priority
  dependsOn?: string[];         // IDs of sub-questions this depends on
  documentHint?: string;        // Hint about which document to search
  expectedOutputFormat?: string;
}

export interface QueryPlan {
  originalQuery: string;
  complexity: QueryComplexity;
  responseProfile: ResponseProfile;
  subQuestions: SubQuestion[];
  executionOrder: string[];     // Order to execute sub-questions
  totalSteps: number;
  estimatedTokens?: number;     // Estimated tokens needed
  language: string;             // Detected language
}

// ═══════════════════════════════════════════════════════════════════════════
// Complexity Detection Patterns
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patterns that indicate multi-part queries (language-agnostic + localized)
 */
const MULTI_PART_INDICATORS = {
  // English
  en: {
    conjunctions: ['and also', 'as well as', 'in addition', 'furthermore', 'moreover', 'besides', 'plus'],
    separators: ['first', 'second', 'then', 'finally', 'also', 'additionally'],
    comparisons: ['compare', 'difference', 'versus', 'vs', 'compared to', 'in comparison'],
    questions: ['what', 'how', 'why', 'when', 'where', 'who', 'which'],
  },
  // Portuguese
  pt: {
    conjunctions: ['e também', 'além de', 'além disso', 'ademais', 'ainda', 'também', 'junto com'],
    separators: ['primeiro', 'segundo', 'depois', 'finalmente', 'também', 'adicionalmente'],
    comparisons: ['comparar', 'diferença', 'versus', 'vs', 'em comparação', 'comparado a'],
    questions: ['qual', 'como', 'por que', 'quando', 'onde', 'quem', 'que'],
  },
  // Spanish
  es: {
    conjunctions: ['y también', 'además de', 'además', 'asimismo', 'también', 'junto con'],
    separators: ['primero', 'segundo', 'después', 'finalmente', 'también', 'adicionalmente'],
    comparisons: ['comparar', 'diferencia', 'versus', 'vs', 'en comparación', 'comparado con'],
    questions: ['qué', 'cómo', 'por qué', 'cuándo', 'dónde', 'quién', 'cuál'],
  },
};

/**
 * Question word patterns for splitting
 */
const QUESTION_SPLITTERS = {
  en: /\b(what|how|why|when|where|who|which)\s+(is|are|was|were|do|does|did|can|could|would|will|should)\b/gi,
  pt: /\b(qual|como|por\s+que|porque|quando|onde|quem|que|quanto)\s+(é|são|foi|foram|está|estão|pode|podem)\b/gi,
  es: /\b(qué|cómo|por\s+qué|cuándo|dónde|quién|cuál|cuánto)\s+(es|son|fue|fueron|está|están|puede|pueden)\b/gi,
};

// ═══════════════════════════════════════════════════════════════════════════
// Complexity Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect query complexity
 *
 * @param query - User's query
 * @returns QueryComplexity ('simple' | 'medium' | 'complex')
 */
export function detectQueryComplexity(query: string): QueryComplexity {
  const queryLower = query.toLowerCase();
  const lang = detectLanguage(query);

  console.log(`[COMPLEX-PLANNER] Detecting complexity for: "${query.slice(0, 80)}..."`);
  console.log(`[COMPLEX-PLANNER] Detected language: ${lang}`);

  // Check patterns from ALL languages for robustness
  // (language detection can be unreliable for short queries)
  const allPatterns = [
    MULTI_PART_INDICATORS.en,
    MULTI_PART_INDICATORS.pt,
    MULTI_PART_INDICATORS.es,
  ];

  // Count complexity indicators
  let complexityScore = 0;

  // Check for conjunctions from ALL languages (indicates multiple parts)
  for (const patterns of allPatterns) {
    for (const conj of patterns.conjunctions) {
      if (queryLower.includes(conj.toLowerCase())) {
        complexityScore += 2;
        console.log(`[COMPLEX-PLANNER] Found conjunction: "${conj}" (+2)`);
      }
    }
  }

  // Check for separators from ALL languages (indicates sequential requests)
  for (const patterns of allPatterns) {
    for (const sep of patterns.separators) {
      if (queryLower.includes(sep.toLowerCase())) {
        complexityScore += 1;
        console.log(`[COMPLEX-PLANNER] Found separator: "${sep}" (+1)`);
      }
    }
  }

  // Check for comparisons from ALL languages (indicates comparison query)
  for (const patterns of allPatterns) {
    for (const comp of patterns.comparisons) {
      if (queryLower.includes(comp.toLowerCase())) {
        complexityScore += 3;
        console.log(`[COMPLEX-PLANNER] Found comparison: "${comp}" (+3)`);
      }
    }
  }

  // Count question words (multiple questions = complex)
  const questionPattern = QUESTION_SPLITTERS[lang as keyof typeof QUESTION_SPLITTERS] || QUESTION_SPLITTERS.en;
  const questionMatches = query.match(questionPattern) || [];
  if (questionMatches.length > 1) {
    complexityScore += questionMatches.length * 2;
    console.log(`[COMPLEX-PLANNER] Found ${questionMatches.length} question patterns (+${questionMatches.length * 2})`);
  }

  // Check for multiple clauses (comma/semicolon separated)
  const clauseCount = query.split(/[,;]/).filter(c => c.trim().length > 10).length;
  if (clauseCount > 2) {
    complexityScore += clauseCount - 1;
    console.log(`[COMPLEX-PLANNER] Found ${clauseCount} clauses (+${clauseCount - 1})`);
  }

  // Check for "list" or "enumerate" keywords
  const listPatterns = ['list all', 'enumerate', 'show me all', 'what are all', 'listar todos', 'listar todas', 'mostrar todos', 'enumerar'];
  for (const pattern of listPatterns) {
    if (queryLower.includes(pattern)) {
      complexityScore += 1;
      console.log(`[COMPLEX-PLANNER] Found list pattern: "${pattern}" (+1)`);
    }
  }

  // Length-based adjustment
  if (query.length > 200) {
    complexityScore += 2;
    console.log('[COMPLEX-PLANNER] Long query detected (+2)');
  } else if (query.length > 100) {
    complexityScore += 1;
    console.log('[COMPLEX-PLANNER] Medium-length query (+1)');
  }

  console.log(`[COMPLEX-PLANNER] Total complexity score: ${complexityScore}`);

  // Determine complexity level
  if (complexityScore >= 5) {
    console.log('[COMPLEX-PLANNER] → COMPLEX query detected');
    return 'complex';
  } else if (complexityScore >= 2) {
    console.log('[COMPLEX-PLANNER] → MEDIUM complexity query detected');
    return 'medium';
  } else {
    console.log('[COMPLEX-PLANNER] → SIMPLE query detected');
    return 'simple';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Response Profile Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine the expected response profile
 *
 * @param query - User's query
 * @param complexity - Detected complexity
 * @returns ResponseProfile
 */
export function determineResponseProfile(query: string, complexity: QueryComplexity): ResponseProfile {
  const queryLower = query.toLowerCase();

  // Comparison queries
  if (/compare|versus|vs|difference|diferença|comparar|comparação/.test(queryLower)) {
    return 'comparison';
  }

  // List queries
  if (/list all|enumerate|show all|what are all|listar|enumerar|mostrar todos/.test(queryLower)) {
    return 'list';
  }

  // Summary queries
  if (/summarize|summary|overview|resumo|resumir|sintetizar|visão geral/.test(queryLower)) {
    return 'summary';
  }

  // Explanation queries
  if (/explain|why|how does|como funciona|por que|explicar/.test(queryLower)) {
    return complexity === 'complex' ? 'deep_analysis' : 'medium_explanation';
  }

  // Simple factual queries
  if (/what is|when|where|who|qual é|quando|onde|quem|quanto/.test(queryLower) && complexity === 'simple') {
    return 'short_fact';
  }

  // Default based on complexity
  switch (complexity) {
    case 'complex':
      return 'deep_analysis';
    case 'medium':
      return 'medium_explanation';
    default:
      return 'short_fact';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Query Decomposition
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decompose a complex query into sub-questions
 *
 * @param query - User's query
 * @param complexity - Detected complexity
 * @param language - Detected language
 * @returns Array of SubQuestion
 */
function decomposeQuery(query: string, complexity: QueryComplexity, language: string): SubQuestion[] {
  const subQuestions: SubQuestion[] = [];

  if (complexity === 'simple') {
    // Simple query: single sub-question
    subQuestions.push({
      id: 'sq_1',
      text: query,
      type: 'factual',
      priority: 1,
      expectedOutputFormat: 'direct_answer',
    });
    return subQuestions;
  }

  // Split by common conjunctions and separators
  const patterns = MULTI_PART_INDICATORS[language as keyof typeof MULTI_PART_INDICATORS] || MULTI_PART_INDICATORS.en;

  // Try to split by question patterns first
  const questionPattern = QUESTION_SPLITTERS[language as keyof typeof QUESTION_SPLITTERS] || QUESTION_SPLITTERS.en;
  const questionMatches = [...query.matchAll(new RegExp(questionPattern.source, 'gi'))];

  if (questionMatches.length > 1) {
    // Multiple questions detected - split at each question word
    const positions = questionMatches.map(m => m.index || 0);
    positions.push(query.length);

    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i];
      const end = positions[i + 1];
      const subQuery = query.slice(start, end).trim().replace(/[,;]$/, '').trim();

      if (subQuery.length > 5) {
        subQuestions.push({
          id: `sq_${i + 1}`,
          text: subQuery,
          type: detectSubQuestionType(subQuery),
          priority: i + 1,
          dependsOn: i > 0 ? [`sq_${i}`] : undefined,
          expectedOutputFormat: 'paragraph',
        });
      }
    }
  }

  // If no question patterns found, try splitting by conjunctions
  if (subQuestions.length <= 1) {
    // Clear and try conjunction splitting
    subQuestions.length = 0;

    let remaining = query;
    let sqIndex = 1;

    // Split by strong conjunctions
    const strongConjunctions = [' e também ', ' and also ', ' además de ', ' além de ', ' as well as '];
    for (const conj of strongConjunctions) {
      const parts = remaining.split(new RegExp(conj, 'gi'));
      if (parts.length > 1) {
        for (const part of parts) {
          if (part.trim().length > 5) {
            subQuestions.push({
              id: `sq_${sqIndex}`,
              text: part.trim(),
              type: detectSubQuestionType(part),
              priority: sqIndex,
              expectedOutputFormat: 'paragraph',
            });
            sqIndex++;
          }
        }
        remaining = '';
        break;
      }
    }

    // If still no split, try comma/semicolon splitting for long queries
    if (subQuestions.length === 0 && query.length > 100) {
      const clauses = query.split(/[,;]/).filter(c => c.trim().length > 15);
      if (clauses.length > 1) {
        for (const clause of clauses) {
          subQuestions.push({
            id: `sq_${sqIndex}`,
            text: clause.trim(),
            type: detectSubQuestionType(clause),
            priority: sqIndex,
            expectedOutputFormat: 'paragraph',
          });
          sqIndex++;
        }
      }
    }
  }

  // Fallback: if no decomposition possible, treat as single question
  if (subQuestions.length === 0) {
    subQuestions.push({
      id: 'sq_1',
      text: query,
      type: detectSubQuestionType(query),
      priority: 1,
      expectedOutputFormat: complexity === 'complex' ? 'detailed_analysis' : 'paragraph',
    });
  }

  return subQuestions;
}

/**
 * Detect the type of sub-question
 */
function detectSubQuestionType(query: string): SubQuestion['type'] {
  const queryLower = query.toLowerCase();

  if (/compare|versus|vs|difference|diferença|comparar/.test(queryLower)) {
    return 'comparison';
  }
  if (/list|enumerate|all|listar|enumerar|todos|todas/.test(queryLower)) {
    return 'listing';
  }
  if (/summarize|summary|overview|resumo|resumir|sintetizar/.test(queryLower)) {
    return 'summarization';
  }
  if (/why|explain|analyze|por que|explicar|analisar/.test(queryLower)) {
    return 'analytical';
  }

  return 'factual';
}

// ═══════════════════════════════════════════════════════════════════════════
// Execution Order Planning
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine the order to execute sub-questions based on dependencies
 *
 * @param subQuestions - Array of sub-questions
 * @returns Array of sub-question IDs in execution order
 */
function planExecutionOrder(subQuestions: SubQuestion[]): string[] {
  const order: string[] = [];
  const pending = [...subQuestions];
  const completed = new Set<string>();

  // Topological sort based on dependencies
  while (pending.length > 0) {
    const next = pending.find(sq => {
      if (!sq.dependsOn || sq.dependsOn.length === 0) return true;
      return sq.dependsOn.every(dep => completed.has(dep));
    });

    if (!next) {
      // Circular dependency or unresolvable - add remaining in priority order
      pending.sort((a, b) => a.priority - b.priority);
      for (const sq of pending) {
        order.push(sq.id);
      }
      break;
    }

    order.push(next.id);
    completed.add(next.id);
    pending.splice(pending.indexOf(next), 1);
  }

  return order;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Query Planning Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an execution plan for a query
 *
 * This is the MAIN ENTRY POINT for complex query planning.
 *
 * @param query - User's original query
 * @returns QueryPlan with decomposed sub-questions and execution order
 */
export function createQueryPlan(query: string): QueryPlan {
  console.log('[COMPLEX-PLANNER] ═══════════════════════════════════════════');
  console.log(`[COMPLEX-PLANNER] Creating query plan for: "${query.slice(0, 100)}..."`);

  // Step 1: Detect language
  const language = detectLanguage(query);

  // Step 2: Detect complexity
  const complexity = detectQueryComplexity(query);

  // Step 3: Determine response profile
  const responseProfile = determineResponseProfile(query, complexity);

  // Step 4: Decompose query into sub-questions
  const subQuestions = decomposeQuery(query, complexity, language);

  // Step 5: Plan execution order
  const executionOrder = planExecutionOrder(subQuestions);

  // Step 6: Estimate tokens (rough estimate)
  const estimatedTokens = subQuestions.length * 1500; // ~1500 tokens per sub-question

  const plan: QueryPlan = {
    originalQuery: query,
    complexity,
    responseProfile,
    subQuestions,
    executionOrder,
    totalSteps: subQuestions.length,
    estimatedTokens,
    language,
  };

  console.log('[COMPLEX-PLANNER] ═══════════════════════════════════════════');
  console.log('[COMPLEX-PLANNER] Query Plan Created:');
  console.log(`  • Complexity: ${complexity}`);
  console.log(`  • Response Profile: ${responseProfile}`);
  console.log(`  • Sub-questions: ${subQuestions.length}`);
  console.log(`  • Execution Order: ${executionOrder.join(' → ')}`);
  console.log(`  • Language: ${language}`);
  console.log('[COMPLEX-PLANNER] ═══════════════════════════════════════════');

  return plan;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a query needs plan-driven retrieval
 *
 * @param plan - Query plan
 * @returns true if plan-driven retrieval should be used
 */
export function needsPlanDrivenRetrieval(plan: QueryPlan): boolean {
  return plan.complexity === 'complex' || plan.subQuestions.length > 1;
}

/**
 * Get localized planning prompts
 */
export function getPlanningPrompt(plan: QueryPlan): string {
  const prompts: Record<string, string> = {
    en: `This is a ${plan.complexity} query with ${plan.subQuestions.length} parts. I'll address each part systematically.`,
    pt: `Esta é uma pergunta ${plan.complexity === 'complex' ? 'complexa' : plan.complexity === 'medium' ? 'moderada' : 'simples'} com ${plan.subQuestions.length} partes. Vou abordar cada parte sistematicamente.`,
    es: `Esta es una pregunta ${plan.complexity === 'complex' ? 'compleja' : plan.complexity === 'medium' ? 'moderada' : 'simple'} con ${plan.subQuestions.length} partes. Abordaré cada parte sistemáticamente.`,
  };

  return prompts[plan.language] || prompts.en;
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export const kodaComplexQueryPlanner = {
  detectQueryComplexity,
  determineResponseProfile,
  createQueryPlan,
  needsPlanDrivenRetrieval,
  getPlanningPrompt,
};

export default kodaComplexQueryPlanner;
