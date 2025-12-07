/**
 * Cross-Document Synthesis Service
 *
 * Analyzes themes, topics, and patterns across ALL user documents.
 * Used for queries like:
 * - "Analyze the key themes across all my documents"
 * - "List all the main topics from my documents"
 * - "What are the common themes?"
 */

import prisma from '../config/database';
import embeddingService from './embedding.service';
import { Pinecone } from '@pinecone-database/pinecone';
import geminiClient from './geminiClient.service';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);

interface SynthesisResult {
  synthesis: string;
  sources: Array<{ documentId: string; filename: string; relevance: number }>;
  methodologies: Array<{ name: string; documentIds: string[]; description?: string }>;
  totalDocuments: number;
}

/**
 * Synthesize themes/topics across all user documents
 */
export async function synthesizeMethodologies(
  userId: string,
  topic?: string
): Promise<SynthesisResult> {
  console.log(`📊 [SYNTHESIS] Starting cross-document analysis for user ${userId}`);
  console.log(`   Topic filter: ${topic || 'all documents'}`);

  try {
    // Step 1: Get all user documents from database
    const allDocuments = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        metadata: true,
      },
    });

    if (allDocuments.length === 0) {
      console.log('   ❌ No documents found');
      return {
        synthesis: '',
        sources: [],
        methodologies: [],
        totalDocuments: 0,
      };
    }

    console.log(`   ✅ Found ${allDocuments.length} documents`);

    // Step 2: Generate embedding for the query (if topic specified)
    let queryEmbedding: number[] | null = null;
    if (topic && topic !== 'general') {
      const queryText = `themes topics subjects about: ${topic}`;
      const embeddingResult = await embeddingService.generateEmbedding(queryText);
      queryEmbedding = embeddingResult.embedding;
    }

    // Step 3: Retrieve relevant chunks from Pinecone
    // If no topic, we need to sample from all documents
    const documentIds = allDocuments.map(d => d.id);
    let relevantChunks: Array<{
      id: string;
      score: number;
      metadata: any;
    }> = [];

    if (queryEmbedding) {
      // Query with topic filter
      const pineconeResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 50, // Get more chunks for synthesis
        filter: {
          userId,
          documentId: { $in: documentIds },
        },
        includeMetadata: true,
      });

      relevantChunks = pineconeResults.matches.map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata || {},
      }));
    } else {
      // No topic - sample from all documents
      // Get representative chunks from each document
      for (const doc of allDocuments.slice(0, 20)) { // Limit to 20 docs for performance
        try {
          const docEmbeddingResult = await embeddingService.generateEmbedding(`document summary: ${doc.filename}`);
          const docChunks = await pineconeIndex.query({
            vector: docEmbeddingResult.embedding,
            topK: 3, // Get top 3 chunks per document
            filter: {
              userId,
              documentId: doc.id,
            },
            includeMetadata: true,
          });

          relevantChunks.push(...docChunks.matches.map(match => ({
            id: match.id,
            score: match.score || 0,
            metadata: match.metadata || {},
          })));
        } catch (error) {
          console.error(`   ⚠️ Error querying document ${doc.filename}:`, error);
        }
      }
    }

    console.log(`   ✅ Retrieved ${relevantChunks.length} relevant chunks`);

    if (relevantChunks.length === 0) {
      console.log('   ❌ No relevant content found');
      return {
        synthesis: '',
        sources: [],
        methodologies: [],
        totalDocuments: allDocuments.length,
      };
    }

    // Step 4: Group chunks by document
    const chunksByDocument = new Map<string, Array<{ content: string; score: number }>>();
    for (const chunk of relevantChunks) {
      const docId = chunk.metadata.documentId as string;
      const content = chunk.metadata.content as string;

      if (!chunksByDocument.has(docId)) {
        chunksByDocument.set(docId, []);
      }

      chunksByDocument.get(docId)!.push({
        content,
        score: chunk.score,
      });
    }

    // Step 5: Build context for LLM
    let contextText = `# Document Collection Analysis\n\n`;
    contextText += `Total Documents: ${allDocuments.length}\n`;
    contextText += `Documents with Relevant Content: ${chunksByDocument.size}\n\n`;

    contextText += `## Document Contents:\n\n`;

    const sourcesMap = new Map<string, { filename: string; relevance: number }>();

    for (const [docId, chunks] of chunksByDocument.entries()) {
      const doc = allDocuments.find(d => d.id === docId);
      if (!doc) continue;

      const avgScore = chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length;
      sourcesMap.set(docId, { filename: doc.filename, relevance: avgScore });

      contextText += `### Document: **${doc.filename}**\n\n`;

      // Include top chunks from this document
      const topChunks = chunks
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 chunks per document

      for (const chunk of topChunks) {
        contextText += `${chunk.content}\n\n`;
      }

      contextText += `---\n\n`;
    }

    // Step 6: Generate synthesis using LLM
    const systemPrompt = `You are Koda, an AI assistant analyzing documents for themes and topics.

Your task is to analyze the provided document contents and identify:
1. **Main Themes**: Recurring concepts, ideas, or subjects across documents
2. **Key Topics**: Specific areas or subjects discussed
3. **Patterns**: Common approaches, methodologies, or structures

**FORMATTING REQUIREMENTS:**

Use proper markdown structure:
- Use ## for main sections (Main Themes, Key Topics, etc.)
- Use ### for subsections
- Use bullet lists: - **Item**: Description
- Use **bold** for emphasis
- Add line breaks between sections
- NEVER use empty bullet points

**Example Output:**

## Main Themes

### 1. Data Protection and Privacy
- **LGPD Compliance**: Multiple documents discuss Brazilian data protection regulations
- **User Rights**: Emphasis on data subject rights and consent management
- **Security Measures**: Technical and organizational security requirements

### 2. Business Operations
- **Financial Planning**: Budget projections and cost analysis
- **Project Management**: Workflow documentation and process guidelines

## Key Topics

- **Legal Compliance**: LGPD, data protection, privacy policies
- **Financial Analysis**: Budget, revenue projections, cost estimates
- **Project Documentation**: Requirements, specifications, timelines

## Document Coverage

Analyzed ${chunksByDocument.size} documents out of ${allDocuments.length} total documents.

---

**Source Documents:**
${Array.from(sourcesMap.values()).map(s => `- **${s.filename}**`).join('\n')}`;

    const userPrompt = topic && topic !== 'general'
      ? `Analyze the themes and topics related to "${topic}" in these documents:\n\n${contextText}`
      : `Analyze the main themes and topics across all these documents:\n\n${contextText}`;

    console.log(`   🤖 Generating synthesis with Gemini...`);

    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.3, // Lower temperature for more focused analysis
        maxOutputTokens: 2000,
      },
    });

    const result = await model.generateContent(userPrompt);
    const synthesis = result.response.text();

    console.log(`   ✅ Synthesis generated (${synthesis.length} chars)`);

    // Step 7: Build sources list
    const sources = Array.from(sourcesMap.entries()).map(([documentId, info]) => ({
      documentId,
      filename: info.filename,
      relevance: info.relevance,
    }));

    // Step 8: Extract methodologies (for compatibility)
    // This is a simplified version - could be enhanced with more sophisticated extraction
    const methodologies = [{
      name: topic || 'Cross-Document Analysis',
      documentIds: Array.from(chunksByDocument.keys()),
      description: `Analysis of ${chunksByDocument.size} documents`,
    }];

    return {
      synthesis,
      sources,
      methodologies,
      totalDocuments: allDocuments.length,
    };

  } catch (error) {
    console.error('❌ [SYNTHESIS] Error:', error);
    throw error;
  }
}

/**
 * Export default object
 */
export default {
  synthesizeMethodologies,
};

/**
 * Named export for service object (matches stub interface)
 */
export const crossDocumentSynthesisService = {
  synthesizeMethodologies,
};
