/**
 * Koda Micro-Prompt Generator Service
 *
 * Generates minimal, focused prompts for fast-path queries.
 * These prompts are optimized for speed and token efficiency.
 *
 * Instead of full RAG context, we provide structured data directly
 * and use small, targeted prompts for natural language responses.
 *
 * @version 1.0.0
 */

import type { FastPathIntentType, FastPathClassification } from './kodaFastPathIntent.service';
import type {
  FileListData,
  FileCountData,
  FolderPathData,
  RecentActivityData,
  MetadataData,
} from './kodaFastDataRetrieval.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface MicroPromptResult {
  prompt: string;
  systemInstruction: string;
  maxTokens: number;
  temperature: number;
  expectedResponseTime: number; // ms
}

export interface GeneratedResponse {
  text: string;
  generatedWithoutLLM: boolean;
  processingTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Language-Specific Templates
// ═══════════════════════════════════════════════════════════════════════════

const RESPONSE_TEMPLATES = {
  FILE_LIST: {
    en: {
      intro: (count: number, hasMore: boolean) =>
        hasMore
          ? `Here are your ${count} most recent files (showing first ${count}):`
          : count === 1
            ? `You have 1 file:`
            : `You have ${count} files:`,
      empty: 'You don\'t have any files yet.',
      fileItem: (name: string, type: string, folder: string) =>
        `• **${name}** (${type}) - in ${folder}`,
      moreFiles: (remaining: number) => `\n_...and ${remaining} more files_`,
    },
    pt: {
      intro: (count: number, hasMore: boolean) =>
        hasMore
          ? `Aqui estão seus ${count} arquivos mais recentes:`
          : count === 1
            ? `Você tem 1 arquivo:`
            : `Você tem ${count} arquivos:`,
      empty: 'Você ainda não tem nenhum arquivo.',
      fileItem: (name: string, type: string, folder: string) =>
        `• **${name}** (${type}) - em ${folder}`,
      moreFiles: (remaining: number) => `\n_...e mais ${remaining} arquivos_`,
    },
    es: {
      intro: (count: number, hasMore: boolean) =>
        hasMore
          ? `Aquí están tus ${count} archivos más recientes:`
          : count === 1
            ? `Tienes 1 archivo:`
            : `Tienes ${count} archivos:`,
      empty: 'Aún no tienes ningún archivo.',
      fileItem: (name: string, type: string, folder: string) =>
        `• **${name}** (${type}) - en ${folder}`,
      moreFiles: (remaining: number) => `\n_...y ${remaining} archivos más_`,
    },
  },
  FILE_COUNT: {
    en: {
      total: (count: number) =>
        count === 0
          ? 'You don\'t have any files yet.'
          : count === 1
            ? 'You have **1 file** in total.'
            : `You have **${count} files** in total.`,
      byType: (type: string, count: number) => `• ${type.toUpperCase()}: ${count}`,
      breakdown: 'Here\'s the breakdown by type:',
    },
    pt: {
      total: (count: number) =>
        count === 0
          ? 'Você ainda não tem nenhum arquivo.'
          : count === 1
            ? 'Você tem **1 arquivo** no total.'
            : `Você tem **${count} arquivos** no total.`,
      byType: (type: string, count: number) => `• ${type.toUpperCase()}: ${count}`,
      breakdown: 'Aqui está a divisão por tipo:',
    },
    es: {
      total: (count: number) =>
        count === 0
          ? 'Aún no tienes ningún archivo.'
          : count === 1
            ? 'Tienes **1 archivo** en total.'
            : `Tienes **${count} archivos** en total.`,
      byType: (type: string, count: number) => `• ${type.toUpperCase()}: ${count}`,
      breakdown: 'Aquí está el desglose por tipo:',
    },
  },
  FOLDER_PATH: {
    en: {
      found: (name: string, path: string) =>
        `The folder "**${name}**" is located at:\n\n\`${path}\``,
      notFound: (name: string) =>
        `I couldn't find a folder named "${name}". Would you like me to search for something similar?`,
    },
    pt: {
      found: (name: string, path: string) =>
        `A pasta "**${name}**" está localizada em:\n\n\`${path}\``,
      notFound: (name: string) =>
        `Não encontrei uma pasta chamada "${name}". Quer que eu procure algo similar?`,
    },
    es: {
      found: (name: string, path: string) =>
        `La carpeta "**${name}**" está ubicada en:\n\n\`${path}\``,
      notFound: (name: string) =>
        `No encontré una carpeta llamada "${name}". ¿Quieres que busque algo similar?`,
    },
  },
  RECENT_ACTIVITY: {
    en: {
      intro: (count: number) =>
        count === 0
          ? 'No recent activity found.'
          : `Here's your recent activity (${count} files):`,
      item: (name: string, action: string, date: string) =>
        `• **${name}** - ${action} on ${date}`,
      uploaded: 'uploaded',
      modified: 'modified',
    },
    pt: {
      intro: (count: number) =>
        count === 0
          ? 'Nenhuma atividade recente encontrada.'
          : `Aqui está sua atividade recente (${count} arquivos):`,
      item: (name: string, action: string, date: string) =>
        `• **${name}** - ${action} em ${date}`,
      uploaded: 'enviado',
      modified: 'modificado',
    },
    es: {
      intro: (count: number) =>
        count === 0
          ? 'No se encontró actividad reciente.'
          : `Aquí está tu actividad reciente (${count} archivos):`,
      item: (name: string, action: string, date: string) =>
        `• **${name}** - ${action} el ${date}`,
      uploaded: 'subido',
      modified: 'modificado',
    },
  },
  METADATA: {
    en: {
      found: (name: string) => `Here's the information for "**${name}**":`,
      notFound: (name: string) =>
        `I couldn't find a file named "${name}". Please check the file name and try again.`,
      size: 'Size',
      type: 'Type',
      created: 'Created',
      modified: 'Last modified',
      location: 'Location',
    },
    pt: {
      found: (name: string) => `Aqui estão as informações de "**${name}**":`,
      notFound: (name: string) =>
        `Não encontrei um arquivo chamado "${name}". Verifique o nome e tente novamente.`,
      size: 'Tamanho',
      type: 'Tipo',
      created: 'Criado',
      modified: 'Última modificação',
      location: 'Localização',
    },
    es: {
      found: (name: string) => `Aquí está la información de "**${name}**":`,
      notFound: (name: string) =>
        `No encontré un archivo llamado "${name}". Verifica el nombre e intenta de nuevo.`,
      size: 'Tamaño',
      type: 'Tipo',
      created: 'Creado',
      modified: 'Última modificación',
      location: 'Ubicación',
    },
  },
  GREETING: {
    en: [
      'Hello! How can I help you today?',
      'Hi there! What would you like to know about your documents?',
      'Hey! I\'m ready to help. What can I do for you?',
      'Hello! Feel free to ask me anything about your files.',
    ],
    pt: [
      'Olá! Como posso ajudar você hoje?',
      'Oi! O que você gostaria de saber sobre seus documentos?',
      'E aí! Estou pronto para ajudar. O que posso fazer por você?',
      'Olá! Pode me perguntar qualquer coisa sobre seus arquivos.',
    ],
    es: [
      '¡Hola! ¿Cómo puedo ayudarte hoy?',
      '¡Hola! ¿Qué te gustaría saber sobre tus documentos?',
      '¡Hey! Estoy listo para ayudar. ¿Qué puedo hacer por ti?',
      '¡Hola! Siéntete libre de preguntarme sobre tus archivos.',
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Date Formatting
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(date: Date, language: 'en' | 'pt' | 'es'): string {
  const locales = {
    en: 'en-US',
    pt: 'pt-BR',
    es: 'es-ES',
  };

  return date.toLocaleDateString(locales[language], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Response Generators (No LLM Required)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate response for FILE_LIST intent
 * UPDATED: Uses numbered list format with "Pasta:" for folder path
 * Format: "1. **Filename.pdf**    Pasta: Folder / Subfolder"
 * This format is parsed by frontend's parseDocumentListingFormat()
 */
function generateFileListResponse(
  data: FileListData,
  language: 'en' | 'pt' | 'es'
): string {
  const t = RESPONSE_TEMPLATES.FILE_LIST[language];
  const folderLabel = language === 'pt' ? 'Pasta' : language === 'es' ? 'Carpeta' : 'Folder';

  if (data.files.length === 0) {
    return t.empty;
  }

  const lines: string[] = [t.intro(data.files.length, data.hasMore)];
  lines.push(''); // Empty line after intro

  // Use numbered list format with "Pasta:" for frontend parsing
  data.files.forEach((file, idx) => {
    // Format folder path: "/Work/Projects" → "Work / Projects"
    let folderPath = file.folderPath || 'Root';
    if (folderPath.startsWith('/')) {
      folderPath = folderPath.substring(1);
    }
    folderPath = folderPath.replace(/\//g, ' / ') || 'Root';

    // Format: "1. **Name**    Pasta: Path"
    lines.push(`${idx + 1}. **${file.filename}**    ${folderLabel}: ${folderPath}`);
  });

  // Add LOAD_MORE comment for frontend to render "See all X" link
  if (data.hasMore && data.totalCount > data.files.length) {
    lines.push('');
    lines.push(`<!-- LOAD_MORE:${data.totalCount} -->`);
  }

  return lines.join('\n');
}

/**
 * Generate response for FILE_COUNT intent
 */
function generateFileCountResponse(
  data: FileCountData,
  language: 'en' | 'pt' | 'es'
): string {
  const t = RESPONSE_TEMPLATES.FILE_COUNT[language];

  const lines: string[] = [t.total(data.totalCount)];

  if (data.byType && Object.keys(data.byType).length > 1) {
    lines.push('');
    lines.push(t.breakdown);
    for (const [type, count] of Object.entries(data.byType)) {
      lines.push(t.byType(type, count));
    }
  }

  return lines.join('\n');
}

/**
 * Generate response for FOLDER_PATH_QUERY intent
 */
function generateFolderPathResponse(
  data: FolderPathData,
  language: 'en' | 'pt' | 'es'
): string {
  const t = RESPONSE_TEMPLATES.FOLDER_PATH[language];

  if (data.found && data.path) {
    return t.found(data.folderName, data.path);
  }

  return t.notFound(data.folderName);
}

/**
 * Generate response for RECENT_ACTIVITY intent
 */
function generateRecentActivityResponse(
  data: RecentActivityData,
  language: 'en' | 'pt' | 'es'
): string {
  const t = RESPONSE_TEMPLATES.RECENT_ACTIVITY[language];

  if (data.files.length === 0) {
    return t.intro(0);
  }

  const lines: string[] = [t.intro(data.files.length)];

  for (const file of data.files) {
    const action = file.action === 'uploaded' ? t.uploaded : t.modified;
    const date = formatDate(file.timestamp, language);
    lines.push(t.item(file.filename, action, date));
  }

  return lines.join('\n');
}

/**
 * Generate response for METADATA_QUERY intent
 */
function generateMetadataResponse(
  data: MetadataData,
  language: 'en' | 'pt' | 'es'
): string {
  const t = RESPONSE_TEMPLATES.METADATA[language];

  if (!data.found || !data.metadata) {
    return t.notFound(data.fileName);
  }

  const m = data.metadata;
  // Extract friendly type from mimeType (e.g., "application/pdf" -> "PDF")
  const friendlyType = m.mimeType.split('/').pop()?.toUpperCase() || m.mimeType;
  const lines: string[] = [
    t.found(m.filename),
    '',
    `• **${t.type}**: ${friendlyType}`,
    `• **${t.size}**: ${m.sizeFormatted}`,
    `• **${t.location}**: ${m.folderPath}`,
    `• **${t.created}**: ${formatDate(m.createdAt, language)}`,
    `• **${t.modified}**: ${formatDate(m.updatedAt, language)}`,
  ];

  return lines.join('\n');
}

/**
 * Generate response for GREETING intent
 */
function generateGreetingResponse(language: 'en' | 'pt' | 'es'): string {
  const greetings = RESPONSE_TEMPLATES.GREETING[language];
  const randomIndex = Math.floor(Math.random() * greetings.length);
  return greetings[randomIndex];
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a direct response without LLM (for structured data)
 */
export function generateDirectResponse(
  intent: FastPathIntentType,
  data: unknown,
  language: 'en' | 'pt' | 'es'
): GeneratedResponse {
  const startTime = Date.now();
  let text: string;

  switch (intent) {
    case 'FILE_LIST':
      text = generateFileListResponse(data as FileListData, language);
      break;

    case 'FILE_COUNT':
      text = generateFileCountResponse(data as FileCountData, language);
      break;

    case 'FOLDER_PATH_QUERY':
      text = generateFolderPathResponse(data as FolderPathData, language);
      break;

    case 'RECENT_ACTIVITY':
      text = generateRecentActivityResponse(data as RecentActivityData, language);
      break;

    case 'METADATA_QUERY':
      text = generateMetadataResponse(data as MetadataData, language);
      break;

    case 'GREETING':
      text = generateGreetingResponse(language);
      break;

    default:
      text = '';
  }

  return {
    text,
    generatedWithoutLLM: true,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Generate a micro-prompt for LLM (when direct response isn't sufficient)
 * Used for SIMPLE_FACT intent or when data needs interpretation
 */
export function generateMicroPrompt(
  intent: FastPathIntentType,
  query: string,
  data: unknown,
  language: 'en' | 'pt' | 'es'
): MicroPromptResult {
  const languageNames = {
    en: 'English',
    pt: 'Portuguese',
    es: 'Spanish',
  };

  const systemInstruction = `You are a helpful document assistant. Respond concisely in ${languageNames[language]}.
Keep responses under 100 words. Be direct and helpful.`;

  let prompt: string;
  let maxTokens = 150;
  let temperature = 0.3;

  switch (intent) {
    case 'SIMPLE_FACT':
      prompt = `User question: "${query}"

Available data:
${JSON.stringify(data, null, 2)}

Provide a brief, direct answer based on the data above.`;
      maxTokens = 200;
      break;

    default:
      prompt = `User: "${query}"
Data: ${JSON.stringify(data)}
Respond naturally and concisely.`;
      maxTokens = 150;
  }

  return {
    prompt,
    systemInstruction,
    maxTokens,
    temperature,
    expectedResponseTime: 500, // ms for micro-prompt
  };
}

/**
 * Check if intent can be handled with direct response (no LLM)
 */
export function canGenerateDirectResponse(intent: FastPathIntentType): boolean {
  const directIntents: FastPathIntentType[] = [
    'FILE_LIST',
    'FILE_COUNT',
    'FOLDER_PATH_QUERY',
    'RECENT_ACTIVITY',
    'METADATA_QUERY',
    'GREETING',
  ];

  return directIntents.includes(intent);
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export default {
  generateDirectResponse,
  generateMicroPrompt,
  canGenerateDirectResponse,
};
