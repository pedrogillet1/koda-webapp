import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeScrumPDF() {
  try {
    console.log('='.repeat(80));
    console.log('SCRUM FRAMEWORK PDF ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    // Step 1: Find the user
    console.log('STEP 1: Finding user with email "123hackerabc"...');
    console.log('-'.repeat(80));

    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: '123hackerabc'
        }
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found with email containing "123hackerabc"');
      return;
    }

    console.log(`✅ Found ${users.length} user(s):`);
    users.forEach(u => {
      console.log(`  - ID: ${u.id}`);
      console.log(`    Email: ${u.email}`);
      console.log(`    Name: ${u.firstName || 'N/A'} ${u.lastName || ''}`);
    });
    console.log();

    const userId = users[0].id;
    console.log(`Using User ID: ${userId}`);
    console.log();

    // Step 2: Find scrum framework PDF
    console.log('STEP 2: Finding "scrum framework" PDF documents...');
    console.log('-'.repeat(80));

    const documents = await prisma.document.findMany({
      where: {
        userId: userId,
        filename: {
          contains: 'scrum',
          mode: 'insensitive'
        },
        mimeType: 'application/pdf'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (documents.length === 0) {
      console.log('❌ No scrum PDF documents found for this user');
      console.log('\nSearching for ANY documents with "scrum" in filename...');

      const anyScrum = await prisma.document.findMany({
        where: {
          userId: userId,
          filename: {
            contains: 'scrum',
            mode: 'insensitive'
          }
        }
      });

      if (anyScrum.length > 0) {
        console.log(`\nFound ${anyScrum.length} document(s) with "scrum" (not PDFs):`);
        anyScrum.forEach(doc => {
          console.log(`  - ${doc.filename} (${doc.mimeType})`);
        });
      } else {
        console.log('No documents with "scrum" found at all');
      }
      return;
    }

    console.log(`✅ Found ${documents.length} scrum PDF document(s):`);
    documents.forEach((doc, idx) => {
      console.log(`\n  Document ${idx + 1}:`);
      console.log(`    ID: ${doc.id}`);
      console.log(`    Filename: ${doc.filename}`);
      console.log(`    Status: ${doc.status}`);
      console.log(`    File Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
      console.log(`    Created: ${doc.createdAt.toISOString()}`);
      console.log(`    Encrypted: ${doc.isEncrypted ? 'Yes' : 'No'}`);
    });
    console.log();

    // Analyze each document
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log('='.repeat(80));
      console.log(`ANALYZING DOCUMENT ${i + 1}: ${doc.filename}`);
      console.log('='.repeat(80));
      console.log();

      // Step 3: Check extracted text
      console.log('STEP 3: Checking extracted text and metadata...');
      console.log('-'.repeat(80));

      const metadata = await prisma.documentMetadata.findUnique({
        where: {
          documentId: doc.id
        }
      });

      if (!metadata) {
        console.log('❌ No metadata found for this document');
        console.log('   This indicates the document was never processed or failed during processing');
      } else {
        console.log('✅ Metadata found:');
        console.log(`    Page Count: ${metadata.pageCount || 'N/A'}`);
        console.log(`    Word Count: ${metadata.wordCount || 'N/A'}`);
        console.log(`    Character Count: ${metadata.characterCount || 'N/A'}`);
        console.log(`    OCR Confidence: ${metadata.ocrConfidence || 'N/A'}`);
        console.log(`    Language: ${metadata.language || 'N/A'}`);
        console.log(`    Has Tables: ${metadata.hasTables ? 'Yes' : 'No'}`);
        console.log(`    Has Images: ${metadata.hasImages ? 'Yes' : 'No'}`);
        console.log(`    Has Signature: ${metadata.hasSignature ? 'Yes' : 'No'}`);
        console.log(`    Classification: ${metadata.classification || 'N/A'}`);

        if (metadata.extractedText) {
          const textLength = metadata.extractedText.length;
          console.log(`    Extracted Text Length: ${textLength} characters`);
          console.log(`\n    First 500 characters of extracted text:`);
          console.log('    ' + '-'.repeat(76));
          console.log(`    ${metadata.extractedText.substring(0, 500).replace(/\n/g, '\n    ')}...`);
          console.log('    ' + '-'.repeat(76));
        } else {
          console.log(`    ❌ Extracted Text: NONE (This is the problem!)`);
        }

        if (metadata.markdownContent) {
          console.log(`\n    ✅ Markdown Content: ${metadata.markdownContent.length} characters`);
          console.log(`    First 500 characters of markdown:`);
          console.log('    ' + '-'.repeat(76));
          console.log(`    ${metadata.markdownContent.substring(0, 500).replace(/\n/g, '\n    ')}...`);
          console.log('    ' + '-'.repeat(76));
        } else {
          console.log(`\n    ⚠️  Markdown Content: NONE`);
        }
      }
      console.log();

      // Step 4: Check document chunks/embeddings
      console.log('STEP 4: Checking document chunks/embeddings...');
      console.log('-'.repeat(80));

      const embeddings = await prisma.documentEmbedding.findMany({
        where: {
          documentId: doc.id
        },
        orderBy: {
          chunkIndex: 'asc'
        }
      });

      if (embeddings.length === 0) {
        console.log('❌ No embeddings/chunks found for this document');
        console.log('   This means the document was not chunked or embedded for RAG');
      } else {
        console.log(`✅ Found ${embeddings.length} chunks/embeddings`);

        // Show first chunk
        if (embeddings.length > 0) {
          const firstChunk = embeddings[0];
          console.log(`\n    First chunk (index ${firstChunk.chunkIndex}):`);
          console.log('    ' + '-'.repeat(76));
          console.log(`    Content (first 300 chars): ${firstChunk.content.substring(0, 300)}...`);
          console.log(`    Metadata: ${firstChunk.metadata}`);

          // Check if embedding exists
          try {
            const embeddingArray = JSON.parse(firstChunk.embedding);
            console.log(`    Embedding: ${embeddingArray.length} dimensions`);
            console.log(`    First 5 values: [${embeddingArray.slice(0, 5).join(', ')}]`);
          } catch (e) {
            console.log(`    ❌ Embedding parsing failed: ${e}`);
          }
          console.log('    ' + '-'.repeat(76));
        }

        // Show last chunk
        if (embeddings.length > 1) {
          const lastChunk = embeddings[embeddings.length - 1];
          console.log(`\n    Last chunk (index ${lastChunk.chunkIndex}):`);
          console.log('    ' + '-'.repeat(76));
          console.log(`    Content (first 300 chars): ${lastChunk.content.substring(0, 300)}...`);
          console.log('    ' + '-'.repeat(76));
        }
      }
      console.log();

      // Step 5: Check Pinecone indexing (inferred from embeddings existence)
      console.log('STEP 5: Checking Pinecone indexing status...');
      console.log('-'.repeat(80));

      if (embeddings.length > 0) {
        console.log('✅ Document appears to be indexed (embeddings exist in DB)');
        console.log(`   Total vectors: ${embeddings.length}`);
        console.log('   Note: Actual Pinecone index status would need to be checked separately');
      } else {
        console.log('❌ Document is NOT indexed (no embeddings in DB)');
      }
      console.log();

      // Step 6: Diagnosis
      console.log('STEP 6: DIAGNOSIS & RECOMMENDATIONS');
      console.log('-'.repeat(80));

      const issues = [];
      const recommendations = [];

      if (doc.status !== 'completed') {
        issues.push(`Document status is "${doc.status}" (not "completed")`);
        recommendations.push('Re-upload or reprocess the document');
      }

      if (!metadata) {
        issues.push('No metadata record exists');
        recommendations.push('Document needs to be reprocessed from scratch');
      } else {
        if (!metadata.extractedText || metadata.extractedText.length === 0) {
          issues.push('No extracted text - PDF text extraction failed');
          recommendations.push('Check if PDF is image-based (needs OCR) or corrupted');
          recommendations.push('Verify PDF processing pipeline is working');
        }

        if (!metadata.wordCount || metadata.wordCount === 0) {
          issues.push('Word count is 0 - indicates extraction failure');
        }
      }

      if (embeddings.length === 0) {
        issues.push('No chunks/embeddings - document not indexed for RAG');
        recommendations.push('Run embedding generation process');
        recommendations.push('Check chunking service is working');
      }

      if (issues.length === 0) {
        console.log('✅ NO ISSUES DETECTED - Document appears healthy!');
      } else {
        console.log('❌ ISSUES DETECTED:');
        issues.forEach((issue, idx) => {
          console.log(`   ${idx + 1}. ${issue}`);
        });

        console.log('\n💡 RECOMMENDATIONS:');
        recommendations.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. ${rec}`);
        });
      }
      console.log();
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeScrumPDF();
