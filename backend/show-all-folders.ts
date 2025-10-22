import prisma from './src/config/database';

async function showAllFolders() {
  console.log('=== ALL FOLDERS IN DATABASE ===\n');

  const folders = await prisma.folder.findMany({
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

  console.log(`Total folders: ${folders.length}\n`);

  folders.forEach((f, i) => {
    console.log(`[${i + 1}] "${f.name}"`);
    console.log(`    ID: ${f.id}`);
    console.log(`    Parent: ${f.parentFolderId || 'ROOT (category)'}`);
    console.log(`    Documents: ${f._count.documents}`);
    console.log(`    Subfolders: ${f._count.subfolders}`);
    console.log(`    Created: ${f.createdAt}`);
    console.log('');
  });

  // Show folder hierarchy
  console.log('\n=== FOLDER HIERARCHY ===\n');

  const rootFolders = folders.filter(f => !f.parentFolderId);

  function printFolder(folder: any, indent: string = '') {
    console.log(`${indent}📁 ${folder.name} (${folder._count.documents} docs, ${folder._count.subfolders} subfolders)`);

    const children = folders.filter(f => f.parentFolderId === folder.id);
    children.forEach(child => {
      printFolder(child, indent + '  ');
    });
  }

  rootFolders.forEach(folder => {
    printFolder(folder);
  });

  await prisma.$disconnect();
}

showAllFolders().catch(console.error);
