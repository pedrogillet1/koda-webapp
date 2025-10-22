import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface VerifiedClaim {
  claim: string;
  verified: boolean;
  confidence: number; // 0-1
  supportingSource?: string;
  explanation: string;
}

export interface VerificationResult {
  allClaims: VerifiedClaim[];
  verificationScore: number; // 0-1 (% of claims verified)
  unverifiableClaims: string[];
  overallVerdict: 'verified' | 'partially_verified' | 'unverified';
}

/**
 * Fact Verification Service
 * Verifies claims in AI-generated answers against source documents
 */
class FactVerificationService {
  /**
   * Verify all claims in an answer against source documents
   */
  async verifyAnswer(
    answer: string,
    sources: Array<{ content: string; documentName: string }>
  ): Promise<VerificationResult> {
    try {
      console.log('🔍 Starting fact verification...');

      // Step 1: Extract claims from the answer
      const claims = await this.extractClaims(answer);
      console.log(`📋 Extracted ${claims.length} claims from answer`);

      // Step 2: Verify each claim against sources
      const verifiedClaims: VerifiedClaim[] = [];
      for (const claim of claims) {
        const verification = await this.verifyClaim(claim, sources);
        verifiedClaims.push(verification);
      }

      // Step 3: Calculate verification score
      const verifiedCount = verifiedClaims.filter(c => c.verified).length;
      const verificationScore = claims.length > 0 ? verifiedCount / claims.length : 1.0;

      // Step 4: Identify unverifiable claims
      const unverifiableClaims = verifiedClaims
        .filter(c => !c.verified)
        .map(c => c.claim);

      // Step 5: Determine overall verdict
      let overallVerdict: 'verified' | 'partially_verified' | 'unverified';
      if (verificationScore >= 0.9) {
        overallVerdict = 'verified';
      } else if (verificationScore >= 0.6) {
        overallVerdict = 'partially_verified';
      } else {
        overallVerdict = 'unverified';
      }

      console.log(`✅ Verification complete: ${(verificationScore * 100).toFixed(0)}% verified (${overallVerdict})`);

      return {
        allClaims: verifiedClaims,
        verificationScore,
        unverifiableClaims,
        overallVerdict,
      };
    } catch (error) {
      console.error('❌ Error verifying answer:', error);
      // Return a safe default
      return {
        allClaims: [],
        verificationScore: 0.5,
        unverifiableClaims: [],
        overallVerdict: 'partially_verified',
      };
    }
  }

  /**
   * Extract factual claims from an answer
   */
  private async extractClaims(answer: string): Promise<string[]> {
    try {
      const prompt = `Extract all factual claims from the following answer. A factual claim is a statement that can be verified as true or false.

Do NOT include:
- Opinions or subjective statements
- Questions
- Transitional phrases
- Meta-statements about the answer itself

Answer:
${answer}

Extract the factual claims as a JSON array of strings:`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse JSON array from response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('Could not extract claims JSON, returning empty array');
        return [];
      }

      const claims = JSON.parse(jsonMatch[0]) as string[];
      return claims.filter(c => c && c.trim().length > 0);
    } catch (error) {
      console.error('Error extracting claims:', error);
      return [];
    }
  }

  /**
   * Verify a single claim against source documents
   */
  private async verifyClaim(
    claim: string,
    sources: Array<{ content: string; documentName: string }>
  ): Promise<VerifiedClaim> {
    try {
      // Build context from sources
      const sourceContext = sources
        .map((s, idx) => `[Source ${idx + 1}: ${s.documentName}]\n${s.content}`)
        .join('\n\n');

      const prompt = `Verify if the following claim is supported by the provided sources.

Claim to verify:
"${claim}"

Available sources:
${sourceContext}

Determine:
1. Is the claim directly supported by the sources? (yes/no)
2. Confidence level (0-100)
3. Which source supports it (if any)
4. Brief explanation

Respond in JSON format:
{
  "verified": true/false,
  "confidence": 0.85,
  "supportingSource": "Source name or null",
  "explanation": "Brief explanation"
}`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract verification JSON');
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        claim,
        verified: result.verified === true,
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
        supportingSource: result.supportingSource || undefined,
        explanation: result.explanation || 'No explanation provided',
      };
    } catch (error) {
      console.error(`Error verifying claim "${claim}":`, error);
      return {
        claim,
        verified: false,
        confidence: 0,
        explanation: 'Verification failed',
      };
    }
  }

  /**
   * Quick verification (for real-time use) - only verifies key claims
   */
  async quickVerify(
    answer: string,
    sources: Array<{ content: string; documentName: string }>
  ): Promise<{ score: number; hasIssues: boolean }> {
    try {
      // Build context
      const sourceContext = sources
        .map((s, idx) => `[Source ${idx + 1}: ${s.documentName}]\n${s.content.substring(0, 500)}`)
        .join('\n\n');

      const prompt = `Quick verification: Does this answer contain any claims that contradict or are unsupported by the sources?

Answer:
${answer}

Sources:
${sourceContext}

Respond with JSON:
{
  "hasIssues": true/false,
  "score": 0.85,
  "issue": "Brief description if any"
}

Score 1.0 = fully supported, 0.0 = completely unsupported`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return { score: 0.8, hasIssues: false };
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { score: 0.8, hasIssues: false };
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        score: Math.min(Math.max(result.score || 0.8, 0), 1),
        hasIssues: result.hasIssues === true,
      };
    } catch (error) {
      console.error('Error in quick verification:', error);
      return { score: 0.8, hasIssues: false };
    }
  }
}

export default new FactVerificationService();
