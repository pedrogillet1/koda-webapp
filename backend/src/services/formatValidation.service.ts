/**
 * Format Validation Service
 *
 * Quality gate that validates and auto-corrects all responses before delivery to user.
 * Ensures 100% compliance with Koda's hybrid formatting standards.
 *
 * Features:
 * - Validates paragraph structure (2-3 sentences max)
 * - Validates spacing (blank lines between sections)
 * - Validates section headers (bold, separate lines)
 * - Validates bullet lists (proper spacing)
 * - Validates emphasis usage (5-10% of text)
 * - Auto-corrects issues when possible
 * - Logs violations for monitoring
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  correctedText: string;
  violations: FormatViolation[];
  stats: FormatStats;
}

export interface FormatViolation {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
  autoCorrected: boolean;
}

export interface FormatStats {
  totalParagraphs: number;
  longParagraphs: number; // > 3 sentences
  totalBullets: number;
  totalBoldText: number;
  boldPercentage: number;
  hasProperSpacing: boolean;
  hasSectionHeaders: boolean;
  hasClosing: boolean;
}

export type FormatType =
  | 'FEATURE_LIST'      // Comprehensive overview queries
  | 'STRUCTURED_LIST'   // Specific attribute queries with closing
  | 'DOCUMENT_LIST'     // "Which documents mention X?"
  | 'TABLE'             // Comparison/categorization queries
  | 'DIRECT_ANSWER'     // Factual queries with breakdown
  | 'SIMPLE_LIST'       // Entity extraction queries
  | 'GENERAL';          // Default format

// Legacy validation result interface (for backward compatibility)
export interface LegacyValidationResult {
  passed: boolean;
  score: number;
  grade: string;
  issues: string[];
  details: {
    hasEmojis: boolean;
    hasCitations: boolean;
    hasCodeBlocks: boolean;
    properBullets: boolean;
    properBoldFormat: boolean;
    properLineBreaks: boolean;
    hasTable: boolean;
    bulletCount: number;
    lineCount: number;
  };
}

// ============================================================================
// FORMAT VALIDATION SERVICE
// ============================================================================

class FormatValidationService {
  private readonly serviceName = 'FormatValidationService';

  /**
   * Main validation entry point
   * Validates and auto-corrects response text
   */
  async validateAndCorrect(text: string): Promise<ValidationResult> {
    const violations: FormatViolation[] = [];
    let correctedText = text;

    // Run all validations and corrections
    correctedText = this.validateParagraphLength(correctedText, violations);
    correctedText = this.validateSpacing(correctedText, violations);
    correctedText = this.validateSectionHeaders(correctedText, violations);
    correctedText = this.validateBulletLists(correctedText, violations);
    correctedText = this.validateEmphasis(correctedText, violations);
    correctedText = this.validateClosing(correctedText, violations);

    // Calculate stats
    const stats = this.calculateStats(correctedText);

    // Determine if valid
    const isValid = violations.filter(v => v.severity === 'error').length === 0;

    // Log violations
    if (violations.length > 0) {
      console.warn(`[${this.serviceName}] Format violations detected: ${violations.length} issues`);
      violations.forEach(v => {
        if (v.severity === 'error') {
          console.error(`[${this.serviceName}] [${v.rule}] ${v.message} (Auto-corrected: ${v.autoCorrected})`);
        } else if (v.severity === 'warning') {
          console.warn(`[${this.serviceName}] [${v.rule}] ${v.message} (Auto-corrected: ${v.autoCorrected})`);
        }
      });
    }

    return {
      isValid,
      correctedText,
      violations,
      stats
    };
  }

  /**
   * RULE 1: Paragraph Length
   * Max 2-3 sentences per paragraph
   */
  private validateParagraphLength(text: string, violations: FormatViolation[]): string {
    const paragraphs = text.split('\n\n');
    const correctedParagraphs: string[] = [];

    for (const para of paragraphs) {
      // Skip bullets, tables, headers
      if (this.isSpecialBlock(para)) {
        correctedParagraphs.push(para);
        continue;
      }

      const sentences = this.splitIntoSentences(para);

      if (sentences.length > 3) {
        // VIOLATION: Paragraph too long
        violations.push({
          rule: 'PARAGRAPH_LENGTH',
          severity: 'error',
          message: `Paragraph has ${sentences.length} sentences (max 3)`,
          location: para.substring(0, 50) + '...',
          autoCorrected: true
        });

        // AUTO-CORRECT: Break into smaller paragraphs
        const chunks: string[] = [];
        for (let i = 0; i < sentences.length; i += 2) {
          const chunkSize = Math.min(3, sentences.length - i);
          const chunk = sentences.slice(i, i + chunkSize).join(' ');
          chunks.push(chunk.trim());
        }
        correctedParagraphs.push(chunks.join('\n\n'));
      } else {
        correctedParagraphs.push(para);
      }
    }

    return correctedParagraphs.join('\n\n');
  }

  /**
   * RULE 2: Spacing
   * One blank line between all sections
   */
  private validateSpacing(text: string, violations: FormatViolation[]): string {
    let corrected = text;

    // Check for missing blank lines
    const lines = text.split('\n');
    let hasSpacingIssues = false;

    for (let i = 0; i < lines.length - 1; i++) {
      const current = lines[i].trim();
      const next = lines[i + 1].trim();

      // If both lines have content and neither is a bullet, should have blank line
      if (current && next && !current.startsWith('•') && !next.startsWith('•')) {
        const isSectionBoundary =
          current.endsWith(':') || // Header
          next.startsWith('**') || // Bold header
          this.endsWithPunctuation(current); // End of sentence

        if (isSectionBoundary && lines[i + 1] !== '') {
          hasSpacingIssues = true;
        }
      }
    }

    if (hasSpacingIssues) {
      violations.push({
        rule: 'SPACING',
        severity: 'warning',
        message: 'Missing blank lines between sections',
        autoCorrected: true
      });
    }

    // Remove excessive blank lines (more than 1)
    corrected = corrected.replace(/\n{3,}/g, '\n\n');

    return corrected;
  }

  /**
   * RULE 3: Section Headers
   * Bold headers should be on separate lines
   */
  private validateSectionHeaders(text: string, violations: FormatViolation[]): string {
    let corrected = text;

    // Find inline headers (bold text followed by colon, not on separate line)
    const inlineHeaderPattern = /([^\n])\s*(\*\*[^*]+:\*\*)\s*([^\n])/g;
    const matches = text.match(inlineHeaderPattern);

    if (matches && matches.length > 0) {
      violations.push({
        rule: 'SECTION_HEADERS',
        severity: 'warning',
        message: `Found ${matches.length} inline headers (should be on separate lines)`,
        autoCorrected: true
      });

      // AUTO-CORRECT: Put headers on separate lines
      corrected = corrected.replace(inlineHeaderPattern, '$1\n\n$2\n\n$3');
    }

    return corrected;
  }

  /**
   * RULE 4: Bullet Lists
   * Proper spacing before/after lists
   */
  private validateBulletLists(text: string, violations: FormatViolation[]): string {
    const lines = text.split('\n');
    const correctedLines: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isBullet = line.trim().startsWith('•');

      if (isBullet && !inList) {
        // Starting list - ensure blank line before
        if (correctedLines.length > 0 && correctedLines[correctedLines.length - 1].trim() !== '') {
          correctedLines.push('');
        }
        inList = true;
      } else if (!isBullet && inList) {
        // Ending list - ensure blank line after
        if (line.trim() !== '') {
          correctedLines.push('');
        }
        inList = false;
      }

      correctedLines.push(line);
    }

    const corrected = correctedLines.join('\n');

    // Check if correction was needed
    if (corrected !== text) {
      violations.push({
        rule: 'BULLET_SPACING',
        severity: 'info',
        message: 'Added proper spacing around bullet lists',
        autoCorrected: true
      });
    }

    return corrected;
  }

  /**
   * RULE 5: Emphasis
   * Bold text should be 5-10% of total text
   */
  private validateEmphasis(text: string, violations: FormatViolation[]): string {
    const totalText = text.replace(/\*\*/g, '');
    const boldMatches = text.match(/\*\*([^*]+)\*\*/g);

    if (!boldMatches) {
      return text;
    }

    const boldText = boldMatches.join('').replace(/\*\*/g, '');
    const boldPercentage = (boldText.length / totalText.length) * 100;

    if (boldPercentage > 15) {
      violations.push({
        rule: 'EMPHASIS_OVERUSE',
        severity: 'warning',
        message: `Bold text is ${boldPercentage.toFixed(1)}% of total (target: 5-10%)`,
        autoCorrected: false
      });
    } else if (boldPercentage < 3) {
      violations.push({
        rule: 'EMPHASIS_UNDERUSE',
        severity: 'info',
        message: `Bold text is ${boldPercentage.toFixed(1)}% of total (target: 5-10%)`,
        autoCorrected: false
      });
    }

    return text;
  }

  /**
   * RULE 6: Closing
   * Should have "Bottom Line:" section for long responses
   */
  private validateClosing(text: string, violations: FormatViolation[]): string {
    const hasBottomLine = text.includes('**Bottom Line:**') ||
                          text.includes('**Summary:**') ||
                          text.includes('**Conclusion:**');

    if (!hasBottomLine && text.length > 500) {
      violations.push({
        rule: 'CLOSING',
        severity: 'info',
        message: 'Long response missing "Bottom Line:" section',
        autoCorrected: false
      });
    }

    return text;
  }

  /**
   * Calculate formatting statistics
   */
  private calculateStats(text: string): FormatStats {
    const paragraphs = text.split('\n\n').filter(p => !this.isSpecialBlock(p));
    const bullets = (text.match(/•/g) || []).length;
    const boldMatches = text.match(/\*\*([^*]+)\*\*/g) || [];

    const totalText = text.replace(/\*\*/g, '');
    const boldText = boldMatches.join('').replace(/\*\*/g, '');
    const boldPercentage = totalText.length > 0 ? (boldText.length / totalText.length) * 100 : 0;

    let longParagraphs = 0;
    for (const para of paragraphs) {
      const sentences = this.splitIntoSentences(para);
      if (sentences.length > 3) {
        longParagraphs++;
      }
    }

    return {
      totalParagraphs: paragraphs.length,
      longParagraphs,
      totalBullets: bullets,
      totalBoldText: boldMatches.length,
      boldPercentage,
      hasProperSpacing: !text.includes('\n\n\n'),
      hasSectionHeaders: text.includes('**') && text.includes(':**'),
      hasClosing: text.includes('**Bottom Line:**')
    };
  }

  /**
   * Check if block is special (bullet, table, header)
   */
  private isSpecialBlock(text: string): boolean {
    const trimmed = text.trim();
    return (
      trimmed.startsWith('•') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('**') ||
      trimmed.length < 50
    );
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    let processed = text;

    // Protect abbreviations
    const abbreviations = ['e.g.', 'i.e.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Inc.', 'Ltd.', 'Co.', 'etc.', 'vs.', 'approx.', 'est.'];
    const placeholders: Map<string, string> = new Map();

    abbreviations.forEach((abbr, index) => {
      const placeholder = `__ABBR${index}__`;
      placeholders.set(placeholder, abbr);
      processed = processed.replace(new RegExp(abbr.replace(/\./g, '\\.'), 'g'), placeholder);
    });

    // Protect decimals
    processed = processed.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');

    // Split on sentence endings
    const parts = processed.split(/([.!?])\s+(?=[A-Z])|([.!?])$/);
    const sentences: string[] = [];
    let current = '';

    for (const part of parts) {
      if (part === '.' || part === '!' || part === '?') {
        current += part;
        if (current.trim()) {
          sentences.push(current.trim());
        }
        current = '';
      } else if (part) {
        current += part;
      }
    }

    if (current.trim()) {
      sentences.push(current.trim());
    }

    // Restore abbreviations and decimals
    return sentences.map(s => {
      let restored = s;
      placeholders.forEach((abbr, placeholder) => {
        restored = restored.replace(new RegExp(placeholder, 'g'), abbr);
      });
      return restored.replace(/__DOT__/g, '.');
    });
  }

  /**
   * Check if text ends with punctuation
   */
  private endsWithPunctuation(text: string): boolean {
    return /[.!?]$/.test(text.trim());
  }

  /**
   * Get validation report for monitoring
   */
  getValidationReport(result: ValidationResult): string {
    const { violations, stats } = result;

    let report = '\n=== FORMAT VALIDATION REPORT ===\n';
    report += `Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}\n`;
    report += `Violations: ${violations.length}\n\n`;

    if (violations.length > 0) {
      report += 'Issues:\n';
      violations.forEach((v, i) => {
        report += `${i + 1}. [${v.severity.toUpperCase()}] ${v.rule}: ${v.message}\n`;
        if (v.location) {
          report += `   Location: ${v.location}\n`;
        }
        report += `   Auto-corrected: ${v.autoCorrected ? 'Yes' : 'No'}\n`;
      });
      report += '\n';
    }

    report += 'Statistics:\n';
    report += `- Paragraphs: ${stats.totalParagraphs} (${stats.longParagraphs} too long)\n`;
    report += `- Bullets: ${stats.totalBullets}\n`;
    report += `- Bold usage: ${stats.boldPercentage.toFixed(1)}% (target: 5-10%)\n`;
    report += `- Proper spacing: ${stats.hasProperSpacing ? 'Yes' : 'No'}\n`;
    report += `- Section headers: ${stats.hasSectionHeaders ? 'Yes' : 'No'}\n`;
    report += `- Has closing: ${stats.hasClosing ? 'Yes' : 'No'}\n`;
    report += '================================\n';

    return report;
  }

  // ============================================================================
  // LEGACY METHODS (kept for backward compatibility)
  // ============================================================================

  /**
   * Validate a response against format rules (legacy method)
   * Returns LegacyValidationResult interface shape
   */
  validate(response: string, formatType: FormatType = 'GENERAL'): LegacyValidationResult {
    const issues: string[] = [];
    let score = 100;

    // Check for emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu;
    const hasEmojis = emojiRegex.test(response);
    if (hasEmojis) {
      issues.push('Contains emojis');
      score -= 15;
    }

    // Check for citations
    const citationPatterns = [
      /according to (the |your )?(document|file|pdf|report|spreadsheet)/gi,
      /based on (the |your )?(document|file|pdf|report|spreadsheet)/gi,
      /in (the |your )?(document|file|pdf|report)/gi,
      /the (document|file|pdf) (says|states|mentions|shows)/gi,
      /from (the |your )?(document|file|pdf|report)/gi,
    ];
    const hasCitations = citationPatterns.some(p => p.test(response));
    if (hasCitations) {
      issues.push('Contains document citations');
      score -= 15;
    }

    // Check for code blocks
    const hasCodeBlocks = response.includes('```');
    if (hasCodeBlocks) {
      issues.push('Contains code blocks');
      score -= 15;
    }

    // Check bullet format (should use • not - or *)
    const wrongBullets = response.match(/^[\s]*[-*]\s/gm);
    const properBulletsMatch = response.match(/^[\s]*•\s/gm);
    const bulletCount = properBulletsMatch ? properBulletsMatch.length : 0;
    const properBullets = !wrongBullets || wrongBullets.length === 0;

    if (!properBullets) {
      issues.push(`Wrong bullet characters (- or *): ${wrongBullets?.length}`);
      score -= 10;
    }

    // Check for multiple bullets on same line
    const multipleBulletsPerLine = response.match(/•[^•\n]*•/g);
    const properLineBreaks = !multipleBulletsPerLine || multipleBulletsPerLine.length === 0;
    if (!properLineBreaks) {
      issues.push(`Multiple bullets on same line: ${multipleBulletsPerLine?.length}`);
      score -= 10;
    }

    // Check bold format (should use **text** not __text__ or <b>)
    const underscoreBold = response.match(/__[^_]+__/g);
    const htmlBold = response.match(/<b>.*?<\/b>/gi);
    const properBoldFormat = !underscoreBold && !htmlBold;
    if (!properBoldFormat) {
      issues.push('Improper bold formatting');
      score -= 5;
    }

    // Check for table
    const hasTable = response.includes('|') && /\|[\s-]+\|/.test(response);

    // Format-specific checks
    if (formatType === 'TABLE' && !hasTable) {
      issues.push('TABLE format missing Markdown table');
      score -= 20;
    }

    if (formatType === 'DOCUMENT_LIST') {
      const hasFileExtensions = /\.(pdf|docx?|xlsx?|pptx?|txt|md)/gi.test(response);
      if (!hasFileExtensions) {
        issues.push('DOCUMENT_LIST missing file extensions');
        score -= 10;
      }
    }

    if (formatType === 'DIRECT_ANSWER') {
      const firstLine = response.split('\n')[0].trim();
      const fillerPatterns = [
        /^(let me|i'll|i can|i will|here's|here is)/i,
        /^(looking at|based on|according to)/i,
        /^(the answer is|to answer)/i,
      ];
      const hasFiller = fillerPatterns.some(p => p.test(firstLine));
      if (hasFiller) {
        issues.push('DIRECT_ANSWER starts with filler words');
        score -= 10;
      }
    }

    // Calculate grade
    const grade = this.calculateGrade(Math.max(0, score));

    return {
      passed: score >= 70 && issues.filter(i => !i.includes('warning')).length === 0,
      score: Math.max(0, score),
      grade,
      issues,
      details: {
        hasEmojis,
        hasCitations,
        hasCodeBlocks,
        properBullets,
        properBoldFormat,
        properLineBreaks,
        hasTable,
        bulletCount,
        lineCount: response.split('\n').length
      }
    };
  }

  /**
   * Fix common formatting issues in a response (legacy method)
   */
  fixFormatting(response: string): string {
    let fixed = response;

    // 1. Remove emojis
    fixed = this.removeEmojis(fixed);

    // 2. Fix bullet characters (- or * to •)
    fixed = this.fixBullets(fixed);

    // 3. Fix multiple bullets on same line
    fixed = this.fixMultipleBulletsPerLine(fixed);

    // 4. Fix bold formatting (__text__ to **text**)
    fixed = this.fixBoldFormatting(fixed);

    // 5. Remove code blocks
    fixed = this.removeCodeBlocks(fixed);

    // 6. Fix excessive whitespace
    fixed = this.fixExcessiveWhitespace(fixed);

    // 7. Remove trailing whitespace
    fixed = this.removeTrailingWhitespace(fixed);

    return fixed;
  }

  /**
   * Remove all emojis from text
   */
  private removeEmojis(text: string): string {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}\u{2935}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

    return text.replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Fix bullet characters (- or * to •)
   */
  private fixBullets(text: string): string {
    let fixed = text.replace(/^(\s*)[-]\s+/gm, '$1• ');
    fixed = fixed.replace(/^(\s*)\*\s+(?!\*)/gm, '$1• ');
    return fixed;
  }

  /**
   * Fix multiple bullets on same line
   */
  private fixMultipleBulletsPerLine(text: string): string {
    return text.replace(/ • /g, '\n• ');
  }

  /**
   * Fix bold formatting (__text__ to **text**)
   */
  private fixBoldFormatting(text: string): string {
    let fixed = text;
    fixed = fixed.replace(/__([^_]+)__/g, '**$1**');
    fixed = fixed.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    fixed = fixed.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    return fixed;
  }

  /**
   * Remove code blocks
   */
  private removeCodeBlocks(text: string): string {
    return text.replace(/```[\s\S]*?```/g, (match) => {
      const content = match.replace(/```\w*\n?/g, '').trim();
      return content;
    });
  }

  /**
   * Fix excessive whitespace
   */
  private fixExcessiveWhitespace(text: string): string {
    let fixed = text.replace(/\n{3,}/g, '\n\n');
    fixed = fixed.replace(/\n\s*\n(\s*[•\-\*])/g, '\n$1');
    fixed = fixed.replace(/\n\s*\n(\s{2,}[•\-\*])/g, '\n$1');
    return fixed;
  }

  /**
   * Remove trailing whitespace from lines
   */
  private removeTrailingWhitespace(text: string): string {
    return text.split('\n').map(line => line.trimEnd()).join('\n');
  }

  /**
   * Calculate letter grade from score
   */
  private calculateGrade(score: number): string {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 67) return 'D+';
    if (score >= 63) return 'D';
    if (score >= 60) return 'D-';
    return 'F';
  }

  /**
   * Detect format type from query
   */
  detectFormatType(query: string): FormatType {
    const lower = query.toLowerCase();

    if (/compare|comparison|versus|vs\.?|differ|difference|contrast/i.test(lower) ||
        /categorize|categorization|breakdown by|group by/i.test(lower)) {
      return 'TABLE';
    }

    if (/which (documents?|files?|pdfs?)/i.test(lower) ||
        /what (documents?|files?|pdfs?) (mention|contain|have|include)/i.test(lower) ||
        /find (all )?(documents?|files?|pdfs?)/i.test(lower) ||
        /show me (all )?(documents?|files?|pdfs?) (about|related|that)/i.test(lower)) {
      return 'DOCUMENT_LIST';
    }

    if (/^what is the (total|average|sum|count|number|amount|value|price|cost|date|name)/i.test(lower) ||
        /^how (much|many)/i.test(lower) ||
        /^when (is|was|did|does)/i.test(lower) ||
        /^who (is|was|are|were)/i.test(lower) ||
        /calculate|compute/i.test(lower)) {
      return 'DIRECT_ANSWER';
    }

    if (/^list (all|the)/i.test(lower) ||
        /^show (me )?(all|the) (categories|tags|folders|names|items)/i.test(lower) ||
        /^what (categories|tags|folders|names) (do i have|are there)/i.test(lower)) {
      return 'SIMPLE_LIST';
    }

    if (/what (features|capabilities|functions|benefits|advantages)/i.test(lower) ||
        /what (does|can) .+ (do|offer|provide|have)/i.test(lower)) {
      return 'STRUCTURED_LIST';
    }

    if (/summarize|summary|overview|explain|describe|tell me about/i.test(lower) ||
        /what does .+ say about/i.test(lower) ||
        /key (points|findings|metrics|insights)/i.test(lower)) {
      return 'FEATURE_LIST';
    }

    return 'GENERAL';
  }

  /**
   * Generate a detailed validation report (legacy method)
   */
  generateReport(response: string, formatType: FormatType, query: string): string {
    const validation = this.validate(response, formatType);

    let report = '';
    report += '═'.repeat(60) + '\n';
    report += 'KODA FORMAT VALIDATION REPORT\n';
    report += '═'.repeat(60) + '\n\n';

    report += `Format Type: ${formatType}\n`;
    report += `Query: "${query.substring(0, 50)}..."\n\n`;

    report += `SCORE: ${validation.score}/100 (${validation.grade})\n`;
    report += `Status: ${validation.passed ? 'PASS' : 'FAIL'}\n\n`;

    if (validation.issues.length > 0) {
      report += 'ISSUES FOUND:\n';
      validation.issues.forEach((issue: string, i: number) => {
        report += `  ${i + 1}. ${issue}\n`;
      });
      report += '\n';
    }

    report += 'DETAILS:\n';
    report += `  • Bullets: ${validation.details.bulletCount}\n`;
    report += `  • Lines: ${validation.details.lineCount}\n`;
    report += `  • Has Table: ${validation.details.hasTable}\n`;
    report += `  • Proper Bullets: ${validation.details.properBullets}\n`;
    report += `  • Proper Bold: ${validation.details.properBoldFormat}\n`;
    report += `  • Proper Line Breaks: ${validation.details.properLineBreaks}\n`;

    report += '\n' + '═'.repeat(60) + '\n';

    return report;
  }
}

// Export singleton instance
export const formatValidationService = new FormatValidationService();
export default formatValidationService;
