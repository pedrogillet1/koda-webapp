import prisma from '../config/database';
import geminiService from './gemini.service';
import manusService from './manus.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

interface FileCreationParams {
  userId: string;
  fileType: 'md' | 'docx' | 'pdf' | 'pptx' | 'xlsx';
  topic: string;
  userQuery: string;
  conversationId?: string;
}

interface FileCreationResult {
  success: boolean;
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
  private uploadsDir = path.join(process.cwd(), 'uploads', 'created-files');

  constructor() {
    this.ensureUploadsDirExists();
  }

  private async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating uploads directory:', error);
    }
  }

  /**
   * Main entry point for file creation
   */
  async createFile(params: FileCreationParams): Promise<FileCreationResult> {
    try {
      console.log(`🎨 [FILE CREATION] Starting ${params.fileType} creation for: ${params.topic}`);

      // 1. Generate content using LLM
      const content = await this.generateContent(params);

      // 2. Create file based on type
      const fileBuffer = await this.createFileByType(params.fileType, content, params.topic);

      // 3. Generate filename
      const fileName = this.generateFileName(params.fileType, params.topic);

      // 4. Save to storage
      const filePath = path.join(this.uploadsDir, fileName);
      await fs.writeFile(filePath, fileBuffer);

      // 5. Create document record in database
      const document = await this.saveToDatabase({
        userId: params.userId,
        fileName,
        filePath,
        fileType: params.fileType,
        size: fileBuffer.length,
        topic: params.topic,
        conversationId: params.conversationId,
      });

      // 6. Return result
      return {
        success: true,
        file: {
          id: document.id,
          name: fileName,
          type: params.fileType,
          path: filePath,
          url: `/api/files/${document.id}`,
          previewUrl: `/api/files/${document.id}/preview`,
          size: fileBuffer.length,
          content: params.fileType === 'md' ? content : undefined,
        },
        message: `Created ${fileName} successfully`,
      };
    } catch (error) {
      console.error('❌ [FILE CREATION] Error:', error);
      throw error;
    }
  }

  /**
   * Generate content using LLM
   */
  private async generateContent(params: FileCreationParams): Promise<string> {
    const prompts = {
      md: `Create a comprehensive Markdown document about: ${params.topic}

Requirements:
- Use proper Markdown formatting (headings, lists, tables, code blocks)
- Well-structured with clear sections
- Include relevant examples and explanations
- Professional and informative tone

Generate the complete Markdown content now:`,

      docx: `Create professional document content about: ${params.topic}

Requirements:
- Clear hierarchical structure with headings
- Well-organized paragraphs
- Include bullet points and numbered lists where appropriate
- Professional business writing style

Generate the complete content now:`,

      pdf: `Create a professional report about: ${params.topic}

Requirements:
- Executive summary
- Clear sections with headings
- Data-driven insights
- Professional formatting
- Conclusion and recommendations

Generate the complete report content now:`,

      pptx: `Create a presentation outline about: ${params.topic}

Requirements:
- Title slide
- 5-7 content slides
- Each slide should have:
  * Clear heading
  * 3-5 bullet points
  * Key takeaway
- Conclusion slide

Generate the presentation outline in this format:
SLIDE 1: [Title]
- Point 1
- Point 2
...`,

      xlsx: `Create a spreadsheet data structure about: ${params.topic}

Requirements:
- Clear column headers
- Well-organized data rows
- Include formulas where appropriate
- Professional business spreadsheet format

Generate the spreadsheet structure with headers and sample data in CSV format:`,
    };

    const prompt = prompts[params.fileType];

    const response = await geminiService.generateText(prompt, {
      maxTokens: 4000,
      temperature: 0.7,
    });

    return response;
  }

  /**
   * Create file buffer based on type
   */
  private async createFileByType(
    fileType: string,
    content: string,
    topic: string
  ): Promise<Buffer> {
    switch (fileType) {
      case 'md':
        return await this.createMarkdown(content, topic);

      case 'docx':
        return await this.createDocx(content, topic);

      case 'pdf':
        return await this.createPdf(content, topic);

      case 'pptx':
        return await this.createPptx(content, topic);

      case 'xlsx':
        return await this.createXlsx(content, topic);

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Create Markdown file using Manus Method with Koda Style
   */
  private async createMarkdown(content: string, topic: string): Promise<Buffer> {
    console.log('📝 [MANUS] Starting Markdown creation with Koda branding');

    // 1. Generate structured markdown using LLM with Koda style prompt
    const prompt = `Create a professional markdown document about: ${topic}

STRUCTURE REQUIREMENTS (Manus Rules):
- Start with YAML front matter (title, author, date)
- Use proper heading hierarchy (# → ## → ###)
- Include executive summary at the top
- Use tables for structured data
- Add code blocks with language identifiers where relevant
- Include bullet points for lists
- Use bold for key metrics and emphasis
- Add horizontal rules between major sections

STYLE REQUIREMENTS (Koda Branding):
- Author: "Koda AI"
- Tone: Professional, data-driven, helpful
- Include "Generated by Koda AI" footer
- Use clear, concise language
- Focus on actionable insights

CONTENT REQUIREMENTS:
- Minimum 3 main sections
- Include at least 1 data table
- Provide specific numbers and metrics
- End with recommendations or next steps

Generate the markdown document now:`;

    const markdownContent = await geminiService.generateText(prompt, {
      maxTokens: 4000,
      temperature: 0.7,
    });

    // 2. Post-process to ensure quality
    const processedMarkdown = this.postProcessMarkdown(markdownContent, topic);

    console.log('✅ [MANUS] Markdown created successfully with Koda branding');
    return Buffer.from(processedMarkdown, 'utf-8');
  }

  /**
   * Post-process markdown to ensure Manus quality standards
   */
  private postProcessMarkdown(content: string, topic: string): string {
    let processed = content;

    // Ensure YAML front matter exists
    if (!processed.startsWith('---')) {
      const frontMatter = `---
title: ${topic}
author: Koda AI
date: ${new Date().toISOString().split('T')[0]}
generated_by: Koda AI Assistant
---

`;
      processed = frontMatter + processed;
    }

    // Ensure proper heading hierarchy (no skipped levels)
    processed = this.fixHeadingHierarchy(processed);

    // Add Koda footer if not present
    if (!processed.includes('Generated by Koda')) {
      processed += `\n\n---\n\n*Document generated by Koda AI on ${new Date().toLocaleDateString()}*\n`;
    }

    // Ensure tables have proper formatting
    processed = this.formatTables(processed);

    // Ensure code blocks have language identifiers
    processed = this.addCodeLanguages(processed);

    return processed;
  }

  /**
   * Fix heading hierarchy to follow Manus rules
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

        // Don't skip levels (e.g., # → ### is bad, should be # → ## → ###)
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
   * Ensure tables have proper markdown formatting
   */
  private formatTables(markdown: string): string {
    const lines = markdown.split('\n');
    const formatted: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this looks like a table row
      if (line.includes('|') && line.trim().startsWith('|')) {
        // Ensure spacing around pipes
        const formattedLine = line
          .split('|')
          .map((cell) => cell.trim())
          .join(' | ');

        formatted.push(formattedLine);

        // Check if next line should be a separator
        const nextLine = lines[i + 1];
        if (
          nextLine &&
          !nextLine.includes('---') &&
          !nextLine.includes('===') &&
          formatted.length > 0
        ) {
          // This is likely a header row, add separator if missing
          const columnCount = formattedLine.split('|').length - 2;
          if (columnCount > 0 && i === formatted.length - 1) {
            const separator = '| ' + Array(columnCount).fill('---').join(' | ') + ' |';
            formatted.push(separator);
          }
        }
      } else {
        formatted.push(line);
      }
    }

    return formatted.join('\n');
  }

  /**
   * Add language identifiers to code blocks
   */
  private addCodeLanguages(markdown: string): string {
    // Replace ``` with ```typescript, ```javascript, etc. based on context
    return markdown.replace(/```\n/g, (match, offset) => {
      // Look at surrounding context to guess language
      const context = markdown.slice(Math.max(0, offset - 100), offset).toLowerCase();

      if (context.includes('typescript') || context.includes('interface')) {
        return '```typescript\n';
      } else if (context.includes('javascript') || context.includes('function')) {
        return '```javascript\n';
      } else if (context.includes('python') || context.includes('def ')) {
        return '```python\n';
      } else if (context.includes('bash') || context.includes('command')) {
        return '```bash\n';
      } else if (context.includes('json')) {
        return '```json\n';
      } else if (context.includes('sql')) {
        return '```sql\n';
      }

      return '```text\n';
    });
  }

  /**
   * Create DOCX file
   */
  private async createDocx(content: string, title: string): Promise<Buffer> {
    const paragraphs: Paragraph[] = [];

    // Add title
    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
      })
    );

    // Parse content into paragraphs
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim() === '') continue;

      // Check if it's a heading
      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 200 },
          })
        );
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 100, after: 100 },
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            text: line,
            spacing: { after: 120 },
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Create PDF file
   */
  private async createPdf(content: string, title: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add title
      doc.fontSize(24).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(2);

      // Add content
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          doc.moveDown(0.5);
          continue;
        }

        if (line.startsWith('# ')) {
          doc.fontSize(18).font('Helvetica-Bold').text(line.replace('# ', ''));
          doc.moveDown(0.5);
        } else if (line.startsWith('## ')) {
          doc.fontSize(14).font('Helvetica-Bold').text(line.replace('## ', ''));
          doc.moveDown(0.3);
        } else {
          doc.fontSize(11).font('Helvetica').text(line);
          doc.moveDown(0.2);
        }
      }

      doc.end();
    });
  }

  /**
   * Create PPTX file using Manus Method with Koda Branding
   */
  private async createPptx(content: string, title: string): Promise<Buffer> {
    console.log('🎨 [MANUS] Starting PPTX creation with Koda branding');

    // STEP 1: Initialize slide project with Koda style instructions
    const projectId = await manusService.slide_initialize(
      title,
      'Koda AI Professional Presentation: Indigo-purple gradient background (#6366f1 to #8b5cf6), Inter font, white content cards with 16px border radius'
    );

    // STEP 2: Parse content and create slides
    const slides = content.split('SLIDE ').filter((s) => s.trim());

    // Create title slide (Slide 1)
    const titleSlideHTML = this.generateSlideHTML('title', {
      title: title,
      subtitle: 'Powered by Koda AI',
    });
    await manusService.slide_edit(projectId, 1, titleSlideHTML);

    // Create content slides (Slide 2+)
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

    // STEP 3: Generate presentation and convert to PPTX
    const htmlPath = await manusService.slide_present(projectId);
    const pptxPath = htmlPath.replace('.html', '.pptx');
    const buffer = await manusService.convertHTMLToPPTX(htmlPath, pptxPath);

    // Cleanup
    await manusService.cleanup(projectId);

    console.log('✅ [MANUS] PPTX created successfully with Koda branding');
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
   * Create XLSX file
   */
  private async createXlsx(content: string, title: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title);

    // Parse CSV content
    const lines = content.split('\n').filter((l) => l.trim());

    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim());
      const row = worksheet.addRow(cells);

      // Style header row
      if (i === 0) {
        row.font = { bold: true };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      }
    }

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Generate filename
   */
  private generateFileName(fileType: string, topic: string): string {
    const sanitized = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const timestamp = Date.now();
    return `${sanitized}-${timestamp}.${fileType}`;
  }

  /**
   * Save to database
   */
  private async saveToDatabase(params: {
    userId: string;
    fileName: string;
    filePath: string;
    fileType: string;
    size: number;
    topic: string;
    conversationId?: string;
  }) {
    const document = await prisma.documents.create({
      data: {
        id: uuidv4(),
        userId: params.userId,
        filename: params.fileName,
        encryptedFilename: params.fileName,
        fileSize: params.size,
        mimeType: this.getMimeType(params.fileType),
        fileHash: uuidv4(), // Generate proper hash if needed
        status: 'completed',
        isEncrypted: false,
        renderableContent: JSON.stringify({
          source: 'ai_generated',
          topic: params.topic,
          createdBy: 'koda',
          conversationId: params.conversationId,
        }),
      },
    });

    return document;
  }

  /**
   * Get MIME type for file type
   */
  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      md: 'text/markdown',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return mimeTypes[fileType] || 'application/octet-stream';
  }
}

const fileCreationService = new FileCreationService();
export default fileCreationService;
