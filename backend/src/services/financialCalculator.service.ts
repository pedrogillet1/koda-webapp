/**
 * financialCalculator.service.ts
 *
 * Calculates ROI, payback period, and financial comparisons
 * for DEEP_FINANCIAL_ANALYSIS mode.
 *
 * Formulas:
 * - ROI = (Incremental Profit × 12) / Investment
 * - Payback = Investment / (Incremental Profit × 12)
 * - Incremental Profit = Additional Revenue - Operating Cost
 */

import type { FinancialFact, ScenarioType, MetricType } from './numericFactsExtractor.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FinancialAnalysisResult {
  // ROI (Return on Investment) as decimal (0.25 = 25%)
  roi_conservative: number | null;
  roi_optimistic: number | null;

  // Payback period in years
  payback_conservative_years: number | null;
  payback_optimistic_years: number | null;

  // Monthly incremental profit
  incremental_profit_conservative_monthly: number | null;
  incremental_profit_optimistic_monthly: number | null;

  // Baseline values
  baseline_net_profit: number | null;
  baseline_investment: number | null;

  // Data completeness
  dataCompleteness: 'FULL' | 'PARTIAL' | 'INSUFFICIENT';
  missingMetrics: MetricType[];
  notes: string[];
}

interface ScenarioData {
  netProfit: number | null;
  investment: number | null;
  additionalRevenue: number | null;
  operatingCostPercent: number | null;
  locableArea: number | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract scenario data from facts
 */
function extractScenarioData(facts: FinancialFact[], scenario: ScenarioType): ScenarioData {
  const data: ScenarioData = {
    netProfit: null,
    investment: null,
    additionalRevenue: null,
    operatingCostPercent: null,
    locableArea: null,
  };

  const scenarioFacts = facts.filter(f => f.scenario === scenario);

  for (const fact of scenarioFacts) {
    switch (fact.metric) {
      case 'NET_PROFIT':
        // Assume monthly unless unit is YEARLY
        data.netProfit = fact.unit === 'YEARLY' ? fact.value / 12 : fact.value;
        break;

      case 'INVESTMENT':
        data.investment = fact.value;
        break;

      case 'ADDITIONAL_REVENUE':
        // Assume monthly unless unit is YEARLY
        data.additionalRevenue = fact.unit === 'YEARLY' ? fact.value / 12 : fact.value;
        break;

      case 'OPERATING_COST_PERCENT':
        data.operatingCostPercent = fact.value;
        break;

      case 'LOCABLE_AREA':
        data.locableArea = fact.value;
        break;
    }
  }

  return data;
}

/**
 * Calculate incremental profit
 * Incremental Profit = Additional Revenue - (Additional Revenue × Operating Cost %)
 */
function calculateIncrementalProfit(
  additionalRevenue: number,
  operatingCostPercent: number
): number {
  const operatingCostDecimal = operatingCostPercent / 100;
  const incrementalProfit = additionalRevenue * (1 - operatingCostDecimal);
  return incrementalProfit;
}

/**
 * Calculate ROI
 * ROI = (Incremental Profit × 12) / Investment
 */
function calculateROI(incrementalProfitMonthly: number, investment: number): number | null {
  if (investment === 0) return null;
  const annualProfit = incrementalProfitMonthly * 12;
  return annualProfit / investment;
}

/**
 * Calculate payback period in years
 * Payback = Investment / (Incremental Profit × 12)
 */
function calculatePayback(incrementalProfitMonthly: number, investment: number): number | null {
  if (incrementalProfitMonthly === 0) return null;
  const annualProfit = incrementalProfitMonthly * 12;
  return investment / annualProfit;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate financial analysis from extracted facts
 */
export function calculateFinancialAnalysis(facts: FinancialFact[]): FinancialAnalysisResult {
  console.log('💰 [FINANCIAL CALC] Starting financial analysis...');
  console.log(`💰 [FINANCIAL CALC] Processing ${facts.length} facts`);

  const result: FinancialAnalysisResult = {
    roi_conservative: null,
    roi_optimistic: null,
    payback_conservative_years: null,
    payback_optimistic_years: null,
    incremental_profit_conservative_monthly: null,
    incremental_profit_optimistic_monthly: null,
    baseline_net_profit: null,
    baseline_investment: null,
    dataCompleteness: 'INSUFFICIENT',
    missingMetrics: [],
    notes: [],
  };

  // Extract data for each scenario
  const baseline = extractScenarioData(facts, 'BASELINE');
  const conservative = extractScenarioData(facts, 'CONSERVATIVE');
  const optimistic = extractScenarioData(facts, 'OPTIMISTIC');

  console.log('💰 [FINANCIAL CALC] Baseline:', baseline);
  console.log('💰 [FINANCIAL CALC] Conservative:', conservative);
  console.log('💰 [FINANCIAL CALC] Optimistic:', optimistic);

  // Store baseline values
  result.baseline_net_profit = baseline.netProfit;
  result.baseline_investment = baseline.investment;

  // Track missing metrics
  const requiredMetrics: MetricType[] = ['INVESTMENT', 'ADDITIONAL_REVENUE', 'OPERATING_COST_PERCENT'];
  const missingMetrics: MetricType[] = [];

  // Check CONSERVATIVE scenario
  if (conservative.investment !== null && conservative.additionalRevenue !== null && conservative.operatingCostPercent !== null) {
    // Calculate incremental profit
    const incrementalProfit = calculateIncrementalProfit(
      conservative.additionalRevenue,
      conservative.operatingCostPercent
    );
    result.incremental_profit_conservative_monthly = incrementalProfit;

    // Calculate ROI
    result.roi_conservative = calculateROI(incrementalProfit, conservative.investment);

    // Calculate payback
    result.payback_conservative_years = calculatePayback(incrementalProfit, conservative.investment);

    console.log(`💰 [FINANCIAL CALC] Conservative: ROI=${(result.roi_conservative! * 100).toFixed(1)}%, Payback=${result.payback_conservative_years?.toFixed(1)}y`);
  } else {
    result.notes.push('Conservative scenario: Missing required metrics');
    if (conservative.investment === null) missingMetrics.push('INVESTMENT');
    if (conservative.additionalRevenue === null) missingMetrics.push('ADDITIONAL_REVENUE');
    if (conservative.operatingCostPercent === null) missingMetrics.push('OPERATING_COST_PERCENT');
  }

  // Check OPTIMISTIC scenario
  if (optimistic.investment !== null && optimistic.additionalRevenue !== null && optimistic.operatingCostPercent !== null) {
    // Calculate incremental profit
    const incrementalProfit = calculateIncrementalProfit(
      optimistic.additionalRevenue,
      optimistic.operatingCostPercent
    );
    result.incremental_profit_optimistic_monthly = incrementalProfit;

    // Calculate ROI
    result.roi_optimistic = calculateROI(incrementalProfit, optimistic.investment);

    // Calculate payback
    result.payback_optimistic_years = calculatePayback(incrementalProfit, optimistic.investment);

    console.log(`💰 [FINANCIAL CALC] Optimistic: ROI=${(result.roi_optimistic! * 100).toFixed(1)}%, Payback=${result.payback_optimistic_years?.toFixed(1)}y`);
  } else {
    result.notes.push('Optimistic scenario: Missing required metrics');
    if (optimistic.investment === null && !missingMetrics.includes('INVESTMENT')) missingMetrics.push('INVESTMENT');
    if (optimistic.additionalRevenue === null && !missingMetrics.includes('ADDITIONAL_REVENUE')) missingMetrics.push('ADDITIONAL_REVENUE');
    if (optimistic.operatingCostPercent === null && !missingMetrics.includes('OPERATING_COST_PERCENT')) missingMetrics.push('OPERATING_COST_PERCENT');
  }

  result.missingMetrics = missingMetrics;

  // Determine data completeness
  const hasConservative = result.roi_conservative !== null;
  const hasOptimistic = result.roi_optimistic !== null;

  if (hasConservative && hasOptimistic) {
    result.dataCompleteness = 'FULL';
  } else if (hasConservative || hasOptimistic) {
    result.dataCompleteness = 'PARTIAL';
  } else {
    result.dataCompleteness = 'INSUFFICIENT';
    result.notes.push('Unable to calculate ROI/payback for any scenario');
  }

  console.log(`💰 [FINANCIAL CALC] Analysis complete: ${result.dataCompleteness}`);

  return result;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format ROI as percentage string
 */
export function formatROI(roi: number | null): string {
  if (roi === null) return 'N/A';
  return `${(roi * 100).toFixed(1)}%`;
}

/**
 * Format payback period
 */
export function formatPayback(years: number | null): string {
  if (years === null) return 'N/A';

  if (years < 1) {
    const months = Math.round(years * 12);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  if (years < 2) {
    const months = Math.round((years - 1) * 12);
    return `1 ano e ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  return `${years.toFixed(1)} anos`;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate comparison text for two scenarios
 */
export function generateComparisonText(
  conservativeROI: number | null,
  optimisticROI: number | null,
  conservativePayback: number | null,
  optimisticPayback: number | null
): string {
  if (conservativeROI === null || optimisticROI === null) {
    return 'Comparação não disponível devido a dados incompletos.';
  }

  const roiDiff = optimisticROI - conservativeROI;
  const roiDiffPercent = (roiDiff * 100).toFixed(1);

  let text = `**Comparação entre Cenários:**\n\n`;
  text += `- **ROI:** O cenário otimista apresenta ROI ${roiDiffPercent}% maior que o conservador.\n`;

  if (conservativePayback !== null && optimisticPayback !== null) {
    const paybackDiff = conservativePayback - optimisticPayback;
    const paybackDiffMonths = Math.round(paybackDiff * 12);

    text += `- **Payback:** O cenário otimista recupera o investimento ${paybackDiffMonths} meses mais rápido.\n`;
  }

  return text;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  calculateFinancialAnalysis,
  formatROI,
  formatPayback,
  formatCurrency,
  generateComparisonText,
};
