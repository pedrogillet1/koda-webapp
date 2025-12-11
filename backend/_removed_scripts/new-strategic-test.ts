import { io, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { config } from './src/config/env';

// ANSI color codes
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
}

const TEST_QUESTIONS: TestQuestion[] = [
  // CATEGORY 1: SIMPLE RETRIEVAL (8 questions)
  { id: 1, category: 'SIMPLE RETRIEVAL', difficulty: '🟢', question: 'What is Koda AI\'s core purpose?' },
  { id: 2, category: 'SIMPLE RETRIEVAL', difficulty: '🟢', question: 'How many acres is the Montana Rocking CC Sanctuary?' },
  { id: 3, category: 'SIMPLE RETRIEVAL', difficulty: '🟢', question: 'When was the Hotel Baxter formally opened?' },
  { id: 4, category: 'SIMPLE RETRIEVAL', difficulty: '🟡', question: 'What psychological frameworks does Koda AI apply?' },
  { id: 5, category: 'SIMPLE RETRIEVAL', difficulty: '🟢', question: 'How many guest rooms did the Hotel Baxter have?' },
  { id: 6, category: 'SIMPLE RETRIEVAL', difficulty: '🟢', question: 'What is the location of the Rocking CC Sanctuary?' },
  { id: 7, category: 'SIMPLE RETRIEVAL', difficulty: '🟡', question: 'What are Koda AI\'s three reasoning layers?' },
  { id: 8, category: 'SIMPLE RETRIEVAL', difficulty: '🟡', question: 'Who designed the Hotel Baxter?' },

  // CATEGORY 2: DATA EXTRACTION (7 questions)
  { id: 9, category: 'DATA EXTRACTION', difficulty: '🟢', question: 'What is the average daily rate (ADR) for the Baxter Hotel?' },
  { id: 10, category: 'DATA EXTRACTION', difficulty: '🟡', question: 'What is the total gross revenue projection for the Baxter Hotel?' },
  { id: 11, category: 'DATA EXTRACTION', difficulty: '🟢', question: 'What is the ROI for the Baxter Hotel?' },
  { id: 12, category: 'DATA EXTRACTION', difficulty: '🟡', question: 'What is the total operating revenue for Lone Mountain Ranch in January 2025?' },
  { id: 13, category: 'DATA EXTRACTION', difficulty: '🟢', question: 'What is the occupancy rate assumption for the Baxter Hotel?' },
  { id: 14, category: 'DATA EXTRACTION', difficulty: '🟡', question: 'What is the EBITDA for Lone Mountain Ranch in January 2025?' },
  { id: 15, category: 'DATA EXTRACTION', difficulty: '🟠', question: 'What is the total portfolio ROI across all properties?' },

  // CATEGORY 3: CONCEPTUAL (5 questions)
  { id: 16, category: 'CONCEPTUAL', difficulty: '🟡', question: 'How should Koda AI behave when it\'s unsure of an answer?' },
  { id: 17, category: 'CONCEPTUAL', difficulty: '🟡', question: 'What is Koda AI\'s personality model based on?' },
  { id: 18, category: 'CONCEPTUAL', difficulty: '🟡', question: 'What makes the Rocking CC Sanctuary a valuable investment opportunity?' },
  { id: 19, category: 'CONCEPTUAL', difficulty: '🟠', question: 'What is the RevPAR model and how is it calculated?' },
  { id: 20, category: 'CONCEPTUAL', difficulty: '🟡', question: 'What was the historical significance of the Hotel Baxter in Bozeman?' },

  // CATEGORY 4: DOCUMENT RECOGNITION (4 questions)
  { id: 21, category: 'DOC RECOGNITION', difficulty: '🟢', question: 'Do I have any Word documents?' },
  { id: 22, category: 'DOC RECOGNITION', difficulty: '🟡', question: 'Which document contains financial projections and ROI calculations?' },
  { id: 23, category: 'DOC RECOGNITION', difficulty: '🟡', question: 'Which document is a historical article?' },
  { id: 24, category: 'DOC RECOGNITION', difficulty: '🟢', question: 'Which document contains a detailed P&L budget?' },

  // CATEGORY 5: CROSS-DOCUMENT SYNTHESIS (3 questions)
  { id: 25, category: 'SYNTHESIS', difficulty: '🟠', question: 'What properties are mentioned across all my documents?' },
  { id: 26, category: 'SYNTHESIS', difficulty: '🔴', question: 'How does the Baxter Hotel\'s profitability compare to other properties in the portfolio?' },
  { id: 27, category: 'SYNTHESIS', difficulty: '🔴', question: 'What is the connection between the historical Hotel Baxter and the current investment analysis?' },

  // CATEGORY 6: VAGUE QUERIES (2 questions)
  { id: 28, category: 'VAGUE QUERIES', difficulty: '🟡', question: 'Tell me about the hotels' },
  { id: 29, category: 'VAGUE QUERIES', difficulty: '🟠', question: 'What are the revenue streams?' },

  // CATEGORY 7: NEGATIVE TESTS (1 question)
  { id: 30, category: 'NEGATIVE TESTS', difficulty: '🟢', question: 'What is the CEO\'s name for the Rocking CC Sanctuary?' }
];

class KodaWebSocketTester {
  private socket: Socket | null = null;
  private conversationId: string = '';
  private currentAnswer: string = '';
  private currentSources: any[] = [];
  private messageReceived: boolean = false;
  private startTime: number = 0;
  private results: any[] = [];

  constructor(private accessToken: string, private userId: string) {}

  private async createConversation(): Promise<string> {
    const axios = require('axios');
    try {
      const response = await axios.post(
        'http://localhost:5000/api/chat/conversations',
        { title: 'KODA AI Speedrun Test' },
        { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
      );
      return response.data.id;
    } catch (error: any) {
      console.error(`${colors.red}✗ Failed to create conversation:${colors.reset}`, error.message);
      throw error;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`${colors.yellow}🔌 Connecting to WebSocket...${colors.reset}`);

      this.socket = io('http://localhost:5000', {
        auth: { token: this.accessToken },
        transports: ['websocket']
      });

      this.socket.on('connect', () => {
        console.log(`${colors.green}✓ Connected to WebSocket${colors.reset}\n`);

        // Join conversation room
        this.socket?.emit('join-conversation', this.conversationId);

        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error(`${colors.red}✗ Connection error:${colors.reset}`, error.message);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log(`${colors.yellow}🔌 Disconnected from WebSocket${colors.reset}`);
      });

      // Listen for streaming chunks
      this.socket.on('message-chunk', (data: { chunk: string; conversationId: string }) => {
        if (data.conversationId === this.conversationId) {
          this.currentAnswer += data.chunk;
        }
      });

      // Listen for complete message
      this.socket.on('new-message', (data: any) => {
        if (data.conversationId === this.conversationId) {
          this.currentAnswer = data.assistantMessage.content;
          this.currentSources = data.sources || [];
          this.messageReceived = true;
        }
      });

      this.socket.on('message-error', (error: any) => {
        console.error(`${colors.red}✗ Message error:${colors.reset}`, error);
        this.messageReceived = true;
      });
    });
  }

  private async sendMessage(question: string): Promise<{ answer: string; sources: any[]; responseTime: number }> {
    this.currentAnswer = '';
    this.currentSources = [];
    this.messageReceived = false;
    this.startTime = Date.now();

    // Send message via WebSocket
    this.socket?.emit('send-message', {
      conversationId: this.conversationId,
      content: question
    });

    // Wait for response
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.messageReceived) {
          clearInterval(checkInterval);
          const responseTime = Date.now() - this.startTime;
          resolve({
            answer: this.currentAnswer || 'No response received',
            sources: this.currentSources,
            responseTime
          });
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.messageReceived) {
          clearInterval(checkInterval);
          const responseTime = Date.now() - this.startTime;
          resolve({
            answer: 'TIMEOUT: No response within 30 seconds',
            sources: [],
            responseTime
          });
        }
      }, 30000);
    });
  }

  private getScoreBar(score: number, max: number = 5): string {
    const filled = Math.round((score / max) * 10);
    const empty = 10 - filled;
    let color = colors.green;
    if (score / max < 0.6) color = colors.yellow;
    if (score / max < 0.4) color = colors.red;
    return `${color}${'█'.repeat(filled)}${'░'.repeat(empty)}${colors.reset}`;
  }

  private scoreResponse(answer: string, sources: any[], responseTime: number): any {
    const accuracy = answer.includes('ERROR') || answer.includes('TIMEOUT') ? 0 : 3;
    const completeness = Math.min(5, Math.floor(answer.split(/\s+/).length / 20));
    const sourceCitation = Math.min(5, sources.length * 2);
    const responseTimeScore = responseTime < 3000 ? 5 : responseTime < 5000 ? 4 : responseTime < 10000 ? 3 : 2;

    return {
      accuracy,
      completeness,
      sourceCitation,
      responseTimeScore,
      total: accuracy + completeness + sourceCitation + responseTimeScore
    };
  }

  async runTest() {
    console.log(`\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║     🚀 KODA AI SPEEDRUN TEST - WebSocket Edition 🚀         ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    // Create a new conversation
    console.log(`${colors.yellow}📝 Creating test conversation...${colors.reset}`);
    this.conversationId = await this.createConversation();
    console.log(`${colors.green}✓ Conversation created: ${this.conversationId}${colors.reset}\n`);

    await this.connectWebSocket();

    const totalStartTime = Date.now();

    for (let i = 0; i < TEST_QUESTIONS.length; i++) {
      const testQuestion = TEST_QUESTIONS[i];

      console.log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.bright}Question ${i + 1}/30 ${testQuestion.difficulty} [${testQuestion.category}]${colors.reset}`);
      console.log(`${colors.cyan}❓ ${testQuestion.question}${colors.reset}`);
      console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

      process.stdout.write(`${colors.yellow}⏳ Waiting for response...${colors.reset}`);

      const { answer, sources, responseTime } = await this.sendMessage(testQuestion.question);

      // Clear the waiting line
      process.stdout.write('\r' + ' '.repeat(50) + '\r');

      console.log(`${colors.green}✓ Response received in ${responseTime}ms${colors.reset}\n`);
      console.log(`${colors.bright}Answer:${colors.reset}`);
      console.log(`  ${answer.substring(0, 300)}${answer.length > 300 ? '...' : ''}\n`);

      if (sources.length > 0) {
        console.log(`${colors.magenta}📚 Sources (${sources.length}):${colors.reset}`);
        sources.slice(0, 3).forEach((source: any, idx: number) => {
          console.log(`  ${idx + 1}. ${source.filename || 'Unknown'}`);
        });
        console.log('');
      }

      const scores = this.scoreResponse(answer, sources, responseTime);
      console.log(`${colors.yellow}📊 Scores:${colors.reset}`);
      console.log(`  Accuracy:        ${this.getScoreBar(scores.accuracy)} ${scores.accuracy}/5`);
      console.log(`  Completeness:    ${this.getScoreBar(scores.completeness)} ${scores.completeness}/5`);
      console.log(`  Source Citation: ${this.getScoreBar(scores.sourceCitation)} ${scores.sourceCitation}/5`);
      console.log(`  Response Time:   ${this.getScoreBar(scores.responseTimeScore)} ${scores.responseTimeScore}/5`);
      console.log(`  ${colors.bright}Total:           ${this.getScoreBar(scores.total, 20)} ${scores.total}/20${colors.reset}\n`);

      this.results.push({
        questionId: testQuestion.id,
        category: testQuestion.category,
        scores
      });

      // Small delay between questions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const totalTime = Date.now() - totalStartTime;

    // Print summary
    const totalScore = this.results.reduce((sum, r) => sum + r.scores.total, 0);
    const maxScore = 600; // 30 questions × 20 points each
    const percentage = (totalScore / maxScore) * 100;

    console.log(`\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║                     📊 FINAL RESULTS 📊                      ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    let grade = 'F';
    let gradeColor = colors.red;
    if (percentage >= 90) { grade = 'A+'; gradeColor = colors.green; }
    else if (percentage >= 80) { grade = 'A'; gradeColor = colors.green; }
    else if (percentage >= 70) { grade = 'B'; gradeColor = colors.yellow; }
    else if (percentage >= 60) { grade = 'C'; gradeColor = colors.yellow; }

    console.log(`${colors.bright}Total Score:${colors.reset}       ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`);
    console.log(`${colors.bright}Grade:${colors.reset}             ${gradeColor}${grade}${colors.reset}`);
    console.log(`${colors.bright}Total Time:${colors.reset}        ${(totalTime / 1000).toFixed(2)}s\n`);

    // Category breakdown
    console.log(`${colors.bright}${colors.magenta}Category Breakdown:${colors.reset}`);
    const categories = ['SIMPLE RETRIEVAL', 'DATA EXTRACTION', 'CONCEPTUAL', 'DOC RECOGNITION', 'VAGUE QUERIES', 'SYNTHESIS', 'NEGATIVE TESTS'];
    categories.forEach(cat => {
      const catResults = this.results.filter(r => r.category === cat);
      if (catResults.length > 0) {
        const catScore = catResults.reduce((sum, r) => sum + r.scores.total, 0);
        const catMax = catResults.length * 20;
        const catPercent = (catScore / catMax) * 100;
        console.log(`  ${cat.padEnd(18)} ${catScore}/${catMax} (${catPercent.toFixed(1)}%)`);
      }
    });

    console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    // Disconnect
    this.socket?.disconnect();
  }
}

// Main execution
async function main() {
  console.log(`${colors.bright}${colors.cyan}KODA Speedrun Test - WebSocket Edition${colors.reset}\n`);

  // Test user credentials
  const testEmail = '123hackerabc@gmail.com';
  const testUserId = '03ec97ac-1934-4188-8471-524366d87521';

  console.log(`${colors.yellow}🔑 Testing with account: ${testEmail}${colors.reset}\n`);

  // Generate a token for testing
  const accessToken = jwt.sign(
    { userId: testUserId, email: testEmail },
    config.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );

  const tester = new KodaWebSocketTester(accessToken, testUserId);
  await tester.runTest();
}

main().catch(error => {
  console.error(`${colors.red}Fatal Error:${colors.reset}`, error);
  process.exit(1);
});
