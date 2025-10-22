import { PrismaClient } from '@prisma/client';
import { downloadFile } from '../src/config/storage';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function checkFileHashes() {
  console.log('\n🔍 CHECKING FILE HASHES FOR CONTAMINATED DOCUMENTS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Find all documents from the contamination window
  const startTime = new Date('2025-10-08T13:38:00.000-03:00');
  const endTime = new Date('2025-10-08T13:44:00.000-03:00');

  const docs = await prisma.document.findMany({
    where: {
      mimeType: 'application/pdf',
      createdAt: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Found ${docs.length} documents\n`);

  for (const doc of docs) {
    console.log(`📄 ${doc.filename}`);
    console.log(`   User ID: ${doc.userId}`);
    console.log(`   Document ID: ${doc.id}`);
    console.log(`   Created: ${doc.createdAt}`);
    console.log(`   Size in DB: ${doc.fileSize} bytes`);
    console.log(`   Hash in DB: ${doc.fileHash}`);
    console.log(`   GCS Path: ${doc.encryptedFilename}`);

    // Download actual file and compute hash
    try {
      const fileBuffer = await downloadFile(doc.encryptedFilename);
      const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const actualSize = fileBuffer.length;

      console.log(`   Actual size from GCS: ${actualSize} bytes`);
      console.log(`   Actual hash from GCS: ${actualHash}`);

      // Check for mismatches
      const sizeMatch = actualSize === doc.fileSize;
      const hashMatch = actualHash === doc.fileHash;

      if (!sizeMatch || !hashMatch) {
        console.log(`   ⚠️  MISMATCH DETECTED!`);
        console.log(`      Size matches: ${sizeMatch ? 'YES ✅' : 'NO ❌'}`);
        console.log(`      Hash matches: ${hashMatch ? 'YES ✅' : 'NO ❌'}`);
      } else {
        console.log(`   ✅ File matches database record`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error downloading file: ${error.message}`);
    }

    console.log('');
  }

  // Check for duplicate hashes
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING FOR DUPLICATE FILE HASHES\n');

  const hashMap = new Map<string, typeof docs>();
  for (const doc of docs) {
    if (!hashMap.has(doc.fileHash)) {
      hashMap.set(doc.fileHash, []);
    }
    hashMap.get(doc.fileHash)!.push(doc);
  }

  for (const [hash, documents] of hashMap.entries()) {
    if (documents.length > 1) {
      console.log(`\n⚠️  Found ${documents.length} documents with SAME hash: ${hash.substring(0, 16)}...`);
      for (const doc of documents) {
        console.log(`   - ${doc.filename} (User: ${doc.userId.substring(0, 8)}..., Size: ${doc.fileSize})`);
      }
      console.log(`   🚨 This indicates these are TRULY the same file uploaded multiple times!`);
    }
  }

  await prisma.$disconnect();
}

checkFileHashes().catch(console.error);
