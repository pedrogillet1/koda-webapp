/**
 * Koda Intent Engine V2
 *
 * Re-exports from the main intent engine for backwards compatibility
 */

import { kodaIntentEngine, KodaIntentEngine } from '../kodaIntentEngine.service';

// Simple classification interface for RAG controller
export const kodaIntentEngineV2 = {
  classifyIntent: (query: string) => {
    // Return a synchronous simple intent classification
    // The actual async classification can be done by the full engine
    return {
      domain: 'doc_content' as const,
      questionType: 'simple_factual' as const,
      scope: 'all_documents' as const,
      requiresRAG: true,
    };
  },

  // Async version for more complex classification
  classifyIntentAsync: (query: string, context?: any) => {
    return kodaIntentEngine.classifyIntent(query, context);
  },
};

export default kodaIntentEngineV2;
