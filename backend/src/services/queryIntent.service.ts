/**
 * Query Intent Detection Service
 * Detects whether a query is asking for metadata (file lists, categories)
 * or content (information from documents)
 */

export type QueryIntent = 'metadata' | 'content' | 'capability';

export interface IntentDetectionResult {
  intent: QueryIntent;
  confidence: number;
  reasoning: string;
  suggestedAction: string;
}

class QueryIntentService {
  /**
   * Detect the intent of a user query
   */
  detectIntent(query: string): IntentDetectionResult {
    const queryLower = query.toLowerCase().trim();

    // 1. METADATA QUERIES - User wants file lists, categories, folder contents
    const metadataPatterns = [
      { pattern: /what(?:'s| is) (?:inside|in) (?:category|folder|the category|the folder)/i, action: 'List files in category/folder' },
      { pattern: /list (?:all )?(?:files|documents|categories|folders)/i, action: 'List files/categories' },
      { pattern: /which (?:files|documents|docx|excel|pdf|powerpoint)/i, action: 'List specific file types' },
      { pattern: /show (?:me )?(?:all )?(?:files|documents|categories)/i, action: 'Display file list' },
      { pattern: /(?:files|documents) (?:inside|in) (?:category|folder)/i, action: 'List files in location' },
      { pattern: /what (?:files|documents) (?:do i have|are there)/i, action: 'List user files' },
      { pattern: /how many (?:files|documents|categories)/i, action: 'Count files/categories' },
    ];

    for (const { pattern, action } of metadataPatterns) {
      if (pattern.test(queryLower)) {
        return {
          intent: 'metadata',
          confidence: 0.95,
          reasoning: 'Query is asking about file organization, categories, or lists',
          suggestedAction: action
        };
      }
    }

    // 2. CAPABILITY QUERIES - User asking about KODA itself
    const capabilityPatterns = [
      /what is koda/i,
      /what can koda do/i,
      /koda capabilities/i,
      /how does koda work/i,
      /koda features/i,
      /tell me about koda/i,
    ];

    for (const pattern of capabilityPatterns) {
      if (pattern.test(queryLower)) {
        return {
          intent: 'capability',
          confidence: 0.98,
          reasoning: 'Query is asking about KODA system capabilities',
          suggestedAction: 'Search for KODA documentation in documents'
        };
      }
    }

    // 3. CONTENT QUERIES - User wants information FROM documents (default)
    return {
      intent: 'content',
      confidence: 0.85,
      reasoning: 'Query appears to be asking for information from document content',
      suggestedAction: 'Use RAG to retrieve relevant document content'
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
   * Check if query is asking for specific file types
   */
  extractFileTypes(query: string): string[] {
    const fileTypeMap: { [key: string]: string } = {
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'pdf': 'application/pdf',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'powerpoint': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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
