/**
 * ============================================================================
 * KODA - UNIFIED INTENT DETECTION SERVICE
 * ============================================================================
 *
 * This service consolidates 4 intent detection services into 1:
 * - intent.service.ts (PsychologicalGoals + Metadata queries)
 * - llmIntentDetector.service.ts (LLM-based file actions)
 * - queryIntentDetector.service.ts (Simple pattern matching)
 * - unifiedIntent.service.ts (Previous unified wrapper)
 *
 * Strategy:
 * 1. Fast-path detection using patterns (saves 3-6 seconds for 80%+ of queries)
 * 2. LLM-based detection for complex file operations (when needed)
 * 3. Unified result format for consistent handling
 *
 * Performance:
 * - Fast-path: <50ms (pattern-based)
 * - LLM detection: 1-2 seconds (only when necessary)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// TYPES
// ============================================================================

export type PsychologicalGoal =
  | 'fast_answer'      // Factual retrieval
  | 'mastery'          // How-to / instructional
  | 'clarity'          // Comparison / analytical
  | 'insight'          // Interpretative / judgment
  | 'control';         // Search-across / comprehensive

export type IntentCategory =
  | 'content_query'      // RAG query for document content
  | 'file_action'        // File operations (create, move, rename, delete)
  | 'metadata_query'     // Database queries (file location, count, list)
  | 'greeting'           // Conversational greeting
  | 'capability'         // Questions about KODA itself
  | 'comparison'         // Compare documents/content
  | 'synthesis';         // Multi-document synthesis

export type MetadataQueryType =
  | 'file_location'     // "where is X", "where can I find X"
  | 'file_count'        // "how many files", "file count"
  | 'file_type'         // "what file types", "what types of files"
  | 'folder_contents'   // "what's in folder X", "show me folder X"
  | 'list_all_files'    // "show me all files", "list all documents"
  | 'list_folders'      // "which folders do i have", "list folders"
  | 'none';

export interface IntentResult {
  // Primary classification
  category: IntentCategory;
  confidence: number;
  reasoning: string;

  // Psychological goal (for response formatting)
  psychologicalGoal: PsychologicalGoal;

  // File action details (if applicable)
  fileAction?: {
    intent: string;
    parameters: Record<string, any>;
  };

  // Metadata query details (if applicable)
  metadataQuery?: {
    isMetadataQuery: boolean;
    type: MetadataQueryType;
    extractedValue?: string;
    confidence: number;
  };

  // Processing hints
  hints: {
    useRAG: boolean;
    useDatabaseQuery: boolean;
    useFileActions: boolean;
    requiresLLM: boolean;
    streamResponse: boolean;
  };

  // Timing info
  detectionTimeMs: number;
  detectionMethod: 'fast-path' | 'llm';
}

// ============================================================================
// INTENT DETECTION SERVICE
// ============================================================================

class IntentDetectionService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    } else {
      console.warn('[IntentDetection] No Gemini API key found - LLM detection disabled');
    }
  }

  /**
   * Main entry point - detect intent with fast-path optimization
   *
   * @param query - The user's query
   * @param conversationHistory - Recent conversation for context resolution
   * @param options - Detection options
   */
  async detect(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    options: {
      useLLMForFileActions?: boolean;
      skipGreetingCheck?: boolean;
    } = {}
  ): Promise<IntentResult> {
    const startTime = Date.now();
    const { useLLMForFileActions = true, skipGreetingCheck = false } = options;

    console.log(`🎯 [INTENT] Analyzing: "${query.substring(0, 50)}..."`);

    // ========================================
    // FAST-PATH DETECTION (Pattern-based)
    // ========================================

    // 1. Greeting check
    if (!skipGreetingCheck) {
      const greetingResult = this.detectGreeting(query);
      if (greetingResult) {
        greetingResult.detectionTimeMs = Date.now() - startTime;
        console.log(`⚡ [INTENT] Fast-path: greeting (${greetingResult.detectionTimeMs}ms)`);
        return greetingResult;
      }
    }

    // 2. Capability query check
    const capabilityResult = this.detectCapabilityQuery(query);
    if (capabilityResult) {
      capabilityResult.detectionTimeMs = Date.now() - startTime;
      console.log(`⚡ [INTENT] Fast-path: capability (${capabilityResult.detectionTimeMs}ms)`);
      return capabilityResult;
    }

    // 3. Metadata query check (file location, count, folder contents)
    const metadataResult = this.detectMetadataQuery(query);
    if (metadataResult.isMetadataQuery) {
      const result = this.buildMetadataQueryResult(metadataResult, query);
      result.detectionTimeMs = Date.now() - startTime;
      console.log(`⚡ [INTENT] Fast-path: metadata_query/${metadataResult.type} (${result.detectionTimeMs}ms)`);
      return result;
    }

    // 4. Comparison query check
    if (this.isComparisonQuery(query)) {
      const result = this.buildComparisonResult(query);
      result.detectionTimeMs = Date.now() - startTime;
      console.log(`⚡ [INTENT] Fast-path: comparison (${result.detectionTimeMs}ms)`);
      return result;
    }

    // 5. Obvious RAG query check (fast-path for content questions)
    if (this.isObviousRAGQuery(query)) {
      const result = this.buildContentQueryResult(query);
      result.detectionTimeMs = Date.now() - startTime;
      console.log(`⚡ [INTENT] Fast-path: content_query (${result.detectionTimeMs}ms)`);
      return result;
    }

    // ========================================
    // FILE ACTION DETECTION (Pattern + Optional LLM)
    // ========================================

    if (this.maybeFileAction(query)) {
      // Try pattern-based first
      const patternResult = this.detectFileActionPattern(query);
      if (patternResult && patternResult.confidence >= 0.9) {
        patternResult.detectionTimeMs = Date.now() - startTime;
        console.log(`⚡ [INTENT] Fast-path: file_action/${patternResult.fileAction?.intent} (${patternResult.detectionTimeMs}ms)`);
        return patternResult;
      }

      // Use LLM for better accuracy on complex file operations
      if (useLLMForFileActions && this.model) {
        try {
          const llmResult = await this.detectIntentWithLLM(query, conversationHistory);
          if (llmResult.confidence > 0.7 && llmResult.intent !== 'rag_query') {
            const result = this.buildFileActionResult(llmResult, query);
            result.detectionTimeMs = Date.now() - startTime;
            result.detectionMethod = 'llm';
            console.log(`🧠 [INTENT] LLM detection: ${llmResult.intent} (${result.detectionTimeMs}ms)`);
            return result;
          }
        } catch (error) {
          console.warn('⚠️ [INTENT] LLM detection failed, using pattern fallback:', error);
        }
      }

      // Return pattern result if we have one
      if (patternResult) {
        patternResult.detectionTimeMs = Date.now() - startTime;
        return patternResult;
      }
    }

    // ========================================
    // DEFAULT: CONTENT QUERY (RAG)
    // ========================================

    const result = this.buildContentQueryResult(query);
    result.detectionTimeMs = Date.now() - startTime;
    console.log(`⚡ [INTENT] Default: content_query (${result.detectionTimeMs}ms)`);
    return result;
  }

  /**
   * Synchronous fast-path only detection (no LLM)
   * Use when speed is critical and accuracy can be lower
   */
  detectSync(query: string): IntentResult {
    const startTime = Date.now();

    // Greeting
    const greetingResult = this.detectGreeting(query);
    if (greetingResult) {
      greetingResult.detectionTimeMs = Date.now() - startTime;
      return greetingResult;
    }

    // Capability
    const capabilityResult = this.detectCapabilityQuery(query);
    if (capabilityResult) {
      capabilityResult.detectionTimeMs = Date.now() - startTime;
      return capabilityResult;
    }

    // Metadata
    const metadataResult = this.detectMetadataQuery(query);
    if (metadataResult.isMetadataQuery) {
      const result = this.buildMetadataQueryResult(metadataResult, query);
      result.detectionTimeMs = Date.now() - startTime;
      return result;
    }

    // Comparison
    if (this.isComparisonQuery(query)) {
      const result = this.buildComparisonResult(query);
      result.detectionTimeMs = Date.now() - startTime;
      return result;
    }

    // File action pattern
    const fileActionResult = this.detectFileActionPattern(query);
    if (fileActionResult) {
      fileActionResult.detectionTimeMs = Date.now() - startTime;
      return fileActionResult;
    }

    // Default: content query
    const result = this.buildContentQueryResult(query);
    result.detectionTimeMs = Date.now() - startTime;
    return result;
  }

  // ============================================================================
  // FAST-PATH DETECTION METHODS
  // ============================================================================

  private detectGreeting(query: string): IntentResult | null {
    const greetingPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|yo)(\s|$|!|\?)/i,
      /^(hi|hello|hey)\s+(there|koda|friend)/i,
      /^how are you(\s+doing)?(\?)?$/i,
      /^what'?s up(\?)?$/i,
      /^how'?s it going(\?)?$/i,
      /^(thanks|thank you|thx)(\s|$|!)/i,
      /^(bye|goodbye|see you|cya|later)(\s|$|!)/i,
      // Portuguese
      /^(oi|olá|ola|bom dia|boa tarde|boa noite)(\s|$|!|\?)/i,
      /^(obrigado|obrigada|valeu)(\s|$|!)/i,
      // Spanish
      /^(hola|buenos días|buenas tardes|buenas noches)(\s|$|!|\?)/i,
      /^(gracias)(\s|$|!)/i,
    ];

    for (const pattern of greetingPatterns) {
      if (pattern.test(query.trim())) {
        return {
          category: 'greeting',
          confidence: 0.99,
          reasoning: 'User is greeting or having casual conversation',
          psychologicalGoal: 'fast_answer',
          hints: {
            useRAG: false,
            useDatabaseQuery: false,
            useFileActions: false,
            requiresLLM: false,
            streamResponse: false,
          },
          detectionTimeMs: 0,
          detectionMethod: 'fast-path',
        };
      }
    }
    return null;
  }

  private detectCapabilityQuery(query: string): IntentResult | null {
    const queryLower = query.toLowerCase().trim();

    // Don't match if asking about KODA's business/ICP
    if (/koda'?s\s+|koda\s+(icp|business|market|customer|target|revenue|pricing|strategy|plan|model)/i.test(queryLower)) {
      return null;
    }

    const capabilityPatterns = [
      /^what is koda\??$/i,
      /^what'?s koda\??$/i,
      /^what can koda do\??$/i,
      /^how does koda work\??$/i,
      /^tell me about koda\??$/i,
      /^explain koda$/i,
      /^o que é o? koda\??$/i,
      /^qué es koda\??$/i,
    ];

    for (const pattern of capabilityPatterns) {
      if (pattern.test(queryLower)) {
        return {
          category: 'capability',
          confidence: 0.98,
          reasoning: 'Query is asking about KODA system capabilities',
          psychologicalGoal: 'fast_answer',
          hints: {
            useRAG: false,
            useDatabaseQuery: false,
            useFileActions: false,
            requiresLLM: false,
            streamResponse: false,
          },
          detectionTimeMs: 0,
          detectionMethod: 'fast-path',
        };
      }
    }
    return null;
  }

  private detectMetadataQuery(query: string): { isMetadataQuery: boolean; type: MetadataQueryType; extractedValue?: string; confidence: number } {
    const queryLower = query.toLowerCase().trim();

    // File location patterns
    const locationPatterns = [
      /where is (.+)/i,
      /where can i find (.+)/i,
      /location of (.+)/i,
      /find (.+) file/i,
      /which folder (?:has|contains) (.+)/i,
      /onde (?:está|fica) (.+)/i,
      /dónde está (.+)/i,
    ];

    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match) {
        let extractedValue = match[1].trim()
          .replace(/^(?:the|a|an|o|a|el|la)\s+/i, '')
          .replace(/\s+(?:file|document|pdf|docx|xlsx|pptx|arquivo|documento)$/i, '');
        return { isMetadataQuery: true, type: 'file_location', extractedValue, confidence: 0.95 };
      }
    }

    // File count patterns
    const countPatterns = [
      /how many (files|documents)/i,
      /(file|document) count/i,
      /total (files|documents)/i,
      /number of (files|documents)/i,
      /quantos (arquivos|documentos)/i,
      /cuántos (archivos|documentos)/i,
    ];

    for (const pattern of countPatterns) {
      if (pattern.test(query)) {
        return { isMetadataQuery: true, type: 'file_count', confidence: 0.95 };
      }
    }

    // File type patterns
    const fileTypePatterns = [
      /what (?:file )?types?/i,
      /what (?:types? of |kinds? of )?(?:files|documents)/i,
      /(?:file|document) (?:types?|formats?|extensions?)/i,
      /which (?:file|document) (?:types?|formats?)/i,
      /que tipos de (?:arquivos|documentos)/i,
      /qué tipos de (?:archivos|documentos)/i,
    ];

    for (const pattern of fileTypePatterns) {
      if (pattern.test(query)) {
        return { isMetadataQuery: true, type: 'file_type', confidence: 0.95 };
      }
    }

    // Folder contents patterns
    const folderContentPatterns = [
      /what (?:is|are) (?:inside|in) (.+?) folder/i,
      /show me (?:the )?(.+?) folder/i,
      /what files are in (.+)/i,
      /contents of (.+?) folder/i,
      /list (?:files in |everything in )?(.+?) folder/i,
      /which (?:document|documents|file|files) (?:are|is) (?:inside|in) (.+)/i,
      /o que (?:tem|há) na pasta (.+)/i,
      /qué hay en la carpeta (.+)/i,
    ];

    for (const pattern of folderContentPatterns) {
      const match = query.match(pattern);
      if (match) {
        return { isMetadataQuery: true, type: 'folder_contents', extractedValue: match[1].trim(), confidence: 0.95 };
      }
    }

    // List all files patterns
    const listAllPatterns = [
      /show me all (files|documents)/i,
      /list all (files|documents)/i,
      /what files do i have/i,
      /what documents do i have/i,
      /mostre todos os (arquivos|documentos)/i,
      /muéstrame todos los (archivos|documentos)/i,
    ];

    for (const pattern of listAllPatterns) {
      if (pattern.test(query)) {
        return { isMetadataQuery: true, type: 'list_all_files', confidence: 0.90 };
      }
    }

    // List folders patterns
    const listFoldersPatterns = [
      /which folders (?:do i have|are there)/i,
      /what folders (?:do i have|are there|exist)/i,
      /list (?:all )?(?:my )?folders/i,
      /show me (?:all )?(?:my )?folders/i,
      /how many folders/i,
      /quais pastas/i,
      /qué carpetas/i,
    ];

    for (const pattern of listFoldersPatterns) {
      if (pattern.test(query)) {
        return { isMetadataQuery: true, type: 'list_folders', confidence: 0.95 };
      }
    }

    return { isMetadataQuery: false, type: 'none', confidence: 0 };
  }

  private isComparisonQuery(query: string): boolean {
    return /compare|difference|versus|vs\.?|contrast|similarities|between.*and|comparar|diferença|diferencia/i.test(query);
  }

  private isObviousRAGQuery(query: string): boolean {
    const queryLower = query.toLowerCase();
    return (
      // Question patterns (WH-words)
      queryLower.startsWith('what ') ||
      queryLower.startsWith('how ') ||
      queryLower.startsWith('why ') ||
      queryLower.startsWith('when ') ||
      queryLower.startsWith('where ') ||
      queryLower.startsWith('who ') ||
      queryLower.startsWith('which ') ||
      // Yes/No question words
      queryLower.startsWith('does ') ||
      queryLower.startsWith('do ') ||
      queryLower.startsWith('is ') ||
      queryLower.startsWith('are ') ||
      queryLower.startsWith('can ') ||
      queryLower.startsWith('could ') ||
      queryLower.startsWith('would ') ||
      queryLower.startsWith('should ') ||
      // Content keywords
      queryLower.includes('summarize') ||
      queryLower.includes('explain') ||
      queryLower.includes('tell me about') ||
      queryLower.includes('main points') ||
      queryLower.includes('key points') ||
      // Portuguese
      queryLower.startsWith('o que ') ||
      queryLower.startsWith('como ') ||
      queryLower.startsWith('por que ') ||
      queryLower.startsWith('quando ') ||
      queryLower.startsWith('quem ') ||
      queryLower.startsWith('qual ') ||
      // Spanish
      queryLower.startsWith('qué ') ||
      queryLower.startsWith('cómo ') ||
      queryLower.startsWith('por qué ') ||
      queryLower.startsWith('cuándo ') ||
      queryLower.startsWith('quién ') ||
      queryLower.startsWith('cuál ')
    );
  }

  private maybeFileAction(query: string): boolean {
    const fileActionKeywords = [
      'create', 'make', 'new folder', 'delete', 'remove', 'move', 'rename', 'open',
      'criar', 'fazer', 'nova pasta', 'apagar', 'remover', 'mover', 'renomear', 'abrir',
      'crear', 'eliminar', 'quitar', 'renombrar'
    ];
    const queryLower = query.toLowerCase();
    return fileActionKeywords.some(keyword => queryLower.includes(keyword));
  }

  private detectFileActionPattern(query: string): IntentResult | null {
    const queryLower = query.toLowerCase().trim();

    // Create folder patterns
    if (/(?:create|make|new|criar|fazer|nueva?)\s+(?:a\s+)?(?:folder|pasta|carpeta)/i.test(query)) {
      const folderNameMatch = query.match(/(?:create|make|new|criar|fazer)\s+(?:a\s+)?(?:folder|pasta|carpeta)\s+(?:named|called|chamad[ao])?\s*["']?([^"'\n]+)["']?/i);
      return {
        category: 'file_action',
        confidence: 0.9,
        reasoning: 'User wants to create a new folder',
        psychologicalGoal: 'control',
        fileAction: {
          intent: 'create_folder',
          parameters: { folderName: folderNameMatch?.[1]?.trim() || null },
        },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: false,
          streamResponse: false,
        },
        detectionTimeMs: 0,
        detectionMethod: 'fast-path',
      };
    }

    // Move file patterns
    if (/move\s+.+\s+to\s+|mover\s+.+\s+para\s+/i.test(query)) {
      return {
        category: 'file_action',
        confidence: 0.85,
        reasoning: 'User wants to move a file',
        psychologicalGoal: 'control',
        fileAction: { intent: 'move_files', parameters: {} },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: true,
          streamResponse: false,
        },
        detectionTimeMs: 0,
        detectionMethod: 'fast-path',
      };
    }

    // Rename patterns
    if (/rename\s+|renomear\s+|renombrar\s+/i.test(query)) {
      return {
        category: 'file_action',
        confidence: 0.85,
        reasoning: 'User wants to rename a file or folder',
        psychologicalGoal: 'control',
        fileAction: { intent: 'rename_file', parameters: {} },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: true,
          streamResponse: false,
        },
        detectionTimeMs: 0,
        detectionMethod: 'fast-path',
      };
    }

    // Delete patterns
    if (/(?:delete|remove|apagar|excluir|eliminar)\s+/i.test(query)) {
      return {
        category: 'file_action',
        confidence: 0.85,
        reasoning: 'User wants to delete a file or folder',
        psychologicalGoal: 'control',
        fileAction: { intent: 'delete_file', parameters: {} },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: true,
          streamResponse: false,
        },
        detectionTimeMs: 0,
        detectionMethod: 'fast-path',
      };
    }

    return null;
  }

  // ============================================================================
  // LLM-BASED DETECTION
  // ============================================================================

  private async detectIntentWithLLM(
    query: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<{ intent: string; confidence: number; parameters: Record<string, any> }> {
    if (!this.model) {
      throw new Error('LLM model not initialized');
    }

    // Build conversation context
    let contextSection = '';
    if (conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5);
      contextSection = `\n**Recent Conversation:**\n${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n`;
    }

    const prompt = `You are an intent detection system for KODA, a document management AI.
Classify the user's intent accurately.
${contextSection}

**INTENTS:**
1. create_folder - Create NEW folder (keywords: create, make, new folder)
2. list_files - List/show files in a folder (keywords: show, list, what files)
3. search_files - Find files by name/keyword
4. file_location - Where is a specific file
5. move_files - Move files to folder
6. rename_file - Rename file/folder
7. delete_file - Delete file/folder
8. show_file - View/open specific file
9. show_folder - View/open folder contents
10. metadata_query - File count, types, statistics
11. rag_query - Questions about document CONTENT (default)
12. greeting - Hello, hi, thanks, bye
13. create_file - Create NEW document with AI content

**CRITICAL RULES:**
- "show files IN folder X" = list_files (NOT create_folder)
- "what's in folder X" = show_folder (NOT create_folder)
- "create folder X" = create_folder
- Default to rag_query if unclear

**Query:** "${query}"

**Response (JSON only):**
{"intent": "intent_name", "confidence": 0.95, "parameters": {"folderName": "...", "filename": "..."}}`;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout (10s)')), 10000)
      );

      const result = await Promise.race([
        this.model.generateContent(prompt),
        timeoutPromise
      ]);

      let jsonText = result.response.text().trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const intentResult = JSON.parse(jsonText);

      if (!intentResult.intent || typeof intentResult.confidence !== 'number') {
        throw new Error('Invalid result format');
      }

      return intentResult;
    } catch (error) {
      console.error('❌ [INTENT] LLM detection error:', error);
      return { intent: 'rag_query', confidence: 0.5, parameters: {} };
    }
  }

  // ============================================================================
  // RESULT BUILDERS
  // ============================================================================

  private buildMetadataQueryResult(
    metadataResult: { isMetadataQuery: boolean; type: MetadataQueryType; extractedValue?: string; confidence: number },
    query: string
  ): IntentResult {
    return {
      category: 'metadata_query',
      confidence: metadataResult.confidence,
      reasoning: `Metadata query: ${metadataResult.type}`,
      psychologicalGoal: 'control',
      metadataQuery: metadataResult,
      hints: {
        useRAG: false,
        useDatabaseQuery: true,
        useFileActions: false,
        requiresLLM: false,
        streamResponse: false,
      },
      detectionTimeMs: 0,
      detectionMethod: 'fast-path',
    };
  }

  private buildComparisonResult(query: string): IntentResult {
    return {
      category: 'comparison',
      confidence: 0.9,
      reasoning: 'User wants to compare documents or content',
      psychologicalGoal: 'clarity',
      hints: {
        useRAG: true,
        useDatabaseQuery: false,
        useFileActions: false,
        requiresLLM: true,
        streamResponse: true,
      },
      detectionTimeMs: 0,
      detectionMethod: 'fast-path',
    };
  }

  private buildFileActionResult(
    llmResult: { intent: string; confidence: number; parameters: Record<string, any> },
    query: string
  ): IntentResult {
    return {
      category: 'file_action',
      confidence: llmResult.confidence,
      reasoning: `File action: ${llmResult.intent}`,
      psychologicalGoal: 'control',
      fileAction: {
        intent: llmResult.intent,
        parameters: llmResult.parameters,
      },
      hints: {
        useRAG: false,
        useDatabaseQuery: false,
        useFileActions: true,
        requiresLLM: false,
        streamResponse: false,
      },
      detectionTimeMs: 0,
      detectionMethod: 'llm',
    };
  }

  private buildContentQueryResult(query: string): IntentResult {
    const goal = this.detectPsychologicalGoal(query);
    return {
      category: 'content_query',
      confidence: goal.confidence,
      reasoning: goal.reasoning,
      psychologicalGoal: goal.goal,
      hints: {
        useRAG: true,
        useDatabaseQuery: false,
        useFileActions: false,
        requiresLLM: true,
        streamResponse: true,
      },
      detectionTimeMs: 0,
      detectionMethod: 'fast-path',
    };
  }

  /**
   * Detect psychological goal for response formatting
   */
  private detectPsychologicalGoal(query: string): { goal: PsychologicalGoal; confidence: number; reasoning: string } {
    const queryLower = query.toLowerCase().trim();

    // CONTROL: Search-across / comprehensive list queries
    if (/^(show me all|list all|list every|find all|all|every|which files|which documents|what files|what documents)/i.test(query)) {
      return { goal: 'control', confidence: 0.95, reasoning: 'User wants comprehensive list' };
    }

    // CLARITY: Comparison / analytical queries
    if (/compare|difference|vs|versus|how does .* differ|what's different|similar/i.test(query)) {
      return { goal: 'clarity', confidence: 0.95, reasoning: 'User wants comparison' };
    }

    // MASTERY: How-to / instructional queries
    if (/^how (do|to|can)/i.test(query)) {
      return { goal: 'mastery', confidence: 0.95, reasoning: 'User wants step-by-step instructions' };
    }

    // INSIGHT: Interpretative / judgment queries
    if (/what (is|are) the (main|key|primary|most important)|risk|should|recommend|important|strategy|plan|approach/i.test(query)) {
      return { goal: 'insight', confidence: 0.90, reasoning: 'User wants analysis and judgment' };
    }

    // FAST ANSWER: Direct factual queries (DEFAULT)
    if (/^(what is|what's|when|where|who|which|what)\s/i.test(query)) {
      return { goal: 'fast_answer', confidence: 0.85, reasoning: 'User wants quick factual answer' };
    }

    // Fallback
    return { goal: 'fast_answer', confidence: 0.70, reasoning: 'Default to factual retrieval' };
  }
}

// ============================================================================
// LEGACY COMPATIBILITY - For rag.controller.ts
// ============================================================================

/**
 * Legacy IntentResult format expected by rag.controller.ts
 * Maps new unified format to legacy Intent enum format
 */
export interface LegacyIntentResult {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  entities: Record<string, any>;
}

/**
 * Convert new IntentResult to legacy format for backwards compatibility
 * This allows gradual migration of the controller
 */
export function toLegacyFormat(result: IntentResult): LegacyIntentResult {
  // Map category + fileAction to legacy intent string
  let legacyIntent: string;
  const parameters: Record<string, any> = {};
  const entities: Record<string, any> = {};

  switch (result.category) {
    case 'greeting':
      legacyIntent = 'greeting';
      break;

    case 'capability':
      legacyIntent = 'capability';
      break;

    case 'comparison':
      legacyIntent = 'COMPARE_DOCUMENTS';
      break;

    case 'metadata_query':
      // Map metadata query types to legacy intents
      switch (result.metadataQuery?.type) {
        case 'file_location':
          legacyIntent = 'file_location';
          entities.documentName = result.metadataQuery.extractedValue;
          parameters.filename = result.metadataQuery.extractedValue;
          break;
        case 'folder_contents':
          legacyIntent = 'show_folder';
          entities.folderName = result.metadataQuery.extractedValue;
          parameters.folderName = result.metadataQuery.extractedValue;
          break;
        case 'list_all_files':
          legacyIntent = 'list_files';
          break;
        case 'list_folders':
          legacyIntent = 'list_files';
          parameters.listFolders = true;
          break;
        case 'file_count':
          legacyIntent = 'metadata_query';
          parameters.queryType = 'count';
          break;
        case 'file_type':
          legacyIntent = 'metadata_query';
          parameters.queryType = 'types';
          break;
        default:
          legacyIntent = 'rag_query';
      }
      break;

    case 'file_action':
      // Use the file action intent directly
      legacyIntent = result.fileAction?.intent || 'rag_query';
      // Copy parameters to both parameters and entities for compatibility
      if (result.fileAction?.parameters) {
        Object.assign(parameters, result.fileAction.parameters);
        Object.assign(entities, result.fileAction.parameters);
      }
      break;

    case 'content_query':
    case 'synthesis':
    default:
      legacyIntent = 'rag_query';
      break;
  }

  return {
    intent: legacyIntent,
    confidence: result.confidence,
    parameters,
    entities,
  };
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const intentDetectionService = new IntentDetectionService();

export { intentDetectionService, IntentDetectionService };
export default intentDetectionService;
