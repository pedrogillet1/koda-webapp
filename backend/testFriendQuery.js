const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FRIEND_USER_ID = 'd141ee38-1527-419a-a6ea-5b0ceab3af8b';

async function testFriendQuery() {
  try {
    const query = "what is koda's ICP";
    console.log('🔍 Testing query for friend:', query);
    console.log('👤 Friend User ID:', FRIEND_USER_ID);
    console.log('');

    // Step 1: Simulate extractDocumentNames with NEW logic (threshold = 1)
    console.log('📋 STEP 1: Document Name Extraction (NEW LOGIC - threshold = 1)');
    console.log('='.repeat(80));

    const userDocuments = await prisma.document.findMany({
      where: { userId: FRIEND_USER_ID },
      select: { id: true, filename: true }
    });

    console.log(`Found ${userDocuments.length} total documents for friend\n`);

    const queryLower = query.toLowerCase();
    const matchedDocuments = [];

    for (const doc of userDocuments) {
      const filenameLower = doc.filename.toLowerCase();
      const filenameWithoutExt = filenameLower.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');

      const words = filenameWithoutExt.split(/[\s_-]+/).filter(w => w.length > 2);
      let matchCount = 0;

      for (const word of words) {
        if (queryLower.includes(word)) {
          matchCount++;
        }
      }

      // NEW LOGIC: threshold = 1 for all documents
      const threshold = 1;
      if (matchCount >= threshold) {
        matchedDocuments.push(doc);
        console.log(`✅ MATCHED: "${doc.filename}" (${matchCount}/${words.length} words matched)`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log(`📊 RESULT: ${matchedDocuments.length} documents matched`);
    console.log('='.repeat(80));

    if (matchedDocuments.length > 0) {
      console.log('\n📄 Matched Documents:');
      matchedDocuments.forEach((doc, idx) => {
        console.log(`   ${idx + 1}. ${doc.filename}`);
      });
    }

    // Step 2: Check embeddings for matched documents
    console.log('\n');
    console.log('📦 STEP 2: Check Embeddings for Matched Documents');
    console.log('='.repeat(80));

    let totalEmbeddings = 0;
    for (const doc of matchedDocuments) {
      const embCount = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });
      totalEmbeddings += embCount;
      console.log(`   ${doc.filename}: ${embCount} embeddings`);
    }

    console.log('');
    console.log(`📊 Total embeddings available for search: ${totalEmbeddings}`);

    // Step 3: Sample some content from matched documents
    if (matchedDocuments.length > 0) {
      console.log('\n');
      console.log('📝 STEP 3: Sample Content from Matched Documents');
      console.log('='.repeat(80));

      for (const doc of matchedDocuments.slice(0, 3)) {
        const sampleEmbeddings = await prisma.documentEmbedding.findMany({
          where: { documentId: doc.id },
          take: 2,
          select: {
            content: true,
            chunkIndex: true
          }
        });

        if (sampleEmbeddings.length > 0) {
          console.log(`\n📄 ${doc.filename}:`);
          sampleEmbeddings.forEach(emb => {
            const preview = emb.content.substring(0, 150).replace(/\n/g, ' ');
            console.log(`   Chunk ${emb.chunkIndex}: ${preview}...`);
          });
        }
      }
    }

    // Step 4: Conclusion
    console.log('\n');
    console.log('='.repeat(80));
    console.log('✅ FINAL VERDICT');
    console.log('='.repeat(80));

    if (matchedDocuments.length === 0) {
      console.log('❌ ISSUE: No documents matched - query will fail');
      console.log('   The extractDocumentNames() is not finding any documents');
    } else if (totalEmbeddings === 0) {
      console.log('❌ ISSUE: Documents matched but no embeddings found');
      console.log('   The documents are not indexed for search');
    } else {
      console.log('✅ SUCCESS: Documents matched and embeddings available!');
      console.log(`   - ${matchedDocuments.length} documents will be searched`);
      console.log(`   - ${totalEmbeddings} total chunks available for vector search`);
      console.log('   - Normal mode should now work correctly for this query');

      // Check if Business Plan documents are included
      const businessPlanDocs = matchedDocuments.filter(d =>
        d.filename.toLowerCase().includes('business') &&
        d.filename.toLowerCase().includes('plan')
      );

      if (businessPlanDocs.length > 0) {
        console.log('\n🎉 GREAT NEWS:');
        console.log(`   - ${businessPlanDocs.length} Business Plan documents are now included!`);
        console.log('   - These were previously excluded with the old threshold=2 logic');
        console.log('   - ICP information should now be found');
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
  }
}

testFriendQuery();
