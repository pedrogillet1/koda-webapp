/**
 * Precision Optimization Service
 * Advanced techniques for maximum RAG accuracy:
 * - Query decomposition
 * - Multi-step reasoning
 * - Self-consistency checking
 * - Ambiguity detection
 * - Multi-document conflict resolution
 */

import { sendMessageToGemini } from './gemini.service';

interface DecomposedQuery {
  originalQuery: string;
  subQuestions: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

interface ReasoningStep {
  step: number;
  question: string;
  answer: string;
  confidence: number;
}

interface MultiStepResult {
  reasoning: ReasoningStep[];
  finalAnswer: string;
  overallConfidence: number;
}

interface ConsistencyCheck {
  answers: string[];
  consistencyScore: number;
  finalAnswer: string;
  confidence: 'high' | 'medium' | 'low';
  warning?: string;
  alternatives?: string[];
}

interface AmbiguityDetection {
  isAmbiguous: boolean;
  ambiguityType?: 'unclear_reference' | 'missing_context' | 'multiple_interpretations';
  clarificationNeeded?: string;
  suggestions?: string[];
}

interface ConflictResolution {
  hasConflicts: boolean;
  conflictAnalysis?: string;
  sources: Array<{
    documentName: string;
    information: string;
    date?: string;
    authority?: string;
  }>;
  recommendation?: string;
}

class PrecisionOptimizationService {
  /**
   * Decompose complex query into simpler sub-questions
   */
  async decomposeQuery(query: string): Promise<DecomposedQuery> {
    console.log(`🔬 [Precision] Decomposing query: "${query}"`);

    // Check if query is complex enough to decompose
    const wordCount = query.split(/\s+/).length;
    const hasMultipleClauses = query.includes(' and ') || query.includes(' or ') || query.includes(',');
    const hasComparison = /compare|difference|change|between|from.*to/i.test(query);

    if (wordCount < 10 && !hasMultipleClauses && !hasComparison) {
      console.log(`   ℹ️ Query is simple, no decomposition needed`);
      return {
        originalQuery: query,
        subQuestions: [query],
        complexity: 'simple'
      };
    }

    const prompt = `Break this complex question into 2-4 simpler sub-questions that, when answered together, fully address the original question.

Complex Question: ${query}

Requirements:
- Each sub-question should be independently answerable
- Sub-questions should be ordered logically
- Together, they should cover all aspects of the original question

Sub-questions (one per line, numbered):`;

    try {
      const response = await sendMessageToGemini(prompt, [], 'System', '', 'en');
      const lines = (response.text?.trim() || '').split('\n');

      const subQuestions = lines
        .map(line => line.replace(/^\d+[\.)]\s*/, '').trim())
        .filter(q => q.length > 0 && q.length < 200);

      if (subQuestions.length === 0) {
        throw new Error('No sub-questions generated');
      }

      const complexity = subQuestions.length >= 3 ? 'complex' : 'moderate';

      console.log(`   ✅ Decomposed into ${subQuestions.length} sub-questions (${complexity})`);
      subQuestions.forEach((q, i) => {
        console.log(`      ${i + 1}. ${q}`);
      });

      return {
        originalQuery: query,
        subQuestions,
        complexity
      };
    } catch (error) {
      console.error('❌ [Precision] Query decomposition failed:', error);
      return {
        originalQuery: query,
        subQuestions: [query],
        complexity: 'simple'
      };
    }
  }

  /**
   * Multi-step reasoning with chain-of-thought
   */
  async multiStepReasoning(
    question: string,
    context: string
  ): Promise<MultiStepResult> {
    console.log(`🧠 [Precision] Performing multi-step reasoning...`);

    const prompt = `Answer this question using step-by-step reasoning.

Context:
${context}

Question: ${question}

Think through this step by step:
1. What information do I need to answer this question?
2. Where can I find it in the context?
3. What calculations or comparisons are needed?
4. What logical steps lead to the answer?
5. What is the final answer?

Provide your reasoning in this format:

Step 1: [What you need to know]
Step 2: [Where you found it]
Step 3: [How you processed it]
Step 4: [Your conclusion]

Final Answer: [Clear, concise answer]`;

    try {
      const response = await sendMessageToGemini(prompt, [], 'System', '', 'en');
      const text = response.text || '';

      // Parse reasoning steps
      const stepMatches = text.match(/Step \d+:([^\n]+)/g) || [];
      const steps: ReasoningStep[] = stepMatches.map((match, index) => ({
        step: index + 1,
        question: `Step ${index + 1}`,
        answer: match.replace(/Step \d+:\s*/, '').trim(),
        confidence: 0.8 // Default confidence for reasoning steps
      }));

      // Extract final answer
      const finalAnswerMatch = text.match(/Final Answer:([^\n]+(?:\n(?!Step|Final)[^\n]+)*)/i);
      const finalAnswer = finalAnswerMatch
        ? finalAnswerMatch[1].trim()
        : text.split('\n\n').pop()?.trim() || 'Unable to determine answer';

      // Calculate overall confidence based on number of steps and clarity
      const overallConfidence = Math.min(0.9, 0.6 + (steps.length * 0.1));

      console.log(`   ✅ Completed ${steps.length}-step reasoning (confidence: ${(overallConfidence * 100).toFixed(0)}%)`);

      return {
        reasoning: steps,
        finalAnswer,
        overallConfidence
      };
    } catch (error) {
      console.error('❌ [Precision] Multi-step reasoning failed:', error);
      return {
        reasoning: [],
        finalAnswer: 'Error in reasoning process',
        overallConfidence: 0
      };
    }
  }

  /**
   * Self-consistency check: generate answer multiple times
   */
  async checkConsistency(
    question: string,
    context: string,
    numChecks: number = 3
  ): Promise<ConsistencyCheck> {
    console.log(`🔄 [Precision] Running ${numChecks} consistency checks...`);

    const answers: string[] = [];

    // Generate multiple answers
    for (let i = 0; i < numChecks; i++) {
      try {
        const response = await sendMessageToGemini(
          `${context}\n\nQuestion: ${question}\n\nAnswer:`,
          [],
          'System',
          '',
          'en'
        );
        answers.push(response.text?.trim() || '');
      } catch (error) {
        console.warn(`   ⚠️ Consistency check ${i + 1} failed:`, error);
      }
    }

    if (answers.length < 2) {
      console.warn('   ⚠️ Not enough answers for consistency check');
      return {
        answers,
        consistencyScore: 0,
        finalAnswer: answers[0] || 'Unable to generate answer',
        confidence: 'low',
        warning: 'Insufficient data for consistency check'
      };
    }

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(answers);

    console.log(`   Consistency score: ${(consistencyScore * 100).toFixed(0)}%`);

    let confidence: 'high' | 'medium' | 'low';
    let warning: string | undefined;
    let alternatives: string[] | undefined;

    if (consistencyScore >= 0.8) {
      confidence = 'high';
    } else if (consistencyScore >= 0.6) {
      confidence = 'medium';
      warning = 'Some variation in answers detected';
      alternatives = answers.slice(1);
    } else {
      confidence = 'low';
      warning = 'Multiple interpretations possible - answers are inconsistent';
      alternatives = answers.slice(1);
    }

    return {
      answers,
      consistencyScore,
      finalAnswer: answers[0], // Return first answer
      confidence,
      warning,
      alternatives
    };
  }

  /**
   * Calculate consistency score between multiple answers
   */
  private calculateConsistencyScore(answers: string[]): number {
    if (answers.length < 2) return 0;

    // Simple approach: compare answer similarity
    // More sophisticated: use embedding similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < answers.length; i++) {
      for (let j = i + 1; j < answers.length; j++) {
        const similarity = this.calculateTextSimilarity(answers[i], answers[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Calculate text similarity (basic Jaccard similarity)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Detect ambiguity in question
   */
  async detectAmbiguity(question: string, context?: string): Promise<AmbiguityDetection> {
    console.log(`🔍 [Precision] Checking for ambiguity in question...`);

    // Check for unclear pronouns
    const unclearPronouns = ['it', 'that', 'this', 'they', 'them', 'those', 'these'];
    const words = question.toLowerCase().split(/\s+/);
    const hasUnclearReference = unclearPronouns.some(pronoun => words.includes(pronoun));

    if (hasUnclearReference && !context) {
      console.log(`   ⚠️ Unclear reference detected: ${unclearPronouns.filter(p => words.includes(p)).join(', ')}`);
      return {
        isAmbiguous: true,
        ambiguityType: 'unclear_reference',
        clarificationNeeded: "Could you specify what 'it/that/this/they' refers to?",
        suggestions: [
          'Replace pronouns with specific nouns',
          'Provide more context about what you\'re asking',
          'Reference a specific section or document'
        ]
      };
    }

    // Check for multiple possible interpretations
    const hasMultipleSubjects = (question.match(/\s+and\s+/gi) || []).length >= 2;
    const hasVagueTerms = /some|any|several|various|different|multiple/i.test(question);

    if (hasMultipleSubjects && hasVagueTerms) {
      console.log(`   ⚠️ Multiple interpretations possible`);
      return {
        isAmbiguous: true,
        ambiguityType: 'multiple_interpretations',
        clarificationNeeded: 'Your question could have multiple interpretations. Could you be more specific?',
        suggestions: [
          'Break down into separate questions',
          'Specify which aspect is most important',
          'Provide an example of what you\'re looking for'
        ]
      };
    }

    // Check if question is too short/vague
    if (words.length < 4) {
      console.log(`   ⚠️ Question may be too vague (${words.length} words)`);
      return {
        isAmbiguous: true,
        ambiguityType: 'missing_context',
        clarificationNeeded: 'Your question is quite brief. Could you provide more details?',
        suggestions: [
          'Add more context about what you need',
          'Specify which document or section',
          'Explain what you\'re trying to accomplish'
        ]
      };
    }

    console.log(`   ✅ Question is clear`);
    return {
      isAmbiguous: false
    };
  }

  /**
   * Resolve conflicts between multiple documents
   */
  async resolveConflicts(
    chunks: Array<{
      content: string;
      document: { filename: string; createdAt?: Date };
      metadata?: any;
    }>
  ): Promise<ConflictResolution> {
    console.log(`⚖️ [Precision] Checking for conflicts across ${chunks.length} chunks...`);

    // Group by document
    const byDocument = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
      const docName = chunk.document.filename;
      if (!byDocument.has(docName)) {
        byDocument.set(docName, []);
      }
      byDocument.get(docName)!.push(chunk);
    }

    if (byDocument.size <= 1) {
      console.log(`   ℹ️ Only one document, no conflicts possible`);
      return { hasConflicts: false, sources: [] };
    }

    console.log(`   📚 Analyzing ${byDocument.size} documents for conflicts...`);

    // Format chunks by document
    const documentSummaries = Array.from(byDocument.entries()).map(([docName, docChunks]) => {
      const content = docChunks.map(c => c.content).join('\n\n');
      const date = docChunks[0].document.createdAt;

      return {
        documentName: docName,
        information: content.substring(0, 1000), // First 1000 chars
        date: date ? date.toISOString().split('T')[0] : undefined
      };
    });

    // Ask AI to identify conflicts
    const prompt = `Compare information from different documents and identify any conflicts or contradictions.

${documentSummaries.map((doc, i) => `
Document ${i + 1}: ${doc.documentName}
${doc.date ? `Date: ${doc.date}` : ''}
Content:
${doc.information}
`).join('\n---\n')}

Analysis:
1. Are there any conflicting facts or contradictions?
2. If yes, what specifically conflicts?
3. Which source appears more recent or authoritative?
4. What is your recommendation for resolving the conflict?

Provide a clear analysis:`;

    try {
      const response = await sendMessageToGemini(prompt, [], 'System', '', 'en');
      const analysis = response.text?.trim() || '';

      const hasConflicts = /conflict|contradict|disagree|differ/i.test(analysis);

      if (hasConflicts) {
        console.log(`   ⚠️ Conflicts detected between documents`);
      } else {
        console.log(`   ✅ No conflicts found`);
      }

      return {
        hasConflicts,
        conflictAnalysis: analysis,
        sources: documentSummaries,
        recommendation: hasConflicts
          ? 'Multiple sources provide different information. Review the analysis to determine which is most reliable.'
          : undefined
      };
    } catch (error) {
      console.error('❌ [Precision] Conflict resolution failed:', error);
      return {
        hasConflicts: false,
        sources: documentSummaries
      };
    }
  }
}

export default new PrecisionOptimizationService();
