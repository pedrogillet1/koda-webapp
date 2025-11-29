import prisma from '../config/database';
import vectorEmbeddingService from '../services/vectorEmbedding.service';
import pineconeService from '../services/pinecone.service';
import * as textExtractionService from '../services/textExtraction.service';
import { Storage } from '@google-cloud/storage';

// Initialize GCS
const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE,
  projectId: process.env.GCS_PROJECT_ID,
});
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');

async function processAllDocuments() {
  console.log('🚀 Starting manual document processing...\n');

  try {
    // Find all documents that need processing (including failed ones for retry)
    const documents = await prisma.documents.findMany({
      where: {
        status: {
          in: ['ready', 'pending', 'uploaded', 'failed']
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📄 Found ${documents.length} documents to process\n`);

    if (documents.length === 0) {
      console.log('✅ No documents need processing');
      return;
    }

    for (const doc of documents) {
      console.log(`\n📝 Processing: ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Type: ${doc.mimeType}`);

      try {
        // Download file from GCS
        console.log('   📥 Downloading from GCS...');
        const file = bucket.file(doc.encryptedFilename);
        const [fileBuffer] = await file.download();
        console.log(`   ✅ Downloaded ${fileBuffer.length} bytes`);

        // Extract text from document
        console.log('   🔍 Extracting text...');
        const extractionResult = await textExtractionService.extractText(fileBuffer, doc.mimeType);
        const extractedText = extractionResult.text;

        if (!extractedText || extractedText.trim().length === 0) {
          console.log('   ⚠️  No text extracted, skipping...');
          continue;
        }

        console.log(`   ✅ Extracted ${extractedText.length} characters`);

        // Chunk the text
        console.log('   ✂️  Chunking text...');
        const chunks = chunkText(extractedText, 1000, 200);
        console.log(`   ✅ Created ${chunks.length} chunks`);

        // Generate embeddings and store in Pinecone
        console.log('   🧠 Generating embeddings and storing in Pinecone...');

        // Create chunks with metadata
        const chunksWithMetadata = chunks.map((chunk, i) => ({
          content: chunk,
          chunkIndex: i,
          embedding: [], // Will be filled by storeDocumentEmbeddings
          document_metadata: {}
        }));

        // This will generate embeddings AND upload to Pinecone
        await vectorEmbeddingService.storeDocumentEmbeddings(doc.id, chunksWithMetadata);
        console.log(`   ✅ Stored ${chunks.length} chunks with embeddings in Pinecone`);

        // Update document status
        await prisma.documents.update({
          where: { id: doc.id },
          data: { status: 'ready' }
        });

        console.log(`   ✅ Document processed successfully!`);

      } catch (error: any) {
        console.error(`   ❌ Error processing document:`, error.message);
      }
    }

    console.log('\n\n🎉 Processing complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to chunk text
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

processAllDocuments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
