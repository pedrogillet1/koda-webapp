/** Document Export Service - Convert markdown to PDF/DOCX/XLSX */

import { marked } from 'marked';
import puppeteer from 'puppeteer';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from 'docx';
import { parseDocument } from 'htmlparser2';
import { DomUtils } from 'htmlparser2';

interface ExportDocumentParams {
  format: 'pdf' | 'docx' | 'xlsx';
  markdownContent?: string;
  filename?: string;
}

class DocumentExportService {
  /**
   * Export markdown content to PDF using Puppeteer
   */
  async exportToPdf(markdownContent: string, filename: string): Promise<Buffer> {
    try {
      // Convert markdown to HTML
      const html = await marked.parse(markdownContent);

      // Create full HTML document with styling
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #32302C;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 60px;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      margin-top: 0;
      margin-bottom: 20px;
      line-height: 1.2;
      border-bottom: 3px solid #E6E6EC;
      padding-bottom: 12px;
    }

    h2 {
      font-size: 22px;
      font-weight: 600;
      color: #2d3748;
      margin-top: 32px;
      margin-bottom: 16px;
      line-height: 1.3;
      border-bottom: 2px solid #f3f4f6;
      padding-bottom: 8px;
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #374151;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    h4 {
      font-size: 16px;
      font-weight: 600;
      color: #4b5563;
      margin-top: 20px;
      margin-bottom: 10px;
    }

    p {
      margin-bottom: 14px;
      color: #4b5563;
    }

    strong {
      font-weight: 700;
      color: #1f2937;
    }

    em {
      font-style: italic;
      color: #374151;
    }

    ul, ol {
      margin-bottom: 14px;
      padding-left: 24px;
    }

    li {
      margin-bottom: 6px;
      color: #4b5563;
    }

    code {
      background-color: #f3f4f6;
      color: #e11d48;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
    }

    pre {
      background-color: #1f2937;
      color: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 16px 0;
    }

    pre code {
      background: none;
      color: #f9fafb;
      padding: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }

    table thead {
      background: #000000;
      color: white;
    }

    table thead th {
      padding: 12px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    table tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }

    table tbody tr:nth-child(even) {
      background-color: #f9fafb;
    }

    table tbody td {
      padding: 10px 14px;
      color: #4b5563;
    }

    blockquote {
      border-left: 4px solid #3b82f6;
      background-color: #eff6ff;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
      color: #1e40af;
      font-style: italic;
    }

    hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 24px 0;
    }

    a {
      color: #3b82f6;
      text-decoration: none;
      border-bottom: 1px solid #93c5fd;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
      `;

      // Launch headless browser
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        printBackground: true
      });

      await browser.close();

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('❌ Error exporting to PDF:', error);
      throw new Error(`Failed to export to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export markdown content to DOCX using docx library
   */
  async exportToWord(markdownContent: string, filename: string): Promise<Buffer> {
    try {
      // Convert markdown to HTML first
      const html = await marked.parse(markdownContent);

      // Parse HTML into DOM structure
      const dom = parseDocument(html);

      // Convert HTML elements to DOCX paragraphs
      const children: Paragraph[] = [];

      const processNode = (node: any): void => {
        if (node.type === 'text') {
          const text = node.data;
          if (text.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text, font: 'Plus Jakarta Sans' })],
                spacing: { after: 200 }
              })
            );
          }
        } else if (node.type === 'tag') {
          switch (node.name) {
            case 'h1':
              const h1Text = DomUtils.getText(node);
              children.push(
                new Paragraph({
                  text: h1Text,
                  heading: HeadingLevel.HEADING_1,
                  spacing: { before: 400, after: 200 }
                })
              );
              break;

            case 'h2':
              const h2Text = DomUtils.getText(node);
              children.push(
                new Paragraph({
                  text: h2Text,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 400, after: 200 }
                })
              );
              break;

            case 'h3':
              const h3Text = DomUtils.getText(node);
              children.push(
                new Paragraph({
                  text: h3Text,
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 300, after: 150 }
                })
              );
              break;

            case 'p':
              const pText = DomUtils.getText(node);
              if (pText.trim()) {
                const runs: TextRun[] = [];

                // Process children for bold/italic
                const processInlineNode = (inlineNode: any): void => {
                  if (inlineNode.type === 'text') {
                    runs.push(new TextRun({ text: inlineNode.data, font: 'Plus Jakarta Sans' }));
                  } else if (inlineNode.type === 'tag') {
                    const innerText = DomUtils.getText(inlineNode);
                    if (inlineNode.name === 'strong' || inlineNode.name === 'b') {
                      runs.push(new TextRun({ text: innerText, bold: true, font: 'Plus Jakarta Sans' }));
                    } else if (inlineNode.name === 'em' || inlineNode.name === 'i') {
                      runs.push(new TextRun({ text: innerText, italics: true, font: 'Plus Jakarta Sans' }));
                    } else if (inlineNode.name === 'code') {
                      runs.push(new TextRun({
                        text: innerText,
                        font: 'Courier New',
                        color: 'E11D48',
                        shading: { fill: 'F3F4F6' }
                      }));
                    } else {
                      runs.push(new TextRun({ text: innerText, font: 'Plus Jakarta Sans' }));
                    }
                  }

                  if (inlineNode.children) {
                    inlineNode.children.forEach(processInlineNode);
                  }
                };

                if (node.children) {
                  node.children.forEach(processInlineNode);
                }

                if (runs.length === 0) {
                  runs.push(new TextRun({ text: pText, font: 'Plus Jakarta Sans' }));
                }

                children.push(
                  new Paragraph({
                    children: runs,
                    spacing: { after: 200 }
                  })
                );
              }
              break;

            case 'ul':
            case 'ol':
              if (node.children) {
                node.children.forEach((li: any) => {
                  if (li.name === 'li') {
                    const liText = DomUtils.getText(li);
                    children.push(
                      new Paragraph({
                        text: liText,
                        bullet: node.name === 'ul' ? { level: 0 } : undefined,
                        numbering: node.name === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
                        spacing: { after: 100 }
                      })
                    );
                  }
                });
              }
              break;

            case 'blockquote':
              const quoteText = DomUtils.getText(node);
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: quoteText, italics: true, color: '1E40AF', font: 'Plus Jakarta Sans' })
                  ],
                  indent: { left: convertInchesToTwip(0.5) },
                  border: {
                    left: { color: '3B82F6', space: 1, style: 'single', size: 24 }
                  },
                  shading: { fill: 'EFF6FF' },
                  spacing: { before: 200, after: 200 }
                })
              );
              break;

            case 'pre':
              const codeText = DomUtils.getText(node);
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: codeText,
                      font: 'Courier New',
                      color: 'F9FAFB'
                    })
                  ],
                  shading: { fill: '1F2937' },
                  spacing: { before: 200, after: 200 }
                })
              );
              break;

            default:
              // Process children for other tags
              if (node.children) {
                node.children.forEach(processNode);
              }
          }
        }

        // Process siblings
        if (node.next) {
          processNode(node.next);
        }
      };

      // Process all top-level nodes
      dom.children.forEach(processNode);

      // Create document
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(0.75),
                right: convertInchesToTwip(0.75),
                bottom: convertInchesToTwip(0.75),
                left: convertInchesToTwip(0.75)
              }
            }
          },
          children
        }],
        numbering: {
          config: [{
            reference: 'default-numbering',
            levels: [{
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT
            }]
          }]
        }
      });

      // Generate buffer
      const buffer = await Packer.toBuffer(doc);
      return buffer;
    } catch (error) {
      console.error('❌ Error exporting to DOCX:', error);
      throw new Error(`Failed to export to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Main export function - routes to appropriate export method
   */
  async exportDocument(params: ExportDocumentParams): Promise<Buffer | null> {
    const { format, markdownContent, filename } = params;

    if (!markdownContent) {
      throw new Error('No markdown content provided for export');
    }

    const baseFilename = filename || 'document';

    switch (format) {
      case 'pdf':
        return this.exportToPdf(markdownContent, baseFilename);

      case 'docx':
        return this.exportToWord(markdownContent, baseFilename);

      case 'xlsx':
        // XLSX export not implemented yet (complex table extraction needed)
        throw new Error('XLSX export not yet implemented');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

export default new DocumentExportService();
