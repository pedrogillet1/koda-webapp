/**
 * Layer 1: Output Structure Engine V1
 *
 * KODA FIX: Updated to preserve {{DOC:::}} markers and markdown lists
 *
 * Handles:
 * - Normalize spacing (CRLF → LF, collapse blank lines)
 * - Remove duplicate paragraphs
 * - Smart bolding with PROTECTED RANGES (R$ 500, 25%, m²)
 * - Normalize headings
 * - Ensure paragraph size (2-5 lines) - SKIP lists
 * - Normalize bullets (preserving existing formatting)
 * - Preserve {{DOC:::}} markers
 */

import type { FormattingContext } from '../../types/ragV1.types';

// Protected range for text that should not be modified
interface ProtectedRange {
  start: number;
  end: number;
  placeholder: string;
  original: string;
}

class KodaOutputStructureEngineV1 {
  async process(text: string, context: FormattingContext): Promise<string> {
    let result = text;

    // KODA FIX: Extract and protect special markers FIRST
    const { text: withPlaceholders, ranges } = this.extractProtectedRanges(result);
    result = withPlaceholders;

    // 1. Normalize spacing
    result = this.normalizeSpacing(result);

    // 2. Remove duplicates
    result = this.removeDuplicates(result);

    // 3. Smart bolding (with protected ranges already extracted)
    result = this.applySmartBolding(result);

    // 4. Normalize headings
    result = this.normalizeHeadings(result);

    // 5. Ensure paragraph size (SKIP bullet lists)
    result = this.ensureParagraphSize(result);

    // 6. Normalize bullets (preserving existing formatting)
    result = this.normalizeBullets(result);

    // KODA FIX: Restore protected ranges LAST
    result = this.restoreProtectedRanges(result, ranges);

    return result;
  }

  /**
   * KODA FIX: Extract {{DOC:::}}, existing bold (**), and links before processing
   */
  private extractProtectedRanges(text: string): { text: string; ranges: ProtectedRange[] } {
    const ranges: ProtectedRange[] = [];
    let result = text;
    let placeholderIndex = 0;

    // Pattern for {{DOC:::...:::}}
    const docPattern = /\{\{DOC:::[^}]+:::\}\}/g;
    result = result.replace(docPattern, (match) => {
      const placeholder = `__PROTECTED_DOC_${placeholderIndex++}__`;
      ranges.push({ start: 0, end: 0, placeholder, original: match });
      return placeholder;
    });

    // Pattern for existing bold **text**
    const boldPattern = /\*\*[^*]+\*\*/g;
    result = result.replace(boldPattern, (match) => {
      const placeholder = `__PROTECTED_BOLD_${placeholderIndex++}__`;
      ranges.push({ start: 0, end: 0, placeholder, original: match });
      return placeholder;
    });

    // Pattern for markdown links [text](url)
    const linkPattern = /\[[^\]]+\]\([^)]+\)/g;
    result = result.replace(linkPattern, (match) => {
      const placeholder = `__PROTECTED_LINK_${placeholderIndex++}__`;
      ranges.push({ start: 0, end: 0, placeholder, original: match });
      return placeholder;
    });

    return { text: result, ranges };
  }

  /**
   * KODA FIX: Restore protected ranges after all processing
   */
  private restoreProtectedRanges(text: string, ranges: ProtectedRange[]): string {
    let result = text;
    for (const range of ranges) {
      result = result.replace(range.placeholder, range.original);
    }
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

  /**
   * KODA FIX: Smart bolding only on unprotected text
   * Protected ranges are already replaced with placeholders
   */
  private applySmartBolding(text: string): string {
    // Bold currency: R$ 1.000, $500, €1.000
    // Skip if already inside placeholders
    text = text.replace(/(?<!_)([R$€£])\s*(\d[\d.,]*)(?!_)/g, '**$1 $2**');

    // Bold percentages: 25%, 3.5%
    text = text.replace(/(?<!_)(\d+(?:[.,]\d+)?)\s*%(?!_)/g, '**$1%**');

    // Bold units: m², km², R$/m²
    text = text.replace(/(?<!_)(\d+(?:[.,]\d+)?)\s*(m²|km²|ha|m³)(?!_)/g, '**$1 $2**');

    // Bold dates: 01/01/2024, 2024-01-01
    text = text.replace(/(?<!_)(\d{1,2}\/\d{1,2}\/\d{2,4})(?!_)/g, '**$1**');
    text = text.replace(/(?<!_)(\d{4}-\d{2}-\d{2})(?!_)/g, '**$1**');

    // KODA FIX: Clean up double bold markers that may have been created
    text = text.replace(/\*\*\*\*/g, '**');

    return text;
  }

  private normalizeHeadings(text: string): string {
    // Remove bad headings (#### or more)
    text = text.replace(/^#{4,}\s+/gm, '### ');

    // Ensure space after #
    text = text.replace(/^(#{1,3})([^\s])/gm, '$1 $2');

    return text;
  }

  /**
   * KODA FIX: Don't split bullet list paragraphs
   */
  private ensureParagraphSize(text: string): string {
    const paragraphs = text.split('\n\n');
    const result: string[] = [];

    for (const para of paragraphs) {
      const lines = para.split('\n');

      // KODA FIX: Skip splitting if this is a bullet list
      const isBulletList = lines.some(line => /^[-*•]\s/.test(line.trim()));
      if (isBulletList) {
        result.push(para);
        continue;
      }

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

  /**
   * KODA FIX: Only normalize bullets that aren't already formatted correctly
   */
  private normalizeBullets(text: string): string {
    // Only convert * and • to -, keep existing - as-is
    text = text.replace(/^[*•]\s+/gm, '- ');

    // Ensure space after bullet (only if missing)
    text = text.replace(/^-([^\s-])/gm, '- $1');

    return text;
  }
}

export const kodaOutputStructureEngineV1 = new KodaOutputStructureEngineV1();
export default kodaOutputStructureEngineV1;
