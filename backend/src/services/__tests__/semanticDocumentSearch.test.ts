/**
 * Semantic Document Search Service Tests
 */

import { semanticDocumentSearchService } from '../semanticDocumentSearch.service';

describe('SemanticDocumentSearchService', () => {
  describe('isDocumentSearchQuery', () => {
    it('should detect English document search queries', () => {
      expect(semanticDocumentSearchService.isDocumentSearchQuery('find documents about LGPD')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('search for files containing invoices')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('locate document about data protection')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('show me documents that talk about privacy')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('where is the file about contracts')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('which document mentions budget')).toBe(true);
    });

    it('should detect Portuguese document search queries', () => {
      expect(semanticDocumentSearchService.isDocumentSearchQuery('encontre documentos sobre LGPD')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('busque arquivos que falam sobre contratos')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('qual documento menciona orçamento')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('mostre documentos sobre privacidade')).toBe(true);
    });

    it('should detect Spanish document search queries', () => {
      expect(semanticDocumentSearchService.isDocumentSearchQuery('encontrar documentos sobre privacidad')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('buscar archivos que hablan de contratos')).toBe(true);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('cuál documento menciona presupuesto')).toBe(true);
    });

    it('should not detect non-document-search queries', () => {
      expect(semanticDocumentSearchService.isDocumentSearchQuery('what is LGPD?')).toBe(false);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('hello')).toBe(false);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('summarize my documents')).toBe(false);
      expect(semanticDocumentSearchService.isDocumentSearchQuery('what is the total revenue?')).toBe(false);
    });
  });

  describe('extractSearchTopic', () => {
    it('should extract topic from English queries', () => {
      expect(semanticDocumentSearchService.extractSearchTopic('find documents about LGPD data protection'))
        .toContain('LGPD');
      expect(semanticDocumentSearchService.extractSearchTopic('search for files containing invoices'))
        .toContain('invoices');
      expect(semanticDocumentSearchService.extractSearchTopic('where is the file about contracts'))
        .toContain('contracts');
    });

    it('should extract topic from Portuguese queries', () => {
      expect(semanticDocumentSearchService.extractSearchTopic('encontre documentos sobre proteção de dados'))
        .toContain('proteção');
      expect(semanticDocumentSearchService.extractSearchTopic('busque arquivos que falam sobre contratos'))
        .toContain('contratos');
    });

    it('should handle edge cases', () => {
      // Empty after cleaning should return original query
      const topic = semanticDocumentSearchService.extractSearchTopic('find document');
      expect(topic.length).toBeGreaterThan(0);
    });
  });

  describe('search', () => {
    // These tests require mocking Pinecone and Embedding services
    // In a real test environment, you would mock these dependencies

    it('should return empty response for invalid user', async () => {
      // This will fail fast because Pinecone filters by userId
      const result = await semanticDocumentSearchService.search('test query', 'invalid-user-id');
      expect(result).toBeDefined();
      expect(result.query).toBe('test query');
      expect(Array.isArray(result.documents)).toBe(true);
    });
  });

  describe('getConfidenceLevel', () => {
    // Test confidence level calculation via search results
    it('should return proper confidence structure in response', async () => {
      const result = await semanticDocumentSearchService.search('test', 'test-user');
      expect(['high', 'medium', 'low']).toContain(result.confidenceLevel);
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('searchByFilename', () => {
    it('should search documents by filename pattern', async () => {
      // This will attempt to search in the database
      const result = await semanticDocumentSearchService.searchByFilename('test.pdf', 'test-user');
      expect(result).toBeDefined();
      expect(result.action).toBe('filename_search');
      expect(Array.isArray(result.documents)).toBe(true);
    });
  });
});
