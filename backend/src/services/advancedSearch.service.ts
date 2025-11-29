/**
 * Advanced Search Service
 * Provides advanced filtering and search capabilities for documents
 *
 * Features:
 * - Filter by file type, date range, author, topics
 * - Search within specific documents
 * - Minimum relevance threshold
 * - Combined filters (AND logic)
 */

import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';
import prisma from '../config/database';

export interface SearchFilters {
  fileTypes?: string[]; // ['pdf', 'docx', 'xlsx']
  dateRange?: {
    start: Date;
    end: Date;
  };
  authors?: string[];
  topics?: string[];
  documentIds?: string[]; // Search only in these documents
  minRelevance?: number; // Minimum similarity score (0-1)
  hasSignature?: boolean;
  hasTables?: boolean;
  hasImages?: boolean;
  language?: string; // Filter by detected language
}

export interface SearchOptions {
  topK?: number; // Number of results to return
  includeMetadata?: boolean; // Include full document metadata
}

export interface SearchResult {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: any;
  document?: {
    id: string;
    filename: string;
    mimeType: string;
    createdAt: string;
    author?: string;
    topics?: string[];
    language?: string;
  };
}

class AdvancedSearchService {
  /**
   * Search with advanced filters
   */
  async search(
    query: string,
    userId: string,
    filters?: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log(`🔍 [AdvancedSearch] Searching with filters for user ${userId}`);

    const topK = options.topK || 10;
    const minRelevance = filters?.minRelevance || 0.3;

    // Step 1: Generate query embedding
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    // Step 2: Search Pinecone with vector similarity
    let pineconeResults = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      topK * 3, // Get more results for filtering
      minRelevance
    );

    // Step 3: Apply filters
    if (filters) {
      pineconeResults = await this.applyFilters(pineconeResults, filters, userId);
    }

    // Step 4: Limit to topK
    const results = pineconeResults.slice(0, topK);

    // Step 5: Enrich with full metadata if requested
    if (options.includeMetadata) {
      return await this.enrichWithMetadata(results, userId);
    }

    return results.map(r => ({
      documentId: r.documentId,
      documentName: r.document.filename,
      chunkIndex: r.chunkIndex,
      content: r.content,
      similarity: r.similarity,
      metadata: r.document_metadata,
    }));
  }

  /**
   * Apply filters to search results
   */
  private async applyFilters(
    results: any[],
    filters: SearchFilters,
    userId: string
  ): Promise<any[]> {
    let filtered = results;

    // Filter by file types
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      const allowedTypes = filters.fileTypes.map(t => t.toLowerCase());
      filtered = filtered.filter(r => {
        const mimeType = r.document_metadata.mimeType || r.document.mimeType;
        const fileType = this.getFileTypeFromMimeType(mimeType);
        return allowedTypes.includes(fileType);
      });

      console.log(`   Filtered by file types (${filters.fileTypes.join(', ')}): ${filtered.length} results`);
    }

    // Filter by document IDs
    if (filters.documentIds && filters.documentIds.length > 0) {
      filtered = filtered.filter(r => filters.documentIds!.includes(r.documentId));
      console.log(`   Filtered by document IDs: ${filtered.length} results`);
    }

    // Filter by date range (requires metadata from database)
    if (filters.dateRange) {
      const documentIds = [...new Set(filtered.map(r => r.documentId))];
      const documents = await prisma.documents.findMany({
        where: {
          id: { in: documentIds },
          userId,
          createdAt: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end,
          },
        },
        select: { id: true },
      });

      const validDocIds = new Set(documents.map(d => d.id));
      filtered = filtered.filter(r => validDocIds.has(r.documentId));

      console.log(`   Filtered by date range: ${filtered.length} results`);
    }

    // Filter by authors (requires metadata from database)
    if (filters.authors && filters.authors.length > 0) {
      const documentIds = [...new Set(filtered.map(r => r.documentId))];
      const documents = await prisma.documentsMetadatas.findMany({
        where: {
          documentId: { in: documentIds },
          author: { in: filters.authors },
        },
        select: { documentId: true },
      });

      const validDocIds = new Set(documents.map(d => d.documentId));
      filtered = filtered.filter(r => validDocIds.has(r.documentId));

      console.log(`   Filtered by authors (${filters.authors.join(', ')}): ${filtered.length} results`);
    }

    // Filter by topics (requires metadata from database)
    if (filters.topics && filters.topics.length > 0) {
      const documentIds = [...new Set(filtered.map(r => r.documentId))];
      const documents = await prisma.documentsMetadatas.findMany({
        where: {
          documentId: { in: documentIds },
        },
        select: { documentId: true, topics: true },
      });

      const validDocIds = new Set(
        documents
          .filter(d => {
            if (!d.topics) return false;
            const topicsArray = JSON.parse(d.topics);
            return filters.topics!.some(filterTopic =>
              topicsArray.some((docTopic: string) =>
                docTopic.toLowerCase().includes(filterTopic.toLowerCase())
              )
            );
          })
          .map(d => d.documentId)
      );

      filtered = filtered.filter(r => validDocIds.has(r.documentId));

      console.log(`   Filtered by topics (${filters.topics.join(', ')}): ${filtered.length} results`);
    }

    // Filter by content flags
    if (filters.hasSignature !== undefined ||
        filters.hasTables !== undefined ||
        filters.hasImages !== undefined ||
        filters.language) {
      const documentIds = [...new Set(filtered.map(r => r.documentId))];
      const whereClause: any = { documentId: { in: documentIds } };

      if (filters.hasSignature !== undefined) {
        whereClause.hasSignature = filters.hasSignature;
      }
      if (filters.hasTables !== undefined) {
        whereClause.hasTables = filters.hasTables;
      }
      if (filters.hasImages !== undefined) {
        whereClause.hasImages = filters.hasImages;
      }
      if (filters.language) {
        whereClause.language = filters.language;
      }

      const documents = await prisma.documentsMetadatas.findMany({
        where: whereClause,
        select: { documentId: true },
      });

      const validDocIds = new Set(documents.map(d => d.documentId));
      filtered = filtered.filter(r => validDocIds.has(r.documentId));

      console.log(`   Filtered by content flags: ${filtered.length} results`);
    }

    return filtered;
  }

  /**
   * Enrich results with full metadata
   */
  private async enrichWithMetadata(
    results: any[],
    userId: string
  ): Promise<SearchResult[]> {
    const documentIds = [...new Set(results.map(r => r.documentId))];

    // Fetch document metadata from database
    const metadataRecords = await prisma.documentsMetadatas.findMany({
      where: {
        documentId: { in: documentIds },
      },
      select: {
        documentId: true,
        author: true,
        topics: true,
        language: true,
        creationDate: true,
        summary: true,
      },
    });

    const metadataMap = new Map(metadataRecords.map(m => [m.documentId, m]));

    return results.map(r => {
      const metadata = metadataMap.get(r.documentId);

      return {
        documentId: r.documentId,
        documentName: r.document.filename,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: r.similarity,
        metadata: r.document_metadata,
        document: {
          id: r.documentId,
          filename: r.document.filename,
          mimeType: r.document.mimeType,
          createdAt: r.document.createdAt,
          author: metadata?.author,
          topics: metadata?.topics ? JSON.parse(metadata.topics) : [],
          language: metadata?.language,
        },
      };
    });
  }

  /**
   * Get file type from MIME type
   */
  private getFileTypeFromMimeType(mimeType: string): string {
    const typeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-powerpoint': 'ppt',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'image/jpeg': 'jpg',
      'image/png': 'png',
    };

    return typeMap[mimeType] || 'unknown';
  }

  /**
   * Search for documents with specific metadata criteria
   */
  async searchByMetadata(
    userId: string,
    criteria: {
      author?: string;
      topics?: string[];
      language?: string;
      hasSignature?: boolean;
      hasTables?: boolean;
      hasImages?: boolean;
      dateRange?: {
        start: Date;
        end: Date;
      };
    }
  ): Promise<Array<{
    documentId: string;
    filename: string;
    metadata: any;
  }>> {
    const whereClause: any = {};

    // Build where clause
    const metadataWhere: any = {};

    if (criteria.author) {
      metadataWhere.author = { contains: criteria.author };
    }
    if (criteria.language) {
      metadataWhere.language = criteria.language;
    }
    if (criteria.hasSignature !== undefined) {
      metadataWhere.hasSignature = criteria.hasSignature;
    }
    if (criteria.hasTables !== undefined) {
      metadataWhere.hasTables = criteria.hasTables;
    }
    if (criteria.hasImages !== undefined) {
      metadataWhere.hasImages = criteria.hasImages;
    }

    // Query documents
    const documents = await prisma.documents.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
        ...(criteria.dateRange ? {
          createdAt: {
            gte: criteria.dateRange.start,
            lte: criteria.dateRange.end,
          },
        } : {}),
        document_metadata: {
          ...document_metadataWhere,
        },
      },
      include: {
        document_metadata: true,
      },
    });

    // Filter by topics if specified
    let filtered = documents;
    if (criteria.topics && criteria.topics.length > 0) {
      filtered = documents.filter(doc => {
        if (!doc.document_metadata?.topics) return false;
        const topicsArray = JSON.parse(doc.document_metadata.topics);
        return criteria.topics!.some(filterTopic =>
          topicsArray.some((docTopic: string) =>
            docTopic.toLowerCase().includes(filterTopic.toLowerCase())
          )
        );
      });
    }

    return filtered.map(doc => ({
      documentId: doc.id,
      filename: doc.filename,
      metadata: doc.document_metadata,
    }));
  }
}

export default new AdvancedSearchService();
