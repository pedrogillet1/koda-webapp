/**
 * Context Budgeter Service
 * Manages token allocation across different parts of the prompt
 * Prevents token limit overruns and optimizes context usage
 */

interface TokenBudget {
  total: number;
  instructions: number;
  conversationHistory: number;
  retrievedChunks: number;
  reserved: number;
}

interface BudgetAllocation {
  instructions: {
    content: string;
    tokens: number;
    truncated: boolean;
  };
  conversationHistory: {
    turns: any[];
    tokens: number;
    droppedTurns: number;
  };
  retrievedChunks: {
    chunks: any[];
    tokens: number;
    droppedChunks: number;
  };
  totalTokens: number;
  budgetUtilization: number;
}

class ContextBudgeterService {
  /**
   * Count tokens (rough estimate: ~4 characters per token)
   */
  countTokens(text: string): number {
    // Rough approximation for token counting
    // For exact counting, use tiktoken library
    return Math.ceil(text.length / 4);
  }

  /**
   * Allocate context budget
   *
   * Default allocation:
   * - Instructions: 20% (system prompt, formatting rules)
   * - Conversation history: 20% (recent turns)
   * - Retrieved chunks: 60% (document context)
   */
  allocateBudget(
    totalBudget: number,
    allocation: { instructions: number; history: number; chunks: number } = {
      instructions: 0.2,
      history: 0.2,
      chunks: 0.6
    }
  ): TokenBudget {
    const reserved = Math.floor(totalBudget * 0.05); // 5% safety margin

    return {
      total: totalBudget,
      instructions: Math.floor((totalBudget - reserved) * allocation.instructions),
      conversationHistory: Math.floor((totalBudget - reserved) * allocation.history),
      retrievedChunks: Math.floor((totalBudget - reserved) * allocation.chunks),
      reserved
    };
  }

  /**
   * Build prompt within budget
   * Intelligently truncates content to fit within token budget
   */
  async buildPromptWithinBudget(
    systemInstructions: string,
    conversationHistory: any[],
    retrievedChunks: any[],
    currentQuery: string,
    modelMaxTokens: number = 1000000, // Gemini 2.0 Flash
    reserveForResponse: number = 8000
  ): Promise<BudgetAllocation> {
    console.log(`📊 Context budgeting:`);
    console.log(`   Model max: ${modelMaxTokens.toLocaleString()} tokens`);
    console.log(`   Reserve for response: ${reserveForResponse.toLocaleString()} tokens`);

    // Calculate available budget
    const availableBudget = modelMaxTokens - reserveForResponse - this.countTokens(currentQuery);

    console.log(`   Available budget: ${availableBudget.toLocaleString()} tokens`);

    // Allocate budget
    const budget = this.allocateBudget(availableBudget);

    console.log(`   Allocation:`);
    console.log(`     - Instructions: ${budget.instructions.toLocaleString()} tokens (${((budget.instructions / availableBudget) * 100).toFixed(1)}%)`);
    console.log(`     - History: ${budget.conversationHistory.toLocaleString()} tokens (${((budget.conversationHistory / availableBudget) * 100).toFixed(1)}%)`);
    console.log(`     - Chunks: ${budget.retrievedChunks.toLocaleString()} tokens (${((budget.retrievedChunks / availableBudget) * 100).toFixed(1)}%)`);

    // Fit instructions
    const instructions = this.fitInstructions(systemInstructions, budget.instructions);

    // Fit conversation history (keep most recent)
    const history = this.fitConversationHistory(conversationHistory, budget.conversationHistory);

    // Fit retrieved chunks (keep highest priority)
    const chunks = this.fitRetrievedChunks(retrievedChunks, budget.retrievedChunks);

    // Calculate total tokens
    const totalTokens = instructions.tokens + history.tokens + chunks.tokens;

    console.log(`   Result:`);
    console.log(`     - Total used: ${totalTokens.toLocaleString()} tokens`);
    console.log(`     - Utilization: ${((totalTokens / availableBudget) * 100).toFixed(1)}%`);
    if (history.droppedTurns > 0) {
      console.log(`     ⚠️ Dropped ${history.droppedTurns} conversation turn(s)`);
    }
    if (chunks.droppedChunks > 0) {
      console.log(`     ⚠️ Dropped ${chunks.droppedChunks} document chunk(s)`);
    }

    return {
      instructions,
      conversationHistory: history,
      retrievedChunks: chunks,
      totalTokens,
      budgetUtilization: (totalTokens / availableBudget) * 100
    };
  }

  /**
   * Fit instructions within budget
   * Instructions are highest priority - truncate only if absolutely necessary
   */
  private fitInstructions(
    instructions: string,
    budget: number
  ): { content: string; tokens: number; truncated: boolean } {
    const tokens = this.countTokens(instructions);

    if (tokens <= budget) {
      return { content: instructions, tokens, truncated: false };
    }

    // Truncate instructions (rare, but possible)
    console.warn(`⚠️ Instructions exceed budget (${tokens} > ${budget}), truncating`);
    const truncated = this.truncateToTokens(instructions, budget);

    return {
      content: truncated,
      tokens: this.countTokens(truncated),
      truncated: true
    };
  }

  /**
   * Fit conversation history within budget
   * Keep most recent turns, drop oldest first
   */
  private fitConversationHistory(
    history: any[],
    budget: number
  ): { turns: any[]; tokens: number; droppedTurns: number } {
    if (!history || history.length === 0) {
      return { turns: [], tokens: 0, droppedTurns: 0 };
    }

    const fittedTurns: any[] = [];
    let currentTokens = 0;
    let droppedTurns = 0;

    // Iterate from most recent to oldest
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      const turnText = `User: ${turn.query}\nAssistant: ${turn.response}`;
      const turnTokens = this.countTokens(turnText);

      if (currentTokens + turnTokens <= budget) {
        fittedTurns.unshift(turn); // Add to beginning
        currentTokens += turnTokens;
      } else {
        droppedTurns++;
      }
    }

    return {
      turns: fittedTurns,
      tokens: currentTokens,
      droppedTurns
    };
  }

  /**
   * Fit retrieved chunks within budget
   * Keep highest-priority chunks (by retrieval score)
   */
  private fitRetrievedChunks(
    chunks: any[],
    budget: number
  ): { chunks: any[]; tokens: number; droppedChunks: number } {
    if (!chunks || chunks.length === 0) {
      return { chunks: [], tokens: 0, droppedChunks: 0 };
    }

    // Sort by priority (retrieval score)
    const sortedChunks = [...chunks].sort((a, b) => {
      const scoreA = a.rerankScore || a.fusedScore || a.score || 0;
      const scoreB = b.rerankScore || b.fusedScore || b.score || 0;
      return scoreB - scoreA;
    });

    const fittedChunks: any[] = [];
    let currentTokens = 0;
    let droppedChunks = 0;

    for (const chunk of sortedChunks) {
      const chunkText = chunk.content || chunk.text || '';
      const chunkTokens = this.countTokens(chunkText);

      if (currentTokens + chunkTokens <= budget) {
        fittedChunks.push(chunk);
        currentTokens += chunkTokens;
      } else {
        droppedChunks++;
      }
    }

    return {
      chunks: fittedChunks,
      tokens: currentTokens,
      droppedChunks
    };
  }

  /**
   * Truncate text to fit within token budget
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const estimatedChars = maxTokens * 4;

    if (text.length <= estimatedChars) {
      return text;
    }

    // Truncate and add ellipsis
    return text.substring(0, estimatedChars) + '...';
  }

  /**
   * Dynamic budget adjustment based on query complexity
   */
  adjustBudgetForComplexity(
    baseBudget: TokenBudget,
    queryComplexity: 'simple' | 'moderate' | 'complex'
  ): TokenBudget {
    switch (queryComplexity) {
      case 'simple':
        // Simple queries need less context, more for instructions
        return {
          ...baseBudget,
          instructions: Math.floor(baseBudget.total * 0.25),
          conversationHistory: Math.floor(baseBudget.total * 0.15),
          retrievedChunks: Math.floor(baseBudget.total * 0.55)
        };

      case 'complex':
        // Complex queries need more context
        return {
          ...baseBudget,
          instructions: Math.floor(baseBudget.total * 0.15),
          conversationHistory: Math.floor(baseBudget.total * 0.25),
          retrievedChunks: Math.floor(baseBudget.total * 0.55)
        };

      default:
        return baseBudget;
    }
  }

  /**
   * Generate budget report for analytics
   */
  generateBudgetReport(allocation: BudgetAllocation): string {
    return `
Context Budget Report:
═══════════════════════════════════════
Total Tokens Used: ${allocation.totalTokens.toLocaleString()}
Budget Utilization: ${allocation.budgetUtilization.toFixed(1)}%

Breakdown:
  Instructions: ${allocation.instructions.tokens.toLocaleString()} tokens
  History: ${allocation.conversationHistory.tokens.toLocaleString()} tokens (${allocation.conversationHistory.turns.length} turns)
  Chunks: ${allocation.retrievedChunks.tokens.toLocaleString()} tokens (${allocation.retrievedChunks.chunks.length} chunks)

Dropped Content:
  History turns: ${allocation.conversationHistory.droppedTurns}
  Document chunks: ${allocation.retrievedChunks.droppedChunks}

Status: ${allocation.budgetUtilization > 90 ? '⚠️ High utilization' : '✅ Normal'}
═══════════════════════════════════════
    `.trim();
  }
}

export default new ContextBudgeterService();
export { ContextBudgeterService, TokenBudget, BudgetAllocation };
