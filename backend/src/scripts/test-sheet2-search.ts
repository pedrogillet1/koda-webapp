import vectorEmbeddingService from '../services/vectorEmbedding.service';
import prisma from '../config/database';

async function testSheet2Search() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';
  const query = 'What is in cell B2 on sheet 2 in lista 9';

  console.log(`Testing RAG search for: "${query}"\n`);

  try {
    // Test vector search
    console.log('Testing vector similarity search...');
    const results = await vectorEmbeddingService.searchSimilarChunks(
      userId,
      query,
      10,  // Get top 10 results
      0.3  // Lower similarity threshold
    );

    console.log(`\nFound ${results.length} results:\n`);

    results.forEach((result, idx) => {
      console.log(`${idx + 1}. Document: ${result.document.filename}`);
      console.log(`   Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`   Metadata: ${JSON.stringify(result.metadata)}`);
      console.log(`   Content: ${result.content.substring(0, 150)}...`);
      console.log('');
    });

    // Check for sheet 2 results
    const sheet2Results = results.filter(r =>
      r.content.includes('Sheet 2') ||
      (r.metadata && r.metadata.sheet === 'ex2')
    );

    console.log(`\n${sheet2Results.length > 0 ? '✅' : '❌'} Sheet 2 found in results: ${sheet2Results.length} matches`);

    if (sheet2Results.length > 0) {
      console.log('\nSheet 2 matches:');
      sheet2Results.forEach((result, idx) => {
        console.log(`\n${idx + 1}. ${result.content}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSheet2Search().catch(console.error);
