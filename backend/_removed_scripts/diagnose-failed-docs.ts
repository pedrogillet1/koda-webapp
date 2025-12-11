import prisma from './src/config/database';
import pineconeService from './src/services/pinecone.service';

async function diagnoseProblemDocs() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         DIAGNOSIS: MULTI-FORMAT PROCESSING ISSUES         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get the 10 most recent documents
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { metadata: true },
  });

  console.log(`Found ${documents.length} recent documents\n`);

  // Focus on problem documents
  const problemDocs = {
    xlsx: documents.filter(d => d.filename.endsWith('.xlsx')),
    docxNoText: documents.filter(
      d => d.filename.endsWith('.docx') &&
      (!d.metadata?.extractedText || d.metadata.extractedText.length === 0)
    ),
    textNoVectors: documents.filter(
      d => d.metadata?.extractedText &&
      d.metadata.extractedText.length > 0 &&
      d.status === 'completed'
    ),
  };

  // 1. Check XLSX stuck in processing
  if (problemDocs.xlsx.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 ISSUE 1: XLSX Processing');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const doc of problemDocs.xlsx) {
      console.log(`📄 ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Created: ${doc.createdAt}`);
      console.log(`   File Size: ${doc.fileSize} bytes`);
      console.log(`   MIME Type: ${doc.mimeType}`);

      if (doc.metadata) {
        console.log(`   Metadata: EXISTS`);
        console.log(`   - Text Length: ${doc.metadata.extractedText?.length || 0} chars`);
        console.log(`   - Sheet Count: ${doc.metadata.sheetCount || 'N/A'}`);
      } else {
        console.log(`   Metadata: MISSING - Processing likely failed during extraction`);
      }

      // Check if stuck in processing for > 5 minutes
      const processingTime = Date.now() - new Date(doc.createdAt).getTime();
      const minutesProcessing = Math.floor(processingTime / 60000);

      if (doc.status === 'processing' && minutesProcessing > 5) {
        console.log(`   ⚠️  STUCK: Processing for ${minutesProcessing} minutes`);
      }

      console.log('');
    }
  }

  // 2. Check DOCX with no text
  if (problemDocs.docxNoText.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 ISSUE 2: DOCX Files with No Text Extracted');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const doc of problemDocs.docxNoText) {
      console.log(`📄 ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   File Size: ${doc.fileSize} bytes`);

      if (doc.metadata) {
        console.log(`   Metadata: EXISTS (but no text)`);
        console.log(`   - Word Count: ${doc.metadata.wordCount || 0}`);
        console.log(`   - Page Count: ${doc.metadata.pageCount || 0}`);
      }

      console.log('   ❌ Possible causes: Corrupted file, image-only document, or extraction failure');
      console.log('');
    }
  }

  // 3. Check documents with text but no vectors (CRITICAL)
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 ISSUE 3: Documents with Text but No Pinecone Vectors');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const doc of problemDocs.textNoVectors) {
    const textLength = doc.metadata?.extractedText?.length || 0;

    // Check Pinecone
    const verification = await pineconeService.verifyDocument(doc.id);

    if (!verification.success || verification.vectorCount === 0) {
      console.log(`📄 ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Text Extracted: ${textLength} chars`);
      console.log(`   Vectors in Pinecone: ${verification.vectorCount || 0}`);
      console.log(`   ❌ CRITICAL: Text extraction succeeded but embeddings failed!`);

      // This is the critical bug - text extracted but not embedded
      if (textLength > 0 && verification.vectorCount === 0) {
        console.log(`   🔧 Action Required: Re-run embedding generation for this document`);
      }

      console.log('');
    }
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      DIAGNOSIS SUMMARY                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const xlsxStuck = problemDocs.xlsx.filter(d => d.status === 'processing').length;
  const docxNoTextCount = problemDocs.docxNoText.length;

  let textNoVectorsCount = 0;
  for (const doc of problemDocs.textNoVectors) {
    const verification = await pineconeService.verifyDocument(doc.id);
    if (!verification.success || verification.vectorCount === 0) {
      textNoVectorsCount++;
    }
  }

  console.log(`📊 Issues Found:`);
  console.log(`   - XLSX stuck in processing: ${xlsxStuck}`);
  console.log(`   - DOCX with no text: ${docxNoTextCount}`);
  console.log(`   - Documents with text but no vectors: ${textNoVectorsCount}`);

  console.log('\n📋 Recommended Actions:');
  if (xlsxStuck > 0) {
    console.log('   1. XLSX: Check docx-converter.service.ts for XLSX processing logic');
  }
  if (docxNoTextCount > 0) {
    console.log(`   2. DOCX: Files may be corrupted or image-only - verify files manually`);
  }
  if (textNoVectorsCount > 0) {
    console.log('   3. EMBEDDINGS: Critical bug - embeddings not being generated despite text extraction');
    console.log('      → Check document.service.ts processDocumentInBackground() embedding step');
    console.log('      → Check embedding.service.ts for errors');
  }

  console.log('');
  process.exit(0);
}

diagnoseProblemDocs();
