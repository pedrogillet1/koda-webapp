/**
 * Debug script to test RAG retrieval for Lone Mountain Ranch budget
 */
import { config } from 'dotenv';
config();

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import prisma from './src/config/database';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function debugRagQuery() {
  console.log('🔍 Starting RAG Debug for Lone Mountain Ranch query\n');

  // 1. Check if document exists in database
  console.log('=== Step 1: Check Database ===');
  const docs = await prisma.document.findMany({
    where: {
      filename: { contains: 'Lone Mountain' },
      status: 'completed'
    },
    include: {
      metadata: true
    }
  });

  console.log(`Found ${docs.length} documents matching "Lone Mountain":`);
  docs.forEach(doc => {
    console.log(`  - ${doc.filename} (ID: ${doc.id})`);
    console.log(`    Status: ${doc.status}`);
    console.log(`    User ID: ${doc.userId}`);
    if (doc.metadata) {
      console.log(`    Extracted text length: ${doc.metadata.extractedText?.length || 0} chars`);
      console.log(`    Has markdown: ${!!doc.metadata.markdownContent}`);
    }
  });

  if (docs.length === 0) {
    console.log('❌ No Lone Mountain documents found in database!');
    await prisma.$disconnect();
    return;
  }

  const targetDoc = docs[0];
  const userId = targetDoc.userId;

  // 2. Check Pinecone for chunks
  console.log('\n=== Step 2: Check Pinecone Chunks ===');
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pinecone.index(process.env.PINECONE_INDEX || 'koda-openai');

  // Query for chunks belonging to this document
  const testQuery = "Room Revenue January 2025 budget Lone Mountain Ranch";
  console.log(`Query: "${testQuery}"`);

  // Generate embedding for the query
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: testQuery,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Query Pinecone with user filter
  console.log(`\nQuerying Pinecone with userId filter: ${userId}`);
  const results = await index.query({
    vector: queryEmbedding,
    topK: 20,
    filter: { userId },
    includeMetadata: true,
  });

  console.log(`\nPinecone returned ${results.matches?.length || 0} results:`);

  if (results.matches && results.matches.length > 0) {
    console.log('\nTop 10 results:');
    results.matches.slice(0, 10).forEach((match, i) => {
      const metadata = match.metadata as any;
      console.log(`\n[${i + 1}] Score: ${match.score?.toFixed(4)}`);
      console.log(`    Document: ${metadata?.filename || 'Unknown'}`);
      console.log(`    Doc ID: ${metadata?.documentId || 'N/A'}`);
      const content = metadata?.content || metadata?.text || '';
      console.log(`    Content preview: ${content.substring(0, 200)}...`);
    });

    // Check if any results are from Lone Mountain
    const loneMountainResults = results.matches.filter((m: any) =>
      m.metadata?.filename?.toLowerCase().includes('lone mountain')
    );
    console.log(`\n📊 Results from Lone Mountain docs: ${loneMountainResults.length}/${results.matches.length}`);

    // Check if Room Revenue is in the content
    const roomRevenueResults = results.matches.filter((m: any) => {
      const content = (m.metadata?.content || m.metadata?.text || '').toLowerCase();
      return content.includes('room revenue') || content.includes('room rev');
    });
    console.log(`📊 Results containing "Room Revenue": ${roomRevenueResults.length}/${results.matches.length}`);

  } else {
    console.log('❌ No results from Pinecone!');
  }

  // 3. Check total chunks in Pinecone for this document
  console.log('\n=== Step 3: Check Document Chunks in Pinecone ===');

  // Query specifically for document ID
  const docIdResults = await index.query({
    vector: queryEmbedding,
    topK: 100,
    filter: {
      userId,
      documentId: targetDoc.id
    },
    includeMetadata: true,
  });

  console.log(`Chunks for document ${targetDoc.filename}: ${docIdResults.matches?.length || 0}`);

  if (docIdResults.matches && docIdResults.matches.length > 0) {
    // Look for Room Revenue in the chunks
    let foundRoomRevenue = false;
    docIdResults.matches.forEach((match, i) => {
      const content = ((match.metadata as any)?.content || (match.metadata as any)?.text || '').toLowerCase();
      if (content.includes('room revenue') || content.includes('room rev')) {
        console.log(`\n✅ Found "Room Revenue" in chunk ${i + 1}:`);
        console.log(`   Content: ${content.substring(0, 300)}...`);
        foundRoomRevenue = true;
      }
      if (content.includes('january') && content.includes('2025')) {
        console.log(`\n✅ Found "January 2025" in chunk ${i + 1}:`);
        console.log(`   Content: ${content.substring(0, 300)}...`);
      }
    });

    if (!foundRoomRevenue) {
      console.log('\n❌ "Room Revenue" not found in any chunk from this document!');
      console.log('\nThis suggests the document text extraction may not have captured the spreadsheet data correctly.');
    }
  }

  // 4. Check extracted text content
  console.log('\n=== Step 4: Check Extracted Text ===');
  if (targetDoc.metadata?.extractedText) {
    const text = targetDoc.metadata.extractedText.toLowerCase();
    console.log(`Extracted text length: ${text.length} chars`);

    if (text.includes('room revenue')) {
      console.log('✅ "Room Revenue" found in extracted text');
      const idx = text.indexOf('room revenue');
      console.log(`Context: ...${text.substring(Math.max(0, idx - 50), idx + 200)}...`);
    } else {
      console.log('❌ "Room Revenue" NOT found in extracted text');
      console.log('\n📝 Sample of extracted text (first 1000 chars):');
      console.log(targetDoc.metadata.extractedText.substring(0, 1000));
    }
  } else {
    console.log('❌ No extracted text found for document!');
  }

  await prisma.$disconnect();
  console.log('\n✅ Debug complete');
}

debugRagQuery().catch(console.error);
