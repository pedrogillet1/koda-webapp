/**
 * ============================================================================
 * ENHANCED SIMPLE INTENT DETECTION SERVICE
 * ============================================================================
 *
 * Central brain to classify user queries into intents + RAG mode.
 *
 * Performance: < 10ms (pattern matching)
 *
 * Features:
 * - 10 intent types (meta, greeting, simple_factual, medium, medium_specific,
 *   complex_analysis, complex_multidoc, comparison, list, followup)
 * - 3 RAG modes (no_rag, light_rag, full_rag)
 * - Temporal expression detection (dates, times, ranges)
 * - Multi-language support (PT, EN, ES, FR)
 * - Document reference detection
 * - Multi-doc vs single-doc detection
 *
 * @version 2.0.0
 * @date 2024-12-10
 */

// ============================================================================
// TYPES
// ============================================================================

export type RagMode = 'no_rag' | 'light_rag' | 'full_rag';

export type QuestionType =
  | 'meta'              // "who are you", "what can you do", system questions
  | 'greeting'          // hi/hello/oi/olá, thanks, farewell
  | 'simple_factual'    // short, direct question, not obviously multi-doc
  | 'medium'            // normal question with some detail
  | 'medium_specific'   // references ONE document or specific section
  | 'complex_analysis'  // "analyze / explain / detailed / breakdown" style
  | 'complex_multidoc'  // "compare X and Y", "all documents"
  | 'comparison'        // "difference between", "vs", "better than"
  | 'list'              // "list / enumerate / give me X items"
  | 'followup';         // contextual follow-ups: "and what about..."

export interface ClassifiedQuestion {
  type: QuestionType;
  ragMode: RagMode;
  hasTemporalExpression: boolean;
  confidence: number;
  detectionTimeMs: number;
  // Optional: can be extended with detectedDocs, detectedEntities, etc.
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function matchesAnyRegex(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

// ============================================================================
// TEMPORAL DETECTION (time/date, ranges, relative expressions)
// ============================================================================

const DATE_KEYWORDS = [
  // Portuguese
  'hoje',
  'ontem',
  'amanha',
  'amanhã',
  'depois de amanha',
  'semana passada',
  'proxima semana',
  'próxima semana',
  'mes passado',
  'mês passado',
  'proximo mes',
  'próximo mês',
  'ano passado',
  'este ano',
  'no ano que vem',
  'trimestre',
  'semestre',
  'fim de semana',
  'fim-de-semana',
  'feriado',
  // English
  'today',
  'yesterday',
  'tomorrow',
  'day after tomorrow',
  'last week',
  'next week',
  'last month',
  'next month',
  'last year',
  'this year',
  'this month',
  'this week',
  'quarter',
  'semester',
  'weekend',
];

const DATE_UNITS = [
  'dia',
  'dias',
  'semana',
  'semanas',
  'mes',
  'mês',
  'meses',
  'ano',
  'anos',
  'day',
  'days',
  'week',
  'weeks',
  'month',
  'months',
  'year',
  'years',
];

const DATE_VERBS = [
  'em',
  'daqui a',
  'ha',
  'há',
  'faz',
  'desde',
  'ate',
  'até',
  'antes de',
  'depois de',
  'apartir de',
  'a partir de',
  'ago',
  'in',
  'since',
  'until',
  'before',
  'after',
  'from',
];

const MONTH_NAMES = [
  // PT
  'janeiro',
  'fevereiro',
  'marco',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
  // EN
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

// Regexes for explicit dates/times
const DATE_REGEXES: RegExp[] = [
  // 10/12/2024, 10-12-2024, 2024-12-10 etc.
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
  /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
  // 10 de dezembro de 2024
  /\b\d{1,2}\s+de\s+[a-zçãé]+\s+de\s+\d{4}\b/,
  // "15:30", "08:00", "23h", "23:59h"
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{1,2}h\b/,
  /\b\d{1,2}:\d{2}h\b/,
  // "in 3 days", "há 2 dias"
  /\b(?:ha|há|in)\s+\d{1,3}\s+(?:dias?|semanas?|meses?|months?|weeks?|years?|anos?)\b/,
];

export function detectTemporalExpression(raw: string): boolean {
  const text = normalize(raw);

  if (matchesAnyRegex(text, DATE_REGEXES)) return true;
  if (containsAny(text, DATE_KEYWORDS)) return true;

  // expressions like "em 3 dias", "daqui 2 semanas"
  const relativePattern =
    /\b(?:em|daqui a|daqui|in)\s+\d{1,3}\s+(?:dia|dias|semana|semanas|mes|mês|meses|month|months|week|weeks|year|years|ano|anos)\b/;
  if (relativePattern.test(text)) return true;

  if (containsAny(text, MONTH_NAMES) && containsAny(text, DATE_VERBS)) {
    return true;
  }

  return false;
}

// ============================================================================
// INTENT PATTERN DEFINITIONS
// ============================================================================

const GREETING_KEYWORDS = [
  'oi',
  'ola',
  'olá',
  'eai',
  'e aí',
  'hey',
  'hi',
  'hello',
  'yo',
  'bom dia',
  'boa tarde',
  'boa noite',
  'tudo bem',
  'como vai',
  'como voce esta',
  'como você está',
  'como vc ta',
  'como vc tá',
];

const THANKS_KEYWORDS = [
  'obrigado',
  'obrigada',
  'valeu',
  'thanks',
  'thank you',
  'thx',
  'agradeco',
  'agradeço',
];

const GOODBYE_KEYWORDS = [
  'tchau',
  'até mais',
  'ate mais',
  'falou',
  'see you',
  'bye',
];

const META_KEYWORDS = [
  'quem e voce',
  'quem é voce',
  'quem voce e',
  'quem é você',
  'quem e vc',
  'quem é vc',
  'o que voce faz',
  'o que você faz',
  'o que voce pode fazer',
  'como voce funciona',
  'como você funciona',
  'como vc funciona',
  'como voce trabalha',
  'o que e koda',
  'o que é koda',
  'sobre koda',
  'what can you do',
  'who are you',
  'what are you',
  'how do you work',
  'how do you function',
  'what is koda',
  'what data do you see',
  'what documents do you have',
  'which docs are uploaded',
  'what files have i uploaded',
  'system prompt',
  'context window',
  'tokens per second',
  'tokens/sec',
  'latencia',
  'latência',
  'latency',
  'why are you slow',
  'why so slow',
  'speed test',
  'embedding model',
  'rag pipeline',
];

const PING_KEYWORDS = [
  'ping',
  'ta ai',
  'tá aí',
  'ta la',
  'está ai',
  'esta ai',
  'are you there',
  'are you online',
  'still there',
  'online?',
];

const DOC_REFERENCE_KEYWORDS = [
  'documento',
  'documentos',
  'arquivo',
  'arquivos',
  'contrato',
  'pdf',
  'docx',
  'pasta',
  'file',
  'files',
  'folder',
  'folders',
  'google drive',
  'upload',
  'uploaded',
  'meus documentos',
  'minhas notas',
];

const ANALYSIS_KEYWORDS = [
  'analisa',
  'analise',
  'análise',
  'analyze',
  'analysis',
  'explica',
  'explique',
  'explain',
  'detalhe',
  'detalhado',
  'detailed',
  'aprofundado',
  'deep',
  'critico',
  'crítico',
  'critically',
  'interpret',
  'interpretar',
  'resuma',
  'resumir',
  'resumo',
  'summarize',
  'summary',
  'sintetize',
  'sintetiza',
];

const COMPARISON_KEYWORDS = [
  'diferenca entre',
  'diferença entre',
  'comparar',
  'compare',
  'comparacao',
  'comparação',
  'vs',
  'versus',
  'melhor que',
  'pior que',
  'better than',
  'worse than',
  'difference between',
  'compare x and y',
];

const LIST_KEYWORDS = [
  'lista',
  'listar',
  'enumerar',
  'enumere',
  'bullets',
  'bullet points',
  'top 10',
  'top 5',
  'me de',
  'me dê',
  'me da',
  'me dá',
  'give me a list',
  'list the',
  'show all',
  'show me all',
];

const FOLLOWUP_KEYWORDS = [
  'e sobre',
  'e nesse caso',
  'e nesse contexto',
  'e quanto a',
  'e quanto ao',
  'o que mais',
  'mais detalhes',
  'pode detalhar',
  'can you elaborate',
  'what about this',
  'and what about',
  'and regarding',
  'and in this case',
  'can you go deeper',
];

const SPECIFIC_DOC_PATTERNS: RegExp[] = [
  // mentions file extensions explicitly
  /\b[\w\-\s]+\.(pdf|docx|xlsx|pptx|txt)\b/,
  // "no contrato x", "no documento x"
  /\bno contrato\b/,
  /\bno documento\b/,
  /\bnesse documento\b/,
  /\bnesse contrato\b/,
];

const MULTIDOC_HINT_PATTERNS: RegExp[] = [
  // "todos os documentos", "todos os arquivos", "all documents"
  /\btodos os documentos\b/,
  /\btodos os arquivos\b/,
  /\btodos os contratos\b/,
  /\ball (my )?(documents|files|contracts)\b/,
];

const QUESTION_MARK_REGEX = /\?/;

// Heuristic: very short queries (1–3 words) are often simple factual or meta/greeting.
function isVeryShort(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 3;
}

// ============================================================================
// MAIN CLASSIFIER
// ============================================================================

export function classifyQuestion(raw: string): ClassifiedQuestion {
  const startTime = Date.now();
  const text = normalize(raw);
  const hasTemporal = detectTemporalExpression(text);

  // 1) GREETING / THANKS / GOODBYE / PING -> greeting + no_rag
  if (
    containsAny(text, GREETING_KEYWORDS) ||
    containsAny(text, THANKS_KEYWORDS) ||
    containsAny(text, GOODBYE_KEYWORDS) ||
    containsAny(text, PING_KEYWORDS)
  ) {
    return {
      type: 'greeting',
      ragMode: 'no_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.99,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 2) META / SYSTEM / ABOUT KODA -> meta + no_rag
  if (containsAny(text, META_KEYWORDS)) {
    return {
      type: 'meta',
      ragMode: 'no_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.98,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 3) FOLLOW-UP cues -> followup + light/full rag depending on doc presence
  if (containsAny(text, FOLLOWUP_KEYWORDS)) {
    // Assume we usually want light RAG but if multi-doc terms appear, use full
    const hasMultiDocHints =
      matchesAnyRegex(text, MULTIDOC_HINT_PATTERNS) ||
      containsAny(text, ['todos os', 'all documents', 'all files']);
    return {
      type: 'followup',
      ragMode: hasMultiDocHints ? 'full_rag' : 'light_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.90,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 4) COMPARISON
  if (containsAny(text, COMPARISON_KEYWORDS)) {
    const hasMultiDocHints =
      matchesAnyRegex(text, MULTIDOC_HINT_PATTERNS) ||
      containsAny(text, ['entre os documentos', 'between the documents']);

    return {
      type: 'comparison',
      ragMode: hasMultiDocHints ? 'full_rag' : 'light_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.95,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 5) LIST queries
  if (containsAny(text, LIST_KEYWORDS)) {
    // Usually needs at least light RAG; full if multi-doc hints
    const hasMultiDocHints =
      matchesAnyRegex(text, MULTIDOC_HINT_PATTERNS) ||
      containsAny(text, ['em todos os documentos', 'em todos arquivos']);
    return {
      type: 'list',
      ragMode: hasMultiDocHints ? 'full_rag' : 'light_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.92,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 6) COMPLEX ANALYSIS / MULTI-DOC / DEEP reasoning
  const hasAnalysis = containsAny(text, ANALYSIS_KEYWORDS);
  const hasDocWords = containsAny(text, DOC_REFERENCE_KEYWORDS);
  const mentionsSpecificFile = matchesAnyRegex(text, SPECIFIC_DOC_PATTERNS);
  const hasMultiDocHints =
    matchesAnyRegex(text, MULTIDOC_HINT_PATTERNS) ||
    containsAny(text, ['varios documentos', 'vários documentos', 'multiple documents']);

  if (hasAnalysis && hasDocWords && hasMultiDocHints) {
    // Complex + multi-doc
    return {
      type: 'complex_multidoc',
      ragMode: 'full_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.93,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  if (hasAnalysis && hasDocWords) {
    // Deep analysis but mostly one doc
    return {
      type: 'complex_analysis',
      ragMode: 'full_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.91,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 7) SPECIFIC DOC (single doc, not necessarily complex)
  if (mentionsSpecificFile || (hasDocWords && containsAny(text, ['nesse', 'neste', 'in this document']))) {
    // More targeted questions about a specific file
    const intenseLanguage = containsAny(text, ['detalhado', 'detailed', 'analise', 'analysis']);
    return {
      type: 'medium_specific',
      ragMode: intenseLanguage ? 'full_rag' : 'light_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.88,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 8) PURE TIME/DATE QUESTIONS (like "que dia é hoje?", "what day is it?")
  if (
    hasTemporal &&
    containsAny(text, [
      'que dia e hoje',
      'que dia é hoje',
      'que data e hoje',
      'que data é hoje',
      'que dia eh hoje',
      'que dia ta',
      'que dia estamos',
      'what is the date today',
      'what day is it',
      'what day is today',
    ])
  ) {
    // These are meta/time questions, no RAG needed
    return {
      type: 'simple_factual',
      ragMode: 'no_rag',
      hasTemporalExpression: true,
      confidence: 0.95,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 9) GENERAL SIMPLE FACTUAL (short, with ? or WH-word)
  const hasQuestionMark = QUESTION_MARK_REGEX.test(text);
  const whWords = [
    'o que',
    'o que e',
    'o que é',
    'quem',
    'onde',
    'quando',
    'por que',
    'porque',
    'qual',
    'quais',
    'how',
    'what',
    'where',
    'when',
    'why',
    'which',
  ];

  const hasWhWord = containsAny(text, whWords);

  if (isVeryShort(text) && (hasQuestionMark || hasWhWord) && !hasDocWords) {
    // e.g. "what is entropy?", "quando vence?"
    return {
      type: 'simple_factual',
      ragMode: 'no_rag',
      hasTemporalExpression: hasTemporal,
      confidence: 0.85,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 10) MEDIUM & OTHER DOC-RELATED QUERIES
  if (hasDocWords) {
    // If doc words present but not strongly complex, treat as medium
    const ragMode: RagMode = hasTemporal ? 'full_rag' : 'light_rag';
    return {
      type: 'medium',
      ragMode,
      hasTemporalExpression: hasTemporal,
      confidence: 0.80,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // 11) Default: medium with light_rag or no_rag depending on temporal & length

  if (hasTemporal) {
    // Often date + some other condition => likely needs doc context (deadlines, contract dates)
    return {
      type: 'medium',
      ragMode: 'light_rag',
      hasTemporalExpression: true,
      confidence: 0.75,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  // Generic medium ask, no explicit doc words
  return {
    type: 'medium',
    ragMode: 'no_rag',
    hasTemporalExpression: hasTemporal,
    confidence: 0.70,
    detectionTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// BACKWARD COMPATIBILITY WITH EXISTING SIMPLE INTENT DETECTION
// ============================================================================

// Map new types to old types for backward compatibility
export type SimpleIntentType =
  | 'greeting'
  | 'capability'
  | 'data'
  | 'explanation'
  | 'comparison'
  | 'file_action'
  | 'list_folders'
  | 'metadata'
  | 'general';

export type FileActionType =
  | 'create_folder'
  | 'move_file'
  | 'rename'
  | 'delete'
  | null;

export interface SimpleIntentResult {
  type: SimpleIntentType;
  needsDocuments: boolean;
  confidence: number;
  fileAction?: FileActionType;
  extractedValue?: string;
  detectionTimeMs: number;
  // Enhanced fields
  questionType?: QuestionType;
  ragMode?: RagMode;
  hasTemporalExpression?: boolean;
}

// ============================================================================
// FILE ACTION DETECTION (from original service)
// ============================================================================

interface FileActionResult {
  action: FileActionType;
  confidence: number;
  extractedValue?: string;
}

function detectFileAction(lowerQuery: string, originalQuery: string): FileActionResult {
  // CREATE FOLDER patterns
  const createFolderPatterns = [
    /(?:create|make|new|criar|fazer|crear|nueva?)\s+(?:a\s+)?(?:folder|pasta|carpeta)\s+(?:named|called|chamad[ao]|llamad[ao])?\s*["']?([^"'\n]+)["']?/i,
    /(?:create|make|new|criar|fazer|crear|nueva?)\s+(?:a\s+)?(?:folder|pasta|carpeta)/i,
  ];

  for (const pattern of createFolderPatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      return {
        action: 'create_folder',
        confidence: 0.95,
        extractedValue: match[1]?.trim() || undefined
      };
    }
  }

  // MOVE FILE patterns
  if (/move\s+.+\s+to\s+|mover\s+.+\s+para\s+/i.test(originalQuery)) {
    return { action: 'move_file', confidence: 0.90 };
  }

  // RENAME patterns
  if (/rename\s+|renomear\s+|renombrar\s+/i.test(originalQuery)) {
    return { action: 'rename', confidence: 0.90 };
  }

  // DELETE patterns
  const deletePatterns = [
    /(?:delete|remove|trash|erase)\s+(?:the\s+)?(?:file|folder|document)\s+["']?([^"'\n]+)["']?/i,
    /(?:delete|remove|trash|erase)\s+["']?([^"'\s]+\.[a-z]{2,4})["']?/i,
    /(?:apagar|excluir|remover|deletar)\s+(?:o\s+)?(?:arquivo|documento|pasta)?\s*["']?([^"'\n]+)["']?/i,
    /(?:eliminar|borrar|quitar)\s+(?:el\s+)?(?:archivo|documento|carpeta)?\s*["']?([^"'\n]+)["']?/i,
  ];

  for (const pattern of deletePatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      return {
        action: 'delete',
        confidence: 0.90,
        extractedValue: match[1]?.trim() || undefined
      };
    }
  }

  return { action: null, confidence: 0 };
}

// ============================================================================
// FOLDER LISTING DETECTION
// ============================================================================

function isFolderListingQuery(lowerQuery: string): boolean {
  const folderListingPatterns = [
    /which\s+folders\s+(?:do\s+i\s+have|are\s+there)/i,
    /what\s+folders\s+(?:do\s+i\s+have|are\s+there|exist)/i,
    /list\s+(?:all\s+)?(?:my\s+)?folders/i,
    /show\s+me\s+(?:all\s+)?(?:my\s+)?folders/i,
    /how\s+many\s+folders/i,
    /folders\s+(?:do\s+i\s+have|i\s+have)/i,
    /quais\s+pastas/i,
    /(?:mostre|liste)\s+(?:as\s+)?(?:minhas\s+)?pastas/i,
    /quantas\s+pastas/i,
    /qu[eé]\s+carpetas/i,
    /(?:muestra|lista)\s+(?:las\s+)?(?:mis\s+)?carpetas/i,
    /cu[aá]ntas\s+carpetas/i,
  ];

  return folderListingPatterns.some(p => p.test(lowerQuery));
}

// ============================================================================
// METADATA QUERY DETECTION
// ============================================================================

interface MetadataResult {
  isMetadata: boolean;
  confidence: number;
  extractedValue?: string;
}

function detectMetadataQuery(lowerQuery: string, originalQuery: string): MetadataResult {
  // Content analysis exclusions
  const contentAnalysisExclusions = [
    /what\s+(?:are|is)\s+(?:the\s+)?(main|key|primary|important|significant|top|major)\s+\w+/i,
    /what\s+(?:are|is)\s+(?:the\s+)?(topics?|subjects?|themes?|issues?|points?|findings?|conclusions?|recommendations?|risks?|benefits?|advantages?|disadvantages?|goals?|objectives?)/i,
    /\b(discussed|mentioned|covered|addressed|described|explained|presented|analyzed|summarized)\s+(?:in|by)\s+/i,
    /\b(topics?|subjects?|themes?|content|information|data|details)\s+(?:discussed|mentioned|covered|in)\b/i,
    /\b(tell\s+me\s+about|explain|summarize|analyze|describe)\s+(?:the\s+)?(?:content|topics?|main\s+points?)/i,
    /(?:quais|qual)\s+(?:são|é)\s+(?:os?|as?)?\s*(principais|importantes|tópicos?|assuntos?|temas?)/i,
    /\b(discutido|mencionado|abordado|apresentado)\s+(?:nos?|em)\s+/i,
    /(?:cuáles?|qué)\s+(?:son|es)\s+(?:los?|las?)?\s*(principales|importantes|temas?|asuntos?)/i,
    /\b(discutido|mencionado|abordado|presentado)\s+(?:en)\s+/i,
  ];

  if (contentAnalysisExclusions.some(p => p.test(originalQuery))) {
    return { isMetadata: false, confidence: 0 };
  }

  // FILE LOCATION patterns
  const locationPatterns = [
    /where\s+is\s+(.+)/i,
    /where\s+can\s+i\s+find\s+(.+)/i,
    /location\s+of\s+(.+)/i,
    /find\s+(.+)\s+file/i,
    /which\s+folder\s+(?:has|contains)\s+(.+)/i,
    /onde\s+(?:está|fica)\s+(.+)/i,
    /d[oó]nde\s+est[aá]\s+(.+)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      let extracted = match[1].trim()
        .replace(/^(?:the|a|an|o|a|el|la)\s+/i, '')
        .replace(/\s+(?:file|document|pdf|docx|xlsx|pptx|arquivo|documento)$/i, '');
      return { isMetadata: true, confidence: 0.95, extractedValue: extracted };
    }
  }

  // FILE COUNT patterns
  const countPatterns = [
    /how\s+many\s+(files|documents)\s*(?:do\s+i\s+have)?/i,
    /(file|document)\s+count/i,
    /total\s+(?:number\s+of\s+)?(files|documents)/i,
    /number\s+of\s+(files|documents)/i,
    /count\s+(?:my\s+)?(files|documents)/i,
    /quantos\s+(arquivos|documentos|ficheiros)\s*(?:tenho|eu\s+tenho)?/i,
    /(?:qual|quantos)\s+(?:é\s+)?(?:o\s+)?(?:número|total)\s+(?:de\s+)?(arquivos|documentos)/i,
    /cu[aá]ntos\s+(archivos|documentos)\s*(?:tengo)?/i,
    /(?:cu[aá]l|cu[aá]ntos)\s+(?:es\s+)?(?:el\s+)?(?:n[uú]mero|total)\s+(?:de\s+)?(archivos|documentos)/i,
    /combien\s+(?:de\s+)?(fichiers|documents)/i,
    /wie\s+viele\s+(dateien|dokumente)/i,
  ];

  if (countPatterns.some(p => p.test(originalQuery))) {
    return { isMetadata: true, confidence: 0.95 };
  }

  // LIST ALL FILES patterns
  const listAllPatterns = [
    /show\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(files|documents)/i,
    /list\s+(?:all\s+)?(?:my\s+)?(files|documents)/i,
    /what\s+(?:are\s+)?(?:my\s+)?(files|documents)/i,
    /what\s+files\s+do\s+i\s+have/i,
    /what\s+documents\s+do\s+i\s+have/i,
    /(?:show|display|view|get)\s+(?:my\s+)?(files|documents)/i,
    /my\s+(files|documents)/i,
    /mostr[ae]\s+(?:todos\s+)?(?:os\s+)?(?:meus\s+)?(arquivos|documentos|ficheiros)/i,
    /list[ae]\s+(?:todos\s+)?(?:os\s+)?(?:meus\s+)?(arquivos|documentos|ficheiros)/i,
    /(?:quais|que)\s+(?:são\s+)?(?:os\s+)?(?:meus\s+)?(arquivos|documentos)/i,
    /(?:ver|exibir)\s+(?:os\s+)?(?:meus\s+)?(arquivos|documentos|ficheiros)/i,
    /meus\s+(arquivos|documentos|ficheiros)/i,
    /mu[eé]str[ae](?:me)?\s+(?:todos\s+)?(?:los\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /list[ae]\s+(?:todos\s+)?(?:los\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /(?:cu[aá]les|qu[eé])\s+(?:son\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /(?:ver|mostrar)\s+(?:los\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /mis\s+(archivos|documentos)/i,
    /montr[ez]\s+(?:tous\s+)?(?:mes\s+)?(fichiers|documents)/i,
    /(?:quels|mes)\s+(fichiers|documents)/i,
    /zeig[et]?\s+(?:mir\s+)?(?:alle\s+)?(?:meine\s+)?(dateien|dokumente)/i,
    /(?:meine|welche)\s+(dateien|dokumente)/i,
  ];

  if (listAllPatterns.some(p => p.test(originalQuery))) {
    return { isMetadata: true, confidence: 0.90 };
  }

  return { isMetadata: false, confidence: 0 };
}

// ============================================================================
// MAIN DETECTION FUNCTION (BACKWARD COMPATIBLE)
// ============================================================================

/**
 * Main entry point for intent detection.
 * Backward compatible with existing code while using enhanced classification.
 */
export function detectIntent(query: string): SimpleIntentResult {
  const startTime = Date.now();
  const lowerQuery = query.toLowerCase().trim();

  // First, check for file actions (highest priority for these patterns)
  const fileAction = detectFileAction(lowerQuery, query);
  if (fileAction.action) {
    return {
      type: 'file_action',
      needsDocuments: false,
      confidence: fileAction.confidence,
      fileAction: fileAction.action,
      extractedValue: fileAction.extractedValue,
      detectionTimeMs: Date.now() - startTime
    };
  }

  // Check folder listing
  if (isFolderListingQuery(lowerQuery)) {
    return {
      type: 'list_folders',
      needsDocuments: false,
      confidence: 0.95,
      detectionTimeMs: Date.now() - startTime
    };
  }

  // Check metadata queries
  const metadata = detectMetadataQuery(lowerQuery, query);
  if (metadata.isMetadata) {
    return {
      type: 'metadata',
      needsDocuments: false,
      confidence: metadata.confidence,
      extractedValue: metadata.extractedValue,
      detectionTimeMs: Date.now() - startTime
    };
  }

  // Use enhanced classification
  const classification = classifyQuestion(query);

  // Map new types to old types
  let oldType: SimpleIntentType;
  let needsDocuments: boolean;

  switch (classification.type) {
    case 'greeting':
      oldType = 'greeting';
      needsDocuments = false;
      break;

    case 'meta':
      oldType = 'capability';
      needsDocuments = false;
      break;

    case 'comparison':
      oldType = 'comparison';
      needsDocuments = classification.ragMode !== 'no_rag';
      break;

    case 'list':
      oldType = 'data';
      needsDocuments = classification.ragMode !== 'no_rag';
      break;

    case 'simple_factual':
      oldType = 'data';
      needsDocuments = classification.ragMode !== 'no_rag';
      break;

    case 'complex_analysis':
    case 'complex_multidoc':
      oldType = 'explanation';
      needsDocuments = true;
      break;

    case 'medium':
    case 'medium_specific':
      oldType = 'data';
      needsDocuments = classification.ragMode !== 'no_rag';
      break;

    case 'followup':
      oldType = 'general';
      needsDocuments = classification.ragMode !== 'no_rag';
      break;

    default:
      oldType = 'general';
      needsDocuments = true;
  }

  return {
    type: oldType,
    needsDocuments,
    confidence: classification.confidence,
    detectionTimeMs: classification.detectionTimeMs,
    // Enhanced fields
    questionType: classification.type,
    ragMode: classification.ragMode,
    hasTemporalExpression: classification.hasTemporalExpression,
  };
}

// ============================================================================
// RAG MODE UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the number of chunks to retrieve based on RAG mode
 */
export function getChunkCountForRagMode(ragMode: RagMode): number {
  switch (ragMode) {
    case 'no_rag':
      return 0;
    case 'light_rag':
      return 3; // 1-3 chunks for light queries
    case 'full_rag':
      return 15; // 10-20 chunks for complex queries
    default:
      return 5; // Default
  }
}

/**
 * Check if query should skip RAG entirely
 */
export function shouldSkipRag(result: SimpleIntentResult): boolean {
  return result.ragMode === 'no_rag' || !result.needsDocuments;
}

/**
 * Check if query needs full context retrieval
 */
export function needsFullContext(result: SimpleIntentResult): boolean {
  return result.ragMode === 'full_rag';
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Intent enum for backwards compatibility
 */
export const Intent = {
  // RAG Queries
  SUMMARIZE_DOCUMENT: 'SUMMARIZE_DOCUMENT',
  SEARCH_CONTENT: 'SEARCH_CONTENT',
  EXTRACT_TABLES: 'EXTRACT_TABLES',
  COMPARE_DOCUMENTS: 'COMPARE_DOCUMENTS',
  ANALYZE_DOCUMENT: 'ANALYZE_DOCUMENT',
  READ_EXCEL_CELL: 'READ_EXCEL_CELL',

  // Metadata/Navigation
  DESCRIBE_FOLDER: 'DESCRIBE_FOLDER',
  LIST_DOCUMENTS: 'LIST_DOCUMENTS',
  LIST_FILES: 'list_files',
  FIND_FILE: 'FIND_FILE',
  FIND_DOCUMENT_LOCATION: 'FIND_DOCUMENT_LOCATION',
  FIND_DUPLICATES: 'FIND_DUPLICATES',

  // File Actions
  CREATE_FOLDER: 'CREATE_FOLDER',
  RENAME_FOLDER: 'RENAME_FOLDER',
  MOVE_FILE: 'MOVE_FILE',
  MOVE_FILES: 'MOVE_FILES',
  RENAME_FILE: 'RENAME_FILE',
  DELETE_FILE: 'DELETE_FILE',

  // Conversations
  GREETING: 'GREETING',
  CAPABILITY: 'CAPABILITY',
  GENERAL: 'GENERAL',

  // Folder Actions
  LIST_FOLDERS: 'list_folders',

  // Legacy
  RAG_QUERY: 'rag_query',
  METADATA_QUERY: 'metadata_query',
} as const;

export type IntentType = typeof Intent[keyof typeof Intent];

/**
 * Maps to legacy Intent type for backwards compatibility
 */
export function toLegacyIntent(result: SimpleIntentResult): {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  entities: Record<string, any>;
} {
  const intentMap: Record<SimpleIntentType, string> = {
    greeting: Intent.GREETING,
    capability: Intent.CAPABILITY,
    data: Intent.RAG_QUERY,
    explanation: Intent.RAG_QUERY,
    comparison: Intent.COMPARE_DOCUMENTS,
    file_action: result.fileAction || Intent.RAG_QUERY,
    list_folders: Intent.LIST_FOLDERS,
    metadata: Intent.LIST_FILES,
    general: Intent.RAG_QUERY
  };

  const parameters: Record<string, any> = {};
  if (result.extractedValue) {
    parameters.value = result.extractedValue;
    if (result.type === 'metadata') {
      parameters.fileType = result.extractedValue;
    }
  }

  // Add enhanced parameters
  if (result.ragMode) {
    parameters.ragMode = result.ragMode;
  }
  if (result.questionType) {
    parameters.questionType = result.questionType;
  }
  if (result.hasTemporalExpression) {
    parameters.hasTemporal = result.hasTemporalExpression;
  }

  return {
    intent: intentMap[result.type],
    confidence: result.confidence,
    parameters,
    entities: result.extractedValue ? { documentName: result.extractedValue } : {}
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  detectIntent,
  classifyQuestion,
  detectTemporalExpression,
  toLegacyIntent,
  getChunkCountForRagMode,
  shouldSkipRag,
  needsFullContext,
};
