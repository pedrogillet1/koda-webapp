import prisma from './src/config/database';

async function checkFolders() {
  const folders = await prisma.folder.findMany({
    where: { parentFolderId: null },
    select: {
      id: true,
      name: true,
      emoji: true,
      parentFolderId: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log('✅ Root folders in database:', folders.length);
  folders.forEach((f, i) => {
    console.log(`${i + 1}. ${f.emoji || '📁'} "${f.name}" (ID: ${f.id.slice(0, 8)}...)`);
  });
}

checkFolders()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
