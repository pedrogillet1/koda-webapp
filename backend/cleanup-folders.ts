import prisma from './src/config/database';

/**
 * Script to clean up duplicate folders and set correct emojis
 * Run with: npx ts-node cleanup-folders.ts
 */

async function cleanupFolders() {
  console.log('🔍 Analyzing folders...\n');

  // Get all root-level folders
  const allFolders = await prisma.folder.findMany({
    where: { parentFolderId: null },
    include: {
      _count: {
        select: {
          documents: true,
          subfolders: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${allFolders.length} root-level folders:\n`);

  // Group by name
  const foldersByName: { [key: string]: any[] } = {};
  allFolders.forEach(folder => {
    if (!foldersByName[folder.name]) {
      foldersByName[folder.name] = [];
    }
    foldersByName[folder.name].push(folder);
  });

  // Show duplicates
  console.log('📋 Folders grouped by name:\n');
  Object.entries(foldersByName).forEach(([name, folders]) => {
    console.log(`\n"${name}" - ${folders.length} instance(s):`);
    folders.forEach((f, i) => {
      console.log(`  ${i + 1}. ID: ${f.id.slice(0, 8)}... | Emoji: ${f.emoji || 'null'} | Docs: ${f._count.documents} | Subfolders: ${f._count.subfolders}`);
    });
  });

  console.log('\n\n⚠️  RECOMMENDED ACTIONS:\n');
  console.log('Based on your requirements, here are the categories to keep:');
  console.log('1. Receipts (🍆 eggplant emoji)');
  console.log('2. Work Documents (🏠 house emoji)');
  console.log('3. Keep ONE "koda website" folder\n');

  console.log('To proceed with cleanup:');
  console.log('1. Decide which folder IDs to KEEP for each name');
  console.log('2. Update this script with the keeper IDs');
  console.log('3. Run again to execute the cleanup\n');

  // Example cleanup (COMMENTED OUT FOR SAFETY)
  /*
  // Define which folders to keep (update these IDs!)
  const keeperIds = [
    'f84b7ca4-f6e2-4679-989f-9351bd1af6d6', // Receipts with emoji
    'd8f3e1bf-237b-4798-b9be-769d47f7134c', // Work Documents (to update emoji)
    '67d6c695-574e-489f-9b19-ad8555bf6d49', // koda website (has 💰 emoji)
  ];

  // Update emojis for keepers
  await prisma.folder.update({
    where: { id: 'f84b7ca4-f6e2-4679-989f-9351bd1af6d6' },
    data: { emoji: '🍆' } // Receipts
  });

  await prisma.folder.update({
    where: { id: 'd8f3e1bf-237b-4798-b9be-769d47f7134c' },
    data: { emoji: '🏠' } // Work Documents
  });

  await prisma.folder.update({
    where: { id: '67d6c695-574e-489f-9b19-ad8555bf6d49' },
    data: { emoji: '🔥' } // koda website (if you want fire emoji)
  });

  // Delete duplicates (folders not in keeperIds)
  const foldersToDelete = allFolders
    .filter(f => !keeperIds.includes(f.id))
    .map(f => f.id);

  console.log(`\n🗑️  Deleting ${foldersToDelete.length} duplicate folders...`);

  for (const folderId of foldersToDelete) {
    await prisma.folder.delete({
      where: { id: folderId }
    });
  }

  console.log('✅ Cleanup complete!');
  */
}

cleanupFolders()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
