import { PrismaClient } from '@prisma/client';
import { downloadFile } from '../src/config/storage';
import fs from 'fs';
import path from 'path';
import os from 'os';

const prisma = new PrismaClient();

async function analyzeCorruptedDoc() {
  const corruptedId = 'df64c6f3-7cca-48bf-ab81-4b5fb3cfe232';

  const doc = await prisma.document.findUnique({
    where: { id: corruptedId },
    include: { metadata: true },
  });

  if (!doc) {
    console.log('❌ Document not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📄 CORRUPTED DOCUMENT ANALYSIS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Filename: ${doc.filename}`);
  console.log(`ID: ${doc.id}`);
  console.log(`User ID: ${doc.userId}`);
  console.log(`File Size: ${doc.fileSize} bytes`);
  console.log(`File Hash: ${doc.fileHash}`);
  console.log(`Encrypted Filename: ${doc.encryptedFilename}`);
  console.log(`MIME Type: ${doc.mimeType}`);
  console.log(`Status: ${doc.status}`);
  console.log(`Created At: ${doc.createdAt}`);
  console.log(`Updated At: ${doc.updatedAt}`);

  if (doc.metadata?.extractedText) {
    const text = doc.metadata.extractedText;
    console.log(`\n📝 EXTRACTED TEXT ANALYSIS`);
    console.log(`Total Length: ${text.length} characters\n`);

    // Find all occurrences of document-like markers
    console.log(`🔍 SEARCHING FOR DOCUMENT MARKERS:`);

    const markers = [
      'AGITAÇÃO PSICOMOTORA',
      'Dr. Daniel A. Cavalcante',
      'Psiquiatra',
      'EMERGÊNCIAS PSIQUIÁTRICAS',
      'Comprovante',
      'PIX',
      'Koda Business Plan',
      'document management',
      'business plan',
    ];

    for (const marker of markers) {
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(marker.toLowerCase());
      if (index !== -1) {
        console.log(`\n✅ Found "${marker}" at position ${index}`);
        const start = Math.max(0, index - 100);
        const end = Math.min(text.length, index + marker.length + 100);
        console.log(`   Context: ${text.substring(start, end)}`);
      } else {
        console.log(`\n❌ "${marker}" not found`);
      }
    }

    // Split text into sections
    console.log(`\n\n📊 TEXT STRUCTURE:`);
    console.log(`First 1000 chars:\n${text.substring(0, 1000)}\n`);
    console.log(`\nMiddle 1000 chars (around position ${Math.floor(text.length / 2)}):\n${text.substring(Math.floor(text.length / 2) - 500, Math.floor(text.length / 2) + 500)}\n`);
    console.log(`\nLast 1000 chars:\n${text.substring(Math.max(0, text.length - 1000))}\n`);
  }

  // Download the actual PDF file and save it for inspection
  console.log(`\n\n💾 DOWNLOADING ACTUAL FILE FROM GCS...`);
  try {
    const fileBuffer = await downloadFile(doc.encryptedFilename);
    const tempPath = path.join(os.tmpdir(), `corrupted-${doc.id}.pdf`);
    fs.writeFileSync(tempPath, fileBuffer);
    console.log(`✅ File downloaded to: ${tempPath}`);
    console.log(`   File size from GCS: ${fileBuffer.length} bytes`);
    console.log(`   File size in database: ${doc.fileSize} bytes`);
    console.log(`   Match: ${fileBuffer.length === doc.fileSize ? 'YES ✅' : 'NO ❌'}`);

    // Check PDF structure
    console.log(`\n📋 PDF STRUCTURE CHECK:`);
    const header = fileBuffer.slice(0, 20).toString('utf-8', 0, 20);
    console.log(`   PDF Header: ${header}`);
    console.log(`   Starts with %PDF-: ${header.startsWith('%PDF-') ? 'YES ✅' : 'NO ❌'}`);

    // Check for multiple %PDF- headers (indicates merged PDFs)
    const bufferStr = fileBuffer.toString('binary');
    const pdfHeaderCount = (bufferStr.match(/%PDF-/g) || []).length;
    console.log(`   Number of PDF headers found: ${pdfHeaderCount}`);
    if (pdfHeaderCount > 1) {
      console.log(`   ⚠️  MULTIPLE PDF HEADERS - THIS IS ABNORMAL!`);
    }
  } catch (error: any) {
    console.error(`❌ Error downloading file:`, error.message);
  }

  // Find other documents uploaded around the same time
  console.log(`\n\n📅 DOCUMENTS UPLOADED AROUND THE SAME TIME:`);
  const uploadTime = new Date(doc.createdAt);
  const beforeTime = new Date(uploadTime.getTime() - 5 * 60 * 1000); // 5 minutes before
  const afterTime = new Date(uploadTime.getTime() + 5 * 60 * 1000); // 5 minutes after

  const nearbyDocs = await prisma.document.findMany({
    where: {
      createdAt: {
        gte: beforeTime,
        lte: afterTime,
      },
    },
    include: {
      metadata: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`\nFound ${nearbyDocs.length} documents uploaded within ±5 minutes:\n`);
  for (const nearbyDoc of nearbyDocs) {
    console.log(`${nearbyDoc.id === doc.id ? '>>> ' : '    '}${nearbyDoc.filename}`);
    console.log(`     ID: ${nearbyDoc.id}`);
    console.log(`     User ID: ${nearbyDoc.userId}`);
    console.log(`     Created: ${nearbyDoc.createdAt}`);
    console.log(`     Size: ${nearbyDoc.fileSize} bytes`);
    console.log(`     Hash: ${nearbyDoc.fileHash}`);
    if (nearbyDoc.metadata?.extractedText) {
      console.log(`     Extracted text length: ${nearbyDoc.metadata.extractedText.length} chars`);
      console.log(`     First 100 chars: ${nearbyDoc.metadata.extractedText.substring(0, 100)}...`);
    }
    console.log(``);
  }

  await prisma.$disconnect();
}

analyzeCorruptedDoc().catch(console.error);
