/**
 * Multilingual Retrieval Service
 * Orchestrates complete cross-lingual retrieval pipeline
 * Combines query expansion + multilingual embeddings + hybrid search
 * Enables PT queries to find EN documents and vice versa
 */

import bilingualQueryExpansionService from './bilingualQueryExpansion.service';
import multilingualEmbeddingService from './multilingualEmbedding.service';
import enhancedRetrievalService from './enhancedRetrieval.service';
import { detectLanguage } from './languageDetection.service';

interface MultilingualRetrievalOptions {
  userId: string;
  topK?: number;
  enableQueryExpansion?: boolean;
  targetLanguages?: string[];
  fusionStrategy?: 'rrf' | 'weighted' | 'best_per_language';
  minRelevanceScore?: number;
}

interface MultilingualRetrievalResult {
  documents: any[];
  queryInfo: {
    original: string;
    originalLang: string;
    expandedQueries: string[];
    translatedTo: string[];
  };
  retrievalStats: {
    totalCandidates: number;
    resultsPerLanguage: Map<string, number>;
    fusionMethod: string;
    executionTimeMs: number;
  };
}

class MultilingualRetrievalService {
  /**
   * Perform multilingual retrieval
   *
   * Example:
   *   Query: "qual é o ICP da Koda?" (PT)
   *
   *   Step 1: Expand to EN, ES
   *     - PT: "qual é o ICP da Koda?"
   *     - EN: "what is Koda's ICP?"
   *     - ES: "¿cuál es el ICP de Koda?"
   *
   *   Step 2: Search with each query
   *     - PT query finds PT documents
   *     - EN query finds EN documents
   *     - ES query finds ES documents
   *
   *   Step 3: Merge results with RRF
   *     - Deduplicate
   *     - Rank by fused score
   *     - Return top-K
   */
  async retrieve(
    query: string,
    options: MultilingualRetrievalOptions
  ): Promise<MultilingualRetrievalResult> {
    const startTime = Date.now();

    const {
      userId,
      topK = 5,
      enableQueryExpansion = true,
      targetLanguages,
      fusionStrategy = 'rrf',
      minRelevanceScore = 0.3
    } = options;

    console.log('🌍 Starting multilingual retrieval...');
    console.log(`   Query: "${query}"`);

    // Step 1: Detect query language
    const originalLang = detectLanguage(query);
    console.log(`   Detected language: ${originalLang}`);

    // Step 2: Expand query to multiple languages
    let expandedQueries = [query];
    let translatedTo: string[] = [];

    if (enableQueryExpansion) {
      console.log('   Expanding query to multiple languages...');

      const expansion = await bilingualQueryExpansionService.expandQuery(
        query,
        userId,
        targetLanguages
      );

      expandedQueries = expansion.allQueries;
      translatedTo = expansion.translations.map(t => t.lang);

      console.log(`   Expanded to ${expandedQueries.length} queries across ${translatedTo.length + 1} languages`);
    }

    // Step 3: Retrieve with each query
    console.log('   Retrieving documents for each query...');

    const retrievalPromises = expandedQueries.map(async (q, index) => {
      const lang = index === 0 ? originalLang : translatedTo[index - 1];

      console.log(`     [${lang}] Searching for: "${q}"`);

      try {
        // Use enhanced retrieval for each query
        const results = await enhancedRetrievalService.retrieve(q, userId, {
          topK: topK * 2, // Get more candidates for fusion
          enableMMR: false, // We'll apply MMR after fusion
          enableReranking: true
        });

        // Tag results with language
        return results.map(doc => ({
          ...doc,
          queryLanguage: lang,
          queryText: q
        }));
      } catch (error) {
        console.error(`     ❌ Error retrieving for [${lang}]:`, error);
        return [];
      }
    });

    const retrievalResults = await Promise.all(retrievalPromises);

    // Step 4: Merge results
    console.log('   Merging multilingual results...');

    const allCandidates = retrievalResults.flat();
    console.log(`   Total candidates: ${allCandidates.length}`);

    let fusedResults: any[] = [];

    if (fusionStrategy === 'rrf') {
      fusedResults = this.fuseWithRRF(retrievalResults);
    } else if (fusionStrategy === 'weighted') {
      fusedResults = this.fuseWithWeightedAverage(retrievalResults, originalLang);
    } else if (fusionStrategy === 'best_per_language') {
      fusedResults = this.fuseBestPerLanguage(retrievalResults, topK);
    }

    // Step 5: Filter by relevance
    fusedResults = fusedResults.filter(
      doc => (doc.rerankScore || doc.score || 0) >= minRelevanceScore
    );

    console.log(`   After fusion & filtering: ${fusedResults.length} documents`);

    // Step 6: Take top-K
    const finalResults = fusedResults.slice(0, topK);

    // Calculate stats
    const resultsPerLanguage = new Map<string, number>();
    for (const doc of finalResults) {
      const lang = doc.queryLanguage || 'unknown';
      resultsPerLanguage.set(lang, (resultsPerLanguage.get(lang) || 0) + 1);
    }

    const executionTimeMs = Date.now() - startTime;

    console.log(`   Final results: ${finalResults.length} documents`);
    console.log(`   Execution time: ${executionTimeMs}ms`);

    // Log language distribution
    console.log('   Results by language:');
    for (const [lang, count] of resultsPerLanguage.entries()) {
      console.log(`     - ${lang}: ${count} documents`);
    }

    return {
      documents: finalResults,
      queryInfo: {
        original: query,
        originalLang,
        expandedQueries,
        translatedTo
      },
      retrievalStats: {
        totalCandidates: allCandidates.length,
        resultsPerLanguage,
        fusionMethod: fusionStrategy,
        executionTimeMs
      }
    };
  }

  /**
   * Fuse results using Reciprocal Rank Fusion (RRF)
   * Merges ranked lists from different languages
   */
  private fuseWithRRF(retrievalResults: any[][]): any[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, { doc: any; score: number; appearances: number }>();

    for (const results of retrievalResults) {
      results.forEach((doc, rank) => {
        const docId = doc.id || doc.chunkId || JSON.stringify(doc).substring(0, 100);

        const rrfScore = 1.0 / (k + rank + 1);

        if (scoreMap.has(docId)) {
          const existing = scoreMap.get(docId)!;
          existing.score += rrfScore;
          existing.appearances++;
        } else {
          scoreMap.set(docId, {
            doc,
            score: rrfScore,
            appearances: 1
          });
        }
      });
    }

    // Sort by RRF score
    const fused = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(entry => ({
        ...entry.doc,
        multilingualScore: entry.score,
        languageAppearances: entry.appearances
      }));

    return fused;
  }

  /**
   * Fuse results using weighted average
   * Gives higher weight to results from original language
   */
  private fuseWithWeightedAverage(
    retrievalResults: any[][],
    originalLang: string
  ): any[] {
    const scoreMap = new Map<string, { doc: any; totalScore: number; count: number }>();

    for (const results of retrievalResults) {
      if (results.length === 0) continue;

      // Weight: 2x for original language, 1x for translated
      const queryLang = results[0]?.queryLanguage || 'unknown';
      const weight = queryLang === originalLang ? 2.0 : 1.0;

      for (const doc of results) {
        const docId = doc.id || doc.chunkId || JSON.stringify(doc).substring(0, 100);
        const score = (doc.rerankScore || doc.score || 0) * weight;

        if (scoreMap.has(docId)) {
          const existing = scoreMap.get(docId)!;
          existing.totalScore += score;
          existing.count++;
        } else {
          scoreMap.set(docId, {
            doc,
            totalScore: score,
            count: 1
          });
        }
      }
    }

    // Sort by average score
    const fused = Array.from(scoreMap.values())
      .map(entry => ({
        ...entry.doc,
        multilingualScore: entry.totalScore / entry.count,
        languageAppearances: entry.count
      }))
      .sort((a, b) => b.multilingualScore - a.multilingualScore);

    return fused;
  }

  /**
   * Fuse by taking best results from each language
   * Ensures diversity across languages
   */
  private fuseBestPerLanguage(retrievalResults: any[][], topKPerLang: number): any[] {
    const resultsByLanguage = new Map<string, any[]>();

    // Group results by language
    for (const results of retrievalResults) {
      if (results.length === 0) continue;

      const lang = results[0]?.queryLanguage || 'unknown';

      if (!resultsByLanguage.has(lang)) {
        resultsByLanguage.set(lang, []);
      }

      resultsByLanguage.get(lang)!.push(...results);
    }

    // Take top results from each language
    const fused: any[] = [];

    for (const [lang, results] of resultsByLanguage.entries()) {
      // Sort by score within language
      const sorted = results
        .sort((a, b) => {
          const scoreA = a.rerankScore || a.score || 0;
          const scoreB = b.rerankScore || b.score || 0;
          return scoreB - scoreA;
        })
        .slice(0, topKPerLang);

      fused.push(...sorted);
    }

    // Final sort by score
    return fused.sort((a, b) => {
      const scoreA = a.rerankScore || a.score || 0;
      const scoreB = b.rerankScore || b.score || 0;
      return scoreB - scoreA;
    });
  }

  /**
   * Test multilingual retrieval
   */
  async testMultilingualRetrieval(userId: string): Promise<void> {
    console.log('🧪 Testing multilingual retrieval...\n');

    const testQueries = [
      { query: 'What is the ideal customer profile?', expectedLangs: ['en', 'pt', 'es'] },
      { query: 'Qual é o perfil do cliente ideal?', expectedLangs: ['pt', 'en', 'es'] },
      { query: '¿Cuál es el perfil del cliente ideal?', expectedLangs: ['es', 'en', 'pt'] }
    ];

    for (const testCase of testQueries) {
      console.log(`\nTest Query: "${testCase.query}"`);
      console.log(`Expected languages: [${testCase.expectedLangs.join(', ')}]`);
      console.log('---');

      try {
        const result = await this.retrieve(testCase.query, {
          userId,
          topK: 5,
          enableQueryExpansion: true,
          fusionStrategy: 'rrf'
        });

        console.log('\nResults:');
        console.log(`  Original language: ${result.queryInfo.originalLang}`);
        console.log(`  Translated to: [${result.queryInfo.translatedTo.join(', ')}]`);
        console.log(`  Total candidates: ${result.retrievalStats.totalCandidates}`);
        console.log(`  Final results: ${result.documents.length}`);
        console.log(`  Execution time: ${result.retrievalStats.executionTimeMs}ms`);

        console.log('\n  Results by language:');
        for (const [lang, count] of result.retrievalStats.resultsPerLanguage.entries()) {
          console.log(`    - ${lang}: ${count} documents`);
        }

        console.log('\n  Top 3 documents:');
        result.documents.slice(0, 3).forEach((doc, i) => {
          console.log(`    ${i + 1}. [${doc.queryLanguage}] ${doc.name || 'Untitled'}`);
          console.log(`       Score: ${(doc.multilingualScore || doc.score || 0).toFixed(3)}`);
        });

        console.log('\n✅ Test completed\n');
        console.log('═══════════════════════════════════════════════════════\n');
      } catch (error) {
        console.error('❌ Test failed:', error);
      }
    }
  }

  /**
   * Generate multilingual retrieval report
   */
  generateReport(result: MultilingualRetrievalResult): string {
    const langDistribution = Array.from(result.retrievalStats.resultsPerLanguage.entries())
      .map(([lang, count]) => `${lang}: ${count}`)
      .join(', ');

    return `
═══════════════════════════════════════════════════════
MULTILINGUAL RETRIEVAL REPORT
═══════════════════════════════════════════════════════
Query: "${result.queryInfo.original}"
Original Language: ${result.queryInfo.originalLang}
Translated To: [${result.queryInfo.translatedTo.join(', ')}]

Retrieval Statistics:
  Total Candidates: ${result.retrievalStats.totalCandidates}
  Final Results: ${result.documents.length}
  Fusion Method: ${result.retrievalStats.fusionMethod}
  Execution Time: ${result.retrievalStats.executionTimeMs}ms

Language Distribution:
  ${langDistribution}

Top Results:
${result.documents.slice(0, 5).map((doc, i) => {
  const score = doc.multilingualScore || doc.rerankScore || doc.score || 0;
  return `  ${i + 1}. [${doc.queryLanguage}] ${doc.name || 'Untitled'} (score: ${score.toFixed(3)})`;
}).join('\n')}
═══════════════════════════════════════════════════════
    `.trim();
  }
}

export default new MultilingualRetrievalService();
export { MultilingualRetrievalService, MultilingualRetrievalResult, MultilingualRetrievalOptions };
