const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocuments() {
  try {
    // Check documents
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        filename: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log('\n=== DOCUMENTS ===');
    console.log(`Total documents found: ${documents.length}`);
    documents.forEach(doc => {
      console.log(`- ${doc.filename} (${doc.status}) - ${doc.id}`);
    });

    // Check document metadata (extracted text)
    const metadata = await prisma.documentMetadata.findMany({
      select: {
        documentId: true,
        extractedText: true,
        wordCount: true
      },
      take: 10
    });

    console.log('\n=== DOCUMENT METADATA ===');
    console.log(`Total metadata records: ${metadata.length}`);
    metadata.forEach(meta => {
      const textPreview = meta.extractedText ? meta.extractedText.substring(0, 100) + '...' : 'NO TEXT';
      console.log(`- Doc ${meta.documentId}: ${meta.wordCount || 0} words - "${textPreview}"`);
    });

    // Check vector embeddings
    const embeddings = await prisma.documentChunk.findMany({
      select: {
        documentId: true,
        chunkIndex: true,
        content: true
      },
      take: 10
    });

    console.log('\n=== VECTOR EMBEDDINGS ===');
    console.log(`Total chunks found: ${embeddings.length}`);
    embeddings.forEach(chunk => {
      const contentPreview = chunk.content.substring(0, 50) + '...';
      console.log(`- Doc ${chunk.documentId}, Chunk ${chunk.chunkIndex}: "${contentPreview}"`);
    });

    // Check if KODA business plan exists
    const kodaDocs = await prisma.document.findMany({
      where: {
        filename: {
          contains: 'koda',
          mode: 'insensitive'
        }
      },
      include: {
        metadata: true
      }
    });

    console.log('\n=== KODA-RELATED DOCUMENTS ===');
    console.log(`Found ${kodaDocs.length} documents with "koda" in filename`);
    kodaDocs.forEach(doc => {
      console.log(`- ${doc.filename} (${doc.status})`);
      if (doc.metadata) {
        console.log(`  ✓ Has metadata with ${doc.metadata.wordCount || 0} words`);
        if (doc.metadata.extractedText) {
          const preview = doc.metadata.extractedText.substring(0, 200);
          console.log(`  Text preview: "${preview}..."`);
        }
      } else {
        console.log(`  ✗ NO METADATA`);
      }
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDocuments();
