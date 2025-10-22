import prisma from './src/config/database';

async function checkFolders() {
  console.log('Checking folder structure and documents...\n');

  const folders = await prisma.folder.findMany({
    where: { name: { contains: 'koda' } },
    include: {
      _count: {
        select: { documents: true, subfolders: true }
      }
    }
  });

  console.log('Koda website folders:');
  folders.forEach(f => {
    console.log('  - ' + f.name + ' (ID: ' + f.id.substring(0, 8) + '...)');
    console.log('    Parent: ' + (f.parentFolderId || 'null'));
    console.log('    Documents: ' + f._count.documents + ', Subfolders: ' + f._count.subfolders);
  });

  console.log('\nChecking recent documents...');
  const docs = await prisma.document.findMany({
    where: {
      filename: {
        in: ['example.jpg', 'logo.jpg', 'coming soon.jpg', 'example 2.jpg']
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('Documents:');
  docs.forEach(d => {
    console.log('  - ' + d.filename + ' -> folderId: ' + (d.folderId ? d.folderId.substring(0, 8) + '...' : 'null'));
  });

  await prisma.$disconnect();
}

checkFolders();
