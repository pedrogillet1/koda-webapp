/**
 * Sandbox Manager Service
 * Manages sandboxed execution environments for Python code
 */

import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import pythonExecutor from './pythonExecutor.service';

interface SandboxSession {
  id: string;
  process: ChildProcess | null;
  createdAt: Date;
  lastUsed: Date;
  executionCount: number;
}

interface ExecutionOptions {
  timeout?: number;
  maxMemory?: number;
  maxConcurrentExecutions?: number;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

interface SandboxStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  activeExecutions: number;
  activeSessions: number;
}

class SandboxManagerService {
  private sessions: Map<string, SandboxSession> = new Map();
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly MAX_SESSIONS = 10;
  private readonly MAX_CONCURRENT = 10;
  private readonly SESSION_TTL = 300000; // 5 minutes

  private stats: SandboxStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    activeExecutions: 0,
    activeSessions: 0
  };

  constructor() {
    // Clean up stale sessions periodically
    setInterval(() => this.cleanupStaleSessions(), 60000);
  }

  /**
   * Initialize sandbox environment
   */
  async initialize(): Promise<void> {
    console.log('🔧 [SANDBOX] Initializing Python sandbox...');

    try {
      // Check Python availability
      const pythonAvailable = await pythonExecutor.checkPythonAvailable();

      if (!pythonAvailable) {
        throw new Error('Python is not available');
      }

      // Check available modules
      const modules = await pythonExecutor.getAvailableModules();
      console.log(`✅ [SANDBOX] Available modules: ${modules.join(', ')}`);

      // Reset stats
      this.stats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        activeExecutions: 0,
        activeSessions: 0
      };

      console.log('✅ [SANDBOX] Python sandbox initialized successfully');
    } catch (error: any) {
      console.error('❌ [SANDBOX] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Execute code with resource management
   */
  async executeWithLimits(
    code: string,
    config?: ExecutionOptions
  ): Promise<ExecutionResult> {
    // Check concurrent execution limit
    if (this.stats.activeExecutions >= (config?.maxConcurrentExecutions || this.MAX_CONCURRENT)) {
      return {
        success: false,
        output: '',
        error: 'Maximum concurrent executions reached. Please try again later.',
        executionTime: 0
      };
    }

    this.stats.activeExecutions++;
    this.stats.totalExecutions++;

    const startTime = Date.now();

    try {
      const result = await pythonExecutor.executePython(code);

      const executionTime = Date.now() - startTime;

      // Update stats
      if (result.success) {
        this.stats.successfulExecutions++;
      } else {
        this.stats.failedExecutions++;
      }

      // Update average execution time
      this.stats.averageExecutionTime =
        (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime) /
        this.stats.totalExecutions;

      return result;
    } finally {
      this.stats.activeExecutions--;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    pythonAvailable: boolean;
    stats: SandboxStats;
  }> {
    const pythonAvailable = await pythonExecutor.checkPythonAvailable();

    return {
      healthy: pythonAvailable && this.stats.activeExecutions < this.MAX_CONCURRENT,
      pythonAvailable,
      stats: this.getFullStats()
    };
  }

  /**
   * Get full sandbox statistics
   */
  getFullStats(): SandboxStats {
    return {
      ...this.stats,
      activeSessions: this.sessions.size
    };
  }

  /**
   * Create a new sandbox session
   */
  createSession(): string {
    // Clean up if at max capacity
    if (this.sessions.size >= this.MAX_SESSIONS) {
      this.cleanupOldestSession();
    }

    const sessionId = uuidv4();
    const session: SandboxSession = {
      id: sessionId,
      process: null,
      createdAt: new Date(),
      lastUsed: new Date(),
      executionCount: 0
    };

    this.sessions.set(sessionId, session);
    console.log(`Created sandbox session: ${sessionId}`);
    return sessionId;
  }

  /**
   * Execute code in a sandbox
   */
  async execute(
    sessionId: string,
    code: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        output: '',
        error: 'Session not found',
        executionTime: 0
      };
    }

    const startTime = Date.now();
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';
      let timedOut = false;

      const pythonProcess = spawn('python', ['-c', code], {
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8'
        }
      });

      session.process = pythonProcess;
      session.lastUsed = new Date();
      session.executionCount++;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        pythonProcess.kill('SIGTERM');
      }, timeout);

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        session.process = null;

        const executionTime = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            output: output,
            error: 'Execution timed out',
            executionTime
          });
        } else if (exitCode !== 0) {
          resolve({
            success: false,
            output: output,
            error: errorOutput || `Process exited with code ${exitCode}`,
            executionTime
          });
        } else {
          resolve({
            success: true,
            output: output.trim(),
            executionTime
          });
        }
      });

      pythonProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        session.process = null;
        resolve({
          success: false,
          output: '',
          error: `Failed to start Python: ${err.message}`,
          executionTime: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Destroy a sandbox session
   */
  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.process) {
      session.process.kill('SIGTERM');
    }

    this.sessions.delete(sessionId);
    console.log(`Destroyed sandbox session: ${sessionId}`);
    return true;
  }

  /**
   * Quick execute without session management
   */
  async quickExecute(code: string, timeout?: number): Promise<ExecutionResult> {
    const sessionId = this.createSession();
    try {
      return await this.execute(sessionId, code, { timeout });
    } finally {
      this.destroySession(sessionId);
    }
  }

  /**
   * Validate code for security
   */
  validateCode(code: string): { valid: boolean; reason?: string } {
    const blockedPatterns = [
      { pattern: /\bimport\s+os\b/, reason: 'os module blocked' },
      { pattern: /\bimport\s+sys\b/, reason: 'sys module blocked' },
      { pattern: /\bimport\s+subprocess\b/, reason: 'subprocess module blocked' },
      { pattern: /\bimport\s+socket\b/, reason: 'socket module blocked' },
      { pattern: /\b__import__\s*\(/, reason: '__import__ blocked' },
      { pattern: /\beval\s*\(/, reason: 'eval blocked' },
      { pattern: /\bexec\s*\(/, reason: 'exec blocked' },
      { pattern: /\bopen\s*\(\s*['"][\/\\]/, reason: 'file operations blocked' }
    ];

    for (const { pattern, reason } of blockedPatterns) {
      if (pattern.test(code)) {
        return { valid: false, reason };
      }
    }

    if (code.length > 50000) {
      return { valid: false, reason: 'Code too long' };
    }

    return { valid: true };
  }

  /**
   * Clean up stale sessions
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastUsed.getTime() > this.SESSION_TTL) {
        this.destroySession(sessionId);
      }
    }
  }

  /**
   * Clean up oldest session
   */
  private cleanupOldestSession(): void {
    let oldestId: string | null = null;
    let oldestTime = Date.now();

    for (const [sessionId, session] of this.sessions) {
      if (session.lastUsed.getTime() < oldestTime) {
        oldestTime = session.lastUsed.getTime();
        oldestId = sessionId;
      }
    }

    if (oldestId) {
      this.destroySession(oldestId);
    }
  }

  /**
   * Get session stats
   */
  getStats(): { activeSessions: number; totalExecutions: number } {
    let totalExecutions = 0;
    for (const session of this.sessions.values()) {
      totalExecutions += session.executionCount;
    }
    return {
      activeSessions: this.sessions.size,
      totalExecutions
    };
  }
}

export default new SandboxManagerService();
