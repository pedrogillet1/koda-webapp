/** Intent Classification Service - Minimal Stub */
class IntentClassificationService {
  classify(query: string) {
    return { intent: 'general', confidence: 0.5 };
  }
}
export default new IntentClassificationService();
