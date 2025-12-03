import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

async function test() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || '' });
  const index = pc.index(process.env.PINECONE_INDEX_NAME || 'koda-openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Test query
  const query = 'what are the titles of my documents?';
  const userId = 'ad137f5b-1591-4e51-bcb6-851491604dc9'; // localhost@koda.com CORRECT ID

  console.log('Testing Pinecone query...');
  console.log('Query:', query);
  console.log('User ID:', userId);

  // Generate embedding
  const embResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const embedding = embResponse.data[0].embedding;
  console.log('Embedding generated, length:', embedding.length);

  // Query Pinecone with userId filter
  const results = await index.query({
    vector: embedding,
    topK: 10,
    filter: { userId },
    includeMetadata: true,
  });

  console.log('\n=== RESULTS ===');
  console.log('Match count:', results.matches?.length || 0);

  if (results.matches && results.matches.length > 0) {
    console.log('\nTop 5 matches:');
    results.matches.slice(0, 5).forEach((m, i) => {
      const score = m.score?.toFixed(3) || 'N/A';
      const filename = m.metadata?.filename || 'unknown';
      const content = (m.metadata?.content || m.metadata?.text || '').toString().substring(0, 150);
      console.log(`${i+1}. Score: ${score}`);
      console.log(`   Doc: ${filename}`);
      console.log(`   Content: ${content}...`);
      console.log('');
    });
  } else {
    console.log('\n❌ NO MATCHES FOUND!');
    console.log('This explains why Koda falls back to "I couldn\'t find" messages');
  }
}

test().catch(console.error);
