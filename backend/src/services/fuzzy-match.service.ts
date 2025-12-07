/**
 * Fuzzy Match Service - STUB (service removed)
 */

export interface FuzzyMatchDocument {
  id: string;
  filename: string;
  [key: string]: any;
}

export const fuzzyMatch = async (_query?: string, _documents?: FuzzyMatchDocument[]): Promise<FuzzyMatchDocument[]> => [];

export const findBestMatch = (
  _searchName: string,
  _documents: FuzzyMatchDocument[],
  _threshold?: number
): FuzzyMatchDocument | null => {
  return null;
};

export default {
  fuzzyMatch,
  findBestMatch
};
