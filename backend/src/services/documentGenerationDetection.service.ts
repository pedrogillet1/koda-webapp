/**
 * Document Generation Detection Service - STUB (service removed)
 */
export const detectDocumentGeneration = async () => false;

// Named export for the sync version used by RAG service
export const detectDocumentGenerationIntent = (_query: string): {
  isDocumentGeneration: boolean;
  documentType?: string;
  shouldProceedToRag: boolean;
  confidence: number;
} => ({
  isDocumentGeneration: false,
  shouldProceedToRag: true,
  confidence: 0
});

export default {
  detectDocumentGeneration,
  detectDocumentGenerationIntent
};
