/**
 * Delete all failed/not processed PDF documents
 *
 * This script finds all PDFs with status 'failed' or 'processing' and deletes them from both database and storage.
 *
 * Usage:
 *   npx tsx scripts/delete-failed-pdfs.ts
 */

import prisma from '../src/config/database';
import supabaseStorageService from '../src/services/supabaseStorage.service';

async function main() {
  console.log('🗑️  Starting deletion of failed/not processed PDFs...\n');

  try {
    // Find all failed or processing PDFs
    const pdfs = await prisma.document.findMany({
      where: {
        mimeType: 'application/pdf',
        status: { in: ['failed', 'processing'] }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${pdfs.length} PDF documents to delete\n`);

    if (pdfs.length === 0) {
      console.log('✅ No PDFs to delete');
      return;
    }

    const results = {
      deleted: 0,
      errors: [] as any[]
    };

    // Delete each PDF
    for (let i = 0; i < pdfs.length; i++) {
      const pdf = pdfs[i];
      console.log(`\n[${i + 1}/${pdfs.length}] Deleting: ${pdf.filename}`);
      console.log(`   Document ID: ${pdf.id}`);
      console.log(`   Status: ${pdf.status}`);

      try {
        // Delete from Supabase storage
        if (pdf.encryptedFilename) {
          console.log('   🗑️  Deleting from storage...');
          await supabaseStorageService.delete(pdf.encryptedFilename);
          console.log('   ✅ Deleted from storage');
        }

        // Delete document embeddings (if any)
        console.log('   🗑️  Deleting embeddings...');
        await prisma.documentEmbedding.deleteMany({
          where: { documentId: pdf.id }
        });

        // Delete document metadata (if any)
        console.log('   🗑️  Deleting metadata...');
        await prisma.documentMetadata.deleteMany({
          where: { documentId: pdf.id }
        });

        // Delete document tags (if any)
        console.log('   🗑️  Deleting tags...');
        await prisma.documentTag.deleteMany({
          where: { documentId: pdf.id }
        });

        // Delete document categories (if any)
        console.log('   🗑️  Deleting categories...');
        await prisma.documentCategory.deleteMany({
          where: { documentId: pdf.id }
        });

        // Delete document summaries (if any)
        console.log('   🗑️  Deleting summaries...');
        await prisma.documentSummary.deleteMany({
          where: { documentId: pdf.id }
        });

        // Delete the document
        console.log('   🗑️  Deleting document record...');
        await prisma.document.delete({
          where: { id: pdf.id }
        });

        console.log(`   ✅ SUCCESS: Deleted ${pdf.filename}`);
        results.deleted++;

      } catch (error: any) {
        console.error(`   ❌ ERROR: ${error.message}`);
        results.errors.push({
          documentId: pdf.id,
          filename: pdf.filename,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total documents: ${pdfs.length}`);
    console.log(`✅ Successfully deleted: ${results.deleted}`);
    console.log(`❌ Failed to delete: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(err => {
        console.log(`   - ${err.filename}: ${err.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
