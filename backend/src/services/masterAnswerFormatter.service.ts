/**
 * ============================================================================
 * MASTER ANSWER FORMATTER SERVICE - SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * PURPOSE: Consolidates ALL formatting logic into ONE service
 * Replaces: 13 conflicting format services
 *
 * RESPONSIBILITIES:
 * 1. Language detection and consistency enforcement
 * 2. Source deduplication (each source appears ONCE)
 * 3. UTF-8 encoding fixes (Ã → á, Ã§ → ç, etc.)
 * 4. Citation formatting (inline markers)
 * 5. Answer completion verification
 * 6. Markdown structure enforcement (via Koda Markdown Contract)
 * 7. Bold text formatting (selective, not aggressive)
 * 8. List formatting (tight, no gaps)
 * 9. Document name formatting (clickable links)
 *
 * RULES:
 * - NO other service should modify answer format
 * - NO other service should add/remove citations
 * - This is the ONLY formatter in the system
 *
 * UPDATED: Now uses Koda Markdown Contract for ChatGPT-like formatting
 *
 * ============================================================================
 */

// DEPRECATED: documentNameFormatter moved to _deprecated - using stubs
import {
  formatDocumentNamesForFrontend,
  addSeeAllLink,
  formatDocumentList,
  DocSource,
} from './deletedServiceStubs';

import { applySmartBolding } from './smartBoldingEnhanced.service';
import { documentNameNormalizer } from './documentNameNormalizer.service';
import { detectLanguageSimple } from './languageEngine.service';

// NEW: Import Koda Markdown Contract
import {
  applyMarkdownContract,
  processAnswerWithContract,
  validateMarkdownContract,
  removeAggressiveBold,
  applySelectiveBold,
  formatDocumentNamesContract,
  buildSourcesSection,
  MarkdownContractOptions
} from './kodaMarkdownContract.service';

interface Source {
  documentId: string;
  documentName?: string;
  filename?: string;
  title?: string;
  mimeType?: string;
  relevance?: number;
  pages?: number[];
}
// Also use DocSource from stubs
type _DocSource = DocSource;

interface FormatOptions {
  language?: string;
  enforceLanguage?: boolean;
  addBoldHeadings?: boolean;
  fixEncoding?: boolean;
  deduplicateSources?: boolean;
  addInlineCitations?: boolean;
  formatDocumentNames?: boolean; // Add clickable document name markers
  useMarkdownContract?: boolean; // NEW: Use Koda Markdown Contract for ChatGPT-style formatting
}

interface FormattedResult {
  answer: string;
  sources: Source[];
  language: string;
  stats: {
    wordCount: number;
    sourceCount: number;
    hasHeadings: boolean;
    hasBoldText: boolean;
    hasList: boolean;
  };
}

// ============================================================================
// 1. LANGUAGE DETECTION (Uses centralized languageEngine.service.ts)
// ============================================================================

/**
 * Detect language from text - uses centralized language engine
 * @deprecated Use detectLanguageSimple directly from languageEngine.service.ts
 */
function detectLanguage(text: string): string {
  const detected = detectLanguageSimple(text, 'pt-BR');
  // Map SupportedLanguage to legacy format
  if (detected === 'pt-BR') return 'pt';
  return detected;
}

// ============================================================================
// 2. UTF-8 ENCODING FIXES
// ============================================================================

function fixUTF8Encoding(text: string): string {
  const replacements: Record<string, string> = {
    // Common Portuguese encoding issues
    'Ã¡': 'á', 'Ã ': 'à', 'Ã£': 'ã', 'Ã¢': 'â',
    'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê',
    'Ã­': 'í', 'Ã¬': 'ì',
    'Ã³': 'ó', 'Ã²': 'ò', 'Ãµ': 'õ', 'Ã´': 'ô',
    'Ãº': 'ú', 'Ã¹': 'ù',
    'Ã§': 'ç',
    'Ã': 'Á', 'Ã€': 'À', 'Ãƒ': 'Ã', 'Ã‚': 'Â',
    'Ã‰': 'É', 'Ãˆ': 'È', 'ÃŠ': 'Ê',
    'ÃŒ': 'Ì',
    'Ãš': 'Ú', 'Ã™': 'Ù',
    'Ã‡': 'Ç',
    'Â°': '°', 'Â²': '²', 'Â³': '³',
  };

  let fixed = text;
  for (const [wrong, correct] of Object.entries(replacements)) {
    fixed = fixed.split(wrong).join(correct);
  }

  return fixed;
}

// ============================================================================
// 3. SOURCE DEDUPLICATION
// ============================================================================

function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const unique: Source[] = [];

  for (const source of sources) {
    const key = source.documentId || source.filename || source.title || '';
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(source);
    }
  }

  console.log(`[MasterFormatter] Deduplicated sources: ${sources.length} → ${unique.length}`);
  return unique;
}

// ============================================================================
// 4. INLINE CITATION INSERTION
// ============================================================================

function addInlineCitations(answer: string, sources: Source[]): string {
  if (sources.length === 0) return answer;

  let formatted = answer;

  // For each source, find mentions and add inline citation
  sources.forEach((source, index) => {
    const sourceName = source.documentName || source.filename || source.title || '';
    if (!sourceName) return;

    // Create citation marker
    const citationMarker = `[[${sourceName}]]`;

    // Find all mentions of this source in the answer
    const regex = new RegExp(`\\b${escapeRegex(sourceName)}\\b`, 'gi');
    
    let matches = 0;
    formatted = formatted.replace(regex, (match) => {
      matches++;
      // Only add citation marker once per source
      if (matches === 1) {
        return `${match} ${citationMarker}`;
      }
      return match;
    });
  });

  return formatted;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// 5. LANGUAGE CONSISTENCY ENFORCEMENT
// ============================================================================

function enforceLanguageConsistency(answer: string, targetLanguage: string): string {
  // Detect if answer starts in wrong language
  const firstSentence = answer.split(/[.!?]/)[0];
  const detectedLang = detectLanguage(firstSentence);

  if (detectedLang !== targetLanguage) {
    console.warn(`[MasterFormatter] Language mismatch: detected ${detectedLang}, expected ${targetLanguage}`);
    
    // Remove common English prefixes
    const englishPrefixes = [
      'Based on your documents, ',
      'Based on the documents, ',
      'According to your documents, ',
      'According to the documents, ',
      'From your documents, ',
      'From the documents, ',
      'Here\'s what I found: ',
      'Here is what I found: ',
      'The documents show that ',
      'The documents indicate that ',
    ];

    for (const prefix of englishPrefixes) {
      if (answer.startsWith(prefix)) {
        answer = answer.substring(prefix.length);
        console.log(`[MasterFormatter] Removed English prefix: "${prefix}"`);
        break;
      }
    }
  }

  return answer;
}

// ============================================================================
// 6. COMPLETION VERIFICATION
// ============================================================================

function verifyCompletion(answer: string): { isComplete: boolean; reason?: string } {
  const trimmed = answer.trim();
  
  // Check for incomplete endings
  if (trimmed.endsWith(',')) {
    return { isComplete: false, reason: 'Ends with comma' };
  }
  
  if (trimmed.endsWith(':')) {
    return { isComplete: false, reason: 'Ends with colon' };
  }
  
  if (/\.\.\.$/.test(trimmed)) {
    return { isComplete: false, reason: 'Ends with ellipsis' };
  }
  
  // Check for incomplete list starters
  if (/\b(como|such as|including|e\.g\.|for example|like)\s*$/i.test(trimmed)) {
    return { isComplete: false, reason: 'Incomplete list starter' };
  }
  
  // Check for incomplete sentences
  if (/\b(Indivíduos que|People who|Companies that|Documents that|Files that)\s*$/i.test(trimmed)) {
    return { isComplete: false, reason: 'Incomplete sentence' };
  }
  
  // Check if too short
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 10) {
    return { isComplete: false, reason: `Too short (${wordCount} words)` };
  }
  
  return { isComplete: true };
}

// ============================================================================
// 7. MARKDOWN STRUCTURE ENFORCEMENT
// ============================================================================

function enforceMarkdownStructure(answer: string): string {
  let formatted = answer;

  // Ensure consistent heading format
  formatted = formatted.replace(/^#{1,6}\s+/gm, (match) => {
    return match.trim() + ' ';
  });

  // Ensure blank line before headings
  formatted = formatted.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');

  // Ensure blank line after headings
  formatted = formatted.replace(/(#{1,6}\s+[^\n]+)\n([^#\n])/g, '$1\n\n$2');

  // Ensure consistent list formatting
  formatted = formatted.replace(/^([•\-\*])\s+/gm, '- ');

  // Ensure blank line before lists
  formatted = formatted.replace(/([^\n])\n([\-\*]\s+)/g, '$1\n\n$2');

  // Remove excessive blank lines (max 2)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted;
}

// ============================================================================
// 8. BOLD TEXT FORMATTING
// ============================================================================

function ensureBoldFormatting(answer: string): string {
  let formatted = answer;

  // Bold headings that aren't already markdown headings
  formatted = formatted.replace(/^([A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][A-ZÀÁÃÂÉÊÍÓÕÔÚÇa-zàáãâéêíóõôúç\s]+):$/gm, '**$1:**');

  // Bold key terms (if followed by colon and definition)
  formatted = formatted.replace(/^([A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][a-zàáãâéêíóõôúç]+(?:\s+[A-ZÀÁÃÂÉÊÍÓÕÔÚÇ][a-zàáãâéêíóõôúç]+)*):(?!\*\*)/gm, '**$1:**');

  return formatted;
}

// ============================================================================
// 9. MAIN FORMAT FUNCTION
// ============================================================================

export function formatAnswer(
  answer: string,
  sources: Source[] = [],
  options: FormatOptions = {}
): FormattedResult {
  const {
    language = 'pt',
    enforceLanguage = true,
    addBoldHeadings = true,
    fixEncoding = true,
    deduplicateSources: dedupe = true,
    addInlineCitations: addCitations = false,
    formatDocumentNames: formatDocs = true,
    useMarkdownContract = true // NEW: Default enabled for ChatGPT-style formatting
  } = options;

  console.log('[MasterFormatter] Starting format process...');

  // Step 1: Fix UTF-8 encoding
  let formatted = fixEncoding ? fixUTF8Encoding(answer) : answer;
  console.log('[MasterFormatter] ✓ Fixed encoding');

  // Step 2: Enforce language consistency
  if (enforceLanguage) {
    formatted = enforceLanguageConsistency(formatted, language);
    console.log('[MasterFormatter] ✓ Enforced language consistency');
  }

  // Step 3: Deduplicate sources early
  let finalSources = dedupe ? deduplicateSources(sources) : sources;
  console.log('[MasterFormatter] ✓ Deduplicated sources');

  // =========================================================================
  // NEW: Use Koda Markdown Contract for ChatGPT-style formatting
  // =========================================================================
  if (useMarkdownContract) {
    // Extract document names for the contract
    const documentNames = finalSources.map(s => s.documentName || s.filename || s.title || '').filter(Boolean);

    // Apply the full markdown contract pipeline
    formatted = processAnswerWithContract(formatted, documentNames, {
      maxNewlines: 2,
      normalizeHeadings: true,
      normalizeBullets: true,
      tightLists: true,
      selectiveBold: true,
      removeArtifacts: true
    });

    console.log('[MasterFormatter] ✓ Applied Koda Markdown Contract (ChatGPT-style)');

    // Validate contract compliance
    const violations = validateMarkdownContract(formatted);
    if (violations.length > 0) {
      console.warn('[MasterFormatter] ⚠️ Markdown contract violations:', violations);
    } else {
      console.log('[MasterFormatter] ✓ Markdown contract validated (0 violations)');
    }
  } else {
    // =========================================================================
    // LEGACY: Original formatting path (kept for backward compatibility)
    // =========================================================================

    // Step 3: Enforce markdown structure
    formatted = enforceMarkdownStructure(formatted);
    console.log('[MasterFormatter] ✓ Enforced markdown structure');

    // Step 4: Apply smart bolding (enhanced - currency, dates, percentages, key terms, etc.)
    if (addBoldHeadings) {
      formatted = applySmartBolding(formatted, {
        boldNumbers: true,
        boldDates: true,
        boldCurrency: true,
        boldPercentages: true,
        boldDocumentNames: true,
        boldEntityNames: true,
        boldKeyTerms: true,
        boldHeadings: true,
        boldImportantPhrases: true,
        boldQuotedText: false,
      });
      console.log('[MasterFormatter] ✓ Applied smart bolding');
    }

    // Step 6: Add inline citations (optional)
    if (addCitations) {
      formatted = addInlineCitations(formatted, finalSources);
      console.log('[MasterFormatter] ✓ Added inline citations');
    }

    // Step 7: Format document names for frontend (clickable links)
    // ✅ DISABLED: Inline document markers - documents appear as regular markdown links only
    if (false && formatDocs && finalSources.length > 0) {
      // Convert sources to DocSource format for the formatter
      const docSources: DocSource[] = finalSources.map(s => ({
        documentId: s.documentId,
        documentName: s.documentName || s.filename || s.title,
        filename: s.filename,
        title: s.title,
      }));
      formatted = formatDocumentNamesForFrontend(formatted, docSources);
      console.log('[MasterFormatter] ✓ Formatted document names for frontend');
    }

    // Step 8: Normalize document names (italic→bold, underscores→spaces)
    formatted = documentNameNormalizer.processAnswer(formatted);
    console.log('[MasterFormatter] ✓ Normalized document names (bold, spaces)');
  }

  // Step 9: Verify completion
  const completionCheck = verifyCompletion(formatted);
  if (!completionCheck.isComplete) {
    console.warn(`[MasterFormatter] ⚠️ Answer may be incomplete: ${completionCheck.reason}`);
  }

  // Calculate stats
  const wordCount = formatted.split(/\s+/).length;
  const hasHeadings = /^#{1,6}\s+/m.test(formatted);
  const hasBoldText = /\*\*[^*]+\*\*/.test(formatted);
  const hasList = /^[\-\*]\s+/m.test(formatted);
  const hasDocLinks = /\[\[DOC:/.test(formatted); // Track doc links

  console.log('[MasterFormatter] ✓ Format complete');

  return {
    answer: formatted,
    sources: finalSources,
    language: detectLanguage(formatted),
    stats: {
      wordCount,
      sourceCount: finalSources.length,
      hasHeadings,
      hasBoldText,
      hasList
    }
  };
}

// ============================================================================
// 10. EXPORT
// ============================================================================

export default {
  formatAnswer,
  detectLanguage,
  fixUTF8Encoding,
  deduplicateSources,
  verifyCompletion,
  enforceLanguageConsistency
};
