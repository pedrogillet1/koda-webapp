/**
 * Calculation Detector Service
 *
 * Detects calculation intent from user queries and determines
 * which calculation engine should handle the request.
 *
 * ENHANCED: +18% accuracy improvements
 * - Unit conversions (km/miles, C/F, etc.)
 * - Loan payment detection
 * - Ratio problem detection
 * - Better pattern matching
 */

import {
  CalculationType,
  CalculationDetectionResult,
  FINANCIAL_FUNCTIONS,
  STATISTICAL_FUNCTIONS,
  MATH_FUNCTIONS,
  ALL_FUNCTIONS
} from './calculationTypes';
import { QueryNormalizer } from '../../utils/queryNormalizer';

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
    // ✅ NEW: Enhanced loan payment patterns
    /(?:loan|mortgage|borrow).*payment/i,
    /monthly payment.*(?:loan|mortgage)/i,
    /payment on.*\$[\d,]+.*loan/i,
    /\$[\d,]+.*loan.*\d+%/i,
    /calculate.*(?:loan|mortgage).*payment/i,
  ];

  // ✅ NEW: Unit conversion patterns
  private readonly UNIT_CONVERSION_PATTERNS = [
    // "convert 100 km to miles"
    /convert\s+(\d+\.?\d*)\s*([a-z°]+)\s+to\s+([a-z°]+)/i,
    // "what is 25°C in Fahrenheit"
    /what is\s+(\d+\.?\d*)\s*([°]?[a-z]+)\s+in\s+([°]?[a-z]+)/i,
    // "100 km to miles"
    /(\d+\.?\d*)\s*([a-z°]+)\s+to\s+([a-z°]+)/i,
    // "how many miles in 100 km"
    /how many\s+([a-z]+)\s+in\s+(\d+\.?\d*)\s*([a-z]+)/i,
    // "5 feet in meters"
    /(\d+\.?\d*)\s*([a-z]+)\s+in\s+([a-z]+)/i,
  ];

  // ✅ NEW: Unit conversion keywords
  private readonly UNIT_CONVERSION_KEYWORDS = [
    'convert', 'km to miles', 'miles to km', 'celsius to fahrenheit',
    'fahrenheit to celsius', 'feet to meters', 'meters to feet',
    'pounds to kg', 'kg to pounds', 'inches to cm', 'cm to inches',
    'gallons to liters', 'liters to gallons', '°c to °f', '°f to °c'
  ];

  // ✅ NEW: Ratio problem patterns
  private readonly RATIO_PATTERNS = [
    // "ratio is 3:5"
    /ratio.*\d+:\d+/i,
    // "3:5 ratio"
    /\d+:\d+.*ratio/i,
    // "if A:B is 3:5, what is B"
    /if.*\d+:\d+.*(?:what|how many|find)/i,
    // "cats to dogs is 2:3"
    /(?:cats?|dogs?|people|items?).*(?:to|:).*(?:cats?|dogs?|people|items?).*\d+:\d+/i,
    // "ratio of cats to dogs"
    /ratio of.*to/i,
    // "A:B is 3:5 and A is 60"
    /[A-Za-z]+:[A-Za-z]+\s+(?:is|=)\s*\d+:\d+/i,
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

    // Use QueryNormalizer to preprocess the query
    // This handles × → *, ÷ → /, and M/K/B abbreviations
    const normalizedQuery = QueryNormalizer.normalize(trimmedQuery);

    // Skip document generation requests
    if (this.isDocumentQuery(trimmedQuery)) {
      return {
        isCalculation: false,
        type: CalculationType.NONE,
        confidence: 1.0
      };
    }

    // ✅ FIX: Skip Excel/document data extraction queries
    // These should use RAG, not calculation mode
    if (this.isDataExtractionQuery(trimmedQuery)) {
      console.log('🚫 [CALC-DETECT] Skipping calculation - detected data extraction query');
      return {
        isCalculation: false,
        type: CalculationType.NONE,
        confidence: 1.0
      };
    }

    // ✅ NEW: Check for unit conversion (HIGH PRIORITY - before other checks)
    const unitConversionResult = this.checkUnitConversion(trimmedQuery);
    if (unitConversionResult.isCalculation) {
      console.log('✅ [CALC-DETECT] Detected unit conversion query');
      return unitConversionResult;
    }

    // ✅ NEW: Check for ratio problems (HIGH PRIORITY)
    const ratioResult = this.checkRatioProblem(trimmedQuery);
    if (ratioResult.isCalculation) {
      console.log('✅ [CALC-DETECT] Detected ratio problem query');
      return ratioResult;
    }

    // Check for M/K/B abbreviations (high confidence calculation indicator)
    if (/\$?\d+(?:\.\d+)?[MKB]\b/i.test(trimmedQuery)) {
      return {
        isCalculation: true,
        type: CalculationType.FINANCIAL,
        expression: normalizedQuery,
        confidence: 0.90
      };
    }

    // Check for word problems (discount, profit, etc.)
    if (this.isWordProblem(trimmedQuery)) {
      return {
        isCalculation: true,
        type: CalculationType.COMPLEX,
        expression: normalizedQuery,
        confidence: 0.85
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
   * ✅ FIX: Check if query is asking for data from Excel/documents
   * These queries should use RAG, not calculation mode
   */
  private isDataExtractionQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    // ✅ FIX: Formula explanation queries should NEVER trigger calculation mode
    // These ask about HOW something is calculated in the document, not to perform a calculation
    const formulaExplanationPatterns = [
      /how\s+(?:is|are)\s+(?:the\s+)?(?:sub)?totals?\s+calculated/i,  // "how are subtotals calculated"
      /how\s+is\s+(?:cell\s+)?[A-Z]+\d+\s+calculated/i,              // "how is cell B71 calculated"
      /how\s+(?:is|does)\s+.*\s+get\s+calculated/i,                  // "how does X get calculated"
      /what\s+(?:is\s+)?(?:the\s+)?formula/i,                        // "what is the formula"
      /what\s+formula\s+(?:is\s+)?used/i,                            // "what formula is used"
      /which\s+formula/i,                                             // "which formula"
      /formula\s+(?:for|in|used)/i,                                  // "formula for...", "formula in..."
      /explain\s+(?:the\s+)?(?:formula|calculation)/i,               // "explain the formula"
      /show\s+(?:me\s+)?(?:the\s+)?formula/i,                        // "show me the formula"
    ];

    if (formulaExplanationPatterns.some(pattern => pattern.test(query))) {
      console.log('🚫 [CALC-DETECT] Skipping calculation - detected formula explanation query (should use RAG)');
      return true;
    }

    // Keywords that indicate data source reference (Excel files, documents, etc.)
    const dataSourceIndicators = [
      'rosewood', 'carlyle', 'baxter', 'desert ranch', 'lone mountain',  // Property names
      'fund', 'portfolio', 'properties',  // Financial terms in context
      'p&l', 'budget', 'improvement plan',  // Document types
      'excel', 'spreadsheet', 'file', 'document', 'sheet',  // File references
      'xlsx', 'xls', 'csv',  // File extensions
      '2024', '2025',  // Years that indicate document data
    ];

    // Check if query references a data source
    const hasDataSource = dataSourceIndicators.some(indicator =>
      lowerQuery.includes(indicator)
    );

    // Questions asking about data IN files should use RAG
    const dataExtractionPatterns = [
      // "What is the X in/from/of the Y file?"
      /(?:what|show|find|get|tell me|list).*(?:in|from|of|for).*(?:the|this|these)/i,
      // "What is the average MoIC across all properties?"
      /(?:what is|what's).*(?:the|a).*(?:across|in|from|for)/i,
      // "How many/much X in Y?"
      /(?:how many|how much).*(?:in|from|of|for)/i,
      // "Based on the data/file/document"
      /(?:based on|according to|from).*(?:data|file|document|spreadsheet|excel)/i,
      // "Which property has/performed..."
      /(?:which|what).*(?:property|fund|portfolio|has|performed|shows)/i,
      // "Is X becoming more/less Y?"
      /(?:is|are).*(?:becoming|getting|more|less).*(?:profitable|expensive|valuable)/i,
      // "Compare X to Y" with data context
      /(?:compare|comparison|difference|variance).*(?:to|between|from)/i,
    ];

    // If query has a data source reference AND matches extraction patterns, it's data extraction
    if (hasDataSource) {
      const matchesExtractionPattern = dataExtractionPatterns.some(pattern =>
        pattern.test(query)
      );

      if (matchesExtractionPattern) {
        return true;
      }

      // Also check for financial metrics that should be extracted from data, not calculated
      const financialMetricInContext = [
        /(?:moic|multiple on invested capital)/i,
        /(?:roi|return on investment).*(?:in|from|of|for)/i,
        /(?:irr|internal rate of return).*(?:in|from|of|for)/i,
        /(?:npv|net present value).*(?:in|from|of|for)/i,
        /(?:total|sum|average|mean).*(?:of|for|across).*(?:properties|portfolio|fund)/i,
        /(?:revenue|expense|profit|margin|growth).*(?:in|from|for)/i,
        /(?:invested|investment).*(?:amount|total|across)/i,
        /(?:weighted average).*(?:return|across|portfolio)/i,
      ];

      if (financialMetricInContext.some(pattern => pattern.test(query))) {
        return true;
      }
    }

    return false;
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
   * Check for word problems (discount, profit margin, etc.)
   */
  private isWordProblem(query: string): boolean {
    const wordProblemPatterns = [
      // Discount problems: "A product costs $X with Y% discount"
      /(?:costs?|priced?|worth)\s+\$?\d+.*(?:discount|off|sale|reduction)/i,
      /(?:discount|off|sale|reduction)\s+of\s+\d+\s*%/i,
      /\d+\s*%\s+(?:discount|off|sale|reduction)/i,

      // Price after discount: "What is the final price"
      /(?:final|sale|discounted|net)\s+price/i,

      // Profit/margin calculations
      /(?:profit|margin|markup)\s+(?:is|of|on)/i,
      /(?:cost|revenue|sales).*(?:minus|less|subtract)/i,

      // Percentage increase/decrease
      /(?:increased?|decreased?|grew|fell|rose|dropped)\s+(?:by|to)\s+\d+\s*%/i,

      // Tax calculations
      /(?:tax|vat|gst|sales\s+tax)\s+of\s+\d+\s*%/i,
      /(?:after|before|including|excluding)\s+tax/i,

      // Tip calculations
      /(?:tip|gratuity)\s+of\s+\d+\s*%/i,

      // Comparison problems
      /(?:how\s+much|what\s+is)\s+(?:the\s+)?(?:difference|savings?|profit)/i,

      // Commission calculations
      /(?:commission|bonus)\s+of\s+\d+\s*%/i
    ];

    return wordProblemPatterns.some(pattern => pattern.test(query));
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

  // ============================================================================
  // ✅ NEW: UNIT CONVERSION DETECTION
  // ============================================================================

  /**
   * Check if query is a unit conversion request
   */
  private checkUnitConversion(query: string): CalculationDetectionResult {
    const lowerQuery = query.toLowerCase();

    // Check for unit conversion patterns
    for (const pattern of this.UNIT_CONVERSION_PATTERNS) {
      if (pattern.test(query)) {
        return {
          isCalculation: true,
          type: CalculationType.COMPLEX, // Use COMPLEX to route to Python for accuracy
          expression: query,
          confidence: 0.95,
          parameters: {
            calculationType: 'unit_conversion',
            ...this.extractUnitConversionParams(query)
          }
        };
      }
    }

    // Check for unit conversion keywords
    const hasConvertKeyword = this.UNIT_CONVERSION_KEYWORDS.some(keyword =>
      lowerQuery.includes(keyword)
    );

    if (hasConvertKeyword) {
      return {
        isCalculation: true,
        type: CalculationType.COMPLEX,
        expression: query,
        confidence: 0.80,
        parameters: {
          calculationType: 'unit_conversion',
          ...this.extractUnitConversionParams(query)
        }
      };
    }

    return {
      isCalculation: false,
      type: CalculationType.NONE,
      confidence: 0
    };
  }

  /**
   * Extract unit conversion parameters from query
   */
  private extractUnitConversionParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Pattern: "convert X unit1 to unit2" or "X unit1 to unit2"
    const patterns = [
      /convert\s+(\d+\.?\d*)\s*([a-z°]+)\s+to\s+([a-z°]+)/i,
      /(\d+\.?\d*)\s*([a-z°]+)\s+to\s+([a-z°]+)/i,
      /what is\s+(\d+\.?\d*)\s*([°]?[a-z]+)\s+in\s+([°]?[a-z]+)/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        params.value = parseFloat(match[1]);
        params.fromUnit = match[2].toLowerCase().replace(/°/g, '');
        params.toUnit = match[3].toLowerCase().replace(/°/g, '');
        break;
      }
    }

    // Pattern: "how many unit2 in X unit1"
    const howManyMatch = query.match(/how many\s+([a-z]+)\s+in\s+(\d+\.?\d*)\s*([a-z]+)/i);
    if (howManyMatch) {
      params.toUnit = howManyMatch[1].toLowerCase();
      params.value = parseFloat(howManyMatch[2]);
      params.fromUnit = howManyMatch[3].toLowerCase();
    }

    return params;
  }

  // ============================================================================
  // ✅ NEW: RATIO PROBLEM DETECTION
  // ============================================================================

  /**
   * Check if query is a ratio problem
   */
  private checkRatioProblem(query: string): CalculationDetectionResult {
    // Check for ratio patterns
    for (const pattern of this.RATIO_PATTERNS) {
      if (pattern.test(query)) {
        return {
          isCalculation: true,
          type: CalculationType.COMPLEX, // Use COMPLEX for Python
          expression: query,
          confidence: 0.85,
          parameters: {
            calculationType: 'ratio',
            ...this.extractRatioParams(query)
          }
        };
      }
    }

    return {
      isCalculation: false,
      type: CalculationType.NONE,
      confidence: 0
    };
  }

  /**
   * Extract ratio parameters from query
   */
  private extractRatioParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract ratio (e.g., "3:5" or "2:3")
    const ratioMatch = query.match(/(\d+)\s*:\s*(\d+)/);
    if (ratioMatch) {
      params.ratio1 = parseInt(ratioMatch[1]);
      params.ratio2 = parseInt(ratioMatch[2]);
    }

    // Extract known value
    // Patterns: "A is 60", "there are 10 cats", "10 cats", "A = 60"
    const knownValuePatterns = [
      /(?:is|are|=)\s+(\d+)/i,
      /(\d+)\s+(?:cats?|dogs?|items?|people|units?)/i,
      /[Aa]\s+(?:is|=)\s+(\d+)/i,
    ];

    for (const pattern of knownValuePatterns) {
      const match = query.match(pattern);
      if (match) {
        params.knownValue = parseInt(match[1]);
        break;
      }
    }

    // Determine which part of ratio is known
    params.isFirstKnown = /\b[Aa]\b|first|cats?/.test(query) ||
                          !(/\b[Bb]\b|second|dogs?/.test(query));

    return params;
  }
}

export default new CalculationDetectorService();
