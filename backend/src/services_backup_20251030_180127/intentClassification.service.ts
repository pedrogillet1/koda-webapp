/** Intent Classification Service - Minimal Stub */
class IntentClassificationService {
  classify(query: string) { return { intent: 'search', confidence: 0.8 }; }
}
export default new IntentClassificationService();
