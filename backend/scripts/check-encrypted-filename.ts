import prisma from '../src/config/database';

async function check() {
  const doc = await prisma.document.findUnique({
    where: { id: 'f5fe8b59-d7d3-484b-ba86-df908cfc50ca' }
  });

  if (doc) {
    console.log('Encrypted filename:', doc.encryptedFilename);
    console.log('PDF key would be:', doc.encryptedFilename.replace(/\.[^.]+$/, '.pdf'));
  }

  await prisma.$disconnect();
}

check();
