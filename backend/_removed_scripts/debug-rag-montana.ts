import prisma from './src/config/database';

async function debugRagMontana() {
  console.log('\n🔍 DEBUGGING RAG SERVICE FOR MONTANA QUERY\n');
  console.log('─'.repeat(80));

  // Get user ID (assuming first user)
  const user = await prisma.user.findFirst();

  if (!user) {
    console.log('❌ No user found');
    await prisma.$disconnect();
    return;
  }

  console.log('👤 User ID:', user.id);
  console.log('📧 User Email:', user.email);
  console.log('');

  // Check if there are any documents at all
  const allDocs = await prisma.document.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      filename: true,
      status: true,
      createdAt: true,
      metadata: {
        select: {
          wordCount: true,
          extractedText: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📚 Total documents for user: ${allDocs.length}\n`);

  // Find Montana document
  const montanaDoc = allDocs.find((doc: any) => doc.filename.includes('Montana'));

  if (!montanaDoc) {
    console.log('❌ Montana document NOT found in database!');
  } else {
    console.log('✅ Montana document found in database:');
    console.log(`   ID: ${montanaDoc.id}`);
    console.log(`   Filename: ${montanaDoc.filename}`);
    console.log(`   Status: ${montanaDoc.status}`);
    console.log(`   Has metadata: ${montanaDoc.metadata ? 'Yes' : 'No'}`);
    if (montanaDoc.metadata) {
      console.log(`   Word count: ${montanaDoc.metadata.wordCount || 0}`);
      console.log(`   Has extracted text: ${montanaDoc.metadata.extractedText ? 'Yes' : 'No'}`);
      if (montanaDoc.metadata.extractedText) {
        const hasAcres = montanaDoc.metadata.extractedText.includes('23, 000 acres');
        console.log(`   Contains "23, 000 acres": ${hasAcres ? 'Yes' : 'No'}`);
      }
    }
  }

  console.log('\n─'.repeat(80));
  console.log('\n📄 All documents:\n');

  allDocs.forEach((doc: any) => {
    const isMontana = doc.filename.includes('Montana');
    const marker = isMontana ? '✅' : '  ';
    const hasText = doc.metadata?.extractedText ? '📝' : '❌';
    console.log(`${marker} ${hasText} ${doc.filename}`);
    console.log(`      ID: ${doc.id}`);
    console.log(`      Status: ${doc.status}`);
    if (doc.metadata) {
      console.log(`      Word count: ${doc.metadata.wordCount || 0}`);
    }
    console.log('');
  });

  await prisma.$disconnect();
}

debugRagMontana();
