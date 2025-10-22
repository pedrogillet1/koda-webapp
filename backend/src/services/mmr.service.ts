/**
 * Maximal Marginal Relevance (MMR) Service
 * Removes redundant results and maximizes diversity
 * Ensures results cover different aspects of the query
 */

import { RerankResult } from './reranker.service';
import vectorEmbeddingService from './vectorEmbedding.service';

class MMRService {
  /**
   * Applies Maximal Marginal Relevance to diversify results
   *
   * MMR Formula: MMR = λ * Relevance(query, doc) - (1-λ) * max(Similarity(doc, selected))
   *
   * @param query - Original user query
   * @param documents - Reranked documents
   * @param topK - Number of diverse results to return
   * @param lambda - Balance between relevance and diversity (0-1, default 0.7)
   *                 Higher lambda = more relevance, lower lambda = more diversity
   */
  async applyMMR(
    query: string,
    documents: RerankResult[],
    topK: number = 5,
    lambda: number = 0.7
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    if (documents.length <= topK) {
      // Already have fewer documents than needed, return all
      return documents;
    }

    console.log(`🎨 Applying MMR for diversity (λ=${lambda}, selecting ${topK}/${documents.length})`);

    // Generate embeddings for all documents
    const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);
    const docEmbeddings = await Promise.all(
      documents.map(d => vectorEmbeddingService.generateEmbedding(d.content.substring(0, 500)))
    );

    const selected: RerankResult[] = [];
    const selectedEmbeddings: number[][] = [];
    const remaining = [...documents];
    const remainingEmbeddings = [...docEmbeddings];

    // Select first document (highest relevance)
    selected.push(remaining[0]);
    selectedEmbeddings.push(remainingEmbeddings[0]);
    remaining.splice(0, 1);
    remainingEmbeddings.splice(0, 1);

    // Select subsequent documents using MMR
    while (selected.length < topK && remaining.length > 0) {
      let bestIdx = 0;
      let bestMMRScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const doc = remaining[i];
        const docEmb = remainingEmbeddings[i];

        // Relevance to query (use rerank score or compute similarity)
        const relevance = doc.rerankScore ||
          this.cosineSimilarity(queryEmbedding, docEmb);

        // Max similarity to already selected documents
        let maxSimilarity = 0;
        for (const selectedEmb of selectedEmbeddings) {
          const similarity = this.cosineSimilarity(docEmb, selectedEmb);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // MMR score: balance relevance and diversity
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestIdx = i;
        }
      }

      // Add best document to selected
      selected.push(remaining[bestIdx]);
      selectedEmbeddings.push(remainingEmbeddings[bestIdx]);
      remaining.splice(bestIdx, 1);
      remainingEmbeddings.splice(bestIdx, 1);
    }

    console.log(`✅ MMR selection complete. Diverse documents:`);
    selected.forEach((result, idx) => {
      console.log(`   ${idx + 1}. ${result.filename} (rerank: ${result.rerankScore.toFixed(3)})`);
    });

    // Analyze diversity
    const avgSimilarity = await this.analyzeDiversity(selected);
    console.log(`   📊 Average pairwise similarity: ${(avgSimilarity * 100).toFixed(1)}%`);

    return selected;
  }

  /**
   * Calculates cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Analyzes diversity of selected documents
   */
  private async analyzeDiversity(documents: RerankResult[]): Promise<number> {
    if (documents.length < 2) {
      return 0;
    }

    // Generate embeddings
    const embeddings = await Promise.all(
      documents.map(d => vectorEmbeddingService.generateEmbedding(d.content.substring(0, 500)))
    );

    // Calculate pairwise similarities
    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
        totalSimilarity += similarity;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }

  /**
   * Simple text-based diversity (fallback if embeddings fail)
   */
  async applySimpleDiversity(
    documents: RerankResult[],
    topK: number = 5
  ): Promise<RerankResult[]> {
    if (documents.length <= topK) {
      return documents;
    }

    console.log(`🎨 Applying simple text-based diversity`);

    const selected: RerankResult[] = [];
    const selectedTexts: string[] = [];

    // Select first document
    selected.push(documents[0]);
    selectedTexts.push(documents[0].content.toLowerCase());

    // Select subsequent documents
    for (let i = 1; i < documents.length && selected.length < topK; i++) {
      const doc = documents[i];
      const docText = doc.content.toLowerCase();

      // Calculate text overlap with selected documents
      let maxOverlap = 0;
      for (const selectedText of selectedTexts) {
        const overlap = this.textOverlap(docText, selectedText);
        maxOverlap = Math.max(maxOverlap, overlap);
      }

      // If overlap is low enough, add document
      if (maxOverlap < 0.7) {
        selected.push(doc);
        selectedTexts.push(docText);
      }
    }

    // If we don't have enough diverse documents, fill with remaining
    if (selected.length < topK) {
      for (let i = 0; i < documents.length && selected.length < topK; i++) {
        if (!selected.includes(documents[i])) {
          selected.push(documents[i]);
        }
      }
    }

    return selected;
  }

  /**
   * Calculates text overlap ratio (Jaccard similarity)
   */
  private textOverlap(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Adaptive lambda selection based on query type
   */
  getAdaptiveLambda(queryType: string): number {
    switch (queryType) {
      case 'factual':
        return 0.9; // High relevance, low diversity (looking for specific answer)

      case 'summary':
      case 'comparison':
        return 0.5; // High diversity (want different aspects)

      case 'explanation':
        return 0.7; // Balanced (want relevant but varied explanations)

      default:
        return 0.7; // Default balanced approach
    }
  }
}

export default new MMRService();
export { MMRService };
