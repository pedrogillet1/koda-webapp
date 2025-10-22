const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { downloadFile } = require('./dist/config/storage');
const { extractText } = require('./dist/services/textExtraction.service');

/**
 * CONTAMINATED DATA CLEANUP SCRIPT
 *
 * This script identifies and fixes all cross-user contaminated documents by:
 * 1. Finding all documents with duplicate extracted text
 * 2. Re-downloading the original files from GCS
 * 3. Re-extracting text with proper isolation
 * 4. Updating the database with correct content
 */

async function cleanupContaminatedData() {
  console.log('🧹 STARTING CONTAMINATED DATA CLEANUP');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Find all contaminated documents
    console.log('📊 Step 1: Identifying contaminated documents...\n');

    const allMetadata = await prisma.documentMetadata.findMany({
      where: {
        extractedText: {
          not: null
        }
      },
      include: {
        document: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`   Found ${allMetadata.length} documents with extracted text\n`);

    // Group by text content (first 200 chars as fingerprint)
    const textMap = new Map();
    allMetadata.forEach(metadata => {
      if (!metadata.extractedText) return;

      const textHash = metadata.extractedText.substring(0, 200);
      if (!textMap.has(textHash)) {
        textMap.set(textHash, []);
      }
      textMap.get(textHash).push({
        documentId: metadata.documentId,
        userId: metadata.document.userId,
        userEmail: metadata.document.user.email,
        filename: metadata.document.filename,
        encryptedFilename: metadata.document.encryptedFilename,
        mimeType: metadata.document.mimeType,
        textLength: metadata.extractedText.length,
        metadataId: metadata.id
      });
    });

    // Find cross-user duplicates
    const contaminatedGroups = [];
    textMap.forEach((docs, textHash) => {
      if (docs.length > 1) {
        const uniqueUsers = new Set(docs.map(d => d.userId));
        if (uniqueUsers.size > 1) {
          contaminatedGroups.push({
            textPreview: textHash,
            documents: docs
          });
        }
      }
    });

    console.log(`   Found ${contaminatedGroups.length} contaminated document groups\n`);

    if (contaminatedGroups.length === 0) {
      console.log('✅ No contaminated documents found! Database is clean.\n');
      return;
    }

    // Step 2: Display contamination details
    console.log('📋 Step 2: Contamination Details\n');

    let totalContaminated = 0;
    contaminatedGroups.forEach((group, i) => {
      console.log(`   Group ${i + 1}:`);
      console.log(`   Text preview: "${group.textPreview.substring(0, 80)}..."`);
      console.log(`   Affected documents (${group.documents.length}):`);

      group.documents.forEach(doc => {
        console.log(`      - ${doc.filename}`);
        console.log(`        User: ${doc.userEmail}`);
        console.log(`        Document ID: ${doc.documentId}`);
        totalContaminated++;
      });
      console.log('');
    });

    console.log(`   Total contaminated documents: ${totalContaminated}\n`);

    // Step 3: Reprocess each contaminated document
    console.log('🔧 Step 3: Reprocessing contaminated documents...\n');

    let successCount = 0;
    let failCount = 0;
    const failedDocs = [];

    for (const group of contaminatedGroups) {
      for (const doc of group.documents) {
        try {
          console.log(`   Processing: ${doc.filename} (${doc.userEmail})...`);

          // Check if file exists in GCS
          if (!doc.encryptedFilename) {
            console.log(`   ⚠️  SKIP: No encrypted filename (file not in GCS)`);
            failCount++;
            failedDocs.push({ ...doc, reason: 'No GCS file' });
            continue;
          }

          // Download file from GCS
          console.log(`   ⬇️  Downloading from GCS: ${doc.encryptedFilename}`);
          const fileBuffer = await downloadFile(doc.encryptedFilename);
          console.log(`   ✅ Downloaded ${fileBuffer.length} bytes`);

          // Extract text
          console.log(`   📝 Extracting text from ${doc.mimeType}...`);
          const extractionResult = await extractText(fileBuffer, doc.mimeType);
          const extractedText = extractionResult.text || '';
          const ocrConfidence = extractionResult.confidence || null;

          console.log(`   ✅ Extracted ${extractedText.length} characters`);
          console.log(`   📄 Text preview: "${extractedText.substring(0, 100)}..."`);

          // Verify it's different from contaminated text
          if (extractedText.substring(0, 200) === group.textPreview) {
            console.log(`   ⚠️  WARNING: New text matches contaminated text - might be correct for this file`);
          }

          // Update database with transaction
          await prisma.$transaction(async (tx) => {
            // Verify document ownership
            const dbDoc = await tx.document.findUnique({
              where: { id: doc.documentId },
              select: { userId: true }
            });

            if (!dbDoc) {
              throw new Error(`Document ${doc.documentId} not found`);
            }

            if (dbDoc.userId !== doc.userId) {
              throw new Error(`User mismatch: expected ${doc.userId}, got ${dbDoc.userId}`);
            }

            // Update metadata
            await tx.documentMetadata.upsert({
              where: { documentId: doc.documentId },
              create: {
                documentId: doc.documentId,
                extractedText,
                ocrConfidence,
                thumbnailUrl: null,
                entities: '{}',
                classification: 'unknown'
              },
              update: {
                extractedText,
                ocrConfidence
              }
            });

            console.log(`   ✅ Database updated for ${doc.documentId}`);
          });

          successCount++;
          console.log(`   ✅ SUCCESS\n`);

        } catch (error) {
          console.error(`   ❌ FAILED: ${error.message}`);
          failCount++;
          failedDocs.push({ ...doc, reason: error.message });
          console.log('');
        }
      }
    }

    // Step 4: Summary
    console.log('='.repeat(80));
    console.log('📊 CLEANUP SUMMARY\n');
    console.log(`   Total contaminated documents: ${totalContaminated}`);
    console.log(`   Successfully reprocessed: ${successCount}`);
    console.log(`   Failed: ${failCount}\n`);

    if (failedDocs.length > 0) {
      console.log('❌ Failed Documents:\n');
      failedDocs.forEach(doc => {
        console.log(`   - ${doc.filename} (${doc.userEmail})`);
        console.log(`     Document ID: ${doc.documentId}`);
        console.log(`     Reason: ${doc.reason}\n`);
      });
    }

    // Step 5: Verify cleanup
    console.log('🔍 Step 5: Verifying cleanup...\n');

    const stillContaminated = [];
    for (const group of contaminatedGroups) {
      const docs = await Promise.all(
        group.documents.map(async doc => {
          const metadata = await prisma.documentMetadata.findUnique({
            where: { documentId: doc.documentId },
            select: { extractedText: true }
          });
          return {
            ...doc,
            currentText: metadata?.extractedText?.substring(0, 200) || ''
          };
        })
      );

      // Check if still contaminated
      const textSet = new Set(docs.map(d => d.currentText).filter(t => t));
      if (textSet.size === 1 && docs.length > 1) {
        const uniqueUsers = new Set(docs.map(d => d.userId));
        if (uniqueUsers.size > 1) {
          stillContaminated.push(group);
        }
      }
    }

    if (stillContaminated.length === 0) {
      console.log('   ✅ ALL CONTAMINATION CLEANED UP!\n');
    } else {
      console.log(`   ⚠️  ${stillContaminated.length} groups still contaminated\n`);
      stillContaminated.forEach((group, i) => {
        console.log(`   Group ${i + 1}:`);
        group.documents.forEach(doc => {
          console.log(`      - ${doc.filename} (${doc.userEmail})`);
        });
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log('✅ CLEANUP COMPLETE\n');

  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
cleanupContaminatedData()
  .then(() => {
    console.log('Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
