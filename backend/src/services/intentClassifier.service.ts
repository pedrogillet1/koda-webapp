/**
 * Intent Classifier Service
 * Detects query intent for Issue #2 (Document Question Comprehension)
 */

import { QueryIntent, ClassifiedQuery } from '../types/rag.types';
import { extractDocumentName, extractFolderName } from '../utils/rag.utils';

class IntentClassifierService {
  /**
   * Classify query intent
   * Returns the detected intent and extracted entities
   */
  async classifyIntent(query: string): Promise<ClassifiedQuery> {
    const normalizedQuery = query.toLowerCase().trim();

    // Check each intent type in order of specificity

    // 1. Location Query: "where is X"
    const locationResult = this.detectLocationQuery(normalizedQuery);
    if (locationResult) {
      return locationResult;
    }

    // 2. Folder Contents Query: "what's in X"
    const folderContentsResult = this.detectFolderContentsQuery(normalizedQuery);
    if (folderContentsResult) {
      return folderContentsResult;
    }

    // 3. Hierarchy Query: "show me structure"
    const hierarchyResult = this.detectHierarchyQuery(normalizedQuery);
    if (hierarchyResult) {
      return hierarchyResult;
    }

    // 4. Document Search: "find document X"
    const documentSearchResult = this.detectDocumentSearch(normalizedQuery);
    if (documentSearchResult) {
      return documentSearchResult;
    }

    // 5. Content Query: "what does X say about Y"
    const contentQueryResult = this.detectContentQuery(normalizedQuery);
    if (contentQueryResult) {
      return contentQueryResult;
    }

    // 6. Default: General Question
    return {
      intent: QueryIntent.GENERAL_QUESTION,
      entities: {},
      confidence: 0.5
    };
  }

  /**
   * Detect location queries: "where is X"
   */
  private detectLocationQuery(query: string): ClassifiedQuery | null {
    const patterns = [
      /where\s+is\s+(?:the\s+)?(.+?)(?:\s+document|\s+file|\s+located|$)/i,
      /find\s+(?:the\s+)?location\s+of\s+(.+)/i,
      /show\s+me\s+where\s+(.+?)\s+is/i,
      /(?:the\s+)?(.+?)\s+is\s+located\s+where/i,
      /locate\s+(?:the\s+)?(.+)/i,
      /path\s+(?:to|of)\s+(?:the\s+)?(.+)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const documentName = match[1].trim();
        return {
          intent: QueryIntent.LOCATION_QUERY,
          entities: {
            documentName: documentName
          },
          confidence: 0.95
        };
      }
    }

    return null;
  }

  /**
   * Detect folder contents queries: "what's in X folder"
   */
  private detectFolderContentsQuery(query: string): ClassifiedQuery | null {
    const patterns = [
      /what(?:'s|\s+is)\s+in\s+(?:the\s+)?(.+?)(?:\s+folder|\s+category|\s+directory|$)/i,
      /show\s+me\s+(?:the\s+)?(.+?)(?:\s+folder|\s+category)/i,
      /list\s+(?:files\s+in\s+)?(?:the\s+)?(.+?)(?:\s+folder|\s+category|$)/i,
      /contents?\s+of\s+(?:the\s+)?(.+?)(?:\s+folder|\s+category|$)/i,
      /what\s+documents\s+(?:are\s+)?in\s+(?:the\s+)?(.+)/i,
      /files\s+in\s+(?:the\s+)?(.+)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const folderName = match[1].trim();
        return {
          intent: QueryIntent.FOLDER_CONTENTS_QUERY,
          entities: {
            folderName: folderName
          },
          confidence: 0.95
        };
      }
    }

    return null;
  }

  /**
   * Detect hierarchy queries: "show me my document structure"
   */
  private detectHierarchyQuery(query: string): ClassifiedQuery | null {
    const patterns = [
      /show\s+me\s+(?:my\s+)?(?:document\s+)?(?:structure|hierarchy|organization)/i,
      /how\s+are\s+my\s+(?:documents|files)\s+organized/i,
      /folder\s+(?:structure|hierarchy)/i,
      /document\s+(?:structure|hierarchy)/i,
      /list\s+all\s+(?:folders|categories)/i,
      /show\s+all\s+(?:folders|categories)/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(query)) {
        return {
          intent: QueryIntent.HIERARCHY_QUERY,
          entities: {},
          confidence: 0.9
        };
      }
    }

    return null;
  }

  /**
   * Detect document search queries: "find document X"
   */
  private detectDocumentSearch(query: string): ClassifiedQuery | null {
    const patterns = [
      /find\s+(?:the\s+)?(?:document|file)\s+(?:called|named)\s+(.+)/i,
      /search\s+for\s+(?:the\s+)?(?:document|file)\s+(.+)/i,
      /look\s+for\s+(?:the\s+)?(?:document|file)\s+(.+)/i,
      /do\s+I\s+have\s+(?:a\s+)?(?:document|file)\s+(?:called|named)\s+(.+)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const documentName = match[1].trim();
        return {
          intent: QueryIntent.DOCUMENT_SEARCH,
          entities: {
            documentName: documentName
          },
          confidence: 0.9
        };
      }
    }

    return null;
  }

  /**
   * Detect content queries: "what does X say about Y"
   */
  private detectContentQuery(query: string): ClassifiedQuery | null {
    const contentPatterns = [
      /what\s+(?:does|is)\s+(?:the\s+)?(.+?)\s+(?:say|mention|state|include)\s+about/i,
      /tell\s+me\s+about\s+(.+?)\s+in\s+(?:the\s+)?(.+)/i,
      /(?:explain|describe|summarize)\s+(.+)/i,
      /what\s+are\s+the\s+(.+?)\s+in\s+(.+)/i
    ];

    for (const pattern of contentPatterns) {
      const match = query.match(pattern);
      if (match) {
        // Extract document name if present
        const documentName = match[2] || extractDocumentName(query);

        return {
          intent: QueryIntent.CONTENT_QUERY,
          entities: {
            documentName: documentName || undefined
          },
          confidence: 0.8
        };
      }
    }

    return null;
  }

  /**
   * Get a human-readable description of the intent
   */
  getIntentDescription(intent: QueryIntent): string {
    switch (intent) {
      case QueryIntent.LOCATION_QUERY:
        return 'User is asking where a document is located';
      case QueryIntent.FOLDER_CONTENTS_QUERY:
        return 'User is asking what documents are in a folder';
      case QueryIntent.HIERARCHY_QUERY:
        return 'User is asking about document organization';
      case QueryIntent.DOCUMENT_SEARCH:
        return 'User is searching for a specific document';
      case QueryIntent.CONTENT_QUERY:
        return 'User is asking about document content';
      case QueryIntent.GENERAL_QUESTION:
        return 'General question';
      default:
        return 'Unknown intent';
    }
  }

  /**
   * Check if query should be handled by specialized handler
   */
  requiresSpecializedHandler(intent: QueryIntent): boolean {
    return [
      QueryIntent.LOCATION_QUERY,
      QueryIntent.FOLDER_CONTENTS_QUERY,
      QueryIntent.HIERARCHY_QUERY
    ].includes(intent);
  }
}

export default new IntentClassifierService();
