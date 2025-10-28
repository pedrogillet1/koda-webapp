/**
 * Relevance Scorer Service
 * Multi-factor relevance scoring for Issue #5 (Relevance & Document Selection)
 * Enhanced for Task #8: Added path/folder and tag awareness
 * Scores chunks using 8 factors: semantic similarity, keyword match, title match,
 * recency, engagement, completeness, folder/path relevance, tag match
 */

import { RelevanceFactors, ScoredChunk, EnhancedChunkMetadata } from '../types/rag.types';
import { calculateTextSimilarity } from '../utils/rag.utils';

interface ChunkWithMetadata {
  content: string;
  metadata: Partial<EnhancedChunkMetadata>;
  similarity?: number;
  [key: string]: any;
}

class RelevanceScorerService {
  /**
   * Score a chunk using all 6 relevance factors
   */
  async scoreChunk(
    chunk: ChunkWithMetadata,
    query: string,
    options: {
      enableRecencyBoost?: boolean;
      enableEngagementBoost?: boolean;
      weights?: Partial<Record<keyof RelevanceFactors, number>>;
    } = {}
  ): Promise<ScoredChunk> {
    const {
      enableRecencyBoost = true,
      enableEngagementBoost = false,
      weights = {}
    } = options;

    // Default weights (must sum to 1.0) - Task #8 Enhanced
    const defaultWeights = {
      semanticSimilarity: 0.35,  // 35% - Most important
      keywordMatch: 0.20,        // 20%
      titleMatch: 0.12,          // 12%
      recency: 0.10,             // 10%
      folderPathMatch: 0.10,     // 10% - NEW: Task #8
      tagMatch: 0.08,            // 8% - NEW: Task #8
      userEngagement: 0.03,      // 3%
      completeness: 0.02         // 2%
    };

    const finalWeights = { ...defaultWeights, ...weights };

    // Calculate individual factors (Task #8: Added folder and tag factors)
    const factors: RelevanceFactors = {
      semanticSimilarity: this.calculateSemanticSimilarity(chunk, query),
      keywordMatch: this.calculateKeywordMatch(chunk.content, query),
      titleMatch: this.calculateTitleMatch(chunk.metadata, query),
      recency: enableRecencyBoost ? this.calculateRecencyScore(chunk.metadata) : 0,
      folderPathMatch: this.calculateFolderPathScore(chunk.metadata, query), // NEW: Task #8
      tagMatch: this.calculateTagMatchScore(chunk.metadata, query), // NEW: Task #8
      userEngagement: enableEngagementBoost ? this.calculateEngagementScore(chunk.metadata) : 0,
      completeness: this.calculateCompletenessScore(chunk.content)
    };

    // Calculate weighted total score (Task #8: Include new factors)
    const totalScore =
      (factors.semanticSimilarity * finalWeights.semanticSimilarity) +
      (factors.keywordMatch * finalWeights.keywordMatch) +
      (factors.titleMatch * finalWeights.titleMatch) +
      (factors.recency * finalWeights.recency) +
      (factors.folderPathMatch * finalWeights.folderPathMatch) +
      (factors.tagMatch * finalWeights.tagMatch) +
      (factors.userEngagement * finalWeights.userEngagement) +
      (factors.completeness * finalWeights.completeness);

    // Generate explanation
    const explanation = this.generateExplanation(factors, finalWeights);

    return {
      chunk: chunk,
      relevanceScore: Math.min(100, Math.max(0, totalScore * 100)), // Convert to 0-100 scale
      relevanceFactors: factors,
      relevanceExplanation: explanation
    };
  }

  /**
   * Score multiple chunks and sort by relevance
   */
  async scoreChunks(
    chunks: ChunkWithMetadata[],
    query: string,
    options: {
      enableRecencyBoost?: boolean;
      enableEngagementBoost?: boolean;
      weights?: Partial<Record<keyof RelevanceFactors, number>>;
      limit?: number;
    } = {}
  ): Promise<ScoredChunk[]> {
    const { limit } = options;

    console.log(`\n🎯 [Relevance Scorer] Scoring ${chunks.length} chunks...`);

    // Score all chunks
    const scoredChunks = await Promise.all(
      chunks.map(chunk => this.scoreChunk(chunk, query, options))
    );

    // Sort by relevance (highest first)
    scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Log top scores
    console.log(`   Top scores:`);
    scoredChunks.slice(0, 3).forEach((scored, index) => {
      console.log(`   ${index + 1}. ${scored.relevanceScore.toFixed(1)}% - ${scored.relevanceExplanation}`);
    });

    // Return limited results if specified
    return limit ? scoredChunks.slice(0, limit) : scoredChunks;
  }

  /**
   * Factor 1: Semantic Similarity (from vector search)
   * Uses the similarity score from Pinecone
   */
  private calculateSemanticSimilarity(chunk: ChunkWithMetadata, query: string): number {
    // If chunk already has a similarity score from Pinecone, use it
    if (chunk.similarity !== undefined && chunk.similarity !== null) {
      return chunk.similarity;
    }

    // Fallback: use text similarity
    return calculateTextSimilarity(query.toLowerCase(), chunk.content.toLowerCase());
  }

  /**
   * Factor 2: Keyword Match (BM25F-inspired)
   * Checks for exact keyword matches in content
   */
  private calculateKeywordMatch(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3); // Only words longer than 3 chars

    if (queryWords.length === 0) {
      return 0;
    }

    let matchCount = 0;
    const contentWords = contentLower.split(/\s+/);

    for (const queryWord of queryWords) {
      // Check for exact match
      if (contentWords.includes(queryWord)) {
        matchCount += 1.0;
      }
      // Check for partial match (word starts with query word)
      else if (contentWords.some(w => w.startsWith(queryWord))) {
        matchCount += 0.5;
      }
    }

    // Normalize by number of query words
    return matchCount / queryWords.length;
  }

  /**
   * Factor 3: Title Match
   * Checks if query matches document filename or title
   */
  private calculateTitleMatch(metadata: Partial<EnhancedChunkMetadata>, query: string): number {
    const queryLower = query.toLowerCase();
    const filename = metadata.filename?.toLowerCase() || '';
    const originalName = metadata.originalName?.toLowerCase() || '';

    let score = 0;

    // Exact match in filename
    if (filename.includes(queryLower) || originalName.includes(queryLower)) {
      score = 1.0;
    }
    // Partial match
    else {
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
      const matchCount = queryWords.filter(word =>
        filename.includes(word) || originalName.includes(word)
      ).length;

      if (queryWords.length > 0) {
        score = matchCount / queryWords.length;
      }
    }

    return score;
  }

  /**
   * Factor 4: Recency Score
   * More recent documents get higher scores (exponential decay)
   */
  private calculateRecencyScore(metadata: Partial<EnhancedChunkMetadata>): number {
    if (!metadata.createdAt) {
      return 0.5; // Neutral score if no date
    }

    const now = Date.now();
    const createdDate = new Date(metadata.createdAt).getTime();
    const ageInDays = (now - createdDate) / (1000 * 60 * 60 * 24);

    // Exponential decay: score = e^(-age/30)
    // Documents from today: ~1.0
    // Documents from 30 days ago: ~0.37
    // Documents from 90 days ago: ~0.05
    const halfLifeDays = 30;
    const score = Math.exp(-ageInDays / halfLifeDays);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Factor 5: User Engagement Score
   * Based on view count, time spent, etc. (if tracked)
   */
  private calculateEngagementScore(metadata: Partial<EnhancedChunkMetadata>): number {
    // Placeholder: would use actual engagement metrics if available
    // For now, return neutral score
    // TODO: Track document views, time spent, bookmarks, etc.
    return 0.5;
  }

  /**
   * Factor 6: Completeness Score
   * Longer, more complete chunks score higher
   */
  private calculateCompletenessScore(content: string): number {
    const wordCount = content.split(/\s+/).length;

    // Ideal chunk size: 200-500 words
    // Too short (<100 words): Lower score
    // Too long (>1000 words): Lower score
    // Just right (200-500 words): Higher score

    if (wordCount < 100) {
      return wordCount / 100; // 0.0 - 1.0
    } else if (wordCount >= 100 && wordCount <= 500) {
      return 1.0; // Optimal size
    } else if (wordCount > 500 && wordCount <= 1000) {
      return 1.0 - ((wordCount - 500) / 500) * 0.3; // 1.0 - 0.7
    } else {
      return 0.5; // Very long chunks
    }
  }

  /**
   * TASK #8: Factor 7: Folder/Path Relevance Score
   * Boost documents from relevant folders or categories
   */
  private calculateFolderPathScore(metadata: Partial<EnhancedChunkMetadata>, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0.5; // Neutral score if no folder/category info

    // Check folder path match
    const folderPath = metadata.folderPath?.toLowerCase() || '';
    const categoryName = metadata.categoryName?.toLowerCase() || '';

    // Extract potential folder/category keywords from query
    const folderKeywords = [
      'financial', 'finance', 'accounting', 'budget',
      'legal', 'contract', 'agreement',
      'hr', 'human resources', 'employee', 'payroll',
      'marketing', 'sales', 'customer',
      'technical', 'engineering', 'design',
      'operations', 'logistics', 'supply',
      'research', 'analysis', 'report'
    ];

    // Check if query contains folder/category-related keywords
    for (const keyword of folderKeywords) {
      if (queryLower.includes(keyword)) {
        // Check if folder path or category contains this keyword
        if (folderPath.includes(keyword) || categoryName.includes(keyword)) {
          score = 1.0; // High boost for folder match
          break;
        }
      }
    }

    // Also check for exact folder/category name in query
    if (folderPath && queryLower.includes(folderPath)) {
      score = 1.0;
    } else if (categoryName && queryLower.includes(categoryName)) {
      score = 1.0;
    }

    // Partial folder path matching (check each segment)
    if (score < 1.0 && folderPath) {
      const folderSegments = folderPath.split('/').filter(s => s.length > 0);
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

      let matchingSegments = 0;
      for (const segment of folderSegments) {
        if (queryWords.some(word => segment.includes(word) || word.includes(segment))) {
          matchingSegments++;
        }
      }

      if (folderSegments.length > 0) {
        score = Math.max(score, 0.5 + (matchingSegments / folderSegments.length) * 0.5);
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * TASK #8: Factor 8: Tag Match Score
   * Boost documents with relevant tags
   */
  private calculateTagMatchScore(metadata: Partial<EnhancedChunkMetadata>, query: string): number {
    // Check if metadata has tags (could be array or comma-separated string)
    const tags = metadata.tags || [];

    if (!Array.isArray(tags) || tags.length === 0) {
      return 0.5; // Neutral score if no tags
    }

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

    let matchCount = 0;
    let totalTags = tags.length;

    // Check each tag against query
    for (const tag of tags) {
      const tagLower = (typeof tag === 'string' ? tag : tag.name || '').toLowerCase();

      // Exact tag match in query
      if (queryLower.includes(tagLower)) {
        matchCount += 1.0;
        continue;
      }

      // Partial tag match (tag word in query)
      const tagWords = tagLower.split(/\s+|-|_/);
      for (const tagWord of tagWords) {
        if (tagWord.length > 3 && queryWords.includes(tagWord)) {
          matchCount += 0.5;
          break;
        }
      }
    }

    // Normalize by number of tags (but cap at 1.0)
    const score = totalTags > 0 ? Math.min(1.0, matchCount / totalTags) : 0.5;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate human-readable explanation of relevance score
   * Enhanced for Task #8 with folder and tag factors
   */
  private generateExplanation(
    factors: RelevanceFactors,
    weights: Record<keyof RelevanceFactors, number>
  ): string {
    const reasons: string[] = [];

    // Identify top factors (above 0.7)
    if (factors.semanticSimilarity > 0.7) {
      reasons.push('high semantic similarity');
    }
    if (factors.keywordMatch > 0.7) {
      reasons.push('strong keyword match');
    }
    if (factors.titleMatch > 0.7) {
      reasons.push('relevant title');
    }
    if (factors.recency > 0.7 && weights.recency > 0) {
      reasons.push('recent document');
    }
    if (factors.folderPathMatch && factors.folderPathMatch > 0.7) {
      reasons.push('relevant folder/category'); // NEW: Task #8
    }
    if (factors.tagMatch && factors.tagMatch > 0.7) {
      reasons.push('matching tags'); // NEW: Task #8
    }
    if (factors.userEngagement > 0.7 && weights.userEngagement > 0) {
      reasons.push('frequently accessed');
    }
    if (factors.completeness > 0.9) {
      reasons.push('complete content');
    }

    // Identify weak factors (below 0.3)
    const weakFactors: string[] = [];
    if (factors.semanticSimilarity < 0.3) {
      weakFactors.push('low semantic match');
    }
    if (factors.keywordMatch < 0.3) {
      weakFactors.push('few keywords matched');
    }

    // Build explanation
    if (reasons.length === 0) {
      return 'moderate relevance';
    } else if (reasons.length === 1) {
      return `Selected for: ${reasons[0]}`;
    } else if (reasons.length === 2) {
      return `Selected for: ${reasons.join(' and ')}`;
    } else {
      const last = reasons.pop();
      return `Selected for: ${reasons.join(', ')}, and ${last}`;
    }
  }

  /**
   * Get relevance tier for display (High/Medium/Low)
   */
  getRelevanceTier(score: number): {
    tier: 'high' | 'medium' | 'low';
    color: string;
    label: string;
  } {
    if (score >= 80) {
      return {
        tier: 'high',
        color: 'green',
        label: 'High Relevance'
      };
    } else if (score >= 60) {
      return {
        tier: 'medium',
        color: 'orange',
        label: 'Medium Relevance'
      };
    } else {
      return {
        tier: 'low',
        color: 'red',
        label: 'Low Relevance'
      };
    }
  }

  /**
   * Filter chunks by minimum relevance threshold
   */
  filterByRelevance(
    scoredChunks: ScoredChunk[],
    minScore: number = 60
  ): ScoredChunk[] {
    const filtered = scoredChunks.filter(chunk => chunk.relevanceScore >= minScore);

    console.log(`   🔍 Filtered ${scoredChunks.length} chunks to ${filtered.length} (min score: ${minScore})`);

    return filtered;
  }

  /**
   * Get diversity-enhanced results
   * Ensures results come from different documents/sources
   */
  diversifyResults(
    scoredChunks: ScoredChunk[],
    maxPerDocument: number = 3
  ): ScoredChunk[] {
    const documentCounts = new Map<string, number>();
    const diversified: ScoredChunk[] = [];

    for (const chunk of scoredChunks) {
      const docId = chunk.chunk.metadata.documentId;

      if (!docId) {
        diversified.push(chunk);
        continue;
      }

      const currentCount = documentCounts.get(docId) || 0;

      if (currentCount < maxPerDocument) {
        diversified.push(chunk);
        documentCounts.set(docId, currentCount + 1);
      }
    }

    console.log(`   📊 Diversified results: ${scoredChunks.length} → ${diversified.length} chunks`);

    return diversified;
  }
}

export default new RelevanceScorerService();
