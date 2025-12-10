/**
 * SKILL-AWARE CONTEXT SERVICE
 *
 * Provides skill-aware prompt building for the new skill-based RAG pipeline.
 * Fuses RAG context with persona and skill instructions to create final prompts.
 *
 * This is a companion to contextEngineering.service.ts
 */

import { getKodaSystemPrompt } from '../config/kodaPersonaConfig';
import type { SkillMapping } from './skillAndIntentRouter.service';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RAGContext {
  retrievedChunks: Array<{ content: string; source: string; score: number }>;
  conversationSummary?: string;
}

// ============================================================================
// SKILL-AWARE FINAL PROMPT BUILDER
// ============================================================================

/**
 * Build the final LLM prompt by fusing all context sources
 * Used by the skill-based RAG pipeline
 *
 * @param skillMapping - Skill mapping with config and complexity
 * @param ragContext - RAG context with retrieved chunks
 * @param userQuery - The user's query
 * @returns Final prompt string for LLM
 */
export function buildFinalPrompt(
  skillMapping: SkillMapping,
  ragContext: RAGContext,
  userQuery: string
): string {
  const { skillConfig, complexity } = skillMapping;

  // 1. Start with the base system prompt (Koda's identity)
  let systemPrompt: string;
  try {
    systemPrompt = getKodaSystemPrompt();
  } catch {
    // Fallback if import fails
    systemPrompt = `You are Koda, a Personal Document Assistant specialized in reading, explaining, checking, and comparing documents.
Be friendly, professional, and clear. Base answers on the user's documents.`;
  }

  // 2. Inject skill and style configuration
  const skillPrompt = `
**Your Task:**
- Skill: ${skillConfig.skillName} (Domain: ${skillConfig.domain})
- Your goal is to provide a ${skillConfig.outputFormat.toLowerCase()} for the user.
- Use the following sections in your answer: ${skillConfig.defaultSections?.join(', ') || 'Direct answer followed by explanation'}.
- Highlight rules: Use bold for ${skillConfig.highlightRules.join(', ')}.
- Use bullets: ${skillConfig.useBullets ? 'Yes, for lists' : 'No, use paragraphs'}.`;

  // 3. Express depth instructions
  let depthPrompt = '';
  if (complexity === 'LIGHT') {
    depthPrompt =
      '\n**Answer Depth:**\n- Keep the answer concise (2-4 sentences). Do not use sections or lists unless the user explicitly asked.';
  } else if (complexity === 'NORMAL') {
    depthPrompt =
      '\n**Answer Depth:**\n- Start with a direct 1-2 sentence answer.\n- Follow with 2-3 short paragraphs or sections.';
  } else if (complexity === 'DEEP') {
    depthPrompt =
      '\n**Answer Depth:**\n- Start with a direct 1-2 sentence answer.\n- Provide a comprehensive analysis with 2-4 sections using bold headings.\n- Use bullet points to make complex information easy to read.';
  }

  // 4. Add conversation summary (if relevant)
  const conversationPrompt = ragContext.conversationSummary
    ? `\n**Conversation Recap:**\n${ragContext.conversationSummary}`
    : '';

  // 5. Attach RAG context (retrieved chunks)
  let ragContextPrompt = '';
  if (ragContext.retrievedChunks && ragContext.retrievedChunks.length > 0) {
    ragContextPrompt = `
**Relevant Information from Documents:**
${ragContext.retrievedChunks
  .map((chunk, i) => `--- Source ${i + 1} (${chunk.source}) ---\n${chunk.content}`)
  .join('\n\n')}`;
  }

  // 6. Add safety and grounding instructions
  const groundingPrompt =
    '\n**Crucial Instructions:**\n- Base your answer ONLY on the information provided above.\n- If the information is not in the documents, you MUST say that you did not find it.\n- For every factual claim you make, you MUST cite the source number, like this: [1].\n- Do not make up information or infer beyond what is written.';

  // 7. Add the user's query
  const userQueryPrompt = `\n**User's Request:**\n${userQuery}`;

  // Assemble the final prompt
  const finalPrompt = [
    systemPrompt,
    skillPrompt,
    depthPrompt,
    conversationPrompt,
    ragContextPrompt,
    groundingPrompt,
    userQueryPrompt,
  ].join('\n');

  return finalPrompt;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const skillAwareContextService = {
  buildFinalPrompt,
};

export default skillAwareContextService;
