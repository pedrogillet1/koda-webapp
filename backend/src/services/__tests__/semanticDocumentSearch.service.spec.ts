/**
 * Semantic Document Search Service - Unit Tests
 *
 * Comprehensive test suite for the semantic document search system.
 * Tests query parsing, matching, scoring, and message generation.
 *
 * Run with: npx jest semanticDocumentSearch.service.spec.ts
 */

import { semanticDocumentSearchService } from '../semanticDocumentSearch.service';

// Use 'any' to bypass TypeScript private method restrictions in tests
const service = semanticDocumentSearchService as any;

describe('SemanticDocumentSearchService', () => {
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // QUERY DETECTION TESTS
  // ============================================================================
  describe('Query Detection', () => {
    it('should detect document search queries', () => {
      const queries = [
        'which document mentions Q2 2025?',
        'find the file about revenue',
        'where is the report?',
        'show me documents about profit',
        'list files mentioning decline'
      ];

      queries.forEach(query => {
        expect(service.isDocumentSearchQuery(query)).toBe(true);
      });
    });

    it('should not detect non-document queries', () => {
      const queries = [
        'what is the revenue for 2024?',
        'calculate the MoIC',
        'compare Q3 and Q4 performance',
        'summarize the findings'
      ];

      queries.forEach(query => {
        expect(service.isDocumentSearchQuery(query)).toBe(false);
      });
    });

    it('should detect queries with different document terms', () => {
      const queries = [
        'which document contains the budget?',
        'find the file with Q3 data',
        'where is the report about investments?',
        'show me the document on ROI'
      ];

      queries.forEach(query => {
        expect(service.isDocumentSearchQuery(query)).toBe(true);
      });
    });

    it('should handle case insensitivity', () => {
      expect(service.isDocumentSearchQuery('WHICH DOCUMENT HAS REVENUE DATA?')).toBe(true);
      expect(service.isDocumentSearchQuery('Find The File About Budget')).toBe(true);
    });

    it('should detect queries with various action words', () => {
      const queries = [
        'locate the document about Q2',
        'search for files mentioning profit',
        'give me the report on expenses'
      ];

      queries.forEach(query => {
        expect(service.isDocumentSearchQuery(query)).toBe(true);
      });
    });
  });

  // ============================================================================
  // QUERY PARSING TESTS
  // ============================================================================
  describe('Query Parsing', () => {
    it('should extract time periods correctly', () => {
      const query = 'document mentioning Q2 2025 and March 2024';
      const parsed = service['parseQuery'](query);

      const timePeriods = parsed.criteria.filter((c: any) => c.type === 'time_period');
      expect(timePeriods.length).toBeGreaterThan(0);
      expect(timePeriods.some((t: any) => t.value === 'Q2')).toBe(true);
      expect(timePeriods.some((t: any) => t.value === '2025')).toBe(true);
    });

    it('should extract metrics correctly', () => {
      const query = 'file showing decline in revenue and profit growth';
      const parsed = service['parseQuery'](query);

      const metrics = parsed.criteria.filter((c: any) => c.type === 'metric');
      expect(metrics.some((m: any) => m.value === 'decline')).toBe(true);
      expect(metrics.some((m: any) => m.value === 'growth')).toBe(true);
    });

    it('should detect AND operator', () => {
      const query = 'document with both Q3 and Q5';
      const parsed = service['parseQuery'](query);

      expect(parsed.operator).toBe('AND');
    });

    it('should detect OR operator by default', () => {
      const query = 'files mentioning Q3 or Q5';
      const parsed = service['parseQuery'](query);

      expect(parsed.operator).toBe('OR');
    });

    it('should extract file types', () => {
      const query = 'find xlsx files about revenue';
      const parsed = service['parseQuery'](query);

      const fileTypes = parsed.criteria.filter((c: any) => c.type === 'file_type');
      expect(fileTypes.some((f: any) => f.value.toLowerCase() === 'xlsx')).toBe(true);
    });

    it('should set correct query type for single document', () => {
      const query = 'document about revenue';
      const parsed = service['parseQuery'](query);
      expect(parsed.type).toBe('find_document');
    });

    it('should set correct query type for multiple documents', () => {
      const query = 'all files about revenue';
      const parsed = service['parseQuery'](query);
      expect(parsed.type).toBe('find_multiple');
    });

    it('should set correct query type for location query', () => {
      const query = 'where is the revenue report?';
      const parsed = service['parseQuery'](query);
      expect(parsed.type).toBe('locate_document');
    });

    it('should preserve original query', () => {
      const query = 'document mentioning Q2 2025';
      const parsed = service['parseQuery'](query);
      expect(parsed.originalQuery).toBe(query);
    });

    it('should handle empty query', () => {
      const parsed = service['parseQuery']('');
      expect(parsed.criteria.length).toBe(0);
    });
  });

  // ============================================================================
  // TIME PERIOD EXTRACTION TESTS
  // ============================================================================
  describe('Time Period Extraction', () => {
    it('should extract quarters', () => {
      const periods = service['extractTimePeriods']('Q1 Q2 Q3 Q4');
      expect(periods).toContain('Q1');
      expect(periods).toContain('Q2');
      expect(periods).toContain('Q3');
      expect(periods).toContain('Q4');
    });

    it('should extract years', () => {
      const periods = service['extractTimePeriods']('2024 and 2025');
      expect(periods).toContain('2024');
      expect(periods).toContain('2025');
    });

    it('should extract months', () => {
      const periods = service['extractTimePeriods']('January and March');
      expect(periods).toContain('January');
      expect(periods).toContain('March');
    });

    it('should handle abbreviated months', () => {
      const periods = service['extractTimePeriods']('Jan Feb Mar');
      expect(periods).toContain('Jan');
      expect(periods).toContain('Feb');
      expect(periods).toContain('Mar');
    });

    it('should handle case insensitivity for quarters', () => {
      const periods = service['extractTimePeriods']('q1 q2');
      expect(periods).toContain('Q1');
      expect(periods).toContain('Q2');
    });

    it('should not duplicate periods', () => {
      const periods = service['extractTimePeriods']('Q1 Q1 Q1');
      expect(periods.length).toBe(1);
    });
  });

  // ============================================================================
  // METRIC EXTRACTION TESTS
  // ============================================================================
  describe('Metric Extraction', () => {
    it('should extract decline-related metrics', () => {
      const metrics = service['extractMetrics']('decline decrease drop fall');
      expect(metrics).toContain('decline');
      expect(metrics).toContain('decrease');
      expect(metrics).toContain('drop');
      expect(metrics).toContain('fall');
    });

    it('should extract growth-related metrics', () => {
      const metrics = service['extractMetrics']('increase growth rise gain');
      expect(metrics).toContain('increase');
      expect(metrics).toContain('growth');
      expect(metrics).toContain('rise');
      expect(metrics).toContain('gain');
    });

    it('should extract financial metrics', () => {
      const metrics = service['extractMetrics']('ROI IRR MoIC CAGR NPV');
      expect(metrics).toContain('roi');
      expect(metrics).toContain('irr');
      expect(metrics).toContain('moic');
    });
  });

  // ============================================================================
  // TOPIC EXTRACTION TESTS
  // ============================================================================
  describe('Topic Extraction', () => {
    it('should extract revenue-related topics', () => {
      const topics = service['extractTopics']('revenue sales income');
      expect(topics).toContain('revenue');
      expect(topics).toContain('sales');
      expect(topics).toContain('income');
    });

    it('should extract expense-related topics', () => {
      const topics = service['extractTopics']('expenses costs spending');
      expect(topics).toContain('expenses');
      expect(topics).toContain('costs');
      expect(topics).toContain('spending');
    });
  });

  // ============================================================================
  // KEYWORD EXTRACTION TESTS
  // ============================================================================
  describe('Keyword Extraction', () => {
    it('should extract keywords excluding stop words', () => {
      const keywords = service['extractKeywords'](
        'find document about investment strategy',
        []
      );
      expect(keywords).toContain('investment');
      expect(keywords).toContain('strategy');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('about');
    });

    it('should exclude already extracted terms', () => {
      const keywords = service['extractKeywords'](
        'Q2 2025 revenue decline',
        ['Q2', '2025', 'revenue', 'decline']
      );
      expect(keywords).not.toContain('q2');
      expect(keywords).not.toContain('2025');
      expect(keywords).not.toContain('revenue');
      expect(keywords).not.toContain('decline');
    });
  });

  // ============================================================================
  // OPERATOR DETECTION TESTS
  // ============================================================================
  describe('Operator Detection', () => {
    it('should detect AND operator', () => {
      expect(service['detectOperator']('Q3 and Q5')).toBe('AND');
      expect(service['detectOperator']('both revenue and profit')).toBe('AND');
      expect(service['detectOperator']('all documents')).toBe('AND');
    });

    it('should default to OR operator', () => {
      expect(service['detectOperator']('Q3 or Q5')).toBe('OR');
      expect(service['detectOperator']('revenue profit')).toBe('OR');
    });
  });

  // ============================================================================
  // CHUNK MATCHING TESTS
  // ============================================================================
  describe('Chunk Matching', () => {
    it('should match time periods in chunks', () => {
      const chunk = 'Q2 2025 showed significant growth';
      const criterion = { type: 'time_period' as const, value: 'Q2', weight: 0.9 };

      expect(service['chunkMatchesCriterion'](chunk, criterion)).toBe(true);
    });

    it('should match metrics with synonyms', () => {
      const chunk = 'Revenue decreased by 10%';
      const criterion = { type: 'metric' as const, value: 'decline', weight: 0.8 };

      // Should match because 'decreased' is a synonym of 'decline'
      expect(service['chunkMatchesCriterion'](chunk, criterion)).toBe(true);
    });

    it('should match topics', () => {
      const chunk = 'Total revenue for the quarter was $5M';
      const criterion = { type: 'topic' as const, value: 'revenue', weight: 0.7 };

      expect(service['chunkMatchesCriterion'](chunk, criterion)).toBe(true);
    });

    it('should match keywords', () => {
      const chunk = 'Investment strategy for 2025';
      const criterion = { type: 'keyword' as const, value: 'investment', weight: 0.5 };

      expect(service['chunkMatchesCriterion'](chunk, criterion)).toBe(true);
    });
  });

  // ============================================================================
  // METRIC SYNONYMS TESTS
  // ============================================================================
  describe('Metric Synonyms', () => {
    it('should return synonyms for decline', () => {
      const synonyms = service['getMetricSynonyms']('decline');
      expect(synonyms).toContain('decline');
      expect(synonyms).toContain('decrease');
      expect(synonyms).toContain('drop');
      expect(synonyms).toContain('fall');
    });

    it('should return synonyms for increase', () => {
      const synonyms = service['getMetricSynonyms']('increase');
      expect(synonyms).toContain('increase');
      expect(synonyms).toContain('growth');
      expect(synonyms).toContain('rise');
      expect(synonyms).toContain('gain');
    });

    it('should return original term if no synonyms', () => {
      const synonyms = service['getMetricSynonyms']('unknown');
      expect(synonyms).toEqual(['unknown']);
    });
  });

  // ============================================================================
  // QUERY TYPE DETECTION TESTS
  // ============================================================================
  describe('Query Type Detection', () => {
    it('should detect find_multiple type', () => {
      const queries = [
        'list all files',
        'show me multiple documents',
        'which files mention revenue'
      ];

      queries.forEach(query => {
        const parsed = service['parseQuery'](query);
        expect(parsed.type).toBe('find_multiple');
      });
    });

    it('should detect locate_document type', () => {
      const queries = [
        'where is the report?',
        'locate the file',
        'find the document location'
      ];

      queries.forEach(query => {
        const parsed = service['parseQuery'](query);
        expect(parsed.type).toBe('locate_document');
      });
    });

    it('should default to find_document type', () => {
      const query = 'document about revenue';
      const parsed = service['parseQuery'](query);
      expect(parsed.type).toBe('find_document');
    });
  });

  // ============================================================================
  // MESSAGE GENERATION TESTS
  // ============================================================================
  describe('Message Generation', () => {
    it('should generate single document message', () => {
      const match = {
        documentId: '1',
        filename: 'Q2 Report.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 1024000,
        folderId: null,
        confidence: 0.95,
        matchedCriteria: ['Q2', 'revenue'],
        matchedChunks: []
      };

      const query = {
        type: 'find_document' as const,
        criteria: [],
        operator: 'AND' as const,
        originalQuery: 'document mentioning Q2 revenue'
      };

      const message = service['getSingleDocumentMessage'](match, query);

      expect(message).toContain('Q2 Report.xlsx');
      expect(message).toContain('95%');
      expect(message).toContain('Q2');
      expect(message).toContain('revenue');
    });

    it('should generate multiple documents message', () => {
      const matches = [
        {
          documentId: '1',
          filename: 'Report 1.xlsx',
          mimeType: 'application/xlsx',
          fileSize: 1024,
          folderId: null,
          confidence: 0.9,
          matchedCriteria: ['Q2'],
          matchedChunks: []
        },
        {
          documentId: '2',
          filename: 'Report 2.pdf',
          mimeType: 'application/pdf',
          fileSize: 2048,
          folderId: null,
          confidence: 0.8,
          matchedCriteria: ['Q3'],
          matchedChunks: []
        }
      ];

      const query = {
        type: 'find_multiple' as const,
        criteria: [
          { type: 'time_period' as const, value: 'Q2', weight: 0.9 },
          { type: 'time_period' as const, value: 'Q3', weight: 0.9 }
        ],
        operator: 'OR' as const,
        originalQuery: 'files mentioning Q2 or Q3'
      };

      const message = service['getMultipleDocumentsMessage'](matches, query, false);

      expect(message).toContain('2 documents');
      expect(message).toContain('Q2');
      expect(message).toContain('Q3');
    });

    it('should generate not found message', () => {
      const query = {
        type: 'find_document' as const,
        criteria: [
          { type: 'time_period' as const, value: 'Q7', weight: 0.9 }
        ],
        operator: 'AND' as const,
        originalQuery: 'document mentioning Q7'
      };

      const message = service['getNotFoundMessage'](query);

      expect(message).toContain("couldn't find");
      expect(message).toContain('Q7');
    });

    it('should generate partial match message', () => {
      const matches = [
        {
          documentId: '1',
          filename: 'Report 1.xlsx',
          mimeType: 'application/xlsx',
          fileSize: 1024,
          folderId: null,
          confidence: 0.7,
          matchedCriteria: ['Q2', 'revenue'],
          matchedChunks: []
        }
      ];

      const query = {
        type: 'find_document' as const,
        criteria: [
          { type: 'time_period' as const, value: 'Q2', weight: 0.9 },
          { type: 'topic' as const, value: 'revenue', weight: 0.8 },
          { type: 'metric' as const, value: 'decline', weight: 0.8 }
        ],
        operator: 'AND' as const,
        originalQuery: 'document with Q2 revenue decline'
      };

      const message = service['getMultipleDocumentsMessage'](matches, query, true);

      expect(message).toContain("couldn't find a single document");
      expect(message).toContain('relevant information');
    });
  });

  // ============================================================================
  // COMPLEX QUERY PARSING TESTS
  // ============================================================================
  describe('Complex Query Parsing', () => {
    it('should parse complex multi-criteria query', () => {
      const query = 'find xlsx document mentioning Q2 2025 revenue decline in Rosewood Fund';
      const parsed = service['parseQuery'](query);

      // Should extract multiple criteria types
      expect(parsed.criteria.some((c: any) => c.type === 'time_period')).toBe(true);
      expect(parsed.criteria.some((c: any) => c.type === 'metric')).toBe(true);
      expect(parsed.criteria.some((c: any) => c.type === 'topic')).toBe(true);
      expect(parsed.criteria.some((c: any) => c.type === 'file_type')).toBe(true);
      expect(parsed.criteria.some((c: any) => c.type === 'keyword')).toBe(true);
    });

    it('should handle queries with multiple time periods', () => {
      const query = 'documents from Q1 2024 to Q4 2025';
      const parsed = service['parseQuery'](query);

      const timePeriods = parsed.criteria.filter((c: any) => c.type === 'time_period');
      expect(timePeriods.length).toBeGreaterThanOrEqual(4); // Q1, Q4, 2024, 2025
    });

    it('should handle queries with multiple metrics', () => {
      const query = 'file showing revenue growth and profit decline';
      const parsed = service['parseQuery'](query);

      const metrics = parsed.criteria.filter((c: any) => c.type === 'metric');
      expect(metrics.length).toBeGreaterThanOrEqual(2); // growth, decline
    });
  });

  // ============================================================================
  // EDGE CASES TESTS
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const parsed = service['parseQuery']('');
      expect(parsed.criteria.length).toBe(0);
    });

    it('should handle query with only stop words', () => {
      const parsed = service['parseQuery']('the and or but');
      expect(parsed.criteria.length).toBe(0);
    });

    it('should handle case-insensitive matching', () => {
      const chunk = 'Q2 2025 REVENUE DECLINE';
      const criterion = { type: 'metric' as const, value: 'decline', weight: 0.8 };

      expect(service['chunkMatchesCriterion'](chunk, criterion)).toBe(true);
    });

    it('should handle special characters in query', () => {
      const query = "document about Q2's revenue (2025)";
      const parsed = service['parseQuery'](query);

      expect(parsed.criteria.some((c: any) => c.value === 'Q2')).toBe(true);
      expect(parsed.criteria.some((c: any) => c.value === '2025')).toBe(true);
    });
  });

  // ============================================================================
  // HELPER FUNCTION TESTS
  // ============================================================================
  describe('Helper Functions', () => {
    it('should detect multiple document query', () => {
      expect(service['isMultipleDocumentQuery']('list all files')).toBe(true);
      expect(service['isMultipleDocumentQuery']('show documents')).toBe(true);
      expect(service['isMultipleDocumentQuery']('show the file')).toBe(false);
    });

    it('should detect location query', () => {
      expect(service['isLocationQuery']('where is the file')).toBe(true);
      expect(service['isLocationQuery']('locate the document')).toBe(true);
      expect(service['isLocationQuery']('show me the file')).toBe(false);
    });
  });
});
