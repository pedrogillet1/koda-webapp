import prisma from './src/config/database';
import { downloadFile } from './src/config/storage';
import * as textExtractionService from './src/services/textExtraction.service';

async function verifyLoneMountain() {
  console.log('\n🔍 VERIFYING LONE MOUNTAIN RANCH FILE\n');

  const doc = await prisma.document.findFirst({
    where: { filename: { contains: 'Lone Mountain' } },
    select: {
      id: true,
      filename: true,
      encryptedFilename: true,
      mimeType: true,
      fileHash: true
    }
  });

  if (!doc) {
    console.log('❌ Lone Mountain Ranch document not found');
    await prisma.$disconnect();
    return;
  }

  console.log('📄 Document:', doc.filename);
  console.log('🆔 ID:', doc.id);
  console.log('#️⃣  File Hash:', doc.fileHash);

  try {
    // Download the actual file
    console.log('\n⬇️  Downloading file from storage...');
    const fileBuffer = await downloadFile(doc.encryptedFilename);
    console.log(`   ✅ Downloaded ${fileBuffer.length} bytes (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Extract text directly from the downloaded file
    console.log('\n🔍 Extracting text from downloaded file...');
    const extractionResult = await textExtractionService.extractText(fileBuffer, doc.mimeType);

    console.log(`   📏 Extracted ${extractionResult.text.length} characters`);
    console.log(`   📝 Word Count: ${extractionResult.wordCount || 0}`);
    console.log(`   📄 Page Count: ${extractionResult.pageCount || 0}`);

    // Check if it contains Montana text
    const hasMontanaText = extractionResult.text.includes('Montana Rocking CC Sanctuary');
    console.log(`   🔍 Contains "Montana Rocking CC Sanctuary": ${hasMontanaText ? '✅ YES' : '❌ NO'}`);

    // Check for expected P&L content
    const hasExpectedContent = extractionResult.text.includes('Lone Mountain') ||
                               extractionResult.text.includes('Revenue') ||
                               extractionResult.text.includes('EBITDA') ||
                               extractionResult.text.includes('Budget');
    console.log(`   🔍 Contains expected P&L content: ${hasExpectedContent ? '✅ YES' : '❌ NO'}`);

    // Show first 500 chars
    console.log('\n   📝 First 500 characters:');
    console.log('   ' + '─'.repeat(78));
    console.log('   ' + extractionResult.text.substring(0, 500).replace(/\n/g, '\n   '));
    console.log('   ' + '─'.repeat(78));

    // Verdict
    if (hasMontanaText && !hasExpectedContent) {
      console.log('\n   ⚠️  CONTAMINATED: File contains Montana text but no P&L content!');
    } else if (hasMontanaText && hasExpectedContent) {
      console.log('\n   ⚠️  MIXED CONTENT: File contains BOTH Montana text AND P&L content!');
      console.log('   This suggests Montana text was prepended to the P&L data.');

      // Find where Montana text ends
      const montanaEndIndex = extractionResult.text.indexOf('Lone Mountain');
      if (montanaEndIndex > 0) {
        console.log(`\n   📊 Montana text appears to end at character ${montanaEndIndex}`);
        console.log(`   Montana section: ${montanaEndIndex} chars (${((montanaEndIndex / extractionResult.text.length) * 100).toFixed(1)}%)`);
        console.log(`   P&L section: ${extractionResult.text.length - montanaEndIndex} chars (${(((extractionResult.text.length - montanaEndIndex) / extractionResult.text.length) * 100).toFixed(1)}%)`);
      }
    } else if (!hasMontanaText && hasExpectedContent) {
      console.log('\n   ✅ CLEAN: File contains only P&L content (CORRECT)');
    } else {
      console.log('\n   ❓ UNKNOWN: File does not contain expected content');
    }

  } catch (error: any) {
    console.error(`\n   ❌ Error: ${error.message}`);
  }

  await prisma.$disconnect();
}

verifyLoneMountain();
