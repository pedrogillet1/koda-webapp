const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocumentContamination() {
  try {
    console.log('🔍 SECURITY AUDIT: Checking for document contamination\n');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      }
    });
    
    console.log(`Found ${users.length} users:\n`);
    users.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email} (${user.firstName} ${user.lastName}) - ID: ${user.id}`);
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Get all documents with their metadata
    const documents = await prisma.document.findMany({
      include: {
        metadata: true,
        user: {
          select: {
            email: true,
            firstName: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${documents.length} total documents in database:\n`);
    
    // Group documents by user
    const docsByUser = {};
    documents.forEach(doc => {
      const userEmail = doc.user.email;
      if (!docsByUser[userEmail]) {
        docsByUser[userEmail] = [];
      }
      docsByUser[userEmail].push(doc);
    });
    
    // Display documents grouped by user
    Object.entries(docsByUser).forEach(([email, userDocs]) => {
      console.log(`\n📧 User: ${email}`);
      console.log(`   Documents (${userDocs.length}):`);
      
      userDocs.forEach((doc, i) => {
        console.log(`\n   ${i + 1}. "${doc.filename}"`);
        console.log(`      - ID: ${doc.id}`);
        console.log(`      - User ID: ${doc.userId}`);
        console.log(`      - Created: ${doc.createdAt}`);
        console.log(`      - Status: ${doc.status}`);
        
        if (doc.metadata && doc.metadata.extractedText) {
          const textPreview = doc.metadata.extractedText.substring(0, 200).replace(/\n/g, ' ');
          console.log(`      - Text Preview: "${textPreview}..."`);
          
          // Check for chemistry-related content
          const chemistryKeywords = ['air', 'oxygen', 'nitrogen', 'carbon monoxide', 'acid rain', 'gases'];
          const hasChemistryContent = chemistryKeywords.some(keyword => 
            doc.metadata.extractedText.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (hasChemistryContent) {
            console.log(`      - ⚠️  ALERT: Contains chemistry-related content!`);
          }
          
          // Check for business plan content
          const businessKeywords = ['business', 'plan', 'strategy', 'market', 'revenue', 'koda'];
          const hasBusinessContent = businessKeywords.some(keyword => 
            doc.metadata.extractedText.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (hasBusinessContent) {
            console.log(`      - ℹ️  Contains business-related content`);
          }
        } else {
          console.log(`      - ⚠️  No extracted text available`);
        }
      });
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 CROSS-USER CONTAMINATION CHECK:\n');
    
    // Check if any document is accessible by wrong user
    for (const doc of documents) {
      const ownerEmail = doc.user.email;
      
      // Try to find this document when querying as OTHER users
      for (const user of users) {
        if (user.id !== doc.userId) {
          const accessibleDoc = await prisma.document.findFirst({
            where: {
              id: doc.id,
              userId: user.id
            }
          });
          
          if (accessibleDoc) {
            console.log(`❌ BREACH DETECTED!`);
            console.log(`   Document "${doc.filename}" (owned by ${ownerEmail})`);
            console.log(`   is accessible by user: ${user.email}`);
          }
        }
      }
    }
    
    console.log('✅ Cross-user access check complete\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDocumentContamination();
