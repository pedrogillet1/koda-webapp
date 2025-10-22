const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('./dist/config/storage');

/**
 * DELETE CONTAMINATED DOCUMENTS SCRIPT
 *
 * This script safely deletes all contaminated documents from:
 * 1. Database (documents table + metadata)
 * 2. Google Cloud Storage
 *
 * Users will need to re-upload clean versions of these files.
 */

// List of all contaminated document IDs identified in our investigation
const CONTAMINATED_DOCUMENT_IDS = [
  // Group 1: Pix receipt contamination (8 documents)
  '349d2b56-14ad-47f9-b8d0-8fd4d2b1b509', // Koda_Developer_Checklist.pdf (alvaro@camasmie.com.br)
  'fd94ffa2-c49d-40e1-926a-01fac4c1d046', // Koda_Developer_Checklist.pdf (alvaro@camasmie.com.br) - duplicate
  '19585ee0-3344-457a-9d24-14530cb9dafe', // Koda Financial Model.pdf (alvarojcamasmie@gmail.com)
  '7d7370c3-d7c6-4727-8cb7-ab2aabff9b0c', // Receita oftalmo.pdf (valeriagillet66@gmail.com)
  '11f74194-f082-4472-b3d2-2d79d5e1f855', // Avaliacao Pedro.pdf (valeriagillet66@gmail.com)
  '443e14db-b98c-4268-94ff-2bc586c38fbc', // Assinatura GLOBO.pdf (valeriagillet66@gmail.com)
  '39c89222-1d2b-4aad-9e4b-71c9a2618c8e', // Koda Financial Model (500k).pdf (alvarojcamasmie@gmail.com)
  'eefb68a7-6a54-4024-9e82-85f07ed10529', // Koda Business Plan V12 .pdf (alvarojcamasmie@gmail.com)

  // Group 2: Pix receipt contamination (5 documents)
  'b0bbb098-0c41-47cd-add3-84832c916515', // Comprovante1.pdf (123hackerabc@gmail.com)
  '33d9f184-37cc-4236-ae32-f34f54ca6c78', // Prova passada financas 2.pdf (alvarojcamasmie@gmail.com)
  '05e9a2f9-02c3-4655-b823-6ef8d3334a8e', // AnotacÌ§oÌes Aula 2.pdf (alvarojcamasmie@gmail.com)
  '5ef4185c-7d97-4019-b35e-63bb1c47547b', // documentacÌ§aÌo_GB.pdf (alvarojcamasmie@gmail.com)
  '03efd452-6e24-4456-9894-3bacae21cc2c', // GestaÌo de Processos de NegoÌcios Guarda Bens.pdf (alvarojcamasmie@gmail.com)

  // Group 3: Chemistry/Business Plan contamination (2 documents)
  '215e7049-a675-4c4d-8ac5-17498fbd5dfb', // AIR and WATER independent research F3 version.pdf (alvarojcamasmie@gmail.com)
  'f64ae6f9-fc30-4384-a1e2-fde1676e9a68', // Koda Business Plan V12 (1).pdf (123hackerabc@gmail.com)

  // Group 4: Catalog contamination (2 documents)
  'd7a899fa-ade9-4c28-8645-4bd4ed6884c8', // _Catalogo Casa Olência .pdf (alvarojcamasmie@gmail.com)
  'c5d72522-2f99-4722-b407-fb37312f729f', // _Catalogo Casa Olência .pdf (mvcamasmie@gmail.com)
];

async function deleteContaminatedDocuments() {
  console.log('🗑️  DELETING CONTAMINATED DOCUMENTS');
  console.log('='.repeat(80));
  console.log('');
  console.log(`⚠️  WARNING: This will permanently delete ${CONTAMINATED_DOCUMENT_IDS.length} documents`);
  console.log('⚠️  from both the database and Google Cloud Storage.\n');

  try {
    // Step 1: Fetch document details
    console.log('📋 Step 1: Fetching document details...\n');

    const documents = await prisma.document.findMany({
      where: {
        id: {
          in: CONTAMINATED_DOCUMENT_IDS
        }
      },
      include: {
        user: {
          select: {
            email: true
          }
        },
        metadata: true
      }
    });

    console.log(`   Found ${documents.length} contaminated documents in database\n`);

    if (documents.length === 0) {
      console.log('✅ No contaminated documents found. Database is already clean.\n');
      return;
    }

    // Display what will be deleted
    console.log('📄 Documents to be deleted:\n');
    documents.forEach((doc, i) => {
      console.log(`   ${i + 1}. ${doc.filename}`);
      console.log(`      User: ${doc.user.email}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
      console.log(`      GCS: ${doc.encryptedFilename || 'N/A'}`);
      console.log('');
    });

    // Step 2: Delete from database
    console.log('🗑️  Step 2: Deleting from database...\n');

    let deletedMetadata = 0;
    let deletedDocuments = 0;
    const failedDeletions = [];

    for (const doc of documents) {
      try {
        console.log(`   Deleting: ${doc.filename} (${doc.user.email})`);

        await prisma.$transaction(async (tx) => {
          // Delete metadata first (if exists)
          if (doc.metadata) {
            await tx.documentMetadata.delete({
              where: { documentId: doc.id }
            });
            deletedMetadata++;
            console.log(`      ✅ Deleted metadata`);
          }

          // Delete document tags
          await tx.documentTag.deleteMany({
            where: { documentId: doc.id }
          });

          // Delete document
          await tx.document.delete({
            where: { id: doc.id }
          });
          deletedDocuments++;
          console.log(`      ✅ Deleted document record`);
        });

        console.log('');
      } catch (error) {
        console.error(`      ❌ Database deletion failed: ${error.message}`);
        failedDeletions.push({ doc, reason: error.message, stage: 'database' });
        console.log('');
      }
    }

    console.log(`   Database deletions: ${deletedDocuments}/${documents.length} documents\n`);

    // Step 3: Delete from GCS
    console.log('☁️  Step 3: Deleting from Google Cloud Storage...\n');

    let deletedFromGCS = 0;
    const gcsFailures = [];

    for (const doc of documents) {
      if (!doc.encryptedFilename) {
        console.log(`   ⊘ ${doc.filename}: No GCS file (skipping)`);
        continue;
      }

      try {
        console.log(`   Deleting GCS file: ${doc.encryptedFilename}`);
        await deleteFile(doc.encryptedFilename);
        deletedFromGCS++;
        console.log(`      ✅ Deleted from GCS\n`);
      } catch (error) {
        console.error(`      ⚠️  GCS deletion failed: ${error.message}`);
        gcsFailures.push({ doc, reason: error.message });
        console.log('');
      }
    }

    console.log(`   GCS deletions: ${deletedFromGCS}/${documents.filter(d => d.encryptedFilename).length} files\n`);

    // Step 4: Summary
    console.log('='.repeat(80));
    console.log('📊 DELETION SUMMARY\n');
    console.log(`   Documents found: ${documents.length}`);
    console.log(`   Database records deleted: ${deletedDocuments}`);
    console.log(`   Metadata records deleted: ${deletedMetadata}`);
    console.log(`   GCS files deleted: ${deletedFromGCS}`);
    console.log(`   Failed deletions: ${failedDeletions.length + gcsFailures.length}\n`);

    if (failedDeletions.length > 0) {
      console.log('❌ Database Deletion Failures:\n');
      failedDeletions.forEach(({ doc, reason }) => {
        console.log(`   - ${doc.filename} (${doc.user.email})`);
        console.log(`     Reason: ${reason}\n`);
      });
    }

    if (gcsFailures.length > 0) {
      console.log('⚠️  GCS Deletion Failures:\n');
      gcsFailures.forEach(({ doc, reason }) => {
        console.log(`   - ${doc.filename} (${doc.user.email})`);
        console.log(`     GCS Path: ${doc.encryptedFilename}`);
        console.log(`     Reason: ${reason}\n`);
      });
    }

    // Step 5: Verify cleanup
    console.log('🔍 Step 5: Verifying cleanup...\n');

    const remainingDocs = await prisma.document.findMany({
      where: {
        id: {
          in: CONTAMINATED_DOCUMENT_IDS
        }
      }
    });

    if (remainingDocs.length === 0) {
      console.log('   ✅ ALL CONTAMINATED DOCUMENTS DELETED FROM DATABASE\n');
    } else {
      console.log(`   ⚠️  ${remainingDocs.length} documents still in database:\n`);
      remainingDocs.forEach(doc => {
        console.log(`      - ${doc.filename} (ID: ${doc.id})`);
      });
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('\n✅ DELETION COMPLETE\n');
    console.log('📝 Next Steps:');
    console.log('   1. Users should re-upload clean versions of their documents');
    console.log('   2. With concurrency: 1, new uploads will process correctly');
    console.log('   3. Monitor logs for any [DOC:xxxxx] entries during new uploads\n');

  } catch (error) {
    console.error('\n❌ Fatal error during deletion:', error);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run deletion
console.log('\n⏰ Starting in 3 seconds... (Ctrl+C to cancel)\n');

setTimeout(() => {
  deleteContaminatedDocuments()
    .then(() => {
      console.log('Script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}, 3000);
