/**
 * Dynamic Response Generator Service
 * Generates natural, context-aware responses for file actions using LLM
 *
 * PURPOSE: Replace hardcoded templates with dynamic, intelligent responses
 * WHY: Provides more natural, context-aware messaging that adapts to user queries
 * IMPACT: Responses feel more conversational and less robotic
 *
 * Features:
 * - LLM-based response generation
 * - Multilanguage support (EN, PT, ES, FR)
 * - Context-aware messaging
 * - Fallback to templates on LLM failure
 * - Consistent formatting and tone
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini (same as other services in this project)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ResponseContext {
  action: 'create_folder' | 'move_file' | 'rename_file' | 'delete_file' | 'show_file' | 'show_folder';
  success: boolean;
  language: 'en' | 'pt' | 'es' | 'fr';
  details: {
    filename?: string;
    folderName?: string;
    oldName?: string;
    newName?: string;
    targetFolder?: string;
    errorMessage?: string;
    fileCount?: number;
    subfolderCount?: number;
    matchCount?: number;
  };
  userQuery?: string; // Original user query for better context
}

/**
 * Generate dynamic response using LLM
 * Falls back to template if LLM fails
 */
export async function generateDynamicResponse(context: ResponseContext): Promise<string> {
  try {
    // For simple confirmations, use templates directly (faster, cheaper)
    // Only use LLM for complex/error cases where natural language helps
    if (context.success && !context.details.errorMessage) {
      return getFallbackResponse(context);
    }

    const prompt = buildPrompt(context);
    const systemPrompt = getSystemPrompt(context.language);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150,
      }
    });

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: prompt }
    ]);

    const response = result.response.text()?.trim();

    if (!response) {
      console.warn('[DynamicResponse] Empty response from LLM, using fallback');
      return getFallbackResponse(context);
    }

    return response;
  } catch (error) {
    console.error('[DynamicResponse] Error generating response:', error);
    return getFallbackResponse(context);
  }
}

/**
 * Build prompt for LLM based on action context
 */
function buildPrompt(context: ResponseContext): string {
  const { action, success, details, userQuery } = context;

  if (!success) {
    // Error responses
    if (details.errorMessage) {
      return `Generate a helpful error message. The user tried to ${action.replace('_', ' ')} but encountered this error: ${details.errorMessage}`;
    }

    if (action === 'show_file' && details.filename) {
      return `The user asked to see "${details.filename}" but it wasn't found. Generate a polite message suggesting they check the filename.`;
    }

    if (action === 'create_folder' && details.folderName) {
      return `The user tried to create folder "${details.folderName}" but it already exists. Generate a brief message informing them.`;
    }

    return `Generate a brief error message for failed ${action.replace('_', ' ')} operation.`;
  }

  // Success responses
  switch (action) {
    case 'create_folder':
      return `The user created a new folder named "${details.folderName}". Generate a brief, friendly confirmation message.`;

    case 'move_file':
      return `The user moved file "${details.filename}" to folder "${details.targetFolder}". Generate a brief confirmation message.`;

    case 'rename_file':
      return `The user renamed file from "${details.oldName}" to "${details.newName}". Generate a brief confirmation message.`;

    case 'delete_file':
      return `The user deleted file "${details.filename}". Generate a brief confirmation message.`;

    case 'show_file':
      if (details.matchCount && details.matchCount > 1) {
        return `Found ${details.matchCount} files matching "${details.filename}". Generate a message asking which one they want to see.`;
      }
      return `Generate a brief message introducing the file "${details.filename}" to the user.`;

    case 'show_folder':
      return `Show folder "${details.folderName}" with ${details.fileCount || 0} files and ${details.subfolderCount || 0} subfolders. Generate a brief introduction.`;

    default:
      return `Generate a brief confirmation message for successful ${(action as string).replace('_', ' ')} operation.`;
  }
}

/**
 * Get system prompt based on language
 */
function getSystemPrompt(language: string): string {
  const basePrompt: Record<string, string> = {
    en: `You are Koda, an AI document assistant. Generate brief, professional responses for file operations.

Rules:
- Keep responses under 20 words
- Be friendly but professional
- Use **bold** for file/folder names
- No emojis
- No bullet points or lists
- Direct, clear language
- Match the tone: helpful and efficient`,

    pt: `Você é Koda, um assistente de documentos com IA. Gere respostas breves e profissionais para operações de arquivos.

Regras:
- Mantenha respostas com menos de 20 palavras
- Seja amigável mas profissional
- Use **negrito** para nomes de arquivos/pastas
- Sem emojis
- Sem marcadores ou listas
- Linguagem direta e clara
- Tom: prestativo e eficiente`,

    es: `Eres Koda, un asistente de documentos con IA. Genera respuestas breves y profesionales para operaciones de archivos.

Reglas:
- Mantén respuestas bajo 20 palabras
- Sé amigable pero profesional
- Usa **negrita** para nombres de archivos/carpetas
- Sin emojis
- Sin viñetas o listas
- Lenguaje directo y claro
- Tono: servicial y eficiente`,

    fr: `Vous êtes Koda, un assistant de documents IA. Générez des réponses brèves et professionnelles pour les opérations de fichiers.

Règles:
- Gardez les réponses sous 20 mots
- Soyez amical mais professionnel
- Utilisez **gras** pour les noms de fichiers/dossiers
- Pas d'emojis
- Pas de puces ou de listes
- Langage direct et clair
- Ton: utile et efficace`
  };

  return basePrompt[language] || basePrompt.en;
}

/**
 * Fallback templates when LLM fails
 * Maintains the original hardcoded messages as backup
 */
function getFallbackResponse(context: ResponseContext): string {
  const { action, success, language, details } = context;

  const templates: Record<string, Record<string, string>> = {
    en: {
      create_folder_success: `Folder **${details.folderName}** created successfully.`,
      create_folder_exists: `Folder **${details.folderName}** already exists.`,
      move_file_success: `File **${details.filename}** moved to **${details.targetFolder}** successfully.`,
      rename_file_success: `File renamed from **${details.oldName}** to **${details.newName}** successfully.`,
      delete_file_success: `File **${details.filename}** deleted successfully.`,
      show_file: `Here's the file:`,
      show_folder: `Here's the **${details.folderName}** folder with ${details.fileCount || 0} file${(details.fileCount || 0) !== 1 ? 's' : ''} and ${details.subfolderCount || 0} subfolder${(details.subfolderCount || 0) !== 1 ? 's' : ''}.`,
      file_not_found: `I couldn't find a file named **${details.filename}**. Please check the name and try again.`,
      folder_not_found: `Folder **${details.folderName}** not found.`,
      multiple_files: `I found **${details.matchCount} files** matching "${details.filename}". Which one would you like to see?`,
      error: `An error occurred: ${details.errorMessage || 'Unknown error'}`
    },
    pt: {
      create_folder_success: `Pasta **${details.folderName}** criada com sucesso.`,
      create_folder_exists: `A pasta **${details.folderName}** já existe.`,
      move_file_success: `Arquivo **${details.filename}** movido para **${details.targetFolder}** com sucesso.`,
      rename_file_success: `Arquivo renomeado de **${details.oldName}** para **${details.newName}** com sucesso.`,
      delete_file_success: `Arquivo **${details.filename}** deletado com sucesso.`,
      show_file: `Aqui está o arquivo:`,
      show_folder: `Aqui está a pasta **${details.folderName}** com ${details.fileCount || 0} arquivo${(details.fileCount || 0) !== 1 ? 's' : ''} e ${details.subfolderCount || 0} subpasta${(details.subfolderCount || 0) !== 1 ? 's' : ''}.`,
      file_not_found: `Não consegui encontrar um arquivo chamado **${details.filename}**. Por favor, verifique o nome e tente novamente.`,
      folder_not_found: `Pasta **${details.folderName}** não encontrada.`,
      multiple_files: `Encontrei **${details.matchCount} arquivos** correspondentes a "${details.filename}". Qual deles você quer ver?`,
      error: `Ocorreu um erro: ${details.errorMessage || 'Erro desconhecido'}`
    },
    es: {
      create_folder_success: `Carpeta **${details.folderName}** creada exitosamente.`,
      create_folder_exists: `La carpeta **${details.folderName}** ya existe.`,
      move_file_success: `Archivo **${details.filename}** movido a **${details.targetFolder}** exitosamente.`,
      rename_file_success: `Archivo renombrado de **${details.oldName}** a **${details.newName}** exitosamente.`,
      delete_file_success: `Archivo **${details.filename}** eliminado exitosamente.`,
      show_file: `Aquí está el archivo:`,
      show_folder: `Aquí está la carpeta **${details.folderName}** con ${details.fileCount || 0} archivo${(details.fileCount || 0) !== 1 ? 's' : ''} y ${details.subfolderCount || 0} subcarpeta${(details.subfolderCount || 0) !== 1 ? 's' : ''}.`,
      file_not_found: `No pude encontrar un archivo llamado **${details.filename}**. Por favor, verifica el nombre e intenta de nuevo.`,
      folder_not_found: `Carpeta **${details.folderName}** no encontrada.`,
      multiple_files: `Encontré **${details.matchCount} archivos** que coinciden con "${details.filename}". ¿Cuál quieres ver?`,
      error: `Ocurrió un error: ${details.errorMessage || 'Error desconocido'}`
    },
    fr: {
      create_folder_success: `Dossier **${details.folderName}** créé avec succès.`,
      create_folder_exists: `Le dossier **${details.folderName}** existe déjà.`,
      move_file_success: `Fichier **${details.filename}** déplacé vers **${details.targetFolder}** avec succès.`,
      rename_file_success: `Fichier renommé de **${details.oldName}** à **${details.newName}** avec succès.`,
      delete_file_success: `Fichier **${details.filename}** supprimé avec succès.`,
      show_file: `Voici le fichier:`,
      show_folder: `Voici le dossier **${details.folderName}** avec ${details.fileCount || 0} fichier${(details.fileCount || 0) !== 1 ? 's' : ''} et ${details.subfolderCount || 0} sous-dossier${(details.subfolderCount || 0) !== 1 ? 's' : ''}.`,
      file_not_found: `Je n'ai pas pu trouver un fichier nommé **${details.filename}**. Veuillez vérifier le nom et réessayer.`,
      folder_not_found: `Dossier **${details.folderName}** introuvable.`,
      multiple_files: `J'ai trouvé **${details.matchCount} fichiers** correspondant à "${details.filename}". Lequel voulez-vous voir?`,
      error: `Une erreur s'est produite: ${details.errorMessage || 'Erreur inconnue'}`
    }
  };

  const langTemplates = templates[language] || templates.en;

  // Determine which template to use
  if (!success) {
    if (action === 'show_file' && details.matchCount && details.matchCount > 1) {
      return langTemplates.multiple_files;
    }
    if (action === 'show_file' && details.filename) {
      return langTemplates.file_not_found;
    }
    if (action === 'create_folder') {
      return langTemplates.create_folder_exists;
    }
    if (details.folderName) {
      return langTemplates.folder_not_found;
    }
    return langTemplates.error;
  }

  // Success cases
  switch (action) {
    case 'create_folder':
      return langTemplates.create_folder_success;
    case 'move_file':
      return langTemplates.move_file_success;
    case 'rename_file':
      return langTemplates.rename_file_success;
    case 'delete_file':
      return langTemplates.delete_file_success;
    case 'show_file':
      return langTemplates.show_file;
    case 'show_folder':
      return langTemplates.show_folder;
    default:
      return langTemplates.error;
  }
}

export default {
  generateDynamicResponse
};
