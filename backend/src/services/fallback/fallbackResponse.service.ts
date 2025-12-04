/**
 * Fallback Response Generator Service
 *
 * Generates natural, helpful fallback responses using AI.
 * Implements psychological safety principles:
 * - Never blame the user
 * - Always offer alternatives
 * - Maintain competence
 * - Understand intent
 *
 * NO SAFETY FALLBACK - User data is always accessible
 */

import geminiClient from '../geminiClient.service';
import { FallbackType } from './fallbackDetection.service';

export interface FallbackContext {
  query: string;
  fallbackType: FallbackType;
  reason: string;
  documentCount: number;
  documentNames?: string[];
  ragResults?: any[];
  errorDetails?: string;
  language: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

class FallbackResponseService {
  /**
   * Generate fallback response based on type and context
   * FIX: Added validation to ensure non-empty responses
   */
  async generateFallbackResponse(context: FallbackContext): Promise<string> {
    let response = '';

    try {
      switch (context.fallbackType) {
        case 'clarification':
          response = await this.generateClarificationFallback(context);
          break;

        case 'knowledge':
          response = await this.generateKnowledgeFallback(context);
          break;

        case 'refusal':
          response = await this.generateRefusalFallback(context);
          break;

        case 'error_recovery':
          response = await this.generateErrorRecoveryFallback(context);
          break;

        default:
          response = '';
      }
    } catch (error) {
      console.error('[FALLBACK] Error generating response:', error);
      response = '';
    }

    // FIX: Validate response is not empty
    if (!response || response.trim().length === 0) {
      console.warn('[FALLBACK] Empty response generated, using default fallback');
      response = this.getDefaultFallback(context.fallbackType, context.language);
    }

    return response;
  }

  /**
   * Get default fallback when LLM fails to generate response
   */
  private getDefaultFallback(type: FallbackType, language: string): string {
    const isPortuguese = language.toLowerCase().includes('portuguese') || language === 'pt';
    const isSpanish = language.toLowerCase().includes('spanish') || language === 'es';

    const defaults: Record<FallbackType, { en: string; pt: string; es: string }> = {
      clarification: {
        en: "I'd like to help you find that information. Could you provide more details about which document or topic you're asking about?",
        pt: "Gostaria de ajudá-lo a encontrar essa informação. Poderia fornecer mais detalhes sobre qual documento ou tópico você está perguntando?",
        es: "Me gustaría ayudarte a encontrar esa información. ¿Podrías proporcionar más detalles sobre qué documento o tema estás preguntando?"
      },
      knowledge: {
        en: "I searched through your documents but couldn't find that specific information. Try rephrasing your question or let me know which document might contain this.",
        pt: "Pesquisei em seus documentos, mas não encontrei essa informação específica. Tente reformular sua pergunta ou me diga qual documento pode conter isso.",
        es: "Busqué en tus documentos pero no pude encontrar esa información específica. Intenta reformular tu pregunta o dime qué documento podría contener esto."
      },
      refusal: {
        en: "I focus on analyzing documents and helping you find information within them. Is there something specific about your documents I can help with?",
        pt: "Eu me concentro em analisar documentos e ajudá-lo a encontrar informações neles. Há algo específico sobre seus documentos com que eu possa ajudar?",
        es: "Me enfoco en analizar documentos y ayudarte a encontrar información en ellos. ¿Hay algo específico sobre tus documentos con lo que pueda ayudarte?"
      },
      error_recovery: {
        en: "I ran into an issue processing that request. Could you try rephrasing your question or asking about something else?",
        pt: "Encontrei um problema ao processar essa solicitação. Você poderia tentar reformular sua pergunta ou perguntar sobre outra coisa?",
        es: "Tuve un problema al procesar esa solicitud. ¿Podrías intentar reformular tu pregunta o preguntar sobre otra cosa?"
      },
      none: {
        en: "I'm here to help with your documents. What would you like to know?",
        pt: "Estou aqui para ajudar com seus documentos. O que você gostaria de saber?",
        es: "Estoy aquí para ayudarte con tus documentos. ¿Qué te gustaría saber?"
      }
    };

    const fallback = defaults[type] || defaults.knowledge;
    return isPortuguese ? fallback.pt : isSpanish ? fallback.es : fallback.en;
  }

  /**
   * Generate clarification fallback (ambiguous query)
   */
  private async generateClarificationFallback(context: FallbackContext): Promise<string> {
    const { query, reason, documentCount, documentNames, language } = context;

    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    });

    const documentList =
      documentNames && documentNames.length > 0
        ? documentNames.slice(0, 5).map((name) => `- ${name}`).join('\n')
        : 'Multiple documents available';

    const prompt = `Generate a helpful clarification request for an ambiguous query.

**Context:**
- User query: "${query}"
- Reason for clarification: ${reason}
- User has ${documentCount} document${documentCount !== 1 ? 's' : ''}
- Language: ${language}

**Available documents:**
${documentList}

**Psychological Safety Principles:**
1. DON'T blame the user ("Your question is unclear")
2. DO acknowledge their intent ("I want to help you find...")
3. DO offer 2-3 specific alternatives
4. DO maintain competence ("I can help once I understand...")
5. DO be warm and encouraging

**Structure:**
1. Acknowledge intent (1 sentence)
2. Explain what's ambiguous (1 sentence)
3. Offer 2-3 specific alternatives (bullet points or questions)
4. Invite them to clarify

**Example GOOD response:**
"I want to help you find that information. I see you're asking about 'the report,' but you have 3 reports uploaded:
- Q4 Financial Report
- Market Analysis Report
- Customer Feedback Report

Which one are you interested in, or would you like me to search all of them?"

**Example BAD response:**
"Your question is too vague. Please be more specific about which document you mean." (blames user, no alternatives)

**Requirements:**
- Keep under 150 words
- Be specific (reference actual documents if possible)
- NO emojis
- Respond in ${language}

Generate the clarification request now:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Generate knowledge fallback (information not found)
   */
  private async generateKnowledgeFallback(context: FallbackContext): Promise<string> {
    const { query, reason, documentCount, documentNames, language } = context;

    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
      },
    });

    // Analyze what documents DO contain
    const documentList =
      documentNames && documentNames.length > 0
        ? documentNames.slice(0, 5).map((name) => `- ${name}`).join('\n')
        : 'Your uploaded documents';

    const hasDocuments = documentCount > 0;

    const prompt = `Generate a helpful response when information isn't found in documents.

**Context:**
- User query: "${query}"
- Reason: ${reason}
- User has ${documentCount} document${documentCount !== 1 ? 's' : ''}
- ${hasDocuments ? 'Documents available' : 'No documents uploaded'}
- Language: ${language}

${hasDocuments ? `**Available documents:**\n${documentList}` : ''}

**Psychological Safety Principles:**
1. DON'T say "I don't know" or "I can't find it" (sounds incompetent)
2. DO acknowledge what you searched ("I looked through your documents...")
3. DO offer alternatives (related information, different approach)
4. DO redirect to what you CAN do
5. DO maintain confidence and competence

**Structure:**
1. Acknowledge the search (1 sentence)
2. Explain what you found (or didn't find) (1 sentence)
3. Offer 2-3 alternatives:
   - Related information you DO have
   - Different way to phrase the question
   - Suggestion to upload relevant document
4. Invite them to try alternatives

**Example GOOD response (has documents):**
"I searched through your 3 financial documents but didn't find specific information about Q3 revenue. However, I can see:
- Q4 revenue data in your Financial Report
- Annual revenue summary in your Budget spreadsheet

Would you like to know about Q4 instead, or could the information be in a different document?"

**Example GOOD response (no documents):**
"I'd love to help you find that information. To answer questions about your data, I'll need you to upload the relevant documents first. Once you do, I can search, summarize, and analyze them for you."

**Example BAD response:**
"I don't have that information. Try uploading more documents." (sounds incompetent, unhelpful)

**Requirements:**
- Keep under 200 words
- Be specific about what you searched
- Offer concrete alternatives
- NO emojis
- Respond in ${language}

Generate the knowledge fallback response now:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Generate refusal fallback (outside capabilities)
   */
  private async generateRefusalFallback(context: FallbackContext): Promise<string> {
    const { query, documentCount, language } = context;

    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    });

    const prompt = `Generate a polite refusal for a request outside Koda's capabilities.

**Context:**
- User query: "${query}"
- Reason for refusal: Request is outside document analysis capabilities
- User has ${documentCount} document${documentCount !== 1 ? 's' : ''}
- Language: ${language}

**Psychological Safety Principles:**
1. DON'T say "I can't do that" (sounds limiting)
2. DO explain what you CAN do instead
3. DO acknowledge their intent
4. DO redirect to your strengths
5. DO maintain helpfulness

**Structure:**
1. Acknowledge their request (1 sentence)
2. Explain limitation briefly (1 sentence)
3. Redirect to what you CAN do (2-3 alternatives)
4. Offer to help in your area of strength

**Example GOOD response:**
"I understand you're looking for real-time stock prices. I focus on analyzing documents rather than live data, but I can help you:
- Analyze historical price data if you have it in a spreadsheet
- Summarize financial reports about the company
- Compare data across multiple documents

Would any of those help?"

**Example BAD response:**
"I can't access real-time data. That's not what I do." (negative, unhelpful, no alternatives)

**Requirements:**
- Keep under 150 words
- Focus on what you CAN do (not what you can't)
- Offer 2-3 concrete alternatives
- NO emojis
- Respond in ${language}

Generate the refusal response now:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Generate error recovery fallback (technical error)
   */
  private async generateErrorRecoveryFallback(context: FallbackContext): Promise<string> {
    const { query, errorDetails, language } = context;

    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.6, // Lower temperature for consistency
        maxOutputTokens: 250,
      },
    });

    const prompt = `Generate a helpful error recovery message.

**Context:**
- User query: "${query}"
- Error: ${errorDetails || 'Technical issue occurred'}
- Language: ${language}

**Psychological Safety Principles:**
1. DON'T blame the user ("You did something wrong")
2. DON'T use technical jargon ("Error 500", "Stack trace")
3. DO acknowledge the issue honestly
4. DO provide clear next steps
5. DO maintain confidence that it can be resolved

**Structure:**
1. Acknowledge the issue (1 sentence)
2. Apologize briefly (1 sentence)
3. Suggest 2-3 recovery actions:
   - Rephrase the question
   - Try a different approach
   - Specify which document
4. Reassure them you're here to help

**Example GOOD response:**
"I ran into an issue processing that request. Let me try to help you differently:
- Could you rephrase your question?
- If you're asking about a specific document, let me know which one
- Or try asking about something else, and we can come back to this

I'm here to help you find what you need."

**Example BAD response:**
"Error 500: Internal server error. Please try again later or contact support." (technical, scary, unhelpful)

**Requirements:**
- Keep under 120 words
- Be reassuring and confident
- Provide actionable next steps
- NO technical jargon
- NO emojis
- Respond in ${language}

Generate the error recovery response now:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Generate metadata response (list documents, count files, etc.)
   */
  async generateMetadataResponse(
    query: string,
    documents: Array<{ name: string; type: string; uploadedAt: Date }>,
    language: string
  ): Promise<string> {
    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
      },
    });

    const documentList = documents
      .slice(0, 20) // Limit to 20 documents
      .map((doc) => `- ${doc.name} (${doc.type})`)
      .join('\n');

    const prompt = `Generate a natural response listing user's documents.

**Context:**
- User query: "${query}"
- User has ${documents.length} document${documents.length !== 1 ? 's' : ''}
- Language: ${language}

**Documents:**
${documentList}
${documents.length > 20 ? `... and ${documents.length - 20} more` : ''}

**Requirements:**
- Start with a natural intro (not "Here are your files:")
- List documents clearly
- Suggest what they can do next
- Keep it conversational
- NO emojis
- Respond in ${language}

**Example GOOD response:**
"You have 3 documents:
- Q4 Report.pdf (PDF)
- Budget 2024.xlsx (Excel)
- Notes.docx (Word)

What would you like to know about them?"

Generate the metadata response now:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Generate synthesis response (summarize all documents, find themes, etc.)
   */
  async generateSynthesisPrompt(
    query: string,
    documents: Array<{ name: string; content: string }>,
    language: string
  ): Promise<string> {
    // This returns a prompt for the LLM to synthesize across all documents
    // Not a fallback, but a special handling for synthesis queries

    const documentSummaries = documents
      .map((doc) => `**${doc.name}**:\n${doc.content.substring(0, 500)}...`)
      .join('\n\n');

    return `You are analyzing ALL of the user's documents to answer a synthesis question.

**User Query:** "${query}"

**All Documents:**
${documentSummaries}

**Instructions:**
1. Analyze ALL documents (not just one)
2. Find patterns, themes, or commonalities
3. Provide a comprehensive answer that synthesizes information across documents
4. Reference specific documents when making points
5. Be thorough but concise
6. Respond in ${language}

Generate a comprehensive synthesis answer now:`;
  }
}

export default new FallbackResponseService();
