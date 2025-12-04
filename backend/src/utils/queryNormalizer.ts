/**
 * Query Normalizer Utility
 *
 * Normalizes query text before processing:
 * - Converts special symbols (× → *, ÷ → /)
 * - Expands abbreviations ($10M → 10000000)
 * - Removes commas from numbers (2,547 → 2547)
 * - Detects calculation queries
 */

export class QueryNormalizer {
  /**
   * Normalize mathematical symbols
   */
  static normalizeMathSymbols(text: string): string {
    return text
      // Multiplication symbols - ensure space around operator
      .replace(/×/g, ' * ')
      .replace(/·/g, ' * ')
      .replace(/\u00D7/g, ' * ')  // × Unicode

      // Division symbols - ensure space around operator
      .replace(/÷/g, ' / ')
      .replace(/\u00F7/g, ' / ')  // ÷ Unicode

      // Minus/dash variations
      .replace(/−/g, '-')
      .replace(/\u2212/g, '-')  // − Unicode

      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Expand number abbreviations (M, K, B)
   */
  static expandAbbreviations(text: string): string {
    // Match patterns like $10M, $50K, $1.5B, 10M, 50K
    return text
      // Billions - must come before Millions to avoid B in Billion matching M
      .replace(/\$?\s*(\d+(?:\.\d+)?)\s*B(?:illion)?(?!\w)/gi, (match, num) => {
        return `${parseFloat(num) * 1000000000}`;
      })
      // Millions
      .replace(/\$?\s*(\d+(?:\.\d+)?)\s*M(?:illion)?(?!\w)/gi, (match, num) => {
        return `${parseFloat(num) * 1000000}`;
      })
      // Thousands
      .replace(/\$?\s*(\d+(?:\.\d+)?)\s*K(?!\w)/gi, (match, num) => {
        return `${parseFloat(num) * 1000}`;
      });
  }

  /**
   * Remove commas from numbers
   */
  static removeNumberCommas(text: string): string {
    // Remove commas from numbers like 2,547 or 10,000
    // Match pattern: digit,digit (ensuring it's part of a number)
    let result = text;
    while (/(\d),(\d{3})/.test(result)) {
      result = result.replace(/(\d),(\d{3})/g, '$1$2');
    }
    return result;
  }

  /**
   * Remove currency symbols but keep the numbers
   */
  static removeCurrencySymbols(text: string): string {
    return text
      .replace(/\$\s*/g, '')
      .replace(/€\s*/g, '')
      .replace(/£\s*/g, '')
      .replace(/¥\s*/g, '')
      .replace(/R\$\s*/g, '');
  }

  /**
   * Normalize all aspects of a query for calculation
   */
  static normalize(text: string): string {
    let normalized = text;

    // Step 1: Remove commas from numbers FIRST (before symbol normalization)
    normalized = this.removeNumberCommas(normalized);

    // Step 2: Expand abbreviations (before removing currency)
    normalized = this.expandAbbreviations(normalized);

    // Step 3: Normalize math symbols
    normalized = this.normalizeMathSymbols(normalized);

    return normalized;
  }

  /**
   * Normalize for expression evaluation (more aggressive)
   */
  static normalizeForEvaluation(text: string): string {
    let normalized = this.normalize(text);

    // Also remove currency symbols for pure math evaluation
    normalized = this.removeCurrencySymbols(normalized);

    return normalized;
  }

  /**
   * Check if text contains calculation indicators
   */
  static isCalculationQuery(text: string): boolean {
    const normalized = text.toLowerCase();

    // Strong calculation indicators (high confidence)
    const strongIndicators = [
      'calculate', 'compute', 'what is', 'how much is',
      'multiply', 'divide', 'add', 'subtract',
      'sum of', 'total of', 'average of', 'mean of',
      'median of', 'mode of', 'variance of', 'stdev of',
      'standard deviation', 'range of',
      '% of', 'percent of', 'percentage of',
      'irr', 'npv', 'pv', 'fv', 'pmt',
      'simple interest', 'compound interest',
      'roi', 'return on investment',
      'debt-to-equity', 'price-to-earnings',
      'cagr', 'growth rate'
    ];

    // Check for strong indicators
    if (strongIndicators.some(indicator => normalized.includes(indicator))) {
      return true;
    }

    // Check for math operators with numbers
    if (/\d+\s*[\+\-\*\/×÷]\s*\d+/.test(text)) {
      return true;
    }

    // Check for percentage patterns
    if (/\d+\s*%\s*(of|from|to)/i.test(text)) {
      return true;
    }

    // Check for "X out of Y" pattern (percentage)
    if (/\d+\s+out\s+of\s+\d+/i.test(text)) {
      return true;
    }

    // Check for financial calculation patterns
    if (/revenue.*cost|cost.*revenue|profit|margin|discount|markup/i.test(text)) {
      return true;
    }

    // Check for M/K/B abbreviations with dollar sign
    if (/\$\d+(?:\.\d+)?[MKB]/i.test(text)) {
      return true;
    }

    return false;
  }

  /**
   * Detect the type of calculation needed
   */
  static detectCalculationType(text: string): string {
    const normalized = text.toLowerCase();

    // Percentage calculations
    if (/\d+\s*%\s*(of|from|to)/i.test(text) || /percent/i.test(text)) {
      if (/discount|off|sale/i.test(text)) return 'discount';
      if (/increase|grew|rose/i.test(text)) return 'percentage_increase';
      if (/decrease|dropped|fell/i.test(text)) return 'percentage_decrease';
      if (/out of|is.*of/i.test(text)) return 'percentage_of_total';
      return 'percentage';
    }

    // Financial calculations
    if (/irr/i.test(text)) return 'irr';
    if (/npv|net present value/i.test(text)) return 'npv';
    if (/present value|pv/i.test(text)) return 'present_value';
    if (/future value|fv/i.test(text)) return 'future_value';
    if (/monthly payment|pmt|loan payment/i.test(text)) return 'pmt';
    if (/simple interest/i.test(text)) return 'simple_interest';
    if (/compound interest/i.test(text)) return 'compound_interest';
    if (/roi|return on investment/i.test(text)) return 'roi';
    if (/cagr|compound annual growth/i.test(text)) return 'cagr';
    if (/year.over.year|yoy|growth rate/i.test(text)) return 'growth_rate';

    // Ratio calculations
    if (/debt.to.equity/i.test(text)) return 'debt_to_equity';
    if (/price.to.earnings|p\/e/i.test(text)) return 'pe_ratio';
    if (/ratio.*is.*\d+:\d+/i.test(text)) return 'ratio_problem';

    // Statistics
    if (/median/i.test(text)) return 'median';
    if (/average|mean/i.test(text)) return 'average';
    if (/mode/i.test(text)) return 'mode';
    if (/variance/i.test(text)) return 'variance';
    if (/standard deviation|stdev/i.test(text)) return 'stdev';
    if (/range of/i.test(text)) return 'range';

    // Basic arithmetic
    if (/[\+\-\*\/×÷]/.test(text)) return 'arithmetic';
    if (/profit|margin/i.test(text)) return 'profit_margin';

    return 'unknown';
  }

  /**
   * Extract numbers from text
   */
  static extractNumbers(text: string): number[] {
    const normalized = this.normalize(text);
    const matches = normalized.match(/-?\d+\.?\d*/g);

    if (!matches) return [];

    return matches
      .map(m => parseFloat(m))
      .filter(n => !isNaN(n) && isFinite(n));
  }
}

export default QueryNormalizer;
