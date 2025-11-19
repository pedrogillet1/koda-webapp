/**
 * Memory Extraction Service - AI-Powered Memory Extraction
 * Uses Gemini AI to extract memorable facts from conversations
 * Phase 3 Feature 3.1
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { MemorySection } from '@prisma/client';
import * as memoryService from './memory.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface ExtractedMemory {
  section: MemorySection;
  content: string;
  importance: number;
  source: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Extract memories from a conversation using AI
 */
export async function extractMemoriesFromConversation(
  userId: string,
  messages: ConversationMessage[],
  conversationId?: string
): Promise<ExtractedMemory[]> {
  console.log(`>à [MEMORY EXTRACTION] Analyzing conversation for user ${userId.substring(0, 8)}...`);

  if (messages.length === 0) {
    return [];
  }

  try {
    const prompt = buildExtractionPrompt(messages);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log(`>à [MEMORY EXTRACTION] Raw AI response: ${responseText.substring(0, 200)}...`);

    const memories = parseMemoryResponse(responseText, conversationId);

    console.log(`>à [MEMORY EXTRACTION] Extracted ${memories.length} memories`);

    // Save memories to database
    for (const memory of memories) {
      await memoryService.createMemory({
        userId,
        section: memory.section,
        content: memory.content,
        importance: memory.importance,
        source: memory.source,
      });
    }

    return memories;
  } catch (error) {
    console.error('L [MEMORY EXTRACTION] Error:', error);
    return [];
  }
}

/**
 * Build the extraction prompt for Gemini AI
 */
function buildExtractionPrompt(messages: ConversationMessage[]): string {
  const conversationText = messages
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n\n');

  return `Analyze this conversation and extract important facts about the user that should be remembered for future conversations.

**Conversation**:
${conversationText}

**Instructions**:
1. Identify memorable facts about the user (preferences, work context, personal facts, goals, communication style, relationships)
2. Each memory should be:
   - A clear, standalone statement
   - Something that would be useful in future conversations
   - Not temporary information (e.g., "user is currently typing..." - NO)
3. Assign each memory to one of these sections:
   - USER_PREFERENCES: How the user likes things (e.g., "Prefers detailed explanations", "Likes code examples")
   - WORK_CONTEXT: The user's work, projects, or professional context (e.g., "Works as a software engineer", "Building a RAG system")
   - PERSONAL_FACTS: Personal information (e.g., "Lives in Portugal", "Speaks Portuguese")
   - GOALS: What the user is trying to achieve (e.g., "Wants to learn TypeScript", "Building a SaaS product")
   - COMMUNICATION_STYLE: How the user communicates (e.g., "Prefers concise answers", "Asks follow-up questions")
   - RELATIONSHIPS: People or entities the user mentions (e.g., "Works with Pedro on the backend", "Uses Google Cloud")
4. Rate importance from 1-10:
   - 8-10: Very important facts that should almost always be included
   - 5-7: Moderately important facts
   - 1-4: Nice-to-know facts
5. Only extract NEW information - don't repeat what's already known
6. If there's nothing worth remembering, return an empty list

**Output Format** (JSON):
{
  "memories": [
    {
      "section": "WORK_CONTEXT",
      "content": "User is building a cross-session memory system similar to ChatGPT",
      "importance": 8
    },
    {
      "section": "USER_PREFERENCES",
      "content": "Prefers TypeScript over JavaScript for type safety",
      "importance": 6
    }
  ]
}

Provide JSON only:`;
}

/**
 * Parse the AI response into memory objects
 */
function parseMemoryResponse(responseText: string, conversationId?: string): ExtractedMemory[] {
  try {
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const parsed = JSON.parse(jsonText);

    const memories: ExtractedMemory[] = (parsed.memories || []).map((m: any) => ({
      section: m.section as MemorySection,
      content: m.content,
      importance: m.importance || 5,
      source: conversationId || 'conversation',
    }));

    return memories;
  } catch (error) {
    console.error('L [MEMORY EXTRACTION] Parse error:', error);
    return [];
  }
}

/**
 * Determine if memories should be extracted from this conversation
 * Skip extraction for very short or trivial conversations
 */
export function shouldExtractMemories(messages: ConversationMessage[]): boolean {
  // Need at least 2 exchanges (4 messages)
  if (messages.length < 4) {
    return false;
  }

  // Count user messages
  const userMessages = messages.filter(m => m.role === 'user');

  // Need at least 2 user messages
  if (userMessages.length < 2) {
    return false;
  }

  // Calculate total conversation length
  const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);

  // Need at least 200 characters of conversation
  if (totalLength < 200) {
    return false;
  }

  return true;
}

/**
 * Extract memories from recent messages only (last N messages)
 */
export async function extractMemoriesFromRecentMessages(
  userId: string,
  messages: ConversationMessage[],
  conversationId?: string,
  recentMessageCount = 10
): Promise<ExtractedMemory[]> {
  // Only analyze the most recent messages
  const recentMessages = messages.slice(-recentMessageCount);

  if (!shouldExtractMemories(recentMessages)) {
    console.log(`>à [MEMORY EXTRACTION] Skipping extraction - conversation too short or trivial`);
    return [];
  }

  return extractMemoriesFromConversation(userId, recentMessages, conversationId);
}
