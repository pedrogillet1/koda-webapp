/**
 * Domain Reasoning Templates Service
 *
 * Provides domain-specific reasoning templates that guide the LLM
 * to follow structured thinking patterns for each domain.
 */

import { Domain } from './domainDetector.service';

export interface ReasoningTemplate {
  domain: Domain;
  steps: string[];
  outputFormat: string;
  exampleStructure: string;
}

/**
 * Reasoning templates for each domain
 */
const REASONING_TEMPLATES: Record<Domain, ReasoningTemplate> = {
  finance: {
    domain: 'finance',
    steps: [
      '1. Identify all financial terms mentioned (ROI, payback, NPV, IRR, margin, etc.)',
      '2. Extract all relevant numerical values (costs, revenues, investments)',
      '3. Identify scenarios presented (base, conservative, optimistic)',
      '4. Apply financial formulas step by step, showing each calculation',
      '5. Compare scenarios and highlight differences',
      '6. Assess viability based on calculated indicators',
      '7. Conclude with data-based recommendation'
    ],
    outputFormat: `
**Financial Summary:**
[Brief summary in 1-2 sentences]

**Key Indicators:**
- ROI: [value]% (calculation: [show])
- Payback: [value] months (calculation: [show])
- NPV: $[value] (calculation: [show])
- IRR: [value]% (calculation: [show])

**Scenario Comparison:**
| Indicator | Conservative | Base | Optimistic |
|-----------|-------------|------|----------|
| ROI       | X%          | Y%   | Z%       |
| Payback   | X months    | Y    | Z        |

**Analysis:**
[Interpretation of numbers]

**Conclusion:**
[Viability assessment]
`,
    exampleStructure: 'Summary -> Indicators -> Calculations -> Comparison -> Conclusion'
  },

  accounting: {
    domain: 'accounting',
    steps: [
      '1. Identify the type of financial statement (Balance Sheet, P&L, Cash Flow)',
      '2. Extract values from main accounts',
      '3. Calculate relevant accounting ratios (liquidity, leverage, profitability)',
      '4. Compare with previous periods (if available)',
      '5. Identify trends and significant variations',
      '6. Assess financial health based on ratios',
      '7. Summarize main conclusions'
    ],
    outputFormat: `
**Document Type:**
[Balance Sheet / Income Statement / Cash Flow Statement]

**Main Accounts:**
- Total Assets: $[value]
- Total Liabilities: $[value]
- Shareholders' Equity: $[value]

**Calculated Ratios:**
- Current Ratio: [value] (calculation: [show])
- Debt-to-Equity: [value]% (calculation: [show])
- ROE: [value]% (calculation: [show])

**Analysis:**
[Interpretation of ratios]

**Conclusion:**
[Financial health assessment]
`,
    exampleStructure: 'Identification -> Extraction -> Calculations -> Analysis -> Conclusion'
  },

  legal: {
    domain: 'legal',
    steps: [
      '1. Identify the document type (contract, agreement, term, policy)',
      '2. Extract relevant clauses with exact numbers and titles',
      '3. Summarize obligations of each party in plain language',
      '4. Identify critical deadlines, dates, and conditions',
      '5. Highlight penalty and termination clauses',
      '6. Identify risks or points of attention',
      '7. Include mandatory legal disclaimer'
    ],
    outputFormat: `
**Document Type:**
[Contract / Agreement / Term / etc.]

**Parties:**
- Party A: [name]
- Party B: [name]

**Key Clauses:**

**Clause [number] - [Title]:**
"[Exact clause text]"

**In plain language:** [Clear explanation]

**Obligations:**
- Party A: [list]
- Party B: [list]

**Important Deadlines:**
- [Date/deadline 1]: [description]
- [Date/deadline 2]: [description]

**Penalties:**
[Summary of non-compliance consequences]

**Important:** This analysis is based exclusively on the document provided. For specific legal guidance, consult a lawyer.
`,
    exampleStructure: 'Identification -> Clauses -> Obligations -> Deadlines -> Penalties -> Disclaimer'
  },

  medical: {
    domain: 'medical',
    steps: [
      '1. Identify the type of exam/report',
      '2. Extract all measurements with values and units',
      '3. Compare each value with its specific reference',
      '4. Separate normal values from abnormal values',
      '5. Summarize the "Impression/Conclusion" section of the report (if present)',
      '6. Explain abnormalities in plain language',
      '7. Include mandatory medical disclaimer'
    ],
    outputFormat: `
**Exam Type:**
[CBC / Blood Glucose / Imaging Report / etc.]

**Abnormal Values:**
- [Test name]: [value] [unit] (Reference: [range]) - **ELEVATED/REDUCED**
  -> **What it means:** [Simple explanation]

**Normal Values:**
- [Test name]: [value] [unit] (Reference: [range]) - Normal

**Report Conclusion:**
"[Text from physician's impression/conclusion]"

**In plain language:** [Clear explanation]

**Important:** This is only an explanation of the document content. For clinical interpretation and treatment guidance, consult your doctor.
`,
    exampleStructure: 'Identification -> Abnormal Values -> Normal Values -> Conclusion -> Disclaimer'
  },

  education: {
    domain: 'education',
    steps: [
      '1. Identify the text structure (introduction, development, conclusion)',
      '2. Extract the thesis or main argument',
      '3. List supporting arguments',
      '4. Assess cohesion and coherence',
      '5. Identify strengths',
      '6. Suggest specific improvements',
      '7. Provide constructive and encouraging feedback'
    ],
    outputFormat: `
**Text Structure:**
- Introduction: [summary]
- Development: [summary]
- Conclusion: [summary]

**Main Thesis:**
[What is the central argument?]

**Supporting Arguments:**
1. [Argument 1]
2. [Argument 2]
3. [Argument 3]

**Strengths:**
- [Strength 1]
- [Strength 2]

**Improvement Suggestions:**
- [Specific suggestion 1]
- [Specific suggestion 2]

**Feedback:**
[Encouraging and constructive comment]
`,
    exampleStructure: 'Structure -> Thesis -> Arguments -> Strengths -> Suggestions -> Feedback'
  },

  research: {
    domain: 'research',
    steps: [
      '1. Identify the article structure (Abstract, Introduction, Methodology, Results, Discussion)',
      '2. Extract hypothesis or research objective',
      '3. Describe methodology (design, sample, procedures)',
      '4. Summarize main results WITHOUT reinterpreting',
      '5. Identify statistical significance (p-values, confidence intervals)',
      '6. List explicitly mentioned limitations',
      '7. Summarize authors\' conclusions'
    ],
    outputFormat: `
**Study Type:**
[Experimental / Observational / Review / etc.]

**Objective:**
[What question does the research seek to answer?]

**Methodology:**
- Design: [study type]
- Sample: [n = X, characteristics]
- Procedures: [how it was done]
- Analysis: [statistical methods]

**Main Results:**
- [Result 1] (p = [value])
- [Result 2] (p = [value])

**Significance:**
[Are results statistically significant?]

**Limitations:**
- [Limitation 1]
- [Limitation 2]

**Authors' Conclusion:**
[What did the authors conclude?]

**Implications:**
[What does this mean in practice?]
`,
    exampleStructure: 'Objective -> Methodology -> Results -> Significance -> Limitations -> Conclusion'
  },

  general: {
    domain: 'general',
    steps: [
      '1. Understand the user\'s question',
      '2. Identify relevant information in the documents',
      '3. Organize information logically',
      '4. Answer clearly and in a structured manner',
      '5. Cite sources when applicable'
    ],
    outputFormat: `
**Answer:**
[Direct and clear answer]

**Details:**
[Additional relevant information]

**Source:**
[Document(s) used]
`,
    exampleStructure: 'Answer -> Details -> Source'
  }
};

/**
 * Get reasoning template for domain
 */
export function getReasoningTemplate(domain: Domain): ReasoningTemplate {
  return REASONING_TEMPLATES[domain] || REASONING_TEMPLATES.general;
}

/**
 * Build reasoning steps section for prompt
 */
export function buildReasoningStepsSection(domain: Domain): string {
  const template = getReasoningTemplate(domain);

  if (domain === 'general') {
    return '';
  }

  return `
================================================================================
REASONING STEPS FOR ${domain.toUpperCase()}
================================================================================

Follow these steps when analyzing and responding:

${template.steps.join('\n')}

================================================================================
`;
}

/**
 * Build output format section for prompt
 */
export function buildOutputFormatSection(domain: Domain): string {
  const template = getReasoningTemplate(domain);

  if (domain === 'general') {
    return '';
  }

  return `
================================================================================
EXPECTED OUTPUT FORMAT
================================================================================

Structure your response following this format:

${template.outputFormat}

Structure: ${template.exampleStructure}

================================================================================
`;
}

/**
 * Build complete reasoning section for prompt
 */
export function buildCompleteReasoningSection(domain: Domain): string {
  if (domain === 'general') {
    return '';
  }

  const template = getReasoningTemplate(domain);

  return `
================================================================================
DOMAIN-SPECIFIC REASONING: ${domain.toUpperCase()}
================================================================================

**ANALYSIS STEPS:**
${template.steps.join('\n')}

**OUTPUT FORMAT:**
${template.outputFormat}

**STRUCTURE:** ${template.exampleStructure}

================================================================================
`;
}

/**
 * Get domain-specific validation rules
 */
export function getDomainValidationRules(domain: Domain): string[] {
  const rules: Record<Domain, string[]> = {
    finance: [
      'All formulas must be shown step by step',
      'Values must be cited with source (document, page, table)',
      'Never invent numbers or projections',
      'Use conservative judgment in viability analyses'
    ],
    accounting: [
      'Ratios must be calculated with explicit formulas',
      'Values must match exactly those in the document',
      'Never give tax advice',
      'Identify inconsistencies but don\'t correct without context'
    ],
    legal: [
      'Always cite exact clause number',
      'Never give legal advice',
      'Use mandatory disclaimers',
      'Maintain neutrality and objectivity'
    ],
    medical: [
      'Never diagnose or recommend treatments',
      'Always compare values with references from the report itself',
      'Use mandatory medical disclaimers',
      'Explain in simple but precise language'
    ],
    education: [
      'Never fabricate citations',
      'Be encouraging and constructive',
      'Provide specific, not generic feedback',
      'Guide, don\'t solve'
    ],
    research: [
      'Never reinterpret scientific claims',
      'Never fabricate data',
      'Differentiate correlation from causation',
      'List limitations explicitly'
    ],
    general: [
      'Respond clearly and objectively',
      'Cite sources when applicable'
    ]
  };

  return rules[domain] || rules.general;
}

/**
 * Get domain example for few-shot learning
 */
export function getDomainExample(domain: Domain): { query: string; answer: string } | null {
  const examples: Partial<Record<Domain, { query: string; answer: string }>> = {
    finance: {
      query: 'What is the ROI and payback period of this project?',
      answer: `**Financial Analysis:**

**ROI (Return on Investment):**
- Formula: ROI = (Net Profit / Total Investment) x 100
- Calculation: ($500,000 / $2,000,000) x 100 = 25%
- **Result: 25% ROI**

**Payback:**
- Formula: Payback = Total Investment / Monthly Net Profit
- Calculation: $2,000,000 / $41,667 = 48 months
- **Result: 48 months (4 years)**

**Conclusion:**
The project presents a 25% ROI with investment recovery in 4 years. These indicators suggest moderate viability, considering the long-term horizon.

Would you like me to compare with other scenarios or analyze other indicators?`
    },

    legal: {
      query: 'What does the termination clause say?',
      answer: `**Clause 12 - Termination:**

According to Clause 12, Section 12.1:

"Either party may terminate this Agreement with 30 days' prior written notice, without penalty, provided all outstanding obligations are fulfilled."

**In plain language:**
- Either party can end the contract
- Must give 30 days' notice in writing
- No fine if notice is given properly
- All pending payments/obligations must be settled

**Consequences of termination (Section 12.3):**
- Return of confidential materials
- Final payment within 15 days
- No refund of amounts already paid

**Important:** This analysis is based exclusively on the document provided. For specific legal guidance, consult a lawyer.`
    },

    medical: {
      query: 'Is my blood glucose test normal?',
      answer: `**Blood Test Analysis:**

**Abnormal Values:**
- **Fasting Glucose**: 126 mg/dL (Reference: 70-99 mg/dL) - **ELEVATED**
  -> This value is above the normal range and may indicate diabetes or pre-diabetes.

**Normal Values:**
- **Hemoglobin A1c**: 5.4% (Reference: <5.7%) - Normal
- **Total Cholesterol**: 185 mg/dL (Reference: <200 mg/dL) - Normal
- **Creatinine**: 0.9 mg/dL (Reference: 0.7-1.3 mg/dL) - Normal

**Summary:**
Your fasting glucose is elevated (126 mg/dL), while other values are within normal range.

**Important:** This is only an explanation of the document content. For clinical interpretation and treatment guidance, consult your doctor.`
    }
  };

  return examples[domain] || null;
}

export default {
  getReasoningTemplate,
  buildReasoningStepsSection,
  buildOutputFormatSection,
  buildCompleteReasoningSection,
  getDomainValidationRules,
  getDomainExample
};
