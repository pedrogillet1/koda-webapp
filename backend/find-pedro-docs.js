const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findPedroDocuments() {
  try {
    // Find Pedro's account
    const pedro = await prisma.user.findFirst({
      where: { email: '123hackerabc@gmail.com' }
    });
    
    if (!pedro) {
      console.log('Pedro not found');
      return;
    }
    
    console.log(`Pedro's User ID: ${pedro.id}\n`);
    
    // Get Pedro's documents
    const pedroDocs = await prisma.document.findMany({
      where: { userId: pedro.id },
      include: { metadata: true },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Pedro has ${pedroDocs.length} documents:\n`);
    
    pedroDocs.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${doc.status}`);
      
      if (doc.metadata && doc.metadata.extractedText) {
        const preview = doc.metadata.extractedText.substring(0, 300);
        console.log(`   Text preview: "${preview}..."`);
        
        // Check if it contains chemistry content
        if (preview.toLowerCase().includes('air') || 
            preview.toLowerCase().includes('oxygen') ||
            preview.toLowerCase().includes('nitrogen')) {
          console.log('   ⚠️  CONTAINS CHEMISTRY CONTENT FROM ALVARO!');
        }
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findPedroDocuments();
