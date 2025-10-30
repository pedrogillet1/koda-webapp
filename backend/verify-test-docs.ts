import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import pineconeService from './src/services/pinecone.service';

const prisma = new PrismaClient();

async function verifyTestDocs() {
  console.log('🔍 VERIFYING 5 TEST DOCUMENTS\n');
  console.log('='.repeat(80));

  const testDocs = [
    'Math Profitability',
    'Baxter',
    'Lone Mountain',
    'Montana',
    'Koda_AI_Behavioral'
  ];

  let allGood = true;

  for (const name of testDocs) {
    console.log(`\n📄 Searching for: ${name}`);

    const doc = await prisma.document.findFirst({
      where: {
        filename: { contains: name },
        status: 'completed'
      },
      include: { metadata: true }
    });

    if (!doc) {
      console.log(`   ❌ NOT FOUND or NOT COMPLETED`);
      allGood = false;
      continue;
    }

    console.log(`   ✅ Found: ${doc.filename}`);
    console.log(`   Status: ${doc.status}`);

    const hasText = doc.metadata?.extractedText && doc.metadata.extractedText.length > 0;
    console.log(`   Text extracted: ${hasText ? '✅ ' + doc.metadata!.extractedText!.length + ' chars' : '❌ NO TEXT'}`);

    if (!hasText) {
      allGood = false;
      continue;
    }

    // Check embeddings
    const embeddings = await prisma.documentEmbedding.count({
      where: { documentId: doc.id }
    });

    console.log(`   Embeddings: ${embeddings > 0 ? '✅ ' + embeddings + ' chunks' : '❌ NO EMBEDDINGS'}`);

    if (embeddings === 0) {
      allGood = false;
    }
  }

  // Check Pinecone
  console.log('\n\n📊 PINECONE STATUS');
  console.log('-'.repeat(80));
  const stats = await pineconeService.getIndexStats();
  console.log(`Available: ${stats.available ? '✅' : '❌'}`);
  console.log(`Total vectors: ${stats.totalVectorCount}`);

  console.log('\n\n' + '='.repeat(80));
  if (allGood) {
    console.log('✅ ALL TEST DOCUMENTS ARE READY!');
    console.log('\nYou can now re-run the 30-question benchmark.');
  } else {
    console.log('❌ SOME DOCUMENTS ARE MISSING OR INCOMPLETE');
    console.log('\nPlease re-upload the missing documents.');
  }

  await prisma.$disconnect();
}

verifyTestDocs();
