import prisma from './src/config/database';

async function cleanupSubfolders() {
  console.log('🗑️  Cleaning up ALL subfolders inside "koda website" category...\n');

  // Find the ROOT "koda website" category (the one with parentFolderId = null)
  const rootCategory = await prisma.folder.findFirst({
    where: {
      name: 'koda website',
      parentFolderId: null
    },
    include: {
      subfolders: {
        include: {
          documents: true,
          subfolders: true
        }
      },
      documents: true
    }
  });

  if (!rootCategory) {
    console.log('❌ No "koda website" root category found');
    return;
  }

  console.log(`Found ROOT category: ${rootCategory.id}`);
  console.log(`  Direct subfolders: ${rootCategory.subfolders.length}`);
  console.log(`  Direct documents: ${rootCategory.documents.length}\n`);

  // Function to recursively delete a folder and all its contents
  async function deleteFolderRecursive(folderId: string, folderName: string, indent: string = '') {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        documents: true,
        subfolders: true
      }
    });

    if (!folder) return;

    console.log(`${indent}🗑️  Deleting "${folderName}" (${folder.documents.length} docs, ${folder.subfolders.length} subfolders)`);

    // Delete all documents in this folder
    if (folder.documents.length > 0) {
      await prisma.document.deleteMany({
        where: { folderId: folder.id }
      });
      console.log(`${indent}   ✅ Deleted ${folder.documents.length} documents`);
    }

    // Recursively delete all subfolders
    for (const subfolder of folder.subfolders) {
      await deleteFolderRecursive(subfolder.id, subfolder.name, indent + '  ');
    }

    // Delete the folder itself
    await prisma.folder.delete({
      where: { id: folderId }
    });
    console.log(`${indent}   ✅ Deleted folder "${folderName}"`);
  }

  // Delete all subfolders of the root category
  for (const subfolder of rootCategory.subfolders) {
    await deleteFolderRecursive(subfolder.id, subfolder.name, '  ');
  }

  // Delete all documents in the root category
  if (rootCategory.documents.length > 0) {
    await prisma.document.deleteMany({
      where: { folderId: rootCategory.id }
    });
    console.log(`\n✅ Deleted ${rootCategory.documents.length} documents from root category`);
  }

  console.log(`\n✅ Cleanup complete! The "koda website" category is now empty and ready for a fresh upload.`);
  console.log(`   Category ID: ${rootCategory.id}`);

  await prisma.$disconnect();
}

cleanupSubfolders().catch(console.error);
