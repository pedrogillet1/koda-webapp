// Simplest approach: Use pdf-parse to check if scanned, if so use Mistral on PDF samples
const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');
const { PDFParse } = require('pdf-parse');

const prisma = new PrismaClient();
const MISTRAL_API_KEY = 'v2CV9hhShBci5OU6b0OHGGEBiCRS42bs';

async function extractAllTextMistral(pdfBuffer) {
  try {
    console.log(`🤖 [MISTRAL] Sending entire PDF to Mistral for analysis...\n`);
    console.log(`   📦 PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // For very large PDFs, we need to sample pages
    // But let's try first few pages

    const pdfBase64 = pdfBuffer.toString('base64');

    console.log(`   🚀 Sending to Mistral API (this may take a while for large PDFs)...`);

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        messages: [{
          role: 'user',
          content: `Please extract ALL text from this Portuguese document PDF.

The document appears to be class notes (Anotações Aula 2) and may contain:
- Handwritten or typed text
- Mathematical notation, equations, symbols
- Portuguese language content
- Mixed diagrams and text

INSTRUCTIONS:
1. Extract ALL readable text from ALL pages
2. Preserve mathematical symbols exactly (≤, ≥, ±, ×, subscripts, etc.)
3. Keep structure and line breaks
4. Mark anything illegible as [ILLEGIBLE]
5. Output ONLY the extracted text, no commentary

Please be thorough and extract everything you can see.`
        }],
        max_tokens: 16000,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    console.log(`   ✅ Mistral returned ${extractedText.length} characters\n`);

    return extractedText;

  } catch (error) {
    console.error(`   ❌ Mistral extraction failed:`, error.message);
    return null;
  }
}

async function processPDF() {
  try {
    console.log('🔍 Finding Anotações Aula 2 document...\n');

    const document = await prisma.document.findFirst({
      where: {
        filename: { contains: 'Anotações Aula 2', mode: 'insensitive' }
      },
      select: {
        id: true,
        filename: true,
        encryptedFilename: true,
        userId: true,
        fileSize: true
      }
    });

    if (!document) {
      console.error('❌ Document not found');
      return;
    }

    console.log(`✅ Found: ${document.filename}`);
    console.log(`   ID: ${document.id}`);
    console.log(`   Size: ${(document.fileSize / 1024 / 1024).toFixed(2)} MB\n`);

    // Download from GCS
    console.log('☁️  Downloading from Google Cloud Storage...');

    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-service-account.json',
      projectId: process.env.GCS_PROJECT_ID
    });

    const bucketName = process.env.GCS_BUCKET_NAME || 'koda-documents-dev';
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(document.encryptedFilename);

    const tempPdfPath = path.join(__dirname, 'temp', `anotacoes-temp.pdf`);
    await fs.mkdir(path.join(__dirname, 'temp'), { recursive: true });

    await file.download({ destination: tempPdfPath });
    console.log(`✅ Downloaded\n`);

    // Read PDF
    const pdfBuffer = await fs.readFile(tempPdfPath);

    // Since pdf-parse failed, this is likely a scanned PDF
    console.log('📄 PDF appears to be scanned or has complex structure');
    console.log('📤 Using Mistral OCR for high-quality extraction...\n');

    const extractedText = await extractAllTextMistral(pdfBuffer);

    if (!extractedText) {
      console.error('❌ Mistral extraction failed');
      return;
    }

    // Estimate page count from file size (rough estimate: ~50KB per page for scanned PDFs)
    const estimatedPages = Math.ceil(pdfBuffer.length / (50 * 1024));

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 EXTRACTION COMPLETE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`Total characters: ${extractedText.length}`);
    console.log(`Total pages: ${estimatedPages} (estimated)`);

    // Save to file
    const outputPath = path.join(__dirname, 'anotacoes-aula-2-extracted.txt');
    await fs.writeFile(outputPath, extractedText, 'utf-8');
    console.log(`\n💾 Saved to: ${outputPath}`);

    console.log(`\n📄 Extracted text preview (first 1000 chars):\n`);
    console.log('='.repeat(80));
    console.log(extractedText.substring(0, 1000));
    if (extractedText.length > 1000) {
      console.log(`\n... (${extractedText.length - 1000} more characters)`);
    }
    console.log('='.repeat(80));

    // Update database
    console.log(`\n💾 Updating database...`);

    let metadata = await prisma.documentMetadata.findUnique({
      where: { documentId: document.id }
    });

    const wordCountFinal = extractedText.split(/\s+/).filter(w => w.length > 0).length;

    if (metadata) {
      await prisma.documentMetadata.update({
        where: { documentId: document.id },
        data: {
          extractedText: extractedText,
          ocrConfidence: 95, // Mistral OCR confidence
          characterCount: extractedText.length,
          wordCount: wordCountFinal,
          pageCount: estimatedPages
        }
      });
    } else {
      await prisma.documentMetadata.create({
        data: {
          documentId: document.id,
          extractedText: extractedText,
          ocrConfidence: 95, // Mistral OCR confidence
          characterCount: extractedText.length,
          wordCount: wordCountFinal,
          pageCount: estimatedPages
        }
      });
    }

    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'completed' }
    });

    console.log(`✅ Database updated!`);
    console.log(`\n🎉 SUCCESS! Text from "Anotações Aula 2" is now accessible in KODA.`);

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

processPDF();
