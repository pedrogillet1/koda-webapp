/**
 * Anti-Hallucination Response Validator
 * Validates AI responses against actual source documents
 * Prevents referencing non-existent documents or making up information
 */

import prisma from '../config/database';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedResponse?: string;
}

interface DocumentReference {
  mentionedName: string;
  context: string;
  position: number;
}

export class ResponseValidator {

  /**
   * Main validation method: checks if AI response contains hallucinated document references
   */
  async validateResponse(
    response: string,
    userId: string,
    actualSourceDocs: Array<{ documentId: string; documentName: string }>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract all document references from the response
    const mentionedDocs = this.extractDocumentReferences(response);

    if (mentionedDocs.length === 0) {
      // No document references in response - this is fine
      return { isValid: true, errors, warnings };
    }

    console.log(`\n🔍 ANTI-HALLUCINATION CHECK:`);
    console.log(`   Found ${mentionedDocs.length} document references in response`);
    console.log(`   Actual source documents: ${actualSourceDocs.length}`);

    // Get all user's documents for validation
    const userDocuments = await prisma.document.findMany({
      where: { userId },
      select: { id: true, filename: true }
    });

    const actualSourceNames = actualSourceDocs.map(d => d.documentName.toLowerCase());
    const allUserDocNames = userDocuments.map(d => d.filename.toLowerCase());

    // Check each mentioned document
    for (const mention of mentionedDocs) {
      const mentionedLower = mention.mentionedName.toLowerCase();

      // Check if mentioned document was actually in the sources
      const inSources = actualSourceNames.some(name =>
        this.documentsMatch(name, mentionedLower)
      );

      if (!inSources) {
        // Document mentioned but not in sources - potential hallucination

        // Check if it exists in user's documents at all
        const existsInUserDocs = allUserDocNames.some(name =>
          this.documentsMatch(name, mentionedLower)
        );

        if (existsInUserDocs) {
          warnings.push(
            `Response mentions "${mention.mentionedName}" but this document was not in the retrieved sources. ` +
            `The information may be from a different search or cached knowledge.`
          );
          console.log(`   ⚠️  WARNING: Mentioned "${mention.mentionedName}" not in sources (but exists in user docs)`);
        } else {
          // Document doesn't exist at all - HALLUCINATION
          errors.push(
            `Response mentions "${mention.mentionedName}" which does not exist in your documents. ` +
            `This appears to be fabricated information.`
          );
          console.log(`   ❌ ERROR: Hallucinated document "${mention.mentionedName}"`);
        }
      } else {
        console.log(`   ✅ Verified: "${mention.mentionedName}" is in sources`);
      }
    }

    // If we found hallucinated documents, create corrected response
    let correctedResponse: string | undefined;
    if (errors.length > 0) {
      correctedResponse = this.createSafeResponse(response, actualSourceDocs);
    }

    const isValid = errors.length === 0;

    if (isValid) {
      console.log(`   ✅ Response validation PASSED`);
    } else {
      console.log(`   ❌ Response validation FAILED: ${errors.length} errors`);
    }

    return {
      isValid,
      errors,
      warnings,
      correctedResponse
    };
  }

  /**
   * Extract document names/references from AI response text
   */
  private extractDocumentReferences(response: string): DocumentReference[] {
    const references: DocumentReference[] = [];

    // Common patterns for document references in responses
    const patterns = [
      // "According to [Document Name]"
      /according\s+to\s+(?:the\s+)?([A-Za-z0-9\s\-_\.]+?)(?:\.|,|:|\s+shows|\s+indicates)/gi,

      // "In [Document Name]"
      /in\s+(?:the\s+)?([A-Za-z0-9\s\-_\.]+?)(?:\.|,|:|\s+it|\s+there)/gi,

      // "The [Document Name] shows"
      /the\s+([A-Za-z0-9\s\-_\.]+?)\s+(?:shows|indicates|states|mentions|contains)/gi,

      // "[Document Name] shows/states/indicates"
      /^([A-Za-z0-9\s\-_\.]+?)\s+(?:shows|indicates|states|mentions|contains)/gim,

      // "From [Document Name]"
      /from\s+(?:the\s+)?([A-Za-z0-9\s\-_\.]+?)(?:\.|,|:|\s+we)/gi,

      // "Based on [Document Name]"
      /based\s+on\s+(?:the\s+)?([A-Za-z0-9\s\-_\.]+?)(?:\.|,|:)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const mentionedName = match[1].trim();

        // Filter out common false positives
        if (this.isLikelyDocumentName(mentionedName)) {
          references.push({
            mentionedName,
            context: match[0],
            position: match.index
          });
        }
      }
    }

    // Deduplicate by document name
    const unique = Array.from(
      new Map(references.map(ref => [ref.mentionedName.toLowerCase(), ref])).values()
    );

    return unique;
  }

  /**
   * Check if extracted text is likely a document name (not just generic words)
   */
  private isLikelyDocumentName(text: string): boolean {
    // Filter out common false positives
    const blacklist = [
      'fact', 'information', 'data', 'document', 'file', 'report', 'analysis',
      'example', 'case', 'study', 'text', 'paragraph', 'section', 'context',
      'above', 'below', 'following', 'previous', 'next', 'first', 'second',
      'provided', 'given', 'shown', 'mentioned', 'described'
    ];

    const lowerText = text.toLowerCase().trim();

    // Too short or too long
    if (lowerText.length < 3 || lowerText.length > 100) {
      return false;
    }

    // Check if it's just a blacklisted word
    if (blacklist.includes(lowerText)) {
      return false;
    }

    // Check if it looks like a filename (has extension) or document-like name
    const hasExtension = /\.(pdf|docx?|txt|xlsx?|pptx?|csv|png|jpe?g)$/i.test(lowerText);
    const hasCapitalization = /[A-Z]/.test(text);
    const hasNumbers = /\d/.test(text);
    const hasMultipleWords = text.split(/\s+/).length >= 2;

    // Consider it a likely document name if it has any of these characteristics
    return hasExtension || hasCapitalization || hasNumbers || hasMultipleWords;
  }

  /**
   * Check if two document names match (fuzzy matching)
   */
  private documentsMatch(name1: string, name2: string): boolean {
    const clean1 = this.cleanDocumentName(name1);
    const clean2 = this.cleanDocumentName(name2);

    // Exact match
    if (clean1 === clean2) {
      return true;
    }

    // One contains the other (for partial matches like "Revenue Report" vs "Revenue Report 2023.pdf")
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      return true;
    }

    // Remove file extensions and try again
    const withoutExt1 = clean1.replace(/\.(pdf|docx?|txt|xlsx?|pptx?|csv|png|jpe?g)$/i, '');
    const withoutExt2 = clean2.replace(/\.(pdf|docx?|txt|xlsx?|pptx?|csv|png|jpe?g)$/i, '');

    if (withoutExt1 === withoutExt2) {
      return true;
    }

    return false;
  }

  /**
   * Clean document name for comparison
   */
  private cleanDocumentName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/[_\-]+/g, ' ');  // Convert underscores/dashes to spaces
  }

  /**
   * Create a safe response when hallucination is detected
   */
  private createSafeResponse(
    originalResponse: string,
    actualSourceDocs: Array<{ documentId: string; documentName: string }>
  ): string {
    const sourceNames = actualSourceDocs.map(d => d.documentName).join(', ');

    return `I found information in the following documents: ${sourceNames}. ` +
           `However, I cannot provide specific details as the information may not be accurate. ` +
           `Please let me know if you'd like me to search again or if you have a more specific question.`;
  }

  /**
   * Quick check if response mentions specific document by name
   */
  hasDocumentMentions(response: string): boolean {
    const mentions = this.extractDocumentReferences(response);
    return mentions.length > 0;
  }
}

export default new ResponseValidator();
