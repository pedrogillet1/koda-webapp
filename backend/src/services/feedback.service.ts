/**
 * Feedback Service
 * 
 * Handles thumbs up/down feedback for assistant messages.
 * 
 * Features:
 * - Store feedback with context (model, answer type, docs used, latency)
 * - Toggle feedback (clicking same thumb removes it)
 * - Track feedback in analytics
 * - Support for feedback reasons and comments
 */

import { prisma } from '../db/client';

export interface SaveFeedbackParams {
  userId: string;
  conversationId: string;
  messageId: string;
  rating: 'up' | 'down' | null;
  reason?: string;
  comment?: string;
}

export interface MessageMetadata {
  modelName?: string;
  answerType?: string;
  docsUsed?: string[];
  latencyMs?: number;
}

/**
 * Save or update message feedback
 */
export async function saveMessageFeedback(params: SaveFeedbackParams): Promise<void> {
  const { userId, conversationId, messageId, rating, reason, comment } = params;

  console.log(`[Feedback] User ${userId} rated message ${messageId}: ${rating}`);

  // Get message metadata (model, answer type, docs, latency)
  const meta = await getMessageMetadata(messageId);

  // If rating is null → remove feedback (toggle off)
  if (rating === null) {
    await prisma.messageFeedback.deleteMany({
      where: { userId, messageId },
    });

    console.log(`[Feedback] Cleared feedback for message ${messageId}`);

    // Track in analytics
    await trackFeedbackEvent('feedback_cleared', {
      userId,
      messageId,
      conversationId,
    });

    return;
  }

  // Convert rating to numeric: +1 for up, -1 for down
  const numericRating = rating === 'up' ? 1 : -1;

  // Upsert feedback record
  const record = await prisma.messageFeedback.upsert({
    where: {
      userId_messageId: {
        userId,
        messageId,
      },
    },
    update: {
      rating: numericRating,
      reason: reason || null,
      comment: comment || null,
      modelName: meta.modelName,
      answerType: meta.answerType,
      docsUsed: meta.docsUsed ? JSON.parse(JSON.stringify(meta.docsUsed)) : null,
      latencyMs: meta.latencyMs,
    },
    create: {
      userId,
      conversationId,
      messageId,
      rating: numericRating,
      reason: reason || null,
      comment: comment || null,
      modelName: meta.modelName,
      answerType: meta.answerType,
      docsUsed: meta.docsUsed ? JSON.parse(JSON.stringify(meta.docsUsed)) : null,
      latencyMs: meta.latencyMs,
    },
  });

  console.log(`[Feedback] Saved feedback:`, {
    id: record.id,
    rating: record.rating,
    reason: record.reason,
    modelName: record.modelName,
    answerType: record.answerType,
  });

  // Track in analytics
  await trackFeedbackEvent('message_feedback', {
    userId,
    messageId,
    conversationId,
    rating,
    reason,
    modelName: meta.modelName,
    answerType: meta.answerType,
    docsUsedCount: meta.docsUsed?.length || 0,
    latencyMs: meta.latencyMs,
  });
}

/**
 * Get message metadata for feedback context
 */
async function getMessageMetadata(messageId: string): Promise<MessageMetadata> {
  try {
    // Try to get from Message table if you store metadata there
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        metadata: true, // Assuming you have a metadata JSON field
      },
    });

    if (message?.metadata) {
      const meta = message.metadata as any;
      return {
        modelName: meta.modelName,
        answerType: meta.answerType,
        docsUsed: meta.docsUsed,
        latencyMs: meta.latencyMs,
      };
    }

    // Fallback: try to get from conversation context
    // You might store this differently in your system
    return {
      modelName: 'gemini-2.5-flash', // Default
      answerType: 'UNKNOWN',
      docsUsed: [],
      latencyMs: undefined,
    };
  } catch (error) {
    console.error('[Feedback] Error getting message metadata:', error);
    return {
      modelName: 'unknown',
      answerType: 'UNKNOWN',
      docsUsed: [],
      latencyMs: undefined,
    };
  }
}

/**
 * Track feedback event in analytics
 */
async function trackFeedbackEvent(eventName: string, data: any): Promise<void> {
  try {
    // Import analytics service dynamically to avoid circular dependencies
    const { trackEvent } = await import('./analyticsEngine.service');
    await trackEvent(eventName, data);
  } catch (error) {
    console.error('[Feedback] Error tracking analytics event:', error);
    // Don't throw - analytics failure shouldn't break feedback
  }
}

/**
 * Get feedback for a message
 */
export async function getMessageFeedback(
  userId: string,
  messageId: string
): Promise<{ rating: 'up' | 'down' | null; reason?: string; comment?: string } | null> {
  const feedback = await prisma.messageFeedback.findUnique({
    where: {
      userId_messageId: {
        userId,
        messageId,
      },
    },
  });

  if (!feedback) {
    return null;
  }

  return {
    rating: feedback.rating === 1 ? 'up' : 'down',
    reason: feedback.reason || undefined,
    comment: feedback.comment || undefined,
  };
}

/**
 * Get feedback for all messages in a conversation
 */
export async function getConversationFeedback(
  userId: string,
  conversationId: string
): Promise<Map<string, 'up' | 'down'>> {
  const feedbacks = await prisma.messageFeedback.findMany({
    where: {
      userId,
      conversationId,
    },
    select: {
      messageId: true,
      rating: true,
    },
  });

  const map = new Map<string, 'up' | 'down'>();
  feedbacks.forEach(f => {
    map.set(f.messageId, f.rating === 1 ? 'up' : 'down');
  });

  return map;
}

/**
 * Get satisfaction score for a period
 */
export async function getSatisfactionScore(params: {
  from: Date;
  to: Date;
  modelName?: string;
  answerType?: string;
}): Promise<{ total: number; positive: number; score: number | null }> {
  const where: any = {
    createdAt: {
      gte: params.from,
      lte: params.to,
    },
  };

  if (params.modelName) {
    where.modelName = params.modelName;
  }

  if (params.answerType) {
    where.answerType = params.answerType;
  }

  const total = await prisma.messageFeedback.count({ where });
  const positive = await prisma.messageFeedback.count({
    where: {
      ...where,
      rating: 1,
    },
  });

  const score = total === 0 ? null : positive / total;

  return { total, positive, score };
}

/**
 * Get negative feedback with reasons
 */
export async function getNegativeFeedback(params: {
  from: Date;
  to: Date;
  limit?: number;
}): Promise<Array<{
  id: string;
  messageId: string;
  reason: string | null;
  comment: string | null;
  modelName: string | null;
  answerType: string | null;
  createdAt: Date;
}>> {
  const feedbacks = await prisma.messageFeedback.findMany({
    where: {
      rating: -1,
      createdAt: {
        gte: params.from,
        lte: params.to,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: params.limit || 100,
    select: {
      id: true,
      messageId: true,
      reason: true,
      comment: true,
      modelName: true,
      answerType: true,
      createdAt: true,
    },
  });

  return feedbacks;
}

/**
 * Get feedback breakdown by reason
 */
export async function getFeedbackBreakdown(params: {
  from: Date;
  to: Date;
}): Promise<Record<string, number>> {
  const feedbacks = await prisma.messageFeedback.findMany({
    where: {
      rating: -1, // Only negative feedback
      createdAt: {
        gte: params.from,
        lte: params.to,
      },
      reason: {
        not: null,
      },
    },
    select: {
      reason: true,
    },
  });

  const breakdown: Record<string, number> = {};
  feedbacks.forEach(f => {
    if (f.reason) {
      breakdown[f.reason] = (breakdown[f.reason] || 0) + 1;
    }
  });

  return breakdown;
}
