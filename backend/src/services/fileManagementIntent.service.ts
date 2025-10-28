import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import prisma from '../config/database';

/**
 * File Management Intent Service
 * Uses NLU to classify user intent for file management operations
 * and extract relevant entities (document names, folder names, etc.)
 */

export enum FileManagementIntent {
  // Document Operations
  FIND_DOCUMENT = 'FIND_DOCUMENT',           // "Where is my business plan?"
  MOVE_DOCUMENT = 'MOVE_DOCUMENT',           // "Move the invoice to Finance folder"
  RENAME_DOCUMENT = 'RENAME_DOCUMENT',       // "Rename Q1_Report to Q1_Final_Report"
  DELETE_DOCUMENT = 'DELETE_DOCUMENT',       // "Delete the old contract"
  DESCRIBE_DOCUMENT = 'DESCRIBE_DOCUMENT',   // "Tell me about the blueprint file"

  // Folder Operations
  CREATE_FOLDER = 'CREATE_FOLDER',           // "Create a new folder called Projects"
  FIND_FOLDER = 'FIND_FOLDER',               // "Show me the Finance folder"
  DESCRIBE_FOLDER = 'DESCRIBE_FOLDER',       // "What's inside the Work folder?"
  RENAME_FOLDER = 'RENAME_FOLDER',           // "Rename Projects to Active_Projects"
  DELETE_FOLDER = 'DELETE_FOLDER',           // "Delete the Temp folder"

  // Category Operations
  ASSIGN_CATEGORY = 'ASSIGN_CATEGORY',       // "Mark this as financial"
  CREATE_CATEGORY = 'CREATE_CATEGORY',       // "Create a category called Legal"
  LIST_BY_CATEGORY = 'LIST_BY_CATEGORY',     // "Show all financial documents"

  // Navigation & Overview
  LIST_FILES = 'LIST_FILES',                 // "What files do I have?"
  LIST_FOLDERS = 'LIST_FOLDERS',             // "Show my folders"
  NAVIGATE_TO = 'NAVIGATE_TO',               // "Go to the Reports folder"

  // Not a file management action
  NONE = 'NONE'                              // Regular RAG query
}

export interface ExtractedEntities {
  documentName?: string;        // Filename mentioned in query
  folderName?: string;          // Folder name mentioned in query
  categoryName?: string;        // Category name mentioned
  destinationFolder?: string;   // Destination for move operations
  newName?: string;             // New name for rename operations
}

export interface IntentClassification {
  intent: FileManagementIntent;
  confidence: number;
  entities: ExtractedEntities;
  requiresConfirmation: boolean;  // True for destructive operations (delete, move)
  clarificationNeeded?: string;   // What needs clarification
}

class FileManagementIntentService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Classify user query into file management intent
   */
  async classifyIntent(query: string, userId: string): Promise<IntentClassification> {
    console.log(`🧠 [INTENT] Classifying query: "${query}"`);

    // Get user's document and folder context
    const userContext = await this.getUserContext(userId);

    const prompt = `You are a file management assistant that classifies user intent and extracts entities.

**User's Current Documents:**
${userContext.documents.map(d => `- ${d.filename}`).join('\n')}

**User's Current Folders:**
${userContext.folders.map(f => `- ${f.name} (path: ${f.path || '/'})`).join('\n')}

**User's Current Categories:**
${userContext.categories.map(c => `- ${c.name}`).join('\n')}

**User Query:** "${query}"

**Task:** Classify the user's intent and extract relevant entities.

**Available Intents:**
1. FIND_DOCUMENT - User wants to locate a specific document
2. MOVE_DOCUMENT - User wants to move a document to a folder
3. RENAME_DOCUMENT - User wants to rename a document
4. DELETE_DOCUMENT - User wants to delete a document
5. DESCRIBE_DOCUMENT - User wants information about a document
6. CREATE_FOLDER - User wants to create a new folder
7. FIND_FOLDER - User wants to locate a folder
8. DESCRIBE_FOLDER - User wants to know what's inside a folder
9. RENAME_FOLDER - User wants to rename a folder
10. DELETE_FOLDER - User wants to delete a folder
11. ASSIGN_CATEGORY - User wants to tag/categorize a document
12. CREATE_CATEGORY - User wants to create a new category
13. LIST_BY_CATEGORY - User wants to see all documents with a category
14. LIST_FILES - User wants to see all their files
15. LIST_FOLDERS - User wants to see all their folders
16. NAVIGATE_TO - User wants to navigate to a specific folder
17. NONE - Not a file management action (regular document question)

**Response Format (JSON):**
{
  "intent": "INTENT_NAME",
  "confidence": 0.0 to 1.0,
  "entities": {
    "documentName": "extracted document name (if mentioned)",
    "folderName": "extracted folder name (if mentioned)",
    "categoryName": "extracted category name (if mentioned)",
    "destinationFolder": "destination folder for move (if mentioned)",
    "newName": "new name for rename (if mentioned)"
  },
  "requiresConfirmation": true/false,
  "clarificationNeeded": "what needs clarification (if ambiguous)"
}

**Rules:**
1. Use fuzzy matching - if user says "business plan", match it to "Koda Business Plan V12.pdf"
2. If intent is DELETE or MOVE, set requiresConfirmation=true
3. If user query is ambiguous (e.g., "move the report" but there are 3 reports), set clarificationNeeded
4. If query is about document CONTENT (not location/organization), return NONE
5. Be lenient with folder paths - "Finance" can mean "/Finance" or "/Work/Finance"

**Examples:**
- "Where is my business plan?" → FIND_DOCUMENT, documentName="Koda Business Plan V12  (1) (2).pdf"
- "Move the invoice to Finance" → MOVE_DOCUMENT, documentName="invoice", destinationFolder="Finance"
- "What files do I have?" → LIST_FILES
- "What's in the blueprint about RAG?" → NONE (content question, not file management)
- "Create a folder called Projects" → CREATE_FOLDER, folderName="Projects"
- "Delete the old report" → DELETE_DOCUMENT, requiresConfirmation=true

Respond with ONLY valid JSON, no markdown.`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Remove markdown code blocks if present
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const classification: IntentClassification = JSON.parse(cleanedResponse);

      console.log(`✅ [INTENT] Classified as: ${classification.intent} (confidence: ${classification.confidence})`);
      if (classification.entities && Object.keys(classification.entities).length > 0) {
        console.log(`📝 [INTENT] Extracted entities:`, classification.entities);
      }

      return classification;
    } catch (error: any) {
      console.error('❌ [INTENT] Classification failed:', error);

      // Fallback to NONE if classification fails
      return {
        intent: FileManagementIntent.NONE,
        confidence: 0.0,
        entities: {},
        requiresConfirmation: false
      };
    }
  }

  /**
   * Get user's document and folder context for better intent classification
   */
  private async getUserContext(userId: string): Promise<{
    documents: { filename: string }[];
    folders: { name: string; path: string | null }[];
    categories: { name: string }[];
  }> {
    try {
      const [documents, folders, categories] = await Promise.all([
        prisma.document.findMany({
          where: { userId },
          select: { filename: true },
          take: 50  // Limit to recent 50 documents
        }),
        prisma.folder.findMany({
          where: { userId },
          select: { name: true, path: true }
        }),
        prisma.category.findMany({
          where: { userId },
          select: { name: true }
        })
      ]);

      return {
        documents,
        folders,
        categories
      };
    } catch (error) {
      console.error('Error fetching user context:', error);
      return {
        documents: [],
        folders: [],
        categories: []
      };
    }
  }

  /**
   * Resolve fuzzy document name to actual document ID
   */
  async resolveDocumentName(documentName: string, userId: string): Promise<string | null> {
    try {
      // Get all documents for the user and do case-insensitive matching in memory
      // (SQLite doesn't support mode: 'insensitive' in Prisma Client)
      const documents = await prisma.document.findMany({
        where: { userId },
        select: { id: true, filename: true }
      });

      const documentNameLower = documentName.toLowerCase();

      // Try exact match first
      let document = documents.find(doc =>
        doc.filename.toLowerCase() === documentNameLower
      );

      if (document) {
        console.log(`✅ [RESOLVE] Exact match found: ${document.filename}`);
        return document.id;
      }

      // Try partial match (contains)
      document = documents.find(doc =>
        doc.filename.toLowerCase().includes(documentNameLower)
      );

      if (document) {
        console.log(`✅ [RESOLVE] Partial match found: ${document.filename}`);
        return document.id;
      }

      console.log(`⚠️  [RESOLVE] No document found matching: "${documentName}"`);
      return null;
    } catch (error) {
      console.error('Error resolving document name:', error);
      return null;
    }
  }

  /**
   * Resolve fuzzy folder name to actual folder ID
   */
  async resolveFolderName(folderName: string, userId: string): Promise<string | null> {
    try {
      // Get all folders for the user and do case-insensitive matching in memory
      // (SQLite doesn't support mode: 'insensitive' in Prisma Client)
      const folders = await prisma.folder.findMany({
        where: { userId },
        select: { id: true, name: true }
      });

      const folderNameLower = folderName.toLowerCase();

      // Try exact match first
      let folder = folders.find(f =>
        f.name.toLowerCase() === folderNameLower
      );

      if (folder) {
        console.log(`✅ [RESOLVE] Exact folder match found: ${folder.name}`);
        return folder.id;
      }

      // Try partial match (contains)
      folder = folders.find(f =>
        f.name.toLowerCase().includes(folderNameLower)
      );

      if (folder) {
        console.log(`✅ [RESOLVE] Partial folder match found: ${folder.name}`);
        return folder.id;
      }

      console.log(`⚠️  [RESOLVE] No folder found matching: "${folderName}"`);
      return null;
    } catch (error) {
      console.error('Error resolving folder name:', error);
      return null;
    }
  }
}

export default new FileManagementIntentService();
