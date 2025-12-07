/**
 * Output Post-Processor Service
 * Priority: P0 (CRITICAL)
 * 
 * Cleans and formats RAG answers before sending to user.
 * Fixes citation format issues and removes unwanted content.
 * 
 * Key Functions:
 * - Remove "Source" or "Sources" sections from answers
 * - Remove document names in parentheses (filename.pdf)
 * - Remove raw document links {{DOC:::...}}
 * - Clean up empty bullets and malformed markdown
 * - Ensure proper numeric citations [1], [2], [3]
 */

import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PostProcessingResult {
  cleanedAnswer: string;
  sourcesRemoved: boolean;
  citationsFixed: number;
  emptyBulletsRemoved: number;
  rawLinksRemoved: number;
  duplicatesRemoved: number;
  emojisRemoved: number;
}

export interface PostProcessingOptions {
  removeSourceSection?: boolean;
  removeDocumentNames?: boolean;
  removeRawLinks?: boolean;
  fixEmptyBullets?: boolean;
  ensureNumericCitations?: boolean;
  removeDuplicates?: boolean;
  removeAllEmojis?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Post-process RAG answer to clean up formatting issues
 */
export async function postProcessAnswer(
  answer: string,
  options: PostProcessingOptions = {}
): Promise<PostProcessingResult> {
  const {
    removeSourceSection = true,
    removeDocumentNames = true,
    removeRawLinks = true,
    fixEmptyBullets = true,
    ensureNumericCitations = true,
    removeDuplicates = true,
    removeAllEmojis = false,
  } = options;

  let cleaned = answer;
  let sourcesRemoved = false;
  let citationsFixed = 0;
  let emptyBulletsRemoved = 0;
  let rawLinksRemoved = 0;
  let duplicatesRemoved = 0;
  let emojisRemoved = 0;

  // Step 1: Remove "Source" or "Sources" section
  if (removeSourceSection) {
    const result = removeSourcesSection(cleaned);
    cleaned = result.text;
    sourcesRemoved = result.removed;
  }

  // Step 2: Remove document names in parentheses
  if (removeDocumentNames) {
    const result = removeDocumentNamesInParentheses(cleaned);
    cleaned = result.text;
    citationsFixed += result.count;
  }

  // Step 3: Remove raw document links
  if (removeRawLinks) {
    const result = removeRawDocumentLinks(cleaned);
    cleaned = result.text;
    rawLinksRemoved = result.count;
  }

  // Step 4: Fix empty bullets
  if (fixEmptyBullets) {
    const result = fixEmptyBulletPoints(cleaned);
    cleaned = result.text;
    emptyBulletsRemoved = result.count;
  }

  // Step 5: Ensure numeric citations
  if (ensureNumericCitations) {
    const result = ensureNumericCitationFormat(cleaned);
    cleaned = result.text;
    citationsFixed += result.count;
  }

  // Step 6: Remove emojis (Koda should NEVER have emojis)
  if (removeAllEmojis) {
    const emojiResult = removeEmojis(cleaned);
    cleaned = emojiResult.text;
    emojisRemoved = emojiResult.count;
  }

  // Step 7: Remove duplicate paragraphs
  if (removeDuplicates) {
    const dedupResult = removeDuplicateParagraphs(cleaned);
    cleaned = dedupResult.text;
    duplicatesRemoved = dedupResult.removed;
    if (dedupResult.removed > 0) {
      console.log('[POST-PROCESS] Removed', dedupResult.removed, 'duplicate paragraphs');
    }
  }

  // Step 8: Final cleanup
  cleaned = finalCleanup(cleaned);

  return {
    cleanedAnswer: cleaned,
    sourcesRemoved,
    citationsFixed,
    emptyBulletsRemoved,
    rawLinksRemoved,
    duplicatesRemoved,
    emojisRemoved,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Remove "Source" or "Sources" section from answer (English and Portuguese)
 */
function removeSourcesSection(text: string): { text: string; removed: boolean } {
  // Pattern 1: ### Source/Sources/Fontes (markdown header)
  const pattern1 = /\n#{1,6}\s*(?:Sources?|Fontes?)\s*\n[\s\S]*$/i;

  // Pattern 2: **Sources:**/**Fontes:** (bold text)
  const pattern2 = /\n\*\*(?:Sources?|Fontes?):\*\*\s*\n[\s\S]*$/i;

  // Pattern 3: Sources:/Fontes: (plain text)
  const pattern3 = /\n(?:Sources?|Fontes?):\s*\n[\s\S]*$/i;

  // Pattern 4: --- separator followed by sources
  const pattern4 = /\n---+\s*\n\*\*(?:Sources?|Fontes?):\*\*[\s\S]*$/i;

  // Pattern 5: Bullet list starting with SOURCE or FONTE
  const pattern5 = /\n(?:SOURCE|FONTE|FONTES|SOURCES)\s*\n[\s\S]*$/i;

  // Pattern 6: Plain "SOURCE" or "FONTE" followed by bullets
  const pattern6 = /\n(?:SOURCE|FONTE)[\s\S]*?(?=\n[^\n•\-\*]|\n\n|$)/i;

  let cleaned = text;
  let removed = false;

  for (const pattern of [pattern1, pattern2, pattern3, pattern4, pattern5, pattern6]) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '');
      removed = true;
    }
  }

  return { text: cleaned, removed };
}

/**
 * Remove document names in parentheses like (**filename.pdf**)
 */
function removeDocumentNamesInParentheses(text: string): { text: string; count: number } {
  // Pattern: (**filename.ext**) or (*filename.ext*) or (filename.ext)
  const patterns = [
    /\(\*\*[^)]+\.(pdf|docx|xlsx|pptx|txt|md|csv|json|xml)\*\*\)/gi,
    /\(\*[^)]+\.(pdf|docx|xlsx|pptx|txt|md|csv|json|xml)\*\)/gi,
    /\([^)]+\.(pdf|docx|xlsx|pptx|txt|md|csv|json|xml)\)/gi,
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

/**
 * Remove raw document links like {{DOC:::uuid}}
 */
function removeRawDocumentLinks(text: string): { text: string; count: number } {
  const pattern = /\{\{DOC:::[a-f0-9-]+\}\}/gi;
  const matches = text.match(pattern);
  const count = matches ? matches.length : 0;
  const cleaned = text.replace(pattern, '');
  
  return { text: cleaned, count };
}

/**
 * Fix empty bullet points (* without content)
 */
function fixEmptyBulletPoints(text: string): { text: string; count: number } {
  // Pattern: bullet point with no content or only whitespace
  const pattern = /^\s*[\*\-\+]\s*$/gm;
  const matches = text.match(pattern);
  const count = matches ? matches.length : 0;
  const cleaned = text.replace(pattern, '');
  
  return { text: cleaned, count };
}

/**
 * Ensure citations are in numeric format [1], [2], [3]
 */
function ensureNumericCitationFormat(text: string): { text: string; count: number } {
  let cleaned = text;
  let count = 0;
  
  // Convert [Document Name] to [1], [2], etc.
  // This is a simple implementation - you may want to enhance it
  const citationPattern = /\[([^\]]+)\]/g;
  const citations = new Map<string, number>();
  let citationIndex = 1;
  
  cleaned = cleaned.replace(citationPattern, (match, content) => {
    // If already numeric, keep it
    if (/^\d+$/.test(content.trim())) {
      return match;
    }
    
    // If it's a document name, convert to number
    if (!citations.has(content)) {
      citations.set(content, citationIndex++);
      count++;
    }
    
    return `[${citations.get(content)}]`;
  });
  
  return { text: cleaned, count };
}

/**
 * Final cleanup: remove extra whitespace, fix line breaks
 */
function finalCleanup(text: string): string {
  return text
    // Remove multiple consecutive blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing whitespace
    .replace(/[ \t]+$/gm, '')
    // Remove leading/trailing whitespace
    .trim();
}


// ═══════════════════════════════════════════════════════════════════════════
// EMOJI REMOVAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Remove all emojis from response text
 * Koda responses should NEVER contain emojis
 */
function removeEmojis(text: string): { text: string; count: number } {
  if (!text) return { text, count: 0 };

  // Comprehensive emoji regex pattern
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu;

  // Common document/file emojis used in file listings
  const fileEmojis = /[📄📁🗂️📋📃🗃️💾📂🟡🟢🔴🔵]/g;

  let cleaned = text;
  let count = 0;

  // Remove common file emojis first
  const fileMatches = cleaned.match(fileEmojis);
  if (fileMatches) {
    count += fileMatches.length;
    cleaned = cleaned.replace(fileEmojis, '');
  }

  // Remove any remaining emojis
  const emojiMatches = cleaned.match(emojiPattern);
  if (emojiMatches) {
    count += emojiMatches.length;
    cleaned = cleaned.replace(emojiPattern, '');
  }

  // Clean up extra spaces left by removed emojis
  cleaned = cleaned.replace(/  +/g, ' ').trim();

  if (count > 0) {
    console.log('[POST-PROCESS] Removed', count, 'emojis from response');
  }

  return { text: cleaned, count };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEDUPLICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate similarity between two strings (0-1)
 * Uses Jaccard similarity coefficient based on word overlap
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Remove duplicate paragraphs from response
 * Detects and removes exact or near-duplicate paragraphs (>90% similarity)
 */
function removeDuplicateParagraphs(text: string): { text: string; removed: number } {
  if (!text) return { text, removed: 0 };

  // Split into paragraphs (double newline separated)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20);

  // Track seen paragraphs (normalized)
  const seen: string[] = [];
  const unique: string[] = [];
  let removed = 0;

  for (const paragraph of paragraphs) {
    // Normalize: lowercase, remove extra whitespace
    const normalized = paragraph.toLowerCase().replace(/\s+/g, ' ').trim();

    // Skip very short paragraphs (likely headers or bullets)
    if (normalized.length < 50) {
      unique.push(paragraph);
      continue;
    }

    // Check for exact duplicate
    if (seen.includes(normalized)) {
      console.log('[DEDUP] Removed exact duplicate paragraph:', paragraph.substring(0, 50) + '...');
      removed++;
      continue;
    }

    // Check for near-duplicates (90% similarity)
    let isDuplicate = false;
    for (const seenPara of seen) {
      const similarity = calculateSimilarity(normalized, seenPara);
      if (similarity > 0.9) {
        console.log('[DEDUP] Removed near-duplicate paragraph (similarity: ' + (similarity * 100).toFixed(0) + '%)');
        isDuplicate = true;
        removed++;
        break;
      }
    }

    if (!isDuplicate) {
      seen.push(normalized);
      unique.push(paragraph);
    }
  }

  return {
    text: unique.join('\n\n'),
    removed
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  postProcessAnswer,
};
