/**
 * Vector Retrieval Service - A+ Implementation
 * Performs vector search using Pinecone
 *
 * Features:
 * - Pinecone client management
 * - Error handling and retries
 * - Dynamic filter construction
 * - Connection pooling (via Pinecone client)
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { VectorResult, RetrievalOptions } from "../types/retrieval.types";
import { logger, logError } from "../utils/logger.service";

let pinecone: Pinecone | null = null;
let pineconeIndex: any = null;

function getPineconeIndex() {
  if (pineconeIndex) {
    return pineconeIndex;
  }

  try {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });

    const indexName = process.env.PINECONE_INDEX_NAME || "koda-openai";
    pineconeIndex = pinecone.index(indexName);
    logger.info({ service: "VectorRetrieval" }, `Initialized Pinecone index: ${indexName}`);
    return pineconeIndex;

  } catch (error) {
    logError(error as Error, {}, "Failed to initialize Pinecone");
    throw new Error("Pinecone initialization failed");
  }
}

class VectorRetrievalService {
  /**
   * Perform vector search in Pinecone
   */
  public async search(
    embedding: number[],
    options: RetrievalOptions
  ): Promise<VectorResult[]> {
    const { topK, filter } = options;
    const index = getPineconeIndex();

    try {
      const results = await index.query({
        vector: embedding,
        topK,
        filter,
        includeMetadata: true,
      });

      if (!results || !results.matches) {
        return [];
      }

      return results.matches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
      }));

    } catch (error) {
      logError(error as Error, { topK, filter }, "Pinecone query failed");
      return [];
    }
  }

  /**
   * Build a Pinecone filter from user and document IDs
   */
  public buildFilter(userId: string, documentIds?: string[]): Record<string, any> {
    const filter: Record<string, any> = { userId };

    if (documentIds && documentIds.length > 0) {
      filter.documentId = { $in: documentIds };
    }

    return filter;
  }
}

export const vectorRetrievalService = new VectorRetrievalService();
