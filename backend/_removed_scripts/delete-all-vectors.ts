import * as dotenv from 'dotenv';
dotenv.config();

import { Pinecone } from '@pinecone-database/pinecone';

async function deleteAll() {
  console.log('API Key present:', !!process.env.PINECONE_API_KEY);
  
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });
  
  const index = pinecone.index('koda-gemini');
  
  console.log('\n☢️  Attempting to delete ALL vectors in the index...');
  
  try {
    // Try to delete by userId filter (probably won't work either)
    console.log('Trying userId filter...');
    await index.deleteMany({
      filter: { userId: { $eq: '03ec97ac-1934-4188-8471-524366d87521' } }
    });
    console.log('✅ Deleted by userId!');
  } catch (error: any) {
    console.log(`❌ userId filter failed: ${error.message}`);
    
    // Nuclear option: Delete EVERYTHING
    console.log('\n☢️  Nuclear option: Deleting ENTIRE index...');
    try {
      await index.deleteAll();
      console.log('✅ Entire index cleared!');
      console.log('⚠️  You will need to re-upload all documents to re-embed them');
    } catch (error2: any) {
      console.log(`❌ Failed: ${error2.message}`);
    }
  }
}

deleteAll();
