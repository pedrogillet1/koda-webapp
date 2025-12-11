/**
 * Document Resolution Service
 *
 * Resolves document names from queries to actual document IDs.
 * Handles patterns like:
 * - "no arquivo Trabalho projeto .pdf"
 * - "in the document called Budget Report"
 * - "em Relatorio.xlsx"
 */

import prisma from '../config/database';
import type { DocumentResolutionResult, ResolvedDocument } from '../types/ragV2.types';

class DocumentResolutionService {
  /**
   * Resolve document references in a query to actual document IDs
   */
  async resolveDocuments(
    userId: string,
    query: string,
    scope: 'single_document' | 'multiple_documents'
  ): Promise<DocumentResolutionResult> {
    // Extract document names from query
    const names = this.extractDocumentNames(query);

    if (names.length === 0) {
      return { resolvedDocs: [], extractedNames: [] };
    }

    console.log(`[DocumentResolution] Extracted names: ${names.join(', ')}`);

    // Search for documents
    const resolvedDocs: ResolvedDocument[] = [];

    for (const name of names) {
      const normalized = this.normalizeDocumentName(name);
      console.log(`[DocumentResolution] Searching for: "${normalized}"`);

      // Try exact match first
      let doc = await prisma.document.findFirst({
        where: {
          userId,
          filename: {
            contains: normalized,
            mode: 'insensitive',
          },
          status: 'completed',
        },
        select: {
          id: true,
          filename: true,
        },
      });

      // If no exact match, try fuzzy search
      if (!doc) {
        doc = await this.fuzzySearch(userId, normalized);
      }

      if (doc) {
        resolvedDocs.push({
          id: doc.id,
          title: doc.filename,
          confidence: this.calculateConfidence(normalized, doc.filename),
        });
        console.log(`[DocumentResolution] Resolved "${name}" -> ${doc.filename} (${doc.id})`);
      } else {
        console.log(`[DocumentResolution] Could not resolve "${name}"`);
      }
    }

    return { resolvedDocs, extractedNames: names };
  }

  /**
   * Extract document names from query using multiple patterns
   */
  private extractDocumentNames(query: string): string[] {
    const names: string[] = [];

    // Pattern 1: Portuguese - "no arquivo X" / "no documento X"
    const pattern1 = /(?:no|do|ao)\s+(?:arquivo|documento)\s+(?:chamado\s+)?[""]?([^""]+?)[""]?(?:\s*[?.,]|$)/gi;
    let match;
    while ((match = pattern1.exec(query)) !== null) {
      names.push(match[1].trim());
    }

    // Pattern 2: English - "in the file X" / "in the document X"
    const pattern2 = /in\s+(?:the\s+)?(?:file|document)\s+(?:called\s+)?[""]?([^""]+?)[""]?(?:\s*[?.,]|$)/gi;
    while ((match = pattern2.exec(query)) !== null) {
      names.push(match[1].trim());
    }

    // Pattern 3: File extension pattern - "em X.pdf" / "X.docx"
    const pattern3 = /(?:em\s+)?[""]?([^""\s]+\.(?:pdf|docx|xlsx|pptx|txt|csv))[""]?/gi;
    while ((match = pattern3.exec(query)) !== null) {
      if (!names.includes(match[1].trim())) {
        names.push(match[1].trim());
      }
    }

    // Pattern 4: Spanish - "en el archivo X" / "en el documento X"
    const pattern4 = /en\s+el\s+(?:archivo|documento)\s+(?:llamado\s+)?[""]?([^""]+?)[""]?(?:\s*[?.,]|$)/gi;
    while ((match = pattern4.exec(query)) !== null) {
      names.push(match[1].trim());
    }

    // Pattern 5: Quoted names - "arquivo 'Nome do Documento'"
    const pattern5 = /["'"]([^"'"]+)["'"]/g;
    while ((match = pattern5.exec(query)) !== null) {
      const extracted = match[1].trim();
      // Only add if it looks like a document name (has extension or is reasonably long)
      if (extracted.includes('.') || extracted.length > 5) {
        if (!names.includes(extracted)) {
          names.push(extracted);
        }
      }
    }

    return names;
  }

  /**
   * Normalize document name for matching
   */
  private normalizeDocumentName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\.(pdf|docx|xlsx|pptx|txt|csv)$/i, '');
  }

  /**
   * Fuzzy search for document by name parts
   */
  private async fuzzySearch(
    userId: string,
    normalizedName: string
  ): Promise<{ id: string; filename: string } | null> {
    // Split name into words for partial matching
    const words = normalizedName.split(' ').filter(w => w.length > 2);

    if (words.length === 0) {
      return null;
    }

    // Try matching any of the significant words
    const docs = await prisma.document.findMany({
      where: {
        userId,
        status: 'completed',
        OR: words.map(word => ({
          filename: {
            contains: word,
            mode: 'insensitive' as const,
          },
        })),
      },
      select: {
        id: true,
        filename: true,
      },
      take: 5,
    });

    if (docs.length === 0) {
      return null;
    }

    // Score each document by how many words match
    const scored = docs.map(doc => {
      const docNameLower = doc.filename.toLowerCase();
      const matchCount = words.filter(word => docNameLower.includes(word)).length;
      return { ...doc, score: matchCount / words.length };
    });

    // Return best match if score is good enough
    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score >= 0.5) {
      return { id: scored[0].id, filename: scored[0].filename };
    }

    return null;
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(searchTerm: string, filename: string): number {
    const normalizedSearch = searchTerm.toLowerCase();
    const normalizedFilename = filename.toLowerCase().replace(/\.[^.]+$/, '');

    // Exact match
    if (normalizedFilename === normalizedSearch) {
      return 1.0;
    }

    // Contains full search term
    if (normalizedFilename.includes(normalizedSearch)) {
      return 0.9;
    }

    // Partial word match
    const searchWords = normalizedSearch.split(' ');
    const matchedWords = searchWords.filter(word => normalizedFilename.includes(word));
    return 0.5 + (matchedWords.length / searchWords.length) * 0.4;
  }

  /**
   * Get document by ID (helper method)
   */
  async getDocumentById(
    userId: string,
    documentId: string
  ): Promise<{ id: string; filename: string } | null> {
    const doc = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        status: 'completed',
      },
      select: {
        id: true,
        filename: true,
      },
    });

    return doc;
  }
}

export const documentResolutionService = new DocumentResolutionService();
export default documentResolutionService;
