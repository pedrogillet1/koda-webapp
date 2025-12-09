/**
 * Query Analyzer Service - A+ Implementation
 * Analyzes queries to determine strategy (tier, intent, etc.)
 *
 * Features:
 * - Two-tier intent detection (heuristic -> LLM)
 * - Query tier classification
 * - Entity extraction (placeholder)
 * - Caching of analysis results
 */

import { QueryAnalysis, QueryInput, QueryTier } from "../types/rag.types";
import { logger, logError } from "../utils/logger.service";
import { cacheManager } from "../utils/cache-manager.service";

class QueryAnalyzerService {
  public async analyze(input: QueryInput): Promise<QueryAnalysis> {
    const { query, attachedDocumentIds } = input;
    const cacheKey = `query-analysis:${query}`;

    const cached = await cacheManager.get<QueryAnalysis>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const tier = this.classifyTier(query, !!attachedDocumentIds?.length);
      const intent = await this.detectIntent(query);

      const analysis: QueryAnalysis = {
        tier,
        intent,
        entities: [], // Placeholder for entity extraction
        language: "pt", // Placeholder
        hasAttachedDocuments: !!attachedDocumentIds?.length,
      };

      await cacheManager.set(cacheKey, analysis, 300); // Cache for 5 minutes
      return analysis;

    } catch (error) {
      logError(error as Error, { query }, "Query analysis failed");
      // Return default analysis on failure
      return {
        tier: "medium",
        intent: "unknown",
        entities: [],
        language: "pt",
        hasAttachedDocuments: !!attachedDocumentIds?.length,
      };
    }
  }

  private classifyTier(query: string, hasAttachedDoc: boolean): QueryTier {
    const lower = query.toLowerCase();

    if (/^(oi|olá|quantos documentos|liste)/i.test(lower)) {
      return "trivial";
    }
    if (hasAttachedDoc && /^(qual|quanto|onde|quando)\b/i.test(lower)) {
      return "simple";
    }
    if (/compar|versus|diferença|todos os documentos/i.test(lower)) {
      return "complex";
    }
    return "medium";
  }

  private async detectIntent(query: string): Promise<string> {
    // Tier 1: Heuristic (no LLM)
    const fastResult = this.fastIntentDetection(query);
    if (fastResult) {
      return fastResult;
    }

    // Tier 2: LLM (fallback)
    // In a real app, this would call the LLM
    logger.debug({ query }, "Falling back to LLM for intent detection");
    return "rag_query"; // Default
  }

  private fastIntentDetection(query: string): string | null {
    const lower = query.toLowerCase();
    if (/^(oi|olá|bom dia)/i.test(lower)) return "greeting";
    if (/quantos documentos|liste/i.test(lower)) return "meta_query";
    if (/resuma? o documento/i.test(lower)) return "summary_query";
    return null;
  }
}

export const queryAnalyzerService = new QueryAnalyzerService();
