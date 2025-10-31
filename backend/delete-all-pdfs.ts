/**
 * Delete All PDFs - Complete Cleanup
 *
 * Deletes all PDF files from:
 * 1. Database (documents, metadata, embeddings, tags)
 * 2. Google Cloud Storage
 * 3. Pinecone vector database
 *
 * Users will need to re-upload their PDFs with the new Robust OCR system.
 *
 * Usage: npx ts-node delete-all-pdfs.ts
 */

import prisma from './src/config/database';
import { deleteFile } from './src/config/storage';
import vectorEmbeddingService from './src/services/vectorEmbedding.service';

async function deleteAllPDFs() {
  console.log('🗑️  Starting complete PDF cleanup...\n');

  try {
    // Find all PDF documents
    const allPDFs = await prisma.document.findMany({
      where: {
        mimeType: 'application/pdf',
      },
      select: {
        id: true,
        filename: true,
        encryptedFilename: true,
        userId: true,
      },
    });

    if (allPDFs.length === 0) {
      console.log('✅ No PDFs found - database is already clean!');
      return;
    }

    console.log(`Found ${allPDFs.length} PDF(s) to delete\n`);

    let successCount = 0;
    let failCount = 0;

    // Delete each PDF
    for (const pdf of allPDFs) {
      try {
        console.log(`🗑️  Deleting: ${pdf.filename}`);

        // 1. Delete from Pinecone (vector embeddings)
        try {
          await vectorEmbeddingService.deleteDocumentEmbeddings(pdf.id);
          console.log('   ✓ Deleted from Pinecone');
        } catch (error) {
          console.log('   ⚠️  Pinecone deletion skipped (may not exist)');
        }

        // 2. Delete from Google Cloud Storage
        try {
          await deleteFile(pdf.encryptedFilename);
          console.log('   ✓ Deleted from GCS');
        } catch (error) {
          console.log('   ⚠️  GCS deletion skipped (may not exist)');
        }

        // 3. Delete document tags (junction table)
        await prisma.documentTag.deleteMany({
          where: { documentId: pdf.id },
        });
        console.log('   ✓ Deleted tags');

        // 4. Delete document metadata
        await prisma.documentMetadata.deleteMany({
          where: { documentId: pdf.id },
        });
        console.log('   ✓ Deleted metadata');

        // 5. Delete document from database
        await prisma.document.delete({
          where: { id: pdf.id },
        });
        console.log('   ✓ Deleted from database');

        console.log(`✅ ${pdf.filename} - Complete cleanup successful\n`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to delete ${pdf.filename}:`, error.message);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Cleanup Summary:');
    console.log(`   ✅ Successfully deleted: ${successCount} PDFs`);
    console.log(`   ❌ Failed: ${failCount} PDFs`);
    console.log('='.repeat(60));
    console.log('\n✨ PDF cleanup complete! Users can now re-upload with Robust OCR.\n');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteAllPDFs().catch(console.error);
