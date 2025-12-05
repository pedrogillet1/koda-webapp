/**
 * ADAPTIVE ANSWER GENERATION SERVICE
 *
 * Provides dynamic, context-aware answer generation with:
 * - Adaptive length based on query complexity and document size
 * - Dynamic tone based on query type and user preferences
 * - Confidence scoring based on source quality and coverage
 * - Quality validation to prevent poor answers
 * - Streaming support via onChunk callback
 *
 * This replaces the stub in deletedServiceStubs.ts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface DocumentInfo {
  id?: string;
  title: string;
  content?: string;
  pageCount?: number;
  wordCount?: number;
  type?: string;
}

export interface GenerateAnswerParams {
  query: string;
  // Support multiple context param names for compatibility
  context?: string;
  documentContext?: string;
  // User and session info
  userId?: string;
  profilePrompt?: string;
  // Document info - single object or array
  documentInfo?: DocumentInfo | DocumentInfo[];
  // Documents array for conversation-only mode
  documents?: any[];
  fullDocumentTexts?: Map<string, string>;
  retrievedChunks?: any[];
  // Conversation context
  conversationContext?: string;
  conversationHistory?: string | Array<{ role: string; content: string }>;
  forceConversationOnly?: boolean;
  // Answer configuration
  answerLength?: 'short' | 'medium' | 'long' | 'adaptive';
  language?: string;
  includeConfidence?: boolean;
  includeSources?: boolean;
  includeMetadata?: boolean;
  includeImplications?: boolean;
  responseType?: 'comprehensive' | 'concise' | 'technical' | 'simple';
  userPreferences?: {
    tone?: 'professional' | 'casual' | 'technical';
    detailLevel?: 'minimal' | 'moderate' | 'detailed';
  };
}

export interface AnswerResult {
  answer: string;
  content: string; // Alias for answer (rag.service.ts uses this)
  confidence: number;
  sources: Array<{
    documentId: string;
    title: string;
    relevance: number;
    pages?: number[];
  }>;
  stats: {
    wordCount: number;
    estimatedTokens: number;
    compressionRatio: number;
  };
  metadata?: {
    wordCount: number;
    estimatedReadTime: number;
    complexity: 'simple' | 'medium' | 'complex';
    tone: string;
  };
}

export interface QualityValidationResult {
  isValid: boolean;
  score: number;
  issues: string[];
  reason?: string;
  suggestions?: string[];
}

// ============================================================================
// GEMINI CLIENT INITIALIZATION
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================================
// ADAPTIVE LENGTH CALCULATION
// ============================================================================

/**
 * Calculate optimal answer length based on query complexity and document size
 */
function calculateAdaptiveLength(
  query: string,
  documentInfo?: DocumentInfo | DocumentInfo[],
  answerLength?: 'short' | 'medium' | 'long' | 'adaptive'
): { targetWords: number; maxTokens: number } {

  // If explicit length specified, use it
  if (answerLength && answerLength !== 'adaptive') {
    const lengthMap = {
      short: { targetWords: 100, maxTokens: 200 },
      medium: { targetWords: 300, maxTokens: 500 },
      long: { targetWords: 600, maxTokens: 1000 }
    };
    return lengthMap[answerLength];
  }

  // Calculate complexity score
  let complexityScore = 0;

  // Query complexity indicators
  const complexIndicators = [
    'compare', 'analyze', 'synthesize', 'evaluate', 'explain',
    'all documents', 'across all', 'every document',
    'contradiction', 'conflict', 'disagree',
    'relationship between', 'timeline', 'changes over time'
  ];

  const lowerQuery = query.toLowerCase();
  complexIndicators.forEach(indicator => {
    if (lowerQuery.includes(indicator)) complexityScore += 1;
  });

  // Normalize documentInfo to array
  const docs = Array.isArray(documentInfo) ? documentInfo : (documentInfo ? [documentInfo] : []);

  // Document size factor
  const totalPages = docs.reduce((sum, doc) => sum + (doc.pageCount || 0), 0);
  const totalWords = docs.reduce((sum, doc) => sum + (doc.wordCount || 0), 0);

  if (totalPages > 10) complexityScore += 2;
  else if (totalPages > 5) complexityScore += 1;

  if (totalWords > 5000) complexityScore += 2;
  else if (totalWords > 2000) complexityScore += 1;

  // Multiple documents = more complex
  if (docs.length > 3) complexityScore += 2;
  else if (docs.length > 1) complexityScore += 1;

  // Calculate target length
  if (complexityScore >= 5) {
    return { targetWords: 600, maxTokens: 1000 };
  } else if (complexityScore >= 2) {
    return { targetWords: 300, maxTokens: 500 };
  } else {
    return { targetWords: 150, maxTokens: 250 };
  }
}

// ============================================================================
// DYNAMIC TONE SELECTION
// ============================================================================

/**
 * Determine appropriate tone based on query type and user preferences
 */
function determineTone(
  query: string,
  responseType?: string,
  userPreferences?: { tone?: string }
): string {

  if (userPreferences?.tone) {
    return userPreferences.tone;
  }

  if (/\b(api|code|function|algorithm|implementation|technical|architecture)\b/i.test(query)) {
    return 'technical';
  }

  if (/\b(revenue|profit|strategy|business|financial|contract|policy)\b/i.test(query)) {
    return 'professional';
  }

  if (/\b(what is|how do|can you|show me|tell me)\b/i.test(query)) {
    return 'conversational';
  }

  if (responseType === 'technical') return 'technical';
  if (responseType === 'simple') return 'conversational';

  return 'professional';
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate confidence score based on source quality and coverage
 */
function calculateConfidence(
  query: string,
  context: string,
  documentInfo?: DocumentInfo | DocumentInfo[]
): number {

  let confidence = 0.5;

  const contextWords = context.split(/\s+/).length;
  if (contextWords > 1000) confidence += 0.2;
  else if (contextWords > 500) confidence += 0.15;
  else if (contextWords > 200) confidence += 0.1;
  else if (contextWords < 50) confidence -= 0.2;

  const docs = Array.isArray(documentInfo) ? documentInfo : (documentInfo ? [documentInfo] : []);
  const sourceCount = docs.length;
  if (sourceCount >= 3) confidence += 0.15;
  else if (sourceCount >= 2) confidence += 0.1;
  else if (sourceCount === 1) confidence += 0.05;
  else confidence -= 0.2;

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const contextLower = context.toLowerCase();
  const matchedWords = queryWords.filter(word => contextLower.includes(word));
  const relevanceRatio = matchedWords.length / Math.max(queryWords.length, 1);
  confidence += relevanceRatio * 0.15;

  if (docs.length > 0) {
    const avgWordCount = docs.reduce((sum, doc) => sum + (doc.wordCount || 0), 0) / docs.length;
    if (avgWordCount > 1000) confidence += 0.1;
    else if (avgWordCount < 100) confidence -= 0.1;
  }

  return Math.max(0, Math.min(1, confidence));
}

// ============================================================================
// BUILD ADAPTIVE PROMPT
// ============================================================================

/**
 * Build prompt with adaptive instructions based on parameters
 */
function buildAdaptivePrompt(
  params: GenerateAnswerParams,
  lengthConfig: { targetWords: number; maxTokens: number },
  tone: string
): string {

  const context = params.documentContext || params.context || '';
  const conversationHistory = typeof params.conversationHistory === 'string'
    ? params.conversationHistory
    : Array.isArray(params.conversationHistory)
      ? params.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')
      : '';

  let prompt = `You are KODA, an intelligent document assistant. Answer the user's question based on the provided context.

**LANGUAGE:** ${params.language || 'en'}

**TONE:** ${tone}
`;

  if (tone === 'technical') {
    prompt += `- Use precise technical terminology
- Include specific details and references
- Explain complex concepts clearly
- Use code examples if relevant
`;
  } else if (tone === 'professional') {
    prompt += `- Use professional, business-appropriate language
- Be clear and concise
- Focus on actionable insights
- Use structured formatting
`;
  } else if (tone === 'conversational') {
    prompt += `- Use natural, friendly language
- Explain concepts simply
- Avoid jargon unless necessary
- Be helpful and approachable
`;
  }

  prompt += `
**TARGET LENGTH:** Approximately ${lengthConfig.targetWords} words

**CRITICAL RULES:**
1. Only use information from the provided context
2. Cite sources using document titles in **bold**
3. If information is missing, state this explicitly
4. If documents contradict, point this out
5. Use Markdown formatting (bold, lists, headings)
6. Do NOT include inline page citations like [pg 1]

`;

  if (params.conversationContext && params.conversationContext.trim().length > 0) {
    prompt += `**CONVERSATION CONTEXT:**
${params.conversationContext}

`;
  }

  if (conversationHistory && conversationHistory.trim().length > 0) {
    prompt += `**CONVERSATION HISTORY:**
${conversationHistory}

`;
  }

  if (context && context.trim().length > 0) {
    prompt += `**CONTEXT FROM DOCUMENTS:**
${context}

`;
  }

  prompt += `**USER QUESTION:**
${params.query}

**YOUR ANSWER:**
`;

  return prompt;
}

// ============================================================================
// GENERATE ADAPTIVE ANSWER
// ============================================================================

/**
 * Generate adaptive answer with dynamic length, tone, and formatting
 * Supports streaming via onChunk callback
 */
export async function generateAdaptiveAnswer(
  params: GenerateAnswerParams,
  onChunk?: (chunk: string) => void
): Promise<AnswerResult> {

  const startTime = Date.now();
  const context = params.documentContext || params.context || '';

  try {
    const lengthConfig = calculateAdaptiveLength(
      params.query,
      params.documentInfo,
      params.answerLength
    );

    const tone = determineTone(
      params.query,
      params.responseType,
      params.userPreferences
    );

    const prompt = buildAdaptivePrompt(params, lengthConfig, tone);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 10,
        maxOutputTokens: lengthConfig.maxTokens,
      }
    });

    let answer = '';

    if (onChunk) {
      // Streaming mode
      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        answer += chunkText;
        onChunk(chunkText);
      }
    } else {
      // Non-streaming mode
      const result = await model.generateContent(prompt);
      answer = result.response.text();
    }

    const confidence = calculateConfidence(params.query, context, params.documentInfo);

    // Normalize documentInfo for sources
    const docs = Array.isArray(params.documentInfo)
      ? params.documentInfo
      : (params.documentInfo ? [params.documentInfo] : []);

    const sources = docs.map(doc => ({
      documentId: doc.id || '',
      title: doc.title,
      relevance: 0.8,
      pages: []
    }));

    const wordCount = answer.split(/\s+/).length;
    const estimatedTokens = Math.ceil(answer.length / 4);
    const compressionRatio = context.length > 0 ? answer.length / context.length : 1;
    const estimatedReadTime = Math.ceil(wordCount / 200);

    const latency = Date.now() - startTime;
    console.log(`✅ [ADAPTIVE] Generated ${wordCount}-word answer in ${latency}ms (tone: ${tone}, confidence: ${confidence.toFixed(2)})`);

    return {
      answer,
      content: answer, // Alias for rag.service.ts compatibility
      confidence,
      sources,
      stats: {
        wordCount,
        estimatedTokens,
        compressionRatio
      },
      metadata: {
        wordCount,
        estimatedReadTime,
        complexity: lengthConfig.targetWords > 400 ? 'complex' : lengthConfig.targetWords > 200 ? 'medium' : 'simple',
        tone
      }
    };

  } catch (error: any) {
    console.error('❌ [ADAPTIVE] Generation failed:', error);
    throw new Error(`Adaptive answer generation failed: ${error.message}`);
  }
}

// ============================================================================
// LEGACY GENERATE ANSWER (for backwards compatibility)
// ============================================================================

/**
 * Legacy generateAnswer method - supports all param variations
 */
export async function generateAnswer(
  params: GenerateAnswerParams,
  onChunk?: (chunk: string) => void
): Promise<AnswerResult> {
  return generateAdaptiveAnswer(params, onChunk);
}

// ============================================================================
// QUALITY VALIDATION
// ============================================================================

/**
 * Validate answer quality to prevent poor responses
 * Accepts either string or AnswerResult for compatibility
 */
export function validateAnswerQuality(
  answerOrResult: string | AnswerResult,
  context?: string,
  query?: string
): QualityValidationResult {

  const answer = typeof answerOrResult === 'string'
    ? answerOrResult
    : (answerOrResult.content || answerOrResult.answer || '');

  const issues: string[] = [];
  let score = 100; // Use 0-100 scale for rag.service.ts compatibility

  // Check 1: Empty or too short
  if (!answer || answer.trim().length === 0) {
    issues.push('Answer is empty');
    score -= 100;
  } else if (answer.length < 20) {
    issues.push('Answer is very short (< 20 characters)');
    score -= 30;
  }

  // Check 2: Generic/unhelpful responses
  const genericPhrases = [
    'i don\'t know',
    'i cannot answer',
    'no information',
    'not available',
    'unable to determine'
  ];

  const lowerAnswer = answer.toLowerCase();
  if (genericPhrases.some(phrase => lowerAnswer.includes(phrase)) && answer.length < 100) {
    issues.push('Answer appears generic or unhelpful');
    score -= 20;
  }

  // Check 3: Hallucination indicators (if context provided)
  if (context && query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contextLower = context.toLowerCase();
    const answerLower = answer.toLowerCase();
    const answerWords = answerLower.split(/\s+/).filter(w => w.length > 5);
    const contextWords = contextLower.split(/\s+/);

    let unmatchedCount = 0;
    answerWords.forEach(word => {
      if (!contextWords.includes(word) && !queryWords.includes(word)) {
        unmatchedCount++;
      }
    });

    const unmatchedRatio = unmatchedCount / Math.max(answerWords.length, 1);
    if (unmatchedRatio > 0.5) {
      issues.push('Possible hallucination detected');
      score -= 30;
    }
  }

  // Check 4: Formatting quality
  if (answer.length > 200) {
    const hasLists = /[-*•]\s/.test(answer);
    const hasBold = /\*\*/.test(answer);
    const hasHeadings = /^#+\s/m.test(answer);

    if (!hasLists && !hasBold && !hasHeadings) {
      issues.push('Long answer lacks formatting');
      score -= 10;
    }
  }

  // Check 5: Repetition
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
  const repetitionRatio = 1 - (uniqueSentences.size / Math.max(sentences.length, 1));

  if (repetitionRatio > 0.3) {
    issues.push('Answer contains significant repetition');
    score -= 20;
  }

  score = Math.max(0, Math.min(100, score));
  const isValid = score >= 50 && !issues.includes('Answer is empty');

  console.log(`🔍 [QUALITY] Validation score: ${score}/100, Issues: ${issues.length}, Valid: ${isValid}`);

  return {
    isValid,
    score,
    issues,
    reason: issues.length > 0 ? issues.join('; ') : undefined,
    suggestions: issues.length > 0 ? ['Review and improve answer quality'] : undefined
  };
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const adaptiveAnswerGeneration = {
  generateAnswer,
  generateAdaptiveAnswer,
  validateAnswerQuality
};

export default adaptiveAnswerGeneration;
