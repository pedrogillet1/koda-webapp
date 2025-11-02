/**
 * Document-Scoped Retrieval Service
 *
 * Detects when queries mention specific document names and forces
 * retrieval from those documents.
 *
 * Examples:
 * - "Compare Comprovante1 and ranch budget" → Detects both documents
 * - "What does the Koda blueprint say about security?" → Detects blueprint
 */

export class DocumentScopedRetrievalService {

  /**
   * Detect if query mentions specific document names
   * Returns array of detected filenames
   */
  detectMentionedDocuments(query: string, userDocuments: string[]): string[] {
    const queryLower = query.toLowerCase();
    const mentionedDocs: string[] = [];

    console.log(`\n🔍 DETECTING MENTIONED DOCUMENTS...`);
    console.log(`   Query: "${query}"`);
    console.log(`   User has ${userDocuments.length} documents`);

    for (const docName of userDocuments) {
      // Method 1: Exact filename match
      if (queryLower.includes(docName.toLowerCase())) {
        console.log(`   ✅ Exact match: "${docName}"`);
        mentionedDocs.push(docName);
        continue;
      }

      // Method 2: Filename without extension
      const nameWithoutExt = docName.replace(/\.[^.]+$/, '');
      if (queryLower.includes(nameWithoutExt.toLowerCase())) {
        console.log(`   ✅ Match without extension: "${docName}"`);
        mentionedDocs.push(docName);
        continue;
      }

      // Method 3: Partial matches for compound names
      // e.g., "Comprovante1" matches "Comprovante1.pdf"
      // e.g., "ranch budget" matches "Lone Mountain Ranch P&L 2025 (Budget).xlsx"
      const words = nameWithoutExt.split(/[\s_\-()]+/).filter(w => w.length > 2);

      for (const word of words) {
        if (word.length > 3 && queryLower.includes(word.toLowerCase())) {
          // Check if multiple words match for compound names
          const matchingWords = words.filter(w =>
            w.length > 3 && queryLower.includes(w.toLowerCase())
          );

          // Require at least 2 matching words for compound names, or 1 for unique names
          if (matchingWords.length >= 2 || word.length > 6) {
            console.log(`   ✅ Partial match: "${docName}" (matched: ${matchingWords.join(', ')})`);
            mentionedDocs.push(docName);
            break;
          }
        }
      }
    }

    // Special handling for common references
    const specialReferences: Record<string, RegExp[]> = {
      'comprovante': [/comprovante\s*1?/i],
      'ranch budget': [/ranch.*budget/i, /budget.*ranch/i, /lone.*mountain/i],
      'koda blueprint': [/koda.*blueprint/i, /blueprint/i],
      'koda presentation': [/koda.*presentation/i, /presentation.*koda/i],
      'passport': [/passport/i, /passaporte/i],
    };

    for (const [reference, patterns] of Object.entries(specialReferences)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          // Find matching document
          const matchingDoc = userDocuments.find(doc =>
            doc.toLowerCase().includes(reference) ||
            doc.toLowerCase().includes(reference.replace(' ', ''))
          );

          if (matchingDoc && !mentionedDocs.includes(matchingDoc)) {
            console.log(`   ✅ Special reference match: "${matchingDoc}" (pattern: ${pattern})`);
            mentionedDocs.push(matchingDoc);
          }
        }
      }
    }

    console.log(`   📋 Total mentioned documents: ${mentionedDocs.length}`);
    if (mentionedDocs.length > 0) {
      console.log(`   Documents: ${mentionedDocs.join(', ')}`);
    }

    return mentionedDocs;
  }

  /**
   * Detect if query is document-scoped (asks about a specific document)
   */
  isDocumentScopedQuery(query: string): boolean {
    const scopedPatterns = [
      /in (the|this|my) (document|file)/i,
      /what (does|is) (the|this) .* (document|file|pdf|spreadsheet)/i,
      /according to (the|this)/i,
      /from (the|this) (document|file)/i,
      /in (?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:document|file|pdf)/i,
    ];

    return scopedPatterns.some(pattern => pattern.test(query));
  }
}

export default new DocumentScopedRetrievalService();
