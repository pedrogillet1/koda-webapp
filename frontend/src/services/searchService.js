/**
 * Search Service
 * Client-side API for semantic search functionality
 */

import api from './api';

/**
 * Perform semantic search across documents
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return (default: 10)
 * @param {number} minScore - Minimum relevance score (default: 0.5)
 * @returns {Promise<Object>} - Search results with metadata
 */
export const semanticSearch = async (query, topK = 10, minScore = 0.3) => {
  try {
    const response = await api.post('/api/search/semantic', {
      query,
      topK,
      minScore
    });

    return response.data;
  } catch (error) {
    console.error('[SEARCH] Semantic search failed:', error);
    throw error;
  }
};

export default {
  semanticSearch
};
