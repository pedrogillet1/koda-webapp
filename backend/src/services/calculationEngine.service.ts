/**
 * Calculation Engine
 * 
 * Target: < 3s (including explanation)
 * 
 * Rules:
 * - Compute math in JavaScript (< 5ms)
 * - Use Flash ONLY for explanation, not for math
 * - Optional: tiny retrieval if numbers come from docs
 * - NO Pro model, NO heavy RAG
 */

import { gemini } from './gemini.service';
import { embeddingService } from './embedding.service';
import { pineconeService } from './pinecone.service';

// ============================================================================
// CALCULATION PARSER
// ============================================================================

interface ParsedCalculation {
  type: 'percentage' | 'growth' | 'payback' | 'roi' | 'margin' | 'moic' | 'irr' | 'simple';
  numbers: number[];
  operation: string;
  needsDocNumbers: boolean;
  docQuery?: string;
}

function parseCalculation(query: string): ParsedCalculation {
  const lowerQuery = query.toLowerCase();

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

function compute(parsed: ParsedCalculation): number {
  const { type, numbers, operation } = parsed;

  switch (type) {
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
  // Quick embedding + retrieval (< 500ms)
  const embedding = await embeddingService.embedQuery(query);
  
  const results = await pineconeService.query({
    vector: embedding,
    topK: 3, // Only 3 chunks
    filter: { userId },
  });

  // Extract numbers from chunks
  const numbers: number[] = [];
  let context = '';

  for (const match of results.matches || []) {
    const text = match.metadata?.text || '';
    context += text + '\n';
    
    const extractedNumbers = extractNumbers(text);
    numbers.push(...extractedNumbers);
  }

  return { numbers, context };
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

export async function handleCalculation(
  query: string,
  language: string,
  userId: string
): Promise<{ numericResult: number; explanation: string }> {
  // 1. Parse calculation
  const parsed = parseCalculation(query);

  // 2. Get numbers (from query or docs)
  let numbers = parsed.numbers;
  let context = '';

  if (parsed.needsDocNumbers && parsed.docQuery) {
    const retrieved = await retrieveNumbersFromDocs(userId, parsed.docQuery);
    numbers = retrieved.numbers;
    context = retrieved.context;
  }

  // 3. Compute result in JS (< 5ms)
  const numericResult = compute({ ...parsed, numbers });

  // 4. Ask Flash to explain result (NOT to redo math)
  const languageNames = {
    en: 'English',
    pt: 'Portuguese',
    es: 'Spanish',
  };

  const lang = language.toLowerCase().startsWith('pt') ? 'pt' : 
               language.toLowerCase().startsWith('es') ? 'es' : 'en';

  const model = gemini.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction: `You are a financial calculator assistant.

CRITICAL RULES:
- The numeric result is already computed: ${numericResult}
- DO NOT redo the math or introduce new numbers
- Explain the result briefly (max 120 words) in ${languageNames[lang]}
- Format the result nicely (e.g., "15% of $63M = $9.45M")
- If context from documents is provided, mention the source
- Be concise and clear

Calculation type: ${parsed.type}
Operation: ${parsed.operation}
Input numbers: ${numbers.join(', ')}
Result: ${numericResult}

${context ? `Document context:\n${context}` : ''}`,
    generationConfig: {
      maxOutputTokens: 250,
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(query);
  const explanation = result.response.text();

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
