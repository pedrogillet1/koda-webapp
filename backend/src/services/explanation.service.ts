/**
 * Explanation Service - Chain of Thought and Fact-Checking Pipeline
 *
 * This service provides advanced reasoning capabilities for explanation-type queries.
 * It implements:
 * 1. Chain of Thought (CoT) - Creates a logical plan for explanations
 * 2. Fact Identification - Extracts key claims that need verification
 * 3. Fact-Checking - Verifies claims against trusted sources (web search)
 * 4. Refined Prompt Generation - Constructs detailed prompts with verified facts
 */

import { PrismaClient } from '@prisma/client';
import { llmProvider } from './llm.provider';
import { searchTool } from '../tools/search.tool';

const prisma = new PrismaClient();

interface ExplanationStep {
  step: number;
  description: string;
  reasoning: string;
}

interface FactClaim {
  claim: string;
  source?: string;
  verified: boolean;
  confidence: number;
}

interface ExplanationResult {
  chainOfThought: ExplanationStep[];
  factClaims: FactClaim[];
  refinedPrompt: string;
  finalResponse: string;
  sources: string[];
}

class ExplanationService {
  private model: string = 'gemini-2.5-flash';

  /**
   * Detects if a query requires deep explanation processing
   */
  isExplanationQuery(query: string): boolean {
    const explanationPatterns = [
      // Direct explanation requests
      /\bexplain\b/i,
      /\bhow does\b/i,
      /\bhow do\b/i,
      /\bhow can\b/i,
      /\bhow to\b/i,
      /\bwhy does\b/i,
      /\bwhy do\b/i,
      /\bwhy is\b/i,
      /\bwhat is\b/i,
      /\bwhat are\b/i,
      /\bwhat does\b/i,
      /\bwhat do\b/i,
      /\bdescribe\b/i,
      /\bdefine\b/i,
      /\bdefinition\b/i,
      /\bbreak down\b/i,
      /\bwalk me through\b/i,
      /\bhelp me understand\b/i,
      /\bcan you clarify\b/i,
      /\bwhat's the difference\b/i,
      /\bcompare\b/i,
      /\banalyze\b/i,
      /\bsummarize\b/i,
      /\btell me about\b/i,
      /\bwhat about\b/i,
      // Implicit definition queries (e.g., "Machine is", "The concept of")
      /^[A-Z][a-z]+\s+is\b/i, // Starts with capitalized word + "is"
      /\bconcept of\b/i,
      /\bmeaning of\b/i,
      /\bpurpose of\b/i,
      /\brole of\b/i,
      /\bfunction of\b/i,
      /\bimportance of\b/i,
      /\bbenefits of\b/i,
      /\badvantages of\b/i,
      /\bdisadvantages of\b/i,
      /\bprinciples of\b/i,
      /\bbasics of\b/i,
      /\bfundamentals of\b/i,
    ];

    return explanationPatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Main public method: Generate explanation with full pipeline
   * Simplified interface for external use
   */
  async generateExplanation(query: string, systemPrompt: string): Promise<string> {
    const chainOfThought = await this.generateChainOfThoughtSimple(query, systemPrompt);
    const { finalPrompt, sources } = await this.factCheckAndRefine(chainOfThought, query);

    const finalResponse = await llmProvider.createChatCompletion({
      model: this.model,
      messages: [
        { role: 'system', content: finalPrompt },
        { role: 'user', content: query },
      ],
    });

    const content = finalResponse.choices[0].message.content || 'I could not generate a response.';

    // Sources are now shown as inline pill citations only - no text-based source section
    return content;
  }

  /**
   * Simple Chain of Thought generation (for generateExplanation method)
   */
  private async generateChainOfThoughtSimple(query: string, systemPrompt: string): Promise<string> {
    const cotPrompt = `System: ${systemPrompt}\nUser Query: "${query}"\nBased on the user query, generate a step-by-step plan (a Chain of Thought) for constructing a high-quality, accurate, and easy-to-understand explanation. Identify key facts that need to be verified.\nChain of Thought:`;

    const response = await llmProvider.createChatCompletion({
      model: this.model,
      messages: [{ role: 'user', content: cotPrompt }],
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Fact-check and refine the chain of thought with web search
   */
  private async factCheckAndRefine(
    chainOfThought: string,
    query: string
  ): Promise<{ finalPrompt: string; sources: string[] }> {
    const factCheckPrompt = `Chain of Thought: "${chainOfThought}"\nBased on this plan, list up to 3 critical factual claims that MUST be verified before answering the user's query: "${query}". Format as a JSON array of strings.\nExample: ["The capital of France is Paris"]\nClaims:`;

    const claimsResponse = await llmProvider.createChatCompletion({
      model: this.model,
      messages: [{ role: 'user', content: factCheckPrompt }],
    });

    const claimsText = claimsResponse.choices[0].message.content || '[]';
    let claims: string[] = [];
    try {
      // Extract JSON array from response
      const jsonMatch = claimsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        claims = JSON.parse(jsonMatch[0]);
      }
    } catch {
      /* Ignore parsing errors */
    }

    let verifiedFacts = '';
    const sources: string[] = [];

    if (claims.length > 0) {
      // Use default trusted domains (TrustedSource table removed)
      const trustedDomains: string[] = ['wikipedia.org', 'britannica.com', 'scholar.google.com'];

      for (const claim of claims) {
        // Build search query with trusted domains
        const domainFilter =
          trustedDomains.length > 0 ? ` site:${trustedDomains.join(' OR site:')}` : '';
        const searchResults = await searchTool.search(`${claim}${domainFilter}`);

        if (searchResults && searchResults.length > 0) {
          verifiedFacts += `- ${claim}: Verified. ${searchResults[0].snippet}\n`;
          sources.push(searchResults[0].url);
        }
      }
    }

    const finalPrompt = `You are Koda, a helpful AI assistant. Your task is to answer the user's query based on the following plan and verified facts. Your answer must be clear, well-structured, and easy to understand.

**Plan:**
${chainOfThought}

**Verified Facts:**
${verifiedFacts || 'No external facts were verified for this query.'}

Generate the final, user-facing response now.`;

    return { finalPrompt, sources };
  }

  /**
   * Generates a Chain of Thought plan for the explanation (detailed version)
   */
  async generateChainOfThought(query: string, context: string): Promise<ExplanationStep[]> {
    const systemPrompt = `You are a reasoning assistant. Your job is to create a step-by-step logical plan for explaining a topic.

Given a user query and context, break down the explanation into clear, logical steps.
Each step should have:
- A brief description of what will be explained
- The reasoning behind why this step is necessary

Respond ONLY with a valid JSON array of steps in this format:
[
  {"step": 1, "description": "Brief description", "reasoning": "Why this step matters"},
  {"step": 2, "description": "Brief description", "reasoning": "Why this step matters"}
]

Keep the plan to 3-5 steps maximum. Be concise.`;

    const userPrompt = `Query: ${query}

Context from documents:
${context.substring(0, 2000)}

Create a logical step-by-step plan to explain this topic.`;

    try {
      const response = await llmProvider.createChatCompletion({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || '[]';
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ExplanationStep[];
      }
      return [];
    } catch (error) {
      console.error('[ExplanationService] Error generating Chain of Thought:', error);
      return [];
    }
  }

  /**
   * Identifies factual claims that need verification
   */
  async identifyFactClaims(
    query: string,
    chainOfThought: ExplanationStep[],
    context: string
  ): Promise<FactClaim[]> {
    const systemPrompt = `You are a fact-checking assistant. Your job is to identify key factual claims that should be verified.

Given a query, a reasoning plan, and document context, extract specific factual claims that are:
1. Central to answering the query
2. Verifiable (not opinions)
3. From the provided context

Respond ONLY with a valid JSON array:
[
  {"claim": "Specific factual statement", "confidence": 0.8},
  {"claim": "Another factual statement", "confidence": 0.9}
]

Extract 2-4 key claims maximum. The confidence is your initial assessment (0-1) based on context.`;

    const planSummary = chainOfThought.map((s) => `${s.step}. ${s.description}`).join('\n');

    const userPrompt = `Query: ${query}

Reasoning Plan:
${planSummary}

Document Context:
${context.substring(0, 2000)}

Identify the key factual claims that need verification.`;

    try {
      const response = await llmProvider.createChatCompletion({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const claims = JSON.parse(jsonMatch[0]) as Array<{
          claim: string;
          confidence: number;
        }>;
        return claims.map((c) => ({
          ...c,
          verified: c.confidence >= 0.7, // Mark high-confidence claims as verified from context
          source: 'document_context',
        }));
      }
      return [];
    } catch (error) {
      console.error('[ExplanationService] Error identifying fact claims:', error);
      return [];
    }
  }

  /**
   * Fact-check claims using web search (if SERPAPI_KEY is available)
   */
  async factCheckWithWebSearch(claims: FactClaim[]): Promise<FactClaim[]> {
    // Only verify claims that have low confidence from document context
    const claimsToVerify = claims.filter((c) => c.confidence < 0.7);

    if (claimsToVerify.length === 0) {
      console.log('[ExplanationService] All claims have high confidence, skipping web verification');
      return claims;
    }

    console.log(`[ExplanationService] Verifying ${claimsToVerify.length} claims with web search`);

    const verifiedClaims = await Promise.all(
      claims.map(async (claim) => {
        if (claim.confidence >= 0.7) {
          return claim; // Already high confidence
        }

        try {
          const result = await searchTool.verifyClaim(claim.claim);
          return {
            ...claim,
            verified: result.verified,
            confidence: Math.max(claim.confidence, result.confidence),
            source: result.sources.length > 0 ? result.sources[0].url : claim.source,
          };
        } catch (error) {
          console.error(`[ExplanationService] Failed to verify claim: ${claim.claim}`, error);
          return claim;
        }
      })
    );

    return verifiedClaims;
  }

  /**
   * Generates a refined prompt incorporating the chain of thought and verified facts
   */
  generateRefinedPrompt(
    query: string,
    chainOfThought: ExplanationStep[],
    factClaims: FactClaim[],
    context: string
  ): string {
    const planSection = chainOfThought
      .map((s) => `Step ${s.step}: ${s.description}\n   Reason: ${s.reasoning}`)
      .join('\n');

    const factsSection = factClaims
      .map(
        (f) =>
          `- ${f.claim} [${f.verified ? '✓ Verified' : '? Unverified'}] (Confidence: ${Math.round(f.confidence * 100)}%)`
      )
      .join('\n');

    return `You are providing a well-structured, logical explanation.

USER QUERY: ${query}

REASONING PLAN (follow this structure):
${planSection}

KEY FACTS TO INCORPORATE:
${factsSection}

RELEVANT CONTEXT:
${context}

INSTRUCTIONS:
1. Follow the reasoning plan step by step
2. Incorporate the verified facts naturally
3. Be clear, concise, and educational
4. If any facts are unverified, present them cautiously
5. Cite specific information from the context when relevant

Provide your explanation now:`;
  }

  /**
   * Full pipeline: Processes an explanation query through the complete pipeline
   */
  async processExplanation(
    query: string,
    context: string,
    existingSystemPrompt?: string
  ): Promise<ExplanationResult> {
    console.log('[ExplanationService] Starting explanation pipeline for query:', query);

    // Step 1: Generate Chain of Thought
    const chainOfThought = await this.generateChainOfThought(query, context);
    console.log('[ExplanationService] Generated CoT with', chainOfThought.length, 'steps');

    // Step 2: Identify Factual Claims
    let factClaims = await this.identifyFactClaims(query, chainOfThought, context);
    console.log('[ExplanationService] Identified', factClaims.length, 'fact claims');

    // Step 2.5: Fact-check with web search (if SERPAPI_KEY is available)
    factClaims = await this.factCheckWithWebSearch(factClaims);
    console.log(
      '[ExplanationService] Fact-checked claims, verified count:',
      factClaims.filter((c) => c.verified).length
    );

    // Collect sources from verified claims
    const sources: string[] = factClaims
      .filter((c) => c.verified && c.source && c.source !== 'document_context')
      .map((c) => c.source!);

    // Step 3: Generate Refined Prompt
    const refinedPrompt = this.generateRefinedPrompt(query, chainOfThought, factClaims, context);

    // Step 4: Generate Final Response
    const systemPrompt =
      existingSystemPrompt ||
      'You are KODA, an intelligent document assistant. Provide helpful, accurate, and comprehensive explanations.';

    const response = await llmProvider.createChatCompletion({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: refinedPrompt },
      ],
      temperature: 0.5,
      maxTokens: 4096, // Allow for comprehensive explanations
    });

    let finalResponse = response.choices[0]?.message?.content || '';

    // Sources are now shown as inline pill citations only - no text-based source section

    console.log('[ExplanationService] Pipeline complete, response length:', finalResponse.length);

    return {
      chainOfThought,
      factClaims,
      refinedPrompt,
      finalResponse,
      sources,
    };
  }

  /**
   * Quick explanation without full pipeline (for simpler queries)
   */
  async quickExplanation(query: string, context: string): Promise<string> {
    const response = await llmProvider.createChatCompletion({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are KODA, an intelligent document assistant. Provide clear, concise explanations based on the provided context.',
        },
        {
          role: 'user',
          content: `Based on this context:\n${context}\n\nPlease answer: ${query}`,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || '';
  }
}

export const explanationService = new ExplanationService();
