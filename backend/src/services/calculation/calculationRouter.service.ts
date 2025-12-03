/**
 * Calculation Router Service
 * Routes queries to the appropriate calculation engine
 */

import calculationDetector from './calculationDetector.service';
import smartCalculator from './smartCalculator.service';
import codeGenerator from './codeGenerator.service';
import pythonExecutor from './pythonExecutor.service';
import excelFormulaEngine from './excelFormulaEngine.service';
import { CalculationType } from './calculationTypes';

export interface RoutingResult {
  handled: boolean;
  response?: string;
  method?: string;
  executionTime?: number;
  result?: any;
  error?: string;
}

export interface CalculationContext {
  documentId?: string;
  sheetName?: string;
  cellData?: Record<string, any>;
  documentData?: any;
}

class CalculationRouterService {
  private initialized: boolean = false;

  /**
   * Initialize the router and all calculation engines
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await excelFormulaEngine.initialize();
      this.initialized = true;
      console.log('✅ [ROUTER] Calculation Router initialized');
    } catch (error) {
      console.error('[ROUTER] Initialization error:', error);
    }
  }

  /**
   * Route query to appropriate calculation engine
   */
  async routeQuery(query: string, context?: CalculationContext): Promise<RoutingResult> {
    const startTime = Date.now();

    // Ensure initialization
    if (!this.initialized) {
      await this.initialize();
    }

    // Step 1: Detect calculation type
    const detection = calculationDetector.detect(query);

    if (!detection.isCalculation) {
      return { handled: false };
    }

    console.log(`🧮 [ROUTER] Detected ${detection.type} (confidence: ${detection.confidence})`);

    // Step 2: Route to appropriate engine
    let response: string;
    let method: string;
    let result: any;

    try {
      switch (detection.type) {
        case CalculationType.SIMPLE_MATH:
          ({ response, method, result } = await this.handleSimpleMath(detection));
          break;

        case CalculationType.FINANCIAL:
          ({ response, method, result } = await this.handleFinancial(detection));
          break;

        case CalculationType.STATISTICAL:
          ({ response, method, result } = await this.handleStatistical(detection));
          break;

        case CalculationType.EXCEL_FORMULA:
          ({ response, method, result } = await this.handleExcelFormula(query, context));
          break;

        case CalculationType.COMPLEX:
          ({ response, method, result } = await this.handleComplex(query));
          break;

        default:
          return { handled: false };
      }

      return {
        handled: true,
        response,
        method,
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('[ROUTER] Calculation error:', error);
      return {
        handled: true,
        response: `I encountered an error while calculating: ${error.message}`,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Handle simple math calculations
   */
  private async handleSimpleMath(detection: any): Promise<{ response: string; method: string; result: any }> {
    // Check if this is a percentage calculation with parameters
    if (detection.parameters?.isPercentage) {
      const { percentage, total } = detection.parameters;
      const result = (percentage / 100) * total;
      const formatted = this.formatCurrency(result);

      const response = `**${percentage}%** of **${this.formatNumber(total)}** is **${formatted}**.\n\n` +
        `Calculation: (${percentage} ÷ 100) × ${this.formatNumber(total)} = ${this.formatNumber(result)}\n` +
        `⚡ Calculated instantly`;

      return {
        response,
        method: 'Smart Calculator (Native)',
        result
      };
    }

    // Standard expression evaluation
    const calcResult = smartCalculator.evaluateExpression(detection.expression);

    if (!calcResult.success) {
      throw new Error(calcResult.error || 'Evaluation failed');
    }

    const response = `The answer is **${calcResult.formatted}**.\n\n` +
      `Calculation: \`${detection.expression}\`\n` +
      `Result: ${calcResult.result}\n` +
      `⚡ Calculated in ${calcResult.executionTime}ms`;

    return {
      response,
      method: 'Smart Calculator (Math.js)',
      result: calcResult.result
    };
  }

  /**
   * Format number with commas
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /**
   * Format as currency
   */
  private formatCurrency(num: number): string {
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Handle financial calculations
   */
  private async handleFinancial(detection: any): Promise<{ response: string; method: string; result: any }> {
    const params = detection.parameters || {};
    const functionName = this.extractFinancialFunction(detection.expression);

    console.log(`💰 [FINANCIAL] Function: ${functionName}, Params:`, params);

    // Validate we have required parameters
    const hasRequiredParams = this.validateFinancialParams(functionName, params);

    if (!hasRequiredParams) {
      // Fallback to Python for cases where we couldn't extract params
      console.log(`💰 [FINANCIAL] Missing params for ${functionName}, falling back to Python`);
      return await this.handleComplex(detection.expression);
    }

    // Try to calculate
    const calcResult = smartCalculator.calculateFinancial(functionName, params);

    if (!calcResult.success || isNaN(calcResult.result as number)) {
      // Fallback to Python for complex financial calculations
      console.log(`💰 [FINANCIAL] Calculation failed, falling back to Python`);
      return await this.handleComplex(detection.expression);
    }

    // Format a nice response
    let response: string;
    switch (functionName) {
      case 'PMT':
        response = `The monthly payment is **${this.formatCurrency(Math.abs(calcResult.result as number))}**.\n\n` +
          `Loan Amount: ${this.formatCurrency(params.pv)}\n` +
          `Interest Rate: ${(params.rate * 100).toFixed(2)}% annual\n` +
          `Term: ${params.nper} periods\n` +
          `⚡ Calculated in ${calcResult.executionTime}ms`;
        break;
      case 'NPV':
        response = `The Net Present Value (NPV) is **${this.formatCurrency(calcResult.result as number)}**.\n\n` +
          `Discount Rate: ${(params.rate * 100).toFixed(2)}%\n` +
          `Cash Flows: [${params.cashFlows?.join(', ')}]\n` +
          `⚡ Calculated in ${calcResult.executionTime}ms`;
        break;
      case 'IRR':
        response = `The Internal Rate of Return (IRR) is **${((calcResult.result as number) * 100).toFixed(2)}%**.\n\n` +
          `Cash Flows: [${params.cashFlows?.join(', ')}]\n` +
          `⚡ Calculated in ${calcResult.executionTime}ms`;
        break;
      case 'FV':
        response = `The Future Value is **${this.formatCurrency(Math.abs(calcResult.result as number))}**.\n\n` +
          `Present Value: ${this.formatCurrency(params.pv)}\n` +
          `Interest Rate: ${(params.rate * 100).toFixed(2)}% annual\n` +
          `Term: ${params.nper} periods\n` +
          `⚡ Calculated in ${calcResult.executionTime}ms`;
        break;
      case 'PV':
        response = `The Present Value is **${this.formatCurrency(Math.abs(calcResult.result as number))}**.\n\n` +
          `Future Value: ${this.formatCurrency(params.fv || 0)}\n` +
          `Interest Rate: ${(params.rate * 100).toFixed(2)}% annual\n` +
          `Term: ${params.nper} periods\n` +
          `⚡ Calculated in ${calcResult.executionTime}ms`;
        break;
      default:
        response = `The ${functionName} is **${calcResult.formatted}**.\n\n` +
          `Parameters: ${JSON.stringify(params, null, 2)}\n` +
          `⚡ Calculated in ${calcResult.executionTime}ms`;
    }

    return {
      response,
      method: 'Smart Calculator (Formula.js)',
      result: calcResult.result
    };
  }

  /**
   * Validate we have required parameters for a financial function
   */
  private validateFinancialParams(functionName: string, params: Record<string, any>): boolean {
    switch (functionName) {
      case 'PMT':
        return params.rate !== undefined && params.nper !== undefined && params.pv !== undefined;
      case 'NPV':
        return params.rate !== undefined && params.cashFlows?.length > 0;
      case 'IRR':
        return params.cashFlows?.length > 0;
      case 'FV':
      case 'PV':
        return params.rate !== undefined && params.nper !== undefined;
      default:
        return true;
    }
  }

  /**
   * Extract financial function name from expression
   */
  private extractFinancialFunction(expression: string): string {
    const upperExpr = expression.toUpperCase();

    if (upperExpr.includes('IRR') || upperExpr.includes('INTERNAL RATE')) return 'IRR';
    if (upperExpr.includes('NPV') || upperExpr.includes('NET PRESENT')) return 'NPV';
    if (upperExpr.includes('PMT') || upperExpr.includes('PAYMENT')) return 'PMT';
    if (upperExpr.includes('FV') || upperExpr.includes('FUTURE VALUE')) return 'FV';
    if (upperExpr.includes('PV') || upperExpr.includes('PRESENT VALUE')) return 'PV';
    if (upperExpr.includes('RATE')) return 'RATE';

    return 'UNKNOWN';
  }

  /**
   * Handle statistical calculations
   */
  private async handleStatistical(detection: any): Promise<{ response: string; method: string; result: any }> {
    const params = detection.parameters || {};
    const functionName = this.extractStatisticalFunction(detection.expression);
    const values = params.values || this.extractNumbersFromExpression(detection.expression);

    const calcResult = smartCalculator.calculateStatistical(functionName, values);

    if (!calcResult.success) {
      throw new Error(calcResult.error || 'Statistical calculation failed');
    }

    const response = `The ${functionName} is **${calcResult.formatted}**.\n\n` +
      `Values: [${values.join(', ')}]\n` +
      `Result: ${calcResult.result}\n` +
      `⚡ Calculated in ${calcResult.executionTime}ms`;

    return {
      response,
      method: 'Smart Calculator (Formula.js)',
      result: calcResult.result
    };
  }

  /**
   * Extract statistical function name from expression
   */
  private extractStatisticalFunction(expression: string): string {
    const upperExpr = expression.toUpperCase();

    if (upperExpr.includes('AVERAGE') || upperExpr.includes('MEAN') || upperExpr.includes('AVG')) return 'AVERAGE';
    if (upperExpr.includes('MEDIAN')) return 'MEDIAN';
    if (upperExpr.includes('MODE')) return 'MODE';
    if (upperExpr.includes('STDEV') || upperExpr.includes('STANDARD DEVIATION')) return 'STDEV';
    if (upperExpr.includes('VARIANCE') || upperExpr.includes('VAR')) return 'VAR';
    if (upperExpr.includes('SUM')) return 'SUM';
    if (upperExpr.includes('MIN')) return 'MIN';
    if (upperExpr.includes('MAX')) return 'MAX';
    if (upperExpr.includes('COUNT')) return 'COUNT';

    return 'AVERAGE';
  }

  /**
   * Extract numbers from expression for statistical calculations
   */
  private extractNumbersFromExpression(expression: string): number[] {
    const numbers: number[] = [];
    const matches = expression.match(/[\d,]+(?:\.\d+)?/g);

    if (matches) {
      for (const match of matches) {
        const num = parseFloat(match.replace(/,/g, ''));
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
    }

    return numbers;
  }

  /**
   * Handle Excel formulas
   */
  private async handleExcelFormula(
    query: string,
    context?: CalculationContext
  ): Promise<{ response: string; method: string; result: any }> {
    // Check if we have document context
    if (context?.documentId && context?.sheetName) {
      // This is a query about a loaded document
      return this.handleExcelDocumentQuery(query, context);
    }

    // Direct formula evaluation
    const formula = query.trim().startsWith('=') ? query.trim() : query;
    const result = await excelFormulaEngine.evaluateFormula(formula);

    if (!result.success) {
      throw new Error(result.error || 'Formula evaluation failed');
    }

    const response = `Formula result: **${result.value}**\n\n` +
      `Formula: \`${result.formula}\`\n` +
      `⚡ Calculated in ${result.executionTime}ms`;

    return {
      response,
      method: 'Excel Formula Engine (HyperFormula)',
      result: result.value
    };
  }

  /**
   * Handle Excel document queries (when a document is loaded)
   */
  private async handleExcelDocumentQuery(
    query: string,
    context: CalculationContext
  ): Promise<{ response: string; method: string; result: any }> {
    const { documentId, sheetName } = context;

    if (!documentId || !sheetName) {
      throw new Error('Document context required for Excel document queries');
    }

    // Check if it's a cell reference query
    const cellMatch = query.match(/\b([A-Z]+\d+)\b/i);
    if (cellMatch) {
      const cellAddress = cellMatch[1].toUpperCase();
      const result = excelFormulaEngine.getCellValue(documentId, sheetName, cellAddress);

      if (!result.success) {
        throw new Error(result.error || 'Failed to get cell value');
      }

      let response = `Cell ${cellAddress} value: **${result.value}**`;
      if (result.formula) {
        response += `\nFormula: \`${result.formula}\``;
      }
      response += `\n⚡ Retrieved in ${result.executionTime}ms`;

      return {
        response,
        method: 'Excel Formula Engine (HyperFormula)',
        result: result.value
      };
    }

    // Check if it's a what-if query
    if (query.toLowerCase().includes('what if') || query.toLowerCase().includes('what-if')) {
      return this.handleWhatIfQuery(query, context);
    }

    // Default: try to evaluate as formula
    const result = await excelFormulaEngine.evaluateFormula(query);

    return {
      response: `Result: **${result.value}**`,
      method: 'Excel Formula Engine (HyperFormula)',
      result: result.value
    };
  }

  /**
   * Handle what-if scenario queries
   */
  private async handleWhatIfQuery(
    query: string,
    context: CalculationContext
  ): Promise<{ response: string; method: string; result: any }> {
    const { documentId, sheetName } = context;

    if (!documentId || !sheetName) {
      throw new Error('Document context required for what-if scenarios');
    }

    // Parse what-if parameters from query
    // Example: "What if H10 = 6000000"
    const changeMatch = query.match(/([A-Z]+\d+)\s*=\s*([\d.,]+)/i);

    if (!changeMatch) {
      throw new Error('Could not parse what-if scenario. Use format: "What if [CELL] = [VALUE]"');
    }

    const cellAddress = changeMatch[1].toUpperCase();
    const newValue = parseFloat(changeMatch[2].replace(/,/g, ''));

    const result = await excelFormulaEngine.executeWhatIf(documentId, sheetName, [
      { cellAddress, newValue }
    ]);

    if (!result.success) {
      throw new Error(result.error || 'What-if scenario failed');
    }

    const response = `What-if scenario applied:\n` +
      `Changed ${cellAddress} to ${newValue.toLocaleString()}\n\n` +
      `Dependent cells have been recalculated.\n` +
      `⚡ Scenario executed in ${result.executionTime}ms`;

    return {
      response,
      method: 'Excel Formula Engine (HyperFormula)',
      result: { changed: cellAddress, newValue }
    };
  }

  /**
   * Handle complex calculations (Python)
   */
  private async handleComplex(query: string): Promise<{ response: string; method: string; result: any }> {
    console.log('🐍 [PYTHON] Generating code...');

    // Generate Python code
    const codeGen = await codeGenerator.generateCalculationCode(query);

    if (!codeGen.success || !codeGen.code) {
      throw new Error(codeGen.error || 'Failed to generate code');
    }

    // Validate code
    const validation = pythonExecutor.validateCode(codeGen.code);

    if (!validation.valid) {
      throw new Error(`Security validation failed: ${validation.reason}`);
    }

    // Execute code
    const execution = await pythonExecutor.executePython(codeGen.code);

    if (!execution.success) {
      throw new Error(execution.error || 'Execution failed');
    }

    const response = `${execution.output}\n\n` +
      `${codeGen.explanation ? `**How I calculated this**: ${codeGen.explanation}\n\n` : ''}` +
      `🐍 Executed Python code in ${execution.executionTime}ms`;

    return {
      response,
      method: 'Python Execution (Manus Method)',
      result: execution.output
    };
  }

  /**
   * Route a direct formula evaluation
   */
  async evaluateFormula(formula: string): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      const result = await excelFormulaEngine.evaluateFormula(formula);

      if (!result.success) {
        return {
          handled: true,
          error: result.error,
          executionTime: Date.now() - startTime
        };
      }

      return {
        handled: true,
        response: `${result.value}`,
        result: result.value,
        method: 'HyperFormula',
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        handled: true,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Route a financial calculation
   */
  async calculateFinancial(operation: string, params: Record<string, any>): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      const result = smartCalculator.calculateFinancial(operation, params);

      if (!result.success) {
        // Fallback to Python
        const pythonResult = await pythonExecutor.executeFinancialCalculation(operation, params);
        return {
          handled: true,
          response: pythonResult.output,
          result: pythonResult.output,
          method: 'Python',
          executionTime: Date.now() - startTime
        };
      }

      return {
        handled: true,
        response: result.formatted,
        result: result.result,
        method: 'Formula.js',
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        handled: true,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Route a statistical calculation
   */
  async calculateStatistical(operation: string, values: number[]): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      const result = smartCalculator.calculateStatistical(operation, values);

      if (!result.success) {
        // Fallback to Python
        const pythonResult = await pythonExecutor.executeStatisticalCalculation(operation, values);
        return {
          handled: true,
          response: pythonResult.output,
          result: pythonResult.output,
          method: 'Python',
          executionTime: Date.now() - startTime
        };
      }

      return {
        handled: true,
        response: result.formatted,
        result: result.result,
        method: 'Native',
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        handled: true,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get router status
   */
  getStatus(): {
    initialized: boolean;
    excelEngineStatus: any;
    pythonAvailable: Promise<boolean>;
  } {
    return {
      initialized: this.initialized,
      excelEngineStatus: excelFormulaEngine.getStatus(),
      pythonAvailable: pythonExecutor.checkPythonAvailable()
    };
  }
}

export default new CalculationRouterService();
