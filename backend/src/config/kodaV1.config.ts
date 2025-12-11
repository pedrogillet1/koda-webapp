/**
 * Koda Configuration
 * 
 * Central configuration for all Koda services
 */

export const kodaConfig = {
  // RAG Configuration
  rag: {
    defaultMaxChunks: 10,
    defaultMaxDocs: 5,
    useVectorSearch: true,
    useBM25: false,
    useReranking: false,
  },

  // LLM Configuration
  llm: {
    model: 'gemini-2.5-flash',
    defaultTemperature: 0.3,
    defaultMaxTokens: 800,
    timeout: 30000, // 30 seconds
  },

  // Formatting Configuration
  formatting: {
    maxParagraphLines: 5,
    minParagraphLines: 2,
    enableSmartBolding: true,
    enableCitationConversion: true,
    enableValidation: true,
  },

  // Fallback Configuration
  fallback: {
    useShortTemplates: true,
    skipGeminiForNoData: true,
  },

  // Intent Classification
  intent: {
    confidenceThreshold: 0.5,
    enableMultiLanguage: true,
    supportedLanguages: ['pt', 'en', 'es', 'fr'],
  },

  // Context Management
  context: {
    maxTurns: 5,
    compressAfterTurns: 10,
    trackActiveDocuments: true,
  },

  // Performance
  performance: {
    enableCaching: true,
    cacheTimeout: 300, // 5 minutes
    logSlowQueries: true,
    slowQueryThreshold: 5000, // 5 seconds
  },

  // Feature Flags
  features: {
    enableAnalytics: true,
    enableDocSearch: true,
    enableGenericChat: false, // V1: disabled
    enableFollowUp: true,
    enableComparison: true,
  },
};

export default kodaConfig;
