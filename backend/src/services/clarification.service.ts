/**
 * Clarification Service
 *
 * REASON: Generate smart clarifying questions when queries are ambiguous
 * WHY: "Show me the report" might match 45 documents
 * HOW: Group results intelligently, show top options, ask user to clarify
 * IMPACT: Better UX, fewer "wrong file" errors
 *
 * GROUPING STRATEGIES:
 * 1. By folder - Most intuitive for organized users
 * 2. By date - Good for time-based queries
 * 3. By file type - Good for format-specific queries
 * 4. By relevance score - When other groupings don't help
 */

import prisma from '../config/database';

export interface ClarificationOption {
  id: string;
  label: string;
  description?: string;
  count?: number;
  metadata?: {
    documentIds?: string[];
    folderId?: string;
    fileType?: string;
    dateRange?: string;
    [key: string]: any;
  };
}

export interface ClarificationResult {
  needsClarification: boolean;
  question?: string;
  options?: ClarificationOption[];
  type?: 'disambiguation' | 'confirmation' | 'selection';
  groupingStrategy?: 'folder' | 'date' | 'fileType' | 'relevance' | 'none';
  totalMatches?: number;
}

interface DocumentMatch {
  id: string;
  filename: string;
  folderId?: string | null;
  folderName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: Date;
  updatedAt?: Date;
  summary?: string;
  relevanceScore?: number;
}

class ClarificationService {

  /**
   * Generate smart clarification for ambiguous queries
   */
  async generateClarification(
    query: string,
    matches: DocumentMatch[],
    userId: string
  ): Promise<ClarificationResult> {

    // If only 1 match, no clarification needed
    if (matches.length <= 1) {
      return { needsClarification: false };
    }

    // If 2-5 matches, show simple list
    if (matches.length <= 5) {
      return this.generateSimpleClarification(query, matches);
    }

    // If 6-10 matches, try to group intelligently
    if (matches.length <= 10) {
      return this.generateGroupedClarification(query, matches, userId);
    }

    // If >10 matches, definitely need grouping
    return this.generateGroupedClarification(query, matches, userId);
  }

  /**
   * Generate simple clarification (2-5 matches)
   */
  private generateSimpleClarification(
    query: string,
    matches: DocumentMatch[]
  ): ClarificationResult {

    const searchTerm = this.extractSearchTerm(query);

    const options: ClarificationOption[] = matches.map(doc => ({
      id: doc.id,
      label: doc.filename,
      description: this.buildDocumentDescription(doc),
      document_metadata: {
        documentIds: [doc.id],
        folderId: doc.folderId || undefined,
        fileType: doc.fileType,
      },
    }));

    return {
      needsClarification: true,
      question: `I found **${matches.length} files** matching "${searchTerm}". Which one would you like?`,
      options,
      type: 'disambiguation',
      groupingStrategy: 'none',
      totalMatches: matches.length,
    };
  }

  /**
   * Generate grouped clarification (>5 matches)
   */
  private async generateGroupedClarification(
    query: string,
    matches: DocumentMatch[],
    userId: string
  ): Promise<ClarificationResult> {

    const searchTerm = this.extractSearchTerm(query);

    // Try different grouping strategies
    const [byFolder, byDate, byType] = await Promise.all([
      this.groupByFolder(matches, userId),
      this.groupByDate(matches),
      this.groupByFileType(matches),
    ]);

    // Select best grouping strategy
    const bestGrouping = this.selectBestGrouping(byFolder, byDate, byType);

    // If no good grouping, show top matches by relevance
    if (bestGrouping.options.length <= 1) {
      return this.generateTopMatchesClarification(query, matches);
    }

    return {
      needsClarification: true,
      question: `I found **${matches.length} files** matching "${searchTerm}". ${this.getGroupingQuestion(bestGrouping.strategy)}`,
      options: bestGrouping.options,
      type: 'disambiguation',
      groupingStrategy: bestGrouping.strategy,
      totalMatches: matches.length,
    };
  }

  /**
   * Group documents by folder
   */
  private async groupByFolder(
    matches: DocumentMatch[],
    userId: string
  ): Promise<{ strategy: 'folder'; options: ClarificationOption[] }> {

    const folderGroups = new Map<string, DocumentMatch[]>();

    for (const doc of matches) {
      const folderId = doc.folderId || 'root';
      if (!folderGroups.has(folderId)) {
        folderGroups.set(folderId, []);
      }
      folderGroups.get(folderId)!.push(doc);
    }

    // Get folder names
    const folderIds = Array.from(folderGroups.keys()).filter(id => id !== 'root');

    let folderMap = new Map<string, string>();
    if (folderIds.length > 0) {
      try {
        const folders = await prisma.folders.findMany({
          where: { id: { in: folderIds } },
          select: { id: true, name: true },
        });
        folderMap = new Map(folders.map(f => [f.id, f.name]));
      } catch (error) {
        console.warn('⚠️ [CLARIFICATION] Could not fetch folder names:', error);
      }
    }

    const options: ClarificationOption[] = Array.from(folderGroups.entries())
      .map(([folderId, docs]) => ({
        id: folderId,
        label: folderId === 'root' ? '📁 Root folder' : `📁 ${folderMap.get(folderId) || 'Unknown folder'}`,
        description: `${docs.length} file${docs.length > 1 ? 's' : ''}`,
        count: docs.length,
        document_metadata: {
          documentIds: docs.map(d => d.id),
          folderId: folderId === 'root' ? undefined : folderId,
        },
      }))
      .sort((a, b) => (b.count || 0) - (a.count || 0)); // Sort by count

    return { strategy: 'folder', options };
  }

  /**
   * Group documents by date
   */
  private groupByDate(
    matches: DocumentMatch[]
  ): { strategy: 'date'; options: ClarificationOption[] } {

    const now = new Date();
    const groups = {
      today: [] as DocumentMatch[],
      thisWeek: [] as DocumentMatch[],
      thisMonth: [] as DocumentMatch[],
      older: [] as DocumentMatch[],
    };

    for (const doc of matches) {
      const docDate = doc.updatedAt || doc.createdAt;
      const daysDiff = Math.floor((now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        groups.today.push(doc);
      } else if (daysDiff <= 7) {
        groups.thisWeek.push(doc);
      } else if (daysDiff <= 30) {
        groups.thisMonth.push(doc);
      } else {
        groups.older.push(doc);
      }
    }

    const options: ClarificationOption[] = [];

    if (groups.today.length > 0) {
      options.push({
        id: 'today',
        label: '📅 Today',
        description: `${groups.today.length} file${groups.today.length > 1 ? 's' : ''}`,
        count: groups.today.length,
        document_metadata: { documentIds: groups.today.map(d => d.id), dateRange: 'today' },
      });
    }

    if (groups.thisWeek.length > 0) {
      options.push({
        id: 'thisWeek',
        label: '📅 This week',
        description: `${groups.thisWeek.length} file${groups.thisWeek.length > 1 ? 's' : ''}`,
        count: groups.thisWeek.length,
        document_metadata: { documentIds: groups.thisWeek.map(d => d.id), dateRange: 'thisWeek' },
      });
    }

    if (groups.thisMonth.length > 0) {
      options.push({
        id: 'thisMonth',
        label: '📅 This month',
        description: `${groups.thisMonth.length} file${groups.thisMonth.length > 1 ? 's' : ''}`,
        count: groups.thisMonth.length,
        document_metadata: { documentIds: groups.thisMonth.map(d => d.id), dateRange: 'thisMonth' },
      });
    }

    if (groups.older.length > 0) {
      options.push({
        id: 'older',
        label: '📅 Older',
        description: `${groups.older.length} file${groups.older.length > 1 ? 's' : ''}`,
        count: groups.older.length,
        document_metadata: { documentIds: groups.older.map(d => d.id), dateRange: 'older' },
      });
    }

    return { strategy: 'date', options };
  }

  /**
   * Group documents by file type
   */
  private groupByFileType(
    matches: DocumentMatch[]
  ): { strategy: 'fileType'; options: ClarificationOption[] } {

    const typeGroups = new Map<string, DocumentMatch[]>();

    for (const doc of matches) {
      const type = doc.fileType?.toLowerCase() || 'unknown';
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(doc);
    }

    const typeIcons: Record<string, string> = {
      'pdf': '📄',
      'docx': '📝',
      'doc': '📝',
      'xlsx': '📊',
      'xls': '📊',
      'pptx': '📊',
      'ppt': '📊',
      'txt': '📃',
      'csv': '📈',
      'json': '🔧',
      'unknown': '📎',
    };

    const options: ClarificationOption[] = Array.from(typeGroups.entries())
      .map(([type, docs]) => ({
        id: type,
        label: `${typeIcons[type] || '📎'} ${type.toUpperCase()} files`,
        description: `${docs.length} file${docs.length > 1 ? 's' : ''}`,
        count: docs.length,
        document_metadata: {
          documentIds: docs.map(d => d.id),
          fileType: type,
        },
      }))
      .sort((a, b) => (b.count || 0) - (a.count || 0));

    return { strategy: 'fileType', options };
  }

  /**
   * Generate clarification showing top matches by relevance
   */
  private generateTopMatchesClarification(
    query: string,
    matches: DocumentMatch[]
  ): ClarificationResult {

    const searchTerm = this.extractSearchTerm(query);

    // Sort by relevance score if available, otherwise by date
    const sorted = [...matches].sort((a, b) => {
      if (a.relevanceScore && b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    });

    // Take top 7 matches
    const topMatches = sorted.slice(0, 7);

    const options: ClarificationOption[] = topMatches.map(doc => ({
      id: doc.id,
      label: doc.filename,
      description: this.buildDocumentDescription(doc),
      document_metadata: {
        documentIds: [doc.id],
        folderId: doc.folderId || undefined,
        fileType: doc.fileType,
      },
    }));

    // Add "Show all" option if there are more matches
    if (matches.length > 7) {
      options.push({
        id: 'show_all',
        label: `📋 Show all ${matches.length} results`,
        description: 'View complete list',
        document_metadata: {
          documentIds: matches.map(d => d.id),
        },
      });
    }

    return {
      needsClarification: true,
      question: `I found **${matches.length} files** matching "${searchTerm}". Here are the most relevant:`,
      options,
      type: 'disambiguation',
      groupingStrategy: 'relevance',
      totalMatches: matches.length,
    };
  }

  /**
   * Select best grouping strategy
   */
  private selectBestGrouping(
    byFolder: { strategy: 'folder'; options: ClarificationOption[] },
    byDate: { strategy: 'date'; options: ClarificationOption[] },
    byType: { strategy: 'fileType'; options: ClarificationOption[] }
  ): { strategy: 'folder' | 'date' | 'fileType'; options: ClarificationOption[] } {

    const strategies = [
      { ...byFolder, score: this.scoreGrouping(byFolder.options) },
      { ...byDate, score: this.scoreGrouping(byDate.options) },
      { ...byType, score: this.scoreGrouping(byType.options) },
    ];

    // Sort by score (highest first)
    strategies.sort((a, b) => b.score - a.score);

    return {
      strategy: strategies[0].strategy,
      options: strategies[0].options,
    };
  }

  /**
   * Score grouping quality
   * Prefer groupings with 3-6 options (not too few, not too many)
   * Also prefer even distribution of items
   */
  private scoreGrouping(options: ClarificationOption[]): number {
    if (options.length <= 1) return 0;
    if (options.length > 8) return 2;

    let score = 0;

    // Prefer 3-6 options
    if (options.length >= 3 && options.length <= 6) {
      score += 10;
    } else if (options.length === 2 || options.length === 7) {
      score += 7;
    } else {
      score += 4;
    }

    // Prefer even distribution
    const counts = options.map(o => o.count || 1);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = more even distribution = higher score
    if (stdDev < avg * 0.3) {
      score += 5;
    } else if (stdDev < avg * 0.5) {
      score += 3;
    }

    return score;
  }

  /**
   * Get question text based on grouping strategy
   */
  private getGroupingQuestion(strategy: string): string {
    switch (strategy) {
      case 'folder':
        return 'Which folder should I look in?';
      case 'date':
        return 'From which time period?';
      case 'fileType':
        return 'Which file type are you looking for?';
      default:
        return 'Which one would you like?';
    }
  }

  /**
   * Build document description for display
   */
  private buildDocumentDescription(doc: DocumentMatch): string {
    const parts: string[] = [];

    // Add file size if available
    if (doc.fileSize) {
      const sizeKB = (doc.fileSize / 1024).toFixed(1);
      parts.push(`${sizeKB} KB`);
    }

    // Add folder name if available
    if (doc.folderName) {
      parts.push(`in ${doc.folderName}`);
    }

    // Add date
    const date = doc.updatedAt || doc.createdAt;
    if (date) {
      const dateStr = this.formatRelativeDate(date);
      parts.push(dateStr);
    }

    return parts.join(' • ') || '';
  }

  /**
   * Format date as relative string
   */
  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  /**
   * Extract search term from query
   */
  private extractSearchTerm(query: string): string {
    const patterns = [
      /(?:show|open|find|search|display)\s+(?:me\s+)?(?:the\s+)?(.+?)(?:\?|$)/i,
      /(?:where is|find)\s+(?:the\s+)?(.+?)(?:\?|$)/i,
      /(.+?)(?:\?|$)/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const term = match[1].trim();
        if (term.length > 2 && term.length < 100) {
          return term;
        }
      }
    }

    return query.trim();
  }

  /**
   * Check if query might need clarification
   */
  mightNeedClarification(query: string): boolean {
    const ambiguousPatterns = [
      /^(?:show|open|display)\s+(?:me\s+)?(?:the|a)\s+\w+$/i, // "show me the report"
      /^(?:find|search)\s+(?:the|a)?\s*\w+$/i, // "find report"
      /^(?:where is|where's)\s+(?:the|my)?\s*\w+$/i, // "where is the document"
    ];

    return ambiguousPatterns.some(pattern => pattern.test(query.trim()));
  }

  /**
   * Generate confirmation request for single match
   */
  generateConfirmation(
    query: string,
    document: DocumentMatch
  ): ClarificationResult {
    return {
      needsClarification: true,
      question: `Did you mean **${document.filename}**?`,
      options: [
        {
          id: document.id,
          label: 'Yes, that\'s the one',
          document_metadata: { documentIds: [document.id] },
        },
        {
          id: 'search_more',
          label: 'No, search for something else',
          document_metadata: {},
        },
      ],
      type: 'confirmation',
      totalMatches: 1,
    };
  }
}

export default new ClarificationService();
