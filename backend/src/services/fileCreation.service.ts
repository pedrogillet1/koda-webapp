import geminiService from './gemini.service';
import manusService from './manus.service';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import matter from 'gray-matter';
import prisma from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { uploadFile } from './s3Storage.service';

interface FileCreationParams {
  userId: string;
  topic: string;
  fileType: 'md' | 'pdf' | 'pptx' | 'docx' | 'xlsx';
  additionalContext?: string;
  conversationId?: string;
}

interface FileCreationResult {
  success: boolean;
  filePath: string;
  fileName: string;
  fileUrl: string;
  content: string;
  documentId: string;
  file: {
    id: string;
    name: string;
    type: string;
    path: string;
    url: string;
    previewUrl: string;
    size: number;
    content?: string;
  };
  message: string;
}

class FileCreationService {

  /**
   * Main entry point for file creation
   */
  async createFile(params: FileCreationParams): Promise<FileCreationResult> {
    console.log(`📄 [FileCreation] Creating ${params.fileType.toUpperCase()} about: "${params.topic}"`);

    try {
      // 1. Generate high-quality content
      const content = await this.generateContent(params);

      // 2. Create file based on type
      let fileBuffer: Buffer;
      let fileName: string;

      switch (params.fileType) {
        case 'md':
          fileBuffer = await this.createMarkdown(content, params.topic);
          fileName = `${this.sanitizeFileName(params.topic)}.md`;
          break;

        case 'pdf':
          fileBuffer = await this.createPDF(content, params.topic);
          fileName = `${this.sanitizeFileName(params.topic)}.pdf`;
          break;

        case 'pptx':
          fileBuffer = await this.createPPTX(content, params.topic);
          fileName = `${this.sanitizeFileName(params.topic)}.pptx`;
          break;

        case 'docx':
          fileBuffer = await this.createDOCX(content, params.topic);
          fileName = `${this.sanitizeFileName(params.topic)}.docx`;
          break;

        default:
          throw new Error(`Unsupported file type: ${params.fileType}`);
      }

      // 3. Generate S3 storage path following existing pattern
      const encryptedFilename = `${params.userId}/${crypto.randomUUID()}-${Date.now()}`;

      // 4. Upload to S3 storage
      console.log(`📤 [FileCreation] Uploading to S3: ${encryptedFilename} (${fileBuffer.length} bytes)`);
      await uploadFile(encryptedFilename, fileBuffer, this.getMimeType(params.fileType));
      console.log(`✅ [FileCreation] Uploaded to S3 successfully`);

      // 5. Save to database
      const documentId = uuidv4();
      const document = await prisma.documents.create({
        data: {
          id: documentId,
          userId: params.userId,
          filename: fileName,
          encryptedFilename: encryptedFilename,
          fileSize: fileBuffer.length,
          mimeType: this.getMimeType(params.fileType),
          fileHash: crypto.randomUUID(),
          status: 'completed',
          isEncrypted: false,
          renderableContent: JSON.stringify({
            source: 'ai_generated',
            createdBy: 'koda',
            generatedFrom: 'chat',
            topic: params.topic,
            wordCount: content.split(/\s+/).length,
            conversationId: params.conversationId,
            createdAt: new Date().toISOString(),
          }),
        },
      });

      console.log(`✅ [FileCreation] Created ${fileName} (${fileBuffer.length} bytes)`);

      return {
        success: true,
        filePath: encryptedFilename,
        fileName,
        fileUrl: `/api/document/${document.id}`,
        content,
        documentId: document.id,
        file: {
          id: document.id,
          name: fileName,
          type: params.fileType,
          path: encryptedFilename,
          url: `/api/document/${document.id}`,
          previewUrl: `/api/document/${document.id}/preview`,
          size: fileBuffer.length,
          content: params.fileType === 'md' ? content : undefined,
        },
        message: `Created ${fileName} successfully`,
      };
    } catch (error: any) {
      console.error('❌ [FileCreation] Error:', error);
      throw error;
    }
  }

  /**
   * Generate high-quality content using Gemini
   */
  private async generateContent(params: FileCreationParams): Promise<string> {
    const prompt = this.buildContentPrompt(params);

    const response = await geminiService.generateText({
      prompt,
      maxTokens: 4000,
      temperature: 0.7,
    });

    return response;
  }

  /**
   * Build comprehensive prompt for content generation
   */
  private buildContentPrompt(params: FileCreationParams): string {
    return `You are Koda AI, an intelligent document creation assistant.
Create a professional, high-quality document about: "${params.topic}"
${params.additionalContext ? `Additional Context: ${params.additionalContext}\n` : ''}
DOCUMENT REQUIREMENTS:
1. STRUCTURE (Manus Quality Standards):
  - Start with a compelling title
  - Include an executive summary (2-3 paragraphs)
  - Organize into clear sections with proper hierarchy
  - Use headings: # Main Title, ## Major Sections, ### Subsections
  - Include at least one data table
  - End with recommendations or conclusions

2. CONTENT QUALITY:
  - Professional, data-driven tone
  - Specific numbers and metrics (use realistic examples)
  - Clear, concise language
  - Actionable insights
  - Well-researched information
  - No filler or fluff

3. FORMATTING (Markdown):
  - Use **bold** for key metrics and emphasis
  - Use bullet points for lists
  - Use tables for structured data
  - Use > blockquotes for important callouts
  - Use \`code\` for technical terms
  - Add horizontal rules (---) between major sections

4. LENGTH:
  - Minimum 800 words
  - Maximum 2000 words
  - Comprehensive but concise

5. STYLE (Koda Branding):
  - Professional but approachable
  - Data-driven and factual
  - Helpful and supportive
  - Clear and direct

IMPORTANT:
- Generate ONLY the document content in markdown format
- Do NOT include meta-commentary or explanations
- Do NOT use placeholder text like "[Insert data here]"
- Use realistic data and examples
- Ensure all tables are properly formatted

Generate the document now:`;
  }

  /**
   * Create high-quality Markdown file
   */
  private async createMarkdown(content: string, topic: string): Promise<Buffer> {
    // Add YAML front matter
    const frontMatter = {
      title: topic,
      author: 'Koda AI',
      date: new Date().toISOString().split('T')[0],
      generated_by: 'Koda AI Assistant',
      version: '1.0',
    };

    // Post-process content
    const processedContent = this.postProcessMarkdown(content);

    // Combine front matter + content + footer
    const fullContent = matter.stringify(processedContent, frontMatter);

    // Add Koda footer
    const finalContent =
      fullContent + `\n\n---\n\n*Document created by **Koda AI** on ${new Date().toLocaleDateString()}*\n`;

    return Buffer.from(finalContent, 'utf-8');
  }

  /**
   * Post-process markdown to ensure quality
   */
  private postProcessMarkdown(content: string): string {
    let processed = content;

    // Fix heading hierarchy (no skipped levels)
    processed = this.fixHeadingHierarchy(processed);

    // Ensure proper table formatting
    processed = this.formatTables(processed);

    // Add spacing around sections
    processed = this.addProperSpacing(processed);

    return processed;
  }

  /**
   * Fix heading hierarchy (Manus rule: don't skip levels)
   */
  private fixHeadingHierarchy(markdown: string): string {
    const lines = markdown.split('\n');
    const fixed: string[] = [];
    let currentLevel = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];

        // Don't skip levels
        if (level > currentLevel + 1) {
          const correctedLevel = currentLevel + 1;
          fixed.push('#'.repeat(correctedLevel) + ' ' + text);
          currentLevel = correctedLevel;
        } else {
          fixed.push(line);
          currentLevel = level;
        }
      } else {
        fixed.push(line);
      }
    }

    return fixed.join('\n');
  }

  /**
   * Format tables properly
   */
  private formatTables(markdown: string): string {
    // Ensure tables have proper spacing
    return markdown.replace(/(\n\|.+\|)\n([^|\n])/g, '$1\n\n$2');
  }

  /**
   * Add proper spacing around sections
   */
  private addProperSpacing(markdown: string): string {
    // Add blank line before headings
    let processed = markdown.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

    // Add blank line after headings
    processed = processed.replace(/(#{1,6}\s.+)\n([^#\n])/g, '$1\n\n$2');

    return processed;
  }

  /**
   * Create high-quality PDF file
   */
  private async createPDF(content: string, topic: string): Promise<Buffer> {
    // Convert markdown to HTML
    const htmlContent = marked(content);

    // Create Koda-styled HTML
    const styledHTML = this.createKodaStyledHTML(htmlContent, topic);

    // Generate PDF with Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        timeout: 30000, // 30 second timeout
      });

      const page = await browser.newPage();
      await page.setContent(styledHTML, { waitUntil: 'networkidle0', timeout: 30000 });

      const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '25mm',
        left: '20mm',
      },
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 10px; text-align: center; width: 100%; color: #6b7280; padding: 10px;">
          <span>Created by Koda AI | Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

      await browser.close();

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      if (browser) {
        await browser.close();
      }
      console.error('❌ [PDF] Puppeteer error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  /**
   * Create Koda-styled HTML for PDF
   */
  private createKodaStyledHTML(htmlContent: string, topic: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #111827;
      line-height: 1.7;
      font-size: 11pt;
    }

    h1 {
      color: #6366f1;
      font-size: 28pt;
      font-weight: 700;
      margin: 0 0 12px 0;
      padding-bottom: 12px;
      border-bottom: 3px solid #6366f1;
      page-break-after: avoid;
    }

    h2 {
      color: #8b5cf6;
      font-size: 20pt;
      font-weight: 600;
      margin: 32px 0 16px 0;
      page-break-after: avoid;
    }

    h3 {
      color: #111827;
      font-size: 14pt;
      font-weight: 600;
      margin: 24px 0 12px 0;
      page-break-after: avoid;
    }

    h4, h5, h6 {
      color: #374151;
      font-weight: 600;
      margin: 16px 0 8px 0;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 12px 0;
      text-align: justify;
      page-break-inside: avoid;
    }

    ul, ol {
      margin: 12px 0;
      padding-left: 24px;
    }

    li {
      margin: 6px 0;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      page-break-inside: avoid;
      font-size: 10pt;
    }

    th {
      background: #6366f1;
      color: #ffffff;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #4f46e5;
    }

    td {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      background: #ffffff;
    }

    tr:nth-child(even) td {
      background: #f9fafb;
    }

    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 9pt;
      color: #8b5cf6;
    }

    pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      page-break-inside: avoid;
      font-size: 9pt;
    }

    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid #6366f1;
      padding-left: 16px;
      margin: 16px 0;
      color: #4b5563;
      font-style: italic;
      page-break-inside: avoid;
    }

    hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 32px 0;
    }

    strong {
      color: #6366f1;
      font-weight: 600;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 2px solid #e5e7eb;
    }

    .koda-logo {
      color: #6366f1;
      font-weight: 700;
      font-size: 16pt;
      letter-spacing: 2px;
    }

    .document-meta {
      color: #6b7280;
      font-size: 9pt;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="koda-logo">KODA AI</div>
    <h1>${topic}</h1>
    <div class="document-meta">Generated on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}</div>
  </div>

  <div class="content">
    ${htmlContent}
  </div>
</body>
</html>`;
  }

  /**
   * Create high-quality PPTX using Manus slide system
   */
  private async createPPTX(content: string, topic: string): Promise<Buffer> {
    console.log('🎨 [MANUS] Starting PPTX creation with Koda branding');

    // STEP 1: Initialize slide project
    const projectId = await manusService.slide_initialize(
      topic,
      'Koda AI Professional Presentation: Indigo-purple gradient background (#6366f1 to #8b5cf6), Inter font, white content cards'
    );

    // STEP 2: Parse content and create slides
    const slides = content.split('SLIDE ').filter((s) => s.trim());

    // Create title slide
    const titleSlideHTML = this.generateSlideHTML('title', {
      title: topic,
      subtitle: 'Powered by Koda AI',
    });
    await manusService.slide_edit(projectId, 1, titleSlideHTML);

    // Create content slides
    let slideNumber = 2;
    for (const slideContent of slides) {
      const lines = slideContent.split('\n').filter((l) => l.trim());
      if (lines.length === 0) continue;

      const slideTitle = lines[0].replace(/^\d+:\s*/, '').trim();
      const bullets = lines
        .slice(1)
        .filter((l) => l.startsWith('-') || l.startsWith('*'))
        .map((l) => l.replace(/^[-*]\s*/, '').trim());

      const slideHTML = this.generateSlideHTML('content', {
        title: slideTitle,
        bullets: bullets,
      });

      await manusService.slide_edit(projectId, slideNumber, slideHTML);
      slideNumber++;
    }

    // STEP 3: Generate presentation
    const htmlPath = await manusService.slide_present(projectId);
    const pptxPath = htmlPath.replace('.html', '.pptx');
    const buffer = await manusService.convertHTMLToPPTX(htmlPath, pptxPath);

    // Cleanup
    await manusService.cleanup(projectId);

    console.log('✅ [MANUS] PPTX created successfully');
    return buffer;
  }

  /**
   * Generate slide HTML with Koda branding
   */
  private generateSlideHTML(type: 'title' | 'content', data: any): string {
    if (type === 'title') {
      return `
<div class="slide" style="
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
">
  <div style="text-align: center; color: white;">
    <h1 style="
      font-size: 64px;
      font-weight: 800;
      margin-bottom: 24px;
      text-shadow: 0 4px 6px rgba(0,0,0,0.1);
    ">${data.title}</h1>
    <p style="
      font-size: 32px;
      font-weight: 400;
      opacity: 0.95;
    ">${data.subtitle}</p>
  </div>

  <div style="
    position: absolute;
    bottom: 32px;
    right: 32px;
    padding: 12px 24px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 24px;
    font-size: 14px;
    color: white;
    font-weight: 600;
  ">
    Created by Koda AI
  </div>
</div>`;
    }

    // Content slide
    const bulletsHTML = data.bullets
      ?.map(
        (bullet: string) => `
      <li style="
        margin-bottom: 16px;
        font-size: 20px;
        line-height: 1.6;
        color: #374151;
      ">${bullet}</li>
    `
      )
      .join('') || '';

    return `
<div class="slide" style="
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  position: relative;
">
  <div style="
    background: white;
    border-radius: 16px;
    padding: 48px 64px;
    max-width: 1200px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  ">
    <h2 style="
      font-size: 40px;
      font-weight: 700;
      color: #6366f1;
      margin-bottom: 32px;
      border-bottom: 4px solid #8b5cf6;
      padding-bottom: 16px;
    ">${data.title}</h2>

    <ul style="
      list-style: none;
      padding-left: 0;
    ">
      ${bulletsHTML}
    </ul>
  </div>

  <div style="
    position: absolute;
    bottom: 32px;
    right: 32px;
    padding: 12px 24px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 24px;
    font-size: 14px;
    color: white;
    font-weight: 600;
  ">
    Created by Koda AI
  </div>
</div>`;
  }

  /**
   * Create DOCX file
   */
  private async createDOCX(content: string, topic: string): Promise<Buffer> {
    // Parse markdown content
    const sections = this.parseMarkdownForDOCX(content, topic);

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Parse markdown content for DOCX conversion
   */
  private parseMarkdownForDOCX(content: string, topic: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Add title
    paragraphs.push(
      new Paragraph({
        text: topic,
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
      })
    );

    // Add metadata
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Created by Koda AI | ${new Date().toLocaleDateString()}`,
            size: 20,
            color: '6b7280',
          }),
        ],
        spacing: { after: 600 },
      })
    );

    // Parse content
    const lines = content.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Headings
      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^#\s+/, ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^##\s+/, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          })
        );
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^###\s+/, ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
      }
      // Regular paragraphs
      else if (!line.startsWith('|') && !line.startsWith('-')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/\*\*(.+?)\*\*/g, '$1'), // Remove markdown bold
            spacing: { after: 120 },
          })
        );
      }
    }

    return paragraphs;
  }

  /**
   * Helper: Sanitize filename
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Helper: Get MIME type
   */
  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      md: 'text/markdown',
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return mimeTypes[fileType] || 'application/octet-stream';
  }
}

const fileCreationService = new FileCreationService();
export default fileCreationService;
