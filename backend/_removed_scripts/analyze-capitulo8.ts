/**
 * Diagnostic script to analyze Capítulo 8 document
 * Check if OCR extracted text and what content is available
 */

import { PrismaClient } from '@prisma/client';
import pineconeService from './src/services/pinecone.service';

const prisma = new PrismaClient();

async function analyzeCapitulo8() {
  try {
    console.log('🔍 Searching for Capítulo 8 document...\n');

    // Find the document with metadata
    const document = await prisma.document.findFirst({
      where: {
        filename: {
          contains: 'Capítulo 8',
        },
      },
      include: {
        metadata: true,
      },
    });

    if (!document) {
      console.log('❌ Document "Capítulo 8" not found in database');
      return;
    }

    console.log('✅ Document found in database:\n');
    console.log(`📄 ID: ${document.id}`);
    console.log(`📄 Filename: ${document.filename}`);
    console.log(`📄 MIME Type: ${document.mimeType}`);
    console.log(`📄 Status: ${document.status}`);
    console.log(`📄 User ID: ${document.userId}`);
    console.log(`📄 Uploaded: ${document.createdAt}`);
    console.log(`📄 File Size: ${document.fileSize} bytes`);
    console.log(`📄 OCR Confidence: ${document.metadata?.ocrConfidence || 'N/A'}`);
    console.log(`📄 Page Count: ${document.metadata?.pageCount || 'N/A'}`);
    console.log(`📄 Word Count: ${document.metadata?.wordCount || 'N/A'}\n`);

    // Check extracted text
    const extractedText = document.metadata?.extractedText || '';
    const textLength = extractedText.length;
    const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;

    console.log('📝 Extracted Text Analysis:\n');
    console.log(`   Length: ${textLength} characters`);
    console.log(`   Words: ${wordCount}`);
    console.log(`   Has text: ${textLength > 0 ? 'YES ✅' : 'NO ❌'}\n`);

    if (textLength > 0) {
      console.log('📖 First 500 characters of extracted text:\n');
      console.log('─'.repeat(80));
      console.log(extractedText.substring(0, 500));
      console.log('─'.repeat(80));
      console.log('\n');
    } else {
      console.log('⚠️  NO TEXT EXTRACTED - This is why RAG cannot find it!\n');
    }

    // Check Pinecone chunks
    console.log('🔍 Checking Pinecone for indexed chunks...\n');

    try {
      // Query Pinecone directly for this document
      const testQuery = await pineconeService.searchSimilarChunks(
        new Array(1536).fill(0.1), // Dummy embedding
        document.userId,
        10,
        0.0, // No similarity threshold
        document.id
      );

      console.log(`📊 Pinecone chunks found: ${testQuery.length}`);

      if (testQuery.length > 0) {
        console.log('\n📄 Sample chunk content:\n');
        console.log('─'.repeat(80));
        console.log(testQuery[0].content.substring(0, 300));
        console.log('─'.repeat(80));
      } else {
        console.log('⚠️  NO CHUNKS IN PINECONE - Document not indexed!\n');
      }
    } catch (pineconeError: any) {
      console.error('❌ Error querying Pinecone:', pineconeError.message);
    }

    // Diagnosis
    console.log('\n\n🔬 DIAGNOSIS:\n');
    console.log('─'.repeat(80));

    if (textLength === 0) {
      console.log('❌ Problem: NO TEXT WAS EXTRACTED from the PDF');
      console.log('');
      console.log('Reason: This document was uploaded BEFORE OCR was implemented.');
      console.log('');
      console.log('Solutions:');
      console.log('  1. Delete and re-upload the document');
      console.log('  2. Or implement a reprocessing feature to run OCR on existing docs');
      console.log('');
      console.log('Once re-uploaded, the system will:');
      console.log('  - Detect it\'s a scanned PDF (< 50 words)');
      console.log('  - Run Google Cloud Vision OCR');
      console.log('  - Extract all text');
      console.log('  - Index in Pinecone');
      console.log('  - Then RAG queries will work!');
    } else {
      console.log('✅ Text was extracted successfully!');
      console.log('');
      console.log('If RAG still doesn\'t find it, check:');
      console.log('  - Pinecone indexing (see above)');
      console.log('  - Query embedding generation');
      console.log('  - Similarity threshold settings');
    }

    console.log('─'.repeat(80));

  } catch (error: any) {
    console.error('❌ Error analyzing document:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeCapitulo8();
