/**
 * Methodology Extraction Service
 *
 * PURPOSE: Extract methodologies, approaches, and techniques from documents
 * WHY: Enable cross-document synthesis ("What approaches do my papers use?")
 * HOW: Pattern matching + LLM extraction of methods, frameworks, and techniques
 * IMPACT: Transform "47 papers found" → "3 main approaches across 47 papers"
 *
 * PHASE 2: Methodology Knowledge Base
 * - Store extracted knowledge in MethodologyKnowledge table
 * - Enable "What is X?" queries with actual explanations from user's documents
 * - Track which documents mention which methodologies
 *
 * Extracted Data:
 * - Methodologies ("we use...", "this paper proposes...", "our method...")
 * - Frameworks and models mentioned
 * - Research approaches (qualitative, quantitative, mixed)
 * - Tools and technologies used
 * - Definitions, how it works, why it's used (for knowledge base)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractedMethodology {
  name: string;                // Name of the methodology (e.g., "mean-variance optimization")
  category: string;            // Category (e.g., "optimization", "machine learning", "statistical")
  description: string;         // Brief description of how it's used
  confidence: number;          // 0-1 confidence score
  sourceContext: string;       // Surrounding text for citation
  isPrimary: boolean;          // Is this the main methodology of the document?
  documentId?: string;
}

export interface ExtractedFramework {
  name: string;                // Framework/model name (e.g., "Black-Litterman model")
  type: string;                // Type: model, framework, algorithm, technique
  field: string;               // Field: finance, ML, statistics, etc.
  confidence: number;
  sourceContext: string;
  documentId?: string;
}

export interface DocumentMetadata {
  year?: number;               // Publication year
  authors?: string[];          // Author names
  institution?: string;        // Institution/organization
  documentType?: string;       // paper, report, thesis, etc.
  field?: string;              // Primary field/domain
  keywords?: string[];         // Key topics
}

export interface MethodologyExtractionResult {
  methodologies: ExtractedMethodology[];
  frameworks: ExtractedFramework[];
  metadata: DocumentMetadata;
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// METHODOLOGY KNOWLEDGE INTERFACES - For "What is X?" queries
// ═══════════════════════════════════════════════════════════════════════════════

export interface MethodologyKnowledge {
  name: string;                    // Normalized methodology name
  aliases?: string[];              // Alternative names
  definition?: string;             // What it is (1-2 sentences)
  howItWorks?: string;             // How the method works
  whyUsed?: string;                // Why this method is used / advantages
  limitations?: string;            // Known limitations
  useCases?: string;               // Common applications
  examples?: string;               // Concrete examples from user's documents
  relatedMethods?: string[];       // Related methodology names
  parentMethod?: string;           // "is a type of" relationship
  childMethods?: string[];         // Sub-methods
  sourceDocumentIds?: string[];    // Document IDs where found
  documentCount?: number;          // Number of documents mentioning this
  confidence?: number;             // 0-1 confidence score
}

export interface MethodologyKnowledgeExtractionResult {
  knowledge: MethodologyKnowledge;
  extractedFrom: string;           // Source text snippet
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// METHODOLOGY PATTERNS - Regex patterns for common methodology expressions
// ═══════════════════════════════════════════════════════════════════════════════

// Patterns for methodology mentions
const METHODOLOGY_PATTERNS = [
  // "We use/employ/apply X"
  /(?:we|this\s+(?:paper|study|research|work))\s+(?:use[sd]?|employ[sed]?|appl(?:y|ied)|adopt[sed]?|implement[sed]?)\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z][a-zA-Z\s\-]+?)(?:\s+(?:method|approach|technique|algorithm|model|framework))?(?:\s+(?:to|for|in))/gi,

  // "Our method/approach is X"
  /(?:our|the\s+proposed)\s+(?:method|approach|technique|algorithm|model|framework)\s+(?:is\s+(?:based\s+on\s+)?|uses?\s+)([a-zA-Z][a-zA-Z\s\-]+)/gi,

  // "X method/approach/technique"
  /(?:the\s+)?([A-Z][a-zA-Z\s\-]+?)\s+(?:method|approach|technique|algorithm|model|framework)(?:\s+(?:is|was|has))/gi,

  // "based on X"
  /(?:based\s+on|building\s+on|extending)\s+(?:the\s+)?([A-Z][a-zA-Z\s\-]+?)(?:\s+(?:method|approach|model|framework))?(?:\s+(?:to|for|,|\.))/gi,

  // "using X analysis/optimization/learning"
  /using\s+([a-zA-Z][a-zA-Z\s\-]+?)\s+(?:analysis|optimization|learning|regression|classification|clustering)/gi,

  // "X optimization/analysis/learning"
  /([A-Z][a-zA-Z\s\-]+?)\s+(?:optimization|analysis|learning|regression|classification|clustering)(?:\s+(?:is|was|method|approach))/gi,
];

// Patterns for framework/model mentions
const FRAMEWORK_PATTERNS = [
  // "the X model/framework"
  /(?:the\s+)?([A-Z][a-zA-Z\s\-]+?)\s+(?:model|framework|algorithm|method)(?:\s+\([^)]+\))?(?:\s+(?:is|was|has|proposes|describes))/gi,

  // "X (Author, Year)" - citation pattern
  /([A-Z][a-zA-Z\s\-]+?)\s+\([A-Z][a-z]+(?:\s+(?:et\s+al\.?|and\s+[A-Z][a-z]+))?,\s*\d{4}\)/gi,

  // Known framework patterns
  /(?:deep\s+learning|machine\s+learning|neural\s+network|random\s+forest|gradient\s+boosting|support\s+vector|decision\s+tree|logistic\s+regression|linear\s+regression|LSTM|CNN|RNN|transformer|BERT|GPT)/gi,
];

// Year extraction patterns
const YEAR_PATTERNS = [
  /(?:published|written|dated|from|in)\s+(\d{4})/i,
  /©\s*(\d{4})/,
  /\b(19\d{2}|20[0-2]\d)\b/,
];

// ═══════════════════════════════════════════════════════════════════════════════
// METHODOLOGY CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const METHODOLOGY_CATEGORIES: Record<string, string[]> = {
  'optimization': [
    'mean-variance', 'markowitz', 'portfolio optimization', 'convex optimization',
    'linear programming', 'quadratic programming', 'stochastic optimization',
    'dynamic programming', 'genetic algorithm', 'particle swarm', 'simulated annealing',
  ],
  'machine_learning': [
    'deep learning', 'neural network', 'random forest', 'gradient boosting',
    'support vector', 'decision tree', 'ensemble', 'xgboost', 'lightgbm',
    'reinforcement learning', 'supervised learning', 'unsupervised learning',
  ],
  'statistical': [
    'regression', 'bayesian', 'monte carlo', 'bootstrap', 'hypothesis testing',
    'time series', 'arima', 'garch', 'var', 'cointegration', 'factor analysis',
  ],
  'financial_models': [
    'black-litterman', 'capm', 'apt', 'fama-french', 'black-scholes',
    'risk parity', 'minimum variance', 'maximum sharpe', 'efficient frontier',
  ],
  'nlp': [
    'text mining', 'sentiment analysis', 'topic modeling', 'lda', 'word2vec',
    'transformer', 'bert', 'gpt', 'named entity', 'text classification',
  ],
  'qualitative': [
    'case study', 'interview', 'survey', 'ethnography', 'grounded theory',
    'content analysis', 'thematic analysis', 'discourse analysis',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// METHODOLOGY EXTRACTION SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class MethodologyExtractionService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        }
      });
    }
  }

  /**
   * Main extraction method - extract methodologies from document text
   */
  async extractFromDocument(
    text: string,
    documentId?: string,
    useLLM: boolean = true
  ): Promise<MethodologyExtractionResult> {
    const startTime = Date.now();

    console.log(`🔬 [METHODOLOGY] Starting extraction from document ${documentId || 'unknown'}`);

    // Step 1: Pattern-based extraction (fast)
    const patternMethodologies = this.extractMethodologiesWithPatterns(text);
    const patternFrameworks = this.extractFrameworksWithPatterns(text);
    const patternMetadata = this.extractMetadataWithPatterns(text);

    console.log(`   📝 Pattern extraction: ${patternMethodologies.length} methodologies, ${patternFrameworks.length} frameworks`);

    // Step 2: LLM-enhanced extraction (more accurate)
    let llmMethodologies: ExtractedMethodology[] = [];
    let llmFrameworks: ExtractedFramework[] = [];
    let llmMetadata: DocumentMetadata = {};

    if (useLLM && this.model && text.length > 500 && text.length < 100000) {
      try {
        const llmResults = await this.extractWithLLM(text, documentId);
        llmMethodologies = llmResults.methodologies;
        llmFrameworks = llmResults.frameworks;
        llmMetadata = llmResults.document_metadata;

        console.log(`   🤖 LLM extraction: ${llmMethodologies.length} methodologies, ${llmFrameworks.length} frameworks`);
      } catch (error) {
        console.warn(`   ⚠️ LLM extraction failed:`, error);
      }
    }

    // Step 3: Merge and deduplicate
    const mergedMethodologies = this.mergeMethodologies([...patternMethodologies, ...llmMethodologies]);
    const mergedFrameworks = this.mergeFrameworks([...patternFrameworks, ...llmFrameworks]);
    const mergedMetadata = { ...patternMetadata, ...llmMetadata };

    // Add document ID
    if (documentId) {
      mergedMethodologies.forEach(m => m.documentId = documentId);
      mergedFrameworks.forEach(f => f.documentId = documentId);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ [METHODOLOGY] Extraction complete in ${processingTime}ms: ${mergedMethodologies.length} methodologies, ${mergedFrameworks.length} frameworks`);

    return {
      methodologies: mergedMethodologies,
      frameworks: mergedFrameworks,
      metadata: mergedMetadata,
      processingTime,
    };
  }

  /**
   * Extract methodologies using regex patterns
   */
  private extractMethodologiesWithPatterns(text: string): ExtractedMethodology[] {
    const methodologies: ExtractedMethodology[] = [];
    const seen = new Set<string>();

    for (const pattern of METHODOLOGY_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = this.cleanMethodologyName(match[1]);

        if (name.length < 3 || name.length > 80) continue;
        if (this.isCommonWord(name)) continue;
        if (seen.has(name.toLowerCase())) continue;

        seen.add(name.toLowerCase());

        const category = this.categorizeMethodology(name);

        methodologies.push({
          name,
          category,
          description: '',
          confidence: 0.7,
          sourceContext: this.getContext(text, match.index, 200),
          isPrimary: this.isPrimaryMethodology(text, match.index),
        });
      }
    }

    return methodologies;
  }

  /**
   * Extract frameworks using regex patterns
   */
  private extractFrameworksWithPatterns(text: string): ExtractedFramework[] {
    const frameworks: ExtractedFramework[] = [];
    const seen = new Set<string>();

    for (const pattern of FRAMEWORK_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = this.cleanMethodologyName(match[1] || match[0]);

        if (name.length < 3 || name.length > 60) continue;
        if (this.isCommonWord(name)) continue;
        if (seen.has(name.toLowerCase())) continue;

        seen.add(name.toLowerCase());

        frameworks.push({
          name,
          type: this.determineFrameworkType(name),
          field: this.determineField(name),
          confidence: 0.7,
          sourceContext: this.getContext(text, match.index, 200),
        });
      }
    }

    return frameworks;
  }

  /**
   * Extract document metadata using patterns
   */
  private extractMetadataWithPatterns(text: string): DocumentMetadata {
    const metadata: DocumentMetadata = {};

    // Extract year
    for (const pattern of YEAR_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        if (year >= 1900 && year <= new Date().getFullYear() + 1) {
          metadata.year = year;
          break;
        }
      }
    }

    // Detect document type
    const lowerText = text.toLowerCase().substring(0, 5000);
    if (lowerText.includes('abstract') && lowerText.includes('introduction')) {
      metadata.documentType = 'paper';
    } else if (lowerText.includes('thesis') || lowerText.includes('dissertation')) {
      metadata.documentType = 'thesis';
    } else if (lowerText.includes('report') || lowerText.includes('quarterly')) {
      metadata.documentType = 'report';
    }

    return metadata;
  }

  /**
   * Use LLM for enhanced methodology extraction
   */
  private async extractWithLLM(text: string, documentId?: string): Promise<MethodologyExtractionResult> {
    const truncatedText = text.length > 40000 ? text.substring(0, 40000) + '...' : text;

    const prompt = `Analyze this document and extract methodologies, frameworks, and metadata.

Document text:
"""
${truncatedText}
"""

Return ONLY a valid JSON object with this exact structure:
{
  "methodologies": [
    {
      "name": "methodology name (e.g., mean-variance optimization)",
      "category": "optimization|machine_learning|statistical|financial_models|nlp|qualitative|other",
      "description": "brief description of how it's used in this document",
      "confidence": 0.0-1.0,
      "isPrimary": true/false (is this the MAIN methodology?)
    }
  ],
  "frameworks": [
    {
      "name": "framework/model name (e.g., Black-Litterman model)",
      "type": "model|framework|algorithm|technique",
      "field": "finance|ML|statistics|economics|other",
      "confidence": 0.0-1.0
    }
  ],
  "metadata": {
    "year": 2023 (or null),
    "documentType": "paper|thesis|report|article|other",
    "field": "primary field/domain",
    "keywords": ["key", "topics"]
  }
}

Rules:
- Focus on research/analysis methodologies, not general concepts
- isPrimary should be true for the MAIN method the document proposes or uses
- Keep descriptions concise (1 sentence)
- Only include methodologies clearly stated in the text
- Return empty arrays if nothing found`;

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

      return {
        methodologies: (parsed.methodologies || []).map((m: any) => ({
          ...m,
          sourceContext: '',
          documentId,
        })),
        frameworks: (parsed.frameworks || []).map((f: any) => ({
          ...f,
          sourceContext: '',
          documentId,
        })),
        metadata: parsed.document_metadata || {},
        processingTime: 0,
      };
    } catch (error) {
      console.error('❌ [METHODOLOGY] LLM extraction error:', error);
      return { methodologies: [], frameworks: [], document_metadata: {}, processingTime: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private cleanMethodologyName(name: string): string {
    return name.trim()
      .replace(/^(?:the|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[,.:;]+$/, '')
      .toLowerCase();
  }

  private getContext(text: string, position: number, contextLength: number): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    return text.substring(start, end).replace(/\s+/g, ' ').trim();
  }

  private categorizeMethodology(name: string): string {
    const lowerName = name.toLowerCase();

    for (const [category, keywords] of Object.entries(METHODOLOGY_CATEGORIES)) {
      for (const keyword of keywords) {
        if (lowerName.includes(keyword) || keyword.includes(lowerName)) {
          return category;
        }
      }
    }

    return 'other';
  }

  private determineFrameworkType(name: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('model')) return 'model';
    if (lowerName.includes('framework')) return 'framework';
    if (lowerName.includes('algorithm')) return 'algorithm';

    return 'technique';
  }

  private determineField(name: string): string {
    const lowerName = name.toLowerCase();

    if (/portfolio|sharpe|markowitz|black-litterman|capm|fama|financial/.test(lowerName)) {
      return 'finance';
    }
    if (/neural|deep|learning|lstm|cnn|bert|gpt|transformer/.test(lowerName)) {
      return 'ML';
    }
    if (/regression|bayesian|monte carlo|statistical/.test(lowerName)) {
      return 'statistics';
    }

    return 'other';
  }

  private isPrimaryMethodology(text: string, position: number): boolean {
    // Check if this methodology is mentioned in abstract or introduction
    const textBefore = text.substring(0, position).toLowerCase();
    const inAbstract = textBefore.includes('abstract') && position < 3000;
    const inIntroduction = textBefore.includes('introduction') && position < 8000;

    // Check surrounding context for "propose", "our method", etc.
    const context = text.substring(Math.max(0, position - 100), position + 100).toLowerCase();
    const isPrimary = /(?:we\s+propose|our\s+(?:method|approach)|this\s+paper\s+(?:proposes|introduces))/.test(context);

    return inAbstract || (inIntroduction && isPrimary);
  }

  private isCommonWord(term: string): boolean {
    const commonWords = new Set([
      'the', 'this', 'that', 'these', 'those', 'it', 'they', 'we', 'you',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
      'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'how',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
      'our', 'their', 'his', 'her', 'its', 'new', 'used', 'based', 'using',
      'paper', 'study', 'research', 'work', 'method', 'approach', 'analysis',
      'results', 'data', 'model', 'system', 'process', 'way', 'case',
    ]);

    return commonWords.has(term.toLowerCase());
  }

  private mergeMethodologies(methodologies: ExtractedMethodology[]): ExtractedMethodology[] {
    const merged = new Map<string, ExtractedMethodology>();

    for (const m of methodologies) {
      const key = this.normalizeMethodologyName(m.name);
      const existing = merged.get(key);

      if (!existing || m.confidence > existing.confidence || (m.isPrimary && !existing.isPrimary)) {
        merged.set(key, m);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => {
        // Primary methodologies first, then by confidence
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return b.confidence - a.confidence;
      });
  }

  private mergeFrameworks(frameworks: ExtractedFramework[]): ExtractedFramework[] {
    const merged = new Map<string, ExtractedFramework>();

    for (const f of frameworks) {
      const key = f.name.toLowerCase().replace(/\s+/g, '_');
      const existing = merged.get(key);

      if (!existing || f.confidence > existing.confidence) {
        merged.set(key, f);
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
  }

  private normalizeMethodologyName(name: string): string {
    // Normalize similar methodology names
    const normalizations: Record<string, string> = {
      'mean variance': 'mean-variance optimization',
      'markowitz': 'mean-variance optimization',
      'mv optimization': 'mean-variance optimization',
      'black litterman': 'black-litterman model',
      'bl model': 'black-litterman model',
      'risk parity': 'risk parity',
      'equal risk contribution': 'risk parity',
      'deep learning': 'deep learning',
      'neural network': 'neural network',
      'random forest': 'random forest',
      'gradient boosting': 'gradient boosting',
      'xgboost': 'gradient boosting',
      'lightgbm': 'gradient boosting',
    };

    const lowerName = name.toLowerCase().replace(/[-_]/g, ' ').trim();

    for (const [pattern, normalized] of Object.entries(normalizations)) {
      if (lowerName.includes(pattern)) {
        return normalized;
      }
    }

    return lowerName;
  }

  /**
   * Get methodology statistics across multiple documents
   * Used for cross-document synthesis queries
   */
  aggregateMethodologies(
    documents: Array<{ methodologies: ExtractedMethodology[]; metadata: DocumentMetadata }>
  ): {
    counts: Map<string, { count: number; documents: string[]; primaryCount: number }>;
    trends: Array<{ methodology: string; trend: 'increasing' | 'decreasing' | 'stable'; oldCount: number; newCount: number }>;
    categories: Map<string, number>;
  } {
    const counts = new Map<string, { count: number; documents: string[]; primaryCount: number }>();
    const categories = new Map<string, number>();
    const byYear = new Map<number, Map<string, number>>();

    for (const doc of documents) {
      const year = doc.document_metadata.year;

      for (const m of doc.methodologies) {
        const key = this.normalizeMethodologyName(m.name);

        // Count methodologies
        const existing = counts.get(key) || { count: 0, documents: [], primaryCount: 0 };
        existing.count++;
        if (m.documentId && !existing.documents.includes(m.documentId)) {
          existing.documents.push(m.documentId);
        }
        if (m.isPrimary) existing.primaryCount++;
        counts.set(key, existing);

        // Count categories
        categories.set(m.categories, (categories.get(m.categories) || 0) + 1);

        // Track by year for trends
        if (year) {
          if (!byYear.has(year)) byYear.set(year, new Map());
          const yearMap = byYear.get(year)!;
          yearMap.set(key, (yearMap.get(key) || 0) + 1);
        }
      }
    }

    // Calculate trends
    const trends: Array<{ methodology: string; trend: 'increasing' | 'decreasing' | 'stable'; oldCount: number; newCount: number }> = [];
    const years = Array.from(byYear.keys()).sort();

    if (years.length >= 3) {
      const midpoint = Math.floor(years.length / 2);
      const oldYears = years.slice(0, midpoint);
      const newYears = years.slice(midpoint);

      for (const entry of Array.from(counts.entries())) {
        const [methodology] = entry;
        let oldCount = 0;
        let newCount = 0;

        for (const year of oldYears) {
          oldCount += byYear.get(year)?.get(methodology) || 0;
        }
        for (const year of newYears) {
          newCount += byYear.get(year)?.get(methodology) || 0;
        }

        // Normalize by number of years
        const oldNorm = oldCount / oldYears.length;
        const newNorm = newCount / newYears.length;

        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (newNorm > oldNorm * 1.5) trend = 'increasing';
        else if (newNorm < oldNorm * 0.5) trend = 'decreasing';

        if (trend !== 'stable') {
          trends.push({ methodology, trend, oldCount, newCount });
        }
      }
    }

    return { counts, trends, categories };
  }

  /**
   * Format methodology statistics for response
   */
  formatMethodologySummary(
    stats: ReturnType<typeof this.aggregateMethodologies>,
    totalDocuments: number
  ): string {
    const parts: string[] = [];

    // Sort by count
    const sorted = Array.from(stats.counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    if (sorted.length === 0) {
      return 'No specific methodologies were identified across these documents.';
    }

    // Main approaches
    parts.push(`Your ${totalDocuments} documents use ${sorted.length} main approaches:\n`);

    for (const [methodology, data] of sorted) {
      const percentage = Math.round((data.count / totalDocuments) * 100);
      const primaryNote = data.primaryCount > 0 ? ` (primary method in ${data.primaryCount})` : '';
      parts.push(`• **${this.capitalizeMethodology(methodology)}** — used in ${data.count} documents (${percentage}%)${primaryNote}`);
    }

    // Trends
    if (stats.trends.length > 0) {
      parts.push('\n**Trends:**');
      for (const trend of stats.trends.slice(0, 3)) {
        if (trend.trend === 'increasing') {
          parts.push(`• ${this.capitalizeMethodology(trend.methodology)} usage is **increasing** (${trend.oldCount} → ${trend.newCount} papers)`);
        } else {
          parts.push(`• ${this.capitalizeMethodology(trend.methodology)} usage is **decreasing** (${trend.oldCount} → ${trend.newCount} papers)`);
        }
      }
    }

    return parts.join('\n');
  }

  private capitalizeMethodology(name: string): string {
    return name
      .split(/[-\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // METHODOLOGY KNOWLEDGE BASE - Store and retrieve methodology knowledge
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Extract deep knowledge about a methodology from document text
   * This is used to build the knowledge base for "What is X?" queries
   */
  async extractMethodologyKnowledge(
    methodologyName: string,
    text: string,
    documentId: string
  ): Promise<MethodologyKnowledgeExtractionResult | null> {
    const startTime = Date.now();
    const normalizedName = this.normalizeMethodologyName(methodologyName);

    console.log(`📚 [KNOWLEDGE] Extracting knowledge about "${normalizedName}" from document ${documentId}`);

    if (!this.model) {
      console.warn('⚠️ [KNOWLEDGE] LLM not available, skipping knowledge extraction');
      return null;
    }

    // Find relevant sections mentioning this methodology
    const relevantText = this.findRelevantSections(text, methodologyName, 3000);

    if (relevantText.length < 100) {
      console.log(`   ⚠️ Insufficient context for "${normalizedName}"`);
      return null;
    }

    const prompt = `Extract detailed knowledge about "${methodologyName}" from this document text.

Document text:
"""
${relevantText}
"""

Return ONLY a valid JSON object with this exact structure:
{
  "definition": "What ${methodologyName} is - a clear 1-2 sentence definition. If not explicitly defined, infer from context.",
  "howItWorks": "How ${methodologyName} works - step by step or key mechanics. Be specific.",
  "whyUsed": "Why ${methodologyName} is used - advantages, benefits, reasons for choosing it.",
  "limitations": "Known limitations or disadvantages mentioned. Leave empty string if none mentioned.",
  "useCases": "Common use cases or applications mentioned in this context.",
  "examples": "Specific examples of ${methodologyName} from this document (e.g., specific implementations, results).",
  "relatedMethods": ["array", "of", "related", "methods", "mentioned"],
  "parentMethod": "broader category this belongs to (e.g., 'machine learning' for 'random forest'). Empty string if none.",
  "aliases": ["alternative", "names", "for", "this", "method"]
}

Rules:
- Extract ONLY information that is actually in the text
- If something is not mentioned, use an empty string ""
- Be specific and concrete, not generic
- For definition: Explain what it IS, not what it does
- For howItWorks: Focus on the mechanism/process
- For examples: Use specific details from the document`;

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
      const processingTime = Date.now() - startTime;

      const knowledge: MethodologyKnowledge = {
        name: normalizedName,
        aliases: parsed.aliases || [],
        definition: parsed.definition || '',
        howItWorks: parsed.howItWorks || '',
        whyUsed: parsed.whyUsed || '',
        limitations: parsed.limitations || '',
        useCases: parsed.useCases || '',
        examples: parsed.examples || '',
        relatedMethods: parsed.relatedMethods || [],
        parentMethod: parsed.parentMethod || '',
        sourceDocumentIds: [documentId],
        documentCount: 1,
        confidence: 0.8,
      };

      console.log(`✅ [KNOWLEDGE] Extracted knowledge for "${normalizedName}" in ${processingTime}ms`);

      return {
        knowledge,
        extractedFrom: relevantText.substring(0, 500),
        processingTime,
      };
    } catch (error) {
      console.error(`❌ [KNOWLEDGE] Extraction failed for "${normalizedName}":`, error);
      return null;
    }
  }

  /**
   * Find relevant sections of text mentioning a methodology
   */
  private findRelevantSections(text: string, methodologyName: string, maxLength: number): string {
    const lowerText = text.toLowerCase();
    const lowerName = methodologyName.toLowerCase();
    const sections: string[] = [];

    // Find all occurrences
    let pos = 0;
    while (pos < lowerText.length) {
      const index = lowerText.indexOf(lowerName, pos);
      if (index === -1) break;

      // Extract context around this mention
      const start = Math.max(0, index - 500);
      const end = Math.min(text.length, index + lowerName.length + 500);
      sections.push(text.substring(start, end));

      pos = index + lowerName.length;
      if (sections.join('\n\n').length > maxLength) break;
    }

    return sections.join('\n\n---\n\n').substring(0, maxLength);
  }

  /**
   * Store methodology knowledge in database
   */
  async storeMethodologyKnowledge(
    userId: string,
    knowledge: MethodologyKnowledge,
    documentId: string
  ): Promise<void> {
    const normalizedName = this.normalizeMethodologyName(knowledge.name);

    console.log(`💾 [KNOWLEDGE] Storing knowledge for "${normalizedName}" (user: ${userId})`);

    try {
      // Check if we already have knowledge for this methodology
      const existing = await prisma.methodology_knowledge.findUnique({
        where: {
          userId_name: {
            userId,
            name: normalizedName,
          },
        },
      });

      if (existing) {
        // Merge with existing knowledge
        const existingSourceDocs = existing.sourceDocumentIds
          ? JSON.parse(existing.sourceDocumentIds as string)
          : [];

        const newSourceDocs = Array.from(new Set([...existingSourceDocs, documentId]));

        // Merge knowledge - prefer longer/more detailed content
        const mergedDefinition = this.mergeKnowledgeField(existing.definition, knowledge.definition);
        const mergedHowItWorks = this.mergeKnowledgeField(existing.howItWorks, knowledge.howItWorks);
        const mergedWhyUsed = this.mergeKnowledgeField(existing.whyUsed, knowledge.whyUsed);
        const mergedLimitations = this.mergeKnowledgeField(existing.limitations, knowledge.limitations);
        const mergedUseCases = this.mergeKnowledgeField(existing.useCases, knowledge.useCases);
        const mergedExamples = this.appendKnowledgeField(existing.examples, knowledge.examples);

        // Merge related methods
        const existingRelated = existing.relatedMethods
          ? JSON.parse(existing.relatedMethods as string)
          : [];
        const mergedRelated = Array.from(new Set([...existingRelated, ...(knowledge.relatedMethods || [])]));

        // Merge aliases
        const existingAliases = existing.aliases
          ? JSON.parse(existing.aliases as string)
          : [];
        const mergedAliases = Array.from(new Set([...existingAliases, ...(knowledge.aliases || [])]));

        await prisma.methodology_knowledge.update({
          where: {
            userId_name: {
              userId,
              name: normalizedName,
            },
          },
          data: {
            definition: mergedDefinition,
            howItWorks: mergedHowItWorks,
            whyUsed: mergedWhyUsed,
            limitations: mergedLimitations,
            useCases: mergedUseCases,
            examples: mergedExamples,
            relatedMethods: JSON.stringify(mergedRelated),
            aliases: JSON.stringify(mergedAliases),
            parentMethod: knowledge.parentMethod || existing.parentMethod,
            sourceDocumentIds: JSON.stringify(newSourceDocs),
            documentCount: newSourceDocs.length,
            confidence: Math.max(existing.confidence || 0, knowledge.confidence || 0),
            updatedAt: new Date(),
          },
        });

        console.log(`   ✅ Updated existing knowledge (now ${newSourceDocs.length} sources)`);
      } else {
        // Create new knowledge entry
        await prisma.methodology_knowledge.create({
          data: {
            userId,
            name: normalizedName,
            aliases: JSON.stringify(knowledge.aliases || []),
            definition: knowledge.definition || null,
            howItWorks: knowledge.howItWorks || null,
            whyUsed: knowledge.whyUsed || null,
            limitations: knowledge.limitations || null,
            useCases: knowledge.useCases || null,
            examples: knowledge.examples || null,
            relatedMethods: JSON.stringify(knowledge.relatedMethods || []),
            parentMethod: knowledge.parentMethod || null,
            childMethods: JSON.stringify(knowledge.childMethods || []),
            sourceDocumentIds: JSON.stringify([documentId]),
            documentCount: 1,
            confidence: knowledge.confidence || 0.5,
          },
        });

        console.log(`   ✅ Created new knowledge entry`);
      }
    } catch (error) {
      console.error(`❌ [KNOWLEDGE] Failed to store knowledge:`, error);
      throw error;
    }
  }

  /**
   * Merge knowledge fields - prefer longer, more detailed content
   */
  private mergeKnowledgeField(existing: string | null, newValue: string | undefined): string | null {
    if (!existing && !newValue) return null;
    if (!existing) return newValue || null;
    if (!newValue) return existing;

    // Prefer the longer, more detailed version
    if (newValue.length > existing.length * 1.2) {
      return newValue;
    }
    return existing;
  }

  /**
   * Append knowledge fields (for examples)
   */
  private appendKnowledgeField(existing: string | null, newValue: string | undefined): string | null {
    if (!existing && !newValue) return null;
    if (!existing) return newValue || null;
    if (!newValue) return existing;

    // Append new examples if they're different
    if (!existing.includes(newValue.substring(0, 50))) {
      return `${existing}\n\n${newValue}`;
    }
    return existing;
  }

  /**
   * Get methodology knowledge from database
   * Used for "What is X?" queries
   */
  async getMethodologyKnowledge(
    userId: string,
    methodologyName: string
  ): Promise<MethodologyKnowledge | null> {
    const normalizedName = this.normalizeMethodologyName(methodologyName);

    console.log(`🔍 [KNOWLEDGE] Looking up "${normalizedName}" for user ${userId}`);

    try {
      // Try exact match first
      let knowledge = await prisma.methodology_knowledge.findUnique({
        where: {
          userId_name: {
            userId,
            name: normalizedName,
          },
        },
      });

      // If not found, try partial match on name or aliases
      if (!knowledge) {
        const allKnowledge = await prisma.methodology_knowledge.findMany({
          where: { userId },
        });

        // Search in names and aliases
        for (const k of allKnowledge) {
          if (k.name.includes(normalizedName) || normalizedName.includes(k.name)) {
            knowledge = k;
            break;
          }

          const aliases = k.aliases ? JSON.parse(k.aliases as string) : [];
          for (const alias of aliases) {
            if (alias.toLowerCase().includes(normalizedName) ||
                normalizedName.includes(alias.toLowerCase())) {
              knowledge = k;
              break;
            }
          }
          if (knowledge) break;
        }
      }

      if (!knowledge) {
        console.log(`   ⚠️ No knowledge found for "${normalizedName}"`);
        return null;
      }

      // Update access count
      await prisma.methodology_knowledge.update({
        where: { id: knowledge.id },
        data: {
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 },
        },
      });

      console.log(`   ✅ Found knowledge from ${knowledge.documentCount} documents`);

      return {
        name: knowledge.name,
        aliases: knowledge.aliases ? JSON.parse(knowledge.aliases as string) : [],
        definition: knowledge.definition || undefined,
        howItWorks: knowledge.howItWorks || undefined,
        whyUsed: knowledge.whyUsed || undefined,
        limitations: knowledge.limitations || undefined,
        useCases: knowledge.useCases || undefined,
        examples: knowledge.examples || undefined,
        relatedMethods: knowledge.relatedMethods ? JSON.parse(knowledge.relatedMethods as string) : [],
        parentMethod: knowledge.parentMethod || undefined,
        childMethods: knowledge.childMethods ? JSON.parse(knowledge.childMethods as string) : [],
        sourceDocumentIds: knowledge.sourceDocumentIds ? JSON.parse(knowledge.sourceDocumentIds as string) : [],
        documentCount: knowledge.documentCount || 0,
        confidence: knowledge.confidence || 0,
      };
    } catch (error) {
      console.error(`❌ [KNOWLEDGE] Lookup failed:`, error);
      return null;
    }
  }

  /**
   * Format methodology knowledge for response
   * Transforms database knowledge into a ChatGPT-style explanation
   */
  formatKnowledgeForResponse(knowledge: MethodologyKnowledge): string {
    const parts: string[] = [];

    // Start with definition
    if (knowledge.definition) {
      parts.push(`**${this.capitalizeMethodology(knowledge.name)}** is ${knowledge.definition}`);
    } else {
      parts.push(`**${this.capitalizeMethodology(knowledge.name)}**`);
    }

    // How it works
    if (knowledge.howItWorks) {
      parts.push(`\n**How it works:** ${knowledge.howItWorks}`);
    }

    // Why it's used
    if (knowledge.whyUsed) {
      parts.push(`\n**Why it's used:** ${knowledge.whyUsed}`);
    }

    // Use cases
    if (knowledge.useCases) {
      parts.push(`\n**Common applications:** ${knowledge.useCases}`);
    }

    // Limitations (if any)
    if (knowledge.limitations) {
      parts.push(`\n**Limitations:** ${knowledge.limitations}`);
    }

    // Examples from user's documents
    if (knowledge.examples) {
      parts.push(`\n**In your documents:** ${knowledge.examples}`);
    }

    // Related methods
    if (knowledge.relatedMethods && knowledge.relatedMethods.length > 0) {
      const related = knowledge.relatedMethods.slice(0, 5).map(m => this.capitalizeMethodology(m)).join(', ');
      parts.push(`\n**Related methods:** ${related}`);
    }

    // Source info
    if (knowledge.documentCount && knowledge.documentCount > 0) {
      parts.push(`\n\n*Based on ${knowledge.documentCount} document${knowledge.documentCount > 1 ? 's' : ''} in your library.*`);
    }

    return parts.join('');
  }

  /**
   * Get all methodology knowledge for a user
   * Used for methodology overview queries
   */
  async getAllMethodologyKnowledge(userId: string): Promise<MethodologyKnowledge[]> {
    try {
      const allKnowledge = await prisma.methodology_knowledge.findMany({
        where: { userId },
        orderBy: [
          { documentCount: 'desc' },
          { accessCount: 'desc' },
        ],
      });

      return allKnowledge.map(k => ({
        name: k.name,
        aliases: k.aliases ? JSON.parse(k.aliases as string) : [],
        definition: k.definition || undefined,
        howItWorks: k.howItWorks || undefined,
        whyUsed: k.whyUsed || undefined,
        limitations: k.limitations || undefined,
        useCases: k.useCases || undefined,
        examples: k.examples || undefined,
        relatedMethods: k.relatedMethods ? JSON.parse(k.relatedMethods as string) : [],
        parentMethod: k.parentMethod || undefined,
        childMethods: k.childMethods ? JSON.parse(k.childMethods as string) : [],
        sourceDocumentIds: k.sourceDocumentIds ? JSON.parse(k.sourceDocumentIds as string) : [],
        documentCount: k.documentCount || 0,
        confidence: k.confidence || 0,
      }));
    } catch (error) {
      console.error(`❌ [KNOWLEDGE] Failed to get all knowledge:`, error);
      return [];
    }
  }

  /**
   * Process document and extract+store methodology knowledge
   * This should be called during document indexing
   */
  async processDocumentForKnowledge(
    userId: string,
    documentId: string,
    extractedText: string
  ): Promise<void> {
    console.log(`📚 [KNOWLEDGE] Processing document ${documentId} for methodology knowledge`);

    const startTime = Date.now();

    // First, extract methodologies from the document
    const extraction = await this.extractFromDocument(extractedText, documentId, true);

    // For each methodology found, extract and store detailed knowledge
    const primaryMethodologies = extraction.methodologies.filter(m => m.isPrimary);
    const otherMethodologies = extraction.methodologies.filter(m => !m.isPrimary);

    // Process primary methodologies first (more important)
    const methodologiesToProcess = [...primaryMethodologies, ...otherMethodologies.slice(0, 5)];

    console.log(`   📝 Processing ${methodologiesToProcess.length} methodologies`);

    for (const methodology of methodologiesToProcess) {
      try {
        const knowledge = await this.extractMethodologyKnowledge(
          methodology.name,
          extractedText,
          documentId
        );

        if (knowledge) {
          await this.storeMethodologyKnowledge(userId, knowledge.knowledge, documentId);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to process "${methodology.name}":`, error);
        // Continue with other methodologies
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ [KNOWLEDGE] Document processed in ${processingTime}ms`);
  }

  /**
   * Detect if a query is asking about a methodology definition
   * Returns the methodology name if detected, null otherwise
   */
  detectMethodologyQuery(query: string): string | null {
    const lowerQuery = query.toLowerCase().trim();

    // Patterns for methodology queries
    const patterns = [
      /^what\s+is\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s*\?)?$/i,
      /^explain\s+(?:what\s+)?(?:is\s+)?(?:a\s+|an\s+|the\s+)?(.+?)(?:\s*\?)?$/i,
      /^define\s+(.+?)(?:\s*\?)?$/i,
      /^what\s+does\s+(.+?)\s+mean(?:\s*\?)?$/i,
      /^tell\s+me\s+about\s+(.+?)(?:\s*\?)?$/i,
      /^how\s+does\s+(.+?)\s+work(?:\s*\?)?$/i,
    ];

    for (const pattern of patterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        const term = match[1].trim();
        // Check if this looks like a methodology term
        if (this.looksLikeMethodology(term)) {
          return term;
        }
      }
    }

    return null;
  }

  /**
   * Check if a term looks like a methodology/technique name
   */
  private looksLikeMethodology(term: string): boolean {
    const lowerTerm = term.toLowerCase();

    // Check against known methodology keywords
    const methodologyIndicators = [
      'learning', 'optimization', 'analysis', 'regression', 'classification',
      'clustering', 'network', 'model', 'algorithm', 'method', 'technique',
      'approach', 'framework', 'theory', 'estimation', 'detection',
      'extraction', 'processing', 'recognition', 'prediction', 'inference',
      'sampling', 'encoding', 'embedding', 'training', 'testing',
    ];

    for (const indicator of methodologyIndicators) {
      if (lowerTerm.includes(indicator)) {
        return true;
      }
    }

    // Check against known methodology names
    for (const categoryKeywords of Object.values(METHODOLOGY_CATEGORIES)) {
      for (const keyword of categoryKeywords) {
        if (lowerTerm.includes(keyword) || keyword.includes(lowerTerm)) {
          return true;
        }
      }
    }

    return false;
  }
}

// Export singleton instance
export const methodologyExtractionService = new MethodologyExtractionService();
export default methodologyExtractionService;
