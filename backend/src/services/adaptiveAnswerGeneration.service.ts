/**
 * Adaptive Answer Generation Service
 *
 * Implements ChatGPT and Gemini quality standards for answer generation.
 *
 * RESEARCH FINDINGS:
 *
 * ChatGPT Standards:
 * - Length: ~30% of original document
 * - Quality Score: 90/100
 * - Accuracy: 92.5/100
 * - Structure: Varied (headings, lists, emphasis)
 * - Tone: Natural, conversational
 *
 * Gemini Standards:
 * - Clear and specific instructions
 * - Explicit format constraints
 * - Few-shot prompting with examples
 * - Chain of thought for complex queries
 * - Structured response format
 *
 * Manus Standards:
 * - Context engineering (append-only, stable prompts)
 * - Structured variation in responses
 * - Natural, non-robotic tone
 * - 100:1 input-output ratio
 *
 * This service combines all three approaches for optimal quality.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Helper function to detect emojis in text (ES5 compatible)
 * Checks for common emoji Unicode ranges
 */
function containsEmoji(text: string): boolean {
  // Check for emoji surrogate pairs and common emoji ranges
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // High surrogate (emoji pairs start here: 0xD800-0xDBFF)
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = text.charCodeAt(i + 1);
      // Low surrogate follows (0xDC00-0xDFFF)
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        // Calculate the actual Unicode code point
        const codePoint = (code - 0xd800) * 0x400 + (nextCode - 0xdc00) + 0x10000;

        // Emoji ranges in supplementary planes
        if (
          (codePoint >= 0x1f600 && codePoint <= 0x1f64f) || // Emoticons
          (codePoint >= 0x1f300 && codePoint <= 0x1f5ff) || // Misc Symbols and Pictographs
          (codePoint >= 0x1f680 && codePoint <= 0x1f6ff) || // Transport and Map
          (codePoint >= 0x1f1e0 && codePoint <= 0x1f1ff) || // Flags
          (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) || // Supplemental Symbols
          (codePoint >= 0x1fa00 && codePoint <= 0x1fa6f) || // Chess, Extended-A
          (codePoint >= 0x1fa70 && codePoint <= 0x1faff) // Symbols Extended-A
        ) {
          return true;
        }
      }
    }

    // Basic emoji ranges in BMP
    if (
      (code >= 0x2600 && code <= 0x26ff) || // Misc symbols
      (code >= 0x2700 && code <= 0x27bf) || // Dingbats
      (code >= 0x231a && code <= 0x231b) || // Watch, Hourglass
      (code >= 0x23e9 && code <= 0x23f3) || // Media controls
      (code >= 0x23f8 && code <= 0x23fa) || // More media
      (code >= 0x25aa && code <= 0x25ab) || // Squares
      (code >= 0x25b6 && code <= 0x25c0) || // Triangles
      (code >= 0x25fb && code <= 0x25fe) || // More squares
      code === 0x2614 || // Umbrella
      code === 0x2615 || // Hot beverage
      code === 0x2934 || // Arrow
      code === 0x2935 // Arrow
    ) {
      return true;
    }
  }

  return false;
}

export interface DocumentInfo {
  title: string;
  pageCount: number;
  wordCount?: number;
  type: string; // 'pdf', 'docx', 'txt', etc.
  authors?: string[];
  year?: number;
}

export interface AnswerGenerationConfig {
  query: string;
  documentContext: string;
  documentInfo?: DocumentInfo;
  conversationHistory?: Array<{ role: string; content: string }>;
  answerLength?: 'short' | 'medium' | 'long' | 'adaptive';
  language?: string;
  includeMetadata?: boolean;
  includeImplications?: boolean;
}

export interface GeneratedAnswer {
  content: string;
  metadata?: {
    documentTitle?: string;
    authors?: string[];
    year?: number;
    pageCount?: number;
  };
  stats: {
    wordCount: number;
    estimatedTokens: number;
    compressionRatio: number; // Answer length / Document length
  };
}

export interface AnswerLengthConfig {
  targetWords: number;
  targetParagraphs: number;
  description: string;
}

/**
 * Determine optimal answer length based on document size
 * Implements adaptive scaling like ChatGPT
 */
export function determineAnswerLength(
  documentInfo?: DocumentInfo,
  requestedLength?: 'short' | 'medium' | 'long' | 'adaptive'
): AnswerLengthConfig {
  if (!documentInfo || requestedLength !== 'adaptive') {
    // Use requested length or default to medium
    const lengthMap: Record<string, AnswerLengthConfig> = {
      short: { targetWords: 150, targetParagraphs: 2, description: '1-2 paragraphs' },
      medium: { targetWords: 400, targetParagraphs: 4, description: '3-5 paragraphs' },
      long: { targetWords: 800, targetParagraphs: 8, description: '6-10 paragraphs' },
      adaptive: { targetWords: 400, targetParagraphs: 4, description: '3-5 paragraphs' },
    };
    return lengthMap[requestedLength || 'medium'];
  }

  // Adaptive scaling based on document size
  const { pageCount, wordCount } = documentInfo;
  const estimatedWords = wordCount || pageCount * 300; // Estimate 300 words/page

  if (estimatedWords < 500) {
    // Very short document (1-2 pages)
    return {
      targetWords: 100,
      targetParagraphs: 2,
      description: '1-2 concise paragraphs summarizing key points',
    };
  } else if (estimatedWords < 1500) {
    // Short document (2-5 pages)
    return {
      targetWords: 200,
      targetParagraphs: 3,
      description: '2-3 paragraphs covering main findings',
    };
  } else if (estimatedWords < 5000) {
    // Medium document (5-20 pages)
    return {
      targetWords: 400,
      targetParagraphs: 5,
      description: '4-5 paragraphs with structured summary',
    };
  } else if (estimatedWords < 50000) {
    // Long document (20-150 pages)
    return {
      targetWords: 600,
      targetParagraphs: 7,
      description: '6-8 paragraphs with detailed analysis',
    };
  } else {
    // Very long document (150+ pages, like a book)
    return {
      targetWords: 800,
      targetParagraphs: 10,
      description: 'Comprehensive multi-section summary with chapter breakdown',
    };
  }
}

/**
 * Build answer generation prompt using ChatGPT/Gemini best practices
 *
 * KEY TECHNIQUES:
 * 1. Clear and specific instructions (Gemini)
 * 2. Multiple tone words to prevent exaggeration (ChatGPT)
 * 3. Example-based training (ChatGPT best method)
 * 4. Explicit format constraints (Gemini)
 * 5. Few-shot prompting (Gemini)
 */
export function buildAnswerPrompt(config: AnswerGenerationConfig): string {
  const {
    query,
    documentContext,
    documentInfo,
    answerLength = 'adaptive',
    language = 'en',
    includeMetadata = true,
    includeImplications = true,
  } = config;

  // Determine optimal length
  const lengthConfig = determineAnswerLength(documentInfo, answerLength);

  // Language-specific instructions
  const languageMap: Record<string, string> = {
    en: 'English',
    pt: 'Portuguese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    nl: 'Dutch',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
  };
  const languageName = languageMap[language] || 'English';

  // Build metadata section if available
  const metadataSection =
    includeMetadata && documentInfo
      ? `
**Document Metadata to Include:**
- Title: ${documentInfo.title}
${documentInfo.authors ? `- Authors: ${documentInfo.authors.join(', ')}` : ''}
${documentInfo.year ? `- Year: ${documentInfo.year}` : ''}
${documentInfo.pageCount ? `- Length: ${documentInfo.pageCount} pages` : ''}
`
      : '';

  // Build implications section
  const implicationsSection = includeImplications
    ? `
**Implications and Context:**
- Explain WHY this matters, not just WHAT it says
- Connect findings to broader context or practical applications
- Identify key insights that aren't immediately obvious
`
    : '';

  // Structure instructions based on length
  const structureInstructions =
    lengthConfig.targetParagraphs <= 3
      ? `
- Start with a direct answer to the question
- Add supporting details and context
- Keep it concise and focused
`
      : `
- Start with a clear introduction answering the main question
- Break content into ${lengthConfig.targetParagraphs} logical paragraphs
- Use headings (##) to organize sections if needed
- Use bullet points for lists of 4+ items
- Use tables to compare 2+ entities
- End with key takeaways or implications
`;

  // Build the prompt using best practices
  return `**CRITICAL - RESPONSE LANGUAGE: ${languageName.toUpperCase()}**
You MUST respond ENTIRELY in **${languageName}**. The user asked their question in ${languageName}, so your response MUST be in ${languageName}.
- Do NOT respond in French, Portuguese, Spanish, or any other language unless ${languageName} IS that language.
- Even if the document content is in a different language, translate and respond in ${languageName}.
- This is NON-NEGOTIABLE.

You are answering a question about a document. Provide a natural, conversational, and comprehensive answer in ${languageName}.

**QUERY:**
${query}

**DOCUMENT INFORMATION:**
${documentContext}

**ANSWER REQUIREMENTS:**

**Length:** ${lengthConfig.description} (~${lengthConfig.targetWords} words)

**Tone:** Natural, conversational, professional, and helpful
- Write like a knowledgeable friend explaining something interesting
- Use multiple tone descriptors to prevent exaggeration
- Be warm and engaging, not robotic or overly formal

**Structure:**
${structureInstructions}

**Formatting:**
- Use **bold** for key terms, numbers, dates, and important findings
- Break paragraphs after 3-4 sentences maximum
- Vary sentence length: mix short (5-10 words), medium (11-20), and long (21-35)
- NO code blocks (unless showing actual code)
- NO explicit citations like "According to the document..." (sources shown separately)

${metadataSection}

**Content Quality Standards:**
1. **Quantitative Context**: Add numbers and percentages ("45% of total", "6x higher")
2. **Categorical Grouping**: Group items by type ("primarily reports (32) and contracts (18)")
3. **Temporal Context**: Include time periods ("from 2020-2024", "down from $10,041 in 2019")
4. **Significance**: For complex queries, add insights ("Notably...", "This indicates...")
5. **Examples**: Provide concrete examples from the document when explaining concepts

${implicationsSection}

**Language:**
- Respond ENTIRELY in **${languageName}**
- Use natural phrasing for ${languageName}, not literal translations
- Maintain cultural context appropriate for ${languageName} speakers

**Example of Good Answer Structure:**

For a query like "What is this document about?":

"""
This document, titled "Sharpening Shapley Allocation: from Basel 2.5 to FRTB," is a research paper by Marco Scaringi and Marco Bianchetti that explores risk allocation strategies in financial risk management. The study provides a systematic review of major risk allocation approaches, comparing their theoretical properties, practical advantages, and limitations.

The authors establish a comprehensive testing framework using both simplified configurations and realistic financial portfolios under regulations like Basel 2.5 and FRTB (Fundamental Review of the Trading Book). They develop and test innovative solutions for managing negative risk allocations and multi-level risk allocations while maintaining the additivity property.

The results indicate that the Shapley allocation strategy offers the best balance between simplicity, mathematical properties, risk representation, and computational cost. Efficiency is maintained even with many business units, especially when using effective Monte Carlo simulation. While the empirical applications focus on market risk, the methodological framework is general and applicable to other financial contexts, such as valuation risk, liquidity risk, credit risk, and counterparty credit risk.

**Key Takeaway:** The Shapley allocation method emerges as the most practical and theoretically sound approach for risk allocation across diverse financial applications.
"""

Notice:
- Starts with document metadata naturally integrated
- Uses **bold** for key terms and findings
- Breaks into logical paragraphs (3-4 sentences each)
- Adds context and implications
- Ends with a clear takeaway
- Natural, conversational tone
- No explicit citations

Now, answer the user's query following these guidelines.`;
}

/**
 * Generate answer using adaptive prompt
 */
export async function generateAdaptiveAnswer(
  config: AnswerGenerationConfig,
  onChunk?: (chunk: string) => void
): Promise<GeneratedAnswer> {
  const prompt = buildAnswerPrompt(config);

  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7, // Higher for more natural variation
      maxOutputTokens: 2000,
    },
  });

  let fullAnswer = '';

  if (onChunk) {
    // Streaming generation
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullAnswer += chunkText;
      onChunk(chunkText);
    }
  } else {
    // Non-streaming generation
    const result = await model.generateContent(prompt);
    fullAnswer = result.response.text();
  }

  // Calculate stats
  const wordCount = fullAnswer.split(/\s+/).length;
  const estimatedTokens = Math.ceil(fullAnswer.length / 4);
  const documentWordCount =
    config.documentInfo?.wordCount || (config.documentInfo?.pageCount || 1) * 300;
  const compressionRatio = wordCount / documentWordCount;

  return {
    content: fullAnswer,
    metadata:
      config.includeMetadata && config.documentInfo
        ? {
            documentTitle: config.documentInfo.title,
            authors: config.documentInfo.authors,
            year: config.documentInfo.year,
            pageCount: config.documentInfo.pageCount,
          }
        : undefined,
    stats: {
      wordCount,
      estimatedTokens,
      compressionRatio,
    },
  };
}

/**
 * Quality validation result interface
 */
export interface QualityValidationResult {
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

/**
 * Validate generated answer quality
 * Checks against ChatGPT/Gemini standards
 */
export function validateAnswerQuality(answer: GeneratedAnswer): QualityValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const { content, stats } = answer;

  // Check length (should be ~30% of original like ChatGPT)
  if (stats.compressionRatio > 0.5) {
    issues.push('Answer is too long relative to document (>50% of original)');
    suggestions.push('Reduce length to ~30% of original document');
    score -= 10;
  }

  // Check for robotic phrases
  const roboticPhrases = [
    'According to the document',
    'Based on the file',
    'In the document',
    'The document states',
  ];
  roboticPhrases.forEach((phrase) => {
    if (content.includes(phrase)) {
      issues.push(`Contains robotic phrase: "${phrase}"`);
      suggestions.push('State facts directly without explicit citations');
      score -= 5;
    }
  });

  // Check for structure (headings, bold, bullets)
  const hasHeadings = content.includes('##') || content.includes('**');
  const hasBullets = content.includes('- ') || content.includes('* ');

  if (!hasHeadings && stats.wordCount > 200) {
    issues.push('Missing visual structure (no headings or bold text)');
    suggestions.push('Add headings and bold key terms for better readability');
    score -= 10;
  }

  // Check paragraph length
  const paragraphs = content.split('\n\n');
  const longParagraphs = paragraphs.filter((p) => {
    const sentences = p.split(/[.!?]+/).length;
    return sentences > 5;
  });

  if (longParagraphs.length > 0) {
    issues.push(`${longParagraphs.length} paragraphs are too long (>5 sentences)`);
    suggestions.push('Break paragraphs after 3-4 sentences');
    score -= 5;
  }

  // Check for emojis (should not have any unless document-specific)
  // Using a more comprehensive emoji regex pattern (ES5 compatible)
  const hasEmoji = containsEmoji(content);
  if (hasEmoji) {
    issues.push('Contains emojis (not professional)');
    suggestions.push('Remove emojis for professional tone');
    score -= 5;
  }

  // Bonus for good structure
  if (hasBullets && stats.wordCount > 300) {
    score = Math.min(100, score + 5);
  }

  return {
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}

/**
 * Adaptive Answer Generation Service class for dependency injection
 */
export class AdaptiveAnswerGenerationService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || '');
  }

  /**
   * Determine answer length based on document info
   */
  determineAnswerLength = determineAnswerLength;

  /**
   * Build the answer prompt
   */
  buildAnswerPrompt = buildAnswerPrompt;

  /**
   * Generate an adaptive answer
   */
  async generateAnswer(
    config: AnswerGenerationConfig,
    onChunk?: (chunk: string) => void
  ): Promise<GeneratedAnswer> {
    return generateAdaptiveAnswer(config, onChunk);
  }

  /**
   * Validate answer quality
   */
  validateQuality = validateAnswerQuality;
}

// Export singleton instance
export const adaptiveAnswerGenerationService = new AdaptiveAnswerGenerationService();

export default {
  determineAnswerLength,
  buildAnswerPrompt,
  generateAdaptiveAnswer,
  validateAnswerQuality,
  AdaptiveAnswerGenerationService,
  adaptiveAnswerGenerationService,
};
