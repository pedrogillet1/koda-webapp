// ============================================================================
// RAG MODES SERVICE - 4-Mode Performance Optimization
// ============================================================================
// Based on expert recommendations and performance analysis
// Implements: ULTRA_FAST_META, FAST_FACT_RAG, NORMAL_RAG, DEEP_ANALYSIS

export type RAGMode = 'ULTRA_FAST_META' | 'FAST_FACT_RAG' | 'NORMAL_RAG' | 'DEEP_ANALYSIS' | 'DEEP_FINANCIAL_ANALYSIS';

export interface RAGModeConfig {
  mode: RAGMode;
  targetLatency: string;

  // Routing
  enableContextIntent: boolean;
  enableConversationCheck: boolean;
  enableCalculation: boolean;
  enableExcel: boolean;
  enableDocumentSearch: boolean;
  enableFastPath: boolean;
  enableFallback: boolean;
  enableAdvancedQueryType: boolean;
  enableEntityExtraction: boolean;
  enableSynthesis: boolean;
  enableDataExtraction: boolean;
  enableMetadata: boolean;
  enableFileAction: boolean;
  enableComparison: boolean;
  enableCounting: boolean;
  enableTypes: boolean;
  enableNavigation: boolean;
  enableMethodology: boolean;
  enableTrend: boolean;
  enableDomain: boolean;
  enableTerminology: boolean;

  // Retrieval
  enableRetrieval: boolean;
  retrievalStrategy: 'none' | 'bm25_only' | 'pinecone_only' | 'hybrid';
  topK: number;
  enableReranking: boolean;
  rerankStrategy: 'none' | 'chunktype_only' | 'micro_summary';
  maxRerankCandidates: number;

  // Context
  enableRollingSummary: boolean;
  enablePronounMapping: boolean;
  enableEntityMap: boolean;
  maxChunks: number;

  // LLM
  model: 'gemini-2.0-flash-exp' | 'gemini-1.5-pro';
  systemPromptType: 'micro' | 'small' | 'standard' | 'maximal';
  maxOutputTokens: number;
  temperature: number;

  // Quality
  enableGrounding: boolean;
  enableCitationCheck: boolean;
  enableNumericCheck: boolean;
  enableRegenerateOnFail: boolean;

  // Caching
  cacheTTL: number; // seconds
}

// ============================================================================
// MODE CONFIGURATIONS
// ============================================================================

export const MODE_CONFIGS: Record<RAGMode, RAGModeConfig> = {
  // ==========================================================================
  // MODE 1: ULTRA_FAST_META / GREETING
  // ==========================================================================
  // For: "Olá", "Quantos documentos?", "Quais tipos de arquivos?"
  // Target: 0.2-1.0s
  // Strategy: Skip everything, use templates or tiny Flash call

  ULTRA_FAST_META: {
    mode: 'ULTRA_FAST_META',
    targetLatency: '0.2-1.0s',

    // Routing - SKIP ALMOST EVERYTHING
    enableContextIntent: false,  // ❌ Skip (use fast classifier instead)
    enableConversationCheck: false,
    enableCalculation: false,
    enableExcel: false,
    enableDocumentSearch: false,
    enableFastPath: false,  // ❌ This IS the fast path
    enableFallback: false,
    enableAdvancedQueryType: false,
    enableEntityExtraction: false,
    enableSynthesis: false,
    enableDataExtraction: false,
    enableMetadata: true,  // ✅ Only for "quantos documentos?"
    enableFileAction: false,
    enableComparison: false,
    enableCounting: true,  // ✅ Only for "quantos documentos?"
    enableTypes: true,  // ✅ Only for "quais tipos?"
    enableNavigation: false,
    enableMethodology: false,
    enableTrend: false,
    enableDomain: false,
    enableTerminology: false,

    // Retrieval - COMPLETELY OFF
    enableRetrieval: false,
    retrievalStrategy: 'none',
    topK: 0,
    enableReranking: false,
    rerankStrategy: 'none',
    maxRerankCandidates: 0,

    // Context - MINIMAL
    enableRollingSummary: false,
    enablePronounMapping: false,
    enableEntityMap: false,
    maxChunks: 0,

    // LLM - TINY OR NONE
    model: 'gemini-2.0-flash-exp',
    systemPromptType: 'micro',  // 1-2 sentences
    maxOutputTokens: 50,  // Very short
    temperature: 0.7,

    // Quality - SKIP ALL
    enableGrounding: false,
    enableCitationCheck: false,
    enableNumericCheck: false,
    enableRegenerateOnFail: false,

    // Caching - AGGRESSIVE
    cacheTTL: 3600,  // 1 hour
  },

  // ==========================================================================
  // MODE 2: FAST_FACT_RAG (Single Doc Fact)
  // ==========================================================================
  // For: "Qual é o custo por m² no documento X?"
  // Target: 3-5s
  // Strategy: Single doc, minimal retrieval, Flash only

  FAST_FACT_RAG: {
    mode: 'FAST_FACT_RAG',
    targetLatency: '3-5s',

    // Routing - MINIMAL
    enableContextIntent: true,  // ✅ Light intent detection
    enableConversationCheck: false,  // ❌ Skip for speed
    enableCalculation: false,
    enableExcel: false,
    enableDocumentSearch: true,  // ✅ To resolve document name
    enableFastPath: false,
    enableFallback: false,
    enableAdvancedQueryType: false,
    enableEntityExtraction: false,
    enableSynthesis: false,
    enableDataExtraction: false,
    enableMetadata: true,  // ✅ For doc name resolution
    enableFileAction: false,
    enableComparison: false,
    enableCounting: false,
    enableTypes: false,
    enableNavigation: false,
    enableMethodology: false,
    enableTrend: false,
    enableDomain: false,
    enableTerminology: false,

    // Retrieval - LIGHT & FAST
    enableRetrieval: true,
    retrievalStrategy: 'bm25_only',  // ✅ Faster than hybrid
    topK: 4,  // ✅ Small topK
    enableReranking: true,
    rerankStrategy: 'chunktype_only',  // ✅ No micro-summary (save 800ms!)
    maxRerankCandidates: 10,

    // Context - MINIMAL
    enableRollingSummary: false,
    enablePronounMapping: false,
    enableEntityMap: false,
    maxChunks: 4,

    // LLM - FLASH WITH LIMITS
    model: 'gemini-2.0-flash-exp',
    systemPromptType: 'small',  // Short persona + simple instructions
    maxOutputTokens: 150,  // ✅ Short answer
    temperature: 0.3,

    // Quality - LIGHT
    enableGrounding: true,  // ✅ Light numeric check
    enableCitationCheck: true,
    enableNumericCheck: true,
    enableRegenerateOnFail: false,

    // Caching - MODERATE
    cacheTTL: 600,  // 10 minutes
  },

  // ==========================================================================
  // MODE 3: NORMAL_RAG (Main Workhorse)
  // ==========================================================================
  // For: "Resuma o documento X", "O que é Kanban?", "Explique LGPD"
  // Target: 4-7s
  // Strategy: Full retrieval + reranking, but bounded

  NORMAL_RAG: {
    mode: 'NORMAL_RAG',
    targetLatency: '4-7s',

    // Routing - STANDARD
    enableContextIntent: true,
    enableConversationCheck: true,
    enableCalculation: true,
    enableExcel: true,
    enableDocumentSearch: true,
    enableFastPath: false,
    enableFallback: true,
    enableAdvancedQueryType: false,  // ❌ Skip heavy handlers
    enableEntityExtraction: false,
    enableSynthesis: false,
    enableDataExtraction: false,
    enableMetadata: true,
    enableFileAction: true,
    enableComparison: false,  // ❌ Use DEEP_ANALYSIS for this
    enableCounting: true,
    enableTypes: true,
    enableNavigation: true,
    enableMethodology: false,
    enableTrend: false,
    enableDomain: false,
    enableTerminology: false,

    // Retrieval - FULL BUT BOUNDED
    enableRetrieval: true,
    retrievalStrategy: 'hybrid',  // ✅ BM25 + Pinecone + RRF
    topK: 8,
    enableReranking: true,
    rerankStrategy: 'micro_summary',  // ✅ Full reranking
    maxRerankCandidates: 30,  // ✅ Bounded (not 100+)

    // Context - STANDARD
    enableRollingSummary: true,
    enablePronounMapping: true,
    enableEntityMap: false,
    maxChunks: 8,

    // LLM - FLASH OR PRO
    model: 'gemini-2.0-flash-exp',  // Can switch to Pro for quality
    systemPromptType: 'standard',  // Full persona + structure
    maxOutputTokens: 512,
    temperature: 0.3,

    // Quality - FULL
    enableGrounding: true,
    enableCitationCheck: true,
    enableNumericCheck: true,
    enableRegenerateOnFail: false,  // ❌ Too slow

    // Caching - SHORT
    cacheTTL: 300,  // 5 minutes
  },

  // ==========================================================================
  // MODE 4: DEEP_ANALYSIS / AGENTIC_RAG
  // ==========================================================================
  // For: "Compare todos os documentos", "Análise executiva", "Multi-step"
  // Target: 7-15s (acceptable for high-value tasks)
  // Strategy: Everything enabled, multi-step reasoning

  DEEP_ANALYSIS: {
    mode: 'DEEP_ANALYSIS',
    targetLatency: '7-15s',

    // Routing - EVERYTHING
    enableContextIntent: true,
    enableConversationCheck: true,
    enableCalculation: true,
    enableExcel: true,
    enableDocumentSearch: true,
    enableFastPath: false,
    enableFallback: true,
    enableAdvancedQueryType: true,  // ✅ Enable heavy handlers
    enableEntityExtraction: true,
    enableSynthesis: true,
    enableDataExtraction: true,
    enableMetadata: true,
    enableFileAction: true,
    enableComparison: true,
    enableCounting: true,
    enableTypes: true,
    enableNavigation: true,
    enableMethodology: true,
    enableTrend: true,
    enableDomain: true,
    enableTerminology: true,

    // Retrieval - MAXIMAL
    enableRetrieval: true,
    retrievalStrategy: 'hybrid',
    topK: 20,  // ✅ More chunks for deep analysis
    enableReranking: true,
    rerankStrategy: 'micro_summary',
    maxRerankCandidates: 50,  // ✅ More candidates

    // Context - MAXIMAL
    enableRollingSummary: true,
    enablePronounMapping: true,
    enableEntityMap: true,
    maxChunks: 20,

    // LLM - PRO FOR QUALITY
    model: 'gemini-1.5-pro',  // ✅ Use Pro for complex reasoning
    systemPromptType: 'maximal',  // Full persona + all specs
    maxOutputTokens: 2048,  // ✅ Long structured outputs
    temperature: 0.3,

    // Quality - MAXIMAL
    enableGrounding: true,
    enableCitationCheck: true,
    enableNumericCheck: true,
    enableRegenerateOnFail: true,  // ✅ Allow regeneration

    // Caching - MINIMAL
    cacheTTL: 180,  // 3 minutes (results change more)
  },

  // ==========================================================================
  // MODE 5: DEEP_FINANCIAL_ANALYSIS
  // ==========================================================================
  // For: ROI calculations, payback analysis, financial scenario comparisons
  // Target: 7-20s
  // Strategy: Extract numeric facts, calculate financials, detailed analysis

  DEEP_FINANCIAL_ANALYSIS: {
    mode: 'DEEP_FINANCIAL_ANALYSIS',
    targetLatency: '7-20s',

    // Routing - SPECIALIZED FINANCIAL
    enableContextIntent: true,
    enableConversationCheck: true,
    enableCalculation: true,  // ✅ Financial calculations
    enableExcel: true,  // ✅ Often from spreadsheets
    enableDocumentSearch: true,
    enableFastPath: false,
    enableFallback: true,
    enableAdvancedQueryType: true,
    enableEntityExtraction: true,
    enableSynthesis: true,  // ✅ Synthesize scenarios
    enableDataExtraction: true,  // ✅ Extract numeric facts
    enableMetadata: true,
    enableFileAction: false,
    enableComparison: true,  // ✅ Compare scenarios
    enableCounting: false,
    enableTypes: false,
    enableNavigation: true,  // ✅ Find financial docs
    enableMethodology: true,  // ✅ Explain ROI formula
    enableTrend: true,  // ✅ Financial trends
    enableDomain: true,  // ✅ Financial domain knowledge
    enableTerminology: true,  // ✅ Financial terms

    // Retrieval - SCENARIO-BASED
    enableRetrieval: true,
    retrievalStrategy: 'hybrid',  // ✅ Pinecone + BM25 for precision
    topK: 25,  // ✅ Need all scenarios (baseline, conservative, optimistic)
    enableReranking: true,
    rerankStrategy: 'micro_summary',
    maxRerankCandidates: 60,  // ✅ More candidates for scenario docs

    // Context - MAXIMAL
    enableRollingSummary: true,
    enablePronounMapping: true,
    enableEntityMap: true,
    maxChunks: 25,  // ✅ More chunks for financial context

    // LLM - PRO FOR NUMERICAL ACCURACY
    model: 'gemini-1.5-pro',  // ✅ Pro for accurate calculations
    systemPromptType: 'maximal',  // Full financial analysis prompt
    maxOutputTokens: 2048,  // ✅ Long structured financial reports
    temperature: 0.2,  // ✅ Lower temp for numerical precision

    // Quality - MAXIMAL + NUMERIC
    enableGrounding: true,
    enableCitationCheck: true,
    enableNumericCheck: true,  // ✅ Verify all numbers
    enableRegenerateOnFail: true,

    // Caching - MINIMAL (financial data changes)
    cacheTTL: 120,  // 2 minutes (fresher than other modes)
  },
};

// ============================================================================
// FAST MODE CLASSIFIER
// ============================================================================
// <10ms rule-based classifier (no LLM!)
// Determines which mode to use based on simple patterns

export interface ModeClassification {
  mode: RAGMode;
  confidence: number;
  reason: string;
}

export function classifyQueryMode(
  query: string,
  conversationHistory?: Array<{ role: string; content: string }>
): ModeClassification {
  const queryLower = query.toLowerCase().trim();
  const queryLength = query.split(/\s+/).length;

  // ==========================================================================
  // MODE 1: ULTRA_FAST_META / GREETING
  // ==========================================================================

  // Greetings
  if (/^(olá|oi|ola|hey|hi|hello|bom dia|boa tarde|boa noite|good morning|good afternoon|good evening)\b/i.test(queryLower)) {
    return {
      mode: 'ULTRA_FAST_META',
      confidence: 1.0,
      reason: 'Greeting detected'
    };
  }

  // Meta queries about workspace
  const metaPatterns = [
    /quantos documentos/i,
    /how many documents/i,
    /cuántos documentos/i,
    /quais (tipos|arquivos)/i,
    /what (types|files)/i,
    /qué (tipos|archivos)/i,
    /quem (é|sou)/i,
    /who (are|am)/i,
    /o que (você|voce) (pode|faz)/i,
    /what (can|do) you/i,
    /como (funciona|usar)/i,
    /how (does|to use)/i,
  ];

  for (const pattern of metaPatterns) {
    if (pattern.test(queryLower)) {
      return {
        mode: 'ULTRA_FAST_META',
        confidence: 0.95,
        reason: 'Meta query about workspace/app'
      };
    }
  }

  // ==========================================================================
  // MODE 2: FAST_FACT_RAG (Single Doc Fact)
  // ==========================================================================

  // Short query (< 15 words) + mentions one document + asks for one fact
  const mentionsDocument = /\b(documento|document|arquivo|file|pdf|xlsx?|docx?|pptx?)\b/i.test(queryLower);
  const asksForFact = /\b(qual|what|cuál|quanto|how much|cuánto|onde|where|dónde|quando|when|cuándo)\b/i.test(queryLower);
  const hasDocumentName = /\b[a-záàâãéèêíïóôõöúçñ_-]{5,}\.(pdf|xlsx?|docx?|pptx?)\b/i.test(queryLower);

  if (queryLength <= 15 && (mentionsDocument || hasDocumentName) && asksForFact) {
    return {
      mode: 'FAST_FACT_RAG',
      confidence: 0.85,
      reason: 'Short query asking for single fact from one document'
    };
  }

  // Numeric/KPI queries (likely single fact)
  const numericPatterns = [
    /\b(custo|cost|costo|preço|price|precio|valor|value|área|area|receita|revenue|lucro|profit)\b/i,
    /\b(percentagem|percentage|porcentaje|taxa|rate|tasa)\b/i,
    /\b(total|sum|soma|média|average|promedio)\b/i,
  ];

  const hasNumericPattern = numericPatterns.some(p => p.test(queryLower));
  if (queryLength <= 20 && hasNumericPattern && mentionsDocument) {
    return {
      mode: 'FAST_FACT_RAG',
      confidence: 0.80,
      reason: 'Numeric/KPI query about specific document'
    };
  }

  // ==========================================================================
  // MODE 5: DEEP_FINANCIAL_ANALYSIS
  // ==========================================================================

  // ROI/Financial analysis queries
  const financialPatterns = [
    /\b(roi|return on investment|retorno sobre investimento)\b/i,
    /\b(payback|período de retorno|prazo de retorno)\b/i,
    /\b(viabilidade|viability|viabilidad|feasibility)\b/i,
    /\b(cenário|scenario|escenario)\b.*\b(conservador|otimista|pessimista|conservative|optimistic|pessimistic)\b/i,
    /\b(lucro líquido|net profit|beneficio neto)\b/i,
    /\b(investimento|investment|inversión)\b.*\b(retorno|return|rendimiento)\b/i,
    /\b(análise financeira|financial analysis|análisis financiero)\b/i,
    /\b(vpl|npv|tir|irr)\b/i,  // Financial acronyms
  ];

  for (const pattern of financialPatterns) {
    if (pattern.test(queryLower)) {
      return {
        mode: 'DEEP_FINANCIAL_ANALYSIS',
        confidence: 0.95,
        reason: 'Financial analysis query (ROI/payback/scenarios)'
      };
    }
  }

  // Numeric + comparison (likely financial)
  const hasFinancialNumbers = /\b(r\$|reais|brl|milhão|million|mil)\b/i.test(queryLower);
  const hasScenarioMention = /\b(cenário|scenario|escenario)\b/i.test(queryLower);

  if (hasFinancialNumbers && hasScenarioMention) {
    return {
      mode: 'DEEP_FINANCIAL_ANALYSIS',
      confidence: 0.90,
      reason: 'Query mentions scenarios with financial numbers'
    };
  }

  // ==========================================================================
  // MODE 4: DEEP_ANALYSIS (Complex Multi-Doc)
  // ==========================================================================

  // Comparison queries
  const comparisonPatterns = [
    /\b(compare|compara|comparar|comparison|comparación)\b/i,
    /\b(diferença|difference|diferencia|versus|vs\.?)\b/i,
    /\b(todos os documentos|all documents|todos los documentos)\b/i,
  ];

  for (const pattern of comparisonPatterns) {
    if (pattern.test(queryLower)) {
      return {
        mode: 'DEEP_ANALYSIS',
        confidence: 0.90,
        reason: 'Comparison or multi-document analysis'
      };
    }
  }

  // Analysis/synthesis queries
  const analysisPatterns = [
    /\b(analise|analyze|analiza|análise|analysis|análisis)\b/i,
    /\b(resuma todos|summarize all|resume todos)\b/i,
    /\b(executivo|executive|ejecutivo)\b/i,
    /\b(consolidado|consolidated|consolidado)\b/i,
    /\b(tendência|trend|tendencia|padrão|pattern|patrón)\b/i,
  ];

  for (const pattern of analysisPatterns) {
    if (pattern.test(queryLower)) {
      return {
        mode: 'DEEP_ANALYSIS',
        confidence: 0.85,
        reason: 'Analysis or synthesis task'
      };
    }
  }

  // Very long queries (> 30 words) likely complex
  if (queryLength > 30) {
    return {
      mode: 'DEEP_ANALYSIS',
      confidence: 0.75,
      reason: 'Very long query (>30 words) suggests complexity'
    };
  }

  // ==========================================================================
  // MODE 3: NORMAL_RAG (Default)
  // ==========================================================================

  // Everything else goes to NORMAL_RAG
  return {
    mode: 'NORMAL_RAG',
    confidence: 0.70,
    reason: 'Standard document Q&A (default mode)'
  };
}

// ============================================================================
// MODE UTILITIES
// ============================================================================

export function getModeConfig(mode: RAGMode): RAGModeConfig {
  return MODE_CONFIGS[mode];
}

export function logModeClassification(query: string, classification: ModeClassification): void {
  console.log('╔════════════════════════════════════════════════════════════════');
  console.log('║ RAG MODE CLASSIFICATION');
  console.log('╠════════════════════════════════════════════════════════════════');
  console.log(`║ Query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
  console.log(`║ Mode: ${classification.mode}`);
  console.log(`║ Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
  console.log(`║ Reason: ${classification.reason}`);
  console.log('╚════════════════════════════════════════════════════════════════');
}

export function shouldSkipHandler(handlerName: string, config: RAGModeConfig): boolean {
  const handlerMap: Record<string, keyof RAGModeConfig> = {
    'contextIntent': 'enableContextIntent',
    'conversationCheck': 'enableConversationCheck',
    'calculation': 'enableCalculation',
    'excel': 'enableExcel',
    'documentSearch': 'enableDocumentSearch',
    'fastPath': 'enableFastPath',
    'fallback': 'enableFallback',
    'advancedQueryType': 'enableAdvancedQueryType',
    'entityExtraction': 'enableEntityExtraction',
    'synthesis': 'enableSynthesis',
    'dataExtraction': 'enableDataExtraction',
    'metadata': 'enableMetadata',
    'fileAction': 'enableFileAction',
    'comparison': 'enableComparison',
    'counting': 'enableCounting',
    'types': 'enableTypes',
    'navigation': 'enableNavigation',
    'methodology': 'enableMethodology',
    'trend': 'enableTrend',
    'domain': 'enableDomain',
    'terminology': 'enableTerminology',
  };

  const configKey = handlerMap[handlerName];
  if (!configKey) return false;

  return !config[configKey];
}
