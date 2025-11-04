/**
 * RETRIEVAL STRATEGY SERVICE - KODA ARCHITECTURAL REDESIGN
 *
 * FIXES THE ROOT CAUSE OF COMPARISON FAILURES:
 * - Old system: Single vector search returns chunks from ONE document (highest similarity)
 * - New system: Intent-specific retrieval ensures ALL mentioned documents are included
 *
 * RETRIEVAL STRATEGIES:
 * 1. PRECISION: Few highly relevant chunks (factual queries)
 * 2. RECALL: Many chunks for comprehensive coverage (analysis)
 * 3. MULTI_DOCUMENT: Retrieve from EACH mentioned document (comparisons)
 * 4. DIVERSE: Spread across document for overview (summaries)
 * 5. METADATA_ONLY: Just document metadata (counts, lists)
 */

import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';
import prisma from '../config/database';
import {
  QueryUnderstanding,
  RetrievalStrategy,
} from './queryUnderstanding.service';

// ===== RETRIEVAL RESULT =====

export interface RetrievalResult {
  chunks: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    metadata: any;
  }>;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkCount: number;
  }>;
  confidence: number; // 0-1 based on retrieval quality
  coverage: number; // 0-1 based on how many requested documents were found
  strategy: RetrievalStrategy;
  totalChunks: number;
}

// ===== RETRIEVAL STRATEGY SERVICE =====

class RetrievalStrategyService {
  /**
   * Main entry point: Retrieve chunks based on strategy
   */
  async retrieve(
    understanding: QueryUnderstanding,
    userId: string,
    query: string
  ): Promise<RetrievalResult> {
    console.log(`📥 [RetrievalStrategy] Strategy: ${understanding.retrievalStrategy}, TopK: ${understanding.topK}`);

    switch (understanding.retrievalStrategy) {
      case RetrievalStrategy.NONE:
        return this.retrieveNone();

      case RetrievalStrategy.METADATA_ONLY:
        return this.retrieveMetadataOnly(userId, understanding);

      case RetrievalStrategy.MULTI_DOCUMENT:
        return this.retrieveMultiDocument(understanding, userId, query);

      case RetrievalStrategy.PRECISION:
        return this.retrievePrecision(userId, query, understanding);

      case RetrievalStrategy.RECALL:
        return this.retrieveRecall(userId, query, understanding);

      case RetrievalStrategy.DIVERSE:
        return this.retrieveDiverse(userId, query, understanding);

      default:
        return this.retrievePrecision(userId, query, understanding);
    }
  }

  /**
   * STRATEGY: NONE - No retrieval needed
   */
  private async retrieveNone(): Promise<RetrievalResult> {
    return {
      chunks: [],
      sources: [],
      confidence: 1.0,
      coverage: 1.0,
      strategy: RetrievalStrategy.NONE,
      totalChunks: 0,
    };
  }

  /**
   * STRATEGY: METADATA_ONLY - Just document metadata
   */
  private async retrieveMetadataOnly(userId: string, understanding: QueryUnderstanding): Promise<RetrievalResult> {
    const documents = await prisma.document.findMany({
      where: { userId, status: { not: 'deleted' } },
      select: {
        id: true,
        filename: true,
        createdAt: true,
        fileSize: true,
      },
    });

    const sources = documents.map(doc => ({
      documentId: doc.id,
      documentName: doc.filename,
      chunkCount: 0,
    }));

    return {
      chunks: [],
      sources,
      confidence: 1.0,
      coverage: 1.0,
      strategy: RetrievalStrategy.METADATA_ONLY,
      totalChunks: 0,
    };
  }

  /**
   * STRATEGY: MULTI_DOCUMENT - CRITICAL FOR COMPARISONS
   * Guarantees that ALL mentioned documents are included in results
   */
  private async retrieveMultiDocument(
    understanding: QueryUnderstanding,
    userId: string,
    query: string
  ): Promise<RetrievalResult> {
    const documentNames = understanding.entities.documentNames;

    if (documentNames.length === 0) {
      console.log('⚠️  [RetrievalStrategy] Multi-document requested but no document names extracted');
      return this.retrievePrecision(userId, query, understanding);
    }

    console.log(`🔍 [RetrievalStrategy] Multi-document retrieval for: ${documentNames.join(', ')}`);

    // Step 1: Find document IDs with fuzzy matching
    const documentIds = await this.findDocumentsByNames(documentNames, userId);

    console.log(`   Found ${documentIds.length}/${documentNames.length} documents`);

    if (documentIds.length === 0) {
      console.log('⚠️  [RetrievalStrategy] No documents found - falling back to precision retrieval');
      return this.retrievePrecision(userId, query, understanding);
    }

    // Step 2: Generate query embedding once
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    // Step 3: Retrieve chunks from EACH document separately
    const allChunks: Array<{
      documentId: string;
      documentName: string;
      chunkIndex: number;
      content: string;
      similarity: number;
      metadata: any;
    }> = [];

    const chunksPerDocument = Math.ceil(understanding.topK / documentIds.length);

    for (const doc of documentIds) {
      console.log(`   📄 Retrieving ${chunksPerDocument} chunks from: ${doc.name}`);

      // Search within this specific document
      const results = await pineconeService.searchSimilarChunks(
        embeddingResult.embedding,
        userId,
        chunksPerDocument,
        0.2, // Lower threshold for comparisons (we NEED content even if not perfect match)
        doc.id // Filter to this specific document
      );

      console.log(`      Found ${results.length} chunks`);

      // Add to combined results
      for (const result of results) {
        allChunks.push({
          documentId: result.documentId,
          documentName: result.document?.filename || doc.name,
          chunkIndex: result.chunkIndex,
          content: result.content,
          similarity: result.similarity,
          metadata: result.metadata,
        });
      }
    }

    // Step 4: Sort by document, then by similarity within document
    allChunks.sort((a, b) => {
      if (a.documentId !== b.documentId) {
        return a.documentId.localeCompare(b.documentId);
      }
      return b.similarity - a.similarity;
    });

    // Step 5: Calculate confidence and coverage
    const uniqueDocuments = [...new Set(allChunks.map(c => c.documentId))];
    const coverage = uniqueDocuments.length / documentNames.length;
    const avgSimilarity = allChunks.reduce((sum, c) => sum + c.similarity, 0) / (allChunks.length || 1);
    const confidence = avgSimilarity * coverage;

    const sources = uniqueDocuments.map(docId => {
      const docChunks = allChunks.filter(c => c.documentId === docId);
      return {
        documentId: docId,
        documentName: docChunks[0].documentName,
        chunkCount: docChunks.length,
      };
    });

    console.log(`✅ [RetrievalStrategy] Retrieved ${allChunks.length} chunks from ${uniqueDocuments.length} documents (coverage: ${Math.round(coverage * 100)}%)`);

    return {
      chunks: allChunks,
      sources,
      confidence,
      coverage,
      strategy: RetrievalStrategy.MULTI_DOCUMENT,
      totalChunks: allChunks.length,
    };
  }

  /**
   * STRATEGY: PRECISION - Few highly relevant chunks (factual queries)
   */
  private async retrievePrecision(
    userId: string,
    query: string,
    understanding: QueryUnderstanding
  ): Promise<RetrievalResult> {
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    const results = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      understanding.topK,
      0.7 // High similarity threshold for precision
    );

    const chunks = results.map(r => ({
      documentId: r.documentId,
      documentName: r.document?.filename || 'Unknown',
      chunkIndex: r.chunkIndex,
      content: r.content,
      similarity: r.similarity,
      metadata: r.metadata,
    }));

    const uniqueDocuments = [...new Set(chunks.map(c => c.documentId))];
    const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity, 0) / (chunks.length || 1);

    const sources = uniqueDocuments.map(docId => ({
      documentId: docId,
      documentName: chunks.find(c => c.documentId === docId)?.documentName || 'Unknown',
      chunkCount: chunks.filter(c => c.documentId === docId).length,
    }));

    return {
      chunks,
      sources,
      confidence: avgSimilarity,
      coverage: 1.0,
      strategy: RetrievalStrategy.PRECISION,
      totalChunks: chunks.length,
    };
  }

  /**
   * STRATEGY: RECALL - Many chunks for comprehensive coverage (analysis)
   */
  private async retrieveRecall(
    userId: string,
    query: string,
    understanding: QueryUnderstanding
  ): Promise<RetrievalResult> {
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    const results = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      understanding.topK,
      0.5 // Lower threshold for recall (more chunks)
    );

    const chunks = results.map(r => ({
      documentId: r.documentId,
      documentName: r.document?.filename || 'Unknown',
      chunkIndex: r.chunkIndex,
      content: r.content,
      similarity: r.similarity,
      metadata: r.metadata,
    }));

    const uniqueDocuments = [...new Set(chunks.map(c => c.documentId))];
    const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity, 0) / (chunks.length || 1);

    const sources = uniqueDocuments.map(docId => ({
      documentId: docId,
      documentName: chunks.find(c => c.documentId === docId)?.documentName || 'Unknown',
      chunkCount: chunks.filter(c => c.documentId === docId).length,
    }));

    return {
      chunks,
      sources,
      confidence: avgSimilarity,
      coverage: 1.0,
      strategy: RetrievalStrategy.RECALL,
      totalChunks: chunks.length,
    };
  }

  /**
   * STRATEGY: DIVERSE - Spread across document for overview (summaries)
   */
  private async retrieveDiverse(
    userId: string,
    query: string,
    understanding: QueryUnderstanding
  ): Promise<RetrievalResult> {
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    // Retrieve more chunks than needed
    const results = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      understanding.topK * 2,
      0.5
    );

    // Group by document
    const byDocument = new Map<string, typeof results>();
    for (const result of results) {
      if (!byDocument.has(result.documentId)) {
        byDocument.set(result.documentId, []);
      }
      byDocument.get(result.documentId)!.push(result);
    }

    // For each document, select diverse chunks (spread across chunk indices)
    const diverseChunks: typeof results = [];
    for (const [docId, docResults] of byDocument.entries()) {
      // Sort by chunk index
      docResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Select evenly spaced chunks
      const step = Math.max(1, Math.floor(docResults.length / (understanding.topK / byDocument.size)));
      for (let i = 0; i < docResults.length; i += step) {
        diverseChunks.push(docResults[i]);
        if (diverseChunks.length >= understanding.topK) break;
      }
      if (diverseChunks.length >= understanding.topK) break;
    }

    const chunks = diverseChunks.map(r => ({
      documentId: r.documentId,
      documentName: r.document?.filename || 'Unknown',
      chunkIndex: r.chunkIndex,
      content: r.content,
      similarity: r.similarity,
      metadata: r.metadata,
    }));

    const uniqueDocuments = [...new Set(chunks.map(c => c.documentId))];
    const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity, 0) / (chunks.length || 1);

    const sources = uniqueDocuments.map(docId => ({
      documentId: docId,
      documentName: chunks.find(c => c.documentId === docId)?.documentName || 'Unknown',
      chunkCount: chunks.filter(c => c.documentId === docId).length,
    }));

    return {
      chunks,
      sources,
      confidence: avgSimilarity * 0.9, // Slightly lower confidence for diverse retrieval
      coverage: 1.0,
      strategy: RetrievalStrategy.DIVERSE,
      totalChunks: chunks.length,
    };
  }

  /**
   * Find documents by names with fuzzy matching
   */
  private async findDocumentsByNames(
    documentNames: string[],
    userId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const foundDocuments: Array<{ id: string; name: string }> = [];

    for (const searchName of documentNames) {
      const searchLower = searchName.toLowerCase().trim();

      // Try exact match first (case-insensitive contains)
      let documents = await prisma.document.findMany({
        where: {
          userId,
          status: { not: 'deleted' },
          filename: {
            contains: searchLower,
          },
        },
        select: {
          id: true,
          filename: true,
        },
        take: 1,
      });

      // If no exact match, try without extension
      if (documents.length === 0) {
        const nameWithoutExt = searchLower.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');

        documents = await prisma.document.findMany({
          where: {
            userId,
            status: { not: 'deleted' },
            filename: {
              contains: nameWithoutExt,
            },
          },
          select: {
            id: true,
            filename: true,
          },
          take: 1,
        });
      }

      // If still no match, try fuzzy matching (remove spaces)
      if (documents.length === 0) {
        const nameWithoutSpaces = searchLower.replace(/\s+/g, '');

        const allDocs = await prisma.document.findMany({
          where: {
            userId,
            status: { not: 'deleted' },
          },
          select: {
            id: true,
            filename: true,
          },
        });

        // Find documents where filename (without spaces) contains search term (without spaces)
        const fuzzyMatches = allDocs.filter(doc => {
          const docNameLower = doc.filename.toLowerCase().replace(/\s+/g, '');
          return docNameLower.includes(nameWithoutSpaces) || nameWithoutSpaces.includes(docNameLower.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, ''));
        });

        if (fuzzyMatches.length > 0) {
          documents = fuzzyMatches.slice(0, 1);
        }
      }

      if (documents.length > 0) {
        foundDocuments.push({
          id: documents[0].id,
          name: documents[0].filename,
        });
      } else {
        console.log(`⚠️  [RetrievalStrategy] Could not find document: "${searchName}"`);
      }
    }

    return foundDocuments;
  }
}

export const retrievalStrategyService = new RetrievalStrategyService();
export default retrievalStrategyService;
