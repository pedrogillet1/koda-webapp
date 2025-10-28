import axios from 'axios';
import * as readline from 'readline';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

interface TestQuestion {
  id: number;
  category: string;
  difficulty: string;
  question: string;
  expectedKeywords?: string[];
}

interface TestResult {
  questionId: number;
  question: string;
  answer: string;
  responseTime: number;
  sources: any[];
  accuracy: number;
  completeness: number;
  sourceCitation: number;
  responseTimeScore: number;
  totalScore: number;
}

const TEST_QUESTIONS: TestQuestion[] = [
  // BASIC QUERIES (1-5)
  {
    id: 1,
    category: 'BASIC',
    difficulty: '🟢',
    question: 'Hello! How are you?',
    expectedKeywords: ['help', 'assist', 'documents']
  },
  {
    id: 2,
    category: 'BASIC',
    difficulty: '🟢',
    question: 'How many documents do I have?',
    expectedKeywords: ['4', 'four', 'documents']
  },
  {
    id: 3,
    category: 'BASIC',
    difficulty: '🟢',
    question: 'What files do I have uploaded?',
    expectedKeywords: ['Lista', 'blueprint', 'Business', 'Presentation']
  },
  {
    id: 4,
    category: 'BASIC',
    difficulty: '🟢',
    question: 'Where is the Koda Business Plan?',
    expectedKeywords: ['KodaBusinessPlanV12', 'pdf']
  },
  {
    id: 5,
    category: 'BASIC',
    difficulty: '🟢',
    question: 'Do I have any Excel files?',
    expectedKeywords: ['Lista', 'xlsx', 'Excel', 'yes']
  },

  // INTERMEDIATE QUERIES (6-10)
  {
    id: 6,
    category: 'INTERMEDIATE',
    difficulty: '🟡',
    question: 'Where is the Lista_9 file located?',
    expectedKeywords: ['Lista', 'folder', 'path']
  },
  {
    id: 7,
    category: 'INTERMEDIATE',
    difficulty: '🟡',
    question: 'What is the Koda blueprint about?',
    expectedKeywords: ['RAG', 'architecture', 'AI', 'assistant']
  },
  {
    id: 8,
    category: 'INTERMEDIATE',
    difficulty: '🟡',
    question: 'What are the revenue projections for Year 3 in the business plan?',
    expectedKeywords: ['revenue', 'Year 3', 'million', 'projection']
  },
  {
    id: 9,
    category: 'INTERMEDIATE',
    difficulty: '🟡',
    question: "What's the difference between the blueprint and the business plan?",
    expectedKeywords: ['technical', 'financial', 'implementation', 'strategy']
  },
  {
    id: 10,
    category: 'INTERMEDIATE',
    difficulty: '🟡',
    question: 'Which documents are PDFs?',
    expectedKeywords: ['KodaBusinessPlanV12', 'pdf']
  },

  // ADVANCED QUERIES (11-15)
  {
    id: 11,
    category: 'ADVANCED',
    difficulty: '🟠',
    question: "Based on all my documents, what is KODA's main value proposition?",
    expectedKeywords: ['RAG', 'document', 'intelligence', 'AI', 'retrieval']
  },
  {
    id: 12,
    category: 'ADVANCED',
    difficulty: '🟠',
    question: 'What is the implementation roadmap mentioned in the blueprint?',
    expectedKeywords: ['phase', 'roadmap', 'timeline', 'implementation']
  },
  {
    id: 13,
    category: 'ADVANCED',
    difficulty: '🟠',
    question: "Explain how KODA's RAG architecture works according to the blueprint",
    expectedKeywords: ['Ingestion', 'Retrieval', 'Generation', 'embedding', 'vector']
  },
  {
    id: 14,
    category: 'ADVANCED',
    difficulty: '🟠',
    question: 'What are the key financial metrics in the business plan for the first year?',
    expectedKeywords: ['revenue', 'Year 1', 'expense', 'profit', 'margin']
  },
  {
    id: 15,
    category: 'ADVANCED',
    difficulty: '🟠',
    question: 'Does the presentation mention the same revenue projections as the business plan?',
    expectedKeywords: ['presentation', 'business plan', 'revenue', 'projection']
  },

  // COMPLEX QUERIES (16-20)
  {
    id: 16,
    category: 'COMPLEX',
    difficulty: '🔴',
    question: 'If I wanted to pitch KODA to investors, what are the top 3 points I should emphasize based on my documents?',
    expectedKeywords: ['market', 'technical', 'financial', 'innovation', 'opportunity']
  },
  {
    id: 17,
    category: 'COMPLEX',
    difficulty: '🔴',
    question: "In the blueprint, what is the \"Chronos Engine\" and how does it relate to KODA's overall functionality?",
    expectedKeywords: ['Chronos', 'temporal', 'engine', 'intelligence', 'time']
  },
  {
    id: 18,
    category: 'COMPLEX',
    difficulty: '🔴',
    question: 'Compare the technical complexity described in the blueprint with the market strategy in the business plan. Are they aligned?',
    expectedKeywords: ['technical', 'market', 'aligned', 'strategy', 'complexity']
  },
  {
    id: 19,
    category: 'COMPLEX',
    difficulty: '🔴',
    question: 'What embedding model does the blueprint recommend for the RAG architecture, and why is this choice important?',
    expectedKeywords: ['embedding', 'model', 'text-embedding', 'semantic', 'vector']
  },
  {
    id: 20,
    category: 'COMPLEX',
    difficulty: '🔴',
    question: 'Based on all my documents, what are the biggest risks KODA faces in its first year, and what mitigation strategies are mentioned?',
    expectedKeywords: ['risk', 'mitigation', 'strategy', 'technical', 'market']
  }
];

class KodaSpeedrunTest {
  private baseURL: string;
  private accessToken: string;
  private results: TestResult[] = [];
  private totalStartTime: number = 0;

  constructor(baseURL: string, accessToken: string) {
    this.baseURL = baseURL;
    this.accessToken = accessToken;
  }

  private async sendQuery(question: string): Promise<{ answer: string; responseTime: number; sources: any[] }> {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseURL}/api/rag/query`,
        { query: question },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const responseTime = Date.now() - startTime;

      return {
        answer: response.data.answer || 'No answer received',
        responseTime,
        sources: response.data.sources || []
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        answer: `ERROR: ${error.message}`,
        responseTime,
        sources: []
      };
    }
  }

  private scoreAccuracy(answer: string, expectedKeywords?: string[]): number {
    if (answer.startsWith('ERROR:')) return 0;
    if (!expectedKeywords || expectedKeywords.length === 0) return 3;

    const lowerAnswer = answer.toLowerCase();
    const matchedKeywords = expectedKeywords.filter(keyword =>
      lowerAnswer.includes(keyword.toLowerCase())
    );

    const matchRate = matchedKeywords.length / expectedKeywords.length;

    if (matchRate >= 0.8) return 5;
    if (matchRate >= 0.6) return 4;
    if (matchRate >= 0.4) return 3;
    if (matchRate >= 0.2) return 2;
    return 1;
  }

  private scoreCompleteness(answer: string): number {
    if (answer.startsWith('ERROR:')) return 0;

    const wordCount = answer.split(/\s+/).length;

    if (wordCount >= 100) return 5;
    if (wordCount >= 50) return 4;
    if (wordCount >= 25) return 3;
    if (wordCount >= 10) return 2;
    return 1;
  }

  private scoreSourceCitation(sources: any[]): number {
    if (sources.length === 0) return 0;
    if (sources.length >= 3) return 5;
    if (sources.length >= 2) return 4;
    return 3;
  }

  private scoreResponseTime(responseTime: number): number {
    if (responseTime < 3000) return 5;
    if (responseTime < 5000) return 4;
    if (responseTime < 10000) return 3;
    if (responseTime < 15000) return 2;
    return 1;
  }

  private printHeader() {
    console.log(`\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║        🚀 KODA AI SPEEDRUN TEST - 20 QUESTIONS 🚀            ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  }

  private printQuestionHeader(testQuestion: TestQuestion, currentNumber: number, total: number) {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Question ${currentNumber}/${total} ${testQuestion.difficulty} [${testQuestion.category}]${colors.reset}`);
    console.log(`${colors.cyan}❓ ${testQuestion.question}${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  }

  private printResult(result: TestResult) {
    console.log(`\n${colors.green}✓ Answer (${result.responseTime}ms):${colors.reset}`);
    console.log(`  ${result.answer.substring(0, 200)}${result.answer.length > 200 ? '...' : ''}`);

    console.log(`\n${colors.yellow}📊 Scores:${colors.reset}`);
    console.log(`  Accuracy:        ${this.getScoreBar(result.accuracy)} ${result.accuracy}/5`);
    console.log(`  Completeness:    ${this.getScoreBar(result.completeness)} ${result.completeness}/5`);
    console.log(`  Source Citation: ${this.getScoreBar(result.sourceCitation)} ${result.sourceCitation}/5`);
    console.log(`  Response Time:   ${this.getScoreBar(result.responseTimeScore)} ${result.responseTimeScore}/5`);
    console.log(`  ${colors.bright}Total:           ${this.getScoreBar(result.totalScore, 20)} ${result.totalScore}/20${colors.reset}`);
  }

  private getScoreBar(score: number, max: number = 5): string {
    const filled = Math.round((score / max) * 10);
    const empty = 10 - filled;

    let color = colors.green;
    if (score / max < 0.6) color = colors.yellow;
    if (score / max < 0.4) color = colors.red;

    return `${color}${'█'.repeat(filled)}${'░'.repeat(empty)}${colors.reset}`;
  }

  private printSummary() {
    const totalScore = this.results.reduce((sum, r) => sum + r.totalScore, 0);
    const maxScore = this.results.length * 20;
    const percentage = (totalScore / maxScore) * 100;
    const totalTime = Date.now() - this.totalStartTime;

    let grade = 'F';
    let gradeColor = colors.red;
    if (percentage >= 90) { grade = 'A+'; gradeColor = colors.green; }
    else if (percentage >= 80) { grade = 'A'; gradeColor = colors.green; }
    else if (percentage >= 70) { grade = 'B'; gradeColor = colors.yellow; }
    else if (percentage >= 60) { grade = 'C'; gradeColor = colors.yellow; }
    else if (percentage >= 50) { grade = 'D'; gradeColor = colors.red; }

    console.log(`\n\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║                     📊 FINAL RESULTS 📊                      ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    console.log(`${colors.bright}Total Score:${colors.reset}       ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`);
    console.log(`${colors.bright}Grade:${colors.reset}             ${gradeColor}${grade}${colors.reset}`);
    console.log(`${colors.bright}Total Time:${colors.reset}        ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`${colors.bright}Avg Response Time:${colors.reset} ${(this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length).toFixed(0)}ms`);

    // Category breakdown
    console.log(`\n${colors.bright}${colors.magenta}Category Breakdown:${colors.reset}`);
    const categories = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'COMPLEX'];
    categories.forEach(cat => {
      const catResults = this.results.filter(r => {
        const q = TEST_QUESTIONS.find(tq => tq.id === r.questionId);
        return q?.category === cat;
      });
      const catScore = catResults.reduce((sum, r) => sum + r.totalScore, 0);
      const catMax = catResults.length * 20;
      const catPercent = (catScore / catMax) * 100;
      console.log(`  ${cat.padEnd(15)} ${catScore}/${catMax} (${catPercent.toFixed(1)}%)`);
    });

    // Top 3 best and worst
    const sorted = [...this.results].sort((a, b) => b.totalScore - a.totalScore);

    console.log(`\n${colors.bright}${colors.green}✓ Top 3 Questions:${colors.reset}`);
    sorted.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. Q${r.questionId} - ${r.totalScore}/20`);
    });

    console.log(`\n${colors.bright}${colors.red}✗ Bottom 3 Questions:${colors.reset}`);
    sorted.slice(-3).reverse().forEach((r, i) => {
      console.log(`  ${i + 1}. Q${r.questionId} - ${r.totalScore}/20`);
    });

    console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  }

  async runTest() {
    this.printHeader();
    this.totalStartTime = Date.now();

    for (let i = 0; i < TEST_QUESTIONS.length; i++) {
      const testQuestion = TEST_QUESTIONS[i];
      this.printQuestionHeader(testQuestion, i + 1, TEST_QUESTIONS.length);

      process.stdout.write(`${colors.yellow}⏳ Querying KODA...${colors.reset}`);

      const { answer, responseTime, sources } = await this.sendQuery(testQuestion.question);

      // Clear the "Querying..." line
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      const accuracy = this.scoreAccuracy(answer, testQuestion.expectedKeywords);
      const completeness = this.scoreCompleteness(answer);
      const sourceCitation = this.scoreSourceCitation(sources);
      const responseTimeScore = this.scoreResponseTime(responseTime);
      const totalScore = accuracy + completeness + sourceCitation + responseTimeScore;

      const result: TestResult = {
        questionId: testQuestion.id,
        question: testQuestion.question,
        answer,
        responseTime,
        sources,
        accuracy,
        completeness,
        sourceCitation,
        responseTimeScore,
        totalScore
      };

      this.results.push(result);
      this.printResult(result);

      // Small delay between questions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.printSummary();
  }
}

// Main execution
async function main() {
  const baseURL = 'https://localhost:3001'; // Change to your backend URL

  console.log(`${colors.bright}${colors.cyan}Please provide your access token:${colors.reset}`);
  console.log(`${colors.yellow}(You can get this from your browser's localStorage or by logging in)${colors.reset}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Access Token: ', async (accessToken) => {
    rl.close();

    if (!accessToken || accessToken.trim() === '') {
      console.log(`${colors.red}Error: Access token is required!${colors.reset}`);
      process.exit(1);
    }

    const tester = new KodaSpeedrunTest(baseURL, accessToken.trim());
    await tester.runTest();
  });
}

main().catch(error => {
  console.error(`${colors.red}Fatal Error:${colors.reset}`, error);
  process.exit(1);
});
