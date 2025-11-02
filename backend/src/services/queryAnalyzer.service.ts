/**
 * Query Analyzer Service
 *
 * Analyzes user queries to determine optimal retrieval strategy:
 * - Detects mentioned documents
 * - Identifies multi-document queries
 * - Extracts metadata filters
 * - Determines search strategy (semantic vs keyword weight)
 *
 * This is the orchestrator that coordinates all retrieval components.
 */

import documentScopedRetrievalService from './documentScopedRetrieval.service';
import multiDocumentQueryService from './multiDocumentQuery.service';
import metadataEnhancementService from './metadataEnhancement.service';
import { QueryAnalysis, MetadataFilters } from '../types/metadata.types';
import prisma from '../config/database';

export class QueryAnalyzerService {

  /**
   * Analyze query to determine retrieval strategy
   */
  async analyzeQuery(query: string, userId: string): Promise<QueryAnalysis> {
    console.log(`\n🎯 QUERY ANALYSIS...`);
    console.log(`   Query: "${query}"`);

    // Get user's documents for filename matching
    const userDocuments = await this.getUserDocumentNames(userId);

    // Detect mentioned documents
    const mentionedDocuments = documentScopedRetrievalService.detectMentionedDocuments(
      query,
      userDocuments
    );

    // Detect multi-document query
    const isMultiDocument = multiDocumentQueryService.isMultiDocumentQuery(query);

    // Extract metadata filters
    const metadataFilters = metadataEnhancementService.extractMetadataFilters(query);

    // Determine search strategy
    const searchStrategy = this.determineSearchStrategy(
      query,
      mentionedDocuments.length > 0,
      isMultiDocument,
      Object.keys(metadataFilters).length > 0
    );

    const analysis: QueryAnalysis = {
      mentionedDocuments,
      isMultiDocument,
      metadataFilters,
      searchStrategy,
    };

    console.log(`\n📊 ANALYSIS RESULT:`);
    console.log(`   Mentioned documents: ${mentionedDocuments.length}`);
    if (mentionedDocuments.length > 0) {
      console.log(`      → ${mentionedDocuments.join(', ')}`);
    }
    console.log(`   Multi-document: ${isMultiDocument}`);
    console.log(`   Metadata filters:`, metadataFilters);
    console.log(`   Search strategy: semantic=${searchStrategy.semanticWeight}, keyword=${searchStrategy.keywordWeight}`);

    return analysis;
  }

  /**
   * Get user's document names for filename matching
   */
  private async getUserDocumentNames(userId: string): Promise<string[]> {
    try {
      const documents = await prisma.document.findMany({
        where: {
          userId,
          status: { not: 'deleted' },
        },
        select: { filename: true },
      });

      return documents.map(d => d.filename);
    } catch (error) {
      console.error('Failed to fetch user documents:', error);
      return [];
    }
  }

  /**
   * Determine search strategy based on query characteristics
   */
  private determineSearchStrategy(
    query: string,
    hasDocumentScope: boolean,
    isMultiDocument: boolean,
    hasMetadataFilters: boolean
  ): { semanticWeight: number; keywordWeight: number } {

    const queryLower = query.toLowerCase();

    // Document-scoped queries → Balance semantic and keyword
    if (hasDocumentScope) {
      console.log(`   → Document-scoped query detected`);
      return {
        semanticWeight: 0.5,
        keywordWeight: 0.5,
      };
    }

    // Entity queries (names, places) → Favor keyword
    if (
      queryLower.match(/montana|pedro|maria|john|smith|comprovante|capítulo/i) ||
      queryLower.match(/which (document|file).*mention/i) ||
      queryLower.match(/documents.*contain/i)
    ) {
      console.log(`   → Entity query - favoring keyword search`);
      return {
        semanticWeight: 0.3,
        keywordWeight: 0.7,
      };
    }

    // Category queries with filters → Favor keyword + metadata
    if (hasMetadataFilters) {
      console.log(`   → Category query with filters - balanced approach`);
      return {
        semanticWeight: 0.4,
        keywordWeight: 0.6,
      };
    }

    // Conceptual/semantic queries → Favor semantic
    if (
      queryLower.match(/what is.*about|explain|describe|summarize|tell me about/i)
    ) {
      console.log(`   → Conceptual query - favoring semantic search`);
      return {
        semanticWeight: 0.8,
        keywordWeight: 0.2,
      };
    }

    // Multi-document queries → Balanced
    if (isMultiDocument) {
      console.log(`   → Multi-document query - balanced approach`);
      return {
        semanticWeight: 0.5,
        keywordWeight: 0.5,
      };
    }

    // Default: Slightly favor semantic (traditional RAG behavior)
    console.log(`   → Default strategy - slightly favoring semantic`);
    return {
      semanticWeight: 0.6,
      keywordWeight: 0.4,
    };
  }

  /**
   * Determine if query is asking about document navigation
   * (e.g., "What documents do I have?", "What types of files?")
   */
  isNavigationQuery(query: string): boolean {
    const navigationPatterns = [
      /what (documents|files) do i have/i,
      /list.*all.*(documents|files)/i,
      /show me all/i,
      /what types? of (documents|files)/i,
      /which (documents|files)/i,
      /how many (documents|files)/i,
    ];

    return navigationPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect if user is asking about their uploaded files vs KODA capabilities
   */
  isUserDocumentQuery(query: string): boolean {
    const userDocPatterns = [
      /my (documents|files)/i,
      /i have/i,
      /do i have/i,
      /uploaded/i,
      /in my (library|collection)/i,
    ];

    return userDocPatterns.some(pattern => pattern.test(query));
  }
}

export default new QueryAnalyzerService();
