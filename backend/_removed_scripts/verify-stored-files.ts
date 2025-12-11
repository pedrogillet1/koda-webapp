import prisma from './src/config/database';
import { downloadFile } from './src/config/storage';
import * as textExtractionService from './src/services/textExtraction.service';

async function verifyStoredFiles() {
  console.log('\n🔍 VERIFYING ACTUAL STORED FILES\n');

  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { filename: { contains: 'Montana' } },
        { filename: { contains: 'Baxter Main' } }
      ]
    },
    select: {
      id: true,
      filename: true,
      encryptedFilename: true,
      mimeType: true,
      fileHash: true
    }
  });

  for (const doc of docs) {
    console.log('─'.repeat(80));
    console.log(`📄 ${doc.filename}`);
    console.log(`🆔 ID: ${doc.id}`);
    console.log(`#️⃣  File Hash: ${doc.fileHash}`);

    try {
      // Download the actual file
      console.log('\n⬇️  Downloading file from storage...');
      const fileBuffer = await downloadFile(doc.encryptedFilename);
      console.log(`   ✅ Downloaded ${fileBuffer.length} bytes`);

      // Extract text directly from the downloaded file
      console.log('\n🔍 Extracting text from downloaded file...');
      const extractionResult = await textExtractionService.extractText(fileBuffer, doc.mimeType);

      console.log(`   📏 Extracted ${extractionResult.text.length} characters`);
      console.log(`   📝 Word Count: ${extractionResult.wordCount || 0}`);

      // Check if it contains Montana text
      const hasMontanaText = extractionResult.text.includes('Montana Rocking CC Sanctuary');
      console.log(`   🔍 Contains "Montana Rocking CC Sanctuary": ${hasMontanaText ? '✅ YES' : '❌ NO'}`);

      // Show first 200 chars
      console.log('\n   📝 First 200 characters:');
      console.log(`   "${extractionResult.text.substring(0, 200)}..."`);

      // Check if file matches its supposed content
      if (doc.filename.includes('Montana') && !hasMontanaText) {
        console.log('\n   ⚠️  WARNING: Montana file does NOT contain Montana text!');
      } else if (doc.filename.includes('Baxter') && hasMontanaText) {
        console.log('\n   ⚠️  WARNING: Baxter file INCORRECTLY contains Montana text!');
        console.log('   This means the STORED FILE itself is wrong, not just the metadata!');
      } else if (doc.filename.includes('Montana') && hasMontanaText) {
        console.log('\n   ✅ Montana file is correct');
      } else if (doc.filename.includes('Baxter') && !hasMontanaText) {
        console.log('\n   ✅ Baxter file is correct');
      }

    } catch (error: any) {
      console.error(`\n   ❌ Error: ${error.message}`);
    }

    console.log('');
  }

  console.log('─'.repeat(80));

  await prisma.$disconnect();
}

verifyStoredFiles();
