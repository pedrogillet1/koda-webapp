import { PrismaClient } from '@prisma/client';
import supabaseStorageService from '../src/services/supabaseStorage.service';

const prisma = new PrismaClient();

/**
 * Delete cached converted PDF for a specific DOCX document
 * This forces a fresh conversion with the new docx-pdf library
 */
async function deleteCachedPdf() {
  const documentId = 'c48cee5a-8378-43fb-aa1d-7b92dfd81f03';

  try {
    console.log(`🔍 Finding document: ${documentId}`);

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      console.error(`❌ Document not found: ${documentId}`);
      return;
    }

    console.log(`✅ Found document: ${document.filename}`);
    console.log(`   User ID: ${document.userId}`);

    const pdfKey = `${document.userId}/${documentId}-converted.pdf`;
    console.log(`🗑️  Deleting cached PDF: ${pdfKey}`);

    const exists = await supabaseStorageService.exists(pdfKey);

    if (!exists) {
      console.log(`⚠️  PDF not found in storage (may already be deleted)`);
    } else {
      await supabaseStorageService.delete(pdfKey);
      console.log(`✅ Successfully deleted cached PDF`);
      console.log(`   Next preview request will trigger fresh conversion`);
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteCachedPdf()
  .then(() => {
    console.log(`\n✅ Script completed successfully`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Script failed:`, error);
    process.exit(1);
  });
