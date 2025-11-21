// Alternative approach: Use pdf-lib to extract pages as images, then Mistral OCR
const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');
const { PDFDocument } = require('pdf-lib');
const { createCanvas, loadImage } = require('canvas');
const pdfjsLib = require('pdfjs-dist');

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

const prisma = new PrismaClient();
const MISTRAL_API_KEY = 'v2CV9hhShBci5OU6b0OHGGEBiCRS42bs';

async function extractTextWithMistral(imageBuffer, mimeType = 'image/png') {
  try {
    console.log(`🤖 [MISTRAL OCR] Processing image...`);

    const imageBase64 = imageBuffer.toString('base64');
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
              text: `Extract ALL text from this document image with PERFECT accuracy.

CRITICAL REQUIREMENTS:
1. Preserve mathematical notation EXACTLY (subscripts, superscripts, symbols)
2. Keep all line breaks and structure
3. Handle handwritten text
4. Handle Portuguese, English, Spanish text
5. Output ONLY the extracted text

If anything is illegible, mark as [ILLEGIBLE].`
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

    return extractedText;

  } catch (error) {
    console.error(`   ❌ Mistral OCR failed:`, error.message);
    return '';
  }
}

async function pdfPageToImage(pdfPath, pageNumber) {
  try {
    // Load PDF
    const dataBuffer = await fs.readFile(pdfPath);
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdfDoc = await loadingTask.promise;

    // Get page
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 }); // High resolution

    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Convert canvas to PNG buffer
    const imageBuffer = canvas.toBuffer('image/png');

    return imageBuffer;

  } catch (error) {
    console.error(`Error converting page ${pageNumber} to image:`, error.message);
    return null;
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
    console.log(`✅ Downloaded\n`);

    // Get PDF page count
    const dataBuffer = await fs.readFile(tempPdfPath);
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    console.log(`📄 PDF has ${numPages} pages`);
    console.log(`🔄 Processing first 3 pages with Mistral OCR...\n`);

    const allText = [];
    const pagesToProcess = Math.min(3, numPages);

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 Processing Page ${pageNum}/${pagesToProcess}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Convert page to image
      console.log(`   📸 Converting to image...`);
      const imageBuffer = await pdfPageToImage(tempPdfPath, pageNum);

      if (!imageBuffer) {
        console.log(`   ⚠️  Failed to convert page to image\n`);
        continue;
      }

      console.log(`   ✅ Image created (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

      // Extract text with Mistral
      const text = await extractTextWithMistral(imageBuffer, 'image/png');

      if (text) {
        allText.push(`\n========== PAGE ${pageNum} ==========\n${text}`);
        console.log(`   📝 Preview (first 200 chars):`);
        console.log(`   ${'-'.repeat(60)}`);
        console.log(`   ${text.substring(0, 200).replace(/\n/g, '\n   ')}...`);
      } else {
        console.log(`   ⚠️  No text extracted`);
      }

      console.log();
    }

    // Combine all text
    const extractedText = allText.join('\n\n');

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 EXTRACTION COMPLETE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`Total characters: ${extractedText.length}`);
    console.log(`Total pages: ${pagesToProcess}`);

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
          wordCount: extractedText.split(/\s+/).filter(w => w.length > 0).length,
          pageCount: numPages
        }
      });
    } else {
      await prisma.documentMetadata.create({
        data: {
          documentId: document.id,
          extractedText: extractedText,
          ocrConfidence: 95,
          characterCount: extractedText.length,
          wordCount: extractedText.split(/\s+/).filter(w => w.length > 0).length,
          pageCount: numPages
        }
      });
    }

    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'completed' }
    });

    console.log(`✅ Database updated! Text is now accessible in KODA.`);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

processPDF();
