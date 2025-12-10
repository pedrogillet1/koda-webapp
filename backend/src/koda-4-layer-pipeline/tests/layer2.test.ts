/**
 * ============================================================================
 * LAYER 2: MASTER ANSWER FORMATTER - UNIT TESTS
 * ============================================================================
 *
 * Tests for the formatter that makes answers pretty & consistent:
 * - UTF-8 encoding fixes
 * - Duplicate paragraph removal
 * - Spacing normalization
 * - Consistent bolding
 * - Document name formatting
 *
 * @version 1.0.0
 * @date 2024-12-10
 */

import { masterAnswerFormatter } from '../layer2-formatter/masterAnswerFormatter';
import { FormatterInput, Source, Language, AnswerMode } from '../types';

describe('MasterAnswerFormatter', () => {

  // Helper function to create standard input
  const createInput = (overrides: Partial<FormatterInput> = {}): FormatterInput => ({
    structuredText: 'This is a test answer.',
    sources: [],
    language: 'en' as Language,
    answerMode: 'direct_short' as AnswerMode,
    options: {},
    ...overrides,
  });

  describe('fixEncoding', () => {
    it('should fix Portuguese accent mojibake - ç', () => {
      const input = createInput({
        structuredText: 'PreÃ§o do produto',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('Preço');
      expect(result.formattedText).not.toContain('Ã§');
      expect(result.stats.encodingFixesApplied).toBeGreaterThan(0);
    });

    it('should fix Portuguese accent mojibake - ã', () => {
      const input = createInput({
        structuredText: 'InformaÃ§Ã£o importante',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('Informação');
      expect(result.formattedText).not.toContain('Ã£');
    });

    it('should fix multiple encoding issues', () => {
      const input = createInput({
        structuredText: 'CotaÃ§Ã£o de preÃ§o',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('Cotação');
      expect(result.formattedText).toContain('preço');
    });

    it('should fix em dash mojibake', () => {
      const input = createInput({
        structuredText: 'Text â€" more text',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('—');
      expect(result.formattedText).not.toContain('â€"');
    });

    it('should fix degree symbol mojibake', () => {
      const input = createInput({
        structuredText: 'Temperature: 25Â°C',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('25°C');
      expect(result.formattedText).not.toContain('Â°');
    });

    it('should count encoding fixes correctly', () => {
      const input = createInput({
        structuredText: 'Ã§ Ã£ Ã©', // 3 fixes needed
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.stats.encodingFixesApplied).toBe(3);
    });
  });

  describe('removeDuplicatedParagraphs', () => {
    it('should remove exact duplicate paragraphs', () => {
      const input = createInput({
        structuredText: 'Paragraph one.\n\nParagraph one.\n\nParagraph two.',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect((result.formattedText.match(/Paragraph one/g) || []).length).toBe(1);
      expect(result.stats.duplicatesRemoved).toBe(1);
    });

    it('should handle case-insensitive duplicates', () => {
      const input = createInput({
        structuredText: 'HELLO WORLD.\n\nhello world.\n\nGoodbye world.',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.stats.duplicatesRemoved).toBe(1);
    });

    it('should preserve unique paragraphs', () => {
      const input = createInput({
        structuredText: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('First paragraph');
      expect(result.formattedText).toContain('Second paragraph');
      expect(result.formattedText).toContain('Third paragraph');
      expect(result.stats.duplicatesRemoved).toBe(0);
    });
  });

  describe('normalizeSpacing', () => {
    it('should convert CRLF to LF', () => {
      const input = createInput({
        structuredText: 'Line 1\r\nLine 2\r\nLine 3',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).not.toContain('\r\n');
      expect(result.formattedText).toContain('\n');
    });

    it('should collapse 3+ blank lines into 2', () => {
      const input = createInput({
        structuredText: 'Paragraph 1\n\n\n\nParagraph 2',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).not.toContain('\n\n\n');
    });

    it('should add space after period when followed by letter', () => {
      const input = createInput({
        structuredText: 'Sentence one.Sentence two.',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('. S');
    });

    it('should trim trailing spaces on lines', () => {
      const input = createInput({
        structuredText: 'Line with spaces   \nAnother line   ',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).not.toMatch(/[ ]+\n/);
      expect(result.formattedText.trim()).not.toMatch(/[ ]+$/);
    });
  });

  describe('applyConsistentBolding', () => {
    it('should bold BRL currency values', () => {
      const input = createInput({
        structuredText: 'O preço é R$ 1.500,00',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**R$ 1.500,00**');
      expect(result.stats.boldingsApplied).toBeGreaterThan(0);
    });

    it('should bold USD currency values', () => {
      const input = createInput({
        structuredText: 'The price is $ 1,500.00',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**$ 1,500.00**');
    });

    it('should bold percentages', () => {
      const input = createInput({
        structuredText: 'A taxa é de 15.5%',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**15.5%**');
    });

    it('should bold area measurements', () => {
      const input = createInput({
        structuredText: 'Area of 150 m² available',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**150 m²**');
    });

    it('should not double-bold already bolded text', () => {
      const input = createInput({
        structuredText: 'The value is **R$ 1.000,00**',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      // Should not create ****R$ 1.000,00****
      expect(result.formattedText).not.toContain('****');
    });

    it('should bold currency with text suffix (milhões)', () => {
      const input = createInput({
        structuredText: 'Valor total de R$ 5 milhões',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**R$ 5 milhões**');
    });
  });

  describe('formatDocumentNamesInline', () => {
    it('should bold document names mentioned in text', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'report.pdf' },
      ];
      const input = createInput({
        structuredText: 'According to report.pdf, the data shows...',
        sources,
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**report.pdf**');
      expect(result.stats.documentNamesFormatted).toBe(1);
    });

    it('should handle multiple document names', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'report.pdf' },
        { documentId: '2', filename: 'data.xlsx' },
      ];
      const input = createInput({
        structuredText: 'The report.pdf and data.xlsx contain relevant information.',
        sources,
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**report.pdf**');
      expect(result.formattedText).toContain('**data.xlsx**');
    });

    it('should only bold first occurrence of each document', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'report.pdf' },
      ];
      const input = createInput({
        structuredText: 'See report.pdf for details. More info in report.pdf.',
        sources,
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      const boldCount = (result.formattedText.match(/\*\*report\.pdf\*\*/g) || []).length;
      expect(boldCount).toBe(1);
    });

    it('should use documentName if filename not available', () => {
      const sources: Source[] = [
        { documentId: '1', documentName: 'Annual Report' },
      ];
      const input = createInput({
        structuredText: 'The Annual Report shows...',
        sources,
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('**Annual Report**');
    });
  });

  describe('addDocumentsUsedSection', () => {
    it('should add documents section when option is enabled', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'doc1.pdf' },
        { documentId: '2', filename: 'doc2.xlsx' },
      ];
      const input = createInput({
        structuredText: 'This is the answer.',
        sources,
        language: 'en',
        options: { addDocumentsUsedSection: true },
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('### Documents used');
      expect(result.formattedText).toContain('1. **doc1.pdf**');
      expect(result.formattedText).toContain('2. **doc2.xlsx**');
    });

    it('should use Portuguese heading for PT language', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'relatorio.pdf' },
      ];
      const input = createInput({
        structuredText: 'Esta é a resposta.',
        sources,
        language: 'pt',
        options: { addDocumentsUsedSection: true },
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('### Documentos usados');
    });

    it('should not add section when option is disabled', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'doc.pdf' },
      ];
      const input = createInput({
        structuredText: 'This is the answer.',
        sources,
        options: { addDocumentsUsedSection: false },
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).not.toContain('Documents used');
    });

    it('should not add section when no sources', () => {
      const input = createInput({
        structuredText: 'This is the answer.',
        sources: [],
        options: { addDocumentsUsedSection: true },
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).not.toContain('Documents used');
    });
  });

  describe('softTruncate', () => {
    it('should truncate text exceeding maxLength', () => {
      const longText = 'A'.repeat(1000) + '. ' + 'B'.repeat(1000);
      const input = createInput({
        structuredText: longText,
        options: { maxLength: 500 },
        language: 'en',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText.length).toBeLessThanOrEqual(600); // Some buffer for note
    });

    it('should add truncation note in English', () => {
      const longText = 'This is a long sentence. '.repeat(50);
      const input = createInput({
        structuredText: longText,
        options: { maxLength: 200 },
        language: 'en',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('truncated');
    });

    it('should add truncation note in Portuguese', () => {
      const longText = 'Esta é uma frase longa. '.repeat(50);
      const input = createInput({
        structuredText: longText,
        options: { maxLength: 200 },
        language: 'pt',
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).toContain('truncada');
    });

    it('should not truncate text within maxLength', () => {
      const input = createInput({
        structuredText: 'Short text.',
        options: { maxLength: 1000 },
      });
      const result = masterAnswerFormatter.formatAnswer(input);
      expect(result.formattedText).not.toContain('truncated');
    });
  });

  describe('output statistics', () => {
    it('should return all stats fields', () => {
      const input = createInput({
        structuredText: 'Test text with R$ 100 and 15%.',
        sources: [{ documentId: '1', filename: 'test.pdf' }],
      });
      const result = masterAnswerFormatter.formatAnswer(input);

      expect(result.stats).toHaveProperty('encodingFixesApplied');
      expect(result.stats).toHaveProperty('duplicatesRemoved');
      expect(result.stats).toHaveProperty('boldingsApplied');
      expect(result.stats).toHaveProperty('documentNamesFormatted');
    });
  });
});
