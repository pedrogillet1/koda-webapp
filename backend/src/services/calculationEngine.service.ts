/**
 * Calculation Engine
 *
 * Target: < 3s (including explanation)
 *
 * Rules:
 * - Compute math in JavaScript (< 5ms)
 * - Use LLM ONLY for explanation, not for math
 * - Optional: tiny retrieval if numbers come from docs
 * - NO heavy RAG
 */

import { generateText } from './gemini.service';
import embeddingService from './embedding.service';
import pineconeService from './pinecone.service';

// ============================================================================
// CALCULATION PARSER
// ============================================================================

interface ParsedCalculation {
  type: 'percentage' | 'growth' | 'payback' | 'roi' | 'margin' | 'moic' | 'irr' | 'simple' | 'expression' | 'llm_fallback';
  numbers: number[];
  operation: string;
  expression?: string;
  needsDocNumbers: boolean;
  docQuery?: string;
}

function parseCalculation(query: string): ParsedCalculation {
  const lowerQuery = query.toLowerCase();

  // First, check if query contains a direct mathematical expression (e.g., "2+2", "5*10", "100/4")
  const mathExprMatch = query.match(/^[\s]*([\d\s\+\-\*\/\(\)\.\,\^]+)[\s]*$/);
  if (mathExprMatch) {
    const expr = mathExprMatch[1].replace(/,/g, '').replace(/\^/g, '**');
    return {
      type: 'expression',
      numbers: [],
      operation: 'eval_expression',
      expression: expr,
      needsDocNumbers: false,
    };
  }

  // Check for "what is X + Y" or "calculate X * Y" patterns
  const calcPatternMatch = query.match(/(?:what\s+is|calculate|compute|quanto\s+[ée]|cu[áa]nto\s+es?)\s+([\d\s\+\-\*\/\(\)\.\,\^]+)/i);
  if (calcPatternMatch) {
    const expr = calcPatternMatch[1].replace(/,/g, '').replace(/\^/g, '**');
    return {
      type: 'expression',
      numbers: [],
      operation: 'eval_expression',
      expression: expr,
      needsDocNumbers: false,
    };
  }

  // Percentage calculation
  if (lowerQuery.match(/(\d+)%\s+of\s+(\d+)/i) || lowerQuery.match(/(\d+)%\s+de\s+(\d+)/i)) {
    const match = query.match(/(\d+)%\s+(?:of|de)\s+([\d,\.]+)/i);
    if (match) {
      const percentage = parseFloat(match[1]);
      const base = parseFloat(match[2].replace(/,/g, ''));
      return {
        type: 'percentage',
        numbers: [percentage, base],
        operation: 'percentage_of',
        needsDocNumbers: false,
      };
    }
  }

  // Growth calculation
  if (lowerQuery.match(/growth|crescimento|crecimiento/i)) {
    const numbers = extractNumbers(query);
    if (numbers.length >= 2) {
      return {
        type: 'growth',
        numbers,
        operation: 'yoy_growth',
        needsDocNumbers: false,
      };
    } else {
      return {
        type: 'growth',
        numbers: [],
        operation: 'yoy_growth',
        needsDocNumbers: true,
        docQuery: query,
      };
    }
  }

  // Payback calculation
  if (lowerQuery.match(/payback/i)) {
    const numbers = extractNumbers(query);
    if (numbers.length >= 2) {
      return {
        type: 'payback',
        numbers,
        operation: 'payback_period',
        needsDocNumbers: false,
      };
    } else {
      return {
        type: 'payback',
        numbers: [],
        operation: 'payback_period',
        needsDocNumbers: true,
        docQuery: query,
      };
    }
  }

  // ROI calculation
  if (lowerQuery.match(/roi|return on investment|retorno sobre investimento/i)) {
    const numbers = extractNumbers(query);
    if (numbers.length >= 2) {
      return {
        type: 'roi',
        numbers,
        operation: 'roi',
        needsDocNumbers: false,
      };
    } else {
      return {
        type: 'roi',
        numbers: [],
        operation: 'roi',
        needsDocNumbers: true,
        docQuery: query,
      };
    }
  }

  // Margin calculation
  if (lowerQuery.match(/margin|margem/i)) {
    const numbers = extractNumbers(query);
    if (numbers.length >= 2) {
      return {
        type: 'margin',
        numbers,
        operation: 'margin',
        needsDocNumbers: false,
      };
    } else {
      return {
        type: 'margin',
        numbers: [],
        operation: 'margin',
        needsDocNumbers: true,
        docQuery: query,
      };
    }
  }

  // MOIC calculation
  if (lowerQuery.match(/moic|multiple on invested capital/i)) {
    const numbers = extractNumbers(query);
    if (numbers.length >= 2) {
      return {
        type: 'moic',
        numbers,
        operation: 'moic',
        needsDocNumbers: false,
      };
    } else {
      return {
        type: 'moic',
        numbers: [],
        operation: 'moic',
        needsDocNumbers: true,
        docQuery: query,
      };
    }
  }

  // IRR calculation (complex, needs more data)
  if (lowerQuery.match(/irr|internal rate of return|taxa interna de retorno/i)) {
    return {
      type: 'irr',
      numbers: [],
      operation: 'irr',
      needsDocNumbers: true,
      docQuery: query,
    };
  }

  // Simple arithmetic
  const numbers = extractNumbers(query);
  if (numbers.length >= 2) {
    return {
      type: 'simple',
      numbers,
      operation: detectOperation(query),
      needsDocNumbers: false,
    };
  }

  // Default: needs doc numbers
  return {
    type: 'simple',
    numbers: [],
    operation: 'unknown',
    needsDocNumbers: true,
    docQuery: query,
  };
}

function extractNumbers(text: string): number[] {
  // Match numbers with optional commas, decimals, and currency symbols
  const matches = text.match(/\$?[\d,]+\.?\d*/g);
  if (!matches) return [];
  
  return matches
    .map(m => parseFloat(m.replace(/[$,]/g, '')))
    .filter(n => !isNaN(n));
}

function detectOperation(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.match(/\+|plus|add|soma/)) return 'add';
  if (lowerText.match(/-|minus|subtract|menos/)) return 'subtract';
  if (lowerText.match(/\*|×|times|multiply|vezes/)) return 'multiply';
  if (lowerText.match(/\/|÷|divide|dividir/)) return 'divide';
  
  return 'unknown';
}

// ============================================================================
// COMPUTE FUNCTIONS
// ============================================================================

/**
 * Safely evaluate a mathematical expression
 */
function safeEval(expression: string): number {
  try {
    // Remove any non-math characters for safety
    const sanitized = expression.replace(/[^0-9\+\-\*\/\(\)\.\s]/g, '');
    if (!sanitized.trim()) return NaN;

    // Use Function constructor with restricted scope (safer than eval)
    const mathFunctions = {
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      sqrt: Math.sqrt,
      pow: Math.pow,
      min: Math.min,
      max: Math.max,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      log: Math.log,
      exp: Math.exp,
      PI: Math.PI,
      E: Math.E,
    };

    const fn = new Function(
      ...Object.keys(mathFunctions),
      `"use strict"; return (${sanitized})`
    );
    const result = fn(...Object.values(mathFunctions));

    if (typeof result !== 'number' || !isFinite(result)) {
      return NaN;
    }

    return result;
  } catch (error) {
    console.error('[safeEval] Error evaluating expression:', expression, error);
    return NaN;
  }
}

function compute(parsed: ParsedCalculation): number {
  const { type, numbers, operation, expression } = parsed;

  switch (type) {
    case 'expression':
      if (!expression) return NaN;
      return safeEval(expression);

    case 'percentage':
      return (numbers[0] / 100) * numbers[1];

    case 'growth':
      if (numbers.length < 2) return NaN;
      return ((numbers[1] - numbers[0]) / numbers[0]) * 100;

    case 'payback':
      if (numbers.length < 2) return NaN;
      return numbers[0] / numbers[1]; // investment / annual cash flow

    case 'roi':
      if (numbers.length < 2) return NaN;
      return ((numbers[1] - numbers[0]) / numbers[0]) * 100;

    case 'margin':
      if (numbers.length < 2) return NaN;
      return (numbers[0] / numbers[1]) * 100;

    case 'moic':
      if (numbers.length < 2) return NaN;
      return numbers[1] / numbers[0]; // exit value / invested capital

    case 'irr':
      // IRR requires cash flow series, can't compute from 2 numbers
      return NaN;

    case 'simple':
      if (numbers.length < 2) return NaN;
      switch (operation) {
        case 'add': return numbers.reduce((a, b) => a + b, 0);
        case 'subtract': return numbers[0] - numbers[1];
        case 'multiply': return numbers.reduce((a, b) => a * b, 1);
        case 'divide': return numbers[0] / numbers[1];
        default: return NaN;
      }

    case 'llm_fallback':
      // LLM will compute this
      return NaN;

    default:
      return NaN;
  }
}

// ============================================================================
// RETRIEVE NUMBERS FROM DOCS (if needed)
// ============================================================================

async function retrieveNumbersFromDocs(
  userId: string,
  query: string
): Promise<{ numbers: number[]; context: string }> {
  try {
    // Quick embedding + retrieval (< 500ms)
    const embeddingResult = await embeddingService.generateQueryEmbedding(query);

    const results = await pineconeService.searchSimilarChunks(
      embeddingResult.embedding,
      userId,
      3, // Only 3 chunks
      0.3 // Lower threshold for calculation queries
    );

    // Extract numbers from chunks
    const numbers: number[] = [];
    let context = '';

    for (const match of results) {
      const text = match.content || '';
      context += text + '\n';

      const extractedNumbers = extractNumbers(text);
      numbers.push(...extractedNumbers);
    }

    return { numbers, context };
  } catch (error) {
    console.error('[retrieveNumbersFromDocs] Error:', error);
    return { numbers: [], context: '' };
  }
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

export async function handleCalculation(
  query: string,
  language: string,
  userId: string
): Promise<{ numericResult: number; explanation: string }> {
  console.log(`[CalculationEngine] Processing: "${query}"`);

  // 1. Parse calculation
  const parsed = parseCalculation(query);
  console.log(`[CalculationEngine] Parsed type: ${parsed.type}, operation: ${parsed.operation}`);

  // 2. Get numbers (from query or docs)
  let numbers = parsed.numbers;
  let context = '';

  if (parsed.needsDocNumbers && parsed.docQuery) {
    console.log(`[CalculationEngine] Retrieving numbers from documents...`);
    const retrieved = await retrieveNumbersFromDocs(userId, parsed.docQuery);
    numbers = retrieved.numbers;
    context = retrieved.context;
    console.log(`[CalculationEngine] Retrieved ${numbers.length} numbers from documents`);
  }

  // 3. Compute result in JS (< 5ms)
  let numericResult = compute({ ...parsed, numbers });
  console.log(`[CalculationEngine] Computed result: ${numericResult}`);

  // Language setup
  const languageNames: Record<string, string> = {
    en: 'English',
    pt: 'Portuguese',
    es: 'Spanish',
  };

  const lang = language.toLowerCase().startsWith('pt') ? 'pt' :
               language.toLowerCase().startsWith('es') ? 'es' : 'en';

  // 4. If computation failed (NaN), use LLM to compute AND explain
  if (isNaN(numericResult)) {
    console.log(`[CalculationEngine] JS computation failed, using LLM fallback`);

    const prompt = `You are a precise calculator assistant. You MUST compute mathematical calculations accurately.

CRITICAL RULES:
1. First, compute the exact numeric result for the user's calculation
2. Show your work step by step
3. Present the final answer clearly with = sign (e.g., "= 42")
4. Respond in ${languageNames[lang]}
5. Keep explanation under 150 words
6. Format numbers nicely (e.g., use commas for thousands: 1,000,000)

${context ? `Document context (use these numbers if relevant):\n${context}` : ''}

User query: ${query}`;

    const explanation = await generateText({
      prompt,
      temperature: 0.1, // Low temperature for accuracy
      maxTokens: 400,
    });

    // Try to extract the numeric result from the LLM response
    const resultMatch = explanation.match(/=\s*([\d,\.]+)/);
    if (resultMatch) {
      numericResult = parseFloat(resultMatch[1].replace(/,/g, ''));
    }

    return { numericResult, explanation };
  }

  // 5. Ask LLM to explain the pre-computed result (NOT to redo math)
  const prompt = `You are a financial calculator assistant.

CRITICAL RULES:
- The numeric result is ALREADY COMPUTED: ${numericResult}
- DO NOT redo the math or change the result
- Present the result clearly in ${languageNames[lang]}
- Format the result nicely (e.g., "15% of $63M = $9.45M")
- If context from documents is provided, mention the source
- Keep explanation brief (max 100 words)
- Be concise and clear

Calculation type: ${parsed.type}
Operation: ${parsed.operation}
${parsed.expression ? `Expression: ${parsed.expression}` : `Input numbers: ${numbers.join(', ')}`}
FINAL RESULT: ${numericResult}

${context ? `Document context:\n${context}` : ''}

User asked: ${query}`;

  const explanation = await generateText({
    prompt,
    temperature: 0.2,
    maxTokens: 250,
  });

  console.log(`[CalculationEngine] Complete - Result: ${numericResult}`);
  return { numericResult, explanation };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const calculationEngine = {
  handleCalculation,
  parseCalculation,
  compute,
};
