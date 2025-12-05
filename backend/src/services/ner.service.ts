/**
 * NER Service - STUB (service removed)
 */

interface Entity {
  text: string;
  type: string;
  confidence: number;
}

interface NerResult {
  entities: Entity[];
  keywords: string[];
  suggestedTags: string[];
}

export const extractEntities = async (_text: string, _options?: any): Promise<NerResult> => ({
  entities: [],
  keywords: [],
  suggestedTags: []
});

export const analyzeText = async (_text: string): Promise<NerResult> => ({
  entities: [],
  keywords: [],
  suggestedTags: []
});

export const storeEntities = async (_documentId: string, _entities: Entity[]): Promise<void> => {};

export const autoTagDocument = async (
  _userIdOrDocumentId: string,
  _documentIdOrText: string,
  _entities?: Entity[],
  _suggestedTags?: string[]
): Promise<string[]> => [];

export default {
  extractEntities,
  analyzeText,
  storeEntities,
  autoTagDocument,
};
