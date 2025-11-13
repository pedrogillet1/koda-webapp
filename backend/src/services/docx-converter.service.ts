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
 * Convert DOCX file to PDF using Mammoth (DOCX → HTML) + Puppeteer (HTML → PDF)
 * This is a pure Node.js solution that doesn't require LibreOffice or X11
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

    console.log(`📄 Converting ${path.basename(docxPath)} to PDF using Mammoth + Puppeteer...`);

    // Verify input file exists
    if (!fs.existsSync(docxPath)) {
      throw new Error(`Input file not found: ${docxPath}`);
    }

    // Step 1: Convert DOCX to HTML using Mammoth
    console.log('📝 Step 1: Converting DOCX to HTML with Mammoth...');
    const result = await mammoth.convertToHtml({ path: docxPath });
    const htmlContent = result.value;

    if (result.messages.length > 0) {
      console.log('ℹ️  Mammoth conversion messages:', result.messages);
    }

    // Wrap HTML in a full document with styling
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      max-width: 21cm;
      margin: 0 auto;
      padding: 20px;
    }
    p {
      margin: 0 0 10pt 0;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      margin: 12pt 0 6pt 0;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin: 10pt 0 6pt 0;
    }
    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin: 10pt 0 6pt 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10pt 0;
    }
    td, th {
      border: 1px solid #000;
      padding: 4pt 8pt;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    ul, ol {
      margin: 0 0 10pt 20pt;
      padding: 0;
    }
    li {
      margin: 0 0 5pt 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Step 2: Convert HTML to PDF using Puppeteer
    console.log('🖨️  Step 2: Converting HTML to PDF with Puppeteer...');

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0'
    });

    // Generate PDF path
    const fileName = path.basename(docxPath, path.extname(docxPath));
    const pdfPath = path.join(outputDir, `${fileName}.pdf`);

    // Generate PDF
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm'
      }
    });

    await browser.close();
    browser = undefined;

    // Verify PDF was created
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

    // Clean up browser if it's still running
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Check if the converter is available (always true for Node.js solution)
 */
export const checkLibreOfficeInstalled = async (): Promise<boolean> => {
  console.log('✅ Using Mammoth + Puppeteer converter (no external dependencies needed)');
  return true;
};
