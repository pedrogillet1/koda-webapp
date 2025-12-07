/**
 * ResponseFormatter Integration Tests
 * Tests the integration between ResponseFormatterService and FormatEnforcementService
 */

import { ResponseFormatterService } from '../responseFormatter.service';
import formatEnforcement from '../formatEnforcement.service';

describe('ResponseFormatterService Integration', () => {
  let service: ResponseFormatterService;

  const mockContext = {
    queryLength: 50,
    documentCount: 1,
    intentType: 'factual',
    chunks: [],
    hasFinancialData: false
  };

  beforeEach(() => {
    service = new ResponseFormatterService();
  });

  describe('formatResponse - Format Enforcement Integration', () => {
    test('should remove emojis through FormatEnforcementService', async () => {
      const input = 'Here is a summary 😀\n\n• Item 1\n• Item 2';
      const result = await service.formatResponse(input, mockContext, []);

      expect(result).not.toContain('😀');
      expect(result).toContain('• Item 1');
    });

    test('should normalize bullet styles through FormatEnforcementService', async () => {
      const input = 'Summary:\n\n- Item 1\n- Item 2\n* Item 3';
      const result = await service.formatResponse(input, mockContext, []);

      expect(result).toContain('• Item 1');
      expect(result).toContain('• Item 2');
      expect(result).toContain('• Item 3');
      expect(result).not.toContain('- Item');
      expect(result).not.toContain('* Item');
    });

    test('should auto-bold monetary values through FormatEnforcementService', async () => {
      const input = 'Summary:\n\n• Revenue: $1,234.56\n• Growth: 45%';
      const result = await service.formatResponse(input, mockContext, []);

      expect(result).toContain('**$1,234.56**');
      expect(result).toContain('**45%**');
    });

    test('should remove citations through FormatEnforcementService', async () => {
      const input = 'According to page 5, the data shows:\n\n• Item 1\n• Item 2';
      const result = await service.formatResponse(input, mockContext, []);

      expect(result).not.toContain('According to page 5');
      expect(result).toContain('• Item 1');
    });

    test('should enforce max items per line through FormatEnforcementService', async () => {
      // Need 2+ bullets for the rule to apply
      const input = 'Summary:\n\n• A, B, C, D, E, F\n• Another bullet';
      const result = await service.formatResponse(input, mockContext, []);

      // Should split the 6 items into multiple bullets
      const bulletCount = (result.match(/•/g) || []).length;
      expect(bulletCount).toBeGreaterThan(2);
    });

    test('should format Next actions section through FormatEnforcementService', async () => {
      // Next actions section at the end should be preserved
      const input = 'Summary:\n\n• Item 1\n• Item 2\n\nNext steps:\n\n• Action 1\n• Action 2';
      const result = await service.formatResponse(input, mockContext, []);

      // Next steps should be normalized to Next actions
      expect(result).toContain('Next actions:');
    });

    test('should clean whitespace through FormatEnforcementService', async () => {
      const input = 'Summary:\n\n\n\n• Item 1\n\n\n• Item 2';
      const result = await service.formatResponse(input, mockContext, []);

      // Should not have more than 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
    });
  });

  describe('formatResponse - Table Conversion', () => {
    test('should convert ASCII tables to Markdown', async () => {
      const input = `Summary:

Aspect    Value1    Value2
──────────────────────────
Row1      Data1     Data2`;

      const result = await service.formatResponse(input, mockContext, []);

      // Should contain Markdown table format
      expect(result).toContain('|');
      expect(result).toContain('---');
    });

    test('should convert plain text tables to Markdown', async () => {
      const input = `Summary:

Name      Age    City
John      25     NYC
Jane      30     LA`;

      const result = await service.formatResponse(input, mockContext, []);

      // Should contain Markdown table format
      expect(result).toContain('|');
      expect(result).toContain('---');
    });
  });

  describe('formatResponse - Comparison Formatting', () => {
    test('should remove duplicate Main Findings sections', async () => {
      const input = `Comparison summary:

Main Findings:
• Finding 1
• Finding 2

Main Findings:
• Finding 3`;

      const result = await service.formatResponse(input, mockContext, []);

      // Should only have one Main Findings section
      const mainFindingsCount = (result.match(/Main Findings:/g) || []).length;
      expect(mainFindingsCount).toBeLessThanOrEqual(1);
    });
  });

  describe('formatResponse - Paragraph Breaks', () => {
    test('should enforce 2-3 sentence paragraph breaks', async () => {
      const longParagraph = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five. This is sentence six.';
      const input = `${longParagraph}\n\n• Item 1\n• Item 2`;

      const result = await service.formatResponse(input, mockContext, []);

      // Should have paragraph breaks in the intro
      const introEnd = result.indexOf('• Item 1');
      const intro = result.substring(0, introEnd);
      expect(intro).toContain('\n\n');
    });
  });

  describe('Delegated Methods', () => {
    test('fixListLineBreaks should delegate to FormatEnforcementService', () => {
      const input = '• Item 1 • Item 2';
      const result = service.fixListLineBreaks(input);

      expect(result).toBe(formatEnforcement.fixBulletLineBreaks(input));
    });

    test('hasEmojis should delegate to FormatEnforcementService', () => {
      expect(service.hasEmojis('Hello 😀')).toBe(formatEnforcement.hasEmojis('Hello 😀'));
      expect(service.hasEmojis('Hello')).toBe(formatEnforcement.hasEmojis('Hello'));
    });

    test('removeEmojis should delegate to FormatEnforcementService', () => {
      const input = 'Hello 😀 World';
      expect(service.removeEmojis(input)).toBe(formatEnforcement.removeEmojis(input));
    });

    test('removeParagraphsAfterBullets should delegate to FormatEnforcementService', () => {
      const input = '• Item 1\n• Item 2\n\nExtra paragraph';
      expect(service.removeParagraphsAfterBullets(input)).toBe(formatEnforcement.removeParagraphsAfterBullets(input));
    });

    test('enforceMaxTwoLineIntro should delegate to FormatEnforcementService', () => {
      const input = 'Line 1\nLine 2\nLine 3\n\n• Item 1';
      expect(service.enforceMaxTwoLineIntro(input)).toBe(formatEnforcement.enforceMaxTwoLineIntro(input));
    });

    test('cleanWhitespace should delegate to FormatEnforcementService', () => {
      const input = 'Text\n\n\n\nMore text';
      expect(service.cleanWhitespace(input)).toBe(formatEnforcement.cleanWhitespace(input));
    });
  });

  describe('End-to-End Formatting', () => {
    test('should handle complex real-world response', async () => {
      const complexInput = `😀 Here is a comprehensive analysis of the business data. According to page 5, the metrics show significant growth. This is a third intro line that should be truncated.

- Revenue increased by $1,234,567.89 (45.5% growth)
- Key file: Report_2024.pdf shows the data
* User growth: 2024-12-03 milestone
• Multiple items on one line: A, B, C, D, E

This paragraph after bullets should be removed.`;

      const result = await service.formatResponse(complexInput, mockContext, []);

      // Should remove emojis
      expect(result).not.toContain('😀');

      // Should remove citations
      expect(result).not.toContain('According to page 5');

      // Should normalize bullet styles to •
      expect(result).not.toContain('- Revenue');
      expect(result).not.toContain('* User');

      // Should auto-bold values
      expect(result).toContain('**$1,234,567.89**');
      expect(result).toContain('**45.5%**');
      expect(result).toContain('**Report_2024.pdf**');
      expect(result).toContain('**2024-12-03**');

      // Should remove paragraph after bullets
      expect(result).not.toContain('This paragraph after bullets should be removed');
    });

    test('should maintain proper structure with all fixes applied', async () => {
      const input = `Here is the summary.

• Item 1 with value $100
• Item 2 with 50% increase
• Item 3

Next actions:

• Action 1
• Action 2`;

      const result = await service.formatResponse(input, mockContext, []);

      // Should maintain structure
      expect(result).toContain('Here is the summary');
      expect(result).toContain('• Item 1');
      expect(result).toContain('• Item 2');
      expect(result).toContain('• Item 3');
      expect(result).toContain('Next actions:');
      expect(result).toContain('• Action 1');
      expect(result).toContain('• Action 2');

      // Should auto-bold values
      expect(result).toContain('**$100**');
      expect(result).toContain('**50%**');
    });
  });
});
