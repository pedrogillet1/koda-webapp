/**
 * Time-Based Filtering Handler
 * Handles time-based document queries like:
 * - "What did I upload today?"
 * - "Show me files from last week"
 * - "Documents modified yesterday"
 * - "Files uploaded in October"
 */

import prisma from '../../config/database';

export interface TimeRange {
  start: Date;
  end: Date;
  label: string;
}

export interface TimeBasedDocument {
  id: string;
  filename: string;
  mimeType: string;
  fileSize?: number;
  createdAt: Date;
  updatedAt: Date;
  folderName?: string;
  status: string;
}

export interface TimeBasedResult {
  answer: string;
  documents: TimeBasedDocument[];
  totalCount: number;
  timeRange: TimeRange;
}

export class TimeBasedHandler {

  /**
   * Parse time expressions and return date range
   */
  parseTimeExpression(query: string): TimeRange | null {
    const lowerQuery = query.toLowerCase();
    const now = new Date();

    // Helper to get start of day
    const startOfDay = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    };

    // Helper to get end of day
    const endOfDay = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    };

    // TODAY
    if (/\b(today|uploaded today|modified today)\b/.test(lowerQuery)) {
      return {
        start: startOfDay(now),
        end: endOfDay(now),
        label: 'Today'
      };
    }

    // YESTERDAY
    if (/\b(yesterday|uploaded yesterday|modified yesterday)\b/.test(lowerQuery)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
        label: 'Yesterday'
      };
    }

    // LAST N DAYS (e.g., "last 7 days", "past 3 days")
    const lastDaysMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+days?/);
    if (lastDaysMatch) {
      const days = parseInt(lastDaysMatch[1]);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      return {
        start: startOfDay(startDate),
        end: endOfDay(now),
        label: `Last ${days} days`
      };
    }

    // THIS WEEK
    if (/\b(this week|uploaded this week|modified this week)\b/.test(lowerQuery)) {
      const startOfWeek = new Date(now);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek); // Go to Sunday
      return {
        start: startOfDay(startOfWeek),
        end: endOfDay(now),
        label: 'This week'
      };
    }

    // LAST WEEK
    if (/\b(last week|uploaded last week|modified last week)\b/.test(lowerQuery)) {
      const startOfLastWeek = new Date(now);
      const dayOfWeek = startOfLastWeek.getDay();
      startOfLastWeek.setDate(startOfLastWeek.getDate() - dayOfWeek - 7); // Last Sunday
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6); // Last Saturday
      return {
        start: startOfDay(startOfLastWeek),
        end: endOfDay(endOfLastWeek),
        label: 'Last week'
      };
    }

    // THIS MONTH
    if (/\b(this month|uploaded this month|modified this month)\b/.test(lowerQuery)) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: startOfDay(startOfMonth),
        end: endOfDay(now),
        label: 'This month'
      };
    }

    // LAST MONTH
    if (/\b(last month|uploaded last month|modified last month)\b/.test(lowerQuery)) {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      return {
        start: startOfDay(startOfLastMonth),
        end: endOfDay(endOfLastMonth),
        label: 'Last month'
      };
    }

    // SPECIFIC MONTH (e.g., "January", "October", "in March")
    const months = ['january', 'february', 'march', 'april', 'may', 'june',
                    'july', 'august', 'september', 'october', 'november', 'december'];
    for (let i = 0; i < months.length; i++) {
      if (lowerQuery.includes(months[i])) {
        // Check if there's a year specified
        const yearMatch = lowerQuery.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();

        const startOfMonth = new Date(year, i, 1);
        const endOfMonth = new Date(year, i + 1, 0); // Last day of month
        return {
          start: startOfDay(startOfMonth),
          end: endOfDay(endOfMonth),
          label: `${months[i].charAt(0).toUpperCase() + months[i].slice(1)} ${year}`
        };
      }
    }

    // LAST N MONTHS (e.g., "last 3 months", "past 6 months")
    const lastMonthsMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+months?/);
    if (lastMonthsMatch) {
      const numMonths = parseInt(lastMonthsMatch[1]);
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - numMonths);
      return {
        start: startOfDay(startDate),
        end: endOfDay(now),
        label: `Last ${numMonths} months`
      };
    }

    // QUARTER (e.g., "Q1", "Q2 2024", "first quarter")
    const quarterMatch = lowerQuery.match(/\b[Qq]([1-4])\b/);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      const yearMatch = lowerQuery.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();

      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;

      const startOfQuarter = new Date(year, startMonth, 1);
      const endOfQuarter = new Date(year, endMonth + 1, 0);
      return {
        start: startOfDay(startOfQuarter),
        end: endOfDay(endOfQuarter),
        label: `Q${quarter} ${year}`
      };
    }

    // THIS YEAR
    if (/\b(this year|uploaded this year|modified this year)\b/.test(lowerQuery)) {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return {
        start: startOfDay(startOfYear),
        end: endOfDay(now),
        label: 'This year'
      };
    }

    // SPECIFIC YEAR (e.g., "2024", "in 2023")
    const yearMatch = lowerQuery.match(/\b(20\d{2})\b/);
    if (yearMatch && !lowerQuery.includes('q')) { // Don't match if it's part of a quarter query
      const year = parseInt(yearMatch[1]);
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      return {
        start: startOfDay(startOfYear),
        end: endOfDay(endOfYear),
        label: year.toString()
      };
    }

    return null;
  }

  /**
   * Determine if query is asking about uploads (createdAt) or modifications (updatedAt)
   */
  private detectTimeField(query: string): 'createdAt' | 'updatedAt' {
    const lowerQuery = query.toLowerCase();

    // Check for modification keywords
    if (lowerQuery.includes('modified') ||
        lowerQuery.includes('updated') ||
        lowerQuery.includes('changed') ||
        lowerQuery.includes('edited')) {
      return 'updatedAt';
    }

    // Default to upload time (createdAt)
    return 'createdAt';
  }

  /**
   * Handle time-based queries
   */
  async handle(
    userId: string,
    query: string,
    additionalFilters?: {
      mimeType?: string;
      folderId?: string;
      status?: string;
    }
  ): Promise<TimeBasedResult | null> {
    console.log(`\n📅 TIME-BASED QUERY: "${query}"`);

    // Parse time expression
    const timeRange = this.parseTimeExpression(query);
    if (!timeRange) {
      console.log('   ❌ No time expression detected');
      return null;
    }

    console.log(`   ⏰ Time range: ${timeRange.label} (${timeRange.start.toLocaleDateString()} - ${timeRange.end.toLocaleDateString()})`);

    // Detect which timestamp field to use
    const timeField = this.detectTimeField(query);
    console.log(`   📊 Filtering by: ${timeField === 'createdAt' ? 'Upload date' : 'Modification date'}`);

    // Build query filter
    const where: any = {
      userId,
      [timeField]: {
        gte: timeRange.start,
        lte: timeRange.end
      }
    };

    // Apply additional filters
    if (additionalFilters?.mimeType) {
      where.mimeType = { contains: additionalFilters.mimeType };
    }
    if (additionalFilters?.folderId) {
      where.folderId = additionalFilters.folderId;
    }
    if (additionalFilters?.status) {
      where.status = additionalFilters.status;
    } else {
      // Default to only completed documents
      where.status = 'completed';
    }

    // Fetch documents
    const documents = await prisma.documents.findMany({
      where,
      include: {
        folders: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        [timeField]: 'desc'
      }
    });

    console.log(`   ✅ Found ${documents.length} documents`);

    if (documents.length === 0) {
      return {
        answer: `📅 **${timeRange.label} Documents**\n\nNo documents found ${timeField === 'createdAt' ? 'uploaded' : 'modified'} during this time period.\n\nTry a different time range! 🔍`,
        documents: [],
        totalCount: 0,
        timeRange
      };
    }

    // Format documents
    const formattedDocs: TimeBasedDocument[] = documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      folderName: doc.folder?.name,
      status: doc.status
    }));

    // Build answer
    let answer = `📅 **${timeRange.label} Documents**\n\n`;
    answer += `Found **${documents.length}** document${documents.length === 1 ? '' : 's'} `;
    answer += `${timeField === 'createdAt' ? 'uploaded' : 'modified'} ${timeRange.label.toLowerCase()}:\n\n`;

    // Group by date for better organization
    const grouped = this.groupByDate(formattedDocs, timeField);

    for (const [dateLabel, docs] of Object.entries(grouped)) {
      answer += `**${dateLabel}:**\n`;
      docs.forEach((doc, idx) => {
        const fileSize = doc.fileSize ? ` (${this.formatFileSize(doc.fileSize)})` : '';
        const folder = doc.folderName ? ` • 📁 ${doc.folderName}` : '';
        const fileType = this.getFileTypeEmoji(doc.mimeType);
        answer += `${idx + 1}. ${fileType} **${doc.filename}**${fileSize}${folder}\n`;
      });
      answer += `\n`;
    }

    answer += `💡 *${timeField === 'createdAt' ? 'Upload' : 'Modification'} dates shown*`;

    return {
      answer,
      documents: formattedDocs,
      totalCount: documents.length,
      timeRange
    };
  }

  /**
   * Group documents by date labels within the time range
   */
  private groupByDate(documents: TimeBasedDocument[], timeField: 'createdAt' | 'updatedAt'): Record<string, TimeBasedDocument[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: Record<string, TimeBasedDocument[]> = {};

    for (const doc of documents) {
      const docDate = new Date(doc[timeField]);
      const docDay = new Date(docDate.getFullYear(), docDate.getMonth(), docDate.getDate());

      let label: string;
      if (docDay.getTime() === today.getTime()) {
        label = 'Today';
      } else if (docDay.getTime() === yesterday.getTime()) {
        label = 'Yesterday';
      } else {
        // Format as "Month Day, Year" (e.g., "October 15, 2024")
        label = docDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(doc);
    }

    return groups;
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get emoji for file type
   */
  private getFileTypeEmoji(mimeType: string): string {
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📄';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('text')) return '📝';
    return '📄';
  }
}

export default new TimeBasedHandler();
