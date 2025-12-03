import { GoogleGenerativeAI } from '@google/generative-ai';

interface RelevanceScore {
  chunkId: string;
  text: string;
  score: number; // 0-100
  reasoning: string;
}

export class RetrievalQualityService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Score relevance of retrieved chunks to user query
   */
  async scoreRelevance(
    query: string,
    chunks: Array<{ id: string; text: string }>
  ): Promise<RelevanceScore[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const scores: RelevanceScore[] = [];

    for (const chunk of chunks) {
      const prompt = `
You are a relevance scorer. Score how relevant this text chunk is to answering the user's question.

User Question: "${query}"

Text Chunk:
"""
${chunk.text}
"""

Provide:
1. Relevance score (0-100, where 100 = perfectly relevant, 0 = completely irrelevant)
2. Brief reasoning (one sentence)

Format your response as JSON:
{
  "score": <number>,
  "reasoning": "<string>"
}
`;

      try {
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Clean up response (remove markdown code blocks if present)
        const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const parsed = JSON.parse(cleanResponse);
        scores.push({
          chunkId: chunk.id,
          text: chunk.text,
          score: parsed.score,
          reasoning: parsed.reasoning
        });
      } catch (error) {
        console.error('Error scoring chunk relevance:', error);
        // Fallback: assume medium relevance if parsing fails
        scores.push({
          chunkId: chunk.id,
          text: chunk.text,
          score: 50,
          reasoning: 'Could not determine relevance'
        });
      }
    }

    return scores;
  }

  /**
   * Check if retrieval quality is sufficient to answer
   */
  isRetrievalSufficient(scores: RelevanceScore[]): {
    sufficient: boolean;
    averageScore: number;
    topScore: number;
    recommendation: string;
  } {
    if (scores.length === 0) {
      return {
        sufficient: false,
        averageScore: 0,
        topScore: 0,
        recommendation: 'No relevant information found in documents.'
      };
    }

    const averageScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const topScore = Math.max(...scores.map(s => s.score));

    // Decision thresholds
    if (topScore >= 80) {
      return {
        sufficient: true,
        averageScore,
        topScore,
        recommendation: 'High quality retrieval. Proceed with answer.'
      };
    } else if (topScore >= 50) {
      return {
        sufficient: true,
        averageScore,
        topScore,
        recommendation: 'Moderate quality retrieval. Answer with caution and mention uncertainty.'
      };
    } else {
      return {
        sufficient: false,
        averageScore,
        topScore,
        recommendation: 'Low quality retrieval. Inform user that information is limited or unavailable.'
      };
    }
  }
}
