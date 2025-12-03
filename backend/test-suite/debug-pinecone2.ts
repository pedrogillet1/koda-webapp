import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

async function test() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || '' });
  const index = pc.index(process.env.PINECONE_INDEX_NAME || 'koda-openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log('Testing Pinecone WITHOUT userId filter...\n');

  // Generate embedding for a generic query
  const query = 'document';
  const embResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const embedding = embResponse.data[0].embedding;

  // Query Pinecone WITHOUT filter to see what's there
  const results = await index.query({
    vector: embedding,
    topK: 10,
    includeMetadata: true,
  });

  console.log('=== RESULTS WITHOUT FILTER ===');
  console.log('Match count:', results.matches?.length || 0);

  if (results.matches && results.matches.length > 0) {
    console.log('\nSample of userIds in the index:');
    const userIds = new Set<string>();
    results.matches.forEach((m) => {
      const userId = m.metadata?.userId || m.metadata?.user_id;
      if (userId) userIds.add(String(userId));
      console.log(`- userId: ${userId}`);
      console.log(`  filename: ${m.metadata?.filename}`);
      console.log(`  documentId: ${m.metadata?.documentId}`);
      console.log('');
    });
    console.log('\nUnique userIds found:', [...userIds]);
  }
}

test().catch(console.error);
