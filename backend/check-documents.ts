import prisma from './src/config/database';

async function checkDocuments() {
  console.log('Checking recently uploaded documents...\n');

  // Get the most recent 15 documents (the ones just uploaded)
  const recentDocs = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      filename: true,
      folderId: true,
      createdAt: true,
      folder: {
        select: {
          id: true,
          name: true,
          parentFolderId: true
        }
      }
    }
  });

  console.log('Recent documents:');
  recentDocs.forEach(doc => {
    console.log(`  File: ${doc.filename}`);
    console.log(`  folderId: ${doc.folderId}`);
    console.log(`  folder name: ${doc.folder?.name || 'NULL'}`);
    console.log(`  folder parentId: ${doc.folder?.parentFolderId || 'NULL'}`);
    console.log('');
  });

  // Check the specific folder from logs
  const targetFolderId = '6c85ac55-e784-49a7-baff-4a7f5ae8cc02';
  const docsInTarget = await prisma.document.count({
    where: { folderId: targetFolderId }
  });

  console.log(`\nDocuments in folder ${targetFolderId}: ${docsInTarget}`);

  // Check if there are documents with NULL folderId
  const docsWithNullFolder = await prisma.document.count({
    where: { folderId: null }
  });

  console.log(`Documents with NULL folderId: ${docsWithNullFolder}`);

  await prisma.$disconnect();
}

checkDocuments().catch(console.error);
