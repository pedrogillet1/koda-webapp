/**
 * Koda Navigation Engine
 * Centralized file and folder navigation logic
 *
 * Handles:
 * - File location queries ("Where is the contract file?")
 * - Folder listing queries ("What files are in the Finance folder?")
 * - Folder structure queries ("How many folders do I have?")
 *
 * @version 1.0.0
 * @date 2025-12-09
 */

import { PrismaClient, Folder } from '@prisma/client';
import type { AnswerType } from './answerTypeRouter.service';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

interface NavigationParams {
  answerType: AnswerType;
  query: string;
  userId: string;
  language: string;
}

interface FileSearchResult {
  id: string;
  name: string;
  displayTitle?: string;
  folderPath: string;
  uploadedAt: Date;
  mimeType?: string;
}

interface FolderContents {
  folderFound: boolean;
  folderId?: string;
  folderName: string;
  folderPath?: string;
  filesCount: number;
  files: Array<{
    id: string;
    name: string;
    displayTitle?: string;
    uploadedAt: Date;
  }>;
  subfoldersCount: number;
  subfolders: Array<{
    id: string;
    name: string;
  }>;
}

// ============================================================================
// KODA NAVIGATION ENGINE
// ============================================================================

export class KodaNavigationEngine {
  /**
   * Main navigation handler
   * Routes to appropriate navigation method based on answer type
   */
  async handleNavigation(
    params: NavigationParams,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const { answerType, query, userId, language } = params;

    console.log(`[NAVIGATION ENGINE] Handling ${answerType} for query: "${query}"`);

    if (answerType === 'FILE_NAVIGATION') {
      return this.handleFileNavigation({ query, userId, language }, onChunk);
    }

    if (answerType === 'FOLDER_NAVIGATION') {
      return this.handleFolderNavigation({ query, userId, language }, onChunk);
    }

    throw new Error(`Unsupported navigation type: ${answerType}`);
  }

  /**
   * Handle file location queries
   * Example: "Where is the contract file?"
   */
  private async handleFileNavigation(
    params: { query: string; userId: string; language: string },
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const { query, userId, language } = params;

    // Extract filename or search term from query
    const searchTerm = this.extractSearchTerm(query);
    console.log(`[NAVIGATION] Searching for files matching: "${searchTerm}"`);

    // Search for files
    const files = await this.findFilesForQuery(searchTerm, userId);
    console.log(`[NAVIGATION] Found ${files.length} matching files`);

    // Generate response based on results
    const response = this.formatFileLocationResponse(files, searchTerm, language);

    if (onChunk) {
      onChunk(response);
    }

    return response;
  }

  /**
   * Handle folder listing queries
   * Example: "What files are in the Finance folder?"
   */
  private async handleFolderNavigation(
    params: { query: string; userId: string; language: string },
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const { query, userId, language } = params;

    // Extract folder name from query
    const folderName = this.extractFolderName(query);
    console.log(`[NAVIGATION] Looking for folder: "${folderName}"`);

    // Get folder contents
    const folderContents = await this.listFolderContents(folderName, userId);

    // Generate response based on results
    const response = this.formatFolderContentsResponse(folderContents, language);

    if (onChunk) {
      onChunk(response);
    }

    return response;
  }

  /**
   * Find files matching search term
   */
  private async findFilesForQuery(
    searchTerm: string,
    userId: string
  ): Promise<FileSearchResult[]> {
    const files = await prisma.document.findMany({
      where: {
        userId,
        OR: [
          { filename: { contains: searchTerm, mode: 'insensitive' } },
          { displayTitle: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      include: {
        folder: true,
      },
      take: 10,
    });

    // Build folder paths
    const results: FileSearchResult[] = [];
    for (const file of files) {
      const folderPath = await this.getFullFolderPath(file.folderId, userId);
      results.push({
        id: file.id,
        name: file.filename,
        displayTitle: file.displayTitle || undefined,
        folderPath,
        uploadedAt: file.createdAt,
        mimeType: file.mimeType || undefined,
      });
    }

    return results;
  }

  /**
   * List folder contents
   */
  private async listFolderContents(
    folderName: string,
    userId: string
  ): Promise<FolderContents> {
    // Find folder by name
    const folder = await prisma.folder.findFirst({
      where: {
        userId,
        name: { contains: folderName, mode: 'insensitive' },
      },
    });

    if (!folder) {
      return {
        folderFound: false,
        folderName,
        filesCount: 0,
        files: [],
        subfoldersCount: 0,
        subfolders: [],
      };
    }

    // Get files in folder
    const files = await prisma.document.findMany({
      where: {
        userId,
        folderId: folder.id,
      },
      take: 50,
      select: {
        id: true,
        filename: true,
        displayTitle: true,
        createdAt: true,
      },
    });

    // Get subfolders
    const subfolders = await prisma.folder.findMany({
      where: {
        userId,
        parentFolderId: folder.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const folderPath = await this.getFullFolderPath(folder.id, userId);

    return {
      folderFound: true,
      folderId: folder.id,
      folderName: folder.name,
      folderPath,
      filesCount: files.length,
      files: files.map((f) => ({
        id: f.id,
        name: f.filename,
        displayTitle: f.displayTitle || undefined,
        uploadedAt: f.createdAt,
      })),
      subfoldersCount: subfolders.length,
      subfolders: subfolders.map((sf) => ({
        id: sf.id,
        name: sf.name,
      })),
    };
  }

  /**
   * Get full folder path (e.g., "Root / Finance / 2024")
   */
  private async getFullFolderPath(
    folderId: string | null,
    userId: string
  ): Promise<string> {
    if (!folderId) return 'Root';

    const path: string[] = [];
    let currentFolderId: string | null = folderId;

    while (currentFolderId) {
      const folderRecord: Folder | null = await prisma.folder.findUnique({
        where: { id: currentFolderId },
      });

      if (!folderRecord) break;

      path.unshift(folderRecord.name);
      currentFolderId = folderRecord.parentFolderId;
    }

    return path.length > 0 ? `Root / ${path.join(' / ')}` : 'Root';
  }

  /**
   * Extract search term from query
   * Example: "Where is the contract file?" -> "contract"
   */
  private extractSearchTerm(query: string): string {
    // Remove common words
    const stopWords = [
      'where',
      'is',
      'the',
      'file',
      'document',
      'arquivo',
      'documento',
      'onde',
      'está',
      'find',
      'locate',
      'encontre',
      'localize',
    ];
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => !stopWords.includes(w) && w.length > 2);

    // Check for filename with extension
    const filenameMatch = query.match(
      /[\w-]+\.(pdf|docx?|xlsx?|pptx?|txt|csv)/i
    );
    if (filenameMatch) {
      return filenameMatch[0];
    }

    // Return first meaningful word or original query
    return words[0] || query.slice(0, 20);
  }

  /**
   * Extract folder name from query
   * Example: "What files are in the Finance folder?" -> "Finance"
   */
  private extractFolderName(query: string): string {
    // Pattern: "in the [folder name] folder"
    const match = query.match(
      /\b(?:in|na|no)\s+(?:the\s+)?([a-z0-9_-]+)\s+(?:folder|pasta)/i
    );
    if (match) return match[1];

    // Pattern: "[folder name] folder"
    const match2 = query.match(/\b([a-z0-9_-]+)\s+(?:folder|pasta)/i);
    if (match2) return match2[1];

    // Fallback: last word before "folder"
    const words = query.toLowerCase().split(/\s+/);
    const folderIndex = words.findIndex(
      (w) => w === 'folder' || w === 'pasta' || w === 'diretório'
    );
    if (folderIndex > 0) {
      return words[folderIndex - 1];
    }

    // Default to "documents"
    return 'documents';
  }

  /**
   * Format file location response
   */
  private formatFileLocationResponse(
    files: FileSearchResult[],
    searchTerm: string,
    language: string
  ): string {
    if (files.length === 0) {
      if (language === 'pt') {
        return `Não encontrei nenhum arquivo com "${searchTerm}" no nome ou conteúdo.\n\nDica: Você pode tentar pesquisar com outro termo ou verificar se o arquivo foi carregado.`;
      } else if (language === 'es') {
        return `No encontré ningún archivo con "${searchTerm}" en el nombre o contenido.\n\nSugerencia: Puede intentar buscar con otro término o verificar si el archivo fue cargado.`;
      }
      return `I couldn't find any files matching "${searchTerm}".\n\nTip: You can try searching with a different term or check if the file was uploaded.`;
    }

    if (files.length === 1) {
      const file = files[0];
      if (language === 'pt') {
        return `Encontrei o arquivo:\n\n**${file.displayTitle || file.name}**\n- Pasta: ${file.folderPath}\n- Adicionado em: ${file.uploadedAt.toLocaleDateString('pt-BR')}\n\nPosso ajudar com mais alguma coisa sobre este arquivo?`;
      } else if (language === 'es') {
        return `Encontré el archivo:\n\n**${file.displayTitle || file.name}**\n- Carpeta: ${file.folderPath}\n- Agregado el: ${file.uploadedAt.toLocaleDateString('es-ES')}\n\n¿Puedo ayudar con algo más sobre este archivo?`;
      }
      return `I found the file:\n\n**${file.displayTitle || file.name}**\n- Folder: ${file.folderPath}\n- Added on: ${file.uploadedAt.toLocaleDateString('en-US')}\n\nCan I help with anything else about this file?`;
    }

    // Multiple files found
    const fileList = files
      .slice(0, 5)
      .map(
        (f, i) =>
          `${i + 1}. **${f.displayTitle || f.name}** - ${f.folderPath}`
      )
      .join('\n');

    if (language === 'pt') {
      return `Encontrei ${files.length} arquivos relacionados a "${searchTerm}":\n\n${fileList}\n\nQual deles você gostaria de explorar?`;
    } else if (language === 'es') {
      return `Encontré ${files.length} archivos relacionados con "${searchTerm}":\n\n${fileList}\n\n¿Cuál te gustaría explorar?`;
    }
    return `I found ${files.length} files related to "${searchTerm}":\n\n${fileList}\n\nWhich one would you like to explore?`;
  }

  /**
   * Format folder contents response
   */
  private formatFolderContentsResponse(
    contents: FolderContents,
    language: string
  ): string {
    if (!contents.folderFound) {
      if (language === 'pt') {
        return `Não encontrei uma pasta chamada "${contents.folderName}".\n\nDica: Verifique o nome da pasta ou use "listar pastas" para ver todas as pastas disponíveis.`;
      } else if (language === 'es') {
        return `No encontré una carpeta llamada "${contents.folderName}".\n\nSugerencia: Verifique el nombre de la carpeta o use "listar carpetas" para ver todas las carpetas disponibles.`;
      }
      return `I couldn't find a folder named "${contents.folderName}".\n\nTip: Check the folder name or use "list folders" to see all available folders.`;
    }

    const { folderName, folderPath, files, subfolders } = contents;

    let response = '';

    if (language === 'pt') {
      response = `**Pasta: ${folderName}**\nCaminho: ${folderPath}\n\n`;

      if (files.length > 0) {
        response += `**Arquivos (${files.length}):**\n`;
        response += files
          .slice(0, 10)
          .map((f) => `- ${f.displayTitle || f.name}`)
          .join('\n');
        if (files.length > 10) {
          response += `\n... e mais ${files.length - 10} arquivos`;
        }
        response += '\n\n';
      } else {
        response += 'Nenhum arquivo nesta pasta.\n\n';
      }

      if (subfolders.length > 0) {
        response += `**Subpastas (${subfolders.length}):**\n`;
        response += subfolders.map((sf) => `- ${sf.name}`).join('\n');
      }

      response += '\n\nO que você gostaria de fazer com esses arquivos?';
    } else if (language === 'es') {
      response = `**Carpeta: ${folderName}**\nRuta: ${folderPath}\n\n`;

      if (files.length > 0) {
        response += `**Archivos (${files.length}):**\n`;
        response += files
          .slice(0, 10)
          .map((f) => `- ${f.displayTitle || f.name}`)
          .join('\n');
        if (files.length > 10) {
          response += `\n... y ${files.length - 10} archivos más`;
        }
        response += '\n\n';
      } else {
        response += 'No hay archivos en esta carpeta.\n\n';
      }

      if (subfolders.length > 0) {
        response += `**Subcarpetas (${subfolders.length}):**\n`;
        response += subfolders.map((sf) => `- ${sf.name}`).join('\n');
      }

      response += '\n\n¿Qué te gustaría hacer con estos archivos?';
    } else {
      response = `**Folder: ${folderName}**\nPath: ${folderPath}\n\n`;

      if (files.length > 0) {
        response += `**Files (${files.length}):**\n`;
        response += files
          .slice(0, 10)
          .map((f) => `- ${f.displayTitle || f.name}`)
          .join('\n');
        if (files.length > 10) {
          response += `\n... and ${files.length - 10} more files`;
        }
        response += '\n\n';
      } else {
        response += 'No files in this folder.\n\n';
      }

      if (subfolders.length > 0) {
        response += `**Subfolders (${subfolders.length}):**\n`;
        response += subfolders.map((sf) => `- ${sf.name}`).join('\n');
      }

      response += '\n\nWhat would you like to do with these files?';
    }

    return response;
  }
}

// Export singleton instance
export const kodaNavigationEngine = new KodaNavigationEngine();

export default kodaNavigationEngine;
