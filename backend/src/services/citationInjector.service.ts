/**
 * Citation Injector Service
 * Automatically adds source attributions to generated responses
 * Ensures transparency and traceability of information
 * Works post-generation to inject citations into uncited content
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

interface CitationInjectionResult {
  originalResponse: string;
  citedResponse: string;
  injectedCitations: number;
  coverage: number; // Percentage of content with citations
  warnings: string[];
}

interface CitationMapping {
  claimText: string;
  sourceDocument: string;
  sourceLocation?: string;
  confidence: number; // 0-1: How confident we are this source supports this claim
}

interface Document {
  id?: string;
  name?: string;
  title?: string;
  content?: string;
  text?: string;
  metadata?: any;
  score?: number;
  rerankScore?: number;
}

class CitationInjectorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Automatically inject citations into response
   * Uses LLM to map claims to supporting documents
   */
  async injectCitations(
    response: string,
    documents: Document[],
    options: {
      method?: 'llm' | 'keyword' | 'hybrid';
      minConfidence?: number;
      injectInline?: boolean;
    } = {}
  ): Promise<CitationInjectionResult> {
    const {
      method = 'hybrid',
      minConfidence = 0.6,
      injectInline = true
    } = options;

    console.log(`💉 Injecting citations (method: ${method})...`);

    const warnings: string[] = [];

    // Check if response already has citations
    const existingCitations = this.extractExistingCitations(response);
    if (existingCitations.length > 0) {
      console.log(`   Found ${existingCitations.length} existing citations, preserving them`);
    }

    // Split response into segments (paragraphs or sentences)
    const segments = this.segmentResponse(response);
    console.log(`   Analyzing ${segments.length} segments...`);

    // Map each segment to supporting documents
    const mappings: CitationMapping[] = [];

    for (const segment of segments) {
      // Skip if segment already has citation
      if (this.hasCitation(segment)) {
        continue;
      }

      // Skip if segment is not a factual claim
      if (!this.isFactualSegment(segment)) {
        continue;
      }

      // Find supporting document(s)
      let mapping: CitationMapping | null = null;

      if (method === 'llm') {
        mapping = await this.mapWithLLM(segment, documents);
      } else if (method === 'keyword') {
        mapping = this.mapWithKeywords(segment, documents);
      } else {
        // Hybrid: Try keywords first, fallback to LLM
        mapping = this.mapWithKeywords(segment, documents);
        if (!mapping || mapping.confidence < minConfidence) {
          mapping = await this.mapWithLLM(segment, documents);
        }
      }

      if (mapping && mapping.confidence >= minConfidence) {
        mappings.push(mapping);
      } else {
        warnings.push(`Could not find source for: "${segment.substring(0, 50)}..."`);
      }
    }

    console.log(`   Found ${mappings.length} citation mappings`);

    // Inject citations into response
    let citedResponse = response;
    let injectedCount = 0;

    for (const mapping of mappings) {
      const citation = this.formatCitation(
        mapping.sourceDocument,
        mapping.sourceLocation
      );

      // Find claim in response and add citation after it
      const claimIndex = citedResponse.indexOf(mapping.claimText);
      if (claimIndex !== -1) {
        const insertPosition = claimIndex + mapping.claimText.length;

        // Check if there's already a citation right after this claim
        const afterClaim = citedResponse.substring(insertPosition, insertPosition + 50);
        if (!afterClaim.trim().startsWith('[Source:')) {
          citedResponse =
            citedResponse.substring(0, insertPosition) +
            ` ${citation}` +
            citedResponse.substring(insertPosition);

          injectedCount++;
          console.log(`   ✅ Injected: "${mapping.claimText.substring(0, 40)}..." → ${mapping.sourceDocument}`);
        }
      }
    }

    // Calculate coverage
    const totalSegments = segments.filter(s => this.isFactualSegment(s)).length;
    const citedSegments =
      existingCitations.length + injectedCount;
    const coverage = totalSegments > 0 ? (citedSegments / totalSegments) * 100 : 100;

    console.log(`   Injected ${injectedCount} new citations`);
    console.log(`   Citation coverage: ${coverage.toFixed(1)}%`);

    if (warnings.length > 0) {
      console.log(`   ⚠️ ${warnings.length} segment(s) could not be cited`);
    }

    return {
      originalResponse: response,
      citedResponse,
      injectedCitations: injectedCount,
      coverage,
      warnings
    };
  }

  /**
   * Map claim to document using LLM
   * Most accurate but slower
   */
  private async mapWithLLM(
    claim: string,
    documents: Document[]
  ): Promise<CitationMapping | null> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300
        }
      });

      // Build document context (first 500 chars of each)
      const docsContext = documents
        .slice(0, 5) // Max 5 documents to avoid token limits
        .map((doc, i) => {
          const content = (doc.content || doc.text || '').substring(0, 500);
          const name = doc.name || doc.title || `Document ${i + 1}`;
          return `${i + 1}. "${name}":\n${content}`;
        })
        .join('\n\n---\n\n');

      const prompt = `You are a citation expert. Given a CLAIM and DOCUMENTS, determine which document best supports the claim.

CLAIM: "${claim}"

DOCUMENTS:
${docsContext}

Which document supports this claim? Respond with ONLY a JSON object (no markdown):
{
  "documentIndex": 1-5 (or null if none support it),
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Parse JSON
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(jsonText);

      if (parsed.documentIndex === null || parsed.confidence < 0.5) {
        return null;
      }

      const docIndex = parsed.documentIndex - 1;
      if (docIndex < 0 || docIndex >= documents.length) {
        return null;
      }

      const sourceDoc = documents[docIndex];

      return {
        claimText: claim,
        sourceDocument: sourceDoc.name || sourceDoc.title || `Document ${docIndex + 1}`,
        sourceLocation: this.extractLocation(sourceDoc),
        confidence: parsed.confidence
      };
    } catch (error) {
      console.error('❌ Error in LLM citation mapping:', error);
      return null;
    }
  }

  /**
   * Map claim to document using keyword matching
   * Faster but less accurate
   */
  private mapWithKeywords(
    claim: string,
    documents: Document[]
  ): CitationMapping | null {
    // Extract keywords from claim (words longer than 4 chars, excluding common words)
    const stopwords = new Set([
      'this',
      'that',
      'with',
      'from',
      'they',
      'have',
      'been',
      'were',
      'said',
      'each',
      'which',
      'their',
      'would',
      'there',
      'about'
    ]);

    const keywords = claim
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4 && !stopwords.has(word))
      .filter(word => /^[a-z0-9]+$/i.test(word)); // Alphanumeric only

    if (keywords.length === 0) {
      return null;
    }

    // Score each document by keyword overlap
    let bestDoc: Document | null = null;
    let bestScore = 0;

    for (const doc of documents) {
      const docText = (doc.content || doc.text || '').toLowerCase();

      let score = 0;
      for (const keyword of keywords) {
        if (docText.includes(keyword)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestDoc = doc;
      }
    }

    // Require at least 40% keyword overlap
    const overlapRatio = bestScore / keywords.length;
    if (overlapRatio < 0.4) {
      return null;
    }

    const confidence = Math.min(overlapRatio, 0.9); // Cap at 0.9 (keyword matching isn't perfect)

    return {
      claimText: claim,
      sourceDocument: bestDoc!.name || bestDoc!.title || 'Document',
      sourceLocation: this.extractLocation(bestDoc!),
      confidence
    };
  }

  /**
   * Extract location info from document metadata
   */
  private extractLocation(doc: Document): string | undefined {
    if (doc.metadata?.page) {
      return `Page ${doc.metadata.page}`;
    }

    if (doc.metadata?.section) {
      return doc.metadata.section;
    }

    return undefined;
  }

  /**
   * Format citation
   */
  private formatCitation(source: string, location?: string): string {
    if (location) {
      return `[Source: ${source}, ${location}]`;
    }
    return `[Source: ${source}]`;
  }

  /**
   * Segment response into claims
   */
  private segmentResponse(response: string): string[] {
    // Split by sentences (basic implementation)
    const sentences = response
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    return sentences;
  }

  /**
   * Check if segment already has citation
   */
  private hasCitation(segment: string): boolean {
    return /\[Source:/i.test(segment);
  }

  /**
   * Check if segment is a factual claim needing citation
   */
  private isFactualSegment(segment: string): boolean {
    const lowerSegment = segment.toLowerCase();

    // Skip meta-statements and questions
    if (segment.includes('?')) return false;
    if (/^(let me|i (will|can|found|see)|here (is|are))/i.test(segment))
      return false;

    // Check for factual indicators
    const factualIndicators = [
      /\d+/, // Numbers
      /\b(is|are|was|were|has|have|had)\b/, // State-of-being
      /\b(target|market|revenue|customer|product)\b/, // Business terms
      /\b(according to|based on|shows that)\b/
    ];

    return factualIndicators.some(pattern => pattern.test(lowerSegment));
  }

  /**
   * Extract existing citations from response
   */
  private extractExistingCitations(response: string): string[] {
    const citationPattern = /\[Source:[^\]]+\]/gi;
    return response.match(citationPattern) || [];
  }

  /**
   * Add citations at document level
   * Adds a "Sources" section at the end of response
   */
  addDocumentLevelCitations(
    response: string,
    documents: Document[],
    options: {
      title?: string;
      numbered?: boolean;
    } = {}
  ): string {
    const { title = 'Sources', numbered = true } = options;

    // Check if response already has a sources section
    if (response.includes(title + ':')) {
      return response; // Already has sources
    }

    console.log(`📚 Adding document-level citations (${documents.length} sources)...`);

    let citationsSection = `\n\n**${title}:**\n`;

    documents.forEach((doc, i) => {
      const docName = doc.name || doc.title || `Document ${i + 1}`;
      const location = this.extractLocation(doc);

      const prefix = numbered ? `${i + 1}. ` : '- ';
      const locationStr = location ? ` (${location})` : '';

      citationsSection += `${prefix}${docName}${locationStr}\n`;
    });

    return response + citationsSection;
  }

  /**
   * Add inline citations at paragraph level
   * Adds citation at end of each paragraph
   */
  addParagraphLevelCitations(
    response: string,
    documents: Document[]
  ): string {
    console.log('📄 Adding paragraph-level citations...');

    const paragraphs = response.split('\n\n');
    const citedParagraphs: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) {
        citedParagraphs.push(paragraph);
        continue;
      }

      // Skip if paragraph already has citation
      if (this.hasCitation(paragraph)) {
        citedParagraphs.push(paragraph);
        continue;
      }

      // Find best matching document
      const mapping = this.mapWithKeywords(paragraph, documents);

      if (mapping && mapping.confidence >= 0.5) {
        const citation = this.formatCitation(
          mapping.sourceDocument,
          mapping.sourceLocation
        );
        citedParagraphs.push(paragraph + ' ' + citation);
      } else {
        citedParagraphs.push(paragraph);
      }
    }

    return citedParagraphs.join('\n\n');
  }

  /**
   * Generate citation report for analytics
   */
  generateCitationReport(result: CitationInjectionResult): string {
    const coverageStatus =
      result.coverage >= 80
        ? '✅ Excellent'
        : result.coverage >= 60
          ? '⚠️ Good'
          : '❌ Poor';

    let report = `
═══════════════════════════════════════════════════════
CITATION INJECTION REPORT
═══════════════════════════════════════════════════════
Citations Injected: ${result.injectedCitations}
Citation Coverage: ${result.coverage.toFixed(1)}% (${coverageStatus})
`;

    if (result.warnings.length > 0) {
      report += `\n⚠️ Warnings (${result.warnings.length}):\n`;
      result.warnings.slice(0, 3).forEach(w => {
        report += `  - ${w}\n`;
      });

      if (result.warnings.length > 3) {
        report += `  ... and ${result.warnings.length - 3} more\n`;
      }
    }

    report += `═══════════════════════════════════════════════════════`;

    return report.trim();
  }

  /**
   * Test citation injection
   */
  async testCitationInjection(): Promise<void> {
    console.log('🧪 Testing citation injection...\n');

    const testDocuments: Document[] = [
      {
        name: 'Market Analysis 2024',
        content:
          'Koda targets SMBs in Brazil with annual revenue between $1M-$10M. The total addressable market is estimated at 450,000 companies.',
        metadata: { page: 3 }
      },
      {
        name: 'Product Roadmap',
        content: 'Q1 2024: Launch v2.0 with advanced analytics. Q2 2024: International expansion to Mexico.',
        metadata: { section: 'Timeline' }
      }
    ];

    const testResponse = `Koda is focused on serving small and medium businesses in Brazil. The company targets businesses with annual revenue between $1M and $10M. The total market opportunity consists of 450,000 potential customers. Looking ahead, Koda plans to launch version 2.0 in the first quarter of 2024.`;

    console.log('Original response:');
    console.log(testResponse);
    console.log('');

    const result = await this.injectCitations(testResponse, testDocuments, {
      method: 'hybrid',
      minConfidence: 0.5
    });

    console.log('Cited response:');
    console.log(result.citedResponse);
    console.log('');

    console.log(this.generateCitationReport(result));
  }
}

export default new CitationInjectorService();
export { CitationInjectorService, CitationInjectionResult, CitationMapping };
