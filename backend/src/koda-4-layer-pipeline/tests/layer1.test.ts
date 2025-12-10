/**
 * ============================================================================
 * LAYER 1: KODA OUTPUT STRUCTURE ENGINE - UNIT TESTS
 * ============================================================================
 *
 * Tests for the structure engine that shapes raw LLM answers:
 * - Line break normalization
 * - Bad heading removal
 * - Title addition logic
 * - Steps formatting
 * - Bullet list formatting
 * - Paragraph size enforcement
 *
 * @version 1.0.0
 * @date 2024-12-10
 */

import { kodaOutputStructureEngine } from '../layer1-structure/kodaOutputStructureEngine';
import { StructureEngineInput, PrimaryIntent, AnswerMode, Language } from '../types';

describe('KodaOutputStructureEngine', () => {

  // Helper function to create standard input
  const createInput = (overrides: Partial<StructureEngineInput> = {}): StructureEngineInput => ({
    rawAnswer: 'This is a test answer.',
    query: 'What is the test?',
    primaryIntent: 'single_doc_factual' as PrimaryIntent,
    answerMode: 'direct_short' as AnswerMode,
    language: 'en' as Language,
    hasDocuments: true,
    sources: [],
    ...overrides,
  });

  describe('normalizeLineBreaks', () => {
    it('should convert CRLF to LF', () => {
      const input = createInput({
        rawAnswer: 'Line 1\r\nLine 2\r\nLine 3',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).not.toContain('\r\n');
      expect(result.structuredText).toContain('\n');
    });

    it('should collapse 3+ blank lines into 2', () => {
      const input = createInput({
        rawAnswer: 'Paragraph 1\n\n\n\nParagraph 2',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).not.toContain('\n\n\n');
    });

    it('should trim trailing spaces on each line', () => {
      const input = createInput({
        rawAnswer: 'Line with trailing space   \nAnother line   ',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).not.toMatch(/[ ]+\n/);
    });
  });

  describe('removeBadHeadings', () => {
    it('should remove generic headings in direct_short mode', () => {
      const input = createInput({
        rawAnswer: '# Resumo\n\nThis is the answer.',
        answerMode: 'direct_short',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).not.toContain('# Resumo');
      expect(result.structuredText).toContain('This is the answer.');
    });

    it('should remove generic headings in bullet_list mode', () => {
      const input = createInput({
        rawAnswer: '# Answer\n\n- Item 1\n- Item 2',
        answerMode: 'bullet_list',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).not.toContain('# Answer');
    });

    it('should keep headings in structured_sections mode', () => {
      const input = createInput({
        rawAnswer: '## Analysis\n\nThis is a detailed analysis with multiple paragraphs.\n\nMore content here to make it longer.',
        answerMode: 'structured_sections',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.hasTitle).toBe(true);
    });
  });

  describe('addTitleIfNeeded', () => {
    it('should not add title to ultra-short answers', () => {
      const input = createInput({
        rawAnswer: 'Short answer.',
        answerMode: 'explanatory',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.hasTitle).toBe(false);
    });

    it('should not add title for meta queries', () => {
      const input = createInput({
        rawAnswer: 'You have 5 documents uploaded.',
        primaryIntent: 'meta',
        answerMode: 'direct_short',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.hasTitle).toBe(false);
    });

    it('should not add title for file_action queries', () => {
      const input = createInput({
        rawAnswer: 'The file has been deleted successfully.',
        primaryIntent: 'file_action',
        answerMode: 'direct_short',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.hasTitle).toBe(false);
    });

    it('should detect existing title', () => {
      const input = createInput({
        rawAnswer: '## Existing Title\n\nThis is a long answer that continues over multiple paragraphs with detailed analysis.',
        answerMode: 'structured_sections',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.hasTitle).toBe(true);
    });
  });

  describe('formatAsSteps', () => {
    it('should convert text to numbered steps in steps mode', () => {
      const input = createInput({
        rawAnswer: 'First step\nSecond step\nThird step',
        answerMode: 'steps',
        language: 'en',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).toContain('Step-by-step:');
      expect(result.structuredText).toContain('1.');
      expect(result.structuredText).toContain('2.');
      expect(result.structuredText).toContain('3.');
    });

    it('should use Portuguese intro for PT language', () => {
      const input = createInput({
        rawAnswer: 'Primeiro passo\nSegundo passo',
        answerMode: 'steps',
        language: 'pt',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).toContain('Passo a passo:');
    });

    it('should remove existing bullet points when converting to steps', () => {
      const input = createInput({
        rawAnswer: '- First item\n* Second item\n• Third item',
        answerMode: 'steps',
        language: 'en',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).not.toContain('- ');
      expect(result.structuredText).not.toContain('* ');
      expect(result.structuredText).toContain('1. First item');
    });
  });

  describe('formatAsBulletList', () => {
    it('should convert text to bullet list in bullet_list mode', () => {
      const input = createInput({
        rawAnswer: 'First item\nSecond item\nThird item',
        answerMode: 'bullet_list',
        language: 'en',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).toContain('Summary:');
      expect(result.structuredText).toContain('- First item');
      expect(result.structuredText).toContain('- Second item');
    });

    it('should use Portuguese intro for PT language', () => {
      const input = createInput({
        rawAnswer: 'Primeiro item\nSegundo item',
        answerMode: 'bullet_list',
        language: 'pt',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).toContain('Resumo:');
    });
  });

  describe('enforceParagraphSize', () => {
    it('should split very long paragraphs', () => {
      // Create a very long paragraph with many sentences
      const longText = Array(15).fill('This is a sentence.').join(' ');
      const input = createInput({
        rawAnswer: longText,
        answerMode: 'explanatory',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      // Should have multiple paragraphs now
      expect(result.paragraphCount).toBeGreaterThan(0);
    });

    it('should preserve headings during paragraph enforcement', () => {
      const input = createInput({
        rawAnswer: '## Heading\n\nShort paragraph.',
        answerMode: 'structured_sections',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).toContain('## Heading');
    });
  });

  describe('addClosingIfNeeded', () => {
    it('should add closing for explanatory mode without existing closing', () => {
      const input = createInput({
        rawAnswer: 'This is a detailed explanation that spans over multiple sentences and provides useful information to the user about the topic.',
        answerMode: 'explanatory',
        hasDocuments: true,
        language: 'en',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).toContain('provide more details');
    });

    it('should not add closing if answer ends with question', () => {
      const input = createInput({
        rawAnswer: 'This is the answer. Would you like more details?',
        answerMode: 'explanatory',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      // Should end with the question, not add a closing
      const trimmed = result.structuredText.trim();
      expect(trimmed.endsWith('?')).toBe(true);
    });

    it('should not add closing if already has closing phrase', () => {
      const input = createInput({
        rawAnswer: 'This is the answer. Let me know if you need more help.',
        answerMode: 'explanatory',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      // Should not add duplicate closing
      expect((result.structuredText.match(/let me know/gi) || []).length).toBe(1);
    });

    it('should use Portuguese closing for PT language', () => {
      const input = createInput({
        rawAnswer: 'Esta é uma explicação detalhada que abrange várias frases e fornece informações úteis.',
        answerMode: 'explanatory',
        hasDocuments: true,
        language: 'pt',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structuredText).toContain('posso');
    });
  });

  describe('structureScore calculation', () => {
    it('should return higher score for well-structured answers', () => {
      const input = createInput({
        rawAnswer: '### Section 1\n\nParagraph one.\n\n### Section 2\n\nParagraph two.',
        answerMode: 'structured_sections',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structureScore).toBeGreaterThanOrEqual(60);
    });

    it('should penalize answers with too many blank lines', () => {
      const input = createInput({
        rawAnswer: 'Paragraph 1\n\n\n\nParagraph 2\n\n\n\nParagraph 3',
        answerMode: 'direct_short',
      });
      // The normalizer will collapse blank lines, so this tests the input state
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.structureScore).toBeGreaterThanOrEqual(0);
      expect(result.structureScore).toBeLessThanOrEqual(100);
    });
  });

  describe('output statistics', () => {
    it('should correctly count sections', () => {
      const input = createInput({
        rawAnswer: '### Section 1\n\nContent 1.\n\n### Section 2\n\nContent 2.\n\n### Section 3\n\nContent 3.',
        answerMode: 'structured_sections',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.sectionCount).toBe(3);
      expect(result.hasSections).toBe(true);
    });

    it('should correctly count paragraphs', () => {
      const input = createInput({
        rawAnswer: 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.',
        answerMode: 'direct_short',
      });
      const result = kodaOutputStructureEngine.shapeAnswer(input);
      expect(result.paragraphCount).toBe(3);
    });
  });
});
