/**
 * RAG Core Types - A+ Implementation
 * Defines all core data structures for the RAG pipeline
 */

import { z } from 'zod';

// ============================================================================
// Query & Analysis
// ============================================================================

export type QueryTier = 'trivial' | 'simple' | 'medium' | 'complex';

export const QuerySchema = z.object({
  query: z.string().min(1).max(5000).trim(),
  userId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  attachedDocumentIds: z.array(z.string().uuid()).optional(),
  answerLength: z.enum(['short', 'medium', 'summary', 'long']).default('medium'),
  isFirstMessage: z.boolean().optional(),
});

export type QueryInput = z.infer<typeof QuerySchema>;

export interface QueryAnalysis {
  tier: QueryTier;
  intent: string;
  entities: string[];
  language: 'en' | 'pt' | 'es' | 'fr';
  hasAttachedDocuments: boolean;
}

// ============================================================================
// Retrieval & Chunks
// ============================================================================

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  metadata: {
    filename: string;
    section?: string;
    pageNumber?: number;
    chunkType: 'text' | 'table' | 'title' | 'list' | 'financial';
    microSummary?: string;
  };
  vectorScore?: number;
  bm25Score?: number;
  hybridScore?: number;
  rerankScore?: number;
}

export interface RetrievalResult {
  chunks: Chunk[];
  stats: {
    vectorCount: number;
    bm25Count: number;
    mergedCount: number;
    executionTimeMs: number;
  };
}

// ============================================================================
// Generation & Response
// ============================================================================

export interface Source {
  id: string;
  documentId: string;
  filename: string;
  pageNumber?: number;
  section?: string;
}

export interface Answer {
  content: string;
  sources: Source[];
  queryAnalysis: QueryAnalysis;
  performance: {
    metrics: Array<{ stage: string; durationMs: number }>;
    totalDurationMs: number;
  };
  quality: {
    isGrounded: boolean;
    citationAccuracy: number;
    overallScore: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

export interface TierConfig {
  useRAG: boolean;
  topK: number;
  llmCalls: number;
  model: 'gemini-2.5-flash';
  maxTokens: number;
}

export const TIER_CONFIGS: Record<QueryTier, TierConfig> = {
  trivial: {
    useRAG: false,
    topK: 0,
    llmCalls: 1,
    model: 'gemini-2.5-flash',
    maxTokens: 200,
  },
  simple: {
    useRAG: true,
    topK: 10,
    llmCalls: 1,
    model: 'gemini-2.5-flash',
    maxTokens: 500,
  },
  medium: {
    useRAG: true,
    topK: 15,
    llmCalls: 1,
    model: 'gemini-2.5-flash',
    maxTokens: 1000,
  },
  complex: {
    useRAG: true,
    topK: 20,
    llmCalls: 1,
    model: 'gemini-2.5-flash',
    maxTokens: 2000,
  },
};
