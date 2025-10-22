import { PrismaClient } from '@prisma/client';
import { downloadFile } from '../src/config/storage';
import * as textExtractionService from '../src/services/textExtraction.service';

const prisma = new PrismaClient();

async function fixBizPlanDB() {
  console.log('\n🔧 FIXING KODA BUSINESS PLAN DATABASE ENTRY\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const docId = 'df64c6f3-7cca-48bf-ab81-4b5fb3cfe232';

  // Fetch document
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { metadata: true }
  });

  if (!doc || !doc.metadata) {
    console.log('❌ Document or metadata not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`📄 Document: ${doc.filename}`);
  console.log(`   Current extracted text length: ${doc.metadata.extractedText?.length || 0} chars\n`);

  // Download actual file from GCS
  console.log(`📥 Downloading file from GCS: ${doc.encryptedFilename}...`);
  const fileBuffer = await downloadFile(doc.encryptedFilename);
  console.log(`✅ Downloaded ${fileBuffer.length} bytes\n`);

  // Extract text using current (working) pdf-parse
  console.log(`🔄 Extracting text with pdf-parse...`);
  const extractionResult = await textExtractionService.extractText(
    fileBuffer,
    doc.mimeType
  );

  const newText = extractionResult.text;
  console.log(`✅ Extracted ${newText.length} characters\n`);

  console.log(`📝 First 300 characters of NEW extraction:`);
  console.log(`   "${newText.substring(0, 300)}"\n`);

  console.log(`📝 Last 200 characters of NEW extraction:`);
  console.log(`   "${newText.substring(newText.length - 200)}"\n`);

  // Content check
  const hasComprovante = newText.toLowerCase().includes('comprovante');
  const hasPsych = newText.includes('AGITAÇÃO PSICOMOTORA');
  const hasBizPlan = newText.toLowerCase().includes('business plan');

  console.log(`🔍 NEW EXTRACTION CONTENT:`);
  console.log(`   Contains "comprovante": ${hasComprovante ? 'YES ⚠️' : 'NO ✅'}`);
  console.log(`   Contains psychiatric content: ${hasPsych ? 'YES ⚠️' : 'NO ✅'}`);
  console.log(`   Contains business plan: ${hasBizPlan ? 'YES ✅' : 'NO ❌'}\n`);

  // Compare with current database
  const oldText = doc.metadata.extractedText || '';
  const textChanged = oldText !== newText;

  console.log(`📊 COMPARISON:`);
  console.log(`   Old DB text length: ${oldText.length} chars`);
  console.log(`   New extracted length: ${newText.length} chars`);
  console.log(`   Changed: ${textChanged ? 'YES' : 'NO'}\n`);

  if (!textChanged) {
    console.log('✅ Text already matches - no update needed\n');
    await prisma.$disconnect();
    return;
  }

  // Update database
  console.log(`💾 Updating database with clean extracted text...`);

  await prisma.documentMetadata.update({
    where: { id: doc.metadata.id },
    data: {
      extractedText: newText,
      ocrConfidence: extractionResult.confidence || doc.metadata.ocrConfidence,
      updatedAt: new Date()
    }
  });

  console.log('✅ Database updated successfully!\n');

  // Verify the update
  const updated = await prisma.documentMetadata.findUnique({
    where: { id: doc.metadata.id }
  });

  if (updated?.extractedText === newText) {
    console.log('✅ VERIFICATION: Database now contains correct text!');
    console.log(`   Length: ${updated.extractedText.length} chars`);
    console.log(`   First 200 chars: "${updated.extractedText.substring(0, 200)}"\n`);
  } else {
    console.log('❌ VERIFICATION FAILED: Database update may not have worked\n');
  }

  await prisma.$disconnect();
}

fixBizPlanDB().catch(console.error);
