/**
 * ============================================================================
 * LAYER 4: KODA UNIFIED POST-PROCESSOR - UNIT TESTS
 * ============================================================================
 *
 * Tests for the post-processor that provides final polish:
 * - Strip internal artifacts
 * - Fix unbalanced markdown
 * - Normalize final whitespace
 *
 * @version 1.0.0
 * @date 2024-12-10
 */

import { kodaUnifiedPostProcessor } from '../layer4-postprocessor/kodaUnifiedPostProcessor';
import { PostProcessorInput } from '../types';

describe('KodaUnifiedPostProcessor', () => {

  // Helper function to create standard input
  const createInput = (text: string): PostProcessorInput => ({
    formattedText: text,
  });

  describe('stripArtifacts', () => {
    it('should remove [THINKING] blocks', () => {
      const input = createInput(
        'Before [THINKING]internal thoughts here[/THINKING] After'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('[THINKING]');
      expect(result.finalText).not.toContain('[/THINKING]');
      expect(result.finalText).not.toContain('internal thoughts');
      expect(result.fixes.artifactsRemoved).toBeGreaterThan(0);
    });

    it('should remove [SYSTEM] blocks', () => {
      const input = createInput(
        'Content [SYSTEM]system message[/SYSTEM] more content'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('[SYSTEM]');
      expect(result.finalText).not.toContain('system message');
    });

    it('should remove [DEBUG] blocks', () => {
      const input = createInput(
        'Content [DEBUG]debug info[/DEBUG] more content'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('[DEBUG]');
    });

    it('should remove [INTERNAL] blocks', () => {
      const input = createInput(
        'Content [INTERNAL]internal data[/INTERNAL] more content'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('[INTERNAL]');
    });

    it('should remove [METADATA] blocks', () => {
      const input = createInput(
        'Content [METADATA]meta info[/METADATA] more content'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('[METADATA]');
    });

    it('should remove [CONTEXT] blocks', () => {
      const input = createInput(
        'Content [CONTEXT]context info[/CONTEXT] more content'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('[CONTEXT]');
    });

    it('should remove {{PLACEHOLDER}} style artifacts', () => {
      const input = createInput(
        'The value is {{USER_NAME}} and {{DOCUMENT_ID}}'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('{{USER_NAME}}');
      expect(result.finalText).not.toContain('{{DOCUMENT_ID}}');
      expect(result.fixes.artifactsRemoved).toBe(2);
    });

    it('should handle multiline artifact blocks', () => {
      const input = createInput(
        'Content [THINKING]\nline 1\nline 2\nline 3\n[/THINKING] more'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('line 1');
      expect(result.finalText).not.toContain('line 2');
    });

    it('should count all removed artifacts', () => {
      const input = createInput(
        '[THINKING]thought[/THINKING] {{PLACEHOLDER}} [DEBUG]debug[/DEBUG]'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.fixes.artifactsRemoved).toBe(3);
    });
  });

  describe('fixUnbalancedMarkdown', () => {
    it('should fix unbalanced bold markers', () => {
      const input = createInput('This is **bold text without closing');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      const boldCount = (result.finalText.match(/\*\*/g) || []).length;
      expect(boldCount % 2).toBe(0);
      expect(result.fixes.markdownFixed).toBe(true);
    });

    it('should not modify balanced bold markers', () => {
      const input = createInput('This is **bold** text');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toContain('**bold**');
    });

    it('should fix unbalanced code fences', () => {
      const input = createInput('```javascript\ncode here\n');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      const fenceCount = (result.finalText.match(/```/g) || []).length;
      expect(fenceCount % 2).toBe(0);
      expect(result.fixes.markdownFixed).toBe(true);
    });

    it('should not modify balanced code fences', () => {
      const input = createInput('```javascript\ncode\n```');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toContain('```javascript');
      expect(result.finalText).toMatch(/```\n?$/);
    });

    it('should fix unbalanced inline code per line', () => {
      const input = createInput('Use the `command without closing\nNext line');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      // Should fix per line
      const lines = result.finalText.split('\n');
      for (const line of lines) {
        const backtickCount = (line.match(/`/g) || []).length;
        expect(backtickCount % 2).toBe(0);
      }
    });

    it('should fix heading spacing: ##Title → ## Title', () => {
      const input = createInput('##Heading without space');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toContain('## Heading');
      expect(result.fixes.markdownFixed).toBe(true);
    });

    it('should fix various heading levels', () => {
      const input = createInput('#H1\n##H2\n###H3');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toContain('# H1');
      expect(result.finalText).toContain('## H2');
      expect(result.finalText).toContain('### H3');
    });

    it('should fix bullet spacing: -text → - text', () => {
      const input = createInput('-Item without space\n*Another item');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toContain('- Item');
      expect(result.finalText).toContain('* Another');
    });

    it('should fix bullet points: •text → • text', () => {
      const input = createInput('•Item without space');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toContain('• Item');
    });

    it('should remove quadruple bold markers', () => {
      const input = createInput('This has ****excessive**** bold');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('****');
      expect(result.fixes.markdownFixed).toBe(true);
    });

    it('should handle multiple markdown issues', () => {
      const input = createInput('##Title\n**bold\n-item');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toContain('## Title');
      expect(result.finalText).toContain('- item');
      expect(result.fixes.markdownFixed).toBe(true);
    });
  });

  describe('normalizeFinalWhitespace', () => {
    it('should convert CRLF to LF', () => {
      const input = createInput('Line 1\r\nLine 2\r\nLine 3');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('\r');
    });

    it('should collapse 3+ blank lines to 2', () => {
      const input = createInput('Para 1\n\n\n\nPara 2');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toContain('\n\n\n');
    });

    it('should trim trailing spaces on lines', () => {
      const input = createInput('Line with spaces   \nAnother   ');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).not.toMatch(/[ ]+\n/);
    });

    it('should ensure text ends with exactly one newline', () => {
      const input = createInput('Content without newline');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText.endsWith('\n')).toBe(true);
      expect(result.finalText.endsWith('\n\n')).toBe(false);
    });

    it('should trim leading whitespace', () => {
      const input = createInput('\n\n  Content with leading space');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText.startsWith('Content')).toBe(true);
    });

    it('should always set whitespaceNormalized to true', () => {
      const input = createInput('Any content');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.fixes.whitespaceNormalized).toBe(true);
    });
  });

  describe('complete post-processing', () => {
    it('should handle clean input without changes', () => {
      const input = createInput('Clean text with proper formatting.');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText.trim()).toBe('Clean text with proper formatting.');
      expect(result.fixes.artifactsRemoved).toBe(0);
    });

    it('should handle complex input with multiple issues', () => {
      const input = createInput(
        '[THINKING]thought[/THINKING]\r\n##Title\n\n\n\n**bold\n-item\n{{PLACEHOLDER}}'
      );
      const result = kodaUnifiedPostProcessor.postProcess(input);

      // Artifacts removed
      expect(result.finalText).not.toContain('[THINKING]');
      expect(result.finalText).not.toContain('{{PLACEHOLDER}}');

      // Markdown fixed
      expect(result.finalText).toContain('## Title');
      expect(result.finalText).toContain('- item');

      // Whitespace normalized
      expect(result.finalText).not.toContain('\r');
      expect(result.finalText).not.toContain('\n\n\n');
      expect(result.finalText.endsWith('\n')).toBe(true);
    });

    it('should return all fix stats', () => {
      const input = createInput('Any content');
      const result = kodaUnifiedPostProcessor.postProcess(input);

      expect(result.fixes).toHaveProperty('artifactsRemoved');
      expect(result.fixes).toHaveProperty('markdownFixed');
      expect(result.fixes).toHaveProperty('whitespaceNormalized');
    });

    it('should return finalText in output', () => {
      const input = createInput('Test content');
      const result = kodaUnifiedPostProcessor.postProcess(input);
      expect(result.finalText).toBeDefined();
      expect(typeof result.finalText).toBe('string');
    });
  });
});
