import { PrismaClient } from './src/generated/prisma';
import { generateThumbnail } from './src/services/thumbnail.service';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import os from 'os';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE,
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');

async function regenerateThumbnails() {
  console.log('🔄 Starting thumbnail regeneration...');

  try {
    // Get all documents
    const documents = await prisma.document.findMany({
      include: {
        metadata: true,
      },
    });

    console.log(`📄 Found ${documents.length} documents`);

    let processed = 0;
    let skipped = 0;
    let generated = 0;

    for (const doc of documents) {
      processed++;
      console.log(`\n[${processed}/${documents.length}] Processing: ${doc.filename}`);

      // Skip if already has thumbnail
      if (doc.metadata?.thumbnailUrl) {
        console.log('  ⏭️  Already has thumbnail, skipping');
        skipped++;
        continue;
      }

      // Download document to temp file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `temp-${doc.id}${path.extname(doc.filename)}`);

      try {
        await bucket.file(doc.encryptedFilename).download({ destination: tempFile });

        // Generate thumbnail
        console.log(`  🖼️  Generating thumbnail for ${doc.mimeType}...`);
        const thumbnailPath = await generateThumbnail(tempFile, doc.mimeType);

        if (thumbnailPath) {
          // Update metadata
          if (doc.metadata) {
            await prisma.documentMetadata.update({
              where: { id: doc.metadata.id },
              data: { thumbnailUrl: thumbnailPath },
            });
          } else {
            await prisma.documentMetadata.create({
              data: {
                documentId: doc.id,
                thumbnailUrl: thumbnailPath,
              },
            });
          }

          console.log(`  ✅ Thumbnail generated and saved`);
          generated++;
        } else {
          console.log(`  ⚠️  Thumbnail generation not supported for this file type`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing document:`, error);
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }

    console.log(`\n✨ Done!`);
    console.log(`  Total documents: ${documents.length}`);
    console.log(`  Generated: ${generated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Failed: ${processed - generated - skipped}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

regenerateThumbnails();
