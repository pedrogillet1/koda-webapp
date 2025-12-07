/**
 * Document Intelligence System
 *
 * Exports all document intelligence services for easy importing.
 */

// Document Classification
export {
  classifyDocument,
  classifyDocumentsBatch,
  fallbackClassification,
  DOCUMENT_TAXONOMY,
  ALL_DOCUMENT_TYPES,
  ALL_DOMAINS,
  type DocumentClassification
} from '../documentClassifier.service';

// Entity Extraction
export {
  extractEntities,
  extractEntitiesBatch,
  EntityType,
  type ExtractedEntity
} from '../entityExtractor.service';

// Keyword Extraction
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
} from '../keywordExtractor.service';

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

// Hybrid Search
export {
  hybridSearch,
  keywordSearch,
  vectorSearch,
  analyzeQueryIntent,
  type SearchFilters,
  type SearchResult,
  type HybridSearchOptions
} from '../hybridSearch.service';

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
  classification: import('../documentClassifier.service').DocumentClassification;
  entities: import('../entityExtractor.service').ExtractedEntity[];
  keywords: import('../keywordExtractor.service').ExtractedKeyword[];
}> {
  const { classifyDocument } = await import('../documentClassifier.service');
  const { extractEntities } = await import('../entityExtractor.service');
  const { extractKeywords } = await import('../keywordExtractor.service');

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
