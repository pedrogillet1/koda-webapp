/**
 * Infinite Conversation Memory Configuration
 *
 * These settings control how Koda remembers conversations forever (Manus-style)
 *
 * GOAL: 95%+ context retention across 50+ message conversations
 *
 * KEY CHANGES FROM DEFAULTS:
 * - minMessagesForChunking: 4 (was 10) - chunk earlier for faster context
 * - synchronous: true - wait for embeddings to complete before query
 * - recentMessageCount: 50 (was 20) - include more recent context
 * - similarityThreshold: 0.5 (was 0.7) - find more relevant historical chunks
 * - maxConversationTokens: 800K (was 200K) - use Gemini 2.0's full capacity
 */

export const INFINITE_MEMORY_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CHUNKING CONFIGURATION
  // Controls when and how conversations are split into searchable chunks
  // ═══════════════════════════════════════════════════════════════════════════
  chunking: {
    // Minimum messages before creating first chunk
    // LOWERED from 10 to 4 for faster context availability
    minMessagesForChunking: 4,

    // Messages per chunk (optimal for semantic coherence)
    messagesPerChunk: 10,

    // Max messages per chunk (hard limit)
    maxMessagesPerChunk: 15,

    // Min messages per chunk (for quality)
    minMessagesPerChunk: 5,

    // Overlap between chunks (for context continuity)
    chunkOverlap: 2,

    // Auto-chunk on every message save
    // CRITICAL: This is what triggers real-time chunking
    autoChunkOnSave: true,

    // Use AI to detect topic boundaries
    useSemanticBoundaries: true
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDING CONFIGURATION
  // Controls how chunks are converted to vectors for semantic search
  // ═══════════════════════════════════════════════════════════════════════════
  embedding: {
    // Embedding model (OpenAI for Pinecone compatibility)
    model: 'text-embedding-3-small',

    // Batch size for embedding multiple chunks
    batchSize: 10,

    // CRITICAL: Wait for embedding completion before returning
    // Was fire-and-forget, caused race conditions where chunks weren't searchable
    synchronous: true,

    // Pinecone namespaces
    chunkNamespace: 'conversations',
    indexNamespace: 'conversation-index'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RETRIEVAL CONFIGURATION
  // Controls how context is retrieved for each query
  // ═══════════════════════════════════════════════════════════════════════════
  retrieval: {
    // Number of recent messages to include in full
    // INCREASED from 20 to 50 for better immediate context
    recentMessageCount: 50,

    // Number of historical chunks to retrieve via semantic search
    // INCREASED from 5 to 10 for better historical recall
    historicalChunkCount: 10,

    // Minimum similarity score for chunk retrieval
    // LOWERED from 0.7 to 0.5 - was filtering out relevant chunks
    similarityThreshold: 0.5,

    // Include user memories in context
    includeMemories: true,

    // Max memories to include
    maxMemories: 5
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN BUDGET CONFIGURATION
  // Controls context window allocation (Gemini 2.0 Flash: 1M tokens)
  // ═══════════════════════════════════════════════════════════════════════════
  tokenBudget: {
    // Maximum tokens for conversation context
    // INCREASED from 200K to 800K to use Gemini 2.0's capacity
    maxConversationTokens: 800000,

    // Token allocation breakdown
    recentMessagesTokens: 100000,    // 12.5% for last 50 messages
    historicalChunksTokens: 500000,  // 62.5% for historical chunks
    memoriesTokens: 50000,           // 6.25% for user memories
    documentsTokens: 150000,         // 18.75% for RAG document context

    // System prompt reservation
    systemPromptTokens: 10000,

    // Output reservation
    outputReserveTokens: 80000,

    // Safety buffer
    bufferTokens: 200000
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPRESSION CONFIGURATION
  // Controls context compression when approaching token limits
  // ═══════════════════════════════════════════════════════════════════════════
  compression: {
    // Enable compression when approaching token limit
    enabled: true,

    // Compression threshold (% of max tokens)
    // Compress when 80% full
    threshold: 0.8,

    // Compression levels
    // 0 = none, 1 = light (summarize old chunks), 2 = medium, 3 = heavy
    levels: {
      light: { threshold: 0.7, ratio: 0.5 },
      medium: { threshold: 0.85, ratio: 0.3 },
      heavy: { threshold: 0.95, ratio: 0.1 }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIGGER CONFIGURATION
  // Controls when chunking is triggered
  // ═══════════════════════════════════════════════════════════════════════════
  trigger: {
    // Trigger chunking after every message save
    onMessageSave: true,

    // Debounce time in ms (prevent rapid re-chunking)
    debounceMs: 1000,

    // Max wait before forcing chunk (even if debouncing)
    maxWaitMs: 5000
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  logging: {
    // Enable verbose logging
    verbose: true,

    // Log prefix
    prefix: '♾️ [INFINITE MEMORY]',

    // Log chunking operations
    logChunking: true,

    // Log embedding operations
    logEmbedding: true,

    // Log retrieval operations
    logRetrieval: true,

    // Log compression operations
    logCompression: true
  }
};

// Helper functions for accessing config
export function getChunkingConfig() {
  return INFINITE_MEMORY_CONFIG.chunking;
}

export function getEmbeddingConfig() {
  return INFINITE_MEMORY_CONFIG.embedding;
}

export function getRetrievalConfig() {
  return INFINITE_MEMORY_CONFIG.retrieval;
}

export function getTokenBudgetConfig() {
  return INFINITE_MEMORY_CONFIG.tokenBudget;
}

export function getCompressionConfig() {
  return INFINITE_MEMORY_CONFIG.compression;
}

export function getTriggerConfig() {
  return INFINITE_MEMORY_CONFIG.trigger;
}

export default INFINITE_MEMORY_CONFIG;
