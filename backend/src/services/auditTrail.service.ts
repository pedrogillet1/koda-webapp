/**
 * Audit Trail Service
 * TASK #14: Implement audit trail for traceability of document spans used
 *
 * Tracks which document spans (chunks) were used to generate each answer,
 * providing full traceability for debugging, compliance, and transparency.
 *
 * Features:
 * - Logs all document chunks retrieved and used
 * - Tracks relevance scores and confidence metrics
 * - Records timestamps and user context
 * - Provides audit reports for answers
 * - Enables debugging of retrieval quality
 */

interface DocumentSpan {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  chunkContent: string;
  startChar?: number;
  endChar?: number;
  pageNumber?: number;
  slideNumber?: number;
  relevanceScore: number;
  wasUsedInAnswer: boolean;
  exactQuotes?: string[];
}

interface AuditTrailEntry {
  id: string;
  timestamp: Date;
  userId: string;
  conversationId: string;
  query: string;
  queryIntent?: string;

  // Retrieval information
  totalChunksRetrieved: number;
  uniqueDocumentsRetrieved: number;
  topRelevanceScore: number;
  averageRelevanceScore: number;

  // Document spans used
  documentSpans: DocumentSpan[];

  // Answer information
  answerLength: number;
  confidenceScore: number;
  confidenceLevel: string;

  // Timing
  retrievalTimeMs: number;
  answerGenerationTimeMs: number;
  totalTimeMs: number;
}

class AuditTrailService {
  private trails: Map<string, AuditTrailEntry> = new Map();
  private maxTrailsInMemory = 1000; // Keep last 1000 trails in memory

  /**
   * Create a new audit trail for a RAG query
   */
  createTrail(
    userId: string,
    conversationId: string,
    query: string,
    options: {
      queryIntent?: string;
    } = {}
  ): string {
    const trailId = `trail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const trail: AuditTrailEntry = {
      id: trailId,
      timestamp: new Date(),
      userId,
      conversationId,
      query,
      queryIntent: options.queryIntent,
      totalChunksRetrieved: 0,
      uniqueDocumentsRetrieved: 0,
      topRelevanceScore: 0,
      averageRelevanceScore: 0,
      documentSpans: [],
      answerLength: 0,
      confidenceScore: 0,
      confidenceLevel: 'unknown',
      retrievalTimeMs: 0,
      answerGenerationTimeMs: 0,
      totalTimeMs: 0
    };

    this.trails.set(trailId, trail);

    // Clean up old trails if necessary
    if (this.trails.size > this.maxTrailsInMemory) {
      const oldestKey = this.trails.keys().next().value;
      this.trails.delete(oldestKey);
    }

    console.log(`\n📋 [Audit Trail] Created trail: ${trailId}`);
    return trailId;
  }

  /**
   * Log retrieved chunks to the audit trail
   */
  logRetrievedChunks(
    trailId: string,
    chunks: any[],
    retrievalTimeMs: number
  ): void {
    const trail = this.trails.get(trailId);
    if (!trail) {
      console.warn(`⚠️ [Audit Trail] Trail not found: ${trailId}`);
      return;
    }

    // Extract document spans from chunks
    const spans: DocumentSpan[] = chunks.map(chunk => ({
      documentId: chunk.chunk?.metadata?.documentId || chunk.metadata?.documentId || 'unknown',
      documentName: chunk.chunk?.metadata?.filename || chunk.metadata?.filename || 'Unknown',
      chunkIndex: chunk.chunk?.metadata?.chunkIndex || chunk.metadata?.chunkIndex || 0,
      chunkContent: chunk.chunk?.content || chunk.content || '',
      startChar: chunk.chunk?.metadata?.startChar || chunk.metadata?.startChar,
      endChar: chunk.chunk?.metadata?.endChar || chunk.metadata?.endChar,
      pageNumber: chunk.chunk?.metadata?.pageNumber || chunk.metadata?.pageNumber,
      slideNumber: chunk.chunk?.metadata?.slideNumber || chunk.metadata?.slideNumber,
      relevanceScore: chunk.relevanceScore || 0,
      wasUsedInAnswer: false, // Will be updated later
      exactQuotes: []
    }));

    trail.documentSpans = spans;
    trail.totalChunksRetrieved = spans.length;
    trail.uniqueDocumentsRetrieved = new Set(spans.map(s => s.documentId)).size;
    trail.retrievalTimeMs = retrievalTimeMs;

    // Calculate relevance statistics
    if (spans.length > 0) {
      trail.topRelevanceScore = Math.max(...spans.map(s => s.relevanceScore));
      trail.averageRelevanceScore = spans.reduce((sum, s) => sum + s.relevanceScore, 0) / spans.length;
    }

    console.log(`   📊 Logged ${spans.length} chunks from ${trail.uniqueDocumentsRetrieved} documents`);
  }

  /**
   * Mark which document spans were actually used in the answer
   */
  markSpansUsed(
    trailId: string,
    usedSources: any[]
  ): void {
    const trail = this.trails.get(trailId);
    if (!trail) return;

    const usedDocIds = new Set(usedSources.map(s => s.documentId));

    let usedCount = 0;
    for (const span of trail.documentSpans) {
      if (usedDocIds.has(span.documentId)) {
        span.wasUsedInAnswer = true;

        // Add exact quotes if available
        const source = usedSources.find(s => s.documentId === span.documentId);
        if (source?.exactQuotes) {
          span.exactQuotes = source.exactQuotes;
        }
        usedCount++;
      }
    }

    console.log(`   ✅ Marked ${usedCount} spans as used in answer`);
  }

  /**
   * Log answer metadata to the audit trail
   */
  logAnswerMetadata(
    trailId: string,
    answer: string,
    confidenceScore: number,
    confidenceLevel: string,
    answerGenerationTimeMs: number
  ): void {
    const trail = this.trails.get(trailId);
    if (!trail) return;

    trail.answerLength = answer.length;
    trail.confidenceScore = confidenceScore;
    trail.confidenceLevel = confidenceLevel;
    trail.answerGenerationTimeMs = answerGenerationTimeMs;
    trail.totalTimeMs = trail.retrievalTimeMs + answerGenerationTimeMs;

    console.log(`   📝 Answer: ${answer.length} chars, confidence: ${confidenceScore}%`);
  }

  /**
   * Get audit trail for a specific query
   */
  getTrail(trailId: string): AuditTrailEntry | null {
    return this.trails.get(trailId) || null;
  }

  /**
   * Generate a detailed audit report for debugging
   */
  generateAuditReport(trailId: string): string {
    const trail = this.trails.get(trailId);
    if (!trail) {
      return `❌ Audit trail not found: ${trailId}`;
    }

    const usedSpans = trail.documentSpans.filter(s => s.wasUsedInAnswer);
    const unusedSpans = trail.documentSpans.filter(s => !s.wasUsedInAnswer);

    let report = `
╔══════════════════════════════════════════════════════════════╗
║                    AUDIT TRAIL REPORT                        ║
╚══════════════════════════════════════════════════════════════╝

📋 Trail ID: ${trail.id}
⏰ Timestamp: ${trail.timestamp.toISOString()}
👤 User ID: ${trail.userId}
💬 Conversation ID: ${trail.conversationId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 QUERY INFORMATION:
   Query: "${trail.query}"
   Intent: ${trail.queryIntent || 'Not classified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RETRIEVAL STATISTICS:
   Total Chunks Retrieved: ${trail.totalChunksRetrieved}
   Unique Documents: ${trail.uniqueDocumentsRetrieved}
   Top Relevance Score: ${trail.topRelevanceScore.toFixed(1)}%
   Average Relevance: ${trail.averageRelevanceScore.toFixed(1)}%
   Retrieval Time: ${trail.retrievalTimeMs}ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ DOCUMENT SPANS USED (${usedSpans.length}):
`;

    usedSpans.forEach((span, idx) => {
      report += `\n   ${idx + 1}. ${span.documentName}`;
      report += `\n      Document ID: ${span.documentId}`;
      report += `\n      Chunk ${span.chunkIndex}`;
      if (span.pageNumber) report += ` (Page ${span.pageNumber})`;
      if (span.slideNumber) report += ` (Slide ${span.slideNumber})`;
      report += `\n      Relevance: ${span.relevanceScore.toFixed(1)}%`;
      report += `\n      Content Length: ${span.chunkContent.length} chars`;
      if (span.exactQuotes && span.exactQuotes.length > 0) {
        report += `\n      Exact Quotes: ${span.exactQuotes.length}`;
        span.exactQuotes.forEach((quote, qIdx) => {
          report += `\n         ${qIdx + 1}. "${quote.substring(0, 80)}${quote.length > 80 ? '...' : ''}"`;
        });
      }
      report += `\n`;
    });

    if (unusedSpans.length > 0) {
      report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `\n⚠️  RETRIEVED BUT NOT USED (${unusedSpans.length}):\n`;

      // Show top 5 unused spans
      unusedSpans.slice(0, 5).forEach((span, idx) => {
        report += `\n   ${idx + 1}. ${span.documentName} (Chunk ${span.chunkIndex})`;
        report += ` - Relevance: ${span.relevanceScore.toFixed(1)}%`;
      });

      if (unusedSpans.length > 5) {
        report += `\n   ... and ${unusedSpans.length - 5} more`;
      }
    }

    report += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `\n📈 ANSWER METADATA:`;
    report += `\n   Answer Length: ${trail.answerLength} characters`;
    report += `\n   Confidence Score: ${trail.confidenceScore}% (${trail.confidenceLevel})`;
    report += `\n   Answer Generation Time: ${trail.answerGenerationTimeMs}ms`;
    report += `\n   Total Time: ${trail.totalTimeMs}ms`;
    report += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `\n🔍 TRACEABILITY:`;
    report += `\n   Usage Rate: ${((usedSpans.length / Math.max(1, trail.totalChunksRetrieved)) * 100).toFixed(1)}%`;
    report += `\n   Documents Used: ${new Set(usedSpans.map(s => s.documentId)).size} of ${trail.uniqueDocumentsRetrieved}`;
    report += `\n\n╚══════════════════════════════════════════════════════════════╝\n`;

    return report;
  }

  /**
   * Get summary statistics for recent trails
   */
  getStatistics(limit: number = 100): {
    totalTrails: number;
    avgRetrievalTime: number;
    avgAnswerGenerationTime: number;
    avgConfidence: number;
    avgUsageRate: number;
  } {
    const recentTrails = Array.from(this.trails.values()).slice(-limit);

    if (recentTrails.length === 0) {
      return {
        totalTrails: 0,
        avgRetrievalTime: 0,
        avgAnswerGenerationTime: 0,
        avgConfidence: 0,
        avgUsageRate: 0
      };
    }

    const stats = recentTrails.reduce((acc, trail) => {
      const usedCount = trail.documentSpans.filter(s => s.wasUsedInAnswer).length;
      const usageRate = trail.totalChunksRetrieved > 0
        ? usedCount / trail.totalChunksRetrieved
        : 0;

      return {
        retrievalTime: acc.retrievalTime + trail.retrievalTimeMs,
        answerTime: acc.answerTime + trail.answerGenerationTimeMs,
        confidence: acc.confidence + trail.confidenceScore,
        usageRate: acc.usageRate + usageRate
      };
    }, { retrievalTime: 0, answerTime: 0, confidence: 0, usageRate: 0 });

    return {
      totalTrails: recentTrails.length,
      avgRetrievalTime: Math.round(stats.retrievalTime / recentTrails.length),
      avgAnswerGenerationTime: Math.round(stats.answerTime / recentTrails.length),
      avgConfidence: Math.round(stats.confidence / recentTrails.length),
      avgUsageRate: Math.round((stats.usageRate / recentTrails.length) * 100)
    };
  }

  /**
   * Clear all trails (useful for testing)
   */
  clearAll(): void {
    this.trails.clear();
    console.log(`🧹 [Audit Trail] Cleared all trails`);
  }
}

export default new AuditTrailService();
export { AuditTrailService, AuditTrailEntry, DocumentSpan };
