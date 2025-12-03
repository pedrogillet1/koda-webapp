/**
 * Calculation Detector Service
 *
 * Detects calculation intent from user queries and determines
 * which calculation engine should handle the request.
 */

import {
  CalculationType,
  CalculationDetectionResult,
  FINANCIAL_FUNCTIONS,
  STATISTICAL_FUNCTIONS,
  MATH_FUNCTIONS,
  ALL_FUNCTIONS
} from './calculationTypes';

class CalculationDetectorService {
  // Patterns for detecting different calculation types
  private readonly SIMPLE_MATH_PATTERNS = [
    // Basic arithmetic: 2+2, 100-50, 5*3, 20/4
    /^\s*[\d.]+\s*[+\-*/]\s*[\d.]+(\s*[+\-*/]\s*[\d.]+)*\s*$/,
    // Parentheses: (25 * 4) + 10
    /^\s*[\d.+\-*/().\s]+\s*$/,
    // Percentage: 20% of 500, 15 percent of 1000
    /(\d+(?:\.\d+)?)\s*%?\s*(?:percent)?\s+(?:of|from)\s+(\d+(?:\.\d+)?)/i,
    // What is X% of Y
    /what\s+is\s+(\d+(?:\.\d+)?)\s*%?\s*(?:percent)?\s+of\s+(\d+(?:\.\d+)?)/i,
    // Calculate X + Y
    /(?:calculate|compute|what\s+is|solve)\s+([\d+\-*/().\s]+)/i,
  ];

  private readonly FINANCIAL_PATTERNS = [
    // Monthly payment, PMT
    /(?:monthly|annual|payment|pmt)\s+(?:for|on|of)\s+(?:a\s+)?(?:loan|mortgage|investment)/i,
    // Loan calculations
    /(?:loan|mortgage)\s+(?:payment|amount|interest)/i,
    // Interest rate calculations
    /(?:interest\s+rate|rate\s+of\s+return|annual\s+rate)/i,
    // NPV, IRR mentions
    /\b(?:npv|irr|xirr|xnpv|present\s+value|future\s+value|net\s+present)\b/i,
    // Investment return
    /(?:investment|return|roi)\s+(?:of|on|from)/i,
    // Compound interest
    /compound\s+interest/i,
    // Depreciation
    /(?:depreciation|amortization|straight.?line)/i,
  ];

  private readonly STATISTICAL_PATTERNS = [
    // Average, mean
    /(?:average|mean|avg)\s+(?:of|for)/i,
    // Standard deviation
    /(?:standard\s+deviation|std\s*dev|stdev)/i,
    // Variance
    /\bvariance\b/i,
    // Correlation
    /\bcorrelation\b/i,
    // Percentile, quartile
    /(?:percentile|quartile|median)/i,
    // Count operations
    /(?:count|how\s+many)\s+(?:of|in|where)/i,
  ];

  private readonly EXCEL_FORMULA_PATTERNS = [
    // Starts with = (Excel formula style)
    /^\s*=/,
    // Contains cell references like A1, B2, etc.
    /\b[A-Z]+\d+(?::[A-Z]+\d+)?\b/,
    // Function calls with parentheses
    new RegExp(`\\b(${ALL_FUNCTIONS.join('|')})\\s*\\(`, 'i'),
  ];

  private readonly COMPLEX_PATTERNS = [
    // Multi-step calculations
    /(?:then|after\s+that|next|first.*then)/i,
    // Data analysis requests
    /(?:analyze|regression|trend|forecast|predict)/i,
    // Matrix operations
    /(?:matrix|determinant|inverse|transpose)/i,
    // Optimization
    /(?:optimize|maximize|minimize|solver)/i,
  ];

  /**
   * Detect if a query contains a calculation request
   */
  detect(query: string): CalculationDetectionResult {
    const trimmedQuery = query.trim();

    // Skip document generation requests
    if (this.isDocumentQuery(trimmedQuery)) {
      return {
        isCalculation: false,
        type: CalculationType.NONE,
        confidence: 1.0
      };
    }

    // Check for Excel formula first (highest priority)
    if (this.isExcelFormula(trimmedQuery)) {
      return {
        isCalculation: true,
        type: CalculationType.EXCEL_FORMULA,
        expression: this.extractExcelFormula(trimmedQuery),
        confidence: 0.95
      };
    }

    // Check for simple math expressions
    const simpleMathResult = this.checkSimpleMath(trimmedQuery);
    if (simpleMathResult.isCalculation) {
      return simpleMathResult;
    }

    // Check for financial calculations
    if (this.isFinancialCalculation(trimmedQuery)) {
      return {
        isCalculation: true,
        type: CalculationType.FINANCIAL,
        expression: trimmedQuery,
        confidence: 0.85,
        parameters: this.extractFinancialParams(trimmedQuery)
      };
    }

    // Check for statistical calculations
    if (this.isStatisticalCalculation(trimmedQuery)) {
      return {
        isCalculation: true,
        type: CalculationType.STATISTICAL,
        expression: trimmedQuery,
        confidence: 0.80
      };
    }

    // Check for complex calculations requiring Python
    if (this.isComplexCalculation(trimmedQuery)) {
      return {
        isCalculation: true,
        type: CalculationType.COMPLEX,
        expression: trimmedQuery,
        confidence: 0.75
      };
    }

    return {
      isCalculation: false,
      type: CalculationType.NONE,
      confidence: 1.0
    };
  }

  /**
   * Check if query is a document generation request
   */
  private isDocumentQuery(query: string): boolean {
    const documentPatterns = [
      /(?:create|make|generate|write).*(?:summary|report|document|analysis)/i,
      /(?:summarize|summary).*(?:documents?|files?|papers?)/i,
      /(?:report|summary).*(?:of|from|based\s+on).*(?:documents?|files?)/i,
    ];

    return documentPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Check for Excel formula
   */
  private isExcelFormula(query: string): boolean {
    return this.EXCEL_FORMULA_PATTERNS.some(pattern => pattern.test(query));
  }

  /**
   * Extract Excel formula from query
   */
  private extractExcelFormula(query: string): string {
    // If query starts with =, return it directly
    if (query.trim().startsWith('=')) {
      return query.trim();
    }

    // Look for formula in the query
    const formulaMatch = query.match(/=([A-Z]+\(.*\))/i);
    if (formulaMatch) {
      return '=' + formulaMatch[1];
    }

    return query;
  }

  /**
   * Check for simple math expressions
   */
  private checkSimpleMath(query: string): CalculationDetectionResult {
    // =========================================
    // CHECK PERCENTAGE CALCULATIONS FIRST
    // =========================================
    // Must come before general patterns to avoid stripping "of"

    // Pattern: "X% of Y" or "X percent of Y" (with optional currency/commas)
    const percentOfMatch = query.match(/(\d+(?:\.\d+)?)\s*%\s*(?:percent)?\s*(?:of)\s*\$?([\d,]+(?:\.\d+)?)/i);
    if (percentOfMatch) {
      const percentage = parseFloat(percentOfMatch[1]);
      const total = parseFloat(percentOfMatch[2].replace(/,/g, ''));
      return {
        isCalculation: true,
        type: CalculationType.SIMPLE_MATH,
        expression: `${percentage}% of ${total}`,
        confidence: 0.95,
        parameters: {
          percentage,
          total,
          isPercentage: true
        }
      };
    }

    // Pattern: "What is X% of Y?" or "What's X% of Y?"
    const whatIsPercentMatch = query.match(/what(?:'s|\s+is)\s+(\d+(?:\.\d+)?)\s*%\s*(?:of)\s*\$?([\d,]+(?:\.\d+)?)/i);
    if (whatIsPercentMatch) {
      const percentage = parseFloat(whatIsPercentMatch[1]);
      const total = parseFloat(whatIsPercentMatch[2].replace(/,/g, ''));
      return {
        isCalculation: true,
        type: CalculationType.SIMPLE_MATH,
        expression: `${percentage}% of ${total}`,
        confidence: 0.95,
        parameters: {
          percentage,
          total,
          isPercentage: true
        }
      };
    }

    // Pattern: "Calculate X% of Y"
    const calcPercentMatch = query.match(/(?:calculate|compute)\s+(\d+(?:\.\d+)?)\s*%\s*(?:of)\s*\$?([\d,]+(?:\.\d+)?)/i);
    if (calcPercentMatch) {
      const percentage = parseFloat(calcPercentMatch[1]);
      const total = parseFloat(calcPercentMatch[2].replace(/,/g, ''));
      return {
        isCalculation: true,
        type: CalculationType.SIMPLE_MATH,
        expression: `${percentage}% of ${total}`,
        confidence: 0.95,
        parameters: {
          percentage,
          total,
          isPercentage: true
        }
      };
    }

    // =========================================
    // CHECK GENERAL MATH PATTERNS
    // =========================================
    for (const pattern of this.SIMPLE_MATH_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        // Extract the mathematical expression
        let expression = this.extractMathExpression(query);

        return {
          isCalculation: true,
          type: CalculationType.SIMPLE_MATH,
          expression,
          confidence: 0.90
        };
      }
    }

    return {
      isCalculation: false,
      type: CalculationType.NONE,
      confidence: 1.0
    };
  }

  /**
   * Extract mathematical expression from query
   */
  private extractMathExpression(query: string): string {
    // Remove non-math characters but keep operators and numbers
    let expression = query.replace(/[^0-9+\-*/().%\s]/g, '').trim();

    // If empty, try to extract from natural language
    if (!expression || expression.length < 2) {
      const match = query.match(/(?:calculate|compute|what\s+is|solve)\s+([\d+\-*/().\s]+)/i);
      if (match) {
        expression = match[1].trim();
      }
    }

    return expression || query;
  }

  /**
   * Check for financial calculations
   */
  private isFinancialCalculation(query: string): boolean {
    // Check patterns
    if (this.FINANCIAL_PATTERNS.some(pattern => pattern.test(query))) {
      return true;
    }

    // Check for financial function names
    const upperQuery = query.toUpperCase();
    return FINANCIAL_FUNCTIONS.some(func => upperQuery.includes(func));
  }

  /**
   * Extract financial parameters from query
   */
  private extractFinancialParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};

    // =========================================
    // EXTRACT RATE (percentage)
    // =========================================
    // Patterns: "5% rate", "at 10%", "10% discount rate", "5% for"
    const ratePatterns = [
      /(\d+(?:\.\d+)?)\s*%\s*(?:rate|interest|annual|discount)/i,
      /(?:at|@)\s*(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*(?:for|over)/i,
      /rate[:\s]+(\d+(?:\.\d+)?)\s*%/i,
    ];

    for (const pattern of ratePatterns) {
      const match = query.match(pattern);
      if (match) {
        params.rate = parseFloat(match[1]) / 100;
        break;
      }
    }

    // =========================================
    // EXTRACT PRESENT VALUE / PRINCIPAL
    // =========================================
    // Patterns: "$200,000 present value", "$200,000 loan", "PV $200,000"
    const pvPatterns = [
      /\$\s*([\d,]+(?:\.\d+)?)\s*(?:present\s*value|pv|loan|principal|mortgage|investment)/i,
      /(?:present\s*value|pv|loan|principal)[:\s]+\$?\s*([\d,]+(?:\.\d+)?)/i,
      /\$\s*([\d,]+(?:\.\d+)?)/i,  // Fallback: just $ amount
    ];

    for (const pattern of pvPatterns) {
      const match = query.match(pattern);
      if (match) {
        params.pv = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // =========================================
    // EXTRACT NUMBER OF PERIODS
    // =========================================
    // Patterns: "360 periods", "30 years", "12 months"
    const periodPatterns = [
      /(\d+)\s*periods?/i,
      /(\d+)\s*years?/i,
      /(\d+)\s*months?/i,
    ];

    for (const pattern of periodPatterns) {
      const match = query.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        const isMonths = /months?/i.test(pattern.source);
        const isPeriods = /periods?/i.test(pattern.source);
        // If periods, use directly; if months, use directly; if years, multiply by 12
        params.nper = isPeriods || isMonths ? value : value * 12;
        break;
      }
    }

    // =========================================
    // EXTRACT CASH FLOWS (for NPV, IRR)
    // =========================================
    // Pattern: "cash flows: -100000, 30000, 40000" or "cash flows -100000, 30000"
    const cashFlowMatch = query.match(/cash\s*flows?[:\s]+(-?[\d,.\s]+(?:,\s*-?[\d,.]+)*)/i);
    if (cashFlowMatch) {
      const flowStr = cashFlowMatch[1];
      const flows = flowStr.split(/,\s*/).map(f => parseFloat(f.replace(/,/g, '').trim())).filter(f => !isNaN(f));
      if (flows.length > 0) {
        params.cashFlows = flows;
      }
    }

    return params;
  }

  /**
   * Check for statistical calculations
   */
  private isStatisticalCalculation(query: string): boolean {
    // Check patterns
    if (this.STATISTICAL_PATTERNS.some(pattern => pattern.test(query))) {
      return true;
    }

    // Check for statistical function names
    const upperQuery = query.toUpperCase();
    return STATISTICAL_FUNCTIONS.some(func => upperQuery.includes(func));
  }

  /**
   * Check for complex calculations requiring Python
   */
  private isComplexCalculation(query: string): boolean {
    return this.COMPLEX_PATTERNS.some(pattern => pattern.test(query));
  }

  /**
   * Determine the best engine for a calculation
   */
  getBestEngine(detection: CalculationDetectionResult): 'mathjs' | 'formulajs' | 'hyperformula' | 'python' {
    switch (detection.type) {
      case CalculationType.SIMPLE_MATH:
        return 'mathjs';

      case CalculationType.FINANCIAL:
      case CalculationType.STATISTICAL:
        return 'formulajs';

      case CalculationType.EXCEL_FORMULA:
        return 'hyperformula';

      case CalculationType.COMPLEX:
        return 'python';

      default:
        return 'mathjs';
    }
  }

  /**
   * Extract numbers from text for calculation context
   */
  extractNumbersFromContext(text: string): number[] {
    const numbers: number[] = [];

    // Match various number formats
    const patterns = [
      /\$?\s*([\d,]+(?:\.\d+)?)\s*(?:billion|B)/gi,
      /\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|M)/gi,
      /\$?\s*([\d,]+(?:\.\d+)?)\s*(?:thousand|K)/gi,
      /\$?\s*([\d,]+(?:\.\d+)?)/g,
    ];

    const multipliers = [1e9, 1e6, 1e3, 1];

    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[1].replace(/,/g, '')) * multipliers[index];
        if (!isNaN(value) && isFinite(value) && !numbers.includes(value)) {
          numbers.push(value);
        }
      }
    });

    return numbers;
  }
}

export default new CalculationDetectorService();
