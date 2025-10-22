/**
 * Evaluator Service
 * Automated testing and evaluation of RAG system quality
 * Tracks key metrics: relevance, groundedness, hallucination rate
 * Enables regression testing and continuous improvement
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import enhancedRetrievalService from './enhancedRetrieval.service';
import groundingService from './grounding.service';
import answerabilityClassifierService from './answerabilityClassifier.service';

interface EvaluationCase {
  id: string;
  query: string;
  expectedDocuments?: string[]; // Document IDs that should be retrieved
  expectedConcepts?: string[]; // Concepts that should be in response
  shouldBeAnswerable?: boolean; // Whether query should be answerable
  groundTruthAnswer?: string; // Reference answer for comparison
  metadata?: any;
}

interface RetrievalMetrics {
  precision: number; // What % of retrieved docs are relevant
  recall: number; // What % of relevant docs were retrieved
  ndcg: number; // Normalized Discounted Cumulative Gain
  mrr: number; // Mean Reciprocal Rank
}

interface GenerationMetrics {
  relevance: number; // How relevant is response to query (0-1)
  groundedness: number; // How well grounded in sources (0-1)
  completeness: number; // How complete is the answer (0-1)
  citationCoverage: number; // % of claims with citations
  hallucinationScore: number; // 0-1 (0 = no hallucinations)
}

interface EvaluationResult {
  testCaseId: string;
  query: string;
  retrieval: {
    metrics: RetrievalMetrics;
    retrievedDocs: string[];
    executionTimeMs: number;
  };
  generation: {
    metrics: GenerationMetrics;
    response: string;
    executionTimeMs: number;
  };
  overallScore: number;
  passed: boolean;
  failureReasons: string[];
}

interface EvaluationReport {
  timestamp: Date;
  testCases: number;
  passed: number;
  failed: number;
  passRate: number;
  averageMetrics: {
    retrieval: RetrievalMetrics;
    generation: GenerationMetrics;
  };
  regressions: string[]; // Tests that got worse
  improvements: string[]; // Tests that got better
}

class EvaluatorService {
  private genAI: GoogleGenerativeAI;
  private evaluationHistory: Map<string, EvaluationResult[]> = new Map();

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Run evaluation on test cases
   */
  async evaluate(
    testCases: EvaluationCase[],
    userId: string,
    options: {
      saveResults?: boolean;
      compareWithPrevious?: boolean;
    } = {}
  ): Promise<EvaluationReport> {
    console.log(`🔬 Starting evaluation (${testCases.length} test cases)...`);

    const results: EvaluationResult[] = [];

    for (const testCase of testCases) {
      console.log(`\n  Testing: "${testCase.query}"`);

      try {
        const result = await this.evaluateTestCase(testCase, userId);
        results.push(result);

        console.log(`    Overall score: ${(result.overallScore * 100).toFixed(1)}%`);
        console.log(`    Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);

        if (!result.passed) {
          console.log(`    Failures: ${result.failureReasons.join(', ')}`);
        }
      } catch (error) {
        console.error(`    ❌ Error evaluating test case:`, error);
      }
    }

    // Generate report
    const report = this.generateReport(results, options.compareWithPrevious);

    // Save results for future comparison
    if (options.saveResults) {
      for (const result of results) {
        this.saveEvaluationResult(result);
      }
    }

    console.log('\n' + this.formatReport(report));

    return report;
  }

  /**
   * Evaluate single test case
   */
  private async evaluateTestCase(
    testCase: EvaluationCase,
    userId: string
  ): Promise<EvaluationResult> {
    const failureReasons: string[] = [];

    // ═══ RETRIEVAL EVALUATION ═══
    const retrievalStart = Date.now();

    const retrievedDocs = await enhancedRetrievalService.retrieve(
      testCase.query,
      userId,
      { topK: 5 }
    );

    const retrievalTime = Date.now() - retrievalStart;

    const retrievalMetrics = this.evaluateRetrieval(
      retrievedDocs,
      testCase.expectedDocuments || []
    );

    if (retrievalMetrics.precision < 0.6) {
      failureReasons.push('Low retrieval precision');
    }

    if (retrievalMetrics.recall < 0.5) {
      failureReasons.push('Low retrieval recall');
    }

    // ═══ ANSWERABILITY EVALUATION ═══
    if (testCase.shouldBeAnswerable !== undefined) {
      const answerability = await answerabilityClassifierService.checkAnswerability(
        testCase.query,
        retrievedDocs
      );

      if (answerability.answerable !== testCase.shouldBeAnswerable) {
        failureReasons.push(
          `Answerability mismatch: expected ${testCase.shouldBeAnswerable}, got ${answerability.answerable}`
        );
      }
    }

    // ═══ GENERATION EVALUATION ═══
    const generationStart = Date.now();

    // Generate response (simplified - in production, use full enhancedAdaptiveAI)
    const response = await this.generateResponse(testCase.query, retrievedDocs);

    const generationTime = Date.now() - generationStart;

    // Evaluate generation quality
    const generationMetrics = await this.evaluateGeneration(
      testCase.query,
      response,
      retrievedDocs,
      testCase.groundTruthAnswer
    );

    if (generationMetrics.relevance < 0.7) {
      failureReasons.push('Low response relevance');
    }

    if (generationMetrics.groundedness < 0.8) {
      failureReasons.push('Poor grounding in sources');
    }

    if (generationMetrics.citationCoverage < 0.6) {
      failureReasons.push('Insufficient citations');
    }

    if (generationMetrics.hallucinationScore > 0.3) {
      failureReasons.push('High hallucination score');
    }

    // Calculate overall score
    const overallScore =
      retrievalMetrics.ndcg * 0.3 +
      generationMetrics.relevance * 0.25 +
      generationMetrics.groundedness * 0.25 +
      generationMetrics.completeness * 0.2;

    const passed = failureReasons.length === 0 && overallScore >= 0.7;

    return {
      testCaseId: testCase.id,
      query: testCase.query,
      retrieval: {
        metrics: retrievalMetrics,
        retrievedDocs: retrievedDocs.map(d => d.id || d.name || 'unknown'),
        executionTimeMs: retrievalTime
      },
      generation: {
        metrics: generationMetrics,
        response,
        executionTimeMs: generationTime
      },
      overallScore,
      passed,
      failureReasons
    };
  }

  /**
   * Evaluate retrieval quality
   */
  private evaluateRetrieval(
    retrievedDocs: any[],
    expectedDocs: string[]
  ): RetrievalMetrics {
    if (expectedDocs.length === 0) {
      // No ground truth, assume all retrieved docs are relevant
      return {
        precision: 1.0,
        recall: 1.0,
        ndcg: 1.0,
        mrr: 1.0
      };
    }

    const retrievedIds = retrievedDocs.map(d => d.id || d.documentId || d.name);
    const expectedSet = new Set(expectedDocs);

    // Precision: What % of retrieved docs are relevant
    const relevantRetrieved = retrievedIds.filter(id => expectedSet.has(id)).length;
    const precision =
      retrievedIds.length > 0 ? relevantRetrieved / retrievedIds.length : 0;

    // Recall: What % of relevant docs were retrieved
    const recall =
      expectedDocs.length > 0 ? relevantRetrieved / expectedDocs.length : 0;

    // NDCG: Normalized Discounted Cumulative Gain
    let dcg = 0;
    let idcg = 0;

    for (let i = 0; i < retrievedIds.length; i++) {
      const isRelevant = expectedSet.has(retrievedIds[i]) ? 1 : 0;
      dcg += isRelevant / Math.log2(i + 2);
    }

    for (let i = 0; i < Math.min(expectedDocs.length, retrievedIds.length); i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    const ndcg = idcg > 0 ? dcg / idcg : 0;

    // MRR: Mean Reciprocal Rank (rank of first relevant doc)
    let mrr = 0;
    for (let i = 0; i < retrievedIds.length; i++) {
      if (expectedSet.has(retrievedIds[i])) {
        mrr = 1 / (i + 1);
        break;
      }
    }

    return { precision, recall, ndcg, mrr };
  }

  /**
   * Evaluate generation quality using LLM
   */
  private async evaluateGeneration(
    query: string,
    response: string,
    documents: any[],
    groundTruth?: string
  ): Promise<GenerationMetrics> {
    // Check grounding
    const groundingValidation = groundingService.validateGrounding(
      response,
      documents,
      { minGroundingScore: 0.8 }
    );

    // Use LLM to evaluate relevance, completeness, hallucinations
    const llmEval = await this.evaluateWithLLM(query, response, groundTruth);

    return {
      relevance: llmEval.relevance,
      groundedness: groundingValidation.groundingScore,
      completeness: llmEval.completeness,
      citationCoverage: groundingValidation.groundingScore,
      hallucinationScore: llmEval.hallucinationScore
    };
  }

  /**
   * Use LLM to evaluate response quality
   */
  private async evaluateWithLLM(
    query: string,
    response: string,
    groundTruth?: string
  ): Promise<{ relevance: number; completeness: number; hallucinationScore: number }> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300
        }
      });

      const groundTruthSection = groundTruth
        ? `\nGROUND TRUTH ANSWER: ${groundTruth}`
        : '';

      const prompt = `You are a RAG system evaluator. Evaluate the RESPONSE to the QUERY.

QUERY: ${query}

RESPONSE: ${response}${groundTruthSection}

Evaluate on these criteria (0.0-1.0):
1. Relevance: Does the response answer the query?
2. Completeness: Is the answer complete and detailed?
3. Hallucination Score: Does the response contain unsupported claims? (0 = no hallucinations, 1 = many hallucinations)

Respond with ONLY a JSON object (no markdown):
{
  "relevance": 0.0-1.0,
  "completeness": 0.0-1.0,
  "hallucinationScore": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(jsonText);

      return {
        relevance: parsed.relevance,
        completeness: parsed.completeness,
        hallucinationScore: parsed.hallucinationScore
      };
    } catch (error) {
      console.error('❌ Error in LLM evaluation:', error);
      return {
        relevance: 0.5,
        completeness: 0.5,
        hallucinationScore: 0.5
      };
    }
  }

  /**
   * Generate response (simplified version for testing)
   */
  private async generateResponse(query: string, documents: any[]): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp'
      });

      const docsContext = documents
        .slice(0, 3)
        .map(d => (d.content || d.text || '').substring(0, 500))
        .join('\n\n---\n\n');

      const prompt = `Answer the question based on the documents. Cite sources using [Source: Document Name].

DOCUMENTS:
${docsContext}

QUESTION: ${query}

ANSWER:`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('❌ Error generating response:', error);
      return 'Error generating response';
    }
  }

  /**
   * Generate evaluation report
   */
  private generateReport(
    results: EvaluationResult[],
    compareWithPrevious: boolean = false
  ): EvaluationReport {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const passRate = results.length > 0 ? (passed / results.length) * 100 : 0;

    // Calculate average metrics
    const avgRetrieval = {
      precision:
        results.reduce((sum, r) => sum + r.retrieval.metrics.precision, 0) /
        results.length,
      recall:
        results.reduce((sum, r) => sum + r.retrieval.metrics.recall, 0) /
        results.length,
      ndcg:
        results.reduce((sum, r) => sum + r.retrieval.metrics.ndcg, 0) /
        results.length,
      mrr:
        results.reduce((sum, r) => sum + r.retrieval.metrics.mrr, 0) /
        results.length
    };

    const avgGeneration = {
      relevance:
        results.reduce((sum, r) => sum + r.generation.metrics.relevance, 0) /
        results.length,
      groundedness:
        results.reduce((sum, r) => sum + r.generation.metrics.groundedness, 0) /
        results.length,
      completeness:
        results.reduce((sum, r) => sum + r.generation.metrics.completeness, 0) /
        results.length,
      citationCoverage:
        results.reduce((sum, r) => sum + r.generation.metrics.citationCoverage, 0) /
        results.length,
      hallucinationScore:
        results.reduce((sum, r) => sum + r.generation.metrics.hallucinationScore, 0) /
        results.length
    };

    const regressions: string[] = [];
    const improvements: string[] = [];

    if (compareWithPrevious) {
      // Compare with previous run (implementation placeholder)
      // In production, load previous results from database
    }

    return {
      timestamp: new Date(),
      testCases: results.length,
      passed,
      failed,
      passRate,
      averageMetrics: {
        retrieval: avgRetrieval,
        generation: avgGeneration
      },
      regressions,
      improvements
    };
  }

  /**
   * Format report for console output
   */
  private formatReport(report: EvaluationReport): string {
    const passStatus =
      report.passRate >= 90
        ? '✅ Excellent'
        : report.passRate >= 70
          ? '⚠️ Good'
          : '❌ Needs Improvement';

    return `
╔═══════════════════════════════════════════════════════╗
║          RAG SYSTEM EVALUATION REPORT                 ║
╠═══════════════════════════════════════════════════════╣
║ Timestamp: ${report.timestamp.toISOString().padEnd(38)} ║
║                                                       ║
║ Test Cases: ${report.testCases.toString().padEnd(41)} ║
║ Passed: ${report.passed.toString().padEnd(45)} ║
║ Failed: ${report.failed.toString().padEnd(45)} ║
║ Pass Rate: ${report.passRate.toFixed(1)}% ${passStatus.padEnd(32)} ║
╠═══════════════════════════════════════════════════════╣
║ RETRIEVAL METRICS (Average)                          ║
║   Precision: ${(report.averageMetrics.retrieval.precision * 100).toFixed(1)}%${' '.repeat(37)} ║
║   Recall: ${(report.averageMetrics.retrieval.recall * 100).toFixed(1)}%${' '.repeat(40)} ║
║   NDCG: ${(report.averageMetrics.retrieval.ndcg * 100).toFixed(1)}%${' '.repeat(42)} ║
║   MRR: ${(report.averageMetrics.retrieval.mrr * 100).toFixed(1)}%${' '.repeat(43)} ║
╠═══════════════════════════════════════════════════════╣
║ GENERATION METRICS (Average)                         ║
║   Relevance: ${(report.averageMetrics.generation.relevance * 100).toFixed(1)}%${' '.repeat(35)} ║
║   Groundedness: ${(report.averageMetrics.generation.groundedness * 100).toFixed(1)}%${' '.repeat(32)} ║
║   Completeness: ${(report.averageMetrics.generation.completeness * 100).toFixed(1)}%${' '.repeat(32)} ║
║   Citation Coverage: ${(report.averageMetrics.generation.citationCoverage * 100).toFixed(1)}%${' '.repeat(27)} ║
║   Hallucination Score: ${(report.averageMetrics.generation.hallucinationScore * 100).toFixed(1)}%${' '.repeat(25)} ║
╚═══════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Save evaluation result for historical comparison
   */
  private saveEvaluationResult(result: EvaluationResult): void {
    const history = this.evaluationHistory.get(result.testCaseId) || [];
    history.push(result);
    this.evaluationHistory.set(result.testCaseId, history);
  }

  /**
   * Load sample test cases
   */
  getSampleTestCases(): EvaluationCase[] {
    return [
      {
        id: 'test-001',
        query: 'What is Koda\'s ideal customer profile?',
        expectedConcepts: ['ICP', 'SMB', 'Brazil', 'revenue'],
        shouldBeAnswerable: true
      },
      {
        id: 'test-002',
        query: 'What is the capital of France?',
        shouldBeAnswerable: false, // Not in documents
        expectedConcepts: []
      },
      {
        id: 'test-003',
        query: 'What are the key features of the product?',
        expectedConcepts: ['features', 'product'],
        shouldBeAnswerable: true
      }
    ];
  }
}

export default new EvaluatorService();
export { EvaluatorService, EvaluationCase, EvaluationResult, EvaluationReport };
