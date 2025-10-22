/**
 * Grounding Service
 * Ensures AI responses are grounded in retrieved documents
 * Prevents hallucinations by requiring citations for factual claims
 * Validates that all claims have supporting evidence
 */

interface GroundingInstructions {
  prompt: string;
  citationFormat: string;
  strictMode: boolean;
}

interface GroundingValidation {
  isGrounded: boolean;
  groundingScore: number; // 0-1 (citations / claims)
  totalClaims: number;
  citedClaims: number;
  uncitedClaims: string[];
  citations: Citation[];
  warnings: string[];
}

interface Citation {
  text: string;
  source: string;
  location?: string; // Page, section, etc.
  claimSupported: string;
}

interface FactualClaim {
  text: string;
  hasCitation: boolean;
  citation?: Citation;
}

class GroundingService {
  /**
   * Add grounding instructions to prompt
   * Tells LLM to cite sources for all factual claims
   */
  addGroundingInstructions(
    basePrompt: string,
    documents: any[],
    options: {
      strictMode?: boolean;
      citationFormat?: 'inline' | 'footnote';
      language?: string;
    } = {}
  ): GroundingInstructions {
    const { strictMode = true, citationFormat = 'inline', language = 'en' } = options;

    // Build document list for reference
    const documentList = documents
      .map((doc, i) => `${i + 1}. "${doc.name || doc.title || 'Document ' + (i + 1)}"`)
      .join('\n');

    const citationFormatInstruction =
      citationFormat === 'inline'
        ? '[Source: Document Name, Page X]'
        : '[1], [2], [3] with footnotes at end';

    const groundingInstructions = `
${basePrompt}

═══════════════════════════════════════════════════════
CRITICAL GROUNDING REQUIREMENTS
═══════════════════════════════════════════════════════

You have access to the following documents:
${documentList}

MANDATORY RULES:
1. For EVERY factual claim, you MUST add an inline citation immediately after the claim
   Format: ${citationFormatInstruction}
   Example: "Koda's target market is SMBs in Brazil [Source: Market Analysis, Page 3]."

2. If information is NOT in the provided documents, you MUST say:
   "I don't have this information in the available documents."
   ${strictMode ? '⚠️ NEVER make up or infer information not explicitly stated in documents.' : ''}

3. Citations must include:
   - Document name (exact)
   - Page number or section (if available)
   - Be placed IMMEDIATELY after the claim

4. Do NOT cite general knowledge or common facts (e.g., "Python is a programming language")
   Only cite specific information from the provided documents.

5. If multiple documents support a claim, cite all: [Source: Doc1, p.2; Doc2, p.5]

${strictMode ? `
STRICT MODE ENABLED:
- You will be penalized for unsupported claims
- If uncertain, explicitly state: "Based on [Source], it suggests..."
- Prefer saying "I don't know" over making unsupported inferences
` : ''}

═══════════════════════════════════════════════════════
`.trim();

    console.log(`📌 Added grounding instructions (${strictMode ? 'strict' : 'normal'} mode)`);
    console.log(`   Citation format: ${citationFormat}`);
    console.log(`   Documents available: ${documents.length}`);

    return {
      prompt: groundingInstructions,
      citationFormat: citationFormatInstruction,
      strictMode
    };
  }

  /**
   * Validate that response is properly grounded
   * Checks that all factual claims have citations
   */
  validateGrounding(
    response: string,
    documents: any[],
    options: {
      minGroundingScore?: number;
      strictMode?: boolean;
    } = {}
  ): GroundingValidation {
    const { minGroundingScore = 0.8, strictMode = true } = options;

    console.log('🔍 Validating grounding...');

    // Extract citations from response
    const citations = this.extractCitations(response);
    console.log(`   Found ${citations.length} citations`);

    // Extract factual claims
    const claims = this.extractFactualClaims(response);
    console.log(`   Found ${claims.length} factual claims`);

    // Match citations to claims
    const { citedClaims, uncitedClaims } = this.matchCitationsToClaims(
      claims,
      citations
    );

    // Calculate grounding score
    const groundingScore =
      claims.length > 0 ? citedClaims.length / claims.length : 1.0;

    // Generate warnings
    const warnings: string[] = [];

    if (groundingScore < minGroundingScore) {
      warnings.push(
        `Low grounding score: ${(groundingScore * 100).toFixed(1)}% (threshold: ${(minGroundingScore * 100).toFixed(1)}%)`
      );
    }

    if (uncitedClaims.length > 0) {
      warnings.push(
        `${uncitedClaims.length} factual claim(s) without citations`
      );
    }

    // Validate citations reference actual documents
    const invalidCitations = this.validateCitationReferences(
      citations,
      documents
    );

    if (invalidCitations.length > 0) {
      warnings.push(
        `${invalidCitations.length} citation(s) reference non-existent documents`
      );
    }

    const isGrounded = strictMode
      ? groundingScore >= minGroundingScore && uncitedClaims.length === 0
      : groundingScore >= minGroundingScore * 0.8; // More lenient

    console.log(`   Grounding score: ${(groundingScore * 100).toFixed(1)}%`);
    console.log(`   Status: ${isGrounded ? '✅ Grounded' : '❌ Not grounded'}`);

    if (warnings.length > 0) {
      warnings.forEach(w => console.log(`   ⚠️ ${w}`));
    }

    return {
      isGrounded,
      groundingScore,
      totalClaims: claims.length,
      citedClaims: citedClaims.length,
      uncitedClaims,
      citations,
      warnings
    };
  }

  /**
   * Extract citations from response
   * Finds all [Source: ...] patterns
   */
  private extractCitations(response: string): Citation[] {
    const citations: Citation[] = [];

    // Pattern: [Source: Document Name, Page X]
    // Pattern: [Source: Document Name]
    // Pattern: [Source: Document Name, Section Y]
    const citationPattern = /\[Source:\s*([^\],]+?)(?:,\s*(?:Page|p\.|Section)\s*([^\]]+))?\]/gi;

    let match;
    while ((match = citationPattern.exec(response)) !== null) {
      const fullText = match[0];
      const source = match[1].trim();
      const location = match[2]?.trim();

      // Find the claim this citation supports (preceding sentence)
      const textBeforeCitation = response.substring(0, match.index);
      const lastSentenceMatch = textBeforeCitation.match(/([^.!?]+)[.!?]\s*$/);
      const claimSupported = lastSentenceMatch
        ? lastSentenceMatch[1].trim()
        : '';

      citations.push({
        text: fullText,
        source,
        location,
        claimSupported
      });
    }

    return citations;
  }

  /**
   * Extract factual claims from response
   * Identifies sentences that make specific assertions
   */
  private extractFactualClaims(response: string): string[] {
    const claims: string[] = [];

    // Split into sentences
    const sentences = response
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Ignore very short sentences

    for (const sentence of sentences) {
      // Skip if sentence is:
      // - A question
      // - A greeting/closing
      // - A meta-statement about the response itself
      // - General knowledge (difficult to detect, but we try)

      if (this.isQuestion(sentence)) continue;
      if (this.isMetaStatement(sentence)) continue;
      if (this.isGreetingOrClosing(sentence)) continue;

      // Consider it a factual claim if it:
      // - Makes a specific assertion
      // - Contains numbers, dates, names, or specific terms
      if (this.isFactualClaim(sentence)) {
        claims.push(sentence);
      }
    }

    return claims;
  }

  /**
   * Match citations to claims
   */
  private matchCitationsToClaims(
    claims: string[],
    citations: Citation[]
  ): { citedClaims: string[]; uncitedClaims: string[] } {
    const citedClaims: string[] = [];
    const uncitedClaims: string[] = [];

    for (const claim of claims) {
      // Check if this claim has a citation nearby
      const hasCitation = citations.some(citation => {
        // Citation's supported claim should match or be very similar
        return (
          citation.claimSupported.includes(claim.substring(0, 50)) ||
          claim.includes(citation.claimSupported.substring(0, 50))
        );
      });

      if (hasCitation) {
        citedClaims.push(claim);
      } else {
        uncitedClaims.push(claim);
      }
    }

    return { citedClaims, uncitedClaims };
  }

  /**
   * Validate that citations reference actual documents
   */
  private validateCitationReferences(
    citations: Citation[],
    documents: any[]
  ): Citation[] {
    const documentNames = documents.map(
      doc =>
        (doc.name || doc.title || '').toLowerCase().trim()
    );

    const invalidCitations: Citation[] = [];

    for (const citation of citations) {
      const citedDocName = citation.source.toLowerCase().trim();

      // Check if cited document exists
      const exists = documentNames.some(docName =>
        citedDocName.includes(docName) || docName.includes(citedDocName)
      );

      if (!exists) {
        invalidCitations.push(citation);
      }
    }

    return invalidCitations;
  }

  /**
   * Heuristics to detect factual claims
   */
  private isFactualClaim(sentence: string): boolean {
    const lowerSentence = sentence.toLowerCase();

    // Contains specific indicators of factual claims
    const factualIndicators = [
      /\d+/, // Numbers
      /\d{4}/, // Years
      /\b(is|are|was|were|has|have|had)\b/, // State-of-being verbs
      /\b(percent|percentage|million|billion|thousand)\b/,
      /\b(according to|based on|shows that|indicates that)\b/,
      /\b(target|market|revenue|customer|product|service)\b/, // Business terms
      /\b(icp|tam|sam|som|arr|mrr)\b/i // Acronyms
    ];

    return factualIndicators.some(pattern => pattern.test(lowerSentence));
  }

  private isQuestion(sentence: string): boolean {
    return sentence.includes('?') || /^(what|how|why|when|where|who|which)/i.test(sentence);
  }

  private isMetaStatement(sentence: string): boolean {
    const metaPatterns = [
      /based on (the|your) documents/i,
      /i (found|see|notice|understand)/i,
      /let me (explain|tell|show)/i,
      /here (is|are)/i,
      /the documents (show|indicate|suggest)/i
    ];

    return metaPatterns.some(pattern => pattern.test(sentence));
  }

  private isGreetingOrClosing(sentence: string): boolean {
    const greetingPatterns = [
      /^(hello|hi|hey|greetings)/i,
      /^(thanks|thank you|appreciate)/i,
      /^(hope this helps|let me know|feel free)/i,
      /^(is there anything else|can i help)/i
    ];

    return greetingPatterns.some(pattern => pattern.test(sentence));
  }

  /**
   * Generate grounding report for logging
   */
  generateGroundingReport(validation: GroundingValidation): string {
    const status = validation.isGrounded ? '✅ GROUNDED' : '❌ NOT GROUNDED';

    let report = `
═══════════════════════════════════════════════════════
GROUNDING VALIDATION REPORT
═══════════════════════════════════════════════════════
Status: ${status}
Grounding Score: ${(validation.groundingScore * 100).toFixed(1)}%

Claims Analysis:
  Total claims: ${validation.totalClaims}
  Cited claims: ${validation.citedClaims}
  Uncited claims: ${validation.uncitedClaims.length}

Citations:
  Total citations: ${validation.citations.length}
`;

    if (validation.uncitedClaims.length > 0) {
      report += `\n⚠️ Uncited Claims:\n`;
      validation.uncitedClaims.slice(0, 5).forEach((claim, i) => {
        report += `  ${i + 1}. "${claim.substring(0, 80)}..."\n`;
      });
    }

    if (validation.warnings.length > 0) {
      report += `\n⚠️ Warnings:\n`;
      validation.warnings.forEach(w => {
        report += `  - ${w}\n`;
      });
    }

    report += `═══════════════════════════════════════════════════════`;

    return report.trim();
  }

  /**
   * Auto-correct response by adding missing citations
   * Uses LLM to identify which documents support uncited claims
   */
  async autoCorrectGrounding(
    response: string,
    documents: any[],
    validation: GroundingValidation
  ): Promise<string> {
    if (validation.isGrounded) {
      return response; // Already grounded
    }

    console.log('🔧 Auto-correcting grounding...');

    // For each uncited claim, try to find supporting document
    let correctedResponse = response;

    for (const uncitedClaim of validation.uncitedClaims) {
      // Search for claim in documents
      const supportingDoc = this.findSupportingDocument(uncitedClaim, documents);

      if (supportingDoc) {
        // Add citation after the claim
        const citation = ` [Source: ${supportingDoc.name}]`;
        correctedResponse = correctedResponse.replace(
          uncitedClaim,
          uncitedClaim + citation
        );

        console.log(`   ✅ Added citation for: "${uncitedClaim.substring(0, 50)}..."`);
      } else {
        console.log(`   ⚠️ Could not find source for: "${uncitedClaim.substring(0, 50)}..."`);
      }
    }

    return correctedResponse;
  }

  /**
   * Find document that supports a claim
   * Simple keyword matching (could be improved with semantic search)
   */
  private findSupportingDocument(claim: string, documents: any[]): any | null {
    const claimKeywords = claim
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4); // Only significant words

    let bestMatch: any = null;
    let bestScore = 0;

    for (const doc of documents) {
      const docText = (doc.content || doc.text || '').toLowerCase();

      // Count keyword matches
      let score = 0;
      for (const keyword of claimKeywords) {
        if (docText.includes(keyword)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = doc;
      }
    }

    // Require at least 30% keyword overlap
    const overlapRatio = bestScore / claimKeywords.length;
    return overlapRatio >= 0.3 ? bestMatch : null;
  }

  /**
   * Test grounding validation
   */
  async testGroundingValidation(): Promise<void> {
    console.log('🧪 Testing grounding validation...\n');

    const testDocuments = [
      { name: 'Market Analysis', content: 'Koda targets SMBs in Brazil' },
      { name: 'Product Roadmap', content: 'Q1 2024: Launch v2.0' }
    ];

    const testCases = [
      {
        name: 'Well-grounded response',
        response:
          'Koda targets SMBs in Brazil [Source: Market Analysis]. The company plans to launch v2.0 in Q1 2024 [Source: Product Roadmap].',
        expectedGrounded: true
      },
      {
        name: 'Partially grounded',
        response:
          'Koda targets SMBs in Brazil [Source: Market Analysis]. The company has 500 employees.', // Second claim uncited
        expectedGrounded: false
      },
      {
        name: 'Not grounded',
        response: 'Koda targets SMBs in Brazil. The company has 500 employees.', // No citations
        expectedGrounded: false
      }
    ];

    for (const testCase of testCases) {
      console.log(`Test: ${testCase.name}`);

      const validation = this.validateGrounding(testCase.response, testDocuments, {
        minGroundingScore: 0.8,
        strictMode: true
      });

      console.log(`  Expected: ${testCase.expectedGrounded ? 'Grounded' : 'Not grounded'}`);
      console.log(`  Actual: ${validation.isGrounded ? 'Grounded' : 'Not grounded'}`);
      console.log(`  Score: ${(validation.groundingScore * 100).toFixed(1)}%`);
      console.log(
        `  Result: ${validation.isGrounded === testCase.expectedGrounded ? '✅ PASS' : '❌ FAIL'}\n`
      );
    }
  }
}

export default new GroundingService();
export { GroundingService, GroundingValidation, Citation, GroundingInstructions };
