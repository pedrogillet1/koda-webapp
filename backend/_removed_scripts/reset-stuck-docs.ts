import prisma from './src/config/database';

(async () => {
  console.log('🔄 Resetting stuck documents to "pending" status...\n');

  const result = await prisma.document.updateMany({
    where: {
      status: 'processing'
    },
    data: {
      status: 'pending'
    }
  });

  console.log(`✅ Reset ${result.count} documents from "processing" to "pending"`);
  console.log('   These will be reprocessed when the backend starts\n');

  await prisma.$disconnect();
  process.exit(0);
})();
