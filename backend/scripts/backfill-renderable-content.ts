import prisma from '../src/config/database';

/**
 * Backfill renderableContent for documents that have metadata.extractedText
 * but missing renderableContent
 */
async function backfillRenderableContent() {
  try {
    console.log('= Starting backfill of renderableContent...\n');

    // Find all documents with metadata that have extractedText
    const documents = await prisma.document.findMany({
      where: {
        status: 'completed',
        renderableContent: null,
      },
      include: {
        metadata: true,
      },
    });

    console.log(`=Ê Found ${documents.length} documents with missing renderableContent\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of documents) {
      try {
        if (doc.metadata?.extractedText) {
          // Update renderableContent with extractedText from metadata
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              renderableContent: doc.metadata.extractedText,
            },
          });

          console.log(` Updated: ${doc.filename} (${doc.metadata.extractedText.length} chars)`);
          updated++;
        } else {
          console.log(`í  Skipped: ${doc.filename} (no extractedText in metadata)`);
          skipped++;
        }
      } catch (error: any) {
        console.error(`L Failed: ${doc.filename} - ${error.message}`);
        failed++;
      }
    }

    console.log('\n=== Backfill Summary ===');
    console.log(` Updated: ${updated} documents`);
    console.log(`í  Skipped: ${skipped} documents`);
    console.log(`L Failed: ${failed} documents`);
    console.log(`=Ê Total processed: ${documents.length} documents`);

  } catch (error) {
    console.error('L Backfill failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillRenderableContent();
