/**
 * Koda Plan-Driven Retrieval Service
 *
 * Executes retrieval per sub-question, tags each chunk with source sub-question.
 * This enables targeted context for each part of a complex query.
 *
 * Integration with existing services:
 * - Uses documentRouter.service.ts for document routing
 * - Uses chunkTypeReranker.service.ts for chunk reranking
 * - Uses microSummaryReranker.service.ts for micro-summary reranking
 * - Uses pinecone.service.ts for vector search
 *
 * @version 1.0.0
 * @date 2025-12-09
 */

import { QueryPlan, SubQuestion } from './kodaComplexQueryPlanner.service';
import { routeToDocument, routeToMultipleDocuments } from './documentRouter.service';
import { rerankByChunkType, RankedChunk } from './chunkTypeReranker.service';
import { microSummaryRerankerService, SearchResult } from './microSummaryReranker.service';
import embeddingService from './embedding.service';
import pineconeService from './pinecone.service';

// Pinecone query result type
interface PineconeMatch {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TaggedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  microSummary?: string;
  sectionName?: string;
  pageNumber?: number;
  chunkType?: string;

  // Scoring
  originalScore: number;
  rerankScore: number;
  finalScore: number;

  // Tagging for complex queries
  sourceSubQuestionId: string;
  sourceSubQuestionText: string;
  relevanceToSubQuestion: number; // 0-1 score

  // Metadata
  metadata?: Record<string, unknown>;
}

export interface SubQuestionRetrievalResult {
  subQuestion: SubQuestion;
  chunks: TaggedChunk[];
  retrievalMethod: 'vector' | 'hybrid' | 'keyword';
  documentRouting?: {
    documentId: string;
    documentTitle: string;
    routingMethod: string;
    confidence: number;
  };
  latencyMs: number;
}

export interface PlanDrivenRetrievalResult {
  queryPlan: QueryPlan;
  subQuestionResults: SubQuestionRetrievalResult[];
  mergedChunks: TaggedChunk[];
  totalChunksRetrieved: number;
  totalLatencyMs: number;
  deduplicationCount: number;
}

export interface RetrievalOptions {
  userId: string;
  topK?: number;              // Chunks per sub-question
  includeDocumentRouting?: boolean;
  useHybridSearch?: boolean;
  useMicroSummaryReranking?: boolean;
  useChunkTypeReranking?: boolean;
  documentIds?: string[];     // Optional: limit to specific documents
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TOP_K = 5;
const DEDUP_SIMILARITY_THRESHOLD = 0.92; // Chunks with >92% similarity are duplicates
const MIN_CHUNK_SCORE = 0.3;

// ═══════════════════════════════════════════════════════════════════════════
// Sub-Question Retrieval
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve chunks for a single sub-question
 *
 * @param subQuestion - The sub-question to retrieve for
 * @param options - Retrieval options
 * @returns SubQuestionRetrievalResult
 */
async function retrieveForSubQuestion(
  subQuestion: SubQuestion,
  options: RetrievalOptions
): Promise<SubQuestionRetrievalResult> {
  const startTime = Date.now();
  const { userId, topK = DEFAULT_TOP_K, includeDocumentRouting = true, documentIds } = options;

  console.log(`[PLAN-RETRIEVAL] Retrieving for sub-question ${subQuestion.id}: "${subQuestion.text.slice(0, 60)}..."`);

  let documentRouting: SubQuestionRetrievalResult['documentRouting'];

  // Step 1: Document routing (if enabled)
  if (includeDocumentRouting) {
    const routingResult = await routeToDocument(userId, subQuestion.text, {
      documentIds,
      confidenceThreshold: 0.6,
    });

    if (routingResult) {
      documentRouting = {
        documentId: routingResult.documentId,
        documentTitle: routingResult.documentTitle,
        routingMethod: routingResult.routingMethod,
        confidence: routingResult.confidence,
      };
      console.log(`[PLAN-RETRIEVAL] Document routed: ${routingResult.documentTitle} (${routingResult.confidence.toFixed(2)})`);
    }
  }

  // Step 2: Generate embedding for sub-question
  const embeddingResult = await embeddingService.generateEmbedding(subQuestion.text);
  const queryEmbedding = embeddingResult.embedding;

  // Step 3: Query Pinecone
  const pineconeResults = await pineconeService.query(queryEmbedding, {
    userId,
    topK: topK * 2,
    documentId: documentRouting?.documentId || (documentIds && documentIds.length === 1 ? documentIds[0] : undefined),
    minSimilarity: 0.3,
  });

  // Step 4: Convert to SearchResult format for reranking
  const searchResults: SearchResult[] = pineconeResults.map((result: {
    documentId: string;
    content: string;
    filename: string;
    similarity: number;
    chunkIndex: number;
    metadata: Record<string, unknown>;
  }) => ({
    chunkId: `${result.documentId}_${result.chunkIndex}`,
    documentId: result.documentId,
    documentTitle: result.filename || 'Unknown',
    chunkText: result.content || '',
    microSummary: result.metadata?.microSummary as string | undefined,
    chunkType: result.metadata?.chunkType as string | undefined,
    sectionName: result.metadata?.sectionName as string | undefined,
    pageNumber: result.metadata?.pageNumber as number | undefined,
    combinedScore: result.similarity || 0,
    metadata: result.metadata,
  }));

  // Step 5: Micro-summary reranking (if enabled and chunks have micro-summaries)
  let rerankedResults = searchResults;
  if (options.useMicroSummaryReranking) {
    const hasMicroSummaries = searchResults.some(r => r.microSummary);
    if (hasMicroSummaries) {
      rerankedResults = await microSummaryRerankerService.rerankWithMicroSummaries(searchResults, {
        query: subQuestion.text,
        queryIntent: subQuestion.type,
      });
    }
  }

  // Step 6: Chunk-type reranking (if enabled)
  if (options.useChunkTypeReranking) {
    const chunkTypeInput = rerankedResults.map(r => ({
      id: r.chunkId,
      content: r.chunkText,
      metadata: r.metadata,
      score: r.finalScore || r.combinedScore,
    }));

    const chunkTypeResult = await rerankByChunkType(chunkTypeInput, subQuestion.text);

    // Map back to SearchResult format
    rerankedResults = chunkTypeResult.rerankedChunks.map(ranked => {
      const original = rerankedResults.find(r => r.chunkId === ranked.id);
      return {
        ...original!,
        finalScore: ranked.finalScore,
      };
    });
  }

  // Step 7: Filter by minimum score and take top K
  const filteredResults = rerankedResults
    .filter(r => (r.finalScore || r.combinedScore) >= MIN_CHUNK_SCORE)
    .slice(0, topK);

  // Step 8: Convert to TaggedChunk format
  const taggedChunks: TaggedChunk[] = filteredResults.map(result => ({
    chunkId: result.chunkId,
    documentId: result.documentId,
    documentTitle: result.documentTitle,
    content: result.chunkText,
    microSummary: result.microSummary,
    sectionName: result.sectionName,
    pageNumber: result.pageNumber,
    chunkType: result.chunkType,
    originalScore: result.combinedScore,
    rerankScore: result.microScore || result.combinedScore,
    finalScore: result.finalScore || result.combinedScore,
    sourceSubQuestionId: subQuestion.id,
    sourceSubQuestionText: subQuestion.text,
    relevanceToSubQuestion: result.finalScore || result.combinedScore,
    metadata: result.metadata,
  }));

  const latencyMs = Date.now() - startTime;
  console.log(`[PLAN-RETRIEVAL] Retrieved ${taggedChunks.length} chunks for ${subQuestion.id} in ${latencyMs}ms`);

  return {
    subQuestion,
    chunks: taggedChunks,
    retrievalMethod: 'vector',
    documentRouting,
    latencyMs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Chunk Deduplication
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deduplicate chunks from multiple sub-question retrievals
 *
 * @param chunks - All retrieved chunks
 * @returns Deduplicated chunks with highest scores preserved
 */
function deduplicateChunks(chunks: TaggedChunk[]): { deduped: TaggedChunk[]; removedCount: number } {
  const seen = new Map<string, TaggedChunk>();

  for (const chunk of chunks) {
    const existing = seen.get(chunk.chunkId);

    if (!existing) {
      seen.set(chunk.chunkId, chunk);
    } else {
      // Keep the one with higher score
      if (chunk.finalScore > existing.finalScore) {
        seen.set(chunk.chunkId, chunk);
      }
    }
  }

  const deduped = Array.from(seen.values());
  const removedCount = chunks.length - deduped.length;

  if (removedCount > 0) {
    console.log(`[PLAN-RETRIEVAL] Deduplicated: ${removedCount} duplicate chunks removed`);
  }

  return { deduped, removedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Plan-Driven Retrieval
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute plan-driven retrieval for a complex query
 *
 * This is the MAIN ENTRY POINT for plan-driven retrieval.
 *
 * @param queryPlan - The query plan with sub-questions
 * @param options - Retrieval options
 * @returns PlanDrivenRetrievalResult
 */
export async function executePlanDrivenRetrieval(
  queryPlan: QueryPlan,
  options: RetrievalOptions
): Promise<PlanDrivenRetrievalResult> {
  const startTime = Date.now();

  console.log('[PLAN-RETRIEVAL] ═══════════════════════════════════════════');
  console.log(`[PLAN-RETRIEVAL] Executing plan-driven retrieval`);
  console.log(`[PLAN-RETRIEVAL] Sub-questions: ${queryPlan.subQuestions.length}`);
  console.log(`[PLAN-RETRIEVAL] Execution order: ${queryPlan.executionOrder.join(' → ')}`);
  console.log('[PLAN-RETRIEVAL] ═══════════════════════════════════════════');

  const subQuestionResults: SubQuestionRetrievalResult[] = [];
  const allChunks: TaggedChunk[] = [];

  // Execute retrieval for each sub-question in order
  for (const sqId of queryPlan.executionOrder) {
    const subQuestion = queryPlan.subQuestions.find(sq => sq.id === sqId);

    if (!subQuestion) {
      console.warn(`[PLAN-RETRIEVAL] Sub-question ${sqId} not found in plan`);
      continue;
    }

    // If this sub-question depends on others, wait for them
    // (In this implementation, we execute sequentially, so dependencies are automatically satisfied)

    const result = await retrieveForSubQuestion(subQuestion, options);
    subQuestionResults.push(result);
    allChunks.push(...result.chunks);
  }

  // Deduplicate across sub-questions
  const { deduped: mergedChunks, removedCount } = deduplicateChunks(allChunks);

  // Sort merged chunks by final score
  mergedChunks.sort((a, b) => b.finalScore - a.finalScore);

  const totalLatencyMs = Date.now() - startTime;

  console.log('[PLAN-RETRIEVAL] ═══════════════════════════════════════════');
  console.log('[PLAN-RETRIEVAL] Plan-Driven Retrieval Complete:');
  console.log(`  • Total chunks retrieved: ${allChunks.length}`);
  console.log(`  • After deduplication: ${mergedChunks.length}`);
  console.log(`  • Total latency: ${totalLatencyMs}ms`);
  console.log('[PLAN-RETRIEVAL] ═══════════════════════════════════════════');

  return {
    queryPlan,
    subQuestionResults,
    mergedChunks,
    totalChunksRetrieved: allChunks.length,
    totalLatencyMs,
    deduplicationCount: removedCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Context Building for Answer Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build organized context for answer generation from plan-driven retrieval
 *
 * @param result - Plan-driven retrieval result
 * @returns Organized context string
 */
export function buildContextFromRetrieval(result: PlanDrivenRetrievalResult): string {
  const sections: string[] = [];

  // Group chunks by sub-question
  const chunksBySubQuestion = new Map<string, TaggedChunk[]>();

  for (const chunk of result.mergedChunks) {
    const sqId = chunk.sourceSubQuestionId;
    if (!chunksBySubQuestion.has(sqId)) {
      chunksBySubQuestion.set(sqId, []);
    }
    chunksBySubQuestion.get(sqId)!.push(chunk);
  }

  // Build context sections
  for (const sqResult of result.subQuestionResults) {
    const sqId = sqResult.subQuestion.id;
    const chunks = chunksBySubQuestion.get(sqId) || [];

    if (chunks.length === 0) continue;

    sections.push(`\n## Context for: "${sqResult.subQuestion.text}"\n`);

    if (sqResult.documentRouting) {
      sections.push(`📄 Primary Document: ${sqResult.documentRouting.documentTitle}\n`);
    }

    for (const chunk of chunks) {
      sections.push(`\n### From: ${chunk.documentTitle}${chunk.sectionName ? ` - ${chunk.sectionName}` : ''}${chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : ''}`);
      sections.push(chunk.content);

      if (chunk.microSummary) {
        sections.push(`\n_Summary: ${chunk.microSummary}_`);
      }
    }
  }

  return sections.join('\n');
}

/**
 * Get chunk statistics for answer generation
 */
export function getChunkStatistics(result: PlanDrivenRetrievalResult): {
  totalChunks: number;
  chunksPerSubQuestion: Record<string, number>;
  uniqueDocuments: string[];
  avgScore: number;
} {
  const chunksPerSubQuestion: Record<string, number> = {};
  const documents = new Set<string>();
  let totalScore = 0;

  for (const chunk of result.mergedChunks) {
    chunksPerSubQuestion[chunk.sourceSubQuestionId] = (chunksPerSubQuestion[chunk.sourceSubQuestionId] || 0) + 1;
    documents.add(chunk.documentTitle);
    totalScore += chunk.finalScore;
  }

  return {
    totalChunks: result.mergedChunks.length,
    chunksPerSubQuestion,
    uniqueDocuments: Array.from(documents),
    avgScore: result.mergedChunks.length > 0 ? totalScore / result.mergedChunks.length : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export const kodaPlanDrivenRetrieval = {
  executePlanDrivenRetrieval,
  buildContextFromRetrieval,
  getChunkStatistics,
};

export default kodaPlanDrivenRetrieval;
