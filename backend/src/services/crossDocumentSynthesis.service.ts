/**
 * Cross-Document Synthesis Service
 *
 * PURPOSE: Transform "47 papers found" → "3 main approaches across 47 papers"
 * WHY: Enable ChatGPT-level intelligence for cross-document queries
 * HOW: Aggregate methodologies, detect patterns, identify trends across documents
 *
 * Key Features:
 * 1. Methodology Aggregation: Group similar approaches across all documents
 * 2. Trend Detection: Track methodology usage over time
 * 3. Pattern Recognition: Identify common themes and shifts
 * 4. Intelligent Summaries: Generate human-readable synthesis responses
 *
 * Example:
 * Q: "What are the main approaches in my portfolio optimization papers?"
 * A: "Your 47 papers on portfolio optimization use three main approaches:
 *     • Mean-variance optimization — used in 23 papers
 *     • Black-Litterman model — used in 12 papers
 *     • Risk parity — used in 8 papers
 *     The trend shows a shift toward ensemble methods."
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import { methodologyExtractionService, ExtractedMethodology } from './methodologyExtraction.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SynthesisQueryDetection {
  isSynthesisQuery: boolean;
  synthesisType: 'methodology' | 'comparison' | 'trend' | 'pattern' | 'general' | null;
  topic?: string;
  confidence: number;
}

export interface MethodologyCount {
  name: string;
  normalizedName: string;
  count: number;
  documentIds: string[];
  documentNames: string[];
  primaryCount: number;
  category: string;
  description?: string;
}

export interface TrendAnalysis {
  methodology: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  oldPeriodCount: number;
  newPeriodCount: number;
  oldPeriodYears: string;
  newPeriodYears: string;
}

export interface CrossDocumentSynthesisResult {
  totalDocuments: number;
  matchingDocuments: number;
  methodologies: MethodologyCount[];
  trends: TrendAnalysis[];
  synthesis: string;
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHESIS QUERY PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const SYNTHESIS_PATTERNS = {
  methodology: [
    /what (?:are )?(?:the )?(?:main|primary|key|different|various) (?:approaches|methods|methodologies|techniques)/i,
    /(?:how many|which) (?:approaches|methods|methodologies|techniques)/i,
    /what (?:approaches|methods|methodologies|techniques) (?:are|do|does)/i,
    /(?:approaches|methods|methodologies|techniques) (?:used|employed|applied)/i,
    /(?:summarize|overview|summary) (?:of )?(?:the )?(?:approaches|methods|methodologies)/i,
    /what (?:are )?(?:the )?(?:research )?methods? (?:in|across|used)/i,
  ],
  comparison: [
    /compare (?:the )?(?:approaches|methods|methodologies|techniques)/i,
    /(?:differences?|similarities?) (?:between|among|in) (?:the )?(?:approaches|methods)/i,
    /how (?:do|does) (?:the )?(?:approaches|methods) (?:differ|compare)/i,
  ],
  trend: [
    /(?:trends?|shifts?|changes?) (?:in|across|over)/i,
    /(?:how|what) (?:has|have) (?:the )?(?:approaches|methods) (?:changed|evolved)/i,
    /(?:evolution|development|progression) (?:of|in) (?:the )?(?:approaches|methods)/i,
    /(?:older|newer|recent) (?:papers?|documents?|studies?) (?:use|employ|prefer)/i,
  ],
  pattern: [
    /(?:patterns?|themes?|commonalities?) (?:across|in|among)/i,
    /what (?:do|does) (?:the )?(?:papers?|documents?|studies?) (?:have in common|share)/i,
    /(?:recurring|common|frequent) (?:themes?|patterns?|topics?)/i,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// METHODOLOGY NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const METHODOLOGY_NORMALIZATIONS: Record<string, string> = {
  // Portfolio optimization
  'mean variance': 'Mean-Variance Optimization',
  'mean-variance': 'Mean-Variance Optimization',
  'markowitz': 'Mean-Variance Optimization',
  'mv optimization': 'Mean-Variance Optimization',
  'modern portfolio theory': 'Mean-Variance Optimization',
  'mpt': 'Mean-Variance Optimization',

  'black litterman': 'Black-Litterman Model',
  'black-litterman': 'Black-Litterman Model',
  'bl model': 'Black-Litterman Model',

  'risk parity': 'Risk Parity',
  'equal risk': 'Risk Parity',
  'equal risk contribution': 'Risk Parity',
  'erc': 'Risk Parity',

  'minimum variance': 'Minimum Variance',
  'min variance': 'Minimum Variance',
  'global minimum variance': 'Minimum Variance',

  'maximum sharpe': 'Maximum Sharpe Ratio',
  'max sharpe': 'Maximum Sharpe Ratio',
  'tangent portfolio': 'Maximum Sharpe Ratio',

  // Machine Learning
  'deep learning': 'Deep Learning',
  'neural network': 'Neural Networks',
  'neural networks': 'Neural Networks',
  'ann': 'Neural Networks',
  'dnn': 'Deep Learning',

  'random forest': 'Random Forest',
  'rf': 'Random Forest',

  'gradient boosting': 'Gradient Boosting',
  'gbm': 'Gradient Boosting',
  'xgboost': 'Gradient Boosting',
  'lightgbm': 'Gradient Boosting',
  'catboost': 'Gradient Boosting',

  'support vector': 'Support Vector Machines',
  'svm': 'Support Vector Machines',
  'svr': 'Support Vector Machines',

  'ensemble': 'Ensemble Methods',
  'ensemble learning': 'Ensemble Methods',
  'ensemble methods': 'Ensemble Methods',

  'reinforcement learning': 'Reinforcement Learning',
  'rl': 'Reinforcement Learning',
  'q-learning': 'Reinforcement Learning',

  // Statistical
  'linear regression': 'Linear Regression',
  'ols': 'Linear Regression',
  'ordinary least squares': 'Linear Regression',

  'logistic regression': 'Logistic Regression',

  'bayesian': 'Bayesian Methods',
  'bayesian inference': 'Bayesian Methods',
  'mcmc': 'Bayesian Methods',

  'monte carlo': 'Monte Carlo Simulation',
  'mc simulation': 'Monte Carlo Simulation',

  'time series': 'Time Series Analysis',
  'arima': 'Time Series Analysis',
  'garch': 'Time Series Analysis',
  'var': 'Vector Autoregression',

  // NLP
  'natural language processing': 'Natural Language Processing',
  'nlp': 'Natural Language Processing',
  'text mining': 'Natural Language Processing',
  'sentiment analysis': 'Sentiment Analysis',
  'topic modeling': 'Topic Modeling',
  'lda': 'Topic Modeling',
  'transformer': 'Transformer Models',
  'bert': 'Transformer Models',
  'gpt': 'Transformer Models',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-DOCUMENT SYNTHESIS SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class CrossDocumentSynthesisService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });
    }
  }

  /**
   * Detect if a query requires cross-document synthesis
   */
  detectSynthesisQuery(query: string): SynthesisQueryDetection {
    const queryLower = query.toLowerCase();

    // Check each pattern type
    for (const [type, patterns] of Object.entries(SYNTHESIS_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(queryLower)) {
          // Extract topic from query
          const topic = this.extractTopic(queryLower);

          return {
            isSynthesisQuery: true,
            synthesisType: type as any,
            topic,
            confidence: 0.9,
          };
        }
      }
    }

    // Check for implicit synthesis queries (multiple documents + aggregation words)
    const aggregationWords = ['all', 'across', 'overall', 'together', 'combined', 'total', 'average', 'summary'];
    const documentWords = ['papers', 'documents', 'files', 'studies', 'articles', 'reports'];

    const hasAggregation = aggregationWords.some(w => queryLower.includes(w));
    const hasDocumentRef = documentWords.some(w => queryLower.includes(w));

    if (hasAggregation && hasDocumentRef) {
      return {
        isSynthesisQuery: true,
        synthesisType: 'general',
        topic: this.extractTopic(queryLower),
        confidence: 0.7,
      };
    }

    return {
      isSynthesisQuery: false,
      synthesisType: null,
      confidence: 0,
    };
  }

  /**
   * Extract the topic from a synthesis query
   */
  private extractTopic(query: string): string | undefined {
    // Common topic extraction patterns
    const topicPatterns = [
      /(?:in|from|across) (?:my |the )?(.+?) (?:papers?|documents?|files?|studies?)/i,
      /(?:papers?|documents?|files?|studies?) (?:about|on|regarding) (.+)/i,
      /(.+?) (?:papers?|documents?|files?|studies?)/i,
    ];

    for (const pattern of topicPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Main synthesis method - aggregate methodologies across documents
   */
  async synthesizeMethodologies(
    userId: string,
    topic?: string,
    documentIds?: string[]
  ): Promise<CrossDocumentSynthesisResult> {
    const startTime = Date.now();
    console.log(`📊 [SYNTHESIS] Starting cross-document methodology synthesis for user ${userId}`);

    // Step 1: Get all user's methodology knowledge from database
    let methodologyKnowledge = await this.getMethodologyKnowledge(userId, topic);

    // Step 2: If no stored knowledge, extract from documents on-the-fly
    if (methodologyKnowledge.length === 0) {
      console.log(`   📝 No stored knowledge, extracting from documents...`);
      methodologyKnowledge = await this.extractFromDocuments(userId, topic, documentIds);
    }

    // Step 3: Get document metadata for context
    const documents = await this.getDocumentsWithMetadata(userId, topic, documentIds);
    const totalDocuments = documents.length;

    // Step 4: Aggregate methodology counts
    const methodologyCounts = this.aggregateMethodologies(methodologyKnowledge, documents);

    // Step 5: Analyze trends
    const trends = this.analyzeTrends(methodologyKnowledge, documents);

    // Step 6: Generate synthesis response
    const synthesis = await this.generateSynthesisResponse(
      methodologyCounts,
      trends,
      totalDocuments,
      topic
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ [SYNTHESIS] Complete in ${processingTime}ms: ${methodologyCounts.length} methodologies across ${totalDocuments} documents`);

    return {
      totalDocuments,
      matchingDocuments: methodologyCounts.reduce((sum, m) => sum + m.count, 0),
      methodologies: methodologyCounts.slice(0, 10), // Top 10
      trends: trends.slice(0, 5), // Top 5 trends
      synthesis,
      processingTime,
    };
  }

  /**
   * Get stored methodology knowledge for user
   */
  private async getMethodologyKnowledge(userId: string, topic?: string): Promise<any[]> {
    try {
      const where: any = { userId };

      if (topic) {
        // Search for methodologies related to topic
        where.OR = [
          { name: { contains: topic, mode: 'insensitive' } },
          { useCases: { contains: topic, mode: 'insensitive' } },
          { definition: { contains: topic, mode: 'insensitive' } },
        ];
      }

      return await prisma.methodology_knowledge.findMany({
        where,
        orderBy: { documentCount: 'desc' },
      });
    } catch (error) {
      console.warn(`⚠️ [SYNTHESIS] Error fetching methodology knowledge:`, error);
      return [];
    }
  }

  /**
   * Extract methodologies from documents on-the-fly (when no stored knowledge)
   */
  private async extractFromDocuments(
    userId: string,
    topic?: string,
    documentIds?: string[]
  ): Promise<any[]> {
    // Get document content
    const documents = await this.getDocumentsWithContent(userId, topic, documentIds);

    if (documents.length === 0) {
      return [];
    }

    // Extract methodologies from each document
    const allMethodologies: any[] = [];

    for (const doc of documents.slice(0, 50)) { // Limit to 50 documents for performance
      if (!doc.extractedText) continue;

      const result = await methodologyExtractionService.extractFromDocument(
        doc.extractedText,
        doc.id,
        false // Don't use LLM for batch processing
      );

      for (const m of result.methodologies) {
        allMethodologies.push({
          name: m.name,
          documentId: doc.id,
          documentName: doc.filename,
          year: result.document_metadata.year,
          isPrimary: m.isPrimary,
          category: m.category,
        });
      }
    }

    return allMethodologies;
  }

  /**
   * Get documents with extracted text content
   */
  private async getDocumentsWithContent(
    userId: string,
    topic?: string,
    documentIds?: string[]
  ): Promise<any[]> {
    try {
      const where: any = {
        userId,
        status: 'completed',
      };

      if (documentIds && documentIds.length > 0) {
        where.id = { in: documentIds };
      }

      const documents = await prisma.documents.findMany({
        where,
        include: {
          document_metadata: {
            select: {
              extractedText: true,
              topics: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit for performance
      });

      // Filter by topic if specified
      if (topic) {
        const topicLower = topic.toLowerCase();
        return documents.filter(doc => {
          const filename = doc.filename.toLowerCase();
          const text = doc.document_metadata?.extractedText?.toLowerCase() || '';
          const topics = doc.document_metadata?.topics?.toLowerCase() || '';

          return filename.includes(topicLower) ||
                 text.includes(topicLower) ||
                 topics.includes(topicLower);
        });
      }

      return documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        extractedText: doc.document_metadata?.extractedText,
        createdAt: doc.createdAt,
      }));
    } catch (error) {
      console.error(`❌ [SYNTHESIS] Error fetching documents:`, error);
      return [];
    }
  }

  /**
   * Get documents with metadata (without full text)
   */
  private async getDocumentsWithMetadata(
    userId: string,
    topic?: string,
    documentIds?: string[]
  ): Promise<any[]> {
    try {
      const where: any = {
        userId,
        status: 'completed',
      };

      if (documentIds && documentIds.length > 0) {
        where.id = { in: documentIds };
      }

      const documents = await prisma.documents.findMany({
        where,
        select: {
          id: true,
          filename: true,
          createdAt: true,
          document_metadata: {
            select: {
              topics: true,
              creationDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        year: doc.document_metadata?.creationDate?.getFullYear() || doc.createdAt.getFullYear(),
      }));
    } catch (error) {
      console.error(`❌ [SYNTHESIS] Error fetching document metadata:`, error);
      return [];
    }
  }

  /**
   * Aggregate methodologies from extracted data
   */
  private aggregateMethodologies(
    methodologyData: any[],
    documents: any[]
  ): MethodologyCount[] {
    const counts = new Map<string, MethodologyCount>();

    // Create document ID to name map
    const docNameMap = new Map<string, string>();
    for (const doc of documents) {
      docNameMap.set(doc.id, doc.filename);
    }

    for (const m of methodologyData) {
      // Normalize methodology name
      const normalizedName = this.normalizeMethodologyName(m.name);
      const key = normalizedName.toLowerCase();

      const existing = counts.get(key);

      if (existing) {
        existing.count++;
        if (m.documentId && !existing.documentIds.includes(m.documentId)) {
          existing.documentIds.push(m.documentId);
          const docName = docNameMap.get(m.documentId) || m.documentName || 'Unknown';
          existing.documentNames.push(docName);
        }
        if (m.isPrimary) {
          existing.primaryCount++;
        }
      } else {
        const docName = docNameMap.get(m.documentId) || m.documentName || 'Unknown';
        counts.set(key, {
          name: normalizedName,
          normalizedName,
          count: 1,
          documentIds: m.documentId ? [m.documentId] : [],
          documentNames: docName ? [docName] : [],
          primaryCount: m.isPrimary ? 1 : 0,
          category: m.category || 'other',
          description: m.definition || m.description,
        });
      }
    }

    // Sort by count (descending)
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Normalize methodology name to canonical form
   */
  private normalizeMethodologyName(name: string): string {
    const lowerName = name.toLowerCase().trim();

    // Check exact matches first
    for (const [pattern, normalized] of Object.entries(METHODOLOGY_NORMALIZATIONS)) {
      if (lowerName === pattern || lowerName.includes(pattern)) {
        return normalized;
      }
    }

    // Capitalize words if no normalization found
    return name.split(/[-\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Analyze trends in methodology usage over time
   */
  private analyzeTrends(
    methodologyData: any[],
    documents: any[]
  ): TrendAnalysis[] {
    // Group documents by year
    const docYears = new Map<string, number>();
    for (const doc of documents) {
      docYears.set(doc.id, doc.year);
    }

    // Get all years
    const years = Array.from(new Set(documents.map(d => d.year))).sort();

    if (years.length < 3) {
      return []; // Not enough data for trend analysis
    }

    // Split into old and new periods
    const midpoint = Math.floor(years.length / 2);
    const oldYears = years.slice(0, midpoint);
    const newYears = years.slice(midpoint);

    // Count methodologies by period
    const oldCounts = new Map<string, number>();
    const newCounts = new Map<string, number>();

    for (const m of methodologyData) {
      const year = m.year || docYears.get(m.documentId);
      if (!year) continue;

      const normalizedName = this.normalizeMethodologyName(m.name);

      if (oldYears.includes(year)) {
        oldCounts.set(normalizedName, (oldCounts.get(normalizedName) || 0) + 1);
      } else if (newYears.includes(year)) {
        newCounts.set(normalizedName, (newCounts.get(normalizedName) || 0) + 1);
      }
    }

    // Calculate trends
    const trends: TrendAnalysis[] = [];
    const allMethodologies = new Set([...oldCounts.keys(), ...newCounts.keys()]);

    for (const methodology of allMethodologies) {
      const oldCount = oldCounts.get(methodology) || 0;
      const newCount = newCounts.get(methodology) || 0;

      // Normalize by period length
      const oldNorm = oldCount / oldYears.length;
      const newNorm = newCount / newYears.length;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (newNorm > oldNorm * 1.5) {
        trend = 'increasing';
      } else if (newNorm < oldNorm * 0.5) {
        trend = 'decreasing';
      }

      if (trend !== 'stable' && (oldCount >= 2 || newCount >= 2)) {
        trends.push({
          methodology,
          trend,
          oldPeriodCount: oldCount,
          newPeriodCount: newCount,
          oldPeriodYears: `${Math.min(...oldYears)}-${Math.max(...oldYears)}`,
          newPeriodYears: `${Math.min(...newYears)}-${Math.max(...newYears)}`,
        });
      }
    }

    // Sort by significance (change magnitude)
    return trends.sort((a, b) => {
      const aDelta = Math.abs(a.newPeriodCount - a.oldPeriodCount);
      const bDelta = Math.abs(b.newPeriodCount - b.oldPeriodCount);
      return bDelta - aDelta;
    });
  }

  /**
   * Generate human-readable synthesis response
   */
  private async generateSynthesisResponse(
    methodologies: MethodologyCount[],
    trends: TrendAnalysis[],
    totalDocuments: number,
    topic?: string
  ): Promise<string> {
    if (methodologies.length === 0) {
      return `I couldn't identify specific methodologies across your documents${topic ? ` on "${topic}"` : ''}. This might be because the documents don't contain explicit methodology descriptions, or they cover diverse topics without common approaches.`;
    }

    const parts: string[] = [];

    // Main summary
    const topicPhrase = topic ? ` on **${topic}**` : '';
    const mainCount = methodologies.filter(m => m.count >= 2).length;

    if (mainCount > 0) {
      parts.push(`Your **${totalDocuments}** documents${topicPhrase} use **${mainCount}** main approaches:\n`);
    } else {
      parts.push(`Your **${totalDocuments}** documents${topicPhrase} mention these methodologies:\n`);
    }

    // Top methodologies with details
    const topMethods = methodologies.slice(0, 5);
    for (const m of topMethods) {
      const percentage = Math.round((m.count / totalDocuments) * 100);
      const primaryNote = m.primaryCount > 1 ? ` (primary method in ${m.primaryCount})` : '';
      const docCount = m.documentIds.length;

      if (m.description) {
        parts.push(`• **${m.name}** — ${m.description}. Used in ${docCount} documents (${percentage}%)${primaryNote}`);
      } else {
        parts.push(`• **${m.name}** — used in ${docCount} documents (${percentage}%)${primaryNote}`);
      }
    }

    // Add remaining methodologies count if there are more
    if (methodologies.length > 5) {
      const remainingCount = methodologies.length - 5;
      parts.push(`\n*Plus ${remainingCount} other methodologies mentioned less frequently.*`);
    }

    // Trends section
    if (trends.length > 0) {
      parts.push('\n**Trends:**');
      for (const trend of trends.slice(0, 3)) {
        if (trend.trend === 'increasing') {
          parts.push(`• **${trend.methodology}** usage is **increasing** (${trend.oldPeriodCount} → ${trend.newPeriodCount} papers)`);
        } else if (trend.trend === 'decreasing') {
          parts.push(`• **${trend.methodology}** usage is **decreasing** (${trend.oldPeriodCount} → ${trend.newPeriodCount} papers)`);
        }
      }

      // Add trend observation
      const increasing = trends.filter(t => t.trend === 'increasing').map(t => t.methodology);
      const decreasing = trends.filter(t => t.trend === 'decreasing').map(t => t.methodology);

      if (increasing.length > 0 && decreasing.length > 0) {
        parts.push(`\n*The trend shows a shift from ${decreasing.slice(0, 2).join(' and ')} toward ${increasing.slice(0, 2).join(' and ')}.*`);
      } else if (increasing.length > 0) {
        parts.push(`\n*There's growing interest in ${increasing.slice(0, 2).join(' and ')}.*`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Store methodology knowledge in database for faster future queries
   */
  async storeMethodologyKnowledge(
    userId: string,
    documentId: string,
    methodologies: ExtractedMethodology[]
  ): Promise<void> {
    console.log(`💾 [SYNTHESIS] Storing ${methodologies.length} methodologies for document ${documentId}`);

    for (const m of methodologies) {
      const normalizedName = this.normalizeMethodologyName(m.name).toLowerCase();

      try {
        // First try to find existing record
        const existing = await prisma.methodology_knowledge.findUnique({
          where: {
            userId_name: {
              userId,
              name: normalizedName,
            },
          },
        });

        if (existing) {
          // Parse existing sourceDocumentIds (stored as JSON string)
          let existingIds: string[] = [];
          try {
            existingIds = existing.sourceDocumentIds ? JSON.parse(existing.sourceDocumentIds) : [];
          } catch {
            existingIds = [];
          }

          // Add new documentId if not already present
          if (!existingIds.includes(documentId)) {
            existingIds.push(documentId);
          }

          await prisma.methodology_knowledge.update({
            where: {
              userId_name: {
                userId,
                name: normalizedName,
              },
            },
            data: {
              documentCount: { increment: 1 },
              sourceDocumentIds: JSON.stringify(existingIds),
              updatedAt: new Date(),
              // Update definition if we have a better one
              ...(m.description && { definition: m.description }),
            },
          });
        } else {
          await prisma.methodology_knowledge.create({
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
        // Ignore upsert errors (concurrent writes, etc.)
        console.warn(`⚠️ [SYNTHESIS] Error storing methodology "${normalizedName}":`, error);
      }
    }
  }

  /**
   * Clear methodology knowledge for a user (for re-indexing)
   */
  async clearMethodologyKnowledge(userId: string): Promise<void> {
    await prisma.methodology_knowledge.deleteMany({
      where: { userId },
    });
    console.log(`🗑️ [SYNTHESIS] Cleared methodology knowledge for user ${userId}`);
  }
}

// Export singleton instance
export const crossDocumentSynthesisService = new CrossDocumentSynthesisService();
export default crossDocumentSynthesisService;
