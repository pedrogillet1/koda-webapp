/**
 * Python Executor Service - Manus Method
 * Executes Python code in a sandboxed environment
 */

import { spawn } from 'child_process';

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

class PythonExecutorService {
  private readonly TIMEOUT_MS = 30000; // 30 seconds
  private readonly MAX_CODE_LENGTH = 50000;

  // Dangerous imports to block
  private readonly BLOCKED_IMPORTS = [
    'os',
    'sys',
    'subprocess',
    'socket',
    'requests',
    'urllib',
    'http',
    'ftplib',
    'smtplib',
    'telnetlib',
    'pickle',
    'marshal',
    'shelve',
    'multiprocessing',
    'threading',
    'ctypes',
    'importlib',
    'builtins',
    '__builtin__'
  ];

  // Dangerous functions to block
  private readonly BLOCKED_FUNCTIONS = [
    'eval',
    'exec',
    'compile',
    '__import__',
    'open',
    'input',
    'breakpoint',
    'globals',
    'locals',
    'vars',
    'dir',
    'getattr',
    'setattr',
    'delattr'
  ];

  // Safe imports allowed
  private readonly ALLOWED_IMPORTS = [
    'numpy',
    'np',
    'pandas',
    'pd',
    'numpy_financial',
    'npf',
    'scipy',
    'statistics',
    'math',
    'datetime',
    'decimal',
    'fractions',
    'random',
    'collections',
    'itertools',
    'functools',
    'json',
    're'
  ];

  /**
   * Validate Python code for security
   */
  validateCode(code: string): ValidationResult {
    // Check code length
    if (code.length > this.MAX_CODE_LENGTH) {
      return { valid: false, reason: 'Code too long' };
    }

    // Check for blocked imports
    for (const blocked of this.BLOCKED_IMPORTS) {
      const importPattern = new RegExp(`\\bimport\\s+${blocked}\\b|\\bfrom\\s+${blocked}\\b`, 'i');
      if (importPattern.test(code)) {
        return { valid: false, reason: `Blocked import: ${blocked}` };
      }
    }

    // Check for blocked functions
    for (const blocked of this.BLOCKED_FUNCTIONS) {
      const funcPattern = new RegExp(`\\b${blocked}\\s*\\(`, 'i');
      if (funcPattern.test(code)) {
        return { valid: false, reason: `Blocked function: ${blocked}` };
      }
    }

    // Check for file operations with absolute paths
    if (/open\s*\(\s*['"][\/\\]/.test(code)) {
      return { valid: false, reason: 'Blocked: file operations with absolute paths' };
    }

    // Check for infinite loops without break
    const whileTruePattern = /while\s+True\s*:/gi;
    const matches = code.match(whileTruePattern);
    if (matches) {
      // Check if there's a break statement
      if (!code.includes('break')) {
        return { valid: false, reason: 'Blocked: potential infinite loop without break' };
      }
    }

    return { valid: true };
  }

  /**
   * Execute Python code
   */
  async executePython(code: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Validate code first
    const validation = this.validateCode(code);
    if (!validation.valid) {
      return {
        success: false,
        output: '',
        error: `Validation failed: ${validation.reason}`,
        executionTime: Date.now() - startTime
      };
    }

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';
      let timedOut = false;

      const pythonProcess = spawn('python', ['-c', code], {
        timeout: this.TIMEOUT_MS,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8'
        }
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        pythonProcess.kill('SIGTERM');
      }, this.TIMEOUT_MS);

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (exitCode) => {
        clearTimeout(timeout);
        const executionTime = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            output: output,
            error: 'Execution timed out',
            executionTime
          });
        } else if (exitCode !== 0) {
          // ✅ FIX: Handle Windows-specific exit codes with friendly messages
          let errorMessage = errorOutput || `Process exited with code ${exitCode}`;

          // 0xC0000142 = 3221225794 - Application failed to initialize
          if (exitCode === 3221225794 || exitCode === -1073741502) {
            errorMessage = 'Python process failed to initialize. This may be a temporary issue. Please try again.';
            console.error('[PYTHON] Process failed with Windows error 0xC0000142 - initialization failure');
          }
          // 0xC0000005 = Access violation
          else if (exitCode === 3221225477 || exitCode === -1073741819) {
            errorMessage = 'Python process encountered a memory error. Please try a simpler calculation.';
            console.error('[PYTHON] Process failed with Windows error 0xC0000005 - access violation');
          }

          resolve({
            success: false,
            output: output,
            error: errorMessage,
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
        clearTimeout(timeout);
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
   * Execute a calculation with generated code
   */
  async executeCalculation(code: string): Promise<ExecutionResult> {
    // Add common imports if not present
    let fullCode = code;
    if (!code.includes('import numpy') && !code.includes('from numpy')) {
      fullCode = 'import numpy as np\n' + fullCode;
    }
    return this.executePython(fullCode);
  }

  /**
   * Execute financial calculation
   */
  async executeFinancialCalculation(
    operation: string,
    params: Record<string, any>
  ): Promise<ExecutionResult> {
    let code = 'import numpy_financial as npf\nimport numpy as np\n\n';

    switch (operation.toUpperCase()) {
      case 'PMT':
        code += `rate = ${params.rate} / 12
nper = ${params.nper}
pv = ${params.pv}
result = npf.pmt(rate, nper, pv)
print(f"Monthly Payment: ${'{result:.2f}'}")`;
        break;

      case 'FV':
        code += `rate = ${params.rate}
nper = ${params.nper}
pmt = ${params.pmt || 0}
pv = ${params.pv || 0}
result = npf.fv(rate, nper, pmt, pv)
print(f"Future Value: ${'{result:.2f}'}")`;
        break;

      case 'NPV':
        code += `rate = ${params.rate}
cash_flows = ${JSON.stringify(params.cashFlows)}
result = npf.npv(rate, cash_flows)
print(f"NPV: ${'{result:.2f}'}")`;
        break;

      case 'IRR':
        code += `cash_flows = ${JSON.stringify(params.cashFlows)}
result = npf.irr(cash_flows)
print(f"IRR: ${'{result * 100:.2f}'}%")`;
        break;

      default:
        return {
          success: false,
          output: '',
          error: `Unknown operation: ${operation}`,
          executionTime: 0
        };
    }

    return this.executePython(code);
  }

  /**
   * Execute statistical calculation
   */
  async executeStatisticalCalculation(
    operation: string,
    data: number[]
  ): Promise<ExecutionResult> {
    let code = 'import numpy as np\nimport statistics\n\n';
    code += `data = ${JSON.stringify(data)}\n\n`;

    switch (operation.toUpperCase()) {
      case 'MEAN':
        code += `result = np.mean(data)\nprint(f"Mean: {result}")`;
        break;
      case 'MEDIAN':
        code += `result = np.median(data)\nprint(f"Median: {result}")`;
        break;
      case 'STDEV':
        code += `result = np.std(data, ddof=1)\nprint(f"Standard Deviation: {result}")`;
        break;
      case 'VAR':
        code += `result = np.var(data, ddof=1)\nprint(f"Variance: {result}")`;
        break;
      case 'SUM':
        code += `result = np.sum(data)\nprint(f"Sum: {result}")`;
        break;
      case 'MIN':
        code += `result = np.min(data)\nprint(f"Min: {result}")`;
        break;
      case 'MAX':
        code += `result = np.max(data)\nprint(f"Max: {result}")`;
        break;
      default:
        return {
          success: false,
          output: '',
          error: `Unknown operation: ${operation}`,
          executionTime: 0
        };
    }

    return this.executePython(code);
  }

  /**
   * Check if Python is available
   */
  async checkPythonAvailable(): Promise<boolean> {
    try {
      const result = await this.executePython('print("Python OK")');
      return result.success && result.output?.includes('Python OK');
    } catch {
      return false;
    }
  }

  /**
   * Get available Python modules
   */
  async getAvailableModules(): Promise<string[]> {
    const checkCode = `
import importlib

modules = ${JSON.stringify(this.ALLOWED_IMPORTS.filter(m => !['np', 'pd', 'npf'].includes(m)))}
available = []

for module in modules:
    try:
        importlib.import_module(module)
        available.append(module)
    except ImportError:
        pass

print(','.join(available))
`;

    const result = await this.executePython(checkCode);

    if (result.success && result.output) {
      return result.output.split(',').filter(m => m.length > 0);
    }

    return [];
  }

  /**
   * Execute code with data context (for document analysis)
   */
  async executeWithData(
    code: string,
    data: Record<string, any>
  ): Promise<ExecutionResult> {
    const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
    const wrappedCode = `
import json

# Injected data
_data = json.loads('${dataJson}')

# User code
${code}

# Auto-extract result
if 'result' in dir():
    print(json.dumps({'result': result}))
`;

    return this.executePython(wrappedCode);
  }
}

export default new PythonExecutorService();
