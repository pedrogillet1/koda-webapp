/**
 * ============================================================================
 * KODA CENTRAL ROUTER SERVICE
 * ============================================================================
 *
 * THE SINGLE DECISION POINT FOR ALL QUERIES
 *
 * This service replaces scattered intent detection with ONE centralized router
 * that decides everything about how a query should be handled.
 *
 * CONSOLIDATES:
 * - kodaIntentEngine.service.ts (intent patterns)
 * - skillAndIntentRouter.service.ts (skill routing)
 * - answerTypeRouter.service.ts (answer type detection)
 * - simpleIntentDetection.service.ts (simple patterns)
 * - ragModes.service.ts (mode selection)
 *
 * DESIGN PRINCIPLES:
 * 1. ONE call per query - no re-detection
 * 2. Fast pattern matching first (no LLM for trivial cases)
 * 3. Fallback to default for ambiguous queries
 * 4. Returns complete RoutePlan that all other services trust
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { detectLanguage } from './languageDetection.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Primary intent categories
 */
export type PrimaryIntent =
  | 'meta'                    // System/metadata queries (count docs, list types)
  | 'file_action'             // File operations (open, delete, upload)
  | 'doc_search'              // Document search/listing
  | 'single_doc_factual'      // Single document Q&A
  | 'multi_doc_comparison'    // Compare multiple documents
  | 'calculation'             // ROI, payback, percentages
  | 'navigation'              // Navigate to section/page
  | 'summary'                 // Summarize document/section
  | 'onboarding'              // Help/how-to questions
  | 'no_docs_help'            // User has no documents
  | 'greeting'                // Hello, hi, good morning
  | 'edge';                   // Fallback/unknown

/**
 * Complexity levels determine performance budget
 */
export type ComplexityLevel =
  | 'ultra_fast'  // < 1s (greetings, simple meta)
  | 'fast'        // 1-2s (meta with DB, doc listing)
  | 'simple'      // 3-4s (single-doc factual)
  | 'complex';    // 4-6s (multi-doc, calculations)

/**
 * Answer mode determines formatting style
 */
export type AnswerMode =
  | 'direct_short'          // 1 paragraph, no headings
  | 'bullet_list'           // Bullets only, minimal prose
  | 'structured_sections'   // Headings + sections
  | 'steps'                 // Numbered steps (onboarding)
  | 'explanatory';          // Full explanation with context

/**
 * Complete route plan for a query
 * This is the contract between router and all other services
 */
export interface KodaRoutePlan {
  // Intent & Classification
  primaryIntent: PrimaryIntent;
  complexity: ComplexityLevel;

  // Retrieval Configuration
  requiresDocs: boolean;           // true = RAG, false = pure reasoning/meta
  requiredDocIds?: string[];       // Explicit docs from query
  topK: number;                    // Retrieval depth (0 = no retrieval)

  // Answer Configuration
  answerMode: AnswerMode;
  maxTokens: number;               // LLM output limit

  // Feature Flags
  needsCalculation: boolean;
  needsSlidesHandler: boolean;
  needsMemoryContext: boolean;     // Use conversation memory
  needsDocumentListing: boolean;   // Return doc list with markers
  needsReranking: boolean;         // Apply microSummary reranking

  // Metadata
  detectedLanguage: string;
  confidence: number;              // 0-1, how confident the router is
  routingMethod: 'pattern' | 'llm' | 'fallback';

  // Extracted Entities
  extractedDocNames?: string[];
  extractedFolderNames?: string[];
  extractedNumbers?: number[];
  extractedKeywords?: string[];
}

/**
 * Input context for routing decision
 */
export interface RoutingContext {
  query: string;
  userId: string;
  conversationId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  hasDocuments: boolean;
  documentCount: number;
  detectedLanguage?: string;
}

// ============================================================================
// PATTERN-BASED ROUTING (FAST PATH)
// ============================================================================

/**
 * Ultra-fast pattern matching for trivial queries
 * Returns route plan immediately without LLM
 */
function detectUltraFastPath(query: string, lang: string, hasDocuments: boolean): KodaRoutePlan | null {
  const lowerQuery = query.toLowerCase().trim();

  // ========================================================================
  // GREETINGS (< 0.5s target)
  // ========================================================================
  const greetingPatterns: Record<string, RegExp> = {
    pt: /^(oi|olá|ola|bom\s+dia|boa\s+tarde|boa\s+noite|hey|e\s+aí|tudo\s+bem|como\s+vai)[\s!?]*$/i,
    en: /^(hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening|what's\s+up|how\s+are\s+you)[\s!?]*$/i,
    es: /^(hola|buenos\s+días|buenas\s+tardes|buenas\s+noches|qué\s+tal|cómo\s+estás)[\s!?]*$/i
  };

  if (greetingPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'greeting',
      complexity: 'ultra_fast',
      requiresDocs: false,
      topK: 0,
      answerMode: 'direct_short',
      maxTokens: 80,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: false,
      needsDocumentListing: false,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 1.0,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // DOCUMENT COUNT (< 1s target)
  // ========================================================================
  const countPatterns: Record<string, RegExp> = {
    pt: /\b(quantos?|quantas?)\s+(documentos?|arquivos?|ficheiros?|pdfs?|docx?|xlsx?)\b/i,
    en: /\b(how\s+many)\s+(documents?|files?|pdfs?|docx?|xlsx?)\b/i,
    es: /\b(cuántos?|cuántas?)\s+(documentos?|archivos?|ficheros?|pdfs?|docx?|xlsx?)\b/i
  };

  if (countPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'meta',
      complexity: 'ultra_fast',
      requiresDocs: false,
      topK: 0,
      answerMode: 'direct_short',
      maxTokens: 100,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: false,
      needsDocumentListing: false,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 0.95,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // NO DOCUMENTS - ONBOARDING (< 1s target)
  // ========================================================================
  if (!hasDocuments) {
    const onboardingPatterns: Record<string, RegExp> = {
      pt: /\b(como|o\s+que|para\s+que|funciona|usar|começar|ajuda)\b/i,
      en: /\b(how|what|why|works?|use|start|help)\b/i,
      es: /\b(cómo|qué|para\s+qué|funciona|usar|empezar|ayuda)\b/i
    };

    if (onboardingPatterns[lang]?.test(lowerQuery)) {
      return {
        primaryIntent: 'no_docs_help',
        complexity: 'ultra_fast',
        requiresDocs: false,
        topK: 0,
        answerMode: 'steps',
        maxTokens: 200,
        needsCalculation: false,
        needsSlidesHandler: false,
        needsMemoryContext: false,
        needsDocumentListing: false,
        needsReranking: false,
        detectedLanguage: lang,
        confidence: 0.9,
        routingMethod: 'pattern'
      };
    }
  }

  return null; // No ultra-fast match
}

/**
 * Fast pattern matching for common queries
 * Returns route plan using regex patterns
 */
function detectFastPath(query: string, lang: string, hasDocuments: boolean): KodaRoutePlan | null {
  const lowerQuery = query.toLowerCase();

  // ========================================================================
  // DOCUMENT LISTING (1-2s target)
  // ========================================================================
  const listPatterns: Record<string, RegExp> = {
    pt: /\b(list[ea]|mostr[ea]|ver)\s+(todos\s+)?(?:os\s+)?(?:meus\s+)?(documentos?|arquivos?)\b/i,
    en: /\b(list|show|view)\s+(all\s+)?(?:my\s+)?(documents?|files?)\b/i,
    es: /\b(list[ae]|mostr[ae]|ver)\s+(todos\s+)?(?:los\s+)?(?:mis\s+)?(documentos?|archivos?)\b/i
  };

  if (listPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'doc_search',
      complexity: 'fast',
      requiresDocs: true,
      topK: 15, // Document-level, not chunks
      answerMode: 'bullet_list',
      maxTokens: 200,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: false,
      needsDocumentListing: true,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 0.9,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // DOCUMENT TYPES (1-2s target)
  // ========================================================================
  const typePatterns: Record<string, RegExp> = {
    pt: /\b(que\s+tipos?|quais\s+tipos?|tipos?\s+de\s+arquivos?)\b/i,
    en: /\b(what\s+types?|which\s+types?|types?\s+of\s+files?)\b/i,
    es: /\b(qué\s+tipos?|cuáles\s+tipos?|tipos?\s+de\s+archivos?)\b/i
  };

  if (typePatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'meta',
      complexity: 'fast',
      requiresDocs: false,
      topK: 0,
      answerMode: 'bullet_list',
      maxTokens: 150,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: false,
      needsDocumentListing: false,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 0.9,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // FILE ACTIONS (1-2s target)
  // ========================================================================
  const fileActionPatterns: Record<string, RegExp> = {
    pt: /\b(abr[aei]|abrir|delet[ae]|exclu[ai]|remov[ae]|visualiz[ae]|download|baixar)\s+(?:o\s+)?(?:arquivo\s+|documento\s+)?/i,
    en: /\b(open|delete|remove|view|download)\s+(?:the\s+)?(?:file\s+|document\s+)?/i,
    es: /\b(abr[aei]|abrir|elimin[ae]|borr[ae]|ver|descargar)\s+(?:el\s+)?(?:archivo\s+|documento\s+)?/i
  };

  if (fileActionPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'file_action',
      complexity: 'fast',
      requiresDocs: true,
      topK: 3,
      answerMode: 'direct_short',
      maxTokens: 100,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: false,
      needsDocumentListing: false,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 0.85,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // CALCULATION QUERIES (3-5s target)
  // ========================================================================
  const calcPatterns: Record<string, RegExp> = {
    pt: /\b(roi|vpl|tir|payback|retorno|lucro|custo|impacto|diferença|variação|percentual|%|calcul[ea]r?)\b/i,
    en: /\b(roi|npv|irr|payback|return|profit|cost|impact|difference|variation|percentage|%|calculat[e]?)\b/i,
    es: /\b(roi|van|tir|payback|retorno|lucro|costo|impacto|diferencia|variación|porcentaje|%|calcul[ae]r?)\b/i
  };

  if (calcPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'calculation',
      complexity: 'complex',
      requiresDocs: true,
      topK: 8,
      answerMode: 'structured_sections',
      maxTokens: 400,
      needsCalculation: true,
      needsSlidesHandler: false,
      needsMemoryContext: true,
      needsDocumentListing: false,
      needsReranking: true,
      detectedLanguage: lang,
      confidence: 0.85,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // COMPARISON QUERIES (4-6s target)
  // ========================================================================
  const comparisonPatterns: Record<string, RegExp> = {
    pt: /\b(compar[ae]r?|versus|vs\.?|diferença|semelhanç[a]|entre\s+.+\s+e\s+)/i,
    en: /\b(compar[e]?|versus|vs\.?|difference|similar|between\s+.+\s+and\s+)/i,
    es: /\b(compar[ae]r?|versus|vs\.?|diferencia|similar|entre\s+.+\s+y\s+)/i
  };

  if (comparisonPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'multi_doc_comparison',
      complexity: 'complex',
      requiresDocs: true,
      topK: 10,
      answerMode: 'structured_sections',
      maxTokens: 500,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: true,
      needsDocumentListing: false,
      needsReranking: true,
      detectedLanguage: lang,
      confidence: 0.85,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // SUMMARY QUERIES (3-4s target)
  // ========================================================================
  const summaryPatterns: Record<string, RegExp> = {
    pt: /\b(resum[oa]|resumir|síntese|sintetiz[ae]|visão\s+geral|principais?\s+pontos?)\b/i,
    en: /\b(summar[iy]|synopsis|overview|synthesize|main\s+points?|key\s+points?)\b/i,
    es: /\b(resumen|resumir|síntesis|sintetiz[ae]|visión\s+general|puntos?\s+principales?)\b/i
  };

  if (summaryPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'summary',
      complexity: 'simple',
      requiresDocs: true,
      topK: 5,
      answerMode: 'structured_sections',
      maxTokens: 300,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: true,
      needsDocumentListing: false,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 0.85,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // NAVIGATION QUERIES (1-2s target)
  // ========================================================================
  const navigationPatterns: Record<string, RegExp> = {
    pt: /\b(ir\s+para|navegar|página|slide|seção|capítulo|abrir\s+na\s+página)\b/i,
    en: /\b(go\s+to|navigate|page|slide|section|chapter|open\s+at\s+page)\b/i,
    es: /\b(ir\s+a|navegar|página|diapositiva|sección|capítulo|abrir\s+en\s+página)\b/i
  };

  if (navigationPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'navigation',
      complexity: 'fast',
      requiresDocs: true,
      topK: 3,
      answerMode: 'direct_short',
      maxTokens: 100,
      needsCalculation: false,
      needsSlidesHandler: true,
      needsMemoryContext: false,
      needsDocumentListing: false,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 0.85,
      routingMethod: 'pattern'
    };
  }

  // ========================================================================
  // HELP/ONBOARDING QUERIES (1-2s target)
  // ========================================================================
  const helpPatterns: Record<string, RegExp> = {
    pt: /\b(como\s+funciona|o\s+que\s+você\s+(pode|faz)|ajuda|help|tutorial|como\s+usar)\b/i,
    en: /\b(how\s+do\s+you\s+work|what\s+can\s+you\s+do|help|tutorial|how\s+to\s+use)\b/i,
    es: /\b(cómo\s+funciona|qué\s+puedes\s+hacer|ayuda|help|tutorial|cómo\s+usar)\b/i
  };

  if (helpPatterns[lang]?.test(lowerQuery)) {
    return {
      primaryIntent: 'onboarding',
      complexity: 'fast',
      requiresDocs: false,
      topK: 0,
      answerMode: 'steps',
      maxTokens: 300,
      needsCalculation: false,
      needsSlidesHandler: false,
      needsMemoryContext: false,
      needsDocumentListing: false,
      needsReranking: false,
      detectedLanguage: lang,
      confidence: 0.9,
      routingMethod: 'pattern'
    };
  }

  return null; // No fast match
}

/**
 * Extract document names from query
 */
function extractDocumentReferences(query: string): string[] {
  const docNames: string[] = [];

  // Match common file extensions
  const fileExtPattern = /([^\s,]+\.(?:pdf|docx?|xlsx?|pptx?|txt|csv))/gi;
  const matches = query.match(fileExtPattern);
  if (matches) {
    docNames.push(...matches);
  }

  // Match quoted names
  const quotedPattern = /["']([^"']+)["']/g;
  let match;
  while ((match = quotedPattern.exec(query)) !== null) {
    docNames.push(match[1]);
  }

  return [...new Set(docNames)]; // Remove duplicates
}

/**
 * Extract folder names from query
 */
function extractFolderReferences(query: string, lang: string): string[] {
  const folderNames: string[] = [];

  const folderPatterns: Record<string, RegExp> = {
    pt: /\b(?:na\s+pasta|pasta|folder)\s+["']?([^"',\s]+)["']?/gi,
    en: /\b(?:in\s+folder|folder)\s+["']?([^"',\s]+)["']?/gi,
    es: /\b(?:en\s+carpeta|carpeta|folder)\s+["']?([^"',\s]+)["']?/gi
  };

  const pattern = folderPatterns[lang];
  if (pattern) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      folderNames.push(match[1]);
    }
  }

  return [...new Set(folderNames)];
}

/**
 * Extract numbers from query (useful for calculations)
 */
function extractNumbers(query: string): number[] {
  const numberPattern = /\b(\d+(?:[.,]\d+)?)\b/g;
  const numbers: number[] = [];
  let match;
  while ((match = numberPattern.exec(query)) !== null) {
    const num = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(num)) {
      numbers.push(num);
    }
  }
  return numbers;
}

/**
 * Determine if query needs memory context (references previous conversation)
 */
function needsMemoryContext(query: string, lang: string): boolean {
  // Follow-up indicators
  const followUpPatterns: Record<string, RegExp> = {
    pt: /\b(e\s+)?(?:isso|esse|essa|este|esta|aquele|aquela|ele|ela|o\s+mesmo|a\s+mesma)\b/i,
    en: /\b(and\s+)?(?:this|that|it|these|those|the\s+same)\b/i,
    es: /\b(y\s+)?(?:esto|eso|este|esta|aquel|aquella|él|ella|lo\s+mismo)\b/i
  };

  return followUpPatterns[lang]?.test(query) || false;
}

// ============================================================================
// MAIN ROUTING FUNCTION
// ============================================================================

/**
 * Route a query to determine how it should be handled
 * This is the SINGLE decision point for all queries
 *
 * @param context - Query and user context
 * @returns Complete route plan for the query
 */
export async function routeQuery(context: RoutingContext): Promise<KodaRoutePlan> {
  const { query, hasDocuments, documentCount } = context;

  // Detect language
  const detectedLanguage = context.detectedLanguage || detectLanguage(query);

  console.log(`[CENTRAL-ROUTER] Routing query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
  console.log(`[CENTRAL-ROUTER] Language: ${detectedLanguage}, Has docs: ${hasDocuments}, Count: ${documentCount}`);

  // ========================================================================
  // STEP 1: Try ultra-fast path (< 1s)
  // ========================================================================
  const ultraFastRoute = detectUltraFastPath(query, detectedLanguage, hasDocuments);
  if (ultraFastRoute) {
    console.log(`[CENTRAL-ROUTER] Ultra-fast route: ${ultraFastRoute.primaryIntent}`);
    return ultraFastRoute;
  }

  // ========================================================================
  // STEP 2: Try fast path (1-2s)
  // ========================================================================
  const fastRoute = detectFastPath(query, detectedLanguage, hasDocuments);
  if (fastRoute) {
    console.log(`[CENTRAL-ROUTER] Fast route: ${fastRoute.primaryIntent}`);

    // Extract entities
    fastRoute.extractedDocNames = extractDocumentReferences(query);
    fastRoute.extractedFolderNames = extractFolderReferences(query, detectedLanguage);
    fastRoute.extractedNumbers = extractNumbers(query);
    fastRoute.needsMemoryContext = needsMemoryContext(query, detectedLanguage);

    return fastRoute;
  }

  // ========================================================================
  // STEP 3: Default to simple document Q&A (3-4s)
  // ========================================================================
  console.log(`[CENTRAL-ROUTER] Default route: single_doc_factual`);

  const defaultRoute: KodaRoutePlan = {
    primaryIntent: 'single_doc_factual',
    complexity: 'simple',
    requiresDocs: true,
    topK: 5,
    answerMode: 'direct_short',
    maxTokens: 250,
    needsCalculation: false,
    needsSlidesHandler: false,
    needsMemoryContext: needsMemoryContext(query, detectedLanguage),
    needsDocumentListing: false,
    needsReranking: false,
    detectedLanguage,
    confidence: 0.7,
    routingMethod: 'fallback',
    extractedDocNames: extractDocumentReferences(query),
    extractedFolderNames: extractFolderReferences(query, detectedLanguage),
    extractedNumbers: extractNumbers(query)
  };

  return defaultRoute;
}

/**
 * Get performance budget for a complexity level
 */
export function getPerformanceBudget(complexity: ComplexityLevel): {
  targetMs: number;
  maxMs: number;
  description: string;
} {
  const budgets: Record<ComplexityLevel, { targetMs: number; maxMs: number; description: string }> = {
    ultra_fast: {
      targetMs: 500,
      maxMs: 1000,
      description: 'Greetings, simple meta queries'
    },
    fast: {
      targetMs: 1500,
      maxMs: 2000,
      description: 'Meta with DB, document listing'
    },
    simple: {
      targetMs: 3000,
      maxMs: 4000,
      description: 'Single-doc factual Q&A'
    },
    complex: {
      targetMs: 5000,
      maxMs: 6000,
      description: 'Multi-doc comparison, calculations'
    }
  };

  return budgets[complexity];
}

/**
 * Check if route plan indicates a meta query (no content retrieval needed)
 */
export function isMetaRoute(plan: KodaRoutePlan): boolean {
  return plan.primaryIntent === 'meta' ||
         plan.primaryIntent === 'greeting' ||
         plan.primaryIntent === 'onboarding' ||
         plan.primaryIntent === 'no_docs_help';
}

/**
 * Check if route plan indicates a document search query
 */
export function isDocSearchRoute(plan: KodaRoutePlan): boolean {
  return plan.primaryIntent === 'doc_search' || plan.needsDocumentListing;
}

/**
 * Check if route plan indicates a calculation query
 */
export function isCalculationRoute(plan: KodaRoutePlan): boolean {
  return plan.primaryIntent === 'calculation' || plan.needsCalculation;
}

export const kodaCentralRouter = {
  routeQuery,
  getPerformanceBudget,
  isMetaRoute,
  isDocSearchRoute,
  isCalculationRoute
};

export default kodaCentralRouter;
