/**
 * Test script for PPTX slide generation
 * Run with: npx ts-node scripts/test-slide-generation.ts
 */

import { pptxSlideGeneratorService } from '../src/services/pptxSlideGenerator.service';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSlideGeneration() {
  console.log('🧪 Testing PPTX Slide Generation\n');

  try {
    // 1. Check LibreOffice installation
    console.log('Step 1: Checking LibreOffice installation...');
    const libreOfficeCheck = await pptxSlideGeneratorService.checkLibreOffice();
    console.log(libreOfficeCheck.message);

    if (!libreOfficeCheck.installed) {
      console.error('\n❌ LibreOffice is not installed. Please install it from:');
      console.error('   https://www.libreoffice.org/download/download-libreoffice/\n');
      process.exit(1);
    }

    console.log('\n✅ LibreOffice is installed and ready!\n');

    // 2. Find a PPTX document in the database
    console.log('Step 2: Finding PPTX documents in database...');
    const pptxDocuments = await prisma.document.findMany({
      where: {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'completed'
      },
      take: 1,
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (pptxDocuments.length === 0) {
      console.error('❌ No PPTX documents found in database');
      console.log('Please upload a PowerPoint file first\n');
      process.exit(1);
    }

    const document = pptxDocuments[0];
    console.log(`✅ Found document: ${document.filename}`);
    console.log(`   ID: ${document.id}`);
    console.log(`   Path: ${document.encryptedFilename}\n`);

    // 3. Download file from GCS to temp location
    console.log('Step 3: Downloading file from GCS...');
    const { bucket } = await import('../src/config/storage');

    if (!bucket) {
      console.error('❌ GCS not configured');
      process.exit(1);
    }

    const tempFilePath = path.join(process.cwd(), 'temp', `${document.id}.pptx`);
    const tempDir = path.dirname(tempFilePath);

    if (!require('fs').existsSync(tempDir)) {
      require('fs').mkdirSync(tempDir, { recursive: true });
    }

    const file = bucket.file(document.encryptedFilename);
    await file.download({ destination: tempFilePath });
    console.log(`✅ Downloaded to: ${tempFilePath}\n`);

    // 4. Generate slide images
    console.log('Step 4: Generating slide images...');
    console.log('This may take a minute or two...\n');

    const result = await pptxSlideGeneratorService.generateSlideImages(
      tempFilePath,
      document.id,
      {
        uploadToGCS: true, // Set to false to test without uploading
        maxWidth: 1920,
        quality: 90
      }
    );

    if (!result.success) {
      console.error(`❌ Failed to generate slides: ${result.error}\n`);
      process.exit(1);
    }

    console.log('\n✅ Slide generation successful!\n');
    console.log(`📊 Generated ${result.totalSlides} slides:\n`);

    // Display results
    result.slides?.forEach(slide => {
      console.log(`Slide ${slide.slideNumber}:`);
      console.log(`  - Size: ${slide.width}x${slide.height}`);
      console.log(`  - Local: ${slide.localPath}`);
      if (slide.publicUrl) {
        console.log(`  - URL: ${slide.publicUrl}`);
      }
      console.log('');
    });

    // 4. Update database with slide data
    console.log('Step 4: Updating database with slide URLs...');

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

    console.log('✅ Database updated with slide URLs\n');

    console.log('🎉 Test completed successfully!');
    console.log(`\nYou can now view the slides at:`);
    console.log(`http://localhost:3000/documents/${document.id}\n`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testSlideGeneration();
