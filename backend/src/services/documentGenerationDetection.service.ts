/**
 * Document Generation Detection Service
 * Detects when user wants to generate documents or presentations
 */

export interface DocumentGenerationIntent {
  isDocumentGeneration: boolean;
  type: 'document' | 'presentation' | null;
  documentType?: 'summary' | 'report' | 'analysis' | 'general' | 'presentation';
  confidence: number;
}

/**
 * Detect if query is requesting document generation
 * Returns detection result with type and confidence
 */
export function detectDocumentGenerationIntent(query: string): DocumentGenerationIntent {
  const lowerQuery = query.toLowerCase().trim();

  // ============================================================================
  // PRESENTATION DETECTION PATTERNS
  // ============================================================================
  const presentationPatterns = [
    // Direct commands
    /(?:create|make|generate|build|prepare)\s+(?:a\s+|an\s+)?(?:presentation|slide\s*deck|powerpoint|ppt|slides?)/i,
    
    // With topic
    /(?:presentation|slide\s*deck|powerpoint|ppt)\s+(?:about|on|for|regarding)/i,
    
    // Casual
    /(?:need|want|can\s+you)\s+(?:a\s+)?(?:presentation|slide\s*deck|slides?)/i,
  ];

  for (const pattern of presentationPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        isDocumentGeneration: true,
        type: 'presentation',
        documentType: 'presentation',  // Fixed: Add documentType for presentations
        confidence: 0.95,
      };
    }
  }

  // ============================================================================
  // DOCUMENT GENERATION PATTERNS
  // ============================================================================
  
  // Summary patterns
  const summaryPatterns = [
    /(?:create|make|generate|write|prepare)\s+(?:a\s+|an\s+)?(?:summary|summarized)\s+(?:report|document)/i,
    /(?:summarize|summary)\s+(?:all|my|the)\s+(?:documents?|files?|papers?)\s+(?:into|in)\s+(?:a\s+)?(?:report|document|file)/i,
    /(?:create|generate)\s+(?:a\s+)?(?:comprehensive|detailed)?\s*summary\s+(?:of|from)/i,
  ];

  for (const pattern of summaryPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        isDocumentGeneration: true,
        type: 'document',
        documentType: 'summary',
        confidence: 0.90,
      };
    }
  }

  // Report patterns
  const reportPatterns = [
    /(?:create|make|generate|write|prepare)\s+(?:a\s+|an\s+)?(?:report|detailed\s+report)/i,
    /(?:generate|create)\s+(?:a\s+)?(?:comprehensive|detailed|full)?\s*report/i,
    /(?:write|draft)\s+(?:a\s+|an\s+)?report\s+(?:about|on|for)/i,
  ];

  for (const pattern of reportPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        isDocumentGeneration: true,
        type: 'document',
        documentType: 'report',
        confidence: 0.90,
      };
    }
  }

  // Analysis patterns
  const analysisPatterns = [
    /(?:create|make|generate|write)\s+(?:a\s+|an\s+)?(?:analysis|detailed\s+analysis)/i,
    /(?:analyze|analyse)\s+(?:and\s+)?(?:create|generate|write)\s+(?:a\s+)?(?:document|report)/i,
  ];

  for (const pattern of analysisPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        isDocumentGeneration: true,
        type: 'document',
        documentType: 'analysis',
        confidence: 0.85,
      };
    }
  }

  // General document creation patterns
  const generalDocPatterns = [
    /(?:create|make|generate|write)\s+(?:a\s+|an\s+)?(?:document|file|markdown|md)\s+(?:about|on|for|with)/i,
    /(?:compile|put\s+together)\s+(?:a\s+)?document/i,
  ];

  for (const pattern of generalDocPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        isDocumentGeneration: true,
        type: 'document',
        documentType: 'general',
        confidence: 0.80,
      };
    }
  }

  // No document generation detected
  return {
    isDocumentGeneration: false,
    type: null,
    confidence: 0,
  };
}

/**
 * Check if query should skip regular RAG and go straight to document generation
 */
export function shouldGenerateDocument(query: string): boolean {
  const intent = detectDocumentGenerationIntent(query);
  return intent.isDocumentGeneration && intent.confidence >= 0.80;
}

export default {
  detectDocumentGenerationIntent,
  shouldGenerateDocument,
};
