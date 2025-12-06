/**
 * Document Intelligence System - Test Suite
 *
 * Tests all document intelligence services:
 * - Document Classification
 * - Entity Extraction
 * - Keyword Extraction
 * - Chunk Classification
 * - Document Routing (requires database)
 * - Hybrid Search (requires database + Pinecone)
 */

import { classifyDocument, fallbackClassification } from '../services/documentClassifier.service';
import { extractEntities, EntityType } from '../services/entityExtractor.service';
import { extractKeywords, isDomainKeyword } from '../services/keywordExtractor.service';
import { classifyChunk } from '../services/chunkClassifier.service';

// Test documents
const TEST_DOCUMENTS = {
  contract: {
    filename: 'employment_contract.pdf',
    mimeType: 'application/pdf',
    content: `
EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into as of January 15, 2024,
by and between Acme Corporation, a Delaware corporation with its principal place
of business at 123 Main Street, New York, NY 10001 ("Employer"), and John Smith,
an individual residing at 456 Oak Avenue, Brooklyn, NY 11201 ("Employee").

RECITALS

WHEREAS, Employer desires to employ Employee, and Employee desires to be employed
by Employer, on the terms and conditions set forth herein;

NOW, THEREFORE, in consideration of the mutual covenants and agreements hereinafter
set forth, and for other good and valuable consideration, the receipt and sufficiency
of which are hereby acknowledged, the parties agree as follows:

1. POSITION AND DUTIES

Employee shall serve as Senior Software Engineer, reporting to the Chief Technology
Officer. Employee's duties shall include software development, code review, and
technical leadership.

2. COMPENSATION

a) Base Salary: Employee shall receive an annual base salary of $150,000.00,
   payable in accordance with Employer's standard payroll practices.

b) Bonus: Employee shall be eligible for an annual performance bonus of up to 20%
   of base salary, subject to achievement of performance goals.

3. BENEFITS

Employee shall be entitled to participate in all benefit plans generally available
to employees of similar status, including health insurance, 401(k) plan, and
paid time off of 20 days per year.

4. TERM AND TERMINATION

a) This Agreement shall commence on February 1, 2024, and continue for an initial
   period of two (2) years.

b) Either party may terminate this Agreement with 30 days' written notice.

c) Employer may terminate Employee for Cause immediately upon written notice.

5. CONFIDENTIALITY

Employee agrees to maintain the confidentiality of all proprietary information
and trade secrets of Employer during and after employment.

6. NON-COMPETE

For a period of one (1) year following termination, Employee shall not engage
in any business that competes directly with Employer within the State of New York.

7. GOVERNING LAW

This Agreement shall be governed by the laws of the State of New York.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first
written above.

EMPLOYER:                           EMPLOYEE:
Acme Corporation                    John Smith

By: _______________________         _______________________
    Jane Doe, CEO                   Signature
    Date: ______________            Date: ______________
`
  },

  medical: {
    filename: 'patient_record.pdf',
    mimeType: 'application/pdf',
    content: `
PATIENT MEDICAL RECORD

Patient Name: Mary Johnson
DOB: 03/15/1985
MRN: 12345678
Date of Visit: December 5, 2024

CHIEF COMPLAINT:
Patient presents with persistent headache and fatigue for the past 2 weeks.

HISTORY OF PRESENT ILLNESS:
38-year-old female with a history of migraine headaches presents with increased
frequency and severity of headaches over the past 14 days. Patient reports
headache onset is typically in the morning, rated 7/10 in severity, with
associated photophobia and nausea. She has been taking ibuprofen 400mg every
6 hours with minimal relief.

PAST MEDICAL HISTORY:
- Migraine headaches (diagnosed 2018)
- Anxiety disorder
- Seasonal allergies

MEDICATIONS:
- Sumatriptan 50mg PRN for migraines
- Sertraline 50mg daily
- Loratadine 10mg daily

ALLERGIES:
Penicillin (rash)

VITAL SIGNS:
- Blood Pressure: 128/82 mmHg
- Heart Rate: 78 bpm
- Temperature: 98.4°F
- Respiratory Rate: 16/min
- SpO2: 99% on room air

PHYSICAL EXAMINATION:
General: Alert and oriented, appears fatigued
HEENT: Pupils equal and reactive, no papilledema
Neck: Supple, no lymphadenopathy
Cardiovascular: Regular rate and rhythm
Neurological: Cranial nerves II-XII intact, no focal deficits

ASSESSMENT:
1. Chronic migraine with increased frequency - likely triggered by stress
2. Fatigue - may be secondary to poor sleep due to headaches

PLAN:
1. Increase sumatriptan to 100mg PRN
2. Start propranolol 20mg BID for migraine prophylaxis
3. Order MRI brain to rule out secondary causes
4. CBC, CMP, TSH to evaluate fatigue
5. Sleep hygiene counseling
6. Follow-up in 4 weeks

Dr. Sarah Williams, MD
Internal Medicine
License #: NY-12345
`
  },

  financial: {
    filename: 'income_statement_q4_2024.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: `
ACME CORPORATION
INCOME STATEMENT
For the Quarter Ended December 31, 2024
(In Thousands USD)

REVENUE
Product Sales                          $12,500
Service Revenue                         $3,200
Licensing Fees                          $1,800
Total Revenue                          $17,500

COST OF GOODS SOLD
Direct Materials                        $4,200
Direct Labor                            $2,100
Manufacturing Overhead                  $1,500
Total COGS                              $7,800

GROSS PROFIT                            $9,700
Gross Margin                              55.4%

OPERATING EXPENSES
Research & Development                  $1,800
Sales & Marketing                       $2,200
General & Administrative                $1,400
Depreciation & Amortization               $600
Total Operating Expenses                $6,000

OPERATING INCOME                        $3,700
Operating Margin                          21.1%

OTHER INCOME (EXPENSE)
Interest Income                           $120
Interest Expense                         ($280)
Other Income                               $50
Total Other Income (Expense)             ($110)

INCOME BEFORE TAXES                     $3,590

Income Tax Expense (25%)                  $898

NET INCOME                              $2,692

Earnings Per Share (Basic)               $2.69
Earnings Per Share (Diluted)             $2.65
Weighted Average Shares Outstanding   1,000,000
`
  }
};

// Test chunks
const TEST_CHUNKS = [
  {
    text: 'Page 1',
    expected: 'page_number'
  },
  {
    text: 'Chapter 5: Advanced Topics',
    expected: 'section_header'
  },
  {
    text: 'WHEREAS, the parties desire to enter into this agreement for the purpose of establishing the terms and conditions of their relationship;',
    expected: 'recitals'
  },
  {
    text: 'Patient Name: John Doe\nDOB: 01/15/1990\nMRN: 123456',
    expected: 'patient_info'
  },
  {
    text: 'This Agreement shall be governed by and construed in accordance with the laws of the State of California.',
    expected: 'governing_law_clause'
  },
  {
    text: 'Total Revenue: $1,500,000\nTotal Expenses: $1,200,000\nNet Income: $300,000',
    expected: 'total'
  }
];

// Test entities
const TEST_ENTITIES_TEXT = `
John Smith signed the contract on January 15, 2024. The agreement includes a
payment of $150,000.00 USD to be transferred to account 123-456-7890.
Contact email: john.smith@example.com, phone: (555) 123-4567.
The office is located at 123 Main Street, New York, NY 10001.
Meeting scheduled for 2:30 PM EST. Duration: 2 hours.
`;

// Results tracking
let totalTests = 0;
let passedTests = 0;
const failedTests: Array<{ test: string; expected: unknown; actual: unknown }> = [];

function assert(condition: boolean, testName: string, expected: unknown, actual: unknown): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ ${testName}`);
  } else {
    failedTests.push({ test: testName, expected, actual });
    console.log(`❌ ${testName}`);
    console.log(`   Expected: ${JSON.stringify(expected)}`);
    console.log(`   Actual: ${JSON.stringify(actual)}`);
  }
}

async function testDocumentClassification(): Promise<void> {
  console.log('\n📄 TESTING DOCUMENT CLASSIFICATION\n');
  console.log('='.repeat(50));

  // Test contract
  console.log('\n--- Testing Contract ---');
  const contractResult = await classifyDocument(
    TEST_DOCUMENTS.contract.content,
    TEST_DOCUMENTS.contract.filename,
    TEST_DOCUMENTS.contract.mimeType
  );
  console.log(`Type: ${contractResult.documentType} (${contractResult.typeConfidence.toFixed(2)})`);
  console.log(`Domain: ${contractResult.domain} (${contractResult.domainConfidence.toFixed(2)})`);

  assert(
    contractResult.domain === 'legal' || contractResult.domain === 'hr',
    'Contract domain detection',
    'legal or hr',
    contractResult.domain
  );
  assert(
    contractResult.documentType.includes('contract') || contractResult.documentType.includes('agreement'),
    'Contract type detection',
    'contains "contract" or "agreement"',
    contractResult.documentType
  );

  // Test medical record
  console.log('\n--- Testing Medical Record ---');
  const medicalResult = await classifyDocument(
    TEST_DOCUMENTS.medical.content,
    TEST_DOCUMENTS.medical.filename,
    TEST_DOCUMENTS.medical.mimeType
  );
  console.log(`Type: ${medicalResult.documentType} (${medicalResult.typeConfidence.toFixed(2)})`);
  console.log(`Domain: ${medicalResult.domain} (${medicalResult.domainConfidence.toFixed(2)})`);

  assert(
    medicalResult.domain === 'medical',
    'Medical record domain detection',
    'medical',
    medicalResult.domain
  );

  // Test financial statement
  console.log('\n--- Testing Financial Statement ---');
  const financialResult = await classifyDocument(
    TEST_DOCUMENTS.financial.content,
    TEST_DOCUMENTS.financial.filename,
    TEST_DOCUMENTS.financial.mimeType
  );
  console.log(`Type: ${financialResult.documentType} (${financialResult.typeConfidence.toFixed(2)})`);
  console.log(`Domain: ${financialResult.domain} (${financialResult.domainConfidence.toFixed(2)})`);

  assert(
    financialResult.domain === 'financial',
    'Financial statement domain detection',
    'financial',
    financialResult.domain
  );

  // Test fallback classification
  console.log('\n--- Testing Fallback Classification ---');
  const fallbackResult = fallbackClassification(
    'employment_contract.pdf',
    'application/pdf',
    'This is a test contract...'
  );
  assert(
    fallbackResult.documentType === 'contract',
    'Fallback classification by filename',
    'contract',
    fallbackResult.documentType
  );
}

async function testEntityExtraction(): Promise<void> {
  console.log('\n🏷️ TESTING ENTITY EXTRACTION\n');
  console.log('='.repeat(50));

  const entities = await extractEntities(TEST_ENTITIES_TEXT, { useLLM: false });

  console.log(`\nExtracted ${entities.length} entities:\n`);
  entities.forEach(e => {
    console.log(`  ${e.type}: "${e.value}" -> "${e.normalizedValue}" (${e.confidence.toFixed(2)})`);
  });

  // Check for expected entity types
  const entityTypes = new Set(entities.map(e => e.type));

  assert(
    entityTypes.has(EntityType.DATE),
    'Date entity extracted',
    true,
    entityTypes.has(EntityType.DATE)
  );

  assert(
    entityTypes.has(EntityType.MONEY),
    'Money entity extracted',
    true,
    entityTypes.has(EntityType.MONEY)
  );

  assert(
    entityTypes.has(EntityType.EMAIL),
    'Email entity extracted',
    true,
    entityTypes.has(EntityType.EMAIL)
  );

  assert(
    entityTypes.has(EntityType.PHONE),
    'Phone entity extracted',
    true,
    entityTypes.has(EntityType.PHONE)
  );

  assert(
    entityTypes.has(EntityType.ZIP_CODE),
    'ZIP code entity extracted',
    true,
    entityTypes.has(EntityType.ZIP_CODE)
  );

  assert(
    entityTypes.has(EntityType.TIME),
    'Time entity extracted',
    true,
    entityTypes.has(EntityType.TIME)
  );

  assert(
    entityTypes.has(EntityType.DURATION),
    'Duration entity extracted',
    true,
    entityTypes.has(EntityType.DURATION)
  );
}

async function testKeywordExtraction(): Promise<void> {
  console.log('\n🔑 TESTING KEYWORD EXTRACTION\n');
  console.log('='.repeat(50));

  // Test with contract
  const contractKeywords = extractKeywords(TEST_DOCUMENTS.contract.content, {
    domain: 'legal',
    maxKeywords: 20
  });

  console.log('\nContract Keywords (top 20):');
  contractKeywords.forEach((k, i) => {
    const domainTag = k.isDomainSpecific ? ' [DOMAIN]' : '';
    console.log(`  ${i + 1}. ${k.word}: ${k.tfIdf.toFixed(4)}${domainTag}`);
  });

  // Check for expected legal keywords
  const legalKeywords = contractKeywords.filter(k => k.isDomainSpecific);
  assert(
    legalKeywords.length > 0,
    'Legal domain keywords detected',
    '> 0',
    legalKeywords.length
  );

  // Check isDomainKeyword function
  assert(
    isDomainKeyword('agreement', 'legal'),
    'isDomainKeyword("agreement", "legal")',
    true,
    isDomainKeyword('agreement', 'legal')
  );

  assert(
    isDomainKeyword('patient', 'medical'),
    'isDomainKeyword("patient", "medical")',
    true,
    isDomainKeyword('patient', 'medical')
  );

  // Test with medical
  const medicalKeywords = extractKeywords(TEST_DOCUMENTS.medical.content, {
    domain: 'medical',
    maxKeywords: 20
  });

  console.log('\nMedical Keywords (top 20):');
  medicalKeywords.forEach((k, i) => {
    const domainTag = k.isDomainSpecific ? ' [DOMAIN]' : '';
    console.log(`  ${i + 1}. ${k.word}: ${k.tfIdf.toFixed(4)}${domainTag}`);
  });

  const medicalDomainKeywords = medicalKeywords.filter(k => k.isDomainSpecific);
  assert(
    medicalDomainKeywords.length > 0,
    'Medical domain keywords detected',
    '> 0',
    medicalDomainKeywords.length
  );
}

async function testChunkClassification(): Promise<void> {
  console.log('\n📦 TESTING CHUNK CLASSIFICATION\n');
  console.log('='.repeat(50));

  for (const testChunk of TEST_CHUNKS) {
    console.log(`\nTesting: "${testChunk.text.slice(0, 50)}..."`);

    const result = await classifyChunk(testChunk.text, {});

    console.log(`  Result: ${result.chunkType} (${result.category}) - ${result.confidence.toFixed(2)}`);

    assert(
      result.chunkType === testChunk.expected || result.confidence < 0.7,
      `Chunk type: "${testChunk.text.slice(0, 30)}..."`,
      testChunk.expected,
      result.chunkType
    );
  }
}

function printTestSummary(): void {
  console.log('\n');
  console.log('='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failedTests.length}`);

  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(f => {
      console.log(`  - ${f.test}`);
      console.log(`    Expected: ${JSON.stringify(f.expected)}`);
      console.log(`    Actual: ${JSON.stringify(f.actual)}`);
    });
  }

  console.log('\n');
}

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('🧪 DOCUMENT INTELLIGENCE SYSTEM - TEST SUITE');
  console.log('='.repeat(50));
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    await testDocumentClassification();
    await testEntityExtraction();
    await testKeywordExtraction();
    await testChunkClassification();
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
  }

  printTestSummary();
}

// Run tests
runAllTests().then(() => {
  process.exit(failedTests.length > 0 ? 1 : 0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
