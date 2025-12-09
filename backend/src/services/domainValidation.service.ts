/**
 * Domain Validation Service
 *
 * Validates answers based on domain-specific rules to prevent
 * hallucination, ensure accuracy, and enforce safety guidelines.
 */

import { Domain, getDomainDisclaimer } from './domainDetector.service';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1
  issues: ValidationIssue[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  location?: string;
}

/**
 * Validate answer for finance domain
 */
function validateFinanceAnswer(answer: string, query: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for formulas if calculations are mentioned
  const calculationTerms = ['roi', 'payback', 'npv', 'irr', 'margin', 'vpl', 'tir', 'margem'];
  const mentionsCalculation = calculationTerms.some(term =>
    answer.toLowerCase().includes(term) || query.toLowerCase().includes(term)
  );

  if (mentionsCalculation) {
    // Check if formulas are shown
    const hasFormula = /=/.test(answer) || /formula:/i.test(answer) || /calculation:/i.test(answer);
    if (!hasFormula) {
      issues.push({
        severity: 'warning',
        category: 'missing_formula',
        message: 'Financial calculations should show explicit formulas'
      });
    }

    // Check if calculations are shown step-by-step
    const hasSteps = /calculation:/i.test(answer) || /step/i.test(answer);
    if (!hasSteps) {
      warnings.push('Consider showing step-by-step calculations');
    }
  }

  // Check for currency values
  const hasCurrency = /[\$R]\$?\s*[\d.,]+/.test(answer);
  if (hasCurrency) {
    // Check if source is mentioned
    const hasSource = /document|table|page|section|source/i.test(answer);
    if (!hasSource) {
      issues.push({
        severity: 'warning',
        category: 'missing_source',
        message: 'Financial values should cite source (document, table, page)'
      });
    }
  }

  // Check for unsupported advice
  const givesAdvice = /recommend|suggest|you should|advise/i.test(answer);
  if (givesAdvice) {
    issues.push({
      severity: 'critical',
      category: 'financial_advice',
      message: 'Do not provide financial advice, only interpret documents'
    });
  }

  // Check for scenario comparison if multiple scenarios mentioned
  const mentionsScenarios = /scenario/i.test(query) || /conservative|optimistic|base/i.test(query);
  if (mentionsScenarios) {
    const hasComparison = /compar|difference|versus/i.test(answer);
    if (!hasComparison) {
      suggestions.push('Consider adding comparison between scenarios');
    }
  }

  const score = 1.0 - (issues.filter(i => i.severity === 'critical').length * 0.3) -
                      (issues.filter(i => i.severity === 'warning').length * 0.1);

  return {
    isValid: issues.filter(i => i.severity === 'critical').length === 0,
    score: Math.max(0, score),
    issues,
    warnings,
    suggestions
  };
}

/**
 * Validate answer for legal domain
 */
function validateLegalAnswer(answer: string, query: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for clause references
  const mentionsClauses = /clause|article|item|paragraph|section/i.test(query);
  if (mentionsClauses) {
    const hasCitation = /clause\s*\d+|article\s*\d+|section\s*\d+/i.test(answer);
    if (!hasCitation) {
      issues.push({
        severity: 'warning',
        category: 'missing_citation',
        message: 'Always cite the exact clause number when referencing'
      });
    }
  }

  // Check for legal advice (CRITICAL)
  const givesAdvice = /recommend|suggest|you should|advise|better to/i.test(answer);
  if (givesAdvice) {
    issues.push({
      severity: 'critical',
      category: 'legal_advice',
      message: 'NEVER provide legal advice'
    });
  }

  // Check for mandatory disclaimer
  const hasDisclaimer = /consult.*lawyer|legal.*guidance|attorney|professional/i.test(answer);
  if (!hasDisclaimer) {
    issues.push({
      severity: 'critical',
      category: 'missing_disclaimer',
      message: 'Mandatory legal disclaimer is missing'
    });
    suggestions.push('Add: "For specific legal guidance, consult a lawyer."');
  }

  // Check for direct quotes from clauses
  const hasQuotes = /".*"/.test(answer);
  if (mentionsClauses && !hasQuotes) {
    warnings.push('Consider quoting the exact clause text');
  }

  const score = 1.0 - (issues.filter(i => i.severity === 'critical').length * 0.4) -
                      (issues.filter(i => i.severity === 'warning').length * 0.1);

  return {
    isValid: issues.filter(i => i.severity === 'critical').length === 0,
    score: Math.max(0, score),
    issues,
    warnings,
    suggestions
  };
}

/**
 * Validate answer for medical domain
 */
function validateMedicalAnswer(answer: string, query: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for diagnosis (CRITICAL)
  const diagnoses = /you have|diagnosis of|suffering from|you are diagnosed/i.test(answer);
  if (diagnoses) {
    issues.push({
      severity: 'critical',
      category: 'diagnosis',
      message: 'NEVER diagnose medical conditions'
    });
  }

  // Check for treatment recommendations (CRITICAL)
  const recommends = /take|use|apply|do treatment|recommend.*medication|should take/i.test(answer);
  if (recommends) {
    issues.push({
      severity: 'critical',
      category: 'treatment_advice',
      message: 'NEVER recommend treatments or medications'
    });
  }

  // Check for mandatory medical disclaimer
  const hasDisclaimer = /consult.*doctor|medical.*guidance|healthcare.*professional|physician/i.test(answer);
  if (!hasDisclaimer) {
    issues.push({
      severity: 'critical',
      category: 'missing_disclaimer',
      message: 'Mandatory medical disclaimer is missing'
    });
    suggestions.push('Add: "For clinical interpretation and guidance, consult your doctor."');
  }

  // Check for lab values with references
  const hasLabValues = /\d+\s*(mg\/dl|g\/dl|mm³|ui\/l)/i.test(answer);
  if (hasLabValues) {
    const hasReference = /reference|normal|range|standard/i.test(answer);
    if (!hasReference) {
      warnings.push('Lab values should include reference range');
    }
  }

  // Check for clear separation of normal vs abnormal
  if (hasLabValues) {
    const hasSeparation = /abnormal|normal|elevated|reduced|high|low/i.test(answer);
    if (!hasSeparation) {
      warnings.push('Clearly separate normal values from abnormal values');
    }
  }

  const score = 1.0 - (issues.filter(i => i.severity === 'critical').length * 0.5) -
                      (issues.filter(i => i.severity === 'warning').length * 0.1);

  return {
    isValid: issues.filter(i => i.severity === 'critical').length === 0,
    score: Math.max(0, score),
    issues,
    warnings,
    suggestions
  };
}

/**
 * Validate answer for accounting domain
 */
function validateAccountingAnswer(answer: string, query: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for accounting ratios
  const mentionsRatios = /liquidity|leverage|roe|roa|margin|ratio/i.test(query);
  if (mentionsRatios) {
    const hasFormula = /=|formula:/i.test(answer);
    if (!hasFormula) {
      warnings.push('Accounting ratios should show calculation formulas');
    }
  }

  // Check for tax advice (CRITICAL)
  const givesTaxAdvice = /tax.*pay|declare.*tax|fiscal.*savings|tax.*advice/i.test(answer);
  if (givesTaxAdvice) {
    issues.push({
      severity: 'critical',
      category: 'tax_advice',
      message: 'NEVER provide tax advice'
    });
  }

  // Check for fabricated entries
  const hasJournalEntry = /debit|credit|journal.*entry/i.test(answer);
  if (hasJournalEntry) {
    const hasSource = /document|statement|balance/i.test(answer);
    if (!hasSource) {
      issues.push({
        severity: 'warning',
        category: 'unsourced_entry',
        message: 'Journal entries should be based on the document'
      });
    }
  }

  const score = 1.0 - (issues.filter(i => i.severity === 'critical').length * 0.3) -
                      (issues.filter(i => i.severity === 'warning').length * 0.1);

  return {
    isValid: issues.filter(i => i.severity === 'critical').length === 0,
    score: Math.max(0, score),
    issues,
    warnings,
    suggestions
  };
}

/**
 * Validate answer for education domain
 */
function validateEducationAnswer(answer: string, query: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for fabricated citations
  const hasCitations = /according to|as stated|per.*\d{4}/i.test(answer);
  if (hasCitations) {
    const hasSource = /document|text|work|paper/i.test(answer);
    if (!hasSource) {
      issues.push({
        severity: 'warning',
        category: 'unsourced_citation',
        message: 'Do not fabricate citations not present in the document'
      });
    }
  }

  // Check for doing student's work
  const rewrites = /here is.*rewritten|new version|corrected text/i.test(answer);
  if (rewrites) {
    warnings.push('Guide the student, don\'t do the work for them');
  }

  // Check for constructive feedback
  const isFeedback = /improve|suggest|consider/i.test(query);
  if (isFeedback) {
    const hasPositive = /good|well|adequate|correct|strength/i.test(answer);
    if (!hasPositive) {
      suggestions.push('Include positive points before suggestions for improvement');
    }
  }

  const score = 1.0 - (issues.filter(i => i.severity === 'warning').length * 0.1);

  return {
    isValid: true,
    score: Math.max(0, score),
    issues,
    warnings,
    suggestions
  };
}

/**
 * Validate answer for research domain
 */
function validateResearchAnswer(answer: string, query: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for reinterpretation of results
  const reinterprets = /actually|what this really means|contradicting/i.test(answer);
  if (reinterprets) {
    issues.push({
      severity: 'warning',
      category: 'reinterpretation',
      message: 'Do not reinterpret scientific claims, summarize what authors concluded'
    });
  }

  // Check for fabricated data
  const hasStatistics = /p\s*=|n\s*=|\d+%/i.test(answer);
  if (hasStatistics) {
    const hasSource = /study|article|research|authors/i.test(answer);
    if (!hasSource) {
      warnings.push('Statistical data should be attributed to the study');
    }
  }

  // Check for correlation vs causation
  const impliesCausation = /causes|leads to|results in|produces/i.test(answer);
  if (impliesCausation) {
    const clarifies = /associated|correlated|related/i.test(answer);
    if (!clarifies) {
      warnings.push('Differentiate correlation from causation');
    }
  }

  // Check for limitations mentioned
  const mentionsStudy = /study|research|article/i.test(query);
  if (mentionsStudy) {
    const hasLimitations = /limitation|bias|restrict/i.test(answer);
    if (!hasLimitations) {
      suggestions.push('Consider mentioning the study limitations');
    }
  }

  const score = 1.0 - (issues.filter(i => i.severity === 'warning').length * 0.1);

  return {
    isValid: true,
    score: Math.max(0, score),
    issues,
    warnings,
    suggestions
  };
}

/**
 * Main validation function
 */
export function validateAnswer(
  answer: string,
  query: string,
  domain: Domain
): ValidationResult {
  // Domain-specific validation
  let result: ValidationResult;

  switch (domain) {
    case 'finance':
      result = validateFinanceAnswer(answer, query);
      break;
    case 'accounting':
      result = validateAccountingAnswer(answer, query);
      break;
    case 'legal':
      result = validateLegalAnswer(answer, query);
      break;
    case 'medical':
      result = validateMedicalAnswer(answer, query);
      break;
    case 'education':
      result = validateEducationAnswer(answer, query);
      break;
    case 'research':
      result = validateResearchAnswer(answer, query);
      break;
    default:
      // General domain - basic validation
      result = {
        isValid: true,
        score: 1.0,
        issues: [],
        warnings: [],
        suggestions: []
      };
  }

  // Universal checks

  // Check for hallucination indicators
  const hallucinationPatterns = [
    /as.*language.*model/i,
    /i don't have access/i,
    /i cannot see/i,
    /as an? ai/i,
    /i'm an? ai/i
  ];

  for (const pattern of hallucinationPatterns) {
    if (pattern.test(answer)) {
      result.issues.push({
        severity: 'critical',
        category: 'hallucination',
        message: 'Response contains hallucination or persona break indicators'
      });
      result.isValid = false;
      result.score *= 0.5;
    }
  }

  // Check answer length (too short might indicate incomplete answer)
  if (answer.length < 50) {
    result.warnings.push('Response is very short, consider expanding');
    result.score *= 0.9;
  }

  return result;
}

/**
 * Auto-fix answer based on validation results
 */
export function autoFixAnswer(
  answer: string,
  validation: ValidationResult,
  domain: Domain
): string {
  let fixed = answer;

  // Add missing disclaimer if needed
  const missingDisclaimer = validation.issues.find(
    i => i.category === 'missing_disclaimer'
  );

  if (missingDisclaimer) {
    const disclaimer = getDomainDisclaimer(domain);
    if (disclaimer) {
      fixed += `\n\n${disclaimer}`;
    }
  }

  return fixed;
}

/**
 * Get validation summary for logging
 */
export function getValidationSummary(validation: ValidationResult): string {
  const parts: string[] = [];

  parts.push(`Valid: ${validation.isValid}`);
  parts.push(`Score: ${(validation.score * 100).toFixed(0)}%`);

  const criticalCount = validation.issues.filter(i => i.severity === 'critical').length;
  const warningCount = validation.issues.filter(i => i.severity === 'warning').length;

  parts.push(`Issues: ${criticalCount} critical, ${warningCount} warnings`);

  return parts.join(' | ');
}

/**
 * Check if answer needs regeneration
 */
export function needsRegeneration(validation: ValidationResult): boolean {
  // Regenerate if score is too low or has critical issues
  return validation.score < 0.5 ||
         validation.issues.filter(i => i.severity === 'critical').length > 0;
}

export default {
  validateAnswer,
  autoFixAnswer,
  getValidationSummary,
  needsRegeneration
};
