/** Chat Document Generation Service - Creates PDF documents from chat-generated content */

import documentExportService from './documentExport.service';
import s3StorageService from './s3Storage.service';
import prisma from '../config/database';
import crypto from 'crypto';
import path from 'path';

interface GenerateDocumentParams {
  userId: string;
  content: string;
  title?: string;
  conversationId?: string;
}

class ChatDocumentGenerationService {
  /**
   * Generate a PDF document from markdown content
   * Automatically creates and uploads the document to S3
   */
  async generateDocument(params: GenerateDocumentParams) {
    const { userId, content, title, conversationId } = params;

    try {
      console.log('📄 [DOC GENERATION] Starting PDF document creation...');

      // Generate filename from title or use default
      const documentTitle = title || 'Summary Report';
      const baseFilename = this.sanitizeFilename(documentTitle);
      const filename = `${baseFilename}.pdf`;

      console.log(`📝 [DOC GENERATION] Filename: ${filename}`);

      // Format content with professional document header
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const formattedContent = `# KODA AI

## ${documentTitle}

**Generated on ${currentDate}**

---

${content}`;

      // Convert markdown content to PDF
      const pdfBuffer = await documentExportService.exportToPdf(formattedContent, filename);
      console.log(`✅ [DOC GENERATION] PDF generated (${pdfBuffer.length} bytes)`);

      // Generate file hash for integrity checking
      const fileHash = crypto
        .createHash('sha256')
        .update(pdfBuffer)
        .digest('hex');

      // Create document record in database FIRST (to get document ID for S3 path)
      const document = await prisma.document.create({
        data: {
          userId,
          filename,
          fileSize: pdfBuffer.length,
          mimeType: 'application/pdf',
          fileHash,
          status: 'pending', // Will be set to 'completed' after S3 upload
          encryptedFilename: '', // Will be updated after S3 upload
        },
      });

      console.log(`💾 [DOC GENERATION] Document record created: ${document.id}`);

      // Upload to S3
      const s3Key = `${userId}/${document.id}-${Date.now()}`;
      await s3StorageService.uploadFile(s3Key, pdfBuffer, 'application/pdf');
      console.log(`☁️  [DOC GENERATION] Uploaded to S3: ${s3Key}`);

      // Update document with S3 path and mark as completed
      await prisma.document.update({
        where: { id: document.id },
        data: {
          encryptedFilename: s3Key,
          status: 'completed',
        },
      });

      // Store the markdown content in document metadata
      await prisma.documentMetadata.create({
        data: {
          documentId: document.id,
          markdownContent: content,
          hasSignature: false,
          hasTables: content.includes('|'),
          hasImages: false,
        },
      });

      console.log(`✅ [DOC GENERATION] Document creation complete: ${document.id}`);

      return {
        documentId: document.id,
        filename,
        content,
        fileSize: pdfBuffer.length,
      };
    } catch (error) {
      console.error('❌ [DOC GENERATION] Error:', error);
      throw new Error(`Failed to generate document: ${error.message}`);
    }
  }

  /**
   * Sanitize filename to remove invalid characters
   */
  private sanitizeFilename(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100); // Limit length
  }

  async getChatDocument(chatDocId: string, userId: string) {
    // Get document from database
    const document = await prisma.document.findFirst({
      where: {
        id: chatDocId,
        userId,
      },
      include: {
        metadata: true,
      },
    });

    return document;
  }

  async getChatDocumentsByConversation(conversationId: string, userId: string) {
    // This would require storing conversationId with documents
    // For now, return empty array (to be implemented)
    return [];
  }
}

export default new ChatDocumentGenerationService();
