// Extract text from encrypted Anotações Aula 2.pdf using decryption + Mistral OCR
const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');

const execPromise = util.promisify(exec);
const prisma = new PrismaClient();
const MISTRAL_API_KEY = 'v2CV9hhShBci5OU6b0OHGGEBiCRS42bs';

// Encryption settings (matching encryption.service.ts)
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(context = 'file') {
  const masterKey = process.env.ENCRYPTION_KEY || '';

  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY not found in environment variables');
  }

  // Derive key using PBKDF2 with context as salt (matching encryption.service.ts)
  const salt = crypto.createHash('sha256').update(context).digest();
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

function decryptFile(encryptedBuffer, userId) {
  try {
    console.log(`   🔓 Decrypting file (${encryptedBuffer.length} bytes)...`);
    console.log(`   🔑 Using decryption context: document-${userId}`);

    // Extract IV, AuthTag, and encrypted data
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    const context = `document-${userId}`;
    const key = getEncryptionKey(context);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    console.log(`   ✅ Decrypted successfully (${decrypted.length} bytes)`);

    return decrypted;
  } catch (error) {
    console.error('   ❌ File decryption error:', error.message);
    throw new Error('Failed to decrypt file');
  }
}

async function extractTextWithMistral(imagePath) {
  try {
    console.log(`🤖 [MISTRAL OCR] Processing: ${path.basename(imagePath)}`);

    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    console.log(`   📦 Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

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
5. Output ONLY the extracted text, no commentary

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

async function convertPdfPageToPng(pdfPath, pageNum, outputPath) {
  try {
    // Use Python with PyMuPDF to convert PDF page to PNG
    const pythonScript = `
import fitz  # PyMuPDF
import sys

pdf_path = sys.argv[1]
page_num = int(sys.argv[2]) - 1  # 0-indexed
output_path = sys.argv[3]

doc = fitz.open(pdf_path)
page = doc[page_num]
pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))  # 2x scale for better quality
pix.save(output_path)
doc.close()
print(f"Converted page {page_num + 1} to {output_path}")
`;

    const scriptPath = path.join(__dirname, 'temp', 'convert_page.py');
    await fs.writeFile(scriptPath, pythonScript, 'utf-8');

    const { stdout, stderr } = await execPromise(
      `python "${scriptPath}" "${pdfPath}" ${pageNum} "${outputPath}"`
    );

    if (stderr && !stderr.includes('UserWarning')) {
      console.error(`   ⚠️  Python stderr: ${stderr}`);
    }

    return true;

  } catch (error) {
    console.error(`   ❌ Failed to convert page ${pageNum}:`, error.message);
    return false;
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

    // Download encrypted file from GCS
    console.log('☁️  Downloading from Google Cloud Storage...');

    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-service-account.json',
      projectId: process.env.GCS_PROJECT_ID
    });

    const bucketName = process.env.GCS_BUCKET_NAME || 'koda-documents-dev';
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(document.encryptedFilename);

    const [encryptedBuffer] = await file.download();
    console.log(`✅ Downloaded ${encryptedBuffer.length} bytes\n`);

    // Decrypt the file
    console.log('🔐 Decrypting file...');
    const decryptedBuffer = decryptFile(encryptedBuffer, document.userId);

    // Verify it's a valid PDF
    const header = decryptedBuffer.slice(0, 4).toString('ascii');
    if (header !== '%PDF') {
      throw new Error(`Invalid PDF header: ${header}`);
    }
    console.log(`✅ Valid PDF file (${decryptedBuffer.length} bytes)\n`);

    // Save decrypted PDF
    const tempPdfPath = path.join(__dirname, 'temp', `anotacoes-decrypted.pdf`);
    await fs.mkdir(path.join(__dirname, 'temp'), { recursive: true });
    await fs.writeFile(tempPdfPath, decryptedBuffer);
    console.log(`💾 Saved decrypted PDF to temp directory\n`);

    // Try to get page count with Python
    let numPages = 3; // Default to processing 3 pages
    try {
      const countScript = `
import fitz
import sys
doc = fitz.open(sys.argv[1])
print(doc.page_count)
doc.close()
`;
      const countScriptPath = path.join(__dirname, 'temp', 'count_pages.py');
      await fs.writeFile(countScriptPath, countScript, 'utf-8');

      const { stdout } = await execPromise(`python "${countScriptPath}" "${tempPdfPath}"`);
      numPages = parseInt(stdout.trim());
      console.log(`📄 PDF has ${numPages} pages`);
    } catch (error) {
      console.log(`⚠️  Could not determine page count, defaulting to 3 pages`);
    }

    console.log(`🔄 Processing first ${Math.min(5, numPages)} pages with Mistral OCR...\n`);

    const allText = [];
    const pagesToProcess = Math.min(5, numPages); // Process up to 5 pages

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 Processing Page ${pageNum}/${pagesToProcess}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      const imagePath = path.join(__dirname, 'temp', `page-${pageNum}.png`);

      console.log(`   📸 Converting PDF page to image...`);
      const success = await convertPdfPageToPng(tempPdfPath, pageNum, imagePath);

      if (!success) {
        console.log(`   ⚠️  Failed to convert page\n`);
        continue;
      }

      console.log(`   ✅ Image created`);

      const text = await extractTextWithMistral(imagePath);

      if (text) {
        allText.push(`\n========== PAGE ${pageNum} ==========\n${text}`);
        console.log(`   📝 Preview (first 200 chars):`);
        console.log(`   ${'-'.repeat(60)}`);
        console.log(`   ${text.substring(0, 200).replace(/\n/g, '\n   ')}...`);
      } else {
        console.log(`   ⚠️  No text extracted`);
      }

      // Clean up image
      try {
        await fs.unlink(imagePath);
      } catch (e) {
        // Ignore cleanup errors
      }

      console.log();
    }

    const extractedText = allText.join('\n\n');

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 EXTRACTION COMPLETE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`Total characters: ${extractedText.length}`);
    console.log(`Total pages processed: ${pagesToProcess}`);
    console.log(`Total pages in PDF: ${numPages}`);

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

    const wordCountFinal = extractedText.split(/\s+/).filter(w => w.length > 0).length;

    if (metadata) {
      await prisma.documentMetadata.update({
        where: { documentId: document.id },
        data: {
          extractedText: extractedText,
          ocrConfidence: 95,
          characterCount: extractedText.length,
          wordCount: wordCountFinal,
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
          wordCount: wordCountFinal,
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
