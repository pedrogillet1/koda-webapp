import vectorEmbeddingService from '../services/vectorEmbedding.service';
import prisma from '../config/database';

async function testAllSheets() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';

  const queries = [
    'What is in cell B2 on sheet 1?',
    'What is in cell B2 on sheet 2?',
    'What is in cell B2 on sheet 3?',
    'What is in cell B2 on sheet ex1?',
    'What is in cell B2 on sheet ex2?',
    'What is in cell B2 on sheet ex3?',
  ];

  console.log('Testing Excel sheet access across all sheets...\n');

  for (const query of queries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Query: "${query}"`);
    console.log('='.repeat(80));

    try {
      const results = await vectorEmbeddingService.searchSimilarChunks(
        userId,
        query,
        3,  // Get top 3 results
        0.3
      );

      if (results.length === 0) {
        console.log('❌ NO RESULTS FOUND\n');
        continue;
      }

      console.log(`✅ Found ${results.length} results:\n`);

      results.forEach((result, idx) => {
        const sheetInfo = result.document_metadata.sheet ? `Sheet: ${result.document_metadata.sheet}` : 'No sheet metadata';
        const rowInfo = result.document_metadata.row ? `Row: ${result.document_metadata.row}` : '';
        console.log(`${idx + 1}. ${sheetInfo} ${rowInfo}`);
        console.log(`   Similarity: ${result.similarity.toFixed(4)}`);
        console.log(`   Content: ${result.content.substring(0, 100)}...`);
        console.log('');
      });

      // Find the B2 cell specifically
      const b2Result = results.find(r =>
        r.content.includes('B2:') &&
        (r.document_metadata.row === 2 || r.content.includes('Row 2:'))
      );

      if (b2Result) {
        const b2Match = b2Result.content.match(/B2:\s*([^|]+)/);
        const b2Value = b2Match ? b2Match[1].trim() : 'Not found';
        console.log(`   📍 B2 Value: ${b2Value}\n`);
      }

    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
  }

  await prisma.$disconnect();
}

testAllSheets().catch(console.error);
