/**
 * Chat Document Generation Service
 * Generates documents (reports, summaries, analyses) from chat queries
 * Documents are displayed in chat like Manus with download options
 */

import prisma from '../config/database';
import OpenAI from 'openai';
import { config } from '../config/env';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  baseURL: config.OPENAI_BASE_URL,
});

interface GenerateDocumentParams {
  userId: string;
  conversationId: string;
  messageId: string;
  query: string;
  documentType: 'summary' | 'report' | 'analysis' | 'general' | 'presentation';
  sourceContent?: string; // Content from RAG retrieval
  sourceDocumentIds?: string[]; // IDs of source documents
}

interface ChatDocumentResult {
  chatDocument: {
    id: string;
    title: string;
    markdownContent: string;
    documentType: string;
    wordCount: number;
    createdAt: Date;
  };
  message: string; // Confirmation message to show in chat
}

/**
 * Generate a document from chat query
 * Creates ChatDocument record and returns it for display in chat
 */
export async function generateDocument(params: GenerateDocumentParams): Promise<ChatDocumentResult> {
  const {
    userId,
    conversationId,
    messageId,
    query,
    documentType,
    sourceContent,
    sourceDocumentIds,
  } = params;

  console.log(`📝 [DOC GEN] Generating ${documentType} document for user ${userId}`);

  // Generate document title
  const title = await generateDocumentTitle(query, documentType);

  // Generate document content using LLM
  const markdownContent = await generateDocumentContent({
    query,
    documentType,
    sourceContent,
    title,
  });

  // Calculate word count
  const wordCount = markdownContent.split(/\s+/).length;

  // Create ChatDocument record
  const chatDocument = await prisma.chatDocument.create({
    data: {
      messageId,
      conversationId,
      userId,
      title,
      markdownContent,
      documentType,
      wordCount,
      sourceDocumentId: sourceDocumentIds?.[0] || null,
    },
  });

  console.log(`✅ [DOC GEN] Created ChatDocument ${chatDocument.id}: "${title}" (${wordCount} words)`);

  // Generate confirmation message
  const message = generateConfirmationMessage(title, documentType, wordCount);

  return {
    chatDocument: {
      id: chatDocument.id,
      title: chatDocument.title,
      markdownContent: chatDocument.markdownContent,
      documentType: chatDocument.documentType,
      wordCount: chatDocument.wordCount,
      createdAt: chatDocument.createdAt,
    },
    message,
  };
}

/**
 * Generate document title from query
 */
async function generateDocumentTitle(query: string, documentType: string): Promise<string> {
  try {
    const prompt = `Generate a concise, professional title for a ${documentType} document based on this request:

"${query}"

Requirements:
- Maximum 8 words
- Professional and descriptive
- No quotes or special characters
- Title case

Return ONLY the title, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 50,
    });

    const title = response.choices[0].message.content?.trim() || 'Generated Document';
    return title;
  } catch (error) {
    console.error('❌ [DOC GEN] Error generating title:', error);
    return `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} Document`;
  }
}

/**
 * Generate document content using LLM
 */
async function generateDocumentContent(params: {
  query: string;
  documentType: string;
  sourceContent?: string;
  title: string;
}): Promise<string> {
  const { query, documentType, sourceContent, title } = params;

  // Build system prompt based on document type
  const systemPrompts = {
    summary: `You are an expert at creating concise, well-structured summaries. Create a professional summary document in Markdown format.

Requirements:
- Use clear headings (##, ###)
- Bullet points for key information
- Professional tone
- Well-organized sections
- Include relevant details from source content`,

    report: `You are an expert at creating comprehensive, detailed reports. Create a professional report document in Markdown format.

Requirements:
- Executive summary section
- Clear section headings (##, ###)
- Data and statistics when available
- Bullet points and tables
- Professional business tone
- Conclusions and recommendations`,

    analysis: `You are an expert at creating in-depth analyses. Create a professional analysis document in Markdown format.

Requirements:
- Introduction and context
- Detailed analysis sections
- Key findings with evidence
- Use headings, bullet points, and tables
- Critical thinking and insights
- Conclusions`,

    general: `You are an expert at creating professional documents. Create a well-structured document in Markdown format.

Requirements:
- Clear structure with headings
- Professional tone
- Well-organized content
- Use bullet points and formatting
- Comprehensive coverage`,

    presentation: `You are an expert at creating professional presentations. Create a presentation document in Markdown format that can be converted to slides.

Requirements:
- Each slide should be a ## heading (Slide 1, Slide 2, etc.)
- Title slide with main topic
- Bullet points for key information (3-5 per slide)
- Clear, concise content per slide
- Include sections: Introduction, Key Points, Details, Conclusion
- Professional tone, suitable for business presentations
- 5-10 slides recommended
- Use ### for sub-sections within slides if needed`,
  };

  const systemPrompt = systemPrompts[documentType as keyof typeof systemPrompts] || systemPrompts.general;

  // Build user prompt
  let userPrompt = `Create a document titled "${title}" based on this request:\n\n"${query}"\n\n`;

  if (sourceContent) {
    userPrompt += `Use the following source information:\n\n${sourceContent}\n\n`;
  }

  userPrompt += `Generate a complete, professional ${documentType} document in Markdown format. Include:
- Title (# ${title})
- Multiple sections with ## headings
- Bullet points, tables, and formatting
- Professional content

Return ONLY the Markdown content, no explanations.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content?.trim() || '# Document\n\nContent generation failed.';
    return content;
  } catch (error) {
    console.error('❌ [DOC GEN] Error generating content:', error);
    throw new Error('Failed to generate document content');
  }
}

/**
 * Generate confirmation message for chat
 */
function generateConfirmationMessage(title: string, documentType: string, wordCount: number): string {
  const typeEmojis = {
    summary: '📋',
    report: '📑',
    analysis: '📊',
    general: '📄',
    presentation: '📽️',
  };

  const emoji = typeEmojis[documentType as keyof typeof typeEmojis] || '📄';

  return `${emoji} **Document Created Successfully**

I've generated your ${documentType}: **${title}**

📊 **${wordCount.toLocaleString()} words**

The document is displayed below with options to copy or download in different formats.`;
}

/**
 * Get chat document by ID
 */
export async function getChatDocument(chatDocId: string, userId: string) {
  const chatDocument = await prisma.chatDocument.findFirst({
    where: {
      id: chatDocId,
      userId,
    },
  });

  return chatDocument;
}

/**
 * Get all chat documents for a conversation
 */
export async function getChatDocumentsByConversation(conversationId: string, userId: string) {
  const chatDocuments = await prisma.chatDocument.findMany({
    where: {
      conversationId,
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return chatDocuments;
}

/**
 * Delete chat document
 */
export async function deleteChatDocument(chatDocId: string, userId: string) {
  await prisma.chatDocument.deleteMany({
    where: {
      id: chatDocId,
      userId,
    },
  });

  console.log(`🗑️  [DOC GEN] Deleted ChatDocument ${chatDocId}`);
}

export default {
  generateDocument,
  getChatDocument,
  getChatDocumentsByConversation,
  deleteChatDocument,
};
