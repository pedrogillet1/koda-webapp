const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function verifyNewEmbeddings() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index('koda-gemini');
  const dummy = new Array(768).fill(0.01);

  const res = await index.query({
    vector: dummy,
    topK: 3,
    includeMetadata: true,
    filter: { documentId: { $eq: 'cc938a00-2e93-40fe-bdd4-408b1ad494a7' } }
  });

  console.log('\n📄 NEW EMBEDDINGS CHECK:\n');
  res.matches.forEach((m, i) => {
    const content = m.metadata.content || '';
    console.log(`${i+1}. Content: ${content.substring(0, 120)}...`);
    console.log(`   Has filename prefix: ${content.startsWith('📄 File:') ? '✅ YES' : '❌ NO'}\n`);
  });
}

verifyNewEmbeddings();
