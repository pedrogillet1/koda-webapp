/**
 * Intent Classifier Service - Minimal Stub
 * Classifies user query intents
 */

export interface Intent {
  type: 'document_search' | 'folder_navigation' | 'general_query';
  confidence: number;
  entities?: any;
}

class IntentClassifierService {
  /**
   * Classify the intent of a user query
   */
  classify(query: string): Intent {
    // Simple heuristic-based classification
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('show')) {
      return {
        type: 'document_search',
        confidence: 0.8
      };
    }

    if (lowerQuery.includes('folder') || lowerQuery.includes('directory')) {
      return {
        type: 'folder_navigation',
        confidence: 0.8
      };
    }

    return {
      type: 'general_query',
      confidence: 0.6
    };
  }
}

export default new IntentClassifierService();
