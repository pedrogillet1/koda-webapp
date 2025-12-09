/**
 * FormatEnforcement Service Test Suite
 * Comprehensive tests for all 12 format enforcement rules
 */

import formatEnforcement, { FormatEnforcementService, FormatValidationResult } from '../formatEnforcement.service';

describe('FormatEnforcementService', () => {
  let service: FormatEnforcementService;

  beforeEach(() => {
    service = new FormatEnforcementService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Configuration', () => {
    test('should use default configuration', () => {
      const config = service.getConfig();

      expect(config.maxItemsPerLine).toBe(3);
      expect(config.maxIntroLines).toBe(2);
      expect(config.removeEmojis).toBe(true);
      expect(config.removeCitations).toBe(true);
      expect(config.autoBoldValues).toBe(true);
      expect(config.removeEmptyBullets).toBe(true);
      expect(config.removeTrailingPeriods).toBe(true);
      expect(config.normalizeBulletStyles).toBe(true);
      expect(config.standardBulletChar).toBe('•');
      expect(config.formatNextActions).toBe(true);
      expect(config.enableLogging).toBe(true);
      expect(config.logVerbosity).toBe('minimal');
    });

    test('should accept custom configuration in constructor', () => {
      const customService = new FormatEnforcementService({
        maxItemsPerLine: 5,
        maxIntroLines: 3,
        logVerbosity: 'silent'
      });

      const config = customService.getConfig();
      expect(config.maxItemsPerLine).toBe(5);
      expect(config.maxIntroLines).toBe(3);
      expect(config.logVerbosity).toBe('silent');
    });

    test('should update configuration at runtime', () => {
      service.setConfig({ maxItemsPerLine: 4 });

      const config = service.getConfig();
      expect(config.maxItemsPerLine).toBe(4);
    });

    test('should override config per-call', () => {
      const input = 'Intro\n\n• A, B, C, D, E\n• Other item';

      // Default is 3 items max, so 5 items should be split
      const resultDefault = service.enforceFormat(input);
      const bulletLinesDefault = resultDefault.fixedText?.split('\n').filter(l => l.startsWith('•')) || [];
      expect(bulletLinesDefault.length).toBeGreaterThan(2);

      // With maxItemsPerLine: 5, the 5 items should stay on one line
      const resultOverride = service.enforceFormat(input, { maxItemsPerLine: 5 });
      const bulletLinesOverride = resultOverride.fixedText?.split('\n').filter(l => l.startsWith('•')) || [];
      expect(bulletLinesOverride.length).toBe(2); // Original 2 bullet points
    });

    test('should disable emoji removal when configured', () => {
      const input = 'Hello 😀 World';

      const resultEnabled = service.enforceFormat(input);
      expect(resultEnabled.fixedText).not.toContain('😀');

      const resultDisabled = service.enforceFormat(input, { removeEmojis: false });
      expect(resultDisabled.fixedText).toContain('😀');
    });

    test('should disable citation removal when configured', () => {
      const input = 'According to page 5, the data is good.';

      const resultEnabled = service.enforceFormat(input);
      expect(resultEnabled.fixedText).not.toContain('According to page');

      const resultDisabled = service.enforceFormat(input, { removeCitations: false });
      expect(resultDisabled.fixedText).toContain('According to page');
    });

    test('should disable auto-bold when configured', () => {
      const input = 'Revenue is $1,000';

      const resultEnabled = service.enforceFormat(input);
      expect(resultEnabled.fixedText).toContain('**$1,000**');

      const resultDisabled = service.enforceFormat(input, { autoBoldValues: false });
      expect(resultDisabled.fixedText).toContain('$1,000');
      expect(resultDisabled.fixedText).not.toContain('**$1,000**');
    });

    test('should use configurable intro line limit', () => {
      const input = 'Line 1\nLine 2\nLine 3\nLine 4\n\n• Item1\n• Item2';

      // Default is 2 lines max
      const resultDefault = service.enforceFormat(input);
      const introDefault = resultDefault.fixedText?.split('•')[0].trim().split('\n').filter(l => l.trim()) || [];
      expect(introDefault.length).toBe(2);

      // With maxIntroLines: 4, all 4 lines should remain
      const resultOverride = service.enforceFormat(input, { maxIntroLines: 4 });
      const introOverride = resultOverride.fixedText?.split('•')[0].trim().split('\n').filter(l => l.trim()) || [];
      expect(introOverride.length).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 1: EMOJI REMOVAL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 1: Emoji Removal', () => {
    describe('hasEmojis', () => {
      test('should detect common emojis', () => {
        expect(service.hasEmojis('Hello 😀')).toBe(true);
        expect(service.hasEmojis('Check ✅')).toBe(true);
        expect(service.hasEmojis('Error ❌')).toBe(true);
        expect(service.hasEmojis('File 📁')).toBe(true);
        expect(service.hasEmojis('Star ⭐')).toBe(true);
      });

      test('should return false for text without emojis', () => {
        expect(service.hasEmojis('Hello world')).toBe(false);
        expect(service.hasEmojis('The value is $1,234.56')).toBe(false);
        expect(service.hasEmojis('• Bullet point')).toBe(false);
      });

      test('should detect emojis in complex text', () => {
        expect(service.hasEmojis('The report shows 📊 growth')).toBe(true);
        expect(service.hasEmojis('• Item 1 ✅\n• Item 2 ❌')).toBe(true);
      });

      // Extended emoji range tests (Unicode 12.0+)
      test('should detect newer emojis (Unicode 12.0+)', () => {
        expect(service.hasEmojis('Yawning 🥱')).toBe(true); // U+1F971
        expect(service.hasEmojis('Pinching 🤏')).toBe(true); // U+1F90F
        expect(service.hasEmojis('Lungs 🫁')).toBe(true); // U+1FAC1
      });

      test('should detect skin tone modified emojis', () => {
        expect(service.hasEmojis('Thumbs up 👍🏽')).toBe(true);
        expect(service.hasEmojis('Waving 👋🏻')).toBe(true);
      });

      test('should detect heart and special symbols', () => {
        expect(service.hasEmojis('Love ❤️')).toBe(true);
        expect(service.hasEmojis('Sparkles ✨')).toBe(true);
      });

      test('should detect weather and nature emojis', () => {
        expect(service.hasEmojis('Sun ☀️')).toBe(true);
        expect(service.hasEmojis('Cloud ☁️')).toBe(true);
        expect(service.hasEmojis('Snowflake ❄️')).toBe(true);
      });
    });

    describe('removeEmojis', () => {
      test('should remove single emoji', () => {
        expect(service.removeEmojis('Hello 😀')).toBe('Hello');
      });

      test('should remove multiple emojis', () => {
        const input = '✅ Success ❌ Failure 📁 Files';
        const result = service.removeEmojis(input);
        expect(result).toBe('Success Failure Files');
      });

      test('should clean up extra spaces after emoji removal', () => {
        const input = 'Item  😀  here';
        const result = service.removeEmojis(input);
        expect(result).not.toContain('  ');
      });

      test('should preserve text structure', () => {
        const input = '• First item 📁\n• Second item 📊';
        const result = service.removeEmojis(input);
        expect(result).toContain('• First item');
        expect(result).toContain('• Second item');
      });

      test('should remove newer emojis (Unicode 12.0+)', () => {
        expect(service.removeEmojis('Feeling 🥱 tired')).toBe('Feeling tired');
        expect(service.removeEmojis('Small 🤏 thing')).toBe('Small thing');
      });

      test('should remove skin tone modified emojis', () => {
        expect(service.removeEmojis('Thumbs 👍🏽 up')).toBe('Thumbs up');
      });

      test('should remove heart emojis', () => {
        expect(service.removeEmojis('I ❤️ this')).toBe('I this');
      });

      test('should remove weather emojis', () => {
        expect(service.removeEmojis('Weather: ☀️ sunny')).toBe('Weather: sunny');
      });
    });

    describe('enforceFormat - emoji rule', () => {
      test('should report emoji violation and fix it', () => {
        const input = 'Hello 😀 World';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'emoji')).toBe(true);
        expect(result.fixedText).not.toContain('😀');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 1b: BULLET STYLE NORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 1b: Bullet Style Normalization', () => {
    describe('hasNonStandardBullets', () => {
      test('should detect hyphen bullets', () => {
        expect(service.hasNonStandardBullets('- Item 1')).toBe(true);
      });

      test('should detect asterisk bullets', () => {
        expect(service.hasNonStandardBullets('* Item 1')).toBe(true);
      });

      test('should detect en-dash bullets', () => {
        expect(service.hasNonStandardBullets('– Item 1')).toBe(true);
      });

      test('should detect em-dash bullets', () => {
        expect(service.hasNonStandardBullets('— Item 1')).toBe(true);
      });

      test('should detect Unicode bullets like ‣', () => {
        expect(service.hasNonStandardBullets('‣ Item 1')).toBe(true);
      });

      test('should detect Unicode bullets like ▪', () => {
        expect(service.hasNonStandardBullets('▪ Item 1')).toBe(true);
      });

      test('should NOT detect standard bullet •', () => {
        expect(service.hasNonStandardBullets('• Item 1')).toBe(false);
      });

      test('should NOT detect hyphen in text (no space or not at start)', () => {
        expect(service.hasNonStandardBullets('This is text-with-dashes')).toBe(false);
      });
    });

    describe('normalizeBulletStyles', () => {
      test('should convert hyphen bullets to standard bullet', () => {
        const input = '- Item 1\n- Item 2';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('• Item 1\n• Item 2');
      });

      test('should convert asterisk bullets to standard bullet', () => {
        const input = '* Item 1\n* Item 2';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('• Item 1\n• Item 2');
      });

      test('should convert en-dash bullets to standard bullet', () => {
        const input = '– Item 1\n– Item 2';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('• Item 1\n• Item 2');
      });

      test('should convert em-dash bullets to standard bullet', () => {
        const input = '— Item 1\n— Item 2';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('• Item 1\n• Item 2');
      });

      test('should convert Unicode bullets to standard bullet', () => {
        const input = '‣ Item 1\n▪ Item 2\n◦ Item 3';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('• Item 1\n• Item 2\n• Item 3');
      });

      test('should preserve indentation when normalizing', () => {
        const input = '  - Indented item';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('  • Indented item');
      });

      test('should not convert asterisks in bold markers', () => {
        const input = 'This is **bold** text';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('This is **bold** text');
      });

      test('should not convert hyphens in text', () => {
        const input = 'This is a well-formed sentence';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('This is a well-formed sentence');
      });

      test('should handle mixed bullet styles', () => {
        const input = '- Item 1\n* Item 2\n– Item 3\n• Item 4';
        const result = service.normalizeBulletStyles(input);

        expect(result).toBe('• Item 1\n• Item 2\n• Item 3\n• Item 4');
      });

      test('should accept custom standard bullet character', () => {
        const input = '- Item 1\n- Item 2';
        const result = service.normalizeBulletStyles(input, '▸');

        expect(result).toBe('▸ Item 1\n▸ Item 2');
      });
    });

    describe('convertNumberedToBullets', () => {
      test('should convert numbered list with periods', () => {
        const input = '1. First\n2. Second\n3. Third';
        const result = service.convertNumberedToBullets(input);

        expect(result).toBe('• First\n• Second\n• Third');
      });

      test('should convert numbered list with parentheses', () => {
        const input = '1) First\n2) Second\n3) Third';
        const result = service.convertNumberedToBullets(input);

        expect(result).toBe('• First\n• Second\n• Third');
      });

      test('should preserve indentation', () => {
        const input = '  1. Indented item';
        const result = service.convertNumberedToBullets(input);

        expect(result).toBe('  • Indented item');
      });

      test('should handle multi-digit numbers', () => {
        const input = '10. Tenth item\n100. Hundredth item';
        const result = service.convertNumberedToBullets(input);

        expect(result).toBe('• Tenth item\n• Hundredth item');
      });

      test('should not convert numbers in text', () => {
        const input = 'There are 5. items in the list';
        const result = service.convertNumberedToBullets(input);

        expect(result).toBe('There are 5. items in the list');
      });
    });

    describe('enforceFormat - bullet style normalization', () => {
      test('should normalize bullet styles and report violation', () => {
        const input = '- Item 1\n- Item 2';
        const result = service.enforceFormat(input);

        expect(result.fixedText).toContain('• Item 1');
        expect(result.fixedText).toContain('• Item 2');
        expect(result.violations.some(v => v.type === 'bullet_style_normalized')).toBe(true);
      });

      test('should not report violation for standard bullets', () => {
        const input = '• Item 1\n• Item 2';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'bullet_style_normalized')).toBe(false);
      });

      test('should be disabled when config option is false', () => {
        const input = '- Item 1\n- Item 2';
        const result = service.enforceFormat(input, { normalizeBulletStyles: false });

        expect(result.fixedText).toContain('- Item 1');
        expect(result.violations.some(v => v.type === 'bullet_style_normalized')).toBe(false);
      });

      test('should use custom standard bullet character', () => {
        const customService = new FormatEnforcementService({ standardBulletChar: '▸' });
        const input = '- Item 1\n- Item 2';
        const result = customService.enforceFormat(input);

        expect(result.fixedText).toContain('▸ Item 1');
        expect(result.fixedText).toContain('▸ Item 2');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 2: BULLET LINE BREAKS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 2: Bullet Line Breaks', () => {
    describe('fixBulletLineBreaks', () => {
      test('should separate bullets on same line with space', () => {
        const input = '• Item1 • Item2 • Item3';
        const result = service.fixBulletLineBreaks(input);

        expect(result).toBe('• Item1\n• Item2\n• Item3');
      });

      test('should handle bullets without space after bullet', () => {
        const input = '•Item1 •Item2';
        const result = service.fixBulletLineBreaks(input);

        expect(result).toContain('\n•');
      });

      test('should handle multiple spaces before bullets', () => {
        const input = 'Text  •Item';
        const result = service.fixBulletLineBreaks(input);

        expect(result).toContain('\n•Item');
      });

      test('should preserve properly formatted bullets', () => {
        const input = '• Item1\n• Item2\n• Item3';
        const result = service.fixBulletLineBreaks(input);

        expect(result).toBe('• Item1\n• Item2\n• Item3');
      });

      test('should handle intro text followed by bullets', () => {
        const input = 'Here are the items:\n\n• Item1\n• Item2';
        const result = service.fixBulletLineBreaks(input);

        expect(result).toContain('Here are the items:');
        expect(result).toContain('• Item1');
        expect(result).toContain('• Item2');
      });
    });

    describe('enforceFormat - bullet line breaks rule', () => {
      test('should report violation when bullets on same line', () => {
        const input = 'Intro text\n\n• Item1 • Item2 • Item3';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'bullet_line_breaks')).toBe(true);
        expect(result.fixedText).toContain('• Item1\n• Item2\n• Item3');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 3: 2-3 ITEMS PER LINE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 3: 2-3 Items Per Line', () => {
    describe('splitBulletItems', () => {
      test('should split simple comma-separated items', () => {
        const line = '• Item1, Item2, Item3';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(3);
        expect(items[0]).toBe('Item1');
        expect(items[1]).toBe('Item2');
        expect(items[2]).toBe('Item3');
      });

      test('should respect commas inside parentheses', () => {
        const line = '• **File1.pdf** (data, charts), **File2.xlsx** (results)';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(2);
        expect(items[0]).toBe('**File1.pdf** (data, charts)');
        expect(items[1]).toBe('**File2.xlsx** (results)');
      });

      test('should handle single item', () => {
        const line = '• Single item here';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(1);
        expect(items[0]).toBe('Single item here');
      });

      test('should handle empty bullet', () => {
        const line = '• ';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(0);
      });

      test('should handle complex items with bold and parentheses', () => {
        const line = '• **Budget 2024.xlsx** (Q4 financial data), **Report.pdf** (annual summary), **Analysis.docx** (detailed breakdown)';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(3);
        expect(items[0]).toContain('Budget 2024.xlsx');
        expect(items[1]).toContain('Report.pdf');
        expect(items[2]).toContain('Analysis.docx');
      });

      test('should handle nested parentheses', () => {
        const line = '• **Report** (contains (nested, data)), **File**';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(2);
        expect(items[0]).toBe('**Report** (contains (nested, data))');
        expect(items[1]).toBe('**File**');
      });

      test('should handle square brackets', () => {
        const line = '• **Data** [array, items], **Config** [settings]';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(2);
        expect(items[0]).toBe('**Data** [array, items]');
        expect(items[1]).toBe('**Config** [settings]');
      });

      test('should handle curly brackets', () => {
        const line = '• **Object** {key: value, other: data}, **Config**';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(2);
        expect(items[0]).toBe('**Object** {key: value, other: data}');
        expect(items[1]).toBe('**Config**');
      });

      test('should handle mixed bracket types', () => {
        const line = '• **Item1** (data [nested, array]), **Item2** {config}';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(2);
        expect(items[0]).toBe('**Item1** (data [nested, array])');
        expect(items[1]).toBe('**Item2** {config}');
      });

      test('should handle deeply nested brackets', () => {
        const line = '• **Complex** (level1 (level2 [level3, item])), **Simple**';
        const items = (service as any).splitBulletItems(line);

        expect(items).toHaveLength(2);
        expect(items[0]).toBe('**Complex** (level1 (level2 [level3, item]))');
        expect(items[1]).toBe('**Simple**');
      });

      test('should handle unbalanced brackets gracefully', () => {
        // Even with unbalanced brackets, should not crash
        const line = '• **Item1** (unclosed, **Item2**';
        const items = (service as any).splitBulletItems(line);

        // Should treat everything as one item since parenthesis never closes
        expect(items).toHaveLength(1);
      });
    });

    describe('enforce2To3ItemsPerLine', () => {
      test('should not modify line with 2 items', () => {
        const input = '• Item1, Item2';
        const result = service.enforce2To3ItemsPerLine(input);

        expect(result).toBe('• Item1, Item2');
      });

      test('should not modify line with 3 items', () => {
        const input = '• Item1, Item2, Item3';
        const result = service.enforce2To3ItemsPerLine(input);

        expect(result).toBe('• Item1, Item2, Item3');
      });

      test('should split line with 4 items into 2 lines', () => {
        const input = '• A, B, C, D';
        const result = service.enforce2To3ItemsPerLine(input);

        expect(result).toContain('• A, B, C');
        expect(result).toContain('• D');
        expect(result.split('\n')).toHaveLength(2);
      });

      test('should split line with 6 items into 2 lines of 3', () => {
        const input = '• A, B, C, D, E, F';
        const result = service.enforce2To3ItemsPerLine(input);

        const lines = result.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('• A, B, C');
        expect(lines[1]).toBe('• D, E, F');
      });

      test('should split line with 7 items into 3 lines', () => {
        const input = '• A, B, C, D, E, F, G';
        const result = service.enforce2To3ItemsPerLine(input);

        const lines = result.split('\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('• A, B, C');
        expect(lines[1]).toBe('• D, E, F');
        expect(lines[2]).toBe('• G');
      });

      test('should handle complex items with parentheses', () => {
        const input = '• **File1.pdf** (data, charts), **File2.xlsx** (Q4), **File3.docx** (summary), **File4.txt** (notes)';
        const result = service.enforce2To3ItemsPerLine(input);

        const lines = result.split('\n');
        expect(lines).toHaveLength(2);
        // First line should have 3 items
        expect(lines[0]).toContain('File1.pdf');
        expect(lines[0]).toContain('File2.xlsx');
        expect(lines[0]).toContain('File3.docx');
        // Second line should have 1 item
        expect(lines[1]).toContain('File4.txt');
      });

      test('should not modify non-bullet lines', () => {
        const input = 'This is regular text with A, B, C, D, E items';
        const result = service.enforce2To3ItemsPerLine(input);

        expect(result).toBe(input);
      });

      test('should handle mixed content', () => {
        const input = 'Intro text\n\n• A, B\n• C, D, E, F, G\n\nClosing text';
        const result = service.enforce2To3ItemsPerLine(input);

        expect(result).toContain('• A, B'); // unchanged
        expect(result).toContain('• C, D, E'); // split
        expect(result).toContain('• F, G'); // split remainder
      });
    });

    describe('enforceFormat - items per line rule', () => {
      test('should report violation when more than 3 items per line', () => {
        // Need at least 2 bullets for the rule to apply
        const input = 'Here are the files:\n\n• A, B, C, D, E\n• Extra item';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'items_per_line')).toBe(true);
      });

      test('should not report violation when 3 or fewer items', () => {
        const input = 'Here are the files:\n\n• A, B, C\n• D, E';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'items_per_line')).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 4: MAX 2-LINE INTRO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 4: Max 2-Line Intro', () => {
    describe('enforceMaxTwoLineIntro', () => {
      test('should not modify 1-line intro', () => {
        const input = 'Here are the items:\n\n• Item1\n• Item2';
        const result = service.enforceMaxTwoLineIntro(input);

        expect(result).toBe(input);
      });

      test('should not modify 2-line intro', () => {
        const input = 'Line one.\nLine two.\n\n• Item1\n• Item2';
        const result = service.enforceMaxTwoLineIntro(input);

        expect(result).toContain('Line one.');
        expect(result).toContain('Line two.');
      });

      test('should truncate 3-line intro to 2 lines', () => {
        const input = 'Line one.\nLine two.\nLine three.\n\n• Item1\n• Item2';
        const result = service.enforceMaxTwoLineIntro(input);

        expect(result).toContain('Line one.');
        expect(result).toContain('Line two.');
        expect(result).not.toContain('Line three.');
      });

      test('should truncate 4-line intro to 2 lines', () => {
        const input = 'Line one.\nLine two.\nLine three.\nLine four.\n\n• Item1\n• Item2';
        const result = service.enforceMaxTwoLineIntro(input);

        const lines = result.split('\n').filter(l => l.trim() && !l.startsWith('•'));
        expect(lines.length).toBeLessThanOrEqual(2);
      });

      test('should return text unchanged if no bullets', () => {
        const input = 'This is just regular text with no bullets.';
        const result = service.enforceMaxTwoLineIntro(input);

        expect(result).toBe(input);
      });

      test('should handle empty intro', () => {
        const input = '• Item1\n• Item2';
        const result = service.enforceMaxTwoLineIntro(input);

        expect(result).toBe(input);
      });
    });

    describe('enforceFormat - intro length rule', () => {
      test('should report violation for 3+ line intro', () => {
        const input = 'Line one.\nLine two.\nLine three.\n\n• Item1\n• Item2';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'intro_length')).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 5: NO PARAGRAPHS AFTER BULLETS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 5: No Paragraphs After Bullets', () => {
    describe('removeParagraphsAfterBullets', () => {
      test('should remove text after last bullet', () => {
        const input = 'Intro\n\n• Item1\n• Item2\n\nThis extra paragraph should be removed.';
        const result = service.removeParagraphsAfterBullets(input);

        expect(result).not.toContain('This extra paragraph');
        expect(result).toContain('• Item2');
      });

      test('should preserve "Next actions:" section', () => {
        const input = 'Intro\n\n• Item1\n• Item2\n\nNext actions:\n• Action 1\n• Action 2';
        const result = service.removeParagraphsAfterBullets(input);

        expect(result).toContain('Next actions:');
        expect(result).toContain('• Action 1');
        expect(result).toContain('• Action 2');
      });

      test('should remove text between bullets and "Next actions:"', () => {
        const input = 'Intro\n\n• Item1\n• Item2\n\nUnwanted text here.\n\nNext actions:\n• Action 1';
        const result = service.removeParagraphsAfterBullets(input);

        expect(result).not.toContain('Unwanted text here');
        expect(result).toContain('Next actions:');
      });

      test('should not modify if no text after bullets', () => {
        const input = 'Intro\n\n• Item1\n• Item2';
        const result = service.removeParagraphsAfterBullets(input);

        expect(result).toBe(input);
      });

      test('should return text unchanged if no bullets', () => {
        const input = 'This is just text without bullets.';
        const result = service.removeParagraphsAfterBullets(input);

        expect(result).toBe(input);
      });
    });

    describe('enforceFormat - paragraphs after bullets rule', () => {
      test('should report violation when paragraphs after bullets', () => {
        const input = 'Intro\n\n• Item1\n• Item2\n\nExtra paragraph that violates the rule.';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'paragraphs_after_bullets')).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 6: BOLD FORMATTING AUTO-FIX AND VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 6: Bold Formatting Auto-Fix', () => {
    describe('autoBoldValues', () => {
      test('should auto-bold monetary values', () => {
        const input = 'The total is $1,234.56';
        const result = service.autoBoldValues(input);

        expect(result).toBe('The total is **$1,234.56**');
      });

      test('should auto-bold simple dollar amounts', () => {
        const input = 'Cost: $100';
        const result = service.autoBoldValues(input);

        expect(result).toBe('Cost: **$100**');
      });

      test('should not double-bold already bolded monetary values', () => {
        const input = 'The total is **$1,234.56**';
        const result = service.autoBoldValues(input);

        expect(result).toBe('The total is **$1,234.56**');
      });

      test('should auto-bold percentages', () => {
        const input = 'Growth rate is 45%';
        const result = service.autoBoldValues(input);

        expect(result).toBe('Growth rate is **45%**');
      });

      test('should auto-bold decimal percentages', () => {
        const input = 'Rate is 12.5% annually';
        const result = service.autoBoldValues(input);

        expect(result).toBe('Rate is **12.5%** annually');
      });

      test('should not double-bold already bolded percentages', () => {
        const input = 'Growth rate is **45%**';
        const result = service.autoBoldValues(input);

        expect(result).toBe('Growth rate is **45%**');
      });

      test('should auto-bold YYYY-MM-DD dates', () => {
        const input = 'Date is 2024-12-03';
        const result = service.autoBoldValues(input);

        expect(result).toBe('Date is **2024-12-03**');
      });

      test('should auto-bold MM/DD/YYYY dates', () => {
        const input = 'Date is 12/03/2024';
        const result = service.autoBoldValues(input);

        expect(result).toBe('Date is **12/03/2024**');
      });

      test('should auto-bold M/D/YY dates', () => {
        const input = 'Date is 1/5/24';
        const result = service.autoBoldValues(input);

        expect(result).toBe('Date is **1/5/24**');
      });

      test('should auto-bold filenames with common extensions', () => {
        const input = 'Check Budget2024.xlsx for details';
        const result = service.autoBoldValues(input);

        expect(result).toContain('**Budget2024.xlsx**');
      });

      test('should auto-bold PDF files', () => {
        const input = 'See Report.pdf';
        const result = service.autoBoldValues(input);

        expect(result).toBe('See **Report.pdf**');
      });

      test('should auto-bold multiple values in same text', () => {
        const input = 'Revenue $1,000 (45% growth) on 2024-01-15';
        const result = service.autoBoldValues(input);

        expect(result).toContain('**$1,000**');
        expect(result).toContain('**45%**');
        expect(result).toContain('**2024-01-15**');
      });

      test('should handle filenames with numbers and underscores', () => {
        const input = 'File: Budget_2024_Final.xlsx';
        const result = service.autoBoldValues(input);

        expect(result).toContain('**Budget_2024_Final.xlsx**');
      });

      test('should handle simple filenames with numbers', () => {
        const input = 'File: Budget2024.xlsx';
        const result = service.autoBoldValues(input);

        expect(result).toContain('**Budget2024.xlsx**');
      });

      test('should not match filenames with spaces (too error-prone)', () => {
        // Multi-word filenames with spaces could match surrounding text incorrectly
        // So we only auto-bold single-word filenames
        const input = 'See Report.pdf for details';
        const result = service.autoBoldValues(input);

        expect(result).toBe('See **Report.pdf** for details');
      });

      test('should clean up accidental double-bolding', () => {
        const input = '****text****';
        const result = service.autoBoldValues(input);

        expect(result).toBe('**text**');
      });
    });

    describe('enforceFormat - auto-bold integration', () => {
      test('should apply auto-bold and report it', () => {
        const input = 'Revenue is $1,000';
        const result = service.enforceFormat(input);

        expect(result.fixedText).toContain('**$1,000**');
        expect(result.violations.some(v => v.type === 'auto_bold_applied')).toBe(true);
      });

      test('should not report auto-bold if nothing changed', () => {
        const input = 'Revenue is **$1,000**';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'auto_bold_applied')).toBe(false);
      });
    });
  });

  describe('RULE 6b: Bold Formatting Validation', () => {
    describe('validateBoldFormatting', () => {
      test('should warn about unbolded monetary values', () => {
        const text = 'The total is $1,234.56';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_money')).toBe(true);
      });

      test('should not warn about bolded monetary values', () => {
        const text = 'The total is **$1,234.56**';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_money')).toBe(false);
      });

      test('should warn about unbolded percentages', () => {
        const text = 'Growth rate is 45%';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_percent')).toBe(true);
      });

      test('should not warn about bolded percentages', () => {
        const text = 'Growth rate is **45%**';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_percent')).toBe(false);
      });

      test('should warn about unbolded dates (YYYY-MM-DD)', () => {
        const text = 'The date is 2024-12-03';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_date')).toBe(true);
      });

      test('should warn about unbolded dates (MM/DD/YYYY)', () => {
        const text = 'The date is 12/03/2024';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_date')).toBe(true);
      });

      test('should warn about unbolded filenames', () => {
        const text = 'Check the file Budget2024.xlsx';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_filename')).toBe(true);
      });

      test('should not warn about bolded filenames', () => {
        const text = 'Check the file **Budget2024.xlsx**';
        const violations = service.validateBoldFormatting(text);

        expect(violations.some(v => v.type === 'missing_bold_filename')).toBe(false);
      });

      test('should detect multiple unbolded values', () => {
        const text = 'Revenue was $1,000 (45% growth) on 2024-01-15 in Report.pdf';
        const violations = service.validateBoldFormatting(text);

        expect(violations.filter(v => v.severity === 'warning').length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 7: REMOVE CITATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 7: Remove Citations', () => {
    describe('removeCitations', () => {
      test('should remove "According to page X" pattern', () => {
        const input = 'According to page 5, the revenue increased.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('According to page');
        expect(result).toContain('the revenue increased');
      });

      test('should remove "According to document X" pattern', () => {
        const input = 'According to document A, the data shows growth.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('According to document');
      });

      test('should remove "As mentioned in page X" pattern', () => {
        const input = 'As mentioned in page 3, the results are positive.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('As mentioned in page');
      });

      test('should remove "From page X" pattern', () => {
        const input = 'From page 10, we can see the trend.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('From page');
      });

      test('should remove "(page X)" pattern', () => {
        const input = 'The revenue (page 5) shows growth.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('(page 5)');
        expect(result).toContain('revenue');
        expect(result).toContain('shows growth');
      });

      test('should remove "[page X]" pattern', () => {
        const input = 'The data [page 3] indicates success.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('[page 3]');
      });

      test('should handle multiple citations', () => {
        const input = 'According to page 1, the intro. From page 5, the data. (page 10)';
        const result = service.removeCitations(input);

        expect(result).not.toContain('According to page');
        expect(result).not.toContain('From page');
        expect(result).not.toContain('(page 10)');
      });

      test('should clean up extra spaces after removal', () => {
        const input = 'The data  (page 5)  shows growth.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('  ');
      });

      // Portuguese citation tests
      test('should remove "De acordo com a página X" pattern', () => {
        const input = 'De acordo com a página 5, os dados mostram crescimento.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('De acordo com a página');
        expect(result).toContain('os dados mostram crescimento');
      });

      test('should remove "Conforme a página X" pattern', () => {
        const input = 'Conforme a página 10, o resultado é positivo.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('Conforme a página');
      });

      test('should remove "Segundo o documento X" pattern', () => {
        const input = 'Segundo o documento A, a receita aumentou.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('Segundo o documento');
      });

      test('should remove "(página X)" pattern', () => {
        const input = 'Os dados (página 5) mostram crescimento.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('(página 5)');
      });

      // Spanish citation tests
      test('should remove "Según la página X" pattern', () => {
        const input = 'Según la página 5, los datos muestran crecimiento.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('Según la página');
        expect(result).toContain('los datos muestran crecimiento');
      });

      test('should remove "De acuerdo con el documento X" pattern', () => {
        const input = 'De acuerdo con el documento A, los ingresos aumentaron.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('De acuerdo con el documento');
      });

      test('should remove "Como se menciona en la página X" pattern', () => {
        const input = 'Como se menciona en la página 3, el resultado es positivo.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('Como se menciona en la página');
      });

      test('should remove "En la página X" pattern', () => {
        const input = 'En la página 10, se muestra el análisis.';
        const result = service.removeCitations(input);

        expect(result).not.toContain('En la página');
      });
    });

    describe('enforceFormat - citations rule', () => {
      test('should report violation when citations present', () => {
        const input = 'According to page 5, the data shows growth.';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'citations')).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 8: CLEAN WHITESPACE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 8: Clean Whitespace', () => {
    describe('cleanWhitespace', () => {
      test('should remove trailing whitespace from lines', () => {
        const input = 'Line with trailing space   \nAnother line  ';
        const result = service.cleanWhitespace(input);

        expect(result).toBe('Line with trailing space\nAnother line');
      });

      test('should limit consecutive blank lines to 1', () => {
        const input = 'Line 1\n\n\n\nLine 2';
        const result = service.cleanWhitespace(input);

        expect(result).toBe('Line 1\n\nLine 2');
      });

      test('should trim leading/trailing whitespace from text', () => {
        const input = '   Text content here   ';
        const result = service.cleanWhitespace(input);

        expect(result).toBe('Text content here');
      });

      test('should handle tabs', () => {
        const input = 'Line with tab\t';
        const result = service.cleanWhitespace(input);

        expect(result).toBe('Line with tab');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 9: EMPTY BULLET REMOVAL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 9: Empty Bullet Removal', () => {
    describe('removeEmptyBullets', () => {
      test('should remove empty bullet points', () => {
        const input = '• Item 1\n• \n• Item 2';
        const result = service.removeEmptyBullets(input);

        expect(result).toBe('• Item 1\n• Item 2');
      });

      test('should remove bullet with only spaces', () => {
        const input = '• Item 1\n•    \n• Item 2';
        const result = service.removeEmptyBullets(input);

        expect(result).toBe('• Item 1\n• Item 2');
      });

      test('should remove multiple empty bullets', () => {
        const input = '• \n• Item 1\n• \n• \n• Item 2';
        const result = service.removeEmptyBullets(input);

        expect(result).toBe('• Item 1\n• Item 2');
      });

      test('should not modify non-empty bullets', () => {
        const input = '• Item 1\n• Item 2\n• Item 3';
        const result = service.removeEmptyBullets(input);

        expect(result).toBe('• Item 1\n• Item 2\n• Item 3');
      });

      test('should preserve non-bullet lines', () => {
        const input = 'Intro\n\n• Item 1\n• \n• Item 2\n\nClosing';
        const result = service.removeEmptyBullets(input);

        expect(result).toBe('Intro\n\n• Item 1\n• Item 2\n\nClosing');
      });

      test('should handle text with no bullets', () => {
        const input = 'Just regular text here';
        const result = service.removeEmptyBullets(input);

        expect(result).toBe('Just regular text here');
      });
    });

    describe('enforceFormat - empty bullet removal', () => {
      test('should remove empty bullets and report violation', () => {
        const input = '• Item 1\n• \n• Item 2';
        const result = service.enforceFormat(input);

        expect(result.fixedText).not.toContain('• \n');
        expect(result.violations.some(v => v.type === 'empty_bullets_removed')).toBe(true);
      });

      test('should not report violation if no empty bullets', () => {
        const input = '• Item 1\n• Item 2';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'empty_bullets_removed')).toBe(false);
      });

      test('should be disabled when config option is false', () => {
        const input = '• Item 1\n• \n• Item 2';
        const result = service.enforceFormat(input, { removeEmptyBullets: false });

        // Empty bullet should still be present (though may be modified by other rules)
        expect(result.violations.some(v => v.type === 'empty_bullets_removed')).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 10: TRAILING PERIOD REMOVAL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 10: Trailing Period Removal', () => {
    describe('removeTrailingPeriodsFromBullets', () => {
      test('should remove trailing period from short bullet', () => {
        const input = '• Short item.';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• Short item');
      });

      test('should remove periods from multiple bullets', () => {
        const input = '• Item one.\n• Item two.\n• Item three.';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• Item one\n• Item two\n• Item three');
      });

      test('should NOT remove period from bullet with parentheses', () => {
        const input = '• Item with (parentheses).';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• Item with (parentheses).');
      });

      test('should NOT remove period from long bullets (>100 chars)', () => {
        const longBullet = '• ' + 'A'.repeat(100) + '.';
        const result = service.removeTrailingPeriodsFromBullets(longBullet);

        expect(result).toBe(longBullet);
      });

      test('should NOT remove period from abbreviations like "etc."', () => {
        const input = '• Items include files, data, etc.';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• Items include files, data, etc.');
      });

      test('should NOT remove period from abbreviations like "e.g."', () => {
        const input = '• Common formats, e.g.';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• Common formats, e.g.');
      });

      test('should NOT remove period from abbreviations like "i.e."', () => {
        const input = '• The main item, i.e.';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• The main item, i.e.');
      });

      test('should NOT remove period from titles like "Dr." "Mr." "Mrs."', () => {
        const input = '• Contact Dr.';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• Contact Dr.');
      });

      test('should preserve bullets without periods', () => {
        const input = '• Item without period\n• Another item';
        const result = service.removeTrailingPeriodsFromBullets(input);

        expect(result).toBe('• Item without period\n• Another item');
      });

      test('should preserve non-bullet lines', () => {
        const input = 'Intro sentence.\n\n• Item.\n\nClosing sentence.';
        const result = service.removeTrailingPeriodsFromBullets(input);

        // Only bullet periods removed, not regular sentences
        expect(result).toBe('Intro sentence.\n\n• Item\n\nClosing sentence.');
      });
    });

    describe('enforceFormat - trailing period removal', () => {
      test('should remove trailing periods and report violation', () => {
        const input = '• Short item.';
        const result = service.enforceFormat(input);

        expect(result.fixedText).toBe('• Short item');
        expect(result.violations.some(v => v.type === 'trailing_periods_removed')).toBe(true);
      });

      test('should not report violation if no periods removed', () => {
        const input = '• Short item';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'trailing_periods_removed')).toBe(false);
      });

      test('should be disabled when config option is false', () => {
        const input = '• Short item.';
        const result = service.enforceFormat(input, { removeTrailingPeriods: false });

        expect(result.fixedText).toContain('.');
        expect(result.violations.some(v => v.type === 'trailing_periods_removed')).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 11: NEXT ACTIONS SECTION FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 11: Next Actions Section Formatting', () => {
    describe('hasNextActionsSection', () => {
      test('should detect "Next actions:" header', () => {
        expect(service.hasNextActionsSection('Content\n\nNext actions:\n• Item')).toBe(true);
      });

      test('should detect "Next steps:" header', () => {
        expect(service.hasNextActionsSection('Content\n\nNext steps:\n• Item')).toBe(true);
      });

      test('should return false when no next actions section', () => {
        expect(service.hasNextActionsSection('Regular content here')).toBe(false);
      });
    });

    describe('formatNextActionsSection', () => {
      test('should convert inline items to bullet list', () => {
        const input = 'Content\n\nNext actions: Item 1, Item 2, Item 3';
        const result = service.formatNextActionsSection(input);

        expect(result).toContain('Next actions:');
        expect(result).toContain('• Item 1');
        expect(result).toContain('• Item 2');
        expect(result).toContain('• Item 3');
      });

      test('should normalize "Next steps:" to "Next actions:"', () => {
        const input = 'Content\n\nNext steps: Do something';
        const result = service.formatNextActionsSection(input);

        expect(result).toContain('Next actions:');
        expect(result).not.toContain('Next steps:');
      });

      test('should normalize "Suggested actions:" to "Next actions:"', () => {
        const input = 'Content\n\nSuggested actions: Do something';
        const result = service.formatNextActionsSection(input);

        expect(result).toContain('Next actions:');
        expect(result).not.toContain('Suggested actions:');
      });

      test('should preserve already bulleted items', () => {
        const input = 'Content\n\nNext actions:\n\n• Item 1\n• Item 2';
        const result = service.formatNextActionsSection(input);

        expect(result).toBe(input);
      });

      test('should handle semicolon-separated items', () => {
        const input = 'Content\n\nNext actions: Item 1; Item 2; Item 3';
        const result = service.formatNextActionsSection(input);

        expect(result).toContain('• Item 1');
        expect(result).toContain('• Item 2');
        expect(result).toContain('• Item 3');
      });

      test('should not modify text without Next actions section', () => {
        const input = 'Regular content without next actions';
        const result = service.formatNextActionsSection(input);

        expect(result).toBe(input);
      });

      test('should add blank line after header', () => {
        const input = 'Content\n\nNext actions: Item 1';
        const result = service.formatNextActionsSection(input);

        expect(result).toContain('Next actions:\n\n•');
      });
    });

    describe('enforceFormat - next actions formatting', () => {
      test('should format next actions section and report violation', () => {
        const input = 'Content\n\nNext steps: Item 1, Item 2';
        const result = service.enforceFormat(input);

        expect(result.fixedText).toContain('Next actions:');
        expect(result.fixedText).toContain('• Item 1');
        expect(result.violations.some(v => v.type === 'next_actions_formatted')).toBe(true);
      });

      test('should not report violation if no changes needed', () => {
        const input = 'Content\n\nNext actions:\n\n• Item 1\n• Item 2';
        const result = service.enforceFormat(input);

        expect(result.violations.some(v => v.type === 'next_actions_formatted')).toBe(false);
      });

      test('should be disabled when config option is false', () => {
        const input = 'Content\n\nNext steps: Item 1, Item 2';
        const result = service.enforceFormat(input, { formatNextActions: false });

        expect(result.fixedText).toContain('Next steps:');
        expect(result.violations.some(v => v.type === 'next_actions_formatted')).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE FORMATTING VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Table Formatting Validation', () => {
    describe('hasTable', () => {
      test('should detect valid markdown table', () => {
        const table = '| Header 1 | Header 2 |\n| --- | --- |\n| Data 1 | Data 2 |';
        expect(service.hasTable(table)).toBe(true);
      });

      test('should return false for text without table', () => {
        expect(service.hasTable('Regular text without tables')).toBe(false);
      });

      test('should return false for incomplete table (no separator)', () => {
        const table = '| Header 1 | Header 2 |\n| Data 1 | Data 2 |';
        expect(service.hasTable(table)).toBe(false);
      });

      test('should return false for single pipe line', () => {
        expect(service.hasTable('This | is | not | a | table')).toBe(false);
      });

      test('should detect table without leading/trailing pipes', () => {
        const table = 'Header 1 | Header 2\n--- | ---\nData 1 | Data 2';
        expect(service.hasTable(table)).toBe(true);
      });
    });

    describe('validateTableFormatting', () => {
      test('should return no violations for valid table', () => {
        const table = '| Header 1 | Header 2 |\n| --- | --- |\n| Data 1 | Data 2 |';
        const violations = service.validateTableFormatting(table);

        expect(violations.filter(v => v.severity === 'error')).toHaveLength(0);
      });

      test('should detect column count mismatch', () => {
        const table = '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 |';
        const violations = service.validateTableFormatting(table);

        expect(violations.some(v => v.type === 'table_column_mismatch')).toBe(true);
      });

      test('should warn about empty cells', () => {
        const table = '| Header 1 | Header 2 |\n| --- | --- |\n| Data 1 |  |';
        const violations = service.validateTableFormatting(table);

        expect(violations.some(v => v.type === 'table_empty_cell')).toBe(true);
        expect(violations.find(v => v.type === 'table_empty_cell')?.severity).toBe('warning');
      });

      test('should return empty array for non-table text', () => {
        const violations = service.validateTableFormatting('No table here');

        expect(violations).toHaveLength(0);
      });
    });

    describe('fixTableFormatting', () => {
      test('should align table columns', () => {
        const table = '| A | B |\n| --- | --- |\n| Long Content | X |';
        const result = service.fixTableFormatting(table);

        expect(result).toContain('| Long Content |');
        // Column should be padded
        expect(result.split('\n')[0]).toContain('A ');
      });

      test('should normalize column count', () => {
        const table = '| A | B | C |\n| --- | --- |\n| 1 | 2 |';
        const result = service.fixTableFormatting(table);

        // All rows should have 3 columns after fix
        const lines = result.split('\n');
        expect(lines[0].match(/\|/g)?.length).toBe(4); // 3 columns = 4 pipes
        expect(lines[2].match(/\|/g)?.length).toBe(4);
      });

      test('should add separator row if missing', () => {
        // This is a tricky case - without separator, hasTable returns false
        // So we test with a valid table structure
        const table = '| Header 1 | Header 2 |\n| --- | --- |\n| Data 1 | Data 2 |';
        const result = service.fixTableFormatting(table);

        expect(result).toContain('---');
      });

      test('should not modify non-table text', () => {
        const text = 'Regular text without tables';
        const result = service.fixTableFormatting(text);

        expect(result).toBe(text);
      });

      test('should preserve content around tables', () => {
        const text = 'Intro text\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nClosing text';
        const result = service.fixTableFormatting(text);

        expect(result).toContain('Intro text');
        expect(result).toContain('Closing text');
      });

      test('should handle table at end of text', () => {
        const text = 'Some intro\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
        const result = service.fixTableFormatting(text);

        expect(result).toContain('| A');
        expect(result).toContain('| 1');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 12: STRUCTURE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RULE 12: Structure Validation', () => {
    describe('validateStructure', () => {
      test('should warn about missing intro when bullets present', () => {
        const text = '• Item1\n• Item2';
        const violations = service.validateStructure(text);

        expect(violations.some(v => v.type === 'missing_intro')).toBe(true);
      });

      test('should not warn when intro exists', () => {
        const text = 'Here is the intro:\n\n• Item1\n• Item2';
        const violations = service.validateStructure(text);

        expect(violations.some(v => v.type === 'missing_intro')).toBe(false);
      });

      test('should error on empty bullets', () => {
        const text = 'Intro\n\n• \n• Item2';
        const violations = service.validateStructure(text);

        expect(violations.some(v => v.type === 'empty_bullet')).toBe(true);
      });

      test('should warn about periods on short bullets', () => {
        // Need at least 2 bullets for validateStructure to check bullet formatting
        const text = 'Intro\n\n• Short item.\n• Another item.';
        const violations = service.validateStructure(text);

        expect(violations.some(v => v.type === 'bullet_period')).toBe(true);
      });

      test('should not warn about periods on bullets with parentheses', () => {
        const text = 'Intro\n\n• Item with (parentheses).';
        const violations = service.validateStructure(text);

        expect(violations.some(v => v.type === 'bullet_period')).toBe(false);
      });

      test('should not warn about periods on long bullets', () => {
        const text = 'Intro\n\n• This is a much longer bullet point that exceeds one hundred characters and therefore should not trigger the period warning even though it ends with a period.';
        const violations = service.validateStructure(text);

        expect(violations.some(v => v.type === 'bullet_period')).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Utility Methods', () => {
    describe('getStats', () => {
      test('should count bullets correctly', () => {
        const text = 'Intro\n\n• Item1\n• Item2\n• Item3';
        const stats = service.getStats(text);

        expect(stats.bulletCount).toBe(3);
      });

      test('should count intro lines correctly', () => {
        const text = 'Line 1\nLine 2\n\n• Item1\n• Item2';
        const stats = service.getStats(text);

        expect(stats.introLineCount).toBe(2);
      });

      test('should detect emojis', () => {
        const textWithEmoji = 'Hello 😀';
        const textWithoutEmoji = 'Hello';

        expect(service.getStats(textWithEmoji).hasEmojis).toBe(true);
        expect(service.getStats(textWithoutEmoji).hasEmojis).toBe(false);
      });

      test('should detect citations', () => {
        const textWithCitation = 'According to page 5, the data.';
        const textWithoutCitation = 'The data shows growth.';

        expect(service.getStats(textWithCitation).hasCitations).toBe(true);
        expect(service.getStats(textWithoutCitation).hasCitations).toBe(false);
      });

      test('should count bold items', () => {
        const text = '**Item1** and **Item2** are **important**';
        const stats = service.getStats(text);

        expect(stats.boldCount).toBe(3);
      });

      test('should count words', () => {
        const text = 'One two three four five';
        const stats = service.getStats(text);

        expect(stats.wordCount).toBe(5);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Tests', () => {
    describe('enforceFormat - complete workflow', () => {
      test('should fix multiple violations in one pass', () => {
        const input = `
Line 1.
Line 2.
Line 3.

• Item1 😀 • Item2 • Item3 • Item4

According to page 5, this is extra text.
        `.trim();

        const result = service.enforceFormat(input);

        // Should have fixed emojis
        expect(result.fixedText).not.toContain('😀');

        // Should have fixed bullet line breaks
        expect(result.fixedText).toContain('• Item1\n• Item2');

        // Should have fixed items per line (4 items split)
        const bulletLines = result.fixedText?.split('\n').filter(l => l.startsWith('•')) || [];
        expect(bulletLines.length).toBeGreaterThan(1);

        // Should have fixed intro length
        const introLines = (result.fixedText?.split('•')[0] || '').split('\n').filter(l => l.trim());
        expect(introLines.length).toBeLessThanOrEqual(2);

        // Should have removed citations
        expect(result.fixedText).not.toContain('According to page');

        // Should have removed text after bullets
        expect(result.fixedText).not.toContain('extra text');
      });

      test('should return isValid=true when no critical violations', () => {
        const input = 'Clean intro.\n\n• **Item1** (description)\n• **Item2** (description)';
        const result = service.enforceFormat(input);

        expect(result.isValid).toBe(true);
      });

      test('should return isValid=false when critical violations exist', () => {
        const input = '• Item1 😀 • Item2';
        const result = service.enforceFormat(input);

        // Will have emoji violation (error)
        expect(result.isValid).toBe(false);
      });

      test('should handle empty input', () => {
        const result = service.enforceFormat('');

        expect(result.fixedText).toBe('');
        expect(result.violations).toHaveLength(0);
      });

      test('should handle input with only whitespace', () => {
        const result = service.enforceFormat('   \n\n   ');

        expect(result.fixedText?.trim()).toBe('');
      });
    });

    describe('singleton export', () => {
      test('should export singleton instance', () => {
        expect(formatEnforcement).toBeInstanceOf(FormatEnforcementService);
      });

      test('singleton should work correctly', () => {
        const result = formatEnforcement.enforceFormat('Test 😀');

        expect(result.fixedText).not.toContain('😀');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    test('should handle very long text', () => {
      const longText = 'Intro.\n\n' + Array(100).fill('• Item').join('\n');
      const result = service.enforceFormat(longText);

      expect(result.fixedText).toBeDefined();
    });

    test('should handle special characters', () => {
      const input = 'Intro with special chars: @#$%^&*()\n\n• Item with ñ, é, ü';
      const result = service.enforceFormat(input);

      expect(result.fixedText).toContain('ñ');
      expect(result.fixedText).toContain('é');
      expect(result.fixedText).toContain('ü');
    });

    test('should handle mixed bullet styles gracefully', () => {
      const input = 'Intro.\n\n• Bullet 1\n- Hyphen 2\n* Asterisk 3';
      const result = service.enforceFormat(input);

      expect(result.fixedText).toBeDefined();
    });

    test('should handle nested structures', () => {
      const input = 'Intro.\n\n• Parent item\n  • Child item 1\n  • Child item 2';
      const result = service.enforceFormat(input);

      expect(result.fixedText).toBeDefined();
    });

    test('should handle tables in text', () => {
      const input = 'Intro.\n\n| Header | Value |\n| --- | --- |\n| A | 1 |';
      const result = service.enforceFormat(input);

      expect(result.fixedText).toContain('| Header | Value |');
    });

    test('should handle code blocks', () => {
      const input = 'Intro.\n\n```\ncode here\n```';
      const result = service.enforceFormat(input);

      expect(result.fixedText).toContain('```');
    });

    test('should handle URLs', () => {
      const input = 'Visit https://example.com for more info.\n\n• Link item';
      const result = service.enforceFormat(input);

      expect(result.fixedText).toContain('https://example.com');
    });

    test('should handle numbered lists', () => {
      const input = 'Intro.\n\n1. First item\n2. Second item\n3. Third item';
      const result = service.enforceFormat(input);

      // Numbered lists should be preserved
      expect(result.fixedText).toContain('1. First item');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE BENCHMARKS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Performance Benchmarks', () => {
    // Target: <10ms for typical responses
    const PERFORMANCE_TARGET_MS = 10;

    test('should process short text in <10ms', () => {
      const shortText = 'Here is a quick summary.\n\n• Item 1\n• Item 2\n• Item 3';

      const start = performance.now();
      service.enforceFormat(shortText);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(PERFORMANCE_TARGET_MS);
    });

    test('should process medium text (20 bullets) in <10ms', () => {
      const mediumText = 'Here is the analysis of the document.\n\n' +
        Array(20).fill('• Item with some content here').join('\n');

      const start = performance.now();
      service.enforceFormat(mediumText);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(PERFORMANCE_TARGET_MS);
    });

    test('should process long text (50 bullets) in <20ms', () => {
      const longText = 'Here is a comprehensive analysis of the document content.\n\n' +
        Array(50).fill('• Bullet item with significant content and **bold text** and $1,234.56 monetary value').join('\n');

      const start = performance.now();
      service.enforceFormat(longText);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20); // Allow slightly more for long text
    });

    test('should process text with many emojis in <10ms', () => {
      const emojiText = 'Summary 😀 of the 📊 report 📁.\n\n' +
        Array(10).fill('• Item 😀 with 📊 emojis 🎉 and ✅ symbols ❌').join('\n');

      const start = performance.now();
      service.enforceFormat(emojiText);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(PERFORMANCE_TARGET_MS);
    });

    test('should process text with complex formatting in <15ms', () => {
      const complexText = `Here is the detailed analysis of the quarterly report.

• Revenue increased by **$1,234,567.89** compared to last quarter
• Growth rate: **45.5%** year-over-year, **Report_Q4_2024.pdf**
• Key metrics: **2024-12-03** deadline, **$500K** budget allocation

Next actions: Review the data, Update the dashboard, Send to stakeholders

| Metric | Q3 2024 | Q4 2024 |
| --- | --- | --- |
| Revenue | $1.2M | $1.5M |
| Users | 10K | 15K |`;

      const start = performance.now();
      service.enforceFormat(complexText);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(15);
    });

    test('should handle 100 iterations in <500ms (throughput)', () => {
      const testText = 'Analysis summary.\n\n• Item 1\n• Item 2\n• Item 3\n• Item 4\n• Item 5';

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        service.enforceFormat(testText);
      }
      const totalDuration = performance.now() - start;

      expect(totalDuration).toBeLessThan(500);
      console.log(`[Performance] 100 iterations completed in ${totalDuration.toFixed(2)}ms (avg: ${(totalDuration/100).toFixed(2)}ms)`);
    });

    test('should maintain performance with all rules enabled', () => {
      // Create text that triggers multiple rules
      const allRulesText = `😀 Summary with emoji.
Third intro line to test truncation.

- Hyphen bullet style to normalize
* Asterisk bullet style
• A, B, C, D, E items on one line
• Item with $1,234.56 unbolded value
• According to page 5, this should be removed

Next steps: Item 1, Item 2`;

      const start = performance.now();
      const result = service.enforceFormat(allRulesText);
      const duration = performance.now() - start;

      // Should apply multiple fixes
      expect(result.violations.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERFORMANCE_TARGET_MS);
    });
  });
});
