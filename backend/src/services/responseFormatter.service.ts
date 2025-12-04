/**
 * Response Formatter Service
 *
 * Generates format-specific system prompts for different query types
 * Based on ChatGPT Format Analysis
 *
 * CRITICAL: All formats use bullet points (•) and NO emoji
 */

import { ResponseFormatType } from './formatTypeClassifier.service';
import formatEnforcement from './formatEnforcement.service';

interface ResponseContext {
  queryLength: number;
  documentCount: number;
  intentType: string;
  chunks: any[];
  hasFinancialData: boolean;
  hasMultipleSheets?: boolean;
  hasSlides?: boolean;
}

export class ResponseFormatterService {

  /**
   * Main entry point - Format KODA response with post-processing
   * CRITICAL FIX: Gemini ignores line break instructions, so we fix output after generation
   *
   * NOTE: Many formatting rules are now delegated to FormatEnforcementService
   * This service handles additional pre-processing like table conversion
   */
  async formatResponse(
    rawAnswer: string,
    context: ResponseContext,
    sources: any[],
    query?: string
  ): Promise<string> {
    let formatted = rawAnswer;

    // PRE-PROCESSING: Convert special formats before main format enforcement

    // Convert ASCII tables to Markdown tables (must happen before format enforcement)
    if (this.hasASCIITable(formatted)) {
      console.log(`[ResponseFormatter] Converting ASCII table to Markdown`);
      formatted = this.convertASCIITableToMarkdown(formatted);
    }

    // Convert plain text "tables" (text with multiple spaces) to Markdown
    if (this.hasPlainTextTable(formatted)) {
      console.log(`[ResponseFormatter] Converting plain text table to Markdown`);
      formatted = this.convertPlainTextTableToMarkdown(formatted);
    }

    // Format comparison responses (remove duplicate sections)
    formatted = this.formatComparison(formatted);

    // Fix inline markdown headings (## without line breaks)
    formatted = this.fixInlineMarkdownHeadings(formatted);

    // Enforce 2-3 sentence paragraphs with blank lines
    // (skips bullets, tables, headings internally)
    console.log(`[ResponseFormatter] Enforcing 2-3 sentence paragraph breaks`);
    formatted = this.enforceStrictParagraphBreaks(formatted);

    // MAIN FORMAT ENFORCEMENT: Apply all 12 rules from FormatEnforcementService
    // This handles: emojis, bullets, citations, bold, whitespace, etc.
    console.log(`[ResponseFormatter] Applying comprehensive format enforcement (12 rules)`);
    const enforcementResult = formatEnforcement.enforceFormat(formatted);

    if (!enforcementResult.isValid) {
      const errorCount = enforcementResult.violations.filter(v => v.severity === 'error').length;
      const warningCount = enforcementResult.violations.filter(v => v.severity === 'warning').length;
      console.log(`[ResponseFormatter] Found ${errorCount} errors, ${warningCount} warnings`);

      // Log each violation for debugging
      enforcementResult.violations.forEach(v => {
        console.log(`  ${v.severity.toUpperCase()}: ${v.type} - ${v.message}`);
      });
    }

    formatted = enforcementResult.fixedText || formatted;

    // AUTO-BOLDING: Bold important elements (numbers, dates, filenames)
    // This runs AFTER format enforcement to avoid conflicts with other bolding rules
    console.log(`[ResponseFormatter] Applying auto-bolding for numbers, dates, filenames`);
    formatted = this.autoBold(formatted);

    // Log final stats
    const stats = formatEnforcement.getStats(formatted);
    console.log(`[ResponseFormatter] Stats: ${stats.bulletCount} bullets, ${stats.introLineCount} intro lines, ${stats.boldCount} bold items, ${stats.wordCount} words`);

    return formatted;
  }

  /**
   * Fix line breaks in AI-generated lists
   * @deprecated Use formatEnforcement.fixBulletLineBreaks() instead
   */
  fixListLineBreaks(text: string): string {
    return formatEnforcement.fixBulletLineBreaks(text);
  }

  /**
   * Remove any text that appears after the "Next actions:" section
   * @deprecated Handled by formatEnforcement.removeParagraphsAfterBullets() and formatNextActionsSection()
   */
  removeTextAfterNextActions(text: string): string {
    // This is now handled by FormatEnforcementService
    return text;
  }

  /**
   * Detect if text contains ASCII table (with ────── characters)
   */
  hasASCIITable(text: string): boolean {
    return /────+/.test(text);
  }

  /**
   * Convert ASCII tables to Markdown tables
   * Handles tables like:
   *   Aspect          Column1         Column2
   *   ────────────────────────────────────────
   *   Row1            Data            Data
   */
  convertASCIITableToMarkdown(text: string): string {
    // Pattern to match ASCII tables
    const asciiTablePattern = /(.*?)\n[─\-]+\n((?:.*\n?)*?)(?=\n\n|$)/g;

    return text.replace(asciiTablePattern, (match, headerLine, bodyLines) => {
      // Split header into columns (by multiple spaces)
      const headers = headerLine.trim().split(/\s{2,}/);

      if (headers.length < 2) {
        return match; // Not a valid table, return as-is
      }

      // Build Markdown header
      const markdownHeader = '| ' + headers.join(' | ') + ' |';
      const markdownSeparator = '|' + headers.map(() => '---').join('|') + '|';

      // Process body rows
      const rows = bodyLines.trim().split('\n').filter((line: string) => line.trim());
      const markdownRows = rows.map((row: string) => {
        const cols = row.trim().split(/\s{2,}/);
        return '| ' + cols.join(' | ') + ' |';
      });

      return [markdownHeader, markdownSeparator, ...markdownRows].join('\n');
    });
  }

  /**
   * Detect if text contains plain text table (columns separated by multiple spaces)
   * Example:
   *   Aspect    English Version    Portuguese Version
   *   Language    English    Portuguese (Brazilian)
   */
  hasPlainTextTable(text: string): boolean {
    // Look for lines with multiple columns separated by 2+ spaces
    // Must have at least 2 consecutive lines with same pattern
    const lines = text.split('\n');
    let consecutiveTableLines = 0;

    for (const line of lines) {
      // Check if line has 2+ columns separated by multiple spaces
      const columns = line.trim().split(/\s{2,}/);
      if (columns.length >= 2 && line.includes('  ')) {
        consecutiveTableLines++;
        if (consecutiveTableLines >= 2) {
          return true;
        }
      } else {
        consecutiveTableLines = 0; // Reset if not a table line
      }
    }

    return false;
  }

  /**
   * Convert plain text tables to Markdown tables
   * Handles tables like:
   *   Aspect    English Version    Portuguese Version
   *   Language    English    Portuguese (Brazilian)
   *   Focus    Technical    Business
   */
  convertPlainTextTableToMarkdown(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    const tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const columns = line.trim().split(/\s{2,}/);

      // If this looks like a table row (2+ columns with multiple spaces)
      if (columns.length >= 2 && line.includes('  ')) {
        tableLines.push(line);
      } else {
        // Not a table line - flush accumulated table lines
        if (tableLines.length >= 2) {
          // Convert accumulated table lines to Markdown
          const markdownTable = this.convertPlainTextLinesToMarkdown(tableLines);
          result.push(markdownTable);
          tableLines.length = 0; // Clear
        } else if (tableLines.length > 0) {
          // Only 1 line - not a table, add as-is
          result.push(...tableLines);
          tableLines.length = 0;
        }
        result.push(line);
      }
    }

    // Flush remaining table lines
    if (tableLines.length >= 2) {
      const markdownTable = this.convertPlainTextLinesToMarkdown(tableLines);
      result.push(markdownTable);
    } else if (tableLines.length > 0) {
      result.push(...tableLines);
    }

    return result.join('\n');
  }

  /**
   * Helper: Convert array of plain text table lines to Markdown table
   */
  private convertPlainTextLinesToMarkdown(lines: string[]): string {
    // Parse all lines into columns
    const rows = lines.map(line => line.trim().split(/\s{2,}/));

    // First row is header
    const headers = rows[0];
    const markdownHeader = '| ' + headers.join(' | ') + ' |';
    const markdownSeparator = '| ' + headers.map(() => '---').join(' | ') + ' |';

    // Rest are data rows
    const markdownRows = rows.slice(1).map(cols => {
      return '| ' + cols.join(' | ') + ' |';
    });

    return [markdownHeader, markdownSeparator, ...markdownRows].join('\n');
  }

  /**
   * Detect if text contains emojis
   * @deprecated Use formatEnforcement.hasEmojis() instead
   */
  hasEmojis(text: string): boolean {
    return formatEnforcement.hasEmojis(text);
  }

  /**
   * Remove all emojis from text
   * @deprecated Use formatEnforcement.removeEmojis() instead
   */
  removeEmojis(text: string): string {
    return formatEnforcement.removeEmojis(text);
  }

  /**
   * Remove paragraphs that come after bullet points
   * @deprecated Use formatEnforcement.removeParagraphsAfterBullets() instead
   */
  removeParagraphsAfterBullets(text: string): string {
    return formatEnforcement.removeParagraphsAfterBullets(text);
  }

  /**
   * Enforce bullet point format
   * Converts paragraphs to bullets when appropriate
   */
  enforceBulletFormat(text: string): string {
    // If response has no bullets but has multiple sentences, convert to bullets
    if (!text.includes('•') && text.includes('.')) {
      const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 10);

      if (sentences.length >= 3) {
        // Convert to bullet format
        const intro = sentences[0] + '.';
        const bullets = sentences.slice(1).map(s => `• ${s.trim()}`).join('\n');
        return `${intro}\n\n${bullets}`;
      }
    }

    return text;
  }

  /**
   * Enforce max 2-line intro before bullets
   * @deprecated Use formatEnforcement.enforceMaxTwoLineIntro() instead
   */
  enforceMaxTwoLineIntro(text: string): string {
    return formatEnforcement.enforceMaxTwoLineIntro(text);
  }

  /**
   * Build format-specific system prompt
   */
  buildFormatPrompt(formatType: ResponseFormatType): string {
    switch (formatType) {
      case ResponseFormatType.FEATURE_LIST:
        return this.buildFeatureListPrompt();
      case ResponseFormatType.STRUCTURED_LIST:
        return this.buildStructuredListPrompt();
      case ResponseFormatType.DOCUMENT_LIST:
        return this.buildDocumentListPrompt();
      case ResponseFormatType.TABLE:
        return this.buildTablePrompt();
      case ResponseFormatType.DIRECT_ANSWER:
        return this.buildDirectAnswerPrompt();
      case ResponseFormatType.SIMPLE_LIST:
        return this.buildSimpleListPrompt();
      default:
        return this.buildFeatureListPrompt(); // Default
    }
  }

  /**
   * Type 1: Feature List Format
   * For comprehensive overview queries like "What does the business plan say?"
   */
  private buildFeatureListPrompt(): string {
    return `FORMAT TYPE: FEATURE LIST

NOTE: Do NOT include "Referenced Documents:" in your response. The UI automatically displays document sources.

STRUCTURE:
[Opening statement with key insight]

• [Feature/point 1 with specific details]
• [Feature/point 2 with specific details]
• [Feature/point 3 with specific details]
• [Additional points as needed]

[Closing statement without emoji]

RULES:
• Use bullet points (•) for all list items
• NO emoji anywhere in the response
• Start directly with opening statement (NO "Referenced Documents:" line)
• Opening statement provides context
• Each bullet point is specific and detailed
• Empty line before closing statement (\n\n)
• Closing statement summarizes without emoji

EXAMPLE:
The business plan projects aggressive revenue growth over three years, scaling from initial market entry to enterprise dominance.

• Year 1 targets 280 users generating $670,800 in revenue
• Year 2 projects 995 users with $2,395,000 in revenue (257% YoY growth)
• Year 3 forecasts 2,600 users producing $6,240,000 in revenue (161% YoY growth)
• Gross margins improve from 65% to 78% by Year 3
• Break-even projected at Month 18 with 450 users

These projections are based on a tiered pricing model and 95% retention rate.`;
  }

  /**
   * Type 2: Structured List Format
   * For specific attribute queries like "What features does KODA have?"
   */
  private buildStructuredListPrompt(): string {
    return `FORMAT TYPE: STRUCTURED LIST

NOTE: Do NOT include "Referenced Documents:" in your response. The UI automatically displays document sources.

STRUCTURE:
[Brief introduction]

• [Item 1] — [Description with details]
• [Item 2] — [Description with details]
• [Item 3] — [Description with details]
• [Additional items as needed]

[Closing statement without emoji]

RULES:
• Use bullet points (•) for all items
• Use em dash (—) not hyphen (-) to separate item from description
• NO emoji anywhere
• Start directly with brief introduction (NO "Referenced Documents:" line)
• Brief introduction sets context
• Each bullet has item name followed by em dash and description
• Empty line before closing statement (\n\n)
• Closing statement wraps up without emoji

EXAMPLE:
KODA offers comprehensive document intelligence capabilities designed for enterprise workflows.

• Semantic Search — Natural language queries to find relevant documents based on meaning, not just keywords
• Multi-Format Support — Processes PDFs, Word docs, Excel spreadsheets, PowerPoint presentations, and images with OCR
• Intelligent Extraction — Automatically extracts data like dates, amounts, names, and key metrics from documents
• Conversation Context — Maintains context across queries to enable follow-up questions and deeper exploration

These features enable efficient document management and knowledge retrieval.`;
  }

  /**
   * Type 3: documents List Format
   * For "Which documents mention X?" queries
   * NOTE: This is typically bypassed in favor of direct formatting in rag.service.ts
   */
  private buildDocumentListPrompt(): string {
    return `FORMAT TYPE: DOCUMENT LIST

STRUCTURE:
• [filename1.ext]
• [filename2.ext]
• [filename3.ext]

RULES:
• Use bullet points (•) only
• NO emoji
• NO introductory text
• NO closing statement
• NO file sizes or metadata
• Just filenames with extensions
• One file per line
• Use line breaks (\n) between bullets

EXAMPLE:
• Montana-Rocking-CC-Sanctuary.pdf
• Lone Mountain Ranch P&L 2025.xlsx
• Koda Business Plan V12.pdf`;
  }

  /**
   * Type 4: Table Format
   * For comparison queries like "Compare X and Y"
   */
  private buildTablePrompt(): string {
    return `FORMAT TYPE: ADAPTIVE COMPARISON

Choose format based on complexity:
• Simple (2-3 differences) → Bullet groupings
• Complex (4+ aspects) → Markdown table

BULLET FORMAT:
[1 sentence intro]

Category 1:
• Item — Key characteristic
• Item — Key characteristic

[1 sentence closing]

TABLE FORMAT:
[1 sentence intro]

| Aspect | Doc A | Doc B |
| --- | --- | --- |
| Aspect 1 | Value | Value |
| Aspect 2 | Value | Value |

[1 sentence closing]

RULES:
• NO emoji
• NO "Referenced Documents:" line
• Keep introductions to 1 sentence maximum`;
  }

  /**
   * Type 5: Direct Answer Format
   * For factual queries like "What is the expiration date?"
   */
  private buildDirectAnswerPrompt(): string {
    return `FORMAT TYPE: DIRECT ANSWER

NOTE: Do NOT include "Referenced Documents:" in your response. The UI automatically displays document sources.

STRUCTURE:
Document: [filename]
[Direct answer to the question - start immediately, no labels]

• [Supporting detail 1]
• [Supporting detail 2]
• [Supporting detail 3]

RULES:
• Start with "Document: **[filename]**" on first line (bold the filename)
• Direct answer comes immediately on next line (NO "Answer:" label)
• Direct answer should be a complete sentence stating the fact
• Supporting details use bullet points (•)
• NO emoji anywhere
• Keep answer concise (1-2 sentences max)
• 2-4 bullet points with supporting details
• For Excel data: Include cell references and sheet names, but NEVER list other cells in the row/column
• NO closing statement for factual queries

EXAMPLE (PDF):
Document: **Passport.pdf**
The expiration date is **March 15, 2025**.

• Found on page 2
• Issued on March 16, 2015 in Lisbon
• Valid for 10 years from issue date

EXAMPLE (Excel):
Document: **Financial Report Q1.xlsx**
The total revenue for January 2025 is **$1,245,000**.

• This is a 12.5% increase from December 2024
• Formula used: =SUM(B2:B4)

EXAMPLE (Cell Value):
Document: **Lista_9 (1) (1) (1).xlsx**
The value of cell B3 in Sheet 1 'ex1' is **32**.`;
  }

  /**
   * Type 6: Simple List Format
   * For entity extraction like "List all categories"
   */
  private buildSimpleListPrompt(): string {
    return `FORMAT TYPE: SIMPLE LIST

STRUCTURE:
• [Item 1]
• [Item 2]
• [Item 3]
• [Item 4]

RULES:
• Use bullet points (•) only
• NO emoji
• NO introductory text
• NO closing statement
• NO descriptions (just the item name)
• One item per line
• Use line breaks (\n) between bullets

EXAMPLE:
• Business
• Technical
• Financial
• Legal
• Personal`;
  }

  /**
   * Detect if response is a comparison
   */
  private isComparison(text: string): boolean {
    const comparisonKeywords = [
      'compare', 'comparison', 'differ', 'difference',
      'versus', 'vs', 'between', 'contrast'
    ];

    const lowerText = text.toLowerCase();
    return comparisonKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Format comparison responses into clean tables
   * ✅ FIX: Remove repetitive sections like duplicate "Main Findings", "Key Insights"
   */
  private formatComparison(text: string): string {
    // Check if it's a comparison
    if (!this.isComparison(text)) {
      return text;
    }

    console.log(`📊 [COMPARISON] Formatting comparison response`);

    let formatted = text;

    // Remove duplicate "Main Findings" sections
    const mainFindingsMatches = Array.from(text.matchAll(/Main Findings:[\s\S]*?(?=\n\n|$)/gi));
    if (mainFindingsMatches.length > 1) {
      // Keep only the first occurrence, remove the rest
      for (let i = 1; i < mainFindingsMatches.length; i++) {
        formatted = formatted.replace(mainFindingsMatches[i][0], '');
      }
    }

    // Remove duplicate "Patterns Identified" sections
    const patternsMatches = Array.from(text.matchAll(/Patterns Identified:[\s\S]*?(?=\n\n|$)/gi));
    if (patternsMatches.length > 1) {
      for (let i = 1; i < patternsMatches.length; i++) {
        formatted = formatted.replace(patternsMatches[i][0], '');
      }
    }

    // Remove duplicate "Key Insights" sections
    const insightsMatches = Array.from(text.matchAll(/Key Insights:[\s\S]*?(?=\n\n|$)/gi));
    if (insightsMatches.length > 1) {
      for (let i = 1; i < insightsMatches.length; i++) {
        formatted = formatted.replace(insightsMatches[i][0], '');
      }
    }

    // Remove "Source Attribution" section (redundant with sources list)
    formatted = formatted.replace(/Source Attribution:[\s\S]*?(?=\n\n|$)/gi, '');

    // Remove "Answer to the User Question" section (redundant)
    formatted = formatted.replace(/Answer to the User Question:[\s\S]*?(?=\n\n|$)/gi, '');

    // Clean up excessive whitespace
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    console.log(`✅ [COMPARISON] Formatted comparison (${text.length} → ${formatted.length} chars)`);

    return formatted.trim();
  }

  /**
   * Fix inline markdown headings that appear without line breaks
   *
   * Problem: AI generates "text ## Heading more text" instead of proper headings
   * Solution: Insert line breaks before and after ## headings
   *
   * Example:
   * Before: "some text. ## Understanding MoIC is a key metric"
   * After:  "some text.\n\n## Understanding MoIC\n\nis a key metric"
   */
  fixInlineMarkdownHeadings(text: string): string {
    let fixed = text;

    // Pattern: text followed by ## (inline heading without newline before)
    // Add double newline before ##
    fixed = fixed.replace(/([^\n])(\s*)(#{1,6}\s)/g, '$1\n\n$3');

    // Pattern: ## heading text followed by more text without newline
    // This is tricky - we need to find where the heading ends
    // Headings typically end at the next sentence or after a few words
    // For now, let's ensure there's a newline after short heading-like phrases

    // Match ## followed by 2-6 words, then ensure newline
    fixed = fixed.replace(/(#{1,6}\s+[A-Z][^\n.!?]{10,60})([.!?]?\s+)(?=[A-Z])/g, '$1\n\n');

    return fixed;
  }

  /**
   * Enforce STRICT paragraph breaks - max 2-3 sentences per paragraph
   * Matches user's example spacing exactly
   *
   * Rules:
   * 1. Break after 2-3 sentences
   * 2. Add blank line (\n\n) between paragraphs
   * 3. Don't break inside bullets, tables, or headings
   * 4. Preserve existing breaks
   */
  enforceStrictParagraphBreaks(text: string): string {
    // Split by existing double newlines (preserve existing structure)
    const blocks = text.split('\n\n');
    const result: string[] = [];

    console.log(`📝 [ParagraphBreak] Processing ${blocks.length} blocks`);

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];

      // Skip if this is a bullet list, table, heading, or short block
      if (
        block.trim().startsWith('•') ||
        block.trim().startsWith('|') ||
        block.trim().startsWith('#') ||
        block.trim().startsWith('-') ||
        block.trim().startsWith('*') ||
        block.trim().startsWith('**') ||
        block.length < 50 // Very short blocks don't need breaking
      ) {
        console.log(`📝 [ParagraphBreak] Block ${blockIndex}: SKIPPED (special or short, ${block.length} chars)`);
        result.push(block);
        continue;
      }

      // This is a prose paragraph - split into sentences
      const sentences = this.splitIntoSentences(block);
      console.log(`📝 [ParagraphBreak] Block ${blockIndex}: ${sentences.length} sentences, ${block.length} chars`);

      if (sentences.length <= 3) {
        // Already 3 sentences or less - keep as-is
        result.push(block);
      } else {
        // Too long - break into chunks of 2-3 sentences
        console.log(`📝 [ParagraphBreak] Block ${blockIndex}: BREAKING into chunks (${sentences.length} sentences)`);
        const chunks: string[] = [];

        for (let i = 0; i < sentences.length; i += 2) {
          // Take 2-3 sentences per chunk
          const chunkSize = (i + 3 <= sentences.length) ? 2 : Math.min(3, sentences.length - i);
          const chunk = sentences.slice(i, i + chunkSize).join(' ');
          chunks.push(chunk.trim());
        }

        // Join chunks with blank lines
        result.push(chunks.join('\n\n'));
      }
    }

    console.log(`📝 [ParagraphBreak] Result: ${result.length} blocks`);
    return result.join('\n\n');
  }

  /**
   * Split text into sentences intelligently
   * Handles abbreviations, decimals, and edge cases
   */
  private splitIntoSentences(text: string): string[] {
    // Replace common abbreviations with placeholders
    let processed = text;
    const abbreviations = [
      'e.g.', 'i.e.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.',
      'Inc.', 'Ltd.', 'Co.', 'etc.', 'vs.', 'approx.', 'est.'
    ];

    const placeholders: Map<string, string> = new Map();
    abbreviations.forEach((abbr, index) => {
      const placeholder = `__ABBR${index}__`;
      placeholders.set(placeholder, abbr);
      const escapedAbbr = abbr.replace(/\./g, '\\.');
      processed = processed.replace(new RegExp(escapedAbbr, 'g'), placeholder);
    });

    // Protect decimal numbers (e.g., "3.14", "$1,234.56")
    processed = processed.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');

    // Split on sentence endings: . ! ? followed by space and capital letter OR end of string
    const sentenceRegex = /([.!?])\s+(?=[A-Z])|([.!?])$/g;
    const parts = processed.split(sentenceRegex).filter(part => part && part.trim().length > 0);

    // Reconstruct sentences
    const sentences: string[] = [];
    let currentSentence = '';

    for (const part of parts) {
      if (part === '.' || part === '!' || part === '?') {
        currentSentence += part;
        if (currentSentence.trim().length > 0) {
          sentences.push(currentSentence.trim());
        }
        currentSentence = '';
      } else {
        currentSentence += part;
      }
    }

    // Add remaining text as last sentence
    if (currentSentence.trim().length > 0) {
      sentences.push(currentSentence.trim());
    }

    // Restore abbreviations and decimals
    return sentences.map(sentence => {
      let restored = sentence;
      placeholders.forEach((abbr, placeholder) => {
        restored = restored.replace(new RegExp(placeholder, 'g'), abbr);
      });
      restored = restored.replace(/__DOT__/g, '.');
      return restored;
    });
  }

  /**
   * Clean up excessive whitespace (final polish)
   * @deprecated Use formatEnforcement.cleanWhitespace() instead
   */
  cleanWhitespace(text: string): string {
    return formatEnforcement.cleanWhitespace(text);
  }

  // ============================================================================
  // AUTO-BOLDING SYSTEM
  // ============================================================================
  // PURPOSE: Automatically bold important elements for better readability
  // IMPACT: +10% format score in stress tests
  // TARGETS: Numbers, currency, percentages, dates, filenames

  /**
   * Auto-bold important elements in the response
   * Bolds: numbers, currency, percentages, dates, filenames
   *
   * @param answer - The response text to process
   * @returns Text with important elements bolded
   */
  autoBold(answer: string): string {
    // Skip if answer is empty or very short
    if (!answer || answer.length < 10) {
      return answer;
    }

    let result = answer;

    // Track what we're bolding for logging
    let boldedCount = 0;

    // Helper function to protect already-bolded content with placeholders
    const boldPlaceholders: Map<string, string> = new Map();
    let placeholderIndex = 0;

    const protectBoldContent = () => {
      result = result.replace(/\*\*([^*]+)\*\*/g, (match) => {
        const placeholder = `__BOLD_PLACEHOLDER_${placeholderIndex++}__`;
        boldPlaceholders.set(placeholder, match);
        return placeholder;
      });
    };

    // ════════════════════════════════════════════════════════════════════════
    // STEP 1: Protect already-bolded content
    // ════════════════════════════════════════════════════════════════════════
    protectBoldContent();

    // ════════════════════════════════════════════════════════════════════════
    // STEP 2: Protect markdown table cells and headers
    // ════════════════════════════════════════════════════════════════════════
    // Don't bold inside table cells as it can break formatting
    const tableLines: Set<number> = new Set();
    const lines = result.split('\n');
    lines.forEach((line, index) => {
      if (line.trim().startsWith('|') || line.trim().match(/^\|[-:]+\|/)) {
        tableLines.add(index);
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    // STEP 3: Bold currency amounts (e.g., $1,234.56, €500, R$1.000,00)
    // ════════════════════════════════════════════════════════════════════════
    // Matches: $1,234.56, €500, £1,000, R$1.000,00, US$5,000
    // Fixed: Properly handles comma-separated thousands (e.g., $1,234,567.89)
    const currencyPattern = /(?<!\*\*)(?:(?:US|R|AU|CA|NZ|HK|SG)?\$|€|£|¥|₹|R\$)\s*\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{1,2})?(?:k|K|m|M|bn|BN)?(?!\*\*)/g;
    result = result.replace(currencyPattern, (match) => {
      boldedCount++;
      return `**${match.trim()}**`;
    });

    // Re-protect newly bolded content before next pattern
    protectBoldContent();

    // ════════════════════════════════════════════════════════════════════════
    // STEP 4: Bold percentages (e.g., 25%, 3.5%, -10%)
    // ════════════════════════════════════════════════════════════════════════
    // Matches: 25%, 3.5%, -10%, +15.5%
    const percentagePattern = /(?<!\*\*)(?<![.\d])[-+]?\d+(?:[.,]\d+)?%(?!\*\*)/g;
    result = result.replace(percentagePattern, (match) => {
      boldedCount++;
      return `**${match}**`;
    });

    // Re-protect before number matching
    protectBoldContent();

    // ════════════════════════════════════════════════════════════════════════
    // STEP 5: Bold significant standalone numbers (not already in currency/percentage)
    // ════════════════════════════════════════════════════════════════════════
    // Matches: 1,234, 5.5, 1000 (but not years like 2024 unless clearly a value)
    // Only bold numbers that appear to be metrics/values (followed by units or in context)
    const significantNumberPattern = /(?<!\*\*)(?<![.\d$€£¥₹])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)(?:\s*(?:users?|items?|documents?|files?|pages?|months?|years?|days?|hours?|minutes?|seconds?|units?|pieces?|points?|stars?|ratings?|reviews?|downloads?|installs?|views?|clicks?|conversions?|leads?|sales?|orders?|customers?|clients?|employees?|members?|subscribers?|followers?|connections?|shares?|likes?|comments?|posts?|articles?|chapters?|sections?|paragraphs?|words?|characters?|bytes?|KB|MB|GB|TB|px|em|rem|pts?|mm|cm|m|km|mi|ft|in|oz|lb|kg|g|mg|ml|L|gal))?(?!\*\*)/gi;
    result = result.replace(significantNumberPattern, (match, number) => {
      // Skip if it looks like a year (1900-2099) without context
      if (/^(19|20)\d{2}$/.test(number) && !match.includes(' ')) {
        return match;
      }
      boldedCount++;
      return `**${match.trim()}**`;
    });

    // Re-protect before date matching
    protectBoldContent();

    // ════════════════════════════════════════════════════════════════════════
    // STEP 6: Bold dates - Multiple formats
    // ════════════════════════════════════════════════════════════════════════

    // Format: MM/DD/YYYY or DD/MM/YYYY (e.g., 12/31/2024, 31/12/2024)
    const slashDatePattern = /(?<!\*\*)(?<!\d)\d{1,2}\/\d{1,2}\/\d{2,4}(?!\*\*)/g;
    result = result.replace(slashDatePattern, (match) => {
      boldedCount++;
      return `**${match}**`;
    });

    // Format: YYYY-MM-DD (ISO format, e.g., 2024-12-31)
    const isoDatePattern = /(?<!\*\*)\d{4}-\d{2}-\d{2}(?!\*\*)/g;
    result = result.replace(isoDatePattern, (match) => {
      boldedCount++;
      return `**${match}**`;
    });

    // Format: Month DD, YYYY or Month DD YYYY (English)
    const englishMonths = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
    const englishDatePattern = new RegExp(`(?<!\\*\\*)((?:${englishMonths})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})(?!\\*\\*)`, 'gi');
    result = result.replace(englishDatePattern, (match) => {
      boldedCount++;
      return `**${match.trim()}**`;
    });

    // Format: DD Month YYYY (e.g., 31 December 2024)
    const englishDatePattern2 = new RegExp(`(?<!\\*\\*)(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${englishMonths})\\.?,?\\s+\\d{4})(?!\\*\\*)`, 'gi');
    result = result.replace(englishDatePattern2, (match) => {
      boldedCount++;
      return `**${match.trim()}**`;
    });

    // Format: Portuguese dates (e.g., 31 de dezembro de 2024, dezembro de 2024)
    const portugueseMonths = 'janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
    const portugueseDatePattern = new RegExp(`(?<!\\*\\*)(\\d{1,2}\\s+de\\s+(?:${portugueseMonths})(?:\\s+de)?\\s+\\d{4})(?!\\*\\*)`, 'gi');
    result = result.replace(portugueseDatePattern, (match) => {
      boldedCount++;
      return `**${match.trim()}**`;
    });

    // Format: Spanish dates (e.g., 31 de diciembre de 2024, diciembre de 2024)
    const spanishMonths = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
    const spanishDatePattern = new RegExp(`(?<!\\*\\*)(\\d{1,2}\\s+de\\s+(?:${spanishMonths})(?:\\s+de)?\\s+\\d{4})(?!\\*\\*)`, 'gi');
    result = result.replace(spanishDatePattern, (match) => {
      boldedCount++;
      return `**${match.trim()}**`;
    });

    // Re-protect before filename matching
    protectBoldContent();

    // ════════════════════════════════════════════════════════════════════════
    // STEP 7: Bold file names with common extensions
    // ════════════════════════════════════════════════════════════════════════
    // Matches: document.pdf, report.xlsx, presentation.pptx, etc.
    // Fixed: Requires word boundary before filename to prevent matching preceding words
    const fileExtensions = 'pdf|xlsx|xls|docx|doc|txt|csv|pptx|ppt|png|jpg|jpeg|gif|svg|mp4|mp3|wav|zip|rar|json|xml|html|css|js|ts|py|java|rb|go|rs|sql|md';
    const filenamePattern = new RegExp(`(?<!\\*\\*)\\b([A-Za-z0-9][A-Za-z0-9_\\-()\\[\\]]*\\.(?:${fileExtensions}))(?!\\*\\*)`, 'gi');
    result = result.replace(filenamePattern, (match) => {
      // Skip if it's inside a URL or path
      if (match.includes('/') || match.includes('\\')) {
        return match;
      }
      boldedCount++;
      return `**${match.trim()}**`;
    });

    // ════════════════════════════════════════════════════════════════════════
    // STEP 8: Restore protected bold content
    // ════════════════════════════════════════════════════════════════════════
    boldPlaceholders.forEach((original, placeholder) => {
      result = result.replace(placeholder, original);
    });

    // ════════════════════════════════════════════════════════════════════════
    // STEP 9: Clean up any double-bolding that may have occurred
    // ════════════════════════════════════════════════════════════════════════
    // Fix cases like ****text**** -> **text**
    result = result.replace(/\*{4,}([^*]+)\*{4,}/g, '**$1**');

    // Fix cases like ** **text** ** -> **text**
    result = result.replace(/\*\*\s*\*\*([^*]+)\*\*\s*\*\*/g, '**$1**');

    // Log results
    if (boldedCount > 0) {
      console.log(`✨ [AUTO-BOLD] Bolded ${boldedCount} elements (numbers, dates, filenames)`);
    }

    return result;
  }
}

export default new ResponseFormatterService();

