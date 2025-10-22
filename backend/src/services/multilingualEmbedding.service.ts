/**
 * Multilingual Embedding Service
 * Uses OpenAI's text-embedding-3-large or Cohere's multilingual-v3
 * These models map all languages into the same vector space
 * Enables cross-lingual retrieval (PT query finds EN documents)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

class MultilingualEmbeddingService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Generate multilingual embeddings using Gemini
   * Gemini embeddings are naturally multilingual
   *
   * @param text - Text in any language (PT, EN, ES, FR, etc.)
   * @returns 768-dimensional vector
   */
  async embed(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'embedding-001'
      });

      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('❌ Error generating multilingual embedding:', error);
      throw error;
    }
  }

  /**
   * Batch embedding for efficiency
   * Process multiple texts in parallel
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await Promise.all(
        texts.map(text => this.embed(text))
      );

      console.log(`✅ Generated ${embeddings.length} multilingual embeddings`);
      return embeddings;
    } catch (error) {
      console.error('❌ Error in batch embedding:', error);
      throw error;
    }
  }

  /**
   * Alternative: OpenAI text-embedding-3-large
   * Uncomment to use OpenAI instead of Gemini
   */
  /*
  private async embedWithOpenAI(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: text,
        dimensions: 1536
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
  }
  */

  /**
   * Alternative: Cohere multilingual embeddings
   * Optimized specifically for cross-lingual retrieval
   */
  async embedWithCohere(
    text: string,
    inputType: 'search_query' | 'search_document' = 'search_query'
  ): Promise<number[]> {
    if (!process.env.COHERE_API_KEY) {
      throw new Error('COHERE_API_KEY not configured');
    }

    try {
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texts: [text],
          model: 'embed-multilingual-v3.0',
          input_type: inputType, // Different embeddings for queries vs docs
          truncate: 'END'
        })
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.embeddings[0];
    } catch (error) {
      console.error('❌ Error with Cohere embedding:', error);
      throw error;
    }
  }

  /**
   * Test multilingual capability
   * Verifies that embeddings work across languages
   */
  async testCrossLingualSimilarity(): Promise<void> {
    console.log('🧪 Testing cross-lingual similarity...\n');

    const texts = {
      en: 'What is the ideal customer profile?',
      pt: 'Qual é o perfil do cliente ideal?',
      es: '¿Cuál es el perfil del cliente ideal?'
    };

    // Generate embeddings
    const embeddings = {
      en: await this.embed(texts.en),
      pt: await this.embed(texts.pt),
      es: await this.embed(texts.es)
    };

    // Calculate similarities
    const ptEnSim = this.cosineSimilarity(embeddings.pt, embeddings.en);
    const esEnSim = this.cosineSimilarity(embeddings.es, embeddings.en);
    const ptEsSim = this.cosineSimilarity(embeddings.pt, embeddings.es);

    console.log('Cross-lingual similarity scores:');
    console.log(`  PT ↔ EN: ${(ptEnSim * 100).toFixed(1)}%`);
    console.log(`  ES ↔ EN: ${(esEnSim * 100).toFixed(1)}%`);
    console.log(`  PT ↔ ES: ${(ptEsSim * 100).toFixed(1)}%`);

    if (ptEnSim > 0.8 && esEnSim > 0.8 && ptEsSim > 0.8) {
      console.log('✅ Multilingual embeddings working correctly!\n');
    } else {
      console.warn('⚠️ Cross-lingual similarity lower than expected\n');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}

export default new MultilingualEmbeddingService();
export { MultilingualEmbeddingService };
