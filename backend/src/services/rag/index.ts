/**
 * RAG Services Index - A+ Implementation
 * Central export point for all RAG services
 */

// Types
export * from "./types/rag.types";
export * from "./types/retrieval.types";
export * from "./types/generation.types";

// Core Services
export { ragOrchestratorService } from "./core/rag-orchestrator.service";
export { queryAnalyzerService } from "./core/query-analyzer.service";

// Retrieval Services
export { hybridRetrievalService } from "./retrieval/hybrid-retrieval.service";
export { vectorRetrievalService } from "./retrieval/vector-retrieval.service";
export { bm25RetrievalService } from "./retrieval/bm25-retrieval.service";
export { retrievalMergerService } from "./retrieval/retrieval-merger.service";

// Generation Services
export { answerGeneratorService } from "./generation/answer-generator.service";
export { contextBuilderService } from "./generation/context-builder.service";
export { promptBuilderService } from "./generation/prompt-builder.service";

// Utility Services
export { logger, logError } from "./utils/logger.service";
export { PerformanceTracker } from "./utils/performance-tracker.service";
export { cacheManager } from "./utils/cache-manager.service";

// Embedding Service
export { embeddingService } from "./embedding.service";

// Legacy Adapter (drop-in replacement for rag.service.ts)
export { default as ragServiceAdapter } from "./rag-service-adapter";
