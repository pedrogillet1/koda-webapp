require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function queryDocuments() {
  try {
    const userId = 'test-user-backend';

    console.log('=== QUERYING TEST USER DOCUMENTS ===\n');

    // Query documents
    const documents = await prisma.documents.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`📄 Found ${documents.length} documents\n`);

    documents.forEach((doc, index) => {
      console.log(`Document ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Filename: ${doc.filename}`);
      console.log(`  Size: ${doc.fileSize} bytes`);
      console.log(`  Type: ${doc.mimeType}`);
      console.log(`  Status: ${doc.status}`);
      console.log(`  Created: ${doc.createdAt.toISOString()}`);
      if (doc.renderableContent) {
        const preview = doc.renderableContent.substring(0, 200).replace(/\n/g, ' ');
        console.log(`  Content Preview: ${preview}...`);
      }
      console.log('');
    });

    // Query folders
    const folders = await prisma.folders.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📁 Found ${folders.length} folders\n`);

    folders.forEach((folder, index) => {
      console.log(`Folder ${index + 1}:`);
      console.log(`  ID: ${folder.id}`);
      console.log(`  Name: ${folder.name}`);
      console.log(`  Created: ${folder.createdAt.toISOString()}`);
      console.log('');
    });

    // Query conversations
    const conversations = await prisma.conversations.findMany({
      where: { userId },
      include: {
        messages: {
          take: 5,
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`💬 Found ${conversations.length} conversations\n`);

    conversations.forEach((conv, index) => {
      console.log(`Conversation ${index + 1}:`);
      console.log(`  ID: ${conv.id}`);
      console.log(`  Title: ${conv.title}`);
      console.log(`  Messages: ${conv.messages.length}`);
      conv.messages.forEach((msg, msgIndex) => {
        console.log(`    Message ${msgIndex + 1}: [${msg.role}] ${msg.content.substring(0, 50)}...`);
      });
      console.log('');
    });

    // Query user memory
    const profile = await prisma.user_profiles.findUnique({
      where: { userId }
    });

    const preferences = await prisma.user_preferences_memory.findMany({
      where: { userId }
    });

    const topics = await prisma.conversation_topics.findMany({
      where: { userId }
    });

    console.log('🧠 User Memory:\n');
    if (profile) {
      console.log('Profile:');
      console.log(`  Name: ${profile.name}`);
      console.log(`  Role: ${profile.role}`);
      console.log(`  Expertise: ${profile.expertiseLevel}`);
      console.log('');
    }

    console.log(`Preferences: ${preferences.length}`);
    preferences.forEach((pref, index) => {
      console.log(`  ${index + 1}. ${pref.preferenceType}: ${pref.preferenceValue} (confidence: ${pref.confidence})`);
    });
    console.log('');

    console.log(`Topics: ${topics.length}`);
    topics.forEach((topic, index) => {
      console.log(`  ${index + 1}. ${topic.topicSummary} (frequency: ${topic.frequency}, confidence: ${topic.confidence})`);
    });

  } catch (error) {
    console.error('Error querying documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryDocuments();
