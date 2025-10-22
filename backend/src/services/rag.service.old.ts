import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import vectorEmbeddingService from './vectorEmbedding.service';
import terminologyService from './terminology.service';
import webSearchService from './webSearch.service';
import researchPipelineService, { ActionableRecommendations } from './researchPipeline.service';
import cacheService from './cache.service';
import responseCacheService from './responseCache.service';
import factVerificationService, { VerificationResult } from './factVerification.service';
import { detectLanguage, createLanguageInstruction } from './languageDetection.service';
// 🆕 PHASE 1-4 IMPORTS
import enhancedRetrievalService from './enhancedRetrieval.service';
import answerabilityClassifierService from './answerabilityClassifier.service';
import groundingService from './grounding.service';
import citationInjectorService from './citationInjector.service';
import qualityMonitorService from './qualityMonitor.service';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: any;
  deepLink?: string;
}

interface WebSource {
  url: string;
  title: string;
  snippet: string;
  content?: string;
}

interface PersonaProfile {
  persona: string;
  confidence: number;
  detectedKeywords: string[];
  suggestedResearchTopics: string[];
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  webSources?: WebSource[];
  expandedQuery?: string[];
  contextId: string;
  confidence?: string; // high/medium/low
  confidenceScore?: number; // 0-1
  isMultiStep?: boolean; // True if multi-step reasoning was used
  subQuestions?: string[]; // Sub-questions for complex queries
  persona?: PersonaProfile; // Detected user persona
  verification?: VerificationResult; // Fact verification results
  recommendations?: ActionableRecommendations; // Actionable next steps and suggestions
}

/**
 * RAG (Retrieval Augmented Generation) Service
 * Combines vector search, terminology expansion, and Gemini AI
 */
class RAGService {
  /**
   * Generate an answer using RAG
   * @param userId - User ID
   * @param query - User's question
   * @param conversationId - Conversation ID
   * @param researchMode - Enable web search integration
   * @returns RAG response with answer and sources
   */
  async generateAnswer(
    userId: string,
    query: string,
    conversationId: string,
    researchMode: boolean = false
  ): Promise<RAGResponse> {
    try {
      console.log(`🔍 Starting RAG query: "${query}" (Research Mode: ${researchMode})`);

      // 📂 SPECIAL HANDLER: File listing queries (e.g., "what excel did i upload")
      // These queries want to know WHICH files exist, not their CONTENT
      const fileListingPattern = /what.*(excel|spreadsheet|xlsx|pdf|docx|pptx|document|file)s?.*(upload|did i|have i|got)/i;
      if (fileListingPattern.test(query)) {
        console.log('📂 Detected file listing query - querying database for filenames');

        // Detect file type from query
        let mimeTypeFilter: string | undefined;
        if (/excel|spreadsheet|xlsx/i.test(query)) {
          mimeTypeFilter = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (/pdf/i.test(query)) {
          mimeTypeFilter = 'application/pdf';
        } else if (/docx|word/i.test(query)) {
          mimeTypeFilter = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (/pptx|powerpoint|presentation/i.test(query)) {
          mimeTypeFilter = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        }

        // Query database for files
        const docs = await prisma.document.findMany({
          where: {
            userId,
            ...(mimeTypeFilter && { mimeType: mimeTypeFilter }),
            status: 'completed' // Only show successfully processed files
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            filename: true,
            createdAt: true,
            fileSize: true,
            mimeType: true
          }
        });

        console.log(`📂 Found ${docs.length} file(s) matching query`);

        // Format response based on file type
        const fileType = mimeTypeFilter
          ? (mimeTypeFilter.includes('sheet') ? 'Excel' :
             mimeTypeFilter.includes('pdf') ? 'PDF' :
             mimeTypeFilter.includes('wordprocessing') ? 'Word' : 'PowerPoint')
          : 'document';

        let answer: string;
        if (docs.length === 0) {
          answer = `You haven't uploaded any ${fileType} files yet.`;
        } else {
          const fileList = docs.map((doc, i) => {
            const date = new Date(doc.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const sizeMB = doc.fileSize ? (doc.fileSize / (1024 * 1024)).toFixed(2) : 'unknown';
            return `${i + 1}. **${doc.filename}** (${date}, ${sizeMB} MB)`;
          }).join('\n');

          answer = `You have uploaded **${docs.length}** ${fileType} file(s):\n\n${fileList}\n\nYou can ask me questions about the content of any of these files!`;
        }

        // Convert to RAG sources format
        const sources: RAGSource[] = docs.map(doc => ({
          documentId: doc.id,
          documentName: doc.filename,
          chunkIndex: 0,
          content: `File: ${doc.filename}`,
          similarity: 1.0,
          metadata: { createdAt: doc.createdAt, fileSize: doc.fileSize },
          deepLink: `/documents/${doc.id}`
        }));

        return {
          answer,
          sources,
          contextId: `file-listing-${Date.now()}`,
          confidence: 'high',
          confidenceScore: 1.0
        };
      }

      // If research mode is enabled, use the intelligent research pipeline
      if (researchMode) {
        console.log('🔬 Using intelligent research pipeline for document + web knowledge combination');

        const researchResult = await researchPipelineService.executeResearch(
          query,
          userId,
          conversationId,
          true // explicitly requested
        );

        // Convert research pipeline results to RAG format
        const sources: RAGSource[] = researchResult.sources.documents.map(doc => ({
          documentId: doc.documentId,
          documentName: doc.filename,
          chunkIndex: 0, // Research pipeline doesn't track chunk index
          content: doc.excerpt,
          similarity: doc.relevance,
          metadata: {},
          deepLink: `/documents/${doc.documentId}`
        }));

        const webSources: WebSource[] = researchResult.sources.web.map(web => ({
          url: web.url,
          title: web.title,
          snippet: web.snippet,
          content: web.content
        }));

        // ⚠️ DISABLED: Fact verification (was causing 15+ second delays due to Anthropic API errors)
        // const allSources = [
        //   ...researchResult.sources.documents.map(doc => ({
        //     content: doc.excerpt,
        //     documentName: doc.filename
        //   })),
        //   ...researchResult.sources.web.map(web => ({
        //     content: web.content || web.snippet,
        //     documentName: `${web.title} (${web.url})`
        //   }))
        // ];
        // const verification = await factVerificationService.verifyAnswer(researchResult.answer, allSources);
        // console.log(`✅ Fact verification: ${(verification.verificationScore * 100).toFixed(0)}% verified (${verification.overallVerdict})`);
        const verification = undefined; // Verification disabled for performance

        // Store context in database
        const chatContext = await prisma.chatContext.create({
          data: {
            conversationId,
            sourceDocuments: JSON.stringify(sources.map(s => ({
              documentId: s.documentId,
              chunkIndexes: [s.chunkIndex],
              relevanceScore: s.similarity,
              citation: s.documentName
            }))),
            webSources: JSON.stringify(webSources),
            searchQuery: query,
            expandedTerms: JSON.stringify([])
          }
        });

        console.log(`✅ Research pipeline completed with ${sources.length} document sources and ${webSources.length} web sources`);

        return {
          answer: researchResult.answer,
          sources,
          webSources,
          expandedQuery: [],
          contextId: chatContext.id,
          persona: researchResult.persona,
          verification,
          recommendations: researchResult.recommendations
        };
      }

      // Standard RAG flow (without research mode)
      // Step 1: Check if complex query needs decomposition
      if (this.isComplexQuery(query)) {
        console.log('🔍 Complex query detected, decomposing...');
        const subQuestions = await this.decomposeQuery(query);

        // Answer each sub-question
        const subAnswers: any[] = [];
        for (const subQ of subQuestions) {
          const subResult = await this.answerSimpleQuery(userId, subQ, conversationId);
          subAnswers.push({ question: subQ, ...subResult });
        }

        // Synthesize final answer
        const synthesisPrompt = `Based on these sub-answers, provide a comprehensive answer to the original question.

Original Question: ${query}

Sub-Answers:
${subAnswers.map((sa, idx) => `${idx + 1}. Q: ${sa.question}\nA: ${sa.answer}`).join('\n\n')}

Synthesized Answer (combine insights from all sub-answers):`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const result = await model.generateContent(synthesisPrompt);
        const synthesizedAnswer = result.response.text();

        // Combine all sources
        const allSources = subAnswers.flatMap(sa => sa.sources || []);
        const uniqueSources = Array.from(
          new Map(allSources.map(s => [`${s.documentId}-${s.chunkIndex}`, s])).values()
        );

        // ⚠️ DISABLED: Fact verification (was causing 15+ second delays due to Anthropic API errors)
        // const verificationSources = uniqueSources.map(s => ({
        //   content: s.content,
        //   documentName: s.documentName
        // }));
        // const verification = await factVerificationService.verifyAnswer(synthesizedAnswer, verificationSources);
        // console.log(`✅ Multi-step fact verification: ${(verification.verificationScore * 100).toFixed(0)}% verified (${verification.overallVerdict})`);
        const verification = undefined; // Verification disabled for performance

        // Calculate confidence for combined answer
        const confidence = this.calculateConfidence(
          allSources,
          uniqueSources.length
        );

        // Store context
        const chatContext = await prisma.chatContext.create({
          data: {
            conversationId,
            sourceDocuments: JSON.stringify(uniqueSources.map(s => ({
              documentId: s.documentId,
              chunkIndexes: [s.chunkIndex],
              relevanceScore: s.similarity,
              citation: s.documentName
            }))),
            webSources: null,
            searchQuery: query,
            expandedTerms: JSON.stringify([])
          }
        });

        console.log(`✅ Multi-step answer generated with ${uniqueSources.length} unique sources`);

        return {
          answer: synthesizedAnswer,
          sources: uniqueSources,
          webSources: undefined,
          expandedQuery: [],
          contextId: chatContext.id,
          confidence: confidence.level,
          confidenceScore: confidence.score,
          isMultiStep: true,
          subQuestions: subQuestions,
          verification
        };
      }

      // Simple query - use enhanced RAG with query expansion and reranking
      return await this.answerSimpleQuery(userId, query, conversationId);
    } catch (error) {
      console.error('Error in RAG generation:', error);
      throw error;
    }
  }

  /**
   * Answer a simple (non-complex) query with enhanced RAG
   */
  private async answerSimpleQuery(
    userId: string,
    query: string,
    conversationId: string
  ): Promise<RAGResponse> {
    const startTime = Date.now(); // Track performance
    try {
      // Step 0: Check response cache first for instant results
      const cachedResponse = await responseCacheService.getCachedResponse(query);
      if (cachedResponse) {
        console.log('✅ [Response Cache] Using cached answer - INSTANT RESPONSE!');

        // Still need to return sources, so do a lightweight search
        const quickChunks = await vectorEmbeddingService.searchSimilarChunks(
          userId,
          query,
          3,
          0.6
        );

        const sources: RAGSource[] = quickChunks.map(result => ({
          documentId: result.documentId,
          documentName: result.document.filename,
          chunkIndex: result.chunkIndex,
          content: result.content.substring(0, 200) + '...',
          similarity: result.similarity,
          metadata: result.metadata,
          deepLink: this.generateDeepLink(result)
        }));

        const chatContext = await prisma.chatContext.create({
          data: {
            conversationId,
            sourceDocuments: JSON.stringify(sources.map(s => ({
              documentId: s.documentId,
              chunkIndexes: [s.chunkIndex],
              relevanceScore: s.similarity,
              citation: s.documentName
            }))),
            webSources: null,
            searchQuery: query,
            expandedTerms: JSON.stringify([])
          }
        });

        return {
          answer: cachedResponse,
          sources,
          webSources: undefined,
          expandedQuery: [],
          contextId: chatContext.id,
          confidence: 'high',
          confidenceScore: 0.9,
        };
      }

      // Step 1: Extract document names from query (e.g., "koda business plan", "Q4 report")
      const mentionedDocuments = await this.extractDocumentNames(userId, query);
      if (mentionedDocuments.length > 0) {
        console.log(`📋 Detected document references: ${mentionedDocuments.map(d => d.filename).join(', ')}`);
      }

      // 🆕 STEP 2: Enhanced Retrieval (PHASE 1)
      console.log('🚀 Using ENHANCED RETRIEVAL PIPELINE (Phase 1)...');

      let rerankedChunks: any[] = [];
      try {
        // Use enhanced retrieval: BM25F + Vector + Title → RRF → Rerank → MMR
        const retrievalResults = await enhancedRetrievalService.retrieve(query, userId, {
          topK: 10, // Increased for better coverage
          enableReranking: true,
          enableMMR: true
        });

        console.log(`📚 Enhanced retrieval found ${retrievalResults.length} high-quality documents`);

        // Convert retrieval results to chunk format expected by rest of the code
        rerankedChunks = await Promise.all(retrievalResults.map(async (result: any) => {
          // Get document info
          const doc = await prisma.document.findUnique({
            where: { id: result.documentId },
            select: { filename: true, mimeType: true }
          });

          return {
            documentId: result.documentId,
            chunkIndex: result.chunkIndex || 0,
            content: result.content || result.metadata?.content || '',
            similarity: result.score,
            document: {
              filename: doc?.filename || 'Unknown Document'
            },
            metadata: result.metadata || {}
          };
        }));

        console.log(`✅ Enhanced retrieval pipeline completed with ${rerankedChunks.length} chunks`);

      } catch (error) {
        console.error('❌ Error in enhanced retrieval, falling back to vector search:', error);

        // Fallback to basic vector search if enhanced retrieval fails
        const isFullDocumentQuery = /\b(give me|show me|get|retrieve|all|entire|full|complete)\s+(the\s+)?(document|file|excel|spreadsheet|data)\b/i.test(query);
        const topK = isFullDocumentQuery ? 15 : 8;

        const chunks = await vectorEmbeddingService.searchSimilarChunks(
          userId,
          query,
          topK,
          0.5
        );

        rerankedChunks = chunks;
        console.log(`📄 Fallback: Using ${rerankedChunks.length} chunks from vector search`);
      }

      // 🆕 STEP 3: Answerability Check (PHASE 3)
      console.log('🔍 Checking answerability...');
      const documents = rerankedChunks.map(chunk => ({
        id: chunk.documentId,
        name: chunk.document.filename,
        content: chunk.content
      }));

      const answerability = await answerabilityClassifierService.checkAnswerability(
        query,
        documents
      );

      console.log(`   Answerable: ${answerability.answerable} (confidence: ${(answerability.confidence * 100).toFixed(1)}%)`);
      console.log(`   Reason: ${answerability.reason}`);

      // If not answerable, return early with helpful message
      if (!answerability.answerable) {
        const unanswerableResponse = answerabilityClassifierService.generateUnanswerableResponse(answerability);

        // Log for analytics
        await answerabilityClassifierService.logAnswerability(query, answerability, userId);

        // Store minimal context
        const chatContext = await prisma.chatContext.create({
          data: {
            conversationId,
            sourceDocuments: JSON.stringify([]),
            webSources: null,
            searchQuery: query,
            expandedTerms: JSON.stringify([])
          }
        });

        return {
          answer: unanswerableResponse,
          sources: [],
          webSources: undefined,
          expandedQuery: [],
          contextId: chatContext.id,
          confidence: 'low',
          confidenceScore: answerability.confidence,
        };
      }

      // Step 5: Build context from sources (no web results in standard mode)
      const context = this.buildContext(rerankedChunks, []);

      // Log the exact context being sent to Gemini
      console.log('\n' + '='.repeat(80));
      console.log('📤 CONTEXT SENT TO GEMINI:');
      console.log('='.repeat(80));
      console.log(context);
      console.log('='.repeat(80) + '\n');

      // Step 6: Generate answer with Gemini
      let answer = await this.generateWithGemini(query, context, rerankedChunks, []);

      // Step 7: Create deep links for sources (needed for validation)
      const sources: RAGSource[] = rerankedChunks.map(result => ({
        documentId: result.documentId,
        documentName: result.document.filename,
        chunkIndex: result.chunkIndex,
        content: result.content.substring(0, 200) + '...',
        similarity: result.similarity,
        metadata: result.metadata,
        deepLink: this.generateDeepLink(result)
      }));

      // 🆕 STEP 8: Grounding Validation (PHASE 3)
      console.log('📌 Validating grounding...');
      const documentsForValidation = rerankedChunks.map(chunk => ({
        id: chunk.documentId,
        name: chunk.document.filename,
        content: chunk.content
      }));

      const groundingValidation = groundingService.validateGrounding(answer, documentsForValidation, {
        minGroundingScore: 0.8,
        strictMode: true
      });

      console.log(`   Grounding score: ${(groundingValidation.groundingScore * 100).toFixed(1)}%`);
      console.log(`   Citations: ${groundingValidation.citations.length}`);
      console.log(`   Uncited claims: ${groundingValidation.uncitedClaims.length}`);

      // 🆕 STEP 9: Citation Injection (PHASE 3)
      if (groundingValidation.uncitedClaims.length > 0) {
        console.log('💉 Injecting missing citations...');

        const citationResult = await citationInjectorService.injectCitations(
          answer,
          documentsForValidation,
          {
            method: 'hybrid',
            minConfidence: 0.6
          }
        );

        answer = citationResult.citedResponse;
        console.log(`   Injected ${citationResult.injectedCitations} citations`);
        console.log(`   Citation coverage: ${citationResult.coverage.toFixed(1)}%`);
      }

      // Step 10: Calculate confidence score
      const confidence = this.calculateConfidence(rerankedChunks, sources.length);
      console.log(`🎯 Confidence: ${confidence.level} (${(confidence.score * 100).toFixed(0)}%)`);

      // Step 11: Store context in database
      const chatContext = await prisma.chatContext.create({
        data: {
          conversationId,
          sourceDocuments: JSON.stringify(sources.map(s => ({
            documentId: s.documentId,
            chunkIndexes: [s.chunkIndex],
            relevanceScore: s.similarity,
            citation: s.documentName
          }))),
          webSources: null,
          searchQuery: query,
          expandedTerms: JSON.stringify([])
        }
      });

      console.log(`✅ RAG answer generated with ${sources.length} document sources (Confidence: ${confidence.level})`);

      // Cache the response for future queries
      await responseCacheService.cacheResponse(query, answer);

      // 🆕 STEP 12: Quality Monitoring (PHASE 4)
      const totalTime = Date.now() - startTime;
      await qualityMonitorService.logPerformance({
        requestId: `rag_${Date.now()}_${userId}`,
        timestamp: new Date(),
        userId,
        query,
        latency: totalTime,
        success: true,
        relevanceScore: confidence.score,
        groundingScore: groundingValidation.groundingScore,
        citationCoverage: groundingValidation.groundingScore,
        tokensUsed: Math.ceil(answer.length / 4), // Rough estimate
        cost: (Math.ceil(answer.length / 4) / 1000000) * 0.075, // GPT-4o-mini pricing
        metadata: {
          documentCount: sources.length,
          retrievalMethod: 'enhanced',
          groundingValidation,
          answerability
        }
      });

      console.log(`⏱️ Total response time: ${totalTime}ms`);

      return {
        answer,
        sources,
        webSources: undefined,
        expandedQuery: [],
        contextId: chatContext.id,
        confidence: confidence.level,
        confidenceScore: confidence.score,
        verification: undefined
      };
    } catch (error) {
      console.error('Error in RAG generation:', error);
      throw error;
    }
  }

  /**
   * Build context string from sources
   * @param documentResults - Document search results
   * @param webResults - Web search results
   * @returns Context string for LLM
   */
  private buildContext(documentResults: any[], webResults: WebSource[]): string {
    console.time('⏱️ [Context Building]');

    // ⚡ SPEED OPTIMIZED: Limit context to 20,000 characters (~5,000 tokens) for faster LLM processing
    // Smaller context = faster generation while still providing accurate answers
    const MAX_CONTEXT_CHARS = 20000; // Reduced from 40000 for speed
    let context = '';
    let currentLength = 0;
    let chunksAdded = 0;
    let chunksSkipped = 0;

    // Add document sources with size limit
    if (documentResults.length > 0) {
      context += '=== USER DOCUMENTS ===\n\n';
      currentLength += context.length;

      for (let index = 0; index < documentResults.length; index++) {
        const result = documentResults[index];
        const metadata = result.metadata;
        let location = '';

        if (metadata.page) {
          location = `Page ${metadata.page}`;
        } else if (metadata.sheet) {
          // Enhanced Excel cell display
          if (metadata.cells && metadata.cells.length > 0) {
            const cellList = metadata.cells.length > 3
              ? `Cells ${metadata.cells.slice(0, 3).join(', ')}...`
              : `Cell${metadata.cells.length > 1 ? 's' : ''} ${metadata.cells.join(', ')}`;
            location = `Sheet '${metadata.sheet}', Row ${metadata.row}, ${cellList}`;
          } else {
            location = `Sheet '${metadata.sheet}', Row ${metadata.row}`;
          }
        } else if (metadata.paragraph) {
          location = `Paragraph ${metadata.paragraph}`;
        } else if (metadata.slide) {
          location = `Slide ${metadata.slide}`;
        }

        // Calculate size of this chunk (header + content)
        const header = `[Source ${index + 1}] ${result.document.filename}${location ? ' - ' + location : ''}\n`;
        const chunkSize = header.length + result.content.length + 2; // +2 for \n\n

        // ⚡ Stop if adding this chunk would exceed limit
        if (currentLength + chunkSize > MAX_CONTEXT_CHARS) {
          chunksSkipped = documentResults.length - index;
          console.log(`⚠️ [Context Limit] Reached at ${index}/${documentResults.length} document chunks (${currentLength} chars)`);
          break;
        }

        // Add chunk
        context += header;
        context += `${result.content}\n\n`;
        currentLength += chunkSize;
        chunksAdded++;
      }
    }

    // Add web sources with remaining space
    if (webResults.length > 0 && currentLength < MAX_CONTEXT_CHARS) {
      context += '\n=== WEB SOURCES ===\n\n';
      currentLength += 20; // Length of header

      for (let index = 0; index < webResults.length; index++) {
        const result = webResults[index];

        // Calculate size
        const header = `[Web Source ${index + 1}] ${result.title}\nURL: ${result.url}\n`;
        const content = result.content || result.snippet || '';
        const chunkSize = header.length + content.length + 2;

        // ⚡ Stop if would exceed limit
        if (currentLength + chunkSize > MAX_CONTEXT_CHARS) {
          console.log(`⚠️ [Context Limit] Stopped web sources at ${index}/${webResults.length}`);
          break;
        }

        context += header;
        context += `${content}\n\n`;
        currentLength += chunkSize;
      }
    }

    console.timeEnd('⏱️ [Context Building]');
    console.log(`📊 [Context Stats] Size: ${currentLength} chars (~${Math.round(currentLength * 0.25)} tokens) | Chunks: ${chunksAdded}/${documentResults.length}${chunksSkipped > 0 ? ` (${chunksSkipped} skipped)` : ''}`);

    // 🐛 DEBUG: Log first 500 chars of context to verify filename is included
    console.log(`🐛 [DEBUG] Context preview (first 500 chars):\n${context.substring(0, 500)}\n`);

    return context;
  }

  /**
   * Expand user query into multiple search queries for better retrieval
   * @param query - Original user query
   * @returns Array of expanded queries
   */
  private async expandQuery(query: string): Promise<string[]> {
    try {
      // Check cache first
      const cached = await cacheService.getCachedQueryExpansion(query);
      if (cached) {
        return cached;
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      const prompt = `Generate 2 alternative search queries that would help find relevant information for this question.
Make them diverse to cover different aspects or phrasings.

Original Question: ${query}

Generate 2 alternative queries (one per line, no numbering):`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse queries
      const expandedQueries = text
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && !q.match(/^\d+[\.\)]/)) // Remove numbering
        .slice(0, 2); // Max 2 additional queries

      const allQueries = [query, ...expandedQueries];

      // Cache the result
      await cacheService.cacheQueryExpansion(query, allQueries);

      console.log(`📚 Query expanded into ${allQueries.length} queries`);
      return allQueries;
    } catch (error) {
      console.error('Error expanding query:', error);
      return [query]; // Fallback to original query
    }
  }

  /**
   * Rerank document chunks by relevance using AI
   * @param query - User query
   * @param chunks - Retrieved chunks
   * @returns Reranked chunks
   */
  private async rerankChunks(query: string, chunks: any[]): Promise<any[]> {
    try {
      if (chunks.length <= 1) return chunks;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      // Deduplicate chunks
      const uniqueChunks = new Map();
      for (const chunk of chunks) {
        const key = `${chunk.documentId}-${chunk.chunkIndex}`;
        if (!uniqueChunks.has(key) || chunk.similarity > uniqueChunks.get(key).similarity) {
          uniqueChunks.set(key, chunk);
        }
      }

      const deduplicatedChunks = Array.from(uniqueChunks.values());
      if (deduplicatedChunks.length <= 5) return deduplicatedChunks; // No need to rerank small sets

      // Prepare passages for reranking
      const passages = deduplicatedChunks.slice(0, 15).map((chunk, idx) => {
        const preview = chunk.content.substring(0, 300);
        return `${idx + 1}. ${preview}`;
      }).join('\n\n');

      const prompt = `Rate the relevance of each passage to the question on a scale of 0-10.
Consider semantic meaning, not just keywords.

Question: ${query}

Passages:
${passages}

Return ONLY the numbers (one per line), no explanations:`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse scores
      const scores = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => /^\d+(\.\d+)?$/.test(line))
        .map(score => parseFloat(score));

      // Assign scores to chunks
      deduplicatedChunks.slice(0, scores.length).forEach((chunk, idx) => {
        chunk.rerankScore = scores[idx] || 0;
      });

      // Sort by rerank score
      deduplicatedChunks.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

      console.log(`🎯 Reranked ${deduplicatedChunks.length} chunks`);
      return deduplicatedChunks.slice(0, 10); // Top 10
    } catch (error) {
      console.error('Error reranking chunks:', error);
      return chunks.slice(0, 10); // Fallback to original order
    }
  }

  /**
   * Calculate confidence score for the answer
   * @param chunks - Retrieved chunks
   * @param sourcesUsed - Number of sources cited
   * @returns Confidence level (high/medium/low) and score (0-1)
   */
  private calculateConfidence(chunks: any[], sourcesUsed: number): { level: string; score: number } {
    // Calculate average similarity/rerank score
    const avgScore = chunks.length > 0
      ? chunks.reduce((sum, chunk) => sum + (chunk.rerankScore || chunk.similarity || 0), 0) / chunks.length
      : 0;

    // Factors:
    // 1. Average relevance score (0-1)
    // 2. Number of sources used (more = better)
    // 3. Number of chunks found (more = better coverage)

    let confidenceScore = 0;

    // Factor 1: Relevance (50% weight)
    if (chunks.length > 0) {
      const normalizedScore = avgScore / 10; // Normalize rerank scores (0-10) to 0-1
      confidenceScore += normalizedScore * 0.5;
    }

    // Factor 2: Sources used (30% weight)
    if (sourcesUsed >= 3) {
      confidenceScore += 0.3;
    } else if (sourcesUsed >= 2) {
      confidenceScore += 0.2;
    } else if (sourcesUsed >= 1) {
      confidenceScore += 0.1;
    }

    // Factor 3: Coverage (20% weight)
    if (chunks.length >= 5) {
      confidenceScore += 0.2;
    } else if (chunks.length >= 3) {
      confidenceScore += 0.15;
    } else if (chunks.length >= 1) {
      confidenceScore += 0.1;
    }

    // Determine level
    let level: string;
    if (confidenceScore >= 0.75) {
      level = 'high';
    } else if (confidenceScore >= 0.5) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { level, score: confidenceScore };
  }

  /**
   * Detect if query is complex and needs decomposition
   * @param query - User query
   * @returns True if query is complex
   */
  private isComplexQuery(query: string): boolean {
    const complexityIndicators = [
      // English indicators
      /\b(and|or)\b/i,
      /\bcompare\b/i,
      /\bdifference between\b/i,
      /\bhow did\b/i,
      /\bwhy did\b/i,
      /\bwhat caused\b/i,
      /\banalyze\b/i,
      /\brelationship between\b/i,
      /multiple|several|various/i,

      // Portuguese indicators
      /\b(e|ou)\b/i, // and/or in Portuguese
      /\bcompar(e|ar|ação)\b/i, // compare/comparison
      /\bdiferença entre\b/i, // difference between
      /\bcomo (foi|aconteceu)\b/i, // how did/happened
      /\bpor\s*que\b/i, // why (with or without space)
      /\bporque\b/i, // because/why
      /\bo que causou\b/i, // what caused
      /\banalis(e|ar)\b/i, // analyze
      /\brelação entre\b/i, // relationship between
      /\bmúltiplos|vários|diversos/i // multiple/several/various
    ];

    return complexityIndicators.some(pattern => pattern.test(query));
  }

  /**
   * Decompose complex query into sub-questions
   * @param query - Complex query
   * @returns Array of sub-questions
   */
  private async decomposeQuery(query: string): Promise<string[]> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      // Detect language and add instruction
      const detectedLang = detectLanguage(query);
      const languageInstruction = createLanguageInstruction(detectedLang);

      const prompt = `Break this complex question into 2-4 simpler sub-questions that, when answered together, fully address the original question.${languageInstruction}

Complex Question: ${query}

Generate sub-questions (one per line, no numbering):`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const subQuestions = text
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && !q.match(/^\d+[\.\)]/))
        .slice(0, 4);

      console.log(`🔍 Decomposed into ${subQuestions.length} sub-questions`);
      return subQuestions;
    } catch (error) {
      console.error('Error decomposing query:', error);
      return [query];
    }
  }

  /**
   * Generate answer using GPT-4o-mini (FAST: 3-5 seconds vs Gemini's 30+ seconds)
   * @param query - User query
   * @param context - Context from sources
   * @param documentSources - Document sources
   * @param webSources - Web sources
   * @returns Generated answer
   */
  private async generateWithGemini(
    query: string,
    context: string,
    documentSources: any[],
    webSources: WebSource[]
  ): Promise<string> {
    try {
      // ⚡ PERFORMANCE: Use GPT-4o-mini for RAG answers (3-5s vs Gemini 2.5 Pro's 30+s)
      const OpenAI = require('openai').default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // NOTE: Keep using gemini for complex operations (query decomposition, reranking)
      // but use GPT-4o-mini for fast answer generation

      const hasWebSources = webSources && webSources.length > 0;
      const hasDocSources = documentSources && documentSources.length > 0;

      // Detect language from the user's query
      const detectedLang = detectLanguage(query);
      const languageInstruction = createLanguageInstruction(detectedLang);

      console.log(`🌍 [RAG] Detected language: ${detectedLang}, Will respond in same language`);

      // 🆕 Add grounding instructions (PHASE 3)
      const groundingInstructions = groundingService.addGroundingInstructions(
        '',
        documentSources.map(d => ({ id: d.documentId, name: d.document.filename })),
        {
          strictMode: true,
          citationFormat: 'inline',
          language: detectedLang
        }
      );

      const systemPrompt = `You are KODA AI, a document search assistant. Your PRIMARY role is to search and retrieve information from the user's uploaded documents.

CRITICAL RULES:
1. ALWAYS prioritize information from the provided document sources
2. DO NOT provide generic definitions or external knowledge unless NO document sources are available
3. If document sources exist, ONLY answer from those sources
4. For Excel files: The full filename appears at the start of each chunk (e.g., "📄 File: filename.xlsx"). ALWAYS reference this filename, NOT just the sheet name
5. For Excel files: provide exact cell values, formulas, and data from the spreadsheet
6. For document-specific questions (e.g., "what is our ICP", "what excel did I upload"): ONLY use document content
7. IMPORTANT CITATIONS: Every factual claim must cite sources using format [Source: DocumentName, Page X]
8. Be CONCISE and FOCUSED - extract key data that directly answers the question
9. If the answer is NOT in the provided sources, say: "I couldn't find this information in your documents. Would you like me to search in research mode?"
10. When a document name is mentioned, use ONLY that specific document
${languageInstruction}

REMEMBER: Your job is to help users find information in THEIR documents, not to provide general knowledge.`;



      const userPrompt = `USER QUESTION:
${query}

${hasDocSources ? '📄 DOCUMENT SOURCES (USE THESE FIRST):' : 'AVAILABLE SOURCES:'}
${context}

${!hasDocSources && !hasWebSources ? '⚠️ IMPORTANT: No document sources were found. Inform the user that their documents don\'t contain information about this query, and suggest enabling research mode for web search.' : ''}
${hasDocSources ? '✅ IMPORTANT: Document sources are available above. Answer ONLY from these sources. Do not use external knowledge.' : ''}

Provide a focused answer WITHOUT citation markers (sources shown separately):`;

      // ⚡ Call GPT-4o-mini for fast answer generation with 15-second timeout (reduced from 30s)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API request timed out after 15 seconds')), 15000);
      });

      const completion = await Promise.race([
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2, // Lower temperature for faster, more focused responses (was 0.3)
          max_tokens: 1500 // Reduced for faster generation (~1200 characters) (was 2500)
        }),
        timeoutPromise
      ]) as any;

      const answer = completion.choices[0].message.content || '';
      console.log(`✅ [RAG] GPT-4o-mini generated answer in ${completion.usage?.total_tokens || 0} tokens`);

      return answer;
    } catch (error) {
      console.error('Error generating with Gemini:', error);
      throw new Error('Failed to generate answer');
    }
  }

  /**
   * Generate deep link for a document chunk
   * @param result - Search result
   * @returns Deep link URL
   */
  private generateDeepLink(result: any): string {
    const metadata = result.metadata;
    const documentId = result.documentId;

    let link = `/documents/${documentId}`;

    // Add specific location parameters
    if (metadata.page) {
      link += `?page=${metadata.page}`;
    } else if (metadata.sheet) {
      link += `?sheet=${encodeURIComponent(metadata.sheet)}`;

      // Handle cells array - use first cell for deep linking
      if (metadata.cells && Array.isArray(metadata.cells) && metadata.cells.length > 0) {
        link += `&cell=${metadata.cells[0]}`;
      } else if (metadata.cell) {
        // Fallback for single cell metadata
        link += `&cell=${metadata.cell}`;
      }

      // Add row for additional context
      if (metadata.row) {
        link += `&row=${metadata.row}`;
      }
    } else if (metadata.paragraph) {
      link += `?paragraph=${metadata.paragraph}`;
    } else if (metadata.slide) {
      link += `?slide=${metadata.slide}`;
    }

    return link;
  }

  /**
   * Get context for a specific chat
   * @param contextId - Context ID
   * @returns Chat context
   */
  async getContext(contextId: string) {
    try {
      const context = await prisma.chatContext.findUnique({
        where: { id: contextId }
      });

      if (!context) {
        throw new Error('Context not found');
      }

      return {
        sources: JSON.parse(context.sourceDocuments),
        webSources: context.webSources ? JSON.parse(context.webSources) : null,
        searchQuery: context.searchQuery,
        expandedTerms: context.expandedTerms ? JSON.parse(context.expandedTerms) : []
      };
    } catch (error) {
      console.error('Error getting context:', error);
      throw error;
    }
  }

  /**
   * Answer a follow-up question using existing context
   * @param userId - User ID
   * @param query - Follow-up question
   * @param conversationId - Conversation ID
   * @param previousContextId - Previous context ID
   * @returns RAG response
   */
  async answerFollowUp(
    userId: string,
    query: string,
    conversationId: string,
    previousContextId: string
  ): Promise<RAGResponse> {
    try {
      // Get previous context
      const previousContext = await this.getContext(previousContextId);

      // Use the same sources but generate new answer
      const context = this.buildContextFromStored(previousContext.sources, previousContext.webSources);

      // Generate answer
      const answer = await this.generateWithGemini(
        query,
        context,
        previousContext.sources,
        previousContext.webSources || []
      );

      // Create new context entry
      const chatContext = await prisma.chatContext.create({
        data: {
          conversationId,
          sourceDocuments: JSON.stringify(previousContext.sources),
          webSources: previousContext.webSources ? JSON.stringify(previousContext.webSources) : null,
          searchQuery: query,
          expandedTerms: JSON.stringify(previousContext.expandedTerms)
        }
      });

      return {
        answer,
        sources: previousContext.sources,
        webSources: previousContext.webSources,
        expandedQuery: previousContext.expandedTerms,
        contextId: chatContext.id
      };
    } catch (error) {
      console.error('Error answering follow-up:', error);
      throw error;
    }
  }

  /**
   * Build context from stored sources
   * @param documentSources - Stored document sources
   * @param webSources - Stored web sources
   * @returns Context string
   */
  private buildContextFromStored(documentSources: any[], webSources: any[] | null): string {
    let context = '';

    if (documentSources && documentSources.length > 0) {
      context += '=== USER DOCUMENTS ===\n\n';
      documentSources.forEach((source, index) => {
        context += `[Source ${index + 1}] ${source.citation}\n`;
        context += `(Retrieved from previous search)\n\n`;
      });
    }

    if (webSources && webSources.length > 0) {
      context += '\n=== WEB SOURCES ===\n\n';
      webSources.forEach((source, index) => {
        context += `[Web Source ${index + 1}] ${source.title}\n`;
        context += `URL: ${source.url}\n`;
        context += `${source.content || source.snippet}\n\n`;
      });
    }

    return context;
  }

  /**
   * Verify facts in answer against source documents
   * @param answer - Generated answer
   * @param documentSources - Source documents used
   * @returns Verification result
   */
  private async verifyAnswerFacts(
    answer: string,
    documentSources: any[]
  ): Promise<VerificationResult> {
    try {
      // Format sources for verification
      const sources = documentSources.map(doc => ({
        content: doc.content,
        documentName: doc.document.filename
      }));

      // Perform verification
      const verification = await factVerificationService.verifyAnswer(answer, sources);

      return verification;
    } catch (error) {
      console.error('Error verifying answer facts:', error);
      // Return safe default on error
      return {
        allClaims: [],
        verificationScore: 0.8,
        unverifiableClaims: [],
        overallVerdict: 'partially_verified'
      };
    }
  }

  /**
   * Extract document names mentioned in the query
   * Uses fuzzy matching to find documents like "koda business plan", "Q4 report", etc.
   * @param userId - User ID
   * @param query - User query
   * @returns Array of matching documents
   */
  private async extractDocumentNames(userId: string, query: string): Promise<any[]> {
    try {
      // Get all user's documents
      const userDocuments = await prisma.document.findMany({
        where: { userId },
        select: { id: true, filename: true }
      });

      if (userDocuments.length === 0) {
        return [];
      }

      const queryLower = query.toLowerCase();
      const matchedDocuments: any[] = [];

      // Strategy 1: Direct substring matching (e.g., "koda business plan" matches "KODA Business Plan.pdf")
      for (const doc of userDocuments) {
        const filenameLower = doc.filename.toLowerCase();
        const filenameWithoutExt = filenameLower.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');

        // Check if query contains significant parts of the filename
        const words = filenameWithoutExt.split(/[\s_-]+/).filter(w => w.length > 2);
        let matchCount = 0;

        for (const word of words) {
          if (queryLower.includes(word)) {
            matchCount++;
          }
        }

        // Smarter matching: require more matches when query has multiple specific words
        // e.g., "koda business plan" should match "Koda Business Plan" but NOT "Koda Blueprint"
        const queryWords = queryLower.split(/[\s_-]+/).filter(w => w.length > 2);
        const isSpecificQuery = queryWords.length >= 3; // e.g., "koda business plan" = 3 words

        let threshold;
        if (isSpecificQuery) {
          // For specific queries (3+ words), require at least 2 matches
          threshold = Math.min(2, words.length);
        } else {
          // For general queries, 1 match is enough
          threshold = 1;
        }

        if (matchCount >= threshold) {
          matchedDocuments.push(doc);
          console.log(`✅ Matched document: "${doc.filename}" (${matchCount}/${words.length} words matched, threshold: ${threshold})`);
        }
      }

      return matchedDocuments;
    } catch (error) {
      console.error('Error extracting document names:', error);
      return [];
    }
  }
}

export default new RAGService();

