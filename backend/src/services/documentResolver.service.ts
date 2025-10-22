/**
 * Document Resolver Service
 * Resolves natural language document references to actual documents
 */

import semanticIndexService from './semanticDocumentIndex.service';
import queryParserService from './intelligentQueryParser.service';

interface DocumentMatch {
  documentId: string;
  filename: string;
  mimeType: string;
  confidence: number;
  matchReason: string[];
  metadata?: any;
}

interface ResolutionResult {
  success: boolean;
  documents: DocumentMatch[];
  analysis: any; // QueryAnalysis from parser
  error?: string;
}

class DocumentResolverService {
  /**
   * Resolve a natural language query to specific documents
   */
  async resolveDocument(userId: string, query: string): Promise<ResolutionResult> {
    try {
      console.log(`🔍 Resolving document query: "${query}"`);

      // Step 1: Parse the query
      const analysis = queryParserService.parseQuery(query);
      console.log(queryParserService.formatAnalysis(analysis));

      // If query doesn't require a document, return early
      if (!analysis.requiresDocument) {
        return {
          success: false,
          documents: [],
          analysis,
          error: 'Query does not reference a specific document'
        };
      }

      // Step 2: Build semantic index for user's documents
      const semanticIndex = await semanticIndexService.buildSemanticIndex(userId);

      // Step 3: Find matching documents
      const matches: DocumentMatch[] = [];

      // Strategy 1: Filter by document type if detected
      let candidateDocuments = semanticIndex.documents;
      if (analysis.documentType && semanticIndex.typeIndex[analysis.documentType]) {
        candidateDocuments = semanticIndex.typeIndex[analysis.documentType];
        console.log(`📊 Filtered to ${candidateDocuments.length} ${analysis.documentType} documents`);
      }

      // Strategy 2: Match by name hints
      if (analysis.documentNameHints.length > 0) {
        for (const doc of candidateDocuments) {
          const matchReasons: string[] = [];
          let score = 0;

          for (const hint of analysis.documentNameHints) {
            const hintLower = hint.toLowerCase();
            const filenameLower = doc.filename.toLowerCase();

            // Exact match
            if (filenameLower.includes(hintLower)) {
              score += 1.0;
              matchReasons.push(`Filename contains "${hint}"`);
            }

            // Fuzzy match - check individual words
            const hintWords = hintLower.split(/[\s_-]+/);
            const filenameWords = filenameLower.split(/[\s_-]+/);
            const matchingWords = hintWords.filter(word =>
              filenameWords.some((fw: string) => fw.includes(word) || word.includes(fw))
            );

            if (matchingWords.length > 0) {
              const fuzzyScore = matchingWords.length / hintWords.length;
              score += fuzzyScore * 0.5;
              matchReasons.push(`Fuzzy match: ${matchingWords.length}/${hintWords.length} words`);
            }

            // Check keywords from semantic index
            if (semanticIndex.keywordIndex[hintLower]) {
              const keywordMatches = semanticIndex.keywordIndex[hintLower];
              if (keywordMatches.some(d => d.id === doc.id)) {
                score += 0.5;
                matchReasons.push(`Keyword match: "${hint}"`);
              }
            }
          }

          if (score > 0) {
            matches.push({
              documentId: doc.id,
              filename: doc.filename,
              mimeType: doc.mimeType,
              confidence: Math.min(score, 1.0),
              matchReason: matchReasons,
              metadata: doc.metadata
            });
          }
        }
      }

      // Strategy 3: If we have specific references but no name hints, use type matching
      if (matches.length === 0 && Object.keys(analysis.specificReferences).length > 0) {
        console.log(`🎯 Using type-based matching with specific references`);

        for (const doc of candidateDocuments) {
          const matchReasons: string[] = [];

          // For Excel documents with cell/row/column references
          if (analysis.documentType === 'excel' &&
              (analysis.specificReferences.cell || analysis.specificReferences.row || analysis.specificReferences.column)) {
            matchReasons.push(`Has Excel-specific references`);
            matches.push({
              documentId: doc.id,
              filename: doc.filename,
              mimeType: doc.mimeType,
              confidence: 0.6,
              matchReason: matchReasons,
              metadata: doc.metadata
            });
          }

          // For PowerPoint documents with slide references
          if (analysis.documentType === 'powerpoint' && analysis.specificReferences.slide) {
            matchReasons.push(`Has slide reference: ${analysis.specificReferences.slide}`);
            matches.push({
              documentId: doc.id,
              filename: doc.filename,
              mimeType: doc.mimeType,
              confidence: 0.6,
              matchReason: matchReasons,
              metadata: doc.metadata
            });
          }

          // For PDF/Word documents with page references
          if ((analysis.documentType === 'pdf' || analysis.documentType === 'word') &&
              analysis.specificReferences.page) {
            matchReasons.push(`Has page reference: ${analysis.specificReferences.page}`);
            matches.push({
              documentId: doc.id,
              filename: doc.filename,
              mimeType: doc.mimeType,
              confidence: 0.6,
              matchReason: matchReasons,
              metadata: doc.metadata
            });
          }
        }
      }

      // Strategy 4: If still no matches, use keyword matching
      if (matches.length === 0 && analysis.keywords.length > 0) {
        console.log(`📝 Using keyword-based matching`);

        for (const keyword of analysis.keywords) {
          if (semanticIndex.keywordIndex[keyword]) {
            const keywordMatches = semanticIndex.keywordIndex[keyword];

            for (const doc of keywordMatches) {
              // Check if already in matches
              const existingMatch = matches.find(m => m.documentId === doc.id);

              if (existingMatch) {
                existingMatch.confidence += 0.1;
                existingMatch.matchReason.push(`Keyword: "${keyword}"`);
              } else {
                matches.push({
                  documentId: doc.id,
                  filename: doc.filename,
                  mimeType: doc.mimeType,
                  confidence: 0.3,
                  matchReason: [`Keyword: "${keyword}"`],
                  metadata: doc.metadata
                });
              }
            }
          }
        }
      }

      // Strategy 5: Recency boost - if only one document of type exists, boost it
      if (matches.length === 0 && analysis.documentType && candidateDocuments.length === 1) {
        console.log(`📅 Single document of type found, using recency boost`);
        const doc = candidateDocuments[0];
        matches.push({
          documentId: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          confidence: 0.5,
          matchReason: [`Only ${analysis.documentType} document`],
          metadata: doc.metadata
        });
      }

      // Sort by confidence descending
      matches.sort((a, b) => b.confidence - a.confidence);

      // Log results
      console.log(`✅ Found ${matches.length} matching documents:`);
      matches.forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.filename} (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
        match.matchReason.forEach(reason => console.log(`     - ${reason}`));
      });

      return {
        success: matches.length > 0,
        documents: matches,
        analysis,
        error: matches.length === 0 ? 'No matching documents found' : undefined
      };
    } catch (error) {
      console.error('❌ Error resolving document:', error);
      return {
        success: false,
        documents: [],
        analysis: queryParserService.parseQuery(query),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the best matching document (highest confidence)
   */
  async resolveSingleDocument(userId: string, query: string): Promise<DocumentMatch | null> {
    const result = await this.resolveDocument(userId, query);

    if (result.success && result.documents.length > 0) {
      return result.documents[0]; // Return highest confidence match
    }

    return null;
  }

  /**
   * Resolve document with a minimum confidence threshold
   */
  async resolveDocumentWithThreshold(
    userId: string,
    query: string,
    minConfidence: number = 0.5
  ): Promise<ResolutionResult> {
    const result = await this.resolveDocument(userId, query);

    // Filter documents by confidence threshold
    const filteredDocuments = result.documents.filter(doc => doc.confidence >= minConfidence);

    return {
      ...result,
      documents: filteredDocuments,
      success: filteredDocuments.length > 0,
      error: filteredDocuments.length === 0
        ? `No documents found with confidence >= ${(minConfidence * 100).toFixed(0)}%`
        : result.error
    };
  }

  /**
   * Format resolution result for user display
   */
  formatResolutionResult(result: ResolutionResult): string {
    if (!result.success) {
      return `❌ ${result.error || 'Could not resolve document'}`;
    }

    const lines: string[] = [];
    lines.push(`✅ Found ${result.documents.length} matching document(s):`);

    result.documents.forEach((doc, i) => {
      lines.push(`\n${i + 1}. **${doc.filename}**`);
      lines.push(`   Confidence: ${(doc.confidence * 100).toFixed(0)}%`);
      lines.push(`   Match reasons:`);
      doc.matchReason.forEach(reason => {
        lines.push(`   - ${reason}`);
      });
    });

    return lines.join('\n');
  }
}

export default new DocumentResolverService();
