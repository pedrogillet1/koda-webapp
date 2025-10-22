const { downloadFile } = require('./dist/config/storage');
const { extractText } = require('./dist/services/textExtraction.service');

/**
 * TEST EXTRACTION ISOLATION
 *
 * This script tests if text extraction is properly isolated by:
 * 1. Downloading two different files
 * 2. Extracting text from each
 * 3. Comparing results to see if they're identical (indicating contamination)
 */

async function testExtractionIsolation() {
  console.log('🔬 TESTING TEXT EXTRACTION ISOLATION\n');
  console.log('='.repeat(80));

  try {
    // Test File 1: Pedro's Koda Business Plan (should have business plan content)
    const file1 = {
      name: "Koda Business Plan V12 (1).pdf",
      encryptedFilename: "03ec97ac-1934-4188-8471-524366d87521/426f447f-e4b9-4248-a45f-19c4e260ee1b-1760032254258",
      mimeType: "application/pdf",
      expectedContent: "Business Plan"
    };

    // Test File 2: Alvaro's Chemistry Research (should have chemistry content)
    const file2 = {
      name: "AIR and WATER independent research F3 version.pdf",
      encryptedFilename: "d141ee38-1527-419a-a6ea-5b0ceab3af8b/b2577cc2-0190-48cf-b72a-c9f6d1b71082-1760031593673",
      mimeType: "application/pdf",
      expectedContent: "Air and Water"
    };

    console.log(`\n📄 Test File 1: ${file1.name}`);
    console.log(`   Expected content: "${file1.expectedContent}"`);
    console.log(`   Downloading from: ${file1.encryptedFilename}`);

    const buffer1 = await downloadFile(file1.encryptedFilename);
    console.log(`   Downloaded: ${buffer1.length} bytes`);
    console.log(`   Buffer first 50 bytes: ${buffer1.slice(0, 50).toString('hex')}`);

    console.log(`   Extracting text...`);
    const result1 = await extractText(buffer1, file1.mimeType);
    console.log(`   Extracted ${result1.text.length} characters`);
    console.log(`   Preview: "${result1.text.substring(0, 150)}..."\n`);

    console.log(`\n📄 Test File 2: ${file2.name}`);
    console.log(`   Expected content: "${file2.expectedContent}"`);
    console.log(`   Downloading from: ${file2.encryptedFilename}`);

    const buffer2 = await downloadFile(file2.encryptedFilename);
    console.log(`   Downloaded: ${buffer2.length} bytes`);
    console.log(`   Buffer first 50 bytes: ${buffer2.slice(0, 50).toString('hex')}`);

    console.log(`   Extracting text...`);
    const result2 = await extractText(buffer2, file2.mimeType);
    console.log(`   Extracted ${result2.text.length} characters`);
    console.log(`   Preview: "${result2.text.substring(0, 150)}..."\n`);

    console.log('='.repeat(80));
    console.log('\n🔍 COMPARISON RESULTS:\n');

    console.log(`   File 1 text length: ${result1.text.length}`);
    console.log(`   File 2 text length: ${result2.text.length}`);
    console.log(`   File 1 hash: ${hashString(result1.text.substring(0, 500))}`);
    console.log(`   File 2 hash: ${hashString(result2.text.substring(0, 500))}`);

    const preview1 = result1.text.substring(0, 200);
    const preview2 = result2.text.substring(0, 200);

    if (preview1 === preview2) {
      console.log('\n   ❌ CONTAMINATION DETECTED!');
      console.log('   ❌ Both files returned IDENTICAL text');
      console.log('   ❌ This indicates extraction is NOT properly isolated\n');

      console.log('   🔍 Shared text:');
      console.log(`   "${preview1}..."\n`);
    } else {
      console.log('\n   ✅ NO CONTAMINATION');
      console.log('   ✅ Files returned different text');
      console.log('   ✅ Extraction appears to be properly isolated\n');

      console.log('   📄 File 1 content:');
      console.log(`   "${preview1}..."\n`);
      console.log('   📄 File 2 content:');
      console.log(`   "${preview2}..."\n`);
    }

    // Check if content matches expectations
    console.log('='.repeat(80));
    console.log('\n✅ CONTENT VALIDATION:\n');

    const file1HasExpected = result1.text.toLowerCase().includes(file1.expectedContent.toLowerCase());
    const file2HasExpected = result2.text.toLowerCase().includes(file2.expectedContent.toLowerCase());

    console.log(`   File 1 contains "${file1.expectedContent}": ${file1HasExpected ? '✅ YES' : '❌ NO'}`);
    console.log(`   File 2 contains "${file2.expectedContent}": ${file2HasExpected ? '✅ YES' : '❌ NO'}\n`);

    if (!file1HasExpected || !file2HasExpected) {
      console.log('   ⚠️  WARNING: Expected content not found in extracted text');
      console.log('   ⚠️  This suggests the wrong file was downloaded or extraction failed\n');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error(error.stack);
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

testExtractionIsolation()
  .then(() => {
    console.log('\nTest complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });
