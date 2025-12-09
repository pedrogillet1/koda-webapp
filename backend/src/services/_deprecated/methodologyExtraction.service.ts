/**
 * Methodology Extraction Service - STUB (service removed)
 */

export const extractMethodology = async () => ({ methods: [] as string[], frameworks: [] as string[] });

export const methodologyExtractionService = {
  extractFromDocument: async (_documentId: string, _text: string) => ({
    methodologies: [] as Array<{ name: string; description: string; confidence: number }>,
  }),
  getMethodologies: async (_userId: string) => [] as Array<{ name: string; documentIds: string[] }>,
  processDocumentForKnowledge: async (_documentId: string, _text: string, _metadata?: any) => ({
    success: true,
    methodologies: [] as Array<{ name: string; description: string; confidence: number }>,
    frameworks: [] as string[],
    patterns: [] as string[],
  }),
};

export default {
  extractMethodology,
  methodologyExtractionService,
};
