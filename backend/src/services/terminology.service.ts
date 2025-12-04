/**
 * Terminology Service - STUB (service removed)
 */

export interface ExpandedQuery {
  original: string;
  expanded: string;
  synonyms: string[];
}

export interface DomainContext {
  domain: string;
  confidence: number;
  keywords: string[];
}

export const getSynonyms = async (term: string): Promise<string[]> => [];

export const expandQuery = async (query: string): Promise<ExpandedQuery> => ({
  original: query,
  expanded: query,
  synonyms: []
});

export const detectDomainContext = async (query: string): Promise<DomainContext> => ({
  domain: 'general',
  confidence: 0,
  keywords: []
});

export const getTerminology = async () => [];

export default {
  getSynonyms,
  expandQuery,
  detectDomainContext,
  getTerminology,
};
