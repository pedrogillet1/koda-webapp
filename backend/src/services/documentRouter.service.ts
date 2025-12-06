/**
 * Document Router Service
 *
 * Routes queries to the most relevant documents before chunk-level retrieval.
 * Implements 3-method routing: explicit selection, name detection, and semantic matching.
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Document routing result
 */
export interface DocumentRoutingResult {
  documentId: string;
  documentTitle: string;
  routingMethod: 'explicit' | 'name_match' | 'semantic' | 'none';
  confidence: number;
  matchDetails?: {
    matchedTerms?: string[];
    similarityScore?: number;
    reasoning?: string;
  };
}

/**
 * Document summary for routing
 */
export interface DocumentSummary {
  id: string;
  filename: string;
  mimeType: string;
  classification?: string;
  domain?: string;
  summary?: string;
  keywords?: string[];
  wordCount?: number;
  createdAt: Date;
}

/**
 * Route query to the most relevant document
 *
 * Uses 3 routing methods in order:
 * 1. Explicit document ID (if provided)
 * 2. Document name detection in query
 * 3. Semantic document-level routing
 */
export async function routeToDocument(
  userId: string,
  query: string,
  options: {
    explicitDocumentId?: string;
    documentIds?: string[];
    confidenceThreshold?: number;
  } = {}
): Promise<DocumentRoutingResult | null> {
  const { explicitDocumentId, documentIds, confidenceThreshold = 0.6 } = options;

  console.log(`[DocumentRouter] Routing query: "${query.slice(0, 100)}..."`);

  // Method 1: Explicit document selection
  if (explicitDocumentId) {
    const doc = await prisma.document.findFirst({
      where: { id: explicitDocumentId, userId },
      select: { id: true, filename: true }
    });

    if (doc) {
      console.log(`[DocumentRouter] Method 1: Explicit selection -> ${doc.filename}`);
      return {
        documentId: doc.id,
        documentTitle: doc.filename,
        routingMethod: 'explicit',
        confidence: 1.0
      };
    }
  }

  // Get user's documents
  const documents = await getUserDocuments(userId, documentIds);

  if (documents.length === 0) {
    console.log('[DocumentRouter] No documents found for user');
    return null;
  }

  // Method 2: Document name detection in query
  const nameMatch = await detectDocumentNameInQuery(query, documents);
  if (nameMatch && nameMatch.confidence >= confidenceThreshold) {
    console.log(`[DocumentRouter] Method 2: Name match -> ${nameMatch.documentTitle} (${nameMatch.confidence.toFixed(2)})`);
    return nameMatch;
  }

  // Method 3: Semantic document routing
  const semanticMatch = await semanticDocumentRouting(query, documents);
  if (semanticMatch && semanticMatch.confidence >= confidenceThreshold) {
    console.log(`[DocumentRouter] Method 3: Semantic match -> ${semanticMatch.documentTitle} (${semanticMatch.confidence.toFixed(2)})`);
    return semanticMatch;
  }

  console.log('[DocumentRouter] No document matched with sufficient confidence');
  return null;
}

/**
 * Get user's documents with metadata
 */
async function getUserDocuments(
  userId: string,
  documentIds?: string[]
): Promise<DocumentSummary[]> {
  const where: Record<string, unknown> = {
    userId,
    status: 'ready'
  };

  if (documentIds && documentIds.length > 0) {
    where.id = { in: documentIds };
  }

  const documents = await prisma.document.findMany({
    where,
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
      metadata: {
        select: {
          classification: true,
          domain: true,
          summary: true,
          topics: true,
          wordCount: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100 // Limit to most recent 100 documents
  });

  return documents.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    classification: doc.metadata?.classification || undefined,
    domain: doc.metadata?.domain || undefined,
    summary: doc.metadata?.summary || undefined,
    keywords: doc.metadata?.topics ? JSON.parse(doc.metadata.topics) : undefined,
    wordCount: doc.metadata?.wordCount || undefined,
    createdAt: doc.createdAt
  }));
}

/**
 * Detect document name mentioned in query
 */
async function detectDocumentNameInQuery(
  query: string,
  documents: DocumentSummary[]
): Promise<DocumentRoutingResult | null> {
  const lowerQuery = query.toLowerCase();

  // Extract potential document references
  const documentReferences = extractDocumentReferences(query);

  for (const doc of documents) {
    const docNameLower = doc.filename.toLowerCase();
    const docNameWithoutExt = docNameLower.replace(/\.[^/.]+$/, '');

    // Check for exact title match
    if (lowerQuery.includes(docNameWithoutExt) && docNameWithoutExt.length > 3) {
      return {
        documentId: doc.id,
        documentTitle: doc.filename,
        routingMethod: 'name_match',
        confidence: 0.95,
        matchDetails: {
          matchedTerms: [doc.filename],
          reasoning: 'Exact document name found in query'
        }
      };
    }

    // Check for partial match (50%+ words)
    const docWords = docNameWithoutExt.split(/[-_\s]+/).filter(w => w.length > 2);
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);

    const matchedWords = docWords.filter(dw =>
      queryWords.some(qw => qw.includes(dw) || dw.includes(qw))
    );

    if (matchedWords.length > 0 && matchedWords.length / docWords.length >= 0.5) {
      const confidence = Math.min(0.9, 0.5 + (matchedWords.length / docWords.length) * 0.4);
      return {
        documentId: doc.id,
        documentTitle: doc.filename,
        routingMethod: 'name_match',
        confidence,
        matchDetails: {
          matchedTerms: matchedWords,
          reasoning: `Partial name match (${matchedWords.length}/${docWords.length} words)`
        }
      };
    }
  }

  // Check for document references with specific patterns
  for (const ref of documentReferences) {
    for (const doc of documents) {
      const docNameLower = doc.filename.toLowerCase();
      if (docNameLower.includes(ref.toLowerCase()) || ref.toLowerCase().includes(docNameLower.replace(/\.[^/.]+$/, ''))) {
        return {
          documentId: doc.id,
          documentTitle: doc.filename,
          routingMethod: 'name_match',
          confidence: 0.8,
          matchDetails: {
            matchedTerms: [ref],
            reasoning: 'Document reference pattern detected'
          }
        };
      }
    }
  }

  return null;
}

/**
 * Extract document references from query
 */
function extractDocumentReferences(query: string): string[] {
  const references: string[] = [];

  // Pattern: "in/from/about the [document name]"
  const patterns = [
    /(?:in|from|about|regarding)\s+(?:the\s+)?["']?([^"',.?!]+?)["']?\s*(?:document|file|report|contract|agreement)?/gi,
    /(?:the\s+)?["']([^"']+)["']/g,
    /document\s+(?:called|named|titled)\s+["']?([^"',.?!]+?)["']?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      if (match[1] && match[1].length > 2) {
        references.push(match[1].trim());
      }
    }
  }

  return references;
}

/**
 * Semantic document-level routing using embeddings
 */
async function semanticDocumentRouting(
  query: string,
  documents: DocumentSummary[]
): Promise<DocumentRoutingResult | null> {
  try {
    // Create document summaries for comparison
    const docSummaries = documents.map(doc => {
      const parts = [
        `Title: ${doc.filename}`,
        doc.classification ? `Type: ${doc.classification}` : '',
        doc.domain ? `Domain: ${doc.domain}` : '',
        doc.summary ? `Summary: ${doc.summary}` : '',
        doc.keywords?.length ? `Keywords: ${doc.keywords.join(', ')}` : ''
      ].filter(Boolean);

      return {
        id: doc.id,
        filename: doc.filename,
        summaryText: parts.join('\n')
      };
    });

    // Use LLM to find the best matching document
    const prompt = `Given this user query, identify which document is most relevant.

USER QUERY:
${query}

AVAILABLE DOCUMENTS:
${docSummaries.map((doc, i) => `
[${i + 1}] ${doc.summaryText}
`).join('\n')}

Respond with a JSON object:
{
  "bestMatchIndex": <1-based index of best matching document, or 0 if none match well>,
  "confidence": <0.0-1.0 confidence score>,
  "reasoning": "<brief explanation>"
}

IMPORTANT:
- Only match if the query is clearly about a specific document
- Return 0 for bestMatchIndex if the query is general and doesn't target a specific document
- Consider document type, domain, and content when matching`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.bestMatchIndex > 0 && parsed.bestMatchIndex <= docSummaries.length) {
      const matchedDoc = docSummaries[parsed.bestMatchIndex - 1];
      return {
        documentId: matchedDoc.id,
        documentTitle: matchedDoc.filename,
        routingMethod: 'semantic',
        confidence: parsed.confidence || 0.7,
        matchDetails: {
          reasoning: parsed.reasoning
        }
      };
    }

    return null;
  } catch (error) {
    console.error('[DocumentRouter] Semantic routing failed:', error);
    return null;
  }
}

/**
 * Route to multiple documents (for queries spanning multiple docs)
 */
export async function routeToMultipleDocuments(
  userId: string,
  query: string,
  options: {
    maxDocuments?: number;
    confidenceThreshold?: number;
  } = {}
): Promise<DocumentRoutingResult[]> {
  const { maxDocuments = 3, confidenceThreshold = 0.5 } = options;

  const documents = await getUserDocuments(userId);

  if (documents.length === 0) {
    return [];
  }

  try {
    // Create document summaries
    const docSummaries = documents.slice(0, 20).map(doc => ({
      id: doc.id,
      filename: doc.filename,
      summary: `${doc.filename} (${doc.classification || 'unknown type'}, ${doc.domain || 'general domain'}): ${doc.summary || 'No summary available'}`
    }));

    const prompt = `Given this user query, identify which documents are relevant. The query may span multiple documents.

USER QUERY:
${query}

AVAILABLE DOCUMENTS:
${docSummaries.map((doc, i) => `[${i + 1}] ${doc.summary}`).join('\n')}

Respond with a JSON array of relevant documents:
[
  {"index": 1, "confidence": 0.9, "reasoning": "why this document is relevant"},
  {"index": 3, "confidence": 0.7, "reasoning": "why this document is relevant"}
]

IMPORTANT:
- Only include documents that are clearly relevant to the query
- Order by relevance (most relevant first)
- Maximum ${maxDocuments} documents
- Return empty array [] if no documents are relevant`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const results: DocumentRoutingResult[] = [];
    for (const match of parsed) {
      if (match.index > 0 && match.index <= docSummaries.length && match.confidence >= confidenceThreshold) {
        const doc = docSummaries[match.index - 1];
        results.push({
          documentId: doc.id,
          documentTitle: doc.filename,
          routingMethod: 'semantic',
          confidence: match.confidence,
          matchDetails: {
            reasoning: match.reasoning
          }
        });
      }
    }

    return results.slice(0, maxDocuments);
  } catch (error) {
    console.error('[DocumentRouter] Multi-document routing failed:', error);
    return [];
  }
}

/**
 * Get document routing statistics
 */
export async function getRoutingStats(userId: string): Promise<{
  totalDocuments: number;
  documentsByDomain: Record<string, number>;
  documentsByType: Record<string, number>;
}> {
  const documents = await getUserDocuments(userId);

  const stats = {
    totalDocuments: documents.length,
    documentsByDomain: {} as Record<string, number>,
    documentsByType: {} as Record<string, number>
  };

  for (const doc of documents) {
    const domain = doc.domain || 'general';
    const type = doc.classification || 'unknown';

    stats.documentsByDomain[domain] = (stats.documentsByDomain[domain] || 0) + 1;
    stats.documentsByType[type] = (stats.documentsByType[type] || 0) + 1;
  }

  return stats;
}

export default {
  routeToDocument,
  routeToMultipleDocuments,
  getRoutingStats
};
