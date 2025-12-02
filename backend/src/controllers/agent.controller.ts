import { Request, Response } from 'express';
import { agentService, AgentGoal } from '../services/agent.service';
import { masterToolbox } from '../tools/master.toolbox';
import { detectLanguage, buildCulturalSystemPrompt } from '../services/languageDetection.service';

class AgentController {
  /**
   * Simple solve endpoint - solves a goal with automatic language detection
   * POST /api/agent/solve
   */
  async solve(req: Request, res: Response): Promise<void> {
    try {
      const { goal } = req.body;

      if (!goal || typeof goal !== 'string') {
        res.status(400).json({ error: 'Goal is required and must be a string.' });
        return;
      }

      console.log(`[AgentController] Solving goal: "${goal.substring(0, 100)}..."`);

      // Detect language and build cultural system prompt
      const detectedLanguage = detectLanguage(goal);
      const systemPrompt = await buildCulturalSystemPrompt(detectedLanguage);

      // Solve using the agent service
      const response = await agentService.solve(goal, systemPrompt);

      res.json({
        response,
        language: detectedLanguage,
      });
    } catch (error: any) {
      console.error('[AgentController] Solve error:', error);
      res.status(500).json({ error: 'An error occurred while solving the goal.' });
    }
  }
  /**
   * Execute an agent task with ReAct reasoning
   * POST /api/agent/execute
   */
  async execute(req: Request, res: Response): Promise<void> {
    try {
      const { task, context, maxSteps } = req.body;
      const userId = (req as any).user?.id;

      if (!task || typeof task !== 'string') {
        res.status(400).json({ error: 'Task is required and must be a string.' });
        return;
      }

      console.log(`[AgentController] Executing task for user ${userId}: "${task.substring(0, 100)}..."`);

      const goal: AgentGoal = {
        task,
        context,
        maxSteps: maxSteps || 10,
        userId,
      };

      const result = await agentService.executeTask(goal);

      res.json({
        success: result.success,
        goal: result.goal,
        plan: result.plan,
        finalAnswer: result.finalAnswer,
        executionHistory: result.executionHistory,
        toolsUsed: result.toolsUsed,
        totalSteps: result.totalSteps,
        totalTimeMs: result.totalTimeMs,
      });
    } catch (error: any) {
      console.error('[AgentController] Execute error:', error);
      res.status(500).json({ error: 'An error occurred while executing the agent task.' });
    }
  }

  /**
   * Execute an agent task with streaming updates (SSE)
   * POST /api/agent/execute/stream
   */
  async executeStream(req: Request, res: Response): Promise<void> {
    try {
      const { task, context, maxSteps } = req.body;
      const userId = (req as any).user?.id;

      if (!task || typeof task !== 'string') {
        res.status(400).json({ error: 'Task is required and must be a string.' });
        return;
      }

      console.log(`[AgentController] Streaming task for user ${userId}: "${task.substring(0, 100)}..."`);

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const goal: AgentGoal = {
        task,
        context,
        maxSteps: maxSteps || 10,
        userId,
      };

      // Stream callback for real-time updates
      const onStream = (event: {
        type: 'thought' | 'action' | 'observation' | 'plan' | 'answer' | 'error';
        content: string;
        step?: number;
      }) => {
        const eventData = JSON.stringify(event);
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${eventData}\n\n`);
      };

      // Execute the agent task
      const result = await agentService.executeTask(goal, onStream);

      // Send final result
      res.write(`event: complete\n`);
      res.write(
        `data: ${JSON.stringify({
          success: result.success,
          finalAnswer: result.finalAnswer,
          totalSteps: result.totalSteps,
          totalTimeMs: result.totalTimeMs,
          toolsUsed: result.toolsUsed,
        })}\n\n`
      );

      res.end();
    } catch (error: any) {
      console.error('[AgentController] Stream error:', error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * Execute a single tool call
   * POST /api/agent/tool
   */
  async executeTool(req: Request, res: Response): Promise<void> {
    try {
      const { tool, input } = req.body;

      if (!tool || typeof tool !== 'string') {
        res.status(400).json({ error: 'Tool name is required.' });
        return;
      }

      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: 'Tool input is required.' });
        return;
      }

      console.log(`[AgentController] Executing tool: ${tool}`);

      const result = await agentService.executeToolCall(tool, input);

      res.json({
        tool: result.tool,
        input: result.input,
        output: result.output,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
      });
    } catch (error: any) {
      console.error('[AgentController] Tool execution error:', error);
      res.status(500).json({ error: 'An error occurred while executing the tool.' });
    }
  }

  /**
   * Get list of available tools
   * GET /api/agent/tools
   */
  async getTools(req: Request, res: Response): Promise<void> {
    try {
      const tools = agentService.getAvailableTools();
      res.json({ tools });
    } catch (error: any) {
      console.error('[AgentController] Get tools error:', error);
      res.status(500).json({ error: 'An error occurred while fetching tools.' });
    }
  }

  /**
   * Check if a query should use the agent
   * POST /api/agent/should-use
   */
  async shouldUseAgent(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required.' });
        return;
      }

      const shouldUse = await agentService.shouldUseAgent(query);

      res.json({ shouldUseAgent: shouldUse, query });
    } catch (error: any) {
      console.error('[AgentController] Should use agent error:', error);
      res.status(500).json({ error: 'An error occurred while analyzing the query.' });
    }
  }
}

export const agentController = new AgentController();
