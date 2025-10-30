import prisma from './src/config/database';

(async () => {
  try {
    console.log('🔍 Searching for all "Koda Business Plan" documents in database...\n');

    const documents = await prisma.document.findMany({
      where: {
        filename: { contains: 'Koda Business Plan' }
      },
      include: {
        metadata: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${documents.length} document(s) matching "Koda Business Plan"\n`);

    for (const doc of documents) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📄 Filename: ${doc.filename}`);
      console.log(`🆔 Document ID: ${doc.id}`);
      console.log(`👤 User ID: ${doc.userId}`);
      console.log(`📊 Status: ${doc.status}`);
      console.log(`📅 Created: ${doc.createdAt.toISOString()}`);
      console.log(`📅 Updated: ${doc.updatedAt.toISOString()}`);
      console.log(`📦 Has metadata: ${!!doc.metadata}`);

      if (doc.metadata) {
        console.log(`   ├─ Has extractedText: ${!!doc.metadata.extractedText}`);
        console.log(`   ├─ Text length: ${doc.metadata.extractedText?.length || 0} chars`);
        console.log(`   ├─ Total chunks: ${doc.metadata.totalChunks || 0}`);
        console.log(`   └─ Has vector embeddings: ${doc.metadata.hasVectorEmbeddings || false}`);

        if (doc.metadata.extractedText) {
          console.log(`\n📖 First 200 chars of extracted text:`);
          console.log(doc.metadata.extractedText.substring(0, 200));
        }
      } else {
        console.log('   └─ ❌ No metadata record found');
      }
      console.log('');
    }

    console.log('\n🎯 COMPARISON WITH PINECONE:');
    console.log('Expected document ID in Pinecone: 85bdd798-466e-47b4-94f1-db6df1f04ead');
    console.log('Document ID from resolveDocumentName(): 73d5ac40...');

    const pineconeDoc = documents.find(d => d.id === '85bdd798-466e-47b4-94f1-db6df1f04ead');
    const resolvedDoc = documents.find(d => d.id.startsWith('73d5ac40'));

    console.log('\n📌 Pinecone Document (85bdd798...):', pineconeDoc ? '✅ EXISTS' : '❌ NOT FOUND');
    if (pineconeDoc) {
      console.log(`   Status: ${pineconeDoc.status}`);
      console.log(`   Has embeddings: ${pineconeDoc.metadata?.hasVectorEmbeddings || false}`);
    }

    console.log('\n📌 Resolved Document (73d5ac40...):', resolvedDoc ? '✅ EXISTS' : '❌ NOT FOUND');
    if (resolvedDoc) {
      console.log(`   Status: ${resolvedDoc.status}`);
      console.log(`   Has embeddings: ${resolvedDoc.metadata?.hasVectorEmbeddings || false}`);
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
