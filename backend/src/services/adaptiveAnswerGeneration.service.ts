/**
 * ADAPTIVE ANSWER GENERATION SERVICE - GEMINI 2.5 FLASH OPTIMIZED
 *
 * Optimizations:
 * - Response type classification (6 types)
 * - Adaptive temperature (0.2-0.6)
 * - Optimal topK (20-64 instead of fixed 10)
 * - Reduced token limits (100-900 instead of 8192)
 * - System instructions (separate from prompt)
 * - Information density optimization (15-20% target)
 * - Flash-specific prompt engineering
 *
 * Changes from original:
 * 1. Added ResponseType enum
 * 2. Added classifyResponseType() function
 * 3. Updated LENGTH_TARGETS (reduced by 40-67%)
 * 4. Added FLASH_OPTIMAL_CONFIG with adaptive parameters
 * 5. Added FLASH_SYSTEM_INSTRUCTION
 * 6. Updated buildAdaptivePrompt() to use system instruction
 * 7. Updated generateAdaptiveAnswer() to use Flash config
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
  context?: string;
  documentContext?: string;
  userId?: string;
  profilePrompt?: string;
  documentInfo?: DocumentInfo | DocumentInfo[];
  documents?: any[];
  fullDocumentTexts?: Map<string, string>;
  retrievedChunks?: any[];
  conversationContext?: string;
  conversationHistory?: string | Array<{ role: string; content: string }>;
  forceConversationOnly?: boolean;
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
  content: string;
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
// RESPONSE TYPE CLASSIFICATION (NEW)
// ============================================================================

/**
 * Response types aligned with ChatGPT/Gemini patterns
 */
export enum ResponseType {
  SIMPLE = 'simple',           // "What is X?" → 30-60 words
  MEDIUM = 'medium',           // "Explain X" → 100-220 words
  COMPLEX = 'complex',         // "Analyze X" → 350-750 words
  EXPLANATION = 'explanation', // "Why X?" → 220-420 words
  GUIDANCE = 'guidance',       // "Should I X?" → 180-350 words
  STEPBYSTEP = 'stepbystep'    // "How to X?" → 260-430 words
}

/**
 * Classify query into response type for optimal parameter selection
 */
export function classifyResponseType(query: string): ResponseType {
  const lowerQuery = query.toLowerCase();

  // Simple queries - direct factual questions
  if (/^(what is|who is|when|where|which)\s+\w+\??$/i.test(lowerQuery)) {
    return ResponseType.SIMPLE;
  }

  // Step-by-step queries
  if (/\b(how to|step by step|guide|tutorial|walkthrough|instructions)\b/i.test(lowerQuery)) {
    return ResponseType.STEPBYSTEP;
  }

  // Explanation queries
  if (/\b(explain|why|how does|what does.*mean|clarify|describe)\b/i.test(lowerQuery)) {
    return ResponseType.EXPLANATION;
  }

  // Guidance queries
  if (/\b(should i|recommend|suggest|advice|best practice|tips|strategies)\b/i.test(lowerQuery)) {
    return ResponseType.GUIDANCE;
  }

  // Complex queries - analysis, comparison, synthesis
  if (/\b(analyze|compare|synthesize|evaluate|assess|across all|relationship|themes)\b/i.test(lowerQuery)) {
    return ResponseType.COMPLEX;
  }

  // Default to medium
  return ResponseType.MEDIUM;
}

// ============================================================================
// FLASH-OPTIMIZED CONFIGURATION (NEW)
// ============================================================================

/**
 * Optimal parameters for Gemini 2.5 Flash per response type
 * Based on ChatGPT/Gemini information density standards
 */
export const FLASH_OPTIMAL_CONFIG: Record<string, {
  targetWords: number;
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  bulletPoints: string;
  sections: number | string;
  useHeadings: boolean;
  useThinking: boolean;
}> = {
  simple: {
    targetWords: 150,          // Restored from 50 - needs room for summaries
    maxTokens: 1000,           // FIXED: Increased from 300 - Gemini 2.5 Flash uses internal thinking tokens
    temperature: 0.2,          // Very deterministic for facts
    topP: 0.95,
    topK: 20,                  // Narrow vocabulary for precision
    bulletPoints: '0-3',
    sections: 1,
    useHeadings: false,
    useThinking: false
  },
  medium: {
    targetWords: 180,          // Was 300 → Reduced 40%
    maxTokens: 1500,           // FIXED: Increased from 300 - Gemini 2.5 Flash needs room for thinking
    temperature: 0.4,          // Balanced
    topP: 0.95,
    topK: 40,                  // Was 10 → Increased 4x for variety
    bulletPoints: '3-6',
    sections: '2-3',
    useHeadings: true,
    useThinking: false
  },
  complex: {
    targetWords: 550,          // Was 600 → Reduced 8%
    maxTokens: 2500,           // FIXED: Increased from 900 - Complex answers need more room
    temperature: 0.5,          // Slightly creative
    topP: 0.95,
    topK: 64,                  // Full range
    bulletPoints: '8-16',
    sections: '4-7',
    useHeadings: true,
    useThinking: true          // Enable thinking for complex reasoning
  },
  explanation: {
    targetWords: 320,          // NEW category
    maxTokens: 1500,           // FIXED: Increased from 500
    temperature: 0.4,
    topP: 0.95,
    topK: 40,
    bulletPoints: '4-10',
    sections: '2-4',
    useHeadings: true,
    useThinking: false
  },
  guidance: {
    targetWords: 250,          // NEW category
    maxTokens: 1200,           // FIXED: Increased from 400
    temperature: 0.6,          // More creative for suggestions
    topP: 0.95,
    topK: 50,
    bulletPoints: '5-12',
    sections: '2-3',
    useHeadings: true,
    useThinking: false
  },
  stepbystep: {
    targetWords: 350,          // NEW category
    maxTokens: 1800,           // FIXED: Increased from 550
    temperature: 0.3,          // Precise for instructions
    topP: 0.95,
    topK: 30,
    bulletPoints: '6-14',
    sections: '3-6',
    useHeadings: true,
    useThinking: false
  }
};

// ============================================================================
// FLASH SYSTEM INSTRUCTION (NEW)
// ============================================================================

/**
 * System instruction for Gemini 2.5 Flash
 * Separate from prompt for efficiency (Flash caches system instructions)
 */
const FLASH_SYSTEM_INSTRUCTION = `You are KODA, an intelligent document assistant powered by Gemini 2.5 Flash.

**CORE PRINCIPLES:**
1. Only use information from the provided context
2. Cite sources using document titles in **bold**
3. Be concise and information-dense (15-20% fact density)
4. Use structured formatting (headings, bullets)
5. If information is missing, state this explicitly

**INFORMATION DENSITY RULES:**
- Every sentence must contain specific facts - No filler or vague statements
- Use numbers and specifics: "45% increase" not "significant growth"
- Combine related facts: "Revenue: Q1 $1.2M, Q2 $1.5M, Q3 $1.8M"
- Remove unnecessary qualifiers: "Document states" → Just state the fact
- Use **bold** for key terms to save explanation words

**TARGET:** 15-20% information density (unique facts / total words)

**EXAMPLES:**

❌ LOW DENSITY (8%):
"The document mentions that the company has experienced significant growth over the past year. According to the financial report, revenue has increased substantially."
(27 words, 2 facts = 7.4% density)

✅ HIGH DENSITY (18%):
"Revenue grew **45%** to **$2.5M** in Q1 2024, driven by **enterprise contracts** (+60%) and **SaaS subscriptions** (+35%)."
(17 words, 3 facts = 17.6% density)

**RESPONSE STYLE:**
- Professional and clear
- Information-dense (no filler words)
- Structured with headings and bullets
- Precise language (avoid vague terms)
- Direct answers (no "According to..." preambles)

**FORMATTING RULES:**
- Use headings ONLY for complex answers (>100 words)
- Keep bullet points tight (1-2 lines each)
- Use **bold** for key terms and document titles
- Avoid excessive blank lines
- First heading should have NO blank line before it

**CRITICAL RULES:**
1. Only use information from the provided context
2. Cite sources using document titles in **bold**
3. If information is missing, state this explicitly
4. If documents contradict, point this out
5. Use Markdown formatting (bold, lists, headings)
6. Do NOT include inline page citations like [pg 1]`;

// ============================================================================
// ADAPTIVE LENGTH CALCULATION (UPDATED)
// ============================================================================

/**
 * Calculate optimal answer length based on query type and complexity
 * UPDATED: Now uses response type classification and Flash-optimized targets
 */
function calculateAdaptiveLength(
  query: string,
  documentInfo?: DocumentInfo | DocumentInfo[],
  answerLength?: 'short' | 'medium' | 'long' | 'adaptive'
): {
  targetWords: number;
  maxTokens: number;
  responseType: ResponseType;
  temperature: number;
  topK: number;
  topP: number;
} {

  // If explicit length specified, map to response type
  if (answerLength && answerLength !== 'adaptive') {
    const lengthMap = {
      short: ResponseType.SIMPLE,
      medium: ResponseType.MEDIUM,
      long: ResponseType.COMPLEX
    };
    const responseType = lengthMap[answerLength];
    const config = FLASH_OPTIMAL_CONFIG[responseType];

    return {
      targetWords: config.targetWords,
      maxTokens: config.maxTokens,
      responseType,
      temperature: config.temperature,
      topK: config.topK,
      topP: config.topP
    };
  }

  // Classify query into response type
  let responseType = classifyResponseType(query);

  // Adjust based on document complexity
  const docs = Array.isArray(documentInfo) ? documentInfo : (documentInfo ? [documentInfo] : []);
  const totalPages = docs.reduce((sum, doc) => sum + (doc.pageCount || 0), 0);
  const totalWords = docs.reduce((sum, doc) => sum + (doc.wordCount || 0), 0);

  // Upgrade response type if documents are complex
  if ((totalPages > 10 || totalWords > 5000 || docs.length > 3) && responseType === ResponseType.MEDIUM) {
    responseType = ResponseType.COMPLEX;
  }

  const config = FLASH_OPTIMAL_CONFIG[responseType];

  return {
    targetWords: config.targetWords,
    maxTokens: config.maxTokens,
    responseType,
    temperature: config.temperature,
    topK: config.topK,
    topP: config.topP
  };
}

// ============================================================================
// DYNAMIC TONE SELECTION (UNCHANGED)
// ============================================================================

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
// CONFIDENCE SCORING (UNCHANGED)
// ============================================================================

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
// BUILD ADAPTIVE PROMPT (UPDATED)
// ============================================================================

/**
 * Build prompt for Flash model
 * UPDATED: Simplified (system instruction moved to model config)
 */
function buildAdaptivePrompt(
  params: GenerateAnswerParams,
  lengthConfig: {
    targetWords: number;
    maxTokens: number;
    responseType: ResponseType;
  },
  tone: string
): string {

  const context = params.documentContext || params.context || '';
  const conversationHistory = typeof params.conversationHistory === 'string'
    ? params.conversationHistory
    : Array.isArray(params.conversationHistory)
      ? params.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')
      : '';

  const config = FLASH_OPTIMAL_CONFIG[lengthConfig.responseType];

  let prompt = `**LANGUAGE:** ${params.language || 'en'}

**TONE:** ${tone}

**TARGET LENGTH:** Approximately ${lengthConfig.targetWords} words (±20%)

**RESPONSE STRUCTURE:**
- Bullet points: ${config.bulletPoints} recommended
- Sections: ${config.sections} ${typeof config.sections === 'number' ? 'section' : 'sections'}
- Lines per bullet: 1-2 lines (keep concise)
- Use headings: ${config.useHeadings ? 'Yes (for structure)' : 'No (direct answer)'}

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
// GENERATE ADAPTIVE ANSWER (UPDATED)
// ============================================================================

/**
 * Generate adaptive answer with Flash-optimized configuration
 * UPDATED: Uses system instruction, adaptive parameters, stop sequences
 */
export async function generateAdaptiveAnswer(
  params: GenerateAnswerParams,
  onChunk?: (chunk: string) => void
): Promise<AnswerResult> {

  const startTime = Date.now();
  const context = params.documentContext || params.context || '';

  try {
    // Calculate adaptive length with Flash config
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

    // Create Flash model with system instruction
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: FLASH_SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: lengthConfig.temperature,
        topP: lengthConfig.topP,
        topK: lengthConfig.topK,
        maxOutputTokens: lengthConfig.maxTokens,
        // stopSequences: ['\n\n\n\n', '---END---']  // DISABLED - was causing early termination
      }
    });

    const prompt = buildAdaptivePrompt(params, lengthConfig, tone);

    console.log(`🎯 [FLASH] Generating answer:`, {
      responseType: lengthConfig.responseType,
      targetWords: lengthConfig.targetWords,
      maxTokens: lengthConfig.maxTokens,
      temperature: lengthConfig.temperature,
      topK: lengthConfig.topK,
      tone
    });

    let fullResponse = '';

    if (onChunk) {
      // Streaming mode
      const result = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        onChunk(chunkText);
      }
    } else {
      // Non-streaming mode
      const result = await model.generateContent(prompt);
      fullResponse = result.response.text();
    }

    // Calculate confidence
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

    // Calculate stats
    const wordCount = fullResponse.split(/\s+/).length;
    const estimatedTokens = Math.ceil(wordCount * 1.3);
    const compressionRatio = context.length > 0 ? context.length / fullResponse.length : 1;
    const estimatedReadTime = Math.ceil(wordCount / 200);

    console.log(`✅ [FLASH] Answer generated:`, {
      wordCount,
      targetWords: lengthConfig.targetWords,
      deviation: `${((wordCount / lengthConfig.targetWords - 1) * 100).toFixed(1)}%`,
      tokens: estimatedTokens,
      duration: `${Date.now() - startTime}ms`
    });

    return {
      answer: fullResponse,
      content: fullResponse,
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
        complexity: lengthConfig.responseType === ResponseType.COMPLEX ? 'complex'
                  : lengthConfig.responseType === ResponseType.SIMPLE ? 'simple'
                  : 'medium',
        tone
      }
    };

  } catch (error: any) {
    console.error('❌ [FLASH] Error generating answer:', error);
    throw new Error(`Adaptive answer generation failed: ${error.message}`);
  }
}

// ============================================================================
// LEGACY GENERATE ANSWER (for backwards compatibility)
// ============================================================================

export async function generateAnswer(
  params: GenerateAnswerParams,
  onChunk?: (chunk: string) => void
): Promise<AnswerResult> {
  return generateAdaptiveAnswer(params, onChunk);
}

// ============================================================================
// QUALITY VALIDATION (UNCHANGED)
// ============================================================================

export function validateAnswerQuality(
  answerOrResult: string | AnswerResult,
  context?: string,
  query?: string
): QualityValidationResult {

  const answer = typeof answerOrResult === 'string'
    ? answerOrResult
    : (answerOrResult.content || answerOrResult.answer || '');

  const issues: string[] = [];
  let score = 100;

  if (!answer || answer.trim().length === 0) {
    issues.push('Answer is empty');
    score -= 100;
  } else if (answer.length < 20) {
    issues.push('Answer is very short (< 20 characters)');
    score -= 30;
  }

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

  if (answer.length > 200) {
    const hasLists = /[-*•]\s/.test(answer);
    const hasBold = /\*\*/.test(answer);
    const hasHeadings = /^#+\s/m.test(answer);

    if (!hasLists && !hasBold && !hasHeadings) {
      issues.push('Long answer lacks formatting');
      score -= 10;
    }
  }

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
