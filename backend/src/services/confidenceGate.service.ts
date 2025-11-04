/**
 * CONFIDENCE GATE SERVICE - KODA ARCHITECTURAL REDESIGN
 *
 * FIXES: False confidence warnings and low-quality responses
 *
 * OLD SYSTEM PROBLEM:
 * - Confidence assessed AFTER LLM generation (too late!)
 * - If low confidence detected, response already generated and shown to user
 * - No way to prevent bad responses
 *
 * NEW SYSTEM SOLUTION:
 * - Assess confidence BEFORE LLM generation (quality gate)
 * - If confidence too low, REFUSE to generate + suggest alternatives
 * - If medium confidence, generate with caveats
 * - If high confidence, proceed normally
 *
 * MULTI-FACTOR CONFIDENCE SCORING:
 * 1. Coverage: Did we find all requested documents?
 * 2. Quality: Are the retrieved chunks relevant?
 * 3. Relevance: Do chunks actually answer the question?
 */

import { QueryUnderstanding } from './queryUnderstanding.service';
import { RetrievalResult } from './retrievalStrategy.service';

// ===== CONFIDENCE ASSESSMENT OUTPUT =====

export enum ConfidenceQuality {
  HIGH = 'high', // Confidence >= threshold, proceed normally
  MEDIUM = 'medium', // Confidence >= 70% of threshold, proceed with caveats
  LOW = 'low', // Confidence < 70% of threshold, refuse to generate
}

export interface ConfidenceAssessment {
  shouldProceed: boolean; // Should we generate a response?
  quality: ConfidenceQuality;
  confidence: number; // 0-1 overall confidence score

  // Detailed scores
  coverageScore: number; // 0-1 (did we find all requested documents?)
  qualityScore: number; // 0-1 (are chunks relevant?)
  relevanceScore: number; // 0-1 (do chunks answer the question?)

  // Feedback
  reasoning: string;
  caveats?: string; // For medium confidence (e.g., "Based on limited information...")
  refusalReason?: string; // For low confidence (why we're refusing)
  recommendations?: string[]; // Suggestions for user (e.g., "Try uploading document X")
}

// ===== CONFIDENCE GATE SERVICE =====

class ConfidenceGateService {
  /**
   * Main entry point: Assess confidence BEFORE LLM generation
   */
  async assess(
    understanding: QueryUnderstanding,
    retrieval: RetrievalResult
  ): Promise<ConfidenceAssessment> {
    // Step 1: Calculate individual confidence scores
    const coverageScore = this.assessCoverage(retrieval, understanding);
    const qualityScore = this.assessChunkQuality(retrieval);
    const relevanceScore = this.assessRelevance(retrieval, understanding);

    // Step 2: Weighted overall confidence
    const confidence = coverageScore * 0.4 + qualityScore * 0.3 + relevanceScore * 0.3;

    // Step 3: Determine quality level
    const threshold = understanding.confidenceThreshold;

    if (confidence >= threshold) {
      // HIGH CONFIDENCE: Proceed normally
      return {
        shouldProceed: true,
        quality: ConfidenceQuality.HIGH,
        confidence,
        coverageScore,
        qualityScore,
        relevanceScore,
        reasoning: `High confidence (${Math.round(confidence * 100)}%) - all quality metrics passed`,
      };
    } else if (confidence >= threshold * 0.7) {
      // MEDIUM CONFIDENCE: Proceed with caveats
      return {
        shouldProceed: true,
        quality: ConfidenceQuality.MEDIUM,
        confidence,
        coverageScore,
        qualityScore,
        relevanceScore,
        reasoning: `Medium confidence (${Math.round(confidence * 100)}%) - proceeding with caveats`,
        caveats: this.generateCaveats(coverageScore, qualityScore, relevanceScore),
      };
    } else {
      // LOW CONFIDENCE: Refuse to generate
      return {
        shouldProceed: false,
        quality: ConfidenceQuality.LOW,
        confidence,
        coverageScore,
        qualityScore,
        relevanceScore,
        reasoning: `Low confidence (${Math.round(confidence * 100)}%) - refusing to generate`,
        refusalReason: this.generateRefusalReason(coverageScore, qualityScore, relevanceScore, understanding),
        recommendations: this.generateRecommendations(coverageScore, qualityScore, relevanceScore, understanding),
      };
    }
  }

  /**
   * FACTOR 1: Coverage - Did we find all requested documents?
   */
  private assessCoverage(retrieval: RetrievalResult, understanding: QueryUnderstanding): number {
    // If multi-document query, check if we found all documents
    if (understanding.requiresMultiDocument) {
      const requestedDocs = understanding.entities.documentNames.length;
      const foundDocs = retrieval.sources.length;

      if (requestedDocs === 0) return 1.0; // No specific documents requested
      if (foundDocs === 0) return 0.0; // No documents found

      return foundDocs / requestedDocs; // Partial credit
    }

    // For non-multi-document queries, check if we retrieved anything
    if (retrieval.totalChunks === 0 && understanding.requiresRetrieval) {
      return 0.0; // No chunks found
    }

    return 1.0; // Coverage not applicable
  }

  /**
   * FACTOR 2: Quality - Are the retrieved chunks relevant?
   */
  private assessChunkQuality(retrieval: RetrievalResult): number {
    if (retrieval.totalChunks === 0) {
      return 0.0;
    }

    // Average similarity score across all chunks
    const avgSimilarity =
      retrieval.chunks.reduce((sum, chunk) => sum + chunk.similarity, 0) /
      retrieval.totalChunks;

    // Normalize to 0-1 scale (similarity scores are typically 0.3-1.0)
    return Math.max(0, Math.min(1, (avgSimilarity - 0.3) / 0.7));
  }

  /**
   * FACTOR 3: Relevance - Do chunks actually answer the question?
   */
  private assessRelevance(retrieval: RetrievalResult, understanding: QueryUnderstanding): number {
    if (retrieval.totalChunks === 0 && understanding.requiresRetrieval) {
      return 0.0;
    }

    // Check if chunks contain relevant content based on intent
    let relevanceScore = 1.0;

    // For comparisons, check if we have chunks from multiple documents
    if (understanding.requiresMultiDocument) {
      const uniqueDocs = new Set(retrieval.chunks.map(c => c.documentId));
      if (uniqueDocs.size < 2) {
        relevanceScore *= 0.5; // Penalty for missing comparison documents
      }
    }

    // For factual queries, check if top chunks have high similarity
    if (understanding.intent.includes('factual')) {
      const topChunks = retrieval.chunks.slice(0, 3);
      const avgTopSimilarity =
        topChunks.reduce((sum, c) => sum + c.similarity, 0) / (topChunks.length || 1);

      if (avgTopSimilarity < 0.7) {
        relevanceScore *= 0.8; // Penalty for low top similarity
      }
    }

    return relevanceScore;
  }

  /**
   * Generate caveats for medium confidence responses
   */
  private generateCaveats(
    coverageScore: number,
    qualityScore: number,
    relevanceScore: number
  ): string {
    const caveats: string[] = [];

    if (coverageScore < 0.9) {
      caveats.push('Not all requested documents were found.');
    }

    if (qualityScore < 0.7) {
      caveats.push('The available information has lower relevance to your query.');
    }

    if (relevanceScore < 0.8) {
      caveats.push('The retrieved content may not fully answer your question.');
    }

    if (caveats.length === 0) {
      return 'Based on available information, this answer may not be comprehensive.';
    }

    return caveats.join(' ');
  }

  /**
   * Generate refusal reason for low confidence
   */
  private generateRefusalReason(
    coverageScore: number,
    qualityScore: number,
    relevanceScore: number,
    understanding: QueryUnderstanding
  ): string {
    if (coverageScore === 0) {
      if (understanding.requiresMultiDocument) {
        return `I couldn't find the documents you're asking about. Please check the document names and try again.`;
      }
      return `I couldn't find any relevant information in your documents to answer this question.`;
    }

    if (coverageScore < 0.5 && understanding.requiresMultiDocument) {
      const missing = understanding.entities.documentNames.length - Math.round(coverageScore * understanding.entities.documentNames.length);
      return `I could only find ${Math.round(coverageScore * 100)}% of the documents you requested. ${missing} document(s) are missing.`;
    }

    if (qualityScore < 0.3) {
      return `The available information has very low relevance to your query. I cannot provide a confident answer.`;
    }

    if (relevanceScore < 0.4) {
      return `The retrieved content does not appear to answer your question. You may need to rephrase your query or upload additional documents.`;
    }

    return `I don't have enough high-quality information to answer this question confidently.`;
  }

  /**
   * Generate recommendations for low confidence
   */
  private generateRecommendations(
    coverageScore: number,
    qualityScore: number,
    relevanceScore: number,
    understanding: QueryUnderstanding
  ): string[] {
    const recommendations: string[] = [];

    if (coverageScore < 0.5 && understanding.requiresMultiDocument) {
      recommendations.push('Verify that all document names are spelled correctly.');
      recommendations.push('Upload any missing documents needed for comparison.');
    }

    if (qualityScore < 0.5) {
      recommendations.push('Try rephrasing your question to be more specific.');
      recommendations.push('Upload additional documents that might contain relevant information.');
    }

    if (relevanceScore < 0.5 && understanding.entities.documentNames.length === 0) {
      recommendations.push('Try mentioning specific document names in your query.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Rephrase your question with more specific details.');
      recommendations.push('Upload documents that contain the information you need.');
    }

    return recommendations;
  }

  /**
   * Format low confidence response for user
   */
  formatRefusalResponse(assessment: ConfidenceAssessment): string {
    let response = `❌ **I cannot answer this question confidently.**\n\n`;
    response += `**Reason:** ${assessment.refusalReason}\n\n`;

    if (assessment.recommendations && assessment.recommendations.length > 0) {
      response += `**Suggestions:**\n`;
      for (const rec of assessment.recommendations) {
        response += `- ${rec}\n`;
      }
    }

    response += `\n**Confidence Score:** ${Math.round(assessment.confidence * 100)}%\n`;
    response += `- Coverage: ${Math.round(assessment.coverageScore * 100)}%\n`;
    response += `- Quality: ${Math.round(assessment.qualityScore * 100)}%\n`;
    response += `- Relevance: ${Math.round(assessment.relevanceScore * 100)}%\n`;

    return response;
  }

  /**
   * Format medium confidence caveat for user
   */
  formatCaveatPrefix(assessment: ConfidenceAssessment): string {
    return `⚠️  **Note:** ${assessment.caveats}\n\n`;
  }
}

export const confidenceGateService = new ConfidenceGateService();
export default confidenceGateService;
