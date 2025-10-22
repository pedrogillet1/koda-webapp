/**
 * Document Export Service
 * Export documents to various formats (PDF, DOCX, Excel)
 * - Convert markdown to PDF using puppeteer
 * - Convert markdown to DOCX
 * - Convert markdown tables back to Excel
 */

import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';

interface ExportOptions {
  format: 'pdf' | 'docx' | 'xlsx';
  markdownContent: string;
  filename: string;
}

class DocumentExportService {
  /**
   * Export document to specified format
   */
  async exportDocument(options: ExportOptions): Promise<Buffer> {
    const { format, markdownContent, filename } = options;

    console.log(`[Document Export] Exporting to ${format}...`);

    switch (format) {
      case 'pdf':
        return await this.exportToPDF(markdownContent, filename);
      case 'docx':
        return await this.exportToDOCX(markdownContent, filename);
      case 'xlsx':
        return await this.exportToExcel(markdownContent, filename);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export markdown to PDF using puppeteer
   */
  private async exportToPDF(markdownContent: string, filename: string): Promise<Buffer> {
    console.log('[Export to PDF] Starting PDF generation...');

    let browser;
    try {
      // Convert markdown to HTML
      const htmlContent = await this.markdownToHTML(markdownContent);

      // Launch headless browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Set HTML content
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
      });

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

      console.log(`[Export to PDF] PDF generated successfully (${pdfBuffer.length} bytes)`);

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error('[Export to PDF] Error:', error);
      throw new Error(`Failed to export to PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Export markdown to DOCX
   * Note: This is a simplified approach - for production, consider using a proper library like docx
   */
  private async exportToDOCX(markdownContent: string, filename: string): Promise<Buffer> {
    console.log('[Export to DOCX] Starting DOCX generation...');

    try {
      // For now, we'll convert markdown to HTML and wrap it in a basic DOCX structure
      // In production, you'd want to use a library like 'docx' for proper DOCX generation
      const htmlContent = await this.markdownToHTML(markdownContent);

      // Create a simple DOCX-compatible HTML
      const docxHTML = `
        <!DOCTYPE html>
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head>
          <meta charset='utf-8'>
          <title>${filename}</title>
          <style>
            body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; }
            h1 { font-size: 24pt; font-weight: bold; margin-top: 12pt; margin-bottom: 12pt; }
            h2 { font-size: 18pt; font-weight: bold; margin-top: 10pt; margin-bottom: 10pt; }
            h3 { font-size: 14pt; font-weight: bold; margin-top: 8pt; margin-bottom: 8pt; }
            p { margin: 6pt 0; }
            table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
            th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
            th { background-color: #667eea; color: white; font-weight: bold; }
            code { background-color: #f0f0f0; padding: 2pt 4pt; font-family: 'Courier New', monospace; }
            pre { background-color: #2d3748; color: #f9fafb; padding: 12pt; border-radius: 4pt; overflow-x: auto; }
            blockquote { border-left: 4pt solid #3b82f6; background-color: #eff6ff; padding: 12pt 16pt; margin: 12pt 0; font-style: italic; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      const buffer = Buffer.from(docxHTML, 'utf-8');

      console.log(`[Export to DOCX] DOCX generated successfully (${buffer.length} bytes)`);

      return buffer;
    } catch (error: any) {
      console.error('[Export to DOCX] Error:', error);
      throw new Error(`Failed to export to DOCX: ${error.message}`);
    }
  }

  /**
   * Export markdown back to Excel format
   */
  private async exportToExcel(markdownContent: string, filename: string): Promise<Buffer> {
    console.log('[Export to Excel] Starting Excel generation...');

    try {
      // Extract tables from markdown
      const tables = this.extractTablesFromMarkdown(markdownContent);

      if (tables.length === 0) {
        throw new Error('No tables found in document');
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add each table as a sheet
      tables.forEach((table, index) => {
        const sheetName = table.title || `Sheet ${index + 1}`;
        const worksheet = XLSX.utils.aoa_to_sheet(table.data);

        // Apply some basic styling
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

        // Style header row
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
          if (!worksheet[cellAddress]) continue;

          worksheet[cellAddress].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '667EEA' } },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }

        // Auto-size columns
        const colWidths = table.data[0].map((_, colIndex) => {
          const maxLength = Math.max(
            ...table.data.map(row => String(row[colIndex] || '').length)
          );
          return { wch: Math.min(maxLength + 2, 50) };
        });
        worksheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
      });

      // Write to buffer
      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      console.log(`[Export to Excel] Excel generated successfully (${buffer.length} bytes)`);

      return buffer as Buffer;
    } catch (error: any) {
      console.error('[Export to Excel] Error:', error);
      throw new Error(`Failed to export to Excel: ${error.message}`);
    }
  }

  /**
   * Convert markdown to styled HTML
   */
  private async markdownToHTML(markdownContent: string): Promise<string> {
    // Simple markdown to HTML converter
    let htmlBody = markdownContent;

    // Convert headings
    htmlBody = htmlBody.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    htmlBody = htmlBody.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    htmlBody = htmlBody.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Convert bold and italic
    htmlBody = htmlBody.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    htmlBody = htmlBody.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Convert inline code
    htmlBody = htmlBody.replace(/`(.+?)`/g, '<code>$1</code>');

    // Convert code blocks
    htmlBody = htmlBody.replace(/```([^`]+)```/gs, '<pre><code>$1</code></pre>');

    // Convert links
    htmlBody = htmlBody.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Convert lists
    htmlBody = htmlBody.replace(/^[-*+] (.+)$/gm, '<li>$1</li>');
    htmlBody = htmlBody.replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>');

    // Convert blockquotes
    htmlBody = htmlBody.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Convert tables
    htmlBody = this.convertMarkdownTablesToHTML(htmlBody);

    // Convert paragraphs (lines not already in HTML tags)
    const lines = htmlBody.split('\n');
    htmlBody = lines
      .map(line => {
        line = line.trim();
        if (!line) return '<br>';
        if (line.startsWith('<') && line.endsWith('>')) return line;
        if (line.match(/^<(h[1-6]|li|blockquote|pre|table|tr|th|td)/)) return line;
        return `<p>${line}</p>`;
      })
      .join('\n');

    // Wrap in full HTML document with styling
    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif;
            font-size: 16px;
            line-height: 1.7;
            color: #32302C;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
          }
          h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a1a1a;
            margin-top: 0;
            margin-bottom: 24px;
            line-height: 1.2;
            border-bottom: 3px solid #E6E6EC;
            padding-bottom: 16px;
          }
          h2 {
            font-size: 2rem;
            font-weight: 600;
            color: #2d3748;
            margin-top: 48px;
            margin-bottom: 20px;
            line-height: 1.3;
            border-bottom: 2px solid #f3f4f6;
            padding-bottom: 12px;
          }
          h3 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #374151;
            margin-top: 32px;
            margin-bottom: 16px;
            line-height: 1.4;
          }
          p {
            margin-bottom: 16px;
            line-height: 1.8;
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
          a {
            color: #3b82f6;
            text-decoration: none;
            border-bottom: 1px solid #93c5fd;
          }
          ul, ol {
            margin-bottom: 16px;
            padding-left: 28px;
          }
          li {
            margin-bottom: 8px;
            line-height: 1.8;
            color: #4b5563;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          th {
            padding: 14px 16px;
            text-align: left;
            font-weight: 600;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: white;
          }
          tr {
            border-bottom: 1px solid #e5e7eb;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          td {
            padding: 12px 16px;
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
            line-height: 1.5;
          }
          pre code {
            background: none;
            color: inherit;
            padding: 0;
          }
          blockquote {
            border-left: 4px solid #3b82f6;
            background-color: #eff6ff;
            padding: 16px 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
            color: #1e40af;
            font-style: italic;
          }
          hr {
            border: none;
            border-top: 2px solid #e5e7eb;
            margin: 32px 0;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
      </html>
    `;

    return fullHTML;
  }

  /**
   * Convert markdown tables to HTML
   */
  private convertMarkdownTablesToHTML(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inTable = false;
    let tableHTML: string[] = [];

    for (const line of lines) {
      if (line.trim().includes('|') && line.trim().startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHTML = ['<table>'];
        }

        // Skip separator rows
        if (line.match(/^\|[\s\-:]+\|/)) {
          continue;
        }

        // Parse table row
        const cells = line
          .split('|')
          .slice(1, -1)
          .map(cell => cell.trim());

        // Determine if header row (first row of table)
        const isHeader = tableHTML.length === 1;

        if (isHeader) {
          tableHTML.push('<thead><tr>');
          cells.forEach(cell => tableHTML.push(`<th>${cell}</th>`));
          tableHTML.push('</tr></thead><tbody>');
        } else {
          tableHTML.push('<tr>');
          cells.forEach(cell => tableHTML.push(`<td>${cell}</td>`));
          tableHTML.push('</tr>');
        }
      } else if (inTable) {
        // End of table
        tableHTML.push('</tbody></table>');
        result.push(tableHTML.join('\n'));
        tableHTML = [];
        inTable = false;
        result.push(line);
      } else {
        result.push(line);
      }
    }

    // Close table if still open
    if (inTable && tableHTML.length > 0) {
      tableHTML.push('</tbody></table>');
      result.push(tableHTML.join('\n'));
    }

    return result.join('\n');
  }

  /**
   * Extract tables from markdown content
   */
  private extractTablesFromMarkdown(markdownContent: string): Array<{
    title?: string;
    data: string[][];
  }> {
    const tables: Array<{ title?: string; data: string[][] }> = [];
    const lines = markdownContent.split('\n');

    let currentTitle: string | undefined;
    let inTable = false;
    let currentTable: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for heading before table (potential title)
      if (line.startsWith('#')) {
        currentTitle = line.replace(/^#+\s*/, '');
        continue;
      }

      // Check if line is a table row
      if (line.includes('|') && line.startsWith('|')) {
        if (!inTable) {
          inTable = true;
          currentTable = [];
        }

        // Skip separator rows (|---|---|)
        if (line.match(/^\|[\s\-:]+\|/)) {
          continue;
        }

        // Parse table row
        const cells = line
          .split('|')
          .slice(1, -1) // Remove first and last empty elements
          .map(cell => cell.trim());

        currentTable.push(cells);
      } else if (inTable && currentTable.length > 0) {
        // End of table
        tables.push({
          title: currentTitle,
          data: currentTable
        });

        inTable = false;
        currentTable = [];
        currentTitle = undefined;
      }
    }

    // Add last table if exists
    if (currentTable.length > 0) {
      tables.push({
        title: currentTitle,
        data: currentTable
      });
    }

    return tables;
  }
}

export default new DocumentExportService();
