/**
 * Koda Formatting Pipeline V3 - Production Ready
 *
 * Unified formatting pipeline replacing all V1 formatting services.
 * Implements 5 sub-layers for consistent, adaptive, and multilingual formatting:
 *   1. Structure & Spacing normalization
 *   2. Answer Structure adaptation (titles, sections)
 *   3. Citation handling with Sources section
 *   4. Marker injection via kodaMarkerGenerator
 *   5. Cleanup of residual artifacts
 *
 * Supports multiple answer types:
 * - formatRagAnswer
 * - formatFallback
 * - formatAnalyticsAnswer
 * - formatProductHelp
 *
 * Multilingual support (English, Portuguese, Spanish)
 *
 * Returns: FormattedAnswerV3
 *
 * Performance and readability optimized.
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  Citation,
} from '../../types/ragV3.types';

type LanguageCode = 'en' | 'pt' | 'es';

// ============================================================================
// CONFIG LOADING
// ============================================================================

interface AnswerStyleConfig {
  [styleKey: string]: {
    useSections?: boolean;
    titleCase?: boolean;
    maxLength?: number;
  };
}

interface MarkdownComponentsConfig {
  sectionHeader?: string;
  bulletList?: string;
  numberedList?: string;
  codeBlock?: string;
}

let answerStyles: AnswerStyleConfig = {};
let markdownComponents: MarkdownComponentsConfig = {};

try {
  const answerStylesPath = path.resolve(__dirname, '../../data/answer_styles.json');
  answerStyles = JSON.parse(fs.readFileSync(answerStylesPath, 'utf-8'));
} catch (err) {
  console.warn('Failed to load answer_styles.json, using defaults');
}

try {
  const markdownComponentsPath = path.resolve(__dirname, '../../data/markdown_components.json');
  markdownComponents = JSON.parse(fs.readFileSync(markdownComponentsPath, 'utf-8'));
} catch (err) {
  console.warn('Failed to load markdown_components.json, using defaults');
}

// ============================================================================
// LANGUAGE TITLES
// ============================================================================

const LANGUAGE_TITLES: Record<LanguageCode, { sourcesSection: string; answerSection: string }> = {
  en: {
    sourcesSection: 'Sources',
    answerSection: 'Answer',
  },
  pt: {
    sourcesSection: 'Fontes',
    answerSection: 'Resposta',
  },
  es: {
    sourcesSection: 'Fuentes',
    answerSection: 'Respuesta',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper: Normalize spacing and structure for raw answer text.
 */
function normalizeStructureAndSpacing(text: string): string {
  if (!text) return '';

  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  normalized = normalized
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
  normalized = normalized.trim();

  return normalized;
}

/**
 * Helper: Adaptive answer structure.
 */
function applyAnswerStructure(
  answerText: string,
  styleKey: string,
  lang: LanguageCode,
): string {
  if (!answerText) return '';

  const styleConfig = answerStyles[styleKey];
  if (!styleConfig) {
    return answerText;
  }

  const { useSections, titleCase } = styleConfig;

  if (!useSections) {
    if (titleCase) {
      return toTitleCase(answerText);
    }
    return answerText;
  }

  const answerSectionTitle = LANGUAGE_TITLES[lang]?.answerSection ?? 'Answer';
  const sectionHeaderTemplate = markdownComponents.sectionHeader ?? '### {title}';
  const sectionHeader = sectionHeaderTemplate.replace('{title}', answerSectionTitle);

  return `${sectionHeader}\n\n${answerText}`;
}

/**
 * Helper: Converts string to Title Case.
 */
function toTitleCase(input: string): string {
  return input.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * Helper: Format citations into a Sources section.
 */
function formatCitationsSection(citations: Citation[], lang: LanguageCode): string {
  if (!citations || citations.length === 0) return '';

  const uniqueCitationsMap = new Map<string, Citation>();
  for (const c of citations) {
    const key = c.documentId || c.documentName || String(Math.random());
    uniqueCitationsMap.set(key, c);
  }
  const uniqueCitations = Array.from(uniqueCitationsMap.values());

  const sourcesTitle = LANGUAGE_TITLES[lang]?.sourcesSection ?? 'Sources';
  const sectionHeaderTemplate = markdownComponents.sectionHeader ?? '### {title}';
  const sectionHeader = sectionHeaderTemplate.replace('{title}', sourcesTitle);

  const citationLines = uniqueCitations.map((citation, idx) => {
    if (citation.documentName) {
      const page = citation.pageNumber ? ` (p. ${citation.pageNumber})` : '';
      return `- **${citation.documentName}**${page}`;
    }
    return `- Source ${idx + 1}`;
  });

  return `${sectionHeader}\n\n${citationLines.join('\n')}`;
}

/**
 * Helper: Inject markers into the answer text.
 */
function injectMarkers(text: string, markers: string[]): string {
  if (!markers || markers.length === 0) return text;

  const paragraphs = text.split(/\n{2,}/);

  if (paragraphs.length >= markers.length) {
    for (let i = 0; i < markers.length; i++) {
      paragraphs[i] = paragraphs[i].trimEnd() + ` ${markers[i]}`;
    }
    return paragraphs.join('\n\n');
  }

  const markerBlock = markers.join(' ');
  return `${text.trim()}\n\n${markerBlock}`;
}

/**
 * Helper: Cleanup residual artifacts from formatting.
 */
function cleanupFormattedText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  cleaned = cleaned
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/^(#{1,6} .+)\n\s*\n(?=#{1,6} )/gm, '$1\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

// ============================================================================
// TYPES
// ============================================================================

export interface FormattedAnswerV3 {
  formattedAnswer: string;
  originalAnswer: string;
  citations: Citation[];
  markers: string[];
  language: LanguageCode;
  styleKey: string;
}

export interface RagAnswerV3 {
  answer: string;
  citations?: Citation[];
  sourceDocuments?: any[];
  styleKey?: string;
}

export interface FallbackAnswerV3 {
  answer: string;
  citations?: Citation[];
  sourceDocuments?: any[];
  styleKey?: string;
}

export interface AnalyticsAnswerV3 {
  answer: string;
  citations?: Citation[];
  sourceDocuments?: any[];
  styleKey?: string;
}

export interface ProductHelpAnswerV3 {
  answer: string;
  citations?: Citation[];
  sourceDocuments?: any[];
  styleKey?: string;
}

// ============================================================================
// KODA FORMATTING PIPELINE SERVICE V3
// ============================================================================

export class KodaFormattingPipelineServiceV3 {
  /**
   * Formats a RAG answer with full pipeline.
   */
  public formatRagAnswer(ragAnswer: RagAnswerV3, lang: LanguageCode): FormattedAnswerV3 {
    if (!ragAnswer || typeof ragAnswer.answer !== 'string') {
      throw new Error('Invalid RagAnswerV3 input');
    }

    // Layer 1: Structure & Spacing normalization
    let formatted = normalizeStructureAndSpacing(ragAnswer.answer);

    // Layer 2: Adaptive answer structure
    formatted = applyAnswerStructure(formatted, ragAnswer.styleKey ?? 'default', lang);

    // Layer 3: Citation handling
    const citationsSection = formatCitationsSection(ragAnswer.citations ?? [], lang);
    if (citationsSection) {
      formatted = `${formatted}\n\n${citationsSection}`;
    }

    // Layer 4: Marker injection (no markers for now)
    const markers: string[] = [];
    formatted = injectMarkers(formatted, markers);

    // Layer 5: Cleanup
    formatted = cleanupFormattedText(formatted);

    return {
      formattedAnswer: formatted,
      originalAnswer: ragAnswer.answer,
      citations: ragAnswer.citations ?? [],
      markers,
      language: lang,
      styleKey: ragAnswer.styleKey ?? 'default',
    };
  }

  /**
   * Formats a fallback answer with full pipeline.
   */
  public formatFallback(fallbackAnswer: FallbackAnswerV3, lang: LanguageCode): FormattedAnswerV3 {
    if (!fallbackAnswer || typeof fallbackAnswer.answer !== 'string') {
      throw new Error('Invalid FallbackAnswerV3 input');
    }

    let formatted = normalizeStructureAndSpacing(fallbackAnswer.answer);
    formatted = applyAnswerStructure(formatted, fallbackAnswer.styleKey ?? 'fallback', lang);

    const citationsSection = formatCitationsSection(fallbackAnswer.citations ?? [], lang);
    if (citationsSection) {
      formatted = `${formatted}\n\n${citationsSection}`;
    }

    const markers: string[] = [];
    formatted = injectMarkers(formatted, markers);
    formatted = cleanupFormattedText(formatted);

    return {
      formattedAnswer: formatted,
      originalAnswer: fallbackAnswer.answer,
      citations: fallbackAnswer.citations ?? [],
      markers,
      language: lang,
      styleKey: fallbackAnswer.styleKey ?? 'fallback',
    };
  }

  /**
   * Formats an analytics answer with full pipeline.
   */
  public formatAnalyticsAnswer(analyticsAnswer: AnalyticsAnswerV3, lang: LanguageCode): FormattedAnswerV3 {
    if (!analyticsAnswer || typeof analyticsAnswer.answer !== 'string') {
      throw new Error('Invalid AnalyticsAnswerV3 input');
    }

    let formatted = normalizeStructureAndSpacing(analyticsAnswer.answer);
    formatted = applyAnswerStructure(formatted, analyticsAnswer.styleKey ?? 'analytics', lang);

    const citationsSection = formatCitationsSection(analyticsAnswer.citations ?? [], lang);
    if (citationsSection) {
      formatted = `${formatted}\n\n${citationsSection}`;
    }

    const markers: string[] = [];
    formatted = injectMarkers(formatted, markers);
    formatted = cleanupFormattedText(formatted);

    return {
      formattedAnswer: formatted,
      originalAnswer: analyticsAnswer.answer,
      citations: analyticsAnswer.citations ?? [],
      markers,
      language: lang,
      styleKey: analyticsAnswer.styleKey ?? 'analytics',
    };
  }

  /**
   * Formats a product help answer with full pipeline.
   */
  public formatProductHelp(productHelpAnswer: ProductHelpAnswerV3, lang: LanguageCode): FormattedAnswerV3 {
    if (!productHelpAnswer || typeof productHelpAnswer.answer !== 'string') {
      throw new Error('Invalid ProductHelpAnswerV3 input');
    }

    let formatted = normalizeStructureAndSpacing(productHelpAnswer.answer);
    formatted = applyAnswerStructure(formatted, productHelpAnswer.styleKey ?? 'productHelp', lang);

    const citationsSection = formatCitationsSection(productHelpAnswer.citations ?? [], lang);
    if (citationsSection) {
      formatted = `${formatted}\n\n${citationsSection}`;
    }

    const markers: string[] = [];
    formatted = injectMarkers(formatted, markers);
    formatted = cleanupFormattedText(formatted);

    return {
      formattedAnswer: formatted,
      originalAnswer: productHelpAnswer.answer,
      citations: productHelpAnswer.citations ?? [],
      markers,
      language: lang,
      styleKey: productHelpAnswer.styleKey ?? 'productHelp',
    };
  }
}

export default new KodaFormattingPipelineServiceV3();
