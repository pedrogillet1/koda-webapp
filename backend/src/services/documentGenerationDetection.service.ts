/**
 * Document Generation Detection Service - STUB (service removed)
 */
export const detectDocumentGeneration = async () => false;

// Named export for the sync version used by RAG service
export const detectDocumentGenerationIntent = (_query: string): {
  isDocumentGeneration: boolean;
  documentType?: string;
  shouldProceedToRag: boolean;
} => ({
  isDocumentGeneration: false,
  shouldProceedToRag: true
});

export default {
  detectDocumentGeneration,
  detectDocumentGenerationIntent
};
