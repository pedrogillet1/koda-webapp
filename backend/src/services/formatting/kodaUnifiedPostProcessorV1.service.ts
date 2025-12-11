/**
 * Layer 4: Unified Post-Processor V1
 *
 * Final polish:
 * - Replace fallback markers [FALLBACK_*] → templates
 * - Fix Markdown (unbalanced **, broken links)
 * - Normalize whitespace (final cleanup)
 * - Add closing sentence (if appropriate)
 * - Strip artifacts (debug markers)
 * - Final validation
 *
 * NOTE: This is legacy V1 code. Fallback marker replacement has been
 * moved to the main formatting pipeline.
 */

import type { FormattingContext } from '../../types/ragV1.types';

class KodaUnifiedPostProcessorV1 {
  async process(text: string, context: FormattingContext): Promise<string> {
    let result = text;

    // 1. Replace fallback markers (simplified - V2 engine removed)
    result = this.replaceFallbackMarkers(result, context);

    // 2. Fix Markdown
    result = this.fixMarkdown(result);

    // 3. Normalize whitespace
    result = this.normalizeWhitespace(result);

    // 4. Add closing sentence (optional)
    result = this.addClosingSentence(result, context);

    // 5. Strip artifacts
    result = this.stripArtifacts(result);

    // 6. Final validation
    result = this.finalValidation(result);

    return result;
  }

  private replaceFallbackMarkers(text: string, _context: FormattingContext): string {
    // Simple fallback marker replacement (V2 engine removed)
    // Just strip any remaining fallback markers
    return text.replace(/\[FALLBACK_[A-Z_]+\]/g, '');
  }

  private fixMarkdown(text: string): string {
    // Fix unbalanced bold markers
    const boldCount = (text.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      text = text + '**'; // Close last bold
    }

    // Fix broken links [text](url)
    text = text.replace(/\[([^\]]+)\]\(\)/g, '$1'); // Remove empty links

    // Fix nested bold
    text = text.replace(/\*\*\*\*/g, ''); // Remove double bold

    return text;
  }

  private normalizeWhitespace(text: string): string {
    // Remove trailing whitespace per line
    text = text.split('\n').map(line => line.trimEnd()).join('\n');

    // Collapse 3+ blank lines → 2
    text = text.replace(/\n{4,}/g, '\n\n\n');

    // Trim start and end
    text = text.trim();

    return text;
  }

  private addClosingSentence(text: string, context: FormattingContext): string {
    // Only add for certain answer types
    if (context.answerType === 'doc_comparison' ||
        context.answerType === 'doc_multi_extract') {

      // Check if already has closing
      const lastLine = text.split('\n').pop()?.trim() || '';

      if (!lastLine.endsWith('.') && !lastLine.endsWith('?') && !lastLine.endsWith('!')) {
        // Don't add closing if last line is a list or heading
        if (!lastLine.startsWith('-') && !lastLine.startsWith('#')) {
          text = text + '\n\nPosso ajudar com mais alguma coisa?';
        }
      }
    }

    return text;
  }

  private stripArtifacts(text: string): string {
    // Remove debug markers
    const artifacts = [
      /\[DEBUG:.*?\]/g,
      /\[THINKING:.*?\]/g,
      /\[INTERNAL:.*?\]/g,
      /\{\{.*?\}\}/g, // Remove {{placeholders}}
    ];

    for (const pattern of artifacts) {
      text = text.replace(pattern, '');
    }

    return text;
  }

  private finalValidation(text: string): string {
    // Ensure minimum length
    if (text.trim().length < 10) {
      return 'Desculpe, não consegui gerar uma resposta adequada. Tente reformular sua pergunta.';
    }

    return text;
  }
}

export const kodaUnifiedPostProcessorV1 = new KodaUnifiedPostProcessorV1();
export default kodaUnifiedPostProcessorV1;
