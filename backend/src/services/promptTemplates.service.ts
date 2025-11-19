/**
 * Prompt Templates Service
 * Provides structured reasoning prompts based on query complexity
 */

export type QueryComplexity = 'simple' | 'medium' | 'complex';

export interface PromptTemplate {
  complexity: QueryComplexity;
  instructions: string;
  reasoningSteps: string;
  outputFormat: string;
}

/**
 * Get reasoning prompt based on query complexity
 */
export function getReasoningPrompt(
  complexity: QueryComplexity,
  query: string,
  documentContext: string,
  conversationHistory: string = '',
  documentLocations: string = '',
  memoryContext: string = ''
): string {
  const template = PROMPT_TEMPLATES[complexity];

  return `${template.instructions}

${template.reasoningSteps}

${template.outputFormat}

${memoryContext ? `${memoryContext}\n` : ''}${conversationHistory ? `**Conversation Context**:\n${conversationHistory}\n\n` : ''}${documentLocations ? `**Document Locations** (for navigation questions):\n${documentLocations}\n\n**Important**: When users ask WHERE a document is located, refer to the folder path above.\n\n` : ''}**Document Context**:
${documentContext}

**User Query**: ${query}

**Your Response**:`;
}

/**
 * Prompt templates for different complexity levels
 */
const PROMPT_TEMPLATES: Record<QueryComplexity, PromptTemplate> = {
  simple: {
    complexity: 'simple',
    instructions: `You are KODA, a professional document AI assistant. The user has asked a simple, direct question that requires a factual answer from their documents.`,
    reasoningSteps: `**Reasoning Approach**:
1. Locate the specific information requested in the document context
2. Extract the exact answer
3. Provide a direct, concise response (1-2 sentences)

**Important**:
- Do NOT over-explain for simple questions
- Do NOT add unnecessary context
- Answer directly and move on`,
    outputFormat: `**Output Format**:
- Direct answer in 1-2 sentences
- Bold key information with **text**
- End with a natural closing sentence (NOT "Next step:")
- NO bullet points for simple questions
- NO citations or page references in your text`
  },

  medium: {
    complexity: 'medium',
    instructions: `You are KODA, a professional document AI assistant. The user has asked a question that requires analysis and structured explanation from their documents.`,
    reasoningSteps: `**Reasoning Approach**:
1. Identify all relevant information across the document context
2. Organize information into logical categories or themes
3. Analyze relationships between concepts
4. Structure your answer with clear sections

**Important**:
- Provide structured, organized information
- Use bullet points to break down complex information (3-5 bullets)
- Connect related concepts
- Explain HOW things relate, not just WHAT they are`,
    outputFormat: `**Output Format**:
- Opening paragraph (1-2 sentences) summarizing the answer
- ONE blank line
- Transition sentence ("The document covers several key areas:")
- Bullet list with NO blank lines between bullets (3-5 bullets)
- ONE blank line after last bullet
- Natural closing sentence that flows from your answer
- Bold key information with **text**
- NO citations or page references in your text`
  },

  complex: {
    complexity: 'complex',
    instructions: `You are KODA, a professional document AI assistant. The user has asked a complex question that requires multi-document synthesis, comparison, or deep analysis.`,
    reasoningSteps: `**Multi-Step Reasoning Process**:

**Step 1: Information Gathering**
- Identify ALL relevant information across multiple documents
- Note which documents contain which information
- Pay attention to dates, versions, and context

**Step 2: Synthesis & Analysis**
- Compare information across documents
- Identify patterns, trends, or relationships
- Note any contradictions or conflicts (CRITICAL: Alert user if found)
- Determine which information is most reliable/recent

**Step 3: Integration**
- Synthesize findings into a coherent narrative
- Explain causal relationships (X leads to Y because...)
- Connect concepts across documents
- Provide deeper insights beyond surface facts

**Step 4: Quality Check**
- Ensure answer addresses all parts of the query
- Verify no contradictions in your response
- Confirm sufficient evidence for claims

**Important**:
- This is a COMPLEX query - provide comprehensive analysis
- Synthesize across multiple sources
- Explain WHY things matter, not just WHAT they are
- If documents conflict, explicitly state: "⚠️ Your documents contain conflicting information about X. Document A says Y, but Document B says Z."`,
    outputFormat: `**Output Format**:
- Comprehensive opening paragraph (2-3 sentences) providing overview
- ONE blank line
- Transition sentence introducing structure
- Well-organized sections with bullet points (5-8 bullets for complex topics)
- Use sub-bullets for detailed breakdowns when needed
- ONE blank line between major sections
- Synthesis paragraph connecting all information
- Natural closing sentence with implications or recommendations
- Bold key information with **text**
- NO citations or page references in your text
- If contradictions found, include ⚠️ warning section`
  }
};

/**
 * Detect query complexity based on keywords and structure
 */
export function detectQueryComplexity(query: string): QueryComplexity {
  const lowerQuery = query.toLowerCase();

  // Simple query indicators
  const simpleIndicators = [
    'what is', 'who is', 'when did', 'when was', 'where is', 'where did',
    'show me', 'find', 'display', 'get', 'retrieve',
    'tell me about', 'what does', 'how much', 'how many'
  ];

  // Complex query indicators
  const complexIndicators = [
    'compare', 'contrast', 'analyze', 'synthesize', 'evaluate',
    'all documents', 'across all', 'every document', 'between documents',
    'contradiction', 'conflict', 'disagree', 'differ',
    'relationship between', 'how do', 'why do', 'why does',
    'timeline', 'changes over time', 'evolution', 'trend', 'pattern',
    'explain the difference', 'explain how', 'explain why',
    'summarize all', 'overview of all', 'comprehensive',
    'implications', 'impact of', 'effect of'
  ];

  // Medium query indicators
  const mediumIndicators = [
    'explain', 'describe', 'summarize', 'outline',
    'what are the', 'list all', 'show all',
    'how to', 'steps to', 'process for',
    'key points', 'main ideas', 'important'
  ];

  // Check for complex patterns first
  const hasComplexIndicator = complexIndicators.some(indicator =>
    lowerQuery.includes(indicator)
  );

  const hasMultiDocReference = /\b(all|every|each|multiple|several|various)\s+(document|file|paper)/i.test(query);
  const hasComparison = /\b(versus|vs\.?|compared to|difference between|similar|different)\b/i.test(query);

  if (hasComplexIndicator || hasMultiDocReference || hasComparison) {
    return 'complex';
  }

  // Check for simple patterns
  const hasSimpleIndicator = simpleIndicators.some(indicator =>
    lowerQuery.startsWith(indicator) || lowerQuery.includes(` ${indicator}`)
  );

  const wordCount = query.split(/\s+/).length;
  if (hasSimpleIndicator && wordCount < 8) {
    return 'simple';
  }

  // Check for medium patterns
  const hasMediumIndicator = mediumIndicators.some(indicator =>
    lowerQuery.includes(indicator)
  );

  if (hasMediumIndicator) {
    return 'medium';
  }

  return 'medium';
}

/**
 * Build conversation context string from history
 */
export function buildConversationContext(
  conversationHistory: Array<{ role: string; content: string }>
): string {
  if (!conversationHistory || conversationHistory.length === 0) {
    return '';
  }

  const recentHistory = conversationHistory.slice(-5);

  let context = '';
  recentHistory.forEach((msg) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = msg.content.length > 500
      ? msg.content.substring(0, 500) + '...'
      : msg.content;
    context += `${role}: ${content}\n\n`;
  });

  return context;
}
