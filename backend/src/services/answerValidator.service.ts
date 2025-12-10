/**
 * Answer Validator - Unified Answer Validation
 * 
 * Merges:
 * - formatValidation.service.ts
 * - citationVerification.service.ts
 * - answerQualityValidator.service.ts
 * - hallucinationDetection.service.ts
 * - groundingValidation.service.ts
 * - domainValidation.service.ts
 * 
 * Single source of truth for ALL answer validation
 */

export interface ValidationOptions {
  answer: string;
  query: string;
  context: string;
  answerType: string;
  languageCode: string;
  documentReferences: Array<{ id: string; name: string }>;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1
  issues: ValidationIssue[];
  warnings: string[];
  shouldRegenerate: boolean;
}

export interface ValidationIssue {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  autoFixable: boolean;
}

/**
 * Validate answer quality
 */
export function validateAnswer(options: ValidationOptions): ValidationResult {
  const { answer, query, context, answerType, languageCode, documentReferences } = options;
  
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  let score = 1.0;

  // 1. Format validation
  const formatCheck = validateFormat(answer, languageCode);
  if (!formatCheck.isValid) {
    issues.push(...formatCheck.issues);
    score -= 0.2;
  }

  // 2. Content validation
  const contentCheck = validateContent(answer, query, answerType);
  if (!contentCheck.isValid) {
    issues.push(...contentCheck.issues);
    score -= 0.3;
  }

  // 3. Grounding validation (answer based on context)
  const groundingCheck = validateGrounding(answer, context);
  if (!groundingCheck.isValid) {
    issues.push(...groundingCheck.issues);
    score -= 0.3;
  }

  // 4. Citation validation
  const citationCheck = validateCitations(answer, documentReferences);
  if (!citationCheck.isValid) {
    issues.push(...citationCheck.issues);
    score -= 0.1;
  }

  // 5. Language consistency
  const langCheck = validateLanguage(answer, languageCode);
  if (!langCheck.isValid) {
    issues.push(...langCheck.issues);
    score -= 0.1;
  }

  // Collect warnings
  warnings.push(...formatCheck.warnings);
  warnings.push(...contentCheck.warnings);
  warnings.push(...groundingCheck.warnings);

  // Determine if regeneration needed
  const criticalIssues = issues.filter(i => i.type === 'critical');
  const shouldRegenerate = criticalIssues.length > 0 || score < 0.6;

  return {
    isValid: score >= 0.7 && criticalIssues.length === 0,
    score: Math.max(0, score),
    issues,
    warnings,
    shouldRegenerate,
  };
}

/**
 * Validate format
 */
function validateFormat(answer: string, lang: string): {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
} {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];

  // Check for emoji
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu;
  if (emojiRegex.test(answer)) {
    issues.push({
      type: 'critical',
      category: 'format',
      message: 'Answer contains emoji (forbidden)',
      autoFixable: true,
    });
  }

  // Check for ### Source sections
  if (/###\s*(Source|Fonte|Fuente)/i.test(answer)) {
    issues.push({
      type: 'critical',
      category: 'format',
      message: 'Answer contains ### Source section (forbidden)',
      autoFixable: true,
    });
  }

  // Check for follow-up question
  if (!answer.trim().endsWith('?')) {
    const lastLines = answer.split('\n').slice(-3).join('\n');
    if (!lastLines.includes('?')) {
      issues.push({
        type: 'warning',
        category: 'format',
        message: 'Answer missing follow-up question',
        autoFixable: true,
      });
    }
  }

  // Check for italic (should be bold)
  if (/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/.test(answer)) {
    warnings.push('Answer contains italic text (should be bold)');
  }

  return {
    isValid: issues.filter(i => i.type === 'critical').length === 0,
    issues,
    warnings,
  };
}

/**
 * Validate content quality
 */
function validateContent(answer: string, query: string, answerType: string): {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
} {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];

  // Check minimum length
  if (answer.length < 50) {
    issues.push({
      type: 'critical',
      category: 'content',
      message: 'Answer too short (< 50 characters)',
      autoFixable: false,
    });
  }

  // Check for generic/vague answers
  const genericPhrases = [
    'I don\'t have enough information',
    'Based on the available information',
    'It appears that',
    'It seems that',
    'Não tenho informações suficientes',
    'Com base nas informações disponíveis',
    'Parece que',
    'No tengo suficiente información',
    'Basado en la información disponible',
  ];

  const hasGeneric = genericPhrases.some(phrase => 
    answer.toLowerCase().includes(phrase.toLowerCase())
  );

  if (hasGeneric && answer.length < 200) {
    warnings.push('Answer may be too generic or vague');
  }

  // Check for question keywords in answer (should address query)
  const queryKeywords = extractKeywords(query);
  const answerLower = answer.toLowerCase();
  const addressedKeywords = queryKeywords.filter(kw => 
    answerLower.includes(kw.toLowerCase())
  );

  if (addressedKeywords.length < queryKeywords.length * 0.3) {
    warnings.push('Answer may not fully address the query');
  }

  // Check for appropriate structure based on answer type
  if (answerType === 'COMPLEX_ANALYSIS') {
    if (!answer.includes('##')) {
      warnings.push('Complex analysis should have H2 sections');
    }
  }

  return {
    isValid: issues.filter(i => i.type === 'critical').length === 0,
    issues,
    warnings,
  };
}

/**
 * Validate grounding (answer based on context)
 */
function validateGrounding(answer: string, context: string): {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
} {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];

  // Check if answer contains specific numbers/facts
  const answerNumbers = extractNumbers(answer);
  const contextNumbers = extractNumbers(context);

  // If answer has numbers, at least some should be from context
  if (answerNumbers.length > 0) {
    const groundedNumbers = answerNumbers.filter(num => 
      contextNumbers.some(ctxNum => Math.abs(num - ctxNum) < 0.01)
    );

    if (groundedNumbers.length < answerNumbers.length * 0.5) {
      warnings.push('Some numbers in answer may not be from provided documents');
    }
  }

  // Check for hallucination indicators
  const hallucinationPhrases = [
    'according to my knowledge',
    'as far as i know',
    'in general',
    'typically',
    'usually',
    'segundo meu conhecimento',
    'pelo que sei',
    'em geral',
    'tipicamente',
    'geralmente',
    'según mi conocimiento',
    'por lo que sé',
    'en general',
    'típicamente',
  ];

  const hasHallucination = hallucinationPhrases.some(phrase =>
    answer.toLowerCase().includes(phrase.toLowerCase())
  );

  if (hasHallucination) {
    issues.push({
      type: 'warning',
      category: 'grounding',
      message: 'Answer may contain information not from documents',
      autoFixable: false,
    });
  }

  return {
    isValid: issues.filter(i => i.type === 'critical').length === 0,
    issues,
    warnings,
  };
}

/**
 * Validate citations
 */
function validateCitations(
  answer: string,
  documentReferences: Array<{ id: string; name: string }>
): {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
} {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];

  // Extract {{DOC:::}} markers from answer
  const markers = answer.match(/\{\{DOC:::([^}]+)\}\}/g) || [];
  const referencedFiles = markers.map(m => m.match(/\{\{DOC:::([^}]+)\}\}/)![1]);

  // Check if all referenced files exist in documentReferences
  const validFiles = documentReferences.map(doc => doc.name);
  const invalidRefs = referencedFiles.filter(file => !validFiles.includes(file));

  if (invalidRefs.length > 0) {
    issues.push({
      type: 'warning',
      category: 'citation',
      message: `Answer references non-existent files: ${invalidRefs.join(', ')}`,
      autoFixable: false,
    });
  }

  // Check if answer has citations when it should
  if (documentReferences.length > 0 && markers.length === 0) {
    warnings.push('Answer should reference documents but has no {{DOC:::}} markers');
  }

  return {
    isValid: issues.filter(i => i.type === 'critical').length === 0,
    issues,
    warnings,
  };
}

/**
 * Validate language consistency
 */
function validateLanguage(answer: string, expectedLang: string): {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
} {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];

  // Simple language detection
  const detectedLang = detectLanguageSimple(answer);

  if (detectedLang !== expectedLang && detectedLang !== 'unknown') {
    issues.push({
      type: 'critical',
      category: 'language',
      message: `Answer in ${detectedLang} but expected ${expectedLang}`,
      autoFixable: false,
    });
  }

  return {
    isValid: issues.filter(i => i.type === 'critical').length === 0,
    issues,
    warnings,
  };
}

/**
 * Extract keywords from query
 */
function extractKeywords(query: string): string[] {
  // Remove stop words and extract meaningful words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where',
    'o', 'a', 'os', 'as', 'é', 'são', 'foi', 'foram', 'qual', 'como', 'por que', 'quando', 'onde',
    'el', 'la', 'los', 'las', 'es', 'son', 'fue', 'fueron', 'qué', 'cómo', 'por qué', 'cuándo', 'dónde',
  ]);

  const words = query.toLowerCase().split(/\s+/);
  return words.filter(w => w.length > 3 && !stopWords.has(w));
}

/**
 * Extract numbers from text
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:\.\d+)?/g) || [];
  return matches.map(Number);
}

/**
 * Simple language detection
 */
function detectLanguageSimple(text: string): string {
  const lowerText = text.toLowerCase();

  // Portuguese indicators
  const ptWords = ['você', 'voce', 'está', 'esta', 'são', 'sao', 'também', 'tambem'];
  const ptCount = ptWords.filter(w => lowerText.includes(w)).length;

  // Spanish indicators
  const esWords = ['usted', 'está', 'son', 'también', 'qué', 'cómo'];
  const esCount = esWords.filter(w => lowerText.includes(w)).length;

  // English indicators
  const enWords = ['you', 'are', 'is', 'the', 'that', 'this'];
  const enCount = enWords.filter(w => lowerText.includes(w)).length;

  if (ptCount > esCount && ptCount > enCount) return 'pt';
  if (esCount > ptCount && esCount > enCount) return 'es';
  if (enCount > ptCount && enCount > esCount) return 'en';

  return 'unknown';
}
