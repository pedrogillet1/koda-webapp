/**
 * Reranker Service
 * Re-ranks documents using learned cross-encoder models
 * Supports Cohere ReRank API (recommended) and self-hosted alternatives
 */

import { FusedResult } from './rrfFusion.service';

interface RerankResult extends FusedResult {
  rerankScore: number;
  originalRank: number;
}

class RerankerService {
  private cohereApiKey: string | undefined;

  constructor() {
    this.cohereApiKey = process.env.COHERE_API_KEY;
  }

  /**
   * Re-ranks documents using Cohere ReRank API (if available)
   * Falls back to original scores if API not configured
   */
  async rerank(
    query: string,
    documents: FusedResult[],
    topK: number = 10
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    console.log(`🎯 Re-ranking ${documents.length} documents`);

    // If Cohere API key is available, use Cohere ReRank
    if (this.cohereApiKey) {
      try {
        return await this.rerankWithCohere(query, documents, topK);
      } catch (error) {
        console.warn('⚠️ Cohere ReRank failed, falling back to fusion scores:', error);
        return this.fallbackRerank(documents, topK);
      }
    }

    // Fallback: use fusion scores
    console.log('ℹ️ Cohere API key not configured, using fusion scores');
    return this.fallbackRerank(documents, topK);
  }

  /**
   * Re-ranks using Cohere ReRank API
   */
  private async rerankWithCohere(
    query: string,
    documents: FusedResult[],
    topK: number
  ): Promise<RerankResult[]> {
    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.cohereApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        documents: documents.map(d => d.content),
        top_n: topK,
        model: 'rerank-multilingual-v3.0', // Supports multiple languages
        return_documents: false
      })
    });

    if (!response.ok) {
      throw new Error(`Cohere ReRank API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Map Cohere results back to documents
    const reranked: RerankResult[] = data.results.map((result: any) => {
      const originalDoc = documents[result.index];

      return {
        ...originalDoc,
        rerankScore: result.relevance_score,
        originalRank: result.index
      };
    });

    console.log(`   ✅ Cohere re-ranking complete`);
    reranked.slice(0, 5).forEach((result, idx) => {
      console.log(
        `   ${idx + 1}. ${result.filename} ` +
        `(rerank: ${result.rerankScore.toFixed(3)}, original rank: ${result.originalRank + 1})`
      );
    });

    return reranked;
  }

  /**
   * Fallback: use fusion scores when Cohere is not available
   */
  private fallbackRerank(
    documents: FusedResult[],
    topK: number
  ): RerankResult[] {
    const reranked = documents.map((doc, index) => ({
      ...doc,
      rerankScore: doc.fusedScore,
      originalRank: index
    }));

    // Already sorted by fusion score
    return reranked.slice(0, topK);
  }

  /**
   * Simple cross-encoder scoring (lightweight alternative)
   * Scores based on query-document semantic similarity
   */
  async simpleRerank(
    query: string,
    documents: FusedResult[],
    topK: number = 10
  ): Promise<RerankResult[]> {
    // Calculate simple relevance scores
    const scored = documents.map((doc, index) => {
      const relevanceScore = this.calculateSimpleRelevance(query, doc.content);

      return {
        ...doc,
        rerankScore: relevanceScore,
        originalRank: index
      };
    });

    // Sort by relevance score
    scored.sort((a, b) => b.rerankScore - a.rerankScore);

    return scored.slice(0, topK);
  }

  /**
   * Calculates simple relevance score
   * Based on term overlap and position
   */
  private calculateSimpleRelevance(query: string, document: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const docLower = document.toLowerCase();

    let score = 0;

    for (let i = 0; i < queryTerms.length; i++) {
      const term = queryTerms[i];

      if (term.length < 3) continue;

      // Check if term appears in document
      const firstIndex = docLower.indexOf(term);

      if (firstIndex !== -1) {
        // Term found - score based on position and frequency
        const frequency = (docLower.match(new RegExp(term, 'g')) || []).length;

        // Earlier mentions score higher
        const positionScore = 1 - (firstIndex / docLower.length);

        // More mentions score higher (with diminishing returns)
        const frequencyScore = Math.log(frequency + 1);

        score += positionScore * 0.5 + frequencyScore * 0.5;
      }
    }

    // Normalize by query length
    return score / queryTerms.length;
  }

  /**
   * Checks if Cohere API is configured and working
   */
  async testCohereConnection(): Promise<boolean> {
    if (!this.cohereApiKey) {
      console.log('ℹ️ Cohere API key not configured');
      return false;
    }

    try {
      // Test with a simple rerank request
      const response = await fetch('https://api.cohere.ai/v1/rerank', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cohereApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'test',
          documents: ['test document'],
          top_n: 1,
          model: 'rerank-multilingual-v3.0'
        })
      });

      if (response.ok) {
        console.log('✅ Cohere ReRank API is working');
        return true;
      } else {
        console.warn(`⚠️ Cohere API returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Cohere API test failed:', error);
      return false;
    }
  }
}

export default new RerankerService();
export { RerankerService, RerankResult };
