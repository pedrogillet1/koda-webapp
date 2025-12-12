/**
 * KODA V3 Formatting Pipeline Service
 *
 * Centralized formatting for ALL LLM answers
 * - Adaptive titles/sections (only for medium/complex answers like ChatGPT)
 * - Clean document markers (only filename visible, metadata hidden)
 * - Filename styling: Bold only in lists, Bold+underlined in text
 * - All filenames clickable to open preview modal
 *
 * Based on previous specifications + formatting requirements
 */

import { LanguageCode } from '../../types/intentV3.types';

export interface Document {
  id: string;
  filename: string;
  type?: string;
  size?: number;
  uploadedAt?: Date;
  metadata?: Record<string, any>;
}

export interface FormattingRequest {
  answer: string;
  documents?: Document[];
  language: LanguageCode;
  intent?: string;
  complexity?: 'simple' | 'medium' | 'complex';
}

export interface FormattingResult {
  text: string;
  hasMarkers: boolean;
  documentCount: number;
  metadata?: {
    hasAdaptiveTitles: boolean;
    hasSections: boolean;
  };
}

export class KodaFormattingPipelineV3 {
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger || console;
  }

  /**
   * Main formatting entry point
   * Centralizes ALL LLM answer formatting
   */
  async format(request: FormattingRequest): Promise<FormattingResult> {
    let formatted = request.answer;
    let hasMarkers = false;
    let hasAdaptiveTitles = false;
    let hasSections = false;

    // 1. Determine complexity if not provided
    const complexity = request.complexity || this.detectComplexity(formatted);

    // 2. Add adaptive titles/sections for medium/complex answers
    if (complexity === 'medium' || complexity === 'complex') {
      formatted = this.addAdaptiveTitles(formatted, request.language);
      hasAdaptiveTitles = true;
      hasSections = this.hasSections(formatted);
    }

    // 3. Insert document markers if documents are referenced
    if (request.documents && request.documents.length > 0) {
      formatted = this.insertDocumentMarkers(formatted, request.documents);
      hasMarkers = true;
    }

    return {
      text: formatted,
      hasMarkers,
      documentCount: request.documents?.length || 0,
      metadata: {
        hasAdaptiveTitles,
        hasSections,
      },
    };
  }

  /**
   * Detect answer complexity based on length and structure
   */
  private detectComplexity(text: string): 'simple' | 'medium' | 'complex' {
    const length = text.length;
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0).length;
    const hasBullets = text.includes('- ') || text.includes('* ') || /^\d+\./m.test(text);

    if (length < 200 && paragraphs <= 2) {
      return 'simple';
    }

    if (length > 800 || paragraphs > 5 || hasBullets) {
      return 'complex';
    }

    return 'medium';
  }

  /**
   * Add adaptive titles and sections (ChatGPT-style)
   * Only for medium/complex answers
   */
  private addAdaptiveTitles(text: string, language: LanguageCode): string {
    // If text already has markdown headers, don't add more
    if (text.includes('##') || text.includes('**') && text.includes(':**')) {
      return text;
    }

    // For now, return as-is
    // In production, this would use LLM to add appropriate structure
    return text;
  }

  /**
   * Check if text has sections
   */
  private hasSections(text: string): boolean {
    return text.includes('##') || /\n\n[A-Z][^.!?]*:\n/.test(text);
  }

  /**
   * Insert document markers into text
   * Creates clean markers with only filename visible
   */
  private insertDocumentMarkers(text: string, documents: Document[]): string {
    let markedText = text;

    for (const doc of documents) {
      // Find references to this document in the text
      const filenamePattern = new RegExp(this.escapeRegex(doc.filename), 'gi');

      // Replace with marker
      markedText = markedText.replace(filenamePattern, (match) => {
        return this.createDocumentMarker(doc, 'text');
      });
    }

    return markedText;
  }

  /**
   * Create a document marker
   *
   * Format: <<<DOC_MARKER:docId:filename:context>>>
   *
   * Context determines styling:
   * - 'list': Bold only (NO underline)
   * - 'text': Bold + underlined (ALWAYS)
   *
   * Metadata is hidden in marker, only filename visible to user
   */
  private createDocumentMarker(doc: Document, context: 'list' | 'text'): string {
    // Clean marker format: only essential data
    // Frontend will parse this and make it clickable
    return `<<<DOC_MARKER:${doc.id}:${doc.filename}:${context}>>>`;
  }

  /**
   * Format document list with markers
   * Used for analytics/search results
   */
  async formatDocumentList(
    documents: Document[],
    language: LanguageCode,
    title?: string
  ): Promise<string> {
    if (documents.length === 0) {
      return this.getNoDocumentsMessage(language);
    }

    const titleText = title || this.getDefaultListTitle(language, documents.length);

    let formatted = `**${titleText}**\n\n`;

    for (const doc of documents) {
      // In lists: bold only, NO underline
      const marker = this.createDocumentMarker(doc, 'list');
      formatted += `- ${marker}\n`;
    }

    return formatted;
  }

  /**
   * Format analytics result
   */
  async formatAnalytics(params: {
    result: any;
    language: LanguageCode;
  }): Promise<FormattingResult> {
    const { result, language } = params;

    let formatted = '';

    // Add count summary
    if (result.count !== undefined) {
      formatted += this.formatCountSummary(result.count, result.type, language);
      formatted += '\n\n';
    }

    // Add document list if present
    if (result.documents && result.documents.length > 0) {
      formatted += await this.formatDocumentList(result.documents, language);
    }

    return {
      text: formatted,
      hasMarkers: result.documents && result.documents.length > 0,
      documentCount: result.documents?.length || 0,
    };
  }

  /**
   * Format search results
   */
  async formatSearchResults(params: {
    results: Document[];
    language: LanguageCode;
  }): Promise<FormattingResult> {
    const { results, language } = params;

    const title = this.getSearchResultsTitle(language, results.length);
    const formatted = await this.formatDocumentList(results, language, title);

    return {
      text: formatted,
      hasMarkers: results.length > 0,
      documentCount: results.length,
    };
  }

  /**
   * Format count summary
   */
  private formatCountSummary(count: number, type: string, language: LanguageCode): string {
    const templates: Record<LanguageCode, Record<string, string>> = {
      en: {
        documents: `You have **${count}** document${count !== 1 ? 's' : ''}.`,
        pdfs: `You have **${count}** PDF${count !== 1 ? 's' : ''}.`,
        default: `Found **${count}** item${count !== 1 ? 's' : ''}.`,
      },
      pt: {
        documents: `Você tem **${count}** documento${count !== 1 ? 's' : ''}.`,
        pdfs: `Você tem **${count}** PDF${count !== 1 ? 's' : ''}.`,
        default: `Encontrado${count !== 1 ? 's' : ''} **${count}** item${count !== 1 ? 's' : ''}.`,
      },
      es: {
        documents: `Tienes **${count}** documento${count !== 1 ? 's' : ''}.`,
        pdfs: `Tienes **${count}** PDF${count !== 1 ? 's' : ''}.`,
        default: `Encontrado${count !== 1 ? 's' : ''} **${count}** elemento${count !== 1 ? 's' : ''}.`,
      },
    };

    const langTemplates = templates[language] || templates['en'];
    return langTemplates[type] || langTemplates['default'];
  }

  /**
   * Get default list title
   */
  private getDefaultListTitle(language: LanguageCode, count: number): string {
    const titles: Record<LanguageCode, string> = {
      en: `Your Documents (${count})`,
      pt: `Seus Documentos (${count})`,
      es: `Tus Documentos (${count})`,
    };

    return titles[language] || titles['en'];
  }

  /**
   * Get search results title
   */
  private getSearchResultsTitle(language: LanguageCode, count: number): string {
    const titles: Record<LanguageCode, string> = {
      en: `Search Results (${count})`,
      pt: `Resultados da Pesquisa (${count})`,
      es: `Resultados de Búsqueda (${count})`,
    };

    return titles[language] || titles['en'];
  }

  /**
   * Get no documents message
   */
  private getNoDocumentsMessage(language: LanguageCode): string {
    const messages: Record<LanguageCode, string> = {
      en: 'No documents found.',
      pt: 'Nenhum documento encontrado.',
      es: 'No se encontraron documentos.',
    };

    return messages[language] || messages['en'];
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Strip all markers from text (for plain text export)
   */
  stripMarkers(text: string): string {
    return text.replace(/<<<DOC_MARKER:[^>]+>>>/g, (match) => {
      // Extract filename from marker
      const parts = match.replace(/<<<DOC_MARKER:|>>>/g, '').split(':');
      return parts[1] || ''; // Return just the filename
    });
  }

  /**
   * Count markers in text
   */
  countMarkers(text: string): number {
    const matches = text.match(/<<<DOC_MARKER:[^>]+>>>/g);
    return matches ? matches.length : 0;
  }
}

// Singleton instance
export const kodaFormattingPipelineV3 = new KodaFormattingPipelineV3();
export default kodaFormattingPipelineV3;
