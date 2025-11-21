import { PrismaClient } from '@prisma/client';
import supabaseStorageService from '../src/services/supabaseStorage.service';

const prisma = new PrismaClient();

/**
 * Delete cached converted PDF for Koda blueprint document
 * This forces a fresh conversion with the new Mammoth + Puppeteer converter
 */
async function deleteCachedPdf() {
  const documentId = '9736b5b6-8f8e-4b07-9b5e-654e6d0dab21';

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
      console.log(`   Next preview request will trigger fresh conversion with Puppeteer`);
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
