import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixCorruptedDoc() {
  console.log('\n🔍 Identifying corrupted/duplicate documents...\n');

  // The corrupted Business Plan PDF that contains merged content
  const corruptedId = 'df64c6f3-7cca-48bf-ab81-4b5fb3cfe232';

  const doc = await prisma.document.findUnique({
    where: { id: corruptedId },
    include: { metadata: true },
  });

  if (!doc) {
    console.log('❌ Document not found!');
    return;
  }

  console.log(`📄 Found corrupted document:`);
  console.log(`   Filename: ${doc.filename}`);
  console.log(`   ID: ${doc.id}`);
  console.log(`   File Size: ${doc.fileSize} bytes`);
  console.log(`   Contains: Psychiatric content + Comprovante + Business Plan (MERGED!)`);
  console.log(``);

  console.log(`🗑️  Deleting corrupted document...`);

  // Delete metadata first
  if (doc.metadata) {
    await prisma.documentMetadata.delete({
      where: { id: doc.metadata.id },
    });
    console.log(`   ✅ Deleted metadata`);
  }

  // Delete document
  await prisma.document.delete({
    where: { id: corruptedId },
  });
  console.log(`   ✅ Deleted document`);

  console.log(``);
  console.log(`✅ Cleanup complete!`);
  console.log(``);
  console.log(`📊 Summary:`);
  console.log(`   - Removed 1 corrupted document`);
  console.log(`   - Now when you search for "comprovante", you should see only the correct documents`);
  console.log(``);

  // Verify the fix
  console.log(`🔍 Verifying fix - searching for documents matching "comprovante"...`);
  const searchResults = await prisma.document.findMany({
    where: {
      OR: [
        { filename: { contains: 'comprovante' } },
        {
          metadata: {
            extractedText: { contains: 'comprovante' },
          },
        },
      ],
    },
    include: {
      metadata: true,
      folder: true,
    },
  });

  console.log(`\n📝 Search results (${searchResults.length} documents):`);
  for (const result of searchResults) {
    console.log(`   - ${result.filename} (${result.folder?.name || 'Root'})`);
  }

  await prisma.$disconnect();
}

fixCorruptedDoc().catch(console.error);
