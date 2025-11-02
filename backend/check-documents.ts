import prisma from './src/config/database';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

async function checkDocuments() {
  console.log('🔍 Checking document status and Pinecone...\n');

  try {
    // Check documents in database
    const documents = await prisma.document.findMany({
      where: {
        userId: '03ec97ac-1934-4188-8471-524366d87521'
      },
      select: {
        id: true,
        filename: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📄 Found ${documents.length} documents:\n`);
    documents.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Created: ${doc.createdAt.toISOString()}`);
      console.log('');
    });

    // Check Pinecone
    console.log('\n🔍 Checking Pinecone...\n');
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME || 'koda-gemini';

    if (!apiKey) {
      console.log('❌ PINECONE_API_KEY not found');
      return;
    }

    const pinecone = new Pinecone({ apiKey });
    const index = pinecone.index(indexName);
    const stats = await index.describeIndexStats();

    console.log(`📊 Pinecone Stats:`);
    console.log(`   Index: ${indexName}`);
    console.log(`   Total vectors: ${stats.totalRecordCount}`);
    console.log(`   Dimension: ${stats.dimension}`);

    if (stats.totalRecordCount === 0) {
      console.log('\n❌ PROBLEM CONFIRMED: Pinecone is EMPTY');
      console.log('   This explains why all queries return "couldn\'t find"');
      console.log('\n💡 Solution: Re-process all documents to generate embeddings');
      console.log('   Use the retry endpoint to reprocess each document');
    } else {
      console.log('\n✅ Pinecone has vectors');

      // Check each document
      console.log('\n🔍 Checking vectors for each document...\n');
      for (const doc of documents) {
        const queryResponse = await index.query({
          vector: new Array(768).fill(0),
          topK: 1,
          filter: { documentId: { $eq: doc.id } },
        });

        const hasVectors = queryResponse.matches.length > 0;
        console.log(`${hasVectors ? '✅' : '❌'} ${doc.filename}: ${hasVectors ? 'Has vectors' : 'No vectors'}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDocuments().catch(console.error);
