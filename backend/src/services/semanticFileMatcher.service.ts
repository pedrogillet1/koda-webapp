import OpenAI from 'openai';
import { config } from '../config/env';
import prisma from '../config/database';

/**
 * ✅ FIX #4: Semantic File Matching Service
 *
 * Uses OpenAI embeddings to find files semantically instead of fuzzy string matching.
 * This dramatically improves accuracy when users reference files with slight variations.
 *
 * Example:
 * - User says: "blueprint document"
 * - Fuzzy matching fails on: "KODA_Product_Blueprint_Final_v2.pdf"
 * - Semantic matching succeeds: understands "blueprint" → "Product Blueprint"
 */

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

interface SemanticMatch {
  documentId: string;
  filename: string;
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
}

interface MatchResult {
  matches: SemanticMatch[];
  isAmbiguous: boolean;
  requiresConfirmation: boolean;
}

/**
 * Generate embedding for a text string using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Fast and cost-effective
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ [Semantic Matcher] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find files semantically using OpenAI embeddings
 *
 * @param userId - User ID to filter documents
 * @param query - User's query or file reference (e.g., "blueprint", "contract document")
 * @param topK - Number of top matches to return (default: 5)
 * @returns Semantic matches with similarity scores
 */
export async function findFilesSemantically(
  userId: string,
  query: string,
  topK: number = 5
): Promise<MatchResult> {
  console.log(`🔍 [Semantic Matcher] Finding files for query: "${query}"`);

  try {
    // Step 1: Get all user's documents
    const documents = await prisma.documents.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
      },
      select: {
        id: true,
        filename: true,
      },
    });

    if (documents.length === 0) {
      console.log('⚠️ [Semantic Matcher] No documents found for user');
      return {
        matches: [],
        isAmbiguous: false,
        requiresConfirmation: false,
      };
    }

    console.log(`📚 [Semantic Matcher] Found ${documents.length} documents to search`);

    // Step 2: Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query.toLowerCase());

    // Step 3: Generate embeddings for all filenames and calculate similarities
    const similarities: SemanticMatch[] = [];

    for (const doc of documents) {
      // Clean filename (remove extension and special chars)
      const cleanFilename = doc.filename
        .replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '')
        .replace(/[_-]/g, ' ')
        .toLowerCase();

      // Generate embedding for filename
      const filenameEmbedding = await generateEmbedding(cleanFilename);

      // Calculate cosine similarity
      const similarity = cosineSimilarity(queryEmbedding, filenameEmbedding);

      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low';
      if (similarity >= 0.85) {
        confidence = 'high';
      } else if (similarity >= 0.70) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      similarities.push({
        documentId: doc.id,
        filename: doc.filename,
        similarity,
        confidence,
      });
    }

    // Step 4: Sort by similarity (descending) and take top K
    const sortedMatches = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    // Step 5: Determine if results are ambiguous
    const topMatch = sortedMatches[0];
    const secondMatch = sortedMatches[1];

    // Ambiguous if:
    // - Multiple high-confidence matches OR
    // - Top 2 matches are very close in similarity (< 0.05 difference)
    const isAmbiguous =
      (sortedMatches.filter(m => m.confidence === 'high').length > 1) ||
      (secondMatch && Math.abs(topMatch.similarity - secondMatch.similarity) < 0.05);

    // Require confirmation if ambiguous OR if top match is only medium confidence
    const requiresConfirmation = isAmbiguous || (topMatch && topMatch.confidence === 'medium');

    console.log(`✅ [Semantic Matcher] Found ${sortedMatches.length} matches`);
    console.log(`📊 [Semantic Matcher] Top match: ${topMatch?.filename} (${(topMatch?.similarity * 100).toFixed(1)}%)`);
    console.log(`⚠️ [Semantic Matcher] Ambiguous: ${isAmbiguous}, Needs confirmation: ${requiresConfirmation}`);

    return {
      matches: sortedMatches,
      isAmbiguous,
      requiresConfirmation,
    };
  } catch (error) {
    console.error('❌ [Semantic Matcher] Error:', error);
    throw error;
  }
}

/**
 * Find a single file semantically with automatic fallback
 * Returns null if no confident match found
 */
export async function findSingleFile(
  userId: string,
  query: string
): Promise<{ documentId: string; filename: string; confidence: string } | null> {
  const result = await findFilesSemantically(userId, query, 1);

  if (result.matches.length === 0) {
    return null;
  }

  const topMatch = result.matches[0];

  // Only return if high confidence and not ambiguous
  if (topMatch.confidence === 'high' && !result.isAmbiguous) {
    return {
      documentId: topMatch.documentId,
      filename: topMatch.filename,
      confidence: topMatch.confidence,
    };
  }

  return null;
}

export default {
  findFilesSemantically,
  findSingleFile,
};
