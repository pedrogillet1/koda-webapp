/**
 * Chat Document Controller
 * Handles chat document export operations (PDF, DOCX, Markdown)
 */

import { Request, Response } from 'express';
import chatDocumentGenerationService from '../services/chatDocumentGeneration.service';
import documentExportService from '../services/documentExport.service';

/**
 * Export chat document to specified format (PDF, DOCX, MD)
 * GET /api/chat-documents/:id/export/:format
 */
export const exportChatDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { format } = req.params; // 'pdf', 'docx', 'md'

    // Validate format
    if (!format || !['pdf', 'docx', 'md'].includes(format.toLowerCase())) {
      res.status(400).json({ error: 'Invalid format. Must be pdf, docx, or md.' });
      return;
    }

    console.log(`[Chat Document Export] Exporting chat document ${id} to ${format}`);

    // Check if user has access (userId from auth middleware)
    const userId = (req as any).user?.userId;

    // Get chat document
    const chatDocument = await chatDocumentGenerationService.getChatDocument(id, userId);

    if (!chatDocument) {
      res.status(404).json({ error: 'Chat document not found' });
      return;
    }
    if (chatDocument.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Handle markdown export (no conversion needed)
    if (format.toLowerCase() === 'md') {
      const filename = `${chatDocument.title.replace(/[^a-z0-9]/gi, '_')}.md`;

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(chatDocument.markdownContent);
      return;
    }

    // Export to PDF or DOCX using the document export service
    const exportBuffer = await documentExportService.exportDocument({
      format: format as 'pdf' | 'docx',
      markdownContent: chatDocument.markdownContent,
      filename: chatDocument.title,
    });

    // Set response headers
    const mimeTypes = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const extensions = {
      pdf: 'pdf',
      docx: 'docx',
    };

    const filename = `${chatDocument.title.replace(/[^a-z0-9]/gi, '_')}.${extensions[format as 'pdf' | 'docx']}`;

    res.setHeader('Content-Type', mimeTypes[format as 'pdf' | 'docx']);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', exportBuffer.length);

    res.send(exportBuffer);

    console.log(`[Chat Document Export] Successfully exported to ${format}`);
  } catch (error: any) {
    console.error('[Chat Document Export] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to export chat document' });
  }
};

/**
 * Get chat document by ID
 * GET /api/chat-documents/:id
 */
export const getChatDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    console.log(`[Chat Document] Getting chat document ${id}`);

    const chatDocument = await chatDocumentGenerationService.getChatDocument(id, userId);

    if (!chatDocument) {
      res.status(404).json({ error: 'Chat document not found' });
      return;
    }

    // Check access
    if (chatDocument.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(chatDocument);
  } catch (error: any) {
    console.error('[Chat Document] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get chat document' });
  }
};

/**
 * Get all chat documents for a conversation
 * GET /api/chat-documents/conversation/:conversationId
 */
export const getChatDocumentsByConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user?.userId;

    console.log(`[Chat Document] Getting documents for conversation ${conversationId}`);

    const chatDocuments = await chatDocumentGenerationService.getChatDocumentsByConversation(conversationId, userId);

    // Filter to only user's documents
    const userDocuments = chatDocuments.filter(doc => doc.userId === userId);

    res.json(userDocuments);
  } catch (error: any) {
    console.error('[Chat Document] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get chat documents' });
  }
};
