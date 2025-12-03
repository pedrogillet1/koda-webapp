/**
 * Koda Comprehensive Answer Quality Test
 *
 * 50 Questions with Expected Answers
 * Evaluates answer correctness and diagnoses failures
 */

import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'localhost@koda.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'localhost123';

let authToken = '';
let conversationId = '';

// ============================================================================
// ALL 50 QUESTIONS WITH EXPECTED ANSWERS
// ============================================================================

interface TestQuestion {
  id: number;
  category: string;
  question: string;
  expectedAnswer: string;
  keyFacts: string[];           // Critical facts that MUST be in the answer
  acceptableValues: string[];   // Alternative acceptable values/formats
  dataSource: string;           // Which document(s) should be used
  failureDiagnosis: {
    ifGeneric: string;          // What's wrong if generic response
    ifWrongData: string;        // What's wrong if wrong data
    ifMissing: string;          // What's wrong if data missing
  };
}

const ALL_QUESTIONS: TestQuestion[] = [
  // ============================================================================
  // CATEGORY 1: SIMPLE DATA EXTRACTION (10 Questions)
  // ============================================================================
  {
    id: 1,
    category: 'Simple Data Extraction',
    question: 'What is the total revenue for Lone Mountain Ranch in 2024?',
    expectedAnswer: 'The total revenue for 2024 is found in the LoneMountainRanchP&L2024.xlsx file. Based on the P&L structure, total revenue includes all income streams (rooms, food & beverage, activities, etc.). The specific amount would be in the "Total Revenue" or "Total Income" row.',
    keyFacts: ['2024', 'revenue', 'Lone Mountain', 'P&L'],
    acceptableValues: ['$', 'million', 'total revenue', 'income'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx',
    failureDiagnosis: {
      ifGeneric: 'RAG not retrieving from P&L 2024 file - check embeddings for this document',
      ifWrongData: 'Wrong document being retrieved - check vector similarity scoring',
      ifMissing: 'Document not indexed or extractedText missing for P&L 2024'
    }
  },
  {
    id: 2,
    category: 'Simple Data Extraction',
    question: 'How many sheets are in the RosewoodFund file?',
    expectedAnswer: 'The RosewoodFundv3.xlsx file contains 2 sheets: "Rosewood Fund" (main analysis sheet) and "MoICs into IRRs" (calculation sheet for returns).',
    keyFacts: ['2', 'sheets', 'Rosewood Fund', 'MoICs into IRRs'],
    acceptableValues: ['two', '2 sheets', 'two sheets'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Excel metadata not being extracted - check sheetCount in document_metadata',
      ifWrongData: 'Sheet names not extracted properly from Excel file',
      ifMissing: 'Excel processing not extracting sheet information'
    }
  },
  {
    id: 3,
    category: 'Simple Data Extraction',
    question: 'What is the budget year for the improvement plan?',
    expectedAnswer: 'The improvement plan is for 2025, as indicated in the filename "LMRImprovementPlan202503($63mPIP).xlsx", with a total budget of $63 million.',
    keyFacts: ['2025', '$63 million', 'improvement plan'],
    acceptableValues: ['63M', '$63M', '63 million', '2025'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Improvement plan file not being retrieved',
      ifWrongData: 'Filename metadata not being used in answer generation',
      ifMissing: 'Document not indexed properly'
    }
  },
  {
    id: 4,
    category: 'Simple Data Extraction',
    question: 'List all the property names in the Rosewood Fund.',
    expectedAnswer: 'Based on the Rosewood Fund sheet structure, the properties are: Carlyle, Lone Mountain Ranch, and Baxter Hotel.',
    keyFacts: ['Carlyle', 'Lone Mountain Ranch', 'Baxter Hotel'],
    acceptableValues: ['3 properties', 'three properties', 'Carlyle', 'Baxter'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Rosewood Fund content not being retrieved',
      ifWrongData: 'Property names not extracted from Excel cells',
      ifMissing: 'Excel content extraction failed'
    }
  },
  {
    id: 5,
    category: 'Simple Data Extraction',
    question: 'What is the total capital expenditure (Capex) in the improvement plan?',
    expectedAnswer: 'The total capital expenditure is $63 million, as indicated in the filename "$63mPIP" (Property Improvement Plan).',
    keyFacts: ['$63 million', 'capital expenditure', 'capex'],
    acceptableValues: ['63M', '$63M', '63 million', 'PIP'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Improvement plan not being retrieved',
      ifWrongData: 'Capex value not extracted from filename or content',
      ifMissing: 'Document metadata not indexed'
    }
  },
  {
    id: 6,
    category: 'Simple Data Extraction',
    question: 'What is the date range covered in the 2024 P&L?',
    expectedAnswer: 'The 2024 P&L covers the period ending December 31, 2024 (As of Date: 12/31/2024), showing the full year 2024 financial performance.',
    keyFacts: ['December 31, 2024', '12/31/2024', 'full year 2024'],
    acceptableValues: ['2024', 'December', '12/31', 'year-end'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx',
    failureDiagnosis: {
      ifGeneric: 'P&L 2024 content not retrieved',
      ifWrongData: 'Date field not extracted from P&L header',
      ifMissing: 'Date information not in extractedText'
    }
  },
  {
    id: 7,
    category: 'Simple Data Extraction',
    question: 'What is the location group mentioned in the P&L files?',
    expectedAnswer: 'The location group is "BIG SKY RANCH PARTNERS" as shown in the header of both P&L files.',
    keyFacts: ['BIG SKY RANCH PARTNERS'],
    acceptableValues: ['Big Sky', 'Ranch Partners', 'location group'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx, LoneMountainRanchP&L2025(Budget).xlsx',
    failureDiagnosis: {
      ifGeneric: 'P&L files not being retrieved',
      ifWrongData: 'Header information not extracted',
      ifMissing: 'Location group field not in extractedText'
    }
  },
  {
    id: 8,
    category: 'Simple Data Extraction',
    question: 'How many documents do I have about Lone Mountain Ranch?',
    expectedAnswer: 'There are 3-4 documents about Lone Mountain Ranch: P&L 2024, P&L 2025 (Budget), and the Improvement Plan. The Rosewood Fund also references it.',
    keyFacts: ['3', 'P&L 2024', 'P&L 2025', 'Improvement Plan'],
    acceptableValues: ['three', '4', 'four', 'multiple'],
    dataSource: 'Multiple files',
    failureDiagnosis: {
      ifGeneric: 'Document listing/metadata query not working',
      ifWrongData: 'Filename search not matching Lone Mountain',
      ifMissing: 'handleDocumentMetadataQuery not being triggered'
    }
  },
  {
    id: 9,
    category: 'Simple Data Extraction',
    question: 'What type of file is the Koda Presentation?',
    expectedAnswer: 'The Koda Presentation is a PowerPoint file (.pptx format).',
    keyFacts: ['PowerPoint', 'pptx', 'presentation'],
    acceptableValues: ['.pptx', 'PPTX', 'slide', 'presentation file'],
    dataSource: 'Koda Presentation Port Final.pptx',
    failureDiagnosis: {
      ifGeneric: 'File type metadata not retrieved',
      ifWrongData: 'mimeType not being used in response',
      ifMissing: 'Document metadata query not working'
    }
  },
  {
    id: 10,
    category: 'Simple Data Extraction',
    question: 'What are the main expense categories in the 2024 P&L?',
    expectedAnswer: 'Main expense categories include: Payroll/Labor, Food & Beverage costs, Utilities, Maintenance, Marketing, Administrative expenses, and other operating costs.',
    keyFacts: ['expense', 'payroll', 'operating'],
    acceptableValues: ['cost', 'labor', 'utilities', 'food', 'beverage', 'maintenance'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx',
    failureDiagnosis: {
      ifGeneric: 'P&L content not being retrieved with enough detail',
      ifWrongData: 'Expense categories not extracted from P&L structure',
      ifMissing: 'Row headers not in extractedText'
    }
  },

  // ============================================================================
  // CATEGORY 2: CALCULATIONS & FORMULAS (10 Questions)
  // ============================================================================
  {
    id: 11,
    category: 'Calculations & Formulas',
    question: 'What is the MoIC (Multiple on Invested Capital) for Carlyle in the Rosewood Fund?',
    expectedAnswer: 'The MoIC for Carlyle is 1.5x, calculated using the formula =IFERROR(H12/H10,0), which divides the total returns ($7.5M in cell H12) by the initial investment ($5M in cell H10), resulting in 1.5.',
    keyFacts: ['1.5x', 'MoIC', 'Carlyle', 'Multiple on Invested Capital'],
    acceptableValues: ['1.5', '150%', '$7.5M', '$5M'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Rosewood Fund formulas/values not extracted',
      ifWrongData: 'MoIC calculation not in extractedText',
      ifMissing: 'Formula results not being captured during Excel processing'
    }
  },
  {
    id: 12,
    category: 'Calculations & Formulas',
    question: 'How is the IRR calculated in the RosewoodFund file?',
    expectedAnswer: 'The formula =IFERROR(IRR(J5:T5),0) calculates Internal Rate of Return on cash flows in cells J5 through T5. IRR finds the discount rate that makes NPV = 0.',
    keyFacts: ['IRR', 'formula', 'cash flow', 'IFERROR'],
    acceptableValues: ['Internal Rate of Return', '15%', 'discount rate', 'NPV'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Formula content not extracted from Excel',
      ifWrongData: 'IRR formula text not in extractedText',
      ifMissing: 'Excel formula extraction not working'
    }
  },
  {
    id: 13,
    category: 'Calculations & Formulas',
    question: 'What is the total investment across all properties in the Rosewood Fund?',
    expectedAnswer: 'Based on the Rosewood Fund structure with 3 properties (Carlyle: $5M, Lone Mountain Ranch: $6M, Baxter Hotel: $4M), the total investment is $15M.',
    keyFacts: ['$15M', 'total investment', '3 properties'],
    acceptableValues: ['15 million', '$15 million', 'fifteen million'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Investment values not retrieved from Rosewood Fund',
      ifWrongData: 'Individual property investments not summed correctly',
      ifMissing: 'Investment amounts not in extractedText'
    }
  },
  {
    id: 14,
    category: 'Calculations & Formulas',
    question: 'What is the Return on Cost for Phase 1 of the improvement plan?',
    expectedAnswer: 'Return on Cost = NOI Improvement / Capex. If Phase 1 shows $2M NOI improvement on $20M capex, Return on Cost = 10%.',
    keyFacts: ['Return on Cost', 'ROC', 'Phase 1', 'NOI', 'Capex'],
    acceptableValues: ['10%', 'ROC', 'NOI/Capex'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Improvement plan ROC data not retrieved',
      ifWrongData: 'ROC calculation not in SUMMARY sheet',
      ifMissing: 'Phase 1 metrics not extracted'
    }
  },
  {
    id: 15,
    category: 'Calculations & Formulas',
    question: 'Explain how the IFERROR function works in the MoIC calculation.',
    expectedAnswer: 'The formula =IFERROR(H12/H10,0) attempts to divide returns (H12) by investment (H10). If H10 is zero or blank, division would cause an error. IFERROR catches this and returns 0 instead, preventing #DIV/0! errors.',
    keyFacts: ['IFERROR', 'division', 'error', '0', '#DIV/0'],
    acceptableValues: ['error handling', 'zero', 'prevents error'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Formula explanation requires understanding of Excel functions',
      ifWrongData: 'IFERROR formula not in extractedText',
      ifMissing: 'LLM not explaining formula logic correctly'
    }
  },
  {
    id: 16,
    category: 'Calculations & Formulas',
    question: 'What does the Capex/Cabin metric tell us in the improvement plan?',
    expectedAnswer: 'Capex/Cabin = Total Phase Capex / Number of Cabins. This metric normalizes capital expenditure across different project sizes, allowing comparison across phases.',
    keyFacts: ['Capex/Cabin', 'per cabin', 'cost per unit'],
    acceptableValues: ['$500K', '$500,000', 'per unit cost', 'normalized'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Capex/Cabin metric not in improvement plan data',
      ifWrongData: 'Metric explanation not derived from document',
      ifMissing: 'SUMMARY sheet data not extracted'
    }
  },
  {
    id: 17,
    category: 'Calculations & Formulas',
    question: 'What is the relationship between NOI Improvement and Return on Cost?',
    expectedAnswer: 'Return on Cost = NOI Improvement / Capex. NOI Improvement is the annual increase in Net Operating Income from improvements. ROC expresses this as a percentage of capital invested.',
    keyFacts: ['ROC', 'NOI Improvement', 'Capex', 'formula'],
    acceptableValues: ['NOI/Capex', 'percentage', 'annual'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Formula relationship not explained',
      ifWrongData: 'Incorrect formula provided',
      ifMissing: 'Metrics not in extractedText'
    }
  },
  {
    id: 18,
    category: 'Calculations & Formulas',
    question: 'What does the Duration field in the MoICs sheet represent?',
    expectedAnswer: 'Duration (cell D4 = 6) represents the investment holding period in years. This is used in the IRR calculation to structure the cash flow timeline from Year 0 through Year 6.',
    keyFacts: ['Duration', '6 years', 'holding period', 'investment'],
    acceptableValues: ['6', 'years', 'timeline', 'Year 0', 'Year 6'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'MoICs sheet data not retrieved',
      ifWrongData: 'Duration field not extracted',
      ifMissing: 'Second sheet content not in embeddings'
    }
  },
  {
    id: 19,
    category: 'Calculations & Formulas',
    question: 'How would you calculate the year-over-year revenue growth from 2024 to 2025?',
    expectedAnswer: 'YoY growth = ((2025 Revenue - 2024 Revenue) / 2024 Revenue) × 100. Compare values from both P&L files to calculate the percentage change.',
    keyFacts: ['year-over-year', 'growth', 'formula', '2024', '2025'],
    acceptableValues: ['YoY', 'percentage', 'change', 'increase'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx, LoneMountainRanchP&L2025(Budget).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Cross-document comparison not working',
      ifWrongData: 'Revenue figures not retrieved from both files',
      ifMissing: 'Need to query both P&L files'
    }
  },
  {
    id: 20,
    category: 'Calculations & Formulas',
    question: 'What is the total equity value in the Rosewood Fund?',
    expectedAnswer: 'The total equity value is $15M, sourced from the Rosewood Fund sheet which aggregates individual property equity values.',
    keyFacts: ['$15M', 'equity value', 'total'],
    acceptableValues: ['15 million', '$15 million', 'fund equity'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Equity value not retrieved from Rosewood Fund',
      ifWrongData: 'Wrong value extracted',
      ifMissing: 'Equity total not in extractedText'
    }
  },

  // ============================================================================
  // CATEGORY 3: CROSS-DOCUMENT ANALYSIS (10 Questions)
  // ============================================================================
  {
    id: 21,
    category: 'Cross-Document Analysis',
    question: 'Compare total revenue between 2024 actual and 2025 budget.',
    expectedAnswer: 'Comparing LoneMountainRanchP&L2024.xlsx with LoneMountainRanchP&L2025(Budget).xlsx shows the revenue change between actual 2024 performance and budgeted 2025 projections.',
    keyFacts: ['2024', '2025', 'revenue', 'compare', 'budget'],
    acceptableValues: ['actual', 'budget', 'growth', 'change', 'increase'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx, LoneMountainRanchP&L2025(Budget).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Cross-document retrieval not working',
      ifWrongData: 'Only one document being retrieved',
      ifMissing: 'Synthesis handler should combine both documents'
    }
  },
  {
    id: 22,
    category: 'Cross-Document Analysis',
    question: 'How does the improvement plan budget relate to the Rosewood Fund investment in Lone Mountain Ranch?',
    expectedAnswer: 'The $63M improvement plan represents capital improvements for Lone Mountain Ranch, which is one of the properties in the Rosewood Fund portfolio. The plan aims to increase NOI and improve fund returns.',
    keyFacts: ['$63M', 'improvement plan', 'Rosewood Fund', 'Lone Mountain Ranch'],
    acceptableValues: ['capital improvements', 'NOI', 'returns', 'portfolio'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx, RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Cross-document synthesis not working',
      ifWrongData: 'Documents not being connected logically',
      ifMissing: 'Both documents need to be in context'
    }
  },
  {
    id: 23,
    category: 'Cross-Document Analysis',
    question: 'What is the relationship between the 2025 budget and the improvement plan phases?',
    expectedAnswer: 'The 2025 budget reflects expected financial performance post-Phase 1 improvements. The SUMMARY 2 sheet shows POST PHASE 1 projections which should align with budget assumptions.',
    keyFacts: ['2025 budget', 'Phase 1', 'POST PHASE 1', 'projections'],
    acceptableValues: ['post', 'improvement', 'aligned', 'assumptions'],
    dataSource: 'LoneMountainRanchP&L2025(Budget).xlsx, LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Relationship between files not being inferred',
      ifWrongData: 'Phase timing not matched to budget year',
      ifMissing: 'Need both documents for synthesis'
    }
  },
  {
    id: 24,
    category: 'Cross-Document Analysis',
    question: 'Compare the complexity of RosewoodFund vs the P&L files in terms of formulas.',
    expectedAnswer: 'RosewoodFund is significantly more complex with ~750 formulas including IRR, IFERROR, SUMIF. The P&L files are simpler with ~26 formulas each, primarily basic cell references.',
    keyFacts: ['750 formulas', '26 formulas', 'IRR', 'IFERROR', 'complex'],
    acceptableValues: ['more complex', 'simpler', 'cell references', 'SUMIF'],
    dataSource: 'RosewoodFundv3.xlsx, LoneMountainRanchP&L2024.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Formula metadata not being compared',
      ifWrongData: 'Formula counts not in document metadata',
      ifMissing: 'Excel processing not counting formulas'
    }
  },
  {
    id: 25,
    category: 'Cross-Document Analysis',
    question: 'What financial metrics are common across all your Excel files?',
    expectedAnswer: 'Common metrics include: Revenue, Expenses, NOI (Net Operating Income), Returns/ROI, and various profitability measures.',
    keyFacts: ['revenue', 'NOI', 'returns', 'common'],
    acceptableValues: ['expenses', 'ROI', 'profitability', 'metrics'],
    dataSource: 'All Excel files',
    failureDiagnosis: {
      ifGeneric: 'Multi-document synthesis not working',
      ifWrongData: 'Only some files being analyzed',
      ifMissing: 'Need all documents for comprehensive answer'
    }
  },
  {
    id: 26,
    category: 'Cross-Document Analysis',
    question: 'What is the time horizon covered by all financial documents?',
    expectedAnswer: 'The documents cover 2024-2025 (P&Ls and budget), with the improvement plan extending through multiple phases into future years.',
    keyFacts: ['2024', '2025', 'time horizon', 'phases'],
    acceptableValues: ['years', 'period', 'future', 'multi-year'],
    dataSource: 'All financial files',
    failureDiagnosis: {
      ifGeneric: 'Date range not being synthesized across files',
      ifWrongData: 'Not all file dates being captured',
      ifMissing: 'Date metadata not extracted'
    }
  },
  {
    id: 27,
    category: 'Cross-Document Analysis',
    question: 'Which document contains the most detailed financial analysis?',
    expectedAnswer: 'RosewoodFund contains the most detailed analysis with ~750 formulas, IRR calculations, MoIC metrics, and cross-property comparisons.',
    keyFacts: ['RosewoodFund', 'most detailed', '750 formulas', 'IRR'],
    acceptableValues: ['Rosewood', 'complex', 'analysis', 'MoIC'],
    dataSource: 'All files',
    failureDiagnosis: {
      ifGeneric: 'Document comparison not working',
      ifWrongData: 'Wrong file identified as most complex',
      ifMissing: 'Formula counts not available'
    }
  },
  {
    id: 28,
    category: 'Cross-Document Analysis',
    question: 'How are the P&L files structured similarly?',
    expectedAnswer: 'Both P&L files share: Same header structure (BIG SKY RANCH PARTNERS), same row categories (revenue, expenses), same formatting, and same location group.',
    keyFacts: ['similar structure', 'BIG SKY RANCH PARTNERS', 'revenue', 'expenses'],
    acceptableValues: ['same format', 'header', 'categories', 'layout'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx, LoneMountainRanchP&L2025(Budget).xlsx',
    failureDiagnosis: {
      ifGeneric: 'P&L structure comparison not working',
      ifWrongData: 'Structure details not extracted',
      ifMissing: 'Both files need to be compared'
    }
  },
  {
    id: 29,
    category: 'Cross-Document Analysis',
    question: 'What investment strategy is evident from the Rosewood Fund documents?',
    expectedAnswer: 'Value-add real estate investment strategy: acquiring hospitality properties, making capital improvements (like the $63M plan), and improving NOI to achieve target returns (15% IRR, 1.5x+ MoIC).',
    keyFacts: ['value-add', 'real estate', 'hospitality', 'capital improvements'],
    acceptableValues: ['IRR', 'MoIC', 'NOI', 'returns', 'strategy'],
    dataSource: 'RosewoodFundv3.xlsx, LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Investment strategy not being inferred from data',
      ifWrongData: 'Strategy elements not connected',
      ifMissing: 'Need synthesis across multiple documents'
    }
  },
  {
    id: 30,
    category: 'Cross-Document Analysis',
    question: 'Summarize the key financial data points across all your documents.',
    expectedAnswer: 'Key data: $63M improvement plan capex, $15M total Rosewood Fund investment, 3 properties in portfolio, 15% target IRR, 1.5x MoIC for Carlyle, 2024-2025 P&L coverage.',
    keyFacts: ['$63M', '$15M', '3 properties', '15%', '1.5x'],
    acceptableValues: ['IRR', 'MoIC', 'capex', 'investment', 'summary'],
    dataSource: 'All files',
    failureDiagnosis: {
      ifGeneric: 'Multi-document summary not working',
      ifWrongData: 'Key figures not all captured',
      ifMissing: 'Synthesis handler not aggregating correctly'
    }
  },

  // ============================================================================
  // CATEGORY 4: COMPLEX SYNTHESIS (10 Questions)
  // ============================================================================
  {
    id: 31,
    category: 'Complex Synthesis',
    question: 'What are the main themes across all documents in my collection?',
    expectedAnswer: 'Main themes: (1) Real Estate Investment - property analysis, fund performance, (2) Financial Analysis - P&L, budgeting, returns calculation, (3) Capital Improvements - improvement plan, NOI enhancement.',
    keyFacts: ['real estate', 'financial', 'investment', 'themes'],
    acceptableValues: ['hospitality', 'analysis', 'capital', 'returns'],
    dataSource: 'All documents',
    failureDiagnosis: {
      ifGeneric: 'Theme synthesis not working',
      ifWrongData: 'Themes not correctly identified',
      ifMissing: 'Need all documents for theme analysis'
    }
  },
  {
    id: 32,
    category: 'Complex Synthesis',
    question: 'Create an executive summary of the Rosewood Fund investment strategy.',
    expectedAnswer: 'Rosewood Fund: $15M real estate fund with 3 hospitality properties (Carlyle, Lone Mountain Ranch, Baxter Hotel). Value-add strategy with $63M improvement plan for LMR. Target 15% IRR, current MoIC 1.5x for Carlyle.',
    keyFacts: ['$15M', '3 properties', 'value-add', '$63M', '15% IRR', '1.5x MoIC'],
    acceptableValues: ['Carlyle', 'Lone Mountain', 'Baxter', 'hospitality'],
    dataSource: 'RosewoodFundv3.xlsx, LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Executive summary synthesis not working',
      ifWrongData: 'Key metrics not included',
      ifMissing: 'Multiple documents needed for comprehensive summary'
    }
  },
  {
    id: 33,
    category: 'Complex Synthesis',
    question: 'Analyze the risk factors present in the Rosewood Fund portfolio.',
    expectedAnswer: 'Key risks: (1) Concentration - only 3 properties in hospitality, (2) Capital intensity - $63M improvement vs $15M initial investment, (3) Execution risk - improvement plan delivery, (4) Market risk - hospitality sector cyclicality.',
    keyFacts: ['concentration', 'capital', 'execution', 'market', 'risk'],
    acceptableValues: ['hospitality', '$63M', '$15M', 'cyclical'],
    dataSource: 'RosewoodFundv3.xlsx, LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Risk analysis requires inference from data',
      ifWrongData: 'Risks not correctly identified',
      ifMissing: 'Need document context to infer risks'
    }
  },
  {
    id: 34,
    category: 'Complex Synthesis',
    question: 'How should the improvement plan be prioritized based on Return on Cost?',
    expectedAnswer: 'Prioritize improvements with highest ROC ratios (>10-12%). Phase improvements based on ROC ranking, starting with highest ROC projects that deliver fastest payback.',
    keyFacts: ['ROC', 'prioritize', 'highest', 'Phase'],
    acceptableValues: ['10%', '12%', 'payback', 'ranking'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'ROC-based prioritization not being inferred',
      ifWrongData: 'ROC values not being used for prioritization',
      ifMissing: 'ROC data not in extractedText'
    }
  },
  {
    id: 35,
    category: 'Complex Synthesis',
    question: 'Compare the 2024 actual performance to 2025 budget assumptions.',
    expectedAnswer: 'Compare: Revenue growth (actual vs budget), expense trends, NOI changes. 2025 budget should reflect post-Phase 1 improvements with higher revenue and potentially different cost structure.',
    keyFacts: ['2024', '2025', 'actual', 'budget', 'compare'],
    acceptableValues: ['revenue', 'growth', 'Phase 1', 'NOI'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx, LoneMountainRanchP&L2025(Budget).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Cross-year comparison not working',
      ifWrongData: 'Wrong values being compared',
      ifMissing: 'Both P&L files needed'
    }
  },
  {
    id: 36,
    category: 'Complex Synthesis',
    question: 'What is the implied valuation of Lone Mountain Ranch?',
    expectedAnswer: 'Using cap rate methodology: Value = NOI / Cap Rate. If $63M improvement generates 10% ROC ($6.3M NOI) at 7% cap rate, implied value increase = ~$90M.',
    keyFacts: ['valuation', 'NOI', 'cap rate', 'value'],
    acceptableValues: ['$', 'million', 'implied', 'methodology'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx, RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Valuation calculation requires inference',
      ifWrongData: 'Wrong methodology applied',
      ifMissing: 'NOI and cap rate data needed'
    }
  },
  {
    id: 37,
    category: 'Complex Synthesis',
    question: 'Synthesize the key success factors for the Rosewood Fund.',
    expectedAnswer: 'Success factors: (1) Execution excellence - deliver improvement plan on time/budget, (2) Market timing, (3) Operating performance - achieve NOI targets, (4) Capital management, (5) Exit strategy.',
    keyFacts: ['success', 'execution', 'market', 'capital', 'exit'],
    acceptableValues: ['NOI', 'improvement', 'performance', 'timing'],
    dataSource: 'All Rosewood-related files',
    failureDiagnosis: {
      ifGeneric: 'Success factor synthesis requires business understanding',
      ifWrongData: 'Wrong factors identified',
      ifMissing: 'Need comprehensive document analysis'
    }
  },
  {
    id: 38,
    category: 'Complex Synthesis',
    question: 'What additional analysis is needed to fully evaluate the investment?',
    expectedAnswer: 'Additional analysis needed: (1) Sensitivity analysis on IRR/MoIC, (2) Market comparables, (3) Detailed cash flow modeling, (4) Competitive analysis, (5) Stress testing under adverse scenarios.',
    keyFacts: ['sensitivity', 'analysis', 'additional', 'stress test'],
    acceptableValues: ['market', 'cash flow', 'scenario', 'comparable'],
    dataSource: 'All files',
    failureDiagnosis: {
      ifGeneric: 'Investment analysis recommendations require expertise',
      ifWrongData: 'Inappropriate recommendations',
      ifMissing: 'Need understanding of what analysis exists'
    }
  },
  {
    id: 39,
    category: 'Complex Synthesis',
    question: 'What is the overall investment thesis for the Rosewood Fund?',
    expectedAnswer: 'Investment thesis: Acquire hospitality properties at attractive valuations, implement value-add improvements to increase NOI, achieve 15%+ IRR through operational improvements and strategic exits.',
    keyFacts: ['investment thesis', 'value-add', 'hospitality', '15%', 'IRR'],
    acceptableValues: ['NOI', 'improvements', 'returns', 'strategy'],
    dataSource: 'RosewoodFundv3.xlsx, LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Investment thesis synthesis not working',
      ifWrongData: 'Thesis elements not correctly identified',
      ifMissing: 'Need multiple documents for thesis'
    }
  },
  {
    id: 40,
    category: 'Complex Synthesis',
    question: 'Write a brief investment recommendation based on all documents.',
    expectedAnswer: 'Recommendation: Proceed with investment given strong value-add potential ($63M improvement plan), clear return targets (15% IRR, 1.5x+ MoIC), and experienced operator. Key risks are execution and market timing.',
    keyFacts: ['recommendation', 'investment', 'proceed', 'risk'],
    acceptableValues: ['value-add', 'IRR', 'MoIC', 'potential'],
    dataSource: 'All files',
    failureDiagnosis: {
      ifGeneric: 'Recommendation synthesis not working',
      ifWrongData: 'Inappropriate recommendation',
      ifMissing: 'Need all documents for informed recommendation'
    }
  },

  // ============================================================================
  // CATEGORY 5: FORMULA & TECHNICAL UNDERSTANDING (10 Questions)
  // ============================================================================
  {
    id: 41,
    category: 'Formula & Technical',
    question: 'Explain how the IRR formula works in the RosewoodFund file.',
    expectedAnswer: 'The formula =IFERROR(IRR(J5:T5),0) calculates Internal Rate of Return on cash flows. IRR finds the discount rate that makes NPV = 0. IFERROR returns 0 if calculation fails.',
    keyFacts: ['IRR', 'formula', 'cash flow', 'NPV', 'IFERROR'],
    acceptableValues: ['discount rate', 'J5:T5', 'Internal Rate of Return'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Formula content not in extractedText',
      ifWrongData: 'IRR explanation incorrect',
      ifMissing: 'Formula text not extracted from Excel'
    }
  },
  {
    id: 42,
    category: 'Formula & Technical',
    question: 'What does the SUMIF formula in the RosewoodFund calculate?',
    expectedAnswer: 'The formula =IFERROR(-SUMIF(J5:T5,">0")/SUMIF(J5:T5,"<0"),0) calculates MoIC by: summing positive values (returns), dividing by sum of negative values (investments), with error handling.',
    keyFacts: ['SUMIF', 'MoIC', 'positive', 'negative', 'returns', 'investments'],
    acceptableValues: ['>0', '<0', 'formula', 'divide'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'SUMIF formula not in extractedText',
      ifWrongData: 'Formula explanation incorrect',
      ifMissing: 'Formula extraction not working'
    }
  },
  {
    id: 43,
    category: 'Formula & Technical',
    question: 'Why are there cross-sheet references in the RosewoodFund file?',
    expectedAnswer: 'Cross-sheet references link the MoICs into IRRs calculation sheet to the main Rosewood Fund data sheet. This separates raw data from calculations, maintains single source of truth, and enables modular updates.',
    keyFacts: ['cross-sheet', 'MoICs into IRRs', 'Rosewood Fund', 'link'],
    acceptableValues: ['reference', 'separate', 'data', 'calculation'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Sheet structure not in extractedText',
      ifWrongData: 'Sheet relationship not understood',
      ifMissing: 'Multi-sheet structure not extracted'
    }
  },
  {
    id: 44,
    category: 'Formula & Technical',
    question: 'How would you debug a #DIV/0! error in the MoIC calculation?',
    expectedAnswer: 'Debug steps: (1) Check denominator (H10) is not zero/blank, (2) Trace precedents, (3) Verify IFERROR wrapper, (4) Test with dummy data. The IFERROR should prevent #DIV/0! from displaying.',
    keyFacts: ['#DIV/0', 'debug', 'denominator', 'zero', 'IFERROR'],
    acceptableValues: ['trace', 'check', 'H10', 'error'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Debug methodology requires Excel knowledge',
      ifWrongData: 'Incorrect debug steps',
      ifMissing: 'Formula context needed'
    }
  },
  {
    id: 45,
    category: 'Formula & Technical',
    question: 'What is the purpose of the formula =+B60 in the P&L files?',
    expectedAnswer: 'The formula =+B60 is a simple cell reference that displays the value from cell B60. The + prefix is optional but some users include it for clarity. Used for subtotals and section totals.',
    keyFacts: ['=+B60', 'cell reference', 'subtotal', 'value'],
    acceptableValues: ['=B60', 'reference', 'total', 'display'],
    dataSource: 'LoneMountainRanchP&L2024.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Formula not in extractedText',
      ifWrongData: 'Incorrect formula explanation',
      ifMissing: 'P&L formulas not extracted'
    }
  },
  {
    id: 46,
    category: 'Formula & Technical',
    question: 'How does the improvement plan Phase structure work?',
    expectedAnswer: 'Phased approach: Phase 1 - initial high-ROC improvements, Phase 2 - subsequent improvements after Phase 1 cash flow materializes. SUMMARY 1 shows per-phase metrics, SUMMARY 2 shows timeline.',
    keyFacts: ['Phase 1', 'Phase 2', 'SUMMARY', 'phased', 'ROC'],
    acceptableValues: ['structure', 'timeline', 'capex', 'staged'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Phase structure not in extractedText',
      ifWrongData: 'Phase explanation incorrect',
      ifMissing: 'SUMMARY sheets not extracted'
    }
  },
  {
    id: 47,
    category: 'Formula & Technical',
    question: 'What does the Duration field in the MoICs sheet represent?',
    expectedAnswer: 'Duration (value 6) represents the investment holding period in years. Used in IRR calculation to structure cash flow timeline from Year 0 (investment) through Year 6 (exit).',
    keyFacts: ['Duration', '6', 'years', 'holding period'],
    acceptableValues: ['investment', 'timeline', 'Year 0', 'Year 6', 'IRR'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'MoICs sheet content not retrieved',
      ifWrongData: 'Duration explanation incorrect',
      ifMissing: 'Second sheet not in embeddings'
    }
  },
  {
    id: 48,
    category: 'Formula & Technical',
    question: 'How is the Capex/Cabin metric calculated in the improvement plan?',
    expectedAnswer: 'Capex/Cabin = Total Phase Capex / Number of Cabins. Normalizes cost across project sizes. If Phase 1 = $20M for 40 cabins, Capex/Cabin = $500K.',
    keyFacts: ['Capex/Cabin', 'calculate', 'divide', 'number'],
    acceptableValues: ['$500K', '$500,000', 'per cabin', 'normalized'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Capex/Cabin not in SUMMARY data',
      ifWrongData: 'Calculation explanation incorrect',
      ifMissing: 'Metric not extracted'
    }
  },
  {
    id: 49,
    category: 'Formula & Technical',
    question: 'Explain the relationship between NOI Improvement and Return on Cost.',
    expectedAnswer: 'ROC = NOI Improvement / Capex. NOI Improvement is annual increase in Net Operating Income. ROC expresses this as percentage of capital invested. 10% ROC = 10-year payback.',
    keyFacts: ['ROC', 'NOI Improvement', 'Capex', 'formula', 'percentage'],
    acceptableValues: ['Return on Cost', 'payback', 'annual', 'divide'],
    dataSource: 'LMRImprovementPlan202503($63mPIP).xlsx',
    failureDiagnosis: {
      ifGeneric: 'Formula relationship not explained',
      ifWrongData: 'Incorrect formula provided',
      ifMissing: 'ROC/NOI data not in extractedText'
    }
  },
  {
    id: 50,
    category: 'Formula & Technical',
    question: 'How would you validate the accuracy of the RosewoodFund formulas?',
    expectedAnswer: 'Validation steps: (1) Manual calculation for one property, (2) Cross-check IRR with financial calculator, (3) Sensitivity testing, (4) Audit trail review, (5) Peer review, (6) Edge case testing.',
    keyFacts: ['validate', 'accuracy', 'manual', 'check'],
    acceptableValues: ['test', 'review', 'sensitivity', 'audit'],
    dataSource: 'RosewoodFundv3.xlsx',
    failureDiagnosis: {
      ifGeneric: 'Validation methodology requires expertise',
      ifWrongData: 'Incorrect validation steps',
      ifMissing: 'General Excel knowledge needed'
    }
  }
];

// ============================================================================
// ANSWER EVALUATION
// ============================================================================

interface EvaluationResult {
  score: number;                    // 0-100
  keyFactsFound: string[];
  keyFactsMissing: string[];
  acceptableValuesFound: string[];
  isGenericResponse: boolean;
  isErrorResponse: boolean;
  diagnosis: string;
  suggestedFix: string;
}

function evaluateAnswer(answer: string, test: TestQuestion): EvaluationResult {
  const lowerAnswer = answer.toLowerCase();

  // Check for error/generic responses
  const genericPhrases = [
    "i couldn't find", "i don't see", "not found", "i searched through",
    "try rephrasing", "upload a document", "couldn't find that",
    "doesn't seem to be", "no information", "unable to find"
  ];
  const isGenericResponse = genericPhrases.some(p => lowerAnswer.includes(p));
  const isErrorResponse = answer === '' || answer.includes('Error') || answer.includes('500');

  // Check key facts
  const keyFactsFound = test.keyFacts.filter(fact =>
    lowerAnswer.includes(fact.toLowerCase())
  );
  const keyFactsMissing = test.keyFacts.filter(fact =>
    !lowerAnswer.includes(fact.toLowerCase())
  );

  // Check acceptable values
  const acceptableValuesFound = test.acceptableValues.filter(val =>
    answer.includes(val) || lowerAnswer.includes(val.toLowerCase())
  );

  // Calculate score
  let score = 0;
  if (!isErrorResponse && !isGenericResponse) {
    const factScore = (keyFactsFound.length / test.keyFacts.length) * 60;
    const valueScore = test.acceptableValues.length > 0
      ? (acceptableValuesFound.length / test.acceptableValues.length) * 40
      : 40;
    score = Math.round(factScore + valueScore);
  } else if (isGenericResponse) {
    score = 10; // Some credit for responding
  }

  // Determine diagnosis and fix
  let diagnosis = '';
  let suggestedFix = '';

  if (isErrorResponse) {
    diagnosis = 'Server error or timeout';
    suggestedFix = 'Check server logs for 500 errors, likely a code bug in query handler';
  } else if (isGenericResponse) {
    diagnosis = test.failureDiagnosis.ifGeneric;
    suggestedFix = `Check: (1) Document "${test.dataSource}" is indexed, (2) Embeddings exist in Pinecone, (3) Query routing is correct`;
  } else if (keyFactsMissing.length > keyFactsFound.length) {
    diagnosis = test.failureDiagnosis.ifMissing;
    suggestedFix = `Missing key facts: ${keyFactsMissing.join(', ')}. Check extractedText contains this data.`;
  } else if (score < 50) {
    diagnosis = test.failureDiagnosis.ifWrongData;
    suggestedFix = 'Answer partially correct but missing key information. Check chunk retrieval quality.';
  } else {
    diagnosis = 'Answer acceptable';
    suggestedFix = 'None needed';
  }

  return {
    score,
    keyFactsFound,
    keyFactsMissing,
    acceptableValuesFound,
    isGenericResponse,
    isErrorResponse,
    diagnosis,
    suggestedFix
  };
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

interface TestResult {
  id: number;
  category: string;
  question: string;
  expectedAnswer: string;
  actualAnswer: string;
  evaluation: EvaluationResult;
  responseTime: number;
  dataSource: string;
}

async function authenticate(): Promise<boolean> {
  try {
    console.log(`Authenticating to ${API_BASE_URL}...`);
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
      { timeout: 30000 }
    );
    authToken = response.data.accessToken;
    console.log('[OK] Authentication successful');

    // Create a conversation for the test session
    const convResponse = await axios.post(
      `${API_BASE_URL}/api/chat/conversations`,
      { title: 'Quality Test Session' },
      { headers: { Authorization: `Bearer ${authToken}` }, timeout: 30000 }
    );
    conversationId = convResponse.data.id;
    console.log(`[OK] Conversation created: ${conversationId}\n`);

    return true;
  } catch (error: any) {
    console.log('[ERROR] Authentication/Setup failed:', error.message);
    return false;
  }
}

async function runQuery(question: string): Promise<{ answer: string; time: number }> {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      { query: question, conversationId },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 120000,
      }
    );
    const answer = response.data.answer || response.data.message || '';
    return { answer, time: Date.now() - startTime };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message;
    return { answer: `Error: ${errorMsg}`, time: Date.now() - startTime };
  }
}

async function runAllTests(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('KODA COMPREHENSIVE ANSWER QUALITY TEST');
  console.log('50 Questions | Expected Answers | Failure Diagnosis');
  console.log('='.repeat(80));
  console.log(`\nAPI: ${API_BASE_URL}`);
  console.log(`User: ${TEST_USER_EMAIL}\n`);

  if (!await authenticate()) {
    console.log('\n[ERROR] Cannot run tests without authentication');
    return;
  }

  const results: TestResult[] = [];
  let currentCategory = '';

  for (const test of ALL_QUESTIONS) {
    if (test.category !== currentCategory) {
      currentCategory = test.category;
      console.log('\n' + '─'.repeat(80));
      console.log(`CATEGORY: ${currentCategory.toUpperCase()}`);
      console.log('─'.repeat(80));
    }

    console.log(`\n[Q${test.id}] ${test.question}`);
    console.log(`    Expected: ${test.expectedAnswer.substring(0, 80)}...`);

    const { answer, time } = await runQuery(test.question);
    const evaluation = evaluateAnswer(answer, test);

    // Score indicator
    const scoreEmoji = evaluation.score >= 70 ? '🟢' :
                       evaluation.score >= 40 ? '🟡' :
                       evaluation.score >= 10 ? '🟠' : '🔴';

    console.log(`    ${scoreEmoji} Score: ${evaluation.score}% | Time: ${time}ms`);
    console.log(`    Actual: "${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}"`);

    if (evaluation.keyFactsFound.length > 0) {
      console.log(`    ✓ Found: ${evaluation.keyFactsFound.join(', ')}`);
    }
    if (evaluation.keyFactsMissing.length > 0) {
      console.log(`    ✗ Missing: ${evaluation.keyFactsMissing.join(', ')}`);
    }
    if (evaluation.score < 70) {
      console.log(`    ⚠ Diagnosis: ${evaluation.diagnosis}`);
      console.log(`    🔧 Fix: ${evaluation.suggestedFix}`);
    }

    results.push({
      id: test.id,
      category: test.category,
      question: test.question,
      expectedAnswer: test.expectedAnswer,
      actualAnswer: answer,
      evaluation,
      responseTime: time,
      dataSource: test.dataSource
    });

    await new Promise(r => setTimeout(r, 500));
  }

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================

  console.log('\n\n' + '='.repeat(80));
  console.log('COMPREHENSIVE SUMMARY REPORT');
  console.log('='.repeat(80));

  const avgScore = results.reduce((s, r) => s + r.evaluation.score, 0) / results.length;
  const excellent = results.filter(r => r.evaluation.score >= 70).length;
  const good = results.filter(r => r.evaluation.score >= 40 && r.evaluation.score < 70).length;
  const poor = results.filter(r => r.evaluation.score < 40).length;
  const generic = results.filter(r => r.evaluation.isGenericResponse).length;
  const errors = results.filter(r => r.evaluation.isErrorResponse).length;

  console.log(`\nOVERALL: ${avgScore.toFixed(1)}% average score`);
  console.log(`  🟢 Excellent (70%+): ${excellent}/50`);
  console.log(`  🟡 Good (40-69%):    ${good}/50`);
  console.log(`  🔴 Poor (<40%):      ${poor}/50`);
  console.log(`  ⚠️  Generic responses: ${generic}/50`);
  console.log(`  ❌ Errors:           ${errors}/50`);

  // By category
  console.log('\nBY CATEGORY:');
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catAvg = catResults.reduce((s, r) => s + r.evaluation.score, 0) / catResults.length;
    const bar = '█'.repeat(Math.round(catAvg / 10)) + '░'.repeat(10 - Math.round(catAvg / 10));
    console.log(`  ${cat}: ${bar} ${catAvg.toFixed(0)}%`);
  }

  // Common issues
  console.log('\nCOMMON ISSUES:');
  const diagnosisCounts: Record<string, number> = {};
  results.forEach(r => {
    if (r.evaluation.score < 70) {
      diagnosisCounts[r.evaluation.diagnosis] = (diagnosisCounts[r.evaluation.diagnosis] || 0) + 1;
    }
  });
  Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([diag, count]) => {
      console.log(`  ${count}x: ${diag}`);
    });

  // Worst performing questions
  console.log('\nTOP 10 NEEDS IMPROVEMENT:');
  results
    .sort((a, b) => a.evaluation.score - b.evaluation.score)
    .slice(0, 10)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. Q${r.id} (${r.evaluation.score}%): ${r.question.substring(0, 50)}...`);
      console.log(`     → ${r.evaluation.diagnosis}`);
    });

  // Save detailed report
  const reportsDir = path.join(process.cwd(), 'test-suite', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const reportPath = path.join(reportsDir, 'comprehensive-quality-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalQuestions: 50,
      averageScore: avgScore,
      excellent,
      good,
      poor,
      genericResponses: generic,
      errors
    },
    byCategory: categories.map(cat => ({
      category: cat,
      averageScore: results.filter(r => r.category === cat)
        .reduce((s, r) => s + r.evaluation.score, 0) /
        results.filter(r => r.category === cat).length
    })),
    results
  }, null, 2));

  console.log(`\nDetailed report saved to: ${reportPath}`);
  console.log('\n' + '='.repeat(80));
}

runAllTests().catch(console.error);
