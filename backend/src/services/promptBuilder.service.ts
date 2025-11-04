/**
 * PROMPT BUILDER SERVICE - KODA ARCHITECTURAL REDESIGN
 *
 * FIXES: Unwanted "Next steps", excessive blank lines, poor formatting
 *
 * OLD SYSTEM PROBLEM:
 * - Generic prompts produce inconsistent formatting
 * - Post-processing tries to fix issues after generation (inefficient)
 * - LLM adds unwanted sections ("Next steps", "Recommendations")
 * - Tables generated without proper borders/separators
 *
 * NEW SYSTEM SOLUTION:
 * - Format-aware prompts - LLM generates correctly formatted output DIRECTLY
 * - No post-processing needed (except table validation)
 * - Strict instructions: NO "Next steps", NO excessive blank lines
 * - Intent-specific instructions for better quality
 */

import {
  QueryUnderstanding,
  ResponseFormat,
  QueryIntent,
} from './queryUnderstanding.service';
import { RetrievalResult } from './retrievalStrategy.service';
import { ConfidenceAssessment, ConfidenceQuality } from './confidenceGate.service';

// ===== PROMPT OUTPUT =====

export interface Prompt {
  systemPrompt: string;
  userPrompt: string;
  temperature: number; // 0-1 (controls randomness)
  maxTokens?: number;
}

// ===== PROMPT BUILDER SERVICE =====

class PromptBuilderService {
  /**
   * Main entry point: Build format-aware prompt
   */
  build(
    query: string,
    understanding: QueryUnderstanding,
    retrieval: RetrievalResult,
    assessment: ConfidenceAssessment
  ): Prompt {
    const systemPrompt = this.buildSystemPrompt(understanding, assessment);
    const userPrompt = this.buildUserPrompt(query, understanding, retrieval, assessment);
    const temperature = this.selectTemperature(understanding.intent);

    return {
      systemPrompt,
      userPrompt,
      temperature,
    };
  }

  /**
   * Build system prompt (defines KODA's role and formatting rules)
   */
  private buildSystemPrompt(
    understanding: QueryUnderstanding,
    assessment: ConfidenceAssessment
  ): string {
    let systemPrompt = `You are KODA, an advanced document analysis AI assistant. You help users extract insights from their uploaded documents.

**CRITICAL FORMATTING RULES (MUST FOLLOW):**
1. NEVER add a "Next steps" section unless explicitly requested by the user
2. NEVER add a "Recommendations" section unless explicitly requested
3. NEVER add a "Summary" section unless the user asked for a summary
4. Use EXACTLY ONE blank line between sections (not 2, not 3)
5. Do NOT add excessive blank lines anywhere in your response
6. Do NOT use emojis unless the user explicitly requests them
7. Keep your response focused and concise

`;

    // Add format-specific instructions
    systemPrompt += this.buildFormatInstructions(understanding.format);

    // Add intent-specific instructions
    systemPrompt += this.buildIntentInstructions(understanding.intent);

    // Add confidence-specific instructions
    if (assessment.quality === ConfidenceQuality.MEDIUM) {
      systemPrompt += `\n**CONFIDENCE NOTICE:**
You must include this caveat at the start of your response: "${assessment.caveats}"
`;
    }

    return systemPrompt;
  }

  /**
   * Build format-specific instructions
   */
  private buildFormatInstructions(format: ResponseFormat): string {
    switch (format) {
      case ResponseFormat.TABLE:
        return `
**TABLE FORMAT REQUIREMENTS:**
1. Use Markdown table format with proper borders: | Column 1 | Column 2 |
2. Add separator row with dashes: |----------|----------|
3. Align columns using proper spacing
4. NO extra blank lines inside the table
5. NO text before or after the table unless necessary
6. Ensure EVERY row has the same number of columns
7. Do NOT add a "Next steps" section after the table

Example:
| Aspect | Document A | Document B |
|--------|------------|------------|
| Topic  | Revenue    | Expenses   |
| Value  | $1.2M      | $800K      |

`;

      case ResponseFormat.LIST:
        return `
**LIST FORMAT REQUIREMENTS:**
1. Use bullet points (-) or numbered lists (1., 2., 3.)
2. Keep each item concise (1-2 sentences max)
3. Use sub-bullets for details (  - sub-item)
4. NO extra blank lines between list items
5. NO "Summary" or "Next steps" section after the list

`;

      case ResponseFormat.STRUCTURED:
        return `
**STRUCTURED FORMAT REQUIREMENTS:**
1. Use clear section headers (## Header)
2. Keep sections concise and focused
3. Use bullet points within sections for clarity
4. EXACTLY ONE blank line between sections
5. NO "Next steps" or "Recommendations" section unless requested

`;

      case ResponseFormat.PARAGRAPH:
        return `
**PARAGRAPH FORMAT REQUIREMENTS:**
1. Write in clear, natural prose
2. Keep paragraphs short (3-5 sentences each)
3. EXACTLY ONE blank line between paragraphs
4. NO unnecessary formatting or sections
5. Be direct and concise

`;

      default:
        return '';
    }
  }

  /**
   * Build intent-specific instructions
   */
  private buildIntentInstructions(intent: QueryIntent): string {
    switch (intent) {
      case QueryIntent.CONTENT_COMPARISON:
        return `
**COMPARISON REQUIREMENTS:**
1. Create a comparison table with rows for different aspects
2. Clearly highlight similarities and differences
3. Use consistent terminology across compared items
4. Cite specific details from each document
5. DO NOT add conclusions or "Next steps" unless requested

`;

      case QueryIntent.CONTENT_FACTUAL:
        return `
**FACTUAL ANSWER REQUIREMENTS:**
1. Be precise and specific
2. Cite the source document name
3. Quote exact values/dates/names when available
4. Keep the answer brief and to the point
5. NO extra commentary unless relevant

`;

      case QueryIntent.CONTENT_SUMMARY:
        return `
**SUMMARY REQUIREMENTS:**
1. Start with a brief overview (1-2 sentences)
2. List key points in bullet format
3. Keep each point concise
4. Cover the most important information only
5. NO "Next steps" or recommendations

`;

      case QueryIntent.CONTENT_ANALYSIS:
        return `
**ANALYSIS REQUIREMENTS:**
1. Provide structured analysis with clear sections
2. Support claims with evidence from documents
3. Explain patterns, trends, or insights
4. Use bullet points for clarity
5. Focus on interpretation, not just facts

`;

      default:
        return '';
    }
  }

  /**
   * Build user prompt (includes query, context, and retrieved chunks)
   */
  private buildUserPrompt(
    query: string,
    understanding: QueryUnderstanding,
    retrieval: RetrievalResult,
    assessment: ConfidenceAssessment
  ): string {
    let userPrompt = '';

    // Add confidence caveat prefix if medium confidence
    if (assessment.quality === ConfidenceQuality.MEDIUM && assessment.caveats) {
      userPrompt += `IMPORTANT: Start your response with this caveat: "${assessment.caveats}"\n\n`;
    }

    // Add user query
    userPrompt += `**User Query:**\n${query}\n\n`;

    // Add retrieved context
    if (retrieval.totalChunks > 0) {
      userPrompt += `**Retrieved Information:**\n\n`;

      // Group chunks by document for better organization
      const chunksByDocument = new Map<string, typeof retrieval.chunks>();
      for (const chunk of retrieval.chunks) {
        if (!chunksByDocument.has(chunk.documentId)) {
          chunksByDocument.set(chunk.documentId, []);
        }
        chunksByDocument.get(chunk.documentId)!.push(chunk);
      }

      // Add chunks document by document
      for (const [docId, chunks] of chunksByDocument.entries()) {
        const docName = chunks[0].documentName;
        userPrompt += `**Document: ${docName}**\n`;

        for (let i = 0; i < chunks.length; i++) {
          userPrompt += `[Chunk ${i + 1}] ${chunks[i].content}\n\n`;
        }
      }

      userPrompt += `---\n\n`;
    }

    // Add final instruction
    userPrompt += this.buildFinalInstruction(understanding, retrieval);

    return userPrompt;
  }

  /**
   * Build final instruction based on intent
   */
  private buildFinalInstruction(
    understanding: QueryUnderstanding,
    retrieval: RetrievalResult
  ): string {
    let instruction = `**Your Task:**\n`;

    switch (understanding.intent) {
      case QueryIntent.CONTENT_COMPARISON:
        instruction += `Compare the information from the documents listed above. Create a comparison table that clearly shows similarities and differences. Do NOT add any "Next steps" or "Recommendations" section.\n`;
        break;

      case QueryIntent.CONTENT_FACTUAL:
        instruction += `Answer the user's question using the retrieved information. Be precise and cite the source document. Keep your answer brief and focused.\n`;
        break;

      case QueryIntent.CONTENT_SUMMARY:
        instruction += `Provide a comprehensive summary of the retrieved information. Start with a brief overview, then list key points in bullet format.\n`;
        break;

      case QueryIntent.CONTENT_ANALYSIS:
        instruction += `Analyze the retrieved information to answer the user's question. Provide structured analysis with clear sections and bullet points. Support your insights with evidence from the documents.\n`;
        break;

      default:
        instruction += `Answer the user's query based on the retrieved information. Follow the formatting requirements strictly.\n`;
    }

    // Reminder about formatting
    instruction += `\nREMEMBER:\n`;
    instruction += `- NO "Next steps" section\n`;
    instruction += `- NO excessive blank lines\n`;
    instruction += `- Follow the ${understanding.format} format exactly\n`;

    return instruction;
  }

  /**
   * Select temperature based on intent
   */
  private selectTemperature(intent: QueryIntent): number {
    switch (intent) {
      case QueryIntent.CONTENT_FACTUAL:
      case QueryIntent.METADATA_COUNT:
      case QueryIntent.METADATA_SEARCH:
        return 0.1; // Very low temperature for factual answers (deterministic)

      case QueryIntent.CONTENT_COMPARISON:
        return 0.2; // Low temperature for comparisons (structured)

      case QueryIntent.CONTENT_SUMMARY:
        return 0.3; // Slightly higher for summaries (some flexibility)

      case QueryIntent.CONTENT_ANALYSIS:
        return 0.4; // Higher for analysis (more creative interpretation)

      case QueryIntent.SOCIAL_GREETING:
        return 0.7; // Higher for conversational responses

      default:
        return 0.3; // Default moderate temperature
    }
  }

  /**
   * Build a simple prompt for non-content handlers (meta, file actions, social)
   */
  buildSimplePrompt(query: string, context: string, intent: QueryIntent): Prompt {
    const systemPrompt = `You are KODA, a document analysis AI assistant. Respond naturally and helpfully.

FORMATTING RULES:
- Keep response brief and to the point
- NO "Next steps" section
- NO excessive blank lines
- Use clear, simple language
`;

    const userPrompt = `${context}\n\nUser Query: ${query}`;

    return {
      systemPrompt,
      userPrompt,
      temperature: this.selectTemperature(intent),
    };
  }
}

export const promptBuilderService = new PromptBuilderService();
export default promptBuilderService;
