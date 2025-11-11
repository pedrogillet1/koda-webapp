/**
 * Observation Layer Tests
 * Tests for observeRetrievalResults and refineQuery functions
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// Mock types for testing
interface ObservationResult {
  needsRefinement: boolean;
  reason?: 'no_results' | 'low_relevance' | 'incomplete' | 'insufficient_coverage';
  details?: {
    expected?: number;
    found?: number;
    avgScore?: number;
    suggestion?: string;
  };
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata?: {
    content?: string;
    userId?: string;
    documentId?: string;
  };
}

interface PineconeResults {
  matches: PineconeMatch[];
}

// Import functions to test (in production, these would be exported from rag.service.ts)
// For now, we'll define mock versions for testing the logic
function observeRetrievalResults(
  results: PineconeResults,
  query: string,
  minRelevanceScore: number = 0.7
): ObservationResult {
  // CHECK 1: No results found
  if (!results.matches || results.matches.length === 0) {
    return {
      needsRefinement: true,
      reason: 'no_results',
      details: {
        suggestion: 'Try broader search terms or check if documents are uploaded'
      }
    };
  }

  // CHECK 2: Low relevance scores
  const avgScore = results.matches.reduce((sum: number, m: any) => sum + (m.score || 0), 0) / results.matches.length;
  const topScore = results.matches[0]?.score || 0;

  if (topScore < minRelevanceScore) {
    return {
      needsRefinement: true,
      reason: 'low_relevance',
      details: {
        avgScore,
        suggestion: 'Try different keywords or broader search'
      }
    };
  }

  // CHECK 3: Incomplete results (user asks for specific count)
  const countMatch = query.match(/\b(all\s+)?(\d+)\s+(principles?|steps?|methods?|ways?|reasons?|factors?|elements?|components?|stages?|phases?|points?)\b/i);

  if (countMatch) {
    const expectedCount = parseInt(countMatch[2]);
    const content = results.matches.map((m: any) => m.metadata?.content || '').join(' ');
    const numberedItems = content.match(/\b\d+\.\s/g)?.length || 0;
    const bulletItems = content.match(/[•\-\*]\s/g)?.length || 0;
    const foundCount = Math.max(numberedItems, bulletItems, results.matches.length);

    if (foundCount < expectedCount) {
      return {
        needsRefinement: true,
        reason: 'incomplete',
        details: {
          expected: expectedCount,
          found: foundCount,
          suggestion: `Search for "complete list" or "all ${expectedCount}"`
        }
      };
    }
  }

  // CHECK 4: Insufficient coverage for multi-part queries
  const hasAnd = /\band\b/i.test(query);
  const hasOr = /\bor\b/i.test(query);
  const hasVs = /\bvs\.?\b|\bversus\b/i.test(query);

  if ((hasAnd || hasOr || hasVs) && results.matches.length < 5) {
    return {
      needsRefinement: false, // Let it proceed, but log the concern
      reason: 'insufficient_coverage',
      details: {
        found: results.matches.length,
        suggestion: 'Consider breaking query into sub-queries'
      }
    };
  }

  return {
    needsRefinement: false
  };
}

function refineQuery(originalQuery: string, observation: ObservationResult): string {
  if (!observation.needsRefinement) {
    return originalQuery;
  }

  switch (observation.reason) {
    case 'no_results': {
      // Extract key concepts, remove filler words
      const commonWords = ['what', 'how', 'why', 'when', 'where', 'does', 'affect', 'impact', 'influence', 'relate', 'apply'];
      const words = originalQuery.toLowerCase().split(/\s+/);
      const keyWords = words.filter(w =>
        w.length > 4 &&
        !commonWords.includes(w) &&
        !/^(the|and|for|with|from|about)$/.test(w)
      );
      const refinedQuery = keyWords.slice(0, 3).join(' ');
      return refinedQuery;
    }

    case 'low_relevance': {
      // Remove question words, focus on core concepts
      const withoutQuestionWords = originalQuery
        .replace(/^(what|how|why|when|where|who|which)\s+(is|are|does|do|can|could|would|should)\s+/i, '')
        .replace(/^(tell me about|explain|describe|list|show me)\s+/i, '');
      return withoutQuestionWords;
    }

    case 'incomplete': {
      // Add "complete list" to find comprehensive sources
      const expected = observation.details?.expected;
      const coreQuery = originalQuery.replace(/^(what|how|list|tell me|explain)\s+(are|is|about)?\s*/i, '');
      const refinedQuery = expected
        ? `${coreQuery} complete list all ${expected}`
        : `${coreQuery} complete list`;
      return refinedQuery;
    }

    case 'insufficient_coverage': {
      // Keep original for Phase 2 decomposition
      return originalQuery;
    }

    default:
      return originalQuery;
  }
}

describe('Observation Layer', () => {
  describe('observeRetrievalResults', () => {
    test('should detect no results', () => {
      const results: PineconeResults = { matches: [] };
      const query = 'What are the principles of design?';

      const observation = observeRetrievalResults(results, query);

      expect(observation.needsRefinement).toBe(true);
      expect(observation.reason).toBe('no_results');
      expect(observation.details?.suggestion).toContain('broader search');
    });

    test('should detect low relevance scores', () => {
      const results: PineconeResults = {
        matches: [
          { id: '1', score: 0.65, metadata: { content: 'Some content' } },
          { id: '2', score: 0.60, metadata: { content: 'More content' } }
        ]
      };
      const query = 'What are the principles of design?';

      const observation = observeRetrievalResults(results, query);

      expect(observation.needsRefinement).toBe(true);
      expect(observation.reason).toBe('low_relevance');
      expect(observation.details?.avgScore).toBeLessThan(0.7);
    });

    test('should detect incomplete results - missing numbered items', () => {
      const results: PineconeResults = {
        matches: [
          {
            id: '1',
            score: 0.85,
            metadata: {
              content: '1. First principle 2. Second principle'
            }
          }
        ]
      };
      const query = 'What are all 5 principles of design?';

      const observation = observeRetrievalResults(results, query);

      expect(observation.needsRefinement).toBe(true);
      expect(observation.reason).toBe('incomplete');
      expect(observation.details?.expected).toBe(5);
      expect(observation.details?.found).toBeLessThan(5);
    });

    test('should pass when sufficient results found', () => {
      const results: PineconeResults = {
        matches: [
          {
            id: '1',
            score: 0.92,
            metadata: {
              content: '1. First 2. Second 3. Third 4. Fourth 5. Fifth'
            }
          },
          { id: '2', score: 0.88, metadata: { content: 'Additional context' } }
        ]
      };
      const query = 'What are all 5 principles of design?';

      const observation = observeRetrievalResults(results, query);

      expect(observation.needsRefinement).toBe(false);
    });

    test('should detect insufficient coverage for multi-part queries', () => {
      const results: PineconeResults = {
        matches: [
          { id: '1', score: 0.85, metadata: { content: 'Content about X' } },
          { id: '2', score: 0.82, metadata: { content: 'More about X' } }
        ]
      };
      const query = 'Compare X and Y';

      const observation = observeRetrievalResults(results, query);

      expect(observation.needsRefinement).toBe(false); // Doesn't force refinement
      expect(observation.reason).toBe('insufficient_coverage');
      expect(observation.details?.found).toBe(2);
    });

    test('should pass with high relevance and sufficient results', () => {
      const results: PineconeResults = {
        matches: [
          { id: '1', score: 0.95, metadata: { content: 'Highly relevant content' } },
          { id: '2', score: 0.92, metadata: { content: 'Also relevant' } },
          { id: '3', score: 0.89, metadata: { content: 'More relevant content' } }
        ]
      };
      const query = 'What is machine learning?';

      const observation = observeRetrievalResults(results, query);

      expect(observation.needsRefinement).toBe(false);
      expect(observation.reason).toBeUndefined();
    });
  });

  describe('refineQuery', () => {
    test('should broaden query when no results found', () => {
      const originalQuery = 'How does quantum entanglement affect particle behavior?';
      const observation: ObservationResult = {
        needsRefinement: true,
        reason: 'no_results'
      };

      const refined = refineQuery(originalQuery, observation);

      expect(refined).not.toBe(originalQuery);
      expect(refined.length).toBeLessThan(originalQuery.length);
      expect(refined).toContain('quantum');
      expect(refined).toContain('entanglement');
      expect(refined).not.toContain('does');
      expect(refined).not.toContain('affect');
    });

    test('should simplify query when low relevance', () => {
      const originalQuery = 'What are the main principles of design?';
      const observation: ObservationResult = {
        needsRefinement: true,
        reason: 'low_relevance',
        details: { avgScore: 0.65 }
      };

      const refined = refineQuery(originalQuery, observation);

      expect(refined).not.toContain('What');
      expect(refined).not.toContain('are');
      expect(refined).toContain('principles');
      expect(refined).toContain('design');
    });

    test('should add "complete list" when results are incomplete', () => {
      const originalQuery = 'List all 7 principles of design';
      const observation: ObservationResult = {
        needsRefinement: true,
        reason: 'incomplete',
        details: { expected: 7, found: 3 }
      };

      const refined = refineQuery(originalQuery, observation);

      expect(refined).toContain('complete list');
      expect(refined).toContain('all 7');
      expect(refined).toContain('principles of design');
    });

    test('should keep original query for insufficient coverage', () => {
      const originalQuery = 'Compare X and Y';
      const observation: ObservationResult = {
        needsRefinement: true,
        reason: 'insufficient_coverage',
        details: { found: 2 }
      };

      const refined = refineQuery(originalQuery, observation);

      expect(refined).toBe(originalQuery);
    });

    test('should not modify query when no refinement needed', () => {
      const originalQuery = 'What is machine learning?';
      const observation: ObservationResult = {
        needsRefinement: false
      };

      const refined = refineQuery(originalQuery, observation);

      expect(refined).toBe(originalQuery);
    });
  });

  describe('Integration Tests', () => {
    test('should handle refinement flow: no results -> broader query', () => {
      // Step 1: Initial query returns no results
      const initialResults: PineconeResults = { matches: [] };
      const initialQuery = 'How does climate change affect biodiversity?';

      const observation = observeRetrievalResults(initialResults, initialQuery);
      expect(observation.needsRefinement).toBe(true);

      // Step 2: Refine query
      const refinedQuery = refineQuery(initialQuery, observation);
      expect(refinedQuery).not.toBe(initialQuery);
      expect(refinedQuery.split(' ').length).toBeLessThan(initialQuery.split(' ').length);
    });

    test('should handle refinement flow: low relevance -> simplified query', () => {
      // Step 1: Initial query returns low relevance
      const initialResults: PineconeResults = {
        matches: [
          { id: '1', score: 0.60, metadata: { content: 'Vaguely related content' } }
        ]
      };
      const initialQuery = 'What are the key factors in machine learning?';

      const observation = observeRetrievalResults(initialResults, initialQuery);
      expect(observation.needsRefinement).toBe(true);
      expect(observation.reason).toBe('low_relevance');

      // Step 2: Refine query
      const refinedQuery = refineQuery(initialQuery, observation);
      expect(refinedQuery).toContain('factors');
      expect(refinedQuery).toContain('machine learning');
      expect(refinedQuery).not.toContain('What');
    });

    test('should handle refinement flow: incomplete -> add "complete list"', () => {
      // Step 1: Initial query finds incomplete results
      const initialResults: PineconeResults = {
        matches: [
          {
            id: '1',
            score: 0.85,
            metadata: {
              content: '1. First principle 2. Second principle'
            }
          }
        ]
      };
      const initialQuery = 'What are all 5 principles of design?';

      const observation = observeRetrievalResults(initialResults, initialQuery);
      expect(observation.needsRefinement).toBe(true);
      expect(observation.reason).toBe('incomplete');

      // Step 2: Refine query
      const refinedQuery = refineQuery(initialQuery, observation);
      expect(refinedQuery).toContain('complete list');
      expect(refinedQuery).toContain('all 5');
    });

    test('should pass through when results are sufficient', () => {
      // High quality results that need no refinement
      const results: PineconeResults = {
        matches: [
          { id: '1', score: 0.95, metadata: { content: 'Perfect match' } },
          { id: '2', score: 0.93, metadata: { content: 'Also great' } },
          { id: '3', score: 0.91, metadata: { content: 'Very relevant' } }
        ]
      };
      const query = 'What is artificial intelligence?';

      const observation = observeRetrievalResults(results, query);
      expect(observation.needsRefinement).toBe(false);

      const refinedQuery = refineQuery(query, observation);
      expect(refinedQuery).toBe(query);
    });
  });
});
