/**
 * KODA Backend Server V1
 *
 * Clean server startup with V1 RAG pipeline
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { config } from './config/env';
import jwt from 'jsonwebtoken';
import { createSecureServer, createHTTPRedirectServer, getPortConfig, checkCertificateExpiry } from './config/ssl.config';
import prisma from './config/database';
import websocketService from './services/websocket.service';
import { ragServiceV1 } from './services/core/ragV1.service';
import chatService from './services/chat.service';

// ============================================================================
// Global Error Handlers
// ============================================================================

process.on('uncaughtException', (error: Error) => {
  console.error('UNCAUGHT EXCEPTION:', error.message);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// ============================================================================
// Server Setup
// ============================================================================

const portConfig = getPortConfig();
const httpServer = createSecureServer(app);
const redirectServer = createHTTPRedirectServer();

// Initialize Socket.IO
export const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [config.FRONTEND_URL, 'https://getkoda.ai', 'http://localhost:3000'];
      if (!origin || allowedOrigins.includes(origin || '')) {
        callback(null, origin || '*');
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================================================
// Socket.IO Authentication
// ============================================================================

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { userId: string };
    socket.data.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// ============================================================================
// Socket.IO Event Handlers
// ============================================================================

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log(`[WS] User connected: ${userId}`);

  // Join user's personal room
  socket.join(`user:${userId}`);

  // Handle chat messages
  socket.on('send-message', async (data: {
    conversationId: string;
    content: string;
    attachedDocumentId?: string;
  }) => {
    try {
      const { conversationId, content, attachedDocumentId } = data;

      // Join conversation room
      socket.join(`conversation:${conversationId}`);

      // Send acknowledgment
      socket.emit('message-received', { conversationId });

      // Process message
      const result = await chatService.sendMessageStreaming(
        {
          userId,
          conversationId,
          content,
          attachedDocumentId,
        },
        (chunk: string) => {
          // Stream chunks to client
          io.to(`conversation:${conversationId}`).emit('message-chunk', {
            chunk,
            conversationId,
          });
        }
      );

      // Send completion
      io.to(`conversation:${conversationId}`).emit('message-complete', {
        conversationId,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        sources: result.sources,
      });
    } catch (error: any) {
      console.error('[WS] Message error:', error);
      socket.emit('message-error', { error: error.message });
    }
  });

  // Handle conversation join
  socket.on('join-conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[WS] User disconnected: ${userId}`);
  });
});

// ============================================================================
// Start Server
// ============================================================================

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('[Server] Database connected');

    // Initialize WebSocket service
    websocketService.initialize(io);

    // Start HTTPS server
    httpServer.listen(portConfig.httpsPort, () => {
      console.log(`[Server] Running on port ${portConfig.httpsPort}`);
      console.log(`[Server] Environment: ${config.NODE_ENV}`);
    });

    // Start HTTP redirect (production only)
    if (redirectServer && config.NODE_ENV === 'production' && portConfig.httpPort) {
      redirectServer.listen(portConfig.httpPort, () => {
        console.log(`[Server] HTTP redirect on port ${portConfig.httpPort}`);
      });
    }

    // Check SSL certificate expiry
    checkCertificateExpiry();

    console.log('[Server] V1 RAG Pipeline initialized');
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

export default httpServer;
