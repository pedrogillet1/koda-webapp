/**
 * numericFactsExtractor.service.ts
 *
 * Extracts financial facts (numbers, metrics) from document chunks
 * for DEEP_FINANCIAL_ANALYSIS mode.
 *
 * Uses regex + LLM classification to identify:
 * - NET_PROFIT, INVESTMENT, ADDITIONAL_REVENUE, OPERATING_COST_PERCENT
 * - LOCABLE_AREA, and other financial metrics
 * - Maps them to scenarios: BASELINE, CONSERVATIVE, OPTIMISTIC
 */

import geminiClient from './geminiClient.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ScenarioType = 'BASELINE' | 'CONSERVATIVE' | 'OPTIMISTIC';

export type MetricType =
  | 'NET_PROFIT'
  | 'INVESTMENT'
  | 'ADDITIONAL_REVENUE'
  | 'OPERATING_COST_PERCENT'
  | 'LOCABLE_AREA'
  | 'OTHER';

export type UnitType = 'BRL' | 'PERCENT' | 'M2' | 'MONTHLY' | 'YEARLY';

export interface FinancialFact {
  scenario: ScenarioType;
  metric: MetricType;
  value: number;
  unit: UnitType;
  sourceChunkId: string;
  rawText: string;
  confidence: number; // 0.0-1.0
}

export interface NumericExtractionResult {
  facts: FinancialFact[];
  totalExtracted: number;
  byScenario: {
    baseline: number;
    conservative: number;
    optimistic: number;
  };
  byMetric: Record<MetricType, number>;
}

// ============================================================================
// REGEX PATTERNS FOR NUMBER EXTRACTION
// ============================================================================

const NUMBER_PATTERNS = [
  // BRL currency: R$ 1.234,56 or R$ 1234.56
  /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/gi,

  // Percentages: 15% or 15.5%
  /(\d+(?:[.,]\d+)?)\s*%/gi,

  // Areas: 1.234 m² or 1234m2
  /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*m[²2]/gi,

  // Plain numbers with context (lucro líquido: 50.000)
  /(?:lucro|receita|investimento|custo|área)[\s\w]*[:]\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,

  // Numbers in tables or lists
  /[-•]\s*[\w\s]+[:]\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize Brazilian number format to float
 * "1.234,56" → 1234.56
 * "1234.56" → 1234.56
 */
function normalizeNumber(numStr: string): number {
  // Remove R$ symbol and spaces
  let cleaned = numStr.replace(/R\$|\s/g, '');

  // Check if it's Brazilian format (has comma as decimal separator)
  if (/\d+\.\d{3},\d{2}/.test(cleaned) || /^\d+,\d{2}$/.test(cleaned)) {
    // Brazilian format: 1.234,56 → 1234.56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  return parseFloat(cleaned);
}

/**
 * Extract all numeric values from a text chunk
 */
function extractNumbersFromText(text: string): Array<{ value: number; rawText: string; context: string }> {
  const results: Array<{ value: number; rawText: string; context: string }> = [];

  for (const pattern of NUMBER_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const rawText = match[0];
      const numberPart = match[1] || match[0];

      try {
        const value = normalizeNumber(numberPart);
        if (!isNaN(value) && value > 0) {
          // Get surrounding context (50 chars before/after)
          const startIdx = Math.max(0, match.index - 50);
          const endIdx = Math.min(text.length, match.index + rawText.length + 50);
          const context = text.substring(startIdx, endIdx);

          results.push({ value, rawText, context });
        }
      } catch (e) {
        // Skip invalid numbers
      }
    }
  }

  return results;
}

/**
 * Classify extracted number using LLM
 */
async function classifyFinancialFact(
  value: number,
  rawText: string,
  context: string,
  scenario: ScenarioType
): Promise<{ metric: MetricType; unit: UnitType; confidence: number } | null> {

  const prompt = `Classify this financial fact:

**Number:** ${value}
**Raw Text:** "${rawText}"
**Context:** "${context}"
**Scenario:** ${scenario}

Classify the metric type and unit:

**Metric Types:**
- NET_PROFIT: Monthly net profit (lucro líquido mensal)
- INVESTMENT: Total investment amount (investimento total)
- ADDITIONAL_REVENUE: Additional monthly revenue (receita adicional mensal)
- OPERATING_COST_PERCENT: Operating cost as percentage (% custo operacional)
- LOCABLE_AREA: Leasable area in m² (área locável)
- OTHER: Other metrics

**Unit Types:**
- BRL: Brazilian Real currency
- PERCENT: Percentage value
- M2: Square meters
- MONTHLY: Monthly value in BRL
- YEARLY: Yearly value in BRL

Respond in this EXACT format (one line):
METRIC_TYPE|UNIT_TYPE|CONFIDENCE

Example: NET_PROFIT|MONTHLY|0.95

If you cannot classify confidently, respond with: OTHER|BRL|0.0`;

  try {
    const model = geminiClient.getModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Parse response: METRIC_TYPE|UNIT_TYPE|CONFIDENCE
    const parts = text.split('|');
    if (parts.length !== 3) {
      return null;
    }

    const metric = parts[0].trim() as MetricType;
    const unit = parts[1].trim() as UnitType;
    const confidence = parseFloat(parts[2].trim());

    // Validate
    const validMetrics: MetricType[] = ['NET_PROFIT', 'INVESTMENT', 'ADDITIONAL_REVENUE', 'OPERATING_COST_PERCENT', 'LOCABLE_AREA', 'OTHER'];
    const validUnits: UnitType[] = ['BRL', 'PERCENT', 'M2', 'MONTHLY', 'YEARLY'];

    if (!validMetrics.includes(metric) || !validUnits.includes(unit) || isNaN(confidence)) {
      return null;
    }

    // Filter low confidence
    if (confidence < 0.5) {
      return null;
    }

    return { metric, unit, confidence };

  } catch (error) {
    console.error('❌ [NUMERIC FACTS] LLM classification error:', error);
    return null;
  }
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract financial facts from document chunks across all scenarios
 */
export async function extractFinancialFacts(
  baselineChunks: any[],
  conservativeChunks: any[],
  optimisticChunks: any[]
): Promise<NumericExtractionResult> {

  console.log('📊 [NUMERIC FACTS] Starting extraction...');
  console.log(`📊 [NUMERIC FACTS] Chunks: ${baselineChunks.length} baseline, ${conservativeChunks.length} conservative, ${optimisticChunks.length} optimistic`);

  const allFacts: FinancialFact[] = [];
  const byMetric: Record<MetricType, number> = {
    NET_PROFIT: 0,
    INVESTMENT: 0,
    ADDITIONAL_REVENUE: 0,
    OPERATING_COST_PERCENT: 0,
    LOCABLE_AREA: 0,
    OTHER: 0,
  };

  // Process each scenario
  const scenarios: Array<{ type: ScenarioType; chunks: any[] }> = [
    { type: 'BASELINE', chunks: baselineChunks },
    { type: 'CONSERVATIVE', chunks: conservativeChunks },
    { type: 'OPTIMISTIC', chunks: optimisticChunks },
  ];

  for (const { type: scenario, chunks } of scenarios) {
    console.log(`📊 [NUMERIC FACTS] Processing ${scenario} scenario (${chunks.length} chunks)...`);

    for (const chunk of chunks) {
      const text = chunk.text || chunk.content || '';
      const chunkId = chunk.id || chunk.chunkId || 'unknown';

      // Extract numbers from text
      const numbers = extractNumbersFromText(text);
      console.log(`📊 [NUMERIC FACTS] Chunk ${chunkId}: Found ${numbers.length} numbers`);

      // Classify each number
      for (const { value, rawText, context } of numbers) {
        const classification = await classifyFinancialFact(value, rawText, context, scenario);

        if (classification && classification.metric !== 'OTHER') {
          const fact: FinancialFact = {
            scenario,
            metric: classification.metric,
            value,
            unit: classification.unit,
            sourceChunkId: chunkId,
            rawText,
            confidence: classification.confidence,
          };

          allFacts.push(fact);
          byMetric[classification.metric]++;

          console.log(`✅ [NUMERIC FACTS] Extracted: ${classification.metric} = ${value} ${classification.unit} (confidence: ${classification.confidence.toFixed(2)})`);
        }
      }
    }
  }

  // Deduplicate facts (keep highest confidence for each scenario+metric)
  const deduplicatedFacts = deduplicateFacts(allFacts);

  console.log(`📊 [NUMERIC FACTS] Extraction complete: ${deduplicatedFacts.length} facts (${allFacts.length} before deduplication)`);

  return {
    facts: deduplicatedFacts,
    totalExtracted: deduplicatedFacts.length,
    byScenario: {
      baseline: deduplicatedFacts.filter(f => f.scenario === 'BASELINE').length,
      conservative: deduplicatedFacts.filter(f => f.scenario === 'CONSERVATIVE').length,
      optimistic: deduplicatedFacts.filter(f => f.scenario === 'OPTIMISTIC').length,
    },
    byMetric,
  };
}

/**
 * Deduplicate facts: Keep highest confidence for each scenario+metric combination
 */
function deduplicateFacts(facts: FinancialFact[]): FinancialFact[] {
  const bestByKey = new Map<string, FinancialFact>();

  for (const fact of facts) {
    const key = `${fact.scenario}:${fact.metric}`;
    const existing = bestByKey.get(key);

    if (!existing || fact.confidence > existing.confidence) {
      bestByKey.set(key, fact);
    }
  }

  return Array.from(bestByKey.values());
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  extractFinancialFacts,
};
