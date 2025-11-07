/**
 * Synthesis Service - Phase 2 Week 5-6
 * Handles multi-document analysis and cross-source synthesis
 * Enables KODA to analyze patterns, trends, and connections across documents
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface SynthesisResult {
  synthesis: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    relevantPoints: string[];
  }>;
  patterns: string[];
  insights: string[];
}

class SynthesisService {
  /**
   * Synthesize information across multiple documents
   * Identifies patterns, trends, and connections
   */
  async synthesizeAcrossDocuments(
    query: string,
    documents: Array<{
      documentId: string;
      documentName: string;
      content: string;
      metadata?: any;
    }>
  ): Promise<SynthesisResult> {
    console.log(`🔄 SYNTHESIS: Analyzing ${documents.length} documents`);

    // Group content by document
    const documentGroups = this.groupByDocument(documents);

    // Build synthesis prompt
    const synthesisPrompt = this.buildSynthesisPrompt(query, documentGroups);

    // Generate synthesis using LLM
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.4, // Balanced creativity for analysis
      },
    });

    const result = await model.generateContent(synthesisPrompt);
    const synthesisText = result.response.text();

    // Extract patterns and insights from synthesis
    const patterns = this.extractPatterns(synthesisText);
    const insights = this.extractInsights(synthesisText);

    // Build source references
    const sources = documentGroups.map(group => ({
      documentId: group.documentId,
      documentName: group.documentName,
      relevantPoints: this.extractRelevantPoints(group.content),
    }));

    return {
      synthesis: synthesisText,
      sources,
      patterns,
      insights,
    };
  }

  /**
   * Analyze trends across documents (financial data, metrics, etc.)
   */
  async analyzeTrends(
    documents: Array<{
      documentName: string;
      content: string;
      metadata?: any;
    }>
  ): Promise<{
    trends: string[];
    changes: string[];
    summary: string;
  }> {
    console.log(`📊 TREND ANALYSIS: Analyzing ${documents.length} documents`);

    const trendPrompt = `Analyze the following documents and identify trends, changes, and patterns:

${documents.map((doc, idx) => `**Document ${idx + 1}: ${doc.documentName}**\n${doc.content}`).join('\n\n---\n\n')}

**Task:**
1. Identify numerical trends (revenue growth, cost changes, metric improvements)
2. Detect qualitative changes (strategy shifts, new initiatives, policy updates)
3. Highlight patterns across documents (recurring themes, consistent approaches)

**Format:**
Provide a concise summary with bullet points for trends and changes.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(trendPrompt);
    const analysisText = result.response.text();

    return {
      trends: this.extractTrends(analysisText),
      changes: this.extractChanges(analysisText),
      summary: analysisText,
    };
  }

  /**
   * Compare multiple documents to identify similarities and differences
   */
  async compareDocuments(
    documents: Array<{
      documentName: string;
      content: string;
    }>
  ): Promise<{
    similarities: string[];
    differences: string[];
    summary: string;
  }> {
    console.log(`🔍 COMPARISON: Comparing ${documents.length} documents`);

    const comparePrompt = `Compare the following documents and identify key similarities and differences:

${documents.map((doc, idx) => `**Document ${idx + 1}: ${doc.documentName}**\n${doc.content}`).join('\n\n---\n\n')}

**Task:**
1. List key similarities across documents
2. List key differences between documents
3. Provide a brief comparative summary

**Format:**
Use bullet points for similarities and differences, followed by a paragraph summary.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(comparePrompt);
    const comparisonText = result.response.text();

    return {
      similarities: this.extractSimilarities(comparisonText),
      differences: this.extractDifferences(comparisonText),
      summary: comparisonText,
    };
  }

  /**
   * Group documents by ID
   */
  private groupByDocument(
    documents: Array<{
      documentId: string;
      documentName: string;
      content: string;
      metadata?: any;
    }>
  ): Array<{
    documentId: string;
    documentName: string;
    content: string;
    chunks: number;
  }> {
    const groups = new Map<string, string[]>();
    const names = new Map<string, string>();

    documents.forEach(doc => {
      if (!groups.has(doc.documentId)) {
        groups.set(doc.documentId, []);
        names.set(doc.documentId, doc.documentName);
      }
      groups.get(doc.documentId)!.push(doc.content);
    });

    return Array.from(groups.entries()).map(([documentId, contents]) => ({
      documentId,
      documentName: names.get(documentId) || 'Unknown',
      content: contents.join('\n\n'),
      chunks: contents.length,
    }));
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(
    query: string,
    documentGroups: Array<{
      documentId: string;
      documentName: string;
      content: string;
    }>
  ): string {
    return `You are analyzing multiple documents to answer a user's question.

**User Question:** ${query}

**Documents:**
${documentGroups.map((group, idx) => `
**Document ${idx + 1}: ${group.documentName}**
${group.content}
`).join('\n\n---\n\n')}

**Task:**
Synthesize information across these documents to answer the question. Identify:
1. Common patterns or themes
2. Contradictions or differences
3. Trends or changes over time
4. Key insights from combining multiple sources

**Format:**
Provide a comprehensive answer with:
- Main findings (bullet points)
- Patterns identified
- Key insights
- Source attribution (mention which document contains which information)

Be specific and reference document names when making claims.`;
  }

  /**
   * Extract patterns from synthesis text
   */
  private extractPatterns(text: string): string[] {
    const patterns: string[] = [];

    // Look for explicit pattern mentions
    const patternRegex = /(?:pattern|recurring|consistent|trend)[:\s]+([^.\n]+)/gi;
    let match;

    while ((match = patternRegex.exec(text)) !== null) {
      if (match[1]?.trim()) {
        patterns.push(match[1].trim());
      }
    }

    return patterns.slice(0, 5); // Limit to top 5 patterns
  }

  /**
   * Extract insights from synthesis text
   */
  private extractInsights(text: string): string[] {
    const insights: string[] = [];

    // Look for insight indicators
    const insightRegex = /(?:insight|notable|important|significant)[:\s]+([^.\n]+)/gi;
    let match;

    while ((match = insightRegex.exec(text)) !== null) {
      if (match[1]?.trim()) {
        insights.push(match[1].trim());
      }
    }

    return insights.slice(0, 5); // Limit to top 5 insights
  }

  /**
   * Extract relevant points from document content
   */
  private extractRelevantPoints(content: string): string[] {
    // Split content into sentences and take first 3 as relevant points
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  /**
   * Extract trends from analysis text
   */
  private extractTrends(text: string): string[] {
    const trends: string[] = [];
    const trendRegex = /(?:trend|growth|increase|decrease|change)[:\s]+([^.\n]+)/gi;
    let match;

    while ((match = trendRegex.exec(text)) !== null) {
      if (match[1]?.trim()) {
        trends.push(match[1].trim());
      }
    }

    return trends.slice(0, 5);
  }

  /**
   * Extract changes from analysis text
   */
  private extractChanges(text: string): string[] {
    const changes: string[] = [];
    const changeRegex = /(?:change|shift|transition|update)[:\s]+([^.\n]+)/gi;
    let match;

    while ((match = changeRegex.exec(text)) !== null) {
      if (match[1]?.trim()) {
        changes.push(match[1].trim());
      }
    }

    return changes.slice(0, 5);
  }

  /**
   * Extract similarities from comparison text
   */
  private extractSimilarities(text: string): string[] {
    const similarities: string[] = [];
    const simRegex = /(?:similar|same|common|both)[:\s]+([^.\n]+)/gi;
    let match;

    while ((match = simRegex.exec(text)) !== null) {
      if (match[1]?.trim()) {
        similarities.push(match[1].trim());
      }
    }

    return similarities.slice(0, 5);
  }

  /**
   * Extract differences from comparison text
   */
  private extractDifferences(text: string): string[] {
    const differences: string[] = [];
    const diffRegex = /(?:different|differ|unlike|whereas|however)[:\s]+([^.\n]+)/gi;
    let match;

    while ((match = diffRegex.exec(text)) !== null) {
      if (match[1]?.trim()) {
        differences.push(match[1].trim());
      }
    }

    return differences.slice(0, 5);
  }

  /**
   * Detect if query requires multi-document synthesis
   */
  detectSynthesisIntent(query: string, sourceCount: number): boolean {
    const queryLower = query.toLowerCase();

    // Explicit synthesis patterns
    const synthesisPatterns = [
      /compare.*documents?/i,
      /across.*(?:all|multiple|these)/i,
      /pattern|trend|change/i,
      /similarities?.*differences?/i,
      /how.*differ/i,
      /what.*common/i,
      /analyze.*together/i,
      /synthesize/i,
    ];

    // Check if query explicitly asks for synthesis
    const hasExplicitIntent = synthesisPatterns.some(pattern => pattern.test(queryLower));

    // Or if multiple documents are involved
    const hasMultipleSources = sourceCount >= 2;

    return hasExplicitIntent || (hasMultipleSources &&
      (queryLower.includes('all') || queryLower.includes('together') || queryLower.includes('overall')));
  }
}

export const synthesisService = new SynthesisService();
export default synthesisService;
