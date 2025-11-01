import { Request, Response } from 'express';
import ragService from '../services/rag.service';
import prisma from '../config/database';
import { getIO } from '../services/websocket.service';
import navigationService from '../services/navigation.service';
import intentService from '../services/intent.service';
import { Intent } from '../types/intent.types';
import fileActionsService from '../services/fileActions.service';
import { generateConversationTitle } from '../services/gemini.service';

/**
 * RAG Controller
 * Handles RAG-powered chat queries
 */

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

    const { query, conversationId, answerLength = 'medium', attachedFile, documentId } = req.body;

    // Validate answerLength parameter
    const validLengths = ['short', 'medium', 'summary', 'long'];
    const finalAnswerLength = validLengths.includes(answerLength) ? answerLength : 'medium';

    // CRITICAL FIX: Clear documentId if it's explicitly null/undefined to prevent sticky attachment
    const cleanDocumentId = documentId || undefined;
    console.log(`📎 [ATTACHMENT DEBUG] documentId from request: ${documentId}, cleaned: ${cleanDocumentId}`);
    console.log(`📎 [ATTACHMENT DEBUG] attachedFile from request:`, attachedFile);
    console.log(`📏 [ANSWER LENGTH] ${finalAnswerLength}`);

    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // ========================================
    // INTENT CLASSIFICATION (New Brain - Ordered Pattern Matching)
    // ========================================
    const intentResult = intentService.detectIntent(query);
    console.log(`🎯 [INTENT] ${intentResult.intent} (confidence: ${intentResult.confidence})`);
    console.log(`📝 [ENTITIES]`, intentResult.entities);

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

      const userMessage = await prisma.message.create({
        data: { conversationId, role: 'user', content: query }
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

      const userMessage = await prisma.message.create({
        data: { conversationId, role: 'user', content: query }
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

      return res.json({
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

        return res.json({
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

      const userMessage = await prisma.message.create({
        data: { conversationId, role: 'user', content: query }
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

      return res.json({
        success: true,
        answer: filesListAnswer,
        sources: [],
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

      const result = await fileActionsService.createFolder(
        intentResult.entities.folderName,
        userId
      );

      const userMessage = await prisma.message.create({
        data: { conversationId, role: 'user', content: query }
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

      return res.json({
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

      const userMessage = await prisma.message.create({
        data: { conversationId, role: 'user', content: query }
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

      return res.json({
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

      const userMessage = await prisma.message.create({
        data: { conversationId, role: 'user', content: query }
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

      return res.json({
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

      const userMessage = await prisma.message.create({
        data: { conversationId, role: 'user', content: query }
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

      return res.json({
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

        return res.json({
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

        return res.json({
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

        return res.json({
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

        return res.json({
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

        return res.json({
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

    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: query,
        metadata: attachedFile ? JSON.stringify({ attachedFile }) : null,
      },
    });

    // Generate RAG answer with answer length control
    const result = await ragService.generateAnswer(
      userId,
      query,
      conversationId,
      finalAnswerLength as 'short' | 'medium' | 'summary' | 'long',
      cleanDocumentId
    );

    // Save assistant message to database with RAG metadata
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.answer,
        metadata: JSON.stringify({
          ragSources: result.sources,
          contextId: result.contextId,
          intent: result.intent,
          confidence: result.confidence,
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
      sources: result.sources,
      expandedQuery: result.expandedQuery,
      contextId: result.contextId,
      actions: result.actions || [],
      userMessage,
      assistantMessage
    });
  } catch (error: any) {
    console.error('Error in RAG query:', error);
    res.status(500).json({ error: error.message || 'Failed to generate RAG answer' });
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
      contextId: result.contextId,
      intent: result.intent,
      confidence: result.confidence
    });
  } catch (error: any) {
    console.error('Error in RAG follow-up:', error);
    res.status(500).json({ error: error.message || 'Failed to answer follow-up' });
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

    const { query, conversationId, answerLength = 'medium', documentId } = req.body;

    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // Validate answerLength parameter
    const validLengths = ['short', 'medium', 'summary', 'long'];
    const finalAnswerLength = validLengths.includes(answerLength) ? answerLength : 'medium';

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: query,
        metadata: documentId ? JSON.stringify({ documentId }) : null,
      },
    });

    // Generate streaming RAG answer
    const result = await ragService.generateAnswerStreaming(
      userId,
      query,
      conversationId,
      finalAnswerLength as 'short' | 'medium' | 'summary' | 'long',
      documentId,
      (chunk: string) => {
        // Stream each chunk to client
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
      }
    );

    // Save assistant message to database with RAG metadata
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.answer,
        metadata: JSON.stringify({
          ragSources: result.sources,
          contextId: result.contextId,
          intent: result.intent,
          confidence: result.confidence,
          answerLength: finalAnswerLength
        }),
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

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

    // Send completion signal with metadata AND formatted answer
    res.write(`data: ${JSON.stringify({
      type: 'done',
      formattedAnswer: result.answer, // ✅ Include formatted answer with bold
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      sources: result.sources,
      contextId: result.contextId,
      intent: result.intent,
      confidence: result.confidence,
      actions: result.actions || [],
      uiUpdate: result.uiUpdate,
      conversationId
    })}\n\n`);

    res.end();
    console.timeEnd('⚡ RAG Streaming Response Time');

  } catch (error: any) {
    console.error('❌ Error in RAG streaming:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message || 'Failed to generate RAG answer'
    })}\n\n`);
    res.end();
  }
};
