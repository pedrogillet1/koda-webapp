/**
 * Query Intent Detection Service
 *
 * NEW ARCHITECTURE (Psychological Goals):
 * - Simplified 5-goal detection based on user psychology
 * - Replaces 8-intent hardcoded system with adaptive approach
 * - Use detectPsychologicalGoal() for new code
 *
 * OLD ARCHITECTURE (Intents):
 * - Legacy 8-intent system kept for backwards compatibility
 * - Use detectIntent() only for legacy code
 *
 * Psychological Goals:
 * - fast_answer: Factual retrieval ("What is X?")
 * - mastery: Instructional/How-to ("How do I...?")
 * - clarity: Analytical/Comparison ("Compare X and Y")
 * - insight: Interpretative/Judgment ("What are the key risks?")
 * - control: Contextual/Search-Across ("Show me all files...")
 */

import { Intent, IntentResult } from '../../types/intent.types';

// NEW: Psychological Goals (simplified 5-goal system)
export type PsychologicalGoal =
  | 'fast_answer'      // Factual retrieval
  | 'mastery'          // How-to / instructional
  | 'clarity'          // Comparison / analytical
  | 'insight'          // Interpretative / judgment
  | 'control';         // Search-across / comprehensive

export interface PsychologicalGoalResult {
  goal: PsychologicalGoal;
  confidence: number;
  reasoning: string;
}

// NEW: Metadata Query Detection (for database queries, not RAG)
export type MetadataQueryType =
  | 'file_location'     // "where is X", "where can I find X"
  | 'file_count'        // "how many files", "file count"
  | 'folder_contents'   // "what's in folder X", "show me folder X"
  | 'list_all_files'    // "show me all files", "list all documents"
  | 'list_folders'      // "which folders do i have", "list folders"
  | 'none';             // Not a metadata query

export interface MetadataQueryResult {
  isMetadataQuery: boolean;
  type: MetadataQueryType;
  extractedValue?: string; // e.g., filename, folder name
  confidence: number;
}

// OLD: Legacy intent system (deprecated)
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
   * NEW: Detect psychological goal (simplified 5-goal system)
   * Use this method for all new code
   *
   * This replaces the complex 8-intent system with a simple, flexible approach
   * that focuses on what the user NEEDS, not rigid query patterns.
   */
  detectPsychologicalGoal(query: string): PsychologicalGoalResult {
    const queryLower = query.toLowerCase().trim();

    // 1. CONTROL: Search-across / comprehensive list queries
    // User needs to see EVERYTHING to feel in control (no fear of missing something)
    if (/^(show me all|list all|list every|find all|all|every|which files|which documents|what files|what documents)/i.test(query)) {
      return {
        goal: 'control',
        confidence: 0.95,
        reasoning: 'User wants comprehensive list to ensure nothing is missed',
      };
    }

    // 2. CLARITY: Comparison / analytical queries
    // User needs to understand differences and similarities
    if (/compare|difference|vs|versus|how does .* differ|what's different|similar/i.test(query)) {
      return {
        goal: 'clarity',
        confidence: 0.95,
        reasoning: 'User wants clear comparison to understand differences',
      };
    }

    // 3. MASTERY: How-to / instructional queries
    // User needs step-by-step guidance to accomplish a task
    if (/^how (do|to|can)/i.test(query)) {
      return {
        goal: 'mastery',
        confidence: 0.95,
        reasoning: 'User wants step-by-step instructions to accomplish task',
      };
    }

    // 4. INSIGHT: Interpretative / judgment queries
    // User needs YOUR analysis and judgment, not just facts
    if (/what (is|are) the (main|key|primary|most important)|risk|should|recommend|important|strategy|plan|approach/i.test(query)) {
      return {
        goal: 'insight',
        confidence: 0.90,
        reasoning: 'User wants analysis and judgment, not just facts',
      };
    }

    // 5. FAST ANSWER: Direct factual queries (DEFAULT)
    // User needs quick, direct information with minimal friction
    // This is the default because most queries are asking for specific facts
    if (/^(what is|what's|when|where|who|which|what)\s/i.test(query)) {
      return {
        goal: 'fast_answer',
        confidence: 0.85,
        reasoning: 'User wants quick, direct factual answer',
      };
    }

    // Fallback: If no pattern matches, default to fast_answer
    // (most queries are asking for information)
    return {
      goal: 'fast_answer',
      confidence: 0.70,
      reasoning: 'Default to factual retrieval for unmatched queries',
    };
  }

  /**
   * NEW: Detect metadata query (database lookup, not RAG)
   *
   * Metadata queries ask about file locations, counts, or folder contents.
   * These should NOT use RAG/Pinecone - they should query the database directly.
   *
   * This prevents hallucination where RAG returns wrong files because it's doing
   * semantic search instead of exact metadata lookup.
   *
   * Examples:
   * - "where is comprovante1" → file_location (query database for filename)
   * - "how many files do I have" → file_count (query database for count)
   * - "what files are in the pedro1 folder" → folder_contents (query database for folder)
   */
  detectMetadataQuery(query: string): MetadataQueryResult {
    const queryLower = query.toLowerCase().trim();

    // Pattern 1: File location queries
    // "where is X", "where can I find X", "location of X"
    const locationPatterns = [
      /where is (.+)/i,
      /where can i find (.+)/i,
      /location of (.+)/i,
      /find (.+) file/i,
      /which folder (?:has|contains) (.+)/i,
    ];

    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match) {
        let extractedValue = match[1].trim();

        // NEW: Clean up extracted filename
        // Remove common articles and descriptors
        extractedValue = extractedValue
          .replace(/^(?:the|a|an)\s+/i, '')  // Remove "the", "a", "an" at start
          .replace(/\s+(?:file|document|pdf|docx|xlsx|pptx)$/i, '');  // Remove file type at end

        return {
          isMetadataQuery: true,
          type: 'file_location',
          extractedValue: extractedValue,
          confidence: 0.95,
        };
      }
    }

    // Pattern 2: File count queries
    // "how many files", "file count", "total files"
    const countPatterns = [
      /how many (files|documents)/i,
      /(file|document) count/i,
      /total (files|documents)/i,
      /number of (files|documents)/i,
    ];

    for (const pattern of countPatterns) {
      if (pattern.test(query)) {
        return {
          isMetadataQuery: true,
          type: 'file_count',
          confidence: 0.95,
        };
      }
    }

    // Pattern 2.5: File type queries (NEW - Fix #3)
    // "what file types", "what types of files", "file formats"
    const fileTypePatterns = [
      /what (?:file )?types?/i,
      /what (?:types? of |kinds? of )?(?:files|documents)/i,
      /(?:file|document) (?:types?|formats?|extensions?)/i,
      /which (?:file|document) (?:types?|formats?)/i,
    ];

    for (const pattern of fileTypePatterns) {
      if (pattern.test(query)) {
        return {
          isMetadataQuery: true,
          type: 'file_type' as any,
          confidence: 0.95,
        };
      }
    }

    // Pattern 3: folders contents queries
    // "what is inside X folder", "show me X folder", "what files are in X"
    const folderContentPatterns = [
      // Original patterns
      /what (?:is|are) (?:inside|in) (.+?) folder/i,
      /show me (?:the )?(.+?) folder/i,
      /what files are in (.+)/i,
      /contents of (.+?) folder/i,
      /list (?:files in |everything in )?(.+?) folder/i,

      // NEW patterns for "which document/files are inside X"
      /which (?:document|documents|file|files) (?:are|is) (?:inside|in) (.+)/i,
      /which (?:document|documents|file|files) (?:are|is) (?:in|inside) (?:the )?(.+?) folder/i,
      /what (?:document|documents) (?:are|is) in (.+)/i,
      /what (?:document|documents) (?:are|is) inside (.+)/i,
    ];

    for (const pattern of folderContentPatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          isMetadataQuery: true,
          type: 'folder_contents',
          extractedValue: match[1].trim(),
          confidence: 0.95,
        };
      }
    }

    // Pattern 4: List all files queries
    // "show me all files", "list all documents"
    const listAllPatterns = [
      /show me all (files|documents)/i,
      /list all (files|documents)/i,
      /what files do i have/i,
      /what documents do i have/i,
    ];

    for (const pattern of listAllPatterns) {
      if (pattern.test(query)) {
        return {
          isMetadataQuery: true,
          type: 'list_all_files',
          confidence: 0.90,
        };
      }
    }

    // Pattern 5: List folders queries (NEW)
    // "which folders do i have", "what folders", "list all folders"
    const listFoldersPatterns = [
      /which folders (?:do i have|are there)/i,
      /what folders (?:do i have|are there|exist)/i,
      /list (?:all )?(?:my )?folders/i,
      /show me (?:all )?(?:my )?folders/i,
      /how many folders/i,
      /what are the names of (?:the |my )?folders/i,
      /what are (?:all )?(?:the |my )?folder names/i,
    ];

    for (const pattern of listFoldersPatterns) {
      if (pattern.test(query)) {
        return {
          isMetadataQuery: true,
          type: 'list_folders',
          confidence: 0.95,
        };
      }
    }

    // Not a metadata query - use RAG for content-based search
    return {
      isMetadataQuery: false,
      type: 'none',
      confidence: 0,
    };
  }

  /**
   * Map old intent to psychological goal
   * Used for backwards compatibility and migration
   */
  mapIntentToGoal(intent: QueryIntent | Intent): PsychologicalGoal {
    switch (intent) {
      case 'extract':
      case 'capability':
        return 'fast_answer';
      // @ts-ignore - simplified intent type

      case 'search': // was 'how_to', 'analyze', 'search_mentions'
      case 'compare':
        return 'clarity';

      case 'summarize':
        return 'insight';

      case 'list':
      case 'locate':
        return 'control';

      case 'greeting':
        return 'fast_answer'; // Greetings get fast, friendly responses

      default:
        return 'fast_answer';
    }
  }

  /**
   * DEPRECATED: Detect the intent of a user query
   * This is the OLD method - kept for backwards compatibility only
   * Use detectPsychologicalGoal() for new code
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
      { pattern: /(?:which|what|why) (?:type|types|kind|kinds) (?:of )?(?:files|documents)/i, action: 'List file types' },
      { pattern: /(?:which|what|why) (?:files|documents|pdfs?|docx?|excel|powerpoint)/i, action: 'List specific file types' },

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
        // Detect document type from query (check for plural forms too)
           // @ts-ignore - documentType stub
        let searchQuery: string | undefined = undefined;
        if (/presentations?|pptx?|powerpoint|slides?/i.test(queryLower)) {
           // @ts-ignore - documentType stub
          documentType = 'presentation';
        } else if (/spreadsheets?|excel|xlsx?/i.test(queryLower)) {
           // @ts-ignore - documentType stub
          documentType = 'spreadsheet';
        } else if (/documents?|docx?|word|pdfs?/i.test(queryLower)) {
          // @ts-ignore - documentType stub
          documentType = 'document';
        }

        return {
          intent: 'compare',
          confidence: 0.95,
             // @ts-ignore - documentType stub
          reasoning: 'Query is asking to compare information across documents',
          suggestedAction: action,
          entities: {
            // @ts-ignore - documentType stub
            searchQuery: documentType as any  // Will be undefined if not detected (not null)
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
