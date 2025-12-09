/**
 * Navigation Intent Service
 *
 * Detects folder/file navigation queries using pattern matching.
 * Supports multiple languages (English, Portuguese, Spanish, French).
 *
 * Intent Types:
 * - FOLDER_LIST: "show my folders", "list folders"
 * - FOLDER_CONTENT: "what's in Documents folder", "show files in X"
 * - FILE_LIST: "show my files", "list documents"
 * - FILE_SEARCH: "find file X", "search for X"
 * - DOCUMENT_COUNT: "how many files", "count documents"
 */

export type NavigationIntentType =
  | 'FOLDER_LIST'
  | 'FOLDER_CONTENT'
  | 'FILE_LIST'
  | 'FILE_SEARCH'
  | 'DOCUMENT_COUNT'
  | 'NONE';

export interface NavigationIntent {
  type: NavigationIntentType;
  confidence: number;
  targetName?: string;
  searchTerm?: string;
  language: string;
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

interface PatternSet {
  patterns: RegExp[];
  extractTarget?: (match: RegExpMatchArray) => string | undefined;
}

const FOLDER_LIST_PATTERNS: Record<string, PatternSet> = {
  en: {
    patterns: [
      /^(show|list|display|what are)\s+(my\s+)?(all\s+)?folders?$/i,
      /^(show|list|display)\s+(me\s+)?(my\s+)?folders?$/i,
      /^what\s+folders?\s+(do\s+)?i\s+have$/i,
      /^my\s+folders?$/i,
      /^folders?$/i,
    ],
  },
  pt: {
    patterns: [
      /^(mostr[ae]|list[ae]|exib[ae])\s+(as\s+)?(minhas\s+)?pastas?$/i,
      /^quais?\s+(s[aã]o\s+)?(as\s+)?minhas?\s+pastas?$/i,
      /^minhas?\s+pastas?$/i,
      /^pastas?$/i,
    ],
  },
  es: {
    patterns: [
      /^(muestra|lista|mostrar)\s+(mis\s+)?carpetas?$/i,
      /^cu[aá]les?\s+(son\s+)?mis\s+carpetas?$/i,
      /^mis\s+carpetas?$/i,
      /^carpetas?$/i,
    ],
  },
  fr: {
    patterns: [
      /^(montre|affiche|liste)\s+(mes\s+)?dossiers?$/i,
      /^quels?\s+(sont\s+)?mes\s+dossiers?$/i,
      /^mes\s+dossiers?$/i,
      /^dossiers?$/i,
    ],
  },
};

const FOLDER_CONTENT_PATTERNS: Record<string, PatternSet> = {
  en: {
    patterns: [
      /^(show|list|display|what'?s?\s+in)\s+(the\s+)?(.+?)\s+folder$/i,
      /^(show|list)\s+(me\s+)?(files?\s+in|contents?\s+of)\s+(the\s+)?(.+?)(\s+folder)?$/i,
      /^(open|go\s+to)\s+(the\s+)?(.+?)\s+folder$/i,
      /^what('?s|\s+is)\s+(inside|in)\s+(the\s+)?(.+?)(\s+folder)?$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const folderMatch = fullMatch.match(
        /(?:in|of|to)\s+(?:the\s+)?(.+?)(?:\s+folder)?$/i
      );
      if (folderMatch) return folderMatch[1].trim();
      const simpleMatch = fullMatch.match(/(.+?)\s+folder$/i);
      if (simpleMatch) return simpleMatch[1].replace(/^(show|list|open|the)\s+/i, '').trim();
      return undefined;
    },
  },
  pt: {
    patterns: [
      /^(mostr[ae]|list[ae]|o\s+que\s+tem)\s+(na\s+pasta\s+)?(.+?)(\s+pasta)?$/i,
      /^(abr[aei]r?|ir\s+para)\s+(a\s+)?pasta\s+(.+)$/i,
      /^o\s+que\s+tem\s+(na\s+pasta\s+)?(.+)$/i,
      /^conte[uú]do\s+(da\s+pasta\s+)?(.+)$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const pastaMatch = fullMatch.match(/pasta\s+(.+)$/i);
      if (pastaMatch) return pastaMatch[1].trim();
      return undefined;
    },
  },
  es: {
    patterns: [
      /^(muestra|lista|qu[eé]\s+hay)\s+(en\s+la\s+carpeta\s+)?(.+?)(\s+carpeta)?$/i,
      /^(abrir|ir\s+a)\s+(la\s+)?carpeta\s+(.+)$/i,
      /^contenido\s+(de\s+la\s+carpeta\s+)?(.+)$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const carpetaMatch = fullMatch.match(/carpeta\s+(.+)$/i);
      if (carpetaMatch) return carpetaMatch[1].trim();
      return undefined;
    },
  },
  fr: {
    patterns: [
      /^(montre|affiche|qu'?y\s+a-?t-?il)\s+(dans\s+le\s+dossier\s+)?(.+?)(\s+dossier)?$/i,
      /^(ouvrir|aller\s+[àa])\s+(le\s+)?dossier\s+(.+)$/i,
      /^contenu\s+(du\s+dossier\s+)?(.+)$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const dossierMatch = fullMatch.match(/dossier\s+(.+)$/i);
      if (dossierMatch) return dossierMatch[1].trim();
      return undefined;
    },
  },
};

const FILE_LIST_PATTERNS: Record<string, PatternSet> = {
  en: {
    patterns: [
      /^(show|list|display)\s+(my\s+)?(all\s+)?files?$/i,
      /^(show|list|display)\s+(my\s+)?(all\s+)?documents?$/i,
      /^what\s+files?\s+(do\s+)?i\s+have$/i,
      /^my\s+(files?|documents?)$/i,
    ],
  },
  pt: {
    patterns: [
      /^(mostr[ae]|list[ae])\s+(os\s+)?(meus\s+)?arquivos?$/i,
      /^(mostr[ae]|list[ae])\s+(os\s+)?(meus\s+)?documentos?$/i,
      /^quais?\s+(s[aã]o\s+)?meus\s+(arquivos?|documentos?)$/i,
      /^meus\s+(arquivos?|documentos?)$/i,
    ],
  },
  es: {
    patterns: [
      /^(muestra|lista)\s+(mis\s+)?archivos?$/i,
      /^(muestra|lista)\s+(mis\s+)?documentos?$/i,
      /^cu[aá]les?\s+(son\s+)?mis\s+(archivos?|documentos?)$/i,
      /^mis\s+(archivos?|documentos?)$/i,
    ],
  },
  fr: {
    patterns: [
      /^(montre|affiche|liste)\s+(mes\s+)?fichiers?$/i,
      /^(montre|affiche|liste)\s+(mes\s+)?documents?$/i,
      /^quels?\s+(sont\s+)?mes\s+(fichiers?|documents?)$/i,
      /^mes\s+(fichiers?|documents?)$/i,
    ],
  },
};

const FILE_SEARCH_PATTERNS: Record<string, PatternSet> = {
  en: {
    patterns: [
      /^(find|search|look\s+for)\s+(file\s+)?(.+)$/i,
      /^(where\s+is|locate)\s+(the\s+)?(file\s+)?(.+)$/i,
      /^do\s+i\s+have\s+(.+)(\s+file)?$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const searchMatch = fullMatch.match(
        /(?:find|search|look\s+for|where\s+is|locate|have)\s+(?:the\s+)?(?:file\s+)?(.+?)(?:\s+file)?$/i
      );
      return searchMatch ? searchMatch[1].trim() : undefined;
    },
  },
  pt: {
    patterns: [
      /^(encontr[ae]|busca?r?|procur[ae])\s+(o\s+arquivo\s+)?(.+)$/i,
      /^onde\s+est[aá]\s+(o\s+)?(arquivo\s+)?(.+)$/i,
      /^eu\s+tenho\s+(.+)(\s+arquivo)?$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const searchMatch = fullMatch.match(
        /(?:encontr|busc|procur|onde|tenho)\w*\s+(?:o\s+)?(?:arquivo\s+)?(.+?)(?:\s+arquivo)?$/i
      );
      return searchMatch ? searchMatch[1].trim() : undefined;
    },
  },
  es: {
    patterns: [
      /^(busca|encuentra|buscar)\s+(el\s+archivo\s+)?(.+)$/i,
      /^d[oó]nde\s+est[aá]\s+(el\s+)?(archivo\s+)?(.+)$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const searchMatch = fullMatch.match(
        /(?:busca|encuentra|donde)\w*\s+(?:el\s+)?(?:archivo\s+)?(.+?)(?:\s+archivo)?$/i
      );
      return searchMatch ? searchMatch[1].trim() : undefined;
    },
  },
  fr: {
    patterns: [
      /^(trouve|cherche|recherche)\s+(le\s+fichier\s+)?(.+)$/i,
      /^o[uù]\s+est\s+(le\s+)?(fichier\s+)?(.+)$/i,
    ],
    extractTarget: (match) => {
      const fullMatch = match[0];
      const searchMatch = fullMatch.match(
        /(?:trouve|cherche|recherche|est)\s+(?:le\s+)?(?:fichier\s+)?(.+?)(?:\s+fichier)?$/i
      );
      return searchMatch ? searchMatch[1].trim() : undefined;
    },
  },
};

const DOCUMENT_COUNT_PATTERNS: Record<string, PatternSet> = {
  en: {
    patterns: [
      /^how\s+many\s+(files?|documents?|folders?)(\s+do\s+i\s+have)?$/i,
      /^count\s+(my\s+)?(files?|documents?|folders?)$/i,
      /^(total\s+)?(number\s+of|amount\s+of)\s+(my\s+)?(files?|documents?)$/i,
    ],
  },
  pt: {
    patterns: [
      /^quantos?\s+(arquivos?|documentos?|pastas?)(\s+eu\s+tenho)?$/i,
      /^cont[ae]\s+(meus\s+)?(arquivos?|documentos?|pastas?)$/i,
      /^(total\s+de|n[uú]mero\s+de)\s+(meus\s+)?(arquivos?|documentos?)$/i,
    ],
  },
  es: {
    patterns: [
      /^cu[aá]ntos?\s+(archivos?|documentos?|carpetas?)(\s+tengo)?$/i,
      /^cuenta\s+(mis\s+)?(archivos?|documentos?|carpetas?)$/i,
      /^(total\s+de|n[uú]mero\s+de)\s+(mis\s+)?(archivos?|documentos?)$/i,
    ],
  },
  fr: {
    patterns: [
      /^combien\s+(de\s+)?(fichiers?|documents?|dossiers?)(\s+ai-?je)?$/i,
      /^compte\s+(mes\s+)?(fichiers?|documents?|dossiers?)$/i,
      /^(total\s+de|nombre\s+de)\s+(mes\s+)?(fichiers?|documents?)$/i,
    ],
  },
};

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

function detectLanguage(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Portuguese indicators
  if (/\b(minha?s?|pasta|arquivo|mostr[ae]|list[ae]|quant[oa]s?|conte[uú]do)\b/.test(lowerQuery)) {
    return 'pt';
  }

  // Spanish indicators
  if (/\b(mis?|carpeta|archivo|muestra|lista|cu[aá]nt[oa]s?|contenido)\b/.test(lowerQuery)) {
    return 'es';
  }

  // French indicators
  if (/\b(mes?|dossier|fichier|montre|affiche|combien|contenu)\b/.test(lowerQuery)) {
    return 'fr';
  }

  return 'en';
}

function matchPatterns(
  query: string,
  patterns: Record<string, PatternSet>,
  language: string
): { matched: boolean; match?: RegExpMatchArray; extractTarget?: (m: RegExpMatchArray) => string | undefined } {
  // Try detected language first
  const langPatterns = patterns[language];
  if (langPatterns) {
    for (const pattern of langPatterns.patterns) {
      const match = query.match(pattern);
      if (match) {
        return { matched: true, match, extractTarget: langPatterns.extractTarget };
      }
    }
  }

  // Fall back to all languages
  for (const [lang, patternSet] of Object.entries(patterns)) {
    if (lang === language) continue;
    for (const pattern of patternSet.patterns) {
      const match = query.match(pattern);
      if (match) {
        return { matched: true, match, extractTarget: patternSet.extractTarget };
      }
    }
  }

  return { matched: false };
}

/**
 * Quick check if query might be a navigation intent (for fast filtering)
 */
export function mightBeNavigationIntent(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();
  const length = lowerQuery.length;

  // Skip very long queries
  if (length > 100) return false;

  // Navigation keywords
  const keywords = [
    'folder', 'file', 'document', 'show', 'list', 'display',
    'open', 'find', 'search', 'how many', 'count',
    'pasta', 'arquivo', 'mostra', 'lista', 'quantos',
    'carpeta', 'archivo', 'muestra', 'cuantos',
    'dossier', 'fichier', 'montre', 'combien',
  ];

  return keywords.some((kw) => lowerQuery.includes(kw));
}

/**
 * Detect navigation intent from query
 */
export function detectNavigationIntent(query: string): NavigationIntent {
  const normalizedQuery = query.trim();
  const language = detectLanguage(normalizedQuery);

  // Check folder list
  const folderListResult = matchPatterns(normalizedQuery, FOLDER_LIST_PATTERNS, language);
  if (folderListResult.matched) {
    return {
      type: 'FOLDER_LIST',
      confidence: 0.9,
      language,
    };
  }

  // Check folder content
  const folderContentResult = matchPatterns(normalizedQuery, FOLDER_CONTENT_PATTERNS, language);
  if (folderContentResult.matched && folderContentResult.extractTarget && folderContentResult.match) {
    const targetName = folderContentResult.extractTarget(folderContentResult.match);
    if (targetName) {
      return {
        type: 'FOLDER_CONTENT',
        confidence: 0.85,
        targetName,
        language,
      };
    }
  }

  // Check file list
  const fileListResult = matchPatterns(normalizedQuery, FILE_LIST_PATTERNS, language);
  if (fileListResult.matched) {
    return {
      type: 'FILE_LIST',
      confidence: 0.9,
      language,
    };
  }

  // Check file search
  const fileSearchResult = matchPatterns(normalizedQuery, FILE_SEARCH_PATTERNS, language);
  if (fileSearchResult.matched && fileSearchResult.extractTarget && fileSearchResult.match) {
    const searchTerm = fileSearchResult.extractTarget(fileSearchResult.match);
    if (searchTerm) {
      return {
        type: 'FILE_SEARCH',
        confidence: 0.8,
        searchTerm,
        language,
      };
    }
  }

  // Check document count
  const docCountResult = matchPatterns(normalizedQuery, DOCUMENT_COUNT_PATTERNS, language);
  if (docCountResult.matched) {
    return {
      type: 'DOCUMENT_COUNT',
      confidence: 0.9,
      language,
    };
  }

  return {
    type: 'NONE',
    confidence: 0,
    language,
  };
}

export default {
  detectNavigationIntent,
  mightBeNavigationIntent,
};
