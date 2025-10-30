/** Query Classifier Service - Minimal Stub */
class QueryClassifierService {
  classify(query: string) { return { type: 'general', confidence: 0.8 }; }
}
export default new QueryClassifierService();
