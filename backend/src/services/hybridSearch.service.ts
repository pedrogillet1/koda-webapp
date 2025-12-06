/**
 * Hybrid Search Service
 *
 * Combines BM25 keyword search and vector semantic search using Reciprocal Rank Fusion (RRF).
 * Provides metadata-aware filtering and domain-specific boosting.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Initialize Pinecone
let pinecone: Pinecone | null = null;
async function getPinecone(): Promise<Pinecone> {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
  }
  return pinecone;
}

/**
 * Search filters for metadata-aware filtering
 */
export interface SearchFilters {
  // Document filters
  documentType?: string | string[];
  domain?: string | string[];
  documentIds?: string[];

  // Date filters
  dateFrom?: Date;
  dateTo?: Date;

  // Chunk filters
  chunkTypes?: string[];
  sections?: string[];
  pages?: number[];

  // User filters
  userId: string;
  folderId?: string;
}

/**
 * Search result with scoring breakdown
 */
export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  pageNumber?: number;
  section?: string;
  chunkType?: string;

  // Scores
  bm25Score: number;
  vectorScore: number;
  combinedScore: number;
  confidence: number;

  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Hybrid search options
 */
export interface HybridSearchOptions {
  topK?: number;
  bm25Weight?: number;
  vectorWeight?: number;
  rrfK?: number;
  chunkTypeBoosts?: Record<string, number>;
  domainBoosts?: Record<string, number>;
  minScore?: number;
}

/**
 * Main hybrid search function
 */
export async function hybridSearch(
  query: string,
  filters: SearchFilters,
  options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 10,
    bm25Weight = 0.4,
    vectorWeight = 0.6,
    rrfK = 60,
    chunkTypeBoosts = {},
    domainBoosts = {},
    minScore = 0.1
  } = options;

  console.log(`[HybridSearch] Query: "${query.slice(0, 100)}..."`);
  console.log(`[HybridSearch] Filters: ${JSON.stringify(filters)}`);

  const startTime = Date.now();

  // Step 1: Get filtered document IDs
  const filteredDocIds = await getFilteredDocumentIds(filters);

  if (filteredDocIds.length === 0) {
    console.log('[HybridSearch] No documents match filters');
    return [];
  }

  console.log(`[HybridSearch] Filtered to ${filteredDocIds.length} documents`);

  // Step 2: Perform BM25 search
  const bm25Results = await performBM25Search(query, filteredDocIds, filters.userId, topK * 2);

  // Step 3: Perform vector search
  const vectorResults = await performVectorSearch(query, filteredDocIds, filters.userId, topK * 2);

  console.log(`[HybridSearch] BM25: ${bm25Results.length} results, Vector: ${vectorResults.length} results`);

  // Step 4: Combine and rerank using RRF
  const combined = combineAndRerank(
    bm25Results,
    vectorResults,
    { bm25Weight, vectorWeight, rrfK, chunkTypeBoosts, domainBoosts }
  );

  // Step 5: Filter by minimum score and take top K
  const filtered = combined.filter(r => r.combinedScore >= minScore);
  const results = filtered.slice(0, topK);

  // Step 6: Enrich with document titles
  const enriched = await enrichResults(results);

  const duration = Date.now() - startTime;
  console.log(`[HybridSearch] Completed in ${duration}ms, returning ${enriched.length} results`);

  return enriched;
}

/**
 * Get filtered document IDs based on filters
 */
async function getFilteredDocumentIds(filters: SearchFilters): Promise<string[]> {
  const where: Prisma.DocumentWhereInput = {
    userId: filters.userId,
    status: 'ready'
  };

  // Filter by specific document IDs
  if (filters.documentIds && filters.documentIds.length > 0) {
    where.id = { in: filters.documentIds };
  }

  // Filter by folder
  if (filters.folderId) {
    where.folderId = filters.folderId;
  }

  // Filter by date range
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  // Filter by document type or domain (via metadata)
  if (filters.documentType || filters.domain) {
    where.metadata = {};

    if (filters.documentType) {
      const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
      where.metadata.classification = { in: types };
    }

    if (filters.domain) {
      const domains = Array.isArray(filters.domain) ? filters.domain : [filters.domain];
      where.metadata.domain = { in: domains };
    }
  }

  const documents = await prisma.document.findMany({
    where,
    select: { id: true }
  });

  return documents.map(d => d.id);
}

/**
 * Perform BM25 full-text search using PostgreSQL
 */
async function performBM25Search(
  query: string,
  documentIds: string[],
  userId: string,
  limit: number
): Promise<Array<{ chunkId: string; documentId: string; content: string; score: number; metadata: Record<string, unknown> }>> {
  try {
    // Use PostgreSQL full-text search with ts_rank for BM25-like scoring
    const results = await prisma.$queryRaw<Array<{
      id: string;
      document_id: string;
      content: string;
      metadata: string;
      rank: number;
    }>>`
      SELECT
        id,
        "documentId" as document_id,
        content,
        metadata,
        ts_rank(
          to_tsvector('english', content),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM "document_embeddings"
      WHERE
        "documentId" = ANY(${documentIds}::text[])
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    return results.map(r => ({
      chunkId: r.id,
      documentId: r.document_id,
      content: r.content,
      score: r.rank,
      metadata: r.metadata ? JSON.parse(r.metadata) : {}
    }));
  } catch (error) {
    console.error('[HybridSearch] BM25 search failed, falling back to LIKE search:', error);
    return performFallbackKeywordSearch(query, documentIds, limit);
  }
}

/**
 * Fallback keyword search using LIKE
 */
async function performFallbackKeywordSearch(
  query: string,
  documentIds: string[],
  limit: number
): Promise<Array<{ chunkId: string; documentId: string; content: string; score: number; metadata: Record<string, unknown> }>> {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (keywords.length === 0) {
    return [];
  }

  // Search using ILIKE for each keyword
  const embeddings = await prisma.documentEmbedding.findMany({
    where: {
      documentId: { in: documentIds },
      OR: keywords.map(kw => ({
        content: { contains: kw, mode: 'insensitive' }
      }))
    },
    take: limit
  });

  // Score by keyword match count
  return embeddings.map(emb => {
    const content = emb.content.toLowerCase();
    const matchCount = keywords.filter(kw => content.includes(kw)).length;
    const score = matchCount / keywords.length;

    return {
      chunkId: emb.id,
      documentId: emb.documentId,
      content: emb.content,
      score,
      metadata: emb.metadata ? JSON.parse(emb.metadata) : {}
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Perform vector semantic search using Pinecone
 */
async function performVectorSearch(
  query: string,
  documentIds: string[],
  userId: string,
  limit: number
): Promise<Array<{ chunkId: string; documentId: string; content: string; score: number; metadata: Record<string, unknown> }>> {
  try {
    // Generate query embedding
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = embeddingResult.embedding.values;

    // Query Pinecone
    const pc = await getPinecone();
    const index = pc.index(process.env.PINECONE_INDEX_NAME || 'koda-documents');

    const pineconeResults = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      filter: {
        userId: userId,
        documentId: { $in: documentIds }
      }
    });

    if (!pineconeResults.matches || pineconeResults.matches.length === 0) {
      return [];
    }

    // Fetch full chunk data from PostgreSQL
    const chunkIds = pineconeResults.matches.map(m => m.id);
    const embeddings = await prisma.documentEmbedding.findMany({
      where: { id: { in: chunkIds } }
    });

    const embeddingMap = new Map(embeddings.map(e => [e.id, e]));

    return pineconeResults.matches
      .filter(m => embeddingMap.has(m.id))
      .map(m => {
        const emb = embeddingMap.get(m.id)!;
        return {
          chunkId: m.id,
          documentId: emb.documentId,
          content: emb.content,
          score: m.score || 0,
          metadata: emb.metadata ? JSON.parse(emb.metadata) : {}
        };
      });
  } catch (error) {
    console.error('[HybridSearch] Vector search failed:', error);
    return [];
  }
}

/**
 * Combine and rerank results using Reciprocal Rank Fusion (RRF)
 */
function combineAndRerank(
  bm25Results: Array<{ chunkId: string; documentId: string; content: string; score: number; metadata: Record<string, unknown> }>,
  vectorResults: Array<{ chunkId: string; documentId: string; content: string; score: number; metadata: Record<string, unknown> }>,
  options: {
    bm25Weight: number;
    vectorWeight: number;
    rrfK: number;
    chunkTypeBoosts: Record<string, number>;
    domainBoosts: Record<string, number>;
  }
): SearchResult[] {
  const { bm25Weight, vectorWeight, rrfK, chunkTypeBoosts, domainBoosts } = options;

  // Create rank maps
  const bm25Ranks = new Map<string, number>();
  bm25Results.forEach((r, i) => bm25Ranks.set(r.chunkId, i + 1));

  const vectorRanks = new Map<string, number>();
  vectorResults.forEach((r, i) => vectorRanks.set(r.chunkId, i + 1));

  // Combine all unique chunk IDs
  const allChunkIds = new Set([
    ...bm25Results.map(r => r.chunkId),
    ...vectorResults.map(r => r.chunkId)
  ]);

  // Create result map for deduplication
  const resultMap = new Map<string, { chunkId: string; documentId: string; content: string; bm25Score: number; vectorScore: number; metadata: Record<string, unknown> }>();

  for (const r of bm25Results) {
    resultMap.set(r.chunkId, { ...r, bm25Score: r.score, vectorScore: 0 });
  }

  for (const r of vectorResults) {
    const existing = resultMap.get(r.chunkId);
    if (existing) {
      existing.vectorScore = r.score;
    } else {
      resultMap.set(r.chunkId, { ...r, bm25Score: 0, vectorScore: r.score });
    }
  }

  // Calculate RRF scores
  const results: SearchResult[] = [];

  for (const chunkId of allChunkIds) {
    const data = resultMap.get(chunkId);
    if (!data) continue;

    // RRF formula: 1 / (k + rank)
    const bm25Rank = bm25Ranks.get(chunkId) || bm25Results.length + 1;
    const vectorRank = vectorRanks.get(chunkId) || vectorResults.length + 1;

    const bm25RRF = 1 / (rrfK + bm25Rank);
    const vectorRRF = 1 / (rrfK + vectorRank);

    // Weighted combination
    let combinedScore = (bm25Weight * bm25RRF) + (vectorWeight * vectorRRF);

    // Apply chunk type boosting
    const chunkType = data.metadata?.chunkType as string | undefined;
    if (chunkType && chunkTypeBoosts[chunkType]) {
      combinedScore *= chunkTypeBoosts[chunkType];
    }

    // Apply domain boosting
    const domain = data.metadata?.domain as string | undefined;
    if (domain && domainBoosts[domain]) {
      combinedScore *= domainBoosts[domain];
    }

    // Calculate confidence based on presence in both result sets
    const inBoth = bm25Ranks.has(chunkId) && vectorRanks.has(chunkId);
    const confidence = inBoth ? Math.min(0.95, combinedScore * 5) : Math.min(0.8, combinedScore * 4);

    results.push({
      chunkId: data.chunkId,
      documentId: data.documentId,
      documentTitle: '', // Will be enriched later
      content: data.content,
      pageNumber: data.metadata?.pageNumber as number | undefined,
      section: data.metadata?.section as string | undefined,
      chunkType: data.metadata?.chunkType as string | undefined,
      bm25Score: data.bm25Score,
      vectorScore: data.vectorScore,
      combinedScore,
      confidence,
      metadata: data.metadata
    });
  }

  // Sort by combined score
  return results.sort((a, b) => b.combinedScore - a.combinedScore);
}

/**
 * Enrich results with document titles
 */
async function enrichResults(results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return results;

  const documentIds = [...new Set(results.map(r => r.documentId))];

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, filename: true, createdAt: true }
  });

  const docMap = new Map(documents.map(d => [d.id, d]));

  return results.map(r => ({
    ...r,
    documentTitle: docMap.get(r.documentId)?.filename || 'Unknown Document'
  }));
}

/**
 * Analyze query to suggest filters and boosts
 */
export async function analyzeQueryIntent(
  query: string
): Promise<{
  suggestedDomain?: string;
  suggestedChunkTypes?: string[];
  suggestedBoosts?: Record<string, number>;
  extractedKeywords?: string[];
}> {
  const lowerQuery = query.toLowerCase();

  // Domain detection
  let suggestedDomain: string | undefined;
  const domainPatterns: Record<string, RegExp> = {
    legal: /contract|agreement|clause|liability|indemnif|terminat|govern|law|legal|attorney|court/i,
    medical: /patient|diagnosis|treatment|medication|symptom|doctor|hospital|medical|health|clinical/i,
    financial: /revenue|expense|profit|loss|balance|asset|liability|budget|tax|financial|invoice/i,
    scientific: /research|study|experiment|hypothesis|data|analysis|methodology|scientific|academic/i,
    business: /project|milestone|stakeholder|strategy|market|customer|business|corporate|company/i
  };

  for (const [domain, pattern] of Object.entries(domainPatterns)) {
    if (pattern.test(lowerQuery)) {
      suggestedDomain = domain;
      break;
    }
  }

  // Chunk type suggestions based on query
  const suggestedChunkTypes: string[] = [];
  const chunkPatterns: Record<string, RegExp> = {
    payment_terms_clause: /payment|price|cost|fee|amount due/i,
    termination_clause: /terminat|cancel|end of contract/i,
    liability_clause: /liability|responsible|liable/i,
    definitions_clause: /defin|meaning of|what does .* mean/i,
    summary: /summary|summarize|overview|brief/i,
    conclusion: /conclusion|final|result|outcome/i
  };

  for (const [chunkType, pattern] of Object.entries(chunkPatterns)) {
    if (pattern.test(lowerQuery)) {
      suggestedChunkTypes.push(chunkType);
    }
  }

  // Extract keywords
  const extractedKeywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !/^(what|when|where|which|who|how|does|have|this|that|with|from|about)$/.test(w));

  // Suggested boosts based on query type
  const suggestedBoosts: Record<string, number> = {};
  if (suggestedDomain) {
    suggestedBoosts[suggestedDomain] = 1.5;
  }
  for (const chunkType of suggestedChunkTypes) {
    suggestedBoosts[chunkType] = 1.3;
  }

  return {
    suggestedDomain,
    suggestedChunkTypes: suggestedChunkTypes.length > 0 ? suggestedChunkTypes : undefined,
    suggestedBoosts: Object.keys(suggestedBoosts).length > 0 ? suggestedBoosts : undefined,
    extractedKeywords: extractedKeywords.length > 0 ? extractedKeywords : undefined
  };
}

/**
 * Perform keyword-only search (BM25)
 */
export async function keywordSearch(
  query: string,
  filters: SearchFilters,
  options: { topK?: number } = {}
): Promise<SearchResult[]> {
  return hybridSearch(query, filters, {
    ...options,
    bm25Weight: 1.0,
    vectorWeight: 0.0
  });
}

/**
 * Perform vector-only search (semantic)
 */
export async function vectorSearch(
  query: string,
  filters: SearchFilters,
  options: { topK?: number } = {}
): Promise<SearchResult[]> {
  return hybridSearch(query, filters, {
    ...options,
    bm25Weight: 0.0,
    vectorWeight: 1.0
  });
}

export default {
  hybridSearch,
  keywordSearch,
  vectorSearch,
  analyzeQueryIntent
};
