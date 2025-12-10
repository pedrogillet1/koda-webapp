/**
 * Excel Query Handler Validation Tests
 * Tests for Excel-specific queries in the RAG service
 */
import excelFormulaEngine from '../excelFormulaEngine.service';

describe('Excel Query Handler - RAG Integration', () => {
  let testDocId: string;

  beforeAll(async () => {
    // Initialize the Excel Formula Engine
    await excelFormulaEngine.initialize();

    // Create a test document with sample data
    testDocId = 'test-excel-query-' + Date.now();

    // Set up a simple financial model
    // Revenue
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 'Revenue');
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B1', 10000);

    // Costs
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A2', 'Costs');
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B2', 6000);

    // Profit (formula)
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A3', 'Profit');
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B3', '=B1-B2');

    // Margin % (formula)
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A4', 'Margin %');
    excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B4', '=B3/B1');
  });

  afterAll(() => {
    // Clean up
    excelFormulaEngine.unloadDocument(testDocId);
  });

  describe('Document Loading', () => {
    test('Test document should be loaded', () => {
      expect(excelFormulaEngine.isLoaded(testDocId)).toBe(true);
    });

    test('Non-existent document should not be loaded', () => {
      expect(excelFormulaEngine.isLoaded('non-existent-doc')).toBe(false);
    });
  });

  describe('Cell Value Queries', () => {
    test('Get direct value cell', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B1');
      expect(result.success).toBe(true);
      expect(result.value).toBe(10000);
    });

    test('Get formula cell value', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(result.success).toBe(true);
      expect(result.value).toBe(4000); // 10000 - 6000
    });

    test('Get formula cell with formula info', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(result.success).toBe(true);
      expect(result.formula).toBeDefined();
      // Formula should contain the reference to B1 and B2
    });
  });

  describe('Formula Dependencies', () => {
    test('Get dependencies of profit cell', () => {
      const result = excelFormulaEngine.getFormulaDependencies(testDocId, 'Sheet1', 'B3');
      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies).toContain('B1');
      expect(result.dependencies).toContain('B2');
    });

    test('Direct value cell has no dependencies', () => {
      const result = excelFormulaEngine.getFormulaDependencies(testDocId, 'Sheet1', 'B1');
      expect(result.success).toBe(true);
      // Direct value cells should have empty or no dependencies
    });
  });

  describe('Formula Dependents', () => {
    test('Revenue cell affects Profit and Margin', () => {
      const result = excelFormulaEngine.getFormulaDependents(testDocId, 'Sheet1', 'B1');
      expect(result.success).toBe(true);
      expect(result.dependents).toBeDefined();
      expect(result.dependents).toContain('B3'); // Profit depends on Revenue
      expect(result.dependents).toContain('B4'); // Margin depends on Revenue via Profit
    });

    test('Profit cell affects Margin', () => {
      const result = excelFormulaEngine.getFormulaDependents(testDocId, 'Sheet1', 'B3');
      expect(result.success).toBe(true);
      expect(result.dependents).toBeDefined();
      expect(result.dependents).toContain('B4'); // Margin depends on Profit
    });
  });

  describe('What-If Scenarios', () => {
    test('What-if: Increase revenue', async () => {
      // Get original profit
      const originalProfit = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(originalProfit.value).toBe(4000);

      // Execute what-if: Revenue = 15000
      const whatIfResult = await excelFormulaEngine.executeWhatIf(testDocId, 'Sheet1', [
        { cellAddress: 'B1', newValue: 15000 }
      ]);
      expect(whatIfResult.success).toBe(true);

      // Check new profit value
      const newProfit = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(newProfit.value).toBe(9000); // 15000 - 6000

      // Revert changes
      await excelFormulaEngine.revertWhatIf(testDocId);

      // Verify restored to original
      const restoredProfit = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(restoredProfit.value).toBe(4000);
    });

    test('What-if: Decrease costs', async () => {
      // Execute what-if: Costs = 4000
      await excelFormulaEngine.executeWhatIf(testDocId, 'Sheet1', [
        { cellAddress: 'B2', newValue: 4000 }
      ]);

      // Check new profit value
      const newProfit = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(newProfit.value).toBe(6000); // 10000 - 4000

      // Revert
      await excelFormulaEngine.revertWhatIf(testDocId);
    });

    test('What-if: Multiple changes', async () => {
      // Execute what-if: Revenue = 20000, Costs = 8000
      await excelFormulaEngine.executeWhatIf(testDocId, 'Sheet1', [
        { cellAddress: 'B1', newValue: 20000 },
        { cellAddress: 'B2', newValue: 8000 }
      ]);

      // Check new profit
      const newProfit = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(newProfit.value).toBe(12000); // 20000 - 8000

      // Revert
      await excelFormulaEngine.revertWhatIf(testDocId);

      // Verify restoration
      const restoredProfit = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      expect(restoredProfit.value).toBe(4000);
    });
  });

  describe('Query Pattern Detection', () => {
    // These test the regex patterns used in the RAG service

    test('Cell value query patterns', () => {
      const patterns = [
        /what(?:'s| is) the (?:value|formula) (?:in|of|for) cell ([A-Z]+\d+)/i,
        /show me cell ([A-Z]+\d+)/i,
        /get (?:the )?(?:value of )?([A-Z]+\d+)/i,
      ];

      const testQueries = [
        { query: "What's the value in cell B3?", expected: 'B3' },
        { query: "What is the formula for cell B4?", expected: 'B4' },
        { query: "Show me cell A1", expected: 'A1' },
        { query: "Get the value of C5", expected: 'C5' },
        { query: "Get B2", expected: 'B2' },
      ];

      for (const { query, expected } of testQueries) {
        let matched = false;
        for (const pattern of patterns) {
          const match = query.match(pattern);
          if (match) {
            expect(match[1]).toBe(expected);
            matched = true;
            break;
          }
        }
        expect(matched).toBe(true);
      }
    });

    test('What-if query patterns', () => {
      const pattern = /what if ([A-Z]+\d+) (?:is|equals|=|was|were) (.+)/i;

      const testQueries = [
        { query: "What if B1 is 15000?", cell: 'B1', value: '15000?' },
        { query: "What if A3 equals 100", cell: 'A3', value: '100' },
        { query: "What if C2 = $5,000", cell: 'C2', value: '$5,000' },
        { query: "What if B2 was 4000", cell: 'B2', value: '4000' },
      ];

      for (const { query, cell, value } of testQueries) {
        const match = query.match(pattern);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(cell);
        expect(match![2]).toBe(value);
      }
    });

    test('Dependency query patterns', () => {
      const patterns = [
        /how is ([A-Z]+\d+) calculated/i,
        /what cells? (?:does|do) ([A-Z]+\d+) depend on/i,
      ];

      const testQueries = [
        { query: "How is B3 calculated?", expected: 'B3' },
        { query: "What cells does B4 depend on?", expected: 'B4' },
        { query: "What cell do A5 depend on?", expected: 'A5' },
      ];

      for (const { query, expected } of testQueries) {
        let matched = false;
        for (const pattern of patterns) {
          const match = query.match(pattern);
          if (match) {
            expect(match[1]).toBe(expected);
            matched = true;
            break;
          }
        }
        expect(matched).toBe(true);
      }
    });

    test('Dependents query patterns', () => {
      const pattern = /what cells? (?:are affected by|use) ([A-Z]+\d+)/i;

      const testQueries = [
        { query: "What cells are affected by B1?", expected: 'B1' },
        { query: "What cells use A2?", expected: 'A2' },
      ];

      for (const { query, expected } of testQueries) {
        const match = query.match(pattern);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(expected);
      }
    });
  });

  describe('Edge Cases', () => {
    test('Empty cell returns appropriate value', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'Z99');
      expect(result.success).toBe(true);
      // Empty cell should return null or undefined
    });

    test('Invalid cell address handling', () => {
      // This should not throw, but return an error result
      try {
        const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'InvalidAddress');
        expect(result.success).toBe(false);
      } catch (error) {
        // Expected - invalid address may throw
        expect(error).toBeDefined();
      }
    });

    test('Non-existent sheet handling', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'NonExistentSheet', 'A1');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('Cell value retrieval should be fast', () => {
      const start = Date.now();

      // Perform 100 cell value retrievals
      for (let i = 0; i < 100; i++) {
        excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B3');
      }

      const elapsed = Date.now() - start;
      // 100 retrievals should complete in under 100ms
      expect(elapsed).toBeLessThan(100);
    });

    test('What-if scenario should be fast', async () => {
      const start = Date.now();

      await excelFormulaEngine.executeWhatIf(testDocId, 'Sheet1', [
        { cellAddress: 'B1', newValue: 50000 }
      ]);
      await excelFormulaEngine.revertWhatIf(testDocId);

      const elapsed = Date.now() - start;
      // What-if + revert should complete in under 50ms
      expect(elapsed).toBeLessThan(50);
    });
  });
});
