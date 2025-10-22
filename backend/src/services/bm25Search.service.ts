/**
 * BM25 Keyword Search Service
 * Implements BM25 ranking algorithm for keyword-based document retrieval
 * Used in hybrid search alongside semantic vector search
 */

interface BM25Document {
  id: string;
  content: string;
  tokens: string[];
}

interface BM25Result {
  id: string;
  score: number;
}

class BM25SearchService {
  // BM25 parameters
  private readonly k1 = 1.5; // Term frequency saturation parameter
  private readonly b = 0.75; // Length normalization parameter

  // Document corpus statistics
  private documents: Map<string, BM25Document> = new Map();
  private documentFrequency: Map<string, number> = new Map(); // DF: number of docs containing term
  private averageDocLength = 0;

  /**
   * Tokenize text into searchable terms
   * - Lowercase
   * - Remove punctuation
   * - Remove stop words
   * - Stem words (basic)
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'would', 'could', 'should', 'this',
      'these', 'those', 'i', 'you', 'we', 'they', 'them', 'their',
      'what', 'which', 'who', 'when', 'where', 'why', 'how'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => this.stemWord(word));
  }

  /**
   * Basic word stemming (simplified Porter Stemmer)
   */
  private stemWord(word: string): string {
    // Remove common suffixes
    const suffixes = ['ing', 'ed', 'es', 's', 'ly', 'tion', 'ment', 'ness', 'ity'];

    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.substring(0, word.length - suffix.length);
      }
    }

    return word;
  }

  /**
   * Index documents for BM25 search
   */
  indexDocuments(documents: Array<{ id: string; content: string }>) {
    console.log(`🔍 [BM25] Indexing ${documents.length} documents...`);

    this.documents.clear();
    this.documentFrequency.clear();

    let totalLength = 0;

    // First pass: tokenize and collect term statistics
    for (const doc of documents) {
      const tokens = this.tokenize(doc.content);
      this.documents.set(doc.id, {
        id: doc.id,
        content: doc.content,
        tokens
      });
      totalLength += tokens.length;

      // Count document frequency for each unique term
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.documentFrequency.set(
          token,
          (this.documentFrequency.get(token) || 0) + 1
        );
      }
    }

    this.averageDocLength = totalLength / documents.length;

    console.log(`✅ [BM25] Indexed ${documents.length} documents`);
    console.log(`   Average doc length: ${this.averageDocLength.toFixed(0)} tokens`);
    console.log(`   Unique terms: ${this.documentFrequency.size}`);
  }

  /**
   * Calculate BM25 score for a document given a query
   */
  private calculateBM25Score(queryTokens: string[], docTokens: string[], docLength: number): number {
    let score = 0;
    const N = this.documents.size; // Total number of documents

    // Count term frequencies in document
    const termFrequency = new Map<string, number>();
    for (const token of docTokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }

    // Calculate BM25 for each query term
    for (const queryToken of queryTokens) {
      const tf = termFrequency.get(queryToken) || 0;
      if (tf === 0) continue;

      const df = this.documentFrequency.get(queryToken) || 0;
      if (df === 0) continue;

      // IDF: Inverse Document Frequency
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      // TF component with saturation
      const tfComponent = (tf * (this.k1 + 1)) /
                         (tf + this.k1 * (1 - this.b + this.b * (docLength / this.averageDocLength)));

      score += idf * tfComponent;
    }

    return score;
  }

  /**
   * Search documents using BM25 ranking
   */
  search(query: string, topK: number = 10): BM25Result[] {
    if (this.documents.size === 0) {
      console.warn('⚠️ [BM25] No documents indexed');
      return [];
    }

    const queryTokens = this.tokenize(query);

    if (queryTokens.length === 0) {
      console.warn('⚠️ [BM25] Query has no valid tokens after processing');
      return [];
    }

    console.log(`🔍 [BM25] Searching for: ${queryTokens.join(', ')}`);

    const results: BM25Result[] = [];

    // Score each document
    for (const [docId, doc] of this.documents) {
      const score = this.calculateBM25Score(queryTokens, doc.tokens, doc.tokens.length);

      if (score > 0) {
        results.push({ id: docId, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    console.log(`✅ [BM25] Found ${results.length} matching documents`);

    return results.slice(0, topK);
  }

  /**
   * Get statistics about the indexed corpus
   */
  getStats() {
    return {
      totalDocuments: this.documents.size,
      uniqueTerms: this.documentFrequency.size,
      averageDocLength: this.averageDocLength
    };
  }

  /**
   * Clear the index
   */
  clear() {
    this.documents.clear();
    this.documentFrequency.clear();
    this.averageDocLength = 0;
  }
}

export default new BM25SearchService();
