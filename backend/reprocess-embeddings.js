const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import necessary services
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Chunk text into smaller pieces for vector embedding
 */
function chunkText(text, maxWords = 500) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';
  let currentWordCount = 0;
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    const sentenceWordCount = words.length;

    if (currentWordCount + sentenceWordCount > maxWords && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          chunkIndex,
          startChar: text.indexOf(currentChunk),
          endChar: text.indexOf(currentChunk) + currentChunk.length
        }
      });
      chunkIndex++;
      currentChunk = '';
      currentWordCount = 0;
    }

    currentChunk += sentence + ' ';
    currentWordCount += sentenceWordCount;
  }

  // Add remaining text as last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        chunkIndex,
        startChar: text.indexOf(currentChunk),
        endChar: text.indexOf(currentChunk) + currentChunk.length
      }
    });
  }

  return chunks;
}

/**
 * Generate embedding for a text
 */
async function generateEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Generate embeddings in batch
 */
async function generateEmbeddingsBatch(texts) {
  console.log(`⚡ Processing ${texts.length} chunks in parallel...`);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const embeddings = [];

  const BATCH_SIZE = 5;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, Math.min(i + BATCH_SIZE, texts.length));

    const batchResults = await Promise.all(
      batch.map(async (text) => {
        const result = await model.embedContent(text);
        return result.embedding.values;
      })
    );

    embeddings.push(...batchResults);
    console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} completed`);
  }

  return embeddings;
}

/**
 * Store document embeddings
 */
async function storeDocumentEmbeddings(documentId, chunks) {
  console.log(`⚡ [Store Embeddings] Processing ${chunks.length} chunks for document ${documentId}...`);

  // Delete existing embeddings
  await prisma.documentEmbedding.deleteMany({
    where: { documentId }
  });

  // Generate ALL embeddings in batch
  const chunkTexts = chunks.map(c => c.content);
  const embeddings = await generateEmbeddingsBatch(chunkTexts);

  // Store ALL embeddings in batch
  console.log(`💾 [Store Embeddings] Saving ${embeddings.length} embeddings to database...`);

  const DB_BATCH_SIZE = 20;
  for (let i = 0; i < chunks.length; i += DB_BATCH_SIZE) {
    const batchEnd = Math.min(i + DB_BATCH_SIZE, chunks.length);
    const batch = [];

    for (let j = i; j < batchEnd; j++) {
      batch.push(
        prisma.documentEmbedding.create({
          data: {
            documentId,
            chunkIndex: j,
            content: chunks[j].content,
            embedding: JSON.stringify(embeddings[j]),
            metadata: JSON.stringify(chunks[j].metadata)
          }
        })
      );
    }

    await Promise.all(batch);
    console.log(`   ✅ DB Batch ${Math.floor(i / DB_BATCH_SIZE) + 1}/${Math.ceil(chunks.length / DB_BATCH_SIZE)} saved`);
  }

  console.log(`✅ [Store Embeddings] Completed ${embeddings.length} embeddings`);
}

async function reprocessDocuments() {
  try {
    console.log('🔍 Finding documents with text but no embeddings...\n');

    // Find all documents that have extractedText but no embeddings
    const documents = await prisma.document.findMany({
      where: {
        status: 'completed',
        metadata: {
          isNot: null
        }
      },
      include: {
        metadata: true
      }
    });

    console.log(`📄 Found ${documents.length} completed documents\n`);

    for (const doc of documents) {
      const { metadata } = doc;

      if (!metadata || !metadata.extractedText || metadata.extractedText.length < 50) {
        console.log(`⏭️  Skipping ${doc.filename}: No text or text too short`);
        continue;
      }

      // Check if embeddings already exist
      const existingEmbeddings = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });

      if (existingEmbeddings > 0) {
        console.log(`✅ ${doc.filename}: Already has ${existingEmbeddings} embeddings\n`);
        continue;
      }

      console.log(`\n🧠 Processing: ${doc.filename}`);
      console.log(`   Text length: ${metadata.extractedText.length} chars`);
      console.log(`   Word count: ${metadata.wordCount || 'unknown'}`);

      // Chunk the text
      const chunks = chunkText(metadata.extractedText, 500);
      console.log(`   Created ${chunks.length} chunks`);

      // Generate and store embeddings
      await storeDocumentEmbeddings(doc.id, chunks);

      console.log(`✅ ${doc.filename}: Stored ${chunks.length} embeddings\n`);
    }

    console.log('\n✅ All documents processed successfully!');

    // Show final statistics
    const totalEmbeddings = await prisma.documentEmbedding.count();
    const docsWithEmbeddings = await prisma.documentEmbedding.groupBy({
      by: ['documentId']
    });

    console.log('\n📊 Final Statistics:');
    console.log(`   Total embeddings: ${totalEmbeddings}`);
    console.log(`   Documents with embeddings: ${docsWithEmbeddings.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessDocuments();
