const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function checkPineconeExcelVectors() {
  try {
    console.log('\n📊 Checking Pinecone for Excel embeddings...\n');

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    const index = pinecone.index('koda-gemini');

    // Query for vectors with Excel-related metadata
    // We'll use a dummy vector and fetch results to see what's in the index
    const dummyVector = new Array(768).fill(0.01); // 768-dimension vector for Gemini

    const queryResponse = await index.namespace('default').query({
      vector: dummyVector,
      topK: 10,
      includeMetadata: true,
      filter: {
        filename: { $exists: true }
      }
    });

    console.log(`Found ${queryResponse.matches?.length || 0} vectors with filename metadata\n`);

    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log('📄 Top vectors by filename:\n');

      const filenameCounts = {};
      queryResponse.matches.forEach(match => {
        const filename = match.metadata?.filename || 'unknown';
        filenameCounts[filename] = (filenameCounts[filename] || 0) + 1;
      });

      Object.entries(filenameCounts).forEach(([filename, count]) => {
        console.log(`  - "${filename}": ${count} vectors`);
      });

      console.log('\n📋 Sample metadata from first 3 vectors:\n');
      queryResponse.matches.slice(0, 3).forEach((match, idx) => {
        console.log(`${idx + 1}. ID: ${match.id}`);
        console.log(`   Filename: ${match.metadata?.filename || 'N/A'}`);
        console.log(`   DocumentId: ${match.metadata?.documentId || 'N/A'}`);
        console.log(`   Sheet: ${match.metadata?.sheet || 'N/A'}`);
        console.log(`   Row: ${match.metadata?.row || 'N/A'}`);
        console.log(`   Content preview: ${(match.metadata?.content || '').substring(0, 100)}...\n`);
      });
    } else {
      console.log('⚠️  No vectors found with filename metadata!');
    }

    // Now specifically search for "Lista_9" files
    console.log('\n🔍 Searching specifically for "Lista_9" files...\n');
    const lista9Response = await index.namespace('default').query({
      vector: dummyVector,
      topK: 5,
      includeMetadata: true,
      filter: {
        filename: { $eq: 'Lista_9 (1) (1) (6).xlsx' }
      }
    });

    if (lista9Response.matches && lista9Response.matches.length > 0) {
      console.log(`✅ Found ${lista9Response.matches.length} vectors for "Lista_9 (1) (1) (6).xlsx"`);
      console.log('\nSample metadata:');
      lista9Response.matches.slice(0, 2).forEach((match, idx) => {
        console.log(`\n${idx + 1}. Sheet: ${match.metadata?.sheet || 'N/A'}`);
        console.log(`   Row: ${match.metadata?.row || 'N/A'}`);
        console.log(`   Content: ${(match.metadata?.content || '').substring(0, 150)}...`);
      });
    } else {
      console.log('❌ No vectors found for "Lista_9 (1) (1) (6).xlsx"');
      console.log('   This confirms embeddings were NOT generated for the new upload!');
    }

  } catch (error) {
    console.error('❌ Error checking Pinecone:', error);
  }
}

checkPineconeExcelVectors();
