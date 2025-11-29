import prisma from '../config/database';

async function clearDocuments() {
  try {
    const result = await prisma.documents.deleteMany();
    console.log(`✅ Deleted ${result.count} documents from database`);
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
  }
}

clearDocuments();
