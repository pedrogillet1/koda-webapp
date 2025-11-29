/**
 * Comparative Analysis Service
 *
 * PURPOSE: Extract and structure comparative information from documents to provide
 * rich, ChatGPT-style comparison tables and insights.
 *
 * PROBLEM SOLVED:
 * - OLD: "Compare reinforcement learning and portfolio optimization"
 *        → "You have 23 papers on reinforcement learning and 47 on portfolio optimization."
 * - NEW: "Compare reinforcement learning and portfolio optimization"
 *        → Structured comparison table with aspects, attributes, and key insights
 *
 * HOW IT WORKS:
 * 1. Extract comparison statements from documents ("unlike...", "compared to...", etc.)
 * 2. Extract attributes for each concept (approach, advantages, disadvantages, use cases)
 * 3. Build structured comparison tables
 * 4. Synthesize key insights from the comparison
 */

import NodeCache from 'node-cache';

// Cache for extracted comparative data (TTL: 1 hour)
const comparativeCache = new NodeCache({ stdTTL: 3600 });

/**
 * Represents a comparative statement extracted from a document
 */
export interface ComparativeStatement {
  concept1: string;           // First concept being compared
  concept2: string;           // Second concept being compared
  aspect: string;             // What aspect is being compared (e.g., "approach", "speed")
  statement1: string;         // What is said about concept1
  statement2: string;         // What is said about concept2
  pattern: string;            // The pattern matched (e.g., "unlike", "compared to")
  documentId: string;         // Source document ID
  documentName: string;       // Source document name
  page?: number;              // Page number if available
  rawText: string;            // Original text for context
  confidence: number;         // Confidence score (0-1)
}

/**
 * Represents attributes extracted for a concept
 */
export interface ConceptAttributes {
  concept: string;            // The concept name
  definition?: string;        // What it is
  approach?: string;          // How it works / methodology
  advantages: string[];       // Pros / benefits
  disadvantages: string[];    // Cons / limitations
  useCases: string[];         // When to use it
  characteristics: string[];  // Key characteristics
  relatedConcepts: string[];  // Related terms
  sources: Array<{            // Where this info was found
    documentId: string;
    documentName: string;
    page?: number;
  }>;
}

/**
 * Represents a structured comparison
 */
export interface StructuredComparison {
  concepts: string[];
  aspects: Array<{
    name: string;
    values: Map<string, string>;  // concept -> value
  }>;
  keyInsight: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    page?: number;
  }>;
}

/**
 * Patterns for extracting comparative statements
 */
const COMPARISON_PATTERNS: Array<{
  regex: RegExp;
  concept1Group: number;
  concept2Group: number;
  statement1Group?: number;
  statement2Group?: number;
  patternName: string;
}> = [
  // "Unlike X, Y uses/employs/relies on Z"
  {
    regex: /Unlike\s+(.{3,50}?),\s*(.{3,50}?)\s+(?:uses?|employs?|relies? on|is based on)\s+(.{5,150}?)(?:\.|,|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement2Group: 3,
    patternName: 'unlike'
  },
  // "While X is/uses Y, Z is/uses W"
  {
    regex: /While\s+(.{3,50}?)\s+(?:is|uses?|employs?|focuses on)\s+(.{5,100}?),\s*(.{3,50}?)\s+(?:is|uses?|employs?|focuses on)\s+(.{5,100}?)(?:\.|;|$)/gi,
    concept1Group: 1,
    statement1Group: 2,
    concept2Group: 3,
    statement2Group: 4,
    patternName: 'while'
  },
  // "Compared to X, Y offers/provides Z"
  {
    regex: /Compared to\s+(.{3,50}?),\s*(.{3,50}?)\s+(?:offers?|provides?|has|shows?|demonstrates?)\s+(.{5,150}?)(?:\.|,|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement2Group: 3,
    patternName: 'compared to'
  },
  // "X differs from Y in that Z"
  {
    regex: /(.{3,50}?)\s+differs?\s+from\s+(.{3,50}?)\s+(?:in that|because|by)\s+(.{5,150}?)(?:\.|,|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement1Group: 3,
    patternName: 'differs from'
  },
  // "X, unlike Y, uses/is Z"
  {
    regex: /(.{3,50}?),\s*unlike\s+(.{3,50}?),\s*(?:uses?|is|employs?|provides?)\s+(.{5,150}?)(?:\.|,|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement1Group: 3,
    patternName: 'x unlike y'
  },
  // "In contrast to X, Y does Z"
  {
    regex: /In contrast to\s+(.{3,50}?),\s*(.{3,50}?)\s+(?:does|uses?|provides?|offers?|is)\s+(.{5,150}?)(?:\.|,|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement2Group: 3,
    patternName: 'in contrast to'
  },
  // "X vs Y: X is A while Y is B" or "X versus Y"
  {
    regex: /(.{3,30}?)\s+(?:vs\.?|versus)\s+(.{3,30}?)(?:\s*:\s*|\s*-\s*)?(.{5,150}?)(?:\.|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement1Group: 3,
    patternName: 'vs'
  },
  // "The difference between X and Y is Z"
  {
    regex: /(?:The\s+)?difference\s+between\s+(.{3,50}?)\s+and\s+(.{3,50}?)\s+(?:is|lies in|concerns)\s+(.{5,150}?)(?:\.|,|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement1Group: 3,
    patternName: 'difference between'
  },
  // "X and Y differ in Z"
  {
    regex: /(.{3,50}?)\s+and\s+(.{3,50}?)\s+differ\s+(?:in|on|regarding)\s+(.{5,150}?)(?:\.|,|;|$)/gi,
    concept1Group: 1,
    concept2Group: 2,
    statement1Group: 3,
    patternName: 'differ in'
  },
  // "Although X uses A, Y prefers B"
  {
    regex: /Although\s+(.{3,50}?)\s+(?:uses?|employs?|relies? on)\s+(.{5,100}?),\s*(.{3,50}?)\s+(?:prefers?|uses?|employs?)\s+(.{5,100}?)(?:\.|;|$)/gi,
    concept1Group: 1,
    statement1Group: 2,
    concept2Group: 3,
    statement2Group: 4,
    patternName: 'although'
  },
];

/**
 * Patterns for extracting concept attributes
 */
const ATTRIBUTE_PATTERNS = {
  definition: [
    /(.{3,50}?)\s+(?:is defined as|is|refers to|means)\s+(.{10,200}?)(?:\.|;|$)/gi,
    /(?:Definition of\s+)?(.{3,50}?):\s*(.{10,200}?)(?:\.|;|$)/gi,
  ],
  approach: [
    /(.{3,50}?)\s+(?:uses?|employs?|works by|is based on|relies on)\s+(.{10,200}?)(?:\.|;|$)/gi,
    /(?:The\s+)?approach\s+(?:of|in)\s+(.{3,50}?)\s+(?:is|involves)\s+(.{10,200}?)(?:\.|;|$)/gi,
    /(.{3,50}?)\s+(?:approach|methodology|method)(?:\s+is)?\s*:\s*(.{10,200}?)(?:\.|;|$)/gi,
  ],
  advantages: [
    /(?:advantages?|benefits?|pros?|strengths?)\s+(?:of\s+)?(.{3,50}?)\s*(?:include|are|:)\s*(.{10,200}?)(?:\.|;|$)/gi,
    /(.{3,50}?)\s+(?:offers?|provides?|enables?|allows?)\s+(.{10,150}?)(?:\.|;|$)/gi,
    /(.{3,50}?)\s+is\s+(?:better|faster|more efficient|superior)\s+(?:at|for|in)\s+(.{10,150}?)(?:\.|;|$)/gi,
  ],
  disadvantages: [
    /(?:disadvantages?|drawbacks?|cons?|limitations?|weaknesses?)\s+(?:of\s+)?(.{3,50}?)\s*(?:include|are|:)\s*(.{10,200}?)(?:\.|;|$)/gi,
    /(.{3,50}?)\s+(?:lacks?|fails? to|struggles? with|cannot)\s+(.{10,150}?)(?:\.|;|$)/gi,
    /(?:However|But),?\s*(.{3,50}?)\s+(?:is|has|suffers from)\s+(.{10,150}?)(?:\.|;|$)/gi,
  ],
  useCases: [
    /(.{3,50}?)\s+is\s+(?:used for|applied to|suitable for|ideal for|best for)\s+(.{10,200}?)(?:\.|;|$)/gi,
    /(?:use cases?|applications?)\s+(?:of|for)\s+(.{3,50}?)\s*(?:include|are|:)\s*(.{10,200}?)(?:\.|;|$)/gi,
    /(.{3,50}?)\s+(?:can be used|is commonly used|is typically used)\s+(?:for|in|to)\s+(.{10,150}?)(?:\.|;|$)/gi,
  ],
  characteristics: [
    /(.{3,50}?)\s+is\s+characterized by\s+(.{10,200}?)(?:\.|;|$)/gi,
    /(?:key\s+)?(?:features?|characteristics?|properties)\s+of\s+(.{3,50}?)\s*(?:include|are|:)\s*(.{10,200}?)(?:\.|;|$)/gi,
    /(.{3,50}?)\s+(?:has|exhibits?|shows?)\s+(.{10,150}?)(?:\.|;|$)/gi,
  ],
};

/**
 * Standard comparison aspects to look for
 */
const COMPARISON_ASPECTS = [
  'approach',
  'methodology',
  'data requirements',
  'data',
  'complexity',
  'adaptability',
  'scalability',
  'performance',
  'speed',
  'accuracy',
  'cost',
  'ease of use',
  'interpretability',
  'flexibility',
  'robustness',
  'use cases',
  'applications',
  'advantages',
  'disadvantages',
  'limitations',
];

/**
 * Extract comparative statements from text
 */
export function extractComparativeStatements(
  text: string,
  documentId: string,
  documentName: string,
  targetConcepts?: string[],
  page?: number
): ComparativeStatement[] {
  const statements: ComparativeStatement[] = [];

  if (!text || text.length < 50) {
    return statements;
  }

  for (const pattern of COMPARISON_PATTERNS) {
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const concept1 = cleanText(match[pattern.concept1Group]);
      const concept2 = cleanText(match[pattern.concept2Group]);
      const statement1 = pattern.statement1Group ? cleanText(match[pattern.statement1Group]) : '';
      const statement2 = pattern.statement2Group ? cleanText(match[pattern.statement2Group]) : '';

      // Skip if concepts are too short or too long
      if (concept1.length < 2 || concept2.length < 2 || concept1.length > 60 || concept2.length > 60) {
        continue;
      }

      // If target concepts specified, check if this matches
      if (targetConcepts && targetConcepts.length > 0) {
        const matchesConcept1 = targetConcepts.some(tc =>
          concept1.toLowerCase().includes(tc.toLowerCase()) ||
          tc.toLowerCase().includes(concept1.toLowerCase())
        );
        const matchesConcept2 = targetConcepts.some(tc =>
          concept2.toLowerCase().includes(tc.toLowerCase()) ||
          tc.toLowerCase().includes(concept2.toLowerCase())
        );
        if (!matchesConcept1 && !matchesConcept2) {
          continue;
        }
      }

      // Detect aspect being compared
      const aspect = detectAspect(statement1 + ' ' + statement2);

      const confidence = calculateComparisonConfidence(concept1, concept2, statement1, statement2, pattern.patternName);

      if (confidence > 0.4) {
        statements.push({
          concept1,
          concept2,
          aspect,
          statement1,
          statement2,
          pattern: pattern.patternName,
          documentId,
          documentName,
          page,
          rawText: match[0].substring(0, 500),
          confidence,
        });
      }
    }
  }

  return deduplicateStatements(statements);
}

/**
 * Extract attributes for a specific concept from text
 */
export function extractConceptAttributes(
  concept: string,
  text: string,
  documentId: string,
  documentName: string,
  page?: number
): Partial<ConceptAttributes> {
  const attributes: Partial<ConceptAttributes> = {
    concept,
    advantages: [],
    disadvantages: [],
    useCases: [],
    characteristics: [],
    relatedConcepts: [],
    sources: [{ documentId, documentName, page }],
  };

  const conceptLower = concept.toLowerCase();

  // Check if text mentions the concept
  if (!text.toLowerCase().includes(conceptLower)) {
    return attributes;
  }

  // Extract definition
  for (const pattern of ATTRIBUTE_PATTERNS.definition) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1].toLowerCase().includes(conceptLower) || conceptLower.includes(match[1].toLowerCase())) {
        attributes.definition = cleanText(match[2]);
        break;
      }
    }
    if (attributes.definition) break;
  }

  // Extract approach
  for (const pattern of ATTRIBUTE_PATTERNS.approach) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1].toLowerCase().includes(conceptLower) || conceptLower.includes(match[1].toLowerCase())) {
        attributes.approach = cleanText(match[2]);
        break;
      }
    }
    if (attributes.approach) break;
  }

  // Extract advantages
  for (const pattern of ATTRIBUTE_PATTERNS.advantages) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1].toLowerCase().includes(conceptLower) || conceptLower.includes(match[1].toLowerCase())) {
        const advantage = cleanText(match[2]);
        if (advantage.length > 5 && !attributes.advantages!.includes(advantage)) {
          attributes.advantages!.push(advantage);
        }
      }
    }
  }

  // Extract disadvantages
  for (const pattern of ATTRIBUTE_PATTERNS.disadvantages) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1].toLowerCase().includes(conceptLower) || conceptLower.includes(match[1].toLowerCase())) {
        const disadvantage = cleanText(match[2]);
        if (disadvantage.length > 5 && !attributes.disadvantages!.includes(disadvantage)) {
          attributes.disadvantages!.push(disadvantage);
        }
      }
    }
  }

  // Extract use cases
  for (const pattern of ATTRIBUTE_PATTERNS.useCases) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1].toLowerCase().includes(conceptLower) || conceptLower.includes(match[1].toLowerCase())) {
        const useCase = cleanText(match[2]);
        if (useCase.length > 5 && !attributes.useCases!.includes(useCase)) {
          attributes.useCases!.push(useCase);
        }
      }
    }
  }

  // Extract characteristics
  for (const pattern of ATTRIBUTE_PATTERNS.characteristics) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1].toLowerCase().includes(conceptLower) || conceptLower.includes(match[1].toLowerCase())) {
        const characteristic = cleanText(match[2]);
        if (characteristic.length > 5 && !attributes.characteristics!.includes(characteristic)) {
          attributes.characteristics!.push(characteristic);
        }
      }
    }
  }

  return attributes;
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^[,;:\s]+/, '')
    .replace(/[,;:\s]+$/, '');
}

/**
 * Detect what aspect is being compared
 */
function detectAspect(text: string): string {
  const textLower = text.toLowerCase();

  for (const aspect of COMPARISON_ASPECTS) {
    if (textLower.includes(aspect)) {
      return aspect;
    }
  }

  // Try to infer aspect from keywords
  if (/\b(fast|slow|speed|time|quick)\b/i.test(textLower)) return 'speed';
  if (/\b(cost|expensive|cheap|price)\b/i.test(textLower)) return 'cost';
  if (/\b(accurate|accuracy|precise|precision)\b/i.test(textLower)) return 'accuracy';
  if (/\b(simple|complex|complicated|easy)\b/i.test(textLower)) return 'complexity';
  if (/\b(data|dataset|information|input)\b/i.test(textLower)) return 'data requirements';
  if (/\b(learn|adapt|train|update)\b/i.test(textLower)) return 'adaptability';
  if (/\b(scale|large|grow|expand)\b/i.test(textLower)) return 'scalability';
  if (/\b(use|apply|implement|deploy)\b/i.test(textLower)) return 'use cases';

  return 'general';
}

/**
 * Calculate confidence score for a comparative statement
 */
function calculateComparisonConfidence(
  concept1: string,
  concept2: string,
  statement1: string,
  statement2: string,
  pattern: string
): number {
  let confidence = 0.5;

  // Strong patterns get higher confidence
  const strongPatterns = ['unlike', 'compared to', 'in contrast to', 'while'];
  if (strongPatterns.includes(pattern)) {
    confidence += 0.2;
  }

  // Both statements present increases confidence
  if (statement1 && statement2) {
    confidence += 0.15;
  }

  // Longer, more specific statements increase confidence
  const totalLength = (statement1?.length || 0) + (statement2?.length || 0);
  if (totalLength > 50 && totalLength < 300) {
    confidence += 0.1;
  }

  // Decrease for very generic concepts
  const genericTerms = ['it', 'this', 'that', 'these', 'those', 'the former', 'the latter'];
  if (genericTerms.some(t => concept1.toLowerCase() === t || concept2.toLowerCase() === t)) {
    confidence -= 0.3;
  }

  return Math.min(1, Math.max(0, confidence));
}

/**
 * Deduplicate similar comparative statements
 */
function deduplicateStatements(statements: ComparativeStatement[]): ComparativeStatement[] {
  const unique: ComparativeStatement[] = [];

  for (const stmt of statements) {
    const isDuplicate = unique.some(existing => {
      const sameConceptPair =
        (existing.concept1.toLowerCase() === stmt.concept1.toLowerCase() &&
         existing.concept2.toLowerCase() === stmt.concept2.toLowerCase()) ||
        (existing.concept1.toLowerCase() === stmt.concept2.toLowerCase() &&
         existing.concept2.toLowerCase() === stmt.concept1.toLowerCase());

      if (!sameConceptPair) return false;

      // Same concept pair - check if statements are similar
      const similarity = calculateTextSimilarity(
        existing.statement1 + existing.statement2,
        stmt.statement1 + stmt.statement2
      );
      return similarity > 0.6;
    });

    if (!isDuplicate) {
      unique.push(stmt);
    }
  }

  return unique;
}

/**
 * Simple text similarity (Jaccard on words)
 */
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
 * Merge concept attributes from multiple sources
 */
export function mergeConceptAttributes(attributesList: Partial<ConceptAttributes>[]): ConceptAttributes {
  if (attributesList.length === 0) {
    return {
      concept: '',
      advantages: [],
      disadvantages: [],
      useCases: [],
      characteristics: [],
      relatedConcepts: [],
      sources: [],
    };
  }

  const merged: ConceptAttributes = {
    concept: attributesList[0].concept || '',
    definition: attributesList.find(a => a.definition)?.definition,
    approach: attributesList.find(a => a.approach)?.approach,
    advantages: [],
    disadvantages: [],
    useCases: [],
    characteristics: [],
    relatedConcepts: [],
    sources: [],
  };

  for (const attrs of attributesList) {
    if (attrs.advantages) {
      merged.advantages.push(...attrs.advantages.filter(a => !merged.advantages.includes(a)));
    }
    if (attrs.disadvantages) {
      merged.disadvantages.push(...attrs.disadvantages.filter(d => !merged.disadvantages.includes(d)));
    }
    if (attrs.useCases) {
      merged.useCases.push(...attrs.useCases.filter(u => !merged.useCases.includes(u)));
    }
    if (attrs.characteristics) {
      merged.characteristics.push(...attrs.characteristics.filter(c => !merged.characteristics.includes(c)));
    }
    if (attrs.sources) {
      merged.sources.push(...attrs.sources);
    }
  }

  // Limit arrays to prevent bloat
  merged.advantages = merged.advantages.slice(0, 5);
  merged.disadvantages = merged.disadvantages.slice(0, 5);
  merged.useCases = merged.useCases.slice(0, 5);
  merged.characteristics = merged.characteristics.slice(0, 5);

  return merged;
}

/**
 * Build a markdown comparison table
 */
export function buildComparisonTable(
  concept1Attrs: ConceptAttributes,
  concept2Attrs: ConceptAttributes,
  comparativeStatements: ComparativeStatement[]
): string {
  const c1 = concept1Attrs.concept;
  const c2 = concept2Attrs.concept;

  let table = `| Aspect | ${c1} | ${c2} |\n`;
  table += `|--------|${'-'.repeat(Math.max(c1.length, 6))}|${'-'.repeat(Math.max(c2.length, 6))}|\n`;

  // Add approach row
  if (concept1Attrs.approach || concept2Attrs.approach) {
    table += `| Approach | ${concept1Attrs.approach || 'N/A'} | ${concept2Attrs.approach || 'N/A'} |\n`;
  }

  // Add definition row if available
  if (concept1Attrs.definition || concept2Attrs.definition) {
    const def1 = truncateForTable(concept1Attrs.definition || 'N/A');
    const def2 = truncateForTable(concept2Attrs.definition || 'N/A');
    table += `| Definition | ${def1} | ${def2} |\n`;
  }

  // Add rows from comparative statements
  const aspectsAdded = new Set<string>(['approach', 'definition']);

  for (const stmt of comparativeStatements) {
    if (aspectsAdded.has(stmt.aspect)) continue;
    aspectsAdded.add(stmt.aspect);

    const val1 = stmt.concept1.toLowerCase().includes(c1.toLowerCase())
      ? truncateForTable(stmt.statement1 || stmt.statement2)
      : truncateForTable(stmt.statement2 || stmt.statement1);
    const val2 = stmt.concept2.toLowerCase().includes(c2.toLowerCase())
      ? truncateForTable(stmt.statement2 || stmt.statement1)
      : truncateForTable(stmt.statement1 || stmt.statement2);

    if (val1 || val2) {
      table += `| ${capitalize(stmt.aspect)} | ${val1 || 'N/A'} | ${val2 || 'N/A'} |\n`;
    }
  }

  // Add advantages if available
  if (concept1Attrs.advantages.length > 0 || concept2Attrs.advantages.length > 0) {
    const adv1 = concept1Attrs.advantages.slice(0, 2).join('; ') || 'N/A';
    const adv2 = concept2Attrs.advantages.slice(0, 2).join('; ') || 'N/A';
    table += `| Advantages | ${truncateForTable(adv1)} | ${truncateForTable(adv2)} |\n`;
  }

  // Add disadvantages if available
  if (concept1Attrs.disadvantages.length > 0 || concept2Attrs.disadvantages.length > 0) {
    const dis1 = concept1Attrs.disadvantages.slice(0, 2).join('; ') || 'N/A';
    const dis2 = concept2Attrs.disadvantages.slice(0, 2).join('; ') || 'N/A';
    table += `| Limitations | ${truncateForTable(dis1)} | ${truncateForTable(dis2)} |\n`;
  }

  // Add use cases if available
  if (concept1Attrs.useCases.length > 0 || concept2Attrs.useCases.length > 0) {
    const uc1 = concept1Attrs.useCases.slice(0, 2).join('; ') || 'N/A';
    const uc2 = concept2Attrs.useCases.slice(0, 2).join('; ') || 'N/A';
    table += `| Use Cases | ${truncateForTable(uc1)} | ${truncateForTable(uc2)} |\n`;
  }

  return table;
}

/**
 * Truncate text for table cell
 */
function truncateForTable(text: string, maxLength: number = 80): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Synthesize a key insight from the comparison
 */
export function synthesizeKeyInsight(
  concept1: string,
  concept2: string,
  comparativeStatements: ComparativeStatement[],
  concept1Attrs: ConceptAttributes,
  concept2Attrs: ConceptAttributes
): string {
  // Look for the most confident comparative statement
  const sortedStatements = [...comparativeStatements].sort((a, b) => b.confidence - a.confidence);

  if (sortedStatements.length > 0) {
    const topStmt = sortedStatements[0];

    // Build insight from the top statement
    if (topStmt.statement1 && topStmt.statement2) {
      return `${concept1} ${topStmt.statement1.toLowerCase()}, while ${concept2} ${topStmt.statement2.toLowerCase()}.`;
    } else if (topStmt.statement2) {
      return `Compared to ${concept1}, ${concept2} ${topStmt.statement2.toLowerCase()}.`;
    }
  }

  // Fallback: generate from attributes
  const insights: string[] = [];

  if (concept1Attrs.approach && concept2Attrs.approach) {
    insights.push(`${concept1} uses ${concept1Attrs.approach.toLowerCase()}, while ${concept2} employs ${concept2Attrs.approach.toLowerCase()}.`);
  }

  if (concept1Attrs.advantages.length > 0 && concept2Attrs.advantages.length > 0) {
    insights.push(`${concept1} excels at ${concept1Attrs.advantages[0].toLowerCase()}, whereas ${concept2} is better for ${concept2Attrs.advantages[0].toLowerCase()}.`);
  }

  if (insights.length > 0) {
    return insights[0];
  }

  return `Both ${concept1} and ${concept2} have distinct characteristics and use cases. Consider your specific requirements when choosing between them.`;
}

/**
 * Format comparison context for LLM prompt
 */
export function formatComparisonContextForPrompt(
  concepts: string[],
  comparativeStatements: ComparativeStatement[],
  conceptAttributesMap: Map<string, ConceptAttributes>
): string {
  if (concepts.length < 2) return '';

  let context = '\n\n**COMPARATIVE INTELLIGENCE (Use this to build comparison):**\n';

  // Add comparative statements
  if (comparativeStatements.length > 0) {
    context += '\n**Comparative Statements Found:**\n';
    comparativeStatements.slice(0, 8).forEach((stmt, idx) => {
      const sourceInfo = stmt.page ? `${stmt.documentName}, p.${stmt.page}` : stmt.documentName;
      context += `${idx + 1}. [${stmt.aspect}] "${stmt.rawText.substring(0, 150)}..." (Source: ${sourceInfo})\n`;
    });
  }

  // Add concept attributes
  context += '\n**Concept Attributes:**\n';
  for (const concept of concepts) {
    const attrs = conceptAttributesMap.get(concept.toLowerCase());
    if (attrs) {
      context += `\n*${concept}*:\n`;
      if (attrs.definition) context += `  - Definition: ${attrs.definition}\n`;
      if (attrs.approach) context += `  - Approach: ${attrs.approach}\n`;
      if (attrs.advantages.length > 0) context += `  - Advantages: ${attrs.advantages.slice(0, 3).join('; ')}\n`;
      if (attrs.disadvantages.length > 0) context += `  - Limitations: ${attrs.disadvantages.slice(0, 3).join('; ')}\n`;
      if (attrs.useCases.length > 0) context += `  - Use Cases: ${attrs.useCases.slice(0, 3).join('; ')}\n`;
    }
  }

  context += `\n**INSTRUCTION**: When answering this comparison question, use the comparative statements and concept attributes above to build a structured comparison table. Include:
1. A markdown table comparing key aspects
2. Specific differences and similarities
3. A key insight summarizing the main difference
4. If applicable, when to use each approach

Do NOT just list document counts. Provide actual comparative analysis based on the content.`;

  return context;
}

/**
 * Detect if query is a comparison query
 */
export function isComparisonQuery(query: string): boolean {
  const patterns = [
    /\bcompare\b/i,
    /\bdifference\b/i,
    /\bvs\.?\b/i,
    /\bversus\b/i,
    /\bbetween\b.*\band\b/i,
    /\bcontrast\b/i,
    /\bsimilarit/i,
    /\bdistinction/i,
    /\bcompared to\b/i,
  ];

  return patterns.some(p => p.test(query));
}

/**
 * Main service class for comparative analysis
 */
export class ComparativeAnalysisService {
  /**
   * Process document chunks and extract comparative information for given concepts
   */
  processChunksForComparison(
    concepts: string[],
    chunks: Array<{
      content: string;
      document_metadata: {
        documentId: string;
        filename: string;
        page?: number;
      };
    }>
  ): {
    comparativeStatements: ComparativeStatement[];
    conceptAttributesMap: Map<string, ConceptAttributes>;
  } {
    const allStatements: ComparativeStatement[] = [];
    const conceptAttributesLists: Map<string, Partial<ConceptAttributes>[]> = new Map();

    // Initialize lists for each concept
    for (const concept of concepts) {
      conceptAttributesLists.set(concept.toLowerCase(), []);
    }

    for (const chunk of chunks) {
      const text = chunk.content || '';
      const docId = chunk.document_metadata?.documentId || 'unknown';
      const docName = chunk.document_metadata?.filename || 'Unknown';
      const page = chunk.document_metadata?.page;

      // Extract comparative statements
      const statements = extractComparativeStatements(text, docId, docName, concepts, page);
      allStatements.push(...statements);

      // Extract attributes for each concept
      for (const concept of concepts) {
        const attrs = extractConceptAttributes(concept, text, docId, docName, page);
        const list = conceptAttributesLists.get(concept.toLowerCase());
        if (list) {
          list.push(attrs);
        }
      }
    }

    // Merge attributes for each concept
    const conceptAttributesMap = new Map<string, ConceptAttributes>();
    for (const [conceptKey, attrsList] of conceptAttributesLists) {
      const merged = mergeConceptAttributes(attrsList);
      // Find the original concept name (with proper casing)
      const originalConcept = concepts.find(c => c.toLowerCase() === conceptKey) || conceptKey;
      merged.concept = originalConcept;
      conceptAttributesMap.set(conceptKey, merged);
    }

    return {
      comparativeStatements: deduplicateStatements(allStatements),
      conceptAttributesMap,
    };
  }

  /**
   * Get comparison context for a query
   */
  getComparisonContext(
    query: string,
    concepts: string[],
    chunks: Array<{
      content: string;
      document_metadata: {
        documentId: string;
        filename: string;
        page?: number;
      };
    }>
  ): {
    isComparison: boolean;
    concepts: string[];
    comparativeStatements: ComparativeStatement[];
    conceptAttributesMap: Map<string, ConceptAttributes>;
    comparisonTable: string;
    keyInsight: string;
    promptAddition: string;
  } {
    const isComparison = isComparisonQuery(query);

    if (!isComparison || concepts.length < 2) {
      return {
        isComparison: false,
        concepts: [],
        comparativeStatements: [],
        conceptAttributesMap: new Map(),
        comparisonTable: '',
        keyInsight: '',
        promptAddition: '',
      };
    }

    console.log(`🔍 [COMPARATIVE ANALYSIS] Processing ${concepts.length} concepts: ${concepts.join(' vs ')}`);

    const { comparativeStatements, conceptAttributesMap } = this.processChunksForComparison(concepts, chunks);

    console.log(`🔍 [COMPARATIVE ANALYSIS] Found ${comparativeStatements.length} comparative statements`);
    console.log(`🔍 [COMPARATIVE ANALYSIS] Extracted attributes for ${conceptAttributesMap.size} concepts`);

    // Build comparison table
    let comparisonTable = '';
    let keyInsight = '';

    if (concepts.length >= 2) {
      const c1Attrs = conceptAttributesMap.get(concepts[0].toLowerCase()) || {
        concept: concepts[0],
        advantages: [],
        disadvantages: [],
        useCases: [],
        characteristics: [],
        relatedConcepts: [],
        sources: [],
      };
      const c2Attrs = conceptAttributesMap.get(concepts[1].toLowerCase()) || {
        concept: concepts[1],
        advantages: [],
        disadvantages: [],
        useCases: [],
        characteristics: [],
        relatedConcepts: [],
        sources: [],
      };

      comparisonTable = buildComparisonTable(c1Attrs, c2Attrs, comparativeStatements);
      keyInsight = synthesizeKeyInsight(concepts[0], concepts[1], comparativeStatements, c1Attrs, c2Attrs);
    }

    // Build prompt addition
    const promptAddition = formatComparisonContextForPrompt(concepts, comparativeStatements, conceptAttributesMap);

    return {
      isComparison: true,
      concepts,
      comparativeStatements,
      conceptAttributesMap,
      comparisonTable,
      keyInsight,
      promptAddition,
    };
  }
}

// Export singleton instance
export const comparativeAnalysisService = new ComparativeAnalysisService();
export default comparativeAnalysisService;
