/**
 * Multi-Step Reasoning Service
 * Implements multi-step reasoning for complex questions
 * - Detects if a question is complex
 * - Decomposes complex questions into simpler sub-questions
 * - Answers each sub-question independently
 * - Synthesizes final comprehensive answer
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

interface SubQuestion {
  question: string;
  rationale: string;
  order: number;
}

interface SubAnswer {
  question: string;
  answer: string;
  confidence: number;
}

interface ComplexityAnalysis {
  isComplex: boolean;
  complexityScore: number; // 0-1 scale
  reasoning: string;
  recommendedSteps: number;
}

interface ReasoningResult {
  isComplex: boolean;
  originalQuestion: string;
  subQuestions: SubQuestion[];
  subAnswers: SubAnswer[];
  finalAnswer: string;
  processingTime: number;
  totalSteps: number;
}

class MultiStepReasoningService {
  private genAI: GoogleGenerativeAI;
  private readonly MODEL_NAME = 'gemini-2.5-pro';
  private readonly COMPLEXITY_THRESHOLD = 0.6; // Questions above this are considered complex
  private readonly MAX_SUB_QUESTIONS = 5;

  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }

  /**
   * Main entry point: Answer a question with multi-step reasoning if needed
   */
  async answerQuestion(
    question: string,
    context?: string
  ): Promise<ReasoningResult> {
    const startTime = Date.now();

    console.log('[Multi-Step Reasoning] Processing question...');
    console.log(`   Question: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}`);

    try {
      // Step 1: Analyze complexity
      const complexity = await this.analyzeComplexity(question, context);

      console.log(`   Complexity Score: ${complexity.complexityScore.toFixed(2)}`);
      console.log(`   Is Complex: ${complexity.isComplex}`);

      let result: ReasoningResult;

      if (!complexity.isComplex) {
        // Simple question - answer directly
        console.log('   Using direct answering...');
        const answer = await this.answerDirectly(question, context);

        result = {
          isComplex: false,
          originalQuestion: question,
          subQuestions: [],
          subAnswers: [],
          finalAnswer: answer,
          processingTime: Date.now() - startTime,
          totalSteps: 1,
        };
      } else {
        // Complex question - use multi-step reasoning
        console.log(`   Using multi-step reasoning (${complexity.recommendedSteps} steps)...`);

        // Step 2: Decompose into sub-questions
        const subQuestions = await this.decomposeQuestion(
          question,
          context,
          complexity.recommendedSteps
        );

        console.log(`   Decomposed into ${subQuestions.length} sub-questions`);

        // Step 3: Answer each sub-question
        const subAnswers: SubAnswer[] = [];
        for (const subQ of subQuestions) {
          console.log(`   Answering sub-question ${subQ.order}: ${subQ.question.substring(0, 60)}...`);
          const answer = await this.answerSubQuestion(subQ, context);
          subAnswers.push(answer);
        }

        // Step 4: Synthesize final answer
        console.log('   Synthesizing final answer...');
        const finalAnswer = await this.synthesizeAnswer(
          question,
          subQuestions,
          subAnswers,
          context
        );

        result = {
          isComplex: true,
          originalQuestion: question,
          subQuestions,
          subAnswers,
          finalAnswer,
          processingTime: Date.now() - startTime,
          totalSteps: subQuestions.length + 1,
        };
      }

      const processingTimeSec = (result.processingTime / 1000).toFixed(2);
      console.log(`[Multi-Step Reasoning] Completed in ${processingTimeSec}s (${result.totalSteps} steps)`);

      return result;
    } catch (error: any) {
      console.error('[Multi-Step Reasoning] Error:', error);
      throw new Error(`Failed to process question: ${error.message}`);
    }
  }

  /**
   * Analyze question complexity to determine if multi-step reasoning is needed
   */
  private async analyzeComplexity(
    question: string,
    context?: string
  ): Promise<ComplexityAnalysis> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = `Analyze the complexity of this question and determine if it requires multi-step reasoning.

Question: ${question}
${context ? `Context: ${context.substring(0, 1000)}` : ''}

Evaluate based on:
1. Does it require multiple pieces of information to be gathered?
2. Does it involve comparisons, calculations, or multi-faceted analysis?
3. Does it have dependent sub-tasks that must be solved sequentially?
4. Would breaking it down into steps improve answer quality?

Return a JSON object with this structure:
{
  "isComplex": boolean,
  "complexityScore": number (0.0 to 1.0),
  "reasoning": "Brief explanation of why this is/isn't complex",
  "recommendedSteps": number (1-5, how many sub-questions would help)
}

Examples:
- "What is the capital of France?" -> complexityScore: 0.1, isComplex: false
- "Compare the economic policies of three countries and their impact on GDP" -> complexityScore: 0.9, isComplex: true
- "What factors led to World War I and how did they interconnect?" -> complexityScore: 0.8, isComplex: true

Return only valid JSON, no additional text.`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        isComplex: parsed.complexityScore >= this.COMPLEXITY_THRESHOLD,
        complexityScore: Math.max(0, Math.min(1, parsed.complexityScore)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        recommendedSteps: Math.max(1, Math.min(this.MAX_SUB_QUESTIONS, parsed.recommendedSteps || 2)),
      };
    } catch (error) {
      console.error('Failed to analyze complexity, defaulting to simple:', error);
      // Default to simple question on error
      return {
        isComplex: false,
        complexityScore: 0.3,
        reasoning: 'Analysis failed, treating as simple question',
        recommendedSteps: 1,
      };
    }
  }

  /**
   * Decompose complex question into sub-questions
   */
  private async decomposeQuestion(
    question: string,
    context?: string,
    numSteps: number = 3
  ): Promise<SubQuestion[]> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = `Break down this complex question into ${numSteps} simpler sub-questions that can be answered independently.

Original Question: ${question}
${context ? `Context: ${context.substring(0, 1000)}` : ''}

Guidelines:
- Each sub-question should address one aspect of the main question
- Sub-questions should be answerable independently
- Order them logically (foundational questions first)
- Keep sub-questions clear and focused
- Number of sub-questions: exactly ${numSteps}

Return a JSON array with this structure:
[
  {
    "question": "First sub-question",
    "rationale": "Why this question helps answer the original",
    "order": 1
  },
  {
    "question": "Second sub-question",
    "rationale": "Why this question helps answer the original",
    "order": 2
  }
]

Return only valid JSON array, no additional text.`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid sub-questions array');
      }

      return parsed.map((item, index) => ({
        question: item.question || '',
        rationale: item.rationale || '',
        order: item.order || index + 1,
      }));
    } catch (error) {
      console.error('Failed to decompose question:', error);
      // Fallback: create a single sub-question that is the original question
      return [
        {
          question,
          rationale: 'Fallback: using original question',
          order: 1,
        },
      ];
    }
  }

  /**
   * Answer a single sub-question
   */
  private async answerSubQuestion(
    subQuestion: SubQuestion,
    context?: string
  ): Promise<SubAnswer> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = `Answer this question clearly and concisely.

Question: ${subQuestion.question}
${context ? `Context: ${context.substring(0, 2000)}` : ''}

Provide a focused answer that directly addresses the question. Be specific and factual.

Return a JSON object with this structure:
{
  "answer": "Your detailed answer here",
  "confidence": number (0.0 to 1.0, how confident you are in this answer)
}

Return only valid JSON, no additional text.`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        question: subQuestion.question,
        answer: parsed.answer || 'No answer provided',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      };
    } catch (error) {
      console.error('Failed to answer sub-question:', error);
      return {
        question: subQuestion.question,
        answer: 'Failed to generate answer',
        confidence: 0,
      };
    }
  }

  /**
   * Answer simple question directly without decomposition
   */
  private async answerDirectly(
    question: string,
    context?: string
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    const prompt = `Answer this question clearly and concisely.

Question: ${question}
${context ? `Context: ${context.substring(0, 5000)}` : ''}

Provide a focused, well-structured answer. Be specific and informative, but avoid unnecessary details.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Failed to answer directly:', error);
      throw error;
    }
  }

  /**
   * Synthesize final answer from sub-answers
   */
  private async synthesizeAnswer(
    originalQuestion: string,
    subQuestions: SubQuestion[],
    subAnswers: SubAnswer[],
    context?: string
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });

    // Build a summary of sub-questions and answers
    const subQnA = subQuestions.map((sq, i) => {
      const answer = subAnswers.find(sa => sa.question === sq.question);
      return `${sq.order}. ${sq.question}\n   Answer: ${answer?.answer || 'No answer'}`;
    }).join('\n\n');

    const prompt = `Synthesize a focused, concise final answer to the original question using the sub-answers provided.

Original Question: ${originalQuestion}
${context ? `Context: ${context.substring(0, 1000)}` : ''}

Sub-Questions and Answers:
${subQnA}

Instructions:
- Integrate information from all sub-answers into a coherent response
- Directly answer the original question
- Be comprehensive but concise
- Structure the answer logically
- Don't just list sub-answers; synthesize them into a unified response
- Add connections and insights that emerge from combining the sub-answers

Provide only the final synthesized answer, no meta-commentary.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Failed to synthesize answer:', error);
      // Fallback: concatenate sub-answers
      return subAnswers.map((sa, i) => `${i + 1}. ${sa.answer}`).join('\n\n');
    }
  }

  /**
   * Quick complexity check (faster, less detailed)
   */
  async isComplexQuestion(question: string): Promise<boolean> {
    try {
      const analysis = await this.analyzeComplexity(question);
      return analysis.isComplex;
    } catch (error) {
      console.error('Failed to check complexity:', error);
      return false;
    }
  }
}

export default new MultiStepReasoningService();
