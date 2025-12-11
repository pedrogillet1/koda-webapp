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

// Greeting patterns (multilingual) - FIXED: Allow optional bot name after greeting
const GREETING_PATTERNS = [
  // English - allow optional name (koda/there/friend/etc) after greeting
  /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening|day)|howdy|yo|sup|what'?s\s*up)(?:[\s,]+(?:koda|there|friend|everyone|all))?[\s!.?]*$/i,
  /^(thanks|thank\s*you|thx|bye|goodbye|see\s*you|cya|later)(?:[\s,]+(?:koda|there|friend|everyone|all))?[\s!.?]*$/i,
  /^how\s*are\s*you(?:[\s,]+koda)?[\s!.?]*$/i,
  // Portuguese - allow optional name after greeting
  /^(oi|olá|ola|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*aí|eai|tudo\s*bem|obrigad[oa]|valeu)(?:[\s,]+(?:koda|aí))?[\s!.?]*$/i,
  // Spanish - allow optional name after greeting
  /^(hola|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|qué\s*tal|gracias)(?:[\s,]+koda)?[\s!.?]*$/i,
  // French - allow optional name after greeting
  /^(bonjour|bonsoir|salut|coucou|ça\s*va|merci)(?:[\s,]+koda)?[\s!.?]*$/i,
];

// Capability patterns (what can you do?) - EXPANDED for natural conversation
const CAPABILITY_PATTERNS = [
  // English - flexible patterns (not exact match)
  /what\s*(?:is|can)\s*koda/i,
  /what'?s\s*koda/i,
  /what\s*can\s*(?:you|koda)\s*do/i,
  /how\s*do(?:es)?\s*(?:you|koda)\s*work/i,
  /^(?:help|ajuda|ayuda|aide)[\s!.?]*$/i,
  /what\s*are\s*your\s*(?:capabilities|features|abilities|functions)/i,
  // Language capability questions - NEW
  /\b(?:do you|can you|are you able to)\s+(?:understand|speak|support|know|read|write)\s+(?:portuguese|spanish|english|french|german|italian)/i,
  /\b(?:understand|speak|support|know)\s+(?:portuguese|spanish|english|french|german|italian)/i,
  /what\s+languages?\s+(?:do you|can you|does koda)/i,
  /(?:which|what)\s+languages?\s+(?:are|is)\s+supported/i,
  // General capability - flexible
  /what\s+(?:can|could)\s+(?:you|koda)\s+(?:do|help|assist)/i,
  /(?:can|could)\s+(?:you|koda)\s+(?:help|assist|analyze|summarize|explain)/i,
  /(?:tell|show)\s+me\s+(?:about|what)\s+(?:your|koda'?s?)\s+(?:capabilities?|features?)/i,
  /(?:are you|is koda)\s+(?:able|capable)\s+(?:of|to)/i,
  // Portuguese - flexible
  /o\s*que\s*[eé]\s*(?:o\s*)?koda/i,
  /o\s*que\s*voc[eê]\s*(?:pode|consegue|sabe)\s*fazer/i,
  /(?:quais?|que)\s+(?:são|sao)\s+(?:suas?|os|as)\s+(?:capacidades?|funcionalidades?|recursos?)/i,
  /como\s+(?:você|voce|vc|koda)\s+(?:funciona|trabalha|ajuda)/i,
  /\b(?:você|voce|vc)\s+(?:fala|entende|sabe)\s+(?:português|portugues|espanhol|inglês)/i,
  /(?:quais?|que)\s+(?:idiomas?|línguas?)\s+(?:você|voce|vc|koda)/i,
  // Spanish - flexible
  /qu[eé]\s*(?:es|puede\s*hacer)\s*koda/i,
  /(?:qué|que)\s+(?:puedes?|puede|sabes?)\s+hacer/i,
  /(?:cuáles?|cuales)\s+son\s+(?:tus|sus)\s+(?:capacidades?|funcionalidades?)/i,
  /cómo\s+(?:funcionas?|trabajas?|ayudas?)/i,
  /\b(?:hablas?|entiendes?|sabes?)\s+(?:portugués|español|inglés)/i,
  /(?:qué|cuáles?)\s+(?:idiomas?|lenguas?)\s+(?:hablas?|soportas?)/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// GENERAL KNOWLEDGE PATTERNS - Questions that don't need documents
// ═══════════════════════════════════════════════════════════════════════════
const GENERAL_KNOWLEDGE_PATTERNS = [
  // General knowledge (not document-specific)
  // NOTE: Be VERY conservative here - prefer RAG over bypass
  // Only bypass for truly generic factual questions
  /^what is (the )?(capital|population) of [A-Z]/i,  // Capital of France, Population of China
  /^who (is|was) the (president|king|queen|prime minister) of/i,  // Specific factual
  // REMOVED: /^tell me about /i - too broad, could refer to user docs
  // REMOVED: /^what (is|are) (a|an|the) /i - could be asking about docs
  // REMOVED: /^explain|define|describe /i - could be asking about docs
  // REMOVED: /^how do|does /i - could be asking about procedures in docs
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

// Detect language from query - IMPROVED for greetings
function detectQueryLanguage(query: string): string {
  const lowerQuery = query.toLowerCase().trim();

  // Remove punctuation for better matching
  const cleanQuery = lowerQuery.replace(/[!?.]+$/, '');

  // Portuguese indicators - EXPANDED for greetings (exact match for short greetings)
  const portuguesePatterns = [
    // Greetings (exact match)
    /^(oi|olá|ola)$/,
    /^(bom\s*dia|boa\s*tarde|boa\s*noite)$/,
    /^(e\s*aí|eai|tudo\s*bem)$/,
    // Common words
    /\b(você|voce|fazer|qual|quais|como|onde|porque|por\s*que|obrigad|valeu)\b/,
  ];

  if (portuguesePatterns.some(p => p.test(cleanQuery))) {
    return 'pt';
  }

  // Spanish indicators - EXPANDED for greetings
  const spanishPatterns = [
    // Greetings (exact match)
    /^(hola)$/,
    /^(buenos\s*d[ií]as|buenas\s*tardes|buenas\s*noches)$/,
    /^(qué\s*tal|que\s*tal)$/,
    // Common words
    /\b(gracias|qué|que\s+es|cómo|como\s+puedo|dónde|donde|por\s+qué)\b/,
  ];

  if (spanishPatterns.some(p => p.test(cleanQuery))) {
    return 'es';
  }

  // French indicators - EXPANDED for greetings
  const frenchPatterns = [
    // Greetings (exact match)
    /^(bonjour|bonsoir|salut|coucou)$/,
    /^(ça\s*va)$/,
    // Common words
    /\b(merci|comment|qu'est|quoi|pourquoi)\b/,
  ];

  if (frenchPatterns.some(p => p.test(cleanQuery))) {
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

// Check if query is specifically about language capabilities
function isLanguageCapabilityQuery(query: string): boolean {
  const languagePatterns = [
    /\b(?:do you|can you|are you able to)\s+(?:understand|speak|support|know|read|write)\s+(?:portuguese|spanish|english|french|german|italian|português|espanhol|inglês)/i,
    /\b(?:understand|speak|support|know)\s+(?:portuguese|spanish|english|french|german|italian|português|espanhol|inglês)/i,
    /what\s+languages?\s+(?:do you|can you|does koda)/i,
    /(?:which|what)\s+languages?\s+(?:are|is)\s+supported/i,
    /\b(?:você|voce|vc)\s+(?:fala|entende|sabe)\s+(?:português|portugues|espanhol|inglês)/i,
    /(?:quais?|que)\s+(?:idiomas?|línguas?)/i,
    /\b(?:hablas?|entiendes?|sabes?)\s+(?:portugués|español|inglés)/i,
    /(?:qué|cuáles?)\s+(?:idiomas?|lenguas?)/i,
  ];
  return languagePatterns.some(p => p.test(query.toLowerCase()));
}

// Generate language capability response
function generateLanguageResponse(language: string): string {
  const responses: Record<string, string> = {
    en: `Yes, I understand multiple languages!

**Languages I support:**
- **English**: Full support
- **Portuguese**: Full support (including Brazilian Portuguese)
- **Spanish**: Full support

I can:
- Answer questions in your preferred language
- Analyze documents in any of these languages
- Detect your language automatically
- Switch languages mid-conversation

My primary focus is helping you work with your documents. How can I help you today?`,
    pt: `Sim, eu entendo vários idiomas!

**Idiomas que eu suporto:**
- **Português**: Suporte completo (incluindo português brasileiro)
- **Inglês**: Suporte completo
- **Espanhol**: Suporte completo

Eu posso:
- Responder perguntas no seu idioma preferido
- Analisar documentos em qualquer um desses idiomas
- Detectar seu idioma automaticamente
- Trocar de idioma durante a conversa

Meu foco principal é ajudá-lo a trabalhar com seus documentos. Como posso ajudá-lo hoje?`,
    es: `¡Sí, entiendo varios idiomas!

**Idiomas que soporto:**
- **Español**: Soporte completo
- **Portugués**: Soporte completo (incluyendo portugués brasileño)
- **Inglés**: Soporte completo

Puedo:
- Responder preguntas en tu idioma preferido
- Analizar documentos en cualquiera de estos idiomas
- Detectar tu idioma automáticamente
- Cambiar de idioma durante la conversación

Mi enfoque principal es ayudarte a trabajar con tus documentos. ¿Cómo puedo ayudarte hoy?`,
    fr: `Oui, je comprends plusieurs langues!

**Langues que je supporte:**
- **Français**: Support complet
- **Anglais**: Support complet
- **Portugais**: Support complet
- **Espagnol**: Support complet

Je peux:
- Répondre aux questions dans votre langue préférée
- Analyser des documents dans toutes ces langues
- Détecter votre langue automatiquement
- Changer de langue en cours de conversation

Mon objectif principal est de vous aider avec vos documents. Comment puis-je vous aider?`
  };

  return responses[language] || responses['en'];
}

// Generate capability response
function generateCapabilityResponse(language: string, documentCount: number, query?: string): string {
  // Check if this is specifically a language question
  if (query && isLanguageCapabilityQuery(query)) {
    return generateLanguageResponse(language);
  }

  const responses: Record<string, string> = {
    en: `I'm Koda, your intelligent document assistant! Here's what I can do:

**Document Analysis**
- Search, summarize, and extract insights from your documents
- Find specific data, totals, and statistics in your files
- Find information across all your ${documentCount > 0 ? documentCount + ' ' : ''}documents

**Cross-Document Intelligence**
- Identify themes and topics across documents
- Analyze trends and patterns
- Compare information between documents

**Calculations & Data**
- Perform financial calculations (IRR, NPV, projections)
- Process tables and spreadsheets
- Execute complex formulas

**Languages**
- English, Portuguese, Spanish - full support

Just ask me anything about your documents!`,
    pt: `Sou a Koda, sua assistente inteligente de documentos! Veja o que posso fazer:

**Análise de Documentos**
- Pesquisar, resumir e extrair insights dos seus documentos
- Encontrar dados específicos, totais e estatísticas
- Encontrar informações em todos os seus ${documentCount > 0 ? documentCount + ' ' : ''}documentos

**Inteligência Cross-Document**
- Identificar temas e tópicos entre documentos
- Analisar tendências e padrões
- Comparar informações entre documentos

**Cálculos e Dados**
- Realizar cálculos financeiros (TIR, VPL, projeções)
- Processar tabelas e planilhas
- Executar fórmulas complexas

**Idiomas**
- Português, Inglês, Espanhol - suporte completo

Basta me perguntar qualquer coisa sobre seus documentos!`,
    es: `¡Soy Koda, tu asistente inteligente de documentos! Esto es lo que puedo hacer:

**Análisis de Documentos**
- Buscar, resumir y extraer información de tus documentos
- Encontrar datos específicos, totales y estadísticas
- Encontrar información en todos tus ${documentCount > 0 ? documentCount + ' ' : ''}documentos

**Inteligencia Cross-Document**
- Identificar temas y tópicos entre documentos
- Analizar tendencias y patrones
- Comparar información entre documentos

**Cálculos y Datos**
- Realizar cálculos financieros (TIR, VPN, proyecciones)
- Procesar tablas y hojas de cálculo
- Ejecutar fórmulas complejas

**Idiomas**
- Español, Portugués, Inglés - soporte completo

¡Solo pregúntame cualquier cosa sobre tus documentos!`,
    fr: `Je suis Koda, votre assistant intelligent de documents! Voici ce que je peux faire:

**Analyse de Documents**
- Rechercher, résumer et extraire des informations
- Trouver des données spécifiques, totaux et statistiques
- Trouver des informations dans tous vos ${documentCount > 0 ? documentCount + ' ' : ''}documents

**Intelligence Cross-Document**
- Identifier les thèmes et sujets entre documents
- Analyser les tendances et patterns
- Comparer les informations entre documents

**Calculs et Données**
- Effectuer des calculs financiers (TRI, VAN, projections)
- Traiter des tableaux et feuilles de calcul
- Exécuter des formules complexes

**Langues**
- Français, Anglais, Portugais, Espagnol - support complet

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
        // Check if it's a language-specific question
        const queryType = isLanguageCapabilityQuery(query) ? 'language capability' : 'capability';
        console.log(`⚡ [FAST PATH] ${queryType} query detected in ${latency}ms`);
        return {
          isFastPath: true,
          response: generateCapabilityResponse(detectedLanguage, options.documentCount || 0, query),
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
// Memory Service Stub (DEPRECATED - replaced by KodaMemoryEngine)
// ═══════════════════════════════════════════════════════════════════════════
export const memoryService = {
  getRelevantMemories: async (_userId: string, _query: string, _conversationId?: string, _limit?: number) => [] as any[],
  formatMemoriesForPrompt: (_memories: any[]) => '',
  storeMemory: async (_userId: string, _memory: any) => {},
  getMemory: async (_userId: string, _conversationId: string) => null,
  saveMemory: async (_userId: string, _conversationId: string, _memory: any) => {},
  clearMemory: async (_userId: string, _conversationId: string) => {}
};

// ═══════════════════════════════════════════════════════════════════════════
// Conversation Manager Stub (DEPRECATED - replaced by KodaMemoryEngine)
// ═══════════════════════════════════════════════════════════════════════════
export const conversationManager = {
  getConversation: async (_conversationId: string) => null,
  createConversation: async (_userId: string, _title?: string) => ({ id: 'stub-conv-id' }),
  updateConversation: async (_conversationId: string, _updates: any) => {},
  deleteConversation: async (_conversationId: string) => {},
  getConversationHistory: async (_conversationId: string) => [] as any[],
  addMessage: async (_conversationId: string, _role: string, _content?: string) => ({ id: 'stub-conv-id' }),
  getContext: async (_conversationId: string) => '',
  // Additional methods used by chat.controller.ts
  getConversationState: async (_conversationId: string) => ({ id: 'stub-conv-id', userId: 'stub-user-id' }),
  buildPromptWithContext: (_systemPrompt: string, _conversationState: any) =>
    [{ role: 'system' as const, content: _systemPrompt }] as Array<{ role: 'user' | 'system' | 'model'; content: string }>
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

    // ✅ FIX: Filter out low-relevance sources to prevent irrelevant document fallback
    // Minimum threshold of 0.15 (normalized score) to exclude noise
    const MIN_SOURCE_RELEVANCE = 0.15;
    const filteredSources = sources.filter(s => {
      // Keep sources that are either:
      // 1. Above the minimum relevance threshold, OR
      // 2. Have a high score relative to the best source (within 50% of best)
      const bestScore = Math.max(...sources.map(src => src.score || 0));
      const relativeThreshold = bestScore * 0.5;
      const isRelevant = (s.score || 0) >= MIN_SOURCE_RELEVANCE || (s.score || 0) >= relativeThreshold;

      if (!isRelevant) {
        console.log(`⚠️ [CITATION TRACKING] Filtering out low-relevance source: ${s.documentName} (score: ${(s.score || 0).toFixed(3)})`);
      }
      return isRelevant;
    });

    // Sort by score descending
    return filteredSources.sort((a, b) => (b.score || 0) - (a.score || 0));
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
// Synthesis Query Detection - STUB (service deprecated)
// ═══════════════════════════════════════════════════════════════════════════
// Stub for synthesis query detection - see full stub at end of file

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
// Synthesis Query Detection Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export const synthesisQueryDetectionService = {
  isSynthesisQuery: (_query: string) => false,
  detect: (_query: string) => ({
    isSynthesis: false,
    isSynthesisQuery: false,
    type: 'none' as string,
    topic: undefined as string | undefined,
    confidence: 0
  }),
  detectSynthesisType: (_query: string) => null as string | null,
  getSynthesisContext: async (_userId: string, _query: string) => ({
    isSynthesis: false,
    type: null as string | null,
    context: ''
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Cross Document Synthesis Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export const crossDocumentSynthesisService = {
  synthesize: async (_query: string, _documents: any[], _options?: any) => ({
    synthesis: '',
    sources: [] as any[],
    confidence: 0
  }),
  synthesizeMethodologies: async (_userId: string, _topic?: string, _options?: any) => ({
    synthesis: '',
    methodologies: [] as Array<{ name: string; documentIds: string[] }>,
    totalDocuments: 0
  }),
  isCrossDocumentQuery: (_query: string) => false,
  getCrossDocumentContext: async (_userId: string, _query: string) => ({
    isCrossDocument: false,
    context: ''
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

// NOTE: Default export moved to end of file after all definitions

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

// ═══════════════════════════════════════════════════════════════════════════
// BM25 Retrieval Service Stub (DEPRECATED - replaced by KodaRetrievalEngine)
// ═══════════════════════════════════════════════════════════════════════════
export const bm25RetrievalService = {
  search: async (_query: string, _userId: string, _options?: any) => ({
    results: [] as any[],
    totalHits: 0
  }),
  indexDocument: async (_docId: string, _content: string) => {},
  deleteDocument: async (_docId: string) => {},
  // Used by hybridRetrieval.service.ts
  hybridSearch: async (_query: string, _embeddings: number[], _userId: string, _topK?: number) => [] as any[]
};

// ═══════════════════════════════════════════════════════════════════════════
// Hybrid Retrieval Service Stub (DEPRECATED - replaced by KodaRetrievalEngine)
// ═══════════════════════════════════════════════════════════════════════════
export interface HybridRetrievalResult {
  chunks: any[];
  totalFound: number;
  retrievalTime: number;
  method: string;
  // Used by rag.service.ts
  matches?: any[];
}

export const performHybridRetrieval = async (
  _query: string,
  _queryEmbedding?: number[],
  _userId?: string,
  _topK?: number,
  _filter?: any,
  _options?: any
): Promise<HybridRetrievalResult> => ({
  chunks: [],
  totalFound: 0,
  retrievalTime: 0,
  method: 'stub',
  matches: []
});

export const initializePineconeIndex = async (_pineconeIndex?: any) => {};

// ═══════════════════════════════════════════════════════════════════════════
// Conversation State Tracker Stub (DEPRECATED - replaced by KodaMemoryEngine)
// ═══════════════════════════════════════════════════════════════════════════
export const getConversationState = async (_conversationId: string) => null;
export const updateConversationState = async (
  _conversationId: string,
  _state: any
) => {};
export const extractSimpleEntities = (_text: string) => [] as string[];  // Renamed to avoid duplicate
export const extractTopics = (_text: string) => [] as string[];

// ═══════════════════════════════════════════════════════════════════════════
// Koda Format Enforcement Stub (DEPRECATED - replaced by 3-layer architecture)
// ═══════════════════════════════════════════════════════════════════════════
export const kodaFormatEnforcementService = {
  enforceFormat: (
    answer: string,
    _queryType?: string,
    _answerLength?: string,
    _userTone?: string,
    _fileList?: any,
    _query?: string
  ) => ({
    fixedText: answer,
    violations: [] as Array<{ severity: string; type: string; message: string }>
  }),
  validateFormat: (_answer: string) => ({ isValid: true, errors: [] as string[] })
};

// ═══════════════════════════════════════════════════════════════════════════
// Simple Intent Detection Stub (DEPRECATED - replaced by KodaIntentEngine)
// ═══════════════════════════════════════════════════════════════════════════
export interface SimpleIntentResult {
  intent: string;
  confidence: number;
  skill: string;
  fastPath: boolean;
  language: string;
  // Additional properties used by controllers
  detectionTimeMs?: number;
  entities?: string[];
  parameters?: Record<string, any>;
  // Properties used by rag.service.ts
  type?: string;
  fileAction?: string;
}

export const detectSimpleIntent = (
  _query: string,
  _options?: any
): SimpleIntentResult => ({
  intent: 'unknown',
  confidence: 0.5,
  skill: 'general',
  fastPath: false,
  language: 'en',
  detectionTimeMs: 0,
  entities: [],
  parameters: {},
  type: 'general',
  fileAction: undefined
});

// ═══════════════════════════════════════════════════════════════════════════
// Hybrid Search Stub (DEPRECATED - replaced by KodaRetrievalEngine)
// ═══════════════════════════════════════════════════════════════════════════
export interface SearchFilters {
  documentIds?: string[];
  documentTypes?: string[];
  dateRange?: { start: Date; end: Date };
}

export interface HybridSearchOptions {
  topK?: number;
  method?: 'bm25' | 'vector' | 'hybrid' | 'auto';
  filters?: SearchFilters;
}

export const hybridSearch = async (
  _query: string,
  _userId: string,
  _options?: HybridSearchOptions
) => ({
  results: [] as any[],
  totalHits: 0,
  method: 'stub'
});

export const analyzeQueryIntent = (_query: string) => ({
  intent: 'unknown',
  confidence: 0.5
});

// ═══════════════════════════════════════════════════════════════════════════
// Context-Aware Intent Detection Stub (DEPRECATED - replaced by KodaIntentEngine)
// ═══════════════════════════════════════════════════════════════════════════
export interface ContextAwareIntentResult {
  intent: string;
  confidence: number;
  entities: Array<{ type: string; value: string }>;
  negation: boolean;
  isComplete: boolean;
  clarificationNeeded?: string;
  primaryIntent: {
    primary: string;
    disambiguation?: string;
    isRefusal?: boolean;
  };
}

// Object-style export for contextAwareIntentDetection with detectIntent method
export const contextAwareIntentDetection = {
  detectIntent: (
    _query: string,
    _conversationHistory?: Array<{ role: string; content: string }>
  ): ContextAwareIntentResult => ({
    intent: 'unknown',
    confidence: 0.5,
    entities: [],
    negation: false,
    isComplete: true,
    primaryIntent: {
      primary: 'unknown',
      isRefusal: false
    }
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Hierarchical Intent Classifier Stub (DEPRECATED - replaced by KodaIntentEngine)
// ═══════════════════════════════════════════════════════════════════════════
export interface IntentResult {
  category: string;
  intent: string;
  confidence: number;
  complexity: string;
  // Additional properties used by hierarchicalIntentHandler
  primaryIntent: string;
  entities: string[];
  source: string;
  clarificationNeeded?: string;
  // Properties used by rag.service.ts
  subQuestions?: SubQuestion[];
}

export interface SubQuestion {
  question: string;
  priority: number;
  dependsOn?: string[];
  order: number;
  targetDocuments?: string[];
  intent?: string;
  targetDimension?: string;
}

export const classifyIntent = async (
  _query: string,
  _context?: any
): Promise<IntentResult> => ({
  category: 'general',
  intent: 'unknown',
  confidence: 0.5,
  complexity: 'simple',
  primaryIntent: 'unknown',
  entities: [],
  source: 'stub'
});

export const shouldDecompose = (_intentOrQuery?: IntentResult | string, _intent?: IntentResult) => false;

export const decomposeQuery = async (
  _query: string,
  _intent?: IntentResult,
  _context?: any
): Promise<SubQuestion[]> => [];

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline Configuration Stub (DEPRECATED - replaced by KodaIntentEngine)
// ═══════════════════════════════════════════════════════════════════════════
export interface PipelineConfig {
  stages: string[];
  timeout: number;
  parallel: boolean;
  // Additional properties used by pipelineConfiguration.service.ts
  routing: 'single' | 'multi-document' | 'all-documents';
  retrieval: {
    strategy: string;
    topK: number;
    chunkTypeBoosts?: Record<string, number>;
  };
  reranking: {
    enabled: boolean;
    methods: string[];
  };
  answer: {
    template: string;
    targetWords: number;
    sections: number;
    useHeadings: boolean;
    useBullets: boolean;
    useNumberedLists: boolean;
  };
}

export interface AnswerPlan {
  structure: string;
  sections: Array<{ title: string; targetWords: number; bulletPoints?: number }>;
  estimatedLength: number;
  targetWords?: number;
  useHeadings?: boolean;
  useBullets?: boolean;
  useNumberedLists?: boolean;
  template?: string;
}

export const getPipelineConfig = (_intent: IntentResult): PipelineConfig => ({
  stages: ['retrieve', 'generate'],
  timeout: 30000,
  parallel: false,
  routing: 'single',
  retrieval: { strategy: 'standard', topK: 20 },
  reranking: { enabled: false, methods: [] },
  answer: { template: 'direct', targetWords: 500, sections: 1, useHeadings: false, useBullets: false, useNumberedLists: false }
});

export const planAnswerShape = (_intent: IntentResult, _pipelineConfig?: PipelineConfig): AnswerPlan => ({
  structure: 'simple',
  sections: [{ title: 'Answer', targetWords: 500 }],
  estimatedLength: 500,
  targetWords: 500,
  useHeadings: false,
  useBullets: false,
  useNumberedLists: false,
  template: 'direct'
});

export const buildPromptWithPlan = (
  query: string,
  _plan: AnswerPlan,
  _context: string
) => query;

// ═══════════════════════════════════════════════════════════════════════════
// Query Executor Stub (DEPRECATED - replaced by KodaIntentEngine)
// ═══════════════════════════════════════════════════════════════════════════
export interface SubQuestionResult {
  question: string;
  answer: string;
  sources: any[];
}

export interface MultiPartAnswer {
  parts: SubQuestionResult[];
  synthesizedAnswer: string;
}

export const executeSubQuestion = async (
  _subQuestion: SubQuestion,
  _context: any
): Promise<SubQuestionResult> => ({
  question: '',
  answer: '',
  sources: []
});

export const assembleMultiPartAnswer = (
  _results: SubQuestionResult[]
): MultiPartAnswer => ({
  parts: [],
  synthesizedAnswer: ''
});

// ═══════════════════════════════════════════════════════════════════════════
// Hierarchical Intent Handler Stub (DEPRECATED - replaced by KodaIntentEngine)
// ═══════════════════════════════════════════════════════════════════════════
export const handleHierarchicalIntent = async (
  _query: string,
  _userId: string,
  _conversationHistory?: Array<{ role: string; content: string }>
) => ({
  hierarchicalIntent: {
    category: 'general',
    intent: 'unknown',
    confidence: 0.5,
    complexity: 'simple',
    primaryIntent: 'unknown',
    entities: [] as string[],
    source: 'stub'
  } as IntentResult,
  pipelineConfig: {
    stages: ['retrieve', 'generate'],
    timeout: 30000,
    parallel: false,
    routing: 'single' as const,
    retrieval: { strategy: 'standard', topK: 20 },
    reranking: { enabled: false, methods: [] },
    answer: { template: 'direct', targetWords: 500, sections: 1, useHeadings: false, useBullets: false, useNumberedLists: false }
  } as PipelineConfig,
  answerPlan: {
    structure: 'simple',
    sections: [{ title: 'Answer', targetWords: 500 }],
    estimatedLength: 500,
    targetWords: 500
  } as AnswerPlan,
  handled: false,
  clarificationMessage: undefined as string | undefined,
  classificationTimeMs: 0
});

export const handleQueryDecomposition = async (
  _query: string,
  _intent: IntentResult,
  _context?: any
) => ({
  shouldDecompose: false,
  subQuestions: [] as SubQuestion[]
});

// ═══════════════════════════════════════════════════════════════════════════
// Format Enforcement Service Stub (DEPRECATED - replaced by MasterFormatter)
// ═══════════════════════════════════════════════════════════════════════════
export interface FormatEnforcementConfig {
  enableBold?: boolean;
  enableLists?: boolean;
  enableHeadings?: boolean;
  maxLength?: number;
}

export const formatEnforcementService = {
  enforce: (answer: string, _config?: FormatEnforcementConfig) => answer,
  validate: (_answer: string) => ({ isValid: true, errors: [] as string[] }),
  // Additional method used by controllers
  enforceFormat: (answer: string, _options?: any) => ({
    fixedText: answer,
    violations: [] as Array<{ severity: string; type: string; message?: string }>
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Output Post Processor Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export interface PostProcessingResult {
  processedAnswer: string;
  cleanedAnswer: string;  // Alias
  changes: string[];
  warnings: string[];
  sourcesRemoved: boolean;
}

export const postProcessAnswer = async (
  answer: string,
  _query?: string,
  _options?: any
): Promise<PostProcessingResult> => ({
  processedAnswer: answer,
  cleanedAnswer: answer,
  changes: [],
  warnings: [],
  sourcesRemoved: false
});

// ═══════════════════════════════════════════════════════════════════════════
// Memory Injection Service Stub (DEPRECATED - replaced by KodaMemoryEngine)
// ═══════════════════════════════════════════════════════════════════════════
export const memoryInjectionService = {
  injectMemories: async (_userId: string, _query: string, _context?: any) => ({
    injectedContext: '',
    memories: [] as any[],
    relevanceScores: [] as number[]
  }),
  getRelevantMemories: async (_userId: string, _query: string) => [] as any[],
  formatMemoriesForPrompt: (_memories: any[]) => ''
};

// ═══════════════════════════════════════════════════════════════════════════
// Chat Document Generation Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export const generateDocument = async (
  _options: {
    userId?: string;
    conversationId?: string;
    messageId?: string;
    query?: string;
    documentType?: string;
    sourceContent?: string;
    sourceDocumentIds?: string[];
  }
): Promise<{
  success: boolean;
  documentId?: string;
  error?: string;
  message: string;
  chatDocument: { id: string };
}> => ({
  success: false,
  error: 'Chat document generation is deprecated',
  message: 'Document generation is currently disabled.',
  chatDocument: { id: 'stub-doc-id' }
});

// ═══════════════════════════════════════════════════════════════════════════
// NER Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export const nerService = {
  extractEntities: async (_text: string, _filenameOrOptions?: string | any) => ({
    entities: [] as any[],
    confidence: 0,
    suggestedTags: [] as string[]
  }),
  processDocument: async (_documentId: string, _text: string) => ({
    success: true,
    entityCount: 0
  }),
  getEntitiesForDocument: async (_documentId: string) => [] as any[],
  storeEntities: async (_documentId: string, _entities: any[]) => {},
  autoTagDocument: async (_userId: string, _documentId: string, _entities?: any[], _suggestedTags?: string[]) => ({
    suggestedTags: [] as string[]
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Document Classifier Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export interface DocumentClassification {
  type: string;
  documentType: string;  // Added for compatibility
  domain: string;
  subType?: string;
  confidence: number;
  typeConfidence?: number;
  domainConfidence?: number;
  tags: string[];
}

export const DOCUMENT_TAXONOMY = {
  types: ['report', 'article', 'presentation', 'spreadsheet', 'other'],
  domains: ['general', 'finance', 'legal', 'technical', 'marketing']
};
export const ALL_DOCUMENT_TYPES = DOCUMENT_TAXONOMY.types;
export const ALL_DOMAINS = DOCUMENT_TAXONOMY.domains;

export const classifyDocument = async (
  _textContent: string,
  _filename: string,
  _mimeType?: string
): Promise<DocumentClassification> => ({
  type: 'other',
  documentType: 'other',
  domain: 'general',
  confidence: 0.5,
  typeConfidence: 0.5,
  domainConfidence: 0.5,
  tags: []
});

export const classifyDocumentsBatch = async (
  _documents: any[]
): Promise<DocumentClassification[]> => [];

export const fallbackClassification = (_filename: string, _mimeType: string): DocumentClassification => ({
  type: 'other',
  documentType: 'other',
  domain: 'general',
  confidence: 0.3,
  typeConfidence: 0.3,
  domainConfidence: 0.3,
  tags: []
});

// ═══════════════════════════════════════════════════════════════════════════
// Entity Extractor Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export interface ExtractedEntity {
  text: string;
  type: string;
  confidence: number;
  position: { start: number; end: number };
}

export enum EntityType {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  LOCATION = 'LOCATION',
  DATE = 'DATE',
  MONEY = 'MONEY',
  PERCENTAGE = 'PERCENTAGE',
  OTHER = 'OTHER'
}

export const extractEntities = async (
  _text: string,
  _options?: { domain?: string; useLLM?: boolean } | any
): Promise<ExtractedEntity[]> => [];

export const extractEntitiesBatch = async (
  _texts: string[]
): Promise<ExtractedEntity[][]> => [];

// ═══════════════════════════════════════════════════════════════════════════
// Keyword Extractor Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export interface ExtractedKeyword {
  keyword: string;
  word: string;  // Alias for compatibility
  score: number;
  tfIdf: number;  // Alias for score
  frequency: number;
  isDomain: boolean;
  isDomainSpecific: boolean;  // Alias for isDomain
}

export const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were']);
export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  finance: ['revenue', 'profit', 'margin', 'growth'],
  legal: ['contract', 'agreement', 'clause', 'term']
};

export const extractKeywords = (
  _text: string,
  _options?: { domain?: string; maxKeywords?: number }
): ExtractedKeyword[] => [];

export const extractKeywordsBatch = (
  _texts: string[]
): ExtractedKeyword[][] => [];

export const combineKeywords = (_keywords: ExtractedKeyword[][]): ExtractedKeyword[] => [];
export const isDomainKeyword = (_keyword: string, _domain?: string): boolean => false;
export const getDomainKeywords = (_domain: string): string[] => [];
export const keywordsToString = (_keywords: ExtractedKeyword[]): string => '';

// ═══════════════════════════════════════════════════════════════════════════
// Metadata Enrichment Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export const metadataEnrichmentService = {
  enrichDocument: async (_text: string, _filename: string, _options?: any) => ({
    success: true,
    summary: '',
    topics: [] as string[],
    entities: [] as any[],
    metadata: {} as any
  }),
  getEnrichedMetadata: async (_documentId: string) => ({} as any),
  updateMetadata: async (_documentId: string, _metadata: any) => ({ success: true })
};

// ═══════════════════════════════════════════════════════════════════════════
// Methodology Extraction Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export const extractMethodologies = async (
  _text: string,
  _options?: any
): Promise<any[]> => [];

// ═══════════════════════════════════════════════════════════════════════════
// Domain Knowledge Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export const domainKnowledgeService = {
  getDomainContext: async (_userId: string, _domain: string) => ({
    context: '',
    documents: [] as any[],
    confidence: 0
  }),
  extractDomainKnowledge: async (_documentId: string, _text: string) => ({
    success: true,
    knowledge: [] as any[]
  }),
  getDomainKnowledgeForDocument: async (_documentId: string) => [] as any[]
};

// ═══════════════════════════════════════════════════════════════════════════
// Document Name Formatter Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export interface DocSource {
  documentId: string;
  documentName?: string;
  filename?: string;
  title?: string;
}

export const formatDocumentNamesForFrontend = (
  answer: string,
  _sources: DocSource[]
): string => answer;

export const addSeeAllLink = (
  answer: string,
  _sources: DocSource[],
  _maxSources?: number
): string => answer;

export const formatDocumentList = (
  _sources: DocSource[],
  _options?: any
): string => '';

// ═══════════════════════════════════════════════════════════════════════════
// Answer Post Processor Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
export interface PostProcessResult {
  answer: string;
  changes: string[];
  warnings: string[];
}

export const answerPostProcessor = {
  process: async (answer: string, _options?: any): Promise<PostProcessResult> => ({
    answer,
    changes: [],
    warnings: []
  }),
  postProcess: async (answer: string, _query?: string, _options?: any): Promise<PostProcessResult> => ({
    answer,
    changes: [],
    warnings: []
  }),
  postProcessAnswer: async (answer: string, _query?: string, _options?: any): Promise<PostProcessResult> => ({
    answer,
    changes: [],
    warnings: []
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// Micro Summary Generator Service Stub (DEPRECATED)
// ═══════════════════════════════════════════════════════════════════════════
interface MicroSummaryResult {
  summary: string;
  text: string;
}

export const generateMicroSummary = async (
  text: string,
  _chunkTypeOrIndex?: string | number,
  _documentTypeOrName?: string,
  _sectionNameOrOptions?: string | any
): Promise<MicroSummaryResult> => {
  // Return first 100 chars as a simple summary
  const summary = text.substring(0, 100) + (text.length > 100 ? '...' : '');
  return { summary, text: summary };
};

export const microSummaryGeneratorService = {
  generate: generateMicroSummary,
  generateBatch: async (texts: string[]): Promise<MicroSummaryResult[]> =>
    texts.map(t => {
      const summary = t.substring(0, 100) + (t.length > 100 ? '...' : '');
      return { summary, text: summary };
    })
};

// ═══════════════════════════════════════════════════════════════════════════
// Conversation Embedding Service Stub (DEPRECATED - merged into deletedServiceStubs)
// ═══════════════════════════════════════════════════════════════════════════
export interface ConversationSearchResult {
  conversationId: string;
  title: string;
  summary: string;
  score: number;
  messageCount: number;
  lastMessageAt: string;
}

export const conversationEmbeddingService = {
  embedConversation: async () => {},
  searchConversations: async (
    _query: string,
    _userId: string,
    _options?: any
  ): Promise<ConversationSearchResult[]> => [],
  searchConversationChunks: async (_query: string, _options?: any): Promise<any[]> => [],
  embedChunksBatch: async (_chunks: any[]): Promise<any[]> => [],
  embedConversationIndex: async (_conversationId: string, _userId: string) => {},
  deleteConversationEmbeddings: async (_conversationId: string) => {}
};

// ═══════════════════════════════════════════════════════════════════════════
// Default export for services that use default import
// ═══════════════════════════════════════════════════════════════════════════
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
  responsePostProcessor,
  nerService,
  metadataEnrichmentService,
  domainKnowledgeService,
  answerPostProcessor,
  microSummaryGeneratorService,
  conversationEmbeddingService
};

// ═══════════════════════════════════════════════════════════════════════════
// Document Router Service Stub (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export interface DocumentRoutingResult {
  documentId: string;
  confidence: number;
  reason: string;
}

export interface DocumentSummary {
  id: string;
  filename: string;
  summary?: string;
}

export const routeToDocument = async (
  _query: string,
  _documents: DocumentSummary[],
  _options?: any
): Promise<DocumentRoutingResult | null> => null;

export const routeToMultipleDocuments = async (
  _query: string,
  _documents: DocumentSummary[],
  _options?: any
): Promise<DocumentRoutingResult[]> => [];

export const getRoutingStats = () => ({
  totalRoutes: 0,
  successfulRoutes: 0,
  failedRoutes: 0
});

// ═══════════════════════════════════════════════════════════════════════════
// Chunk Classifier Service Stub (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export interface ChunkClassification {
  chunkType: string;
  category: string;
  confidence: number;
}

export const CHUNK_TAXONOMY = {
  CATEGORIES: ['general', 'technical', 'business', 'legal'],
  TYPES: ['paragraph', 'table', 'list', 'heading', 'code']
};

export const ALL_CHUNK_TYPES = CHUNK_TAXONOMY.TYPES;
export const ALL_CATEGORIES = CHUNK_TAXONOMY.CATEGORIES;

export const classifyChunk = async (
  _text: string,
  _options?: any
): Promise<ChunkClassification> => ({
  chunkType: 'paragraph',
  category: 'general',
  confidence: 0.5
});

export const classifyChunksBatch = async (
  texts: string[],
  _options?: any
): Promise<ChunkClassification[]> =>
  texts.map(() => ({
    chunkType: 'paragraph',
    category: 'general',
    confidence: 0.5
  }));

export const getChunkTypesForCategory = (_category: string): string[] => ALL_CHUNK_TYPES;
export const getCategoryForChunkType = (_chunkType: string): string => 'general';
export const isDomainSpecificChunkType = (_chunkType: string): boolean => false;

// ═══════════════════════════════════════════════════════════════════════════
// Chunk Type Reranker Service Stub (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export const chunkTypeRerankerService = {
  rerank: async (chunks: any[], _query: string, _options?: any) => chunks,
  rerankByChunkType: async (chunks: any[], _chunkType: string) => chunks
};

// ═══════════════════════════════════════════════════════════════════════════
// Document List State Manager Stub (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export const documentListStateManager = {
  getState: () => ({ documents: [], lastUpdate: new Date() }),
  updateState: async () => {},
  invalidateCache: () => {},
  refreshCache: async () => {}
};

// ═══════════════════════════════════════════════════════════════════════════
// Additional stubs for documentListStateManager (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export interface DocumentListItem {
  id: string;
  filename: string;
  displayTitle?: string;
}

export const documentListStateManagerFull = {
  getState: () => ({ documents: [] as DocumentListItem[], lastUpdate: new Date() }),
  updateState: async () => {},
  invalidateCache: () => {},
  refreshCache: async () => {},
  setLastDocument: (_doc: any) => {},
  getLastDocument: () => null as any,
  setDocumentList: (_docs: any[]) => {},
  getDocumentList: () => [] as DocumentListItem[]
};

// Re-export with full interface
Object.assign(documentListStateManager, documentListStateManagerFull);

// ═══════════════════════════════════════════════════════════════════════════
// Chunk Type Reranker exports (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export interface RankedChunk {
  text: string;
  score: number;
  metadata?: any;
}

export const rerankByChunkType = async (
  chunks: any[],
  _chunkType: string
): Promise<RankedChunk[]> => chunks.map(c => ({ ...c, score: c.score || 0.5 }));

// ═══════════════════════════════════════════════════════════════════════════
// Document Generation Detection (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export const detectDocumentGenerationIntent = (_query: string): {
  isDocumentGeneration: boolean;
  documentType?: string;
  shouldProceedToRag: boolean;
  confidence: number;
} => ({
  isDocumentGeneration: false,
  shouldProceedToRag: true,
  confidence: 0
});

export const detectDocumentGeneration = async () => false;

// ═══════════════════════════════════════════════════════════════════════════
// Document Generation Detection Stub (REMOVED - upload restructure)
// ═══════════════════════════════════════════════════════════════════════════
export const isDocumentGenerationRequest = (_query: string): boolean => false;
export const documentGenerationDetectionService = {
  isDocumentGeneration: (_query: string) => false,
  detectIntent: (_query: string) => ({ isGeneration: false, confidence: 0 })
};
