import { smartProcessSpacing } from '../utils/markdownSpacing';

/**
 * ============================================================================
 * KODA FORMAT ENFORCEMENT SERVICE V2
 * ============================================================================
 *
 * PURPOSE: Enforce exact format specification from koda_answer_format.json
 *
 * ENFORCES:
 * - Title (1 line, title case, optional emoji)
 * - Introduction (1-3 sentences, max 60 words, 1 paragraph)
 * - Main sections (2-5 sections, H2/H3 headers)
 * - Proper spacing (1 blank line between sections, no multiple consecutive)
 * - Bold/italic usage (key terms, quotes, emphasis)
 * - Length rules (200-350 words default, adaptive)
 * - Tone (helpful, calm, professional, precise)
 * - Closing statement (optional, contextual)
 * - Smart pagination for large file lists (20+ items)
 *
 * AVOIDS:
 * - Rambling, repetition, filler phrases
 * - Excess emojis
 * - Multiple consecutive blank lines
 * - Default repeated greetings
 * - Massive file lists (uses pagination)
 */

interface FormatSpec {
  title: {
    required: boolean;
    max_length: string;
    capitalization: string;
    emoji_usage: string;
    spacing_after: string;
  };
  introduction: {
    sentences: string;
    max_words: number;
    paragraphs: number;
    bullets_allowed: boolean;
    tone: string;
    spacing_after: string;
  };
  main_sections: {
    min_sections: number;
    max_sections: number;
  };
  length_rules: {
    default_answer_word_count: string;
    detailed_answer_word_count: string;
    short_answer_word_count: string;
  };
  spacing_rules: {
    between_sections: string;
    between_paragraphs: string;
    before_bullet_lists: string;
    after_bullet_lists: string;
    forbidden: string[];
  };
  tone: {
    style: string[];
    avoid: string[];
  };
}

interface FormatViolation {
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
}

interface FormatResult {
  fixedText: string;
  violations: FormatViolation[];
}

interface FileItem {
  name: string;
  size: string;
  type?: string;
  date?: string;
  path?: string;
  [key: string]: any;
}

interface FileSummary {
  totalCount: number;
  totalSize: string;
  byType: Record<string, { count: number; size: string }>;
  byFolder?: Record<string, number>;
}

/**
 * Title formatting decision based on query complexity
 */
type TitleDecision = 'none' | 'single' | 'structured';

/**
 * Context for smart title decisions
 */
interface TitleContext {
  query?: string;
  responseWordCount: number;
  isConversational: boolean;
  isSimpleQuestion: boolean;
  isMultiPartQuestion: boolean;
  requiresStructure: boolean;
}

export class KodaFormatEnforcementService {

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * SMART TITLE DECISION SYSTEM
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * NO TITLE for:
   * - Simple one-sentence answers
   * - Direct instructions without complexity
   * - Casual conversational questions (greetings, "how are you")
   * - Yes/No or short factual answers
   * - Responses under ~100 words
   *
   * SINGLE TITLE for:
   * - Medium explanations (100-300 words)
   * - Guides with limited steps
   * - Comparisons
   * - Short breakdowns
   *
   * TITLE + SUBTITLES for:
   * - Complex explanations (300+ words)
   * - Multi-part questions
   * - Strategy/planning/business content
   * - Long step-by-step guides
   * - Deep explanations with examples
   */

  /**
   * Detect query complexity and determine title formatting
   *
   * STRICT RULES:
   * - NO TITLE: Greetings, simple questions, file actions, short responses (<100 words)
   * - SINGLE TITLE: Medium explanations (100-400 words)
   * - STRUCTURED: Complex requests, multi-part questions (400+ words)
   */
  detectTitleDecision(query: string, response: string): TitleDecision {
    const queryLower = query.toLowerCase().trim();
    const responseWordCount = response.split(/\s+/).filter(w => w.trim()).length;

    console.log(`[TITLE DECISION] Query: "${query.substring(0, 50)}..." | Response words: ${responseWordCount}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // RULE 1: NO TITLE patterns (STRICT)
    // ═══════════════════════════════════════════════════════════════════════════

    // File action queries - NEVER get titles
    const fileActionPatterns = [
      /^(show|find|search|locate|where is|list|get|open|display)\s+(me\s+)?(my\s+)?(the\s+)?[\w\s]+\.(pdf|docx?|xlsx?|pptx?|txt|png|jpe?g|gif|html?|csv)/i,
      /^(show|find|search|locate|where is|list|get|open|display)\s+(me\s+)?(my\s+)?(the\s+)?[\w\s-]+$/i,
      /^what format (is|are)/i,
      /^which folder/i,
      /^list (all|my)/i,
      /^how many documents/i,
    ];

    if (fileActionPatterns.some(p => p.test(queryLower))) {
      console.log('[TITLE DECISION] → NO TITLE (file action)');
      return 'none';
    }

    // Greetings and casual conversation
    const greetingPatterns = [
      /^(hi|hello|hey|oi|olá|bom dia|boa tarde|boa noite|good morning|good afternoon|good evening)/i,
      /^how are you/i,
      /^what'?s up/i,
      /^thanks?|thank you|obrigad[oa]/i,
      /^(bye|goodbye|tchau|até)/i
    ];

    if (greetingPatterns.some(p => p.test(queryLower))) {
      console.log('[TITLE DECISION] → NO TITLE (greeting/casual)');
      return 'none';
    }

    // Simple factual questions (yes/no, definitions, translations)
    const simplePatterns = [
      /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\s+\w+\s*\?*$/i,
      /^what is\s+\w+\s*\?*$/i,
      /^define\s+/i,
      /^translate\s+/i,
      /^what('?s| is) the (capital|meaning|definition|translation)/i,
      /^how (much|many)\s+/i,
      /^when (is|was|did)/i,
      /^where (is|was|are)/i,
      /^who (is|was|are)/i,
    ];

    if (simplePatterns.some(p => p.test(queryLower))) {
      console.log('[TITLE DECISION] → NO TITLE (simple factual)');
      return 'none';
    }

    // Direct simple instructions
    const simpleInstructionPatterns = [
      /^fix (this|the)\s+\w+$/i,
      /^summarize (this|the)\s+\w+$/i,
      /^generate \d+\s+\w+$/i,
      /^write a (short|quick|brief)\s+/i,
      /^give me a (quick|short|brief)\s+/i,
    ];

    if (simpleInstructionPatterns.some(p => p.test(queryLower))) {
      console.log('[TITLE DECISION] → NO TITLE (simple instruction)');
      return 'none';
    }

    // Short responses (under 100 words) - no title needed
    if (responseWordCount < 100) {
      console.log('[TITLE DECISION] → NO TITLE (short response <100 words)');
      return 'none';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RULE 2: TITLE + SUBTITLES patterns (check before single title)
    // ═══════════════════════════════════════════════════════════════════════════

    // Multi-part questions (contains "and", multiple question marks, or multiple topics)
    const multiPartPatterns = [
      /\?\s*.*\?/,
      /what.*and.*what/i,
      /how.*and.*how/i,
      /explain.*and.*explain/i,
      /(pros|advantages).*and.*(cons|disadvantages)/i,
      /compare.*and.*contrast/i,
      /analyze.*(pros|cons|benefits|risks)/i,
    ];

    if (multiPartPatterns.some(p => p.test(queryLower)) && responseWordCount >= 300) {
      console.log('[TITLE DECISION] → STRUCTURED (multi-part question)');
      return 'structured';
    }

    // Complex/strategic content keywords
    const complexPatterns = [
      /step by step/i,
      /step-by-step/i,
      /create a (full|complete|detailed|comprehensive)/i,
      /build a (full|complete|detailed)/i,
      /explain (in detail|thoroughly|completely)/i,
      /break(ing)? down/i,
      /(business|product|project|marketing|training) (plan|roadmap|strategy|manual)/i,
      /from scratch/i,
      /complete guide/i,
      /comprehensive/i,
      /in-depth/i,
    ];

    if (complexPatterns.some(p => p.test(queryLower)) && responseWordCount >= 300) {
      console.log('[TITLE DECISION] → STRUCTURED (complex request)');
      return 'structured';
    }

    // Long responses (400+ words) automatically get structure
    if (responseWordCount >= 400) {
      console.log('[TITLE DECISION] → STRUCTURED (long response 400+ words)');
      return 'structured';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RULE 3: SINGLE TITLE patterns (medium complexity)
    // ═══════════════════════════════════════════════════════════════════════════

    // Medium explanations
    const mediumPatterns = [
      /^explain\s+/i,
      /^what is\s+\w+\s+\w+/i,
      /^how (do|does|to|can)\s+/i,
      /^(describe|overview|summarize|compare)\s+/i,
      /difference between/i,
      /vs\.?|versus/i,
    ];

    if (mediumPatterns.some(p => p.test(queryLower)) && responseWordCount >= 100) {
      console.log('[TITLE DECISION] → SINGLE TITLE (medium explanation)');
      return 'single';
    }

    // Default: If response is 100-400 words, use single title
    if (responseWordCount >= 100 && responseWordCount < 400) {
      console.log('[TITLE DECISION] → SINGLE TITLE (medium length 100-400 words)');
      return 'single';
    }

    // Fallback: no title for anything else
    console.log('[TITLE DECISION] → NO TITLE (default fallback)');
    return 'none';
  }

  /**
   * Enforce complete Koda format on answer
   *
   * @param answer - The response text to format
   * @param queryType - Type of query (informational, instructional, conversational, file_action)
   * @param answerLength - Expected answer length
   * @param userTone - User's preferred tone
   * @param fileList - Optional file list for file_action queries
   * @param query - The original user query (used for smart title decisions)
   */
  enforceFormat(
    answer: string,
    queryType: 'informational' | 'instructional' | 'conversational' | 'file_action' = 'informational',
    answerLength: 'short' | 'medium' | 'long' | 'detailed' = 'medium',
    userTone?: 'professional' | 'casual' | 'technical',
    fileList?: FileItem[],
    query?: string
  ): FormatResult {

    console.log('[KODA FORMAT] Starting format enforcement');
    console.log(`[KODA FORMAT] Query type: ${queryType}, Length: ${answerLength}`);

    const violations: FormatViolation[] = [];
    let formatted = answer;

    // ═══════════════════════════════════════════════════════════════════════════
    // SMART TITLE DECISION - Determine if/how to add titles
    // ═══════════════════════════════════════════════════════════════════════════
    const titleDecision = query
      ? this.detectTitleDecision(query, answer)
      : (answerLength === 'short' ? 'none' : 'single');

    console.log(`[KODA FORMAT] Title decision: ${titleDecision}`);

    // Special handling for file actions with large lists
    if (queryType === 'file_action' && fileList && fileList.length > 0) {
      formatted = this.handleFileActionFormat(formatted, fileList);
    }

    // Step 1: Fix spacing issues
    const beforeSpacing = formatted;
    formatted = this.fixSpacing(formatted);
    if (formatted !== beforeSpacing) {
      violations.push({ severity: 'warning', type: 'SPACING', message: 'Fixed spacing issues' });
    }

    // Step 2: Handle title based on smart decision
    if (titleDecision !== 'none') {
      const beforeTitle = formatted;
      formatted = this.ensureTitleSmart(formatted, userTone, titleDecision);
      if (formatted !== beforeTitle) {
        violations.push({ severity: 'info', type: 'TITLE', message: `Added ${titleDecision} title` });
      }
    } else {
      // Remove any existing title for 'none' decision
      const beforeTitle = formatted;
      formatted = this.removeTitle(formatted);
      if (formatted !== beforeTitle) {
        violations.push({ severity: 'info', type: 'TITLE', message: 'Removed unnecessary title' });
      }
    }

    // Step 3: Validate introduction (only for titled responses)
    if (titleDecision !== 'none') {
      const beforeIntro = formatted;
      formatted = this.validateIntroduction(formatted);
      if (formatted !== beforeIntro) {
        violations.push({ severity: 'warning', type: 'INTRODUCTION', message: 'Truncated long introduction' });
      }
    }

    // Step 4: Ensure proper section structure (only for 'structured' decision)
    if (titleDecision === 'structured') {
      const beforeSections = formatted;
      formatted = this.ensureSectionStructure(formatted);
      if (formatted !== beforeSections) {
        violations.push({ severity: 'info', type: 'SECTIONS', message: 'Fixed section structure' });
      }
    }

    // Step 5: Fix bold/italic usage
    const beforeFormatting = formatted;
    formatted = this.fixFormattingMarkers(formatted);
    if (formatted !== beforeFormatting) {
      violations.push({ severity: 'info', type: 'FORMATTING', message: 'Fixed bold/italic usage' });
    }

    // Step 6: Validate length (only for structured responses)
    if (titleDecision === 'structured') {
      const beforeLength = formatted;
      formatted = this.validateLength(formatted, answerLength);
      if (formatted !== beforeLength) {
        violations.push({ severity: 'warning', type: 'LENGTH', message: 'Added summary due to length' });
      }
    }

    // Step 7: Add closing statement if needed (skip for short/none responses)
    if (titleDecision !== 'none') {
      const beforeClosing = formatted;
      formatted = this.addClosingStatement(formatted, queryType);
      if (formatted !== beforeClosing) {
        violations.push({ severity: 'info', type: 'CLOSING', message: 'Added closing statement' });
      }
    }

    // Step 8: Remove duplicate headers
    formatted = this.removeDuplicates(formatted);

    // Step 9: Final cleanup
    formatted = this.finalCleanup(formatted);

    console.log('[KODA FORMAT] Format enforcement complete');

    return {
      fixedText: formatted,
      violations
    };
  }

  /**
   * Remove title from response (for 'none' title decision)
   */
  private removeTitle(text: string): string {
    const lines = text.split('\n');

    // Check if first non-empty line is a title
    let firstContentIndex = 0;
    while (firstContentIndex < lines.length && !lines[firstContentIndex].trim()) {
      firstContentIndex++;
    }

    if (firstContentIndex >= lines.length) return text;

    const firstLine = lines[firstContentIndex].trim();

    // Remove ## headers at the start
    if (firstLine.startsWith('##')) {
      lines.splice(firstContentIndex, 1);
      // Remove extra blank line after removed title
      if (lines[firstContentIndex] && !lines[firstContentIndex].trim()) {
        lines.splice(firstContentIndex, 1);
      }
      return lines.join('\n').trim();
    }

    return text;
  }

  /**
   * Smart title enforcement based on title decision
   */
  private ensureTitleSmart(text: string, userTone?: string, decision: TitleDecision = 'single'): string {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim() || '';

    // Skip title enforcement for file listings (they have their own format)
    if (firstLine.match(/^[📁📄📊🗂️]\s*\*\*.*\*\*/)) {
      console.log('[KODA FORMAT] Skipping title enforcement for file listing');
      return text;
    }

    // If already has a proper ## header, keep it
    if (firstLine.startsWith('##')) {
      console.log('[KODA FORMAT] Title already exists, keeping');
      return text;
    }

    // For 'single' decision - add a simple title
    if (decision === 'single') {
      // Look for existing title-like patterns
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i].trim();
        if (line.match(/^\*\*[^*]+\*\*$/) && line.length < 100) {
          // Convert bold to ## header
          const title = line.replace(/^\*\*|\*\*$/g, '');
          lines[i] = `## ${title}`;
          return lines.join('\n');
        }
      }

      // No existing title, extract from first sentence
      const firstSentence = this.extractFirstSentence(text);
      const title = this.toTitleCase(firstSentence.substring(0, 80));
      return `## ${title}\n\n${text}`;
    }

    // For 'structured' decision - ensure proper title and will add sections later
    const firstSentence = this.extractFirstSentence(text);
    const title = this.toTitleCase(firstSentence.substring(0, 80));
    return `## ${title}\n\n${text}`;
  }

  /**
   * Handle file action formatting with smart pagination
   */
  private handleFileActionFormat(answer: string, files: FileItem[]): string {
    const count = files.length;

    console.log(`[KODA FORMAT] Formatting file list: ${count} files`);

    // Find file list section in answer
    const listMatch = answer.match(/(###?\s+.*Files.*\n\n)((?:•.*\n?)+)/i);

    if (!listMatch) {
      // No file list found, return as-is
      return answer;
    }

    const [fullMatch, header, _oldList] = listMatch;

    // Generate formatted list based on count
    const formattedList = this.formatFileList(files);

    // Replace old list with formatted version
    return answer.replace(fullMatch, header + formattedList + '\n\n');
  }

  /**
   * Format file list with smart pagination
   */
  private formatFileList(files: FileItem[]): string {
    const count = files.length;

    // Threshold 1: 1-10 files - Show all
    if (count <= 10) {
      return files.map(f => this.formatFileItem(f)).join('\n');
    }

    // Threshold 2: 11-20 files - Show all with summary header
    if (count <= 20) {
      const summary = this.generateFileSummary(files);
      return `**${count} files found** (${summary.totalSize} total)\n\n` +
             files.map(f => this.formatFileItem(f)).join('\n');
    }

    // Threshold 3: 21-50 files - Show first 10 + "show more"
    if (count <= 50) {
      const summary = this.generateFileSummary(files);
      const sample = files.slice(0, 10);

      return `**${count} files found** (${summary.totalSize} total)\n\n` +
             `**Showing first 10:**\n\n` +
             sample.map(f => this.formatFileItem(f)).join('\n') +
             `\n\n**+ ${count - 10} more files**\n\n` +
             `Reply **"Show all"** to see complete list (paginated)`;
    }

    // Threshold 4: 51-100 files - Summary + first 5 + pagination
    if (count <= 100) {
      const summary = this.generateFileSummary(files);
      const sample = files.slice(0, 5);

      let result = `**${count} files found** (${summary.totalSize} total)\n\n`;

      // Add type breakdown
      result += `### Summary by Type\n`;
      for (const [type, data] of Object.entries(summary.byType)) {
        result += `* ${type}: ${data.count} files (${data.size})\n`;
      }

      result += `\n### Sample Files (First 5 of ${count})\n`;
      result += sample.map(f => this.formatFileItem(f)).join('\n');

      result += `\n\n**+ ${count - 5} more files**\n\n`;
      result += `Reply **"Show all"** for paginated view (20 files per page)`;

      return result;
    }

    // Threshold 5: 100+ files - Summary only + interactive options
    const summary = this.generateFileSummary(files);
    const sample = files.slice(0, 5);

    let result = `**${count} files found** (${summary.totalSize} total)\n\n`;

    // Add type breakdown
    result += `### Summary by Type\n`;
    for (const [type, data] of Object.entries(summary.byType)) {
      result += `* **${type}:** ${data.count} files (${data.size})\n`;
    }

    // Add folder breakdown if available
    if (summary.byFolder && Object.keys(summary.byFolder).length > 0) {
      result += `\n### Summary by Folder\n`;
      const topFolders = Object.entries(summary.byFolder)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      for (const [folder, folderCount] of topFolders) {
        result += `* ${folder}: ${folderCount} files\n`;
      }

      if (Object.keys(summary.byFolder).length > 5) {
        result += `* *(${Object.keys(summary.byFolder).length - 5} more folders)*\n`;
      }
    }

    result += `\n### Sample Files (First 5 of ${count})\n`;
    result += sample.map(f => this.formatFileItem(f)).join('\n');

    result += `\n\n**+ ${count - 5} more files**\n\n`;
    result += `### View Options\n`;
    result += `* Reply **"Show all"** for paginated view (20 per page)\n`;
    result += `* Reply **"Filter by [type]"** to narrow selection\n`;
    result += `* Reply **"Sort by [date/size/name]"** to reorder\n`;
    result += `* Reply **"Export list"** to download complete file list`;

    return result;
  }

  /**
   * Format a single file item
   */
  private formatFileItem(file: FileItem): string {
    let line = `* **${file.name}**`;

    if (file.size) {
      line += ` (${file.size})`;
    }

    if (file.date) {
      line += ` - ${file.date}`;
    }

    if (file.path) {
      line += ` - ${file.path}`;
    }

    return line;
  }

  /**
   * Generate file summary statistics
   */
  private generateFileSummary(files: FileItem[]): FileSummary {
    const summary: FileSummary = {
      totalCount: files.length,
      totalSize: '0 B',
      byType: {},
      byFolder: {}
    };

    let totalBytes = 0;

    files.forEach(file => {
      // Parse size
      const sizeBytes = this.parseSizeToBytes(file.size || '0');
      totalBytes += sizeBytes;

      // Group by type
      const type = file.type || this.getFileType(file.name);
      if (!summary.byType[type]) {
        summary.byType[type] = { count: 0, size: '0 B' };
      }
      summary.byType[type].count++;

      // Group by folder
      if (file.path) {
        const folder = file.path.split('/')[0] || 'Root';
        summary.byFolder![folder] = (summary.byFolder![folder] || 0) + 1;
      }
    });

    // Calculate total size
    summary.totalSize = this.formatBytes(totalBytes);

    // Calculate size per type
    for (const type in summary.byType) {
      const typeFiles = files.filter(f =>
        (f.type || this.getFileType(f.name)) === type
      );
      const typeBytes = typeFiles.reduce((sum, f) =>
        sum + this.parseSizeToBytes(f.size || '0'), 0
      );
      summary.byType[type].size = this.formatBytes(typeBytes);
    }

    return summary;
  }

  /**
   * Get file type from filename
   */
  private getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    const typeMap: Record<string, string> = {
      'pdf': 'PDF Documents',
      'doc': 'Word Documents',
      'docx': 'Word Documents',
      'xls': 'Excel Spreadsheets',
      'xlsx': 'Excel Spreadsheets',
      'ppt': 'PowerPoint Presentations',
      'pptx': 'PowerPoint Presentations',
      'txt': 'Text Files',
      'csv': 'CSV Files',
      'jpg': 'Images',
      'jpeg': 'Images',
      'png': 'Images',
      'gif': 'Images'
    };

    return typeMap[ext] || 'Other Files';
  }

  /**
   * Parse size string to bytes
   */
  private parseSizeToBytes(size: string): number {
    const match = size.match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || 1);
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
  }

  /**
   * Fix spacing issues in markdown
   * AGGRESSIVE cleanup to prevent excessive whitespace
   *
   * Processing order:
   * 1. Process spacing tokens ({{BREAK:*}}, {{SPACE:*}})
   * 2. Remove excessive blank lines
   * 3. Clean up list spacing
   * 4. Normalize header spacing
   * 5. Clean code block spacing
   */
  private fixSpacing(text: string): string {
    let fixed = text;

    // Step 1: Process spacing tokens FIRST (convert to newlines)
    fixed = smartProcessSpacing(fixed);

    // Step 2: Remove excessive blank lines (max 2 in a row)
    fixed = fixed.replace(/\n{3,}/g, '\n\n');

    // Step 3: Remove spaces before newlines (trailing whitespace)
    fixed = fixed.replace(/ +\n/g, '\n');

    // Step 4: Remove blank lines between list items
    // Pattern: list item + blank line + list item → list item + list item
    fixed = fixed.replace(/(\n[-*•]\s+[^\n]+)\n\n(\n[-*•]\s+)/g, '$1\n$2');

    // Step 5: Ensure single blank line before headers (not 2 or 3)
    fixed = fixed.replace(/\n{3,}(#{1,6}\s+)/g, '\n\n$1');

    // Step 6: Ensure single blank line after headers
    fixed = fixed.replace(/(#{1,6}\s+[^\n]+)\n{3,}/g, '$1\n\n');

    // Step 7: Remove blank lines at start and end
    fixed = fixed.trim();

    // Step 8: Ensure consistent spacing around code blocks
    fixed = fixed.replace(/\n{3,}```/g, '\n\n```');
    fixed = fixed.replace(/```\n{3,}/g, '```\n\n');

    return fixed;
  }

  /**
   * Ensure proper title (1 line, title case)
   */
  /**
   * Ensure proper title (1 line, title case)
   * ✅ FIX V2: Better detection of existing titles, skip file listings
   */
  private ensureTitle(text: string, userTone?: string): string {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim() || '';

    // ✅ FIX: Skip title enforcement for file listings (they already have proper format)
    // File listings start with emoji + bold pattern like "📁 **Your Documents**"
    if (firstLine.match(/^[📁📄📊🗂️]\s*\*\*.*\*\*/)) {
      console.log('[KODA FORMAT] Skipping title enforcement for file listing');
      return text;
    }

    // ✅ FIX: Skip if already has a proper ## header
    if (firstLine.startsWith('##')) {
      console.log('[KODA FORMAT] Title already exists, skipping');
      return text;
    }

    // ✅ FIX: Better title detection - check multiple patterns
    let titleIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      // Matches: ## Title, **Title**, 📁 **Title**, etc.
      if (line.startsWith('##') ||
          line.match(/^\*\*[^*]+\*\*$/) ||
          line.match(/^[📁📄📊🗂️\*].*\*\*/)) {
        titleIndex = i;
        break;
      }
    }

    if (titleIndex === -1) {
      // No title found, extract from first sentence
      const firstSentence = this.extractFirstSentence(text);
      const title = this.toTitleCase(firstSentence.substring(0, 120));

      // Add emoji only if casual tone
      const emoji = userTone === 'casual' ? this.selectEmoji(title) : '';

      return `## ${emoji}${title}\n\n${text}`;
    }

    // Title exists at titleIndex - don't modify it if it's a special format
    const existingTitle = lines[titleIndex].trim();
    if (existingTitle.match(/^[📁📄📊🗂️].*\*\*/)) {
      // Special file listing format - don't modify
      console.log('[KODA FORMAT] File listing header detected, preserving original format');
      return text;
    }

    // For standard titles, ensure proper formatting
    let title = existingTitle;

    // Remove ## if present
    title = title.replace(/^#+\s*/, '');

    // Remove bold markers if present
    title = title.replace(/^\*\*|\*\*$/g, '');

    // ✅ FIX: Only apply title case if it's simple text (no emojis or special chars)
    if (/^[a-zA-Z0-9\s.,!?'"-]+$/.test(title)) {
      title = this.toTitleCase(title);
    }

    // Limit to 1 line (max ~120 chars)
    if (title.length > 120) {
      title = title.substring(0, 117) + '...';
    }

    // Rebuild with proper title
    lines[titleIndex] = `## ${title}`;

    return lines.join('\n');
  }

  /**
   * Validate introduction (1-3 sentences, max 60 words, 1 paragraph)
   */
  private validateIntroduction(text: string): string {
    const lines = text.split('\n');

    // Find title
    let titleIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].trim().startsWith('##')) {
        titleIndex = i;
        break;
      }
    }

    if (titleIndex === -1) return text;

    // Find first paragraph after title
    let introStart = titleIndex + 1;
    while (introStart < lines.length && !lines[introStart].trim()) {
      introStart++;
    }

    if (introStart >= lines.length) return text;

    // Extract introduction paragraph
    let introEnd = introStart;
    while (introEnd < lines.length && lines[introEnd].trim() && !lines[introEnd].trim().startsWith('#')) {
      introEnd++;
    }

    const introParagraph = lines.slice(introStart, introEnd).join(' ').trim();

    // Count words and sentences
    const words = introParagraph.split(/\s+/);
    const sentences = introParagraph.split(/[.!?]+/).filter(s => s.trim());

    // If introduction is too long, truncate to 3 sentences max 60 words
    if (words.length > 60 || sentences.length > 3) {
      const truncated = sentences.slice(0, 3).join('. ').trim();
      const truncatedWords = truncated.split(/\s+/).slice(0, 60).join(' ');

      lines[introStart] = truncatedWords + (truncatedWords.endsWith('.') ? '' : '.');

      // Remove extra intro lines
      for (let i = introStart + 1; i < introEnd; i++) {
        lines[i] = '';
      }
    }

    return lines.join('\n');
  }

  /**
   * Ensure proper section structure (2-5 sections, H2/H3 headers)
   */
  private ensureSectionStructure(text: string): string {
    const lines = text.split('\n');

    // Count sections (## or ###)
    const sectionCount = lines.filter(l => l.trim().match(/^#{2,3}\s/)).length;

    // If too few sections (< 2), try to split into sections
    if (sectionCount < 2) {
      // Look for bold headers that could be sections
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^\*\*[^*]+\*\*$/) && !line.match(/^##/)) {
          // Convert bold header to H3
          const header = line.replace(/^\*\*|\*\*$/g, '');
          lines[i] = `### ${header}`;
        }
      }
    }

    // If too many sections (> 5), merge smaller ones
    if (sectionCount > 5) {
      // Keep only main H2 sections, convert H3 to bold
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('###')) {
          const header = line.replace(/^###\s*/, '');
          lines[i] = `**${header}**`;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Fix bold/italic usage
   */
  private fixFormattingMarkers(text: string): string {
    // Ensure key terms are bold (first occurrence)
    const keyTerms = ['important', 'note', 'warning', 'tip', 'example'];

    keyTerms.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b(?!\\*)`, 'i');
      text = text.replace(regex, '**$1**');
    });

    return text;
  }

  /**
   * Validate length (200-350 words default)
   */
  private validateLength(text: string, answerLength: string): string {
    const words = text.split(/\s+/).filter(w => w.trim());
    const wordCount = words.length;

    const targetRanges: Record<string, { min: number; max: number }> = {
      short: { min: 50, max: 150 },
      medium: { min: 200, max: 350 },
      long: { min: 400, max: 600 },
      detailed: { min: 500, max: 1000 }
    };

    const target = targetRanges[answerLength] || targetRanges.medium;

    console.log(`[KODA FORMAT] Word count: ${wordCount} (target: ${target.min}-${target.max})`);

    // If too short, warn but don't modify
    if (wordCount < target.min) {
      console.warn(`[KODA FORMAT] Answer too short: ${wordCount} words (min: ${target.min})`);
    }

    // If too long, add summary at top (for answers > 400 words)
    if (wordCount > 400 && answerLength !== 'detailed') {
      // Check if summary already exists
      if (!text.match(/^##\s+Summary/i)) {
        const summary = this.generateSummary(text);
        text = `## Summary\n\n${summary}\n\n---\n\n${text}`;
      }
    }

    return text;
  }

  /**
   * Add closing statement if needed
   */
  private addClosingStatement(text: string, queryType: string): string {
    // Don't add closing if it already has a question
    if (text.match(/\n\n[^\n]*\?$/)) {
      return text;
    }

    // ✅ FIX: Check if closing phrase already exists (prevents duplication)
    const commonClosingPhrases = [
      'let me know if you need',
      'let me know if you have',
      'feel free to ask',
      "don't hesitate to ask",
      'happy to help',
      'hope this helps',
      'if you need more',
      'if you have any questions',
      'let me know'
    ];

    const lowerText = text.toLowerCase();
    for (const phrase of commonClosingPhrases) {
      if (lowerText.includes(phrase)) {
        console.log('[KODA FORMAT] Closing phrase already exists, skipping');
        return text; // Already has a closing phrase
      }
    }

    // ✅ FIX: Only add closing for informational queries
    if (queryType !== 'informational') {
      return text;
    }

    const closing = '\n\nLet me know if you need more details on any specific aspect.';
    return text + closing;
  }

  /**
   * Final cleanup
   */
  private finalCleanup(text: string): string {
    // Remove any remaining multiple blank lines
    let cleaned = text.replace(/\n{3,}/g, '\n\n');

    // Trim start and end
    cleaned = cleaned.trim();

    // Ensure ends with newline
    if (!cleaned.endsWith('\n')) {
      cleaned += '\n';
    }

    return cleaned;
  }

  /**
   * Remove duplicate headers and intros
   * Prevents formatting layers from stacking when format enforcement runs multiple times
   *
   * Strategy:
   * - Track all ## headers seen
   * - Skip any duplicate headers (case-insensitive comparison)
   * - Keep all other content
   */
  private removeDuplicates(text: string): string {
    const lines = text.split('\n');
    const seen = new Set<string>();
    const filtered: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if line is a header (starts with ##)
      if (trimmed.startsWith('##')) {
        const normalized = trimmed.toLowerCase();

        // Skip if we've already seen this header
        if (seen.has(normalized)) {
          console.log(`[KODA FORMAT] Removing duplicate header: ${trimmed.substring(0, 50)}`);
          continue;
        }

        // Mark header as seen
        seen.add(normalized);
      }

      // Keep this line
      filtered.push(line);
    }

    return filtered.join('\n');
  }

  /**
   * Helper: Extract first sentence
   */
  private extractFirstSentence(text: string): string {
    const match = text.match(/^[^.!?]+[.!?]/);
    return match ? match[0].trim() : text.substring(0, 120);
  }

  /**
   * Helper: Convert to title case
   */
  private toTitleCase(str: string): string {
    const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'];

    // ✅ FIX V2: List of common acronyms to preserve
    const acronyms = ['III', 'II', 'IV', 'LLC', 'LP', 'CEO', 'CFO', 'CTO', 'USA', 'UK', 'EU', 'AI', 'ML', 'API', 'PDF', 'CSV'];

    // ✅ FIX V2: Strip markdown/emoji formatting first, then apply title case
    // Remove bold markers for processing
    let cleanStr = str.replace(/\*\*/g, '');
    // Remove leading emojis
    cleanStr = cleanStr.replace(/^[📁📄📊🗂️🔍💡✅❌⚠️]\s*/, '');

    return cleanStr
      .split(' ')
      .map((word, index) => {
        // Skip empty words
        if (!word) return word;

        // ✅ FIX: Preserve all-caps words (acronyms)
        if (word === word.toUpperCase() && word.length > 1 && /^[A-Z]+$/.test(word)) {
          return word;
        }

        // ✅ FIX: Check if word is a known acronym
        const upperWord = word.toUpperCase();
        if (acronyms.includes(upperWord)) {
          return upperWord;
        }

        // ✅ FIX: Preserve words already properly capitalized (first letter uppercase)
        if (/^[A-Z][a-z]+$/.test(word)) {
          return word; // Already proper case like 'Your', 'Documents'
        }

        // ✅ FIX: Skip words with special characters (like parentheses, numbers)
        if (!/^[a-zA-Z]+$/.test(word)) {
          return word;
        }

        // Apply title case to other words
        const lowerWord = word.toLowerCase();
        if (index === 0 || !smallWords.includes(lowerWord)) {
          return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
        }
        return lowerWord;
      })
      .join(' ');
  }

  /**
   * Helper: Select emoji based on content
   */
  private selectEmoji(title: string): string {
    const emojiMap: Record<string, string> = {
      'how': '',
      'what': '',
      'why': '',
      'when': '',
      'where': '',
      'guide': '',
      'tip': '',
      'warning': '',
      'error': '',
      'success': ''
    };

    for (const [keyword, emoji] of Object.entries(emojiMap)) {
      if (title.toLowerCase().includes(keyword)) {
        return emoji;
      }
    }

    return '';
  }

  /**
   * Helper: Generate summary (2-4 bullets or 3-4 sentences)
   */
  private generateSummary(text: string): string {
    // Extract first sentence from each section
    const sections = text.split(/\n#{2,3}\s+/);
    const summaryPoints: string[] = [];

    sections.slice(1, 5).forEach(section => {
      const firstSentence = section.match(/^[^.!?]+[.!?]/);
      if (firstSentence) {
        summaryPoints.push(`* ${firstSentence[0].trim()}`);
      }
    });

    return summaryPoints.join('\n');
  }
}

export const kodaFormatEnforcementService = new KodaFormatEnforcementService();
export default kodaFormatEnforcementService;
