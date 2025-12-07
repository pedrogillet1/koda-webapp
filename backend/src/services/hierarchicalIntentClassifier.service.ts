/**
 * ============================================================================
 * HIERARCHICAL INTENT CLASSIFIER SERVICE - GEMINI 2.5 FLASH
 * ============================================================================
 *
 * Two-stage intent classification system:
 * - Stage 1: Heuristic classifier (regex/keywords) - 80% queries, 0ms, $0
 * - Stage 2: LLM classifier (Gemini 2.5 Flash) - 20% queries, 200ms, $0.001
 *
 * Features:
 * - Multi-dimensional classification (intent + complexity + confidence)
 * - Query decomposition for complex queries
 * - Clarification logic for ambiguous queries
 * - Context-aware classification (conversation history, active documents)
 *
 * Changes from contextAwareIntentDetection.service.ts:
 * 1. Added two-stage architecture (heuristic + LLM)
 * 2. Added summarization, transformation, clarification_needed intents
 * 3. Separated complexity from intent (orthogonal dimensions)
 * 4. Added query decomposition for complex queries
 * 5. Added confidence threshold for clarification
 * 6. Optimized for Gemini 2.5 Flash with structured JSON output
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type IntentCategory =
  // Document-centric intents
  | 'document_lookup'        // "Show me X", "Open Y"
  | 'document_preview'       // "Show content of X"
  | 'document_listing'       // "List documents in folder X"
  | 'file_search'            // "Find file named X"
  | 'file_action'            // "Create/move/rename/delete X"
  | 'folder_navigation'      // "Open folder X"
  | 'metadata_query'         // "How many files?", "When was X uploaded?"

  // Content-centric intents
  | 'content_question'       // "What does X say about Y?"
  | 'summarization'          // "Summarize X"
  | 'explanation'            // "Explain X", "Why Y?"
  | 'comparison'             // "Compare A vs B"
  | 'transformation'         // "Rewrite X", "Draft Y"
  | 'calculation'            // "Calculate X from documents"
  | 'synthesis'              // "Across all documents, what..."

  // System intents
  | 'clarification_needed'   // Low confidence, needs clarification
  | 'greeting'               // "Hello", "Thanks"
  | 'capability'             // "What can you do?"
  | 'refusal'                // "Can't do X"
  | 'general';               // Fallback

export type ComplexityLevel = 'simple' | 'medium' | 'complex';

export interface SubQuestion {
  question: string;
  intent: IntentCategory;
  targetDocuments?: string[];
  targetDimension?: string;  // For comparisons: "price", "duration", etc.
  order: number;
}

export interface ExtractedEntity {
  type: 'filename' | 'folder' | 'topic' | 'date' | 'number' | 'person' | 'organization';
  value: string;
  confidence: number;
  originalText: string;
}

export interface ResolvedPronoun {
  pronoun: string;
  resolvedTo: string;
  confidence: number;
  source: 'previous_query' | 'assistant_response' | 'entity_mention';
}

export interface IntentResult {
  // Primary classification
  primaryIntent: IntentCategory;
  subIntent?: string;

  // Multi-dimensional classification
  secondaryIntents: IntentCategory[];
  complexity: ComplexityLevel;
  confidence: number;

  // Decomposition (for complex queries)
  subQuestions?: SubQuestion[];

  // Clarification (if needed)
  clarificationNeeded?: string;
  clarificationOptions?: string[];

  // Context
  entities: ExtractedEntity[];
  resolvedPronouns: ResolvedPronoun[];
  resolvedQuery: string;

  // Meta
  source: 'heuristic' | 'llm';
  processingTimeMs: number;
  language: 'en' | 'pt' | 'es';
  originalQuery: string;
}

export interface ClassificationContext {
  conversationHistory?: Array<{ role: string; content: string }>;
  activeDocuments?: string[];
  lastQuery?: string;
  lastAnswer?: string;
  language?: 'en' | 'pt' | 'es';
}

// ============================================================================
// GEMINI CLIENT INITIALIZATION
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================================
// CONSTANTS
// ============================================================================

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.6,
};

// ============================================================================
// HEURISTIC PATTERNS (Stage 1)
// ============================================================================

const HEURISTIC_PATTERNS = {
  // Document operations
  document_preview: [
    /^(show|display|open)\s+\w+/i,
    /^(show|display|open)\s+(me\s+)?the\s+\w+/i,
  ],

  file_search: [
    /^(find|search|locate)\s+\w+/i,
    /^(find|search|locate)\s+(me\s+)?the\s+\w+/i,
    /^where\s+is\s+\w+/i,
  ],

  document_listing: [
    /^(list|show)\s+(all\s+)?(documents|files)/i,
    /^what\s+(documents|files)\s+do\s+i\s+have/i,
  ],

  folder_navigation: [
    /^(open|navigate\s+to)\s+(the\s+)?folder/i,
    /^go\s+to\s+(the\s+)?folder/i,
  ],

  file_action: [
    /^(create|make|new)\s+(a\s+)?(document|file|folder)/i,
    /^(delete|remove|erase)\s+\w+/i,
    /^(move|transfer|copy)\s+\w+/i,
    /^(rename)\s+\w+/i,
  ],

  // Content operations
  summarization: [
    /\b(summarize|summary|overview|tldr|give\s+me\s+a\s+summary)\b/i,
    /^what\s+is\s+the\s+summary/i,
    /^can\s+you\s+summarize/i,
  ],

  comparison: [
    /\b(compare|vs|versus|difference|differences|better\s+than|worse\s+than)\b/i,
    /^what\s+is\s+the\s+difference/i,
    /^which\s+is\s+better/i,
  ],

  explanation: [
    /\b(explain|why|how\s+does|what\s+does.*mean|clarify|describe)\b/i,
    /^can\s+you\s+explain/i,
    /^what\s+does\s+it\s+mean/i,
  ],

  transformation: [
    /\b(rewrite|paraphrase|draft|turn\s+into|rephrase|convert|translate)\b/i,
    /^can\s+you\s+rewrite/i,
    /^make\s+it\s+(simpler|shorter|longer)/i,
  ],

  calculation: [
    /\b(calculate|compute|total|sum|average|count)\b/i,
    /^what\s+is\s+the\s+total/i,
    /^how\s+much\s+is/i,
  ],

  // System operations
  greeting: [
    /^(hi|hello|hey|thanks|thank\s+you|good\s+morning|good\s+afternoon)$/i,
  ],

  capability: [
    /^what\s+can\s+you\s+do/i,
    /^what\s+are\s+you\s+capable\s+of/i,
    /^help$/i,
  ],

  // Content questions - the most common RAG query type (PERF: Skip LLM for simple questions)
  content_question: [
    /^what\s+(is|are|was|were)\s+/i,           // What is/are the revenue...
    /^who\s+(is|are|was|were)\s+/i,            // Who is responsible for...
    /^when\s+(is|are|was|were|did|does)\s+/i,  // When is the deadline...
    /^where\s+(is|are|was|were)\s+/i,          // Where is the office...
    /^how\s+(is|are|do|does|did|can)\s+/i,     // How do I apply...
    /^which\s+/i,                                // Which products...
    /^tell\s+me\s+(about|what)/i,              // Tell me about...
    /^can\s+you\s+(tell|show|give)\s+me/i,    // Can you tell me...
  ],
};

// ============================================================================
// STAGE 1: HEURISTIC CLASSIFIER
// ============================================================================

function heuristicClassifier(
  query: string,
  context: ClassificationContext
): IntentResult | null {
  const startTime = Date.now();
  const lowerQuery = query.toLowerCase().trim();

  // Try each intent pattern
  for (const [intent, patterns] of Object.entries(HEURISTIC_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        // Determine complexity based on query length and structure
        let complexity: ComplexityLevel = 'simple';
        if (lowerQuery.length > 100 || lowerQuery.includes(' and ') || lowerQuery.includes(' then ')) {
          complexity = 'complex';
        } else if (lowerQuery.length > 50) {
          complexity = 'medium';
        }

        return {
          primaryIntent: intent as IntentCategory,
          secondaryIntents: [],
          complexity,
          confidence: 0.95,
          entities: [],
          resolvedPronouns: [],
          resolvedQuery: query,
          source: 'heuristic',
          processingTimeMs: Date.now() - startTime,
          language: context.language || 'en',
          originalQuery: query,
        };
      }
    }
  }

  // No heuristic match
  return null;
}

// ============================================================================
// STAGE 2: LLM CLASSIFIER
// ============================================================================

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    primaryIntent: {
      type: 'string',
      enum: [
        'document_lookup', 'document_preview', 'document_listing', 'file_search',
        'file_action', 'folder_navigation', 'metadata_query', 'content_question',
        'summarization', 'explanation', 'comparison', 'transformation',
        'calculation', 'synthesis', 'clarification_needed', 'greeting',
        'capability', 'refusal', 'general'
      ]
    },
    subIntent: { type: 'string' },
    secondaryIntents: {
      type: 'array',
      items: { type: 'string' }
    },
    complexity: {
      type: 'string',
      enum: ['simple', 'medium', 'complex']
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    subQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          intent: { type: 'string' },
          targetDocuments: {
            type: 'array',
            items: { type: 'string' }
          },
          targetDimension: { type: 'string' },
          order: { type: 'number' }
        },
        required: ['question', 'intent', 'order']
      }
    },
    clarificationNeeded: { type: 'string' },
    clarificationOptions: {
      type: 'array',
      items: { type: 'string' }
    },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          value: { type: 'string' },
          confidence: { type: 'number' },
          originalText: { type: 'string' }
        },
        required: ['type', 'value', 'confidence']
      }
    },
    resolvedPronouns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pronoun: { type: 'string' },
          resolvedTo: { type: 'string' },
          confidence: { type: 'number' },
          source: { type: 'string' }
        },
        required: ['pronoun', 'resolvedTo', 'confidence', 'source']
      }
    },
    resolvedQuery: { type: 'string' }
  },
  required: ['primaryIntent', 'secondaryIntents', 'complexity', 'confidence', 'resolvedQuery']
};

function buildClassificationPrompt(query: string, context: ClassificationContext): string {
  const conversationContext = context.conversationHistory
    ? context.conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')
    : 'No previous conversation';

  const activeDocsContext = context.activeDocuments && context.activeDocuments.length > 0
    ? `Active documents: ${context.activeDocuments.join(', ')}`
    : 'No active documents';

  return `You are an intent classifier for Koda, a document assistant AI.

Classify the user's query into:
1. primaryIntent (one of: document_lookup, document_preview, document_listing, file_search, file_action, folder_navigation, metadata_query, content_question, summarization, explanation, comparison, transformation, calculation, synthesis, clarification_needed, greeting, capability, refusal, general)
2. secondaryIntents (array of additional intents, if multi-task query)
3. complexity (simple, medium, or complex)
4. confidence (0.0 - 1.0)
5. subQuestions (if complex/multi-part query, decompose into sub-questions with order)

Context:
${conversationContext}

${activeDocsContext}

User's query: "${query}"

Rules:
- If confidence < 0.6 OR query is ambiguous (missing document reference), set primaryIntent = 'clarification_needed' and provide clarificationNeeded message
- If query has multiple tasks (and, then, also), include all in secondaryIntents
- If complex query (comparison, multi-document, multi-step), decompose into subQuestions with order
- Extract entities (filenames, topics, dates, numbers)
- Resolve pronouns using conversation history
- For summarization: primaryIntent = 'summarization'
- For comparison: primaryIntent = 'comparison', include targetDimensions in subQuestions
- For explanation: primaryIntent = 'explanation'
- For transformation (rewrite, paraphrase, draft): primaryIntent = 'transformation'

Examples:

Query: "Summarize this document"
Output: { primaryIntent: "summarization", complexity: "simple", confidence: 0.9 }

Query: "Compare these 5 contracts on price and duration"
Output: { primaryIntent: "comparison", complexity: "complex", confidence: 0.85, subQuestions: [{ question: "For each contract, what is the price?", intent: "content_question", targetDimension: "price", order: 1 }, { question: "For each contract, what is the duration?", intent: "content_question", targetDimension: "duration", order: 2 }] }

Query: "What does it say about termination?" (no active document)
Output: { primaryIntent: "clarification_needed", confidence: 0.4, clarificationNeeded: "Which document should I check?" }

Query: "Explain the diagnosis in simple terms"
Output: { primaryIntent: "explanation", complexity: "medium", confidence: 0.9 }

Query: "Rewrite this clause in friendlier language"
Output: { primaryIntent: "transformation", complexity: "medium", confidence: 0.9 }

Now classify this query and output JSON only (no additional text).`;
}

async function llmClassifier(
  query: string,
  context: ClassificationContext
): Promise<IntentResult> {
  const startTime = Date.now();

  const prompt = buildClassificationPrompt(query, context);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json',
      responseSchema: INTENT_SCHEMA as any,
    },
  });

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  // Parse JSON response
  const parsed = JSON.parse(responseText);

  // Build IntentResult
  const intentResult: IntentResult = {
    primaryIntent: parsed.primaryIntent,
    subIntent: parsed.subIntent,
    secondaryIntents: parsed.secondaryIntents || [],
    complexity: parsed.complexity,
    confidence: parsed.confidence,
    subQuestions: parsed.subQuestions,
    clarificationNeeded: parsed.clarificationNeeded,
    clarificationOptions: parsed.clarificationOptions,
    entities: parsed.entities || [],
    resolvedPronouns: parsed.resolvedPronouns || [],
    resolvedQuery: parsed.resolvedQuery || query,
    source: 'llm',
    processingTimeMs: Date.now() - startTime,
    language: context.language || 'en',
    originalQuery: query,
  };

  return intentResult;
}

// ============================================================================
// MAIN CLASSIFIER (Orchestrator)
// ============================================================================

export async function classifyIntent(
  query: string,
  context: ClassificationContext = {}
): Promise<IntentResult> {
  const startTime = Date.now();

  console.log(`[INTENT] Classifying query: "${query}"`);

  // Stage 1: Try heuristic classifier
  const heuristicResult = heuristicClassifier(query, context);
  if (heuristicResult && heuristicResult.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    console.log(`[INTENT] Heuristic match: ${heuristicResult.primaryIntent} (confidence: ${heuristicResult.confidence}, ${heuristicResult.processingTimeMs}ms)`);
    return heuristicResult;
  }

  // Stage 2: Fall back to LLM classifier
  console.log(`[INTENT] Heuristic failed, using LLM classifier`);
  const llmResult = await llmClassifier(query, context);

  const totalTime = Date.now() - startTime;
  console.log(`[INTENT] LLM match: ${llmResult.primaryIntent} (confidence: ${llmResult.confidence}, ${totalTime}ms)`);

  return llmResult;
}

// ============================================================================
// QUERY DECOMPOSITION
// ============================================================================

export function shouldDecompose(intent: IntentResult): boolean {
  return (
    intent.complexity === 'complex' ||
    intent.secondaryIntents.length > 0 ||
    (intent.subQuestions !== undefined && intent.subQuestions.length > 0)
  );
}

export async function decomposeQuery(
  query: string,
  intent: IntentResult,
  context: ClassificationContext
): Promise<SubQuestion[]> {
  // If LLM already decomposed, use that
  if (intent.subQuestions && intent.subQuestions.length > 0) {
    return intent.subQuestions;
  }

  // Otherwise, use LLM to decompose
  const prompt = `Decompose this complex query into ordered sub-questions:

Query: "${query}"
Primary intent: ${intent.primaryIntent}
Secondary intents: ${intent.secondaryIntents.join(', ')}

Rules:
- Each sub-question should be atomic (single task)
- Order matters (sequential execution)
- Include target documents and dimensions for each sub-question

Output JSON array of sub-questions:
[
  {
    "question": "...",
    "intent": "...",
    "targetDocuments": [...],
    "targetDimension": "...",
    "order": 1
  },
  ...
]`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(prompt);
  const subQuestions = JSON.parse(result.response.text());

  return subQuestions;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const hierarchicalIntentClassifierService = {
  classifyIntent,
  shouldDecompose,
  decomposeQuery,
};
