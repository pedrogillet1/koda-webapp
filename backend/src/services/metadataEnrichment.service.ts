/**
 * Metadata Enrichment Service - STUB (service removed)
 */

export interface EnrichedMetadata {
  topics: string[];
  categories: string[];
  keywords: string[];
  language: string;
  summary: string;
  entities: Array<{ type: string; value: string; confidence: number }>;
}

export const enrichMetadata = async (): Promise<Partial<EnrichedMetadata>> => ({});

export interface EnrichmentOptions {
  extractTopics?: boolean;
  extractEntities?: boolean;
  generateSummary?: boolean;
  extractKeyPoints?: boolean;
  analyzeSentiment?: boolean;
  assessComplexity?: boolean;
}

export const enrichDocument = async (
  _textOrId: string,
  _filenameOrText?: string,
  _options?: EnrichmentOptions
): Promise<EnrichedMetadata> => ({
  topics: [],
  categories: [],
  keywords: [],
  language: 'en',
  summary: '',
  entities: [],
});

export default {
  enrichMetadata,
  enrichDocument,
};
