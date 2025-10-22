import prisma from '../config/database';
import { sendMessageToGemini, sendMessageToGeminiWithoutFunctions, ChatMessage, GeminiResponse, generateConversationTitle } from './gemini.service';
import * as folderService from './folder.service';
import * as documentService from './document.service';
import { detectLanguage } from './languageDetection.service';
import documentResolverService from './documentResolver.service';
import queryParserService from './intelligentQueryParser.service';
import chatDocumentGenerationService from './chatDocumentGeneration.service';
import semanticCacheService from './semanticCache.service';
import contextOptimizationService from './contextOptimization.service';

/**
 * Extract a text excerpt around the search query
 */
function extractExcerpt(text: string, query: string, contextChars: number = 150): string {
  if (!text) return '';

  // Find query position (case-insensitive)
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const pos = textLower.indexOf(queryLower);

  if (pos === -1) {
    // Query not found, return beginning
    return text.substring(0, contextChars) + '...';
  }

  // Extract context around query
  const start = Math.max(0, pos - contextChars);
  const end = Math.min(text.length, pos + query.length + contextChars);

  let excerpt = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';

  // Highlight the query in the excerpt (using markdown bold)
  const excerptLower = excerpt.toLowerCase();
  const queryPos = excerptLower.indexOf(queryLower);
  if (queryPos !== -1) {
    const before = excerpt.substring(0, queryPos);
    const match = excerpt.substring(queryPos, queryPos + query.length);
    const after = excerpt.substring(queryPos + query.length);
    excerpt = `${before}**${match}**${after}`;
  }

  return excerpt;
}

export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface SendMessageInput {
  userId: string;
  conversationId: string;
  content: string;
  attachedDocumentId?: string; // Optional document ID for file attachments
  useResearch?: boolean; // Optional research mode (default: false) - Only enable web search when true
}

/**
 * Create a new conversation
 */
export const createConversation = async (input: CreateConversationInput) => {
  const conversation = await prisma.conversation.create({
    data: {
      userId: input.userId,
      title: input.title || 'New Chat',
    },
  });

  return conversation;
};

/**
 * Get all conversations for a user
 */
export const getUserConversations = async (userId: string) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1, // Get last message for preview
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return conversations;
};

/**
 * Get a single conversation with all messages
 */
export const getConversation = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.userId !== userId) {
    throw new Error('Unauthorized access to conversation');
  }

  // Deduplicate messages by ID (shouldn't happen but be defensive)
  const seenIds = new Set<string>();
  const uniqueMessages = conversation.messages.filter(msg => {
    if (seenIds.has(msg.id)) {
      console.warn(`⚠️ Duplicate message ID found in conversation ${conversationId}: ${msg.id}`);
      return false;
    }
    seenIds.add(msg.id);
    return true;
  });

  return {
    ...conversation,
    messages: uniqueMessages,
  };
};

/**
 * Send a message in a conversation
 */
export const sendMessage = async (input: SendMessageInput) => {
  const { userId, conversationId, content, attachedDocumentId } = input;

  // Verify conversation belongs to user
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      user: {
        select: {
          firstName: true,
          email: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Check if this is the first message in the conversation (for title generation later)
  const isFirstMessage = conversation.messages.length === 0;

  // Build metadata for attached document (if any)
  let metadata = null;
  if (attachedDocumentId) {
    const attachedDoc = await prisma.document.findUnique({
      where: { id: attachedDocumentId },
    });

    if (attachedDoc && attachedDoc.userId === userId) {
      metadata = JSON.stringify({
        attachedFile: {
          id: attachedDoc.id,
          name: attachedDoc.filename,
          type: attachedDoc.mimeType,
        },
      });
    }
  }

  // Save user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content,
      metadata,
    },
  });

  // Build conversation history for Gemini
  const history: ChatMessage[] = conversation.messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Get user's first name for personalization
  const userName = conversation.user.firstName || conversation.user.email.split('@')[0];

  // ⚡ PERFORMANCE OPTIMIZATION: Only fetch document count (not full data!)
  // Full document list is ONLY fetched when AI calls list_documents or search_documents
  const documentCount = await prisma.document.count({
    where: { userId },
  });

  // ✅ MINIMAL CONTEXT: Only tell AI how many documents exist, not list them all!
  // This reduces context from ~5000 tokens (with 28 files) to ~100 tokens
  const documentContext = `\n\n📚 **Your Document Library:** ${documentCount} documents uploaded

CRITICAL: When user asks about documents:
1. Use search_documents function to find the specific document first
2. Then use analyze_document function with the document ID from search results
3. NEVER make up information about documents
4. If you need to see all documents, use list_documents function`;

  // SEMANTIC DOCUMENT RESOLUTION: Try to resolve documents from natural language
  let aiContent = content;
  let resolvedDocuments: any[] = [];

  // Parse the query to detect if it references documents
  const queryAnalysis = queryParserService.parseQuery(content);

  // If query requires a document but no document is attached, try to resolve it
  if (queryAnalysis.requiresDocument && !attachedDocumentId) {
    console.log('🔍 Query requires document, attempting semantic resolution...');
    console.log(queryParserService.formatAnalysis(queryAnalysis));

    try {
      const resolutionResult = await documentResolverService.resolveDocumentWithThreshold(userId, content, 0.5);

      if (resolutionResult.success && resolutionResult.documents.length > 0) {
        resolvedDocuments = resolutionResult.documents;
        console.log(`✅ Resolved ${resolvedDocuments.length} matching document(s)`);

        // If we have a high-confidence match (>= 0.7), automatically use it
        if (resolvedDocuments[0].confidence >= 0.7) {
          const topMatch = resolvedDocuments[0];
          console.log(`🎯 Auto-selecting high-confidence match: ${topMatch.filename} (${(topMatch.confidence * 100).toFixed(0)}%)`);

          // Inject instruction to analyze the resolved document
          aiContent = `${content}\n\n[SYSTEM: Semantic document resolution found: "${topMatch.filename}" (ID: ${topMatch.documentId}, Confidence: ${(topMatch.confidence * 100).toFixed(0)}%). Match reasons: ${topMatch.matchReason.join(', ')}. IMPORTANT: Call analyze_document("${topMatch.documentId}") to read the document content and answer the user's question.]`;
        } else {
          // Multiple candidates or low confidence - let the AI know about options
          const docOptions = resolvedDocuments.slice(0, 3).map(d =>
            `"${d.filename}" (ID: ${d.documentId}, Confidence: ${(d.confidence * 100).toFixed(0)}%)`
          ).join(', ');

          aiContent = `${content}\n\n[SYSTEM: Multiple possible documents found: ${docOptions}. Ask the user which document they meant, or use the highest confidence match if appropriate.]`;
        }
      } else {
        console.log('❌ No documents resolved from query');
      }
    } catch (error) {
      console.error('Error during semantic document resolution:', error);
    }
  }

  // ⚡ PERFORMANCE FIX: Reduced document injection size for faster responses
  if (attachedDocumentId) {
    console.log('📎 Processing attached document:', attachedDocumentId);

    const attachedDoc = await prisma.document.findUnique({
      where: { id: attachedDocumentId },
      include: { metadata: true },
    });

    if (attachedDoc && attachedDoc.userId === userId) {
      console.log('✅ Document found:', attachedDoc.filename);

      // Check if document has been processed and has content
      if (attachedDoc.metadata && attachedDoc.metadata.extractedText) {
        const documentText = attachedDoc.metadata.extractedText;
        console.log(`📄 Document text length: ${documentText.length} characters`);

        // ⚡ REDUCED TOKEN COUNT: Use first 6,000 characters (≈1,500 tokens) instead of 12,000
        // This cuts processing time in HALF while still providing sufficient context
        const maxChars = 6000;
        const optimizedText = documentText.length > maxChars
          ? documentText.substring(0, maxChars) + '\n\n[... document truncated. Total length: ' + documentText.length + ' chars ...]'
          : documentText;

        // ✅ AUTOMATICALLY inject document content into the AI prompt (no function call needed)
        aiContent = `${content}\n\n═══════════════════════════════════════════════════════════════
📎 ATTACHED DOCUMENT: "${attachedDoc.filename}"
═══════════════════════════════════════════════════════════════

${optimizedText}

═══════════════════════════════════════════════════════════════
END OF ATTACHED DOCUMENT
═══════════════════════════════════════════════════════════════

IMPORTANT: The user has attached the document above. Please answer their question based on the document content provided. Quote specific parts of the document when relevant.`;

        console.log(`✅ Injected ${optimizedText.length} characters into prompt (reduced from 12k to 6k for faster responses)`);
      } else {
        // Document still processing or has no content
        console.log('⚠️ Document not yet processed or has no content');
        aiContent = `${content}\n\n[SYSTEM ERROR: The document "${attachedDoc.filename}" is still being processed or could not be read. Please tell the user: "The document is still being processed. Please wait a moment and try sending your message again."]`;
      }
    } else {
      console.log('❌ Document not found or unauthorized access');
      aiContent = `${content}\n\n[SYSTEM ERROR: Document not found. Please tell the user their document could not be found.]`;
    }
  }

  // Detect the language of the user's message
  const detectedLanguage = detectLanguage(content);

  // Send to Gemini
  console.log('🤖 Sending to Gemini API...');

  const geminiResponse = await sendMessageToGemini(aiContent, history, userName, documentContext, detectedLanguage);
  console.log('✅ Gemini response received:', geminiResponse);

  // Handle function calls
  if (geminiResponse.functionCall) {
    console.log('⚙️ Executing function:', geminiResponse.functionCall.name);
    const functionResult = await executeFunctionCall(
      userId,
      geminiResponse.functionCall.name,
      geminiResponse.functionCall.args,
      content // Pass user message for context-aware operations
    );

    console.log('✅ Function executed successfully:', functionResult);

    // Send function result back to Gemini to get final response
    // Disable function calling in this second call to prevent infinite loops
    console.log('🔄 Sending function result back to Gemini for final response...');
    const finalResponse = await sendMessageToGeminiWithoutFunctions(
      `The function ${geminiResponse.functionCall.name} was executed successfully. ${functionResult.message}\n\nPlease provide a natural, conversational response to the user about what was done.`,
      [...history, { role: 'user', content }],
      userName,
      documentContext,
      detectedLanguage
    );

    console.log('✅ Final response received from Gemini');

    // Save the final assistant response
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: finalResponse.text || functionResult.message,
        metadata: JSON.stringify({
          functionCall: geminiResponse.functionCall,
          result: functionResult.data,
        }),
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage,
      assistantMessage,
      functionCall: geminiResponse.functionCall,
      functionResult: functionResult.data,
    };
  }

  // Save assistant's text response
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: geminiResponse.text || 'I apologize, but I couldn\'t generate a response.',
    },
  });

  // Update conversation timestamp and generate AI-powered title if it's a new conversation
  if (conversation.title === 'New Chat' && isFirstMessage) {
    // Generate an AI-powered title based on the first message and response
    console.log('🎯 Generating title for new conversation...');
    const title = await generateConversationTitle(content, assistantMessage.content);
    console.log(`✅ Generated title: "${title}"`);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  return {
    userMessage,
    assistantMessage,
  };
};

/**
 * Send a message with STREAMING for real-time responses
 */
export const sendMessageStreaming = async (
  input: SendMessageInput,
  onChunk?: (chunk: string) => boolean | void,
  onStage?: (stage: string, message: string) => void
) => {
  // 🔍 DIAGNOSTIC: Track entire request timing
  const requestStartTime = Date.now();
  console.log('🎯 [CHAT SERVICE START]', new Date().toISOString());

  const { userId, conversationId, content, attachedDocumentId, useResearch = false } = input;

  // Verify conversation belongs to user
  console.time('⏱️ [A] Fetch Conversation');
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      user: {
        select: {
          firstName: true,
          email: true,
        },
      },
    },
  });
  console.timeEnd('⏱️ [A] Fetch Conversation');

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Emit analyzing stage
  if (onStage) {
    onStage('analyzing', attachedDocumentId ? 'Analyzing document...' : 'Analyzing your request...');
  }

  // ✅ STORE MESSAGE COUNT BEFORE ADDING USER MESSAGE (for title generation check later)
  const isFirstMessage = conversation.messages.length === 0;
  console.log(`📊 Message count before adding user message: ${conversation.messages.length} (isFirstMessage: ${isFirstMessage})`);

  // Build metadata for attached document
  let metadata = null;
  if (attachedDocumentId) {
    const attachedDoc = await prisma.document.findUnique({
      where: { id: attachedDocumentId },
    });

    if (attachedDoc && attachedDoc.userId === userId) {
      metadata = JSON.stringify({
        attachedFile: {
          id: attachedDoc.id,
          name: attachedDoc.filename,
          type: attachedDoc.mimeType,
        },
      });
    }
  }

  // Save user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content,
      metadata,
    },
  });

  // ⚡ SEMANTIC CACHE CHECK - Skip LLM call if we have a similar cached answer
  if (onStage) {
    onStage('checking_cache', 'Checking cache...');
  }

  const cacheResult = await semanticCacheService.getCachedAnswer(content, userId);

  if (cacheResult.cacheHit && cacheResult.answer) {
    console.log(`✅ [Semantic Cache] HIT! Similarity: ${(cacheResult.similarity! * 100).toFixed(1)}% | Time saved: ${cacheResult.timeSaved}ms`);

    // Stream the cached answer to simulate real-time response
    if (onChunk && cacheResult.answer.text) {
      const text = cacheResult.answer.text;
      const chunkSize = 50;

      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.substring(i, Math.min(i + chunkSize, text.length));
        onChunk(chunk);
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Save assistant message with cached content
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: cacheResult.answer.text,
        metadata: JSON.stringify({
          cachedResponse: true,
          originalQuery: cacheResult.originalQuery,
          similarity: cacheResult.similarity,
          timeSaved: cacheResult.timeSaved
        }),
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage,
      assistantMessage,
      cacheHit: true,
    };
  }

  console.log('[Semantic Cache] MISS - generating new response');

  // DOCUMENT GENERATION DETECTION: Check if user is requesting a document
  console.log('🔍 Checking if message is a document generation request...');
  const documentDetection = await chatDocumentGenerationService.detectDocumentRequest(content);
  console.log('📊 Document detection result:', documentDetection);

  // If high confidence document request (>= 0.7), generate the document
  let chatDocument = null;
  if (documentDetection.isDocumentRequest && documentDetection.confidence >= 0.7) {
    console.log(`✅ Document generation request detected with ${(documentDetection.confidence * 100).toFixed(0)}% confidence`);
    console.log(`📄 Document type: ${documentDetection.documentType}`);

    // Emit stage update for document generation
    if (onStage) {
      onStage('generating_document', `Generating ${documentDetection.documentType || 'document'}...`);
    }

    try {
      // Generate the document
      const documentResult = await chatDocumentGenerationService.generateChatDocument({
        userPrompt: content,
        userId,
        conversationId,
      });

      if (documentResult.isDocumentRequest && documentResult.document) {
        // Save the generated document to database
        const chatDocumentId = await chatDocumentGenerationService.saveChatDocument(
          userMessage.id,
          conversationId,
          userId,
          documentResult.document
        );

        // Store complete chat document object for response
        chatDocument = {
          id: chatDocumentId,
          ...documentResult.document,
          createdAt: new Date(),
        };

        console.log('✅ Document generated and saved successfully:', chatDocument.title);
      }
    } catch (error) {
      console.error('❌ Error generating document:', error);
      // Continue with regular chat if document generation fails
    }
  }

  // Build conversation history
  const history: ChatMessage[] = conversation.messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Get user's first name
  const userName = conversation.user.firstName || conversation.user.email.split('@')[0];

  // Emit processing stage
  if (onStage) {
    onStage('processing', 'Processing your request...');
  }

  // ⚡ PERFORMANCE OPTIMIZATION: Only fetch document count (not full data!)
  // Full document list is ONLY fetched when AI calls list_documents or search_documents
  console.time('⏱️ [B] Fetch Document Count');
  const documentCount = await prisma.document.count({
    where: { userId },
  });
  console.timeEnd('⏱️ [B] Fetch Document Count');

  // ✅ MINIMAL CONTEXT: Only tell AI how many documents exist, not list them all!
  // This reduces context from ~5000 tokens (with 28 files) to ~100 tokens
  const documentContext = `

USER'S DOCUMENT LIBRARY: ${documentCount} documents uploaded

CRITICAL: When user asks about documents:
1. Use search_documents function to find the specific document first
2. Then use analyze_document function with the document ID from search results
3. NEVER make up information about documents
4. If you need to see all documents, use list_documents function
`;

  // SEMANTIC DOCUMENT RESOLUTION: Try to resolve documents from natural language
  let aiContentStreaming = content;
  let resolvedDocumentsStreaming: any[] = [];

  // Parse the query to detect if it references documents
  const queryAnalysisStreaming = queryParserService.parseQuery(content);

  // If query requires a document but no document is attached, try to resolve it
  if (queryAnalysisStreaming.requiresDocument && !attachedDocumentId) {
    console.log('🔍 [Streaming] Query requires document, attempting semantic resolution...');
    console.log(queryParserService.formatAnalysis(queryAnalysisStreaming));

    try {
      const resolutionResult = await documentResolverService.resolveDocumentWithThreshold(userId, content, 0.5);

      if (resolutionResult.success && resolutionResult.documents.length > 0) {
        resolvedDocumentsStreaming = resolutionResult.documents;
        console.log(`✅ [Streaming] Resolved ${resolvedDocumentsStreaming.length} matching document(s)`);

        // If we have a high-confidence match (>= 0.7), automatically use it
        if (resolvedDocumentsStreaming[0].confidence >= 0.7) {
          const topMatch = resolvedDocumentsStreaming[0];
          console.log(`🎯 [Streaming] Auto-selecting high-confidence match: ${topMatch.filename} (${(topMatch.confidence * 100).toFixed(0)}%)`);

          // Inject instruction to analyze the resolved document
          aiContentStreaming = `${content}\n\n[SYSTEM: Semantic document resolution found: "${topMatch.filename}" (ID: ${topMatch.documentId}, Confidence: ${(topMatch.confidence * 100).toFixed(0)}%). Match reasons: ${topMatch.matchReason.join(', ')}. IMPORTANT: Call analyze_document("${topMatch.documentId}") to read the document content and answer the user's question.]`;
        } else {
          // Multiple candidates or low confidence - let the AI know about options
          const docOptions = resolvedDocumentsStreaming.slice(0, 3).map(d =>
            `"${d.filename}" (ID: ${d.documentId}, Confidence: ${(d.confidence * 100).toFixed(0)}%)`
          ).join(', ');

          aiContentStreaming = `${content}\n\n[SYSTEM: Multiple possible documents found: ${docOptions}. Ask the user which document they meant, or use the highest confidence match if appropriate.]`;
        }
      } else {
        console.log('❌ [Streaming] No documents resolved from query');
      }
    } catch (error) {
      console.error('[Streaming] Error during semantic document resolution:', error);
    }
  }

  // ⚡ PERFORMANCE FIX: Fetch attached document metadata ONLY if needed (don't block streaming)
  if (attachedDocumentId) {
    console.time('⏱️ [C] Fetch Attached Document');
    console.log('📎 [Streaming] Processing attached document:', attachedDocumentId);

    const attachedDocStreaming = await prisma.document.findUnique({
      where: { id: attachedDocumentId },
      include: { metadata: true },
    });
    console.timeEnd('⏱️ [C] Fetch Attached Document');

    if (attachedDocStreaming && attachedDocStreaming.userId === userId) {
      console.log('✅ [Streaming] Document found:', attachedDocStreaming.filename);

      // Check if document has been processed and has content
      if (attachedDocStreaming.metadata && attachedDocStreaming.metadata.extractedText) {
        const documentText = attachedDocStreaming.metadata.extractedText;
        console.log(`📄 [Streaming] Document text length: ${documentText.length} characters`);

        // ⚡ REDUCED TOKEN COUNT: Use first 6,000 characters (≈1,500 tokens) instead of 12,000
        // This cuts processing time in HALF while still providing sufficient context
        const maxChars = 6000;
        const optimizedText = documentText.length > maxChars
          ? documentText.substring(0, maxChars) + '\n\n[... document truncated. Total length: ' + documentText.length + ' chars ...]'
          : documentText;

        // ✅ AUTOMATICALLY inject document content into the AI prompt (no function call needed)
        aiContentStreaming = `${content}\n\n═══════════════════════════════════════════════════════════════
📎 ATTACHED DOCUMENT: "${attachedDocStreaming.filename}"
═══════════════════════════════════════════════════════════════

${optimizedText}

═══════════════════════════════════════════════════════════════
END OF ATTACHED DOCUMENT
═══════════════════════════════════════════════════════════════

IMPORTANT: The user has attached the document above. Please answer their question based on the document content provided. Quote specific parts of the document when relevant.`;

        console.log(`✅ [Streaming] Injected ${optimizedText.length} characters into prompt (reduced from 12k to 6k for faster streaming)`);
      } else {
        // Document still processing or has no content
        console.log('⚠️ [Streaming] Document not yet processed or has no content');
        aiContentStreaming = `${content}\n\n[SYSTEM ERROR: The document "${attachedDocStreaming.filename}" is still being processed or could not be read. Please tell the user: "The document is still being processed. Please wait a moment and try sending your message again."]`;
      }
    } else {
      console.log('❌ [Streaming] Document not found or unauthorized access');
      aiContentStreaming = `${content}\n\n[SYSTEM ERROR: Document not found. Please tell the user their document could not be found.]`;
    }
  }

  // Detect the language of the user's message
  const detectedLanguage = detectLanguage(content);

  // Emit generating stage
  if (onStage) {
    onStage('generating', 'Generating response...');
  }

  // Get OpenAI response with STREAMING
  const { sendMessageToGeminiStreaming } = await import('./gemini.service');
  const geminiResponse = await sendMessageToGeminiStreaming(
    aiContentStreaming, // Use modified content with semantic resolution
    history,
    userName,
    documentContext,
    onChunk, // Pass the chunk callback for real-time streaming
    detectedLanguage,
    useResearch // Pass research mode flag (default: false)
  );

  // Handle function calls (if any)
  if (geminiResponse.functionCall) {
    // Execute function
    const functionResult = await executeFunctionCall(
      userId,
      geminiResponse.functionCall.name,
      geminiResponse.functionCall.args,
      content // Pass user message for context-aware operations
    );

    // Send function result back to get final response
    const { sendMessageToGeminiWithoutFunctions } = await import('./gemini.service');
    const finalResponse = await sendMessageToGeminiWithoutFunctions(
      `The function ${geminiResponse.functionCall.name} was executed successfully. ${functionResult.message}\n\nPlease provide a natural, conversational response to the user about what was done.`,
      [...history, { role: 'user', content }],
      userName,
      documentContext,
      detectedLanguage
    );

    // Save assistant response
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: finalResponse.text || functionResult.message,
        metadata: JSON.stringify({
          functionCall: geminiResponse.functionCall,
          result: functionResult.data,
        }),
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage,
      assistantMessage,
      functionCall: geminiResponse.functionCall,
      functionResult: functionResult.data,
    };
  }

  // Save assistant's text response (with optional chatDocument attached)
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: chatDocument
        ? `I've generated a ${chatDocument.documentType || 'document'} for you. You can view it below.`
        : (geminiResponse.text || 'I apologize, but I couldn\'t generate a response.'),
      metadata: chatDocument ? JSON.stringify({ chatDocumentId: chatDocument.id }) : null,
    },
  });

  // Update conversation title with AI-powered generation if new
  // Use the isFirstMessage flag we stored BEFORE adding the user message
  console.log(`🔍 [TITLE CHECK] Title: "${conversation.title}", isFirstMessage: ${isFirstMessage}, condition met: ${conversation.title === 'New Chat' && isFirstMessage}`);

  if (conversation.title === 'New Chat' && isFirstMessage) {
    console.log('📝 Generating AI-powered conversation title...');
    try {
      const title = await generateConversationTitle(content, assistantMessage.content);
      console.log(`✅ Generated title: "${title}"`);
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          title,
          updatedAt: new Date(),
        },
      });
      console.log(`✅ Title updated in database to: "${title}"`);
    } catch (error) {
      console.error('❌ Error generating title:', error);
      // Update timestamp even if title generation fails
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }
  } else {
    console.log(`⏭️ Skipping title generation (title: "${conversation.title}", isFirstMessage: ${isFirstMessage})`);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  // 💾 CACHE THE RESPONSE - Store for future similar queries
  console.time('⏱️ [D] Cache Response');
  try {
    const responseText = chatDocument
      ? `I've generated a ${chatDocument.documentType || 'document'} for you. You can view it below.`
      : (geminiResponse.text || '');

    if (responseText) {
      await semanticCacheService.cacheAnswer(content, {
        text: responseText,
        conversationId,
        timestamp: new Date(),
      }, userId);
      console.log('[Semantic Cache] Response cached successfully');
    }
  } catch (cacheError) {
    // Don't fail the request if caching fails
    console.error('[Semantic Cache] Error caching response:', cacheError);
  }
  console.timeEnd('⏱️ [D] Cache Response');

  // 🔍 DIAGNOSTIC: Log total request time
  const totalRequestTime = Date.now() - requestStartTime;
  console.log(`🎯 [CHAT SERVICE COMPLETE] Total time: ${totalRequestTime}ms (${(totalRequestTime/1000).toFixed(1)}s)`);
  console.log('═══════════════════════════════════════════════════════');

  return {
    userMessage,
    assistantMessage,
    chatDocument, // Include the generated chat document (or null if none generated)
  };
};

/**
 * Execute a function call from Gemini
 */
async function executeFunctionCall(
  userId: string,
  functionName: string,
  args: Record<string, any>,
  userMessage?: string // Optional user message for context-aware operations
): Promise<{ message: string; data?: any }> {
  try {
    switch (functionName) {
      case 'create_folder':
        const folder = await folderService.createFolder(
          userId,
          args.folderName,
          args.parentFolderId
        );
        return {
          message: `Great! I've created a new folder called "${args.folderName}" for you.`,
          data: folder,
        };

      case 'move_document_to_folder':
        // The AI might pass either a folder ID or folder name
        // We need to look up the folder first
        let targetFolderId = args.folderId;

        // Check if folderId looks like a UUID (contains dashes)
        if (!args.folderId.includes('-')) {
          // It's probably a folder name, look it up
          const folder = await prisma.folder.findFirst({
            where: {
              userId,
              name: args.folderId,
            },
          });

          if (!folder) {
            return {
              message: `I couldn't find a folder named "${args.folderId}". Please make sure the folder exists.`,
              data: null,
            };
          }

          targetFolderId = folder.id;
        }

        // Move document to folder by updating its folderId
        await prisma.document.update({
          where: { id: args.documentId },
          data: { folderId: targetFolderId },
        });

        return {
          message: `Perfect! I've moved the document to the specified folder.`,
          data: { documentId: args.documentId, folderId: targetFolderId },
        };

      case 'schedule_reminder':
        const reminder = await prisma.reminder.create({
          data: {
            userId,
            title: args.title,
            description: args.description || null,
            dueDate: new Date(args.dueDate),
          },
        });
        return {
          message: `All set! I've scheduled a reminder for "${args.title}" on ${new Date(args.dueDate).toLocaleString()}.`,
          data: reminder,
        };

      case 'list_documents':
        const allDocuments = await prisma.document.findMany({
          where: { userId },
          include: {
            folder: true,
            metadata: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        // Format documents for AI without exposing IDs in the text
        const docList = allDocuments.map(d => ({
          id: d.id, // Keep ID for function calls
          name: d.filename,
          uploadedAt: d.createdAt,
          size: d.fileSize,
          extractedText: d.metadata?.extractedText,
          classification: d.metadata?.classification,
        }));

        return {
          message: `You have ${allDocuments.length} document(s) uploaded.`,
          data: docList,
        };

      case 'search_documents':
        const limit = args.limit || 10;
        const searchResults = await prisma.document.findMany({
          where: {
            userId, // ✅ SECURITY: ALWAYS filter by userId to prevent cross-user access
            OR: [
              { filename: { contains: args.query } },
              {
                metadata: {
                  extractedText: { contains: args.query },
                },
              },
            ],
          },
          include: {
            folder: true,
            metadata: true,
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        });

        // ✅ FIX DUPLICATES: Deduplicate results by document ID
        // This happens when same document appears in multiple folders or views
        const seenDocIds = new Set<string>();
        const uniqueResults = searchResults.filter(doc => {
          if (seenDocIds.has(doc.id)) {
            console.log(`⚠️ Duplicate document in search results: ${doc.filename} (ID: ${doc.id})`);
            return false;
          }
          seenDocIds.add(doc.id);
          return true;
        });

        // Format results with excerpts
        const formattedResults = uniqueResults.map(doc => {
          let excerpt = '';
          if (doc.metadata?.extractedText) {
            excerpt = extractExcerpt(doc.metadata.extractedText, args.query, 150);
          }

          return {
            id: doc.id,
            filename: doc.filename,
            excerpt,
            createdAt: doc.createdAt,
            folderId: doc.folderId,
            folderName: doc.folder?.name || null,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
          };
        });

        // Build response message
        let responseMessage = `I found **${formattedResults.length}** document(s) matching "**${args.query}**":\n\n`;

        if (formattedResults.length > 0) {
          formattedResults.forEach((result, index) => {
            responseMessage += `${index + 1}. **${result.filename}**`;
            if (result.folderName) {
              responseMessage += ` (in ${result.folderName})`;
            }
            if (result.excerpt) {
              responseMessage += `\n   ${result.excerpt}`;
            }
            responseMessage += '\n\n';
          });
        } else {
          responseMessage += 'No documents found. Try a different search term.';
        }

        return {
          message: responseMessage,
          data: formattedResults,
        };

      case 'get_document_info':
        const document = await documentService.getDocumentStatus(args.documentId, userId);
        return {
          message: `Here's the information about the document "${document.filename}".`,
          data: document,
        };

      case 'analyze_document':
        const { shouldChunkDocument, chunkDocument } = await import('./documentChunking.service');

        const doc = await prisma.document.findUnique({
          where: { id: args.documentId },
          include: { metadata: true },
        });

        if (!doc || doc.userId !== userId) {
          throw new Error('Document not found or unauthorized');
        }

        // Check if document has been processed
        if (!doc.metadata) {
          return {
            message: `The document "${doc.filename}" is still being processed. Please try again in a moment.`,
            data: {
              status: doc.status,
              filename: doc.filename,
              processed: false,
            },
          };
        }

        // Check if text extraction succeeded (null/undefined means not processed, empty string means no text found)
        if (doc.metadata.extractedText === null || doc.metadata.extractedText === undefined) {
          return {
            message: `The document "${doc.filename}" is still being processed. Please try again in a moment.`,
            data: {
              status: doc.status,
              filename: doc.filename,
              processed: false,
            },
          };
        }

        // If extractedText is empty string, it means the document was processed but no text was found
        if (doc.metadata.extractedText === '') {
          return {
            message: `The document "${doc.filename}" was processed but no text could be extracted. This could be because the file is corrupted, empty, or contains only images without text.`,
            data: {
              status: doc.status,
              filename: doc.filename,
              processed: true,
              extractedText: '',
              classification: doc.metadata?.classification,
              entities: doc.metadata?.entities ? JSON.parse(doc.metadata.entities) : {},
            },
          };
        }

        // ⚡ CONTEXT OPTIMIZATION: Use vector search to limit context from 15,000 tokens to 2,000 tokens
        // This fixes the 55-second delay problem (Problem: 15,000 tokens → 50s, Solution: 2,000 tokens → 3-5s)
        console.log('⚡ [Context Optimization] User query available:', userMessage ? `"${userMessage}"` : 'No query provided');

        const originalTokenCount = Math.round(doc.metadata.extractedText.length * 0.25);

        // Use context optimization if we have a user query, otherwise fall back to beginning of document
        let optimizedContext;
        if (userMessage) {
          // Use vector search to find only relevant chunks (2,000 tokens max)
          optimizedContext = await contextOptimizationService.buildOptimizedDocumentContext(
            args.documentId,
            userId,
            userMessage,
            doc.metadata.extractedText
          );
        } else {
          // Fallback: Use beginning of document if no query available
          optimizedContext = contextOptimizationService.buildOptimizedContextFromFullText(
            doc.metadata.extractedText,
            'document summary' // Default query for fallback
          );
        }

        const textPreview = optimizedContext.context.length > 500
          ? optimizedContext.context.substring(0, 500) + '...'
          : optimizedContext.context;

        return {
          message: `I've loaded ${optimizedContext.chunksUsed} relevant sections from "${doc.filename}" (${optimizedContext.tokensEstimated} tokens of ${optimizedContext.originalTokens} total). ${doc.metadata?.classification ? `It appears to be a ${doc.metadata.classification}. ` : ''}

**Optimized Context (${optimizedContext.chunksUsed} chunks, ~${optimizedContext.tokensEstimated} tokens):**
Preview of first 500 characters:
${textPreview}

**CRITICAL ANTI-HALLUCINATION RULES:**
1. Use ONLY the content in the extractedText field below
2. Quote EXACT text from the document - do NOT paraphrase or combine facts from different sections
3. If information isn't in the provided context, say "I cannot find that information in the loaded sections"

**RESPONSE FORMAT:**
- Give DIRECT answers with exact quotes
- NO fluff like "I've analyzed" or "Let me check"`,
          data: {
            classification: doc.metadata?.classification,
            entities: doc.metadata?.entities ? JSON.parse(doc.metadata.entities) : {},
            extractedText: optimizedContext.context,
            processed: true,
            filename: doc.filename,
            fileType: doc.mimeType,
            wordCount: doc.metadata.extractedText.split(/\s+/).length,
            tokenCount: optimizedContext.tokensEstimated,
            originalTokens: optimizedContext.originalTokens,
            isOptimized: true,
            chunksUsed: optimizedContext.chunksUsed,
            truncated: optimizedContext.truncated,
          },
        };

      case 'send_document_copy':
        const documentToSend = await prisma.document.findUnique({
          where: { id: args.documentId },
          include: {
            folder: true,
          },
        });

        if (!documentToSend || documentToSend.userId !== userId) {
          throw new Error('Document not found or unauthorized');
        }

        return {
          message: `You can find "${documentToSend.filename}" in your Documents.`,
          data: {
            documentId: args.documentId,
            filename: documentToSend.filename,
            folderId: documentToSend.folderId,
            folderName: documentToSend.folder?.name || null,
            mimeType: documentToSend.mimeType,
            fileType: 'document_location', // Navigate to document location
          },
        };

      case 'search_by_tag':
        const tagToSearch = args.tag.toLowerCase().replace('#', '');

        const taggedDocuments = await prisma.document.findMany({
          where: {
            userId,
            tags: {
              some: {
                tag: {
                  name: tagToSearch,
                },
              },
            },
          },
          include: {
            folder: true,
            tags: {
              include: {
                tag: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const tagResults = taggedDocuments.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          createdAt: doc.createdAt,
          folderId: doc.folderId,
          folderName: doc.folder?.name || null,
          tags: doc.tags.map(t => t.tag.name),
        }));

        let tagMessage = `I found **${taggedDocuments.length}** document(s) tagged with **#${tagToSearch}**:\n\n`;

        if (taggedDocuments.length > 0) {
          tagResults.forEach((doc, index) => {
            tagMessage += `${index + 1}. **${doc.filename}**`;
            if (doc.folderName) {
              tagMessage += ` (in ${doc.folderName})`;
            }
            tagMessage += `\n   Tags: ${doc.tags.map(t => `#${t}`).join(', ')}\n\n`;
          });
        } else {
          tagMessage += `No documents found with tag #${tagToSearch}. Try a different tag or check available tags.`;
        }

        return {
          message: tagMessage,
          data: tagResults,
        };

      case 'add_tag_to_document':
        const tagName = args.tag.toLowerCase().replace('#', '');

        const docToTag = await prisma.document.findUnique({
          where: { id: args.documentId },
        });

        if (!docToTag || docToTag.userId !== userId) {
          throw new Error('Document not found or unauthorized');
        }

        // Create or get tag
        let tag = await prisma.tag.findUnique({
          where: {
            userId_name: {
              userId,
              name: tagName,
            },
          },
        });

        if (!tag) {
          tag = await prisma.tag.create({
            data: {
              userId,
              name: tagName,
            },
          });
        }

        // Add tag to document (if not already tagged)
        await prisma.documentTag.upsert({
          where: {
            documentId_tagId: {
              documentId: args.documentId,
              tagId: tag.id,
            },
          },
          update: {},
          create: {
            documentId: args.documentId,
            tagId: tag.id,
          },
        });

        return {
          message: `Tagged **${docToTag.filename}** with **#${tagName}**.`,
          data: {
            documentId: args.documentId,
            documentName: docToTag.filename,
            tag: tagName,
          },
        };

      case 'summarize_document':
        const { summarizeDocumentWithGemini } = await import('./gemini.service');

        const docToSummarize = await prisma.document.findUnique({
          where: { id: args.documentId },
          include: { metadata: true },
        });

        if (!docToSummarize || docToSummarize.userId !== userId) {
          throw new Error('Document not found or unauthorized');
        }

        if (!docToSummarize.metadata || !docToSummarize.metadata.extractedText) {
          return {
            message: `The document "${docToSummarize.filename}" is still being processed. Text extraction is not yet complete. Please try again in a moment.`,
            data: {
              status: docToSummarize.status,
              filename: docToSummarize.filename,
              processed: false,
            },
          };
        }

        // Generate summary
        const summaryType = args.summaryType || 'standard';
        const summary = await summarizeDocumentWithGemini(
          docToSummarize.metadata.extractedText,
          docToSummarize.filename,
          summaryType as 'brief' | 'standard' | 'detailed'
        );

        // Save summary to database
        await prisma.documentSummary.create({
          data: {
            documentId: args.documentId,
            summary,
            summaryType,
          },
        });

        return {
          message: `Here's ${summaryType === 'brief' ? 'a brief' : summaryType === 'detailed' ? 'a detailed' : 'a'} summary of **${docToSummarize.filename}**:\n\n${summary}`,
          data: {
            summary,
            summaryType,
            documentName: docToSummarize.filename,
          },
        };

      case 'compare_documents':
        const { compareDocuments } = await import('./gemini.service');

        // Get both documents with metadata
        const [doc1, doc2] = await Promise.all([
          prisma.document.findUnique({
            where: { id: args.documentId1 },
            include: { metadata: true },
          }),
          prisma.document.findUnique({
            where: { id: args.documentId2 },
            include: { metadata: true },
          }),
        ]);

        // Verify both documents exist and user has access
        if (!doc1 || doc1.userId !== userId) {
          throw new Error('First document not found or unauthorized');
        }

        if (!doc2 || doc2.userId !== userId) {
          throw new Error('Second document not found or unauthorized');
        }

        // Check if both documents have extracted text
        if (!doc1.metadata?.extractedText || !doc2.metadata?.extractedText) {
          const missingDoc = !doc1.metadata?.extractedText ? doc1.filename : doc2.filename;
          return {
            message: `The document "${missingDoc}" is still being processed. Please wait a moment and try again.`,
            data: { processed: false },
          };
        }

        // Compare the documents
        const comparison = await compareDocuments(
          doc1.filename,
          doc1.metadata.extractedText,
          doc2.filename,
          doc2.metadata.extractedText
        );

        return {
          message: `**Comparing ${doc1.filename} vs ${doc2.filename}**\n\n${comparison}`,
          data: {
            document1: doc1.filename,
            document2: doc2.filename,
            comparison,
          },
        };

      case 'compare_multiple_documents':
        const { compareMultipleDocuments } = await import('./gemini.service');

        // Get all documents
        const documents = await Promise.all(
          args.documentIds.map((id: string) =>
            prisma.document.findUnique({
              where: { id },
              include: { metadata: true },
            })
          )
        );

        // Verify all documents exist and user has access
        for (const doc of documents) {
          if (!doc || doc.userId !== userId) {
            throw new Error('One or more documents not found or unauthorized');
          }
        }

        // Check if all documents have extracted text
        const unprocessedDocs = documents.filter((doc) => !doc?.metadata?.extractedText);
        if (unprocessedDocs.length > 0) {
          return {
            message: `Some documents are still being processed: ${unprocessedDocs.map((d) => d?.filename).join(', ')}. Please wait and try again.`,
            data: { processed: false },
          };
        }

        // Build document array for comparison
        const docsForComparison = documents.map((doc) => ({
          name: doc!.filename,
          text: doc!.metadata!.extractedText!,
        }));

        // Compare multiple documents
        const multiComparison = await compareMultipleDocuments(docsForComparison);

        const docNames = documents.map((d) => d!.filename).join(', ');

        return {
          message: `**Comparing ${documents.length} documents:** ${docNames}\n\n${multiComparison}`,
          data: {
            documents: docNames,
            comparison: multiComparison,
          },
        };

      case 'extract_verified_data':
        const { extractStructuredDataWithConfidence, twoPassVerification } = await import('./gemini.service');

        // Get document
        const docToExtract = await prisma.document.findUnique({
          where: { id: args.documentId },
          include: { metadata: true },
        });

        if (!docToExtract || docToExtract.userId !== userId) {
          throw new Error('Document not found or unauthorized');
        }

        if (!docToExtract.metadata?.extractedText) {
          return {
            message: `The document "${docToExtract.filename}" is still being processed. Please try again in a moment.`,
            data: { processed: false },
          };
        }

        console.log('🔍 Extracting verified data from document with zero-hallucination guarantee...');

        // Step 1: Extract with confidence scores
        const extraction = await extractStructuredDataWithConfidence(
          docToExtract.metadata.extractedText,
          docToExtract.filename,
          args.fieldsToExtract
        );

        // Step 2: Two-pass verification
        const verification = await twoPassVerification(
          docToExtract.metadata.extractedText,
          docToExtract.filename,
          extraction.extractedData
        );

        // Build response with verified data
        let verifiedDataMessage = `I've extracted the following information from **${docToExtract.filename}** with **${(verification.overallAccuracy * 100).toFixed(0)}% verification accuracy**:\n\n`;

        const fieldsData = Object.entries(verification.verifiedData).map(([field, data]) => {
          const confidence = extraction.extractedData[field]?.confidence || 0;
          const verified = data.verified;
          const issues = data.issues;

          let status = '';
          if (verified && confidence >= 0.8) {
            status = '✅ Verified';
          } else if (verified) {
            status = '⚠️ Verified (low confidence)';
          } else {
            status = '❌ Unverified';
          }

          return {
            field,
            value: data.value,
            status,
            confidence,
            verified,
            issues
          };
        });

        for (const fieldData of fieldsData) {
          verifiedDataMessage += `**${fieldData.field}**: `;
          if (fieldData.value && fieldData.value !== 'null') {
            verifiedDataMessage += `**"${fieldData.value}"** ${fieldData.status}\n`;
            if (fieldData.issues.length > 0) {
              verifiedDataMessage += `   ⚠️ Issues: ${fieldData.issues.join(', ')}\n`;
            }
          } else {
            verifiedDataMessage += `*Not found in document* ❌\n`;
          }
          verifiedDataMessage += '\n';
        }

        if (verification.overallAccuracy < 1.0) {
          verifiedDataMessage += `\n⚠️ **Note**: Some fields could not be verified with 100% accuracy. Please review the flagged items.`;
        } else {
          verifiedDataMessage += `\n✅ **All fields verified successfully with zero hallucinations!**`;
        }

        return {
          message: verifiedDataMessage,
          data: {
            extractedFields: fieldsData,
            overallAccuracy: verification.overallAccuracy,
            needsReview: verification.overallAccuracy < 1.0
          },
        };

      // Live Data API Functions
      case 'get_stock_quote':
        const liveDataService = (await import('./liveData.service')).default;

        const stockQuote = await liveDataService.getStockQuote(args.symbol);

        const priceChange = stockQuote.change >= 0 ? `📈 +${stockQuote.change.toFixed(2)}` : `📉 ${stockQuote.change.toFixed(2)}`;
        const percentChange = stockQuote.changePercent >= 0 ? `+${stockQuote.changePercent.toFixed(2)}%` : `${stockQuote.changePercent.toFixed(2)}%`;

        return {
          message: `**${stockQuote.symbol}** Stock Quote:\n\n` +
                   `**Current Price:** $${stockQuote.price.toFixed(2)}\n` +
                   `**Change:** ${priceChange} (${percentChange})\n` +
                   `**Day Range:** $${stockQuote.low.toFixed(2)} - $${stockQuote.high.toFixed(2)}\n` +
                   `**Open:** $${stockQuote.open.toFixed(2)}\n` +
                   `**Previous Close:** $${stockQuote.previousClose.toFixed(2)}\n` +
                   `**Volume:** ${stockQuote.volume.toLocaleString()}\n` +
                   `**Last Updated:** ${stockQuote.timestamp}\n\n` +
                   `📊 Source: ${stockQuote.source}`,
          data: stockQuote,
        };

      case 'search_stock_symbol':
        const liveData = (await import('./liveData.service')).default;

        const symbols = await liveData.searchStockSymbol(args.companyName);

        if (symbols.length === 0) {
          return {
            message: `I couldn't find any stock symbols matching "**${args.companyName}**". Please try a different search term or company name.`,
            data: [],
          };
        }

        let symbolsMessage = `Found **${symbols.length}** matching symbols for "**${args.companyName}**":\n\n`;
        symbols.forEach((match, index) => {
          symbolsMessage += `${index + 1}. **${match.symbol}** - ${match.name}\n`;
          symbolsMessage += `   Type: ${match.type}, Region: ${match.region}\n\n`;
        });

        return {
          message: symbolsMessage,
          data: symbols,
        };

      case 'get_currency_exchange':
        const currencyService = (await import('./liveData.service')).default;

        const exchange = await currencyService.getCurrencyExchange(args.fromCurrency, args.toCurrency);

        return {
          message: `**${exchange.fromCurrency}/${exchange.toCurrency}** Exchange Rate:\n\n` +
                   `**1 ${exchange.fromCurrency}** = **${exchange.rate.toFixed(4)} ${exchange.toCurrency}**\n` +
                   `**Last Updated:** ${exchange.timestamp}\n\n` +
                   `📊 Source: ${exchange.source}`,
          data: exchange,
        };

      case 'get_economic_indicator':
        const econService = (await import('./liveData.service')).default;

        const indicator = await econService.getEconomicIndicator(args.indicator);

        return {
          message: `**${indicator.description || indicator.indicator}**:\n\n` +
                   `**Value:** ${indicator.value.toLocaleString()} ${indicator.unit}\n` +
                   `**Date:** ${indicator.date}\n\n` +
                   `📊 Source: ${indicator.source} (Federal Reserve Economic Data)`,
          data: indicator,
        };

      case 'get_economic_snapshot':
        const econSnapshotService = (await import('./liveData.service')).default;

        const snapshot = await econSnapshotService.getEconomicSnapshot();

        return {
          message: `**📊 Economic Snapshot - Key Indicators**\n\n` +
                   `**GDP (Gross Domestic Product)**\n` +
                   `Value: $${snapshot.gdp.value.toLocaleString()} ${snapshot.gdp.unit}\n` +
                   `Date: ${snapshot.gdp.date}\n\n` +
                   `**Unemployment Rate**\n` +
                   `Value: ${snapshot.unemployment.value}%\n` +
                   `Date: ${snapshot.unemployment.date}\n\n` +
                   `**Inflation (CPI)**\n` +
                   `Value: ${snapshot.inflation.value.toFixed(2)} ${snapshot.inflation.unit}\n` +
                   `Date: ${snapshot.inflation.date}\n\n` +
                   `**Federal Funds Rate**\n` +
                   `Value: ${snapshot.interestRate.value}%\n` +
                   `Date: ${snapshot.interestRate.date}\n\n` +
                   `📊 Source: FRED (Federal Reserve Economic Data)`,
          data: snapshot,
        };

      case 'get_reliable_news':
        const newsService = (await import('./liveData.service')).default;

        const newsLimit = args.limit || 5;
        const news = await newsService.getReliableNews(args.query, args.category, newsLimit);

        if (news.length === 0) {
          return {
            message: args.query
              ? `No recent news found for "**${args.query}**" from reliable sources.`
              : `No recent news available from reliable sources.`,
            data: [],
          };
        }

        let newsMessage = args.query
          ? `**📰 Latest News about "${args.query}"** (from reliable sources):\n\n`
          : `**📰 Top Headlines** (from reliable sources):\n\n`;

        news.forEach((article, index) => {
          newsMessage += `${index + 1}. **${article.title}**\n`;
          newsMessage += `   ${article.description}\n`;
          newsMessage += `   📰 Source: ${article.source} (${article.reliability} reliability)\n`;
          if (article.author) {
            newsMessage += `   ✍️ Author: ${article.author}\n`;
          }
          newsMessage += `   🔗 [Read more](${article.url})\n`;
          newsMessage += `   📅 Published: ${new Date(article.publishedAt).toLocaleDateString()}\n\n`;
        });

        newsMessage += `\n✅ All articles from verified, reliable news sources`;

        return {
          message: newsMessage,
          data: news,
        };

      case 'web_search':
        const webSearchService = (await import('./webSearch.service')).default;

        const searchLimit = args.limit || 5;
        const reliableOnly = args.reliableOnly !== false; // Default to true

        console.log(`🌐 Performing web search: "${args.query}" (reliable only: ${reliableOnly})`);

        const webResults = await webSearchService.search(args.query, searchLimit, reliableOnly);

        if (webResults.length === 0) {
          return {
            message: `I couldn't find any web results for "**${args.query}**". Try a different search term or check your spelling.`,
            data: [],
          };
        }

        // Build response with source attribution
        let webSearchMessage = `**🌐 Web Search Results** for "**${args.query}**":\n\n`;

        webResults.forEach((result, index) => {
          webSearchMessage += `${index + 1}. **${result.title}**\n`;
          webSearchMessage += `   ${result.snippet}\n`;
          webSearchMessage += `   🌐 Source: **${result.domain}** (${result.reliability} reliability)\n`;
          webSearchMessage += `   🔗 [Read more](${result.url})\n`;
          if (result.content) {
            const preview = result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '');
            webSearchMessage += `   📄 Preview: ${preview}\n`;
          }
          webSearchMessage += '\n';
        });

        webSearchMessage += `\n✅ Results from ${reliableOnly ? 'reliable' : 'all'} web sources`;

        // Build detailed data object for AI to process
        const webSearchData = webResults.map(result => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          content: result.content || '',
          source: result.domain,
          reliability: result.reliability,
        }));

        return {
          message: webSearchMessage,
          data: {
            results: webSearchData,
            query: args.query,
            totalResults: webResults.length,
            reliableOnly,
          },
        };

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    return {
      message: `I encountered an error while trying to ${functionName.replace('_', ' ')}. Please try again.`,
    };
  }
}

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.userId !== userId) {
    throw new Error('Unauthorized');
  }

  await prisma.conversation.delete({
    where: { id: conversationId },
  });

  return { success: true };
};

/**
 * Delete all conversations for a user
 */
export const deleteAllConversations = async (userId: string) => {
  await prisma.conversation.deleteMany({
    where: { userId },
  });

  return { success: true };
};

/**
 * Regenerate titles for all conversations with "New Chat" title
 */
export const regenerateConversationTitles = async (userId: string) => {
  try {
    console.log(`🔄 Starting title regeneration for user: ${userId}`);

    // Get all conversations with "New Chat" title that have messages
    const conversations = await prisma.conversation.findMany({
      where: {
        userId,
        title: 'New Chat'
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 2 // Get first user message and first assistant response
        }
      }
    });

    if (conversations.length === 0) {
      return {
        totalConversations: 0,
        regenerated: 0,
        failed: 0,
        message: 'No conversations with "New Chat" title found'
      };
    }

    console.log(`📊 Found ${conversations.length} conversations to regenerate titles for`);

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each conversation
    for (const conversation of conversations) {
      try {
        // Skip if conversation has no messages
        if (conversation.messages.length === 0) {
          console.log(`⏭️ Skipping conversation ${conversation.id} - no messages`);
          results.push({
            conversationId: conversation.id,
            status: 'skipped',
            reason: 'No messages'
          });
          continue;
        }

        // Get first user message and first assistant message
        const userMessage = conversation.messages.find(m => m.role === 'user');
        const assistantMessage = conversation.messages.find(m => m.role === 'assistant');

        if (!userMessage || !assistantMessage) {
          console.log(`⏭️ Skipping conversation ${conversation.id} - missing messages`);
          results.push({
            conversationId: conversation.id,
            status: 'skipped',
            reason: 'Missing user or assistant message'
          });
          continue;
        }

        // Generate new title
        console.log(`🔄 Generating title for conversation ${conversation.id}`);
        const newTitle = await generateConversationTitle(userMessage.content, assistantMessage.content);

        // Update conversation with new title
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { title: newTitle }
        });

        results.push({
          conversationId: conversation.id,
          status: 'success',
          oldTitle: 'New Chat',
          newTitle
        });

        successCount++;
        console.log(`✅ Generated title: "${newTitle}"`);

      } catch (error: any) {
        console.error(`❌ Failed to regenerate title for conversation ${conversation.id}:`, error.message);

        results.push({
          conversationId: conversation.id,
          status: 'failed',
          error: error.message
        });

        failedCount++;
      }

      // Add small delay between conversations to avoid overwhelming the AI API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ Title regeneration complete: ${successCount} succeeded, ${failedCount} failed`);

    return {
      totalConversations: conversations.length,
      regenerated: successCount,
      failed: failedCount,
      results
    };
  } catch (error) {
    console.error('❌ Error regenerating conversation titles:', error);
    throw error;
  }
};
