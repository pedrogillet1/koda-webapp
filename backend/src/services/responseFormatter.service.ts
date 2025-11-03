/**
 * Response Formatter Service
 *
 * Generates format-specific system prompts for different query types
 * Based on ChatGPT Format Analysis
 *
 * CRITICAL: All formats use bullet points (•) and NO emoji
 */

import { ResponseFormatType } from './formatTypeClassifier.service';

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
   */
  async formatResponse(
    rawAnswer: string,
    context: ResponseContext,
    sources: any[],
    query?: string
  ): Promise<string> {
    let formatted = rawAnswer;

    // CRITICAL FIX 1: Remove all emojis (user requirement)
    if (this.hasEmojis(formatted)) {
      console.log(`📝 [ResponseFormatter] Removing emojis from response`);
      formatted = this.removeEmojis(formatted);
    }

    // CRITICAL FIX 2: Convert ASCII tables to Markdown tables
    if (this.hasASCIITable(formatted)) {
      console.log(`📝 [ResponseFormatter] Converting ASCII table to Markdown`);
      formatted = this.convertASCIITableToMarkdown(formatted);
    }

    // CRITICAL FIX 3: Detect and convert plain text "tables" (text with multiple spaces)
    if (this.hasPlainTextTable(formatted)) {
      console.log(`📝 [ResponseFormatter] Converting plain text table to Markdown`);
      formatted = this.convertPlainTextTableToMarkdown(formatted);
    }

    // CRITICAL FIX 4: Detect and fix list line breaks
    const bulletCount = (formatted.match(/•/g) || []).length;

    if (bulletCount >= 2) {
      // This is a list - fix line breaks
      console.log(`📝 [ResponseFormatter] Detected list with ${bulletCount} bullets - fixing line breaks`);
      formatted = this.fixListLineBreaks(formatted);
    }

    // CRITICAL FIX 5: Remove text after "Next actions:" section
    if (formatted.includes('Next actions:')) {
      console.log(`📝 [ResponseFormatter] Removing text after "Next actions:" section`);
      formatted = this.removeTextAfterNextActions(formatted);
    }

    // CRITICAL FIX 6: Remove paragraphs after bullet points (user requirement)
    if (bulletCount >= 2) {
      console.log(`📝 [ResponseFormatter] Removing paragraphs after bullet points`);
      formatted = this.removeParagraphsAfterBullets(formatted);
    }

    // CRITICAL FIX 7: Enforce max 2-line intro (user requirement)
    if (bulletCount >= 2) {
      console.log(`📝 [ResponseFormatter] Enforcing max 2-line intro`);
      formatted = this.enforceMaxTwoLineIntro(formatted);
    }

    // CRITICAL FIX 8: Clean up excessive whitespace (final polish)
    formatted = this.cleanWhitespace(formatted);

    return formatted;
  }

  /**
   * Fix line breaks in AI-generated lists
   * Handles cases where AI puts multiple bullets on one line
   *
   * Why this is needed: LLMs sometimes ignore formatting instructions.
   * Gemini may generate "• Item1 • Item2 • Item3" even when told to use line breaks.
   * This post-processor fixes the output regardless of what the AI generates.
   */
  fixListLineBreaks(text: string): string {
    // Pattern 1: "• Item1 • Item2 • Item3" → "• Item1\n• Item2\n• Item3"
    let fixed = text.replace(/ • /g, '\n• ');

    // Pattern 2: "•Item1 •Item2" (no space after bullet) → "•Item1\n•Item2"
    fixed = fixed.replace(/ •/g, '\n•');

    // Pattern 3: Multiple spaces before bullets
    fixed = fixed.replace(/  +•/g, '\n•');

    // Pattern 4: Ensure no double newlines before bullets
    fixed = fixed.replace(/\n\n+•/g, '\n•');

    // Pattern 5: Ensure bullets start on new lines (except first one)
    // "Text content • Item" → "Text content\n• Item"
    fixed = fixed.replace(/([^\n])( •)/g, '$1\n•');

    // Pattern 6: Fix bullets at start of line with extra space
    fixed = fixed.replace(/\n +•/g, '\n•');

    return fixed;
  }

  /**
   * Remove any text that appears after the "Next actions:" section
   *
   * Problem: AI sometimes adds extra commentary after the bullet points
   * Example:
   *   Next actions:
   *   • Action 1
   *   • Action 2
   *
   *   This is extra text we want to remove.
   *
   * Solution: Find "Next actions:", keep bullets, remove everything after
   */
  removeTextAfterNextActions(text: string): string {
    // Find the "Next actions:" section
    const nextActionsIndex = text.indexOf('Next actions:');
    if (nextActionsIndex === -1) {
      return text; // No "Next actions:" found
    }

    // Get text after "Next actions:"
    const afterNextActions = text.substring(nextActionsIndex);

    // Find all bullet points after "Next actions:"
    const bulletMatches = afterNextActions.match(/•[^\n]+/g);

    if (!bulletMatches || bulletMatches.length === 0) {
      return text; // No bullets found, return as is
    }

    // Find the position of the last bullet point
    const lastBullet = bulletMatches[bulletMatches.length - 1];
    const lastBulletIndex = afterNextActions.lastIndexOf(lastBullet);
    const endOfLastBullet = lastBulletIndex + lastBullet.length;

    // Construct final text: everything before "Next actions:" + "Next actions:" + bullets only
    const beforeNextActions = text.substring(0, nextActionsIndex);
    const nextActionsSection = afterNextActions.substring(0, endOfLastBullet);

    return beforeNextActions + nextActionsSection;
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
      const rows = bodyLines.trim().split('\n').filter(line => line.trim());
      const markdownRows = rows.map(row => {
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
   */
  hasEmojis(text: string): boolean {
    // Common emoji patterns
    const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}\u{2300}-\u{23FF}\u{2B50}\u{2705}\u{274C}\u{1F004}\u{1F170}-\u{1F251}]/u;
    return emojiPattern.test(text);
  }

  /**
   * Remove all emojis from text
   *
   * User requirement: NO emojis in responses (✅ ❌ 🔍 📁 📊 📄 🎯 ⚠️ etc.)
   */
  removeEmojis(text: string): string {
    // Comprehensive emoji removal pattern
    const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}\u{2300}-\u{23FF}\u{2B50}\u{2705}\u{274C}\u{1F004}\u{1F170}-\u{1F251}]/gu;

    // Remove emojis and clean up any extra spaces left behind
    let cleaned = text.replace(emojiPattern, '');

    // Clean up multiple spaces left by emoji removal
    cleaned = cleaned.replace(/\s{2,}/g, ' ');

    // Clean up space at start of lines
    cleaned = cleaned.replace(/^\s+/gm, '');

    return cleaned;
  }

  /**
   * Remove paragraphs that come after bullet points
   *
   * User requirement: "THERE SHOULD NOT BE ANY TYPE OF PARAGRAPH EXPLANATION"
   * Once bullets end, the response should STOP (except for "Next actions:" section)
   *
   * Examples to remove:
   * • Bullet 1
   * • Bullet 2
   *
   * This is an extra paragraph that should be removed.
   *
   * Another paragraph that should also be removed.
   */
  removeParagraphsAfterBullets(text: string): string {
    // Strategy:
    // 1. Find the last bullet point
    // 2. Check if there's a "Next actions:" section
    // 3. Remove any text between last bullet and "Next actions:" (or end of text)

    // Find all bullet points
    const bulletMatches = text.match(/•[^\n]+/g);

    if (!bulletMatches || bulletMatches.length === 0) {
      return text; // No bullets, return as-is
    }

    // Find the position of the last bullet
    const lastBullet = bulletMatches[bulletMatches.length - 1];
    const lastBulletIndex = text.lastIndexOf(lastBullet);
    const endOfLastBullet = lastBulletIndex + lastBullet.length;

    // Check if there's a "Next actions:" section
    const nextActionsIndex = text.indexOf('Next actions:', endOfLastBullet);

    if (nextActionsIndex !== -1) {
      // There's a "Next actions:" section
      // Remove text between last bullet and "Next actions:"
      const beforeBullets = text.substring(0, endOfLastBullet);
      const nextActionsSection = text.substring(nextActionsIndex);

      // Check if there's significant text between last bullet and "Next actions:"
      const textBetween = text.substring(endOfLastBullet, nextActionsIndex).trim();

      if (textBetween.length > 0) {
        // There's unwanted text - remove it
        console.log(`📝 [ResponseFormatter] Removing ${textBetween.length} chars between bullets and "Next actions:"`);
        return beforeBullets + '\n\n' + nextActionsSection;
      }

      return text; // No unwanted text
    } else {
      // No "Next actions:" section
      // Remove any text after last bullet
      const afterLastBullet = text.substring(endOfLastBullet).trim();

      // Check if there's significant text after last bullet (ignoring whitespace)
      if (afterLastBullet.length > 0) {
        console.log(`📝 [ResponseFormatter] Removing ${afterLastBullet.length} chars after last bullet`);
        return text.substring(0, endOfLastBullet);
      }

      return text; // No unwanted text
    }
  }

  /**
   * Enforce max 2-line intro before bullets
   *
   * User requirement: "the intro to the answer but it needs to have max 2 lines"
   *
   * Strategy:
   * 1. Find first bullet point
   * 2. Get text before first bullet (intro)
   * 3. If intro is more than 2 lines, truncate to 2 lines
   */
  enforceMaxTwoLineIntro(text: string): string {
    // Find first bullet point
    const firstBulletMatch = text.match(/•/);

    if (!firstBulletMatch) {
      return text; // No bullets, return as-is
    }

    const firstBulletIndex = text.indexOf('•');
    const intro = text.substring(0, firstBulletIndex).trim();
    const bulletsAndRest = text.substring(firstBulletIndex);

    // Split intro into lines
    const introLines = intro.split('\n').filter(line => line.trim().length > 0);

    // If intro is more than 2 lines, keep only first 2
    if (introLines.length > 2) {
      console.log(`📝 [ResponseFormatter] Truncating intro from ${introLines.length} lines to 2 lines`);
      const truncatedIntro = introLines.slice(0, 2).join('\n');
      return truncatedIntro + '\n\n' + bulletsAndRest;
    }

    return text; // Intro is already 2 lines or less
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
   * Type 3: Document List Format
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
   * Clean up excessive whitespace (final polish)
   *
   * Removes:
   * - More than 2 consecutive newlines
   * - Trailing whitespace from lines
   * - Leading/trailing whitespace from entire text
   */
  cleanWhitespace(text: string): string {
    // Remove more than 2 consecutive newlines
    let cleaned = text.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from lines
    cleaned = cleaned.split('\n').map(line => line.trimEnd()).join('\n');

    // Remove leading/trailing whitespace from entire text
    return cleaned.trim();
  }
}

export default new ResponseFormatterService();

