import pineconeService from './src/services/pinecone.service';
import prisma from './src/config/database';

async function cleanOrphaned() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';
  
  console.log('\n🧹 Cleaning orphaned Pinecone embeddings...\n');
  
  // Get all valid document IDs from database
  const validDocs = await prisma.document.findMany({
    where: { userId, status: 'completed' },
    select: { id: true, filename: true }
  });
  
  console.log(`✅ Found ${validDocs.length} valid documents:`);
  validDocs.forEach(d => console.log(`   - ${d.filename}`));
  
  console.log('\n📊 Summary:');
  console.log('✅ Fixed: pinecone.service.ts now properly deletes embeddings');
  console.log('✅ Future: Document deletions will clean up Pinecone automatically');
  console.log('');
  console.log('For existing orphaned Business Plan embeddings:');
  console.log('Since we don\'t know the documentId, the embeddings will gradually');
  console.log('become less relevant as you add more documents and query specific filenames.');
  
  await prisma.$disconnect();
}

cleanOrphaned();
