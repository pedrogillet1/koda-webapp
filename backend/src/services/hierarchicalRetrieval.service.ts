/**
 * Hierarchical Retrieval Service
 * Implements 3-level document retrieval with AI reranking:
 * Level 1: Document filtering (find relevant documents)
 * Level 2: Section/chunk retrieval (find relevant chunks within documents)
 * Level 3: AI-powered reranking (reorder results by relevance using Gemini)
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import vectorEmbeddingService from './vectorEmbedding.service';

const prisma = new PrismaClient();

interface HierarchicalResult {
  documentId: string;
  documentName: string;
  documentScore: number;
  sections: {
    sectionName: string;
    sectionScore: number;
    chunks: {
      chunkIndex: number;
      content: string;
      score: number;
      metadata: any;
    }[];
  }[];
}

class HierarchicalRetrievalService {
  private genAI: GoogleGenerativeAI;
  private readonly MODEL_NAME = 'gemini-2.5-pro';

  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Hierarchical search with AI reranking: Document level → Section level → Chunk level → AI Reranking
   *
   * Level 1: Filter documents by relevance
   * Level 2: Within top documents, find relevant sections
   * Level 3: Within relevant sections, find precise chunks
   * Level 4: AI-powered reranking of final results
   */
  async hierarchicalSearch(
    userId: string,
    queryText: string,
    topDocuments: number = 3,
    topChunksPerDocument: number = 3,
    minDocumentScore: number = 0.5,
    enableReranking: boolean = true
  ): Promise<HierarchicalResult[]> {
    try {
      console.log(`🎯 [Hierarchical] Starting 3-level search for: "${queryText}"`);
      console.log(`   Level 1: Filter to top ${topDocuments} documents`);
      console.log(`   Level 2: Find relevant sections within each document`);
      console.log(`   Level 3: Extract ${topChunksPerDocument} precise chunks per document`);

      // LEVEL 1: Document-level filtering
      console.log(`📄 [Hierarchical L1] Document-level filtering...`);
      const documentScores = await this.scoreDocuments(userId, queryText);

      // Filter documents by minimum score and take top N
      const topDocs = documentScores
        .filter(d => d.score >= minDocumentScore)
        .slice(0, topDocuments);

      if (topDocs.length === 0) {
        console.warn('⚠️ [Hierarchical] No documents meet minimum score threshold');
        return [];
      }

      console.log(`✅ [Hierarchical L1] Selected ${topDocs.length} documents:`);
      topDocs.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.filename} (score: ${doc.score.toFixed(3)})`);
      });

      // LEVEL 2 & 3: Section and chunk-level retrieval for each document
      const results: HierarchicalResult[] = [];

      for (const doc of topDocs) {
        console.log(`🔍 [Hierarchical L2/L3] Analyzing document: ${doc.filename}`);

        const sectionsAndChunks = await this.getSectionsAndChunks(
          doc.documentId,
          queryText,
          topChunksPerDocument
        );

        if (sectionsAndChunks.sections.length > 0) {
          results.push({
            documentId: doc.documentId,
            documentName: doc.filename,
            documentScore: doc.score,
            sections: sectionsAndChunks.sections
          });
        }
      }

      console.log(`✅ [Hierarchical] Found results in ${results.length} documents`);
      results.forEach((r, i) => {
        const totalChunks = r.sections.reduce((sum, s) => sum + s.chunks.length, 0);
        console.log(`   ${i + 1}. ${r.documentName}: ${r.sections.length} sections, ${totalChunks} chunks`);
      });

      // LEVEL 4: AI-powered reranking (optional)
      if (enableReranking && results.length > 0) {
        console.log(`🤖 [Hierarchical L4] AI-powered reranking...`);
        const rerankedResults = await this.rerankResultsWithAI(queryText, results);
        console.log(`✅ [Hierarchical L4] Reranking complete`);
        return rerankedResults;
      }

      return results;
    } catch (error) {
      console.error('❌ [Hierarchical] Error:', error);
      throw error;
    }
  }

  /**
   * LEVEL 1: Score all documents by relevance
   * Uses average similarity of document's chunks
   */
  private async scoreDocuments(
    userId: string,
    queryText: string
  ): Promise<Array<{ documentId: string; filename: string; score: number }>> {
    // Get all embeddings for user's documents
    const allEmbeddings = await prisma.documentEmbedding.findMany({
      where: {
        document: {
          userId
        }
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true
          }
        }
      }
    });

    if (allEmbeddings.length === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await vectorEmbeddingService.generateEmbedding(queryText);

    // Group embeddings by document and calculate average similarity
    const documentMap = new Map<string, { filename: string; similarities: number[] }>();

    for (const embedding of allEmbeddings) {
      const embeddingVector = JSON.parse(embedding.embedding) as number[];
      const similarity = vectorEmbeddingService.cosineSimilarity(queryEmbedding, embeddingVector);

      const docId = embedding.documentId;
      if (!documentMap.has(docId)) {
        documentMap.set(docId, {
          filename: embedding.document.filename,
          similarities: []
        });
      }

      documentMap.get(docId)!.similarities.push(similarity);
    }

    // Calculate document-level scores (average of top 3 chunk similarities)
    const documentScores = Array.from(documentMap.entries()).map(([docId, data]) => {
      // Take average of top 3 similarities (or all if less than 3)
      const topSimilarities = data.similarities
        .sort((a, b) => b - a)
        .slice(0, 3);

      const avgScore = topSimilarities.reduce((sum, s) => sum + s, 0) / topSimilarities.length;

      return {
        documentId: docId,
        filename: data.filename,
        score: avgScore
      };
    });

    // Sort by score descending
    return documentScores.sort((a, b) => b.score - a.score);
  }

  /**
   * LEVEL 2 & 3: Get sections and top chunks within a document
   */
  private async getSectionsAndChunks(
    documentId: string,
    queryText: string,
    topChunksPerSection: number
  ): Promise<{ sections: HierarchicalResult['sections'] }> {
    // Get all chunks for this document
    const chunks = await prisma.documentEmbedding.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' }
    });

    if (chunks.length === 0) {
      return { sections: [] };
    }

    // Generate query embedding
    const queryEmbedding = await vectorEmbeddingService.generateEmbedding(queryText);

    // Score each chunk
    const scoredChunks = chunks.map(chunk => {
      const embeddingVector = JSON.parse(chunk.embedding) as number[];
      const similarity = vectorEmbeddingService.cosineSimilarity(queryEmbedding, embeddingVector);
      const metadata = JSON.parse(chunk.metadata);

      return {
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: similarity,
        metadata,
        section: metadata.heading || metadata.section || 'No section'
      };
    });

    // LEVEL 2: Group by section
    const sectionMap = new Map<string, typeof scoredChunks>();

    for (const chunk of scoredChunks) {
      const sectionName = chunk.section;

      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, []);
      }

      sectionMap.get(sectionName)!.push(chunk);
    }

    // LEVEL 3: For each section, take top chunks and calculate section score
    const sections: HierarchicalResult['sections'] = [];

    for (const [sectionName, sectionChunks] of sectionMap.entries()) {
      // Sort chunks by score within section
      const topChunks = sectionChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, topChunksPerSection);

      // Section score = average of top chunks
      const sectionScore = topChunks.reduce((sum, c) => sum + c.score, 0) / topChunks.length;

      // Only include sections with meaningful scores
      if (sectionScore >= 0.4) {
        sections.push({
          sectionName,
          sectionScore,
          chunks: topChunks.map(c => ({
            chunkIndex: c.chunkIndex,
            content: c.content,
            score: c.score,
            metadata: c.metadata
          }))
        });
      }
    }

    // Sort sections by score
    sections.sort((a, b) => b.sectionScore - a.sectionScore);

    return { sections };
  }

  /**
   * LEVEL 4: AI-powered reranking using Gemini
   * Reorder chunks within each document based on AI relevance scoring
   */
  private async rerankResultsWithAI(
    queryText: string,
    results: HierarchicalResult[]
  ): Promise<HierarchicalResult[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

      // Collect all chunks across all documents for reranking
      interface ChunkWithContext {
        documentId: string;
        sectionName: string;
        chunkIndex: number;
        content: string;
        originalScore: number;
      }

      const allChunks: ChunkWithContext[] = [];
      for (const result of results) {
        for (const section of result.sections) {
          for (const chunk of section.chunks) {
            allChunks.push({
              documentId: result.documentId,
              sectionName: section.sectionName,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              originalScore: chunk.score
            });
          }
        }
      }

      if (allChunks.length === 0) {
        return results;
      }

      // Build prompt for AI reranking
      const passagesText = allChunks
        .map((chunk, idx) => `Passage ${idx + 1}:\n${chunk.content.slice(0, 500)}${chunk.content.length > 500 ? '...' : ''}`)
        .join('\n\n');

      const prompt = `You are a relevance scoring system. Rate how relevant each passage is to answering the given question.

Question: ${queryText}

${passagesText}

Rate each passage on a scale of 0-10 where:
- 0-3: Not relevant or marginally relevant
- 4-6: Somewhat relevant, contains some useful information
- 7-8: Quite relevant, contains important information
- 9-10: Highly relevant, directly answers the question

Return ONLY the scores as numbers (one per line), no explanation or other text.
Example output:
7
5
9
3`;

      const aiResult = await model.generateContent(prompt);
      const response = aiResult.response.text();

      // Parse AI scores
      const scores = response
        .trim()
        .split('\n')
        .map(line => {
          const score = parseFloat(line.trim());
          return isNaN(score) ? 5 : Math.max(0, Math.min(10, score)); // Clamp to 0-10
        });

      // Assign AI scores to chunks
      const rerankedChunks = allChunks.map((chunk, idx) => ({
        ...chunk,
        aiScore: scores[idx] !== undefined ? scores[idx] / 10 : 0.5, // Normalize to 0-1
      }));

      // Rebuild the hierarchical structure with new scores
      const rerankedResults: HierarchicalResult[] = results.map(result => {
        const resultChunks = rerankedChunks.filter(c => c.documentId === result.documentId);

        // Group by section
        const sectionMap = new Map<string, typeof resultChunks>();
        for (const chunk of resultChunks) {
          if (!sectionMap.has(chunk.sectionName)) {
            sectionMap.set(chunk.sectionName, []);
          }
          sectionMap.get(chunk.sectionName)!.push(chunk);
        }

        const sections = Array.from(sectionMap.entries()).map(([sectionName, chunks]) => {
          // Sort chunks by AI score
          const sortedChunks = chunks.sort((a, b) => b.aiScore - a.aiScore);

          // Calculate new section score (average of AI scores)
          const sectionScore = sortedChunks.reduce((sum, c) => sum + c.aiScore, 0) / sortedChunks.length;

          return {
            sectionName,
            sectionScore,
            chunks: sortedChunks.map(c => ({
              chunkIndex: c.chunkIndex,
              content: c.content,
              score: c.aiScore, // Use AI score
              metadata: { originalScore: c.originalScore, aiScore: c.aiScore }
            }))
          };
        });

        // Sort sections by score
        sections.sort((a, b) => b.sectionScore - a.sectionScore);

        return {
          ...result,
          sections
        };
      });

      return rerankedResults;
    } catch (error: any) {
      console.error('⚠️ [Hierarchical L4] AI reranking failed, using original scores:', error.message);
      return results; // Fallback to original results
    }
  }

  /**
   * Flatten hierarchical results into a simple list of chunks
   * Useful for backward compatibility with existing RAG pipeline
   */
  flattenResults(hierarchicalResults: HierarchicalResult[]): Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    metadata: any;
  }> {
    const flattened: any[] = [];

    for (const result of hierarchicalResults) {
      for (const section of result.sections) {
        for (const chunk of section.chunks) {
          flattened.push({
            documentId: result.documentId,
            documentName: result.documentName,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            similarity: chunk.score,
            metadata: {
              ...chunk.metadata,
              documentScore: result.documentScore,
              sectionName: section.sectionName,
              sectionScore: section.sectionScore
            }
          });
        }
      }
    }

    return flattened;
  }
}

export default new HierarchicalRetrievalService();
