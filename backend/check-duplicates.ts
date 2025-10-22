import prisma from './src/config/database';

async function cleanupDuplicates() {
  console.log('Checking for duplicate folders...\n');

  // Get all folders
  const folders = await prisma.folder.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      parentFolderId: true,
      createdAt: true,
      userId: true
    }
  });

  console.log('Total folders:', folders.length);
  console.log('\nAll folders:');
  folders.forEach(f => {
    console.log(`  ${f.name} (parent: ${f.parentFolderId || 'root'}) - ${f.id}`);
  });

  await prisma.$disconnect();
}

cleanupDuplicates().catch(console.error);
