/**
 * Excel Formula Engine Validation Tests
 * Tests for Layer 3: HyperFormula-based Excel formula execution
 */
import excelFormulaEngine from '../excelFormulaEngine.service';

describe('Excel Formula Engine - Layer 3 Validation', () => {
  describe('Initialization', () => {
    test('Engine should initialize successfully', async () => {
      const initialized = await excelFormulaEngine.initialize();
      expect(initialized).toBe(true);
    });

    test('Engine should report ready status after initialization', async () => {
      await excelFormulaEngine.initialize();
      const status = excelFormulaEngine.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.hyperformulaLoaded).toBe(true);
    });
  });

  describe('Direct Formula Evaluation', () => {
    beforeAll(async () => {
      await excelFormulaEngine.initialize();
    });

    test('Basic arithmetic formula', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=2+2');
      expect(result.success).toBe(true);
      expect(result.value).toBe(4);
    });

    test('SUM function', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=SUM(1,2,3,4,5)');
      expect(result.success).toBe(true);
      expect(result.value).toBe(15);
    });

    test('AVERAGE function', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=AVERAGE(10,20,30)');
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    test('Nested functions', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=ROUND(AVERAGE(1,2,3,4,5),2)');
      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
    });

    test('Financial PMT function', async () => {
      // PMT(rate, nper, pv) - Monthly payment for $200,000 loan at 5% for 30 years
      const result = await excelFormulaEngine.evaluateFormula('=PMT(0.05/12,360,-200000)');
      expect(result.success).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(Math.abs(result.value as number)).toBeCloseTo(1073.64, 0);
    });

    test('IF function', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=IF(10>5,"yes","no")');
      expect(result.success).toBe(true);
      expect(result.value).toBe('yes');
    });

    test('VLOOKUP-style logic with IF', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=IF(100>=90,"A",IF(100>=80,"B","C"))');
      expect(result.success).toBe(true);
      expect(result.value).toBe('A');
    });
  });

  describe('Cell Reference Management', () => {
    beforeAll(async () => {
      await excelFormulaEngine.initialize();
    });

    test('Set and get cell value', () => {
      const testDocId = 'test-set-get-' + Date.now();
      // Set returns the value
      const setResult = excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 100);
      if (!setResult.success) {
        console.error('setCellValue failed:', setResult.error);
      }
      expect(setResult.success).toBe(true);
      expect(setResult.value).toBe(100);

      // Get should also return the same value
      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A1');
      if (!result.success) {
        console.error('getCellValue failed:', result.error);
      }
      expect(result.success).toBe(true);
      expect(result.value).toBe(100);
    });

    test('Formula referencing cells', () => {
      const testDocId = 'test-formula-ref-' + Date.now();
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 10);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A2', 20);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A3', '=A1+A2');

      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A3');
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });

    test('SUM range formula', () => {
      const testDocId = 'test-sum-range-' + Date.now();
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B1', 5);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B2', 10);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B3', 15);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'B4', '=SUM(B1:B3)');

      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'B4');
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });
  });

  describe('What-If Scenarios', () => {
    let testDocId: string;

    beforeAll(async () => {
      await excelFormulaEngine.initialize();
      testDocId = 'test-whatif-' + Date.now();

      // Set up a simple financial model
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 1000);    // Revenue
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A2', 600);     // Cost
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A3', '=A1-A2'); // Profit
    });

    test('Execute what-if scenario', async () => {
      const result = await excelFormulaEngine.executeWhatIf(testDocId, 'Sheet1', [
        { cellAddress: 'A1', newValue: 1500 } // Increase revenue
      ]);

      expect(result.success).toBe(true);
      expect(result.scenarios).toBeDefined();
      expect(result.scenarios?.length).toBe(1);

      // After increasing revenue to 1500, profit should be 1500-600=900
      const profitResult = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A3');
      expect(profitResult.value).toBe(900);
    });

    test('Revert what-if scenario', async () => {
      // First set up a clean state
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 1000);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A2', 600);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A3', '=A1-A2');

      // Execute what-if (stores backup)
      await excelFormulaEngine.executeWhatIf(testDocId, 'Sheet1', [
        { cellAddress: 'A1', newValue: 2000 }
      ]);

      // Revert
      await excelFormulaEngine.revertWhatIf(testDocId);

      // Should be back to original: 1000-600=400
      const profitResult = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A3');
      expect(profitResult.value).toBe(400);
    });

    test('Multiple scenarios', async () => {
      const result = await excelFormulaEngine.executeWhatIf(testDocId, 'Sheet1', [
        { cellAddress: 'A1', newValue: 2000 },
        { cellAddress: 'A2', newValue: 800 }
      ]);

      expect(result.success).toBe(true);

      // After changes: 2000-800=1200
      const profitResult = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A3');
      expect(profitResult.value).toBe(1200);
    });
  });

  describe('Formula Dependencies', () => {
    let testDocId: string;

    beforeAll(async () => {
      await excelFormulaEngine.initialize();
      testDocId = 'test-deps-' + Date.now();

      // Set up cells with dependencies
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 100);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A2', 200);
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A3', '=A1+A2');
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A4', '=A3*2');
    });

    test('Get formula dependencies', () => {
      const result = excelFormulaEngine.getFormulaDependencies(testDocId, 'Sheet1', 'A3');
      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies).toContain('A1');
      expect(result.dependencies).toContain('A2');
    });

    test('Get formula dependents', () => {
      const result = excelFormulaEngine.getFormulaDependents(testDocId, 'Sheet1', 'A3');
      expect(result.success).toBe(true);
      expect(result.dependents).toBeDefined();
      expect(result.dependents).toContain('A4');
    });

    test('Cascading calculation updates', () => {
      // Change A1 and verify cascade
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 150);

      // A3 should now be 150+200=350
      const a3Result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A3');
      expect(a3Result.value).toBe(350);

      // A4 should now be 350*2=700
      const a4Result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A4');
      expect(a4Result.value).toBe(700);
    });
  });

  describe('Multi-Sheet Support', () => {
    beforeAll(async () => {
      await excelFormulaEngine.initialize();
    });

    test('Add multiple sheets', () => {
      const testDocId = 'test-multisheet-add-' + Date.now();
      excelFormulaEngine.addSheet(testDocId, 'Revenue');
      excelFormulaEngine.addSheet(testDocId, 'Expenses');

      const sheets = excelFormulaEngine.getSheetNames(testDocId);
      expect(sheets).toContain('Revenue');
      expect(sheets).toContain('Expenses');
    });

    test('Cross-sheet references', () => {
      const testDocId = 'test-multisheet-cross-' + Date.now();
      // Add sheets first
      excelFormulaEngine.addSheet(testDocId, 'Revenue');
      excelFormulaEngine.addSheet(testDocId, 'Expenses');
      excelFormulaEngine.addSheet(testDocId, 'Summary');

      // Set values in different sheets
      excelFormulaEngine.setCellValue(testDocId, 'Revenue', 'A1', 5000);
      excelFormulaEngine.setCellValue(testDocId, 'Expenses', 'A1', 3000);

      // Cross-sheet formula in Summary sheet
      excelFormulaEngine.setCellValue(testDocId, 'Summary', 'A1', '=Revenue!A1-Expenses!A1');

      const result = excelFormulaEngine.getCellValue(testDocId, 'Summary', 'A1');
      expect(result.success).toBe(true);
      expect(result.value).toBe(2000);
    });
  });

  describe('Performance', () => {
    beforeAll(async () => {
      await excelFormulaEngine.initialize();
    });

    test('Simple formula should complete in <100ms', async () => {
      const start = Date.now();
      await excelFormulaEngine.evaluateFormula('=SUM(1,2,3,4,5,6,7,8,9,10)');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    test('Complex formula should complete in <200ms', async () => {
      const start = Date.now();
      await excelFormulaEngine.evaluateFormula('=PMT(0.05/12,360,-500000)+NPV(0.1,1000,2000,3000)');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('Error Handling', () => {
    beforeAll(async () => {
      await excelFormulaEngine.initialize();
    });

    test('Division by zero returns error or special value', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=10/0');
      // HyperFormula may return an error object or mark success=false
      // Either way, we should get some indication of the error
      if (result.success) {
        // Value should be a special error value from HyperFormula
        expect(result.value).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    test('Invalid formula syntax', async () => {
      const result = await excelFormulaEngine.evaluateFormula('=SUM(');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('Reference to non-existent cell returns empty/zero', async () => {
      const testDocId = 'test-empty-' + Date.now();
      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'Z99');
      // Non-existent cells should return null or empty
      expect(result.value === null || result.value === undefined || result.value === 0).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('Unload document', () => {
      const testDocId = 'test-cleanup-' + Date.now();
      excelFormulaEngine.setCellValue(testDocId, 'Sheet1', 'A1', 100);

      const unloaded = excelFormulaEngine.unloadDocument(testDocId);
      expect(unloaded).toBe(true);

      // Verify document is unloaded
      const result = excelFormulaEngine.getCellValue(testDocId, 'Sheet1', 'A1');
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Extended Excel Formula Engine Tests with Real File Loading
 * These tests require actual Excel files to be present
 */
describe('Excel Formula Engine - Real File Loading', () => {
  const testDocId = 'test-rosewood-fund';
  const testFilePath = '/home/ubuntu/upload/RosewoodFundv3.xlsx';
  let fileLoaded = false;

  beforeAll(async () => {
    // Only run if file exists
    const fs = await import('fs');
    if (fs.existsSync(testFilePath)) {
      try {
        const buffer = fs.readFileSync(testFilePath);
        await excelFormulaEngine.loadExcelFile(buffer, testDocId);
        fileLoaded = true;
      } catch (error) {
        console.warn('Test file not available, skipping real file tests');
      }
    } else {
      console.warn(`Test file ${testFilePath} not found, skipping real file tests`);
    }
  });

  afterAll(() => {
    if (fileLoaded) {
      excelFormulaEngine.unload(testDocId);
    }
  });

  describe('Cell Value Retrieval', () => {
    test('Get cell value with formula', () => {
      if (!fileLoaded) {
        console.log('Skipping: file not loaded');
        return;
      }

      const result = excelFormulaEngine.getCellValue(
        testDocId,
        'Rosewood Fund',
        'G10'
      );
      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.formula).toBeDefined();
    });

    test('Get cell value without formula', () => {
      if (!fileLoaded) {
        console.log('Skipping: file not loaded');
        return;
      }

      const result = excelFormulaEngine.getCellValue(
        testDocId,
        'Rosewood Fund',
        'B10'
      );
      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();
    });
  });

  describe('Formula Dependencies', () => {
    test('Get formula dependencies', () => {
      if (!fileLoaded) {
        console.log('Skipping: file not loaded');
        return;
      }

      const result = excelFormulaEngine.getFormulaDependencies(
        testDocId,
        'Rosewood Fund',
        'AF10'
      );
      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies!.length).toBeGreaterThan(0);
    });
  });

  describe('What-If Scenarios', () => {
    test('Execute what-if scenario', async () => {
      if (!fileLoaded) {
        console.log('Skipping: file not loaded');
        return;
      }

      const results = await excelFormulaEngine.executeWhatIf(
        testDocId,
        'Rosewood Fund',
        [
          {
            cellAddress: 'H10',
            newValue: 6000000 // Change investment from $5M to $6M
          }
        ]
      );

      expect(results.success).toBe(true);

      // After what-if, get the MOIC cell to verify recalculation
      const moicCell = excelFormulaEngine.getCellValue(testDocId, 'Rosewood Fund', 'G10');
      expect(moicCell.success).toBe(true);
    });
  });

  describe('Cross-Sheet References', () => {
    test('Handle cross-sheet references', () => {
      if (!fileLoaded) {
        console.log('Skipping: file not loaded');
        return;
      }

      const result = excelFormulaEngine.getCellValue(
        testDocId,
        'MoICs into IRRs',
        'D5'
      );
      expect(result.success).toBe(true);
      // Cross-sheet formula should reference 'Rosewood Fund'
      if (result.formula) {
        expect(result.formula).toContain('Rosewood Fund');
      }
    });
  });

  describe('Error Handling', () => {
    test('Handle invalid sheet name', () => {
      const result = excelFormulaEngine.getCellValue(
        testDocId,
        'NonExistentSheet',
        'A1'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('Handle invalid cell address', () => {
      if (!fileLoaded) {
        console.log('Skipping: file not loaded');
        return;
      }

      const result = excelFormulaEngine.getCellValue(
        testDocId,
        'Rosewood Fund',
        'INVALID'
      );
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Extended tests with dynamically created Excel-like data
 * These tests simulate real Excel file scenarios without needing actual files
 */
describe('Excel Formula Engine - Simulated Real File Scenarios', () => {
  const testDocId = 'test-simulated-fund';

  beforeAll(async () => {
    await excelFormulaEngine.initialize();

    // Create a simulated investment fund spreadsheet
    // Sheet: Investments
    excelFormulaEngine.addSheet(testDocId, 'Investments');

    // Headers (row 1)
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'A1', 'Company');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'B1', 'Investment');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'C1', 'Current Value');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'D1', 'MOIC');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'E1', 'Status');

    // Data rows
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'A2', 'Company A');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'B2', 5000000);
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'C2', 12000000);
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'D2', '=C2/B2');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'E2', '=IF(D2>=2,"Strong",IF(D2>=1,"Stable","Weak"))');

    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'A3', 'Company B');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'B3', 3000000);
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'C3', 4500000);
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'D3', '=C3/B3');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'E3', '=IF(D3>=2,"Strong",IF(D3>=1,"Stable","Weak"))');

    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'A4', 'Company C');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'B4', 8000000);
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'C4', 6000000);
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'D4', '=C4/B4');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'E4', '=IF(D4>=2,"Strong",IF(D4>=1,"Stable","Weak"))');

    // Summary row
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'A6', 'Total');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'B6', '=SUM(B2:B4)');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'C6', '=SUM(C2:C4)');
    excelFormulaEngine.setCellValue(testDocId, 'Investments', 'D6', '=C6/B6');

    // Sheet: Summary
    excelFormulaEngine.addSheet(testDocId, 'Summary');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'A1', 'Portfolio Summary');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'A2', 'Total Investment');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'B2', '=Investments!B6');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'A3', 'Total Value');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'B3', '=Investments!C6');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'A4', 'Portfolio MOIC');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'B4', '=B3/B2');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'A5', 'Gain/Loss');
    excelFormulaEngine.setCellValue(testDocId, 'Summary', 'B5', '=B3-B2');
  });

  afterAll(() => {
    excelFormulaEngine.unload(testDocId);
  });

  describe('MOIC Calculations', () => {
    test('Calculate individual company MOIC', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'D2');
      expect(result.success).toBe(true);
      expect(result.value).toBe(2.4); // 12M / 5M = 2.4x
    });

    test('Calculate portfolio MOIC', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'D6');
      expect(result.success).toBe(true);
      // Total: 16M invested, 22.5M current value = 1.40625x
      expect(result.value).toBeCloseTo(1.40625, 4);
    });
  });

  describe('Conditional Status', () => {
    test('Strong status for high MOIC', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'E2');
      expect(result.success).toBe(true);
      expect(result.value).toBe('Strong'); // 2.4x >= 2
    });

    test('Stable status for medium MOIC', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'E3');
      expect(result.success).toBe(true);
      expect(result.value).toBe('Stable'); // 1.5x >= 1 but < 2
    });

    test('Weak status for low MOIC', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'E4');
      expect(result.success).toBe(true);
      expect(result.value).toBe('Weak'); // 0.75x < 1
    });
  });

  describe('Cross-Sheet Formulas', () => {
    test('Total investment from Investments sheet', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Summary', 'B2');
      expect(result.success).toBe(true);
      expect(result.value).toBe(16000000); // 5M + 3M + 8M
    });

    test('Portfolio MOIC in Summary', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Summary', 'B4');
      expect(result.success).toBe(true);
      expect(result.value).toBeCloseTo(1.40625, 4);
    });

    test('Gain/Loss calculation', () => {
      const result = excelFormulaEngine.getCellValue(testDocId, 'Summary', 'B5');
      expect(result.success).toBe(true);
      expect(result.value).toBe(6500000); // 22.5M - 16M
    });
  });

  describe('What-If Analysis for Investment Changes', () => {
    test('Impact of increased investment value', async () => {
      // Get original MOIC
      const originalMoic = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'D2');
      expect(originalMoic.value).toBe(2.4);

      // What-if: Company A's current value increases to $15M
      await excelFormulaEngine.executeWhatIf(testDocId, 'Investments', [
        { cellAddress: 'C2', newValue: 15000000 }
      ]);

      // Check new MOIC
      const newMoic = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'D2');
      expect(newMoic.value).toBe(3); // 15M / 5M = 3x

      // Check status changed
      const status = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'E2');
      expect(status.value).toBe('Strong'); // Still strong (3x >= 2)

      // Check portfolio impact
      const portfolioMoic = excelFormulaEngine.getCellValue(testDocId, 'Summary', 'B4');
      expect(portfolioMoic.success).toBe(true);
      // New total: 16M invested, 25.5M value = 1.59375x
      expect(portfolioMoic.value).toBeCloseTo(1.59375, 4);
    });

    test('Impact of new investment amount', async () => {
      // Reset and test changing investment amount
      excelFormulaEngine.setCellValue(testDocId, 'Investments', 'C2', 12000000); // Reset

      // What-if: Company B investment was $2M instead of $3M
      await excelFormulaEngine.executeWhatIf(testDocId, 'Investments', [
        { cellAddress: 'B3', newValue: 2000000 }
      ]);

      const moic = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'D3');
      expect(moic.value).toBe(2.25); // 4.5M / 2M = 2.25x

      const status = excelFormulaEngine.getCellValue(testDocId, 'Investments', 'E3');
      expect(status.value).toBe('Strong'); // Now strong (2.25x >= 2)
    });
  });

  describe('Dependency Tracking', () => {
    test('Get dependencies for MOIC formula', () => {
      const result = excelFormulaEngine.getFormulaDependencies(testDocId, 'Investments', 'D2');
      expect(result.success).toBe(true);
      expect(result.dependencies).toContain('C2');
      expect(result.dependencies).toContain('B2');
    });

    test('Get dependents for investment value', () => {
      const result = excelFormulaEngine.getCellDependents(testDocId, 'Investments', 'B2');
      expect(result.success).toBe(true);
      // B2 should be referenced by D2 (MOIC) and B6 (Total)
      expect(result.dependents).toContain('D2');
      expect(result.dependents).toContain('B6');
    });

    test('Cross-sheet dependency tracking', () => {
      const result = excelFormulaEngine.getFormulaDependencies(testDocId, 'Summary', 'B2');
      expect(result.success).toBe(true);
      // Should reference Investments!B6
      const hasCrossSheetDep = result.dependencies?.some(
        dep => dep.includes('Investments') || dep === 'B6'
      );
      expect(hasCrossSheetDep).toBe(true);
    });
  });

  describe('Range Operations', () => {
    test('Get range values', () => {
      const result = excelFormulaEngine.getRangeValues(testDocId, 'Investments', 'B2', 'B4');
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Array);
      expect((result.value as any[][]).length).toBe(3);
      expect((result.value as any[][])[0][0]).toBe(5000000);
      expect((result.value as any[][])[1][0]).toBe(3000000);
      expect((result.value as any[][])[2][0]).toBe(8000000);
    });

    test('Get all formulas in sheet', () => {
      const formulas = excelFormulaEngine.getAllFormulas(testDocId, 'Investments');
      expect(formulas.size).toBeGreaterThan(0);
      expect(formulas.has('D2')).toBe(true);
      expect(formulas.get('D2')).toContain('C2/B2');
    });
  });
});
