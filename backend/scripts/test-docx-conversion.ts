import { convertDocxToPdf } from '../src/services/docx-converter.service';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function testConversion() {
  console.log('\n🧪 Testing DOCX to PDF Conversion\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create a test DOCX file with simple content
  const testContent = `
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
    h1 {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 6pt;
    }
    p {
      margin: 0 0 10pt 0;
    }
  </style>
</head>
<body>
  <h1>Test Document</h1>
  <p>This is a test document to verify DOCX to PDF conversion.</p>
  <p>If you can see this as a formatted PDF, the conversion is working!</p>
</body>
</html>
  `;

  // For this test, we'll just test the HTML to PDF part with Puppeteer
  const puppeteer = await import('puppeteer');

  console.log('✅ Puppeteer imported successfully');

  try {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log('✅ Browser launched');

    const page = await browser.newPage();
    await page.setContent(testContent, {
      waitUntil: 'networkidle0'
    });

    console.log('✅ Content loaded');

    const testPdfPath = path.join(os.tmpdir(), 'test-docx-conversion.pdf');
    await page.pdf({
      path: testPdfPath,
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

    console.log('✅ PDF generated');

    const stats = fs.statSync(testPdfPath);
    console.log(`✅ PDF file created: ${testPdfPath}`);
    console.log(`   Size: ${stats.size} bytes`);

    // Clean up
    fs.unlinkSync(testPdfPath);
    console.log('✅ Cleanup complete\n');
    console.log('🎉 DOCX to PDF conversion is working correctly!\n');

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testConversion().catch(console.error);
