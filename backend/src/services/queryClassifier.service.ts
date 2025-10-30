/** Query Classifier Service - Minimal Stub */
export type QueryType = 'question' | 'command' | 'search' | 'general';

class QueryClassifierService {
  classifyQuery(query: string): QueryType {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('?')) return 'question';
    if (lowerQuery.startsWith('find') || lowerQuery.startsWith('search')) return 'search';
    if (lowerQuery.startsWith('open') || lowerQuery.startsWith('show')) return 'command';
    return 'general';
  }
}

export default new QueryClassifierService();
