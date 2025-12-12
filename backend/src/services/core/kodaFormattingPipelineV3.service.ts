/**
 * @file kodaFormattingPipelineV3.service.ts
 * @description
 * Unified formatting pipeline with 5 adaptive sub-layers:
 *  1. Adaptive structure (titles/sections only when needed)
 *  2. Document formatting
 *  3. Citation formatting
 *  4. Marker injection
 *  5. Cleanup
 *
 * Structure rules:
 *  - Add title for medium/complex documents
 *  - Add sections for multi-part documents
 *  - No structure for short/simple documents
 *
 * This service provides a single entry point to format raw document content
 * into a clean, well-structured, and citation-aware output suitable for
 * downstream consumption or display.
 */

import { strict as assert } from 'assert';

/**
 * Document complexity levels.
 */
enum Complexity {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  COMPLEX = 'complex',
}

/**
 * Represents a citation within the document.
 */
interface Citation {
  id: string;
  text: string;
  url?: string;
}

/**
 * Represents a section in the document.
 */
interface Section {
  title: string;
  content: string;
}

/**
 * Represents the input document to be formatted.
 */
interface DocumentInput {
  rawText: string;
  complexity: Complexity;
  sections?: Section[]; // Optional: if multi-part
  citations?: Citation[];
  title?: string;
}

/**
 * Represents the output of the formatting pipeline.
 */
interface FormattedDocument {
  formattedText: string;
  citationsFormatted: string[];
  markersInjected: string[];
}

/**
 * Utility regex patterns used throughout the pipeline.
 */
const REGEX = {
  citationPlaceholder: /\[\[CITATION:([^\]]+)\]\]/g, // e.g. [[CITATION:ref1]]
  markerPlaceholder: /\[\[MARKER:([^\]]+)\]\]/g, // e.g. [[MARKER:highlight1]]
  whitespace: /\s+/g,
  multipleNewlines: /\n{2,}/g,
  trailingWhitespaceLine: /[ \t]+$/gm,
};

/**
 * KodaFormattingPipelineV3Service
 *
 * Provides a unified formatting pipeline for document content.
 */
export class KodaFormattingPipelineV3Service {
  /**
   * Formats the given document input through all 5 pipeline layers.
   * @param input DocumentInput containing raw text, complexity, optional sections, citations, and title.
   * @returns FormattedDocument containing the fully formatted text and auxiliary arrays.
   * @throws {Error} Throws if input is invalid or processing fails.
   */
  public formatDocument(input: DocumentInput): FormattedDocument {
    try {
      this.validateInput(input);

      // 1. Adaptive Structure Layer
      const structuredText = this.adaptiveStructure(
        input.rawText,
        input.complexity,
        input.sections,
        input.title,
      );

      // 2. Document Formatting Layer
      const docFormattedText = this.documentFormatting(structuredText);

      // 3. Citation Formatting Layer
      const citationFormattedText = this.citationFormatting(
        docFormattedText,
        input.citations ?? [],
      );

      // 4. Marker Injection Layer
      const markerInjectedText = this.markerInjection(citationFormattedText);

      // 5. Cleanup Layer
      const cleanedText = this.cleanup(markerInjectedText);

      // Extract formatted citations and markers for reference
      const citationsFormatted = this.extractFormattedCitations(cleanedText);
      const markersInjected = this.extractMarkers(cleanedText);

      return {
        formattedText: cleanedText,
        citationsFormatted,
        markersInjected,
      };
    } catch (error) {
      // Wrap and rethrow for clarity
      throw new Error(`Formatting pipeline failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validates the input document for required fields and consistency.
   * @param input DocumentInput to validate.
   * @throws {Error} Throws if validation fails.
   */
  private validateInput(input: DocumentInput): void {
    if (!input) {
      throw new Error('Input document is required.');
    }
    if (typeof input.rawText !== 'string' || input.rawText.trim() === '') {
      throw new Error('Input rawText must be a non-empty string.');
    }
    if (!Object.values(Complexity).includes(input.complexity)) {
      throw new Error(
        `Input complexity must be one of: ${Object.values(Complexity).join(', ')}`,
      );
    }
    if (input.sections) {
      if (!Array.isArray(input.sections)) {
        throw new Error('Input sections must be an array if provided.');
      }
      input.sections.forEach((section, idx) => {
        if (typeof section.title !== 'string' || section.title.trim() === '') {
          throw new Error(`Section at index ${idx} must have a non-empty title.`);
        }
        if (typeof section.content !== 'string') {
          throw new Error(`Section at index ${idx} must have content as string.`);
        }
      });
    }
    if (input.citations) {
      if (!Array.isArray(input.citations)) {
        throw new Error('Input citations must be an array if provided.');
      }
      input.citations.forEach((citation, idx) => {
        if (typeof citation.id !== 'string' || citation.id.trim() === '') {
          throw new Error(`Citation at index ${idx} must have a non-empty id.`);
        }
        if (typeof citation.text !== 'string' || citation.text.trim() === '') {
          throw new Error(`Citation at index ${idx} must have non-empty text.`);
        }
      });
    }
  }

  /**
   * Layer 1: Adaptive Structure
   *
   * Adds titles and sections based on document complexity and presence of multiple parts.
   * - For SIMPLE: no structure added.
   * - For MEDIUM: add a title if provided.
   * - For COMPLEX: add a title and sections if multi-part.
   *
   * @param rawText Raw input text.
   * @param complexity Complexity level of the document.
   * @param sections Optional array of sections for multi-part documents.
   * @param title Optional document title.
   * @returns Structured text with adaptive titles and sections.
   */
  private adaptiveStructure(
    rawText: string,
    complexity: Complexity,
    sections?: Section[],
    title?: string,
  ): string {
    let result = '';

    // SIMPLE: return raw text as-is, no structure
    if (complexity === Complexity.SIMPLE) {
      return rawText.trim();
    }

    // MEDIUM: add title if present, no sections
    if (complexity === Complexity.MEDIUM) {
      if (title && title.trim() !== '') {
        result += `# ${title.trim()}\n\n`;
      }
      result += rawText.trim();
      return result;
    }

    // COMPLEX: add title and sections if multi-part
    if (complexity === Complexity.COMPLEX) {
      if (title && title.trim() !== '') {
        result += `# ${title.trim()}\n\n`;
      }

      if (sections && sections.length > 1) {
        // Add each section with a secondary heading
        sections.forEach((section) => {
          result += `## ${section.title.trim()}\n\n${section.content.trim()}\n\n`;
        });
      } else if (sections && sections.length === 1) {
        // Single section: add title and content
        const section = sections[0];
        result += `## ${section.title.trim()}\n\n${section.content.trim()}\n\n`;
      } else {
        // No sections: fallback to raw text
        result += rawText.trim();
      }

      return result.trim();
    }

    // Fallback: return raw text
    return rawText.trim();
  }

  /**
   * Layer 2: Document Formatting
   *
   * Applies consistent formatting rules:
   * - Normalize line endings to \n
   * - Trim trailing whitespace
   * - Ensure paragraphs are separated by exactly one blank line
   * - Replace multiple spaces with single space
   *
   * @param text Input text to format.
   * @returns Formatted document text.
   */
  private documentFormatting(text: string): string {
    // Normalize line endings to \n
    let formatted = text.replace(/\r\n|\r/g, '\n');

    // Remove trailing whitespace on each line
    formatted = formatted.replace(REGEX.trailingWhitespaceLine, '');

    // Replace multiple spaces with one space (except inside code blocks or URLs)
    // For simplicity, assume no code blocks here, so replace globally
    formatted = formatted.replace(/ {2,}/g, ' ');

    // Ensure paragraphs separated by exactly one blank line
    // Replace 2+ newlines with exactly 2 newlines (one blank line)
    formatted = formatted.replace(REGEX.multipleNewlines, '\n\n');

    // Trim leading and trailing whitespace
    formatted = formatted.trim();

    return formatted;
  }

  /**
   * Layer 3: Citation Formatting
   *
   * Replaces citation placeholders in the text with properly formatted citations.
   * Citation placeholders are expected in the form [[CITATION:id]].
   * If a citation is not found, leaves the placeholder as is.
   *
   * @param text Text containing citation placeholders.
   * @param citations Array of Citation objects to resolve.
   * @returns Text with citations formatted.
   */
  private citationFormatting(text: string, citations: Citation[]): string {
    if (citations.length === 0) {
      return text;
    }

    // Build a map for quick lookup
    const citationMap = new Map<string, Citation>();
    citations.forEach((c) => citationMap.set(c.id, c));

    // Replace placeholders with formatted citations
    const formatted = text.replace(
      REGEX.citationPlaceholder,
      (match, citationId: string) => {
        const citation = citationMap.get(citationId);
        if (!citation) {
          // Citation not found, leave placeholder intact but mark as unresolved
          return `[[UNRESOLVED_CITATION:${citationId}]]`;
        }

        // Format citation as markdown link if URL present, else plain text
        if (citation.url && citation.url.trim() !== '') {
          return `[${citation.text.trim()}](${citation.url.trim()})`;
        }
        return citation.text.trim();
      },
    );

    return formatted;
  }

  /**
   * Layer 4: Marker Injection
   *
   * Injects markers into the text. Markers are placeholders like [[MARKER:name]].
   * This layer replaces them with standardized markers, e.g. <mark data-name="name"></mark>.
   * If no markers present, returns text as-is.
   *
   * @param text Text containing marker placeholders.
   * @returns Text with markers injected.
   */
  private markerInjection(text: string): string {
    if (!REGEX.markerPlaceholder.test(text)) {
      return text;
    }

    // Replace all marker placeholders with HTML mark tags
    const injected = text.replace(
      REGEX.markerPlaceholder,
      (match, markerName: string) => {
        const safeName = this.escapeHtmlAttr(markerName.trim());
        return `<mark data-name="${safeName}"></mark>`;
      },
    );

    return injected;
  }

  /**
   * Layer 5: Cleanup
   *
   * Final cleanup to ensure no unresolved placeholders remain,
   * no trailing whitespace, and consistent formatting.
   *
   * @param text Text to clean up.
   * @returns Cleaned text.
   */
  private cleanup(text: string): string {
    let cleaned = text;

    // Remove unresolved citation placeholders (or optionally log them)
    cleaned = cleaned.replace(/\[\[UNRESOLVED_CITATION:[^\]]+\]\]/g, '');

    // Remove any leftover placeholders (citation or marker)
    cleaned = cleaned.replace(REGEX.citationPlaceholder, '');
    cleaned = cleaned.replace(REGEX.markerPlaceholder, '');

    // Remove trailing whitespace lines again
    cleaned = cleaned.replace(REGEX.trailingWhitespaceLine, '');

    // Normalize multiple newlines to max two
    cleaned = cleaned.replace(REGEX.multipleNewlines, '\n\n');

    // Trim leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Extracts formatted citations from the final text.
   * Looks for markdown links or plain citation texts.
   *
   * @param text Final formatted text.
   * @returns Array of formatted citation strings found.
   */
  private extractFormattedCitations(text: string): string[] {
    const citations: string[] = [];
    // Match markdown links [text](url)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = mdLinkRegex.exec(text)) !== null) {
      citations.push(match[0]);
    }

    // Also match plain citation texts that might not be links (heuristic: words inside brackets)
    // This is a heuristic and may be noisy
    const plainCitationRegex = /\b([A-Z][a-z]+ et al\.|\b[A-Z][a-z]+, \d{4})\b/g;
    while ((match = plainCitationRegex.exec(text)) !== null) {
      if (!citations.includes(match[0])) {
        citations.push(match[0]);
      }
    }

    return citations;
  }

  /**
   * Extracts marker names injected into the final text.
   *
   * @param text Final formatted text.
   * @returns Array of marker names found.
   */
  private extractMarkers(text: string): string[] {
    const markers: string[] = [];
    const markerTagRegex = /<mark data-name="([^"]+)"><\/mark>/g;
    let match: RegExpExecArray | null;
    while ((match = markerTagRegex.exec(text)) !== null) {
      markers.push(match[1]);
    }
    return markers;
  }

  /**
   * Escapes a string for safe use inside HTML attribute values.
   * @param str Input string.
   * @returns Escaped string.
   */
  private escapeHtmlAttr(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
