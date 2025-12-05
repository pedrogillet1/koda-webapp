/**
 * Analytics Tracking Service
 *
 * PURPOSE: Real-time tracking of user sessions, events, feedback, RAG queries, and API performance
 * USES: New analytics Prisma models for production-ready metrics
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionStartData {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
}

export interface EventTrackData {
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventName: string;
  category?: string;
  properties?: Record<string, any>;
  duration?: number;
}

export interface FeedbackData {
  userId: string;
  conversationId: string;
  messageId?: string;
  feedbackType: 'thumbs_up' | 'thumbs_down' | 'rating' | 'comment';
  rating?: number;
  comment?: string;
  categories?: string[];
  wasHelpful?: boolean;
  hadSources?: boolean;
  sourceCount?: number;
}

export interface RAGQueryData {
  userId: string;
  conversationId?: string;
  messageId?: string;
  query: string;
  queryLanguage?: string;
  retrievalMethod: 'hybrid' | 'pinecone_only' | 'bm25_only';
  usedBM25?: boolean;
  usedPinecone?: boolean;
  totalLatency?: number;
  embeddingLatency?: number;
  bm25Latency?: number;
  pineconeLatency?: number;
  llmLatency?: number;
  chunksRetrieved?: number;
  bm25Results?: number;
  pineconeResults?: number;
  documentsUsed?: number;
  topScore?: number;
  avgScore?: number;
  minRelevanceScore?: number;
  passedThreshold?: boolean;
  needsRefinement?: boolean;
  refinementReason?: string;
  hadFallback?: boolean;
  responseGenerated?: boolean;
  uniqueDocuments?: number;
  sourceCoverage?: number;
}

export interface APIPerformanceData {
  service: string;
  endpoint: string;
  method: string;
  requestSize?: number;
  requestData?: Record<string, any>;
  responseSize?: number;
  statusCode: number;
  success: boolean;
  errorMessage?: string;
  errorCode?: string;
  latency?: number;
  rateLimitHit?: boolean;
  retryCount?: number;
  tokensUsed?: number;
  estimatedCost?: number;
  userId?: string;
  conversationId?: string;
}

export interface DocumentProcessingData {
  documentId: string;
  uploadStartedAt: Date;
  uploadCompletedAt?: Date;
  uploadDuration?: number;
  uploadFailed?: boolean;
  uploadError?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingDuration?: number;
  processingFailed?: boolean;
  processingError?: string;
  textExtractionMethod?: string;
  textExtractionSuccess?: boolean;
  textExtractionTime?: number;
  textLength?: number;
  ocrUsed?: boolean;
  ocrSuccess?: boolean;
  ocrConfidence?: number;
  ocrTime?: number;
  embeddingStartedAt?: Date;
  embeddingCompletedAt?: Date;
  embeddingDuration?: number;
  embeddingsCreated?: number;
  chunksCreated?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// USER SESSION TRACKING
// ═══════════════════════════════════════════════════════════════════════════

class AnalyticsTrackingService {
  /**
   * Start a new user session
   */
  async startSession(data: SessionStartData) {
    try {
      console.log(`📊 [TRACKING] Starting session for user: ${data.userId}`);

      const session = await prisma.userSession.create({
        data: {
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          device: data.device,
          browser: data.browser,
          os: data.os,
        },
      });

      console.log(`📊 [TRACKING] Session started: ${session.id}`);
      return session;
    } catch (error) {
      console.error('❌ [TRACKING] Error starting session:', error);
      throw error;
    }
  }

  /**
   * End a user session and calculate metrics
   */
  async endSession(sessionId: string) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        console.warn(`⚠️ [TRACKING] Session not found: ${sessionId}`);
        return null;
      }

      const duration = Math.round(
        (new Date().getTime() - session.startedAt.getTime()) / 1000
      );
      const bounced = duration < 30 && session.actionsCount === 0;

      const updatedSession = await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          duration,
          bounced,
        },
      });

      console.log(`📊 [TRACKING] Session ended: ${sessionId}, duration: ${duration}s, bounced: ${bounced}`);
      return updatedSession;
    } catch (error) {
      console.error('❌ [TRACKING] Error ending session:', error);
      throw error;
    }
  }

  /**
   * Update session activity counts
   */
  async updateSessionActivity(
    sessionId: string,
    updates: { pageViews?: number; actionsCount?: number; messagesCount?: number; converted?: boolean }
  ) {
    try {
      return await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          pageViews: updates.pageViews !== undefined ? { increment: updates.pageViews } : undefined,
          actionsCount: updates.actionsCount !== undefined ? { increment: updates.actionsCount } : undefined,
          messagesCount: updates.messagesCount !== undefined ? { increment: updates.messagesCount } : undefined,
          converted: updates.converted,
        },
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error updating session activity:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Track a generic analytics event
   */
  async trackEvent(data: EventTrackData) {
    try {
      const event = await prisma.analyticsEvent.create({
        data: {
          userId: data.userId,
          sessionId: data.sessionId,
          eventType: data.eventType,
          eventName: data.eventName,
          category: data.category,
          properties: data.properties,
          duration: data.duration,
        },
      });

      console.log(`📊 [TRACKING] Event tracked: ${data.eventType}/${data.eventName}`);
      return event;
    } catch (error) {
      console.error('❌ [TRACKING] Error tracking event:', error);
      throw error;
    }
  }

  /**
   * Track page view event
   */
  async trackPageView(userId: string, page: string, sessionId?: string) {
    return this.trackEvent({
      userId,
      sessionId,
      eventType: 'page_view',
      eventName: page,
      category: 'navigation',
    });
  }

  /**
   * Track feature usage event
   */
  async trackFeatureUsage(
    userId: string,
    featureName: string,
    properties?: Record<string, any>,
    sessionId?: string
  ) {
    return this.trackEvent({
      userId,
      sessionId,
      eventType: 'feature_used',
      eventName: featureName,
      category: 'features',
      properties,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record conversation/message feedback
   */
  async recordFeedback(data: FeedbackData) {
    try {
      const sentiment = data.feedbackType === 'thumbs_up' ? 'positive' :
                       data.feedbackType === 'thumbs_down' ? 'negative' :
                       data.rating && data.rating >= 4 ? 'positive' :
                       data.rating && data.rating <= 2 ? 'negative' : 'neutral';

      const feedback = await prisma.conversationFeedback.create({
        data: {
          userId: data.userId,
          conversationId: data.conversationId,
          messageId: data.messageId,
          feedbackType: data.feedbackType,
          rating: data.rating,
          sentiment,
          comment: data.comment,
          categories: data.categories || [],
          wasHelpful: data.wasHelpful,
          hadSources: data.hadSources ?? false,
          sourceCount: data.sourceCount ?? 0,
        },
      });

      console.log(`📊 [TRACKING] Feedback recorded: ${data.feedbackType} for conversation ${data.conversationId}`);

      // Update conversation metrics if they exist
      await this.updateConversationMetrics(data.conversationId, {
        userRating: data.rating,
        userFeedback: sentiment,
      });

      return feedback;
    } catch (error) {
      console.error('❌ [TRACKING] Error recording feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback statistics for a conversation
   */
  async getConversationFeedbackStats(conversationId: string) {
    const feedback = await prisma.conversationFeedback.groupBy({
      by: ['feedbackType'],
      where: { conversationId },
      _count: { feedbackType: true },
    });

    return feedback.reduce((acc, item) => {
      acc[item.feedbackType] = item._count.feedbackType;
      return acc;
    }, {} as Record<string, number>);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION METRICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize conversation metrics
   */
  async initConversationMetrics(conversationId: string) {
    try {
      const existing = await prisma.conversationMetrics.findUnique({
        where: { conversationId },
      });

      if (existing) return existing;

      return await prisma.conversationMetrics.create({
        data: {
          conversationId,
          startedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error initializing conversation metrics:', error);
      throw error;
    }
  }

  /**
   * Update conversation metrics
   */
  async updateConversationMetrics(
    conversationId: string,
    updates: Partial<{
      totalMessages: number;
      userMessages: number;
      assistantMessages: number;
      completed: boolean;
      abandoned: boolean;
      hadFallback: boolean;
      fallbackCount: number;
      ragQueriesCount: number;
      sourcesUsedCount: number;
      avgRelevanceScore: number;
      userRating: number;
      userFeedback: string;
    }>
  ) {
    try {
      // Ensure metrics exist
      await this.initConversationMetrics(conversationId);

      return await prisma.conversationMetrics.update({
        where: { conversationId },
        data: {
          ...updates,
          endedAt: updates.completed || updates.abandoned ? new Date() : undefined,
        },
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error updating conversation metrics:', error);
      throw error;
    }
  }

  /**
   * Increment conversation message counts
   */
  async incrementConversationMessages(conversationId: string, role: 'user' | 'assistant') {
    try {
      await this.initConversationMetrics(conversationId);

      return await prisma.conversationMetrics.update({
        where: { conversationId },
        data: {
          totalMessages: { increment: 1 },
          ...(role === 'user' ? { userMessages: { increment: 1 } } : {}),
          ...(role === 'assistant' ? { assistantMessages: { increment: 1 } } : {}),
        },
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error incrementing conversation messages:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RAG PERFORMANCE TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record RAG query metrics
   */
  async recordRAGQuery(data: RAGQueryData) {
    try {
      const ragMetrics = await prisma.rAGQueryMetrics.create({
        data: {
          userId: data.userId,
          conversationId: data.conversationId,
          messageId: data.messageId,
          query: data.query,
          queryLanguage: data.queryLanguage,
          retrievalMethod: data.retrievalMethod,
          usedBM25: data.usedBM25 ?? false,
          usedPinecone: data.usedPinecone ?? false,
          completedAt: new Date(),
          totalLatency: data.totalLatency,
          embeddingLatency: data.embeddingLatency,
          bm25Latency: data.bm25Latency,
          pineconeLatency: data.pineconeLatency,
          llmLatency: data.llmLatency,
          chunksRetrieved: data.chunksRetrieved ?? 0,
          bm25Results: data.bm25Results ?? 0,
          pineconeResults: data.pineconeResults ?? 0,
          documentsUsed: data.documentsUsed ?? 0,
          topScore: data.topScore,
          avgScore: data.avgScore,
          minRelevanceScore: data.minRelevanceScore,
          passedThreshold: data.passedThreshold ?? false,
          needsRefinement: data.needsRefinement ?? false,
          refinementReason: data.refinementReason,
          hadFallback: data.hadFallback ?? false,
          responseGenerated: data.responseGenerated ?? false,
          uniqueDocuments: data.uniqueDocuments ?? 0,
          sourceCoverage: data.sourceCoverage,
        },
      });

      console.log(`📊 [TRACKING] RAG query recorded: ${ragMetrics.id}, latency: ${data.totalLatency}ms`);

      // Update conversation metrics
      if (data.conversationId) {
        await this.updateConversationMetrics(data.conversationId, {
          ragQueriesCount: 1, // Will increment
          hadFallback: data.hadFallback,
        });
      }

      return ragMetrics;
    } catch (error) {
      console.error('❌ [TRACKING] Error recording RAG query:', error);
      throw error;
    }
  }

  /**
   * Get RAG performance statistics
   */
  async getRAGPerformanceStats(userId?: string, days: number = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where = {
      startedAt: { gte: startDate },
      ...(userId ? { userId } : {}),
    };

    const [totalQueries, avgLatency, fallbackRate, methodDistribution] = await Promise.all([
      prisma.rAGQueryMetrics.count({ where }),
      prisma.rAGQueryMetrics.aggregate({
        where,
        _avg: { totalLatency: true },
      }),
      prisma.rAGQueryMetrics.count({
        where: { ...where, hadFallback: true },
      }),
      prisma.rAGQueryMetrics.groupBy({
        by: ['retrievalMethod'],
        where,
        _count: true,
      }),
    ]);

    return {
      totalQueries,
      avgLatency: avgLatency._avg.totalLatency || 0,
      fallbackRate: totalQueries > 0 ? (fallbackRate / totalQueries) * 100 : 0,
      methodDistribution: methodDistribution.map(m => ({
        method: m.retrievalMethod,
        count: m._count,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API PERFORMANCE TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record API performance metrics
   */
  async recordAPIPerformance(data: APIPerformanceData) {
    try {
      const log = await prisma.aPIPerformanceLog.create({
        data: {
          service: data.service,
          endpoint: data.endpoint,
          method: data.method,
          requestSize: data.requestSize,
          requestData: data.requestData,
          responseSize: data.responseSize,
          statusCode: data.statusCode,
          success: data.success,
          errorMessage: data.errorMessage,
          errorCode: data.errorCode,
          completedAt: new Date(),
          latency: data.latency,
          rateLimitHit: data.rateLimitHit ?? false,
          retryCount: data.retryCount ?? 0,
          tokensUsed: data.tokensUsed,
          estimatedCost: data.estimatedCost,
          userId: data.userId,
          conversationId: data.conversationId,
        },
      });

      if (!data.success || data.rateLimitHit) {
        console.warn(`⚠️ [TRACKING] API call failed/rate-limited: ${data.service}/${data.endpoint}`);
      }

      return log;
    } catch (error) {
      console.error('❌ [TRACKING] Error recording API performance:', error);
      throw error;
    }
  }

  /**
   * Get API performance statistics by service
   */
  async getAPIPerformanceStats(service?: string, hours: number = 24) {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const where = {
      startedAt: { gte: startDate },
      ...(service ? { service } : {}),
    };

    const [totalCalls, successfulCalls, avgLatency, rateLimitHits] = await Promise.all([
      prisma.aPIPerformanceLog.count({ where }),
      prisma.aPIPerformanceLog.count({
        where: { ...where, success: true },
      }),
      prisma.aPIPerformanceLog.aggregate({
        where: { ...where, success: true },
        _avg: { latency: true },
      }),
      prisma.aPIPerformanceLog.count({
        where: { ...where, rateLimitHit: true },
      }),
    ]);

    return {
      totalCalls,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
      avgLatency: avgLatency._avg.latency || 0,
      rateLimitHits,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT PROCESSING TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize document processing metrics
   */
  async initDocumentProcessingMetrics(documentId: string) {
    try {
      return await prisma.documentProcessingMetrics.create({
        data: {
          documentId,
          uploadStartedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error initializing document processing metrics:', error);
      throw error;
    }
  }

  /**
   * Update document processing metrics
   */
  async updateDocumentProcessingMetrics(documentId: string, data: Partial<DocumentProcessingData>) {
    try {
      return await prisma.documentProcessingMetrics.upsert({
        where: { documentId },
        create: {
          documentId,
          uploadStartedAt: data.uploadStartedAt || new Date(),
          ...data,
        },
        update: data,
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error updating document processing metrics:', error);
      throw error;
    }
  }

  /**
   * Record document query access
   */
  async recordDocumentQueried(documentId: string) {
    try {
      return await prisma.documentProcessingMetrics.update({
        where: { documentId },
        data: {
          timesQueried: { increment: 1 },
          lastQueriedAt: new Date(),
        },
      });
    } catch (error) {
      // Document might not have metrics yet, ignore
      console.warn(`⚠️ [TRACKING] Could not update document query count for ${documentId}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM HEALTH SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record system health snapshot
   */
  async recordSystemHealthSnapshot(data: {
    onlineUsers?: number;
    activeConversations?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    apiRequestsPerSec?: number;
    avgResponseTime?: number;
    errorRate?: number;
    dbConnections?: number;
    dbQueryTime?: number;
    queuedJobs?: number;
    processingJobs?: number;
    failedJobs?: number;
  }) {
    try {
      return await prisma.systemHealthSnapshot.create({
        data,
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error recording system health snapshot:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER LIFETIME VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update user lifetime value metrics
   */
  async updateUserLifetimeValue(userId: string) {
    try {
      const [sessions, messages, documents, conversations] = await Promise.all([
        prisma.userSession.count({ where: { userId } }),
        prisma.message.count({
          where: { conversation: { userId }, role: 'user' },
        }),
        prisma.document.count({ where: { userId } }),
        prisma.conversation.count({ where: { userId } }),
      ]);

      const totalTimeSpent = await prisma.userSession.aggregate({
        where: { userId },
        _sum: { duration: true },
      });

      const avgSessionDuration = sessions > 0
        ? (totalTimeSpent._sum.duration || 0) / sessions
        : 0;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      });

      const daysSinceSignup = user
        ? Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000))
        : 0;

      return await prisma.userLifetimeValue.upsert({
        where: { userId },
        create: {
          userId,
          totalSessions: sessions,
          totalMessages: messages,
          totalDocuments: documents,
          totalConversations: conversations,
          totalTimeSpent: totalTimeSpent._sum.duration || 0,
          avgSessionDuration,
          daysSinceSignup,
          lastActiveAt: new Date(),
        },
        update: {
          totalSessions: sessions,
          totalMessages: messages,
          totalDocuments: documents,
          totalConversations: conversations,
          totalTimeSpent: totalTimeSpent._sum.duration || 0,
          avgSessionDuration,
          daysSinceSignup,
          lastActiveAt: new Date(),
        },
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error updating user lifetime value:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE USAGE LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log feature usage
   */
  async logFeatureUsage(data: {
    userId: string;
    featureName: string;
    featureCategory?: string;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
    sessionId?: string;
    conversationId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      return await prisma.featureUsageLog.create({
        data: {
          userId: data.userId,
          featureName: data.featureName,
          featureCategory: data.featureCategory,
          duration: data.duration,
          success: data.success ?? true,
          errorMessage: data.errorMessage,
          sessionId: data.sessionId,
          conversationId: data.conversationId,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      console.error('❌ [TRACKING] Error logging feature usage:', error);
      throw error;
    }
  }

  /**
   * Get feature usage statistics
   */
  async getFeatureUsageStats(days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const featureStats = await prisma.featureUsageLog.groupBy({
      by: ['featureName'],
      where: { usedAt: { gte: startDate } },
      _count: true,
      _avg: { duration: true },
    });

    return featureStats.map(stat => ({
      feature: stat.featureName,
      usageCount: stat._count,
      avgDuration: stat._avg.duration || 0,
    }));
  }
}

export const analyticsTrackingService = new AnalyticsTrackingService();
export default analyticsTrackingService;
