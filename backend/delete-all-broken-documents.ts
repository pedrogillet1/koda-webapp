/**
 * DELETE ALL BROKEN DOCUMENTS
 *
 * Removes ALL documents that have ANY issues:
 * - Failed status
 * - No extracted text (0 chars)
 * - Missing file in GCS
 * - No embeddings in Pinecone
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

async function deleteAllBrokenDocuments() {
  console.log('🗑️  DELETING ALL BROKEN DOCUMENTS\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Find ALL documents with their metadata
  const allDocs = await prisma.document.findMany({
    include: {
      metadata: {
        select: {
          extractedText: true
        }
      }
    }
  });

  console.log(`📊 Total documents: ${allDocs.length}\n`);

  const brokenDocs = [];

  // Check each document for issues
  for (const doc of allDocs) {
    const issues = [];

    // Issue 1: Failed status
    if (doc.status === 'failed') {
      issues.push('FAILED status');
    }

    // Issue 2: No extracted text
    const textLength = doc.metadata?.extractedText?.length || 0;
    if (doc.status === 'completed' && textLength === 0) {
      issues.push('NO EXTRACTED TEXT (0 chars)');
    }

    // Issue 3: Check if file exists in GCS
    try {
      const filePath = `uploads/${doc.encryptedFilename}`;
      const [exists] = await bucket.file(filePath).exists();
      if (!exists) {
        issues.push('FILE MISSING IN GCS');
      }
    } catch (error) {
      issues.push('GCS CHECK FAILED');
    }

    // Issue 4: Check if has embeddings in Pinecone
    try {
      const queryResponse = await index.query({
        vector: new Array(768).fill(0),
        topK: 1,
        filter: { documentId: { $eq: doc.id } },
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        issues.push('NO EMBEDDINGS IN PINECONE');
      }
    } catch (error) {
      issues.push('PINECONE CHECK FAILED');
    }

    if (issues.length > 0) {
      brokenDocs.push({
        doc,
        issues
      });
    }
  }

  console.log(`❌ Found ${brokenDocs.length} broken documents:\n`);

  // List all broken documents
  for (const { doc, issues } of brokenDocs) {
    console.log(`📄 ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Issues: ${issues.join(', ')}`);
    console.log(`   Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
    console.log('');
  }

  if (brokenDocs.length === 0) {
    console.log('✅ No broken documents found!');
    await prisma.$disconnect();
    return;
  }

  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`🗑️  DELETING ${brokenDocs.length} BROKEN DOCUMENTS...\n`);

  let deleted = 0;
  let failed = 0;

  for (const { doc, issues } of brokenDocs) {
    try {
      console.log(`🗑️  Deleting: ${doc.filename}`);

      // 1. Delete embeddings from Pinecone
      try {
        await index.deleteMany({
          filter: { documentId: { $eq: doc.id } }
        });
        console.log(`   ✅ Deleted embeddings from Pinecone`);
      } catch (error: any) {
        console.log(`   ⚠️  Pinecone deletion failed: ${error.message}`);
      }

      // 2. Delete file from GCS
      try {
        const filePath = `uploads/${doc.encryptedFilename}`;
        await bucket.file(filePath).delete();
        console.log(`   ✅ Deleted file from GCS`);
      } catch (error: any) {
        console.log(`   ⚠️  GCS deletion failed (file may not exist): ${error.message}`);
      }

      // 3. Delete metadata
      try {
        await prisma.documentMetadata.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`   ✅ Deleted metadata`);
      } catch (error: any) {
        console.log(`   ⚠️  Metadata deletion failed: ${error.message}`);
      }

      // 4. Delete document tags
      try {
        await prisma.documentTag.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`   ✅ Deleted document tags`);
      } catch (error: any) {
        console.log(`   ⚠️  Tag deletion failed: ${error.message}`);
      }

      // 5. Delete document record
      await prisma.document.delete({
        where: { id: doc.id }
      });

      console.log(`   ✅ DELETED: ${doc.filename}\n`);
      deleted++;

    } catch (error: any) {
      console.error(`   ❌ FAILED TO DELETE: ${doc.filename}`);
      console.error(`   Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('═══════════════════════════════════════════════════════\n');
  console.log('SUMMARY:');
  console.log(`✅ Successfully deleted: ${deleted} documents`);
  console.log(`❌ Failed to delete: ${failed} documents`);
  console.log('\n🎉 Cleanup complete! You can now re-upload these documents.');
  console.log('The fixed OCR pipeline will process them correctly.\n');

  await prisma.$disconnect();
}

deleteAllBrokenDocuments().catch(console.error);
