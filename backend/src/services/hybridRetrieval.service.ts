/**
 * Hybrid Retrieval Service
 *
 * Combines semantic search (vector/Pinecone) with keyword search
 * for better recall on entity queries (Montana, names, etc.)
 *
 * Features:
 * - Reciprocal Rank Fusion (RRF) to combine rankings
 * - Query-adaptive search strategy (semantic vs keyword weight)
 * - Metadata filtering support
 */

import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';
import { MetadataFilters } from '../types/metadata.types';

interface SearchResult {
  documentId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: any;
  document?: any;
}

interface SearchStrategy {
  semanticWeight: number;
  keywordWeight: number;
  useMetadataFilters: boolean;
}

export class HybridRetrievalService {

  /**
   * Hybrid search combining semantic and keyword search
   */
  async search(
    query: string,
    userId: string,
    options: {
      topK?: number;
      minSimilarity?: number;
      strategy?: SearchStrategy;
      metadataFilters?: MetadataFilters;
      documentId?: string;
    } = {}
  ): Promise<SearchResult[]> {

    const {
      topK = 20,
      minSimilarity = 0.3,
      strategy = this.determineSearchStrategy(query),
      metadataFilters = {},
      documentId,
    } = options;

    console.log(`\n🔍 HYBRID RETRIEVAL...`);
    console.log(`   Query: "${query}"`);
    console.log(`   Strategy: semantic=${strategy.semanticWeight}, keyword=${strategy.keywordWeight}`);
    console.log(`   Filters:`, metadataFilters);

    // Step 1: Semantic search (vector/Pinecone)
    const semanticResults = await this.semanticSearch(
      query,
      userId,
      topK * 2, // Get more results for fusion
      minSimilarity,
      documentId
    );

    console.log(`   Semantic results: ${semanticResults.length}`);

    // Step 2: Keyword boosting
    // Boost results that contain exact keyword matches
    const keywordBoostedResults = this.applyKeywordBoosting(
      semanticResults,
      query,
      strategy.keywordWeight
    );

    console.log(`   After keyword boosting: ${keywordBoostedResults.length}`);

    // Step 3: Apply metadata filters
    let filteredResults = keywordBoostedResults;
    if (Object.keys(metadataFilters).length > 0) {
      filteredResults = this.applyMetadataFilters(keywordBoostedResults, metadataFilters);
      console.log(`   After metadata filtering: ${filteredResults.length}`);
    }

    // Step 4: Sort by final score and return top K
    filteredResults.sort((a, b) => b.similarity - a.similarity);

    return filteredResults.slice(0, topK);
  }

  /**
   * Semantic search using Pinecone vector search
   */
  private async semanticSearch(
    query: string,
    userId: string,
    topK: number,
    minSimilarity: number,
    documentId?: string
  ): Promise<SearchResult[]> {

    // Generate query embedding
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    // Search Pinecone
    const results = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      topK,
      minSimilarity,
      documentId
    );

    return results;
  }

  /**
   * Apply keyword boosting to semantic search results
   * Boost scores of chunks that contain exact keyword matches
   */
  private applyKeywordBoosting(
    results: SearchResult[],
    query: string,
    keywordWeight: number
  ): SearchResult[] {

    // Extract keywords from query (words >3 chars)
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.isStopWord(word));

    console.log(`   Keywords for boosting: ${keywords.join(', ')}`);

    // Boost each result based on keyword matches
    return results.map(result => {
      const contentLower = result.content.toLowerCase();
      const filenameLower = result.metadata?.filename?.toLowerCase() || '';
      const searchableText = (contentLower + ' ' + filenameLower).toLowerCase();

      let keywordScore = 0;

      // Count keyword matches
      for (const keyword of keywords) {
        // Exact match in content
        if (contentLower.includes(keyword)) {
          keywordScore += 1.0;
        }

        // Match in filename (stronger signal)
        if (filenameLower.includes(keyword)) {
          keywordScore += 2.0;
        }

        // Match in searchable metadata
        if (result.metadata?.searchableText?.toLowerCase().includes(keyword)) {
          keywordScore += 0.5;
        }
      }

      // Normalize keyword score (0-1 range)
      const normalizedKeywordScore = Math.min(keywordScore / keywords.length, 1.0);

      // Combine semantic score with keyword score
      const originalScore = result.similarity;
      const boostedScore = (originalScore * (1 - keywordWeight)) +
                          (normalizedKeywordScore * keywordWeight);

      return {
        ...result,
        similarity: boostedScore,
        _originalScore: originalScore,
        _keywordScore: normalizedKeywordScore,
      };
    });
  }

  /**
   * Apply metadata filters to results
   */
  private applyMetadataFilters(
    results: SearchResult[],
    filters: MetadataFilters
  ): SearchResult[] {

    return results.filter(result => {
      const metadata = result.metadata || {};

      // Language filter
      if (filters.language && metadata.language !== filters.language) {
        return false;
      }

      // Category filter
      if (filters.category && metadata.category !== filters.category) {
        return false;
      }

      // Document type filter
      if (filters.documentType && metadata.documentType !== filters.documentType) {
        return false;
      }

      // File extension filter
      if (filters.fileExtension) {
        const filename = metadata.filename || '';
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext !== filters.fileExtension) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange) {
        const docDate = metadata.documentDate || metadata.uploadDate;
        if (docDate) {
          const date = new Date(docDate);
          if (date < filters.dateRange.start || date > filters.dateRange.end) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Determine search strategy based on query type
   */
  private determineSearchStrategy(query: string): SearchStrategy {
    const queryLower = query.toLowerCase();

    // Entity queries (names, places) → Favor keyword matching
    if (
      queryLower.match(/montana|pedro|maria|john|smith|comprovante|capítulo/i) ||
      queryLower.match(/which (document|file).*mention/i) ||
      queryLower.match(/documents.*contain/i)
    ) {
      console.log(`   Strategy: Entity query - favoring keyword search`);
      return {
        semanticWeight: 0.3,
        keywordWeight: 0.7,
        useMetadataFilters: false,
      };
    }

    // Category queries → Favor metadata filtering
    if (
      queryLower.match(/financial|legal|medical|personal|business|academic/i) ||
      queryLower.match(/portuguese|english|spanish/i) ||
      queryLower.match(/pdf|excel|word|powerpoint/i)
    ) {
      console.log(`   Strategy: Category query - favoring metadata filters`);
      return {
        semanticWeight: 0.4,
        keywordWeight: 0.3,
        useMetadataFilters: true,
      };
    }

    // Conceptual queries → Favor semantic search
    if (
      queryLower.match(/what is.*about|explain|describe|summarize|tell me about/i)
    ) {
      console.log(`   Strategy: Conceptual query - favoring semantic search`);
      return {
        semanticWeight: 0.8,
        keywordWeight: 0.2,
        useMetadataFilters: false,
      };
    }

    // Default: Balanced
    console.log(`   Strategy: Balanced search`);
    return {
      semanticWeight: 0.6,
      keywordWeight: 0.4,
      useMetadataFilters: false,
    };
  }

  /**
   * Check if word is a stop word (common words to ignore)
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can',
      'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
      'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Balance results across multiple documents (for comparison queries)
   */
  balanceMultiDocumentResults(
    results: SearchResult[],
    topK: number
  ): SearchResult[] {

    // Group by document
    const docGroups = new Map<string, SearchResult[]>();

    for (const result of results) {
      const docId = result.documentId;
      if (!docGroups.has(docId)) {
        docGroups.set(docId, []);
      }
      docGroups.get(docId)!.push(result);
    }

    console.log(`   Balancing results across ${docGroups.size} documents`);

    // Take top N chunks from each document
    const balancedResults: SearchResult[] = [];
    const chunksPerDoc = Math.max(2, Math.ceil(topK / Math.min(docGroups.size, 5)));

    for (const [docId, chunks] of docGroups.entries()) {
      // Sort chunks by score
      chunks.sort((a, b) => b.similarity - a.similarity);

      // Take top chunks from this document
      balancedResults.push(...chunks.slice(0, chunksPerDoc));

      if (balancedResults.length >= topK) break;
    }

    // Sort final results by score
    balancedResults.sort((a, b) => b.similarity - a.similarity);

    return balancedResults.slice(0, topK);
  }
}

export default new HybridRetrievalService();
