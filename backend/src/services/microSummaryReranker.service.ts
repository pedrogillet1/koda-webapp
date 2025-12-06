/**
 * Micro-Summary Reranker Service
 * Priority: P2 (MEDIUM)
 * 
 * Reranks chunks using micro-summaries for better relevance.
 * Micro-summaries provide high-level context about chunks.
 * 
 * Key Functions:
 * - Generate micro-summaries for chunks
 * - Rerank chunks using micro-summaries
 * - Boost chunks with relevant micro-summaries
 * - Cache micro-summaries for performance
 */

import prisma from '../config/database';
import geminiClient from './geminiClient.service';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MicroSummary {
  chunkId: string;
  summary: string;
  keyTopics: string[];
  createdAt: Date;
}

export interface RerankedChunk {
  chunkId: string;
  content: string;
  originalScore: number;
  rerankScore: number;
  finalScore: number;
  microSummary?: string;
  metadata?: any;
}

export interface RerankOptions {
  useMicroSummaries?: boolean;
  microSummaryWeight?: number;
  topK?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rerank chunks using micro-summaries
 */
export async function rerankWithMicroSummaries(
  query: string,
  chunks: Array<{ id?: string; content: string; score: number; metadata?: any }>,
  options: RerankOptions = {}
): Promise<RerankedChunk[]> {
  const {
    useMicroSummaries = true,
    microSummaryWeight = 0.3,
    topK = 10,
  } = options;

  if (!useMicroSummaries || chunks.length === 0) {
    // Return chunks as-is
    return chunks.map(chunk => ({
      chunkId: chunk.id || '',
      content: chunk.content,
      originalScore: chunk.score,
      rerankScore: 0,
      finalScore: chunk.score,
      metadata: chunk.metadata,
    }));
  }

  // Get or generate micro-summaries for chunks
  const microSummaries = await getMicroSummariesForChunks(chunks);

  // Calculate rerank scores based on micro-summary relevance
  const rerankedChunks = await calculateRerankScores(
    query,
    chunks,
    microSummaries,
    microSummaryWeight
  );

  // Sort by final score and return top K
  return rerankedChunks
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);
}

/**
 * Generate micro-summary for a single chunk
 */
export async function generateMicroSummary(
  chunkContent: string,
  chunkId?: string
): Promise<MicroSummary> {
  try {
    const prompt = buildMicroSummaryPrompt(chunkContent);

    const result = await geminiClient.generateContent(prompt, {
      temperature: 0.3,
      maxOutputTokens: 150,
    });

    const responseText = result.response?.text() || '';
    const parsed = parseMicroSummaryResult(responseText);

    const microSummary: MicroSummary = {
      chunkId: chunkId || '',
      summary: parsed.summary,
      keyTopics: parsed.keyTopics,
      createdAt: new Date(),
    };

    // Cache micro-summary if chunkId is provided
    if (chunkId) {
      await cacheMicroSummary(chunkId, microSummary);
    }

    return microSummary;
  } catch (error) {
    console.error('[MicroSummaryReranker] Error generating micro-summary:', error);
    
    return {
      chunkId: chunkId || '',
      summary: chunkContent.slice(0, 100) + '...',
      keyTopics: [],
      createdAt: new Date(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get or generate micro-summaries for chunks
 */
async function getMicroSummariesForChunks(
  chunks: Array<{ id?: string; content: string }>
): Promise<Map<string, MicroSummary>> {
  const summaries = new Map<string, MicroSummary>();

  for (const chunk of chunks) {
    if (!chunk.id) {
      // Generate on-the-fly without caching
      const summary = await generateMicroSummary(chunk.content);
      summaries.set(chunk.content, summary);
      continue;
    }

    // Try to get from cache
    const cached = await getCachedMicroSummary(chunk.id);
    
    if (cached) {
      summaries.set(chunk.id, cached);
    } else {
      // Generate and cache
      const summary = await generateMicroSummary(chunk.content, chunk.id);
      summaries.set(chunk.id, summary);
    }
  }

  return summaries;
}

/**
 * Calculate rerank scores using micro-summaries
 */
async function calculateRerankScores(
  query: string,
  chunks: Array<{ id?: string; content: string; score: number; metadata?: any }>,
  microSummaries: Map<string, MicroSummary>,
  microSummaryWeight: number
): Promise<RerankedChunk[]> {
  const rerankedChunks: RerankedChunk[] = [];

  for (const chunk of chunks) {
    const key = chunk.id || chunk.content;
    const microSummary = microSummaries.get(key);

    if (!microSummary) {
      // No micro-summary, use original score
      rerankedChunks.push({
        chunkId: chunk.id || '',
        content: chunk.content,
        originalScore: chunk.score,
        rerankScore: 0,
        finalScore: chunk.score,
        metadata: chunk.metadata,
      });
      continue;
    }

    // Calculate relevance of micro-summary to query
    const rerankScore = calculateMicroSummaryRelevance(query, microSummary);

    // Combine original score with rerank score
    const finalScore = 
      chunk.score * (1 - microSummaryWeight) +
      rerankScore * microSummaryWeight;

    rerankedChunks.push({
      chunkId: chunk.id || '',
      content: chunk.content,
      originalScore: chunk.score,
      rerankScore,
      finalScore,
      microSummary: microSummary.summary,
      metadata: chunk.metadata,
    });
  }

  return rerankedChunks;
}

/**
 * Calculate relevance of micro-summary to query
 */
function calculateMicroSummaryRelevance(
  query: string,
  microSummary: MicroSummary
): number {
  const queryLower = query.toLowerCase();
  const summaryLower = microSummary.summary.toLowerCase();
  
  // Simple keyword matching
  const queryWords = queryLower.match(/\b\w{4,}\b/g) || [];
  const summaryWords = new Set(summaryLower.match(/\b\w{4,}\b/g) || []);
  
  const matchCount = queryWords.filter(word => summaryWords.has(word)).length;
  const matchRatio = matchCount / Math.max(queryWords.length, 1);
  
  // Boost if key topics match
  const topicBoost = microSummary.keyTopics.some(topic => 
    queryLower.includes(topic.toLowerCase())
  ) ? 0.2 : 0;
  
  return Math.min(matchRatio + topicBoost, 1.0);
}

/**
 * Build prompt for generating micro-summary
 */
function buildMicroSummaryPrompt(chunkContent: string): string {
  return `You are a micro-summarization system. Generate a very brief summary of the text chunk.

**Text Chunk:**
${chunkContent.slice(0, 1000)}

**Your Task:**
Generate a 1-2 sentence summary that captures the main topic and key information.
Extract 2-3 key topics.

**Output Format (JSON):**
{
  "summary": "<1-2 sentence summary>",
  "keyTopics": ["topic1", "topic2", "topic3"]
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Parse micro-summary result
 */
function parseMicroSummaryResult(text: string): { summary: string; keyTopics: string[] } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in micro-summary result');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      summary: parsed.summary || '',
      keyTopics: parsed.keyTopics || [],
    };
  } catch (error) {
    console.error('[MicroSummaryReranker] Error parsing micro-summary result:', error);
    
    return {
      summary: '',
      keyTopics: [],
    };
  }
}

/**
 * Cache micro-summary in database
 */
async function cacheMicroSummary(chunkId: string, microSummary: MicroSummary): Promise<void> {
  try {
    // Store in DocumentEmbedding metadata field (as JSON string)
    const existingEmb = await prisma.documentEmbedding.findUnique({
      where: { id: chunkId },
      select: { metadata: true },
    });

    let existingMetadata: Record<string, unknown> = {};
    if (existingEmb?.metadata) {
      try {
        existingMetadata = JSON.parse(existingEmb.metadata);
      } catch {
        existingMetadata = {};
      }
    }

    await prisma.documentEmbedding.update({
      where: { id: chunkId },
      data: {
        metadata: JSON.stringify({
          ...existingMetadata,
          microSummary: microSummary.summary,
          keyTopics: microSummary.keyTopics,
        }),
      },
    });
  } catch (error) {
    // Silently fail if caching doesn't work
    console.error('[MicroSummaryReranker] Error caching micro-summary:', error);
  }
}

/**
 * Get cached micro-summary from database
 */
async function getCachedMicroSummary(chunkId: string): Promise<MicroSummary | null> {
  try {
    const embedding = await prisma.documentEmbedding.findUnique({
      where: { id: chunkId },
      select: { metadata: true },
    });

    if (!embedding || !embedding.metadata) {
      return null;
    }

    const metadata = embedding.metadata as any;
    
    if (!metadata.microSummary) {
      return null;
    }

    return {
      chunkId,
      summary: metadata.microSummary,
      keyTopics: metadata.keyTopics || [],
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('[MicroSummaryReranker] Error getting cached micro-summary:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  rerankWithMicroSummaries,
  generateMicroSummary,
};
