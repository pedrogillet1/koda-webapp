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
}

export interface PostProcessingOptions {
  removeSourceSection?: boolean;
  removeDocumentNames?: boolean;
  removeRawLinks?: boolean;
  fixEmptyBullets?: boolean;
  ensureNumericCitations?: boolean;
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
  } = options;

  let cleaned = answer;
  let sourcesRemoved = false;
  let citationsFixed = 0;
  let emptyBulletsRemoved = 0;
  let rawLinksRemoved = 0;

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

  // Step 6: Final cleanup
  cleaned = finalCleanup(cleaned);

  return {
    cleanedAnswer: cleaned,
    sourcesRemoved,
    citationsFixed,
    emptyBulletsRemoved,
    rawLinksRemoved,
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
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  postProcessAnswer,
};
