/**
 * ============================================================================
 * LAYER 3: KODA ANSWER VALIDATION ENGINE
 * ============================================================================
 * 
 * GOAL: Quality/sanity checker
 * - Catch unsafe or obviously wrong content
 * - Warn about hallucinated document names
 * - Detect suspicious numeric contradictions
 * - Check if the answer is too superficial for the question
 * 
 * This is NOT a formatting tool; it's a quality checker.
 * 
 * Based on Note 6 - Section 3
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  ValidatorInput,
  ValidatorOutput,
  Source,
} from '../types';

export class KodaAnswerValidationEngine {
  
  /**
   * MAIN ENTRY POINT
   */
  public validateAnswer(input: ValidatorInput): ValidatorOutput {
    console.log(`[Validator] Validating answer: intent=${input.primaryIntent}`);
    
    const warnings: string[] = [];
    const errors: string[] = [];
    let score = 100; // Start with perfect score
    
    // Check 1: Safety / harmful content
    const safetyCheck = this.checkSafety(input.formattedText);
    if (!safetyCheck.safe) {
      errors.push(...safetyCheck.issues);
      score = 0; // Fail immediately
    }
    
    // Check 2: Persona / identity leak
    const personaCheck = this.checkPersonaLeak(input.formattedText);
    if (!personaCheck.clean) {
      warnings.push(...personaCheck.issues);
      score -= 15;
    }
    
    // Check 3: Hallucinated document references
    const hallucinationCheck = this.checkHallucinatedDocs(input.formattedText, input.sources);
    if (!hallucinationCheck.clean) {
      warnings.push(...hallucinationCheck.issues);
      score -= 20;
    }
    
    // Check 4: Completeness
    const completenessCheck = this.checkCompleteness(input.formattedText, input.query, input.primaryIntent);
    if (!completenessCheck.complete) {
      warnings.push(...completenessCheck.issues);
      score -= 10;
    }
    
    // Check 5: Numeric contradictions
    const numericCheck = this.checkNumericConsistency(input.formattedText);
    if (!numericCheck.consistent) {
      warnings.push(...numericCheck.issues);
      score -= 10;
    }
    
    // Final score
    score = Math.max(0, Math.min(100, score));
    
    return {
      isValid: errors.length === 0,
      score,
      warnings,
      errors,
      checks: {
        safety: safetyCheck.safe,
        personaLeak: personaCheck.clean,
        hallucinatedDocs: hallucinationCheck.clean,
        completeness: completenessCheck.complete,
        numericConsistency: numericCheck.consistent,
      },
    };
  }
  
  // ==========================================================================
  // CHECK 1: SAFETY / HARMFUL CONTENT
  // ==========================================================================
  
  private checkSafety(text: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Very basic heuristic: check for obviously disallowed content
    const unsafePatterns = [
      /\b(kill|murder|violence|hate|racist|sexist)\b/i,
      /\b(illegal|drugs|weapons)\b/i,
    ];
    
    for (const pattern of unsafePatterns) {
      if (pattern.test(text)) {
        issues.push(`Potentially unsafe content detected: ${pattern.source}`);
      }
    }
    
    return {
      safe: issues.length === 0,
      issues,
    };
  }
  
  // ==========================================================================
  // CHECK 2: PERSONA / IDENTITY LEAK
  // ==========================================================================
  
  private checkPersonaLeak(text: string): { clean: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for identity leaks
    const leakPatterns = [
      /\b(as an AI|as a language model|I'm an AI|I am an AI)\b/i,
      /\b(ChatGPT|GPT-4|GPT-3|OpenAI|Anthropic|Claude)\b/i,
      /\b(I don't have access to|I cannot access|I can't see)\b/i,
      /\b(I'm not able to|I am not able to|I cannot)\b/i,
    ];
    
    for (const pattern of leakPatterns) {
      if (pattern.test(text)) {
        issues.push(`Persona leak detected: "${pattern.source}" - breaks Koda's persona`);
      }
    }
    
    return {
      clean: issues.length === 0,
      issues,
    };
  }
  
  // ==========================================================================
  // CHECK 3: HALLUCINATED DOCUMENT REFERENCES
  // ==========================================================================
  
  private checkHallucinatedDocs(text: string, sources: Source[]): { clean: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Extract all document references from text (bold filenames)
    const docPattern = /\*\*([^*]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g|gif))\*\*/gi;
    const mentionedDocs: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = docPattern.exec(text)) !== null) {
      mentionedDocs.push(match[1].toLowerCase());
    }

    // Check if each mentioned doc is in sources
    const sourceFilenames = sources
      .map(s => (s.filename || s.documentName || s.title || '').toLowerCase())
      .filter(f => f);

    for (const doc of mentionedDocs) {
      if (!sourceFilenames.includes(doc)) {
        issues.push(`Document "${doc}" mentioned but not in sources - possible hallucination`);
      }
    }
    
    return {
      clean: issues.length === 0,
      issues,
    };
  }
  
  // ==========================================================================
  // CHECK 4: COMPLETENESS
  // ==========================================================================
  
  private checkCompleteness(text: string, query: string, intent: string): { complete: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Skip completeness check for meta queries
    if (intent === 'meta' || intent === 'file_action') {
      return { complete: true, issues: [] };
    }
    
    // Check if answer is too short
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 10) {
      issues.push(`Answer too short (${wordCount} words) - might be incomplete`);
    }
    
    // Check for incomplete endings
    if (text.trim().endsWith(',')) {
      issues.push('Answer ends with comma - likely incomplete');
    }
    
    if (text.trim().endsWith(':')) {
      issues.push('Answer ends with colon - likely incomplete');
    }
    
    if (/\.\.\.$/.test(text.trim())) {
      issues.push('Answer ends with ellipsis - likely incomplete');
    }
    
    // Check for incomplete list starters
    if (/\b(como|such as|including|e\.g\.|for example|like)\s*$/i.test(text.trim())) {
      issues.push('Answer ends with list starter - likely incomplete');
    }
    
    return {
      complete: issues.length === 0,
      issues,
    };
  }
  
  // ==========================================================================
  // CHECK 5: NUMERIC CONTRADICTIONS
  // ==========================================================================
  
  private checkNumericConsistency(text: string): { consistent: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Extract all monetary values
    const currencyPattern = /R\$\s*[\d.,]+(?:\s*(?:mil|milhões?|bilhões?|trilhões?))?/gi;
    const values = text.match(currencyPattern) || [];
    
    // If there are many different values, warn about potential inconsistency
    if (values.length > 5) {
      const uniqueValues = new Set(values.map(v => v.toLowerCase()));
      
      if (uniqueValues.size > 5) {
        issues.push(`Many different monetary values (${uniqueValues.size}) - check for inconsistencies`);
      }
    }
    
    // Extract all percentages
    const percentPattern = /\d+(?:[.,]\d+)?%/g;
    const percentages = text.match(percentPattern) || [];
    
    // Check for suspicious percentages (> 100%)
    for (const pct of percentages) {
      const value = parseFloat(pct.replace(',', '.').replace('%', ''));
      if (value > 100) {
        issues.push(`Suspicious percentage: ${pct} (> 100%)`);
      }
    }
    
    return {
      consistent: issues.length === 0,
      issues,
    };
  }
}

// Export singleton instance
export const kodaAnswerValidationEngine = new KodaAnswerValidationEngine();
