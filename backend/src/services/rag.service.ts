/**
 * RAG SERVICE - Phase 3: Query Understanding & RAG
 *
 * ENHANCEMENTS:
 * - Confidence gating (0.5 threshold)
 * - Mentions search for finding phrase occurrences across documents
 * - Answer length control via systemPrompts service
 * - Intent-based prompt templates
 * - ✨ NEW: Query Classifier integration for ChatGPT-level precision
 *   - Automatic query type detection (9 types)
 *   - Response style mapping (ultra_concise → detailed)
 *   - Query-specific temperature and token limits
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import intentService, { PsychologicalGoal, PsychologicalGoalResult } from './intent.service';
import navigationService from './navigation.service';
import { detectLanguage, createLanguageInstruction, isGreeting, getLocalizedGreeting, getLocalizedError } from './languageDetection.service';
import cacheService from './cache.service';
import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';
import systemPromptsService, { AnswerLength } from './systemPrompts.service';
import responseFormatterService from './responseFormatter.service';
import queryClassifierService, { ResponseStyle } from './queryClassifier.service';
import queryIntentDetectorService, { QueryIntent } from './queryIntentDetector.service';
import formatTypeClassifierService, { ResponseFormatType } from './formatTypeClassifier.service';
import metadataService from './metadata.service';
import fileActionsService from './fileActions.service';
import validationService from './validation.service';
import errorHandlerService from './errorHandler.service';
import proactiveSuggestionsService from './proactiveSuggestions.service';
import synthesisService from './synthesis.service';
import versionTrackingService from './versionTracking.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Phase 3: Confidence threshold for quality gating
// Lowered from 0.6 to 0.5 to allow queries about document identifiers (passport numbers, etc.)
// that may use slightly different terminology
const CONFIDENCE_THRESHOLD = 0.5;

interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: any;
  location?: string; // Page, slide, or cell reference
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  contextId: string;
  intent?: string;
  confidence?: number;
}

class RAGService {
  /**
   * Build intent-specific and format-specific system prompt
   * Combines query intent (LIST, FACTUAL, etc.) with format type (FEATURE_LIST, TABLE, etc.)
   */
  private buildIntentSystemPrompt(
    queryIntent: QueryIntent,
    isMetadataQuery: boolean,
    formatType: ResponseFormatType
  ): string {
    if (queryIntent === QueryIntent.LIST) {
      return `⚠️⚠️⚠️ CRITICAL SYSTEM OVERRIDE ⚠️⚠️⚠️

TASK: Return ONLY filenames in bullet format. NOTHING ELSE.

YOUR ENTIRE RESPONSE must be:
• filename1.pdf
• filename2.docx
• filename3.xlsx

DO NOT WRITE:
- Summaries
- Explanations
- "Here is a summary:"
- "Here are the documents:"
- ANY text before the bullets
- ANY text after the bullets

STOP AFTER THE LAST BULLET POINT. Your response is complete.

CORRECT (This is your ENTIRE response):
• Koda Business Plan V12.pdf
• Koda Presentation Port Final.pptx
• koda_checklist.pdf

WRONG (DO NOT DO THIS):
• Koda Business Plan V12.pdf
• Koda Presentation Port Final.pptx

Here is a summary: [STOP! This is forbidden!]

WRONG (DO NOT DO THIS):
Here are the documents: [STOP! Start with bullets only!]
• document.pdf

Remember: Your response = bullets only. No intro. No summary. No explanation. Just bullets.`;
    } else if (queryIntent === QueryIntent.FACTUAL) {
      // For factual queries, use DIRECT_ANSWER format or format-specific prompt
      const formatPrompt = responseFormatterService.buildFormatPrompt(formatType);
      return `CRITICAL INSTRUCTIONS FOR FACTUAL QUERIES:

The user wants a SPECIFIC FACT or DATA POINT, not a summary.

FOR EXCEL/SPREADSHEET DATA:
- Look for cell coordinates (e.g., "B5: $1,200,000" or "Cell A10: Revenue")
- Look for table data (e.g., "Month: January, Revenue: $450,000")
- Pay attention to sheet names and row numbers
- If multiple values exist, cite the specific cell/sheet location
- Include formulas if they provide context

${formatPrompt}`;
    } else if (queryIntent === QueryIntent.COMPARISON) {
      // For comparison queries, use enhanced table format with explicit 2-document limit
      return `CRITICAL INSTRUCTIONS FOR COMPARISON QUERIES:

The user wants to COMPARE exactly TWO documents.

YOUR RESPONSE MUST USE THIS EXACT STRUCTURE:

Documents compared:
• [Document 1 name with extension]
• [Document 2 name with extension]

Comparison summary:

Aspect          Document 1              Document 2
────────────────────────────────────────────────────────
Language        [value]                 [value]
Content         [value]                 [value]
Purpose         [value]                 [value]
Audience        [value]                 [value]
[Other aspect]  [value]                 [value]

✅ Core finding: [One clear sentence stating the main difference or similarity]

Next actions:
[Specific suggestion based on comparison]

CRITICAL RULES:
• List EXACTLY the 2 documents being compared (no others)
• Use table format with aligned columns (use spaces for alignment)
• Maximum 5-7 comparison rows (pick most important aspects)
• If documents are TRANSLATIONS of each other, state that clearly
• If documents are IDENTICAL, say so explicitly
• If documents have SAME CONTENT but different formats, mention it
• ONE sentence closing with ✅
• NO long paragraphs - only table and concise summary
• NO emoji except the single ✅ in core finding

TRANSLATION DETECTION:
If documents have same name but different language extensions (e.g., "Koda Presentation English" vs "Koda Presentation Port"), they are likely TRANSLATIONS.

EXAMPLE 1 (Translations):
Documents compared:
• Koda Presentation English (1).pptx
• Koda Presentation Port Final.pptx

Comparison summary:

Aspect          English Version         Portuguese Version
────────────────────────────────────────────────────────
Language        English                 Portuguese (Brazilian)
Content         Original presentation   Direct translation
Slide Count     15 slides               15 slides
Audience        International market    Brazilian market

✅ Core finding: These are the SAME presentation in different languages - the Portuguese version is a direct translation with identical content and structure.

Next actions:
Would you like me to extract specific slides from either presentation or compare these to the Koda Business Plan?

EXAMPLE 2 (Different Documents):
Documents compared:
• Koda Business Plan V12 (1).pdf
• Koda_AI_Testing_Suite_30_Questions.docx

Comparison summary:

Aspect          Business Plan           Testing Suite
────────────────────────────────────────────────────────
Purpose         Strategy & financials   Quality assurance tests
Content Type    Revenue projections     Test scenarios & QA
Primary Focus   Market & growth         Product validation
Audience        Investors & executives  Developers & QA team
Detail Level    High-level overview     Technical specifics

✅ Core finding: The Business Plan defines WHAT Koda will achieve (strategy, revenue, market), while the Testing Suite defines HOW to verify it works (functional tests, AI accuracy).

Next actions:
Would you like me to extract revenue projections from the Business Plan or review specific test scenarios from the Testing Suite?`;
    } else {
      // SUMMARY - use format-specific prompt (FEATURE_LIST, STRUCTURED_LIST, etc.)
      const formatPrompt = responseFormatterService.buildFormatPrompt(formatType);
      return `${formatPrompt}

Provide a comprehensive and accurate answer based on the document content following the format above.`;
    }
  }

  /**
   * Map Query Classifier ResponseStyle to AnswerLength
   */
  private mapStyleToAnswerLength(style: ResponseStyle, explicitLength?: AnswerLength): AnswerLength {
    // If user explicitly specified length, respect it
    if (explicitLength && explicitLength !== 'medium') {
      return explicitLength;
    }

    // Map classifier style to answer length
    const styleMap: Record<ResponseStyle, AnswerLength> = {
      [ResponseStyle.ULTRA_CONCISE]: 'ultra_brief',
      [ResponseStyle.CONCISE]: 'brief',
      [ResponseStyle.MODERATE]: 'medium',
      [ResponseStyle.DETAILED]: 'detailed',
      [ResponseStyle.STRUCTURED]: 'detailed',
    };

    return styleMap[style] || 'medium';
  }

  /**
   * Main entry point - handles ALL queries with smart routing
   */
  async generateAnswer(
    userId: string,
    query: string,
    conversationId: string,
    answerLength: AnswerLength = 'medium',
    documentId?: string
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`🔍 RAG QUERY: "${query}"`);
    console.log(`👤 User: ${userId}`);
    console.log(`📏 Answer Length: ${answerLength}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // STEP 1: CHECK FOR CHAT ACTIONS (AI-First: file actions, list commands, upload requests)
    console.log(`\n🤖 CHECKING FOR CHAT ACTIONS...`);
    const chatActionsService = await import('./chatActions.service');
    const actionResult = await chatActionsService.default.detectAndExecute(userId, query, conversationId);

    if (actionResult.isAction) {
      console.log(`   ✅ Action detected: ${actionResult.actionType}`);

      // Format chat action responses using the imported service
      const formatterContext = {
        queryLength: query.length,
        documentCount: 0,
        intentType: actionResult.actionType || 'file_action',
        chunks: [],
        hasFinancialData: false,
        hasMultipleSheets: false,
        hasSlides: false,
      };

      const formattedResponse = await responseFormatterService.formatResponse(
        actionResult.response,
        formatterContext,
        [],
        query
      );

      return {
        answer: formattedResponse,
        sources: [],
        contextId: `action_${actionResult.actionType}_${Date.now()}`,
        intent: actionResult.actionType,
        confidence: 1.0,
        actionResult: actionResult.result,
        uiUpdate: actionResult.uiUpdate,
      };
    }

    console.log(`   ✅ Not an action - proceeding with query handling`);

    // STEP 2: DETECT PSYCHOLOGICAL GOAL (NEW)
    const goalResult = intentService.detectPsychologicalGoal(query);
    console.log(`🎯 Psychological Goal: ${goalResult.goal} (confidence: ${(goalResult.confidence * 100).toFixed(1)}%)`);
    console.log(`💡 Reasoning: ${goalResult.reasoning}`);

    // STEP 2.5: CHECK IF METADATA QUERY (NEW - Prevents hallucination)
    // Metadata queries should use DATABASE, not RAG/Pinecone
    const metadataQueryResult = intentService.detectMetadataQuery(query);
    if (metadataQueryResult.isMetadataQuery) {
      console.log(`📊 METADATA QUERY DETECTED: ${metadataQueryResult.type}`);
      console.log(`   Extracted value: ${metadataQueryResult.extractedValue || 'N/A'}`);
      return await this.handleMetadataQuery(userId, query, metadataQueryResult);
    }

    // DEPRECATED: Old intent detection (kept for backwards compatibility)
    const intent = intentService.detectIntent(query);

    // STEP 3: ROUTE BASED ON INTENT
    if (intent.intent === 'greeting') {
      return await this.handleGreeting(userId, query);
    } else if (intent.intent === 'navigation' || intent.intent === 'locate') {
      // Both navigation and locate intents use the same handler to find files/folders
      return await this.handleNavigationQuery(userId, query);
    } else if (intent.intent === 'search_mentions') {
      // Phase 3: New mentions search handler
      return await this.handleMentionsSearch(userId, query, answerLength);
    } else {
      // EXTRACT, SUMMARIZE, COMPARE, CELL_VALUE - use RAG with confidence gating
      return await this.handleContentQuery(userId, query, conversationId, answerLength, documentId);
    }
  }

  /**
   * Handle GREETING queries - Multilingual Support
   * Detects language and responds in the user's language
   */
  private async handleGreeting(userId: string, query: string): Promise<RAGResponse> {
    console.log(`👋 GREETING HANDLER (Multilingual)`);

    // Detect language from the greeting
    const language = detectLanguage(query);
    console.log(`   Detected language: ${language}`);

    // Get localized greeting response
    const response = getLocalizedGreeting(language);

    return {
      answer: response,
      sources: [],
      contextId: `greeting_${Date.now()}`,
      intent: 'greeting'
    };
  }

  /**
   * Handle METADATA queries (database lookups, not RAG)
   *
   * These queries ask about file locations, counts, or folder contents.
   * We use the database directly instead of RAG to prevent hallucination.
   *
   * Examples:
   * - "where is comprovante1" → Query database for filename
   * - "how many files do I have" → Count files in database
   * - "what files are in pedro1 folder" → List folder contents from database
   */
  private async handleMetadataQuery(
    userId: string,
    query: string,
    metadataResult: any
  ): Promise<RAGResponse> {
    console.log(`📊 METADATA QUERY HANDLER (Type: ${metadataResult.type})`);

    // ✅ FIX #3: Use new systemMetadata service for reliable database queries
    const systemMetadataService = require('./systemMetadata.service').default;

    let answer = '';
    let data: any = null;

    try {
      switch (metadataResult.type) {
        case 'file_location':
          console.log(`   🔍 Finding file location: "${metadataResult.extractedValue}"`);

          // Use systemMetadata service for reliable file location lookup
          const fileLocation = await systemMetadataService.findFileLocation(
            userId,
            metadataResult.extractedValue
          );

          if (!fileLocation) {
            answer = `I couldn't find a file matching "${metadataResult.extractedValue}". Please check the filename and try again.`;
          } else {
            answer = `📄 **${fileLocation.filename}** is stored in **${fileLocation.location}**.`;
          }
          break;

        case 'file_type_query':
          console.log(`   📊 Getting file types`);

          // Use systemMetadata service to get file types
          const fileTypes = await systemMetadataService.getFileTypes(userId);

          if (fileTypes.length === 0) {
            answer = "You don't have any files uploaded yet.";
          } else {
            answer = `You have uploaded **${fileTypes.length}** different file types:\n\n`;
            fileTypes.forEach((type) => {
              answer += `• **${type.friendlyName}**: ${type.count} ${type.count === 1 ? 'file' : 'files'}\n`;
            });
          }
          break;

        case 'file_count':
          console.log(`   📊 Counting files`);

          // Check if asking about root or total
          const isRootQuery = /root|main|root directory/i.test(query);

          if (isRootQuery) {
            const rootCount = await systemMetadataService.countRootFiles(userId);
            answer = `You have **${rootCount}** ${rootCount === 1 ? 'file' : 'files'} in the root directory.`;
          } else {
            const totalCount = await systemMetadataService.countTotalFiles(userId);
            answer = `You have **${totalCount}** ${totalCount === 1 ? 'file' : 'files'} in total.`;
          }
          break;

        case 'folder_contents':
          console.log(`   📁 Getting folder contents: "${metadataResult.extractedValue}"`);

          // Use systemMetadata service for folder contents
          const filesInFolder = await systemMetadataService.getFilesInFolder(
            userId,
            metadataResult.extractedValue
          );

          if (filesInFolder.length === 0) {
            answer = `The folder "${metadataResult.extractedValue}" is empty or doesn't exist.`;
          } else {
            answer = `**Folder "${metadataResult.extractedValue}"** contains **${filesInFolder.length}** ${filesInFolder.length === 1 ? 'file' : 'files'}:\n\n`;
            filesInFolder.forEach((file: any) => {
              answer += `• ${file.filename}\n`;
            });
          }
          break;

        case 'list_all_files':
          console.log(`   📄 Listing all files`);
          data = await metadataService.getAllFiles(userId, { take: 50 });
          answer = `You have **${data.length} files** in your document library:\n\n`;
          answer += data.map((file: any) => `• **${file.filename}**`).join('\n');
          break;

        case 'list_folders':
          console.log(`   📁 Listing all folders`);

          // Use systemMetadata service for folder list
          const folders = await systemMetadataService.getFolders(userId);

          if (folders.length === 0) {
            answer = "You don't have any folders yet.";
          } else {
            answer = `You have **${folders.length}** ${folders.length === 1 ? 'folder' : 'folders'}:\n\n`;
            folders.forEach((folder: any) => {
              answer += `• **${folder.name}**: ${folder._count.documents} ${folder._count.documents === 1 ? 'file' : 'files'}\n`;
            });
          }
          break;

        default:
          answer = "I couldn't understand the metadata query. Please try rephrasing.";
      }

      console.log(`   ✅ Metadata query handled successfully`);

      return {
        answer,
        sources: [],
        contextId: `metadata_${metadataResult.type}_${Date.now()}`,
        intent: metadataResult.type,
        confidence: metadataResult.confidence,
      };
    } catch (error) {
      console.error(`❌ Error handling metadata query:`, error);
      console.error(`   Query: "${query}"`);
      console.error(`   Type: ${metadataResult.type}`);
      console.error(`   Extracted value: ${metadataResult.extractedValue || 'N/A'}`);
      console.error(`   Error details:`, error instanceof Error ? error.message : error);
      console.error(`   Stack trace:`, error instanceof Error ? error.stack : 'N/A');

      return {
        answer: 'Sorry, I encountered an error while looking up that information. Please try again.',
        sources: [],
        contextId: `metadata_error_${Date.now()}`,
        intent: metadataResult.type,
      };
    }
  }

  /**
   * Extract document name from query to filter sources
   * Examples:
   * - "what does koda business plan talk about" → "koda business plan"
   * - "summarize the blueprint" → "blueprint"
   * - "what is in comprovante1" → "comprovante1"
   */
  private extractDocumentNameFromQuery(query: string): string | null {
    const patterns = [
      // Comparison patterns (NEW - catches "similarities/differences between X")
      /(?:similarities|differences|compare|comparison).*?(?:between|of) (?:the |both |all )?(.+?)(?:\s+(?:presentations?|documents?|files?|plans?))/i,
      /(?:compare|comparison of) (?:the |both |all )?(.+?)(?:\s+(?:presentations?|documents?|files?|plans?))/i,

      // Original patterns
      /(?:what does|what is|summarize|tell me about|explain) (?:the )?(.+?)(?:\s+(?:talk about|say|document|file|about))/i,
      /(?:in|from) (?:the )?(.+?)(?:\s+(?:document|file|pdf|docx|xlsx|pptx))/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        let extracted = match[1].trim();

        // Clean up extracted name
        extracted = extracted
          .replace(/^(?:the|a|an|both|all)\s+/i, '')  // Remove articles and quantifiers
          .replace(/\s+(?:file|document)s?$/i, '');  // Remove "file(s)" or "document(s)" at end

        return extracted;
      }
    }

    return null;
  }

  /**
   * Validate all filenames mentioned in response against database
   * Prevents AI hallucination by removing references to non-existent files
   */
  private async validateFilenamesInResponse(answer: string, userId: string): Promise<string> {
    // Extract all filenames from the response (files with extensions)
    const filenamePattern = /([^\n•\-–]+?\.(pdf|xlsx|docx|pptx|txt|csv|jpg|png|gif|zip|rar|json|xml|html))/gi;
    const matches = answer.match(filenamePattern);

    if (!matches || matches.length === 0) {
      console.log(`   ℹ️  No filenames detected in response`);
      return answer;
    }

    // Clean up extracted filenames
    const extractedFilenames = matches.map(m => m.trim());
    const uniqueFilenames = [...new Set(extractedFilenames)];

    console.log(`   📄 Found ${uniqueFilenames.length} unique filename(s) in response:`);
    uniqueFilenames.forEach(f => console.log(`      - ${f}`));

    // Query database to check which files exist
    const existingFiles = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' }
      },
      select: {
        filename: true
      }
    });

    const existingFilenames = new Set(existingFiles.map(f => f.filename));

    // Find hallucinated filenames (mentioned but don't exist)
    const hallucinatedFiles: string[] = [];
    const validFiles: string[] = [];

    for (const mentioned of uniqueFilenames) {
      const exists = existingFilenames.has(mentioned);
      if (exists) {
        validFiles.push(mentioned);
      } else {
        hallucinatedFiles.push(mentioned);
      }
    }

    if (hallucinatedFiles.length === 0) {
      console.log(`   ✅ All ${validFiles.length} filename(s) validated - no hallucination detected`);
      return answer;
    }

    // HALLUCINATION DETECTED - Remove hallucinated references
    console.warn(`   ⚠️  HALLUCINATION DETECTED: ${hallucinatedFiles.length} non-existent file(s):`);
    hallucinatedFiles.forEach(f => console.warn(`      ❌ ${f}`));

    let cleanedAnswer = answer;

    // Remove bullet points that mention hallucinated files
    for (const fake of hallucinatedFiles) {
      // Pattern: Remove the entire bullet point line containing the fake filename
      const bulletPattern = new RegExp(`•[^•\n]*${this.escapeRegex(fake)}[^\n]*\n?`, 'gi');
      cleanedAnswer = cleanedAnswer.replace(bulletPattern, '');
    }

    console.log(`   🧹 Removed hallucinated file references from response`);
    console.log(`   ✅ Validated files: ${validFiles.length}`);
    console.log(`   ❌ Removed files: ${hallucinatedFiles.length}`);

    return cleanedAnswer;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract file type from query
   * Examples:
   * - "similarities between both koda presentations" → "presentation"
   * - "compare the PDFs" → "pdf"
   * - "what do the business plans say" → "plan"
   */
  private extractFileTypeFromQuery(query: string): string | null {
    const queryLower = query.toLowerCase();

    // File type patterns (plural and singular)
    const patterns: [RegExp, string][] = [
      [/presentations?/i, 'presentation'],
      [/pdfs?/i, 'pdf'],
      [/plans?/i, 'plan'],
      [/spreadsheets?|excels?/i, 'spreadsheet'],
      [/documents?|docs?/i, 'document'],
      [/slides?/i, 'slide'],
    ];

    for (const [pattern, type] of patterns) {
      if (pattern.test(queryLower)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Map file type to MIME types
   */
  private getMimeTypeFilter(fileType: string): string[] {
    const mimeMap: Record<string, string[]> = {
      'presentation': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'],
      'pdf': ['application/pdf'],
      'plan': ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], // Plans could be PDF or Word
      'spreadsheet': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
      'document': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
      'slide': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    };

    return mimeMap[fileType] || [];
  }

  /**
   * Validate that all source documentIds exist in database
   * Filters out stale sources from Pinecone that reference deleted documents or wrong filenames
   * ALSO DELETES orphaned vectors from Pinecone to prevent future queries from finding them
   */
  private async validateSourcesExist(sources: RAGSource[], userId: string): Promise<RAGSource[]> {
    if (sources.length === 0) return sources;

    // Extract all documentIds from sources
    const documentIds = sources.map(s => s.documentId);

    // Query database to check which documents exist AND get their actual filenames
    const existingDocs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        userId,
        status: { not: 'deleted' }
      },
      select: {
        id: true,
        filename: true
      }
    });

    // Create map of documentId -> filename from database
    const docIdToFilename = new Map(existingDocs.map(d => [d.id, d.filename]));

    // Track orphaned document IDs for cleanup
    const orphanedDocumentIds: string[] = [];

    // Filter sources to only include existing documents with matching filenames
    const validSources = sources.filter(s => {
      const dbFilename = docIdToFilename.get(s.documentId);
      if (!dbFilename) {
        console.warn(`   ⚠️  Source references deleted document: ${s.documentId}`);
        orphanedDocumentIds.push(s.documentId);
        return false;
      }

      // CRITICAL: Also validate filename matches database
      if (s.filename !== dbFilename) {
        console.warn(`   ⚠️  Filename mismatch for ${s.documentId}: Pinecone="${s.filename}", DB="${dbFilename}"`);
        // Update filename to match database
        s.filename = dbFilename;
      }

      return true;
    });

    const removedCount = sources.length - validSources.length;

    if (removedCount > 0) {
      console.warn(`   ⚠️  Found ${removedCount} orphaned source(s) - cleaning up Pinecone...`);

      // CRITICAL: Delete orphaned vectors from Pinecone to prevent this from happening again
      const pineconeService = await import('./pinecone.service');
      for (const orphanedId of orphanedDocumentIds) {
        try {
          await pineconeService.default.deleteDocumentEmbeddings(orphanedId);
          console.log(`   🧹 Deleted orphaned vectors for document: ${orphanedId}`);
        } catch (error) {
          console.error(`   ❌ Failed to delete orphaned vectors for ${orphanedId}:`, error);
        }
      }
    }

    return validSources;
  }

  /**
   * Handle NAVIGATION queries (where is file X, show me folder Y)
   */
  private async handleNavigationQuery(
    userId: string,
    query: string
  ): Promise<RAGResponse> {
    console.log(`🧭 NAVIGATION QUERY HANDLER`);

    const fileName = intentService.extractFileName(query);
    if (fileName) {
      console.log(`   Looking for file: "${fileName}"`);
      const result = await navigationService.findFile(userId, fileName);

      return {
        answer: result.message,
        sources: [],
        contextId: `navigation_${Date.now()}`,
        intent: 'navigation'
      };
    }

    const folderName = intentService.extractFolderName(query);
    if (folderName) {
      console.log(`   Looking for folder: "${folderName}"`);
      const result = await navigationService.findFolder(userId, folderName);

      return {
        answer: result.message,
        sources: [],
        contextId: `navigation_${Date.now()}`,
        intent: 'navigation'
      };
    }

    return {
      answer: "I can help you find files and folders! Please specify which file or folder you're looking for.",
      sources: [],
      contextId: `navigation_${Date.now()}`,
      intent: 'navigation'
    };
  }

  /**
   * Phase 2 Week 7-8: Handle TEMPORAL queries (version tracking, time-based queries)
   */
  private async handleTemporalQuery(
    userId: string,
    query: string,
    temporalIntent: any,
    conversationId: string
  ): Promise<RAGResponse> {
    console.log(`⏰ TEMPORAL QUERY HANDLER - Type: ${temporalIntent.queryType}`);

    try {
      switch (temporalIntent.queryType) {
        case 'latest': {
          // Get latest version of document
          if (!temporalIntent.documentName) {
            return {
              answer: "Please specify which document you want the latest version of.",
              sources: [],
              contextId: `temporal_latest_${Date.now()}`,
              intent: 'temporal_latest'
            };
          }

          const latestVersion = await versionTrackingService.getLatestVersion(
            userId,
            temporalIntent.documentName
          );

          if (!latestVersion) {
            return {
              answer: `I couldn't find a document matching "${temporalIntent.documentName}".`,
              sources: [],
              contextId: `temporal_latest_${Date.now()}`,
              intent: 'temporal_latest',
              confidence: 0
            };
          }

          return {
            answer: `The latest version of **${latestVersion.filename}** was last updated on ${latestVersion.updatedAt.toLocaleDateString()}.`,
            sources: [],
            contextId: `temporal_latest_${Date.now()}`,
            intent: 'temporal_latest',
            confidence: 1.0
          };
        }

        case 'history': {
          // Get version history
          const docName = temporalIntent.documentName || '';
          const document = await versionTrackingService.findDocumentByName(userId, docName);

          if (!document) {
            return {
              answer: `I couldn't find a document matching "${docName}".`,
              sources: [],
              contextId: `temporal_history_${Date.now()}`,
              intent: 'temporal_history',
              confidence: 0
            };
          }

          const versions = await versionTrackingService.getVersionHistory(userId, document.id);

          if (versions.length <= 1) {
            return {
              answer: `**${document.filename}** has no previous versions.`,
              sources: [],
              contextId: `temporal_history_${Date.now()}`,
              intent: 'temporal_history',
              confidence: 1.0
            };
          }

          let answer = `**Version History for ${document.filename}:**\n\n`;
          versions.forEach(v => {
            answer += `• Version ${v.version}${v.isLatest ? ' (Latest)' : ''} - Updated: ${v.updatedAt.toLocaleDateString()}\n`;
          });

          return {
            answer,
            sources: [],
            contextId: `temporal_history_${Date.now()}`,
            intent: 'temporal_history',
            confidence: 1.0
          };
        }

        case 'changes_since': {
          // Get documents changed since date
          if (!temporalIntent.timeReference) {
            return {
              answer: "Please specify a date or time period (e.g., 'since last week', 'after January 15').",
              sources: [],
              contextId: `temporal_changes_${Date.now()}`,
              intent: 'temporal_changes'
            };
          }

          const changedDocs = await versionTrackingService.getDocumentsChangedSince(
            userId,
            temporalIntent.timeReference
          );

          if (changedDocs.length === 0) {
            return {
              answer: `No documents were changed since ${temporalIntent.timeReference.toLocaleDateString()}.`,
              sources: [],
              contextId: `temporal_changes_${Date.now()}`,
              intent: 'temporal_changes',
              confidence: 1.0
            };
          }

          let answer = `**Documents changed since ${temporalIntent.timeReference.toLocaleDateString()}:**\n\n`;
          changedDocs.forEach(doc => {
            answer += `• **${doc.filename}** - Updated: ${doc.updatedAt.toLocaleDateString()}\n`;
          });

          return {
            answer,
            sources: [],
            contextId: `temporal_changes_${Date.now()}`,
            intent: 'temporal_changes',
            confidence: 1.0
          };
        }

        default:
          // Fall back to normal query processing
          return await this.handleContentQuery(userId, query, conversationId, 'medium');
      }
    } catch (error) {
      console.error(`❌ Error handling temporal query:`, error);
      return {
        answer: "I encountered an error processing your version history query. Please try rephrasing your question.",
        sources: [],
        contextId: `temporal_error_${Date.now()}`,
        intent: 'temporal_error',
        confidence: 0
      };
    }
  }

  /**
   * Phase 3: Handle MENTIONS SEARCH queries
   * Find all documents that contain a specific phrase or keyword
   * Returns document names with surrounding context
   */
  private async handleMentionsSearch(
    userId: string,
    query: string,
    answerLength: AnswerLength
  ): Promise<RAGResponse> {
    console.log(`🔍 MENTIONS SEARCH HANDLER`);

    // Extract the search phrase from the query
    const searchPhrase = this.extractSearchPhrase(query);
    console.log(`   Search phrase: "${searchPhrase}"`);

    if (!searchPhrase) {
      return {
        answer: "I couldn't identify what phrase or term you're looking for. Please specify what you want me to search for.",
        sources: [],
        contextId: `mentions_${Date.now()}`,
        intent: 'search_mentions'
      };
    }

    // Search across all user documents using vector similarity
    const embeddingResult = await embeddingService.generateQueryEmbedding(searchPhrase);
    const results = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding, // Extract the array from the result object
      userId,
      50, // topK - Get more results for comprehensive search
      0.3 // minSimilarity - Lowered for better recall
    );

    console.log(`   Found ${results.length} potential mentions`);

    // Phase 3: CONFIDENCE GATING - filter by threshold
    const confidenceResults = results.filter(r => r.similarity >= CONFIDENCE_THRESHOLD);
    console.log(`   ${confidenceResults.length} results above ${CONFIDENCE_THRESHOLD} confidence threshold`);

    if (confidenceResults.length === 0) {
      const detectedLang = detectLanguage(query);
      const answer = detectedLang === 'pt'
        ? `Não encontrei menções relevantes de "${searchPhrase}" nos seus documentos.`
        : `I couldn't find relevant mentions of "${searchPhrase}" in your documents.`;

      return {
        answer,
        sources: [],
        contextId: `mentions_${Date.now()}`,
        intent: 'search_mentions',
        confidence: 0
      };
    }

    // Group results by document
    const docMap = new Map<string, { name: string; mentions: Array<{ content: string; score: number; location?: string }> }>();

    for (const result of confidenceResults) {
      if (!docMap.has(result.documentId)) {
        docMap.set(result.documentId, {
          name: result.document?.filename || 'Unknown', // ✅ Fixed: use result.document.filename
          mentions: []
        });
      }

      const doc = docMap.get(result.documentId)!;
      doc.mentions.push({
        content: result.content,
        score: result.similarity,
        location: result.metadata?.pageNumber
          ? `Page ${result.metadata.pageNumber}`
          : result.metadata?.slideNumber
          ? `Slide ${result.metadata.slideNumber}`
          : undefined
      });
    }

    // Build sources array for response
    const sources: RAGSource[] = [];
    for (const [docId, doc] of docMap.entries()) {
      // Take the highest scoring mention from each document
      const topMention = doc.mentions.sort((a, b) => b.score - a.score)[0];

      sources.push({
        documentId: docId,
        documentName: doc.name,
        chunkIndex: 0,
        content: topMention.content,
        similarity: topMention.score,
        metadata: { mentionCount: doc.mentions.length },
        location: topMention.location
      });
    }

    // Sort sources by similarity (highest first)
    sources.sort((a, b) => b.similarity - a.similarity);

    // Build context for LLM with all mentions
    const contextParts: string[] = [];
    for (const source of sources) {
      const mentionInfo = docMap.get(source.documentId)!;
      contextParts.push(`Document: ${source.documentName}`);
      contextParts.push(`Mentions found: ${mentionInfo.mentions.length}`);
      for (let i = 0; i < Math.min(3, mentionInfo.mentions.length); i++) {
        const mention = mentionInfo.mentions[i];
        const locationStr = mention.location ? ` (${mention.location})` : '';
        contextParts.push(`  ${i + 1}${locationStr}: "${mention.content.substring(0, 200)}..."`);
      }
      contextParts.push('');
    }

    const context = contextParts.join('\n');

    // Use system prompts service for specialized mentions search prompt
    const promptConfig = systemPromptsService.getPromptConfig('search_mentions', answerLength);
    const fullPrompt = systemPromptsService.buildPrompt('search_mentions', query, context, answerLength);

    // Generate answer with LLM
    console.log(`🤖 GENERATING MENTIONS SUMMARY...`);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: promptConfig.maxTokens,
        temperature: promptConfig.temperature,
      }
    });

    const result = await model.generateContent(fullPrompt);
    const answer = result.response.text();

    const responseTime = Date.now() - startTime;
    console.log(`✅ MENTIONS SEARCH COMPLETE (${responseTime}ms)`);
    console.log(`   Documents found: ${sources.length}`);
    console.log(`   Total mentions: ${Array.from(docMap.values()).reduce((sum, d) => sum + d.mentions.length, 0)}`);

    // Calculate average confidence
    const avgConfidence = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;

    return {
      answer,
      sources: sources.slice(0, 10), // Limit to top 10 documents in response
      contextId: `mentions_${Date.now()}`,
      intent: 'search_mentions',
      confidence: avgConfidence
    };
  }

  /**
   * Handle CONTENT queries (information extraction, summarization, comparison)
   * Phase 3: Enhanced with confidence gating and answer length control
   */
  private async handleContentQuery(
    userId: string,
    query: string,
    conversationId: string,
    answerLength: AnswerLength,
    documentId?: string
  ): Promise<RAGResponse> {
    console.log(`📚 CONTENT QUERY HANDLER`);
    if (documentId) {
      console.log(`   🎯 Document-specific query - filtering to documentId: ${documentId}`);
    }

    const startTime = Date.now();

    // Check cache
    const cacheKey = cacheService.generateKey(query, userId, { documentId, answerLength });
    const cached = await cacheService.get<RAGResponse>(cacheKey, {
      ttl: 3600,
      useMemory: true,
      useRedis: true,
    });

    if (cached) {
      console.log(`🚀 CACHE HIT! (${Date.now() - startTime}ms)`);
      return cached;
    }

    // NEW: Detect psychological goal for prompt selection
    const goalResult = intentService.detectPsychologicalGoal(query);
    console.log(`\n🎯 PSYCHOLOGICAL GOAL DETECTION...`);
    console.log(`   Goal: ${goalResult.goal} (confidence: ${(goalResult.confidence * 100).toFixed(1)}%)`);
    console.log(`   Reasoning: ${goalResult.reasoning}`);

    // DEPRECATED: Old intent detection (kept for backwards compatibility)
    const intent = intentService.detectIntent(query);

    // QUERY CLASSIFIER: Detect query type and appropriate response style
    console.log(`\n🎯 CLASSIFYING QUERY...`);
    const classification = await queryClassifierService.classifyQuery(query);
    console.log(`   Type: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(1)}%)`);
    console.log(`   Style: ${classification.style}`);
    console.log(`   Reasoning: ${classification.reasoning}`);

    // Map classification style to effective answer length
    const effectiveAnswerLength = this.mapStyleToAnswerLength(classification.style, answerLength);
    console.log(`   Effective Answer Length: ${effectiveAnswerLength} (original: ${answerLength})`);

    // PHASE 2 WEEK 7-8: DETECT TEMPORAL QUERY INTENT
    console.log(`\n⏰ CHECKING FOR TEMPORAL INTENT...`);
    const temporalIntent = versionTrackingService.detectTemporalIntent(query);

    if (temporalIntent.isTemporalQuery) {
      console.log(`   ✅ Temporal query detected: ${temporalIntent.queryType}`);
      return await this.handleTemporalQuery(userId, query, temporalIntent, conversationId);
    }

    console.log(`   ℹ️  Not a temporal query - proceeding with normal processing`);

    // STEP 0: CHECK IF QUERY IS GENERAL KNOWLEDGE (before Pinecone search)
    console.log(`\n🧠 CHECKING QUERY TYPE...`);
    const isGeneralKnowledge = this.detectGeneralKnowledge(query);

    if (isGeneralKnowledge) {
      console.log(`   🌍 General knowledge question detected - answering from AI knowledge`);

      const detectedLang = detectLanguage(query);

      // Check if it's a self-awareness question (about KODA's capabilities)
      const isSelfAwareness = /what (can|do) you do|what are (your|you) (capabilities|features)|how (can|do) you (help|assist)|tell me about (yourself|you|koda)|what kind of (assistant|ai)/i.test(query);

      if (isSelfAwareness) {
        console.log(`   🤖 Self-awareness question - responding with KODA capabilities`);

        const kodaDescription: Record<string, string> = {
          en: `I'm KODA, your intelligent document assistant. I can help you with:

- **Document Q&A**: Ask questions about your uploaded documents and get accurate answers
- **File Management**: Find, locate, rename, and organize your files
- **Content Analysis**: Summarize documents, extract key information, and compare files
- **Multi-format Support**: Work with PDFs, Word docs, Excel sheets, PowerPoints, and more
- **Smart Search**: Find information across all your documents instantly
- **General Knowledge**: Answer general questions beyond your documents

I use advanced AI to understand your questions in natural language and provide helpful, accurate responses.`,

          pt: `Sou KODA, sua assistente inteligente de documentos. Posso ajudá-lo com:

- **Perguntas sobre Documentos**: Faça perguntas sobre seus documentos e obtenha respostas precisas
- **Gerenciamento de Arquivos**: Encontre, localize, renomeie e organize seus arquivos
- **Análise de Conteúdo**: Resuma documentos, extraia informações e compare arquivos
- **Suporte Multi-formato**: Trabalhe com PDFs, Word, Excel, PowerPoint e muito mais
- **Busca Inteligente**: Encontre informações em todos os seus documentos instantaneamente
- **Conhecimento Geral**: Responda perguntas gerais além dos seus documentos

Uso IA avançada para entender suas perguntas em linguagem natural e fornecer respostas úteis e precisas.`,

          es: `Soy KODA, tu asistente inteligente de documentos. Puedo ayudarte con:

- **Preguntas sobre Documentos**: Haz preguntas sobre tus documentos y obtén respuestas precisas
- **Gestión de Archivos**: Encuentra, localiza, renombra y organiza tus archivos
- **Análisis de Contenido**: Resume documentos, extrae información y compara archivos
- **Soporte Multi-formato**: Trabaja con PDFs, Word, Excel, PowerPoint y más
- **Búsqueda Inteligente**: Encuentra información en todos tus documentos al instante
- **Conocimiento General**: Responde preguntas generales más allá de tus documentos

Uso IA avanzada para entender tus preguntas en lenguaje natural y proporcionar respuestas útiles y precisas.`,

          fr: `Je suis KODA, votre assistante intelligente de documents. Je peux vous aider avec:

- **Questions sur Documents**: Posez des questions sur vos documents et obtenez des réponses précises
- **Gestion de Fichiers**: Trouvez, localisez, renommez et organisez vos fichiers
- **Analyse de Contenu**: Résumez documents, extrayez informations et comparez fichiers
- **Support Multi-format**: Travaillez avec PDFs, Word, Excel, PowerPoint et plus
- **Recherche Intelligente**: Trouvez informations dans tous vos documents instantanément
- **Connaissances Générales**: Répondez questions générales au-delà de vos documents

J'utilise l'IA avancée pour comprendre vos questions en langage naturel et fournir des réponses utiles et précises.`
        };

        return {
          answer: kodaDescription[detectedLang] || kodaDescription.en,
          sources: [],
          contextId: `self_awareness_${Date.now()}`,
          intent: 'self_awareness',
        };
      }

      // General knowledge or current information question
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        }
      });

      // Add current date context for time-related questions
      const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const generalPrompt = detectedLang === 'pt'
        ? `Data atual: ${currentDate}. Responda de forma concisa e precisa: ${query}`
        : `Current date: ${currentDate}. Answer concisely and accurately: ${query}`;

      const result = await model.generateContent(generalPrompt);
      const answer = result.response.text();

      return {
        answer,
        sources: [],  // No document sources for general knowledge
        contextId: `general_${Date.now()}`,
        intent: 'general_knowledge',
      };
    }

    console.log(`   📄 Document-specific question - searching user documents`);

    // STEP 1: DETECT QUERY INTENT (Simple approach)
    const queryIntent = queryIntentDetectorService.detectIntent(query);

    // STEP 0.5: CHECK FOR FILE ACTION (BEFORE metadata query)
    console.log(`\n🔧 CHECKING FOR FILE ACTIONS...`);
    const fileAction = fileActionsService.parseFileAction(query);

    if (fileAction) {
      console.log(`   ✅ File action detected: ${fileAction.action}`);
      console.log(`   📋 Params:`, fileAction.params);

      try {
        const actionResult = await fileActionsService.executeAction(query, userId);

        console.log(`   ${actionResult.success ? '✅' : '❌'} Action result: ${actionResult.message}`);

        const detectedLang = detectLanguage(query);

        return {
          answer: actionResult.message,
          sources: [],
          contextId: `file_action_${Date.now()}`,
          intent: `file_action_${fileAction.action}`,
          confidence: actionResult.success ? 1.0 : 0.0
        };
      } catch (error) {
        console.error(`❌ File action execution failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return {
          answer: `Failed to execute file action: ${errorMessage}`,
          sources: [],
          contextId: `file_action_error_${Date.now()}`,
          intent: 'file_action_error',
          confidence: 0.0
        };
      }
    }

    console.log(`   ℹ️  No file action detected - continuing with normal query processing`);

    // STEP 1.1: CHECK FOR METADATA QUERY (NEW - Uses database instead of RAG)
    const metadataQueryResult = intentService.detectMetadataQuery(query);
    const isMetadataQuery = metadataQueryResult.isMetadataQuery;
    console.log(`   🎯 Query Intent: ${queryIntent}`);
    console.log(`   📋 Is Metadata Query: ${isMetadataQuery}`);

    // If metadata query detected, handle it with database lookup (NOT RAG)
    if (isMetadataQuery) {
      console.log(`📊 METADATA QUERY DETECTED: ${metadataQueryResult.type}`);
      console.log(`   Extracted value: ${metadataQueryResult.extractedValue || 'N/A'}`);
      return await this.handleMetadataQuery(userId, query, metadataQueryResult);
    }

    // STEP 1.5: DETECT RESPONSE FORMAT TYPE (ChatGPT Format Analysis)
    const formatClassification = formatTypeClassifierService.classify(query);
    console.log(`   📝 Format Type: ${formatClassification.formatType}`);
    console.log(`   💭 Reason: ${formatClassification.reason}`);

    // FOR FILE TYPES QUERIES: Query database directly for file types (BEFORE Pinecone search)
    if (queryIntent === QueryIntent.FILE_TYPES) {
      console.log(`📁 FILE TYPES QUERY DETECTED - Querying database for file extensions`);

      // Query all user documents directly from database
      const documents = await prisma.document.findMany({
        where: { userId, status: 'completed' },
        select: { filename: true }
      });

      console.log(`   Found ${documents.length} total documents`);

      // Group by file type
      const typeGroups: Record<string, string[]> = {};

      documents.forEach(doc => {
        const ext = doc.filename.split('.').pop()?.toUpperCase() || 'UNKNOWN';
        const fileType = this.mapExtensionToType(ext);

        if (!typeGroups[fileType]) {
          typeGroups[fileType] = [];
        }

        // Store filename without extension
        const nameWithoutExt = doc.filename.replace(/\.[^/.]+$/, '');
        typeGroups[fileType].push(nameWithoutExt);
      });

      // Build response
      let response = 'File types detected:\n\n';

      const sortedTypes = Object.entries(typeGroups).sort((a, b) => b[1].length - a[1].length);

      sortedTypes.forEach(([type, files]) => {
        const fileList = files.slice(0, 3).join(', ');
        const moreCount = files.length > 3 ? ` (and ${files.length - 3} more)` : '';
        response += `• **${type} (${files.length})**: ${fileList}${moreCount}\n`;
      });

      response += '\n**Next actions:**\nYou can filter these by format, preview them, or group by content type (financial, legal, identity, etc.).';

      const responseTime = Date.now() - startTime;
      console.log(`✅ FILE TYPES FORMATTED (${responseTime}ms)`);
      console.log(`   Types: ${Object.keys(typeGroups).length}`);

      return {
        answer: response,
        sources: [],
        contextId: `file_types_${Date.now()}`,
        intent: intent.intent,
        confidence: 1.0
      };
    }

    // STEP 2: SIMPLE RETRIEVAL (Standard Pinecone search)
    console.log(`\n🔍 RETRIEVING DOCUMENTS...`);

    // Detect document from query if not provided (legacy fuzzy matching)
    if (!documentId) {
      const detectedDocId = await this.detectDocumentFromQuery(query, userId);
      if (detectedDocId) {
        console.log(`   🎯 Auto-detected document reference - scoping to: ${detectedDocId}`);
        documentId = detectedDocId;
      }
    }

    // STEP 2.5: DETECT DOCUMENT-SPECIFIC QUERY
    // If query mentions specific document name, filter to ONLY that document
    let scopedDocumentId: string | undefined = documentId;

    if (!documentId) {
      const documentNameMatch = this.extractDocumentNameFromQuery(query);

      if (documentNameMatch) {
        console.log(`   🎯 Document-specific query detected: "${documentNameMatch}"`);

        // ENHANCED: Also detect file type from query (presentations, PDFs, plans, etc.)
        const fileTypeFilter = this.extractFileTypeFromQuery(query);
        const mimeTypeFilter = fileTypeFilter ? this.getMimeTypeFilter(fileTypeFilter) : undefined;

        if (fileTypeFilter) {
          console.log(`   📎 File type filter detected: "${fileTypeFilter}" → MIME: ${mimeTypeFilter}`);
        }

        // Build where clause with optional MIME type filter
        const whereClause: any = {
          userId,
          status: 'completed',
          filename: {
            contains: documentNameMatch,
          },
        };

        if (mimeTypeFilter) {
          whereClause.mimeType = { in: mimeTypeFilter };
        }

        // Find document by name (and optionally by type)
        const matchedDoc = await prisma.document.findFirst({
          where: whereClause,
        });

        if (matchedDoc) {
          scopedDocumentId = matchedDoc.id;
          console.log(`   ✅ Scoped to document: ${matchedDoc.filename} (${scopedDocumentId})`);
        }
      }
    }

    const topK = scopedDocumentId ? 50 : 40;

    // Generate embedding and search Pinecone
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);
    const retrievalResults = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      topK,
      0.3, // minSimilarity
      scopedDocumentId  // ← Use scoped document if detected
    );

    console.log(`   Found ${retrievalResults.length} relevant chunks`);

    // Phase 3: CONFIDENCE GATING - Check if results meet minimum threshold
    // Lower threshold for LIST queries (user just wants filenames, not content accuracy)
    const effectiveThreshold = queryIntent === QueryIntent.LIST ? 0.35 : CONFIDENCE_THRESHOLD;
    console.log(`   📊 Using confidence threshold: ${effectiveThreshold} (Query Intent: ${queryIntent})`);

    const highConfidenceResults = retrievalResults.filter(r => r.similarity >= effectiveThreshold);
    console.log(`   📊 Confidence gating: ${highConfidenceResults.length}/${retrievalResults.length} chunks above ${effectiveThreshold} threshold`);

    // If NO results above confidence threshold, return "I don't know" response
    if (highConfidenceResults.length === 0) {
      console.log(`   ⚠️  ALL RESULTS BELOW CONFIDENCE THRESHOLD - Returning uncertainty response`);

      const detectedLang = detectLanguage(query);

      // Get document name if specific document was queried
      let documentName = 'your documents';
      if (documentId) {
        try {
          const doc = await prisma.document.findUnique({
            where: { id: documentId },
            select: { filename: true }
          });
          if (doc) {
            documentName = doc.filename;
          }
        } catch (error) {
          console.warn('Failed to fetch document name:', error);
        }
      }

      const answer = detectedLang === 'pt'
        ? `Não consegui encontrar informações relevantes sobre "${query}" em ${documentName}.`
        : `I couldn't find relevant information about "${query}" in ${documentName}.`;

      return {
        answer,
        sources: [],
        contextId: `rag_${Date.now()}`,
        intent: intent.intent,
        confidence: 0
      };
    }

    // Use high confidence results for answer generation
    if (retrievalResults.length === 0) {
      const detectedLang = detectLanguage(query);
      const answer = detectedLang === 'pt'
        ? `Não consegui encontrar informações sobre "${query}".`
        : `I couldn't find information about "${query}".`;

      return {
        answer,
        sources: [],
        contextId: `rag_${Date.now()}`,
        intent: intent.intent,
        confidence: 0
      };
    }

    // Step 3: Prepare sources from high-confidence results
    const sources: RAGSource[] = highConfidenceResults.map(result => ({
      documentId: result.documentId,
      documentName: result.document?.filename || 'Unknown', // ✅ Fixed: use result.document.filename
      chunkIndex: result.chunkIndex || 0,
      content: result.content,
      similarity: result.similarity,
      metadata: result.metadata,
      location: result.metadata?.pageNumber
        ? `Page ${result.metadata.pageNumber}`
        : result.metadata?.slideNumber
        ? `Slide ${result.metadata.slideNumber}`
        : result.metadata?.cellReference
        ? `Cell ${result.metadata.cellReference}`
        : undefined
    }));

    // Sort by similarity
    sources.sort((a, b) => b.similarity - a.similarity);

    // Deduplicate by document (keep highest scoring chunk per document)
    const seenDocs = new Set<string>();
    const uniqueSources = sources.filter(s => {
      if (seenDocs.has(s.documentId)) return false;
      seenDocs.add(s.documentId);
      return true;
    });

    // Limit to top sources
    let finalSources = uniqueSources.slice(0, 5);

    // ANTI-STALE-DATA: Validate all source documentIds exist in database
    console.log(`🔍 VALIDATING SOURCES AGAINST DATABASE...`);
    finalSources = await this.validateSourcesExist(finalSources, userId);
    console.log(`   ✅ Validated: ${finalSources.length} sources confirmed to exist`);

    // Calculate average confidence early (needed for synthesis returns)
    const avgConfidence = finalSources.length > 0
      ? finalSources.reduce((sum, s) => sum + s.similarity, 0) / finalSources.length
      : 0;

    // PHASE 2 WEEK 5-6: DETECT MULTI-DOCUMENT SYNTHESIS INTENT
    const uniqueDocumentIds = [...new Set(sources.map(s => s.documentId))];
    const requiresSynthesis = synthesisService.detectSynthesisIntent(query, uniqueDocumentIds.length);

    if (requiresSynthesis && uniqueDocumentIds.length >= 2) {
      console.log(`🔄 SYNTHESIS DETECTED - Multi-document analysis required`);
      console.log(`   Documents involved: ${uniqueDocumentIds.length}`);

      // Prepare documents for synthesis
      const documentsForSynthesis = sources.slice(0, 20).map(s => ({
        documentId: s.documentId,
        documentName: s.documentName,
        content: s.content,
        metadata: s.metadata
      }));

      // Determine synthesis type based on query patterns
      const queryLower = query.toLowerCase();
      let synthesisResult;

      if (queryLower.includes('compare') || queryLower.includes('difference') || queryLower.includes('similar')) {
        console.log(`   📊 Running COMPARISON analysis...`);
        const comparison = await synthesisService.compareDocuments(
          documentsForSynthesis.map(d => ({
            documentName: d.documentName,
            content: d.content
          }))
        );

        // Format comparison results
        let answer = `**Document Comparison:**\n\n`;
        answer += `**Similarities:**\n${comparison.similarities.map(s => `• ${s}`).join('\n')}\n\n`;
        answer += `**Differences:**\n${comparison.differences.map(d => `• ${d}`).join('\n')}\n\n`;
        answer += `**Summary:**\n${comparison.summary}`;

        return {
          answer,
          sources: finalSources,
          contextId: `synthesis_comparison_${Date.now()}`,
          intent: 'synthesis_comparison',
          confidence: avgConfidence
        };
      } else if (queryLower.includes('trend') || queryLower.includes('change') || queryLower.includes('over time')) {
        console.log(`   📈 Running TREND analysis...`);
        const trends = await synthesisService.analyzeTrends(
          documentsForSynthesis.map(d => ({
            documentName: d.documentName,
            content: d.content,
            metadata: d.metadata
          }))
        );

        // Format trend results
        let answer = `**Trend Analysis:**\n\n`;
        answer += `**Trends Identified:**\n${trends.trends.map(t => `• ${t}`).join('\n')}\n\n`;
        answer += `**Changes Detected:**\n${trends.changes.map(c => `• ${c}`).join('\n')}\n\n`;
        answer += `**Summary:**\n${trends.summary}`;

        return {
          answer,
          sources: finalSources,
          contextId: `synthesis_trends_${Date.now()}`,
          intent: 'synthesis_trends',
          confidence: avgConfidence
        };
      } else {
        console.log(`   🔄 Running FULL synthesis analysis...`);
        synthesisResult = await synthesisService.synthesizeAcrossDocuments(
          query,
          documentsForSynthesis
        );

        // Format synthesis results
        let answer = `${synthesisResult.synthesis}\n\n`;

        if (synthesisResult.patterns.length > 0) {
          answer += `**Patterns Identified:**\n${synthesisResult.patterns.map(p => `• ${p}`).join('\n')}\n\n`;
        }

        if (synthesisResult.insights.length > 0) {
          answer += `**Key Insights:**\n${synthesisResult.insights.map(i => `• ${i}`).join('\n')}\n\n`;
        }

        answer += `**Sources:**\n${synthesisResult.sources.map(s => `• ${s.documentName}`).join('\n')}`;

        return {
          answer,
          sources: finalSources,
          contextId: `synthesis_${Date.now()}`,
          intent: 'synthesis',
          confidence: avgConfidence
        };
      }
    }

    // FOR LIST QUERIES: Skip AI generation, format list directly
    if (queryIntent === QueryIntent.LIST && isMetadataQuery) {
      console.log(`🎯 LIST QUERY DETECTED - Formatting list directly (bypassing AI)`);

      // Extract unique document names
      const documentNames = sources.map(s => s.documentName);
      const uniqueNames = [...new Set(documentNames)];
      console.log(`   Found ${uniqueNames.length} unique documents (${documentNames.length} total chunks)`);

      // Generate contextual opening statement based on query
      const queryLower = query.toLowerCase();
      let openingStatement = '';
      if (queryLower.includes('related to') || queryLower.includes('about')) {
        const topic = query.match(/(?:related to|about)\s+(.+?)(?:\?|$)/i)?.[1] || 'this topic';
        openingStatement = `Documents containing information about "${topic.trim()}":`;
      } else if (queryLower.includes('portuguese') || queryLower.includes('language')) {
        openingStatement = `Detected Portuguese-language documents:`;
      } else {
        openingStatement = `Found ${uniqueNames.length} relevant document${uniqueNames.length > 1 ? 's' : ''}:`;
      }

      // Format as bullet list with single line breaks
      const bulletList = uniqueNames.map(name => `• ${name}`).join('\n');

      // Generate contextual "Next actions" suggestion
      let nextActions = 'Next actions:\nWould you like me to summarize the content across these documents or focus on a specific one?';
      if (queryLower.includes('koda')) {
        nextActions = 'Next actions:\nWould you like me to summarize Koda\'s product vision across these documents or highlight key differences between them?';
      } else if (queryLower.includes('portuguese')) {
        nextActions = 'Next actions:\nTranslate or summarize these documents in English if needed.';
      }

      // Build complete response with opening, list, and next actions
      const formattedResponse = `${openingStatement}\n${bulletList}\n\n${nextActions}`;

      const responseTime = Date.now() - startTime;
      console.log(`✅ LIST FORMATTED (${responseTime}ms)`);
      console.log(`   Documents: ${uniqueNames.length}`);

      const response: RAGResponse = {
        answer: formattedResponse,
        sources: finalSources,
        contextId: `rag_list_${Date.now()}`,
        intent: intent.intent,
        confidence: 1.0 // High confidence for direct list
      };

      // Cache the result
      await cacheService.set(cacheKey, response, {
        ttl: 3600,
        useMemory: true,
        useRedis: true,
      });

      return response;
    }

    // Step 4: Build context from sources
    const context = sources
      .slice(0, 10) // Use top 10 chunks for context
      .map((s, idx) => {
        const locationStr = s.location ? ` (${s.location})` : '';
        return `[Document ${idx + 1}: ${s.documentName}${locationStr}]\n${s.content}`;
      })
      .join('\n\n---\n\n');

    // STEP 4.5: RETRIEVE CONVERSATION HISTORY
    console.log(`\n💬 RETRIEVING CONVERSATION HISTORY...`);
    let conversationHistoryMessages: Array<{ role: string; content: string }> = [];

    if (conversationId) {
      try {
        const previousMessages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
          take: 10, // Last 10 messages for context (5 exchanges)
        });

        conversationHistoryMessages = previousMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        console.log(`   Found ${conversationHistoryMessages.length} previous messages`);
      } catch (error) {
        console.error(`   ❌ Error retrieving conversation history:`, error);
        // Continue without history if retrieval fails
      }
    } else {
      console.log(`   No conversation ID provided - skipping history`);
    }

    // STEP 4.6: GET ATTACHED DOCUMENT INFO (if documentId provided)
    let attachedDocumentInfo: { documentId: string; documentName: string } | undefined = undefined;
    if (documentId) {
      try {
        const attachedDoc = await prisma.document.findUnique({
          where: { id: documentId },
          select: { id: true, filename: true }
        });

        if (attachedDoc) {
          attachedDocumentInfo = {
            documentId: attachedDoc.id,
            documentName: attachedDoc.filename
          };
          console.log(`   📎 Attached document info: "${attachedDoc.filename}"`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to fetch attached document info:`, error);
      }
    }

    // NEW: Use psychological goal-based adaptive prompt
    console.log(`🤖 GENERATING ANSWER (ADAPTIVE PROMPT SYSTEM)...`);
    console.log(`   Psychological Goal: ${goalResult.goal}`);
    console.log(`   Answer Length: ${effectiveAnswerLength} (Query Type: ${classification.type})`);

    // Build psychological goal-based system prompt (NEW ARCHITECTURE)
    const promptConfig = systemPromptsService.getPromptConfigForGoal(goalResult.goal, effectiveAnswerLength);
    const fullPrompt = systemPromptsService.buildPromptForGoal(
      goalResult.goal,
      query,
      context,
      effectiveAnswerLength,
      conversationHistoryMessages,  // ← Pass conversation history
      attachedDocumentInfo  // ← NEW: Pass attached document info
    );

    // Get query-specific temperature and max tokens from classifier
    const classifierMaxTokens = queryClassifierService.getMaxTokens(classification.style);
    const classifierTemperature = queryClassifierService.getTemperature(classification.type);

    console.log(`   🎛️  Classifier Settings: maxTokens=${classifierMaxTokens}, temperature=${classifierTemperature}`);

    // Generate answer with query-specific temperature and token limits
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: Math.min(promptConfig.maxTokens, classifierMaxTokens), // Use stricter limit
        temperature: classifierTemperature, // Use query-specific temperature
      }
    });

    const result = await model.generateContent(fullPrompt);
    const rawAnswer = result.response.text();

    // Get finish reason for truncation detection
    const finishReason = result.response.candidates?.[0]?.finishReason;

    // COMPLETION DETECTION: Check if response was truncated
    const isTruncated = this.detectTruncation(rawAnswer, finishReason);
    if (isTruncated.truncated) {
      console.warn(`⚠️ TRUNCATED RESPONSE DETECTED`);
      console.warn(`   Reason: ${isTruncated.reason}`);
      console.warn(`   Last 100 chars: "${rawAnswer.slice(-100)}"`);
      console.warn(`   Suggestion: Increase maxOutputTokens or use shorter answer length`);
    }

    const responseTime = Date.now() - startTime;

    console.log(`✅ RAW ANSWER GENERATED (${responseTime}ms)`);
    console.log(`   Length: ${rawAnswer.length} characters`);
    console.log(`   Sources: ${finalSources.length} documents`);
    console.log(`   Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    // Format the response using KODA's professional formatting system
    console.log(`🎨 FORMATTING RESPONSE...`);
    const formatterContext = {
      queryLength: query.length,
      documentCount: finalSources.length,
      intentType: intent.intent,
      chunks: highConfidenceResults,
      hasFinancialData: highConfidenceResults.some(r =>
        /\$|USD|EUR|revenue|expense|budget|cost|price|profit|loss/i.test(r.content)
      ),
      hasMultipleSheets: highConfidenceResults.some(r =>
        r.metadata?.sheetName
      ),
      hasSlides: highConfidenceResults.some(r =>
        r.metadata?.slideNumber
      ),
    };

    const formattedAnswer = await responseFormatterService.formatResponse(
      rawAnswer,
      formatterContext,
      finalSources,
      query
    );

    console.log(`✅ RESPONSE FORMATTED`);
    console.log(`   Original length: ${rawAnswer.length} characters`);
    console.log(`   Formatted length: ${formattedAnswer.length} characters`);

    // ANTI-HALLUCINATION: Validate all filenames mentioned in response
    console.log(`🔍 VALIDATING FILENAMES IN RESPONSE...`);
    const validatedAnswer = await this.validateFilenamesInResponse(formattedAnswer, userId);

    // PHASE 1 WEEK 2: Validate answer quality
    console.log(`✅ VALIDATING ANSWER QUALITY...`);
    const validation = validationService.validateAnswer(
      validatedAnswer,
      query,
      finalSources,
      avgConfidence
    );
    console.log(`   Confidence: ${validation.confidence}`);
    console.log(`   Should show: ${validation.shouldShow}`);
    if (validation.issues.length > 0) {
      console.log(`   Issues: ${validation.issues.join(', ')}`);
    }

    // Build final answer with validation and enhancements
    let finalAnswer = validatedAnswer;
    if (!validation.shouldShow) {
      // Low quality answer - show fallback message
      console.log(`   ⚠️ Answer quality below threshold - showing fallback`);
      finalAnswer = validationService.generateFallbackMessage(validation, query);
    } else {
      // Add confidence indicator if needed (medium/low confidence)
      if (validation.confidence !== 'high') {
        console.log(`   ⚠️ Adding confidence indicator for ${validation.confidence} confidence`);
        finalAnswer = validationService.addConfidenceIndicator(finalAnswer, validation.confidence);
      }

      // PHASE 1 WEEK 4: Add proactive suggestions
      console.log(`💡 GENERATING PROACTIVE SUGGESTIONS...`);
      const suggestions = proactiveSuggestionsService.generateAndFormat(
        query,
        finalSources,
        intent.intent
      );
      if (suggestions) {
        console.log(`   Added ${proactiveSuggestionsService.generateSuggestions(query, finalSources, intent.intent).length} suggestions`);
        finalAnswer += suggestions;
      }
    }

    const response: RAGResponse = {
      answer: finalAnswer,
      sources: finalSources,
      contextId: `rag_${Date.now()}`,
      intent: intent.intent,
      confidence: avgConfidence
    };

    // Cache the result
    await cacheService.set(cacheKey, response, {
      ttl: 3600,
      useMemory: true,
      useRedis: true,
    });

    return response;
  }

  /**
   * Extract search phrase from mentions query
   * Examples:
   * - "Find all mentions of revenue" → "revenue"
   * - "Search for air property" → "air property"
   * - "Which files contain IRR" → "IRR"
   */
  private extractSearchPhrase(query: string): string | null {
    const patterns = [
      /find (?:all )?mentions? of ["']?([^"']+)["']?/i,
      /search for ["']?([^"']+)["']?/i,
      /which (?:files?|documents?) contain ["']?([^"']+)["']?/i,
      /locate mentions? of ["']?([^"']+)["']?/i,
      /where (?:is|are) ["']?([^"']+)["']? mentioned/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: if query starts with search/find/locate, take everything after
    const fallbackMatch = query.match(/^(?:search|find|locate)\s+(.+)$/i);
    if (fallbackMatch && fallbackMatch[1]) {
      return fallbackMatch[1].trim();
    }

    return null;
  }

  /**
   * Detect if query is general knowledge vs. document-specific
   * Enhanced with self-awareness and broader world knowledge
   */
  private detectGeneralKnowledge(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    // Document-specific indicators (override general knowledge)
    const documentSpecificPatterns = [
      /in (this|the|my) document/i,
      /according to (the|my) (document|file)/i,
      /from (the|my) (document|file|spreadsheet|presentation)/i,
      /in (the|my) (spreadsheet|excel|powerpoint|pdf)/i,
      /what (files|documents) (do i have|are|contain)/i,
      /list (my|all) (files|documents)/i,
    ];

    // First check if it's explicitly document-specific
    if (documentSpecificPatterns.some(pattern => pattern.test(lowerQuery))) {
      return false;  // It's document-specific
    }

    // General knowledge indicators
    const generalKnowledgePatterns = [
      // Self-awareness questions (about KODA's capabilities)
      /what (can|do) you do/i,
      /what are (your|you) (capabilities|features)/i,
      /how (can|do) you (help|assist)/i,
      /what (is|are) (your|you) (purpose|function)/i,
      /tell me about (yourself|you|koda)/i,
      /what kind of (assistant|ai) are you/i,

      // Current information (date, time, version)
      /what (is|'s) (the|today's|todays) (date|time|day)/i,
      /what (year|month|day) is it/i,
      /current (date|time|year)/i,

      // Geography
      /what is the capital of/i,
      /where is .* located/i,
      /which country/i,
      /population of/i,

      // Science & Technology
      /what is .* in (physics|chemistry|biology)/i,
      /how does .* work/i,
      /what causes/i,
      /scientific (explanation|definition)/i,

      // History
      /when did .* happen/i,
      /who (invented|discovered|created)/i,
      /in what year/i,
      /historical (event|fact)/i,

      // Math & Calculations
      /what is \d+ [\+\-\*\/] \d+/i,
      /calculate/i,
      /solve this (equation|problem)/i,

      // General definitions & concepts
      /what does .* mean$/i,
      /define [a-z\s]+$/i,
      /explain (the concept of|what is)/i,
      /difference between .* and/i,

      // Famous people & entities
      /who (is|was)/i,
      /biography of/i,
      /known for/i,

      // Programming & Tech (general)
      /how to (code|program|develop)/i,
      /what is (python|javascript|typescript|react|node)/i,
      /programming (language|concept)/i,

      // Business & Economics (general)
      /what is (gdp|inflation|stock market)/i,
      /economic (principle|theory)/i,
      /business (concept|strategy)/i,
    ];

    // Check if it matches general knowledge patterns
    if (generalKnowledgePatterns.some(pattern => pattern.test(lowerQuery))) {
      return true;  // It's general knowledge
    }

    // Default: assume document-specific (safer)
    return false;
  }

  /**
   * Detect document reference from query using fuzzy matching
   * Examples:
   * - "what is koda business plan about" → "Koda Business Plan V12.pdf"
   * - "tell me about the Q1 report" → "Q1_Report_2025.pdf"
   * - "summarize the contract" → "Contract_Final.pdf"
   */
  private async detectDocumentFromQuery(query: string, userId: string): Promise<string | null> {
    const documentNamePatterns = [
      // Exact filename mentions (e.g., "koda_plan.pdf")
      /about ([^\s]+\.(?:pdf|docx?|xlsx?|pptx?|txt|csv))/i,

      // "X document/file" (e.g., "about the koda document")
      /(?:about|in|from|the) (?:the )?(.+?) (?:document|file|pdf|spreadsheet|presentation|sheet)/i,

      // Descriptive references (e.g., "what is koda business plan")
      /(?:what is|about|tell me about|summarize|explain) (?:the )?(.+?)(?:\?|$|about)/i,
    ];

    // Try each pattern
    for (const pattern of documentNamePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const potentialName = match[1].trim();

        // Skip if it's too generic
        if (potentialName.length < 3 || /^(it|this|that|the|a|an)$/i.test(potentialName)) {
          continue;
        }

        console.log(`   🔍 Searching for document matching: "${potentialName}"`);

        // Get all user documents
        const userDocuments = await prisma.document.findMany({
          where: {
            userId,
            status: { not: 'deleted' }
          },
          select: { id: true, filename: true }
        });

        // Find best match using fuzzy matching
        const documentMatch = userDocuments.find(doc => {
          const docNameLower = doc.filename.toLowerCase();
          const queryNameLower = potentialName.toLowerCase();

          // Exact match
          if (docNameLower === queryNameLower) {
            console.log(`   ✅ Exact match found: "${doc.filename}"`);
            return true;
          }

          // Filename contains query
          if (docNameLower.includes(queryNameLower)) {
            console.log(`   ✅ Partial match found: "${doc.filename}" contains "${potentialName}"`);
            return true;
          }

          // Query contains significant part of filename
          // Remove file extension for better matching
          const docWords = docNameLower.replace(/\.[^.]+$/, '').split(/[\s_-]+/).filter(w => w.length > 2);
          const queryWords = queryNameLower.split(/[\s_-]+/).filter(w => w.length > 2);

          // Count matching words
          const matchingWords = queryWords.filter(qw =>
            docWords.some(dw => dw.includes(qw) || qw.includes(dw))
          );

          // Match if >50% of query words match document words
          const matchRatio = matchingWords.length / queryWords.length;
          if (matchRatio > 0.5) {
            console.log(`   ✅ Fuzzy match found: "${doc.filename}" (${Math.round(matchRatio * 100)}% match with "${potentialName}")`);
            return true;
          }

          return false;
        });

        if (documentMatch) {
          return documentMatch.id;
        }
      }
    }

    return null;
  }

  /**
   * Generate answer with STREAMING support using Gemini's generateContentStream()
   * Streams response chunks in real-time for better UX
   */
  async generateAnswerStreaming(
    userId: string,
    query: string,
    conversationId: string,
    answerLength: AnswerLength = 'medium',
    documentId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`🔍 RAG QUERY (STREAMING): "${query}"`);
    console.log(`👤 User: ${userId}`);
    console.log(`📏 Answer Length: ${answerLength}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // ========================================
    // ✅ FIX #1: CHECK CACHE FOR STREAMING
    // ========================================
    const cacheKey = cacheService.generateKey(query, userId, { documentId, answerLength });
    const cached = await cacheService.get<RAGResponse>(cacheKey, {
      ttl: 3600,
      useMemory: true,
      useRedis: true,
    });

    if (cached) {
      console.log(`💾 [CACHE HIT] Returning cached result (${Date.now() - startTime}ms)`);

      // Stream the cached answer if onChunk is provided
      if (onChunk && cached.answer) {
        // Stream cached answer character by character for better UX
        for (const char of cached.answer) {
          onChunk(char);
          await new Promise(resolve => setTimeout(resolve, 5)); // Fast streaming for cached results
        }
      }

      // Return cached result (controller will send "done" signal)
      return cached;
    }

    // STEP 0: DETECT SIMPLE GREETINGS (before chat actions)
    const greetingPatterns = [
      /^(hi|hello|hey|oi|olá|hola|buenos días|bom dia|good morning|good afternoon|good evening)$/i,
      /^(hi|hello|hey|oi|olá|hola)\s+(there|everyone|all)?$/i,
      /^(how are you|como vai|como está|tudo bem|qué tal|cómo estás)\??$/i,
      /^(oi|hi|hello|hey)\s+(tudo bem|how are you|cómo estás)\??$/i,
    ];

    const isGreeting = greetingPatterns.some(p => p.test(query.trim()));

    if (isGreeting) {
      console.log('👋 [RAG] Simple greeting detected - returning friendly response');

      const greetingResponses = {
        en: "Hello! I'm here to help you find information in your documents. What would you like to know?",
        pt: "Olá! Tudo bem por aqui também! Como posso ajudar você hoje?",
        es: "¡Hola! ¿Cómo puedo ayudarte con tus documentos hoy?"
      };

      // Pick response based on query language
      let response = greetingResponses.en;
      if (/oi|olá|tudo bem|bom dia/i.test(query)) {
        response = greetingResponses.pt;  // Portuguese
      } else if (/hola|qué tal|cómo estás|buenos días/i.test(query)) {
        response = greetingResponses.es;  // Spanish
      }

      // Stream the greeting response
      if (onChunk) {
        for (const char of response) {
          onChunk(char);
          await new Promise(resolve => setTimeout(resolve, 20)); // Simulate streaming
        }
      }

      // ✅ Return simple greeting without document info
      return {
        answer: response,
        sources: [],
        contextId: `greeting_${Date.now()}`,
        intent: 'greeting',
        confidence: 1.0,
      };
    }

    // STEP 1: CHECK FOR CHAT ACTIONS
    console.log(`\n🤖 CHECKING FOR CHAT ACTIONS...`);
    const chatActionsService = await import('./chatActions.service');
    const actionResult = await chatActionsService.default.detectAndExecute(userId, query, conversationId);

    if (actionResult.isAction) {
      console.log(`   ✅ Action detected: ${actionResult.actionType}`);

      // For actions, return immediately without streaming using the imported service
      const formatterContext = {
        queryLength: query.length,
        documentCount: 0,
        intentType: actionResult.actionType || 'file_action',
        chunks: [],
        hasFinancialData: false,
        hasMultipleSheets: false,
        hasSlides: false,
      };

      const formattedResponse = await responseFormatterService.formatResponse(
        actionResult.response,
        formatterContext,
        [],
        query
      );

      // Send full action response as single chunk
      if (onChunk) {
        onChunk(formattedResponse);
      }

      return {
        answer: formattedResponse,
        sources: [],
        contextId: `action_${actionResult.actionType}_${Date.now()}`,
        intent: actionResult.actionType,
        confidence: 1.0,
        actionResult: actionResult.result,
        uiUpdate: actionResult.uiUpdate,
      };
    }

    // STEP 2: DETECT INTENT
    console.log(`\n🎯 DETECTING INTENT...`);
    const intent = await intentService.detectIntent(query);
    console.log(`   Intent: ${intent.intent} (confidence: ${(intent.confidence * 100).toFixed(1)}%)`);

    // QUERY CLASSIFIER: Detect query type and appropriate response style
    console.log(`\n🎯 CLASSIFYING QUERY...`);
    const classification = await queryClassifierService.classifyQuery(query);
    console.log(`   Type: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(1)}%)`);
    console.log(`   Style: ${classification.style}`);
    console.log(`   Reasoning: ${classification.reasoning}`);

    // Map classification style to effective answer length
    const effectiveAnswerLength = this.mapStyleToAnswerLength(classification.style, answerLength);
    console.log(`   Effective Answer Length: ${effectiveAnswerLength} (original: ${answerLength})`);

    // DETECT QUERY INTENT (Simple approach)
    const queryIntent = queryIntentDetectorService.detectIntent(query);

    // CHECK FOR METADATA QUERY (NEW - Uses database instead of RAG)
    const metadataQueryResult = intentService.detectMetadataQuery(query);
    const isMetadataQuery = metadataQueryResult.isMetadataQuery;
    console.log(`   🎯 Query Intent: ${queryIntent}`);
    console.log(`   📋 Is Metadata Query: ${isMetadataQuery}`);

    // If metadata query detected, handle it with database lookup (NOT RAG)
    if (isMetadataQuery) {
      console.log(`📊 METADATA QUERY DETECTED IN STREAMING: ${metadataQueryResult.type}`);
      console.log(`   Extracted value: ${metadataQueryResult.extractedValue || 'N/A'}`);

      const metadataResult = await this.handleMetadataQuery(userId, query, metadataQueryResult);

      // Send the result as a streaming chunk
      if (onChunk) {
        onChunk(metadataResult.answer);
      }

      return metadataResult;
    }

    // DETECT RESPONSE FORMAT TYPE (ChatGPT Format Analysis)
    const formatClassification = formatTypeClassifierService.classify(query);
    console.log(`   📝 Format Type: ${formatClassification.formatType}`);
    console.log(`   💭 Reason: ${formatClassification.reason}`);

    // FOR FILE TYPES QUERIES: Query database directly for file types (BEFORE Pinecone search)
    if (queryIntent === QueryIntent.FILE_TYPES) {
      console.log(`📁 FILE TYPES QUERY DETECTED - Querying database for file extensions`);

      // Query all user documents directly from database
      const documents = await prisma.document.findMany({
        where: { userId, status: 'completed' },
        select: { filename: true }
      });

      console.log(`   Found ${documents.length} total documents`);

      // Group by file type
      const typeGroups: Record<string, string[]> = {};

      documents.forEach(doc => {
        const ext = doc.filename.split('.').pop()?.toUpperCase() || 'UNKNOWN';
        const fileType = this.mapExtensionToType(ext);

        if (!typeGroups[fileType]) {
          typeGroups[fileType] = [];
        }

        // Store filename without extension
        const nameWithoutExt = doc.filename.replace(/\.[^/.]+$/, '');
        typeGroups[fileType].push(nameWithoutExt);
      });

      // Build response
      let response = 'File types detected:\n\n';

      const sortedTypes = Object.entries(typeGroups).sort((a, b) => b[1].length - a[1].length);

      sortedTypes.forEach(([type, files]) => {
        const fileList = files.slice(0, 3).join(', ');
        const moreCount = files.length > 3 ? ` (and ${files.length - 3} more)` : '';
        response += `• **${type} (${files.length})**: ${fileList}${moreCount}\n`;
      });

      response += '\n**Next actions:**\nYou can filter these by format, preview them, or group by content type (financial, legal, identity, etc.).';

      const responseTime = Date.now() - startTime;
      console.log(`✅ FILE TYPES FORMATTED (${responseTime}ms)`);
      console.log(`   Types: ${Object.keys(typeGroups).length}`);

      // Send response as chunk
      if (onChunk) {
        onChunk(response);
      }

      return {
        answer: response,
        sources: [],
        contextId: `file_types_${Date.now()}`,
        intent: intent.intent,
        confidence: 1.0
      };
    }

    // STEP 2.5: RETRIEVE CONVERSATION HISTORY
    console.log(`\n💬 RETRIEVING CONVERSATION HISTORY...`);
    let conversationHistoryMessages: Array<{ role: string; content: string }> = [];

    if (conversationId) {
      try {
        const previousMessages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
          take: 10, // Last 10 messages for context (5 exchanges)
        });

        conversationHistoryMessages = previousMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        console.log(`   Found ${conversationHistoryMessages.length} previous messages`);
      } catch (error) {
        console.error(`   ❌ Error retrieving conversation history:`, error);
        // Continue without history if retrieval fails
      }
    } else {
      console.log(`   No conversation ID provided - skipping history`);
    }

    // STEP 3: RETRIEVE DOCUMENTS
    console.log(`\n📚 RETRIEVING DOCUMENTS...`);
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    const searchResults = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      20,      // topK
      0.3,     // minSimilarity
      documentId  // attachedDocumentId
    );

    if (searchResults.length === 0) {
      console.log(`   ⚠️  No documents found for user ${userId}`);
      const noDocsMessage = 'I could not find any relevant documents to answer your question. Please upload documents first.';
      if (onChunk) {
        onChunk(noDocsMessage);
      }
      return {
        answer: noDocsMessage,
        sources: [],
        contextId: `no_docs_${Date.now()}`,
        intent: intent.intent,
        confidence: 0
      };
    }

    // Filter by confidence threshold (lower for LIST queries)
    const effectiveThreshold = queryIntent === QueryIntent.LIST ? 0.35 : CONFIDENCE_THRESHOLD;
    console.log(`   📊 Using confidence threshold: ${effectiveThreshold} (Query Intent: ${queryIntent})`);

    let highConfidenceResults = searchResults.filter(r => r.similarity >= effectiveThreshold);

    if (highConfidenceResults.length === 0) {
      console.log(`   ⚠️  No high-confidence results (threshold: ${effectiveThreshold})`);
      const lowConfMessage = 'I could not find information relevant enough to answer your question confidently.';
      if (onChunk) {
        onChunk(lowConfMessage);
      }
      return {
        answer: lowConfMessage,
        sources: [],
        contextId: `low_conf_${Date.now()}`,
        intent: intent.intent,
        confidence: searchResults[0]?.similarity || 0
      };
    }

    console.log(`   ✅ Found ${highConfidenceResults.length} high-confidence chunks`);

    // FOR COMPARISON QUERIES: Filter by document type and limit to 2 documents
    if (intent.intent === 'compare' && intent.entities?.documentType) {
      console.log(`🔍 COMPARISON QUERY - Filtering by document type: ${intent.entities.documentType}`);

      // Map document type to file extensions
      const extensionMap: Record<string, string[]> = {
        'presentation': ['.pptx', '.ppt'],
        'spreadsheet': ['.xlsx', '.xls'],
        'document': ['.docx', '.doc', '.pdf'],
      };

      const allowedExtensions = extensionMap[intent.entities.documentType] || [];

      // Filter retrieved results by extension
      const beforeCount = highConfidenceResults.length;
      highConfidenceResults = highConfidenceResults.filter(result => {
        const filename = result.document?.filename || result.metadata?.filename || '';
        return allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
      });

      console.log(`   Filtered from ${beforeCount} to ${highConfidenceResults.length} documents by extension`);
    }

    // FOR COMPARISON QUERIES: Limit to 2 documents
    if (intent.intent === 'compare') {
      // Get unique documents (deduplicate chunks)
      const uniqueDocs = new Map<string, any>();

      highConfidenceResults.forEach(result => {
        const docId = result.documentId;
        if (!uniqueDocs.has(docId)) {
          uniqueDocs.set(docId, result);
        }
      });

      console.log(`   Found ${uniqueDocs.size} unique documents`);

      // If more than 2 documents, take top 2 by similarity
      if (uniqueDocs.size > 2) {
        const sortedDocs = Array.from(uniqueDocs.values())
          .sort((a, b) => b.similarity - a.similarity)  // Sort by similarity descending
          .slice(0, 2);  // Take top 2

        // Rebuild highConfidenceResults with only top 2 docs
        const topDocIds = new Set(sortedDocs.map(d => d.documentId));
        highConfidenceResults = highConfidenceResults.filter(r => topDocIds.has(r.documentId));

        console.log(`   Limited to 2 documents for comparison`);
      } else if (uniqueDocs.size < 2) {
        console.warn(`   ⚠️ Only ${uniqueDocs.size} document(s) found for comparison (need at least 2)`);
      }
    }

    // Extract document names from results
    const documentNames = highConfidenceResults.map(r =>
      r.document?.filename || r.metadata?.filename || 'Unknown'
    );

    // FOR LIST QUERIES: Skip AI generation, format list directly
    if (queryIntent === QueryIntent.LIST && isMetadataQuery) {
      console.log(`🎯 LIST QUERY DETECTED - Formatting list directly (bypassing AI)`);

      // Remove duplicates
      const uniqueNames = [...new Set(documentNames)];
      console.log(`   Found ${uniqueNames.length} unique documents (${documentNames.length} total chunks)`);

      // Generate contextual opening statement based on query
      const queryLower = query.toLowerCase();
      let openingStatement = '';
      if (queryLower.includes('related to') || queryLower.includes('about')) {
        const topic = query.match(/(?:related to|about)\s+(.+?)(?:\?|$)/i)?.[1] || 'this topic';
        openingStatement = `Documents containing information about "${topic.trim()}":`;
      } else if (queryLower.includes('portuguese') || queryLower.includes('language')) {
        openingStatement = `Detected Portuguese-language documents:`;
      } else {
        openingStatement = `Found ${uniqueNames.length} relevant document${uniqueNames.length > 1 ? 's' : ''}:`;
      }

      // Format as bullet list with single line breaks
      const bulletList = uniqueNames.map(name => `• ${name}`).join('\n');

      // Generate contextual "Next actions" suggestion
      let nextActions = 'Next actions:\nWould you like me to summarize the content across these documents or focus on a specific one?';
      if (queryLower.includes('koda')) {
        nextActions = 'Next actions:\nWould you like me to summarize Koda\'s product vision across these documents or highlight key differences between them?';
      } else if (queryLower.includes('portuguese')) {
        nextActions = 'Next actions:\nTranslate or summarize these documents in English if needed.';
      }

      // Build complete response with opening, list, and next actions
      const formattedResponse = `${openingStatement}\n${bulletList}\n\n${nextActions}`;

      // Send formatted list directly
      if (onChunk) {
        onChunk(formattedResponse);
      }

      // Build sources for metadata
      const finalSources: RAGSource[] = highConfidenceResults
        .filter((r, idx, self) =>
          self.findIndex(s => s.documentId === r.documentId) === idx
        )
        .slice(0, 10)
        .map(result => ({
          documentId: result.documentId,
          documentName: result.document?.filename || result.metadata?.filename || 'Unknown',
          chunkIndex: result.chunkIndex,
          content: result.content,
          similarity: result.similarity,
          metadata: result.metadata,
          location: result.metadata?.page || result.metadata?.slideNumber || result.metadata?.cellRef
        }));

      const responseTime = Date.now() - startTime;
      console.log(`✅ LIST FORMATTED (${responseTime}ms)`);
      console.log(`   Documents: ${uniqueNames.length}`);

      return {
        answer: formattedResponse,
        sources: finalSources,
        contextId: `rag_list_${Date.now()}`,
        intent: intent.intent,
        confidence: 1.0 // High confidence for direct list
      };
    }

    // PHASE 2 WEEK 5-6: DETECT MULTI-DOCUMENT SYNTHESIS INTENT (STREAMING)
    const sources = highConfidenceResults;
    const uniqueDocumentIds = [...new Set(sources.map(s => s.documentId))];
    const avgConfidence = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length
      : 0;
    const requiresSynthesis = synthesisService.detectSynthesisIntent(query, uniqueDocumentIds.length);

    if (requiresSynthesis && uniqueDocumentIds.length >= 2) {
      console.log(`🔄 SYNTHESIS DETECTED (STREAMING) - Multi-document analysis required`);
      console.log(`   Documents involved: ${uniqueDocumentIds.length}`);

      // Prepare documents for synthesis
      const documentsForSynthesis = sources.slice(0, 20).map(s => ({
        documentId: s.documentId,
        documentName: s.document?.filename || s.metadata?.filename || 'Unknown',
        content: s.content,
        metadata: s.metadata
      }));

      // Determine synthesis type based on query patterns
      const queryLower = query.toLowerCase();

      if (queryLower.includes('compare') || queryLower.includes('difference') || queryLower.includes('similar')) {
        console.log(`   📊 Running COMPARISON analysis (STREAMING)...`);
        const comparison = await synthesisService.compareDocuments(
          documentsForSynthesis.map(d => ({
            documentName: d.documentName,
            content: d.content
          }))
        );

        // Format comparison results
        let answer = `**Document Comparison:**\n\n`;
        answer += `**Similarities:**\n${comparison.similarities.map(s => `• ${s}`).join('\n')}\n\n`;
        answer += `**Differences:**\n${comparison.differences.map(d => `• ${d}`).join('\n')}\n\n`;
        answer += `**Summary:**\n${comparison.summary}`;

        // Stream the complete answer
        if (onChunk) {
          onChunk(answer);
        }

        const finalSources = documentsForSynthesis.map(d => ({
          documentId: d.documentId,
          documentName: d.documentName,
          chunkIndex: 0,
          content: d.content,
          similarity: 1.0,
          metadata: d.metadata,
          location: undefined
        }));

        return {
          answer,
          sources: finalSources,
          contextId: `synthesis_comparison_stream_${Date.now()}`,
          intent: 'synthesis_comparison',
          confidence: avgConfidence
        };
      } else if (queryLower.includes('trend') || queryLower.includes('change') || queryLower.includes('over time')) {
        console.log(`   📈 Running TREND analysis (STREAMING)...`);
        const trends = await synthesisService.analyzeTrends(
          documentsForSynthesis.map(d => ({
            documentName: d.documentName,
            content: d.content,
            metadata: d.metadata
          }))
        );

        // Format trend results
        let answer = `**Trend Analysis:**\n\n`;
        answer += `**Trends Identified:**\n${trends.trends.map(t => `• ${t}`).join('\n')}\n\n`;
        answer += `**Changes Detected:**\n${trends.changes.map(c => `• ${c}`).join('\n')}\n\n`;
        answer += `**Summary:**\n${trends.summary}`;

        // Stream the complete answer
        if (onChunk) {
          onChunk(answer);
        }

        const finalSources = documentsForSynthesis.map(d => ({
          documentId: d.documentId,
          documentName: d.documentName,
          chunkIndex: 0,
          content: d.content,
          similarity: 1.0,
          metadata: d.metadata,
          location: undefined
        }));

        return {
          answer,
          sources: finalSources,
          contextId: `synthesis_trends_stream_${Date.now()}`,
          intent: 'synthesis_trends',
          confidence: avgConfidence
        };
      } else {
        console.log(`   🔄 Running FULL synthesis analysis (STREAMING)...`);
        const synthesisResult = await synthesisService.synthesizeAcrossDocuments(
          query,
          documentsForSynthesis
        );

        // Format synthesis results
        let answer = `${synthesisResult.synthesis}\n\n`;

        if (synthesisResult.patterns.length > 0) {
          answer += `**Patterns Identified:**\n${synthesisResult.patterns.map(p => `• ${p}`).join('\n')}\n\n`;
        }

        if (synthesisResult.insights.length > 0) {
          answer += `**Key Insights:**\n${synthesisResult.insights.map(i => `• ${i}`).join('\n')}\n\n`;
        }

        answer += `**Sources:**\n${synthesisResult.sources.map(s => `• ${s.documentName}`).join('\n')}`;

        // Stream the complete answer
        if (onChunk) {
          onChunk(answer);
        }

        const finalSources = documentsForSynthesis.map(d => ({
          documentId: d.documentId,
          documentName: d.documentName,
          chunkIndex: 0,
          content: d.content,
          similarity: 1.0,
          metadata: d.metadata,
          location: undefined
        }));

        return {
          answer,
          sources: finalSources,
          contextId: `synthesis_stream_${Date.now()}`,
          intent: 'synthesis',
          confidence: avgConfidence
        };
      }
    }

    // Build context from chunks
    const context = highConfidenceResults
      .map((result, index) => `[Source ${index + 1}]: ${result.content}`)
      .join('\n\n');

    let finalSources: RAGSource[] = highConfidenceResults.map((result, index) => ({
      documentId: result.documentId,
      documentName: result.document?.filename || result.metadata?.filename || 'Unknown',
      chunkIndex: result.chunkIndex,
      content: result.content,
      similarity: result.similarity,
      metadata: result.metadata,
      location: result.metadata?.page || result.metadata?.slideNumber || result.metadata?.cellRef
    }));

    // Deduplicate sources by document (keep highest scoring chunk per document)
    const seenDocs = new Set<string>();
    const uniqueSources = finalSources.filter(s => {
      if (seenDocs.has(s.documentId)) return false;
      seenDocs.add(s.documentId);
      return true;
    });

    // For COMPARISON queries: limit to 2 sources (since comparing 2 documents)
    // For other queries: limit to 5 sources
    const sourceLimit = intent.intent === 'compare' ? 2 : 5;
    finalSources = uniqueSources.slice(0, sourceLimit);

    console.log(`   📋 Sources: ${highConfidenceResults.length} chunks → ${uniqueSources.length} unique docs → ${finalSources.length} final sources`);

    // STEP 3.5: GET ATTACHED DOCUMENT INFO (if documentId provided)
    let attachedDocumentInfo: { documentId: string; documentName: string } | undefined = undefined;
    if (documentId) {
      try {
        const attachedDoc = await prisma.document.findUnique({
          where: { id: documentId },
          select: { id: true, filename: true }
        });

        if (attachedDoc) {
          attachedDocumentInfo = {
            documentId: attachedDoc.id,
            documentName: attachedDoc.filename
          };
          console.log(`   📎 Attached document info: "${attachedDoc.filename}"`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to fetch attached document info:`, error);
      }
    }

    // STEP 4: BUILD PROMPT WITH CONVERSATION HISTORY AND PSYCHOLOGICAL GOAL
    // Use psychological goal-based adaptive prompt system
    const goalResult = intentService.detectPsychologicalGoal(query);
    const promptConfig = systemPromptsService.getPromptConfigForGoal(goalResult.goal, effectiveAnswerLength);
    const fullPrompt = systemPromptsService.buildPromptForGoal(
      goalResult.goal,
      query,
      context,
      effectiveAnswerLength,
      conversationHistoryMessages,  // ← Pass conversation history
      attachedDocumentInfo  // ← NEW: Pass attached document info
    );

    // Get query-specific temperature and max tokens from classifier
    const classifierMaxTokens = queryClassifierService.getMaxTokens(classification.style);
    const classifierTemperature = queryClassifierService.getTemperature(classification.type);

    console.log(`   🎛️  Classifier Settings: maxTokens=${classifierMaxTokens}, temperature=${classifierTemperature}`);

    // STEP 5: GENERATE STREAMING ANSWER
    console.log(`\n🤖 GENERATING STREAMING ANSWER...`);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: Math.min(promptConfig.maxTokens, classifierMaxTokens), // Use stricter limit
        temperature: classifierTemperature, // Use query-specific temperature
      }
    });

    // Use generateContentStream for real-time streaming
    let rawAnswer = '';
    let chunkCount = 0;
    let finishReason: string | undefined;

    console.log(`⚡ STREAMING STARTED...`);

    try {
      // Generate stream
      const result = await model.generateContentStream(fullPrompt);

      // Buffer chunks (don't send to client yet - formatting happens after)
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          rawAnswer += chunkText;
          chunkCount++;
          // DON'T send chunk yet - buffer it for formatting
        }
      }

      // Get the final response with finish reason
      const finalResponse = await result.response;
      finishReason = finalResponse.candidates?.[0]?.finishReason;
    } catch (streamError: any) {
      console.error(`❌ STREAMING ERROR:`, streamError);
      console.error(`   Error message: ${streamError.message}`);
      console.error(`   Error stack:`, streamError.stack);
      throw new Error(`Streaming failed: ${streamError.message}`);
    }

    // CRITICAL: Log finish reason prominently to detect truncation
    console.log(`\n🏁 GEMINI FINISH REASON: ${finishReason}`);
    console.log(`   maxOutputTokens: ${Math.min(promptConfig.maxTokens, classifierMaxTokens)}`);
    console.log(`   Response Length: ${rawAnswer.length} characters`);

    if (finishReason === 'MAX_TOKENS') {
      console.error(`\n🚨 RESPONSE TRUNCATED DUE TO TOKEN LIMIT 🚨`);
      console.error(`   The AI response was cut off mid-sentence because it hit the maxOutputTokens limit`);
      console.error(`   Last 150 chars: "${rawAnswer.slice(-150)}"`);
      console.error(`   Solution: Increase maxOutputTokens in systemPrompts.service.ts`);
      console.error(`   Current limit: ${Math.min(promptConfig.maxTokens, classifierMaxTokens)} tokens\n`);
    }

    // COMPLETION DETECTION: Check if response was truncated
    const isTruncated = this.detectTruncation(rawAnswer, finishReason);
    if (isTruncated.truncated && finishReason !== 'MAX_TOKENS') {
      // Only log if not already logged above
      console.warn(`⚠️ TRUNCATED RESPONSE DETECTED`);
      console.warn(`   Reason: ${isTruncated.reason}`);
      console.warn(`   Last 100 chars: "${rawAnswer.slice(-100)}"`);
      console.warn(`   Suggestion: Increase maxOutputTokens or use shorter answer length`);
    }

    const responseTime = Date.now() - startTime;
    const finalAvgConfidence = finalSources.reduce((sum, s) => sum + s.similarity, 0) / finalSources.length;

    console.log(`✅ STREAMING COMPLETE (${responseTime}ms)`);
    console.log(`   Chunks: ${chunkCount}`);
    console.log(`   Raw Length: ${rawAnswer.length} characters`);
    console.log(`   Saving to DB: ${rawAnswer.substring(0, 100)}...`);
    console.log(`   Sources: ${finalSources.length} documents`);
    console.log(`   Avg Confidence: ${(finalAvgConfidence * 100).toFixed(1)}%`);

    // Format the complete response (for both client and database)
    const formatterContext = {
      queryLength: query.length,
      documentCount: finalSources.length,
      intentType: intent.intent,
      chunks: highConfidenceResults,
      hasFinancialData: highConfidenceResults.some(r =>
        /\$|USD|EUR|revenue|expense|budget|cost|price|profit|loss/i.test(r.content)
      ),
      hasMultipleSheets: highConfidenceResults.some(r =>
        r.metadata?.sheetName
      ),
      hasSlides: highConfidenceResults.some(r =>
        r.metadata?.slideNumber
      ),
    };

    const formattedAnswer = await responseFormatterService.formatResponse(
      rawAnswer,
      formatterContext,
      finalSources,
      query
    );

    console.log(`✅ RESPONSE FORMATTED`);
    console.log(`   Original length: ${rawAnswer.length} characters`);
    console.log(`   Formatted length: ${formattedAnswer.length} characters`);

    // PHASE 1 WEEK 2: Validate answer quality (STREAMING)
    console.log(`✅ VALIDATING ANSWER QUALITY (STREAMING)...`);
    const validation = validationService.validateAnswer(
      formattedAnswer,
      query,
      finalSources,
      finalAvgConfidence
    );
    console.log(`   Confidence: ${validation.confidence}`);
    console.log(`   Should show: ${validation.shouldShow}`);
    if (validation.issues.length > 0) {
      console.log(`   Issues: ${validation.issues.join(', ')}`);
    }

    // Build final answer with validation and enhancements
    let finalAnswer = formattedAnswer;
    if (!validation.shouldShow) {
      // Low quality answer - show fallback message
      console.log(`   ⚠️ Answer quality below threshold - showing fallback`);
      finalAnswer = validationService.generateFallbackMessage(validation, query);
    } else {
      // Add confidence indicator if needed (medium/low confidence)
      if (validation.confidence !== 'high') {
        console.log(`   ⚠️ Adding confidence indicator for ${validation.confidence} confidence`);
        finalAnswer = validationService.addConfidenceIndicator(finalAnswer, validation.confidence);
      }

      // PHASE 1 WEEK 4: Add proactive suggestions (STREAMING)
      console.log(`💡 GENERATING PROACTIVE SUGGESTIONS (STREAMING)...`);
      const suggestions = proactiveSuggestionsService.generateAndFormat(
        query,
        finalSources,
        intent.intent
      );
      if (suggestions) {
        console.log(`   Added ${proactiveSuggestionsService.generateSuggestions(query, finalSources, intent.intent).length} suggestions`);
        finalAnswer += suggestions;
      }
    }

    // ✅ FIX #4: Apply response post-processing for consistent formatting
    const responsePostProcessor = require('./responsePostProcessor.service').default;
    finalAnswer = responsePostProcessor.fullProcess(finalAnswer, intent.intent, finalSources);
    console.log(`   ✅ Applied response post-processing`);

    // Send final enhanced answer to client as single chunk
    if (onChunk) {
      onChunk(finalAnswer);
    }

    // Save final enhanced answer to database (prevents truncation on refresh)
    const response: RAGResponse = {
      answer: finalAnswer, // ✅ Save enhanced answer with validation and suggestions
      sources: finalSources,
      contextId: `rag_stream_${Date.now()}`,
      intent: intent.intent,
      confidence: finalAvgConfidence
    };

    // Cache the result (reuse cacheKey from beginning of function)
    await cacheService.set(cacheKey, response, {
      ttl: 3600,
      useMemory: true,
      useRedis: true,
    });

    return response;
  }

  /**
   * Map file extension to user-friendly type name
   */
  private mapExtensionToType(ext: string): string {
    const typeMap: Record<string, string> = {
      'PDF': 'PDFs',
      'DOCX': 'Word Documents',
      'DOC': 'Word Documents',
      'XLSX': 'Excel Spreadsheets',
      'XLS': 'Excel Spreadsheets',
      'PPTX': 'PowerPoint Presentations',
      'PPT': 'PowerPoint Presentations',
      'PNG': 'Images',
      'JPG': 'Images',
      'JPEG': 'Images',
      'GIF': 'Images',
      'TXT': 'Text Files',
      'CSV': 'CSV Files',
    };

    return typeMap[ext] || `${ext} Files`;
  }

  /**
   * Detect if a response was truncated mid-sentence
   * Returns: { truncated: boolean, reason: string }
   */
  private detectTruncation(
    text: string,
    finishReason?: string
  ): { truncated: boolean; reason: string } {
    // Check 1: Finish reason indicates truncation
    if (finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH') {
      return {
        truncated: true,
        reason: `Gemini finish reason: ${finishReason}`
      };
    }

    // Check 2: Text ends with incomplete markdown formatting
    const incompleteMarkdownPatterns = [
      /\*\*[^*]+$/,        // Ends with "**Text" (unclosed bold)
      /\*[^*]+$/,          // Ends with "*Text" (unclosed italic)
      /\[[^\]]+$/,         // Ends with "[Text" (unclosed link/reference)
      /`[^`]+$/,           // Ends with "`Text" (unclosed code)
      /#{1,6}\s+\w+$/,     // Ends with "## Head" (incomplete heading)
    ];

    for (const pattern of incompleteMarkdownPatterns) {
      if (pattern.test(text.trim())) {
        return {
          truncated: true,
          reason: 'Incomplete markdown formatting detected'
        };
      }
    }

    // Check 3: Text doesn't end with proper sentence terminator
    const trimmed = text.trim();
    const lastChar = trimmed[trimmed.length - 1];
    const properEndings = ['.', '!', '?', ':', ')', ']', '"', '`'];

    // Allow responses ending with "Next actions:" section
    const endsWithNextActions = /Next actions:\s*$/i.test(trimmed);

    if (!properEndings.includes(lastChar) && !endsWithNextActions) {
      // Exception: Lists ending with bullet points are OK
      const endsWithBulletPoint = /•\s+[^•]+$/.test(trimmed);
      if (!endsWithBulletPoint) {
        return {
          truncated: true,
          reason: `Ends with '${lastChar}' instead of proper terminator`
        };
      }
    }

    // Check 4: Response is suspiciously short (< 20 chars) unless it's a direct answer
    if (trimmed.length < 20 && !trimmed.startsWith('Document:')) {
      return {
        truncated: true,
        reason: 'Response suspiciously short (< 20 characters)'
      };
    }

    // No truncation detected
    return { truncated: false, reason: '' };
  }
}

export default new RAGService();
export { RAGService, RAGResponse, RAGSource };
