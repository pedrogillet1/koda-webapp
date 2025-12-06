/**
 * Rolling Conversation Summary Service
 * Priority: P2 (MEDIUM)
 * 
 * Maintains a rolling summary of long conversations to preserve context
 * without exceeding token limits. Updates summary as conversation progresses.
 * 
 * Key Functions:
 * - Generate conversation summaries
 * - Update summaries incrementally
 * - Extract key entities and topics
 * - Compress conversation history
 */

import prisma from '../config/database';
import geminiClient from './geminiClient.service';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyTopics: string[];
  keyEntities: string[];
  lastUpdated: Date;
  messageCount: number;
}

export interface SummaryUpdateOptions {
  maxSummaryLength?: number;
  updateThreshold?: number; // Update after N new messages
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get or generate conversation summary
 */
export async function getConversationSummary(
  conversationId: string,
  options: SummaryUpdateOptions = {}
): Promise<ConversationSummary | null> {
  const {
    maxSummaryLength = 500,
    updateThreshold = 5,
  } = options;

  try {
    // Check if summary exists in database
    const existingSummary = await prisma.conversationContextState.findUnique({
      where: { conversationId },
    });

    // Get current message count
    const messageCount = await prisma.message.count({
      where: { conversationId },
    });

    // If summary exists and is recent, return it
    if (existingSummary && existingSummary.summary) {
      const messagesSinceUpdate = messageCount - (existingSummary.lastMessageCount || 0);
      
      if (messagesSinceUpdate < updateThreshold) {
        return {
          conversationId,
          summary: existingSummary.summary,
          keyTopics: existingSummary.keyTopics || [],
          keyEntities: existingSummary.keyEntities || [],
          lastUpdated: existingSummary.updatedAt,
          messageCount,
        };
      }
    }

    // Generate or update summary
    const newSummary = await generateSummary(conversationId, maxSummaryLength);

    // Get userId from conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    const userId = conversation?.userId || 'unknown';

    // Save to database
    await prisma.conversationContextState.upsert({
      where: { conversationId },
      create: {
        conversationId,
        userId,
        summary: newSummary.summary,
        keyTopics: newSummary.keyTopics,
        keyEntities: newSummary.keyEntities,
        lastMessageCount: messageCount,
      },
      update: {
        summary: newSummary.summary,
        keyTopics: newSummary.keyTopics,
        keyEntities: newSummary.keyEntities,
        lastMessageCount: messageCount,
      },
    });

    return {
      ...newSummary,
      conversationId,
      lastUpdated: new Date(),
      messageCount,
    };
  } catch (error) {
    console.error('[RollingConversationSummary] Error getting conversation summary:', error);
    return null;
  }
}

/**
 * Update conversation summary with new messages
 */
export async function updateConversationSummary(
  conversationId: string,
  newMessages: Array<{ role: string; content: string }>
): Promise<ConversationSummary | null> {
  try {
    // Get existing summary
    const existingSummary = await prisma.conversationContextState.findUnique({
      where: { conversationId },
    });

    const currentSummary = existingSummary?.summary || '';
    
    // Generate incremental update
    const updatedSummary = await incrementalSummaryUpdate(
      currentSummary,
      newMessages
    );

    // Get current message count
    const messageCount = await prisma.message.count({
      where: { conversationId },
    });

    // Get userId from conversation
    const conversationData = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    const userId = conversationData?.userId || 'unknown';

    // Save to database
    await prisma.conversationContextState.upsert({
      where: { conversationId },
      create: {
        conversationId,
        userId,
        summary: updatedSummary.summary,
        keyTopics: updatedSummary.keyTopics,
        keyEntities: updatedSummary.keyEntities,
        lastMessageCount: messageCount,
      },
      update: {
        summary: updatedSummary.summary,
        keyTopics: updatedSummary.keyTopics,
        keyEntities: updatedSummary.keyEntities,
        lastMessageCount: messageCount,
      },
    });

    return {
      conversationId,
      summary: updatedSummary.summary,
      keyTopics: updatedSummary.keyTopics,
      keyEntities: updatedSummary.keyEntities,
      lastUpdated: new Date(),
      messageCount,
    };
  } catch (error) {
    console.error('[RollingConversationSummary] Error updating conversation summary:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate conversation summary from scratch
 */
async function generateSummary(
  conversationId: string,
  maxLength: number
): Promise<Omit<ConversationSummary, 'conversationId' | 'lastUpdated' | 'messageCount'>> {
  try {
    // Get all messages
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
      },
    });

    if (messages.length === 0) {
      return {
        summary: '',
        keyTopics: [],
        keyEntities: [],
      };
    }

    // Build summary prompt
    const prompt = buildSummaryPrompt(messages, maxLength);

    // Call LLM to generate summary
    const result = await geminiClient.generateContent(prompt, {
      temperature: 0.3,
      maxOutputTokens: maxLength + 200,
    });

    const responseText = result.response?.text() || '';
    return parseSummaryResult(responseText);
  } catch (error) {
    console.error('[RollingConversationSummary] Error generating summary:', error);
    
    return {
      summary: '',
      keyTopics: [],
      keyEntities: [],
    };
  }
}

/**
 * Incrementally update summary with new messages
 */
async function incrementalSummaryUpdate(
  currentSummary: string,
  newMessages: Array<{ role: string; content: string }>
): Promise<Omit<ConversationSummary, 'conversationId' | 'lastUpdated' | 'messageCount'>> {
  if (newMessages.length === 0) {
    return {
      summary: currentSummary,
      keyTopics: [],
      keyEntities: [],
    };
  }

  const prompt = buildIncrementalUpdatePrompt(currentSummary, newMessages);

  try {
    const result = await geminiClient.generateContent(prompt, {
      temperature: 0.3,
      maxOutputTokens: 700,
    });

    const responseText = result.response?.text() || '';
    return parseSummaryResult(responseText);
  } catch (error) {
    console.error('[RollingConversationSummary] Error updating summary:', error);
    
    return {
      summary: currentSummary,
      keyTopics: [],
      keyEntities: [],
    };
  }
}

/**
 * Build prompt for generating summary
 */
function buildSummaryPrompt(
  messages: Array<{ role: string; content: string }>,
  maxLength: number
): string {
  const conversationText = messages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  return `You are a conversation summarization system. Generate a concise summary of the conversation.

**Conversation:**
${conversationText}

**Your Task:**
1. Summarize the main topics discussed (max ${maxLength} characters)
2. Extract key topics (3-5 topics)
3. Extract key entities (people, documents, concepts mentioned)

**Output Format (JSON):**
{
  "summary": "<concise summary>",
  "keyTopics": ["topic1", "topic2", ...],
  "keyEntities": ["entity1", "entity2", ...]
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Build prompt for incremental summary update
 */
function buildIncrementalUpdatePrompt(
  currentSummary: string,
  newMessages: Array<{ role: string; content: string }>
): string {
  const newMessagesText = newMessages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  return `You are a conversation summarization system. Update the existing summary with new messages.

**Current Summary:**
${currentSummary}

**New Messages:**
${newMessagesText}

**Your Task:**
Update the summary to include information from the new messages while keeping it concise.

**Output Format (JSON):**
{
  "summary": "<updated summary>",
  "keyTopics": ["topic1", "topic2", ...],
  "keyEntities": ["entity1", "entity2", ...]
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Parse summary result from LLM
 */
function parseSummaryResult(
  text: string
): Omit<ConversationSummary, 'conversationId' | 'lastUpdated' | 'messageCount'> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in summary result');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      summary: parsed.summary || '',
      keyTopics: parsed.keyTopics || [],
      keyEntities: parsed.keyEntities || [],
    };
  } catch (error) {
    console.error('[RollingConversationSummary] Error parsing summary result:', error);
    
    return {
      summary: '',
      keyTopics: [],
      keyEntities: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  getConversationSummary,
  updateConversationSummary,
};
