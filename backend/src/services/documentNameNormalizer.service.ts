// FILE: backend/src/services/documentNameNormalizer.service.ts
// PURPOSE: Normalize document names to bold format with spaces (no underscores/hyphens)

/**
 * Document Name Normalizer Service
 *
 * Ensures all document names are formatted consistently:
 * - Bold (**filename.pdf**) NOT italic (*filename.pdf*)
 * - Spaces instead of underscores/hyphens
 * - Clickable (frontend will handle click events)
 */

export interface NormalizedDocumentName {
  original: string;
  normalized: string;
  formatted: string; // Bold markdown format
}

class DocumentNameNormalizerService {
  /**
   * Normalize a single document name
   *
   * @param filename - Original filename (e.g., "my_document-file.pdf")
   * @returns Normalized name with spaces (e.g., "my document file.pdf")
   */
  normalizeDocumentName(filename: string): string {
    if (!filename) return filename;

    // Step 1: Replace underscores and hyphens with spaces
    // my_document-file.pdf → my document file.pdf
    let normalized = filename.replace(/[_-]/g, ' ');

    // Step 2: Remove multiple consecutive spaces
    // my  document   file.pdf → my document file.pdf
    normalized = normalized.replace(/\s+/g, ' ');

    // Step 3: Trim leading/trailing spaces
    normalized = normalized.trim();

    return normalized;
  }

  /**
   * Format document name as bold markdown
   *
   * @param filename - Document name (normalized or not)
   * @returns Bold markdown format: **filename.pdf**
   */
  formatAsBold(filename: string): string {
    const normalized = this.normalizeDocumentName(filename);
    return `**${normalized}**`;
  }

  /**
   * Process a complete answer and fix all document names
   *
   * Finds all document references and converts them to bold with spaces
   *
   * @param answer - Raw answer text
   * @returns Answer with all document names formatted correctly
   */
  processAnswer(answer: string): string {
    if (!answer) return answer;

    // Pattern 1: Fix italic document names (*filename.pdf* → **filename.pdf**)
    // Matches: *anything.pdf*, *anything.docx*, etc.
    answer = answer.replace(
      /\*([^*]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpg|jpeg))\*/gi,
      (match, filename) => {
        const normalized = this.normalizeDocumentName(filename);
        return `**${normalized}**`;
      }
    );

    // Pattern 2: Fix already-bold but with underscores/hyphens
    // Matches: **my_document.pdf** → **my document.pdf**
    answer = answer.replace(
      /\*\*([^*]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpg|jpeg))\*\*/gi,
      (match, filename) => {
        const normalized = this.normalizeDocumentName(filename);
        return `**${normalized}**`;
      }
    );

    // Pattern 3: Fix plain document names (no formatting)
    // Matches: my_document.pdf → **my document.pdf**
    // CAREFUL: Only match if not already in markdown formatting
    answer = answer.replace(
      /(?<!\*\*)(?<!\*)([A-Za-z0-9_-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpg|jpeg))(?!\*\*)(?!\*)/gi,
      (match, filename) => {
        // Skip if it's part of a URL or path
        if (match.includes('/') || match.includes('\\')) {
          return match;
        }
        const normalized = this.normalizeDocumentName(filename);
        return `**${normalized}**`;
      }
    );

    return answer;
  }

  /**
   * Normalize a list of document names
   *
   * @param filenames - Array of filenames
   * @returns Array of normalized filenames
   */
  normalizeDocumentNames(filenames: string[]): string[] {
    return filenames.map(filename => this.normalizeDocumentName(filename));
  }

  /**
   * Format a list of documents for display
   *
   * @param filenames - Array of filenames
   * @param maxDisplay - Maximum number to display before "See all"
   * @returns Formatted string with bold document names
   */
  formatDocumentList(filenames: string[], maxDisplay: number = 5): string {
    const normalized = this.normalizeDocumentNames(filenames);

    if (normalized.length === 0) {
      return 'No documents found.';
    }

    if (normalized.length <= maxDisplay) {
      // Display all
      return normalized.map(name => `• **${name}**`).join('\n');
    }

    // Display first N and add "See all"
    const displayed = normalized.slice(0, maxDisplay);
    const remaining = normalized.length - maxDisplay;

    const lines = displayed.map(name => `• **${name}**`);
    lines.push(`...and ${remaining} more. **See all**`);

    return lines.join('\n');
  }

  /**
   * Extract all document names from text
   *
   * @param text - Text to search
   * @returns Array of document names found
   */
  extractDocumentNames(text: string): string[] {
    const pattern = /([A-Za-z0-9_-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpg|jpeg))/gi;
    const matches = text.match(pattern) || [];

    // Remove duplicates
    return [...new Set(matches)];
  }

  /**
   * Check if a string contains document names
   *
   * @param text - Text to check
   * @returns True if document names found
   */
  hasDocumentNames(text: string): boolean {
    return /[A-Za-z0-9_-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpg|jpeg)/i.test(text);
  }

  /**
   * Get full normalized info for a document
   *
   * @param filename - Original filename
   * @returns Object with original, normalized, and formatted versions
   */
  getNormalizedInfo(filename: string): NormalizedDocumentName {
    const normalized = this.normalizeDocumentName(filename);
    const formatted = this.formatAsBold(filename);

    return {
      original: filename,
      normalized,
      formatted
    };
  }
}

// Export singleton instance
export const documentNameNormalizer = new DocumentNameNormalizerService();

// Export class for testing
export default DocumentNameNormalizerService;
