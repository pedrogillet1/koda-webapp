/**
 * ============================================================================
 * SIMPLE INTENT DETECTION SERVICE
 * ============================================================================
 *
 * FIX #6: Simplified Intent Detection
 *
 * Replaces complex multi-service intent detection with simple pattern matching:
 * - intentDetection.service.ts (919 lines, uses LLM)
 * - showVsExplainClassifier.service.ts (281 lines)
 * - Parts of fastPathDetector.service.ts (uses LLM)
 *
 * Performance:
 * - Before: 3-6 seconds (LLM-based)
 * - After: < 10ms (pattern matching)
 *
 * Why This Works:
 * 1. Fast - < 10ms vs 3-6 seconds
 * 2. Reliable - Pattern matching is deterministic
 * 3. Good enough - LLM adapts response style naturally
 * 4. No conflicts - Single source of truth
 * 5. Maintainable - Easy to add new patterns
 */

// ============================================================================
// TYPES
// ============================================================================

export type SimpleIntentType =
  | 'greeting'       // hi, hello, oi, hola
  | 'capability'     // what can you do, help
  | 'data'           // show, list, what are, how many
  | 'explanation'    // why, how, explain, what is
  | 'comparison'     // compare, difference, vs
  | 'file_action'    // create folder, move, rename, delete
  | 'list_folders'   // what folders do I have, list folders
  | 'metadata'       // where is file, how many documents
  | 'general';       // default - content query

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
  extractedValue?: string;  // folder name, filename, etc.
  detectionTimeMs: number;
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * ✅ FAST: < 10ms pattern matching for query intent
 * Replaces expensive LLM-based intent detection
 */
export function detectIntent(query: string): SimpleIntentResult {
  const startTime = Date.now();
  const lowerQuery = query.toLowerCase().trim();

  // ════════════════════════════════════════════════════════════════════════
  // 1. GREETING (hi, hello, oi, hola) - No documents needed
  // ════════════════════════════════════════════════════════════════════════
  if (isGreeting(lowerQuery)) {
    return result('greeting', false, 0.99, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. CAPABILITY (what can you do, help) - No documents needed
  // ════════════════════════════════════════════════════════════════════════
  if (isCapabilityQuery(lowerQuery)) {
    return result('capability', false, 0.98, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. FILE ACTIONS (create, move, rename, delete) - No documents needed
  // ════════════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════════════
  // 4. LIST FOLDERS (what folders do I have) - Database lookup, NOT RAG
  // ════════════════════════════════════════════════════════════════════════
  if (isFolderListingQuery(lowerQuery)) {
    return {
      type: 'list_folders',
      needsDocuments: false,
      confidence: 0.95,
      detectionTimeMs: Date.now() - startTime
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. METADATA QUERIES (where is X, how many files) - Database lookup
  // ════════════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════════════
  // 6. COMPARISON (compare, difference, vs) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  if (isComparisonQuery(lowerQuery)) {
    return result('comparison', true, 0.95, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. DATA QUERIES (show, list, how many, total) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  if (isDataQuery(lowerQuery)) {
    return result('data', true, 0.90, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 8. EXPLANATION QUERIES (why, how, explain, what is) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  if (isExplanationQuery(lowerQuery)) {
    return result('explanation', true, 0.85, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 9. GENERAL (default) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  return result('general', true, 0.70, startTime);
}

// ============================================================================
// PATTERN DETECTION HELPERS
// ============================================================================

function isGreeting(query: string): boolean {
  const greetingPatterns = [
    // English - basic greetings with optional casual extensions
    /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening|day)|howdy|yo|sup|what'?s\s*up)(\s+there)?[\s!.?]*$/i,
    /^(hi|hello|hey)\s+(there|everyone|all|koda|assistant)[\s!.?]*$/i,
    /^(thanks|thank\s*you|thx|bye|goodbye|see\s*you|cya|later)[\s!.?]*$/i,
    /^how\s*are\s*you[\s!.?]*$/i,
    // Portuguese
    /^(oi|olá|ola|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*aí|eai|tudo\s*bem|obrigad[oa]|valeu)[\s!.?]*$/i,
    // Spanish
    /^(hola|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|qué\s*tal|gracias)[\s!.?]*$/i,
    // French
    /^(bonjour|bonsoir|salut|coucou|ça\s*va|merci)[\s!.?]*$/i,
  ];
  return greetingPatterns.some(p => p.test(query));
}

function isCapabilityQuery(query: string): boolean {
  // Don't match if asking about KODA business/ICP (that's a document query)
  if (/koda'?s\s+|koda\s+(icp|business|market|customer|target|revenue|pricing|strategy|plan|model)/i.test(query)) {
    return false;
  }

  const capabilityPatterns = [
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
  return capabilityPatterns.some(p => p.test(query));
}

function isComparisonQuery(query: string): boolean {
  return /\b(compare|comparison|difference|differences|vs\.?|versus|between.*and|contrast|similarities|comparar|diferença|diferencia|comparação)\b/i.test(query);
}

function isDataQuery(query: string): boolean {
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA QUERY DETECTION - COMPREHENSIVE PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════
  // FIX: Expanded patterns to catch more data queries that need document search
  // Impact: Queries like "total revenue", "what data", "show results" now route to RAG

  // English data keywords
  const englishDataPatterns = [
    /\b(show|list|display|view|give\s*me|get|find|show\s*me)\b/i,
    /\b(what\s*(are|is|was|were|does|do))\b/i,
    /\b(how\s*(much|many))\b/i,
    /\b(total|sum|count|average|mean|median|max|min|maximum|minimum)\b/i,
    /\b(revenue|sales|profit|income|cost|expense|budget|price|amount)\b/i,
    /\b(data|results|numbers|figures|statistics|stats|metrics|values)\b/i,
    /\b(calculate|compute|add\s*up|tally)\b/i,
    /\b(percentage|percent|ratio|rate|growth)\b/i,
    /\b(table|chart|graph|report|spreadsheet)\b/i,
    /\b(search|lookup|look\s*up|query)\b/i,
    /\b(in\s+the\s+(document|file|pdf|excel|spreadsheet))\b/i,
    /\b(from\s+(my|the)\s+(document|file|data))\b/i,
    /\b(according\s+to|based\s+on)\b/i,
  ];

  // Portuguese data keywords
  const portugueseDataPatterns = [
    /\b(mostre|mostrar|liste|listar|exibir|ver)\b/i,
    /\b(qual|quais|quanto|quantos|quantas)\b/i,
    /\b(total|soma|contagem|média|máximo|mínimo)\b/i,
    /\b(receita|vendas|lucro|custo|despesa|orçamento|preço|valor)\b/i,
    /\b(dados|resultados|números|estatísticas|métricas|valores)\b/i,
    /\b(calcular|computar|somar)\b/i,
    /\b(porcentagem|percentual|taxa|crescimento)\b/i,
    /\b(tabela|gráfico|relatório|planilha)\b/i,
    /\b(buscar|procurar|pesquisar|consultar)\b/i,
    /\b(no\s+(documento|arquivo|pdf|excel|planilha))\b/i,
    /\b(do\s+(meu|documento|arquivo|dado))\b/i,
    /\b(de\s+acordo\s+com|baseado\s+em)\b/i,
  ];

  // Spanish data keywords
  const spanishDataPatterns = [
    /\b(mostrar|muestra|listar|lista|ver|dame)\b/i,
    /\b(cu[aá]l|cu[aá]les|cu[aá]nto|cu[aá]ntos|cu[aá]ntas)\b/i,
    /\b(total|suma|conteo|promedio|m[aá]ximo|m[ií]nimo)\b/i,
    /\b(ingresos|ventas|ganancia|costo|gasto|presupuesto|precio|monto)\b/i,
    /\b(datos|resultados|n[uú]meros|estad[ií]sticas|m[eé]tricas|valores)\b/i,
    /\b(calcular|computar|sumar)\b/i,
    /\b(porcentaje|tasa|crecimiento)\b/i,
    /\b(tabla|gr[aá]fico|reporte|hoja\s*de\s*c[aá]lculo)\b/i,
    /\b(buscar|consultar)\b/i,
    /\b(en\s+el\s+(documento|archivo|pdf|excel))\b/i,
    /\b(del\s+(documento|archivo|dato))\b/i,
    /\b(seg[uú]n|basado\s+en)\b/i,
  ];

  return (
    englishDataPatterns.some(p => p.test(query)) ||
    portugueseDataPatterns.some(p => p.test(query)) ||
    spanishDataPatterns.some(p => p.test(query))
  );
}

function isExplanationQuery(query: string): boolean {
  return /\b(why|explain|what\s*is|what\s*are|tell\s*me\s*about|describe|summarize|summary|analyze|analysis|explique|por\s*que|como|o\s*que\s*[eé]|qu[eé]\s*es|c[oó]mo)\b/i.test(query);
}

// ============================================================================
// FILE ACTION DETECTION
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

  // DELETE patterns - expanded to catch more variations
  const deletePatterns = [
    // English - with explicit file/document words
    /(?:delete|remove|trash|erase)\s+(?:the\s+)?(?:file|folder|document)\s+["']?([^"'\n]+)["']?/i,
    // English - direct filename (e.g., "delete old.pdf")
    /(?:delete|remove|trash|erase)\s+["']?([^"'\s]+\.[a-z]{2,4})["']?/i,
    // Portuguese
    /(?:apagar|excluir|remover|deletar)\s+(?:o\s+)?(?:arquivo|documento|pasta)?\s*["']?([^"'\n]+)["']?/i,
    // Spanish
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
// METADATA QUERY DETECTION (database lookups, not RAG)
// ============================================================================

interface MetadataResult {
  isMetadata: boolean;
  confidence: number;
  extractedValue?: string;
}

function detectMetadataQuery(lowerQuery: string, originalQuery: string): MetadataResult {
  // FILE LOCATION patterns - "where is X"
  const locationPatterns = [
    /where\s+is\s+(.+)/i,
    /where\s+can\s+i\s+find\s+(.+)/i,
    /location\s+of\s+(.+)/i,
    /find\s+(.+)\s+file/i,
    /which\s+folder\s+(?:has|contains)\s+(.+)/i,
    // Portuguese
    /onde\s+(?:está|fica)\s+(.+)/i,
    // Spanish
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

  // FILE COUNT patterns - "how many files" (flexible)
  const countPatterns = [
    // English
    /how\s+many\s+(files|documents)\s*(?:do\s+i\s+have)?/i,
    /(file|document)\s+count/i,
    /total\s+(?:number\s+of\s+)?(files|documents)/i,
    /number\s+of\s+(files|documents)/i,
    /count\s+(?:my\s+)?(files|documents)/i,
    // Portuguese
    /quantos\s+(arquivos|documentos|ficheiros)\s*(?:tenho|eu\s+tenho)?/i,
    /(?:qual|quantos)\s+(?:é\s+)?(?:o\s+)?(?:número|total)\s+(?:de\s+)?(arquivos|documentos)/i,
    // Spanish
    /cu[aá]ntos\s+(archivos|documentos)\s*(?:tengo)?/i,
    /(?:cu[aá]l|cu[aá]ntos)\s+(?:es\s+)?(?:el\s+)?(?:n[uú]mero|total)\s+(?:de\s+)?(archivos|documentos)/i,
    // French
    /combien\s+(?:de\s+)?(fichiers|documents)/i,
    // German
    /wie\s+viele\s+(dateien|dokumente)/i,
  ];

  if (countPatterns.some(p => p.test(originalQuery))) {
    return { isMetadata: true, confidence: 0.95 };
  }

  // LIST ALL FILES patterns - show/list my documents/files (flexible)
  const listAllPatterns = [
    // English - flexible patterns
    /show\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(files|documents)/i,
    /list\s+(?:all\s+)?(?:my\s+)?(files|documents)/i,
    /what\s+(?:are\s+)?(?:my\s+)?(files|documents)/i,
    /what\s+files\s+do\s+i\s+have/i,
    /what\s+documents\s+do\s+i\s+have/i,
    /(?:show|display|view|get)\s+(?:my\s+)?(files|documents)/i,
    /my\s+(files|documents)/i,
    // Portuguese - flexible patterns
    /mostr[ae]\s+(?:todos\s+)?(?:os\s+)?(?:meus\s+)?(arquivos|documentos|ficheiros)/i,
    /list[ae]\s+(?:todos\s+)?(?:os\s+)?(?:meus\s+)?(arquivos|documentos|ficheiros)/i,
    /(?:quais|que)\s+(?:são\s+)?(?:os\s+)?(?:meus\s+)?(arquivos|documentos)/i,
    /(?:ver|exibir)\s+(?:os\s+)?(?:meus\s+)?(arquivos|documentos|ficheiros)/i,
    /meus\s+(arquivos|documentos|ficheiros)/i,
    // Spanish - flexible patterns
    /mu[eé]str[ae](?:me)?\s+(?:todos\s+)?(?:los\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /list[ae]\s+(?:todos\s+)?(?:los\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /(?:cu[aá]les|qu[eé])\s+(?:son\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /(?:ver|mostrar)\s+(?:los\s+)?(?:mis\s+)?(archivos|documentos)/i,
    /mis\s+(archivos|documentos)/i,
    // French
    /montr[ez]\s+(?:tous\s+)?(?:mes\s+)?(fichiers|documents)/i,
    /(?:quels|mes)\s+(fichiers|documents)/i,
    // German
    /zeig[et]?\s+(?:mir\s+)?(?:alle\s+)?(?:meine\s+)?(dateien|dokumente)/i,
    /(?:meine|welche)\s+(dateien|dokumente)/i,
  ];

  if (listAllPatterns.some(p => p.test(originalQuery))) {
    return { isMetadata: true, confidence: 0.90 };
  }

  // FILE TYPE SPECIFIC patterns - "show my pdfs", "list my excel files", etc.
  // Supported types: pdf, docx, pptx, excel, png, jpg, mov, word, powerpoint
  const fileTypePatterns = [
    // English - file type queries
    /show\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(pdfs?|docx?|pptx?|excel\s*(?:files?)?|spreadsheets?|word\s*(?:doc(?:ument)?s?)?|powerpoints?|presentations?|png|jpe?g|images?|photos?|mov|videos?)/i,
    /list\s+(?:all\s+)?(?:my\s+)?(pdfs?|docx?|pptx?|excel\s*(?:files?)?|spreadsheets?|word\s*(?:doc(?:ument)?s?)?|powerpoints?|presentations?|png|jpe?g|images?|photos?|mov|videos?)/i,
    /what\s+(pdfs?|docx?|pptx?|excel\s*(?:files?)?|spreadsheets?|word\s*(?:doc(?:ument)?s?)?|powerpoints?|presentations?|png|jpe?g|images?|photos?|mov|videos?)\s+do\s+i\s+have/i,
    /how\s+many\s+(pdfs?|docx?|pptx?|excel\s*(?:files?)?|spreadsheets?|word\s*(?:doc(?:ument)?s?)?|powerpoints?|presentations?|png|jpe?g|images?|photos?|mov|videos?)/i,
    /(?:my|all\s+my)\s+(pdfs?|docx?|pptx?|excel\s*(?:files?)?|spreadsheets?|word\s*(?:doc(?:ument)?s?)?|powerpoints?|presentations?|png|jpe?g|images?|photos?|mov|videos?)/i,
    // Portuguese
    /mostr[ae]\s+(?:os\s+)?(?:meus\s+)?(pdfs?|docx?|pptx?|excels?|planilhas?|words?|powerpoints?|apresenta[çc][õo]es?|png|jpe?g|imagens?|fotos?|mov|v[ií]deos?)/i,
    /(?:meus|quantos)\s+(pdfs?|docx?|pptx?|excels?|planilhas?|words?|powerpoints?|apresenta[çc][õo]es?|png|jpe?g|imagens?|fotos?|mov|v[ií]deos?)/i,
    // Spanish
    /mu[eé]str[ae](?:me)?\s+(?:mis\s+)?(pdfs?|docx?|pptx?|excels?|hojas?\s*de\s*c[aá]lculo|words?|powerpoints?|presentaciones?|png|jpe?g|im[aá]genes?|fotos?|mov|videos?)/i,
    /(?:mis|cu[aá]ntos)\s+(pdfs?|docx?|pptx?|excels?|hojas?\s*de\s*c[aá]lculo|words?|powerpoints?|presentaciones?|png|jpe?g|im[aá]genes?|fotos?|mov|videos?)/i,
  ];

  for (const pattern of fileTypePatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      // Extract and normalize file type
      let fileType = match[1].toLowerCase().replace(/s$/, ''); // remove plural
      // Normalize common aliases to actual extensions
      if (fileType === 'spreadsheet' || fileType === 'planilha' || fileType.startsWith('excel')) fileType = 'excel';
      if (fileType === 'word' || fileType.startsWith('word ')) fileType = 'docx';
      if (fileType === 'powerpoint' || fileType === 'presentation' || fileType === 'apresentação' || fileType === 'apresentacao' || fileType === 'presentacion') fileType = 'pptx';
      if (fileType === 'image' || fileType === 'photo' || fileType === 'imagem' || fileType === 'foto' || fileType === 'imagen') fileType = 'png';
      if (fileType === 'video' || fileType === 'vídeo') fileType = 'mov';
      return { isMetadata: true, confidence: 0.92, extractedValue: fileType };
    }
  }

  // FOLDER CONTENTS patterns
  const folderContentPatterns = [
    /what\s+(?:is|are)\s+(?:inside|in)\s+(.+?)\s+folder/i,
    /show\s+me\s+(?:the\s+)?(.+?)\s+folder/i,
    /what\s+files\s+are\s+in\s+(.+)/i,
    /contents\s+of\s+(.+?)\s+folder/i,
    /list\s+(?:files\s+in\s+|everything\s+in\s+)?(.+?)\s+folder/i,
    /which\s+(?:document|documents|file|files)\s+(?:are|is)\s+(?:inside|in)\s+(.+)/i,
    /o\s+que\s+(?:tem|h[aá])\s+na\s+pasta\s+(.+)/i,
    /qu[eé]\s+hay\s+en\s+la\s+carpeta\s+(.+)/i,
  ];

  for (const pattern of folderContentPatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      return { isMetadata: true, confidence: 0.95, extractedValue: match[1].trim() };
    }
  }

  // NOTE: LIST FOLDERS patterns moved to isFolderListingQuery() - handled separately

  return { isMetadata: false, confidence: 0 };
}

// ============================================================================
// FOLDER LISTING DETECTION (separate from metadata)
// ============================================================================

/**
 * Detects if the query is asking to list folders
 * This is handled separately from metadata to ensure proper routing
 */
function isFolderListingQuery(lowerQuery: string): boolean {
  const folderListingPatterns = [
    /which\s+folders\s+(?:do\s+i\s+have|are\s+there)/i,
    /what\s+folders\s+(?:do\s+i\s+have|are\s+there|exist)/i,
    /list\s+(?:all\s+)?(?:my\s+)?folders/i,
    /show\s+me\s+(?:all\s+)?(?:my\s+)?folders/i,
    /how\s+many\s+folders/i,
    /folders\s+(?:do\s+i\s+have|i\s+have)/i,
    // Portuguese
    /quais\s+pastas/i,
    /(?:mostre|liste)\s+(?:as\s+)?(?:minhas\s+)?pastas/i,
    /quantas\s+pastas/i,
    // Spanish
    /qu[eé]\s+carpetas/i,
    /(?:muestra|lista)\s+(?:las\s+)?(?:mis\s+)?carpetas/i,
    /cu[aá]ntas\s+carpetas/i,
  ];

  return folderListingPatterns.some(p => p.test(lowerQuery));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function result(
  type: SimpleIntentType,
  needsDocuments: boolean,
  confidence: number,
  startTime: number
): SimpleIntentResult {
  return {
    type,
    needsDocuments,
    confidence,
    detectionTimeMs: Date.now() - startTime
  };
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * ✅ FIX #6: Intent enum for backwards compatibility
 * Replaces the enum from the archived intentDetection.service.ts
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
    metadata: Intent.LIST_FILES,  // FAST PATH: List files
    general: Intent.RAG_QUERY
  };

  // Build parameters object
  const parameters: Record<string, any> = {};
  if (result.extractedValue) {
    parameters.value = result.extractedValue;
    // For file type queries (metadata type), also set fileType for chat.service.ts
    if (result.type === 'metadata') {
      parameters.fileType = result.extractedValue;
    }
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
  toLegacyIntent
};
