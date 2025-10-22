/**
 * Script to reprocess all existing PowerPoint files
 * This will extract text and create proper embeddings for semantic search
 */

import { PrismaClient } from '@prisma/client';
import { downloadFile } from '../src/config/storage';
import encryptionService from '../src/services/encryption.service';
import enhancedDocumentProcessing from '../src/services/enhancedDocumentProcessing.service';

const prisma = new PrismaClient();

/**
 * Download and decrypt a file from GCS
 */
async function downloadAndDecryptFile(document: any): Promise<Buffer> {
  // Download encrypted file from GCS
  let fileBuffer = await downloadFile(document.encryptedFilename);

  // 🔓 DECRYPT FILE IF ENCRYPTED
  if (document.isEncrypted && document.encryptionIV && document.encryptionAuthTag) {
    console.log(`   🔓 Decrypting file...`);

    // Reconstruct encrypted buffer format: IV + AuthTag + EncryptedData
    // The IV and AuthTag are stored separately in the database
    // The downloaded file is just the encrypted data
    const ivBuffer = Buffer.from(document.encryptionIV, 'base64');
    const authTagBuffer = Buffer.from(document.encryptionAuthTag, 'base64');
    const encryptedData = fileBuffer;

    // Create buffer in format expected by decryptFile: IV + AuthTag + EncryptedData
    const encryptedBuffer = Buffer.concat([ivBuffer, authTagBuffer, encryptedData]);

    // Decrypt using the encryption service
    fileBuffer = encryptionService.decryptFile(encryptedBuffer, `document-${document.userId}`);
    console.log(`   ✅ File decrypted successfully (${fileBuffer.length} bytes)`);
  }

  return fileBuffer;
}

async function reprocessPowerPoint(document: any) {
  try {
    console.log(`\n🔄 Processing: ${document.filename} (ID: ${document.id})`);

    // Validate document has encrypted filename
    if (!document.encryptedFilename) {
      console.log(`   ⚠️  Skipping: No encrypted filename found`);
      return { success: false, error: 'No encrypted filename' };
    }

    // Download and decrypt file from GCS
    const buffer = await downloadAndDecryptFile(document);

    // Process the PowerPoint with enhanced document processing
    await enhancedDocumentProcessing.processDocument(
      buffer,
      document.mimeType,
      document.id
    );

    console.log(`   ✅ Successfully reprocessed: ${document.filename}`);
    return { success: true };

  } catch (error: any) {
    console.error(`   ❌ Error processing ${document.filename}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting PowerPoint reprocessing script...\n');

  try {
    // Find all PowerPoint documents
    const powerpoints = await prisma.document.findMany({
      where: {
        OR: [
          { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
          { mimeType: 'application/vnd.ms-powerpoint' },
          {
            filename: {
              endsWith: '.pptx'
            }
          },
          {
            filename: {
              endsWith: '.ppt'
            }
          }
        ],
        status: 'completed', // Only process completed uploads
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        encryptedFilename: true,
        isEncrypted: true,
        encryptionIV: true,
        encryptionAuthTag: true,
        userId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${powerpoints.length} PowerPoint files to reprocess\n`);

    if (powerpoints.length === 0) {
      console.log('✅ No PowerPoint files found. Nothing to do!');
      return;
    }

    // Process each PowerPoint
    const results = {
      total: powerpoints.length,
      success: 0,
      failed: 0,
      errors: [] as { filename: string; error: string }[]
    };

    for (let i = 0; i < powerpoints.length; i++) {
      const doc = powerpoints[i];
      console.log(`\n📄 [${i + 1}/${powerpoints.length}] Processing: ${doc.filename}`);

      const result = await reprocessPowerPoint(doc);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          filename: doc.filename,
          error: result.error || 'Unknown error'
        });
      }

      // Add a small delay between files to avoid overwhelming the system
      if (i < powerpoints.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total files: ${results.total}`);
    console.log(`✅ Successfully processed: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(({ filename, error }) => {
        console.log(`  - ${filename}: ${error}`);
      });
    }

    console.log('\n✅ Reprocessing complete!');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n👋 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
