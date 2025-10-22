/**
 * Chat Document Generation Service
 * AI-powered document generation for chat (like Manus)
 * Uses Google Gemini API
 *
 * Features:
 * - Detect document generation requests from user prompts
 * - Generate formatted markdown documents using Gemini
 * - Support multiple document types (summary, analysis, deep_dive, report, general)
 * - Iterative refinement support
 * - 30-day expiry for temporary chat documents
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export interface ChatDocumentRequest {
  userId: string;
  conversationId: string;
  userPrompt: string;
  contextDocuments?: Array<{
    id: string;
    filename: string;
    content: string;
  }>;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface ChatDocumentResult {
  isDocumentRequest: boolean;
  document?: {
    title: string;
    markdownContent: string;
    documentType: 'summary' | 'analysis' | 'deep_dive' | 'report' | 'general';
    wordCount: number;
  };
  regularResponse?: string;
}

class ChatDocumentGenerationService {
  /**
   * Detect if user request is asking for document generation
   * Uses Gemini to intelligently detect document generation intent
   */
  async detectDocumentRequest(userPrompt: string): Promise<{
    isDocumentRequest: boolean;
    documentType?: 'summary' | 'analysis' | 'deep_dive' | 'report' | 'general';
    confidence: number;
    isConversionRequest?: boolean;
  }> {
    try {
      console.log('[Chat Document Generation] Detecting document request...');

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const prompt = `You are a document generation detector. Analyze user prompts to determine if they want a generated document.

**DOCUMENT GENERATION INDICATORS:**
- Asks for a document, report, analysis, or essay to be created
- Wants comprehensive, formatted content
- Requests "write", "create", "generate", "draft" a document
- Asks for detailed explanation as a document
- Wants something they can download or export
- **CRITICAL: ANY request to convert, export, or format previous content as a file (PDF, DOC, DOCX, MD, document, file)**
  - Examples: "give me this in PDF", "put this in a document", "convert to doc", "format as docx", "download this", "export to markdown"
  - **ALWAYS return confidence >= 0.9 for these conversion requests**

**NOT DOCUMENT GENERATION:**
- Simple questions ("what is X?", "explain Y")
- Document queries about existing files ("what's in my document?")
- General chat or conversation
- Single-answer questions

**DOCUMENT TYPES:**
- summary: "Summarize this information", "Create a summary"
- analysis: "Analyze this data", "Break down the pros and cons"
- deep_dive: "Deep dive into X", "Comprehensive guide on Y", "Detailed explanation"
- report: "Create a report on X", "Write a business report"
- general: Generic document requests OR converting previous answer to document format

**IMPORTANT RULES:**
1. If user mentions ANY file format (PDF, DOC, DOCX, MD), set confidence to 0.95+
2. If user says "give me this/that" or "put this/that" referring to previous content, set confidence to 0.95+
3. If user says "download", "export", "convert", set confidence to 0.9+

Respond in JSON format:
{
  "isDocumentRequest": true/false,
  "documentType": "summary|analysis|deep_dive|report|general",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation",
  "isConversionRequest": true/false (true if user wants to convert previous answer to document)
}

User prompt: "${userPrompt}"`;

      const result = await model.generateContent(prompt);
      const response = JSON.parse(result.response.text());

      console.log('[Chat Document Generation] Detection result:', response);

      return {
        isDocumentRequest: response.isDocumentRequest || false,
        documentType: response.documentType,
        confidence: response.confidence || 0,
        isConversionRequest: response.isConversionRequest || false,
      };
    } catch (error) {
      console.error('[Chat Document Generation] Error detecting request:', error);
      return {
        isDocumentRequest: false,
        confidence: 0,
      };
    }
  }

  /**
   * Generate a formatted markdown document using Gemini
   */
  async generateChatDocument(request: ChatDocumentRequest): Promise<ChatDocumentResult> {
    try {
      console.log('[Chat Document Generation] Generating document...');

      // First, detect if this is a document generation request
      const detection = await this.detectDocumentRequest(request.userPrompt);

      if (!detection.isDocumentRequest) {
        console.log('[Chat Document Generation] Not a document request, returning regular response');
        return {
          isDocumentRequest: false,
        };
      }

      // Generate the document using Gemini 2.5 Pro (best for long-form content)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      const documentPrompt = this._buildDocumentPrompt(
        request.userPrompt,
        detection.documentType || 'general',
        request.contextDocuments,
        request.conversationHistory,
        detection.isConversionRequest || false
      );

      const systemPrompt = this._getSystemPromptForDocumentType(detection.documentType || 'general');

      console.log('[Chat Document Generation] Calling Gemini for document generation...');

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: documentPrompt },
      ]);

      const generatedContent = result.response.text();

      // Extract title from the first heading or generate one
      const title = this._extractTitle(generatedContent) || this._generateTitle(request.userPrompt);

      // Count words
      const wordCount = generatedContent.split(/\s+/).filter(w => w.length > 0).length;

      console.log('[Chat Document Generation] Document generated successfully', {
        title,
        wordCount,
        documentType: detection.documentType,
      });

      return {
        isDocumentRequest: true,
        document: {
          title,
          markdownContent: generatedContent,
          documentType: detection.documentType || 'general',
          wordCount,
        },
      };
    } catch (error) {
      console.error('[Chat Document Generation] Error generating document:', error);
      throw new Error('Failed to generate chat document');
    }
  }

  /**
   * Save generated document to database with 30-day expiry
   */
  async saveChatDocument(
    messageId: string,
    conversationId: string,
    userId: string,
    document: {
      title: string;
      markdownContent: string;
      documentType: string;
      wordCount: number;
    },
    sourceDocumentId?: string
  ): Promise<string> {
    try {
      console.log('[Chat Document Generation] Saving chat document to database...');

      // Calculate expiry date (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const chatDocument = await prisma.chatDocument.create({
        data: {
          messageId,
          conversationId,
          userId,
          title: document.title,
          markdownContent: document.markdownContent,
          documentType: document.documentType,
          wordCount: document.wordCount,
          sourceDocumentId,
          expiresAt,
        },
      });

      console.log('[Chat Document Generation] Chat document saved:', chatDocument.id);

      return chatDocument.id;
    } catch (error) {
      console.error('[Chat Document Generation] Error saving chat document:', error);
      throw new Error('Failed to save chat document');
    }
  }

  /**
   * Build document generation prompt based on type
   */
  private _buildDocumentPrompt(
    userPrompt: string,
    documentType: string,
    contextDocuments?: Array<{ id: string; filename: string; content: string }>,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    isConversionRequest: boolean = false
  ): string {
    let prompt = '';

    // If this is a conversion request (e.g., "give me this in a document"), use the previous assistant message
    if (isConversionRequest && conversationHistory && conversationHistory.length > 0) {
      // Get the last assistant message (the content to convert)
      const lastAssistantMessage = conversationHistory
        .slice()
        .reverse()
        .find(msg => msg.role === 'assistant');

      if (lastAssistantMessage) {
        prompt += `**CONVERSION REQUEST**: The user wants to convert the following response into a professional document format.\n\n`;
        prompt += `**ORIGINAL RESPONSE TO CONVERT:**\n${lastAssistantMessage.content}\n\n`;
        prompt += `**INSTRUCTIONS:**\n`;
        prompt += `1. Take the EXACT content from the original response above\n`;
        prompt += `2. Format it as a professional ${documentType} document with proper Markdown structure\n`;
        prompt += `3. Add a title based on the topic\n`;
        prompt += `4. Organize the content into clear sections with headers\n`;
        prompt += `5. Keep ALL the original information and facts - do NOT add new information\n`;
        prompt += `6. Preserve any sources, citations, or references mentioned in the original response\n`;
        prompt += `7. Format lists, tables, and quotes properly\n`;
        prompt += `8. Add a professional introduction and conclusion if not already present\n\n`;
        prompt += `User's conversion request: "${userPrompt}"\n\n`;
      } else {
        // Fallback if no assistant message found
        prompt = `User request: ${userPrompt}\n\n`;
      }
    } else {
      // Regular document generation (creating new content)
      prompt = `User request: ${userPrompt}\n\n`;

      // Add context from documents if provided
      if (contextDocuments && contextDocuments.length > 0) {
        prompt += `**Context from documents:**\n\n`;
        contextDocuments.forEach((doc, index) => {
          prompt += `Document ${index + 1}: ${doc.filename}\n`;
          prompt += `${doc.content.slice(0, 5000)}\n\n`; // Limit context per document
        });
      }

      // Add recent conversation history for context
      if (conversationHistory && conversationHistory.length > 0) {
        prompt += `**Recent conversation:**\n`;
        conversationHistory.slice(-5).forEach(msg => {
          prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
        prompt += '\n';
      }

      prompt += `Please generate a comprehensive ${documentType} document based on this request. Use professional formatting with Markdown.`;
    }

    return prompt;
  }

  /**
   * Get system prompt for specific document type
   */
  private _getSystemPromptForDocumentType(documentType: string): string {
    const basePrompt = `You are a professional document writer. Generate well-structured, comprehensive documents using Markdown formatting.

**FORMATTING REQUIREMENTS:**
- Use proper heading hierarchy (# for title, ## for sections, ### for subsections)
- Use **bold** for emphasis and important points
- Use bullet points and numbered lists appropriately
- Include tables where relevant (use markdown table syntax)
- Add blockquotes for important notes or quotes
- Use horizontal rules (---) to separate major sections
- Keep paragraphs concise and scannable
- Add blank lines between sections for readability

**CONTENT REQUIREMENTS:**
- Be comprehensive and thorough
- Use clear, professional language
- Provide specific examples where appropriate
- Include actionable insights
- Structure content logically
- Start with an introduction/overview
- End with a conclusion or summary

`;

    const typeSpecificPrompts: Record<string, string> = {
      summary: `**DOCUMENT TYPE: SUMMARY**
Your goal is to create a concise yet comprehensive summary that captures the essence of the content.

Structure:
1. Overview (2-3 sentences)
2. Key Points (bullet list)
3. Important Details (brief paragraphs)
4. Conclusion

Keep it clear and to the point while maintaining completeness.`,

      analysis: `**DOCUMENT TYPE: ANALYSIS**
Your goal is to provide a detailed analytical breakdown with insights.

Structure:
1. Introduction
2. Analysis Framework
3. Key Findings (with supporting evidence)
4. Pros and Cons
5. Implications
6. Recommendations
7. Conclusion

Be objective and thorough in your analysis.`,

      deep_dive: `**DOCUMENT TYPE: DEEP DIVE**
Your goal is to create an extensive, comprehensive guide on the topic.

Structure:
1. Executive Summary
2. Background & Context
3. Detailed Breakdown (multiple sections)
4. In-Depth Analysis
5. Practical Applications
6. Advanced Concepts
7. Common Questions
8. Resources & References
9. Conclusion

This should be the most comprehensive document type - leave no stone unturned.`,

      report: `**DOCUMENT TYPE: REPORT**
Your goal is to create a formal, structured business report.

Structure:
1. Executive Summary
2. Introduction
3. Methodology (if applicable)
4. Findings
5. Analysis & Discussion
6. Recommendations
7. Conclusion
8. Appendix (if needed)

Use formal business language and present data clearly.`,

      general: `**DOCUMENT TYPE: GENERAL**
Your goal is to create a well-structured document tailored to the user's specific request.

Structure:
1. Introduction
2. Main Content (organized into logical sections)
3. Supporting Details
4. Examples or Case Studies (if relevant)
5. Conclusion

Adapt the structure to best fit the user's needs.`,
    };

    return basePrompt + (typeSpecificPrompts[documentType] || typeSpecificPrompts.general);
  }

  /**
   * Extract title from markdown content (first heading)
   */
  private _extractTitle(markdownContent: string): string | null {
    const lines = markdownContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Generate title from user prompt
   */
  private _generateTitle(userPrompt: string): string {
    // Extract key words and create a title
    const words = userPrompt.split(' ').filter(w => w.length > 3);
    const title = words.slice(0, 6).join(' ');
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  /**
   * Get chat document by ID
   */
  async getChatDocument(chatDocumentId: string): Promise<any> {
    return await prisma.chatDocument.findUnique({
      where: { id: chatDocumentId },
    });
  }

  /**
   * Get chat documents by conversation
   */
  async getChatDocumentsByConversation(conversationId: string): Promise<any[]> {
    return await prisma.chatDocument.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete expired chat documents (cleanup job)
   */
  async deleteExpiredChatDocuments(): Promise<number> {
    try {
      const result = await prisma.chatDocument.deleteMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      console.log(`[Chat Document Generation] Deleted ${result.count} expired documents`);
      return result.count;
    } catch (error) {
      console.error('[Chat Document Generation] Error deleting expired documents:', error);
      return 0;
    }
  }
}

export default new ChatDocumentGenerationService();
