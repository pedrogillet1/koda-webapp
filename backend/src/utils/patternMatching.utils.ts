/**
 * PATTERN MATCHING UTILITIES
 * Entity extraction and query normalization utilities for Koda Intent System V2
 *
 * Used by kodaPatternClassification.service.ts for extracting:
 * - Document names
 * - Folder names
 * - Tags
 * - Dates
 * - Numbers
 * - Keywords
 */

// ============================================================================
// QUERY NORMALIZATION
// ============================================================================

/**
 * Normalize query for pattern matching
 * - Lowercase
 * - Remove extra whitespace
 * - Normalize accents (optional)
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Remove accents from text for matching
 */
export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================================================
// DOCUMENT NAME EXTRACTION
// ============================================================================

/**
 * Extract document name from query
 * Handles patterns like:
 * - "in document X"
 * - "from the file X"
 * - "no documento X"
 * - "del archivo X"
 * - Quoted names: "document.pdf"
 */
export function extractDocumentName(query: string): string | null {
  const patterns = [
    // Quoted document names (highest priority)
    /["']([^"']+\.(?:pdf|docx?|xlsx?|pptx?|txt|csv))["']/i,
    /["']([^"']+)["']/i,

    // English patterns
    /(?:in|from|the|document|file|doc)\s+(?:called|named|titled)?\s*["']?([^"'\s,]+(?:\.[a-z]{2,4})?)["']?/i,
    /(?:document|file|doc)\s+["']?([^"'\s,]+(?:\.[a-z]{2,4})?)["']?/i,

    // Portuguese patterns
    /(?:no|do|da|na|documento|arquivo)\s+(?:chamado|com nome)?\s*["']?([^"'\s,]+(?:\.[a-z]{2,4})?)["']?/i,
    /(?:documento|arquivo)\s+["']?([^"'\s,]+(?:\.[a-z]{2,4})?)["']?/i,

    // Spanish patterns
    /(?:en|del|de la|documento|archivo)\s+(?:llamado|con nombre)?\s*["']?([^"'\s,]+(?:\.[a-z]{2,4})?)["']?/i,
    /(?:documento|archivo)\s+["']?([^"'\s,]+(?:\.[a-z]{2,4})?)["']?/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// ============================================================================
// FOLDER NAME EXTRACTION
// ============================================================================

/**
 * Extract folder name from query
 * Handles patterns like:
 * - "in folder X"
 * - "from the folder X"
 * - "na pasta X"
 * - "en la carpeta X"
 */
export function extractFolderName(query: string): string | null {
  const patterns = [
    // Quoted folder names
    /(?:folder|pasta|carpeta)\s+["']([^"']+)["']/i,

    // English patterns
    /(?:in|from|the)\s+(?:folder|directory)\s+(?:called|named)?\s*["']?([^"'\s,]+)["']?/i,
    /(?:folder|directory)\s+["']?([^"'\s,]+)["']?/i,

    // Portuguese patterns
    /(?:na|da|do)\s+pasta\s+(?:chamada?)?\s*["']?([^"'\s,]+)["']?/i,
    /pasta\s+["']?([^"'\s,]+)["']?/i,

    // Spanish patterns
    /(?:en|de)\s+(?:la\s+)?carpeta\s+(?:llamada?)?\s*["']?([^"'\s,]+)["']?/i,
    /carpeta\s+["']?([^"'\s,]+)["']?/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// ============================================================================
// TAG EXTRACTION
// ============================================================================

/**
 * Extract tags from query
 * Handles patterns like:
 * - "#tag"
 * - "tagged with X"
 * - "with tag X"
 * - "com tag X"
 */
export function extractTags(query: string): string[] {
  const tags: string[] = [];

  // Hashtag pattern
  const hashtagMatches = query.match(/#(\w+)/g);
  if (hashtagMatches) {
    tags.push(...hashtagMatches.map(t => t.substring(1)));
  }

  // "tagged with" patterns
  const taggedPatterns = [
    /(?:tagged|tag|etiquetado|marcado)\s+(?:with|como|con)?\s*["']?(\w+)["']?/gi,
    /(?:with|com|con)\s+tag\s+["']?(\w+)["']?/gi
  ];

  for (const pattern of taggedPatterns) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      if (match[1] && !tags.includes(match[1].toLowerCase())) {
        tags.push(match[1].toLowerCase());
      }
    }
  }

  return tags;
}

// ============================================================================
// DATE EXTRACTION
// ============================================================================

/**
 * Extract dates from query
 * Returns ISO date strings
 */
export function extractDates(query: string): string[] {
  const dates: string[] = [];
  const now = new Date();

  // Relative dates (English, Portuguese, Spanish)
  const relativeDateMap: Record<string, () => Date> = {
    // Today
    'today': () => now,
    'hoje': () => now,
    'hoy': () => now,

    // Yesterday
    'yesterday': () => new Date(now.getTime() - 24 * 60 * 60 * 1000),
    'ontem': () => new Date(now.getTime() - 24 * 60 * 60 * 1000),
    'ayer': () => new Date(now.getTime() - 24 * 60 * 60 * 1000),

    // Last week
    'last week': () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    'semana passada': () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    'la semana pasada': () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),

    // Last month
    'last month': () => new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
    'mês passado': () => new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
    'el mes pasado': () => new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),

    // This week
    'this week': () => now,
    'esta semana': () => now,

    // This month
    'this month': () => now,
    'este mês': () => now,
    'este mes': () => now,
  };

  const queryLower = query.toLowerCase();
  for (const [pattern, getDate] of Object.entries(relativeDateMap)) {
    if (queryLower.includes(pattern)) {
      dates.push(getDate().toISOString().split('T')[0]);
    }
  }

  // Absolute date patterns
  const absolutePatterns = [
    // YYYY-MM-DD
    /(\d{4}-\d{2}-\d{2})/g,
    // DD/MM/YYYY or MM/DD/YYYY
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // Month Day, Year (e.g., January 15, 2024)
    /((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/gi,
    // Day Month Year (e.g., 15 January 2024)
    /(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/gi
  ];

  for (const pattern of absolutePatterns) {
    const matches = query.match(pattern);
    if (matches) {
      for (const match of matches) {
        try {
          const parsed = new Date(match);
          if (!isNaN(parsed.getTime())) {
            dates.push(parsed.toISOString().split('T')[0]);
          }
        } catch {
          // Skip invalid dates
        }
      }
    }
  }

  return [...new Set(dates)]; // Remove duplicates
}

// ============================================================================
// NUMBER EXTRACTION
// ============================================================================

/**
 * Extract numbers from query
 */
export function extractNumbers(query: string): number[] {
  const numbers: number[] = [];

  // Match integers and decimals
  const matches = query.match(/\b\d+(?:\.\d+)?\b/g);
  if (matches) {
    for (const match of matches) {
      const num = parseFloat(match);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  // Match written numbers (English)
  const writtenNumbers: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
    // Portuguese
    'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
    // Spanish (excluding duplicates with Portuguese)
    'uno': 1, 'una': 1, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10
  };

  const queryLower = query.toLowerCase();
  for (const [word, value] of Object.entries(writtenNumbers)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(queryLower)) {
      if (!numbers.includes(value)) {
        numbers.push(value);
      }
    }
  }

  return numbers;
}

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

/**
 * Extract keywords from query (removes stop words)
 */
export function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    // English
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
    'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
    'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',

    // Portuguese
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
    'em', 'na', 'no', 'nas', 'nos', 'por', 'para', 'com', 'sem', 'sob', 'sobre',
    'e', 'ou', 'mas', 'porém', 'contudo', 'todavia', 'entretanto', 'se', 'que',
    'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'meu', 'minha', 'teu', 'tua',
    'seu', 'sua', 'nosso', 'nossa', 'vosso', 'vossa', 'este', 'esta', 'esse', 'essa',
    'aquele', 'aquela', 'isto', 'isso', 'aquilo',

    // Spanish
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'del', 'al',
    'y', 'o', 'pero', 'sino', 'aunque', 'porque', 'como', 'cuando', 'donde',
    'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
    'mi', 'tu', 'su', 'nuestro', 'vuestro', 'este', 'ese', 'aquel'
  ]);

  const words = normalizeQuery(query)
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)];
}

// ============================================================================
// DOCUMENT TYPE EXTRACTION
// ============================================================================

/**
 * Extract document type from query
 */
export function extractDocumentType(query: string): string | null {
  const typePatterns: Record<string, string[]> = {
    'pdf': ['pdf', 'pdfs'],
    'docx': ['docx', 'doc', 'word', 'documento word'],
    'xlsx': ['xlsx', 'xls', 'excel', 'planilha', 'spreadsheet'],
    'pptx': ['pptx', 'ppt', 'powerpoint', 'presentation', 'apresentação'],
    'txt': ['txt', 'text', 'texto'],
    'csv': ['csv'],
    'image': ['image', 'imagem', 'imagen', 'photo', 'foto', 'picture', 'png', 'jpg', 'jpeg', 'gif']
  };

  const queryLower = query.toLowerCase();

  for (const [type, keywords] of Object.entries(typePatterns)) {
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        return type;
      }
    }
  }

  return null;
}

// ============================================================================
// COMBINED ENTITY EXTRACTION
// ============================================================================

export interface ExtractedEntities {
  documentName: string | null;
  folderName: string | null;
  tags: string[];
  dates: string[];
  numbers: number[];
  keywords: string[];
  documentType: string | null;
}

/**
 * Extract all entities from query
 */
export function extractAllEntities(query: string): ExtractedEntities {
  return {
    documentName: extractDocumentName(query),
    folderName: extractFolderName(query),
    tags: extractTags(query),
    dates: extractDates(query),
    numbers: extractNumbers(query),
    keywords: extractKeywords(query),
    documentType: extractDocumentType(query)
  };
}
