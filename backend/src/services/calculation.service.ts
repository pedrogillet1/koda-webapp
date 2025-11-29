/**
 * Calculation Service
 *
 * REASON: Perform calculations on retrieved data
 * WHY: Users ask "What's the average GDP growth from 2015-2020?"
 * HOW: Detect calculation keywords, extract numbers, compute results
 * IMPACT: Koda can answer calculation questions, not just retrieve data
 *
 * SUPPORTED CALCULATIONS:
 * - Average/Mean
 * - Sum/Total
 * - Growth/Change (absolute and percentage)
 * - Min/Max
 * - Count
 * - Comparison
 */

export interface CalculationResult {
  type: 'average' | 'sum' | 'growth' | 'percentage' | 'min' | 'max' | 'count' | 'comparison' | 'custom';
  result: number | number[] | Record<string, number>;
  explanation: string;
  formula?: string;
  inputValues?: number[];
  unit?: string;
}

export interface ExtractedNumber {
  value: number;
  context: string;
  label?: string;
  year?: number;
  unit?: string;
}

// Calculation keywords and their associated operations
const CALCULATION_KEYWORDS: Record<string, string[]> = {
  average: ['average', 'mean', 'avg', 'typical'],
  sum: ['total', 'sum', 'add', 'combined', 'altogether', 'aggregate'],
  growth: ['growth', 'increase', 'decrease', 'change', 'grew', 'declined', 'rose', 'fell'],
  percentage: ['percentage', 'percent', '%', 'proportion', 'share', 'ratio'],
  min: ['minimum', 'min', 'lowest', 'smallest', 'least'],
  max: ['maximum', 'max', 'highest', 'largest', 'greatest', 'most'],
  count: ['count', 'how many', 'number of', 'total number'],
  comparison: ['compare', 'comparison', 'versus', 'vs', 'difference between', 'compared to'],
};

class CalculationService {

  /**
   * Detect if query requires calculation
   */
  requiresCalculation(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    for (const keywords of Object.values(CALCULATION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          return true;
        }
      }
    }

    // Also check for year ranges (often indicate time-series calculations)
    const yearRangePattern = /\b(19\d{2}|20\d{2})\s*[-–to]+\s*(19\d{2}|20\d{2})\b/i;
    if (yearRangePattern.test(query)) {
      return true;
    }

    return false;
  }

  /**
   * Detect the type of calculation needed
   */
  detectCalculationType(query: string): string {
    const lowerQuery = query.toLowerCase();

    for (const [type, keywords] of Object.entries(CALCULATION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          return type;
        }
      }
    }

    return 'custom';
  }

  /**
   * Extract numbers from text
   */
  extractNumbers(text: string): ExtractedNumber[] {
    const results: ExtractedNumber[] = [];

    // Pattern 1: Currency values ($1,234.56 or $1.2B/M/K)
    const currencyPattern = /\$\s*([\d,]+(?:\.\d+)?)\s*([BMKbmk](?:illion|illion)?)?/g;
    let match;

    while ((match = currencyPattern.exec(text)) !== null) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      const suffix = match[2]?.toUpperCase();

      // Apply multiplier
      if (suffix) {
        if (suffix.startsWith('B')) value *= 1e9;
        else if (suffix.startsWith('M')) value *= 1e6;
        else if (suffix.startsWith('K')) value *= 1e3;
      }

      // Get context (surrounding words)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end);

      // Try to extract year from context
      const yearMatch = context.match(/\b(19\d{2}|20\d{2})\b/);

      results.push({
        value,
        context,
        unit: 'USD',
        year: yearMatch ? parseInt(yearMatch[1]) : undefined,
      });
    }

    // Pattern 2: Plain numbers with optional commas and decimals
    const numberPattern = /(?<!\$)\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b(?!\s*[BMKbmk])/g;

    while ((match = numberPattern.exec(text)) !== null) {
      const value = parseFloat(match[1].replace(/,/g, ''));

      // Skip very small numbers (likely indices) and very large (likely already captured)
      if (value < 0.01 || value > 1e12) continue;

      // Skip if this position was already captured by currency pattern
      const alreadyCaptured = results.some(r =>
        r.context.includes(match![0]) && Math.abs(r.value - value) < 0.01
      );
      if (alreadyCaptured) continue;

      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end);

      const yearMatch = context.match(/\b(19\d{2}|20\d{2})\b/);

      results.push({
        value,
        context,
        year: yearMatch ? parseInt(yearMatch[1]) : undefined,
      });
    }

    // Pattern 3: Percentages
    const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;

    while ((match = percentPattern.exec(text)) !== null) {
      const value = parseFloat(match[1]);

      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end);

      const yearMatch = context.match(/\b(19\d{2}|20\d{2})\b/);

      results.push({
        value,
        context,
        unit: 'percent',
        year: yearMatch ? parseInt(yearMatch[1]) : undefined,
      });
    }

    return results;
  }

  /**
   * Calculate average
   */
  calculateAverage(numbers: number[]): CalculationResult {
    if (numbers.length === 0) {
      return {
        type: 'average',
        result: 0,
        explanation: 'No numbers provided for average calculation',
      };
    }

    const sum = numbers.reduce((a, b) => a + b, 0);
    const avg = sum / numbers.length;

    return {
      type: 'average',
      result: avg,
      explanation: `The average of ${numbers.length} values is ${this.formatNumber(avg)}`,
      formula: `(${numbers.map(n => this.formatNumber(n)).join(' + ')}) ÷ ${numbers.length}`,
      inputValues: numbers,
    };
  }

  /**
   * Calculate sum
   */
  calculateSum(numbers: number[]): CalculationResult {
    if (numbers.length === 0) {
      return {
        type: 'sum',
        result: 0,
        explanation: 'No numbers provided for sum calculation',
      };
    }

    const sum = numbers.reduce((a, b) => a + b, 0);

    return {
      type: 'sum',
      result: sum,
      explanation: `The total sum of ${numbers.length} values is ${this.formatNumber(sum)}`,
      formula: numbers.map(n => this.formatNumber(n)).join(' + '),
      inputValues: numbers,
    };
  }

  /**
   * Calculate growth (absolute and percentage)
   */
  calculateGrowth(oldValue: number, newValue: number): CalculationResult {
    const absoluteChange = newValue - oldValue;
    const percentageChange = oldValue !== 0 ? (absoluteChange / oldValue) * 100 : 0;
    const direction = absoluteChange >= 0 ? 'increased' : 'decreased';

    return {
      type: 'growth',
      result: {
        absolute: absoluteChange,
        percentage: percentageChange,
      },
      explanation: `The value ${direction} by ${this.formatNumber(Math.abs(absoluteChange))} (${Math.abs(percentageChange).toFixed(2)}%)`,
      formula: `((${this.formatNumber(newValue)} - ${this.formatNumber(oldValue)}) ÷ ${this.formatNumber(oldValue)}) × 100`,
      inputValues: [oldValue, newValue],
    };
  }

  /**
   * Calculate year-over-year percentage changes
   */
  calculateYearOverYearChanges(values: Array<{ year: number; value: number }>): CalculationResult {
    if (values.length < 2) {
      return {
        type: 'percentage',
        result: [],
        explanation: 'Need at least 2 values to calculate year-over-year changes',
      };
    }

    // Sort by year
    const sorted = [...values].sort((a, b) => a.year - b.year);

    const changes: Array<{ year: number; change: number }> = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevValue = sorted[i - 1].value;
      const currValue = sorted[i].value;
      const change = prevValue !== 0 ? ((currValue - prevValue) / prevValue) * 100 : 0;
      changes.push({
        year: sorted[i].year,
        change,
      });
    }

    const avgChange = changes.reduce((sum, c) => sum + c.change, 0) / changes.length;

    const changeDescriptions = changes.map(c =>
      `${c.year}: ${c.change >= 0 ? '+' : ''}${c.change.toFixed(2)}%`
    );

    return {
      type: 'percentage',
      result: changes.map(c => c.change),
      explanation: `Year-over-year changes:\n${changeDescriptions.join('\n')}\nAverage change: ${avgChange.toFixed(2)}%`,
      inputValues: sorted.map(v => v.value),
    };
  }

  /**
   * Calculate min value
   */
  calculateMin(numbers: number[]): CalculationResult {
    if (numbers.length === 0) {
      return {
        type: 'min',
        result: 0,
        explanation: 'No numbers provided',
      };
    }

    const min = Math.min(...numbers);
    const index = numbers.indexOf(min);

    return {
      type: 'min',
      result: min,
      explanation: `The minimum value is ${this.formatNumber(min)}`,
      inputValues: numbers,
    };
  }

  /**
   * Calculate max value
   */
  calculateMax(numbers: number[]): CalculationResult {
    if (numbers.length === 0) {
      return {
        type: 'max',
        result: 0,
        explanation: 'No numbers provided',
      };
    }

    const max = Math.max(...numbers);

    return {
      type: 'max',
      result: max,
      explanation: `The maximum value is ${this.formatNumber(max)}`,
      inputValues: numbers,
    };
  }

  /**
   * Calculate comparison between two values
   */
  calculateComparison(value1: number, value2: number, label1?: string, label2?: string): CalculationResult {
    const difference = value1 - value2;
    const percentageDiff = value2 !== 0 ? (difference / value2) * 100 : 0;
    const ratio = value2 !== 0 ? value1 / value2 : 0;

    const name1 = label1 || 'Value 1';
    const name2 = label2 || 'Value 2';

    return {
      type: 'comparison',
      result: {
        difference,
        percentageDiff,
        ratio,
      },
      explanation: `${name1} (${this.formatNumber(value1)}) is ${Math.abs(percentageDiff).toFixed(2)}% ${difference >= 0 ? 'higher' : 'lower'} than ${name2} (${this.formatNumber(value2)})`,
      inputValues: [value1, value2],
    };
  }

  /**
   * Perform calculation based on query intent and extracted data
   */
  async performCalculation(
    query: string,
    retrievedData: string
  ): Promise<CalculationResult | null> {

    const calculationType = this.detectCalculationType(query);
    const extractedNumbers = this.extractNumbers(retrievedData);

    console.log(`🧮 [CALCULATION] Type: ${calculationType}, Found ${extractedNumbers.length} numbers`);

    if (extractedNumbers.length === 0) {
      console.log(`🧮 [CALCULATION] No numbers found in data`);
      return null;
    }

    const numbers = extractedNumbers.map(n => n.value);

    switch (calculationType) {
      case 'average':
        return this.calculateAverage(numbers);

      case 'sum':
        return this.calculateSum(numbers);

      case 'growth':
        if (numbers.length >= 2) {
          // If we have year information, use first and last chronologically
          const withYears = extractedNumbers.filter(n => n.year !== undefined);
          if (withYears.length >= 2) {
            const sorted = withYears.sort((a, b) => (a.year || 0) - (b.year || 0));
            return this.calculateGrowth(sorted[0].value, sorted[sorted.length - 1].value);
          }
          // Otherwise use first and last values
          return this.calculateGrowth(numbers[0], numbers[numbers.length - 1]);
        }
        return null;

      case 'percentage':
        // If we have year-labeled data, calculate YoY changes
        const yearData = extractedNumbers
          .filter(n => n.year !== undefined)
          .map(n => ({ year: n.year!, value: n.value }));

        if (yearData.length >= 2) {
          return this.calculateYearOverYearChanges(yearData);
        }
        // Otherwise calculate average percentage
        return this.calculateAverage(numbers);

      case 'min':
        return this.calculateMin(numbers);

      case 'max':
        return this.calculateMax(numbers);

      case 'count':
        return {
          type: 'count',
          result: numbers.length,
          explanation: `Found ${numbers.length} numeric values`,
          inputValues: numbers,
        };

      case 'comparison':
        if (numbers.length >= 2) {
          return this.calculateComparison(numbers[0], numbers[1]);
        }
        return null;

      default:
        // For custom/unknown, try to infer from query
        if (numbers.length === 1) {
          return {
            type: 'custom',
            result: numbers[0],
            explanation: `The value is ${this.formatNumber(numbers[0])}`,
            inputValues: numbers,
          };
        }
        // Default to average for multiple numbers
        return this.calculateAverage(numbers);
    }
  }

  /**
   * Format number for display
   */
  formatNumber(value: number): string {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  }

  /**
   * Build explanation for LLM prompt
   */
  buildCalculationPrompt(calculation: CalculationResult): string {
    const parts = [
      `Calculation Result:`,
      `- Type: ${calculation.type}`,
      `- Result: ${typeof calculation.result === 'object' ? JSON.stringify(calculation.result) : calculation.result}`,
      `- Explanation: ${calculation.explanation}`,
    ];

    if (calculation.formula) {
      parts.push(`- Formula: ${calculation.formula}`);
    }

    return parts.join('\n');
  }
}

export default new CalculationService();
