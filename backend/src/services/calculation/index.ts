/**
 * Koda Calculation Engine
 *
 * Three-layer calculation system for 100% accuracy:
 *
 * Layer 1: Smart Calculator (Math.js + Formula.js)
 *   - Simple arithmetic: 2+2, 15% of 100
 *   - Financial functions: PMT, NPV, IRR, FV, PV
 *   - Statistical functions: AVERAGE, STDEV, VAR
 *   - Performance: 10-50ms
 *
 * Layer 2: Python Execution Engine
 *   - Complex analytics: regression, optimization
 *   - Matrix operations: inverse, determinant
 *   - Data analysis: numpy, pandas, scipy
 *   - Performance: 100-500ms
 *
 * Layer 3: Excel Formula Engine (HyperFormula)
 *   - Full Excel formula compatibility
 *   - Cell references and ranges
 *   - 400+ Excel functions
 *   - Performance: 20-100ms
 *
 * Usage:
 * ```typescript
 * import calculationEngine from './calculation';
 *
 * // Auto-detect and calculate
 * const result = await calculationEngine.calculate('2 + 2');
 * const financial = await calculationEngine.calculate('PMT for $500,000 loan at 6% for 30 years');
 * const excel = await calculationEngine.calculate('=SUM(A1:A10)');
 *
 * // Direct API
 * const pmt = await calculationEngine.calculateLoanPayment({ rate: 0.06, nper: 360, pv: 500000 });
 * const stats = await calculationEngine.calculateStatistics([1, 2, 3, 4, 5]);
 * ```
 */

// Main engine (unified interface)
export { default as calculationEngine, CalculationEngineService } from './calculationEngine.service';

// Individual services
export { default as calculationDetector } from './calculationDetector.service';
export { default as smartCalculator } from './smartCalculator.service';
export { default as pythonEngine } from './pythonEngine.service';
export { default as excelEngine } from './excelEngine.service';
export { default as excelFormulaEngine, ExcelFormulaEngineService } from './excelFormulaEngine.service';
export { default as calculationRouter } from './calculationRouter.service';
export { default as codeGenerator } from './codeGenerator.service';
export { default as pythonExecutor } from './pythonExecutor.service';

// Types
export * from './calculationTypes';

// Default export is the main engine
import calculationEngine from './calculationEngine.service';
export default calculationEngine;
