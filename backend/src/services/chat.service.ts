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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CreateConversationParams {
  userId: string;
  title?: string;
}

interface SendMessageParams {
  userId: string;
  conversationId: string;
  content: string;
  attachedDocumentId?: string;
  answerLength?: string;
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
  const { userId, title = 'New Chat' } = params;

  console.log('💬 Creating new conversation for user:', userId);

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
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

  console.log(`✅ Found ${conversations.length} conversations`);
  return conversations;
};

/**
 * Get a single conversation with all messages
 */
export const getConversation = async (conversationId: string, userId: string) => {
  console.log('📖 Fetching conversation:', conversationId);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          attachments: true,
          chatDocuments: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

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
    throw new Error('Conversation not found or access denied');
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
  const { userId, conversationId, content, attachedDocumentId } = params;

  console.log('💬 Sending message in conversation:', conversationId);

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
      createdAt: new Date(),
    },
  });

  console.log('✅ User message saved:', userMessage.id);

  // Get conversation history for context
  const previousMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 20, // Last 20 messages for context
  });

  // Build conversation history array
  const conversationHistory = previousMessages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Generate AI response
  console.log('🤖 Generating AI response...');
  const aiResponse = await sendMessageToGemini(content, conversationHistory, attachedDocumentId);

  // Create assistant message
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: aiResponse.text || 'Sorry, I could not generate a response.',
      createdAt: new Date(),
    },
  });

  console.log('✅ Assistant message saved:', assistantMessage.id);

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Auto-generate title if this is the first exchange
  if (previousMessages.length <= 1) { // Only user message exists
    await autoGenerateTitle(conversationId, content);
  }

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
      createdAt: new Date(),
    },
  });

  console.log('✅ User message saved:', userMessage.id);

  // Get conversation history for context
  const previousMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  // Build conversation history array
  const conversationHistory = previousMessages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

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

    // Create assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: fullResponse,
        createdAt: new Date(),
      },
    });

    console.log('✅ File action completed:', fileActionResult.action);

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage,
      assistantMessage,
    };
  }

  // Not a file action - continue with normal RAG
  // Generate AI response with streaming using RAG service
  console.log('🤖 Generating streaming RAG response...');
  let fullResponse = '';

  const ragResult = await ragService.generateAnswerStreaming(
    userId,
    content,
    conversationId,
    'medium', // Default answer length
    attachedDocumentId,
    (chunk: string) => {
      fullResponse += chunk;
      onChunk(chunk); // Send chunk to client
    }
  );

  console.log(`✅ Streaming complete. Total response length: ${fullResponse.length} chars`);

  // ✅ FIX #1: Append document sources to response
  if (ragResult.sources && ragResult.sources.length > 0) {
    console.log(`📎 Appending ${ragResult.sources.length} document sources to response`);

    const sourcesText = formatDocumentSources(ragResult.sources, attachedDocumentId);
    fullResponse += '\n\n' + sourcesText;

    // Send sources to client as final chunk
    onChunk('\n\n' + sourcesText);
  }

  // Create assistant message with full response (including sources)
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullResponse, // Now includes sources
      createdAt: new Date(),
    },
  });

  console.log('✅ Assistant message saved:', assistantMessage.id);

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Auto-generate title if this is the first exchange
  if (previousMessages.length <= 1) {
    await autoGenerateTitle(conversationId, content);
  }

  return {
    userMessage,
    assistantMessage,
  };
};

// ============================================================================
// CONVERSATION TITLE GENERATION
// ============================================================================

/**
 * Auto-generate a conversation title based on the first message
 */
const autoGenerateTitle = async (conversationId: string, firstMessage: string) => {
  try {
    console.log('🏷️ Auto-generating title for conversation:', conversationId);

    // Generate a short title using the Gemini service
    const title = await generateConversationTitle(firstMessage);

    // Clean up the title (remove quotes, trim, limit length)
    const cleanTitle = title.replace(/['"]/g, '').trim().substring(0, 100);

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: cleanTitle || 'New Chat' },
    });

    console.log('✅ Title generated:', cleanTitle);
  } catch (error) {
    console.error('⚠️ Failed to auto-generate title:', error);
    // Non-critical error, don't throw
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
 * Handle file actions if the message is a command
 * Returns result if action was executed, null if not a file action
 *
 * UPDATED: Now uses LLM-based intent detection for flexible understanding
 * Supports: CREATE_FOLDER, UPLOAD_FILE, RENAME_FILE, DELETE_FILE, MOVE_FILE
 */
const handleFileActionsIfNeeded = async (
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
  const fileActionIntents = ['create_folder', 'list_files', 'search_files', 'file_location', 'rename_file', 'delete_file', 'move_files'];

  // Check if this is a file action intent
  if (!fileActionIntents.includes(intentResult.intent) && intentResult.confidence < 0.7) {
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
      intentResult.parameters?.oldName &&
      intentResult.parameters?.newName) {

    console.log(`✏️ [Action] Renaming: "${intentResult.parameters.oldName}" → "${intentResult.parameters.newName}"`);

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
  const movePatterns = [
    /move\s+["']?([^"']+?)["']?\s+to\s+["']?([^"']+?)["']?(?:\s+folder)?/i,
  ];

  for (const pattern of movePatterns) {
    const match = message.match(pattern);
    if (match) {
      const filename = match[1].trim();
      const targetFolder = match[2].trim();

      console.log(`📦 [Action] Moving: "${filename}" → "${targetFolder}"`);

      const result = await fileActionsService.executeAction(message, userId);

      return {
        action: 'move_file',
        message: result.message
      };
    }
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
};
