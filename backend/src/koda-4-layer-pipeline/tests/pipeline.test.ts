/**
 * ============================================================================
 * KODA ANSWER PIPELINE - INTEGRATION TESTS
 * ============================================================================
 *
 * Tests for the complete 4-layer pipeline orchestration:
 * - Full pipeline with different query types
 * - Quick format for streaming
 * - Performance timing
 * - Output structure validation
 *
 * @version 1.0.0
 * @date 2024-12-10
 */

import { kodaAnswerPipeline } from '../orchestrator/kodaAnswerPipeline';
import { PipelineInput, Source, PrimaryIntent, AnswerMode, Language } from '../types';

describe('KodaAnswerPipeline', () => {

  // Helper function to create standard input
  const createInput = (overrides: Partial<PipelineInput> = {}): PipelineInput => ({
    rawAnswer: 'This is a test answer with valid content.',
    query: 'What is the test?',
    primaryIntent: 'single_doc_factual' as PrimaryIntent,
    answerMode: 'direct_short' as AnswerMode,
    language: 'en' as Language,
    sources: [],
    options: {},
    ...overrides,
  });

  describe('processAnswer - meta queries', () => {
    it('should process meta query with bullet list mode', async () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'report.pdf' },
        { documentId: '2', filename: 'data.xlsx' },
      ];
      const input = createInput({
        rawAnswer: 'PDF files\nExcel files\nWord documents',
        query: 'What file types do I have?',
        primaryIntent: 'meta',
        answerMode: 'bullet_list',
        language: 'en',
        sources,
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.formatting).toBeDefined();
      expect(result.postProcessing).toBeDefined();
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should not add title for meta queries', async () => {
      const input = createInput({
        rawAnswer: 'You have 5 documents uploaded.',
        query: 'How many documents do I have?',
        primaryIntent: 'meta',
        answerMode: 'direct_short',
        language: 'en',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.structure.hasTitle).toBe(false);
    });
  });

  describe('processAnswer - comparison queries', () => {
    it('should process multi-doc comparison with structured sections', async () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'report_2023.pdf' },
        { documentId: '2', filename: 'report_2024.pdf' },
      ];
      const input = createInput({
        rawAnswer: 'In report_2023.pdf the revenue was R$ 1.000.000,00. In report_2024.pdf the revenue increased to R$ 1.500.000,00. This represents a 50% growth year over year.\n\nThe main factors contributing to this growth include new market expansion and improved product offerings.\n\nBased on this analysis, the company is on a strong growth trajectory.',
        query: 'Compare the revenue between 2023 and 2024 reports',
        primaryIntent: 'multi_doc_comparison',
        answerMode: 'structured_sections',
        language: 'en',
        sources,
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toBeDefined();
      expect(result.formatting.stats.boldingsApplied).toBeGreaterThan(0); // Currency bolded
      expect(result.formatting.stats.documentNamesFormatted).toBeGreaterThan(0); // Doc names bolded
    });

    it('should bold monetary values in comparison', async () => {
      const input = createInput({
        rawAnswer: 'Revenue: R$ 1.000.000,00 vs R$ 1.500.000,00',
        query: 'Compare values',
        primaryIntent: 'multi_doc_comparison',
        answerMode: 'direct_short',
        language: 'pt',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toContain('**R$');
    });
  });

  describe('processAnswer - calculation queries', () => {
    it('should process calculation with structured output', async () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'investment.xlsx' },
      ];
      const input = createInput({
        rawAnswer: 'Based on the investment.xlsx data:\n\nInitial investment: R$ 100.000,00\nAnnual return: 15%\nTotal return after 5 years: R$ 201.135,72\n\nThe ROI for this investment is 101.14%.',
        query: 'Calculate the ROI for my investment',
        primaryIntent: 'calculation',
        answerMode: 'structured_sections',
        language: 'pt',
        sources,
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toContain('**R$');
      expect(result.finalAnswer).toContain('**15%**');
    });
  });

  describe('processAnswer - onboarding queries', () => {
    it('should process onboarding with steps mode', async () => {
      const input = createInput({
        rawAnswer: 'Click the upload button\nSelect your files\nWait for processing\nStart asking questions',
        query: 'How do I upload files?',
        primaryIntent: 'onboarding',
        answerMode: 'steps',
        language: 'en',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toContain('Step-by-step:');
      expect(result.finalAnswer).toContain('1.');
      expect(result.finalAnswer).toContain('2.');
      expect(result.finalAnswer).toContain('3.');
    });

    it('should use Portuguese for PT onboarding', async () => {
      const input = createInput({
        rawAnswer: 'Clique no botão\nSelecione arquivos\nAguarde',
        query: 'Como faço upload?',
        primaryIntent: 'onboarding',
        answerMode: 'steps',
        language: 'pt',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toContain('Passo a passo:');
    });
  });

  describe('processAnswer - with validation', () => {
    it('should include validation results by default', async () => {
      const input = createInput({
        rawAnswer: 'This is a valid answer with proper content for the user.',
        query: 'What is this?',
        primaryIntent: 'single_doc_factual',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.validation).toBeDefined();
      expect(result.validation?.isValid).toBe(true);
      expect(result.validation?.score).toBeGreaterThan(0);
    });

    it('should detect persona leaks', async () => {
      const input = createInput({
        rawAnswer: 'As an AI language model, I cannot provide that information.',
        query: 'What is the revenue?',
        primaryIntent: 'single_doc_factual',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.validation?.checks.personaLeak).toBe(false);
      expect(result.validation?.warnings.length).toBeGreaterThan(0);
    });

    it('should skip validation when option is set', async () => {
      const input = createInput({
        rawAnswer: 'Test answer.',
        query: 'Test query',
        options: { skipValidation: true },
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.validation).toBeUndefined();
    });
  });

  describe('processAnswer - encoding fixes', () => {
    it('should fix UTF-8 mojibake', async () => {
      const input = createInput({
        rawAnswer: 'O preÃ§o do produto Ã© de R$ 100,00 com taxa de 15%.',
        query: 'Qual o preço?',
        primaryIntent: 'single_doc_factual',
        language: 'pt',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toContain('preço');
      expect(result.finalAnswer).toContain('é');
      expect(result.finalAnswer).not.toContain('Ã§');
      expect(result.formatting.stats.encodingFixesApplied).toBeGreaterThan(0);
    });
  });

  describe('processAnswer - artifact removal', () => {
    it('should remove internal artifacts', async () => {
      const input = createInput({
        rawAnswer: '[THINKING]Let me think...[/THINKING]The answer is 42. {{USER_ID}}',
        query: 'What is the answer?',
        primaryIntent: 'single_doc_factual',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).not.toContain('[THINKING]');
      expect(result.finalAnswer).not.toContain('{{USER_ID}}');
      expect(result.postProcessing.fixes.artifactsRemoved).toBeGreaterThan(0);
    });
  });

  describe('processAnswer - markdown fixes', () => {
    it('should fix unbalanced markdown', async () => {
      const input = createInput({
        rawAnswer: '**Bold without closing\n##Title without space',
        query: 'Test',
        primaryIntent: 'single_doc_factual',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      // Bold should be balanced
      const boldCount = (result.finalAnswer.match(/\*\*/g) || []).length;
      expect(boldCount % 2).toBe(0);

      // Heading should have space
      expect(result.finalAnswer).toContain('## Title');
      expect(result.postProcessing.fixes.markdownFixed).toBe(true);
    });
  });

  describe('processAnswer - performance', () => {
    it('should complete in reasonable time', async () => {
      const input = createInput({
        rawAnswer: 'A relatively long answer that contains multiple sentences and paragraphs to test the performance of the pipeline. This includes various formatting elements and potential issues that need to be processed.\n\nAnother paragraph with more content and details about the topic at hand.',
        query: 'Tell me about this topic',
        primaryIntent: 'single_doc_factual',
        answerMode: 'explanatory',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.totalTimeMs).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should return timing information', async () => {
      const input = createInput({
        rawAnswer: 'Test answer.',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(typeof result.totalTimeMs).toBe('number');
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processAnswer - output structure', () => {
    it('should return all required output fields', async () => {
      const input = createInput({
        rawAnswer: 'Test answer.',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result).toHaveProperty('finalAnswer');
      expect(result).toHaveProperty('structure');
      expect(result).toHaveProperty('formatting');
      expect(result).toHaveProperty('postProcessing');
      expect(result).toHaveProperty('totalTimeMs');
    });

    it('should include structure stats', async () => {
      const input = createInput({
        rawAnswer: 'Test answer.',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.structure).toHaveProperty('structuredText');
      expect(result.structure).toHaveProperty('hasTitle');
      expect(result.structure).toHaveProperty('hasSections');
      expect(result.structure).toHaveProperty('sectionCount');
      expect(result.structure).toHaveProperty('paragraphCount');
      expect(result.structure).toHaveProperty('structureScore');
    });

    it('should include formatting stats', async () => {
      const input = createInput({
        rawAnswer: 'Test answer.',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.formatting.stats).toHaveProperty('encodingFixesApplied');
      expect(result.formatting.stats).toHaveProperty('duplicatesRemoved');
      expect(result.formatting.stats).toHaveProperty('boldingsApplied');
      expect(result.formatting.stats).toHaveProperty('documentNamesFormatted');
    });

    it('should include post-processing stats', async () => {
      const input = createInput({
        rawAnswer: 'Test answer.',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.postProcessing.fixes).toHaveProperty('artifactsRemoved');
      expect(result.postProcessing.fixes).toHaveProperty('markdownFixed');
      expect(result.postProcessing.fixes).toHaveProperty('whitespaceNormalized');
    });
  });

  describe('quickFormat', () => {
    it('should fix basic encoding issues', () => {
      const result = kodaAnswerPipeline.quickFormat('PreÃ§o do produto');
      expect(result).toContain('Preço');
      expect(result).not.toContain('Ã§');
    });

    it('should fix multiple accent issues', () => {
      const result = kodaAnswerPipeline.quickFormat('InformaÃ§Ã£o sobre preÃ§o');
      expect(result).toContain('Informação');
      expect(result).toContain('preço');
    });

    it('should normalize line breaks', () => {
      const result = kodaAnswerPipeline.quickFormat('Line 1\r\nLine 2\rLine 3');
      expect(result).not.toContain('\r\n');
      expect(result).not.toContain('\r');
      expect(result).toContain('\n');
    });

    it('should be fast for streaming', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        kodaAnswerPipeline.quickFormat('Chunk of text with Ã§ and Ã£');
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 100 iterations in under 100ms
    });

    it('should handle empty input', () => {
      const result = kodaAnswerPipeline.quickFormat('');
      expect(result).toBe('');
    });

    it('should handle clean input', () => {
      const result = kodaAnswerPipeline.quickFormat('Clean text without issues');
      expect(result).toBe('Clean text without issues');
    });
  });

  describe('edge cases', () => {
    it('should handle empty answer', async () => {
      const input = createInput({
        rawAnswer: '',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toBeDefined();
    });

    it('should handle very long answer', async () => {
      const longAnswer = 'A'.repeat(10000);
      const input = createInput({
        rawAnswer: longAnswer,
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toBeDefined();
      expect(result.totalTimeMs).toBeLessThan(5000);
    });

    it('should handle special characters', async () => {
      const input = createInput({
        rawAnswer: 'Special chars: <>&"\'`~!@#$%^&*()_+[]{}|;:,.<>?/\\',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const input = createInput({
        rawAnswer: 'Unicode: 你好 مرحبا שלום こんにちは 🎉',
        query: 'Test',
      });

      const result = await kodaAnswerPipeline.processAnswer(input);

      expect(result.finalAnswer).toContain('你好');
      expect(result.finalAnswer).toContain('🎉');
    });
  });
});
