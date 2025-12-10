/**
 * Answer Formatter - Unified Answer Formatting
 * 
 * Merges:
 * - kodaUnifiedFormatter.service.ts
 * - documentNameFormatter.service.ts
 * - citationTracking.service.ts
 * - outputPostProcessor.service.ts
 * - responseDeduplicate.service.ts
 * - structureEnforcement.service.ts
 * 
 * Single source of truth for ALL answer formatting
 * 
 * CRITICAL: This is the ONLY service that formats answers
 */

export interface FormatOptions {
  rawAnswer: string;
  documentMap: Map<string, { id: string; name: string; displayTitle?: string }>;
  languageCode: string;
}

export interface FormattedAnswer {
  text: string;
  documentReferences: Array<{ id: string; name: string; displayTitle?: string }>;
  hasFollowUpQuestion: boolean;
  formatIssues: string[];
}

/**
 * Format answer - SINGLE entry point for all formatting
 */
export function formatAnswer(options: FormatOptions): FormattedAnswer {
  const { rawAnswer, documentMap, languageCode } = options;
  
  let text = rawAnswer;
  const formatIssues: string[] = [];
  const referencedDocs = new Set<string>();

  // 1. Remove ALL emoji
  text = removeEmoji(text);

  // 2. Convert document names to {{DOC:::}} markers
  const docConversion = convertDocumentNames(text, documentMap);
  text = docConversion.text;
  docConversion.referencedDocs.forEach(doc => referencedDocs.add(doc));

  // 3. Remove ### Source sections (forbidden)
  text = removeSourceSections(text);

  // 4. Fix italic → bold
  text = fixItalicToBold(text);

  // 5. Validate follow-up question
  const hasFollowUp = validateFollowUpQuestion(text, languageCode);
  if (!hasFollowUp.exists) {
    // Add generic follow-up
    text = addFollowUpQuestion(text, languageCode);
    formatIssues.push('Added missing follow-up question');
  }

  // 6. Remove duplicate content
  text = removeDuplicates(text);

  // 7. Clean up whitespace
  text = cleanWhitespace(text);

  // Build document references list
  const documentReferences = Array.from(referencedDocs)
    .map(docId => documentMap.get(docId))
    .filter((doc): doc is { id: string; name: string; displayTitle?: string } => doc !== undefined);

  return {
    text,
    documentReferences,
    hasFollowUpQuestion: hasFollowUp.exists || formatIssues.includes('Added missing follow-up question'),
    formatIssues,
  };
}

/**
 * Remove ALL emoji from text
 */
function removeEmoji(text: string): string {
  // Remove emoji using regex
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}\u{FE0F}]/gu;
  
  return text.replace(emojiRegex, '').trim();
}

/**
 * Convert document names to {{DOC:::}} markers
 */
function convertDocumentNames(
  text: string,
  documentMap: Map<string, { id: string; name: string; displayTitle?: string }>
): {
  text: string;
  referencedDocs: Set<string>;
} {
  const referencedDocs = new Set<string>();
  let result = text;

  // Find all document references in various formats
  documentMap.forEach((doc, docId) => {
    const { name, displayTitle } = doc;
    
    // Patterns to match:
    // 1. **filename.ext**
    // 2. `filename.ext`
    // 3. "filename.ext"
    // 4. filename.ext (standalone)
    // 5. displayTitle (if exists)

    const patterns = [
      new RegExp(`\\*\\*${escapeRegex(name)}\\*\\*`, 'gi'),
      new RegExp(`\`${escapeRegex(name)}\``, 'gi'),
      new RegExp(`"${escapeRegex(name)}"`, 'gi'),
      new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi'),
    ];

    if (displayTitle) {
      patterns.push(
        new RegExp(`\\*\\*${escapeRegex(displayTitle)}\\*\\*`, 'gi'),
        new RegExp(`\`${escapeRegex(displayTitle)}\``, 'gi'),
        new RegExp(`"${escapeRegex(displayTitle)}"`, 'gi'),
        new RegExp(`\\b${escapeRegex(displayTitle)}\\b`, 'gi')
      );
    }

    patterns.forEach(pattern => {
      if (pattern.test(result)) {
        result = result.replace(pattern, `{{DOC:::${name}}}`);
        referencedDocs.add(docId);
      }
    });
  });

  // Also find existing {{DOC:::}} markers and track them
  const existingMarkers = result.matchAll(/\{\{DOC:::([^}]+)\}\}/g);
  for (const match of existingMarkers) {
    const filename = match[1];
    // Find doc by filename
    for (const [docId, doc] of documentMap.entries()) {
      if (doc.name === filename) {
        referencedDocs.add(docId);
        break;
      }
    }
  }

  return { text: result, referencedDocs };
}

/**
 * Remove ### Source sections
 */
function removeSourceSections(text: string): string {
  // Remove ### Source or ### Fonte or ### Fuente sections
  const sourcePatterns = [
    /###\s*Source[s]?:?\s*[\s\S]*?(?=\n##|\n\n|$)/gi,
    /###\s*Fonte[s]?:?\s*[\s\S]*?(?=\n##|\n\n|$)/gi,
    /###\s*Fuente[s]?:?\s*[\s\S]*?(?=\n##|\n\n|$)/gi,
  ];

  let result = text;
  sourcePatterns.forEach(pattern => {
    result = result.replace(pattern, '');
  });

  return result;
}

/**
 * Fix italic to bold
 */
function fixItalicToBold(text: string): string {
  // Convert *text* or _text_ to **text**
  // But NOT if already bold (**text** or __text__)
  
  // Single asterisk/underscore → double
  let result = text;
  
  // Replace *word* with **word** (but not **word**)
  result = result.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '**$1**');
  
  // Replace _word_ with **word** (but not __word__)
  result = result.replace(/(?<!_)_(?!_)([^_]+)_(?!_)/g, '**$1**');

  return result;
}

/**
 * Validate follow-up question exists
 */
function validateFollowUpQuestion(text: string, lang: string): {
  exists: boolean;
  question?: string;
} {
  // Check if text ends with a question mark
  const lines = text.trim().split('\n');
  const lastLine = lines[lines.length - 1].trim();

  if (lastLine.endsWith('?')) {
    return { exists: true, question: lastLine };
  }

  // Check last 3 lines for question
  const lastThreeLines = lines.slice(-3).join('\n');
  if (lastThreeLines.includes('?')) {
    return { exists: true };
  }

  return { exists: false };
}

/**
 * Add follow-up question if missing
 */
function addFollowUpQuestion(text: string, lang: string): string {
  const questions: Record<string, string> = {
    en: 'Would you like more details or have any other questions?',
    pt: 'Gostaria de mais detalhes ou tem outras perguntas?',
    es: '¿Te gustaría más detalles o tienes otras preguntas?',
  };

  const question = questions[lang] || questions.en;
  
  return `${text.trim()}\n\n${question}`;
}

/**
 * Remove duplicate content
 */
function removeDuplicates(text: string): string {
  const lines = text.split('\n');
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    
    // Skip empty lines
    if (!normalized) {
      result.push(line);
      continue;
    }

    // Skip if duplicate (but allow headers and short lines)
    if (seen.has(normalized) && normalized.length > 20 && !normalized.startsWith('#')) {
      continue;
    }

    seen.add(normalized);
    result.push(line);
  }

  return result.join('\n');
}

/**
 * Clean whitespace
 */
function cleanWhitespace(text: string): string {
  // Remove excessive blank lines (max 2 consecutive)
  let result = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim each line
  result = result.split('\n').map(line => line.trimEnd()).join('\n');
  
  // Trim start and end
  result = result.trim();

  return result;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quick format check (for testing)
 */
export function checkFormat(text: string): {
  hasEmoji: boolean;
  hasSourceSections: boolean;
  hasItalic: boolean;
  hasFollowUp: boolean;
  hasDocMarkers: boolean;
} {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu;
  
  return {
    hasEmoji: emojiRegex.test(text),
    hasSourceSections: /###\s*(Source|Fonte|Fuente)/i.test(text),
    hasItalic: /(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/.test(text) || /(?<!_)_(?!_)([^_]+)_(?!_)/.test(text),
    hasFollowUp: text.trim().endsWith('?'),
    hasDocMarkers: /\{\{DOC:::[^}]+\}\}/.test(text),
  };
}
