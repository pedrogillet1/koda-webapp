/**
 * File Type Filtering Handler
 * Handles file type queries in natural language:
 * - "Show me all PDFs"
 * - "Find Word documents in Finance"
 * - "What spreadsheets do I have?"
 * - "Show me all images"
 */

import prisma from '../../config/database';

export interface FileTypeDocument {
  id: string;
  filename: string;
  mimeType: string;
  fileSize?: number;
  createdAt: Date;
  folderName?: string;
  status: string;
}

export interface FileTypeResult {
  answer: string;
  documents: FileTypeDocument[];
  totalCount: number;
  fileType: string;
}

export class FileTypeHandler {

  /**
   * Map of common file type terms to MIME type patterns
   */
  private readonly fileTypeMap: Record<string, { mimeTypes: string[], emoji: string, label: string }> = {
    // Documents
    'pdf': { mimeTypes: ['application/pdf'], emoji: '📕', label: 'PDF' },
    'pdfs': { mimeTypes: ['application/pdf'], emoji: '📕', label: 'PDF' },

    'word': {
      mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml'],
      emoji: '📄',
      label: 'Word document'
    },
    'word document': {
      mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml'],
      emoji: '📄',
      label: 'Word document'
    },
    'word documents': {
      mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml'],
      emoji: '📄',
      label: 'Word document'
    },
    'doc': {
      mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml'],
      emoji: '📄',
      label: 'Word document'
    },
    'docs': {
      mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml'],
      emoji: '📄',
      label: 'Word document'
    },
    'docx': {
      mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml'],
      emoji: '📄',
      label: 'Word document'
    },

    // Spreadsheets
    'excel': {
      mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml'],
      emoji: '📊',
      label: 'Excel spreadsheet'
    },
    'excel file': {
      mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml'],
      emoji: '📊',
      label: 'Excel spreadsheet'
    },
    'excel files': {
      mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml'],
      emoji: '📊',
      label: 'Excel spreadsheet'
    },
    'spreadsheet': {
      mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml', 'text/csv'],
      emoji: '📊',
      label: 'spreadsheet'
    },
    'spreadsheets': {
      mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml', 'text/csv'],
      emoji: '📊',
      label: 'spreadsheet'
    },
    'xlsx': {
      mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml'],
      emoji: '📊',
      label: 'Excel spreadsheet'
    },
    'csv': {
      mimeTypes: ['text/csv'],
      emoji: '📊',
      label: 'CSV file'
    },
    'csvs': {
      mimeTypes: ['text/csv'],
      emoji: '📊',
      label: 'CSV file'
    },

    // Presentations
    'powerpoint': {
      mimeTypes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'],
      emoji: '📽️',
      label: 'PowerPoint presentation'
    },
    'powerpoint presentation': {
      mimeTypes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'],
      emoji: '📽️',
      label: 'PowerPoint presentation'
    },
    'presentation': {
      mimeTypes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'],
      emoji: '📽️',
      label: 'presentation'
    },
    'presentations': {
      mimeTypes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'],
      emoji: '📽️',
      label: 'presentation'
    },
    'ppt': {
      mimeTypes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'],
      emoji: '📽️',
      label: 'PowerPoint presentation'
    },
    'pptx': {
      mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml'],
      emoji: '📽️',
      label: 'PowerPoint presentation'
    },

    // Images
    'image': {
      mimeTypes: ['image/'],
      emoji: '🖼️',
      label: 'image'
    },
    'images': {
      mimeTypes: ['image/'],
      emoji: '🖼️',
      label: 'image'
    },
    'picture': {
      mimeTypes: ['image/'],
      emoji: '🖼️',
      label: 'image'
    },
    'pictures': {
      mimeTypes: ['image/'],
      emoji: '🖼️',
      label: 'image'
    },
    'photo': {
      mimeTypes: ['image/'],
      emoji: '📸',
      label: 'photo'
    },
    'photos': {
      mimeTypes: ['image/'],
      emoji: '📸',
      label: 'photo'
    },
    'png': {
      mimeTypes: ['image/png'],
      emoji: '🖼️',
      label: 'PNG image'
    },
    'jpg': {
      mimeTypes: ['image/jpeg'],
      emoji: '🖼️',
      label: 'JPEG image'
    },
    'jpeg': {
      mimeTypes: ['image/jpeg'],
      emoji: '🖼️',
      label: 'JPEG image'
    },

    // Text files
    'text': {
      mimeTypes: ['text/plain'],
      emoji: '📝',
      label: 'text file'
    },
    'text file': {
      mimeTypes: ['text/plain'],
      emoji: '📝',
      label: 'text file'
    },
    'text files': {
      mimeTypes: ['text/plain'],
      emoji: '📝',
      label: 'text file'
    },
    'txt': {
      mimeTypes: ['text/plain'],
      emoji: '📝',
      label: 'text file'
    },

    // Archives
    'zip': {
      mimeTypes: ['application/zip', 'application/x-zip-compressed'],
      emoji: '📦',
      label: 'ZIP archive'
    },
    'archive': {
      mimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-rar', 'application/x-7z-compressed'],
      emoji: '📦',
      label: 'archive'
    },
    'archives': {
      mimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-rar', 'application/x-7z-compressed'],
      emoji: '📦',
      label: 'archive'
    },

    // Generic document types
    'document': {
      mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml', 'application/pdf', 'text/'],
      emoji: '📄',
      label: 'document'
    },
    'documents': {
      mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml', 'application/pdf', 'text/'],
      emoji: '📄',
      label: 'document'
    },
  };

  /**
   * Detect file type from query
   */
  detectFileType(query: string): { mimeTypes: string[], emoji: string, label: string, detectedTerm: string } | null {
    const lowerQuery = query.toLowerCase();

    // Sort by length (longest first) to match more specific terms first
    const sortedTerms = Object.keys(this.fileTypeMap).sort((a, b) => b.length - a.length);

    for (const term of sortedTerms) {
      // Check if the term appears as a whole word
      const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, 'i');
      if (wordBoundaryRegex.test(lowerQuery)) {
        return {
          ...this.fileTypeMap[term],
          detectedTerm: term
        };
      }
    }

    return null;
  }

  /**
   * Handle file type queries
   */
  async handle(
    userId: string,
    query: string,
    additionalFilters?: {
      folderId?: string;
      createdAfter?: Date;
      createdBefore?: Date;
    }
  ): Promise<FileTypeResult | null> {
    console.log(`\n📁 FILE TYPE QUERY: "${query}"`);

    // Detect file type
    const fileTypeInfo = this.detectFileType(query);
    if (!fileTypeInfo) {
      console.log('   ❌ No file type detected');
      return null;
    }

    console.log(`   📋 Detected file type: ${fileTypeInfo.label} (term: "${fileTypeInfo.detectedTerm}")`);
    console.log(`   🔍 Searching MIME types: ${fileTypeInfo.mimeTypes.join(', ')}`);

    // Build query filter
    const where: any = {
      userId,
      status: 'completed',
      OR: fileTypeInfo.mimeTypes.map(mimeType => ({
        mimeType: { contains: mimeType }
      }))
    };

    // Apply additional filters
    if (additionalFilters?.folderId) {
      where.folderId = additionalFilters.folderId;
    }
    if (additionalFilters?.createdAfter || additionalFilters?.createdBefore) {
      where.createdAt = {};
      if (additionalFilters.createdAfter) {
        where.createdAt.gte = additionalFilters.createdAfter;
      }
      if (additionalFilters.createdBefore) {
        where.createdAt.lte = additionalFilters.createdBefore;
      }
    }

    // Fetch documents
    const documents = await prisma.document.findMany({
      where,
      include: {
        folder: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`   ✅ Found ${documents.length} documents`);

    if (documents.length === 0) {
      return {
        answer: `${fileTypeInfo.emoji} **${fileTypeInfo.label.charAt(0).toUpperCase() + fileTypeInfo.label.slice(1)}s**\n\nNo ${fileTypeInfo.label}s found in your library.\n\nTry uploading some files! 📤`,
        documents: [],
        totalCount: 0,
        fileType: fileTypeInfo.label
      };
    }

    // Format documents
    const formattedDocs: FileTypeDocument[] = documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      folderName: doc.folder?.name,
      status: doc.status
    }));

    // Build answer
    let answer = `${fileTypeInfo.emoji} **${fileTypeInfo.label.charAt(0).toUpperCase() + fileTypeInfo.label.slice(1)}s**\n\n`;
    answer += `Found **${documents.length}** ${fileTypeInfo.label}${documents.length === 1 ? '' : 's'}:\n\n`;

    // Group by folder for better organization
    const grouped = this.groupByFolder(formattedDocs);

    if (Object.keys(grouped).length === 1 && grouped['No folder']) {
      // All files in root - don't group
      formattedDocs.forEach((doc, idx) => {
        const fileSize = doc.fileSize ? ` (${this.formatFileSize(doc.fileSize)})` : '';
        answer += `${idx + 1}. **${doc.filename}**${fileSize}\n`;
      });
    } else {
      // Group by folder
      for (const [folderLabel, docs] of Object.entries(grouped)) {
        if (folderLabel !== 'No folder') {
          answer += `**📁 ${folderLabel}:**\n`;
        } else {
          answer += `**📄 Root:**\n`;
        }
        docs.forEach((doc, idx) => {
          const fileSize = doc.fileSize ? ` (${this.formatFileSize(doc.fileSize)})` : '';
          answer += `${idx + 1}. ${doc.filename}${fileSize}\n`;
        });
        answer += `\n`;
      }
    }

    // Calculate total size
    const totalSize = formattedDocs.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    if (totalSize > 0) {
      answer += `\n💾 *Total size: ${this.formatFileSize(totalSize)}*`;
    }

    return {
      answer,
      documents: formattedDocs,
      totalCount: documents.length,
      fileType: fileTypeInfo.label
    };
  }

  /**
   * Group documents by folder
   */
  private groupByFolder(documents: FileTypeDocument[]): Record<string, FileTypeDocument[]> {
    const groups: Record<string, FileTypeDocument[]> = {};

    for (const doc of documents) {
      const folderLabel = doc.folderName || 'No folder';
      if (!groups[folderLabel]) {
        groups[folderLabel] = [];
      }
      groups[folderLabel].push(doc);
    }

    return groups;
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return Object.keys(this.fileTypeMap);
  }
}

export default new FileTypeHandler();
