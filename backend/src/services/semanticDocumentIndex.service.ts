/**
 * Semantic Document Index Service
 * Builds semantic index for intelligent document resolution
 */

import prisma from '../config/database';

interface DocumentTypeKeywords {
  [key: string]: string[];
}

interface SemanticIndex {
  documents: any[];
  typeIndex: { [key: string]: any[] };
  keywordIndex: { [key: string]: any[] };
  fuzzyIndex: { [key: string]: any };
  metadata: {
    totalDocuments: number;
    byType: { [key: string]: number };
    indexedAt: string;
  };
}

class SemanticDocumentIndexService {
  private documentTypeKeywords: DocumentTypeKeywords = {
    excel: ['cell', 'cells', 'row', 'rows', 'column', 'columns', 'sheet', 'sheets',
            'spreadsheet', 'table', 'formula', 'workbook', 'data', 'csv'],
    powerpoint: ['slide', 'slides', 'presentation', 'deck', 'slideshow', 'ppt', 'pptx'],
    pdf: ['page', 'pages', 'document', 'report', 'pdf', 'contract', 'agreement'],
    word: ['paragraph', 'paragraphs', 'section', 'sections', 'document', 'doc', 'docx'],
    image: ['image', 'photo', 'picture', 'diagram', 'chart', 'graph', 'screenshot']
  };

  /**
   * Build complete semantic index for user's documents
   */
  async buildSemanticIndex(userId: string): Promise<SemanticIndex> {
    console.log(`📚 Building semantic index for user ${userId}`);

    // Get all user documents with metadata
    const documents = await prisma.document.findMany({
      where: { userId },
      include: {
        metadata: true,
        folder: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const typeIndex: { [key: string]: any[] } = {
      excel: [],
      powerpoint: [],
      pdf: [],
      word: [],
      image: [],
      other: []
    };

    const keywordIndex: { [key: string]: any[] } = {};
    const fuzzyIndex: { [key: string]: any } = {};

    for (const doc of documents) {
      // Determine document type
      const docType = this.getDocumentType(doc.mimeType, doc.filename);

      // Add to type index
      typeIndex[docType].push(doc);

      // Extract keywords from filename
      const filenameKeywords = this.extractKeywords(doc.filename);

      // Add to keyword index
      for (const keyword of filenameKeywords) {
        if (!keywordIndex[keyword]) {
          keywordIndex[keyword] = [];
        }
        keywordIndex[keyword].push(doc);
      }

      // Add to fuzzy index (for partial matching)
      const fuzzyKey = this.createFuzzyKey(doc.filename);
      fuzzyIndex[fuzzyKey] = doc;

      // Also index by extracted text keywords
      if (doc.metadata?.extractedText) {
        const contentKeywords = this.extractContentKeywords(doc.metadata.extractedText);
        for (const keyword of contentKeywords.slice(0, 50)) { // Top 50 keywords
          if (!keywordIndex[keyword]) {
            keywordIndex[keyword] = [];
          }
          // Avoid duplicates
          if (!keywordIndex[keyword].find(d => d.id === doc.id)) {
            keywordIndex[keyword].push(doc);
          }
        }
      }

      // Index tags
      for (const docTag of doc.tags) {
        const tagName = docTag.tag.name.toLowerCase();
        if (!keywordIndex[tagName]) {
          keywordIndex[tagName] = [];
        }
        if (!keywordIndex[tagName].find(d => d.id === doc.id)) {
          keywordIndex[tagName].push(doc);
        }
      }
    }

    console.log(`✅ Built semantic index: ${documents.length} documents, ${Object.keys(keywordIndex).length} keywords`);

    return {
      documents,
      typeIndex,
      keywordIndex,
      fuzzyIndex,
      metadata: {
        totalDocuments: documents.length,
        byType: Object.fromEntries(
          Object.entries(typeIndex).map(([type, docs]) => [type, docs.length])
        ),
        indexedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Determine document type from mime type and filename
   */
  getDocumentType(mimeType: string, filename: string): string {
    const mimeTypeMap: { [key: string]: string } = {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
      'application/vnd.ms-excel': 'excel',
      'text/csv': 'excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
      'application/vnd.ms-powerpoint': 'powerpoint',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
      'application/msword': 'word',
      'image/png': 'image',
      'image/jpeg': 'image',
      'image/jpg': 'image',
      'image/gif': 'image',
      'image/webp': 'image'
    };

    let docType = mimeTypeMap[mimeType] || 'other';

    // Also check file extension
    const ext = filename.toLowerCase().split('.').pop() || '';
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      docType = 'excel';
    } else if (['pptx', 'ppt'].includes(ext)) {
      docType = 'powerpoint';
    } else if (ext === 'pdf') {
      docType = 'pdf';
    } else if (['docx', 'doc'].includes(ext)) {
      docType = 'word';
    }

    return docType;
  }

  /**
   * Extract meaningful keywords from filename
   */
  extractKeywords(filename: string): string[] {
    // Remove extension
    const name = filename.substring(0, filename.lastIndexOf('.')) || filename;

    // Split by common separators
    const words = name.split(/[_\-\s\(\)\[\]]+/);

    // Clean and filter
    const keywords: string[] = [];
    for (const word of words) {
      // Remove numbers and version indicators
      if (/^(v\d+|\d+|final|draft|copy)$/i.test(word.toLowerCase())) {
        continue;
      }

      // Convert to lowercase
      const cleanWord = word.toLowerCase();

      // Skip very short words
      if (cleanWord.length < 3) {
        continue;
      }

      keywords.push(cleanWord);
    }

    return keywords;
  }

  /**
   * Create a normalized key for fuzzy matching
   */
  createFuzzyKey(filename: string): string {
    // Remove extension
    let name = filename.substring(0, filename.lastIndexOf('.')) || filename;

    // Remove special characters, numbers, versions
    name = name.replace(/[_\-\(\)\[\]]+/g, ' ');
    name = name.replace(/\s+/g, ' ');
    name = name.replace(/(v\d+|final|draft|copy|\d+)/gi, '');

    // Lowercase and strip
    return name.toLowerCase().trim();
  }

  /**
   * Extract important keywords from document content
   */
  extractContentKeywords(text: string): string[] {
    // Simple keyword extraction (can be enhanced with TF-IDF)
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];

    // Count frequency
    const wordFreq: { [key: string]: number } = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }

    // Filter out common words
    const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'were',
                               'will', 'would', 'could', 'should', 'about', 'which', 'their',
                               'there', 'these', 'those', 'when', 'where', 'what', 'while']);

    const keywords = Object.entries(wordFreq)
      .filter(([word]) => !stopWords.has(word))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 100)
      .map(([word]) => word);

    return keywords;
  }
}

export default new SemanticDocumentIndexService();
