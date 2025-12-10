/**
 * Python Execution Engine (Layer 2)
 *
 * Executes complex calculations using Python subprocess.
 * Provides access to numpy, pandas, scipy for advanced analytics.
 *
 * Performance: 100-500ms (process spawn overhead)
 * Use cases: Matrix operations, regression, optimization, data analysis
 */

import { spawn } from 'child_process';
import { CalculationResult, PythonExecutionParams } from './calculationTypes';

class PythonEngineService {
  private pythonPath: string = 'python3';
  private timeout: number = 30000; // 30 second default timeout

  constructor() {
    // Try to detect Python path
    this.detectPython();
  }

  /**
   * Detect available Python installation
   */
  private async detectPython(): Promise<void> {
    const paths = ['python3', 'python', 'py'];

    for (const path of paths) {
      try {
        const result = await this.executeCommand(path, ['--version']);
        if (result.includes('Python 3')) {
          this.pythonPath = path;
          console.log(`✅ Python detected: ${path}`);
          return;
        }
      } catch {
        // Continue trying other paths
      }
    }

    console.warn('⚠️ Python 3 not found. Complex calculations will be limited.');
  }

  /**
   * Execute a shell command
   */
  private executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { shell: true });
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => { stdout += data; });
      process.stderr.on('data', (data) => { stderr += data; });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Execute Python code safely
   */
  async execute(params: PythonExecutionParams): Promise<CalculationResult> {
    const startTime = Date.now();
    const { code, variables = {}, timeout = this.timeout } = params;

    // Build the Python script with safety measures
    const safeScript = this.buildSafeScript(code, variables);

    return new Promise((resolve) => {
      const process = spawn(this.pythonPath, ['-c', safeScript], {
        shell: true,
        timeout
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => { stdout += data; });
      process.stderr.on('data', (data) => { stderr += data; });

      const timeoutHandle = setTimeout(() => {
        process.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Execution timeout exceeded',
          executionTime: Date.now() - startTime,
          method: 'python'
        });
      }, timeout);

      process.on('close', (code) => {
        clearTimeout(timeoutHandle);

        if (code === 0) {
          try {
            // Try to parse JSON result
            const result = JSON.parse(stdout.trim());
            resolve({
              success: true,
              result: result.result,
              formatted: String(result.result),
              executionTime: Date.now() - startTime,
              method: 'python',
              steps: result.steps
            });
          } catch {
            // Return raw output if not JSON
            resolve({
              success: true,
              result: stdout.trim(),
              formatted: stdout.trim(),
              executionTime: Date.now() - startTime,
              method: 'python'
            });
          }
        } else {
          resolve({
            success: false,
            error: stderr || 'Python execution failed',
            executionTime: Date.now() - startTime,
            method: 'python'
          });
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutHandle);
        resolve({
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          method: 'python'
        });
      });
    });
  }

  /**
   * Build a safe Python script with sandboxing
   */
  private buildSafeScript(code: string, variables: Record<string, any>): string {
    // Convert variables to Python format
    const varsString = Object.entries(variables)
      .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
      .join('\n');

    // Build the safe script
    return `
import json
import sys

# Disable dangerous modules
BLOCKED_MODULES = ['os', 'subprocess', 'shutil', 'socket', 'requests', 'urllib']
for mod in BLOCKED_MODULES:
    sys.modules[mod] = None

# Import allowed modules
try:
    import numpy as np
except ImportError:
    np = None

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    from scipy import stats, optimize
except ImportError:
    stats = None
    optimize = None

try:
    import numpy_financial as npf
except ImportError:
    npf = None

# Variables from context
${varsString}

# User code execution
steps = []
result = None

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    result = {"error": str(e)}

# Output as JSON
print(json.dumps({"result": result, "steps": steps}))
`;
  }

  /**
   * Calculate regression analysis
   */
  async calculateRegression(x: number[], y: number[]): Promise<CalculationResult> {
    const code = `
if np is not None and stats is not None:
    x_arr = np.array(${JSON.stringify(x)})
    y_arr = np.array(${JSON.stringify(y)})
    slope, intercept, r_value, p_value, std_err = stats.linregress(x_arr, y_arr)
    result = {
        "slope": float(slope),
        "intercept": float(intercept),
        "r_squared": float(r_value ** 2),
        "p_value": float(p_value),
        "std_error": float(std_err),
        "equation": f"y = {slope:.4f}x + {intercept:.4f}"
    }
    steps = [
        f"Slope: {slope:.4f}",
        f"Intercept: {intercept:.4f}",
        f"R-squared: {r_value ** 2:.4f}",
        f"P-value: {p_value:.6f}"
    ]
else:
    # Fallback calculation
    n = len(${JSON.stringify(x)})
    x_data = ${JSON.stringify(x)}
    y_data = ${JSON.stringify(y)}
    sum_x = sum(x_data)
    sum_y = sum(y_data)
    sum_xy = sum(x * y for x, y in zip(x_data, y_data))
    sum_x2 = sum(x ** 2 for x in x_data)

    slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
    intercept = (sum_y - slope * sum_x) / n

    result = {
        "slope": slope,
        "intercept": intercept,
        "equation": f"y = {slope:.4f}x + {intercept:.4f}"
    }
    steps = [f"Slope: {slope:.4f}", f"Intercept: {intercept:.4f}"]
`;

    return this.execute({ code });
  }

  /**
   * Calculate correlation matrix
   */
  async calculateCorrelation(data: number[][]): Promise<CalculationResult> {
    const code = `
if np is not None:
    data = np.array(${JSON.stringify(data)})
    corr_matrix = np.corrcoef(data)
    result = corr_matrix.tolist()
    steps = ["Correlation matrix calculated using numpy"]
else:
    result = {"error": "numpy not available"}
`;

    return this.execute({ code });
  }

  /**
   * Calculate matrix operations
   */
  async matrixOperation(
    a: number[][],
    b: number[][],
    operation: 'multiply' | 'add' | 'subtract' | 'inverse' | 'determinant'
  ): Promise<CalculationResult> {
    const ops: Record<string, string> = {
      multiply: 'np.matmul(a, b)',
      add: 'np.add(a, b)',
      subtract: 'np.subtract(a, b)',
      inverse: 'np.linalg.inv(a)',
      determinant: 'np.linalg.det(a)'
    };

    const code = `
if np is not None:
    a = np.array(${JSON.stringify(a)})
    ${b ? `b = np.array(${JSON.stringify(b)})` : ''}
    calc_result = ${ops[operation]}
    result = calc_result.tolist() if hasattr(calc_result, 'tolist') else float(calc_result)
    steps = ["Matrix ${operation} calculated using numpy"]
else:
    result = {"error": "numpy not available"}
`;

    return this.execute({ code });
  }

  /**
   * Calculate descriptive statistics
   */
  async calculateDescriptiveStats(values: number[]): Promise<CalculationResult> {
    const code = `
if np is not None and stats is not None:
    data = np.array(${JSON.stringify(values)})
    result = {
        "count": len(data),
        "mean": float(np.mean(data)),
        "median": float(np.median(data)),
        "std": float(np.std(data)),
        "var": float(np.var(data)),
        "min": float(np.min(data)),
        "max": float(np.max(data)),
        "range": float(np.max(data) - np.min(data)),
        "q1": float(np.percentile(data, 25)),
        "q3": float(np.percentile(data, 75)),
        "iqr": float(np.percentile(data, 75) - np.percentile(data, 25)),
        "skewness": float(stats.skew(data)),
        "kurtosis": float(stats.kurtosis(data))
    }
    steps = [
        f"Count: {result['count']}",
        f"Mean: {result['mean']:.4f}",
        f"Median: {result['median']:.4f}",
        f"Std Dev: {result['std']:.4f}"
    ]
else:
    # Fallback
    data = ${JSON.stringify(values)}
    n = len(data)
    mean = sum(data) / n
    sorted_data = sorted(data)
    median = sorted_data[n // 2] if n % 2 else (sorted_data[n // 2 - 1] + sorted_data[n // 2]) / 2
    variance = sum((x - mean) ** 2 for x in data) / n
    result = {
        "count": n,
        "mean": mean,
        "median": median,
        "std": variance ** 0.5,
        "var": variance,
        "min": min(data),
        "max": max(data)
    }
    steps = [f"Count: {n}", f"Mean: {mean:.4f}"]
`;

    return this.execute({ code });
  }

  /**
   * Calculate financial metrics using numpy-financial
   */
  async calculateFinancialNPF(
    func: 'npv' | 'irr' | 'pmt' | 'fv' | 'pv' | 'nper' | 'rate',
    params: Record<string, any>
  ): Promise<CalculationResult> {
    const funcMap: Record<string, string> = {
      npv: `npf.npv(${params.rate}, ${JSON.stringify(params.cashflows)})`,
      irr: `npf.irr(${JSON.stringify(params.cashflows)})`,
      pmt: `npf.pmt(${params.rate}, ${params.nper}, ${params.pv || 0}, ${params.fv || 0})`,
      fv: `npf.fv(${params.rate}, ${params.nper}, ${params.pmt || 0}, ${params.pv || 0})`,
      pv: `npf.pv(${params.rate}, ${params.nper}, ${params.pmt || 0}, ${params.fv || 0})`,
      nper: `npf.nper(${params.rate}, ${params.pmt}, ${params.pv}, ${params.fv || 0})`,
      rate: `npf.rate(${params.nper}, ${params.pmt}, ${params.pv}, ${params.fv || 0})`
    };

    const code = `
if npf is not None:
    result = float(${funcMap[func]})
    steps = ["Calculated using numpy-financial"]
else:
    result = {"error": "numpy-financial not available. Install with: pip install numpy-financial"}
`;

    return this.execute({ code });
  }

  /**
   * Solve optimization problem
   */
  async optimize(
    objective: string,
    constraints: string[],
    method: 'minimize' | 'maximize' = 'minimize'
  ): Promise<CalculationResult> {
    const code = `
if optimize is not None:
    from scipy.optimize import minimize as scipy_minimize

    # Define objective function
    def objective(x):
        return ${objective}

    # Initial guess
    x0 = [0] * 10  # Adjust based on problem

    # Optimize
    result_opt = scipy_minimize(objective, x0, method='SLSQP')

    result = {
        "success": result_opt.success,
        "x": result_opt.x.tolist(),
        "fun": float(result_opt.fun),
        "message": result_opt.message
    }
    steps = [f"Optimization {'succeeded' if result_opt.success else 'failed'}"]
else:
    result = {"error": "scipy.optimize not available"}
`;

    return this.execute({ code });
  }

  /**
   * Solve system of equations
   */
  async solveEquations(coefficients: number[][], constants: number[]): Promise<CalculationResult> {
    const code = `
if np is not None:
    A = np.array(${JSON.stringify(coefficients)})
    b = np.array(${JSON.stringify(constants)})

    try:
        solution = np.linalg.solve(A, b)
        result = solution.tolist()
        steps = [f"Solution: {result}"]
    except np.linalg.LinAlgError as e:
        result = {"error": f"Could not solve: {str(e)}"}
else:
    result = {"error": "numpy not available"}
`;

    return this.execute({ code });
  }

  /**
   * Check if Python is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand(this.pythonPath, ['--version']);
      return result.includes('Python 3');
    } catch {
      return false;
    }
  }

  /**
   * Get Python version and available libraries
   */
  async getCapabilities(): Promise<{
    pythonVersion: string | null;
    numpy: boolean;
    pandas: boolean;
    scipy: boolean;
    numpyFinancial: boolean;
  }> {
    const code = `
import sys
import json

capabilities = {
    "pythonVersion": sys.version.split()[0],
    "numpy": False,
    "pandas": False,
    "scipy": False,
    "numpyFinancial": False
}

try:
    import numpy
    capabilities["numpy"] = True
except ImportError:
    pass

try:
    import pandas
    capabilities["pandas"] = True
except ImportError:
    pass

try:
    import scipy
    capabilities["scipy"] = True
except ImportError:
    pass

try:
    import numpy_financial
    capabilities["numpyFinancial"] = True
except ImportError:
    pass

print(json.dumps(capabilities))
`;

    const result = await this.execute({ code });

    if (result.success && typeof result.result === 'object') {
      return result.result as any;
    }

    return {
      pythonVersion: null,
      numpy: false,
      pandas: false,
      scipy: false,
      numpyFinancial: false
    };
  }
}

export default new PythonEngineService();
