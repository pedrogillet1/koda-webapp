/**
 * Migration Script: Supabase Storage → AWS S3
 *
 * This script migrates all existing files from Supabase Storage to AWS S3
 *
 * Usage:
 *   npx ts-node scripts/migrate-supabase-to-s3.ts
 */

import 'dotenv/config';
import prisma from '../src/config/database';
import { createClient } from '@supabase/supabase-js';
import s3StorageService from '../src/services/s3Storage.service';

const SUPABASE_BUCKET = 'documents';
const BATCH_SIZE = 10; // Migrate 10 files at a time

// Initialize Supabase client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateFiles() {
  console.log('🚀 Starting migration from Supabase to S3...\n');

  try {
    // Get all documents from database
    const documents = await prisma.document.findMany({
      where: {
        status: 'completed'
      },
      select: {
        id: true,
        encryptedFilename: true,
        mimeType: true,
        filename: true
      }
    });

    console.log(`📊 Found ${documents.length} documents to migrate\n`);

    if (documents.length === 0) {
      console.log('✅ No documents to migrate. Exiting...');
      return;
    }

    let migratedCount = 0;
    let failedCount = 0;
    const failedFiles: string[] = [];

    // Process in batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);

      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}...`);

      await Promise.all(
        batch.map(async (doc) => {
          try {
            console.log(`  📄 Migrating: ${doc.filename} (${doc.encryptedFilename})`);

            // 1. Download from Supabase
            const { data, error } = await supabase.storage
              .from(SUPABASE_BUCKET)
              .download(doc.encryptedFilename);

            if (error) {
              throw new Error(`Supabase download failed: ${error.message}`);
            }

            if (!data) {
              throw new Error('No data returned from Supabase');
            }

            // Convert Blob to Buffer
            const arrayBuffer = await data.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuffer);

            // 2. Upload to S3
            await s3StorageService.uploadFile(
              doc.encryptedFilename,
              fileBuffer,
              doc.mimeType
            );

            // 3. Verify upload
            const exists = await s3StorageService.fileExists(doc.encryptedFilename);
            if (!exists) {
              throw new Error('File not found in S3 after upload');
            }

            console.log(`  ✅ Migrated: ${doc.filename}`);
            migratedCount++;
          } catch (error: any) {
            console.error(`  ❌ Failed: ${doc.filename} - ${error.message}`);
            failedFiles.push(doc.filename);
            failedCount++;
          }
        })
      );

      // Small delay between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount} files`);
    console.log(`  ❌ Failed: ${failedCount} files`);

    if (failedFiles.length > 0) {
      console.log('\n❌ Failed files:');
      failedFiles.forEach(file => console.log(`  - ${file}`));
    }

    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  IMPORTANT: Test the application thoroughly before deleting Supabase files!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateFiles()
  .then(() => {
    console.log('\n👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
