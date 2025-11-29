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

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ ACADEMIC INTELLIGENCE SERVICES
// ═══════════════════════════════════════════════════════════════════════════════
import definitionExtractionService from './definitionExtraction.service';
import methodologyExtractionService from './methodologyExtraction.service';
import causalExtractionService from './causalExtraction.service';
import comparativeAnalysisService from './comparativeAnalysis.service';
import crossDocumentSynthesisService from './crossDocumentSynthesis.service';
import trendAnalysisService from './trendAnalysis.service';
import practicalImplicationsService from './practicalImplications.service';

// ═══════════════════════════════════════════════════════════════════════════════
// ACADEMIC QUERY TYPES
// ═══════════════════════════════════════════════════════════════════════════════
export type AcademicQueryType =
  | 'definition'      // "What is X?" - Uses definitionExtraction
  | 'methodology'     // "How does X work?" - Uses methodologyExtraction
  | 'causal'          // "Why X?" - Uses causalExtraction
  | 'comparison'      // "Compare X and Y" - Uses comparativeAnalysis
  | 'synthesis'       // Multi-doc queries - Uses crossDocumentSynthesis
  | 'trend'           // "What trends?" - Uses trendAnalysis
  | 'implication'     // "So what?" - Uses practicalImplications
  | 'none';           // Not an academic query

export interface P0ProcessingResult {
  originalQuery: string;
  processedQuery: string;
  wasRewritten: boolean;
  isRefinement: boolean;
  scopeDocumentIds: string[];
  scopeDescription: string;
  requiresCalculation: boolean;
  calculationType?: string;
  // ✅ NEW: Academic intelligence fields
  academicQueryType: AcademicQueryType;
  academicContext?: string;  // Additional context from academic services
  document_metadata: {
    contextEntities?: Record<string, any>;
    followUpType?: string;
    refinementType?: string;
    academicEnhancement?: any;  // Academic intelligence data
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
      academicQueryType: 'none',
      document_metadata: {},
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Check if query needs rewriting (follow-up understanding)
    // ✅ ERROR HANDLING: System continues with original query if rewriting fails
    // ═══════════════════════════════════════════════════════════════════════════
    try {
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
          result.document_metadata.followUpType = queryRewriterService.detectFollowUpType(query);

          console.log(`✅ [P0] Query rewritten: "${query}" → "${rewriteResult.rewritten}"`);
        }
      }
    } catch (error) {
      console.error('❌ [P0] Query rewriting failed:', error);
      // Continue with original query - system remains functional
      result.processedQuery = query;
      result.wasRewritten = false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Check if this is a refinement query (multi-turn conversation)
    // ✅ ERROR HANDLING: System continues without scope if refinement check fails
    // ═══════════════════════════════════════════════════════════════════════════
    try {
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
    } catch (error) {
      console.error('❌ [P0] Refinement check failed:', error);
      // Continue without refinement - treat as new query
      result.isRefinement = false;
      result.scopeDocumentIds = [];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Check if calculation is required
    // ✅ ERROR HANDLING: System continues without calculation if detection fails
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      if (calculationService.requiresCalculation(result.processedQuery)) {
        result.requiresCalculation = true;
        result.calculationType = calculationService.detectCalculationType(result.processedQuery);

        console.log(`🧮 [P0] Calculation required: ${result.calculationType}`);
      }
    } catch (error) {
      console.error('❌ [P0] Calculation detection failed:', error);
      // Continue without calculation
      result.requiresCalculation = false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Detect Academic Query Type (NEW - Academic Intelligence)
    // ✅ ERROR HANDLING: System continues without academic enhancement if detection fails
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      result.academicQueryType = this.detectAcademicQueryType(result.processedQuery);

      if (result.academicQueryType !== 'none') {
        console.log(`🎓 [P0] Academic query detected: ${result.academicQueryType}`);
      }
    } catch (error) {
      console.error('❌ [P0] Academic query detection failed:', error);
      // Continue without academic enhancement
      result.academicQueryType = 'none';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Get context entities for metadata
    // ✅ ERROR HANDLING: System continues without context entities if retrieval fails
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const contextEntities = contextTrackerService.getAllEntities(userId, conversationId);
      if (Object.keys(contextEntities).length > 0) {
        result.document_metadata.contextEntities = contextEntities;
      }
    } catch (error) {
      console.error('❌ [P0] Context entities retrieval failed:', error);
      // Continue without context entities
    }

    console.log(`✅ [P0 PRE-PROCESS] Complete:
   - Original: "${result.originalQuery}"
   - Processed: "${result.processedQuery}"
   - Rewritten: ${result.wasRewritten}
   - Refinement: ${result.isRefinement}
   - Scope: ${result.scopeDocumentIds.length} docs
   - Calculation: ${result.requiresCalculation ? result.calculationType : 'none'}
   - Academic: ${result.academicQueryType}`);

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
    // ✅ ERROR HANDLING: System continues if context update fails
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      contextTrackerService.updateContext(
        userId,
        conversationId,
        query,
        answer,
        preProcessResult.requiresCalculation ? 'calculation' : 'general',
        sources.map(s => s.documentId).filter(Boolean)
      );

      console.log(`📝 [P0] Context updated with query/answer entities`);
    } catch (error) {
      console.error('❌ [P0] Context update failed:', error);
      // Continue without updating context - answer still valid
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Perform calculation if required
    // ✅ ERROR HANDLING: System returns original answer if calculation fails
    // ═══════════════════════════════════════════════════════════════════════════
    if (preProcessResult.requiresCalculation) {
      try {
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
      } catch (error) {
        console.error('❌ [P0] Calculation failed:', error);
        // Continue with original answer - no calculation enhancement
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Update conversation scope if query created new scope
    // ✅ ERROR HANDLING: System continues if scope update fails
    // ═══════════════════════════════════════════════════════════════════════════
    try {
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
    } catch (error) {
      console.error('❌ [P0] Scope update failed:', error);
      // Continue without scope update - answer still valid
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Apply Academic Intelligence Enhancement (NEW)
    // ═══════════════════════════════════════════════════════════════════════════
    if (preProcessResult.academicQueryType !== 'none') {
      try {
        const academicEnhancement = await this.applyAcademicEnhancement(
          preProcessResult.academicQueryType,
          query,
          result.answer,
          sources,
          userId
        );

        if (academicEnhancement) {
          result.answer = academicEnhancement.enhancedAnswer;
          console.log(`🎓 [P0] Academic enhancement applied: ${preProcessResult.academicQueryType}`);
        }
      } catch (error) {
        console.error(`⚠️ [P0] Academic enhancement failed:`, error);
        // Continue without enhancement - don't break the response
      }
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACADEMIC INTELLIGENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Detect the type of academic query based on patterns
   * Maps queries to appropriate academic intelligence services
   */
  private detectAcademicQueryType(query: string): AcademicQueryType {
    const lowerQuery = query.toLowerCase();

    // Definition queries: "What is X?", "Define X", "Explain what X is"
    const definitionPatterns = [
      /^what\s+is\s+/i,
      /^what\s+are\s+/i,
      /^define\s+/i,
      /^explain\s+what\s+/i,
      /^what\s+does\s+.+\s+mean/i,
      /meaning\s+of\s+/i,
      /definition\s+of\s+/i,
    ];
    if (definitionPatterns.some(p => p.test(lowerQuery))) {
      return 'definition';
    }

    // Causal queries: "Why X?", "What caused X?", "Reason for X"
    const causalPatterns = [
      /^why\s+/i,
      /what\s+caused/i,
      /reason\s+for/i,
      /because\s+of\s+what/i,
      /what\s+led\s+to/i,
      /due\s+to\s+what/i,
      /explain\s+why/i,
    ];
    if (causalPatterns.some(p => p.test(lowerQuery))) {
      return 'causal';
    }

    // Comparison queries: "Compare X and Y", "Difference between X and Y"
    const comparisonPatterns = [
      /compare/i,
      /comparison/i,
      /difference\s+between/i,
      /\s+vs\.?\s+/i,
      /versus/i,
      /contrast/i,
      /how\s+.+\s+differ/i,
      /similarities?\s+between/i,
    ];
    if (comparisonPatterns.some(p => p.test(lowerQuery))) {
      return 'comparison';
    }

    // Methodology queries: "How does X work?", "What approach/method"
    const methodologyPatterns = [
      /^how\s+does\s+/i,
      /^how\s+do\s+/i,
      /what\s+method/i,
      /what\s+approach/i,
      /methodology/i,
      /technique\s+used/i,
      /algorithm\s+used/i,
      /how\s+.+\s+work/i,
    ];
    if (methodologyPatterns.some(p => p.test(lowerQuery))) {
      return 'methodology';
    }

    // Trend queries: "What trends?", "How has X changed?", "Evolution of X"
    const trendPatterns = [
      /trend/i,
      /over\s+time/i,
      /evolution\s+of/i,
      /how\s+has\s+.+\s+changed/i,
      /historical/i,
      /pattern\s+in/i,
      /shift\s+in/i,
      /progression/i,
    ];
    if (trendPatterns.some(p => p.test(lowerQuery))) {
      return 'trend';
    }

    // Implication queries: "So what?", "What does this mean?", "Impact of X"
    const implicationPatterns = [
      /so\s+what/i,
      /what\s+does\s+this\s+mean/i,
      /implication/i,
      /impact\s+of/i,
      /significance\s+of/i,
      /consequence/i,
      /what\s+.+\s+implies/i,
      /practical\s+application/i,
    ];
    if (implicationPatterns.some(p => p.test(lowerQuery))) {
      return 'implication';
    }

    // Synthesis queries: Multi-document, aggregate, cross-document
    const synthesisPatterns = [
      /across\s+(all|my|these)\s+/i,
      /all\s+(my\s+)?documents/i,
      /synthesize/i,
      /aggregate/i,
      /overview\s+of\s+all/i,
      /summarize\s+all/i,
      /common\s+themes/i,
      /recurring\s+patterns/i,
    ];
    if (synthesisPatterns.some(p => p.test(lowerQuery))) {
      return 'synthesis';
    }

    return 'none';
  }

  /**
   * Apply academic intelligence enhancement based on query type
   * Retrieves relevant knowledge and enhances the answer
   */
  private async applyAcademicEnhancement(
    queryType: AcademicQueryType,
    query: string,
    answer: string,
    sources: any[],
    userId: string
  ): Promise<{ enhancedAnswer: string; metadata?: any } | null> {

    const documentIds = sources.map(s => s.documentId).filter(Boolean);

    // ═══════════════════════════════════════════════════════════════════════════
    // Academic Intelligence Enhancement
    // Each case tries to enhance the answer with relevant academic knowledge
    // If the knowledge base doesn't have data, it gracefully returns null
    // ═══════════════════════════════════════════════════════════════════════════

    switch (queryType) {
      case 'definition': {
        // Extract concept from query
        const concept = this.extractConceptFromQuery(query, 'definition');
        if (!concept) return null;

        // Try to get definition context using the service's methods
        // The service stores definitions during document processing
        try {
          // definitionExtractionService works during extraction, not query time
          // For now, log that we detected a definition query for future enhancement
          console.log(`🎓 [ACADEMIC] Definition query for: "${concept}"`);
          // Future: Look up from domain knowledge or terminology intelligence
        } catch (e) {
          console.log(`⚠️ [ACADEMIC] Definition lookup not available yet`);
        }
        return null;
      }

      case 'methodology': {
        const concept = this.extractConceptFromQuery(query, 'methodology');
        if (!concept) return null;

        // Get methodology knowledge from the methodology extraction service
        try {
          const methodology = await methodologyExtractionService.getMethodologyKnowledge(userId, concept);

          if (methodology) {
            const enhancedAnswer = this.enhanceWithMethodology(answer, methodology);
            return { enhancedAnswer, document_metadata: { methodology } };
          }
        } catch (e) {
          console.log(`⚠️ [ACADEMIC] Methodology lookup failed:`, e);
        }
        return null;
      }

      case 'causal': {
        // Get causal relationships using the causal extraction service
        try {
          const causalInfo = causalExtractionService.getWhyQueryContext(query, documentIds);

          if (causalInfo && causalInfo.causes && causalInfo.causes.length > 0) {
            const formattedCauses = causalInfo.causes.map((c: any) => ({
              cause: c.cause,
              effect: c.effect,
              documentName: c.documentName || 'document'
            }));
            const enhancedAnswer = this.enhanceWithCausalReasoning(answer, formattedCauses);
            return { enhancedAnswer, document_metadata: { causalInfo } };
          }
        } catch (e) {
          console.log(`⚠️ [ACADEMIC] Causal lookup failed:`, e);
        }
        return null;
      }

      case 'comparison': {
        // Extract concepts to compare
        const concepts = this.extractComparisonConcepts(query);
        if (!concepts || concepts.length < 2) return null;

        // Note: Comparative analysis requires document chunks which we don't have at post-processing time
        // The comparison is handled during RAG processing via comparativeAnalysis.service
        // Log detection for future enhancement with stored comparison data
        console.log(`🎓 [ACADEMIC] Comparison query detected for: ${concepts.join(' vs ')}`);
        return null;
      }

      case 'synthesis': {
        // Get cross-document synthesis
        try {
          // synthesizeMethodologies(userId, topic?, documentIds?)
          const synthesisResult = await crossDocumentSynthesisService.synthesizeMethodologies(
            userId,
            query,  // topic extracted from query
            documentIds
          );

          if (synthesisResult && synthesisResult.synthesis) {
            const enhancedAnswer = this.enhanceWithSynthesis(answer, synthesisResult);
            return { enhancedAnswer, document_metadata: { synthesisResult } };
          }
        } catch (e) {
          console.log(`⚠️ [ACADEMIC] Synthesis lookup failed:`, e);
        }
        return null;
      }

      case 'trend': {
        // Trend analysis is performed during document processing
        // For query-time, we log and potentially enhance in the future
        console.log(`🎓 [ACADEMIC] Trend query detected for: "${query}"`);
        return null;
      }

      case 'implication': {
        // Practical implications - the service requires chunks which we don't have at post-process
        // Log detection for now, implications are added during RAG processing
        console.log(`🎓 [ACADEMIC] Implications query detected for: "${query}"`);
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Extract concept from query based on query type
   */
  private extractConceptFromQuery(query: string, type: 'definition' | 'methodology'): string | null {
    const lowerQuery = query.toLowerCase();

    if (type === 'definition') {
      // "What is X?" -> X
      const whatIsMatch = lowerQuery.match(/what\s+(?:is|are)\s+(.+?)(?:\?|$)/i);
      if (whatIsMatch) return whatIsMatch[1].trim();

      // "Define X" -> X
      const defineMatch = lowerQuery.match(/define\s+(.+?)(?:\?|$)/i);
      if (defineMatch) return defineMatch[1].trim();

      // "Meaning of X" -> X
      const meaningMatch = lowerQuery.match(/meaning\s+of\s+(.+?)(?:\?|$)/i);
      if (meaningMatch) return meaningMatch[1].trim();
    }

    if (type === 'methodology') {
      // "How does X work?" -> X
      const howDoesMatch = lowerQuery.match(/how\s+does\s+(.+?)\s+work/i);
      if (howDoesMatch) return howDoesMatch[1].trim();

      // "What method is used for X?" -> X
      const methodMatch = lowerQuery.match(/what\s+method\s+(?:is\s+)?(?:used\s+)?(?:for\s+)?(.+?)(?:\?|$)/i);
      if (methodMatch) return methodMatch[1].trim();
    }

    return null;
  }

  /**
   * Extract concepts to compare from comparison query
   */
  private extractComparisonConcepts(query: string): string[] | null {
    // "Compare X and Y" -> [X, Y]
    const compareMatch = query.match(/compare\s+(.+?)\s+(?:and|with|to|vs\.?)\s+(.+?)(?:\?|$)/i);
    if (compareMatch) {
      return [compareMatch[1].trim(), compareMatch[2].trim()];
    }

    // "Difference between X and Y" -> [X, Y]
    const diffMatch = query.match(/difference\s+between\s+(.+?)\s+and\s+(.+?)(?:\?|$)/i);
    if (diffMatch) {
      return [diffMatch[1].trim(), diffMatch[2].trim()];
    }

    // "X vs Y" -> [X, Y]
    const vsMatch = query.match(/(.+?)\s+vs\.?\s+(.+?)(?:\?|$)/i);
    if (vsMatch) {
      return [vsMatch[1].trim(), vsMatch[2].trim()];
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ANSWER ENHANCEMENT METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private enhanceWithDefinition(answer: string, definition: any): string {
    // Don't duplicate if already contains definition
    if (answer.toLowerCase().includes(definition.definition?.toLowerCase()?.substring(0, 50))) {
      return answer;
    }

    // Add definition context if not present
    const defContext = `\n\n**Definition from your documents:** ${definition.definition}`;
    return answer + defContext;
  }

  private enhanceWithMethodology(answer: string, methodology: any): string {
    if (!methodology.explanation) return answer;

    const methodContext = `\n\n**How it works:** ${methodology.explanation}`;
    return answer + methodContext;
  }

  private enhanceWithCausalReasoning(answer: string, causalInfo: any[]): string {
    if (causalInfo.length === 0) return answer;

    const topCauses = causalInfo.slice(0, 3);
    const causalContext = `\n\n**Evidence from your documents:**\n${topCauses.map(c =>
      `• ${c.cause} → ${c.effect} (${c.documentName})`
    ).join('\n')}`;

    return answer + causalContext;
  }

  private enhanceWithComparison(answer: string, comparison: any): string {
    if (!comparison.insights || comparison.insights.length === 0) return answer;

    const compContext = `\n\n**Key insights:** ${comparison.insights.join(' ')}`;
    return answer + compContext;
  }

  private enhanceWithSynthesis(answer: string, synthesisResult: any): string {
    if (!synthesisResult.synthesis) return answer;

    const synthContext = `\n\n**Cross-document synthesis:** ${synthesisResult.synthesis}`;
    return answer + synthContext;
  }

  private enhanceWithTrends(answer: string, trends: any[]): string {
    if (trends.length === 0) return answer;

    const trendContext = `\n\n**Trends identified:**\n${trends.slice(0, 3).map(t =>
      `• ${t.description}`
    ).join('\n')}`;

    return answer + trendContext;
  }

  private enhanceWithImplications(answer: string, implications: any[]): string {
    if (implications.length === 0) return answer;

    const implContext = `\n\n**Practical implications:**\n${implications.slice(0, 3).map(i =>
      `• ${i.implication}`
    ).join('\n')}`;

    return answer + implContext;
  }
}

export default new P0FeaturesService();
