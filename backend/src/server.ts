import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { config } from './config/env';
import './queues/document.queue'; // Initialize background workers
import jwt from 'jsonwebtoken';
import { createSecureServer, createHTTPRedirectServer, getPortConfig, checkCertificateExpiry } from './config/ssl.config';

import { startReminderScheduler } from './jobs/reminder.scheduler';
import rbacService from './services/rbac.service';

const portConfig = getPortConfig();

// Create HTTPS server (or HTTP in development)
const httpServer = createSecureServer(app);

// Create HTTP to HTTPS redirect server (production only)
const redirectServer = createHTTPRedirectServer();

// Initialize Socket.IO with dynamic CORS for ngrok domains
export const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow configured frontend URL, any ngrok domain, or no origin (same-origin)
      const allowedOrigins = [config.FRONTEND_URL, 'https://koda-frontend.ngrok.app'];
      const isNgrokDomain = origin && (origin.includes('.ngrok.app') || origin.includes('.ngrok-free.dev'));

      if (!origin || allowedOrigins.includes(origin || '') || isNgrokDomain) {
        // Return the actual origin to set Access-Control-Allow-Origin header
        callback(null, origin || '*');
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as { userId: string; email: string };
    socket.data.userId = decoded.userId; // Store userId in socket data
    socket.data.email = decoded.email;
    next();
  } catch (error) {
    console.error('❌ WebSocket authentication failed:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (User: ${socket.data.userId})`);

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });

  // Join user-specific room for notifications
  socket.on('join-user-room', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`📡 User ${userId} joined their room`);
  });

  // KODA Chat: Join conversation room
  socket.on('join-conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
    const roomSize = io.sockets.adapter.rooms.get(`conversation:${conversationId}`)?.size || 0;
    console.log(`💬 Joined conversation: ${conversationId} (${roomSize} clients in room)`);
  });

  // KODA Chat: Leave conversation room
  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`💬 Left conversation: ${conversationId}`);
  });

  // KODA Chat: Send message (real-time with STREAMING)
  socket.on('send-message', async (data: { conversationId: string; content: string; attachedDocumentId?: string }) => {
    console.log('📨 Received send-message event:', { conversationId: data.conversationId, userId: socket.data.userId, contentLength: data.content?.length, hasAttachment: !!data.attachedDocumentId });

    try {
      // ✅ SECURITY: Use authenticated userId from socket, NOT from client data
      const authenticatedUserId = socket.data.userId;

      if (!authenticatedUserId) {
        console.error('❌ Unauthorized: No user ID in socket');
        socket.emit('message-error', { error: 'Unauthorized: No user ID in socket' });
        return;
      }

      let conversationId = data.conversationId;

      // Lazy chat creation: If conversationId is "new", create a new conversation
      if (conversationId === 'new' || !conversationId) {
        const { createConversation } = await import('./services/chat.service');
        const newConversation = await createConversation({
          userId: authenticatedUserId,
          title: 'New Chat', // Will be updated with AI-generated title after first message
        });
        conversationId = newConversation.id;

        // Notify client of new conversation ID so they can update the URL
        socket.emit('conversation-created', {
          conversationId: newConversation.id,
        });

        // Auto-join the new conversation room
        socket.join(`conversation:${conversationId}`);

        console.log('🆕 Created new conversation via WebSocket:', conversationId);
      }

      // Emit initial stage immediately
      io.to(`conversation:${conversationId}`).emit('message-stage', {
        stage: 'thinking',
        message: 'Thinking...'
      });

      console.log('🔄 Calling ENHANCED ADAPTIVE streaming service for intelligent response...');
      const enhancedAdaptiveAIService = await import('./services/enhancedAdaptiveAI.service');
      const { default: prisma } = await import('./config/database');

      // Save user message first
      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: data.content,
          isDocument: false,
        },
      });

      // Use enhanced adaptive AI to generate intelligent response with streaming
      const result = await enhancedAdaptiveAIService.default.generateStreamingResponse(
        data.content,
        authenticatedUserId,
        (chunk: string) => {
          console.log(`📤 Emitting chunk to conversation:${conversationId}:`, chunk.substring(0, 50));
          // Emit each chunk in real-time to all clients in the conversation
          io.to(`conversation:${conversationId}`).emit('message-chunk', {
            chunk,
            conversationId: conversationId
          });
        },
        {
          conversationId: conversationId,
          attachedDocumentId: data.attachedDocumentId
        }
      );

      // Save assistant message
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: result.answer,
          isDocument: false,
        },
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Update result to match expected format
      const formattedResult = {
        userMessage,
        assistantMessage,
        followUp: result.followUp,
        queryType: result.type,
        confidence: result.confidence,
        responseTime: result.responseTime
      };

      console.log('✅ Adaptive streaming completed, emitting new-message event');

      // Emit the complete message back to ALL clients in the conversation room
      io.to(`conversation:${conversationId}`).emit('new-message', {
        conversationId: conversationId, // Include conversationId for frontend tracking
        userMessage: formattedResult.userMessage,
        assistantMessage: formattedResult.assistantMessage,
        followUp: formattedResult.followUp,
        queryType: formattedResult.queryType,
        confidence: formattedResult.confidence,
        responseTime: formattedResult.responseTime
      });

      console.log('✅ new-message event emitted successfully');
    } catch (error: any) {
      console.error('❌ Error in send-message handler:', error);
      console.error('❌ Error stack:', error.stack);
      socket.emit('message-error', { error: error.message });
    }
  });
});

// Check certificate expiry on startup
checkCertificateExpiry();

// Start HTTPS server (or HTTP in development)
httpServer.listen(portConfig.httpsPort, () => {
  const protocol = portConfig.useSSL ? 'https' : 'http';
  const port = portConfig.httpsPort;

  console.log(`🚀 Server is running on ${protocol}://localhost:${port}`);
  console.log(`📝 Environment: ${config.NODE_ENV}`);
  console.log(`🔗 Health check: ${protocol}://localhost:${port}/health`);
  console.log(`⚙️  Background workers initialized`);
  console.log(`🔌 WebSocket server ready`);

  if (portConfig.useSSL) {
    console.log(`🔒 SSL/HTTPS enabled - secure connection active`);
  } else {
    console.log(`⚠️  HTTP mode - SSL/HTTPS not enabled (development only)`);
  }

  // Start reminder scheduler
  startReminderScheduler();

  // Initialize RBAC system roles
  rbacService.initializeSystemRoles().catch(err => {
    console.error('❌ Failed to initialize RBAC system roles:', err);
  });
});

// Start HTTP redirect server (production only)
if (redirectServer && portConfig.httpPort) {
  redirectServer.listen(portConfig.httpPort, () => {
    console.log(`↪️  HTTP redirect server running on port ${portConfig.httpPort}`);
    console.log(`↪️  All HTTP traffic will be redirected to HTTPS`);
  });
}

 



