/**
 * Recently Deleted Handler
 * Handles queries about deleted documents
 */

import prisma from '../../config/database';

interface DeletedDocument {
  id: string;
  filename: string;
  deletedAt: Date;
  folderName?: string;
  fileSize?: number;
  mimeType: string;
}

interface RecentlyDeletedResult {
  answer: string;
  documents: DeletedDocument[];
  totalCount: number;
}

class RecentlyDeletedHandler {
  /**
   * Handle recently deleted queries like:
   * - "What did I delete?"
   * - "Show me recently deleted files"
   * - "What's in trash?"
   * - "What did I delete yesterday/last week?"
   */
  async handle(userId: string, timeFilter?: { after?: Date; before?: Date }): Promise<RecentlyDeletedResult> {
    console.log(`\n🗑️  RECENTLY DELETED QUERY for user ${userId.substring(0, 8)}...`);

    // Build where clause
    const where: any = {
      userId,
      status: 'deleted'
    };

    // Add time filtering if provided
    if (timeFilter) {
      where.updatedAt = {};
      if (timeFilter.after) {
        where.updatedAt.gte = timeFilter.after;
      }
      if (timeFilter.before) {
        where.updatedAt.lte = timeFilter.before;
      }
    }

    // Get deleted documents
    const deletedDocs = await prisma.document.findMany({
      where,
      include: {
        folder: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc' // Most recently deleted first
      },
      take: 50 // Limit to 50 most recent
    });

    if (deletedDocs.length === 0) {
      const timeText = this.getTimeFilterText(timeFilter);
      return {
        answer: `🗑️  **Recently Deleted Documents**\n\nYou don't have any deleted documents${timeText}.\n\nAll your documents are safe and sound! 📄`,
        documents: [],
        totalCount: 0
      };
    }

    // Format response
    const documents: DeletedDocument[] = deletedDocs.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      deletedAt: doc.updatedAt, // updatedAt represents when it was deleted
      folderName: doc.folder?.name,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType
    }));

    // Group by date
    const grouped = this.groupByDate(documents);

    let answer = `🗑️  **Recently Deleted Documents**\n\n`;
    answer += `Found **${deletedDocs.length}** deleted document${deletedDocs.length === 1 ? '' : 's'}${this.getTimeFilterText(timeFilter)}:\n\n`;

    // Format by date groups
    for (const [dateLabel, docs] of Object.entries(grouped)) {
      answer += `**${dateLabel}:**\n`;
      docs.forEach((doc, idx) => {
        const fileSize = doc.fileSize ? ` (${this.formatFileSize(doc.fileSize)})` : '';
        const folder = doc.folderName ? ` • 📁 ${doc.folderName}` : '';
        const time = this.formatTime(doc.deletedAt);
        answer += `${idx + 1}. **${doc.filename}**${fileSize}${folder}\n`;
        answer += `   ⏱️  Deleted ${time}\n`;
      });
      answer += `\n`;
    }

    answer += `💡 *Deleted documents can be restored from the Documents page.*`;

    return {
      answer,
      documents,
      totalCount: deletedDocs.length
    };
  }

  /**
   * Get deleted documents count by time range
   */
  async getDeletedCount(userId: string, days: number): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await prisma.documents.count({
      where: {
        userId,
        status: 'deleted',
        updatedAt: {
          gte: since
        }
      }
    });
  }

  /**
   * Group documents by date labels
   */
  private groupByDate(documents: DeletedDocument[]): Record<string, DeletedDocument[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups: Record<string, DeletedDocument[]> = {
      'Today': [],
      'Yesterday': [],
      'Last 7 Days': [],
      'Older': []
    };

    for (const doc of documents) {
      const deletedDate = new Date(doc.deletedAt);
      const deletedDay = new Date(deletedDate.getFullYear(), deletedDate.getMonth(), deletedDate.getDate());

      if (deletedDay.getTime() === today.getTime()) {
        groups['Today'].push(doc);
      } else if (deletedDay.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(doc);
      } else if (deletedDate >= lastWeek) {
        groups['Last 7 Days'].push(doc);
      } else {
        groups['Older'].push(doc);
      }
    }

    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, docs]) => docs.length > 0)
    );
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
   * Format time as relative string
   */
  private formatTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return new Date(date).toLocaleDateString();
  }

  /**
   * Get time filter description text
   */
  private getTimeFilterText(timeFilter?: { after?: Date; before?: Date }): string {
    if (!timeFilter) return '';
    if (timeFilter.after && timeFilter.before) {
      return ` between ${timeFilter.after.toLocaleDateString()} and ${timeFilter.before.toLocaleDateString()}`;
    }
    if (timeFilter.after) {
      return ` since ${timeFilter.after.toLocaleDateString()}`;
    }
    if (timeFilter.before) {
      return ` before ${timeFilter.before.toLocaleDateString()}`;
    }
    return '';
  }
}

export default new RecentlyDeletedHandler();
export { RecentlyDeletedHandler, DeletedDocument, RecentlyDeletedResult };
