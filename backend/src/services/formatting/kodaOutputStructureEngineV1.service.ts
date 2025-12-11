/**
 * Layer 1: Output Structure Engine V1
 *
 * Handles:
 * - Normalize spacing (CRLF → LF, collapse blank lines)
 * - Remove duplicate paragraphs
 * - Smart bolding (R$ 500, 25%, m²)
 * - Normalize headings
 * - Ensure paragraph size (2-5 lines)
 * - Normalize bullets
 * - Normalize doc placeholders [[DOC:id|Title]]
 */

import type { FormattingContext } from '../../types/ragV1.types';

class KodaOutputStructureEngineV1 {
  async process(text: string, context: FormattingContext): Promise<string> {
    let result = text;

    // 1. Normalize spacing
    result = this.normalizeSpacing(result);

    // 2. Remove duplicates
    result = this.removeDuplicates(result);

    // 3. Smart bolding
    result = this.applySmartBolding(result);

    // 4. Normalize headings
    result = this.normalizeHeadings(result);

    // 5. Ensure paragraph size
    result = this.ensureParagraphSize(result);

    // 6. Normalize bullets
    result = this.normalizeBullets(result);

    // 7. Normalize doc placeholders
    result = this.normalizeDocPlaceholders(result);

    return result;
  }

  private normalizeSpacing(text: string): string {
    // CRLF → LF
    let result = text.replace(/\r\n/g, '\n');

    // Collapse 3+ blank lines → 2
    result = result.replace(/\n{4,}/g, '\n\n\n');

    // Trim trailing whitespace per line
    result = result.split('\n').map(line => line.trimEnd()).join('\n');

    return result.trim();
  }

  private removeDuplicates(text: string): string {
    const paragraphs = text.split('\n\n');
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const para of paragraphs) {
      const normalized = para.trim().toLowerCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        unique.push(para);
      }
    }

    return unique.join('\n\n');
  }

  private applySmartBolding(text: string): string {
    // Bold currency: R$ 1.000, $500, €1.000
    text = text.replace(/([R$€£])\s*(\d[\d.,]*)/g, '**$1 $2**');

    // Bold percentages: 25%, 3.5%
    text = text.replace(/(\d+(?:[.,]\d+)?)\s*%/g, '**$1%**');

    // Bold units: m², km², R$/m²
    text = text.replace(/(\d+(?:[.,]\d+)?)\s*(m²|km²|ha|m³)/g, '**$1 $2**');

    // Bold dates: 01/01/2024, 2024-01-01
    text = text.replace(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g, '**$1**');
    text = text.replace(/(\d{4}-\d{2}-\d{2})/g, '**$1**');

    return text;
  }

  private normalizeHeadings(text: string): string {
    // Remove bad headings (#### or more)
    text = text.replace(/^#{4,}\s+/gm, '### ');

    // Ensure space after #
    text = text.replace(/^(#{1,3})([^\s])/gm, '$1 $2');

    return text;
  }

  private ensureParagraphSize(text: string): string {
    // Split paragraphs that are too long (>5 lines)
    const paragraphs = text.split('\n\n');
    const result: string[] = [];

    for (const para of paragraphs) {
      const lines = para.split('\n');

      if (lines.length > 5) {
        // Split into chunks of 3-4 lines
        for (let i = 0; i < lines.length; i += 4) {
          const chunk = lines.slice(i, i + 4).join('\n');
          result.push(chunk);
        }
      } else {
        result.push(para);
      }
    }

    return result.join('\n\n');
  }

  private normalizeBullets(text: string): string {
    // Standardize bullet markers: *, -, • → -
    text = text.replace(/^[*•]\s+/gm, '- ');

    // Ensure space after bullet
    text = text.replace(/^-([^\s])/gm, '- $1');

    return text;
  }

  private normalizeDocPlaceholders(text: string): string {
    // [[DOC:id|Title]] → keep as-is for now
    // Will be converted to clickable format in Layer 2
    return text;
  }
}

export const kodaOutputStructureEngineV1 = new KodaOutputStructureEngineV1();
export default kodaOutputStructureEngineV1;
