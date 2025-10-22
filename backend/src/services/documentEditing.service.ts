import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import auditLogService, { AuditAction, AuditStatus } from './auditLog.service';
import { RenderableSection } from './documentGeneration.service';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

/**
 * Document Editing Service
 *
 * Handles:
 * - AI-powered inline editing with natural language commands
 * - Manual document editing
 * - Edit history tracking and rollback
 * - Real-time preview generation
 */

export interface EditCommand {
  command: string;
  targetSection?: string; // Optional: specific section to edit
  parameters?: Record<string, any>; // Additional parameters
}

export interface EditResult {
  success: boolean;
  editedContent: RenderableSection[];
  editNumber: number;
  description: string;
  changes: {
    sectionsModified: number;
    sectionsAdded: number;
    sectionsRemoved: number;
  };
}

class DocumentEditingService {
  /**
   * Apply AI-powered edit to generated document
   */
  async applyAIEdit(
    userId: string,
    generatedDocId: string,
    editCommand: EditCommand
  ): Promise<EditResult> {
    try {
      console.log(`🤖 Applying AI edit to document ${generatedDocId}`);

      // Get generated document
      const generatedDoc = await prisma.generatedDocument.findUnique({
        where: { id: generatedDocId },
        include: {
          document: true,
          editHistory: {
            orderBy: { editNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (!generatedDoc) {
        throw new Error('Generated document not found');
      }

      if (generatedDoc.userId !== userId) {
        throw new Error('Access denied');
      }

      // Get current content
      const currentContent = JSON.parse(generatedDoc.renderableContent) as RenderableSection[];

      // Apply AI edit
      const editedContent = await this.executeAIEdit(currentContent, editCommand);

      // Calculate edit number
      const editNumber = generatedDoc.editHistory.length > 0
        ? generatedDoc.editHistory[0].editNumber + 1
        : 1;

      // Generate edit description
      const description = this.generateEditDescription(currentContent, editedContent, editCommand);

      // Calculate changes
      const changes = this.calculateChanges(currentContent, editedContent);

      // Save edit to history
      await prisma.documentEditHistory.create({
        data: {
          generatedDocumentId: generatedDocId,
          editNumber,
          editType: 'ai_command',
          editCommand: editCommand.command,
          editDescription: description,
          contentBefore: JSON.stringify(currentContent),
          contentAfter: JSON.stringify(editedContent),
          editedBy: userId,
        },
      });

      // Update generated document with new content
      await prisma.generatedDocument.update({
        where: { id: generatedDocId },
        data: {
          renderableContent: JSON.stringify(editedContent),
        },
      });

      // Update document's renderable content
      await prisma.document.update({
        where: { id: generatedDoc.documentId },
        data: {
          renderableContent: JSON.stringify(editedContent),
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.DOCUMENT_UPDATE,
        status: AuditStatus.SUCCESS,
        resource: generatedDoc.documentId,
        details: {
          operation: 'ai_edit',
          editNumber,
          command: editCommand.command,
        },
      });

      console.log(`✅ AI edit applied successfully: Edit #${editNumber}`);

      return {
        success: true,
        editedContent,
        editNumber,
        description,
        changes,
      };
    } catch (error) {
      console.error('❌ Error applying AI edit:', error);
      throw error;
    }
  }

  /**
   * Execute AI edit using Gemini
   */
  private async executeAIEdit(
    currentContent: RenderableSection[],
    editCommand: EditCommand
  ): Promise<RenderableSection[]> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      // Build edit prompt
      const prompt = this.buildEditPrompt(currentContent, editCommand);

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse edited content
      return this.parseEditedContent(text, currentContent);
    } catch (error) {
      console.error('Error executing AI edit:', error);
      throw new Error('Failed to execute AI edit');
    }
  }

  /**
   * Build edit prompt for AI
   */
  private buildEditPrompt(
    currentContent: RenderableSection[],
    editCommand: EditCommand
  ): string {
    let prompt = `You are a professional document editor. The user has requested the following edit:\n\n`;
    prompt += `EDIT COMMAND: ${editCommand.command}\n\n`;

    if (editCommand.targetSection) {
      prompt += `TARGET SECTION: ${editCommand.targetSection}\n\n`;
    }

    prompt += `CURRENT DOCUMENT CONTENT (as JSON):\n`;
    prompt += JSON.stringify(currentContent, null, 2);
    prompt += `\n\n`;

    prompt += `INSTRUCTIONS:\n`;
    prompt += `1. Apply the requested edit to the document\n`;
    prompt += `2. Maintain the JSON structure format\n`;
    prompt += `3. Preserve sections that are not affected by the edit\n`;
    prompt += `4. Return the ENTIRE edited document as valid JSON\n`;
    prompt += `5. Use the same section types: heading, paragraph, list, table\n\n`;

    prompt += `Return ONLY the edited JSON content, no explanations.\n`;

    return prompt;
  }

  /**
   * Parse edited content from AI response
   */
  private parseEditedContent(
    aiResponse: string,
    fallbackContent: RenderableSection[]
  ): RenderableSection[] {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed as RenderableSection[];
        }
      }

      // Fallback: return original content
      console.warn('Failed to parse AI edit response, returning original content');
      return fallbackContent;
    } catch (error) {
      console.error('Error parsing edited content:', error);
      return fallbackContent;
    }
  }

  /**
   * Generate human-readable edit description
   */
  private generateEditDescription(
    beforeContent: RenderableSection[],
    afterContent: RenderableSection[],
    editCommand: EditCommand
  ): string {
    const changes = this.calculateChanges(beforeContent, afterContent);

    let description = `Applied AI edit: "${editCommand.command}". `;

    if (changes.sectionsModified > 0) {
      description += `Modified ${changes.sectionsModified} section(s). `;
    }
    if (changes.sectionsAdded > 0) {
      description += `Added ${changes.sectionsAdded} section(s). `;
    }
    if (changes.sectionsRemoved > 0) {
      description += `Removed ${changes.sectionsRemoved} section(s). `;
    }

    return description.trim();
  }

  /**
   * Calculate changes between content versions
   */
  private calculateChanges(
    beforeContent: RenderableSection[],
    afterContent: RenderableSection[]
  ): { sectionsModified: number; sectionsAdded: number; sectionsRemoved: number } {
    const beforeCount = beforeContent.length;
    const afterCount = afterContent.length;

    let sectionsModified = 0;
    let sectionsAdded = 0;
    let sectionsRemoved = 0;

    if (afterCount > beforeCount) {
      sectionsAdded = afterCount - beforeCount;
    } else if (afterCount < beforeCount) {
      sectionsRemoved = beforeCount - afterCount;
    }

    // Count modified sections (compare content)
    const minLength = Math.min(beforeCount, afterCount);
    for (let i = 0; i < minLength; i++) {
      if (JSON.stringify(beforeContent[i]) !== JSON.stringify(afterContent[i])) {
        sectionsModified++;
      }
    }

    return { sectionsModified, sectionsAdded, sectionsRemoved };
  }

  /**
   * Apply manual edit to document
   */
  async applyManualEdit(
    userId: string,
    generatedDocId: string,
    editedContent: RenderableSection[]
  ): Promise<EditResult> {
    try {
      console.log(`✏️  Applying manual edit to document ${generatedDocId}`);

      // Get generated document
      const generatedDoc = await prisma.generatedDocument.findUnique({
        where: { id: generatedDocId },
        include: {
          document: true,
          editHistory: {
            orderBy: { editNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (!generatedDoc) {
        throw new Error('Generated document not found');
      }

      if (generatedDoc.userId !== userId) {
        throw new Error('Access denied');
      }

      // Get current content
      const currentContent = JSON.parse(generatedDoc.renderableContent) as RenderableSection[];

      // Calculate edit number
      const editNumber = generatedDoc.editHistory.length > 0
        ? generatedDoc.editHistory[0].editNumber + 1
        : 1;

      // Calculate changes
      const changes = this.calculateChanges(currentContent, editedContent);

      const description = `Manual edit: Modified ${changes.sectionsModified} section(s), ` +
        `Added ${changes.sectionsAdded} section(s), Removed ${changes.sectionsRemoved} section(s)`;

      // Save edit to history
      await prisma.documentEditHistory.create({
        data: {
          generatedDocumentId: generatedDocId,
          editNumber,
          editType: 'manual_edit',
          editDescription: description,
          contentBefore: JSON.stringify(currentContent),
          contentAfter: JSON.stringify(editedContent),
          editedBy: userId,
        },
      });

      // Update generated document
      await prisma.generatedDocument.update({
        where: { id: generatedDocId },
        data: {
          renderableContent: JSON.stringify(editedContent),
        },
      });

      // Update document
      await prisma.document.update({
        where: { id: generatedDoc.documentId },
        data: {
          renderableContent: JSON.stringify(editedContent),
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.DOCUMENT_UPDATE,
        status: AuditStatus.SUCCESS,
        resource: generatedDoc.documentId,
        details: {
          operation: 'manual_edit',
          editNumber,
        },
      });

      console.log(`✅ Manual edit applied successfully: Edit #${editNumber}`);

      return {
        success: true,
        editedContent,
        editNumber,
        description,
        changes,
      };
    } catch (error) {
      console.error('❌ Error applying manual edit:', error);
      throw error;
    }
  }

  /**
   * Get edit history for a document
   */
  async getEditHistory(
    userId: string,
    generatedDocId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      // Verify ownership
      const generatedDoc = await prisma.generatedDocument.findUnique({
        where: { id: generatedDocId },
      });

      if (!generatedDoc) {
        throw new Error('Generated document not found');
      }

      if (generatedDoc.userId !== userId) {
        throw new Error('Access denied');
      }

      // Get edit history
      const history = await prisma.documentEditHistory.findMany({
        where: { generatedDocumentId: generatedDocId },
        orderBy: { editNumber: 'desc' },
        take: limit,
      });

      return history.map((edit) => ({
        editNumber: edit.editNumber,
        editType: edit.editType,
        editCommand: edit.editCommand,
        description: edit.editDescription,
        editedAt: edit.editedAt,
        editedBy: edit.editedBy,
      }));
    } catch (error) {
      console.error('Error getting edit history:', error);
      throw error;
    }
  }

  /**
   * Rollback document to a previous edit
   */
  async rollbackToEdit(
    userId: string,
    generatedDocId: string,
    targetEditNumber: number
  ): Promise<EditResult> {
    try {
      console.log(`⏪ Rolling back document ${generatedDocId} to edit #${targetEditNumber}`);

      // Get generated document
      const generatedDoc = await prisma.generatedDocument.findUnique({
        where: { id: generatedDocId },
        include: {
          document: true,
          editHistory: {
            orderBy: { editNumber: 'desc' },
          },
        },
      });

      if (!generatedDoc) {
        throw new Error('Generated document not found');
      }

      if (generatedDoc.userId !== userId) {
        throw new Error('Access denied');
      }

      // Find target edit
      const targetEdit = generatedDoc.editHistory.find(
        (edit) => edit.editNumber === targetEditNumber
      );

      if (!targetEdit) {
        throw new Error(`Edit #${targetEditNumber} not found`);
      }

      // Get current content and target content
      const currentContent = JSON.parse(generatedDoc.renderableContent) as RenderableSection[];
      const targetContent = JSON.parse(targetEdit.contentAfter) as RenderableSection[];

      // Create new edit number
      const latestEdit = generatedDoc.editHistory[0];
      const newEditNumber = latestEdit ? latestEdit.editNumber + 1 : 1;

      // Calculate changes
      const changes = this.calculateChanges(currentContent, targetContent);

      const description = `Rolled back to Edit #${targetEditNumber}`;

      // Save rollback as new edit
      await prisma.documentEditHistory.create({
        data: {
          generatedDocumentId: generatedDocId,
          editNumber: newEditNumber,
          editType: 'rollback',
          editDescription: description,
          contentBefore: JSON.stringify(currentContent),
          contentAfter: JSON.stringify(targetContent),
          editedBy: userId,
        },
      });

      // Update generated document
      await prisma.generatedDocument.update({
        where: { id: generatedDocId },
        data: {
          renderableContent: JSON.stringify(targetContent),
        },
      });

      // Update document
      await prisma.document.update({
        where: { id: generatedDoc.documentId },
        data: {
          renderableContent: JSON.stringify(targetContent),
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: AuditAction.DOCUMENT_UPDATE,
        status: AuditStatus.SUCCESS,
        resource: generatedDoc.documentId,
        details: {
          operation: 'rollback',
          targetEditNumber,
          newEditNumber,
        },
      });

      console.log(`✅ Rolled back to edit #${targetEditNumber}`);

      return {
        success: true,
        editedContent: targetContent,
        editNumber: newEditNumber,
        description,
        changes,
      };
    } catch (error) {
      console.error('❌ Error rolling back document:', error);
      throw error;
    }
  }

  /**
   * Generate live preview for document
   */
  async generateLivePreview(
    userId: string,
    generatedDocId: string
  ): Promise<{ html: string; css: string }> {
    try {
      // Get generated document
      const generatedDoc = await prisma.generatedDocument.findUnique({
        where: { id: generatedDocId },
      });

      if (!generatedDoc) {
        throw new Error('Generated document not found');
      }

      if (generatedDoc.userId !== userId) {
        throw new Error('Access denied');
      }

      // Get renderable content
      const content = JSON.parse(generatedDoc.renderableContent) as RenderableSection[];

      // Convert to HTML
      const html = this.renderContentToHTML(content);
      const css = this.getPreviewCSS();

      return { html, css };
    } catch (error) {
      console.error('Error generating live preview:', error);
      throw error;
    }
  }

  /**
   * Render content sections to HTML
   */
  private renderContentToHTML(content: RenderableSection[]): string {
    let html = '<div class="document-preview">\n';

    for (const section of content) {
      switch (section.type) {
        case 'heading':
          const level = section.content.level || 1;
          html += `<h${level}>${this.escapeHTML(section.content.text)}</h${level}>\n`;
          break;

        case 'paragraph':
          html += `<p>${this.escapeHTML(section.content.text)}</p>\n`;
          break;

        case 'list':
          html += '<ul>\n';
          for (const item of section.content.items) {
            html += `<li>${this.escapeHTML(item.text)}</li>\n`;
          }
          html += '</ul>\n';
          break;

        case 'table':
          html += '<table>\n';
          html += '<thead><tr>\n';
          for (const header of section.content.headers) {
            html += `<th>${this.escapeHTML(header)}</th>\n`;
          }
          html += '</tr></thead>\n<tbody>\n';
          for (const row of section.content.rows) {
            html += '<tr>\n';
            for (const cell of row) {
              html += `<td>${this.escapeHTML(String(cell))}</td>\n`;
            }
            html += '</tr>\n';
          }
          html += '</tbody>\n</table>\n';
          break;

        default:
          html += `<div>${this.escapeHTML(JSON.stringify(section.content))}</div>\n`;
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * Get CSS for preview
   */
  private getPreviewCSS(): string {
    return `
.document-preview {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.document-preview h1 {
  font-size: 2em;
  margin-top: 0.67em;
  margin-bottom: 0.67em;
  font-weight: bold;
}

.document-preview h2 {
  font-size: 1.5em;
  margin-top: 0.83em;
  margin-bottom: 0.83em;
  font-weight: bold;
}

.document-preview h3 {
  font-size: 1.17em;
  margin-top: 1em;
  margin-bottom: 1em;
  font-weight: bold;
}

.document-preview p {
  margin: 1em 0;
}

.document-preview ul {
  list-style-type: disc;
  padding-left: 40px;
  margin: 1em 0;
}

.document-preview li {
  margin: 0.5em 0;
}

.document-preview table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.document-preview th,
.document-preview td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.document-preview th {
  background-color: #f2f2f2;
  font-weight: bold;
}

.document-preview tr:hover {
  background-color: #f5f5f5;
}
    `.trim();
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export default new DocumentEditingService();
