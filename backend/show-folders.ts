import prisma from './src/config/database';

async function showFolders() {
  console.log('All folders named "koda website":\n');

  const folders = await prisma.folder.findMany({
    where: {
      name: 'koda website'
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      parentFolderId: true,
      createdAt: true,
      _count: {
        select: {
          documents: true,
          subfolders: true
        }
      }
    }
  });

  folders.forEach((f, i) => {
    console.log(`[${i + 1}] ID: ${f.id}`);
    console.log(`    Parent: ${f.parentFolderId || 'ROOT (this is a category)'}`);
    console.log(`    Documents: ${f._count.documents}`);
    console.log(`    Subfolders: ${f._count.subfolders}`);
    console.log(`    Created: ${f.createdAt}`);
    console.log('');
  });

  await prisma.$disconnect();
}

showFolders().catch(console.error);
