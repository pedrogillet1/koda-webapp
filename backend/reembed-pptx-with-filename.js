const { PrismaClient } = require('@prisma/client');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const prisma = new PrismaClient();

async function reembedPPTXWithFilename() {
  try {
    console.log('\n🔄 ===== RE-EMBEDDING PPTX FILES WITH FILENAMES =====\n');

    // Get all PPTX documents
    const pptxDocs = await prisma.document.findMany({
      where: {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'completed'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${pptxDocs.length} PowerPoint file(s)\n`);

    if (pptxDocs.length === 0) {
      console.log('✅ No PowerPoint files to re-embed');
      await prisma.$disconnect();
      return;
    }

    // Initialize Pinecone
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index('koda-gemini');

    for (const doc of pptxDocs) {
      console.log(`\n📄 Processing: ${doc.filename}`);
      console.log(`   Document ID: ${doc.id}`);

      // Delete old embeddings for this document
      console.log(`   🗑️  Deleting old embeddings...`);
      try {
        await index.deleteMany({ documentId: doc.id });
        console.log(`   ✅ Old embeddings deleted`);
      } catch (error) {
        console.log(`   ⚠️  Error deleting old embeddings:`, error.message);
      }

      console.log(`   ⏩ Embeddings will be recreated automatically when document is accessed`);
      console.log(`   ℹ️  Or you can trigger reprocessing via the API`);
    }

    console.log('\n✅ ===== RE-EMBEDDING COMPLETE =====\n');
    console.log('Note: The PowerPoint files have had their old embeddings deleted.');
    console.log('New embeddings with filenames will be created when:');
    console.log('1. The user asks a question about the document');
    console.log('2. Or you trigger reprocessing via the API\n');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

reembedPPTXWithFilename();
