/**
 * Koda Answer Engine V1
 *
 * Generates answers using Gemini with:
 * - Proper system prompts (Koda personality)
 * - Citation instructions ([[DOC:id|Title]] format)
 * - Grounding rules (no hallucinations)
 * - Fallback markers for no-data cases
 *
 * Theme 2 from notes: Single answer generator
 */

import type {
  RagContext,
  RagStatus,
  IntentClassification,
  LLMRequest,
  LLMResponse,
} from '../../types/ragV1.types';

// Import existing Gemini service
import geminiClient from '../geminiClient.service';

// ============================================================================
// Answer Engine Class
// ============================================================================

class KodaAnswerEngineV1 {
  /**
   * Generate answer from RAG context
   */
  async generateAnswer(
    query: string,
    ragContext: RagContext,
    ragStatus: RagStatus,
    intent: IntentClassification
  ): Promise<{ answer: string; usage: any }> {
    try {
      // Build prompt
      const prompt = this.buildPrompt(query, ragContext, ragStatus, intent);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(ragStatus, intent);

      // Build LLM request
      const llmRequest: LLMRequest = {
        prompt,
        systemPrompt,
        temperature: this.getTemperature(intent),
        maxTokens: this.getMaxTokens(intent),
        stopSequences: ['[END]'],
      };

      // Call Gemini
      const response = await this.callGemini(llmRequest);

      return {
        answer: response.text,
        usage: response.usage,
      };

    } catch (error) {
      console.error('[KodaAnswerEngineV1] Error:', error);

      return {
        answer: '[FALLBACK_ERROR]',
        usage: {},
      };
    }
  }

  /**
   * Build prompt with context
   */
  private buildPrompt(
    query: string,
    ragContext: RagContext,
    ragStatus: RagStatus,
    intent: IntentClassification
  ): string {
    if (ragStatus !== 'SUCCESS' || ragContext.chunks.length === 0) {
      return this.buildFallbackPrompt(query, ragStatus);
    }

    const contextText = this.buildContextText(ragContext);
    const citationInstructions = this.buildCitationInstructions(ragContext);
    const answerGuidelines = this.buildAnswerGuidelines(intent);

    return `${citationInstructions}

${answerGuidelines}

Context:
${contextText}

User Question: ${query}

Answer:`;
  }

  /**
   * Build system prompt (Koda personality + grounding rules)
   */
  private buildSystemPrompt(
    ragStatus: RagStatus,
    intent: IntentClassification
  ): string {
    const basePrompt = `You are Koda, an intelligent document assistant.

Your role:
- Answer questions based ONLY on the provided document context
- Be direct, clear, and concise
- Use professional but friendly Portuguese (Brazilian)
- Always cite sources using the [[DOC:id|Title]] format
- Never invent or hallucinate information

Grounding rules:
- If information is not in the context, say you don't have it
- Never use your general knowledge to answer document questions
- Always mention document titles when referencing information
- Be precise with numbers, dates, and facts`;

    if (ragStatus !== 'SUCCESS') {
      return `${basePrompt}

IMPORTANT: There is no document context available. Return only the fallback marker as instructed in the prompt.`;
    }

    return basePrompt;
  }

  /**
   * Build citation instructions
   */
  private buildCitationInstructions(ragContext: RagContext): string {
    const docMap = ragContext.rawSourceData
      .map((doc) => `- [[DOC:${doc.documentId}|${doc.title}]]`)
      .join('\n');

    return `Citation Instructions:
When you reference information from a document, use this format: [[DOC:documentId|Document Title]]

Available documents:
${docMap}

Example: "According to [[DOC:abc123|Trabalho projeto .pdf]], the cost per m² is R$ 500."

At the end of your answer, include a "Fontes:" section listing all documents used.`;
  }

  /**
   * Build answer guidelines based on intent
   */
  private buildAnswerGuidelines(intent: IntentClassification): string {
    switch (intent.questionType) {
      case 'simple_factual':
        return `Answer Guidelines:
- Provide a direct, factual answer
- Include the specific value or fact requested
- Bold important numbers: **R$ 500**, **25%**, **m²**
- Keep it concise (2-3 sentences)`;

      case 'multi_point_extraction':
        return `Answer Guidelines:
- List all relevant points found in the documents
- Use bullet points for clarity
- Bold key terms
- Include 3-7 items typically`;

      case 'comparison':
        return `Answer Guidelines:
- Compare the requested aspects across documents
- Use a clear structure (e.g., "In Document A... In Document B...")
- Highlight key differences
- Bold important values for easy comparison`;

      case 'follow_up':
        return `Answer Guidelines:
- Answer in the context of the previous conversation
- Reference the specific document mentioned
- Be concise and direct`;

      default:
        return `Answer Guidelines:
- Be clear and direct
- Use proper formatting (bold, bullets)
- Cite sources`;
    }
  }

  /**
   * Build context text from chunks
   */
  private buildContextText(ragContext: RagContext): string {
    return ragContext.chunks
      .map((chunk, idx) => {
        const doc = ragContext.rawSourceData.find(
          d => d.documentId === chunk.documentId
        );
        const docTitle = doc?.title || 'Unknown';
        const location = this.formatLocation(chunk.metadata);

        return `[${idx + 1}] From "${docTitle}"${location}:
${chunk.content}`;
      })
      .join('\n\n');
  }

  /**
   * Format chunk location (page, slide, etc.)
   */
  private formatLocation(metadata: any): string {
    if (metadata.page) {
      return ` (Página ${metadata.page})`;
    }
    if (metadata.slide) {
      return ` (Slide ${metadata.slide})`;
    }
    if (metadata.section) {
      return ` (${metadata.section})`;
    }
    return '';
  }

  /**
   * Build fallback prompt (no data)
   */
  private buildFallbackPrompt(query: string, ragStatus: RagStatus): string {
    let marker = '[FALLBACK_ERROR]';

    switch (ragStatus) {
      case 'NO_DOCUMENTS':
        marker = '[FALLBACK_NO_DOCUMENTS]';
        break;
      case 'NO_MATCH':
      case 'NO_MATCH_SINGLE_DOC':
        marker = '[FALLBACK_NO_MATCH]';
        break;
      case 'PROCESSING':
        marker = '[FALLBACK_PROCESSING]';
        break;
    }

    return `User Question: ${query}

There is no document context available. Return only: ${marker}`;
  }

  /**
   * Get temperature based on intent
   */
  private getTemperature(intent: IntentClassification): number {
    switch (intent.questionType) {
      case 'simple_factual':
        return 0.2;
      case 'comparison':
        return 0.3;
      case 'multi_point_extraction':
        return 0.4;
      default:
        return 0.3;
    }
  }

  /**
   * Get max tokens based on intent
   */
  private getMaxTokens(intent: IntentClassification): number {
    switch (intent.questionType) {
      case 'simple_factual':
        return 600;
      case 'comparison':
        return 1200;
      case 'multi_point_extraction':
        return 1000;
      default:
        return 800;
    }
  }

  /**
   * Call Gemini (integrate with existing service)
   */
  private async callGemini(request: LLMRequest): Promise<LLMResponse> {
    try {
      const model = geminiClient.getModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: request.temperature || 0.3,
          maxOutputTokens: request.maxTokens || 800,
        },
        systemInstruction: request.systemPrompt,
      });

      const result = await model.generateContent(request.prompt);
      const response = result.response;
      const text = response.text();

      return {
        text: text || '',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        model: 'gemini-2.5-flash',
        finishReason: 'STOP',
      };

    } catch (error) {
      console.error('[KodaAnswerEngineV1] Gemini error:', error);
      throw error;
    }
  }

  /**
   * Parse Gemini response (extract answer + markers)
   */
  parseGeminiResponse(rawText: string): {
    answer: string;
    hasFallbackMarker: boolean;
    fallbackType?: string;
  } {
    const fallbackMarkers = [
      '[FALLBACK_NO_DOCUMENTS]',
      '[FALLBACK_NO_MATCH]',
      '[FALLBACK_PROCESSING]',
      '[FALLBACK_ERROR]',
    ];

    const hasFallbackMarker = fallbackMarkers.some(marker =>
      rawText.includes(marker)
    );

    let fallbackType: string | undefined;
    if (hasFallbackMarker) {
      for (const marker of fallbackMarkers) {
        if (rawText.includes(marker)) {
          fallbackType = marker.replace('[FALLBACK_', '').replace(']', '');
          break;
        }
      }
    }

    return {
      answer: rawText,
      hasFallbackMarker,
      fallbackType,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const kodaAnswerEngineV1 = new KodaAnswerEngineV1();
export default kodaAnswerEngineV1;
