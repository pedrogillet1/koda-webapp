/**
 * Query Parser Service
 * Detects user intent and extracts entities from queries
 * Handles folder-specific queries like "What's in folder EOY F3?"
 */

export enum QueryIntent {
  FOLDER_LIST = 'folder_list',       // "What's in folder X?"
  FOLDER_SEARCH = 'folder_search',   // "Find Y in folder X"
  FOLDER_SUMMARY = 'folder_summary', // "Summarize folder X"
  DOCUMENT_QUERY = 'document_query', // "What does doc X say?"
  GENERAL_SEARCH = 'general_search'  // "Find information about Y"
}

export interface ParsedQuery {
  intent: QueryIntent;
  folderName?: string;
  folderId?: string;
  searchTerm?: string;
  documentName?: string;
  originalQuery: string;
}

export class QueryParserService {

  /**
   * Parse user query to detect intent and extract entities
   */
  parse(query: string): ParsedQuery {
    const lowerQuery = query.toLowerCase().trim();

    // Pattern 1: "What's in folder X?" / "Show folder X contents"
    const folderListPatterns = [
      /(?:what(?:'s| is)|show|list|display)\s+(?:in|inside|within)\s+(?:folder|the folder)\s+([^\?]+)/i,
      /(?:contents? of|files in)\s+(?:folder\s+)?([^\?]+)/i,
      /folder\s+([^\?]+)\s+(?:contains|has|includes)/i,
      /show\s+(?:me\s+)?(?:folder\s+)?([^\?]+)/i,
    ];

    for (const pattern of folderListPatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          intent: QueryIntent.FOLDER_LIST,
          folderName: match[1].trim(),
          originalQuery: query
        };
      }
    }

    // Pattern 2: "Find X in folder Y" / "Search folder Y for X"
    const folderSearchPatterns = [
      /(?:find|search|look for)\s+(.+?)\s+(?:in|within)\s+(?:folder\s+)?([^\?]+)/i,
      /(?:search|look in)\s+(?:folder\s+)?([^\?]+)\s+for\s+(.+)/i,
    ];

    for (const pattern of folderSearchPatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          intent: QueryIntent.FOLDER_SEARCH,
          searchTerm: match[1].trim(),
          folderName: match[2].trim(),
          originalQuery: query
        };
      }
    }

    // Pattern 3: "Summarize folder X" / "Overview of folder X"
    const folderSummaryPatterns = [
      /(?:summarize|overview of|summary of)\s+(?:folder\s+)?([^\?]+)/i,
    ];

    for (const pattern of folderSummaryPatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          intent: QueryIntent.FOLDER_SUMMARY,
          folderName: match[1].trim(),
          originalQuery: query
        };
      }
    }

    // Default: general search
    return {
      intent: QueryIntent.GENERAL_SEARCH,
      originalQuery: query
    };
  }

  /**
   * Check if query mentions a folder
   */
  mentionsFolder(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return lowerQuery.includes('folder') ||
           lowerQuery.includes('directory') ||
           /in\s+\w+/.test(lowerQuery);
  }

  /**
   * Extract folder name from query if present
   */
  extractFolderName(query: string): string | null {
    const parsed = this.parse(query);
    return parsed.folderName || null;
  }
}

// Export singleton instance
export default new QueryParserService();
