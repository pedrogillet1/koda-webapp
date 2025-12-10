/**
 * Koda Intent Engine - Unified Intent Detection & Classification
 * 
 * Merges:
 * - simpleIntentDetection.service.ts
 * - documentRouter.service.ts
 * - skillAndIntentRouter.service.ts
 * - documentGenerationDetection.service.ts
 * - contextAwareIntentDetection.service.ts
 * 
 * Single source of truth for all intent detection in Koda
 */

export type AnswerType =
  | 'ULTRA_FAST_GREETING'
  | 'DOC_COUNT'
  | 'FILE_NAVIGATION'
  | 'FOLDER_NAVIGATION'
  | 'APP_HELP'
  | 'CALCULATION'
  | 'SINGLE_DOC_RAG'
  | 'CROSS_DOC_RAG'
  | 'COMPLEX_ANALYSIS'
  | 'MEMORY'
  | 'STANDARD_QUERY';

export interface IntentDetectionResult {
  answerType: AnswerType;
  confidence: number;
  entities: {
    fileNames?: string[];
    folderNames?: string[];
    numbers?: number[];
    dates?: string[];
    topics?: string[];
  };
  requiresRetrieval: boolean;
  requiresMemory: boolean;
  requiresCalculation: boolean;
}

/**
 * Detect answer type and extract entities from query
 */
export async function detectAnswerType(params: {
  query: string;
  conversationHistory?: any[];
  userId?: string;
}): Promise<IntentDetectionResult> {
  const { query, conversationHistory = [] } = params;
  const lowerQuery = query.toLowerCase().trim();

  // 1. ULTRA_FAST_GREETING - Greetings (no LLM, no DB)
  if (isGreeting(lowerQuery)) {
    return {
      answerType: 'ULTRA_FAST_GREETING',
      confidence: 1.0,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 2. DOC_COUNT - Document count queries
  if (isDocCountQuery(lowerQuery)) {
    return {
      answerType: 'DOC_COUNT',
      confidence: 0.95,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 3. FILE_NAVIGATION - File location queries
  const fileIntent = detectFileNavigationIntent(lowerQuery);
  if (fileIntent.isFileNavigation) {
    return {
      answerType: 'FILE_NAVIGATION',
      confidence: fileIntent.confidence,
      entities: {
        fileNames: fileIntent.fileNames,
      },
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 4. FOLDER_NAVIGATION - Folder queries
  const folderIntent = detectFolderNavigationIntent(lowerQuery);
  if (folderIntent.isFolderNavigation) {
    return {
      answerType: 'FOLDER_NAVIGATION',
      confidence: folderIntent.confidence,
      entities: {
        folderNames: folderIntent.folderNames,
      },
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 5. APP_HELP - UI/app usage questions
  if (isAppHelpQuery(lowerQuery)) {
    return {
      answerType: 'APP_HELP',
      confidence: 0.9,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 6. CALCULATION - Math/calculation queries
  const calcIntent = detectCalculationIntent(lowerQuery);
  if (calcIntent.isCalculation) {
    return {
      answerType: 'CALCULATION',
      confidence: calcIntent.confidence,
      entities: {
        numbers: calcIntent.numbers,
      },
      requiresRetrieval: calcIntent.needsDocumentData,
      requiresMemory: false,
      requiresCalculation: true,
    };
  }

  // 7. MEMORY - "Do you remember..." queries
  if (isMemoryQuery(lowerQuery, conversationHistory)) {
    return {
      answerType: 'MEMORY',
      confidence: 0.85,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: true,
      requiresCalculation: false,
    };
  }

  // 8-10. RAG queries (require document retrieval)
  const ragType = detectRAGType(lowerQuery, conversationHistory);
  
  return {
    answerType: ragType.type,
    confidence: ragType.confidence,
    entities: ragType.entities,
    requiresRetrieval: true,
    requiresMemory: conversationHistory.length > 0,
    requiresCalculation: false,
  };
}

/**
 * Check if query is a greeting
 */
function isGreeting(query: string): boolean {
  const greetings = [
    // English
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
    'what can you do', 'what do you do', 'who are you',
    // Portuguese
    'olá', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite',
    'o que você faz', 'o que voce faz', 'quem é você', 'quem e voce',
    // Spanish
    'hola', 'buenos días', 'buenos dias', 'buenas tardes', 'buenas noches',
    'qué puedes hacer', 'que puedes hacer', 'quién eres', 'quien eres',
  ];

  return greetings.some(g => query === g || query === g + '!' || query === g + '?');
}

/**
 * Check if query is asking for document count
 */
function isDocCountQuery(query: string): boolean {
  const patterns = [
    // English
    /how many (documents?|files?|pdfs?)/i,
    /number of (documents?|files?)/i,
    /count (of )?(my )?(documents?|files?)/i,
    // Portuguese
    /quantos? (documentos?|arquivos?|pdfs?)/i,
    /número de (documentos?|arquivos?)/i,
    /conta(gem)? de (documentos?|arquivos?)/i,
    // Spanish
    /cuántos? (documentos?|archivos?)/i,
    /número de (documentos?|archivos?)/i,
  ];

  return patterns.some(p => p.test(query));
}

/**
 * Detect file navigation intent
 */
function detectFileNavigationIntent(query: string): {
  isFileNavigation: boolean;
  confidence: number;
  fileNames: string[];
} {
  const patterns = [
    // English
    /where is (the )?(file|document|pdf|excel|spreadsheet)/i,
    /find (the )?(file|document)/i,
    /locate (the )?(file|document)/i,
    /show me (the )?(file|document)/i,
    // Portuguese
    /onde (está|esta) o? (arquivo|documento|planilha|pdf)/i,
    /encontr(a|e|ar) o? (arquivo|documento)/i,
    /mostr(a|e|ar) o? (arquivo|documento)/i,
    /cad(ê|e) o? (arquivo|documento)/i,
    // Spanish
    /dónde está (el )?(archivo|documento)/i,
    /encontrar (el )?(archivo|documento)/i,
    /mostrar (el )?(archivo|documento)/i,
  ];

  const isFileNav = patterns.some(p => p.test(query));
  
  // Extract potential file names (quoted strings or capitalized words)
  const fileNames: string[] = [];
  const quotedMatch = query.match(/"([^"]+)"|'([^']+)'/);
  if (quotedMatch) {
    fileNames.push(quotedMatch[1] || quotedMatch[2]);
  }

  return {
    isFileNavigation: isFileNav,
    confidence: isFileNav ? 0.95 : 0,
    fileNames,
  };
}

/**
 * Detect folder navigation intent
 */
function detectFolderNavigationIntent(query: string): {
  isFolderNavigation: boolean;
  confidence: number;
  folderNames: string[];
} {
  const patterns = [
    // English
    /what('s| is) in (the )?(folder|directory)/i,
    /show (me )?(files in|contents of) (the )?(folder|directory)/i,
    /list (files in|contents of) (the )?(folder|directory)/i,
    // Portuguese
    /o que (tem|está|esta) na pasta/i,
    /mostr(a|e|ar) (arquivos da|conteúdo da|conteudo da) pasta/i,
    /list(a|e|ar) (arquivos da|conteúdo da) pasta/i,
    // Spanish
    /qué hay en (la )?carpeta/i,
    /mostrar (archivos de|contenido de) (la )?carpeta/i,
  ];

  const isFolderNav = patterns.some(p => p.test(query));
  
  // Extract folder names
  const folderNames: string[] = [];
  const quotedMatch = query.match(/"([^"]+)"|'([^']+)'/);
  if (quotedMatch) {
    folderNames.push(quotedMatch[1] || quotedMatch[2]);
  }

  return {
    isFolderNavigation: isFolderNav,
    confidence: isFolderNav ? 0.9 : 0,
    folderNames,
  };
}

/**
 * Check if query is about app help/usage
 */
function isAppHelpQuery(query: string): boolean {
  const patterns = [
    // English
    /how (do i|to) (upload|create|delete|move|rename)/i,
    /where (do i|can i|to) (upload|create|delete)/i,
    /how does (this|koda) work/i,
    /what can (you|koda) do/i,
    // Portuguese
    /como (faço|fazer) (para )?(upload|criar|deletar|mover|renomear)/i,
    /onde (faço|fazer) (upload|criar|deletar)/i,
    /como (funciona|usar) (o koda|isso)/i,
    /o que (você|voce|o koda) (pode fazer|faz)/i,
    // Spanish
    /cómo (hago|hacer) (upload|crear|eliminar|mover)/i,
    /dónde (hago|hacer) (upload|crear)/i,
    /cómo funciona (koda|esto)/i,
  ];

  return patterns.some(p => p.test(query));
}

/**
 * Detect calculation intent
 */
function detectCalculationIntent(query: string): {
  isCalculation: boolean;
  confidence: number;
  numbers: number[];
  needsDocumentData: boolean;
} {
  const calcPatterns = [
    // Direct math
    /calculate|compute|what is|how much is/i,
    /\d+\s*[\+\-\*\/\%]\s*\d+/,
    // Financial
    /roi|irr|npv|payback|return on investment/i,
    /profit|revenue|cost|expense|budget/i,
    // Portuguese
    /calcul(a|e|ar)|quanto (é|e)|qual (é|e) o (total|valor)/i,
    /lucro|receita|custo|despesa|orçamento/i,
    // Spanish
    /calcular|cuánto es|cuál es (el )?total/i,
    /ganancia|ingreso|costo|gasto|presupuesto/i,
  ];

  const isCalc = calcPatterns.some(p => p.test(query));
  
  // Extract numbers
  const numbers = (query.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  
  // Check if needs document data
  const needsDoc = /from (the )?(document|file|spreadsheet|excel)/i.test(query) ||
                   /do (documento|arquivo|planilha)/i.test(query) ||
                   /del (documento|archivo)/i.test(query);

  return {
    isCalculation: isCalc,
    confidence: isCalc ? 0.9 : 0,
    numbers,
    needsDocumentData: needsDoc,
  };
}

/**
 * Check if query is about conversation memory
 */
function isMemoryQuery(query: string, history: any[]): boolean {
  if (history.length === 0) return false;

  const memoryPatterns = [
    // English
    /do you remember|did (i|we) (say|mention|talk about)/i,
    /what (did|was) (i|we) (say|talking about|discussing)/i,
    /earlier (you|we) (said|mentioned)/i,
    // Portuguese
    /você lembra|eu (disse|mencionei|falei)/i,
    /o que (eu|nós) (disse|dissemos|falamos)/i,
    /antes (você|eu) (disse|mencionou)/i,
    // Spanish
    /recuerdas|dije|mencioné/i,
    /qué (dije|dijimos|hablamos)/i,
    /antes (dijiste|dije)/i,
  ];

  return memoryPatterns.some(p => p.test(query));
}

/**
 * Detect RAG query type (SINGLE_DOC, CROSS_DOC, COMPLEX_ANALYSIS, STANDARD)
 */
function detectRAGType(query: string, history: any[]): {
  type: 'SINGLE_DOC_RAG' | 'CROSS_DOC_RAG' | 'COMPLEX_ANALYSIS' | 'STANDARD_QUERY';
  confidence: number;
  entities: any;
} {
  // COMPLEX_ANALYSIS - Multi-step, comparison, deep analysis
  const complexPatterns = [
    /compare|contrast|difference between/i,
    /analyze|analysis|evaluate|assessment/i,
    /what are (the )?(main|key|top) (risks|challenges|opportunities)/i,
    /step by step|detailed explanation/i,
    // Portuguese
    /compar(a|e|ar)|diferença entre/i,
    /analis(a|e|ar)|avali(a|e|ar)/i,
    /quais (são|sao) os? (principais|maiores) (riscos|desafios)/i,
    /passo a passo|explicação detalhada/i,
    // Spanish
    /comparar|diferencia entre/i,
    /analizar|evaluación/i,
    /cuáles son los (principales|mayores) riesgos/i,
  ];

  if (complexPatterns.some(p => p.test(query))) {
    return {
      type: 'COMPLEX_ANALYSIS',
      confidence: 0.85,
      entities: {},
    };
  }

  // CROSS_DOC_RAG - Mentions multiple documents or comparison
  const crossDocPatterns = [
    /in (both|all) (documents?|files?)/i,
    /across (the )?(documents?|files?)/i,
    /between .+ and .+/i,
    // Portuguese
    /em (ambos|todos) os? (documentos?|arquivos?)/i,
    /entre .+ e .+/i,
    // Spanish
    /en (ambos|todos) los? (documentos?|archivos?)/i,
    /entre .+ y .+/i,
  ];

  if (crossDocPatterns.some(p => p.test(query))) {
    return {
      type: 'CROSS_DOC_RAG',
      confidence: 0.8,
      entities: {},
    };
  }

  // SINGLE_DOC_RAG - Mentions specific document
  const singleDocPatterns = [
    /in (the|this) (document|file|pdf|spreadsheet)/i,
    /from (the|this) (document|file)/i,
    // Portuguese
    /n(o|a|este|esse) (documento|arquivo|planilha)/i,
    /d(o|a|este|esse) (documento|arquivo)/i,
    // Spanish
    /en (el|este) (documento|archivo)/i,
    /del (documento|archivo)/i,
  ];

  if (singleDocPatterns.some(p => p.test(query))) {
    return {
      type: 'SINGLE_DOC_RAG',
      confidence: 0.75,
      entities: {},
    };
  }

  // Default: STANDARD_QUERY
  return {
    type: 'STANDARD_QUERY',
    confidence: 0.7,
    entities: {},
  };
}

/**
 * Extract entities from query
 */
export function extractEntities(query: string): {
  fileNames: string[];
  folderNames: string[];
  numbers: number[];
  dates: string[];
  topics: string[];
} {
  // Extract quoted strings as file/folder names
  const quotedStrings = (query.match(/"([^"]+)"|'([^']+)'/g) || [])
    .map(s => s.replace(/["']/g, ''));

  // Extract numbers
  const numbers = (query.match(/\d+(?:\.\d+)?/g) || []).map(Number);

  // Extract dates (basic patterns)
  const datePatterns = [
    /\d{4}-\d{2}-\d{2}/g,
    /\d{2}\/\d{2}\/\d{4}/g,
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/gi,
  ];
  const dates: string[] = [];
  datePatterns.forEach(pattern => {
    const matches = query.match(pattern);
    if (matches) dates.push(...matches);
  });

  return {
    fileNames: quotedStrings,
    folderNames: quotedStrings,
    numbers,
    dates,
    topics: [], // Could add topic extraction later
  };
}
