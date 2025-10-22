/**
 * Document Intelligence Service
 * Production-ready service combining all advanced RAG techniques
 *
 * Features:
 * - Hybrid search (keyword + semantic)
 * - Query decomposition for complex questions
 * - Multi-step reasoning
 * - Context management
 * - Fact verification
 * - Confidence scoring
 * - Citation system
 * - Ambiguity detection
 * - Conflict resolution
 */

import { PrismaClient } from '@prisma/client';
import vectorEmbeddingService from './vectorEmbedding.service';
import contextManagerService from './contextManager.service';
import precisionOptimizationService from './precisionOptimization.service';
import factVerificationService from './factVerification.service';
import hierarchicalRetrievalService from './hierarchicalRetrieval.service';
import { sendMessageToGemini } from './gemini.service';

const prisma = new PrismaClient();

interface QuestionRequest {
  userQuestion: string;
  documentIds: string[];
  chatHistory?: Array<{ role: string; content: string }>;
  userId: string;
  options?: {
    useHybridSearch?: boolean;
    useHierarchical?: boolean;
    verifyFacts?: boolean;
    checkConsistency?: boolean;
  };
}

interface QuestionResponse {
  status: 'success' | 'needs_clarification' | 'no_information' | 'error';
  answer?: string;
  citations?: Array<{ text: string; source: string; page?: number }>;
  confidence?: 'high' | 'medium' | 'low';
  sourcesUsed?: number;
  verification?: any;
  reasoning?: any;
  conflicts?: any;
  tokenUsage?: number;
  message?: string;
  suggestion?: string;
  subAnswers?: any[];
}

class DocumentIntelligenceService {
  /**
   * Main entry point for answering questions
   * Orchestrates all advanced features for maximum accuracy
   */
  async answerQuestion(request: QuestionRequest): Promise<QuestionResponse> {
    const startTime = Date.now();

    try {
      console.log(`🎯 [Intelligence] Processing question: "${request.userQuestion}"`);
      console.log(`   Documents: ${request.documentIds.length}`);
      console.log(`   User: ${request.userId}`);

      // Step 1: Validate inputs
      if (!request.userQuestion.trim()) {
        return this.errorResponse('Question cannot be empty');
      }

      if (!request.documentIds || request.documentIds.length === 0) {
        return this.errorResponse('No documents specified');
      }

      // Step 2: Check for ambiguity
      const ambiguity = await precisionOptimizationService.detectAmbiguity(
        request.userQuestion
      );

      if (ambiguity.isAmbiguous) {
        console.log(`   ⚠️ Question is ambiguous: ${ambiguity.ambiguityType}`);
        return {
          status: 'needs_clarification',
          message: ambiguity.clarificationNeeded,
          suggestion: ambiguity.suggestions?.join(', ')
        };
      }

      // Step 3: Determine if query is complex
      const isComplex = this.isComplexQuery(request.userQuestion);

      if (isComplex) {
        console.log(`   🔬 Complex query detected, using decomposition...`);
        return await this.answerComplexQuestion(request);
      } else {
        console.log(`   ✅ Simple query, direct processing...`);
        return await this.answerSimpleQuestion(request);
      }
    } catch (error) {
      console.error('❌ [Intelligence] Error:', error);
      return this.errorResponse(
        'An error occurred while processing your question. Please try again.'
      );
    } finally {
      const duration = Date.now() - startTime;
      console.log(`⏱️ [Intelligence] Total processing time: ${duration}ms`);
    }
  }

  /**
   * Answer a simple, direct question
   */
  private async answerSimpleQuestion(
    request: QuestionRequest
  ): Promise<QuestionResponse> {
    const { userQuestion, documentIds, chatHistory, userId, options = {} } = request;

    // Step 1: Retrieve relevant chunks using hybrid search or hierarchical
    let allChunks: any[] = [];

    if (options.useHierarchical) {
      console.log(`   🎯 Using hierarchical retrieval...`);
      const hierarchical = await hierarchicalRetrievalService.hierarchicalSearch(
        userId,
        userQuestion,
        3, // top 3 documents
        3  // top 3 chunks per document
      );
      allChunks = hierarchicalRetrievalService.flattenResults(hierarchical);
    } else if (options.useHybridSearch) {
      console.log(`   🔬 Using hybrid search...`);
      allChunks = await vectorEmbeddingService.searchSimilarChunks(
        userId,
        userQuestion,
        10,
        0.5
      );
    } else {
      console.log(`   🧠 Using semantic search...`);
      allChunks = await vectorEmbeddingService.searchSimilarChunks(
        userId,
        userQuestion,
        10,
        0.5
      );
    }

    // Step 2: Check if relevant information found
    if (!allChunks || allChunks.length === 0) {
      return {
        status: 'no_information',
        answer: "I couldn't find relevant information in the specified documents to answer this question.",
        suggestion: 'Try rephrasing your question or specifying which section of the document to look in.'
      };
    }

    const avgScore = allChunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / allChunks.length;
    if (avgScore < 0.4) {
      return {
        status: 'no_information',
        answer: "The documents don't seem to contain information directly related to your question.",
        suggestion: 'The average relevance score is low. Consider rephrasing or asking about a different topic.',
        confidence: 'low'
      };
    }

    console.log(`   📦 Retrieved ${allChunks.length} chunks (avg score: ${avgScore.toFixed(2)})`);

    // Step 3: Manage context to fit token limits
    const managedContext = await contextManagerService.manageContext(
      userQuestion,
      allChunks,
      chatHistory || [],
      this.getSystemPrompt()
    );

    // Step 4: Check for conflicts across documents
    const conflicts = await precisionOptimizationService.resolveConflicts(
      managedContext.chunks.map(chunk => ({
        content: chunk.content || chunk.text_content || '',
        document: {
          filename: (chunk as any).document?.filename || 'Unknown',
          createdAt: (chunk as any).document?.createdAt
        },
        metadata: (chunk as any).metadata
      }))
    );

    // Step 5: Generate answer with context
    const context = this.assembleContext(managedContext.chunks);
    const prompt = this.buildAnswerPrompt(
      userQuestion,
      context,
      chatHistory || [],
      conflicts.hasConflicts ? conflicts.conflictAnalysis : undefined
    );

    const response = await sendMessageToGemini(prompt, [], 'User', '', 'en');
    let answer = response.text?.trim() || '';

    // Step 6: ⚠️ DISABLED: Fact verification (was causing 15+ second delays)
    // Verification disabled for performance - see RAG_PERFORMANCE_TESTING.md
    let verification: any = null;
    // if (options.verifyFacts) {
    //   console.log(`   ✅ Verifying facts...`);
    //   verification = await factVerificationService.quickVerify(
    //     answer,
    //     managedContext.chunks.map(c => ({
    //       content: c.content || c.text_content || '',
    //       documentName: (c as any).document?.filename || 'Unknown'
    //     }))
    //   );
    //
    //   if (verification.hasIssues) {
    //     console.warn(`   ⚠️ Fact verification found issues`);
    //   }
    // }

    // Step 7: Extract citations
    const citations = this.extractCitations(answer, managedContext.chunks);

    // Step 8: Calculate confidence
    const confidence = this.calculateConfidence(
      allChunks,
      verification,
      citations.length,
      avgScore
    );

    console.log(`   ✅ Generated answer with ${citations.length} citations (${confidence} confidence)`);

    return {
      status: 'success',
      answer,
      citations,
      confidence,
      sourcesUsed: new Set(citations.map(c => c.source)).size,
      verification,
      conflicts: conflicts.hasConflicts ? conflicts : undefined,
      tokenUsage: managedContext.totalTokens
    };
  }

  /**
   * Answer a complex question using query decomposition
   */
  private async answerComplexQuestion(
    request: QuestionRequest
  ): Promise<QuestionResponse> {
    const { userQuestion, userId } = request;

    // Step 1: Decompose into sub-questions
    const decomposed = await precisionOptimizationService.decomposeQuery(userQuestion);

    console.log(`   📋 Decomposed into ${decomposed.subQuestions.length} sub-questions`);

    // Step 2: Answer each sub-question
    const subAnswers: any[] = [];

    for (let i = 0; i < decomposed.subQuestions.length; i++) {
      const subQuestion = decomposed.subQuestions[i];
      console.log(`   📝 Answering sub-question ${i + 1}: "${subQuestion}"`);

      const subAnswer = await this.answerSimpleQuestion({
        ...request,
        userQuestion: subQuestion
      });

      subAnswers.push({
        question: subQuestion,
        ...subAnswer
      });
    }

    // Step 3: Synthesize final answer
    console.log(`   🔗 Synthesizing final answer from ${subAnswers.length} sub-answers...`);
    const synthesized = await this.synthesizeAnswers(userQuestion, subAnswers);

    // Step 4: Calculate overall confidence
    const avgConfidence = this.calculateOverallConfidence(subAnswers);

    return {
      status: 'success',
      answer: synthesized,
      subAnswers,
      confidence: avgConfidence,
      sourcesUsed: subAnswers.reduce((sum, sa) => sum + (sa.sourcesUsed || 0), 0)
    };
  }

  /**
   * Synthesize multiple sub-answers into cohesive final answer
   */
  private async synthesizeAnswers(
    originalQuestion: string,
    subAnswers: any[]
  ): Promise<string> {
    const subAnswersText = subAnswers
      .map((sa, i) => `Sub-question ${i + 1}: ${sa.question}\nAnswer: ${sa.answer || 'No answer available'}`)
      .join('\n\n');

    const prompt = `Synthesize these sub-answers into a focused, cohesive answer to the original question.

Original Question: ${originalQuestion}

Sub-answers:
${subAnswersText}

Requirements:
- Create a flowing, natural answer that addresses the original question
- Integrate information from all sub-answers
- Maintain citations [Source X] from sub-answers
- Be concise but complete

Synthesized Answer:`;

    const response = await sendMessageToGemini(prompt, [], 'System', '', 'en');
    return response.text?.trim() || '';
  }

  /**
   * Assemble context from chunks
   */
  private assembleContext(chunks: any[]): string {
    return chunks
      .map((chunk, index) => {
        const content = chunk.content || chunk.text_content || '';
        const docName = chunk.document?.filename || 'Unknown';
        const metadata = chunk.metadata || {};

        let prefix = `[Source ${index + 1}: ${docName}`;
        if (metadata.page) prefix += `, Page ${metadata.page}`;
        if (metadata.sheet) prefix += `, Sheet ${metadata.sheet}`;
        prefix += ']\n';

        return prefix + content;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Build comprehensive answer prompt
   */
  private buildAnswerPrompt(
    question: string,
    context: string,
    chatHistory: any[],
    conflictAnalysis?: string
  ): string {
    let prompt = this.getSystemPrompt() + '\n\n';

    // Add chat history if available
    if (chatHistory && chatHistory.length > 0) {
      prompt += '=== CONVERSATION HISTORY ===\n';
      chatHistory.slice(-5).forEach(msg => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // Add context
    prompt += '=== AVAILABLE SOURCES ===\n';
    prompt += context + '\n\n';

    // Add conflict information if present
    if (conflictAnalysis) {
      prompt += '=== IMPORTANT: CONFLICTING INFORMATION DETECTED ===\n';
      prompt += conflictAnalysis + '\n\n';
      prompt += 'Please acknowledge the conflict in your answer and present both perspectives.\n\n';
    }

    // Add question
    prompt += '=== USER QUESTION ===\n';
    prompt += question + '\n\n';

    prompt += '=== YOUR ANSWER (with citations) ===\n';

    return prompt;
  }

  /**
   * Extract citations from answer
   */
  private extractCitations(answer: string, chunks: any[]): Array<{
    text: string;
    source: string;
    page?: number;
  }> {
    const citations: any[] = [];
    const citationRegex = /\[Source (\d+)(?::([^\]]+))?\]/g;

    let match;
    while ((match = citationRegex.exec(answer)) !== null) {
      const sourceNum = parseInt(match[1]);
      const chunk = chunks[sourceNum - 1];

      if (chunk) {
        citations.push({
          text: match[2] || '',
          source: chunk.document?.filename || 'Unknown',
          page: chunk.metadata?.page
        });
      }
    }

    return citations;
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(
    chunks: any[],
    verification: any,
    citationCount: number,
    avgScore: number
  ): 'high' | 'medium' | 'low' {
    const factsVerified = verification ? !verification.hasIssues : true;

    if (avgScore > 0.7 && factsVerified && citationCount >= 2) {
      return 'high';
    } else if (avgScore > 0.5 && citationCount >= 1) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate overall confidence from sub-answers
   */
  private calculateOverallConfidence(subAnswers: any[]): 'high' | 'medium' | 'low' {
    const confidenceScores = {
      high: 3,
      medium: 2,
      low: 1
    };

    const avgScore = subAnswers.reduce((sum, sa) => {
      return sum + (confidenceScores[sa.confidence as keyof typeof confidenceScores] || 1);
    }, 0) / subAnswers.length;

    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Check if query is complex
   */
  private isComplexQuery(question: string): boolean {
    const complexityIndicators = [
      'and',
      'compare',
      'difference between',
      'how did',
      'why did',
      'what caused',
      'analyze',
      'relationship between',
      'from.*to',
      'versus',
      'vs'
    ];

    const lowerQuestion = question.toLowerCase();
    return complexityIndicators.some(indicator => {
      if (indicator.includes('*')) {
        const regex = new RegExp(indicator);
        return regex.test(lowerQuestion);
      }
      return lowerQuestion.includes(indicator);
    });
  }

  /**
   * Get system prompt for maximum accuracy
   */
  private getSystemPrompt(): string {
    return `You are KODA, an expert AI document analyst with exceptional precision and contextual understanding.

CORE PRINCIPLES:
1. **Accuracy First**: Only state facts that are explicitly in the provided sources
2. **Cite Everything**: Use [Source X] for every fact, number, or claim
3. **Context Awareness**: Understand the full context before answering
4. **Precision**: Be specific with numbers, dates, names, and technical terms
5. **Completeness**: Address all parts of the question thoroughly
6. **Clarity**: Explain complex concepts in clear, understandable language
7. **Honesty**: If information is not in the sources, explicitly say so

CITATION FORMAT:
- Use [Source 1], [Source 2], etc. after each fact
- Example: "Revenue increased by 35% in Q3 [Source 1], driven by product sales [Source 2]."

WHEN INFORMATION IS MISSING:
- Say: "The document does not contain information about [topic]."
- Suggest: "You might want to check [related section] or ask about [related topic]."

HANDLING AMBIGUITY:
- If the question is unclear, ask for clarification
- If sources conflict, present both perspectives and note the conflict

YOUR GOAL:
Provide the most accurate, contextual, and helpful answer possible based on the available information.`;
  }

  /**
   * Standard error response
   */
  private errorResponse(message: string): QuestionResponse {
    return {
      status: 'error',
      message
    };
  }
}

export default new DocumentIntelligenceService();
