import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import auditLogService, { AuditAction, AuditStatus } from './auditLog.service';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

/**
 * Document Generation Service
 *
 * Handles:
 * - Multi-document comparison with AI analysis
 * - Document generation from natural language prompts
 * - Template-based document creation
 * - Renderable content generation for Manus-style preview
 */

export interface ComparisonOptions {
  comparisonType: 'full' | 'key_differences' | 'similarities' | 'legal_review';
  highlightChanges: boolean;
  includeMetadata: boolean;
}

export interface GenerationOptions {
  tone?: 'formal' | 'casual' | 'professional' | 'friendly';
  length?: 'brief' | 'standard' | 'detailed';
  format?: 'letter' | 'report' | 'memo' | 'contract' | 'invoice';
}

export interface RenderableSection {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'comparison';
  content: any;
  metadata?: any;
}

class DocumentGenerationService {
  /**
   * Compare multiple documents using AI
   */
  async compareDocuments(
    userId: string,
    documentIds: string[],
    options: ComparisonOptions = {
      comparisonType: 'full',
      highlightChanges: true,
      includeMetadata: true,
    }
  ): Promise<any> {
    try {
      console.log(`📊 Starting document comparison for ${documentIds.length} documents`);

      // Validate documents exist and user has access
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          userId,
        },
        include: {
          metadata: true,
        },
      });

      if (documents.length !== documentIds.length) {
        throw new Error('One or more documents not found or access denied');
      }

      if (documents.length < 2) {
        throw new Error('At least 2 documents required for comparison');
      }

      // Extract text content from all documents
      const documentContents = documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        text: doc.metadata?.extractedText || '',
        wordCount: doc.metadata?.wordCount || 0,
        pageCount: doc.metadata?.pageCount || 0,
      }));

      // Generate AI comparison
      const comparisonResult = await this.generateAIComparison(
        documentContents,
        options
      );

      // Create renderable content
      const renderableContent = this.createComparisonRenderableContent(
        documentContents,
        comparisonResult
      );

      // Create new document record for the comparison
      const comparisonDoc = await prisma.document.create({
        data: {
          userId,
          filename: `Comparison_${documents.map(d => d.filename.split('.')[0]).join('_vs_')}_${Date.now()}.json`,
          encryptedFilename: `comparison_${Date.now()}.json`,
          fileSize: JSON.stringify(renderableContent).length,
          mimeType: 'application/json',
          fileHash: `comparison_${Date.now()}`,
          status: 'completed',
          renderableContent: JSON.stringify(renderableContent),
        },
      });

      // Create generated document record
      const generatedDoc = await prisma.generatedDocument.create({
        data: {
          userId,
          documentId: comparisonDoc.id,
          generationType: 'comparison',
          sourceDocumentIds: JSON.stringify(documentIds),
          renderableContent: JSON.stringify(renderableContent),
          metadata: JSON.stringify({
            comparisonType: options.comparisonType,
            documentCount: documents.length,
            generatedAt: new Date().toISOString(),
          }),
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.DOCUMENT_UPLOAD, // Using closest action, should add DOCUMENT_GENERATE
        status: AuditStatus.SUCCESS,
        resource: comparisonDoc.id,
        details: {
          operation: 'document_comparison',
          sourceDocuments: documentIds,
          comparisonType: options.comparisonType,
        },
      });

      console.log(`✅ Document comparison completed: ${generatedDoc.id}`);

      return {
        generatedDocument: generatedDoc,
        document: comparisonDoc,
        renderableContent,
        comparisonResult,
      };
    } catch (error) {
      console.error('❌ Error comparing documents:', error);
      throw error;
    }
  }

  /**
   * Generate AI comparison analysis
   */
  private async generateAIComparison(
    documents: any[],
    options: ComparisonOptions
  ): Promise<any> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      const prompt = this.buildComparisonPrompt(documents, options);

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse AI response into structured comparison
      return this.parseComparisonResponse(text, documents);
    } catch (error) {
      console.error('Error generating AI comparison:', error);
      throw new Error('Failed to generate AI comparison analysis');
    }
  }

  /**
   * Build comparison prompt for AI
   */
  private buildComparisonPrompt(documents: any[], options: ComparisonOptions): string {
    let prompt = `You are an expert document analyst. Compare the following documents and provide a detailed analysis.\n\n`;

    // Add documents
    documents.forEach((doc, index) => {
      prompt += `Document ${index + 1}: ${doc.filename}\n`;
      prompt += `Content (${doc.wordCount} words):\n${doc.text.substring(0, 5000)}\n\n`;
    });

    // Add comparison instructions based on type
    switch (options.comparisonType) {
      case 'key_differences':
        prompt += `Focus on identifying KEY DIFFERENCES between these documents. Highlight:\n`;
        prompt += `- Major content changes\n`;
        prompt += `- Added or removed sections\n`;
        prompt += `- Factual discrepancies\n`;
        break;

      case 'similarities':
        prompt += `Focus on identifying SIMILARITIES between these documents. Highlight:\n`;
        prompt += `- Common themes and topics\n`;
        prompt += `- Shared terminology\n`;
        prompt += `- Overlapping content\n`;
        break;

      case 'legal_review':
        prompt += `Perform a LEGAL REVIEW comparison. Analyze:\n`;
        prompt += `- Contractual obligations differences\n`;
        prompt += `- Legal terms and conditions changes\n`;
        prompt += `- Liability and responsibility clauses\n`;
        prompt += `- Compliance and regulatory differences\n`;
        break;

      default:
        prompt += `Provide a COMPREHENSIVE comparison including:\n`;
        prompt += `1. Executive Summary\n`;
        prompt += `2. Key Differences\n`;
        prompt += `3. Similarities\n`;
        prompt += `4. Document-Specific Insights\n`;
        prompt += `5. Recommendations\n`;
    }

    prompt += `\nFormat your response as JSON with the following structure:\n`;
    prompt += `{\n`;
    prompt += `  "summary": "Executive summary of comparison",\n`;
    prompt += `  "differences": [{ "section": "...", "description": "...", "severity": "high|medium|low" }],\n`;
    prompt += `  "similarities": [{ "topic": "...", "description": "..." }],\n`;
    prompt += `  "insights": [{ "document": "...", "insight": "..." }],\n`;
    prompt += `  "recommendations": ["..."]\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Parse AI comparison response
   */
  private parseComparisonResponse(text: string, documents: any[]): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: parse as structured text
      return {
        summary: text.substring(0, 500),
        differences: [],
        similarities: [],
        insights: [],
        recommendations: [],
      };
    } catch (error) {
      console.error('Error parsing comparison response:', error);
      return {
        summary: text,
        differences: [],
        similarities: [],
        insights: [],
        recommendations: [],
      };
    }
  }

  /**
   * Create renderable content for comparison
   */
  private createComparisonRenderableContent(
    documents: any[],
    comparisonResult: any
  ): RenderableSection[] {
    const sections: RenderableSection[] = [];

    // Title section
    sections.push({
      type: 'heading',
      content: {
        level: 1,
        text: 'Document Comparison Report',
      },
    });

    // Document list
    sections.push({
      type: 'heading',
      content: {
        level: 2,
        text: 'Documents Compared',
      },
    });

    sections.push({
      type: 'list',
      content: {
        items: documents.map((doc) => ({
          text: `${doc.filename} (${doc.wordCount} words, ${doc.pageCount} pages)`,
        })),
      },
    });

    // Executive summary
    if (comparisonResult.summary) {
      sections.push({
        type: 'heading',
        content: {
          level: 2,
          text: 'Executive Summary',
        },
      });

      sections.push({
        type: 'paragraph',
        content: {
          text: comparisonResult.summary,
        },
      });
    }

    // Key differences
    if (comparisonResult.differences && comparisonResult.differences.length > 0) {
      sections.push({
        type: 'heading',
        content: {
          level: 2,
          text: 'Key Differences',
        },
      });

      sections.push({
        type: 'table',
        content: {
          headers: ['Section', 'Description', 'Severity'],
          rows: comparisonResult.differences.map((diff: any) => [
            diff.section || 'General',
            diff.description,
            diff.severity || 'medium',
          ]),
        },
      });
    }

    // Similarities
    if (comparisonResult.similarities && comparisonResult.similarities.length > 0) {
      sections.push({
        type: 'heading',
        content: {
          level: 2,
          text: 'Similarities',
        },
      });

      sections.push({
        type: 'list',
        content: {
          items: comparisonResult.similarities.map((sim: any) => ({
            text: `${sim.topic}: ${sim.description}`,
          })),
        },
      });
    }

    // Recommendations
    if (comparisonResult.recommendations && comparisonResult.recommendations.length > 0) {
      sections.push({
        type: 'heading',
        content: {
          level: 2,
          text: 'Recommendations',
        },
      });

      sections.push({
        type: 'list',
        content: {
          items: comparisonResult.recommendations.map((rec: string) => ({
            text: rec,
          })),
        },
      });
    }

    return sections;
  }

  /**
   * Generate document from natural language prompt
   */
  async generateFromPrompt(
    userId: string,
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<any> {
    try {
      console.log(`🤖 Generating document from prompt for user ${userId}`);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      // Build generation prompt
      const fullPrompt = this.buildGenerationPrompt(prompt, options);

      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const generatedText = response.text();

      // Parse generated content
      const parsedContent = this.parseGeneratedContent(generatedText, options);

      // Create renderable content
      const renderableContent = this.createRenderableContent(parsedContent);

      // Create document record
      const document = await prisma.document.create({
        data: {
          userId,
          filename: `Generated_${options.format || 'document'}_${Date.now()}.json`,
          encryptedFilename: `generated_${Date.now()}.json`,
          fileSize: JSON.stringify(renderableContent).length,
          mimeType: 'application/json',
          fileHash: `generated_${Date.now()}`,
          status: 'completed',
          renderableContent: JSON.stringify(renderableContent),
        },
      });

      // Create generated document record
      const generatedDoc = await prisma.generatedDocument.create({
        data: {
          userId,
          documentId: document.id,
          generationType: 'from_prompt',
          sourceDocumentIds: JSON.stringify([]),
          generationPrompt: prompt,
          renderableContent: JSON.stringify(renderableContent),
          metadata: JSON.stringify({
            options,
            generatedAt: new Date().toISOString(),
          }),
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.DOCUMENT_UPLOAD,
        status: AuditStatus.SUCCESS,
        resource: document.id,
        details: {
          operation: 'document_generation',
          prompt: prompt.substring(0, 200),
          format: options.format,
        },
      });

      console.log(`✅ Document generated from prompt: ${generatedDoc.id}`);

      return {
        generatedDocument: generatedDoc,
        document,
        renderableContent,
      };
    } catch (error) {
      console.error('❌ Error generating document from prompt:', error);
      throw error;
    }
  }

  /**
   * Build generation prompt
   */
  private buildGenerationPrompt(userPrompt: string, options: GenerationOptions): string {
    let prompt = `You are an expert document writer. Generate a ${options.format || 'document'} based on the following request:\n\n`;
    prompt += `${userPrompt}\n\n`;
    prompt += `Requirements:\n`;
    prompt += `- Tone: ${options.tone || 'professional'}\n`;
    prompt += `- Length: ${options.length || 'standard'}\n`;
    prompt += `- Format: ${options.format || 'document'}\n\n`;
    prompt += `Generate well-structured, professional content with appropriate headings, paragraphs, and formatting.\n`;
    prompt += `Provide the output as JSON with sections:\n`;
    prompt += `{\n`;
    prompt += `  "title": "Document title",\n`;
    prompt += `  "sections": [{ "heading": "...", "content": "..." }]\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Parse generated content from AI
   */
  private parseGeneratedContent(text: string, options: GenerationOptions): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: treat as plain text
      return {
        title: `Generated ${options.format || 'Document'}`,
        sections: [
          {
            heading: 'Content',
            content: text,
          },
        ],
      };
    } catch (error) {
      console.error('Error parsing generated content:', error);
      return {
        title: `Generated ${options.format || 'Document'}`,
        sections: [
          {
            heading: 'Content',
            content: text,
          },
        ],
      };
    }
  }

  /**
   * Create renderable content from parsed data
   */
  private createRenderableContent(parsedContent: any): RenderableSection[] {
    const sections: RenderableSection[] = [];

    // Title
    if (parsedContent.title) {
      sections.push({
        type: 'heading',
        content: {
          level: 1,
          text: parsedContent.title,
        },
      });
    }

    // Sections
    if (parsedContent.sections && Array.isArray(parsedContent.sections)) {
      parsedContent.sections.forEach((section: any) => {
        if (section.heading) {
          sections.push({
            type: 'heading',
            content: {
              level: 2,
              text: section.heading,
            },
          });
        }

        if (section.content) {
          sections.push({
            type: 'paragraph',
            content: {
              text: section.content,
            },
          });
        }
      });
    }

    return sections;
  }

  /**
   * Generate renderable content for existing document
   */
  async generateRenderableContent(documentId: string): Promise<RenderableSection[]> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { metadata: true },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // If already has renderable content, return it
      if (document.renderableContent) {
        return JSON.parse(document.renderableContent);
      }

      // Generate from extracted text
      const text = document.metadata?.extractedText || '';
      const sections: RenderableSection[] = [];

      // Simple paragraph splitting
      const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 0);

      sections.push({
        type: 'heading',
        content: {
          level: 1,
          text: document.filename,
        },
      });

      paragraphs.forEach((para) => {
        sections.push({
          type: 'paragraph',
          content: {
            text: para,
          },
        });
      });

      // Save renderable content
      await prisma.document.update({
        where: { id: documentId },
        data: {
          renderableContent: JSON.stringify(sections),
        },
      });

      return sections;
    } catch (error) {
      console.error('Error generating renderable content:', error);
      throw error;
    }
  }

  /**
   * Get generated document by ID
   */
  async getGeneratedDocument(generatedDocId: string): Promise<any> {
    return await prisma.generatedDocument.findUnique({
      where: { id: generatedDocId },
      include: {
        document: true,
        template: true,
        editHistory: {
          orderBy: { editNumber: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Get generated documents by user
   */
  async getGeneratedDocumentsByUser(userId: string): Promise<any[]> {
    return await prisma.generatedDocument.findMany({
      where: { userId },
      include: {
        document: true,
      },
      orderBy: { generatedAt: 'desc' },
    });
  }
}

export default new DocumentGenerationService();
