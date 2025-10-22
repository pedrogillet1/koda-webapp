import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicateDocs() {
  // Find all documents with "Comprovante" in the name or content
  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { filename: { contains: 'Comprovante' } },
        { filename: { contains: 'comprovante' } },
      ],
    },
    include: {
      metadata: true,
      folder: true,
    },
  });

  console.log(`\nFound ${docs.length} documents with "Comprovante" in filename:\n`);

  for (const doc of docs) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 Filename: ${doc.filename}`);
    console.log(`🆔 ID: ${doc.id}`);
    console.log(`📁 Folder: ${doc.folder?.name || '(Root)'}`);
    console.log(`📅 Created: ${doc.createdAt}`);
    console.log(`📊 File Size: ${doc.fileSize} bytes`);
    console.log(`🔑 File Hash: ${doc.fileHash}`);

    if (doc.metadata?.extractedText) {
      const preview = doc.metadata.extractedText.substring(0, 200);
      console.log(`📝 Text Preview: ${preview}...`);
      console.log(`📏 Total Text Length: ${doc.metadata.extractedText.length} characters`);
    } else {
      console.log(`⚠️  No extracted text available`);
    }
    console.log(``);
  }

  // Also check the Business Plan
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Checking Koda Business Plan document:\n`);

  const businessPlan = await prisma.document.findFirst({
    where: {
      filename: { contains: 'Koda Business Plan' },
    },
    include: {
      metadata: true,
    },
  });

  if (businessPlan) {
    console.log(`📄 Filename: ${businessPlan.filename}`);
    console.log(`🆔 ID: ${businessPlan.id}`);
    console.log(`📊 File Size: ${businessPlan.fileSize} bytes`);

    if (businessPlan.metadata?.extractedText) {
      const hasComprovante = businessPlan.metadata.extractedText.toLowerCase().includes('comprovante');
      console.log(`🔍 Contains "comprovante": ${hasComprovante ? 'YES ⚠️' : 'NO ✅'}`);

      if (hasComprovante) {
        const index = businessPlan.metadata.extractedText.toLowerCase().indexOf('comprovante');
        const excerpt = businessPlan.metadata.extractedText.substring(index - 100, index + 100);
        console.log(`📝 Excerpt around "comprovante":\n${excerpt}`);
      }
    }
  } else {
    console.log(`⚠️  Koda Business Plan not found`);
  }

  // Find documents with same file hash
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Checking for duplicate uploads (same file hash):\n`);

  const allDocs = await prisma.document.findMany({
    select: {
      id: true,
      filename: true,
      fileHash: true,
      fileSize: true,
      createdAt: true,
    },
  });

  const hashMap = new Map<string, typeof allDocs>();

  for (const doc of allDocs) {
    if (!hashMap.has(doc.fileHash)) {
      hashMap.set(doc.fileHash, []);
    }
    hashMap.get(doc.fileHash)!.push(doc);
  }

  for (const [hash, docs] of hashMap.entries()) {
    if (docs.length > 1) {
      console.log(`\n🔄 Found ${docs.length} documents with same hash: ${hash}`);
      for (const doc of docs) {
        console.log(`   - ${doc.filename} (ID: ${doc.id}) - ${doc.createdAt}`);
      }
    }
  }

  await prisma.$disconnect();
}

checkDuplicateDocs().catch(console.error);
