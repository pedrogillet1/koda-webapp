const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Import services
const documentService = require('./dist/services/document.service');
const textExtractionService = require('./dist/services/textExtraction.service');
const geminiService = require('./dist/services/gemini.service');
const { downloadFile } = require('./dist/config/storage');

async function reprocessDocuments() {
  try {
    console.log('🔄 Finding documents with "processing" status...');

    const processingDocs = await prisma.document.findMany({
      where: {
        OR: [
          { status: 'processing' },
          { status: 'failed' }
        ]
      },
      include: {
        metadata: true
      }
    });

    console.log(`📄 Found ${processingDocs.length} documents to reprocess`);

    for (const doc of processingDocs) {
      console.log(`\n📝 Processing: ${doc.filename}`);

      try {
        // Download file from GCS
        console.log('⬇️  Downloading from GCS...');
        const fileBuffer = await downloadFile(doc.encryptedFilename);

        // Extract text
        let extractedText = '';
        let ocrConfidence = null;

        if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(doc.mimeType)) {
          console.log('🖼️  Using OpenAI Vision for image OCR...');
          extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, doc.mimeType);
          ocrConfidence = 0.95;
        } else {
          console.log('📝 Using text extraction service...');
          try {
            const result = await textExtractionService.extractText(fileBuffer, doc.mimeType);
            extractedText = result.text;
            ocrConfidence = result.confidence || null;
          } catch (extractionError) {
            console.warn('⚠️  Standard extraction failed, trying OpenAI Vision fallback...');
            try {
              extractedText = await geminiService.extractTextFromImageWithGemini(fileBuffer, doc.mimeType);
              ocrConfidence = 0.85;
              console.log('✅ Fallback extraction successful');
            } catch (visionError) {
              throw extractionError;
            }
          }
        }

        console.log(`✅ Text extracted (${extractedText.length} characters)`);

        // Analyze document
        let classification = null;
        let entities = null;

        if (extractedText && extractedText.length > 0) {
          console.log('🤖 Analyzing document with OpenAI...');
          try {
            const analysis = await geminiService.analyzeDocumentWithGemini(extractedText, doc.mimeType);
            classification = analysis.suggestedCategories?.[0] || null;
            entities = JSON.stringify(analysis.keyEntities || {});
            console.log('✅ Document analyzed');
          } catch (error) {
            console.warn('⚠️  Document analysis failed (non-critical):', error.message);
          }
        }

        // Update or create metadata
        if (doc.metadata) {
          await prisma.documentMetadata.update({
            where: { id: doc.metadata.id },
            data: {
              extractedText,
              ocrConfidence,
              classification,
              entities,
            }
          });
        } else {
          await prisma.documentMetadata.create({
            data: {
              documentId: doc.id,
              extractedText,
              ocrConfidence,
              classification,
              entities,
            }
          });
        }

        // Update document status
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: 'completed' }
        });

        console.log(`✅ Successfully processed: ${doc.filename}`);
      } catch (error) {
        console.error(`❌ Error processing ${doc.filename}:`, error.message);

        // Mark as failed
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: 'failed' }
        });
      }
    }

    console.log('\n🎉 Reprocessing complete!');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error in reprocessing:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

reprocessDocuments();
