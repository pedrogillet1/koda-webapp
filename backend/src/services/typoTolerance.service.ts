/**
 * TYPO TOLERANCE SERVICE - KODA PHASE 4
 *
 * FEATURE IMPLEMENTED:
 * - Fuzzy matching for document names
 * - Levenshtein distance algorithm
 * - Auto-correction of typos in queries
 *
 * CAPABILITIES:
 * - Detect misspelled document names
 * - Suggest correct alternatives
 * - Auto-correct obvious typos
 * - Improve user experience
 */

import prisma from '../config/database';

export interface TypoCorrection {
  original: string;
  corrected: string;
  confidence: number;
  distance: number;
}

export interface CorrectionResult {
  correctedQuery: string;
  corrections: TypoCorrection[];
  hasCorrections: boolean;
}

class TypoToleranceService {
  /**
   * Calculate Levenshtein distance between two strings
   * (minimum number of single-character edits needed to change one word into another)
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize first column and row
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity percentage based on Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    return 1 - distance / maxLength;
  }

  /**
   * Find the closest match to a misspelled document name
   */
  async findClosestDocumentName(
    misspelledName: string,
    userId: string,
    threshold: number = 0.6
  ): Promise<TypoCorrection | null> {
    try {
      // Get all document names for this user
      const documents = await prisma.document.findMany({
        where: { userId },
        select: { filename: true },
      });

      let bestMatch: { filename: string; similarity: number; distance: number } | null = null;

      // Find best match
      for (const doc of documents) {
        const similarity = this.calculateSimilarity(misspelledName, doc.filename);
        const distance = this.levenshteinDistance(
          misspelledName.toLowerCase(),
          doc.filename.toLowerCase()
        );

        if (
          similarity >= threshold &&
          (!bestMatch || similarity > bestMatch.similarity)
        ) {
          bestMatch = {
            filename: doc.filename,
            similarity,
            distance,
          };
        }
      }

      if (bestMatch) {
        return {
          original: misspelledName,
          corrected: bestMatch.filename,
          confidence: bestMatch.similarity,
          distance: bestMatch.distance,
        };
      }

      return null;
    } catch (error) {
      console.error('❌ [TypoTolerance] Failed to find closest match:', error);
      return null;
    }
  }

  /**
   * Extract potential file names from a query
   */
  private extractPotentialFileNames(query: string): string[] {
    // Match patterns that look like file names
    const filePattern = /\b([a-zA-Z0-9_\-\.]+\.(pdf|docx?|xlsx?|pptx?|txt|csv))\b/gi;
    const matches = query.match(filePattern);

    if (matches) {
      return [...new Set(matches)]; // Remove duplicates
    }

    // Also try to find words that might be file names (with or without extension)
    const wordPattern = /\b([a-zA-Z0-9_\-\.]{3,})\b/g;
    const words = query.match(wordPattern);

    return words ? [...new Set(words)] : [];
  }

  /**
   * Correct all typos in a query
   */
  async correctQuery(query: string, userId: string): Promise<CorrectionResult> {
    try {
      const potentialFileNames = this.extractPotentialFileNames(query);
      const corrections: TypoCorrection[] = [];
      let correctedQuery = query;

      // Try to correct each potential file name
      for (const potentialName of potentialFileNames) {
        // Check if it exists exactly
        const exactMatch = await prisma.document.findFirst({
          where: {
            userId,
            filename: potentialName,
          },
        });

        if (exactMatch) {
          // Exact match found, no correction needed
          continue;
        }

        // Try to find a close match
        const correction = await this.findClosestDocumentName(potentialName, userId, 0.65);

        if (correction && correction.confidence >= 0.75) {
          // High confidence correction
          corrections.push(correction);
          correctedQuery = correctedQuery.replace(
            new RegExp(potentialName, 'gi'),
            correction.corrected
          );
        } else if (correction && correction.confidence >= 0.65) {
          // Medium confidence - add to corrections but don't auto-replace
          corrections.push(correction);
        }
      }

      return {
        correctedQuery,
        corrections,
        hasCorrections: corrections.length > 0,
      };
    } catch (error) {
      console.error('❌ [TypoTolerance] Failed to correct query:', error);
      return {
        correctedQuery: query,
        corrections: [],
        hasCorrections: false,
      };
    }
  }

  /**
   * Find all similar document names (for suggestions)
   */
  async findSimilarDocuments(
    searchTerm: string,
    userId: string,
    limit: number = 5
  ): Promise<Array<{ fileName: string; similarity: number }>> {
    try {
      const documents = await prisma.document.findMany({
        where: { userId },
        select: { filename: true },
      });

      const results = documents
        .map(doc => ({
          fileName: doc.filename,
          similarity: this.calculateSimilarity(searchTerm, doc.filename),
        }))
        .filter(result => result.similarity > 0.4)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('❌ [TypoTolerance] Failed to find similar documents:', error);
      return [];
    }
  }

  /**
   * Format correction message for user
   */
  formatCorrectionMessage(corrections: TypoCorrection[]): string {
    if (corrections.length === 0) return '';

    const highConfidence = corrections.filter(c => c.confidence >= 0.75);
    const mediumConfidence = corrections.filter(c => c.confidence < 0.75);

    let message = '';

    if (highConfidence.length > 0) {
      message += '✏️ **Auto-corrected typos:**\n';
      for (const correction of highConfidence) {
        message += `  - "${correction.original}" → "${correction.corrected}" (${Math.round(correction.confidence * 100)}% match)\n`;
      }
    }

    if (mediumConfidence.length > 0) {
      message += '\n💡 **Did you mean:**\n';
      for (const correction of mediumConfidence) {
        message += `  - "${correction.corrected}" instead of "${correction.original}"? (${Math.round(correction.confidence * 100)}% match)\n`;
      }
    }

    return message;
  }

  /**
   * Check if a specific document exists (with fuzzy matching)
   */
  async documentExists(
    fileName: string,
    userId: string,
    fuzzy: boolean = true
  ): Promise<{ exists: boolean; actualName?: string; suggestion?: string }> {
    try {
      // Try exact match first
      const exactMatch = await prisma.document.findFirst({
        where: {
          userId,
          filename: fileName,
        },
      });

      if (exactMatch) {
        return { exists: true, actualName: exactMatch.filename };
      }

      if (!fuzzy) {
        return { exists: false };
      }

      // Try fuzzy match
      const correction = await this.findClosestDocumentName(fileName, userId, 0.7);

      if (correction && correction.confidence >= 0.7) {
        return {
          exists: false,
          suggestion: correction.corrected,
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('❌ [TypoTolerance] Failed to check document existence:', error);
      return { exists: false };
    }
  }
}

export const typoToleranceService = new TypoToleranceService();
export default typoToleranceService;
