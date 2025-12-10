/**
 * Generation Types - A+ Implementation
 * Defines types for context building, prompt construction, and generation
 */

import { QueryTier } from "./rag.types";

// ============================================================================
// Context Building
// ============================================================================

export interface ContextOptions {
  query: string;
  tier: QueryTier;
}

export interface CompressedContext {
  content: string;
  tokenCount: number;
}

// ============================================================================
// Prompt Building
// ============================================================================

export interface PromptOptions {
  query: string;
  context: string;
  tier: QueryTier;
  includeIntentDetection?: boolean;
  includeLightQA?: boolean;
}

export interface Prompt {
  system: string;
  user: string;
  fullPrompt: string;
}

// ============================================================================
// Generation
// ============================================================================

export interface GenerationOptions {
  model: 'gemini-2.5-flash';
  maxTokens: number;
  temperature?: number;
  stream?: boolean;
}

export interface GenerationResult {
  content: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}
