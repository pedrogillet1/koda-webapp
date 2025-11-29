import fileCreationService from '../services/fileCreation.service';
import prisma from '../config/database';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
const TEST_USER_ID = 'test-user-backend';
const TEST_CONV_ID = 'test-conv-backend';

async function test_createMarkdownFile() {
  const start = Date.now();
  try {
    const result = await fileCreationService.createFile({
      userId: TEST_USER_ID,
      conversationId: TEST_CONV_ID,
      topic: 'Test Markdown Document',
      fileType: 'md',
      additionalContext: 'Create a test markdown file'
    });

    const passed = result.success && result.fileName.endsWith('.md');
    results.push({
      test: 'createFile: markdown',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'createFile: markdown',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_createPDFFile() {
  const start = Date.now();
  try {
    const result = await fileCreationService.createFile({
      userId: TEST_USER_ID,
      conversationId: TEST_CONV_ID,
      topic: 'Test PDF Document',
      fileType: 'pdf',
      additionalContext: 'Create a test PDF file'
    });

    const passed = result.success && result.fileName.endsWith('.pdf');
    results.push({
      test: 'createFile: pdf',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'createFile: pdf',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_createDOCXFile() {
  const start = Date.now();
  try {
    const result = await fileCreationService.createFile({
      userId: TEST_USER_ID,
      conversationId: TEST_CONV_ID,
      topic: 'Test DOCX Document',
      fileType: 'docx',
      additionalContext: 'Create a test DOCX file'
    });

    const passed = result.success && result.fileName.endsWith('.docx');
    results.push({
      test: 'createFile: docx',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'createFile: docx',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

export async function runTests() {
  await test_createMarkdownFile();
  await test_createPDFFile();
  await test_createDOCXFile();
  return results;
}
