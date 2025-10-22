const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBusinessPlan() {
  const docs = await prisma.document.findMany({
    where: {
      user: {
        email: '123hackerabc@gmail.com'
      },
      filename: {
        contains: 'Koda Business Plan'
      }
    },
    include: {
      metadata: {
        select: {
          extractedText: true,
          ocrConfidence: true,
          updatedAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log('Found', docs.length, 'Koda Business Plan documents for Pedro\n');

  docs.forEach((doc, i) => {
    console.log(`${i + 1}. ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Created: ${doc.createdAt}`);
    console.log(`   Status: ${doc.status}`);
    console.log(`   File size: ${(doc.fileSize / 1024).toFixed(2)} KB`);

    if (doc.metadata) {
      const textLength = doc.metadata.extractedText?.length || 0;
      const preview = doc.metadata.extractedText?.substring(0, 300) || 'No text';
      console.log(`   Extracted text: ${textLength} characters`);
      console.log(`   Last updated: ${doc.metadata.updatedAt}`);
      console.log(`   Text preview: "${preview}..."`);
    } else {
      console.log(`   WARNING: No metadata found`);
    }
    console.log('');
  });

  await prisma.$disconnect();
}

checkBusinessPlan();
