import { Request, Response } from 'express';
import chatService from '../services/chat.service';
import { transcribeAudioWithWhisper } from '../services/gemini.service';
import { emitToUser } from '../services/websocket.service';
import prisma from '../config/database';

/**
 * Create a new conversation
 */
export const createConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title } = req.body;

    const conversation = await chatService.createConversation({
      userId,
      title,
    });

    res.status(201).json(conversation);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all conversations for the logged-in user
 */
export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await chatService.getUserConversations(userId);
    res.json(conversations);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get a single conversation with messages
 */
export const getConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const conversation = await chatService.getConversation(conversationId, userId);
    res.json(conversation);
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(404).json({ error: error.message });
  }
};

/**
 * Send a message in a conversation
 * Supports lazy chat creation: if conversationId is "new", creates conversation on first message
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let { conversationId } = req.params;
    const { content, attachedDocumentId, answerLength } = req.body; // Phase 4D: Added answerLength

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Lazy chat creation: If conversationId is "new", create a new conversation
    if (conversationId === 'new' || !conversationId) {
      const newConversation = await chatService.createConversation({
        userId,
        title: 'New Chat', // Will be updated with AI-generated title after first message
      });
      conversationId = newConversation.id;
      console.log('🆕 Created new conversation on first message:', conversationId);
    }

    const result = await chatService.sendMessage({
      userId,
      conversationId,
      content,
      attachedDocumentId,
      answerLength, // Phase 4D: Pass answer length to chat service
    });

    // Include conversation ID in response for frontend to track
    res.json({
      ...result,
      conversationId,
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Send a message with SSE streaming (Server-Sent Events)
 * Provides real-time streaming responses for better UX
 * Response time: 2-3 seconds to first token, complete in 8-10 seconds
 */
export const sendMessageStreaming = async (req: Request, res: Response) => {
  console.time('⚡ Total SSE Response Time');

  try {
    const userId = req.user!.id;
    let { conversationId } = req.params;
    const { content, attachedDocumentId } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Lazy chat creation
    if (conversationId === 'new' || !conversationId) {
      const newConversation = await chatService.createConversation({
        userId,
        title: 'New Chat',
      });
      conversationId = newConversation.id;
      console.log('🆕 Created new conversation for streaming:', conversationId);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

    // Call streaming service with chunk callback
    const result = await chatService.sendMessageStreaming(
      {
        userId,
        conversationId,
        content,
        attachedDocumentId,
      },
      (chunk: string) => {
        // Stream each chunk to client
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
      },
      undefined // onStage callback (not used in SSE streaming)
    );

    // Send completion signal
    res.write(`data: ${JSON.stringify({
      type: 'done',
      messageId: result.userMessage.id,
      assistantMessageId: result.assistantMessage.id,
      conversationId
    })}\n\n`);

    res.end();
    console.timeEnd('⚡ Total SSE Response Time');

  } catch (error: any) {
    console.error('❌ Error in SSE streaming:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    await chatService.deleteConversation(conversationId, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete all conversations
 */
export const deleteAllConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await chatService.deleteAllConversations(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting all conversations:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Transcribe audio using OpenAI Whisper
 */
export const transcribeAudio = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    console.log('🎤 Transcribing audio file:', {
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    const transcript = await transcribeAudioWithWhisper(req.file.buffer, req.file.mimetype);

    console.log('✅ Transcription successful:', transcript.substring(0, 100));

    res.json({
      success: true,
      transcript,
    });
  } catch (error: any) {
    console.error('❌ Transcription error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Send a research query (combines documents + web search)
 */
export const sendResearchQuery = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let { conversationId } = req.params;
    const { content, useResearch = true } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Lazy chat creation: If conversationId is "new", create a new conversation
    if (conversationId === 'new' || !conversationId) {
      const newConversation = await chatService.createConversation({
        userId,
        title: 'Research Query',
      });
      conversationId = newConversation.id;
      console.log('🆕 Created new conversation for research:', conversationId);
    }

    // TODO: Research pipeline service removed - stub endpoint
    res.status(501).json({
      error: 'Research pipeline not implemented',
      message: 'This feature is currently disabled'
    });
  } catch (error: any) {
    console.error('Error executing research query:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Clear semantic cache for all users
 * ⚠️ ADMIN ONLY - This clears all cached answers across the entire system
 */
export const clearSemanticCache = async (req: Request, res: Response) => {
  try {
    console.log('🗑️ Admin request to clear semantic cache from user:', req.user!.email);

    // TODO: Semantic cache service removed - stub endpoint
    res.json({
      success: true,
      message: `Semantic cache service is currently disabled`,
      deletedKeys: 0,
    });
  } catch (error: any) {
    console.error('❌ Error clearing semantic cache:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Regenerate conversation titles for all "New Chat" conversations
 */
export const regenerateTitles = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    console.log('🔄 Request to regenerate conversation titles from user:', req.user!.email);

    const result = await chatService.regenerateConversationTitles(userId);

    res.json({
      success: true,
      message: `Successfully regenerated ${result.regenerated} conversation titles`,
      ...result,
    });
  } catch (error: any) {
    console.error('❌ Error regenerating conversation titles:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Send adaptive message with intelligent response based on query complexity
 * Response time: 1-20s depending on query type (greetings: 1-2s, comprehensive: 15-20s)
 */
export const sendAdaptiveMessage = async (req: Request, res: Response) => {
  console.time('⚡ Adaptive Response Time');

  try {
    const userId = req.user!.id;
    let { conversationId } = req.params;
    const { content, attachedDocumentId } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Lazy chat creation
    if (conversationId === 'new' || !conversationId) {
      const newConversation = await chatService.createConversation({
        userId,
        title: 'New Chat',
      });
      conversationId = newConversation.id;
      console.log('🆕 Created new conversation for adaptive message:', conversationId);
    }

    // TODO: Adaptive AI service removed - stub endpoint
    res.status(501).json({
      error: 'Adaptive messaging not implemented',
      message: 'This feature is currently disabled. Please use the standard chat endpoints.'
    });
  } catch (error: any) {
    console.error('❌ Error in adaptive message:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Send adaptive message with SSE streaming
 * Streams response in real-time with query type awareness
 */
export const sendAdaptiveMessageStreaming = async (req: Request, res: Response) => {
  console.time('⚡ Adaptive Streaming Response Time');

  try {
    const userId = req.user!.id;
    let { conversationId } = req.params;
    const { content, attachedDocumentId } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Lazy chat creation
    if (conversationId === 'new' || !conversationId) {
      const newConversation = await chatService.createConversation({
        userId,
        title: 'New Chat',
      });
      conversationId = newConversation.id;
      console.log('🆕 Created new conversation for adaptive streaming:', conversationId);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

    // TODO: Hybrid AI service removed - stub endpoint
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Adaptive streaming not implemented',
      message: 'This feature is currently disabled. Please use the standard SSE streaming endpoint.'
    })}\n\n`);

    res.end();
    console.timeEnd('⚡ Adaptive Streaming Response Time');
  } catch (error: any) {
    console.error('❌ Error in adaptive streaming:', error);
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message,
      })}\n\n`
    );
    res.end();
  }
};
