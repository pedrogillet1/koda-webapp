/**
 * Navigation Orchestrator Service
 *
 * Orchestrates navigation and help queries by routing them to
 * the appropriate engine (file navigation or app help).
 *
 * This service intercepts queries before they reach the RAG pipeline
 * to provide instant responses for navigation and help requests.
 */

import {
  searchFilesByNameOrContent,
  navigateToTarget,
  formatNavigationResult,
  getRecentFiles,
  getFolderStructure,
  listFilesInFolderPath,
  type NavigationResult as FileNavResult,
  type FileSearchResult,
  type FolderInfo,
} from './fileNavigationEngine.service';

import {
  isHelpQuery,
  getHelpResponse,
  searchHelpTopics,
} from './appHelpEngine.service';

import {
  detectNavigationIntent,
  type NavigationIntent,
} from './navigationIntent.service';

import {
  detectAppHelpIntent,
  type AppHelpIntent,
} from './appHelpIntent.service';

import { detectLanguageSimple } from './languageEngine.service';

export interface NavigationResult {
  handled: boolean;
  response?: string;
  intentType?: 'file_search' | 'folder_search' | 'file_list' | 'recent_files' | 'app_help' | 'not_handled';
  confidence?: number;
  language?: string;
  files?: FileSearchResult[];
  folders?: FolderInfo[];
  metadata?: Record<string, any>;
}

export interface OrchestratorContext {
  userId: string;
  conversationId?: string;
  language?: string;
  currentFolderId?: string;
}

/**
 * Detect the language from query - uses centralized language engine
 * @deprecated Use detectLanguageSimple directly from languageEngine.service.ts
 */
function detectLanguage(query: string): string {
  const detected = detectLanguageSimple(query, 'pt-BR');
  // Map SupportedLanguage to legacy format
  if (detected === 'pt-BR') return 'pt';
  return detected;
}

/**
 * Detect if query is a file/folder navigation request
 */
function detectFileNavigationIntent(query: string): {
  isNavigation: boolean;
  targetType: 'file' | 'folder' | 'list' | 'recent' | null;
  searchTerm: string | null;
  folderPath: string | null;
} {
  const queryLower = query.toLowerCase();

  // File search patterns
  const fileSearchPatterns = [
    /(?:find|search|where is|open|show me|locate)\s+(?:the\s+)?(?:file|document)\s+(?:called\s+|named\s+)?["']?([^"'?]+)["']?/i,
    /(?:encontr|busc|procur|abr|mostrar?|localiz)[aei]r?\s+(?:o\s+)?(?:arquivo|documento)\s+(?:chamado\s+)?["']?([^"'?]+)["']?/i,
    /(?:where|onde)\s+(?:is|está|fica)\s+(?:the\s+|o\s+)?(?:file|documento|arquivo)\s+["']?([^"'?]+)["']?/i,
  ];

  // Folder search patterns
  const folderSearchPatterns = [
    /(?:find|search|where is|open|show me|go to)\s+(?:the\s+)?folder\s+(?:called\s+|named\s+)?["']?([^"'?]+)["']?/i,
    /(?:encontr|busc|abr|ir para)\s+(?:a\s+)?pasta\s+(?:chamada\s+)?["']?([^"'?]+)["']?/i,
    /(?:where|onde)\s+(?:is|está|fica)\s+(?:the\s+|a\s+)?(?:folder|pasta)\s+["']?([^"'?]+)["']?/i,
  ];

  // List files patterns - MUST require explicit folder reference
  // Patterns like "quais documentos eu tenho" should NOT match here (handled by document listing)
  const listFilesPatterns = [
    // English: REQUIRE "in" or "folder" to be present
    /(?:list|show|what)\s+(?:all\s+)?(?:files|documents)\s+in\s+(?:the\s+)?(?:folder\s+)?["']?([^"'?]+)["']?/i,
    /(?:list|show)\s+(?:all\s+)?(?:files|documents)\s+(?:in\s+)?(?:the\s+)?folder\s+["']?([^"'?]+)["']?/i,
    // Portuguese: REQUIRE "na pasta" or "da pasta" to be present
    /(?:listar?|mostrar?|quais)\s+(?:os\s+)?(?:arquivos|documentos)\s+(?:na|da)\s+pasta\s+["']?([^"'?]+)["']?/i,
  ];

  // Recent files patterns
  const recentFilesPatterns = [
    /(?:recent|latest|last|new)\s+(?:uploaded\s+)?(?:files|documents)/i,
    /(?:files|documents)\s+(?:i\s+)?(?:recently|just)\s+(?:uploaded|added)/i,
    /(?:arquivos|documentos)\s+(?:recentes|últimos|novos)/i,
    /(?:últimos|recentes)\s+(?:arquivos|documentos)/i,
    /what did i (?:upload|add) (?:recently|today|this week)/i,
    /o que (?:eu )?(?:enviei|carreguei) (?:recentemente|hoje)/i,
  ];

  // Check file search
  for (const pattern of fileSearchPatterns) {
    const match = query.match(pattern);
    if (match) {
      return {
        isNavigation: true,
        targetType: 'file',
        searchTerm: match[1]?.trim() || null,
        folderPath: null,
      };
    }
  }

  // Check folder search
  for (const pattern of folderSearchPatterns) {
    const match = query.match(pattern);
    if (match) {
      return {
        isNavigation: true,
        targetType: 'folder',
        searchTerm: match[1]?.trim() || null,
        folderPath: null,
      };
    }
  }

  // Check list files
  for (const pattern of listFilesPatterns) {
    const match = query.match(pattern);
    if (match) {
      return {
        isNavigation: true,
        targetType: 'list',
        searchTerm: null,
        folderPath: match[1]?.trim() || '/',
      };
    }
  }

  // Check recent files
  for (const pattern of recentFilesPatterns) {
    if (pattern.test(query)) {
      return {
        isNavigation: true,
        targetType: 'recent',
        searchTerm: null,
        folderPath: null,
      };
    }
  }

  return {
    isNavigation: false,
    targetType: null,
    searchTerm: null,
    folderPath: null,
  };
}

/**
 * Handle file search query
 */
async function handleFileSearch(
  userId: string,
  searchTerm: string,
  language: string
): Promise<NavigationResult> {
  const isPortuguese = language === 'pt';

  const files = await searchFilesByNameOrContent(userId, searchTerm, { limit: 5 });

  if (files.length === 0) {
    return {
      handled: true,
      intentType: 'file_search',
      confidence: 0.9,
      language,
      response: isPortuguese
        ? `Não encontrei nenhum arquivo chamado "${searchTerm}". Tente verificar o nome ou use termos diferentes.`
        : `I couldn't find any file named "${searchTerm}". Try checking the name or using different terms.`,
      files: [],
    };
  }

  if (files.length === 1) {
    const file = files[0];
    const docMarker = `{{DOC:::${file.id}:::${file.filename}:::${file.folderPath}:::open}}`;

    return {
      handled: true,
      intentType: 'file_search',
      confidence: 0.95,
      language,
      response: isPortuguese
        ? `Encontrei o arquivo **${file.filename}**:\n\n${docMarker}`
        : `I found the file **${file.filename}**:\n\n${docMarker}`,
      files,
    };
  }

  // Multiple results
  let response = isPortuguese
    ? `Encontrei ${files.length} arquivos relacionados a "${searchTerm}":\n\n`
    : `I found ${files.length} files related to "${searchTerm}":\n\n`;

  for (const file of files) {
    const docMarker = `{{DOC:::${file.id}:::${file.filename}:::${file.folderPath}:::open}}`;
    response += `- ${docMarker}\n`;
  }

  return {
    handled: true,
    intentType: 'file_search',
    confidence: 0.9,
    language,
    response,
    files,
  };
}

/**
 * Handle folder search query
 */
async function handleFolderSearch(
  userId: string,
  searchTerm: string,
  language: string
): Promise<NavigationResult> {
  const isPortuguese = language === 'pt';

  const navResult = await navigateToTarget(userId, searchTerm, { preferFolders: true });

  if (!navResult.found || navResult.folders.length === 0) {
    return {
      handled: true,
      intentType: 'folder_search',
      confidence: 0.85,
      language,
      response: isPortuguese
        ? `Não encontrei nenhuma pasta chamada "${searchTerm}".`
        : `I couldn't find any folder named "${searchTerm}".`,
      folders: [],
    };
  }

  const formattedResponse = formatNavigationResult(navResult, language);

  return {
    handled: true,
    intentType: 'folder_search',
    confidence: 0.9,
    language,
    response: formattedResponse,
    folders: navResult.folders,
    files: navResult.files,
  };
}

/**
 * Handle list files in folder query
 */
async function handleListFiles(
  userId: string,
  folderPath: string,
  language: string
): Promise<NavigationResult> {
  const isPortuguese = language === 'pt';

  const files = await listFilesInFolderPath(userId, folderPath, { limit: 20 });

  if (files.length === 0) {
    return {
      handled: true,
      intentType: 'file_list',
      confidence: 0.9,
      language,
      response: isPortuguese
        ? `Não há arquivos nesta pasta.`
        : `There are no files in this folder.`,
      files: [],
    };
  }

  let response = isPortuguese
    ? `Arquivos em **${folderPath || '/'}** (${files.length}):\n\n`
    : `Files in **${folderPath || '/'}** (${files.length}):\n\n`;

  for (const file of files.slice(0, 15)) {
    const docMarker = `{{DOC:::${file.id}:::${file.filename}:::${file.folderPath}:::open}}`;
    response += `- ${docMarker}\n`;
  }

  if (files.length > 15) {
    response += isPortuguese
      ? `\n...e mais ${files.length - 15} arquivos`
      : `\n...and ${files.length - 15} more files`;
  }

  return {
    handled: true,
    intentType: 'file_list',
    confidence: 0.95,
    language,
    response,
    files,
  };
}

/**
 * Handle recent files query
 */
async function handleRecentFiles(
  userId: string,
  language: string
): Promise<NavigationResult> {
  const isPortuguese = language === 'pt';

  const files = await getRecentFiles(userId, { limit: 10, days: 7 });

  if (files.length === 0) {
    return {
      handled: true,
      intentType: 'recent_files',
      confidence: 0.9,
      language,
      response: isPortuguese
        ? `Você não enviou nenhum arquivo nos últimos 7 dias.`
        : `You haven't uploaded any files in the last 7 days.`,
      files: [],
    };
  }

  let response = isPortuguese
    ? `Seus arquivos recentes (últimos 7 dias):\n\n`
    : `Your recent files (last 7 days):\n\n`;

  for (const file of files) {
    const docMarker = `{{DOC:::${file.id}:::${file.filename}:::${file.folderPath}:::open}}`;
    const date = file.updatedAt.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US');
    response += `- ${docMarker} (${date})\n`;
  }

  return {
    handled: true,
    intentType: 'recent_files',
    confidence: 0.95,
    language,
    response,
    files,
  };
}

/**
 * Handle app help query
 */
async function handleAppHelp(
  query: string,
  language: string
): Promise<NavigationResult> {
  const helpResult = getHelpResponse(query, language);

  return {
    handled: true,
    intentType: 'app_help',
    confidence: helpResult.confidence,
    language,
    response: helpResult.response,
    metadata: {
      topics: helpResult.topics.map(t => t.id),
    },
  };
}

/**
 * Main orchestrator function - handles navigation and help queries
 *
 * @param query - The user's query
 * @param context - Context including userId and language
 * @returns NavigationResult indicating if the query was handled
 */
export async function handleNavigationQuery(
  query: string,
  context?: OrchestratorContext | Record<string, unknown>
): Promise<NavigationResult> {
  // Extract context
  const userId = (context as OrchestratorContext)?.userId;
  const providedLanguage = (context as OrchestratorContext)?.language;
  const currentFolderId = (context as OrchestratorContext)?.currentFolderId;

  // If no userId, can't handle navigation
  if (!userId) {
    return { handled: false, intentType: 'not_handled' };
  }

  // Detect language
  const language = providedLanguage || detectLanguage(query);

  // Step 1: Check for file/folder navigation intent
  const navIntent = detectFileNavigationIntent(query);

  if (navIntent.isNavigation) {
    switch (navIntent.targetType) {
      case 'file':
        if (navIntent.searchTerm) {
          return handleFileSearch(userId, navIntent.searchTerm, language);
        }
        break;

      case 'folder':
        if (navIntent.searchTerm) {
          return handleFolderSearch(userId, navIntent.searchTerm, language);
        }
        break;

      case 'list':
        return handleListFiles(userId, navIntent.folderPath || '/', language);

      case 'recent':
        return handleRecentFiles(userId, language);
    }
  }

  // Step 2: Check for app help query
  if (isHelpQuery(query)) {
    return handleAppHelp(query, language);
  }

  // Step 3: Try more advanced intent detection (from imported services)
  try {
    const navigationIntentResult = detectNavigationIntent(query);
    if (navigationIntentResult.type !== 'NONE' && navigationIntentResult.confidence > 0.7) {
      // Use the detected target/searchTerm for search
      const searchTarget = navigationIntentResult.searchTerm || navigationIntentResult.targetName;
      if (searchTarget) {
        return handleFileSearch(userId, searchTarget, language);
      }
    }

    const appHelpIntentResult = detectAppHelpIntent(query);
    if (appHelpIntentResult.type !== 'NONE' && appHelpIntentResult.confidence > 0.7) {
      return handleAppHelp(query, language);
    }
  } catch (error) {
    // Intent services may not be available, continue
    console.log('[NavigationOrchestrator] Intent detection services not available');
  }

  // Not a navigation or help query
  return {
    handled: false,
    intentType: 'not_handled',
    language,
  };
}

/**
 * Quick check if query might be navigation-related (for early filtering)
 */
export function mightBeNavigationQuery(query: string): boolean {
  const navKeywords = [
    'find', 'search', 'where', 'open', 'show', 'locate', 'list',
    'recent', 'folder', 'file', 'document', 'upload',
    'encontrar', 'buscar', 'onde', 'abrir', 'mostrar', 'localizar', 'listar',
    'recente', 'pasta', 'arquivo', 'documento', 'carregar',
    'how do i', 'how to', 'help', 'what is',
    'como', 'ajuda', 'o que é',
  ];

  const queryLower = query.toLowerCase();

  for (const keyword of navKeywords) {
    if (queryLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}

export default {
  handleNavigationQuery,
  mightBeNavigationQuery,
};
