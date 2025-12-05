/**
 * Terminology Service - STUB (service removed)
 */

export interface ExpandedQuery {
  original: string;
  expanded: string;
  synonyms: string[];
  synonymsUsed: Map<string, string[]>;
  languagesMatched: string[];
}

export interface DomainContext {
  domain: string;
  confidence: number;
  keywords: string[];
  matchedTerms: string[];
}

export const getSynonyms = async (_term: string): Promise<string[]> => [];

export const expandQuery = async (
  query: string,
  _userId?: string,
  _options?: any,
  _language?: string
): Promise<ExpandedQuery> => ({
  original: query,
  expanded: query,
  synonyms: [],
  synonymsUsed: new Map(),
  languagesMatched: []
});

export const detectDomainContext = async (
  _query: string,
  _userId?: string
): Promise<DomainContext[]> => [];

export const getTerminology = async () => [];

export default {
  getSynonyms,
  expandQuery,
  detectDomainContext,
  getTerminology,
};
