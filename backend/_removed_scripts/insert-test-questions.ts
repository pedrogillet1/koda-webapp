/**
 * Insert 30 test questions directly into user's chat
 * This will create a conversation with all questions pre-loaded
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const questions = [
  "What is Koda's core purpose according to the business plan?",
  "How many acres is the Montana Rocking CC Sanctuary?",
  "When was the Hotel Baxter formally opened?",
  "What psychological frameworks does Koda AI apply?",
  "How many guest rooms did the Hotel Baxter have?",
  "What is the location of the Rocking CC Sanctuary?",
  "What are Koda AI's three reasoning layers?",
  "Who designed the Hotel Baxter?",
  "What is the ADR for the Baxter Hotel according to the profitability analysis?",
  "What is the total gross revenue projected for the Baxter Hotel?",
  "What is the ROI for the Baxter Hotel?",
  "What is the total operating revenue for Lone Mountain Ranch in January 2025?",
  "What is the occupancy rate for the Baxter Hotel?",
  "What is the EBITDA for Lone Mountain Ranch in January 2025?",
  "What is the total portfolio ROI across all projects?",
  "How should Koda AI behave when it's unsure of an answer?",
  "What is Koda AI's personality model based on?",
  "What makes the Rocking CC Sanctuary a valuable investment opportunity?",
  "How does the RevPAR model work for the Baxter Hotel?",
  "Who is the CEO of Koda AI?",
  "Do I have any Word documents?",
  "What are Koda's financial projections for Year 1?",
  "Which document is a historical article?",
  "Which document contains a detailed P&L budget?",
  "What are the common themes across my business documents?",
  "Compare the ROI of Baxter Hotel vs Lone Mountain Ranch",
  "What are the total acquisition costs mentioned across all documents?",
  "What are Koda's main revenue streams?",
  "What is Koda's competitive advantage according to the business plan?",
  "What is Koda's target market?"
];

async function insertQuestions() {
  console.log('🔍 Finding user 123hackerabc@gmail.com...\n');

  const user = await prisma.user.findFirst({
    where: { email: '123hackerabc@gmail.com' }
  });

  if (!user) {
    console.log('❌ User not found!');
    console.log('Available users:');
    const users = await prisma.user.findMany({ select: { email: true, id: true } });
    users.forEach(u => console.log(`  - ${u.email} (${u.id})`));
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Found user: ${user.email}`);
  console.log(`   User ID: ${user.id}\n`);

  // Create a new conversation for the benchmark
  console.log('📝 Creating benchmark conversation...\n');

  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: '🧪 KODA 30-Question Benchmark Test',
      contextType: null,
      contextId: null
    }
  });

  console.log(`✅ Created conversation: ${conversation.id}\n`);
  console.log('📨 Adding questions as user messages...\n');

  // Add each question as a user message
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: `[Question ${i + 1}/30] ${question}`
      }
    });

    console.log(`  ✅ [${i + 1}/${questions.length}] ${question.substring(0, 60)}...`);
  }

  console.log('\n✅ All questions added to conversation!');
  console.log('\n📋 Instructions:');
  console.log('1. Log into KODA frontend with 123hackerabc@gmail.com');
  console.log('2. Open the "🧪 KODA 30-Question Benchmark Test" conversation');
  console.log('3. The AI will automatically respond to each question');
  console.log('4. Review the answers in the chat interface\n');

  await prisma.$disconnect();
}

insertQuestions().catch(error => {
  console.error('Error:', error);
  prisma.$disconnect();
});
