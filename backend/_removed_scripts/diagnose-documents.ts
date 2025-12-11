/**
 * Comprehensive Document Processing Diagnostics
 * Identifies all document processing failures
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseDocuments() {
  console.log('🔍 KODA Document Processing Diagnostics\n');
  console.log('='.repeat(80));

  try {
    // 1. Overall Statistics
    console.log('\n📊 OVERALL STATISTICS');
    console.log('-'.repeat(80));

    const totalDocs = await prisma.document.count();
    const completedDocs = await prisma.document.count({ where: { status: 'completed' } });
    const processingDocs = await prisma.document.count({ where: { status: 'processing' } });
    const failedDocs = await prisma.document.count({ where: { status: 'failed' } });

    console.log(`Total Documents: ${totalDocs}`);
    console.log(`✅ Completed: ${completedDocs} (${((completedDocs/totalDocs)*100).toFixed(1)}%)`);
    console.log(`⏳ Processing: ${processingDocs} (${((processingDocs/totalDocs)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failedDocs} (${((failedDocs/totalDocs)*100).toFixed(1)}%)`);

    // 2. Document Details
    console.log('\n📄 DOCUMENT DETAILS');
    console.log('-'.repeat(80));

    const documents = await prisma.document.findMany({
      include: {
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    });

    for (const doc of documents) {
      const hasText = doc.metadata?.extractedText && doc.metadata.extractedText.length > 0;
      const textLength = doc.metadata?.extractedText?.length || 0;
      const hasMarkdown = doc.metadata?.markdownContent && doc.metadata.markdownContent.length > 0;

      console.log(`\n📌 ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Type: ${doc.mimeType}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Created: ${doc.createdAt.toISOString()}`);
      console.log(`   Updated: ${doc.updatedAt.toISOString()}`);

      if (doc.metadata) {
        console.log(`   ✅ Metadata exists`);
        console.log(`   Text extracted: ${hasText ? `YES (${textLength} chars)` : 'NO ⚠️'}`);
        console.log(`   Markdown: ${hasMarkdown ? 'YES' : 'NO'}`);
        console.log(`   OCR confidence: ${doc.metadata.ocrConfidence || 'N/A'}`);
        console.log(`   Page count: ${doc.metadata.pageCount || 'N/A'}`);
        console.log(`   Word count: ${doc.metadata.wordCount || 'N/A'}`);
        console.log(`   Classification: ${doc.metadata.classification || 'None'}`);
      } else {
        console.log(`   ❌ NO METADATA - Document never processed!`);
      }
    }

    // 3. Check for embeddings
    console.log('\n\n🔮 VECTOR EMBEDDINGS CHECK');
    console.log('-'.repeat(80));

    const embeddingsCount = await prisma.documentEmbedding.count();
    console.log(`Total embeddings in database: ${embeddingsCount}`);

    for (const doc of documents) {
      const docEmbeddings = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });

      const embeddingSample = await prisma.documentEmbedding.findFirst({
        where: { documentId: doc.id },
        select: {
          content: true,
          metadata: true,
          embedding: true
        }
      });

      console.log(`\n${doc.filename}:`);
      console.log(`   Chunks: ${docEmbeddings}`);

      if (embeddingSample) {
        const metadata = JSON.parse(embeddingSample.metadata);
        console.log(`   ✅ Sample chunk: "${embeddingSample.content.substring(0, 100)}..."`);
        console.log(`   Metadata: ${JSON.stringify(metadata)}`);
        console.log(`   Has filename in metadata? ${metadata.filename ? 'YES' : 'NO ⚠️'}`);
        console.log(`   Has documentId in metadata? ${metadata.documentId ? 'YES' : 'NO ⚠️'}`);
      } else if (docEmbeddings === 0) {
        console.log(`   ❌ NO EMBEDDINGS - Document not indexed!`);
      }
    }

    // 4. Test for specific problem documents
    console.log('\n\n🎯 SPECIFIC TEST DOCUMENTS CHECK');
    console.log('-'.repeat(80));

    const testDocNames = [
      'Montana-Rocking-CC-Sanctuary',
      'Baxter',
      'Koda_AI_Behavioral',
      'LoneMountainRanch',
      'Koda Business Plan'
    ];

    for (const name of testDocNames) {
      const doc = await prisma.document.findFirst({
        where: {
          filename: {
            contains: name
          }
        },
        include: { metadata: true }
      });

      if (doc) {
        const hasText = doc.metadata?.extractedText && doc.metadata.extractedText.length > 0;
        const embeddings = await prisma.documentEmbedding.count({
          where: { documentId: doc.id }
        });

        console.log(`\n${name}:`);
        console.log(`   Status: ${doc.status}`);
        console.log(`   Text: ${hasText ? `✅ ${doc.metadata!.extractedText!.length} chars` : '❌ NONE'}`);
        console.log(`   Embeddings: ${embeddings > 0 ? `✅ ${embeddings} chunks` : '❌ NONE'}`);
      } else {
        console.log(`\n${name}: ❌ NOT FOUND IN DATABASE`);
      }
    }

    // 5. File type breakdown
    console.log('\n\n📁 FILE TYPE BREAKDOWN');
    console.log('-'.repeat(80));

    const fileTypes = await prisma.document.groupBy({
      by: ['mimeType'],
      _count: {
        id: true
      }
    });

    for (const type of fileTypes) {
      const completed = await prisma.document.count({
        where: {
          mimeType: type.mimeType,
          status: 'completed'
        }
      });

      console.log(`\n${type.mimeType}:`);
      console.log(`   Total: ${type._count.id}`);
      console.log(`   Completed: ${completed}/${type._count.id}`);
    }

    // 6. Identify documents needing reprocessing
    console.log('\n\n🔄 DOCUMENTS NEEDING REPROCESSING');
    console.log('-'.repeat(80));

    const needsReprocessing = await prisma.document.findMany({
      where: {
        OR: [
          { status: 'failed' },
          { status: 'processing' },
          {
            AND: [
              { status: 'completed' },
              {
                metadata: {
                  OR: [
                    { extractedText: null },
                    { extractedText: '' }
                  ]
                }
              }
            ]
          }
        ]
      },
      include: { metadata: true }
    });

    if (needsReprocessing.length > 0) {
      console.log(`Found ${needsReprocessing.length} documents needing reprocessing:\n`);

      for (const doc of needsReprocessing) {
        console.log(`❌ ${doc.filename}`);
        console.log(`   Status: ${doc.status}`);
        console.log(`   Reason: ${
          doc.status === 'failed' ? 'Processing failed' :
          doc.status === 'processing' ? 'Stuck in processing' :
          'No text extracted'
        }`);
      }
    } else {
      console.log('✅ All documents successfully processed!');
    }

    // 7. Summary and recommendations
    console.log('\n\n📋 SUMMARY AND RECOMMENDATIONS');
    console.log('='.repeat(80));

    if (failedDocs > 0) {
      console.log(`❌ ${failedDocs} documents failed processing`);
      console.log(`   → Run reprocessing script`);
    }

    if (processingDocs > 0) {
      console.log(`⏳ ${processingDocs} documents stuck in processing`);
      console.log(`   → These may have failed silently`);
    }

    const docsWithoutEmbeddings = documents.filter(async (doc) => {
      const count = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });
      return count === 0;
    });

    if (docsWithoutEmbeddings.length > 0) {
      console.log(`🔮 Some documents have no vector embeddings`);
      console.log(`   → These documents are invisible to KODA's search`);
    }

    console.log('\n✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Error running diagnostics:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseDocuments();
