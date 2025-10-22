import vectorEmbeddingService from '../services/vectorEmbedding.service';
import prisma from '../config/database';

async function testKodaQuery() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';
  const query = 'tell me what is in cell b2 in sheet ex 2 in lista 9 excel';

  console.log(`Testing KODA query: "${query}"\n`);

  try {
    const results = await vectorEmbeddingService.searchSimilarChunks(
      userId,
      query,
      10,  // Same as RAG service uses
      0.3
    );

    console.log(`\nFound ${results.length} results:\n`);

    results.forEach((result, idx) => {
      console.log(`${idx + 1}. Document: ${result.document.filename}`);
      console.log(`   Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`   Sheet: ${result.metadata.sheet}, Row: ${result.metadata.row}`);
      console.log(`   Content: ${result.content}`);
      console.log('');
    });

    // Find B2 specifically in row 2
    const b2Row2 = results.find(r => r.metadata.row === 2 && r.content.includes('B2:'));
    if (b2Row2) {
      console.log('\n🎯 EXACT B2 match (Row 2):');
      console.log(b2Row2.content);
      const match = b2Row2.content.match(/B2:\s*([^|]+)/);
      if (match) {
        console.log(`\n📍 B2 Value: ${match[1].trim()}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testKodaQuery().catch(console.error);
