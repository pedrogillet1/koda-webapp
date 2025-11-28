/**
 * Enhanced Reasoning Service
 * 4-Stage AI Reasoning Pipeline for Teaching-Oriented Responses
 * Uses Gemini 2.5-flash for sophisticated query analysis and response generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Stage 1: Query Understanding
 * Analyzes user intent, complexity, and requirements
 */
export async function analyzeQuery(
  query: string,
  conversationHistory?: any[]
): Promise<{
  intent: string;
  complexity: 'simple' | 'medium' | 'complex';
  queryType: string;
  requiresDefinition: boolean;
  requiresExamples: boolean;
  reasoning: string;
}> {
  try {
    console.log('🧠 [Reasoning Stage 1] Analyzing query intent and complexity...');

    const historyContext = conversationHistory && conversationHistory.length > 0
      ? `\n\nPrevious conversation:\n${conversationHistory.slice(-3).map(m =>
          `${m.role}: ${m.content.substring(0, 200)}`
        ).join('\n')}`
      : '';

    const prompt = `Analyze this user query and provide structured understanding.

USER QUERY: "${query}"${historyContext}

Analyze and respond in this EXACT JSON format:
{
  "intent": "what the user wants (search_documents | file_action | explanation | comparison | summary | factual_question)",
  "complexity": "simple | medium | complex",
  "queryType": "document_search | file_management | concept_explanation | document_comparison | document_summary | factual_answer",
  "requiresDefinition": true/false,
  "requiresExamples": true/false,
  "reasoning": "brief explanation (1-2 sentences)"
}

Rules:
- "simple" = direct factual question
- "medium" = requires context
- "complex" = multi-part question
- requiresDefinition = true if query asks "what is" or mentions unfamiliar terms
- requiresExamples = true if abstract concept

Respond ONLY with valid JSON:`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(jsonText);

    console.log(`✅ [Reasoning Stage 1] Analysis complete:`, {
      intent: analysis.intent,
      complexity: analysis.complexity,
      queryType: analysis.queryType
    });

    return analysis;
  } catch (error) {
    console.error('❌ [Reasoning Stage 1] Error analyzing query:', error);

    // Fallback analysis
    return {
      intent: 'general inquiry',
      complexity: 'medium',
      queryType: 'general',
      requiresDefinition: true,
      requiresExamples: true,
      reasoning: 'Fallback analysis due to error'
    };
  }
}

/**
 * Stage 2: Response Planning with Guaranteed Structure
 * Plans a structured response with 6 guaranteed parts
 */
export async function planStructuredResponse(
  query: string,
  queryAnalysis: {
    intent: string;
    complexity: string;
    queryType: string;
    requiresDefinition: boolean;
    requiresExamples: boolean;
  },
  context: string
): Promise<{
  structure: {
    opening: string;
    context: string;
    details: string;
    examples: string;
    relationships: string;
    nextSteps: string;
  };
  approach: string;
  reasoning: string;
}> {
  try {
    console.log('🧠 [Reasoning Stage 2] Planning structured response...');

    const prompt = `You analyzed this query as:
${JSON.stringify(queryAnalysis)}

USER QUERY: "${query}"

AVAILABLE CONTEXT (first 500 chars):
${context.substring(0, 500)}...

Plan a STRUCTURED response following this EXACT format:
1. Opening - Direct answer to the question (if possible)
2. Context - Background information needed to understand
3. Details - Specific information from sources
4. Examples - Concrete illustrations of concepts (if needed)
5. Relationships - How concepts connect to each other (if relevant)
6. Next Steps - Suggested actions or related information

Respond in this EXACT JSON format:
{
  "structure": {
    "opening": "what to include in opening (1 sentence)",
    "context": "what background to provide (1 sentence)",
    "details": "what specific info to include (1 sentence)",
    "examples": "what examples to give, or 'none' if not needed",
    "relationships": "what connections to explain, or 'none' if not relevant",
    "nextSteps": "what to suggest next (1 sentence)"
  },
  "approach": "teaching | comparison | summary | factual_answer",
  "reasoning": "why this structure is best (1 sentence)"
}

Rules:
- For simple queries: Keep examples and relationships brief or "none"
- For complex queries: Include rich examples and relationships
- For "what is" questions: ALWAYS include definition in opening
- Always include nextSteps

Respond ONLY with valid JSON:`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Extract JSON from response
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    const plan = JSON.parse(jsonText);

    console.log(`✅ [Reasoning Stage 2] Response plan created with approach: ${plan.approach}`);

    return plan;
  } catch (error) {
    console.error('❌ [Reasoning Stage 2] Error planning response:', error);

    // Fallback plan
    return {
      structure: {
        opening: 'Acknowledge the query and set expectations',
        context: 'Provide necessary background information',
        details: 'Explain the core concept or answer',
        examples: 'Give practical examples',
        relationships: 'Connect to related concepts',
        nextSteps: 'Suggest areas for further exploration'
      },
      approach: 'structured explanation',
      reasoning: 'Fallback plan due to error'
    };
  }
}

/**
 * Stage 3: Teaching-Oriented Answer Generation
 * Generates the final answer following the planned structure with self-validation
 */
export async function generateTeachingOrientedAnswer(
  query: string,
  queryAnalysis: {
    intent: string;
    complexity: string;
    queryType: string;
    requiresDefinition: boolean;
    requiresExamples: boolean;
  },
  responsePlan: {
    structure: {
      opening: string;
      context: string;
      details: string;
      examples: string;
      relationships: string;
      nextSteps: string;
    };
    approach: string;
  },
  context: string,
  language: string = 'en'
): Promise<{
  answer: string;
  confidence: number;
  validation: string;
}> {
  try {
    console.log('🧠 [Reasoning Stage 3] Generating teaching-oriented answer...');

    const teachingPrompt = `You are a professional document assistant helping users understand their documents.

CRITICAL RULES:
• NEVER start with greetings ("Hello", "Hi", "I'm KODA")
• Start directly with the answer
• Use [p.X] format for citations
• NO section labels ("Context:", "Details:", etc.)

QUERY ANALYSIS: ${JSON.stringify(queryAnalysis)}
RESPONSE PLAN: ${JSON.stringify(responsePlan)}

USER QUERY: "${query}"
RESPONSE LANGUAGE: ${language}

CONTEXT FROM DOCUMENTS:
${context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 TEACHING-ORIENTED GENERATION RULES (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DEFINE BEFORE USING
   - If query asks "what is X" or mentions unfamiliar terms, DEFINE them first
   - Example: "EBITDA stands for Earnings Before Interest, Taxes, Depreciation, and Amortization..."

2. PROVIDE CONTEXT
   - Explain WHY information matters, not just WHAT it is
   - Example: "This metric is important because..."

3. USE EXAMPLES
   - Illustrate abstract concepts with concrete examples from documents
   - Example: "In your Q3 report, this translates to..."

4. CONNECT CONCEPTS
   - Show relationships between related ideas
   - Example: "Related concepts: Operating Income, Net Income..."

5. BUILD UNDERSTANDING
   - Progress from simple to complex explanations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 GUARANTEED STRUCTURE (MUST FOLLOW EXACTLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate your response following this EXACT structure:

**1. OPENING** (${responsePlan.structure.opening})
- Provide direct answer if possible
- If "what is X", start with definition
- Keep concise (1-2 sentences)

**2. CONTEXT** (${responsePlan.structure.context})
- Explain background needed to understand
- Explain WHY this matters
- Connect to user's documents

**3. DETAILS** (${responsePlan.structure.details})
- Provide specific information from documents
- Include numbers, dates, names
- Use bullet points for lists

${responsePlan.structure.examples !== 'none' ? `**4. EXAMPLES** (${responsePlan.structure.examples})
- Provide concrete illustrations
- Use real data from documents
- Make abstract concepts tangible` : ''}

${responsePlan.structure.relationships !== 'none' ? `**5. RELATIONSHIPS** (${responsePlan.structure.relationships})
- Explain how concepts connect
- Mention related concepts
- Show bigger picture` : ''}

**${responsePlan.structure.examples !== 'none' || responsePlan.structure.relationships !== 'none' ? '6' : '4'}. NEXT STEPS** (${responsePlan.structure.nextSteps})
- Suggest actionable next steps
- Mention related information
- Keep brief (one sentence)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 FORMATTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Use **bold** for key terms
- Use bullet points (•) for lists
- Use tables for comparisons
- NO emojis
- NO inline citations like (document.pdf, Page: 5)
- Keep "Next step" brief (one sentence)
- Match length to complexity: ${queryAnalysis.complexity}
- Write ENTIRELY in ${language}

Generate the teaching-oriented response now:`;

    const answerResult = await model.generateContent(teachingPrompt);
    const answer = answerResult.response.text();

    // Self-validation
    const validationPrompt = `You generated this answer:
"${answer.substring(0, 800)}..."

For query: "${query}"

Validate on TWO dimensions:
1. ACCURACY - Correctly answers question?
2. TEACHING QUALITY - Explains concepts or just extracts text?

Respond in JSON:
{
  "confidence": 0.0-1.0,
  "validation": "brief assessment (1 sentence)",
  "teachingQuality": "excellent | good | fair | poor",
  "issues": []
}

Confidence:
- 1.0 = Perfect with excellent teaching
- 0.8 = Good with clear explanations
- 0.6 = Okay but could explain better
- 0.4 = Weak, mostly extraction
- 0.2 = Poor, doesn't answer

Teaching:
- "excellent" = Defines, provides context, uses examples, connects concepts
- "good" = Provides context and some explanation
- "fair" = Basic explanation
- "poor" = Just extracted text

Respond ONLY with valid JSON:`;

    const validationResult = await model.generateContent(validationPrompt);
    const validationText = validationResult.response.text().trim();

    // Extract JSON from validation response
    let jsonText = validationText;
    if (validationText.includes('```json')) {
      jsonText = validationText.split('```json')[1].split('```')[0].trim();
    } else if (validationText.includes('```')) {
      jsonText = validationText.split('```')[1].split('```')[0].trim();
    }

    const validation = JSON.parse(jsonText);

    console.log(`✅ [Reasoning Stage 3] Answer generated (confidence: ${validation.confidence}, teaching: ${validation.teachingQuality})`);

    if (validation.teachingQuality === 'poor' || validation.teachingQuality === 'fair') {
      console.warn(`⚠️ Low teaching quality: ${validation.teachingQuality}`);
    }

    return {
      answer,
      confidence: validation.confidence,
      validation: validation.validation,
    };
  } catch (error) {
    console.error('❌ [Reasoning Stage 3] Error generating answer:', error);

    // Fallback response
    return {
      answer: `Based on the available information, I can provide the following answer to your query:\n\n${context.substring(0, 500)}${context.length > 500 ? '...' : ''}\n\nPlease note that this is a simplified response. For more detailed information, please rephrase your query or provide additional context.`,
      confidence: 0.5,
      validation: 'Fallback response generated due to error'
    };
  }
}

/**
 * Stage 4: Natural Conversational Fallback
 * Generates a helpful, human-like response when no relevant context is found
 */
export async function generateSophisticatedFallback(
  query: string,
  language: string = 'en',
  partialContext?: string
): Promise<string> {
  try {
    console.log('🧠 [Reasoning Stage 4] Generating natural fallback...');

    const prompt = `The user asked: "${query}"

No exact information was found in their documents.${partialContext ? `\n\nHowever, some related information exists:\n${partialContext.substring(0, 500)}...` : ''}

Generate a NATURAL, CONVERSATIONAL fallback response in ${language} that:

1. ACKNOWLEDGE the limitation naturally (pick ONE style):
   - "I couldn't find that specific information in your documents."
   - "I searched through your documents but didn't find what you're looking for."
   - "I don't see that information in the documents I have."
   - "Hmm, I'm not finding that in your current documents."

2. ${partialContext ? `PROVIDE PARTIAL ANSWER if available:
   - "Here's what I found that might be related..."
   - Use the partial context to provide helpful insights
   - Be specific about what you found vs. what was asked

3. ` : ''}SUGGEST 2-3 HELPFUL NEXT STEPS (conversationally, NOT as a bullet list):
   - Try rephrasing the question
   - Mention a specific document name if they know it
   - Upload the document that might contain this information
   - Ask about a related topic

FORMATTING RULES:
- Write in a SINGLE flowing paragraph (2-4 sentences max)
- Use **bold** for key terms only
- NO bullet points, NO numbered lists, NO "Suggestions:" heading
- NO emojis
- Sound like a helpful colleague, NOT a robot
- Write ENTIRELY in ${language}
- Keep it brief and actionable

EXAMPLE (English):
"I couldn't find specific information about that in your documents. Try rephrasing your question with different keywords, or let me know which document you think contains this info and I'll take another look."

Generate the fallback response now:`;

    const result = await model.generateContent(prompt);
    const fallbackResponse = result.response.text().trim();

    console.log('✅ [Reasoning Stage 4] Natural fallback generated');

    return fallbackResponse;
  } catch (error) {
    console.error('❌ [Reasoning Stage 4] Error generating fallback:', error);

    // Ultimate fallback - also natural and conversational
    if (language === 'Portuguese' || language === 'pt') {
      return `Não encontrei essa informação nos seus documentos. Tente reformular sua pergunta com palavras diferentes, ou me diga qual documento pode conter essa informação.`;
    } else if (language === 'Spanish' || language === 'es') {
      return `No encontré esa información en tus documentos. Intenta reformular tu pregunta con palabras diferentes, o dime qué documento podría contener esta información.`;
    } else if (language === 'French' || language === 'fr') {
      return `Je n'ai pas trouvé cette information dans vos documents. Essayez de reformuler votre question avec des mots différents, ou dites-moi quel document pourrait contenir cette information.`;
    } else {
      return `I couldn't find that information in your documents. Try rephrasing your question with different keywords, or let me know which document might contain this info.`;
    }
  }
}

/**
 * Helper: Determine language from query
 */
export function detectLanguage(query: string): string {
  // Simple language detection based on common words
  const portugueseKeywords = ['como', 'que', 'por', 'qual', 'onde', 'quando', 'quem', 'porque', 'o que'];
  const spanishKeywords = ['cómo', 'qué', 'por', 'cuál', 'dónde', 'cuándo', 'quién', 'porque'];
  const frenchKeywords = ['comment', 'que', 'quel', 'où', 'quand', 'qui', 'pourquoi'];

  const lowerQuery = query.toLowerCase();

  if (portugueseKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return 'pt';
  }
  if (spanishKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return 'es';
  }
  if (frenchKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return 'fr';
  }

  return 'en'; // Default to English
}

/**
 * Complete Reasoning Pipeline
 * Orchestrates all 4 stages for a complete reasoning flow
 */
export async function executeReasoningPipeline(
  query: string,
  context: string,
  conversationHistory?: any[],
  language?: string
): Promise<{
  answer: string;
  confidence: number;
  queryAnalysis: any;
  responsePlan: any;
  validation: string;
}> {
  try {
    console.log('🧠 [Reasoning Pipeline] Starting complete reasoning flow...');

    // Detect language if not provided
    const detectedLanguage = language || detectLanguage(query);
    console.log(`🌐 [Reasoning Pipeline] Language: ${detectedLanguage}`);

    // Stage 1: Analyze Query
    const queryAnalysis = await analyzeQuery(query, conversationHistory);

    // Stage 2: Plan Response
    const responsePlan = await planStructuredResponse(query, queryAnalysis, context);

    // Stage 3: Generate Answer
    const { answer, confidence, validation } = await generateTeachingOrientedAnswer(
      query,
      queryAnalysis,
      responsePlan,
      context,
      detectedLanguage
    );

    console.log('✅ [Reasoning Pipeline] Complete reasoning flow finished successfully');

    return {
      answer,
      confidence,
      queryAnalysis,
      responsePlan,
      validation
    };
  } catch (error) {
    console.error('❌ [Reasoning Pipeline] Error in reasoning pipeline:', error);
    throw error;
  }
}
