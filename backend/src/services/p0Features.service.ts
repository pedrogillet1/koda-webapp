/**
 * P0 Features Integration Service
 *
 * This service integrates all P0 features:
 * 1. Follow-Up Question Understanding (Context Tracker + Query Rewriter)
 * 2. Multi-Turn Conversations (Conversation State)
 * 3. Clarifying Questions (Clarification Service)
 * 4. Calculation & Data Processing (Calculation Service)
 * 5. Smart Semantic Search (Already implemented via BM25)
 *
 * This service acts as a middleware that enhances queries before they reach RAG
 */

import contextTrackerService from './contextTracker.service';
import queryRewriterService from './queryRewriter.service';
import conversationStateService from './conversationState.service';
import calculationService from './calculation.service';

export interface P0ProcessingResult {
  originalQuery: string;
  processedQuery: string;
  wasRewritten: boolean;
  isRefinement: boolean;
  scopeDocumentIds: string[];
  scopeDescription: string;
  requiresCalculation: boolean;
  calculationType?: string;
  metadata: {
    contextEntities?: Record<string, any>;
    followUpType?: string;
    refinementType?: string;
  };
}

export interface P0PostProcessingResult {
  answer: string;
  calculationResult?: {
    type: string;
    result: any;
    explanation: string;
    formula?: string;
  };
  sources: any[];
  scopeUpdated: boolean;
  newScopeDescription?: string;
}

class P0FeaturesService {

  /**
   * Pre-process query before RAG
   * Handles: Follow-up understanding, query rewriting, scope management
   */
  async preProcessQuery(
    query: string,
    userId: string,
    conversationId: string
  ): Promise<P0ProcessingResult> {

    console.log(`\n🔄 [P0 PRE-PROCESS] Starting for query: "${query}"`);

    const result: P0ProcessingResult = {
      originalQuery: query,
      processedQuery: query,
      wasRewritten: false,
      isRefinement: false,
      scopeDocumentIds: [],
      scopeDescription: 'all documents',
      requiresCalculation: false,
      metadata: {},
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Check if query needs rewriting (follow-up understanding)
    // ═══════════════════════════════════════════════════════════════════════════
    const needsRewriting = queryRewriterService.needsRewriting(query);

    if (needsRewriting) {
      console.log(`📝 [P0] Query may need rewriting`);

      const rewriteResult = await queryRewriterService.rewriteQuery(
        query,
        userId,
        conversationId
      );

      if (rewriteResult.wasRewritten) {
        result.processedQuery = rewriteResult.rewritten;
        result.wasRewritten = true;
        result.metadata.followUpType = queryRewriterService.detectFollowUpType(query);

        console.log(`✅ [P0] Query rewritten: "${query}" → "${rewriteResult.rewritten}"`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Check if this is a refinement query (multi-turn conversation)
    // ═══════════════════════════════════════════════════════════════════════════
    const isRefinement = conversationStateService.isRefinementQuery(
      result.processedQuery,
      userId,
      conversationId
    );

    if (isRefinement) {
      result.isRefinement = true;
      result.scopeDocumentIds = conversationStateService.getCurrentScope(userId, conversationId);
      result.scopeDescription = conversationStateService.getCurrentScopeDescription(userId, conversationId);

      console.log(`🔍 [P0] Refinement query detected, using scope: ${result.scopeDocumentIds.length} documents`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Check if calculation is required
    // ═══════════════════════════════════════════════════════════════════════════
    if (calculationService.requiresCalculation(result.processedQuery)) {
      result.requiresCalculation = true;
      result.calculationType = calculationService.detectCalculationType(result.processedQuery);

      console.log(`🧮 [P0] Calculation required: ${result.calculationType}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Get context entities for metadata
    // ═══════════════════════════════════════════════════════════════════════════
    const contextEntities = contextTrackerService.getAllEntities(userId, conversationId);
    if (Object.keys(contextEntities).length > 0) {
      result.metadata.contextEntities = contextEntities;
    }

    console.log(`✅ [P0 PRE-PROCESS] Complete:
   - Original: "${result.originalQuery}"
   - Processed: "${result.processedQuery}"
   - Rewritten: ${result.wasRewritten}
   - Refinement: ${result.isRefinement}
   - Scope: ${result.scopeDocumentIds.length} docs
   - Calculation: ${result.requiresCalculation ? result.calculationType : 'none'}`);

    return result;
  }

  /**
   * Post-process RAG response
   * Handles: Context updating, calculation, scope updating
   */
  async postProcessResponse(
    query: string,
    answer: string,
    sources: any[],
    userId: string,
    conversationId: string,
    preProcessResult: P0ProcessingResult
  ): Promise<P0PostProcessingResult> {

    console.log(`\n🔄 [P0 POST-PROCESS] Starting for answer length: ${answer.length}`);

    const result: P0PostProcessingResult = {
      answer,
      sources,
      scopeUpdated: false,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Update context tracker with new entities
    // ═══════════════════════════════════════════════════════════════════════════
    contextTrackerService.updateContext(
      userId,
      conversationId,
      query,
      answer,
      preProcessResult.requiresCalculation ? 'calculation' : 'general',
      sources.map(s => s.documentId).filter(Boolean)
    );

    console.log(`📝 [P0] Context updated with query/answer entities`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Perform calculation if required
    // ═══════════════════════════════════════════════════════════════════════════
    if (preProcessResult.requiresCalculation) {
      console.log(`🧮 [P0] Performing calculation...`);

      const calcResult = await calculationService.performCalculation(
        preProcessResult.processedQuery,
        answer
      );

      if (calcResult) {
        result.calculationResult = {
          type: calcResult.type,
          result: calcResult.result,
          explanation: calcResult.explanation,
          formula: calcResult.formula,
        };

        // Enhance answer with calculation result
        result.answer = this.enhanceAnswerWithCalculation(answer, calcResult);

        console.log(`✅ [P0] Calculation complete: ${calcResult.explanation}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Update conversation scope if query created new scope
    // ═══════════════════════════════════════════════════════════════════════════
    if (conversationStateService.createsNewScope(preProcessResult.processedQuery)) {
      const documentIds = sources.map(s => s.documentId).filter(Boolean);
      const scopeDescription = conversationStateService.extractScopeDescription(preProcessResult.processedQuery);

      if (documentIds.length > 0) {
        conversationStateService.updateScope(
          userId,
          conversationId,
          documentIds,
          scopeDescription,
          preProcessResult.processedQuery
        );

        result.scopeUpdated = true;
        result.newScopeDescription = scopeDescription;

        console.log(`📊 [P0] Scope updated: "${scopeDescription}" (${documentIds.length} docs)`);
      }
    } else if (preProcessResult.isRefinement) {
      // Update scope for refinement query
      const documentIds = sources.map(s => s.documentId).filter(Boolean);
      const newDescription = `${preProcessResult.scopeDescription} → refined`;

      conversationStateService.updateScopeRefinement(
        userId,
        conversationId,
        query,
        preProcessResult.processedQuery,
        documentIds,
        newDescription
      );

      result.scopeUpdated = true;
      result.newScopeDescription = newDescription;

      console.log(`📊 [P0] Scope refined: ${documentIds.length} docs`);
    }

    console.log(`✅ [P0 POST-PROCESS] Complete`);

    return result;
  }

  /**
   * Enhance answer with calculation result
   */
  private enhanceAnswerWithCalculation(answer: string, calcResult: any): string {
    // If answer already contains the calculation result, don't duplicate
    const resultStr = typeof calcResult.result === 'number'
      ? calcResult.result.toFixed(2)
      : JSON.stringify(calcResult.result);

    if (answer.includes(resultStr)) {
      return answer;
    }

    // Add calculation box at the end
    const calculationBox = `

---
📊 **Calculation Result**
${calcResult.explanation}
${calcResult.formula ? `\n*Formula: ${calcResult.formula}*` : ''}
---`;

    return answer + calculationBox;
  }

  /**
   * Clear all P0 state for a conversation
   */
  clearConversationState(userId: string, conversationId: string): void {
    contextTrackerService.clearContext(userId, conversationId);
    conversationStateService.clearScope(userId, conversationId);

    console.log(`🗑️ [P0] Cleared all state for conversation: ${conversationId}`);
  }

  /**
   * Get current conversation state summary (for debugging)
   */
  getStateSummary(userId: string, conversationId: string): {
    contextEntities: Record<string, any>;
    currentScope: string[];
    scopeDescription: string;
    hasActiveScope: boolean;
    lastQuery: string;
  } {
    return {
      contextEntities: contextTrackerService.getAllEntities(userId, conversationId),
      currentScope: conversationStateService.getCurrentScope(userId, conversationId),
      scopeDescription: conversationStateService.getCurrentScopeDescription(userId, conversationId),
      hasActiveScope: conversationStateService.hasActiveScope(userId, conversationId),
      lastQuery: contextTrackerService.getLastQuery(userId, conversationId),
    };
  }
}

export default new P0FeaturesService();
