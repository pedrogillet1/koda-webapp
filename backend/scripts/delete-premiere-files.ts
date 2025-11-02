import { PrismaClient } from '@prisma/client';
import { deleteFile } from '../src/config/storage';

const prisma = new PrismaClient();

async function deletePremiereFiles() {
  try {
    console.log('🔍 Finding Adobe Premiere files...\n');

    // Find all documents with Adobe Premiere extensions
    const premiereFiles = await prisma.document.findMany({
      where: {
        OR: [
          { filename: { endsWith: '.prproj' } },
          { filename: { endsWith: '.pek' } },
          { filename: { endsWith: '.cfa' } },
          { filename: { contains: 'Premiere' } },
        ],
      },
      select: {
        id: true,
        filename: true,
        encryptedFilename: true,
        mimeType: true,
      },
    });

    if (premiereFiles.length === 0) {
      console.log('✅ No Adobe Premiere files found.');
      return;
    }

    console.log(`Found ${premiereFiles.length} Adobe Premiere file(s):\n`);
    premiereFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.filename} (ID: ${file.id})`);
    });

    console.log('\n🗑️  Deleting files...\n');

    let successCount = 0;
    let failCount = 0;

    for (const file of premiereFiles) {
      try {
        // Delete from GCS
        if (file.encryptedFilename) {
          try {
            await deleteFile(file.encryptedFilename);
            console.log(`  ✅ Deleted from GCS: ${file.filename}`);
          } catch (gcsError) {
            console.warn(`  ⚠️  GCS deletion failed (file may not exist): ${file.filename}`);
          }
        }

        // Delete from database
        await prisma.document.delete({
          where: { id: file.id },
        });

        console.log(`  ✅ Deleted from database: ${file.filename}`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to delete: ${file.filename}`, error);
        failCount++;
      }
    }

    console.log(`\n✅ Deletion complete!`);
    console.log(`   Successfully deleted: ${successCount}`);
    if (failCount > 0) {
      console.log(`   Failed: ${failCount}`);
    }
    console.log('\n📤 You can now re-upload these files with their original names.');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deletePremiereFiles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
