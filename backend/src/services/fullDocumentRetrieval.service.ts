/**
 * Full Document Retrieval Service
 * Retrieves complete documents instead of chunks for better context
 */

import prisma from '../config/database';
import { Pinecone } from '@pinecone-database/pinecone';
import embeddingService from './embedding.service';
import NodeCache from 'node-cache';

// Cache for full document content (TTL: 5 minutes)
const documentCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export interface FullDocument {
  id: string;
  filename: string;
  mimeType: string;
  content: string;
  document_metadata: {
    pageCount?: number;
    wordCount: number;
    uploadDate: Date;
  };
  relevanceScore: number;
}

export interface RetrievalOptions {
  maxDocuments?: number;
  minRelevanceScore?: number;
  maxTotalTokens?: number;
  includeAttachedDocument?: boolean;
}

/**
 * Retrieve full documents based on query
 */
export async function retrieveFullDocuments(
  userId: string,
  query: string,
  attachedDocumentId?: string,
  options: RetrievalOptions = {}
): Promise<FullDocument[]> {
  const {
    maxDocuments = 3,
    minRelevanceScore = 0.7,
    maxTotalTokens = 100000,
    includeAttachedDocument = true
  } = options;

  console.log(`📄 [FULL DOC] Retrieving full documents for query: "${query.substring(0, 50)}..."`);

  // Step 1: Get relevant document IDs from vector search
  const relevantDocIds = await findRelevantDocumentIds(
    userId,
    query,
    attachedDocumentId,
    maxDocuments,
    minRelevanceScore
  );

  if (relevantDocIds.length === 0) {
    console.log(`📄 [FULL DOC] No relevant documents found`);
    return [];
  }

  // Step 2: Retrieve full content from database (with caching)
  const cachedDocuments: any[] = [];
  const uncachedDocIds: string[] = [];

  for (const docId of relevantDocIds.map(d => d.id)) {
    const cached = documentCache.get<any>(docId);
    if (cached) {
      cachedDocuments.push(cached);
      console.log(`📄 [CACHE HIT] Document ${docId}`);
    } else {
      uncachedDocIds.push(docId);
    }
  }

  let fetchedDocuments: any[] = [];
  if (uncachedDocIds.length > 0) {
    console.log(`📄 [CACHE MISS] Fetching ${uncachedDocIds.length} documents from database`);
    fetchedDocuments = await prisma.documents.findMany({
      where: {
        id: { in: uncachedDocIds },
        userId: userId,
        status: { not: 'deleted' }
      },
      // Fetch full documents - select not needed
      // select: {
      //   id: true,
      //   filename: true,
      //   mimeType: true,
      //   extractedText: true,
      //   document_metadata: true,
      //   createdAt: true
      // }
    });

    fetchedDocuments.forEach(doc => {
      documentCache.set(doc.id, doc);
    });
  }

  const documents = [...cachedDocuments, ...fetchedDocuments];

  // Step 3: Build FullDocument objects
  const fullDocuments: FullDocument[] = documents.map(doc => {
    const relevanceData = relevantDocIds.find(r => r.id === doc.id);
    const content = doc.extractedText || '';
    const wordCount = content.split(/\s+/).length;

    return {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      content: content,
      document_metadata: {
        pageCount: (doc.document_metadata as any)?.pageCount,
        wordCount: wordCount,
        uploadDate: doc.createdAt
      },
      relevanceScore: relevanceData?.score || 0
    };
  });

  // Step 4: Sort by relevance
  fullDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Step 5: Apply token limit
  const trimmedDocuments = applyTokenLimit(fullDocuments, maxTotalTokens);

  console.log(`📄 [FULL DOC] Returning ${trimmedDocuments.length} documents (total ~${estimateTotalTokens(trimmedDocuments)} tokens)`);

  return trimmedDocuments;
}

/**
 * Find relevant document IDs using vector search
 */
async function findRelevantDocumentIds(
  userId: string,
  query: string,
  attachedDocumentId: string | undefined,
  maxDocuments: number,
  minRelevanceScore: number
): Promise<Array<{ id: string; score: number }>> {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || ''
  });
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'koda-gemini');

  const embeddingResult = await embeddingService.generateEmbedding(query);
  const queryEmbedding = embeddingResult.embedding;

  let filter: any = { userId };
  if (attachedDocumentId) {
    filter.documentId = attachedDocumentId;
  }

  const searchResults = await index.query({
    vector: queryEmbedding,
    topK: maxDocuments * 5,
    filter,
    includeMetadata: true
  });

  const documentScores = new Map<string, number>();

  for (const match of searchResults.matches || []) {
    const docId = match.document_metadata?.documentId as string;
    const score = match.score || 0;

    if (!docId) continue;

    if (!documentScores.has(docId) || documentScores.get(docId)! < score) {
      documentScores.set(docId, score);
    }
  }

  const relevantDocs = Array.from(documentScores.entries())
    .map(([id, score]) => ({ id, score }))
    .filter(doc => doc.score >= minRelevanceScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDocuments);

  return relevantDocs;
}

/**
 * Apply token limit
 */
function applyTokenLimit(
  documents: FullDocument[],
  maxTotalTokens: number
): FullDocument[] {
  let totalTokens = 0;
  const result: FullDocument[] = [];

  for (const doc of documents) {
    const docTokens = estimateTokens(doc.content);

    if (totalTokens + docTokens <= maxTotalTokens) {
      result.push(doc);
      totalTokens += docTokens;
    } else {
      const remainingTokens = maxTotalTokens - totalTokens;

      if (remainingTokens > 1000) {
        const trimmedContent = trimContent(doc.content, remainingTokens);
        result.push({
          ...doc,
          content: trimmedContent + '\n\n[... document truncated due to length ...]'
        });
        console.log(`📄 [FULL DOC] Trimmed document "${doc.filename}" from ${docTokens} to ${remainingTokens} tokens`);
      }

      break;
    }
  }

  return result;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateTotalTokens(documents: FullDocument[]): number {
  return documents.reduce((sum, doc) => sum + estimateTokens(doc.content), 0);
}

function trimContent(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  return content.substring(0, maxChars);
}

/**
 * Format full documents for context
 */
export function buildDocumentContext(documents: FullDocument[]): string {
  if (documents.length === 0) {
    return 'No documents available.';
  }

  let context = `**Available Documents** (${documents.length} total):\n\n`;

  documents.forEach((doc, index) => {
    context += `**Document ${index + 1}: ${doc.filename}**\n`;
    context += `- Type: ${doc.mimeType}\n`;
    context += `- Relevance: ${(doc.relevanceScore * 100).toFixed(0)}%\n`;
    context += `- Words: ${doc.document_metadata.wordCount.toLocaleString()}\n`;
    if (doc.document_metadata.pageCount) {
      context += `- Pages: ${doc.document_metadata.pageCount}\n`;
    }
    context += `\n**Content**:\n${doc.content}\n\n`;
    context += `${'='.repeat(80)}\n\n`;
  });

  return context;
}

/**
 * Check if query should use full documents
 */
export function shouldUseFullDocuments(
  complexity: 'simple' | 'medium' | 'complex',
  queryType?: string
): boolean {
  if (complexity === 'complex') {
    return true;
  }

  if (complexity === 'medium' && queryType) {
    const analysisTypes = ['comparison', 'synthesis', 'summary', 'analysis'];
    return analysisTypes.some(type => queryType.includes(type));
  }

  return false;
}
