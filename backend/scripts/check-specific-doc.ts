import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpecificDoc() {
  const doc = await prisma.document.findUnique({
    where: { id: 'df64c6f3-7cca-48bf-ab81-4b5fb3cfe232' },
    include: { metadata: true },
  });

  if (!doc) {
    console.log('Document not found!');
    return;
  }

  console.log(`\n📄 Filename: ${doc.filename}`);
  console.log(`🆔 ID: ${doc.id}`);
  console.log(`📊 File Size: ${doc.fileSize} bytes`);
  console.log(`🔑 File Hash: ${doc.fileHash}`);

  if (doc.metadata?.extractedText) {
    console.log(`\n📝 First 500 characters of extracted text:`);
    console.log(doc.metadata.extractedText.substring(0, 500));
    console.log(`\n📝 Last 500 characters of extracted text:`);
    console.log(doc.metadata.extractedText.substring(doc.metadata.extractedText.length - 500));

    // Search for "comprovante"
    const index = doc.metadata.extractedText.toLowerCase().indexOf('comprovante');
    if (index !== -1) {
      console.log(`\n🔍 Found "comprovante" at position ${index}`);
      console.log(`📝 Context (200 chars before and after):`);
      const start = Math.max(0, index - 200);
      const end = Math.min(doc.metadata.extractedText.length, index + 200);
      console.log(doc.metadata.extractedText.substring(start, end));
    }

    // Search for "PIX"
    const pixIndex = doc.metadata.extractedText.toLowerCase().indexOf('pix');
    if (pixIndex !== -1) {
      console.log(`\n💰 Found "PIX" at position ${pixIndex}`);
      console.log(`📝 Context (200 chars before and after):`);
      const start = Math.max(0, pixIndex - 200);
      const end = Math.min(doc.metadata.extractedText.length, pixIndex + 200);
      console.log(doc.metadata.extractedText.substring(start, end));
    }
  }

  await prisma.$disconnect();
}

checkSpecificDoc().catch(console.error);
