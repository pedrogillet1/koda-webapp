/**
 * Domain Knowledge Service - STUB (service removed)
 */
export const getDomainKnowledge = async () => ({});

export const domainKnowledgeService = {
  extractFromDocument: async (_documentId: string, _text: string) => ({
    terms: [] as Array<{ term: string; definition: string; category: string }>,
    concepts: [] as string[],
  }),
  getKnowledge: async (_userId: string, _term: string) => null as { definition: string; sources: string[] } | null,
};

export default {
  getDomainKnowledge,
  domainKnowledgeService,
};
