import { llmIntentDetectorService } from '../services/llmIntentDetector.service';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test_createFile() {
  const start = Date.now();
  try {
    const result = await llmIntentDetectorService.detectIntent(
      'Create a markdown file about Q4 sales',
      []
    );

    const passed = result.intent === 'create_file' && result.parameters.topic;
    results.push({
      test: 'detectIntent: create_file',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'detectIntent: create_file',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_createFolder() {
  const start = Date.now();
  try {
    const result = await llmIntentDetectorService.detectIntent(
      'Create a folder called Marketing',
      []
    );

    const passed = result.intent === 'create_folder' && result.parameters.folderName;
    results.push({
      test: 'detectIntent: create_folder',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'detectIntent: create_folder',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_listFiles() {
  const start = Date.now();
  try {
    const result = await llmIntentDetectorService.detectIntent(
      'Show me all my files',
      []
    );

    const passed = result.intent === 'list_files';
    results.push({
      test: 'detectIntent: list_files',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'detectIntent: list_files',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_searchFiles() {
  const start = Date.now();
  try {
    const result = await llmIntentDetectorService.detectIntent(
      'Find documents about marketing',
      []
    );

    const passed = result.intent === 'search_files' && result.parameters.searchTerm;
    results.push({
      test: 'detectIntent: search_files',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'detectIntent: search_files',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_calculation() {
  const start = Date.now();
  try {
    const result = await llmIntentDetectorService.detectIntent(
      'What is 25 * 4 + 10?',
      []
    );

    const passed = result.intent === 'calculation';
    results.push({
      test: 'detectIntent: calculation',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'detectIntent: calculation',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_generalQuery() {
  const start = Date.now();
  try {
    const result = await llmIntentDetectorService.detectIntent(
      'What is photosynthesis?',
      []
    );

    const passed = result.intent === 'general_query';
    results.push({
      test: 'detectIntent: general_query',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'detectIntent: general_query',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

export async function runTests() {
  await test_createFile();
  await test_createFolder();
  await test_listFiles();
  await test_searchFiles();
  await test_calculation();
  await test_generalQuery();
  return results;
}
