const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function simulateExcelQuery() {
  try {
    console.log('\n🔍 SIMULATING: "what excel did i upload"\n');

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index('koda-gemini');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Step 1: Generate embedding for the query
    console.log('1️⃣ Generating embedding for query...');
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent('what excel did i upload');
    const queryEmbedding = result.embedding.values;
    console.log('   ✅ Generated\n');

    // Step 2: Search Pinecone (simulating RAG search)
    console.log('2️⃣ Searching Pinecone (topK=8)...');
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 8,
      includeMetadata: true,
      filter: {
        userId: '03ec97ac-1934-4188-8471-524366d87521' // Your user ID from the metadata we saw
      }
    });

    console.log(`   Found ${searchResults.matches?.length || 0} results\n`);

    if (!searchResults.matches || searchResults.matches.length === 0) {
      console.log('❌ No results found!');
      return;
    }

    // Step 3: Analyze what the AI sees
    console.log('3️⃣ Analyzing what context the AI receives:\n');

    const excelMatches = searchResults.matches.filter(m =>
      m.metadata?.mimeType?.includes('sheet')
    );
    const nonExcelMatches = searchResults.matches.filter(m =>
      !m.metadata?.mimeType?.includes('sheet')
    );

    console.log(`   📊 Excel results: ${excelMatches.length}`);
    console.log(`   📄 Non-Excel results: ${nonExcelMatches.length}\n`);

    if (excelMatches.length > 0) {
      console.log('📊 EXCEL CHUNKS RETURNED TO AI:\n');
      excelMatches.forEach((match, idx) => {
        console.log(`${idx + 1}. Similarity: ${match.score?.toFixed(4)}`);
        console.log(`   Filename: ${match.metadata?.filename || 'N/A'}`);
        console.log(`   Sheet: ${match.metadata?.sheet || 'N/A'}`);
        console.log(`   Row: ${match.metadata?.row || 'N/A'}`);
        console.log(`   Content: ${(match.metadata?.content || '').substring(0, 150)}...`);
        console.log('');
      });

      // Group by filename
      const byFilename = {};
      excelMatches.forEach(m => {
        const fn = m.metadata?.filename || 'unknown';
        byFilename[fn] = (byFilename[fn] || 0) + 1;
      });

      console.log('📋 Excel files in results:');
      Object.entries(byFilename).forEach(([fn, count]) => {
        console.log(`   - ${fn}: ${count} chunks`);
      });
    }

    if (nonExcelMatches.length > 0) {
      console.log('\n\n⚠️  NON-EXCEL FILES ALSO IN RESULTS:');
      nonExcelMatches.forEach((match, idx) => {
        console.log(`   ${idx + 1}. ${match.metadata?.filename} (${match.metadata?.mimeType})`);
        console.log(`      Similarity: ${match.score?.toFixed(4)}`);
      });
      console.log('\n   ⚠️  This dilutes the context with non-Excel data!');
    }

    // Step 4: Check if the prompt emphasizes filename
    console.log('\n\n4️⃣ PROBLEM ANALYSIS:\n');

    const hasFilename = excelMatches.every(m => m.metadata?.filename);
    const hasSheet = excelMatches.every(m => m.metadata?.sheet);

    console.log(`   ✅ All chunks have 'filename' field: ${hasFilename ? 'YES' : 'NO'}`);
    console.log(`   ✅ All chunks have 'sheet' field: ${hasSheet ? 'YES' : 'NO'}`);

    if (excelMatches.length < 8) {
      console.log(`   ⚠️  Only ${excelMatches.length}/8 results are Excel - context is polluted!`);
    }

    // Check content format
    const firstContent = excelMatches[0]?.metadata?.content || '';
    if (firstContent.includes("Sheet")) {
      console.log(`   ℹ️  Content starts with sheet name instead of filename`);
      console.log(`      Example: "${firstContent.substring(0, 50)}..."`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

simulateExcelQuery();
