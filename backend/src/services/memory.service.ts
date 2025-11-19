/**
 * Memory Service - ChatGPT-style Conversational Memory
 *
 * This service manages user memory across conversations:
 * 1. User Profile - Basic information
 * 2. User Preferences - Response style preferences
 * 3. Conversation Topics - Past discussion themes
 * 4. User Insights - Learned patterns
 * 5. Recent Conversations - Last 40 conversation summaries
 * 6. Interaction Metadata - Usage patterns
 */

import prisma from '../config/database';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ════════════════════════════════════════════════════════════════════════════════
// MEMORY EXTRACTION - Analyze conversations to extract insights
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Extract memory insights from a conversation
 */
export async function extractMemoryFromConversation(
  conversationId: string,
  userId: string
): Promise<void> {

  console.log(`🧠 [MEMORY] Extracting insights from conversation ${conversationId}`);

  // Get conversation messages
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true }
  });

  if (messages.length < 2) {
    console.log(`🧠 [MEMORY] Conversation too short, skipping`);
    return;
  }

  // Build conversation text
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Extract insights using Gemini
  const prompt = `
Analyze this conversation and extract user insights in JSON format.

Conversation:
${conversationText}

Extract:
1. User preferences (how they like responses formatted, level of detail, etc.)
2. Topics discussed (high-level themes)
3. User insights (expertise, interests, patterns, goals)
4. Conversation summary (1-2 sentences)

Return JSON:
{
  "preferences": [
    {"type": "response_format", "value": "bullet_points", "confidence": 0.8, "evidence": "User asked for bullet points 3 times"}
  ],
  "topics": [
    {"summary": "User analyzes financial documents frequently", "confidence": 0.9}
  ],
  "insights": [
    {"type": "expertise", "text": "User has accounting expertise", "confidence": 0.7, "evidence": "Used accounting terminology"}
  ],
  "summary": "User analyzed quarterly financial reports and asked about tax implications"
}
`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  });

  const response = await model.generateContent(prompt);
  const insights = JSON.parse(response.response.text() || '{}');

  // Store preferences
  for (const pref of insights.preferences || []) {
    await upsertPreference(userId, pref.type, pref.value, pref.confidence, pref.evidence);
  }

  // Store topics
  for (const topic of insights.topics || []) {
    await upsertTopic(userId, topic.summary, topic.confidence);
  }

  // Store insights
  for (const insight of insights.insights || []) {
    await upsertInsight(userId, insight.type, insight.text, insight.confidence, insight.evidence);
  }

  // Store conversation summary
  await storeConversationSummary(
    userId,
    conversationId,
    insights.summary || 'Conversation about documents',
    messages.filter(m => m.role === 'user').map(m => m.content)
  );

  console.log(`🧠 [MEMORY] Extracted ${insights.preferences?.length || 0} preferences, ${insights.topics?.length || 0} topics, ${insights.insights?.length || 0} insights`);
}

/**
 * Upsert user preference
 */
async function upsertPreference(
  userId: string,
  type: string,
  value: string,
  confidence: number,
  evidence?: string
): Promise<void> {

  const existing = await prisma.userPreference.findFirst({
    where: { userId, preferenceType: type, preferenceValue: value }
  });

  if (existing) {
    // Update confidence (weighted average)
    const newConfidence = (existing.confidence + confidence) / 2;

    await prisma.userPreference.update({
      where: { id: existing.id },
      data: {
        confidence: newConfidence,
        evidence: evidence || existing.evidence,
        updatedAt: new Date()
      }
    });
  } else {
    await prisma.userPreference.create({
      data: {
        userId,
        preferenceType: type,
        preferenceValue: value,
        confidence,
        evidence
      }
    });
  }
}

/**
 * Upsert conversation topic
 */
async function upsertTopic(
  userId: string,
  summary: string,
  confidence: number
): Promise<void> {

  const existing = await prisma.conversationTopic.findFirst({
    where: { userId, topicSummary: summary }
  });

  if (existing) {
    await prisma.conversationTopic.update({
      where: { id: existing.id },
      data: {
        lastSeen: new Date(),
        frequency: existing.frequency + 1,
        confidence: (existing.confidence + confidence) / 2
      }
    });
  } else {
    await prisma.conversationTopic.create({
      data: {
        userId,
        topicSummary: summary,
        firstSeen: new Date(),
        lastSeen: new Date(),
        frequency: 1,
        confidence
      }
    });
  }
}

/**
 * Upsert user insight
 */
async function upsertInsight(
  userId: string,
  type: string,
  text: string,
  confidence: number,
  evidence?: string
): Promise<void> {

  const existing = await prisma.userInsight.findFirst({
    where: { userId, insightType: type, insightText: text }
  });

  if (existing) {
    await prisma.userInsight.update({
      where: { id: existing.id },
      data: {
        confidence: (existing.confidence + confidence) / 2,
        evidence: evidence || existing.evidence,
        updatedAt: new Date()
      }
    });
  } else {
    await prisma.userInsight.create({
      data: {
        userId,
        insightType: type,
        insightText: text,
        confidence,
        evidence
      }
    });
  }
}

/**
 * Store conversation summary
 */
async function storeConversationSummary(
  userId: string,
  conversationId: string,
  summary: string,
  userMessages: string[]
): Promise<void> {

  await prisma.conversationSummary.create({
    data: {
      userId,
      conversationId,
      summary,
      userMessages,
      timestamp: new Date()
    }
  });

  // Keep only last 40 summaries
  const summaries = await prisma.conversationSummary.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    skip: 40
  });

  if (summaries.length > 0) {
    await prisma.conversationSummary.deleteMany({
      where: { id: { in: summaries.map(s => s.id) } }
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// MEMORY RETRIEVAL - Build memory context for system prompt
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Build memory context for user (ChatGPT-style 6 sections)
 */
export async function buildMemoryContext(userId: string): Promise<string> {

  console.log(`🧠 [MEMORY] Building memory context for user ${userId}`);

  // Get all memory components
  const [profile, preferences, topics, insights, summaries, metadata] = await Promise.all([
    getUserProfile(userId),
    getUserPreferences(userId),
    getConversationTopics(userId),
    getUserInsights(userId),
    getRecentConversations(userId),
    getInteractionMetadata(userId)
  ]);

  // Build memory context (ChatGPT-style)
  let context = '';

  // Section 1: User Profile
  if (profile) {
    context += `## 1. User Profile\n\n`;
    if (profile.name) context += `- Name: ${profile.name}\n`;
    if (profile.role) context += `- Role: ${profile.role}\n`;
    if (profile.organization) context += `- Organization: ${profile.organization}\n`;
    if (profile.expertiseLevel) context += `- Expertise Level: ${profile.expertiseLevel}\n`;
    context += `\n`;
  }

  // Section 2: Response Preferences
  if (preferences.length > 0) {
    context += `## 2. Response Preferences\n\n`;
    context += `These notes reflect user preferences based on past conversations. Use them to improve response quality.\n\n`;
    preferences.forEach((pref, i) => {
      context += `${i + 1}. ${pref.preferenceType}: ${pref.preferenceValue}`;
      if (pref.evidence) context += ` (${pref.evidence})`;
      context += ` | Confidence=${pref.confidence.toFixed(2)}\n`;
    });
    context += `\n`;
  }

  // Section 3: Notable Past Topics
  if (topics.length > 0) {
    context += `## 3. Notable Past Conversation Topics\n\n`;
    context += `Below are high-level topic notes from past conversations. Use them to maintain continuity.\n\n`;
    topics.forEach((topic, i) => {
      context += `${i + 1}. ${topic.topicSummary} (${topic.frequency} times, last seen: ${topic.lastSeen.toLocaleDateString()}) | Confidence=${topic.confidence.toFixed(2)}\n`;
    });
    context += `\n`;
  }

  // Section 4: User Insights
  if (insights.length > 0) {
    context += `## 4. Helpful User Insights\n\n`;
    insights.forEach((insight, i) => {
      context += `${i + 1}. ${insight.insightText}`;
      if (insight.evidence) context += ` (${insight.evidence})`;
      context += ` | Confidence=${insight.confidence.toFixed(2)}\n`;
    });
    context += `\n`;
  }

  // Section 5: Recent Conversations
  if (summaries.length > 0) {
    context += `## 5. Recent Conversation Content\n\n`;
    summaries.forEach((summary, i) => {
      const timestamp = summary.timestamp.toISOString().substring(0, 13).replace('T', ' ');
      context += `${i + 1}. ${timestamp} ${summary.summary}:||||${summary.userMessages.join('||||')}\n`;
    });
    context += `\n`;
  }

  // Section 6: Interaction Metadata
  if (metadata.length > 0) {
    context += `## 6. User Interaction Metadata\n\n`;
    metadata.forEach((meta, i) => {
      context += `${i + 1}. ${meta.metadataType}: ${meta.metadataValue}\n`;
    });
    context += `\n`;
  }

  console.log(`🧠 [MEMORY] Built memory context with ${preferences.length} preferences, ${topics.length} topics, ${insights.length} insights`);

  return context;
}

/**
 * Get user profile
 */
async function getUserProfile(userId: string) {
  return await prisma.userProfile.findUnique({
    where: { userId }
  });
}

/**
 * Get user preferences (top 15)
 */
async function getUserPreferences(userId: string) {
  return await prisma.userPreference.findMany({
    where: { userId },
    orderBy: { confidence: 'desc' },
    take: 15
  });
}

/**
 * Get conversation topics (top 8)
 */
async function getConversationTopics(userId: string) {
  return await prisma.conversationTopic.findMany({
    where: { userId },
    orderBy: { lastSeen: 'desc' },
    take: 8
  });
}

/**
 * Get user insights (top 14)
 */
async function getUserInsights(userId: string) {
  return await prisma.userInsight.findMany({
    where: { userId },
    orderBy: { confidence: 'desc' },
    take: 14
  });
}

/**
 * Get recent conversations (last 40)
 */
async function getRecentConversations(userId: string) {
  return await prisma.conversationSummary.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: 40
  });
}

/**
 * Get interaction metadata
 */
async function getInteractionMetadata(userId: string) {
  return await prisma.interactionMetadata.findMany({
    where: { userId }
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// MEMORY MANAGEMENT - User-facing functions
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Get user's memory for display in UI
 */
export async function getUserMemory(userId: string) {
  const [profile, preferences, topics, insights] = await Promise.all([
    getUserProfile(userId),
    getUserPreferences(userId),
    getConversationTopics(userId),
    getUserInsights(userId)
  ]);

  return {
    profile,
    preferences,
    topics,
    insights
  };
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: { name?: string; role?: string; organization?: string; expertiseLevel?: string }
) {
  return await prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data }
  });
}

/**
 * Delete specific memory
 */
export async function deleteMemory(
  userId: string,
  type: 'preference' | 'topic' | 'insight',
  id: string
) {
  switch (type) {
    case 'preference':
      await prisma.userPreference.delete({ where: { id } });
      break;
    case 'topic':
      await prisma.conversationTopic.delete({ where: { id } });
      break;
    case 'insight':
      await prisma.userInsight.delete({ where: { id } });
      break;
  }
}

/**
 * Clear all user memory
 */
export async function clearAllMemory(userId: string) {
  await Promise.all([
    prisma.userPreference.deleteMany({ where: { userId } }),
    prisma.conversationTopic.deleteMany({ where: { userId } }),
    prisma.userInsight.deleteMany({ where: { userId } }),
    prisma.conversationSummary.deleteMany({ where: { userId } }),
    prisma.interactionMetadata.deleteMany({ where: { userId } })
  ]);
}
