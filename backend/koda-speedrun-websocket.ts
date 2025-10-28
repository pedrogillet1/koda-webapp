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
  // BASIC QUERIES (1-5)
  { id: 1, category: 'BASIC', difficulty: '🟢', question: 'Hello! How are you?' },
  { id: 2, category: 'BASIC', difficulty: '🟢', question: 'How many documents do I have?' },
  { id: 3, category: 'BASIC', difficulty: '🟢', question: 'What files do I have uploaded?' },
  { id: 4, category: 'BASIC', difficulty: '🟢', question: 'Where is the Koda Business Plan?' },
  { id: 5, category: 'BASIC', difficulty: '🟢', question: 'Do I have any Excel files?' },

  // INTERMEDIATE QUERIES (6-10)
  { id: 6, category: 'INTERMEDIATE', difficulty: '🟡', question: 'Where is the Lista_9 file located?' },
  { id: 7, category: 'INTERMEDIATE', difficulty: '🟡', question: 'What is the Koda blueprint about?' },
  { id: 8, category: 'INTERMEDIATE', difficulty: '🟡', question: 'What are the revenue projections for Year 3 in the business plan?' },
  { id: 9, category: 'INTERMEDIATE', difficulty: '🟡', question: "What's the difference between the blueprint and the business plan?" },
  { id: 10, category: 'INTERMEDIATE', difficulty: '🟡', question: 'Which documents are PDFs?' },

  // ADVANCED QUERIES (11-15)
  { id: 11, category: 'ADVANCED', difficulty: '🟠', question: "Based on all my documents, what is KODA's main value proposition?" },
  { id: 12, category: 'ADVANCED', difficulty: '🟠', question: 'What is the implementation roadmap mentioned in the blueprint?' },
  { id: 13, category: 'ADVANCED', difficulty: '🟠', question: "Explain how KODA's RAG architecture works according to the blueprint" },
  { id: 14, category: 'ADVANCED', difficulty: '🟠', question: 'What are the key financial metrics in the business plan for the first year?' },
  { id: 15, category: 'ADVANCED', difficulty: '🟠', question: 'Does the presentation mention the same revenue projections as the business plan?' },

  // COMPLEX QUERIES (16-20)
  { id: 16, category: 'COMPLEX', difficulty: '🔴', question: 'If I wanted to pitch KODA to investors, what are the top 3 points I should emphasize based on my documents?' },
  { id: 17, category: 'COMPLEX', difficulty: '🔴', question: 'In the blueprint, what is the "Chronos Engine" and how does it relate to KODA\'s overall functionality?' },
  { id: 18, category: 'COMPLEX', difficulty: '🔴', question: 'Compare the technical complexity described in the blueprint with the market strategy in the business plan. Are they aligned?' },
  { id: 19, category: 'COMPLEX', difficulty: '🔴', question: 'What embedding model does the blueprint recommend for the RAG architecture, and why is this choice important?' },
  { id: 20, category: 'COMPLEX', difficulty: '🔴', question: 'Based on all my documents, what are the biggest risks KODA faces in its first year, and what mitigation strategies are mentioned?' }
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
      console.log(`${colors.bright}Question ${i + 1}/20 ${testQuestion.difficulty} [${testQuestion.category}]${colors.reset}`);
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
    const maxScore = 400;
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
    const categories = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'COMPLEX'];
    categories.forEach(cat => {
      const catResults = this.results.filter(r => r.category === cat);
      const catScore = catResults.reduce((sum, r) => sum + r.scores.total, 0);
      const catMax = catResults.length * 20;
      const catPercent = (catScore / catMax) * 100;
      console.log(`  ${cat.padEnd(15)} ${catScore}/${catMax} (${catPercent.toFixed(1)}%)`);
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
