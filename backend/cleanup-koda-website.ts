import prisma from './src/config/database';

async function cleanup() {
  console.log('🗑️  Deleting all "koda website" folders...\n');

  const folders = await prisma.folder.findMany({
    where: {
      name: 'koda website'
    },
    include: {
      documents: true,
      subfolders: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${folders.length} folders named "koda website"`);

  for (const folder of folders) {
    console.log(`\n🗑️  Deleting folder: ${folder.id}`);
    console.log(`   Parent: ${folder.parentFolderId || 'ROOT (category)'}`);
    console.log(`   Documents: ${folder.documents.length}`);
    console.log(`   Subfolders: ${folder.subfolders.length}`);
    console.log(`   Created: ${folder.createdAt}`);

    // Delete all documents in this folder
    if (folder.documents.length > 0) {
      await prisma.document.deleteMany({
        where: { folderId: folder.id }
      });
      console.log(`   ✅ Deleted ${folder.documents.length} documents`);
    }

    // Delete all subfolders recursively
    for (const subfolder of folder.subfolders) {
      await deleteSubfolderRecursive(subfolder.id);
    }

    // Delete the folder itself
    await prisma.folder.delete({
      where: { id: folder.id }
    });
    console.log(`   ✅ Deleted folder`);
  }

  console.log(`\n✅ Cleanup complete! Deleted ${folders.length} "koda website" folders`);
  await prisma.$disconnect();
}

async function deleteSubfolderRecursive(folderId: string) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: {
      documents: true,
      subfolders: true
    }
  });

  if (!folder) return;

  console.log(`   🗑️  Deleting subfolder: ${folder.name}`);

  // Delete documents
  if (folder.documents.length > 0) {
    await prisma.document.deleteMany({
      where: { folderId: folder.id }
    });
  }

  // Delete subfolders recursively
  for (const subfolder of folder.subfolders) {
    await deleteSubfolderRecursive(subfolder.id);
  }

  // Delete the folder
  await prisma.folder.delete({
    where: { id: folder.id }
  });
}

cleanup().catch(console.error);
