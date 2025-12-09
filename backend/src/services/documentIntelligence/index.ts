/**
 * Document Intelligence System
 *
 * Exports all document intelligence services for easy importing.
 * NOTE: Most services deprecated and using stubs from deletedServiceStubs.ts
 */

// Document Classification - DEPRECATED - using stubs
export {
  classifyDocument,
  classifyDocumentsBatch,
  fallbackClassification,
  DOCUMENT_TAXONOMY,
  ALL_DOCUMENT_TYPES,
  ALL_DOMAINS,
  type DocumentClassification
} from '../deletedServiceStubs';

// Entity Extraction - DEPRECATED - using stubs
export {
  extractEntities,
  extractEntitiesBatch,
  EntityType,
  type ExtractedEntity
} from '../deletedServiceStubs';

// Keyword Extraction - DEPRECATED - using stubs
export {
  extractKeywords,
  extractKeywordsBatch,
  combineKeywords,
  isDomainKeyword,
  getDomainKeywords,
  keywordsToString,
  STOP_WORDS,
  DOMAIN_KEYWORDS,
  type ExtractedKeyword
} from '../deletedServiceStubs';

// Chunk Classification
export {
  classifyChunk,
  classifyChunksBatch,
  getChunkTypesForCategory,
  getCategoryForChunkType,
  isDomainSpecificChunkType,
  CHUNK_TAXONOMY,
  ALL_CHUNK_TYPES,
  ALL_CATEGORIES,
  type ChunkClassification
} from '../chunkClassifier.service';

// Document Routing
export {
  routeToDocument,
  routeToMultipleDocuments,
  getRoutingStats,
  type DocumentRoutingResult,
  type DocumentSummary
} from '../documentRouter.service';

// Hybrid Search - DEPRECATED: hybridSearch.service moved to _deprecated
// Using stubs from deletedServiceStubs
export {
  hybridSearch,
  analyzeQueryIntent,
  type SearchFilters,
  type HybridSearchOptions
} from '../deletedServiceStubs';

// Stub exports for backward compatibility
export const keywordSearch = async (_query: string, _options?: any) => [] as any[];
export const vectorSearch = async (_query: string, _options?: any) => [] as any[];
export type SearchResult = { id: string; score: number; metadata?: any };

/**
 * Document Intelligence Pipeline
 *
 * Processes a document through all intelligence stages.
 */
export async function processDocumentIntelligence(
  document: {
    id: string;
    filename: string;
    mimeType: string;
    textContent: string;
  }
): Promise<{
  classification: import('../deletedServiceStubs').DocumentClassification;
  entities: import('../deletedServiceStubs').ExtractedEntity[];
  keywords: import('../deletedServiceStubs').ExtractedKeyword[];
}> {
  // DEPRECATED: Using stubs for document intelligence
  const { classifyDocument } = await import('../deletedServiceStubs');
  const { extractEntities } = await import('../deletedServiceStubs');
  const { extractKeywords } = await import('../deletedServiceStubs');

  // Classify document
  const classification = await classifyDocument(
    document.textContent,
    document.filename,
    document.mimeType
  );

  // Extract entities with domain context
  const entities = await extractEntities(document.textContent, {
    domain: classification.domain,
    useLLM: true
  });

  // Extract keywords with domain boosting
  const keywords = extractKeywords(document.textContent, {
    domain: classification.domain,
    maxKeywords: 100
  });

  return { classification, entities, keywords };
}

/**
 * Process chunk through intelligence pipeline
 */
export async function processChunkIntelligence(
  chunk: {
    id: string;
    text: string;
    documentType?: string;
    domain?: string;
  }
): Promise<import('../chunkClassifier.service').ChunkClassification> {
  const { classifyChunk } = await import('../chunkClassifier.service');

  return classifyChunk(chunk.text, {
    documentType: chunk.documentType,
    domain: chunk.domain
  });
}

export default {
  processDocumentIntelligence,
  processChunkIntelligence
};
