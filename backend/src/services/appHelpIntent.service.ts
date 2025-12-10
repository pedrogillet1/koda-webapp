/**
 * App Help Intent Service
 *
 * Detects queries about how to use the Koda app.
 * Matches queries to knowledge base articles.
 *
 * Intent Types:
 * - HOME_SCREEN: Questions about the home/dashboard
 * - DOCUMENTS_SCREEN: Questions about document management
 * - UPLOAD_SCREEN: Questions about uploading files
 * - CHAT_SCREEN: Questions about the chat interface
 * - SETTINGS_SCREEN: Questions about settings
 */

import * as fs from 'fs';
import * as path from 'path';
import { detectLanguageSimple } from './languageEngine.service';

export type AppHelpIntentType =
  | 'HOME_SCREEN'
  | 'DOCUMENTS_SCREEN'
  | 'UPLOAD_SCREEN'
  | 'CHAT_SCREEN'
  | 'SETTINGS_SCREEN'
  | 'NONE';

export interface AppHelpIntent {
  type: AppHelpIntentType;
  confidence: number;
  language: string;
}

// ============================================================================
// KEYWORD PATTERNS FOR INTENT DETECTION
// ============================================================================

interface IntentKeywords {
  en: string[];
  pt: string[];
  es: string[];
  fr: string[];
}

const HOME_SCREEN_KEYWORDS: IntentKeywords = {
  en: ['home', 'dashboard', 'main screen', 'start page', 'landing', 'overview'],
  pt: ['inicio', 'pagina inicial', 'tela inicial', 'painel', 'dashboard', 'visao geral'],
  es: ['inicio', 'pagina principal', 'pantalla inicial', 'panel', 'dashboard'],
  fr: ['accueil', 'page principale', 'tableau de bord', 'ecran principal'],
};

const DOCUMENTS_SCREEN_KEYWORDS: IntentKeywords = {
  en: ['documents', 'files', 'my files', 'file manager', 'document list', 'browse files'],
  pt: ['documentos', 'arquivos', 'meus arquivos', 'gerenciador', 'lista de documentos'],
  es: ['documentos', 'archivos', 'mis archivos', 'gestor', 'lista de documentos'],
  fr: ['documents', 'fichiers', 'mes fichiers', 'gestionnaire', 'liste des documents'],
};

const UPLOAD_SCREEN_KEYWORDS: IntentKeywords = {
  en: ['upload', 'add file', 'import', 'drag and drop', 'attach', 'send file'],
  pt: ['upload', 'enviar arquivo', 'carregar', 'importar', 'anexar', 'adicionar arquivo'],
  es: ['subir', 'cargar archivo', 'importar', 'adjuntar', 'agregar archivo'],
  fr: ['telecharger', 'envoyer fichier', 'importer', 'joindre', 'ajouter fichier'],
};

const CHAT_SCREEN_KEYWORDS: IntentKeywords = {
  en: ['chat', 'conversation', 'ask', 'talk', 'message', 'query', 'question'],
  pt: ['chat', 'conversa', 'perguntar', 'falar', 'mensagem', 'consulta'],
  es: ['chat', 'conversacion', 'preguntar', 'hablar', 'mensaje', 'consulta'],
  fr: ['chat', 'conversation', 'demander', 'parler', 'message', 'question'],
};

const SETTINGS_SCREEN_KEYWORDS: IntentKeywords = {
  en: ['settings', 'preferences', 'options', 'configure', 'account', 'profile'],
  pt: ['configuracoes', 'preferencias', 'opcoes', 'configurar', 'conta', 'perfil'],
  es: ['configuracion', 'preferencias', 'opciones', 'configurar', 'cuenta', 'perfil'],
  fr: ['parametres', 'preferences', 'options', 'configurer', 'compte', 'profil'],
};

// Map screen keywords to help questions
const HELP_QUESTION_PATTERNS: Record<string, RegExp[]> = {
  en: [
    /how\s+(do\s+i|to|can\s+i)/i,
    /what\s+(is|are|does)/i,
    /where\s+(is|can\s+i|do\s+i)/i,
    /help\s+(me\s+)?(with|about|understand)/i,
    /explain\s+(the|how)/i,
    /tell\s+me\s+(about|how)/i,
  ],
  pt: [
    /como\s+(eu\s+)?(posso|faco|uso)/i,
    /o\s+que\s+[eé]/i,
    /onde\s+(fica|posso|esta)/i,
    /ajuda\s+(com|sobre)/i,
    /explica\s+(o|como)/i,
    /me\s+(fala|conta)\s+sobre/i,
  ],
  es: [
    /c[oó]mo\s+(puedo|hago|uso)/i,
    /qu[eé]\s+es/i,
    /d[oó]nde\s+(est[aá]|puedo)/i,
    /ayuda\s+(con|sobre)/i,
    /explica\s+(el|c[oó]mo)/i,
  ],
  fr: [
    /comment\s+(puis-?je|faire|utiliser)/i,
    /qu'?est-?ce\s+que/i,
    /o[uù]\s+(est|puis-?je)/i,
    /aide\s+(avec|sur)/i,
    /explique\s+(le|comment)/i,
  ],
};

// ============================================================================
// KNOWLEDGE BASE
// ============================================================================

const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../../knowledge_base');

// In-memory fallback content if files don't exist
const FALLBACK_CONTENT: Record<AppHelpIntentType, string> = {
  HOME_SCREEN: `# Home Screen Guide

The home screen is your central hub for quick access to all features.

**Key Features:**
- Quick document search
- Recent documents list
- Storage usage overview
- Quick actions menu

Navigate using the sidebar to access other areas of the app.`,

  DOCUMENTS_SCREEN: `# Documents Screen Guide

The documents screen lets you manage all your uploaded files.

**Key Features:**
- Create and organize folders
- View document details
- Search within documents
- Sort and filter options

Click any document to view its contents or ask questions about it.`,

  UPLOAD_SCREEN: `# Upload Guide

Upload your documents to start asking questions about them.

**Supported Formats:**
- PDF documents
- Word documents (.docx)
- Excel spreadsheets (.xlsx)
- PowerPoint presentations (.pptx)
- Images (PNG, JPG)
- Text files

**How to Upload:**
1. Click the upload button or drag files into the upload area
2. Select destination folder
3. Wait for processing to complete`,

  CHAT_SCREEN: `# Chat Guide

The chat is where you interact with your documents using natural language.

**Key Features:**
- Ask questions about your documents
- Get cited answers with sources
- Start new conversations
- View conversation history

**Tips:**
- Be specific in your questions
- Reference document names for targeted queries
- Use follow-up questions to dig deeper`,

  SETTINGS_SCREEN: `# Settings Guide

Customize your Koda experience in the settings area.

**Available Settings:**
- Profile information
- Language preferences
- Notification settings
- Account management
- Security options

Access settings from the sidebar or user menu.`,

  NONE: '',
};

function loadKnowledgeBaseContent(intentType: AppHelpIntentType): string | null {
  if (intentType === 'NONE') return null;

  const fileMap: Record<AppHelpIntentType, string> = {
    HOME_SCREEN: 'home_screen.md',
    DOCUMENTS_SCREEN: 'documents_screen.md',
    UPLOAD_SCREEN: 'upload_screen.md',
    CHAT_SCREEN: 'chat_screen.md',
    SETTINGS_SCREEN: 'settings_screen.md',
    NONE: '',
  };

  const filename = fileMap[intentType];
  if (!filename) return null;

  const filepath = path.join(KNOWLEDGE_BASE_PATH, filename);

  try {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf-8');
    }
  } catch (error) {
    console.error(`[APP-HELP] Error reading knowledge base file ${filename}:`, error);
  }

  // Return fallback content
  return FALLBACK_CONTENT[intentType] || null;
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect language from query - uses centralized language engine
 * @deprecated Use detectLanguageSimple directly from languageEngine.service.ts
 */
function detectLanguage(query: string): string {
  const detected = detectLanguageSimple(query, 'pt-BR');
  // Map SupportedLanguage to legacy format
  if (detected === 'pt-BR') return 'pt';
  return detected;
}

function isHelpQuestion(query: string, language: string): boolean {
  const patterns = HELP_QUESTION_PATTERNS[language] || HELP_QUESTION_PATTERNS.en;

  for (const pattern of patterns) {
    if (pattern.test(query)) return true;
  }

  // Also check other languages
  for (const [lang, langPatterns] of Object.entries(HELP_QUESTION_PATTERNS)) {
    if (lang === language) continue;
    for (const pattern of langPatterns) {
      if (pattern.test(query)) return true;
    }
  }

  return false;
}

function countKeywordMatches(query: string, keywords: IntentKeywords): number {
  const lowerQuery = query.toLowerCase();
  let count = 0;

  for (const langKeywords of Object.values(keywords)) {
    for (const keyword of langKeywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Quick check if query might be an app help intent
 */
export function mightBeAppHelpIntent(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Skip very long queries
  if (lowerQuery.length > 150) return false;

  // Help keywords
  const helpIndicators = [
    'how', 'what', 'where', 'help', 'explain', 'guide',
    'como', 'onde', 'ajuda', 'explica',
    'como', 'donde', 'ayuda', 'explica',
    'comment', 'ou', 'aide', 'explique',
  ];

  // Screen keywords
  const screenIndicators = [
    'screen', 'page', 'section', 'area',
    'tela', 'pagina', 'secao',
    'pantalla', 'pagina', 'seccion',
    'ecran', 'page', 'section',
  ];

  const hasHelpWord = helpIndicators.some((w) => lowerQuery.includes(w));
  const hasScreenWord = screenIndicators.some((w) => lowerQuery.includes(w));

  return hasHelpWord || hasScreenWord;
}

/**
 * Detect app help intent from query
 */
export function detectAppHelpIntent(query: string): AppHelpIntent {
  const normalizedQuery = query.trim();
  const language = detectLanguage(normalizedQuery);

  // Check if this is a help question
  const isHelp = isHelpQuestion(normalizedQuery, language);
  if (!isHelp) {
    return { type: 'NONE', confidence: 0, language };
  }

  // Count keyword matches for each intent
  const scores: Record<AppHelpIntentType, number> = {
    HOME_SCREEN: countKeywordMatches(normalizedQuery, HOME_SCREEN_KEYWORDS),
    DOCUMENTS_SCREEN: countKeywordMatches(normalizedQuery, DOCUMENTS_SCREEN_KEYWORDS),
    UPLOAD_SCREEN: countKeywordMatches(normalizedQuery, UPLOAD_SCREEN_KEYWORDS),
    CHAT_SCREEN: countKeywordMatches(normalizedQuery, CHAT_SCREEN_KEYWORDS),
    SETTINGS_SCREEN: countKeywordMatches(normalizedQuery, SETTINGS_SCREEN_KEYWORDS),
    NONE: 0,
  };

  // Find best match
  let bestIntent: AppHelpIntentType = 'NONE';
  let bestScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as AppHelpIntentType;
    }
  }

  // Calculate confidence based on score
  const confidence = bestScore > 0 ? Math.min(0.5 + bestScore * 0.15, 0.9) : 0;

  return {
    type: bestIntent,
    confidence,
    language,
  };
}

/**
 * Get knowledge base content for an intent
 */
export function getKnowledgeBaseContent(intent: AppHelpIntent): string | null {
  return loadKnowledgeBaseContent(intent.type);
}

export default {
  detectAppHelpIntent,
  getKnowledgeBaseContent,
  mightBeAppHelpIntent,
};
