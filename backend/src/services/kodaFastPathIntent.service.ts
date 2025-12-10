/**
 * Koda Fast-Path Intent Service
 *
 * Classifies queries to determine if they can be handled via fast-path
 * (direct data retrieval + micro-prompt) instead of full RAG pipeline.
 *
 * Fast-path targets: <1.5s response time
 * Full RAG targets: 2-4s response time
 *
 * @version 2.0.0
 * - Added query normalization (lowercase, remove accents)
 * - Enhanced greeting patterns (boa tarde, buenas tardes, etc.)
 * - Enhanced FILE_LIST patterns (display all my pdfs, etc.)
 * - Added document type detection (contracts, receipts, invoices, reports)
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
  | 'APP_HELP'            // "how do I upload", "what can you do", "help"
  | 'CALCULATION'         // "calculate X", "what is X + Y", math expressions
  | 'MEMORY_CHECK'        // "what did we discuss", "remember when I said"
  | 'ERROR_EXPLANATION'   // Handles error scenarios with template responses (NO LLM)
  | 'NONE';               // Not a fast-path query - use full RAG

export type DocumentTypeFilter =
  | 'pdf' | 'word' | 'excel' | 'ppt' | 'image' | 'text' | 'csv'
  | 'contract' | 'receipt' | 'invoice' | 'report' | 'presentation'
  | 'spreadsheet' | 'document';

export interface FastPathClassification {
  intent: FastPathIntentType;
  confidence: number;        // 0.0 - 1.0
  isFastPath: boolean;       // true if confidence > threshold
  extractedEntities: {
    fileName?: string;
    folderName?: string;
    fileType?: string;           // pdf, docx, etc. (file extension)
    documentType?: DocumentTypeFilter;  // semantic type: contract, invoice, etc.
    timeRange?: string;          // "recent", "today", "this week"
    limit?: number;              // for list queries
  };
  language: 'en' | 'pt' | 'es';
  processingTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Query Normalization
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize query for robust pattern matching:
 * - Lowercase
 * - Remove accents/diacritics
 * - Trim and condense spaces
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Keep original query but just trim for display/entity extraction
 */
function trimQuery(query: string): string {
  return query.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// Greeting Patterns (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════

const GREETING_PATTERNS = {
  en: [
    /^(hi|hey|hello|yo|howdy)(\s+there)?(\s+koda)?[!.,]?\s*$/,
    /^good\s+(morning|afternoon|evening|night|day)(\s+koda)?[!.,]?\s*$/,
    /^(what'?s\s*up|whats\s*up|sup)(\s+koda)?[!?,]?\s*$/,
    /^how\s+(are\s+you|are\s+u|r\s+u|is\s+it\s+going|'?s\s+it\s+going)(\s+koda)?[!?,]?\s*$/,
    /^greetings?(\s+koda)?[!.,]?\s*$/,
    /^koda[!.,]?\s*$/,
  ],
  pt: [
    /^(oi|ola|eai|e\s*ai)(\s+koda)?[!.,]?\s*$/,
    /^(bom\s+dia|boa\s+tarde|boa\s+noite|boa\s+madrugada)(\s+koda)?[!.,]?\s*$/,
    /^(tudo\s+bem|tudo\s+bom|como\s+vai|como\s+voce?\s+esta|como\s+vc\s+ta)(\s+koda)?[!?,]?\s*$/,
    /^(fala\s+koda|fala\s+ai|fala)[!.,]?\s*$/,
    /^saudacoes?(\s+koda)?[!.,]?\s*$/,
    /^koda[!.,]?\s*$/,
  ],
  es: [
    /^hola(\s+koda)?[!.,]?\s*$/,
    /^(buenas?|buenos?)(\s+koda)?[!.,]?\s*$/,
    /^buen(os|as)?\s+(dias?|tardes?|noches?)(\s+koda)?[!.,]?\s*$/,
    /^(que\s+tal|como\s+estas?|como\s+andas?)(\s+koda)?[!?,]?\s*$/,
    /^saludos?(\s+koda)?[!.,]?\s*$/,
    /^koda[!.,]?\s*$/,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// FILE_LIST Patterns (Enhanced with all variants)
// ═══════════════════════════════════════════════════════════════════════════

const FILE_LIST_PATTERNS = {
  en: [
    // Basic patterns
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(files?|documents?|docs?)(\s+please)?$/,
    /^(give\s+me|pull\s+up|bring\s+up)\s+(all\s+)?(my\s+)?(files?|documents?|docs?)$/,
    /^what\s+(files?|documents?|docs?)\s+(do\s+i\s+have|i\s+have)$/,
    /^show\s+me\s+(all\s+)?(my\s+)?(files?|documents?|docs?)$/,

    // With file type filter (PDF, Word, etc.)
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(pdfs?|pdf\s+files?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(word|docx?|word\s+files?|word\s+documents?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(excel|xlsx?|spreadsheets?|excel\s+files?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(powerpoints?|pptx?|presentations?|slides?|powerpoint\s+files?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(images?|pictures?|photos?|image\s+files?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(text\s+files?|txt\s+files?)$/,

    // Document type filter (contracts, invoices, etc.)
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(contracts?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(receipts?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(invoices?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(reports?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(bills?)$/,
    /^(list|show|display|view|see|open|browse|get)\s+(all\s+)?(my\s+)?(statements?)$/,

    // With limit
    /^(list|show|display|get)\s+(my\s+)?(first|last|top)\s+(\d+)\s+(files?|documents?)$/,
    /^(list|show|display|get)\s+(\d+)\s+(files?|documents?)$/,
  ],
  pt: [
    // Basic patterns
    /^(listar?|mostrar?|exibir|ver|abrir)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(arquivos?|documentos?|docs?)(\s+por\s+favor)?$/,
    /^(me\s+)?mostr[ae]\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(arquivos?|documentos?)$/,
    /^quais?\s+(arquivos?|documentos?)\s+(eu\s+)?tenho$/,
    /^onde\s+(posso|eu\s+posso)\s+ver\s+(meus?|minhas?)\s+(arquivos?|documentos?)$/,

    // With file type filter
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(pdfs?|arquivos?\s+pdf)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(word|docx?|documentos?\s+word)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(excel|xlsx?|planilhas?)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(powerpoints?|pptx?|apresentacoes?|slides?)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(as\s+)?(minhas?)?\s*(imagens?|fotos?|figuras?)$/,

    // Document type filter
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(contratos?)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(recibos?)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(as\s+)?(minhas?)?\s*(faturas?|notas?\s+fiscais?)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(relatorios?)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(as\s+)?(minhas?)?\s*(contas?|boletos?)$/,
    /^(listar?|mostrar?|exibir|ver)\s+(todos?\s+)?(os\s+)?(meus?|minhas?)?\s*(extratos?)$/,

    // With limit
    /^(listar?|mostrar?|exibir)\s+(os\s+)?(primeiros?|ultimos?)\s+(\d+)\s+(arquivos?|documentos?)$/,
  ],
  es: [
    // Basic patterns
    /^(listar?|mostrar?|ver|abrir|ensenar)\s+(todos?\s+)?(mis?\s+)?(archivos?|documentos?|docs?)$/,
    /^(muestrame|ensename)\s+(todos?\s+)?(mis?\s+)?(archivos?|documentos?)$/,
    /^que\s+(archivos?|documentos?)\s+tengo$/,
    /^donde\s+puedo\s+ver\s+(mis?\s+)?(archivos?|documentos?)$/,

    // With file type filter
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(pdfs?|archivos?\s+pdf)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(word|docx?|documentos?\s+word)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(excel|xlsx?|hojas?\s+de\s+calculo)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(powerpoints?|pptx?|presentaciones?|diapositivas?)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(imagenes?|fotos?|ficheros?\s+de\s+imagen)$/,

    // Document type filter
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(contratos?)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(recibos?)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(facturas?)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(informes?|reportes?)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(cuentas?)$/,
    /^(listar?|mostrar?|ver)\s+(todos?\s+)?(mis?\s+)?(estados?\s+de\s+cuenta)$/,

    // With limit
    /^(listar?|mostrar?)\s+(los\s+)?(primeros?|ultimos?)\s+(\d+)\s+(archivos?|documentos?)$/,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Other Intent Patterns
// ═══════════════════════════════════════════════════════════════════════════

const FILE_COUNT_PATTERNS = {
  en: [
    /^how\s+many\s+(files?|documents?|pdfs?|contracts?|invoices?|receipts?|reports?)(\s+do\s+i\s+have)?$/,
    /^count\s+(my\s+)?(all\s+)?(files?|documents?|pdfs?)$/,
    /^(number|total)\s+of\s+(my\s+)?(files?|documents?)$/,
    /^(how\s+many|count)\s+(my\s+)?(contracts?|invoices?|receipts?|reports?)$/,
  ],
  pt: [
    /^quantos?\s+(arquivos?|documentos?|pdfs?|contratos?|faturas?|recibos?|relatorios?)(\s+eu\s+tenho)?$/,
    /^contar?\s+(meus?|minhas?)?\s*(arquivos?|documentos?)$/,
    /^(numero|total)\s+de\s+(meus?|minhas?)?\s*(arquivos?|documentos?)$/,
  ],
  es: [
    /^cuantos?\s+(archivos?|documentos?|pdfs?|contratos?|facturas?|recibos?|informes?)(\s+tengo)?$/,
    /^contar?\s+(mis?\s+)?(archivos?|documentos?)$/,
    /^(numero|total)\s+de\s+(mis?\s+)?(archivos?|documentos?)$/,
  ],
};

const FOLDER_PATH_PATTERNS = {
  en: [
    /^where\s+is\s+(the\s+)?(.+?)\s*(folder|directory)$/,
    /^(path|location)\s+(to|of)\s+(the\s+)?(.+?)\s*(folder|directory)?$/,
    /^find\s+(the\s+)?(.+?)\s*(folder|directory)$/,
    /^in\s+which\s+folder\s+is$/,
  ],
  pt: [
    /^onde\s+(esta|fica)\s+(a\s+)?pasta\s+(.+)$/,
    /^(caminho|localizacao)\s+(da|para)\s+(a\s+)?pasta\s+(.+)$/,
    /^encontrar?\s+(a\s+)?pasta\s+(.+)$/,
    /^em\s+qual\s+pasta\s+(esta|fica)$/,
  ],
  es: [
    /^donde\s+esta\s+(la\s+)?carpeta\s+(.+)$/,
    /^(ruta|ubicacion)\s+(de|a)\s+(la\s+)?carpeta\s+(.+)$/,
    /^encontrar?\s+(la\s+)?carpeta\s+(.+)$/,
    /^en\s+que\s+carpeta\s+esta$/,
  ],
};

const RECENT_ACTIVITY_PATTERNS = {
  en: [
    /^(show|list|get|display)\s+(my\s+)?recent\s+(files?|documents?|uploads?|activity)$/,
    /^what\s+(did\s+i|have\s+i)\s+(upload|add|create)(.+recently)?$/,
    /^what.+recently$/,
    /^(latest|newest|last)\s+(files?|documents?|uploads?)$/,
    /^recently\s+(uploaded|added|created)\s+(files?|documents?)$/,
    /^my\s+recent\s+(files?|documents?|activity)$/,
  ],
  pt: [
    /^(mostrar?|listar?|ver|exibir)\s+(meus?\s+)?(arquivos?|documentos?|uploads?)\s+recentes?$/,
    /^(mostrar?|listar?|ver)\s+(arquivos?|documentos?)\s+recentes?$/,
    /^(arquivos?|documentos?)\s+recentes?$/,
    /^o\s+que\s+(eu\s+)?(enviei|adicionei|criei)\s+recentemente$/,
    /^(ultimos?|mais\s+recentes?)\s+(arquivos?|documentos?)$/,
    /^(arquivos?|documentos?)\s+recentemente\s+(enviados?|adicionados?)$/,
  ],
  es: [
    /^(mostrar?|listar?|ver)\s+(mis?\s+)?(archivos?|documentos?)\s+recientes?$/,
    /^(archivos?|documentos?)\s+recientes?$/,
    /^que\s+(subi|agregue|cree)\s+recientemente$/,
    /^(ultimos?|mas\s+recientes?)\s+(archivos?|documentos?)$/,
    /^(archivos?|documentos?)\s+recientemente\s+(subidos?|agregados?)$/,
  ],
};

const SIMPLE_FACT_PATTERNS = {
  en: [
    /^what\s+is\s+(the\s+)?(\w+)\s+in\s+(.+)$/,
    /^what('s|\s+is)\s+(the\s+)?(value|amount|number|date|name)\s+(of|for)\s+/,
    /^tell\s+me\s+(the\s+)?(\w+)\s+(from|in)\s+/,
  ],
  pt: [
    /^(qual|o\s+que)\s+e\s+(o|a)?\s*(\w+)\s+(em|no|na)\s+/,
    /^qual\s+(e\s+)?(o|a)?\s*(valor|quantidade|numero|data|nome)\s+(de|do|da|para)\s+/,
    /^me\s+diga\s+(o|a)?\s*(\w+)\s+(de|do|da|em|no|na)\s+/,
  ],
  es: [
    /^(cual|que)\s+es\s+(el|la)?\s*(\w+)\s+(en|del?)\s+/,
    /^cual\s+(es\s+)?(el|la)?\s*(valor|cantidad|numero|fecha|nombre)\s+(de|del|para)\s+/,
    /^dime\s+(el|la)?\s*(\w+)\s+(de|del|en)\s+/,
  ],
};

const METADATA_QUERY_PATTERNS = {
  en: [
    /^(what('s|\s+is)|get)\s+(the\s+)?(size|type|format|date|extension)\s+(of|for)\s+/,
    /^when\s+(was|did)\s+(.+)\s+(uploaded|created|modified|added)$/,
    /^(file\s+)?(size|type|info|information|details?)\s+(of|for|about)\s+/,
    /^how\s+(big|large)\s+is\s+(the\s+)?(file\s+)?/,
  ],
  pt: [
    /^(qual|quanto)\s+(e\s+)?(o|a)?\s*(tamanho|tipo|formato|data|extensao)\s+(de|do|da)\s+/,
    /^quando\s+(foi\s+)?(.+)\s+(enviado|criado|modificado|adicionado)$/,
    /^quando\s+(foi\s+)?(enviado|criado|modificado|adicionado)\s+(.+)$/,  // "quando foi enviado arquivo.pdf"
    /^(tamanho|tipo|info|informacao|informacoes|detalhes?)\s+(do|da|sobre)\s+(arquivo\s+)?/,
    /^quao\s+(grande|pesado)\s+e\s+(o\s+)?(arquivo\s+)?/,
  ],
  es: [
    /^(cual|cuanto)\s+(es\s+)?(el|la)?\s*(tamano|tipo|formato|fecha|extension)\s+(de|del)\s+/,
    /^cuando\s+(fue\s+)?(.+)\s+(subido|creado|modificado|agregado)$/,
    /^cuando\s+(fue\s+)?(subido|creado|modificado|agregado)\s+(.+)$/,  // "cuando fue subido archivo.pdf"
    /^(tamano|tipo|info|informacion|detalles?)\s+(del?|sobre)\s+(archivo\s+)?/,
    /^que\s+tan\s+(grande|pesado)\s+es\s+(el\s+)?(archivo\s+)?/,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// APP_HELP Patterns (how to use the app, what can you do)
// ═══════════════════════════════════════════════════════════════════════════

const APP_HELP_PATTERNS = {
  en: [
    /^help[!?.]*$/i,
    /^what\s+can\s+you\s+do\??$/i,
    /^what\s+are\s+you(r)?\s+(capabilities|features|functions)\??$/i,
    /^how\s+do\s+i\s+(use|upload|download|search|find|delete|rename|move|organize|create)\b/i,
    /^how\s+(to|can\s+i)\s+(use|upload|download|search|find|delete|rename|move|organize|create)\b/i,
    /^can\s+you\s+(help|assist)\s+(me\s+)?(with|to)\s+(upload|download|search|find)\b/i,
    /^(show|tell)\s+me\s+(how\s+to|your\s+(features|capabilities))/i,
    /^(what|which)\s+(features|functions|capabilities)\s+(do\s+you\s+have|are\s+available)/i,
    /^(guide|tutorial|instructions?)[!?.]*$/i,
    /^how\s+does\s+(this|it|koda)\s+work\??$/i,
  ],
  pt: [
    /^ajuda[!?.]*$/i,
    /^o\s+que\s+voce?\s+(pode|consegue)\s+fazer\??$/i,
    /^quais?\s+(sao\s+)?(suas?|as)\s+(funcoes|funcionalidades|capacidades)\??$/i,
    /^como\s+(eu\s+)?(faco|posso|uso|envio|baixo|busco|procuro|deleto|renomeio|movo|organizo|crio)\b/i,
    /^como\s+(fazer|usar|enviar|baixar|buscar|procurar|deletar|renomear|mover|organizar|criar)\b/i,
    /^(voce\s+)?pode\s+(me\s+)?(ajudar|auxiliar)\s+(a|com)\s+(enviar|baixar|buscar|procurar)\b/i,
    /^(mostre|diga)\s+me\s+(como|suas?\s+(funcoes|capacidades))/i,
    /^(guia|tutorial|instrucoes?)[!?.]*$/i,
    /^como\s+(isso|koda)\s+funciona\??$/i,
  ],
  es: [
    /^ayuda[!?.]*$/i,
    /^que\s+puedes\s+hacer\??$/i,
    /^cuales?\s+son\s+tus\s+(funciones|capacidades|caracteristicas)\??$/i,
    /^como\s+(puedo|hago|uso|subo|bajo|busco|encuentro|borro|renombro|muevo|organizo|creo)\b/i,
    /^(puedes|podrias)\s+(ayudarme|asistirme)\s+(a|con)\s+(subir|bajar|buscar|encontrar)\b/i,
    /^(muestrame|dime)\s+(como|tus\s+(funciones|capacidades))/i,
    /^(guia|tutorial|instrucciones?)[!?.]*$/i,
    /^como\s+funciona\s+(esto|koda)\??$/i,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION Patterns (math expressions, calculate X)
// ═══════════════════════════════════════════════════════════════════════════

const CALCULATION_PATTERNS = {
  en: [
    /^calculate\s+/i,
    /^compute\s+/i,
    /^what\s+is\s+\d+[\s+\-*\/x×÷%^]+\d+/i,  // "what is 5 + 3"
    /^how\s+much\s+is\s+\d+[\s+\-*\/x×÷%^]+\d+/i,
    /^\d+[\s]*[+\-*\/x×÷%^][\s]*\d+[\s]*[=?]?$/,  // "5 + 3" or "5+3="
    /^(\d+\.?\d*)\s*(plus|minus|times|divided\s+by|multiplied\s+by)\s*(\d+\.?\d*)/i,
    /^(sum|total|average|mean|add|subtract|multiply|divide)\s+(of\s+)?\d+/i,
    /^what\s+is\s+(\d+\.?\d*)\s*(%|percent)\s+of\s+(\d+\.?\d*)/i,
    /^(\d+\.?\d*)\s*(squared|cubed|to\s+the\s+power\s+of)/i,
    /^(sqrt|square\s+root)\s+(of\s+)?(\d+\.?\d*)/i,
    // Financial calculations
    /^(roi|return\s+on\s+investment)\s+(of\s+)?\d+/i,
    /^(moic|multiple)\s+(of\s+)?\d+/i,
    /^(payback|payback\s+period)\s+\d+/i,
    /^(growth)\s+(from\s+)?\d+\s+(to\s+)?\d+/i,
    /^(margin)\s+(of\s+)?\d+\s+(on\s+)?\d+/i,
    /^(compound|interest)\s+\d+/i,
  ],
  pt: [
    /^calcul[ae]\s+/i,
    /^quanto\s+e\s+\d+[\s+\-*\/x×÷%^]+\d+/i,  // "quanto é 5 + 3"
    /^qual\s+(e\s+)?(o\s+)?(resultado|valor)\s+de\s+\d+/i,
    /^\d+[\s]*[+\-*\/x×÷%^][\s]*\d+[\s]*[=?]?$/,  // "5 + 3" or "5+3="
    /^(\d+\.?\d*)\s*(mais|menos|vezes|dividido\s+por|multiplicado\s+por)\s*(\d+\.?\d*)/i,
    /^(soma|total|media|adicionar|subtrair|multiplicar|dividir)\s+(de\s+)?\d+/i,
    /^quanto\s+e\s+(\d+\.?\d*)\s*(por\s*cento|%)\s+de\s+(\d+\.?\d*)/i,
    /^(\d+\.?\d*)\s*(ao\s+quadrado|ao\s+cubo|elevado\s+a)/i,
    /^(raiz\s+quadrada)\s+(de\s+)?(\d+\.?\d*)/i,
    // Financial calculations
    /^(roi|retorno)\s+(de\s+)?\d+/i,
    /^(moic|multiplo)\s+(de\s+)?\d+/i,
    /^(payback|retorno)\s+\d+/i,
    /^(crescimento)\s+(de\s+)?\d+\s+(para\s+)?\d+/i,
    /^(margem)\s+(de\s+)?\d+\s+(sobre\s+)?\d+/i,
    /^(juros\s+compostos?)\s+\d+/i,
  ],
  es: [
    /^calcula\s+/i,
    /^cuanto\s+es\s+\d+[\s+\-*\/x×÷%^]+\d+/i,  // "cuánto es 5 + 3"
    /^cual\s+(es\s+)?(el\s+)?(resultado|valor)\s+de\s+\d+/i,
    /^\d+[\s]*[+\-*\/x×÷%^][\s]*\d+[\s]*[=?]?$/,  // "5 + 3" or "5+3="
    /^(\d+\.?\d*)\s*(mas|menos|por|dividido\s+entre|multiplicado\s+por)\s*(\d+\.?\d*)/i,
    /^(suma|total|promedio|media|sumar|restar|multiplicar|dividir)\s+(de\s+)?\d+/i,
    /^cuanto\s+es\s+el?\s+(\d+\.?\d*)\s*(por\s*ciento|%)\s+de\s+(\d+\.?\d*)/i,
    /^(\d+\.?\d*)\s*(al\s+cuadrado|al\s+cubo|elevado\s+a)/i,
    /^(raiz\s+cuadrada)\s+(de\s+)?(\d+\.?\d*)/i,
    // Financial calculations
    /^(roi|retorno)\s+(de\s+)?\d+/i,
    /^(moic|multiplo)\s+(de\s+)?\d+/i,
    /^(payback|recuperacion)\s+\d+/i,
    /^(crecimiento)\s+(de\s+)?\d+\s+(a\s+)?\d+/i,
    /^(margen)\s+(de\s+)?\d+\s+(sobre\s+)?\d+/i,
    /^(interes\s+compuesto)\s+\d+/i,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY_CHECK Patterns (what did we discuss, conversation recall)
// ═══════════════════════════════════════════════════════════════════════════

const MEMORY_CHECK_PATTERNS = {
  en: [
    /^what\s+did\s+(we|i)\s+(discuss|talk\s+about|say|mention)/i,
    /^(do\s+you\s+)?remember\s+(when|what|that)\s+(i|we)\s+(said|mentioned|discussed|talked)/i,
    /^what\s+(have\s+)?(we|i)\s+(been\s+)?(talking|chatting|discussing)\s+about/i,
    /^(summarize|recap|summary)\s+(our\s+)?(conversation|chat|discussion)/i,
    /^what\s+(was|were)\s+(we|the)\s+(topic|subject|theme)/i,
    /^what\s+did\s+i\s+(ask|tell)\s+you\s+(about|earlier|before)/i,
    /^earlier\s+(i|we)\s+(mentioned|said|discussed)/i,
    /^(can\s+you\s+)?recall\s+(what|our)/i,
  ],
  pt: [
    /^o\s+que\s+(nos|eu)\s+(discutimos|conversamos|falamos|mencionamos)/i,
    /^(voce\s+)?(lembra|se\s+lembra)\s+(de\s+)?(quando|o\s+que|que)\s+(eu|nos)\s+(disse|mencionei|discutimos|falamos)/i,
    /^(sobre\s+)?o\s+que\s+(nos|a\s+gente)\s+(estava|estamos)\s+(falando|conversando|discutindo)/i,
    /^(resumir|resumo|recap)\s+(nossa\s+)?(conversa|chat|discussao)/i,
    /^qual\s+(era|foi)\s+(o\s+)?(tema|assunto|topico)/i,
    /^o\s+que\s+eu\s+(perguntei|disse)\s+(sobre|antes|anteriormente)/i,
    /^antes\s+(eu|nos)\s+(mencionei|disse|discutimos)/i,
  ],
  es: [
    /^que\s+(hemos|he)\s+(discutido|hablado|mencionado|dicho)/i,
    /^(te\s+)?acuerdas\s+(de\s+)?(cuando|que|lo\s+que)\s+(yo|nosotros)\s+(dije|mencione|hablamos)/i,
    /^(sobre\s+)?que\s+(estamos|estabamos)\s+(hablando|conversando|discutiendo)/i,
    /^(resumir|resumen|recap)\s+(nuestra\s+)?(conversacion|chat|discusion)/i,
    /^cual\s+(era|fue)\s+(el\s+)?(tema|asunto|topico)/i,
    /^que\s+(te\s+)?(pregunte|dije)\s+(sobre|antes|anteriormente)/i,
    /^antes\s+(yo|nosotros)\s+(mencione|dije|hablamos)/i,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Document Type Detection
// ═══════════════════════════════════════════════════════════════════════════

const DOCUMENT_TYPE_KEYWORDS: Record<DocumentTypeFilter, RegExp> = {
  // File extensions
  pdf: /\b(pdfs?|pdf\s+files?|arquivos?\s+pdf|archivos?\s+pdf)\b/,
  word: /\b(word|docx?|word\s+files?|word\s+documents?|documentos?\s+word)\b/,
  excel: /\b(excel|xlsx?|spreadsheets?|planilhas?|hojas?\s+de\s+calculo)\b/,
  ppt: /\b(powerpoints?|pptx?|presentations?|slides?|apresentacoes?|presentaciones?|diapositivas?)\b/,
  image: /\b(images?|pictures?|photos?|imagens?|fotos?|figuras?|imagenes?)\b/,
  text: /\b(text\s+files?|txt\s+files?|arquivos?\s+txt|archivos?\s+txt)\b/,
  csv: /\b(csv|csv\s+files?)\b/,

  // Semantic document types
  contract: /\b(contracts?|contratos?)\b/,
  receipt: /\b(receipts?|recibos?)\b/,
  invoice: /\b(invoices?|faturas?|notas?\s+fiscais?|facturas?)\b/,
  report: /\b(reports?|relatorios?|informes?|reportes?)\b/,
  presentation: /\b(presentations?|apresentacoes?|presentaciones?)\b/,
  spreadsheet: /\b(spreadsheets?|planilhas?|hojas?\s+de\s+calculo)\b/,
  document: /\b(documents?|documentos?|docs?)\b/,
};

function detectDocumentType(normalizedQuery: string): DocumentTypeFilter | undefined {
  // Check in priority order (specific types first)
  const priorityOrder: DocumentTypeFilter[] = [
    'contract', 'receipt', 'invoice', 'report',  // Semantic types first
    'pdf', 'word', 'excel', 'ppt', 'image', 'text', 'csv',  // File types
    'presentation', 'spreadsheet',  // Aliases
  ];

  for (const docType of priorityOrder) {
    if (DOCUMENT_TYPE_KEYWORDS[docType].test(normalizedQuery)) {
      return docType;
    }
  }

  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// Entity Extraction Patterns
// ═══════════════════════════════════════════════════════════════════════════

const FILE_TYPE_PATTERNS = {
  en: /\b(pdf|doc|docx|txt|xls|xlsx|ppt|pptx|csv|json|xml|md|html|png|jpg|jpeg|gif)\b/i,
  pt: /\b(pdf|doc|docx|txt|xls|xlsx|ppt|pptx|csv|json|xml|md|html|png|jpg|jpeg|gif)\b/i,
  es: /\b(pdf|doc|docx|txt|xls|xlsx|ppt|pptx|csv|json|xml|md|html|png|jpg|jpeg|gif)\b/i,
};

const TIME_RANGE_PATTERNS = {
  en: {
    recent: /\b(recent|recently|latest|newest|last)\b/,
    today: /\b(today|today'?s)\b/,
    thisWeek: /\b(this\s+week|past\s+week|last\s+7\s+days)\b/,
    thisMonth: /\b(this\s+month|past\s+month|last\s+30\s+days)\b/,
  },
  pt: {
    recent: /\b(recente|recentemente|ultimo|mais\s+recente)\b/,
    today: /\b(hoje)\b/,
    thisWeek: /\b(esta\s+semana|semana\s+passada|ultimos\s+7\s+dias)\b/,
    thisMonth: /\b(este\s+mes|mes\s+passado|ultimos\s+30\s+dias)\b/,
  },
  es: {
    recent: /\b(reciente|recientemente|ultimo|mas\s+reciente)\b/,
    today: /\b(hoy)\b/,
    thisWeek: /\b(esta\s+semana|semana\s+pasada|ultimos\s+7\s+dias)\b/,
    thisMonth: /\b(este\s+mes|mes\s+pasado|ultimos\s+30\s+dias)\b/,
  },
};

const LIMIT_PATTERNS = {
  en: /\b(first|top|last)\s+(\d+)\b|\b(\d+)\s+(files?|documents?)\b/,
  pt: /\b(primeiros?|ultimos?|top)\s+(\d+)\b|\b(\d+)\s+(arquivos?|documentos?)\b/,
  es: /\b(primeros?|ultimos?|top)\s+(\d+)\b|\b(\d+)\s+(archivos?|documentos?)\b/,
};

// ═══════════════════════════════════════════════════════════════════════════
// Language Detection
// ═══════════════════════════════════════════════════════════════════════════

function detectLanguage(query: string): 'en' | 'pt' | 'es' {
  const detected = detectLanguageSimple(query, 'pt-BR');
  if (detected === 'pt-BR') return 'pt';
  if (detected === 'es') return 'es';
  return 'en';
}

// ═══════════════════════════════════════════════════════════════════════════
// Intent Detection Functions
// ═══════════════════════════════════════════════════════════════════════════

function isGreeting(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  // Only check short queries (greetings are typically 1-4 words)
  if (normalizedQuery.split(' ').length > 5) {
    return false;
  }

  const patterns = GREETING_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  // Also check other languages for robustness
  const allPatterns = [...GREETING_PATTERNS.en, ...GREETING_PATTERNS.pt, ...GREETING_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isFileList(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = FILE_LIST_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  // Check all languages
  const allPatterns = [...FILE_LIST_PATTERNS.en, ...FILE_LIST_PATTERNS.pt, ...FILE_LIST_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isFileCount(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = FILE_COUNT_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...FILE_COUNT_PATTERNS.en, ...FILE_COUNT_PATTERNS.pt, ...FILE_COUNT_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isFolderPath(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = FOLDER_PATH_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...FOLDER_PATH_PATTERNS.en, ...FOLDER_PATH_PATTERNS.pt, ...FOLDER_PATH_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isRecentActivity(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = RECENT_ACTIVITY_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...RECENT_ACTIVITY_PATTERNS.en, ...RECENT_ACTIVITY_PATTERNS.pt, ...RECENT_ACTIVITY_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isSimpleFact(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = SIMPLE_FACT_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...SIMPLE_FACT_PATTERNS.en, ...SIMPLE_FACT_PATTERNS.pt, ...SIMPLE_FACT_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isMetadataQuery(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = METADATA_QUERY_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...METADATA_QUERY_PATTERNS.en, ...METADATA_QUERY_PATTERNS.pt, ...METADATA_QUERY_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isAppHelp(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = APP_HELP_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...APP_HELP_PATTERNS.en, ...APP_HELP_PATTERNS.pt, ...APP_HELP_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isCalculation(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = CALCULATION_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...CALCULATION_PATTERNS.en, ...CALCULATION_PATTERNS.pt, ...CALCULATION_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

function isMemoryCheck(normalizedQuery: string, lang: 'en' | 'pt' | 'es'): boolean {
  const patterns = MEMORY_CHECK_PATTERNS[lang];
  if (patterns.some(re => re.test(normalizedQuery))) {
    return true;
  }

  const allPatterns = [...MEMORY_CHECK_PATTERNS.en, ...MEMORY_CHECK_PATTERNS.pt, ...MEMORY_CHECK_PATTERNS.es];
  return allPatterns.some(re => re.test(normalizedQuery));
}

// ═══════════════════════════════════════════════════════════════════════════
// Entity Extraction
// ═══════════════════════════════════════════════════════════════════════════

function extractEntities(
  originalQuery: string,
  normalizedQuery: string,
  intent: FastPathIntentType,
  language: 'en' | 'pt' | 'es'
): FastPathClassification['extractedEntities'] {
  const entities: FastPathClassification['extractedEntities'] = {};

  // Extract file type (extension)
  const fileTypeMatch = normalizedQuery.match(FILE_TYPE_PATTERNS[language]);
  if (fileTypeMatch) {
    entities.fileType = fileTypeMatch[1].toLowerCase();
  }

  // Extract document type (semantic)
  const docType = detectDocumentType(normalizedQuery);
  if (docType) {
    entities.documentType = docType;
  }

  // Extract time range
  const timePatterns = TIME_RANGE_PATTERNS[language];
  if (timePatterns.today.test(normalizedQuery)) {
    entities.timeRange = 'today';
  } else if (timePatterns.thisWeek.test(normalizedQuery)) {
    entities.timeRange = 'this_week';
  } else if (timePatterns.thisMonth.test(normalizedQuery)) {
    entities.timeRange = 'this_month';
  } else if (timePatterns.recent.test(normalizedQuery)) {
    entities.timeRange = 'recent';
  }

  // Extract limit
  const limitMatch = normalizedQuery.match(LIMIT_PATTERNS[language]);
  if (limitMatch) {
    const num = limitMatch[2] || limitMatch[3];
    if (num) {
      entities.limit = parseInt(num, 10);
    }
  }

  // Extract folder name for FOLDER_PATH_QUERY (use original query to preserve case)
  if (intent === 'FOLDER_PATH_QUERY') {
    const folderPatterns = {
      en: /(?:folder|directory)\s+(?:called\s+)?["']?([^"']+?)["']?(?:\s|$)/i,
      pt: /pasta\s+(?:chamada\s+)?["']?([^"']+?)["']?(?:\s|$)/i,
      es: /carpeta\s+(?:llamada\s+)?["']?([^"']+?)["']?(?:\s|$)/i,
    };
    const folderMatch = originalQuery.match(folderPatterns[language]);
    if (folderMatch) {
      entities.folderName = folderMatch[1].trim();
    }
  }

  // Extract file name for METADATA_QUERY (use original query to preserve case)
  if (intent === 'METADATA_QUERY' || intent === 'SIMPLE_FACT') {
    const quotedMatch = originalQuery.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      entities.fileName = quotedMatch[1];
    } else {
      const fileMatch = originalQuery.match(/\b(\w+\.(?:pdf|doc|docx|txt|xlsx?|pptx?|csv))\b/i);
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
  const originalQuery = trimQuery(query);
  const normalizedQuery = normalizeQuery(query);
  const language = detectLanguage(originalQuery);

  let intent: FastPathIntentType = 'NONE';
  let confidence = 0;

  // Check intents in priority order
  // GREETING first (simplest, fastest to respond)
  if (isGreeting(normalizedQuery, language)) {
    intent = 'GREETING';
    confidence = 0.95;
  }
  // CALCULATION (pure math - no LLM needed)
  else if (isCalculation(normalizedQuery, language)) {
    intent = 'CALCULATION';
    confidence = 0.95;
  }
  // APP_HELP (how to use the app - template responses)
  else if (isAppHelp(normalizedQuery, language)) {
    intent = 'APP_HELP';
    confidence = 0.9;
  }
  // MEMORY_CHECK (conversation recall - fast memory lookup)
  else if (isMemoryCheck(normalizedQuery, language)) {
    intent = 'MEMORY_CHECK';
    confidence = 0.85;
  }
  // RECENT_ACTIVITY before FILE_LIST (more specific)
  else if (isRecentActivity(normalizedQuery, language)) {
    intent = 'RECENT_ACTIVITY';
    confidence = 0.9;
  }
  // FILE_COUNT before FILE_LIST
  else if (isFileCount(normalizedQuery, language)) {
    intent = 'FILE_COUNT';
    confidence = 0.9;
  }
  // FOLDER_PATH_QUERY
  else if (isFolderPath(normalizedQuery, language)) {
    intent = 'FOLDER_PATH_QUERY';
    confidence = 0.9;
  }
  // METADATA_QUERY
  else if (isMetadataQuery(normalizedQuery, language)) {
    intent = 'METADATA_QUERY';
    confidence = 0.85;
  }
  // FILE_LIST (most general file query)
  else if (isFileList(normalizedQuery, language)) {
    intent = 'FILE_LIST';
    confidence = 0.9;
  }
  // SIMPLE_FACT (last resort fast-path)
  else if (isSimpleFact(normalizedQuery, language)) {
    intent = 'SIMPLE_FACT';
    confidence = 0.8;
  }

  // Boost confidence for short queries (more likely to be fast-path)
  const wordCount = normalizedQuery.split(' ').length;
  if (wordCount <= 4 && intent !== 'NONE') {
    confidence = Math.min(confidence + 0.05, 0.95);
  }

  // Extract entities
  const extractedEntities = extractEntities(originalQuery, normalizedQuery, intent, language);

  const processingTimeMs = Date.now() - startTime;

  return {
    intent,
    confidence,
    isFastPath: intent !== 'NONE' && confidence >= CONFIDENCE_THRESHOLD,
    extractedEntities,
    language,
    processingTimeMs,
  };
}

/**
 * Quick check if a query might be fast-path eligible (for early filtering)
 */
export function mightBeFastPath(query: string): boolean {
  const normalizedQuery = normalizeQuery(query);

  // Quick pattern checks without full classification
  const quickPatterns = [
    // File operations
    /^(list|show|display|get|count|view|see|browse)\b/,
    /^(listar?|mostrar?|exibir|ver|contar)\b/,
    // Folder queries
    /\b(folder|directory|pasta|carpeta)\b/,
    // Recent activity
    /\b(recent|latest|newest|recentes?|ultimos?)\b/,
    // Greetings
    /^(hi|hello|hey|good|oi|ola|hola|bom|boa|buen)/,
    // Metadata
    /^(what|when|how|qual|quando|como|cual|cuanto)\b/,
    // File endings
    /\b(files?|documents?|arquivos?|documentos?|archivos?|pdfs?)\s*$/,
    // Document types
    /\b(contracts?|invoices?|receipts?|reports?|contratos?|faturas?|recibos?|relatorios?)\b/,
    // APP_HELP patterns
    /^(help|ajuda|ayuda)[!?.]*$/i,
    /\b(how\s+do\s+i|como\s+(faco|posso)|como\s+(puedo|hago))\b/i,
    /\b(what\s+can\s+you\s+do|o\s+que\s+voce\s+pode|que\s+puedes\s+hacer)\b/i,
    // CALCULATION patterns
    /^\d+[\s]*[+\-*\/x×÷%^][\s]*\d+/,  // Basic math: "5 + 3"
    /^(calculate|calcul[ae]|cuanto\s+es|quanto\s+e)\s+/i,
    // MEMORY_CHECK patterns
    /\b(remember|recall|lembra|se\s+lembra|acuerdas)\b/i,
    /\b(what\s+did\s+(we|i)\s+(discuss|talk)|o\s+que\s+(nos|eu)\s+(discutimos|conversamos))\b/i,
  ];

  return quickPatterns.some(p => p.test(normalizedQuery));
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export default {
  classifyFastPathIntent,
  mightBeFastPath,
  normalizeQuery,
  CONFIDENCE_THRESHOLD,
};
