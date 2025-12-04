/**
 * Context Compression Service
 *
 * PURPOSE: Compress conversation context when approaching token limits
 * WHY: Prevent context overflow while preserving important information
 * HOW: Summarize old context, keep recent messages, prioritize relevance
 *
 * MANUS-STYLE ARCHITECTURE:
 * - Automatic compression when context grows large
 * - Preserve key information in summaries
 * - Progressive compression levels (light → medium → heavy)
 * - Never lose critical context
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Compression levels
export enum CompressionLevel {
  NONE = 0,
  LIGHT = 1,    // Summarize chunks, keep recent messages
  MEDIUM = 2,   // Aggressive chunk summarization, compress older recent messages
  HEAVY = 3     // Maximum compression, only keep essentials
}

// Token limits for triggering compression
const COMPRESSION_THRESHOLDS = {
  LIGHT: 150000,   // 75% of 200K budget
  MEDIUM: 170000,  // 85% of budget
  HEAVY: 185000    // 92.5% of budget
};

export interface CompressionResult {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  level: CompressionLevel;
  compressedContent: string;
}

/**
 * Determine compression level needed based on token count
 */
export function determineCompressionLevel(totalTokens: number): CompressionLevel {
  if (totalTokens >= COMPRESSION_THRESHOLDS.HEAVY) {
    return CompressionLevel.HEAVY;
  } else if (totalTokens >= COMPRESSION_THRESHOLDS.MEDIUM) {
    return CompressionLevel.MEDIUM;
  } else if (totalTokens >= COMPRESSION_THRESHOLDS.LIGHT) {
    return CompressionLevel.LIGHT;
  }
  return CompressionLevel.NONE;
}

/**
 * Compress conversation context
 *
 * STRATEGY:
 * - LIGHT: Summarize historical chunks more aggressively
 * - MEDIUM: Compress older recent messages, aggressive chunk summaries
 * - HEAVY: Keep only last 5 messages + critical summaries
 */
export async function compressContext(
  recentMessages: Array<{ role: string; content: string }>,
  historicalChunks: Array<{ summary: string; topics: string[] }>,
  level: CompressionLevel
): Promise<CompressionResult> {

  console.log(`🗜️ [COMPRESSION] Compressing context at level ${CompressionLevel[level]}`);
  console.log(`   Recent messages: ${recentMessages.length}, Historical chunks: ${historicalChunks.length}`);

  const originalContent = formatOriginalContent(recentMessages, historicalChunks);
  const originalTokens = estimateTokens(originalContent);

  let compressedContent = '';

  switch (level) {
    case CompressionLevel.LIGHT:
      compressedContent = await compressLight(recentMessages, historicalChunks);
      break;
    case CompressionLevel.MEDIUM:
      compressedContent = await compressMedium(recentMessages, historicalChunks);
      break;
    case CompressionLevel.HEAVY:
      compressedContent = await compressHeavy(recentMessages, historicalChunks);
      break;
    default:
      compressedContent = originalContent;
  }

  const compressedTokens = estimateTokens(compressedContent);
  const compressionRatio = originalTokens > 0 ? compressedTokens / originalTokens : 1;

  console.log(`🗜️ [COMPRESSION] ${originalTokens} → ${compressedTokens} tokens (${(compressionRatio * 100).toFixed(1)}%)`);

  return {
    originalTokens,
    compressedTokens,
    compressionRatio,
    level,
    compressedContent
  };
}

/**
 * LIGHT compression: Summarize historical chunks more aggressively
 */
async function compressLight(
  recentMessages: Array<{ role: string; content: string }>,
  historicalChunks: Array<{ summary: string; topics: string[] }>
): Promise<string> {

  let compressed = '## Recent Conversation\n\n';

  // Keep all recent messages in full
  compressed += recentMessages
    .map(m => `**${m.role === 'user' ? 'User' : 'KODA'}**: ${m.content}`)
    .join('\n\n');
  compressed += '\n\n';

  // Compress historical chunks into single summary
  if (historicalChunks.length > 0) {
    const historicalSummary = await summarizeChunks(historicalChunks);
    compressed += `## Earlier Discussion\n\n${historicalSummary}\n\n`;
  }

  return compressed;
}

/**
 * MEDIUM compression: Compress older recent messages + aggressive chunk summaries
 */
async function compressMedium(
  recentMessages: Array<{ role: string; content: string }>,
  historicalChunks: Array<{ summary: string; topics: string[] }>
): Promise<string> {

  let compressed = '';

  // Keep last 10 messages in full, summarize older ones
  if (recentMessages.length > 10) {
    const olderMessages = recentMessages.slice(0, -10);
    const recentTen = recentMessages.slice(-10);

    // Summarize older messages
    const olderSummary = await summarizeMessages(olderMessages);
    compressed += `## Earlier in Conversation\n\n${olderSummary}\n\n`;

    // Keep recent 10 in full
    compressed += '## Recent Messages\n\n';
    compressed += recentTen
      .map(m => `**${m.role === 'user' ? 'User' : 'KODA'}**: ${m.content}`)
      .join('\n\n');
    compressed += '\n\n';
  } else {
    // All messages are recent
    compressed += '## Recent Conversation\n\n';
    compressed += recentMessages
      .map(m => `**${m.role === 'user' ? 'User' : 'KODA'}**: ${m.content}`)
      .join('\n\n');
    compressed += '\n\n';
  }

  // Compress historical chunks heavily
  if (historicalChunks.length > 0) {
    const historicalSummary = await summarizeChunks(historicalChunks, true);
    compressed += `## Background Context\n\n${historicalSummary}\n\n`;
  }

  return compressed;
}

/**
 * HEAVY compression: Keep only last 5 messages + critical summaries
 */
async function compressHeavy(
  recentMessages: Array<{ role: string; content: string }>,
  historicalChunks: Array<{ summary: string; topics: string[] }>
): Promise<string> {

  let compressed = '';

  // Summarize all but last 5 messages
  if (recentMessages.length > 5) {
    const olderMessages = recentMessages.slice(0, -5);
    const recentFive = recentMessages.slice(-5);

    // Summarize older messages
    const olderSummary = await summarizeMessages(olderMessages);
    compressed += `## Conversation Summary\n\n${olderSummary}\n\n`;

    // Keep only last 5 messages
    compressed += '## Current Exchange\n\n';
    compressed += recentFive
      .map(m => `**${m.role === 'user' ? 'User' : 'KODA'}**: ${m.content}`)
      .join('\n\n');
    compressed += '\n\n';
  } else {
    compressed += '## Recent Conversation\n\n';
    compressed += recentMessages
      .map(m => `**${m.role === 'user' ? 'User' : 'KODA'}**: ${m.content}`)
      .join('\n\n');
    compressed += '\n\n';
  }

  // Only include most important historical chunks
  if (historicalChunks.length > 0) {
    const topChunks = historicalChunks.slice(0, 2); // Only top 2 most relevant
    const criticalSummary = await summarizeChunks(topChunks, true);
    compressed += `## Key Background\n\n${criticalSummary}\n\n`;
  }

  return compressed;
}

/**
 * Summarize conversation chunks using AI
 */
async function summarizeChunks(
  chunks: Array<{ summary: string; topics: string[] }>,
  aggressive: boolean = false
): Promise<string> {

  const chunkText = chunks
    .map((c, i) => `[Chunk ${i + 1}] Topics: ${c.topics.join(', ')}\n${c.summary}`)
    .join('\n\n');

  const prompt = aggressive
    ? `Summarize these conversation chunks into 2-3 sentences capturing only the most critical information:

${chunkText}

Critical summary:`
    : `Summarize these conversation chunks into a cohesive paragraph:

${chunkText}

Summary:`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { temperature: 0.3 }
    });

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error(`⚠️ [COMPRESSION] Chunk summarization failed:`, error);
    // Fallback: Just concatenate summaries
    return chunks.map(c => c.summary).join(' ');
  }
}

/**
 * Summarize messages using AI
 */
async function summarizeMessages(
  messages: Array<{ role: string; content: string }>
): Promise<string> {

  const messageText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const prompt = `Summarize this conversation exchange, preserving key information and context:

${messageText.substring(0, 5000)}

Concise summary:`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { temperature: 0.3 }
    });

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error(`⚠️ [COMPRESSION] Message summarization failed:`, error);
    // Fallback: Extract user queries only
    return messages
      .filter(m => m.role === 'user')
      .map(m => m.content.substring(0, 100))
      .join('; ');
  }
}

/**
 * Format original content for comparison
 */
function formatOriginalContent(
  recentMessages: Array<{ role: string; content: string }>,
  historicalChunks: Array<{ summary: string; topics: string[] }>
): string {

  let content = '## Recent Conversation\n\n';
  content += recentMessages
    .map(m => `**${m.role === 'user' ? 'User' : 'KODA'}**: ${m.content}`)
    .join('\n\n');
  content += '\n\n';

  if (historicalChunks.length > 0) {
    content += '## Earlier Discussion\n\n';
    content += historicalChunks
      .map((c, i) => `[${i + 1}] ${c.summary}`)
      .join('\n\n');
    content += '\n\n';
  }

  return content;
}

/**
 * Estimate token count (1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if compression is needed
 */
export function needsCompression(totalTokens: number): boolean {
  return totalTokens >= COMPRESSION_THRESHOLDS.LIGHT;
}

/**
 * Get compression statistics
 */
export function getCompressionStats(totalTokens: number): {
  needsCompression: boolean;
  recommendedLevel: CompressionLevel;
  utilizationPercent: number;
  tokensUntilCompression: number;
} {

  const needsComp = needsCompression(totalTokens);
  const level = determineCompressionLevel(totalTokens);
  const utilizationPercent = (totalTokens / 200000) * 100;
  const tokensUntilCompression = Math.max(0, COMPRESSION_THRESHOLDS.LIGHT - totalTokens);

  return {
    needsCompression: needsComp,
    recommendedLevel: level,
    utilizationPercent,
    tokensUntilCompression
  };
}

export default {
  compressContext,
  determineCompressionLevel,
  needsCompression,
  getCompressionStats,
  CompressionLevel
};
