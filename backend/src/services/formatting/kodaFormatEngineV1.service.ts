/**
 * Layer 2: Format Engine V1
 *
 * Handles:
 * - Convert [[DOC:id|Title]] → clickable Title
 * - Apply Markdown conventions
 * - Format citation markers [src:1]
 * - Build "Fontes:" section
 * - Ensure consistent formatting
 * - Attach citation metadata for frontend
 */

import type { FormattingContext, Citation } from '../../types/ragV1.types';

class KodaFormatEngineV1 {
  async process(
    text: string,
    context: FormattingContext
  ): Promise<{ text: string; citations: Citation[] }> {
    let result = text;
    const citations: Citation[] = [];

    // 1. Extract and convert doc placeholders
    const { text: converted, citations: extracted } = this.convertDocPlaceholders(result, context);
    result = converted;
    citations.push(...extracted);

    // 2. Apply Markdown conventions
    result = this.applyMarkdownConventions(result);

    // 3. Format citation markers
    result = this.formatCitationMarkers(result);

    // 4. Build sources section
    if (citations.length > 0) {
      result = this.buildSourcesSection(result, citations);
    }

    // 5. Ensure consistent formatting
    result = this.ensureConsistentFormatting(result);

    return { text: result, citations };
  }

  private convertDocPlaceholders(
    text: string,
    context: FormattingContext
  ): { text: string; citations: Citation[] } {
    const citations: Citation[] = [];
    let citationId = 1;

    // Find all [[DOC:id|Title]] patterns
    const pattern = /\[\[DOC:([^\|]+)\|([^\]]+)\]\]/g;

    const converted = text.replace(pattern, (match, docId, title) => {
      // Add to citations
      citations.push({
        id: String(citationId),
        documentId: docId.trim(),
        title: title.trim(),
        filename: title.trim(),
        type: 'inline',
        occurrences: 1,
      });

      // Convert to bold title with citation marker
      const result = `**${title.trim()}** [${citationId}]`;
      citationId++;

      return result;
    });

    return { text: converted, citations };
  }

  private applyMarkdownConventions(text: string): string {
    // Fix unbalanced bold markers
    const boldCount = (text.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      // Remove last ** if unbalanced
      const lastIndex = text.lastIndexOf('**');
      if (lastIndex !== -1) {
        text = text.substring(0, lastIndex) + text.substring(lastIndex + 2);
      }
    }

    // Ensure space after bold
    text = text.replace(/\*\*([^\s])/g, '** $1');

    return text;
  }

  private formatCitationMarkers(text: string): string {
    // Ensure citation markers are properly formatted: [1], [2], etc.
    text = text.replace(/\[(\d+)\]/g, '[$1]');

    return text;
  }

  private buildSourcesSection(text: string, citations: Citation[]): string {
    // Don't add sources section if it already exists
    if (text.includes('Fontes:') || text.includes('Sources:')) {
      return text;
    }

    const sourcesList = citations
      .map(c => `${c.id}. ${c.title}`)
      .join('\n');

    return `${text}\n\n**Fontes:**\n${sourcesList}`;
  }

  private ensureConsistentFormatting(text: string): string {
    // Final consistency pass

    // Ensure blank line before headings
    text = text.replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2');

    // Ensure blank line after headings
    text = text.replace(/(#{1,3}\s[^\n]+)\n([^\n])/g, '$1\n\n$2');

    return text;
  }
}

export const kodaFormatEngineV1 = new KodaFormatEngineV1();
export default kodaFormatEngineV1;
