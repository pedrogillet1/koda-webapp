/**
 * Koda Output Structure Engine (Layer 1)
 *
 * This is the ONLY service responsible for ALL formatting and structure.
 * Replaces: formatEnforcement, formatEnforcementV2, responseFormatter,
 *           outputPostProcessor, textCleaner, boldFixer, doubleHeaderRemover,
 *           titleInsertion, masterAnswerFormatter, answerPostProcessor,
 *           kodaUnifiedPostProcessor, documentNameFormatter, smartBoldingEnhanced,
 *           kodaCitationFormat, responseDeduplicate, and all other formatting services.
 *
 * Architecture: Mimics ChatGPT's decoder internal formatting heuristics
 */

interface FormattingRules {
  maxTitleLength: number;
  maxIntroLines: number;
  minAnswerLengthForTitle: number;
  minAnswerLengthForClosing: number;
  bulletIndentation: string;
  sectionSpacing: string;
}

interface FormattingContext {
  query: string;
  intent?: string;
  documentCount?: number;
  language?: string;
  isGreeting?: boolean;
  isDocListing?: boolean;
}

interface FormattedOutput {
  text: string;
  hasTitle: boolean;
  hasClosing: boolean;
  sectionCount: number;
  bulletCount: number;
  stats: {
    originalLength: number;
    finalLength: number;
    linesAdded: number;
    linesRemoved: number;
  };
}

class KodaOutputStructureEngine {
  private rules: FormattingRules = {
    maxTitleLength: 80,
    maxIntroLines: 2,
    minAnswerLengthForTitle: 200,
    minAnswerLengthForClosing: 300,
    bulletIndentation: '• ',
    sectionSpacing: '\n\n',
  };

  // Document extensions for detection
  private readonly DOC_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'gif'];

  /**
   * MAIN ENTRY POINT
   * This is the ONLY function that should be called from outside
   */
  public formatAnswer(
    rawAnswer: string,
    context: FormattingContext
  ): FormattedOutput {
    const originalLength = rawAnswer.length;

    // Skip formatting for greetings and very short answers
    if (context.isGreeting || rawAnswer.length < 50) {
      return {
        text: rawAnswer.trim(),
        hasTitle: false,
        hasClosing: false,
        sectionCount: 0,
        bulletCount: 0,
        stats: { originalLength, finalLength: rawAnswer.length, linesAdded: 0, linesRemoved: 0 },
      };
    }

    // Step 1: Clean and normalize
    let text = this.normalizeText(rawAnswer);

    // Step 2: Remove duplicates
    text = this.removeDuplicates(text);

    // Step 3: Fix spacing
    text = this.fixSpacing(text);

    // Step 4: Apply smart bolding
    text = this.applySmartBolding(text, context.language || 'en');

    // Step 5: Format document names (make clickable)
    text = this.formatDocumentNames(text);

    // Step 6: Structure sections
    text = this.structureSections(text);

    // Step 7: Format bullets
    text = this.formatBullets(text);

    // Step 8: Add title if needed
    const { text: textWithTitle, hasTitle } = this.addTitleIfNeeded(text, context);
    text = textWithTitle;

    // Step 9: Add closing if needed
    const { text: textWithClosing, hasClosing } = this.addClosingIfNeeded(text, context);
    text = textWithClosing;

    // Step 10: Final cleanup
    text = this.finalCleanup(text);

    // Collect stats
    const stats = {
      originalLength,
      finalLength: text.length,
      linesAdded: Math.max(0, (text.match(/\n/g) || []).length - (rawAnswer.match(/\n/g) || []).length),
      linesRemoved: 0,
    };

    return {
      text,
      hasTitle,
      hasClosing,
      sectionCount: this.countSections(text),
      bulletCount: this.countBullets(text),
      stats,
    };
  }

  /**
   * Step 1: Normalize text
   * - Fix encoding issues
   * - Normalize line breaks
   * - Remove control characters
   */
  private normalizeText(text: string): string {
    // Fix UTF-8 encoding issues (mojibake) using sequential replacements
    const utf8Fixes: Array<[string, string]> = [
      ['â€"', '—'],  // em dash
      ['â€"', '–'],  // en dash (same encoded, different result)
      ['â€œ', '"'],  // left double quote
      ['â€', '"'],   // right double quote
      ['â€™', "'"],  // apostrophe
      ['Ã§', 'ç'],
      ['Ã£', 'ã'],
      ['Ã©', 'é'],
      ['Ã¡', 'á'],
      ['Ã³', 'ó'],
      ['Ã­', 'í'],
      ['Ãº', 'ú'],
      ['Ã', 'à'],
      ['Ã´', 'ô'],
      ['Ãª', 'ê'],
      ['Ã¢', 'â'],
      ['Ã±', 'ñ'],
    ];

    for (const [broken, fixed] of utf8Fixes) {
      text = text.replace(new RegExp(broken, 'g'), fixed);
    }

    // Normalize line breaks
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');

    // Remove control characters (except newlines and tabs)
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize quotes
    text = text.replace(/[""]/g, '"');
    text = text.replace(/['']/g, "'");

    // Normalize dashes
    text = text.replace(/—/g, '—'); // em dash
    text = text.replace(/–/g, '–'); // en dash

    return text.trim();
  }

  /**
   * Step 2: Remove duplicates
   * - Duplicate sentences
   * - Duplicate paragraphs
   * - Duplicate sections
   */
  private removeDuplicates(text: string): string {
    // Remove duplicate consecutive lines
    const lines = text.split('\n');
    const uniqueLines: string[] = [];
    let previousLine = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip if exact duplicate of previous line (except empty lines)
      if (trimmedLine === previousLine && trimmedLine.length > 0) {
        continue;
      }

      uniqueLines.push(line);
      previousLine = trimmedLine;
    }

    text = uniqueLines.join('\n');

    // Remove duplicate paragraphs (more than 80% similarity)
    const paragraphs = text.split(/\n\n+/);
    const uniqueParagraphs: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const current = paragraphs[i].trim();

      if (current.length === 0) continue;

      // Check if similar to any previous paragraph
      let isDuplicate = false;
      for (const prev of uniqueParagraphs) {
        if (this.calculateSimilarity(current, prev) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueParagraphs.push(current);
      }
    }

    return uniqueParagraphs.join('\n\n');
  }

  /**
   * Calculate similarity between two strings (Jaccard index)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Step 3: Fix spacing
   * - Remove excessive blank lines
   * - Ensure consistent spacing between sections
   * - Fix spacing around bullets
   */
  private fixSpacing(text: string): string {
    // Remove more than 2 consecutive blank lines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Ensure blank line before headers
    text = text.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

    // Ensure blank line after headers
    text = text.replace(/(#{1,6}\s[^\n]+)\n([^\n#])/g, '$1\n\n$2');

    // Ensure blank line before bullet lists (but not between list items)
    text = text.replace(/([^\n•\-*\d])\n([•\-*]\s)/g, '$1\n\n$2');

    // Ensure blank line after bullet lists
    text = text.replace(/([•\-*]\s[^\n]+)\n([^\n•\-*\s])/g, '$1\n\n$2');

    // Remove blank lines between bullets (keep them compact)
    text = text.replace(/([•\-*]\s[^\n]+)\n\n([•\-*]\s)/g, '$1\n$2');

    // Remove trailing spaces from each line
    text = text.split('\n').map(line => line.trimEnd()).join('\n');

    return text.trim();
  }

  /**
   * Step 4: Apply smart bolding
   * - Currency values
   * - Percentages
   * - Dates
   * - Large numbers
   * - Key terms
   */
  private applySmartBolding(text: string, language: string): string {
    // Find protected ranges (already bold or in code blocks)
    const protectedRanges: Array<{ start: number; end: number }> = [];

    // Find existing bold ranges
    let match;
    const boldRegex = /\*\*[^*]+\*\*/g;
    while ((match = boldRegex.exec(text)) !== null) {
      protectedRanges.push({ start: match.index, end: match.index + match[0].length });
    }

    // Find code block ranges
    const codeRegex = /`[^`]+`/g;
    while ((match = codeRegex.exec(text)) !== null) {
      protectedRanges.push({ start: match.index, end: match.index + match[0].length });
    }

    const isProtected = (index: number): boolean => {
      return protectedRanges.some(range => index >= range.start && index < range.end);
    };

    // Bold currency values
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
      text = text.replace(pattern, (fullMatch, p1, offset) => {
        if (isProtected(offset)) return fullMatch;
        return `**${p1}**`;
      });
    }

    // Bold percentages
    text = text.replace(/\b(\d+(?:[.,]\d+)?%)\b/g, (fullMatch, p1, offset) => {
      if (isProtected(offset)) return fullMatch;
      return `**${p1}**`;
    });

    // Bold dates (various formats)
    const datePatterns = [
      /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, // 15/03/2024
      /\b(\d{1,2}-\d{1,2}-\d{2,4})\b/g,   // 15-03-2024
      /\b(\d{4}-\d{2}-\d{2})\b/g,         // 2024-03-15 (ISO)
    ];

    for (const pattern of datePatterns) {
      text = text.replace(pattern, (fullMatch, p1, offset) => {
        if (isProtected(offset)) return fullMatch;
        return `**${p1}**`;
      });
    }

    // Bold large numbers (with thousands separators)
    text = text.replace(/\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)\b/g, (fullMatch, p1, offset) => {
      if (isProtected(offset)) return fullMatch;
      return `**${p1}**`;
    });

    // Bold key financial/legal terms
    const keyTerms = [
      'LGPD', 'GDPR', 'ROI', 'NPV', 'IRR', 'EBITDA', 'KPI', 'SLA',
      'rescisão', 'contrato', 'cláusula', 'prazo', 'multa', 'garantia',
      'contract', 'clause', 'deadline', 'penalty', 'termination', 'warranty',
      'risco', 'risk', 'oportunidade', 'opportunity',
      'investimento', 'investment', 'retorno', 'return',
      'receita', 'revenue', 'despesa', 'expense', 'lucro', 'profit',
    ];

    for (const term of keyTerms) {
      // Only bold if it's a standalone word (not part of another word)
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      text = text.replace(regex, (fullMatch, p1, offset) => {
        if (isProtected(offset)) return fullMatch;
        return `**${p1}**`;
      });
    }

    // Fix double bolding
    text = text.replace(/\*\*\*\*([^*]+)\*\*\*\*/g, '**$1**');

    return text;
  }

  /**
   * Step 5: Format document names
   * - Make document names bold
   * - Mark them for clickable links in frontend
   */
  private formatDocumentNames(text: string): string {
    // Build regex pattern for document extensions
    const extPattern = this.DOC_EXTENSIONS.join('|');
    const docRegex = new RegExp(
      `\\b([A-Za-z0-9_\\-À-ÿ]+(?:[_\\-\\s][A-Za-z0-9_\\-À-ÿ]+)*\\.(?:${extPattern}))\\b`,
      'gi'
    );

    // Don't re-bold if already bold
    text = text.replace(docRegex, (fullMatch, docName) => {
      // Check if already bold
      const beforeMatch = text.substring(0, text.indexOf(fullMatch));
      if (beforeMatch.endsWith('**')) {
        return fullMatch;
      }
      return `**${docName}**`;
    });

    return text;
  }

  /**
   * Step 6: Structure sections
   * - Identify implicit sections
   * - Add proper headers where appropriate
   */
  private structureSections(text: string): string {
    const paragraphs = text.split(/\n\n+/);
    const structuredParagraphs: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();

      if (para.length === 0) continue;

      // If paragraph starts with a colon-prefixed label, make it a bold header
      const labelMatch = para.match(/^([^:]{1,30}):\s*(.+)$/s);
      if (labelMatch) {
        const [, label, content] = labelMatch;
        // Only convert if label looks like a section header
        const headerKeywords = [
          'resumo', 'summary', 'conclusão', 'conclusion',
          'análise', 'analysis', 'resultado', 'result',
          'recomendação', 'recommendation', 'observação', 'observation',
          'detalhes', 'details', 'contexto', 'context',
        ];

        const isHeader = headerKeywords.some(kw =>
          label.toLowerCase().includes(kw)
        );

        if (isHeader) {
          structuredParagraphs.push(`**${label}:**\n${content}`);
          continue;
        }
      }

      structuredParagraphs.push(para);
    }

    return structuredParagraphs.join('\n\n');
  }

  /**
   * Step 7: Format bullets
   * - Ensure consistent bullet style
   * - Fix indentation
   */
  private formatBullets(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Convert various bullet styles to consistent style
      const bulletMatch = line.match(/^\s*([•\-*]|\d+\.)\s+(.+)$/);

      if (bulletMatch) {
        const [, bulletType, content] = bulletMatch;

        // Keep numbered lists as is, convert others to bullet
        if (/\d+\./.test(bulletType)) {
          formattedLines.push(`${bulletType} ${content}`);
        } else {
          formattedLines.push(`${this.rules.bulletIndentation}${content}`);
        }
      } else {
        formattedLines.push(line);
      }
    }

    return formattedLines.join('\n');
  }

  /**
   * Step 8: Add title if needed
   * - Only for longer answers
   * - Based on query and intent
   */
  private addTitleIfNeeded(
    text: string,
    context: FormattingContext
  ): { text: string; hasTitle: boolean } {
    // Don't add title if:
    // 1. Answer is too short
    // 2. Already has a title (## header)
    // 3. Is a greeting
    // 4. Is a document listing

    if (text.length < this.rules.minAnswerLengthForTitle) {
      return { text, hasTitle: false };
    }

    if (text.match(/^#{1,6}\s/m)) {
      return { text, hasTitle: true };
    }

    if (context.isGreeting) {
      return { text, hasTitle: false };
    }

    if (context.isDocListing) {
      return { text, hasTitle: false };
    }

    // Check if query suggests a summary/analysis
    const queryLower = context.query.toLowerCase();
    const shouldHaveTitle =
      /\b(resumo|resumir|análise|analisar|explique|explicar|summary|summarize|analyze|explain)\b/.test(queryLower) ||
      /\b(o que|what|como|how|por que|why)\b/.test(queryLower);

    if (!shouldHaveTitle) {
      return { text, hasTitle: false };
    }

    // Generate title from query
    const title = this.generateTitle(context.query, context.intent);

    if (title) {
      return {
        text: `## ${title}\n\n${text}`,
        hasTitle: true,
      };
    }

    return { text, hasTitle: false };
  }

  /**
   * Generate title from query
   */
  private generateTitle(query: string, intent?: string): string | null {
    // Remove question words and clean up
    let title = query
      .replace(/^(what|how|why|when|where|who|which|can you|could you|please|por favor|qual|como|por que|quando|onde|quem|o que|você pode|poderia)\s+/gi, '')
      .replace(/\?+$/, '')
      .trim();

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Truncate if too long
    if (title.length > this.rules.maxTitleLength) {
      title = title.substring(0, this.rules.maxTitleLength - 3) + '...';
    }

    // Don't return very short titles
    if (title.length < 10) {
      return null;
    }

    return title;
  }

  /**
   * Step 9: Add closing if needed
   * - Only for longer answers
   * - Context-appropriate
   */
  private addClosingIfNeeded(
    text: string,
    context: FormattingContext
  ): { text: string; hasClosing: boolean } {
    // Don't add closing if:
    // 1. Answer is too short
    // 2. Already has a closing
    // 3. Is a greeting
    // 4. Is a document listing

    if (text.length < this.rules.minAnswerLengthForClosing) {
      return { text, hasClosing: false };
    }

    if (context.isGreeting || context.isDocListing) {
      return { text, hasClosing: false };
    }

    const lastLine = text.split('\n').pop()?.trim() || '';

    // Check if already has a closing
    const closingPhrases = [
      'let me know',
      'feel free',
      'posso ajudar',
      'posso fornecer',
      'need anything',
      'precisa de algo',
      'mais alguma',
      'something else',
      'anything else',
    ];

    if (closingPhrases.some(phrase => lastLine.toLowerCase().includes(phrase))) {
      return { text, hasClosing: true };
    }

    // Add appropriate closing based on language
    const language = context.language || 'en';
    const closing = this.getClosingPhrase(language);

    return {
      text: `${text}\n\n${closing}`,
      hasClosing: true,
    };
  }

  /**
   * Get closing phrase based on language
   */
  private getClosingPhrase(language: string): string {
    const closings: Record<string, string[]> = {
      pt: [
        'Posso fornecer mais detalhes se necessário.',
        'Posso ajudar com mais alguma coisa?',
        'Se precisar de mais informações, é só pedir.',
      ],
      es: [
        '¿Puedo ayudarte con algo más?',
        'Si necesitas más información, házmelo saber.',
      ],
      en: [
        'Let me know if you need more details.',
        'Feel free to ask if you have more questions.',
        'I can provide more information if needed.',
      ],
    };

    const options = closings[language] || closings.en;
    // Use a deterministic selection based on text length to avoid randomness
    return options[0];
  }

  /**
   * Step 10: Final cleanup
   * - Remove trailing spaces
   * - Ensure single trailing newline
   * - Fix any remaining formatting issues
   */
  private finalCleanup(text: string): string {
    // Remove trailing spaces from each line
    text = text.split('\n').map(line => line.trimEnd()).join('\n');

    // Remove excessive blank lines (again, in case they were introduced)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Fix spacing around bold text (remove extra spaces)
    text = text.replace(/\s+\*\*/g, ' **');
    text = text.replace(/\*\*\s+/g, '** ');

    // Fix spacing around punctuation
    text = text.replace(/\s+([.,;:!?])/g, '$1');
    text = text.replace(/([.,;:!?])([A-Za-zÀ-ÿ])/g, '$1 $2');

    // Fix double bold markers
    text = text.replace(/\*\*\s*\*\*/g, '');

    // Ensure text ends properly (no trailing newline needed for streaming)
    text = text.trim();

    return text;
  }

  /**
   * Count sections in text
   */
  private countSections(text: string): number {
    const mdHeaders = text.match(/^#{1,6}\s/gm) || [];
    const boldHeaders = text.match(/^\*\*[^*]+\*\*:/gm) || [];
    return mdHeaders.length + boldHeaders.length;
  }

  /**
   * Count bullets in text
   */
  private countBullets(text: string): number {
    const bullets = text.match(/^[•\-*]\s/gm) || [];
    const numbered = text.match(/^\d+\.\s/gm) || [];
    return bullets.length + numbered.length;
  }

  /**
   * Quick format for streaming - lighter weight
   * Only applies essential formatting during streaming
   */
  public quickFormat(chunk: string): string {
    // Just fix UTF-8 issues for streaming
    return this.normalizeText(chunk);
  }
}

// Export singleton instance
export const kodaOutputStructureEngine = new KodaOutputStructureEngine();

// Export class for testing
export { KodaOutputStructureEngine };
