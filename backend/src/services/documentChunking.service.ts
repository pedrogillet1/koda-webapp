import { contextManager } from './optimizedContextManager';

/**
 * Document Chunking Service
 *
 * Handles large documents by breaking them into manageable chunks
 * and providing semantic search capabilities to find relevant sections.
 */

export interface DocumentChunk {
  index: number;
  text: string;
  tokenCount: number;
  startPosition: number;
  endPosition: number;
}

export interface SearchResult {
  chunkIndex: number;
  chunk: DocumentChunk;
  relevanceScore: number;
  matchedKeywords: string[];
}

/**
 * Split a large document into overlapping chunks
 * Overlap helps maintain context across chunk boundaries
 */
export function chunkDocument(
  text: string,
  maxTokensPerChunk: number = 8000,
  overlapTokens: number = 500
): DocumentChunk[] {
  console.log(`📚 Chunking document (${text.length} characters)...`);

  // Use the context manager's chunking method
  const chunkTexts = contextManager.chunkText(text, maxTokensPerChunk, overlapTokens);

  // Build chunk metadata
  const chunks: DocumentChunk[] = [];
  let currentPosition = 0;

  chunkTexts.forEach((chunkText, index) => {
    const tokenCount = contextManager.analyzeTokens(chunkText).tokens;
    const startPosition = currentPosition;
    const endPosition = currentPosition + chunkText.length;

    chunks.push({
      index,
      text: chunkText,
      tokenCount,
      startPosition,
      endPosition,
    });

    // Move position forward, accounting for overlap
    currentPosition = endPosition - Math.floor(overlapTokens * 4); // Rough char estimate
    if (currentPosition < 0) currentPosition = 0;
  });

  console.log(`✅ Created ${chunks.length} chunks with ~${overlapTokens} token overlap`);

  return chunks;
}

/**
 * Simple keyword-based semantic search
 * Finds chunks most relevant to a query by matching keywords
 */
export function searchChunks(
  chunks: DocumentChunk[],
  query: string,
  topK: number = 3
): SearchResult[] {
  console.log(`🔍 Searching ${chunks.length} chunks for: "${query}"`);

  // Extract keywords from query (simple approach: remove common words)
  const commonWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
    'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'what', 'where',
    'when', 'how', 'who', 'which', 'that', 'this', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
    'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might',
    'must', 'do', 'does', 'did', 'have', 'has', 'had', 'are', 'was', 'were',
    'been', 'be', 'am'
  ]);

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word));

  console.log(`  Keywords: [${keywords.join(', ')}]`);

  // Score each chunk based on keyword matches
  const results: SearchResult[] = chunks.map(chunk => {
    const chunkLower = chunk.text.toLowerCase();
    const matchedKeywords: string[] = [];
    let score = 0;

    keywords.forEach(keyword => {
      // Count occurrences of keyword
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = chunkLower.match(regex);

      if (matches) {
        matchedKeywords.push(keyword);
        // Score based on frequency (with diminishing returns)
        score += Math.log(matches.length + 1) * 10;

        // Bonus for exact phrase match
        if (query.toLowerCase().includes(keyword)) {
          score += 5;
        }
      }
    });

    // Bonus for matching multiple keywords
    if (matchedKeywords.length > 1) {
      score += matchedKeywords.length * 3;
    }

    // Normalize score by chunk length to avoid bias toward longer chunks
    const normalizedScore = score / Math.log(chunk.text.length + 1);

    return {
      chunkIndex: chunk.index,
      chunk,
      relevanceScore: normalizedScore,
      matchedKeywords,
    };
  });

  // Sort by relevance and return top K
  const topResults = results
    .filter(r => r.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);

  console.log(`✅ Found ${topResults.length} relevant chunks`);
  topResults.forEach((result, i) => {
    console.log(`  ${i + 1}. Chunk ${result.chunkIndex} (score: ${result.relevanceScore.toFixed(2)}, keywords: ${result.matchedKeywords.join(', ')})`);
  });

  return topResults;
}

/**
 * Extract context around a specific keyword or phrase
 * Useful for showing snippets with highlighted matches
 */
export function extractContext(
  text: string,
  searchTerm: string,
  contextChars: number = 200
): Array<{ excerpt: string; position: number }> {
  const searchLower = searchTerm.toLowerCase();
  const textLower = text.toLowerCase();
  const results: Array<{ excerpt: string; position: number }> = [];

  let startIndex = 0;
  let matchIndex: number;

  while ((matchIndex = textLower.indexOf(searchLower, startIndex)) !== -1) {
    const contextStart = Math.max(0, matchIndex - contextChars);
    const contextEnd = Math.min(text.length, matchIndex + searchTerm.length + contextChars);

    let excerpt = text.substring(contextStart, contextEnd);

    // Add ellipsis
    if (contextStart > 0) excerpt = '...' + excerpt;
    if (contextEnd < text.length) excerpt = excerpt + '...';

    results.push({
      excerpt,
      position: matchIndex,
    });

    startIndex = matchIndex + 1;
  }

  return results;
}

/**
 * Intelligent chunk selection for answering questions
 * Combines relevant chunks to maximize context while staying under token limit
 */
export function selectChunksForQuestion(
  chunks: DocumentChunk[],
  question: string,
  maxTokens: number = 35000
): DocumentChunk[] {
  // Search for most relevant chunks
  const searchResults = searchChunks(chunks, question, chunks.length);

  const selectedChunks: DocumentChunk[] = [];
  let totalTokens = 0;

  // Add chunks in order of relevance until we hit the token limit
  for (const result of searchResults) {
    if (totalTokens + result.chunk.tokenCount <= maxTokens) {
      selectedChunks.push(result.chunk);
      totalTokens += result.chunk.tokenCount;
    } else {
      break;
    }
  }

  // Sort selected chunks by original position (not relevance)
  // This maintains the document's logical flow
  selectedChunks.sort((a, b) => a.index - b.index);

  console.log(`✅ Selected ${selectedChunks.length} chunks (${totalTokens} tokens) for question`);

  return selectedChunks;
}

/**
 * Combine chunks into a single text with clear markers
 */
export function combineChunks(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) return '';

  if (chunks.length === 1) {
    return chunks[0].text;
  }

  // Add chunk markers for clarity
  const combined = chunks.map((chunk, index) => {
    return `[Chunk ${chunk.index + 1}]\n${chunk.text}`;
  }).join('\n\n---\n\n');

  return combined;
}

/**
 * Analyze document and determine if chunking is needed
 */
export function shouldChunkDocument(text: string, threshold: number = 40000): {
  shouldChunk: boolean;
  tokenCount: number;
  estimatedChunks: number;
} {
  const analysis = contextManager.analyzeTokens(text);

  const shouldChunk = analysis.tokens > threshold;
  const estimatedChunks = shouldChunk
    ? Math.ceil(analysis.tokens / 8000)
    : 1;

  return {
    shouldChunk,
    tokenCount: analysis.tokens,
    estimatedChunks,
  };
}
