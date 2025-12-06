/**
 * Grounding Verification Service
 * Priority: P1 (HIGH)
 * 
 * Verifies that RAG answers are properly grounded in retrieved chunks.
 * Detects hallucinations and ensures answer completeness.
 * 
 * Key Functions:
 * - Verify all claims are supported by chunks
 * - Detect hallucinations (unsupported claims)
 * - Check answer completeness (fully addresses query)
 * - Calculate grounding confidence score
 */

import geminiClient from './geminiClient.service';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface GroundingVerificationResult {
  isWellGrounded: boolean;
  confidence: number;
  unsupportedClaims: string[];
  supportedClaims: number;
  totalClaims: number;
  completeness: number;
  recommendation: 'accept' | 'regenerate' | 'clarify';
  reasoning: string;
}

export interface GroundingCheckOptions {
  minConfidence?: number;
  requireCompleteness?: boolean;
  allowPartialAnswers?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify that answer is properly grounded in retrieved chunks
 */
export async function verifyGrounding(
  query: string,
  answer: string,
  retrievedChunks: Array<{ content: string; metadata?: any }>,
  options: GroundingCheckOptions = {}
): Promise<GroundingVerificationResult> {
  const {
    minConfidence = 0.7,
    requireCompleteness = true,
    allowPartialAnswers = false,
  } = options;

  // If no chunks, answer cannot be grounded
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      isWellGrounded: false,
      confidence: 0,
      unsupportedClaims: ['No source chunks provided'],
      supportedClaims: 0,
      totalClaims: 0,
      completeness: 0,
      recommendation: 'regenerate',
      reasoning: 'No source chunks were provided to ground the answer.',
    };
  }

  // Build verification prompt
  const verificationPrompt = buildVerificationPrompt(query, answer, retrievedChunks);

  try {
    // Call LLM to verify grounding
    const result = await geminiClient.generateContent(verificationPrompt, {
      temperature: 0.1, // Low temperature for consistent verification
      maxOutputTokens: 1000,
    });

    const verificationText = result.response?.text() || '';
    
    // Parse verification result
    const parsed = parseVerificationResult(verificationText);
    
    // Calculate final recommendation
    const recommendation = determineRecommendation(
      parsed.confidence,
      parsed.completeness,
      minConfidence,
      requireCompleteness,
      allowPartialAnswers
    );

    return {
      ...parsed,
      recommendation,
    };
  } catch (error) {
    console.error('[GroundingVerification] Error verifying grounding:', error);
    
    // Fallback: assume grounded if answer is not empty
    return {
      isWellGrounded: answer.length > 50,
      confidence: 0.5,
      unsupportedClaims: [],
      supportedClaims: 0,
      totalClaims: 0,
      completeness: 0.5,
      recommendation: 'accept',
      reasoning: 'Verification failed, accepting answer by default.',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build prompt for LLM to verify grounding
 */
function buildVerificationPrompt(
  query: string,
  answer: string,
  chunks: Array<{ content: string; metadata?: any }>
): string {
  const chunksText = chunks
    .map((chunk, i) => `[Chunk ${i + 1}]\n${chunk.content}`)
    .join('\n\n');

  return `You are a grounding verification system. Your job is to verify that an answer is properly grounded in the provided source chunks.

**User Query:**
${query}

**Generated Answer:**
${answer}

**Source Chunks:**
${chunksText}

**Your Task:**
1. Identify all factual claims in the answer
2. For each claim, check if it's supported by the source chunks
3. List any unsupported claims (hallucinations)
4. Assess if the answer fully addresses the query (completeness)
5. Calculate a grounding confidence score (0-1)

**Output Format (JSON):**
{
  "totalClaims": <number>,
  "supportedClaims": <number>,
  "unsupportedClaims": ["claim 1", "claim 2", ...],
  "confidence": <0-1>,
  "completeness": <0-1>,
  "reasoning": "<brief explanation>"
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Parse LLM verification result
 */
function parseVerificationResult(text: string): Omit<GroundingVerificationResult, 'recommendation'> {
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in verification result');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      isWellGrounded: parsed.confidence >= 0.7 && parsed.unsupportedClaims.length === 0,
      confidence: parsed.confidence || 0,
      unsupportedClaims: parsed.unsupportedClaims || [],
      supportedClaims: parsed.supportedClaims || 0,
      totalClaims: parsed.totalClaims || 0,
      completeness: parsed.completeness || 0,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('[GroundingVerification] Error parsing verification result:', error);

    // Fallback parsing
    return {
      isWellGrounded: false,
      confidence: 0.5,
      unsupportedClaims: [],
      supportedClaims: 0,
      totalClaims: 0,
      completeness: 0.5,
      reasoning: 'Failed to parse verification result',
    };
  }
}

/**
 * Determine recommendation based on verification results
 */
function determineRecommendation(
  confidence: number,
  completeness: number,
  minConfidence: number,
  requireCompleteness: boolean,
  allowPartialAnswers: boolean
): 'accept' | 'regenerate' | 'clarify' {
  // If confidence is too low, regenerate
  if (confidence < minConfidence) {
    return 'regenerate';
  }

  // If completeness is required and not met
  if (requireCompleteness && completeness < 0.7) {
    if (allowPartialAnswers) {
      return 'accept'; // Accept partial answer
    } else {
      return 'clarify'; // Ask for clarification
    }
  }

  // Otherwise, accept
  return 'accept';
}

/**
 * Quick grounding check (faster, less accurate)
 */
export async function quickGroundingCheck(
  answer: string,
  chunks: Array<{ content: string }>
): Promise<boolean> {
  // Simple heuristic: check if answer contains content from chunks
  const answerLower = answer.toLowerCase();
  const chunkWords = new Set<string>();
  
  // Extract significant words from chunks
  chunks.forEach(chunk => {
    const words = chunk.content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    words.forEach(word => chunkWords.add(word));
  });
  
  // Count how many chunk words appear in answer
  const answerWords = answerLower.match(/\b\w{4,}\b/g) || [];
  const matchCount = answerWords.filter(word => chunkWords.has(word)).length;
  const matchRatio = matchCount / Math.max(answerWords.length, 1);
  
  // If >30% of answer words come from chunks, consider it grounded
  return matchRatio > 0.3;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  verifyGrounding,
  quickGroundingCheck,
};
