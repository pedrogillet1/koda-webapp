const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FRIEND_USER_ID = 'd141ee38-1527-419a-a6ea-5b0ceab3af8b';

async function testDocumentExtraction() {
  try {
    const query = "what is koda's ICP";
    console.log('Testing query:', query);
    console.log('');

    // Get all user's documents
    const userDocuments = await prisma.document.findMany({
      where: { userId: FRIEND_USER_ID },
      select: { id: true, filename: true }
    });

    console.log(`User has ${userDocuments.length} documents total\n`);

    // Simulate the extractDocumentNames logic
    const queryLower = query.toLowerCase();
    const matchedDocuments = [];

    for (const doc of userDocuments) {
      const filenameLower = doc.filename.toLowerCase();
      const filenameWithoutExt = filenameLower.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i, '');

      // Check if query contains significant parts of the filename
      const words = filenameWithoutExt.split(/[\s_-]+/).filter(w => w.length > 2);
      let matchCount = 0;

      console.log(`Testing: "${doc.filename}"`);
      console.log(`  Words in filename: [${words.join(', ')}]`);

      for (const word of words) {
        if (queryLower.includes(word)) {
          matchCount++;
          console.log(`    ✅ Matched word: "${word}"`);
        }
      }

      // More lenient matching: just 1 word match is enough for any filename
      // This prevents excluding documents like "Koda Business Plan V12" when query is "what is koda's ICP"
      const threshold = 1;
      console.log(`  Match count: ${matchCount}/${words.length} (threshold: ${threshold})`);

      if (matchCount >= threshold) {
        matchedDocuments.push(doc);
        console.log(`  ✅ DOCUMENT MATCHED!`);
      } else {
        console.log(`  ❌ Not enough matches`);
      }
      console.log('');
    }

    console.log('\n═══════════════════════════════════════');
    console.log('RESULT:');
    console.log('═══════════════════════════════════════');
    console.log(`Matched ${matchedDocuments.length} documents:`);
    matchedDocuments.forEach(doc => {
      console.log(`  - ${doc.filename}`);
    });

    if (matchedDocuments.length > 0) {
      console.log('\n⚠️  ISSUE FOUND:');
      console.log('The query matches specific documents, so the search will');
      console.log('ONLY look in those documents and ignore all others!');
      console.log('\nThis is why normal mode finds 0 results:');
      console.log('1. Query "what is kodas ICP" matches documents with "koda" in name');
      console.log('2. Search is filtered to ONLY those documents');
      console.log('3. But maybe the ICP info is in a different part/section');
      console.log('4. Or the filtering is excluding valid results');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

testDocumentExtraction();
