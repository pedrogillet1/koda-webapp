/**
 * Hybrid Search Service
 * Combines vector similarity search with keyword/title matching
 * Ensures documents can be found by exact title, filename, or semantic content
 */

import prisma from '../config/database';
import pineconeService from './pinecone.service';
import vectorEmbeddingService from './vectorEmbedding.service';

interface SearchResult {
  documentId: string;
  filename: string;
  content: string;
  score: number;
  matchType: 'title' | 'filename' | 'semantic' | 'hybrid';
  metadata?: any;
}

interface HybridSearchOptions {
  userId: string;
  topK?: number;
  minSemanticScore?: number;
  includeMetadata?: boolean;
}

class HybridSearchService {
  /**
   * Perform hybrid search: keyword/title matching + vector similarity
   */
  async search(
    query: string,
    options: HybridSearchOptions
  ): Promise<SearchResult[]> {
    const {
      userId,
      topK = 5,
      minSemanticScore = 0.5,
      includeMetadata = true,
    } = options;

    console.log(`🔍 Starting hybrid search for query: "${query}"`);

    // Step 1: Try exact title/filename matching first
    const keywordResults = await this.searchByKeyword(query, userId);

    // Step 2: Perform vector similarity search
    const semanticResults = await this.searchBySemantic(
      query,
      userId,
      topK,
      minSemanticScore
    );

    // Step 3: Merge and rank results
    const mergedResults = this.mergeResults(
      keywordResults,
      semanticResults,
      topK
    );

    // Step 4: Enhance with metadata if requested
    if (includeMetadata && mergedResults.length > 0) {
      return await this.enrichWithMetadata(mergedResults);
    }

    console.log(
      `✅ Hybrid search complete: Found ${mergedResults.length} results`
    );

    return mergedResults;
  }

  /**
   * Search documents by title and filename (keyword matching)
   */
  private async searchByKeyword(
    query: string,
    userId: string
  ): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase().trim();

    try {
      // Search in document filenames (case-insensitive by converting to lowercase)
      const allDocuments = await prisma.document.findMany({
        where: {
          userId,
        },
        include: {
          metadata: true,
        },
      });

      // Filter documents by filename match (case-insensitive)
      const documents = allDocuments
        .filter(doc => {
          const filename = (doc.filename || '').toLowerCase();
          return filename.includes(queryLower);
        })
        .slice(0, 10);

      if (documents.length > 0) {
        console.log(
          `📌 Found ${documents.length} documents by keyword/title match`
        );
      }

      // Convert to SearchResult format
      const results: SearchResult[] = [];

      for (const doc of documents) {
        // Calculate match score based on how well the query matches the filename
        const filename = (doc.filename || '').toLowerCase();
        const matchScore = this.calculateKeywordMatchScore(queryLower, filename);

        // Get a representative chunk of content if available
        let content = '';
        if (doc.metadata?.extractedText) {
          // Get first 500 characters as representative content
          content = doc.metadata.extractedText.substring(0, 500);
        }

        results.push({
          documentId: doc.id,
          filename: doc.filename || 'Unknown',
          content,
          score: matchScore,
          matchType: this.determineMatchType(queryLower, filename),
          metadata: doc.metadata,
        });
      }

      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('❌ Error in keyword search:', error);
      return [];
    }
  }

  /**
   * Calculate keyword match score (0-1)
   */
  private calculateKeywordMatchScore(query: string, text: string): number {
    // Exact match = highest score
    if (text === query) {
      return 1.0;
    }

    // Starts with query = high score
    if (text.startsWith(query)) {
      return 0.9;
    }

    // Contains full query = good score
    if (text.includes(query)) {
      return 0.85;
    }

    // Fuzzy matching: count matching words
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const textWords = text.split(/\s+/);

    if (queryWords.length === 0) {
      return 0.5;
    }

    let matchingWords = 0;
    for (const qWord of queryWords) {
      for (const tWord of textWords) {
        if (tWord.includes(qWord) || qWord.includes(tWord)) {
          matchingWords++;
          break;
        }
      }
    }

    const wordMatchRatio = matchingWords / queryWords.length;
    return 0.6 + wordMatchRatio * 0.2; // Score between 0.6-0.8
  }

  /**
   * Determine match type based on how query matched
   */
  private determineMatchType(query: string, filename: string): 'title' | 'filename' {
    // If query is in the filename (without extension), it's a title match
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    if (filenameWithoutExt.includes(query) || query.includes(filenameWithoutExt)) {
      return 'title';
    }

    return 'filename';
  }

  /**
   * Search using vector similarity (semantic search)
   */
  private async searchBySemantic(
    query: string,
    userId: string,
    topK: number,
    minScore: number
  ): Promise<SearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);

      // Search Pinecone
      const pineconeResults = await pineconeService.searchSimilarChunks(
        queryEmbedding,
        userId,
        topK * 2, // Get more results to filter later
        minScore
      );

      if (pineconeResults.length > 0) {
        console.log(
          `🧠 Found ${pineconeResults.length} results by semantic similarity`
        );
      }

      // Convert to SearchResult format
      const results: SearchResult[] = pineconeResults.map((result: any) => ({
        documentId: result.metadata?.documentId || '',
        filename: result.metadata?.filename || 'Unknown',
        content: result.metadata?.content || result.content || '',
        score: result.score || 0,
        matchType: 'semantic' as const,
        metadata: result.metadata,
      }));

      return results;
    } catch (error) {
      console.error('❌ Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Merge keyword and semantic results with intelligent ranking
   */
  private mergeResults(
    keywordResults: SearchResult[],
    semanticResults: SearchResult[],
    topK: number
  ): SearchResult[] {
    const mergedMap = new Map<string, SearchResult>();

    // Add keyword results (with boost)
    for (const result of keywordResults) {
      const existing = mergedMap.get(result.documentId);

      if (existing) {
        // Document found in both searches - boost score
        existing.score = Math.min(
          (existing.score + result.score * 1.3) / 2, // Boost keyword matches by 30%
          1.0
        );
        existing.matchType = 'hybrid';
      } else {
        // New keyword result - add with boost
        mergedMap.set(result.documentId, {
          ...result,
          score: Math.min(result.score * 1.2, 1.0), // 20% boost for keyword matches
        });
      }
    }

    // Add semantic results
    for (const result of semanticResults) {
      const existing = mergedMap.get(result.documentId);

      if (existing) {
        // Already exists from keyword search - boost further
        existing.score = Math.min((existing.score + result.score) / 2, 1.0);
        existing.matchType = 'hybrid';

        // Use semantic result's content if more substantial
        if (result.content.length > existing.content.length) {
          existing.content = result.content;
        }
      } else {
        // New semantic result
        mergedMap.set(result.documentId, result);
      }
    }

    // Convert to array and sort by score
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => b.score - a.score
    );

    // Log the ranking
    console.log('📊 Final ranking:');
    merged.slice(0, topK).forEach((result, idx) => {
      console.log(
        `  ${idx + 1}. ${result.filename} (${result.matchType}, score: ${result.score.toFixed(3)})`
      );
    });

    return merged.slice(0, topK);
  }

  /**
   * Enrich results with full document metadata
   */
  private async enrichWithMetadata(
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    const documentIds = results.map(r => r.documentId).filter(Boolean);

    if (documentIds.length === 0) {
      return results;
    }

    try {
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
        },
        include: {
          metadata: true,
        },
      });

      const docMap = new Map(documents.map(doc => [doc.id, doc]));

      return results.map(result => {
        const doc = docMap.get(result.documentId);
        if (doc) {
          return {
            ...result,
            filename: doc.filename || result.filename,
            metadata: {
              ...result.metadata,
              pageCount: doc.metadata?.pageCount,
              wordCount: doc.metadata?.wordCount,
              mimeType: doc.mimeType,
              createdAt: doc.createdAt,
            },
          };
        }
        return result;
      });
    } catch (error) {
      console.error('❌ Error enriching metadata:', error);
      return results;
    }
  }

  /**
   * Check if query is likely asking for a specific document by name
   */
  isDocumentNameQuery(query: string): boolean {
    const queryLower = query.toLowerCase();

    const nameIndicators = [
      'document named',
      'document called',
      'file named',
      'file called',
      'the document',
      'the file',
      'document titled',
      'file titled',
      'open',
      'show me',
      'find',
      'locate',
    ];

    return nameIndicators.some(indicator => queryLower.includes(indicator));
  }

  /**
   * Extract potential document name from query
   */
  extractDocumentName(query: string): string | null {
    const queryLower = query.toLowerCase();

    // Patterns to extract document names
    const patterns = [
      /document\s+(?:named|called|titled)\s+["']?([^"'\n]+?)["']?(?:\s|$)/i,
      /file\s+(?:named|called|titled)\s+["']?([^"'\n]+?)["']?(?:\s|$)/i,
      /["']([^"'\n]{3,})["']/i, // Anything in quotes
      /about\s+["']?([^"'\n.?!]{5,})["']?[.?!]?$/i, // "about X" at end
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }
}

export default new HybridSearchService();
export { HybridSearchService, SearchResult, HybridSearchOptions };
