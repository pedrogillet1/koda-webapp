/**
 * Embedding Service Adapter - A+ Implementation
 * Provides embedding generation for the RAG pipeline
 *
 * This adapter wraps the existing embedding functionality
 * to provide a consistent interface for the new RAG services
 */

import { logger, logError } from "./utils/logger.service";
import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (genAI) {
    return genAI;
  }
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    return genAI;
  } catch (error) {
    logError(error as Error, {}, "Failed to initialize Gemini client for embeddings");
    throw new Error("Gemini client initialization failed");
  }
}

class EmbeddingService {
  private readonly modelName = "text-embedding-004";
  private readonly dimension = 768;

  /**
   * Generate embedding for a single text
   */
  public async generate(text: string): Promise<number[]> {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: this.modelName });

    try {
      const result = await model.embedContent(text);
      const embedding = result.embedding.values;

      if (!embedding || embedding.length !== this.dimension) {
        throw new Error(`Invalid embedding dimension: expected ${this.dimension}, got ${embedding?.length}`);
      }

      return embedding;

    } catch (error) {
      logError(error as Error, { textLength: text.length }, "Embedding generation failed");
      throw new Error("Embedding generation failed");
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  public async generateBatch(texts: string[]): Promise<number[][]> {
    // For now, process sequentially - can be optimized with Promise.all
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.generate(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  /**
   * Get the embedding dimension
   */
  public getDimension(): number {
    return this.dimension;
  }
}

export const embeddingService = new EmbeddingService();
