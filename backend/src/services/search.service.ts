import { Pinecone } from '@pinecone-database/pinecone';
import prisma from '../config/database';
import embeddingService from './embedding.service';
import { config } from '../config/env';

let pinecone: Pinecone | null = null;
let pineconeIndex: any = null;

/**
 * Initialize Pinecone connection
 */
async function initializePinecone() {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: config.PINECONE_API_KEY,
    });
    pineconeIndex = pinecone.Index(config.PINECONE_INDEX_NAME);
    console.log('✅ [SEARCH] Pinecone initialized');
  }
}

interface SemanticSearchParams {
  query: string;
  userId: string;
  topK?: number;
  minScore?: number;
}

interface SearchResult {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  folderId: string | null;
  createdAt: Date;
  score: number;
  matchedContent: string;
  isEncrypted: boolean;
  encryptionMetadata?: {
    salt: string | null;
    iv: string | null;
    authTag: string | null;
    filenameEncrypted: string | null;
  };
}

/**
 * Semantic search: Find documents by content using vector embeddings
 */
export async function semanticSearch(params: SemanticSearchParams): Promise<SearchResult[]> {
  const { query, userId, topK = 10, minScore = 0.3 } = params;

  console.log(`🔍 [SEMANTIC SEARCH] Query: "${query}", TopK: ${topK}, MinScore: ${minScore}`);

  // Initialize Pinecone
  await initializePinecone();

  if (!pineconeIndex) {
    throw new Error('Pinecone index not initialized');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Generate embedding for search query
  // ═══════════════════════════════════════════════════════════════════════════

  const embeddingResult = await embeddingService.generateEmbedding(query);
  const queryEmbedding = embeddingResult.embedding;

  console.log(`✅ [SEMANTIC SEARCH] Generated embedding for query`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Query Pinecone for similar chunks
  // ═══════════════════════════════════════════════════════════════════════════

  const results = await pineconeIndex.query({
    vector: queryEmbedding,
    topK: topK * 3, // Get more chunks, then group by document
    filter: { userId }, // Only search user's documents
    includeMetadata: true,
  });

  const matches = results.matches || [];
  console.log(`📊 [SEMANTIC SEARCH] Found ${matches.length} matching chunks`);

  // Log top 5 scores for debugging
  if (matches.length > 0) {
    const topScores = matches.slice(0, 5).map((m: any) => m.score?.toFixed(3) || '0');
    console.log(`📊 [SEMANTIC SEARCH] Top 5 scores: [${topScores.join(', ')}]`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Filter by relevance score
  // ═══════════════════════════════════════════════════════════════════════════

  const relevantMatches = matches.filter((m: any) => m.score && m.score >= minScore);
  console.log(`✅ [SEMANTIC SEARCH] ${relevantMatches.length} chunks above threshold (${minScore})`);

  if (relevantMatches.length === 0) {
    console.log(`⚠️  [SEMANTIC SEARCH] No relevant results found`);
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Group chunks by document and calculate document-level scores
  // ═══════════════════════════════════════════════════════════════════════════

  const documentScores = new Map<string, { score: number; content: string }>();

  for (const match of relevantMatches) {
    const docId = match.document_metadata?.documentId;
    if (!docId) continue;

    const score = match.score || 0;
    const content = match.document_metadata?.content || match.document_metadata?.text || '';

    const existing = documentScores.get(docId);
    if (!existing || score > existing.score) {
      // Keep the highest-scoring chunk for each document
      documentScores.set(docId, { score, content });
    }
  }

  console.log(`📄 [SEMANTIC SEARCH] Grouped into ${documentScores.size} unique documents`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Fetch document metadata from database
  // ═══════════════════════════════════════════════════════════════════════════

  const documentIds = Array.from(documentScores.keys());

  const documents = await prisma.documents.findMany({
    where: {
      id: { in: documentIds },
      userId: userId,
      status: 'completed', // Only completed documents
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      fileSize: true,
      folderId: true,
      createdAt: true,
      isEncrypted: true,
      encryptionSalt: true,
      encryptionIV: true,
      encryptionAuthTag: true,
      filenameEncrypted: true,
    },
  });

  console.log(`✅ [SEMANTIC SEARCH] Fetched ${documents.length} documents from database`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Build search results
  // ═══════════════════════════════════════════════════════════════════════════

  const searchResults: SearchResult[] = documents.map((doc) => {
    const { score, content } = documentScores.get(doc.id) || { score: 0, content: '' };

    // Truncate matched content to 200 characters
    const matchedContent = content.length > 200
      ? content.substring(0, 200) + '...'
      : content;

    return {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      folderId: doc.folderId,
      createdAt: doc.createdAt,
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      matchedContent,
      isEncrypted: doc.isEncrypted,
      encryptionMetadata: doc.isEncrypted ? {
        salt: doc.encryptionSalt,
        iv: doc.encryptionIV,
        authTag: doc.encryptionAuthTag,
        filenameEncrypted: doc.filenameEncrypted,
      } : undefined,
    };
  });

  // Sort by score (highest first)
  searchResults.sort((a, b) => b.score - a.score);

  // Limit to topK documents
  const finalResults = searchResults.slice(0, topK);

  console.log(`✅ [SEMANTIC SEARCH] Returning ${finalResults.length} documents`);

  return finalResults;
}

export default {
  semanticSearch
};
