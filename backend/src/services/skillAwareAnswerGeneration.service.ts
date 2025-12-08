/**
 * ============================================================================
 * SKILL-AWARE ANSWER GENERATION SERVICE
 * ============================================================================
 *
 * This service uses the skill mapping to determine:
 * - Token budgets
 * - Temperature
 * - Model selection (future)
 * - System instructions
 *
 * Works alongside adaptiveAnswerGeneration.service.ts
 * ============================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SkillMapping } from './skillAndIntentRouter.service';
import { RAGPipelineConfig } from './speedProfileManager.service';
import { buildFinalPrompt, RAGContext } from './skillAwareContext.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface GenerateSkillAwareAnswerParams {
  skillMapping: SkillMapping;
  ragConfig: RAGPipelineConfig;
  ragContext: RAGContext;
  userQuery: string;
}

export interface SkillAwareAnswerResult {
  answer: string;
  skillId: string;
  speedProfile: string;
  stats: {
    llmCallDuration: number;
    tokenCount: number;
  };
}

// ============================================================================
// GEMINI CLIENT INITIALIZATION
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================================
// GENERATE SKILL-AWARE ANSWER
// ============================================================================

/**
 * Generate a skill-aware answer using the new structured system
 *
 * @param params - Structured parameters including skill mapping and configs
 * @param onChunk - Optional callback for streaming
 * @returns The generated answer and metadata
 */
export async function generateSkillAwareAnswer(
  params: GenerateSkillAwareAnswerParams,
  onChunk?: (chunk: string) => void
): Promise<SkillAwareAnswerResult> {
  const { skillMapping, ragConfig, ragContext, userQuery } = params;
  const startTime = Date.now();

  try {
    // 1. Build the final prompt using the context engineering service
    const finalPrompt = buildFinalPrompt(skillMapping, ragContext, userQuery);

    // 2. Configure the Gemini model with skill-aware parameters
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Could be skill-dependent in future
      systemInstruction: 'You are Koda, an expert AI document assistant.',
      generationConfig: {
        temperature: ragConfig.temperature,
        topP: 0.95,
        topK: 50,
        maxOutputTokens: ragConfig.maxTokens,
        stopSequences: ['\n\n---END---', '\n\n===='],
      },
    });

    console.log(`[SkillAwareGen] Generating answer for skill: ${skillMapping.skillConfig.skillId}`);
    console.log(`[SkillAwareGen] Config: maxTokens=${ragConfig.maxTokens}, temp=${ragConfig.temperature}`);

    // 3. Generate the answer (streaming or non-streaming)
    let fullResponse = '';

    if (onChunk) {
      // Streaming mode
      const result = await model.generateContentStream(finalPrompt);
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        onChunk(chunkText);
      }
    } else {
      // Non-streaming mode
      const result = await model.generateContent(finalPrompt);
      fullResponse = result.response.text();
    }

    const llmCallDuration = Date.now() - startTime;
    console.log(`[SkillAwareGen] LLM call finished in ${llmCallDuration}ms`);

    // 4. Basic validation and cleanup
    if (fullResponse.trim().length === 0) {
      throw new Error('LLM returned an empty response.');
    }

    // 5. Return the structured result
    return {
      answer: fullResponse,
      skillId: skillMapping.skillConfig.skillId,
      speedProfile: skillMapping.speedProfile,
      stats: {
        llmCallDuration,
        tokenCount: Math.ceil(fullResponse.length / 4), // Estimate
      },
    };
  } catch (error: any) {
    console.error('[SkillAwareGen] Error during answer generation:', error);
    throw new Error(`Failed to generate answer: ${error.message}`);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const skillAwareAnswerGenerationService = {
  generateSkillAwareAnswer,
};

export default skillAwareAnswerGenerationService;
