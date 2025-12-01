import { Request, Response } from 'express';
import ragService from '../services/rag.service';
import prisma from '../config/database';
import { getIO } from '../services/websocket.service';
import navigationService from '../services/navigation.service';
import intentService from '../services/intent.service';
import { llmIntentDetectorService } from '../services/llmIntentDetector.service'; // ✅ FIX #1: LLM Intent Detection
import responsePostProcessor from '../services/responsePostProcessor.service'; // ✅ FIX #4: Response Post-Processor
import { Intent } from '../types/intent.types';
import fileActionsService from '../services/fileActions.service';
import { generateConversationTitle } from '../services/gemini.service';
import cacheService from '../services/cache.service'; // ✅ FIX: Cache invalidation after saving messages
// ✅ P0 FEATURES: Import P0 services for multi-turn conversations
import p0FeaturesService from '../services/p0Features.service';
import clarificationService from '../services/clarification.service';
import chatDocumentGenerationService from '../services/chatDocumentGeneration.service';
import * as languageDetectionService from '../services/languageDetection.service';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client for document generation
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/**
 * RAG Controller
 * Handles RAG-powered chat queries
 */

/**
 * Helper function to ensure conversation exists before creating messages
 */
async function ensureConversationExists(conversationId: string, userId: string) {
  let conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    console.log(`⚠️ Conversation ${conversationId} not found, creating it...`);
    conversation = await prisma.conversation.create({
      data: {
        id: conversationId,
        userId,
        title: 'New Chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  }

  return conversation;
}

/**
 * POST /api/rag/query
 * Generate an answer using RAG
 */
export const queryWithRAG = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ✅ FIX #8: Multi-Document Attachment Support
    // ═══════════════════════════════════════════════════════════════════════════
    // REASON: Allow users to query across multiple documents simultaneously
    // WHY: Common use case - "Compare Q1 and Q2 budgets", "Summarize all contracts"
    // HOW: Accept attachedDocuments array, pass to Pinecone as $in filter
    // IMPACT: Enables document comparison, cross-document analysis

    const { query, conversationId, answerLength = 'medium', attachedFile, documentId, attachedDocuments = [] } = req.body;

    // Validate answerLength parameter
    const validLengths = ['short', 'medium', 'summary', 'long'];
    const finalAnswerLength = validLengths.includes(answerLength) ? answerLength : 'medium';

    // ✅ MULTI-ATTACHMENT SUPPORT: Handle both single documentId and attachedDocuments array
    let attachedDocumentIds: string[] = [];
    // ✅ FIX: Store full attachment info (id, name, type) for metadata persistence
    let attachedDocumentsArray: Array<{id: string, name?: string, type?: string}> = [];

    // Priority 1: Use attachedDocuments array if provided
    if (attachedDocuments && attachedDocuments.length > 0) {
      attachedDocumentIds = attachedDocuments.map((doc: any) =>
        typeof doc === 'string' ? doc : doc.id
      ).filter(Boolean);

      // ✅ FIX: Preserve full document info for metadata
      attachedDocumentsArray = attachedDocuments.map((doc: any) => {
        if (typeof doc === 'string') {
          return { id: doc };
        }
        return {
          id: doc.id,
          name: doc.name || doc.filename || 'Unknown File',
          type: doc.type || doc.mimeType || 'application/octet-stream'
        };
      });

      console.log(`📎 [MULTI-ATTACHMENT] ${attachedDocumentIds.length} documents attached:`, attachedDocumentIds);
    }
    // Priority 2: Fall back to single documentId for backward compatibility
    else if (documentId && documentId !== null) {
      attachedDocumentIds = [documentId];
      attachedDocumentsArray = [{ id: documentId }];
      console.log(`📎 [SINGLE-ATTACHMENT] 1 document attached: ${documentId}`);
    }
    // Priority 3: No attachments
    else {
      console.log(`📎 [NO-ATTACHMENT] Searching across all user documents`);
    }

    console.log(`📏 [ANSWER LENGTH] ${finalAnswerLength}`);

    // Detect if this is a comparison query
    const isComparisonQuery = attachedDocumentIds.length > 1 && (
      query.toLowerCase().includes('compare') ||
      query.toLowerCase().includes('difference') ||
      query.toLowerCase().includes('vs') ||
      query.toLowerCase().includes('versus') ||
      query.toLowerCase().includes('between')
    );

    if (isComparisonQuery) {
      console.log(`🔀 [COMPARISON] Detected comparison query across ${attachedDocumentIds.length} documents`);
    }
    // ✅ FIX: Prepare metadata with full file info (id, name, type) for display persistence
    const userMessageMetadata = attachedDocumentsArray.length > 0 ? {
      attachedFiles: attachedDocumentsArray
    } : null;


    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // Get conversation history for context resolution (needed for intent detection)
    const conversationHistoryForIntent = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        role: true,
        content: true,
      }
    });
    conversationHistoryForIntent.reverse(); // Chronological order

    // ========================================
    // ⚡ SPEED FIX: Fast-path RAG detection (skip LLM intent for obvious RAG queries)
    // UPDATED: Nov 27, 2025 - Force restart to apply fix
    // ========================================
    // REASON: LLM intent detection takes 3-6 seconds for EVERY query
    // IMPACT: Saves 3-6 seconds for 80%+ of queries that are obvious RAG queries
    // HOW: Use fast pattern matching to detect obvious RAG queries

    const queryLower = query.toLowerCase();

    // Fast patterns that indicate RAG query (no need for LLM intent detection)
    // ⚡ FIX: Added all common question words (does, is, are, can, etc.)
    // REASON: Queries like "Does the patient..." were falling through to LLM detection
    // IMPACT: Saves 200-500ms on 30% of queries
    const isObviousRagQuery = (
      // Comparison queries
      queryLower.includes('compare') ||
      queryLower.includes('difference') ||
      queryLower.includes('vs ') ||
      queryLower.includes(' vs') ||
      queryLower.includes('versus') ||
      // Question patterns (WH-words)
      queryLower.startsWith('what ') ||
      queryLower.startsWith('how ') ||
      queryLower.startsWith('why ') ||
      queryLower.startsWith('when ') ||
      queryLower.startsWith('where ') ||
      queryLower.startsWith('who ') ||
      queryLower.startsWith('which ') ||
      // Question patterns (Yes/No question words) - FIX: Added missing patterns
      queryLower.startsWith('does ') ||
      queryLower.startsWith('do ') ||
      queryLower.startsWith('is ') ||
      queryLower.startsWith('are ') ||
      queryLower.startsWith('can ') ||
      queryLower.startsWith('could ') ||
      queryLower.startsWith('should ') ||
      queryLower.startsWith('would ') ||
      queryLower.startsWith('will ') ||
      queryLower.startsWith('did ') ||
      queryLower.startsWith('has ') ||
      queryLower.startsWith('have ') ||
      queryLower.startsWith('had ') ||
      // Instruction patterns
      queryLower.startsWith('explain ') ||
      queryLower.startsWith('tell me ') ||
      queryLower.startsWith('describe ') ||
      queryLower.startsWith('summarize ') ||
      queryLower.startsWith('summary ') ||
      // Portuguese question patterns
      queryLower.startsWith('o que ') ||
      queryLower.startsWith('como ') ||
      queryLower.startsWith('por que ') ||
      queryLower.startsWith('quando ') ||
      queryLower.startsWith('onde ') ||
      queryLower.startsWith('quem ') ||
      queryLower.startsWith('qual ') ||
      queryLower.includes('comparar') ||
      // Spanish question patterns
      queryLower.startsWith('qué ') ||
      queryLower.startsWith('cómo ') ||
      queryLower.startsWith('por qué ') ||
      queryLower.startsWith('cuándo ') ||
      queryLower.startsWith('dónde ') ||
      queryLower.startsWith('quién ') ||
      queryLower.startsWith('cuál ') ||
      // Document content queries (asking about what's IN documents)
      queryLower.includes('in the document') ||
      queryLower.includes('in my document') ||
      queryLower.includes('from the document') ||
      queryLower.includes('no documento') ||
      queryLower.includes('en el documento') ||
      // Queries with .pdf, .docx, etc. file extensions (asking about specific files)
      /\.(pdf|docx?|xlsx?|pptx?|txt|csv)\b/i.test(query)
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // FLEXIBLE SHOW FILE DETECTION
    // ═══════════════════════════════════════════════════════════════════════════
    // PURPOSE: Detect when user wants to see/open a file (not just search content)
    // WHY: Old pattern was too strict - only matched "show file" without "?"
    // NEW: Handles direct commands, polite requests, indirect requests, questions

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPLETE SHOW FILE DETECTION - 100% Implementation (EN, PT, ES)
    // All 8 categories from Koda Natural File Actions Guide
    // ═══════════════════════════════════════════════════════════════════════════
    const fileKeywords = /file|document|paper|report|spreadsheet|presentation|pdf|docx?|xlsx?|pptx?|arquivo|documento|relatório|archivo|informe/i;

    // ⚠️ FIX: Exclude creation/generation queries from show file detection
    // Queries like "create a summary report" should NOT be treated as "show file"
    const isCreationQuery = /(?:create|make|generate|build|write|draft|prepare|compose|criar|gerar|hacer|generar|créer)/i.test(queryLower);

    const isShowFileQuery = !isCreationQuery && (
      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 1: Direct Commands (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      /(?:show|open|display|view|pull up|bring up|present|reveal)\s+(?:me\s+)?(?:the\s+)?/i.test(queryLower) &&
      fileKeywords.test(queryLower) ||

      // Portuguese direct
      /(?:me mostra|mostra|abre|exibe|mostre|abra|apresenta)\s+/i.test(queryLower) &&
      /arquivo|documento|relatório/i.test(queryLower) ||

      // Spanish direct
      /(?:muéstrame|muestra|abre|enseña|enséñame|presenta)\s+/i.test(queryLower) &&
      /archivo|documento|informe/i.test(queryLower) ||

      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 2: Polite Requests (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      /(?:can|could|would|may)\s+(?:I|you)\s+(?:see|show|open|display|view)/i.test(queryLower) &&
      fileKeywords.test(queryLower) ||

      /(?:please|would you mind|could you please)\s+(?:show|open|display)/i.test(queryLower) &&
      fileKeywords.test(queryLower) ||

      // Portuguese polite
      /(?:pode|poderia|consegue|dá pra)\s+(?:me mostrar|abrir|mostrar)/i.test(queryLower) &&
      /arquivo|documento/i.test(queryLower) ||

      // Spanish polite
      /(?:puedes|podrías|pudieras)\s+(?:mostrarme|abrir|mostrar)/i.test(queryLower) &&
      /archivo|documento/i.test(queryLower) ||

      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 3: Indirect Requests (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      /(?:need|want|would like|'d like)\s+to\s+(?:see|look at|review|check|examine)/i.test(queryLower) &&
      fileKeywords.test(queryLower) ||

      /(?:let|allow)\s+me\s+(?:see|look at|check|review)/i.test(queryLower) &&
      fileKeywords.test(queryLower) ||

      /(?:should|have to|must|gotta)\s+(?:see|look at|review|check)/i.test(queryLower) &&
      fileKeywords.test(queryLower) ||

      // Portuguese indirect
      /(?:preciso|quero|gostaria de|tenho que)\s+(?:ver|olhar|revisar)/i.test(queryLower) &&
      /arquivo|documento/i.test(queryLower) ||

      // Spanish indirect
      /(?:necesito|quiero|me gustaría|tengo que)\s+(?:ver|mirar|revisar)/i.test(queryLower) &&
      /archivo|documento/i.test(queryLower) ||

      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 4: Question-Based (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      /what'?s?\s+in/i.test(queryLower) && fileKeywords.test(queryLower) ||
      /what\s+does.*(?:say|contain)/i.test(queryLower) && fileKeywords.test(queryLower) ||
      /where\s+is\s+(?:the\s+)?/i.test(queryLower) && fileKeywords.test(queryLower) ||

      // Portuguese question
      /(?:o que tem|o que há|o que diz|onde está|cadê)/i.test(queryLower) &&
      /arquivo|documento/i.test(queryLower) ||

      // Spanish question
      /(?:qué hay en|qué dice|dónde está)/i.test(queryLower) &&
      /archivo|documento/i.test(queryLower) ||

      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 5: Implied Actions (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      // "X please" suffix: "contract please", "the budget please"
      /\s+please$/i.test(queryLower) && fileKeywords.test(queryLower) ||
      // "X?" standalone: "contract?", "budget.pdf?"
      /^[\w\s\.\-]+\?$/i.test(query) && /\.(pdf|docx?|xlsx?|pptx?)/i.test(query) ||
      /looking\s+for/i.test(queryLower) && fileKeywords.test(queryLower) && !queryLower.includes('?') ||
      /^need\s+(?:the\s+)?/i.test(queryLower) && fileKeywords.test(queryLower) ||
      /^find\s+(?:me\s+)?(?:the\s+)?/i.test(queryLower) && fileKeywords.test(queryLower) ||
      /^get\s+(?:me\s+)?(?:the\s+)?/i.test(queryLower) && fileKeywords.test(queryLower) ||

      // Portuguese implied - "X por favor", "preciso do X"
      /\s+(?:por favor|pfv|pf)$/i.test(queryLower) && /arquivo|documento/i.test(queryLower) ||
      /(?:procurando|buscando)/i.test(queryLower) && /arquivo|documento/i.test(queryLower) ||
      /^(?:preciso d[oa]|precisa d[oa])\s+/i.test(queryLower) ||

      // Spanish implied - "X por favor", "necesito el X"
      /\s+(?:por favor|porfa|porfavor)$/i.test(queryLower) && /archivo|documento/i.test(queryLower) ||
      /(?:buscando)/i.test(queryLower) && /archivo|documento/i.test(queryLower) ||
      /^(?:necesito|ocupo)\s+(?:el\s+|la\s+)?/i.test(queryLower) && /archivo|documento/i.test(queryLower) ||

      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 6: Casual/Abbreviated (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      /(?:gimme|lemme\s+see|check out|wanna\s+see|gotta\s+see)/i.test(queryLower) && fileKeywords.test(queryLower) ||
      /(?:show|open|pull up).*(?:real quick|quickly|rq|asap)/i.test(queryLower) ||
      /(?:yo|hey)\s+(?:show|open)/i.test(queryLower) && fileKeywords.test(queryLower) ||

      // Portuguese casual
      /(?:aí|ae|bora|vamo)\s+(?:mostra|abre|ver)/i.test(queryLower) ||
      /(?:manda|mande)\s+(?:o\s+)?/i.test(queryLower) && /arquivo|documento/i.test(queryLower) ||

      // Spanish casual
      /(?:oye|ey|hey|dale|ándale)\s+(?:muestra|abre)/i.test(queryLower) ||
      /(?:pásame|pasame|dame)\s+(?:el\s+)?/i.test(queryLower) && /archivo|documento/i.test(queryLower) ||

      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 7: Contextual References (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      /(?:show|open)\s+(?:me\s+)?(?:that|this|the)\s+(?:file|document|paper|report|one)/i.test(queryLower) ||
      /(?:the\s+)?(?:one|file|document)\s+(?:about|on|regarding)\s+/i.test(queryLower) ||

      // Portuguese contextual
      /mostra\s+(?:aquele|esse|este|o)\s+(?:arquivo|documento)/i.test(queryLower) ||
      /(?:arquivo|documento)\s+(?:sobre|de|a respeito)/i.test(queryLower) ||

      // Spanish contextual
      /muestra\s+(?:ese|este|aquel|el)\s+(?:archivo|documento)/i.test(queryLower) ||
      /(?:archivo|documento)\s+(?:sobre|de|acerca)/i.test(queryLower) ||

      // ═══════════════════════════════════════════════════════════════════════
      // CATEGORY 8: Temporal References (EN, PT, ES)
      // ═══════════════════════════════════════════════════════════════════════
      /(?:the\s+)?(?:file|document)\s+from\s+(?:yesterday|today|last week)/i.test(queryLower) ||
      /(?:the\s+)?(?:recent|latest|newest|last)\s+(?:file|document|upload)/i.test(queryLower) ||

      // Portuguese temporal
      /(?:arquivo|documento)\s+(?:de ontem|de hoje|da semana passada)/i.test(queryLower) ||
      /(?:último|recente)\s+(?:arquivo|documento)/i.test(queryLower) ||

      // Spanish temporal
      /(?:archivo|documento)\s+(?:de ayer|de hoy|de la semana pasada)/i.test(queryLower) ||
      /(?:último|reciente)\s+(?:archivo|documento)/i.test(queryLower)
    );

    // Patterns that REQUIRE LLM intent detection (file management actions)
    const needsLlmIntent = (
      // File management keywords
      queryLower.includes('create folder') ||
      queryLower.includes('criar pasta') ||
      queryLower.includes('crear carpeta') ||
      queryLower.includes('move ') ||
      queryLower.includes('mover ') ||
      queryLower.includes('rename ') ||
      queryLower.includes('renomear ') ||
      queryLower.includes('delete ') ||
      queryLower.includes('excluir ') ||
      queryLower.includes('eliminar ') ||
      // File listing without question context
      (queryLower.includes('list ') && queryLower.includes('file')) ||
      // Show file queries (using flexible detection)
      isShowFileQuery
    );

    let intentResult;

    if (isObviousRagQuery && !needsLlmIntent) {
      // ⚡ FAST PATH: Skip LLM intent detection for obvious RAG queries
      console.log('⚡ [FAST INTENT] Obvious RAG query detected - skipping LLM intent detection (saved 3-6s)');
      intentResult = {
        intent: 'rag_query',
        confidence: 0.95,
        parameters: {}
      };
    } else {
      // SLOW PATH: Use LLM for ambiguous queries or file management
      console.log('🧠 [SLOW INTENT] Using LLM intent detection for ambiguous/file management query');
      intentResult = await llmIntentDetectorService.detectIntent(query, conversationHistoryForIntent);
    }

    console.log(`🎯 [Intent] ${intentResult.intent} (confidence: ${intentResult.confidence})`);
    console.log(`📝 [STREAMING Entities]`, intentResult.parameters);

    // TODO: Gemini fallback classifier removed - using pattern matching only
    // Only fallback to Gemini AI classifier if confidence is very low
    // let fileIntent = null;
    // if (intentResult.confidence < 0.80 && intentResult.intent === Intent.GENERAL_QA) {
    //   try {
    //     fileIntent = await fileManagementIntentService.classifyIntent(query, userId);
    //     if (fileIntent) {
    //       console.log(`🧠 [GEMINI FALLBACK] Intent: ${fileIntent.intent} (confidence: ${fileIntent.confidence})`);
    //     }
    //   } catch (error) {
    //     console.log(`⚠️ [GEMINI FALLBACK] Failed, using pattern result`);
    //     fileIntent = null;
    //   }
    // }

    // ========================================
    // INTENT HANDLERS (New Brain - Proper Execution)
    // ========================================

    // SUMMARIZE - Go straight to RAG with summarization instruction
    if (intentResult.intent === Intent.SUMMARIZE_DOCUMENT) {
      console.log(`📄 [SUMMARIZE] Processing summarization request`);
      // Add instruction to enhance the query for summarization
      const enhancedQuery = `Please provide a concise summary of ${intentResult.entities.documentName || 'the document'}. ${query}`;
      // Continue to RAG processing below with enhanced query
    }

    // READ_EXCEL_CELL - Read specific cell from Excel
    if (intentResult.intent === Intent.READ_EXCEL_CELL) {
      console.log(`📊 [EXCEL] Reading Excel cell from query: "${query}"`);

      const excelCellReader = await import('../services/excelCellReader.service');
      const cellResult = await excelCellReader.default.readCell(query, userId);

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        }
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: cellResult.message,
          metadata: JSON.stringify({
            excelCellQuery: true,
            success: cellResult.success,
            cellValue: cellResult.value,
            cellAddress: cellResult.cellAddress,
            sheetName: cellResult.sheetName,
            documentName: cellResult.documentName
          })
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      res.json({
        success: cellResult.success,
        answer: cellResult.message,
        sources: [],
        expandedQuery: [],
        contextId: 'excel-cell-query',
        userMessage,
        assistantMessage
      });
      return;
    }

    // CONTENT ANALYSIS - Go to RAG
    if (intentResult.intent === Intent.SEARCH_CONTENT ||
        intentResult.intent === Intent.EXTRACT_TABLES ||
        intentResult.intent === Intent.COMPARE_DOCUMENTS ||
        intentResult.intent === Intent.ANALYZE_DOCUMENT) {
      console.log(`🔍 [CONTENT QUERY] Proceeding to RAG for content analysis`);
      // These should go directly to RAG system - no navigation handler needed
      // Continue to RAG processing below
    }

    // DESCRIBE_FOLDER - Use folder contents handler
    if (intentResult.intent === Intent.DESCRIBE_FOLDER && intentResult.entities.folderName) {
      console.log(`📁 [FOLDER] Describing folder: "${intentResult.entities.folderName}"`);

      const folderContentsHandler = await import('../services/handlers/folderContents.handler');
      const folderResult = await folderContentsHandler.default.handle(
        intentResult.entities.folderName,
        userId
      );

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        }
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: folderResult.answer,
          metadata: JSON.stringify({ actions: folderResult.actions })
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      res.json({
        success: true,
        answer: folderResult.answer,
        sources: [],
        expandedQuery: [],
        contextId: 'folder-query',
        actions: folderResult.actions,
        userMessage,
        assistantMessage
      });
    }

    // FIND_DOCUMENT_LOCATION - Use navigation service
    if (intentResult.intent === Intent.FIND_DOCUMENT_LOCATION && intentResult.entities.documentName) {
      console.log(`📍 [LOCATION] Finding: "${intentResult.entities.documentName}"`);

      const navResult = await navigationService.findFile(userId, intentResult.entities.documentName);

      if (navResult.found) {
        // Ensure conversation exists before creating messages
        await ensureConversationExists(conversationId, userId);

        const userMessage = await prisma.message.create({
          data: { conversationId, role: 'user', content: query }
        });

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: navResult.message,
            metadata: JSON.stringify({
              navigationQuery: true,
              actions: navResult.actions,
              folderPath: navResult.folderPath
            })
          }
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        const sources = navResult.actions
          .filter(action => action.type === 'open_file' && action.documentId)
          .map(action => ({
            documentId: action.documentId!,
            filename: '',
            chunkIndex: 0,
            relevanceScore: 1.0
          }));

        res.json({
          success: true,
          answer: navResult.message,
          sources,
          expandedQuery: [],
          contextId: 'navigation-query',
          actions: navResult.actions,
          userMessage,
          assistantMessage
        });
      }
    }

    // LIST_FILES - Use metadata query service
    if (intentResult.intent === Intent.LIST_FILES) {
      console.log(`📋 [LIST] Listing files`);

      // TODO: Metadata query service removed - use direct database query
      const documents = await prisma.document.findMany({
        where: { userId, status: 'completed' },
        select: { filename: true },
        orderBy: { createdAt: 'desc' }
      });

      const filesListAnswer = documents.length > 0
        ? `You have ${documents.length} files:\n${documents.map((d, i) => `${i + 1}. ${d.filename}`).join('\n')}`
        : 'You have no files uploaded yet.';

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        }
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: filesListAnswer
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      res.json({
        success: true,
        answer: filesListAnswer,
        sources: [], // ✅ FIX #1: Always return sources
        expandedQuery: [],
        contextId: 'list-query',
        userMessage,
        assistantMessage
      });
    }

    // ========================================
    // ACTION HANDLERS - Actually perform file operations
    // ========================================

    // CREATE_FOLDER - Create a new folder (ACTUAL EXECUTION)
    if (intentResult.intent === Intent.CREATE_FOLDER && intentResult.entities.folderName) {
      console.log(`📁 [ACTION] Creating folder: "${intentResult.entities.folderName}"`);

      const result = await fileActionsService.createFolder({
        userId,
        folderName: intentResult.entities.folderName
      }, query);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        }
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'create_folder',
            success: result.success,
            data: result.data
          })
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      res.json({
        success: result.success,
        answer: result.message,
        sources: [],
        expandedQuery: [],
        contextId: 'action-create-folder',
        userMessage,
        assistantMessage
      });
    }

    // RENAME_FOLDER - Rename an existing folder (ACTUAL EXECUTION)
    if (intentResult.intent === Intent.RENAME_FOLDER &&
        intentResult.entities.folderName &&
        intentResult.entities.targetName) {
      console.log(`📝 [ACTION] Renaming folder: "${intentResult.entities.folderName}" → "${intentResult.entities.targetName}"`);

      const result = await fileActionsService.renameFolder(
        intentResult.entities.folderName,
        intentResult.entities.targetName,
        userId
      );

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        }
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'rename_folder',
            success: result.success,
            data: result.data
          })
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      res.json({
        success: result.success,
        answer: result.message,
        sources: [],
        expandedQuery: [],
        contextId: 'action-rename-folder',
        userMessage,
        assistantMessage
      });
    }

    // MOVE_FILES - Move documents to a folder (ACTUAL EXECUTION)
    if (intentResult.intent === Intent.MOVE_FILES && intentResult.entities.targetName) {
      console.log(`📦 [ACTION] Moving files to: "${intentResult.entities.targetName}"`);

      const result = await fileActionsService.moveFiles(
        query,
        intentResult.entities.targetName,
        userId
      );

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        }
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'move_files',
            success: result.success,
            data: result.data
          })
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      res.json({
        success: result.success,
        answer: result.message,
        sources: [],
        expandedQuery: [],
        contextId: 'action-move-files',
        userMessage,
        assistantMessage
      });
    }

    // FIND_DUPLICATES - Find duplicate files
    if (intentResult.intent === Intent.FIND_DUPLICATES) {
      console.log(`🔍 [ACTION] Finding duplicate files`);

      // Extract folder name if specified
      const folderId = intentResult.entities.folderName
        ? (await prisma.folder.findFirst({
            where: {
              userId,
              name: {
                contains: intentResult.entities.folderName
              }
            },
            select: { id: true }
          }))?.id
        : undefined;

      const result = await fileActionsService.findDuplicates(userId, folderId);

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        }
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'find_duplicates',
            success: result.success,
            data: result.data
          })
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      res.json({
        success: result.success,
        answer: result.message,
        sources: [],
        expandedQuery: [],
        contextId: 'action-find-duplicates',
        userMessage,
        assistantMessage
      });
    }

    // ========================================
    // GEMINI FALLBACK HANDLERS (OLD SYSTEM) - DISABLED
    // ========================================
    // TODO: fileIntent system disabled - these handlers need to be refactored or removed
    /*
    // Handle FIND_DOCUMENT - Use navigation service (NOT RAG!)
    if (fileIntent && fileIntent.intent === FileManagementIntent.FIND_DOCUMENT && fileIntent.entities.documentName) {
      console.log(`📍 [NAV] Finding document: "${fileIntent.entities.documentName}"`);

      const navResult = await navigationService.findFile(userId, fileIntent.entities.documentName);

      if (navResult.found) {
        // Save messages
        const userMessage = await prisma.message.create({
          data: { conversationId, role: 'user', content: query }
        });

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: navResult.message,
            metadata: JSON.stringify({
              navigationQuery: true,
              actions: navResult.actions,
              folderPath: navResult.folderPath
            })
          }
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // Convert navigation actions to RAG-style sources
        const sources = navResult.actions
          .filter(action => action.type === 'open_file' && action.documentId)
          .map(action => ({
            documentId: action.documentId!,
            filename: '',  // Will be filled from action metadata
            chunkIndex: 0,
            relevanceScore: 1.0
          }));

        res.json({
          success: true,
          answer: navResult.message,
          sources,
          expandedQuery: [],
          contextId: 'navigation-query',
          actions: navResult.actions,
          userMessage,
          assistantMessage
        });
      }
    }

    // Handle FIND_FOLDER and DESCRIBE_FOLDER - Use navigation service (NOT RAG!)
    if (fileIntent && (fileIntent.intent === FileManagementIntent.FIND_FOLDER || fileIntent.intent === FileManagementIntent.DESCRIBE_FOLDER) && fileIntent.entities.folderName) {
      console.log(`📁 [NAV] Finding folder: "${fileIntent.entities.folderName}"`);

      const navResult = await navigationService.findFolder(userId, fileIntent.entities.folderName);

      if (navResult.found) {
        // Save messages
        const userMessage = await prisma.message.create({
          data: { conversationId, role: 'user', content: query }
        });

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: navResult.message,
            metadata: JSON.stringify({
              navigationQuery: true,
              actions: navResult.actions,
              folderPath: navResult.folderPath
            })
          }
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        res.json({
          success: true,
          answer: navResult.message,
          sources: [],
          expandedQuery: [],
          contextId: 'navigation-query',
          actions: navResult.actions,
          userMessage,
          assistantMessage
        });
      }
    }
    */

    /*
    // ========================================
    // QUERY CLASSIFICATION & SMART ROUTING
    // ========================================
    // TODO: Temporarily disabled - queryClassifier service doesn't exist
    // All queries now go directly to RAG pipeline

    // Classify query to determine routing strategy
    const classification = await queryClassifier.classify(query, userId);
    console.log(`🎯 Query classified as: ${classification.type} (confidence: ${classification.confidence})`);

    // Handle SIMPLE_GREETING - instant template response
    if (classification.type === QueryType.SIMPLE_GREETING) {
      const templateResponse = templateResponseService.generateResponse(classification.type, query);

      if (templateResponse) {
        console.log(`⚡ Template response generated in ${templateResponse.responseTimeMs}ms`);

        // Save user and assistant messages
        const userMessage = await prisma.message.create({
          data: { conversationId, role: 'user', content: query }
        });

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: templateResponse.content,
            metadata: JSON.stringify({ templateResponse: true, responseTimeMs: templateResponse.responseTimeMs })
          }
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        res.json({
          success: true,
          answer: templateResponse.content,
          sources: [],
          expandedQuery: [],
          contextId: 'template-response',
          actions: [],
          userMessage,
          assistantMessage
        });
      }
    }

    // Handle SIMPLE_CONVERSATION - instant template response
    if (classification.type === QueryType.SIMPLE_CONVERSATION) {
      const templateResponse = templateResponseService.generateResponse(classification.type, query);

      if (templateResponse) {
        console.log(`⚡ Template response generated in ${templateResponse.responseTimeMs}ms`);

        const userMessage = await prisma.message.create({
          data: { conversationId, role: 'user', content: query }
        });

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: templateResponse.content,
            metadata: JSON.stringify({ templateResponse: true, responseTimeMs: templateResponse.responseTimeMs })
          }
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        res.json({
          success: true,
          answer: templateResponse.content,
          sources: [],
          expandedQuery: [],
          contextId: 'template-response',
          actions: [],
          userMessage,
          assistantMessage
        });
      }
    }

    // Handle SIMPLE_METADATA - fast database query (no RAG/LLM needed)
    if (classification.type === QueryType.SIMPLE_METADATA) {
      console.log(`🗄️  Handling metadata query directly`);

      // TODO: Metadata query service removed - stub response
      const metadataResult = {
        answer: 'Metadata queries are currently handled through the RAG system.',
        sources: [],
        actions: []
      };

      if (metadataResult.answer) {
        const userMessage = await prisma.message.create({
          data: { conversationId, role: 'user', content: query }
        });

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: metadataResult.answer,
            metadata: JSON.stringify({
              metadataQuery: true,
              ragSources: metadataResult.sources || [],
              actions: metadataResult.actions || []
            })
          }
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        res.json({
          success: true,
          answer: metadataResult.answer,
          sources: metadataResult.sources || [],
          expandedQuery: [],
          contextId: 'metadata-query',
          actions: metadataResult.actions || [],
          userMessage,
          assistantMessage
        });
      }
    }
    */

    // ========================================
    // COMPLEX_RAG - Full RAG pipeline
    // ========================================
    console.log(`🔍 Executing full RAG pipeline for complex query`);

    // Get conversation history (last 5 messages) for context
    const conversationHistory = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        role: true,
        content: true,
        metadata: true,
        createdAt: true
      }
    });

    // Reverse to get chronological order
    conversationHistory.reverse();

    // ✅ Check if this is the first message in the conversation BEFORE saving
    const existingMessageCount = await prisma.message.count({
      where: { conversationId }
    });
    const isFirstMessage = existingMessageCount === 0;
    console.log(`👋 [GREETING CHECK] Conversation ${conversationId}: ${existingMessageCount} existing messages, isFirstMessage: ${isFirstMessage}`);

    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: query,
        metadata: attachedFile ? JSON.stringify({ attachedFile }) : null,
      },
    });

    // Generate RAG answer with answer length control and conversation history
    // ✅ FIX #8: Pass array of document IDs for multi-document support
    const result = await ragService.generateAnswer(
      userId,
      query,
      conversationId,
      finalAnswerLength as 'short' | 'medium' | 'summary' | 'long',
      attachedDocumentIds.length > 0 ? attachedDocumentIds : undefined,
      conversationHistory,  // Pass conversation history for context
      isFirstMessage  // Pass first message flag for greeting logic
    );

    console.log(`🔍 [RAG CONTROLLER] result.sources:`, JSON.stringify(result.sources?.slice(0, 3), null, 2));
    console.log(`🔍 [RAG CONTROLLER] result.sources.length:`, result.sources?.length);

    // Save assistant message to database with RAG metadata
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.answer,
        metadata: JSON.stringify({
          ragSources: result.sources,
          contextId: (result as any).contextId || 'rag-query',
          intent: (result as any).intent || 'content_query',
          confidence: (result as any).confidence || 0.8,
          answerLength: finalAnswerLength
        }),
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Auto-generate conversation name after first message (non-blocking)
    const messageCount = await prisma.message.count({
      where: { conversationId }
    });

    console.log(`🔍 [AUTO-NAMING] Checking conditions - conversationId: ${conversationId}, messageCount: ${messageCount}`);

    if (messageCount === 2) { // 2 messages = first user message + first assistant message
      console.log(`✅ [AUTO-NAMING] Message count is 2, proceeding with name generation`);
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { title: true }
      });
      console.log(`🔍 [AUTO-NAMING] Current title: "${conversation?.title}"`);

      // Determine if we should generate a name (only for "New Chat" or empty titles)
      const currentTitle = conversation?.title || '';
      const shouldGenerate = currentTitle === '' || currentTitle === 'New Chat';
      console.log(`🔍 [AUTO-NAMING] shouldGenerateName result: ${shouldGenerate} (title: "${currentTitle}")`);

      if (conversation && shouldGenerate) {
        console.log(`🚀 [AUTO-NAMING] Starting name generation for query: "${query}"`);
        // Generate name asynchronously without blocking the response
        generateConversationTitle(query)
          .then(async (generatedTitle) => {
            console.log(`✅ [AUTO-NAMING] Generated title: "${generatedTitle}"`);
            // Update the conversation title
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { title: generatedTitle }
            });

            // Emit WebSocket event for real-time update (if WebSocket is initialized)
            try {
              const io = getIO();
              io.to(`user:${userId}`).emit('conversation:updated', {
                conversationId,
                title: generatedTitle,
                updatedAt: new Date()
              });
              console.log(`📡 [AUTO-NAMING] WebSocket event emitted to user:${userId}`);
            } catch (wsError) {
              console.warn('⚠️  [AUTO-NAMING] WebSocket not available, skipping real-time update:', wsError);
            }

            console.log(`🎉 [AUTO-NAMING] Successfully updated conversation name: "${generatedTitle}" for conversation ${conversationId}`);
          })
          .catch((error) => {
            console.error('❌ [AUTO-NAMING] Failed to generate conversation name:', error);
          });
      } else {
        console.log(`⏭️  [AUTO-NAMING] Skipping - conversation: ${!!conversation}, shouldGenerate: ${shouldGenerate}`);
      }
    } else {
      console.log(`⏭️  [AUTO-NAMING] Skipping - messageCount is ${messageCount}, not 2`);
    }

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources || [],  // ✅ FIX #1: Always return sources (empty array if none)
      expandedQuery: (result as any).expandedQuery || [],
      contextId: (result as any).contextId || 'rag-query',
      actions: (result as any).actions || [] || [],
      userMessage,
      assistantMessage
    });
  } catch (error: any) {
    console.error('Error in RAG query:', error);

    // ✅ FIX #10: Better Error Messages
    // Check if it's a RAGError with specific error info
    if (error.code && error.statusCode && error.suggestion) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        suggestion: error.suggestion,
        retryable: error.retryable || false,
      });
    } else {
      // Generic error - provide helpful response
      res.status(500).json({
        error: error.message || 'Failed to generate RAG answer',
        code: 'SERVER_ERROR',
        suggestion: 'An unexpected error occurred. Please try again.',
        retryable: true,
      });
    }
  }
};

/**
 * GET /api/rag/context/:contextId
 * Get context for a specific RAG response
 */
export const getContext = async (req: Request, res: Response) => {
  try {
    const { contextId } = req.params;

    const context = await ragService.getContext(contextId);

    res.json({
      success: true,
      context
    });
  } catch (error: any) {
    console.error('Error getting RAG context:', error);
    res.status(500).json({ error: error.message || 'Failed to get context' });
  }
};

/**
 * POST /api/rag/follow-up
 * Answer a follow-up question using existing context
 */
export const answerFollowUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query, conversationId, answerLength = 'medium', documentId } = req.body;

    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // Validate answerLength parameter
    const validLengths = ['short', 'medium', 'summary', 'long'];
    const finalAnswerLength = validLengths.includes(answerLength) ? answerLength : 'medium';

    // Follow-ups are handled by the main generateAnswer method
    const result = await ragService.generateAnswer(
      userId,
      query,
      conversationId,
      finalAnswerLength as 'short' | 'medium' | 'summary' | 'long',
      documentId
    );

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      contextId: (result as any).contextId || 'rag-query',
      intent: (result as any).intent || 'content_query',
      confidence: (result as any).confidence || 0.8
    });
  } catch (error: any) {
    console.error('Error in RAG follow-up:', error);

    // ✅ FIX #10: Better Error Messages
    if (error.code && error.statusCode && error.suggestion) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        suggestion: error.suggestion,
        retryable: error.retryable || false,
      });
    } else {
      res.status(500).json({
        error: error.message || 'Failed to answer follow-up',
        code: 'SERVER_ERROR',
        suggestion: 'An unexpected error occurred. Please try again.',
        retryable: true,
      });
    }
  }
};

/**
 * POST /api/rag/query/stream
 * Generate an answer using RAG with SSE streaming
 */
export const queryWithRAGStreaming = async (req: Request, res: Response): Promise<void> => {
  console.time('⚡ RAG Streaming Response Time');

  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query, conversationId, answerLength = 'medium', documentId, attachedFiles, attachedDocuments = [], regenerateMessageId } = req.body;

    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // MULTI-ATTACHMENT SUPPORT: Handle both attachedFiles and attachedDocuments formats
    // Frontend may send either format depending on the component
    const attachedArray = attachedDocuments.length > 0 ? attachedDocuments : attachedFiles || [];
    // ✅ FIX: Only extract IDs (strings), not full objects
    const attachedDocIds = attachedArray
      .map((file: any) => {
        if (typeof file === 'string') return file; // Already an ID
        if (file && file.id) return file.id; // Extract ID from object
        return null; // Skip invalid entries
      })
      .filter(Boolean);
    console.log('📎 [ATTACHED FILES] Received:', attachedArray);
    console.log('📎 [ATTACHED DOCUMENT IDs] Extracted IDs:', attachedDocIds);

    // Use first attached document ID if available, otherwise use documentId
    let effectiveDocumentId = attachedDocIds.length > 0 ? attachedDocIds[0] : documentId;

    // Explicitly null means clear attachment
    if (effectiveDocumentId === null) {
      effectiveDocumentId = undefined;
    }

    console.log(`📎 [STREAMING ATTACHMENT DEBUG] documentId: ${documentId}, attachedDocs: ${attachedDocIds.length}, final: ${effectiveDocumentId}`);

    // Prepare metadata for user message with attached files info
    const userMessageMetadata = attachedArray.length > 0 ? {
      attachedFiles: attachedArray.map((file: any) => ({
        id: file.id,
        name: file.name,
        type: file.type
      }))
    } : null;

    // ========================================
    // ✅ FIX #1: INTENT CLASSIFICATION
    // ========================================
    // 🌍 LANGUAGE DETECTION
    // ========================================
    // Detect user's language from query
    const detectedLanguage = languageDetectionService.detectLanguage(query);
    console.log(`🌍 [LANGUAGE] Detected: ${detectedLanguage}`);

    // ========================================
    // ⚡ PERFORMANCE: Do fast keyword detection FIRST, only fetch conversation history if needed
    const lowerQuery = query.toLowerCase();
    let intentResult: any = null;
    let conversationHistoryForIntent: any[] = [];

    // Simple greetings - skip LLM and skip conversation history fetch
    // ✅ FIX: Use language detection service for better multilingual support
    if (languageDetectionService.isGreeting(query)) {
      intentResult = {
        intent: 'greeting',
        confidence: 1.0,
        parameters: { language: detectedLanguage }
      };
      console.log(`⚡ [FAST KEYWORD] Detected greeting in ${detectedLanguage} (skipped LLM + DB)`);
    }
    // List files - skip LLM and skip conversation history fetch
    // ✅ FIX: Added natural language file type names (excel, word, powerpoint, images)
    else if (/\b(list|show|what|which|how many|quantos|cuantos)\b.*\b(files?|documents?|pdfs?|docx|xlsx|excel|word|powerpoint|ppt|txt|png|jpe?g|images?|pictures?|photos?)\b/i.test(lowerQuery)) {
      // Extract file types if present (support both technical and natural language terms)
      const fileTypes: string[] = [];
      if (/\bpdf/i.test(lowerQuery)) fileTypes.push('pdf');
      if (/\b(docx?|word)\b/i.test(lowerQuery)) fileTypes.push('docx');
      if (/\b(xlsx?|excel|spreadsheet)\b/i.test(lowerQuery)) fileTypes.push('xlsx');
      if (/\b(pptx?|powerpoint|presentation)\b/i.test(lowerQuery)) fileTypes.push('pptx');
      if (/\btxt\b/i.test(lowerQuery)) fileTypes.push('txt');
      if (/\b(png|jpe?g|images?|pictures?|photos?)\b/i.test(lowerQuery)) {
        fileTypes.push('png');
        fileTypes.push('jpg');
        fileTypes.push('jpeg');
      }

      intentResult = {
        intent: 'list_files',
        confidence: 0.95,
        parameters: fileTypes.length > 0 ? { fileTypes } : {}
      };
      console.log(`⚡ [FAST KEYWORD] Detected list_files (skipped LLM + DB)`);
    }
    // Create folder - skip LLM and skip conversation history fetch
    else if (/\b(create|make|new)\b.*\bfolder/i.test(lowerQuery)) {
      // Extract folder name (basic - LLM will handle complex cases)
      const match = lowerQuery.match(/(?:folder|pasta|carpeta|dossier)\s+(?:called|named)?\s*["']?([^"']+)["']?/i);
      const folderName = match ? match[1].trim() : null;

      if (folderName) {
        intentResult = {
          intent: 'create_folder',
          confidence: 0.95,
          parameters: { folderName }
        };
        console.log(`⚡ [FAST KEYWORD] Detected create_folder (skipped LLM + DB)`);
      }
    }

    // ========================================
    // ⚡ SPEED FIX: Fast-path RAG detection (skip LLM intent for obvious RAG queries)
    // ========================================
    // ⚡ FIX: Added all common question words (does, is, are, can, etc.)
    // REASON: Queries like "Does the patient..." were falling through to LLM detection
    // IMPACT: Saves 200-500ms on 30% of queries
    // Check for obvious RAG queries BEFORE falling back to LLM
    if (!intentResult) {
      const isObviousRagQuery = (
        // Comparison queries
        lowerQuery.includes('compare') ||
        lowerQuery.includes('difference') ||
        lowerQuery.includes('vs ') ||
        lowerQuery.includes(' vs') ||
        lowerQuery.includes('versus') ||
        // Question patterns (WH-words)
        lowerQuery.startsWith('what ') ||
        lowerQuery.startsWith('how ') ||
        lowerQuery.startsWith('why ') ||
        lowerQuery.startsWith('when ') ||
        lowerQuery.startsWith('where ') ||
        lowerQuery.startsWith('who ') ||
        lowerQuery.startsWith('which ') ||
        // Question patterns (Yes/No question words) - FIX: Added missing patterns
        lowerQuery.startsWith('does ') ||
        lowerQuery.startsWith('do ') ||
        lowerQuery.startsWith('is ') ||
        lowerQuery.startsWith('are ') ||
        lowerQuery.startsWith('can ') ||
        lowerQuery.startsWith('could ') ||
        lowerQuery.startsWith('should ') ||
        lowerQuery.startsWith('would ') ||
        lowerQuery.startsWith('will ') ||
        lowerQuery.startsWith('did ') ||
        lowerQuery.startsWith('has ') ||
        lowerQuery.startsWith('have ') ||
        lowerQuery.startsWith('had ') ||
        // Instruction patterns
        lowerQuery.startsWith('explain ') ||
        lowerQuery.startsWith('tell me ') ||
        lowerQuery.startsWith('describe ') ||
        lowerQuery.startsWith('summarize ') ||
        lowerQuery.startsWith('summary ') ||
        // Portuguese question patterns
        lowerQuery.startsWith('o que ') ||
        lowerQuery.startsWith('como ') ||
        lowerQuery.startsWith('por que ') ||
        lowerQuery.startsWith('quando ') ||
        lowerQuery.startsWith('onde ') ||
        lowerQuery.startsWith('quem ') ||
        lowerQuery.startsWith('qual ') ||
        lowerQuery.includes('comparar') ||
        // Spanish question patterns
        lowerQuery.startsWith('qué ') ||
        lowerQuery.startsWith('cómo ') ||
        lowerQuery.startsWith('por qué ') ||
        lowerQuery.startsWith('cuándo ') ||
        lowerQuery.startsWith('dónde ') ||
        lowerQuery.startsWith('quién ') ||
        lowerQuery.startsWith('cuál ') ||
        // Document content queries (asking about what's IN documents)
        lowerQuery.includes('in the document') ||
        lowerQuery.includes('in my document') ||
        lowerQuery.includes('from the document') ||
        lowerQuery.includes('no documento') ||
        lowerQuery.includes('en el documento') ||
        // Queries with .pdf, .docx, etc. file extensions (asking about specific files)
        /\.(pdf|docx?|xlsx?|pptx?|txt|csv)\b/i.test(query)
      );

      // Patterns that REQUIRE LLM intent detection (file management actions)
      const needsLlmIntent = (
        lowerQuery.includes('create folder') ||
        lowerQuery.includes('criar pasta') ||
        lowerQuery.includes('crear carpeta') ||
        lowerQuery.includes('move ') ||
        lowerQuery.includes('mover ') ||
        lowerQuery.includes('rename ') ||
        lowerQuery.includes('renomear ') ||
        lowerQuery.includes('delete ') ||
        lowerQuery.includes('excluir ') ||
        lowerQuery.includes('eliminar ')
      );

      if (isObviousRagQuery && !needsLlmIntent) {
        // ⚡ FAST PATH: Skip LLM intent detection for obvious RAG queries
        intentResult = {
          intent: 'rag_query',
          confidence: 0.95,
          parameters: {}
        };
        console.log(`⚡ [FAST INTENT] Obvious RAG query detected - skipping LLM intent detection (saved 3-6s)`);
      }
    }

    // ⚡ PERFORMANCE: Only fetch conversation history if we need LLM (saves 50-150ms DB query)
    if (!intentResult) {
      console.log(`🔍 [OPTIMIZATION] No fast match - fetching conversation history for LLM`);
      conversationHistoryForIntent = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          role: true,
          content: true,
        }
      });
      conversationHistoryForIntent.reverse(); // Chronological order

      intentResult = await llmIntentDetectorService.detectIntent(query, conversationHistoryForIntent);
      console.log(`🧠 [LLM Intent] ${intentResult.intent} (confidence: ${intentResult.confidence})`);
    }

    console.log(`📝 [STREAMING Entities]`, intentResult.parameters);

    // ========================================
    // ✅ FIX #1: FILE ACTION HANDLERS
    // ========================================

    // CREATE_FOLDER
    if (intentResult.intent === 'create_folder' && intentResult.parameters.folderName) {
      console.log(`📁 [STREAMING ACTION] Creating folder: "${intentResult.parameters.folderName}"`);

      // ✅ FIX: Set up SSE headers FIRST, before doing work
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send "connected" event immediately
      res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

      // Now execute the action
      const result = await fileActionsService.createFolder({
        userId,
        folderName: intentResult.parameters.folderName
      }, query);

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        },
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'create_folder',
            success: result.success,
            data: result.data
          })
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // ✅ NEW: Send action event with notification data for create_folder
      res.write(`data: ${JSON.stringify({
        type: 'action',
        actionType: 'create_folder',
        success: result.success,
        notification: {
          type: result.success ? 'success' : 'error',
          message: result.message,
          folderName: intentResult.parameters.folderName
        }
      })}\n\n`);

      // Send the response content
      res.write(`data: ${JSON.stringify({ type: 'content', content: result.message })}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        userMessage,
        assistantMessage,
        sources: []
      })}\n\n`);
      res.end();
      console.timeEnd('⚡ RAG Streaming Response Time');
      return;
    }

    // MOVE_FILES
    if (intentResult.intent === 'move_files' && intentResult.parameters.filename && intentResult.parameters.targetFolder) {
      console.log(`📁 [STREAMING ACTION] Moving file: "${intentResult.parameters.filename}" to "${intentResult.parameters.targetFolder}"`);

      // ✅ FIX: Set up SSE headers FIRST, before doing work
      // This immediately establishes the connection so frontend knows request is being processed
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send "connected" event immediately
      res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

      // Now execute the action (this may take a few seconds)
      const result = await fileActionsService.executeAction(query, userId);

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        },
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'move_file',
            success: result.success
          })
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // ✅ NEW: Send action event with notification data for move_files
      res.write(`data: ${JSON.stringify({
        type: 'action',
        actionType: 'move_file',
        success: result.success,
        notification: {
          type: result.success ? 'success' : 'error',
          message: result.message,
          filename: intentResult.parameters.filename,
          targetFolder: intentResult.parameters.targetFolder
        }
      })}\n\n`);

      // Send the response content
      res.write(`data: ${JSON.stringify({ type: 'content', content: result.message })}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        userMessage,
        assistantMessage,
        sources: []
      })}\n\n`);
      res.end();
      console.timeEnd('⚡ RAG Streaming Response Time');
      return;
    }

    // RENAME_FILE
    if (intentResult.intent === 'rename_file' && intentResult.parameters.oldFilename && intentResult.parameters.newFilename) {
      console.log(`📁 [STREAMING ACTION] Renaming: "${intentResult.parameters.oldFilename}" to "${intentResult.parameters.newFilename}"`);

      // ✅ FIX: Set up SSE headers FIRST, before doing work
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send "connected" event immediately
      res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

      // Now execute the action
      const result = await fileActionsService.executeAction(query, userId);

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        },
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'rename_file',
            success: result.success
          })
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // ✅ NEW: Send action event with notification data for rename_file
      res.write(`data: ${JSON.stringify({
        type: 'action',
        actionType: 'rename_file',
        success: result.success,
        document: result.data?.document,
        notification: {
          type: result.success ? 'success' : 'error',
          message: result.message,
          oldName: intentResult.parameters.oldFilename,
          newName: intentResult.parameters.newFilename
        }
      })}\n\n`);

      // Send the response content
      res.write(`data: ${JSON.stringify({ type: 'content', content: result.message })}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        userMessage,
        assistantMessage,
        sources: []
      })}\n\n`);
      res.end();
      console.timeEnd('⚡ RAG Streaming Response Time');
      return;
    }

    // DELETE_FILE
    if (intentResult.intent === 'delete_file' && intentResult.parameters.filename) {
      console.log(`📁 [STREAMING ACTION] Deleting: "${intentResult.parameters.filename}"`);

      // ✅ FIX: Set up SSE headers FIRST, before doing work
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send "connected" event immediately
      res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

      // Now execute the action
      const result = await fileActionsService.executeAction(
        query,
        userId
      );

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        },
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'delete_file',
            success: result.success
          })
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // ✅ NEW: Send action event with notification data for delete_file
      res.write(`data: ${JSON.stringify({
        type: 'action',
        actionType: 'delete_file',
        success: result.success,
        notification: {
          type: result.success ? 'success' : 'error',
          message: result.message,
          filename: intentResult.parameters.filename
        }
      })}\n\n`);

      // Send the response content
      res.write(`data: ${JSON.stringify({ type: 'content', content: result.message })}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        userMessage,
        assistantMessage,
        sources: []
      })}\n\n`);
      res.end();
      console.timeEnd('⚡ RAG Streaming Response Time');
      return;
    }

    // SHOW_FILE
    if (intentResult.intent === 'show_file' && intentResult.parameters.filename) {
      console.log(`👁️ [STREAMING ACTION] Showing file: "${intentResult.parameters.filename}"`);

      // ✅ FIX: Set up SSE headers FIRST, before doing work
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send "connected" event immediately
      res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

      // Now execute the action
      const result = await fileActionsService.showFile({
        userId,
        filename: intentResult.parameters.filename
      }, query, conversationHistoryForIntent);

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        },
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.message,
          metadata: JSON.stringify({
            actionType: 'show_file',
            success: result.success,
            document: result.data?.document,
            action: result.data?.action
          })
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // ✅ NEW: Send show_file_modal action to trigger modal with attachOnClose
      if (result.success && result.data?.document) {
        res.write(`data: ${JSON.stringify({
          type: 'action',
          actionType: 'show_file_modal',
          success: true,
          document: result.data.document,
          attachOnClose: true  // Flag to attach file when modal closes
        })}\n\n`);
      }

      // Send the response content
      res.write(`data: ${JSON.stringify({ type: 'content', content: result.message })}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        userMessage,
        assistantMessage,
        sources: []
      })}\n\n`);
      res.end();
      console.timeEnd('⚡ RAG Streaming Response Time');
      return;
    }

    // FILE_LOCATION
    if (intentResult.intent === 'file_location' && intentResult.parameters.filename) {
      console.log(`📍 [STREAMING] Finding: "${intentResult.parameters.filename}"`);

      // ✅ FIX: Set up SSE headers FIRST, before doing work
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send "connected" event immediately
      res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

      // Now execute the action
      const systemMetadataService = require('../services/systemMetadata.service').default;
      const fileLocation = await systemMetadataService.findFileLocation(userId, intentResult.parameters.filename);

      let responseMessage: string;
      if (fileLocation) {
        responseMessage = `📍 **${fileLocation.filename}** is stored in:\n\n${fileLocation.location}`;
      } else {
        responseMessage = `❌ I couldn't find a file named "${intentResult.parameters.filename}" in your library.`;
      }

      // Ensure conversation exists before creating messages
      await ensureConversationExists(conversationId, userId);

      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
        },
      });

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: responseMessage,
          metadata: JSON.stringify({
            actionType: 'file_location',
            fileLocation
          })
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Send the response content
      res.write(`data: ${JSON.stringify({ type: 'content', content: responseMessage })}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        formattedAnswer: responseMessage,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        sources: [],
        conversationId
      })}\n\n`);
      res.end();
      console.timeEnd('⚡ RAG Streaming Response Time');
      return;
    }

    // ========================================
    // LIST_FILES and METADATA_QUERY Handlers
    // ========================================
    if (intentResult.intent === 'list_files' || intentResult.intent === 'metadata_query') {
      console.log(`📊 [STREAMING] Handling ${intentResult.intent}`);

      // Call the handler from chat.service.ts
      const { handleFileActionsIfNeeded } = require('../services/chat.service');
      const result = await handleFileActionsIfNeeded(userId, query, conversationId);

      if (result) {
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Send connected event
        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

        // Ensure conversation exists before creating messages
        await ensureConversationExists(conversationId, userId);

        const userMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'user',
            content: query,
            metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null
          },
        });

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: result.message,
            metadata: JSON.stringify({
              actionType: result.action,
              success: true
            })
          },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Send the response content
        res.write(`data: ${JSON.stringify({ type: 'content', content: result.message })}\n\n`);
        res.write(`data: ${JSON.stringify({
          type: 'done',
          userMessage,
          assistantMessage,
          sources: []
        })}\n\n`);
        res.end();
        console.timeEnd('⚡ RAG Streaming Response Time');
        return;
      }
    }

    // ========================================
    // ✅ FIX #8: FALLBACK TO RAG
    // ========================================
    // If no file action matched above, fall through to RAG query
    // This handles: rag_query, greeting, and unknown intents
    console.log(`📚 [FALLBACK] Falling through to RAG query for intent: ${intentResult.intent}`);

    // ========================================
    // ✅ P0 FEATURES: Pre-process query for multi-turn conversations
    // ========================================
    // This handles: Follow-up understanding, query rewriting, scope management, calculation detection
    let processedQuery = query;
    let p0PreProcess: any = null;

    try {
      p0PreProcess = await p0FeaturesService.preProcessQuery(query, userId, conversationId);
      processedQuery = p0PreProcess.processedQuery;

      // Log P0 processing results
      if (p0PreProcess.wasRewritten) {
        console.log(`✅ [P0] Query rewritten: "${query}" → "${processedQuery}"`);
      }
      if (p0PreProcess.isRefinement) {
        console.log(`🔍 [P0] Refinement query - searching within ${p0PreProcess.scopeDocumentIds.length} documents`);
      }
      if (p0PreProcess.requiresCalculation) {
        console.log(`🧮 [P0] Calculation required: ${p0PreProcess.calculationType}`);
      }
    } catch (error) {
      console.error('❌ [P0] Pre-processing failed, using original query:', error);
      // Continue with original query - graceful degradation
    }

    // Validate answerLength parameter
    const validLengths = ['short', 'medium', 'summary', 'long'];
    const finalAnswerLength = validLengths.includes(answerLength) ? answerLength : 'medium';

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);
    console.log('🚀 [DEBUG] Sent connected event');

    // Add keepalive pings every 15 seconds to prevent timeout
    const keepaliveInterval = setInterval(() => {
      res.write(': keepalive\n\n');
      if (res.flush) res.flush();
    }, 15000);

    // Clean up interval when done
    res.on('close', () => {
      clearInterval(keepaliveInterval);
    });

    // Ensure conversation exists before creating messages
    await ensureConversationExists(conversationId, userId);

    // ✅ FIX: Check if this is the first message BEFORE saving the user message
    // This ensures greeting only appears on the very first message of the conversation
    const existingMessageCount = await prisma.message.count({
      where: { conversationId }
    });
    const isFirstMessage = existingMessageCount === 0;
    console.log(`👋 [GREETING CHECK - STREAMING] Conversation ${conversationId}: ${existingMessageCount} existing messages, isFirstMessage: ${isFirstMessage}`);

    // ✅ REGENERATION: Skip creating user message if we're regenerating an existing response
    let userMessage: any;
    if (regenerateMessageId) {
      console.log(`🔄 [REGENERATE] Regenerating message ${regenerateMessageId}, skipping user message creation`);
      // Find the original user message for this assistant message
      const assistantMsg = await prisma.message.findUnique({
        where: { id: regenerateMessageId }
      });
      if (assistantMsg) {
        const originalUserMsg = await prisma.message.findFirst({
          where: {
            conversationId,
            role: 'user',
            createdAt: { lt: assistantMsg.createdAt }
          },
          orderBy: { createdAt: 'desc' }
        });
        userMessage = originalUserMsg;
      }
    } else {
      // Save user message to database with attached files metadata
      userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: query,
          metadata: userMessageMetadata ? JSON.stringify(userMessageMetadata) : null,
        },
      });
    }

    // Generate streaming RAG answer with error handling
    let fullAnswer = '';
    let result: any = { answer: '', sources: [], contextId: undefined };
    try {
      console.log('🚀 [DEBUG] About to call generateAnswerStream');
      console.log('🚀 [DEBUG] userId:', userId);
      console.log('🚀 [DEBUG] processedQuery:', processedQuery);
      console.log('🚀 [DEBUG] conversationId:', conversationId);

      // ✅ P0 FEATURES: Use processedQuery (may be rewritten) instead of original query
      // ✅ FIX: Use NEW generateAnswerStream (hybrid RAG with document detection + post-processing)
      // ✅ FIX #1: Pass conversation history for context-aware responses
      // ✅ FIX: Pass isFirstMessage to control greeting logic (only greet on first message ever)
      const streamResult = await ragService.generateAnswerStream(
        userId,
        processedQuery, // ✅ P0: Use processed/rewritten query
        conversationId,
        (chunk: string) => {
          console.log('🚀 [DEBUG] onChunk called with chunk length:', chunk.length);
          console.log('🚀 [DEBUG] Chunk full content:', chunk);
          console.log('🚀 [DEBUG] Checking for marker...');
          console.log('🚀 [DEBUG] Contains marker?:', chunk.includes('__DOCUMENT_GENERATION_REQUESTED__:'));

          // Check if this is a document generation marker - don't send to client
          if (chunk.includes('__DOCUMENT_GENERATION_REQUESTED__:')) {
            console.log('📝 [RAG CONTROLLER] Intercepted document generation marker - not sending to client');
            fullAnswer += chunk;
            return; // Don't send marker to client
          }

          fullAnswer += chunk;
          // Stream each chunk to client
          console.log('🚀 [DEBUG] Writing chunk to SSE stream...');
          res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
          if (res.flush) res.flush(); // Force immediate send
          console.log('🚀 [DEBUG] Chunk written and flushed');
        },
        effectiveDocumentId,
        conversationHistoryForIntent,  // Pass conversation history for context
        undefined,  // onStage
        undefined,  // memoryContext
        undefined,  // fullConversationContext
        isFirstMessage,  // ✅ Pass first message flag for greeting logic
        detectedLanguage  // ✅ FIX: Pass detected language to RAG service
      );

      console.log('🚀 [DEBUG] generateAnswerStream completed');
      console.log('🚀 [DEBUG] fullAnswer length:', fullAnswer.length);
      console.log('🚀 [DEBUG] streamResult.sources length:', streamResult.sources?.length);

      // ✅ FIX: Use actual sources from generateAnswerStream, not hardcoded empty array!
      result = {
        answer: fullAnswer,
        sources: streamResult.sources || [],
        contextId: undefined
      };
    } catch (ragError: any) {
      // ✅ FIX #2: Stream user-friendly error message
      console.error('❌ RAG Streaming Error:', ragError);

      // Sanitize error message - show user-friendly message instead of technical details
      // ✅ FIX: Use localized error message based on detected language
      const userFriendlyMessage = languageDetectionService.getLocalizedError('general_error', detectedLanguage);

      // Stream user-friendly message
      res.write(`data: ${JSON.stringify({ type: 'content', content: userFriendlyMessage })}\n\n`);

      // Save user-friendly message to database
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: userFriendlyMessage
        }
      });

      // Send done signal
      res.write(`data: ${JSON.stringify({
        type: 'done',
        formattedAnswer: userFriendlyMessage,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        sources: [],
        conversationId
      })}\n\n`);

      res.end();
      console.timeEnd('⚡ RAG Streaming Response Time');
      return;
    }

    // ========================================
    // ✅ FIX #4: POST-PROCESS RESPONSE
    // ========================================
    // Use responsePostProcessor service for consistent formatting
    let cleanedAnswer = responsePostProcessor.process(result.answer, result.sources || []);
    let generatedChatDocument: any = null; // Store chat document for the done event
    console.log('✅ [POST-PROCESSING] Applied responsePostProcessor formatting (warnings, spacing, next steps limiting)');

    // ========================================
    // ✅ P0 FEATURES: Post-process response for calculations and context updates
    // ========================================
    try {
      if (p0PreProcess) {
        const p0PostProcess = await p0FeaturesService.postProcessResponse(
          query,
          cleanedAnswer,
          result.sources || [],
          userId,
          conversationId,
          p0PreProcess
        );

        // Apply P0 post-processing results
        cleanedAnswer = p0PostProcess.answer;

        if (p0PostProcess.calculationResult) {
          console.log(`🧮 [P0] Calculation added: ${p0PostProcess.calculationResult.explanation}`);
        }
        if (p0PostProcess.scopeUpdated) {
          console.log(`📊 [P0] Scope updated: ${p0PostProcess.newScopeDescription}`);
        }
      }
    } catch (error) {
      console.error('❌ [P0] Post-processing failed, using original answer:', error);
      // Continue with original cleanedAnswer - graceful degradation
    }

    // ✅ FIX #2: Deduplicate sources by documentId (or filename if documentId is null)
    console.log(`🔍 [DEBUG - DEDUP] result.sources:`, result.sources);
    console.log(`🔍 [DEBUG - DEDUP] First source:`, result.sources?.[0]);

    const uniqueSources = result.sources ?
      Array.from(new Map(result.sources.map((src: any) => {
        const key = src.documentId || src.documentName || `${src.documentName}-${src.pageNumber}`;
        console.log(`🔍 [DEBUG - DEDUP] Source: documentId=${src.documentId}, documentName=${src.documentName}, key=${key}`);
        return [key, src];
      })).values())
      : [];
    console.log(`✅ [DEDUPLICATION] ${result.sources?.length || 0} sources → ${uniqueSources.length} unique sources`);

    // ✅ FIX #7: Filter sources for query-specific documents
    // But keep ALL mentioned documents for comparison queries
    let filteredSources = uniqueSources;

    // Check for comparison keywords - if comparing, show ALL mentioned docs
    const isComparisonQuery = /\b(compare|comparison|vs|versus|difference|between|contrast)\b/i.test(query);

    // Find ALL mentioned files in the query
    const mentionedFiles = uniqueSources.filter((src: any) => {
      // ✅ FIX: Use documentName (consistent with rag.service.ts output)
      const filename = src.documentName?.toLowerCase() || src.filename?.toLowerCase() || '';
      const cleanFilename = filename.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');
      return lowerQuery.includes(cleanFilename) || lowerQuery.includes(filename);
    });

    if (mentionedFiles.length > 0) {
      if (isComparisonQuery || mentionedFiles.length >= 2) {
        // For comparisons or multiple mentioned files, show ALL mentioned documents
        filteredSources = mentionedFiles;
        console.log(`✅ [SOURCE FILTERING] Comparison query with ${mentionedFiles.length} mentioned documents`);
      } else {
        // Single file mentioned (non-comparison) - filter to just that one
        filteredSources = mentionedFiles;
        console.log(`✅ [SOURCE FILTERING] Query mentions "${mentionedFiles[0].documentName}", filtered to 1 source`);
      }
    } else {
      filteredSources = uniqueSources;
    }

    // Save assistant message to database with RAG metadata
    // ✅ REGENERATION: Update existing message if regenerating, otherwise create new
    let assistantMessage: any;
    if (regenerateMessageId) {
      console.log(`🔄 [REGENERATE] Updating existing message ${regenerateMessageId}`);
      assistantMessage = await prisma.message.update({
        where: { id: regenerateMessageId },
        data: {
          content: cleanedAnswer,
          metadata: JSON.stringify({
            ragSources: filteredSources,
            contextId: (result as any).contextId || 'rag-query',
            intent: (result as any).intent || 'content_query',
            confidence: (result as any).confidence || 0.8,
            answerLength: finalAnswerLength,
            regeneratedAt: new Date().toISOString()
          })
        },
      });
    } else {
      assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: cleanedAnswer,
          metadata: JSON.stringify({
            ragSources: filteredSources,
            contextId: (result as any).contextId || 'rag-query',
            intent: (result as any).intent || 'content_query',
            confidence: (result as any).confidence || 0.8,
            answerLength: finalAnswerLength
          }),
        },
      });
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // DOCUMENT GENERATION HANDLER
    // ════════════════════════════════════════════════════════════════════════════════
    // Check if the answer contains document generation marker
    if (cleanedAnswer.includes('__DOCUMENT_GENERATION_REQUESTED__:')) {
      console.log('📝 [RAG CONTROLLER] Detected document generation marker in answer');

      // Extract document type from marker
      const markerMatch = cleanedAnswer.match(/__DOCUMENT_GENERATION_REQUESTED__:(\w+)/);
      const documentType = markerMatch ? markerMatch[1] as 'summary' | 'report' | 'analysis' | 'general' : 'general';

      console.log(`📝 [RAG CONTROLLER] Triggering ${documentType} document generation`);

      try {
        // Import document generation service
        const chatDocGenService = await import('../services/chatDocumentGeneration.service');

        // Stream progress message to client
        const progressMessage = `\n\n📝 Generating your ${documentType}...\n\n`;
        res.write(`data: ${JSON.stringify({ type: 'content', content: progressMessage })}\n\n`);
        if (res.flush) res.flush();

        // Generate document
        const docResult = await chatDocGenService.generateDocument({
          userId,
          conversationId,
          messageId: assistantMessage.id,
          query,
          documentType,
        });

        // Store chat document for the done event
        generatedChatDocument = docResult.chatDocument;

        // Update assistant message with generated document content
        await prisma.message.update({
          where: { id: assistantMessage.id },
          data: {
            content: docResult.message,
          },
        });

        // Update cleanedAnswer for the done event
        cleanedAnswer = docResult.message;

        console.log(`✅ [RAG CONTROLLER] Document generated successfully: ${docResult.chatDocument.id}`);

        // Stream final message
        res.write(`data: ${JSON.stringify({ type: 'content', content: '\n' + docResult.message })}\n\n`);
        if (res.flush) res.flush();
      } catch (docGenError: any) {
        console.error('❌ [RAG CONTROLLER] Document generation failed:', docGenError);
        console.error('❌ [RAG CONTROLLER] Error message:', docGenError?.message);
        console.error('❌ [RAG CONTROLLER] Error stack:', docGenError?.stack);
        const errorMessage = '\n\n❌ Failed to generate document. Please try again.';

        await prisma.message.update({
          where: { id: assistantMessage.id },
          data: {
            content: cleanedAnswer + errorMessage,
          },
        });

        cleanedAnswer += errorMessage;

        res.write(`data: ${JSON.stringify({ type: 'content', content: errorMessage })}\n\n`);
        if (res.flush) res.flush();
      }
    }

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // ✅ FIX: Invalidate conversation cache so refresh shows latest messages
    cacheService.invalidateConversationCache(userId, conversationId)
      .then(() => console.log(`🗑️  [Cache] Invalidated conversation cache for ${conversationId.substring(0, 8)}...`))
      .catch(err => console.error('❌ Error invalidating cache:', err));

    // Auto-generate conversation title (non-blocking)
    const messageCount = await prisma.message.count({
      where: { conversationId }
    });

    if (messageCount === 2) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { title: true }
      });

      const currentTitle = conversation?.title || '';
      const shouldGenerate = currentTitle === '' || currentTitle === 'New Chat';

      if (conversation && shouldGenerate) {
        generateConversationTitle(query)
          .then(async (generatedTitle) => {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { title: generatedTitle }
            });

            try {
              const io = getIO();
              io.to(`user:${userId}`).emit('conversation:updated', {
                conversationId,
                title: generatedTitle,
                updatedAt: new Date()
              });
            } catch (wsError) {
              console.warn('⚠️  WebSocket not available for title update');
            }
          })
          .catch((error) => {
            console.error('❌ Failed to generate conversation title:', error);
          });
      }
    }

    // ✅ DOCUMENT CREATION: Auto-generate PDF for creation queries
    // Check if this was a document creation request (e.g., "create a summary report")
    const queryLower = query.toLowerCase();
    const isCreationQuery = /(?:create|make|generate|build|write|draft|prepare|compose|criar|gerar|hacer|generar|créer)/i.test(queryLower);
    const isDocumentRequest = /(?:document|report|summary|file|pdf|docx)/i.test(queryLower);

    let generatedDocument: any = null;
    if (isCreationQuery && isDocumentRequest) {
      console.log('📄 [AUTO-DOCUMENT] Detected document creation request, generating comprehensive document...');
      try {
        // Extract title from query or use default
        const titleMatch = query.match(/(?:summary|report)\s+(?:of|about|for|on)\s+(.+?)(?:\?|$)/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Summary Report';

        console.log('📝 [AUTO-DOCUMENT] Generating long-form document content with Claude...');

        // Generate comprehensive document content using Claude
        const documentPrompt = `You are generating a professional business document. Based on the following information, create a comprehensive, well-structured document with multiple sections.

Title: ${title}

Information to include:
${cleanedAnswer}

Please generate a professional document with:
1. An "Executive Summary" section (2-3 paragraphs) that provides a high-level overview
2. Multiple detailed sections with clear headings (H2 level with ##)
3. Each section should have 2-4 paragraphs of detailed content
4. Use proper markdown formatting (headers, bold, lists, etc.)
5. Make it comprehensive and professional - similar to a business report
6. Include relevant details, insights, and context
7. Total length should be at least 800-1200 words

Format the document using markdown with proper structure. Do NOT include the title or date headers - just start with the Executive Summary section.`;

        const documentContentResponse = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          system: 'You are a professional business document writer. Generate comprehensive, well-structured documents with executive summaries and detailed sections.',
          messages: [{ role: 'user', content: documentPrompt }]
        });

        const documentContent = documentContentResponse.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n\n');

        console.log(`✅ [AUTO-DOCUMENT] Generated ${documentContent.length} characters of document content`);

        generatedDocument = await chatDocumentGenerationService.generateDocument({
          userId,
          content: documentContent,
          title,
          conversationId,
        });

        console.log(`✅ [AUTO-DOCUMENT] PDF created: ${generatedDocument.documentId}`);
      } catch (docError) {
        console.error('❌ [AUTO-DOCUMENT] Failed to create PDF:', docError);
        // Don't fail the whole request if document creation fails
      }
    }

    // Send completion signal with metadata AND formatted answer
    console.log('🚀 [DEBUG] About to send done event');
    console.log('📄 [DEBUG] generatedChatDocument:', generatedChatDocument ? `{id: "${generatedChatDocument.id}", title: "${generatedChatDocument.title}"}` : 'null');
    res.write(`data: ${JSON.stringify({
      type: 'done',
      formattedAnswer: cleanedAnswer, // ✅ Send post-processed answer (next steps limited)
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      sources: filteredSources || [], // ✅ FIX #1: Always send sources (empty array if none)
      contextId: (result as any).contextId || 'rag-query',
      intent: (result as any).intent || 'content_query',
      confidence: (result as any).confidence || 0.8,
      actions: (result as any).actions || [] || [],
      uiUpdate: result.uiUpdate,
      conversationId,
      generatedDocument: generatedDocument || undefined, // ✅ Include generated document info
      chatDocument: generatedChatDocument || undefined, // ✅ Include chat document for display
    })}\n\n`);
    console.log('🚀 [DEBUG] Done event sent');

    clearInterval(keepaliveInterval); // Clean up keepalive
    res.end();
    console.log('🚀 [DEBUG] Response ended');
    console.timeEnd('⚡ RAG Streaming Response Time');

  } catch (error: any) {
    console.error('❌ Error in RAG streaming:', error);

    // ✅ FIX #10: Better Error Messages for streaming
    const errorResponse = {
      type: 'error',
      error: error.message || 'Failed to generate RAG answer',
      code: error.code || 'SERVER_ERROR',
      suggestion: error.suggestion || 'An unexpected error occurred. Please try again.',
      retryable: error.retryable !== false, // Default to true
    };

    res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
    res.end();
  }
};
