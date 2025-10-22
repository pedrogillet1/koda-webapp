const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function checkNewEmbeddings() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index('koda-gemini');
  const dummy = new Array(768).fill(0.01);

  // Query for the latest Excel document
  const res = await index.query({
    vector: dummy,
    topK: 5,
    includeMetadata: true,
    filter: { filename: { $eq: 'Lista_9 (1) (1) (1).xlsx' } }
  });

  console.log('\n📄 CHECKING NEW EMBEDDINGS:\n');

  if (res.matches.length === 0) {
    console.log('❌ No embeddings found for Lista_9 (1) (1) (1).xlsx');
    return;
  }

  res.matches.forEach((m, i) => {
    const content = m.metadata.content || '';
    const hasFilename = content.startsWith('📄 File:');
    const preview = content.substring(0, 150);

    console.log(`${i + 1}. Match ID: ${m.id}`);
    console.log(`   Filename in metadata: ${m.metadata.filename}`);
    console.log(`   Has filename prefix in content: ${hasFilename ? '✅ YES' : '❌ NO'}`);
    console.log(`   Content preview: ${preview}...`);
    console.log('');
  });
}

checkNewEmbeddings().catch(console.error);
