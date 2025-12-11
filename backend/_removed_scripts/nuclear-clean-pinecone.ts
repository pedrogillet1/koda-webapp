import pineconeService from './src/services/pinecone.service';
import prisma from './src/config/database';
import vectorEmbeddingService from './src/services/vectorEmbedding.service';

async function nuclearClean() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';
  
  console.log('\n☢️  NUCLEAR OPTION: Deleting ALL user embeddings from Pinecone...\n');
  
  // Get all valid documents
  const docs = await prisma.document.findMany({
    where: { userId, status: 'completed' },
    select: { id: true, filename: true }
  });
  
  console.log(`Found ${docs.length} documents to clean:`);
  docs.forEach(d => console.log(`   - ${d.filename} (${d.id})`));
  
  console.log('\n🗑️  Deleting embeddings for each document...');
  
  for (const doc of docs) {
    try {
      await vectorEmbeddingService.deleteDocumentEmbeddings(doc.id);
      console.log(`✅ Deleted: ${doc.filename}`);
    } catch (error: any) {
      console.log(`⚠️  Skip: ${doc.filename} - ${error.message}`);
    }
  }
  
  console.log('\n✅ Pinecone cleanup complete!');
  console.log('Now you need to re-embed these documents by re-uploading them');
  console.log('OR trigger re-processing through the UI');
  
  await prisma.$disconnect();
}

nuclearClean();
