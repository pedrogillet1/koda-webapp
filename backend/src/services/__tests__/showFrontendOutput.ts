/**
 * Script to show exact frontend output for stress test cases
 * Run with: npx jest showFrontendOutput --no-coverage
 */

import formatEnforcement from '../formatEnforcement.service';

describe('Frontend Output Examples', () => {
  beforeAll(() => {
    formatEnforcement.setConfig({ enableLogging: false });
  });

  const testCases = [
    {
      name: '1. Response with all violation types',
      input: `😀 Here is a comprehensive analysis. According to page 5, the data shows growth. This is a third line of intro that is too long.

- Revenue was $1,234,567.89 (up 45.5%)
* Key file: Report_2024.pdf shows the data
• Multiple items: A, B, C, D, E, F, G
• Empty bullet below
•
• Another item

This paragraph after bullets should be removed.`
    },
    {
      name: '2. Complex nested brackets',
      input: `Summary of data analysis:

• Item with (nested [brackets, more], data), second part
• File **Report.pdf** (contains {key: value, other: data}), description
• Multiple values: $100, $200, $300, $400, $500`
    },
    {
      name: '3. Multilingual citations',
      input: `De acordo com a página 5, os dados mostram crescimento.
Según el documento 3, hay aumento.
According to page 7, the metrics improved.

• Item 1
• Item 2`
    },
    {
      name: '4. Next actions section',
      input: `Summary of findings:

• Finding 1 with $500 value
• Finding 2 with 25% increase

Next actions:

• Review data
• Update report`
    },
    {
      name: '5. Unicode 12.0+ emojis',
      input: `Here is the summary 🥱🤿🪐🦩🩸:

• Item 1
• Item 2`
    },
    {
      name: '6. Many items split (6 items → 2 bullets)',
      input: `Document overview:

• File1.pdf, File2.xlsx, File3.docx, File4.pptx, File5.csv, File6.txt
• Another bullet point`
    },
    {
      name: '7. Trailing periods removed from short bullets',
      input: `Quick summary:

• Short item.
• Another short one.
• This is a longer bullet point that has more content and context.`
    },
    {
      name: '8. Auto-bold values (money, %, dates, files)',
      input: `Financial summary:

• Revenue: $1,234.56 increased by 45%
• Report date: 2024-12-03
• See file: Budget2024.xlsx for details`
    }
  ];

  test.each(testCases)('$name', ({ name, input }) => {
    const result = formatEnforcement.enforceFormat(input);

    console.log('\n' + '='.repeat(80));
    console.log(`📋 ${name}`);
    console.log('='.repeat(80));
    console.log('\n📥 INPUT:\n');
    console.log(input);
    console.log('\n📤 FRONTEND OUTPUT:\n');
    console.log(result.fixedText);
    console.log('\n✅ Violations fixed:', result.violations.length);
    console.log('-'.repeat(80));

    expect(result.fixedText).toBeDefined();
  });
});
