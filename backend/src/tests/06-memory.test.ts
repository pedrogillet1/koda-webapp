import prisma from '../config/database';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
const TEST_USER_ID = 'test-user-backend';

async function test_createUserProfile() {
  const start = Date.now();
  try {
    const profile = await prisma.user_profiles.upsert({
      where: { userId: TEST_USER_ID },
      create: {
        userId: TEST_USER_ID,
        name: 'Test User',
        role: 'developer',
        expertiseLevel: 'intermediate'
      },
      update: {
        name: 'Test User',
        role: 'developer'
      }
    });

    const passed = !!profile.id;
    results.push({
      test: 'createUserProfile',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'createUserProfile',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_createUserPreference() {
  const start = Date.now();
  try {
    const preference = await prisma.user_preferences_memory.create({
      data: {
        userId: TEST_USER_ID,
        preferenceType: 'response_format',
        preferenceValue: 'detailed',
        confidence: 0.8
      }
    });

    const passed = !!preference.id;
    results.push({
      test: 'createUserPreference',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'createUserPreference',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_createConversationTopic() {
  const start = Date.now();
  try {
    const topic = await prisma.conversation_topics.create({
      data: {
        userId: TEST_USER_ID,
        topicSummary: 'User frequently discusses AI and ML',
        firstSeen: new Date(),
        lastSeen: new Date(),
        frequency: 5,
        confidence: 0.9
      }
    });

    const passed = !!topic.id;
    results.push({
      test: 'createConversationTopic',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'createConversationTopic',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_getUserMemory() {
  const start = Date.now();
  try {
    const [profile, preferences, topics] = await Promise.all([
      prisma.user_profiles.findUnique({ where: { userId: TEST_USER_ID } }),
      prisma.user_preferences_memory.findMany({ where: { userId: TEST_USER_ID } }),
      prisma.conversation_topics.findMany({ where: { userId: TEST_USER_ID } })
    ]);

    const passed = !!profile && Array.isArray(preferences) && Array.isArray(topics);
    results.push({
      test: 'getUserMemory',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'getUserMemory',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

export async function runTests() {
  await test_createUserProfile();
  await test_createUserPreference();
  await test_createConversationTopic();
  await test_getUserMemory();
  return results;
}
