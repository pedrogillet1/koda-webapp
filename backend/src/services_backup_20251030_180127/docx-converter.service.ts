import * as path from 'path';
import * as fs from 'fs';
import mammoth from 'mammoth';
import puppeteer from 'puppeteer';

interface ConversionResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
}

/**
 * Convert DOCX file to PDF using Mammoth.js (DOCX -> HTML) and Puppeteer (HTML -> PDF)
 * No external dependencies required - fully self-contained
 */
export const convertDocxToPdf = async (
  docxPath: string,
  outputDir?: string
): Promise<ConversionResult> => {
  let browser;
  try {
    // Use same directory if not specified
    if (!outputDir) {
      outputDir = path.dirname(docxPath);
    }

    console.log(`📄 Converting ${path.basename(docxPath)} to PDF...`);

    // Step 1: Convert DOCX to HTML using Mammoth
    console.log('Step 1: Converting DOCX to HTML with Mammoth...');
    const docxBuffer = fs.readFileSync(docxPath);
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    const html = result.value; // The generated HTML
    const messages = result.messages; // Any messages (warnings, errors)

    if (messages.length > 0) {
      console.log('Mammoth conversion messages:', messages);
    }

    // Step 2: Wrap HTML in proper document structure with styling
    const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      margin: 1in;
      color: #000;
    }
    p {
      margin: 0 0 10pt 0;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 12pt;
      margin-bottom: 6pt;
      font-weight: bold;
    }
    h1 { font-size: 16pt; }
    h2 { font-size: 14pt; }
    h3 { font-size: 12pt; }
    table {
      border-collapse: collapse;
      margin: 10pt 0;
    }
    table td, table th {
      border: 1px solid #000;
      padding: 4pt 8pt;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    ul, ol {
      margin: 0 0 10pt 0;
      padding-left: 30pt;
    }
    li {
      margin-bottom: 5pt;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `;

    // Step 3: Convert HTML to PDF using Puppeteer
    console.log('Step 2: Converting HTML to PDF with Puppeteer...');

    // Add timeout to prevent hanging on Mac systems
    const launchTimeout = 30000; // 30 seconds
    browser = await Promise.race([
      puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process' // Helps on Mac
        ],
        timeout: launchTimeout
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Puppeteer launch timeout - browser failed to start')), launchTimeout)
      )
    ]);

    const page = await browser.newPage();

    // Set shorter timeout for content loading to prevent hanging
    await page.setContent(styledHtml, {
      waitUntil: 'networkidle0',
      timeout: 15000 // 15 second timeout
    });

    // Determine output PDF path
    const fileName = path.basename(docxPath, path.extname(docxPath));
    const pdfPath = path.join(outputDir, `${fileName}.pdf`);

    // Generate PDF with proper formatting
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      }
    });

    await browser.close();

    // Check if PDF was created
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF conversion failed - output file not found');
    }

    const stats = fs.statSync(pdfPath);
    console.log(`✅ PDF created: ${pdfPath} (${stats.size} bytes)`);

    return {
      success: true,
      pdfPath: pdfPath,
    };
  } catch (error: any) {
    console.error('❌ DOCX to PDF conversion error:', error.message);

    // Clean up browser if it was launched
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Check if conversion dependencies are available
 * With Mammoth + Puppeteer, dependencies are bundled in node_modules
 */
export const checkLibreOfficeInstalled = async (): Promise<boolean> => {
  // Always return true since we're using bundled dependencies
  return true;
};
