/**
 * ============================================================================
 * HIERARCHICAL INTENT HANDLER SERVICE
 * ============================================================================
 *
 * Wrapper service that orchestrates the hierarchical intent classification
 * and pipeline configuration for the RAG system.
 *
 * This service:
 * 1. Runs hierarchical intent classification (heuristic + LLM)
 * 2. Gets pipeline configuration based on intent
 * 3. Plans answer shape
 * 4. Handles clarification_needed intent
 */

import prisma from '../config/database';
import { classifyIntent, shouldDecompose, decomposeQuery, type IntentResult, type ClassificationContext } from './hierarchicalIntentClassifier.service';
import { getPipelineConfig, planAnswerShape, buildPromptWithPlan, type PipelineConfig, type AnswerPlan } from './pipelineConfiguration.service';

// ============================================================================
// TYPES
// ============================================================================

export interface HierarchicalIntentHandlerResult {
  hierarchicalIntent: IntentResult | null;
  pipelineConfig: PipelineConfig | null;
  answerPlan: AnswerPlan | null;
  handled: boolean;  // True if clarification was handled (early return)
  clarificationMessage?: string;
  classificationTimeMs: number;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handleHierarchicalIntent(
  query: string,
  userId: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<HierarchicalIntentHandlerResult> {
  const classificationStart = Date.now();

  let hierarchicalIntent: IntentResult | null = null;
  let pipelineConfig: PipelineConfig | null = null;
  let answerPlan: AnswerPlan | null = null;

  try {
    // Build classification context
    const context: ClassificationContext = {
      conversationHistory,
    };

    // Classify intent using two-stage approach
    hierarchicalIntent = await classifyIntent(query, context);
    const classificationTime = Date.now() - classificationStart;

    console.log(`🎯 [HIERARCHICAL-INTENT] Primary: ${hierarchicalIntent.primaryIntent} (${(hierarchicalIntent.confidence * 100).toFixed(0)}%)`);
    console.log(`   ↳ Complexity: ${hierarchicalIntent.complexity}`);
    console.log(`   ↳ Entities: ${hierarchicalIntent.entities.length}`);
    console.log(`   ↳ Classification time: ${classificationTime}ms (${hierarchicalIntent.source})`);

    // Get pipeline configuration based on intent
    pipelineConfig = getPipelineConfig(hierarchicalIntent);
    console.log(`📋 [PIPELINE] Routing: ${pipelineConfig.routing}, Retrieval: ${pipelineConfig.retrieval.strategy}, Template: ${pipelineConfig.answer.template}`);

    // Plan answer shape
    answerPlan = planAnswerShape(hierarchicalIntent, pipelineConfig);
    console.log(`📝 [ANSWER-PLAN] ${answerPlan.sections.length} sections, ${answerPlan.targetWords} words target`);

    // Handle clarification_needed intent
    if (hierarchicalIntent.primaryIntent === 'clarification_needed') {
      console.log('❓ [ROUTER] → CLARIFICATION NEEDED');

      const documentCount = await prisma.document.count({ where: { userId } });
      const userDocuments = await prisma.document.findMany({
        where: { userId },
        select: { filename: true },
        take: 10
      });
      const documentNames = userDocuments.map(d => d.filename);

      let clarificationMessage = '';

      if (documentCount === 0) {
        clarificationMessage = `I'd love to help, but I notice you haven't uploaded any documents yet.

To get started:
1. Click the **Upload** button in the sidebar
2. Select one or more documents (PDF, Word, Excel, etc.)
3. Then ask me any questions about their content!

What would you like to analyze first?`;
      } else {
        clarificationMessage = `I'd like to help, but I need a bit more context. Could you clarify:

${hierarchicalIntent.clarificationNeeded || 'What specific information are you looking for?'}

You have ${documentCount} document${documentCount > 1 ? 's' : ''} available:
${documentNames.slice(0, 5).map(n => `• ${n}`).join('\n')}${documentCount > 5 ? `\n• ...and ${documentCount - 5} more` : ''}`;
      }

      return {
        hierarchicalIntent,
        pipelineConfig,
        answerPlan,
        handled: true,
        clarificationMessage,
        classificationTimeMs: classificationTime
      };
    }

    return {
      hierarchicalIntent,
      pipelineConfig,
      answerPlan,
      handled: false,
      classificationTimeMs: classificationTime
    };

  } catch (intentError) {
    console.error('⚠️ [HIERARCHICAL-INTENT] Classification failed, using fallback:', intentError);

    return {
      hierarchicalIntent: null,
      pipelineConfig: null,
      answerPlan: null,
      handled: false,
      classificationTimeMs: Date.now() - classificationStart
    };
  }
}

// ============================================================================
// QUERY DECOMPOSITION HELPER
// ============================================================================

export async function handleQueryDecomposition(
  query: string,
  intent: IntentResult,
  context: ClassificationContext = {}
): Promise<{ shouldDecompose: boolean; subQuestions?: any[] }> {
  if (!shouldDecompose(intent)) {
    return { shouldDecompose: false };
  }

  try {
    const subQuestions = await decomposeQuery(query, intent, context);
    console.log(`🔀 [DECOMPOSITION] Query decomposed into ${subQuestions.length} sub-questions`);
    return { shouldDecompose: true, subQuestions };
  } catch (error) {
    console.error('⚠️ [DECOMPOSITION] Failed:', error);
    return { shouldDecompose: false };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const hierarchicalIntentHandler = {
  handleHierarchicalIntent,
  handleQueryDecomposition,
};

export default hierarchicalIntentHandler;
