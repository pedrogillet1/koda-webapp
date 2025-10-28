/**
 * Adaptive AI Service
 * Generates responses adapted to query complexity
 */

import queryClassifier, { QueryClassification } from './queryClassifier.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import pineconeService from './pinecone.service';
import vectorEmbeddingService from './vectorEmbedding.service';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export interface AdaptiveResponse {
  answer: string;
  followUp: string;
  type: string;
  confidence: number;
  responseTime?: number;
  classification?: QueryClassification;
}

class AdaptiveAIService {
  /**
   * Generate response adapted to query complexity
   */
  async generateResponse(
    query: string,
    userId: string,
    options: any = {}
  ): Promise<AdaptiveResponse> {
    const startTime = Date.now();

    // Step 1: Classify query (instant)
    const classification = await queryClassifier.classify(query);
    console.log(`📊 Query Type: ${classification.type} (${classification.responseTime})`);

    // Step 2: Get context (if needed)
    let context = '';

    if (classification.contextNeeded && classification.retrievalCount) {
      const contextStartTime = Date.now();

      try {
        // Generate embedding for the query
        const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);

        // Search for similar chunks using Pinecone
        const results = await pineconeService.searchSimilarChunks(
          queryEmbedding,
          userId,
          classification.retrievalCount,
          0.5 // minimum similarity threshold
        );

        context = results
          .map((r: any) => `${r.metadata?.content || r.content || ''}`)
          .filter((c: any) => c.trim())
          .join('\n\n');

        console.log(
          `⏱️ Context retrieval took ${Date.now() - contextStartTime}ms (${results.length} chunks)`
        );
      } catch (error) {
        console.error('Error retrieving context:', error);
        // Continue without context
      }
    }

    // Step 3: Generate response with appropriate prompt
    const generationStartTime = Date.now();
    const response = await this.generateAdaptiveResponse(query, context, classification);
    console.log(`⏱️ AI generation took ${Date.now() - generationStartTime}ms`);

    // Step 4: Add follow-up suggestion
    const followUp = queryClassifier.generateFollowUp(classification.type);

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Total response time: ${totalTime}ms`);

    return {
      answer: response,
      followUp: followUp,
      type: classification.type,
      confidence: classification.confidence,
      responseTime: totalTime,
      classification,
    };
  }

  /**
   * Generate response with type-specific prompt
   */
  private async generateAdaptiveResponse(
    query: string,
    context: string,
    classification: QueryClassification
  ): Promise<string> {
    const prompts: Record<string, string> = {
      greeting: this.getGreetingPrompt(),
      simple: this.getSimplePrompt(context),
      factual: this.getFactualPrompt(context),
      explanation: this.getExplanationPrompt(context),
      comprehensive: this.getComprehensivePrompt(context),
    };

    const systemPrompt = prompts[classification.type];

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',  // Latest Gemini 2.0 Flash
        generationConfig: {
          maxOutputTokens: classification.maxTokens,
          temperature: classification.type === 'greeting' ? 0.8 : 0.3,
        },
      });

      const fullPrompt = `${systemPrompt}\n\nUser Query: ${query}`;
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      return text.trim();
    } catch (error) {
      console.error('Error generating adaptive response:', error);
      throw error;
    }
  }

  /**
   * Greeting prompt (fast, friendly)
   */
  private getGreetingPrompt(): string {
    return `You are KODA, a friendly AI document assistant.

Respond to greetings warmly and briefly. Keep it under 20 words.

Examples:
- User: "Hello"
  You: "Hello! How can I help you with your documents today?"

- User: "Hi there"
  You: "Hi! What would you like to know?"

- User: "Good morning"
  You: "Good morning! Ready to help you find what you need."

Be warm, professional, and concise.`;
  }

  /**
   * Simple query prompt (direct answer)
   */
  private getSimplePrompt(context: string): string {
    return `You are KODA, an AI document assistant.

The user is asking a simple location/navigation question. Give a DIRECT, CONCISE answer.

Format: "Document/Item X is in Folder Y" or "You can find X in Y"

Keep your answer under 30 words. Be specific and direct.

Context from documents:
${context || 'No specific context available.'}

Answer the question directly without extra explanation.`;
  }

  /**
   * Factual query prompt (specific data)
   */
  private getFactualPrompt(context: string): string {
    return `You are KODA, an AI document assistant.

The user is asking for a specific fact or data point. Provide a CLEAR, SPECIFIC answer.

Format:
- State the fact directly
- Include relevant details (dates, numbers, names)
- Keep it under 50 words
- Be precise and accurate

Context from documents:
${context || 'No specific context available.'}

Provide the specific information requested. If the information isn't in the context, say "I don't have that specific information in your documents."`;
  }

  /**
   * Explanation prompt (detailed but focused)
   */
  private getExplanationPrompt(context: string): string {
    return `You are KODA, an AI document assistant.

The user wants an explanation. Provide a CLEAR, HELPFUL explanation.

Format:
1. Start with a direct answer (1-2 sentences)
2. Provide supporting details (2-3 sentences)
3. Include relevant examples if helpful
4. Keep it under 150 words

Context from documents:
${context || 'No specific context available.'}

Explain clearly and helpfully. Focus on what the user needs to understand.`;
  }

  /**
   * Comprehensive prompt (detailed guide)
   */
  private getComprehensivePrompt(context: string): string {
    return `You are KODA, an AI document assistant.

The user wants a comprehensive explanation or guide. Provide DETAILED, STRUCTURED information.

Format:
1. **Overview**: Brief summary (2-3 sentences)
2. **Key Points**: Main information organized clearly
3. **Details**: Relevant specifics, examples, or steps
4. **Context**: Additional helpful information

Use markdown formatting:
- **Bold** for emphasis
- Bullet points for lists
- Numbers for steps
- Clear sections

Keep it under 300 words but be thorough.

Context from documents:
${context || 'No specific context available.'}

Provide a complete, well-structured response that fully addresses the question.`;
  }

  /**
   * Generate streaming response (for future implementation)
   */
  async generateStreamingResponse(
    query: string,
    userId: string,
    onChunk: (chunk: string) => void,
    options: any = {}
  ): Promise<AdaptiveResponse> {
    const startTime = Date.now();

    // Classify query
    const classification = await queryClassifier.classify(query);

    // Get context if needed
    let context = '';
    if (classification.contextNeeded && classification.retrievalCount) {
      try {
        // Generate embedding for the query
        const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);

        // Search for similar chunks using Pinecone
        const results = await pineconeService.searchSimilarChunks(
          queryEmbedding,
          userId,
          classification.retrievalCount,
          0.5 // minimum similarity threshold
        );
        context = results
          .map((r: any) => `${r.metadata?.content || r.content || ''}`)
          .filter((c: any) => c.trim())
          .join('\n\n');
      } catch (error) {
        console.error('Error retrieving context:', error);
      }
    }

    // Generate with streaming
    const prompts: Record<string, string> = {
      greeting: this.getGreetingPrompt(),
      simple: this.getSimplePrompt(context),
      factual: this.getFactualPrompt(context),
      explanation: this.getExplanationPrompt(context),
      comprehensive: this.getComprehensivePrompt(context),
    };

    const systemPrompt = prompts[classification.type];

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',  // Latest Gemini 2.0 Flash (fastest & best quality)
      generationConfig: {
        maxOutputTokens: classification.maxTokens,
        temperature: classification.type === 'greeting' ? 0.8 : 0.3,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Query: ${query}`;
    console.log('🤖 Calling generateContentStream...');
    console.log('📝 System prompt length:', systemPrompt.length, 'chars');
    console.log('📝 Query:', query);
    console.log('📝 Context length:', context.length, 'chars');
    console.log('📝 Full prompt preview:', fullPrompt.substring(0, 500));
    const result = await model.generateContentStream(fullPrompt);
    console.log('📋 Result object keys:', Object.keys(result));
    console.log('📋 Result.stream exists?', !!result.stream);

    let fullResponse = '';
    let chunkCount = 0;

    console.log('🔄 Starting stream iteration...');
    console.log('📋 Result type:', typeof result);
    console.log('📋 Result.stream exists?', !!result.stream);
    console.log('📋 Result.response exists?', !!result.response);

    // Gemini SDK streams work differently - need to consume the stream properly
    try {
      for await (const chunk of result.stream) {
        chunkCount++;
        console.log('📦 Raw chunk object:', chunk);
        const chunkText = chunk.text();
        console.log(`📦 Chunk ${chunkCount}: "${chunkText.substring(0, 100)}"`);
        fullResponse += chunkText;

        // Only emit if we have actual content
        if (chunkText && chunkText.length > 0) {
          onChunk(chunkText);
        }
      }
    } catch (streamError) {
      console.error('❌ Error iterating stream:', streamError);
    }

    console.log(`🔍 After stream: chunkCount=${chunkCount}, fullResponse length=${fullResponse.length}`);

    // If stream didn't yield anything, use response as fallback
    if (chunkCount === 0) {
      console.log('⚠️  Stream was empty, trying result.response...');
      console.log('📋 result.response exists?', !!result.response);

      if (result.response) {
        console.log('⏳ Awaiting result.response...');
        const response = await result.response;
        console.log('📋 Response type:', typeof response);
        console.log('📋 Response keys:', response ? Object.keys(response) : 'null');
        console.log('📋 Response object:', JSON.stringify(response, null, 2).substring(0, 1000));

        const candidates = response.candidates;
        console.log('📋 Candidates:', candidates?.length);

        if (candidates && candidates.length > 0) {
          const firstCandidate = candidates[0];
          console.log('📋 First candidate:', JSON.stringify(firstCandidate, null, 2).substring(0, 500));

          if (firstCandidate.content && firstCandidate.content.parts) {
            fullResponse = firstCandidate.content.parts.map((p: any) => p.text).join('');
          }
        }

        console.log(`📄 Extracted response: "${fullResponse.substring(0, 100)}"`);

        // Emit the full response as one chunk
        if (fullResponse && fullResponse.length > 0) {
          onChunk(fullResponse);
          chunkCount = 1;
        }
      } else {
        console.error('❌ No result.response available!');
      }
    }

    console.log(`✅ Stream completed. Chunks: ${chunkCount}, Response length: ${fullResponse.length}`);

    const followUp = queryClassifier.generateFollowUp(classification.type);
    const totalTime = Date.now() - startTime;

    return {
      answer: fullResponse.trim(),
      followUp,
      type: classification.type,
      confidence: classification.confidence,
      responseTime: totalTime,
      classification,
    };
  }
}

export default new AdaptiveAIService();
