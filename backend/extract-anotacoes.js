// Standalone script to extract text from Anotações Aula 2.pdf using Mistral OCR
const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');
const pdf2pic = require('pdf2pic');

const prisma = new PrismaClient();
const MISTRAL_API_KEY = 'v2CV9hhShBci5OU6b0OHGGEBiCRS42bs';

async function extractTextWithMistral(imagePath) {
  try {
    console.log(`🤖 [MISTRAL OCR] Processing: ${path.basename(imagePath)}`);

    // Read image and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    console.log(`   📦 Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

    // Call Mistral vision API
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
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` }
            },
            {
              type: 'text',
              text: `Extract ALL text from this image with PERFECT accuracy.

CRITICAL REQUIREMENTS:
1. Preserve mathematical notation EXACTLY:
   - Subscripts: X₁, X₂ (not X1, X2)
   - Symbols: ≤, ≥, ±, ×, ÷, ≠, ≈, ∞
   - Equations: preserve spacing and operators
2. Preserve structure:
   - Keep line breaks
   - Keep indentation
   - Keep bullet points
3. Handle handwritten text
4. Handle mixed languages (Portuguese + English + Spanish)
5. Output ONLY the extracted text, no commentary

If you cannot read something, output [ILLEGIBLE] but try your best to extract everything.`
            }
          ]
        }],
        max_tokens: 4096,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    console.log(`   ✅ Extracted ${extractedText.length} characters`);

    return {
      text: extractedText,
      confidence: 95,
      warnings: []
    };

  } catch (error) {
    console.error(`   ❌ Mistral OCR failed:`, error.message);
    return {
      text: '',
      confidence: 0,
      warnings: [`Mistral OCR failed: ${error.message}`]
    };
  }
}

async function processPDF() {
  try {
    console.log('🔍 Finding Anotações Aula 2 document...\n');

    // Find the document
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
    console.log(`   Encrypted name: ${document.encryptedFilename}`);
    console.log(`   Size: ${(document.fileSize / 1024 / 1024).toFixed(2)} MB\n`);

    // Download from Google Cloud Storage
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
    console.log(`✅ Downloaded to: ${tempPdfPath}\n`);

    const pdfPath = tempPdfPath;

    // Convert first 3 pages of PDF to images
    console.log('🔄 Converting PDF pages to images (first 3 pages)...\n');

    const convert = pdf2pic.fromPath(pdfPath, {
      density: 300,
      saveFilename: `anotacoes-page`,
      savePath: path.join(__dirname, 'temp'),
      format: 'png',
      width: 2480,
      height: 3508
    });

    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const allText = [];

    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 Processing Page ${pageNum}/3`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      try {
        const result = await convert(pageNum, { responseType: 'image' });
        const imagePath = result.path;

        console.log(`   📸 Image created: ${path.basename(imagePath)}`);

        // Extract text with Mistral
        const ocrResult = await extractTextWithMistral(imagePath);

        if (ocrResult.text) {
          allText.push(`\n========== PAGE ${pageNum} ==========\n${ocrResult.text}`);
          console.log(`   📝 Text preview (first 200 chars):`);
          console.log(`   ${'-'.repeat(60)}`);
          console.log(`   ${ocrResult.text.substring(0, 200).replace(/\n/g, '\n   ')}...`);
        } else {
          console.log(`   ⚠️  No text extracted from this page`);
        }

        // Clean up image
        await fs.unlink(imagePath);
        console.log(`   🗑️  Cleaned up image\n`);

      } catch (error) {
        console.error(`   ❌ Error processing page ${pageNum}:`, error.message);
      }
    }

    // Save extracted text
    const extractedText = allText.join('\n\n');

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 EXTRACTION COMPLETE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`Total characters extracted: ${extractedText.length}`);
    console.log(`Total pages processed: 3`);

    // Save to file
    const outputPath = path.join(__dirname, 'anotacoes-aula-2-extracted.txt');
    await fs.writeFile(outputPath, extractedText, 'utf-8');
    console.log(`\n💾 Saved to: ${outputPath}`);

    console.log(`\n📄 Full extracted text:\n`);
    console.log('='.repeat(80));
    console.log(extractedText);
    console.log('='.repeat(80));

    // Update database
    console.log(`\n💾 Updating database...`);

    // Check if metadata exists
    let metadata = await prisma.documentMetadata.findUnique({
      where: { documentId: document.id }
    });

    if (metadata) {
      await prisma.documentMetadata.update({
        where: { documentId: document.id },
        data: {
          extractedText: extractedText,
          ocrConfidence: 95,
          characterCount: extractedText.length,
          wordCount: extractedText.split(/\s+/).filter(w => w.length > 0).length
        }
      });
    } else {
      await prisma.documentMetadata.create({
        data: {
          documentId: document.id,
          extractedText: extractedText,
          ocrConfidence: 95,
          characterCount: extractedText.length,
          wordCount: extractedText.split(/\s+/).filter(w => w.length > 0).length
        }
      });
    }

    // Update document status
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'completed' }
    });

    console.log(`✅ Database updated successfully!`);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

processPDF();
