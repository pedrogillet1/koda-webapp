/**
 * Diagnostic Script: Document Count Analysis
 * Checks database counts vs what chat reports (45)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Starting document count diagnostic...\n');

    // Find test user
    const user = await prisma.users.findUnique({
      where: { email: 'test@koda.com' }
    });

    if (!user) {
      console.log('❌ User test@koda.com not found');
      return;
    }

    console.log(`✅ User found: ${user.email} (ID: ${user.id})\n`);

    // Count documents by status
    const total = await prisma.documents.count({
      where: { userId: user.id }
    });

    const processed = await prisma.documents.count({
      where: { userId: user.id, status: 'processed' }
    });

    const failed = await prisma.documents.count({
      where: { userId: user.id, status: 'failed' }
    });

    const deleted = await prisma.documents.count({
      where: { userId: user.id, status: 'deleted' }
    });

    const notDeleted = await prisma.documents.count({
      where: { userId: user.id, status: { not: 'deleted' } }
    });

    console.log('=== DATABASE DOCUMENT COUNTS ===');
    console.log(`Total documents:     ${total}`);
    console.log(`├─ Processed:        ${processed}`);
    console.log(`├─ Failed:           ${failed}`);
    console.log(`├─ Deleted:          ${deleted}`);
    console.log(`└─ Not deleted:      ${notDeleted}`);

    console.log('\n=== CHAT REPORTED COUNT ===');
    console.log(`Chat says:           45 documents`);

    console.log('\n=== ANALYSIS ===');
    const orphanedVectors = 45 - notDeleted;
    if (orphanedVectors > 0) {
      console.log(`⚠️  ORPHANED VECTORS: ${orphanedVectors} vectors in Pinecone have no matching database documents`);
      console.log(`   └── These are from previously deleted documents`);
    } else if (orphanedVectors < 0) {
      console.log(`⚠️  MISMATCH: Database has ${Math.abs(orphanedVectors)} more documents than Pinecone`);
    } else {
      console.log(`✅ Counts match! No orphaned vectors.`);
    }

    // Show recent documents
    console.log('\n=== RECENT DOCUMENTS (Last 10) ===');
    const recentDocs = await prisma.documents.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        filename: true,
        status: true,
        createdAt: true,
      },
    });

    recentDocs.forEach((doc, i) => {
      const statusIcon = doc.status === 'processed' ? '✅' : doc.status === 'failed' ? '❌' : '🗑️';
      console.log(`${i + 1}. ${statusIcon} ${doc.filename} (${doc.status})`);
      console.log(`   └── ID: ${doc.id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
