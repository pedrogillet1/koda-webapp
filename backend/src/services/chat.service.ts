/**
 * Chat Service - Complete Implementation
 *
 * This service handles all chat-related operations including:
 * - Conversation management (create, read, delete)
 * - Message sending (regular and streaming)
 * - AI response generation with Gemini
 * - Conversation title generation
 */

import prisma from '../config/database';
import { sendMessageToGemini, sendMessageToGeminiStreaming, generateConversationTitle } from './gemini.service';
import ragService from './rag.service';
import cacheService from './cache.service';
import { getIO } from './websocket.service';
import * as memoryService from './memory.service';
import OpenAI from 'openai';
import { config } from '../config/env';

// OpenAI client for streaming title generation
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CreateConversationParams {
  userId: string;
  title?: string;
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION
  titleEncrypted?: string;
  encryptionSalt?: string;
  encryptionIV?: string;
  encryptionAuthTag?: string;
  isEncrypted?: boolean;
}

interface SendMessageParams {
  userId: string;
  conversationId: string;
  content: string;
  attachedDocumentId?: string;
  answerLength?: string;
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION
  contentEncrypted?: string;
  encryptionSalt?: string;
  encryptionIV?: string;
  encryptionAuthTag?: string;
  isEncrypted?: boolean;
}

interface MessageResult {
  userMessage: any;
  assistantMessage: any;
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * Create a new conversation
 */
export const createConversation = async (params: CreateConversationParams) => {
  const {
    userId,
    title = 'New Chat',
    titleEncrypted,
    encryptionSalt,
    encryptionIV,
    encryptionAuthTag,
    isEncrypted = false
  } = params;

  console.log('💬 Creating new conversation for user:', userId);
  if (isEncrypted) {
    console.log('🔐 Zero-knowledge encryption enabled for conversation');
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      title,
      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Store encrypted title metadata
      titleEncrypted: titleEncrypted || null,
      encryptionSalt: encryptionSalt || null,
      encryptionIV: encryptionIV || null,
      encryptionAuthTag: encryptionAuthTag || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  console.log('✅ Conversation created:', conversation.id);
  return conversation;
};

/**
 * Get all conversations for a user
 */
export const getUserConversations = async (userId: string) => {
  console.log('📋 Fetching conversations for user:', userId);

  // ⚡ CACHE: Generate cache key
  const cacheKey = `conversations:${userId}`;

  // ⚡ CACHE: Check cache first
  const cached = await cacheService.get<any[]>(cacheKey);
  if (cached) {
    console.log(`✅ [Cache] HIT for conversations list (user: ${userId.substring(0, 8)}...)`);
    return cached;
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          createdAt: true,
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  // ✅ FIX: Filter out conversations with no messages
  const conversationsWithMessages = conversations.filter(conv => conv._count.messages > 0);

  console.log(`✅ Found ${conversations.length} conversations (${conversationsWithMessages.length} with messages, ${conversations.length - conversationsWithMessages.length} empty)`);

  // ⚡ CACHE: Store filtered result with 30 minute TTL
  await cacheService.set(cacheKey, conversationsWithMessages, { ttl: 1800 });
  console.log(`💾 [Cache] Stored conversations list (user: ${userId.substring(0, 8)}...)`);

  return conversationsWithMessages;
};

/**
 * Get a single conversation with all messages
 */
export const getConversation = async (conversationId: string, userId: string) => {
  console.log('📖 Fetching conversation:', conversationId);

  // ⚡ CACHE: Generate cache key
  const cacheKey = `conversation:${conversationId}:${userId}`;

  // ⚡ CACHE: Check cache first
  const cached = await cacheService.get<any>(cacheKey);
  if (cached) {
    console.log(`✅ [Cache] HIT for conversation ${conversationId.substring(0, 8)}...`);
    return cached;
  }

  // ⚡ OPTIMIZED: Load only recent messages for instant display
  // Older messages can be loaded on-demand (lazy loading)
  const INITIAL_MESSAGE_LIMIT = 100; // Load last 100 messages for instant display

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      titleEncrypted: true,
      encryptionSalt: true,
      encryptionIV: true,
      encryptionAuthTag: true,
      contextType: true,
      contextId: true,
      contextName: true,
      contextMeta: true,
      // ✅ OPTIMIZATION: Load only last N messages (DESC order, then reverse)
      messages: {
        orderBy: { createdAt: 'desc' },
        take: INITIAL_MESSAGE_LIMIT,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          conversationId: true,
          // Load attachments and documents with essential fields only
          attachments: true,
          chatDocuments: {
            select: {
              id: true,
              sourceDocumentId: true,
              title: true,
              documentType: true,
              pdfUrl: true,
            },
          },
          // Load metadata (sources) for assistant messages
          metadata: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // ✅ Reverse messages to get chronological order (oldest to newest)
  conversation.messages = conversation.messages.reverse();

  // ⚡ CACHE: Store result with 30 minute TTL
  await cacheService.set(cacheKey, conversation, { ttl: 1800 });
  console.log(`💾 [Cache] Stored conversation ${conversationId.substring(0, 8)}...`);


  console.log(`✅ Conversation found with ${conversation.messages.length} messages`);
  return conversation;
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId: string, userId: string) => {
  console.log('🗑️ Deleting conversation:', conversationId);

  // Verify ownership
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    console.log('⚠️ Conversation not found, already deleted or access denied');
    return; // Silently return instead of throwing error
  }

  // Delete all messages first (cascade should handle this, but being explicit)
  await prisma.message.deleteMany({
    where: { conversationId },
  });

  // Delete conversation
  await prisma.conversation.delete({
    where: { id: conversationId },
  });

  console.log('✅ Conversation deleted successfully');
};

/**
 * Delete all conversations for a user
 */
export const deleteAllConversations = async (userId: string) => {
  console.log('🗑️ Deleting all conversations for user:', userId);

  // Get all conversation IDs
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    select: { id: true },
  });

  const conversationIds = conversations.map((c) => c.id);

  // Delete all messages
  await prisma.message.deleteMany({
    where: { conversationId: { in: conversationIds } },
  });

  // Delete all conversations
  const result = await prisma.conversation.deleteMany({
    where: { userId },
  });

  console.log(`✅ Deleted ${result.count} conversations`);
  return result;
};

// ============================================================================
// MESSAGE SENDING (REGULAR)
// ============================================================================

/**
 * Send a message and get AI response (non-streaming)
 */
export const sendMessage = async (params: SendMessageParams): Promise<MessageResult> => {
  const {
    userId,
    conversationId,
    content,
    attachedDocumentId,
    contentEncrypted,
    encryptionSalt,
    encryptionIV,
    encryptionAuthTag,
    isEncrypted = false
  } = params;

  console.log('💬 Sending message in conversation:', conversationId);
  if (isEncrypted) {
    console.log('🔐 Zero-knowledge encryption enabled for message');
  }

  // Verify conversation ownership
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // Create user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content,
      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Store encrypted content metadata
      isEncrypted: isEncrypted || false,
      contentEncrypted: contentEncrypted || null,
      encryptionSalt: encryptionSalt || null,
      encryptionIV: encryptionIV || null,
      encryptionAuthTag: encryptionAuthTag || null,
      createdAt: new Date(),
    },
  });

  console.log('✅ User message saved:', userMessage.id);

  // ✅ NEW: Fetch conversation history using helper function
  const conversationHistory = await getConversationHistory(conversationId);

  // ✅ FIX: Use RAG service instead of calling Gemini directly
  console.log('🤖 Generating RAG response...');
  const ragResult = await ragService.generateAnswer(
    userId,
    content,
    conversationId,
    params.answerLength || 'medium',
    attachedDocumentId
  );

  let fullResponse = ragResult.answer || 'Sorry, I could not generate a response.';

  // Append document sources if available
  if (ragResult.sources && ragResult.sources.length > 0) {
    console.log(`📎 Appending ${ragResult.sources.length} document sources to response`);
    const sourcesText = formatDocumentSources(ragResult.sources, attachedDocumentId);
    fullResponse += '\n\n' + sourcesText;
  }

  // Create assistant message
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullResponse,
      createdAt: new Date(),
    },
  });

  console.log('✅ Assistant message saved:', assistantMessage.id);

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // ✅ FIX #5: Auto-generate title after SECOND user message (not first)
  const userMessageCount = conversationHistory.filter(m => m.role === 'user').length;
  if (userMessageCount === 2) {  // Exactly 2 user messages (first + second)
    // Get full conversation context for better titles
    const allMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    const conversationContext = allMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    await autoGenerateTitle(conversationId, userId, conversationContext, fullResponse);
  }

  // ⚡ CACHE: Invalidate conversation cache after new message
  await cacheService.invalidateConversationCache(userId, conversationId);
  console.log(`🗑️  [Cache] Invalidated conversation cache for ${conversationId.substring(0, 8)}...`);

  return {
    userMessage,
    assistantMessage,
  };
};

// ============================================================================
// MESSAGE SENDING (STREAMING)
// ============================================================================

/**
 * Send a message with streaming AI response
 *
 * @param params - Message parameters
 * @param onChunk - Callback for each content chunk
 */
export const sendMessageStreaming = async (
  params: SendMessageParams,
  onChunk: (chunk: string) => void
): Promise<MessageResult> => {
  const { userId, conversationId, content, attachedDocumentId } = params;

  console.log('💬 Sending streaming message in conversation:', conversationId);

  // ⚡ PERFORMANCE: Start DB writes async - don't block streaming
  // Only await conversation check and history (needed for processing)
  const [conversation, conversationHistory] = await Promise.all([
    // Verify conversation ownership
    prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    }),

    // ✅ NEW: Fetch conversation history using helper function
    getConversationHistory(conversationId)
  ]);

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // ⚡ PERFORMANCE: Create user message async (don't wait - saves 400-600ms)
  const userMessagePromise = prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content,
      createdAt: new Date(),
    },
  });

  console.log('⚡ User message creation started (async)');

  // ✅ FIX #2: Check for file actions FIRST (before RAG)
  const fileActionResult = await handleFileActionsIfNeeded(
    userId,
    content,
    conversationId,
    undefined // attachedFiles not yet implemented in frontend
  );

  if (fileActionResult) {
    // This was a file action - send result and return
    const actionMessage = fileActionResult.message;
    const fullResponse = actionMessage;
    onChunk(actionMessage);

    console.log('✅ File action completed:', fileActionResult.action);

    // ⚡ PERFORMANCE: Create assistant message async (don't block)
    const assistantMessagePromise = prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: fullResponse,
        createdAt: new Date(),
      },
    });

    // ⚡ PERFORMANCE: Update conversation timestamp async (fire-and-forget)
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

    // Wait for critical promises before returning
    const [userMessage, assistantMessage] = await Promise.all([
      userMessagePromise,
      assistantMessagePromise
    ]);

    return {
      userMessage,
      assistantMessage,
    };
  }

  // Not a file action - continue with normal RAG
  // Generate AI response with streaming using HYBRID RAG service
  console.log('🤖 Generating streaming RAG response...');
  let fullResponse = '';

  // ✅ NEW: Build memory context for personalized responses
  console.log('🧠 Building memory context...');
  const memoryContext = await memoryService.buildMemoryContext(userId);

  // ✅ NEW: Build full conversation history for comprehensive context
  console.log('📚 Building conversation context...');
  const fullConversationContext = await buildConversationContext(conversationId, userId);

  // Call hybrid RAG service with streaming
  await ragService.generateAnswerStream(
    userId,
    content,
    conversationId,
    (chunk: string) => {
      fullResponse += chunk;
      onChunk(chunk); // Send chunk to client
    },
    attachedDocumentId,
    conversationHistory,  // ✅ Pass conversation history for context
    undefined,            // onStage callback (not used here)
    memoryContext,        // ✅ NEW: Pass memory context
    fullConversationContext // ✅ NEW: Pass full conversation history
  );

  console.log(`✅ Streaming complete. Total response length: ${fullResponse.length} chars`);

  // Note: Hybrid RAG includes sources inline within the response
  // No need to append sources separately

  // ⚡ PERFORMANCE: Create assistant message async (don't block)
  const assistantMessagePromise = prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullResponse, // Now includes sources
      createdAt: new Date(),
    },
  });

  // ⚡ PERFORMANCE: Update conversation timestamp async (fire-and-forget)
  prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  }).catch(err => console.error('❌ Error updating conversation timestamp:', err));

  // ⚡ PERFORMANCE: Auto-generate title async (fire-and-forget)
  // ✅ FIX #5: Auto-generate title after SECOND user message (not first)
  const userMessageCount = conversationHistory.filter(m => m.role === 'user').length;
  if (userMessageCount === 2) {  // Exactly 2 user messages (first + second)
    // Fire-and-forget title generation (don't block response)
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    }).then(allMessages => {
      const conversationContext = allMessages.map(m => `${m.role}: ${m.content}`).join('\n');
      return autoGenerateTitle(conversationId, userId, conversationContext, fullResponse);
    }).catch(err => console.error('❌ Error generating title:', err));
  }

  // ✅ NEW: Extract memory insights after sufficient conversation (fire-and-forget)
  // Extract memory after 5+ user messages to learn preferences and insights
  if (userMessageCount >= 5) {
    console.log(`🧠 Extracting memory insights (${userMessageCount} messages)`);
    memoryService.extractMemoryFromConversation(conversationId, userId)
      .catch(err => console.error('❌ Error extracting memory:', err));
  }

  // ⚡ CACHE: Invalidate conversation cache after new message (fire-and-forget)
  cacheService.invalidateConversationCache(userId, conversationId)
    .then(() => console.log(`🗑️  [Cache] Invalidated conversation cache for ${conversationId.substring(0, 8)}...`))
    .catch(err => console.error('❌ Error invalidating cache:', err));

  // Wait for critical promises before returning
  const [userMessage, assistantMessage] = await Promise.all([
    userMessagePromise,
    assistantMessagePromise
  ]);

  return {
    userMessage,
    assistantMessage,
  };
};

// ============================================================================
// CONVERSATION TITLE GENERATION
// ============================================================================

/**
 * Auto-generate a conversation title with character-by-character streaming
 * @param firstResponse - Optional assistant response for better context
 */
const autoGenerateTitle = async (
  conversationId: string,
  userId: string,
  firstMessage: string,
  firstResponse?: string
) => {
  try {
    console.log('🏷️ Auto-generating title for conversation:', conversationId);

    // Skip title generation for very short messages without response
    if (!firstResponse && firstMessage.length < 10) {
      console.log('⏭️ Skipping title generation for very short message without response');
      return;
    }

    // ✅ NEW: Stream title generation character-by-character
    let fullTitle = '';

    try {
      const io = getIO();

      // Emit title generation start event
      io.to(`user:${userId}`).emit('title:generating:start', {
        conversationId,
      });
      console.log(`📡 [TITLE-STREAM] Started streaming for conversation ${conversationId}`);

      // Generate title with streaming using OpenAI
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Generate a short, descriptive title for a conversation based on ACTUAL content.

**CRITICAL RULES:**
1. Maximum 50 characters
2. If the message is just a greeting (hi, hello, hey, etc.) with no specific question or topic, return "New Chat"
3. ONLY create a specific title if there is a clear topic or question
4. Use natural, conversational language
5. No quotes, no colons, no special formatting
6. Focus on the ACTION or TOPIC mentioned
7. DO NOT hallucinate or guess topics - only use what's explicitly mentioned

Return ONLY the title, nothing else.`,
          },
          {
            role: 'user',
            content: firstResponse
              ? `User: "${firstMessage.slice(0, 500)}"\nAssistant: "${firstResponse.slice(0, 300)}"\n\nCreate a title that captures the ACTUAL topic discussed.`
              : `User: "${firstMessage.slice(0, 500)}"\n\nIf this is just a greeting with no specific topic, return "New Chat". Otherwise, create a title for the topic.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 30,
        stream: true,
      });

      // Stream each character to the frontend
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullTitle += content;

          // Emit each character/chunk
          io.to(`user:${userId}`).emit('title:generating:chunk', {
            conversationId,
            chunk: content,
          });
        }
      }

      // Clean up the title
      const cleanTitle = fullTitle.replace(/['"]/g, '').trim().substring(0, 100) || 'New Chat';

      // Update the conversation in database
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          title: cleanTitle,
          updatedAt: new Date()
        },
      });

      // Emit completion event
      io.to(`user:${userId}`).emit('title:generating:complete', {
        conversationId,
        title: cleanTitle,
        updatedAt: new Date()
      });

      console.log(`✅ Generated and streamed title: "${cleanTitle}"`);

    } catch (wsError) {
      console.warn('⚠️ WebSocket streaming failed, falling back to instant title generation:', wsError);

      // Fallback: Generate title without streaming using Gemini
      const title = await generateConversationTitle(firstMessage, firstResponse);
      const cleanTitle = title.replace(/['"]/g, '').trim().substring(0, 100) || 'New Chat';

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          title: cleanTitle,
          updatedAt: new Date()
        },
      });

      // Still emit the update event for instant display
      try {
        const io = getIO();
        io.to(`user:${userId}`).emit('conversation:updated', {
          conversationId,
          title: cleanTitle,
          updatedAt: new Date()
        });
      } catch (e) {
        // Ignore socket errors in fallback
      }

      console.log(`✅ Generated title (no streaming): "${cleanTitle}"`);
    }

  } catch (error: any) {
    console.error('❌ Error generating title:', error.message);
  }
};

/**
 * Regenerate titles for all "New Chat" conversations
 */
export const regenerateConversationTitles = async (userId: string) => {
  console.log('🔄 Regenerating conversation titles for user:', userId);

  // Find all conversations with "New Chat" title that have messages
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      title: 'New Chat',
    },
    include: {
      messages: {
        where: { role: 'user' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  console.log(`📋 Found ${conversations.length} conversations to regenerate`);

  let regenerated = 0;
  let failed = 0;

  for (const conversation of conversations) {
    if (conversation.messages.length === 0) {
      console.log(`⏭️ Skipping conversation ${conversation.id} (no messages)`);
      continue;
    }

    try {
      const firstMessage = conversation.messages[0].content;
      await autoGenerateTitle(conversation.id, firstMessage);
      regenerated++;
    } catch (error) {
      console.error(`❌ Failed to regenerate title for ${conversation.id}:`, error);
      failed++;
    }
  }

  console.log(`✅ Regenerated ${regenerated} titles, ${failed} failed`);

  return {
    total: conversations.length,
    regenerated,
    failed,
  };
};

// ============================================================================
// HELPER METHODS
// ============================================================================

/**
 * Build full conversation history for context
 * Retrieves all messages in a conversation and formats them for RAG context
 */
export const buildConversationContext = async (
  conversationId: string,
  userId: string,
  maxTokens: number = 50000
): Promise<string> => {

  console.log(`📚 [CONTEXT] Building conversation history for ${conversationId}`);

  // Get all messages in conversation
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      content: true,
      createdAt: true
    }
  });

  // Build conversation history
  let context = '## Conversation History\n\n';
  let tokenCount = 0;

  for (const message of messages) {
    const messageText = `**${message.role === 'user' ? 'User' : 'KODA'}** (${message.createdAt.toISOString()}):\n${message.content}\n\n`;

    // Rough token estimation (1 token ≈ 4 characters)
    const messageTokens = messageText.length / 4;

    if (tokenCount + messageTokens > maxTokens) {
      console.log(`📚 [CONTEXT] Reached token limit, truncating history`);
      break;
    }

    context += messageText;
    tokenCount += messageTokens;
  }

  console.log(`📚 [CONTEXT] Built history with ~${Math.floor(tokenCount)} tokens`);

  return context;
};

/**
 * Handle file actions if the message is a command
 * Returns result if action was executed, null if not a file action
 *
 * UPDATED: Now uses LLM-based intent detection for flexible understanding
 * Supports: CREATE_FOLDER, UPLOAD_FILE, RENAME_FILE, DELETE_FILE, MOVE_FILE
 */
export const handleFileActionsIfNeeded = async (
  userId: string,
  message: string,
  conversationId: string,
  attachedFiles?: any[]
): Promise<{ action: string; message: string } | null> => {

  const { llmIntentDetectorService } = require('./llmIntentDetector.service');
  const fileActionsService = require('./fileActions.service').default;

  // ========================================
  // Use LLM for flexible intent detection
  // ========================================
  const intentResult = await llmIntentDetectorService.detectIntent(message);

  console.log(`🎯 [LLM Intent] ${intentResult.intent} (confidence: ${intentResult.confidence})`);
  console.log(`📝 [Entities]`, intentResult.parameters);

  // Only process file actions with high confidence
  const fileActionIntents = ['create_folder', 'list_files', 'search_files', 'file_location', 'rename_file', 'delete_file', 'move_files', 'metadata_query'];

  // Check if this is a file action intent
  // ✅ FIX: Use OR (||) instead of AND (&&) - return null if EITHER condition is true
  if (!fileActionIntents.includes(intentResult.intent) || intentResult.confidence < 0.7) {
    // Not a file action - return null to continue with RAG
    return null;
  }

  // ========================================
  // CREATE FOLDER
  // ========================================
  // Check for folder creation using LLM parameters or fallback patterns
  const createFolderPatterns = [
    /create\s+(?:a\s+)?(?:new\s+)?folder\s+(?:named\s+|called\s+)?["']?([^"']+)["']?/i,
    /make\s+(?:a\s+)?(?:new\s+)?folder\s+(?:named\s+|called\s+)?["']?([^"']+)["']?/i,
    /new\s+folder\s+["']?([^"']+)["']?/i,
  ];

  let folderName = intentResult.parameters?.folderName || null;

  // Fallback to regex if LLM didn't extract folder name
  if (!folderName) {
    for (const pattern of createFolderPatterns) {
      const match = message.match(pattern);
      if (match) {
        folderName = match[1].trim();
        break;
      }
    }
  }

  if (folderName) {
    console.log(`📁 [Action] Creating folder: "${folderName}"`);

    // Create folder
    const folderResult = await fileActionsService.createFolder({
      userId,
      folderName
    });

    if (!folderResult.success) {
      return {
        action: 'create_folder',
        message: `❌ Failed to create folder: ${folderResult.error || folderResult.message}`
      };
    }

    const folderId = folderResult.data.folder.id;
    console.log(`✅ Folder created: ${folderId}`);

    // If files attached, upload them to the new folder
    if (attachedFiles && attachedFiles.length > 0) {
      const uploadService = require('./upload.service').default;
      const uploadedFiles = [];

      for (const file of attachedFiles) {
        try {
          const uploadResult = await uploadService.uploadFile(file, userId, folderId);
          uploadedFiles.push(uploadResult.filename);
        } catch (error) {
          console.error(`❌ Failed to upload ${file.name}:`, error);
        }
      }

      const fileList = uploadedFiles.map(f => `• ${f}`).join('\n');
      return {
        action: 'create_folder_with_files',
        message: `✅ Created folder **"${folderName}"** and added **${uploadedFiles.length} file(s)**:\n\n${fileList}`
      };
    }

    return {
      action: 'create_folder',
      message: `✅ Created folder **"${folderName}"**`
    };
  }

  // ========================================
  // UPLOAD FILE
  // ========================================
  // Check for file upload to folder patterns
  const uploadPatterns = [
    /(?:upload|save|store|put|add|move)\s+(?:this|these|the)?\s*(?:file|files|document|documents)?\s+(?:to|in|into)\s+(?:the\s+)?["']?([^"']+)["']?\s*(?:folder)?/i,
  ];

  let targetFolder = intentResult.parameters?.targetFolder || null;

  if (!targetFolder) {
    for (const pattern of uploadPatterns) {
      const match = message.match(pattern);
      if (match) {
        targetFolder = match[1].trim();
        break;
      }
    }
  }

  if (targetFolder) {
    console.log(`📤 [Action] Uploading files to: "${targetFolder}"`);

    // Find folder by name
    const folder = await prisma.folder.findFirst({
      where: {
        name: {
          contains: targetFolder
          // Note: mode: 'insensitive' not supported with contains
        },
        userId
      }
    });

    if (!folder) {
      return {
        action: 'upload_file',
        message: `❌ Folder "${targetFolder}" not found. Please create it first or check the name.`
      };
    }

    if (!attachedFiles || attachedFiles.length === 0) {
      return {
        action: 'upload_file',
        message: `❌ No files attached. Please attach files to upload.`
      };
    }

    const uploadService = require('./upload.service').default;
    const uploadedFiles = [];

    for (const file of attachedFiles) {
      try {
        const uploadResult = await uploadService.uploadFile(file, userId, folder.id);
        uploadedFiles.push(uploadResult.filename);
      } catch (error) {
        console.error(`❌ Failed to upload ${file.name}:`, error);
      }
    }

    const fileList = uploadedFiles.map(f => `• ${f}`).join('\n');
    return {
      action: 'upload_file',
      message: `✅ Uploaded **${uploadedFiles.length} file(s)** to folder **"${targetFolder}"**:\n\n${fileList}`
    };
  }

  // ========================================
  // RENAME FILE
  // ========================================
  if (intentResult.intent === 'rename_file' &&
      intentResult.parameters?.oldFilename &&
      intentResult.parameters?.newFilename) {

    console.log(`✏️ [Action] Renaming: "${intentResult.parameters.oldFilename}" → "${intentResult.parameters.newFilename}"`);

    const result = await fileActionsService.executeAction(message, userId);

    return {
      action: 'rename_file',
      message: result.message
    };
  }

  // ========================================
  // DELETE FILE
  // ========================================
  if (intentResult.intent === 'delete_file' && intentResult.parameters?.filename) {
    console.log(`🗑️ [Action] Deleting: "${intentResult.parameters.filename}"`);

    const result = await fileActionsService.executeAction(message, userId);

    return {
      action: 'delete_file',
      message: result.message
    };
  }

  // ========================================
  // MOVE FILE
  // ========================================
  if (intentResult.intent === 'move_files' &&
      intentResult.parameters?.filename &&
      intentResult.parameters?.targetFolder) {

    console.log(`📦 [Action] Moving: "${intentResult.parameters.filename}" → "${intentResult.parameters.targetFolder}"`);

    const result = await fileActionsService.executeAction(message, userId);

    return {
      action: 'move_file',
      message: result.message
    };
  }

  // ========================================
  // LIST FILES
  // ========================================
  if (intentResult.intent === 'list_files') {
    console.log(`📋 [Action] Listing files`);

    // Extract parameters
    const fileType = intentResult.parameters?.fileType || null;
    const fileTypes = intentResult.parameters?.fileTypes || [];
    const folderName = intentResult.parameters?.folderName || null;

    // If file types are specified, use FileTypeHandler for better formatting
    if (fileType || (fileTypes && fileTypes.length > 0)) {
      console.log(`📄 Using FileTypeHandler for file types: ${fileTypes.length > 0 ? fileTypes.join(', ') : fileType}`);

      const { FileTypeHandler } = require('./handlers/fileType.handler');
      const fileTypeHandler = new FileTypeHandler();

      // Build query string for FileTypeHandler
      const queryParts = [];
      if (fileTypes && fileTypes.length > 0) {
        queryParts.push(...fileTypes);
      } else if (fileType) {
        queryParts.push(fileType);
      }

      const fileTypeQuery = queryParts.join(' and ');

      try {
        const result = await fileTypeHandler.handle(userId, fileTypeQuery, {
          folderId: folderName ? undefined : undefined // TODO: resolve folder by name
        });

        if (result) {
          return {
            action: 'list_files',
            message: result.answer
          };
        }
      } catch (error) {
        console.error('❌ FileTypeHandler error:', error);
        // Fall through to default handler
      }
    }

    // Build query
    const whereClause: any = {
      userId,
      status: { not: 'deleted' },
    };

    // Filter by file type if specified
    if (fileType) {
      console.log(`📄 Filtering by file type: "${fileType}"`);

      // Map friendly names to extensions
      const extensionMap: Record<string, string[]> = {
        'pdf': ['.pdf'],
        'word': ['.docx', '.doc'],
        'docx': ['.docx'],
        'doc': ['.doc'],
        'excel': ['.xlsx', '.xls'],
        'xlsx': ['.xlsx'],
        'xls': ['.xls'],
        'powerpoint': ['.pptx', '.ppt'],
        'pptx': ['.pptx'],
        'ppt': ['.ppt'],
        'presentation': ['.pptx', '.ppt'],
        'image': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'],
        'jpg': ['.jpg'],
        'jpeg': ['.jpeg'],
        'png': ['.png'],
        'gif': ['.gif'],
        'photo': ['.jpg', '.jpeg', '.png'],
        'text': ['.txt'],
        'txt': ['.txt'],
      };

      const extensions = extensionMap[fileType.toLowerCase()] || [`.${fileType}`];

      whereClause.OR = extensions.map(ext => ({
        filename: {
          endsWith: ext,
          mode: 'insensitive'
        }
      }));
    }

    // Filter by folder if specified
    if (folderName) {
      console.log(`📁 Filtering by folder: "${folderName}"`);

      const folder = await prisma.folder.findFirst({
        where: {
          name: {
            contains: folderName,
            mode: 'insensitive'
          },
          userId
        }
      });

      if (!folder) {
        return {
          action: 'list_files',
          message: `❌ Folder "${folderName}" not found.`
        };
      }

      whereClause.folderId = folder.id;
    }

    // Get documents from database
    const documents = await prisma.document.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 files
      include: {
        folder: {
          select: { name: true }
        }
      }
    });

    // Handle no results
    if (documents.length === 0) {
      let message = 'No files found';
      if (fileType) message += ` of type "${fileType}"`;
      if (folderName) message += ` in folder "${folderName}"`;
      message += '.';

      return {
        action: 'list_files',
        message
      };
    }

    // Format response
    let message = `**Found ${documents.length} file${documents.length !== 1 ? 's' : ''}**`;
    if (fileType) message += ` of type **${fileType.toUpperCase()}**`;
    if (folderName) message += ` in folder **"${folderName}"**`;
    message += ':\n\n';

    // List files
    documents.forEach(doc => {
      const size = doc.fileSize ? `(${(doc.fileSize / 1024).toFixed(1)} KB)` : '';
      message += `• ${doc.filename} ${size}\n`;
    });

    // Add note if list was truncated
    if (documents.length === 50) {
      message += '\n_Showing first 50 files. Narrow your search by specifying a file type or folder._';
    }

    return {
      action: 'list_files',
      message: message.trim()
    };
  }

  // ========================================
  // METADATA QUERY
  // ========================================
  if (intentResult.intent === 'metadata_query') {
    console.log(`📊 [Action] Metadata query - counting files by type`);

    // Get ALL documents from database
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
      },
      select: {
        filename: true,
        fileSize: true,
      }
    });

    if (documents.length === 0) {
      return {
        action: 'metadata_query',
        message: 'You have no documents uploaded yet.'
      };
    }

    // Count by file type
    const typeCounts: Record<string, number> = {};
    const typeSizes: Record<string, number> = {};

    documents.forEach(doc => {
      // Get file extension - check if filename has a dot
      const parts = doc.filename.split('.');
      let ext = 'unknown';

      // Only extract extension if there's actually a dot AND the last part is not the whole filename
      if (parts.length > 1 && parts[parts.length - 1] !== doc.filename) {
        ext = parts[parts.length - 1].toLowerCase();
      }

      // Map extensions to friendly names
      const typeMap: Record<string, string> = {
        'pdf': 'PDF',
        'docx': 'Word (DOCX)',
        'doc': 'Word (DOC)',
        'xlsx': 'Excel (XLSX)',
        'xls': 'Excel (XLS)',
        'pptx': 'PowerPoint (PPTX)',
        'ppt': 'PowerPoint (PPT)',
        'jpg': 'Image (JPG)',
        'jpeg': 'Image (JPEG)',
        'png': 'Image (PNG)',
        'gif': 'Image (GIF)',
        'bmp': 'Image (BMP)',
        'svg': 'Image (SVG)',
        'txt': 'Text (TXT)',
        'unknown': 'No Extension',
      };

      const type = typeMap[ext] || ext.toUpperCase();

      // Count files and sum sizes
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      typeSizes[type] = (typeSizes[type] || 0) + (doc.fileSize || 0);
    });

    // Check if user asked for specific file types
    const fileTypes = intentResult.parameters?.fileTypes || [];

    if (fileTypes.length > 0) {
      // User asked for specific types (e.g., "how many PDFs and DOCX")
      console.log(`📊 Specific types requested:`, fileTypes);

      let message = '**File Count:**\n\n';

      fileTypes.forEach((requestedType: string) => {
        // Find matching type in our counts
        const matchingType = Object.keys(typeCounts).find(type =>
          type.toLowerCase().includes(requestedType.toLowerCase())
        );

        if (matchingType) {
          const count = typeCounts[matchingType];
          const size = typeSizes[matchingType];
          const sizeMB = (size / (1024 * 1024)).toFixed(2);

          message += `• **${matchingType}**: ${count} file${count !== 1 ? 's' : ''} (${sizeMB} MB)\n`;
        } else {
          message += `• **${requestedType.toUpperCase()}**: 0 files\n`;
        }
      });

      return {
        action: 'metadata_query',
        message: message.trim()
      };
    }

    // General query - show all file types
    let message = `**You have ${Object.keys(typeCounts).length} types of files:**\n\n`;

    // Sort by count descending
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

    sortedTypes.forEach(([type, count]) => {
      const size = typeSizes[type] || 0;
      const sizeMB = (size / (1024 * 1024)).toFixed(2);

      message += `• **${type}**: ${count} file${count !== 1 ? 's' : ''} (${sizeMB} MB)\n`;
    });

    // Add total
    const totalSize = Object.values(typeSizes).reduce((sum, size) => sum + size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    message += `\n**Total**: ${documents.length} files (${totalSizeMB} MB)`;

    return {
      action: 'metadata_query',
      message: message.trim()
    };
  }

  // Not a file action - return null to continue with RAG
  return null;
};

/**
 * Format document sources for display
 * Returns formatted string like:
 *
 * ---
 * **Document Sources (3)**
 *
 * • **Business Plan.pdf** (page 5)
 * • **Financial Report.xlsx** (Sheet 1)
 * • **Contract.docx** (page 2)
 */
const formatDocumentSources = (sources: any[], attachedDocId?: string): string => {
  if (!sources || sources.length === 0) {
    return '';
  }

  // Remove duplicates (same documentId)
  const uniqueSources = Array.from(
    new Map(sources.map(s => [s.documentId, s])).values()
  );

  const lines = [
    '---',
    `**Document Sources (${uniqueSources.length})**`,
    ''
  ];

  for (const source of uniqueSources) {
    let line = `• **${source.documentName}**`;

    // Mark attached document
    if (source.documentId === attachedDocId) {
      line += ' *(attached)*';
    }

    // Add location if available
    if (source.location) {
      line += ` (${source.location})`;
    } else if (source.metadata?.page) {
      line += ` (page ${source.metadata.page})`;
    }

    lines.push(line);
  }

  return lines.join('\n');
};

// ============================================================================
// CONVERSATION HISTORY HELPERS
// ============================================================================

/**
 * Get conversation history for context
 */
async function getConversationHistory(
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      content: true
    },
    take: 10 // Last 10 messages
  });

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createConversation,
  getUserConversations,
  getConversation,
  deleteConversation,
  deleteAllConversations,
  sendMessage,
  sendMessageStreaming,
  regenerateConversationTitles,
  buildConversationContext,
};
