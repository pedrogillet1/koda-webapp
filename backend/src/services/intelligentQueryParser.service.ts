/**
 * Intelligent Query Parser Service
 * Parses natural language queries to extract document references and context
 */

interface QueryAnalysis {
  documentType?: string;
  documentNameHints: string[];
  action?: string;
  specificReferences: {
    cell?: string;
    row?: number;
    column?: string;
    sheet?: string;
    slide?: number;
    page?: number;
    paragraph?: number;
    section?: string;
  };
  keywords: string[];
  confidence: {
    type: number; // 0-1
    name: number; // 0-1
    overall: number; // 0-1
  };
  requiresDocument: boolean;
}

class IntelligentQueryParserService {
  private documentTypeKeywords = {
    excel: ['cell', 'cells', 'row', 'rows', 'column', 'columns', 'sheet', 'sheets',
            'spreadsheet', 'table', 'formula', 'workbook', 'data', 'csv'],
    powerpoint: ['slide', 'slides', 'presentation', 'deck', 'slideshow', 'ppt', 'pptx'],
    pdf: ['page', 'pages', 'document', 'report', 'pdf', 'contract', 'agreement'],
    word: ['paragraph', 'paragraphs', 'section', 'sections', 'document', 'doc', 'docx'],
    image: ['image', 'photo', 'picture', 'diagram', 'chart', 'graph', 'screenshot']
  };

  private actionKeywords = {
    analyze: ['analyze', 'analysis', 'examine', 'review', 'evaluate', 'assess'],
    show: ['show', 'display', 'get', 'retrieve', 'fetch', 'find'],
    summarize: ['summarize', 'summary', 'overview', 'brief', 'tldr'],
    compare: ['compare', 'comparison', 'difference', 'versus', 'vs'],
    extract: ['extract', 'pull', 'get data', 'retrieve data'],
    explain: ['explain', 'clarify', 'describe', 'what is', 'what does']
  };

  /**
   * Parse a natural language query to extract document context
   */
  parseQuery(query: string): QueryAnalysis {
    const lowerQuery = query.toLowerCase();
    const words = this.extractWords(query);

    // Detect document type from context keywords
    const documentType = this.detectDocumentType(lowerQuery);

    // Extract document name hints
    const documentNameHints = this.extractDocumentNameHints(lowerQuery, words);

    // Detect user action
    const action = this.detectAction(lowerQuery);

    // Extract specific references (cell B7, slide 5, etc.)
    const specificReferences = this.extractSpecificReferences(lowerQuery);

    // Extract general keywords
    const keywords = this.extractKeywords(words, documentType);

    // Calculate confidence scores
    const confidence = this.calculateConfidence(documentType, documentNameHints, specificReferences);

    // Determine if query requires a document
    const requiresDocument = this.requiresDocument(documentType, specificReferences, documentNameHints);

    return {
      documentType,
      documentNameHints,
      action,
      specificReferences,
      keywords,
      confidence,
      requiresDocument
    };
  }

  /**
   * Detect document type from query context
   */
  private detectDocumentType(query: string): string | undefined {
    const typeScores: { [key: string]: number } = {};

    for (const [type, keywords] of Object.entries(this.documentTypeKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        // Use word boundary regex to avoid partial matches
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(query)) {
          score += 1;
        }
      }
      if (score > 0) {
        typeScores[type] = score;
      }
    }

    // Return type with highest score
    if (Object.keys(typeScores).length === 0) {
      return undefined;
    }

    return Object.entries(typeScores)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  /**
   * Extract potential document name hints from query
   */
  private extractDocumentNameHints(query: string, words: string[]): string[] {
    const hints: string[] = [];

    // Pattern 1: "in [document name]" or "in the [document name]"
    const inPattern = /\b(?:in|from|on)\s+(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+(?:document|file|sheet|presentation|report|pdf|doc|docx|xlsx|pptx|ppt))/gi;
    let match;
    while ((match = inPattern.exec(query)) !== null) {
      hints.push(match[1].trim());
    }

    // Pattern 2: Quoted strings (likely document names)
    const quotedPattern = /["']([^"']+)["']/g;
    while ((match = quotedPattern.exec(query)) !== null) {
      hints.push(match[1].trim());
    }

    // Pattern 3: "[name] document/file/report/etc"
    const nameBeforeTypePattern = /\b([a-z0-9_\-\s]{3,})\s+(?:document|file|sheet|presentation|report|pdf|doc|docx|xlsx|pptx|ppt)\b/gi;
    while ((match = nameBeforeTypePattern.exec(query)) !== null) {
      const name = match[1].trim();
      // Skip common words
      if (!['the', 'this', 'that', 'my', 'our', 'your'].includes(name.toLowerCase())) {
        hints.push(name);
      }
    }

    // Pattern 4: Capitalized sequences (might be document names)
    const capitalizedPattern = /\b([A-Z][a-z]*(?:[_\-\s][A-Z][a-z]*)+)\b/g;
    while ((match = capitalizedPattern.exec(query)) !== null) {
      hints.push(match[1].trim());
    }

    // Pattern 5: Words with underscores or hyphens (common in filenames)
    const filenamePattern = /\b([a-z0-9]+(?:[_\-][a-z0-9]+)+)\b/gi;
    while ((match = filenamePattern.exec(query)) !== null) {
      hints.push(match[1].trim());
    }

    return [...new Set(hints)]; // Remove duplicates
  }

  /**
   * Detect user action from query
   */
  private detectAction(query: string): string | undefined {
    for (const [action, keywords] of Object.entries(this.actionKeywords)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(query)) {
          return action;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract specific references (cell B7, slide 5, page 10, etc.)
   */
  private extractSpecificReferences(query: string): QueryAnalysis['specificReferences'] {
    const references: QueryAnalysis['specificReferences'] = {};

    // Cell reference (e.g., B7, A1, Z99)
    const cellMatch = query.match(/\b([A-Z]+)(\d+)\b/);
    if (cellMatch) {
      references.cell = cellMatch[0];
      references.column = cellMatch[1];
      references.row = parseInt(cellMatch[2]);
    }

    // Row reference (e.g., "row 5", "row 10")
    const rowMatch = query.match(/\brow\s+(\d+)\b/i);
    if (rowMatch) {
      references.row = parseInt(rowMatch[1]);
    }

    // Column reference (e.g., "column B", "column A")
    const columnMatch = query.match(/\bcolumn\s+([A-Z]+)\b/i);
    if (columnMatch) {
      references.column = columnMatch[1].toUpperCase();
    }

    // Sheet reference (e.g., "sheet 2", "sheet named Sales")
    const sheetNumberMatch = query.match(/\bsheet\s+(\d+)\b/i);
    if (sheetNumberMatch) {
      references.sheet = sheetNumberMatch[1];
    } else {
      const sheetNameMatch = query.match(/\bsheet\s+(?:named\s+)?['\"]?([a-z0-9_\s]+)['\"]?/i);
      if (sheetNameMatch) {
        references.sheet = sheetNameMatch[1].trim();
      }
    }

    // Slide reference (e.g., "slide 5", "slide 10")
    const slideMatch = query.match(/\bslide\s+(\d+)\b/i);
    if (slideMatch) {
      references.slide = parseInt(slideMatch[1]);
    }

    // Page reference (e.g., "page 5", "page 10")
    const pageMatch = query.match(/\bpage\s+(\d+)\b/i);
    if (pageMatch) {
      references.page = parseInt(pageMatch[1]);
    }

    // Paragraph reference (e.g., "paragraph 3", "para 5")
    const paragraphMatch = query.match(/\b(?:paragraph|para)\s+(\d+)\b/i);
    if (paragraphMatch) {
      references.paragraph = parseInt(paragraphMatch[1]);
    }

    // Section reference (e.g., "section 2", "in the introduction section")
    const sectionMatch = query.match(/\b(?:section\s+)?(?:named\s+)?['\"]?([a-z0-9_\s]+)['\"]?\s+section\b/i);
    if (sectionMatch) {
      references.section = sectionMatch[1].trim();
    }

    return references;
  }

  /**
   * Extract meaningful keywords from query
   */
  private extractKeywords(words: string[], documentType?: string): string[] {
    // Common stop words to filter out
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'what', 'where', 'when', 'who', 'which',
      'this', 'these', 'those', 'can', 'could', 'should', 'would', 'do', 'does'
    ]);

    // Filter out stop words, short words, and type-specific keywords
    const keywords = words
      .filter(word =>
        word.length >= 3 &&
        !stopWords.has(word) &&
        !(documentType && this.documentTypeKeywords[documentType as keyof typeof this.documentTypeKeywords]?.includes(word))
      );

    return keywords;
  }

  /**
   * Extract individual words from query
   */
  private extractWords(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  /**
   * Calculate confidence scores
   */
  private calculateConfidence(
    documentType: string | undefined,
    documentNameHints: string[],
    specificReferences: QueryAnalysis['specificReferences']
  ): QueryAnalysis['confidence'] {
    let typeConfidence = 0;
    let nameConfidence = 0;

    // Type confidence based on specific references and type detection
    if (documentType) {
      typeConfidence = 0.5;

      // Boost confidence if we have specific references
      const hasSpecificRef = Object.keys(specificReferences).length > 0;
      if (hasSpecificRef) {
        typeConfidence = 0.9;
      }
    }

    // Name confidence based on number and quality of hints
    if (documentNameHints.length > 0) {
      // Base confidence
      nameConfidence = 0.3;

      // Boost for each hint
      nameConfidence += Math.min(0.6, documentNameHints.length * 0.2);

      // Boost for longer hints (likely more specific)
      const avgHintLength = documentNameHints.reduce((sum, hint) => sum + hint.length, 0) / documentNameHints.length;
      if (avgHintLength > 10) {
        nameConfidence = Math.min(1.0, nameConfidence + 0.2);
      }
    }

    // Overall confidence is the average
    const overallConfidence = (typeConfidence + nameConfidence) / 2;

    return {
      type: typeConfidence,
      name: nameConfidence,
      overall: overallConfidence
    };
  }

  /**
   * Determine if query requires a document to answer
   */
  private requiresDocument(
    documentType: string | undefined,
    specificReferences: QueryAnalysis['specificReferences'],
    documentNameHints: string[]
  ): boolean {
    // If we have specific references (cell, slide, page), definitely requires a document
    if (Object.keys(specificReferences).length > 0) {
      return true;
    }

    // If we detected a document type, likely requires a document
    if (documentType) {
      return true;
    }

    // If we have document name hints, requires a document
    if (documentNameHints.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Format parsed query for logging/debugging
   */
  formatAnalysis(analysis: QueryAnalysis): string {
    const lines: string[] = [];

    lines.push('Query Analysis:');
    lines.push(`  Document Type: ${analysis.documentType || 'unknown'} (confidence: ${(analysis.confidence.type * 100).toFixed(0)}%)`);
    lines.push(`  Name Hints: ${analysis.documentNameHints.length > 0 ? analysis.documentNameHints.join(', ') : 'none'} (confidence: ${(analysis.confidence.name * 100).toFixed(0)}%)`);
    lines.push(`  Action: ${analysis.action || 'none'}`);
    lines.push(`  Specific References:`);

    if (Object.keys(analysis.specificReferences).length > 0) {
      for (const [key, value] of Object.entries(analysis.specificReferences)) {
        lines.push(`    - ${key}: ${value}`);
      }
    } else {
      lines.push(`    - none`);
    }

    lines.push(`  Keywords: ${analysis.keywords.join(', ')}`);
    lines.push(`  Requires Document: ${analysis.requiresDocument ? 'yes' : 'no'}`);
    lines.push(`  Overall Confidence: ${(analysis.confidence.overall * 100).toFixed(0)}%`);

    return lines.join('\n');
  }
}

export default new IntelligentQueryParserService();
