/**
 * Answerability Classifier Service
 * Determines if a query can be answered from available documents
 * Prevents hallucinations by detecting unanswerable queries
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

interface AnswerabilityResult {
  answerable: boolean;
  confidence: number;
  reason: string;
  suggestion?: string;
  topDocumentScore?: number;
}

class AnswerabilityClassifierService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Check if query can be answered from documents
   */
  async checkAnswerability(
    query: string,
    documents: any[]
  ): Promise<AnswerabilityResult> {
    // No documents = definitely not answerable
    if (!documents || documents.length === 0) {
      return {
        answerable: false,
        confidence: 0,
        reason: 'No relevant documents found',
        suggestion: 'Try rephrasing your question or upload relevant documents'
      };
    }

    // Check top document relevance score
    const topDoc = documents[0];
    const topScore = topDoc.rerankScore || topDoc.fusedScore || topDoc.score || 0;

    // Low relevance threshold
    if (topScore < 0.3) {
      return {
        answerable: false,
        confidence: topScore,
        reason: 'Retrieved documents have low relevance to your question',
        suggestion: 'Your documents may not contain information about this topic',
        topDocumentScore: topScore
      };
    }

    // Medium relevance - use LLM to check
    if (topScore < 0.6) {
      return await this.checkWithLLM(query, documents, topScore);
    }

    // High relevance - likely answerable
    return {
      answerable: true,
      confidence: topScore,
      reason: 'Found highly relevant documents',
      topDocumentScore: topScore
    };
  }

  /**
   * Use LLM to check if answer is in documents
   * For borderline cases where relevance score is medium
   */
  private async checkWithLLM(
    query: string,
    documents: any[],
    topScore: number
  ): Promise<AnswerabilityResult> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200
        }
      });

      const docsPreview = documents
        .slice(0, 3)
        .map(d => (d.content || d.text || '').substring(0, 300))
        .join('\n\n---\n\n');

      const prompt = `You are an answerability classifier. Determine if the QUESTION can be answered from the DOCUMENTS.

QUESTION: ${query}

DOCUMENTS:
${docsPreview}

Can this question be answered from these documents?

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "answerable": true or false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation in one sentence"
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Parse JSON (remove markdown if present)
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonText);

      return {
        answerable: parsed.answerable,
        confidence: parsed.confidence,
        reason: parsed.reason,
        suggestion: parsed.answerable
          ? undefined
          : 'Try asking a different question or upload more relevant documents',
        topDocumentScore: topScore
      };
    } catch (error) {
      console.error('❌ Error in LLM answerability check:', error);

      // Fallback: use relevance score
      return {
        answerable: topScore >= 0.5,
        confidence: topScore,
        reason: 'Based on document relevance score',
        topDocumentScore: topScore
      };
    }
  }

  /**
   * Check if query is a general knowledge question
   * These don't need documents
   */
  isGeneralKnowledgeQuestion(query: string): boolean {
    const generalPatterns = [
      /what is the definition of/i,
      /what does .* mean/i,
      /explain the concept of/i,
      /how does .* work in general/i,
      /who invented/i,
      /when was .* created/i
    ];

    return generalPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Generate appropriate "cannot answer" response
   */
  generateUnanswerableResponse(result: AnswerabilityResult): string {
    const responses = {
      no_documents: `I don't have any documents to answer this question.

**What you can do:**
– Upload documents related to "${result.reason}"
– Rephrase your question to be more specific
– Ask about a different topic`,

      low_relevance: `I couldn't find information about this in your documents.

**Why:** ${result.reason}

**Suggestion:** ${result.suggestion}

**What you can do:**
– Upload documents that contain this information
– Try rephrasing your question
– Ask about a topic that's in your documents`,

      uncertain: `I'm not confident I can answer this accurately from your documents.

**Relevance score:** ${((result.topDocumentScore || 0) * 100).toFixed(1)}%

**What you can do:**
– Rephrase your question to be more specific
– Upload more relevant documents
– Ask a related question that I might be able to answer`
    };

    if (!result.answerable) {
      if (result.confidence === 0) {
        return responses.no_documents;
      } else if (result.confidence < 0.4) {
        return responses.low_relevance;
      } else {
        return responses.uncertain;
      }
    }

    return 'I can answer this question.';
  }

  /**
   * Log answerability for analytics
   */
  async logAnswerability(
    query: string,
    result: AnswerabilityResult,
    userId: string
  ): Promise<void> {
    console.log(`📊 Answerability check for: "${query}"`);
    console.log(`   Result: ${result.answerable ? '✅ Answerable' : '❌ Not answerable'}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Reason: ${result.reason}`);

    // In production, log to database for analytics
    /*
    await db.query(
      `INSERT INTO answerability_logs (query, answerable, confidence, reason, user_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [query, result.answerable, result.confidence, result.reason, userId]
    );
    */
  }
}

export default new AnswerabilityClassifierService();
export { AnswerabilityClassifierService, AnswerabilityResult };
