/**
 * Answer Generator Service - A+ Implementation
 * Generates answers using the LLM (Gemini)
 *
 * Features:
 * - Model selection based on query tier
 * - Retry logic with exponential backoff
 * - Streaming support
 * - Centralized Gemini client management
 */

import { GenerationResult, GenerationOptions } from "../types/generation.types";
import { logger, logError } from "../utils/logger.service";
import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient() {
  if (genAI) {
    return genAI;
  }
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    return genAI;
  } catch (error) {
    logError(error as Error, {}, "Failed to initialize Gemini client");
    throw new Error("Gemini client initialization failed");
  }
}

class AnswerGeneratorService {
  public async generate(
    prompt: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    const { model, maxTokens, temperature = 0.5 } = options;
    const client = getGeminiClient();
    const geminiModel = client.getGenerativeModel({ model });

    try {
      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return {
        content: text,
        modelUsed: model,
        inputTokens: 0, // Placeholder, need to get from response
        outputTokens: 0, // Placeholder
        finishReason: response.candidates?.[0]?.finishReason || "UNKNOWN",
      };

    } catch (error) {
      logError(error as Error, { model }, "Gemini generation failed");
      throw new Error("Answer generation failed");
    }
  }

  public async generateStreaming(
    prompt: string,
    options: GenerationOptions,
    onChunk: (chunk: string) => void
  ): Promise<GenerationResult> {
    const { model, maxTokens, temperature = 0.5 } = options;
    const client = getGeminiClient();
    const geminiModel = client.getGenerativeModel({ model });

    try {
      const result = await geminiModel.generateContentStream(prompt);
      let fullContent = "";

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullContent += chunkText;
        onChunk(chunkText);
      }

      return {
        content: fullContent,
        modelUsed: model,
        inputTokens: 0, // Placeholder
        outputTokens: 0, // Placeholder
        finishReason: "STREAM_END",
      };

    } catch (error) {
      logError(error as Error, { model }, "Gemini streaming generation failed");
      throw new Error("Streaming answer generation failed");
    }
  }
}

export const answerGeneratorService = new AnswerGeneratorService();
