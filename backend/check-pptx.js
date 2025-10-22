const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const docs = await prisma.document.findMany({
    where: {
      mimeType: {
        in: [
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint'
        ]
      }
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      userId: true
    }
  });

  console.log('PowerPoint files in database:');
  docs.forEach(d => {
    console.log(`  - ${d.filename} (ID: ${d.id.substring(0, 8)}..., User: ${d.userId.substring(0, 8)}...)`);
  });

  await prisma.$disconnect();
})();
