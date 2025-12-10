/**
 * Code Generator Service - Manus Method
 * Uses LLM (Gemini) to generate Python code for calculations
 *
 * ENHANCED with:
 * - Number normalization
 * - Financial function examples (numpy_financial)
 * - Percentage calculation fixes
 * - Better prompts for accurate calculations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeNumbersInQuery, extractNumbers } from './numberUtils';
import { detectCalculationType, CalculationType } from './calculationDetector';

interface CodeGenerationResult {
  success: boolean;
  code?: string;
  explanation?: string;
  error?: string;
  calculationType?: CalculationType;
}

// Financial function examples for the prompt
const FINANCIAL_EXAMPLES = `
**FINANCIAL FUNCTION EXAMPLES (use numpy_financial as npf):**

Example 1 - IRR (Internal Rate of Return):
Query: "Calculate IRR for cash flows: -$100,000, $30,000, $40,000, $50,000, $60,000"
\`\`\`python
import numpy_financial as npf
cash_flows = [-100000, 30000, 40000, 50000, 60000]
irr = npf.irr(cash_flows)
print(f"IRR: {irr * 100:.2f}%")
\`\`\`
Expected: IRR: 28.09%

Example 2 - NPV (Net Present Value):
Query: "Calculate NPV with 10% discount rate for cash flows: -$100,000, $30,000, $40,000, $50,000"
\`\`\`python
import numpy_financial as npf
rate = 0.10
cash_flows = [-100000, 30000, 40000, 50000]
npv = npf.npv(rate, cash_flows)
print(f"NPV: \${npv:,.2f}")
\`\`\`
Expected: NPV: $4,815.91

Example 3 - PV (Present Value):
Query: "What is the present value of $10,000 received in 5 years at 8% discount rate?"
\`\`\`python
import numpy_financial as npf
future_value = 10000
rate = 0.08
periods = 5
pv = npf.pv(rate, periods, 0, -future_value)
print(f"Present Value: \${pv:,.2f}")
\`\`\`
Expected: Present Value: $6,805.83

Example 4 - FV (Future Value):
Query: "What is the future value of $5,000 invested at 7% for 20 years compounded annually?"
\`\`\`python
import numpy_financial as npf
present_value = 5000
rate = 0.07
periods = 20
fv = npf.fv(rate, periods, 0, -present_value)
print(f"Future Value: \${fv:,.2f}")
\`\`\`
Expected: Future Value: $19,348.42

Example 5 - PMT (Loan Payment):
Query: "What is the monthly payment on a $200,000 loan at 5% annual interest for 30 years?"
\`\`\`python
import numpy_financial as npf
principal = 200000
annual_rate = 0.05
monthly_rate = annual_rate / 12
periods = 30 * 12  # 30 years * 12 months
payment = -npf.pmt(monthly_rate, periods, principal)
print(f"Monthly Payment: \${payment:,.2f}")
\`\`\`
Expected: Monthly Payment: $1,073.64

Example 6 - Simple Interest:
Query: "Calculate simple interest: Principal $10,000, Rate 5%, Time 3 years"
\`\`\`python
principal = 10000
rate = 0.05
time = 3
interest = principal * rate * time
print(f"Simple Interest: \${interest:,.2f}")
print(f"Total Amount: \${principal + interest:,.2f}")
\`\`\`
Expected: Simple Interest: $1,500.00

Example 7 - Compound Interest:
Query: "Calculate compound interest: $10,000 principal, 5% annual rate, 10 years"
\`\`\`python
principal = 10000
rate = 0.05
years = 10
final_amount = principal * (1 + rate) ** years
interest = final_amount - principal
print(f"Final Amount: \${final_amount:,.2f}")
print(f"Interest Earned: \${interest:,.2f}")
\`\`\`
Expected: Final Amount: $16,288.95

Example 8 - ROI:
Query: "Calculate ROI: Initial investment $50,000, Final value $75,000"
\`\`\`python
initial = 50000
final = 75000
roi = ((final - initial) / initial) * 100
print(f"ROI: {roi:.2f}%")
\`\`\`
Expected: ROI: 50.00%

Example 9 - CAGR:
Query: "Calculate CAGR: Starting value $1M, Ending value $2M, 5 years"
\`\`\`python
starting = 1000000
ending = 2000000
years = 5
cagr = ((ending / starting) ** (1 / years) - 1) * 100
print(f"CAGR: {cagr:.2f}%")
\`\`\`
Expected: CAGR: 14.87%
`;

const PERCENTAGE_EXAMPLES = `
**PERCENTAGE CALCULATION RULES:**

RULE 1: "X% of Y" = (X / 100) * Y
Query: "What is 25% of 480?"
\`\`\`python
percentage = 25
amount = 480
result = (percentage / 100) * amount
print(f"25% of 480 = {result}")
\`\`\`
Expected: 25% of 480 = 120

RULE 2: "What percentage is X of Y" = (X / Y) * 100
Query: "What percentage is 45 out of 180?"
\`\`\`python
part = 45
total = 180
percentage = (part / total) * 100
print(f"{part} out of {total} = {percentage:.2f}%")
\`\`\`
Expected: 45 out of 180 = 25.00%

RULE 3: "Percentage increase from X to Y" = ((Y - X) / X) * 100
Query: "Revenue increased from $50K to $65K. What is the percentage increase?"
\`\`\`python
old_value = 50000
new_value = 65000
increase = ((new_value - old_value) / old_value) * 100
print(f"Percentage Increase: {increase:.2f}%")
\`\`\`
Expected: Percentage Increase: 30.00%

RULE 4: "Percentage decrease from X to Y" = ((X - Y) / X) * 100
Query: "A price dropped from $80 to $60. What is the percentage decrease?"
\`\`\`python
old_value = 80
new_value = 60
decrease = ((old_value - new_value) / old_value) * 100
print(f"Percentage Decrease: {decrease:.2f}%")
\`\`\`
Expected: Percentage Decrease: 25.00%

RULE 5: "Final price after X% discount"
Query: "If a product costs $120 and has a 20% discount, what is the final price?"
\`\`\`python
original_price = 120
discount_percent = 20
discount_amount = (discount_percent / 100) * original_price
final_price = original_price - discount_amount
print(f"Discount Amount: \${discount_amount:.2f}")
print(f"Final Price: \${final_price:.2f}")
\`\`\`
Expected: Final Price: $96.00
`;

const STATISTICS_EXAMPLES = `
**STATISTICS EXAMPLES:**

Median:
\`\`\`python
import statistics
data = [5, 12, 18, 23, 45, 67, 89]
median = statistics.median(data)
print(f"Median: {median}")
\`\`\`

Standard Deviation:
\`\`\`python
import statistics
data = [10, 20, 30, 40, 50]
stdev = statistics.stdev(data)  # sample stdev
print(f"Standard Deviation: {stdev:.4f}")
\`\`\`

Variance:
\`\`\`python
import statistics
data = [2, 4, 6, 8, 10]
var = statistics.pvariance(data)  # population variance
print(f"Variance: {var}")
\`\`\`

Mode:
\`\`\`python
import statistics
data = [3, 5, 5, 7, 8, 5, 9, 10]
mode = statistics.mode(data)
print(f"Mode: {mode}")
\`\`\`

Range:
\`\`\`python
data = [15, 22, 8, 45, 33, 12]
range_val = max(data) - min(data)
print(f"Range: {range_val}")
\`\`\`
`;

const CONVERSION_EXAMPLES = `
**UNIT CONVERSION EXAMPLES:**

Kilometers to Miles:
\`\`\`python
km = 5
miles = km * 0.621371
print(f"{km} km = {miles:.3f} miles")
\`\`\`

Fahrenheit to Celsius:
\`\`\`python
fahrenheit = 100
celsius = (fahrenheit - 32) * 5/9
print(f"{fahrenheit}°F = {celsius:.2f}°C")
\`\`\`

Hours to Seconds:
\`\`\`python
hours = 2.5
seconds = hours * 60 * 60
print(f"{hours} hours = {seconds:,.0f} seconds")
\`\`\`

Pounds to Kilograms:
\`\`\`python
pounds = 150
kg = pounds * 0.453592
print(f"{pounds} lbs = {kg:.2f} kg")
\`\`\`

Hours to Days:
\`\`\`python
hours = 10000
days = hours / 24
print(f"{hours:,} hours = {days:.2f} days")
\`\`\`
`;

const RATIO_EXAMPLES = `
**RATIO EXAMPLES:**

Ratio Problem:
Query: "If the ratio of A to B is 3:5 and A is 60, what is B?"
\`\`\`python
ratio_a = 3
ratio_b = 5
value_a = 60
# If A:B = 3:5 and A = 60
# Then 60/3 = 20 is the multiplier
# B = 5 * 20 = 100
multiplier = value_a / ratio_a
value_b = ratio_b * multiplier
print(f"B = {value_b}")
\`\`\`
Expected: B = 100

Debt-to-Equity Ratio:
\`\`\`python
debt = 500000
equity = 1000000
ratio = debt / equity
print(f"Debt-to-Equity Ratio: {ratio:.2f}")
\`\`\`
Expected: 0.50

P/E Ratio:
\`\`\`python
stock_price = 50
eps = 5
pe_ratio = stock_price / eps
print(f"P/E Ratio: {pe_ratio}")
\`\`\`
Expected: P/E Ratio: 10

Divide in Ratio:
Query: "Divide $10,000 in the ratio 2:3:5"
\`\`\`python
total = 10000
ratio = [2, 3, 5]
total_parts = sum(ratio)
amounts = [(r / total_parts) * total for r in ratio]
for i, amt in enumerate(amounts):
    print(f"Part {i+1}: \${amt:,.2f}")
\`\`\`
Expected: Part 1: $2,000.00, Part 2: $3,000.00, Part 3: $5,000.00
`;

const BUSINESS_EXAMPLES = `
**BUSINESS METRICS EXAMPLES:**

Customer Lifetime Value (CLV):
\`\`\`python
avg_purchase = 100
purchases_per_year = 4
customer_lifespan = 5  # years
clv = avg_purchase * purchases_per_year * customer_lifespan
print(f"Customer Lifetime Value: \${clv:,.2f}")
\`\`\`
Expected: CLV: $2,000.00

Customer Acquisition Cost (CAC):
\`\`\`python
marketing_spend = 50000
customers_acquired = 500
cac = marketing_spend / customers_acquired
print(f"CAC: \${cac:.2f}")
\`\`\`
Expected: CAC: $100.00

Churn Rate:
\`\`\`python
starting_customers = 1000
lost_customers = 50
churn_rate = (lost_customers / starting_customers) * 100
print(f"Churn Rate: {churn_rate:.2f}%")
\`\`\`
Expected: Churn Rate: 5.00%

Revenue per Employee:
\`\`\`python
revenue = 5000000
employees = 50
rev_per_employee = revenue / employees
print(f"Revenue per Employee: \${rev_per_employee:,.2f}")
\`\`\`
Expected: Revenue per Employee: $100,000.00

Payback Period:
\`\`\`python
initial_investment = 100000
annual_cash_flow = 25000
payback_period = initial_investment / annual_cash_flow
print(f"Payback Period: {payback_period:.2f} years")
\`\`\`
Expected: Payback Period: 4.00 years

Break-Even Point:
\`\`\`python
fixed_costs = 50000
variable_cost_per_unit = 20
selling_price_per_unit = 50
contribution_margin = selling_price_per_unit - variable_cost_per_unit
break_even_units = fixed_costs / contribution_margin
print(f"Break-Even Point: {break_even_units:.0f} units")
\`\`\`
Expected: Break-Even Point: 1,667 units
`;

class CodeGeneratorService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,  // Lower temperature for more accurate calculations
        maxOutputTokens: 2000,
      }
    });
  }

  /**
   * Generate Python code for a calculation query
   */
  async generateCalculationCode(query: string, context?: string): Promise<CodeGenerationResult> {
    try {
      // 1. Normalize numbers in query
      const normalizedQuery = normalizeNumbersInQuery(query);
      console.log('📝 [CODE-GEN] Original:', query);
      console.log('📝 [CODE-GEN] Normalized:', normalizedQuery);

      // 2. Detect calculation type
      const calculationType = detectCalculationType(normalizedQuery);
      console.log('📝 [CODE-GEN] Type:', calculationType.type, '| SubType:', calculationType.subType || 'N/A');

      // 3. Build prompt with relevant examples
      const prompt = this.buildCodeGenerationPrompt(normalizedQuery, calculationType, context);

      // 4. Generate code
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // 5. Extract code
      const code = this.extractPythonCode(response);

      if (!code) {
        return {
          success: false,
          error: 'Failed to generate valid Python code',
          calculationType
        };
      }

      return {
        success: true,
        code,
        explanation: this.extractExplanation(response),
        calculationType
      };
    } catch (error) {
      console.error('Code generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build the prompt for code generation with type-specific examples
   */
  private buildCodeGenerationPrompt(query: string, calculationType: CalculationType, context?: string): string {
    // Select relevant examples based on calculation type
    let examples = '';
    switch (calculationType.type) {
      case 'financial':
        examples = FINANCIAL_EXAMPLES;
        break;
      case 'percentage':
        examples = PERCENTAGE_EXAMPLES;
        break;
      case 'statistics':
        examples = STATISTICS_EXAMPLES;
        break;
      case 'conversion':
        examples = CONVERSION_EXAMPLES;
        break;
      case 'ratio':
        examples = RATIO_EXAMPLES;
        break;
      case 'growth':
        examples = FINANCIAL_EXAMPLES + '\n' + BUSINESS_EXAMPLES;
        break;
      case 'complex':
        examples = FINANCIAL_EXAMPLES + '\n' + BUSINESS_EXAMPLES;
        break;
      default:
        // For arithmetic, include percentage since it's common
        examples = PERCENTAGE_EXAMPLES;
    }

    return `You are an expert Python code generator for financial and mathematical calculations.

TASK: Generate Python code to answer this query: "${query}"

${context ? `CONTEXT: ${context}` : ''}

**CALCULATION TYPE DETECTED: ${calculationType.type.toUpperCase()}**
${calculationType.subType ? `**SUBTYPE: ${calculationType.subType.toUpperCase()}**` : ''}

**AVAILABLE LIBRARIES:**
- numpy_financial as npf (for IRR, NPV, PV, FV, PMT) - ALWAYS use this for financial calculations
- numpy as np
- pandas as pd
- statistics (for median, mode, stdev, variance)
- math
- datetime

**CRITICAL RULES:**
1. For financial functions, ALWAYS use numpy_financial (npf), NOT numpy
2. Convert percentages to decimals: 5% = 0.05
3. For IRR/NPV: First cash flow should be negative (initial investment)
4. For PV/FV: Use negative signs for cash outflows
5. For PMT: Negate the result to get positive payment amount
6. Round financial results to 2 decimal places
7. Format currency with $ and commas
8. Format percentages with %
9. ALWAYS print the final result clearly
10. **CRITICAL - ENGLISH ONLY:** All print statements and output MUST be in ENGLISH.
    - Use "IRR:" not "TIR:" (Portuguese/Spanish)
    - Use "NPV:" not "VPL:" (Portuguese)
    - Use "The result is" not "O resultado é" or "Le résultat est"
    - Regardless of the input language, ALL OUTPUT MUST BE IN ENGLISH

${examples}

**OUTPUT FORMAT:**
\`\`\`python
# Your complete code here
# Print results clearly at the end
# ALL PRINT STATEMENTS MUST BE IN ENGLISH
\`\`\`

**EXPLANATION:**
Brief explanation of how the calculation was done. (IN ENGLISH ONLY)

Generate the code now:`;
  }

  /**
   * Extract Python code from LLM response
   */
  private extractPythonCode(response: string): string | null {
    // Try to extract code between ```python and ```
    const pythonMatch = response.match(/```python\n([\s\S]*?)```/);
    if (pythonMatch) {
      return pythonMatch[1].trim();
    }

    // Try generic code blocks
    const codeMatch = response.match(/```\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }

    // If no code blocks, look for import statements
    if (response.includes('import ') && response.includes('print(')) {
      // Extract everything that looks like code
      const lines = response.split('\n');
      const codeLines = lines.filter(line =>
        line.trim().startsWith('import ') ||
        line.trim().startsWith('from ') ||
        line.trim().match(/^[a-zA-Z_]/) ||
        line.trim().startsWith('#') ||
        line.trim().startsWith('print')
      );
      if (codeLines.length > 0) {
        return codeLines.join('\n').trim();
      }
    }

    return null;
  }

  /**
   * Extract explanation from LLM response
   */
  private extractExplanation(response: string): string | undefined {
    const explanationMatch = response.match(/(?:EXPLANATION|How I calculated):\s*([\s\S]*?)(?:```|$)/i);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }
    return undefined;
  }

  /**
   * Generate code for financial calculation
   */
  async generateFinancialCode(operation: string, params: Record<string, any>): Promise<CodeGenerationResult> {
    const query = `Calculate ${operation} with parameters: ${JSON.stringify(params)}`;
    return this.generateCalculationCode(query);
  }

  /**
   * Generate code for statistical calculation
   */
  async generateStatisticalCode(operation: string, data: number[]): Promise<CodeGenerationResult> {
    const query = `Calculate ${operation} for the data: [${data.join(', ')}]`;
    return this.generateCalculationCode(query);
  }

  /**
   * Generate code for data analysis
   */
  async generateDataAnalysisCode(
    operation: string,
    data: any,
    options?: Record<string, any>
  ): Promise<CodeGenerationResult> {
    const query = `Perform ${operation} analysis on the data: ${JSON.stringify(data)}${
      options ? ` with options: ${JSON.stringify(options)}` : ''
    }`;
    return this.generateCalculationCode(query);
  }
}

export default new CodeGeneratorService();
