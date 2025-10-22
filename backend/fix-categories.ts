import prisma from './src/config/database';

/**
 * Fix categories to match the Documents Hub
 * Based on your actual categories:
 * 1. Receipts (🍆 eggplant)
 * 2. Work Documents (🏠 house)
 * 3. koda website (🔥 fire)
 */

async function fixCategories() {
  console.log('🔧 Fixing categories to match Documents Hub...\n');

  // Step 1: Find all root folders
  const allFolders = await prisma.folder.findMany({
    where: { parentFolderId: null },
    include: {
      _count: {
        select: { documents: true },
      },
    },
  });

  console.log(`Found ${allFolders.length} root-level folders\n`);

  // Step 2: Identify keepers - find the ones with the CORRECT emojis already set
  let receiptsFolder = allFolders.find(f => f.name === 'Receipts' && f.emoji === '🎓');
  let workDocsFolder = allFolders.find(f => f.name === 'Work Documents' && f.emoji === '🏠');
  let kodaWebsiteFolder = allFolders.find(f => f.name === 'koda website' && f.emoji === '💰');

  // If not found with correct emoji, find by name with most documents
  if (!receiptsFolder) {
    const receipts = allFolders.filter(f => f.name === 'Receipts');
    receiptsFolder = receipts.reduce((max, f) => f._count.documents > (max?._count?.documents || 0) ? f : max, receipts[0]);
  }

  if (!workDocsFolder) {
    const workDocs = allFolders.filter(f => f.name === 'Work Documents');
    workDocsFolder = workDocs.reduce((max, f) => f._count.documents > (max?._count?.documents || 0) ? f : max, workDocs[0]);
  }

  if (!kodaWebsiteFolder) {
    const kodaFolders = allFolders.filter(f => f.name === 'koda website');
    kodaWebsiteFolder = kodaFolders.reduce((max, f) => f._count.documents > (max?._count?.documents || 0) ? f : max, kodaFolders[0]);
  }

  console.log('✅ Folders to KEEP (with their current emojis):');
  console.log(`   Receipts: ${receiptsFolder?.id.slice(0, 8)}... (${receiptsFolder?._count.documents} docs) ${receiptsFolder?.emoji || 'no emoji'}`);
  console.log(`   Work Documents: ${workDocsFolder?.id.slice(0, 8)}... (${workDocsFolder?._count.documents} docs) ${workDocsFolder?.emoji || 'no emoji'}`);
  console.log(`   koda website: ${kodaWebsiteFolder?.id.slice(0, 8)}... (${kodaWebsiteFolder?._count.documents} docs) ${kodaWebsiteFolder?.emoji || 'no emoji'}`);

  const keeperIds = [
    receiptsFolder?.id,
    workDocsFolder?.id,
    kodaWebsiteFolder?.id,
  ].filter(Boolean);

  // Step 3: Fix emojis ONLY if they're wrong or missing
  console.log('\n📝 Checking emojis...');

  if (receiptsFolder && receiptsFolder.emoji !== '🎓') {
    await prisma.folder.update({
      where: { id: receiptsFolder.id },
      data: { emoji: '🎓' },
    });
    console.log('   ✓ Receipts → 🎓 (graduation cap)');
  } else {
    console.log('   ✓ Receipts already has correct emoji: 🎓');
  }

  if (workDocsFolder && workDocsFolder.emoji !== '🏠') {
    await prisma.folder.update({
      where: { id: workDocsFolder.id },
      data: { emoji: '🏠' },
    });
    console.log('   ✓ Work Documents → 🏠 (house)');
  } else {
    console.log('   ✓ Work Documents already has correct emoji: 🏠');
  }

  if (kodaWebsiteFolder && kodaWebsiteFolder.emoji !== '💰') {
    await prisma.folder.update({
      where: { id: kodaWebsiteFolder.id },
      data: { emoji: '💰' },
    });
    console.log('   ✓ koda website → 💰 (money bag)');
  } else {
    console.log('   ✓ koda website already has correct emoji: 💰');
  }

  // Step 4: Delete all other root folders
  const foldersToDelete = allFolders.filter(f => !keeperIds.includes(f.id));

  console.log(`\n🗑️  Deleting ${foldersToDelete.length} duplicate/unwanted folders...`);

  for (const folder of foldersToDelete) {
    console.log(`   Deleting: ${folder.name} (${folder._count.documents} docs)`);

    // Move documents from deleted folders to appropriate categories
    if (folder._count.documents > 0) {
      let targetFolderId = null;

      // Try to match by name
      if (folder.name === 'Receipts' && receiptsFolder) {
        targetFolderId = receiptsFolder.id;
      } else if (folder.name === 'Work Documents' && workDocsFolder) {
        targetFolderId = workDocsFolder.id;
      } else if (folder.name === 'koda website' && kodaWebsiteFolder) {
        targetFolderId = kodaWebsiteFolder.id;
      }

      if (targetFolderId) {
        await prisma.document.updateMany({
          where: { folderId: folder.id },
          data: { folderId: targetFolderId },
        });
        console.log(`     → Moved ${folder._count.documents} docs to keeper folder`);
      }
    }

    // Delete the folder
    await prisma.folder.delete({
      where: { id: folder.id },
    });
  }

  console.log('\n✅ Categories fixed! You now have:');
  console.log('   🍆 Receipts');
  console.log('   🏠 Work Documents');
  console.log('   🔥 koda website');
}

fixCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
