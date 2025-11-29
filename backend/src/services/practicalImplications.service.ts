/**
 * Practical Implications Service
 *
 * PURPOSE: Extract actionable recommendations, thresholds, and best practices from documents
 * to provide practical guidance for implementation questions.
 *
 * PROBLEM SOLVED:
 * - OLD: "What does this mean for my trading strategy?"
 *        → "Your documents discuss various trading strategies."
 * - NEW: "What does this mean for my trading strategy?"
 *        → Categorized actionable recommendations with quantitative thresholds and evidence
 *
 * HOW IT WORKS:
 * 1. Extract recommendations ("we recommend...", "should...", "best practice...")
 * 2. Extract quantitative thresholds ("above X", "at least Y", "optimal value is Z")
 * 3. Extract best practices and guidelines
 * 4. Group recommendations by category (Strategy, Risk Management, Implementation, etc.)
 * 5. Synthesize a bottom-line summary across all documents
 */

import NodeCache from 'node-cache';

// Cache for extracted implications (TTL: 1 hour)
const implicationsCache = new NodeCache({ stdTTL: 3600 });

/**
 * Represents a recommendation extracted from a document
 */
export interface Recommendation {
  text: string;               // The recommendation text
  category: string;           // Category (e.g., "Strategy Design", "Risk Management")
  strength: 'strong' | 'moderate' | 'weak';  // How strongly stated
  evidence?: string;          // Supporting evidence or quantitative backing
  pattern: string;            // The pattern matched
  documentId: string;         // Source document ID
  documentName: string;       // Source document name
  page?: number;              // Page number if available
  confidence: number;         // Confidence score (0-1)
}

/**
 * Represents a quantitative threshold extracted from a document
 */
export interface QuantitativeThreshold {
  metric: string;             // What is being measured (e.g., "stop-loss", "assets")
  value: string;              // The threshold value (e.g., "2-3%", "20-30")
  direction: 'above' | 'below' | 'at_least' | 'at_most' | 'optimal' | 'range';
  context: string;            // Context for when this applies
  documentId: string;         // Source document ID
  documentName: string;       // Source document name
  page?: number;              // Page number if available
}

/**
 * Represents a best practice extracted from a document
 */
export interface BestPractice {
  practice: string;           // The best practice description
  category: string;           // Category
  rationale?: string;         // Why this is a best practice
  frequency?: number;         // How many documents mention this
  sources: Array<{            // Source documents
    documentId: string;
    documentName: string;
    page?: number;
  }>;
}

/**
 * Represents grouped implications by category
 */
export interface CategorizedImplications {
  category: string;
  recommendations: Recommendation[];
  thresholds: QuantitativeThreshold[];
  bestPractices: BestPractice[];
}

/**
 * Patterns for extracting recommendations
 */
const RECOMMENDATION_PATTERNS: Array<{
  regex: RegExp;
  textGroup: number;
  strength: 'strong' | 'moderate' | 'weak';
  patternName: string;
}> = [
  // Strong recommendations
  {
    regex: /(?:we\s+)?(?:strongly\s+)?recommend(?:s|ed|ing)?\s+(?:that\s+)?(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'strong',
    patternName: 'recommend'
  },
  {
    regex: /(?:it\s+is\s+)?(?:strongly\s+)?(?:advisable|advised)\s+(?:to\s+)?(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'strong',
    patternName: 'advisable'
  },
  {
    regex: /(?:you\s+)?(?:should|must|need to)\s+(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'strong',
    patternName: 'should'
  },
  {
    regex: /(?:it\s+is\s+)?(?:essential|critical|crucial|vital|important)\s+(?:to|that)\s+(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'strong',
    patternName: 'essential'
  },
  // Moderate recommendations
  {
    regex: /(?:we\s+)?suggest(?:s|ed|ing)?\s+(?:that\s+)?(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'moderate',
    patternName: 'suggest'
  },
  {
    regex: /(?:it\s+)?(?:would be|is)\s+(?:better|beneficial|preferable)\s+(?:to\s+)?(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'moderate',
    patternName: 'better to'
  },
  {
    regex: /(?:consider|try)\s+(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'moderate',
    patternName: 'consider'
  },
  // Weak recommendations / suggestions
  {
    regex: /(?:one\s+)?(?:could|might|may)\s+(?:want to\s+)?(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'weak',
    patternName: 'could'
  },
  // Best practices
  {
    regex: /(?:best\s+)?practice(?:s)?\s+(?:is|are|include)\s+(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'strong',
    patternName: 'best practice'
  },
  {
    regex: /(?:the\s+)?(?:optimal|ideal|recommended)\s+(?:approach|strategy|method|way)\s+(?:is|involves)\s+(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'strong',
    patternName: 'optimal approach'
  },
  // Guidelines
  {
    regex: /(?:as\s+a\s+)?guideline(?:s)?,?\s+(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'moderate',
    patternName: 'guideline'
  },
  {
    regex: /(?:general\s+)?rule(?:\s+of\s+thumb)?\s+(?:is|:)\s+(.{10,200}?)(?:\.|;|$)/gi,
    textGroup: 1,
    strength: 'moderate',
    patternName: 'rule of thumb'
  },
];

/**
 * Patterns for extracting quantitative thresholds
 */
const THRESHOLD_PATTERNS: Array<{
  regex: RegExp;
  metricGroup: number;
  valueGroup: number;
  direction: 'above' | 'below' | 'at_least' | 'at_most' | 'optimal' | 'range';
}> = [
  // "at least X" pattern
  {
    regex: /(?:at\s+least|minimum\s+of|no\s+less\s+than)\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)\s+(.{3,50}?)(?:\.|,|;|$)/gi,
    valueGroup: 1,
    metricGroup: 2,
    direction: 'at_least'
  },
  // "at most X" / "no more than X" pattern
  {
    regex: /(?:at\s+most|maximum\s+of|no\s+more\s+than)\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)\s+(.{3,50}?)(?:\.|,|;|$)/gi,
    valueGroup: 1,
    metricGroup: 2,
    direction: 'at_most'
  },
  // "above X" / "greater than X" pattern
  {
    regex: /(?:above|greater\s+than|over|exceeding)\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)\s+(.{3,50}?)(?:\.|,|;|$)/gi,
    valueGroup: 1,
    metricGroup: 2,
    direction: 'above'
  },
  // "below X" / "less than X" pattern
  {
    regex: /(?:below|less\s+than|under)\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)\s+(.{3,50}?)(?:\.|,|;|$)/gi,
    valueGroup: 1,
    metricGroup: 2,
    direction: 'below'
  },
  // "optimal value is X" pattern
  {
    regex: /(?:optimal|ideal|recommended|best)\s+(?:value|level|threshold|setting)\s+(?:is|of|:)\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)\s*(?:for\s+)?(.{3,50}?)(?:\.|,|;|$)/gi,
    valueGroup: 1,
    metricGroup: 2,
    direction: 'optimal'
  },
  // "X should be Y" pattern (e.g., "stop-loss should be 2-3%")
  {
    regex: /(.{3,30}?)\s+should\s+be\s+(?:set\s+(?:at|to)\s+)?(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)(?:\.|,|;|$)/gi,
    metricGroup: 1,
    valueGroup: 2,
    direction: 'optimal'
  },
  // "set X at Y" pattern
  {
    regex: /set\s+(.{3,30}?)\s+(?:at|to)\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)(?:\.|,|;|$)/gi,
    metricGroup: 1,
    valueGroup: 2,
    direction: 'optimal'
  },
  // "X of Y-Z" range pattern (e.g., "diversify across 20-30 assets")
  {
    regex: /(.{3,30}?)\s+(?:of|across|with)\s+(\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?)\s+(.{3,30}?)(?:\.|,|;|$)/gi,
    metricGroup: 3,
    valueGroup: 2,
    direction: 'range'
  },
  // "improve by X%" pattern
  {
    regex: /(?:improve|increase|reduce|decrease)(?:s|d)?\s+(.{3,30}?)\s+by\s+(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%?)(?:\.|,|;|$)/gi,
    metricGroup: 1,
    valueGroup: 2,
    direction: 'optimal'
  },
];

/**
 * Categories for grouping recommendations
 */
const RECOMMENDATION_CATEGORIES: { [key: string]: string[] } = {
  'Strategy Design': [
    'strategy', 'approach', 'method', 'technique', 'algorithm', 'model', 'signal',
    'indicator', 'momentum', 'mean-reversion', 'ensemble', 'ml', 'machine learning',
    'portfolio', 'allocation', 'position', 'sizing', 'entry', 'exit'
  ],
  'Risk Management': [
    'risk', 'stop-loss', 'stop loss', 'drawdown', 'volatility', 'var', 'exposure',
    'hedging', 'hedge', 'diversif', 'concentration', 'leverage', 'margin',
    'loss', 'maximum', 'limit'
  ],
  'Implementation': [
    'implement', 'deploy', 'execute', 'train', 'retrain', 'update', 'frequency',
    'backtest', 'test', 'validate', 'monitor', 'maintain', 'optimize', 'tune',
    'parameter', 'hyperparameter', 'transfer learning', 'data', 'pipeline'
  ],
  'Performance': [
    'performance', 'return', 'sharpe', 'sortino', 'alpha', 'beta', 'accuracy',
    'precision', 'recall', 'profit', 'pnl', 'benchmark', 'outperform'
  ],
  'Data & Features': [
    'data', 'feature', 'input', 'variable', 'preprocessing', 'normalization',
    'feature engineering', 'selection', 'dimension', 'dataset'
  ],
  'Timing': [
    'timing', 'frequency', 'period', 'horizon', 'daily', 'weekly', 'monthly',
    'intraday', 'rebalance', 'holding', 'duration'
  ],
};

/**
 * Extract recommendations from text
 */
export function extractRecommendations(
  text: string,
  documentId: string,
  documentName: string,
  page?: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (!text || text.length < 50) {
    return recommendations;
  }

  for (const pattern of RECOMMENDATION_PATTERNS) {
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const recText = cleanText(match[pattern.textGroup]);

      // Skip if too short or too long
      if (recText.length < 10 || recText.length > 250) {
        continue;
      }

      // Determine category
      const category = categorizeRecommendation(recText);

      // Extract evidence if present (look for numbers nearby)
      const evidence = extractEvidenceFromContext(text, match.index, recText);

      // Calculate confidence
      const confidence = calculateRecommendationConfidence(recText, pattern.strength, evidence);

      if (confidence > 0.4) {
        recommendations.push({
          text: recText,
          category,
          strength: pattern.strength,
          evidence,
          pattern: pattern.patternName,
          documentId,
          documentName,
          page,
          confidence
        });
      }
    }
  }

  return deduplicateRecommendations(recommendations);
}

/**
 * Extract quantitative thresholds from text
 */
export function extractThresholds(
  text: string,
  documentId: string,
  documentName: string,
  page?: number
): QuantitativeThreshold[] {
  const thresholds: QuantitativeThreshold[] = [];

  if (!text || text.length < 20) {
    return thresholds;
  }

  for (const pattern of THRESHOLD_PATTERNS) {
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const metric = cleanText(match[pattern.metricGroup] || '');
      const value = cleanText(match[pattern.valueGroup] || '');

      // Skip if metric or value is invalid
      if (!metric || !value || metric.length < 2 || metric.length > 50) {
        continue;
      }

      // Get surrounding context
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(contextStart, contextEnd).replace(/\s+/g, ' ').trim();

      thresholds.push({
        metric: capitalizeFirst(metric),
        value,
        direction: pattern.direction,
        context,
        documentId,
        documentName,
        page
      });
    }
  }

  // Deduplicate by metric+value
  const unique: QuantitativeThreshold[] = [];
  const seen = new Set<string>();

  for (const t of thresholds) {
    const key = `${t.metric.toLowerCase()}-${t.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }

  return unique;
}

/**
 * Extract best practices by aggregating similar recommendations
 */
export function extractBestPractices(
  recommendations: Recommendation[]
): BestPractice[] {
  const practiceGroups: Map<string, {
    practice: string;
    category: string;
    rationale: string;
    sources: Array<{ documentId: string; documentName: string; page?: number }>;
  }> = new Map();

  for (const rec of recommendations) {
    // Normalize recommendation text for grouping
    const normalized = normalizeForGrouping(rec.text);

    // Check if similar practice exists
    let found = false;
    for (const [key, group] of practiceGroups) {
      if (calculateTextSimilarity(normalized, key) > 0.5) {
        // Add to existing group
        group.sources.push({
          documentId: rec.documentId,
          documentName: rec.documentName,
          page: rec.page
        });
        found = true;
        break;
      }
    }

    if (!found) {
      practiceGroups.set(normalized, {
        practice: rec.text,
        category: rec.categories,
        rationale: rec.evidence || '',
        sources: [{
          documentId: rec.documentId,
          documentName: rec.documentName,
          page: rec.page
        }]
      });
    }
  }

  // Convert to BestPractice array, prioritizing those mentioned in multiple documents
  const practices: BestPractice[] = [];

  for (const group of practiceGroups.values()) {
    practices.push({
      practice: group.practice,
      category: group.categories,
      rationale: group.rationale,
      frequency: group.sources.length,
      sources: group.sources
    });
  }

  // Sort by frequency (consensus)
  return practices.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
}

/**
 * Group recommendations by category
 */
export function groupRecommendationsByCategory(
  recommendations: Recommendation[],
  thresholds: QuantitativeThreshold[],
  bestPractices: BestPractice[]
): CategorizedImplications[] {
  const categories: Map<string, CategorizedImplications> = new Map();

  // Initialize categories
  for (const category of Object.keys(RECOMMENDATION_CATEGORIES)) {
    categories.set(category, {
      category,
      recommendations: [],
      thresholds: [],
      bestPractices: []
    });
  }

  // Add "Other" category for uncategorized items
  categories.set('Other', {
    category: 'Other',
    recommendations: [],
    thresholds: [],
    bestPractices: []
  });

  // Group recommendations
  for (const rec of recommendations) {
    const catData = categories.get(rec.categories) || categories.get('Other')!;
    catData.recommendations.push(rec);
  }

  // Group thresholds
  for (const threshold of thresholds) {
    const category = categorizeThreshold(threshold.metric);
    const catData = categories.get(category) || categories.get('Other')!;
    catData.thresholds.push(threshold);
  }

  // Group best practices
  for (const practice of bestPractices) {
    const catData = categories.get(practice.categories) || categories.get('Other')!;
    catData.bestPractices.push(practice);
  }

  // Filter out empty categories and sort by content count
  return Array.from(categories.values())
    .filter(c => c.recommendations.length > 0 || c.thresholds.length > 0 || c.bestPractices.length > 0)
    .sort((a, b) => {
      const aCount = a.recommendations.length + a.thresholds.length + a.bestPractices.length;
      const bCount = b.recommendations.length + b.thresholds.length + b.bestPractices.length;
      return bCount - aCount;
    });
}

/**
 * Synthesize a bottom-line summary
 */
export function synthesizeBottomLine(
  categorizedImplications: CategorizedImplications[],
  totalDocuments: number
): string {
  const insights: string[] = [];

  // Count strong recommendations
  let strongRecs = 0;
  let totalRecs = 0;
  const keyMetrics: string[] = [];

  for (const cat of categorizedImplications) {
    totalRecs += cat.recommendations.length;
    strongRecs += cat.recommendations.filter(r => r.strength === 'strong').length;

    // Collect key metrics with values
    for (const t of cat.thresholds.slice(0, 2)) {
      keyMetrics.push(`${t.metric}: ${t.value}`);
    }
  }

  // Build bottom line
  if (categorizedImplications.length > 0) {
    const topCategory = categorizedImplications[0];
    const topRec = topCategory.recommendations[0];

    if (topRec) {
      insights.push(topRec.text);
    }

    if (keyMetrics.length > 0) {
      insights.push(`Key thresholds: ${keyMetrics.slice(0, 3).join(', ')}`);
    }

    // Add consensus note if multiple documents
    if (totalDocuments > 1) {
      const consensusRecs = categorizedImplications
        .flatMap(c => c.bestPractices)
        .filter(bp => (bp.frequency || 0) > 1)
        .length;

      if (consensusRecs > 0) {
        insights.push(`${consensusRecs} recommendations appear across multiple documents`);
      }
    }
  }

  if (insights.length === 0) {
    return 'Review the categorized recommendations above for actionable guidance.';
  }

  return insights.join('. ') + '.';
}

/**
 * Format implications for LLM prompt
 */
export function formatImplicationsForPrompt(
  categorizedImplications: CategorizedImplications[],
  bottomLine: string
): string {
  if (categorizedImplications.length === 0) {
    return '';
  }

  let output = '\n\n**PRACTICAL IMPLICATIONS (Use this to provide actionable guidance):**\n\n';

  for (const cat of categorizedImplications.slice(0, 4)) {
    output += `**For ${cat.categories}:**\n`;

    // Add recommendations (top 3)
    for (const rec of cat.recommendations.slice(0, 3)) {
      const evidenceStr = rec.evidence ? `—${rec.evidence}` : '';
      const sourceStr = rec.page ? `(${rec.documentName}, p.${rec.page})` : `(${rec.documentName})`;
      output += `• ${rec.text}${evidenceStr} ${sourceStr}\n`;
    }

    // Add thresholds (top 2)
    for (const t of cat.thresholds.slice(0, 2)) {
      const directionStr = t.direction === 'optimal' ? 'set at' :
        t.direction === 'at_least' ? 'at least' :
        t.direction === 'at_most' ? 'at most' :
        t.direction === 'above' ? 'above' :
        t.direction === 'below' ? 'below' : '';
      output += `• ${t.metric}: ${directionStr} ${t.value}\n`;
    }

    output += '\n';
  }

  output += `**Bottom line**: ${bottomLine}\n`;

  output += `\n**INSTRUCTION FOR PROVIDING PRACTICAL IMPLICATIONS:**
1. Structure your answer with categorized recommendations (For Strategy:, For Risk Management:, etc.)
2. Use bullet points for actionable items
3. Include quantitative thresholds where available (e.g., "set stop-loss at 2-3%")
4. Reference evidence from the user's documents
5. End with a "Bottom line" synthesis
6. Do NOT just describe what's in the documents—provide actionable guidance`;

  return output;
}

/**
 * Detect if a query is asking for practical implications
 */
export function isImplicationsQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  const patterns = [
    /what\s+(?:does|do)\s+(?:this|these|it)\s+mean/i,
    /what\s+(?:are|is)\s+the\s+(?:implication|practical|takeaway)/i,
    /how\s+(?:should|can|do)\s+i\s+(?:apply|use|implement)/i,
    /what\s+(?:should|can)\s+i\s+(?:do|take away)/i,
    /(?:practical|actionable)\s+(?:advice|recommendation|guidance|implication)/i,
    /how\s+to\s+(?:apply|implement|use)/i,
    /(?:key|main)\s+(?:takeaway|recommendation|advice)/i,
    /what\s+(?:action|step)s?\s+should/i,
    /(?:bottom\s+line|in\s+practice|practically)/i,
    /(?:recommendation|suggest|advise)/i,
  ];

  return patterns.some(p => p.test(lowerQuery));
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^[,;:\s]+/, '')
    .replace(/[,;:\s]+$/, '');
}

function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function categorizeRecommendation(text: string): string {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(RECOMMENDATION_CATEGORIES)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return category;
    }
  }

  return 'Other';
}

function categorizeThreshold(metric: string): string {
  const lowerMetric = metric.toLowerCase();

  for (const [category, keywords] of Object.entries(RECOMMENDATION_CATEGORIES)) {
    if (keywords.some(kw => lowerMetric.includes(kw))) {
      return category;
    }
  }

  return 'Other';
}

function extractEvidenceFromContext(text: string, matchIndex: number, recText: string): string | undefined {
  // Look for numbers/percentages near the recommendation
  const contextStart = Math.max(0, matchIndex - 100);
  const contextEnd = Math.min(text.length, matchIndex + recText.length + 150);
  const context = text.substring(contextStart, contextEnd);

  // Look for percentage improvements
  const percentMatch = context.match(/(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?%)\s+(?:improvement|increase|decrease|reduction|better|higher|lower)/i);
  if (percentMatch) {
    return `${percentMatch[1]} improvement`;
  }

  // Look for comparisons
  const comparisonMatch = context.match(/(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?(?:x|%)?)\s+(?:better|faster|more efficient|higher|lower)/i);
  if (comparisonMatch) {
    return comparisonMatch[0];
  }

  return undefined;
}

function calculateRecommendationConfidence(
  text: string,
  strength: 'strong' | 'moderate' | 'weak',
  evidence?: string
): number {
  let confidence = strength === 'strong' ? 0.7 : strength === 'moderate' ? 0.5 : 0.3;

  // Increase for having evidence
  if (evidence) {
    confidence += 0.15;
  }

  // Increase for specific actionable verbs
  const actionableVerbs = ['implement', 'use', 'apply', 'set', 'configure', 'adjust', 'monitor', 'test'];
  if (actionableVerbs.some(v => text.toLowerCase().includes(v))) {
    confidence += 0.1;
  }

  // Decrease for vague language
  const vagueWords = ['maybe', 'perhaps', 'possibly', 'sometimes', 'might'];
  if (vagueWords.some(v => text.toLowerCase().includes(v))) {
    confidence -= 0.15;
  }

  return Math.min(1, Math.max(0, confidence));
}

function deduplicateRecommendations(recommendations: Recommendation[]): Recommendation[] {
  const unique: Recommendation[] = [];

  for (const rec of recommendations) {
    const isDuplicate = unique.some(existing =>
      calculateTextSimilarity(existing.text, rec.text) > 0.6
    );

    if (!isDuplicate) {
      unique.push(rec);
    }
  }

  return unique;
}

function normalizeForGrouping(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Main service class for practical implications extraction
 */
export class PracticalImplicationsService {
  /**
   * Process document chunks and extract all implications
   */
  processChunks(chunks: Array<{
    content: string;
    document_metadata: {
      documentId: string;
      filename: string;
      page?: number;
    };
  }>): {
    recommendations: Recommendation[];
    thresholds: QuantitativeThreshold[];
    bestPractices: BestPractice[];
  } {
    const allRecommendations: Recommendation[] = [];
    const allThresholds: QuantitativeThreshold[] = [];

    for (const chunk of chunks) {
      const text = chunk.content || '';
      const docId = chunk.document_metadata?.documentId || 'unknown';
      const docName = chunk.document_metadata?.filename || 'Unknown';
      const page = chunk.document_metadata?.page;

      // Extract recommendations
      const recommendations = extractRecommendations(text, docId, docName, page);
      allRecommendations.push(...recommendations);

      // Extract thresholds
      const thresholds = extractThresholds(text, docId, docName, page);
      allThresholds.push(...thresholds);
    }

    // Deduplicate
    const uniqueRecs = deduplicateRecommendations(allRecommendations);

    // Extract best practices (aggregated from recommendations)
    const bestPractices = extractBestPractices(uniqueRecs);

    return {
      recommendations: uniqueRecs,
      thresholds: allThresholds,
      bestPractices
    };
  }

  /**
   * Get practical implications context for a query
   */
  getImplicationsContext(
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
    isImplicationsQuery: boolean;
    categorizedImplications: CategorizedImplications[];
    bottomLine: string;
    promptAddition: string;
  } {
    const isImplications = isImplicationsQuery(query);

    // Process even if not explicitly an implications query
    // (useful context for many types of questions)
    const { recommendations, thresholds, bestPractices } = this.processChunks(chunks);

    console.log(`🔍 [IMPLICATIONS] Found ${recommendations.length} recommendations`);
    console.log(`🔍 [IMPLICATIONS] Found ${thresholds.length} quantitative thresholds`);
    console.log(`🔍 [IMPLICATIONS] Found ${bestPractices.length} best practices`);

    // Group by category
    const categorizedImplications = groupRecommendationsByCategory(
      recommendations,
      thresholds,
      bestPractices
    );

    // Count unique documents
    const uniqueDocs = new Set(chunks.map(c => c.document_metadata?.documentId)).size;

    // Synthesize bottom line
    const bottomLine = synthesizeBottomLine(categorizedImplications, uniqueDocs);

    // Build prompt addition
    let promptAddition = '';

    if (categorizedImplications.length > 0 && (isImplications || recommendations.length > 3)) {
      promptAddition = formatImplicationsForPrompt(categorizedImplications, bottomLine);
      console.log(`✅ [IMPLICATIONS] Added practical implications to prompt context`);
    }

    return {
      isImplicationsQuery: isImplications,
      categorizedImplications,
      bottomLine,
      promptAddition
    };
  }
}

// Export singleton instance
export const practicalImplicationsService = new PracticalImplicationsService();
export default practicalImplicationsService;
