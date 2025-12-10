/**
 * Semantic Document Search Service
 *
 * Provides semantic search across user documents with confidence scoring.
 * - Searches Pinecone for semantically similar documents
 * - Calculates confidence scores based on multiple signals
 * - Returns structured results with document metadata
 *
 * Confidence Levels:
 * - HIGH (>80%): Direct match found, can answer confidently
 * - MEDIUM (50-80%): Partial match, may need clarification
 * - LOW (<50%): No good match, suggest alternatives
 */

import embeddingService from './embedding.service';
import pineconeService from './pinecone.service';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DocumentSearchResult {
  documentId: string;
  filename: string;
  content: string;
  similarity: number;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  pageNumber?: number;
  chunkIndex: number;
  folderPath?: string;
  mimeType?: string;
}

export interface SemanticSearchResponse {
  success: boolean;
  action: string | null;
  message: string;
  documents: DocumentSearchResult[];
  uiData: any;
  query: string;
  totalResults: number;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

interface SearchOptions {
  topK?: number;
  minSimilarity?: number;
  includeContent?: boolean;
  folderId?: string;
  documentId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Document Search Query Detection Patterns
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT SEARCH PATTERNS - Only for "find/list documents" queries
// NOT for content queries like "what is X about" - those go to RAG for summarization
// ═══════════════════════════════════════════════════════════════════════════
const DOCUMENT_SEARCH_PATTERNS = [
  // English patterns - Direct document LISTING/FINDING (not content retrieval)
  /\b(find|search|locate|look\s*for)\b.*\b(document|file|pdf|doc|excel|spreadsheet)\b/i,
  /\b(where|which)\b.*\b(document|file)\b.*\b(mentions?|contains?)\b/i,
  /\bwhat\s*(document|file)s?\b.*\b(have|do\s*i\s*have)\b/i,
  /\b(list|show)\b.*\b(all|my)\b.*\b(document|file)s?\b/i,
  /which (document|file)s? (mention|contain|talk about)/i,

  // Portuguese patterns - Document listing only
  /\b(encontre|busque|procure|ache)\b.*\b(documento|arquivo|pdf)\b/i,
  /\b(qual|quais|onde)\b.*\b(documento|arquivo)\b.*\b(menciona|contém)\b/i,
  /\b(listar|mostrar)\b.*\b(todos?|meus?)\b.*\b(documento|arquivo)s?\b/i,

  // Spanish patterns - Document listing only
  /\b(encontrar|buscar|localizar)\b.*\b(documento|archivo|pdf)\b/i,
  /\b(cuál|cuáles|dónde)\b.*\b(documento|archivo)\b.*\b(menciona|contiene)\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT QUERY PATTERNS - These should go to RAG for actual content retrieval
// DO NOT add these to DOCUMENT_SEARCH_PATTERNS - they need full RAG pipeline
// ═══════════════════════════════════════════════════════════════════════════
// Examples that should NOT trigger document search (they need RAG):
// - "what is trabalho projeto about" → find doc, READ it, SUMMARIZE
// - "tell me about X" → find doc about X, READ it, SUMMARIZE
// - "explain the content of X" → find X, READ it, EXPLAIN
// - "summarize X" → find X, READ it, SUMMARIZE

// ═══════════════════════════════════════════════════════════════════════════
// Semantic Document Search Service
// ═══════════════════════════════════════════════════════════════════════════

class SemanticDocumentSearchService {
  /**
   * Check if a query is asking to find documents
   */
  isDocumentSearchQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    return DOCUMENT_SEARCH_PATTERNS.some(pattern => pattern.test(lowerQuery));
  }

  /**
   * Extract the search topic from a document search query
   */
  extractSearchTopic(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Remove document search keywords to get the topic
    let topic = query
      .replace(/\b(find|search|locate|look\s*for|show\s*me|where\s*is|which)\b/gi, '')
      .replace(/\b(document|file|pdf|doc|excel|spreadsheet)s?\b/gi, '')
      .replace(/\b(that|which|the|a|an|my|all)\b/gi, '')
      .replace(/\b(about|regarding|on|contains?|mentions?|talks?\s*about|has)\b/gi, '')
      .replace(/\b(encontre|busque|procure|ache|mostre|qual|quais|onde)\b/gi, '')
      .replace(/\b(documento|arquivo|pdf|sobre|fala|menciona|contém)\b/gi, '')
      .replace(/[?!.,]/g, '')
      .trim();

    // Clean up extra spaces
    topic = topic.replace(/\s+/g, ' ').trim();

    return topic || query;
  }

  /**
   * Main search method - finds documents semantically matching a query
   */
  async search(
    query: string,
    userId: string,
    options: SearchOptions = {}
  ): Promise<SemanticSearchResponse> {
    const startTime = Date.now();
    console.log(`🔍 [SEMANTIC SEARCH] Searching for: "${query}" (user: ${userId.substring(0, 8)}...)`);

    try {
      // Extract the search topic
      const searchTopic = this.extractSearchTopic(query);
      console.log(`   📌 Search topic: "${searchTopic}"`);

      // Generate embedding for the search query
      const embeddingResult = await embeddingService.generateQueryEmbedding(searchTopic);

      if (!embeddingResult.embedding || embeddingResult.embedding.length === 0) {
        console.error('❌ [SEMANTIC SEARCH] Failed to generate embedding');
        return this.buildEmptyResponse(query, 'Failed to process search query');
      }

      // Search Pinecone for similar documents
      const topK = options.topK || 10;
      const minSimilarity = options.minSimilarity || 0.3;

      const searchResults = await pineconeService.searchSimilarChunks(
        embeddingResult.embedding,
        userId,
        topK,
        minSimilarity,
        options.documentId,
        options.folderId
      );

      const searchTime = Date.now() - startTime;
      console.log(`   ⏱️ Search completed in ${searchTime}ms, found ${searchResults.length} results`);

      if (searchResults.length === 0) {
        return this.buildEmptyResponse(query, 'No matching documents found');
      }

      // Transform results with confidence scoring
      const documents = await this.transformResults(searchResults, searchTopic);

      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(documents);
      const confidenceLevel = this.getConfidenceLevel(overallConfidence);

      // Build response message based on confidence
      const message = this.buildResponseMessage(documents, searchTopic, confidenceLevel);

      return {
        success: true,
        action: 'document_search',
        message,
        documents,
        uiData: {
          searchTopic,
          searchTime,
          confidenceLevel
        },
        query,
        totalResults: documents.length,
        confidence: overallConfidence,
        confidenceLevel
      };

    } catch (error: any) {
      console.error('❌ [SEMANTIC SEARCH] Error:', error.message);
      return this.buildEmptyResponse(query, `Search failed: ${error.message}`);
    }
  }

  /**
   * Transform Pinecone results into DocumentSearchResult format with confidence scores
   */
  private async transformResults(
    results: any[],
    searchTopic: string
  ): Promise<DocumentSearchResult[]> {
    // Deduplicate by document ID, keeping highest similarity chunk
    const documentMap = new Map<string, any>();

    for (const result of results) {
      const existing = documentMap.get(result.documentId);
      if (!existing || result.similarity > existing.similarity) {
        documentMap.set(result.documentId, result);
      }
    }

    const documents: DocumentSearchResult[] = [];

    for (const [documentId, result] of documentMap) {
      // Calculate confidence based on multiple signals
      const confidence = this.calculateConfidence(result, searchTopic);
      const confidenceLevel = this.getConfidenceLevel(confidence);

      // Get folder path if available
      let folderPath: string | undefined;
      if (result.metadata?.folderId) {
        folderPath = await this.getFolderPath(result.metadata.folderId);
      }

      documents.push({
        documentId,
        filename: result.document?.filename || result.metadata?.filename || 'Unknown',
        content: result.content?.substring(0, 500) || '',
        similarity: result.similarity,
        confidence,
        confidenceLevel,
        pageNumber: result.metadata?.pageNumber || result.metadata?.page,
        chunkIndex: result.chunkIndex,
        folderPath,
        mimeType: result.document?.mimeType || result.metadata?.mimeType
      });
    }

    // Sort by confidence descending
    return documents.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate confidence score based on multiple signals
   */
  private calculateConfidence(result: any, searchTopic: string): number {
    let confidence = result.similarity * 100; // Start with similarity as base

    // Boost for exact filename match
    const filename = (result.document?.filename || result.metadata?.filename || '').toLowerCase();
    const topicWords = searchTopic.toLowerCase().split(/\s+/);

    for (const word of topicWords) {
      if (word.length > 2 && filename.includes(word)) {
        confidence += 10;
      }
    }

    // Boost for content containing search terms
    const content = (result.content || '').toLowerCase();
    let termMatches = 0;
    for (const word of topicWords) {
      if (word.length > 2 && content.includes(word)) {
        termMatches++;
      }
    }
    confidence += termMatches * 5;

    // Cap at 100
    return Math.min(100, Math.round(confidence));
  }

  /**
   * Calculate overall confidence from document results
   */
  private calculateOverallConfidence(documents: DocumentSearchResult[]): number {
    if (documents.length === 0) return 0;

    // Weighted average - top result matters more
    const weights = [0.5, 0.3, 0.2];
    let totalWeight = 0;
    let weightedSum = 0;

    for (let i = 0; i < Math.min(documents.length, weights.length); i++) {
      weightedSum += documents[i].confidence * weights[i];
      totalWeight += weights[i];
    }

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Get confidence level from score
   */
  private getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  /**
   * Build response message based on results and confidence
   */
  private buildResponseMessage(
    documents: DocumentSearchResult[],
    searchTopic: string,
    confidenceLevel: 'high' | 'medium' | 'low'
  ): string {
    if (documents.length === 0) {
      return `I couldn't find any documents about "${searchTopic}". Try uploading relevant documents or refining your search.`;
    }

    const topDoc = documents[0];

    if (confidenceLevel === 'high') {
      let msg = `I found ${documents.length} document${documents.length > 1 ? 's' : ''} about "${searchTopic}":\n\n`;

      for (const doc of documents.slice(0, 5)) {
        const location = doc.folderPath ? ` (in ${doc.folderPath})` : '';
        msg += `• **${doc.filename}**${location}\n`;
        if (doc.pageNumber) {
          msg += `  Page ${doc.pageNumber}\n`;
        }
      }

      if (documents.length > 5) {
        msg += `\n_...and ${documents.length - 5} more documents_`;
      }

      return msg;
    }

    if (confidenceLevel === 'medium') {
      let msg = `I found some documents that might be related to "${searchTopic}":\n\n`;

      for (const doc of documents.slice(0, 3)) {
        const location = doc.folderPath ? ` (in ${doc.folderPath})` : '';
        msg += `• **${doc.filename}**${location} - ${doc.confidence}% match\n`;
      }

      msg += '\nWould you like me to search for something more specific?';
      return msg;
    }

    // Low confidence
    let msg = `I found some documents, but I'm not confident they match "${searchTopic}":\n\n`;
    msg += `• **${topDoc.filename}** - ${topDoc.confidence}% match\n\n`;
    msg += 'Try being more specific in your search, or upload documents about this topic.';

    return msg;
  }

  /**
   * Build empty response for no results
   */
  private buildEmptyResponse(query: string, message: string): SemanticSearchResponse {
    return {
      success: false,
      action: null,
      message,
      documents: [],
      uiData: null,
      query,
      totalResults: 0,
      confidence: 0,
      confidenceLevel: 'low'
    };
  }

  /**
   * Get full folder path from folder ID
   */
  private async getFolderPath(folderId: string): Promise<string> {
    try {
      const path: string[] = [];
      let currentFolderId: string | null = folderId;
      let iterations = 0;

      while (currentFolderId && iterations < 20) {
        iterations++;
        const folder: { name: string; parentFolderId: string | null } | null = await prisma.folder.findUnique({
          where: { id: currentFolderId },
          select: { name: true, parentFolderId: true }
        });

        if (!folder) break;
        path.unshift(folder.name);
        currentFolderId = folder.parentFolderId;
      }

      return path.length > 0 ? path.join('/') : 'root';
    } catch (error) {
      console.error('Error getting folder path:', error);
      return 'unknown';
    }
  }

  /**
   * Search for documents by filename pattern
   */
  async searchByFilename(
    filename: string,
    userId: string
  ): Promise<SemanticSearchResponse> {
    console.log(`🔍 [SEMANTIC SEARCH] Searching by filename: "${filename}"`);

    try {
      const documents = await prisma.documents.findMany({
        where: {
          userId,
          status: { not: 'deleted' },
          filename: {
            contains: filename,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          folderId: true,
          createdAt: true
        },
        take: 10
      });

      if (documents.length === 0) {
        return this.buildEmptyResponse(filename, `No documents found matching "${filename}"`);
      }

      const results: DocumentSearchResult[] = [];

      for (const doc of documents) {
        const folderPath = doc.folderId ? await this.getFolderPath(doc.folderId) : undefined;

        results.push({
          documentId: doc.id,
          filename: doc.filename,
          content: '',
          similarity: 1.0,
          confidence: 100,
          confidenceLevel: 'high',
          chunkIndex: 0,
          folderPath,
          mimeType: doc.mimeType
        });
      }

      return {
        success: true,
        action: 'filename_search',
        message: `Found ${documents.length} document${documents.length > 1 ? 's' : ''} matching "${filename}"`,
        documents: results,
        uiData: { searchType: 'filename' },
        query: filename,
        totalResults: documents.length,
        confidence: 100,
        confidenceLevel: 'high'
      };

    } catch (error: any) {
      console.error('❌ [SEMANTIC SEARCH] Filename search error:', error.message);
      return this.buildEmptyResponse(filename, `Search failed: ${error.message}`);
    }
  }
}

export const semanticDocumentSearchService = new SemanticDocumentSearchService();
export default semanticDocumentSearchService;
