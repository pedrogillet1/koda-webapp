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
 * @version 2.0.0
 * @date 2025-12-08
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
 */
export async function generateAnswer(options: AnswerOptions): Promise<AnswerResult> {
  const {
    prompt,
    skill,
    temperature = 0.7,
    maxTokens = 8192,
    stream = false,
  } = options;

  const startTime = Date.now();

  // Select model based on skill
  const modelName = selectModel(skill);
  const model = genAI.getGenerativeModel({ model: modelName });

  // Generate answer
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const response = result.response;
  const content = response.text();

  return {
    content,
    model: modelName,
    tokensUsed: response.usageMetadata?.totalTokenCount || 0,
    generationTime: Date.now() - startTime,
  };
}

/**
 * Generate streaming answer for real-time display
 */
export async function generateStreamingAnswer(
  options: AnswerOptions,
  onChunk: (chunk: string) => void
): Promise<AnswerResult> {
  const {
    prompt,
    skill,
    temperature = 0.7,
    maxTokens = 8192,
  } = options;

  const startTime = Date.now();
  const modelName = selectModel(skill);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  let fullContent = '';
  let tokensUsed = 0;

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullContent += chunkText;
    onChunk(chunkText);
    tokensUsed = chunk.usageMetadata?.totalTokenCount || tokensUsed;
  }

  return {
    content: fullContent,
    model: modelName,
    tokensUsed,
    generationTime: Date.now() - startTime,
  };
}

function selectModel(skill: string): string {
  // Use Gemini 2.5 Flash for ALL queries
  return 'gemini-2.5-flash';
}

export default {
  generateAnswer,
  generateStreamingAnswer,
};
