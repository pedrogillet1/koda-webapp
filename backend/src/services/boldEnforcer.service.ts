/**
 * ============================================================================
 * BOLD ENFORCER SERVICE
 * ============================================================================
 * 
 * Post-processes LLM output to ensure important items are bolded:
 * - Currency values (R$ 900.000, $500)
 * - Percentages (20%, 15%)
 * - Measurements (1300 m², 50 kg)
 * - KPIs (Lucro Líquido, Custo por m²)
 * - Critical phrases (objetivo principal, investimento total)
 * 
 * Two-layer strategy:
 * 1. LLM prompt guidance (~70%)
 * 2. Post-processing enforcement (this service)
 * 
 * @version 2.0.0
 * @date 2024-12-10
 */

import type {
  BoldCandidate,
  BoldType,
  BoldEnforcementResult,
  BoldChange,
} from '../types/rag.types';

// ============================================================================
// REGEX PATTERNS
// ============================================================================

// Currency patterns
const CURRENCY_PATTERNS = [
  /R\$\s*[\d.,]+/gi,                    // R$ 900.000,00
  /\$\s*[\d.,]+/gi,                     // $500
  /€\s*[\d.,]+/gi,                      // €1000
  /USD\s*[\d.,]+/gi,                    // USD 500
];

// Percentage patterns
const PERCENTAGE_PATTERNS = [
  /\d+[.,]?\d*\s*%/gi,                  // 20%, 15.5%
];

// Measurement patterns
const MEASUREMENT_PATTERNS = [
  /\d+[.,]?\d*\s*m²/gi,                 // 1300 m²
  /\d+[.,]?\d*\s*m2/gi,                 // 1300 m2
  /\d+[.,]?\d*\s*kg/gi,                 // 50 kg
  /\d+[.,]?\d*\s*km/gi,                 // 100 km
  /\d+[.,]?\d*\s*anos?/gi,              // 5 anos
  /\d+[.,]?\d*\s*meses/gi,              // 6 meses
];

// KPI keywords (Portuguese)
const KPI_KEYWORDS = [
  'lucro líquido',
  'lucro bruto',
  'receita total',
  'receita líquida',
  'custo por m²',
  'custo total',
  'investimento total',
  'retorno esperado',
  'payback',
  'roi',
  'tir',
  'vpl',
  'margem de lucro',
  'margem bruta',
  'margem líquida',
  'ebitda',
  'fluxo de caixa',
  'capital de giro',
  'ponto de equilíbrio',
  'break-even',
  'desvio padrão',
  'risco',
  'taxa de retorno',
  'valor presente líquido',
  'taxa interna de retorno',
];

// Critical phrase keywords
const CRITICAL_KEYWORDS = [
  'objetivo principal',
  'principal objetivo',
  'principal risco',
  'risco principal',
  'investimento total estimado',
  'custo estimado',
  'prazo estimado',
  'cliente ideal',
  'público-alvo',
  'target',
  'meta',
  'objetivo',
];

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class BoldEnforcerService {
  /**
   * Enforce bold on important items
   * 
   * @param text - Answer text from LLM
   * @returns Result with bolded text and changes
   */
  enforceBold(text: string): BoldEnforcementResult {
    const startTime = Date.now();

    // Find all candidates
    const candidates = this.findCandidates(text);

    // Check which are already bolded
    const candidatesWithStatus = this.checkBoldStatus(text, candidates);

    // Apply bold to unbold candidates
    let boldedText = text;
    const changes: BoldChange[] = [];

    for (const candidate of candidatesWithStatus) {
      if (!candidate.isBolded) {
        boldedText = this.applyBold(boldedText, candidate);
        changes.push({
          text: candidate.text,
          type: candidate.type,
          action: 'added',
        });
      } else {
        changes.push({
          text: candidate.text,
          type: candidate.type,
          action: 'already_bolded',
        });
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`[BOLD_ENFORCER] Processed in ${processingTime}ms: ${candidates.length} candidates, ${changes.filter(c => c.action === 'added').length} bolded`);

    return {
      originalText: text,
      boldedText,
      candidatesFound: candidates.length,
      candidatesBolded: changes.filter((c) => c.action === 'added').length,
      changes,
    };
  }

  /**
   * Find all bold candidates in text
   */
  private findCandidates(text: string): BoldCandidate[] {
    const candidates: BoldCandidate[] = [];

    // Find currency
    for (const pattern of CURRENCY_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(pattern);
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          text: match[0],
          type: 'currency',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          isBolded: false,
        });
      }
    }

    // Find percentages
    for (const pattern of PERCENTAGE_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(pattern);
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          text: match[0],
          type: 'percentage',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          isBolded: false,
        });
      }
    }

    // Find measurements
    for (const pattern of MEASUREMENT_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(pattern);
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          text: match[0],
          type: 'measurement',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          isBolded: false,
        });
      }
    }

    // Find KPIs
    for (const keyword of KPI_KEYWORDS) {
      const regex = new RegExp(keyword, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          text: match[0],
          type: 'kpi',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          isBolded: false,
        });
      }
    }

    // Find critical phrases
    for (const keyword of CRITICAL_KEYWORDS) {
      const regex = new RegExp(keyword, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          text: match[0],
          type: 'critical_phrase',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          isBolded: false,
        });
      }
    }

    // Sort by start index
    candidates.sort((a, b) => a.startIndex - b.startIndex);

    // Remove duplicates (same position)
    const unique: BoldCandidate[] = [];
    let lastEnd = -1;

    for (const candidate of candidates) {
      if (candidate.startIndex >= lastEnd) {
        unique.push(candidate);
        lastEnd = candidate.endIndex;
      }
    }

    return unique;
  }

  /**
   * Check if candidates are already bolded
   */
  private checkBoldStatus(text: string, candidates: BoldCandidate[]): BoldCandidate[] {
    return candidates.map((candidate) => {
      // Check if there's ** before and after
      const before = text.substring(Math.max(0, candidate.startIndex - 2), candidate.startIndex);
      const after = text.substring(candidate.endIndex, Math.min(text.length, candidate.endIndex + 2));

      const isBolded = before === '**' && after === '**';

      return {
        ...candidate,
        isBolded,
      };
    });
  }

  /**
   * Apply bold to a candidate
   */
  private applyBold(text: string, candidate: BoldCandidate): string {
    // Don't bold if already inside bold
    if (candidate.isBolded) return text;

    // Check if we're inside a word (don't break words)
    const before = text[candidate.startIndex - 1];
    const after = text[candidate.endIndex];

    if (before && /[a-zA-Z0-9]/.test(before)) {
      // Inside a word, don't bold
      return text;
    }

    if (after && /[a-zA-Z0-9]/.test(after)) {
      // Inside a word, don't bold
      return text;
    }

    // Apply bold
    const before_text = text.substring(0, candidate.startIndex);
    const bold_text = `**${candidate.text}**`;
    const after_text = text.substring(candidate.endIndex);

    return before_text + bold_text + after_text;
  }

  /**
   * Enforce minimum bold
   * 
   * If there are numeric facts but no bold, this is a problem
   */
  enforceMinimumBold(text: string): {
    hasNumericFacts: boolean;
    hasBold: boolean;
    needsAttention: boolean;
  } {
    const hasNumericFacts = this.hasNumericFacts(text);
    const hasBold = this.hasBold(text);

    return {
      hasNumericFacts,
      hasBold,
      needsAttention: hasNumericFacts && !hasBold,
    };
  }

  /**
   * Check if text has numeric facts
   */
  private hasNumericFacts(text: string): boolean {
    for (const pattern of [...CURRENCY_PATTERNS, ...PERCENTAGE_PATTERNS, ...MEASUREMENT_PATTERNS]) {
      if (pattern.test(text)) return true;
    }
    return false;
  }

  /**
   * Check if text has bold
   */
  private hasBold(text: string): boolean {
    return /\*\*[^*]+\*\*/.test(text);
  }

  /**
   * Clean up broken bold markers
   * 
   * Fixes patterns like: mezanino** (unclosed)
   */
  cleanupBrokenBold(text: string): string {
    // Remove trailing **
    let cleaned = text.replace(/\*\*(\s|$)/g, '$1');

    // Remove leading **
    cleaned = cleaned.replace(/(^|\s)\*\*/g, '$1');

    // Remove triple/quadruple **
    cleaned = cleaned.replace(/\*{3,}/g, '**');

    // Fix unbalanced ** (count them)
    const count = (cleaned.match(/\*\*/g) || []).length;
    if (count % 2 !== 0) {
      // Odd number, remove last **
      const lastIndex = cleaned.lastIndexOf('**');
      if (lastIndex !== -1) {
        cleaned = cleaned.substring(0, lastIndex) + cleaned.substring(lastIndex + 2);
      }
    }

    return cleaned;
  }

  /**
   * Get bold statistics (for monitoring)
   */
  getBoldStats(text: string): {
    totalBold: number;
    boldedCurrency: number;
    boldedPercentage: number;
    boldedMeasurement: number;
    boldedKPI: number;
  } {
    const boldMatches = text.match(/\*\*([^*]+)\*\*/g) || [];

    let boldedCurrency = 0;
    let boldedPercentage = 0;
    let boldedMeasurement = 0;
    let boldedKPI = 0;

    for (const match of boldMatches) {
      const content = match.replace(/\*\*/g, '');

      if (CURRENCY_PATTERNS.some((p) => p.test(content))) {
        boldedCurrency++;
      } else if (PERCENTAGE_PATTERNS.some((p) => p.test(content))) {
        boldedPercentage++;
      } else if (MEASUREMENT_PATTERNS.some((p) => p.test(content))) {
        boldedMeasurement++;
      } else if (KPI_KEYWORDS.some((k) => content.toLowerCase().includes(k))) {
        boldedKPI++;
      }
    }

    return {
      totalBold: boldMatches.length,
      boldedCurrency,
      boldedPercentage,
      boldedMeasurement,
      boldedKPI,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default new BoldEnforcerService();
