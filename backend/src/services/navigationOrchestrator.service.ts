/**
 * Navigation Orchestrator Service
 * 
 * The brain for navigation & app help questions.
 * 
 * Handles:
 * 1. File navigation - "Where is the mezzanine file?"
 * 2. Folder navigation - "How many folders do I have?"
 * 3. App help - "Where do I upload?"
 * 
 * Returns natural, adaptive answers with exact file paths and UI guidance.
 */

import { generateAdaptiveAnswer as generateAnswer, type GeneratedAnswer } from './answerGenerator.service';
import { searchFilesByNameOrContent, listFilesInFolderPath, FileRecord } from './fileNavigationEngine.service';
import { answerAppHelpQuestion } from './appHelpEngine.service';

/**
 * Wrapper for backward compatibility with old generateAdaptiveAnswer interface
 */
async function generateAdaptiveAnswer(params: {
  query: string;
  context: string;
  language: string;
  responseType?: string;
}): Promise<{ answer: string }> {
  const result = await generateAnswer({
    query: params.query,
    context: params.context,
    languageCode: params.language,
    answerType: params.responseType || 'simple',
  });
  return { answer: result.text };
}

export interface NavigationRequest {
  query: string;
  userId: string;
  conversationId?: string;
  detectedLanguage: string; // 'pt-BR', 'en', etc.
}

export interface NavigationResponse {
  handled: boolean;              // false → let RAG handle
  answer?: string;               // markdown answer ready to format
  answerType?: 'file_navigation' | 'folder_navigation' | 'app_help';
  relatedFiles?: Array<{
    id: string;
    filename: string;
    folderPath: string;          // "Root / Projects / Mezzanine"
    mimeType: string;
    sizeBytes: number;
    uploadedAt?: Date;
    movedAt?: Date | null;
  }>;
  diagnostics?: Record<string, any>;
}

type NavIntent = 'file_navigation' | 'folder_navigation' | 'app_help' | 'none';

/**
 * Detect if query is about navigation or app help
 */
function detectNavigationIntent(query: string): NavIntent {
  const q = query.toLowerCase();

  // File/folder navigation keywords (Portuguese + English)
  const fileKeywords = [
    // Portuguese
    'onde está', 'onde fica', 'em qual pasta', 'em que pasta',
    'qual pasta', 'quais arquivos', 'listar arquivos', 'listar documentos',
    'em que categoria', 'mostrar documentos', 'mostrar arquivos',
    'quantos arquivos', 'quantas pastas', 'quantos documentos',
    'arquivo do', 'documento do', 'pasta do',
    // English
    'where is', 'where are', 'which folder', 'what folder',
    'list files', 'list documents', 'show files', 'show documents',
    'how many files', 'how many folders', 'how many documents',
    'folder', 'directory', 'path', 'location'
  ];

  for (const keyword of fileKeywords) {
    if (q.includes(keyword)) {
      return 'file_navigation';
    }
  }

  // App help keywords (Portuguese + English)
  const appHelpKeywords = [
    // Portuguese
    'onde eu faço upload', 'como faço upload', 'como subir arquivo',
    'como enviar documento', 'onde vejo meus documentos',
    'como crio uma categoria', 'como criar uma pasta',
    'onde está o botão', 'como usar', 'como funciona',
    'onde encontro', 'como acesso', 'onde fica o menu',
    // English
    'how do i upload', 'where do i upload', 'how to upload',
    'how do i create a folder', 'how to create a category',
    'where can i see my documents', 'where is the button',
    'how do i use', 'how does it work', 'where do i find',
    'how do i access', 'where is the menu'
  ];

  for (const keyword of appHelpKeywords) {
    if (q.includes(keyword)) {
      return 'app_help';
    }
  }

  return 'none';
}

/**
 * Main entry point: handle navigation or app help questions
 */
export async function handleNavigationOrAppHelp(
  req: NavigationRequest
): Promise<NavigationResponse> {
  const startTime = Date.now();
  
  // Step 1: Detect intent
  const intent = detectNavigationIntent(req.query);

  console.log(`[NavOrchestrator] Intent: ${intent} (${Date.now() - startTime}ms)`);

  if (intent === 'none') {
    return { handled: false };
  }

  // Step 2: Route to app help
  if (intent === 'app_help') {
    console.log(`[NavOrchestrator] Routing to app help engine...`);
    
    const answer = await answerAppHelpQuestion({
      query: req.query,
      language: req.detectedLanguage,
    });

    console.log(`[NavOrchestrator] App help answer generated (${Date.now() - startTime}ms)`);

    return {
      handled: true,
      answerType: 'app_help',
      answer,
      diagnostics: {
        intent,
        latencyMs: Date.now() - startTime
      }
    };
  }

  // Step 3: Handle file/folder navigation
  if (intent === 'file_navigation' || intent === 'folder_navigation') {
    console.log(`[NavOrchestrator] Searching files for user ${req.userId}...`);
    
    // Search by filename, microSummary, displayTitle
    const files = await searchFilesByNameOrContent({
      userId: req.userId,
      query: req.query,
      limit: 10,
    });

    console.log(`[NavOrchestrator] Found ${files.length} files (${Date.now() - startTime}ms)`);

    // Step 4: No files found
    if (!files || files.length === 0) {
      const context = buildNoFilesFoundContext(req);
      
      const llm = await generateAdaptiveAnswer({
        query: req.query,
        context,
        language: req.detectedLanguage,
        responseType: 'simple',
      });

      return {
        handled: true,
        answerType: 'file_navigation',
        answer: llm.answer,
        relatedFiles: [],
        diagnostics: {
          intent,
          fileCount: 0,
          latencyMs: Date.now() - startTime
        }
      };
    }

    // Step 5: Files found - build structured context
    const context = buildFileNavigationContext(req, files);
    
    console.log(`[NavOrchestrator] Generating adaptive answer...`);
    
    const llm = await generateAdaptiveAnswer({
      query: req.query,
      context,
      language: req.detectedLanguage,
      responseType: 'simple',
    });

    console.log(`[NavOrchestrator] Answer generated (${Date.now() - startTime}ms)`);

    return {
      handled: true,
      answerType: 'file_navigation',
      answer: llm.answer,
      relatedFiles: files.map(f => ({
        id: f.id,
        filename: f.filename,
        folderPath: f.folderPath,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        uploadedAt: f.uploadedAt,
        movedAt: f.movedAt,
      })),
      diagnostics: {
        intent,
        fileCount: files.length,
        latencyMs: Date.now() - startTime
      },
    };
  }

  return { handled: false };
}

/**
 * Build context when no files are found
 */
function buildNoFilesFoundContext(req: NavigationRequest): string {
  return `
[FILE SEARCH RESULT]

No documents found matching the user's query:
"${req.query}"

TASK:
- Answer in ${req.detectedLanguage}.
- Explain gently that you didn't find any matching documents.
- Suggest the user to:
  - Check if the document was uploaded.
  - Try using different keywords or the document name.
  - Check the Knowledge Hub / My Documents page to browse all files.
- Be helpful and friendly, not robotic.
`;
}

/**
 * Build structured context for file navigation
 */
function buildFileNavigationContext(req: NavigationRequest, files: FileRecord[]): string {
  // Build file list with all metadata
  const fileLines = files.map((f, index) => {
    const uploadedStr = f.uploadedAt 
      ? formatDate(f.uploadedAt, req.detectedLanguage)
      : 'unknown';
    
    const movedStr = f.movedAt 
      ? formatDate(f.movedAt, req.detectedLanguage)
      : 'never moved';

    return `
${index + 1}) ID: ${f.id}
   Filename: ${f.filename}
   Folder path: ${f.folderPath}
   Uploaded at: ${uploadedStr}
   Moved to current folder at: ${movedStr}
   Mime type: ${f.mimeType}
   Size: ${formatFileSize(f.sizeBytes)}
`;
  }).join('\n');

  // Build document markers for frontend rendering
  const docMarkers = files.map(f =>
    `{{DOC:::${f.id}:::${f.filename}:::${f.mimeType}:::${f.sizeBytes}:::}}`
  ).join('\n');

  return `
[INTERNAL FILE CONTEXT]

User language: ${req.detectedLanguage}
Original query: "${req.query}"

We found these files for this user:

${fileLines}

TASK FOR THE MODEL:

- Answer in ${req.detectedLanguage} ONLY.
- Sound natural, friendly, and concise.
- First, explain which file(s) are most likely to match the user's request.
- For each relevant file:
  - Show the filename in **bold**.
  - Then show the folder path in a new line, like:
    "Location: My Documents / Projects / Mezzanine / Financial"
  - If available, mention when it was uploaded and when it was moved to the current folder.
- If there are multiple similar files, ask which one the user wants to open.
- At the END of the answer, include the following special markers (one per line)
  so that the frontend can render clickable documents:

${docMarkers}

Do NOT explain the markers. They are just for the UI.
`;
}

/**
 * Format date based on language
 */
function formatDate(date: Date, language: string): string {
  const locale = language === 'pt' || language === 'pt-BR' ? 'pt-BR' : 'en-US';
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Convenience function for quick testing
 */
export async function testNavigationOrchestrator(query: string, userId: string, language: string = 'pt-BR') {
  const result = await handleNavigationOrAppHelp({
    query,
    userId,
    detectedLanguage: language
  });
  
  console.log('\n=== Navigation Orchestrator Test ===');
  console.log('Query:', query);
  console.log('Handled:', result.handled);
  console.log('Answer Type:', result.answerType);
  console.log('Related Files:', result.relatedFiles?.length || 0);
  console.log('Diagnostics:', result.diagnostics);
  console.log('\nAnswer:');
  console.log(result.answer);
  console.log('===================================\n');
  
  return result;
}
