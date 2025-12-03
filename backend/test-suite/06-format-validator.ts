#!/usr/bin/env ts-node

/**
 * Koda Format Structure Validator
 *
 * This script analyzes Koda's outputs to ensure they follow best practices for:
 * - Bullet point usage (2-3 lines each)
 * - Paragraph length (3-5 sentences)
 * - Heading structure
 * - Overall readability
 * - Markdown formatting
 */

interface FormatAnalysis {
  score: number;
  issues: string[];
  warnings: string[];
  suggestions: string[];
  metrics: {
    totalLines: number;
    totalWords: number;
    totalBullets: number;
    totalParagraphs: number;
    totalHeadings: number;
    avgBulletLength: number;
    avgParagraphLength: number;
    bulletLengthDistribution: { short: number; good: number; long: number };
    paragraphLengthDistribution: { short: number; good: number; long: number };
  };
}

class FormatValidator {

  /**
   * Main validation function
   */
  validate(text: string, context?: { queryType?: string; documentSize?: number }): FormatAnalysis {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Extract metrics
    const metrics = this.extractMetrics(text);

    // Run all checks
    this.checkBulletPoints(text, metrics, issues, warnings, suggestions);
    this.checkParagraphs(text, metrics, issues, warnings, suggestions);
    this.checkHeadings(text, metrics, issues, warnings, suggestions);
    this.checkMarkdownUsage(text, issues, warnings, suggestions);
    this.checkRoboticPatterns(text, issues, warnings);
    this.checkReadability(text, metrics, issues, warnings, suggestions);

    // Context-specific checks
    if (context) {
      this.checkContextAppropriate(text, metrics, context, issues, warnings, suggestions);
    }

    // Calculate score
    const score = this.calculateScore(issues, warnings, metrics);

    return {
      score,
      issues,
      warnings,
      suggestions,
      metrics
    };
  }

  /**
   * Extract all metrics from text
   */
  private extractMetrics(text: string) {
    const lines = text.split('\n');
    const words = text.split(/\s+/).filter(w => w.length > 0);

    // Extract bullets
    const bulletLines = lines.filter(line => /^[\s]*[•\-\*]\s+/.test(line));
    const bullets = this.groupBullets(bulletLines);

    // Extract paragraphs (non-empty, non-heading, non-bullet lines)
    const paragraphLines = lines.filter(line =>
      line.trim().length > 0 &&
      !/^[\s]*[•\-\*]\s+/.test(line) &&
      !/^#{1,6}\s+/.test(line)
    );
    const paragraphs = this.groupParagraphs(paragraphLines);

    // Extract headings
    const headings = lines.filter(line => /^#{1,6}\s+/.test(line));

    // Calculate bullet length distribution
    const bulletLengths = bullets.map(b => this.countLines(b));
    const bulletDist = {
      short: bulletLengths.filter(l => l === 1).length,
      good: bulletLengths.filter(l => l >= 2 && l <= 3).length,
      long: bulletLengths.filter(l => l > 3).length
    };

    // Calculate paragraph length distribution
    const paragraphLengths = paragraphs.map(p => this.countSentences(p));
    const paragraphDist = {
      short: paragraphLengths.filter(l => l < 3).length,
      good: paragraphLengths.filter(l => l >= 3 && l <= 5).length,
      long: paragraphLengths.filter(l => l > 5).length
    };

    return {
      totalLines: lines.length,
      totalWords: words.length,
      totalBullets: bullets.length,
      totalParagraphs: paragraphs.length,
      totalHeadings: headings.length,
      avgBulletLength: bulletLengths.length > 0 ? bulletLengths.reduce((a, b) => a + b, 0) / bulletLengths.length : 0,
      avgParagraphLength: paragraphLengths.length > 0 ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length : 0,
      bulletLengthDistribution: bulletDist,
      paragraphLengthDistribution: paragraphDist
    };
  }

  /**
   * Group bullet lines into individual bullets
   */
  private groupBullets(bulletLines: string[]): string[] {
    const bullets: string[] = [];
    let currentBullet = '';

    for (const line of bulletLines) {
      if (/^[\s]*[•\-\*]\s+/.test(line)) {
        if (currentBullet) {
          bullets.push(currentBullet);
        }
        currentBullet = line;
      } else {
        currentBullet += '\n' + line;
      }
    }

    if (currentBullet) {
      bullets.push(currentBullet);
    }

    return bullets;
  }

  /**
   * Group lines into paragraphs
   */
  private groupParagraphs(lines: string[]): string[] {
    const paragraphs: string[] = [];
    let currentParagraph = '';

    for (const line of lines) {
      if (line.trim().length === 0) {
        if (currentParagraph) {
          paragraphs.push(currentParagraph);
          currentParagraph = '';
        }
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + line.trim();
      }
    }

    if (currentParagraph) {
      paragraphs.push(currentParagraph);
    }

    return paragraphs;
  }

  /**
   * Count lines in text
   */
  private countLines(text: string): number {
    return text.split('\n').filter(l => l.trim().length > 0).length;
  }

  /**
   * Count sentences in text
   */
  private countSentences(text: string): number {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  }

  /**
   * Check bullet point usage
   */
  private checkBulletPoints(text: string, metrics: any, issues: string[], warnings: string[], suggestions: string[]) {
    const lines = text.split('\n');
    const bulletLines = lines.filter(line => /^[\s]*[•\-\*]\s+/.test(line));

    // Check if using bullets at all
    if (metrics.totalBullets === 0 && metrics.totalWords > 100) {
      suggestions.push('Consider using bullet points to organize key information for better scannability');
    }

    // Check for excessive bullets (ChatGPT problem)
    const bulletRatio = metrics.totalBullets / Math.max(metrics.totalParagraphs, 1);
    if (bulletRatio > 2) {
      issues.push(`EXCESSIVE BULLETS: ${metrics.totalBullets} bullets vs ${metrics.totalParagraphs} paragraphs (ratio: ${bulletRatio.toFixed(1)}). This is the ChatGPT problem - overusing bullets breaks narrative flow.`);
    }

    // Check bullet length distribution
    const { short, good, long } = metrics.bulletLengthDistribution;

    if (short > good + long) {
      warnings.push(`Too many SHORT bullets (${short}/${metrics.totalBullets}). Bullets should be 2-3 lines with context, not just single words.`);
    }

    if (long > good) {
      issues.push(`Too many LONG bullets (${long}/${metrics.totalBullets}). Bullets should be 2-3 lines max, not full paragraphs.`);
    }

    if (good > 0) {
      suggestions.push(`Good bullet usage: ${good}/${metrics.totalBullets} bullets are the ideal 2-3 line length. Keep this up!`);
    }

    // Check for single-item bullets
    const bulletSections = this.findBulletSections(text);
    for (const section of bulletSections) {
      if (section.count === 1) {
        warnings.push(`Found a single bullet point. If there's only one item, use a paragraph instead.`);
      }
    }

    // Check for missing bold in bullets
    for (const line of bulletLines) {
      if (!/\*\*/.test(line)) {
        warnings.push(`Bullet without bold key term: "${line.substring(0, 50)}...". Consider bolding the main concept.`);
      }
    }
  }

  /**
   * Find bullet sections
   */
  private findBulletSections(text: string): Array<{ count: number; lines: string[] }> {
    const lines = text.split('\n');
    const sections: Array<{ count: number; lines: string[] }> = [];
    let currentSection: string[] = [];

    for (const line of lines) {
      if (/^[\s]*[•\-\*]\s+/.test(line)) {
        currentSection.push(line);
      } else if (currentSection.length > 0) {
        sections.push({ count: currentSection.length, lines: currentSection });
        currentSection = [];
      }
    }

    if (currentSection.length > 0) {
      sections.push({ count: currentSection.length, lines: currentSection });
    }

    return sections;
  }

  /**
   * Check paragraph usage
   */
  private checkParagraphs(text: string, metrics: any, issues: string[], warnings: string[], suggestions: string[]) {
    // Check for dense paragraphs (Gemini problem)
    if (metrics.totalParagraphs > 0 && metrics.totalBullets === 0 && metrics.totalWords > 200) {
      warnings.push('DENSE TEXT: All paragraphs, no structure. This is the Gemini problem - hard to scan.');
    }

    // Check paragraph length distribution
    const { short, good, long } = metrics.paragraphLengthDistribution;

    if (long > good) {
      issues.push(`Too many LONG paragraphs (${long}/${metrics.totalParagraphs}). Paragraphs should be 3-5 sentences max.`);
    }

    if (short > good && metrics.totalParagraphs > 3) {
      warnings.push(`Many SHORT paragraphs (${short}/${metrics.totalParagraphs}). Consider combining related ideas.`);
    }

    if (good > 0) {
      suggestions.push(`Good paragraph usage: ${good}/${metrics.totalParagraphs} paragraphs are the ideal 3-5 sentence length.`);
    }
  }

  /**
   * Check heading usage
   */
  private checkHeadings(text: string, metrics: any, issues: string[], warnings: string[], suggestions: string[]) {
    const lines = text.split('\n');
    const headings = lines.filter(line => /^#{1,6}\s+/.test(line));

    // Check if long text lacks headings
    if (metrics.totalWords > 300 && metrics.totalHeadings === 0) {
      suggestions.push('Long response (300+ words) without headings. Consider adding section headings for better organization.');
    }

    // Check for excessive headings
    if (metrics.totalHeadings > metrics.totalParagraphs) {
      warnings.push(`Too many headings (${metrics.totalHeadings}) for the amount of content. Use headings sparingly.`);
    }

    // Check heading levels
    for (const heading of headings) {
      const level = heading.match(/^(#{1,6})/)?.[1].length || 0;
      if (level === 1) {
        warnings.push(`Using # (H1) heading. Use ## (H2) or ### (H3) instead - H1 is typically for document titles only.`);
      }
      if (level > 3) {
        warnings.push(`Using #### (H4+) heading. Keep heading hierarchy simple - use ## or ### only.`);
      }
    }
  }

  /**
   * Check markdown usage
   */
  private checkMarkdownUsage(text: string, issues: string[], warnings: string[], suggestions: string[]) {
    // Check for emojis (unprofessional)
    // ES5-compatible emoji detection
    const hasEmoji = this.containsEmoji(text);
    if (hasEmoji) {
      issues.push('EMOJIS DETECTED: Emojis are unprofessional for a document assistant. Remove them.');
    }

    // Check for excessive bold
    const boldCount = (text.match(/\*\*/g) || []).length / 2;
    const wordCount = text.split(/\s+/).length;
    if (boldCount > wordCount * 0.2) {
      warnings.push('Too much bold text. Bold should be used sparingly for emphasis only.');
    }

    // Check for tables
    const hasTable = /\|.*\|/.test(text);
    if (hasTable) {
      suggestions.push('Table detected - good for structured data!');
    }

    // Check for code blocks (should be rare)
    const hasCodeBlock = /```/.test(text);
    if (hasCodeBlock) {
      warnings.push('Code block detected. Only use code blocks for actual code, not for formatting.');
    }
  }

  /**
   * ES5-compatible emoji detection
   */
  private containsEmoji(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // Check for surrogate pairs (emojis are typically in surrogate pair range)
      if (code >= 0xD800 && code <= 0xDBFF) {
        return true;
      }
      // Also check for some common single-char symbols used as emoji
      if (code >= 0x2600 && code <= 0x27BF) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for robotic patterns
   */
  private checkRoboticPatterns(text: string, issues: string[], warnings: string[]) {
    const roboticPhrases = [
      'Based on the provided context',
      'According to the document',
      'The aforementioned',
      'Please be advised that',
      'It is important to note that',
      'In conclusion, it can be stated',
      'As per the information',
      'With regard to',
      'In reference to',
      'Pursuant to'
    ];

    for (const phrase of roboticPhrases) {
      if (text.includes(phrase)) {
        issues.push(`ROBOTIC PHRASE: "${phrase}" - Use more natural language.`);
      }
    }

    // Check for formal labels
    const formalLabels = ['Next step:', 'Tip:', 'Note:', 'Important:', 'Warning:'];
    for (const label of formalLabels) {
      if (text.includes(label)) {
        warnings.push(`Formal label "${label}" detected. Consider more conversational phrasing.`);
      }
    }
  }

  /**
   * Check readability
   */
  private checkReadability(text: string, metrics: any, issues: string[], warnings: string[], suggestions: string[]) {
    // Check if text is scannable (5-second rule)
    const hasClearStructure = metrics.totalHeadings > 0 || metrics.totalBullets > 0;
    if (metrics.totalWords > 100 && !hasClearStructure) {
      warnings.push('HARD TO SCAN: Long text without headings or bullets. Users should be able to scan in 5 seconds.');
    }

    // Check for wall of text
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    let consecutiveTextLines = 0;
    let maxConsecutive = 0;

    for (const line of lines) {
      if (!/^[\s]*[•\-\*#]/.test(line)) {
        consecutiveTextLines++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveTextLines);
      } else {
        consecutiveTextLines = 0;
      }
    }

    if (maxConsecutive > 10) {
      issues.push(`WALL OF TEXT: ${maxConsecutive} consecutive lines without structure. Break it up!`);
    }
  }

  /**
   * Check if format is appropriate for context
   */
  private checkContextAppropriate(text: string, metrics: any, context: any, issues: string[], warnings: string[], suggestions: string[]) {
    const { queryType, documentSize } = context;

    // Check length appropriateness
    if (documentSize) {
      const expectedLength = this.getExpectedLength(documentSize);
      if (metrics.totalWords < expectedLength.min) {
        warnings.push(`Response too short for ${documentSize}-page document. Expected ${expectedLength.min}-${expectedLength.max} words, got ${metrics.totalWords}.`);
      }
      if (metrics.totalWords > expectedLength.max) {
        warnings.push(`Response too long for ${documentSize}-page document. Expected ${expectedLength.min}-${expectedLength.max} words, got ${metrics.totalWords}.`);
      }
    }

    // Check format appropriateness for query type
    if (queryType === 'capabilities' && metrics.totalBullets === 0) {
      issues.push('CAPABILITIES query should use bullet points to list features.');
    }

    if (queryType === 'file_listing' && !/\n[\s]*[•\-\*]/.test(text)) {
      issues.push('FILE LISTING should include a formatted list of files.');
    }

    if (queryType === 'greeting' && metrics.totalWords > 20) {
      warnings.push('GREETING should be short and conversational (under 20 words).');
    }
  }

  /**
   * Get expected word count range for document size
   */
  private getExpectedLength(pages: number): { min: number; max: number } {
    if (pages <= 5) return { min: 80, max: 150 };
    if (pages <= 30) return { min: 200, max: 350 };
    if (pages <= 100) return { min: 400, max: 600 };
    return { min: 600, max: 800 };
  }

  /**
   * Calculate overall score
   */
  private calculateScore(issues: string[], warnings: string[], metrics: any): number {
    let score = 100;

    // Deduct for issues
    score -= issues.length * 10;

    // Deduct for warnings
    score -= warnings.length * 5;

    // Bonus for good metrics
    if (metrics.bulletLengthDistribution.good > metrics.bulletLengthDistribution.short + metrics.bulletLengthDistribution.long) {
      score += 5;
    }

    if (metrics.paragraphLengthDistribution.good > metrics.paragraphLengthDistribution.long) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate report
   */
  generateReport(analysis: FormatAnalysis, outputName: string = 'Unknown'): string {
    let report = `\n${'='.repeat(80)}\n`;
    report += `FORMAT STRUCTURE ANALYSIS: ${outputName}\n`;
    report += `${'='.repeat(80)}\n\n`;

    // Score
    const scoreEmoji = analysis.score >= 80 ? '[PASS]' : analysis.score >= 60 ? '[WARN]' : '[FAIL]';
    report += `OVERALL SCORE: ${scoreEmoji} ${analysis.score}/100\n\n`;

    // Metrics
    report += `METRICS:\n`;
    report += `  Total Words: ${analysis.metrics.totalWords}\n`;
    report += `  Total Lines: ${analysis.metrics.totalLines}\n`;
    report += `  Paragraphs: ${analysis.metrics.totalParagraphs} (avg ${analysis.metrics.avgParagraphLength.toFixed(1)} sentences)\n`;
    report += `  Bullets: ${analysis.metrics.totalBullets} (avg ${analysis.metrics.avgBulletLength.toFixed(1)} lines)\n`;
    report += `  Headings: ${analysis.metrics.totalHeadings}\n\n`;

    // Bullet distribution
    if (analysis.metrics.totalBullets > 0) {
      report += `BULLET LENGTH DISTRIBUTION:\n`;
      report += `  Short (1 line): ${analysis.metrics.bulletLengthDistribution.short}\n`;
      report += `  Good (2-3 lines): ${analysis.metrics.bulletLengthDistribution.good} [GOOD]\n`;
      report += `  Long (4+ lines): ${analysis.metrics.bulletLengthDistribution.long}\n\n`;
    }

    // Paragraph distribution
    if (analysis.metrics.totalParagraphs > 0) {
      report += `PARAGRAPH LENGTH DISTRIBUTION:\n`;
      report += `  Short (<3 sentences): ${analysis.metrics.paragraphLengthDistribution.short}\n`;
      report += `  Good (3-5 sentences): ${analysis.metrics.paragraphLengthDistribution.good} [GOOD]\n`;
      report += `  Long (6+ sentences): ${analysis.metrics.paragraphLengthDistribution.long}\n\n`;
    }

    // Issues
    if (analysis.issues.length > 0) {
      report += `[ISSUES] (${analysis.issues.length}):\n`;
      analysis.issues.forEach((issue, i) => {
        report += `  ${i + 1}. ${issue}\n`;
      });
      report += `\n`;
    }

    // Warnings
    if (analysis.warnings.length > 0) {
      report += `[WARNINGS] (${analysis.warnings.length}):\n`;
      analysis.warnings.forEach((warning, i) => {
        report += `  ${i + 1}. ${warning}\n`;
      });
      report += `\n`;
    }

    // Suggestions
    if (analysis.suggestions.length > 0) {
      report += `[SUGGESTIONS] (${analysis.suggestions.length}):\n`;
      analysis.suggestions.forEach((suggestion, i) => {
        report += `  ${i + 1}. ${suggestion}\n`;
      });
      report += `\n`;
    }

    // Summary
    if (analysis.score >= 80) {
      report += `[EXCELLENT] This output follows formatting best practices!\n`;
    } else if (analysis.score >= 60) {
      report += `[GOOD] This output is decent but has room for improvement.\n`;
    } else {
      report += `[NEEDS WORK] This output has significant formatting issues.\n`;
    }

    report += `${'='.repeat(80)}\n`;

    return report;
  }
}

// Example usage and test cases
if (require.main === module) {
  const validator = new FormatValidator();

  console.log('Koda Format Structure Validator\n');
  console.log('Testing with example outputs...\n');

  // Test 1: Good format
  const goodExample = `This document discusses the Shapley allocation method for risk management in financial institutions.

**Key Findings:**
• **Optimal balance** - The Shapley method offers the best combination of simplicity and mathematical rigor for risk allocation.
• **Scalability proven** - The method remains efficient even with many business units when using Monte Carlo simulation.
• **Broad applicability** - While focused on market risk, the framework applies to credit, liquidity, and counterparty risk.

The research validates this approach through both theoretical analysis and practical testing under Basel 2.5 and FRTB regulations.`;

  const analysis1 = validator.validate(goodExample, { queryType: 'answer', documentSize: 25 });
  console.log(validator.generateReport(analysis1, 'Good Example'));

  // Test 2: ChatGPT problem (too many bullets)
  const chatgptProblem = `Here's what I found:

• Point 1
• Point 2
• Point 3
• Point 4
• Point 5
• Point 6
• Point 7
• Point 8

Let me know if you need more information.`;

  const analysis2 = validator.validate(chatgptProblem);
  console.log(validator.generateReport(analysis2, 'ChatGPT Problem (Excessive Bullets)'));

  // Test 3: Gemini problem (dense paragraphs)
  const geminiProblem = `This is a very long paragraph that goes on and on without any structure or organization making it very difficult to read and scan for key information because everything is just crammed together in one big block of text. The document discusses many important concepts including risk management, financial regulations, and allocation strategies, but without any formatting or structure it's hard to identify what's important. The reader has to work very hard to extract the key points from this dense wall of text which is not a good user experience and makes the information much less accessible than it should be.`;

  const analysis3 = validator.validate(geminiProblem);
  console.log(validator.generateReport(analysis3, 'Gemini Problem (Dense Text)'));

  // Test 4: Robotic response
  const roboticExample = `Based on the provided context, according to the document, it is important to note that the aforementioned methodology demonstrates significant advantages. Please be advised that further analysis is required.`;

  const analysis4 = validator.validate(roboticExample);
  console.log(validator.generateReport(analysis4, 'Robotic Response'));

  // Test 5: Real Koda-style response
  const kodaExample = `Your document "Q4 Financial Report" covers the company's performance from October through December 2024.

**Key Highlights:**
• **Revenue growth** - Total revenue increased 15% year-over-year, driven primarily by expansion in the European market and new enterprise contracts.
• **Cost optimization** - Operating expenses decreased 8% through strategic vendor consolidation and automation initiatives.
• **Market position** - The company maintained its #2 position in market share while improving customer retention to 94%.

The report indicates strong fundamentals heading into 2025, with particular emphasis on the technology investments made during Q3.`;

  const analysis5 = validator.validate(kodaExample, { queryType: 'answer', documentSize: 15 });
  console.log(validator.generateReport(analysis5, 'Koda-Style Response'));

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n  1. Good Example:      ${analysis1.score}/100`);
  console.log(`  2. ChatGPT Problem:   ${analysis2.score}/100`);
  console.log(`  3. Gemini Problem:    ${analysis3.score}/100`);
  console.log(`  4. Robotic Response:  ${analysis4.score}/100`);
  console.log(`  5. Koda-Style:        ${analysis5.score}/100`);

  const avgScore = (analysis1.score + analysis2.score + analysis3.score + analysis4.score + analysis5.score) / 5;
  console.log(`\n  Average Score: ${avgScore.toFixed(1)}/100`);

  if (analysis1.score >= 80 && analysis5.score >= 80) {
    console.log('\n  [PASS] Good formatting patterns score well!');
  }
  if (analysis2.score < 70 && analysis3.score < 70 && analysis4.score < 70) {
    console.log('  [PASS] Bad patterns are correctly detected!');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

export { FormatValidator, FormatAnalysis };
