/**
 * ============================================================================
 * KODA UNIFIED POST-PROCESSOR SERVICE
 * ============================================================================
 *
 * Single, centralized service that handles ALL post-processing logic.
 * Replaces 6+ conflicting/overlapping formatting services:
 *   - formatEnforcement.service.ts
 *   - formatEnforcementV2.service.ts
 *   - formatValidation.service.ts
 *   - responseFormatter.service.ts
 *   - outputPostProcessor.service.ts
 *   - answerPostProcessor.service.ts
 *   - kodaFormatEnforcement.service.ts
 *
 * THE KODA ANSWER CONTRACT:
 * 1. Language Consistency - Response matches query language (no mixing)
 * 2. Structure - Title (optional), intro, body, closing
 * 3. Formatting - Clean markdown, proper spacing, no excessive blank lines
 * 4. Citation Cleanup - Remove source sections, document names, raw links
 * 5. Deduplication - No duplicate paragraphs or sources
 * 6. Identity Normalization - No "I'm an AI" mentions
 *
 * Author: Unified Post-Processing System
 * Date: 2025-12-08
 */

import { smartProcessSpacing } from '../utils/markdownSpacing';
import { fixBrokenMarkdown, applyMarkdownContract } from './kodaMarkdownContract.service';
import { detectLanguageSimple } from './languageEngine.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type AnswerType =
  | 'greeting'
  | 'simple_factual'
  | 'file_action'
  | 'medium_explanation'
  | 'detailed_analysis'
  | 'structured_list'
  | 'comparison'
  | 'calculation';

export type QueryLanguage = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it' | 'other';

export interface PostProcessingInput {
  answer: string;
  query: string;
  sources?: Array<{
    documentId: string;
    documentName: string;
    score?: number;
    page?: number;
    chunk?: string;
  }>;
  queryLanguage?: QueryLanguage;
  answerType?: AnswerType;
  skipTitleEnforcement?: boolean;
  skipClosing?: boolean;
}

export interface PostProcessingResult {
  processedAnswer: string;
  stats: {
    languageCorrected: boolean;
    duplicatesRemoved: number;
    sourceSectionsRemoved: boolean;
    citationsFixed: number;
    spacingFixed: boolean;
    emojisRemoved: number;
    mojibakeFixed: number;
    identityNormalized: boolean;
  };
  dedupedSources: Array<{
    documentId: string;
    documentName: string;
    score?: number;
  }>;
}

// ============================================================================
// LANGUAGE DETECTION (Uses centralized languageEngine.service.ts)
// ============================================================================

/**
 * Detect language from text - uses centralized language engine
 * @deprecated Use detectLanguageSimple directly from languageEngine.service.ts
 */
export function detectLanguage(text: string): QueryLanguage {
  const detected = detectLanguageSimple(text, 'pt-BR');
  // Map SupportedLanguage to QueryLanguage format
  if (detected === 'pt-BR') return 'pt';
  if (detected === 'es') return 'es';
  if (detected === 'en') return 'en';
  // Default to 'en' for unsupported languages
  return 'en';
}

// ============================================================================
// ANSWER TYPE DETECTION
// ============================================================================

/**
 * Determine answer type based on query patterns
 */
export function determineAnswerType(query: string, responseLength: number): AnswerType {
  const queryLower = query.toLowerCase().trim();

  // Greeting patterns
  const greetingPatterns = [
    /^(hi|hello|hey|oi|olá|bom dia|boa tarde|boa noite|good morning|good afternoon|good evening)/i,
    /^how are you/i,
    /^what'?s up/i,
    /^thanks?|thank you|obrigad[oa]/i
  ];

  if (greetingPatterns.some(p => p.test(queryLower))) {
    return 'greeting';
  }

  // File action patterns
  const fileActionPatterns = [
    /^(show|find|search|locate|where is|list|get|open|display)\s+(me\s+)?(my\s+)?(the\s+)?/i,
    /which folder/i,
    /list (all|my)/i,
    /how many documents/i,
    /\.(pdf|docx?|xlsx?|pptx?|txt|csv)/i
  ];

  if (fileActionPatterns.some(p => p.test(queryLower))) {
    return 'file_action';
  }

  // Calculation patterns
  const calculationPatterns = [
    /calculate|compute|sum|total|average|mean|median|percentage|percent of/i,
    /how much|how many/i,
    /\d+\s*[\+\-\*\/\%]\s*\d+/
  ];

  if (calculationPatterns.some(p => p.test(queryLower))) {
    return 'calculation';
  }

  // Simple factual patterns
  const simplePatterns = [
    /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\s+\w+\s*\?*$/i,
    /^what is\s+\w+\s*\?*$/i,
    /^define\s+/i,
    /^when (is|was|did)/i,
    /^where (is|was|are)/i,
    /^who (is|was|are)/i
  ];

  if (simplePatterns.some(p => p.test(queryLower)) || responseLength < 100) {
    return 'simple_factual';
  }

  // Comparison patterns
  const comparisonPatterns = [
    /compare|comparison|versus|vs\.?|differ|difference|contrast/i,
    /(pros|advantages).*and.*(cons|disadvantages)/i
  ];

  if (comparisonPatterns.some(p => p.test(queryLower))) {
    return 'comparison';
  }

  // Detailed analysis patterns
  const detailedPatterns = [
    /step by step|step-by-step/i,
    /create a (full|complete|detailed|comprehensive)/i,
    /explain (in detail|thoroughly|completely)/i,
    /break(ing)? down/i,
    /comprehensive|in-depth/i
  ];

  if (detailedPatterns.some(p => p.test(queryLower)) || responseLength >= 400) {
    return 'detailed_analysis';
  }

  // Default to medium explanation
  return responseLength >= 100 ? 'medium_explanation' : 'simple_factual';
}

// ============================================================================
// MOJIBAKE REPAIR
// ============================================================================

const MOJIBAKE_MAP: Record<string, string> = {
  // Portuguese lowercase
  '\u00C3\u00A1': '\u00E1',  // Ã¡ -> á
  '\u00C3\u00A0': '\u00E0',  // Ã  -> à
  '\u00C3\u00A2': '\u00E2',  // Ã¢ -> â
  '\u00C3\u00A3': '\u00E3',  // Ã£ -> ã
  '\u00C3\u00A7': '\u00E7',  // Ã§ -> ç
  '\u00C3\u00A9': '\u00E9',  // Ã© -> é
  '\u00C3\u00AA': '\u00EA',  // Ãª -> ê
  '\u00C3\u00AD': '\u00ED',  // Ã­ -> í
  '\u00C3\u00B3': '\u00F3',  // Ã³ -> ó
  '\u00C3\u00B4': '\u00F4',  // Ã´ -> ô
  '\u00C3\u00B5': '\u00F5',  // Ãµ -> õ
  '\u00C3\u00BA': '\u00FA',  // Ãº -> ú
  // Portuguese uppercase
  '\u00C3\u0080': '\u00C0',  // Ã€ -> À
  '\u00C3\u0089': '\u00C9',  // Ã‰ -> É
  '\u00C3\u008D': '\u00CD',  // Ã -> Í
  '\u00C3\u0093': '\u00D3',  // Ã" -> Ó
  '\u00C3\u009A': '\u00DA',  // Ãš -> Ú
  // Special characters
  '\u00E2\u0080\u0093': '\u2013',  // en-dash
  '\u00E2\u0080\u0094': '\u2014',  // em-dash
  '\u00E2\u0080\u0098': '\u2018',  // left single quote
  '\u00E2\u0080\u0099': '\u2019',  // right single quote
  '\u00E2\u0080\u009C': '\u201C',  // left double quote
  '\u00E2\u0080\u009D': '\u201D',  // right double quote
  '\u00C2\u00A0': ' ',             // non-breaking space
};

function repairMojibake(text: string): { text: string; count: number } {
  if (!text) return { text, count: 0 };

  let cleaned = text;
  let count = 0;

  for (const [badPattern, goodChar] of Object.entries(MOJIBAKE_MAP)) {
    if (cleaned.includes(badPattern)) {
      const occurrences = cleaned.split(badPattern).length - 1;
      count += occurrences;
      cleaned = cleaned.split(badPattern).join(goodChar);
    }
  }

  return { text: cleaned, count };
}

// ============================================================================
// EMOJI REMOVAL
// ============================================================================

function removeEmojis(text: string): { text: string; count: number } {
  if (!text) return { text, count: 0 };

  // Comprehensive emoji regex
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu;

  const matches = text.match(emojiPattern);
  const count = matches ? matches.length : 0;
  const cleaned = text.replace(emojiPattern, '').replace(/  +/g, ' ');

  return { text: cleaned, count };
}

// ============================================================================
// SOURCE SECTION REMOVAL
// ============================================================================

function removeSourceSections(text: string): { text: string; removed: boolean } {
  const patterns = [
    /\n#{1,6}\s*(?:Sources?|Fontes?|References?|Referências?)\s*\n[\s\S]*$/i,
    /\n\*\*(?:Sources?|Fontes?|References?):\*\*\s*\n[\s\S]*$/i,
    /\n(?:Sources?|Fontes?|References?):\s*\n[\s\S]*$/i,
    /\n---+\s*\n\*\*(?:Sources?|Fontes?):\*\*[\s\S]*$/i,
  ];

  let cleaned = text;
  let removed = false;

  for (const pattern of patterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '');
      removed = true;
    }
  }

  return { text: cleaned.trim(), removed };
}

// ============================================================================
// DOCUMENT NAMES REMOVAL
// ============================================================================

function removeDocumentNames(text: string): { text: string; count: number } {
  const patterns = [
    /\(\*\*[^)]+\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)\*\*\)/gi,
    /\(\*[^)]+\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)\*\)/gi,
    /\([^)]+\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)\)/gi,
  ];

  let cleaned = text;
  let count = 0;

  for (const pattern of patterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      count += matches.length;
      cleaned = cleaned.replace(pattern, '');
    }
  }

  return { text: cleaned, count };
}

// ============================================================================
// RAW LINK REMOVAL
// ============================================================================

function removeRawLinks(text: string): { text: string; count: number } {
  const pattern = /\{\{DOC:::[a-f0-9-]+\}\}/gi;
  const matches = text.match(pattern);
  const count = matches ? matches.length : 0;
  const cleaned = text.replace(pattern, '');

  return { text: cleaned, count };
}

// ============================================================================
// DUPLICATE PARAGRAPH REMOVAL
// ============================================================================

function removeDuplicateParagraphs(text: string): { text: string; removed: number } {
  if (!text) return { text, removed: 0 };

  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const seen = new Set<string>();
  const unique: string[] = [];
  let removed = 0;

  for (const para of paragraphs) {
    const normalized = para.toLowerCase().replace(/\s+/g, ' ').trim();

    // Skip very short paragraphs
    if (normalized.length < 30) {
      unique.push(para);
      continue;
    }

    if (seen.has(normalized)) {
      removed++;
      continue;
    }

    // Check for near-duplicates (Jaccard similarity > 0.85)
    let isDuplicate = false;
    const words1 = new Set(normalized.split(/\s+/).filter(w => w.length > 2));

    for (const seenPara of seen) {
      const words2 = new Set(seenPara.split(/\s+/).filter(w => w.length > 2));
      const intersection = new Set([...words1].filter(w => words2.has(w)));
      const union = new Set([...words1, ...words2]);
      const similarity = intersection.size / union.size;

      if (similarity > 0.85) {
        isDuplicate = true;
        removed++;
        break;
      }
    }

    if (!isDuplicate) {
      seen.add(normalized);
      unique.push(para);
    }
  }

  return { text: unique.join('\n\n'), removed };
}

// ============================================================================
// IDENTITY NORMALIZATION
// ============================================================================

function normalizeIdentity(text: string): { text: string; normalized: boolean } {
  const rules = [
    { pattern: /\bI am an AI\b/gi, replacement: 'I' },
    { pattern: /\bAs an AI\b/gi, replacement: '' },
    { pattern: /\bI'm an AI assistant\b/gi, replacement: "I'm Koda" },
    { pattern: /\bI am a language model\b/gi, replacement: 'I' },
    { pattern: /\bI am an artificial intelligence\b/gi, replacement: 'I' },
    { pattern: /\bAs a large language model\b/gi, replacement: '' },
    { pattern: /\bSou uma IA\b/gi, replacement: 'Sou a Koda' },
    { pattern: /\bComo IA\b/gi, replacement: '' },
  ];

  let normalized = text;
  let wasNormalized = false;

  for (const rule of rules) {
    if (rule.pattern.test(normalized)) {
      normalized = normalized.replace(rule.pattern, rule.replacement);
      wasNormalized = true;
    }
  }

  // Clean up any double spaces created
  normalized = normalized.replace(/  +/g, ' ').trim();

  return { text: normalized, normalized: wasNormalized };
}

// ============================================================================
// SPACING NORMALIZATION
// ============================================================================

function normalizeSpacing(text: string): { text: string; fixed: boolean } {
  let fixed = text;
  let wasFixed = false;

  // Process spacing tokens first
  fixed = smartProcessSpacing(fixed);

  // Remove excessive blank lines (max 2)
  if (/\n{3,}/.test(fixed)) {
    fixed = fixed.replace(/\n{3,}/g, '\n\n');
    wasFixed = true;
  }

  // Remove trailing spaces
  if (/ +\n/.test(fixed)) {
    fixed = fixed.replace(/ +\n/g, '\n');
    wasFixed = true;
  }

  // Ensure headers have proper spacing
  fixed = fixed.replace(/\n{3,}(#{1,6}\s+)/g, '\n\n$1');
  fixed = fixed.replace(/(#{1,6}\s+[^\n]+)\n{3,}/g, '$1\n\n');

  return { text: fixed.trim(), fixed: wasFixed };
}

// ============================================================================
// EMPTY BULLET CLEANUP
// ============================================================================

function cleanEmptyBullets(text: string): string {
  return text.replace(/^\s*[•\-\*]\s*$/gm, '');
}

// ============================================================================
// LANGUAGE-SPECIFIC PHRASE CLEANUP
// ============================================================================

const ENGLISH_PREFIXES_TO_REMOVE = [
  /^Based on (your |the )?documents?,?\s*/i,
  /^According to (your |the )?documents?,?\s*/i,
  /^From (your |the )?documents?,?\s*/i,
  /^Looking at (your |the )?documents?,?\s*/i,
  /^After reviewing (your |the )?documents?,?\s*/i,
  /^I found (that |the following )?(in (your |the )?documents?,?\s*)?/i,
  /^Here('s| is) what I found:?\s*/i,
];

const PORTUGUESE_PREFIXES_TO_REMOVE = [
  /^Com base nos? (seus? )?documentos?,?\s*/i,
  /^De acordo com (os? |seus? )?documentos?,?\s*/i,
  /^Analisando (os? |seus? )?documentos?,?\s*/i,
  /^Encontrei (que |o seguinte )?(nos? (seus? )?documentos?,?\s*)?/i,
  /^Aqui está o que encontrei:?\s*/i,
];

function removeLanguageMixingPrefixes(text: string, queryLanguage: QueryLanguage): string {
  let cleaned = text;

  // If query is Portuguese, remove English prefixes that may have slipped in
  if (queryLanguage === 'pt') {
    for (const pattern of ENGLISH_PREFIXES_TO_REMOVE) {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  // If query is English, remove Portuguese prefixes
  if (queryLanguage === 'en') {
    for (const pattern of PORTUGUESE_PREFIXES_TO_REMOVE) {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  return cleaned.trim();
}

// ============================================================================
// SOURCE DEDUPLICATION
// ============================================================================

function deduplicateSources(
  sources: Array<{ documentId: string; documentName: string; score?: number }>
): Array<{ documentId: string; documentName: string; score?: number }> {
  const seen = new Set<string>();
  const unique: Array<{ documentId: string; documentName: string; score?: number }> = [];

  for (const source of sources) {
    if (!seen.has(source.documentId)) {
      seen.add(source.documentId);
      unique.push(source);
    }
  }

  // Sort by score descending
  unique.sort((a, b) => (b.score || 0) - (a.score || 0));

  return unique;
}

// ============================================================================
// MAIN UNIFIED POST-PROCESSOR
// ============================================================================

export class KodaUnifiedPostProcessor {
  /**
   * Process answer through the unified pipeline
   *
   * Pipeline order:
   * 1. Mojibake repair (encoding issues)
   * 2. Language mixing cleanup
   * 3. Source section removal
   * 4. Document names removal
   * 5. Raw link removal
   * 6. Identity normalization
   * 7. Duplicate paragraph removal
   * 8. Emoji removal
   * 9. Empty bullet cleanup
   * 10. Spacing normalization
   * 11. Source deduplication
   */
  process(input: PostProcessingInput): PostProcessingResult {
    console.log('[UNIFIED POST-PROCESSOR] Starting unified post-processing...');

    const { answer, query, sources = [] } = input;

    // Detect language if not provided
    const queryLanguage = input.queryLanguage || detectLanguage(query);

    // Determine answer type if not provided
    const answerType = input.answerType || determineAnswerType(query, answer.length);

    console.log(`[UNIFIED POST-PROCESSOR] Language: ${queryLanguage}, Type: ${answerType}`);

    let processed = answer;
    const stats = {
      languageCorrected: false,
      duplicatesRemoved: 0,
      sourceSectionsRemoved: false,
      citationsFixed: 0,
      spacingFixed: false,
      emojisRemoved: 0,
      mojibakeFixed: 0,
      identityNormalized: false,
    };

    // Step 1: Mojibake repair
    const mojibakeResult = repairMojibake(processed);
    processed = mojibakeResult.text;
    stats.mojibakeFixed = mojibakeResult.count;
    if (mojibakeResult.count > 0) {
      console.log(`[UNIFIED POST-PROCESSOR] Fixed ${mojibakeResult.count} mojibake issues`);
    }

    // Step 2: Language mixing cleanup
    const beforeLangCleanup = processed;
    processed = removeLanguageMixingPrefixes(processed, queryLanguage);
    stats.languageCorrected = processed !== beforeLangCleanup;
    if (stats.languageCorrected) {
      console.log('[UNIFIED POST-PROCESSOR] Removed language-mixing prefixes');
    }

    // Step 3: Source section removal
    const sourceSectionResult = removeSourceSections(processed);
    processed = sourceSectionResult.text;
    stats.sourceSectionsRemoved = sourceSectionResult.removed;
    if (sourceSectionResult.removed) {
      console.log('[UNIFIED POST-PROCESSOR] Removed source sections');
    }

    // Step 4: Document names removal
    const docNamesResult = removeDocumentNames(processed);
    processed = docNamesResult.text;
    stats.citationsFixed += docNamesResult.count;
    if (docNamesResult.count > 0) {
      console.log(`[UNIFIED POST-PROCESSOR] Removed ${docNamesResult.count} document name references`);
    }

    // Step 5: Raw link removal
    const rawLinksResult = removeRawLinks(processed);
    processed = rawLinksResult.text;
    stats.citationsFixed += rawLinksResult.count;
    if (rawLinksResult.count > 0) {
      console.log(`[UNIFIED POST-PROCESSOR] Removed ${rawLinksResult.count} raw links`);
    }

    // Step 6: Identity normalization
    const identityResult = normalizeIdentity(processed);
    processed = identityResult.text;
    stats.identityNormalized = identityResult.normalized;
    if (identityResult.normalized) {
      console.log('[UNIFIED POST-PROCESSOR] Normalized identity references');
    }

    // Step 7: Duplicate paragraph removal
    const dedupResult = removeDuplicateParagraphs(processed);
    processed = dedupResult.text;
    stats.duplicatesRemoved = dedupResult.removed;
    if (dedupResult.removed > 0) {
      console.log(`[UNIFIED POST-PROCESSOR] Removed ${dedupResult.removed} duplicate paragraphs`);
    }

    // Step 8: Emoji removal (Koda should not use emojis)
    const emojiResult = removeEmojis(processed);
    processed = emojiResult.text;
    stats.emojisRemoved = emojiResult.count;
    if (emojiResult.count > 0) {
      console.log(`[UNIFIED POST-PROCESSOR] Removed ${emojiResult.count} emojis`);
    }

    // Step 9: Empty bullet cleanup
    processed = cleanEmptyBullets(processed);

    // Step 10: Fix broken markdown (unbalanced ** and ```) using contract
    processed = fixBrokenMarkdown(processed);
    console.log('[UNIFIED POST-PROCESSOR] Fixed any broken markdown');

    // Step 11: Spacing normalization
    const spacingResult = normalizeSpacing(processed);
    processed = spacingResult.text;
    stats.spacingFixed = spacingResult.fixed;

    // Step 12: Source deduplication
    const dedupedSources = deduplicateSources(sources);

    console.log('[UNIFIED POST-PROCESSOR] Post-processing complete');

    return {
      processedAnswer: processed,
      stats,
      dedupedSources,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const kodaUnifiedPostProcessor = new KodaUnifiedPostProcessor();
export default kodaUnifiedPostProcessor;
