import pineconeService from './src/services/pinecone.service';
import prisma from './src/config/database';

async function clean() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';
  
  console.log('\n🧹 Cleaning orphaned Pinecone embeddings...');
  
  // Get all valid document IDs from database
  const validDocs = await prisma.document.findMany({
    where: { userId, status: 'completed' },
    select: { id: true }
  });
  
  const validDocIds = new Set(validDocs.map(d => d.id));
  console.log(`✅ Found ${validDocIds.size} valid documents in database`);
  
  // The Pinecone service needs to expose a method to list all vectors
  // For now, we'll rely on the fact that queries will filter by metadata
  console.log('\n⚠️  Pinecone cleanup requires manual intervention');
  console.log('   The Business Plan embeddings are orphaned in Pinecone');
  console.log('   Solution: Start a NEW conversation to bypass cached context');
  
  await prisma.$disconnect();
}

clean();
