/**
 * Koda Answer Quality Test Suite
 *
 * Tests the QUALITY and CORRECTNESS of Koda's generated answers
 * against expected content from real financial documents.
 *
 * This is NOT a pass/fail test - it evaluates answer quality on multiple dimensions:
 * - Accuracy: Does the answer contain correct information?
 * - Completeness: Does it cover all expected points?
 * - Relevance: Does it stay on topic?
 * - Specificity: Does it provide specific data vs generic responses?
 */

import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'localhost@koda.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'localhost123';

let authToken: string = '';

// ============================================================================
// TEST DEFINITIONS WITH EXPECTED CONTENT
// ============================================================================

interface QualityTest {
  id: number;
  category: string;
  question: string;
  expectedContent: {
    mustMention: string[];      // Key terms/values that MUST appear
    shouldMention: string[];    // Terms that SHOULD appear for completeness
    specificData: string[];     // Specific numbers/values expected
    context: string;            // What the answer should be about
  };
  difficulty: 'simple' | 'moderate' | 'complex';
}

const QUALITY_TESTS: QualityTest[] = [
  // ============================================================================
  // CATEGORY 1: SIMPLE DATA EXTRACTION (10 Questions)
  // ============================================================================
  {
    id: 1,
    category: 'Simple Data Extraction',
    question: 'What is the total revenue for Lone Mountain Ranch in 2024?',
    expectedContent: {
      mustMention: ['revenue', '2024', 'Lone Mountain'],
      shouldMention: ['total', 'income', 'P&L'],
      specificData: ['$', 'million', 'M'],
      context: 'Should provide revenue figure from LoneMountainRanchP&L2024.xlsx'
    },
    difficulty: 'simple'
  },
  {
    id: 2,
    category: 'Simple Data Extraction',
    question: 'How many sheets are in the RosewoodFund file?',
    expectedContent: {
      mustMention: ['Rosewood', 'sheet'],
      shouldMention: ['2', 'two', 'MoIC', 'IRR'],
      specificData: ['2', 'two'],
      context: 'Should identify 2 sheets: Rosewood Fund and MoICs into IRRs'
    },
    difficulty: 'simple'
  },
  {
    id: 3,
    category: 'Simple Data Extraction',
    question: 'What is the budget year for the improvement plan?',
    expectedContent: {
      mustMention: ['2025', 'improvement', 'plan'],
      shouldMention: ['$63', 'million', 'LMR', 'capital'],
      specificData: ['2025', '63'],
      context: 'Should identify 2025 and $63M from LMRImprovementPlan202503'
    },
    difficulty: 'simple'
  },
  {
    id: 4,
    category: 'Simple Data Extraction',
    question: 'List all the property names in the Rosewood Fund.',
    expectedContent: {
      mustMention: ['Rosewood', 'property', 'properties'],
      shouldMention: ['Carlyle', 'Lone Mountain', 'Baxter', 'Hotel', 'Ranch'],
      specificData: ['Carlyle', 'Lone Mountain Ranch', 'Baxter Hotel'],
      context: 'Should list the 3 properties in the fund'
    },
    difficulty: 'simple'
  },
  {
    id: 5,
    category: 'Simple Data Extraction',
    question: 'What is the total capital expenditure (Capex) in the improvement plan?',
    expectedContent: {
      mustMention: ['capital', 'expenditure', 'capex', '$63', 'million'],
      shouldMention: ['improvement', 'plan', 'PIP', 'total'],
      specificData: ['63', 'million', '$63M'],
      context: 'Should identify $63 million total capex'
    },
    difficulty: 'simple'
  },
  {
    id: 6,
    category: 'Simple Data Extraction',
    question: 'What is the date range covered in the 2024 P&L?',
    expectedContent: {
      mustMention: ['2024', 'December', 'year'],
      shouldMention: ['12/31', 'full year', 'period'],
      specificData: ['2024', '12/31/2024', 'December'],
      context: 'Should identify full year 2024 ending December 31'
    },
    difficulty: 'simple'
  },
  {
    id: 7,
    category: 'Simple Data Extraction',
    question: 'What is the location group mentioned in the P&L files?',
    expectedContent: {
      mustMention: ['Big Sky', 'Ranch', 'Partners'],
      shouldMention: ['location', 'group', 'header'],
      specificData: ['BIG SKY RANCH PARTNERS'],
      context: 'Should identify BIG SKY RANCH PARTNERS as the location group'
    },
    difficulty: 'simple'
  },
  {
    id: 8,
    category: 'Simple Data Extraction',
    question: 'How many documents do I have about Lone Mountain Ranch?',
    expectedContent: {
      mustMention: ['Lone Mountain', 'document', 'file'],
      shouldMention: ['P&L', '2024', '2025', 'improvement', 'budget'],
      specificData: ['3', 'three', '4', 'four'],
      context: 'Should count LMR-related files (P&L 2024, P&L 2025, Improvement Plan)'
    },
    difficulty: 'simple'
  },
  {
    id: 9,
    category: 'Simple Data Extraction',
    question: 'What type of file is the Koda Presentation?',
    expectedContent: {
      mustMention: ['Koda', 'Presentation', 'PowerPoint', 'pptx'],
      shouldMention: ['slide', 'presentation', 'file'],
      specificData: ['pptx', 'PowerPoint', '.pptx'],
      context: 'Should identify it as a PowerPoint presentation file'
    },
    difficulty: 'simple'
  },
  {
    id: 10,
    category: 'Simple Data Extraction',
    question: 'What are the main expense categories in the 2024 P&L?',
    expectedContent: {
      mustMention: ['expense', 'cost', 'P&L'],
      shouldMention: ['operating', 'payroll', 'utilities', 'maintenance', 'food', 'beverage'],
      specificData: [],
      context: 'Should list major expense categories from the P&L structure'
    },
    difficulty: 'simple'
  },

  // ============================================================================
  // CATEGORY 2: CALCULATIONS & FORMULAS (10 Questions)
  // ============================================================================
  {
    id: 11,
    category: 'Calculations & Formulas',
    question: 'What is the MoIC (Multiple on Invested Capital) for Carlyle in the Rosewood Fund?',
    expectedContent: {
      mustMention: ['MoIC', 'Carlyle', 'multiple'],
      shouldMention: ['1.5', 'invested', 'capital', 'return'],
      specificData: ['1.5', '1.5x'],
      context: 'Should identify MoIC of 1.5x for Carlyle property'
    },
    difficulty: 'moderate'
  },
  {
    id: 12,
    category: 'Calculations & Formulas',
    question: 'How is the IRR calculated in the RosewoodFund file?',
    expectedContent: {
      mustMention: ['IRR', 'Internal Rate of Return', 'formula'],
      shouldMention: ['cash flow', 'IFERROR', 'discount', 'rate'],
      specificData: ['IRR', '15%', '0.15'],
      context: 'Should explain IRR formula and methodology'
    },
    difficulty: 'moderate'
  },
  {
    id: 13,
    category: 'Calculations & Formulas',
    question: 'What is the total investment across all properties in the Rosewood Fund?',
    expectedContent: {
      mustMention: ['investment', 'total', 'Rosewood'],
      shouldMention: ['$15', 'million', 'properties', 'Carlyle', 'Lone Mountain', 'Baxter'],
      specificData: ['15', '$15M', '15 million'],
      context: 'Should sum investments: Carlyle $5M + LMR $6M + Baxter $4M = $15M'
    },
    difficulty: 'moderate'
  },
  {
    id: 14,
    category: 'Calculations & Formulas',
    question: 'What is the Return on Cost for Phase 1 of the improvement plan?',
    expectedContent: {
      mustMention: ['Return on Cost', 'ROC', 'Phase 1'],
      shouldMention: ['NOI', 'capex', 'improvement', '%'],
      specificData: ['10%', '10', 'percent'],
      context: 'Should calculate ROC = NOI Improvement / Capex'
    },
    difficulty: 'moderate'
  },
  {
    id: 15,
    category: 'Calculations & Formulas',
    question: 'Explain how the IFERROR function works in the MoIC calculation.',
    expectedContent: {
      mustMention: ['IFERROR', 'error', 'division'],
      shouldMention: ['zero', '#DIV/0', 'return', 'formula'],
      specificData: ['0', 'DIV'],
      context: 'Should explain IFERROR prevents division by zero errors'
    },
    difficulty: 'moderate'
  },
  {
    id: 16,
    category: 'Calculations & Formulas',
    question: 'What does the Capex/Cabin metric tell us in the improvement plan?',
    expectedContent: {
      mustMention: ['Capex', 'cabin', 'metric'],
      shouldMention: ['cost', 'per', 'unit', 'efficiency', 'comparison'],
      specificData: ['$500', '500K', 'per cabin'],
      context: 'Should explain cost per cabin calculation and its purpose'
    },
    difficulty: 'moderate'
  },
  {
    id: 17,
    category: 'Calculations & Formulas',
    question: 'What is the relationship between NOI Improvement and Return on Cost?',
    expectedContent: {
      mustMention: ['NOI', 'Return on Cost', 'relationship'],
      shouldMention: ['formula', 'capex', 'percentage', 'payback'],
      specificData: ['ROC', 'NOI/Capex'],
      context: 'Should explain ROC = NOI Improvement / Capex formula'
    },
    difficulty: 'moderate'
  },
  {
    id: 18,
    category: 'Calculations & Formulas',
    question: 'What is the Duration field in the MoICs sheet and what does it represent?',
    expectedContent: {
      mustMention: ['Duration', 'years', 'holding period'],
      shouldMention: ['investment', 'timeline', 'exit', 'cash flow'],
      specificData: ['6', 'years', 'Year 0', 'Year 6'],
      context: 'Should explain Duration = 6 years holding period'
    },
    difficulty: 'moderate'
  },
  {
    id: 19,
    category: 'Calculations & Formulas',
    question: 'How would you calculate the year-over-year revenue growth from 2024 to 2025?',
    expectedContent: {
      mustMention: ['growth', 'year-over-year', 'revenue', '2024', '2025'],
      shouldMention: ['formula', 'percentage', 'increase', 'budget'],
      specificData: ['%', 'YoY'],
      context: 'Should explain (2025 - 2024) / 2024 × 100 formula'
    },
    difficulty: 'moderate'
  },
  {
    id: 20,
    category: 'Calculations & Formulas',
    question: 'What is the total equity value in the Rosewood Fund?',
    expectedContent: {
      mustMention: ['equity', 'value', 'Rosewood', 'total'],
      shouldMention: ['$15', 'million', 'fund', 'properties'],
      specificData: ['15', '$15M'],
      context: 'Should identify total equity value from fund summary'
    },
    difficulty: 'moderate'
  },

  // ============================================================================
  // CATEGORY 3: CROSS-DOCUMENT ANALYSIS (10 Questions)
  // ============================================================================
  {
    id: 21,
    category: 'Cross-Document Analysis',
    question: 'Compare total revenue between 2024 actual and 2025 budget.',
    expectedContent: {
      mustMention: ['2024', '2025', 'revenue', 'budget'],
      shouldMention: ['actual', 'comparison', 'growth', 'increase', 'change'],
      specificData: ['$', 'million', '%'],
      context: 'Should compare figures from both P&L files'
    },
    difficulty: 'complex'
  },
  {
    id: 22,
    category: 'Cross-Document Analysis',
    question: 'How does the improvement plan budget relate to the Rosewood Fund investment?',
    expectedContent: {
      mustMention: ['improvement', 'Rosewood', 'investment', 'Lone Mountain'],
      shouldMention: ['$63', 'million', 'capital', 'NOI', 'returns'],
      specificData: ['63', '15', 'million'],
      context: 'Should explain relationship between $63M plan and fund strategy'
    },
    difficulty: 'complex'
  },
  {
    id: 23,
    category: 'Cross-Document Analysis',
    question: 'What is the relationship between the 2025 budget and the improvement plan phases?',
    expectedContent: {
      mustMention: ['2025', 'budget', 'Phase', 'improvement'],
      shouldMention: ['Phase 1', 'post', 'projections', 'NOI'],
      specificData: ['Phase 1', '2025'],
      context: 'Should explain 2025 budget reflects post-Phase 1 performance'
    },
    difficulty: 'complex'
  },
  {
    id: 24,
    category: 'Cross-Document Analysis',
    question: 'Compare the complexity of RosewoodFund vs the P&L files in terms of formulas.',
    expectedContent: {
      mustMention: ['Rosewood', 'P&L', 'formula', 'complex'],
      shouldMention: ['IRR', 'IFERROR', 'SUMIF', 'simple', 'reference'],
      specificData: ['750', '26', 'formulas'],
      context: 'Should compare formula counts and complexity'
    },
    difficulty: 'complex'
  },
  {
    id: 25,
    category: 'Cross-Document Analysis',
    question: 'What financial metrics are common across all your Excel files?',
    expectedContent: {
      mustMention: ['metric', 'financial', 'common'],
      shouldMention: ['revenue', 'NOI', 'ROI', 'returns', 'investment'],
      specificData: [],
      context: 'Should identify shared financial metrics across files'
    },
    difficulty: 'complex'
  },
  {
    id: 26,
    category: 'Cross-Document Analysis',
    question: 'What is the time horizon covered by all financial documents?',
    expectedContent: {
      mustMention: ['time', 'horizon', '2024', '2025'],
      shouldMention: ['period', 'years', 'future', 'phases'],
      specificData: ['2024', '2025', 'years'],
      context: 'Should summarize timeframes: 2024-2025 with multi-year phases'
    },
    difficulty: 'complex'
  },
  {
    id: 27,
    category: 'Cross-Document Analysis',
    question: 'Which document contains the most detailed financial analysis?',
    expectedContent: {
      mustMention: ['Rosewood', 'detailed', 'analysis'],
      shouldMention: ['formula', 'IRR', 'MoIC', 'complex', 'calculation'],
      specificData: ['750', 'formulas'],
      context: 'Should identify RosewoodFund as most complex with 750 formulas'
    },
    difficulty: 'complex'
  },
  {
    id: 28,
    category: 'Cross-Document Analysis',
    question: 'How are the P&L files structured similarly?',
    expectedContent: {
      mustMention: ['P&L', 'structure', 'similar'],
      shouldMention: ['revenue', 'expense', 'Big Sky', 'format', 'layout'],
      specificData: [],
      context: 'Should describe common P&L structure and formatting'
    },
    difficulty: 'complex'
  },
  {
    id: 29,
    category: 'Cross-Document Analysis',
    question: 'What investment strategy is evident from the Rosewood Fund documents?',
    expectedContent: {
      mustMention: ['investment', 'strategy', 'Rosewood'],
      shouldMention: ['value-add', 'improvement', 'hospitality', 'real estate', 'returns'],
      specificData: ['IRR', 'MoIC', '15%'],
      context: 'Should describe value-add real estate investment strategy'
    },
    difficulty: 'complex'
  },
  {
    id: 30,
    category: 'Cross-Document Analysis',
    question: 'Summarize the key financial data points across all your documents.',
    expectedContent: {
      mustMention: ['financial', 'data', 'summary'],
      shouldMention: ['revenue', 'investment', 'capex', 'NOI', 'returns'],
      specificData: ['$63', '$15', 'million'],
      context: 'Should provide overview of key numbers from all files'
    },
    difficulty: 'complex'
  },

  // ============================================================================
  // CATEGORY 4: COMPLEX SYNTHESIS (10 Questions)
  // ============================================================================
  {
    id: 31,
    category: 'Complex Synthesis',
    question: 'What are the main themes across all documents in my collection?',
    expectedContent: {
      mustMention: ['theme', 'document', 'collection'],
      shouldMention: ['finance', 'investment', 'real estate', 'hospitality', 'analysis'],
      specificData: [],
      context: 'Should identify major themes: real estate investment, financial analysis'
    },
    difficulty: 'complex'
  },
  {
    id: 32,
    category: 'Complex Synthesis',
    question: 'Create an executive summary of the Rosewood Fund investment strategy.',
    expectedContent: {
      mustMention: ['Rosewood', 'investment', 'strategy', 'executive'],
      shouldMention: ['portfolio', 'properties', 'returns', 'IRR', 'MoIC', 'value-add'],
      specificData: ['3', 'properties', '$15M', '15%'],
      context: 'Should summarize fund strategy, holdings, and target returns'
    },
    difficulty: 'complex'
  },
  {
    id: 33,
    category: 'Complex Synthesis',
    question: 'Analyze the risk factors present in the Rosewood Fund portfolio.',
    expectedContent: {
      mustMention: ['risk', 'Rosewood', 'portfolio'],
      shouldMention: ['concentration', 'market', 'execution', 'capital', 'hospitality'],
      specificData: ['3', 'properties', '$63M'],
      context: 'Should identify concentration, market, execution risks'
    },
    difficulty: 'complex'
  },
  {
    id: 34,
    category: 'Complex Synthesis',
    question: 'How should the improvement plan be prioritized based on Return on Cost?',
    expectedContent: {
      mustMention: ['improvement', 'prioritize', 'Return on Cost'],
      shouldMention: ['ROC', 'Phase', 'NOI', 'highest', 'capex'],
      specificData: ['10%', '12%'],
      context: 'Should recommend prioritizing highest ROC projects'
    },
    difficulty: 'complex'
  },
  {
    id: 35,
    category: 'Complex Synthesis',
    question: 'Compare the 2024 actual performance to 2025 budget assumptions.',
    expectedContent: {
      mustMention: ['2024', '2025', 'actual', 'budget'],
      shouldMention: ['revenue', 'growth', 'improvement', 'assumption', 'Phase 1'],
      specificData: ['%', 'growth'],
      context: 'Should compare actual vs budget with variance analysis'
    },
    difficulty: 'complex'
  },
  {
    id: 36,
    category: 'Complex Synthesis',
    question: 'What is the implied valuation of Lone Mountain Ranch?',
    expectedContent: {
      mustMention: ['valuation', 'Lone Mountain', 'value'],
      shouldMention: ['NOI', 'cap rate', 'improvement', 'investment'],
      specificData: ['$', 'million'],
      context: 'Should estimate value using NOI and cap rate methodology'
    },
    difficulty: 'complex'
  },
  {
    id: 37,
    category: 'Complex Synthesis',
    question: 'Synthesize the key success factors for the Rosewood Fund.',
    expectedContent: {
      mustMention: ['success', 'factor', 'Rosewood'],
      shouldMention: ['execution', 'market', 'capital', 'returns', 'exit'],
      specificData: [],
      context: 'Should list critical success factors for fund performance'
    },
    difficulty: 'complex'
  },
  {
    id: 38,
    category: 'Complex Synthesis',
    question: 'What additional analysis is needed to fully evaluate the investment?',
    expectedContent: {
      mustMention: ['analysis', 'additional', 'evaluate'],
      shouldMention: ['sensitivity', 'market', 'cash flow', 'stress test', 'scenario'],
      specificData: [],
      context: 'Should recommend additional analyses for investment decision'
    },
    difficulty: 'complex'
  },
  {
    id: 39,
    category: 'Complex Synthesis',
    question: 'What is the overall investment thesis for the Rosewood Fund?',
    expectedContent: {
      mustMention: ['investment', 'thesis', 'Rosewood'],
      shouldMention: ['value-add', 'hospitality', 'improvement', 'returns', 'strategy'],
      specificData: ['IRR', 'MoIC', '15%'],
      context: 'Should articulate the funds investment thesis and strategy'
    },
    difficulty: 'complex'
  },
  {
    id: 40,
    category: 'Complex Synthesis',
    question: 'Write a brief investment recommendation based on all documents.',
    expectedContent: {
      mustMention: ['investment', 'recommendation'],
      shouldMention: ['Rosewood', 'returns', 'risk', 'opportunity', 'proceed'],
      specificData: [],
      context: 'Should provide investment recommendation with rationale'
    },
    difficulty: 'complex'
  },

  // ============================================================================
  // CATEGORY 5: FORMULA & TECHNICAL UNDERSTANDING (10 Questions)
  // ============================================================================
  {
    id: 41,
    category: 'Formula & Technical',
    question: 'Explain how the IRR formula works in the RosewoodFund file.',
    expectedContent: {
      mustMention: ['IRR', 'formula', 'Rosewood'],
      shouldMention: ['cash flow', 'discount', 'rate', 'NPV', 'IFERROR'],
      specificData: ['IRR(', 'J5:T5'],
      context: 'Should explain IRR calculation methodology'
    },
    difficulty: 'complex'
  },
  {
    id: 42,
    category: 'Formula & Technical',
    question: 'What does the SUMIF formula in the RosewoodFund calculate?',
    expectedContent: {
      mustMention: ['SUMIF', 'formula', 'calculate'],
      shouldMention: ['positive', 'negative', 'MoIC', 'returns', 'investment'],
      specificData: ['SUMIF(', '>0', '<0'],
      context: 'Should explain SUMIF separates positive and negative cash flows'
    },
    difficulty: 'complex'
  },
  {
    id: 43,
    category: 'Formula & Technical',
    question: 'Why are there cross-sheet references in the RosewoodFund file?',
    expectedContent: {
      mustMention: ['cross-sheet', 'reference', 'Rosewood'],
      shouldMention: ['data', 'separation', 'modularity', 'link', 'calculation'],
      specificData: ['MoICs into IRRs', 'Rosewood Fund'],
      context: 'Should explain purpose of linking sheets'
    },
    difficulty: 'complex'
  },
  {
    id: 44,
    category: 'Formula & Technical',
    question: 'How would you debug a #DIV/0! error in the MoIC calculation?',
    expectedContent: {
      mustMention: ['DIV/0', 'error', 'debug', 'MoIC'],
      shouldMention: ['denominator', 'zero', 'IFERROR', 'check', 'trace'],
      specificData: ['#DIV/0', 'IFERROR'],
      context: 'Should provide debugging steps for division errors'
    },
    difficulty: 'complex'
  },
  {
    id: 45,
    category: 'Formula & Technical',
    question: 'What is the purpose of the formula =+B60 in the P&L files?',
    expectedContent: {
      mustMention: ['formula', 'B60', 'P&L'],
      shouldMention: ['cell', 'reference', 'subtotal', 'total', 'value'],
      specificData: ['=+B60', '=B60'],
      context: 'Should explain simple cell reference for subtotals'
    },
    difficulty: 'moderate'
  },
  {
    id: 46,
    category: 'Formula & Technical',
    question: 'How does the improvement plan Phase structure work?',
    expectedContent: {
      mustMention: ['Phase', 'structure', 'improvement'],
      shouldMention: ['Phase 1', 'Phase 2', 'capex', 'timeline', 'staged'],
      specificData: ['Phase 1', 'Phase 2', 'SUMMARY'],
      context: 'Should explain phased approach to capital improvements'
    },
    difficulty: 'moderate'
  },
  {
    id: 47,
    category: 'Formula & Technical',
    question: 'What does the Duration field in the MoICs sheet represent?',
    expectedContent: {
      mustMention: ['Duration', 'MoICs', 'represent'],
      shouldMention: ['years', 'holding', 'period', 'investment', 'timeline'],
      specificData: ['6', 'years'],
      context: 'Should explain Duration = investment holding period'
    },
    difficulty: 'moderate'
  },
  {
    id: 48,
    category: 'Formula & Technical',
    question: 'How is the Capex/Cabin metric calculated in the improvement plan?',
    expectedContent: {
      mustMention: ['Capex', 'Cabin', 'calculated'],
      shouldMention: ['total', 'divide', 'number', 'cost', 'per'],
      specificData: ['$500', '/'],
      context: 'Should explain Capex/Cabin = Total Capex / Number of Cabins'
    },
    difficulty: 'moderate'
  },
  {
    id: 49,
    category: 'Formula & Technical',
    question: 'Explain the relationship between NOI Improvement and Return on Cost.',
    expectedContent: {
      mustMention: ['NOI', 'Return on Cost', 'relationship'],
      shouldMention: ['formula', 'capex', 'percentage', 'annual'],
      specificData: ['ROC', '/', 'NOI/Capex'],
      context: 'Should explain ROC = NOI Improvement / Capex'
    },
    difficulty: 'moderate'
  },
  {
    id: 50,
    category: 'Formula & Technical',
    question: 'How would you validate the accuracy of the RosewoodFund formulas?',
    expectedContent: {
      mustMention: ['validate', 'accuracy', 'formula', 'Rosewood'],
      shouldMention: ['manual', 'check', 'test', 'review', 'verify'],
      specificData: [],
      context: 'Should suggest validation methods: manual calc, sensitivity test, etc.'
    },
    difficulty: 'complex'
  }
];

// ============================================================================
// QUALITY EVALUATION FUNCTIONS
// ============================================================================

interface QualityScore {
  accuracy: number;        // 0-100: Does it contain correct information?
  completeness: number;    // 0-100: Does it cover expected points?
  specificity: number;     // 0-100: Does it provide specific data?
  relevance: number;       // 0-100: Is it on topic?
  overall: number;         // 0-100: Overall quality score
  details: {
    mustMentionFound: string[];
    mustMentionMissing: string[];
    shouldMentionFound: string[];
    specificDataFound: string[];
    isGenericResponse: boolean;
    hasNumbers: boolean;
    responseLength: number;
  };
}

function evaluateAnswerQuality(answer: string, expected: QualityTest['expectedContent']): QualityScore {
  const lowerAnswer = answer.toLowerCase();

  // Check must-mention terms
  const mustMentionFound = expected.mustMention.filter(term =>
    lowerAnswer.includes(term.toLowerCase())
  );
  const mustMentionMissing = expected.mustMention.filter(term =>
    !lowerAnswer.includes(term.toLowerCase())
  );

  // Check should-mention terms
  const shouldMentionFound = expected.shouldMention.filter(term =>
    lowerAnswer.includes(term.toLowerCase())
  );

  // Check specific data
  const specificDataFound = expected.specificData.filter(data =>
    answer.includes(data) || lowerAnswer.includes(data.toLowerCase())
  );

  // Check for generic responses
  const genericPhrases = [
    "i couldn't find",
    "i don't see that",
    "not found in your documents",
    "i searched through",
    "try rephrasing",
    "upload a document"
  ];
  const isGenericResponse = genericPhrases.some(phrase => lowerAnswer.includes(phrase));

  // Check if answer has numbers (indicates specificity)
  const hasNumbers = /\d+/.test(answer);

  // Calculate scores
  const accuracyScore = isGenericResponse ? 10 :
    (mustMentionFound.length / Math.max(expected.mustMention.length, 1)) * 100;

  const completenessScore =
    ((mustMentionFound.length + shouldMentionFound.length) /
    Math.max(expected.mustMention.length + expected.shouldMention.length, 1)) * 100;

  const specificityScore = expected.specificData.length > 0 ?
    (specificDataFound.length / expected.specificData.length) * 100 :
    (hasNumbers ? 70 : 30);

  const relevanceScore = isGenericResponse ? 20 :
    (mustMentionFound.length >= expected.mustMention.length * 0.5 ? 80 : 50);

  const overallScore = (accuracyScore * 0.3 + completenessScore * 0.3 +
    specificityScore * 0.2 + relevanceScore * 0.2);

  return {
    accuracy: Math.round(accuracyScore),
    completeness: Math.round(completenessScore),
    specificity: Math.round(specificityScore),
    relevance: Math.round(relevanceScore),
    overall: Math.round(overallScore),
    details: {
      mustMentionFound,
      mustMentionMissing,
      shouldMentionFound,
      specificDataFound,
      isGenericResponse,
      hasNumbers,
      responseLength: answer.length
    }
  };
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

interface TestResult {
  id: number;
  category: string;
  question: string;
  difficulty: string;
  answer: string;
  quality: QualityScore;
  responseTime: number;
  error?: string;
}

const testResults: TestResult[] = [];

async function authenticate(): Promise<boolean> {
  try {
    console.log(`Authenticating to ${API_BASE_URL}...`);
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      { timeout: 30000 }
    );

    authToken = response.data.token;
    console.log('[OK] Authentication successful\n');
    return true;
  } catch (error: any) {
    console.log('[ERROR] Authentication failed:', error.message);
    return false;
  }
}

async function runQuery(question: string): Promise<{ answer: string; time: number; error?: string }> {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      { query: question },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 120000,
      }
    );

    const answer = response.data.answer || response.data.message || response.data.response || '';
    return { answer, time: Date.now() - startTime };
  } catch (error: any) {
    return {
      answer: '',
      time: Date.now() - startTime,
      error: error.response?.status === 500 ? 'Server Error (500)' : error.message
    };
  }
}

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('='.repeat(80));
  console.log('KODA ANSWER QUALITY TEST SUITE');
  console.log('50 Questions | 5 Categories | Quality Evaluation');
  console.log('='.repeat(80));
  console.log(`\nAPI: ${API_BASE_URL}`);
  console.log(`User: ${TEST_USER_EMAIL}\n`);

  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('\n[ERROR] Cannot run tests without authentication');
    return;
  }

  let currentCategory = '';

  for (const test of QUALITY_TESTS) {
    // Print category header
    if (test.category !== currentCategory) {
      currentCategory = test.category;
      console.log('\n' + '─'.repeat(80));
      console.log(`CATEGORY: ${currentCategory.toUpperCase()}`);
      console.log('─'.repeat(80) + '\n');
    }

    console.log(`[Q${test.id}] ${test.question.substring(0, 60)}${test.question.length > 60 ? '...' : ''}`);

    const { answer, time, error } = await runQuery(test.question);

    if (error) {
      console.log(`  ❌ ERROR: ${error}`);
      testResults.push({
        id: test.id,
        category: test.category,
        question: test.question,
        difficulty: test.difficulty,
        answer: '',
        quality: {
          accuracy: 0,
          completeness: 0,
          specificity: 0,
          relevance: 0,
          overall: 0,
          details: {
            mustMentionFound: [],
            mustMentionMissing: test.expectedContent.mustMention,
            shouldMentionFound: [],
            specificDataFound: [],
            isGenericResponse: true,
            hasNumbers: false,
            responseLength: 0
          }
        },
        responseTime: time,
        error
      });
    } else {
      const quality = evaluateAnswerQuality(answer, test.expectedContent);

      // Quality indicator
      const qualityEmoji = quality.overall >= 80 ? '🟢' :
                          quality.overall >= 60 ? '🟡' :
                          quality.overall >= 40 ? '🟠' : '🔴';

      console.log(`  ${qualityEmoji} Quality: ${quality.overall}% | Accuracy: ${quality.accuracy}% | Completeness: ${quality.completeness}% | (${time}ms)`);

      // Show what was found/missing
      if (quality.details.mustMentionMissing.length > 0) {
        console.log(`     Missing: ${quality.details.mustMentionMissing.slice(0, 3).join(', ')}${quality.details.mustMentionMissing.length > 3 ? '...' : ''}`);
      }
      if (quality.details.specificDataFound.length > 0) {
        console.log(`     Found data: ${quality.details.specificDataFound.slice(0, 3).join(', ')}`);
      }
      if (quality.details.isGenericResponse) {
        console.log(`     ⚠️  Generic/fallback response detected`);
      }

      // Show answer preview
      console.log(`     Answer: "${answer.substring(0, 80)}${answer.length > 80 ? '...' : ''}"`);

      testResults.push({
        id: test.id,
        category: test.category,
        question: test.question,
        difficulty: test.difficulty,
        answer,
        quality,
        responseTime: time
      });
    }

    console.log('');

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('QUALITY SUMMARY REPORT');
  console.log('='.repeat(80) + '\n');

  // Overall statistics
  const validResults = testResults.filter(r => !r.error);
  const errorResults = testResults.filter(r => r.error);

  if (validResults.length > 0) {
    const avgOverall = validResults.reduce((s, r) => s + r.quality.overall, 0) / validResults.length;
    const avgAccuracy = validResults.reduce((s, r) => s + r.quality.accuracy, 0) / validResults.length;
    const avgCompleteness = validResults.reduce((s, r) => s + r.quality.completeness, 0) / validResults.length;
    const avgSpecificity = validResults.reduce((s, r) => s + r.quality.specificity, 0) / validResults.length;
    const avgRelevance = validResults.reduce((s, r) => s + r.quality.relevance, 0) / validResults.length;
    const avgTime = validResults.reduce((s, r) => s + r.responseTime, 0) / validResults.length;

    console.log('OVERALL SCORES:');
    console.log(`  Overall Quality:  ${avgOverall.toFixed(1)}%`);
    console.log(`  Accuracy:         ${avgAccuracy.toFixed(1)}%`);
    console.log(`  Completeness:     ${avgCompleteness.toFixed(1)}%`);
    console.log(`  Specificity:      ${avgSpecificity.toFixed(1)}%`);
    console.log(`  Relevance:        ${avgRelevance.toFixed(1)}%`);
    console.log(`  Avg Response:     ${avgTime.toFixed(0)}ms`);
    console.log(`  Errors:           ${errorResults.length}/${testResults.length}`);
  }

  // By category
  console.log('\nBY CATEGORY:');
  const categories = [...new Set(testResults.map(r => r.category))];
  for (const cat of categories) {
    const catResults = testResults.filter(r => r.category === cat && !r.error);
    const catErrors = testResults.filter(r => r.category === cat && r.error);
    if (catResults.length > 0) {
      const catAvg = catResults.reduce((s, r) => s + r.quality.overall, 0) / catResults.length;
      const qualityBar = '█'.repeat(Math.round(catAvg / 10)) + '░'.repeat(10 - Math.round(catAvg / 10));
      console.log(`  ${cat}: ${qualityBar} ${catAvg.toFixed(0)}% (${catResults.length} answered, ${catErrors.length} errors)`);
    } else {
      console.log(`  ${cat}: [ALL ERRORS] (${catErrors.length} errors)`);
    }
  }

  // By difficulty
  console.log('\nBY DIFFICULTY:');
  const difficulties = ['simple', 'moderate', 'complex'];
  for (const diff of difficulties) {
    const diffResults = testResults.filter(r => r.difficulty === diff && !r.error);
    if (diffResults.length > 0) {
      const diffAvg = diffResults.reduce((s, r) => s + r.quality.overall, 0) / diffResults.length;
      console.log(`  ${diff.charAt(0).toUpperCase() + diff.slice(1)}: ${diffAvg.toFixed(0)}%`);
    }
  }

  // Quality distribution
  console.log('\nQUALITY DISTRIBUTION:');
  const excellent = validResults.filter(r => r.quality.overall >= 80).length;
  const good = validResults.filter(r => r.quality.overall >= 60 && r.quality.overall < 80).length;
  const fair = validResults.filter(r => r.quality.overall >= 40 && r.quality.overall < 60).length;
  const poor = validResults.filter(r => r.quality.overall < 40).length;
  console.log(`  🟢 Excellent (80%+): ${excellent}`);
  console.log(`  🟡 Good (60-79%):    ${good}`);
  console.log(`  🟠 Fair (40-59%):    ${fair}`);
  console.log(`  🔴 Poor (<40%):      ${poor}`);
  console.log(`  ❌ Errors:           ${errorResults.length}`);

  // Generic response count
  const genericCount = validResults.filter(r => r.quality.details.isGenericResponse).length;
  console.log(`\nGENERIC RESPONSES: ${genericCount}/${validResults.length} (${((genericCount/validResults.length)*100).toFixed(0)}%)`);

  // Top performing questions
  console.log('\nTOP 5 BEST ANSWERS:');
  const sorted = [...validResults].sort((a, b) => b.quality.overall - a.quality.overall);
  sorted.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. [Q${r.id}] ${r.quality.overall}% - ${r.question.substring(0, 50)}...`);
  });

  // Worst performing questions
  console.log('\nTOP 5 NEEDS IMPROVEMENT:');
  sorted.slice(-5).reverse().forEach((r, i) => {
    console.log(`  ${i + 1}. [Q${r.id}] ${r.quality.overall}% - ${r.question.substring(0, 50)}...`);
  });

  // Save detailed results
  const reportsDir = path.join(process.cwd(), 'test-suite', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const reportPath = path.join(reportsDir, 'answer-quality-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalQuestions: testResults.length,
      answered: validResults.length,
      errors: errorResults.length,
      avgOverall: validResults.length > 0 ? validResults.reduce((s, r) => s + r.quality.overall, 0) / validResults.length : 0,
      avgAccuracy: validResults.length > 0 ? validResults.reduce((s, r) => s + r.quality.accuracy, 0) / validResults.length : 0,
      avgCompleteness: validResults.length > 0 ? validResults.reduce((s, r) => s + r.quality.completeness, 0) / validResults.length : 0,
      genericResponses: genericCount
    },
    results: testResults
  }, null, 2));

  console.log(`\nDetailed results saved to: ${reportPath}`);

  console.log('\n' + '='.repeat(80));
  const finalScore = validResults.length > 0 ?
    validResults.reduce((s, r) => s + r.quality.overall, 0) / validResults.length : 0;
  if (finalScore >= 70) {
    console.log(`[GOOD] Average quality score: ${finalScore.toFixed(1)}%`);
  } else if (finalScore >= 50) {
    console.log(`[FAIR] Average quality score: ${finalScore.toFixed(1)}% - Room for improvement`);
  } else {
    console.log(`[NEEDS WORK] Average quality score: ${finalScore.toFixed(1)}% - Significant improvements needed`);
  }
  console.log('='.repeat(80) + '\n');
}

runAllTests().catch(console.error);
