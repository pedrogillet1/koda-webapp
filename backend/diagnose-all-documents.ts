/**
 * Comprehensive diagnostic for ALL documents
 * Checks processing status, embeddings, and OCR quality
 */

import prisma from './src/config/database';
import { Pinecone } from '@pinecone-database/pinecone';

async function diagnoseAllDocuments() {
  console.log('🔍 COMPREHENSIVE DOCUMENT DIAGNOSTIC\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Get ALL documents with their metadata
  console.log('📊 STEP 1: Checking all documents in database...\n');

  const allDocuments = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      metadata: {
        select: {
          extractedText: true,
          pageCount: true,
          slideCount: true,
          ocrConfidence: true,
          wordCount: true,
        }
      }
    }
  });

  console.log(`Total documents: ${allDocuments.length}\n`);

  // Group by status
  const statusGroups = allDocuments.reduce((acc, doc) => {
    acc[doc.status] = (acc[doc.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Documents by status:');
  Object.entries(statusGroups).forEach(([status, count]) => {
    const icon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳';
    console.log(`  ${icon} ${status}: ${count}`);
  });
  console.log('');

  // 2. Check Pinecone connection
  console.log('📊 STEP 2: Checking Pinecone index...\n');

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
  });

  const index = pinecone.index('koda-gemini');

  try {
    const stats = await index.describeIndexStats();
    console.log(`✅ Pinecone index stats:`);
    console.log(`   Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`   Dimension: ${stats.dimension || 0}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to get Pinecone stats:', error);
  }

  // 3. Analyze COMPLETED documents
  console.log('📊 STEP 3: Analyzing completed documents...\n');

  const completedDocs = allDocuments.filter(d => d.status === 'completed');

  let docsWithNoText = 0;
  let docsWithText = 0;
  let docsWithNoEmbeddings = 0;
  let docsWithEmbeddings = 0;
  let totalTextLength = 0;

  console.log(`Checking ${completedDocs.length} completed documents...\n`);

  for (const doc of completedDocs) {
    const hasText = doc.metadata && doc.metadata.extractedText && doc.metadata.extractedText.length > 0;
    const textLength = doc.metadata?.extractedText?.length || 0;

    if (hasText) {
      docsWithText++;
      totalTextLength += textLength;
    } else {
      docsWithNoText++;
      console.log(`⚠️  ${doc.filename} - NO EXTRACTED TEXT`);
    }

    // Check if document has embeddings in Pinecone
    try {
      const queryResponse = await index.query({
        vector: new Array(768).fill(0),
        topK: 1,
        filter: { documentId: { $eq: doc.id } },
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        docsWithEmbeddings++;
      } else {
        docsWithNoEmbeddings++;
        console.log(`❌ ${doc.filename} - NO EMBEDDINGS IN PINECONE (status: ${doc.status})`);
      }
    } catch (error) {
      console.error(`❌ Error checking Pinecone for ${doc.filename}:`, error);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📄 TEXT EXTRACTION:');
  console.log(`   ✅ Documents with text: ${docsWithText}`);
  console.log(`   ❌ Documents without text: ${docsWithNoText}`);
  console.log(`   📊 Average text length: ${Math.round(totalTextLength / docsWithText)} chars`);
  console.log('');

  console.log('🔢 EMBEDDINGS:');
  console.log(`   ✅ Documents with embeddings: ${docsWithEmbeddings}`);
  console.log(`   ❌ Documents without embeddings: ${docsWithNoEmbeddings}`);
  console.log('');

  console.log('⚠️  PROBLEMS FOUND:');
  if (docsWithNoText > 0) {
    console.log(`   - ${docsWithNoText} completed documents have NO extracted text`);
    console.log(`     This means OCR/text extraction failed for these files`);
  }
  if (docsWithNoEmbeddings > 0) {
    console.log(`   - ${docsWithNoEmbeddings} completed documents have NO embeddings`);
    console.log(`     This means they cannot be searched via semantic search`);
  }
  if (statusGroups['failed'] > 0) {
    console.log(`   - ${statusGroups['failed']} documents failed processing`);
  }
  if (statusGroups['pending'] > 0) {
    console.log(`   - ${statusGroups['pending']} documents are stuck in pending state`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════\n');

  // 4. List problematic documents
  console.log('📊 STEP 4: Listing problematic documents...\n');

  const problematicDocs = allDocuments.filter(doc =>
    doc.status === 'failed' ||
    doc.status === 'pending' ||
    (doc.status === 'completed' && (!doc.metadata || !doc.metadata.extractedText))
  );

  if (problematicDocs.length > 0) {
    console.log(`Found ${problematicDocs.length} problematic documents:\n`);

    for (const doc of problematicDocs.slice(0, 20)) {
      console.log(`${doc.status === 'failed' ? '❌' : '⚠️'} ${doc.filename}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
      console.log(`   Type: ${doc.mimeType}`);
      console.log(`   Created: ${doc.createdAt.toISOString()}`);
      console.log(`   Updated: ${doc.updatedAt.toISOString()}`);

      if (doc.metadata) {
        console.log(`   Has metadata: YES`);
        console.log(`   Text length: ${doc.metadata.extractedText?.length || 0} chars`);
        console.log(`   Page count: ${doc.metadata.pageCount || 'N/A'}`);
        console.log(`   Slide count: ${doc.metadata.slideCount || 'N/A'}`);
        console.log(`   OCR confidence: ${doc.metadata.ocrConfidence || 'N/A'}`);
      } else {
        console.log(`   Has metadata: NO`);
      }
      console.log('');
    }
  } else {
    console.log('✅ No problematic documents found!\n');
  }

  await prisma.$disconnect();
}

diagnoseAllDocuments().catch(console.error);
