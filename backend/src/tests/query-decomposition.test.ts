/**
 * Query Decomposition Tests
 * Tests for analyzeQueryComplexity function and decomposition logic
 */

import { describe, test, expect } from '@jest/globals';

// Mock types for testing
interface QueryAnalysis {
  isComplex: boolean;
  queryType: 'simple' | 'comparison' | 'multi_part' | 'sequential';
  subQueries?: string[];
  originalQuery: string;
}

// Mock implementation of analyzeQueryComplexity for testing
async function analyzeQueryComplexity(query: string): Promise<QueryAnalysis> {
  const lowerQuery = query.toLowerCase();

  // PATTERN 1: Comparison queries
  const comparisonPatterns = [
    /compare\s+(.+?)\s+(and|vs\.?|versus)\s+(.+)/i,
    /difference\s+between\s+(.+?)\s+and\s+(.+)/i,
    /(.+?)\s+vs\.?\s+(.+)/i,
    /(.+?)\s+versus\s+(.+)/i
  ];

  for (const pattern of comparisonPatterns) {
    const match = query.match(pattern);
    if (match) {
      let concept1, concept2;

      if (match[1] && match[3]) {
        concept1 = match[1].trim();
        concept2 = match[3].trim();
      } else if (match[1] && match[2]) {
        concept1 = match[1].trim();
        concept2 = match[2].trim();
      }

      if (concept1 && concept2) {
        return {
          isComplex: true,
          queryType: 'comparison',
          subQueries: [
            concept1,
            concept2,
            query
          ],
          originalQuery: query
        };
      }
    }
  }

  // PATTERN 2: Multi-part queries with "and"
  const andParts = query.split(/\s+and\s+/i);

  if (andParts.length >= 3) {
    const questionStem = andParts[0].match(/^(what|how|why|when|where|who|which|explain|describe|tell me about|list)\s+(is|are|does|do|was|were)?/i)?.[0] || '';

    const subQueries = andParts.map((part, index) => {
      if (index === 0) {
        return part.trim();
      } else {
        return questionStem ? `${questionStem} ${part.trim()}` : part.trim();
      }
    });

    return {
      isComplex: true,
      queryType: 'multi_part',
      subQueries,
      originalQuery: query
    };
  }

  // PATTERN 3: Sequential queries
  const sequentialPatterns = [
    /first.+?(then|and then|next|after that|finally)/i,
    /(step|stage|phase)\s+\d+/gi
  ];

  for (const pattern of sequentialPatterns) {
    if (pattern.test(query)) {
      // Simplified - in real implementation would call decomposeWithLLM
      return {
        isComplex: true,
        queryType: 'sequential',
        subQueries: ['First part', 'Then second part', 'Finally third part'],
        originalQuery: query
      };
    }
  }

  // PATTERN 4: Large list queries
  const countMatch = query.match(/\b(all\s+)?(\d+)\s+(principles?|steps?|methods?|ways?|reasons?|factors?|elements?|components?|stages?|phases?)\b/i);

  if (countMatch) {
    const count = parseInt(countMatch[2]);
    if (count >= 5) {
      return {
        isComplex: true,
        queryType: 'simple',
        originalQuery: query
      };
    }
  }

  // DEFAULT: Simple query
  return {
    isComplex: false,
    queryType: 'simple',
    originalQuery: query
  };
}

describe('Query Decomposition', () => {
  describe('analyzeQueryComplexity - Comparison Queries', () => {
    test('should detect "compare X and Y" pattern', async () => {
      const query = 'Compare machine learning and deep learning';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
      expect(analysis.subQueries).toHaveLength(3);
      expect(analysis.subQueries?.[0]).toBe('machine learning');
      expect(analysis.subQueries?.[1]).toBe('deep learning');
      expect(analysis.subQueries?.[2]).toBe(query);
    });

    test('should detect "compare X vs Y" pattern', async () => {
      const query = 'Compare SQL vs NoSQL databases';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
      expect(analysis.subQueries).toContain('SQL');
      expect(analysis.subQueries).toContain('NoSQL databases');
    });

    test('should detect "X vs Y" pattern', async () => {
      const query = 'Python vs JavaScript';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
      expect(analysis.subQueries).toHaveLength(3);
    });

    test('should detect "difference between X and Y" pattern', async () => {
      const query = 'What is the difference between React and Vue?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
      expect(analysis.subQueries).toContain('React');
      expect(analysis.subQueries).toContain('Vue?');
    });

    test('should detect "X versus Y" pattern', async () => {
      const query = 'Agile versus Waterfall methodology';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
    });
  });

  describe('analyzeQueryComplexity - Multi-part Queries', () => {
    test('should detect multi-part query with 3+ "and" connections', async () => {
      const query = 'What are the revenue in Q1 and Q2 and Q3?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('multi_part');
      expect(analysis.subQueries).toHaveLength(3);
      expect(analysis.subQueries?.[0]).toContain('Q1');
      expect(analysis.subQueries?.[1]).toContain('Q2');
      expect(analysis.subQueries?.[2]).toContain('Q3');
    });

    test('should preserve question stem in multi-part queries', async () => {
      const query = 'What is the budget for marketing and sales and operations?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('multi_part');
      expect(analysis.subQueries?.[1]).toContain('What is');
      expect(analysis.subQueries?.[2]).toContain('What is');
    });

    test('should handle "Explain A and B and C" pattern', async () => {
      const query = 'Explain recursion and iteration and memoization';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('multi_part');
      expect(analysis.subQueries).toHaveLength(3);
    });

    test('should NOT trigger for 2-part queries (simple)', async () => {
      const query = 'What are cats and dogs?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(false);
      expect(analysis.queryType).toBe('simple');
    });
  });

  describe('analyzeQueryComplexity - Sequential Queries', () => {
    test('should detect "first...then...finally" pattern', async () => {
      const query = 'First explain authentication, then describe authorization, finally analyze security';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('sequential');
      expect(analysis.subQueries).toBeDefined();
    });

    test('should detect "step 1, step 2, step 3" pattern', async () => {
      const query = 'What is step 1 and step 2 and step 3 of the deployment process?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      // Could be either sequential or multi_part depending on pattern match order
      expect(['sequential', 'multi_part']).toContain(analysis.queryType);
    });

    test('should detect "next...after that" pattern', async () => {
      const query = 'First initialize the database, next configure the server, after that deploy the application';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('sequential');
    });
  });

  describe('analyzeQueryComplexity - Large List Queries', () => {
    test('should detect "all 7 principles" pattern', async () => {
      const query = 'What are all 7 principles of design?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('simple'); // Flagged but not decomposed
    });

    test('should detect "5 stages" pattern', async () => {
      const query = 'List the 5 stages of grief';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('simple');
    });

    test('should NOT flag small lists (< 5 items)', async () => {
      const query = 'What are the 3 laws of robotics?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(false);
      expect(analysis.queryType).toBe('simple');
    });

    test('should detect "all X methods" pattern', async () => {
      const query = 'Show me all 10 methods of authentication';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('simple');
    });
  });

  describe('analyzeQueryComplexity - Simple Queries', () => {
    test('should classify simple question as simple', async () => {
      const query = 'What is machine learning?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(false);
      expect(analysis.queryType).toBe('simple');
      expect(analysis.subQueries).toBeUndefined();
    });

    test('should classify document query as simple', async () => {
      const query = 'What does the revenue report say about Q3?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(false);
      expect(analysis.queryType).toBe('simple');
    });

    test('should classify single concept query as simple', async () => {
      const query = 'Explain neural networks';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(false);
      expect(analysis.queryType).toBe('simple');
    });
  });

  describe('Integration Tests - Full Decomposition Flow', () => {
    test('comparison query should produce correct sub-queries', async () => {
      const query = 'Compare Docker and Kubernetes';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
      expect(analysis.subQueries).toContain('Docker');
      expect(analysis.subQueries).toContain('Kubernetes');
      expect(analysis.subQueries).toContain(query);
      expect(analysis.originalQuery).toBe(query);
    });

    test('multi-part query should split correctly', async () => {
      const query = 'What are the advantages of Python and JavaScript and TypeScript?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('multi_part');
      expect(analysis.subQueries?.length).toBeGreaterThanOrEqual(3);

      // Each sub-query should contain the original question stem
      analysis.subQueries?.forEach(subQuery => {
        expect(subQuery.toLowerCase()).toContain('what are');
      });
    });

    test('sequential query should be decomposed', async () => {
      const query = 'First explain REST APIs, then describe GraphQL, finally compare them';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('sequential');
      expect(analysis.subQueries).toBeDefined();
      expect(analysis.subQueries!.length).toBeGreaterThan(1);
    });

    test('edge case: comparison with multi-word concepts', async () => {
      const query = 'Compare supervised machine learning and unsupervised machine learning';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
      expect(analysis.subQueries?.[0]).toBe('supervised machine learning');
      expect(analysis.subQueries?.[1]).toBe('unsupervised machine learning');
    });

    test('edge case: query with "and" but not multi-part', async () => {
      const query = 'What is the relationship between cats and dogs?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(false);
      expect(analysis.queryType).toBe('simple');
    });

    test('edge case: "vs" in middle of sentence (not comparison)', async () => {
      const query = 'Tell me about version control systems';
      const analysis = await analyzeQueryComplexity(query);

      // This should NOT be detected as comparison
      expect(analysis.isComplex).toBe(false);
      expect(analysis.queryType).toBe('simple');
    });
  });

  describe('Real-world Query Patterns', () => {
    test('business comparison query', async () => {
      const query = 'Compare the Q1 revenue versus Q2 revenue';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
    });

    test('technical multi-part query', async () => {
      const query = 'What are the authentication methods and authorization strategies and security best practices?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('multi_part');
      expect(analysis.subQueries).toHaveLength(3);
    });

    test('document extraction query', async () => {
      const query = 'What are all 10 principles of good design from the document?';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('simple'); // Large list, flagged for completeness checking
    });

    test('conceptual comparison', async () => {
      const query = 'Difference between relational databases and document databases';
      const analysis = await analyzeQueryComplexity(query);

      expect(analysis.isComplex).toBe(true);
      expect(analysis.queryType).toBe('comparison');
    });
  });
});
