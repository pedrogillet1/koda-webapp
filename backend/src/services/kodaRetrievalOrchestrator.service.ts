/**
 * ============================================================================
 * KODA RETRIEVAL ORCHESTRATOR SERVICE
 * ============================================================================
 *
 * SINGLE RETRIEVAL SERVICE FOR ALL QUERY TYPES
 *
 * This service handles all retrieval operations based on the route plan
 * from kodaCentralRouter. It consolidates retrieval logic into ONE place.
 *
 * CONSOLIDATES:
 * - kodaRetrievalEngine.service.ts (core retrieval)
 * - semanticDocumentSearch.service.ts (document search)
 * - documentRouter.service.ts (document routing)
 * - navigationOrchestrator.service.ts (navigation)
 * - fileNavigationEngine.service.ts (file navigation)
 * - conversationRetrieval.service.ts (memory retrieval)
 *
 * DESIGN PRINCIPLES:
 * 1. ONE entry point (retrieveForRoute)
 * 2. Route plan drives behavior
 * 3. Reranking only when needed
 * 4. Document metadata from Pinecone (no PostgreSQL for content)
 *
 * @version 1.0.0
 * @date 2025-12-10
 */

import { KodaRoutePlan } from './kodaCentralRouter.service';
import prisma from '../config/database';
import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Chunk retrieved from vector search
 */
export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  chunkIndex: number;
  metadata: {
    filename?: string;
    mimeType?: string;
    createdAt?: string;
    folderId?: string;
    folderName?: string;
    pageNumber?: number;
    slideNumber?: number;
    [key: string]: any;
  };
}

/**
 * Document from database
 */
export interface RetrievedDocument {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: Date;
  metadata: any;
  folderId?: string | null;
  folderName?: string;
}

/**
 * Complete retrieval result
 */
export interface RetrievalResult {
  chunks: RetrievedChunk[];
  documents: RetrievedDocument[];
  totalFound: number;
  retrievalTime: number;
  method: 'meta' | 'doc_search' | 'chunk_retrieval' | 'navigation' | 'none';
  debug?: {
    topK: number;
    queryLength: number;
    embeddingTime?: number;
    searchTime?: number;
    rerankTime?: number;
  };
}

/**
 * Context for retrieval (conversation memory, etc.)
 */
export interface RetrievalContext {
  conversationId?: string;
  recentMessages?: Array<{ role: string; content: string }>;
  lastMentionedDocIds?: string[];
}

// ============================================================================
// MINIMUM RELEVANCE THRESHOLD
// ============================================================================
const MIN_RELEVANCE_SCORE = 0.15;

// ============================================================================
// MAIN RETRIEVAL FUNCTION
// ============================================================================

/**
 * Retrieve content based on route plan
 * This is the ONLY retrieval entry point for the RAG system
 *
 * @param routePlan - Route plan from kodaCentralRouter
 * @param query - User query
 * @param userId - User ID for filtering
 * @param context - Optional context (conversation memory)
 * @returns Complete retrieval result
 */
export async function retrieveForRoute(
  routePlan: KodaRoutePlan,
  query: string,
  userId: string,
  context?: RetrievalContext
): Promise<RetrievalResult> {
  const startTime = Date.now();

  console.log(`[RETRIEVAL-ORCHESTRATOR] Starting retrieval for intent: ${routePlan.primaryIntent}`);
  console.log(`[RETRIEVAL-ORCHESTRATOR] Requires docs: ${routePlan.requiresDocs}, topK: ${routePlan.topK}`);

  // ========================================================================
  // CASE 1: No retrieval needed (meta queries, greetings, etc.)
  // ========================================================================
  if (!routePlan.requiresDocs || routePlan.topK === 0) {
    console.log('[RETRIEVAL-ORCHESTRATOR] No retrieval needed for this route');

    return {
      chunks: [],
      documents: [],
      totalFound: 0,
      retrievalTime: Date.now() - startTime,
      method: 'none',
      debug: {
        topK: 0,
        queryLength: query.length
      }
    };
  }

  // ========================================================================
  // CASE 2: Document search/listing (document-level, no chunks)
  // ========================================================================
  if (routePlan.primaryIntent === 'doc_search' || routePlan.needsDocumentListing) {
    console.log('[RETRIEVAL-ORCHESTRATOR] Document search - retrieving document list');

    const documents = await getDocumentList(userId, routePlan.topK, routePlan.extractedFolderNames?.[0]);

    return {
      chunks: [],
      documents,
      totalFound: documents.length,
      retrievalTime: Date.now() - startTime,
      method: 'doc_search',
      debug: {
        topK: routePlan.topK,
        queryLength: query.length
      }
    };
  }

  // ========================================================================
  // CASE 3: Navigation queries (specific page/slide)
  // ========================================================================
  if (routePlan.primaryIntent === 'navigation' || routePlan.needsSlidesHandler) {
    console.log('[RETRIEVAL-ORCHESTRATOR] Navigation query - finding specific location');

    const result = await retrieveForNavigation(query, userId, routePlan, context);
    result.retrievalTime = Date.now() - startTime;
    return result;
  }

  // ========================================================================
  // CASE 4: Chunk-level retrieval (Q&A, comparison, calculation)
  // ========================================================================
  console.log('[RETRIEVAL-ORCHESTRATOR] Chunk retrieval - using vector search');

  const embeddingStartTime = Date.now();

  // Generate embedding for query
  const embeddingResult = await embeddingService.generateEmbedding(query, {
    taskType: 'RETRIEVAL_QUERY'
  });
  const queryEmbedding = embeddingResult.embedding;

  const embeddingTime = Date.now() - embeddingStartTime;

  // Determine document filter (if specific docs mentioned)
  let documentIds: string[] | undefined;
  if (routePlan.extractedDocNames && routePlan.extractedDocNames.length > 0) {
    documentIds = await resolveDocumentNames(routePlan.extractedDocNames, userId);
    console.log(`[RETRIEVAL-ORCHESTRATOR] Filtered to ${documentIds?.length || 0} specific documents`);
  }

  // Determine folder filter
  let folderId: string | undefined;
  if (routePlan.extractedFolderNames && routePlan.extractedFolderNames.length > 0) {
    folderId = await resolveFolderName(routePlan.extractedFolderNames[0], userId);
    console.log(`[RETRIEVAL-ORCHESTRATOR] Filtered to folder: ${routePlan.extractedFolderNames[0]}`);
  }

  // Vector search
  const searchStartTime = Date.now();

  const vectorResults = await pineconeService.query(queryEmbedding, {
    userId,
    topK: routePlan.topK,
    minSimilarity: MIN_RELEVANCE_SCORE,
    documentId: documentIds?.[0], // Pinecone only supports single doc filter
    folderId
  });

  const searchTime = Date.now() - searchStartTime;

  // Transform results to standard format
  const chunks: RetrievedChunk[] = vectorResults.map((result, index) => ({
    id: `${result.documentId}-${result.chunkIndex}`,
    documentId: result.documentId,
    documentName: result.filename || result.metadata?.filename || 'Unknown',
    content: result.content,
    score: result.similarity,
    chunkIndex: result.chunkIndex,
    metadata: result.metadata
  }));

  // Filter out low-relevance chunks
  const filteredChunks = chunks.filter(chunk => chunk.score >= MIN_RELEVANCE_SCORE);

  console.log(`[RETRIEVAL-ORCHESTRATOR] Retrieved ${filteredChunks.length}/${chunks.length} chunks (min score: ${MIN_RELEVANCE_SCORE})`);

  // Apply reranking if needed (complex queries only)
  let finalChunks = filteredChunks;
  let rerankTime = 0;

  if (routePlan.needsReranking && routePlan.complexity === 'complex' && filteredChunks.length > 3) {
    const rerankStartTime = Date.now();
    finalChunks = await applyBasicReranking(query, filteredChunks, routePlan);
    rerankTime = Date.now() - rerankStartTime;
    console.log(`[RETRIEVAL-ORCHESTRATOR] Reranked ${finalChunks.length} chunks in ${rerankTime}ms`);
  }

  return {
    chunks: finalChunks,
    documents: [],
    totalFound: finalChunks.length,
    retrievalTime: Date.now() - startTime,
    method: 'chunk_retrieval',
    debug: {
      topK: routePlan.topK,
      queryLength: query.length,
      embeddingTime,
      searchTime,
      rerankTime
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get list of documents for a user
 */
async function getDocumentList(
  userId: string,
  limit: number = 15,
  folderName?: string
): Promise<RetrievedDocument[]> {
  let folderId: string | undefined;

  if (folderName) {
    const folder = await prisma.folder.findFirst({
      where: {
        userId,
        name: { contains: folderName, mode: 'insensitive' }
      }
    });
    folderId = folder?.id;
  }

  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
      ...(folderId && { folderId })
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
      metadata: true,
      folderId: true,
      folder: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return documents.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt,
    metadata: doc.metadata,
    folderId: doc.folderId,
    folderName: doc.folder?.name
  }));
}

/**
 * Resolve document names to IDs
 */
async function resolveDocumentNames(names: string[], userId: string): Promise<string[]> {
  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
      OR: names.map(name => ({
        filename: { contains: name, mode: 'insensitive' }
      }))
    },
    select: { id: true }
  });

  return documents.map(d => d.id);
}

/**
 * Resolve folder name to ID
 */
async function resolveFolderName(name: string, userId: string): Promise<string | undefined> {
  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      name: { contains: name, mode: 'insensitive' }
    }
  });

  return folder?.id;
}

/**
 * Retrieve for navigation queries (specific page/slide)
 */
async function retrieveForNavigation(
  query: string,
  userId: string,
  routePlan: KodaRoutePlan,
  context?: RetrievalContext
): Promise<RetrievalResult> {
  // Extract page/slide number from query
  const pageMatch = query.match(/(?:página|page|pág\.?)\s*(\d+)/i);
  const slideMatch = query.match(/(?:slide|diapositiva)\s*(\d+)/i);

  const targetNumber = pageMatch?.[1] || slideMatch?.[1];
  const isSlide = !!slideMatch;

  if (!targetNumber) {
    // Fall back to regular chunk retrieval
    console.log('[RETRIEVAL-ORCHESTRATOR] No page/slide number found, falling back to chunk retrieval');
    return {
      chunks: [],
      documents: [],
      totalFound: 0,
      retrievalTime: 0,
      method: 'navigation'
    };
  }

  // Try to find chunks with matching page/slide
  const embeddingResult = await embeddingService.generateEmbedding(query, {
    taskType: 'RETRIEVAL_QUERY'
  });

  const results = await pineconeService.query(embeddingResult.embedding, {
    userId,
    topK: routePlan.topK
  });

  // Filter for matching page/slide
  const filteredResults = results.filter(result => {
    if (isSlide) {
      return result.metadata?.slideNumber === parseInt(targetNumber);
    } else {
      return result.metadata?.pageNumber === parseInt(targetNumber);
    }
  });

  const chunks: RetrievedChunk[] = filteredResults.map(result => ({
    id: `${result.documentId}-${result.chunkIndex}`,
    documentId: result.documentId,
    documentName: result.filename || 'Unknown',
    content: result.content,
    score: result.similarity,
    chunkIndex: result.chunkIndex,
    metadata: result.metadata
  }));

  return {
    chunks,
    documents: [],
    totalFound: chunks.length,
    retrievalTime: 0,
    method: 'navigation'
  };
}

/**
 * Apply basic reranking (keyword boost)
 * For more sophisticated reranking, use microSummaryReranker.service.ts
 */
async function applyBasicReranking(
  query: string,
  chunks: RetrievedChunk[],
  routePlan: KodaRoutePlan
): Promise<RetrievedChunk[]> {
  // Extract keywords from query
  const keywords = extractKeywords(query);

  // Boost scores for chunks containing keywords
  const rerankedChunks = chunks.map(chunk => {
    let boost = 0;

    keywords.forEach(keyword => {
      if (chunk.content.toLowerCase().includes(keyword.toLowerCase())) {
        boost += 0.05; // Small boost per keyword match
      }
    });

    // Boost for calculation-related content if calculation query
    if (routePlan.needsCalculation) {
      const calcTerms = ['roi', 'payback', 'retorno', 'lucro', 'custo', 'valor', '%', 'milhões', 'bilhões'];
      calcTerms.forEach(term => {
        if (chunk.content.toLowerCase().includes(term)) {
          boost += 0.03;
        }
      });
    }

    return {
      ...chunk,
      score: Math.min(chunk.score + boost, 1.0) // Cap at 1.0
    };
  });

  // Sort by adjusted score
  return rerankedChunks.sort((a, b) => b.score - a.score);
}

/**
 * Extract keywords from query
 */
function extractKeywords(query: string): string[] {
  // Remove common words
  const stopWords = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na',
    'é', 'são', 'foi', 'foram', 'está', 'estão',
    'que', 'qual', 'quais', 'como', 'quando', 'onde',
    'the', 'a', 'an', 'is', 'are', 'was', 'were',
    'what', 'which', 'how', 'when', 'where', 'who'
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\sáéíóúàèìòùâêîôûãõç]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)];
}

/**
 * Get document count for a user (helper for route validation)
 */
export async function getUserDocumentCount(userId: string): Promise<number> {
  return await prisma.document.count({
    where: {
      userId,
      status: { not: 'deleted' }
    }
  });
}

/**
 * Check if user has any documents
 */
export async function userHasDocuments(userId: string): Promise<boolean> {
  const count = await getUserDocumentCount(userId);
  return count > 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const kodaRetrievalOrchestrator = {
  retrieveForRoute,
  getUserDocumentCount,
  userHasDocuments
};

export default kodaRetrievalOrchestrator;
