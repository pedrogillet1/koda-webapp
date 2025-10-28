/**
 * Folder Resolver Service
 * Finds folders by name with fuzzy matching support
 * Handles typos and variations in folder names
 */

import { PrismaClient, Folder } from '@prisma/client';

const prisma = new PrismaClient();

export interface FolderResolution {
  folder: Folder | null;
  error?: string;
  suggestions?: string[];
}

export class FolderResolverService {

  /**
   * Find folder by name with fuzzy matching
   */
  async resolveFolder(
    folderName: string,
    userId: string
  ): Promise<FolderResolution> {

    // 1. Try exact match first
    let folder = await prisma.folder.findFirst({
      where: {
        name: folderName,
        userId: userId
      }
    });

    if (folder) {
      return { folder };
    }

    // 2. Try case-insensitive match (manual lowercasing for SQLite compatibility)
    const allFoldersForCaseInsensitive = await prisma.folder.findMany({
      where: { userId: userId }
    });

    folder = allFoldersForCaseInsensitive.find(
      f => f.name.toLowerCase() === folderName.toLowerCase()
    ) || null;

    if (folder) {
      return { folder };
    }

    // 3. Try partial match (contains) - manual lowercasing for SQLite compatibility
    folder = allFoldersForCaseInsensitive.find(
      f => f.name.toLowerCase().includes(folderName.toLowerCase())
    ) || null;

    if (folder) {
      return { folder };
    }

    // 4. Try fuzzy match (Levenshtein distance)
    const allFolders = await prisma.folder.findMany({
      where: { userId: userId },
      select: { id: true, name: true, parentId: true }
    });

    const fuzzyMatch = this.findBestMatch(folderName, allFolders);

    if (fuzzyMatch && fuzzyMatch.similarity > 0.7) {
      // Get full folder object
      folder = await prisma.folder.findUnique({
        where: { id: fuzzyMatch.folder.id }
      });
      return { folder: folder! };
    }

    // 5. Not found - provide suggestions
    const suggestions = this.suggestAlternatives(folderName, allFolders);

    return {
      folder: null,
      error: `I couldn't find a folder named "${folderName}".`,
      suggestions
    };
  }

  /**
   * Find best matching folder name using Levenshtein distance
   */
  private findBestMatch(
    query: string,
    folders: Array<{ id: string; name: string }>
  ): { folder: any; similarity: number } | null {

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const folder of folders) {
      const similarity = this.calculateSimilarity(
        query.toLowerCase(),
        folder.name.toLowerCase()
      );

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = folder;
      }
    }

    return bestMatch ? { folder: bestMatch, similarity: bestSimilarity } : null;
  }

  /**
   * Calculate string similarity (0 to 1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Suggest alternative folder names
   */
  private suggestAlternatives(
    query: string,
    folders: Array<{ id: string; name: string }>
  ): string[] {
    const suggestions = folders
      .map(f => ({
        name: f.name,
        similarity: this.calculateSimilarity(query.toLowerCase(), f.name.toLowerCase())
      }))
      .filter(s => s.similarity > 0.4)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(s => s.name);

    return suggestions;
  }

  /**
   * Get all folders for a user
   */
  async getFolders(userId: string): Promise<Folder[]> {
    return await prisma.folder.findMany({
      where: { userId: userId },
      orderBy: { name: 'asc' }
    });
  }
}

// Export singleton instance
export default new FolderResolverService();
