require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

const TEST_USER_ID = 'test-user-backend';

async function generateReport() {
  let report = '# Document Query Test Results\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '---\n\n';

  try {
    // Test 1: Query All Documents
    report += '## Test 1: Query All Documents\n\n';
    const documents = await prisma.documents.findMany({
      where: {
        userId: TEST_USER_ID,
        status: { not: 'deleted' }
      },
      orderBy: { createdAt: 'desc' }
    });

    report += `**Result:** Found ${documents.length} documents\n\n`;
    report += '| ID | Filename | Size (bytes) | Type | Created |\n';
    report += '|---|---|---|---|---|\n';
    documents.forEach(d => {
      report += `| ${d.id.substring(0, 8)}... | ${d.filename} | ${d.fileSize} | ${d.mimeType} | ${d.createdAt.toISOString()} |\n`;
    });
    report += '\n---\n\n';

    // Test 2: Query Document Content
    report += '## Test 2: Query Document Content (Markdown)\n\n';
    const markdownDocs = await prisma.documents.findMany({
      where: {
        userId: TEST_USER_ID,
        mimeType: 'text/markdown'
      },
      select: {
        id: true,
        filename: true,
        renderableContent: true
      }
    });

    if (markdownDocs.length > 0) {
      const mdDoc = markdownDocs[0];
      report += `**Filename:** ${mdDoc.filename}\n\n`;
      report += `**Content Length:** ${mdDoc.renderableContent?.length || 0} characters\n\n`;
      report += `**Content Preview (first 500 chars):**\n\`\`\`\n${mdDoc.renderableContent?.substring(0, 500) || 'No content'}\n\`\`\`\n\n`;
    }
    report += '---\n\n';

    // Test 3: Query Documents by Type
    report += '## Test 3: Query Documents by Type\n\n';
    const mdCount = await prisma.documents.count({
      where: { userId: TEST_USER_ID, mimeType: 'text/markdown' }
    });
    const pdfCount = await prisma.documents.count({
      where: { userId: TEST_USER_ID, mimeType: 'application/pdf' }
    });
    const docxCount = await prisma.documents.count({
      where: { userId: TEST_USER_ID, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    });

    report += '| File Type | Count |\n';
    report += '|---|---|\n';
    report += `| Markdown (.md) | ${mdCount} |\n`;
    report += `| PDF (.pdf) | ${pdfCount} |\n`;
    report += `| Word (.docx) | ${docxCount} |\n`;
    report += `| **Total** | **${mdCount + pdfCount + docxCount}** |\n\n`;
    report += '---\n\n';

    // Test 4: Document Metadata Aggregation
    report += '## Test 4: Document Metadata Aggregation\n\n';
    const metadata = await prisma.documents.aggregate({
      where: { userId: TEST_USER_ID },
      _sum: { fileSize: true },
      _count: true,
      _avg: { fileSize: true },
      _max: { fileSize: true },
      _min: { fileSize: true }
    });

    report += '| Metric | Value |\n';
    report += '|---|---|\n';
    report += `| Total Documents | ${metadata._count} |\n`;
    report += `| Total Size | ${metadata._sum.fileSize} bytes (${(metadata._sum.fileSize / 1024).toFixed(2)} KB) |\n`;
    report += `| Average Size | ${Math.round(metadata._avg.fileSize || 0)} bytes |\n`;
    report += `| Largest File | ${metadata._max.fileSize} bytes |\n`;
    report += `| Smallest File | ${metadata._min.fileSize} bytes |\n\n`;
    report += '---\n\n';

    // Test 5: Search Documents by Name
    report += '## Test 5: Search Documents by Name (containing "test")\n\n';
    const searchResults = await prisma.documents.findMany({
      where: {
        userId: TEST_USER_ID,
        filename: {
          contains: 'test',
          mode: 'insensitive'
        }
      }
    });

    report += `**Result:** Found ${searchResults.length} documents\n\n`;
    report += '**Filenames:**\n';
    searchResults.forEach(d => {
      report += `- ${d.filename}\n`;
    });
    report += '\n---\n\n';

    // Test 6: Recent Documents (last 24 hours)
    report += '## Test 6: Recent Documents (Last 24 Hours)\n\n';
    const recentDocs = await prisma.documents.findMany({
      where: {
        userId: TEST_USER_ID,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    report += `**Result:** Found ${recentDocs.length} recent documents\n\n`;
    report += '| Filename | Created | Age |\n';
    report += '|---|---|---|\n';
    recentDocs.forEach(d => {
      const ageSeconds = Math.round((Date.now() - d.createdAt.getTime()) / 1000);
      const ageMinutes = Math.floor(ageSeconds / 60);
      const ageDisplay = ageMinutes > 0 ? `${ageMinutes}m ago` : `${ageSeconds}s ago`;
      report += `| ${d.filename} | ${d.createdAt.toISOString()} | ${ageDisplay} |\n`;
    });
    report += '\n---\n\n';

    // Test 7: User Memory
    report += '## Test 7: User Memory\n\n';
    const [profile, preferences, topics] = await Promise.all([
      prisma.user_profiles.findUnique({
        where: { userId: TEST_USER_ID }
      }),
      prisma.user_preferences_memory.findMany({
        where: { userId: TEST_USER_ID }
      }),
      prisma.conversation_topics.findMany({
        where: { userId: TEST_USER_ID }
      })
    ]);

    report += '### User Profile\n\n';
    if (profile) {
      report += `- **Name:** ${profile.name}\n`;
      report += `- **Role:** ${profile.role}\n`;
      report += `- **Organization:** ${profile.organization || 'N/A'}\n`;
      report += `- **Expertise Level:** ${profile.expertiseLevel}\n\n`;
    } else {
      report += 'No profile found\n\n';
    }

    report += `### User Preferences (${preferences.length})\n\n`;
    if (preferences.length > 0) {
      report += '| Type | Value | Confidence |\n';
      report += '|---|---|---|\n';
      preferences.forEach(p => {
        report += `| ${p.preferenceType} | ${p.preferenceValue} | ${p.confidence} |\n`;
      });
      report += '\n';
    } else {
      report += 'No preferences found\n\n';
    }

    report += `### Conversation Topics (${topics.length})\n\n`;
    if (topics.length > 0) {
      report += '| Topic | Frequency | Confidence |\n';
      report += '|---|---|---|\n';
      topics.forEach(t => {
        report += `| ${t.topicSummary} | ${t.frequency} | ${t.confidence} |\n`;
      });
      report += '\n';
    } else {
      report += 'No topics found\n\n';
    }
    report += '---\n\n';

    // Test 8: Full Text Document
    report += '## Test 8: Query Document with Full Text\n\n';
    const fullTextDoc = await prisma.documents.findFirst({
      where: {
        userId: TEST_USER_ID,
        mimeType: 'text/markdown'
      },
      select: {
        id: true,
        filename: true,
        fileSize: true,
        mimeType: true,
        renderableContent: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (fullTextDoc) {
      report += `**Filename:** ${fullTextDoc.filename}\n\n`;
      report += `**Size:** ${fullTextDoc.fileSize} bytes\n\n`;
      report += `**Content Length:** ${fullTextDoc.renderableContent?.length || 0} characters\n\n`;
      report += `**Full Content:**\n\n\`\`\`markdown\n${fullTextDoc.renderableContent || 'No content'}\n\`\`\`\n\n`;
    } else {
      report += 'No markdown document found\n\n';
    }

    // Write report to file
    const reportPath = 'DOCUMENT_QUERY_RESULTS.md';
    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ Report generated: ${reportPath}\n`);
    console.log(`📊 Summary:`);
    console.log(`   - Total Documents: ${documents.length}`);
    console.log(`   - Total Size: ${(metadata._sum.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   - User Profile: ${profile ? 'Found' : 'Not found'}`);
    console.log(`   - Preferences: ${preferences.length}`);
    console.log(`   - Topics: ${topics.length}`);

  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateReport();
