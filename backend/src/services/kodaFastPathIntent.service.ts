/**
 * Koda Fast-Path Intent Service
 *
 * Classifies queries to determine if they can be handled via fast-path
 * (direct data retrieval + micro-prompt) instead of full RAG pipeline.
 *
 * Fast-path targets: <1.5s response time
 * Full RAG targets: 2-4s response time
 *
 * @version 1.0.0
 */

import { detectLanguageSimple, type SupportedLanguage } from './languageEngine.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export type FastPathIntentType =
  | 'FILE_LIST'           // "list my files", "show my documents"
  | 'FILE_COUNT'          // "how many files do I have"
  | 'FOLDER_PATH_QUERY'   // "where is the Reports folder"
  | 'RECENT_ACTIVITY'     // "show recent documents", "what did I upload recently"
  | 'SIMPLE_FACT'         // Single-fact lookups from documents
  | 'METADATA_QUERY'      // "what's the size of file X", "when was X uploaded"
  | 'GREETING'            // "hello", "hi koda", "good morning"
  | 'NONE';               // Not a fast-path query - use full RAG

export interface FastPathClassification {
  intent: FastPathIntentType;
  confidence: number;        // 0.0 - 1.0
  isFastPath: boolean;       // true if confidence > threshold
  extractedEntities: {
    fileName?: string;
    folderName?: string;
    fileType?: string;       // pdf, docx, etc.
    timeRange?: string;      // "recent", "today", "this week"
    limit?: number;          // for list queries
  };
  language: 'en' | 'pt' | 'es';
  processingTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Intent Patterns (Multi-language)
// ═══════════════════════════════════════════════════════════════════════════

const INTENT_PATTERNS: Record<FastPathIntentType, {
  en: RegExp[];
  pt: RegExp[];
  es: RegExp[];
}> = {
  FILE_LIST: {
    en: [
      /^(list|show|display|get)\s+(my\s+)?(all\s+)?(files?|documents?|pdfs?|docs?)/i,
      /^what\s+(files?|documents?)\s+do\s+i\s+have/i,
      /^show\s+me\s+(my\s+)?(files?|documents?)/i,
    ],
    pt: [
      /^(listar?|mostrar?|exibir|ver)\s+(meus?\s+)?(todos?\s+)?(arquivos?|documentos?|pdfs?)/i,
      /^quais?\s+(arquivos?|documentos?)\s+(eu\s+)?tenho/i,
      /^me\s+mostr[ae]\s+(meus?\s+)?(arquivos?|documentos?)/i,
    ],
    es: [
      /^(listar?|mostrar?|ver|enseñar)\s+(mis?\s+)?(todos?\s+)?(archivos?|documentos?|pdfs?)/i,
      /^qué\s+(archivos?|documentos?)\s+tengo/i,
      /^muéstrame\s+(mis?\s+)?(archivos?|documentos?)/i,
    ],
  },
  FILE_COUNT: {
    en: [
      /^how\s+many\s+(files?|documents?|pdfs?)/i,
      /^count\s+(my\s+)?(files?|documents?)/i,
      /^(number|total)\s+of\s+(my\s+)?(files?|documents?)/i,
    ],
    pt: [
      /^quantos?\s+(arquivos?|documentos?|pdfs?)/i,
      /^contar?\s+(meus?\s+)?(arquivos?|documentos?)/i,
      /^(número|total)\s+de\s+(meus?\s+)?(arquivos?|documentos?)/i,
    ],
    es: [
      /^cuántos?\s+(archivos?|documentos?|pdfs?)/i,
      /^contar?\s+(mis?\s+)?(archivos?|documentos?)/i,
      /^(número|total)\s+de\s+(mis?\s+)?(archivos?|documentos?)/i,
    ],
  },
  FOLDER_PATH_QUERY: {
    en: [
      /^where\s+is\s+(the\s+)?(.+?)\s*(folder|directory)/i,
      /^(path|location)\s+(to|of)\s+(the\s+)?(.+?)\s*(folder|directory)?/i,
      /^find\s+(the\s+)?(.+?)\s*(folder|directory)/i,
      /^in\s+which\s+folder\s+is/i,
    ],
    pt: [
      /^onde\s+(está|fica)\s+(a\s+)?pasta\s+(.+)/i,
      /^(caminho|localização)\s+(da|para)\s+(a\s+)?pasta\s+(.+)/i,
      /^encontrar?\s+(a\s+)?pasta\s+(.+)/i,
      /^em\s+qual\s+pasta\s+(está|fica)/i,
    ],
    es: [
      /^dónde\s+está\s+(la\s+)?carpeta\s+(.+)/i,
      /^(ruta|ubicación)\s+(de|a)\s+(la\s+)?carpeta\s+(.+)/i,
      /^encontrar?\s+(la\s+)?carpeta\s+(.+)/i,
      /^en\s+qué\s+carpeta\s+está/i,
    ],
  },
  RECENT_ACTIVITY: {
    en: [
      /^(show|list|get)\s+(my\s+)?recent\s+(files?|documents?|uploads?|activity)/i,
      /^what\s+(did\s+i|have\s+i)\s+(upload|add|create)/i,  // "what did I upload recently"
      /^what.+recently$/i,  // Any "what...recently" pattern
      /^(latest|newest|last)\s+(files?|documents?|uploads?)/i,
      /^recently\s+(uploaded|added|created)\s+(files?|documents?)/i,
    ],
    pt: [
      /^(mostrar?|listar?|ver)\s+(meus?\s+)?(arquivos?|documentos?|uploads?)\s+recentes?/i,
      /^(mostrar?|listar?|ver)\s+(arquivos?|documentos?)\s+recentes?/i,  // Without possessive
      /^o\s+que\s+(eu\s+)?(enviei|adicionei|criei)\s+recentemente/i,
      /^(últimos?|mais\s+recentes?)\s+(arquivos?|documentos?)/i,
      /^(arquivos?|documentos?)\s+recentemente\s+(enviados?|adicionados?)/i,
      /^(arquivos?|documentos?)\s+recentes?/i,  // Simple "arquivos recentes"
    ],
    es: [
      /^(mostrar?|listar?|ver)\s+(mis?\s+)?(archivos?|documentos?)\s+recientes?/i,
      /^qué\s+(subí|agregué|creé)\s+recientemente/i,
      /^(últimos?|más\s+recientes?)\s+(archivos?|documentos?)/i,
      /^(archivos?|documentos?)\s+recientemente\s+(subidos?|agregados?)/i,
    ],
  },
  SIMPLE_FACT: {
    en: [
      /^what\s+is\s+(the\s+)?(\w+)\s+in\s+(.+)/i,
      /^what('s|\s+is)\s+(the\s+)?(value|amount|number|date|name)\s+(of|for)\s+/i,
      /^tell\s+me\s+(the\s+)?(\w+)\s+(from|in)\s+/i,
    ],
    pt: [
      /^(qual|o\s+que)\s+é\s+(o|a)?\s*(\w+)\s+(em|no|na)\s+/i,
      /^qual\s+(é\s+)?(o|a)?\s*(valor|quantidade|número|data|nome)\s+(de|do|da|para)\s+/i,
      /^me\s+diga\s+(o|a)?\s*(\w+)\s+(de|do|da|em|no|na)\s+/i,
    ],
    es: [
      /^(cuál|qué)\s+es\s+(el|la)?\s*(\w+)\s+(en|del?)\s+/i,
      /^cuál\s+(es\s+)?(el|la)?\s*(valor|cantidad|número|fecha|nombre)\s+(de|del|para)\s+/i,
      /^dime\s+(el|la)?\s*(\w+)\s+(de|del|en)\s+/i,
    ],
  },
  METADATA_QUERY: {
    en: [
      /^(what('s|\s+is)|get)\s+(the\s+)?(size|type|format|date|extension)\s+(of|for)\s+/i,
      /^when\s+(was|did)\s+(.+)\s+(uploaded|created|modified|added)/i,
      /^(file\s+)?(size|type|info|information|details?)\s+(of|for|about)\s+/i,
      /^how\s+(big|large)\s+is\s+(the\s+)?(file\s+)?/i,
    ],
    pt: [
      /^(qual|quanto)\s+(é\s+)?(o|a)?\s*(tamanho|tipo|formato|data|extensão)\s+(de|do|da)\s+/i,
      /^quando\s+(foi\s+)?(.+)\s+(enviado|criado|modificado|adicionado)/i,
      /^(tamanho|tipo|info|informação|detalhes?)\s+(do|da|sobre)\s+(arquivo\s+)?/i,
      /^quão\s+(grande|pesado)\s+é\s+(o\s+)?(arquivo\s+)?/i,
    ],
    es: [
      /^(cuál|cuánto)\s+(es\s+)?(el|la)?\s*(tamaño|tipo|formato|fecha|extensión)\s+(de|del)\s+/i,
      /^cuándo\s+(fue\s+)?(.+)\s+(subido|creado|modificado|agregado)/i,
      /^(tamaño|tipo|info|información|detalles?)\s+(del?|sobre)\s+(archivo\s+)?/i,
      /^qué\s+tan\s+(grande|pesado)\s+es\s+(el\s+)?(archivo\s+)?/i,
    ],
  },
  GREETING: {
    en: [
      /^(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings?)(\s+koda)?[!.,]?\s*$/i,
      /^(how\s+are\s+you|what'?s\s+up)(\s+koda)?[!?,]?\s*$/i,
      /^koda[!.,]?\s*$/i,
    ],
    pt: [
      /^(oi|olá|e\s*aí|bom\s+(dia|tarde|noite)|saudações?)(\s+koda)?[!.,]?\s*$/i,
      /^(como\s+(vai|está)\s+(você)?|tudo\s+bem)(\s+koda)?[!?,]?\s*$/i,
      /^koda[!.,]?\s*$/i,
    ],
    es: [
      /^(hola|hey|buenos?\s+(días?|tardes?|noches?)|saludos?)(\s+koda)?[!.,]?\s*$/i,
      /^(cómo\s+estás?|qué\s+tal)(\s+koda)?[!?,]?\s*$/i,
      /^koda[!.,]?\s*$/i,
    ],
  },
  NONE: {
    en: [],
    pt: [],
    es: [],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Entity Extraction Patterns
// ═══════════════════════════════════════════════════════════════════════════

const FILE_TYPE_PATTERNS = {
  en: /\b(pdf|doc|docx|txt|xls|xlsx|ppt|pptx|csv|json|xml|md|html)\b/i,
  pt: /\b(pdf|doc|docx|txt|xls|xlsx|ppt|pptx|csv|json|xml|md|html)\b/i,
  es: /\b(pdf|doc|docx|txt|xls|xlsx|ppt|pptx|csv|json|xml|md|html)\b/i,
};

const TIME_RANGE_PATTERNS = {
  en: {
    recent: /\b(recent|recently|latest|newest|last)\b/i,
    today: /\b(today|today'?s)\b/i,
    thisWeek: /\b(this\s+week|past\s+week|last\s+7\s+days)\b/i,
    thisMonth: /\b(this\s+month|past\s+month|last\s+30\s+days)\b/i,
  },
  pt: {
    recent: /\b(recente|recentemente|último|mais\s+recente)\b/i,
    today: /\b(hoje)\b/i,
    thisWeek: /\b(esta\s+semana|semana\s+passada|últimos\s+7\s+dias)\b/i,
    thisMonth: /\b(este\s+mês|mês\s+passado|últimos\s+30\s+dias)\b/i,
  },
  es: {
    recent: /\b(reciente|recientemente|último|más\s+reciente)\b/i,
    today: /\b(hoy)\b/i,
    thisWeek: /\b(esta\s+semana|semana\s+pasada|últimos\s+7\s+días)\b/i,
    thisMonth: /\b(este\s+mes|mes\s+pasado|últimos\s+30\s+días)\b/i,
  },
};

const LIMIT_PATTERNS = {
  en: /\b(first|top|last)\s+(\d+)\b|\b(\d+)\s+(files?|documents?)\b/i,
  pt: /\b(primeiros?|últimos?|top)\s+(\d+)\b|\b(\d+)\s+(arquivos?|documentos?)\b/i,
  es: /\b(primeros?|últimos?|top)\s+(\d+)\b|\b(\d+)\s+(archivos?|documentos?)\b/i,
};

// ═══════════════════════════════════════════════════════════════════════════
// Language Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect language from query - uses centralized language engine
 * @deprecated Use detectLanguageSimple directly from languageEngine.service.ts
 */
function detectLanguage(query: string): 'en' | 'pt' | 'es' {
  const detected = detectLanguageSimple(query, 'pt-BR');
  // Map SupportedLanguage to legacy format
  if (detected === 'pt-BR') return 'pt';
  if (detected === 'es') return 'es';
  return 'en';
}

// ═══════════════════════════════════════════════════════════════════════════
// Entity Extraction
// ═══════════════════════════════════════════════════════════════════════════

function extractEntities(
  query: string,
  intent: FastPathIntentType,
  language: 'en' | 'pt' | 'es'
): FastPathClassification['extractedEntities'] {
  const entities: FastPathClassification['extractedEntities'] = {};

  // Extract file type
  const fileTypeMatch = query.match(FILE_TYPE_PATTERNS[language]);
  if (fileTypeMatch) {
    entities.fileType = fileTypeMatch[1].toLowerCase();
  }

  // Extract time range
  const timePatterns = TIME_RANGE_PATTERNS[language];
  if (timePatterns.today.test(query)) {
    entities.timeRange = 'today';
  } else if (timePatterns.thisWeek.test(query)) {
    entities.timeRange = 'this_week';
  } else if (timePatterns.thisMonth.test(query)) {
    entities.timeRange = 'this_month';
  } else if (timePatterns.recent.test(query)) {
    entities.timeRange = 'recent';
  }

  // Extract limit
  const limitMatch = query.match(LIMIT_PATTERNS[language]);
  if (limitMatch) {
    const num = limitMatch[2] || limitMatch[3];
    if (num) {
      entities.limit = parseInt(num, 10);
    }
  }

  // Extract folder name for FOLDER_PATH_QUERY
  if (intent === 'FOLDER_PATH_QUERY') {
    const folderPatterns = {
      en: /(?:folder|directory)\s+(?:called\s+)?["']?([^"']+?)["']?(?:\s|$)/i,
      pt: /pasta\s+(?:chamada\s+)?["']?([^"']+?)["']?(?:\s|$)/i,
      es: /carpeta\s+(?:llamada\s+)?["']?([^"']+?)["']?(?:\s|$)/i,
    };
    const folderMatch = query.match(folderPatterns[language]);
    if (folderMatch) {
      entities.folderName = folderMatch[1].trim();
    }
  }

  // Extract file name for METADATA_QUERY
  if (intent === 'METADATA_QUERY' || intent === 'SIMPLE_FACT') {
    // Look for quoted file names first
    const quotedMatch = query.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      entities.fileName = quotedMatch[1];
    } else {
      // Look for file with extension
      const fileMatch = query.match(/\b(\w+\.(?:pdf|doc|docx|txt|xlsx?|pptx?|csv))\b/i);
      if (fileMatch) {
        entities.fileName = fileMatch[1];
      }
    }
  }

  return entities;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Classification Function
// ═══════════════════════════════════════════════════════════════════════════

const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Classify a query to determine if it can use fast-path processing
 */
export function classifyFastPathIntent(query: string): FastPathClassification {
  const startTime = Date.now();
  const normalizedQuery = query.trim();
  const language = detectLanguage(normalizedQuery);

  let bestIntent: FastPathIntentType = 'NONE';
  let bestConfidence = 0;

  // Check each intent type (order matters for ambiguous queries!)
  // RECENT_ACTIVITY must come before FILE_LIST so "arquivos recentes" matches RECENT_ACTIVITY
  const intentTypes: FastPathIntentType[] = [
    'GREETING',        // Check first (simplest)
    'RECENT_ACTIVITY', // Check before FILE_LIST (recentes/recent takes priority)
    'FILE_COUNT',
    'FOLDER_PATH_QUERY',
    'METADATA_QUERY',
    'FILE_LIST',       // Check after RECENT_ACTIVITY
    'SIMPLE_FACT',
  ];

  for (const intentType of intentTypes) {
    const patterns = INTENT_PATTERNS[intentType];

    // Check patterns for ALL languages (robustness)
    for (const lang of ['en', 'pt', 'es'] as const) {
      for (const pattern of patterns[lang]) {
        if (pattern.test(normalizedQuery)) {
          // Base confidence from pattern match
          let confidence = 0.8;

          // Boost confidence if language matches detected language
          if (lang === language) {
            confidence += 0.1;
          }

          // Boost confidence for exact/simple matches
          if (normalizedQuery.split(/\s+/).length <= 5) {
            confidence += 0.05;
          }

          // Cap at 0.95
          confidence = Math.min(confidence, 0.95);

          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestIntent = intentType;
          }
        }
      }
    }
  }

  // Extract entities based on detected intent
  const extractedEntities = extractEntities(normalizedQuery, bestIntent, language);

  const processingTimeMs = Date.now() - startTime;

  return {
    intent: bestIntent,
    confidence: bestConfidence,
    isFastPath: bestIntent !== 'NONE' && bestConfidence >= CONFIDENCE_THRESHOLD,
    extractedEntities,
    language,
    processingTimeMs,
  };
}

/**
 * Quick check if a query might be fast-path eligible (for early filtering)
 */
export function mightBeFastPath(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  // Quick pattern checks without full classification
  const quickPatterns = [
    /^(list|show|display|get|count|how many)\b/,
    /^(where|path|location|find)\b.*folder/,
    /^(recent|latest|newest|last)\b/,
    /^(hi|hello|hey|good|oi|olá|hola)\b/,
    /^what('s|\s+is)\s+(the\s+)?(size|type|format)/,
    /\b(files?|documents?|arquivos?|documentos?|archivos?)\s*$/,
  ];

  return quickPatterns.some(p => p.test(normalizedQuery));
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export default {
  classifyFastPathIntent,
  mightBeFastPath,
  CONFIDENCE_THRESHOLD,
};
