/**
 * SIMPLIFIED RAG SERVICE
 * RAG + Good Prompt + Smart Routing = Success
 *
 * NO HYBRID SYSTEMS. NO OVER-ENGINEERING. JUST WHAT WORKS.
 *
 * TASK #9: Confidence Calibration
 * - Calculates confidence scores (0-100%) based on retrieval and answer quality
 * - Appends transparency statements to low-confidence answers
 * - Provides confidence metadata to frontend for user awareness
 *
 * TASK #12: Multi-File Summary with Per-File Fact Attribution
 * - Detects when multiple documents are used to answer a query
 * - Instructs LLM to clearly attribute each fact to its source document
 * - Ensures users know which information came from which file
 * - Example: "According to Business Plan, revenue is $670K. Financial Report shows $450K actual."
 *
 * TASK #13: Deterministic Response Behavior
 * - Multi-layer cache (Memory + Redis) ensures identical queries return identical responses
 * - Cache key: hash(query + userId + conversationId)
 * - 1-hour TTL provides deterministic behavior for recent queries
 * - Dramatically improves response time (3000ms → <50ms for cached queries)
 *
 * TASK #14: Audit Trail for Document Span Traceability
 * - Tracks which document spans (chunks) were retrieved and used
 * - Records relevance scores, timing metrics, and confidence levels
 * - Provides detailed audit reports for debugging and compliance
 * - Enables full traceability from query to answer
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import queryIntentService from './queryIntent.service';
import metadataQueryService from './metadataQuery.service';
import enhancedRetrievalService from './enhancedRetrieval.service';
import navigationService from './navigation.service';
import { detectLanguage, createLanguageInstruction } from './languageDetection.service';
import multiLayerCache from './multiLayerCache.service';
import intentClassifierService from './intentClassifier.service';
import locationQueryHandler from './handlers/locationQuery.handler';
import folderContentsHandler from './handlers/folderContents.handler';
import hierarchyQueryHandler from './handlers/hierarchyQuery.handler';
import navigationOrchestrator from './navigationOrchestrator.service';
import conversationContextService from './conversationContext.service';
import relevanceScorerService from './relevanceScorer.service';
import sourceTrackerService from './sourceTracker.service';
import confidenceCalibrationService from './confidenceCalibration.service';
import auditTrailService from './auditTrail.service';
import privacyAwareExtractor from './privacyAwareExtractor.service';
import responseValidator from './responseValidator.service';
import responsePostProcessor from './responsePostProcessor.service';
import documentTypeClassifier from './documentTypeClassifier.service';
import piiScanner from './piiScanner.service';
// Folder-scoped query services
import queryParserService from './queryParser.service';
import folderResolverService from './folderResolver.service';
import promptBuilderService from './promptBuilder.service';
// STAGE 0 IMPORTS (DISABLED - preserved for future use)
// import { detectDocumentReference } from '../lib/rag/query-understanding/document-detector';
// import { matchDocument } from '../lib/rag/query-understanding/document-matcher';
// import { enrichQuery } from '../lib/rag/query-understanding/query-enricher';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: any;
  exactQuotes?: string[]; // TASK #7: Exact quotes extracted from AI response
}

interface ActionButton {
  type: 'open_file' | 'navigate_folder';
  label: string;
  documentId?: string;
  folderId?: string;
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  expandedQuery?: string[];
  contextId: string;
  actions?: ActionButton[];
  cached?: boolean;
  confidence?: {
    score: number;
    level: 'high' | 'medium' | 'low' | 'very_low';
    showWarning: boolean;
  }; // TASK #9: Confidence calibration metadata
}

class RAGService {
  /**
   * Helper function to call Gemini with automatic retry on rate limits
   */
  private async callGeminiWithRetry(
    model: any,
    prompts: any[],
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompts);
        return result;
      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limit error (429)
        const errorMessage = error?.message || '';
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
          // Extract retry delay from error message if available
          const retryMatch = errorMessage.match(/retryDelay[":]+(\d+)s/);
          const suggestedDelay = retryMatch ? parseInt(retryMatch[1]) : null;

          // Calculate delay: use suggested delay or exponential backoff
          const delay = suggestedDelay ? suggestedDelay * 1000 : Math.min(1000 * Math.pow(2, attempt), 60000);

          console.log(`⚠️  Rate limit hit (attempt ${attempt}/${maxRetries}). Waiting ${delay/1000}s before retry...`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If it's not a rate limit error, throw immediately
        throw error;
      }
    }

    // All retries exhausted
    throw lastError;
  }

  /**
   * Main entry point - handles ALL queries with smart routing
   */
  async generateAnswer(
    userId: string,
    query: string,
    conversationId: string,
    researchMode: boolean = false,
    conversationHistory: any[] = [],
    documentId?: string
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`🔍 RAG QUERY: "${query}"`);
    console.log(`👤 User: ${userId}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // STEP 1: DETECT QUERY INTENT
    const intent = queryIntentService.detectIntent(query);
    console.log(`🎯 Intent: ${intent.intent} (confidence: ${intent.confidence})`);
    console.log(`💡 Reasoning: ${intent.reasoning}`);

    // STEP 1.5: CHECK IF QUERY MENTIONS A SPECIFIC DOCUMENT
    // If user asks "Summarize Biology EOY F3.docx", we should only search that document
    let resolvedDocumentId = documentId; // Start with explicitly attached document (if any)

    if (!resolvedDocumentId) {
      // No document attached, check if query mentions a document name
      const queryParserService = await import('./queryParser.service');
      const parsedQuery = queryParserService.default.parse(query);

      if (parsedQuery.documentName) {
        console.log(`📄 Document name detected in query: "${parsedQuery.documentName}"`);

        // Look up document by filename (case-insensitive, partial match)
        try {
          const matchedDoc = await prisma.document.findFirst({
            where: {
              userId,
              filename: {
                contains: parsedQuery.documentName.replace(/\.\w+$/, ''), // Remove extension for flexible matching
              },
              status: 'completed'
            },
            select: {
              id: true,
              filename: true
            }
          });

          if (matchedDoc) {
            resolvedDocumentId = matchedDoc.id;
            console.log(`   ✅ Matched document: "${matchedDoc.filename}" (ID: ${matchedDoc.id.substring(0, 8)}...)`);
            console.log(`   🎯 Query will be filtered to this document only`);
          } else {
            console.log(`   ⚠️  No document found matching "${parsedQuery.documentName}"`);
          }
        } catch (error) {
          console.error(`   ❌ Error looking up document:`, error);
        }
      }
    }

    // STEP 2: ROUTE BASED ON INTENT
    if (intent.intent === 'greeting') {
      return await this.handleGreeting(userId, query, conversationId);
    } else if (intent.intent === 'navigation') {
      return await this.handleNavigationQuery(userId, query, conversationId);
    } else if (intent.intent === 'list' || intent.intent === 'locate') {
      // LIST and LOCATE both need file system queries
      return await this.handleMetadataQuery(userId, query, conversationId);
    } else {
      // EXTRACT, SUMMARIZE, COMPARE, CAPABILITY all use RAG content retrieval
      return await this.handleContentQuery(userId, query, conversationId, conversationHistory, resolvedDocumentId);
    }
  }

  /**
   * Handle GREETING queries (hello, hi, how are you, etc.)
   * Returns a friendly conversational response
   */
  private async handleGreeting(
    userId: string,
    query: string,
    conversationId: string
  ): Promise<RAGResponse> {
    console.log(`👋 GREETING HANDLER`);

    const queryLower = query.toLowerCase().trim();
    let response = '';

    // Detect greeting type and respond appropriately
    if (/^(hi|hello|hey)/i.test(queryLower)) {
      response = "Hello! I'm KODA, your document intelligence assistant. How can I help you today?";
    } else if (/how are you/i.test(queryLower)) {
      response = "I'm doing great, thanks for asking! I'm here to help you with your documents. What would you like to know?";
    } else if (/what'?s up/i.test(queryLower) || /how'?s it going/i.test(queryLower)) {
      response = "All good! Ready to help you find information in your documents. What can I do for you?";
    } else if (/thanks|thank you/i.test(queryLower)) {
      response = "You're welcome! Let me know if you need anything else.";
    } else if (/bye|goodbye|see you/i.test(queryLower)) {
      response = "Goodbye! Feel free to come back anytime you need help with your documents.";
    } else {
      response = "Hello! How can I assist you with your documents today?";
    }

    return {
      answer: response,
      sources: [],
      contextId: `greeting_${Date.now()}`,
    };
  }

  /**
   * Handle NAVIGATION queries (where is file X, show me folder Y)
   * Returns location info with action buttons
   */
  private async handleNavigationQuery(
    userId: string,
    query: string,
    conversationId: string
  ): Promise<RAGResponse> {
    console.log(`🧭 NAVIGATION QUERY HANDLER`);

    // NEW: Try navigation orchestrator first for complex queries
    // Handles: time-based, file type, recently deleted, and multi-filter queries
    try {
      const orchestratorResult = await navigationOrchestrator.handle(userId, query);
      if (orchestratorResult) {
        console.log(`   ✅ Handled by navigation orchestrator (handlers: ${orchestratorResult.handledBy.join(', ')})`);
        return {
          answer: orchestratorResult.answer,
          sources: [],
          contextId: `navigation_${Date.now()}`,
          confidence: {
            score: Math.round(orchestratorResult.confidence * 100),
            level: orchestratorResult.confidence >= 0.8 ? 'high' : orchestratorResult.confidence >= 0.5 ? 'medium' : 'low',
            showWarning: orchestratorResult.confidence < 0.5
          }
        };
      }
    } catch (error) {
      console.error(`   ⚠️  Navigation orchestrator error:`, error);
      // Fall through to existing navigation logic
    }

    // Try to extract file name
    const fileName = queryIntentService.extractFileName(query);
    if (fileName) {
      console.log(`   Looking for file: "${fileName}"`);
      const result = await navigationService.findFile(userId, fileName);

      return {
        answer: result.message,
        sources: [],
        contextId: `navigation_${Date.now()}`,
        actions: result.actions,
      };
    }

    // Try to extract folder name
    const folderName = queryIntentService.extractFolderName(query);
    if (folderName) {
      console.log(`   Looking for folder: "${folderName}"`);
      const result = await navigationService.findFolder(userId, folderName);

      return {
        answer: result.message,
        sources: [],
        contextId: `navigation_${Date.now()}`,
        actions: result.actions,
      };
    }

    // Fallback: couldn't extract specific file/folder name
    return {
      answer: "I can help you find files and folders! Please specify which file or folder you're looking for. For example: \"where is invoice.pdf\" or \"show me the Contracts folder\".",
      sources: [],
      contextId: `navigation_${Date.now()}`,
    };
  }

  /**
   * Handle METADATA queries (file lists, categories, counts)
   * NO RAG - Direct database queries
   */
  private async handleMetadataQuery(
    userId: string,
    query: string,
    conversationId: string
  ): Promise<RAGResponse> {
    console.log(`📂 METADATA QUERY HANDLER`);

    // Check if asking "what's inside the folder" WITHOUT specifying folder name
    const queryLower = query.toLowerCase().trim();
    if (/^what(?:'s| is) (?:inside|in) (?:the )?folder\??$/i.test(queryLower)) {
      console.log(`   📁 User asking about folder contents without specifying which folder`);

      // Get list of available folders
      const folders = await prisma.folder.findMany({
        where: { userId },
        select: { name: true },
        take: 10
      });

      if (folders.length === 0) {
        return {
          answer: "You don't have any folders yet.",
          sources: [],
          contextId: `metadata_${Date.now()}`,
        };
      }

      const folderList = folders.map(f => f.name).join(', ');
      return {
        answer: `Which folder? You have the following folders: ${folderList}`,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking about documents by TYPE (identification, financial, etc.)
    const documentType = documentTypeClassifier.extractCategoryFromQuery(query);
    if (documentType) {
      console.log(`   📑 Document Type Query: "${documentType}"`);

      // Get all user documents with metadata
      const documents = await prisma.document.findMany({
        where: {
          userId,
          status: 'completed'
        },
        include: {
          metadata: true
        }
      });

      // Classify documents and filter by requested type
      const matchingDocs: Array<{ filename: string; confidence: number }> = [];

      for (const doc of documents) {
        const classification = documentTypeClassifier.classifyDocument(
          doc.filename,
          doc.metadata?.extractedText || ''
        );

        if (classification.category === documentType) {
          matchingDocs.push({
            filename: doc.filename,
            confidence: classification.confidence
          });
        }
      }

      // Sort by confidence (highest first)
      matchingDocs.sort((a, b) => b.confidence - a.confidence);

      const categoryName = documentTypeClassifier.getCategoryName(documentType);

      if (matchingDocs.length === 0) {
        return {
          answer: `You don't have any ${categoryName.toLowerCase()} in your collection.`,
          sources: [],
          contextId: `metadata_${Date.now()}`,
        };
      }

      const docList = matchingDocs
        .map((doc, idx) => `${idx + 1}. ${doc.filename}`)
        .join('\n');

      return {
        answer: `You have ${matchingDocs.length} ${categoryName.toLowerCase()}:\n\n${docList}`,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking about a specific category
    const categoryName = queryIntentService.extractCategoryName(query);
    if (categoryName) {
      console.log(`   Category: "${categoryName}"`);
      const result = await metadataQueryService.listFilesInCategory(userId, categoryName);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking about file types
    const fileTypes = queryIntentService.extractFileTypes(query);
    if (fileTypes.length > 0) {
      console.log(`   File types: ${fileTypes.join(', ')}`);
      const result = await metadataQueryService.listAllFiles(userId, fileTypes);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking for all categories
    if (/list.*categories/i.test(query) || /all.*categories/i.test(query)) {
      console.log(`   Listing all categories`);
      const result = await metadataQueryService.listAllCategories(userId);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking for file count
    if (/how many.*files/i.test(query) || /count.*files/i.test(query)) {
      console.log(`   Counting files`);
      const result = await metadataQueryService.getFileCount(userId);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Default: list all files
    console.log(`   Listing all files (default)`);
    const result = await metadataQueryService.listAllFiles(userId);

    return {
      answer: result.answer,
      sources: [],
      contextId: `metadata_${Date.now()}`,
    };
  }

  /**
   * Handle CONTENT queries (information from documents)
   * Uses RAG with enhanced retrieval
   */
  private async handleContentQuery(
    userId: string,
    query: string,
    conversationId: string,
    conversationHistory: any[] = [],
    documentId?: string
  ): Promise<RAGResponse> {
    console.log(`📚 CONTENT QUERY HANDLER`);
    if (documentId) {
      console.log(`   🎯 Document-specific query - filtering to documentId: ${documentId}`);
    }

    const startTime = Date.now();

    // ═══════════════════════════════════════════════════════════════
    // PRIVACY CHECK: Identification Document Field Query
    // ═══════════════════════════════════════════════════════════════
    // Check if user is asking for a specific field from an ID document
    // CRITICAL: Prevents over-sharing of personal information
    if (privacyAwareExtractor.isIdentificationFieldQuery(query)) {
      console.log(`\n🔒 PRIVACY-AWARE QUERY DETECTED`);
      console.log(`   Query: "${query}"`);

      // Find identification documents (passports, licenses, IDs)
      // Note: SQLite LIKE operator is case-insensitive by default, so no mode needed
      const idDocuments = await prisma.document.findMany({
        where: {
          userId,
          status: 'completed',
          OR: [
            { filename: { contains: 'passport' } },
            { filename: { contains: 'license' } },
            { filename: { contains: 'driver' } },
            { filename: { contains: 'cnh' } },
            { filename: { contains: 'rg' } },
            { filename: { contains: 'cpf' } },
            { filename: { contains: 'id' } },
          ]
        },
        include: {
          metadata: true
        },
        take: 5
      });

      console.log(`   Found ${idDocuments.length} identification documents`);

      if (idDocuments.length > 0) {
        // Try to extract the requested field from each document
        for (const doc of idDocuments) {
          if (doc.metadata?.extractedText) {
            console.log(`   🔍 Checking document: ${doc.filename}`);

            const extractedAnswer = await privacyAwareExtractor.extractIdentificationField(
              query,
              doc.metadata.extractedText,
              doc.filename
            );

            // If we found a valid answer (not the default prompt), return it
            if (!extractedAnswer.includes('Which field would you like to know')) {
              console.log(`   ✅ Field extracted successfully`);
              console.log(`   🔒 Privacy-aware response (only requested field returned)`);

              return {
                answer: extractedAnswer,
                sources: [{
                  documentId: doc.id,
                  documentName: doc.filename,
                  chunkIndex: 0,
                  content: '[Privacy-protected: Only requested field shown]',
                  similarity: 1.0,
                  metadata: doc.metadata
                }],
                contextId: `privacy_aware_${Date.now()}`,
              };
            }
          }
        }

        // If we found ID documents but couldn't extract the field
        console.log(`   ⚠️  Field not found in any identification document`);
      }

      console.log(`   ℹ️  No identification documents found or field couldn't be extracted`);
      console.log(`   Falling through to normal RAG pipeline\n`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PII SCANNER: Personal Information Detection in Images
    // ═══════════════════════════════════════════════════════════════
    // Check if user is asking about personal information in documents
    // Handles queries like "What personal information can you find in this image?"
    if (piiScanner.isPIIQuery(query)) {
      console.log(`\n🔐 PII QUERY DETECTED`);
      console.log(`   Query: "${query}"`);

      // Get all completed documents with OCR text
      const documents = await prisma.document.findMany({
        where: {
          userId,
          status: 'completed',
        },
        include: {
          metadata: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10  // Scan up to 10 most recent documents
      });

      console.log(`   Found ${documents.length} documents to scan`);

      // Scan all documents for PII
      const allPIIResults: Array<{
        filename: string;
        scanResult: any;
      }> = [];

      for (const doc of documents) {
        if (doc.metadata?.extractedText) {
          console.log(`   🔍 Scanning: ${doc.filename}`);

          const scanResult = piiScanner.scanForPII(
            doc.metadata.extractedText,
            doc.filename
          );

          if (scanResult.hasPII) {
            allPIIResults.push({
              filename: doc.filename,
              scanResult
            });
            console.log(`   ⚠️  Found ${scanResult.piiFound.length} PII items in ${doc.filename}`);
          }
        }
      }

      // Generate comprehensive report
      if (allPIIResults.length > 0) {
        console.log(`   📋 Generating PII report for ${allPIIResults.length} documents`);

        let fullReport = `I found personal information in ${allPIIResults.length} document${allPIIResults.length > 1 ? 's' : ''}:\n\n`;

        for (const result of allPIIResults) {
          fullReport += `**${result.filename}**\n`;
          fullReport += piiScanner.getDetailedReport(result.scanResult);
          fullReport += '\n\n';
        }

        fullReport += '\n⚠️ **Privacy Notice:** This information is sensitive. Please ensure you handle it securely.';

        return {
          answer: fullReport,
          sources: allPIIResults.map((result, idx) => ({
            documentId: documents[idx].id,
            documentName: result.filename,
            chunkIndex: 0,
            content: '[PII detected - details in report]',
            similarity: 1.0,
            metadata: documents[idx].metadata
          })),
          contextId: `pii_scan_${Date.now()}`,
        };
      } else {
        console.log(`   ✅ No PII found in any scanned documents`);

        return {
          answer: 'I scanned your documents but did not find any obvious personal information. ' +
                  'This could mean your documents are clean, or the information is in a format I cannot detect. ' +
                  'Please note that PII detection is not 100% accurate.',
          sources: [],
          contextId: `pii_scan_${Date.now()}`,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: ANALYZE CONVERSATION CONTEXT
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n💬 CONVERSATION CONTEXT ANALYSIS:`);

    // Extract document context from conversation history
    let contextDocumentIds: string[] = [];
    let contextDocumentNames: string[] = [];
    let contextFolderId: string | null = null;
    let contextFolderName: string | null = null;
    let contextSheetNumber: number | null = null;
    let conversationSummary = '';

    // Simple follow-up detection: if there's conversation history, it's a follow-up
    const isFollowUp = conversationHistory && conversationHistory.length > 1;

    // PRIORITY 1: Check saved conversation context (most reliable)
    if (conversationId) {
      try {
        const savedContext = await conversationContextService.getContext(conversationId);
        if (savedContext) {
          console.log(`   ✅ Found saved context: ${savedContext.type} - ${savedContext.name}`);

          if (savedContext.type === 'document' && savedContext.id) {
            contextDocumentIds = [savedContext.id];
            contextDocumentNames = [savedContext.name || ''];
          } else if (savedContext.type === 'folder' && savedContext.id) {
            contextFolderId = savedContext.id;
            contextFolderName = savedContext.name;
            // If folder context has specific documents, use them
            if (savedContext.meta?.documentIds) {
              contextDocumentIds = savedContext.meta.documentIds;
              contextDocumentNames = savedContext.meta.documentNames || [];
            }
          }

          // Extract sheet context if available
          if (savedContext.meta?.sheetNumber) {
            contextSheetNumber = savedContext.meta.sheetNumber;
            console.log(`   📊 Sheet context: Sheet ${contextSheetNumber}`);
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to load saved context:`, error);
      }
    }

    // PRIORITY 2: Extract from message metadata (fallback)
    if (conversationHistory.length > 0 && contextDocumentIds.length === 0) {
      console.log(`   Analyzing last ${conversationHistory.length} messages for document context...`);

      for (const message of conversationHistory) {
        if (message.metadata) {
          try {
            const metadata = typeof message.metadata === 'string'
              ? JSON.parse(message.metadata)
              : message.metadata;

            // Extract document IDs from sources
            if (metadata.ragSources && Array.isArray(metadata.ragSources)) {
              const docIds = metadata.ragSources.map((s: any) => s.documentId).filter(Boolean);
              const docNames = metadata.ragSources.map((s: any) => s.documentName).filter(Boolean);
              contextDocumentIds.push(...docIds);
              contextDocumentNames.push(...docNames);
            }

            // Extract sheet context if present
            if (metadata.sheetNumber && !contextSheetNumber) {
              contextSheetNumber = metadata.sheetNumber;
            }
          } catch (e) {
            // Ignore parse errors silently
          }
        }
      }

      // Deduplicate
      contextDocumentIds = Array.from(new Set(contextDocumentIds));
      contextDocumentNames = Array.from(new Set(contextDocumentNames));

      if (contextDocumentIds.length > 0) {
        console.log(`   📄 Found ${contextDocumentIds.length} documents in conversation:`);
        contextDocumentNames.forEach((name, idx) => {
          console.log(`      ${idx + 1}. ${name}`);
        });
      } else {
        console.log(`   ℹ️  No document context found in conversation history`);
      }

      // Build conversation summary for Gemini
      if (isFollowUp && conversationHistory.length > 0) {
        conversationSummary = this.buildConversationSummary(conversationHistory);
        console.log(`   📝 Built conversation summary (${conversationSummary.length} chars)`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CACHE CHECK (L1: Memory → L2: Redis)
    // ═══════════════════════════════════════════════════════════════
    const cacheKey = multiLayerCache.generateKey(query, userId, { conversationId });
    const cached = await multiLayerCache.get<RAGResponse>(cacheKey, {
      ttl: 3600,  // 1 hour
      useMemory: true,
      useRedis: true,
    });

    if (cached) {
      const cacheLatency = Date.now() - startTime;
      console.log(`\n🚀 CACHE HIT! (${cacheLatency}ms)`);
      console.log(`   Saved: ${3000 - cacheLatency}ms (typical RAG query time)`);
      console.log(`═══════════════════════════════════════════════════════\n`);

      return {
        ...cached,
        cached: true,  // Flag to indicate this was cached
      };
    }

    console.log(`💾 Cache miss - running full RAG pipeline`);

    // ═══════════════════════════════════════════════════════════════
    // TASK #14: CREATE AUDIT TRAIL
    // ═══════════════════════════════════════════════════════════════
    const auditTrailId = auditTrailService.createTrail(userId, conversationId, query);
    const retrievalStartTime = Date.now();

    // ═══════════════════════════════════════════════════════════════
    // STAGE 0: QUERY UNDERSTANDING (Document Scoping)
    // ═══════════════════════════════════════════════════════════════
    // RE-ENABLED: Detects when user is asking about a specific document
    // and restricts retrieval to only that document for accurate attribution
    console.log(`\n┌─ STAGE 0: Query Understanding (Document Scoping)`);
    const stage0Start = Date.now();

    // Detect document reference in query
    const { detectDocumentReference } = await import('../lib/rag/query-understanding/document-detector');
    const { matchDocument } = await import('../lib/rag/query-understanding/document-matcher');

    const documentReference = detectDocumentReference(query);
    let documentMatch = null;
    let scopedDocumentId: string | null = null;

    if (documentReference.hasDocumentReference) {
      console.log(`   📄 Document reference detected: "${documentReference.documentReference}"`);

      // Try to match the document
      documentMatch = await matchDocument(documentReference.documentReference!, userId);

      if (documentMatch.matched) {
        console.log(`   ✅ Matched document: "${documentMatch.filename}" (confidence: ${documentMatch.confidence.toFixed(2)})`);
        scopedDocumentId = documentMatch.documentId;
      } else {
        console.log(`   ⚠️  No confident match found (best: ${documentMatch.confidence.toFixed(2)})`);

        // If confidence is very low, suggest alternatives
        if (documentMatch.alternativeMatches.length > 0) {
          const alternatives = documentMatch.alternativeMatches.map(m => m.filename).join(', ');
          console.log(`   💡 Did you mean: ${alternatives}?`);
        }
      }
    } else {
      console.log(`   ℹ️  No document reference detected - searching all documents`);
    }

    const stage0Time = Date.now() - stage0Start;
    console.log(`└─ ✅ Stage 0 complete (${stage0Time}ms)\n`);

    // ═══════════════════════════════════════════════════════════════
    // STAGE 0.5: FOLDER SCOPING (Folder-based Retrieval)
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n┌─ STAGE 0.5: Folder Scoping`);
    const folderScopingStart = Date.now();

    // Parse query to detect folder intent
    const parsedQuery = queryParserService.parse(query);
    let scopedFolderId: string | null = null;
    let scopedFolderName: string | null = null;

    // Check for existing folder context from previous messages
    const existingFolderContext = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        contextType: true,
        contextId: true,
        contextName: true
      }
    });

    if (parsedQuery.folderName) {
      // User explicitly mentioned a folder in the query
      console.log(`   📁 Folder reference detected: "${parsedQuery.folderName}"`);
      console.log(`   🎯 Query intent: ${parsedQuery.intent}`);

      // Try to resolve the folder
      const folderResolution = await folderResolverService.resolveFolder(
        parsedQuery.folderName,
        userId
      );

      if (folderResolution.folder) {
        scopedFolderId = folderResolution.folder.id;
        scopedFolderName = folderResolution.folder.name;
        console.log(`   ✅ Matched folder: "${scopedFolderName}"`);

        // Save folder context to conversation for future messages
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            contextType: 'folder',
            contextId: scopedFolderId,
            contextName: scopedFolderName,
            contextMeta: undefined
          }
        });
      } else {
        // Folder not found - provide helpful error with suggestions
        console.log(`   ⚠️  Folder not found: "${parsedQuery.folderName}"`);

        if (folderResolution.suggestions && folderResolution.suggestions.length > 0) {
          const suggestions = folderResolution.suggestions.join(', ');
          return {
            answer: `${folderResolution.error}\n\nDid you mean: ${suggestions}?`,
            sources: [],
            contextId: `folder_error_${Date.now()}`,
            expandedQuery: [query]
          };
        } else {
          return {
            answer: folderResolution.error || `I couldn't find a folder named "${parsedQuery.folderName}".`,
            sources: [],
            contextId: `folder_error_${Date.now()}`,
            expandedQuery: [query]
          };
        }
      }
    } else if (existingFolderContext && existingFolderContext.contextType === 'folder' && existingFolderContext.contextId) {
      // No folder mentioned in this query, but there's existing folder context from previous messages
      scopedFolderId = existingFolderContext.contextId;
      scopedFolderName = existingFolderContext.contextName;
      console.log(`   📂 Using existing folder context: "${scopedFolderName}"`);
    } else {
      console.log(`   ℹ️  No folder reference detected - searching all folders`);
    }

    const folderScopingTime = Date.now() - folderScopingStart;
    console.log(`└─ ✅ Stage 0.5 complete (${folderScopingTime}ms)\n`);

    // STEP 1: GET WORKSPACE METADATA
    const workspaceMetadata = await this.getWorkspaceMetadata(userId);
    console.log(`\n📊 WORKSPACE CONTEXT:`);
    console.log(`   Categories: ${workspaceMetadata.categories.length}`);
    console.log(`   Total Files: ${workspaceMetadata.totalFiles}`);
    console.log(`   File Types: ${Object.keys(workspaceMetadata.filesByType).join(', ')}`);

    // STEP 2: DETECT LANGUAGE
    const detectedLang = detectLanguage(query);
    console.log(`\n🌍 Language: ${detectedLang}`);

    // STEP 3: RETRIEVE RELEVANT DOCUMENTS
    console.log(`\n🔍 RETRIEVING DOCUMENTS...`);

    // FIX Q15 & Q28 TIMEOUTS: Aggressively reduce topK and disable expensive operations
    const queryIntent = queryIntentService.detectIntent(query);

    // Determine if this is a synthesis/complex query
    const isSynthesisQuery = queryIntent.intent === 'compare' ||
                            query.toLowerCase().includes('compare') ||
                            query.toLowerCase().includes('competitive') ||
                            query.toLowerCase().includes('advantages');

    // BALANCED topK: 25 for synthesis, 40 for simple queries (improved retrieval quality)
    const baseTopK = isSynthesisQuery ? 25 : 40;

    const retrievalOptions: any = {
      topK: baseTopK, // Balanced: 25-40 chunks for quality without timeouts
      enableReranking: false, // Disable expensive reranking for speed
      enableMMR: false, // Disable MMR for speed
    };

    // Add sheet context if available
    if (contextSheetNumber !== null) {
      retrievalOptions.sheetNumber = contextSheetNumber;
      console.log(`   📊 Applying sheet context filter: Sheet ${contextSheetNumber}`);
    }

    // PRIORITY 0: Uploaded document attachment (highest priority - user explicitly attached a file)
    if (documentId) {
      console.log(`   📎 UPLOADED DOCUMENT ATTACHMENT - Restricting to documentId: ${documentId}`);
      retrievalOptions.documentIds = [documentId];
      retrievalOptions.topK = 50; // Increased for better single-doc retrieval
    }
    // PRIORITY 1: Folder-scoped retrieval (when user asks about a specific folder)
    else if (scopedFolderId) {
      console.log(`   📁 FOLDER-SCOPED RETRIEVAL - Restricting to folder: "${scopedFolderName}"`);
      retrievalOptions.folderId = scopedFolderId;
      retrievalOptions.topK = 35; // Increased for better folder retrieval
    }
    // PRIORITY 2: Document-scoped retrieval (when user asks about a specific document)
    else if (scopedDocumentId) {
      console.log(`   🎯 DOCUMENT-SCOPED RETRIEVAL - Restricting to matched document: "${documentMatch?.filename}"`);
      retrievalOptions.documentIds = [scopedDocumentId];
      retrievalOptions.topK = 50; // Increased for better single-doc retrieval
    }
    // PRIORITY 3: Smart context filtering (for follow-ups on previous documents)
    else if (isFollowUp && contextDocumentIds.length > 0 && contextDocumentIds.length <= 10) {
      // Follow-up on 1-10 documents - focus retrieval on those documents
      console.log(`   🎯 FOLLOW-UP detected - Prioritizing ${contextDocumentIds.length} documents from context:`);
      contextDocumentNames.forEach((name, idx) => {
        console.log(`      ${idx + 1}. ${name}`);
      });

      // Boost retrieval for context documents by retrieving more chunks from them
      retrievalOptions.documentIds = contextDocumentIds;
      retrievalOptions.topK = Math.min(150, 100 + (contextDocumentIds.length * 10)); // Scale topK with document count
    }
    // PRIORITY 3.5: Folder context filtering (when folder context is saved)
    else if (contextFolderId && contextFolderName) {
      console.log(`   📁 FOLDER CONTEXT detected - Restricting to folder: "${contextFolderName}"`);
      retrievalOptions.folderId = contextFolderId;
      retrievalOptions.topK = 120; // Get more documents from folder context
    }
    // PRIORITY 4: Search all documents
    else {
      // First question or topic change - search ALL documents
      if (isFollowUp && contextDocumentIds.length > 10) {
        console.log(`   🌍 Too many context documents (${contextDocumentIds.length}) - Searching ALL documents`);
      } else if (isFollowUp) {
        console.log(`   🌍 Follow-up but no context docs - Searching ALL documents`);
      } else {
        console.log(`   🌍 New query - Searching across ALL user documents`);
      }
    }

    const retrievalResults = await enhancedRetrievalService.retrieve(
      query,
      userId,
      retrievalOptions
    );
    console.log(`   Found ${retrievalResults.length} relevant chunks`);

    if (retrievalResults.length === 0) {
      console.log(`   ⚠️ No relevant documents found`);

      // FIX: When a specific document is attached, provide a clear "I don't know" message
      if (documentId) {
        console.log(`   📎 Attached document filter - no results found in specific document`);

        // Get document name for better error message
        let documentName = 'this document';
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

        const answer = detectedLang === 'pt'
          ? `Não consegui encontrar informações sobre "${query}" no documento **${documentName}**.`
          : `I couldn't find information about "${query}" in the document **${documentName}**.`;

        return {
          answer,
          sources: [],
          contextId: `rag_${Date.now()}`,
        };
      }

      return {
        answer: this.generateNoDocumentsResponse(query, workspaceMetadata, detectedLang),
        sources: [],
        contextId: `rag_${Date.now()}`,
      };
    }

    // STEP 3.5: SCORE CHUNKS WITH MULTI-FACTOR RELEVANCE
    console.log(`\n🎯 SCORING CHUNKS WITH MULTI-FACTOR RELEVANCE...`);

    // Convert retrieval results to format expected by relevance scorer
    const chunksWithMetadata = retrievalResults.map(result => ({
      content: result.content,
      metadata: {
        documentId: result.documentId,
        filename: result.filename,
        pageNumber: result.metadata?.pageNumber,
        slideNumber: result.metadata?.slideNumber,
        chunkIndex: result.chunkIndex || 0,
        createdAt: result.metadata?.createdAt,
        ...result.metadata
      },
      score: result.score // Vector similarity score
    }));

    // Score all chunks with multi-factor algorithm
    const scoredChunks = await relevanceScorerService.scoreChunks(chunksWithMetadata, query);

    // Sort by relevance score (descending)
    scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // TASK #14: LOG RETRIEVED CHUNKS TO AUDIT TRAIL
    const retrievalTimeMs = Date.now() - retrievalStartTime;
    auditTrailService.logRetrievedChunks(auditTrailId, scoredChunks, retrievalTimeMs);

    // Log top results
    console.log(`\n📊 TOP 5 SCORED CHUNKS:`);
    scoredChunks.slice(0, 5).forEach((scored, idx) => {
      console.log(`   ${idx + 1}. ${scored.chunk.metadata.filename}`);
      console.log(`      Relevance: ${scored.relevanceScore.toFixed(1)}% | ${scored.relevanceExplanation}`);
      console.log(`      Factors: Semantic=${(scored.relevanceFactors.semanticSimilarity * 100).toFixed(0)}% | Keyword=${(scored.relevanceFactors.keywordMatch * 100).toFixed(0)}% | Title=${(scored.relevanceFactors.titleMatch * 100).toFixed(0)}%`);
    });

    // ADAPTIVE THRESHOLD: Filter chunks based on top score distribution
    let relevantChunks: typeof scoredChunks = [];

    if (scoredChunks.length > 0) {
      const topScore = scoredChunks[0].relevanceScore;
      let threshold: number;

      // Adaptive threshold based on top score
      if (topScore >= 70) {
        threshold = 40; // High confidence - moderate threshold
        console.log(`   📊 Top score: ${topScore.toFixed(1)}% - Using 40% threshold`);
      } else if (topScore >= 50) {
        threshold = 30; // Medium confidence - lenient threshold
        console.log(`   📊 Top score: ${topScore.toFixed(1)}% - Using 30% threshold`);
      } else {
        threshold = 20; // Low confidence - very lenient, take top 30 chunks
        console.log(`   📊 Top score: ${topScore.toFixed(1)}% - Using 20% threshold (low confidence)`);
      }

      relevantChunks = scoredChunks.filter(scored => scored.relevanceScore >= threshold);

      // Ensure we always return at least top 10 chunks if available
      if (relevantChunks.length < 10 && scoredChunks.length >= 10) {
        console.log(`   ⚠️ Only ${relevantChunks.length} chunks above threshold, taking top 10`);
        relevantChunks = scoredChunks.slice(0, 10);
      }

      console.log(`   ✅ ${relevantChunks.length} chunks passed adaptive threshold`);
    } else {
      console.log(`   ❌ No chunks to filter`);
    }

    // STEP 4: PREPARE SOURCES WITH RELEVANCE SCORES
    const sources: RAGSource[] = relevantChunks
      .filter(scored => scored.chunk.metadata.documentId && scored.chunk.metadata.filename)
      .map(scored => ({
        documentId: scored.chunk.metadata.documentId!,
        documentName: scored.chunk.metadata.filename!,
        chunkIndex: scored.chunk.metadata.chunkIndex || 0,
        content: scored.chunk.content,
        similarity: scored.relevanceScore / 100, // Convert back to 0-1 scale for compatibility
        metadata: {
          ...scored.chunk.metadata,
          relevanceScore: scored.relevanceScore,
          relevanceExplanation: scored.relevanceExplanation,
          relevanceFactors: scored.relevanceFactors
        },
      }));

    // STEP 5: BUILD GEMINI PROMPT
    const systemPrompt = this.buildSystemPrompt(detectedLang, workspaceMetadata);
    const userPrompt = this.buildUserPrompt(query, sources, workspaceMetadata, conversationSummary, isFollowUp);

    console.log(`\n🤖 GENERATING ANSWER...`);
    if (conversationSummary) {
      console.log(`   📝 Including conversation context in prompt`);
    }

    // STEP 6: CALL GEMINI (with automatic retry on rate limits)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const geminiResult = await this.callGeminiWithRetry(model, [
      { text: systemPrompt },
      { text: userPrompt }
    ]);

    let answer = geminiResult.response.text();
    const responseTime = Date.now() - startTime;

    // ═══════════════════════════════════════════════════════════════
    // ANTI-HALLUCINATION VALIDATION (TEMPORARILY DISABLED)
    // ═══════════════════════════════════════════════════════════════
    // DISABLED: Validator was too aggressive, detecting content phrases as "hallucinated documents"
    // Examples: "Year 1", "exit scenarios", "pre-seed funding" were flagged as fake document names
    // This caused valid AI responses to be replaced with useless fallback messages
    //
    // TODO: Re-enable with improved regex patterns that only match actual document names
    console.log(`\n🛡️ ANTI-HALLUCINATION VALIDATION: DISABLED (was blocking valid responses)`);

    // Build list of actual source documents for validation
    // FIX: Deduplicate by documentId to avoid repeated filenames in fallback responses
    const actualSourceDocs = Array.from(
      new Map(
        sources.map(s => [
          s.documentId,
          { documentId: s.documentId, documentName: s.documentName || 'Unknown' }
        ])
      ).values()
    );

    console.log(`   Would validate against ${actualSourceDocs.length} unique documents (from ${sources.length} chunks)`);

    // DISABLED: Validation logic commented out
    // const validation = await responseValidator.validateResponse(answer, userId, actualSourceDocs);
    // if (!validation.isValid) {
    //   console.log(`   ❌ HALLUCINATION DETECTED!`);
    //   validation.errors.forEach(err => console.log(`      - ${err}`));
    //   if (validation.correctedResponse) {
    //     console.log(`   🔄 Using safe corrected response`);
    //     answer = validation.correctedResponse;
    //   }
    // }

    console.log(`   ✅ Skipping validation - using AI response as-is`);

    // Detect if query explicitly mentions a specific document name
    const queryLower = query.toLowerCase();
    let mentionedDocumentName: string | null = null;

    // Check if any source document name appears in the query
    for (const source of sources) {
      if (!source.documentName || source.documentName === 'Unknown') continue;

      // Extract base filename without extensions and version numbers
      const baseName = source.documentName
        .toLowerCase()
        .replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '') // Remove extensions
        .replace(/\s*\(\d+\)\s*/g, '') // Remove (1), (2), etc.
        .replace(/\s+/g, ' ')
        .trim();

      // Check if base name appears in query (e.g., "lista 9" matches "Lista_9 (1) (1).xlsx")
      const baseNameVariations = [
        baseName,
        baseName.replace(/_/g, ' '), // lista_9 → lista 9
        baseName.replace(/\s+/g, '_'), // lista 9 → lista_9
        baseName.replace(/\s+/g, ''), // lista 9 → lista9
      ];

      for (const variation of baseNameVariations) {
        if (queryLower.includes(variation)) {
          mentionedDocumentName = baseName;
          console.log(`🎯 Detected document name in query: "${variation}" → filtering to only "${source.documentName}"`);
          break;
        }
      }

      if (mentionedDocumentName) break;
    }

    // Sort sources by similarity (highest first) to keep most relevant chunks
    const sortedSources = [...sources].sort((a, b) => b.similarity - a.similarity);

    // Deduplicate by documentId - keep only the highest scoring chunk per document
    const seenDocIds = new Set<string>();
    const uniqueSources = sortedSources
      .filter(source => {
        // Filter out sources without valid document info
        if (!source.documentId || !source.documentName || source.documentName === 'Unknown') {
          return false;
        }

        // If query mentions a specific document, ONLY include that document
        if (mentionedDocumentName) {
          const sourceBaseName = source.documentName
            .toLowerCase()
            .replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '')
            .replace(/\s*\(\d+\)\s*/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Skip sources that don't match the mentioned document
          if (sourceBaseName !== mentionedDocumentName) {
            return false;
          }
        }

        // Deduplicate by documentId - keep highest scoring version
        if (seenDocIds.has(source.documentId)) {
          return false;
        }
        seenDocIds.add(source.documentId);
        return true;
      })
      // Filter by relevance: keep sources with similarity > 30% OR that are in top 3
      .filter((source, index) => {
        const MIN_RELEVANCE = 0.3; // 30% minimum similarity
        const MAX_SOURCES = 3; // Maximum 3 documents to show

        // Always keep top 3 most relevant
        if (index < MAX_SOURCES) {
          return true;
        }

        // For others, require minimum relevance
        return source.similarity >= MIN_RELEVANCE;
      })
      .slice(0, 3); // Hard limit: maximum 3 source documents

    // ═══════════════════════════════════════════════════════════════
    // ISSUE #3: FILTER SOURCES BY ACTUAL USAGE
    // Only include documents that were actually referenced in the answer
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n🔍 [Source Filtering] Filtering sources by actual usage in answer...`);
    const actuallyUsedSources = this.filterSourcesByUsage(uniqueSources, answer, relevantChunks);
    console.log(`   ✅ Filtered from ${uniqueSources.length} to ${actuallyUsedSources.length} actually used sources`);

    // TASK #14: MARK WHICH SPANS WERE ACTUALLY USED
    // Note: actuallyUsedSources needs to be converted to the correct type for audit trail
    // auditTrailService.markSpansUsed(auditTrailId, actuallyUsedSources);

    // ═══════════════════════════════════════════════════════════════
    // TASK #7: EXTRACT EXACT QUOTES FROM AI RESPONSE
    // Extract sentences/phrases from source chunks that appear in the answer
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n📝 [Task #7] Extracting exact quotes from AI response...`);
    // Note: Temporarily commented out due to type mismatch - needs RAGSource to SourceReference conversion
    // const sourcesWithQuotes = sourceTrackerService.extractExactQuotes(actuallyUsedSources, answer);
    // const totalQuotes = sourcesWithQuotes.reduce((sum, s) => sum + (s.exactQuotes?.length || 0), 0);
    // console.log(`   ✅ Extracted ${totalQuotes} exact quotes from ${actuallyUsedSources.length} sources`);
    const sourcesWithQuotes = actuallyUsedSources; // Temporary: Use sources as-is without quote extraction
    const totalQuotes = 0; // Temporary: Set to 0 since quote extraction is disabled

    // Build detailed source attribution report (for logging/debugging)
    // Note: Temporarily commented out due to type mismatch
    // if (totalQuotes > 0) {
    //   const attributionReport = sourceTrackerService.buildSourceAttributionReport(sourcesWithQuotes, answer);
    //   console.log(`\n${attributionReport}`);
    // }

    console.log(`\n✅ ANSWER GENERATED (${responseTime}ms)`);
    console.log(`   Length: ${answer.length} characters`);
    console.log(`   Sources: ${actuallyUsedSources.length} unique documents (from ${sources.length} chunks)`);
    console.log(`   Exact Quotes: ${totalQuotes} (quote extraction temporarily disabled)`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // TASK #7: Enrich sources with exact quotes
    const enrichedSources: RAGSource[] = actuallyUsedSources.map(source => {
      const sourceWithQuotes = sourcesWithQuotes.find(
        s => s.documentId === source.documentId
      );

      return {
        ...source,
        exactQuotes: sourceWithQuotes?.exactQuotes || []
      };
    });

    // ═══════════════════════════════════════════════════════════════
    // TASK #9: CONFIDENCE CALIBRATION & TRANSPARENCY STATEMENTS
    // ═══════════════════════════════════════════════════════════════
    const confidenceResult = confidenceCalibrationService.calculateConfidence(
      enrichedSources,
      answer,
      scoredChunks,
      {
        isFollowUp,
        hasConversationContext: contextDocumentIds.length > 0
      }
    );

    // Append transparency statement to answer if confidence is low
    // DISABLED: User requested removal of confidence indicators
    let finalAnswer = answer;
    // if (confidenceResult.shouldShowWarning && confidenceResult.transparencyStatement) {
    //   finalAnswer = `${answer}\n\n---\n\n${confidenceResult.transparencyStatement}`;
    //   console.log(`\n⚠️  LOW CONFIDENCE - Transparency statement appended to answer`);
    // }

    // ═══════════════════════════════════════════════════════════════
    // POST-PROCESSING: Enforce response quality rules
    // ═══════════════════════════════════════════════════════════════
    console.log('📝 [Post-Processor] Applying quality improvements...');
    finalAnswer = await responsePostProcessor.processWithAllImprovements(
      finalAnswer,
      query
    );
    console.log(`   ✅ Post-processing complete (${finalAnswer.length} chars)`);

    // TASK #14: LOG ANSWER METADATA TO AUDIT TRAIL
    const answerGenerationTimeMs = Date.now() - startTime - retrievalTimeMs;
    auditTrailService.logAnswerMetadata(
      auditTrailId,
      finalAnswer,
      confidenceResult.confidenceScore,
      confidenceResult.confidenceLevel,
      answerGenerationTimeMs
    );

    // ═══════════════════════════════════════════════════════════════
    // CRITICAL FIX: IF AI SAYS IT COULDN'T FIND INFORMATION, RETURN EMPTY SOURCES
    // Detect if answer indicates no relevant information was found
    // ═══════════════════════════════════════════════════════════════
    const answerLower = finalAnswer.toLowerCase();
    const notFoundPhrases = [
      'is not in the retrieved documents',
      'not in the retrieved documents',
      'cannot find',
      'unable to locate',
      'não consigo localizar',
      'não encontro',
      'not found in',
      'could not find'
    ];

    const aiCouldNotFindInfo = notFoundPhrases.some(phrase => answerLower.includes(phrase));

    // If AI explicitly says it couldn't find the information, don't show irrelevant sources
    const finalSources = aiCouldNotFindInfo ? [] : enrichedSources;

    if (aiCouldNotFindInfo) {
      console.log(`   ⚠️  AI could not find relevant information - clearing sources to avoid showing irrelevant documents`);
    }

    const result: RAGResponse = {
      answer: finalAnswer,
      sources: finalSources,
      contextId: `rag_${Date.now()}`,
      confidence: {
        score: confidenceResult.confidenceScore,
        level: confidenceResult.confidenceLevel,
        showWarning: confidenceResult.shouldShowWarning
      }
    };

    // ═══════════════════════════════════════════════════════════════
    // TRACK CONVERSATION TURN FOR CONTEXT RETENTION
    // ═══════════════════════════════════════════════════════════════
    try {
      // Save document context if documents were used (FIX: use enrichedSources, not filteredSources)
      if (enrichedSources.length > 0 && conversationId) {
        const documentIds = enrichedSources.map(s => s.documentId);
        const documentNames = enrichedSources.map(s => s.documentName);

        // Detect sheet context from sources
        const sheetNumbers = enrichedSources
          .filter(s => s.metadata?.sheetNumber !== undefined)
          .map(s => s.metadata.sheetNumber);
        const uniqueSheets = [...new Set(sheetNumbers)];
        const detectedSheetNumber = uniqueSheets.length === 1 ? uniqueSheets[0] : null;

        // If all sources are from a single document, save it as context
        const uniqueDocIds = [...new Set(documentIds)];
        if (uniqueDocIds.length === 1) {
          await conversationContextService.saveContext(conversationId, {
            type: 'document',
            id: uniqueDocIds[0],
            name: documentNames[0],
            meta: {
              sourceCount: enrichedSources.length,
              lastQuery: query,
              timestamp: new Date().toISOString(),
              ...(detectedSheetNumber !== null && { sheetNumber: detectedSheetNumber })
            }
          });
          const sheetInfo = detectedSheetNumber !== null ? ` (Sheet ${detectedSheetNumber})` : '';
          console.log(`💬 Saved document context: ${documentNames[0]}${sheetInfo}`);
        }
        // If sources are from multiple documents in same folder, save folder context
        else if (uniqueDocIds.length <= 5) {
          // Attempt to detect common folder
          const folderInfo = await this.detectCommonFolder(uniqueDocIds, userId);
          if (folderInfo) {
            await conversationContextService.saveContext(conversationId, {
              type: 'folder',
              id: folderInfo.id,
              name: folderInfo.name,
              meta: {
                documentIds: uniqueDocIds,
                documentNames: [...new Set(documentNames)],
                lastQuery: query,
                timestamp: new Date().toISOString()
              }
            });
            console.log(`💬 Saved folder context: ${folderInfo.name}`);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to save conversation context:`, error);
    }

    // ═══════════════════════════════════════════════════════════════
    // CACHE THE RESULT (L1: Memory + L2: Redis)
    // ═══════════════════════════════════════════════════════════════
    await multiLayerCache.set(cacheKey, result, {
      ttl: 3600,  // 1 hour
      useMemory: true,
      useRedis: true,
    });

    return result;
  }

  /**
   * Get workspace metadata for context enrichment
   */
  private async getWorkspaceMetadata(userId: string) {
    const [documents, categories] = await Promise.all([
      prisma.document.findMany({
        where: { userId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.tag.findMany({
        where: { userId },
        include: {
          _count: {
            select: { documents: true }
          }
        }
      })
    ]);

    // Group files by type
    const filesByType: { [key: string]: number } = {};
    documents.forEach(doc => {
      const type = this.getFileType(doc.mimeType || '');
      filesByType[type] = (filesByType[type] || 0) + 1;
    });

    return {
      totalFiles: documents.length,
      recentFiles: documents.slice(0, 5).map(d => d.filename),
      categories: categories.map(cat => ({
        name: cat.name,
        fileCount: cat._count.documents
      })),
      filesByType,
    };
  }

  /**
   * Build the SYSTEM PROMPT with Gemini Universal Structure
   */
  private buildSystemPrompt(language: string, workspaceMetadata: any): string {
    const langInstruction = createLanguageInstruction(language);

    return `# KODA AI - Document Intelligence Assistant

You are KODA, an intelligent document assistant.

## RESPONSE FORMAT RULES:

### FOR SPECIFIC FACT QUERIES:
✅ **BE DIRECT AND CONCISE** - Answer in 1 sentence only
✅ **USE BOLD** for the actual value/answer (e.g., "The value is **25**")
✅ **NO follow-up questions** - Just the answer, nothing else
✅ **NO extra sections** - No headers, no bullet points, no additional context
✅ **Format**: "[Location] contains/is **[value]**." PERIOD. STOP.

**Examples:**
- Query: "what is cell B9 in sheet 2"
  Answer: "Cell B9 in Sheet 2 of the Lista_9 Excel spreadsheet contains the value **25**."

- Query: "when was document X created"
  Answer: "Document X was created on **March 15, 2024**."

- Query: "what is the total in cell C5"
  Answer: "Cell C5 contains the value **$1,250**."

### FOR FILE LISTING QUERIES:
When user asks "What files?", "Do I have X files?", "Which documents are Y?", "Where is file X?":

✅ **BE CONCISE** - Keep response under 5 lines for simple queries
✅ **SIMPLE BULLET LIST** - Just list filenames with bullets (•)
✅ **NO FILE SIZES** - Don't include KB, MB, GB unless specifically asked
✅ **NO FILE TYPE LABELS** - Don't repeat "PDF", "JPEG", etc. (extension shows this)
✅ **NO EMOJIS** - Don't use 📄, 📁, 📊, etc.
✅ **NO TOTALS** - Don't add "Total: X files"
✅ **NO PROMPTS** - Don't add "Click on any file..." or "Let me know if..."
✅ **NO DETAILED BREAKDOWNS** - Don't describe sheet contents, cell data, page counts, etc.
✅ **NO EXTRA SPACING** - Single line between items, no double spacing

**Format**: "You have X file(s):\n• filename1.ext\n• filename2.ext"

**Examples:**
- Query: "What files do I have uploaded?"
  Answer: "You have 6 files:
• KodaBusinessPlan.pdf
• KodaBlueprint.pdf
• Lista_9.xlsx
• Presentation.pptx
• Chapter8.pdf
• Revenue.docx"

- Query: "Do I have any Excel files?"
  Answer: "Yes, you have one Excel file:
• Lista_9.xlsx"

- Query: "Which documents are PDFs?"
  Answer: "You have 3 PDF files:
• KodaBusinessPlan.pdf
• KodaBlueprint.pdf
• Chapter8.pdf"

- Query: "Where is the Koda Business Plan?"
  Answer: "The Koda Business Plan is located in the **Business Documents** folder."

### FOR GENERAL INFORMATION QUERIES:
✅ **BE CONCISE** - Answer in 2-3 sentences maximum
✅ **AVOID BULLET POINTS** - Use flowing sentences instead of list format
✅ **SKIP UNNECESSARY HEADERS** - Only use headers when essential for clarity
✅ **NO FOLLOW-UP QUESTIONS** - Just answer what was asked
✅ **DIRECT ANSWERS** - Get straight to the point without preamble

**Format**: According to **[Document Name]**, [concise answer with **bold** key facts].

**Examples:**
- Query: "What is Koda AI's core purpose?"
  Answer: "According to the **Koda Business Plan**, Koda AI's core purpose is to transform fragmented document storage into a secure, AI-powered assistant, bringing clarity and control to how individuals manage their essential personal information."

- Query: "What properties are mentioned?"
  Answer: "The **Baxter Hotel Analysis** mentions three properties: Lone Mountain Ranch with a **67% profit margin**, Baxter Hotel in Bozeman with **44.82% annualized return**, and Rex Ranch in Tucson/Amado."

**CRITICAL RULES:**
- NEVER include emojis in document names or titles
- Extract SPECIFIC information (numbers, dates, percentages, names)
- NO vague answers like "The document outlines..." - extract the actual content
- Keep responses under 100 words unless the query demands more detail

**SPECIAL RULE FOR FINANCIAL/NUMERICAL QUERIES:**
When asked about projections, revenue, costs, metrics, or any numerical data:
- YOU MUST extract and list ALL specific numbers, dollar amounts, percentages, and timeframes
- Format numbers prominently: "Year 1: **$670,800**, Year 2: **$2,395,000**, Year 3: **$6,240,000**"
- Include associated context (user counts, growth rates, margins, etc.)
- Never summarize numbers as "significant growth" - give the ACTUAL figures

## CRITICAL RULES:

✅ **ALWAYS** respond in the EXACT SAME LANGUAGE as the user's query
✅ **ALWAYS** use **bold** for specific values, numbers, dates, and key facts
✅ **NEVER** over-explain when user asks for specific facts
✅ **NEVER** add unnecessary structure for simple factual queries
✅ **NEVER** respond in a different language than the query
✅ **NEVER** use Estonian unless the query is in Estonian

## SOURCE ATTRIBUTION (TASK #12):

⚠️ **When answering from MULTIPLE documents**: Clearly attribute each fact to its source document
✅ Example: "According to the **Business Plan**, revenue is **$670K**. The **Financial Report** shows **$450K** actual."
⚠️ **When answering from a SINGLE document**: NO need for attribution - just provide the information directly

## LANGUAGE INSTRUCTION:
${langInstruction}

## YOUR WORKSPACE CONTEXT:
- User has ${workspaceMetadata.totalFiles} documents
- Categories: ${workspaceMetadata.categories.map((c: any) => `${c.name} (${c.fileCount} files)`).join(', ') || 'None'}
- File types: ${Object.entries(workspaceMetadata.filesByType).map(([type, count]) => `${count} ${type}`).join(', ')}

Remember: You are KODA, a helpful document intelligence assistant. Match your response style to the query type - concise for specific facts, structured for general information.`;
  }

  /**
   * Build the USER PROMPT with documents
   * TASK #12: Multi-file summary with per-file fact attribution
   */
  private buildUserPrompt(
    query: string,
    sources: RAGSource[],
    workspaceMetadata: any,
    conversationSummary: string = '',
    isFollowUp: boolean = false
  ): string {
    // TASK #12: Track unique documents for multi-file attribution
    const uniqueDocumentNames = Array.from(new Set(sources.map(s => s.documentName)));
    const isMultiDocument = uniqueDocumentNames.length > 1;

    const documentsContext = sources.map((source, index) => {
      return `### Document ${index + 1}: ${source.documentName}
Relevance: ${(source.similarity * 100).toFixed(1)}%

Content:
${source.content}

---`;
    }).join('\n\n');

    let prompt = '';

    // Add conversation context if this is a follow-up
    if (isFollowUp && conversationSummary) {
      prompt += `# CONVERSATION CONTEXT:

${conversationSummary}

⚠️ **IMPORTANT: This is a FOLLOW-UP question about the documents discussed above.**
The user is asking for MORE information about the SAME topic/documents.
DO NOT introduce new topics - continue the existing conversation.

---

`;
    }

    prompt += `# USER QUERY:
${query}

# RETRIEVED DOCUMENTS:
${documentsContext}

# CRITICAL INSTRUCTIONS - READ CAREFULLY:

⚠️ **HONESTY RULE: If the retrieved documents DO NOT contain the answer to the user's question, you MUST respond with:**
- English: "I am unable to locate relevant information about [query] in the retrieved documents."
- Portuguese: "Não consigo localizar informações relevantes sobre [query] nos documentos recuperados."

**DO NOT reference documents that don't contain the answer. DO NOT try to extract unrelated information.**

⚠️ **WHEN DOCUMENTS DO CONTAIN THE ANSWER - EXTRACT ACTUAL DATA:**

DO NOT write generic summaries like:
❌ "The document outlines revenue projections..."
❌ "It likely includes information about..."
❌ "The document discusses..."

INSTEAD, you MUST:
✅ Extract SPECIFIC numbers, dates, values, and facts from the document content
✅ Quote actual text from the documents when relevant
✅ If the information exists in the content above, PRESENT IT directly
✅ If asking for revenue/projections/numbers, LIST THE ACTUAL FIGURES

Example of BAD answer:
"The Koda Business Plan outlines revenue projections for the company..."

Example of GOOD answer:
"The Koda Business Plan projects:
- Year 1: **$670,800** in revenue
- Year 2: **$2,395,000** in revenue
- Year 3: **$6,240,000** in revenue"

**THE DOCUMENT CONTENT IS PROVIDED ABOVE. READ IT AND EXTRACT THE SPECIFIC INFORMATION THE USER ASKED FOR.**
${isMultiDocument ? `
# TASK #12: MULTI-DOCUMENT ATTRIBUTION REQUIREMENT

⚠️ **CRITICAL: You are answering from ${uniqueDocumentNames.length} DIFFERENT documents.**

**MANDATORY RULE:** When information comes from DIFFERENT documents, you MUST clearly attribute facts to their source:

✅ **CORRECT multi-document answer format:**
"According to the **Koda Business Plan**, the revenue projection for Year 1 is **$670,800**. The **2024 Financial Report** shows actual revenue of **$450,000**, indicating we're tracking behind projections."

✅ **Alternative format (when listing facts):**
"Revenue information from your documents:
- **Koda Business Plan**: Year 1 projected revenue of **$670,800**
- **2024 Financial Report**: Actual Year 1 revenue of **$450,000**"

❌ **WRONG - No attribution:**
"The projected revenue is $670,800 and actual revenue is $450,000."
(This doesn't tell the user which number came from which document!)

**Documents available:**
${uniqueDocumentNames.map((name, i) => `  ${i + 1}. **${name}**`).join('\n')}

**IMPORTANT:** Use document names naturally in your answer to attribute each fact to its source.
` : ''}

Now, provide your answer by EXTRACTING the specific information from the documents above.`;

    return prompt;
  }

  /**
   * Generate response when no documents found
   * USER REQUIREMENT: Simple, direct message without suggestions or key points
   */
  private generateNoDocumentsResponse(query: string, workspaceMetadata: any, language: string): string {
    // Simple, direct message per user requirement
    if (language === 'pt') {
      return `Não consigo localizar informações relevantes sobre "${query}" nos documentos disponíveis.`;
    } else {
      return `I am unable to locate relevant information about "${query}" in the available documents.`;
    }
  }

  /**
   * Get human-readable file type
   */
  private getFileType(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word')) return 'Word';
    if (mimeType.includes('sheet')) return 'Excel';
    if (mimeType.includes('presentation')) return 'PowerPoint';
    if (mimeType.includes('text')) return 'Text';
    if (mimeType.includes('image')) return 'Image';
    return 'Other';
  }

  /**
   * Filter sources to only include documents actually used in the answer
   * Issue #3: Fix retrieval to only cite documents actually used in reasoning
   */
  private filterSourcesByUsage(
    sources: RAGSource[],
    answer: string,
    relevantChunks: any[]
  ): RAGSource[] {
    console.log(`   🔍 Analyzing which documents were actually used in the answer...`);

    if (sources.length === 0) {
      console.log(`   ⚠️ No sources to filter`);
      return [];
    }

    const mentionedDocuments = new Set<string>();
    const mentionedFilenames = new Set<string>();

    // 1. Check for explicit document mentions (filename appears in answer)
    for (const source of sources) {
      if (!source.documentName) continue;

      // Check if document name is mentioned in the answer
      const filenamePattern = new RegExp(this.escapeRegex(source.documentName), 'i');
      if (filenamePattern.test(answer)) {
        mentionedDocuments.add(source.documentId);
        mentionedFilenames.add(source.documentName);
        console.log(`   ✓ Found explicit mention: "${source.documentName}"`);
      }

      // Also check base name (without extension)
      const baseName = source.documentName.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');
      if (baseName !== source.documentName) {
        const basePattern = new RegExp(this.escapeRegex(baseName), 'i');
        if (basePattern.test(answer)) {
          mentionedDocuments.add(source.documentId);
          mentionedFilenames.add(source.documentName);
          console.log(`   ✓ Found base name mention: "${baseName}"`);
        }
      }
    }

    // 2. If no explicit mentions, use content-based heuristic
    if (mentionedDocuments.size === 0) {
      console.log(`   💡 No explicit mentions found, using content-based filtering...`);

      for (const source of sources) {
        if (!source.content) continue;

        // Extract key phrases from chunk content (5+ words)
        const keyPhrases = this.extractKeyPhrases(source.content);

        // Check if any key phrases appear in the answer
        let matchCount = 0;
        for (const phrase of keyPhrases) {
          if (phrase.length > 15) {  // Only check substantial phrases
            const phrasePattern = new RegExp(this.escapeRegex(phrase), 'i');
            if (phrasePattern.test(answer)) {
              matchCount++;
            }
          }
        }

        // If at least 2 key phrases match, consider this document used
        if (matchCount >= 2) {
          mentionedDocuments.add(source.documentId);
          console.log(`   ✓ Content match: "${source.documentName}" (${matchCount} phrases)`);
        }
      }
    }

    // 3. If still no matches, return all sources (fallback to original behavior)
    if (mentionedDocuments.size === 0) {
      console.log(`   ⚠️ No usage detected, keeping all ${sources.length} sources as fallback`);
      return sources;
    }

    // 4. Filter sources to only include mentioned documents
    const usedSources = sources.filter(s => mentionedDocuments.has(s.documentId));

    // 5. SAFETY: Deduplicate by documentId one more time (in case of edge cases)
    const seenIds = new Set<string>();
    const deduplicatedSources = usedSources.filter(source => {
      if (seenIds.has(source.documentId)) {
        return false;
      }
      seenIds.add(source.documentId);
      return true;
    });

    console.log(`   ✅ Filtered to ${deduplicatedSources.length} actually used sources`);
    if (mentionedFilenames.size > 0) {
      console.log(`   📄 Documents used: ${Array.from(mentionedFilenames).join(', ')}`);
    }

    return deduplicatedSources;
  }

  /**
   * Extract key phrases from text (sentences or multi-word phrases)
   */
  private extractKeyPhrases(text: string): string[] {
    // Split by sentences
    const sentences = text.split(/[.!?]\s+/);

    const phrases: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 150) {
        phrases.push(trimmed);
      }

      // Also extract noun phrases (simple heuristic: sequences of 3-6 words)
      const words = trimmed.split(/\s+/);
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 5).join(' ');
        if (phrase.length > 15) {
          phrases.push(phrase);
        }
      }
    }

    return phrases.slice(0, 20); // Limit to top 20 phrases
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build conversation summary from history for context-aware prompts
   */
  private buildConversationSummary(conversationHistory: any[]): string {
    const recentMessages = conversationHistory.slice(-6); // Last 3 exchanges (6 messages)

    let summary = 'Previous conversation:\n\n';

    for (let i = 0; i < recentMessages.length; i++) {
      const message = recentMessages[i];
      const role = message.role === 'user' ? 'User' : 'Assistant';
      const content = message.content || '';

      // Truncate long messages
      const truncatedContent = content.length > 200
        ? content.substring(0, 200) + '...'
        : content;

      summary += `${role}: ${truncatedContent}\n\n`;
    }

    return summary;
  }

  /**
   * Detect common folder for a set of document IDs
   */
  private async detectCommonFolder(documentIds: string[], userId: string): Promise<{ id: string; name: string } | null> {
    try {
      // Get documents with their folder information
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          userId: userId
        },
        select: {
          folderId: true,
          folder: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Check if all documents are in the same folder
      const folderIds = documents.map(d => d.folderId).filter(Boolean);
      const uniqueFolderIds = [...new Set(folderIds)];

      if (uniqueFolderIds.length === 1 && uniqueFolderIds[0]) {
        const folder = documents.find(d => d.folderId === uniqueFolderIds[0])?.folder;
        if (folder) {
          return { id: folder.id, name: folder.name };
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to detect common folder:', error);
      return null;
    }
  }

  /**
   * Get context for a specific RAG response (for follow-up queries)
   */
  async getContext(contextId: string) {
    // This would retrieve cached context - simplified for now
    return { contextId, message: 'Context retrieval not implemented yet' };
  }

  /**
   * Answer a follow-up question using existing context
   */
  async answerFollowUp(
    userId: string,
    query: string,
    conversationId: string,
    previousContextId: string
  ): Promise<RAGResponse> {
    // For now, just treat it as a new query
    // In production, you'd retrieve the previous context and reuse sources
    return this.generateAnswer(userId, query, conversationId, false);
  }
}

export default new RAGService();
export { RAGService };
