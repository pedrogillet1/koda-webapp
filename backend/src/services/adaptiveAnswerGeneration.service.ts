/**
 * ADAPTIVE ANSWER GENERATION SERVICE - FIXED VERSION
 * 
 * FIXES APPLIED:
 * 1. Increased all token limits by 2-3x to prevent truncation
 * 2. Added completion verification before returning
 * 3. Added streaming error handling
 * 4. Added retry logic for incomplete answers
 * 
 * CHANGES FROM ORIGINAL:
 * - simple: 1000 → 2500 tokens
 * - medium: 1500 → 3500 tokens  
 * - complex: 2500 → 6000 tokens
 * - explanation: 1500 → 3500 tokens
 * - guidance: 1200 → 3000 tokens
 * - stepbystep: 1800 → 4000 tokens
 * - quote: 1000 → 2500 tokens
 * - comparison: 2000 → 4500 tokens
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { kodaPersonaService, KODA_CORE_PERSONA, KODA_DOCUMENT_CITATION_RULES } from './kodaPersona.service';

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

// ============================================================================
// GEMINI CLIENT INITIALIZATION
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================================
// RESPONSE TYPE CLASSIFICATION
// ============================================================================

export enum ResponseType {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  COMPLEX = 'complex',
  EXPLANATION = 'explanation',
  GUIDANCE = 'guidance',
  STEPBYSTEP = 'stepbystep',
  QUOTE = 'quote',
  COMPARISON = 'comparison'
}

export function classifyResponseType(query: string): ResponseType {
  const lowerQuery = query.toLowerCase();

  if (/\b(where\s+does\s+it\s+say|show\s+me\s+the\s+(?:exact\s+)?(?:line|phrase|clause|sentence|paragraph|wording|text)|what'?s?\s+the\s+exact|copy\s+the\s+exact|quote\s+(?:the\s+)?(?:exact\s+)?|verbatim|exact\s+(?:text|phrase|wording|clause)|word\s+for\s+word|cite\s+the)\b/i.test(lowerQuery)) {
    return ResponseType.QUOTE;
  }

  if (/\b(compare|difference\s+between|how\s+(?:do|does|are|is)\s+.+\s+differ|versus|vs\.?|contrast|side\s+by\s+side|which\s+(?:one|document|contract)\s+is\s+(?:better|cheaper|longer|shorter))\b/i.test(lowerQuery)) {
    return ResponseType.COMPARISON;
  }

  if (/^(what is|who is|when|where|which)\s+\w+\??$/i.test(lowerQuery)) {
    return ResponseType.SIMPLE;
  }

  if (/\b(how to|step by step|guide|tutorial|walkthrough|instructions)\b/i.test(lowerQuery)) {
    return ResponseType.STEPBYSTEP;
  }

  if (/\b(explain|why|how does|what does.*mean|clarify|describe)\b/i.test(lowerQuery)) {
    return ResponseType.EXPLANATION;
  }

  if (/\b(should i|recommend|suggest|advice|guidance|best practice)\b/i.test(lowerQuery)) {
    return ResponseType.GUIDANCE;
  }

  if (/\b(analyze|analysis|evaluate|assessment|in-depth|comprehensive|detailed)\b/i.test(lowerQuery)) {
    return ResponseType.COMPLEX;
  }

  return ResponseType.MEDIUM;
}

// ============================================================================
// FIXED TOKEN LIMITS (2-3x INCREASE)
// ============================================================================

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
    targetWords: 150,
    maxTokens: 2500,  // FIXED: 1000 → 2500 (2.5x increase)
    temperature: 0.2,
    topP: 0.95,
    topK: 20,
    bulletPoints: '0-3',
    sections: 1,
    useHeadings: false,
    useThinking: false
  },
  medium: {
    targetWords: 180,
    maxTokens: 3500,  // FIXED: 1500 → 3500 (2.3x increase)
    temperature: 0.4,
    topP: 0.95,
    topK: 40,
    bulletPoints: '3-6',
    sections: '2-3',
    useHeadings: true,
    useThinking: false
  },
  complex: {
    targetWords: 550,
    maxTokens: 6000,  // FIXED: 2500 → 6000 (2.4x increase)
    temperature: 0.5,
    topP: 0.95,
    topK: 64,
    bulletPoints: '8-16',
    sections: '4-7',
    useHeadings: true,
    useThinking: true
  },
  explanation: {
    targetWords: 320,
    maxTokens: 3500,  // FIXED: 1500 → 3500 (2.3x increase)
    temperature: 0.4,
    topP: 0.95,
    topK: 40,
    bulletPoints: '4-10',
    sections: '2-4',
    useHeadings: true,
    useThinking: false
  },
  guidance: {
    targetWords: 250,
    maxTokens: 3000,  // FIXED: 1200 → 3000 (2.5x increase)
    temperature: 0.6,
    topP: 0.95,
    topK: 50,
    bulletPoints: '5-12',
    sections: '2-3',
    useHeadings: true,
    useThinking: false
  },
  stepbystep: {
    targetWords: 350,
    maxTokens: 4000,  // FIXED: 1800 → 4000 (2.2x increase)
    temperature: 0.3,
    topP: 0.95,
    topK: 30,
    bulletPoints: '6-14',
    sections: '3-6',
    useHeadings: true,
    useThinking: false
  },
  quote: {
    targetWords: 150,
    maxTokens: 2500,  // FIXED: 1000 → 2500 (2.5x increase)
    temperature: 0.1,
    topP: 0.9,
    topK: 10,
    bulletPoints: '0-2',
    sections: 1,
    useHeadings: false,
    useThinking: false
  },
  comparison: {
    targetWords: 400,
    maxTokens: 4500,  // FIXED: 2000 → 4500 (2.25x increase)
    temperature: 0.4,
    topP: 0.95,
    topK: 50,
    bulletPoints: '6-12',
    sections: '3-5',
    useHeadings: true,
    useThinking: true
  }
};

// ============================================================================
// COMPLETION VERIFICATION (NEW)
// ============================================================================

function verifyAnswerCompletion(answer: string): { isComplete: boolean; reason?: string } {
  const trimmed = answer.trim();
  
  // Check for incomplete endings
  if (trimmed.endsWith(',')) {
    return { isComplete: false, reason: 'Ends with comma' };
  }
  
  if (trimmed.endsWith(':')) {
    return { isComplete: false, reason: 'Ends with colon' };
  }
  
  if (/\.\.\.$/.test(trimmed)) {
    return { isComplete: false, reason: 'Ends with ellipsis' };
  }
  
  // Check for incomplete list starters
  if (/\b(como|such as|including|e\.g\.|for example|like)\s*$/i.test(trimmed)) {
    return { isComplete: false, reason: 'Incomplete list starter' };
  }
  
  // Check for incomplete sentences
  if (/\b(Indivíduos que|People who|Companies that|Documents that|Files that)\s*$/i.test(trimmed)) {
    return { isComplete: false, reason: 'Incomplete sentence' };
  }
  
  // Check if too short (likely incomplete)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 10) {
    return { isComplete: false, reason: 'Too short (< 10 words)' };
  }
  
  return { isComplete: true };
}

// ============================================================================
// MAIN GENERATION FUNCTION WITH FIXES
// ============================================================================

export async function generateAdaptiveAnswer(
  params: GenerateAnswerParams,
  onChunk?: (chunk: string) => void
): Promise<AnswerResult> {
  
  const { query, context, language = 'pt' } = params;
  
  // Classify response type
  const responseType = classifyResponseType(query);
  const config = FLASH_OPTIMAL_CONFIG[responseType];
  
  console.log(`[AdaptiveAnswer] Query type: ${responseType}, maxTokens: ${config.maxTokens}`);
  
  // Build prompt with language enforcement
  const systemInstruction = `${KODA_CORE_PERSONA}

${KODA_DOCUMENT_CITATION_RULES}

CRITICAL: Answer in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'} ONLY. Do NOT mix languages.`;

  const prompt = `${context || ''}

User question: ${query}

Target length: ~${config.targetWords} words
Sections: ${config.sections}
Bullet points: ${config.bulletPoints}
${config.useHeadings ? 'Use headings (##, ###)' : 'No headings needed'}

Answer in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : 'English'} ONLY.`;

  // Initialize model
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction,
    generationConfig: {
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      maxOutputTokens: config.maxTokens,
      // stopSequences: [] // DISABLED - causes early termination
    }
  });

  let fullResponse = '';
  let retryCount = 0;
  const maxRetries = 2;

  // Retry loop for incomplete answers
  while (retryCount <= maxRetries) {
    try {
      if (onChunk) {
        // Streaming mode with error handling
        const result = await model.generateContentStream(prompt);
        fullResponse = '';

        for await (const chunk of result.stream) {
          try {
            const chunkText = chunk.text();
            fullResponse += chunkText;
            onChunk(chunkText);
          } catch (chunkError) {
            console.error('[AdaptiveAnswer] Error processing chunk:', chunkError);
            // Continue with next chunk
          }
        }
      } else {
        // Non-streaming mode
        const result = await model.generateContent(prompt);
        fullResponse = result.response.text();
      }

      // Verify completion
      const completionCheck = verifyAnswerCompletion(fullResponse);
      
      if (completionCheck.isComplete) {
        console.log(`[AdaptiveAnswer] Answer complete (${fullResponse.split(/\s+/).length} words)`);
        break;
      } else {
        console.warn(`[AdaptiveAnswer] Answer incomplete: ${completionCheck.reason}`);
        
        if (retryCount < maxRetries) {
          console.log(`[AdaptiveAnswer] Retrying (attempt ${retryCount + 2}/${maxRetries + 1})...`);
          retryCount++;
          // Add continuation prompt
          const continuationPrompt = `${prompt}

Previous incomplete answer:
${fullResponse}

Please complete the answer. Continue from where it left off.`;
          
          // Retry with continuation
          const retryResult = await model.generateContent(continuationPrompt);
          fullResponse += ' ' + retryResult.response.text();
        } else {
          console.error(`[AdaptiveAnswer] Max retries reached, returning incomplete answer`);
          break;
        }
      }
    } catch (error) {
      console.error('[AdaptiveAnswer] Generation error:', error);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`[AdaptiveAnswer] Retrying after error (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      } else {
        throw error;
      }
    }
  }

  // Build result
  const wordCount = fullResponse.split(/\s+/).length;
  const estimatedTokens = Math.ceil(wordCount * 1.3);

  return {
    answer: fullResponse,
    content: fullResponse,
    confidence: 0.85,
    sources: [],
    stats: {
      wordCount,
      estimatedTokens,
      compressionRatio: 1.0
    },
    metadata: {
      wordCount,
      estimatedReadTime: Math.ceil(wordCount / 200),
      complexity: responseType === 'simple' ? 'simple' : responseType === 'complex' ? 'complex' : 'medium',
      tone: 'professional'
    }
  };
}

export default {
  generateAdaptiveAnswer,
  classifyResponseType,
  FLASH_OPTIMAL_CONFIG
};
