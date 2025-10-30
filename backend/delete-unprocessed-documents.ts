/**
 * Delete All Unprocessed Documents
 * Cleans up failed/stuck documents from database and storage
 * Fresh start for Pinecone-only approach
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { deleteFile } from './src/config/storage';
import pineconeService from './src/services/pinecone.service';

const prisma = new PrismaClient();

async function deleteUnprocessedDocuments() {
  console.log('🗑️  CLEANUP: Delete All Unprocessed Documents\n');
  console.log('='.repeat(80));

  try {
    // Step 1: Find all unprocessed documents
    console.log('\n📊 STEP 1: Finding unprocessed documents...\n');

    const unprocessedDocs = await prisma.document.findMany({
      where: {
        OR: [
          { status: 'failed' },
          { status: 'processing' },
          {
            AND: [
              { status: 'completed' },
              {
                metadata: {
                  OR: [
                    { extractedText: null },
                    { extractedText: '' }
                  ]
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        filename: true,
        encryptedFilename: true,
        status: true,
        userId: true,
        mimeType: true
      }
    });

    console.log(`Found ${unprocessedDocs.length} unprocessed documents\n`);

    if (unprocessedDocs.length === 0) {
      console.log('✅ No unprocessed documents to delete!');
      return;
    }

    // Group by user and status
    const byUser: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    unprocessedDocs.forEach(doc => {
      byUser[doc.userId] = (byUser[doc.userId] || 0) + 1;
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
    });

    console.log('Breakdown by status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} documents`);
    });

    console.log('\nBreakdown by user:');
    Object.entries(byUser).forEach(([userId, count]) => {
      console.log(`   User ${userId.substring(0, 8)}...: ${count} documents`);
    });

    // Step 2: Confirm deletion
    console.log('\n\n⚠️  WARNING: This will DELETE all unprocessed documents!');
    console.log('This includes:');
    console.log('   - Database records');
    console.log('   - Storage files (GCS)');
    console.log('   - Vector embeddings (Pinecone)');
    console.log('   - Metadata');
    console.log('\nThis operation CANNOT be undone!\n');

    // Auto-proceed for script execution
    console.log('🚀 Starting cleanup...\n');

    // Step 3: Delete each document
    let deletedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < unprocessedDocs.length; i++) {
      const doc = unprocessedDocs[i];

      console.log(`\n[${i + 1}/${unprocessedDocs.length}] Deleting: ${doc.filename}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Type: ${doc.mimeType}`);

      try {
        // 1. Delete from Pinecone (if embeddings exist)
        try {
          await pineconeService.deleteDocumentEmbeddings(doc.id);
          console.log(`   ✅ Pinecone embeddings deleted`);
        } catch (error) {
          console.log(`   ⚠️  Pinecone deletion skipped (may not exist)`);
        }

        // 2. Delete from GCS storage
        try {
          await deleteFile(doc.encryptedFilename);
          console.log(`   ✅ Storage file deleted`);
        } catch (error: any) {
          console.log(`   ⚠️  Storage deletion failed: ${error.message}`);
        }

        // 3. Delete metadata
        await prisma.documentMetadata.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`   ✅ Metadata deleted`);

        // 4. Delete embeddings (PostgreSQL - if any remain)
        await prisma.documentEmbedding.deleteMany({
          where: { documentId: doc.id }
        });
        console.log(`   ✅ PostgreSQL embeddings deleted`);

        // 5. Delete document record
        await prisma.document.delete({
          where: { id: doc.id }
        });
        console.log(`   ✅ Document record deleted`);

        deletedCount++;

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`   ❌ FAILED: ${error.message}`);
        failedCount++;
      }
    }

    // Step 4: Final summary
    console.log('\n\n📊 CLEANUP RESULTS');
    console.log('='.repeat(80));
    console.log(`Total unprocessed: ${unprocessedDocs.length}`);
    console.log(`✅ Successfully deleted: ${deletedCount}`);
    console.log(`❌ Failed to delete: ${failedCount}`);

    if (deletedCount > 0) {
      console.log('\n✨ Cleanup complete! Database is now clean.');
      console.log('\nNext steps:');
      console.log('1. Only successfully processed documents remain');
      console.log('2. All future uploads will use Pinecone');
      console.log('3. Re-run the 30-question test to see improved scores');
    }

    // Step 5: Show final database stats
    console.log('\n\n📊 FINAL DATABASE STATS');
    console.log('-'.repeat(80));

    const totalDocs = await prisma.document.count();
    const completedDocs = await prisma.document.count({ where: { status: 'completed' } });

    console.log(`Total documents remaining: ${totalDocs}`);
    console.log(`Completed: ${completedDocs} (${((completedDocs/totalDocs)*100).toFixed(1)}%)`);

    const embeddings = await prisma.documentEmbedding.count();
    console.log(`PostgreSQL embeddings: ${embeddings}`);

    const pineconeStats = await pineconeService.getIndexStats();
    if (pineconeStats.available) {
      console.log(`Pinecone vectors: ${pineconeStats.totalVectorCount}`);
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUnprocessedDocuments();
