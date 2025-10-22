/**
 * Reciprocal Rank Fusion (RRF) Service
 * Merges results from multiple retrieval strategies using RRF algorithm
 * More robust than manual score weighting
 */

import { RetrievalResult, RetrievalResults } from './multiStrategyRetrieval.service';

interface RRFWeights {
  bm25: number;
  vector: number;
  title: number;
}

interface FusedResult extends RetrievalResult {
  fusedScore: number;
  rankSources: string[]; // Which strategies found this document
}

class RRFFusionService {
  /**
   * Fuses multiple result lists using Reciprocal Rank Fusion
   *
   * RRF Formula: score = sum(weight / (k + rank))
   * where k is a constant (typically 60) and rank starts at 1
   */
  fuseResults(
    results: RetrievalResults,
    weights: RRFWeights = { bm25: 1.0, vector: 1.0, title: 1.5 },
    topK: number = 10
  ): FusedResult[] {
    const k = 60; // RRF constant (standard value from research)
    const scoreMap = new Map<string, {
      doc: RetrievalResult;
      score: number;
      sources: Set<string>;
    }>();

    console.log(`🔀 Fusing results with RRF (k=${k})`);

    // Process BM25 results
    results.bm25.forEach((doc, index) => {
      const rank = index + 1; // Ranks start at 1, not 0
      const rrfScore = weights.bm25 / (k + rank);
      this.addScore(scoreMap, doc, rrfScore, 'bm25');
    });

    // Process vector results
    results.vector.forEach((doc, index) => {
      const rank = index + 1;
      const rrfScore = weights.vector / (k + rank);
      this.addScore(scoreMap, doc, rrfScore, 'vector');
    });

    // Process title results (higher weight!)
    results.title.forEach((doc, index) => {
      const rank = index + 1;
      const rrfScore = weights.title / (k + rank);
      this.addScore(scoreMap, doc, rrfScore, 'title');
    });

    // Convert to array and sort by fused score
    const fused = Array.from(scoreMap.values())
      .map(item => ({
        ...item.doc,
        fusedScore: item.score,
        rankSources: Array.from(item.sources)
      }))
      .sort((a, b) => b.fusedScore - a.fusedScore);

    // Log top results
    console.log(`📊 RRF fusion complete. Top ${Math.min(topK, fused.length)} results:`);
    fused.slice(0, topK).forEach((result, idx) => {
      console.log(
        `   ${idx + 1}. ${result.filename} ` +
        `(score: ${result.fusedScore.toFixed(4)}, sources: ${result.rankSources.join('+')})`
      );
    });

    return fused.slice(0, topK);
  }

  /**
   * Adds or updates a document's RRF score
   */
  private addScore(
    scoreMap: Map<string, { doc: RetrievalResult; score: number; sources: Set<string> }>,
    doc: RetrievalResult,
    score: number,
    source: string
  ): void {
    const existing = scoreMap.get(doc.documentId);

    if (existing) {
      // Document found in multiple strategies - add score
      existing.score += score;
      existing.sources.add(source);

      // If this result has better content, use it
      if (doc.content.length > existing.doc.content.length) {
        existing.doc = doc;
      }
    } else {
      // New document
      scoreMap.set(doc.documentId, {
        doc,
        score,
        sources: new Set([source])
      });
    }
  }

  /**
   * Alternative: Linear combination (simpler but less robust)
   */
  linearCombination(
    results: RetrievalResults,
    weights: RRFWeights = { bm25: 0.3, vector: 0.4, title: 0.3 },
    topK: number = 10
  ): FusedResult[] {
    const scoreMap = new Map<string, {
      doc: RetrievalResult;
      score: number;
      sources: Set<string>;
    }>();

    // Normalize and combine scores
    results.bm25.forEach(doc => {
      this.addScore(scoreMap, doc, doc.score * weights.bm25, 'bm25');
    });

    results.vector.forEach(doc => {
      this.addScore(scoreMap, doc, doc.score * weights.vector, 'vector');
    });

    results.title.forEach(doc => {
      this.addScore(scoreMap, doc, doc.score * weights.title, 'title');
    });

    const fused = Array.from(scoreMap.values())
      .map(item => ({
        ...item.doc,
        fusedScore: item.score,
        rankSources: Array.from(item.sources)
      }))
      .sort((a, b) => b.fusedScore - a.fusedScore);

    return fused.slice(0, topK);
  }

  /**
   * Analyzes fusion quality
   */
  analyzeFusion(results: RetrievalResults, fused: FusedResult[]): {
    totalCandidates: number;
    uniqueDocuments: number;
    multiSourceDocs: number;
    avgSourcesPerDoc: number;
  } {
    const allCandidates = [
      ...results.bm25,
      ...results.vector,
      ...results.title
    ];

    const uniqueDocs = new Set(allCandidates.map(r => r.documentId));

    const multiSource = fused.filter(r => r.rankSources.length > 1).length;

    const avgSources = fused.reduce((sum, r) => sum + r.rankSources.length, 0) / fused.length;

    return {
      totalCandidates: allCandidates.length,
      uniqueDocuments: uniqueDocs.size,
      multiSourceDocs: multiSource,
      avgSourcesPerDoc: avgSources
    };
  }
}

export default new RRFFusionService();
export { RRFFusionService, RRFWeights, FusedResult };
