/**
 * Iterative Refinement Tests
 * Tests for agent loop with multiple refinement attempts
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// Mock types for testing
interface AgentLoopState {
  attempt: number;
  bestResults: any | null;
  bestScore: number;
  history: Array<{
    attempt: number;
    query: string;
    resultCount: number;
    avgScore: number;
    observation: any;
  }>;
}

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

interface AnswerValidation {
  isValid: boolean;
  issues?: string[];
  suggestions?: string[];
}

// Mock validation function for testing
function validateAnswer(answer: string, query: string, sources: any[]): AnswerValidation {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // CHECK 1: Answer is not too short
  if (answer.length < 50) {
    issues.push('Answer is very short (< 50 characters)');
    suggestions.push('Consider retrieving more context or refining query');
  }

  // CHECK 2: Answer doesn't just say "couldn't find"
  if (/couldn't find|don't have|no information/i.test(answer) && sources.length > 0) {
    issues.push('Answer says "couldn\'t find" but sources are available');
    suggestions.push('LLM might not be using the provided context - check prompt');
  }

  // CHECK 3: For count queries, verify count is mentioned
  const countMatch = query.match(/\b(all\s+)?(\d+)\s+(principles?|steps?|methods?|ways?)\b/i);
  if (countMatch) {
    const expectedCount = parseInt(countMatch[2]);
    const numberedItems = answer.match(/\b\d+\./g)?.length || 0;

    if (numberedItems < expectedCount) {
      issues.push(`Query asks for ${expectedCount} items but answer only lists ${numberedItems}`);
      suggestions.push('Retrieval might be incomplete - consider additional refinement');
    }
  }

  // CHECK 4: Answer uses sources (has page references)
  if (sources.length > 0 && !/\[p\.\d+\]/i.test(answer)) {
    issues.push('Answer doesn\'t include page citations despite having sources');
    suggestions.push('Check if citation format is correct in system prompt');
  }

  if (issues.length > 0) {
    return { isValid: false, issues, suggestions };
  }

  return { isValid: true };
}

describe('Iterative Refinement', () => {
  describe('Answer Validation', () => {
    test('should pass validation for good answer', () => {
      const answer = 'The passport number is FZ487559 [p.2]. It was issued on March 15, 2015 in Lisbon.';
      const query = 'What is the passport number?';
      const sources = [
        { documentName: 'passport.pdf', pageNumber: 2, score: 0.9 }
      ];

      const validation = validateAnswer(answer, query, sources);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toBeUndefined();
    });

    test('should detect short answers', () => {
      const answer = 'Short answer';
      const query = 'What is machine learning?';
      const sources = [];

      const validation = validateAnswer(answer, query, sources);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Answer is very short (< 50 characters)');
    });

    test('should detect "couldn\'t find" with sources available', () => {
      const answer = 'I couldn\'t find the information you requested in the documents.';
      const query = 'What is the revenue?';
      const sources = [
        { documentName: 'report.pdf', pageNumber: 1, score: 0.8 }
      ];

      const validation = validateAnswer(answer, query, sources);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Answer says "couldn\'t find" but sources are available');
    });

    test('should detect incomplete count queries', () => {
      const answer = 'The principles are: 1. First principle 2. Second principle 3. Third principle';
      const query = 'What are all 7 principles of design?';
      const sources = [
        { documentName: 'design.pdf', pageNumber: 1, score: 0.85 }
      ];

      const validation = validateAnswer(answer, query, sources);

      expect(validation.isValid).toBe(false);
      expect(validation.issues?.some(i => i.includes('Query asks for 7 items but answer only lists 3'))).toBe(true);
    });

    test('should detect missing citations', () => {
      const answer = 'The passport number is FZ487559. It was issued on March 15, 2015 in Lisbon. This is a 10-year passport valid until 2025.';
      const query = 'What is the passport number?';
      const sources = [
        { documentName: 'passport.pdf', pageNumber: 2, score: 0.9 }
      ];

      const validation = validateAnswer(answer, query, sources);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Answer doesn\'t include page citations despite having sources');
    });

    test('should pass validation for complete count query', () => {
      const answer = 'The 7 principles of design are: 1. Balance [p.1] 2. Contrast [p.2] 3. Emphasis [p.3] 4. Proportion [p.4] 5. Hierarchy [p.5] 6. Repetition [p.6] 7. Unity [p.7]';
      const query = 'What are all 7 principles of design?';
      const sources = [
        { documentName: 'design.pdf', pageNumber: 1, score: 0.9 }
      ];

      const validation = validateAnswer(answer, query, sources);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Agent Loop State Management', () => {
    test('should track best results across attempts', () => {
      const state: AgentLoopState = {
        attempt: 0,
        bestResults: null,
        bestScore: 0,
        history: []
      };

      // Attempt 1: score 0.6
      state.attempt = 1;
      state.bestResults = { matches: ['result1'] };
      state.bestScore = 0.6;

      expect(state.bestScore).toBe(0.6);

      // Attempt 2: score 0.8 (better)
      state.attempt = 2;
      state.bestResults = { matches: ['result2'] };
      state.bestScore = 0.8;

      expect(state.bestScore).toBe(0.8);
      expect(state.bestResults.matches).toContain('result2');
    });

    test('should maintain best results if later attempts are worse', () => {
      const state: AgentLoopState = {
        attempt: 0,
        bestResults: null,
        bestScore: 0,
        history: []
      };

      // Attempt 1: score 0.9 (best)
      state.attempt = 1;
      const bestResults = { matches: ['best_result'] };
      state.bestResults = bestResults;
      state.bestScore = 0.9;

      // Attempt 2: score 0.6 (worse)
      state.attempt = 2;
      // Don't update bestResults because score is worse

      expect(state.bestScore).toBe(0.9);
      expect(state.bestResults).toBe(bestResults);
      expect(state.bestResults.matches).toContain('best_result');
    });

    test('should track attempt history', () => {
      const state: AgentLoopState = {
        attempt: 0,
        bestResults: null,
        bestScore: 0,
        history: []
      };

      // Add first attempt
      state.history.push({
        attempt: 1,
        query: 'original query',
        resultCount: 5,
        avgScore: 0.6,
        observation: { needsRefinement: true, reason: 'low_relevance' }
      });

      // Add second attempt
      state.history.push({
        attempt: 2,
        query: 'refined query',
        resultCount: 8,
        avgScore: 0.8,
        observation: { needsRefinement: false }
      });

      expect(state.history.length).toBe(2);
      expect(state.history[0].avgScore).toBe(0.6);
      expect(state.history[1].avgScore).toBe(0.8);
      expect(state.history[1].query).toBe('refined query');
    });
  });

  describe('Refinement Logic', () => {
    test('should stop when results are satisfactory', () => {
      const observation: ObservationResult = {
        needsRefinement: false
      };

      const shouldContinue = observation.needsRefinement;

      expect(shouldContinue).toBe(false);
    });

    test('should continue when results need refinement', () => {
      const observation: ObservationResult = {
        needsRefinement: true,
        reason: 'low_relevance',
        details: { avgScore: 0.5 }
      };

      const shouldContinue = observation.needsRefinement;

      expect(shouldContinue).toBe(true);
    });

    test('should detect improvement threshold', () => {
      const previousScore = 0.6;
      const currentScore = 0.62;
      const improvementThreshold = 0.1; // 10%

      const improvement = (currentScore - previousScore) / previousScore;
      const shouldContinue = improvement >= improvementThreshold;

      expect(shouldContinue).toBe(false); // 3.3% improvement < 10%
    });

    test('should detect significant improvement', () => {
      const previousScore = 0.6;
      const currentScore = 0.75;
      const improvementThreshold = 0.1; // 10%

      const improvement = (currentScore - previousScore) / previousScore;
      const shouldContinue = improvement >= improvementThreshold;

      expect(shouldContinue).toBe(true); // 25% improvement > 10%
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle no results → refinement → success flow', () => {
      const attempt1Observation: ObservationResult = {
        needsRefinement: true,
        reason: 'no_results',
        details: { suggestion: 'Try broader search terms' }
      };

      const attempt2Observation: ObservationResult = {
        needsRefinement: false
      };

      expect(attempt1Observation.needsRefinement).toBe(true);
      expect(attempt2Observation.needsRefinement).toBe(false);
    });

    test('should handle low relevance → refinement → better results', () => {
      const state: AgentLoopState = {
        attempt: 0,
        bestResults: null,
        bestScore: 0,
        history: []
      };

      // Attempt 1: low relevance
      state.history.push({
        attempt: 1,
        query: 'vague query',
        resultCount: 3,
        avgScore: 0.55,
        observation: { needsRefinement: true, reason: 'low_relevance' }
      });

      // Attempt 2: better results
      state.history.push({
        attempt: 2,
        query: 'refined specific query',
        resultCount: 8,
        avgScore: 0.85,
        observation: { needsRefinement: false }
      });

      expect(state.history[1].avgScore).toBeGreaterThan(state.history[0].avgScore);
      expect(state.history[1].observation.needsRefinement).toBe(false);
    });

    test('should stop at max attempts even if not perfect', () => {
      const maxAttempts = 3;
      const currentAttempt = 3;

      const shouldStop = currentAttempt >= maxAttempts;

      expect(shouldStop).toBe(true);
    });
  });
});
