/**
 * Singleton Gemini Client Service
 *
 * Provides a single, reusable GoogleGenerativeAI instance across the entire application.
 * This prevents connection pool exhaustion and reduces memory overhead.
 *
 * BEFORE: Each request created 6+ new Gemini instances
 * AFTER: All requests share 1 singleton instance
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

class GeminiClientService {
  private static instance: GeminiClientService;
  private genAI: GoogleGenerativeAI;
  private models: Map<string, GenerativeModel>;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.models = new Map();

    console.log('✅ [GEMINI-CLIENT] Singleton instance created');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): GeminiClientService {
    if (!GeminiClientService.instance) {
      GeminiClientService.instance = new GeminiClientService();
    }
    return GeminiClientService.instance;
  }

  /**
   * Get a Gemini model with caching
   * Models are cached by configuration to avoid recreating them
   */
  public getModel(config: {
    model: string;
    systemInstruction?: string;
    generationConfig?: any;
  }): GenerativeModel {
    // Create cache key from config
    const cacheKey = JSON.stringify({
      model: config.model,
      hasSystemInstruction: !!config.systemInstruction,
      generationConfig: config.generationConfig || {}
    });

    // Return cached model if exists
    if (this.models.has(cacheKey)) {
      return this.models.get(cacheKey)!;
    }

    // Create new model
    const model = this.genAI.getGenerativeModel({
      model: config.model,
      systemInstruction: config.systemInstruction,
      generationConfig: config.generationConfig
    });

    // Cache for reuse
    this.models.set(cacheKey, model);

    console.log(`📦 [GEMINI-CLIENT] Created and cached model: ${config.model}`);

    return model;
  }

  /**
   * Get the raw GoogleGenerativeAI instance
   * Use this only if you need direct access
   */
  public getRawClient(): GoogleGenerativeAI {
    return this.genAI;
  }

  /**
   * Clear model cache (useful for testing or memory management)
   */
  public clearCache(): void {
    this.models.clear();
    console.log('🗑️ [GEMINI-CLIENT] Model cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { cachedModels: number } {
    return {
      cachedModels: this.models.size
    };
  }

  /**
   * Convenience method to generate content directly
   * Used by quality assurance services (groundingVerification, citationVerification, etc.)
   */
  public async generateContent(
    prompt: string,
    options: {
      temperature?: number;
      maxOutputTokens?: number;
      model?: string;
    } = {}
  ): Promise<{ response: { text: () => string } }> {
    const {
      temperature = 0.7,
      maxOutputTokens = 1000,
      model: modelName = 'gemini-2.5-flash'
    } = options;

    const model = this.getModel({
      model: modelName,
      generationConfig: {
        temperature,
        maxOutputTokens
      }
    });

    const result = await model.generateContent(prompt);
    const response = result.response;

    return {
      response: {
        text: () => response.text()
      }
    };
  }
}

// Export singleton instance
export default GeminiClientService.getInstance();
