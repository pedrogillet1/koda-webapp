/**
 * STUB FILE: Provides no-op implementations for deleted services
 * These services were removed during the cleanup but are still referenced in code.
 * This file prevents TypeScript errors while maintaining runtime compatibility.
 *
 * TODO: Gradually remove usages of these stubs from the codebase
 */

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT GEMINI BYPASS - For fast answers without RAG
// ═══════════════════════════════════════════════════════════════════════════
import geminiClient from './geminiClient.service';

// ═══════════════════════════════════════════════════════════════════════════
// Semantic Document Search Service - NOW USING REAL IMPLEMENTATION
// See: semanticDocumentSearch.service.ts
// ═══════════════════════════════════════════════════════════════════════════
import { semanticDocumentSearchService as _semanticDocumentSearchService } from './semanticDocumentSearch.service';
export const semanticDocumentSearchService = _semanticDocumentSearchService;

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
// ENHANCED: Now supports Direct Gemini Bypass for general knowledge queries

interface FastPathOptions {
  documentCount?: number;
  hasUploadedDocuments?: boolean;
  language?: string;
  userId?: string;
  conversationContext?: string;  // For multi-turn bypass conversations
}

interface FastPathMetadata {
  type: 'direct' | 'cached' | 'preset';
  latency: number;
  usedRAG: boolean;
  model?: string;
}

interface FastPathResult {
  isFastPath: boolean;
  response: string | null;
  type: 'greeting' | 'capability' | 'help' | 'general_knowledge' | 'direct_answer' | null;
  detectedLanguage: string;
  metadata?: FastPathMetadata;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT GEMINI BYPASS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
async function directGeminiAnswer(
  query: string,
  conversationContext?: string,
  language: string = 'en'
): Promise<{ answer: string; latency: number } | null> {
  const startTime = Date.now();

  try {
    // Build prompt with conversation context if available
    const prompt = conversationContext
      ? `Previous conversation:\n${conversationContext}\n\nUser question: ${query}\n\nProvide a direct, concise answer.`
      : query;

    // Get Gemini 2.5 Flash model
    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    });

    // Generate response
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const latency = Date.now() - startTime;
    console.log(`✅ [BYPASS] Direct Gemini answer in ${latency}ms (no RAG)`);

    return {
      answer: text || 'I apologize, but I could not generate an answer.',
      latency
    };

  } catch (error: any) {
    console.error('❌ [BYPASS] Direct Gemini answer failed:', error?.message || error);
    return null;
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// GENERAL KNOWLEDGE PATTERNS - Questions that don't need documents
// ═══════════════════════════════════════════════════════════════════════════
const GENERAL_KNOWLEDGE_PATTERNS = [
  // General knowledge (not document-specific)
  /^what is (the )?(capital|population|definition|meaning) of/i,
  /^who (is|was|are|were) /i,
  /^when (did|was|is) /i,
  /^where (is|was|are) /i,
  // But exclude document-related "where is"
  /^how (do|does|did|can|could|would|should) /i,
  /^why (is|are|do|does|did|was|were) /i,
  /^what (is|are) (a|an|the) /i,
  // Factual questions
  /^(explain|define|describe) (what|the|a|an) /i,
  /^tell me about /i,
];

// Date/time patterns
const DATE_TIME_PATTERNS = [
  /^what (is|are) (today|the date|the time|current date|current time)/i,
  /^what day is (it|today)/i,
  /^what('s| is) the (date|time|day)/i,
  /^(today's|current) (date|time|day)/i,
];

// System/self question patterns
const SYSTEM_QUESTION_PATTERNS = [
  /^what (is|are) you$/i,
  /^who (are|is) you$/i,
  /^what can you do$/i,
  /^are you (a |an )?(ai|bot|robot|human|person)/i,
  /^who made you/i,
  /^who created you/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// RAG INDICATOR PATTERNS - Questions that REQUIRE document retrieval
// ═══════════════════════════════════════════════════════════════════════════
const RAG_INDICATOR_PATTERNS = [
  // Explicit document references
  /what (is|are|does|do).*(in|from|according to).*(document|file|pdf|contract|policy|report)/i,
  /summarize.*(document|file|pdf|uploaded|my)/i,
  /what (is|are) (my|the).*(revenue|number|password|address|date|amount|value|total)/i,
  /show me.*(from|in).*(document|file)/i,
  /compare.*(document|file)/i,
  /what does.*(say|state|mention|contain)/i,
  /find.*(in|from).*(document|file|my)/i,
  // Document content queries
  /(according to|based on|from) (my|the|this) (document|file|pdf)/i,
  /in (my|the|this) (document|file|pdf)/i,
  /(my|the|this) (document|file|pdf|contract|report) (says?|mentions?|states?|contains?)/i,
  // Implicit document queries (user has documents and asks about specific data)
  /what('s| is| are) (my|the|our) .*(policy|procedure|guideline|rule|requirement)/i,
  /how (do|does|should) (I|we) .*(according|per|as per)/i,
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

    // Check for greetings (preset responses - fastest)
    if (GREETING_PATTERNS.some(p => p.test(lowerQuery))) {
      const latency = Date.now() - startTime;
      console.log(`⚡ [FAST PATH] Greeting detected in ${latency}ms`);
      return {
        isFastPath: true,
        response: generateGreetingResponse(detectedLanguage, hasDocuments),
        type: 'greeting',
        detectedLanguage,
        metadata: {
          type: 'preset',
          latency,
          usedRAG: false
        }
      };
    }

    // Check for capability questions (but NOT about Koda's business/ICP)
    if (!/koda'?s\s+|koda\s+(icp|business|market|customer|target|revenue|pricing|strategy|plan|model)/i.test(query)) {
      if (CAPABILITY_PATTERNS.some(p => p.test(lowerQuery))) {
        const latency = Date.now() - startTime;
        console.log(`⚡ [FAST PATH] Capability query detected in ${latency}ms`);
        return {
          isFastPath: true,
          response: generateCapabilityResponse(detectedLanguage, options.documentCount || 0),
          type: 'capability',
          detectedLanguage,
          metadata: {
            type: 'preset',
            latency,
            usedRAG: false
          }
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GENERAL KNOWLEDGE BYPASS - Use Direct Gemini for non-document queries
    // ═══════════════════════════════════════════════════════════════════════
    // Check if query is general knowledge that doesn't require document retrieval
    const bypassType = getBypassType(query);

    if (bypassType === 'general_knowledge' || bypassType === 'date_time' || bypassType === 'system') {
      console.log(`⚡ [FAST PATH] ${bypassType} query detected - using Direct Gemini Bypass`);

      // Use Direct Gemini 2.5 Flash for fast answer
      const directResult = await directGeminiAnswer(
        query,
        options.conversationContext,
        detectedLanguage
      );

      if (directResult) {
        return {
          isFastPath: true,
          response: directResult.answer,
          type: 'direct_answer',
          detectedLanguage,
          metadata: {
            type: 'direct',
            latency: directResult.latency,
            usedRAG: false,
            model: 'gemini-2.5-flash'
          }
        };
      }

      // If Direct Gemini fails, fall through to normal RAG
      console.log(`⚠️ [FAST PATH] Direct Gemini failed, falling back to RAG`);
    }

    // Not a fast path query - proceed with RAG
    return {
      isFastPath: false,
      response: null,
      type: null,
      detectedLanguage
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// RAG BYPASS DETECTION - Determines if query needs document retrieval
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a query requires RAG (document retrieval)
 * Returns true if the query explicitly references documents or user-specific data
 */
export function requiresRAG(query: string): boolean {
  const trimmed = query.trim();
  return RAG_INDICATOR_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a query should bypass RAG entirely
 * Returns true for general knowledge questions, greetings, date/time, system questions
 * that don't need document context
 */
export function shouldBypassRAG(query: string): boolean {
  const trimmed = query.trim();

  // First check: If query explicitly requires RAG, don't bypass
  if (requiresRAG(trimmed)) {
    return false;
  }

  // Check all bypass patterns
  const bypassPatterns = [
    ...GENERAL_KNOWLEDGE_PATTERNS,
    ...DATE_TIME_PATTERNS,
    ...GREETING_PATTERNS,
    ...SYSTEM_QUESTION_PATTERNS,
  ];

  return bypassPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Get the type of bypass query for appropriate response handling
 */
export function getBypassType(query: string): 'general_knowledge' | 'date_time' | 'greeting' | 'system' | 'capability' | null {
  const trimmed = query.trim();

  if (requiresRAG(trimmed)) {
    return null;
  }

  if (GREETING_PATTERNS.some(p => p.test(trimmed))) {
    return 'greeting';
  }

  if (DATE_TIME_PATTERNS.some(p => p.test(trimmed))) {
    return 'date_time';
  }

  if (SYSTEM_QUESTION_PATTERNS.some(p => p.test(trimmed))) {
    return 'system';
  }

  if (CAPABILITY_PATTERNS.some(p => p.test(trimmed))) {
    return 'capability';
  }

  if (GENERAL_KNOWLEDGE_PATTERNS.some(p => p.test(trimmed))) {
    return 'general_knowledge';
  }

  return null;
}

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
// Output Integration - FIXED: Proper file listing implementation
// ═══════════════════════════════════════════════════════════════════════════
export const outputIntegration = {
  generateNoDocumentsError: async (lang: string) => {
    const messages: Record<string, string> = {
      pt: 'Você ainda não tem documentos. Faça upload de arquivos para começar a usar a Koda!',
      es: 'Aún no tienes documentos. ¡Sube archivos para empezar a usar Koda!',
      en: "You don't have any documents yet. Upload files to start using Koda!"
    };
    return messages[lang] || messages.en;
  },

  generateFileListing: async (lang: string, files: any[], totalCount?: number, limit: number = 15) => {
    if (!files || files.length === 0) {
      return outputIntegration.generateNoDocumentsError(lang);
    }

    const total = totalCount || files.length;
    const displayFiles = files.slice(0, limit);

    // Header based on language
    const headers: Record<string, string> = {
      pt: `📁 **Seus Documentos** (${total} arquivo${total !== 1 ? 's' : ''}):\n`,
      es: `📁 **Tus Documentos** (${total} archivo${total !== 1 ? 's' : ''}):\n`,
      en: `📁 **Your Documents** (${total} file${total !== 1 ? 's' : ''}):\n`
    };

    let result = headers[lang] || headers.en;
    result += '\n';

    // List files with proper property checking
    displayFiles.forEach((file, index) => {
      // Support multiple property names: filename, name, title, originalName
      const name = file.filename || file.name || file.title || file.originalName || 'Unknown File';
      result += `${index + 1}. ${name}\n`;
    });

    // Show "and X more" if there are more files
    if (total > limit) {
      const remaining = total - limit;
      const moreText: Record<string, string> = {
        pt: `\n_...e mais ${remaining} arquivo${remaining !== 1 ? 's' : ''}_`,
        es: `\n_...y ${remaining} archivo${remaining !== 1 ? 's' : ''} más_`,
        en: `\n_...and ${remaining} more file${remaining !== 1 ? 's' : ''}_`
      };
      result += moreText[lang] || moreText.en;
    }

    return result;
  },

  generateProcessingError: async (lang: string, _type: string) => {
    const messages: Record<string, string> = {
      pt: 'Erro ao processar sua solicitação. Por favor, tente novamente.',
      es: 'Error al procesar su solicitud. Por favor, inténtelo de nuevo.',
      en: 'Error processing your request. Please try again.'
    };
    return messages[lang] || messages.en;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Adaptive Answer Generation - NOW USING REAL IMPLEMENTATION
// See: adaptiveAnswerGeneration.service.ts
// ═══════════════════════════════════════════════════════════════════════════
// NOTE: DocumentInfo interface kept for backwards compatibility (used as AdaptiveDocumentInfo)
export interface DocumentInfo {
  id?: string;
  title: string;
  content?: string;
  pageCount?: number;
  wordCount?: number;
  type?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Context Engineering - NOW USING REAL IMPLEMENTATION
// See: contextEngineering.service.ts
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Synthesis Query Detection Stub
// ═══════════════════════════════════════════════════════════════════════════
export const synthesisQueryDetectionService = {
  detect: (_query: string) => ({
    isSynthesis: false,
    isSynthesisQuery: false,
    type: '' as string,
    topic: '' as string,
    confidence: 0
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Comparative Analysis Stub
// ═══════════════════════════════════════════════════════════════════════════
export const comparativeAnalysisService = {
  getComparisonContext: (_query: string, _concepts: string[], _chunks: any[]) => ({
    isComparison: false,
    items: [] as any[],
    context: '',
    comparativeStatements: [] as any[],
    conceptAttributesMap: new Map<string, any>(),
    promptAddition: ''
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Methodology Extraction Stub
// ═══════════════════════════════════════════════════════════════════════════
export const methodologyExtractionService = {
  detectMethodologyQuery: (_query: string) => null as string | null,
  getMethodologyKnowledge: async (_userId: string, _methodology: string): Promise<{
    definition?: string;
    documentCount: number;
    sourceDocumentIds?: string[];
  } | null> => null,
  formatKnowledgeForResponse: (_knowledge: any) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Trend Analysis Stub
// ═══════════════════════════════════════════════════════════════════════════
export const trendAnalysisService = {
  isTrendQuery: (_query: string) => false,
  analyzeUserTrends: async (_userId: string): Promise<{
    summary: string;
    trends: any[];
    totalDocuments: number;
  } | null> => null,
  formatTrendAnalysisForResponse: (_result: any) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Terminology Intelligence Stub
// ═══════════════════════════════════════════════════════════════════════════
export const terminologyIntelligenceService = {
  isTerminologyQuestion: (_query: string) => ({ isTerm: false, term: null as string | null }),
  answerTerminologyQuestion: async (_userId: string, _term: string, _chunks: any[], _options?: any) => ({
    confidence: 0,
    definition: '',
    formula: null as string | null,
    interpretation: null as string | null,
    documentValues: [] as any[],
    sources: [] as any[]
  }),
  formatAsString: (_response: any) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Cross Document Synthesis Stub
// ═══════════════════════════════════════════════════════════════════════════
export const crossDocumentSynthesisService = {
  synthesizeMethodologies: async (_userId: string, _topic?: string) => ({
    synthesis: '',
    sources: [] as any[],
    methodologies: [] as Array<{ name: string; documentIds: string[]; description?: string }>,
    totalDocuments: 0
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Empty Response Prevention Stub
// ═══════════════════════════════════════════════════════════════════════════
export const emptyResponsePrevention = {
  validateChunks: (_chunks: any[], _query: string) => ({
    isValid: true,
    score: 1,
    reason: '' as string | undefined
  }),
  validateResponse: (_response: string, _context: any, _options: any): {
    isValid: boolean;
    issues: string[];
    reason?: string;
    suggestions?: string[];
  } => ({
    isValid: true,
    issues: [],
    reason: undefined,
    suggestions: []
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
  formatImplications: (_implications: any): string => '',
  getImplicationsContext: (_query: string, _chunks?: any[]): {
    isImplicationsQuery: boolean;
    categorizedImplications: any[];
    promptAddition: string;
  } => ({
    isImplicationsQuery: false,
    categorizedImplications: [],
    promptAddition: ''
  })
};

// Default export for services that use default import
// NOTE: adaptiveAnswerGeneration and contextEngineering removed - now using real implementations
export default {
  semanticDocumentSearchService,
  hybridRetrievalBooster,
  fastPathDetector,
  postProcessor,
  memoryService,
  citationTracking,
  outputIntegration,
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

// ═══════════════════════════════════════════════════════════════════════════
// Conversation Context Service Stub (added for rag.service.ts import)
// ═══════════════════════════════════════════════════════════════════════════
export const conversationContextService = {
  getContext: async (_conversationId: string, _userId?: string) => ({
    recentMessages: [] as any[],
    summary: '',
    topics: [] as string[],
    entities: [] as any[],
    keyFindings: [] as any[]  // Added for rag.service.ts line 6435
  }),
  updateContext: async (_conversationId: string, _context: any) => {},
  clearContext: async (_conversationId: string) => {},
  updateContextAfterTurn: async (_conversationId: string, _userMessage: string, _assistantMessage: string, _sources?: any[]) => {},
  resolveReferences: (query: string, _context: any) => query,  // Returns original query unchanged
  buildContextSummary: (_context: any) => ''  // Returns empty summary
};

// ═══════════════════════════════════════════════════════════════════════════
// Navigation Service Stub (used in rag.controller.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const navigationService = {
  handleNavigation: async (_userId: string, _action: string, _params?: any) => ({
    success: false,
    message: 'Navigation service disabled'
  }),
  parseNavigationIntent: (_query: string) => null,
  findFile: async (_userId: string, _filename: string) => ({
    found: false,
    message: 'Navigation service disabled',
    actions: [] as Array<{ type: string; documentId?: string; folderId?: string }>,
    folderPath: null as string | null
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// P0 Features Service Stub (used in rag.controller.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const p0FeaturesService = {
  isEnabled: (_feature: string) => false,
  getFeatureConfig: (_feature: string) => null,
  trackUsage: async (_userId: string, _feature: string) => {},
  preProcessQuery: async (_query: string, _userId?: string, _conversationId?: string) => ({
    processedQuery: _query,
    wasRewritten: false,
    isRefinement: false,
    scopeDocumentIds: [] as string[],
    requiresCalculation: false,
    calculationType: null as string | null
  }),
  postProcessResponse: async (
    _query: string,
    _response: string,
    _sources: any[],
    _userId?: string,
    _conversationId?: string,
    _preProcessResult?: any
  ) => ({
    processed: false,
    updates: null as any,
    answer: _response, // Return original response instead of null
    calculationResult: null as { explanation?: string } | null,
    scopeUpdated: false,
    newScopeDescription: null as string | null
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Chat Document Generation Service Stub (used in rag.controller.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const chatDocumentGenerationService = {
  shouldGenerateDocument: (_query: string, _context?: any) => false,
  generateDocument: async (_params: {
    userId: string;
    content: string;
    title?: string;
    conversationId?: string;
  }) => ({
    success: false,
    documentId: null as string | null,
    error: 'Document generation service disabled'
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// SMS Service Stubs (for auth.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const smsServiceStubs = {
  formatPhoneNumber: (phone: string) => phone,
  isValidPhoneNumber: (_phone: string) => true,
  sendVerificationSMS: async (_phone: string, _code: string) => ({ success: true }),
  sendPasswordResetSMS: async (_phone: string, _code: string) => ({ success: true })
};

// ═══════════════════════════════════════════════════════════════════════════
// Pending User Service Stubs (for auth.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const pendingUserServiceStubs = {
  verifyPendingEmail: async (_email: string, _code: string) => ({ success: false, error: 'Service disabled' }),
  resendEmailCode: async (_email: string) => ({ success: false, error: 'Service disabled' }),
  addPhoneToPending: async (_email: string, _phone: string) => ({ success: false, error: 'Service disabled' }),
  verifyPendingPhone: async (_email: string, _code: string) => ({ success: false, error: 'Service disabled' })
};

// ═══════════════════════════════════════════════════════════════════════════
// Fuzzy Match Service Stub (for fileActions.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const fuzzyMatchService = {
  fuzzyMatch: async () => [] as never[],
  findBestMatch: async (_query: string, _userId: string, _options?: any) => null as any
};

// ═══════════════════════════════════════════════════════════════════════════
// File Matching Service Stub (for fileActions.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const fileMatchingService = {
  matchFiles: async () => [] as never[],
  findSingleFile: async (_query: string, _userId: string) => null as any
};

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Response Generator - NOW USING REAL IMPLEMENTATION
// See: dynamicResponseGenerator.service.ts
// ═══════════════════════════════════════════════════════════════════════════
import { generateDynamicResponse as _generateDynamicResponse, generateResponse as _generateResponse } from './dynamicResponseGenerator.service';
export const generateDynamicResponse = _generateDynamicResponse;
export const generateResponse = _generateResponse;

// ═══════════════════════════════════════════════════════════════════════════
// PPTX Slide Generator Stub (for document.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const pptxSlideGeneratorStub = {
  checkLibreOffice: async () => ({ installed: false, error: 'Service disabled' }),
  generateSlide: async () => ({ content: '', error: 'Service disabled' }),
  generateSlideImages: async (_slides: any[]) => [] as any[]
};

// ═══════════════════════════════════════════════════════════════════════════
// Vision Service Stub (for document.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const visionServiceStub = {
  processImage: async (_buffer: Buffer): Promise<{ text: string; confidence: number }> => ({
    text: '',
    confidence: 0
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Clarification Service Stub (for fileActions.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const clarificationService = {
  needsClarification: false,
  options: [] as string[],
  question: '',
  groupingStrategy: 'none' as string,
  askForClarification: async (): Promise<string> => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Evidence Aggregation Service Stub (for rag.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const evidenceAggregation = {
  shouldAggregateEvidence: (_complexity: string, _docCount: number) => false,
  generateEvidenceMap: async (_response: string, _docs: any[]) => ({
    claims: [] as any[],
    sources: [] as any[]
  }),
  formatEvidenceForUser: (_evidenceMap: any) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Memory Extraction Service Stub (for rag.service.ts)
// ═══════════════════════════════════════════════════════════════════════════
export const memoryExtraction = {
  extractMemoriesFromRecentMessages: async (
    _userId: string,
    _messages: any[],
    _conversationId: string,
    _limit: number
  ) => {}
};
