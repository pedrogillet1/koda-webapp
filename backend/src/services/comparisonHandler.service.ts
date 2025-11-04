/**
 * COMPARISON HANDLER SERVICE - KODA FIX
 *
 * PROBLEM SOLVED:
 * - Comparisons only retrieved 1 document (vector search bias)
 * - Comparison logic never triggered because uniqueDocumentIds.length < 2
 *
 * SOLUTION:
 * - Detect comparison queries BEFORE vector search
 * - Extract document names from query
 * - Perform targeted retrieval for EACH document
 * - Guarantee both/all documents are included in results
 */

import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';
import prisma from '../config/database';

export interface ComparisonQuery {
  isComparison: boolean;
  documentNames: string[];
  comparisonType: 'explicit' | 'implicit';
  confidence: number;
}

export interface ComparisonRetrievalResult {
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    metadata: any;
  }>;
  documentsFound: number;
  missingDocuments: string[];
}

class ComparisonHandlerService {
  /**
   * Detect if query is a comparison query
   * This runs BEFORE vector search to enable proper multi-document retrieval
   */
  detectComparisonQuery(query: string): ComparisonQuery {
    const queryLower = query.toLowerCase();

    // Explicit comparison patterns
    const explicitPatterns = [
      /compare\s+(.+?)\s+(?:and|with|to|vs\.?|versus)\s+(.+?)(?:\s|$|\.|\?)/i,
      /(?:difference|differences)\s+between\s+(.+?)\s+and\s+(.+?)(?:\s|$|\.|\?)/i,
      /(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s|$|\.|\?)/i,
      /(?:similarities|similarity)\s+(?:between|of)\s+(.+?)\s+and\s+(.+?)(?:\s|$|\.|\?)/i,
      /how\s+(?:does|do)\s+(.+?)\s+(?:differ|compare)\s+(?:from|to|with)\s+(.+?)(?:\s|$|\.|\?)/i,
    ];

    // Try to extract document names from explicit patterns
    for (const pattern of explicitPatterns) {
      const match = query.match(pattern);
      if (match && match[1] && match[2]) {
        const doc1 = this.cleanDocumentName(match[1]);
        const doc2 = this.cleanDocumentName(match[2]);

        return {
          isComparison: true,
          documentNames: [doc1, doc2],
          comparisonType: 'explicit',
          confidence: 0.95,
        };
      }
    }

    // Implicit comparison patterns (no specific document names)
    const implicitPatterns = [
      /compare.*(?:these|those|both|them)/i,
      /(?:differences?|similarities?)\s+(?:between|in)\s+(?:these|those|both|them)/i,
      /what.*(?:different|similar).*(?:these|those|both)/i,
    ];

    for (const pattern of implicitPatterns) {
      if (pattern.test(queryLower)) {
        return {
          isComparison: true,
          documentNames: [], // Will need to be inferred from context or recent documents
          comparisonType: 'implicit',
          confidence: 0.75,
        };
      }
    }

    return {
      isComparison: false,
      documentNames: [],
      comparisonType: 'explicit',
      confidence: 0,
    };
  }

  /**
   * Retrieve chunks from multiple specific documents for comparison
   * Guarantees that ALL specified documents are included in results
   */
  async retrieveForComparison(
    documentNames: string[],
    userId: string,
    query: string,
    chunksPerDocument: number = 10
  ): Promise<ComparisonRetrievalResult> {
    console.log(`🔍 [ComparisonHandler] Retrieving chunks for comparison...`);
    console.log(`   Documents requested: ${documentNames.join(', ')}`);

    // Step 1: Find document IDs by name (with fuzzy matching)
    const documentIds = await this.findDocumentsByNames(documentNames, userId);

    console.log(`   Documents found: ${documentIds.length}/${documentNames.length}`);

    const missingDocuments = documentNames.filter(
      name => !documentIds.some(d => d.name.toLowerCase().includes(name.toLowerCase()))
    );

    if (missingDocuments.length > 0) {
      console.log(`   ⚠️ Missing documents: ${missingDocuments.join(', ')}`);
    }

    // Step 2: Generate query embedding once
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    // Step 3: Retrieve chunks from EACH document separately
    const allSources: Array<{
      documentId: string;
      documentName: string;
      chunkIndex: number;
      content: string;
      similarity: number;
      metadata: any;
    }> = [];

    for (const doc of documentIds) {
      console.log(`   📄 Retrieving from: ${doc.name}`);

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
        allSources.push({
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
    allSources.sort((a, b) => {
      if (a.documentId !== b.documentId) {
        return a.documentId.localeCompare(b.documentId);
      }
      return b.similarity - a.similarity;
    });

    console.log(`✅ [ComparisonHandler] Retrieved ${allSources.length} total chunks from ${documentIds.length} documents`);

    return {
      sources: allSources,
      documentsFound: documentIds.length,
      missingDocuments,
    };
  }

  /**
   * Find documents by names with fuzzy matching
   * Handles typos and partial matches
   */
  private async findDocumentsByNames(
    documentNames: string[],
    userId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const foundDocuments: Array<{ id: string; name: string }> = [];

    for (const searchName of documentNames) {
      const searchLower = searchName.toLowerCase().trim();

      // Try exact match first
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

      // If no exact match, try partial match
      if (documents.length === 0) {
        // Remove file extensions for better matching
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

      if (documents.length > 0) {
        foundDocuments.push({
          id: documents[0].id,
          name: documents[0].filename,
        });
      }
    }

    return foundDocuments;
  }

  /**
   * Clean document name from query
   * Removes common words and punctuation
   */
  private cleanDocumentName(name: string): string {
    return name
      .trim()
      .replace(/^(the|a|an|my|this|that)\s+/i, '')
      .replace(/\s+(document|file|pdf|doc|docx)$/i, '')
      .replace(/["""'']/g, '')
      .trim();
  }
}

export const comparisonHandlerService = new ComparisonHandlerService();
export default comparisonHandlerService;
