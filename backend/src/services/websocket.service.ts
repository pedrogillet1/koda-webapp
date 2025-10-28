import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import * as chatService from './chat.service';
import { generateConversationTitle } from './gemini.service';
import prisma from '../config/database';

let io: Server;

/**
 * Initialize Socket.IO server
 */
export const initializeWebSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: config.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'], // Support both WebSocket and fallback polling
  });

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as { id: string; email: string };
      (socket as any).userId = decoded.id;
      (socket as any).userEmail = decoded.email;
      console.log('✅ WebSocket authenticated:', decoded.email);
      next();
    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Handle connections
  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const userEmail = (socket as any).userEmail;

    console.log(`🔌 Client connected via WebSocket: ${userEmail} (${socket.id})`);

    // Join user-specific room for private messaging
    socket.join(`user:${userId}`);

    // Track active streaming requests for this socket
    const activeStreams = new Map<string, { aborted: boolean }>();

    // Handle streaming chat messages
    socket.on('chat:message:stream', async (data: {
      conversationId: string;
      content: string;
      attachedDocumentId?: string;
    }) => {
      try {
        console.log(`💬 Streaming message from ${userEmail}:`, data.content.slice(0, 50));

        let conversationId = data.conversationId;

        // Lazy chat creation: If conversationId is "new", create a new conversation
        if (conversationId === 'new' || !conversationId) {
          const newConversation = await chatService.createConversation({
            userId,
            title: 'New Chat',
          });
          conversationId = newConversation.id;

          // Notify client of new conversation ID
          socket.emit('chat:conversation:created', {
            conversationId: newConversation.id,
          });

          console.log('🆕 Created new conversation via WebSocket:', conversationId);
        }

        // Create abort controller for this stream
        const streamControl = { aborted: false };
        activeStreams.set(conversationId, streamControl);

        // Emit "analyzing" stage
        socket.emit('chat:stage', {
          stage: 'analyzing',
          message: data.attachedDocumentId ? 'Analyzing document...' : 'Analyzing your request...',
        });

        // Stream the response using the streaming service
        const result = await chatService.sendMessageStreaming(
          {
            userId,
            conversationId,
            content: data.content,
            attachedDocumentId: data.attachedDocumentId,
          },
          // Chunk callback - emit each chunk in real-time
          (chunk: string) => {
            // Check if stream was aborted
            if (streamControl.aborted) {
              console.log('🛑 Stream aborted by user');
              return false; // Signal to stop streaming
            }
            socket.emit('chat:message:chunk', { chunk });
            return true; // Continue streaming
          },
          // Stage callback - emit processing stages
          (stage: string, message: string) => {
            if (!streamControl.aborted) {
              socket.emit('chat:stage', { stage, message });
            }
          }
        );

        // Clean up stream control
        activeStreams.delete(conversationId);

        // Only emit completion if not aborted
        if (!streamControl.aborted) {
          // Fetch updated conversation to check if we need to generate a title
          const updatedConversation = await chatService.getConversation(conversationId, userId);

          // Generate conversation title if this is the first message (title is "New Chat")
          // Count messages to determine if this is the first exchange
          const messageCount = await prisma.message.count({
            where: { conversationId },
          });

          console.log(`🔍 [TITLE CHECK] Title: "${updatedConversation.title}", messageCount: ${messageCount}, condition met: ${updatedConversation.title === 'New Chat' && messageCount === 2}`);

          // If title is still "New Chat" and we have exactly 2 messages (first user message + first assistant response)
          if (updatedConversation.title === 'New Chat' && messageCount === 2) {
            console.log('📝 Generating AI-powered conversation title...');
            try {
              const title = await generateConversationTitle(
                result.userMessage.content,
                result.assistantMessage.content
              );
              console.log(`✅ Generated title: "${title}"`);

              // Update the conversation title in the database
              await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                  title,
                  updatedAt: new Date(),
                },
              });
              console.log(`✅ Title updated in database to: "${title}"`);

              // Update the conversation object so the frontend receives the new title
              updatedConversation.title = title;
            } catch (error) {
              console.error('❌ Error generating title:', error);
              // Continue even if title generation fails
            }
          } else {
            console.log(`⏭️ Skipping title generation (title: "${updatedConversation.title}", messageCount: ${messageCount})`);
          }

          // Emit completion with full message data (including chat document if generated)
          socket.emit('chat:message:complete', {
            conversationId,
            conversationTitle: updatedConversation.title, // Include the updated title (may have been regenerated)
            userMessage: result.userMessage,
            assistantMessage: {
              ...result.assistantMessage,
              chatDocument: result.chatDocument, // Attach the generated document to the assistant message
            },
            functionCall: result.functionCall,
            functionResult: result.functionResult,
            documents: (result as any).documents || [], // ⚡ NEW: Include document metadata for frontend display
          });

          console.log('✅ Streaming message complete');
        } else {
          console.log('🛑 Streaming aborted by user');
          socket.emit('chat:message:aborted', { conversationId });
        }
      } catch (error: any) {
        console.error('❌ Error in streaming message:', error);
        socket.emit('chat:error', {
          error: error.message || 'Failed to process message',
        });
      }
    });

    // Handle stop streaming request
    socket.on('chat:stop:stream', (data: { conversationId: string }) => {
      console.log(`🛑 Stop request for conversation: ${data.conversationId}`);
      const streamControl = activeStreams.get(data.conversationId);
      if (streamControl) {
        streamControl.aborted = true;
        console.log('✅ Stream marked for abortion');
      }
    });

    // Handle typing indicators (optional feature)
    socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
      // Broadcast to other users in the conversation (for future multi-user support)
      socket.to(`conversation:${data.conversationId}`).emit('chat:user:typing', {
        userId,
        isTyping: data.isTyping,
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${userEmail} (${socket.id})`);
    });
  });

  console.log('✅ WebSocket server initialized');

  return io;
};

/**
 * Get Socket.IO instance
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeWebSocket first.');
  }
  return io;
};

/**
 * Emit event to specific user
 */
export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emit event to specific conversation
 */
export const emitToConversation = (conversationId: string, event: string, data: any) => {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
};

/**
 * Emit document-related events to user for real-time updates
 */
export const emitDocumentEvent = (userId: string, eventType: 'created' | 'deleted' | 'moved' | 'updated', documentId?: string) => {
  if (io) {
    console.log(`📡 Emitting document-${eventType} event to user ${userId}`);
    io.to(`user:${userId}`).emit(`document-${eventType}`, { documentId, timestamp: new Date() });
    io.to(`user:${userId}`).emit('documents-changed', { timestamp: new Date() });
  }
};

/**
 * Emit folder-related events to user for real-time updates
 */
export const emitFolderEvent = (userId: string, eventType: 'created' | 'deleted' | 'updated', folderId?: string) => {
  if (io) {
    console.log(`📡 Emitting folder-${eventType} event to user ${userId}`);
    io.to(`user:${userId}`).emit(`folder-${eventType}`, { folderId, timestamp: new Date() });
    io.to(`user:${userId}`).emit('folders-changed', { timestamp: new Date() });
  }
};
