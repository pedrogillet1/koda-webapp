/**
 * ============================================================================
 * KODA ANSWER ENGINE - UNIFIED ANSWER GENERATION
 * ============================================================================
 *
 * This service consolidates ALL answer generation logic.
 *
 * CONSOLIDATES:
 * - adaptiveAnswerGeneration.service.ts
 * - dynamicResponseGenerator.service.ts
 * - skillAwareAnswerGeneration.service.ts
 *
 * RESPONSIBILITIES:
 * 1. Model selection
 * 2. Answer planning
 * 3. Multi-step reasoning
 * 4. Calculation execution
 * 5. Answer synthesis
 *
 * ✅ CENTRALIZED: Now uses GeminiGateway for all API calls (2025-12-10)
 *
 * @version 3.0.0
 * @date 2025-12-10
 */

import geminiGateway, { type GeminiModel } from './geminiGateway.service';

export interface AnswerOptions {
  prompt: string;
  skill: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AnswerResult {
  content: string;
  model: string;
  tokensUsed: number;
  generationTime: number;
}

/**
 * Generate answer using the appropriate model and configuration
 *
 * ✅ CENTRALIZED: Uses GeminiGateway for unified API access
 *
 * OPTIMIZED FOR SPEED:
 * - Reduced maxTokens from 8192 to 2500 (matches rag.service)
 * - Reduced temperature from 0.7 to 0.4 (faster, more deterministic)
 * - Added topK/topP for better token selection
 */
export async function generateAnswer(options: AnswerOptions): Promise<AnswerResult> {
  const {
    prompt,
    skill,
    temperature = 0.4,  // OPTIMIZED: Was 0.7, now 0.4 for faster responses
    maxTokens = 2500,   // OPTIMIZED: Was 8192, now 2500 to prevent overly long answers
  } = options;

  const startTime = Date.now();

  // Select model based on skill
  const modelName = selectModel(skill);

  // Generate answer using centralized gateway
  const response = await geminiGateway.generateContent({
    prompt,
    model: modelName,
    config: {
      temperature,
      maxOutputTokens: maxTokens,
      topK: 40,   // OPTIMIZED: Better vocabulary variety
      topP: 0.95, // OPTIMIZED: Nucleus sampling threshold
    },
    safetySettings: 'permissive',
  });

  return {
    content: response.text,
    model: modelName,
    tokensUsed: response.totalTokens || 0,
    generationTime: Date.now() - startTime,
  };
}

/**
 * Generate streaming answer for real-time display
 *
 * ✅ CENTRALIZED: Uses GeminiGateway for unified streaming
 *
 * OPTIMIZED FOR SPEED:
 * - Same optimizations as generateAnswer
 */
export async function generateStreamingAnswer(
  options: AnswerOptions,
  onChunk: (chunk: string) => void
): Promise<AnswerResult> {
  const {
    prompt,
    skill,
    temperature = 0.4,  // OPTIMIZED: Was 0.7
    maxTokens = 2500,   // OPTIMIZED: Was 8192
  } = options;

  const startTime = Date.now();
  const modelName = selectModel(skill);

  // Generate streaming answer using centralized gateway
  const response = await geminiGateway.generateContentStream({
    prompt,
    model: modelName,
    config: {
      temperature,
      maxOutputTokens: maxTokens,
      topK: 40,   // OPTIMIZED
      topP: 0.95, // OPTIMIZED
    },
    onChunk,
    safetySettings: 'permissive',
  });

  return {
    content: response.text,
    model: modelName,
    tokensUsed: response.totalTokens || 0,
    generationTime: Date.now() - startTime,
  };
}

/**
 * Select model based on skill
 * ✅ Returns GeminiModel type for centralized gateway compatibility
 */
function selectModel(skill: string): GeminiModel {
  // Use Gemini 2.5 Flash for ALL queries
  return 'gemini-2.5-flash';
}

export default {
  generateAnswer,
  generateStreamingAnswer,
};
