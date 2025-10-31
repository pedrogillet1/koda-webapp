import prisma from './src/config/database';
import * as documentService from './src/services/document.service';
import fs from 'fs';
import path from 'path';

async function testProcessing() {
  // Get the failed document
  const doc = await prisma.document.findFirst({
    where: {
      filename: { contains: 'Math Profitability' },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!doc) {
    console.log('Document not found');
    process.exit(1);
  }

  console.log('\n=== MANUAL PROCESSING TEST ===\n');
  console.log('Document ID:', doc.id);
  console.log('Filename:', doc.filename);
  console.log('File Hash:', doc.fileHash);
  console.log('\nAttempting to fetch file from GCS and re-process...\n');

  try {
    // Import GCS
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage({
      keyFilename: process.env.GCS_KEY_FILE,
      projectId: process.env.GCS_PROJECT_ID,
    });
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');

    // Download file
    const gcsPath = `documents/${doc.id}`;
    console.log(`Downloading from GCS: ${gcsPath}`);
    const [fileBuffer] = await bucket.file(gcsPath).download();
    console.log(`Downloaded ${fileBuffer.length} bytes`);

    // Process document
    console.log('\nStarting document processing...\n');
    const processFunction = (documentService as any).processDocumentInBackground;
    await processFunction(doc.id, fileBuffer, doc.filename, doc.mimeType, doc.userId, null);

    console.log('\n✅ Processing completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Processing failed:');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

testProcessing();
