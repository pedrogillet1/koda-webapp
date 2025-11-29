/**
 * Causal Extraction Service
 *
 * PURPOSE: Extract causal relationships and contextual explanations from documents
 * to provide "Real-World Context" intelligence when answering "why" questions.
 *
 * PROBLEM SOLVED:
 * - OLD: "Why did Argentina's GDP drop in 2020?" → "Based on your spreadsheet, Argentina's GDP in 2020 was $8,535."
 * - NEW: "Why did Argentina's GDP drop in 2020?" → "Argentina's GDP dropped due to COVID-19 pandemic lockdowns..."
 *
 * HOW IT WORKS:
 * 1. Extract causal patterns from documents ("due to", "because of", "caused by", etc.)
 * 2. Extract contextual patterns ("during", "in the context of", "reflecting", etc.)
 * 3. Store relationships for retrieval during query answering
 * 4. When answering "why" questions, retrieve relevant causes and context
 */

import NodeCache from 'node-cache';

// Cache for extracted causal relationships (TTL: 1 hour)
const causalCache = new NodeCache({ stdTTL: 3600 });

/**
 * Represents a causal relationship extracted from a document
 */
export interface CausalRelationship {
  effect: string;           // The effect/outcome (e.g., "GDP dropped")
  cause: string;            // The cause (e.g., "COVID-19 pandemic")
  pattern: string;          // The pattern matched (e.g., "due to")
  documentId: string;       // Source document ID
  documentName: string;     // Source document name
  page?: number;            // Page number if available
  confidence: number;       // Confidence score (0-1)
  rawText: string;          // Original text for context
}

/**
 * Represents contextual information extracted from a document
 */
export interface ContextualInfo {
  subject: string;          // What the context is about
  context: string;          // The contextual information
  pattern: string;          // The pattern matched
  documentId: string;       // Source document ID
  documentName: string;     // Source document name
  page?: number;            // Page number if available
  rawText: string;          // Original text for context
}

/**
 * Represents a reasoning chain step extracted from a document
 */
export interface ReasoningStep {
  stepNumber: number;       // 1, 2, 3, etc.
  title: string;            // Brief title for the step (e.g., "Reduced Overfitting")
  explanation: string;      // Full explanation of this step
  documentId: string;       // Source document ID
  documentName: string;     // Source document name
  page?: number;            // Page number if available
}

/**
 * Represents a structured cause with title and explanation
 */
export interface StructuredCause {
  title: string;            // Brief title (e.g., "Error Diversification")
  explanation: string;      // Full explanation of why this causes the effect
  mechanism?: string;       // How it works (optional)
  evidence?: string;        // Quantitative evidence if available
  documentId: string;       // Source document ID
  documentName: string;     // Source document name
  page?: number;            // Page number if available
  confidence: number;       // Confidence score (0-1)
}

/**
 * Represents quantitative evidence from documents
 */
export interface QuantitativeEvidence {
  metric: string;           // What was measured (e.g., "Sharpe ratio")
  value: string;            // The value (e.g., "15-20% higher")
  comparison?: string;      // What it's compared to
  documentId: string;       // Source document ID
  documentName: string;     // Source document name
  page?: number;            // Page number if available
}

/**
 * Patterns for extracting causal relationships
 * Format: [pattern regex, effect group index, cause group index]
 */
const CAUSAL_PATTERNS: Array<{ regex: RegExp; effectGroup: number; causeGroup: number; patternName: string }> = [
  // "X due to Y" pattern
  {
    regex: /(.{10,100}?)(?:\s+(?:is|was|were|are)\s+)?(?:due to|owing to)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    effectGroup: 1,
    causeGroup: 2,
    patternName: 'due to'
  },
  // "X because of Y" pattern
  {
    regex: /(.{10,100}?)(?:\s+(?:is|was|were|are)\s+)?(?:because of|on account of)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    effectGroup: 1,
    causeGroup: 2,
    patternName: 'because of'
  },
  // "X caused by Y" pattern
  {
    regex: /(.{10,100}?)(?:\s+(?:is|was|were|are)\s+)?(?:caused by|triggered by|driven by)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    effectGroup: 1,
    causeGroup: 2,
    patternName: 'caused by'
  },
  // "X as a result of Y" pattern
  {
    regex: /(.{10,100}?)(?:\s+(?:is|was|were|are)\s+)?(?:as a result of|resulting from|stemming from)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    effectGroup: 1,
    causeGroup: 2,
    patternName: 'as a result of'
  },
  // "Y led to X" pattern (reversed order)
  {
    regex: /(.{10,200}?)\s+(?:led to|resulted in|caused|triggered|produced)\s+(.{10,100}?)(?:\.|,|;|$)/gi,
    effectGroup: 2,
    causeGroup: 1,
    patternName: 'led to'
  },
  // "Y contributed to X" pattern
  {
    regex: /(.{10,200}?)\s+(?:contributed to|played a role in|was a factor in)\s+(.{10,100}?)(?:\.|,|;|$)/gi,
    effectGroup: 2,
    causeGroup: 1,
    patternName: 'contributed to'
  },
  // "X attributed to Y" pattern
  {
    regex: /(.{10,100}?)(?:\s+(?:is|was|were|are)\s+)?(?:attributed to|linked to|connected to)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    effectGroup: 1,
    causeGroup: 2,
    patternName: 'attributed to'
  },
  // "because X, Y happened" pattern
  {
    regex: /because\s+(.{10,200}?),\s*(.{10,100}?)(?:\.|;|$)/gi,
    effectGroup: 2,
    causeGroup: 1,
    patternName: 'because'
  },
  // "X, therefore Y" pattern
  {
    regex: /(.{10,200}?),?\s*(?:therefore|thus|hence|consequently|as such)\s+(.{10,100}?)(?:\.|,|;|$)/gi,
    effectGroup: 2,
    causeGroup: 1,
    patternName: 'therefore'
  },
];

/**
 * Patterns for extracting contextual information
 */
const CONTEXT_PATTERNS: Array<{ regex: RegExp; subjectGroup: number; contextGroup: number; patternName: string }> = [
  // "X during Y" pattern
  {
    regex: /(.{10,100}?)\s+(?:during|throughout|amid|amidst)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    subjectGroup: 1,
    contextGroup: 2,
    patternName: 'during'
  },
  // "in the context of Y, X" pattern
  {
    regex: /(?:in the context of|within the context of|given)\s+(.{10,200}?),\s*(.{10,100}?)(?:\.|;|$)/gi,
    subjectGroup: 2,
    contextGroup: 1,
    patternName: 'in the context of'
  },
  // "X reflecting Y" pattern
  {
    regex: /(.{10,100}?),?\s*(?:reflecting|indicating|showing|demonstrating)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    subjectGroup: 1,
    contextGroup: 2,
    patternName: 'reflecting'
  },
  // "against the backdrop of Y" pattern
  {
    regex: /(.{10,100}?)\s+(?:against the backdrop of|in light of|in view of)\s+(.{10,200}?)(?:\.|,|;|$)/gi,
    subjectGroup: 1,
    contextGroup: 2,
    patternName: 'against the backdrop of'
  },
  // "X in Y period/time" pattern
  {
    regex: /(.{10,100}?)\s+(?:in|during)\s+((?:the\s+)?(?:fiscal year|quarter|period|year|month|week)\s*(?:of\s*)?\d{4}(?:-\d{2,4})?)(?:\.|,|;|$)/gi,
    subjectGroup: 1,
    contextGroup: 2,
    patternName: 'time period'
  },
  // "following Y, X" pattern
  {
    regex: /(?:following|after|subsequent to)\s+(.{10,200}?),\s*(.{10,100}?)(?:\.|;|$)/gi,
    subjectGroup: 2,
    contextGroup: 1,
    patternName: 'following'
  },
];

/**
 * Patterns for extracting reasoning chains (numbered reasons)
 */
const REASONING_CHAIN_PATTERNS: Array<{ regex: RegExp; numberGroup: number; titleGroup?: number; explanationGroup: number }> = [
  // "First, X. Second, Y. Third, Z." pattern
  {
    regex: /(?:First|1\.?|One),?\s*(.{10,300}?)(?:\.|;)/gi,
    numberGroup: -1, // Will be set to 1
    explanationGroup: 1,
  },
  {
    regex: /(?:Second|2\.?|Two),?\s*(.{10,300}?)(?:\.|;)/gi,
    numberGroup: -1, // Will be set to 2
    explanationGroup: 1,
  },
  {
    regex: /(?:Third|3\.?|Three),?\s*(.{10,300}?)(?:\.|;)/gi,
    numberGroup: -1, // Will be set to 3
    explanationGroup: 1,
  },
  // "The first reason is X" pattern
  {
    regex: /(?:The\s+)?(?:first|1st)\s+(?:reason|factor|cause|advantage)\s+(?:is|:)\s*(.{10,300}?)(?:\.|;)/gi,
    numberGroup: -1,
    explanationGroup: 1,
  },
  {
    regex: /(?:The\s+)?(?:second|2nd)\s+(?:reason|factor|cause|advantage)\s+(?:is|:)\s*(.{10,300}?)(?:\.|;)/gi,
    numberGroup: -1,
    explanationGroup: 1,
  },
  {
    regex: /(?:The\s+)?(?:third|3rd)\s+(?:reason|factor|cause|advantage)\s+(?:is|:)\s*(.{10,300}?)(?:\.|;)/gi,
    numberGroup: -1,
    explanationGroup: 1,
  },
];

/**
 * Patterns for extracting titled reasons/causes
 */
const TITLED_CAUSE_PATTERNS: Array<{ regex: RegExp; titleGroup: number; explanationGroup: number }> = [
  // "**Title**: Explanation" or "**Title** - Explanation"
  {
    regex: /\*\*(.{3,50}?)\*\*[:\-–]\s*(.{20,300}?)(?:\.|;|$)/gi,
    titleGroup: 1,
    explanationGroup: 2,
  },
  // "Title: Explanation" (capitalized title)
  {
    regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})[:\-–]\s*(.{20,300}?)(?:\.|;|$)/g,
    titleGroup: 1,
    explanationGroup: 2,
  },
  // "(1) Title - explanation" or "1. Title - explanation"
  {
    regex: /(?:\(?\d+\)?\.?\s*)([A-Z][a-z]+(?:\s+[A-Za-z]+){0,4})\s*[:\-–]\s*(.{20,300}?)(?:\.|;|$)/g,
    titleGroup: 1,
    explanationGroup: 2,
  },
];

/**
 * Patterns for extracting quantitative evidence
 */
const EVIDENCE_PATTERNS: Array<{ regex: RegExp; metricGroup: number; valueGroup: number; comparisonGroup?: number }> = [
  // "X% higher/lower than Y"
  {
    regex: /(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)\s+(?:higher|lower|better|worse|more|less|greater|fewer)\s+(?:than\s+)?(.{5,100}?)(?:\.|,|;|$)/gi,
    valueGroup: 1,
    metricGroup: 2,
  },
  // "achieves X% improvement"
  {
    regex: /(?:achieves?|shows?|demonstrates?|produces?|yields?)\s+(?:a\s+)?(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)\s+(?:improvement|increase|decrease|reduction|gain)\s+(?:in\s+)?(.{5,100}?)(?:\.|,|;|$)/gi,
    valueGroup: 1,
    metricGroup: 2,
  },
  // "X improves by Y%"
  {
    regex: /(.{5,50}?)\s+(?:improves?|increases?|decreases?|reduces?)\s+(?:by\s+)?(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)(?:\.|,|;|$)/gi,
    metricGroup: 1,
    valueGroup: 2,
  },
  // "Sharpe ratio of X" or "accuracy of X%"
  {
    regex: /(.{3,30}?)\s+(?:of|:)\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)(?:\.|,|;|\s|$)/gi,
    metricGroup: 1,
    valueGroup: 2,
  },
  // "outperforms by X%"
  {
    regex: /(?:outperforms?|beats?|exceeds?)\s+(.{5,50}?)\s+(?:by\s+)?(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)(?:\.|,|;|$)/gi,
    comparisonGroup: 1,
    valueGroup: 2,
    metricGroup: 1,
  },
];

/**
 * Common cause categories for title generation
 */
const CAUSE_CATEGORIES: { [key: string]: string[] } = {
  'Reduced Overfitting': ['overfit', 'generalization', 'bias', 'variance', 'regulariz'],
  'Error Diversification': ['error', 'diversif', 'uncorrelat', 'independent', 'cancel'],
  'Robustness': ['robust', 'stable', 'reliable', 'consistent', 'resilient'],
  'Adaptability': ['adapt', 'dynamic', 'flexible', 'adjust', 'responsive'],
  'Performance': ['perform', 'accurac', 'precision', 'recall', 'metric'],
  'Scalability': ['scale', 'large', 'big data', 'distributed', 'parallel'],
  'Efficiency': ['efficien', 'fast', 'speed', 'computational', 'resource'],
  'Interpretability': ['interpret', 'explain', 'transparent', 'understand', 'insight'],
};

/**
 * Extract causal relationships from text content
 */
export function extractCausalRelationships(
  text: string,
  documentId: string,
  documentName: string,
  page?: number
): CausalRelationship[] {
  const relationships: CausalRelationship[] = [];

  if (!text || text.length < 50) {
    return relationships;
  }

  for (const pattern of CAUSAL_PATTERNS) {
    // Reset regex lastIndex for each document
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const effect = cleanExtractedText(match[pattern.effectGroup]);
      const cause = cleanExtractedText(match[pattern.causeGroup]);

      // Skip if either part is too short or too long
      if (effect.length < 5 || cause.length < 5 || effect.length > 200 || cause.length > 300) {
        continue;
      }

      // Skip if parts overlap too much (likely false positive)
      if (effect.includes(cause) || cause.includes(effect)) {
        continue;
      }

      // Calculate confidence based on pattern quality
      const confidence = calculateCausalConfidence(effect, cause, pattern.patternName);

      if (confidence > 0.4) {
        relationships.push({
          effect,
          cause,
          pattern: pattern.patternName,
          documentId,
          documentName,
          page,
          confidence,
          rawText: match[0].substring(0, 500) // Limit raw text length
        });
      }
    }
  }

  // Deduplicate similar relationships
  return deduplicateRelationships(relationships);
}

/**
 * Extract contextual information from text content
 */
export function extractContextualInfo(
  text: string,
  documentId: string,
  documentName: string,
  page?: number
): ContextualInfo[] {
  const contextInfo: ContextualInfo[] = [];

  if (!text || text.length < 50) {
    return contextInfo;
  }

  for (const pattern of CONTEXT_PATTERNS) {
    // Reset regex lastIndex for each document
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const subject = cleanExtractedText(match[pattern.subjectGroup]);
      const context = cleanExtractedText(match[pattern.contextGroup]);

      // Skip if either part is too short or too long
      if (subject.length < 5 || context.length < 5 || subject.length > 200 || context.length > 300) {
        continue;
      }

      contextInfo.push({
        subject,
        context,
        pattern: pattern.patternName,
        documentId,
        documentName,
        page,
        rawText: match[0].substring(0, 500)
      });
    }
  }

  return contextInfo;
}

/**
 * Clean extracted text by removing extra whitespace and normalizing
 */
function cleanExtractedText(text: string): string {
  if (!text) return '';

  return text
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .replace(/^\s+|\s+$/g, '')   // Trim
    .replace(/^[,;:\s]+/, '')    // Remove leading punctuation
    .replace(/[,;:\s]+$/, '');   // Remove trailing punctuation
}

/**
 * Calculate confidence score for a causal relationship
 */
function calculateCausalConfidence(effect: string, cause: string, pattern: string): number {
  let confidence = 0.5; // Base confidence

  // Increase confidence for specific patterns
  const strongPatterns = ['due to', 'caused by', 'because of', 'as a result of'];
  if (strongPatterns.includes(pattern)) {
    confidence += 0.2;
  }

  // Increase confidence for longer, more specific causes
  if (cause.length > 30 && cause.length < 150) {
    confidence += 0.1;
  }

  // Increase confidence if cause contains specific keywords
  const specificKeywords = ['pandemic', 'crisis', 'lockdown', 'recession', 'growth', 'decline',
    'increase', 'decrease', 'shortage', 'demand', 'supply', 'inflation', 'regulation',
    'policy', 'market', 'economic', 'financial'];
  if (specificKeywords.some(kw => cause.toLowerCase().includes(kw))) {
    confidence += 0.15;
  }

  // Decrease confidence for vague language
  const vagueWords = ['things', 'stuff', 'something', 'various', 'many', 'some'];
  if (vagueWords.some(vw => cause.toLowerCase().includes(vw))) {
    confidence -= 0.1;
  }

  return Math.min(1, Math.max(0, confidence));
}

/**
 * Deduplicate similar causal relationships
 */
function deduplicateRelationships(relationships: CausalRelationship[]): CausalRelationship[] {
  const unique: CausalRelationship[] = [];

  for (const rel of relationships) {
    const isDuplicate = unique.some(existing => {
      const effectSimilarity = calculateTextSimilarity(existing.effect, rel.effect);
      const causeSimilarity = calculateTextSimilarity(existing.cause, rel.cause);
      return effectSimilarity > 0.7 && causeSimilarity > 0.7;
    });

    if (!isDuplicate) {
      unique.push(rel);
    }
  }

  return unique;
}

/**
 * Simple text similarity calculation (Jaccard similarity on words)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Detect if a query is asking "why" (causal question)
 */
export function isWhyQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Direct "why" questions
  if (lowerQuery.startsWith('why ') || lowerQuery.startsWith('why?')) {
    return true;
  }

  // Alternative causal question patterns
  const causalPatterns = [
    /what\s+(?:caused|led to|resulted in|triggered)/i,
    /what\s+(?:is|was|were|are)\s+the\s+(?:reason|cause|explanation)/i,
    /how\s+did\s+.+\s+happen/i,
    /what\s+explains/i,
    /(?:explain|describe)\s+(?:why|the reason)/i,
    /what\s+(?:is|was)\s+(?:behind|responsible for)/i,
  ];

  return causalPatterns.some(pattern => pattern.test(lowerQuery));
}

/**
 * Extract the subject/fact from a "why" query
 * Example: "Why did Argentina's GDP drop in 2020?" → "Argentina's GDP drop"
 */
export function extractQuerySubject(query: string): string | null {
  const lowerQuery = query.toLowerCase().trim();

  // Pattern: "Why did X happen/drop/increase/etc.?"
  const whyDidMatch = query.match(/why\s+did\s+(.+?)(?:\s+(?:happen|occur|drop|fall|rise|increase|decrease|grow|decline|change))?(?:\s+in\s+\d{4})?\s*\??\s*$/i);
  if (whyDidMatch) {
    return whyDidMatch[1].trim();
  }

  // Pattern: "Why is/was X..."
  const whyIsMatch = query.match(/why\s+(?:is|was|are|were)\s+(.+?)(?:\s+so\s+|\s+\?|\s*$)/i);
  if (whyIsMatch) {
    return whyIsMatch[1].trim();
  }

  // Pattern: "What caused X?"
  const whatCausedMatch = query.match(/what\s+(?:caused|led to|resulted in)\s+(.+?)\s*\??\s*$/i);
  if (whatCausedMatch) {
    return whatCausedMatch[1].trim();
  }

  // Pattern: "What is the reason for X?"
  const reasonMatch = query.match(/what\s+(?:is|was)\s+the\s+(?:reason|cause)\s+(?:for|of|behind)\s+(.+?)\s*\??\s*$/i);
  if (reasonMatch) {
    return reasonMatch[1].trim();
  }

  return null;
}

/**
 * Find relevant causes for a given subject/fact
 */
export function findRelevantCauses(
  subject: string,
  relationships: CausalRelationship[],
  minConfidence: number = 0.4
): CausalRelationship[] {
  if (!subject || relationships.length === 0) {
    return [];
  }

  const subjectWords = new Set(subject.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  const relevantRelationships = relationships.filter(rel => {
    // Check if relationship confidence meets threshold
    if (rel.confidence < minConfidence) {
      return false;
    }

    // Check if effect matches subject
    const effectWords = new Set(rel.effect.toLowerCase().split(/\s+/));
    const overlap = [...subjectWords].filter(w => effectWords.has(w)).length;
    const similarity = overlap / Math.min(subjectWords.size, effectWords.size);

    return similarity > 0.3;
  });

  // Sort by confidence
  return relevantRelationships.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find relevant context for a given subject
 */
export function findRelevantContext(
  subject: string,
  contextInfo: ContextualInfo[]
): ContextualInfo[] {
  if (!subject || contextInfo.length === 0) {
    return [];
  }

  const subjectWords = new Set(subject.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  return contextInfo.filter(ctx => {
    const ctxWords = new Set(ctx.subject.toLowerCase().split(/\s+/));
    const overlap = [...subjectWords].filter(w => ctxWords.has(w)).length;
    const similarity = overlap / Math.min(subjectWords.size, ctxWords.size);

    return similarity > 0.3;
  });
}

/**
 * Extract reasoning chain steps from text
 */
export function extractReasoningChain(
  text: string,
  documentId: string,
  documentName: string,
  page?: number
): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  if (!text || text.length < 50) {
    return steps;
  }

  // Look for numbered lists or sequential markers
  const numberedPattern = /(?:^|\n)\s*(\d+)[.)\]]\s*(.{10,300}?)(?=\n\s*\d+[.)\]]|\n\n|$)/gi;
  let match;

  numberedPattern.lastIndex = 0;
  while ((match = numberedPattern.exec(text)) !== null) {
    const stepNum = parseInt(match[1]);
    const explanation = cleanExtractedText(match[2]);

    if (explanation.length > 10 && stepNum <= 10) {
      steps.push({
        stepNumber: stepNum,
        title: generateTitleFromExplanation(explanation),
        explanation,
        documentId,
        documentName,
        page
      });
    }
  }

  // Also look for "First, Second, Third" patterns
  const ordinalPatterns = [
    { pattern: /(?:First|Firstly),?\s*(.{10,300}?)(?:\.|;|$)/gi, num: 1 },
    { pattern: /(?:Second|Secondly),?\s*(.{10,300}?)(?:\.|;|$)/gi, num: 2 },
    { pattern: /(?:Third|Thirdly),?\s*(.{10,300}?)(?:\.|;|$)/gi, num: 3 },
    { pattern: /(?:Fourth|Fourthly),?\s*(.{10,300}?)(?:\.|;|$)/gi, num: 4 },
    { pattern: /(?:Finally|Lastly),?\s*(.{10,300}?)(?:\.|;|$)/gi, num: 5 },
  ];

  for (const { pattern, num } of ordinalPatterns) {
    pattern.lastIndex = 0;
    const ordinalMatch = pattern.exec(text);
    if (ordinalMatch) {
      const explanation = cleanExtractedText(ordinalMatch[1]);
      if (explanation.length > 10 && !steps.some(s => s.stepNumber === num)) {
        steps.push({
          stepNumber: num,
          title: generateTitleFromExplanation(explanation),
          explanation,
          documentId,
          documentName,
          page
        });
      }
    }
  }

  // Sort by step number
  return steps.sort((a, b) => a.stepNumber - b.stepNumber);
}

/**
 * Generate a concise title from an explanation
 */
function generateTitleFromExplanation(explanation: string): string {
  const lowerExplanation = explanation.toLowerCase();

  // Check against known categories
  for (const [title, keywords] of Object.entries(CAUSE_CATEGORIES)) {
    if (keywords.some(kw => lowerExplanation.includes(kw))) {
      return title;
    }
  }

  // Extract the first noun phrase as title (first 2-4 words)
  const words = explanation.split(/\s+/).slice(0, 4);
  let title = words.join(' ');

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Remove trailing articles/prepositions
  title = title.replace(/\s+(the|a|an|to|of|by|for|in|on|at)$/i, '');

  // Truncate if too long
  if (title.length > 40) {
    title = title.substring(0, 37) + '...';
  }

  return title;
}

/**
 * Extract quantitative evidence from text
 */
export function extractQuantitativeEvidence(
  text: string,
  subject: string,
  documentId: string,
  documentName: string,
  page?: number
): QuantitativeEvidence[] {
  const evidence: QuantitativeEvidence[] = [];

  if (!text || text.length < 20) {
    return evidence;
  }

  const subjectLower = subject.toLowerCase();

  for (const pattern of EVIDENCE_PATTERNS) {
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const metric = cleanExtractedText(match[pattern.metricGroup] || '');
      const value = cleanExtractedText(match[pattern.valueGroup] || '');
      const comparison = pattern.comparisonGroup ? cleanExtractedText(match[pattern.comparisonGroup] || '') : undefined;

      // Check if this evidence is relevant to the subject
      const matchText = match[0].toLowerCase();
      const isRelevant = subjectLower.split(/\s+/).some(word =>
        word.length > 3 && matchText.includes(word)
      );

      if (value && (isRelevant || !subject)) {
        evidence.push({
          metric: metric || 'performance',
          value,
          comparison,
          documentId,
          documentName,
          page
        });
      }
    }
  }

  // Deduplicate by value
  const unique: QuantitativeEvidence[] = [];
  const seenValues = new Set<string>();

  for (const ev of evidence) {
    const key = `${ev.value}-${ev.metric}`;
    if (!seenValues.has(key)) {
      seenValues.add(key);
      unique.push(ev);
    }
  }

  return unique.slice(0, 5); // Limit to 5 pieces of evidence
}

/**
 * Convert causal relationships to structured causes with titles
 */
export function convertToStructuredCauses(
  relationships: CausalRelationship[],
  reasoningSteps: ReasoningStep[]
): StructuredCause[] {
  const structuredCauses: StructuredCause[] = [];

  // First, try to use reasoning steps if available
  for (const step of reasoningSteps) {
    structuredCauses.push({
      title: step.title,
      explanation: step.explanation,
      documentId: step.documentId,
      documentName: step.documentName,
      page: step.page,
      confidence: 0.8 // Reasoning steps have high confidence
    });
  }

  // Add causes from causal relationships
  for (const rel of relationships) {
    // Check if we already have this cause
    const alreadyExists = structuredCauses.some(sc =>
      calculateTextSimilarity(sc.explanation, rel.cause) > 0.5
    );

    if (!alreadyExists) {
      structuredCauses.push({
        title: generateTitleFromExplanation(rel.cause),
        explanation: rel.cause,
        mechanism: rel.rawText,
        documentId: rel.documentId,
        documentName: rel.documentName,
        page: rel.page,
        confidence: rel.confidence
      });
    }
  }

  // Sort by confidence and limit
  return structuredCauses
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/**
 * Format structured causes for LLM prompt (numbered format with titles)
 */
export function formatStructuredCausesForPrompt(
  causes: StructuredCause[],
  evidence: QuantitativeEvidence[]
): string {
  if (causes.length === 0) {
    return '';
  }

  let output = `**KEY REASONS (${causes.length} found):**\n\n`;

  causes.forEach((cause, idx) => {
    const sourceInfo = cause.page ? `${cause.documentName}, p.${cause.page}` : cause.documentName;
    output += `**${idx + 1}. ${cause.title}**\n`;
    output += `${cause.explanation}\n`;
    if (cause.mechanism && cause.mechanism !== cause.explanation) {
      output += `_Mechanism: ${cause.mechanism.substring(0, 150)}..._\n`;
    }
    output += `(Source: ${sourceInfo})\n\n`;
  });

  // Add evidence summary
  if (evidence.length > 0) {
    output += `**QUANTITATIVE EVIDENCE:**\n`;
    evidence.forEach(ev => {
      const sourceInfo = ev.page ? `${ev.documentName}, p.${ev.page}` : ev.documentName;
      if (ev.comparison) {
        output += `- ${ev.metric}: ${ev.value} compared to ${ev.comparison} (${sourceInfo})\n`;
      } else {
        output += `- ${ev.metric}: ${ev.value} (${sourceInfo})\n`;
      }
    });
    output += '\n';
  }

  return output;
}

/**
 * Format causal relationships for inclusion in LLM prompt
 */
export function formatCausesForPrompt(relationships: CausalRelationship[]): string {
  if (relationships.length === 0) {
    return '';
  }

  const lines = relationships.slice(0, 5).map((rel, idx) => {
    const sourceInfo = rel.page ? `${rel.documentName}, page ${rel.page}` : rel.documentName;
    return `${idx + 1}. **${rel.effect}** was ${rel.pattern} **${rel.cause}** (Source: ${sourceInfo}, confidence: ${(rel.confidence * 100).toFixed(0)}%)`;
  });

  return `**Causal Relationships Found:**\n${lines.join('\n')}`;
}

/**
 * Format contextual information for inclusion in LLM prompt
 */
export function formatContextForPrompt(contextInfo: ContextualInfo[]): string {
  if (contextInfo.length === 0) {
    return '';
  }

  const lines = contextInfo.slice(0, 3).map((ctx, idx) => {
    const sourceInfo = ctx.page ? `${ctx.documentName}, page ${ctx.page}` : ctx.documentName;
    return `${idx + 1}. ${ctx.subject} occurred ${ctx.pattern} ${ctx.context} (Source: ${sourceInfo})`;
  });

  return `**Contextual Information:**\n${lines.join('\n')}`;
}

/**
 * Cache extracted relationships for a document
 */
export function cacheDocumentRelationships(
  documentId: string,
  relationships: CausalRelationship[],
  contextInfo: ContextualInfo[]
): void {
  causalCache.set(`causal:${documentId}`, relationships);
  causalCache.set(`context:${documentId}`, contextInfo);
}

/**
 * Get cached relationships for a document
 */
export function getCachedRelationships(documentId: string): {
  relationships: CausalRelationship[] | undefined;
  contextInfo: ContextualInfo[] | undefined;
} {
  return {
    relationships: causalCache.get<CausalRelationship[]>(`causal:${documentId}`),
    contextInfo: causalCache.get<ContextualInfo[]>(`context:${documentId}`)
  };
}

/**
 * Main service class for causal extraction
 */
export class CausalExtractionService {
  /**
   * Process document chunks and extract causal/contextual information
   */
  processChunks(chunks: Array<{
    content: string;
    document_metadata: {
      documentId: string;
      filename: string;
      page?: number;
    };
  }>): {
    relationships: CausalRelationship[];
    contextInfo: ContextualInfo[];
    reasoningSteps: ReasoningStep[];
  } {
    const allRelationships: CausalRelationship[] = [];
    const allContextInfo: ContextualInfo[] = [];
    const allReasoningSteps: ReasoningStep[] = [];

    for (const chunk of chunks) {
      const text = chunk.content || '';
      const docId = chunk.document_metadata?.documentId || 'unknown';
      const docName = chunk.document_metadata?.filename || 'Unknown';
      const page = chunk.document_metadata?.page;

      // Check cache first
      const cached = getCachedRelationships(docId);
      if (cached.relationships && cached.contextInfo) {
        allRelationships.push(...cached.relationships);
        allContextInfo.push(...cached.contextInfo);
        continue;
      }

      // Extract relationships
      const relationships = extractCausalRelationships(text, docId, docName, page);
      const contextInfo = extractContextualInfo(text, docId, docName, page);
      const reasoningSteps = extractReasoningChain(text, docId, docName, page);

      // Cache for future use
      if (relationships.length > 0 || contextInfo.length > 0) {
        cacheDocumentRelationships(docId, relationships, contextInfo);
      }

      allRelationships.push(...relationships);
      allContextInfo.push(...contextInfo);
      allReasoningSteps.push(...reasoningSteps);
    }

    return {
      relationships: deduplicateRelationships(allRelationships),
      contextInfo: allContextInfo,
      reasoningSteps: allReasoningSteps
    };
  }

  /**
   * Extract quantitative evidence from chunks for a given subject
   */
  extractEvidence(
    subject: string,
    chunks: Array<{
      content: string;
      document_metadata: {
        documentId: string;
        filename: string;
        page?: number;
      };
    }>
  ): QuantitativeEvidence[] {
    const allEvidence: QuantitativeEvidence[] = [];

    for (const chunk of chunks) {
      const text = chunk.content || '';
      const docId = chunk.document_metadata?.documentId || 'unknown';
      const docName = chunk.document_metadata?.filename || 'Unknown';
      const page = chunk.document_metadata?.page;

      const evidence = extractQuantitativeEvidence(text, subject, docId, docName, page);
      allEvidence.push(...evidence);
    }

    // Deduplicate and limit
    const unique: QuantitativeEvidence[] = [];
    const seenValues = new Set<string>();

    for (const ev of allEvidence) {
      const key = `${ev.value}-${ev.metric}`;
      if (!seenValues.has(key)) {
        seenValues.add(key);
        unique.push(ev);
      }
    }

    return unique.slice(0, 5);
  }

  /**
   * Answer a "why" query using extracted causal information (ENHANCED)
   * Now includes reasoning chains, structured causes, and evidence
   */
  getWhyQueryContext(
    query: string,
    chunks: Array<{
      content: string;
      document_metadata: {
        documentId: string;
        filename: string;
        page?: number;
      };
    }>
  ): {
    isWhyQuery: boolean;
    subject: string | null;
    causes: CausalRelationship[];
    structuredCauses: StructuredCause[];
    context: ContextualInfo[];
    evidence: QuantitativeEvidence[];
    promptAddition: string;
  } {
    const isWhy = isWhyQuery(query);

    if (!isWhy) {
      return {
        isWhyQuery: false,
        subject: null,
        causes: [],
        structuredCauses: [],
        context: [],
        evidence: [],
        promptAddition: ''
      };
    }

    const subject = extractQuerySubject(query);
    const { relationships, contextInfo, reasoningSteps } = this.processChunks(chunks);

    const relevantCauses = subject ? findRelevantCauses(subject, relationships) : relationships.slice(0, 5);
    const relevantContext = subject ? findRelevantContext(subject, contextInfo) : contextInfo.slice(0, 3);

    // Extract quantitative evidence
    const evidence = this.extractEvidence(subject || query, chunks);

    // Convert to structured causes with titles
    const structuredCauses = convertToStructuredCauses(relevantCauses, reasoningSteps);

    console.log(`🔍 [CAUSAL] Found ${relevantCauses.length} causal relationships`);
    console.log(`🔍 [CAUSAL] Found ${reasoningSteps.length} reasoning steps`);
    console.log(`🔍 [CAUSAL] Built ${structuredCauses.length} structured causes`);
    console.log(`🔍 [CAUSAL] Found ${evidence.length} pieces of quantitative evidence`);

    // Build prompt addition
    let promptAddition = '';

    if (structuredCauses.length > 0 || relevantContext.length > 0 || evidence.length > 0) {
      promptAddition = `\n\n**CAUSAL REASONING INTELLIGENCE (Use this to explain WHY):**\n\n`;

      // Add structured causes (numbered with titles)
      if (structuredCauses.length > 0) {
        promptAddition += formatStructuredCausesForPrompt(structuredCauses, evidence);
      } else if (relevantCauses.length > 0) {
        // Fallback to basic format if no structured causes
        promptAddition += formatCausesForPrompt(relevantCauses) + '\n\n';
      }

      // Add contextual information
      if (relevantContext.length > 0) {
        promptAddition += formatContextForPrompt(relevantContext) + '\n\n';
      }

      // Add instructions for the LLM
      promptAddition += `**INSTRUCTION FOR ANSWERING "WHY" QUESTIONS:**
1. Structure your answer with numbered reasons (e.g., "X happens for 3 key reasons:")
2. For each reason, provide:
   - A bold title (e.g., **1. Reduced Overfitting**)
   - A clear explanation of the mechanism
   - An analogy if helpful (e.g., "similar to how polling multiple experts...")
3. Include quantitative evidence from the documents when available
4. End with a summary that connects back to the user's documents
5. Do NOT just say "X is mentioned in Y papers" - explain the actual reasons WHY`;
    }

    return {
      isWhyQuery: true,
      subject,
      causes: relevantCauses,
      structuredCauses,
      context: relevantContext,
      evidence,
      promptAddition
    };
  }
}

// Export singleton instance
export const causalExtractionService = new CausalExtractionService();
export default causalExtractionService;
