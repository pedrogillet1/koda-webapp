const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function checkNamespaces() {
  try {
    console.log('\n🔍 CHECKING PINECONE NAMESPACES\n');

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index('koda-gemini');

    // Get detailed index stats
    const stats = await index.describeIndexStats();
    console.log('📊 Full Index Stats:');
    console.log(JSON.stringify(stats, null, 2));
    console.log('\n');

    // Try querying without specifying namespace (should query ALL namespaces)
    const dummyVector = new Array(768).fill(0.01);

    console.log('🔍 Querying WITHOUT namespace specification...');
    const noNamespaceQuery = await index.query({
      vector: dummyVector,
      topK: 5,
      includeMetadata: true
    });
    console.log(`   Found: ${noNamespaceQuery.matches?.length || 0} results\n`);

    if (noNamespaceQuery.matches && noNamespaceQuery.matches.length > 0) {
      console.log('📄 Sample results:');
      noNamespaceQuery.matches.slice(0, 2).forEach((match, idx) => {
        console.log(`\n${idx + 1}. ID: ${match.id}`);
        console.log(`   Score: ${match.score}`);
        console.log(`   Metadata keys: ${Object.keys(match.metadata || {}).join(', ')}`);
        if (match.metadata) {
          console.log(`   Filename: ${match.metadata.filename || match.metadata.fileName || 'N/A'}`);
          console.log(`   DocumentId: ${match.metadata.documentId || 'N/A'}`);
        }
      });
    }

    // Check if there are vectors in specific namespaces from stats
    if (stats.namespaces && Object.keys(stats.namespaces).length > 0) {
      console.log('\n\n📋 Namespaces found in stats:');
      Object.entries(stats.namespaces).forEach(([name, data]) => {
        console.log(`   - "${name}": ${data.recordCount || 0} vectors`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNamespaces();
