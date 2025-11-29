/** Document Comparison Service - Stub */

class DocumentComparisonService {
  async compareDocuments(_docIds: string[], _userId: string, _options?: any, _sessionId?: string) {
    return {
      similarity: 0,
      differences: [],
      commonSections: [],
    };
  }

  async findSimilarDocuments(_documentId: string, _userId: string) {
    return [];
  }
}

export default new DocumentComparisonService();
