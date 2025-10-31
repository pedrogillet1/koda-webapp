import prisma from './src/config/database';

async function forceProcessStuckDocument() {
  const docId = 'f8d1d373-83c3-4b26-a6bd-13bd592156ba';

  // Get document info
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { metadata: true }
  });

  if (!doc) {
    console.log('❌ Document not found');
    return;
  }

  console.log('\n📄 Document Info:');
  console.log('  Filename:', doc.filename);
  console.log('  Status:', doc.status);
  console.log('  Created:', doc.createdAt);
  console.log('  Has metadata:', !!doc.metadata);
  console.log('  Extracted text length:', doc.metadata?.extractedText?.length || 0);

  const ageMinutes = Math.floor((Date.now() - new Date(doc.createdAt).getTime()) / 1000 / 60);
  console.log('  Age:', ageMinutes, 'minutes');

  if (doc.status === 'processing' && ageMinutes > 5) {
    console.log('\n🔄 Resetting stuck document to "pending" status...');
    await prisma.document.update({
      where: { id: docId },
      data: { status: 'pending' }
    });
    console.log('✅ Document reset to pending - background processor will pick it up in next cycle');
  } else {
    console.log('\n⚠️  Document is not stuck (status:', doc.status, ', age:', ageMinutes, 'min)');
  }
}

forceProcessStuckDocument().finally(() => process.exit(0));
