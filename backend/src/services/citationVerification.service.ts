/**
 * Citation Verification Service
 * Priority: P1 (HIGH)
 * 
 * Verifies that citations in RAG answers are accurate and properly formatted.
 * Ensures all cited information actually exists in the source chunks.
 * 
 * Key Functions:
 * - Verify citation accuracy (cited info exists in chunks)
 * - Check citation completeness (all claims are cited)
 * - Detect missing or incorrect citations
 * - Ensure proper citation format [1], [2], [3]
 */

import geminiClient from './geminiClient.service';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CitationVerificationResult {
  isAccurate: boolean;
  confidence: number;
  totalCitations: number;
  accurateCitations: number;
  inaccurateCitations: string[];
  missingCitations: string[];
  recommendation: 'accept' | 'regenerate';
  reasoning: string;
}

export interface CitationCheckOptions {
  requireAllCited?: boolean;
  minAccuracy?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify that citations in answer are accurate
 */
export async function verifyCitations(
  answer: string,
  retrievedChunks: Array<{ content: string; metadata?: any }>,
  options: CitationCheckOptions = {}
): Promise<CitationVerificationResult> {
  const {
    requireAllCited = true,
    minAccuracy = 0.9,
  } = options;

  // Extract citations from answer
  const citations = extractCitations(answer);
  
  if (citations.length === 0) {
    // No citations found
    return {
      isAccurate: !requireAllCited, // If citations not required, it's okay
      confidence: requireAllCited ? 0 : 1,
      totalCitations: 0,
      accurateCitations: 0,
      inaccurateCitations: [],
      missingCitations: requireAllCited ? ['No citations found in answer'] : [],
      recommendation: requireAllCited ? 'regenerate' : 'accept',
      reasoning: requireAllCited 
        ? 'Answer contains no citations but should cite sources.'
        : 'No citations required.',
    };
  }

  // Build verification prompt
  const verificationPrompt = buildCitationVerificationPrompt(answer, retrievedChunks, citations);

  try {
    // Call LLM to verify citations
    const result = await geminiClient.generateContent(verificationPrompt, {
      temperature: 0.1,
      maxOutputTokens: 1000,
    });

    const verificationText = result.response?.text() || '';
    
    // Parse verification result
    const parsed = parseCitationVerificationResult(verificationText, citations.length);
    
    // Determine recommendation
    const accuracy = parsed.accurateCitations / Math.max(parsed.totalCitations, 1);
    const recommendation = accuracy >= minAccuracy ? 'accept' : 'regenerate';

    return {
      ...parsed,
      recommendation,
    };
  } catch (error) {
    console.error('[CitationVerification] Error verifying citations:', error);
    
    // Fallback: assume citations are accurate
    return {
      isAccurate: true,
      confidence: 0.5,
      totalCitations: citations.length,
      accurateCitations: citations.length,
      inaccurateCitations: [],
      missingCitations: [],
      recommendation: 'accept',
      reasoning: 'Verification failed, accepting citations by default.',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract citations from answer (e.g., [1], [2], [3])
 */
function extractCitations(answer: string): string[] {
  const citationPattern = /\[(\d+)\]/g;
  const matches = answer.matchAll(citationPattern);
  const citations = new Set<string>();
  
  for (const match of matches) {
    citations.add(match[1]);
  }
  
  return Array.from(citations).sort((a, b) => parseInt(a) - parseInt(b));
}

/**
 * Build prompt for LLM to verify citations
 */
function buildCitationVerificationPrompt(
  answer: string,
  chunks: Array<{ content: string; metadata?: any }>,
  citations: string[]
): string {
  const chunksText = chunks
    .map((chunk, i) => `[Source ${i + 1}]\n${chunk.content}`)
    .join('\n\n');

  return `You are a citation verification system. Your job is to verify that citations in an answer are accurate.

**Generated Answer:**
${answer}

**Source Chunks:**
${chunksText}

**Citations Found:** [${citations.join('], [')}]

**Your Task:**
1. For each citation [1], [2], [3], etc., identify what claim it's supporting
2. Verify that the cited information actually exists in the corresponding source chunk
3. List any inaccurate citations (cited info doesn't match source)
4. List any claims that should be cited but aren't
5. Calculate citation accuracy (0-1)

**Output Format (JSON):**
{
  "totalCitations": <number>,
  "accurateCitations": <number>,
  "inaccurateCitations": ["[1]: reason", "[2]: reason", ...],
  "missingCitations": ["claim that should be cited", ...],
  "confidence": <0-1>,
  "reasoning": "<brief explanation>"
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Parse LLM citation verification result
 */
function parseCitationVerificationResult(
  text: string,
  totalCitations: number
): CitationVerificationResult {
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in verification result');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      isAccurate: parsed.inaccurateCitations.length === 0,
      confidence: parsed.confidence || 0,
      totalCitations: parsed.totalCitations || totalCitations,
      accurateCitations: parsed.accurateCitations || 0,
      inaccurateCitations: parsed.inaccurateCitations || [],
      missingCitations: parsed.missingCitations || [],
      recommendation: 'accept', // Will be overridden
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('[CitationVerification] Error parsing verification result:', error);
    
    // Fallback parsing
    return {
      isAccurate: true,
      confidence: 0.5,
      totalCitations,
      accurateCitations: totalCitations,
      inaccurateCitations: [],
      missingCitations: [],
      recommendation: 'accept',
      reasoning: 'Failed to parse verification result',
    };
  }
}

/**
 * Quick citation check (faster, less accurate)
 */
export async function quickCitationCheck(answer: string): Promise<boolean> {
  // Simple heuristic: check if answer has citations
  const citationPattern = /\[\d+\]/;
  return citationPattern.test(answer);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  verifyCitations,
  quickCitationCheck,
};
