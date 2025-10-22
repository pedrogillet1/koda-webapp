import { PrismaClient } from '@prisma/client';
import { downloadFile } from '../src/config/storage';
import * as textExtractionService from '../src/services/textExtraction.service';

const prisma = new PrismaClient();

async function reprocessContaminatedDocs() {
  console.log('\n🔧 REPROCESSING CONTAMINATED DOCUMENTS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Find all PDF documents uploaded during the contamination window
  const startTime = new Date('2025-10-08T13:38:00.000-03:00');
  const endTime = new Date('2025-10-08T13:44:00.000-03:00');

  const affectedDocs = await prisma.document.findMany({
    where: {
      mimeType: 'application/pdf',
      createdAt: {
        gte: startTime,
        lte: endTime,
      },
    },
    include: {
      metadata: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Found ${affectedDocs.length} PDF documents in contamination window\n`);

  const results = [];

  for (const doc of affectedDocs) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 Processing: ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   User ID: ${doc.userId}`);
    console.log(`   Created: ${doc.createdAt}`);
    console.log(`   Size: ${doc.fileSize} bytes`);

    try {
      // Get old extracted text
      const oldText = doc.metadata?.extractedText || '';
      const oldTextPreview = oldText.substring(0, 200);
      console.log(`\n📝 OLD extracted text (${oldText.length} chars):`);
      console.log(`   "${oldTextPreview}..."`);

      // Download file from GCS
      console.log(`\n💾 Downloading file from GCS...`);
      const fileBuffer = await downloadFile(doc.encryptedFilename);
      console.log(`✅ Downloaded ${fileBuffer.length} bytes`);

      // Re-extract text with FIXED pdf-parse
      console.log(`\n🔄 Re-extracting text with fixed pdf-parse...`);
      const extractionResult = await textExtractionService.extractText(
        fileBuffer,
        doc.mimeType
      );

      const newText = extractionResult.text || '';
      const newTextPreview = newText.substring(0, 200);
      console.log(`✅ NEW extracted text (${newText.length} chars):`);
      console.log(`   "${newTextPreview}..."`);

      // Compare old vs. new
      const textChanged = oldText !== newText;
      const sizeChanged = oldText.length !== newText.length;

      console.log(`\n📊 COMPARISON:`);
      console.log(`   Text changed: ${textChanged ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Old length: ${oldText.length} chars`);
      console.log(`   New length: ${newText.length} chars`);
      console.log(`   Difference: ${newText.length - oldText.length} chars`);

      if (textChanged) {
        // Check if old text was contaminated (starts with psychiatric content)
        const wasContaminated = oldText.includes('AGITAÇÃO PSICOMOTORA') ||
                                oldText.includes('Dr. Daniel A. Cavalcante');
        const isStillContaminated = newText.includes('AGITAÇÃO PSICOMOTORA') ||
                                    newText.includes('Dr. Daniel A. Cavalcante');

        console.log(`   Was contaminated: ${wasContaminated ? 'YES ⚠️' : 'NO'}`);
        console.log(`   Still contaminated: ${isStillContaminated ? 'YES ⚠️' : 'NO ✅'}`);

        // Update metadata in database
        if (doc.metadata) {
          console.log(`\n💾 Updating database metadata...`);
          await prisma.documentMetadata.update({
            where: { id: doc.metadata.id },
            data: {
              extractedText: newText,
              ocrConfidence: extractionResult.confidence || null,
            },
          });
          console.log(`✅ Database updated successfully`);
        } else {
          console.log(`\n💾 Creating new metadata record...`);
          await prisma.documentMetadata.create({
            data: {
              documentId: doc.id,
              extractedText: newText,
              ocrConfidence: extractionResult.confidence || null,
            },
          });
          console.log(`✅ Metadata created successfully`);
        }

        results.push({
          filename: doc.filename,
          documentId: doc.id,
          userId: doc.userId,
          status: wasContaminated && !isStillContaminated ? 'FIXED ✅' : 'UPDATED',
          oldLength: oldText.length,
          newLength: newText.length,
          wasContaminated,
          isStillContaminated,
        });
      } else {
        console.log(`\n⏭️  Skipping update (text unchanged)`);
        results.push({
          filename: doc.filename,
          documentId: doc.id,
          userId: doc.userId,
          status: 'NO CHANGE',
          oldLength: oldText.length,
          newLength: newText.length,
          wasContaminated: false,
          isStillContaminated: false,
        });
      }
    } catch (error: any) {
      console.error(`\n❌ ERROR processing ${doc.filename}:`, error.message);
      results.push({
        filename: doc.filename,
        documentId: doc.id,
        userId: doc.userId,
        status: `ERROR: ${error.message}`,
        oldLength: 0,
        newLength: 0,
        wasContaminated: false,
        isStillContaminated: false,
      });
    }
  }

  // Print summary
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 REPROCESSING SUMMARY\n`);
  console.log(`Total documents processed: ${results.length}`);
  console.log(`Documents fixed: ${results.filter(r => r.status === 'FIXED ✅').length}`);
  console.log(`Documents updated: ${results.filter(r => r.status === 'UPDATED').length}`);
  console.log(`Documents unchanged: ${results.filter(r => r.status === 'NO CHANGE').length}`);
  console.log(`Errors: ${results.filter(r => r.status.startsWith('ERROR')).length}`);

  console.log(`\n\n📋 DETAILED RESULTS:\n`);
  for (const result of results) {
    console.log(`${result.status === 'FIXED ✅' ? '✅' : result.status === 'ERROR' ? '❌' : '  '} ${result.filename}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   User: ${result.userId}`);
    console.log(`   Old length: ${result.oldLength} → New length: ${result.newLength}`);
    if (result.wasContaminated) {
      console.log(`   🚨 WAS CONTAMINATED WITH PSYCHIATRIC CONTENT`);
    }
    console.log(``);
  }

  await prisma.$disconnect();
}

reprocessContaminatedDocs().catch(console.error);
