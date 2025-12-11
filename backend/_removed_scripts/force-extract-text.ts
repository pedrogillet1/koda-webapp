/**
 * Force text extraction on documents with no extracted text
 * Uses direct file access and robust OCR
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

async function forceExtractText() {
  console.log('🔧 FORCE EXTRACTING TEXT FROM EMPTY DOCUMENTS\n');

  const problematicNames = [
    'Lone Mountain Ranch P&L 2025 (Budget) (1).pdf',
    'Capítulo 8 (Framework Scrum).pdf'
  ];

  const docs = await prisma.document.findMany({
    where: {
      filename: { in: problematicNames }
    },
    include: {
      metadata: true
    }
  });

  console.log(`Found ${docs.length} documents to process\n`);

  for (const doc of docs) {
    console.log(`\n📄 Processing: ${doc.filename}`);
    console.log(`   File size: ${(doc.fileSize / 1024).toFixed(2)} KB`);

    try {
      // Download file from GCS
      const tempFilePath = path.join(os.tmpdir(), doc.encryptedFilename);
      await bucket.file(`uploads/${doc.encryptedFilename}`).download({
        destination: tempFilePath
      });

      console.log(`   ✅ Downloaded from GCS`);

      // Read file as buffer
      const fileBuffer = fs.readFileSync(tempFilePath);

      // Try robust OCR service
      console.log(`   🔍 Attempting robust OCR extraction...`);

      const { default: robustOCRService } = await import('./src/services/robustOCR.service');
      const result = await robustOCRService.extractText(fileBuffer, doc.filename);

      console.log(`   ✅ Extracted ${result.text.length} chars using ${result.strategy}`);
      console.log(`   📊 Confidence: ${result.confidence}%`);

      // Update metadata
      if (doc.metadata) {
        await prisma.documentMetadata.update({
          where: { documentId: doc.id },
          data: {
            extractedText: result.text,
            ocrConfidence: result.confidence,
            wordCount: result.text.split(/\s+/).length
          }
        });
      } else {
        await prisma.documentMetadata.create({
          data: {
            documentId: doc.id,
            extractedText: result.text,
            ocrConfidence: result.confidence,
            wordCount: result.text.split(/\s+/).length
          }
        });
      }

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      console.log(`   ✅ SUCCESS: ${doc.filename}`);

    } catch (error: any) {
      console.error(`   ❌ FAILED: ${doc.filename}`);
      console.error(`   Error: ${error.message}`);
    }
  }

  console.log('\n✅ Force extraction complete!');
  await prisma.$disconnect();
}

forceExtractText().catch(console.error);
