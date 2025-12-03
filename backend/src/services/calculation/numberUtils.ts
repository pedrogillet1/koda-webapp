/**
 * Number Utility Functions
 *
 * Handles number normalization, extraction, and formatting for calculation queries.
 * Fixes issues with commas, currency symbols, and special characters.
 */

/**
 * Normalize numbers in query (remove commas, handle currency)
 *
 * Examples:
 * - "2,547 × 38" → "2547 * 38"
 * - "Calculate 15% of $8,500" → "Calculate 15% of 8500"
 * - "$1,234,567" → "1234567"
 */
export function normalizeNumbersInQuery(query: string): string {
  let normalized = query;

  // Remove commas from numbers (2,547 → 2547)
  // Handle multiple comma groups (1,234,567 → 1234567)
  while (/(\d+),(\d{3})/.test(normalized)) {
    normalized = normalized.replace(/(\d+),(\d{3})/g, '$1$2');
  }

  // Remove currency symbols but keep the number
  // $8,500 → 8500 (comma already removed above)
  normalized = normalized.replace(/\$\s*/g, '');
  normalized = normalized.replace(/€\s*/g, '');
  normalized = normalized.replace(/£\s*/g, '');
  normalized = normalized.replace(/¥\s*/g, '');
  normalized = normalized.replace(/R\$\s*/g, '');

  // Normalize multiplication symbols
  normalized = normalized.replace(/×/g, '*');
  normalized = normalized.replace(/÷/g, '/');

  // Normalize percentage symbol spacing
  normalized = normalized.replace(/(\d+)\s*%/g, '$1%');

  // Normalize thousands/millions abbreviations
  // $10M → 10000000, $500K → 500000
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*M\b/gi, (match, num) => {
    return String(parseFloat(num) * 1000000);
  });
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*K\b/gi, (match, num) => {
    return String(parseFloat(num) * 1000);
  });
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*B\b/gi, (match, num) => {
    return String(parseFloat(num) * 1000000000);
  });

  return normalized;
}

/**
 * Extract all numbers from text
 *
 * @param text - The text to extract numbers from
 * @returns Array of numbers found in the text
 */
export function extractNumbers(text: string): number[] {
  // First normalize
  const normalized = normalizeNumbersInQuery(text);

  // Extract all numbers (including decimals and negatives)
  const matches = normalized.match(/-?\d+\.?\d*/g);

  if (!matches) {
    return [];
  }

  return matches.map(m => parseFloat(m)).filter(n => !isNaN(n));
}

/**
 * Extract percentage values from text
 *
 * @param text - The text to search
 * @returns Array of percentage values (as decimals, e.g., 25% → 0.25)
 */
export function extractPercentages(text: string): number[] {
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g);

  if (!matches) {
    return [];
  }

  return matches.map(m => {
    const value = parseFloat(m.replace('%', ''));
    return value / 100;
  });
}

/**
 * Check if query contains calculation-related content
 *
 * @param query - The query to check
 * @returns true if the query appears to be a calculation request
 */
export function containsCalculation(query: string): boolean {
  const normalized = normalizeNumbersInQuery(query);

  // Check for arithmetic operators with numbers
  const arithmeticPattern = /\d+\s*[\+\-\*\/]\s*\d+/;
  if (arithmeticPattern.test(normalized)) {
    return true;
  }

  // Check for percentage calculations
  if (/\d+\s*%\s+(of|from|to)/i.test(normalized)) {
    return true;
  }

  // Check for calculation keywords
  const calcKeywords = [
    'calculate',
    'compute',
    'what is',
    'how much',
    'total',
    'sum',
    'average',
    'mean',
    'median',
    'percentage',
    '% of',
    'multiply',
    'divide',
    'add',
    'subtract',
    'interest',
    'irr',
    'npv',
    'roi',
    'convert',
    'ratio'
  ];

  const lowerQuery = normalized.toLowerCase();
  return calcKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Format number for display
 *
 * @param value - The number to format
 * @param options - Formatting options
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  options: {
    decimals?: number;
    currency?: string;
    percentage?: boolean;
    thousandsSeparator?: boolean;
  } = {}
): string {
  const {
    decimals = 2,
    currency,
    percentage = false,
    thousandsSeparator = true
  } = options;

  let result: string;

  if (percentage) {
    result = (value * 100).toFixed(decimals) + '%';
  } else {
    result = value.toFixed(decimals);
  }

  // Add thousands separator
  if (thousandsSeparator && !percentage) {
    const parts = result.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    result = parts.join('.');
  }

  // Add currency symbol
  if (currency) {
    result = currency + result;
  }

  return result;
}

/**
 * Parse a number from various formats
 *
 * @param value - The value to parse (string or number)
 * @returns Parsed number or NaN if invalid
 */
export function parseNumber(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  // Normalize the string
  let normalized = normalizeNumbersInQuery(value);

  // Remove any non-numeric characters except decimal point and minus
  normalized = normalized.replace(/[^\d.\-]/g, '');

  return parseFloat(normalized);
}

/**
 * Check if a value is a valid number
 *
 * @param value - The value to check
 * @returns true if the value is a valid finite number
 */
export function isValidNumber(value: any): boolean {
  const num = typeof value === 'number' ? value : parseNumber(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Round number to specified precision
 *
 * @param value - The number to round
 * @param precision - Number of decimal places
 * @returns Rounded number
 */
export function roundTo(value: number, precision: number = 2): number {
  const multiplier = Math.pow(10, precision);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Test function to verify normalization works correctly
 */
export function testNumberNormalization(): void {
  const tests = [
    {
      input: 'What is 2,547 × 38?',
      expected: 'What is 2547 * 38?'
    },
    {
      input: 'Calculate 15% of $8,500',
      expected: 'Calculate 15% of 8500'
    },
    {
      input: 'If revenue is $1,234,567',
      expected: 'If revenue is 1234567'
    },
    {
      input: 'Revenue is $10M and costs are $7M',
      expected: 'Revenue is 10000000 and costs are 7000000'
    },
    {
      input: 'Sales of $500K',
      expected: 'Sales of 500000'
    }
  ];

  console.log('Testing Number Normalization:');
  console.log('='.repeat(50));

  tests.forEach(test => {
    const result = normalizeNumbersInQuery(test.input);
    const passed = result === test.expected;

    console.log(`Input:    "${test.input}"`);
    console.log(`Expected: "${test.expected}"`);
    console.log(`Result:   "${result}"`);
    console.log(`Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('-'.repeat(50));
  });
}
