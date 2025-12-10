/**
 * ============================================================================
 * LAYER 2: MASTER ANSWER FORMATTER
 * ============================================================================
 * 
 * GOAL: Make it pretty & consistent
 * - Fix encoding garbage
 * - Remove repeated blocks
 * - Format numbers and document names
 * - Keep spacing perfectly clean
 * - Optionally attach a "Documents used" list at the bottom
 * 
 * Based on Note 6 - Section 2
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  FormatterInput,
  FormatterOutput,
  Source,
  Language,
} from '../types';

export class MasterAnswerFormatter {
  
  /**
   * MAIN ENTRY POINT
   */
  public formatAnswer(input: FormatterInput): FormatterOutput {
    console.log(`[Formatter] Formatting answer: lang=${input.language}, mode=${input.answerMode}`);
    
    let text = input.structuredText;
    let stats = {
      encodingFixesApplied: 0,
      duplicatesRemoved: 0,
      boldingsApplied: 0,
      documentNamesFormatted: 0,
    };
    
    // Step 1: Fix encoding / UTF-8 garbage
    const { text: encodingFixed, fixCount } = this.fixEncoding(text);
    text = encodingFixed;
    stats.encodingFixesApplied = fixCount;
    
    // Step 2: Remove duplicated paragraphs
    const { text: deduped, removeCount } = this.removeDuplicatedParagraphs(text);
    text = deduped;
    stats.duplicatesRemoved = removeCount;
    
    // Step 3: Normalize spacing
    text = this.normalizeSpacing(text);
    
    // Step 4: Consistent bolding
    const { text: bolded, boldCount } = this.applyConsistentBolding(text);
    text = bolded;
    stats.boldingsApplied = boldCount;
    
    // Step 5: Document names inline
    const { text: docFormatted, docCount } = this.formatDocumentNamesInline(text, input.sources);
    text = docFormatted;
    stats.documentNamesFormatted = docCount;
    
    // Step 6: Optional "Documents used" section
    if (input.options?.addDocumentsUsedSection && input.sources.length > 0) {
      text = this.addDocumentsUsedSection(text, input.sources, input.language);
    }
    
    // Step 7: Soft truncation (optional)
    if (input.options?.maxLength && text.length > input.options.maxLength) {
      text = this.softTruncate(text, input.options.maxLength, input.language);
    }
    
    // Step 8: Final spacing cleanup
    text = this.normalizeSpacing(text);
    
    return {
      formattedText: text,
      stats,
    };
  }
  
  // ==========================================================================
  // STEP 1: FIX ENCODING / UTF-8 GARBAGE
  // ==========================================================================
  
  private fixEncoding(text: string): { text: string; fixCount: number } {
    let fixCount = 0;
    
    // Common UTF-8 mojibake patterns
    const fixes: Array<[RegExp, string]> = [
      // Portuguese accents
      [/Ã§/g, 'ç'],
      [/Ã£/g, 'ã'],
      [/Ã©/g, 'é'],
      [/Ã¡/g, 'á'],
      [/Ã³/g, 'ó'],
      [/Ã­/g, 'í'],
      [/Ãº/g, 'ú'],
      [/Ã /g, 'à'],
      [/Ã´/g, 'ô'],
      [/Ãª/g, 'ê'],
      [/Ã¢/g, 'â'],
      [/Ãµ/g, 'õ'],
      
      // Uppercase
      [/Ã‡/g, 'Ç'],
      [/Ã/g, 'Á'],
      [/Ã€/g, 'À'],
      [/Ãƒ/g, 'Ã'],
      [/Ã‰/g, 'É'],
      [/Ã"/g, 'Ó'],
      [/Ãš/g, 'Ú'],
      
      // Quotes and dashes
      [/â€"/g, '—'],  // em dash
      [/â€"/g, '–'],  // en dash
      [/â€œ/g, '"'],  // left double quote
      [/â€/g, '"'],   // right double quote
      [/â€™/g, "'"],  // apostrophe
      [/â€˜/g, "'"],  // left single quote
      
      // Special characters
      [/Â°/g, '°'],
      [/Â²/g, '²'],
      [/Â³/g, '³'],
      [/Â®/g, '®'],
      [/Â©/g, '©'],
    ];
    
    for (const [pattern, replacement] of fixes) {
      const matches = text.match(pattern);
      if (matches) {
        fixCount += matches.length;
        text = text.replace(pattern, replacement);
      }
    }
    
    return { text, fixCount };
  }
  
  // ==========================================================================
  // STEP 2: REMOVE DUPLICATED PARAGRAPHS
  // ==========================================================================
  
  private removeDuplicatedParagraphs(text: string): { text: string; removeCount: number } {
    // Split into paragraphs
    const paragraphs = text.split(/\n\n+/);
    const seen = new Set<string>();
    const unique: string[] = [];
    let removeCount = 0;
    
    for (const para of paragraphs) {
      const normalized = para.trim().toLowerCase();
      
      if (!normalized) continue;
      
      // Check if we've seen this paragraph before
      if (seen.has(normalized)) {
        removeCount++;
        continue;
      }
      
      seen.add(normalized);
      unique.push(para);
    }
    
    return {
      text: unique.join('\n\n'),
      removeCount,
    };
  }
  
  // ==========================================================================
  // STEP 3: NORMALIZE SPACING
  // ==========================================================================
  
  private normalizeSpacing(text: string): string {
    // Convert CRLF → LF
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    
    // Collapse 3+ blank lines into 2
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Ensure one space after periods when followed by a letter
    text = text.replace(/\.([A-Za-zÀ-ÿ])/g, '. $1');
    
    // Remove trailing spaces at end of lines
    text = text.split('\n').map(line => line.trimEnd()).join('\n');
    
    // Trim leading/trailing blanks
    text = text.trim();
    
    return text;
  }
  
  // ==========================================================================
  // STEP 4: CONSISTENT BOLDING
  // ==========================================================================
  
  private applyConsistentBolding(text: string): { text: string; boldCount: number } {
    let boldCount = 0;
    
    // Find already bold ranges to avoid double-bolding
    const boldRanges = this.findBoldRanges(text);
    
    const isProtected = (index: number): boolean => {
      return boldRanges.some(range => index >= range.start && index < range.end);
    };
    
    // Bold monetary amounts
    const currencyPatterns = [
      /\b(R\$\s*[\d.,]+(?:\s*(?:mil|milhões?|bilhões?|trilhões?))?)\b/gi,
      /\b(\$\s*[\d.,]+(?:\s*(?:thousand|million|billion|trillion))?)\b/gi,
      /\b(€\s*[\d.,]+(?:\s*(?:mil|milhões?|bilhões?))?)\b/gi,
      /\b(£\s*[\d.,]+(?:\s*(?:thousand|million|billion))?)\b/gi,
      /\b(USD\s*[\d.,]+)\b/gi,
      /\b(EUR\s*[\d.,]+)\b/gi,
      /\b(BRL\s*[\d.,]+)\b/gi,
    ];
    
    for (const pattern of currencyPatterns) {
      text = text.replace(pattern, (match, p1, offset) => {
        if (isProtected(offset)) return match;
        boldCount++;
        return `**${p1}**`;
      });
    }
    
    // Bold percentages
    text = text.replace(/\b(\d+(?:[.,]\d+)?%)\b/g, (match, p1, offset) => {
      if (isProtected(offset)) return match;
      boldCount++;
      return `**${p1}**`;
    });
    
    // Bold key units
    const units = ['m²', 'm³', 'km²', 'hectares', 'milhões', 'bilhões', 'trilhões'];
    for (const unit of units) {
      const pattern = new RegExp(`\\b(\\d+(?:[.,]\\d+)?\\s*${unit})\\b`, 'gi');
      text = text.replace(pattern, (match, p1, offset) => {
        if (isProtected(offset)) return match;
        boldCount++;
        return `**${p1}**`;
      });
    }
    
    return { text, boldCount };
  }
  
  private findBoldRanges(text: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const regex = /\*\*[^*]+\*\*/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    
    return ranges;
  }
  
  // ==========================================================================
  // STEP 5: DOCUMENT NAMES INLINE
  // ==========================================================================
  
  private formatDocumentNamesInline(text: string, sources: Source[]): { text: string; docCount: number } {
    let docCount = 0;
    
    for (const source of sources) {
      const filename = source.filename || source.documentName || source.title;
      if (!filename) continue;
      
      // Escape special regex characters
      const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Find mentions of this filename (case-insensitive)
      const pattern = new RegExp(`\\b${escapedFilename}\\b`, 'gi');
      
      // Replace with bold version (only first occurrence)
      let replaced = false;
      text = text.replace(pattern, (match) => {
        if (!replaced) {
          replaced = true;
          docCount++;
          return `**${match}**`;
        }
        return match;
      });
      
      // Also replace italics version with bold
      const italicPattern = new RegExp(`\\*${escapedFilename}\\*`, 'gi');
      text = text.replace(italicPattern, `**${filename}**`);
    }
    
    return { text, docCount };
  }
  
  // ==========================================================================
  // STEP 6: OPTIONAL "DOCUMENTS USED" SECTION
  // ==========================================================================
  
  private addDocumentsUsedSection(text: string, sources: Source[], language: Language): string {
    const heading = language === 'pt' ? 'Documentos usados' : 'Documents used';
    
    const docList = sources
      .map((source, index) => {
        const filename = source.filename || source.documentName || source.title || 'Unknown';
        return `${index + 1}. **${filename}**`;
      })
      .join('\n');
    
    return `${text}\n\n---\n### ${heading}\n\n${docList}`;
  }
  
  // ==========================================================================
  // STEP 7: SOFT TRUNCATION (OPTIONAL)
  // ==========================================================================
  
  private softTruncate(text: string, maxLength: number, language: Language): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Find last sentence boundary before maxLength
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    
    if (lastPeriod > maxLength * 0.8) {
      // Cut at sentence boundary
      const cut = text.substring(0, lastPeriod + 1);
      const note = language === 'pt' 
        ? '_(Resposta truncada para ficar mais objetiva.)_'
        : '_(Answer truncated for brevity.)_';
      
      return `${cut}\n\n${note}`;
    }
    
    // Just cut at maxLength
    return text.substring(0, maxLength) + '...';
  }
}

// Export singleton instance
export const masterAnswerFormatter = new MasterAnswerFormatter();
