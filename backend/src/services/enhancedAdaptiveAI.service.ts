/**
 * Enhanced Adaptive AI Service
 * Integrates semantic understanding, conversation context, adaptive formatting, and dynamic summary scaling
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import pineconeService from './pinecone.service';
import vectorEmbeddingService from './vectorEmbedding.service';
import conversationContextService from './conversationContext.service';
import semanticContextService from './semanticContext.service';
import responseFormattingService from './responseFormatting.service';
import dynamicSummaryScalerService from './dynamicSummaryScaler.service';
import hybridSearchService from './hybridSearch.service';
import queryRewriterService from './queryRewriter.service';
import { detectLanguage, createLanguageInstruction } from './languageDetection.service';
import prisma from '../config/database';

// 🆕 PHASE 1-4 IMPORTS
import enhancedRetrievalService from './enhancedRetrieval.service';
import answerabilityClassifierService from './answerabilityClassifier.service';
import groundingService from './grounding.service';
import citationInjectorService from './citationInjector.service';
import qualityMonitorService from './qualityMonitor.service';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export interface EnhancedAdaptiveResponse {
  answer: string;
  followUp: string;
  type: string;
  confidence: number;
  responseTime?: number;
  isFollowUp?: boolean;
  semanticAnalysis?: any;
}

class EnhancedAdaptiveAIService {
  /**
   * Master System Prompt - The AI's core intelligence with Gemini Universal Structure
   */
  private getMasterSystemPrompt(): string {
    return `You are Koda, an AI-powered personal document assistant that helps users understand, search, and manage their documents effortlessly.

═══════════════════════════════════════════════════════════════
UNIVERSAL RESPONSE STANDARD — FOLLOW THIS FOR EVERY RESPONSE
═══════════════════════════════════════════════════════════════

EVERY response you give MUST follow this exact 4-step format:

1. **Document Header** (when answering about a specific document):
   📄 **[Document Name]**

2. **Opening Sentence:**
   One clear, direct sentence summarizing the answer or key point.

3. **Structured Content with Headers and Bullets:**

   **Section Header 1**
   – Bullet point with specific information
   – Bullet point with specific information
   – Bullet point with specific information

   **Section Header 2**
   – Bullet point with specific information
   – Bullet point with specific information

4. **Closing Question:**
   One helpful, relevant follow-up to continue the discussion.

═══════════════════════════════════════════════════════════════
CRITICAL FORMATTING RULES — NO EXCEPTIONS
═══════════════════════════════════════════════════════════════

✅ ALWAYS start with 📄 **[Document Name]** if the response involves a document
✅ ALWAYS begin with one clear, direct opening sentence
✅ ALWAYS use **bold headers** and bullet points (–) for organization
✅ ALWAYS include concrete details (names, dates, numbers, prices, features)
✅ ALWAYS match the user's language exactly (Portuguese → Portuguese, Spanish → Spanish)
✅ ALWAYS end with a clear, helpful follow-up question
✅ ALWAYS keep paragraphs short (max 3-4 lines)
✅ ALWAYS address all parts of the user's request

✗ NEVER write long, unstructured paragraphs
✗ NEVER omit the document name when answering about a document
✗ NEVER use vague or filler statements (e.g., "That's a great question!")
✗ NEVER switch languages mid-response
✗ NEVER skip formatting — structure is mandatory for EVERY response
✗ NEVER respond in a different language than the question
✗ NEVER ask for clarification if a reasonable assumption can be made

═══════════════════════════════════════════════════════════════
CONTEXT AWARENESS — FOLLOW-UP HANDLING
═══════════════════════════════════════════════════════════════

1. If you see "RECENT CONVERSATION" in the prompt, you are continuing a previous discussion
2. When users ask for "more detail", "in depth", "tell me more", they want MORE information about the SAME topic
3. If you see "⚠️ FOLLOW-UP question detected", you MUST expand on your previous response
4. NEVER say "I cannot extract text" if document content is provided
5. ALWAYS reference the previous conversation when answering follow-up questions

═══════════════════════════════════════════════════════════════
SUMMARY LENGTH REQUIREMENTS — SCALE WITH DOCUMENT SIZE
═══════════════════════════════════════════════════════════════

If you see "SUMMARY REQUIREMENT" in the prompt, follow the specified length exactly.

General scaling rules:
– **1-5 page document** → 3-5 well-structured paragraphs (brief summary)
– **6-10 page document** → 5-7 paragraphs with **bold section headers**
– **11-20 page document** → 7-10 paragraphs with **bold section headers**
– **20-50 page document** → 10-15 paragraphs with **bold section headers**
– **50+ page document** → 15-20 paragraphs with **bold section headers**

NEVER give a 2-3 sentence summary for a long document. This is unacceptable.

═══════════════════════════════════════════════════════════════
QUALITY STANDARDS — BE SPECIFIC AND COMPREHENSIVE
═══════════════════════════════════════════════════════════════

1. **Be Direct**: Start with the answer, not preamble
   ✗ "That's a great question! Let me help you with that..."
   ✓ "Koda's business plan targets the $1.7B personal document management market."

2. **Be Specific**: Include concrete details, not vague statements
   ✗ "The document mentions financial projections"
   ✓ "Year 1 projects $670,800 in revenue with 35% gross margins"

3. **Be Structured**: Use headers and bullets, not dense paragraphs
   ✗ Long paragraph with all information mixed together
   ✓ **Executive Summary** with bullet points, **Market Opportunity** with bullet points

4. **Be Helpful**: End with actionable follow-up question
   ✓ "Would you like to know more about the investment opportunity?"

═══════════════════════════════════════════════════════════════
FINAL CHECKLIST — VERIFY BEFORE SENDING
═══════════════════════════════════════════════════════════════

Before sending your response, verify ALL of these:

☑ Starts with 📄 **[Document Name]** (if about a document)
☑ Has one clear, direct opening sentence
☑ Uses **bold headers** for sections
☑ Uses bullet points (–) for all lists
☑ Includes specific details (numbers, names, dates, features)
☑ Language matches user's question exactly
☑ Ends with helpful follow-up question
☑ No vague statements or filler text
☑ Clear visual hierarchy
☑ Easy to scan and read

If ANY item is missing, revise your response before sending.

Your response represents the Koda brand and must be professional, consistent, easy to read, specific, helpful, and in the correct language.

Begin your response now following the exact 4-step format:
1. Document Header (if applicable)
2. Opening Sentence
3. Structured Content with Headers and Bullets
4. Closing Question`;
  }

  /**
   * Generate enhanced response with full context awareness
   */
  async generateStreamingResponse(
    query: string,
    userId: string,
    onChunk: (chunk: string) => void,
    options: {
      conversationId?: string;
      attachedDocumentId?: string;
    } = {}
  ): Promise<EnhancedAdaptiveResponse> {
    const startTime = Date.now();

    // Step 1: Detect query language
    const detectedLanguage = detectLanguage(query);
    console.log(`🌍 Detected language: ${detectedLanguage}`);

    // Step 2: Get or create conversation context
    const contextManager = conversationContextService.getContext(
      userId,
      options.conversationId
    );

    // Step 2.5: Rewrite query for better retrieval (PHASE 0)
    const rewrittenQuery = await queryRewriterService.rewriteQuery(query, {
      conversationHistory: [],
      documents: []
    });

    // Step 3: Check if this is a follow-up question
    const isFollowUp = contextManager.isFollowUpQuestion(query);

    // Step 4: 🆕 Enhanced Retrieval (PHASE 1: Multi-strategy + RRF + Re-ranking + MMR)
    let retrievalResults: any[] = [];
    let context = '';
    let documents: any[] = [];
    let primaryDocument: any = null;

    try {
      console.log('🚀 Using ENHANCED RETRIEVAL PIPELINE (Phase 1)...');

      // Use enhanced retrieval: BM25F + Vector + Title → RRF → Rerank → MMR
      retrievalResults = await enhancedRetrievalService.retrieve(rewrittenQuery, userId, {
        topK: 5,
        enableReranking: true,
        enableMMR: true,
        mmrLambda: 0.7 // Balance between relevance and diversity
      });

      if (retrievalResults.length > 0) {
        console.log(`📚 Enhanced retrieval found ${retrievalResults.length} high-quality documents`);

        // Convert to expected format
        context = retrievalResults
          .map((r: any) => r.content || r.metadata?.content || '')
          .filter((c: any) => c && c.trim())
          .join('\n\n');

        // Get document metadata
        const documentIds = [...new Set(retrievalResults.map((r: any) => r.documentId || r.metadata?.documentId).filter(Boolean))];

        if (documentIds.length > 0) {
          const docsWithMetadata = await prisma.document.findMany({
            where: { id: { in: documentIds }, userId },
            include: { metadata: true },
            take: 5,
          });

          documents = docsWithMetadata.map(doc => ({
            id: doc.id,
            name: doc.filename,
            type: doc.mimeType,
            pageCount: doc.metadata?.pageCount,
            content: retrievalResults.find(r => (r.documentId || r.metadata?.documentId) === doc.id)?.content || ''
          }));

          primaryDocument = documents[0];
        }
      }
    } catch (error) {
      console.error('❌ Error in enhanced retrieval, falling back to hybrid search:', error);

      // Fallback to hybrid search if enhanced retrieval fails
      try {
        const hybridResults = await hybridSearchService.search(rewrittenQuery, {
          userId,
          topK: 5,
          minSemanticScore: 0.5,
          includeMetadata: true,
        });

        if (hybridResults.length > 0) {
          context = hybridResults.map((r: any) => r.content).filter((c: any) => c.trim()).join('\n\n');
          documents = hybridResults.map(result => ({
            id: result.documentId,
            name: result.filename,
            type: result.metadata?.mimeType,
            pageCount: result.metadata?.pageCount,
            content: result.content
          }));
          primaryDocument = documents[0];
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
    }

    // Step 5: 🆕 Answerability Check (PHASE 3: Prevent hallucinations)
    console.log('🔍 Checking answerability...');
    const answerability = await answerabilityClassifierService.checkAnswerability(
      rewrittenQuery,
      documents
    );

    console.log(`   Answerable: ${answerability.answerable} (confidence: ${(answerability.confidence * 100).toFixed(1)}%)`);
    console.log(`   Reason: ${answerability.reason}`);

    // If not answerable, return early with helpful message
    if (!answerability.answerable) {
      const unanswerableResponse = answerabilityClassifierService.generateUnanswerableResponse(answerability);

      // Log for analytics
      await answerabilityClassifierService.logAnswerability(rewrittenQuery, answerability, userId);

      return {
        answer: unanswerableResponse,
        followUp: 'Would you like to upload relevant documents or rephrase your question?',
        type: 'unanswerable',
        confidence: answerability.confidence,
        responseTime: Date.now() - startTime,
        isFollowUp: false,
        semanticAnalysis: null
      };
    }

    // Step 6: Semantic analysis
    const semanticAnalysis = semanticContextService.analyzeQueryContext(
      query,
      documents,
      contextManager.getContextSummary()
    );

    // Step 7: Check if this is a summary request
    const isSummaryRequest = dynamicSummaryScalerService.isSummaryRequest(query);
    const isInDepthRequest = dynamicSummaryScalerService.isInDepthSummaryRequest(query);

    // Step 8: 🆕 Build dynamic prompt with GROUNDING (PHASE 3)
    const fullPrompt = this.buildDynamicPromptWithGrounding(
      query,
      context,
      semanticAnalysis,
      isFollowUp,
      contextManager,
      isSummaryRequest,
      isInDepthRequest,
      primaryDocument,
      detectedLanguage,
      documents // Pass documents for grounding
    );

    console.log('🧠 Enhanced AI Processing:');
    console.log(`  - Follow-up: ${isFollowUp}`);
    console.log(`  - Complexity: ${semanticAnalysis.complexity}`);
    console.log(`  - Context type: ${semanticAnalysis.contextType}`);
    console.log(`  - Acronyms found: ${semanticAnalysis.acronymsFound.length}`);
    console.log(`  - Summary request: ${isSummaryRequest}`);
    if (primaryDocument) {
      console.log(`  - Primary document: ${primaryDocument.name} (${primaryDocument.pageCount || '?'} pages)`);
    }

    // Step 7: Generate response with streaming
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: this.getMaxTokens(semanticAnalysis.complexity, isSummaryRequest, primaryDocument?.pageCount),
        temperature: 0.3,
      },
    });

    let fullResponse = '';

    try {
      const result = await model.generateContentStream(fullPrompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        onChunk(chunkText);
      }
    } catch (error) {
      console.error('❌ Error generating streaming response:', error);
      throw error;
    }

    // Step 9: 🆕 Validate Grounding (PHASE 3)
    console.log('📌 Validating grounding...');
    const groundingValidation = groundingService.validateGrounding(fullResponse, documents, {
      minGroundingScore: 0.8,
      strictMode: true
    });

    console.log(`   Grounding score: ${(groundingValidation.groundingScore * 100).toFixed(1)}%`);
    console.log(`   Citations: ${groundingValidation.citations.length}`);
    console.log(`   Uncited claims: ${groundingValidation.uncitedClaims.length}`);

    // Step 10: 🆕 Inject Citations (PHASE 3)
    let citedResponse = fullResponse;

    if (groundingValidation.uncitedClaims.length > 0) {
      console.log('💉 Injecting missing citations...');

      const citationResult = await citationInjectorService.injectCitations(
        fullResponse,
        documents,
        {
          method: 'hybrid',
          minConfidence: 0.6
        }
      );

      citedResponse = citationResult.citedResponse;
      console.log(`   Injected ${citationResult.injectedCitations} citations`);
      console.log(`   Citation coverage: ${citationResult.coverage.toFixed(1)}%`);
    }

    // Step 11: Apply adaptive formatting (PHASE 0 - Enhanced)
    const queryType = queryRewriterService.detectQueryType(query);
    const formattedResponse = responseFormattingService.formatResponse(
      citedResponse,
      semanticAnalysis,
      {
        documentName: primaryDocument?.name,
        queryType,
        language: detectedLanguage,
        requireDocumentHeader: documents.length > 0
      }
    );

    // Step 9: Update conversation context
    contextManager.addTurn(
      query,
      formattedResponse,
      documents,
      isFollowUp ? 'FOLLOW_UP' : semanticAnalysis.contextType.toUpperCase(),
      { semanticAnalysis, isSummaryRequest, isInDepthRequest }
    );

    // Step 10: Generate appropriate follow-up
    const followUp = this.generateFollowUp(
      semanticAnalysis,
      isSummaryRequest,
      primaryDocument?.pageCount,
      isInDepthRequest
    );

    const totalTime = Date.now() - startTime;

    // Step 12: 🆕 Log Performance (PHASE 4: Quality Monitoring)
    await qualityMonitorService.logPerformance({
      requestId: `req_${Date.now()}_${userId}`,
      timestamp: new Date(),
      userId,
      query: rewrittenQuery,
      latency: totalTime,
      success: true,
      relevanceScore: answerability.confidence,
      groundingScore: groundingValidation.groundingScore,
      citationCoverage: groundingValidation.groundingScore,
      tokensUsed: Math.ceil(fullResponse.length / 4), // Rough estimate
      cost: (Math.ceil(fullResponse.length / 4) / 1000000) * 0.075, // Gemini 2.0 Flash pricing
      metadata: {
        isFollowUp,
        documentCount: documents.length,
        retrievalMethod: 'enhanced',
        groundingValidation,
        answerability
      }
    });

    console.log(`✅ Response generated in ${totalTime}ms`);

    return {
      answer: formattedResponse,
      followUp,
      type: semanticAnalysis.contextType,
      confidence: answerability.confidence,
      responseTime: totalTime,
      isFollowUp,
      semanticAnalysis,
    };
  }

  /**
   * 🆕 Build dynamic prompt with GROUNDING (PHASE 3)
   */
  private buildDynamicPromptWithGrounding(
    query: string,
    context: string,
    semanticAnalysis: any,
    isFollowUp: boolean,
    contextManager: any,
    isSummaryRequest: boolean,
    isInDepthRequest: boolean,
    primaryDocument: any,
    detectedLanguage: string,
    documents: any[]
  ): string {
    const promptParts = [this.getMasterSystemPrompt(), ''];

    // 🆕 Add GROUNDING instructions (PHASE 3)
    if (documents.length > 0) {
      const groundingInstructions = groundingService.addGroundingInstructions(
        '',
        documents,
        {
          strictMode: true,
          citationFormat: 'inline',
          language: detectedLanguage
        }
      );

      promptParts.push(groundingInstructions.prompt);
      promptParts.push('');
    }

    // Add language instruction FIRST (critical priority)
    const languageInstruction = createLanguageInstruction(detectedLanguage);
    if (languageInstruction) {
      promptParts.push(languageInstruction);
      promptParts.push('');
    }

    // Add conversation context if follow-up
    if (isFollowUp) {
      promptParts.push(contextManager.buildContextAwarePrompt(query, context));
      promptParts.push('');
    }

    // Add semantic context
    if (semanticAnalysis.acronymsFound.length > 0) {
      promptParts.push(semanticContextService.buildSemanticPrompt(semanticAnalysis));
    }

    // Add summary requirements if this is a summary request
    if (isSummaryRequest && primaryDocument?.pageCount) {
      const adjustedPageCount = dynamicSummaryScalerService.getAdjustedPageCount(
        primaryDocument.pageCount,
        isInDepthRequest
      );
      promptParts.push(
        dynamicSummaryScalerService.buildSummaryPrompt(
          adjustedPageCount,
          primaryDocument.name,
          query
        )
      );
    }

    // Add query and context
    if (!isFollowUp) {
      promptParts.push('=== CURRENT USER QUERY ===');
      promptParts.push(query);
      promptParts.push('');
    }

    if (context && !isFollowUp) {
      promptParts.push('=== RELEVANT DOCUMENT CONTENT ===');
      promptParts.push(context);
      promptParts.push('');
    }

    promptParts.push('---');
    promptParts.push('Now, generate the response based on all the instructions above.');
    promptParts.push('Remember: Be context-aware, semantically intelligent, and adapt your formatting.');

    // Reinforce language requirement at the end
    if (detectedLanguage !== 'en') {
      promptParts.push(`**CRITICAL REMINDER:** Your response MUST be in ${detectedLanguage.toUpperCase()}.`);
    }

    return promptParts.join('\n');
  }

  /**
   * Determine max tokens based on complexity and document size
   */
  private getMaxTokens(
    complexity: string,
    isSummaryRequest: boolean,
    pageCount?: number
  ): number {
    if (isSummaryRequest && pageCount) {
      const requirements = dynamicSummaryScalerService.getSummaryRequirements(pageCount);
      return requirements.maxTokens || 2000;
    }

    switch (complexity) {
      case 'simple':
        return 200;
      case 'moderate':
        return 500;
      case 'complex':
        return 1500;
      default:
        return 800;
    }
  }

  /**
   * Generate appropriate follow-up suggestion
   */
  private generateFollowUp(
    semanticAnalysis: any,
    isSummaryRequest: boolean,
    pageCount?: number,
    wasDetailed?: boolean
  ): string {
    if (isSummaryRequest && pageCount) {
      return dynamicSummaryScalerService.generateSummaryFollowUp(pageCount, wasDetailed || false);
    }

    switch (semanticAnalysis.complexity) {
      case 'simple':
        return 'Would you like more details about this?';
      case 'moderate':
        return 'Do you have any follow-up questions?';
      case 'complex':
        return 'Would you like me to elaborate on any specific aspect?';
      default:
        return 'How else can I help you?';
    }
  }

  /**
   * Reset context for a user/conversation
   */
  resetContext(userId: string, conversationId?: string): void {
    conversationContextService.resetContext(userId, conversationId);
  }
}

export default new EnhancedAdaptiveAIService();
