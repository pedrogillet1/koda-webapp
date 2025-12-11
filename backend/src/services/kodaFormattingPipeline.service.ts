/**
 * ============================================================================
 * KODA FORMATTING PIPELINE SERVICE - LAYER 2C
 * ============================================================================
 *
 * PURPOSE: Unified pipeline for ALL LLM answers
 *
 * 5 SUB-LAYERS (executed in order):
 * 1. Structure Layer - Adaptive titles/sections
 * 2. Document Formatting Layer - Convert **filename.pdf** to markers
 * 3. Citation Layer - Convert [1], [2] to markers
 * 4. Marker Injection Layer - Add sources at end
 * 5. Markdown Cleanup Layer - Remove emoji, fix spacing
 *
 * ADAPTIVE TITLES/SECTIONS (like ChatGPT):
 * - Simple answers (< 400 chars): NO title, NO sections
 * - Medium answers (2+ paragraphs): MAYBE title, NO sections
 * - Complex answers (multi-doc, comparison): YES title, YES sections
 * - Fallbacks: NO title, NO sections
 */

import {
  InlineDocument,
  createInlineDocumentMarker,
  normalizeDocumentName,
  documentsMatch
} from '../utils/kodaMarkerGenerator.service';
import { getFallbackText, FallbackKey } from './kodaFallbackEngine.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AnswerType =
  | 'rag_qa_simple'
  | 'rag_qa_medium'
  | 'rag_qa_complex'
  | 'document_listing'
  | 'fallback_no_documents'
  | 'fallback_doc_not_found'
  | 'fallback_no_matching_content'
  | 'fallback_upload_processing'
  | 'fallback_feature_not_supported'
  | 'fallback_system_error'
  | 'fallback_permission'
  | 'fallback_rate_limit'
  | 'calculation'
  | 'comparison';

export interface FormattingContext {
  documentMap?: Map<string, InlineDocument>;
  answerType: AnswerType;
  language: string;
  sourceDocuments?: InlineDocument[];
  userQuestion?: string;
  fallbackKey?: FallbackKey;
  fallbackContext?: any;
}

export interface FormattedAnswer {
  text: string;
  metadata: {
    hasTitle: boolean;
    hasSections: boolean;
    documentCount: number;
    markerCount: number;
  };
}

interface LayoutDecision {
  complexityLevel: 'simple' | 'medium' | 'complex';
  useTitle: boolean;
  useSections: boolean;
}

// ============================================================================
// MAIN FORMATTING FUNCTION
// ============================================================================

/**
 * Format answer through unified pipeline
 *
 * @param rawAnswer - Raw answer text from LLM
 * @param context - Formatting context
 * @returns Formatted answer with metadata
 */
export function formatAnswer(
  rawAnswer: string,
  context: FormattingContext
): FormattedAnswer {
  let text = rawAnswer;

  // Handle fallback answers first
  if (context.answerType.startsWith('fallback_')) {
    text = handleFallbackAnswer(text, context);
  }

  // Layer 1: Structure Layer (adaptive titles/sections)
  text = applyStructureLayer(text, context);

  // Layer 2: Document Formatting Layer
  text = applyDocumentFormattingLayer(text, context);

  // Layer 3: Citation Layer
  text = applyCitationLayer(text, context);

  // Layer 4: Marker Injection Layer
  text = applyMarkerInjectionLayer(text, context);

  // Layer 5: Markdown Cleanup Layer
  text = applyMarkdownCleanupLayer(text);

  // Build metadata
  const metadata = {
    hasTitle: text.includes('###'),
    hasSections: (text.match(/###/g) || []).length > 1,
    documentCount: context.sourceDocuments?.length || 0,
    markerCount: (text.match(/\{\{DOC::/g) || []).length
  };

  return { text, metadata };
}

// ============================================================================
// LAYER 0: FALLBACK HANDLING
// ============================================================================

/**
 * Handle fallback answers
 */
function handleFallbackAnswer(text: string, context: FormattingContext): string {
  if (!context.fallbackKey) {
    return text;
  }

  // If text is already provided, use it
  // Otherwise, generate from fallback engine
  if (!text || text.trim().length === 0) {
    return getFallbackText({
      fallbackKey: context.fallbackKey,
      language: context.language,
      context: context.fallbackContext
    });
  }

  return text;
}

// ============================================================================
// LAYER 1: STRUCTURE LAYER (ADAPTIVE TITLES/SECTIONS)
// ============================================================================

/**
 * Apply structure layer with adaptive titles and sections
 */
function applyStructureLayer(text: string, context: FormattingContext): string {
  // Decide layout
  const layout = decideLayout(context.answerType, text, context);

  // Don't add title for fallbacks or simple answers
  if (!layout.useTitle) {
    return text;
  }

  // Generate title
  const title = generateTitle(context.answerType, text, context);
  if (!title) {
    return text;
  }

  // Add title at the beginning
  let result = `${title}\n\n${text}`;

  // Generate sections if needed
  if (layout.useSections) {
    result = generateSections(result, context.answerType, context);
  }

  return result;
}

/**
 * Decide layout based on answer type and content
 */
function decideLayout(
  answerType: AnswerType,
  rawAnswer: string,
  context: FormattingContext
): LayoutDecision {
  const charCount = rawAnswer.length;
  const paragraphCount = rawAnswer.split('\n\n').filter(p => p.trim()).length;
  const docCount = context.sourceDocuments?.length || 0;

  // Fallbacks: NO title, NO sections
  if (answerType.startsWith('fallback_')) {
    return {
      complexityLevel: 'simple',
      useTitle: false,
      useSections: false
    };
  }

  // Simple answers: NO title, NO sections
  if (answerType === 'rag_qa_simple' || (charCount < 400 && paragraphCount <= 1)) {
    return {
      complexityLevel: 'simple',
      useTitle: false,
      useSections: false
    };
  }

  // Complex answers: YES title, YES sections
  if (
    answerType === 'rag_qa_complex' ||
    answerType === 'comparison' ||
    docCount > 3 ||
    charCount > 1000 ||
    paragraphCount > 4
  ) {
    return {
      complexityLevel: 'complex',
      useTitle: true,
      useSections: true
    };
  }

  // Medium answers: MAYBE title, NO sections
  if (
    answerType === 'rag_qa_medium' ||
    answerType === 'document_listing' ||
    answerType === 'calculation' ||
    paragraphCount > 2
  ) {
    return {
      complexityLevel: 'medium',
      useTitle: true,
      useSections: false
    };
  }

  // Default: NO title, NO sections
  return {
    complexityLevel: 'simple',
    useTitle: false,
    useSections: false
  };
}

/**
 * Generate adaptive title from question or answer
 */
function generateTitle(
  answerType: AnswerType,
  rawAnswer: string,
  context: FormattingContext
): string | null {
  const language = context.language;

  // Document listing titles
  if (answerType === 'document_listing') {
    return language === 'pt'
      ? '### Documentos encontrados'
      : language === 'es'
      ? '### Documentos encontrados'
      : '### Documents found';
  }

  // Calculation titles
  if (answerType === 'calculation') {
    return language === 'pt'
      ? '### Cálculo'
      : language === 'es'
      ? '### Cálculo'
      : '### Calculation';
  }

  // Comparison titles
  if (answerType === 'comparison') {
    return language === 'pt'
      ? '### Comparação'
      : language === 'es'
      ? '### Comparación'
      : '### Comparison';
  }

  // Generate from user question
  if (context.userQuestion) {
    const title = generateTitleFromQuestion(context.userQuestion, language);
    if (title) {
      return `### ${title}`;
    }
  }

  // Generate from first sentence of answer
  const firstSentence = rawAnswer.split(/[.!?]/)[0].trim();
  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 80) {
    return `### ${firstSentence}`;
  }

  // Default titles
  return language === 'pt'
    ? '### Resposta'
    : language === 'es'
    ? '### Respuesta'
    : '### Answer';
}

/**
 * Generate title from user question
 */
function generateTitleFromQuestion(question: string, language: string): string | null {
  // Remove question mark and trailing punctuation
  let title = question.replace(/[?!.]+$/, '').trim();

  // Shorten if too long
  if (title.length > 80) {
    title = title.substring(0, 77) + '...';
  }

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return title;
}

/**
 * Generate sections for complex answers
 */
function generateSections(
  text: string,
  answerType: AnswerType,
  context: FormattingContext
): string {
  // For now, we don't split into sections automatically
  // This is a placeholder for future enhancement
  // In practice, the LLM should generate sections naturally
  return text;
}

// ============================================================================
// LAYER 2: DOCUMENT FORMATTING LAYER
// ============================================================================

/**
 * Apply document formatting layer
 *
 * Converts **filename.pdf** to **filename.pdf** {{DOC::...}}
 */
function applyDocumentFormattingLayer(text: string, context: FormattingContext): string {
  if (!context.documentMap || context.documentMap.size === 0) {
    return text;
  }

  let result = text;

  // Find all bold document names in text
  const boldPattern = /\*\*([^*]+\.(pdf|docx|xlsx|pptx|txt|csv|md|doc|xls|ppt))\*\*/gi;

  result = result.replace(boldPattern, (match, filename, extension) => {
    // Try to find matching document in map
    const doc = findDocumentByName(filename, context.documentMap!);

    if (doc) {
      // Replace with: **filename** {{DOC::...}}
      const marker = createInlineDocumentMarker(doc);
      return `**${filename}** ${marker}`;
    }

    // No match - keep original
    return match;
  });

  return result;
}

/**
 * Find document by name in document map
 */
function findDocumentByName(
  name: string,
  documentMap: Map<string, InlineDocument>
): InlineDocument | null {
  // Try exact match
  if (documentMap.has(name)) {
    return documentMap.get(name)!;
  }

  // Try lowercase match
  if (documentMap.has(name.toLowerCase())) {
    return documentMap.get(name.toLowerCase())!;
  }

  // Try normalized match
  for (const [key, doc] of documentMap.entries()) {
    if (documentsMatch(name, key)) {
      return doc;
    }
  }

  return null;
}

// ============================================================================
// LAYER 3: CITATION LAYER
// ============================================================================

/**
 * Apply citation layer
 *
 * Converts [1], [2] to document markers
 */
function applyCitationLayer(text: string, context: FormattingContext): string {
  if (!context.sourceDocuments || context.sourceDocuments.length === 0) {
    return text;
  }

  let result = text;

  // Find all [N] citations
  const citationPattern = /\[(\d+)\]/g;

  result = result.replace(citationPattern, (match, num) => {
    const index = parseInt(num) - 1;

    if (index >= 0 && index < context.sourceDocuments!.length) {
      const doc = context.sourceDocuments![index];
      const marker = createInlineDocumentMarker(doc);
      return `**${doc.filename}** ${marker}`;
    }

    // No match - keep original
    return match;
  });

  return result;
}

// ============================================================================
// LAYER 4: MARKER INJECTION LAYER
// ============================================================================

/**
 * Apply marker injection layer
 *
 * Adds "Sources:" section at end if documents not mentioned
 */
function applyMarkerInjectionLayer(text: string, context: FormattingContext): string {
  if (!context.sourceDocuments || context.sourceDocuments.length === 0) {
    return text;
  }

  // Check if any documents are already mentioned
  const hasDocMarkers = text.includes('{{DOC::');

  // If documents already mentioned, don't inject
  if (hasDocMarkers) {
    return text;
  }

  // Add "Sources:" section
  const language = context.language;
  const sourcesLabel =
    language === 'pt'
      ? 'Fontes'
      : language === 'es'
      ? 'Fuentes'
      : 'Sources';

  const sourcesList = context.sourceDocuments
    .map(doc => {
      const marker = createInlineDocumentMarker(doc);
      return `- **${doc.filename}** ${marker}`;
    })
    .join('\n');

  return `${text}\n\n### ${sourcesLabel}\n\n${sourcesList}`;
}

// ============================================================================
// LAYER 5: MARKDOWN CLEANUP LAYER
// ============================================================================

/**
 * Apply markdown cleanup layer
 *
 * - Remove emoji
 * - Fix spacing
 * - Clean whitespace
 * - Fix broken markdown
 */
function applyMarkdownCleanupLayer(text: string): string {
  let result = text;

  // Remove emoji
  result = removeEmoji(result);

  // Fix heading spacing (ensure blank line before headings)
  result = result.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');

  // Fix paragraph spacing (ensure blank line between paragraphs)
  result = result.replace(/([^\n])\n([A-Z])/g, '$1\n\n$2');

  // Remove excessive blank lines (max 2 consecutive)
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim trailing whitespace from lines
  result = result
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  // Trim start and end
  result = result.trim();

  return result;
}

/**
 * Remove emoji from text
 */
function removeEmoji(text: string): string {
  // Emoji regex pattern
  const emojiPattern =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  return text.replace(emojiPattern, '');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  formatAnswer
};
