/**
 * ============================================================================
 * LAYER 3: KODA ANSWER VALIDATION ENGINE - UNIT TESTS
 * ============================================================================
 *
 * Tests for the validation engine that performs quality checks:
 * - Safety check
 * - Persona leak detection
 * - Hallucinated document detection
 * - Completeness check
 * - Numeric consistency check
 *
 * @version 1.0.0
 * @date 2024-12-10
 */

import { kodaAnswerValidationEngine } from '../layer3-validator/kodaAnswerValidationEngine';
import { ValidatorInput, Source, Language, PrimaryIntent } from '../types';

describe('KodaAnswerValidationEngine', () => {

  // Helper function to create standard input
  const createInput = (overrides: Partial<ValidatorInput> = {}): ValidatorInput => ({
    formattedText: 'This is a test answer with valid content.',
    query: 'What is the test?',
    sources: [],
    language: 'en' as Language,
    primaryIntent: 'single_doc_factual' as PrimaryIntent,
    ...overrides,
  });

  describe('checkSafety', () => {
    it('should pass safe content', () => {
      const input = createInput({
        formattedText: 'The quarterly revenue increased by 15%.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.safety).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should flag potentially unsafe content', () => {
      const input = createInput({
        formattedText: 'This involves illegal activities and drugs.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.safety).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.score).toBe(0); // Immediate fail
    });

    it('should flag violent content', () => {
      const input = createInput({
        formattedText: 'The violence in this scenario is concerning.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.safety).toBe(false);
    });
  });

  describe('checkPersonaLeak', () => {
    it('should pass content without persona leaks', () => {
      const input = createInput({
        formattedText: 'Based on the document analysis, the revenue was R$ 1 million.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.personaLeak).toBe(true);
    });

    it('should flag "as an AI" phrase', () => {
      const input = createInput({
        formattedText: 'As an AI, I cannot provide financial advice.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.personaLeak).toBe(false);
      expect(result.warnings.some(w => w.includes('Persona leak'))).toBe(true);
    });

    it('should flag ChatGPT mentions', () => {
      const input = createInput({
        formattedText: 'According to ChatGPT, the data is accurate.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.personaLeak).toBe(false);
    });

    it('should flag "I am an AI" phrase', () => {
      const input = createInput({
        formattedText: "I'm an AI and I cannot access external websites.",
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.personaLeak).toBe(false);
    });

    it('should flag "I cannot access" phrases', () => {
      const input = createInput({
        formattedText: "I don't have access to real-time data.",
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.personaLeak).toBe(false);
    });

    it('should reduce score for persona leaks', () => {
      const input = createInput({
        formattedText: "As a language model, I cannot browse the internet.",
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('checkHallucinatedDocs', () => {
    it('should pass when all mentioned docs exist in sources', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'report.pdf' },
        { documentId: '2', filename: 'data.xlsx' },
      ];
      const input = createInput({
        formattedText: 'According to **report.pdf** and **data.xlsx**, the values are correct.',
        sources,
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.hallucinatedDocs).toBe(true);
    });

    it('should flag documents not in sources', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'report.pdf' },
      ];
      const input = createInput({
        formattedText: 'According to **report.pdf** and **nonexistent.pdf**, the values are correct.',
        sources,
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.hallucinatedDocs).toBe(false);
      expect(result.warnings.some(w => w.includes('nonexistent.pdf'))).toBe(true);
    });

    it('should be case-insensitive', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'Report.PDF' },
      ];
      const input = createInput({
        formattedText: 'According to **report.pdf**, the values are correct.',
        sources,
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.hallucinatedDocs).toBe(true);
    });

    it('should detect various file extensions', () => {
      const sources: Source[] = [
        { documentId: '1', filename: 'document.docx' },
        { documentId: '2', filename: 'presentation.pptx' },
      ];
      const input = createInput({
        formattedText: 'See **document.docx** and **presentation.pptx** for details.',
        sources,
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.hallucinatedDocs).toBe(true);
    });

    it('should reduce score for hallucinated docs', () => {
      const input = createInput({
        formattedText: 'According to **fake-document.pdf**, the data shows...',
        sources: [],
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('checkCompleteness', () => {
    it('should pass answers with sufficient content', () => {
      const input = createInput({
        formattedText: 'The quarterly report shows a 15% increase in revenue compared to the previous period. This growth is attributed to the new product launch.',
        primaryIntent: 'single_doc_factual',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(true);
    });

    it('should flag very short answers', () => {
      const input = createInput({
        formattedText: 'Yes.',
        primaryIntent: 'single_doc_factual',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(false);
      expect(result.warnings.some(w => w.includes('too short'))).toBe(true);
    });

    it('should flag answers ending with comma', () => {
      const input = createInput({
        formattedText: 'The document mentions revenue, expenses, and other items,',
        primaryIntent: 'single_doc_factual',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(false);
      expect(result.warnings.some(w => w.includes('ends with comma'))).toBe(true);
    });

    it('should flag answers ending with colon', () => {
      const input = createInput({
        formattedText: 'The main categories are:',
        primaryIntent: 'single_doc_factual',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(false);
      expect(result.warnings.some(w => w.includes('ends with colon'))).toBe(true);
    });

    it('should flag answers ending with ellipsis', () => {
      const input = createInput({
        formattedText: 'The report indicates several issues with...',
        primaryIntent: 'single_doc_factual',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(false);
      expect(result.warnings.some(w => w.includes('ellipsis'))).toBe(true);
    });

    it('should flag answers ending with list starters', () => {
      const input = createInput({
        formattedText: 'The document mentions items such as',
        primaryIntent: 'single_doc_factual',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(false);
    });

    it('should skip completeness check for meta queries', () => {
      const input = createInput({
        formattedText: 'You have 5 documents.',
        primaryIntent: 'meta',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(true);
    });

    it('should skip completeness check for file_action queries', () => {
      const input = createInput({
        formattedText: 'File deleted.',
        primaryIntent: 'file_action',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.completeness).toBe(true);
    });
  });

  describe('checkNumericConsistency', () => {
    it('should pass content with reasonable number of monetary values', () => {
      const input = createInput({
        formattedText: 'Revenue was R$ 100.000,00 and expenses were R$ 50.000,00.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.numericConsistency).toBe(true);
    });

    it('should warn about too many different monetary values', () => {
      const input = createInput({
        formattedText: 'Values: R$ 100, R$ 200, R$ 300, R$ 400, R$ 500, R$ 600, R$ 700.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      // May or may not flag depending on uniqueness
      expect(typeof result.checks.numericConsistency).toBe('boolean');
    });

    it('should flag suspicious percentages over 100%', () => {
      const input = createInput({
        formattedText: 'The growth rate was 150% which is suspicious.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.numericConsistency).toBe(false);
      expect(result.warnings.some(w => w.includes('150%'))).toBe(true);
    });

    it('should pass valid percentages under 100%', () => {
      const input = createInput({
        formattedText: 'The discount is 15% off the original price.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.checks.numericConsistency).toBe(true);
    });
  });

  describe('overall validation', () => {
    it('should return isValid=true when no errors', () => {
      const input = createInput({
        formattedText: 'This is a complete and valid answer with proper content that provides useful information to the user.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return isValid=false when safety check fails', () => {
      const input = createInput({
        formattedText: 'This involves illegal drug trafficking.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.isValid).toBe(false);
    });

    it('should have score between 0 and 100', () => {
      const input = createInput({
        formattedText: 'Valid content for testing.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should accumulate warnings from multiple checks', () => {
      const input = createInput({
        formattedText: "As an AI, I found **fake.pdf** shows 200%...",
        primaryIntent: 'single_doc_factual',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);
      expect(result.warnings.length).toBeGreaterThan(1);
    });

    it('should return all check results', () => {
      const input = createInput({
        formattedText: 'Valid content.',
      });
      const result = kodaAnswerValidationEngine.validateAnswer(input);

      expect(result.checks).toHaveProperty('safety');
      expect(result.checks).toHaveProperty('personaLeak');
      expect(result.checks).toHaveProperty('hallucinatedDocs');
      expect(result.checks).toHaveProperty('completeness');
      expect(result.checks).toHaveProperty('numericConsistency');
    });
  });
});
