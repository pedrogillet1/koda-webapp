/**
 * Source Tracker Service
 * Tracks and formats source references for Issue #1 (Document Reference & Source Extraction)
 * Ensures every AI response includes proper source citations
 */

import { SourceReference, EnhancedChunkMetadata, ScoredChunk } from '../types/rag.types';
import { formatLocation, getDocumentHierarchy, generateAccessURLs, deduplicateSources } from '../utils/rag.utils';

class SourceTrackerService {
  /**
   * Extract source references from chunks
   */
  async extractSources(chunks: any[]): Promise<SourceReference[]> {
    console.log(`\n📚 [Source Tracker] Extracting sources from ${chunks.length} chunks...`);

    const sources: SourceReference[] = [];

    for (const chunk of chunks) {
      const metadata: Partial<EnhancedChunkMetadata> = chunk.metadata || chunk;
      const content = chunk.content || chunk.text_content || '';
      const relevanceScore = chunk.relevanceScore || chunk.similarity || undefined;
      const relevanceExplanation = chunk.relevanceExplanation || undefined;

      if (!metadata.documentId) {
        console.log(`   ⚠️ Skipping chunk without documentId`);
        continue;
      }

      // Get full hierarchy if not in metadata
      let categoryName = metadata.categoryName;
      let folderPath = metadata.folderPath;

      if (!categoryName || !folderPath) {
        try {
          const hierarchy = await getDocumentHierarchy(metadata.documentId);
          categoryName = categoryName || hierarchy.categoryName || undefined;
          folderPath = folderPath || hierarchy.folderPath;
        } catch (error) {
          console.log(`   ⚠️ Could not fetch hierarchy for document ${metadata.documentId}`);
        }
      }

      // Format location
      const location = formatLocation(metadata);

      // Generate access URLs
      const urls = generateAccessURLs(
        metadata.documentId,
        metadata.filename || 'Unknown',
        metadata.pageNumber,
        metadata.slideNumber
      );

      const source: SourceReference = {
        documentId: metadata.documentId,
        filename: metadata.filename || 'Unknown Document',
        location: location,
        pageNumber: metadata.pageNumber,
        slideNumber: metadata.slideNumber,
        sheetName: metadata.sheetName,
        cellReference: metadata.cellReference,
        categoryName: categoryName,
        categoryEmoji: metadata.categoryEmoji,
        folderPath: folderPath,
        viewUrl: urls.viewUrl,
        downloadUrl: urls.downloadUrl,
        chunkContent: content, // Store FULL chunk content for exact quote extraction (Task #7)
        relevanceScore: relevanceScore,
        relevanceExplanation: relevanceExplanation
      };

      sources.push(source);
    }

    console.log(`   ✅ Extracted ${sources.length} sources`);

    return sources;
  }

  /**
   * Format sources for inline citations
   * Returns an array of inline citation strings
   */
  formatInlineCitations(sources: SourceReference[]): string[] {
    return sources.map(source => {
      return `[Source: ${source.filename}, ${source.location}]`;
    });
  }

  /**
   * Format sources section for end of response
   */
  formatSourcesSection(sources: SourceReference[]): string {
    if (sources.length === 0) {
      return '';
    }

    // Deduplicate sources by documentId + location
    const uniqueSources = deduplicateSources(sources);

    let section = '\n\n**Sources:**\n\n';

    uniqueSources.forEach((source, index) => {
      section += `[${index + 1}] **${source.filename}**\n`;
      section += `    - Location: ${source.location}\n`;

      if (source.folderPath) {
        section += `    - Path: ${source.folderPath}\n`;
      }

      if (source.categoryName) {
        const emoji = source.categoryEmoji || '📁';
        section += `    - Category: ${emoji} ${source.categoryName}\n`;
      }

      if (source.relevanceScore !== undefined) {
        const scorePercent = source.relevanceScore.toFixed(0);
        section += `    - Relevance: ${scorePercent}%`;

        if (source.relevanceExplanation) {
          section += ` (${source.relevanceExplanation})`;
        }

        section += '\n';
      }

      section += '\n';
    });

    return section;
  }

  /**
   * Create source reference map for easy lookup
   * Returns a map of documentId -> SourceReference
   */
  createSourceMap(sources: SourceReference[]): Map<string, SourceReference[]> {
    const map = new Map<string, SourceReference[]>();

    for (const source of sources) {
      const existing = map.get(source.documentId) || [];
      existing.push(source);
      map.set(source.documentId, existing);
    }

    return map;
  }

  /**
   * Get sources for a specific document
   */
  getSourcesByDocument(sources: SourceReference[], documentId: string): SourceReference[] {
    return sources.filter(s => s.documentId === documentId);
  }

  /**
   * Group sources by document
   */
  groupSourcesByDocument(sources: SourceReference[]): Array<{
    documentId: string;
    filename: string;
    sources: SourceReference[];
  }> {
    const map = this.createSourceMap(sources);
    const grouped: Array<{
      documentId: string;
      filename: string;
      sources: SourceReference[];
    }> = [];

    for (const [documentId, docSources] of map.entries()) {
      grouped.push({
        documentId: documentId,
        filename: docSources[0].filename,
        sources: docSources
      });
    }

    return grouped;
  }

  /**
   * Validate that sources are properly formatted
   */
  validateSources(sources: SourceReference[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];

      // Required fields
      if (!source.documentId) {
        errors.push(`Source ${i + 1}: Missing documentId`);
      }
      if (!source.filename) {
        errors.push(`Source ${i + 1}: Missing filename`);
      }
      if (!source.location) {
        errors.push(`Source ${i + 1}: Missing location`);
      }
      if (!source.viewUrl) {
        errors.push(`Source ${i + 1}: Missing viewUrl`);
      }

      // Recommended fields
      if (!source.folderPath) {
        warnings.push(`Source ${i + 1}: Missing folderPath`);
      }
      if (!source.categoryName) {
        warnings.push(`Source ${i + 1}: Missing categoryName`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  /**
   * Enrich sources with additional metadata
   * (Used when sources come from Pinecone and need full hierarchy)
   */
  async enrichSources(sources: SourceReference[]): Promise<SourceReference[]> {
    console.log(`\n🔍 [Source Tracker] Enriching ${sources.length} sources with hierarchy...`);

    const enriched: SourceReference[] = [];

    for (const source of sources) {
      try {
        // If missing category or folder info, fetch it
        if (!source.categoryName || !source.folderPath) {
          const hierarchy = await getDocumentHierarchy(source.documentId);

          enriched.push({
            ...source,
            categoryName: source.categoryName || hierarchy.categoryName || undefined,
            categoryEmoji: source.categoryEmoji || hierarchy.categoryEmoji || undefined,
            folderPath: source.folderPath || hierarchy.folderPath
          });
        } else {
          enriched.push(source);
        }
      } catch (error) {
        console.log(`   ⚠️ Could not enrich source for document ${source.documentId}`);
        enriched.push(source);
      }
    }

    console.log(`   ✅ Enriched ${enriched.length} sources`);

    return enriched;
  }

  /**
   * Format a single source reference
   */
  formatSingleSource(source: SourceReference, includeContent: boolean = false): string {
    let formatted = `**${source.filename}**\n`;
    formatted += `📍 ${source.location}\n`;

    if (source.folderPath) {
      formatted += `📂 ${source.folderPath}\n`;
    }

    if (source.categoryName) {
      const emoji = source.categoryEmoji || '📁';
      formatted += `${emoji} ${source.categoryName}\n`;
    }

    if (source.relevanceScore !== undefined) {
      formatted += `⭐ ${source.relevanceScore.toFixed(0)}% relevant\n`;
    }

    if (includeContent && source.chunkContent) {
      const preview = source.chunkContent.length > 200
        ? source.chunkContent.substring(0, 200) + '...'
        : source.chunkContent;
      formatted += `\n> ${preview}\n`;
    }

    return formatted;
  }

  /**
   * Generate citation numbers for inline references
   * Returns a map of documentId+location -> citation number
   */
  generateCitationNumbers(sources: SourceReference[]): Map<string, number> {
    const uniqueSources = deduplicateSources(sources);
    const map = new Map<string, number>();

    uniqueSources.forEach((source, index) => {
      const key = `${source.documentId}-${source.location}`;
      map.set(key, index + 1);
    });

    return map;
  }

  /**
   * Get citation number for a source
   */
  getCitationNumber(
    source: SourceReference,
    citationMap: Map<string, number>
  ): number | null {
    const key = `${source.documentId}-${source.location}`;
    return citationMap.get(key) || null;
  }

  /**
   * Format inline citation with number
   * Example: [1], [2], etc.
   */
  formatNumberedCitation(citationNumber: number): string {
    return `[${citationNumber}]`;
  }

  /**
   * Check if response has proper source citations
   */
  hasProperCitations(responseText: string): boolean {
    // Check for inline citations [Source: ...]
    const inlineCitationPattern = /\[Source: .+?, .+?\]/;
    const hasInlineCitations = inlineCitationPattern.test(responseText);

    // Check for sources section
    const hasSourcesSection = responseText.includes('**Sources:**');

    return hasInlineCitations || hasSourcesSection;
  }

  /**
   * Get statistics about sources
   */
  getSourceStats(sources: SourceReference[]): {
    totalSources: number;
    uniqueDocuments: number;
    averageRelevance: number;
    highRelevanceCount: number;
    documentsWithPaths: number;
  } {
    const uniqueDocs = new Set(sources.map(s => s.documentId));
    const relevanceScores = sources
      .map(s => s.relevanceScore)
      .filter(score => score !== undefined) as number[];

    const avgRelevance = relevanceScores.length > 0
      ? relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length
      : 0;

    const highRelevanceCount = relevanceScores.filter(score => score >= 80).length;
    const docsWithPaths = sources.filter(s => s.folderPath).length;

    return {
      totalSources: sources.length,
      uniqueDocuments: uniqueDocs.size,
      averageRelevance: avgRelevance,
      highRelevanceCount: highRelevanceCount,
      documentsWithPaths: docsWithPaths
    };
  }

  /**
   * Filter sources to only include documents actually mentioned in the response
   * This ensures we only cite documents that were actually used in reasoning
   *
   * Issue #3: Fix retrieval to only cite documents actually used in reasoning
   */
  filterSourcesByActualUsage(
    sources: SourceReference[],
    responseText: string,
    chunks: any[]
  ): SourceReference[] {
    console.log(`\n🔍 [Source Tracker] Filtering ${sources.length} sources by actual usage...`);

    if (sources.length === 0) {
      console.log(`   ⚠️ No sources to filter`);
      return [];
    }

    // Extract document IDs and filenames that appear in the response
    const mentionedDocuments = new Set<string>();
    const mentionedFilenames = new Set<string>();

    // Check for explicit document mentions
    for (const source of sources) {
      // Check if document filename is mentioned
      const filenamePattern = new RegExp(this.escapeRegex(source.filename), 'i');
      if (filenamePattern.test(responseText)) {
        mentionedDocuments.add(source.documentId);
        mentionedFilenames.add(source.filename);
      }

      // Check if location is mentioned
      if (source.location) {
        const locationPattern = new RegExp(this.escapeRegex(source.location), 'i');
        if (locationPattern.test(responseText)) {
          mentionedDocuments.add(source.documentId);
        }
      }

      // Check if chunk content appears in response
      if (source.chunkContent) {
        const contentSnippet = source.chunkContent.substring(0, 50).trim();
        if (contentSnippet.length > 10) {
          const snippetPattern = new RegExp(this.escapeRegex(contentSnippet), 'i');
          if (snippetPattern.test(responseText)) {
            mentionedDocuments.add(source.documentId);
          }
        }
      }
    }

    // If no explicit mentions found, use content-based heuristic
    // Check if the response contains information from the chunk content
    if (mentionedDocuments.size === 0) {
      console.log(`   💡 No explicit mentions found, using content-based filtering...`);

      for (const chunk of chunks) {
        const content = chunk.content || chunk.text_content || '';
        const metadata = chunk.metadata || chunk;

        if (!metadata.documentId || !content) continue;

        // Extract key phrases from chunk (5+ words)
        const keyPhrases = this.extractKeyPhrases(content);

        // Check if any key phrases appear in the response
        let matchCount = 0;
        for (const phrase of keyPhrases) {
          if (phrase.length > 15) {  // Only check substantial phrases
            const phrasePattern = new RegExp(this.escapeRegex(phrase), 'i');
            if (phrasePattern.test(responseText)) {
              matchCount++;
            }
          }
        }

        // If at least 2 key phrases match, consider this document used
        if (matchCount >= 2) {
          mentionedDocuments.add(metadata.documentId);
        }
      }
    }

    // Filter sources to only include mentioned documents
    const usedSources = sources.filter(s => mentionedDocuments.has(s.documentId));

    console.log(`   ✅ Filtered to ${usedSources.length} actually used sources (from ${mentionedDocuments.size} documents)`);

    if (mentionedFilenames.size > 0) {
      console.log(`   📄 Explicitly mentioned: ${Array.from(mentionedFilenames).join(', ')}`);
    }

    return usedSources;
  }

  /**
   * Extract key phrases from text (sentences or multi-word phrases)
   */
  private extractKeyPhrases(text: string): string[] {
    // Split by sentences
    const sentences = text.split(/[.!?]\s+/);

    const phrases: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 150) {
        phrases.push(trimmed);
      }

      // Also extract noun phrases (simple heuristic: sequences of 3-6 words)
      const words = trimmed.split(/\s+/);
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 5).join(' ');
        if (phrase.length > 15) {
          phrases.push(phrase);
        }
      }
    }

    return phrases.slice(0, 20); // Limit to top 20 phrases
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * TASK #7: Extract exact quotes from AI response that match source chunks
   * Returns sources enriched with the exact quotes used in the response
   */
  extractExactQuotes(
    sources: SourceReference[],
    aiResponse: string
  ): Array<SourceReference & { exactQuotes: string[] }> {
    console.log(`\n📝 [Source Tracker] Extracting exact quotes from response...`);

    const sourcesWithQuotes = sources.map(source => {
      const quotes: string[] = [];

      if (!source.chunkContent) {
        return { ...source, exactQuotes: quotes };
      }

      // Split chunk content into sentences
      const sentences = this.extractSentences(source.chunkContent);

      // Find sentences that appear in the AI response
      for (const sentence of sentences) {
        // Skip very short sentences (less than 20 chars)
        if (sentence.length < 20) continue;

        // Check if sentence appears in response (case-insensitive, fuzzy match)
        const sentencePattern = new RegExp(this.escapeRegex(sentence), 'i');
        if (sentencePattern.test(aiResponse)) {
          quotes.push(sentence);
        }

        // Also check for partial matches (phrases of 10+ words)
        const words = sentence.split(/\s+/);
        if (words.length >= 10) {
          for (let i = 0; i <= words.length - 10; i++) {
            const phrase = words.slice(i, i + 10).join(' ');
            const phrasePattern = new RegExp(this.escapeRegex(phrase), 'i');
            if (phrasePattern.test(aiResponse) && !quotes.includes(sentence)) {
              quotes.push(sentence);
              break;
            }
          }
        }
      }

      return { ...source, exactQuotes: quotes };
    });

    const totalQuotes = sourcesWithQuotes.reduce((sum, s) => sum + s.exactQuotes.length, 0);
    console.log(`   ✅ Extracted ${totalQuotes} exact quotes from ${sources.length} sources`);

    return sourcesWithQuotes;
  }

  /**
   * TASK #7: Format sources section with exact quotes and file references
   */
  formatSourcesSectionWithQuotes(
    sourcesWithQuotes: Array<SourceReference & { exactQuotes: string[] }>
  ): string {
    if (sourcesWithQuotes.length === 0) {
      return '';
    }

    // Deduplicate sources by documentId + location
    const uniqueSources = deduplicateSources(sourcesWithQuotes);

    let section = '\n\n**Sources & References:**\n\n';

    uniqueSources.forEach((source, index) => {
      section += `[${index + 1}] **${source.filename}**\n`;

      // File location with precise reference
      section += `    📍 **Location:** ${source.location}\n`;

      if (source.folderPath) {
        section += `    📂 **Path:** ${source.folderPath}\n`;
      }

      if (source.categoryName) {
        const emoji = source.categoryEmoji || '📁';
        section += `    ${emoji} **Category:** ${source.categoryName}\n`;
      }

      if (source.relevanceScore !== undefined) {
        const scorePercent = source.relevanceScore.toFixed(0);
        section += `    ⭐ **Relevance:** ${scorePercent}%`;

        if (source.relevanceExplanation) {
          section += ` (${source.relevanceExplanation})`;
        }

        section += '\n';
      }

      // Add exact quotes if available
      const sourceWithQuotes = sourcesWithQuotes.find(
        s => s.documentId === source.documentId && s.location === source.location
      );

      if (sourceWithQuotes && sourceWithQuotes.exactQuotes && sourceWithQuotes.exactQuotes.length > 0) {
        section += `    💬 **Exact Quotes:**\n`;
        sourceWithQuotes.exactQuotes.slice(0, 3).forEach((quote, qIndex) => {
          // Truncate very long quotes
          const truncatedQuote = quote.length > 150
            ? quote.substring(0, 150) + '...'
            : quote;
          section += `       ${qIndex + 1}. "${truncatedQuote}"\n`;
        });

        if (sourceWithQuotes.exactQuotes.length > 3) {
          section += `       ... and ${sourceWithQuotes.exactQuotes.length - 3} more quote(s)\n`;
        }
      }

      section += '\n';
    });

    return section;
  }

  /**
   * TASK #7: Extract sentences from text
   */
  private extractSentences(text: string): string[] {
    // Split by sentence-ending punctuation
    const sentences = text.split(/[.!?]+\s+/);

    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * TASK #7: Format inline citations with exact file references
   * Example: [1: Financial_Report.pdf, Page 5, Line 12]
   */
  formatInlineCitationWithReference(
    citationNumber: number,
    source: SourceReference,
    includeQuote: boolean = false
  ): string {
    let citation = `[${citationNumber}: ${source.filename}`;

    // Add precise location
    if (source.pageNumber !== undefined) {
      citation += `, Page ${source.pageNumber}`;
    } else if (source.slideNumber !== undefined) {
      citation += `, Slide ${source.slideNumber}`;
    } else if (source.sheetName) {
      citation += `, Sheet "${source.sheetName}"`;
      if (source.cellReference) {
        citation += `, Cell ${source.cellReference}`;
      }
    }

    citation += ']';

    // Optionally include a short quote preview
    if (includeQuote && source.chunkContent) {
      const preview = source.chunkContent.substring(0, 50).trim();
      citation += ` "${preview}..."`;
    }

    return citation;
  }

  /**
   * TASK #7: Build comprehensive source attribution report
   * Provides detailed traceability for audit purposes
   */
  buildSourceAttributionReport(
    sourcesWithQuotes: Array<SourceReference & { exactQuotes: string[] }>,
    aiResponse: string
  ): string {
    let report = '═══════════════════════════════════════════════════════\n';
    report += '               SOURCE ATTRIBUTION REPORT\n';
    report += '═══════════════════════════════════════════════════════\n\n';

    report += `📊 **Summary:**\n`;
    report += `   - Total Sources: ${sourcesWithQuotes.length}\n`;
    report += `   - Unique Documents: ${new Set(sourcesWithQuotes.map(s => s.documentId)).size}\n`;

    const totalQuotes = sourcesWithQuotes.reduce((sum, s) => sum + (s.exactQuotes?.length || 0), 0);
    report += `   - Exact Quotes Extracted: ${totalQuotes}\n`;
    report += `   - Response Length: ${aiResponse.length} characters\n\n`;

    report += `📄 **Detailed Source Breakdown:**\n\n`;

    sourcesWithQuotes.forEach((source, index) => {
      report += `[${index + 1}] ${source.filename}\n`;
      report += `    Document ID: ${source.documentId}\n`;
      report += `    Location: ${source.location}\n`;

      if (source.folderPath) {
        report += `    Full Path: ${source.folderPath}\n`;
      }

      if (source.relevanceScore !== undefined) {
        report += `    Relevance Score: ${source.relevanceScore.toFixed(2)}%\n`;
      }

      report += `    Chunk Length: ${source.chunkContent?.length || 0} characters\n`;

      if (source.exactQuotes && source.exactQuotes.length > 0) {
        report += `    Extracted Quotes (${source.exactQuotes.length}):\n`;
        source.exactQuotes.forEach((quote, qIdx) => {
          report += `       ${qIdx + 1}. "${quote}"\n`;
        });
      } else {
        report += `    No exact quotes extracted (semantic match only)\n`;
      }

      report += `\n`;
    });

    report += '═══════════════════════════════════════════════════════\n';

    return report;
  }
}

export default new SourceTrackerService();
