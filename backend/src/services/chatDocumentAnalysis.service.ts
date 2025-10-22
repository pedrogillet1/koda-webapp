import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RenderableSection } from './documentGeneration.service';
import auditLogService, { AuditAction, AuditStatus } from './auditLog.service';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ==================== Types ====================

interface AnalysisRequest {
  conversationId: string;
  messageId: string; // The assistant message that will have this attachment
  analysisType: 'comparison' | 'summary' | 'analysis' | 'essay';
  sourceDocumentIds: string[];
  userPrompt: string;
  options?: {
    tone?: 'formal' | 'casual' | 'professional' | 'friendly';
    length?: 'brief' | 'standard' | 'detailed';
    focusAreas?: string[]; // Specific aspects to focus on
  };
}

interface EditRequest {
  attachmentId: string;
  conversationId: string;
  messageId: string; // New message for the edit response
  editCommand: string;
  targetSection?: string;
}

interface ExportRequest {
  attachmentId: string;
  folderId?: string;
  customFilename?: string;
}

interface AttachmentResult {
  attachmentId: string;
  messageId: string;
  title: string;
  content: RenderableSection[];
  previewHtml: string;
  previewCss: string;
  metadata: {
    sourceDocuments: { id: string; filename: string }[];
    analysisType: string;
    createdAt: string;
  };
}

// ==================== Service ====================

class ChatDocumentAnalysisService {
  /**
   * Analyze documents and create attachment on assistant message
   * The attachment stays in the chat, not in Documents page
   */
  async analyzeDocuments(
    userId: string,
    request: AnalysisRequest
  ): Promise<AttachmentResult> {
    try {
      console.log(`📊 Starting document analysis for user ${userId}`);
      console.log(`Analysis type: ${request.analysisType}`);
      console.log(`Source documents: ${request.sourceDocumentIds.length}`);

      // Verify user owns conversation and message
      const message = await prisma.message.findUnique({
        where: { id: request.messageId },
        include: { conversation: true },
      });

      if (!message || message.conversation.userId !== userId) {
        throw new Error('Message not found or access denied');
      }

      if (message.conversationId !== request.conversationId) {
        throw new Error('Message does not belong to this conversation');
      }

      // Fetch source documents
      const sourceDocuments = await prisma.document.findMany({
        where: {
          id: { in: request.sourceDocumentIds },
          userId,
        },
        include: {
          metadata: true,
        },
      });

      if (sourceDocuments.length !== request.sourceDocumentIds.length) {
        throw new Error('Some documents not found or access denied');
      }

      // Prepare document contents for AI
      const documentContents = sourceDocuments.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        text: doc.metadata?.extractedText || '',
        metadata: {
          pageCount: doc.metadata?.pageCount,
          wordCount: doc.metadata?.wordCount,
          classification: doc.metadata?.classification,
        },
      }));

      // Build AI prompt based on analysis type
      const aiPrompt = this.buildAnalysisPrompt(
        request.analysisType,
        request.userPrompt,
        documentContents,
        request.options
      );

      // Generate analysis using Gemini
      console.log('🤖 Generating AI analysis...');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
      const result = await model.generateContent(aiPrompt);
      const analysisText = result.response.text();

      // Parse analysis into structured content
      const renderableContent = this.parseAnalysisToRenderableContent(
        analysisText,
        request.analysisType
      );

      // Generate preview HTML/CSS
      const previewHtml = this.renderContentToHTML(renderableContent);
      const previewCss = this.getPreviewCSS();

      // Generate title for attachment
      const title = this.generateAttachmentTitle(request.analysisType, sourceDocuments);

      // Create message attachment
      const attachment = await prisma.messageAttachment.create({
        data: {
          messageId: request.messageId,
          conversationId: request.conversationId,
          userId,
          attachmentType: 'analysis_document',
          title,
          content: JSON.stringify(renderableContent),
          previewHtml,
          previewCss,
          sourceDocumentIds: JSON.stringify(request.sourceDocumentIds),
          analysisType: request.analysisType,
          metadata: JSON.stringify({
            analysisType: request.analysisType,
            options: request.options,
            sourceCount: sourceDocuments.length,
            userPrompt: request.userPrompt,
          }),
          editCount: 0,
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.AI_QUERY,
        resource: attachment.id,
        status: AuditStatus.SUCCESS,
        details: {
          analysisType: request.analysisType,
          sourceDocuments: request.sourceDocumentIds,
          conversationId: request.conversationId,
          messageId: request.messageId,
        },
      });

      console.log(`✅ Analysis completed. Attachment created: ${attachment.id}`);

      return {
        attachmentId: attachment.id,
        messageId: request.messageId,
        title,
        content: renderableContent,
        previewHtml,
        previewCss,
        metadata: {
          sourceDocuments: sourceDocuments.map((doc) => ({
            id: doc.id,
            filename: doc.filename,
          })),
          analysisType: request.analysisType,
          createdAt: attachment.createdAt.toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error in analyzeDocuments:', error);
      throw new Error(`Document analysis failed: ${error.message}`);
    }
  }

  /**
   * Edit an attachment and create new version on new message
   */
  async editAttachment(
    userId: string,
    request: EditRequest
  ): Promise<AttachmentResult> {
    try {
      console.log(`✏️ Editing attachment ${request.attachmentId}`);

      // Verify attachment exists
      const originalAttachment = await prisma.messageAttachment.findUnique({
        where: { id: request.attachmentId },
      });

      if (!originalAttachment || originalAttachment.userId !== userId) {
        throw new Error('Attachment not found or access denied');
      }

      if (originalAttachment.conversationId !== request.conversationId) {
        throw new Error('Attachment does not belong to this conversation');
      }

      // Verify new message exists
      const message = await prisma.message.findUnique({
        where: { id: request.messageId },
      });

      if (!message || message.conversationId !== request.conversationId) {
        throw new Error('Message not found or does not belong to conversation');
      }

      // Get current content
      const currentContent = JSON.parse(originalAttachment.content) as RenderableSection[];

      // Apply AI edit
      const editedContent = await this.executeAIEdit(currentContent, request.editCommand);

      // Generate preview
      const previewHtml = this.renderContentToHTML(editedContent);
      const previewCss = this.getPreviewCSS();

      // Save edit to history in original attachment
      const editHistory = originalAttachment.editHistory
        ? JSON.parse(originalAttachment.editHistory)
        : [];

      editHistory.push({
        editNumber: originalAttachment.editCount + 1,
        editCommand: request.editCommand,
        editedAt: new Date().toISOString(),
        targetSection: request.targetSection,
      });

      // Update original attachment's edit history
      await prisma.messageAttachment.update({
        where: { id: request.attachmentId },
        data: {
          editHistory: JSON.stringify(editHistory),
          editCount: originalAttachment.editCount + 1,
        },
      });

      // Create new attachment on new message with edited content
      const newAttachment = await prisma.messageAttachment.create({
        data: {
          messageId: request.messageId,
          conversationId: request.conversationId,
          userId,
          attachmentType: originalAttachment.attachmentType,
          title: `${originalAttachment.title} (edited)`,
          content: JSON.stringify(editedContent),
          previewHtml,
          previewCss,
          sourceDocumentIds: originalAttachment.sourceDocumentIds,
          analysisType: originalAttachment.analysisType,
          metadata: originalAttachment.metadata,
          editHistory: JSON.stringify(editHistory),
          editCount: originalAttachment.editCount + 1,
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.AI_QUERY,
        resource: newAttachment.id,
        status: AuditStatus.SUCCESS,
        details: {
          originalAttachmentId: request.attachmentId,
          editCommand: request.editCommand,
          editNumber: newAttachment.editCount,
          conversationId: request.conversationId,
        },
      });

      console.log(`✅ Edit applied. New attachment created: ${newAttachment.id}`);

      const sourceDocumentIds = JSON.parse(newAttachment.sourceDocumentIds || '[]');
      const sourceDocuments = await prisma.document.findMany({
        where: { id: { in: sourceDocumentIds } },
        select: { id: true, filename: true },
      });

      return {
        attachmentId: newAttachment.id,
        messageId: request.messageId,
        title: newAttachment.title,
        content: editedContent,
        previewHtml,
        previewCss,
        metadata: {
          sourceDocuments: sourceDocuments.map((doc) => ({
            id: doc.id,
            filename: doc.filename,
          })),
          analysisType: newAttachment.analysisType || 'analysis',
          createdAt: newAttachment.createdAt.toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error in editAttachment:', error);
      throw new Error(`Failed to edit attachment: ${error.message}`);
    }
  }

  /**
   * Export attachment to Documents page
   */
  async exportToDocuments(
    userId: string,
    request: ExportRequest
  ): Promise<{ documentId: string; filename: string }> {
    try {
      console.log(`💾 Exporting attachment ${request.attachmentId} to Documents`);

      // Verify attachment exists
      const attachment = await prisma.messageAttachment.findUnique({
        where: { id: request.attachmentId },
      });

      if (!attachment || attachment.userId !== userId) {
        throw new Error('Attachment not found or access denied');
      }

      // Verify folder if provided
      if (request.folderId) {
        const folder = await prisma.folder.findUnique({
          where: { id: request.folderId },
        });

        if (!folder || folder.userId !== userId) {
          throw new Error('Folder not found or access denied');
        }
      }

      // Create filename
      const filename = request.customFilename || `${attachment.title}.md`;

      // Create document record
      const document = await prisma.document.create({
        data: {
          userId,
          folderId: request.folderId,
          filename,
          encryptedFilename: `exported_${Date.now()}_${filename}`,
          fileSize: attachment.content.length,
          mimeType: 'text/markdown',
          fileHash: `export_${Date.now()}`,
          status: 'completed',
          renderableContent: attachment.content,
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.DOCUMENT_UPLOAD,
        resource: document.id,
        status: AuditStatus.SUCCESS,
        details: {
          attachmentId: request.attachmentId,
          filename,
          folderId: request.folderId,
        },
      });

      console.log(`✅ Attachment exported to Documents: ${document.id}`);

      return {
        documentId: document.id,
        filename: document.filename,
      };
    } catch (error: any) {
      console.error('Error in exportToDocuments:', error);
      throw new Error(`Failed to export attachment: ${error.message}`);
    }
  }

  /**
   * Get attachment details
   */
  async getAttachment(
    userId: string,
    attachmentId: string
  ): Promise<AttachmentResult> {
    try {
      const attachment = await prisma.messageAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.userId !== userId) {
        throw new Error('Attachment not found or access denied');
      }

      const content = JSON.parse(attachment.content) as RenderableSection[];
      const sourceDocumentIds = JSON.parse(attachment.sourceDocumentIds || '[]');
      const sourceDocuments = await prisma.document.findMany({
        where: { id: { in: sourceDocumentIds } },
        select: { id: true, filename: true },
      });

      return {
        attachmentId: attachment.id,
        messageId: attachment.messageId,
        title: attachment.title,
        content,
        previewHtml: attachment.previewHtml || '',
        previewCss: attachment.previewCss || '',
        metadata: {
          sourceDocuments: sourceDocuments.map((doc) => ({
            id: doc.id,
            filename: doc.filename,
          })),
          analysisType: attachment.analysisType || 'analysis',
          createdAt: attachment.createdAt.toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error in getAttachment:', error);
      throw new Error(`Failed to get attachment: ${error.message}`);
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Build AI prompt based on analysis type
   */
  private buildAnalysisPrompt(
    analysisType: string,
    userPrompt: string,
    documentContents: any[],
    options?: AnalysisRequest['options']
  ): string {
    const tone = options?.tone || 'professional';
    const length = options?.length || 'standard';
    const focusAreas = options?.focusAreas || [];

    let prompt = `You are an expert document analyst. The user has provided ${documentContents.length} documents and needs your help.\n\n`;

    prompt += `**User Request:** ${userPrompt}\n\n`;

    prompt += `**Analysis Type:** ${analysisType}\n`;
    prompt += `**Tone:** ${tone}\n`;
    prompt += `**Length:** ${length}\n`;
    if (focusAreas.length > 0) {
      prompt += `**Focus Areas:** ${focusAreas.join(', ')}\n`;
    }
    prompt += `\n`;

    prompt += `**Documents to Analyze:**\n\n`;
    documentContents.forEach((doc, index) => {
      prompt += `--- Document ${index + 1}: ${doc.filename} ---\n`;
      prompt += `${doc.text.substring(0, 8000)}\n\n`; // Limit to 8000 chars per doc
    });

    // Analysis-specific instructions
    switch (analysisType) {
      case 'comparison':
        prompt += `\n**Task:** Compare these documents and identify:\n`;
        prompt += `1. Key similarities across all documents\n`;
        prompt += `2. Major differences and variations\n`;
        prompt += `3. Unique insights from each document\n`;
        prompt += `4. Synthesis and overall patterns\n`;
        prompt += `\nProvide a comprehensive comparison that helps the user understand the relationships between these documents.\n`;
        break;

      case 'summary':
        prompt += `\n**Task:** Create a comprehensive summary that:\n`;
        prompt += `1. Captures the main points from all documents\n`;
        prompt += `2. Organizes information logically\n`;
        prompt += `3. Highlights key takeaways\n`;
        prompt += `4. Provides actionable insights\n`;
        prompt += `\nCombine information from all documents into a unified summary.\n`;
        break;

      case 'analysis':
        prompt += `\n**Task:** Perform a deep analysis that:\n`;
        prompt += `1. Identifies themes and patterns\n`;
        prompt += `2. Evaluates strengths and weaknesses\n`;
        prompt += `3. Provides critical insights\n`;
        prompt += `4. Offers recommendations or conclusions\n`;
        prompt += `\nHelp the user gain deeper understanding of the content.\n`;
        break;

      case 'essay':
        prompt += `\n**Task:** Write a comprehensive essay that:\n`;
        prompt += `1. Synthesizes information from all documents\n`;
        prompt += `2. Has a clear introduction, body, and conclusion\n`;
        prompt += `3. Presents arguments or narratives coherently\n`;
        prompt += `4. Cites or references the source documents\n`;
        prompt += `\nCreate a well-structured essay based on the provided documents.\n`;
        break;
    }

    prompt += `\n**Output Format:**\n`;
    prompt += `Please structure your response with clear headings, paragraphs, and lists where appropriate.\n`;
    prompt += `Use markdown formatting:\n`;
    prompt += `- # for main headings\n`;
    prompt += `- ## for subheadings\n`;
    prompt += `- ### for sub-subheadings\n`;
    prompt += `- Bullet points for lists\n`;
    prompt += `- Tables for structured data (if applicable)\n\n`;

    if (length === 'brief') {
      prompt += `Keep the response concise (500-1000 words).\n`;
    } else if (length === 'standard') {
      prompt += `Provide a standard-length response (1000-2000 words).\n`;
    } else {
      prompt += `Provide a detailed, comprehensive response (2000+ words).\n`;
    }

    return prompt;
  }

  /**
   * Execute AI edit on content
   */
  private async executeAIEdit(
    content: RenderableSection[],
    editCommand: string
  ): Promise<RenderableSection[]> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const contentText = this.renderContentToText(content);

    const prompt = `You are editing a document based on user feedback.

Current document content:
${contentText}

User's edit command: "${editCommand}"

Please apply the requested changes and return the ENTIRE edited document in markdown format.
Use the same structure with headings (#, ##, ###), lists (-, *), and paragraphs.`;

    const result = await model.generateContent(prompt);
    const editedText = result.response.text();

    return this.parseAnalysisToRenderableContent(editedText, 'analysis');
  }

  /**
   * Parse AI analysis text into renderable content structure
   */
  private parseAnalysisToRenderableContent(
    analysisText: string,
    analysisType: string
  ): RenderableSection[] {
    const sections: RenderableSection[] = [];
    const lines = analysisText.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '') continue;

      // Heading level 1
      if (trimmedLine.startsWith('# ')) {
        sections.push({
          type: 'heading',
          content: { level: 1, text: trimmedLine.substring(2).trim() },
        });
      }
      // Heading level 2
      else if (trimmedLine.startsWith('## ')) {
        sections.push({
          type: 'heading',
          content: { level: 2, text: trimmedLine.substring(3).trim() },
        });
      }
      // Heading level 3
      else if (trimmedLine.startsWith('### ')) {
        sections.push({
          type: 'heading',
          content: { level: 3, text: trimmedLine.substring(4).trim() },
        });
      }
      // Bullet point
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        const text = trimmedLine.substring(2).trim();
        const lastSection = sections[sections.length - 1];
        if (lastSection && lastSection.type === 'list') {
          (lastSection.content as any).items.push({ text });
        } else {
          sections.push({
            type: 'list',
            content: { items: [{ text }] },
          });
        }
      }
      // Numbered list
      else if (/^\d+\.\s/.test(trimmedLine)) {
        const text = trimmedLine.replace(/^\d+\.\s/, '').trim();
        const lastSection = sections[sections.length - 1];
        if (lastSection && lastSection.type === 'list') {
          (lastSection.content as any).items.push({ text });
        } else {
          sections.push({
            type: 'list',
            content: { items: [{ text }] },
          });
        }
      }
      // Paragraph
      else {
        sections.push({
          type: 'paragraph',
          content: { text: trimmedLine },
        });
      }
    }

    return sections;
  }

  /**
   * Render content to plain text
   */
  private renderContentToText(content: RenderableSection[]): string {
    let text = '';

    for (const section of content) {
      switch (section.type) {
        case 'heading':
          const level = section.content.level;
          text += '#'.repeat(level) + ' ' + section.content.text + '\n\n';
          break;
        case 'paragraph':
          text += section.content.text + '\n\n';
          break;
        case 'list':
          for (const item of section.content.items) {
            text += '- ' + item.text + '\n';
          }
          text += '\n';
          break;
        case 'table':
          // Simple table representation
          text += '| ' + section.content.headers.join(' | ') + ' |\n';
          text += '| ' + section.content.headers.map(() => '---').join(' | ') + ' |\n';
          for (const row of section.content.rows) {
            text += '| ' + row.join(' | ') + ' |\n';
          }
          text += '\n';
          break;
      }
    }

    return text;
  }

  /**
   * Render content to HTML
   */
  private renderContentToHTML(content: RenderableSection[]): string {
    let html = '<div class="document-preview">';

    for (const section of content) {
      switch (section.type) {
        case 'heading':
          const level = section.content.level;
          html += `<h${level}>${section.content.text}</h${level}>`;
          break;
        case 'paragraph':
          html += `<p>${section.content.text}</p>`;
          break;
        case 'list':
          html += '<ul>';
          for (const item of section.content.items) {
            html += `<li>${item.text}</li>`;
          }
          html += '</ul>';
          break;
        case 'table':
          html += '<table><thead><tr>';
          for (const header of section.content.headers) {
            html += `<th>${header}</th>`;
          }
          html += '</tr></thead><tbody>';
          for (const row of section.content.rows) {
            html += '<tr>';
            for (const cell of row) {
              html += `<td>${cell}</td>`;
            }
            html += '</tr>';
          }
          html += '</tbody></table>';
          break;
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * Get preview CSS
   */
  private getPreviewCSS(): string {
    return `
      .document-preview {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .document-preview h1 {
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1a1a1a;
      }
      .document-preview h2 {
        font-size: 22px;
        font-weight: 600;
        margin-top: 24px;
        margin-bottom: 12px;
        color: #2a2a2a;
      }
      .document-preview h3 {
        font-size: 18px;
        font-weight: 600;
        margin-top: 20px;
        margin-bottom: 10px;
        color: #3a3a3a;
      }
      .document-preview p {
        margin-bottom: 12px;
      }
      .document-preview ul {
        margin-left: 20px;
        margin-bottom: 12px;
      }
      .document-preview li {
        margin-bottom: 6px;
      }
      .document-preview table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }
      .document-preview th,
      .document-preview td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
      }
      .document-preview th {
        background-color: #f5f5f5;
        font-weight: 600;
      }
    `;
  }

  /**
   * Generate attachment title
   */
  private generateAttachmentTitle(analysisType: string, sourceDocuments: any[]): string {
    const sourceNames = sourceDocuments
      .slice(0, 2)
      .map((doc) => doc.filename.split('.')[0])
      .join(', ');

    let prefix = '';
    switch (analysisType) {
      case 'comparison':
        prefix = 'Comparison';
        break;
      case 'summary':
        prefix = 'Summary';
        break;
      case 'analysis':
        prefix = 'Analysis';
        break;
      case 'essay':
        prefix = 'Essay';
        break;
      default:
        prefix = 'Document';
    }

    if (sourceDocuments.length > 2) {
      return `${prefix} of ${sourceNames} and ${sourceDocuments.length - 2} more`;
    }

    return `${prefix} of ${sourceNames}`;
  }
}

export default new ChatDocumentAnalysisService();
