/**
 * Show vs Explain Intent Classifier
 * Distinguishes between queries that want to SEE a document vs queries that want EXPLANATION
 *
 * PURPOSE: Fix over-explanation issue where Koda explains instead of showing documents
 * WHY: Users asking "what is this" or "show me X" want the document, not an explanation
 * IMPACT: Improves UX by routing show queries to file preview instead of RAG explanation
 *
 * Examples:
 * - "what is this" → SHOW (user wants to see the document)
 * - "what is this document about" → EXPLAIN (user wants summary/explanation)
 * - "show me budget" → SHOW (user wants to see the file)
 * - "what does the budget say about revenue" → EXPLAIN (user wants specific info)
 */

export interface IntentClassification {
  intent: 'show' | 'explain';
  confidence: number;
  reason: string;
  detectedFilename?: string;
}

/**
 * Classify user intent: SHOW (display document) vs EXPLAIN (provide information)
 */
export function classifyIntent(query: string): IntentClassification {
  const lower = query.toLowerCase().trim();

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 1: STRONG SHOW SIGNALS (confidence: 0.95+)
  // ═══════════════════════════════════════════════════════════════════════════
  // Direct commands to display/open/view a document

  const strongShowPatterns: Array<{ pattern: RegExp; reason: string }> = [
    // Direct show commands
    { pattern: /^(?:show|open|display|view|pull up|bring up)\s+(?:me\s+)?(?:the\s+)?(.+)$/i, reason: 'Direct show command' },
    { pattern: /^(?:let me see|show me|lemme see)\s+(?:the\s+)?(.+)$/i, reason: 'Direct show request' },

    // "What is this" without additional context
    { pattern: /^what'?s?\s+this(?:\s+file|\s+document)?(?:\s*\?)?$/i, reason: 'Generic "what is this" - wants to see document' },
    { pattern: /^what\s+is\s+this(?:\s+file|\s+document)?(?:\s*\?)?$/i, reason: 'Generic "what is this" - wants to see document' },

    // "What is X" where X is likely a filename
    { pattern: /^what'?s?\s+(?:the\s+)?([a-z0-9_\-\.]+(?:\.pdf|\.xlsx|\.docx|\.txt|\.csv)?)(?:\s*\?)?$/i, reason: 'Asking about specific file' },

    // Multilingual equivalents - Portuguese
    { pattern: /^(?:mostra|abre|exibe|mostre|abra)\s+(?:me\s+)?(?:o\s+|a\s+)?(.+)$/i, reason: 'Portuguese show command' },
    { pattern: /^o que [eé] isso(?:\s*\?)?$/i, reason: 'Portuguese "what is this"' },
    { pattern: /^(?:me\s+)?(?:mostra|mostre)\s+(.+)$/i, reason: 'Portuguese show request' },

    // Multilingual equivalents - Spanish
    { pattern: /^(?:muestra|abre|mu[eé]strame|ensena|enseña)\s+(?:me\s+)?(?:el\s+|la\s+)?(.+)$/i, reason: 'Spanish show command' },
    { pattern: /^qu[eé] es esto(?:\s*\?)?$/i, reason: 'Spanish "what is this"' },

    // Multilingual equivalents - French
    { pattern: /^(?:montre|ouvre|affiche)\s+(?:moi\s+)?(?:le\s+|la\s+)?(.+)$/i, reason: 'French show command' },
    { pattern: /^(?:qu'est-ce que c'est|c'est quoi)(?:\s*\?)?$/i, reason: 'French "what is this"' },
  ];

  for (const { pattern, reason } of strongShowPatterns) {
    const match = query.match(pattern);
    if (match) {
      return {
        intent: 'show',
        confidence: 0.95,
        reason,
        detectedFilename: match[1]?.trim()
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 2: STRONG EXPLAIN SIGNALS (confidence: 0.95+)
  // ═══════════════════════════════════════════════════════════════════════════
  // Questions asking for specific information, analysis, or explanation

  const strongExplainPatterns: Array<{ pattern: RegExp; reason: string }> = [
    // Asking about content/meaning
    { pattern: /what (?:is|are|does|do)\s+(?:the\s+)?(.+?)\s+(?:about|regarding|concerning)/i, reason: 'Asking about content topic' },
    { pattern: /what (?:does|do)\s+(?:the\s+)?(.+?)\s+(?:say|tell|show|indicate|suggest|reveal)\s+about/i, reason: 'Asking what document says about something' },
    { pattern: /what (?:does|do)\s+(?:it|this|the document|the file)\s+(?:say|tell|show|mean)/i, reason: 'Asking what document says' },
    { pattern: /what (?:does|do)\s+(?:the\s+)?[a-z0-9_\-\s]+\s+(?:say|tell|show|mean|indicate|reveal)/i, reason: 'Asking what something says' },

    // Asking for specific information
    { pattern: /what (?:is|are)\s+(?:the\s+)?(.+?)\s+(?:revenue|profit|cost|expense|budget|forecast|projection|number|amount|total|value)/i, reason: 'Asking for specific data point' },
    { pattern: /how (?:much|many)/i, reason: 'Asking for quantitative information' },
    { pattern: /when (?:is|was|will|did|does)/i, reason: 'Asking for temporal information' },
    { pattern: /where (?:is|are|does|do|can)/i, reason: 'Asking for location information' },
    { pattern: /why (?:is|are|does|do|did)/i, reason: 'Asking for explanation' },
    { pattern: /who (?:is|are|does|do|did|was|were|has|have|had|will|would|can|could|should|approved|created|made|wrote|signed)/i, reason: 'Asking for person/entity information' },

    // Analysis requests
    { pattern: /(?:analyze|summarize|explain|describe|compare|contrast|evaluate)/i, reason: 'Requesting analysis or summary' },
    { pattern: /what (?:is|are) the (?:main|key|primary|important|significant)/i, reason: 'Asking for key points' },
    { pattern: /tell me (?:about|more about)/i, reason: 'Requesting information' },
    { pattern: /give me (?:a\s+)?(?:summary|overview|breakdown|analysis)/i, reason: 'Requesting summary' },

    // Questions with specific information needs
    { pattern: /what (?:is|are) (?:the )?(?:difference|relationship|connection|correlation)/i, reason: 'Asking for comparison or relationship' },
    { pattern: /can you (?:explain|tell|describe|clarify)/i, reason: 'Requesting explanation' },

    // "About" suffix indicates explanation request
    { pattern: /(?:what|tell me|explain).+about\s*$/i, reason: 'Query ends with "about" - wants explanation' },

    // Content-focused questions
    { pattern: /what (?:information|data|details|content)/i, reason: 'Asking for content details' },
    { pattern: /what(?:'s| is) (?:in|inside|contained)/i, reason: 'Asking about contents' },
    { pattern: /what (?:is|are) in (?:the\s+)?/i, reason: 'Asking about contents' },
  ];

  for (const { pattern, reason } of strongExplainPatterns) {
    if (pattern.test(query)) {
      return {
        intent: 'explain',
        confidence: 0.95,
        reason
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 3: MODERATE SHOW SIGNALS (confidence: 0.75-0.85)
  // ═══════════════════════════════════════════════════════════════════════════

  const moderateShowPatterns: Array<{ pattern: RegExp; reason: string }> = [
    // Polite requests to see
    { pattern: /(?:can|could|would|may)\s+(?:I|you)\s+(?:see|show|open|view)/i, reason: 'Polite request to see document' },
    { pattern: /(?:I\s+)?(?:need|want|would like)\s+to\s+(?:see|look at|review|check)/i, reason: 'Expressing need to see document' },

    // Implied show requests - only if it looks like a document name (with year, extension, or "file"/"document")
    { pattern: /^(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:20\d{2}|v\d+|file|document))?)$/i, reason: 'Document name with identifier' },
    { pattern: /^find\s+(?:me\s+)?(?:the\s+)?([A-Z][a-z]+.*)$/i, reason: 'Find request - likely wants to see result' },
    { pattern: /^get\s+(?:me\s+)?(?:the\s+)?([A-Z][a-z]+.*)$/i, reason: 'Get request - likely wants to see result' },

    // Just a filename with extension
    { pattern: /^[a-z0-9_\-\s]+\.(pdf|xlsx|docx|txt|csv|pptx|xls|doc)$/i, reason: 'Bare filename - wants to see it' },
  ];

  for (const { pattern, reason } of moderateShowPatterns) {
    const match = query.match(pattern);
    if (match) {
      return {
        intent: 'show',
        confidence: 0.80,
        reason,
        detectedFilename: match[1]?.trim()
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 4: MODERATE EXPLAIN SIGNALS (confidence: 0.75-0.85)
  // ═══════════════════════════════════════════════════════════════════════════

  const moderateExplainPatterns: Array<{ pattern: RegExp; reason: string }> = [
    // Questions with "what" but not simple "what is this"
    { pattern: /what\s+(?:is|are)\s+(?:the\s+)?(.{15,})/i, reason: 'Complex what question - likely wants explanation' },
    { pattern: /what\s+(?:does|do)\s+(?:the\s+)?(.{10,})/i, reason: 'Complex what does question - likely wants explanation' },

    // Information gathering
    { pattern: /(?:give me|provide|share)\s+(?:information|details|data)/i, reason: 'Requesting information' },
    { pattern: /(?:I\s+)?(?:need|want)\s+to\s+(?:know|understand|learn)/i, reason: 'Expressing need for information' },

    // Questions with specific metrics
    { pattern: /(?:revenue|profit|cost|expense|budget|income|sales|growth)/i, reason: 'Query mentions specific metrics' },
  ];

  for (const { pattern, reason } of moderateExplainPatterns) {
    if (pattern.test(query)) {
      return {
        intent: 'explain',
        confidence: 0.80,
        reason
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 5: FILENAME DETECTION
  // ═══════════════════════════════════════════════════════════════════════════
  // If query contains a filename-like pattern, likely wants to see the file

  const filenamePatterns = [
    /\b([a-z0-9_\-]+\.(?:pdf|xlsx|docx|txt|csv|pptx|xls|doc))\b/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:20\d{2}|Budget|Report|Analysis|Data|File))\b/,
  ];

  for (const pattern of filenamePatterns) {
    const match = query.match(pattern);
    if (match) {
      // If query is mostly just the filename, it's a show request
      const filenameLength = match[1].length;
      const queryLength = query.length;

      if (filenameLength / queryLength > 0.5) {
        return {
          intent: 'show',
          confidence: 0.85,
          reason: 'Query primarily contains filename',
          detectedFilename: match[1]
        };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 6: WORD COUNT HEURISTIC
  // ═══════════════════════════════════════════════════════════════════════════
  // Short queries (1-4 words) without question words are likely show requests

  const words = query.trim().split(/\s+/);
  const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'does', 'do', 'is', 'are'];
  const hasQuestionWord = questionWords.some(qw => lower.startsWith(qw) || lower.includes(' ' + qw + ' '));

  if (words.length <= 4 && !hasQuestionWord && !lower.endsWith('?')) {
    // Short query without question words - likely wants to see document
    return {
      intent: 'show',
      confidence: 0.70,
      reason: 'Short query without question words - likely document name'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT: EXPLAIN
  // ═══════════════════════════════════════════════════════════════════════════
  // If we can't determine intent, default to explain (safer - doesn't interrupt RAG)

  return {
    intent: 'explain',
    confidence: 0.50,
    reason: 'Unable to determine intent - defaulting to explain'
  };
}

/**
 * Check if query should trigger file preview (show intent)
 * Returns true if confidence >= 0.75
 */
export function shouldShowFile(query: string): boolean {
  const classification = classifyIntent(query);
  return classification.intent === 'show' && classification.confidence >= 0.75;
}

/**
 * Extract potential filename from query
 */
export function extractFilename(query: string): string | null {
  const classification = classifyIntent(query);
  return classification.detectedFilename || null;
}

/**
 * Get all potential document references from query
 * Useful for finding which documents the user might be referring to
 */
export function extractDocumentReferences(query: string): string[] {
  const references: string[] = [];

  // Extract explicit filenames with extensions
  const filenameMatches = query.match(/\b([a-z0-9_\-\s]+\.(?:pdf|xlsx|docx|txt|csv|pptx|xls|doc))\b/gi);
  if (filenameMatches) {
    references.push(...filenameMatches);
  }

  // Extract capitalized document-like names
  const docNameMatches = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:20\d{2}|v\d+|Budget|Report|Analysis|Data|File|Fund|Ranch|P&L))?)\b/g);
  if (docNameMatches) {
    references.push(...docNameMatches.filter(m => m.length > 3));
  }

  return Array.from(new Set(references)); // Remove duplicates
}

export default {
  classifyIntent,
  shouldShowFile,
  extractFilename,
  extractDocumentReferences
};
