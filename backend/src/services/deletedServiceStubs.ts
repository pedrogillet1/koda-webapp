/**
 * STUB FILE: Provides no-op implementations for deleted services
 * These services were removed during the cleanup but are still referenced in code.
 * This file prevents TypeScript errors while maintaining runtime compatibility.
 *
 * TODO: Gradually remove usages of these stubs from the codebase
 */

// ═══════════════════════════════════════════════════════════════════════════
// Semantic Document Search Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const semanticDocumentSearchService = {
  isDocumentSearchQuery: (_query: string): boolean => false,
  search: async (_query: string, _userId: string) => ({
    success: false,
    action: null as string | null,
    message: 'Service disabled',
    documents: [] as any[],
    uiData: null as any,
    query: _query,
    totalResults: 0
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Hybrid Retrieval Booster Stub
// ═══════════════════════════════════════════════════════════════════════════
export const hybridRetrievalBooster = {
  boostRetrievalScores: (matches: any[], _query: string, _boost: number) => matches
};

// ═══════════════════════════════════════════════════════════════════════════
// Fast Path Detector - REAL IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════
// FIX: Re-implemented to properly detect greetings/capability queries
// Uses simpleIntentDetection patterns for fast (<10ms) classification

interface FastPathOptions {
  documentCount?: number;
  hasUploadedDocuments?: boolean;
  language?: string;
  userId?: string;
}

interface FastPathResult {
  isFastPath: boolean;
  response: string | null;
  type: 'greeting' | 'capability' | 'help' | null;
  detectedLanguage: string;
}

// Greeting patterns (multilingual)
const GREETING_PATTERNS = [
  // English
  /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening|day)|howdy|yo|sup|what'?s\s*up)[\s!.?]*$/i,
  /^(thanks|thank\s*you|thx|bye|goodbye|see\s*you|cya|later)[\s!.?]*$/i,
  /^how\s*are\s*you[\s!.?]*$/i,
  // Portuguese
  /^(oi|olá|ola|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*aí|eai|tudo\s*bem|obrigad[oa]|valeu)[\s!.?]*$/i,
  // Spanish
  /^(hola|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|qué\s*tal|gracias)[\s!.?]*$/i,
  // French
  /^(bonjour|bonsoir|salut|coucou|ça\s*va|merci)[\s!.?]*$/i,
];

// Capability patterns (what can you do?)
const CAPABILITY_PATTERNS = [
  /^what\s*(is|can)\s*koda[\s!.?]*$/i,
  /^what'?s\s*koda[\s!.?]*$/i,
  /^what\s*can\s*(you|koda)\s*do[\s!.?]*$/i,
  /^how\s*do(es)?\s*(you|koda)\s*work[\s!.?]*$/i,
  /^(help|ajuda|ayuda|aide)[\s!.?]*$/i,
  /^what\s*are\s*your\s*(capabilities|features)[\s!.?]*$/i,
  // Portuguese
  /^o\s*que\s*[eé]\s*(o\s*)?koda[\s!.?]*$/i,
  /^o\s*que\s*voc[eê]\s*pode\s*fazer[\s!.?]*$/i,
  // Spanish
  /^qu[eé]\s*(es|puede\s*hacer)\s*koda[\s!.?]*$/i,
];

// Detect language from query
function detectQueryLanguage(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Portuguese indicators
  if (/\b(oi|olá|ola|bom|boa|obrigad|valeu|você|voce|fazer|qual|quais|como|onde|porque|por que)\b/i.test(lowerQuery)) {
    return 'pt';
  }

  // Spanish indicators
  if (/\b(hola|buenos|buenas|gracias|qué|que\s+es|cómo|como\s+puedo|dónde|donde|por\s+qué)\b/i.test(lowerQuery)) {
    return 'es';
  }

  // French indicators
  if (/\b(bonjour|bonsoir|salut|merci|comment|qu'est|quoi|pourquoi)\b/i.test(lowerQuery)) {
    return 'fr';
  }

  return 'en';
}

// Generate greeting response
function generateGreetingResponse(language: string, hasDocuments: boolean): string {
  const responses: Record<string, { withDocs: string; noDocs: string }> = {
    en: {
      withDocs: "Hello! I'm Koda, your document assistant. I can help you search, analyze, and work with your uploaded documents. What would you like to know?",
      noDocs: "Hello! I'm Koda, your document assistant. Upload some documents and I'll help you search, analyze, and extract insights from them."
    },
    pt: {
      withDocs: "Olá! Sou a Koda, sua assistente de documentos. Posso ajudar você a pesquisar, analisar e trabalhar com seus documentos. Como posso ajudar?",
      noDocs: "Olá! Sou a Koda, sua assistente de documentos. Faça upload de alguns documentos e eu ajudarei você a pesquisar, analisar e extrair insights deles."
    },
    es: {
      withDocs: "¡Hola! Soy Koda, tu asistente de documentos. Puedo ayudarte a buscar, analizar y trabajar con tus documentos. ¿En qué puedo ayudarte?",
      noDocs: "¡Hola! Soy Koda, tu asistente de documentos. Sube algunos documentos y te ayudaré a buscar, analizar y extraer información de ellos."
    },
    fr: {
      withDocs: "Bonjour! Je suis Koda, votre assistant de documents. Je peux vous aider à rechercher, analyser et travailler avec vos documents. Comment puis-je vous aider?",
      noDocs: "Bonjour! Je suis Koda, votre assistant de documents. Téléchargez des documents et je vous aiderai à les rechercher, analyser et en extraire des informations."
    }
  };

  const lang = responses[language] || responses['en'];
  return hasDocuments ? lang.withDocs : lang.noDocs;
}

// Generate capability response
function generateCapabilityResponse(language: string, documentCount: number): string {
  const responses: Record<string, string> = {
    en: `I'm Koda, your intelligent document assistant! Here's what I can do:

📄 **Document Analysis** - Search, summarize, and extract insights from your documents
📊 **Data Queries** - Find specific data, totals, and statistics in your files
🔍 **Smart Search** - Find information across all your ${documentCount > 0 ? documentCount + ' ' : ''}documents
📁 **File Management** - Create folders, organize, and manage your files
🧮 **Calculations** - Perform calculations on data from your documents
🔄 **Comparisons** - Compare information across multiple documents

Just ask me anything about your documents!`,
    pt: `Sou a Koda, sua assistente inteligente de documentos! Veja o que posso fazer:

📄 **Análise de Documentos** - Pesquisar, resumir e extrair insights dos seus documentos
📊 **Consultas de Dados** - Encontrar dados específicos, totais e estatísticas
🔍 **Busca Inteligente** - Encontrar informações em todos os seus ${documentCount > 0 ? documentCount + ' ' : ''}documentos
📁 **Gestão de Arquivos** - Criar pastas, organizar e gerenciar seus arquivos
🧮 **Cálculos** - Realizar cálculos com dados dos seus documentos
🔄 **Comparações** - Comparar informações entre múltiplos documentos

Basta me perguntar qualquer coisa sobre seus documentos!`,
    es: `¡Soy Koda, tu asistente inteligente de documentos! Esto es lo que puedo hacer:

📄 **Análisis de Documentos** - Buscar, resumir y extraer información de tus documentos
📊 **Consultas de Datos** - Encontrar datos específicos, totales y estadísticas
🔍 **Búsqueda Inteligente** - Encontrar información en todos tus ${documentCount > 0 ? documentCount + ' ' : ''}documentos
📁 **Gestión de Archivos** - Crear carpetas, organizar y administrar tus archivos
🧮 **Cálculos** - Realizar cálculos con datos de tus documentos
🔄 **Comparaciones** - Comparar información entre múltiples documentos

¡Solo pregúntame cualquier cosa sobre tus documentos!`,
    fr: `Je suis Koda, votre assistant intelligent de documents! Voici ce que je peux faire:

📄 **Analyse de Documents** - Rechercher, résumer et extraire des informations
📊 **Requêtes de Données** - Trouver des données spécifiques, totaux et statistiques
🔍 **Recherche Intelligente** - Trouver des informations dans tous vos ${documentCount > 0 ? documentCount + ' ' : ''}documents
📁 **Gestion de Fichiers** - Créer des dossiers, organiser et gérer vos fichiers
🧮 **Calculs** - Effectuer des calculs sur les données de vos documents
🔄 **Comparaisons** - Comparer des informations entre plusieurs documents

Demandez-moi n'importe quoi sur vos documents!`
  };

  return responses[language] || responses['en'];
}

export const fastPathDetector = {
  detect: async (query: string, options: FastPathOptions = {}): Promise<FastPathResult> => {
    const startTime = Date.now();
    const lowerQuery = query.toLowerCase().trim();
    const detectedLanguage = options.language || detectQueryLanguage(query);
    const hasDocuments = options.hasUploadedDocuments || (options.documentCount || 0) > 0;

    // Check for greetings
    if (GREETING_PATTERNS.some(p => p.test(lowerQuery))) {
      console.log(`⚡ [FAST PATH] Greeting detected in ${Date.now() - startTime}ms`);
      return {
        isFastPath: true,
        response: generateGreetingResponse(detectedLanguage, hasDocuments),
        type: 'greeting',
        detectedLanguage
      };
    }

    // Check for capability questions (but NOT about Koda's business/ICP)
    if (!/koda'?s\s+|koda\s+(icp|business|market|customer|target|revenue|pricing|strategy|plan|model)/i.test(query)) {
      if (CAPABILITY_PATTERNS.some(p => p.test(lowerQuery))) {
        console.log(`⚡ [FAST PATH] Capability query detected in ${Date.now() - startTime}ms`);
        return {
          isFastPath: true,
          response: generateCapabilityResponse(detectedLanguage, options.documentCount || 0),
          type: 'capability',
          detectedLanguage
        };
      }
    }

    // Not a fast path query
    return {
      isFastPath: false,
      response: null,
      type: null,
      detectedLanguage
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Post Processor Stub
// ═══════════════════════════════════════════════════════════════════════════
export const postProcessor = {
  process: (response: string) => response,
  cleanResponse: (response: string) => response
};

// ═══════════════════════════════════════════════════════════════════════════
// Response Post Processor Stub (Used in rag.controller.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const responsePostProcessor = {
  process: (response: string, _sources?: any[]) => {
    // Basic cleanup - remove multiple blank lines
    let cleaned = response.replace(/\n{3,}/g, '\n\n');
    // Use ES2015-compatible regex ([\s\S] instead of . with s flag)
    cleaned = cleaned.replace(/⚠️\s*Note:[\s\S]*?(?:\n\n|$)/g, '');
    cleaned = cleaned.replace(/⚠️\s*Warning:[\s\S]*?(?:\n\n|$)/g, '');
    cleaned = cleaned.replace(/\*\*Note:\*\*[\s\S]*?(?:\n\n|$)/g, '');
    return cleaned.trim();
  },
  cleanResponse: (response: string) => response.replace(/\n{3,}/g, '\n\n').trim(),
  removeAllWarnings: (text: string) => {
    // Use [\s\S] instead of . with s flag for ES2015 compatibility
    text = text.replace(/⚠️\s*Note:[\s\S]*?(?:\n\n|$)/g, '');
    text = text.replace(/⚠️\s*Warning:[\s\S]*?(?:\n\n|$)/g, '');
    text = text.replace(/\*\*Note:\*\*[\s\S]*?(?:\n\n|$)/g, '');
    return text;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Memory Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const memoryService = {
  getRelevantMemories: async (_userId: string, _query: string, _conversationId?: string, _limit?: number) => [],
  formatMemoriesForPrompt: (_memories: any[]) => '',
  storeMemory: async (_userId: string, _memory: any) => {}
};

// ═══════════════════════════════════════════════════════════════════════════
// Citation Tracking - Extracts and tracks document citations from LLM responses
// ═══════════════════════════════════════════════════════════════════════════

export interface ParsedCitation {
  documentId: string;
  pages: number[];
}

export interface CitationExtractionResult {
  cleanResponse: string;
  citations: ParsedCitation[];
  rawCitationBlock: string | null;
}

/**
 * Parses the hidden citation block from LLM responses
 * Expected format:
 * ---CITATIONS---
 * documentId: abc123, pages: [1, 3, 5]
 * documentId: def456, pages: [2]
 * ---END_CITATIONS---
 */
function parseCitationBlock(citationBlock: string): ParsedCitation[] {
  const citations: ParsedCitation[] = [];

  // Split by newlines and process each line
  const lines = citationBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip delimiter lines
    if (line.includes('---CITATIONS---') || line.includes('---END_CITATIONS---') || line === 'NONE') {
      continue;
    }

    // Parse line format: "documentId: abc123, pages: [1, 3, 5]"
    // Or simpler format: "documentId: abc123"
    const docIdMatch = line.match(/documentId:\s*([^\s,]+)/i);
    if (docIdMatch) {
      const documentId = docIdMatch[1].trim();

      // Extract pages if present
      const pagesMatch = line.match(/pages:\s*\[([^\]]*)\]/i);
      let pages: number[] = [];

      if (pagesMatch && pagesMatch[1]) {
        pages = pagesMatch[1]
          .split(',')
          .map(p => parseInt(p.trim(), 10))
          .filter(p => !isNaN(p));
      }

      citations.push({ documentId, pages });
    }
  }

  return citations;
}

export const citationTracking = {
  /**
   * Removes the hidden citation block from the response and returns both
   * the clean response and the extracted citations
   */
  removeCitationBlock: (response: string): string => {
    if (!response) return response;

    // Match the citation block pattern (case insensitive, multiline)
    const citationPattern = /---CITATIONS---[\s\S]*?---END_CITATIONS---/gi;
    const match = response.match(citationPattern);

    if (match) {
      console.log(`📎 [CITATION TRACKING] Found citation block in response`);
      // Remove the citation block from response
      return response.replace(citationPattern, '').trim();
    }

    return response;
  },

  /**
   * Extracts citations from the response and returns structured data
   */
  extractCitations: (response: string): CitationExtractionResult => {
    if (!response) {
      return { cleanResponse: response, citations: [], rawCitationBlock: null };
    }

    const citationPattern = /---CITATIONS---[\s\S]*?---END_CITATIONS---/gi;
    const match = response.match(citationPattern);

    if (match && match[0]) {
      const rawCitationBlock = match[0];
      const citations = parseCitationBlock(rawCitationBlock);
      const cleanResponse = response.replace(citationPattern, '').trim();

      console.log(`📎 [CITATION TRACKING] Extracted ${citations.length} citations from response`);
      citations.forEach((c, idx) => {
        console.log(`   ${idx + 1}. Document: ${c.documentId}, Pages: ${c.pages.length > 0 ? c.pages.join(', ') : 'N/A'}`);
      });

      return { cleanResponse, citations, rawCitationBlock };
    }

    return { cleanResponse: response, citations: [], rawCitationBlock: null };
  },

  /**
   * Builds accurate sources from extracted citations and available chunks
   */
  buildSourcesFromCitations: (
    citations: ParsedCitation[],
    chunks: any[]
  ): any[] => {
    const sources: any[] = [];
    const documentMap = new Map<string, any>();

    // Build a map of documentId -> chunk info from available chunks
    for (const chunk of chunks) {
      const docId = chunk.metadata?.documentId || chunk.documentId;
      if (docId && !documentMap.has(docId)) {
        documentMap.set(docId, {
          documentId: docId,
          documentName: chunk.metadata?.filename || chunk.filename || 'Unknown',
          mimeType: chunk.metadata?.mimeType || chunk.mimeType,
          score: chunk.score || chunk.rerankScore || chunk.hybridScore || 1.0
        });
      }
    }

    // Match citations to chunks
    for (const citation of citations) {
      const docInfo = documentMap.get(citation.documentId);

      if (docInfo) {
        sources.push({
          documentId: citation.documentId,
          documentName: docInfo.documentName,
          pageNumber: citation.pages.length > 0 ? citation.pages[0] : null,
          allPages: citation.pages,
          mimeType: docInfo.mimeType,
          score: docInfo.score
        });
        console.log(`✅ [CITATION TRACKING] Matched citation to document: ${docInfo.documentName}`);
      } else {
        // Citation references a document not in our chunks - still include it
        console.log(`⚠️ [CITATION TRACKING] Citation references unknown document: ${citation.documentId}`);
        sources.push({
          documentId: citation.documentId,
          documentName: 'Unknown Document',
          pageNumber: citation.pages.length > 0 ? citation.pages[0] : null,
          allPages: citation.pages,
          score: 0.5
        });
      }
    }

    // Sort by score descending
    return sources.sort((a, b) => (b.score || 0) - (a.score || 0));
  },

  /**
   * Legacy function - adds citations to response (deprecated, returns unchanged)
   */
  addCitations: (response: string, _sources: any[]) => response
};

// ═══════════════════════════════════════════════════════════════════════════
// Output Integration Stub
// ═══════════════════════════════════════════════════════════════════════════
export const outputIntegration = {
  generateNoDocumentsError: async (lang: string) =>
    lang === 'pt' ? 'Nenhum documento encontrado.' :
    lang === 'es' ? 'No se encontraron documentos.' :
    'No documents found.',
  generateFileListing: async (lang: string, files: any[]) =>
    files.map(f => f.name || f.title).join('\n'),
  generateProcessingError: async (lang: string, _type: string) =>
    lang === 'pt' ? 'Erro ao processar sua solicitação.' :
    lang === 'es' ? 'Error al procesar su solicitud.' :
    'Error processing your request.'
};

// ═══════════════════════════════════════════════════════════════════════════
// Adaptive Answer Generation Stub
// ═══════════════════════════════════════════════════════════════════════════
export interface DocumentInfo {
  id: string;
  title: string;
  content: string;
}

export const adaptiveAnswerGeneration = {
  generateAnswer: async (_params: any) => ({
    answer: '',
    confidence: 0,
    sources: []
  }),
  generateAdaptiveAnswer: async (_params: any) => ({
    answer: '',
    confidence: 0,
    sources: []
  }),
  validateAnswerQuality: (_answer: string) => ({
    isValid: true,
    score: 1,
    issues: []
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Context Engineering Stub
// ═══════════════════════════════════════════════════════════════════════════
export const contextEngineering = {
  buildContext: (_params: any) => '',
  optimizeContext: (context: string) => context
};

// ═══════════════════════════════════════════════════════════════════════════
// Synthesis Query Detection Stub
// ═══════════════════════════════════════════════════════════════════════════
export const synthesisQueryDetectionService = {
  detect: (_query: string) => ({
    isSynthesis: false,
    isSynthesisQuery: false,
    type: null as string | null,
    confidence: 0
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Comparative Analysis Stub
// ═══════════════════════════════════════════════════════════════════════════
export const comparativeAnalysisService = {
  getComparisonContext: (_query: string, _docs: any[]) => ({
    isComparison: false,
    items: [],
    context: ''
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Methodology Extraction Stub
// ═══════════════════════════════════════════════════════════════════════════
export const methodologyExtractionService = {
  detectMethodologyQuery: (_query: string) => null,
  getMethodologyKnowledge: async (_userId: string, _methodology: string) => null,
  formatKnowledgeForResponse: (_knowledge: any) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Trend Analysis Stub
// ═══════════════════════════════════════════════════════════════════════════
export const trendAnalysisService = {
  isTrendQuery: (_query: string) => false,
  analyzeUserTrends: async (_userId: string) => null,
  formatTrendAnalysisForResponse: (_result: any) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Terminology Intelligence Stub
// ═══════════════════════════════════════════════════════════════════════════
export const terminologyIntelligenceService = {
  isTerminologyQuestion: (_query: string) => ({ isTerm: false, term: null }),
  answerTerminologyQuestion: async (_userId: string, _term: string, _query: string) => null,
  formatAsString: (_response: any) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Cross Document Synthesis Stub
// ═══════════════════════════════════════════════════════════════════════════
export const crossDocumentSynthesisService = {
  synthesizeMethodologies: async (_userId: string, _query: string, _docs: any[]) => ({
    synthesis: '',
    sources: []
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Empty Response Prevention Stub
// ═══════════════════════════════════════════════════════════════════════════
export const emptyResponsePrevention = {
  validateChunks: (_chunks: any[], _query: string) => ({
    isValid: true,
    score: 1
  }),
  validateResponse: (_response: string, _context: any, _options: any) => ({
    isValid: true,
    issues: []
  }),
  getFallbackResponse: (_context: any, lang: string) =>
    lang === 'pt' ? 'Não foi possível gerar uma resposta.' :
    lang === 'es' ? 'No se pudo generar una respuesta.' :
    'Unable to generate a response.'
};

// ═══════════════════════════════════════════════════════════════════════════
// Show vs Explain Classifier Stub
// ═══════════════════════════════════════════════════════════════════════════
export const showVsExplainClassifier = {
  classifyIntent: (_query: string) => ({
    intent: 'explain',
    confidence: 0.5
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Response System Types (for type imports)
// ═══════════════════════════════════════════════════════════════════════════
export interface UserContext {
  userId: string;
  conversationId?: string;
  language?: string;
  documentCount?: number;
  [key: string]: any;
}

export interface ResponseConfig {
  format?: string;
  length?: string;
  style?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Query Enhancement Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const queryEnhancementService = {
  enhanceQuerySimple: (query: string): string => query, // Pass-through, no enhancement
  enhanceQuery: async (query: string): Promise<string> => query
};

// ═══════════════════════════════════════════════════════════════════════════
// Terminology Integration Stub
// ═══════════════════════════════════════════════════════════════════════════
export const terminologyIntegration = {
  enhanceQueryForRAG: async (_query: string, _options?: any): Promise<any> => ({
    searchTerms: [],
    detectedDomains: [],
    synonymsUsed: {}
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Causal Extraction Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const causalExtractionService = {
  getWhyQueryContext: (_query: string, _chunks: any[]): any => ({
    isWhyQuery: false,
    causalContext: null,
    relevantChunks: []
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Query Decomposition Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const queryDecomposition = {
  needsDecomposition: (_query: string): boolean => false,
  decomposeQuery: async (_query: string): Promise<string[]> => []
};

// ═══════════════════════════════════════════════════════════════════════════
// Contradiction Detection Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const contradictionDetection = {
  extractClaims: async (_documents: any[]): Promise<any[]> => [],
  detectContradictions: async (_claims: any[]): Promise<any[]> => [],
  formatContradictionsForUser: (_contradictions: any): string => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Practical Implications Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const practicalImplicationsService = {
  extractImplications: async (_query: string, _chunks: any[]): Promise<any> => ({
    hasImplications: false,
    implications: [],
    recommendations: []
  }),
  formatImplications: (_implications: any): string => ''
};

// Default export for services that use default import
export default {
  semanticDocumentSearchService,
  hybridRetrievalBooster,
  fastPathDetector,
  postProcessor,
  memoryService,
  citationTracking,
  outputIntegration,
  adaptiveAnswerGeneration,
  contextEngineering,
  synthesisQueryDetectionService,
  comparativeAnalysisService,
  methodologyExtractionService,
  trendAnalysisService,
  terminologyIntelligenceService,
  crossDocumentSynthesisService,
  emptyResponsePrevention,
  showVsExplainClassifier,
  responsePostProcessor
};
