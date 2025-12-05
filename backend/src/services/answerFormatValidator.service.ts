/**
 * Answer Format Validator Service
 *
 * Validates and enforces the Koda answer format based on query complexity.
 *
 * Rules:
 * - Simple queries (greetings, quick questions): NO title, direct answer
 * - Complex queries (data, analysis): Title + structured sections
 */

interface FormatValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  complexity: 'simple' | 'complex';
  metrics: {
    hasTitle: boolean;
    wordCount: number;
    sectionCount: number;
    bulletCount: number;
    blankLineCount: number;
    consecutiveBlankLines: number;
  };
}

class AnswerFormatValidatorService {
  /**
   * Detect query complexity
   */
  detectComplexity(query: string, intent: string): 'simple' | 'complex' {
    // Simple intents that don't need titles
    const simpleIntents = [
      'greeting',
      'capability',
      'clarification',
      'confirmation'
    ];

    if (simpleIntents.includes(intent)) {
      return 'simple';
    }

    // Simple if query is very short (< 5 words)
    const wordCount = query.trim().split(/\s+/).length;
    if (wordCount < 5) {
      return 'simple';
    }

    // Simple if it's a yes/no question
    if (/^(is|are|do|does|can|will|should|has|have)\s/i.test(query)) {
      return 'simple';
    }

    // Otherwise complex
    return 'complex';
  }

  /**
   * Validate answer format
   */
  validate(answer: string, query: string, intent: string): FormatValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const complexity = this.detectComplexity(query, intent);

    // Calculate metrics
    const metrics = this.calculateMetrics(answer);

    // Validate based on complexity
    if (complexity === 'simple') {
      this.validateSimpleFormat(answer, metrics, errors, warnings);
    } else {
      this.validateComplexFormat(answer, metrics, errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      complexity,
      metrics
    };
  }

  /**
   * Calculate answer metrics
   */
  private calculateMetrics(answer: string) {
    const lines = answer.split('\n');
    const words = answer.trim().split(/\s+/).filter(w => w.length > 0);

    // Check for title (starts with # or ##)
    const hasTitle = /^#{1,2}\s+/.test(answer.trim());

    // Count sections (H2 or H3 headers)
    const sectionCount = (answer.match(/^#{2,3}\s+/gm) || []).length;

    // Count bullets
    const bulletCount = (answer.match(/^[•\-\*]\s+/gm) || []).length;

    // Count blank lines
    const blankLineCount = lines.filter(line => line.trim() === '').length;

    // Check for consecutive blank lines
    let maxConsecutiveBlankLines = 0;
    let currentConsecutive = 0;
    for (const line of lines) {
      if (line.trim() === '') {
        currentConsecutive++;
        maxConsecutiveBlankLines = Math.max(maxConsecutiveBlankLines, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return {
      hasTitle,
      wordCount: words.length,
      sectionCount,
      bulletCount,
      blankLineCount,
      consecutiveBlankLines: maxConsecutiveBlankLines
    };
  }

  /**
   * Validate simple format (greetings, quick answers)
   */
  private validateSimpleFormat(
    answer: string,
    metrics: any,
    errors: string[],
    warnings: string[]
  ): void {
    // Simple answers should NOT have title
    if (metrics.hasTitle) {
      errors.push('Simple query should not have a title');
    }

    // Should be short (under 150 words)
    if (metrics.wordCount > 150) {
      warnings.push(`Simple answer is too long (${metrics.wordCount} words, should be under 150)`);
    }

    // Should not have multiple sections
    if (metrics.sectionCount > 1) {
      warnings.push('Simple answer should not have multiple sections');
    }

    // Should be conversational
    if (!this.isConversational(answer)) {
      warnings.push('Simple answer should be conversational');
    }
  }

  /**
   * Validate complex format (data queries, analysis)
   */
  private validateComplexFormat(
    answer: string,
    metrics: any,
    errors: string[],
    warnings: string[]
  ): void {
    // Complex answers SHOULD have title
    if (!metrics.hasTitle) {
      errors.push('Complex query should have a title (## Title)');
    }

    // Should have 2-5 sections
    if (metrics.sectionCount < 2) {
      warnings.push(`Should have at least 2 sections (found ${metrics.sectionCount})`);
    }
    if (metrics.sectionCount > 5) {
      warnings.push(`Too many sections (${metrics.sectionCount}, max 5)`);
    }

    // Should be 200-350 words (default)
    if (metrics.wordCount < 150) {
      warnings.push(`Answer is too short (${metrics.wordCount} words, should be 200-350)`);
    }
    if (metrics.wordCount > 500) {
      warnings.push(`Answer is too long (${metrics.wordCount} words, should be 200-350)`);
    }

    // Check bullet count
    if (metrics.bulletCount > 7) {
      warnings.push(`Too many bullets (${metrics.bulletCount}, max 7 per section)`);
    }

    // Check spacing
    if (metrics.consecutiveBlankLines > 1) {
      errors.push('Multiple consecutive blank lines detected (max 1)');
    }

    // Check for introduction (text before first section)
    if (!this.hasIntroduction(answer)) {
      warnings.push('Should have 1-3 sentence introduction before first section');
    }
  }

  /**
   * Check if answer is conversational
   */
  private isConversational(answer: string): boolean {
    const conversationalPatterns = [
      /^(hello|hi|hey|greetings)/i,
      /I can help/i,
      /I'm|I am/i,
      /you can/i,
      /let me/i,
      /\?$/m // Ends with question
    ];

    return conversationalPatterns.some(pattern => pattern.test(answer));
  }

  /**
   * Check if answer has introduction
   */
  private hasIntroduction(answer: string): boolean {
    // Introduction is text before first ## header
    const firstSectionMatch = answer.match(/^#{2,3}\s+/m);
    if (!firstSectionMatch) return false;

    const beforeFirstSection = answer.substring(0, firstSectionMatch.index);
    const sentences = beforeFirstSection.split(/[.!?]+/).filter(s => s.trim().length > 10);

    return sentences.length >= 1 && sentences.length <= 3;
  }

  /**
   * Auto-fix common formatting issues
   */
  autoFix(answer: string, complexity: 'simple' | 'complex'): string {
    let fixed = answer;

    // Fix 1: Remove multiple consecutive blank lines
    fixed = fixed.replace(/\n{3,}/g, '\n\n');

    // Fix 2: Ensure blank line before bullets
    fixed = fixed.replace(/([^\n])\n([•\-\*]\s)/g, '$1\n\n$2');

    // Fix 3: Ensure blank line after bullets
    fixed = fixed.replace(/([•\-\*]\s[^\n]+)\n([^•\-\*\n])/g, '$1\n\n$2');

    // Fix 4: Ensure blank line before sections
    fixed = fixed.replace(/([^\n])\n(#{2,3}\s)/g, '$1\n\n$2');

    // Fix 5: Ensure blank line after sections
    fixed = fixed.replace(/(#{2,3}\s[^\n]+)\n([^#\n])/g, '$1\n\n$2');

    // Fix 6: Convert * and - bullets to •
    fixed = fixed.replace(/\n\*\s/g, '\n• ');
    fixed = fixed.replace(/\n-\s/g, '\n• ');

    // Fix 7: Remove title if simple query
    if (complexity === 'simple') {
      fixed = fixed.replace(/^#{1,2}\s+[^\n]+\n+/, '');
    }

    // Fix 8: Trim trailing whitespace
    fixed = fixed.trim();

    return fixed;
  }

  /**
   * Generate format report
   */
  generateReport(result: FormatValidationResult): string {
    const lines: string[] = [];

    lines.push('═'.repeat(70));
    lines.push('📋 ANSWER FORMAT VALIDATION REPORT');
    lines.push('═'.repeat(70));
    lines.push('');

    // Status
    if (result.isValid) {
      lines.push('✅ STATUS: VALID');
    } else {
      lines.push('❌ STATUS: INVALID');
    }
    lines.push('');

    // Complexity
    lines.push(`🎯 COMPLEXITY: ${result.complexity.toUpperCase()}`);
    lines.push('');

    // Metrics
    lines.push('📊 METRICS:');
    lines.push(`   Has Title: ${result.metrics.hasTitle ? '✅' : '❌'}`);
    lines.push(`   Word Count: ${result.metrics.wordCount}`);
    lines.push(`   Section Count: ${result.metrics.sectionCount}`);
    lines.push(`   Bullet Count: ${result.metrics.bulletCount}`);
    lines.push(`   Blank Lines: ${result.metrics.blankLineCount}`);
    lines.push(`   Consecutive Blank Lines: ${result.metrics.consecutiveBlankLines}`);
    lines.push('');

    // Errors
    if (result.errors.length > 0) {
      lines.push('❌ ERRORS:');
      result.errors.forEach(error => {
        lines.push(`   • ${error}`);
      });
      lines.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      lines.push('⚠️  WARNINGS:');
      result.warnings.forEach(warning => {
        lines.push(`   • ${warning}`);
      });
      lines.push('');
    }

    // Expected format
    lines.push('📋 EXPECTED FORMAT:');
    if (result.complexity === 'simple') {
      lines.push('   • NO title');
      lines.push('   • Direct answer (1-3 sentences)');
      lines.push('   • Under 150 words');
      lines.push('   • Conversational tone');
    } else {
      lines.push('   • Title (## Title)');
      lines.push('   • Introduction (1-3 sentences)');
      lines.push('   • 2-5 main sections (### Section)');
      lines.push('   • 200-350 words');
      lines.push('   • 1 blank line between sections');
      lines.push('   • Max 7 bullets per section');
    }

    lines.push('═'.repeat(70));

    return lines.join('\n');
  }
}

export default new AnswerFormatValidatorService();
