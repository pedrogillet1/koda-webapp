/**
 * KODA FORMAT VALIDATION SERVICE
 *
 * Validates and fixes response formatting:
 * - Bullet points (must use •)
 * - Bold text (must use **text**)
 * - No emojis, citations, or code blocks
 * - Proper line breaks and spacing
 *
 * Also provides post-processing to fix common formatting issues.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
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

export type FormatType =
  | 'FEATURE_LIST'      // Comprehensive overview queries
  | 'STRUCTURED_LIST'   // Specific attribute queries with closing
  | 'DOCUMENT_LIST'     // "Which documents mention X?"
  | 'TABLE'             // Comparison/categorization queries
  | 'DIRECT_ANSWER'     // Factual queries with breakdown
  | 'SIMPLE_LIST'       // Entity extraction queries
  | 'GENERAL';          // Default format

// ============================================================================
// FORMAT VALIDATOR
// ============================================================================

class FormatValidationService {

  /**
   * Validate a response against format rules
   */
  validate(response: string, formatType: FormatType = 'GENERAL'): ValidationResult {
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
   * Fix common formatting issues in a response
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
    // Comprehensive emoji regex
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}\u{2935}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

    return text.replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Fix bullet characters (- or * to •)
   */
  private fixBullets(text: string): string {
    // Replace - bullets at start of line with •
    let fixed = text.replace(/^(\s*)[-]\s+/gm, '$1• ');

    // Replace * bullets at start of line with • (but not bold **)
    fixed = fixed.replace(/^(\s*)\*\s+(?!\*)/gm, '$1• ');

    return fixed;
  }

  /**
   * Fix multiple bullets on same line
   */
  private fixMultipleBulletsPerLine(text: string): string {
    // Split bullets that are on the same line
    return text.replace(/ • /g, '\n• ');
  }

  /**
   * Fix bold formatting (__text__ to **text**)
   */
  private fixBoldFormatting(text: string): string {
    let fixed = text;

    // Replace __text__ with **text**
    fixed = fixed.replace(/__([^_]+)__/g, '**$1**');

    // Replace <b>text</b> with **text**
    fixed = fixed.replace(/<b>(.*?)<\/b>/gi, '**$1**');

    // Replace <strong>text</strong> with **text**
    fixed = fixed.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');

    return fixed;
  }

  /**
   * Remove code blocks
   */
  private removeCodeBlocks(text: string): string {
    // Remove code blocks but keep the content
    return text.replace(/```[\s\S]*?```/g, (match) => {
      // Extract content between ``` markers
      const content = match.replace(/```\w*\n?/g, '').trim();
      return content;
    });
  }

  /**
   * Fix excessive whitespace - compress multiple blank lines
   * Keeps max 1 blank line between paragraphs
   */
  private fixExcessiveWhitespace(text: string): string {
    // Replace 3+ newlines with 2 (max 1 blank line)
    let fixed = text.replace(/\n{3,}/g, '\n\n');

    // Remove blank lines inside lists (between bullet points)
    // Pattern: newline + whitespace-only line + newline + bullet
    fixed = fixed.replace(/\n\s*\n(\s*[•\-\*])/g, '\n$1');

    // Remove blank lines between nested list items
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

    // TABLE format - comparison queries
    if (
      /compare|comparison|versus|vs\.?|differ|difference|contrast/i.test(lower) ||
      /categorize|categorization|breakdown by|group by/i.test(lower)
    ) {
      return 'TABLE';
    }

    // DOCUMENT_LIST format - document search queries
    if (
      /which (documents?|files?|pdfs?)/i.test(lower) ||
      /what (documents?|files?|pdfs?) (mention|contain|have|include)/i.test(lower) ||
      /find (all )?(documents?|files?|pdfs?)/i.test(lower) ||
      /show me (all )?(documents?|files?|pdfs?) (about|related|that)/i.test(lower)
    ) {
      return 'DOCUMENT_LIST';
    }

    // DIRECT_ANSWER format - factual queries
    if (
      /^what is the (total|average|sum|count|number|amount|value|price|cost|date|name)/i.test(lower) ||
      /^how (much|many)/i.test(lower) ||
      /^when (is|was|did|does)/i.test(lower) ||
      /^who (is|was|are|were)/i.test(lower) ||
      /calculate|compute/i.test(lower)
    ) {
      return 'DIRECT_ANSWER';
    }

    // SIMPLE_LIST format - entity extraction
    if (
      /^list (all|the)/i.test(lower) ||
      /^show (me )?(all|the) (categories|tags|folders|names|items)/i.test(lower) ||
      /^what (categories|tags|folders|names) (do i have|are there)/i.test(lower)
    ) {
      return 'SIMPLE_LIST';
    }

    // STRUCTURED_LIST format - feature/capability queries
    if (
      /what (features|capabilities|functions|benefits|advantages)/i.test(lower) ||
      /what (does|can) .+ (do|offer|provide|have)/i.test(lower)
    ) {
      return 'STRUCTURED_LIST';
    }

    // FEATURE_LIST format - comprehensive queries
    if (
      /summarize|summary|overview|explain|describe|tell me about/i.test(lower) ||
      /what does .+ say about/i.test(lower) ||
      /key (points|findings|metrics|insights)/i.test(lower)
    ) {
      return 'FEATURE_LIST';
    }

    return 'GENERAL';
  }

  /**
   * Generate a detailed validation report
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
      validation.issues.forEach((issue, i) => {
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
