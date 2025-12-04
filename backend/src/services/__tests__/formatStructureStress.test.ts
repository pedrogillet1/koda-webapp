/**
 * Format Structure Stress Tests
 *
 * Tests format enforcement rules under stress conditions with various
 * real-world response patterns. Uses FormatEnforcementService for validation.
 */

import formatEnforcement, { FormatViolation, FormatValidationResult } from '../formatEnforcement.service';

interface ExpectedFixes {
  noEmojis?: boolean;
  noCitations?: boolean;
  normalizedBullets?: boolean;
  maxIntroLines?: number;
  noEmptyBullets?: boolean;
  noParagraphsAfterBullets?: boolean;
  autoBoldedValues?: boolean;
  itemsSplitProperly?: boolean;
  bracketsPreserved?: boolean;
  portugueseCitationRemoved?: boolean;
  spanishCitationRemoved?: boolean;
  englishCitationRemoved?: boolean;
  nextActionsFormatted?: boolean;
  nextActionsPreserved?: boolean;
  headerNormalized?: boolean;
  unicode12EmojisRemoved?: boolean;
  hasTable?: boolean;
  itemsSplit?: boolean;
  maxItemsPerLine?: number;
  shortBulletPeriodsRemoved?: boolean;
  longBulletPeriodPreserved?: boolean;
}

interface StressTestCase {
  name: string;
  input: string;
  expectedFixes: ExpectedFixes;
}

describe('FormatEnforcementService Stress Tests', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST DATA - Complex real-world response patterns
  // ═══════════════════════════════════════════════════════════════════════════

  const stressTestCases: StressTestCase[] = [
    {
      name: 'Response with all violation types',
      input: `😀 Here is a comprehensive analysis. According to page 5, the data shows growth. This is a third line of intro that is too long.

- Revenue was $1,234,567.89 (up 45.5%)
* Key file: Report_2024.pdf shows the data
• Multiple items: A, B, C, D, E, F, G
• Empty bullet below
•
• Another item

This paragraph after bullets should be removed.`,
      expectedFixes: {
        noEmojis: true,
        noCitations: true,
        normalizedBullets: true,
        maxIntroLines: 2,
        noEmptyBullets: true,
        noParagraphsAfterBullets: true,
        autoBoldedValues: true
      }
    },
    {
      name: 'Complex nested brackets in bullets',
      input: `Summary of data analysis:

• Item with (nested [brackets, more], data), second part
• File **Report.pdf** (contains {key: value, other: data}), description
• Multiple values: $100, $200, $300, $400, $500`,
      expectedFixes: {
        itemsSplitProperly: true,
        bracketsPreserved: true
      }
    },
    {
      name: 'Multilingual citations',
      input: `De acordo com a página 5, os dados mostram crescimento.
Según el documento 3, hay aumento.
According to page 7, the metrics improved.

• Item 1
• Item 2`,
      expectedFixes: {
        portugueseCitationRemoved: true,
        spanishCitationRemoved: true,
        englishCitationRemoved: true
      }
    },
    {
      name: 'Response with Next actions section',
      input: `Summary of findings:

• Finding 1 with $500 value
• Finding 2 with 25% increase

Next actions:

• Review data
• Update report`,
      expectedFixes: {
        nextActionsPreserved: true
      }
    },
    {
      name: 'Unicode 12.0+ emojis',
      input: `Here is the summary 🥱🤿🪐🦩🩸:

• Item 1
• Item 2`,
      expectedFixes: {
        unicode12EmojisRemoved: true
      }
    },
    {
      name: 'Table with formatting issues',
      input: `Data comparison:

| Name | Value | Status
|---|---|---
| Item1 | $100 | Active
| Item2 | $200 |`,
      expectedFixes: {
        hasTable: true
      }
    },
    {
      name: 'Many items per line requiring split',
      input: `Document overview:

• File1.pdf, File2.xlsx, File3.docx, File4.pptx, File5.csv, File6.txt
• Another bullet point`,
      expectedFixes: {
        itemsSplit: true,
        maxItemsPerLine: 3
      }
    },
    {
      name: 'Trailing periods on short bullets',
      input: `Quick summary:

• Short item.
• Another short one.
• This is a longer bullet point that has more content and context.`,
      expectedFixes: {
        shortBulletPeriodsRemoved: true,
        longBulletPeriodPreserved: true
      }
    }
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // STRESS TEST SUITE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Complex Response Processing', () => {
    test.each(stressTestCases)('$name', ({ input, expectedFixes }) => {
      const result = formatEnforcement.enforceFormat(input);

      // Core validations
      expect(result.fixedText).toBeDefined();

      // Check for emojis removed
      if (expectedFixes.noEmojis) {
        expect(formatEnforcement.hasEmojis(result.fixedText!)).toBe(false);
      }

      // Check for citations removed
      if (expectedFixes.noCitations || expectedFixes.englishCitationRemoved) {
        expect(result.fixedText).not.toMatch(/According to/i);
      }
      if (expectedFixes.portugueseCitationRemoved) {
        expect(result.fixedText).not.toMatch(/De acordo com/i);
      }
      if (expectedFixes.spanishCitationRemoved) {
        expect(result.fixedText).not.toMatch(/Según/i);
      }

      // Check for normalized bullets
      if (expectedFixes.normalizedBullets) {
        expect(result.fixedText).not.toMatch(/^- /m);
        expect(result.fixedText).not.toMatch(/^\* /m);
      }

      // Check no empty bullets
      if (expectedFixes.noEmptyBullets) {
        expect(result.fixedText).not.toMatch(/•\s*\n/);
      }

      // Check no paragraphs after bullets
      if (expectedFixes.noParagraphsAfterBullets) {
        // After last bullet, should only be whitespace or Next actions
        const lastBulletIndex = result.fixedText!.lastIndexOf('•');
        const bulletLine = result.fixedText!.substring(lastBulletIndex).split('\n')[0];
        const afterBullet = result.fixedText!.substring(lastBulletIndex + bulletLine.length).trim();
        expect(afterBullet === '' || afterBullet.startsWith('Next actions')).toBe(true);
      }

      // Check auto-bolded values
      if (expectedFixes.autoBoldedValues) {
        expect(result.fixedText).toMatch(/\*\*\$[\d,]+\.?\d*\*\*/);
        expect(result.fixedText).toMatch(/\*\*\d+\.?\d*%\*\*/);
      }

      // Check Next actions formatting
      if (expectedFixes.nextActionsFormatted || expectedFixes.nextActionsPreserved) {
        expect(result.fixedText).toContain('Next actions:');
      }
      if (expectedFixes.headerNormalized) {
        expect(result.fixedText).not.toContain('Next steps:');
      }

      // Check Unicode 12.0+ emojis removed
      if (expectedFixes.unicode12EmojisRemoved) {
        expect(result.fixedText).not.toContain('🥱');
        expect(result.fixedText).not.toContain('🤿');
        expect(result.fixedText).not.toContain('🪐');
        expect(result.fixedText).not.toContain('🦩');
        expect(result.fixedText).not.toContain('🩸');
      }

      // Check table detection
      if (expectedFixes.hasTable) {
        expect(formatEnforcement.hasTable(result.fixedText!)).toBe(true);
      }

      // Check items split properly
      if (expectedFixes.itemsSplit || expectedFixes.maxItemsPerLine) {
        const bulletLines = result.fixedText!.split('\n').filter(l => l.trim().startsWith('•'));
        // Each bullet should have at most 3 items (commas + 1)
        for (const line of bulletLines) {
          const commaCount = (line.match(/,/g) || []).length;
          expect(commaCount).toBeLessThanOrEqual(2); // 3 items max = 2 commas
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    test('should handle empty input', () => {
      const result = formatEnforcement.enforceFormat('');
      expect(result.fixedText).toBe('');
      expect(result.isValid).toBe(true);
    });

    test('should handle input with only whitespace', () => {
      const result = formatEnforcement.enforceFormat('   \n\n   \t   ');
      expect(result.fixedText!.trim()).toBe('');
    });

    test('should handle input with only emojis', () => {
      const result = formatEnforcement.enforceFormat('😀 🎉 🚀');
      expect(result.fixedText!.trim()).toBe('');
    });

    test('should handle very long bullet line', () => {
      const longItem = 'A'.repeat(500);
      const input = `Summary:\n\n• ${longItem}`;
      const result = formatEnforcement.enforceFormat(input);
      expect(result.fixedText).toContain(longItem);
    });

    test('should handle deeply nested brackets', () => {
      const input = `Summary:\n\n• Item with ((nested (brackets))), more content\n• Another item`;
      const result = formatEnforcement.enforceFormat(input);
      expect(result.fixedText).toContain('((nested (brackets)))');
    });

    test('should handle mixed bracket types', () => {
      const input = `Summary:\n\n• Data (contains [key: {value, other}]), end\n• Another item`;
      const result = formatEnforcement.enforceFormat(input);
      expect(result.fixedText).toContain('[key: {value, other}]');
    });

    test('should preserve markdown links', () => {
      const input = `Summary:\n\n• See [documentation](https://example.com) for details\n• Another item`;
      const result = formatEnforcement.enforceFormat(input);
      expect(result.fixedText).toContain('[documentation](https://example.com)');
    });

    test('should preserve code blocks', () => {
      const input = `Summary:\n\n• Code: \`const x = 1;\`\n• Another item`;
      const result = formatEnforcement.enforceFormat(input);
      expect(result.fixedText).toContain('`const x = 1;`');
    });

    test('should handle input with only one bullet', () => {
      const input = `Here is the summary:\n\n• Single bullet item`;
      const result = formatEnforcement.enforceFormat(input);
      expect(result.fixedText).toContain('• Single bullet item');
    });

    test('should handle bullets without intro', () => {
      const input = `• Item 1\n• Item 2\n• Item 3`;
      const result = formatEnforcement.enforceFormat(input);
      // Should warn about missing intro but still process
      const hasWarning = result.violations.some(v => v.type === 'missing_intro');
      expect(hasWarning).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE STRESS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Performance Under Load', () => {
    test('should process 100 responses in under 1 second', () => {
      const testInput = `Here is a summary 😀. According to page 5:

- Item 1 with $100
* Item 2 with 50%
• Item 3, Item 4, Item 5, Item 6

Extra paragraph.`;

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        formatEnforcement.enforceFormat(testInput);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1000); // 1 second
      console.log(`[Performance] 100 iterations in ${totalTime.toFixed(2)}ms (avg: ${(totalTime / 100).toFixed(2)}ms)`);
    });

    test('should handle very large text efficiently', () => {
      // Generate large text with 50 bullet points
      const bullets = Array.from({ length: 50 }, (_, i) =>
        `• Item ${i + 1} with value $${i * 100} and ${i}% increase`
      ).join('\n');
      const largeInput = `Large document analysis summary:\n\n${bullets}`;

      const startTime = performance.now();
      const result = formatEnforcement.enforceFormat(largeInput);
      const endTime = performance.now();

      expect(result.fixedText).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      console.log(`[Performance] Large text (50 bullets) processed in ${(endTime - startTime).toFixed(2)}ms`);
    });

    test('should handle text with many emojis efficiently', () => {
      const emojis = '😀🎉🚀💡🔥⭐✨💪🙌👍'.repeat(50);
      const input = `${emojis}\n\nHere is the summary:\n\n• Item 1\n• Item 2`;

      const startTime = performance.now();
      const result = formatEnforcement.enforceFormat(input);
      const endTime = performance.now();

      expect(formatEnforcement.hasEmojis(result.fixedText!)).toBe(false);
      expect(endTime - startTime).toBeLessThan(50);
      console.log(`[Performance] Many emojis removed in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION STRESS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Configuration Variations', () => {
    test('should respect maxItemsPerLine override', () => {
      // Use 9 items to clearly show differences between configurations
      const input = `Summary:\n\n• A, B, C, D, E, F, G, H, I\n• Another bullet`;

      // Default (3 items) - 9 items = 3 bullets + 1 existing = 4 bullets
      const result3 = formatEnforcement.enforceFormat(input, { maxItemsPerLine: 3 });
      const bullets3 = result3.fixedText!.split('\n').filter(l => l.trim().startsWith('•'));
      expect(bullets3.length).toBe(4); // 3 from split (3+3+3) + 1 existing

      // Override to 2 items - 9 items = 5 bullets + 1 existing = 6 bullets
      const result2 = formatEnforcement.enforceFormat(input, { maxItemsPerLine: 2 });
      const bullets2 = result2.fixedText!.split('\n').filter(l => l.trim().startsWith('•'));
      expect(bullets2.length).toBeGreaterThan(bullets3.length);

      // Override to 5 items - 9 items = 2 bullets + 1 existing = 3 bullets
      const result5 = formatEnforcement.enforceFormat(input, { maxItemsPerLine: 5 });
      const bullets5 = result5.fixedText!.split('\n').filter(l => l.trim().startsWith('•'));
      expect(bullets5.length).toBeLessThan(bullets3.length);
    });

    test('should respect maxIntroLines override', () => {
      const input = `Line 1
Line 2
Line 3
Line 4

• Item 1
• Item 2`;

      // Default (2 lines)
      const result2 = formatEnforcement.enforceFormat(input, { maxIntroLines: 2 });
      const intro2 = result2.fixedText!.split('•')[0].trim();
      const lines2 = intro2.split('\n').filter(l => l.trim()).length;
      expect(lines2).toBe(2);

      // Override to 3 lines
      const result3 = formatEnforcement.enforceFormat(input, { maxIntroLines: 3 });
      const intro3 = result3.fixedText!.split('•')[0].trim();
      const lines3 = intro3.split('\n').filter(l => l.trim()).length;
      expect(lines3).toBe(3);
    });

    test('should disable emoji removal when configured', () => {
      const input = `Summary 😀:\n\n• Item 1\n• Item 2`;
      const result = formatEnforcement.enforceFormat(input, { removeEmojis: false });
      expect(result.fixedText).toContain('😀');
    });

    test('should disable citation removal when configured', () => {
      const input = `According to page 5, the data shows:\n\n• Item 1\n• Item 2`;
      const result = formatEnforcement.enforceFormat(input, { removeCitations: false });
      expect(result.fixedText).toContain('According to page 5');
    });

    test('should disable auto-bold when configured', () => {
      const input = `Summary:\n\n• Revenue: $1,234 (25% growth)\n• Another item`;
      const result = formatEnforcement.enforceFormat(input, { autoBoldValues: false });
      expect(result.fixedText).not.toContain('**$1,234**');
      expect(result.fixedText).toContain('$1,234');
    });

    test('should use custom bullet character', () => {
      const input = `Summary:\n\n- Item 1\n- Item 2`;
      const result = formatEnforcement.enforceFormat(input, { standardBulletChar: '▸' });
      expect(result.fixedText).toContain('▸ Item 1');
      expect(result.fixedText).not.toContain('- Item 1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VIOLATION TRACKING TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Violation Detection and Reporting', () => {
    test('should report all violation types', () => {
      const input = `😀 According to page 5, here is line one.
Line two.
Line three.
Line four.

- Item with $100
* Item 2
•
• Short item.

Extra paragraph.`;

      const result = formatEnforcement.enforceFormat(input);

      const violationTypes = result.violations.map(v => v.type);

      // Should detect emoji
      expect(violationTypes).toContain('emoji');

      // Should detect citations
      expect(violationTypes).toContain('citations');

      // Should detect bullet style normalization
      expect(violationTypes).toContain('bullet_style_normalized');

      // Should detect intro length
      expect(violationTypes).toContain('intro_length');

      // Should detect paragraphs after bullets
      expect(violationTypes).toContain('paragraphs_after_bullets');
    });

    test('should distinguish error vs warning severity', () => {
      const input = `😀 Summary:\n\n• Item with $100\n• Item 2`;
      const result = formatEnforcement.enforceFormat(input);

      const errors = result.violations.filter(v => v.severity === 'error');
      const warnings = result.violations.filter(v => v.severity === 'warning');

      // Emoji should be error
      expect(errors.some(v => v.type === 'emoji')).toBe(true);

      // Auto-bold applied should be warning
      expect(warnings.some(v => v.type === 'auto_bold_applied')).toBe(true);
    });

    test('should report valid when no errors', () => {
      const input = `Here is a clean summary:

• Item 1 with **$100** value
• Item 2 with **25%** increase`;

      const result = formatEnforcement.enforceFormat(input);

      // May have warnings but no errors
      const errors = result.violations.filter(v => v.severity === 'error');
      expect(errors.length).toBe(0);
      expect(result.isValid).toBe(true);
    });
  });
});
