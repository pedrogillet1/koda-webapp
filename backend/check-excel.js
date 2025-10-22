const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkExcelDocs() {
  try {
    const docs = await prisma.document.findMany({
      where: {
        mimeType: {
          contains: 'sheet'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        filename: true,
        status: true,
        mimeType: true,
        createdAt: true
      }
    });

    console.log('\n📊 Recent Excel Files:');
    console.log(JSON.stringify(docs, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkExcelDocs();
