/**
 * Clarification Service - STUB (service removed)
 */

export interface ClarificationOption {
  label: string;
  count?: number;
  document_metadata?: {
    documentIds: string[];
  };
  [key: string]: any;
}

export interface ClarificationResult {
  needsClarification: boolean;
  options: ClarificationOption[];
  question: string;
  groupingStrategy: string;
}

export const needsClarification = async (_query?: string, _context?: any): Promise<boolean> => false;

export const generateClarification = async (
  _topic: string,
  _documents: any[],
  _userId?: string
): Promise<ClarificationResult> => ({
  needsClarification: false,
  options: [],
  question: '',
  groupingStrategy: 'none'
});

export default {
  needsClarification,
  generateClarification
};
