/**
 * Force process Capítulo 8 document by ID
 */

import prisma from './src/config/database';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import os from 'os';

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE,
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');

async function forceProcessCapitulo() {
  console.log('🔧 FORCE PROCESSING CAPÍTULO 8\n');

  const docId = 'a19b0774-ba46-4d90-9ef1-d5beca5ff052';

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      metadata: true
    }
  });

  if (!doc) {
    console.log('❌ Document not found');
    await prisma.$disconnect();
    return;
  }

  console.log(`📄 ${doc.filename}`);
  console.log(`   ID: ${doc.id}`);
  console.log(`   Status: ${doc.status}`);
  console.log(`   File size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
  console.log(`   Encrypted filename: ${doc.encryptedFilename}`);
  console.log('');

  try {
    // Download file from GCS
    console.log('📥 Downloading from GCS...');
    const tempFilePath = path.join(os.tmpdir(), doc.encryptedFilename);
    await bucket.file(`uploads/${doc.encryptedFilename}`).download({
      destination: tempFilePath
    });
    console.log(`   ✅ Downloaded to: ${tempFilePath}`);

    // Check if file exists
    if (!fs.existsSync(tempFilePath)) {
      console.error('   ❌ File not found after download');
      await prisma.$disconnect();
      return;
    }

    const fileSize = fs.statSync(tempFilePath).size;
    console.log(`   📊 File size: ${(fileSize / 1024).toFixed(2)} KB\n`);

    // Read file as buffer
    const fileBuffer = fs.readFileSync(tempFilePath);

    // Try robust OCR service
    console.log('🔍 Attempting robust OCR extraction...');
    const { default: robustOCRService } = await import('./src/services/robustOCR.service');
    const result = await robustOCRService.extractText(fileBuffer, doc.filename);

    console.log(`   ✅ Extracted ${result.text.length} chars using ${result.strategy}`);
    console.log(`   📊 Confidence: ${result.confidence}%`);
    console.log(`   📝 Preview: ${result.text.substring(0, 200)}...\n`);

    // Update metadata
    if (doc.metadata) {
      await prisma.documentMetadata.update({
        where: { documentId: doc.id },
        data: {
          extractedText: result.text,
          ocrConfidence: result.confidence,
          wordCount: result.text.split(/\s+/).filter(w => w.length > 0).length
        }
      });
      console.log('   ✅ Updated metadata');
    } else {
      await prisma.documentMetadata.create({
        data: {
          documentId: doc.id,
          extractedText: result.text,
          ocrConfidence: result.confidence,
          wordCount: result.text.split(/\s+/).filter(w => w.length > 0).length
        }
      });
      console.log('   ✅ Created metadata');
    }

    // Update document status to pending so background processor picks it up for embedding
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'pending' }
    });
    console.log('   ✅ Updated status to "pending" for embedding generation\n');

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    console.log('✅ SUCCESS! Document will be processed by background worker for embeddings.');

  } catch (error: any) {
    console.error(`❌ FAILED: ${error.message}`);
    console.error(error.stack);
  }

  await prisma.$disconnect();
}

forceProcessCapitulo().catch(console.error);
