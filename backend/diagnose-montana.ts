/**
 * Diagnostic script to check Montana Rocking CC document status
 */

import prisma from './src/config/database';
import { Pinecone } from '@pinecone-database/pinecone';

async function diagnose() {
  console.log('🔍 Diagnosing Montana Rocking CC document...\n');

  // 1. Check if document exists in PostgreSQL
  console.log('📊 STEP 1: Checking PostgreSQL...');
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { filename: { contains: 'montana', mode: 'insensitive' } },
        { filename: { contains: 'rocking', mode: 'insensitive' } },
      ]
    },
    include: {
      metadata: {
        select: {
          extractedText: true,
          pageCount: true,
          ocrConfidence: true,
          wordCount: true,
        }
      }
    }
  });

  if (documents.length === 0) {
    console.log('❌ No documents found with "montana" or "rocking" in filename');
    return;
  }

  console.log(`✅ Found ${documents.length} document(s):\n`);

  for (const doc of documents) {
    console.log(`📄 ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Status: ${doc.status}`);
    console.log(`   Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   Created: ${doc.createdAt}`);
    console.log(`   Updated: ${doc.updatedAt}`);

    if (doc.metadata) {
      console.log(`   Metadata:`);
      console.log(`     - Page Count: ${doc.metadata.pageCount || 'N/A'}`);
      console.log(`     - Word Count: ${doc.metadata.wordCount || 'N/A'}`);
      console.log(`     - OCR Confidence: ${doc.metadata.ocrConfidence || 'N/A'}`);
      console.log(`     - Text Length: ${doc.metadata.extractedText?.length || 0} chars`);

      // Show first 200 chars of extracted text
      if (doc.metadata.extractedText) {
        console.log(`     - Text Preview: "${doc.metadata.extractedText.substring(0, 200)}..."`);
      } else {
        console.log(`     - ⚠️  NO EXTRACTED TEXT!`);
      }
    } else {
      console.log(`   ⚠️  NO METADATA!`);
    }
    console.log('');
  }

  // 2. Check Pinecone for embeddings
  console.log('\n📊 STEP 2: Checking Pinecone embeddings...');

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
  });

  const index = pinecone.index('koda-gemini');

  for (const doc of documents) {
    console.log(`\n🔍 Checking Pinecone for document: ${doc.filename}`);

    try {
      // Query Pinecone with document ID filter
      const queryResponse = await index.query({
        vector: new Array(768).fill(0), // Dummy vector just to filter
        topK: 100,
        filter: {
          documentId: { $eq: doc.id }
        },
        includeMetadata: true,
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        console.log(`   ✅ Found ${queryResponse.matches.length} chunks in Pinecone`);

        // Show sample chunks
        console.log(`   Sample chunks:`);
        queryResponse.matches.slice(0, 3).forEach((match, idx) => {
          console.log(`     ${idx + 1}. Score: ${match.score?.toFixed(4) || 'N/A'}`);
          console.log(`        Content: "${(match.metadata?.content as string)?.substring(0, 100) || 'N/A'}..."`);
        });
      } else {
        console.log(`   ❌ NO CHUNKS FOUND IN PINECONE!`);
        console.log(`   This means the document was not vectorized/embedded.`);
      }
    } catch (error) {
      console.error(`   ❌ Pinecone query error:`, error);
    }
  }

  // 3. Test a semantic search
  console.log('\n📊 STEP 3: Testing semantic search for "Montana Rocking CC"...');

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  try {
    const result = await embeddingModel.embedContent('Montana Rocking CC sanctuary ranch');
    const embedding = result.embedding.values;

    console.log(`   Generated embedding (${embedding.length} dimensions)`);

    const searchResult = await index.query({
      vector: embedding,
      topK: 10,
      includeMetadata: true,
    });

    console.log(`\n   Top 10 results for "Montana Rocking CC":`);
    searchResult.matches?.forEach((match, idx) => {
      console.log(`   ${idx + 1}. ${match.metadata?.filename || 'Unknown'}`);
      console.log(`      Score: ${match.score?.toFixed(4) || 'N/A'}`);
      console.log(`      Content: "${(match.metadata?.content as string)?.substring(0, 100) || 'N/A'}..."`);
    });
  } catch (error) {
    console.error(`   ❌ Search error:`, error);
  }

  await prisma.$disconnect();
}

diagnose().catch(console.error);
