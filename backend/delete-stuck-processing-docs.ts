/**
 * Delete all documents stuck in "processing" status with no extracted text
 * These need to be re-uploaded with the fixed OCR pipeline
 */

import prisma from './src/config/database';
import { Storage } from '@google-cloud/storage';
import { Pinecone } from '@pinecone-database/pinecone';

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE,
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const index = pinecone.index('koda-gemini');

async function deleteStuckDocs() {
  console.log('🔍 FINDING STUCK DOCUMENTS\\n');

  // Find documents stuck in processing with no extracted text
  const stuckDocs = await prisma.document.findMany({
    where: {
      status: 'processing'
    },
    include: {
      metadata: {
        select: {
          extractedText: true
        }
      }
    }
  });

  console.log(`Found ${stuckDocs.length} documents in "processing" status\\n`);

  const docsToDelete = stuckDocs.filter(doc => {
    const textLength = doc.metadata?.extractedText?.length || 0;
    return textLength === 0;
  });

  if (docsToDelete.length === 0) {
    console.log('✅ No stuck documents found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`❌ Found ${docsToDelete.length} stuck documents (processing with 0 text):\\n`);

  for (const doc of docsToDelete) {
    console.log(`   • ${doc.filename}`);
  }

  console.log('\\n═══════════════════════════════════════════════════════\\n');
  console.log(`🗑️  DELETING ${docsToDelete.length} stuck documents...\\n`);

  let deleted = 0;
  let failed = 0;

  for (const doc of docsToDelete) {
    try {
      console.log(`🗑️  Deleting: ${doc.filename}`);

      // 1. Delete embeddings from Pinecone (if any)
      try {
        await index.deleteMany({
          filter: { documentId: { $eq: doc.id } }
        });
        console.log(`   ✅ Deleted embeddings from Pinecone`);
      } catch (error: any) {
        console.log(`   ⚠️  Pinecone deletion: ${error.message}`);
      }

      // 2. Delete file from GCS
      try {
        const filePath = `uploads/${doc.encryptedFilename}`;
        await bucket.file(filePath).delete();
        console.log(`   ✅ Deleted file from GCS`);
      } catch (error: any) {
        console.log(`   ⚠️  GCS deletion: ${error.message}`);
      }

      // 3. Delete metadata
      try {
        await prisma.documentMetadata.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`   ✅ Deleted metadata`);
      } catch (error: any) {
        console.log(`   ⚠️  Metadata deletion: ${error.message}`);
      }

      // 4. Delete document tags
      try {
        await prisma.documentTag.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`   ✅ Deleted tags`);
      } catch (error: any) {
        console.log(`   ⚠️  Tag deletion: ${error.message}`);
      }

      // 5. Delete document record
      await prisma.document.delete({
        where: { id: doc.id }
      });

      console.log(`   ✅ DELETED: ${doc.filename}\\n`);
      deleted++;

    } catch (error: any) {
      console.error(`   ❌ FAILED: ${doc.filename}`);
      console.error(`   Error: ${error.message}\\n`);
      failed++;
    }
  }

  console.log('═══════════════════════════════════════════════════════\\n');
  console.log('SUMMARY:');
  console.log(`✅ Successfully deleted: ${deleted} documents`);
  console.log(`❌ Failed to delete: ${failed} documents`);
  console.log('\\n💡 NEXT STEP: Re-upload these documents. The fixed OCR pipeline will process them correctly!\\n');

  await prisma.$disconnect();
}

deleteStuckDocs().catch(console.error);
