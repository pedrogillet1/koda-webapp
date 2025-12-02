/**
 * File Type Filtering Handler
 * Handles file type queries in natural language:
 * - "Show me all PDFs"
 * - "Find Word documents in Finance"
 * - "What spreadsheets do I have?"
 * - "Show me all images"
 */

import prisma from '../../config/database';

// ============================================================================
// LOCALIZED RESPONSE TEMPLATES
// ============================================================================

interface LocalizedTemplates {
  found: (count: number, type: string) => string;
  noFiles: (type: string) => string;
  totalSize: string;
  root: string;
  files: (count: number) => string;
  file: string;
}

const responseTemplates: Record<string, LocalizedTemplates> = {
  pt: {
    found: (count: number, type: string) => `Encontrei **${count}** ${type}${count === 1 ? '' : 's'}:`,
    noFiles: (type: string) => `**Nenhum ${type} encontrado**\n\nNão foram encontrados ${type}s na sua biblioteca.\n\nTente fazer upload de alguns arquivos!`,
    totalSize: 'Tamanho total',
    root: 'Raiz',
    files: (count: number) => `${count} arquivo${count === 1 ? '' : 's'}`,
    file: 'arquivo'
  },
  es: {
    found: (count: number, type: string) => `Encontré **${count}** ${type}${count === 1 ? '' : 's'}:`,
    noFiles: (type: string) => `**No se encontraron ${type}s**\n\nNo se encontraron ${type}s en tu biblioteca.\n\n¡Intenta subir algunos archivos!`,
    totalSize: 'Tamaño total',
    root: 'Raíz',
    files: (count: number) => `${count} archivo${count === 1 ? '' : 's'}`,
    file: 'archivo'
  },
  fr: {
    found: (count: number, type: string) => `J'ai trouvé **${count}** ${type}${count === 1 ? '' : 's'}:`,
    noFiles: (type: string) => `**Aucun ${type} trouvé**\n\nAucun ${type} trouvé dans votre bibliothèque.\n\nEssayez de télécharger des fichiers!`,
    totalSize: 'Taille totale',
    root: 'Racine',
    files: (count: number) => `${count} fichier${count === 1 ? '' : 's'}`,
    file: 'fichier'
  },
  en: {
    found: (count: number, type: string) => `Found **${count}** ${type}${count === 1 ? '' : 's'}:`,
    noFiles: (type: string) => `**No ${type}s found**\n\nNo ${type}s found in your library.\n\nTry uploading some files!`,
    totalSize: 'Total size',
    root: 'Root',
    files: (count: number) => `${count} file${count === 1 ? '' : 's'}`,
    file: 'file'
  }
};

/**
 * Get localized templates for the given language
 */
function getTemplates(language: string): LocalizedTemplates {
  return responseTemplates[language] || responseTemplates.en;
}

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
   * Detect ALL file types from query
   */
  detectFileTypes(query: string): Array<{ mimeTypes: string[], emoji: string, label: string, detectedTerm: string }> {
    const lowerQuery = query.toLowerCase();
    const detectedTypes: Array<{ mimeTypes: string[], emoji: string, label: string, detectedTerm: string }> = [];

    // Sort by length (longest first) to match more specific terms first
    const sortedTerms = Object.keys(this.fileTypeMap).sort((a, b) => b.length - a.length);

    const matchedTerms = new Set<string>(); // Track matched terms to avoid duplicates

    for (const term of sortedTerms) {
      // Skip if we already matched a more specific version of this term
      if (matchedTerms.has(term)) continue;

      // Check if the term appears as a whole word
      const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, 'i');
      if (wordBoundaryRegex.test(lowerQuery)) {
        detectedTypes.push({
          ...this.fileTypeMap[term],
          detectedTerm: term
        });
        matchedTerms.add(term);
      }
    }

    return detectedTypes;
  }

  /**
   * Handle file type queries (supports multiple types)
   */
  async handle(
    userId: string,
    query: string,
    additionalFilters?: {
      folderId?: string;
      createdAfter?: Date;
      createdBefore?: Date;
    },
    language: string = 'en'
  ): Promise<FileTypeResult | null> {
    console.log(`\n📁 FILE TYPE QUERY: "${query}" (Language: ${language})`);

    // Get localized templates
    const templates = getTemplates(language);

    // Detect ALL file types in query
    const fileTypeInfos = this.detectFileTypes(query);
    if (fileTypeInfos.length === 0) {
      console.log('   ❌ No file type detected');
      return null;
    }

    console.log(`   📋 Detected ${fileTypeInfos.length} file type(s): ${fileTypeInfos.map(f => f.label).join(', ')}`);

    // Collect all MIME types from all detected file types
    const allMimeTypes = fileTypeInfos.flatMap(info => info.mimeTypes);
    console.log(`   🔍 Searching MIME types: ${allMimeTypes.join(', ')}`);

    // Build query filter
    const where: any = {
      userId,
      status: 'completed',
      OR: allMimeTypes.map(mimeType => ({
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
    const documents = await prisma.documents.findMany({
      where,
      include: {
        folders: {
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
      const typeLabels = fileTypeInfos.map(f => f.label).join(' and ');
      return {
        answer: templates.noFiles(typeLabels),
        documents: [],
        totalCount: 0,
        fileType: typeLabels
      };
    }

    // Format documents
    const formattedDocs: FileTypeDocument[] = documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      folderName: doc.folders?.name,
      status: doc.status
    }));

    // If multiple types requested, group by file type
    if (fileTypeInfos.length > 1) {
      return this.formatMultipleTypes(formattedDocs, fileTypeInfos);
    }

    // Single type - use existing format
    const fileTypeInfo = fileTypeInfos[0];
    let answer = `**${fileTypeInfo.label.charAt(0).toUpperCase() + fileTypeInfo.label.slice(1)}s**\n\n`;
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
          answer += `**${folderLabel}:**\n`;
        } else {
          answer += `**Root:**\n`;
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
      answer += `\n*Total size: ${this.formatFileSize(totalSize)}*`;
    }

    return {
      answer,
      documents: formattedDocs,
      totalCount: documents.length,
      fileType: fileTypeInfo.label
    };
  }

  /**
   * Format response for multiple file types
   */
  private formatMultipleTypes(
    documents: FileTypeDocument[],
    fileTypeInfos: Array<{ mimeTypes: string[], emoji: string, label: string, detectedTerm: string }>
  ): FileTypeResult {
    let answer = `**Found ${documents.length} file${documents.length === 1 ? '' : 's'}:**\n\n`;

    // Group documents by file type
    const groupedByType: Record<string, FileTypeDocument[]> = {};

    for (const doc of documents) {
      // Find which file type this document belongs to
      let matchedType: string | null = null;

      for (const typeInfo of fileTypeInfos) {
        for (const mimeType of typeInfo.mimeTypes) {
          if (doc.mimeType.includes(mimeType)) {
            matchedType = typeInfo.label;
            break;
          }
        }
        if (matchedType) break;
      }

      if (matchedType) {
        if (!groupedByType[matchedType]) {
          groupedByType[matchedType] = [];
        }
        groupedByType[matchedType].push(doc);
      }
    }

    // Format each type group
    for (const typeInfo of fileTypeInfos) {
      const docs = groupedByType[typeInfo.label] || [];

      if (docs.length > 0) {
        answer += `**${typeInfo.label.toUpperCase()} (${docs.length} file${docs.length === 1 ? '' : 's'}):**\n`;

        docs.forEach(doc => {
          const fileSize = doc.fileSize ? ` (${this.formatFileSize(doc.fileSize)})` : '';
          answer += `• ${doc.filename}${fileSize}\n`;
        });

        answer += `\n`;
      } else {
        answer += `**${typeInfo.label.toUpperCase()}:** No files\n\n`;
      }
    }

    // Calculate total size
    const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    if (totalSize > 0) {
      answer += `*Total size: ${this.formatFileSize(totalSize)}*`;
    }

    const typeLabels = fileTypeInfos.map(f => f.label).join(' and ');
    return {
      answer,
      documents,
      totalCount: documents.length,
      fileType: typeLabels
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
