import { Request, Response } from 'express';
import searchService from '../services/search.service';

/**
 * Semantic search endpoint
 * Searches document content using vector embeddings
 */
export const semanticSearch = async (req: Request, res: Response) => {
  try {
    const { query, topK = 10, minScore = 0.3 } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    console.log(`🔍 [SEARCH] User ${userId.substring(0, 8)}... searching for: "${query}"`);

    const startTime = Date.now();
    const results = await searchService.semanticSearch({
      query,
      userId,
      topK,
      minScore
    });
    const duration = Date.now() - startTime;

    console.log(`✅ [SEARCH] Found ${results.length} documents in ${duration}ms`);

    res.json({
      results,
      meta: {
        query,
        count: results.length,
        duration
      }
    });
  } catch (error: any) {
    console.error('❌ [SEARCH] Error:', error);
    res.status(500).json({ error: error.message || 'Search failed' });
  }
};

export default {
  semanticSearch
};
