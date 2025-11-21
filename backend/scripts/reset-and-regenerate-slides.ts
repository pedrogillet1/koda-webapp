import prisma from '../src/config/database';
import { regeneratePPTXSlides } from '../src/services/document.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function resetAndRegenerateSlides() {
  try {
    console.log('\n🔄 Resetting and regenerating PowerPoint slides...\n');

    // Get PowerPoint documents
    const docs = await prisma.document.findMany({
      where: {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      },
      include: {
        metadata: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`Found ${docs.length} PowerPoint documents\n`);

    for (const doc of docs) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   User ID: ${doc.userId}`);

      try {
        // Step 1: Reset slideGenerationStatus to 'pending' to force regeneration
        console.log(`\n   🔄 Resetting slide generation status...`);

        await prisma.documentMetadata.update({
          where: {
            documentId: doc.id
          },
          data: {
            slideGenerationStatus: 'pending',
            slideGenerationError: null
          }
        });

        console.log(`   ✅ Status reset to pending`);

        // Step 2: Regenerate slides
        console.log(`\n   🎨 Regenerating slides...`);

        await regeneratePPTXSlides(doc.id, doc.userId);

        console.log(`   ✅ Slides regenerated successfully!`);

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
      }

      // Wait 3 seconds between documents
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n${'='.repeat(80)}\n`);
    console.log('✅ Done!\n');

  } catch (error) {
    console.error('\n❌ Script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAndRegenerateSlides();
