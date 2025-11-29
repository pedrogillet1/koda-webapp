/**
 * Terminology Intelligence Service
 *
 * PURPOSE: Provide ChatGPT-level explanations of academic terms and concepts
 * WHY: Transform "mentioned in 12 papers" → comprehensive definitions with formulas and context
 * HOW: Extract definitions, formulas, interpretations, and aggregate values from user's documents
 * IMPACT: Academic-quality explanations grounded in user's own document library
 *
 * Features:
 * - Definition extraction (explicit and implicit)
 * - Formula extraction with LaTeX/mathematical notation
 * - Interpretation guidelines ("values above X indicate...")
 * - Value aggregation with statistics (min, max, avg, by category)
 * - Cross-document synthesis of terminology usage
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TermDefinition {
  term: string;
  definition: string;
  source: 'explicit' | 'implicit' | 'inferred';
  confidence: number;
  documentId?: string;
  documentName?: string;
  pageNumber?: number;
}

export interface TermFormula {
  term: string;
  formula: string;              // The formula text (e.g., "(R_p - R_f) / σ_p")
  formulaLatex?: string;        // LaTeX version if available
  variables?: FormulaVariable[];
  documentId?: string;
  confidence: number;
}

export interface FormulaVariable {
  symbol: string;               // e.g., "R_p"
  meaning: string;              // e.g., "portfolio return"
}

export interface TermInterpretation {
  term: string;
  interpretations: InterpretationRule[];
  documentId?: string;
  confidence: number;
}

export interface InterpretationRule {
  condition: string;            // e.g., "> 1.0"
  meaning: string;              // e.g., "Good risk-adjusted performance"
  category?: 'excellent' | 'good' | 'moderate' | 'poor';
}

export interface ExtractedValue {
  term: string;
  value: number;
  context: string;              // Surrounding text
  documentId: string;
  documentName?: string;
  category?: string;            // e.g., "ensemble methods", "single algorithms"
  methodology?: string;         // Associated methodology if any
}

export interface ValueStatistics {
  term: string;
  count: number;
  min: number;
  max: number;
  average: number;
  median: number;
  stdDev: number;
  byCategory: Map<string, { count: number; avg: number; values: number[] }>;
  byDocument: Map<string, number[]>;
}

export interface TerminologyKnowledge {
  term: string;
  normalizedTerm: string;
  aliases: string[];
  definition?: TermDefinition;
  formula?: TermFormula;
  interpretation?: TermInterpretation;
  values: ExtractedValue[];
  statistics?: ValueStatistics;
  relatedTerms: string[];
  documentCount: number;
  lastUpdated: Date;
}

export interface TerminologyResponse {
  term: string;
  definition: string;
  formula?: string;
  formulaExplanation?: string;
  interpretation?: string;
  documentInsights?: string;
  relatedTerms?: string[];
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

// Common academic/financial terms with known formulas
const KNOWN_TERM_FORMULAS: Record<string, { formula: string; variables: FormulaVariable[] }> = {
  'sharpe ratio': {
    formula: '(R_p - R_f) / σ_p',
    variables: [
      { symbol: 'R_p', meaning: 'portfolio return' },
      { symbol: 'R_f', meaning: 'risk-free rate' },
      { symbol: 'σ_p', meaning: 'standard deviation of portfolio returns' },
    ],
  },
  'sortino ratio': {
    formula: '(R_p - R_f) / σ_d',
    variables: [
      { symbol: 'R_p', meaning: 'portfolio return' },
      { symbol: 'R_f', meaning: 'risk-free rate' },
      { symbol: 'σ_d', meaning: 'downside deviation' },
    ],
  },
  'information ratio': {
    formula: '(R_p - R_b) / σ_ε',
    variables: [
      { symbol: 'R_p', meaning: 'portfolio return' },
      { symbol: 'R_b', meaning: 'benchmark return' },
      { symbol: 'σ_ε', meaning: 'tracking error' },
    ],
  },
  'beta': {
    formula: 'Cov(R_p, R_m) / Var(R_m)',
    variables: [
      { symbol: 'R_p', meaning: 'portfolio return' },
      { symbol: 'R_m', meaning: 'market return' },
    ],
  },
  'alpha': {
    formula: 'R_p - [R_f + β(R_m - R_f)]',
    variables: [
      { symbol: 'R_p', meaning: 'portfolio return' },
      { symbol: 'R_f', meaning: 'risk-free rate' },
      { symbol: 'β', meaning: 'portfolio beta' },
      { symbol: 'R_m', meaning: 'market return' },
    ],
  },
  'maximum drawdown': {
    formula: '(Trough - Peak) / Peak',
    variables: [
      { symbol: 'Peak', meaning: 'highest portfolio value before decline' },
      { symbol: 'Trough', meaning: 'lowest portfolio value during decline' },
    ],
  },
  'value at risk': {
    formula: 'VaR_α = -inf{x : P(X ≤ x) ≥ α}',
    variables: [
      { symbol: 'α', meaning: 'confidence level (e.g., 95%)' },
      { symbol: 'X', meaning: 'portfolio returns distribution' },
    ],
  },
  'calmar ratio': {
    formula: 'CAGR / Maximum Drawdown',
    variables: [
      { symbol: 'CAGR', meaning: 'compound annual growth rate' },
    ],
  },
  'treynor ratio': {
    formula: '(R_p - R_f) / β_p',
    variables: [
      { symbol: 'R_p', meaning: 'portfolio return' },
      { symbol: 'R_f', meaning: 'risk-free rate' },
      { symbol: 'β_p', meaning: 'portfolio beta' },
    ],
  },
  'r-squared': {
    formula: '1 - (SS_res / SS_tot)',
    variables: [
      { symbol: 'SS_res', meaning: 'sum of squared residuals' },
      { symbol: 'SS_tot', meaning: 'total sum of squares' },
    ],
  },
  'mean absolute error': {
    formula: '(1/n) Σ|y_i - ŷ_i|',
    variables: [
      { symbol: 'y_i', meaning: 'actual value' },
      { symbol: 'ŷ_i', meaning: 'predicted value' },
      { symbol: 'n', meaning: 'number of observations' },
    ],
  },
  'root mean square error': {
    formula: '√[(1/n) Σ(y_i - ŷ_i)²]',
    variables: [
      { symbol: 'y_i', meaning: 'actual value' },
      { symbol: 'ŷ_i', meaning: 'predicted value' },
      { symbol: 'n', meaning: 'number of observations' },
    ],
  },
  'f1 score': {
    formula: '2 × (Precision × Recall) / (Precision + Recall)',
    variables: [
      { symbol: 'Precision', meaning: 'TP / (TP + FP)' },
      { symbol: 'Recall', meaning: 'TP / (TP + FN)' },
    ],
  },
  'precision': {
    formula: 'TP / (TP + FP)',
    variables: [
      { symbol: 'TP', meaning: 'true positives' },
      { symbol: 'FP', meaning: 'false positives' },
    ],
  },
  'recall': {
    formula: 'TP / (TP + FN)',
    variables: [
      { symbol: 'TP', meaning: 'true positives' },
      { symbol: 'FN', meaning: 'false negatives' },
    ],
  },
  'accuracy': {
    formula: '(TP + TN) / (TP + TN + FP + FN)',
    variables: [
      { symbol: 'TP', meaning: 'true positives' },
      { symbol: 'TN', meaning: 'true negatives' },
      { symbol: 'FP', meaning: 'false positives' },
      { symbol: 'FN', meaning: 'false negatives' },
    ],
  },
};

// Known interpretation thresholds for common metrics
const KNOWN_INTERPRETATIONS: Record<string, InterpretationRule[]> = {
  'sharpe ratio': [
    { condition: '> 3.0', meaning: 'Excellent risk-adjusted performance', category: 'excellent' },
    { condition: '> 2.0', meaning: 'Very good risk-adjusted performance', category: 'good' },
    { condition: '> 1.0', meaning: 'Good risk-adjusted performance', category: 'good' },
    { condition: '0.5 - 1.0', meaning: 'Moderate risk-adjusted performance', category: 'moderate' },
    { condition: '< 0.5', meaning: 'Poor risk-adjusted performance (not compensated for risk)', category: 'poor' },
  ],
  'sortino ratio': [
    { condition: '> 2.0', meaning: 'Excellent downside risk-adjusted performance', category: 'excellent' },
    { condition: '> 1.0', meaning: 'Good downside risk-adjusted performance', category: 'good' },
    { condition: '< 1.0', meaning: 'Poor downside risk-adjusted performance', category: 'poor' },
  ],
  'information ratio': [
    { condition: '> 1.0', meaning: 'Excellent active management', category: 'excellent' },
    { condition: '> 0.5', meaning: 'Good active management', category: 'good' },
    { condition: '0.0 - 0.5', meaning: 'Moderate active management', category: 'moderate' },
    { condition: '< 0.0', meaning: 'Underperforming benchmark', category: 'poor' },
  ],
  'beta': [
    { condition: '> 1.0', meaning: 'More volatile than market (aggressive)', category: 'moderate' },
    { condition: '= 1.0', meaning: 'Same volatility as market', category: 'good' },
    { condition: '< 1.0', meaning: 'Less volatile than market (defensive)', category: 'good' },
    { condition: '< 0', meaning: 'Moves opposite to market', category: 'moderate' },
  ],
  'alpha': [
    { condition: '> 0', meaning: 'Outperforming risk-adjusted benchmark', category: 'good' },
    { condition: '= 0', meaning: 'Matching risk-adjusted benchmark', category: 'moderate' },
    { condition: '< 0', meaning: 'Underperforming risk-adjusted benchmark', category: 'poor' },
  ],
  'r-squared': [
    { condition: '> 0.9', meaning: 'Excellent model fit', category: 'excellent' },
    { condition: '0.7 - 0.9', meaning: 'Good model fit', category: 'good' },
    { condition: '0.5 - 0.7', meaning: 'Moderate model fit', category: 'moderate' },
    { condition: '< 0.5', meaning: 'Poor model fit', category: 'poor' },
  ],
  'f1 score': [
    { condition: '> 0.9', meaning: 'Excellent classification performance', category: 'excellent' },
    { condition: '0.8 - 0.9', meaning: 'Good classification performance', category: 'good' },
    { condition: '0.6 - 0.8', meaning: 'Moderate classification performance', category: 'moderate' },
    { condition: '< 0.6', meaning: 'Poor classification performance', category: 'poor' },
  ],
  'accuracy': [
    { condition: '> 95%', meaning: 'Excellent accuracy', category: 'excellent' },
    { condition: '90-95%', meaning: 'Very good accuracy', category: 'good' },
    { condition: '80-90%', meaning: 'Good accuracy', category: 'good' },
    { condition: '70-80%', meaning: 'Moderate accuracy', category: 'moderate' },
    { condition: '< 70%', meaning: 'Poor accuracy', category: 'poor' },
  ],
  'maximum drawdown': [
    { condition: '< 10%', meaning: 'Low risk, conservative strategy', category: 'excellent' },
    { condition: '10-20%', meaning: 'Moderate risk', category: 'good' },
    { condition: '20-30%', meaning: 'High risk', category: 'moderate' },
    { condition: '> 30%', meaning: 'Very high risk', category: 'poor' },
  ],
};

// Patterns to extract formulas from text
const FORMULA_PATTERNS = [
  // "X is calculated as Y" or "X is computed as Y"
  /([A-Za-z][a-zA-Z\s\-]+?)\s+(?:is|are)\s+(?:calculated|computed|defined|given|expressed)\s+(?:as|by)\s*[:=]?\s*([^\n.]+)/gi,

  // "Formula: X = Y" or "Equation: X = Y"
  /(?:formula|equation)\s*[:=]?\s*([^\n=]+)\s*=\s*([^\n]+)/gi,

  // Mathematical notation with equals sign
  /([A-Za-z_]+)\s*=\s*([^,.\n]+(?:\/[^,.\n]+)?)/g,

  // "where X = Y"
  /where\s+([A-Za-z_]+)\s*=\s*([^,.\n]+)/gi,
];

// Patterns to extract interpretation thresholds
const INTERPRETATION_PATTERNS = [
  // "values above/below X indicate/suggest Y"
  /(?:values?|scores?|ratios?)\s+(?:above|greater than|>)\s*([\d.]+)\s+(?:indicate|suggest|represent|mean)\s+([^.]+)/gi,
  /(?:values?|scores?|ratios?)\s+(?:below|less than|<)\s*([\d.]+)\s+(?:indicate|suggest|represent|mean)\s+([^.]+)/gi,

  // "X > Y is considered Z"
  /([A-Za-z\s]+)\s*>\s*([\d.]+)\s+(?:is|are)\s+(?:considered|regarded as|indicates?)\s+([^.]+)/gi,
  /([A-Za-z\s]+)\s*<\s*([\d.]+)\s+(?:is|are)\s+(?:considered|regarded as|indicates?)\s+([^.]+)/gi,

  // "a X of Y is good/bad"
  /(?:a|an)\s+([A-Za-z\s]+)\s+(?:of|around)\s*([\d.]+)\s+(?:is|indicates)\s+([^.]+)/gi,

  // "higher/lower X indicates Y"
  /(higher|lower|greater|smaller)\s+([A-Za-z\s]+)\s+(?:indicates?|suggests?|means?)\s+([^.]+)/gi,

  // "typically ranges from X to Y"
  /(?:typically|usually|generally)\s+(?:ranges?|varies?)\s+(?:from|between)\s*([\d.]+)\s+(?:to|and)\s*([\d.]+)/gi,
];

// Patterns to extract numeric values with context
const VALUE_PATTERNS = [
  // "Sharpe ratio of 1.5"
  /([A-Za-z][a-zA-Z\s\-]+?)\s+(?:of|is|was|=|:)\s*([-]?[\d]+\.[\d]+|[-]?[\d]+)/gi,

  // "achieved a Sharpe ratio of 1.5"
  /(?:achieved|obtained|reported|showed|had)\s+(?:a|an)?\s*([A-Za-z][a-zA-Z\s\-]+?)\s+(?:of|=|:)\s*([-]?[\d]+\.[\d]+|[-]?[\d]+)/gi,

  // "1.5 Sharpe ratio"
  /([-]?[\d]+\.[\d]+|[-]?[\d]+)\s+([A-Za-z][a-zA-Z\s\-]+?)(?:\s|,|\.)/gi,

  // "Sharpe: 1.5" or "Sharpe = 1.5"
  /([A-Za-z][a-zA-Z\s\-]+?)[:=]\s*([-]?[\d]+\.[\d]+|[-]?[\d]+)/gi,
];

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINOLOGY INTELLIGENCE SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class TerminologyIntelligenceService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN API: Answer terminology questions
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Main method: Generate a comprehensive answer for a terminology question
   * This is the ChatGPT-style response generator
   */
  async answerTerminologyQuestion(
    userId: string,
    term: string,
    documentChunks: Array<{ content: string; documentId: string; documentName?: string }>,
    options?: {
      includeFormula?: boolean;
      includeInterpretation?: boolean;
      includeDocumentValues?: boolean;
    }
  ): Promise<TerminologyResponse> {
    const startTime = Date.now();
    const normalizedTerm = this.normalizeTerm(term);

    console.log(`📚 [TERMINOLOGY] Answering question about "${term}" for user ${userId}`);

    const opts = {
      includeFormula: true,
      includeInterpretation: true,
      includeDocumentValues: true,
      ...options,
    };

    // Step 1: Extract definition from documents
    const definition = await this.extractDefinition(normalizedTerm, documentChunks);

    // Step 2: Get formula (from known formulas or extract from documents)
    const formula = opts.includeFormula
      ? await this.getFormula(normalizedTerm, documentChunks)
      : undefined;

    // Step 3: Get interpretation guidelines
    const interpretation = opts.includeInterpretation
      ? await this.getInterpretation(normalizedTerm, documentChunks)
      : undefined;

    // Step 4: Extract and aggregate values from documents
    let documentInsights: string | undefined;
    if (opts.includeDocumentValues) {
      const values = this.extractValuesFromDocuments(normalizedTerm, documentChunks);
      if (values.length > 0) {
        const stats = this.calculateStatistics(normalizedTerm, values);
        documentInsights = this.formatDocumentInsights(normalizedTerm, stats, values);
      }
    }

    // Step 5: Format the complete response
    const response = this.formatTerminologyResponse(
      term,
      definition,
      formula,
      interpretation,
      documentInsights
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ [TERMINOLOGY] Generated response in ${processingTime}ms`);

    return response;
  }

  /**
   * Detect if a query is asking about a term definition
   */
  detectTerminologyQuery(query: string): string | null {
    const lowerQuery = query.toLowerCase().trim();

    // Patterns for terminology queries
    const patterns = [
      /^what\s+is\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s*\?)?$/i,
      /^what\s+does\s+(.+?)\s+mean(?:\s*\?)?$/i,
      /^define\s+(.+?)(?:\s*\?)?$/i,
      /^explain\s+(?:the\s+)?(.+?)(?:\s*\?)?$/i,
      /^how\s+is\s+(.+?)\s+calculated(?:\s*\?)?$/i,
      /^what\s+is\s+the\s+formula\s+for\s+(.+?)(?:\s*\?)?$/i,
      /^how\s+do\s+(?:you|i|we)\s+interpret\s+(.+?)(?:\s*\?)?$/i,
      /^what\s+(?:does|do)\s+(.+?)\s+values?\s+(?:mean|indicate)(?:\s*\?)?$/i,
    ];

    for (const pattern of patterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        const term = match[1].trim();
        // Validate it looks like an academic term
        if (this.looksLikeAcademicTerm(term)) {
          return term;
        }
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEFINITION EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Extract definition for a term from document chunks
   */
  private async extractDefinition(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): Promise<TermDefinition | undefined> {
    // First, try pattern-based extraction
    const patternDef = this.extractDefinitionWithPatterns(term, chunks);
    if (patternDef && patternDef.confidence > 0.7) {
      return patternDef;
    }

    // If LLM available and we have relevant chunks, use LLM for better extraction
    if (this.model && chunks.length > 0) {
      const llmDef = await this.extractDefinitionWithLLM(term, chunks);
      if (llmDef) {
        // Merge with pattern-based if both exist
        if (patternDef) {
          return llmDef.confidence > patternDef.confidence ? llmDef : patternDef;
        }
        return llmDef;
      }
    }

    return patternDef;
  }

  /**
   * Extract definition using regex patterns
   */
  private extractDefinitionWithPatterns(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): TermDefinition | undefined {
    const patterns = [
      // "X is defined as Y"
      new RegExp(`${this.escapeRegex(term)}\\s+(?:is|are)\\s+defined\\s+as\\s+([^.!?]+)`, 'gi'),
      // "X refers to Y"
      new RegExp(`${this.escapeRegex(term)}\\s+refers?\\s+to\\s+([^.!?]+)`, 'gi'),
      // "X is a Y"
      new RegExp(`${this.escapeRegex(term)}\\s+(?:is|are)\\s+(?:a|an)\\s+([^.!?]+)`, 'gi'),
      // "X, which is Y"
      new RegExp(`${this.escapeRegex(term)},\\s+which\\s+(?:is|are)\\s+([^.!?,]+)`, 'gi'),
      // "X measures Y"
      new RegExp(`${this.escapeRegex(term)}\\s+measures?\\s+([^.!?]+)`, 'gi'),
      // "X represents Y"
      new RegExp(`${this.escapeRegex(term)}\\s+represents?\\s+([^.!?]+)`, 'gi'),
    ];

    for (const chunk of chunks) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(chunk.content);
        if (match) {
          const definition = this.cleanDefinitionText(match[1]);
          if (definition.length > 20 && definition.length < 500) {
            return {
              term,
              definition,
              source: 'explicit',
              confidence: 0.8,
              documentId: chunk.documentId,
              documentName: chunk.documentName,
            };
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract definition using LLM
   */
  private async extractDefinitionWithLLM(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): Promise<TermDefinition | undefined> {
    if (!this.model) return undefined;

    // Combine relevant chunks
    const combinedText = chunks
      .map(c => c.content)
      .join('\n\n---\n\n')
      .substring(0, 15000);

    const prompt = `Extract the definition of "${term}" from this text.

Text:
"""
${combinedText}
"""

Return ONLY a JSON object:
{
  "definition": "Clear, complete definition of ${term} in 1-3 sentences",
  "source": "explicit" if directly stated, "implicit" if inferred from context,
  "confidence": 0.0-1.0 how confident you are
}

If no definition can be found, return: {"definition": null, "source": null, "confidence": 0}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      if (parsed.definition && parsed.confidence > 0.3) {
        return {
          term,
          definition: parsed.definition,
          source: parsed.source || 'inferred',
          confidence: parsed.confidence,
          documentId: chunks[0]?.documentId,
          documentName: chunks[0]?.documentName,
        };
      }
    } catch (error) {
      console.warn(`⚠️ [TERMINOLOGY] LLM definition extraction failed:`, error);
    }

    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FORMULA EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get formula for a term (from known formulas or extract from documents)
   */
  private async getFormula(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): Promise<TermFormula | undefined> {
    // First check known formulas
    const knownFormula = this.getKnownFormula(term);
    if (knownFormula) {
      return {
        term,
        formula: knownFormula.formula,
        variables: knownFormula.variables,
        confidence: 1.0,
      };
    }

    // Try to extract from documents
    const extractedFormula = await this.extractFormulaFromDocuments(term, chunks);
    return extractedFormula;
  }

  /**
   * Get formula from known formulas database
   */
  private getKnownFormula(term: string): { formula: string; variables: FormulaVariable[] } | undefined {
    const normalizedTerm = this.normalizeTerm(term);

    // Exact match
    if (KNOWN_TERM_FORMULAS[normalizedTerm]) {
      return KNOWN_TERM_FORMULAS[normalizedTerm];
    }

    // Partial match
    for (const [key, value] of Object.entries(KNOWN_TERM_FORMULAS)) {
      if (normalizedTerm.includes(key) || key.includes(normalizedTerm)) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Extract formula from document chunks using LLM
   */
  private async extractFormulaFromDocuments(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): Promise<TermFormula | undefined> {
    if (!this.model || chunks.length === 0) return undefined;

    const combinedText = chunks
      .map(c => c.content)
      .join('\n\n')
      .substring(0, 10000);

    const prompt = `Extract the mathematical formula for "${term}" from this text.

Text:
"""
${combinedText}
"""

Return ONLY a JSON object:
{
  "formula": "The formula using standard notation (e.g., (R_p - R_f) / σ_p)",
  "variables": [
    {"symbol": "R_p", "meaning": "portfolio return"},
    ...
  ],
  "confidence": 0.0-1.0
}

If no formula is found, return: {"formula": null, "variables": [], "confidence": 0}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      if (parsed.formula && parsed.confidence > 0.5) {
        return {
          term,
          formula: parsed.formula,
          variables: parsed.variables || [],
          documentId: chunks[0]?.documentId,
          confidence: parsed.confidence,
        };
      }
    } catch (error) {
      console.warn(`⚠️ [TERMINOLOGY] Formula extraction failed:`, error);
    }

    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTERPRETATION EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get interpretation guidelines for a term
   */
  private async getInterpretation(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): Promise<TermInterpretation | undefined> {
    // First check known interpretations
    const knownInterp = this.getKnownInterpretation(term);
    if (knownInterp) {
      return {
        term,
        interpretations: knownInterp,
        confidence: 1.0,
      };
    }

    // Try to extract from documents
    const extractedInterp = await this.extractInterpretationFromDocuments(term, chunks);
    return extractedInterp;
  }

  /**
   * Get interpretation from known interpretations database
   */
  private getKnownInterpretation(term: string): InterpretationRule[] | undefined {
    const normalizedTerm = this.normalizeTerm(term);

    if (KNOWN_INTERPRETATIONS[normalizedTerm]) {
      return KNOWN_INTERPRETATIONS[normalizedTerm];
    }

    for (const [key, value] of Object.entries(KNOWN_INTERPRETATIONS)) {
      if (normalizedTerm.includes(key) || key.includes(normalizedTerm)) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Extract interpretation guidelines from document chunks
   */
  private async extractInterpretationFromDocuments(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): Promise<TermInterpretation | undefined> {
    // First try pattern-based extraction
    const interpretations: InterpretationRule[] = [];

    for (const chunk of chunks) {
      for (const pattern of INTERPRETATION_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(chunk.content)) !== null) {
          // Check if this interpretation is about our term
          const context = chunk.content.substring(
            Math.max(0, match.index - 100),
            Math.min(chunk.content.length, match.index + match[0].length + 100)
          ).toLowerCase();

          if (context.includes(term.toLowerCase())) {
            interpretations.push({
              condition: match[1] || match[2] || '',
              meaning: match[match.length - 1] || '',
            });
          }
        }
      }
    }

    if (interpretations.length > 0) {
      return {
        term,
        interpretations: this.deduplicateInterpretations(interpretations),
        confidence: 0.7,
      };
    }

    // Try LLM extraction if pattern-based failed
    if (this.model && chunks.length > 0) {
      return await this.extractInterpretationWithLLM(term, chunks);
    }

    return undefined;
  }

  /**
   * Extract interpretation using LLM
   */
  private async extractInterpretationWithLLM(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): Promise<TermInterpretation | undefined> {
    if (!this.model) return undefined;

    const combinedText = chunks
      .map(c => c.content)
      .join('\n\n')
      .substring(0, 10000);

    const prompt = `Extract interpretation guidelines for "${term}" from this text.
What do different values of ${term} mean? What are good/bad values?

Text:
"""
${combinedText}
"""

Return ONLY a JSON object:
{
  "interpretations": [
    {"condition": "> 1.0", "meaning": "Good performance", "category": "good"},
    {"condition": "< 0.5", "meaning": "Poor performance", "category": "poor"},
    ...
  ],
  "confidence": 0.0-1.0
}

Categories: "excellent", "good", "moderate", "poor"
If no interpretations found, return: {"interpretations": [], "confidence": 0}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      if (parsed.interpretations && parsed.interpretations.length > 0 && parsed.confidence > 0.4) {
        return {
          term,
          interpretations: parsed.interpretations,
          confidence: parsed.confidence,
        };
      }
    } catch (error) {
      console.warn(`⚠️ [TERMINOLOGY] Interpretation extraction failed:`, error);
    }

    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VALUE EXTRACTION AND STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Extract numeric values for a term from document chunks
   */
  private extractValuesFromDocuments(
    term: string,
    chunks: Array<{ content: string; documentId: string; documentName?: string }>
  ): ExtractedValue[] {
    const values: ExtractedValue[] = [];
    const termPattern = this.escapeRegex(term);

    // Patterns specific to this term
    const patterns = [
      new RegExp(`${termPattern}\\s+(?:of|is|was|=|:)\\s*([-]?[\\d]+\\.[\\d]+|[-]?[\\d]+)`, 'gi'),
      new RegExp(`([-]?[\\d]+\\.[\\d]+|[-]?[\\d]+)\\s+${termPattern}`, 'gi'),
      new RegExp(`${termPattern}[:=]\\s*([-]?[\\d]+\\.[\\d]+|[-]?[\\d]+)`, 'gi'),
      new RegExp(`achieved\\s+(?:a\\s+)?${termPattern}\\s+(?:of\\s+)?([-]?[\\d]+\\.[\\d]+|[-]?[\\d]+)`, 'gi'),
    ];

    for (const chunk of chunks) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(chunk.content)) !== null) {
          // Find the numeric value in the match
          const numericMatch = match[0].match(/([-]?[\d]+\.[\d]+|[-]?[\d]+)/);
          if (numericMatch) {
            const value = parseFloat(numericMatch[1]);
            if (!isNaN(value) && isFinite(value)) {
              // Extract context and category
              const contextStart = Math.max(0, match.index - 100);
              const contextEnd = Math.min(chunk.content.length, match.index + match[0].length + 100);
              const context = chunk.content.substring(contextStart, contextEnd);

              const category = this.extractCategory(context);

              values.push({
                term,
                value,
                context: context.trim(),
                documentId: chunk.documentId,
                documentName: chunk.documentName,
                category,
              });
            }
          }
        }
      }
    }

    return this.deduplicateValues(values);
  }

  /**
   * Extract category/methodology from context
   */
  private extractCategory(context: string): string | undefined {
    const lowerContext = context.toLowerCase();

    // Common category patterns
    const categories = [
      { pattern: /ensemble/i, category: 'ensemble methods' },
      { pattern: /single\s+(?:algorithm|model)/i, category: 'single algorithms' },
      { pattern: /deep\s+learning/i, category: 'deep learning' },
      { pattern: /machine\s+learning/i, category: 'machine learning' },
      { pattern: /neural\s+network/i, category: 'neural networks' },
      { pattern: /random\s+forest/i, category: 'random forest' },
      { pattern: /gradient\s+boosting|xgboost|lightgbm/i, category: 'gradient boosting' },
      { pattern: /lstm|rnn|transformer/i, category: 'recurrent models' },
      { pattern: /traditional|classical/i, category: 'traditional methods' },
      { pattern: /baseline/i, category: 'baseline' },
      { pattern: /proposed|our\s+method/i, category: 'proposed method' },
    ];

    for (const { pattern, category } of categories) {
      if (pattern.test(lowerContext)) {
        return category;
      }
    }

    return undefined;
  }

  /**
   * Calculate statistics from extracted values
   */
  private calculateStatistics(term: string, values: ExtractedValue[]): ValueStatistics {
    const numericValues = values.map(v => v.value).filter(v => !isNaN(v) && isFinite(v));

    if (numericValues.length === 0) {
      return {
        term,
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        median: 0,
        stdDev: 0,
        byCategory: new Map(),
        byDocument: new Map(),
      };
    }

    // Sort for median calculation
    const sorted = [...numericValues].sort((a, b) => a - b);

    const sum = numericValues.reduce((a, b) => a + b, 0);
    const avg = sum / numericValues.length;

    // Standard deviation
    const squareDiffs = numericValues.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / numericValues.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    // Median
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Group by category
    const byCategory = new Map<string, { count: number; avg: number; values: number[] }>();
    for (const value of values) {
      const cat = value.categories || 'uncategorized';
      const existing = byCategory.get(cat) || { count: 0, avg: 0, values: [] };
      existing.count++;
      existing.values.push(value.value);
      byCategory.set(cat, existing);
    }

    // Calculate averages for each category
    for (const [cat, data] of byCategory.entries()) {
      data.avg = data.values.reduce((a, b) => a + b, 0) / data.values.length;
      byCategory.set(cat, data);
    }

    // Group by document
    const byDocument = new Map<string, number[]>();
    for (const value of values) {
      const docId = value.documentId;
      const existing = byDocument.get(docId) || [];
      existing.push(value.value);
      byDocument.set(docId, existing);
    }

    return {
      term,
      count: numericValues.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: avg,
      median,
      stdDev,
      byCategory,
      byDocument,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESPONSE FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Format document insights from statistics
   */
  private formatDocumentInsights(
    term: string,
    stats: ValueStatistics,
    values: ExtractedValue[]
  ): string {
    if (stats.count === 0) {
      return '';
    }

    const parts: string[] = [];

    // Basic statistics
    parts.push(`In your documents, I found ${stats.count} ${term} value${stats.count > 1 ? 's' : ''} ranging from **${stats.min.toFixed(2)}** to **${stats.max.toFixed(2)}** (average: ${stats.average.toFixed(2)}).`);

    // Category breakdown if available
    if (stats.byCategory.size > 1) {
      const categoryParts: string[] = [];
      const sortedCategories = Array.from(stats.byCategory.entries())
        .sort((a, b) => b[1].avg - a[1].avg);

      for (const [category, data] of sortedCategories) {
        if (category !== 'uncategorized') {
          categoryParts.push(`${category} (avg ${data.avg.toFixed(2)})`);
        }
      }

      if (categoryParts.length > 0) {
        parts.push(`\nBy category: ${categoryParts.join(', ')}.`);
      }
    }

    // Notable findings
    if (stats.max > stats.average * 1.5) {
      const bestValue = values.find(v => v.value === stats.max);
      if (bestValue && bestValue.documentName) {
        parts.push(`\nHighest value found in "${bestValue.documentName}".`);
      }
    }

    return parts.join('');
  }

  /**
   * Format the complete terminology response
   */
  private formatTerminologyResponse(
    term: string,
    definition?: TermDefinition,
    formula?: TermFormula,
    interpretation?: TermInterpretation,
    documentInsights?: string
  ): TerminologyResponse {
    const parts: string[] = [];
    let confidence = 0.5;

    // Definition
    if (definition) {
      parts.push(definition.definition);
      confidence = Math.max(confidence, definition.confidence);
    } else {
      parts.push(`${this.capitalizeFirstLetter(term)} is a metric commonly used in analysis.`);
    }

    // Formula
    let formulaText: string | undefined;
    let formulaExplanation: string | undefined;
    if (formula) {
      formulaText = formula.formula;

      if (formula.variables && formula.variables.length > 0) {
        const varExplanations = formula.variables
          .map(v => `${v.symbol} = ${v.meaning}`)
          .join(', ');
        formulaExplanation = `Where ${varExplanations}`;
      }

      confidence = Math.max(confidence, formula.confidence);
    }

    // Interpretation
    let interpretationText: string | undefined;
    if (interpretation && interpretation.interpretations.length > 0) {
      const interpParts = interpretation.interpretations
        .slice(0, 5)
        .map(i => `• ${i.condition}: ${i.meaning}`);
      interpretationText = '**Interpretation:**\n' + interpParts.join('\n');
      confidence = Math.max(confidence, interpretation.confidence);
    }

    return {
      term,
      definition: parts.join(' '),
      formula: formulaText,
      formulaExplanation,
      interpretation: interpretationText,
      documentInsights,
      confidence,
    };
  }

  /**
   * Format a complete ChatGPT-style response as a single string
   */
  formatAsString(response: TerminologyResponse): string {
    const parts: string[] = [];

    // Definition
    parts.push(response.definition);

    // Formula
    if (response.formula) {
      parts.push(`\n\n**Formula:** \`${response.formula}\``);
      if (response.formulaExplanation) {
        parts.push(response.formulaExplanation);
      }
    }

    // Interpretation
    if (response.interpretation) {
      parts.push(`\n\n${response.interpretation}`);
    }

    // Document insights
    if (response.documentInsights) {
      parts.push(`\n\n**In your documents:**\n${response.documentInsights}`);
    }

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOCUMENT PROCESSING (for indexing)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Process a document during indexing to extract terminology knowledge
   */
  async processDocumentForTerminology(
    userId: string,
    documentId: string,
    documentName: string,
    extractedText: string
  ): Promise<{ termsFound: number; valuesExtracted: number }> {
    console.log(`📚 [TERMINOLOGY] Processing document "${documentName}" for terminology`);

    const startTime = Date.now();
    let termsFound = 0;
    let valuesExtracted = 0;

    // Find all known terms mentioned in the document
    const mentionedTerms = this.findMentionedTerms(extractedText);
    termsFound = mentionedTerms.length;

    // Extract values for each mentioned term
    for (const term of mentionedTerms) {
      const values = this.extractValuesFromDocuments(term, [
        { content: extractedText, documentId, documentName }
      ]);
      valuesExtracted += values.length;

      // Store the extracted values (could be saved to database here)
      // For now, we'll rely on real-time extraction during queries
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ [TERMINOLOGY] Processed in ${processingTime}ms: ${termsFound} terms, ${valuesExtracted} values`);

    return { termsFound, valuesExtracted };
  }

  /**
   * Find known terms mentioned in text
   */
  private findMentionedTerms(text: string): string[] {
    const lowerText = text.toLowerCase();
    const mentionedTerms: string[] = [];

    // Check all known terms
    const allKnownTerms = [
      ...Object.keys(KNOWN_TERM_FORMULAS),
      ...Object.keys(KNOWN_INTERPRETATIONS),
    ];

    const uniqueTerms = [...new Set(allKnownTerms)];

    for (const term of uniqueTerms) {
      if (lowerText.includes(term)) {
        mentionedTerms.push(term);
      }
    }

    return mentionedTerms;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private normalizeTerm(term: string): string {
    return term.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/['']/g, "'");
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private cleanDefinitionText(text: string): string {
    return text.trim()
      .replace(/\s+/g, ' ')
      .replace(/^[,.:;\s]+/, '')
      .replace(/[,.:;\s]+$/, '');
  }

  private capitalizeFirstLetter(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private looksLikeAcademicTerm(term: string): boolean {
    const lowerTerm = term.toLowerCase();

    // Check against known terms
    if (KNOWN_TERM_FORMULAS[lowerTerm] || KNOWN_INTERPRETATIONS[lowerTerm]) {
      return true;
    }

    // Check for partial matches with known terms
    for (const knownTerm of Object.keys(KNOWN_TERM_FORMULAS)) {
      if (lowerTerm.includes(knownTerm) || knownTerm.includes(lowerTerm)) {
        return true;
      }
    }

    // Check for common academic/technical term patterns
    const academicPatterns = [
      /ratio$/i,
      /score$/i,
      /index$/i,
      /coefficient$/i,
      /error$/i,
      /metric$/i,
      /measure$/i,
      /rate$/i,
      /value$/i,
      /model$/i,
      /algorithm$/i,
      /method$/i,
      /analysis$/i,
      /regression$/i,
      /optimization$/i,
    ];

    for (const pattern of academicPatterns) {
      if (pattern.test(lowerTerm)) {
        return true;
      }
    }

    return false;
  }

  private deduplicateInterpretations(interpretations: InterpretationRule[]): InterpretationRule[] {
    const seen = new Set<string>();
    return interpretations.filter(i => {
      const key = `${i.condition}|${i.meaning}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateValues(values: ExtractedValue[]): ExtractedValue[] {
    const seen = new Set<string>();
    return values.filter(v => {
      const key = `${v.documentId}|${v.value}|${v.context.substring(0, 50)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC API FOR RAG SERVICE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if a query is a terminology question and get the term
   */
  isTerminologyQuestion(query: string): { isTerm: boolean; term: string | null } {
    const term = this.detectTerminologyQuery(query);
    return { isTerm: term !== null, term };
  }

  /**
   * Get a list of all known terms (for autocomplete/suggestions)
   */
  getKnownTerms(): string[] {
    return [...new Set([
      ...Object.keys(KNOWN_TERM_FORMULAS),
      ...Object.keys(KNOWN_INTERPRETATIONS),
    ])];
  }

  /**
   * Check if we have knowledge about a specific term
   */
  hasKnowledgeAbout(term: string): boolean {
    const normalizedTerm = this.normalizeTerm(term);
    return !!(KNOWN_TERM_FORMULAS[normalizedTerm] || KNOWN_INTERPRETATIONS[normalizedTerm]);
  }
}

// Export singleton instance
export const terminologyIntelligenceService = new TerminologyIntelligenceService();
export default terminologyIntelligenceService;
