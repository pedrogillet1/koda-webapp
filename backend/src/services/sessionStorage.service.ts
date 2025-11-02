/**
 * Session Storage Service
 * Manages temporary document storage for session-based analysis
 *
 * Features:
 * - Store documents temporarily in Redis
 * - Query documents within a session
 * - Move documents from session to permanent storage
 * - Auto-expire sessions after 24 hours
 */

import Redis from 'ioredis';
import crypto from 'crypto';

export interface SessionDocument {
  sessionId: string;
  documentId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  extractedText: string;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    embedding: number[];
    metadata: any;
  }>;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    author?: string;
    creationDate?: Date;
    language?: string;
    fileType: string;
  };
  uploadedAt: Date;
}

export interface SessionMetadata {
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  documentCount: number;
  documentIds: string[];
}

class SessionStorageService {
  private redis: Redis | null = null;
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly SESSION_PREFIX = 'session:';
  private readonly DOCUMENT_PREFIX = 'session_doc:';

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL;

      if (!redisUrl) {
        console.warn('⚠️ [SessionStorage] Redis URL not configured - session mode disabled');
        return;
      }

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      await this.redis.connect();
      console.log('✅ [SessionStorage] Redis connected successfully');
    } catch (error) {
      console.error('❌ [SessionStorage] Redis connection failed:', error);
      this.redis = null;
    }
  }

  /**
   * Check if session storage is available
   */
  isAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }

  /**
   * Create a new session
   */
  async createSession(userId: string): Promise<SessionMetadata> {
    if (!this.isAvailable()) {
      throw new Error('Session storage not available');
    }

    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TTL * 1000);

    const session: SessionMetadata = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt,
      documentCount: 0,
      documentIds: [],
    };

    await this.redis!.setex(
      `${this.SESSION_PREFIX}${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );

    console.log(`✅ [SessionStorage] Created session ${sessionId} for user ${userId}`);
    return session;
  }

  /**
   * Get session metadata
   */
  async getSession(sessionId: string): Promise<SessionMetadata | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const data = await this.redis!.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Add document to session
   */
  async addDocument(
    sessionId: string,
    document: Omit<SessionDocument, 'sessionId'>
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Session storage not available');
    }

    // Get session
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Store document
    const sessionDoc: SessionDocument = {
      ...document,
      sessionId,
    };

    await this.redis!.setex(
      `${this.DOCUMENT_PREFIX}${sessionId}:${document.documentId}`,
      this.SESSION_TTL,
      JSON.stringify(sessionDoc)
    );

    // Update session metadata
    session.documentCount++;
    session.documentIds.push(document.documentId);
    await this.redis!.setex(
      `${this.SESSION_PREFIX}${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );

    console.log(`✅ [SessionStorage] Added document ${document.documentId} to session ${sessionId}`);
  }

  /**
   * Get document from session
   */
  async getDocument(sessionId: string, documentId: string): Promise<SessionDocument | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const data = await this.redis!.get(`${this.DOCUMENT_PREFIX}${sessionId}:${documentId}`);
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Get all documents in a session
   */
  async getSessionDocuments(sessionId: string): Promise<SessionDocument[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    const documents: SessionDocument[] = [];
    for (const documentId of session.documentIds) {
      const doc = await this.getDocument(sessionId, documentId);
      if (doc) {
        documents.push(doc);
      }
    }

    return documents;
  }

  /**
   * Query documents within a session using vector similarity
   */
  async querySession(
    sessionId: string,
    queryEmbedding: number[],
    topK: number = 5,
    minSimilarity: number = 0.3
  ): Promise<Array<{
    documentId: string;
    filename: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    metadata: any;
  }>> {
    if (!this.isAvailable()) {
      return [];
    }

    const documents = await this.getSessionDocuments(sessionId);

    // Calculate similarities for all chunks
    const results: Array<{
      documentId: string;
      filename: string;
      chunkIndex: number;
      content: string;
      similarity: number;
      metadata: any;
    }> = [];

    for (const doc of documents) {
      for (const chunk of doc.chunks) {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);

        if (similarity >= minSimilarity) {
          results.push({
            documentId: doc.documentId,
            filename: doc.filename,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            similarity,
            metadata: chunk.metadata,
          });
        }
      }
    }

    // Sort by similarity and return topK
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Delete document from session
   */
  async deleteDocument(sessionId: string, documentId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    // Delete document
    await this.redis!.del(`${this.DOCUMENT_PREFIX}${sessionId}:${documentId}`);

    // Update session metadata
    const session = await this.getSession(sessionId);
    if (session) {
      session.documentCount--;
      session.documentIds = session.documentIds.filter(id => id !== documentId);
      await this.redis!.setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.SESSION_TTL,
        JSON.stringify(session)
      );
    }

    console.log(`✅ [SessionStorage] Deleted document ${documentId} from session ${sessionId}`);
  }

  /**
   * Delete entire session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    // Delete all documents
    for (const documentId of session.documentIds) {
      await this.redis!.del(`${this.DOCUMENT_PREFIX}${sessionId}:${documentId}`);
    }

    // Delete session
    await this.redis!.del(`${this.SESSION_PREFIX}${sessionId}`);

    console.log(`✅ [SessionStorage] Deleted session ${sessionId}`);
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    await this.redis!.expire(`${this.SESSION_PREFIX}${sessionId}`, this.SESSION_TTL);

    const session = await this.getSession(sessionId);
    if (session) {
      for (const documentId of session.documentIds) {
        await this.redis!.expire(
          `${this.DOCUMENT_PREFIX}${sessionId}:${documentId}`,
          this.SESSION_TTL
        );
      }
    }

    console.log(`✅ [SessionStorage] Extended session ${sessionId}`);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: string): Promise<{
    documentCount: number;
    totalChunks: number;
    totalWords: number;
    fileTypes: Record<string, number>;
  } | null> {
    const documents = await this.getSessionDocuments(sessionId);

    if (documents.length === 0) {
      return null;
    }

    const stats = {
      documentCount: documents.length,
      totalChunks: 0,
      totalWords: 0,
      fileTypes: {} as Record<string, number>,
    };

    for (const doc of documents) {
      stats.totalChunks += doc.chunks.length;
      stats.totalWords += doc.metadata.wordCount || 0;

      const fileType = doc.metadata.fileType;
      stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
    }

    return stats;
  }
}

export default new SessionStorageService();
