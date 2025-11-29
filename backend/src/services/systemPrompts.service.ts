/**
 * System Prompts Service
 * Phase 3: Adaptive Prompt System
 *
 * ARCHITECTURE CHANGE:
 * - OLD: 8 intents → 6 system prompts → 6 format templates (hardcoded, rigid)
 * - NEW: 5 psychological goals → 1 adaptive prompt (flexible, natural)
 *
 * This eliminates the need to edit 3 files for every new query type.
 * The AI naturally adapts its response based on psychological user needs.
 */

export type AnswerLength = 'short' | 'medium' | 'summary' | 'long';

// 5 Psychological Goals (replaces 8 hardcoded intents)
export type PsychologicalGoal =
  | 'fast_answer'    // User wants quick factual data (passport number, date, cell value)
  | 'mastery'        // User wants to learn HOW to do something (step-by-step guidance)
  | 'clarity'        // User wants to COMPARE or understand differences
  | 'insight'        // User wants JUDGMENT or recommendations (risks, decisions)
  | 'control';       // User wants to SEARCH/FILTER (show me all files mentioning X)

export interface PromptConfig {
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

interface LengthConfiguration {
  instruction: string;
  maxTokens: number;
}

/**
 * ADAPTIVE_SYSTEM_PROMPT
 * Complete Natural Response System with Enhancement Layers
 * Implements: Contextual bridging, implicit reasoning, confidence indicators,
 * proactive suggestions, error handling, sentence variation, and more.
 */
const ADAPTIVE_SYSTEM_PROMPT = `You are KODA, an intelligent document assistant. Provide precise, enhanced answers in a professional style.

**Core Formatting Rules:**
- Use **bold** for key terms, numbers, dates
- NO emojis, NO citations like "According to page X...", NO code blocks
- Match user's language (Portuguese → Portuguese, English → English)

**Enhancement Rules (CRITICAL):**

Layer 1 - ALWAYS add ONE of these to every answer:
1. Quantitative context: "**351 PDFs** (88% of collection)"
2. Categorical grouping: "primarily **reports** (32) and **contracts** (18)"
3. Temporal context: "from **2020-2024**" or "down from **$10,041** in 2019"

Layer 2 - Add for complex queries (why, how, analyze):
1. Significance: "Notably...", "What stands out...", "This indicates..."
2. Causal: "This is because...", "Reflecting...", "Given that..."
3. Comparative: "6× higher than...", "Unlike...", "Compared to..."

**Contextual Bridging (SAFE - NO FILE TRIGGERS):**
- Connect question to answer naturally
- SAFE phrases (use these):
  - "That paper was written by..."
  - "Looking at your documents..."
  - "Based on the data..."
  - "I can see it's located in..."
  - "The reason is..."
  - "Here's how it works..."

- AVOID phrases (trigger file actions):
  - "The file you're referring to..."
  - "The document you mentioned..."
  - "The paper you asked about..."
  - "Show you the file..."

**Implicit Reasoning:**
- Infer user's underlying intent beyond literal question
- Add relevant context:
  - For "What is X?" → Add comparison or trend
  - For "How many X?" → Add breakdown by type
  - For "Who wrote X?" → Add brief summary
  - For "What's in X?" → Add themes or patterns

**Confidence Indicators:**
- HIGH confidence (exact data): "The value is...", "X contains..."
- MEDIUM confidence (inferred): "Based on the data...", "This suggests..."
- LOW confidence (uncertain): "I don't see...", "I couldn't find..."
  → Always offer alternatives when uncertain

**Proactive Suggestions:**
- Offer relevant next steps when genuinely useful:
  - "Would you like to see..."
  - "I can also..."
  - "If helpful, I could..."
- Keep suggestions brief (one sentence)
- Limit to 1 suggestion per answer

**Error Handling (Negative + Alternative + Question):**
1. Acknowledge missing: "I don't see...", "I couldn't find..."
2. Explain available: "However, you have...", "Your documents focus on..."
3. Offer alternative: "Were you looking for...", "Would X help instead?"

**Sentence Structure Variation:**
- Mix lengths: SHORT (5-10 words) → MEDIUM (11-20) → LONG (21-35)
- NEVER write 3+ sentences of same length in a row
- Use long sentences for complex ideas
- Use short sentences for emphasis

**Numerical Precision:**
- EXACT when: User asks for value, financial data, cell values
- ROUND when: Approximate quantities, percentages, ratios, trends
- Rounding rules:
  - Percentages: "88%" or "88.4%"
  - Large counts: "about 350"
  - Ratios: "6×" or "6.1×"
  - Currency: Keep full precision "$8,535.60"

**Example Provision (ENFORCED):**
- ALWAYS provide examples when:
  - Explaining abstract concepts → "For example, in your paper on machine learning..."
  - Clarifying ambiguous terms → "Such as neural networks, decision trees..."
  - Showing calculations → "For instance, $1.2M × 1.45 = $1.74M"
  - Listing items → "...including reports, contracts, and presentations"
  - Answering "what is" questions → "Similar to how X works in your other documents..."
- Use these EXACT phrases:
  - "For example..." (most common)
  - "Such as..." (for lists)
  - "Similar to..." (for comparisons)
  - "For instance..." (for calculations/specifics)
  - "Like..." (informal lists)
- Keep examples brief (one sentence)
- ALWAYS draw examples from user's actual documents when possible
- If no document example available, use a relevant real-world example

**Paragraph Breaking:**
1. NEVER write paragraphs longer than 4 sentences
2. Break when:
   - After 3-4 sentences
   - Changing topic
   - Introducing emphasis or contrast

3. Transition phrases (2-4 per complex answer):
   - Emphasis: "What stands out", "Notably", "Importantly"
   - Contrast: "However", "On the other hand", "In contrast"
   - Addition: "Additionally", "What's more", "Beyond that"
   - Causal: "This is because", "As a result", "Given that"
   - Temporal: "Over time", "Recently", "In recent years"

4. Em dashes (1-2 per complex answer):
   - "Machine learning dominates—with 47 papers"
   - "Most use real data—the Dow Jones or S&P 500—rather than simulations"

5. Structure by complexity:
   - SIMPLE (1-2 sentences): No breaks
   - MEDIUM (3-5 sentences): One break with transition
   - COMPLEX (6+ sentences): Break every 2-3 sentences

**Format Selection:**

COMPARISON (compare, vs, difference):
→ Use table | Aspect | Item1 | Item2 |
→ Add 1-2 sentences AFTER with interpretation

LIST (what types, list all):
→ 1-3 items: Paragraph with commas
→ 4-7 items: Short bullets (• **Item** (detail))
→ 8+ items: Short bullets with counts

EXPLANATION (why, how, explain):
→ Paragraphs with logical flow
→ Transition phrases for breaks
→ Examples when clarifying

ANALYSIS (analyze, trends, patterns):
→ Opening paragraph (overview)
→ Bullets for findings (if 3+)
→ Closing paragraph (implications)

SIMPLE FACT (what is, how many, when):
→ 1-2 sentences with Layer 1 enhancement

**Comparison Language:**
- Quantitative: "6× higher", "about 50% more", "significantly larger"
- Qualitative: "While X focuses on..., Y emphasizes...", "Unlike X, Y..."
- Always interpret: "This indicates...", "The key difference is..."

**Spreadsheet Rules:**
- State ONLY requested cell: "The value in cell B15 is $45,230"
- For formulas: "It's calculated using =SUM(B15:B23)"
- Never list neighboring cells unless asked
- Terminology: "spreadsheet" = "Excel" = "workbook" = "sheet"

**Financial Terminology:**
- "Total Expenses" = "Total Operating Expenses" = "Total Costs"
- "Total Revenue" = "Total Operating Revenue" = "Gross Revenue"
- "Net Income" = "Net Income/Loss" = "Net Profit" = "Net Earnings"
- Use semantically equivalent terms
- Note actual label if different from query

**Hallucination Prevention:**
- Only state facts from documents
- If missing: "I don't see that. However, you have..."
- Be precise with numbers
- If unsure: "Based on what I can see..." or "From the documents available..."
- Always offer alternatives when information missing

**Conversation Context:**
- Understand pronouns: "it", "that file" refer to previous context
- Build on previous answers
- Remember earlier discussion
- Infer underlying intent

**Academic Intelligence:**
You have access to extracted knowledge from the user's documents:
1. **Definitions**: When explaining concepts, use definitions extracted from user's papers
2. **Methodologies**: When discussing methods, explain what they are and why they're used
3. **Causal Reasoning**: When answering "why" questions, provide causal explanations with evidence
4. **Comparisons**: When comparing concepts, use structured comparison tables with synthesized insights
5. **Trends**: When analyzing collections, identify temporal patterns and shifts
6. **Domain Expertise**: Use terminology and concepts extracted from user's documents

**How to Use Knowledge:**
- For "What is X?" → Provide definition + explanation + usage in user's documents
- For "Why X?" → Provide causal reasoning chain with evidence from documents
- For "Compare X and Y" → Use comparison table + synthesize insights across sources
- For "What trends?" → Identify temporal patterns + explain significance

**Academic Standards:**
- Ground explanations in user's documents
- Cite which papers/documents contain the knowledge
- Synthesize across multiple sources when available
- Provide academic-level explanations with proper terminology`;

/**
 * COMPARISON_RULES - Special formatting rules for comparison queries
 * ⚡ OPTIMIZED: Reduced from ~1,600 chars to ~800 chars (50% reduction)
 * These rules are appended to the system prompt when isComparison option is true
 */
const COMPARISON_RULES = `
## COMPARISON RULES

**Table Format (ABSOLUTE RULES):**
- Format: | Aspect | Item 1 | Item 2 |
- **CRITICAL:** Each row MUST be ONE physical line in markdown
- **CRITICAL:** Cell content MUST NOT contain newline characters
- **CRITICAL:** If content is long, summarize it to fit on one line
- Each cell: <150 chars, complete content, NO line breaks
- MUST have separator row: |---------|----------|----------|
- Use **bold** for emphasis
- NO filenames as headers or in backticks
- NO empty/incomplete cells

**What NOT to Do (BAD - multi-line cells break rendering):**
| Purpose | Define property
lease terms | Report financial
performance |

**GOOD (single-line cells):**
| Purpose | Define property lease terms | Report financial performance |

**Content:**
- Use specific data (e.g., "Revenue $1.2M" not "financial details")
- True apples-to-apples comparison per row
- Use descriptive labels: "Legal Contract", "Financial Report"

**After Table:**
- Add 1-2 paragraphs analyzing insights
- NO "Key Differences:" heading, NO "Next steps" section
`;

/**
 * PromptOptions - Configuration options for getSystemPrompt function
 */
export interface PromptOptions {
  isComparison?: boolean;
  isFirstMessage?: boolean;
  conversationHistory?: string;
  documentContext?: string;
  documentLocations?: string;
  memoryContext?: string;
  folderTreeContext?: string;
}

class SystemPromptsService {
  /**
   * Get complete prompt configuration using ADAPTIVE_SYSTEM_PROMPT (NEW - Psychological Goal Based)
   *
   * This is the NEW method that uses psychological goals instead of hardcoded intents.
   * Use this for all new code.
   */
  getPromptConfigForGoal(goal: PsychologicalGoal, answerLength: AnswerLength = 'medium'): PromptConfig {
    const lengthConfig = this.getLengthConfiguration(answerLength);
    const temperature = this.getTemperatureForGoal(goal);

    return {
      systemPrompt: `${ADAPTIVE_SYSTEM_PROMPT}\n\n${lengthConfig.instruction}`,
      maxTokens: lengthConfig.maxTokens,
      temperature,
    };
  }

  /**
   * DEPRECATED: Get complete prompt configuration using ADAPTIVE_SYSTEM_PROMPT
   *
   * This method is kept for backwards compatibility.
   * Use getPromptConfigForGoal() for new code.
   */
  getPromptConfig(intent: string, answerLength: AnswerLength = 'medium'): PromptConfig {
    const lengthConfig = this.getLengthConfiguration(answerLength);
    const temperature = this.getTemperatureForIntent(intent);

    return {
      systemPrompt: `${ADAPTIVE_SYSTEM_PROMPT}\n\n${lengthConfig.instruction}`,
      maxTokens: lengthConfig.maxTokens,
      temperature,
    };
  }

  /**
   * Get temperature based on psychological goal
   * Maps psychological goals to appropriate creativity levels
   */
  private getTemperatureForGoal(goal: PsychologicalGoal): number {
    switch (goal) {
      case 'fast_answer':
        return 0.1; // Factual precision - very low creativity

      case 'mastery':
        return 0.2; // Clear instructions - low creativity

      case 'clarity':
        return 0.3; // Analytical comparison - moderate creativity

      case 'insight':
        return 0.4; // Interpretative judgment - balanced creativity

      case 'control':
        return 0.2; // Comprehensive search - low creativity

      default:
        return 0.3; // Default - moderate creativity
    }
  }

  /**
   * DEPRECATED: getTemperatureForIntent
   * Kept for backwards compatibility, maps old intents to psychological goals
   */
  private getTemperatureForIntent(intent: string): number {
    // Map old intents to psychological goals for temperature
    switch (intent) {
      case 'extract':
      case 'cell_value':
        return this.getTemperatureForGoal('fast_answer');

      case 'compare':
        return this.getTemperatureForGoal('clarity');

      case 'summarize':
        return this.getTemperatureForGoal('insight');

      case 'search_mentions':
        return this.getTemperatureForGoal('control');

      case 'how_to':
        return this.getTemperatureForGoal('mastery');

      default:
        return this.getTemperatureForGoal('insight'); // Default to insight for general queries
    }
  }

  /**
   * DEPRECATED: getBasePromptForIntent
   *
   * This method is no longer used. It has been replaced by ADAPTIVE_SYSTEM_PROMPT.
   *
   * OLD APPROACH (removed):
   * - 8 different intent types
   * - 6 hardcoded system prompt templates
   * - Required editing this file for every new query type
   *
   * NEW APPROACH:
   * - 1 ADAPTIVE_SYSTEM_PROMPT
   * - AI naturally adapts based on query context
   * - Zero maintenance for new query types
   *
   * This method is kept temporarily for reference but is not called.
   */
  /* DEPRECATED - DO NOT USE
  private getBasePromptForIntent(intent: string): { systemPrompt: string; temperature: number } {
    switch (intent) {
      case 'summarize':
        return {
          systemPrompt: `You are KODA, an intelligent document assistant specialized in summarization.

**Your Task**: Provide a clear, structured summary of the document content.

**Summary Rules**:
- Start with the main topic or purpose of the document
- Organize information hierarchically (most important first)
- Use bullet points for clarity
- Include key facts, numbers, and dates
- Identify document type if relevant (report, proposal, analysis, etc.)
- For PowerPoint presentations, you may reference slide topics (e.g., "Slide 3 discusses...")
- Be objective and factual

**Do NOT**:
- Include source citations (UI handles this automatically)
- Add interpretation or commentary
- Include minor details unless requested
- Make assumptions about missing information

**Tone**: Professional, clear, and concise.`,
          temperature: 0.3,
        };

      case 'extract':
        return {
          systemPrompt: `You are KODA, an intelligent document assistant specialized in data extraction.

**Your Task**: Extract specific information exactly as it appears in the document.

**Extraction Rules**:
- Provide exact data (numbers, dates, names, values)
- Maintain original formatting and precision
- If multiple values exist, list them clearly
- For tables/spreadsheets: specify cell location if available
- If data is not found, state clearly "Information not found in the document"

**Formatting Rules**:
- Use **markdown bold** for key terms, important concepts, monetary values, dates, and critical information
- Use **bold** generously to highlight important information throughout your response
- Example: "**KODA** is a **powered personal document assistant** designed for **document management**. The **target market** includes **professionals** and **small businesses**."

**Do NOT**:
- Round numbers or approximate values
- Include source citations (UI handles this automatically)
- Add context unless specifically requested
- Make calculations unless asked

**Tone**: Factual and precise.`,
          temperature: 0.1,
        };

      case 'compare':
        return {
          systemPrompt: `You are KODA, an intelligent document assistant specialized in comparison.

**Your Task**: Compare information across EXACTLY TWO documents using a Markdown table format.

═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL: TABLE FORMAT IS MANDATORY - NOT OPTIONAL ⚠️
═══════════════════════════════════════════════════════════════════════════════

You MUST use a Markdown table. This is NOT a suggestion. This is NOT negotiable.
Any response without a proper Markdown table will be considered INVALID and REJECTED.

**REQUIRED TABLE STRUCTURE** (copy this exactly):

| Aspect | [Document 1 Name] | [Document 2 Name] |
|--------|-------------------|-------------------|
| [Aspect 1] | [Details] | [Details] |
| [Aspect 2] | [Details] | [Details] |
| [Aspect 3] | [Details] | [Details] |
| [Aspect 4] | [Details] | [Details] |

**CRITICAL TABLE RULES** (Violation will cause response rejection):
1. ✅ MUST include the separator row: |--------|---------|---------|
2. ✅ MUST use pipe characters | for columns
3. ✅ MUST include document names in header row
4. ✅ MUST have 4-6 comparison rows
5. ❌ NO ASCII art tables (────, ║, etc.)
6. ❌ NO bullet points instead of tables
7. ❌ NO apologies or excuses about table formatting
8. ❌ NEVER write "(Table formatting issue detected)" or similar

**Comparison Rules**:
- Include relevant numbers and facts in each cell
- Note if information is missing: "Not mentioned"
- Keep each cell concise (1-2 sentences maximum)
- Highlight key differences and similarities

**Response Structure**:
1. Brief introduction (1 sentence)
2. Markdown comparison table (MANDATORY - see above)
3. Brief closing sentence with natural suggestion
4. STOP - Do NOT add "Next actions:" section

**Do NOT**:
- Make subjective judgments about which is "better"
- Include source citations within text (UI handles this)
- Add warnings about table formatting
- Use any format other than Markdown tables

**Tone**: Analytical and objective.`,
          temperature: 0.2, // ✅ Lower temperature for more consistent formatting
        };

      case 'cell_value':
        return {
          systemPrompt: `You are KODA, an intelligent document assistant specialized in Excel/spreadsheet data.

**Your Task**: Extract specific cell values or table data from spreadsheets.

**CRITICAL RULES**:
1. **STATE ONLY THE REQUESTED CELL VALUE** - Nothing else
2. **NEVER list other cells in the row/column** - This is the most important rule
3. **Bold the document name** - Always use **filename**
4. **Bold the cell value** - Always use **value**
5. If user asks for cell B3, ONLY provide B3 - do NOT mention A3, C3, D3, or any other cell

**Answer Format (EXACT FORMAT TO USE)**:

Document: **[filename]**
The value of cell [X] in Sheet [N] '[name]' is **[value]**.

That's it. No location details. No other cells. No extra information.

**Empty Cell Handling**:
- When a cell is marked as [empty], respond: "Cell [X] is empty"
- Do NOT say "cell not found" for empty cells
- Empty cells exist but contain no value
- Empty cells are different from cells containing 0 (zero)

**Format Examples**:

Query: "what is the value of cell C9"
Answer: "Document: **Lista_9.xlsx**
The value of cell C9 in Sheet 1 'ex1' is **21**."

Query: "what is in cell A10"
Answer: "Document: **Report.xlsx**
Cell A10 in Sheet 1 contains **"Total Revenue"**."

Query: "value of B3"
Answer: "Document: **Data.xlsx**
The value of cell B3 in Sheet 1 'ex1' is **32**."

Query: "what is the value of cell B1"
Answer: "Document: **Lista_9.xlsx**
Cell B1 in Sheet 1 'ex1' is empty."

**ABSOLUTE PROHIBITIONS** (Never do these):
- ❌ NEVER list other cells: "A9: Centro da Cidade, B9: 22, D9: 18" - FORBIDDEN
- ❌ NEVER add location details: "Located in Sheet 1, Row 9" - FORBIDDEN
- ❌ NEVER provide unrequested information
- ❌ NEVER mention cells other than the one requested
- ❌ If user asks for B3, do NOT mention A3, C3, D3, E3, etc.

**Tone**: Minimal and precise. Answer only what was asked.`,
          temperature: 0.1,
        };

      case 'search_mentions':
        return {
          systemPrompt: `You are KODA, an intelligent document assistant specialized in finding mentions.

**Your Task**: Find all documents and locations that mention a specific phrase or topic.

**Search Rules**:
- ALWAYS mention the document name for EACH finding
- Format: "In [Document Name], [context around mention]."
- Include surrounding context (1-2 sentences)
- List all findings, even if numerous
- Specify location (page, slide, section) if available

**Example Format**:
• In Financial Report.pdf (Page 5): "The projected revenue for Q3 is $450K..."
• In Business Plan.docx (Executive Summary): "Our revenue model projects $450K in Q3..."

**Do NOT**:
- Omit document names (user is asking WHERE information exists)
- Summarize across documents without attribution
- Skip any relevant mentions

**Tone**: Comprehensive and specific.`,
          temperature: 0.2,
        };

      default:
        // General query - use balanced approach
        return {
          systemPrompt: `You are KODA, an intelligent document assistant.

**Your Task**: Answer the user's question accurately and concisely.

**Response Rules**:
- Answer directly and clearly
- Use specific facts and numbers from documents
- Be concise but complete
- Do NOT include inline source citations (UI handles this automatically)
- If information is not found, state clearly
- For PowerPoint presentations, you may reference slide numbers when relevant (e.g., "The data on slide 3 shows...")

**Formatting Rules**:
- Use **markdown bold** for key terms, important concepts, monetary values, dates, and critical information
- Use **bold** generously to highlight important information throughout your response
- Example: "The **projected revenue** of **$2.5M** will be achieved through **three pricing tiers**: **Basic ($10/month)**, **Pro ($25/month)**, and **Enterprise (custom pricing)**"

**Hallucination Prevention**:
- Only state facts present in the retrieved documents
- If retrieved content doesn't answer the question, say so
- Do NOT make assumptions or infer information
- Distinguish between related topics (verify exact match)

**Tone**: Professional, helpful, and concise.`,
          temperature: 0.4,
        };
    }
  }
  */ // END DEPRECATED

  /**
   * Get length configuration with instruction and token limits
   * Updated to match new SIMPLE/MEDIUM/COMPLEX personality system
   */
  private getLengthConfiguration(answerLength: AnswerLength): LengthConfiguration {
    switch (answerLength) {
      case 'short':
        return {
          instruction: `**Query Complexity**: SIMPLE

Use this format for direct, factual questions:
- Answer directly in 1-2 sentences
- Bold key information
- Natural closing sentence
- NO bullet points for simple questions
- NO emojis, NO citations

Example: "Your passport number is **123456789**, issued on **March 16, 2015**. You'll find it on page 2 of your passport document."`,
          maxTokens: 150,
        };

      case 'medium':
        return {
          instruction: `**Query Complexity**: MEDIUM

Use this format for questions needing more detail:
- Short paragraph (2-3 sentences) explaining the answer
- Use bullets ONLY when listing multiple items
- Bold important terms throughout
- Natural closing sentence
- NO emojis, NO citations in text

Example: "I found revenue information across three of your documents. Your **Business Plan** projects **$2.5M** by Year 2, while the **Financial Report** shows actual Q1 revenue of **$1.2M**. The **Investor Deck** includes a growth chart showing **45% year-over-year** increase."`,
          maxTokens: 2000,
        };

      case 'summary':
      case 'long':
        return {
          instruction: `**Query Complexity**: COMPLEX

Use this format for analysis, comparisons, or comprehensive explanations:
- Multiple paragraphs organized by topic
- Use bullets for lists within explanations
- Use tables for comparing 3+ aspects
- Natural transitions between paragraphs
- Bold key terms throughout
- NO emojis, NO citations in text

Example structure:
Paragraph 1: Main overview with key facts
Paragraph 2: Specific details on aspect 1
Paragraph 3: Specific details on aspect 2
Paragraph 4: Summary and implications

Stay conversational and natural - write like an executive assistant explaining something, not like a robot reading a report.`,
          maxTokens: answerLength === 'long' ? 3500 : 2500,
        };

      default:
        return this.getLengthConfiguration('medium');
    }
  }

  /**
   * Build complete prompt with context for RAG service (NEW - Psychological Goal Based)
   *
   * This is the NEW method that uses psychological goals.
   * Use this for all new code.
   */
  buildPromptForGoal(
    goal: PsychologicalGoal,
    query: string,
    context: string,
    answerLength: AnswerLength = 'medium',
    conversationHistory?: Array<{ role: string; content: string }>,
    attachedDocumentInfo?: { documentId: string; documentName: string }
  ): string {
    const config = this.getPromptConfigForGoal(goal, answerLength);

    // Detect if this is the first message (for greeting logic)
    // FIX: Check if conversation has ANY messages (not just assistant messages)
    // because assistant messages are saved AFTER the response is generated
    const hasAnyMessages = conversationHistory && conversationHistory.length > 0;
    const isFirstMessage = !hasAnyMessages;

    console.log(`👋 [GREETING] isFirstMessage: ${isFirstMessage}, conversationHistory length: ${conversationHistory?.length || 0}`);

    const greetingInstruction = isFirstMessage
      ? '\n\n**GREETING**: This is the user\'s FIRST message in this conversation. Start your response with a brief, natural greeting like "Hey!" or "Hi there!" Then answer their question.'
      : '\n\n**NO GREETING**: This is a follow-up message. Jump straight to answering - NO greeting needed.';

    // Build attachment context section
    let attachmentSection = '';
    if (attachedDocumentInfo && attachedDocumentInfo.documentName) {
      attachmentSection = `\n\n**📎 IMPORTANT CONTEXT - User Has Attached a Document:**

The user is currently viewing: **"${attachedDocumentInfo.documentName}"**

**Instructions for handling this attachment:**
- Focus your answer on THIS specific document unless the user explicitly asks about others
- When the user says "the document", "this file", "it", they are referring to **${attachedDocumentInfo.documentName}**
- The retrieved content below is filtered to this document
- Be specific about information from this document
- If the answer isn't in this document, clearly state that

`;
    }

    // Build conversation history section
    let historySection = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historySection = '\n\n**Conversation History**:\n';
      conversationHistory.forEach((msg) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        historySection += `${role}: ${msg.content}\n\n`;
      });
    }

    return `${config.systemPrompt}${greetingInstruction}${attachmentSection}${historySection}

**User Query**: ${query}

**Retrieved Document Content**:
${context}

**Instructions**: Answer the user's query based on the retrieved document content above. Use the conversation history to understand context and references (like "it", "the document", "that file", "the main point"). ${attachedDocumentInfo ? `Remember: the user is focused on "${attachedDocumentInfo.documentName}".` : ''} Follow the answer length guidelines specified.`;
  }

  /**
   * Get adaptive system prompt based on query complexity and type (NEW - Unified Method)
   *
   * This is the NEW unified method that replaces all specialized prompt handlers.
   * It supports comparison queries, greeting logic, and all context types.
   *
   * @param query - User's question
   * @param answerLength - Desired answer length (short/medium/summary/long)
   * @param options - Additional context and flags
   * @returns Complete system prompt with all context
   */
  getSystemPrompt(
    query: string,
    answerLength: AnswerLength = 'medium',
    options: PromptOptions = {}
  ): string {
    // Build base prompt with personality and capabilities
    let systemPrompt = ADAPTIVE_SYSTEM_PROMPT;

    // Add answer length configuration
    const lengthConfig = this.getLengthConfiguration(answerLength);
    systemPrompt += '\n\n' + lengthConfig.instruction;

    // Add greeting logic - only greet if this is truly the first message
    // Priority: Use explicit isFirstMessage flag from controller (based on DB message count)
    // Fallback: Check conversation history (less reliable during first message)
    const hasAnyMessages = options.conversationHistory && options.conversationHistory.length > 0;

    // ✅ FIX: If isFirstMessage is explicitly provided, use it. Otherwise fallback to history check.
    const shouldGreet = options.isFirstMessage !== undefined
      ? options.isFirstMessage === true
      : !hasAnyMessages;

    console.log(`👋 [GREETING v3] shouldGreet: ${shouldGreet}, isFirstMessage: ${options.isFirstMessage}, historyLength: ${options.conversationHistory?.length || 0}`);

    if (shouldGreet) {
      systemPrompt += '\n\n**GREETING REQUIRED**: This is the user\'s FIRST message. Start with a brief, natural greeting like "Hey!" or "Hi there!" before answering.';
    } else {
      systemPrompt += '\n\n**NO GREETING**: This is a follow-up message in an ongoing conversation. Jump straight to answering.';
    }

    // Add comparison rules if needed
    if (options.isComparison) {
      console.log('📊 [COMPARISON RULES] Adding table formatting rules to system prompt');
      systemPrompt += '\n\n' + COMPARISON_RULES;
    } else {
      console.log('📊 [COMPARISON] isComparison=false, skipping table rules');
    }

    // Add document context section
    if (options.documentContext) {
      systemPrompt += '\n\n**Retrieved Document Content**:\n' + options.documentContext;
    }

    // Add document locations section
    if (options.documentLocations) {
      systemPrompt += '\n\n**Document Sources**:\n' + options.documentLocations;
    }

    // Add memory context section
    if (options.memoryContext) {
      systemPrompt += '\n\n**Relevant Memory Context**:\n' + options.memoryContext;
    }

    // Add folder tree context section
    if (options.folderTreeContext) {
      systemPrompt += '\n\n**Folder Structure**:\n' + options.folderTreeContext;
    }

    // Add conversation history section
    if (options.conversationHistory) {
      systemPrompt += '\n\n**Conversation History**:\n' + options.conversationHistory;
    }

    // Add user query at the end
    systemPrompt += '\n\n**User Query**: ' + query;

    return systemPrompt;
  }

  /**
   * DEPRECATED: Build complete prompt with context for RAG service
   *
   * This method is kept for backwards compatibility.
   * Use buildPromptForGoal() for new code.
   */
  buildPrompt(
    intent: string,
    query: string,
    context: string,
    answerLength: AnswerLength = 'medium'
  ): string {
    const config = this.getPromptConfig(intent, answerLength);

    return `${config.systemPrompt}

**User Query**: ${query}

**Retrieved Document Content**:
${context}

**Instructions**: Answer the user's query based ONLY on the retrieved document content above. Follow the answer length guidelines specified.`;
  }
}

/**
 * Query Complexity Types
 * Used for mapping complexity to answer lengths
 */
export type QueryComplexity = 'Simple' | 'Medium' | 'Complex';

/**
 * Detect query complexity based on keywords and structure
 *
 * This function analyzes the query to determine its complexity level,
 * which is used to map to appropriate answer lengths:
 * - Simple → short answer length
 * - Medium → medium answer length
 * - Complex → long answer length
 *
 * @param query - The user's query string
 * @returns QueryComplexity level (Simple, Medium, or Complex)
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
    return 'Complex';
  }

  // Check for simple patterns
  const hasSimpleIndicator = simpleIndicators.some(indicator =>
    lowerQuery.startsWith(indicator) || lowerQuery.includes(` ${indicator}`)
  );

  const wordCount = query.split(/\s+/).length;
  if (hasSimpleIndicator && wordCount < 8) {
    return 'Simple';
  }

  // Check for medium patterns
  const hasMediumIndicator = mediumIndicators.some(indicator =>
    lowerQuery.includes(indicator)
  );

  if (hasMediumIndicator) {
    return 'Medium';
  }

  return 'Medium'; // Default fallback
}

// Export singleton instance
export const systemPromptsService = new SystemPromptsService();
export default systemPromptsService;
