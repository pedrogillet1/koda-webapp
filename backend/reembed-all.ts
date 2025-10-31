import prisma from './src/config/database';
import vectorEmbeddingService from './src/services/vectorEmbedding.service';

async function reembedAll() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';
  
  console.log('\n🔄 Re-embedding all documents...\n');
  
  const docs = await prisma.document.findMany({
    where: { userId, status: 'completed' },
    include: {
      metadata: true,
      chunks: true
    }
  });
  
  console.log(`Found ${docs.length} documents to re-embed\n`);
  
  for (const doc of docs) {
    console.log(`\n📄 Processing: ${doc.filename}`);
    
    if (!doc.chunks || doc.chunks.length === 0) {
      console.log(`   ⚠️  No chunks found - document needs full reprocessing`);
      continue;
    }
    
    console.log(`   📊 Found ${doc.chunks.length} chunks`);
    
    const chunksWithMetadata = doc.chunks.map(chunk => ({
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      metadata: typeof chunk.metadata === 'string' ? JSON.parse(chunk.metadata) : chunk.metadata
    }));
    
    try {
      await vectorEmbeddingService.storeDocumentEmbeddings(doc.id, chunksWithMetadata);
      console.log(`   ✅ Re-embedded successfully`);
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n✅ Re-embedding complete!');
  await prisma.$disconnect();
}

reembedAll();
