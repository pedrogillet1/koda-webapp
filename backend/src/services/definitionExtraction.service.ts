/**
 * Definition Extraction Service
 *
 * PURPOSE: Extract conceptual definitions from documents during processing
 * WHY: Enable Koda to explain concepts using the user's own documents
 * HOW: Pattern matching + LLM extraction of definitions and explanations
 * IMPACT: Transform "mentioned in 23 papers" → actual conceptual understanding
 *
 * Extracted Data:
 * - Definitions ("X is defined as...", "X refers to...")
 * - Explanations ("In other words...", "This means...")
 * - Examples ("For example...", "Such as...")
 * - Relationships ("X is a type of Y", "X is related to Y")
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractedDefinition {
  term: string;              // The concept being defined (e.g., "reinforcement learning")
  definition: string;        // The actual definition
  type: 'explicit' | 'implicit' | 'example';  // How the definition was expressed
  confidence: number;        // 0-1 confidence score
  sourceContext: string;     // Surrounding text for citation
  documentId?: string;       // Document it came from
  page?: number;             // Page number if available
}

export interface ExtractedExplanation {
  concept: string;           // What's being explained
  explanation: string;       // The explanation text
  type: 'analogy' | 'example' | 'clarification' | 'process';
  confidence: number;
  sourceContext: string;
  documentId?: string;
}

export interface ConceptRelationship {
  concept1: string;          // First concept
  concept2: string;          // Second concept
  relationship: string;      // Type of relationship (is_a, part_of, related_to, etc.)
  confidence: number;
  sourceContext: string;
  documentId?: string;
}

export interface ExtractionResult {
  definitions: ExtractedDefinition[];
  explanations: ExtractedExplanation[];
  relationships: ConceptRelationship[];
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFINITION PATTERNS - Regex patterns for common definition structures
// ═══════════════════════════════════════════════════════════════════════════════

// Pattern matching for explicit definitions
const DEFINITION_PATTERNS = [
  // "X is defined as Y"
  /(?:^|\. )([A-Z][a-zA-Z\s\-]+?)\s+(?:is|are)\s+defined\s+as\s+([^.!?]+[.!?])/gi,

  // "X refers to Y"
  /(?:^|\. )([A-Z][a-zA-Z\s\-]+?)\s+refers?\s+to\s+([^.!?]+[.!?])/gi,

  // "X is a type/form/method of Y"
  /(?:^|\. )([A-Z][a-zA-Z\s\-]+?)\s+(?:is|are)\s+a\s+(?:type|form|method|kind|class|category)\s+of\s+([^.!?]+[.!?])/gi,

  // "X means Y"
  /(?:^|\. )([A-Z][a-zA-Z\s\-]+?)\s+means?\s+([^.!?]+[.!?])/gi,

  // "X, which is Y"
  /([A-Z][a-zA-Z\s\-]+?),\s+which\s+(?:is|are)\s+([^,]+)/gi,

  // "X (i.e., Y)" or "X (that is, Y)"
  /([A-Z][a-zA-Z\s\-]+?)\s+\((?:i\.e\.|that is|namely),?\s*([^)]+)\)/gi,

  // "The term X describes Y"
  /(?:The\s+term\s+)?([A-Za-z][a-zA-Z\s\-]+?)\s+describes?\s+([^.!?]+[.!?])/gi,

  // "X can be understood as Y"
  /([A-Z][a-zA-Z\s\-]+?)\s+can\s+be\s+understood\s+as\s+([^.!?]+[.!?])/gi,
];

// Pattern matching for explanations
const EXPLANATION_PATTERNS = [
  // "In other words, X"
  /[.!?]\s*In\s+other\s+words,?\s+([^.!?]+[.!?])/gi,

  // "This means X"
  /[.!?]\s*This\s+means\s+(?:that\s+)?([^.!?]+[.!?])/gi,

  // "Put simply, X" or "Simply put, X"
  /(?:Put\s+simply|Simply\s+put),?\s+([^.!?]+[.!?])/gi,

  // "For example, X"
  /[.!?]\s*For\s+example,?\s+([^.!?]+[.!?])/gi,

  // "Such as X"
  /such\s+as\s+([^.!?]+)/gi,

  // "To illustrate, X"
  /To\s+illustrate,?\s+([^.!?]+[.!?])/gi,
];

// Pattern matching for relationships
const RELATIONSHIP_PATTERNS = [
  // "X is a type/kind of Y"
  /([A-Za-z][a-zA-Z\s\-]+?)\s+(?:is|are)\s+a\s+(?:type|kind|form)\s+of\s+([a-zA-Z\s\-]+)/gi,

  // "X is part of Y"
  /([A-Za-z][a-zA-Z\s\-]+?)\s+(?:is|are)\s+(?:a\s+)?part\s+of\s+([a-zA-Z\s\-]+)/gi,

  // "X is related to Y"
  /([A-Za-z][a-zA-Z\s\-]+?)\s+(?:is|are)\s+(?:closely\s+)?related\s+to\s+([a-zA-Z\s\-]+)/gi,

  // "X includes Y"
  /([A-Za-z][a-zA-Z\s\-]+?)\s+includes?\s+([a-zA-Z\s\-,]+)/gi,

  // "X consists of Y"
  /([A-Za-z][a-zA-Z\s\-]+?)\s+consists?\s+of\s+([a-zA-Z\s\-,]+)/gi,
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEFINITION EXTRACTION SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class DefinitionExtractionService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1, // Low temperature for accurate extraction
          maxOutputTokens: 4096,
        }
      });
    }
  }

  /**
   * Main extraction method - extract all definitions from document text
   *
   * @param text - Document text to extract from
   * @param documentId - ID of the source document
   * @param useLLM - Whether to use LLM for enhanced extraction (default: true)
   * @returns ExtractionResult with all extracted knowledge
   */
  async extractFromDocument(
    text: string,
    documentId?: string,
    useLLM: boolean = true
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    console.log(`📚 [DEFINITION] Starting extraction from document ${documentId || 'unknown'}`);

    // Step 1: Pattern-based extraction (fast, always runs)
    const patternDefinitions = this.extractDefinitionsWithPatterns(text);
    const patternExplanations = this.extractExplanationsWithPatterns(text);
    const patternRelationships = this.extractRelationshipsWithPatterns(text);

    console.log(`   📝 Pattern extraction: ${patternDefinitions.length} definitions, ${patternExplanations.length} explanations, ${patternRelationships.length} relationships`);

    // Step 2: LLM-enhanced extraction (more accurate, optional)
    let llmDefinitions: ExtractedDefinition[] = [];
    let llmExplanations: ExtractedExplanation[] = [];
    let llmRelationships: ConceptRelationship[] = [];

    if (useLLM && this.model && text.length > 500 && text.length < 100000) {
      try {
        const llmResults = await this.extractWithLLM(text, documentId);
        llmDefinitions = llmResults.definitions;
        llmExplanations = llmResults.explanations;
        llmRelationships = llmResults.relationships;

        console.log(`   🤖 LLM extraction: ${llmDefinitions.length} definitions, ${llmExplanations.length} explanations, ${llmRelationships.length} relationships`);
      } catch (error) {
        console.warn(`   ⚠️ LLM extraction failed, using pattern-only results:`, error);
      }
    }

    // Step 3: Merge and deduplicate results
    const mergedDefinitions = this.mergeDefinitions([...patternDefinitions, ...llmDefinitions]);
    const mergedExplanations = this.mergeExplanations([...patternExplanations, ...llmExplanations]);
    const mergedRelationships = this.mergeRelationships([...patternRelationships, ...llmRelationships]);

    // Add document ID to all results
    if (documentId) {
      mergedDefinitions.forEach(d => d.documentId = documentId);
      mergedExplanations.forEach(e => e.documentId = documentId);
      mergedRelationships.forEach(r => r.documentId = documentId);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ [DEFINITION] Extraction complete in ${processingTime}ms: ${mergedDefinitions.length} definitions, ${mergedExplanations.length} explanations, ${mergedRelationships.length} relationships`);

    return {
      definitions: mergedDefinitions,
      explanations: mergedExplanations,
      relationships: mergedRelationships,
      processingTime,
    };
  }

  /**
   * Extract definitions using regex patterns
   */
  private extractDefinitionsWithPatterns(text: string): ExtractedDefinition[] {
    const definitions: ExtractedDefinition[] = [];

    for (const pattern of DEFINITION_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const term = this.cleanTerm(match[1]);
        const definition = this.cleanDefinition(match[2]);

        // Skip if term is too short or too long
        if (term.length < 3 || term.length > 100) continue;
        if (definition.length < 10 || definition.length > 500) continue;

        // Skip common false positives
        if (this.isCommonWord(term)) continue;

        definitions.push({
          term: term,
          definition: definition,
          type: 'explicit',
          confidence: 0.8,
          sourceContext: this.getContext(text, match.index, 200),
        });
      }
    }

    return definitions;
  }

  /**
   * Extract explanations using regex patterns
   */
  private extractExplanationsWithPatterns(text: string): ExtractedExplanation[] {
    const explanations: ExtractedExplanation[] = [];

    for (const pattern of EXPLANATION_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const explanation = this.cleanDefinition(match[1]);

        if (explanation.length < 20 || explanation.length > 500) continue;

        // Try to find what concept this explanation relates to
        const concept = this.findNearestConcept(text, match.index);

        explanations.push({
          concept: concept || 'previous topic',
          explanation: explanation,
          type: pattern.source.includes('example') ? 'example' : 'clarification',
          confidence: 0.7,
          sourceContext: this.getContext(text, match.index, 200),
        });
      }
    }

    return explanations;
  }

  /**
   * Extract relationships using regex patterns
   */
  private extractRelationshipsWithPatterns(text: string): ConceptRelationship[] {
    const relationships: ConceptRelationship[] = [];

    for (const pattern of RELATIONSHIP_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const concept1 = this.cleanTerm(match[1]);
        const concept2 = this.cleanTerm(match[2]);

        if (concept1.length < 3 || concept2.length < 3) continue;
        if (this.isCommonWord(concept1) || this.isCommonWord(concept2)) continue;

        // Determine relationship type from pattern
        let relationship = 'related_to';
        if (pattern.source.includes('type|kind|form')) relationship = 'is_a';
        else if (pattern.source.includes('part')) relationship = 'part_of';
        else if (pattern.source.includes('includes') || pattern.source.includes('consists')) relationship = 'contains';

        relationships.push({
          concept1,
          concept2,
          relationship,
          confidence: 0.7,
          sourceContext: this.getContext(text, match.index, 200),
        });
      }
    }

    return relationships;
  }

  /**
   * Use LLM for enhanced definition extraction
   */
  private async extractWithLLM(text: string, documentId?: string): Promise<ExtractionResult> {
    // Truncate text if too long (keep first 50K chars for analysis)
    const truncatedText = text.length > 50000 ? text.substring(0, 50000) + '...' : text;

    const prompt = `Analyze this document and extract:

1. **Definitions**: Concepts that are explicitly or implicitly defined
2. **Explanations**: Clarifications, examples, or analogies that explain concepts
3. **Relationships**: How concepts relate to each other (is_a, part_of, related_to)

Document text:
"""
${truncatedText}
"""

Return ONLY a valid JSON object with this exact structure:
{
  "definitions": [
    {"term": "concept name", "definition": "the definition text", "type": "explicit|implicit|example", "confidence": 0.0-1.0}
  ],
  "explanations": [
    {"concept": "what is explained", "explanation": "the explanation", "type": "analogy|example|clarification|process", "confidence": 0.0-1.0}
  ],
  "relationships": [
    {"concept1": "first concept", "concept2": "second concept", "relationship": "is_a|part_of|related_to|contains", "confidence": 0.0-1.0}
  ]
}

Rules:
- Only extract definitions that are clearly stated in the text
- Prefer explicit definitions over inferred ones
- Keep definitions concise (1-2 sentences)
- Focus on domain-specific terms, not common words
- Return empty arrays if nothing found
- Confidence should reflect how clearly the definition is stated`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON from response
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      return {
        definitions: (parsed.definitions || []).map((d: any) => ({
          ...d,
          sourceContext: '',
          documentId,
        })),
        explanations: (parsed.explanations || []).map((e: any) => ({
          ...e,
          sourceContext: '',
          documentId,
        })),
        relationships: (parsed.relationships || []).map((r: any) => ({
          ...r,
          sourceContext: '',
          documentId,
        })),
        processingTime: 0,
      };
    } catch (error) {
      console.error('❌ [DEFINITION] LLM extraction error:', error);
      return { definitions: [], explanations: [], relationships: [], processingTime: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private cleanTerm(term: string): string {
    return term.trim()
      .replace(/^the\s+/i, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private cleanDefinition(definition: string): string {
    return definition.trim()
      .replace(/\s+/g, ' ')
      .replace(/^[,.\s]+/, '')
      .replace(/[,.\s]+$/, '');
  }

  private getContext(text: string, position: number, contextLength: number): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    return text.substring(start, end).replace(/\s+/g, ' ').trim();
  }

  private findNearestConcept(text: string, position: number): string | null {
    // Look backwards from position to find a capitalized term
    const searchText = text.substring(Math.max(0, position - 200), position);
    const match = searchText.match(/([A-Z][a-zA-Z\s\-]+?)(?:\.|,|;|:|\s+is|\s+are|\s+means|\s+refers)/);
    return match ? this.cleanTerm(match[1]) : null;
  }

  private isCommonWord(term: string): boolean {
    const commonWords = new Set([
      'the', 'this', 'that', 'these', 'those', 'it', 'they', 'we', 'you', 'he', 'she',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'any',
      'first', 'second', 'third', 'last', 'new', 'old', 'many', 'much', 'such',
      'our', 'your', 'their', 'his', 'her', 'its', 'one', 'two', 'three',
      'way', 'thing', 'something', 'anything', 'everything', 'nothing',
      'time', 'year', 'day', 'number', 'part', 'place', 'case', 'point',
      'company', 'system', 'program', 'problem', 'fact', 'group', 'country',
      'result', 'process', 'study', 'work', 'life', 'world', 'example',
    ]);

    return commonWords.has(term.toLowerCase());
  }

  private mergeDefinitions(definitions: ExtractedDefinition[]): ExtractedDefinition[] {
    const merged = new Map<string, ExtractedDefinition>();

    for (const def of definitions) {
      const key = def.term.toLowerCase();
      const existing = merged.get(key);

      if (!existing || def.confidence > existing.confidence) {
        merged.set(key, def);
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
  }

  private mergeExplanations(explanations: ExtractedExplanation[]): ExtractedExplanation[] {
    // Deduplicate by explanation text similarity
    const unique: ExtractedExplanation[] = [];

    for (const exp of explanations) {
      const isDuplicate = unique.some(e =>
        this.textSimilarity(e.explanation, exp.explanation) > 0.8
      );

      if (!isDuplicate) {
        unique.push(exp);
      }
    }

    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  private mergeRelationships(relationships: ConceptRelationship[]): ConceptRelationship[] {
    const merged = new Map<string, ConceptRelationship>();

    for (const rel of relationships) {
      const key = `${rel.concept1}-${rel.relationship}-${rel.concept2}`.toLowerCase();
      const existing = merged.get(key);

      if (!existing || rel.confidence > existing.confidence) {
        merged.set(key, rel);
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
  }

  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) intersection++;
    }

    const union = words1.size + words2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Find definition for a specific concept across all stored definitions
   * Used by RAG service to answer "what is X?" questions
   */
  async findDefinition(
    term: string,
    definitions: ExtractedDefinition[]
  ): Promise<ExtractedDefinition | null> {
    const normalizedTerm = term.toLowerCase().trim();

    // Exact match
    let match = definitions.find(d => d.term.toLowerCase() === normalizedTerm);
    if (match) return match;

    // Partial match (term contains or is contained in)
    match = definitions.find(d =>
      d.term.toLowerCase().includes(normalizedTerm) ||
      normalizedTerm.includes(d.term.toLowerCase())
    );
    if (match) return match;

    // Fuzzy match using word overlap
    const termWords = new Set(normalizedTerm.split(/\s+/));
    let bestMatch: ExtractedDefinition | null = null;
    let bestScore = 0;

    for (const def of definitions) {
      const defWords = new Set(def.term.toLowerCase().split(/\s+/));
      let overlap = 0;
      for (const word of termWords) {
        if (defWords.has(word)) overlap++;
      }
      const score = overlap / Math.max(termWords.size, defWords.size);

      if (score > 0.5 && score > bestScore) {
        bestScore = score;
        bestMatch = def;
      }
    }

    return bestMatch;
  }

  /**
   * Build conceptual answer for "what is X?" queries
   * Combines definition + explanation + relationships
   */
  buildConceptualAnswer(
    term: string,
    definition: ExtractedDefinition | null,
    explanations: ExtractedExplanation[],
    relationships: ConceptRelationship[]
  ): string {
    const parts: string[] = [];

    if (definition) {
      parts.push(`**${definition.term}** ${definition.definition}`);
    }

    // Add related explanations
    const relevantExplanations = explanations.filter(e =>
      e.concept.toLowerCase().includes(term.toLowerCase()) ||
      term.toLowerCase().includes(e.concept.toLowerCase())
    );

    if (relevantExplanations.length > 0) {
      parts.push('');
      relevantExplanations.slice(0, 2).forEach(e => {
        parts.push(e.explanation);
      });
    }

    // Add relationships
    const relevantRelationships = relationships.filter(r =>
      r.concept1.toLowerCase().includes(term.toLowerCase()) ||
      r.concept2.toLowerCase().includes(term.toLowerCase())
    );

    if (relevantRelationships.length > 0) {
      const relParts = relevantRelationships.slice(0, 3).map(r => {
        if (r.relationship === 'is_a') {
          return `${r.concept1} is a type of ${r.concept2}`;
        } else if (r.relationship === 'part_of') {
          return `${r.concept1} is part of ${r.concept2}`;
        } else if (r.relationship === 'contains') {
          return `${r.concept1} includes ${r.concept2}`;
        } else {
          return `${r.concept1} is related to ${r.concept2}`;
        }
      });

      if (relParts.length > 0) {
        parts.push('');
        parts.push(relParts.join('. ') + '.');
      }
    }

    return parts.join('\n');
  }
}

// Export singleton instance
export const definitionExtractionService = new DefinitionExtractionService();
export default definitionExtractionService;
