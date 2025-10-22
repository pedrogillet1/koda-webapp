import { downloadFile } from '../src/config/storage';
import fs from 'fs';
import os from 'path';

const pdfParse = require('pdf-parse').pdf;

async function testPdfExtraction() {
  console.log('\n🔍 TESTING PDF EXTRACTION FOR KODA BUSINESS PLAN\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Download the Koda Business Plan PDF
  const gcsPath = '03ec97ac-1934-4188-8471-524366d87521/6e9d550a-825a-49f8-b2e7-ff254592cc41-1759941561538';

  console.log(`📥 Downloading file from GCS...`);
  const fileBuffer = await downloadFile(gcsPath);
  console.log(`✅ Downloaded ${fileBuffer.length} bytes\n`);

  // Save to temp file for inspection
  const tempPath = os.join(require('os').tmpdir(), 'koda-business-plan-test.pdf');
  fs.writeFileSync(tempPath, fileBuffer);
  console.log(`💾 Saved to: ${tempPath}\n`);

  // Extract text using pdf-parse
  console.log(`🔄 Extracting text with pdf-parse...\n`);

  try {
    const data = await pdfParse(fileBuffer);

    console.log(`📊 PDF INFO:`);
    console.log(`   Total pages: ${data.numpages}`);
    console.log(`   PDF version: ${data.version}`);
    console.log(`   Text length: ${data.text.length} characters\n`);

    console.log(`📝 FIRST 500 CHARACTERS:`);
    console.log(`   "${data.text.substring(0, 500)}"\n`);

    console.log(`📝 LAST 500 CHARACTERS:`);
    console.log(`   "${data.text.substring(data.text.length - 500)}"\n`);

    // Check for specific content
    console.log(`🔍 CONTENT ANALYSIS:`);
    const hasComprovante = data.text.toLowerCase().includes('comprovante');
    const hasPsych = data.text.includes('AGITAÇÃO PSICOMOTORA');
    const hasBizPlan = data.text.toLowerCase().includes('business plan');
    const hasKoda = data.text.toLowerCase().includes('koda');

    console.log(`   Contains "comprovante": ${hasComprovante ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`   Contains "AGITAÇÃO PSICOMOTORA": ${hasPsych ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`   Contains "business plan": ${hasBizPlan ? 'YES' : 'NO'}`);
    console.log(`   Contains "koda": ${hasKoda ? 'YES' : 'NO'}`);

    if (hasComprovante) {
      const index = data.text.toLowerCase().indexOf('comprovante');
      console.log(`\n📍 "Comprovante" found at position ${index}`);
      console.log(`   Context (200 chars):`);
      const start = Math.max(0, index - 100);
      const end = Math.min(data.text.length, index + 100);
      console.log(`   "${data.text.substring(start, end)}"`);
    }

    if (hasBizPlan) {
      const index = data.text.toLowerCase().indexOf('business plan');
      console.log(`\n📍 "Business plan" found at position ${index}`);
      console.log(`   Context (200 chars):`);
      const start = Math.max(0, index - 100);
      const end = Math.min(data.text.length, index + 100);
      console.log(`   "${data.text.substring(start, end)}"`);
    }

  } catch (error: any) {
    console.error(`❌ Error extracting text:`, error.message);
  }

  console.log(`\n✅ Test complete. You can inspect the PDF at: ${tempPath}\n`);
}

testPdfExtraction().catch(console.error);
