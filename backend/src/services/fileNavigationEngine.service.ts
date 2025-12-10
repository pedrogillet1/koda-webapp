/**
 * File Navigation Engine Service
 *
 * Provides intelligent file and folder search capabilities.
 * Searches by filename, displayTitle, and folder paths.
 * Integrates with folderPath.service.ts for path resolution.
 *
 * UPDATED: Now uses KodaMarkdownEngine for consistent markdown formatting
 */

import { PrismaClient } from '@prisma/client';
import { getFolderPath } from './folderPath.service';
import {
  KodaMarkdownEngine,
  KodaFile,
  KodaFolder,
  SupportedLanguage
} from './kodaMarkdownEngine.service';

const prisma = new PrismaClient();

export interface FileSearchResult {
  id: string;
  filename: string;
  displayTitle?: string;
  mimeType: string;
  folderId: string | null;
  folderPath: string;
  matchType: 'exact' | 'partial' | 'fuzzy';
  matchField: 'filename' | 'displayTitle' | 'content';
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderInfo {
  id: string;
  name: string;
  path: string;
  parentFolderId: string | null;
  documentCount: number;
}

export interface NavigationResult {
  found: boolean;
  type: 'file' | 'folder' | 'multiple_files' | 'not_found';
  files: FileSearchResult[];
  folders: FolderInfo[];
  suggestedPath?: string;
  message?: string;
}

/**
 * Normalize text for comparison (lowercase, remove accents, trim)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Replace special chars with space
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
}

/**
 * Calculate fuzzy match score between two strings
 */
function fuzzyMatchScore(query: string, target: string): number {
  const normalizedQuery = normalizeText(query);
  const normalizedTarget = normalizeText(target);

  // Exact match
  if (normalizedTarget === normalizedQuery) {
    return 1.0;
  }

  // Contains match
  if (normalizedTarget.includes(normalizedQuery)) {
    return 0.9;
  }

  // Word-level matching
  const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);
  const targetWords = normalizedTarget.split(' ');

  if (queryWords.length === 0) return 0;

  let matchedWords = 0;
  for (const qWord of queryWords) {
    for (const tWord of targetWords) {
      if (tWord.includes(qWord) || qWord.includes(tWord)) {
        matchedWords++;
        break;
      }
    }
  }

  return matchedWords / queryWords.length * 0.8;
}

/**
 * Search files by name or displayTitle
 */
export async function searchFilesByNameOrContent(
  userId: string,
  searchQuery: string,
  options: {
    limit?: number;
    folderId?: string;
    mimeTypes?: string[];
  } = {}
): Promise<FileSearchResult[]> {
  const { limit = 10, folderId, mimeTypes } = options;

  try {
    // Build where clause
    const whereClause: any = {
      userId,
      status: 'indexed',
    };

    if (folderId) {
      whereClause.folderId = folderId;
    }

    if (mimeTypes && mimeTypes.length > 0) {
      whereClause.mimeType = { in: mimeTypes };
    }

    // Fetch documents
    const documents = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        filename: true,
        displayTitle: true,
        mimeType: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 100, // Fetch more for scoring, then limit
    });

    // Score and rank documents
    const results: FileSearchResult[] = [];

    for (const doc of documents) {
      let bestScore = 0;
      let matchField: FileSearchResult['matchField'] = 'filename';
      let matchType: FileSearchResult['matchType'] = 'fuzzy';

      // Check filename
      const filenameScore = fuzzyMatchScore(searchQuery, doc.filename);
      if (filenameScore > bestScore) {
        bestScore = filenameScore;
        matchField = 'filename';
        matchType = filenameScore === 1 ? 'exact' : filenameScore >= 0.9 ? 'partial' : 'fuzzy';
      }

      // Check displayTitle
      if (doc.displayTitle) {
        const titleScore = fuzzyMatchScore(searchQuery, doc.displayTitle);
        if (titleScore > bestScore) {
          bestScore = titleScore;
          matchField = 'displayTitle';
          matchType = titleScore === 1 ? 'exact' : titleScore >= 0.9 ? 'partial' : 'fuzzy';
        }
      }

      // Only include if score meets threshold
      if (bestScore >= 0.3) {
        // Get folder path
        let folderPath = '/';
        if (doc.folderId) {
          try {
            folderPath = await getFolderPath(doc.folderId);
          } catch (e) {
            folderPath = '/';
          }
        }

        results.push({
          id: doc.id,
          filename: doc.filename,
          displayTitle: doc.displayTitle || undefined,
          mimeType: doc.mimeType,
          folderId: doc.folderId,
          folderPath,
          matchType,
          matchField,
          score: bestScore,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top results
    return results.slice(0, limit);
  } catch (error) {
    console.error('[FileNavigationEngine] Search error:', error);
    return [];
  }
}

/**
 * Build canonical folder path from folder ID
 */
export async function buildFolderPath(folderId: string): Promise<string> {
  try {
    return await getFolderPath(folderId);
  } catch (error) {
    console.error('[FileNavigationEngine] buildFolderPath error:', error);
    return '/';
  }
}

/**
 * List files in a specific folder path
 */
export async function listFilesInFolderPath(
  userId: string,
  folderPath: string,
  options: {
    limit?: number;
    sortBy?: 'name' | 'date' | 'type';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<FileSearchResult[]> {
  const { limit = 50, sortBy = 'name', sortOrder = 'asc' } = options;

  try {
    // Parse folder path to find folder ID
    const pathParts = folderPath.split('/').filter(p => p.length > 0);

    // Find root folders for user first
    let currentFolderId: string | null = null;

    for (const part of pathParts) {
      const foundFolder: { id: string } | null = await prisma.folder.findFirst({
        where: {
          userId,
          name: { equals: part, mode: 'insensitive' },
          parentFolderId: currentFolderId,
        },
        select: { id: true },
      });

      if (!foundFolder) {
        // Path not found
        return [];
      }

      currentFolderId = foundFolder.id;
    }

    // If path is root, get documents without folder
    const whereClause: any = {
      userId,
      status: 'indexed',
    };

    if (currentFolderId) {
      whereClause.folderId = currentFolderId;
    } else if (pathParts.length === 0) {
      // Root - could be null or any folder
      whereClause.folderId = null;
    }

    // Build order by
    let orderBy: any;
    switch (sortBy) {
      case 'date':
        orderBy = { updatedAt: sortOrder };
        break;
      case 'type':
        orderBy = { mimeType: sortOrder };
        break;
      default:
        orderBy = { filename: sortOrder };
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        filename: true,
        displayTitle: true,
        mimeType: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy,
      take: limit,
    });

    return documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      displayTitle: doc.displayTitle || undefined,
      mimeType: doc.mimeType,
      folderId: doc.folderId,
      folderPath,
      matchType: 'exact' as const,
      matchField: 'filename' as const,
      score: 1.0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  } catch (error) {
    console.error('[FileNavigationEngine] listFilesInFolderPath error:', error);
    return [];
  }
}

/**
 * Get folder structure for user
 */
export async function getFolderStructure(
  userId: string,
  parentFolderId: string | null = null,
  depth: number = 2
): Promise<FolderInfo[]> {
  try {
    const folders = await prisma.folder.findMany({
      where: {
        userId,
        parentFolderId,
      },
      select: {
        id: true,
        name: true,
        parentFolderId: true,
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const results: FolderInfo[] = [];

    for (const folder of folders) {
      // Get full path
      let path = '/';
      try {
        path = await getFolderPath(folder.id);
      } catch (e) {
        path = '/' + folder.name;
      }

      results.push({
        id: folder.id,
        name: folder.name,
        path,
        parentFolderId: folder.parentFolderId,
        documentCount: folder._count.documents,
      });

      // Recursively get subfolders if depth allows
      if (depth > 1) {
        const subfolders = await getFolderStructure(userId, folder.id, depth - 1);
        results.push(...subfolders);
      }
    }

    return results;
  } catch (error) {
    console.error('[FileNavigationEngine] getFolderStructure error:', error);
    return [];
  }
}

/**
 * Get recently uploaded/modified files
 */
export async function getRecentFiles(
  userId: string,
  options: {
    limit?: number;
    days?: number;
  } = {}
): Promise<FileSearchResult[]> {
  const { limit = 10, days = 7 } = options;

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: 'indexed',
        updatedAt: { gte: since },
      },
      select: {
        id: true,
        filename: true,
        displayTitle: true,
        mimeType: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const results: FileSearchResult[] = [];

    for (const doc of documents) {
      let folderPath = '/';
      if (doc.folderId) {
        try {
          folderPath = await getFolderPath(doc.folderId);
        } catch (e) {
          folderPath = '/';
        }
      }

      results.push({
        id: doc.id,
        filename: doc.filename,
        displayTitle: doc.displayTitle || undefined,
        mimeType: doc.mimeType,
        folderId: doc.folderId,
        folderPath,
        matchType: 'exact',
        matchField: 'filename',
        score: 1.0,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    }

    return results;
  } catch (error) {
    console.error('[FileNavigationEngine] getRecentFiles error:', error);
    return [];
  }
}

/**
 * Search for folder by name
 */
export async function searchFolders(
  userId: string,
  searchQuery: string,
  limit: number = 5
): Promise<FolderInfo[]> {
  try {
    const folders = await prisma.folder.findMany({
      where: {
        userId,
        name: { contains: searchQuery, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        parentFolderId: true,
        _count: {
          select: { documents: true },
        },
      },
      take: limit,
    });

    const results: FolderInfo[] = [];

    for (const folder of folders) {
      let path = '/';
      try {
        path = await getFolderPath(folder.id);
      } catch (e) {
        path = '/' + folder.name;
      }

      results.push({
        id: folder.id,
        name: folder.name,
        path,
        parentFolderId: folder.parentFolderId,
        documentCount: folder._count.documents,
      });
    }

    // Sort by match quality
    results.sort((a, b) => {
      const scoreA = fuzzyMatchScore(searchQuery, a.name);
      const scoreB = fuzzyMatchScore(searchQuery, b.name);
      return scoreB - scoreA;
    });

    return results;
  } catch (error) {
    console.error('[FileNavigationEngine] searchFolders error:', error);
    return [];
  }
}

/**
 * Navigate to a file or folder - unified navigation function
 */
export async function navigateToTarget(
  userId: string,
  query: string,
  context?: {
    currentFolderId?: string;
    preferFolders?: boolean;
  }
): Promise<NavigationResult> {
  const { currentFolderId, preferFolders = false } = context || {};

  try {
    // Search files
    const files = await searchFilesByNameOrContent(userId, query, {
      limit: 5,
      folderId: currentFolderId,
    });

    // Search folders
    const folders = await searchFolders(userId, query, 5);

    // Determine result type
    if (files.length === 0 && folders.length === 0) {
      return {
        found: false,
        type: 'not_found',
        files: [],
        folders: [],
        message: `No files or folders found matching "${query}"`,
      };
    }

    // Single exact file match
    if (files.length === 1 && files[0].matchType === 'exact') {
      return {
        found: true,
        type: 'file',
        files,
        folders: [],
        suggestedPath: files[0].folderPath + '/' + files[0].filename,
      };
    }

    // Single exact folder match
    if (folders.length === 1 && files.length === 0) {
      return {
        found: true,
        type: 'folder',
        files: [],
        folders,
        suggestedPath: folders[0].path,
      };
    }

    // Prefer folders if requested
    if (preferFolders && folders.length > 0) {
      return {
        found: true,
        type: 'folder',
        files,
        folders,
        suggestedPath: folders[0].path,
      };
    }

    // Multiple results
    if (files.length > 1 || (files.length > 0 && folders.length > 0)) {
      return {
        found: true,
        type: 'multiple_files',
        files,
        folders,
        message: `Found ${files.length} files and ${folders.length} folders`,
      };
    }

    // Default to file result
    return {
      found: true,
      type: files.length > 0 ? 'file' : 'folder',
      files,
      folders,
      suggestedPath: files.length > 0
        ? files[0].folderPath + '/' + files[0].filename
        : folders[0]?.path,
    };
  } catch (error) {
    console.error('[FileNavigationEngine] navigateToTarget error:', error);
    return {
      found: false,
      type: 'not_found',
      files: [],
      folders: [],
      message: 'An error occurred while searching',
    };
  }
}

/**
 * Format file search result for display in chat
 * NOTE: Uses KodaMarkdownEngine - NO document IDs in output
 */
export function formatFileForChat(file: FileSearchResult): string {
  // Use KodaMarkdownEngine for consistent formatting
  // Bold name only - frontend matches by name to ID
  return KodaMarkdownEngine.formatDocumentReference(file.filename);
}

/**
 * Format folder for display in chat
 * NOTE: Uses KodaMarkdownEngine - NO folder IDs in output
 */
export function formatFolderForChat(folder: FolderInfo): string {
  // Bold name with file count and path
  return `**${folder.name}** (${folder.documentCount} files) - \`${folder.path}\``;
}

/**
 * Format navigation result for natural language response
 * NOTE: Uses KodaMarkdownEngine for consistent formatting - NO IDs in output
 */
export function formatNavigationResult(result: NavigationResult, language: string = 'en'): string {
  // Determine language for KodaMarkdownEngine
  const lang: SupportedLanguage = language.toLowerCase().startsWith('pt') ? 'pt'
    : language.toLowerCase().startsWith('es') ? 'es'
    : 'en';
  const isPortuguese = lang === 'pt';

  if (!result.found) {
    return isPortuguese
      ? `Não encontrei arquivos ou pastas com esse nome.`
      : `I couldn't find any files or folders with that name.`;
  }

  // Single file result
  if (result.type === 'file' && result.files.length === 1) {
    const file = result.files[0];
    const prefix = isPortuguese
      ? `Encontrei o arquivo:`
      : `I found the file:`;

    // Convert to KodaFile format and use engine
    const kodaFiles: KodaFile[] = [{
      id: file.id,
      name: file.filename,
      folderPath: file.folderPath,
      mimeType: file.mimeType
    }];

    return `${prefix}\n\n${KodaMarkdownEngine.formatFileListing(kodaFiles, lang).split('\n').slice(2).join('\n')}`;
  }

  // Single folder result
  if (result.type === 'folder' && result.folders.length === 1) {
    const folder = result.folders[0];
    const prefix = isPortuguese
      ? `Encontrei a pasta:`
      : `I found the folder:`;

    // Convert to KodaFolder format and use engine
    const kodaFolders: KodaFolder[] = [{
      id: folder.id,
      name: folder.name,
      path: folder.path,
      fileCount: folder.documentCount
    }];

    return `${prefix}\n\n${KodaMarkdownEngine.formatFolderListing(kodaFolders, lang).split('\n').slice(2).join('\n')}`;
  }

  // Multiple results
  if (result.type === 'multiple_files') {
    const parts: string[] = [];

    // Header
    parts.push(isPortuguese
      ? `Encontrei ${result.files.length} arquivo(s) e ${result.folders.length} pasta(s):`
      : `I found ${result.files.length} file(s) and ${result.folders.length} folder(s):`);

    // Files section - use KodaMarkdownEngine
    if (result.files.length > 0) {
      parts.push(isPortuguese ? '\n**Arquivos:**' : '\n**Files:**');
      const kodaFiles: KodaFile[] = result.files.slice(0, 5).map(f => ({
        id: f.id,
        name: f.filename,
        folderPath: f.folderPath,
        mimeType: f.mimeType
      }));
      // Get just the list items (skip the header from formatFileListing)
      const fileListLines = KodaMarkdownEngine.formatFileListing(kodaFiles, lang).split('\n').slice(2);
      parts.push(fileListLines.join('\n'));
    }

    // Folders section - use KodaMarkdownEngine
    if (result.folders.length > 0) {
      parts.push(isPortuguese ? '\n**Pastas:**' : '\n**Folders:**');
      const kodaFolders: KodaFolder[] = result.folders.slice(0, 3).map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        fileCount: f.documentCount
      }));
      // Get just the list items (skip the header from formatFolderListing)
      const folderListLines = KodaMarkdownEngine.formatFolderListing(kodaFolders, lang).split('\n').slice(2);
      parts.push(folderListLines.join('\n'));
    }

    return parts.join('\n');
  }

  return '';
}

export default {
  searchFilesByNameOrContent,
  buildFolderPath,
  listFilesInFolderPath,
  getFolderStructure,
  getRecentFiles,
  searchFolders,
  navigateToTarget,
  formatFileForChat,
  formatFolderForChat,
  formatNavigationResult,
};
