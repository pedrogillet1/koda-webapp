// KODA Backend Server
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { config } from './config/env';
import './queues/document.queue'; // Initialize background workers
import jwt from 'jsonwebtoken';
import { createSecureServer, createHTTPRedirectServer, getPortConfig, checkCertificateExpiry } from './config/ssl.config';

// ✅ CRITICAL: Global error handlers to prevent server crashes
process.on('uncaughtException', (error: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION (server will continue):', error.message);
  console.error(error.stack);
  // Don't exit - let the server continue running
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ UNHANDLED REJECTION (server will continue):', reason);
  // Don't exit - let the server continue running
});

import { startReminderScheduler } from './jobs/reminder.scheduler';
import rbacService from './services/rbac.service';
import prisma from './config/database';
import websocketService from './services/websocket.service';
import { initializePinecone } from './services/rag.service';

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

      console.log('🔍 CORS Check - Origin:', origin, 'isNgrokDomain:', isNgrokDomain, 'allowed:', !origin || allowedOrigins.includes(origin || '') || isNgrokDomain);

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
  // Add transport options for better ngrok compatibility
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Allow Engine.IO v3 clients
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize WebSocket service with Socket.IO instance
websocketService.initialize(io);

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

  // ✅ Auto-join user to their user-specific room for title streaming and notifications
  if (socket.data.userId) {
    socket.join(`user:${socket.data.userId}`);
    console.log(`📡 Auto-joined user ${socket.data.userId} to their room`);
  }

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });

  // Join user-specific room for notifications (legacy - kept for compatibility)
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

      // ✅ FIX: Emit to BOTH room AND directly to sender socket
      // This ensures the sender always receives events even if room joining has issues (ngrok/polling)
      const emitToConversation = (event: string, data: any) => {
        io.to(`conversation:${conversationId}`).emit(event, data);
        // Also emit directly to sender socket as fallback
        socket.emit(event, data);
      };

      // Emit initial stage immediately
      emitToConversation('message-stage', {
        stage: 'thinking',
        message: 'Thinking...'
      });

      console.log('🔄 Calling RAG service...');
      const ragService = await import('./services/rag.service');
      const { default: prisma } = await import('./config/database');

      // ✅ FIX: Load existing conversation history BEFORE saving new message
      // This determines if this is the first message (for greeting logic)
      const existingMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true }
      });

      // Convert to format expected by RAG service
      const conversationHistory = existingMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log(`📚 [GREETING] Loaded ${conversationHistory.length} existing messages for conversation ${conversationId}`);

      // Save user message first
      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: data.content,
          isDocument: false,
        },
      });

      // ✅ FIX: Create assistant message placeholder BEFORE streaming
      // This prevents it from disappearing if user refreshes during streaming
      const assistantMessagePlaceholder = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: '', // Empty initially
          isDocument: false,
          metadata: JSON.stringify({
            status: 'streaming',
            startedAt: new Date().toISOString()
          }),
        },
      });

      // Use NEW Hybrid RAG service with streaming
      let fullResponse = '';

      const { sources } = await ragService.generateAnswerStream(
        authenticatedUserId,
        data.content,
        conversationId,
        (chunk: string) => {
          fullResponse += chunk;
          // Emit each chunk in real-time - use helper to emit to both room AND sender
          emitToConversation('message-chunk', {
            chunk,
            conversationId: conversationId
          });
        },
        data.attachedDocumentId, // Use actual attached document ID
        conversationHistory, // ✅ FIX: Pass conversation history for greeting logic
        (stage: string, message: string) => {
          // Emit stage updates for progress animation - use helper
          emitToConversation('message-stage', {
            stage,
            message
          });
        }
      );

      // ✅ CRITICAL: Apply post-processing to fullResponse before saving to database
      // This ensures consistency between streaming (which processes chunks) and refresh (which loads from DB)
      const processedAnswer = await ragService.postProcessAnswerExport(fullResponse);

      const result = {
        answer: processedAnswer,  // Use processed answer instead of raw fullResponse
        sources: sources,
        expandedQuery: undefined,
        contextId: undefined,
        actions: []
      };

      // ✅ FIX: Update placeholder message with final content instead of creating new one
      const assistantMessage = await prisma.message.update({
        where: { id: assistantMessagePlaceholder.id },
        data: {
          content: result.answer,
          metadata: JSON.stringify({
            status: 'complete',
            completedAt: new Date().toISOString(),
            ragSources: result.sources,
            expandedQuery: result.expandedQuery,
            contextId: result.contextId,
            actions: result.actions || []
          }),
        },
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Signal streaming complete (chunks already sent in real-time above)
      console.log('🚀🚀🚀 EMITTING message-complete event to room AND sender:', `conversation:${conversationId}`);
      console.log('📊 Sources:', result.sources?.length || 0);
      emitToConversation('message-complete', {
        conversationId: conversationId,
        sources: result.sources  // ✅ FIX: Include sources for frontend display
      });
      console.log('✅ message-complete event emitted successfully');

      // Update result to match expected format
      const formattedResult = {
        userMessage,
        assistantMessage,
        sources: result.sources,
        expandedQuery: result.expandedQuery,
        contextId: result.contextId,
        actions: result.actions || [],
        uiUpdate: result.uiUpdate // Include UI update instructions from chat actions
      };

      console.log('✅ RAG service completed, emitting new-message event to room AND sender');

      // Emit the complete message back to ALL clients in the conversation room AND sender
      emitToConversation('new-message', {
        conversationId: conversationId, // Include conversationId for frontend tracking
        userMessage: formattedResult.userMessage,
        assistantMessage: formattedResult.assistantMessage,
        sources: formattedResult.sources,
        expandedQuery: formattedResult.expandedQuery,
        contextId: formattedResult.contextId,
        actions: formattedResult.actions,
        uiUpdate: formattedResult.uiUpdate // Notify frontend to refresh folders/documents
      });

      // If there's a UI update, emit a separate event for immediate action
      if (result.uiUpdate) {
        console.log(`📢 Emitting UI update event: ${result.uiUpdate.type}`);
        emitToConversation('ui-update', {
          type: result.uiUpdate.type,
          data: result.uiUpdate.data
        });
      }

      // ✅ NEW: Auto-generate animated title on FIRST message
      // conversationHistory was loaded BEFORE the user message was saved, so length === 0 means first message
      const userMessageCount = conversationHistory.filter(m => m.role === 'user').length;
      if (userMessageCount === 0) {
        console.log('🏷️ [TITLE] Triggering animated title generation for first message via WebSocket');

        // Capture values for closure
        const userContent = data.content;
        const assistantContent = fullResponse;
        const convId = conversationId;
        const userId = authenticatedUserId;

        // Fire-and-forget title generation (don't block response)
        (async () => {
          try {
            const OpenAI = (await import('openai')).default;
            const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
            });

            // Emit title generation start
            io.to(`user:${userId}`).emit('title:generating:start', {
              conversationId: convId,
            });
            console.log(`📡 [TITLE-STREAM] Started streaming title for ${convId}`);

            let fullTitle = '';
            const stream = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Generate a short, descriptive title (max 50 chars) for this conversation. If it's just a greeting, return "New Chat". No quotes or special formatting.`,
                },
                {
                  role: 'user',
                  content: `User: "${userContent.slice(0, 500)}"\nAssistant: "${assistantContent.slice(0, 300)}"`,
                },
              ],
              temperature: 0.3,
              max_tokens: 30,
              stream: true,
            });

            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                fullTitle += content;
                io.to(`user:${userId}`).emit('title:generating:chunk', {
                  conversationId: convId,
                  chunk: content,
                });
              }
            }

            const cleanTitle = fullTitle.replace(/['"]/g, '').trim().substring(0, 100) || 'New Chat';

            // Update database
            await prisma.conversation.update({
              where: { id: convId },
              data: { title: cleanTitle, updatedAt: new Date() },
            });

            // Emit completion
            io.to(`user:${userId}`).emit('title:generating:complete', {
              conversationId: convId,
              title: cleanTitle,
              updatedAt: new Date(),
            });

            console.log(`✅ [TITLE-STREAM] Generated title: "${cleanTitle}"`);
          } catch (err) {
            console.error('❌ Error generating title:', err);
          }
        })();
      }

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

  // ⚡ PERFORMANCE FIX: Pre-warm Pinecone connection at startup
  // REASON: First Pinecone query takes 2832ms (cold start), subsequent: 184ms (warm)
  // IMPACT: Saves ~2.6 seconds on first user query
  (async () => {
    console.log('🔥 [STARTUP] Pre-warming Pinecone connection...');
    try {
      await initializePinecone();
      console.log('✅ [STARTUP] Pinecone connection pre-warmed and ready');
    } catch (error) {
      console.error('⚠️  [STARTUP] Failed to pre-warm Pinecone (will initialize on first request):', error);
    }
  })();

  // ═══════════════════════════════════════════════════════════════
  // START BACKGROUND DOCUMENT PROCESSOR
  // ═══════════════════════════════════════════════════════════════
  // Process pending documents every 30 seconds
  const PROCESSING_INTERVAL = 30000; // 30 seconds
  let isProcessing = false;

  async function processPendingDocuments() {
    if (isProcessing) {
      console.log('⏳ Document processor already running, skipping...');
      return;
    }

    try {
      isProcessing = true;

      // Find pending documents OR documents stuck in processing for >3 minutes
      const STUCK_THRESHOLD = 3 * 60 * 1000; // 3 minutes
      const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD);

      const pendingDocs = await prisma.document.findMany({
        where: {
          OR: [
            // Pick up pending documents immediately
            { status: 'pending' },
            // Only pick up processing documents that are stuck (>3 min old)
            {
              status: 'processing',
              updatedAt: {
                lt: stuckCutoff
              }
            }
          ]
        },
        orderBy: { createdAt: 'asc' },
        take: 5, // Process 5 at a time
      });

      if (pendingDocs.length > 0) {
        console.log(`\n📋 Found ${pendingDocs.length} pending documents to process`);

        for (const doc of pendingDocs) {
          try {
            console.log(`🔄 Processing document: ${doc.filename} (${doc.id})`);

            // Update status to processing
            await prisma.document.update({
              where: { id: doc.id },
              data: { status: 'processing' },
            });

            // Download file from GCS
            const { downloadFile } = await import('./config/storage');
            const downloadedBuffer = await downloadFile(doc.encryptedFilename);

            // Decrypt file if encrypted, otherwise use as-is
            let fileBuffer: Buffer;
            if (doc.isEncrypted) {
              const encryptionService = await import('./services/encryption.service');
              fileBuffer = encryptionService.default.decryptFile(
                downloadedBuffer,
                `document-${doc.userId}`
              );
            } else {
              // File is not encrypted, use directly
              fileBuffer = downloadedBuffer;
            }

            // Get thumbnail URL if exists
            const metadata = await prisma.documentMetadata.findUnique({
              where: { documentId: doc.id },
            });

            // Import and call the processing function
            const documentService = await import('./services/document.service');
            await documentService.processDocumentInBackground(
              doc.id,
              fileBuffer,
              doc.filename,
              doc.mimeType,
              doc.userId,
              metadata?.thumbnailUrl || null
            );

            console.log(`✅ Successfully processed: ${doc.filename}`);
          } catch (error) {
            console.error(`❌ Failed to process document ${doc.filename}:`, error);

            // Mark as failed
            await prisma.document.update({
              where: { id: doc.id },
              data: { status: 'failed' },
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in background document processor:', error);
    } finally {
      isProcessing = false;
    }
  }

  // Start the background processor
  console.log(`🔄 Starting background document processor (polling every ${PROCESSING_INTERVAL/1000}s)`);
  setInterval(processPendingDocuments, PROCESSING_INTERVAL);

  // Process immediately on startup
  processPendingDocuments().catch(err => {
    console.error('❌ Error in initial document processing:', err);
  });

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

 






 
 




