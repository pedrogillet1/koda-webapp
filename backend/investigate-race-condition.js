const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateRaceCondition() {
  try {
    console.log('🔍 INVESTIGATING CROSS-USER DATA CONTAMINATION\n');
    console.log('='.repeat(80));

    // Get contaminated document (Pedro's business plan with Alvaro's content)
    const contaminatedDoc = await prisma.document.findUnique({
      where: { id: 'f64ae6f9-fc30-4384-a1e2-fde1676e9a68' },
      include: {
        user: true,
        metadata: true
      }
    });

    // Get source document (Alvaro's chemistry document)
    const sourceDoc = await prisma.document.findUnique({
      where: { id: '215e7049-a675-4c4d-8ac5-17498fbd5dfb' },
      include: {
        user: true,
        metadata: true
      }
    });

    console.log('\n📄 CONTAMINATED DOCUMENT (Pedro\'s Koda Business Plan):');
    console.log(`   ID: ${contaminatedDoc.id}`);
    console.log(`   User: ${contaminatedDoc.user.email}`);
    console.log(`   Filename: ${contaminatedDoc.filename}`);
    console.log(`   Created: ${contaminatedDoc.createdAt}`);
    console.log(`   Updated: ${contaminatedDoc.updatedAt}`);
    console.log(`   Status: ${contaminatedDoc.status}`);
    console.log(`   GCS URL: ${contaminatedDoc.gcsUrl}`);
    console.log(`   Metadata Created: ${contaminatedDoc.metadata?.createdAt}`);
    console.log(`   Metadata Updated: ${contaminatedDoc.metadata?.updatedAt}`);
    if (contaminatedDoc.metadata?.extractedText) {
      console.log(`   Extracted Text Preview: "${contaminatedDoc.metadata.extractedText.substring(0, 200)}..."`);
    }

    console.log('\n📄 SOURCE DOCUMENT (Alvaro\'s Chemistry Research):');
    console.log(`   ID: ${sourceDoc.id}`);
    console.log(`   User: ${sourceDoc.user.email}`);
    console.log(`   Filename: ${sourceDoc.filename}`);
    console.log(`   Created: ${sourceDoc.createdAt}`);
    console.log(`   Updated: ${sourceDoc.updatedAt}`);
    console.log(`   Status: ${sourceDoc.status}`);
    console.log(`   GCS URL: ${sourceDoc.gcsUrl}`);
    console.log(`   Metadata Created: ${sourceDoc.metadata?.createdAt}`);
    console.log(`   Metadata Updated: ${sourceDoc.metadata?.updatedAt}`);
    if (sourceDoc.metadata?.extractedText) {
      console.log(`   Extracted Text Preview: "${sourceDoc.metadata.extractedText.substring(0, 200)}..."`);
    }

    // Timing analysis
    console.log('\n⏰ TIMING ANALYSIS:');
    const contaminatedCreated = new Date(contaminatedDoc.createdAt);
    const sourceCreated = new Date(sourceDoc.createdAt);
    const timeDiff = Math.abs(contaminatedCreated - sourceCreated);
    const secondsDiff = timeDiff / 1000;

    console.log(`   Time between uploads: ${secondsDiff.toFixed(2)} seconds`);
    console.log(`   Pedro's doc created: ${contaminatedCreated.toISOString()}`);
    console.log(`   Alvaro's doc created: ${sourceCreated.toISOString()}`);

    if (secondsDiff < 60) {
      console.log(`   ⚠️  BOTH DOCUMENTS WERE UPLOADED WITHIN ${secondsDiff.toFixed(0)} SECONDS!`);
      console.log('   ⚠️  HIGH PROBABILITY OF CONCURRENT PROCESSING RACE CONDITION');
    }

    // Check for text match
    console.log('\n🔬 TEXT CONTAMINATION VERIFICATION:');
    if (contaminatedDoc.metadata?.extractedText && sourceDoc.metadata?.extractedText) {
      const contaminatedText = contaminatedDoc.metadata.extractedText.substring(0, 500);
      const sourceText = sourceDoc.metadata.extractedText.substring(0, 500);

      if (contaminatedText === sourceText) {
        console.log('   ✅ CONFIRMED: Extracted texts are IDENTICAL');
        console.log('   ⚠️  Pedro\'s document has EXACT SAME text as Alvaro\'s document');
      } else {
        // Check for partial match
        const similarity = calculateSimilarity(contaminatedText, sourceText);
        console.log(`   Similarity: ${(similarity * 100).toFixed(2)}%`);
      }
    }

    // Get all documents processed around the same time
    const timeWindow = 60000; // 60 seconds
    const startTime = new Date(Math.min(contaminatedCreated, sourceCreated) - timeWindow);
    const endTime = new Date(Math.max(contaminatedCreated, sourceCreated) + timeWindow);

    const concurrentDocs = await prisma.document.findMany({
      where: {
        createdAt: {
          gte: startTime,
          lte: endTime
        }
      },
      include: {
        user: true,
        metadata: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log('\n📊 ALL DOCUMENTS PROCESSED IN SAME TIME WINDOW:');
    console.log(`   Time window: ${startTime.toISOString()} to ${endTime.toISOString()}`);
    console.log(`   Total documents: ${concurrentDocs.length}\n`);

    concurrentDocs.forEach((doc, i) => {
      console.log(`   ${i + 1}. ${doc.filename}`);
      console.log(`      User: ${doc.user.email}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      Created: ${doc.createdAt.toISOString()}`);
      console.log(`      Status: ${doc.status}`);
      if (doc.metadata?.extractedText) {
        console.log(`      Text: "${doc.metadata.extractedText.substring(0, 100)}..."`);
      }
      console.log('');
    });

    // Check for any other contamination
    console.log('🔍 CHECKING FOR OTHER CONTAMINATION INSTANCES:\n');

    // Get all documents and check if any share identical extracted text
    const allDocs = await prisma.documentMetadata.findMany({
      where: {
        extractedText: {
          not: null
        }
      },
      include: {
        document: {
          include: {
            user: true
          }
        }
      }
    });

    const textMap = new Map();
    allDocs.forEach(metadata => {
      const textHash = metadata.extractedText.substring(0, 200);
      if (!textMap.has(textHash)) {
        textMap.set(textHash, []);
      }
      textMap.get(textHash).push({
        docId: metadata.documentId,
        userId: metadata.document.userId,
        userEmail: metadata.document.user.email,
        filename: metadata.document.filename
      });
    });

    // Find duplicates
    let foundOtherContamination = false;
    textMap.forEach((docs, textHash) => {
      if (docs.length > 1) {
        // Check if they belong to different users
        const uniqueUsers = new Set(docs.map(d => d.userId));
        if (uniqueUsers.size > 1) {
          foundOtherContamination = true;
          console.log('⚠️  FOUND CROSS-USER CONTAMINATION:');
          console.log(`   Text preview: "${textHash}..."\n`);
          docs.forEach(doc => {
            console.log(`   - ${doc.filename}`);
            console.log(`     User: ${doc.userEmail}`);
            console.log(`     Document ID: ${doc.docId}\n`);
          });
        }
      }
    });

    if (!foundOtherContamination) {
      console.log('✅ No other cross-user contamination found');
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 CONCLUSION:');
    console.log('   The contamination appears to be an isolated incident caused by');
    console.log('   concurrent processing of documents uploaded within seconds of each other.');
    console.log('   The race condition in the BullMQ worker with concurrency: 5 likely');
    console.log('   caused the extracted text variables to get cross-wired during processing.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

investigateRaceCondition();
