/**
 * CONTEXT ENGINEERING SERVICE
 *
 * Optimizes context for LLM consumption by:
 * - Token-efficient packing
 * - Relevance-based prioritization
 * - Deduplication
 * - Smart truncation
 *
 * This replaces the stub in deletedServiceStubs.ts
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ContextChunk {
  content: string;
  documentId: string;
  documentTitle: string;
  score: number;
  pageNumber?: number;
  chunkIndex?: number;
}

export interface BuildContextParams {
  chunks: ContextChunk[];
  query: string;
  maxTokens?: number;
  includeMetadata?: boolean;
  prioritizeRecent?: boolean;
  deduplicateContent?: boolean;
}

export interface OptimizeContextParams {
  context: string;
  maxTokens?: number;
  preserveStructure?: boolean;
  removeRedundancy?: boolean;
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count (1 token ≈ 4 characters for English)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Remove duplicate or highly similar chunks
 */
function deduplicateChunks(chunks: ContextChunk[]): ContextChunk[] {

  const uniqueChunks: ContextChunk[] = [];
  const seenContent = new Set<string>();

  for (const chunk of chunks) {
    // Normalize content for comparison
    const normalized = chunk.content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    // Check for exact duplicates
    if (seenContent.has(normalized)) {
      console.log(`🔄 [DEDUP] Skipping duplicate chunk from ${chunk.documentTitle}`);
      continue;
    }

    // Check for high similarity (> 80% overlap)
    let isDuplicate = false;
    const existingArray = Array.from(seenContent);
    for (const existing of existingArray) {
      const similarity = calculateSimilarity(normalized, existing);
      if (similarity > 0.8) {
        console.log(`🔄 [DEDUP] Skipping similar chunk (${(similarity * 100).toFixed(0)}% match)`);
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueChunks.push(chunk);
      seenContent.add(normalized);
    }
  }

  console.log(`🔄 [DEDUP] Reduced ${chunks.length} chunks to ${uniqueChunks.length} unique chunks`);
  return uniqueChunks;
}

/**
 * Calculate similarity between two strings (Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const words1Array = Array.from(words1);
  const intersection = new Set(words1Array.filter(w => words2.has(w)));
  const union = new Set(words1Array.concat(Array.from(words2)));

  return intersection.size / union.size;
}

// ============================================================================
// RELEVANCE SCORING
// ============================================================================

/**
 * Re-score chunks based on query relevance
 */
function rescoreByRelevance(chunks: ContextChunk[], query: string): ContextChunk[] {

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const querySet = new Set(queryWords);

  return chunks.map(chunk => {
    const chunkWords = chunk.content.toLowerCase().split(/\s+/);
    const chunkSet = new Set(chunkWords);

    // Calculate keyword overlap
    const queryWordsArray = Array.from(querySet);
    const overlap = queryWordsArray.filter(w => chunkSet.has(w)).length;
    const relevanceBoost = overlap / Math.max(queryWords.length, 1);

    // Boost score based on relevance
    const newScore = chunk.score * (1 + relevanceBoost);

    return {
      ...chunk,
      score: newScore
    };
  });
}

// ============================================================================
// BUILD CONTEXT
// ============================================================================

/**
 * Build optimized context from chunks
 */
export function buildContext(params: BuildContextParams): string {

  const {
    chunks,
    query,
    maxTokens = 100000, // Default 100K tokens (match Manus)
    includeMetadata = true,
    prioritizeRecent = false,
    deduplicateContent = true
  } = params;

  console.log(`🏗️ [CONTEXT] Building context from ${chunks.length} chunks (max ${maxTokens} tokens)`);

  // Step 1: Deduplicate if requested
  let processedChunks = deduplicateContent ? deduplicateChunks(chunks) : [...chunks];

  // Step 2: Re-score by relevance
  processedChunks = rescoreByRelevance(processedChunks, query);

  // Step 3: Sort by score (highest first)
  processedChunks.sort((a, b) => {
    if (prioritizeRecent && a.documentId === b.documentId) {
      // Within same document, prioritize higher chunk index (more recent)
      return (b.chunkIndex || 0) - (a.chunkIndex || 0);
    }
    return b.score - a.score;
  });

  // Step 4: Pack chunks until token limit
  let context = '';
  let tokenCount = 0;
  const includedChunks: ContextChunk[] = [];

  for (const chunk of processedChunks) {
    // Format chunk with metadata
    let chunkText = '';

    if (includeMetadata) {
      chunkText = `**Document:** ${chunk.documentTitle}`;
      if (chunk.pageNumber) {
        chunkText += ` (Page ${chunk.pageNumber})`;
      }
      chunkText += `\n${chunk.content}\n\n`;
    } else {
      chunkText = `${chunk.content}\n\n`;
    }

    const chunkTokens = estimateTokens(chunkText);

    // Check if adding this chunk would exceed limit
    if (tokenCount + chunkTokens > maxTokens) {
      console.log(`🏗️ [CONTEXT] Reached token limit (${tokenCount}/${maxTokens}), stopping`);
      break;
    }

    context += chunkText;
    tokenCount += chunkTokens;
    includedChunks.push(chunk);
  }

  console.log(`🏗️ [CONTEXT] Built context with ${includedChunks.length} chunks (~${tokenCount} tokens)`);

  // Add summary header
  const uniqueDocs = new Set(includedChunks.map(c => c.documentTitle));
  const header = `## Retrieved Information (${includedChunks.length} chunks from ${uniqueDocs.size} documents)\n\n`;

  return header + context;
}

// ============================================================================
// OPTIMIZE CONTEXT
// ============================================================================

/**
 * Optimize existing context by removing redundancy and truncating
 */
export function optimizeContext(
  context: string,
  params?: OptimizeContextParams
): string {

  const {
    maxTokens = 100000,
    preserveStructure = true,
    removeRedundancy = true
  } = params || {};

  console.log(`⚙️ [OPTIMIZE] Optimizing context (${context.length} chars, max ${maxTokens} tokens)`);

  let optimized = context;

  // Step 1: Remove redundancy if requested
  if (removeRedundancy) {
    // Remove duplicate paragraphs
    const paragraphs = optimized.split(/\n\n+/);
    const uniqueParagraphs: string[] = [];
    const seenParagraphs = new Set<string>();

    for (const para of paragraphs) {
      const normalized = para.toLowerCase().trim();
      if (normalized.length > 0 && !seenParagraphs.has(normalized)) {
        uniqueParagraphs.push(para);
        seenParagraphs.add(normalized);
      }
    }

    optimized = uniqueParagraphs.join('\n\n');
    console.log(`⚙️ [OPTIMIZE] Removed ${paragraphs.length - uniqueParagraphs.length} duplicate paragraphs`);
  }

  // Step 2: Truncate if exceeds token limit
  const currentTokens = estimateTokens(optimized);
  if (currentTokens > maxTokens) {
    console.log(`⚙️ [OPTIMIZE] Truncating from ${currentTokens} to ${maxTokens} tokens`);

    if (preserveStructure) {
      // Truncate by paragraphs to preserve structure
      const paragraphs = optimized.split(/\n\n+/);
      let truncated = '';
      let tokens = 0;

      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para + '\n\n');
        if (tokens + paraTokens > maxTokens) {
          break;
        }
        truncated += para + '\n\n';
        tokens += paraTokens;
      }

      optimized = truncated;
      console.log(`⚙️ [OPTIMIZE] Preserved ${paragraphs.length} paragraphs within token limit`);
    } else {
      // Simple character-based truncation
      const targetChars = maxTokens * 4; // 1 token ≈ 4 chars
      optimized = optimized.substring(0, targetChars);
      console.log(`⚙️ [OPTIMIZE] Truncated to ${targetChars} characters`);
    }
  }

  // Step 3: Clean up formatting
  optimized = optimized
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/\s+$/gm, '') // Remove trailing whitespace
    .trim();

  const finalTokens = estimateTokens(optimized);
  console.log(`⚙️ [OPTIMIZE] Final context: ${optimized.length} chars, ~${finalTokens} tokens`);

  return optimized;
}

// ============================================================================
// CONTEXT QUALITY METRICS
// ============================================================================

/**
 * Calculate quality metrics for context
 */
export function calculateContextQuality(context: string, query: string): {
  coverage: number;
  relevance: number;
  diversity: number;
  quality: number;
} {

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/);

  // Coverage: How many query words are in context
  const matchedWords = queryWords.filter(w => contextLower.includes(w));
  const coverage = matchedWords.length / Math.max(queryWords.length, 1);

  // Relevance: Keyword density
  const keywordCount = queryWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = contextLower.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
  const relevance = Math.min(1, keywordCount / Math.max(contextWords.length, 1) * 100);

  // Diversity: Unique words ratio
  const uniqueWords = new Set(contextWords);
  const diversity = uniqueWords.size / Math.max(contextWords.length, 1);

  // Overall quality (weighted average)
  const quality = (coverage * 0.4) + (relevance * 0.3) + (diversity * 0.3);

  console.log(`📊 [QUALITY] Coverage: ${(coverage * 100).toFixed(0)}%, Relevance: ${(relevance * 100).toFixed(0)}%, Diversity: ${(diversity * 100).toFixed(0)}%, Quality: ${(quality * 100).toFixed(0)}%`);

  return { coverage, relevance, diversity, quality };
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const contextEngineering = {
  buildContext,
  optimizeContext,
  calculateContextQuality,
  estimateTokens
};

export default contextEngineering;
