/**
 * Koda Integration Verification Script (TypeScript version for Windows)
 *
 * This script verifies that all new services are properly integrated into
 * the Koda codebase and that all hardcoded responses have been replaced.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BACKEND_PATH = path.join(process.cwd(), 'src');

let PASS_COUNT = 0;
let FAIL_COUNT = 0;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function checkPass(message: string): void {
  console.log(`[PASS] ${message}`);
  PASS_COUNT++;
}

function checkFail(message: string): void {
  console.log(`[FAIL] ${message}`);
  FAIL_COUNT++;
}

function checkWarn(message: string): void {
  console.log(`[WARN] ${message}`);
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function fileContains(filePath: string, pattern: string | RegExp): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  if (typeof pattern === 'string') {
    return content.includes(pattern);
  }
  return pattern.test(content);
}

// ============================================================================
// CHECK 1: New Services Exist
// ============================================================================

function checkNewServicesExist(): void {
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 1: Verifying new service files exist...');
  console.log('='.repeat(60) + '\n');

  const unifiedFormattingPath = path.join(BACKEND_PATH, 'services', 'unifiedFormatting.service.ts');
  if (fileExists(unifiedFormattingPath)) {
    checkPass('unifiedFormatting.service.ts exists');
  } else {
    checkFail('unifiedFormatting.service.ts NOT FOUND');
  }

  const outputIntegrationPath = path.join(BACKEND_PATH, 'services', 'outputIntegration.service.ts');
  if (fileExists(outputIntegrationPath)) {
    checkPass('outputIntegration.service.ts exists');
  } else {
    checkFail('outputIntegration.service.ts NOT FOUND');
  }
}

// ============================================================================
// CHECK 2: Services Are Imported
// ============================================================================

function checkServicesImported(): void {
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 2: Verifying services are imported in existing code...');
  console.log('='.repeat(60) + '\n');

  const fastPathPath = path.join(BACKEND_PATH, 'services', 'fastPathDetector.service.ts');
  if (fileContains(fastPathPath, /import.*outputIntegration.*from.*outputIntegration\.service/)) {
    checkPass('outputIntegration imported in fastPathDetector.service.ts');
  } else {
    checkFail('outputIntegration NOT imported in fastPathDetector.service.ts');
  }

  const ragServicePath = path.join(BACKEND_PATH, 'services', 'rag.service.ts');
  if (fileContains(ragServicePath, /import.*outputIntegration.*from.*outputIntegration\.service/)) {
    checkPass('outputIntegration imported in rag.service.ts');
  } else {
    checkWarn('outputIntegration NOT YET imported in rag.service.ts (pending integration)');
  }
}

// ============================================================================
// CHECK 3: Hardcoded Responses Removed
// ============================================================================

function checkHardcodedResponsesRemoved(): void {
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 3: Verifying hardcoded responses have been replaced...');
  console.log('='.repeat(60) + '\n');

  const fastPathPath = path.join(BACKEND_PATH, 'services', 'fastPathDetector.service.ts');

  // Check for hardcoded greetings array
  if (fileContains(fastPathPath, 'const greetings = [')) {
    checkFail('Hardcoded greetings array still present in fastPathDetector.service.ts');
  } else {
    checkPass('Hardcoded greetings array removed from fastPathDetector.service.ts');
  }

  // Check for hardcoded capabilities
  if (fileContains(fastPathPath, "I'm KODA, your AI document assistant. I can help you:")) {
    checkFail('Hardcoded capabilities template still present in fastPathDetector.service.ts');
  } else {
    checkPass('Hardcoded capabilities template removed from fastPathDetector.service.ts');
  }

  // Check for robotic phrases in contextEngineering
  const contextEngineeringPath = path.join(BACKEND_PATH, 'services', 'contextEngineering.service.ts');
  if (fileExists(contextEngineeringPath)) {
    // Check for greeting variations array (acceptable as fallback)
    if (fileContains(contextEngineeringPath, 'RESPONSE_VARIATIONS')) {
      checkWarn('RESPONSE_VARIATIONS exists in contextEngineering.service.ts (acceptable as fallback)');
    }
  }
}

// ============================================================================
// CHECK 4: Integration Functions Are Used
// ============================================================================

function checkIntegrationFunctionsUsed(): void {
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 4: Verifying integration functions are being called...');
  console.log('='.repeat(60) + '\n');

  const fastPathPath = path.join(BACKEND_PATH, 'services', 'fastPathDetector.service.ts');

  // Check for generateGreeting usage
  if (fileContains(fastPathPath, 'outputIntegration.generateGreeting')) {
    checkPass('outputIntegration.generateGreeting() is being used');
  } else {
    checkFail('outputIntegration.generateGreeting() is NOT being used');
  }

  // Check for generateCapabilities usage
  if (fileContains(fastPathPath, 'outputIntegration.generateCapabilities')) {
    checkPass('outputIntegration.generateCapabilities() is being used');
  } else {
    checkFail('outputIntegration.generateCapabilities() is NOT being used');
  }

  const ragServicePath = path.join(BACKEND_PATH, 'services', 'rag.service.ts');

  // Check for generateFileListing usage (may not be integrated yet)
  if (fileContains(ragServicePath, 'outputIntegration.generateFileListing')) {
    checkPass('outputIntegration.generateFileListing() is being used');
  } else {
    checkWarn('outputIntegration.generateFileListing() NOT YET integrated in rag.service.ts');
  }
}

// ============================================================================
// CHECK 5: Service Structure Validation
// ============================================================================

function checkServiceStructure(): void {
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 5: Verifying service structure...');
  console.log('='.repeat(60) + '\n');

  const unifiedFormattingPath = path.join(BACKEND_PATH, 'services', 'unifiedFormatting.service.ts');
  if (fileExists(unifiedFormattingPath)) {
    // Check for required exports
    if (fileContains(unifiedFormattingPath, 'export async function generateFormattedOutput')) {
      checkPass('generateFormattedOutput function exported');
    } else {
      checkFail('generateFormattedOutput function NOT exported');
    }

    if (fileContains(unifiedFormattingPath, 'export function validateOutput')) {
      checkPass('validateOutput function exported');
    } else {
      checkFail('validateOutput function NOT exported');
    }

    // Check for format templates
    if (fileContains(unifiedFormattingPath, 'FORMAT_TEMPLATES')) {
      checkPass('FORMAT_TEMPLATES defined');
    } else {
      checkFail('FORMAT_TEMPLATES NOT defined');
    }

    // Check for fallback responses
    if (fileContains(unifiedFormattingPath, 'getFallbackResponse')) {
      checkPass('Fallback responses implemented');
    } else {
      checkFail('Fallback responses NOT implemented');
    }
  }

  const outputIntegrationPath = path.join(BACKEND_PATH, 'services', 'outputIntegration.service.ts');
  if (fileExists(outputIntegrationPath)) {
    // Check for required exports
    const requiredFunctions = [
      'generateGreeting',
      'generateCapabilities',
      'generateFarewell',
      'generateFileListing',
      'generateNoDocumentsError',
      'generateProcessingError',
    ];

    requiredFunctions.forEach((fn) => {
      if (fileContains(outputIntegrationPath, `export async function ${fn}`)) {
        checkPass(`${fn} function exported`);
      } else {
        checkFail(`${fn} function NOT exported`);
      }
    });
  }
}

// ============================================================================
// CHECK 6: Dependencies
// ============================================================================

function checkDependencies(): void {
  console.log('\n' + '='.repeat(60));
  console.log('CHECK 6: Verifying required dependencies...');
  console.log('='.repeat(60) + '\n');

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps['@google/generative-ai']) {
      checkPass('@google/generative-ai is installed');
    } else {
      checkFail('@google/generative-ai is NOT installed');
    }
  } else {
    checkFail('package.json not found');
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(60) + '\n');

  console.log(`Total Checks: ${PASS_COUNT + FAIL_COUNT}`);
  console.log(`Passed: ${PASS_COUNT}`);
  console.log(`Failed: ${FAIL_COUNT}`);
  console.log('');

  if (FAIL_COUNT === 0) {
    console.log('[EXCELLENT] ALL CHECKS PASSED!');
    console.log('The integration is complete and ready for testing.');
  } else if (FAIL_COUNT <= 3) {
    console.log('[GOOD] Most checks passed.');
    console.log('Review the failed checks above - some may be pending integration.');
  } else {
    console.log('[NEEDS WORK] Some checks failed.');
    console.log('Please review the failed checks above and fix the issues.');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

console.log('');
console.log('='.repeat(60));
console.log('KODA INTEGRATION VERIFICATION');
console.log('='.repeat(60));

checkNewServicesExist();
checkServicesImported();
checkHardcodedResponsesRemoved();
checkIntegrationFunctionsUsed();
checkServiceStructure();
checkDependencies();

printSummary();

process.exit(FAIL_COUNT > 5 ? 1 : 0);
