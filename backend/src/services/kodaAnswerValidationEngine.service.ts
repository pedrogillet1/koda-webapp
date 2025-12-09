/**
 * Koda Answer Validation Engine (Layer 2)
 *
 * This is the ONLY service responsible for ALL validation and quality checks.
 * Replaces: contradictionDetection, validation, responseValidation,
 *           citationTracking, citationValidation, groundingVerification,
 *           toneValidator, answerFormatValidator, and all other validation services.
 *
 * Architecture: Mimics ChatGPT's safety layer + validator
 */

interface ValidationContext {
  query: string;
  intent?: string;
  documents?: Array<{ id: string; name: string; content?: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  userId?: string;
  language?: string;
}

interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  corrections: string[];
  metadata: {
    hallucinationScore: number;
    citationAccuracy: number;
    completeness: number;
    toneConsistency: number;
    personaCompliance: number;
  };
}

interface ValidationIssue {
  type: 'hallucination' | 'citation' | 'contradiction' | 'incomplete' | 'tone' | 'persona' | 'safety';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
  suggestion?: string;
}

class KodaAnswerValidationEngine {
  private readonly QUALITY_THRESHOLD = 70; // Minimum score to pass

  // Phrases that break the Koda persona
  private readonly FORBIDDEN_PHRASES = [
    'as an AI',
    'I am an AI',
    'I am a language model',
    'I am ChatGPT',
    'I am GPT',
    'I am Claude',
    'I cannot access',
    "I don't have access",
    'como uma IA',
    'sou uma IA',
    'sou um modelo de linguagem',
    'não tenho acesso',
    'como um modelo',
    'as a language model',
    'my training data',
    'meus dados de treinamento',
  ];

  // Positive Koda persona indicators
  private readonly POSITIVE_PERSONA_INDICATORS = [
    'i can help',
    'let me',
    'posso ajudar',
    'posso te ajudar',
    'posso fornecer',
    'vou analisar',
    'vou verificar',
    'encontrei',
    'nos seus documentos',
    'in your documents',
  ];

  /**
   * MAIN ENTRY POINT
   * This is the ONLY function that should be called from outside
   */
  public async validateAnswer(
    answer: string,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Step 1: Check for hallucinations
    const hallucinationScore = await this.checkHallucinations(answer, context);
    if (hallucinationScore < 70) {
      issues.push({
        type: 'hallucination',
        severity: 'high',
        description: 'Answer may contain hallucinated information',
        suggestion: 'Verify all facts against source documents',
      });
    }

    // Step 2: Verify citations
    const citationAccuracy = this.verifyCitations(answer, context);
    if (citationAccuracy < 80 && context.documents && context.documents.length > 0) {
      issues.push({
        type: 'citation',
        severity: 'medium',
        description: 'Citations may be inaccurate or missing',
        suggestion: 'Add proper citations for all claims',
      });
    }

    // Step 3: Check for contradictions
    const contradictions = this.detectContradictions(answer, context);
    issues.push(...contradictions);

    // Step 4: Check completeness
    const completeness = this.checkCompleteness(answer, context);
    if (completeness < 70) {
      issues.push({
        type: 'incomplete',
        severity: 'medium',
        description: 'Answer may not fully address the query',
        suggestion: 'Ensure all aspects of the question are answered',
      });
    }

    // Step 5: Check tone consistency
    const toneConsistency = this.checkToneConsistency(answer, context);
    if (toneConsistency < 80) {
      issues.push({
        type: 'tone',
        severity: 'low',
        description: 'Tone is inconsistent',
        suggestion: 'Maintain consistent professional tone',
      });
    }

    // Step 6: Check persona compliance (CRITICAL)
    const personaCompliance = this.checkPersonaCompliance(answer);
    if (personaCompliance < 90) {
      issues.push({
        type: 'persona',
        severity: 'critical',
        description: 'Answer breaks Koda persona',
        suggestion: 'Remove AI self-references and maintain Koda identity',
      });
    }

    // Step 7: Safety check
    const safetyIssues = this.checkSafety(answer);
    issues.push(...safetyIssues);

    // Calculate overall score
    const score = this.calculateOverallScore({
      hallucinationScore,
      citationAccuracy,
      completeness,
      toneConsistency,
      personaCompliance,
    });

    // Generate corrections if needed
    const corrections = this.generateCorrections(answer, issues);

    return {
      isValid: score >= this.QUALITY_THRESHOLD && !issues.some(i => i.severity === 'critical'),
      score,
      issues,
      corrections,
      metadata: {
        hallucinationScore,
        citationAccuracy,
        completeness,
        toneConsistency,
        personaCompliance,
      },
    };
  }

  /**
   * Quick validation for streaming - lightweight check
   */
  public quickValidate(chunk: string): { isValid: boolean; issue?: string } {
    // Only check for critical persona violations during streaming
    const chunkLower = chunk.toLowerCase();

    for (const phrase of this.FORBIDDEN_PHRASES) {
      if (chunkLower.includes(phrase.toLowerCase())) {
        return {
          isValid: false,
          issue: `Contains forbidden phrase: "${phrase}"`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Step 1: Check for hallucinations
   * Verify that factual claims are grounded in source documents
   */
  private async checkHallucinations(
    answer: string,
    context: ValidationContext
  ): Promise<number> {
    // If no documents provided, can't verify (assume valid for general queries)
    if (!context.documents || context.documents.length === 0) {
      return 100;
    }

    // Extract factual claims from answer
    const claims = this.extractFactualClaims(answer);

    if (claims.length === 0) {
      return 100; // No claims to verify
    }

    // Verify each claim against documents
    let verifiedClaims = 0;

    for (const claim of claims) {
      const isGrounded = this.isClaimGrounded(claim, context.documents);
      if (isGrounded) {
        verifiedClaims++;
      }
    }

    // Return percentage of verified claims
    return Math.round((verifiedClaims / claims.length) * 100);
  }

  /**
   * Extract factual claims from answer
   */
  private extractFactualClaims(answer: string): string[] {
    const claims: string[] = [];

    // Extract sentences with numbers, dates, or specific data
    const sentences = answer.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

    for (const sentence of sentences) {
      // Check if sentence contains factual information
      const hasNumber = /\d/.test(sentence);
      const hasDate = /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(sentence);
      const hasCurrency = /[R$€£]\s*\d/.test(sentence);
      const hasPercentage = /\d+%/.test(sentence);

      if (hasNumber || hasDate || hasCurrency || hasPercentage) {
        claims.push(sentence);
      }
    }

    return claims;
  }

  /**
   * Check if a claim is grounded in source documents
   */
  private isClaimGrounded(claim: string, documents: Array<{ content?: string }>): boolean {
    // Extract key terms from claim (words longer than 3 chars)
    const keyTerms = claim
      .toLowerCase()
      .replace(/[^\w\sÀ-ÿ]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    if (keyTerms.length === 0) return true; // Can't verify

    // Check if key terms appear in any document
    for (const doc of documents) {
      if (!doc.content) continue;

      const docContent = doc.content.toLowerCase();
      let matchCount = 0;

      for (const term of keyTerms) {
        if (docContent.includes(term)) {
          matchCount++;
        }
      }

      // If more than 50% of key terms match, consider grounded
      if (matchCount / keyTerms.length > 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Step 2: Verify citations
   * Check that document references are accurate
   */
  private verifyCitations(answer: string, context: ValidationContext): number {
    // Extract document citations from answer
    const citations = this.extractCitations(answer);

    if (citations.length === 0) {
      return 100; // No citations to verify
    }

    if (!context.documents || context.documents.length === 0) {
      return 50; // Can't verify without documents
    }

    // Verify each citation
    let validCitations = 0;

    for (const citation of citations) {
      const isValid = this.isCitationValid(citation, context.documents);
      if (isValid) {
        validCitations++;
      }
    }

    return Math.round((validCitations / citations.length) * 100);
  }

  /**
   * Extract document citations from answer
   */
  private extractCitations(answer: string): string[] {
    const citations: string[] = [];

    // Match document names with extensions
    const docPattern = /\b([A-Za-z0-9_\-À-ÿ]+(?:[_\-\s][A-Za-z0-9_\-À-ÿ]+)*\.(?:pdf|docx?|xlsx?|pptx?|txt|csv))\b/gi;
    let match;

    while ((match = docPattern.exec(answer)) !== null) {
      citations.push(match[1]);
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  /**
   * Check if citation is valid (matches a real document)
   */
  private isCitationValid(citation: string, documents: Array<{ name: string }>): boolean {
    const citationLower = citation.toLowerCase();

    return documents.some(doc => {
      const docNameLower = doc.name.toLowerCase();
      return (
        docNameLower.includes(citationLower) ||
        citationLower.includes(docNameLower) ||
        this.calculateSimilarity(citationLower, docNameLower) > 0.8
      );
    });
  }

  /**
   * Calculate string similarity (Jaccard index)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/[\s_\-]+/);
    const words2 = str2.split(/[\s_\-]+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Step 3: Detect contradictions
   * Check for internal contradictions or contradictions with context
   */
  private detectContradictions(answer: string, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Extract sentences
    const sentences = answer.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

    // Check for internal contradictions
    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        if (this.areContradictory(sentences[i], sentences[j])) {
          issues.push({
            type: 'contradiction',
            severity: 'high',
            description: 'Internal contradiction detected',
            location: `"${sentences[i].substring(0, 50)}..." vs "${sentences[j].substring(0, 50)}..."`,
            suggestion: 'Resolve contradictory statements',
          });
        }
      }
    }

    // Check for contradictions with conversation history
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const previousAssistantMessages = context.conversationHistory
        .filter(msg => msg.role === 'assistant')
        .slice(-3); // Check last 3 assistant messages

      for (const message of previousAssistantMessages) {
        const historySentences = message.content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

        for (const currentSentence of sentences) {
          for (const historySentence of historySentences) {
            if (this.areContradictory(currentSentence, historySentence)) {
              issues.push({
                type: 'contradiction',
                severity: 'medium',
                description: 'Contradiction with previous answer',
                location: `Current: "${currentSentence.substring(0, 40)}..."`,
                suggestion: 'Ensure consistency with previous answers',
              });
              break; // Only report one contradiction per sentence
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check if two sentences are contradictory
   */
  private areContradictory(sentence1: string, sentence2: string): boolean {
    // Look for opposite terms
    const opposites: Array<[string, string]> = [
      ['yes', 'no'],
      ['sim', 'não'],
      ['true', 'false'],
      ['verdadeiro', 'falso'],
      ['increase', 'decrease'],
      ['aumentar', 'diminuir'],
      ['more', 'less'],
      ['mais', 'menos'],
      ['higher', 'lower'],
      ['maior', 'menor'],
      ['positive', 'negative'],
      ['positivo', 'negativo'],
      ['always', 'never'],
      ['sempre', 'nunca'],
    ];

    const s1Lower = sentence1.toLowerCase();
    const s2Lower = sentence2.toLowerCase();

    // Check if sentences contain opposite terms about the same subject
    for (const [term1, term2] of opposites) {
      if ((s1Lower.includes(term1) && s2Lower.includes(term2)) ||
          (s1Lower.includes(term2) && s2Lower.includes(term1))) {
        // Check if they're talking about the same subject
        const commonWords = this.getCommonWords(s1Lower, s2Lower);
        if (commonWords.length >= 2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get common words between two sentences
   */
  private getCommonWords(sentence1: string, sentence2: string): string[] {
    const words1 = sentence1.split(/\s+/).filter(w => w.length > 4);
    const words2 = sentence2.split(/\s+/).filter(w => w.length > 4);

    return words1.filter(w => words2.includes(w));
  }

  /**
   * Step 4: Check completeness
   * Verify that the answer addresses the query
   */
  private checkCompleteness(answer: string, context: ValidationContext): number {
    // Extract key aspects from query
    const queryAspects = this.extractQueryAspects(context.query);

    if (queryAspects.length === 0) {
      return 100; // Can't determine aspects
    }

    // Check how many aspects are addressed in answer
    let addressedAspects = 0;
    const answerLower = answer.toLowerCase();

    for (const aspect of queryAspects) {
      if (answerLower.includes(aspect.toLowerCase())) {
        addressedAspects++;
      }
    }

    return Math.round((addressedAspects / queryAspects.length) * 100);
  }

  /**
   * Extract key aspects from query
   */
  private extractQueryAspects(query: string): string[] {
    const aspects: string[] = [];

    // Extract key nouns (words > 4 chars that aren't question words)
    const questionWords = [
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'please',
      'qual', 'como', 'por', 'quando', 'onde', 'quem', 'você', 'pode', 'poderia', 'favor',
    ];

    const words = query.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 4 && !questionWords.includes(word)) {
        aspects.push(word);
      }
    }

    return aspects.slice(0, 5); // Limit to 5 main aspects
  }

  /**
   * Step 5: Check tone consistency
   * Verify appropriate professional tone
   */
  private checkToneConsistency(answer: string, context: ValidationContext): number {
    const answerLower = answer.toLowerCase();

    // Check for casual indicators (negative)
    const casualIndicators = ['yeah', 'nah', 'gonna', 'wanna', 'kinda', 'sorta', 'tipo assim', 'né'];
    let casualCount = 0;
    for (const indicator of casualIndicators) {
      if (answerLower.includes(indicator)) casualCount++;
    }

    // Check for professional indicators (positive)
    const professionalIndicators = [
      'however', 'therefore', 'additionally', 'furthermore', 'consequently',
      'no entanto', 'portanto', 'além disso', 'consequentemente', 'conforme',
    ];
    let professionalCount = 0;
    for (const indicator of professionalIndicators) {
      if (answerLower.includes(indicator)) professionalCount++;
    }

    // Calculate score
    let score = 100;
    score -= casualCount * 15; // Penalize casual language
    score += Math.min(professionalCount * 5, 10); // Bonus for professional language (max +10)

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Step 6: Check persona compliance
   * Verify that answer maintains Koda persona
   */
  private checkPersonaCompliance(answer: string): number {
    const answerLower = answer.toLowerCase();

    // Check for forbidden phrases (critical failure)
    for (const phrase of this.FORBIDDEN_PHRASES) {
      if (answerLower.includes(phrase.toLowerCase())) {
        return 0; // Critical failure
      }
    }

    // Check for positive indicators
    let positiveCount = 0;
    for (const indicator of this.POSITIVE_PERSONA_INDICATORS) {
      if (answerLower.includes(indicator)) positiveCount++;
    }

    // Base score of 80, bonus for positive indicators
    return Math.min(100, 80 + (positiveCount * 5));
  }

  /**
   * Step 7: Safety check
   * Check for unsafe content
   */
  private checkSafety(answer: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for personal information leaks
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phonePattern = /\b(?:\+\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g;
    const cpfPattern = /\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b/g; // Brazilian CPF
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g; // US SSN

    if (emailPattern.test(answer)) {
      issues.push({
        type: 'safety',
        severity: 'high',
        description: 'Answer may contain email address',
        suggestion: 'Verify if email should be included',
      });
    }

    if (phonePattern.test(answer)) {
      issues.push({
        type: 'safety',
        severity: 'high',
        description: 'Answer may contain phone number',
        suggestion: 'Verify if phone number should be included',
      });
    }

    if (cpfPattern.test(answer) || ssnPattern.test(answer)) {
      issues.push({
        type: 'safety',
        severity: 'critical',
        description: 'Answer contains sensitive personal identification',
        suggestion: 'Remove personal identification numbers',
      });
    }

    return issues;
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(metrics: {
    hallucinationScore: number;
    citationAccuracy: number;
    completeness: number;
    toneConsistency: number;
    personaCompliance: number;
  }): number {
    // Weighted average
    const weights = {
      hallucinationScore: 0.30,
      citationAccuracy: 0.15,
      completeness: 0.20,
      toneConsistency: 0.10,
      personaCompliance: 0.25,
    };

    const score =
      metrics.hallucinationScore * weights.hallucinationScore +
      metrics.citationAccuracy * weights.citationAccuracy +
      metrics.completeness * weights.completeness +
      metrics.toneConsistency * weights.toneConsistency +
      metrics.personaCompliance * weights.personaCompliance;

    return Math.round(score);
  }

  /**
   * Generate corrections for issues
   */
  private generateCorrections(answer: string, issues: ValidationIssue[]): string[] {
    const corrections: string[] = [];

    for (const issue of issues) {
      if (issue.type === 'persona' && issue.severity === 'critical') {
        // Remove forbidden phrases
        let corrected = answer;
        for (const phrase of this.FORBIDDEN_PHRASES) {
          const regex = new RegExp(phrase, 'gi');
          corrected = corrected.replace(regex, '');
        }

        // Clean up any resulting double spaces or awkward punctuation
        corrected = corrected.replace(/\s{2,}/g, ' ').trim();

        if (corrected !== answer) {
          corrections.push(corrected);
        }
      }
    }

    return corrections;
  }
}

// Export singleton instance
export const kodaAnswerValidationEngine = new KodaAnswerValidationEngine();

// Export class for testing
export { KodaAnswerValidationEngine };
