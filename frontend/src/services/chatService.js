import axios from 'axios';
import { io } from 'socket.io-client';
import { encryptData, decryptData } from '../utils/encryption';

const API_URL = process.env.REACT_APP_API_URL || 'https://koda-backend.ngrok.app';
const WS_URL = process.env.REACT_APP_WS_URL || 'https://koda-backend.ngrok.app';

// ⚡ ZERO-KNOWLEDGE ENCRYPTION: Get encryption password from AuthContext
// This will be passed to functions that need encryption
let encryptionPassword = null;

export const setEncryptionPassword = (password) => {
  encryptionPassword = password;
};

export const clearEncryptionPassword = () => {
  encryptionPassword = null;
};

// Axios instance for API calls
const api = axios.create({
  baseURL: `${API_URL}/api/chat`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Socket.IO client
let socket = null;

export const initializeSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(WS_URL, {
    auth: {
      token,
    },
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// API Functions

/**
 * Create a new conversation
 */
export const createConversation = async (title = 'New Chat') => {
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Encrypt conversation title
  let requestData = { title };

  if (encryptionPassword) {
    console.log('🔐 [Encryption] Encrypting conversation title:', title);
    const encryptedTitle = await encryptData(title, encryptionPassword);

    requestData = {
      title, // Send plaintext for non-encrypted users (backward compatibility)
      titleEncrypted: JSON.stringify(encryptedTitle.ciphertext),
      encryptionSalt: encryptedTitle.salt,
      encryptionIV: encryptedTitle.iv,
      encryptionAuthTag: encryptedTitle.authTag,
      isEncrypted: true,
    };

    console.log('✅ [Encryption] Title encrypted successfully');
  }

  const response = await api.post('/conversations', requestData);
  return response.data;
};

/**
 * Get all conversations
 */
export const getConversations = async () => {
  const response = await api.get('/conversations');

  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Decrypt conversation titles
  if (encryptionPassword && response.data.conversations) {
    const decryptedConversations = await Promise.all(
      response.data.conversations.map(async (conversation) => {
        if (conversation.titleEncrypted && conversation.encryptionSalt) {
          try {
            const encryptedData = {
              salt: conversation.encryptionSalt,
              iv: conversation.encryptionIV,
              ciphertext: JSON.parse(conversation.titleEncrypted),
              authTag: conversation.encryptionAuthTag,
            };
            const decryptedTitle = await decryptData(encryptedData, encryptionPassword);
            return { ...conversation, title: decryptedTitle };
          } catch (error) {
            console.error('❌ [Decryption] Failed to decrypt conversation title:', error);
            return conversation; // Return original if decryption fails
          }
        }
        return conversation;
      })
    );

    return { ...response.data, conversations: decryptedConversations };
  }

  return response.data;
};

/**
 * Get a single conversation with messages
 */
export const getConversation = async (conversationId) => {
  const response = await api.get(`/conversations/${conversationId}`);

  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Decrypt conversation title and messages
  if (encryptionPassword && response.data) {
    const conversation = response.data;

    // Decrypt conversation title
    if (conversation.titleEncrypted && conversation.encryptionSalt) {
      try {
        const encryptedTitleData = {
          salt: conversation.encryptionSalt,
          iv: conversation.encryptionIV,
          ciphertext: JSON.parse(conversation.titleEncrypted),
          authTag: conversation.encryptionAuthTag,
        };
        conversation.title = await decryptData(encryptedTitleData, encryptionPassword);
      } catch (error) {
        console.error('❌ [Decryption] Failed to decrypt conversation title:', error);
      }
    }

    // Decrypt messages
    if (conversation.messages) {
      conversation.messages = await Promise.all(
        conversation.messages.map(async (message) => {
          if (message.isEncrypted && message.encryptionSalt) {
            try {
              const encryptedContentData = {
                salt: message.encryptionSalt,
                iv: message.encryptionIV,
                ciphertext: message.contentEncrypted,
                authTag: message.encryptionAuthTag,
              };
              const decryptedContent = await decryptData(encryptedContentData, encryptionPassword);
              return { ...message, content: decryptedContent };
            } catch (error) {
              console.error('❌ [Decryption] Failed to decrypt message:', error);
              return message; // Return original if decryption fails
            }
          }
          return message;
        })
      );
    }
  }

  return response.data;
};

/**
 * Send a message in a conversation (REST API)
 */
export const sendMessage = async (conversationId, content, attachedDocumentId = null) => {
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Encrypt message content
  let requestData = {
    content,
    attachedDocumentId,
  };

  if (encryptionPassword) {
    console.log('🔐 [Encryption] Encrypting message content');
    const encryptedContent = await encryptData(content, encryptionPassword);

    requestData = {
      content, // Send plaintext for backward compatibility
      contentEncrypted: encryptedContent.ciphertext,
      encryptionSalt: encryptedContent.salt,
      encryptionIV: encryptedContent.iv,
      encryptionAuthTag: encryptedContent.authTag,
      isEncrypted: true,
      attachedDocumentId,
    };

    console.log('✅ [Encryption] Message encrypted successfully');
  }

  const response = await api.post(`/conversations/${conversationId}/messages`, requestData);
  return response.data;
};

/**
 * Send an adaptive message (intelligent response based on query complexity)
 * @param {string} conversationId - Conversation ID
 * @param {string} content - Message content
 * @param {string|null} attachedDocumentId - Optional attached document ID
 * @returns {Promise<Object>} Response with queryType, confidence, followUp, responseTime
 */
export const sendAdaptiveMessage = async (conversationId, content, attachedDocumentId = null) => {
  // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Encrypt message content
  let requestData = {
    content,
    attachedDocumentId,
  };

  if (encryptionPassword) {
    console.log('🔐 [Encryption] Encrypting adaptive message content');
    const encryptedContent = await encryptData(content, encryptionPassword);

    requestData = {
      content, // Send plaintext for backward compatibility
      contentEncrypted: encryptedContent.ciphertext,
      encryptionSalt: encryptedContent.salt,
      encryptionIV: encryptedContent.iv,
      encryptionAuthTag: encryptedContent.authTag,
      isEncrypted: true,
      attachedDocumentId,
    };

    console.log('✅ [Encryption] Adaptive message encrypted successfully');
  }

  const response = await api.post(`/conversations/${conversationId}/messages/adaptive`, requestData);
  return response.data;
};

/**
 * Send an adaptive message with SSE streaming
 * @param {string} conversationId - Conversation ID
 * @param {string} content - Message content
 * @param {function} onChunk - Callback for each content chunk
 * @param {function} onComplete - Callback when streaming completes
 * @param {string|null} attachedDocumentId - Optional attached document ID
 * @returns {Promise<void>}
 */
export const sendAdaptiveMessageStreaming = async (
  conversationId,
  content,
  onChunk,
  onComplete,
  attachedDocumentId = null
) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(
    `${API_URL}/api/chat/conversations/${conversationId}/messages/adaptive/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
        attachedDocumentId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      console.log('🏁 Stream finished (done=true)');
      break;
    }

    // Decode the chunk and add to buffer
    const decodedChunk = decoder.decode(value, { stream: true });
    console.log('📦 RAW CHUNK:', decodedChunk);
    buffer += decodedChunk;

    // SSE format uses \n\n (double newline) as delimiter
    const messages = buffer.split('\n\n');

    // Keep the last incomplete message in the buffer
    buffer = messages.pop() || '';

    console.log(`📝 Processing ${messages.length} SSE messages`);
    for (const message of messages) {
      // Each SSE message should have "data: " prefix
      const lines = message.split('\n');
      for (const line of lines) {
        console.log('📄 LINE:', line);
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('✅ PARSED DATA:', data);

            if (data.type === 'connected') {
              console.log('🔗 Connected to conversation:', data.conversationId);
            } else if (data.type === 'content') {
              console.log('🌊 CONTENT CHUNK:', data.content);
              onChunk(data.content);
            } else if (data.type === 'done') {
              console.log('✅ DONE signal received');
              onComplete(data);
            } else if (data.type === 'error') {
              console.error('❌ Streaming error:', data.error);
              throw new Error(data.error);
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error, 'Line:', line);
          }
        }
      }
    }
  }
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId) => {
  const response = await api.delete(`/conversations/${conversationId}`);
  return response.data;
};

/**
 * Delete all conversations
 */
export const deleteAllConversations = async () => {
  const response = await api.delete('/conversations');
  return response.data;
};

/**
 * Delete all empty conversations
 */
export const deleteEmptyConversations = async () => {
  const response = await api.delete('/conversations/empty');
  return response.data;
};

// WebSocket Functions

/**
 * Join a conversation room
 */
export const joinConversation = (conversationId) => {
  if (socket) {
    socket.emit('join-conversation', conversationId);
  }
};

/**
 * Leave a conversation room
 */
export const leaveConversation = (conversationId) => {
  if (socket) {
    socket.emit('leave-conversation', conversationId);
  }
};

/**
 * Send a message via WebSocket (real-time)
 */
export const sendMessageRealtime = (conversationId, userId, content, attachedDocumentId = null) => {
  if (socket) {
    socket.emit('send-message', {  // ✅ Fixed event name to match server.ts
      conversationId,
      content,
      attachedDocumentId,
    });
  }
};

/**
 * Stop streaming response
 */
export const stopStreaming = (conversationId) => {
  if (socket) {
    socket.emit('chat:stop:stream', { conversationId });
    console.log('🛑 Emitted stop streaming event for conversation:', conversationId);
  }
};

/**
 * Listen for new messages (complete)
 */
export const onNewMessage = (callback) => {
  if (socket) {
    socket.on('new-message', callback);  // ✅ Fixed event name to match server.ts
  }
};

/**
 * Listen for message errors
 */
export const onMessageError = (callback) => {
  if (socket) {
    socket.on('message-error', callback);  // ✅ Fixed event name to match server.ts
  }
};

/**
 * Listen for message chunks (streaming)
 */
export const onMessageChunk = (callback) => {
  if (socket) {
    socket.on('message-chunk', callback);  // ✅ Fixed event name to match server.ts
  }
};

/**
 * Listen for message stages (thinking, analyzing, etc.)
 */
export const onMessageStage = (callback) => {
  if (socket) {
    socket.on('message-stage', callback);  // ✅ Fixed event name to match server.ts
  }
};

/**
 * Listen for research progress updates
 */
export const onResearchProgress = (callback) => {
  if (socket) {
    socket.on('research:progress', callback);
  }
};

/**
 * Listen for message aborted event
 */
export const onMessageAborted = (callback) => {
  if (socket) {
    socket.on('chat:message:aborted', callback);
  }
};

/**
 * Listen for message complete event (streaming finished)
 */
export const onMessageComplete = (callback) => {
  if (socket) {
    socket.on('message-complete', callback);
  }
};

/**
 * Remove message listeners
 */
export const removeMessageListeners = () => {
  if (socket) {
    socket.removeAllListeners('new-message');  // ✅ Fixed event name to match server.ts
    socket.removeAllListeners('message-error');  // ✅ Fixed event name to match server.ts
    socket.removeAllListeners('message-chunk');  // ✅ Fixed event name to match server.ts
    socket.removeAllListeners('message-stage');  // ✅ Fixed event name to match server.ts
    socket.removeAllListeners('chat:message:aborted');
    socket.removeAllListeners('research:progress');
    socket.removeAllListeners('message-complete');
  }
};

// RAG API Functions

/**
 * Query using RAG (Retrieval Augmented Generation)
 * @param {string} conversationId - Conversation ID
 * @param {string} query - User's question
 * @param {boolean} researchMode - Enable web search integration
 * @returns {Promise<Object>} RAG response with answer and sources
 */
export const queryWithRAG = async (conversationId, query, researchMode = false) => {
  const token = localStorage.getItem('accessToken');
  const response = await axios.post(
    `${API_URL}/api/rag/query`,
    {
      conversationId,
      query,
      researchMode,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

/**
 * Answer a follow-up question using existing RAG context
 * @param {string} conversationId - Conversation ID
 * @param {string} query - Follow-up question
 * @param {string} previousContextId - Previous context ID
 * @returns {Promise<Object>} RAG response
 */
export const answerFollowUp = async (conversationId, query, previousContextId) => {
  const token = localStorage.getItem('accessToken');
  const response = await axios.post(
    `${API_URL}/api/rag/follow-up`,
    {
      conversationId,
      query,
      previousContextId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

/**
 * Get RAG context for a specific response
 * @param {string} contextId - Context ID
 * @returns {Promise<Object>} RAG context
 */
export const getRAGContext = async (contextId) => {
  const token = localStorage.getItem('accessToken');
  const response = await axios.get(
    `${API_URL}/api/rag/context/${contextId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  createConversation,
  getConversations,
  getConversation,
  sendMessage,
  sendAdaptiveMessage,
  sendAdaptiveMessageStreaming,
  deleteConversation,
  deleteAllConversations,
  deleteEmptyConversations,
  joinConversation,
  leaveConversation,
  sendMessageRealtime,
  stopStreaming,
  onNewMessage,
  onMessageError,
  onMessageChunk,
  onMessageStage,
  onMessageAborted,
  onMessageComplete,
  onResearchProgress,
  removeMessageListeners,
  queryWithRAG,
  answerFollowUp,
  getRAGContext,
};
