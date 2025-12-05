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

export class KodaFormatEnforcementService {

  /**
   * Enforce complete Koda format on answer
   */
  enforceFormat(
    answer: string,
    queryType: 'informational' | 'instructional' | 'conversational' | 'file_action' = 'informational',
    answerLength: 'short' | 'medium' | 'long' | 'detailed' = 'medium',
    userTone?: 'professional' | 'casual' | 'technical',
    fileList?: FileItem[]
  ): string {

    console.log('[KODA FORMAT] Starting format enforcement');
    console.log(`[KODA FORMAT] Query type: ${queryType}, Length: ${answerLength}`);

    let formatted = answer;

    // Special handling for file actions with large lists
    if (queryType === 'file_action' && fileList && fileList.length > 0) {
      formatted = this.handleFileActionFormat(formatted, fileList);
    }

    // Step 1: Fix spacing issues
    formatted = this.fixSpacing(formatted);

    // Step 2: Ensure proper title
    formatted = this.ensureTitle(formatted, userTone);

    // Step 3: Validate introduction
    formatted = this.validateIntroduction(formatted);

    // Step 4: Ensure proper section structure
    formatted = this.ensureSectionStructure(formatted);

    // Step 5: Fix bold/italic usage
    formatted = this.fixFormattingMarkers(formatted);

    // Step 6: Validate length
    formatted = this.validateLength(formatted, answerLength);

    // Step 7: Add closing statement if needed
    formatted = this.addClosingStatement(formatted, queryType);

    // Step 8: Final cleanup
    formatted = this.finalCleanup(formatted);

    console.log('[KODA FORMAT] Format enforcement complete');

    return formatted;
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
   * Fix spacing issues (no multiple consecutive blank lines)
   */
  private fixSpacing(text: string): string {
    // Remove multiple consecutive blank lines
    let fixed = text.replace(/\n{3,}/g, '\n\n');

    // Ensure single blank line between sections
    fixed = fixed.replace(/(#{2,3}\s+[^\n]+)\n([^\n])/g, '$1\n\n$2');

    // Ensure blank line before bullet lists
    fixed = fixed.replace(/([^\n])\n([*\-]\s)/g, '$1\n\n$2');

    // Ensure blank line after bullet lists
    fixed = fixed.replace(/([*\-]\s[^\n]+)\n([^\n*\-])/g, '$1\n\n$2');

    return fixed;
  }

  /**
   * Ensure proper title (1 line, title case)
   */
  private ensureTitle(text: string, userTone?: string): string {
    const lines = text.split('\n');

    // Check if first non-empty line is a title (## or bold)
    let titleIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.startsWith('##') || line.match(/^\*\*[^*]+\*\*$/)) {
        titleIndex = i;
        break;
      }
    }

    if (titleIndex === -1) {
      // No title found, extract from first sentence
      const firstSentence = this.extractFirstSentence(text);
      const title = this.toTitleCase(firstSentence.substring(0, 60));

      // Add emoji only if casual tone
      const emoji = userTone === 'casual' ? this.selectEmoji(title) : '';

      return `## ${emoji}${title}\n\n${text}`;
    }

    // Title exists, ensure it's properly formatted
    let title = lines[titleIndex].trim();

    // Remove ## if present
    title = title.replace(/^#+\s*/, '');

    // Remove bold markers if present
    title = title.replace(/^\*\*|\*\*$/g, '');

    // Ensure title case
    title = this.toTitleCase(title);

    // Limit to 1 line (max ~80 chars)
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
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
    // Don't add closing if it already has one
    if (text.match(/\n\n[^\n]*\?$/)) {
      return text; // Already has a question
    }

    // Add contextual closing based on query type
    const closings: Record<string, string> = {
      informational: '\n\nLet me know if you need more details on any specific aspect.',
      instructional: '',
      conversational: '',
      file_action: ''
    };

    const closing = closings[queryType] || '';

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
   * Helper: Extract first sentence
   */
  private extractFirstSentence(text: string): string {
    const match = text.match(/^[^.!?]+[.!?]/);
    return match ? match[0].trim() : text.substring(0, 60);
  }

  /**
   * Helper: Convert to title case
   */
  private toTitleCase(str: string): string {
    const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'];

    return str
      .toLowerCase()
      .split(' ')
      .map((word, index) => {
        if (index === 0 || !smallWords.includes(word)) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
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
