/**
 * ============================================================================
 * KODA FIX - UNIFIED INTENT DETECTION SERVICE
 * ============================================================================
 *
 * Consolidates 4 intent detection services into 1 unified service:
 * - intent.service.ts (PsychologicalGoals + Legacy intents)
 * - llmIntentDetector.service.ts (LLM-based file actions)
 * - queryIntentDetector.service.ts (Simple pattern matching - DEPRECATED)
 * - synthesisQueryDetection.service.ts (Synthesis queries)
 *
 * Strategy:
 * 1. First, use fast pattern-based detection for common cases
 * 2. For file operations, use LLM-based detection for better accuracy
 * 3. Return unified result format for consistent handling
 */

import intentService, {
  PsychologicalGoal,
  PsychologicalGoalResult,
  MetadataQueryResult,
  IntentDetectionResult as LegacyIntentResult
} from './intent.service';
import { llmIntentDetectorService } from './llmIntentDetector.service';

// ============================================================================
// UNIFIED TYPES
// ============================================================================

export type UnifiedIntentCategory =
  | 'content_query'      // RAG query for document content
  | 'file_action'        // File operations (create, move, rename, delete)
  | 'metadata_query'     // Database queries (file location, count, list)
  | 'greeting'           // Conversational greeting
  | 'capability'         // Questions about KODA itself
  | 'comparison'         // Compare documents/content
  | 'synthesis';         // Multi-document synthesis

export interface UnifiedIntentResult {
  // Primary classification
  category: UnifiedIntentCategory;
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
  metadataQuery?: MetadataQueryResult;

  // Legacy intent (for backwards compatibility)
  legacyIntent?: LegacyIntentResult;

  // Processing hints
  hints: {
    useRAG: boolean;
    useDatabaseQuery: boolean;
    useFileActions: boolean;
    requiresLLM: boolean;
    streamResponse: boolean;
  };
}

// ============================================================================
// UNIFIED INTENT DETECTION SERVICE
// ============================================================================

class UnifiedIntentService {
  /**
   * Main entry point - detect intent using unified strategy
   *
   * Strategy:
   * 1. Check for greetings (fast, no LLM needed)
   * 2. Check for capability queries (fast, no LLM needed)
   * 3. Check for metadata queries (fast, database lookup)
   * 4. Check for file action queries (may use LLM for accuracy)
   * 5. Default to content query with RAG
   */
  async detectIntent(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    options: {
      useLLMForFileActions?: boolean;
      skipGreetingCheck?: boolean;
    } = {}
  ): Promise<UnifiedIntentResult> {
    const { useLLMForFileActions = true, skipGreetingCheck = false } = options;

    console.log(`🎯 [UNIFIED INTENT] Analyzing: "${query.substring(0, 50)}..."`);

    // ========================================
    // Step 1: Fast pattern-based detection
    // ========================================

    // 1a. Greeting check (if not skipped)
    if (!skipGreetingCheck) {
      const greetingResult = this.detectGreeting(query);
      if (greetingResult) {
        console.log('   → Detected: GREETING');
        return greetingResult;
      }
    }

    // 1b. Capability query check
    const capabilityResult = this.detectCapabilityQuery(query);
    if (capabilityResult) {
      console.log('   → Detected: CAPABILITY');
      return capabilityResult;
    }

    // 1c. Metadata query check (file location, count, folder contents)
    const metadataResult = intentService.detectMetadataQuery(query);
    if (metadataResult.isMetadataQuery) {
      console.log(`   → Detected: METADATA_QUERY (${metadataResult.type})`);
      return this.buildMetadataQueryResult(metadataResult, query);
    }

    // 1d. Comparison query check
    if (this.isComparisonQuery(query)) {
      console.log('   → Detected: COMPARISON');
      return this.buildComparisonResult(query);
    }

    // ========================================
    // Step 2: File action detection (with optional LLM)
    // ========================================
    if (this.maybeFileAction(query)) {
      if (useLLMForFileActions) {
        try {
          const llmResult = await llmIntentDetectorService.detectIntent(query, conversationHistory);
          if (llmResult.confidence > 0.7 && llmResult.intent !== 'content_query') {
            console.log(`   → Detected: FILE_ACTION (${llmResult.intent}) via LLM`);
            return this.buildFileActionResult(llmResult, query);
          }
        } catch (error) {
          console.warn('   ⚠️ LLM intent detection failed, falling back to patterns:', error);
        }
      }

      // Fallback to pattern-based file action detection
      const patternResult = this.detectFileActionPattern(query);
      if (patternResult) {
        console.log(`   → Detected: FILE_ACTION (${patternResult.category}) via pattern`);
        return patternResult;
      }
    }

    // ========================================
    // Step 3: Default to content query (RAG)
    // ========================================
    console.log('   → Detected: CONTENT_QUERY (default)');
    return this.buildContentQueryResult(query);
  }

  /**
   * Fast synchronous intent detection (no LLM)
   * Use this when speed is critical and accuracy can be lower
   */
  detectIntentSync(query: string): UnifiedIntentResult {
    // Greeting check
    const greetingResult = this.detectGreeting(query);
    if (greetingResult) return greetingResult;

    // Capability query check
    const capabilityResult = this.detectCapabilityQuery(query);
    if (capabilityResult) return capabilityResult;

    // Metadata query check
    const metadataResult = intentService.detectMetadataQuery(query);
    if (metadataResult.isMetadataQuery) {
      return this.buildMetadataQueryResult(metadataResult, query);
    }

    // Comparison check
    if (this.isComparisonQuery(query)) {
      return this.buildComparisonResult(query);
    }

    // File action pattern check
    const fileActionResult = this.detectFileActionPattern(query);
    if (fileActionResult) return fileActionResult;

    // Default to content query
    return this.buildContentQueryResult(query);
  }

  // ============================================================================
  // DETECTION METHODS
  // ============================================================================

  private detectGreeting(query: string): UnifiedIntentResult | null {
    const greetingPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|yo)(\s|$|!|\?)/i,
      /^(hi|hello|hey)\s+(there|koda|friend)/i,
      /^how are you(\s+doing)?(\?)?$/i,
      /^what'?s up(\?)?$/i,
      /^how'?s it going(\?)?$/i,
      /^(thanks|thank you|thx)(\s|$|!)/i,
      /^(bye|goodbye|see you|cya|later)(\s|$|!)/i,
    ];

    for (const pattern of greetingPatterns) {
      if (pattern.test(query.toLowerCase().trim())) {
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
        };
      }
    }
    return null;
  }

  private detectCapabilityQuery(query: string): UnifiedIntentResult | null {
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
        };
      }
    }
    return null;
  }

  private isComparisonQuery(query: string): boolean {
    return /compare|difference|versus|vs\.?|contrast|similarities|between.*and/i.test(query);
  }

  private maybeFileAction(query: string): boolean {
    const fileActionKeywords = [
      'create', 'make', 'new folder', 'delete', 'remove', 'move', 'rename',
      'criar', 'fazer', 'nova pasta', 'apagar', 'remover', 'mover', 'renomear',
      'crear', 'eliminar', 'quitar', 'mover', 'renombrar'
    ];
    const queryLower = query.toLowerCase();
    return fileActionKeywords.some(keyword => queryLower.includes(keyword));
  }

  private detectFileActionPattern(query: string): UnifiedIntentResult | null {
    const queryLower = query.toLowerCase().trim();

    // Create folder patterns
    if (/(?:create|make|new)\s+(?:a\s+)?folder/i.test(query)) {
      const folderNameMatch = query.match(/(?:create|make|new)\s+(?:a\s+)?folder\s+(?:named|called)?\s*["']?([^"'\n]+)["']?/i);
      return {
        category: 'file_action',
        confidence: 0.9,
        reasoning: 'User wants to create a new folder',
        psychologicalGoal: 'control',
        fileAction: {
          intent: 'create_folder',
          parameters: {
            folderName: folderNameMatch?.[1]?.trim() || null,
          },
        },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: false,
          streamResponse: false,
        },
      };
    }

    // Move file patterns
    if (/move\s+.+\s+to\s+/i.test(query)) {
      return {
        category: 'file_action',
        confidence: 0.85,
        reasoning: 'User wants to move a file',
        psychologicalGoal: 'control',
        fileAction: {
          intent: 'move_files',
          parameters: {},
        },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: true, // Need LLM to parse file/folder names
          streamResponse: false,
        },
      };
    }

    // Rename patterns
    if (/rename\s+/i.test(query)) {
      return {
        category: 'file_action',
        confidence: 0.85,
        reasoning: 'User wants to rename a file or folder',
        psychologicalGoal: 'control',
        fileAction: {
          intent: 'rename_file',
          parameters: {},
        },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: true,
          streamResponse: false,
        },
      };
    }

    // Delete patterns
    if (/(?:delete|remove)\s+/i.test(query)) {
      return {
        category: 'file_action',
        confidence: 0.85,
        reasoning: 'User wants to delete a file or folder',
        psychologicalGoal: 'control',
        fileAction: {
          intent: 'delete_file',
          parameters: {},
        },
        hints: {
          useRAG: false,
          useDatabaseQuery: false,
          useFileActions: true,
          requiresLLM: true,
          streamResponse: false,
        },
      };
    }

    return null;
  }

  // ============================================================================
  // RESULT BUILDERS
  // ============================================================================

  private buildMetadataQueryResult(metadataResult: MetadataQueryResult, query: string): UnifiedIntentResult {
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
    };
  }

  private buildComparisonResult(query: string): UnifiedIntentResult {
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
    };
  }

  private buildFileActionResult(
    llmResult: { intent: string; confidence: number; parameters: Record<string, any> },
    query: string
  ): UnifiedIntentResult {
    return {
      category: 'file_action',
      confidence: llmResult.confidence,
      reasoning: `File action detected: ${llmResult.intent}`,
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
    };
  }

  private buildContentQueryResult(query: string): UnifiedIntentResult {
    const psychologicalGoal = intentService.detectPsychologicalGoal(query);

    return {
      category: 'content_query',
      confidence: psychologicalGoal.confidence,
      reasoning: psychologicalGoal.reasoning,
      psychologicalGoal: psychologicalGoal.goal,
      hints: {
        useRAG: true,
        useDatabaseQuery: false,
        useFileActions: false,
        requiresLLM: true,
        streamResponse: true,
      },
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const unifiedIntentService = new UnifiedIntentService();
export default unifiedIntentService;
