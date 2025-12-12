/**
 * Koda Answer Validation Service V3
 *
 * Validates answers against policies from validation_policies.json.
 * Ensures answers meet minimum quality requirements before sending to user.
 *
 * Features:
 * - Policy-based validation (min length, citations required, etc.)
 * - Multilingual support
 * - Severity-based pass/fail
 * - Extensible validation rules
 *
 * Used by: kodaOrchestratorV3.service.ts
 */

import { loadJsonFile } from '../../config/dataPaths';


import type {
  IntentClassificationV3,
  Citation,
} from '../../types/ragV3.types';

// ============================================================================
// TYPES
// ============================================================================

export interface AnswerConfigKeys {
  styleKey: string;
  systemPromptKey: string;
  examplesKey: string;
  validationPolicyKey: string;
}

export interface ValidationPolicy {
  requireCitations?: boolean;
  minLengthTokens?: number;
  maxLengthTokens?: number;
  requireDocuments?: boolean;
  severity?: 'info' | 'warning' | 'error';
}

export interface ValidationResult {
  passed: boolean;
  reasons: string[];
  severity: 'info' | 'warning' | 'error';
}

export interface AnswerToValidate {
  text: string;
  citations?: Citation[];
  documentsUsed?: string[];
}

export interface ValidationRequest {
  answer: AnswerToValidate;
  intent: IntentClassificationV3;
  configKeys: AnswerConfigKeys;
}

// ============================================================================
// VALIDATION POLICIES JSON TYPE
// ============================================================================

interface ValidationPoliciesJson {
  [key: string]: ValidationPolicy;
}

// ============================================================================
// KODA ANSWER VALIDATION SERVICE
// ============================================================================

export class KodaAnswerValidationService {
  private policies: ValidationPoliciesJson;

  constructor() {
    try {
      this.policies = loadJsonFile<ValidationPoliciesJson>('validation_policies.json');
      // Loaded via loadJsonFile
      // Converted to use dataPaths
    } catch (err) {
      console.warn('Failed to load validation_policies.json, using defaults:', (err as Error).message);
      this.policies = this.getDefaultPolicies();
    }
  }

  /**
   * Validate an answer against its policy.
   */
  public validate(req: ValidationRequest): ValidationResult {
    const { answer, intent, configKeys } = req;
    const key = configKeys.validationPolicyKey;
    const policy = this.policies[key] || this.policies['default'] || {};

    const reasons: string[] = [];

    // Rule 1: Check citations requirement
    if (policy.requireCitations && intent.requiresRAG) {
      if (!answer.citations || answer.citations.length === 0) {
        reasons.push('NO_CITATIONS');
      }
    }

    // Rule 2: Check minimum length
    if (policy.minLengthTokens) {
      const tokenCount = this.estimateTokens(answer.text);
      if (tokenCount < policy.minLengthTokens) {
        reasons.push('TOO_SHORT');
      }
    }

    // Rule 3: Check maximum length
    if (policy.maxLengthTokens) {
      const tokenCount = this.estimateTokens(answer.text);
      if (tokenCount > policy.maxLengthTokens) {
        reasons.push('TOO_LONG');
      }
    }

    // Rule 4: Check documents requirement
    if (policy.requireDocuments && intent.requiresRAG) {
      if (!answer.documentsUsed || answer.documentsUsed.length === 0) {
        reasons.push('NO_DOCUMENTS_USED');
      }
    }

    // Rule 5: Check for empty answer
    if (!answer.text || answer.text.trim().length === 0) {
      reasons.push('EMPTY_ANSWER');
    }

    return {
      passed: reasons.length === 0,
      reasons,
      severity: reasons.length ? (policy.severity || 'warning') : 'info',
    };
  }

  /**
   * Quick check if answer passes minimum requirements.
   */
  public isValid(req: ValidationRequest): boolean {
    const result = this.validate(req);
    return result.passed || result.severity !== 'error';
  }

  /**
   * Estimate token count from text.
   * Uses simple word-based estimation (avg 1.3 tokens per word).
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return Math.ceil(words.length * 1.3);
  }

  /**
   * Get default policies when JSON is not available.
   */
  private getDefaultPolicies(): ValidationPoliciesJson {
    return {
      default: {
        requireCitations: false,
        minLengthTokens: 5,
        maxLengthTokens: 2000,
        severity: 'warning',
      },
      'documents.summary': {
        requireCitations: true,
        minLengthTokens: 20,
        maxLengthTokens: 500,
        severity: 'warning',
      },
      'documents.factual': {
        requireCitations: true,
        minLengthTokens: 10,
        maxLengthTokens: 300,
        severity: 'warning',
      },
      'documents.compare': {
        requireCitations: true,
        minLengthTokens: 30,
        maxLengthTokens: 800,
        severity: 'warning',
      },
      'product.help': {
        requireCitations: false,
        minLengthTokens: 15,
        severity: 'info',
      },
      'chitchat': {
        requireCitations: false,
        minLengthTokens: 3,
        severity: 'info',
      },
    };
  }
}

export default KodaAnswerValidationService;
