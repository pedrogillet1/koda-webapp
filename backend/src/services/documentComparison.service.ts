/**
 * Document Comparison Service
 * Multi-document comparison framework for KODA
 *
 * Features:
 * - Compare two or more documents
 * - Identify differences and similarities
 * - Extract unique elements from each document
 * - Generate structured comparison reports
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import pineconeService from './pinecone.service';
import embeddingService from './embedding.service';
import prisma from '../config/database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ComparisonOptions {
  comparisonType: 'differences' | 'similarities' | 'summary' | 'full';
  focusAreas?: string[]; // Specific topics to focus on
  detailLevel?: 'brief' | 'detailed' | 'comprehensive';
}

export interface ComparisonResult {
  documentIds: string[];
  documentNames: string[];
  comparisonType: string;
  differences: string[];
  similarities: string[];
  uniqueElements: Record<string, string[]>; // documentId -> unique points
  summary: string;
  formattedReport: string;
  generatedAt: Date;
}

class DocumentComparisonService {
  /**
   * Compare multiple documents
   */
  async compareDocuments(
    documentIds: string[],
    userId: string,
    options: ComparisonOptions = { comparisonType: 'full' },
    sessionId?: string
  ): Promise<ComparisonResult> {
    console.log(`🔍 [DocumentComparison] Comparing ${documentIds.length} documents...`);

    if (documentIds.length < 2) {
      throw new Error('At least 2 documents are required for comparison');
    }

    // Step 1: Retrieve chunks from specified documents
    const documentChunks = await this.retrieveDocumentChunks(documentIds, userId, sessionId);

    // Step 2: Build comparison prompt
    const comparisonPrompt = this.buildComparisonPrompt(documentChunks, options);

    // Step 3: Generate comparison using AI
    const comparisonText = await this.generateComparison(comparisonPrompt, options);

    // Step 4: Parse and structure the comparison
    const structuredResult = this.parseComparisonResult(
      comparisonText,
      documentIds,
      documentChunks.map(d => d.documentName),
      options.comparisonType
    );

    // Step 5: Format the comparison report
    const formattedReport = this.formatComparisonReport(structuredResult);

    console.log(`✅ [DocumentComparison] Comparison complete`);

    return {
      ...structuredResult,
      formattedReport,
      generatedAt: new Date(),
    };
  }

  /**
   * Compare two documents side by side
   */
  async compareTwoDocuments(
    documentId1: string,
    documentId2: string,
    userId: string,
    sessionId?: string
  ): Promise<ComparisonResult> {
    return this.compareDocuments(
      [documentId1, documentId2],
      userId,
      { comparisonType: 'full', detailLevel: 'detailed' },
      sessionId
    );
  }

  /**
   * Find differences between documents
   */
  async findDifferences(
    documentIds: string[],
    userId: string,
    sessionId?: string
  ): Promise<string[]> {
    const result = await this.compareDocuments(
      documentIds,
      userId,
      { comparisonType: 'differences', detailLevel: 'detailed' },
      sessionId
    );

    return result.differences;
  }

  /**
   * Find similarities between documents
   */
  async findSimilarities(
    documentIds: string[],
    userId: string,
    sessionId?: string
  ): Promise<string[]> {
    const result = await this.compareDocuments(
      documentIds,
      userId,
      { comparisonType: 'similarities', detailLevel: 'detailed' },
      sessionId
    );

    return result.similarities;
  }

  /**
   * Retrieve chunks from specified documents
   */
  private async retrieveDocumentChunks(
    documentIds: string[],
    userId: string,
    sessionId?: string
  ): Promise<Array<{
    documentId: string;
    documentName: string;
    chunks: string[];
  }>> {
    const results: Array<{
      documentId: string;
      documentName: string;
      chunks: string[];
    }> = [];

    if (sessionId) {
      // Retrieve from session storage
      const sessionStorageService = await import('./sessionStorage.service');
      const sessionDocs = await sessionStorageService.default.getSessionDocuments(sessionId);

      for (const documentId of documentIds) {
        const doc = sessionDocs.find(d => d.documentId === documentId);
        if (doc) {
          results.push({
            documentId,
            documentName: doc.filename,
            chunks: doc.chunks.map(c => c.content),
          });
        }
      }
    } else {
      // Retrieve from Pinecone
      for (const documentId of documentIds) {
        // Use a dummy embedding to get all chunks for this document
        const dummyEmbedding = new Array(768).fill(0);

        const chunks = await pineconeService.searchSimilarChunks(
          dummyEmbedding,
          userId,
          100, // Get up to 100 chunks per document
          0, // No similarity threshold
          documentId // Filter by this document
        );

        if (chunks.length > 0) {
          results.push({
            documentId,
            documentName: chunks[0].document.filename,
            chunks: chunks.map(c => c.content),
          });
        }
      }
    }

    return results;
  }

  /**
   * Build comparison prompt
   */
  private buildComparisonPrompt(
    documentChunks: Array<{
      documentId: string;
      documentName: string;
      chunks: string[];
    }>,
    options: ComparisonOptions
  ): string {
    let prompt = `You are comparing the following documents:\n\n`;

    // Add document contents
    for (let i = 0; i < documentChunks.length; i++) {
      const doc = documentChunks[i];
      prompt += `Document ${i + 1}: ${doc.documentName}\n`;
      prompt += `Content:\n${doc.chunks.join('\n\n')}\n\n`;
      prompt += `---\n\n`;
    }

    // Add comparison instructions based on type
    switch (options.comparisonType) {
      case 'differences':
        prompt += `Compare these documents and identify KEY DIFFERENCES:\n`;
        prompt += `1. What is different between the documents?\n`;
        prompt += `2. What unique information does each document contain?\n`;
        break;

      case 'similarities':
        prompt += `Compare these documents and identify SIMILARITIES:\n`;
        prompt += `1. What common themes or topics appear across documents?\n`;
        prompt += `2. What information is shared between documents?\n`;
        break;

      case 'summary':
        prompt += `Provide a SUMMARY comparison:\n`;
        prompt += `1. Brief overview of each document\n`;
        prompt += `2. Main similarities and differences\n`;
        break;

      case 'full':
        prompt += `Provide a COMPREHENSIVE comparison:\n`;
        prompt += `1. Key differences between documents\n`;
        prompt += `2. Similarities across documents\n`;
        prompt += `3. Unique elements in each document\n`;
        prompt += `4. Overall comparison summary\n`;
        break;
    }

    // Add focus areas if specified
    if (options.focusAreas && options.focusAreas.length > 0) {
      prompt += `\nFocus on these specific areas:\n`;
      options.focusAreas.forEach(area => {
        prompt += `- ${area}\n`;
      });
    }

    // Add detail level instructions
    const detailLevel = options.detailLevel || 'detailed';
    if (detailLevel === 'brief') {
      prompt += `\nProvide a brief comparison (2-3 bullet points per section).\n`;
    } else if (detailLevel === 'comprehensive') {
      prompt += `\nProvide a comprehensive, detailed comparison with specific examples and quotes.\n`;
    }

    prompt += `\nFormat your response as:\n`;
    prompt += `## Differences\n`;
    prompt += `- [list differences]\n\n`;
    prompt += `## Similarities\n`;
    prompt += `- [list similarities]\n\n`;
    prompt += `## Unique Elements\n`;
    prompt += `### Document 1: [name]\n`;
    prompt += `- [unique points]\n`;
    prompt += `### Document 2: [name]\n`;
    prompt += `- [unique points]\n\n`;
    prompt += `## Summary\n`;
    prompt += `[overall comparison summary]\n`;

    return prompt;
  }

  /**
   * Generate comparison using AI
   */
  private async generateComparison(
    prompt: string,
    options: ComparisonOptions
  ): Promise<string> {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: options.detailLevel === 'comprehensive' ? 4000 : 2000,
        temperature: 0.3, // Lower temperature for factual comparison
      },
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Parse comparison result into structured format
   */
  private parseComparisonResult(
    comparisonText: string,
    documentIds: string[],
    documentNames: string[],
    comparisonType: string
  ): Omit<ComparisonResult, 'formattedReport' | 'generatedAt'> {
    // Extract sections from the comparison text
    const differences: string[] = [];
    const similarities: string[] = [];
    const uniqueElements: Record<string, string[]> = {};
    let summary = '';

    // Parse Differences section
    const differencesMatch = comparisonText.match(/## Differences\n([\s\S]*?)(?=\n##|$)/);
    if (differencesMatch) {
      const diffText = differencesMatch[1];
      const diffItems = diffText.match(/^- (.+)$/gm);
      if (diffItems) {
        differences.push(...diffItems.map(item => item.replace(/^- /, '').trim()));
      }
    }

    // Parse Similarities section
    const similaritiesMatch = comparisonText.match(/## Similarities\n([\s\S]*?)(?=\n##|$)/);
    if (similaritiesMatch) {
      const simText = similaritiesMatch[1];
      const simItems = simText.match(/^- (.+)$/gm);
      if (simItems) {
        similarities.push(...simItems.map(item => item.replace(/^- /, '').trim()));
      }
    }

    // Parse Unique Elements section
    for (let i = 0; i < documentIds.length; i++) {
      const docId = documentIds[i];
      const docName = documentNames[i];

      const uniquePattern = new RegExp(`### Document ${i + 1}:.*?\\n([\\s\\S]*?)(?=\\n###|\\n##|$)`, 'i');
      const uniqueMatch = comparisonText.match(uniquePattern);

      if (uniqueMatch) {
        const uniqueText = uniqueMatch[1];
        const uniqueItems = uniqueText.match(/^- (.+)$/gm);
        if (uniqueItems) {
          uniqueElements[docId] = uniqueItems.map(item => item.replace(/^- /, '').trim());
        }
      }
    }

    // Parse Summary section
    const summaryMatch = comparisonText.match(/## Summary\n([\s\S]*?)$/);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    return {
      documentIds,
      documentNames,
      comparisonType,
      differences,
      similarities,
      uniqueElements,
      summary,
    };
  }

  /**
   * Format comparison report
   */
  private formatComparisonReport(result: Omit<ComparisonResult, 'formattedReport' | 'generatedAt'>): string {
    let report = `# Document Comparison Report\n\n`;

    report += `## Documents Compared\n`;
    result.documentNames.forEach((name, idx) => {
      report += `${idx + 1}. ${name}\n`;
    });
    report += `\n`;

    if (result.differences.length > 0) {
      report += `## Key Differences\n`;
      result.differences.forEach(diff => {
        report += `- ${diff}\n`;
      });
      report += `\n`;
    }

    if (result.similarities.length > 0) {
      report += `## Similarities\n`;
      result.similarities.forEach(sim => {
        report += `- ${sim}\n`;
      });
      report += `\n`;
    }

    if (Object.keys(result.uniqueElements).length > 0) {
      report += `## Unique Elements\n\n`;
      for (let i = 0; i < result.documentIds.length; i++) {
        const docId = result.documentIds[i];
        const docName = result.documentNames[i];
        const unique = result.uniqueElements[docId];

        if (unique && unique.length > 0) {
          report += `### ${docName}\n`;
          unique.forEach(item => {
            report += `- ${item}\n`;
          });
          report += `\n`;
        }
      }
    }

    if (result.summary) {
      report += `## Summary\n`;
      report += `${result.summary}\n`;
    }

    return report;
  }
}

export default new DocumentComparisonService();
