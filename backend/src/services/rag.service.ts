/**
 * RAG SERVICE - Phase 3: Query Understanding & RAG
 *
 * ENHANCEMENTS:
 * - Confidence gating (0.7 threshold)
 * - Mentions search for finding phrase occurrences across documents
 * - Answer length control via systemPrompts service
 * - Intent-based prompt templates
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import intentService from './intent.service';
import navigationService from './navigation.service';
import { detectLanguage, createLanguageInstruction } from './languageDetection.service';
import cacheService from './cache.service';
import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';
import systemPromptsService, { AnswerLength } from './systemPrompts.service';
import responseFormatterService from './responseFormatter.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Phase 3: Confidence threshold for quality gating
// Lowered from 0.6 to 0.5 to allow queries about document identifiers (passport numbers, etc.)
// that may use slightly different terminology
const CONFIDENCE_THRESHOLD = 0.5;

interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: any;
  location?: string; // Page, slide, or cell reference
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  contextId: string;
  intent?: string;
  confidence?: number;
}

class RAGService {
  /**
   * Main entry point - handles ALL queries with smart routing
   */
  async generateAnswer(
    userId: string,
    query: string,
    conversationId: string,
    answerLength: AnswerLength = 'medium',
    documentId?: string
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`🔍 RAG QUERY: "${query}"`);
    console.log(`👤 User: ${userId}`);
    console.log(`📏 Answer Length: ${answerLength}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // STEP 1: CHECK FOR CHAT ACTIONS (AI-First: file actions, list commands, upload requests)
    console.log(`\n🤖 CHECKING FOR CHAT ACTIONS...`);
    const chatActionsService = await import('./chatActions.service');
    const actionResult = await chatActionsService.default.detectAndExecute(userId, query, conversationId);

    if (actionResult.isAction) {
      console.log(`   ✅ Action detected: ${actionResult.actionType}`);

      // Format chat action responses
      const responseFormatterService = await import('./responseFormatter.service');
      const formatterContext = {
        queryLength: query.length,
        documentCount: 0,
        intentType: actionResult.actionType || 'file_action',
        chunks: [],
        hasFinancialData: false,
        hasMultipleSheets: false,
        hasSlides: false,
      };

      const formattedResponse = await responseFormatterService.default.formatResponse(
        actionResult.response,
        formatterContext,
        [],
        query
      );

      return {
        answer: formattedResponse,
        sources: [],
        contextId: `action_${actionResult.actionType}_${Date.now()}`,
        intent: actionResult.actionType,
        confidence: 1.0,
        actionResult: actionResult.result,
        uiUpdate: actionResult.uiUpdate,
      };
    }

    console.log(`   ✅ Not an action - proceeding with query handling`);

    // STEP 2: DETECT QUERY INTENT
    const intent = intentService.detectIntent(query);
    console.log(`🎯 Intent: ${intent.intent} (confidence: ${intent.confidence})`);
    console.log(`💡 Reasoning: ${intent.reasoning}`);

    // STEP 2: ROUTE BASED ON INTENT
    if (intent.intent === 'greeting') {
      return await this.handleGreeting(userId, query);
    } else if (intent.intent === 'navigation') {
      return await this.handleNavigationQuery(userId, query);
    } else if (intent.intent === 'search_mentions') {
      // Phase 3: New mentions search handler
      return await this.handleMentionsSearch(userId, query, answerLength);
    } else {
      // EXTRACT, SUMMARIZE, COMPARE, CELL_VALUE - use RAG with confidence gating
      return await this.handleContentQuery(userId, query, conversationId, answerLength, documentId);
    }
  }

  /**
   * Handle GREETING queries
   */
  private async handleGreeting(userId: string, query: string): Promise<RAGResponse> {
    console.log(`👋 GREETING HANDLER`);

    const queryLower = query.toLowerCase().trim();
    let response = '';

    if (/^(hi|hello|hey)/i.test(queryLower)) {
      response = "Hello! I'm KODA, your document intelligence assistant. How can I help you today?";
    } else if (/how are you/i.test(queryLower)) {
      response = "I'm doing great, thanks for asking! I'm here to help you with your documents. What would you like to know?";
    } else if (/thanks|thank you/i.test(queryLower)) {
      response = "You're welcome! Let me know if you need anything else.";
    } else {
      response = "Hello! How can I assist you with your documents today?";
    }

    return {
      answer: response,
      sources: [],
      contextId: `greeting_${Date.now()}`,
      intent: 'greeting'
    };
  }

  /**
   * Handle NAVIGATION queries (where is file X, show me folder Y)
   */
  private async handleNavigationQuery(
    userId: string,
    query: string
  ): Promise<RAGResponse> {
    console.log(`🧭 NAVIGATION QUERY HANDLER`);

    const fileName = intentService.extractFileName(query);
    if (fileName) {
      console.log(`   Looking for file: "${fileName}"`);
      const result = await navigationService.findFile(userId, fileName);

      return {
        answer: result.message,
        sources: [],
        contextId: `navigation_${Date.now()}`,
        intent: 'navigation'
      };
    }

    const folderName = intentService.extractFolderName(query);
    if (folderName) {
      console.log(`   Looking for folder: "${folderName}"`);
      const result = await navigationService.findFolder(userId, folderName);

      return {
        answer: result.message,
        sources: [],
        contextId: `navigation_${Date.now()}`,
        intent: 'navigation'
      };
    }

    return {
      answer: "I can help you find files and folders! Please specify which file or folder you're looking for.",
      sources: [],
      contextId: `navigation_${Date.now()}`,
      intent: 'navigation'
    };
  }

  /**
   * Phase 3: Handle MENTIONS SEARCH queries
   * Find all documents that contain a specific phrase or keyword
   * Returns document names with surrounding context
   */
  private async handleMentionsSearch(
    userId: string,
    query: string,
    answerLength: AnswerLength
  ): Promise<RAGResponse> {
    console.log(`🔍 MENTIONS SEARCH HANDLER`);

    // Extract the search phrase from the query
    const searchPhrase = this.extractSearchPhrase(query);
    console.log(`   Search phrase: "${searchPhrase}"`);

    if (!searchPhrase) {
      return {
        answer: "I couldn't identify what phrase or term you're looking for. Please specify what you want me to search for.",
        sources: [],
        contextId: `mentions_${Date.now()}`,
        intent: 'search_mentions'
      };
    }

    // Search across all user documents using vector similarity
    const embeddingResult = await embeddingService.generateQueryEmbedding(searchPhrase);
    const results = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding, // Extract the array from the result object
      userId,
      50, // topK - Get more results for comprehensive search
      0.3 // minSimilarity - Lowered for better recall
    );

    console.log(`   Found ${results.length} potential mentions`);

    // Phase 3: CONFIDENCE GATING - filter by threshold
    const confidenceResults = results.filter(r => r.similarity >= CONFIDENCE_THRESHOLD);
    console.log(`   ${confidenceResults.length} results above ${CONFIDENCE_THRESHOLD} confidence threshold`);

    if (confidenceResults.length === 0) {
      const detectedLang = detectLanguage(query);
      const answer = detectedLang === 'pt'
        ? `Não encontrei menções relevantes de "${searchPhrase}" nos seus documentos.`
        : `I couldn't find relevant mentions of "${searchPhrase}" in your documents.`;

      return {
        answer,
        sources: [],
        contextId: `mentions_${Date.now()}`,
        intent: 'search_mentions',
        confidence: 0
      };
    }

    // Group results by document
    const docMap = new Map<string, { name: string; mentions: Array<{ content: string; score: number; location?: string }> }>();

    for (const result of confidenceResults) {
      if (!docMap.has(result.documentId)) {
        docMap.set(result.documentId, {
          name: result.document?.filename || 'Unknown', // ✅ Fixed: use result.document.filename
          mentions: []
        });
      }

      const doc = docMap.get(result.documentId)!;
      doc.mentions.push({
        content: result.content,
        score: result.similarity,
        location: result.metadata?.pageNumber
          ? `Page ${result.metadata.pageNumber}`
          : result.metadata?.slideNumber
          ? `Slide ${result.metadata.slideNumber}`
          : undefined
      });
    }

    // Build sources array for response
    const sources: RAGSource[] = [];
    for (const [docId, doc] of docMap.entries()) {
      // Take the highest scoring mention from each document
      const topMention = doc.mentions.sort((a, b) => b.score - a.score)[0];

      sources.push({
        documentId: docId,
        documentName: doc.name,
        chunkIndex: 0,
        content: topMention.content,
        similarity: topMention.score,
        metadata: { mentionCount: doc.mentions.length },
        location: topMention.location
      });
    }

    // Sort sources by similarity (highest first)
    sources.sort((a, b) => b.similarity - a.similarity);

    // Build context for LLM with all mentions
    const contextParts: string[] = [];
    for (const source of sources) {
      const mentionInfo = docMap.get(source.documentId)!;
      contextParts.push(`Document: ${source.documentName}`);
      contextParts.push(`Mentions found: ${mentionInfo.mentions.length}`);
      for (let i = 0; i < Math.min(3, mentionInfo.mentions.length); i++) {
        const mention = mentionInfo.mentions[i];
        const locationStr = mention.location ? ` (${mention.location})` : '';
        contextParts.push(`  ${i + 1}${locationStr}: "${mention.content.substring(0, 200)}..."`);
      }
      contextParts.push('');
    }

    const context = contextParts.join('\n');

    // Use system prompts service for specialized mentions search prompt
    const promptConfig = systemPromptsService.getPromptConfig('search_mentions', answerLength);
    const fullPrompt = systemPromptsService.buildPrompt('search_mentions', query, context, answerLength);

    // Generate answer with LLM
    console.log(`🤖 GENERATING MENTIONS SUMMARY...`);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: promptConfig.maxTokens,
        temperature: promptConfig.temperature,
      }
    });

    const result = await model.generateContent(fullPrompt);
    const answer = result.response.text();

    const responseTime = Date.now() - startTime;
    console.log(`✅ MENTIONS SEARCH COMPLETE (${responseTime}ms)`);
    console.log(`   Documents found: ${sources.length}`);
    console.log(`   Total mentions: ${Array.from(docMap.values()).reduce((sum, d) => sum + d.mentions.length, 0)}`);

    // Calculate average confidence
    const avgConfidence = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;

    return {
      answer,
      sources: sources.slice(0, 10), // Limit to top 10 documents in response
      contextId: `mentions_${Date.now()}`,
      intent: 'search_mentions',
      confidence: avgConfidence
    };
  }

  /**
   * Handle CONTENT queries (information extraction, summarization, comparison)
   * Phase 3: Enhanced with confidence gating and answer length control
   */
  private async handleContentQuery(
    userId: string,
    query: string,
    conversationId: string,
    answerLength: AnswerLength,
    documentId?: string
  ): Promise<RAGResponse> {
    console.log(`📚 CONTENT QUERY HANDLER`);
    if (documentId) {
      console.log(`   🎯 Document-specific query - filtering to documentId: ${documentId}`);
    }

    const startTime = Date.now();

    // Check cache
    const cacheKey = cacheService.generateKey(query, userId, { documentId, answerLength });
    const cached = await cacheService.get<RAGResponse>(cacheKey, {
      ttl: 3600,
      useMemory: true,
      useRedis: true,
    });

    if (cached) {
      console.log(`🚀 CACHE HIT! (${Date.now() - startTime}ms)`);
      return cached;
    }

    // Get intent for prompt selection
    const intent = intentService.detectIntent(query);

    // STEP 0: CHECK IF QUERY IS GENERAL KNOWLEDGE (before Pinecone search)
    console.log(`\n🧠 CHECKING QUERY TYPE...`);
    const isGeneralKnowledge = this.detectGeneralKnowledge(query);

    if (isGeneralKnowledge) {
      console.log(`   🌍 General knowledge question detected - answering from AI knowledge`);

      // Generate answer using Gemini without document context
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        }
      });

      const detectedLang = detectLanguage(query);
      const generalPrompt = detectedLang === 'pt'
        ? `Responda de forma concisa e precisa: ${query}`
        : `Answer concisely and accurately: ${query}`;

      const result = await model.generateContent(generalPrompt);
      const answer = result.response.text();

      return {
        answer,
        sources: [],  // No document sources for general knowledge
        contextId: `general_${Date.now()}`,
        intent: 'general_knowledge',
      };
    }

    console.log(`   📄 Document-specific question - searching user documents`);

    // STEP 1: DETECT DOCUMENT-SPECIFIC QUERIES (Fuzzy Matching)
    // If documentId not provided, try to detect from query
    if (!documentId) {
      const detectedDocId = await this.detectDocumentFromQuery(query, userId);
      if (detectedDocId) {
        console.log(`   🎯 Auto-detected document reference in query - scoping to documentId: ${detectedDocId}`);
        documentId = detectedDocId;
      }
    }

    // Step 2: Generate query embedding (using specialized query embedding for better retrieval)
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    // Step 2: Retrieve relevant documents from Pinecone
    console.log(`🔍 RETRIEVING DOCUMENTS...`);

    const topK = documentId ? 50 : 40; // More chunks for single-doc queries

    const retrievalResults = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding, // Extract the array from the result object
      userId,
      topK,
      0.3, // minSimilarity - Lowered for better recall
      documentId // attachedDocumentId
    );
    console.log(`   Found ${retrievalResults.length} relevant chunks`);

    // Phase 3: CONFIDENCE GATING - Check if results meet minimum threshold
    const highConfidenceResults = retrievalResults.filter(r => r.similarity >= CONFIDENCE_THRESHOLD);
    console.log(`   📊 Confidence gating: ${highConfidenceResults.length}/${retrievalResults.length} chunks above ${CONFIDENCE_THRESHOLD} threshold`);

    // If NO results above confidence threshold, return "I don't know" response
    if (highConfidenceResults.length === 0) {
      console.log(`   ⚠️  ALL RESULTS BELOW CONFIDENCE THRESHOLD - Returning uncertainty response`);

      const detectedLang = detectLanguage(query);

      // Get document name if specific document was queried
      let documentName = 'your documents';
      if (documentId) {
        try {
          const doc = await prisma.document.findUnique({
            where: { id: documentId },
            select: { filename: true }
          });
          if (doc) {
            documentName = doc.filename;
          }
        } catch (error) {
          console.warn('Failed to fetch document name:', error);
        }
      }

      const answer = detectedLang === 'pt'
        ? `Não consegui encontrar informações relevantes sobre "${query}" em ${documentName}.`
        : `I couldn't find relevant information about "${query}" in ${documentName}.`;

      return {
        answer,
        sources: [],
        contextId: `rag_${Date.now()}`,
        intent: intent.intent,
        confidence: 0
      };
    }

    // Use high confidence results for answer generation
    if (retrievalResults.length === 0) {
      const detectedLang = detectLanguage(query);
      const answer = detectedLang === 'pt'
        ? `Não consegui encontrar informações sobre "${query}".`
        : `I couldn't find information about "${query}".`;

      return {
        answer,
        sources: [],
        contextId: `rag_${Date.now()}`,
        intent: intent.intent,
        confidence: 0
      };
    }

    // Step 3: Prepare sources from high-confidence results
    const sources: RAGSource[] = highConfidenceResults.map(result => ({
      documentId: result.documentId,
      documentName: result.document?.filename || 'Unknown', // ✅ Fixed: use result.document.filename
      chunkIndex: result.chunkIndex || 0,
      content: result.content,
      similarity: result.similarity,
      metadata: result.metadata,
      location: result.metadata?.pageNumber
        ? `Page ${result.metadata.pageNumber}`
        : result.metadata?.slideNumber
        ? `Slide ${result.metadata.slideNumber}`
        : result.metadata?.cellReference
        ? `Cell ${result.metadata.cellReference}`
        : undefined
    }));

    // Sort by similarity
    sources.sort((a, b) => b.similarity - a.similarity);

    // Deduplicate by document (keep highest scoring chunk per document)
    const seenDocs = new Set<string>();
    const uniqueSources = sources.filter(s => {
      if (seenDocs.has(s.documentId)) return false;
      seenDocs.add(s.documentId);
      return true;
    });

    // Limit to top sources
    const finalSources = uniqueSources.slice(0, 5);

    // Step 4: Build context from sources
    const context = sources
      .slice(0, 10) // Use top 10 chunks for context
      .map((s, idx) => {
        const locationStr = s.location ? ` (${s.location})` : '';
        return `[Document ${idx + 1}: ${s.documentName}${locationStr}]\n${s.content}`;
      })
      .join('\n\n---\n\n');

    // Phase 3: Use system prompts service with answer length control
    console.log(`🤖 GENERATING ANSWER...`);
    console.log(`   Intent: ${intent.intent}`);
    console.log(`   Answer Length: ${answerLength}`);

    const promptConfig = systemPromptsService.getPromptConfig(intent.intent, answerLength);
    const fullPrompt = systemPromptsService.buildPrompt(intent.intent, query, context, answerLength);

    // Generate answer with intent-specific temperature and token limits
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: promptConfig.maxTokens,
        temperature: promptConfig.temperature,
      }
    });

    const result = await model.generateContent(fullPrompt);
    const rawAnswer = result.response.text();

    const responseTime = Date.now() - startTime;

    // Calculate average confidence
    const avgConfidence = finalSources.reduce((sum, s) => sum + s.similarity, 0) / finalSources.length;

    console.log(`✅ RAW ANSWER GENERATED (${responseTime}ms)`);
    console.log(`   Length: ${rawAnswer.length} characters`);
    console.log(`   Sources: ${finalSources.length} documents`);
    console.log(`   Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    // Format the response using KODA's professional formatting system
    console.log(`🎨 FORMATTING RESPONSE...`);
    const formatterContext = {
      queryLength: query.length,
      documentCount: finalSources.length,
      intentType: intent.intent,
      chunks: highConfidenceResults,
      hasFinancialData: highConfidenceResults.some(r =>
        /\$|USD|EUR|revenue|expense|budget|cost|price|profit|loss/i.test(r.content)
      ),
      hasMultipleSheets: highConfidenceResults.some(r =>
        r.metadata?.sheetName
      ),
      hasSlides: highConfidenceResults.some(r =>
        r.metadata?.slideNumber
      ),
    };

    const formattedAnswer = await responseFormatterService.formatResponse(
      rawAnswer,
      formatterContext,
      finalSources,
      query
    );

    console.log(`✅ RESPONSE FORMATTED`);
    console.log(`   Original length: ${rawAnswer.length} characters`);
    console.log(`   Formatted length: ${formattedAnswer.length} characters`);

    const response: RAGResponse = {
      answer: formattedAnswer,
      sources: finalSources,
      contextId: `rag_${Date.now()}`,
      intent: intent.intent,
      confidence: avgConfidence
    };

    // Cache the result
    await cacheService.set(cacheKey, response, {
      ttl: 3600,
      useMemory: true,
      useRedis: true,
    });

    return response;
  }

  /**
   * Extract search phrase from mentions query
   * Examples:
   * - "Find all mentions of revenue" → "revenue"
   * - "Search for air property" → "air property"
   * - "Which files contain IRR" → "IRR"
   */
  private extractSearchPhrase(query: string): string | null {
    const patterns = [
      /find (?:all )?mentions? of ["']?([^"']+)["']?/i,
      /search for ["']?([^"']+)["']?/i,
      /which (?:files?|documents?) contain ["']?([^"']+)["']?/i,
      /locate mentions? of ["']?([^"']+)["']?/i,
      /where (?:is|are) ["']?([^"']+)["']? mentioned/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: if query starts with search/find/locate, take everything after
    const fallbackMatch = query.match(/^(?:search|find|locate)\s+(.+)$/i);
    if (fallbackMatch && fallbackMatch[1]) {
      return fallbackMatch[1].trim();
    }

    return null;
  }

  /**
   * Detect if query is general knowledge vs. document-specific
   */
  private detectGeneralKnowledge(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    // Document-specific indicators (override general knowledge)
    const documentSpecificPatterns = [
      /in (this|the|my) document/i,
      /according to (the|my) (document|file)/i,
      /from (the|my) (document|file|spreadsheet|presentation)/i,
      /in (the|my) (spreadsheet|excel|powerpoint|pdf)/i,
      /(koda|blueprint|icp|budget|presentation)/i,  // User's specific document names
    ];

    // First check if it's explicitly document-specific
    if (documentSpecificPatterns.some(pattern => pattern.test(lowerQuery))) {
      return false;  // It's document-specific
    }

    // General knowledge indicators
    const generalKnowledgePatterns = [
      // Geography
      /what is the capital of/i,
      /where is .* located/i,
      /which country/i,

      // Science
      /what is .* in physics/i,
      /what is .* in chemistry/i,
      /how does .* work/i,

      // History
      /when did .* happen/i,
      /who invented/i,
      /in what year/i,

      // Math
      /what is \d+ \+ \d+/i,
      /calculate/i,

      // General definitions
      /what does .* mean$/i,
      /define [a-z\s]+$/i,
    ];

    // Check if it matches general knowledge patterns
    if (generalKnowledgePatterns.some(pattern => pattern.test(lowerQuery))) {
      return true;  // It's general knowledge
    }

    // Default: assume document-specific (safer)
    return false;
  }

  /**
   * Detect document reference from query using fuzzy matching
   * Examples:
   * - "what is koda business plan about" → "Koda Business Plan V12.pdf"
   * - "tell me about the Q1 report" → "Q1_Report_2025.pdf"
   * - "summarize the contract" → "Contract_Final.pdf"
   */
  private async detectDocumentFromQuery(query: string, userId: string): Promise<string | null> {
    const documentNamePatterns = [
      // Exact filename mentions (e.g., "koda_plan.pdf")
      /about ([^\s]+\.(?:pdf|docx?|xlsx?|pptx?|txt|csv))/i,

      // "X document/file" (e.g., "about the koda document")
      /(?:about|in|from|the) (?:the )?(.+?) (?:document|file|pdf|spreadsheet|presentation|sheet)/i,

      // Descriptive references (e.g., "what is koda business plan")
      /(?:what is|about|tell me about|summarize|explain) (?:the )?(.+?)(?:\?|$|about)/i,
    ];

    // Try each pattern
    for (const pattern of documentNamePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const potentialName = match[1].trim();

        // Skip if it's too generic
        if (potentialName.length < 3 || /^(it|this|that|the|a|an)$/i.test(potentialName)) {
          continue;
        }

        console.log(`   🔍 Searching for document matching: "${potentialName}"`);

        // Get all user documents
        const userDocuments = await prisma.document.findMany({
          where: {
            userId,
            status: { not: 'deleted' }
          },
          select: { id: true, filename: true }
        });

        // Find best match using fuzzy matching
        const documentMatch = userDocuments.find(doc => {
          const docNameLower = doc.filename.toLowerCase();
          const queryNameLower = potentialName.toLowerCase();

          // Exact match
          if (docNameLower === queryNameLower) {
            console.log(`   ✅ Exact match found: "${doc.filename}"`);
            return true;
          }

          // Filename contains query
          if (docNameLower.includes(queryNameLower)) {
            console.log(`   ✅ Partial match found: "${doc.filename}" contains "${potentialName}"`);
            return true;
          }

          // Query contains significant part of filename
          // Remove file extension for better matching
          const docWords = docNameLower.replace(/\.[^.]+$/, '').split(/[\s_-]+/).filter(w => w.length > 2);
          const queryWords = queryNameLower.split(/[\s_-]+/).filter(w => w.length > 2);

          // Count matching words
          const matchingWords = queryWords.filter(qw =>
            docWords.some(dw => dw.includes(qw) || qw.includes(dw))
          );

          // Match if >50% of query words match document words
          const matchRatio = matchingWords.length / queryWords.length;
          if (matchRatio > 0.5) {
            console.log(`   ✅ Fuzzy match found: "${doc.filename}" (${Math.round(matchRatio * 100)}% match with "${potentialName}")`);
            return true;
          }

          return false;
        });

        if (documentMatch) {
          return documentMatch.id;
        }
      }
    }

    return null;
  }

  /**
   * Generate answer with STREAMING support using Gemini's generateContentStream()
   * Streams response chunks in real-time for better UX
   */
  async generateAnswerStreaming(
    userId: string,
    query: string,
    conversationId: string,
    answerLength: AnswerLength = 'medium',
    documentId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`🔍 RAG QUERY (STREAMING): "${query}"`);
    console.log(`👤 User: ${userId}`);
    console.log(`📏 Answer Length: ${answerLength}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // STEP 1: CHECK FOR CHAT ACTIONS
    console.log(`\n🤖 CHECKING FOR CHAT ACTIONS...`);
    const chatActionsService = await import('./chatActions.service');
    const actionResult = await chatActionsService.default.detectAndExecute(userId, query, conversationId);

    if (actionResult.isAction) {
      console.log(`   ✅ Action detected: ${actionResult.actionType}`);

      // For actions, return immediately without streaming
      const responseFormatterService = await import('./responseFormatter.service');
      const formatterContext = {
        queryLength: query.length,
        documentCount: 0,
        intentType: actionResult.actionType || 'file_action',
        chunks: [],
        hasFinancialData: false,
        hasMultipleSheets: false,
        hasSlides: false,
      };

      const formattedResponse = await responseFormatterService.default.formatResponse(
        actionResult.response,
        formatterContext,
        [],
        query
      );

      // Send full action response as single chunk
      if (onChunk) {
        onChunk(formattedResponse);
      }

      return {
        answer: formattedResponse,
        sources: [],
        contextId: `action_${actionResult.actionType}_${Date.now()}`,
        intent: actionResult.actionType,
        confidence: 1.0,
        actionResult: actionResult.result,
        uiUpdate: actionResult.uiUpdate,
      };
    }

    // STEP 2: DETECT INTENT
    console.log(`\n🎯 DETECTING INTENT...`);
    const intent = await intentService.detectIntent(query);
    console.log(`   Intent: ${intent.intent} (confidence: ${(intent.confidence * 100).toFixed(1)}%)`);

    // STEP 3: RETRIEVE DOCUMENTS
    console.log(`\n📚 RETRIEVING DOCUMENTS...`);
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    const searchResults = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      20,      // topK
      0.3,     // minSimilarity
      documentId  // attachedDocumentId
    );

    if (searchResults.length === 0) {
      console.log(`   ⚠️  No documents found for user ${userId}`);
      const noDocsMessage = 'I could not find any relevant documents to answer your question. Please upload documents first.';
      if (onChunk) {
        onChunk(noDocsMessage);
      }
      return {
        answer: noDocsMessage,
        sources: [],
        contextId: `no_docs_${Date.now()}`,
        intent: intent.intent,
        confidence: 0
      };
    }

    // Filter by confidence threshold
    const highConfidenceResults = searchResults.filter(r => r.similarity >= CONFIDENCE_THRESHOLD);

    if (highConfidenceResults.length === 0) {
      console.log(`   ⚠️  No high-confidence results (threshold: ${CONFIDENCE_THRESHOLD})`);
      const lowConfMessage = 'I could not find information relevant enough to answer your question confidently.';
      if (onChunk) {
        onChunk(lowConfMessage);
      }
      return {
        answer: lowConfMessage,
        sources: [],
        contextId: `low_conf_${Date.now()}`,
        intent: intent.intent,
        confidence: searchResults[0]?.similarity || 0
      };
    }

    console.log(`   ✅ Found ${highConfidenceResults.length} high-confidence chunks`);

    // Build context from chunks
    const context = highConfidenceResults
      .map((result, index) => `[Source ${index + 1}]: ${result.content}`)
      .join('\n\n');

    const finalSources: RAGSource[] = highConfidenceResults.map((result, index) => ({
      documentId: result.documentId,
      documentName: result.document?.filename || result.metadata?.filename || 'Unknown',
      chunkIndex: result.chunkIndex,
      content: result.content,
      similarity: result.similarity,
      metadata: result.metadata,
      location: result.metadata?.page || result.metadata?.slideNumber || result.metadata?.cellRef
    }));

    // STEP 4: BUILD PROMPT
    const promptConfig = systemPromptsService.getPromptConfig(intent.intent, answerLength);
    const fullPrompt = systemPromptsService.buildPrompt(intent.intent, query, context, answerLength);

    // STEP 5: GENERATE STREAMING ANSWER
    console.log(`\n🤖 GENERATING STREAMING ANSWER...`);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: promptConfig.maxTokens,
        temperature: promptConfig.temperature,
      }
    });

    // Use generateContentStream for real-time streaming
    const streamResult = await model.generateContentStream(fullPrompt);
    let rawAnswer = '';
    let chunkCount = 0;

    console.log(`⚡ STREAMING STARTED...`);

    // Stream chunks as they arrive
    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        rawAnswer += chunkText;
        chunkCount++;

        // Send raw chunk to client (formatting happens at the end)
        if (onChunk) {
          onChunk(chunkText);
        }
      }
    }

    const responseTime = Date.now() - startTime;
    const avgConfidence = finalSources.reduce((sum, s) => sum + s.similarity, 0) / finalSources.length;

    console.log(`✅ STREAMING COMPLETE (${responseTime}ms)`);
    console.log(`   Chunks: ${chunkCount}`);
    console.log(`   Length: ${rawAnswer.length} characters`);
    console.log(`   Sources: ${finalSources.length} documents`);
    console.log(`   Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    // Format the complete response (for database storage and metadata)
    const formatterContext = {
      queryLength: query.length,
      documentCount: finalSources.length,
      intentType: intent.intent,
      chunks: highConfidenceResults,
      hasFinancialData: highConfidenceResults.some(r =>
        /\$|USD|EUR|revenue|expense|budget|cost|price|profit|loss/i.test(r.content)
      ),
      hasMultipleSheets: highConfidenceResults.some(r =>
        r.metadata?.sheetName
      ),
      hasSlides: highConfidenceResults.some(r =>
        r.metadata?.slideNumber
      ),
    };

    const formattedAnswer = await responseFormatterService.formatResponse(
      rawAnswer,
      formatterContext,
      finalSources,
      query
    );

    const response: RAGResponse = {
      answer: formattedAnswer,
      sources: finalSources,
      contextId: `rag_stream_${Date.now()}`,
      intent: intent.intent,
      confidence: avgConfidence
    };

    // Cache the result
    const cacheKey = `${query}:${documentId || 'all'}`;
    await cacheService.set(cacheKey, response, {
      ttl: 3600,
      useMemory: true,
      useRedis: true,
    });

    return response;
  }
}

export default new RAGService();
export { RAGService, RAGResponse, RAGSource };
