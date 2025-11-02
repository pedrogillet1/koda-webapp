/**
 * Query Intent Detection Service
 * Detects the user's intent to provide appropriate response behavior
 * Based on Koda AI Behavioral Definition - Issue #4 Enhancement
 *
 * Intent Types:
 * - list: User wants a list of files, categories, or items
 * - locate: User wants to find where a specific file/document is stored
 * - summarize: User wants a summary of document(s)
 * - compare: User wants to compare information across documents
 * - extract: User wants specific data/facts extracted from documents
 * - navigation: User wants to navigate to a folder/category
 * - capability: User is asking about Koda's features
 */

import { Intent, IntentResult } from '../types/intent.types';

export type QueryIntent = 'list' | 'locate' | 'summarize' | 'compare' | 'extract' | 'navigation' | 'capability' | 'greeting';

export interface IntentDetectionResult {
  intent: QueryIntent | Intent;
  confidence: number;
  reasoning: string;
  suggestedAction: string;
  entities: {
    documentName?: string;
    folderName?: string;
    targetName?: string;
    searchQuery?: string;
    cellReference?: string;
    sheetName?: string;
    compareTargets?: string[];
    renamePattern?: string;
  };
}

class QueryIntentService {
  /**
   * Detect the intent of a user query
   */
  detectIntent(query: string): IntentDetectionResult {
    const queryLower = query.toLowerCase().trim();

    // 0. GREETING QUERIES - User is being conversational (hi, hello, how are you, etc.)
    const greetingPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|yo)$/i,
      /^(hi|hello|hey)\s+(there|koda|friend)$/i,
      /^how are you(\s+doing)?(\?)?$/i,
      /^what'?s up(\?)?$/i,
      /^how'?s it going(\?)?$/i,
      /^(thanks|thank you|thx)$/i,
      /^(bye|goodbye|see you|cya|later)$/i,
    ];

    for (const pattern of greetingPatterns) {
      if (pattern.test(queryLower)) {
        return {
          intent: 'greeting',
          confidence: 0.99,
          reasoning: 'User is greeting or having casual conversation',
          suggestedAction: 'Respond naturally with a friendly greeting',
          entities: {}
        };
      }
    }

    // 1. CAPABILITY QUERIES - User asking about KODA as a product/system
    // Check this first before other patterns
    const hasPossessiveOrBusiness = /koda'?s\s+|koda\s+(icp|business|market|customer|target|revenue|pricing|strategy|plan|model)/i;

    if (!hasPossessiveOrBusiness.test(queryLower)) {
      const capabilityPatterns = [
        /^what is koda\??$/i,
        /^what'?s koda\??$/i,
        /^what can koda do\??$/i,
        /^how does koda work\??$/i,
        /^tell me about koda\??$/i,
        /^explain koda$/i,
      ];

      for (const pattern of capabilityPatterns) {
        if (pattern.test(queryLower)) {
          return {
            intent: 'capability',
            confidence: 0.98,
            reasoning: 'Query is asking about KODA system capabilities',
            suggestedAction: 'Search for KODA documentation in documents',
            entities: {}
          };
        }
      }
    }

    // 2. CONTENT-BASED QUERIES - User wants files based on CONTENT, not just listing
    // Check this BEFORE list patterns to avoid misclassification
    const contentKeywords = [
      'talk about',
      'talking about',
      'discuss',
      'discusses',
      'discussing',
      'mention',
      'mentions',
      'mentioning',
      'contain',
      'contains',
      'containing',
      'information about',
      'info about',
      'details about',
      'data about',
      'content about',
      'relate to',
      'related to',
      'relating to',
      'regarding',
      'concerning',
      'about',  // "files about X"
      'on the topic',
      'on the subject',
      'cover',
      'covers',
      'covering',
      'deal with',
      'deals with',
      'describe',
      'describes',
      'explaining',
      'explain'
    ];

    // Check if query contains content-related keywords
    const hasContentKeyword = contentKeywords.some(keyword => queryLower.includes(keyword));

    if (hasContentKeyword) {
      return {
        intent: 'extract',
        confidence: 0.95,
        reasoning: 'Query is asking for files based on document content (semantic search needed)',
        suggestedAction: 'Use RAG semantic search to find relevant documents',
        entities: {}
      };
    }

    // 3. LIST QUERIES - User wants a list of files, categories, items
    const listPatterns = [
      { pattern: /(?:list|show|display) (?:all )?(?:files|documents|categories|folders)/i, action: 'List files/categories' },
      { pattern: /what (?:files|documents) (?:do i have|are there)/i, action: 'List user files' },
      { pattern: /(?:do i have|have i got) (?:any )?(?:files|documents)/i, action: 'List user files' },
      { pattern: /(?:which|what) (?:files|documents|pdfs?|docx?|excel|powerpoint)/i, action: 'List specific file types' },

      // NEW: Detect "what is inside [folder name]" or "what files are in [folder name]"
      { pattern: /what(?:'s| is) (?:inside|in) (?:the )?([a-zA-Z0-9_-]+) folder/i, action: 'List folder contents' },
      { pattern: /what (?:files|documents) (?:are )?(?:inside|in) (?:the )?([a-zA-Z0-9_-]+) folder/i, action: 'List folder contents' },
      { pattern: /(?:show|list) (?:me )?(?:files|documents|contents) (?:in|inside) (?:the )?([a-zA-Z0-9_-]+) folder/i, action: 'List folder contents' },
      { pattern: /(?:files|documents|contents) (?:inside|in) (?:the )?([a-zA-Z0-9_-]+) folder/i, action: 'List folder contents' },

      // Pattern for "what's inside the folder" WITHOUT folder name - should ask which folder
      { pattern: /^what(?:'s| is) (?:inside|in) (?:the )?folder\??$/i, action: 'Ask which folder' },
      { pattern: /what(?:'s| is) (?:inside|in) (?:category|folder|the category|the folder) /i, action: 'List folder contents' },
      { pattern: /(?:files|documents) (?:inside|in) (?:category|folder)/i, action: 'List files in location' },
      { pattern: /how many (?:files|documents|categories)/i, action: 'Count and list items' },
      { pattern: /give me (?:a )?list of/i, action: 'Provide list' },
    ];

    for (const { pattern, action } of listPatterns) {
      if (pattern.test(queryLower)) {
        // Extract folder name if present (from new patterns)
        const folderMatch = queryLower.match(/(?:inside|in) (?:the )?([a-zA-Z0-9_-]+) folder/i);
        const folderName = folderMatch ? folderMatch[1] : null;

        return {
          intent: 'list',
          confidence: 0.95,
          reasoning: 'Query is requesting a list of files, categories, or items',
          suggestedAction: action,
          entities: { folderName }  // Include folder name in entities
        };
      }
    }

    // 4. LOCATE QUERIES - User wants to find WHERE a specific file/document is
    const locatePatterns = [
      { pattern: /where is (?:the |my )?(?:file|document|folder)/i, action: 'Locate file or folder' },
      { pattern: /find (?:the location of|where is) (?:the |my )?(?:file|document)/i, action: 'Find file location' },
      { pattern: /show me (?:where|the location of)/i, action: 'Show file/folder location' },
      { pattern: /(?:what folder|which folder|which category|what location).*(?:is|contains|stored)/i, action: 'Identify storage location' },
      { pattern: /locate (?:the |my )?(?:file|document)/i, action: 'Locate document' },
      { pattern: /in (?:what|which) (?:folder|category)/i, action: 'Find file location' },
    ];

    for (const { pattern, action } of locatePatterns) {
      if (pattern.test(queryLower)) {
        return {
          intent: 'locate',
          confidence: 0.95,
          reasoning: 'Query is asking to locate or find where a file/document is stored',
          suggestedAction: action,
          entities: {}
        };
      }
    }

    // 5. NAVIGATION QUERIES - User wants to OPEN/GO TO a folder/category
    const navigationPatterns = [
      { pattern: /(?:open|go to|take me to) (?:the |my )?(?:folder|category)/i, action: 'Navigate to folder' },
      { pattern: /show me (?:the |my )?(?:folder|category)/i, action: 'Open folder view' },
    ];

    for (const { pattern, action } of navigationPatterns) {
      if (pattern.test(queryLower)) {
        return {
          intent: 'navigation',
          confidence: 0.95,
          reasoning: 'Query is asking to navigate to or open a folder/category',
          suggestedAction: action,
          entities: {}
        };
      }
    }

    // 6. SUMMARIZE QUERIES - User wants a summary of document(s)
    const summarizePatterns = [
      { pattern: /(?:summarize|summary of|give me a summary)/i, action: 'Summarize document content' },
      { pattern: /(?:what'?s|what is) (?:the |this |that )?(?:document|file|pdf) about/i, action: 'Provide document summary' },
      { pattern: /(?:overview|high-level|key points|main points)/i, action: 'Provide overview' },
      { pattern: /(?:tldr|tl;dr)/i, action: 'Provide TLDR summary' },
      { pattern: /in (?:brief|short|summary)/i, action: 'Provide brief summary' },
    ];

    for (const { pattern, action } of summarizePatterns) {
      if (pattern.test(queryLower)) {
        return {
          intent: 'summarize',
          confidence: 0.95,
          reasoning: 'Query is asking for a summary or overview of document(s)',
          suggestedAction: action,
          entities: {}
        };
      }
    }

    // 7. COMPARE QUERIES - User wants to compare information across documents
    const comparePatterns = [
      { pattern: /compare (?:the |these )?(?:documents|files|plans|proposals)/i, action: 'Compare documents' },
      { pattern: /(?:difference|differences) between/i, action: 'Identify differences' },
      { pattern: /(?:what'?s|what is) (?:different|similar) (?:between|in)/i, action: 'Compare and contrast' },
      { pattern: /how (?:do|does) .* (?:compare|differ)/i, action: 'Perform comparison' },
      { pattern: /(?:versus|vs\.?|compared to)/i, action: 'Compare entities' },
    ];

    for (const { pattern, action } of comparePatterns) {
      if (pattern.test(queryLower)) {
        // Detect document type from query
        let documentType = null;
        if (/presentation/i.test(queryLower)) {
          documentType = 'presentation';
        } else if (/spreadsheet|excel/i.test(queryLower)) {
          documentType = 'spreadsheet';
        } else if (/word|document/i.test(queryLower)) {
          documentType = 'document';
        }

        return {
          intent: 'compare',
          confidence: 0.95,
          reasoning: 'Query is asking to compare information across documents',
          suggestedAction: action,
          entities: {
            documentType  // Add document type to entities
          }
        };
      }
    }

    // 8. EXTRACT QUERIES - User wants specific data/facts extracted
    const extractPatterns = [
      { pattern: /(?:extract|pull out|get) (?:the |all )?(?:data|numbers|figures|dates|names)/i, action: 'Extract specific data' },
      { pattern: /(?:what is|what'?s|find) the (?:revenue|cost|price|date|number|amount)/i, action: 'Extract specific value' },
      { pattern: /(?:how much|how many)/i, action: 'Extract quantitative data' },
      { pattern: /(?:when|what time|what date)/i, action: 'Extract temporal data' },
      { pattern: /(?:who|which|what) (?:is|are|was|were)/i, action: 'Extract factual data' },
      { pattern: /give me (?:all |the )?(?:details|info|information|data) (?:about|on|for)/i, action: 'Extract detailed information' },
    ];

    for (const { pattern, action } of extractPatterns) {
      if (pattern.test(queryLower)) {
        return {
          intent: 'extract',
          confidence: 0.90,
          reasoning: 'Query is asking to extract specific data or facts from documents',
          suggestedAction: action,
          entities: {}
        };
      }
    }

    // 9. DEFAULT: EXTRACT (most queries are asking for information)
    // If none of the above match, assume user wants to extract information from documents
    return {
      intent: 'extract',
      confidence: 0.75,
      reasoning: 'Query appears to be asking for information from document content',
      suggestedAction: 'Use RAG to retrieve and extract relevant content',
      entities: {}
    };
  }

  /**
   * Check if query is asking about a specific category
   */
  extractCategoryName(query: string): string | null {
    const categoryPatterns = [
      /(?:inside|in) category (?:["'])?([a-zA-Z0-9\s]+)(?:["'])?/i,
      /category (?:["'])?([a-zA-Z0-9\s]+)(?:["'])?/i,
    ];

    for (const pattern of categoryPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Check if query is asking about a specific folder
   */
  extractFolderName(query: string): string | null {
    const folderPatterns = [
      /(?:inside|in) folder (?:["'])?([a-zA-Z0-9\s]+)(?:["'])?/i,
      /folder (?:["'])?([a-zA-Z0-9\s]+)(?:["'])?/i,
    ];

    for (const pattern of folderPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract file name from navigation query
   */
  extractFileName(query: string): string | null {
    const filePatterns = [
      /(?:where is|find|locate|show me|open) (?:the |my )?(?:file|document) (?:called |named )?["']?([^"'?]+)["']?/i,
      /(?:where is|find|locate|show me|open) ["']?([^"'?]+\.(?:pdf|docx?|xlsx?|pptx?|txt|csv))["']?/i,
    ];

    for (const pattern of filePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Check if query is asking for specific file types
   */
  extractFileTypes(query: string): string[] {
    const fileTypeMap: { [key: string]: string } = {
      'word': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'pdf': 'application/pdf',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'powerpoint': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'presentations': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'ppt': 'application/vnd.ms-powerpoint',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };

    const queryLower = query.toLowerCase();
    const foundTypes: string[] = [];

    for (const [keyword, mimeType] of Object.entries(fileTypeMap)) {
      if (queryLower.includes(keyword)) {
        foundTypes.push(mimeType);
      }
    }

    return foundTypes;
  }
}

export default new QueryIntentService();
export { QueryIntentService };
