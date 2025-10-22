import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

async function deletePersonalIdFiles() {
  try {
    console.log('🔍 Searching for Personal ID files...');

    // Find all folders with "Personal ID" in the name
    const personalIdFolders = await prisma.folder.findMany({
      where: {
        name: {
          contains: 'Personal ID',
        },
      },
      include: {
        documents: true,
      },
    });

    console.log(`📁 Found ${personalIdFolders.length} Personal ID folders`);

    // Find all documents in Personal ID folders
    let documentsToDelete = [];

    for (const folder of personalIdFolders) {
      documentsToDelete.push(...folder.documents);
    }

    // Also find documents with "Personal ID" in the filename
    const personalIdDocuments = await prisma.document.findMany({
      where: {
        filename: {
          contains: 'Personal ID',
        },
      },
    });

    console.log(`📄 Found ${personalIdDocuments.length} documents with "Personal ID" in filename`);

    // Combine both lists (avoid duplicates)
    const allDocIds = new Set([
      ...documentsToDelete.map(d => d.id),
      ...personalIdDocuments.map(d => d.id),
    ]);

    console.log(`\n📊 Total unique documents to delete: ${allDocIds.size}`);

    if (allDocIds.size === 0) {
      console.log('✅ No Personal ID files found to delete');
      return;
    }

    // Get full document details for deletion
    const documents = await prisma.document.findMany({
      where: {
        id: {
          in: Array.from(allDocIds),
        },
      },
    });

    console.log('\n📝 Documents to be deleted:');
    documents.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.filename} (ID: ${doc.id})`);
    });

    // Delete related data first
    console.log('\n🗑️  Deleting related data...');

    // Delete document metadata
    await prisma.documentMetadata.deleteMany({
      where: {
        documentId: {
          in: Array.from(allDocIds),
        },
      },
    });
    console.log('✅ Deleted document metadata');

    // Delete document tags
    await prisma.documentTag.deleteMany({
      where: {
        documentId: {
          in: Array.from(allDocIds),
        },
      },
    });
    console.log('✅ Deleted document tags');

    // Delete document summaries
    await prisma.documentSummary.deleteMany({
      where: {
        documentId: {
          in: Array.from(allDocIds),
        },
      },
    });
    console.log('✅ Deleted document summaries');

    // Delete physical files
    console.log('\n🗑️  Deleting physical files...');
    const uploadsDir = path.join(__dirname, '..', 'uploads');

    for (const doc of documents) {
      try {
        const filePath = path.join(uploadsDir, doc.encryptedFilename);
        await fs.unlink(filePath);
        console.log(`✅ Deleted file: ${doc.encryptedFilename}`);
      } catch (error) {
        console.log(`⚠️  Could not delete file ${doc.encryptedFilename}:`, (error as Error).message);
      }
    }

    // Delete documents from database
    console.log('\n🗑️  Deleting documents from database...');
    const deleteResult = await prisma.document.deleteMany({
      where: {
        id: {
          in: Array.from(allDocIds),
        },
      },
    });

    console.log(`✅ Deleted ${deleteResult.count} documents from database`);

    // Delete empty Personal ID folders
    console.log('\n🗑️  Deleting empty Personal ID folders...');
    for (const folder of personalIdFolders) {
      // Check if folder is now empty
      const remainingDocs = await prisma.document.count({
        where: { folderId: folder.id },
      });

      const remainingSubfolders = await prisma.folder.count({
        where: { parentFolderId: folder.id },
      });

      if (remainingDocs === 0 && remainingSubfolders === 0) {
        await prisma.folder.delete({
          where: { id: folder.id },
        });
        console.log(`✅ Deleted empty folder: ${folder.name}`);
      } else {
        console.log(`⚠️  Folder "${folder.name}" still has content, skipping deletion`);
      }
    }

    console.log('\n✅ Personal ID files deletion completed!');
  } catch (error) {
    console.error('❌ Error deleting Personal ID files:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deletePersonalIdFiles()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
