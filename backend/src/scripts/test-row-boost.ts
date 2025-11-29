import vectorEmbeddingService from '../services/vectorEmbedding.service';
import prisma from '../config/database';

async function testRowBoost() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';
  const query = 'tell me what is in cell b2 in sheet ex 2 in lista 9 excel';

  console.log(`Testing row boost for query: "${query}"\n`);

  try {
    const results = await vectorEmbeddingService.searchSimilarChunks(
      userId,
      query,
      10,
      0.3
    );

    console.log(`\nFound ${results.length} results:\n`);

    results.forEach((result, idx) => {
      const row = result.document_metadata.row;
      const sheet = result.document_metadata.sheet;
      console.log(`${idx + 1}. Sheet: ${sheet}, Row: ${row}, Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`   ${result.content.substring(0, 100)}...`);
      console.log('');
    });

    // Find row 2 specifically
    const row2 = results.find(r => r.document_metadata.row === 2);
    if (row2) {
      console.log('✅ Row 2 FOUND:');
      console.log(row2.content);
    } else {
      console.log('❌ Row 2 NOT in results');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRowBoost().catch(console.error);
