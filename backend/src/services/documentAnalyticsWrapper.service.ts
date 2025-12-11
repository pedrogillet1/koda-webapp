/**
 * Document Analytics Wrapper
 * Provides named export for documentAnalytics service
 */

import documentAnalyticsServiceDefault from './documentAnalytics.service';

// Re-export as named export for use in orchestrator
export const documentAnalyticsService = documentAnalyticsServiceDefault;

// Also export the getDocumentAnalytics helper
export async function getDocumentAnalytics(userId: string): Promise<{
  totalDocuments: number;
  typeBreakdown: Record<string, number>;
  folderBreakdown: Record<string, number>;
  recentDocuments: any[];
}> {
  try {
    const summary = await documentAnalyticsServiceDefault.getDocumentSummary(userId);
    const recent = await documentAnalyticsServiceDefault.getRecentDocuments(userId, 10);
    return {
      totalDocuments: summary.total,
      typeBreakdown: summary.byType,
      folderBreakdown: summary.byFolder || {},
      recentDocuments: recent.documents
    };
  } catch (error) {
    console.error('[ANALYTICS] Error getting analytics:', error);
    return { totalDocuments: 0, typeBreakdown: {}, folderBreakdown: {}, recentDocuments: [] };
  }
}

export default documentAnalyticsServiceDefault;
