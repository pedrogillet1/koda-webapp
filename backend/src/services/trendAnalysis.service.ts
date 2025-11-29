/**
 * Trend Analysis Service
 *
 * PURPOSE: Analyze temporal trends across user's document collection
 * WHY: Enable "What trends do you see?" queries with actual temporal analysis
 * HOW: Extract publication years, track methodology evolution, identify shifts
 * IMPACT: Transform "351 papers found" → "3 major trends across 2015-2024"
 *
 * Trend Types:
 * - Methodology Evolution: What methods were popular when? What's emerging?
 * - Topic Shifts: How have research topics changed over time?
 * - Data Source Trends: Shift from simulated to real data
 * - Integration Patterns: New combinations of techniques
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import { methodologyExtractionService } from './methodologyExtraction.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocumentTemporalData {
  documentId: string;
  filename: string;
  year: number | null;
  methodologies: string[];
  topics: string[];
  dataTypes: string[];  // simulated, real, mixed
}

export interface TrendPeriod {
  label: string;        // "2015-2019", "2020-2024"
  startYear: number;
  endYear: number;
  documentCount: number;
  topMethodologies: Array<{ name: string; count: number; percentage: number }>;
  topTopics: Array<{ name: string; count: number }>;
}

export interface IdentifiedTrend {
  title: string;            // "Shift from Single to Ensemble Methods"
  period: string;           // "2020-2024"
  type: 'emerging' | 'declining' | 'shift' | 'stable' | 'integration';
  description: string;      // Detailed explanation
  evidence: {
    beforeCount?: number;
    afterCount?: number;
    percentageChange?: number;
    examples?: string[];
  };
  confidence: number;       // 0-1
}

export interface TrendAnalysisResult {
  totalDocuments: number;
  yearRange: { min: number; max: number };
  periods: TrendPeriod[];
  trends: IdentifiedTrend[];
  summary: string;
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND ANALYSIS SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class TrendAnalysisService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN ANALYSIS METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Perform comprehensive trend analysis on user's document collection
   */
  async analyzeUserTrends(userId: string): Promise<TrendAnalysisResult> {
    const startTime = Date.now();
    console.log(`📊 [TRENDS] Starting trend analysis for user ${userId}`);

    // Step 1: Get all documents with temporal data
    const documents = await this.getDocumentsWithTemporalData(userId);

    if (documents.length < 5) {
      console.log(`   ⚠️ Not enough documents for trend analysis (${documents.length})`);
      return this.createMinimalResult(documents.length, startTime);
    }

    // Step 2: Filter documents with valid years
    const datedDocuments = documents.filter(d => d.year !== null && d.year >= 1990 && d.year <= new Date().getFullYear() + 1);

    if (datedDocuments.length < 5) {
      console.log(`   ⚠️ Not enough dated documents for trend analysis (${datedDocuments.length})`);
      return this.createMinimalResult(documents.length, startTime, 'Unable to identify publication years for most documents.');
    }

    // Step 3: Determine year range and periods
    const years = datedDocuments.map(d => d.year as number).sort((a, b) => a - b);
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const yearSpan = maxYear - minYear;

    console.log(`   📅 Year range: ${minYear}-${maxYear} (${yearSpan} years, ${datedDocuments.length} dated documents)`);

    // Step 4: Create time periods for comparison
    const periods = this.createTimePeriods(datedDocuments, minYear, maxYear);

    // Step 5: Identify trends
    const trends = await this.identifyTrends(datedDocuments, periods, minYear, maxYear);

    // Step 6: Generate summary
    const summary = this.generateTrendSummary(trends, documents.length, minYear, maxYear);

    const processingTime = Date.now() - startTime;
    console.log(`✅ [TRENDS] Analysis complete in ${processingTime}ms: ${trends.length} trends identified`);

    return {
      totalDocuments: documents.length,
      yearRange: { min: minYear, max: maxYear },
      periods,
      trends,
      summary,
      processingTime,
    };
  }

  /**
   * Get documents with temporal and methodology data
   */
  private async getDocumentsWithTemporalData(userId: string): Promise<DocumentTemporalData[]> {
    // Get documents with metadata
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: 'completed',
      },
      include: {
        metadata: true,
      },
    });

    // Get methodology knowledge for this user
    const methodologyKnowledge = await prisma.methodologyKnowledge.findMany({
      where: { userId },
    });

    // Build document-to-methodologies map
    const docMethodologies = new Map<string, string[]>();
    for (const mk of methodologyKnowledge) {
      const docIds = mk.sourceDocumentIds ? JSON.parse(mk.sourceDocumentIds as string) : [];
      for (const docId of docIds) {
        if (!docMethodologies.has(docId)) {
          docMethodologies.set(docId, []);
        }
        docMethodologies.get(docId)!.push(mk.name);
      }
    }

    // Process each document
    const result: DocumentTemporalData[] = [];

    for (const doc of documents) {
      // Extract year from metadata or filename
      let year: number | null = null;

      // Try metadata first
      if (doc.metadata?.creationDate) {
        year = new Date(doc.metadata.creationDate).getFullYear();
      }

      // Try to extract from filename or content
      if (!year) {
        year = this.extractYearFromFilename(doc.filename);
      }

      // Try to extract from topics/keywords
      if (!year && doc.metadata?.topics) {
        try {
          const topics = JSON.parse(doc.metadata.topics);
          // Look for year patterns in topics
          for (const topic of topics) {
            const yearMatch = topic.match(/\b(19\d{2}|20[0-2]\d)\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[1]);
              break;
            }
          }
        } catch (e) { /* ignore */ }
      }

      // Extract topics from metadata
      let topics: string[] = [];
      if (doc.metadata?.topics) {
        try {
          topics = JSON.parse(doc.metadata.topics);
        } catch (e) { /* ignore */ }
      }
      if (doc.metadata?.keyEntities) {
        try {
          const entities = JSON.parse(doc.metadata.keyEntities);
          topics = [...topics, ...entities];
        } catch (e) { /* ignore */ }
      }

      // Detect data types from content
      const dataTypes = this.detectDataTypes(doc.metadata?.extractedText || '');

      result.push({
        documentId: doc.id,
        filename: doc.filename,
        year,
        methodologies: docMethodologies.get(doc.id) || [],
        topics: topics.slice(0, 10),
        dataTypes,
      });
    }

    return result;
  }

  /**
   * Extract year from filename
   */
  private extractYearFromFilename(filename: string): number | null {
    // Common patterns: "Paper_2023.pdf", "2023_study.pdf", "research-2023.pdf"
    const patterns = [
      /[_\-\s]?(20[0-2]\d)[_\-\s\.]/,
      /[_\-\s]?(19\d{2})[_\-\s\.]/,
      /\((20[0-2]\d)\)/,
      /\((19\d{2})\)/,
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        if (year >= 1990 && year <= new Date().getFullYear() + 1) {
          return year;
        }
      }
    }

    return null;
  }

  /**
   * Detect data types mentioned in document
   */
  private detectDataTypes(text: string): string[] {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    const types: string[] = [];

    // Simulated data indicators
    if (/simulated|synthetic|generated data|monte carlo simulation|artificial data/i.test(lowerText)) {
      types.push('simulated');
    }

    // Real data indicators
    if (/real.{0,10}data|historical data|s&p 500|dow jones|nasdaq|actual market|empirical data|real-world/i.test(lowerText)) {
      types.push('real');
    }

    // Specific datasets
    if (/mnist|cifar|imagenet|yahoo finance|bloomberg|reuters|kaggle/i.test(lowerText)) {
      types.push('real');
    }

    if (types.length === 0) {
      types.push('unknown');
    } else if (types.includes('simulated') && types.includes('real')) {
      return ['mixed'];
    }

    return [...new Set(types)];
  }

  /**
   * Create time periods for trend comparison
   */
  private createTimePeriods(
    documents: DocumentTemporalData[],
    minYear: number,
    maxYear: number
  ): TrendPeriod[] {
    const yearSpan = maxYear - minYear;
    const periods: TrendPeriod[] = [];

    // Determine period size based on year span
    let periodSize: number;
    if (yearSpan <= 5) {
      periodSize = 2; // 2-year periods for short spans
    } else if (yearSpan <= 10) {
      periodSize = 3; // 3-year periods for medium spans
    } else {
      periodSize = 5; // 5-year periods for long spans
    }

    // Create periods
    for (let startYear = minYear; startYear <= maxYear; startYear += periodSize) {
      const endYear = Math.min(startYear + periodSize - 1, maxYear);

      // Get documents in this period
      const periodDocs = documents.filter(
        d => d.year !== null && d.year >= startYear && d.year <= endYear
      );

      if (periodDocs.length === 0) continue;

      // Count methodologies
      const methodologyCounts = new Map<string, number>();
      for (const doc of periodDocs) {
        for (const method of doc.methodologies) {
          methodologyCounts.set(method, (methodologyCounts.get(method) || 0) + 1);
        }
      }

      // Count topics
      const topicCounts = new Map<string, number>();
      for (const doc of periodDocs) {
        for (const topic of doc.topics) {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        }
      }

      // Sort and get top items
      const topMethodologies = Array.from(methodologyCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / periodDocs.length) * 100),
        }));

      const topTopics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      periods.push({
        label: startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`,
        startYear,
        endYear,
        documentCount: periodDocs.length,
        topMethodologies,
        topTopics,
      });
    }

    return periods;
  }

  /**
   * Identify trends from temporal data
   */
  private async identifyTrends(
    documents: DocumentTemporalData[],
    periods: TrendPeriod[],
    minYear: number,
    maxYear: number
  ): Promise<IdentifiedTrend[]> {
    const trends: IdentifiedTrend[] = [];

    if (periods.length < 2) {
      return trends;
    }

    // Split into early and recent periods
    const midpoint = Math.floor(periods.length / 2);
    const earlyPeriods = periods.slice(0, midpoint);
    const recentPeriods = periods.slice(midpoint);

    // Aggregate methodology counts for each half
    const earlyMethods = this.aggregateMethodologies(earlyPeriods);
    const recentMethods = this.aggregateMethodologies(recentPeriods);

    const earlyTotal = earlyPeriods.reduce((sum, p) => sum + p.documentCount, 0);
    const recentTotal = recentPeriods.reduce((sum, p) => sum + p.documentCount, 0);

    // Find emerging methodologies (appear more in recent, less in early)
    for (const [method, recentCount] of Array.from(recentMethods.entries())) {
      const earlyCount = earlyMethods.get(method) || 0;

      // Normalize by total documents in each period
      const earlyRate = earlyTotal > 0 ? earlyCount / earlyTotal : 0;
      const recentRate = recentTotal > 0 ? recentCount / recentTotal : 0;

      // Emerging: significantly more common in recent period
      if (recentRate > earlyRate * 2 && recentCount >= 3) {
        const percentageChange = earlyRate > 0
          ? Math.round(((recentRate - earlyRate) / earlyRate) * 100)
          : 100;

        trends.push({
          title: `Rise of ${this.capitalizeMethodology(method)}`,
          period: `${recentPeriods[0].startYear}-${recentPeriods[recentPeriods.length - 1].endYear}`,
          type: 'emerging',
          description: earlyCount === 0
            ? `${this.capitalizeMethodology(method)} emerged in recent papers (${recentCount} papers since ${recentPeriods[0].startYear}), indicating a new research direction.`
            : `${this.capitalizeMethodology(method)} usage increased significantly—from ${earlyCount} papers (${Math.round(earlyRate * 100)}%) in earlier work to ${recentCount} papers (${Math.round(recentRate * 100)}%) recently.`,
          evidence: {
            beforeCount: earlyCount,
            afterCount: recentCount,
            percentageChange,
          },
          confidence: Math.min(0.9, 0.5 + (recentCount / 20)),
        });
      }
    }

    // Find declining methodologies
    for (const [method, earlyCount] of Array.from(earlyMethods.entries())) {
      const recentCount = recentMethods.get(method) || 0;

      const earlyRate = earlyTotal > 0 ? earlyCount / earlyTotal : 0;
      const recentRate = recentTotal > 0 ? recentCount / recentTotal : 0;

      // Declining: significantly less common in recent period
      if (earlyRate > recentRate * 2 && earlyCount >= 3) {
        const percentageChange = Math.round(((earlyRate - recentRate) / earlyRate) * 100);

        trends.push({
          title: `Decline of ${this.capitalizeMethodology(method)}`,
          period: `${earlyPeriods[0].startYear}-${earlyPeriods[earlyPeriods.length - 1].endYear}`,
          type: 'declining',
          description: recentCount === 0
            ? `${this.capitalizeMethodology(method)} was popular in earlier papers (${earlyCount} papers) but is absent from recent work, suggesting the field has moved on.`
            : `${this.capitalizeMethodology(method)} usage decreased—from ${earlyCount} papers (${Math.round(earlyRate * 100)}%) in earlier work to ${recentCount} papers (${Math.round(recentRate * 100)}%) recently.`,
          evidence: {
            beforeCount: earlyCount,
            afterCount: recentCount,
            percentageChange,
          },
          confidence: Math.min(0.9, 0.5 + (earlyCount / 20)),
        });
      }
    }

    // Detect data type shifts
    const dataTypeTrend = this.detectDataTypeShift(documents, minYear, maxYear);
    if (dataTypeTrend) {
      trends.push(dataTypeTrend);
    }

    // Detect methodology integration trends
    const integrationTrends = this.detectIntegrationTrends(documents, minYear, maxYear);
    trends.push(...integrationTrends);

    // Sort by confidence and limit
    trends.sort((a, b) => b.confidence - a.confidence);
    return trends.slice(0, 5);
  }

  /**
   * Aggregate methodology counts from periods
   */
  private aggregateMethodologies(periods: TrendPeriod[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const period of periods) {
      for (const method of period.topMethodologies) {
        counts.set(method.name, (counts.get(method.name) || 0) + method.count);
      }
    }

    return counts;
  }

  /**
   * Detect shift from simulated to real data
   */
  private detectDataTypeShift(
    documents: DocumentTemporalData[],
    minYear: number,
    maxYear: number
  ): IdentifiedTrend | null {
    const midYear = Math.floor((minYear + maxYear) / 2);

    const earlyDocs = documents.filter(d => d.year !== null && d.year <= midYear);
    const recentDocs = documents.filter(d => d.year !== null && d.year > midYear);

    if (earlyDocs.length < 3 || recentDocs.length < 3) return null;

    const earlySimulated = earlyDocs.filter(d => d.dataTypes.includes('simulated')).length;
    const earlyReal = earlyDocs.filter(d => d.dataTypes.includes('real')).length;
    const recentSimulated = recentDocs.filter(d => d.dataTypes.includes('simulated')).length;
    const recentReal = recentDocs.filter(d => d.dataTypes.includes('real')).length;

    const earlySimRate = earlySimulated / earlyDocs.length;
    const earlyRealRate = earlyReal / earlyDocs.length;
    const recentSimRate = recentSimulated / recentDocs.length;
    const recentRealRate = recentReal / recentDocs.length;

    // Detect shift from simulated to real data
    if (earlySimRate > 0.3 && recentRealRate > earlyRealRate * 1.5 && recentRealRate > 0.4) {
      return {
        title: 'Shift from Simulated to Real Data',
        period: `${midYear + 1}-${maxYear}`,
        type: 'shift',
        description: `Before ${midYear + 1}, ${Math.round(earlySimRate * 100)}% of papers used simulated environments. After ${midYear}, ${Math.round(recentRealRate * 100)}% validate on real market data—indicating increased practical focus.`,
        evidence: {
          beforeCount: earlySimulated,
          afterCount: recentReal,
          percentageChange: Math.round((recentRealRate - earlyRealRate) * 100),
        },
        confidence: 0.75,
      };
    }

    return null;
  }

  /**
   * Detect methodology integration trends
   */
  private detectIntegrationTrends(
    documents: DocumentTemporalData[],
    minYear: number,
    maxYear: number
  ): IdentifiedTrend[] {
    const trends: IdentifiedTrend[] = [];
    const midYear = Math.floor((minYear + maxYear) / 2);

    // Count documents with multiple methodologies
    const earlyDocs = documents.filter(d => d.year !== null && d.year <= midYear);
    const recentDocs = documents.filter(d => d.year !== null && d.year > midYear);

    const earlyMultiMethod = earlyDocs.filter(d => d.methodologies.length >= 2).length;
    const recentMultiMethod = recentDocs.filter(d => d.methodologies.length >= 2).length;

    const earlyRate = earlyDocs.length > 0 ? earlyMultiMethod / earlyDocs.length : 0;
    const recentRate = recentDocs.length > 0 ? recentMultiMethod / recentDocs.length : 0;

    // If multi-methodology papers are increasing
    if (recentRate > earlyRate * 1.5 && recentMultiMethod >= 3) {
      trends.push({
        title: 'Integration of Multiple Methodologies',
        period: `${midYear + 1}-${maxYear}`,
        type: 'integration',
        description: `Recent papers increasingly combine multiple methodologies. ${Math.round(recentRate * 100)}% of recent papers use 2+ methods, compared to ${Math.round(earlyRate * 100)}% in earlier work—suggesting more sophisticated hybrid approaches.`,
        evidence: {
          beforeCount: earlyMultiMethod,
          afterCount: recentMultiMethod,
          percentageChange: Math.round((recentRate - earlyRate) * 100),
        },
        confidence: 0.7,
      });
    }

    // Find specific methodology combinations that are emerging
    const recentCombinations = new Map<string, number>();
    for (const doc of recentDocs) {
      if (doc.methodologies.length >= 2) {
        const sorted = doc.methodologies.slice().sort();
        for (let i = 0; i < sorted.length - 1; i++) {
          for (let j = i + 1; j < sorted.length; j++) {
            const combo = `${sorted[i]} + ${sorted[j]}`;
            recentCombinations.set(combo, (recentCombinations.get(combo) || 0) + 1);
          }
        }
      }
    }

    // Find most common new combination
    let topCombo = '';
    let topComboCount = 0;
    for (const [combo, count] of Array.from(recentCombinations.entries())) {
      if (count > topComboCount && count >= 2) {
        topCombo = combo;
        topComboCount = count;
      }
    }

    if (topCombo && topComboCount >= 3) {
      const [method1, method2] = topCombo.split(' + ');
      trends.push({
        title: `${this.capitalizeMethodology(method1)} + ${this.capitalizeMethodology(method2)} Integration`,
        period: `${midYear + 1}-${maxYear}`,
        type: 'integration',
        description: `The combination of ${this.capitalizeMethodology(method1)} and ${this.capitalizeMethodology(method2)} appears in ${topComboCount} recent papers, suggesting researchers are leveraging both approaches together.`,
        evidence: {
          afterCount: topComboCount,
          examples: [method1, method2],
        },
        confidence: 0.65,
      });
    }

    return trends;
  }

  /**
   * Generate human-readable summary of trends
   */
  private generateTrendSummary(
    trends: IdentifiedTrend[],
    totalDocuments: number,
    minYear: number,
    maxYear: number
  ): string {
    if (trends.length === 0) {
      return `Analyzing your ${totalDocuments} papers from ${minYear}-${maxYear}, no significant temporal trends were identified. This could mean your collection is relatively consistent in methodology, or publication years couldn't be determined for most documents.`;
    }

    const parts: string[] = [];
    parts.push(`Analyzing your ${totalDocuments} papers from ${minYear}-${maxYear}, I identified ${trends.length} major trend${trends.length > 1 ? 's' : ''}:\n`);

    trends.forEach((trend, index) => {
      parts.push(`**${index + 1}. ${trend.title}** (${trend.period})`);
      parts.push(trend.description);
      parts.push('');
    });

    return parts.join('\n');
  }

  /**
   * Create minimal result when analysis isn't possible
   */
  private createMinimalResult(
    documentCount: number,
    startTime: number,
    reason?: string
  ): TrendAnalysisResult {
    return {
      totalDocuments: documentCount,
      yearRange: { min: 0, max: 0 },
      periods: [],
      trends: [],
      summary: reason || `You have ${documentCount} documents. Trend analysis requires at least 5 documents with identifiable publication years.`,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Capitalize methodology name for display
   */
  private capitalizeMethodology(name: string): string {
    return name
      .split(/[-\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUERY DETECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Detect if a query is asking about trends
   */
  isTrendQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    const trendPatterns = [
      /\btrend/i,
      /\bevolv/i,           // evolving, evolution
      /\bchange.*over.*time/i,
      /\bshift/i,
      /\bemerging/i,
      /\bdeclining/i,
      /\bhistor/i,          // history, historical
      /\btemporal/i,
      /\bover.*years/i,
      /\bacross.*time/i,
      /\bthrough.*years/i,
      /\bhow.*changed/i,
      /\bwhat.*new/i,
      /\bwhat.*old/i,
      /\brecent.*vs/i,
      /\bearly.*vs/i,
      /\bpopular.*when/i,
      /\bwhen.*popular/i,
    ];

    return trendPatterns.some(pattern => pattern.test(lowerQuery));
  }

  /**
   * Format trend analysis for response
   */
  formatTrendAnalysisForResponse(result: TrendAnalysisResult): string {
    return result.summary;
  }
}

// Export singleton instance
export const trendAnalysisService = new TrendAnalysisService();
export default trendAnalysisService;
