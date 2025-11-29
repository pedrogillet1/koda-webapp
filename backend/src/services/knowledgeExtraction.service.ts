/**
 * Knowledge Extraction Service
 *
 * PURPOSE: Extract all types of knowledge from documents during indexing
 * WHY: Enable ChatGPT-level intelligence by building a knowledge graph
 * HOW: Pattern matching + LLM extraction for definitions, methodologies, causal relationships
 *
 * Knowledge Types Extracted:
 * 1. Definitions: "X is defined as...", "X refers to..."
 * 2. Methodologies: "we use...", "this paper proposes..."
 * 3. Causal Relationships: "X because Y", "X due to Y"
 * 4. Comparative Statements: "Unlike X, Y...", "Compared to X..."
 *
 * Example:
 * Input: "Mean-variance optimization is defined as a mathematical framework..."
 * Output: { term: "Mean-variance optimization", definition: "a mathematical framework..." }
 */

import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractedDefinition {
  term: string;
  definition: string;
  confidence: number;
}

export interface ExtractedMethodology {
  name: string;
  description: string;
  isPrimary: boolean;
  confidence: number;
}

export interface ExtractedCausalRelationship {
  cause: string;
  effect: string;
  confidence: number;
}

export interface ExtractedComparison {
  conceptA: string;
  conceptB: string;
  aspect: string;
  relationship: string;
  confidence: number;
}

export interface KnowledgeExtractionResult {
  definitions: ExtractedDefinition[];
  methodologies: ExtractedMethodology[];
  causalRelationships: ExtractedCausalRelationship[];
  comparisons: ExtractedComparison[];
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFINITION_PATTERNS = [
  // "X is defined as Y"
  /([A-Z][a-zA-Z\s\-]+?) is defined as ([^.]+)\./gi,
  // "X refers to Y"
  /([A-Z][a-zA-Z\s\-]+?) refers to ([^.]+)\./gi,
  // "X is a type/form/method of Y"
  /([A-Z][a-zA-Z\s\-]+?) is a (?:type|form|kind|method|technique|approach) of ([^.]+)\./gi,
  // "X means Y"
  /([A-Z][a-zA-Z\s\-]+?) means ([^.]+)\./gi,
  // "X can be defined as Y"
  /([A-Z][a-zA-Z\s\-]+?) can be defined as ([^.]+)\./gi,
  // "We define X as Y"
  /[Ww]e define ([a-zA-Z\s\-]+?) as ([^.]+)\./gi,
  // "X, which is Y" (parenthetical definitions)
  /([A-Z][a-zA-Z\s\-]+?), which (?:is|refers to|means) ([^,]+)[,\.]/gi,
  // "X (also known as Y)"
  /([A-Z][a-zA-Z\s\-]+?) \(also (?:known|called|referred to) as ([^)]+)\)/gi,
];

const METHODOLOGY_PATTERNS = [
  // "we use/employ/apply X to/for Y"
  /(?:we|this paper|this study|the authors?) (?:use|uses|employ|employs|apply|applies) ([a-zA-Z\s\-]+?) (?:to|for) ([^.]+)\./gi,
  // "our method/approach uses X"
  /(?:our|the) (?:method|approach|technique|algorithm|framework|model) (?:is|uses|employs|applies|relies on) ([^.]+)\./gi,
  // "this paper proposes X"
  /this (?:paper|study|work|research) proposes ([^.]+)\./gi,
  // "we propose X"
  /[Ww]e propose (?:a |an |the )?([^.]+)\./gi,
  // "X is used to Y"
  /([A-Z][a-zA-Z\s\-]+?) is used to ([^.]+)\./gi,
  // "using X, we Y"
  /[Uu]sing ([a-zA-Z\s\-]+?), (?:we|the authors?) ([^.]+)\./gi,
  // "X method/technique/approach"
  /the ([a-zA-Z\s\-]+?) (?:method|technique|approach|algorithm|framework) (?:is|was) (?:used|employed|applied)/gi,
  // "based on X"
  /(?:based on|building on|extending) (?:the )?([a-zA-Z\s\-]+?) (?:method|approach|framework|model)/gi,
];

const CAUSAL_PATTERNS = [
  // "X because Y"
  /([^.]+?) because ([^.]+)\./gi,
  // "X due to Y"
  /([^.]+?) due to ([^.]+)\./gi,
  // "X caused by Y"
  /([^.]+?) (?:is |are |was |were )?caused by ([^.]+)\./gi,
  // "X as a result of Y"
  /([^.]+?) as a result of ([^.]+)\./gi,
  // "X resulting from Y"
  /([^.]+?) resulting from ([^.]+)\./gi,
  // "The reason X is Y"
  /[Tt]he reason (?:for |why )?([^.]+?) is (?:that |because )?([^.]+)\./gi,
  // "X leads to Y"
  /([^.]+?) leads to ([^.]+)\./gi,
  // "X results in Y"
  /([^.]+?) results in ([^.]+)\./gi,
  // "X therefore Y"
  /([^.]+?), therefore,? ([^.]+)\./gi,
  // "X hence Y"
  /([^.]+?), hence,? ([^.]+)\./gi,
];

const COMPARISON_PATTERNS = [
  // "Unlike X, Y uses Z"
  /[Uu]nlike ([a-zA-Z\s\-]+?), ([a-zA-Z\s\-]+?) (?:uses|employs|is|has) ([^.]+)\./gi,
  // "While X is/uses A, Y is/uses B"
  /[Ww]hile ([a-zA-Z\s\-]+?) (?:is|uses|employs) ([^,]+), ([a-zA-Z\s\-]+?) (?:is|uses|employs) ([^.]+)\./gi,
  // "Compared to X, Y offers/provides Z"
  /[Cc]ompared to ([a-zA-Z\s\-]+?), ([a-zA-Z\s\-]+?) (?:offers|provides|has|is) ([^.]+)\./gi,
  // "X outperforms Y"
  /([a-zA-Z\s\-]+?) outperforms ([a-zA-Z\s\-]+?) (?:in|on|by) ([^.]+)\./gi,
  // "X is more/less Y than Z"
  /([a-zA-Z\s\-]+?) is (?:more|less) ([a-zA-Z]+) than ([a-zA-Z\s\-]+)/gi,
  // "X vs Y"
  /([a-zA-Z\s\-]+?) (?:vs\.?|versus) ([a-zA-Z\s\-]+?)[:\s]+([^.]+)\./gi,
  // "In contrast to X, Y"
  /[Ii]n contrast to ([a-zA-Z\s\-]+?), ([a-zA-Z\s\-]+?) ([^.]+)\./gi,
];

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE EXTRACTION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class KnowledgeExtractionService {
  /**
   * Extract all knowledge from a document during indexing
   */
  async extractKnowledge(
    documentId: string,
    content: string,
    userId: string
  ): Promise<KnowledgeExtractionResult> {
    const startTime = Date.now();
    console.log(`📚 [KNOWLEDGE] Extracting knowledge from document ${documentId}`);

    // Extract all knowledge types in parallel
    const [definitions, methodologies, causalRels, comparisons] = await Promise.all([
      this.extractDefinitions(content),
      this.extractMethodologies(content),
      this.extractCausalRelationships(content),
      this.extractComparisons(content),
    ]);

    // Store extracted knowledge in database
    await Promise.all([
      this.storeDefinitions(definitions, documentId, userId),
      this.storeMethodologies(methodologies, documentId, userId),
      this.storeCausalRelationships(causalRels, documentId, userId),
      this.storeComparisons(comparisons, documentId, userId),
    ]);

    const processingTime = Date.now() - startTime;

    console.log(`✅ [KNOWLEDGE] Extracted in ${processingTime}ms:`);
    console.log(`   - ${definitions.length} definitions`);
    console.log(`   - ${methodologies.length} methodologies`);
    console.log(`   - ${causalRels.length} causal relationships`);
    console.log(`   - ${comparisons.length} comparisons`);

    return {
      definitions,
      methodologies,
      causalRelationships: causalRels,
      comparisons,
      processingTime,
    };
  }

  /**
   * Extract definitions from text
   */
  private extractDefinitions(content: string): ExtractedDefinition[] {
    const definitions: ExtractedDefinition[] = [];
    const seen = new Set<string>();

    for (const pattern of DEFINITION_PATTERNS) {
      // Reset pattern lastIndex for each iteration
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const term = this.cleanTerm(match[1]);
        const definition = this.cleanDefinition(match[2]);

        // Skip if already seen or too short
        if (seen.has(term.toLowerCase()) || term.length < 3 || definition.length < 10) {
          continue;
        }

        seen.add(term.toLowerCase());
        definitions.push({
          term,
          definition,
          confidence: this.calculateConfidence(term, definition),
        });
      }
    }

    return definitions;
  }

  /**
   * Extract methodologies from text
   */
  private extractMethodologies(content: string): ExtractedMethodology[] {
    const methodologies: ExtractedMethodology[] = [];
    const seen = new Set<string>();

    for (const pattern of METHODOLOGY_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = this.cleanTerm(match[1]);
        const description = match[2] ? this.cleanDefinition(match[2]) : '';

        // Skip if already seen or too short
        if (seen.has(name.toLowerCase()) || name.length < 3) {
          continue;
        }

        // Check if this is a primary methodology (appears early or is emphasized)
        const isPrimary = this.isPrimaryMethodology(name, content);

        seen.add(name.toLowerCase());
        methodologies.push({
          name,
          description,
          isPrimary,
          confidence: this.calculateConfidence(name, description),
        });
      }
    }

    return methodologies;
  }

  /**
   * Extract causal relationships from text
   */
  private extractCausalRelationships(content: string): ExtractedCausalRelationship[] {
    const relationships: ExtractedCausalRelationship[] = [];
    const seen = new Set<string>();

    for (const pattern of CAUSAL_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const effect = this.cleanDefinition(match[1]);
        const cause = this.cleanDefinition(match[2]);

        // Create unique key
        const key = `${effect.toLowerCase()}|${cause.toLowerCase()}`;

        // Skip if already seen or too short
        if (seen.has(key) || effect.length < 10 || cause.length < 5) {
          continue;
        }

        seen.add(key);
        relationships.push({
          effect,
          cause,
          confidence: this.calculateCausalConfidence(effect, cause),
        });
      }
    }

    return relationships;
  }

  /**
   * Extract comparative statements from text
   */
  private extractComparisons(content: string): ExtractedComparison[] {
    const comparisons: ExtractedComparison[] = [];
    const seen = new Set<string>();

    for (const pattern of COMPARISON_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const conceptA = this.cleanTerm(match[1]);
        const conceptB = this.cleanTerm(match[2] || match[3]);
        const aspect = this.cleanDefinition(match[3] || match[4] || match[2]);

        // Create unique key
        const key = `${conceptA.toLowerCase()}|${conceptB.toLowerCase()}`;

        // Skip if already seen or too short
        if (seen.has(key) || conceptA.length < 2 || conceptB.length < 2) {
          continue;
        }

        seen.add(key);
        comparisons.push({
          conceptA,
          conceptB,
          aspect,
          relationship: this.determineComparisonRelationship(conceptA, conceptB, aspect),
          confidence: 0.7,
        });
      }
    }

    return comparisons;
  }

  /**
   * Store definitions in database
   */
  private async storeDefinitions(
    definitions: ExtractedDefinition[],
    documentId: string,
    userId: string
  ): Promise<void> {
    for (const def of definitions) {
      try {
        // Check if definition already exists
        const existing = await prisma.domainKnowledge.findUnique({
          where: {
            userId_term: {
              userId,
              term: def.term,
            },
          },
        });

        if (existing) {
          // Parse existing sourceDocuments
          let sourceDocuments: string[] = [];
          try {
            sourceDocuments = existing.sourceDocuments
              ? JSON.parse(existing.sourceDocuments)
              : [];
          } catch {
            sourceDocuments = [];
          }

          // Add new documentId if not present
          if (!sourceDocuments.includes(documentId)) {
            sourceDocuments.push(documentId);
          }

          await prisma.domainKnowledge.update({
            where: {
              userId_term: {
                userId,
                term: def.term,
              },
            },
            data: {
              definition: def.definition,
              sourceDocuments: JSON.stringify(sourceDocuments),
              confidence: Math.max(existing.confidence || 0, def.confidence),
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.domainKnowledge.create({
            data: {
              userId,
              term: def.term,
              definition: def.definition,
              sourceDocuments: JSON.stringify([documentId]),
              confidence: def.confidence,
            },
          });
        }
      } catch (error) {
        console.warn(`⚠️ [KNOWLEDGE] Error storing definition "${def.term}":`, error);
      }
    }
  }

  /**
   * Store methodologies in database
   */
  private async storeMethodologies(
    methodologies: ExtractedMethodology[],
    documentId: string,
    userId: string
  ): Promise<void> {
    for (const m of methodologies) {
      const normalizedName = m.name.toLowerCase().trim();

      try {
        const existing = await prisma.methodologyKnowledge.findUnique({
          where: {
            userId_name: {
              userId,
              name: normalizedName,
            },
          },
        });

        if (existing) {
          // Parse existing sourceDocumentIds
          let sourceDocumentIds: string[] = [];
          try {
            sourceDocumentIds = existing.sourceDocumentIds
              ? JSON.parse(existing.sourceDocumentIds)
              : [];
          } catch {
            sourceDocumentIds = [];
          }

          if (!sourceDocumentIds.includes(documentId)) {
            sourceDocumentIds.push(documentId);
          }

          await prisma.methodologyKnowledge.update({
            where: {
              userId_name: {
                userId,
                name: normalizedName,
              },
            },
            data: {
              documentCount: { increment: 1 },
              sourceDocumentIds: JSON.stringify(sourceDocumentIds),
              ...(m.description && { definition: m.description }),
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.methodologyKnowledge.create({
            data: {
              userId,
              name: normalizedName,
              definition: m.description || null,
              sourceDocumentIds: JSON.stringify([documentId]),
              documentCount: 1,
              confidence: m.confidence,
            },
          });
        }
      } catch (error) {
        console.warn(`⚠️ [KNOWLEDGE] Error storing methodology "${m.name}":`, error);
      }
    }
  }

  /**
   * Store causal relationships in database
   * Updated to use new schema with causes as JSON array
   */
  private async storeCausalRelationships(
    relationships: ExtractedCausalRelationship[],
    documentId: string,
    userId: string
  ): Promise<void> {
    // Group by effect to consolidate causes
    const effectGroups = new Map<string, ExtractedCausalRelationship[]>();
    for (const rel of relationships) {
      const effect = rel.effect.toLowerCase().trim();
      if (!effectGroups.has(effect)) {
        effectGroups.set(effect, []);
      }
      effectGroups.get(effect)!.push(rel);
    }

    for (const [effectKey, rels] of effectGroups) {
      try {
        // Check if relationship already exists for this effect
        const existing = await prisma.causalRelationship.findFirst({
          where: {
            userId,
            effect: { contains: effectKey.substring(0, 50), mode: 'insensitive' },
          },
        });

        // Build causes JSON array
        const causes = rels.map(r => ({
          cause: r.cause,
          confidence: r.confidence,
          pattern: 'extracted',
        }));

        if (existing) {
          // Update existing with new causes and source
          const existingCauses = JSON.parse(existing.causes || '[]');
          const existingDocIds = existing.sourceDocumentIds
            ? JSON.parse(existing.sourceDocumentIds)
            : [];

          if (!existingDocIds.includes(documentId)) {
            await prisma.causalRelationship.update({
              where: { id: existing.id },
              data: {
                causes: JSON.stringify([...existingCauses, ...causes]),
                sourceDocumentIds: JSON.stringify([...existingDocIds, documentId]),
                documentCount: { increment: 1 },
                confidence: Math.max(existing.confidence, rels[0].confidence),
                updatedAt: new Date(),
              },
            });
          }
        } else {
          // Create new causal relationship
          await prisma.causalRelationship.create({
            data: {
              userId,
              effect: rels[0].effect,
              causes: JSON.stringify(causes),
              sourceDocumentIds: JSON.stringify([documentId]),
              documentCount: 1,
              confidence: Math.max(...rels.map(r => r.confidence)),
            },
          });
        }
      } catch (error) {
        // Ignore duplicates
        if (!(error as any).code?.includes('P2002')) {
          console.warn(`⚠️ [KNOWLEDGE] Error storing causal relationship:`, error);
        }
      }
    }
  }

  /**
   * Store comparisons in database
   * Updated to use ComparativeData table with new schema
   */
  private async storeComparisons(
    comparisons: ExtractedComparison[],
    documentId: string,
    userId: string
  ): Promise<void> {
    for (const comp of comparisons) {
      try {
        // Check if comparison already exists
        const existing = await prisma.comparativeData.findFirst({
          where: {
            userId,
            OR: [
              { conceptA: { equals: comp.conceptA, mode: 'insensitive' }, conceptB: { equals: comp.conceptB, mode: 'insensitive' } },
              { conceptA: { equals: comp.conceptB, mode: 'insensitive' }, conceptB: { equals: comp.conceptA, mode: 'insensitive' } },
            ],
          },
        });

        // Build attributes JSON
        const attributes = {
          [comp.aspect]: {
            [comp.conceptA]: comp.relationship,
            [comp.conceptB]: 'compared',
          },
        };

        if (existing) {
          // Update existing comparison
          const existingAttrs = JSON.parse(existing.attributes || '{}');
          const existingDocIds = existing.sourceDocumentIds
            ? JSON.parse(existing.sourceDocumentIds)
            : [];

          if (!existingDocIds.includes(documentId)) {
            await prisma.comparativeData.update({
              where: { id: existing.id },
              data: {
                attributes: JSON.stringify({ ...existingAttrs, ...attributes }),
                sourceDocumentIds: JSON.stringify([...existingDocIds, documentId]),
                documentCount: { increment: 1 },
                confidence: Math.max(existing.confidence, comp.confidence),
                updatedAt: new Date(),
              },
            });
          }
        } else {
          // Create new comparison
          await prisma.comparativeData.create({
            data: {
              userId,
              conceptA: comp.conceptA,
              conceptB: comp.conceptB,
              attributes: JSON.stringify(attributes),
              sourceDocumentIds: JSON.stringify([documentId]),
              documentCount: 1,
              confidence: comp.confidence,
            },
          });
        }
      } catch (error) {
        // Ignore duplicates
        if (!(error as any).code?.includes('P2002')) {
          console.warn(`⚠️ [KNOWLEDGE] Error storing comparison:`, error);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clean extracted term (remove extra whitespace, etc.)
   */
  private cleanTerm(term: string): string {
    return term
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(the|a|an)\s+/i, '')
      .trim();
  }

  /**
   * Clean extracted definition
   */
  private cleanDefinition(definition: string): string {
    return definition
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(that|which)\s+/i, '')
      .trim();
  }

  /**
   * Calculate confidence score for a definition
   */
  private calculateConfidence(term: string, definition: string): number {
    let confidence = 0.5;

    // Longer definitions are generally more reliable
    if (definition.length > 50) confidence += 0.1;
    if (definition.length > 100) confidence += 0.1;

    // Terms with proper capitalization are more likely to be real terms
    if (/^[A-Z]/.test(term)) confidence += 0.1;

    // Definitions containing technical terms are more reliable
    const technicalTerms = ['algorithm', 'method', 'technique', 'approach', 'model', 'framework'];
    if (technicalTerms.some(t => definition.toLowerCase().includes(t))) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate confidence for causal relationships
   */
  private calculateCausalConfidence(effect: string, cause: string): number {
    let confidence = 0.5;

    // Longer explanations are more reliable
    if (cause.length > 20) confidence += 0.1;
    if (effect.length > 20) confidence += 0.1;

    // Causal keywords increase confidence
    const causalKeywords = ['leads to', 'results in', 'causes', 'increases', 'decreases'];
    if (causalKeywords.some(k => cause.toLowerCase().includes(k) || effect.toLowerCase().includes(k))) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Check if a methodology is the primary one in the document
   */
  private isPrimaryMethodology(name: string, content: string): boolean {
    const nameLower = name.toLowerCase();

    // Check if it appears in the first 20% of the document
    const firstPart = content.slice(0, Math.floor(content.length * 0.2)).toLowerCase();
    if (firstPart.includes(nameLower)) return true;

    // Check if it's emphasized (appears multiple times)
    const occurrences = (content.toLowerCase().match(new RegExp(nameLower, 'g')) || []).length;
    if (occurrences >= 3) return true;

    // Check for phrases like "our approach", "proposed method"
    const primaryPhrases = ['our approach', 'our method', 'proposed method', 'we propose', 'we use'];
    const surroundingText = content.toLowerCase();
    for (const phrase of primaryPhrases) {
      const phraseIndex = surroundingText.indexOf(phrase);
      if (phraseIndex !== -1) {
        const nearbyText = surroundingText.slice(phraseIndex, phraseIndex + 200);
        if (nearbyText.includes(nameLower)) return true;
      }
    }

    return false;
  }

  /**
   * Determine the relationship type in a comparison
   */
  private determineComparisonRelationship(conceptA: string, conceptB: string, aspect: string): string {
    const aspectLower = aspect.toLowerCase();

    if (aspectLower.includes('better') || aspectLower.includes('outperform')) {
      return 'superior';
    }
    if (aspectLower.includes('worse') || aspectLower.includes('inferior')) {
      return 'inferior';
    }
    if (aspectLower.includes('similar') || aspectLower.includes('same')) {
      return 'similar';
    }
    if (aspectLower.includes('different') || aspectLower.includes('unlike')) {
      return 'different';
    }
    if (aspectLower.includes('faster') || aspectLower.includes('efficient')) {
      return 'more_efficient';
    }
    if (aspectLower.includes('accurate') || aspectLower.includes('precise')) {
      return 'more_accurate';
    }

    return 'compared';
  }

  /**
   * Get all definitions for a user
   */
  async getDefinitions(userId: string, term?: string): Promise<any[]> {
    const where: any = { userId };
    if (term) {
      where.term = { contains: term, mode: 'insensitive' };
    }

    return prisma.domainKnowledge.findMany({
      where,
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Get all methodologies for a user
   */
  async getMethodologies(userId: string): Promise<any[]> {
    return prisma.methodologyKnowledge.findMany({
      where: { userId },
      orderBy: { documentCount: 'desc' },
    });
  }

  /**
   * Get causal relationships for a user
   */
  async getCausalRelationships(userId: string, documentId?: string): Promise<any[]> {
    const where: any = { userId };
    if (documentId) {
      where.documentId = documentId;
    }

    return prisma.causalRelationship.findMany({
      where,
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Get comparisons for a user
   */
  async getComparisons(userId: string, concept?: string): Promise<any[]> {
    const where: any = { userId };
    if (concept) {
      where.OR = [
        { conceptA: { contains: concept, mode: 'insensitive' } },
        { conceptB: { contains: concept, mode: 'insensitive' } },
      ];
    }

    return prisma.comparativeData.findMany({
      where,
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Get causal relationships for a user (updated for new schema)
   */
  async getCausalRelationshipsV2(userId: string, effect?: string): Promise<any[]> {
    const where: any = { userId };
    if (effect) {
      where.effect = { contains: effect, mode: 'insensitive' };
    }

    return prisma.causalRelationship.findMany({
      where,
      orderBy: [{ documentCount: 'desc' }, { confidence: 'desc' }],
    });
  }
}

export const knowledgeExtractionService = new KnowledgeExtractionService();
export default knowledgeExtractionService;
