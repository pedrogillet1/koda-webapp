/**
 * Semantic File Matcher Service - STUB (service removed)
 */

export interface MatchedFile {
  id: string;
  filename: string;
  score: number;
  [key: string]: any;
}

export const matchFiles = async (_query?: string, _userId?: string): Promise<MatchedFile[]> => [];

export const findSingleFile = async (
  _query: string,
  _userId: string,
  _options?: { includeDeleted?: boolean }
): Promise<MatchedFile | null> => {
  return null;
};

export default {
  matchFiles,
  findSingleFile
};
