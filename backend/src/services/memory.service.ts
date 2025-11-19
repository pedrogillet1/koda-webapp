/**
 * Memory Service - Cross-Session Memory System (ChatGPT-style)
 * Phase 3 Feature 3.1
 */

import { PrismaClient, Memory, MemorySection } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateMemoryInput {
  userId: string;
  section: MemorySection;
  content: string;
  importance?: number;
  source?: string;
  metadata?: any;
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  metadata?: any;
}

/**
 * Create a new memory
 */
export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  const { userId, section, content, importance = 5, source, metadata } = input;

  console.log(`=¾ [MEMORY] Creating memory for user ${userId.substring(0, 8)}... (${section})`);

  const memory = await prisma.memory.create({
    data: {
      userId,
      section,
      content,
      importance,
      source,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    },
  });

  console.log(` [MEMORY] Created memory ${memory.id} (importance: ${importance})`);

  return memory;
}

/**
 * Get all memories for a user, optionally filtered by section
 */
export async function getUserMemories(
  userId: string,
  section?: MemorySection,
  limit = 100
): Promise<Memory[]> {
  console.log(`=Ú [MEMORY] Fetching memories for user ${userId.substring(0, 8)}...${section ? ` (${section})` : ''}`);

  const memories = await prisma.memory.findMany({
    where: {
      userId,
      ...(section && { section }),
    },
    orderBy: [
      { importance: 'desc' },
      { lastAccessed: 'desc' },
    ],
    take: limit,
  });

  console.log(`=Ú [MEMORY] Found ${memories.length} memories`);

  return memories;
}

/**
 * Get relevant memories for a specific query or context
 * Uses importance and recency to select the most relevant memories
 */
export async function getRelevantMemories(
  userId: string,
  query?: string,
  sections?: MemorySection[],
  limit = 10
): Promise<Memory[]> {
  console.log(`= [MEMORY] Finding relevant memories for user ${userId.substring(0, 8)}...`);

  // Build where clause
  const where: any = { userId };
  if (sections && sections.length > 0) {
    where.section = { in: sections };
  }

  // Fetch memories ordered by importance and recency
  const memories = await prisma.memory.findMany({
    where,
    orderBy: [
      { importance: 'desc' },
      { accessCount: 'desc' },
      { lastAccessed: 'desc' },
    ],
    take: limit * 2, // Get more than needed for filtering
  });

  // If query is provided, filter by content relevance (simple keyword matching)
  let relevantMemories = memories;
  if (query) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

    relevantMemories = memories.map(memory => {
      const contentLower = memory.content.toLowerCase();

      // Calculate relevance score based on keyword matches
      let score = 0;
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 1;
        }
      }

      return { memory, score };
    })
    .filter(({ score }) => score > 0) // Only keep memories with matches
    .sort((a, b) => {
      // Sort by score first, then importance
      if (b.score !== a.score) return b.score - a.score;
      return b.memory.importance - a.memory.importance;
    })
    .slice(0, limit)
    .map(({ memory }) => memory);
  } else {
    relevantMemories = memories.slice(0, limit);
  }

  // Update access count and last accessed time
  const memoryIds = relevantMemories.map(m => m.id);
  if (memoryIds.length > 0) {
    await prisma.memory.updateMany({
      where: { id: { in: memoryIds } },
      data: {
        lastAccessed: new Date(),
        accessCount: { increment: 1 },
      },
    });
  }

  console.log(`= [MEMORY] Found ${relevantMemories.length} relevant memories`);

  return relevantMemories;
}

/**
 * Update an existing memory
 */
export async function updateMemory(
  memoryId: string,
  updates: UpdateMemoryInput
): Promise<Memory> {
  console.log(` [MEMORY] Updating memory ${memoryId}`);

  const memory = await prisma.memory.update({
    where: { id: memoryId },
    data: {
      ...(updates.content !== undefined && { content: updates.content }),
      ...(updates.importance !== undefined && { importance: updates.importance }),
      ...(updates.metadata !== undefined && {
        metadata: updates.metadata ? JSON.parse(JSON.stringify(updates.metadata)) : null
      }),
    },
  });

  console.log(` [MEMORY] Updated memory ${memoryId}`);

  return memory;
}

/**
 * Delete a memory
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  console.log(`=Ñ [MEMORY] Deleting memory ${memoryId}`);

  await prisma.memory.delete({
    where: { id: memoryId },
  });

  console.log(` [MEMORY] Deleted memory ${memoryId}`);
}

/**
 * Delete all memories for a user (optionally filtered by section)
 */
export async function deleteUserMemories(
  userId: string,
  section?: MemorySection
): Promise<number> {
  console.log(`=Ñ [MEMORY] Deleting memories for user ${userId.substring(0, 8)}...${section ? ` (${section})` : ''}`);

  const result = await prisma.memory.deleteMany({
    where: {
      userId,
      ...(section && { section }),
    },
  });

  console.log(` [MEMORY] Deleted ${result.count} memories`);

  return result.count;
}

/**
 * Format memories for inclusion in AI prompts
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) {
    return '';
  }

  const sectionGroups: { [key: string]: Memory[] } = {};

  // Group memories by section
  for (const memory of memories) {
    if (!sectionGroups[memory.section]) {
      sectionGroups[memory.section] = [];
    }
    sectionGroups[memory.section].push(memory);
  }

  let prompt = '**What I remember about you:**\n\n';

  // Section labels for better formatting
  const sectionLabels: { [key in MemorySection]: string } = {
    USER_PREFERENCES: 'Your Preferences',
    WORK_CONTEXT: 'Your Work Context',
    PERSONAL_FACTS: 'Personal Facts',
    GOALS: 'Your Goals',
    COMMUNICATION_STYLE: 'Communication Style',
    RELATIONSHIPS: 'Relationships',
  };

  // Format each section
  for (const [section, sectionMemories] of Object.entries(sectionGroups)) {
    const label = sectionLabels[section as MemorySection] || section;
    prompt += `**${label}:**\n`;

    for (const memory of sectionMemories) {
      prompt += `- ${memory.content}\n`;
    }

    prompt += '\n';
  }

  return prompt;
}

/**
 * Get memory statistics for a user
 */
export async function getMemoryStats(userId: string): Promise<{
  total: number;
  bySection: { [key in MemorySection]?: number };
  avgImportance: number;
  mostAccessed: Memory[];
}> {
  const memories = await prisma.memory.findMany({
    where: { userId },
  });

  const bySection: { [key in MemorySection]?: number } = {};
  let totalImportance = 0;

  for (const memory of memories) {
    bySection[memory.section] = (bySection[memory.section] || 0) + 1;
    totalImportance += memory.importance;
  }

  const mostAccessed = await prisma.memory.findMany({
    where: { userId },
    orderBy: { accessCount: 'desc' },
    take: 5,
  });

  return {
    total: memories.length,
    bySection,
    avgImportance: memories.length > 0 ? totalImportance / memories.length : 0,
    mostAccessed,
  };
}
