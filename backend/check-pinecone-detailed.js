const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function checkPineconeDetailed() {
  try {
    console.log('\n🔍 DETAILED PINECONE CHECK\n');

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index('koda-gemini');

    // Get index stats
    const stats = await index.describeIndexStats();
    console.log('📊 Index Stats:');
    console.log(`   Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`   Namespaces: ${Object.keys(stats.namespaces || {}).join(', ') || 'none'}\n`);

    if (stats.totalRecordCount === 0) {
      console.log('❌ PINECONE IS COMPLETELY EMPTY!');
      console.log('   This means NO files (PDF, Word, Excel, etc.) have embeddings.');
      console.log('   Redis is preventing ALL background jobs from running.\n');
      return;
    }

    // Try to query for any vectors
    const dummyVector = new Array(768).fill(0.01);
    const queryResponse = await index.namespace('default').query({
      vector: dummyVector,
      topK: 20,
      includeMetadata: true
    });

    console.log(`📄 Found ${queryResponse.matches?.length || 0} vectors in 'default' namespace\n`);

    if (queryResponse.matches && queryResponse.matches.length > 0) {
      // Group by filename
      const fileStats = {};
      queryResponse.matches.forEach(match => {
        const filename = match.metadata?.filename || match.metadata?.fileName || 'unknown';
        if (!fileStats[filename]) {
          fileStats[filename] = { count: 0, hasFilename: !!match.metadata?.filename };
        }
        fileStats[filename].count++;
      });

      console.log('📋 Files in Pinecone:\n');
      Object.entries(fileStats).forEach(([filename, stats]) => {
        console.log(`   ${filename}`);
        console.log(`      Chunks: ${stats.count}`);
        console.log(`      Has 'filename' field: ${stats.hasFilename ? '✅' : '❌'}\n`);
      });

      console.log('\n🔬 Sample metadata from first vector:');
      const firstMatch = queryResponse.matches[0];
      console.log(JSON.stringify(firstMatch.metadata, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPineconeDetailed();
