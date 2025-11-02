/**
 * Query Intent Detector Service
 *
 * SIMPLE: Detects if user wants a list or summary
 * NO COMPLEX LOGIC - just pattern matching
 */

export enum QueryIntent {
  LIST = 'list',           // User wants list of documents
  SUMMARY = 'summary',     // User wants content summary
  FACTUAL = 'factual',     // User wants specific fact
  COMPARISON = 'comparison', // User wants comparison
  FILE_TYPES = 'file_types', // User wants to know file types/formats
}

export class QueryIntentDetectorService {

  /**
   * Detect if user wants a list or summary
   */
  detectIntent(query: string): QueryIntent {
    const queryLower = query.toLowerCase().trim();

    // File types patterns - user wants to know file formats/types (CHECK FIRST!)
    const fileTypePatterns = [
      /what (types?|kinds?|formats?) of (files?|documents?)/i,
      /what file (types?|formats?|extensions?)/i,
      /list (all )?(file )?types/i,
      /show me (all )?(file )?types/i,
      /what (files?|documents?) types/i,
    ];

    for (const pattern of fileTypePatterns) {
      if (pattern.test(query)) {
        console.log(`   📁 Intent: FILE_TYPES (pattern matched: ${pattern})`);
        return QueryIntent.FILE_TYPES;
      }
    }

    // List patterns - user wants filenames
    const listPatterns = [
      /^(show me|list|display|give me)\s+(all|the)?\s*(documents?|files?)/i,
      /^which (documents?|files?)/i,
      /^what (documents?|files?) (do i have|are|contain)/i,
      /^find (all|the)?\s*(documents?|files?)/i,
      /documents?\s+(about|related to|regarding|concerning)/i, // "documents about X", "documents related to X"
      /all.*documents?.*mention/i, // "all documents that mention X"
    ];

    for (const pattern of listPatterns) {
      if (pattern.test(query)) {
        console.log(`   📋 Intent: LIST (pattern matched: ${pattern})`);
        return QueryIntent.LIST;
      }
    }

    // Factual patterns - user wants specific information
    const factualPatterns = [
      /^what is (the|my)? ?(expiration date|date|amount|value|price)/i,
      /^when (does|did|is|was)/i,
      /^how much/i,
      /^who (is|was)/i,
      /^where (is|was)/i,
    ];

    for (const pattern of factualPatterns) {
      if (pattern.test(query)) {
        console.log(`   🎯 Intent: FACTUAL (pattern matched: ${pattern})`);
        return QueryIntent.FACTUAL;
      }
    }

    // Comparison patterns
    if (/compare|difference|versus|vs\.?/i.test(query)) {
      console.log(`   🔄 Intent: COMPARISON`);
      return QueryIntent.COMPARISON;
    }

    // Default to summary
    console.log(`   📝 Intent: SUMMARY (default)`);
    return QueryIntent.SUMMARY;
  }

  /**
   * Check if query is about document metadata (not content)
   */
  isMetadataQuery(query: string): boolean {
    const metadataPatterns = [
      /which (documents?|files?)/i,
      /what (documents?|files?)/i,
      /show me.*documents?/i,
      /list.*documents?/i,
    ];

    const isMetadata = metadataPatterns.some(pattern => pattern.test(query));
    if (isMetadata) {
      console.log(`   ✅ Metadata query detected`);
    }
    return isMetadata;
  }
}

export default new QueryIntentDetectorService();
