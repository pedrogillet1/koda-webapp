import 'dotenv/config';
import prisma from './src/config/database';
import pineconeService from './src/services/pinecone.service';

(async () => {
  try {
    console.log('\n🔍 === VERIFYING EMBEDDINGS FOR COMPLETED DOCUMENTS ===\n');

    // Get all completed documents
    const completedDocs = await prisma.document.findMany({
      where: {
        status: 'completed'
      },
      select: {
        id: true,
        filename: true,
        userId: true,
        status: true,
        createdAt: true,
        metadata: {
          select: {
            extractedText: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${completedDocs.length} completed documents\n`);

    if (completedDocs.length === 0) {
      console.log('⚠️  No completed documents found');
      await prisma.$disconnect();
      return;
    }

    // Check Pinecone availability
    if (!pineconeService.isAvailable()) {
      console.log('❌ Pinecone is not available!');
      await prisma.$disconnect();
      return;
    }

    console.log('Checking embeddings in Pinecone...\n');

    let docsWithEmbeddings = 0;
    let docsWithoutEmbeddings = 0;
    let docsWithoutText = 0;

    const docsNeedingReprocessing: typeof completedDocs = [];

    for (const doc of completedDocs) {
      const hasText = doc.metadata?.extractedText && doc.metadata.extractedText.length > 50;

      if (!hasText) {
        console.log(`⚠️  ${doc.filename}`);
        console.log(`   No extracted text - skipping`);
        docsWithoutText++;
        continue;
      }

      try {
        // Query Pinecone for this document's embeddings
        const results = await pineconeService.queryByMetadata({
          documentId: doc.id
        }, 1);

        if (results && results.length > 0) {
          console.log(`✅ ${doc.filename}`);
          console.log(`   Has embeddings in Pinecone`);
          docsWithEmbeddings++;
        } else {
          console.log(`❌ ${doc.filename}`);
          console.log(`   Missing embeddings (has text: ${doc.metadata.extractedText.length} chars)`);
          docsWithoutEmbeddings++;
          docsNeedingReprocessing.push(doc);
        }
      } catch (error) {
        console.log(`❌ ${doc.filename}`);
        console.log(`   Error checking embeddings: ${error}`);
        docsWithoutEmbeddings++;
        docsNeedingReprocessing.push(doc);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`✅ Documents with embeddings: ${docsWithEmbeddings}`);
    console.log(`❌ Documents without embeddings: ${docsWithoutEmbeddings}`);
    console.log(`⚠️  Documents without text: ${docsWithoutText}`);
    console.log(`📊 Total completed documents: ${completedDocs.length}`);
    console.log(`📊 Completion rate: ${((docsWithEmbeddings / completedDocs.length) * 100).toFixed(1)}%`);

    if (docsNeedingReprocessing.length > 0) {
      console.log('\n⚠️  DOCUMENTS NEEDING REPROCESSING:');
      docsNeedingReprocessing.forEach((doc, idx) => {
        console.log(`${idx + 1}. ${doc.filename} (ID: ${doc.id})`);
      });
      console.log('\nTo reprocess these documents, you can:');
      console.log('1. Delete them and re-upload');
      console.log('2. Or use a script to regenerate embeddings for them');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
