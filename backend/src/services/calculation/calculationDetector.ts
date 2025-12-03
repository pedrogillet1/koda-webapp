/**
 * Calculation Detector Service
 *
 * Detects calculation queries with high accuracy to prevent falling through
 * to document search for math/financial/statistical questions.
 */

export type CalculationCategory =
  | 'arithmetic'
  | 'percentage'
  | 'financial'
  | 'statistics'
  | 'conversion'
  | 'ratio'
  | 'growth'
  | 'complex'
  | 'none';

export interface CalculationType {
  type: CalculationCategory;
  confidence: number; // 0-1
  keywords: string[];
  subType?: string; // More specific type like 'irr', 'npv', 'median', etc.
}

export interface DetectionResult {
  isCalculation: boolean;
  calculationType: CalculationType;
  shouldUseCalculationEngine: boolean;
  recommendedApproach: 'python' | 'formula' | 'hyperformula' | 'direct' | 'none';
}

/**
 * Detect calculation query type with high accuracy
 */
export function detectCalculationType(query: string): CalculationType {
  const lowerQuery = query.toLowerCase();
  const originalQuery = query;

  // ========================================
  // 1. ARITHMETIC (Basic math operations)
  // ========================================
  const arithmeticPatterns = [
    /what is \d+/i,
    /\d+\s*[\+\-\*\/×÷]\s*\d+/,
    /calculate\s+\d+/i,
    /multiply/i,
    /divide/i,
    /add\s+\d+/i,
    /subtract/i,
    /sum of:?\s*\d+/i,
    /total of:?\s*\d+/i,
    /average of:?\s*\d+/i,
    /mean of:?\s*\d+/i,
    /\d+\s*plus\s*\d+/i,
    /\d+\s*minus\s*\d+/i,
    /\d+\s*times\s*\d+/i,
    /\d+\s*divided by\s*\d+/i
  ];

  if (arithmeticPatterns.some(p => p.test(originalQuery))) {
    return {
      type: 'arithmetic',
      confidence: 0.95,
      keywords: ['calculate', 'multiply', 'divide', 'add', 'subtract', 'sum', 'total', 'average']
    };
  }

  // ========================================
  // 2. PERCENTAGE
  // ========================================
  const percentagePatterns = [
    /\d+\s*%\s+of/i,
    /\d+\s+percent\s+of/i,
    /what percentage/i,
    /what percent/i,
    /percent(age)?\s+(increase|decrease|change|growth|drop)/i,
    /discount/i,
    /\d+%\s+(discount|off|increase|decrease)/i,
    /increased?\s+(by|from).*\d+.*to.*\d+/i,
    /decreased?\s+(by|from).*\d+.*to.*\d+/i,
    /\d+\s+out\s+of\s+\d+/i,
    /margin/i
  ];

  if (percentagePatterns.some(p => p.test(originalQuery))) {
    return {
      type: 'percentage',
      confidence: 0.95,
      keywords: ['percent', 'percentage', 'discount', 'increase', 'decrease', 'margin']
    };
  }

  // ========================================
  // 3. FINANCIAL
  // ========================================
  const financialPatterns = [
    /\b(irr|npv|pv|fv|pmt)\b/i,
    /internal rate of return/i,
    /net present value/i,
    /present value/i,
    /future value/i,
    /compound interest/i,
    /simple interest/i,
    /loan payment/i,
    /monthly payment/i,
    /mortgage/i,
    /\broi\b/i,
    /return on investment/i,
    /cash flow/i,
    /discount rate/i,
    /interest rate/i,
    /principal.*rate.*time/i,
    /payback period/i,
    /effective.*rate/i,
    /nominal.*rate/i,
    /break.?even/i,
    /profit margin/i,
    /gross margin/i,
    /net income/i,
    /operating expense/i,
    /revenue.*cost.*profit/i
  ];

  if (financialPatterns.some(p => p.test(originalQuery))) {
    // Determine subtype
    let subType = 'general';
    if (/\birr\b/i.test(lowerQuery) || /internal rate of return/i.test(lowerQuery)) subType = 'irr';
    else if (/\bnpv\b/i.test(lowerQuery) || /net present value/i.test(lowerQuery)) subType = 'npv';
    else if (/\bpv\b/i.test(lowerQuery) || /present value/i.test(lowerQuery)) subType = 'pv';
    else if (/\bfv\b/i.test(lowerQuery) || /future value/i.test(lowerQuery)) subType = 'fv';
    else if (/\bpmt\b/i.test(lowerQuery) || /monthly payment|loan payment/i.test(lowerQuery)) subType = 'pmt';
    else if (/compound interest/i.test(lowerQuery)) subType = 'compound_interest';
    else if (/simple interest/i.test(lowerQuery)) subType = 'simple_interest';
    else if (/roi/i.test(lowerQuery)) subType = 'roi';

    return {
      type: 'financial',
      confidence: 0.98,
      keywords: ['IRR', 'NPV', 'interest', 'loan', 'cash flow', 'ROI', 'payment'],
      subType
    };
  }

  // ========================================
  // 4. STATISTICS
  // ========================================
  const statisticsPatterns = [
    /\b(median|mode|variance|std|stdev|standard deviation)\b/i,
    /calculate the median/i,
    /calculate the mode/i,
    /calculate the variance/i,
    /calculate the range/i,
    /correlation/i,
    /regression/i,
    /mean of:?\s*\d+/i,
    /average of:?\s*\d+.*\d+.*\d+/i,
    /distribution/i,
    /probability/i
  ];

  if (statisticsPatterns.some(p => p.test(originalQuery))) {
    // Determine subtype
    let subType = 'general';
    if (/median/i.test(lowerQuery)) subType = 'median';
    else if (/mode/i.test(lowerQuery)) subType = 'mode';
    else if (/variance/i.test(lowerQuery)) subType = 'variance';
    else if (/std|stdev|standard deviation/i.test(lowerQuery)) subType = 'stdev';
    else if (/range/i.test(lowerQuery)) subType = 'range';
    else if (/average|mean/i.test(lowerQuery)) subType = 'average';

    return {
      type: 'statistics',
      confidence: 0.95,
      keywords: ['median', 'mode', 'variance', 'standard deviation', 'mean', 'range'],
      subType
    };
  }

  // ========================================
  // 5. UNIT CONVERSION
  // ========================================
  const conversionPatterns = [
    /convert\s+\d+/i,
    /\d+\s*(kilometers?|km)\s+to\s*(miles?|mi)/i,
    /\d+\s*(miles?|mi)\s+to\s*(kilometers?|km)/i,
    /\d+\s*(celsius|c|°c)\s+to\s*(fahrenheit|f|°f)/i,
    /\d+\s*(fahrenheit|f|°f)\s+to\s*(celsius|c|°c)/i,
    /\d+\s*(pounds?|lbs?)\s+to\s*(kilograms?|kg)/i,
    /\d+\s*(kilograms?|kg)\s+to\s*(pounds?|lbs?)/i,
    /how many\s+(seconds|minutes|hours|days)/i,
    /\d+\s*(meters?|feet|inches|yards)/i,
    /\d+\s*(liters?|gallons?)/i
  ];

  if (conversionPatterns.some(p => p.test(originalQuery))) {
    return {
      type: 'conversion',
      confidence: 0.95,
      keywords: ['convert', 'km', 'miles', 'celsius', 'fahrenheit', 'pounds', 'kilograms']
    };
  }

  // ========================================
  // 6. RATIOS
  // ========================================
  const ratioPatterns = [
    /ratio/i,
    /\d+:\d+/,
    /debt.to.equity/i,
    /price.to.earnings/i,
    /\bp\/e\b/i,
    /\bpe\s+ratio/i,
    /if.*ratio.*is.*\d+:\d+/i,
    /proportion/i,
    /current ratio/i,
    /divide.*in the ratio/i,
    /ratio of \w+ to \w+ is/i
  ];

  if (ratioPatterns.some(p => p.test(originalQuery))) {
    return {
      type: 'ratio',
      confidence: 0.90,
      keywords: ['ratio', 'debt-to-equity', 'P/E', 'proportion', 'current ratio']
    };
  }

  // ========================================
  // 7. GROWTH & RATES
  // ========================================
  const growthPatterns = [
    /\bcagr\b/i,
    /compound annual growth/i,
    /year.over.year/i,
    /\byoy\b/i,
    /growth rate/i,
    /grows? at \d+%/i,
    /annual(ly)? growth/i,
    /population.*grows?.*\d+%/i,
    /inflation/i,
    /churn rate/i,
    /customer lifetime value/i,
    /clv\b/i,
    /customer acquisition cost/i,
    /cac\b/i,
    /revenue per employee/i
  ];

  if (growthPatterns.some(p => p.test(originalQuery))) {
    // Determine subtype
    let subType = 'general';
    if (/cagr|compound annual growth/i.test(lowerQuery)) subType = 'cagr';
    else if (/yoy|year.over.year/i.test(lowerQuery)) subType = 'yoy';
    else if (/churn/i.test(lowerQuery)) subType = 'churn';
    else if (/clv|customer lifetime/i.test(lowerQuery)) subType = 'clv';
    else if (/cac|customer acquisition/i.test(lowerQuery)) subType = 'cac';

    return {
      type: 'growth',
      confidence: 0.95,
      keywords: ['CAGR', 'growth rate', 'year-over-year', 'YoY', 'churn', 'CLV'],
      subType
    };
  }

  // ========================================
  // 8. COMPLEX MULTI-STEP
  // ========================================
  const complexPatterns = [
    /revenue.*margin.*expense/i,
    /break.?even\s*point/i,
    /if.*then.*what/i,
    /given.*calculate/i,
    /\d+%\s+(gross|net)\s+margin/i,
    /operating (income|expense)/i,
    /tax rate.*\d+%/i,
    /fixed cost.*variable cost/i,
    /company.*market share/i,
    /invest.*monthly.*return.*years/i
  ];

  if (complexPatterns.some(p => p.test(originalQuery))) {
    return {
      type: 'complex',
      confidence: 0.85,
      keywords: ['revenue', 'margin', 'break-even', 'operating', 'multi-step']
    };
  }

  // ========================================
  // 9. FALLBACK: Check for numbers + action words
  // ========================================
  const hasNumbers = /\d+/.test(originalQuery);
  const actionWords = ['calculate', 'compute', 'find', 'determine', 'what is', 'how much', 'how many'];
  const hasActionWord = actionWords.some(word => lowerQuery.includes(word));

  if (hasNumbers && hasActionWord) {
    return {
      type: 'arithmetic',
      confidence: 0.70,
      keywords: ['calculate', 'compute']
    };
  }

  // Not a calculation query
  return {
    type: 'none',
    confidence: 0,
    keywords: []
  };
}

/**
 * Full detection with recommendation
 */
export function detectCalculation(query: string): DetectionResult {
  const calculationType = detectCalculationType(query);

  const isCalculation = calculationType.type !== 'none';
  const shouldUseCalculationEngine = isCalculation && calculationType.confidence >= 0.7;

  // Determine recommended approach
  let recommendedApproach: 'python' | 'formula' | 'hyperformula' | 'direct' | 'none' = 'none';

  if (shouldUseCalculationEngine) {
    switch (calculationType.type) {
      case 'financial':
        // Financial calculations need Python with numpy_financial
        recommendedApproach = 'python';
        break;

      case 'statistics':
        // Statistics can use Python or HyperFormula
        if (['median', 'mode', 'stdev', 'variance'].includes(calculationType.subType || '')) {
          recommendedApproach = 'python'; // More accurate
        } else {
          recommendedApproach = 'hyperformula';
        }
        break;

      case 'complex':
      case 'growth':
        // Complex multi-step needs Python
        recommendedApproach = 'python';
        break;

      case 'arithmetic':
      case 'percentage':
      case 'ratio':
        // Simple calculations can use Formula.js or direct
        recommendedApproach = 'formula';
        break;

      case 'conversion':
        // Unit conversions can be done directly
        recommendedApproach = 'direct';
        break;

      default:
        recommendedApproach = 'python';
    }
  }

  return {
    isCalculation,
    calculationType,
    shouldUseCalculationEngine,
    recommendedApproach
  };
}

/**
 * Check if query should use calculation engine
 */
export function shouldUseCalculationEngine(query: string): boolean {
  const detection = detectCalculationType(query);
  return detection.type !== 'none' && detection.confidence >= 0.7;
}

/**
 * Log calculation detection for debugging
 */
export function logCalculationDetection(query: string): void {
  const result = detectCalculation(query);

  console.log('╔══════════════════════════════════════════════════════════════');
  console.log('║ 🔍 CALCULATION DETECTION');
  console.log('╠══════════════════════════════════════════════════════════════');
  console.log(`║ Query: "${query.substring(0, 60)}${query.length > 60 ? '...' : ''}"`);
  console.log(`║ Type: ${result.calculationType.type}`);
  console.log(`║ SubType: ${result.calculationType.subType || 'N/A'}`);
  console.log(`║ Confidence: ${(result.calculationType.confidence * 100).toFixed(0)}%`);
  console.log(`║ Keywords: ${result.calculationType.keywords.join(', ')}`);
  console.log(`║ Is Calculation: ${result.isCalculation ? '✅ YES' : '❌ NO'}`);
  console.log(`║ Use Engine: ${result.shouldUseCalculationEngine ? '✅ YES' : '❌ NO'}`);
  console.log(`║ Approach: ${result.recommendedApproach.toUpperCase()}`);
  console.log('╚══════════════════════════════════════════════════════════════');
}

/**
 * Test function for calculation detection
 */
export function testCalculationDetection(): void {
  const tests = [
    // Should detect
    { query: 'What is 2,547 × 38?', expected: 'arithmetic' },
    { query: 'Calculate 15% of $8,500', expected: 'percentage' },
    { query: 'What percentage is 45 out of 180?', expected: 'percentage' },
    { query: 'Calculate IRR for cash flows: -$100,000, $30,000', expected: 'financial' },
    { query: 'What is the NPV with 10% discount rate?', expected: 'financial' },
    { query: 'Calculate compound interest: $10,000 at 5% for 10 years', expected: 'financial' },
    { query: 'What is the monthly payment on a $200,000 loan at 5%?', expected: 'financial' },
    { query: 'What is the median of: 5, 12, 18, 23, 45?', expected: 'statistics' },
    { query: 'Calculate the standard deviation of: 10, 20, 30', expected: 'statistics' },
    { query: 'Convert 5 kilometers to miles', expected: 'conversion' },
    { query: 'Convert 100 Fahrenheit to Celsius', expected: 'conversion' },
    { query: 'If the ratio of A to B is 3:5 and A is 60, what is B?', expected: 'ratio' },
    { query: 'Calculate CAGR from $1M to $2M over 5 years', expected: 'growth' },
    { query: 'Calculate break-even point: Fixed costs $50K', expected: 'complex' },

    // Should NOT detect (document queries)
    { query: 'What documents do I have?', expected: 'none' },
    { query: 'Summarize the report', expected: 'none' },
    { query: 'Who is the CEO?', expected: 'none' },
    { query: 'Find all mentions of sales', expected: 'none' }
  ];

  console.log('🧪 Testing Calculation Detection\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = detectCalculationType(test.query);
    const match = result.type === test.expected;

    console.log(`\nQuery: "${test.query}"`);
    console.log(`Expected: ${test.expected}`);
    console.log(`Got: ${result.type} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
    console.log(`Result: ${match ? '✅ PASS' : '❌ FAIL'}`);

    if (match) passed++;
    else failed++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed}/${tests.length} passed (${Math.round(passed / tests.length * 100)}%)`);
}

export default {
  detectCalculationType,
  detectCalculation,
  shouldUseCalculationEngine,
  logCalculationDetection,
  testCalculationDetection
};
