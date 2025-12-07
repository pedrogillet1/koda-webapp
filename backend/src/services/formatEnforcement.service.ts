/**
 * Format Enforcement Service
 *
 * DEFINITIVE FORMAT RULES - Every bold, space, comma, structure
 *
 * PURPOSE: Enforce strict formatting rules on all Koda responses
 * WHY: User requires consistent, professional formatting across all responses
 * IMPACT: 100% compliance with format specifications
 *
 * RULES ENFORCED:
 * 1. ✅ No emojis (with extended Unicode 12.0+ support)
 * 1b. ✅ Normalize bullet styles (-, *, •, dashes to standard bullet)
 * 2. ✅ Bullet line breaks (each bullet on separate line)
 * 3. ✅ Max 2-3 items per bullet line (configurable)
 * 4. ✅ Max 2-line intro (configurable)
 * 5. ✅ No paragraphs after bullets
 * 6. ✅ Auto-bold key values (monetary, percentages, dates, filenames)
 * 7. ✅ No citations like "According to page X" (EN/PT/ES)
 * 8. ✅ Clean whitespace
 * 9. ✅ Remove empty bullet points
 * 10. ✅ Remove trailing periods from short bullets
 * 11. ✅ Format "Next actions:" section
 * 12. ✅ Structure validation
 */

export interface FormatViolation {
  type: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
}

export interface FormatValidationResult {
  isValid: boolean;
  violations: FormatViolation[];
  fixedText?: string;
}

/**
 * Configuration options for FormatEnforcementService
 * These can be overridden per-call or set as defaults
 */
export interface FormatEnforcementConfig {
  /** Maximum items per bullet line (default: 3) */
  maxItemsPerLine: number;
  /** Maximum intro lines before bullets (default: 2) */
  maxIntroLines: number;
  /** Enable emoji removal (default: true) */
  removeEmojis: boolean;
  /** Enable citation removal (default: true) */
  removeCitations: boolean;
  /** Enable auto-bold for key values (default: true) */
  autoBoldValues: boolean;
  /** Remove empty bullet points (default: true) */
  removeEmptyBullets: boolean;
  /** Remove trailing periods from short bullets (default: true) */
  removeTrailingPeriods: boolean;
  /** Normalize different bullet styles to standard bullet (default: true) */
  normalizeBulletStyles: boolean;
  /** Standard bullet character to use (default: '•') */
  standardBulletChar: string;
  /** Format "Next actions:" section (default: true) */
  formatNextActions: boolean;
  /** Enable logging (default: true) */
  enableLogging: boolean;
  /** Log verbosity: 'silent' | 'minimal' | 'verbose' */
  logVerbosity: 'silent' | 'minimal' | 'verbose';
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: FormatEnforcementConfig = {
  maxItemsPerLine: 3,
  maxIntroLines: 2,
  removeEmojis: true,
  removeCitations: true,
  autoBoldValues: true,
  removeEmptyBullets: true,
  removeTrailingPeriods: true,
  normalizeBulletStyles: true,
  standardBulletChar: '•',
  formatNextActions: true,
  enableLogging: true,
  logVerbosity: 'minimal'
};

export class FormatEnforcementService {
  private config: FormatEnforcementConfig;

  constructor(config?: Partial<FormatEnforcementConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration at runtime
   */
  setConfig(config: Partial<FormatEnforcementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): FormatEnforcementConfig {
    return { ...this.config };
  }

  /**
   * Log helper that respects verbosity settings
   */
  private log(message: string, level: 'minimal' | 'verbose' = 'minimal'): void {
    if (!this.config.enableLogging) return;
    if (this.config.logVerbosity === 'silent') return;
    if (this.config.logVerbosity === 'minimal' && level === 'verbose') return;
    console.log(message);
  }

  /**
   * MAIN ENTRY POINT: Validate and fix all format violations
   * @param text - The text to validate and fix
   * @param configOverride - Optional config overrides for this call only
   */
  enforceFormat(text: string, configOverride?: Partial<FormatEnforcementConfig>): FormatValidationResult {
    const config = configOverride ? { ...this.config, ...configOverride } : this.config;
    const violations: FormatViolation[] = [];
    let fixed = text;

    // RULE 1: Remove emojis (CRITICAL)
    if (config.removeEmojis && this.hasEmojis(fixed)) {
      violations.push({
        type: 'emoji',
        line: 0,
        severity: 'error',
        message: 'Response contains emojis',
        suggestion: 'Remove all emojis'
      });
      fixed = this.removeEmojis(fixed);
      this.log('[FormatEnforcement] Removed emojis', 'verbose');
    }

    // RULE 1b: Normalize bullet styles (BEFORE counting bullets)
    if (config.normalizeBulletStyles && this.hasNonStandardBullets(fixed)) {
      violations.push({
        type: 'bullet_style_normalized',
        line: 0,
        severity: 'warning',
        message: 'Non-standard bullet styles detected',
        suggestion: 'Bullet styles normalized to standard bullet character'
      });
      fixed = this.normalizeBulletStyles(fixed, config.standardBulletChar);
      this.log('[FormatEnforcement] Normalized bullet styles', 'verbose');
    }

    // RULE 2: Fix bullet point line breaks (CRITICAL)
    const bulletCount = (fixed.match(/•/g) || []).length;
    if (bulletCount >= 2) {
      const beforeFix = fixed;
      fixed = this.fixBulletLineBreaks(fixed);
      if (beforeFix !== fixed) {
        violations.push({
          type: 'bullet_line_breaks',
          line: 0,
          severity: 'error',
          message: 'Multiple bullets on same line',
          suggestion: 'Each bullet must be on separate line'
        });
        this.log('[FormatEnforcement] Fixed bullet line breaks', 'verbose');
      }
    }

    // RULE 3: Enforce N items per bullet line (CONFIGURABLE)
    if (bulletCount >= 2) {
      const beforeFix = fixed;
      fixed = this.enforceMaxItemsPerLine(fixed, config.maxItemsPerLine);
      if (beforeFix !== fixed) {
        violations.push({
          type: 'items_per_line',
          line: 0,
          severity: 'error',
          message: `Bullet lines have more than ${config.maxItemsPerLine} items`,
          suggestion: `Maximum ${config.maxItemsPerLine} items per bullet line`
        });
        this.log(`[FormatEnforcement] Enforced max ${config.maxItemsPerLine} items per line`, 'verbose');
      }
    }

    // RULE 4: Enforce max N-line intro (CONFIGURABLE)
    if (bulletCount >= 2) {
      const beforeFix = fixed;
      fixed = this.enforceMaxIntroLines(fixed, config.maxIntroLines);
      if (beforeFix !== fixed) {
        violations.push({
          type: 'intro_length',
          line: 0,
          severity: 'error',
          message: `Intro is longer than ${config.maxIntroLines} lines`,
          suggestion: `Truncate intro to maximum ${config.maxIntroLines} lines`
        });
        this.log(`[FormatEnforcement] Truncated intro to ${config.maxIntroLines} lines`, 'verbose');
      }
    }

    // RULE 5: Remove paragraphs after bullets (CRITICAL)
    if (bulletCount >= 2) {
      const beforeFix = fixed;
      fixed = this.removeParagraphsAfterBullets(fixed);
      if (beforeFix !== fixed) {
        violations.push({
          type: 'paragraphs_after_bullets',
          line: 0,
          severity: 'error',
          message: 'Paragraphs found after bullet points',
          suggestion: 'Remove all text after last bullet'
        });
        this.log('[FormatEnforcement] Removed paragraphs after bullets', 'verbose');
      }
    }

    // RULE 6: Auto-bold key values (monetary, percentages, dates, filenames)
    if (config.autoBoldValues) {
      const beforeBoldFix = fixed;
      fixed = this.autoBoldValuesInText(fixed);
      if (beforeBoldFix !== fixed) {
        violations.push({
          type: 'auto_bold_applied',
          line: 0,
          severity: 'warning',
          message: 'Auto-bolded key values (monetary, %, dates, files)',
          suggestion: 'Values were automatically bolded'
        });
        this.log('[FormatEnforcement] Auto-bolded key values', 'verbose');
      }
    }

    // RULE 6b: Validate remaining bold formatting issues (WARNING)
    const boldViolations = this.validateBoldFormatting(fixed);
    violations.push(...boldViolations);

    // RULE 7: Remove citation patterns (CRITICAL)
    if (config.removeCitations) {
      const beforeCitationFix = fixed;
      fixed = this.removeCitationsFromText(fixed);
      if (beforeCitationFix !== fixed) {
        violations.push({
          type: 'citations',
          line: 0,
          severity: 'error',
          message: 'Response contains citation patterns',
          suggestion: 'Remove "According to page X" patterns'
        });
        this.log('[FormatEnforcement] Removed citations', 'verbose');
      }
    }

    // RULE 8: Clean excessive whitespace (POLISH)
    fixed = this.cleanWhitespace(fixed);

    // RULE 9: Remove empty bullet points (CLEANUP)
    if (config.removeEmptyBullets && bulletCount >= 1) {
      const beforeEmptyFix = fixed;
      fixed = this.removeEmptyBullets(fixed);
      if (beforeEmptyFix !== fixed) {
        violations.push({
          type: 'empty_bullets_removed',
          line: 0,
          severity: 'warning',
          message: 'Removed empty bullet points',
          suggestion: 'Empty bullets were automatically removed'
        });
        this.log('[FormatEnforcement] Removed empty bullet points', 'verbose');
      }
    }

    // RULE 10: Remove trailing periods from short bullets (POLISH)
    if (config.removeTrailingPeriods && bulletCount >= 1) {
      const beforePeriodFix = fixed;
      fixed = this.removeTrailingPeriodsFromBullets(fixed);
      if (beforePeriodFix !== fixed) {
        violations.push({
          type: 'trailing_periods_removed',
          line: 0,
          severity: 'warning',
          message: 'Removed trailing periods from short bullets',
          suggestion: 'Trailing periods were automatically removed from short bullet items'
        });
        this.log('[FormatEnforcement] Removed trailing periods from bullets', 'verbose');
      }
    }

    // RULE 11: Format "Next actions:" section (CLEANUP)
    if (config.formatNextActions && this.hasNextActionsSection(fixed)) {
      const beforeNextActionsFix = fixed;
      fixed = this.formatNextActionsSection(fixed);
      if (beforeNextActionsFix !== fixed) {
        violations.push({
          type: 'next_actions_formatted',
          line: 0,
          severity: 'warning',
          message: 'Formatted "Next actions:" section',
          suggestion: 'Next actions section was normalized to standard format'
        });
        this.log('[FormatEnforcement] Formatted Next actions section', 'verbose');
      }
    }

    // RULE 12: Validate structure (VALIDATION ONLY)
    const structureViolations = this.validateStructure(fixed);
    violations.push(...structureViolations);

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      fixedText: fixed
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 1: EMOJI REMOVAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Comprehensive emoji pattern covering Unicode emoji ranges including:
   * - Basic emoticons and symbols (U+1F300-1F9FF)
   * - Extended emoji (U+1FA00-1FAFF) - Emoji 12.0+ (chess, symbols, objects)
   * - Regional indicator symbols (U+1F1E0-1F1FF) - flags
   * - Skin tone modifiers (U+1F3FB-1F3FF)
   * - Miscellaneous symbols (U+2600-26FF, U+2700-27BF)
   * - Supplemental symbols (U+2300-23FF)
   * - Dingbats and symbols
   * - Variation selectors (U+FE00-FE0F)
   * - Zero-width joiner for combined emojis
   */
  private getEmojiPattern(): RegExp {
    return new RegExp([
      // Miscellaneous Symbols and Pictographs (U+1F300-1F5FF)
      '[\u{1F300}-\u{1F5FF}]',
      // Emoticons (U+1F600-1F64F)
      '[\u{1F600}-\u{1F64F}]',
      // Transport and Map Symbols (U+1F680-1F6FF)
      '[\u{1F680}-\u{1F6FF}]',
      // Supplemental Symbols and Pictographs (U+1F900-1F9FF)
      '[\u{1F900}-\u{1F9FF}]',
      // Symbols and Pictographs Extended-A (U+1FA00-1FAFF) - Emoji 12.0+
      '[\u{1FA00}-\u{1FAFF}]',
      // Symbols and Pictographs Extended-B (U+1FB00-1FBFF)
      '[\u{1FB00}-\u{1FBFF}]',
      // Regional Indicator Symbols (U+1F1E0-1F1FF) - flags
      '[\u{1F1E0}-\u{1F1FF}]',
      // Skin tone modifiers (U+1F3FB-1F3FF)
      '[\u{1F3FB}-\u{1F3FF}]',
      // Miscellaneous Symbols (U+2600-26FF)
      '[\u{2600}-\u{26FF}]',
      // Dingbats (U+2700-27BF)
      '[\u{2700}-\u{27BF}]',
      // Miscellaneous Technical (U+2300-23FF)
      '[\u{2300}-\u{23FF}]',
      // Playing cards (U+1F0A0-1F0FF)
      '[\u{1F0A0}-\u{1F0FF}]',
      // Mahjong Tiles (U+1F000-1F02F)
      '[\u{1F000}-\u{1F02F}]',
      // Enclosed Alphanumeric Supplement (U+1F100-1F1FF) - circled letters, etc
      '[\u{1F100}-\u{1F1FF}]',
      // Enclosed Ideographic Supplement (U+1F200-1F2FF)
      '[\u{1F200}-\u{1F2FF}]',
      // Common individual emojis that may be missed
      '\u{2B50}', // Star
      '\u{2705}', // Check mark
      '\u{274C}', // X mark
      '\u{274E}', // X mark outline
      '\u{2728}', // Sparkles
      '\u{2764}', // Heart
      '\u{2763}', // Heart exclamation
      '\u{2049}', // Exclamation question
      '\u{203C}', // Double exclamation
      '\u{00A9}', // Copyright
      '\u{00AE}', // Registered
      '\u{2122}', // Trademark
      // Variation selectors (U+FE00-FE0F) - these make text chars into emoji
      '[\u{FE00}-\u{FE0F}]',
      // Zero-width joiner (used in combined emojis like family, flags)
      '\u{200D}',
      // Combining enclosing keycap (for keycap emojis like 1️⃣)
      '\u{20E3}'
    ].join('|'), 'gu');
  }

  hasEmojis(text: string): boolean {
    return this.getEmojiPattern().test(text);
  }

  removeEmojis(text: string): string {
    let cleaned = text.replace(this.getEmojiPattern(), '');
    // Clean up multiple spaces left by emoji removal (but NOT newlines)
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
    // Trim trailing spaces from each line only (preserve leading spaces and newlines)
    cleaned = cleaned.replace(/[ \t]+$/gm, '');
    // Trim leading spaces from each line
    cleaned = cleaned.replace(/^[ \t]+/gm, '');
    return cleaned;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 1b: BULLET STYLE NORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Normalize different bullet styles to standard bullet character
   *
   * Supports:
   * - Hyphen bullets: "- Item" → "• Item"
   * - Asterisk bullets: "* Item" → "• Item"
   * - Unicode bullets: "‣ Item", "◦ Item", "▪ Item" → "• Item"
   * - Numbered lists: "1. Item", "2) Item" → preserved as-is (optional conversion)
   *
   * @param text - Text to normalize
   * @param standardBullet - The standard bullet character to use (default: '•')
   */
  normalizeBulletStyles(text: string, standardBullet: string = '•'): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      let normalized = line;

      // Normalize hyphen bullets at line start: "- Item" or " - Item"
      // Must have space after hyphen to distinguish from negative numbers or dashes in text
      normalized = normalized.replace(/^(\s*)- /, `$1${standardBullet} `);

      // Normalize asterisk bullets at line start: "* Item" or " * Item"
      // Must have space after asterisk to distinguish from bold markers
      normalized = normalized.replace(/^(\s*)\* /, `$1${standardBullet} `);

      // Normalize other Unicode bullets: ‣ ◦ ▪ ▫ ▸ ▹ ► ➤ ➢
      normalized = normalized.replace(/^(\s*)[‣◦▪▫▸▹►➤➢] /, `$1${standardBullet} `);

      // Normalize en-dash and em-dash bullets: "– Item" or "— Item"
      normalized = normalized.replace(/^(\s*)[–—] /, `$1${standardBullet} `);

      result.push(normalized);
    }

    return result.join('\n');
  }

  /**
   * Check if text contains any non-standard bullet characters
   */
  hasNonStandardBullets(text: string): boolean {
    // Match lines starting with non-standard bullets followed by space
    const nonStandardPattern = /^(\s*)[-*‣◦▪▫▸▹►➤➢–—] /m;
    return nonStandardPattern.test(text);
  }

  /**
   * Convert numbered list to bullet list
   *
   * Example:
   * "1. First item" → "• First item"
   * "2) Second item" → "• Second item"
   *
   * @param text - Text to convert
   * @param standardBullet - The standard bullet character to use (default: '•')
   */
  convertNumberedToBullets(text: string, standardBullet: string = '•'): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      let converted = line;

      // Pattern 1: "1. Item" (number followed by period and space)
      converted = converted.replace(/^(\s*)\d+\. /, `$1${standardBullet} `);

      // Pattern 2: "1) Item" (number followed by parenthesis and space)
      converted = converted.replace(/^(\s*)\d+\) /, `$1${standardBullet} `);

      result.push(converted);
    }

    return result.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 2: BULLET LINE BREAKS
  // ═══════════════════════════════════════════════════════════════════════════

  fixBulletLineBreaks(text: string): string {
    // Pattern 1: "• Item1 • Item2 • Item3" → "• Item1\n• Item2\n• Item3"
    let fixed = text.replace(/ • /g, '\n• ');

    // Pattern 2: "•Item1 •Item2" (no space after bullet)
    fixed = fixed.replace(/ •/g, '\n•');

    // Pattern 3: Multiple spaces before bullets
    fixed = fixed.replace(/  +•/g, '\n•');

    // Pattern 4: Collapse excessive newlines (3+) before bullets to double newline
    // PRESERVE double newline (\n\n) for intro separation
    fixed = fixed.replace(/\n{3,}•/g, '\n\n•');

    // Pattern 5: Ensure bullets start on new lines (after non-newline chars)
    // BUT don't add if already has newline before
    fixed = fixed.replace(/([^\n])•/g, '$1\n•');

    // Pattern 6: Fix bullets at start of line with extra space
    fixed = fixed.replace(/\n +•/g, '\n•');

    return fixed;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 3: 2-3 ITEMS PER LINE (CRITICAL NEW RULE)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enforce 2-3 items per bullet line
   *
   * EXAMPLES:
   *
   * GOOD (2 items):
   * • **Budget 2024.xlsx** (Q4 financial data), **Report.pdf** (annual summary)
   *
   * GOOD (3 items):
   * • **Budget 2024.xlsx** (Q4 data), **Report.pdf** (summary), **Analysis.docx** (details)
   *
   * BAD (4+ items):
   * • **Budget 2024.xlsx** (Q4 data), **Report.pdf** (summary), **Analysis.docx** (details), **Notes.txt** (comments)
   *
   * FIX: Split into multiple lines:
   * • **Budget 2024.xlsx** (Q4 data), **Report.pdf** (summary), **Analysis.docx** (details)
   * • **Notes.txt** (comments)
   */
  /**
   * Enforce maximum items per bullet line (configurable)
   * @param text - The text to process
   * @param maxItems - Maximum items per line (default: 3)
   */
  enforceMaxItemsPerLine(text: string, maxItems: number = 3): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      // Check if line is a bullet point
      if (line.trim().startsWith('•')) {
        // Count items in this bullet line
        const items = this.splitBulletItems(line);

        if (items.length > maxItems) {
          // Too many items - split into multiple lines
          this.log(`[FormatEnforcement] Splitting bullet with ${items.length} items into multiple lines (max: ${maxItems})`, 'verbose');

          // Group items into chunks of maxItems
          for (let i = 0; i < items.length; i += maxItems) {
            const chunk = items.slice(i, i + maxItems);
            const bulletLine = '• ' + chunk.join(', ');
            result.push(bulletLine);
          }
        } else {
          // Within limit - keep as is
          result.push(line);
        }
      } else {
        // Not a bullet line - keep as is
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Legacy alias for enforceMaxItemsPerLine with default of 3
   * @deprecated Use enforceMaxItemsPerLine instead
   */
  enforce2To3ItemsPerLine(text: string): string {
    return this.enforceMaxItemsPerLine(text, 3);
  }

  /**
   * Split bullet line into items (respecting brackets and parentheses)
   *
   * Example:
   * "• **File1.pdf** (contains data, charts), **File2.xlsx** (Q4 results)"
   * → ["**File1.pdf** (contains data, charts)", "**File2.xlsx** (Q4 results)"]
   *
   * Supported brackets:
   * - () parentheses - round brackets
   * - [] square brackets
   * - {} curly brackets
   *
   * Also handles nested brackets:
   * "• **Report** (contains [nested, data]), **File**"
   * → ["**Report** (contains [nested, data])", "**File**"]
   */
  private splitBulletItems(bulletLine: string): string[] {
    // Remove bullet prefix
    const content = bulletLine.replace(/^•\s*/, '').trim();

    // If content is empty, return empty array
    if (!content) {
      return [];
    }

    // Strategy: Split by comma, but respect all bracket types and nesting
    const items: string[] = [];
    let currentItem = '';
    let parenDepth = 0;    // ()
    let bracketDepth = 0;  // []
    let braceDepth = 0;    // {}

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      // Track parentheses ()
      if (char === '(') {
        parenDepth++;
        currentItem += char;
      } else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1); // Prevent negative depth
        currentItem += char;
      }
      // Track square brackets []
      else if (char === '[') {
        bracketDepth++;
        currentItem += char;
      } else if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        currentItem += char;
      }
      // Track curly brackets {}
      else if (char === '{') {
        braceDepth++;
        currentItem += char;
      } else if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        currentItem += char;
      }
      // Check for comma separator (only when outside ALL bracket types)
      else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        const trimmed = currentItem.trim();
        if (trimmed.length > 0) {
          items.push(trimmed);
        }
        currentItem = '';
      } else {
        currentItem += char;
      }
    }

    // Add last item
    const lastTrimmed = currentItem.trim();
    if (lastTrimmed.length > 0) {
      items.push(lastTrimmed);
    }

    return items;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 4: MAX N-LINE INTRO (configurable)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enforce maximum intro lines before bullets (configurable)
   * @param text - The text to process
   * @param maxLines - Maximum intro lines (default: 2)
   */
  enforceMaxIntroLines(text: string, maxLines: number = 2): string {
    const firstBulletIndex = text.indexOf('•');
    if (firstBulletIndex === -1) {
      return text; // No bullets
    }

    const intro = text.substring(0, firstBulletIndex).trim();
    const bulletsAndRest = text.substring(firstBulletIndex);

    // Split intro into lines
    const introLines = intro.split('\n').filter(line => line.trim().length > 0);

    if (introLines.length > maxLines) {
      this.log(`[FormatEnforcement] Truncating intro from ${introLines.length} lines to ${maxLines} lines`, 'verbose');
      const truncatedIntro = introLines.slice(0, maxLines).join('\n');
      return truncatedIntro + '\n\n' + bulletsAndRest;
    }

    return text;
  }

  /**
   * Legacy alias for enforceMaxIntroLines with default of 2
   * @deprecated Use enforceMaxIntroLines instead
   */
  enforceMaxTwoLineIntro(text: string): string {
    return this.enforceMaxIntroLines(text, 2);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 5: NO PARAGRAPHS AFTER BULLETS
  // ═══════════════════════════════════════════════════════════════════════════

  removeParagraphsAfterBullets(text: string): string {
    const bulletMatches = text.match(/•[^\n]+/g);
    if (!bulletMatches || bulletMatches.length === 0) {
      return text;
    }

    // Find bullets that are NOT part of "Next actions:" section
    const nextActionsStart = text.indexOf('Next actions:');
    let lastMainBullet = bulletMatches[bulletMatches.length - 1];

    // If there's a Next actions section, find the last bullet BEFORE it
    if (nextActionsStart !== -1) {
      for (let i = bulletMatches.length - 1; i >= 0; i--) {
        const bulletIndex = text.indexOf(bulletMatches[i]);
        if (bulletIndex < nextActionsStart) {
          lastMainBullet = bulletMatches[i];
          break;
        }
      }
    }

    const lastBulletIndex = text.lastIndexOf(lastMainBullet);
    const endOfLastBullet = lastBulletIndex + lastMainBullet.length;

    // Check for "Next actions:" section after the last main bullet
    const nextActionsIndex = text.indexOf('Next actions:', endOfLastBullet);

    if (nextActionsIndex !== -1) {
      // Keep "Next actions:" section
      const beforeBullets = text.substring(0, endOfLastBullet);
      const nextActionsSection = text.substring(nextActionsIndex);
      const textBetween = text.substring(endOfLastBullet, nextActionsIndex).trim();

      if (textBetween.length > 0) {
        console.log(`[FormatEnforcement] Removing ${textBetween.length} chars between bullets and "Next actions:"`);
        return beforeBullets + '\n\n' + nextActionsSection;
      }

      return text;
    } else {
      // No "Next actions:" - remove everything after last bullet
      const afterLastBullet = text.substring(endOfLastBullet).trim();

      if (afterLastBullet.length > 0) {
        console.log(`[FormatEnforcement] Removing ${afterLastBullet.length} chars after last bullet`);
        return text.substring(0, endOfLastBullet);
      }

      return text;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 6: BOLD FORMATTING VALIDATION AND AUTO-FIX
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Auto-bold monetary values, percentages, dates, and filenames
   *
   * EXAMPLES:
   * - "$1,234.56" → "**$1,234.56**"
   * - "45%" → "**45%**"
   * - "2024-12-03" → "**2024-12-03**"
   * - "Budget.xlsx" → "**Budget.xlsx**"
   */
  autoBoldValuesInText(text: string): string {
    let fixed = text;

    // Auto-bold monetary values: $1,234.56 or $1234 (not already bolded)
    // Negative lookbehind for ** and negative lookahead for **
    fixed = fixed.replace(/(?<!\*\*)(\$\d+(?:,\d{3})*(?:\.\d{2})?)(?!\*\*)/g, '**$1**');

    // Auto-bold percentages: 45% or 45.5% (not already bolded)
    // Be careful not to match numbers that are already part of something else
    fixed = fixed.replace(/(?<!\*\*|\d)(\d+(?:\.\d+)?%)(?!\*\*)/g, '**$1**');

    // Auto-bold dates: YYYY-MM-DD format (not already bolded)
    fixed = fixed.replace(/(?<!\*\*)(\d{4}-\d{2}-\d{2})(?!\*\*)/g, '**$1**');

    // Auto-bold dates: MM/DD/YYYY or M/D/YY format (not already bolded)
    fixed = fixed.replace(/(?<!\*\*)(\d{1,2}\/\d{1,2}\/\d{2,4})(?!\*\*)/g, '**$1**');

    // Auto-bold filenames with common extensions (not already bolded)
    // Matches single-word filenames: Budget2024.xlsx, Report.pdf, data.csv
    // Note: Multi-word filenames with spaces are harder to detect accurately
    // and may cause false positives, so we only handle single-word filenames
    fixed = fixed.replace(/(?<!\*\*)\b([a-zA-Z][a-zA-Z0-9_\-]*\.(pdf|xlsx|docx|txt|csv|pptx|doc|xls|ppt|md))\b(?!\*\*)/gi, '**$1**');

    // Clean up any double-bolding that might have occurred: ****text**** → **text**
    fixed = fixed.replace(/\*{4,}([^*]+)\*{4,}/g, '**$1**');

    return fixed;
  }

  /**
   * Legacy alias for autoBoldValuesInText
   * @deprecated Use autoBoldValuesInText instead
   */
  autoBoldValues(text: string): string {
    return this.autoBoldValuesInText(text);
  }

  validateBoldFormatting(text: string): FormatViolation[] {
    const violations: FormatViolation[] = [];
    const lines = text.split('\n');

    // Patterns that SHOULD be bold:
    // 1. Numbers (especially monetary values, percentages, dates)
    // 2. Key terms (first mention of important concepts)
    // 3. File names
    // 4. Dates
    // 5. Important concepts

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for monetary values without bold
      const moneyPattern = /(?<!\*\*)\$\d+(?:,\d{3})*(?:\.\d{2})?(?!\*\*)/g;
      if (moneyPattern.test(line)) {
        violations.push({
          type: 'missing_bold_money',
          line: i + 1,
          severity: 'warning',
          message: 'Monetary value not bolded',
          suggestion: 'Bold monetary values: **$1,234.56**'
        });
      }

      // Check for percentages without bold
      const percentPattern = /(?<!\*\*)\d+(?:\.\d+)?%(?!\*\*)/g;
      if (percentPattern.test(line)) {
        violations.push({
          type: 'missing_bold_percent',
          line: i + 1,
          severity: 'warning',
          message: 'Percentage not bolded',
          suggestion: 'Bold percentages: **45%**'
        });
      }

      // Check for dates without bold (YYYY-MM-DD, MM/DD/YYYY, etc.)
      const datePattern = /(?<!\*\*)\d{4}-\d{2}-\d{2}(?!\*\*)|(?<!\*\*)\d{1,2}\/\d{1,2}\/\d{2,4}(?!\*\*)/g;
      if (datePattern.test(line)) {
        violations.push({
          type: 'missing_bold_date',
          line: i + 1,
          severity: 'warning',
          message: 'Date not bolded',
          suggestion: 'Bold dates: **2024-12-03**'
        });
      }

      // Check for file extensions without bold
      const filePattern = /(?<!\*\*)[a-zA-Z0-9_\-]+\.(pdf|xlsx|docx|txt|csv|pptx)(?!\*\*)/gi;
      if (filePattern.test(line)) {
        violations.push({
          type: 'missing_bold_filename',
          line: i + 1,
          severity: 'warning',
          message: 'Filename not bolded',
          suggestion: 'Bold filenames: **Budget 2024.xlsx**'
        });
      }
    }

    return violations;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 7: REMOVE CITATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  removeCitationsFromText(text: string): string {
    let fixed = text;

    // ═══════════════════════════════════════════════════════════════════════════
    // ENGLISH CITATION PATTERNS
    // ═══════════════════════════════════════════════════════════════════════════

    // Remove "According to page X" patterns
    fixed = fixed.replace(/According to (?:page|document|file|the document|the file)\s+[^\.,]+[,\.]\s*/gi, '');

    // Remove "As mentioned in page X" patterns
    fixed = fixed.replace(/As (?:mentioned|stated|shown|indicated) in (?:page|document|file)\s+[^\.,]+[,\.]\s*/gi, '');

    // Remove "From page X" patterns
    fixed = fixed.replace(/From (?:page|document|file)\s+[^\.,]+[,\.]\s*/gi, '');

    // Remove "(page X)" patterns and clean up extra space
    fixed = fixed.replace(/\s*\(page\s+\d+\)\s*/gi, ' ');

    // Remove "[page X]" patterns and clean up extra space
    fixed = fixed.replace(/\s*\[page\s+\d+\]\s*/gi, ' ');

    // ═══════════════════════════════════════════════════════════════════════════
    // PORTUGUESE CITATION PATTERNS
    // ═══════════════════════════════════════════════════════════════════════════

    // "De acordo com a página X" / "De acordo com o documento X"
    fixed = fixed.replace(/De acordo com (?:a página|o documento|o arquivo)\s+[^\.,]+[,\.]\s*/gi, '');

    // "Conforme a página X" / "Conforme mencionado na página X"
    fixed = fixed.replace(/Conforme (?:a página|mencionado na página|o documento)\s+[^\.,]+[,\.]\s*/gi, '');

    // "Na página X" / "No documento X"
    fixed = fixed.replace(/N[ao] (?:página|documento|arquivo)\s+[^\.,]+[,\.]\s*/gi, '');

    // "Segundo a página X" / "Segundo o documento X"
    fixed = fixed.replace(/Segundo (?:a página|o documento|o arquivo)\s+[^\.,]+[,\.]\s*/gi, '');

    // "(página X)" patterns
    fixed = fixed.replace(/\s*\(página\s+\d+\)\s*/gi, ' ');

    // "[página X]" patterns
    fixed = fixed.replace(/\s*\[página\s+\d+\]\s*/gi, ' ');

    // ═══════════════════════════════════════════════════════════════════════════
    // SPANISH CITATION PATTERNS
    // ═══════════════════════════════════════════════════════════════════════════

    // "Según la página X" / "Según el documento X"
    fixed = fixed.replace(/Según (?:la página|el documento|el archivo)\s+[^\.,]+[,\.]\s*/gi, '');

    // "De acuerdo con la página X"
    fixed = fixed.replace(/De acuerdo con (?:la página|el documento|el archivo)\s+[^\.,]+[,\.]\s*/gi, '');

    // "Como se menciona en la página X"
    fixed = fixed.replace(/Como se (?:menciona|indica|muestra) en (?:la página|el documento)\s+[^\.,]+[,\.]\s*/gi, '');

    // "En la página X" / "En el documento X"
    fixed = fixed.replace(/En (?:la página|el documento|el archivo)\s+[^\.,]+[,\.]\s*/gi, '');

    // "(página X)" patterns (Spanish uses same as Portuguese)
    // Already handled above

    // ═══════════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════════════════

    // Clean up double spaces left after removal (but NOT newlines)
    fixed = fixed.replace(/[ \t]{2,}/g, ' ');

    return fixed;
  }

  /**
   * Legacy alias for removeCitationsFromText
   * @deprecated Use removeCitationsFromText instead
   */
  removeCitations(text: string): string {
    return this.removeCitationsFromText(text);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 8: CLEAN WHITESPACE
  // ═══════════════════════════════════════════════════════════════════════════

  cleanWhitespace(text: string): string {
    // Remove trailing whitespace from each line
    let cleaned = text.replace(/[ \t]+$/gm, '');

    // Remove multiple consecutive blank lines (max 2 newlines = 1 blank line)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove leading/trailing whitespace from entire text
    cleaned = cleaned.trim();

    return cleaned;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 9: STRUCTURE FIXES AND VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Remove empty bullet points from text
   *
   * Example:
   * "• Item 1\n• \n• Item 2" → "• Item 1\n• Item 2"
   */
  removeEmptyBullets(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      // Check if this is an empty bullet line
      if (line.trim().startsWith('•')) {
        const content = line.replace(/^•\s*/, '').trim();
        if (content.length === 0) {
          // Skip empty bullet
          this.log('[FormatEnforcement] Removing empty bullet point', 'verbose');
          continue;
        }
      }
      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Remove trailing periods from short bullet items
   *
   * Rules:
   * - Only removes periods from bullets < 100 chars
   * - Does NOT remove if bullet contains parentheses (likely a sentence)
   * - Does NOT remove if bullet ends with common abbreviations (etc., e.g., i.e.)
   *
   * Example:
   * "• Short item." → "• Short item"
   * "• Long sentence with explanation (context)." → unchanged
   */
  removeTrailingPeriodsFromBullets(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    // Common abbreviations that should keep their periods
    const abbreviations = ['etc.', 'e.g.', 'i.e.', 'vs.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Jr.', 'Sr.'];

    for (const line of lines) {
      if (line.trim().startsWith('•')) {
        const content = line.replace(/^•\s*/, '').trim();

        // Check if we should remove the period
        const shouldRemovePeriod =
          content.endsWith('.') &&
          content.length < 100 &&
          !content.includes('(') &&
          !abbreviations.some(abbr => content.endsWith(abbr));

        if (shouldRemovePeriod) {
          // Remove trailing period
          const newContent = content.slice(0, -1);
          result.push('• ' + newContent);
          this.log('[FormatEnforcement] Removed trailing period from bullet', 'verbose');
        } else {
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Format the "Next actions:" section to ensure proper structure
   *
   * Rules:
   * 1. Header must be "Next actions:" (normalize variations like "Next steps:", "Actions:")
   * 2. Header must be followed by blank line
   * 3. Action items must use bullet points
   * 4. Each action on its own line
   *
   * Example:
   * "Next steps: Item 1, Item 2" →
   * "Next actions:
   *
   * • Item 1
   * • Item 2"
   */
  formatNextActionsSection(text: string): string {
    let fixed = text;

    // Check if already has proper "Next actions:" with bullets - skip if so
    if (/Next actions:\s*\n\n?\s*•/i.test(fixed)) {
      return fixed;
    }

    // Normalize header variations to "Next actions:" (but not "Next actions:" itself)
    // These patterns ensure we don't match "Next actions:" again
    fixed = fixed.replace(/\bNext\s*steps?:/gi, 'Next actions:');
    fixed = fixed.replace(/\bSuggested\s*actions?:/gi, 'Next actions:');
    fixed = fixed.replace(/\bRecommended\s*actions?:/gi, 'Next actions:');

    // Find the Next actions section
    const nextActionsMatch = fixed.match(/Next actions:\s*([^\n]*(?:\n(?!\n)[^\n]*)*)/i);
    if (!nextActionsMatch) {
      return fixed;
    }

    const nextActionsIndex = fixed.indexOf('Next actions:');
    const beforeSection = fixed.substring(0, nextActionsIndex);

    // Get content after "Next actions:" until end or double newline
    const afterHeader = fixed.substring(nextActionsIndex + 'Next actions:'.length);
    const sectionEndMatch = afterHeader.match(/\n\n/);
    const sectionEnd = sectionEndMatch ? sectionEndMatch.index! : afterHeader.length;
    const sectionContent = afterHeader.substring(0, sectionEnd).trim();
    const afterSection = afterHeader.substring(sectionEnd);

    // If section content is empty or already has bullets, keep as is
    if (!sectionContent || sectionContent.includes('•')) {
      return fixed;
    }

    // Split inline items by comma and convert to bullet list
    const items = sectionContent.split(/[,;]/).map(item => item.trim()).filter(item => item.length > 0);

    if (items.length === 0) {
      return fixed;
    }

    const formattedItems = items.map(item => `• ${item}`).join('\n');

    this.log('[FormatEnforcement] Formatted Next actions section', 'verbose');

    return `${beforeSection}Next actions:\n\n${formattedItems}${afterSection}`;
  }

  /**
   * Check if text has a "Next actions:" section
   */
  hasNextActionsSection(text: string): boolean {
    return /Next\s*(actions?|steps?):?/i.test(text);
  }

  validateStructure(text: string): FormatViolation[] {
    const violations: FormatViolation[] = [];

    // Check for proper bullet structure
    const bulletCount = (text.match(/•/g) || []).length;
    if (bulletCount >= 2) {
      // Validate intro exists
      const firstBulletIndex = text.indexOf('•');
      const intro = text.substring(0, firstBulletIndex).trim();

      if (intro.length === 0) {
        violations.push({
          type: 'missing_intro',
          line: 1,
          severity: 'warning',
          message: 'Response starts with bullets without intro',
          suggestion: 'Add 1-2 line intro before bullets'
        });
      }

      // Validate bullets are properly formatted
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('•')) {
          // Check if bullet has content
          const content = line.replace(/^•\s*/, '').trim();
          if (content.length === 0) {
            violations.push({
              type: 'empty_bullet',
              line: i + 1,
              severity: 'error',
              message: 'Empty bullet point',
              suggestion: 'Remove empty bullets or add content'
            });
          }

          // Check if bullet ends with period (should not for list items)
          if (content.endsWith('.') && !content.includes('(') && content.length < 100) {
            violations.push({
              type: 'bullet_period',
              line: i + 1,
              severity: 'warning',
              message: 'Short bullet ends with period',
              suggestion: 'Remove period from short bullet items'
            });
          }
        }
      }
    }

    return violations;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE FORMATTING VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if text contains a markdown table
   */
  hasTable(text: string): boolean {
    // Table must have at least header row, separator row, and one data row
    // Pattern: lines with | pipe characters
    const lines = text.split('\n');
    let pipeLineCount = 0;
    let hasSeparator = false;

    for (const line of lines) {
      if (line.includes('|')) {
        pipeLineCount++;
        // Separator row pattern: |---|---|---| or | --- | --- |
        if (/^\|?[\s-:]+\|[\s-:|]+\|?$/.test(line.trim())) {
          hasSeparator = true;
        }
      }
    }

    return pipeLineCount >= 3 && hasSeparator;
  }

  /**
   * Validate table formatting and return violations
   *
   * Rules:
   * 1. Tables must have header row
   * 2. Tables must have separator row (---|---|---)
   * 3. All rows must have same number of columns
   * 4. Pipes should be aligned (warning only)
   */
  validateTableFormatting(text: string): FormatViolation[] {
    const violations: FormatViolation[] = [];

    if (!this.hasTable(text)) {
      return violations;
    }

    const lines = text.split('\n');
    const tableLines: { line: string; lineNumber: number }[] = [];
    let inTable = false;

    // Extract table lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('|')) {
        inTable = true;
        tableLines.push({ line, lineNumber: i + 1 });
      } else if (inTable && line.trim() === '') {
        // Empty line ends table
        break;
      } else if (inTable) {
        // Non-pipe line within table is an error
        violations.push({
          type: 'table_incomplete_row',
          line: i + 1,
          severity: 'error',
          message: 'Table row missing pipe delimiters',
          suggestion: 'Ensure all table rows use | to separate columns'
        });
        break;
      }
    }

    if (tableLines.length < 3) {
      violations.push({
        type: 'table_incomplete',
        line: tableLines[0]?.lineNumber || 1,
        severity: 'error',
        message: 'Table must have at least header, separator, and one data row',
        suggestion: 'Add missing table rows'
      });
      return violations;
    }

    // Check separator row (should be second line)
    const separatorLine = tableLines[1]?.line || '';
    if (!/^\|?[\s-:]+\|[\s-:|]+\|?$/.test(separatorLine.trim())) {
      violations.push({
        type: 'table_missing_separator',
        line: tableLines[1]?.lineNumber || 2,
        severity: 'error',
        message: 'Table missing separator row (---|---|---)',
        suggestion: 'Add separator row after header: | --- | --- | --- |'
      });
    }

    // Count columns in each row
    const columnCounts = tableLines.map(tl => {
      // Count pipes, accounting for leading/trailing
      const trimmed = tl.line.trim();
      const pipes = (trimmed.match(/\|/g) || []).length;
      // If line starts and ends with |, columns = pipes - 1
      // If line only has internal |, columns = pipes + 1
      const startsWithPipe = trimmed.startsWith('|');
      const endsWithPipe = trimmed.endsWith('|');
      if (startsWithPipe && endsWithPipe) {
        return pipes - 1;
      } else if (startsWithPipe || endsWithPipe) {
        return pipes;
      } else {
        return pipes + 1;
      }
    });

    const headerColumnCount = columnCounts[0];
    for (let i = 1; i < columnCounts.length; i++) {
      if (columnCounts[i] !== headerColumnCount) {
        violations.push({
          type: 'table_column_mismatch',
          line: tableLines[i].lineNumber,
          severity: 'error',
          message: `Row has ${columnCounts[i]} columns, expected ${headerColumnCount}`,
          suggestion: 'Ensure all rows have the same number of columns'
        });
      }
    }

    // Check for empty cells (warning)
    for (const tl of tableLines) {
      // Skip separator row
      if (/^\|?[\s-:]+\|[\s-:|]+\|?$/.test(tl.line.trim())) {
        continue;
      }

      const cells = tl.line.split('|').slice(1, -1); // Remove first and last (usually empty)
      for (const cell of cells) {
        if (cell.trim() === '') {
          violations.push({
            type: 'table_empty_cell',
            line: tl.lineNumber,
            severity: 'warning',
            message: 'Table contains empty cell',
            suggestion: 'Consider adding content or "-" for empty cells'
          });
          break; // Only warn once per row
        }
      }
    }

    return violations;
  }

  /**
   * Fix common table formatting issues
   *
   * Fixes:
   * 1. Ensures consistent column count
   * 2. Adds missing separator row
   * 3. Normalizes pipe alignment
   */
  fixTableFormatting(text: string): string {
    if (!this.hasTable(text)) {
      return text;
    }

    const lines = text.split('\n');
    const result: string[] = [];
    let tableLines: string[] = [];
    let inTable = false;
    let tableStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('|')) {
        if (!inTable) {
          tableStartIndex = result.length;
          inTable = true;
        }
        tableLines.push(line);
      } else if (inTable && line.trim() === '') {
        // End of table, process and add
        const fixedTable = this.normalizeTable(tableLines);
        result.push(...fixedTable);
        result.push(line);
        tableLines = [];
        inTable = false;
      } else if (inTable) {
        // Non-table line ends table
        const fixedTable = this.normalizeTable(tableLines);
        result.push(...fixedTable);
        result.push(line);
        tableLines = [];
        inTable = false;
      } else {
        result.push(line);
      }
    }

    // Handle table at end of text
    if (tableLines.length > 0) {
      const fixedTable = this.normalizeTable(tableLines);
      result.push(...fixedTable);
    }

    return result.join('\n');
  }

  /**
   * Normalize a table's formatting
   */
  private normalizeTable(tableLines: string[]): string[] {
    if (tableLines.length < 2) {
      return tableLines;
    }

    // Parse all cells
    const rows: string[][] = tableLines.map(line => {
      const trimmed = line.trim();
      // Remove leading/trailing pipes and split
      let cells = trimmed.split('|');
      // Remove empty first/last elements from leading/trailing pipes
      if (cells[0].trim() === '') cells = cells.slice(1);
      if (cells[cells.length - 1].trim() === '') cells = cells.slice(0, -1);
      return cells.map(c => c.trim());
    });

    // Find max columns
    const maxColumns = Math.max(...rows.map(r => r.length));

    // Ensure all rows have same number of columns
    const normalizedRows = rows.map(row => {
      while (row.length < maxColumns) {
        row.push('');
      }
      return row;
    });

    // Check if second row is separator, if not add one
    let hasSeparator = false;
    if (normalizedRows.length >= 2) {
      const secondRow = normalizedRows[1];
      hasSeparator = secondRow.every(cell => /^[-:]+$/.test(cell) || cell === '');
    }

    if (!hasSeparator && normalizedRows.length >= 1) {
      // Insert separator after header
      const separator = new Array(maxColumns).fill('---');
      normalizedRows.splice(1, 0, separator);
    }

    // Calculate column widths
    const columnWidths = new Array(maxColumns).fill(3); // Minimum width of 3 for ---
    for (const row of normalizedRows) {
      for (let i = 0; i < row.length; i++) {
        columnWidths[i] = Math.max(columnWidths[i], row[i].length);
      }
    }

    // Format rows with aligned pipes
    const formattedRows = normalizedRows.map((row, rowIndex) => {
      const isSeparator = rowIndex === 1 && row.every(cell => /^[-:]+$/.test(cell) || cell === '');

      const cells = row.map((cell, colIndex) => {
        if (isSeparator) {
          return '-'.repeat(columnWidths[colIndex]);
        }
        return cell.padEnd(columnWidths[colIndex]);
      });

      return '| ' + cells.join(' | ') + ' |';
    });

    this.log('[FormatEnforcement] Normalized table formatting', 'verbose');

    return formattedRows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get format enforcement statistics
   */
  getStats(text: string): {
    bulletCount: number;
    introLineCount: number;
    hasEmojis: boolean;
    hasCitations: boolean;
    boldCount: number;
    wordCount: number;
  } {
    const bulletCount = (text.match(/•/g) || []).length;
    const firstBulletIndex = text.indexOf('•');
    const intro = firstBulletIndex !== -1 ? text.substring(0, firstBulletIndex).trim() : text;
    const introLineCount = intro.split('\n').filter(l => l.trim()).length;
    const hasEmojis = this.hasEmojis(text);
    const hasCitations = /According to|As mentioned in|From page|\(page \d+\)/i.test(text);
    const boldCount = (text.match(/\*\*[^*]+\*\*/g) || []).length;
    const wordCount = text.split(/\s+/).length;

    return {
      bulletCount,
      introLineCount,
      hasEmojis,
      hasCitations,
      boldCount,
      wordCount
    };
  }
}

export default new FormatEnforcementService();
