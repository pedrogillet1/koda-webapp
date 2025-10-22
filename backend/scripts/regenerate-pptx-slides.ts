/**
 * Regenerate slide images for existing PPTX documents
 * Run with: npx ts-node scripts/regenerate-pptx-slides.ts
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function regeneratePPTXSlides() {
  console.log('🔄 Regenerating slide images for existing PPTX documents\n');

  try {
    // Find all PPTX documents
    console.log('Step 1: Finding PPTX documents in database...');
    const pptxDocuments = await prisma.document.findMany({
      where: {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'completed'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (pptxDocuments.length === 0) {
      console.log('❌ No PPTX documents found in database');
      process.exit(0);
    }

    console.log(`✅ Found ${pptxDocuments.length} PPTX documents\n`);

    // Import services
    const { bucket } = await import('../src/config/storage');
    const { pptxSlideGeneratorService } = await import('../src/services/pptxSlideGenerator.service');

    if (!bucket) {
      console.error('❌ GCS not configured');
      process.exit(1);
    }

    // Process each document
    let successCount = 0;
    let failCount = 0;

    for (const document of pptxDocuments) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 Processing: ${document.filename}`);
      console.log(`   ID: ${document.id}`);
      console.log(`   Path: ${document.encryptedFilename}`);

      try {
        // Download file from GCS to temp location
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `${document.id}.pptx`);

        console.log('   ⬇️  Downloading from GCS...');
        const file = bucket.file(document.encryptedFilename);
        await file.download({ destination: tempFilePath });
        console.log(`   ✅ Downloaded to: ${tempFilePath}`);

        // Generate slide images
        console.log('   🎨 Generating slide images...');
        const result = await pptxSlideGeneratorService.generateSlideImages(
          tempFilePath,
          document.id,
          {
            uploadToGCS: true,
            maxWidth: 1920,
            quality: 90
          }
        );

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }

        if (!result.success) {
          console.error(`   ❌ Failed: ${result.error}`);
          failCount++;
          continue;
        }

        // Update database with slide data
        console.log('   💾 Updating database...');
        const slidesData = result.slides?.map(slide => ({
          slideNumber: slide.slideNumber,
          imageUrl: slide.publicUrl,
          width: slide.width,
          height: slide.height
        }));

        await prisma.documentMetadata.update({
          where: {
            documentId: document.id
          },
          data: {
            slidesData: JSON.stringify(slidesData)
          }
        });

        console.log(`   ✅ Successfully generated ${result.totalSlides} slides`);
        successCount++;

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('\n📊 Summary:');
    console.log(`   Total documents: ${pptxDocuments.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n🎉 Regeneration complete!');

  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run regeneration
regeneratePPTXSlides();
