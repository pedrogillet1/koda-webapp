/**
 * Quick Pinecone Diagnostic
 *
 * Fast check to see if Pinecone has embeddings and if they're retrievable
 *
 * Usage: npx ts-node quick-pinecone-check.ts
 */

import { Pinecone } from '@pinecone-database/pinecone';
import embeddingService from './src/services/embedding.service';
import dotenv from 'dotenv';

dotenv.config();

async function quickCheck() {
  console.log('🔍 Quick Pinecone Diagnostic\n');

  try {
    // 1. Connection test
    console.log('1️⃣  Testing connection...');
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME || 'koda-gemini';

    if (!apiKey) {
      console.log('❌ PINECONE_API_KEY not found');
      return;
    }

    const pinecone = new Pinecone({ apiKey });
    const index = pinecone.index(indexName);
    console.log('✅ Connected to:', indexName);

    // 2. Check vector count
    console.log('\n2️⃣  Checking vector count...');
    const stats = await index.describeIndexStats();
    console.log(`   Total vectors: ${stats.totalRecordCount}`);
    console.log(`   Dimension: ${stats.dimension}`);

    if (stats.totalRecordCount === 0) {
      console.log('\n❌ PROBLEM: Pinecone is EMPTY');
      console.log('   → No embeddings stored');
      console.log('   → All queries will fail');
      console.log('\n💡 Solution: Run reprocessing script');
      return;
    }

    console.log('✅ Pinecone has vectors');

    // 3. Test query
    console.log('\n3️⃣  Testing query retrieval...');
    const query = 'What is KODA?';
    console.log(`   Query: "${query}"`);

    const embeddingResult = await embeddingService.generateBatchEmbeddings([query], {
      taskType: 'RETRIEVAL_QUERY'
    });
    const queryEmbedding = embeddingResult.embeddings[0].embedding;

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    const resultCount = queryResponse.matches.length;
    const topScore = queryResponse.matches[0]?.score || 0;

    console.log(`   Results found: ${resultCount}`);
    console.log(`   Top score: ${(topScore * 100).toFixed(1)}%`);

    if (resultCount === 0) {
      console.log('\n❌ PROBLEM: Query returned no results');
      console.log('   → Embeddings exist but not retrievable');
      console.log('\n💡 Possible causes:');
      console.log('   - Wrong index name');
      console.log('   - User filtering issue');
      console.log('   - Embedding model mismatch');
      return;
    }

    if (topScore < 0.3) {
      console.log('\n⚠️  WARNING: Low similarity scores');
      console.log('   → Results found but not relevant');
      console.log('\n💡 Possible causes:');
      console.log('   - Different embedding models');
      console.log('   - Poor text extraction');
      return;
    }

    // 4. Show top results
    console.log('\n4️⃣  Top results:');
    queryResponse.matches.slice(0, 3).forEach((match, i) => {
      const filename = match.metadata?.filename || 'unknown';
      const content = (match.metadata?.content as string)?.substring(0, 80) || '';
      const score = ((match.score || 0) * 100).toFixed(1);

      console.log(`\n   ${i + 1}. ${filename} (${score}%)`);
      console.log(`      "${content}..."`);
    });

    console.log('\n✅ ALL CHECKS PASSED');
    console.log('   Pinecone embeddings are working correctly');

  } catch (error: any) {
    console.log(`\n❌ ERROR: ${error.message}`);
    console.log('\n💡 Check:');
    console.log('   - PINECONE_API_KEY in .env');
    console.log('   - PINECONE_INDEX_NAME in .env');
    console.log('   - Pinecone index exists');
  }
}

quickCheck()
  .catch(console.error)
  .finally(() => process.exit());
