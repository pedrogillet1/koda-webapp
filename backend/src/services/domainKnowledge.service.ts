/**
 * Domain Knowledge Service
 *
 * PURPOSE: Extract and store domain-specific knowledge from user's documents
 * WHY: Enable ChatGPT-level domain expertise built from user's actual documents
 * HOW: Extract terms, definitions, formulas, and relationships during indexing
 * IMPACT: Transform "Sharpe ratio is mentioned" → full explanation with formula
 *
 * Domain Categories:
 * - Finance: Sharpe ratio, portfolio theory, risk management, market dynamics
 * - Machine Learning: algorithms, training methods, evaluation metrics
 * - Statistics: distributions, hypothesis testing, regression, correlation
 * - Economics: GDP, inflation, monetary policy, market cycles
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DomainTerm {
  term: string;              // The term (e.g., "Sharpe ratio")
  domain: string;            // Domain: finance, ml, statistics, economics, etc.
  definition?: string;       // What it is
  formula?: string;          // Mathematical formula (if applicable)
  interpretation?: string;   // How to interpret/use this
  usageContext?: string;     // When/where this is used
  relatedTerms?: string[];   // Related terms
  parentTerm?: string;       // Broader concept
  synonyms?: string[];       // Alternative names
  confidence?: number;       // 0-1 extraction confidence
}

export interface ConceptRelation {
  fromTerm: string;
  toTerm: string;
  relationshipType: string;  // uses, measures, reduces, causes, requires
  description?: string;
  strength?: number;
}

export interface DomainExtractionResult {
  terms: DomainTerm[];
  relationships: ConceptRelation[];
  domain: string;
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN PATTERNS - Common terms by domain
// ═══════════════════════════════════════════════════════════════════════════════

const DOMAIN_TERMS: Record<string, string[]> = {
  finance: [
    'sharpe ratio', 'sortino ratio', 'treynor ratio', 'information ratio',
    'alpha', 'beta', 'volatility', 'variance', 'standard deviation',
    'portfolio', 'diversification', 'correlation', 'covariance',
    'risk-adjusted return', 'excess return', 'benchmark', 'index',
    'capm', 'apt', 'fama-french', 'black-scholes', 'black-litterman',
    'value at risk', 'var', 'expected shortfall', 'cvar', 'drawdown',
    'mean-variance', 'efficient frontier', 'capital allocation',
    'leverage', 'margin', 'short selling', 'long position',
    'derivative', 'option', 'futures', 'swap', 'forward',
    'yield', 'duration', 'convexity', 'spread', 'basis',
  ],
  ml: [
    'overfitting', 'underfitting', 'bias-variance tradeoff',
    'cross-validation', 'train-test split', 'validation set',
    'gradient descent', 'learning rate', 'batch size', 'epoch',
    'loss function', 'cost function', 'objective function',
    'regularization', 'l1', 'l2', 'dropout', 'early stopping',
    'hyperparameter', 'tuning', 'grid search', 'random search',
    'feature engineering', 'feature selection', 'dimensionality reduction',
    'precision', 'recall', 'f1 score', 'accuracy', 'auc', 'roc',
    'confusion matrix', 'true positive', 'false positive',
    'ensemble', 'bagging', 'boosting', 'stacking', 'blending',
    'neural network', 'deep learning', 'cnn', 'rnn', 'lstm', 'transformer',
    'attention', 'embedding', 'transfer learning', 'fine-tuning',
  ],
  statistics: [
    'mean', 'median', 'mode', 'variance', 'standard deviation',
    'normal distribution', 'gaussian', 'skewness', 'kurtosis',
    'hypothesis testing', 'null hypothesis', 'p-value', 'significance',
    'confidence interval', 'standard error', 'margin of error',
    'regression', 'linear regression', 'logistic regression',
    'correlation', 'pearson', 'spearman', 'kendall',
    'anova', 't-test', 'chi-square', 'f-test',
    'bayesian', 'prior', 'posterior', 'likelihood',
    'monte carlo', 'bootstrap', 'jackknife', 'resampling',
    'time series', 'autocorrelation', 'stationarity', 'arima', 'garch',
  ],
  economics: [
    'gdp', 'gross domestic product', 'gnp', 'per capita',
    'inflation', 'deflation', 'cpi', 'ppi', 'price index',
    'interest rate', 'federal funds rate', 'discount rate',
    'monetary policy', 'fiscal policy', 'quantitative easing',
    'supply and demand', 'equilibrium', 'elasticity',
    'market efficiency', 'efficient market hypothesis',
    'arbitrage', 'market anomaly', 'behavioral finance',
    'business cycle', 'recession', 'expansion', 'contraction',
    'unemployment', 'labor force', 'participation rate',
    'exchange rate', 'currency', 'forex', 'ppp',
  ],
};

// Relationship patterns to detect
const RELATIONSHIP_PATTERNS = [
  { pattern: /(\w+(?:\s+\w+)?)\s+(?:measures?|calculates?|computes?)\s+(\w+(?:\s+\w+)?)/gi, type: 'measures' },
  { pattern: /(\w+(?:\s+\w+)?)\s+(?:uses?|employs?|utilizes?)\s+(\w+(?:\s+\w+)?)/gi, type: 'uses' },
  { pattern: /(\w+(?:\s+\w+)?)\s+(?:reduces?|minimizes?|decreases?)\s+(\w+(?:\s+\w+)?)/gi, type: 'reduces' },
  { pattern: /(\w+(?:\s+\w+)?)\s+(?:causes?|leads?\s+to|results?\s+in)\s+(\w+(?:\s+\w+)?)/gi, type: 'causes' },
  { pattern: /(\w+(?:\s+\w+)?)\s+(?:requires?|needs?|depends?\s+on)\s+(\w+(?:\s+\w+)?)/gi, type: 'requires' },
  { pattern: /(\w+(?:\s+\w+)?)\s+(?:is\s+related\s+to|correlates?\s+with)\s+(\w+(?:\s+\w+)?)/gi, type: 'related' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN KNOWLEDGE SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class DomainKnowledgeService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN EXTRACTION METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Extract domain knowledge from document text
   */
  async extractFromDocument(
    text: string,
    documentId: string,
    userId: string
  ): Promise<DomainExtractionResult> {
    const startTime = Date.now();
    console.log(`🎓 [DOMAIN] Starting domain knowledge extraction from document ${documentId}`);

    // Step 1: Detect document domain(s)
    const detectedDomains = this.detectDomains(text);
    const primaryDomain = detectedDomains[0] || 'general';

    console.log(`   📚 Detected domains: ${detectedDomains.join(', ')}`);

    // Step 2: Extract terms using patterns
    const patternTerms = this.extractTermsWithPatterns(text, detectedDomains);
    console.log(`   📝 Pattern extraction: ${patternTerms.length} terms`);

    // Step 3: Use LLM for deeper extraction
    let llmTerms: DomainTerm[] = [];
    let relationships: ConceptRelation[] = [];

    if (this.model && text.length > 500 && text.length < 100000) {
      try {
        const llmResult = await this.extractWithLLM(text, primaryDomain, patternTerms);
        llmTerms = llmResult.terms;
        relationships = llmResult.relationships;
        console.log(`   🤖 LLM extraction: ${llmTerms.length} terms, ${relationships.length} relationships`);
      } catch (error) {
        console.warn(`   ⚠️ LLM extraction failed:`, error);
      }
    }

    // Step 4: Merge and deduplicate terms
    const allTerms = this.mergeTerms([...patternTerms, ...llmTerms]);

    // Step 5: Store extracted knowledge
    for (const term of allTerms) {
      try {
        await this.storeDomainKnowledge(userId, term, documentId);
      } catch (error) {
        console.warn(`   ⚠️ Failed to store term "${term.term}":`, error);
      }
    }

    // Step 6: Store relationships
    for (const rel of relationships) {
      try {
        await this.storeRelationship(userId, rel, documentId);
      } catch (error) {
        console.warn(`   ⚠️ Failed to store relationship:`, error);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ [DOMAIN] Extraction complete in ${processingTime}ms: ${allTerms.length} terms, ${relationships.length} relationships`);

    return {
      terms: allTerms,
      relationships,
      domain: primaryDomain,
      processingTime,
    };
  }

  /**
   * Detect domain(s) from text
   */
  private detectDomains(text: string): string[] {
    const lowerText = text.toLowerCase();
    const domainScores: Record<string, number> = {};

    for (const [domain, terms] of Object.entries(DOMAIN_TERMS)) {
      let score = 0;
      for (const term of terms) {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      if (score > 0) {
        domainScores[domain] = score;
      }
    }

    // Sort domains by score
    return Object.entries(domainScores)
      .sort((a, b) => b[1] - a[1])
      .map(([domain]) => domain);
  }

  /**
   * Extract terms using patterns
   */
  private extractTermsWithPatterns(text: string, domains: string[]): DomainTerm[] {
    const terms: DomainTerm[] = [];
    const lowerText = text.toLowerCase();
    const seen = new Set<string>();

    for (const domain of domains) {
      const domainTerms = DOMAIN_TERMS[domain] || [];

      for (const term of domainTerms) {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = lowerText.match(regex);

        if (matches && matches.length > 0 && !seen.has(term)) {
          seen.add(term);

          // Try to extract definition from context
          const definition = this.extractDefinitionFromContext(text, term);

          terms.push({
            term: this.capitalize(term),
            domain,
            definition: definition || undefined,
            confidence: 0.7,
          });
        }
      }
    }

    return terms;
  }

  /**
   * Try to extract definition from surrounding text
   */
  private extractDefinitionFromContext(text: string, term: string): string | null {
    const lowerText = text.toLowerCase();
    const termIndex = lowerText.indexOf(term.toLowerCase());

    if (termIndex === -1) return null;

    // Look for definition patterns near the term
    const contextStart = Math.max(0, termIndex - 200);
    const contextEnd = Math.min(text.length, termIndex + term.length + 400);
    const context = text.substring(contextStart, contextEnd);

    // Pattern: "term is defined as..."
    const definedAs = context.match(new RegExp(`${term}[\\s,]*(?:is|are|refers to|means|can be defined as)[\\s:]+([^.]+\\.?)`, 'i'));
    if (definedAs) {
      return definedAs[1].trim();
    }

    // Pattern: "term: ..."
    const colonDef = context.match(new RegExp(`${term}[\\s]*:[\\s]+([^.]+\\.?)`, 'i'));
    if (colonDef) {
      return colonDef[1].trim();
    }

    // Pattern: "term (explanation)"
    const parenDef = context.match(new RegExp(`${term}[\\s]*\\(([^)]+)\\)`, 'i'));
    if (parenDef) {
      return parenDef[1].trim();
    }

    return null;
  }

  /**
   * Extract domain knowledge using LLM
   */
  private async extractWithLLM(
    text: string,
    domain: string,
    existingTerms: DomainTerm[]
  ): Promise<{ terms: DomainTerm[]; relationships: ConceptRelation[] }> {
    const truncatedText = text.length > 30000 ? text.substring(0, 30000) + '...' : text;
    const existingTermNames = existingTerms.map(t => t.term).slice(0, 20).join(', ');

    const prompt = `Extract domain-specific knowledge from this ${domain} document.

Document text:
"""
${truncatedText}
"""

Already identified terms: ${existingTermNames || 'none'}

Return ONLY a valid JSON object with this exact structure:
{
  "terms": [
    {
      "term": "Term Name",
      "domain": "${domain}",
      "definition": "Clear, concise definition (1-2 sentences)",
      "formula": "Mathematical formula if applicable (e.g., '(R_p - R_f) / σ_p'), null if not applicable",
      "interpretation": "How to interpret this (e.g., 'higher is better, >1 is good')",
      "usageContext": "When/where this is typically used",
      "relatedTerms": ["related", "term", "names"],
      "parentTerm": "broader category if applicable",
      "synonyms": ["alternative", "names"]
    }
  ],
  "relationships": [
    {
      "fromTerm": "Term A",
      "toTerm": "Term B",
      "relationshipType": "uses|measures|reduces|causes|requires|related",
      "description": "Brief description of relationship"
    }
  ]
}

Rules:
- Focus on technical/domain-specific terms, not common words
- Extract actual definitions from the document, don't make up generic ones
- Include formulas only if they're explicitly mentioned
- Limit to 15 most important terms
- Include 5-10 key relationships between concepts
- For finance terms: include interpretation (e.g., "higher is better")
- For ML terms: include typical values/ranges if mentioned`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      const terms: DomainTerm[] = (parsed.terms || []).map((t: any) => ({
        term: t.term,
        domain: t.domain || domain,
        definition: t.definition || undefined,
        formula: t.formula || undefined,
        interpretation: t.interpretation || undefined,
        usageContext: t.usageContext || undefined,
        relatedTerms: t.relatedTerms || [],
        parentTerm: t.parentTerm || undefined,
        synonyms: t.synonyms || [],
        confidence: 0.85,
      }));

      const relationships: ConceptRelation[] = (parsed.relationships || []).map((r: any) => ({
        fromTerm: r.fromTerm,
        toTerm: r.toTerm,
        relationshipType: r.relationshipType,
        description: r.description || undefined,
        strength: 0.7,
      }));

      return { terms, relationships };
    } catch (error) {
      console.error('❌ [DOMAIN] LLM extraction error:', error);
      return { terms: [], relationships: [] };
    }
  }

  /**
   * Merge and deduplicate terms
   */
  private mergeTerms(terms: DomainTerm[]): DomainTerm[] {
    const merged = new Map<string, DomainTerm>();

    for (const term of terms) {
      const key = term.term.toLowerCase();
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, term);
      } else {
        // Merge: prefer longer/more detailed content
        merged.set(key, {
          ...existing,
          definition: this.preferLonger(existing.definition, term.definition),
          formula: existing.formula || term.formula,
          interpretation: this.preferLonger(existing.interpretation, term.interpretation),
          usageContext: this.preferLonger(existing.usageContext, term.usageContext),
          relatedTerms: [...new Set([...(existing.relatedTerms || []), ...(term.relatedTerms || [])])],
          synonyms: [...new Set([...(existing.synonyms || []), ...(term.synonyms || [])])],
          confidence: Math.max(existing.confidence || 0, term.confidence || 0),
        });
      }
    }

    return Array.from(merged.values());
  }

  private preferLonger(a?: string, b?: string): string | undefined {
    if (!a && !b) return undefined;
    if (!a) return b;
    if (!b) return a;
    return a.length >= b.length ? a : b;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STORAGE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Store domain knowledge in database
   */
  async storeDomainKnowledge(
    userId: string,
    term: DomainTerm,
    documentId: string
  ): Promise<void> {
    const normalizedTerm = term.term.toLowerCase().trim();

    try {
      const existing = await prisma.domain_knowledge.findUnique({
        where: {
          userId_normalizedTerm_domain: {
            userId,
            normalizedTerm,
            domain: term.domain,
          },
        },
      });

      if (existing) {
        // Merge with existing knowledge
        const existingDocs = existing.sourceDocumentIds
          ? JSON.parse(existing.sourceDocumentIds as string)
          : [];
        const newDocs = Array.from(new Set([...existingDocs, documentId]));

        await prisma.domain_knowledge.update({
          where: { id: existing.id },
          data: {
            definition: this.preferLonger(existing.definition, term.definition),
            formula: existing.formula || term.formula,
            interpretation: this.preferLonger(existing.interpretation, term.interpretation),
            usageContext: this.preferLonger(existing.usageContext, term.usageContext),
            relatedTerms: JSON.stringify([
              ...new Set([
                ...(existing.relatedTerms ? JSON.parse(existing.relatedTerms as string) : []),
                ...(term.relatedTerms || [])
              ])
            ]),
            synonyms: JSON.stringify([
              ...new Set([
                ...(existing.synonyms ? JSON.parse(existing.synonyms as string) : []),
                ...(term.synonyms || [])
              ])
            ]),
            parentTerm: term.parentTerm || existing.parentTerm,
            sourceDocumentIds: JSON.stringify(newDocs),
            documentCount: newDocs.length,
            confidence: Math.max(existing.confidence || 0, term.confidence || 0),
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.domain_knowledge.create({
          data: {
            userId,
            term: term.term,
            normalizedTerm,
            domain: term.domain,
            definition: term.definition || null,
            formula: term.formula || null,
            interpretation: term.interpretation || null,
            usageContext: term.usageContext || null,
            relatedTerms: JSON.stringify(term.relatedTerms || []),
            parentTerm: term.parentTerm || null,
            synonyms: JSON.stringify(term.synonyms || []),
            sourceDocumentIds: JSON.stringify([documentId]),
            documentCount: 1,
            confidence: term.confidence || 0.5,
          },
        });
      }
    } catch (error) {
      console.error(`❌ [DOMAIN] Failed to store term "${term.term}":`, error);
      throw error;
    }
  }

  /**
   * Store concept relationship
   */
  async storeRelationship(
    userId: string,
    relation: ConceptRelation,
    documentId: string
  ): Promise<void> {
    try {
      // Find the concept IDs
      const fromConcept = await prisma.domain_knowledge.findFirst({
        where: {
          userId,
          normalizedTerm: relation.fromTerm.toLowerCase(),
        },
      });

      const toConcept = await prisma.domain_knowledge.findFirst({
        where: {
          userId,
          normalizedTerm: relation.toTerm.toLowerCase(),
        },
      });

      if (!fromConcept || !toConcept) {
        return; // Can't create relationship without both concepts
      }

      // Check if relationship exists
      const existing = await prisma.conceptRelationship.findUnique({
        where: {
          fromConceptId_toConceptId_relationshipType: {
            fromConceptId: fromConcept.id,
            toConceptId: toConcept.id,
            relationshipType: relation.relationshipType,
          },
        },
      });

      if (existing) {
        // Update document count
        const existingDocs = existing.sourceDocumentIds
          ? JSON.parse(existing.sourceDocumentIds as string)
          : [];
        const newDocs = Array.from(new Set([...existingDocs, documentId]));

        await prisma.conceptRelationship.update({
          where: { id: existing.id },
          data: {
            sourceDocumentIds: JSON.stringify(newDocs),
            documentCount: newDocs.length,
            strength: Math.min(1, (existing.strength || 0.5) + 0.1),
          },
        });
      } else {
        await prisma.conceptRelationship.create({
          data: {
            userId,
            fromConceptId: fromConcept.id,
            toConceptId: toConcept.id,
            relationshipType: relation.relationshipType,
            description: relation.description || null,
            strength: relation.strength || 0.5,
            sourceDocumentIds: JSON.stringify([documentId]),
            documentCount: 1,
          },
        });
      }
    } catch (error) {
      console.error(`❌ [DOMAIN] Failed to store relationship:`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get domain knowledge for a term
   */
  async getDomainKnowledge(
    userId: string,
    term: string
  ): Promise<DomainTerm | null> {
    const normalizedTerm = term.toLowerCase().trim();

    console.log(`🔍 [DOMAIN] Looking up "${normalizedTerm}" for user ${userId}`);

    try {
      // Try exact match first
      let knowledge = await prisma.domain_knowledge.findFirst({
        where: {
          userId,
          normalizedTerm,
        },
      });

      // If not found, try partial match
      if (!knowledge) {
        knowledge = await prisma.domain_knowledge.findFirst({
          where: {
            userId,
            OR: [
              { normalizedTerm: { contains: normalizedTerm } },
              { synonyms: { contains: normalizedTerm } },
            ],
          },
        });
      }

      if (!knowledge) {
        console.log(`   ⚠️ No knowledge found for "${term}"`);
        return null;
      }

      // Update access count
      await prisma.domain_knowledge.update({
        where: { id: knowledge.id },
        data: {
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 },
        },
      });

      console.log(`   ✅ Found knowledge from ${knowledge.documentCount} documents`);

      return {
        term: knowledge.term,
        domain: knowledge.domain,
        definition: knowledge.definition || undefined,
        formula: knowledge.formula || undefined,
        interpretation: knowledge.interpretation || undefined,
        usageContext: knowledge.usageContext || undefined,
        relatedTerms: knowledge.relatedTerms ? JSON.parse(knowledge.relatedTerms as string) : [],
        parentTerm: knowledge.parentTerm || undefined,
        synonyms: knowledge.synonyms ? JSON.parse(knowledge.synonyms as string) : [],
        confidence: knowledge.confidence || 0,
      };
    } catch (error) {
      console.error(`❌ [DOMAIN] Lookup failed:`, error);
      return null;
    }
  }

  /**
   * Get related concepts for a term
   */
  async getRelatedConcepts(
    userId: string,
    term: string
  ): Promise<Array<{ term: string; relationship: string; direction: 'to' | 'from' }>> {
    try {
      const concept = await prisma.domain_knowledge.findFirst({
        where: {
          userId,
          normalizedTerm: term.toLowerCase(),
        },
        include: {
          outgoingRelations: {
            include: { toConcept: true },
          },
          incomingRelations: {
            include: { fromConcept: true },
          },
        },
      });

      if (!concept) return [];

      const related: Array<{ term: string; relationship: string; direction: 'to' | 'from' }> = [];

      for (const rel of concept.outgoingRelations) {
        related.push({
          term: rel.toConcept.term,
          relationship: rel.relationshipType,
          direction: 'to',
        });
      }

      for (const rel of concept.incomingRelations) {
        related.push({
          term: rel.fromConcept.term,
          relationship: rel.relationshipType,
          direction: 'from',
        });
      }

      return related;
    } catch (error) {
      console.error(`❌ [DOMAIN] Failed to get related concepts:`, error);
      return [];
    }
  }

  /**
   * Format domain knowledge for response
   */
  formatKnowledgeForResponse(term: DomainTerm, relatedConcepts?: Array<{ term: string; relationship: string }>): string {
    const parts: string[] = [];

    // Start with definition
    if (term.definition) {
      parts.push(`**${this.capitalize(term.term)}** ${term.definition}`);
    } else {
      parts.push(`**${this.capitalize(term.term)}**`);
    }

    // Formula (if applicable)
    if (term.formula) {
      parts.push(`\n**Formula:** \`${term.formula}\``);
    }

    // Interpretation
    if (term.interpretation) {
      parts.push(`\n**Interpretation:** ${term.interpretation}`);
    }

    // Usage context
    if (term.usageContext) {
      parts.push(`\n**Used for:** ${term.usageContext}`);
    }

    // Related terms
    if (term.relatedTerms && term.relatedTerms.length > 0) {
      const related = term.relatedTerms.slice(0, 5).map(t => this.capitalize(t)).join(', ');
      parts.push(`\n**Related concepts:** ${related}`);
    }

    // Concept relationships
    if (relatedConcepts && relatedConcepts.length > 0) {
      const relationships = relatedConcepts
        .slice(0, 3)
        .map(r => `${r.relationship} ${this.capitalize(r.term)}`)
        .join(', ');
      parts.push(`\n**Relationships:** ${relationships}`);
    }

    return parts.join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUERY DETECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Detect if query is asking about a domain term
   * Returns the term name if detected, null otherwise
   */
  detectDomainQuery(query: string): string | null {
    const lowerQuery = query.toLowerCase().trim();

    // Patterns for domain queries
    const patterns = [
      /^what\s+is\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s*\?)?$/i,
      /^explain\s+(?:what\s+)?(?:is\s+)?(?:a\s+|an\s+|the\s+)?(.+?)(?:\s*\?)?$/i,
      /^define\s+(.+?)(?:\s*\?)?$/i,
      /^what\s+does\s+(.+?)\s+mean(?:\s*\?)?$/i,
      /^tell\s+me\s+about\s+(.+?)(?:\s*\?)?$/i,
      /^how\s+is\s+(.+?)\s+calculated(?:\s*\?)?$/i,
      /^what\s+is\s+the\s+formula\s+for\s+(.+?)(?:\s*\?)?$/i,
      /^how\s+do\s+(?:i|you)\s+interpret\s+(.+?)(?:\s*\?)?$/i,
    ];

    for (const pattern of patterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        const term = match[1].trim();
        // Check if this looks like a domain term
        if (this.isDomainTerm(term)) {
          return term;
        }
      }
    }

    return null;
  }

  /**
   * Check if a term is a domain-specific term
   */
  private isDomainTerm(term: string): boolean {
    const lowerTerm = term.toLowerCase();

    // Check against all domain terms
    for (const domainTerms of Object.values(DOMAIN_TERMS)) {
      for (const dt of domainTerms) {
        if (lowerTerm.includes(dt) || dt.includes(lowerTerm)) {
          return true;
        }
      }
    }

    // Check for common domain patterns
    const domainPatterns = [
      /ratio$/i, /rate$/i, /coefficient$/i, /index$/i,
      /function$/i, /algorithm$/i, /model$/i, /method$/i,
      /distribution$/i, /test$/i, /analysis$/i,
    ];

    return domainPatterns.some(p => p.test(lowerTerm));
  }

  private capitalize(str: string): string {
    return str.split(/[\s-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// Export singleton instance
export const domainKnowledgeService = new DomainKnowledgeService();
export default domainKnowledgeService;
