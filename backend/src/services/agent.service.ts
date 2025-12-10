import { llmProvider } from './llm.provider';
import { masterToolbox, ToolResult } from '../tools/master.toolbox';

// Types for agent execution
export interface AgentGoal {
  task: string;
  context?: string;
  maxSteps?: number;
  userId?: string;
}

export interface AgentStep {
  stepNumber: number;
  thought: string;
  action?: {
    tool: string;
    input: string;
  };
  observation?: string;
  isComplete: boolean;
}

export interface AgentPlan {
  goal: string;
  steps: string[];
  currentStep: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

export interface AgentExecutionResult {
  goal: string;
  plan: AgentPlan;
  executionHistory: AgentStep[];
  finalAnswer: string;
  success: boolean;
  totalSteps: number;
  totalTimeMs: number;
  toolsUsed: string[];
}

// Streaming callback for real-time updates
export type AgentStreamCallback = (event: {
  type: 'thought' | 'action' | 'observation' | 'plan' | 'answer' | 'error';
  content: string;
  step?: number;
}) => void;

class AgentService {
  private readonly defaultMaxSteps = 10;
  private readonly defaultModel = 'gemini-2.5-flash';

  /**
   * Simple solve method - compatible with basic ReAct loop interface
   * @param goal - The goal/question to solve
   * @param systemPrompt - System prompt for the agent
   * @returns The final answer string
   */
  async solve(goal: string, systemPrompt: string): Promise<string> {
    const result = await this.executeTask({
      task: goal,
      context: systemPrompt,
    });
    return result.finalAnswer;
  }

  /**
   * Main entry point: Execute an agent task with ReAct reasoning
   */
  async executeTask(
    goal: AgentGoal,
    onStream?: AgentStreamCallback
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const maxSteps = goal.maxSteps || this.defaultMaxSteps;

    console.log(`[AgentService] Starting task: "${goal.task.substring(0, 100)}..."`);

    // Initialize execution state
    const executionHistory: AgentStep[] = [];
    const toolsUsed = new Set<string>();
    let isComplete = false;
    let finalAnswer = '';

    // Step 1: Create a plan
    const plan = await this.createPlan(goal, onStream);
    console.log(`[AgentService] Plan created with ${plan.steps.length} steps`);

    // Step 2: Execute the ReAct loop
    for (let stepNum = 1; stepNum <= maxSteps && !isComplete; stepNum++) {
      console.log(`[AgentService] Executing step ${stepNum}/${maxSteps}`);

      const step = await this.executeReActStep(
        goal,
        plan,
        executionHistory,
        stepNum,
        onStream
      );

      executionHistory.push(step);

      // Track tool usage
      if (step.action?.tool) {
        toolsUsed.add(step.action.tool);
      }

      isComplete = step.isComplete;

      if (isComplete) {
        finalAnswer = step.thought;
      }
    }

    // If we hit max steps without completing, generate a final answer
    if (!isComplete) {
      console.log('[AgentService] Max steps reached, generating final answer');
      finalAnswer = await this.generateFinalAnswer(goal, executionHistory, plan, onStream);
    }

    const totalTimeMs = Date.now() - startTime;
    console.log(`[AgentService] Task completed in ${totalTimeMs}ms with ${executionHistory.length} steps`);

    return {
      goal: goal.task,
      plan,
      executionHistory,
      finalAnswer,
      success: isComplete || executionHistory.length > 0,
      totalSteps: executionHistory.length,
      totalTimeMs,
      toolsUsed: Array.from(toolsUsed),
    };
  }

  /**
   * Create an execution plan for the goal
   */
  private async createPlan(
    goal: AgentGoal,
    onStream?: AgentStreamCallback
  ): Promise<AgentPlan> {
    const planPrompt = `You are a planning assistant. Your task is to create a step-by-step plan to achieve the following goal.

GOAL: ${goal.task}
${goal.context ? `CONTEXT: ${goal.context}` : ''}

AVAILABLE TOOLS:
${masterToolbox.getToolDescriptions()}

Create a clear, numbered plan with 2-5 steps. Each step should be actionable and specific.
Consider which tools might be needed for each step.

Respond in this exact format:
PLAN:
1. [First step description]
2. [Second step description]
3. [Third step description]
...

Only output the plan, nothing else.`;

    try {
      const response = await llmProvider.createChatCompletion({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: 'You are a helpful planning assistant.' },
          { role: 'user', content: planPrompt },
        ],
        temperature: 0.3,
      });

      const planText = response.choices[0]?.message?.content || '';

      // Parse the plan
      const steps = this.parsePlanSteps(planText);

      const plan: AgentPlan = {
        goal: goal.task,
        steps,
        currentStep: 0,
        status: 'planning',
      };

      if (onStream) {
        onStream({
          type: 'plan',
          content: JSON.stringify(plan, null, 2),
        });
      }

      return plan;
    } catch (error: any) {
      console.error('[AgentService] Plan creation failed:', error.message);
      // Return a simple default plan
      return {
        goal: goal.task,
        steps: ['Analyze the request', 'Execute necessary actions', 'Provide the answer'],
        currentStep: 0,
        status: 'planning',
      };
    }
  }

  /**
   * Parse plan text into steps array
   */
  private parsePlanSteps(planText: string): string[] {
    const lines = planText.split('\n');
    const steps: string[] = [];

    for (const line of lines) {
      // Match lines starting with numbers (e.g., "1.", "1)", "1:")
      const match = line.match(/^\d+[\.\)\:]?\s*(.+)/);
      if (match && match[1]) {
        steps.push(match[1].trim());
      }
    }

    // If no steps parsed, use the whole text as one step
    if (steps.length === 0 && planText.trim()) {
      steps.push(planText.trim());
    }

    return steps;
  }

  /**
   * Execute a single ReAct step (Thought -> Action -> Observation)
   */
  private async executeReActStep(
    goal: AgentGoal,
    plan: AgentPlan,
    history: AgentStep[],
    stepNumber: number,
    onStream?: AgentStreamCallback
  ): Promise<AgentStep> {
    // Build the ReAct prompt
    const reactPrompt = this.buildReActPrompt(goal, plan, history, stepNumber);

    try {
      // Get the LLM's thought and action
      const response = await llmProvider.createChatCompletion({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: this.getReActSystemPrompt() },
          { role: 'user', content: reactPrompt },
        ],
        temperature: 0.5,
      });

      const llmOutput = response.choices[0]?.message?.content || '';

      // Parse the ReAct response
      const { thought, action, isComplete } = this.parseReActResponse(llmOutput);

      // Stream the thought
      if (onStream) {
        onStream({ type: 'thought', content: thought, step: stepNumber });
      }

      // If no action needed (task complete), return
      if (isComplete || !action) {
        return {
          stepNumber,
          thought,
          isComplete: true,
        };
      }

      // Stream the action
      if (onStream) {
        onStream({
          type: 'action',
          content: `Using tool: ${action.tool} with input: ${action.input}`,
          step: stepNumber,
        });
      }

      // Execute the tool
      const toolResult = await masterToolbox.executeTool(action.tool, action.input);

      // Stream the observation
      if (onStream) {
        onStream({ type: 'observation', content: toolResult.output, step: stepNumber });
      }

      // Update plan progress
      plan.currentStep = stepNumber;
      plan.status = 'executing';

      return {
        stepNumber,
        thought,
        action,
        observation: toolResult.output,
        isComplete: false,
      };
    } catch (error: any) {
      console.error(`[AgentService] Step ${stepNumber} failed:`, error.message);

      if (onStream) {
        onStream({ type: 'error', content: error.message, step: stepNumber });
      }

      return {
        stepNumber,
        thought: `Error occurred: ${error.message}`,
        isComplete: false,
      };
    }
  }

  /**
   * Get the system prompt for ReAct reasoning
   */
  private getReActSystemPrompt(): string {
    return `You are an intelligent agent that solves problems step-by-step using the ReAct framework (Reason + Act).

For each step, you will:
1. THINK: Analyze what needs to be done next
2. ACT: Use a tool if needed, OR provide your FINAL ANSWER if the task is complete

AVAILABLE TOOLS:
${masterToolbox.getToolDescriptions()}

RESPONSE FORMAT:
Always respond in this exact format:

THOUGHT: [Your reasoning about what to do next]

Then EITHER:

ACTION:
<tool>[tool_name]</tool>
<input>[your input to the tool]</input>

OR (if the task is complete):

FINAL ANSWER: [Your complete answer to the user's goal]

IMPORTANT RULES:
- Only use ONE tool per step
- Be specific with tool inputs
- If you have enough information to answer, provide the FINAL ANSWER
- Never make up information - use tools to gather facts
- Think step by step and be thorough`;
  }

  /**
   * Build the ReAct prompt with history
   */
  private buildReActPrompt(
    goal: AgentGoal,
    plan: AgentPlan,
    history: AgentStep[],
    stepNumber: number
  ): string {
    let prompt = `GOAL: ${goal.task}
${goal.context ? `CONTEXT: ${goal.context}\n` : ''}
PLAN:
${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

`;

    if (history.length > 0) {
      prompt += 'PREVIOUS STEPS:\n';
      for (const step of history) {
        prompt += `\n--- Step ${step.stepNumber} ---\n`;
        prompt += `THOUGHT: ${step.thought}\n`;
        if (step.action) {
          prompt += `ACTION: Used ${step.action.tool} with input: ${step.action.input}\n`;
        }
        if (step.observation) {
          prompt += `OBSERVATION: ${step.observation}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `Now execute step ${stepNumber}. Think about what you need to do next based on the plan and any previous observations.`;

    return prompt;
  }

  /**
   * Parse the LLM's ReAct response
   */
  private parseReActResponse(response: string): {
    thought: string;
    action?: { tool: string; input: string };
    isComplete: boolean;
  } {
    // Check for FINAL ANSWER
    const finalAnswerMatch = response.match(/FINAL\s*ANSWER:\s*([\s\S]*?)$/i);
    if (finalAnswerMatch) {
      return {
        thought: finalAnswerMatch[1].trim(),
        isComplete: true,
      };
    }

    // Extract thought
    const thoughtMatch = response.match(/THOUGHT:\s*([\s\S]*?)(?=(?:ACTION:|FINAL\s*ANSWER:|$))/i);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : response.trim();

    // Extract action
    const toolMatch = response.match(/<tool>\s*(\w+)\s*<\/tool>/i);
    const inputMatch = response.match(/<input>\s*([\s\S]*?)\s*<\/input>/i);

    if (toolMatch && inputMatch) {
      return {
        thought,
        action: {
          tool: toolMatch[1].trim(),
          input: inputMatch[1].trim(),
        },
        isComplete: false,
      };
    }

    // Alternative action format: ACTION: tool_name("input")
    const altActionMatch = response.match(/ACTION:\s*(\w+)\s*\(\s*["']?([\s\S]*?)["']?\s*\)/i);
    if (altActionMatch) {
      return {
        thought,
        action: {
          tool: altActionMatch[1].trim(),
          input: altActionMatch[2].trim(),
        },
        isComplete: false,
      };
    }

    // No action found - might be complete
    return {
      thought,
      isComplete: thought.length > 100, // Assume complete if there's a substantial answer
    };
  }

  /**
   * Generate a final answer when max steps reached
   */
  private async generateFinalAnswer(
    goal: AgentGoal,
    history: AgentStep[],
    plan: AgentPlan,
    onStream?: AgentStreamCallback
  ): Promise<string> {
    const summaryPrompt = `Based on the following execution history, provide a comprehensive final answer to the user's goal.

GOAL: ${goal.task}

EXECUTION HISTORY:
${history
  .map(
    (step) => `
Step ${step.stepNumber}:
- Thought: ${step.thought}
${step.action ? `- Action: ${step.action.tool}(${step.action.input})` : ''}
${step.observation ? `- Observation: ${step.observation}` : ''}`
  )
  .join('\n')}

Synthesize all the information gathered and provide a clear, helpful answer. If you couldn't fully complete the task, explain what was accomplished and what remains.`;

    try {
      const response = await llmProvider.createChatCompletion({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that synthesizes information and provides clear answers.',
          },
          { role: 'user', content: summaryPrompt },
        ],
        temperature: 0.5,
      });

      const answer = response.choices[0]?.message?.content || 'Unable to generate final answer.';

      if (onStream) {
        onStream({ type: 'answer', content: answer });
      }

      return answer;
    } catch (error: any) {
      console.error('[AgentService] Final answer generation failed:', error.message);
      return `Task partially completed. ${history.length} steps were executed but a final synthesis could not be generated.`;
    }
  }

  /**
   * Execute a simple single-step tool call (for quick actions)
   */
  async executeToolCall(
    toolName: string,
    input: string
  ): Promise<ToolResult> {
    return masterToolbox.executeTool(toolName, input);
  }

  /**
   * Get available tools list
   */
  getAvailableTools(): { name: string; description: string }[] {
    return masterToolbox.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  /**
   * Detect if a query requires agent-based problem solving
   */
  async shouldUseAgent(query: string): Promise<boolean> {
    // Keywords that suggest multi-step reasoning is needed
    const agentKeywords = [
      'analyze',
      'compare',
      'research',
      'investigate',
      'find out',
      'calculate',
      'solve',
      'figure out',
      'help me understand',
      'what is the current',
      'latest',
      'up to date',
      'step by step',
      'how to',
      'why does',
      'explain how',
    ];

    const lowerQuery = query.toLowerCase();

    // Check for agent keywords
    const hasAgentKeyword = agentKeywords.some((keyword) =>
      lowerQuery.includes(keyword)
    );

    // Check for mathematical expressions
    const hasMathExpression = /[\d+\-*/()^%]/.test(query) && /\d/.test(query);

    // Check for questions that might need current data
    const needsCurrentData =
      lowerQuery.includes('today') ||
      lowerQuery.includes('now') ||
      lowerQuery.includes('current') ||
      lowerQuery.includes('latest') ||
      lowerQuery.includes('2024') ||
      lowerQuery.includes('2025');

    return hasAgentKeyword || hasMathExpression || needsCurrentData;
  }
}

export const agentService = new AgentService();
