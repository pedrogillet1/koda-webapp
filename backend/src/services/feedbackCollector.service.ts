/**
 * Feedback Collector Service
 * Collects user feedback on responses for continuous improvement
 * Tracks thumbs up/down, detailed feedback, and quality metrics
 * Enables A/B testing and iterative refinement
 */

import prisma from '../config/database';

interface Feedback {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  query: string;
  response: string;
  rating: 'positive' | 'negative' | 'neutral';
  feedbackType: 'accuracy' | 'relevance' | 'completeness' | 'formatting' | 'other';
  comment?: string;
  retrievedDocuments: string[];
  metadata: {
    responseTime: number;
    tokensUsed: number;
    modelVersion: string;
  };
  timestamp: Date;
}

interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  positiveRate: number;
  byType: Map<string, number>;
  averageResponseTime: number;
}

interface FeedbackInsights {
  commonIssues: Array<{ issue: string; count: number; examples: string[] }>;
  topQueriesWithNegativeFeedback: Array<{ query: string; count: number }>;
  documentsWithIssues: Array<{ documentId: string; issueCount: number }>;
  improvementSuggestions: string[];
}

class FeedbackCollectorService {
  /**
   * Collect feedback from user
   */
  async collectFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): Promise<string> {
    try {
      console.log(`📝 Collecting feedback: ${feedback.rating}`);

      // Store feedback in database
      const feedbackRecord = await prisma.feedback.create({
        data: {
          userId: feedback.userId,
          conversationId: feedback.conversationId,
          messageId: feedback.messageId,
          query: feedback.query,
          response: feedback.response,
          rating: feedback.rating,
          feedbackType: feedback.feedbackType,
          comment: feedback.comment,
          retrievedDocuments: feedback.retrievedDocuments,
          metadata: feedback.metadata as any,
          timestamp: new Date()
        }
      });

      console.log(`   ✅ Feedback saved: ${feedbackRecord.id}`);

      // Analyze feedback immediately for high-priority issues
      if (feedback.rating === 'negative') {
        await this.handleNegativeFeedback(feedback);
      }

      return feedbackRecord.id;
    } catch (error) {
      console.error('❌ Error collecting feedback:', error);
      throw error;
    }
  }

  /**
   * Quick feedback (thumbs up/down)
   */
  async quickFeedback(
    userId: string,
    conversationId: string,
    messageId: string,
    rating: 'positive' | 'negative'
  ): Promise<void> {
    console.log(`👍👎 Quick feedback: ${rating}`);

    try {
      // Get message details
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          metadata: true
        }
      });

      if (!message) {
        throw new Error('Message not found');
      }

      await this.collectFeedback({
        userId,
        conversationId,
        messageId,
        query: message.query || '',
        response: message.response || '',
        rating,
        feedbackType: 'other',
        retrievedDocuments: (message.metadata as any)?.documents || [],
        metadata: {
          responseTime: (message.metadata as any)?.responseTime || 0,
          tokensUsed: (message.metadata as any)?.tokensUsed || 0,
          modelVersion: (message.metadata as any)?.modelVersion || 'unknown'
        }
      });
    } catch (error) {
      console.error('❌ Error in quick feedback:', error);
      throw error;
    }
  }

  /**
   * Detailed feedback with comment
   */
  async detailedFeedback(
    userId: string,
    conversationId: string,
    messageId: string,
    rating: 'positive' | 'negative' | 'neutral',
    feedbackType: 'accuracy' | 'relevance' | 'completeness' | 'formatting' | 'other',
    comment: string
  ): Promise<void> {
    console.log(`📋 Detailed feedback: ${rating} (${feedbackType})`);
    console.log(`   Comment: "${comment.substring(0, 50)}..."`);

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          metadata: true
        }
      });

      if (!message) {
        throw new Error('Message not found');
      }

      await this.collectFeedback({
        userId,
        conversationId,
        messageId,
        query: message.query || '',
        response: message.response || '',
        rating,
        feedbackType,
        comment,
        retrievedDocuments: (message.metadata as any)?.documents || [],
        metadata: {
          responseTime: (message.metadata as any)?.responseTime || 0,
          tokensUsed: (message.metadata as any)?.tokensUsed || 0,
          modelVersion: (message.metadata as any)?.modelVersion || 'unknown'
        }
      });
    } catch (error) {
      console.error('❌ Error in detailed feedback:', error);
      throw error;
    }
  }

  /**
   * Handle negative feedback immediately
   */
  private async handleNegativeFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): Promise<void> {
    console.log('⚠️ Handling negative feedback...');

    // Check if this is a recurring issue
    const recentNegativeFeedback = await prisma.feedback.count({
      where: {
        query: feedback.query,
        rating: 'negative',
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    });

    if (recentNegativeFeedback >= 3) {
      console.log(`   ⚠️ ALERT: Query "${feedback.query}" has ${recentNegativeFeedback} negative feedback in 7 days`);

      // In production: send alert to team, create ticket, etc.
      // await notificationService.sendAlert({
      //   type: 'recurring_negative_feedback',
      //   query: feedback.query,
      //   count: recentNegativeFeedback
      // });
    }

    // Check document quality
    for (const docId of feedback.retrievedDocuments) {
      const docNegativeFeedback = await prisma.feedback.count({
        where: {
          retrievedDocuments: {
            has: docId
          },
          rating: 'negative',
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      });

      if (docNegativeFeedback >= 5) {
        console.log(`   ⚠️ ALERT: Document ${docId} has ${docNegativeFeedback} negative feedback in 7 days`);
        // Flag document for review
      }
    }
  }

  /**
   * Get feedback statistics
   */
  async getStats(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<FeedbackStats> {
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (timeRange) {
      where.timestamp = {
        gte: timeRange.start,
        lte: timeRange.end
      };
    }

    const feedbacks = await prisma.feedback.findMany({ where });

    const total = feedbacks.length;
    const positive = feedbacks.filter(f => f.rating === 'positive').length;
    const negative = feedbacks.filter(f => f.rating === 'negative').length;
    const neutral = feedbacks.filter(f => f.rating === 'neutral').length;

    const positiveRate = total > 0 ? (positive / total) * 100 : 0;

    const byType = new Map<string, number>();
    for (const feedback of feedbacks) {
      byType.set(
        feedback.feedbackType,
        (byType.get(feedback.feedbackType) || 0) + 1
      );
    }

    const totalResponseTime = feedbacks.reduce(
      (sum, f) => sum + ((f.metadata as any)?.responseTime || 0),
      0
    );
    const averageResponseTime = total > 0 ? totalResponseTime / total : 0;

    return {
      total,
      positive,
      negative,
      neutral,
      positiveRate,
      byType,
      averageResponseTime
    };
  }

  /**
   * Generate insights from feedback
   */
  async generateInsights(
    timeRange: { start: Date; end: Date }
  ): Promise<FeedbackInsights> {
    console.log('🔍 Generating feedback insights...');

    const feedbacks = await prisma.feedback.findMany({
      where: {
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }
    });

    // Analyze common issues
    const issueMap = new Map<string, { count: number; examples: string[] }>();

    for (const feedback of feedbacks) {
      if (feedback.rating === 'negative' && feedback.comment) {
        const issueType = feedback.feedbackType;

        if (!issueMap.has(issueType)) {
          issueMap.set(issueType, { count: 0, examples: [] });
        }

        const issue = issueMap.get(issueType)!;
        issue.count++;

        if (issue.examples.length < 3) {
          issue.examples.push(feedback.comment);
        }
      }
    }

    const commonIssues = Array.from(issueMap.entries())
      .map(([issue, data]) => ({ issue, ...data }))
      .sort((a, b) => b.count - a.count);

    // Find queries with most negative feedback
    const queryMap = new Map<string, number>();

    for (const feedback of feedbacks) {
      if (feedback.rating === 'negative') {
        queryMap.set(feedback.query, (queryMap.get(feedback.query) || 0) + 1);
      }
    }

    const topQueriesWithNegativeFeedback = Array.from(queryMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Find documents with issues
    const docMap = new Map<string, number>();

    for (const feedback of feedbacks) {
      if (feedback.rating === 'negative') {
        for (const docId of feedback.retrievedDocuments) {
          docMap.set(docId, (docMap.get(docId) || 0) + 1);
        }
      }
    }

    const documentsWithIssues = Array.from(docMap.entries())
      .map(([documentId, issueCount]) => ({ documentId, issueCount }))
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);

    // Generate improvement suggestions
    const improvementSuggestions: string[] = [];

    if (commonIssues.find(i => i.issue === 'accuracy')?.count > 5) {
      improvementSuggestions.push(
        'High accuracy issues detected. Consider improving grounding and citation quality.'
      );
    }

    if (commonIssues.find(i => i.issue === 'relevance')?.count > 5) {
      improvementSuggestions.push(
        'High relevance issues detected. Review retrieval quality and re-ranking.'
      );
    }

    if (commonIssues.find(i => i.issue === 'completeness')?.count > 5) {
      improvementSuggestions.push(
        'High completeness issues detected. Ensure context budget allocates enough space for comprehensive answers.'
      );
    }

    if (documentsWithIssues.length > 0 && documentsWithIssues[0].issueCount > 10) {
      improvementSuggestions.push(
        `Document ${documentsWithIssues[0].documentId} frequently leads to negative feedback. Review document quality and chunking.`
      );
    }

    console.log(`   Found ${commonIssues.length} common issue types`);
    console.log(`   Found ${topQueriesWithNegativeFeedback.length} problematic queries`);
    console.log(`   Found ${documentsWithIssues.length} documents with issues`);

    return {
      commonIssues,
      topQueriesWithNegativeFeedback,
      documentsWithIssues,
      improvementSuggestions
    };
  }

  /**
   * Generate feedback report
   */
  async generateReport(timeRange: { start: Date; end: Date }): Promise<string> {
    const stats = await this.getStats(undefined, timeRange);
    const insights = await this.generateInsights(timeRange);

    const ratingStatus =
      stats.positiveRate >= 80
        ? '✅ Excellent'
        : stats.positiveRate >= 60
          ? '⚠️ Good'
          : '❌ Needs Improvement';

    let report = `
╔═══════════════════════════════════════════════════════╗
║           FEEDBACK ANALYSIS REPORT                    ║
╠═══════════════════════════════════════════════════════╣
║ Period: ${timeRange.start.toISOString().substring(0, 10)} to ${timeRange.end.toISOString().substring(0, 10)}${' '.repeat(9)} ║
║                                                       ║
║ Total Feedback: ${stats.total.toString().padEnd(35)} ║
║ Positive: ${stats.positive.toString().padEnd(43)} ║
║ Negative: ${stats.negative.toString().padEnd(43)} ║
║ Neutral: ${stats.neutral.toString().padEnd(44)} ║
║ Positive Rate: ${stats.positiveRate.toFixed(1)}% ${ratingStatus.padEnd(28)} ║
║                                                       ║
║ Avg Response Time: ${stats.averageResponseTime.toFixed(0)}ms${' '.repeat(26)} ║
╠═══════════════════════════════════════════════════════╣
║ COMMON ISSUES                                        ║
`;

    for (const issue of insights.commonIssues.slice(0, 5)) {
      report += `║   ${issue.issue}: ${issue.count} occurrences${' '.repeat(42 - issue.issue.length - issue.count.toString().length)} ║\n`;
    }

    report += `╠═══════════════════════════════════════════════════════╣\n`;
    report += `║ IMPROVEMENT SUGGESTIONS                              ║\n`;

    for (const suggestion of insights.improvementSuggestions) {
      const lines = this.wrapText(suggestion, 51);
      for (const line of lines) {
        report += `║ ${line.padEnd(53)} ║\n`;
      }
    }

    report += `╚═══════════════════════════════════════════════════════╝`;

    return report.trim();
  }

  /**
   * Wrap text to fit in report
   */
  private wrapText(text: string, maxLength: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Export feedback for analysis
   */
  async exportFeedback(
    timeRange: { start: Date; end: Date },
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const feedbacks = await prisma.feedback.findMany({
      where: {
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }
    });

    if (format === 'json') {
      return JSON.stringify(feedbacks, null, 2);
    } else {
      // CSV format
      const headers = [
        'timestamp',
        'userId',
        'query',
        'rating',
        'feedbackType',
        'comment',
        'responseTime'
      ].join(',');

      const rows = feedbacks.map(f =>
        [
          f.timestamp.toISOString(),
          f.userId,
          `"${f.query.replace(/"/g, '""')}"`,
          f.rating,
          f.feedbackType,
          `"${(f.comment || '').replace(/"/g, '""')}"`,
          (f.metadata as any)?.responseTime || 0
        ].join(',')
      );

      return [headers, ...rows].join('\n');
    }
  }
}

export default new FeedbackCollectorService();
export { FeedbackCollectorService, Feedback, FeedbackStats, FeedbackInsights };
