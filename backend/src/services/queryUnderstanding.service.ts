/**
 * QUERY UNDERSTANDING SERVICE - KODA ARCHITECTURAL REDESIGN
 *
 * REPLACES: chatActions.service.ts, intentClassification.service.ts, queryIntentDetector.service.ts
 *
 * SINGLE SOURCE OF TRUTH for query understanding with:
 * - Comprehensive intent classification (15 distinct intents, no overlaps)
 * - Entity extraction (document names, folders, search terms)
 * - Format determination (table, list, paragraph, structured)
 * - Retrieval strategy selection (precision, recall, multi-document, diverse)
 * - Handler routing (meta, file action, metadata, content, social)
 *
 * This service prevents cascading failures by providing ONE unified understanding
 * that all downstream services consume.
 */

import prisma from '../config/database';

// ===== COMPREHENSIVE INTENT TAXONOMY (15 INTENTS, NO OVERLAPS) =====

export enum QueryIntent {
  // Meta Queries (about KODA itself)
  META_CAPABILITIES = 'meta_capabilities', // "what can you do", "how do you work"

  // File Management Actions
  FILE_CREATE = 'file_create', // "create folder X", "make a new file"
  FILE_DELETE = 'file_delete', // "delete file X", "remove folder Y"
  FILE_RENAME = 'file_rename', // "rename X to Y"
  FILE_MOVE = 'file_move', // "move X to folder Y"
  FILE_UNDO = 'file_undo', // "undo last action"
  FILE_REDO = 'file_redo', // "redo"

  // Metadata Queries (about documents, not content)
  METADATA_COUNT = 'metadata_count', // "how many files", "list all documents"
  METADATA_SEARCH = 'metadata_search', // "find files with name X", "documents uploaded today"

  // Content Queries (about document content)
  CONTENT_COMPARISON = 'content_comparison', // "compare X and Y", "differences between A and B"
  CONTENT_FACTUAL = 'content_factual', // "what is X", "how many Y in document Z"
  CONTENT_SUMMARY = 'content_summary', // "summarize X", "overview of Y"
  CONTENT_ANALYSIS = 'content_analysis', // "analyze X", "why does Y", "explain Z"

  // Social/Conversational
  SOCIAL_GREETING = 'social_greeting', // "hello", "thanks", "goodbye"

  // Unclear/Ambiguous
  CLARIFICATION_NEEDED = 'clarification_needed', // Cannot determine intent
}

// ===== RESPONSE FORMAT TYPES =====

export enum ResponseFormat {
  TABLE = 'table', // Markdown table with borders
  LIST = 'list', // Bullet points or numbered list
  PARAGRAPH = 'paragraph', // Natural prose
  STRUCTURED = 'structured', // Sections with headers
}

// ===== RETRIEVAL STRATEGY TYPES =====

export enum RetrievalStrategy {
  NONE = 'none', // No retrieval needed (meta, file actions, social)
  PRECISION = 'precision', // Few highly relevant chunks (factual queries)
  RECALL = 'recall', // Many chunks to ensure coverage (analysis)
  MULTI_DOCUMENT = 'multi_document', // Retrieve from multiple specific documents (comparisons)
  DIVERSE = 'diverse', // Spread across document for overview (summaries)
  METADATA_ONLY = 'metadata_only', // Just document metadata (counts, lists)
}

// ===== HANDLER TYPES =====

export enum HandlerType {
  META = 'meta', // Return built-in KODA capabilities
  FILE_ACTION = 'file_action', // Perform file operations
  METADATA = 'metadata', // Query document metadata
  CONTENT = 'content', // Retrieve and generate from content
  SOCIAL = 'social', // Simple conversational response
}

// ===== ENTITY EXTRACTION RESULTS =====

export interface ExtractedEntities {
  documentNames: string[]; // ["pedro 1", "lone mountain ranch excel"]
  folderNames: string[]; // ["reports", "2024"]
  searchTerms: string[]; // ["revenue", "profit margin"]
  timeReferences: string[]; // ["today", "last week", "2024"]
  actions: string[]; // ["compare", "analyze", "summarize"]
}

// ===== QUERY UNDERSTANDING OUTPUT =====

export interface QueryUnderstanding {
  // Primary classification
  intent: QueryIntent;
  confidence: number; // 0-1

  // Extracted entities
  entities: ExtractedEntities;

  // Response format
  format: ResponseFormat;

  // Retrieval strategy
  retrievalStrategy: RetrievalStrategy;
  topK: number; // Number of chunks to retrieve

  // Handler
  handler: HandlerType;

  // Context
  reasoning: string; // Why this classification
  confidenceThreshold: number; // Minimum confidence to proceed

  // Flags
  requiresRetrieval: boolean;
  requiresMultiDocument: boolean;
  requiresFuzzyMatching: boolean;
}

// ===== QUERY UNDERSTANDING SERVICE =====

class QueryUnderstandingService {
  /**
   * Main entry point: Understand a user query comprehensively
   */
  async understand(query: string, userId: string): Promise<QueryUnderstanding> {
    const queryLower = query.toLowerCase().trim();

    // Step 1: Classify intent (comprehensive, no overlaps)
    const intentResult = this.classifyIntent(queryLower);

    // Step 2: Extract entities (document names, folders, etc.)
    const entities = await this.extractEntities(query, userId, intentResult.intent);

    // Step 3: Determine response format
    const format = this.determineFormat(queryLower, intentResult.intent);

    // Step 4: Select retrieval strategy
    const retrievalStrategy = this.selectRetrievalStrategy(intentResult.intent, entities);

    // Step 5: Determine handler
    const handler = this.selectHandler(intentResult.intent);

    return {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      entities,
      format,
      retrievalStrategy: retrievalStrategy.strategy,
      topK: retrievalStrategy.topK,
      handler,
      reasoning: intentResult.reasoning,
      confidenceThreshold: this.getConfidenceThreshold(intentResult.intent),
      requiresRetrieval: retrievalStrategy.strategy !== RetrievalStrategy.NONE,
      requiresMultiDocument: retrievalStrategy.strategy === RetrievalStrategy.MULTI_DOCUMENT,
      requiresFuzzyMatching: entities.documentNames.length > 0,
    };
  }

  /**
   * Classify intent using deterministic rules (comprehensive, no overlaps)
   */
  private classifyIntent(queryLower: string): { intent: QueryIntent; confidence: number; reasoning: string } {
    // PRIORITY 1: Meta Queries (highest priority - prevent misclassification)
    const metaPatterns = [
      /what can you do/i,
      /what are you/i,
      /who are you/i,
      /how do you work/i,
      /your capabilities/i,
      /what.*you.*capable of/i,
    ];
    if (metaPatterns.some(p => p.test(queryLower))) {
      return { intent: QueryIntent.META_CAPABILITIES, confidence: 0.95, reasoning: 'Query asks about KODA capabilities' };
    }

    // PRIORITY 2: File Actions (prevent "compare" from being misclassified as file action)
    if (queryLower.includes('create folder') || queryLower.includes('make a folder') || queryLower.includes('new folder')) {
      return { intent: QueryIntent.FILE_CREATE, confidence: 0.95, reasoning: 'Query requests folder creation' };
    }
    if ((queryLower.includes('delete') || queryLower.includes('remove')) && (queryLower.includes('file') || queryLower.includes('folder'))) {
      return { intent: QueryIntent.FILE_DELETE, confidence: 0.95, reasoning: 'Query requests file/folder deletion' };
    }
    if (queryLower.includes('rename') && (queryLower.includes('to') || queryLower.includes('file') || queryLower.includes('folder'))) {
      return { intent: QueryIntent.FILE_RENAME, confidence: 0.95, reasoning: 'Query requests file/folder rename' };
    }
    if (queryLower.includes('move') && (queryLower.includes('file') || queryLower.includes('folder') || queryLower.includes('to'))) {
      return { intent: QueryIntent.FILE_MOVE, confidence: 0.95, reasoning: 'Query requests file/folder move' };
    }
    if (queryLower === 'undo' || queryLower.includes('undo last') || queryLower.includes('undo that')) {
      return { intent: QueryIntent.FILE_UNDO, confidence: 0.95, reasoning: 'Query requests undo action' };
    }
    if (queryLower === 'redo' || queryLower.includes('redo last') || queryLower.includes('redo that')) {
      return { intent: QueryIntent.FILE_REDO, confidence: 0.95, reasoning: 'Query requests redo action' };
    }

    // PRIORITY 3: Social/Conversational
    const greetings = ['hello', 'hi', 'hey', 'thanks', 'thank you', 'bye', 'goodbye', 'good morning', 'good afternoon', 'good evening'];
    if (greetings.some(g => queryLower === g || queryLower.startsWith(g + ' ') || queryLower.startsWith(g + ','))) {
      return { intent: QueryIntent.SOCIAL_GREETING, confidence: 0.95, reasoning: 'Query is a greeting or social pleasantry' };
    }

    // PRIORITY 4: Metadata Queries
    if ((queryLower.includes('how many') || queryLower.includes('count')) && (queryLower.includes('file') || queryLower.includes('document'))) {
      return { intent: QueryIntent.METADATA_COUNT, confidence: 0.9, reasoning: 'Query asks for document count' };
    }
    if ((queryLower.includes('list') || queryLower.includes('show')) && (queryLower.includes('file') || queryLower.includes('document') || queryLower.includes('all'))) {
      return { intent: QueryIntent.METADATA_COUNT, confidence: 0.9, reasoning: 'Query asks for document list' };
    }
    if ((queryLower.includes('find') || queryLower.includes('search')) && (queryLower.includes('file') || queryLower.includes('document')) && queryLower.includes('name')) {
      return { intent: QueryIntent.METADATA_SEARCH, confidence: 0.9, reasoning: 'Query searches for documents by name' };
    }

    // PRIORITY 5: Content Comparison (CRITICAL - must be BEFORE other content intents)
    const comparisonPatterns = [
      /compare\s+(.+?)\s+(and|with|to|vs\.?|versus)\s+(.+)/i,
      /(difference|differences)\s+between\s+(.+?)\s+and\s+(.+)/i,
      /(.+?)\s+(vs\.?|versus)\s+(.+)/i,
      /(similarities?|contrast)\s+(between|of)\s+(.+?)\s+and\s+(.+)/i,
      /how\s+(does|do)\s+(.+?)\s+(differ|compare)\s+(from|to|with)\s+(.+)/i,
    ];
    if (comparisonPatterns.some(p => p.test(queryLower))) {
      return { intent: QueryIntent.CONTENT_COMPARISON, confidence: 0.95, reasoning: 'Query compares multiple documents or concepts' };
    }

    // PRIORITY 6: Content Summaries
    const summaryPatterns = ['summarize', 'summary', 'overview', 'brief', 'key points', 'main ideas', 'tldr'];
    if (summaryPatterns.some(p => queryLower.includes(p))) {
      return { intent: QueryIntent.CONTENT_SUMMARY, confidence: 0.9, reasoning: 'Query requests summary of content' };
    }

    // PRIORITY 7: Content Analysis (deep interpretation)
    const analysisPatterns = ['analyze', 'analysis', 'why', 'explain', 'interpret', 'insight', 'trend', 'pattern', 'implication'];
    if (analysisPatterns.some(p => queryLower.includes(p))) {
      return { intent: QueryIntent.CONTENT_ANALYSIS, confidence: 0.88, reasoning: 'Query requires deep analysis or interpretation' };
    }

    // PRIORITY 8: Factual Queries (default for content questions)
    const factualPatterns = ['what is', 'what are', 'how much', 'how many', 'when', 'where', 'who', 'which'];
    if (factualPatterns.some(p => queryLower.startsWith(p))) {
      return { intent: QueryIntent.CONTENT_FACTUAL, confidence: 0.85, reasoning: 'Query asks for specific facts' };
    }

    // PRIORITY 9: Unclear/Ambiguous
    if (queryLower.length < 3 || queryLower.split(' ').length === 1) {
      return { intent: QueryIntent.CLARIFICATION_NEEDED, confidence: 0.5, reasoning: 'Query too short or ambiguous' };
    }

    // DEFAULT: Factual Query
    return { intent: QueryIntent.CONTENT_FACTUAL, confidence: 0.6, reasoning: 'Default classification - appears to be factual query' };
  }

  /**
   * Extract entities from query (document names, folders, etc.)
   */
  private async extractEntities(query: string, userId: string, intent: QueryIntent): Promise<ExtractedEntities> {
    const entities: ExtractedEntities = {
      documentNames: [],
      folderNames: [],
      searchTerms: [],
      timeReferences: [],
      actions: [],
    };

    // Extract document names (for comparisons and specific queries)
    if (intent === QueryIntent.CONTENT_COMPARISON || intent === QueryIntent.CONTENT_FACTUAL || intent === QueryIntent.CONTENT_SUMMARY || intent === QueryIntent.CONTENT_ANALYSIS) {
      entities.documentNames = await this.extractDocumentNames(query, userId);
    }

    // Extract time references
    const timePatterns = ['today', 'yesterday', 'this week', 'last week', 'this month', 'last month', 'this year', /\d{4}/]; // YYYY
    for (const pattern of timePatterns) {
      if (typeof pattern === 'string' && query.toLowerCase().includes(pattern)) {
        entities.timeReferences.push(pattern);
      } else if (pattern instanceof RegExp) {
        const match = query.match(pattern);
        if (match) entities.timeReferences.push(match[0]);
      }
    }

    // Extract actions
    const actionPatterns = ['compare', 'analyze', 'summarize', 'explain', 'find', 'search', 'list', 'count'];
    for (const action of actionPatterns) {
      if (query.toLowerCase().includes(action)) {
        entities.actions.push(action);
      }
    }

    return entities;
  }

  /**
   * Extract document names from query with fuzzy matching
   */
  private async extractDocumentNames(query: string, userId: string): Promise<string[]> {
    // Get all user documents
    const documents = await prisma.document.findMany({
      where: { userId, status: { not: 'deleted' } },
      select: { id: true, filename: true },
    });

    console.log(`   🔍 [extractDocumentNames] Found ${documents.length} documents in DB`);
    console.log(`   📄 [extractDocumentNames] Document filenames: ${documents.map(d => d.filename).join(', ')}`);

    const documentNames: string[] = [];
    const queryLower = query.toLowerCase();

    // Check for exact or partial matches
    for (const doc of documents) {
      const filenameLower = doc.filename.toLowerCase();
      const filenameWithoutExt = filenameLower.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');

      // Check if query mentions this document exactly
      if (queryLower.includes(filenameLower) || queryLower.includes(filenameWithoutExt)) {
        documentNames.push(doc.filename);
        continue;
      }

      // IMPROVED FUZZY MATCHING: Handle spaces, abbreviations, partial names
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1); // Ignore single chars
      const filenameWords = filenameWithoutExt.split(/[_\-\s\.]+/).filter(w => w.length > 1);

      // Also check filename without ANY spaces/punctuation for better matching
      const queryNoSpaces = queryLower.replace(/[\s\-_\.]+/g, '');
      const filenameNoSpaces = filenameWithoutExt.replace(/[\s\-_\.]+/g, '');

      // STRATEGY 1: Check if query (without spaces) is contained in filename (without spaces)
      // Example: "pedro1" in query matches "pedro1" in filename
      if (queryNoSpaces.length >= 3 && filenameNoSpaces.includes(queryNoSpaces)) {
        documentNames.push(doc.filename);
        continue;
      }

      // STRATEGY 2: Check if filename (without spaces) is contained in query (without spaces)
      // Example: "pedro1" in filename matches "pedro1" in query
      if (filenameNoSpaces.length >= 3 && queryNoSpaces.includes(filenameNoSpaces)) {
        documentNames.push(doc.filename);
        continue;
      }

      // STRATEGY 3: Word-by-word matching with fuzzy distance
      let matchScore = 0;
      for (const qw of queryWords) {
        for (const fw of filenameWords) {
          // Exact substring match
          if (fw.includes(qw) || qw.includes(fw)) {
            matchScore++;
            break;
          }
          // Fuzzy match (max 2 character edits)
          if (this.levenshteinDistance(qw, fw) <= 2) {
            matchScore++;
            break;
          }
        }
      }

      // Consider it a match if at least 40% of query words match filename words
      // (lowered from 50% to be more lenient)
      if (matchScore >= Math.ceil(queryWords.length * 0.4) && queryWords.length > 0) {
        documentNames.push(doc.filename);
      }
    }

    console.log(`   📝 [extractDocumentNames] Query: "${query}" -> Found: ${documentNames.length} documents: [${documentNames.join(', ')}]`);
    return [...new Set(documentNames)]; // Remove duplicates
  }

  /**
   * Calculate Levenshtein distance between two strings (for fuzzy matching)
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Determine response format based on intent
   */
  private determineFormat(queryLower: string, intent: QueryIntent): ResponseFormat {
    // Explicit format requests
    if (queryLower.includes('table') || queryLower.includes('tabular')) {
      return ResponseFormat.TABLE;
    }
    if (queryLower.includes('list') || queryLower.includes('bullet')) {
      return ResponseFormat.LIST;
    }

    // Intent-based format
    switch (intent) {
      case QueryIntent.CONTENT_COMPARISON:
        return ResponseFormat.TABLE; // Comparisons work best as tables

      case QueryIntent.METADATA_COUNT:
      case QueryIntent.METADATA_SEARCH:
        return ResponseFormat.LIST; // Lists of files

      case QueryIntent.CONTENT_SUMMARY:
        return ResponseFormat.STRUCTURED; // Summaries need sections

      case QueryIntent.CONTENT_ANALYSIS:
        return ResponseFormat.STRUCTURED; // Analysis needs sections

      case QueryIntent.CONTENT_FACTUAL:
        return ResponseFormat.PARAGRAPH; // Simple facts

      default:
        return ResponseFormat.PARAGRAPH;
    }
  }

  /**
   * Select retrieval strategy based on intent and entities
   */
  private selectRetrievalStrategy(intent: QueryIntent, entities: ExtractedEntities): { strategy: RetrievalStrategy; topK: number } {
    switch (intent) {
      // No retrieval needed
      case QueryIntent.META_CAPABILITIES:
      case QueryIntent.FILE_CREATE:
      case QueryIntent.FILE_DELETE:
      case QueryIntent.FILE_RENAME:
      case QueryIntent.FILE_MOVE:
      case QueryIntent.FILE_UNDO:
      case QueryIntent.FILE_REDO:
      case QueryIntent.SOCIAL_GREETING:
        return { strategy: RetrievalStrategy.NONE, topK: 0 };

      // Metadata only
      case QueryIntent.METADATA_COUNT:
      case QueryIntent.METADATA_SEARCH:
        return { strategy: RetrievalStrategy.METADATA_ONLY, topK: 0 };

      // Multi-document retrieval (CRITICAL for comparisons)
      case QueryIntent.CONTENT_COMPARISON:
        return { strategy: RetrievalStrategy.MULTI_DOCUMENT, topK: 10 }; // 10 chunks per document

      // Precision retrieval (few highly relevant chunks)
      case QueryIntent.CONTENT_FACTUAL:
        return { strategy: RetrievalStrategy.PRECISION, topK: 5 };

      // Diverse retrieval (spread across document)
      case QueryIntent.CONTENT_SUMMARY:
        return { strategy: RetrievalStrategy.DIVERSE, topK: 15 };

      // Recall retrieval (many chunks for comprehensive analysis)
      case QueryIntent.CONTENT_ANALYSIS:
        return { strategy: RetrievalStrategy.RECALL, topK: 20 };

      default:
        return { strategy: RetrievalStrategy.PRECISION, topK: 10 };
    }
  }

  /**
   * Select handler based on intent
   */
  private selectHandler(intent: QueryIntent): HandlerType {
    switch (intent) {
      case QueryIntent.META_CAPABILITIES:
        return HandlerType.META;

      case QueryIntent.FILE_CREATE:
      case QueryIntent.FILE_DELETE:
      case QueryIntent.FILE_RENAME:
      case QueryIntent.FILE_MOVE:
      case QueryIntent.FILE_UNDO:
      case QueryIntent.FILE_REDO:
        return HandlerType.FILE_ACTION;

      case QueryIntent.METADATA_COUNT:
      case QueryIntent.METADATA_SEARCH:
        return HandlerType.METADATA;

      case QueryIntent.SOCIAL_GREETING:
        return HandlerType.SOCIAL;

      default:
        return HandlerType.CONTENT;
    }
  }

  /**
   * Get confidence threshold for intent
   */
  private getConfidenceThreshold(intent: QueryIntent): number {
    // Higher thresholds for critical intents
    switch (intent) {
      case QueryIntent.FILE_DELETE:
        return 0.9; // Don't delete unless very confident

      case QueryIntent.CONTENT_COMPARISON:
        return 0.3; // Comparisons should be lenient - proceed even with few results

      case QueryIntent.CONTENT_ANALYSIS:
        return 0.4; // Analysis should be lenient

      default:
        return 0.5; // Standard threshold - much more lenient
    }
  }
}

export const queryUnderstandingService = new QueryUnderstandingService();
export default queryUnderstandingService;
