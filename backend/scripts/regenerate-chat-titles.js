const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateConversationTitle(userMessage, assistantMessage) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that generates short, descriptive titles for conversations based on the first exchange.
          The title should be 3-6 words maximum and capture the main topic or question.
          Do not use quotes or punctuation in the title.
          Examples: "PowerPoint Slide Content Query", "Document Search Help", "API Integration Question"`
        },
        {
          role: 'user',
          content: `Generate a short title for this conversation:\n\nUser: ${userMessage}\n\nAssistant: ${assistantMessage}`
        }
      ],
      temperature: 0.7,
      max_tokens: 20,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating title:', error);
    return 'Chat'; // Fallback title
  }
}

(async () => {
  try {
    console.log('🔍 Finding conversations with "New Chat" title...');

    // Find all conversations with "New Chat" title that have messages
    const conversations = await prisma.conversation.findMany({
      where: {
        title: 'New Chat'
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          },
          take: 2 // Get first user message and first assistant message
        }
      }
    });

    console.log(`📊 Found ${conversations.length} conversations with "New Chat" title`);

    let regenerated = 0;
    let skipped = 0;

    for (const conversation of conversations) {
      // Skip if no messages
      if (conversation.messages.length < 2) {
        console.log(`⏭️  Skipping conversation ${conversation.id.substring(0, 8)}... (not enough messages)`);
        skipped++;
        continue;
      }

      // Get first user and assistant messages
      const userMessage = conversation.messages.find(m => m.role === 'user');
      const assistantMessage = conversation.messages.find(m => m.role === 'assistant');

      if (!userMessage || !assistantMessage) {
        console.log(`⏭️  Skipping conversation ${conversation.id.substring(0, 8)}... (missing user or assistant message)`);
        skipped++;
        continue;
      }

      console.log(`\n🎯 Generating title for conversation ${conversation.id.substring(0, 8)}...`);
      console.log(`   User: "${userMessage.content.substring(0, 50)}..."`);

      const newTitle = await generateConversationTitle(userMessage.content, assistantMessage.content);

      console.log(`   📝 New title: "${newTitle}"`);

      // Update the conversation title
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { title: newTitle }
      });

      regenerated++;
    }

    console.log(`\n✅ Complete!`);
    console.log(`   🔄 Regenerated: ${regenerated} titles`);
    console.log(`   ⏭️  Skipped: ${skipped} conversations`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
