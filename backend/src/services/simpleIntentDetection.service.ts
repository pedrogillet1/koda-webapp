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
  // 4. METADATA QUERIES (where is X, how many files) - Database lookup
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
  // 5. COMPARISON (compare, difference, vs) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  if (isComparisonQuery(lowerQuery)) {
    return result('comparison', true, 0.95, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. DATA QUERIES (show, list, how many, total) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  if (isDataQuery(lowerQuery)) {
    return result('data', true, 0.90, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. EXPLANATION QUERIES (why, how, explain, what is) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  if (isExplanationQuery(lowerQuery)) {
    return result('explanation', true, 0.85, startTime);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 8. GENERAL (default) - Needs documents
  // ════════════════════════════════════════════════════════════════════════
  return result('general', true, 0.70, startTime);
}

// ============================================================================
// PATTERN DETECTION HELPERS
// ============================================================================

function isGreeting(query: string): boolean {
  const greetingPatterns = [
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
  return /\b(show|list|what\s*are|how\s*many|total|sum|count|display|give\s*me|get|find|show\s*me|mostre|liste|quantos|cuántos)\b/i.test(query);
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
    /(?:create|make|new|criar|fazer|nueva?)\s+(?:a\s+)?(?:folder|pasta|carpeta)\s+(?:named|called|chamad[ao])?\s*["']?([^"'\n]+)["']?/i,
    /(?:create|make|new|criar|fazer|nueva?)\s+(?:a\s+)?(?:folder|pasta|carpeta)/i,
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
  if (/(?:delete|remove|apagar|excluir|eliminar)\s+(?:the\s+)?(?:file|folder|document|pasta|arquivo|carpeta)/i.test(originalQuery)) {
    return { action: 'delete', confidence: 0.90 };
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

  // FILE COUNT patterns - "how many files"
  const countPatterns = [
    /how\s+many\s+(files|documents)/i,
    /(file|document)\s+count/i,
    /total\s+(files|documents)/i,
    /number\s+of\s+(files|documents)/i,
    /quantos\s+(arquivos|documentos)/i,
    /cu[aá]ntos\s+(archivos|documentos)/i,
  ];

  if (countPatterns.some(p => p.test(originalQuery))) {
    return { isMetadata: true, confidence: 0.95 };
  }

  // LIST ALL FILES patterns
  const listAllPatterns = [
    /show\s+me\s+all\s+(files|documents)/i,
    /list\s+all\s+(files|documents)/i,
    /what\s+files\s+do\s+i\s+have/i,
    /what\s+documents\s+do\s+i\s+have/i,
    /mostre\s+todos\s+os\s+(arquivos|documentos)/i,
    /mu[eé]strame\s+todos\s+los\s+(archivos|documentos)/i,
  ];

  if (listAllPatterns.some(p => p.test(originalQuery))) {
    return { isMetadata: true, confidence: 0.90 };
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

  // LIST FOLDERS patterns
  const listFoldersPatterns = [
    /which\s+folders\s+(?:do\s+i\s+have|are\s+there)/i,
    /what\s+folders\s+(?:do\s+i\s+have|are\s+there|exist)/i,
    /list\s+(?:all\s+)?(?:my\s+)?folders/i,
    /show\s+me\s+(?:all\s+)?(?:my\s+)?folders/i,
    /how\s+many\s+folders/i,
    /quais\s+pastas/i,
    /qu[eé]\s+carpetas/i,
  ];

  if (listFoldersPatterns.some(p => p.test(originalQuery))) {
    return { isMetadata: true, confidence: 0.95 };
  }

  return { isMetadata: false, confidence: 0 };
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
 * Maps to legacy Intent type for backwards compatibility
 */
export function toLegacyIntent(result: SimpleIntentResult): {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  entities: Record<string, any>;
} {
  const intentMap: Record<SimpleIntentType, string> = {
    greeting: 'greeting',
    capability: 'capability',
    data: 'rag_query',
    explanation: 'rag_query',
    comparison: 'COMPARE_DOCUMENTS',
    file_action: result.fileAction || 'rag_query',
    metadata: 'metadata_query',
    general: 'rag_query'
  };

  return {
    intent: intentMap[result.type],
    confidence: result.confidence,
    parameters: result.extractedValue ? { value: result.extractedValue } : {},
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
