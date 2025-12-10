/**
 * Retrieval Types - A+ Implementation
 * Defines types for retrieval, merging, and reranking
 */

import { Chunk } from './rag.types';

// ============================================================================
// Retrieval
// ============================================================================

export interface VectorResult {
  id: string;
  score: number;
  metadata: Chunk["metadata"];
}

export interface BM25Result {
  id: string;
  score: number;
  content: string;
  metadata: Chunk["metadata"];
}

export interface RetrievalOptions {
  topK: number;
  filter?: Record<string, any>;
}

// ============================================================================
// Merging
// ============================================================================

export interface MergedChunk extends Chunk {
  vectorScore: number;
  bm25Score: number;
  hybridScore: number;
}

export interface MergeOptions {
  rrf_k?: number;
}

// ============================================================================
// Reranking
// ============================================================================

export interface RerankOptions {
  query: string;
  queryType: string;
}

export interface RerankedChunk extends Chunk {
  originalScore: number;
  rerankScore: number;
}

export type ChunkType = 'text' | 'table' | 'title' | 'list' | 'financial' | 'definition' | 'explanation';

export type QueryType = 'numeric_query' | 'explanation_query' | 'summary_query' | 'comparison_query' | 'default';

export const TYPE_BOOST_MATRIX: Record<QueryType, Partial<Record<ChunkType, number>>> = {
  numeric_query: {
    table: 1.5,
    financial: 1.4,
    list: 1.2,
    text: 1.0,
  },
  explanation_query: {
    definition: 1.5,
    explanation: 1.4,
    text: 1.2,
    table: 0.9,
  },
  summary_query: {
    title: 1.3,
    text: 1.2,
    list: 1.1,
  },
  comparison_query: {
    table: 1.4,
    list: 1.3,
    text: 1.1,
  },
  default: {
    text: 1.0,
  },
};
