const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function findExcelVectors() {
  try {
    console.log('\n🔍 SEARCHING FOR EXCEL VECTORS\n');

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index('koda-gemini');
    const dummyVector = new Array(768).fill(0.01);

    // Query for Excel files (using mimeType filter)
    console.log('📊 Querying for Excel files (mimeType contains "sheet")...');
    const excelQuery = await index.query({
      vector: dummyVector,
      topK: 20,
      includeMetadata: true,
      filter: {
        mimeType: { $eq: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      }
    });

    console.log(`   Found: ${excelQuery.matches?.length || 0} Excel vectors\n`);

    if (excelQuery.matches && excelQuery.matches.length > 0) {
      const fileGroups = {};
      excelQuery.matches.forEach(match => {
        const filename = match.metadata?.filename || 'unknown';
        if (!fileGroups[filename]) {
          fileGroups[filename] = {
            count: 0,
            documentIds: new Set(),
            sample: match
          };
        }
        fileGroups[filename].count++;
        fileGroups[filename].documentIds.add(match.metadata?.documentId);
      });

      console.log('📄 Excel files in Pinecone:\n');
      Object.entries(fileGroups).forEach(([filename, data]) => {
        console.log(`   ${filename}`);
        console.log(`      - ${data.count} chunks`);
        console.log(`      - Document IDs: ${Array.from(data.documentIds).join(', ')}`);
        console.log(`      - Has sheet metadata: ${data.sample.metadata?.sheet ? '✅' : '❌'}`);
        console.log(`      - Has row metadata: ${data.sample.metadata?.row ? '✅' : '❌'}\n`);
      });

      console.log('\n🔬 Sample Excel chunk metadata:');
      console.log(JSON.stringify(excelQuery.matches[0].metadata, null, 2));

    } else {
      console.log('❌ NO EXCEL FILES FOUND IN PINECONE');
      console.log('\n🔍 Let me check if there are ANY vectors with sheet-related metadata...\n');

      // Try broader search
      const broadQuery = await index.query({
        vector: dummyVector,
        topK: 100,
        includeMetadata: true
      });

      const withSheetMeta = broadQuery.matches?.filter(m =>
        m.metadata?.sheet || m.metadata?.sheetName || m.metadata?.row
      );

      console.log(`   Found ${withSheetMeta?.length || 0} vectors with sheet metadata out of ${broadQuery.matches?.length || 0} total\n`);

      if (withSheetMeta && withSheetMeta.length > 0) {
        console.log('   Sample file with sheet metadata:');
        console.log(`      Filename: ${withSheetMeta[0].metadata?.filename}`);
        console.log(`      Sheet: ${withSheetMeta[0].metadata?.sheet || withSheetMeta[0].metadata?.sheetName}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findExcelVectors();
