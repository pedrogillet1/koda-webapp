/**
 * Multi-Strategy Retrieval Service
 * Combines BM25F (keyword + field boosting), vector search, and title matching
 * Runs all strategies in parallel for optimal performance
 */

import prisma from '../config/database';
import pineconeService from './pinecone.service';
import vectorEmbeddingService from './vectorEmbedding.service';

export interface RetrievalResult {
  documentId: string;
  filename: string;
  content: string;
  score: number;
  source: 'bm25' | 'vector' | 'title';
  metadata?: any;
  pageNumber?: number;
}

export interface RetrievalResults {
  bm25: RetrievalResult[];
  vector: RetrievalResult[];
  title: RetrievalResult[];
}

class MultiStrategyRetrievalService {
  /**
   * Retrieves documents using multiple strategies in parallel
   */
  async retrieve(
    query: string,
    userId: string,
    topK: number = 20
  ): Promise<RetrievalResults> {
    console.log(`🔍 Multi-strategy retrieval for: "${query}"`);

    // Run all strategies in parallel for speed
    const [bm25Results, vectorResults, titleResults] = await Promise.all([
      this.bm25Search(query, userId, topK),
      this.vectorSearch(query, userId, topK),
      this.titleSearch(query, userId, topK)
    ]);

    console.log(`  BM25: ${bm25Results.length} results`);
    console.log(`  Vector: ${vectorResults.length} results`);
    console.log(`  Title: ${titleResults.length} results`);

    return {
      bm25: bm25Results,
      vector: vectorResults,
      title: titleResults
    };
  }

  /**
   * BM25F search with field boosting
   * Title and headings get higher weights than body text
   */
  private async bm25Search(
    query: string,
    userId: string,
    topK: number
  ): Promise<RetrievalResult[]> {
    try {
      const queryLower = query.toLowerCase();
      const queryTerms = this.extractTerms(queryLower);

      if (queryTerms.length === 0) {
        return [];
      }

      // Get all documents for the user
      const documents = await prisma.document.findMany({
        where: { userId },
        include: { metadata: true }
      });

      // Score each document using BM25F
      const scored = documents.map(doc => {
        const score = this.calculateBM25FScore(
          queryTerms,
          doc.filename || '',
          doc.metadata?.extractedText || '',
          [] // Headings not available in metadata
        );

        return {
          documentId: doc.id,
          filename: doc.filename || 'Unknown',
          content: (doc.metadata?.extractedText || '').substring(0, 1000),
          score,
          source: 'bm25' as const,
          metadata: doc.metadata,
          pageNumber: 1
        };
      });

      // Sort by score and return top-K
      scored.sort((a, b) => b.score - a.score);

      const topResults = scored.filter(r => r.score > 0).slice(0, topK);

      console.log(`   📊 BM25 top result: ${topResults[0]?.filename} (score: ${topResults[0]?.score.toFixed(3)})`);

      return topResults;
    } catch (error) {
      console.error('❌ Error in BM25 search:', error);
      return [];
    }
  }

  /**
   * Calculates BM25F score with field boosting
   * Title gets 3x weight, headings get 2x weight, body gets 1x weight
   */
  private calculateBM25FScore(
    queryTerms: string[],
    title: string,
    body: string,
    headings: string[]
  ): number {
    const titleLower = title.toLowerCase();
    const bodyLower = body.toLowerCase();
    const headingsLower = headings.map(h => h.toLowerCase()).join(' ');

    let score = 0;

    // BM25F parameters
    const k1 = 1.2; // Term frequency saturation
    const b = 0.75; // Length normalization

    for (const term of queryTerms) {
      // Title field (weight: 3.0)
      const titleTF = this.termFrequency(term, titleLower);
      if (titleTF > 0) {
        score += 3.0 * this.bm25TermScore(titleTF, titleLower.length, 50, k1, b);
      }

      // Headings field (weight: 2.0)
      const headingsTF = this.termFrequency(term, headingsLower);
      if (headingsTF > 0) {
        score += 2.0 * this.bm25TermScore(headingsTF, headingsLower.length, 100, k1, b);
      }

      // Body field (weight: 1.0)
      const bodyTF = this.termFrequency(term, bodyLower);
      if (bodyTF > 0) {
        score += 1.0 * this.bm25TermScore(bodyTF, bodyLower.length, 1000, k1, b);
      }
    }

    return score;
  }

  /**
   * Calculates BM25 term score
   */
  private bm25TermScore(
    tf: number,
    docLength: number,
    avgDocLength: number,
    k1: number,
    b: number
  ): number {
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));

    return numerator / denominator;
  }

  /**
   * Counts term frequency in text
   */
  private termFrequency(term: string, text: string): number {
    const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Escapes regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extracts search terms from query
   */
  private extractTerms(query: string): string[] {
    // Remove stopwords and punctuation
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must',
      'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'por',
      'el', 'la', 'los', 'las', 'de', 'del', 'en', 'por'
    ]);

    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopwords.has(term));

    return terms;
  }

  /**
   * Vector search (semantic)
   */
  private async vectorSearch(
    query: string,
    userId: string,
    topK: number
  ): Promise<RetrievalResult[]> {
    try {
      const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);

      const results = await pineconeService.searchSimilarChunks(
        queryEmbedding,
        userId,
        topK,
        0.3 // Lower threshold to get more candidates
      );

      const mapped = results.map((r: any) => ({
        documentId: r.metadata?.documentId || '',
        filename: r.metadata?.filename || 'Unknown',
        content: r.metadata?.content || r.content || '',
        score: r.score || 0,
        source: 'vector' as const,
        metadata: r.metadata,
        pageNumber: r.metadata?.pageNumber || 1
      }));

      if (mapped.length > 0) {
        console.log(`   🧠 Vector top result: ${mapped[0].filename} (score: ${mapped[0].score.toFixed(3)})`);
      }

      return mapped;
    } catch (error) {
      console.error('❌ Error in vector search:', error);
      return [];
    }
  }

  /**
   * Title search (exact and fuzzy matching)
   */
  private async titleSearch(
    query: string,
    userId: string,
    topK: number
  ): Promise<RetrievalResult[]> {
    try {
      const queryLower = query.toLowerCase().trim();

      // Get all documents
      const documents = await prisma.document.findMany({
        where: { userId },
        include: { metadata: true }
      });

      // Score by title similarity
      const scored: RetrievalResult[] = documents
        .map(doc => {
          const filename = (doc.filename || '').toLowerCase();
          const matchScore = this.titleMatchScore(queryLower, filename);

          if (matchScore === 0) return null;

          return {
            documentId: doc.id,
            filename: doc.filename || 'Unknown',
            content: (doc.metadata?.extractedText || '').substring(0, 1000),
            score: matchScore,
            source: 'title' as const,
            metadata: doc.metadata,
            pageNumber: 1,
            chunkIndex: 0
          };
        })
        .filter(r => r !== null) as RetrievalResult[];

      // Sort and return top-K
      scored.sort((a, b) => (b?.score || 0) - (a?.score || 0));

      const topResults = scored.slice(0, topK);

      if (topResults.length > 0) {
        console.log(`   📄 Title top result: ${topResults[0].filename} (score: ${topResults[0].score.toFixed(3)})`);
      }

      return topResults;
    } catch (error) {
      console.error('❌ Error in title search:', error);
      return [];
    }
  }

  /**
   * Calculates title match score
   */
  private titleMatchScore(query: string, filename: string): number {
    // Exact match = 1.0
    if (filename === query) {
      return 1.0;
    }

    // Starts with query = 0.9
    if (filename.startsWith(query)) {
      return 0.9;
    }

    // Contains full query = 0.85
    if (filename.includes(query)) {
      return 0.85;
    }

    // Fuzzy word matching
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const filenameWords = filename.split(/\s+/);

    if (queryWords.length === 0) {
      return 0;
    }

    let matchingWords = 0;
    for (const qWord of queryWords) {
      for (const fWord of filenameWords) {
        if (fWord.includes(qWord) || qWord.includes(fWord)) {
          matchingWords++;
          break;
        }
      }
    }

    const wordMatchRatio = matchingWords / queryWords.length;

    if (wordMatchRatio > 0.5) {
      return 0.6 + wordMatchRatio * 0.2; // Score 0.6-0.8
    }

    return 0;
  }
}

export default new MultiStrategyRetrievalService();
export { MultiStrategyRetrievalService };
