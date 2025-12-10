/**
 * App Help Engine Service
 *
 * Provides intelligent help responses about Koda's UI and features.
 * Uses a knowledge base of UI elements, features, and common tasks.
 */

import fs from 'fs';
import path from 'path';

// Knowledge base content type
interface HelpTopic {
  id: string;
  keywords: string[];
  title: string;
  content: string;
  category: 'navigation' | 'feature' | 'upload' | 'chat' | 'folders' | 'settings' | 'general';
  relatedTopics?: string[];
}

// Cache for loaded knowledge base
let knowledgeBaseCache: HelpTopic[] | null = null;
let knowledgeBaseLoaded = false;

/**
 * Built-in help topics (fallback if files not found)
 */
const BUILTIN_HELP_TOPICS: HelpTopic[] = [
  // Navigation
  {
    id: 'nav-sidebar',
    keywords: ['sidebar', 'menu', 'navigation', 'left', 'panel', 'barra lateral'],
    title: 'Sidebar Navigation',
    content: `The sidebar on the left side of the screen contains:
- **Chat**: Your AI assistant conversations
- **Documents**: Browse and manage uploaded files
- **Folders**: Organize documents into folders
- **Settings**: Account and app preferences

Click any icon to navigate to that section.`,
    category: 'navigation',
    relatedTopics: ['nav-documents', 'nav-folders']
  },
  {
    id: 'nav-documents',
    keywords: ['documents', 'files', 'browse', 'list', 'documentos', 'arquivos'],
    title: 'Documents Section',
    content: `The Documents section shows all your uploaded files:
- **List view**: See all documents with details
- **Grid view**: Visual preview of documents
- **Search**: Find documents by name or content
- **Sort**: Order by name, date, or type
- **Filter**: Show specific file types

Click a document to open it or ask questions about it.`,
    category: 'navigation',
    relatedTopics: ['upload-file', 'feature-search']
  },
  {
    id: 'nav-folders',
    keywords: ['folders', 'organize', 'directory', 'pastas', 'organizar'],
    title: 'Folders Section',
    content: `Organize your documents into folders:
- **Create folder**: Click the "+" button or "New Folder"
- **Move files**: Drag documents into folders or use the move option
- **Rename**: Right-click a folder to rename it
- **Delete**: Remove empty folders (documents move to root)

Folders help you keep related documents together.`,
    category: 'folders',
    relatedTopics: ['nav-documents']
  },

  // Uploads
  {
    id: 'upload-file',
    keywords: ['upload', 'add', 'import', 'carregar', 'enviar', 'adicionar'],
    title: 'Uploading Files',
    content: `To upload documents to Koda:
1. Click the **Upload** button in the top bar
2. Select files from your computer (or drag & drop)
3. Wait for processing to complete

**Supported formats**: PDF, Word (docx), Excel (xlsx), PowerPoint (pptx), Images (png, jpg), Text files

After upload, Koda automatically indexes the content for AI search.`,
    category: 'upload',
    relatedTopics: ['upload-formats', 'upload-multiple']
  },
  {
    id: 'upload-formats',
    keywords: ['format', 'type', 'pdf', 'word', 'excel', 'supported', 'formato', 'tipo'],
    title: 'Supported File Formats',
    content: `Koda supports these file types:
- **PDF**: .pdf (including scanned PDFs with OCR)
- **Word**: .docx, .doc
- **Excel**: .xlsx, .xls
- **PowerPoint**: .pptx, .ppt
- **Images**: .png, .jpg, .jpeg (with text extraction)
- **Text**: .txt, .md, .csv

Maximum file size: 50MB per file.`,
    category: 'upload',
    relatedTopics: ['upload-file']
  },
  {
    id: 'upload-multiple',
    keywords: ['multiple', 'batch', 'many', 'bulk', 'varios', 'multiplos'],
    title: 'Uploading Multiple Files',
    content: `Upload multiple files at once:
1. Click **Upload** and select multiple files (Ctrl+click)
2. Or drag and drop multiple files into the upload area
3. All files will be processed in parallel

You can upload up to 20 files at once. Large batches may take longer to process.`,
    category: 'upload',
    relatedTopics: ['upload-file']
  },

  // Chat Features
  {
    id: 'chat-ask',
    keywords: ['ask', 'question', 'chat', 'query', 'perguntar', 'pergunta'],
    title: 'Asking Questions',
    content: `Ask Koda questions about your documents:
1. Type your question in the chat box
2. Press Enter or click Send
3. Koda will search your documents and provide an answer

**Tips**:
- Be specific: "What is the ROI in the Q3 report?" vs "Tell me about ROI"
- Reference documents: "In the contract, what is the termination clause?"
- Ask follow-ups: Koda remembers the conversation context`,
    category: 'chat',
    relatedTopics: ['chat-context', 'feature-search']
  },
  {
    id: 'chat-context',
    keywords: ['context', 'conversation', 'history', 'remember', 'contexto', 'historico'],
    title: 'Conversation Context',
    content: `Koda remembers your conversation:
- **Follow-ups**: Ask "what about the risks?" after a question
- **References**: Say "in that same document" to continue analyzing
- **Clarifications**: Ask "can you explain that in simpler terms?"

The conversation history is saved and can be accessed later in the Chat section.`,
    category: 'chat',
    relatedTopics: ['chat-ask']
  },
  {
    id: 'chat-citations',
    keywords: ['citation', 'source', 'reference', 'where', 'citacao', 'fonte'],
    title: 'Citations and Sources',
    content: `Koda cites its sources:
- **Document name**: Shows which file the information came from
- **Click to open**: Click the citation to view the original document
- **Page reference**: When available, shows the specific page

Citations help you verify information and explore documents further.`,
    category: 'chat',
    relatedTopics: ['chat-ask']
  },

  // Features
  {
    id: 'feature-search',
    keywords: ['search', 'find', 'locate', 'buscar', 'procurar', 'encontrar'],
    title: 'Searching Documents',
    content: `Search across all your documents:
- **Global search**: Use the search bar in the top navigation
- **In-chat search**: Ask "find documents about [topic]"
- **Filters**: Narrow results by date, type, or folder

Search finds matches in:
- Document titles
- Full document content
- Document summaries`,
    category: 'feature',
    relatedTopics: ['nav-documents', 'chat-ask']
  },
  {
    id: 'feature-analysis',
    keywords: ['analyze', 'analysis', 'compare', 'summarize', 'analisar', 'analise', 'resumir'],
    title: 'Document Analysis',
    content: `Koda can analyze your documents:
- **Summarize**: "Summarize the main points of [document]"
- **Compare**: "Compare the terms in contract A vs contract B"
- **Extract**: "List all dates mentioned in the report"
- **Calculate**: "What's the total revenue mentioned?"

For financial documents, Koda shows calculations step-by-step.`,
    category: 'feature',
    relatedTopics: ['chat-ask']
  },

  // Settings
  {
    id: 'settings-account',
    keywords: ['account', 'profile', 'email', 'password', 'conta', 'perfil', 'senha'],
    title: 'Account Settings',
    content: `Manage your account in Settings:
- **Profile**: Update name and email
- **Password**: Change your password
- **Notifications**: Email notification preferences
- **Language**: Set preferred language

Access Settings from the gear icon in the sidebar.`,
    category: 'settings',
    relatedTopics: ['settings-preferences']
  },
  {
    id: 'settings-preferences',
    keywords: ['preferences', 'options', 'customize', 'preferencias', 'opcoes'],
    title: 'App Preferences',
    content: `Customize your Koda experience:
- **Theme**: Light or dark mode
- **Language**: Interface language (English, Portuguese)
- **Default view**: List or grid for documents
- **Notifications**: Sound and browser notifications

Changes are saved automatically.`,
    category: 'settings',
    relatedTopics: ['settings-account']
  },

  // General
  {
    id: 'general-shortcuts',
    keywords: ['shortcut', 'keyboard', 'hotkey', 'quick', 'atalho', 'teclado'],
    title: 'Keyboard Shortcuts',
    content: `Speed up your workflow with shortcuts:
- **Ctrl/Cmd + K**: Open global search
- **Ctrl/Cmd + U**: Quick upload
- **Ctrl/Cmd + N**: New conversation
- **Enter**: Send message in chat
- **Esc**: Close modals and popups

Shortcuts work throughout the app.`,
    category: 'general',
    relatedTopics: []
  },
  {
    id: 'general-help',
    keywords: ['help', 'support', 'contact', 'ajuda', 'suporte', 'contato'],
    title: 'Getting Help',
    content: `Need more help?
- **In-app help**: Ask Koda "how do I..." for instant guidance
- **Documentation**: Access guides in the Help menu
- **Support**: Contact support@koda.com for assistance

Koda can answer questions about its own features!`,
    category: 'general',
    relatedTopics: []
  }
];

/**
 * Load knowledge base from markdown files
 */
function loadKnowledgeBase(): HelpTopic[] {
  if (knowledgeBaseLoaded && knowledgeBaseCache) {
    return knowledgeBaseCache;
  }

  const topics: HelpTopic[] = [...BUILTIN_HELP_TOPICS];

  // Try to load from knowledge_base folder
  const knowledgeBasePath = path.join(__dirname, '../knowledge_base');

  try {
    if (fs.existsSync(knowledgeBasePath)) {
      const files = fs.readdirSync(knowledgeBasePath);

      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(knowledgeBasePath, file);
          const content = fs.readFileSync(filePath, 'utf-8');

          // Parse markdown into help topics
          const parsedTopics = parseMarkdownToTopics(content, file);
          topics.push(...parsedTopics);
        }
      }
    }
  } catch (error) {
    console.error('[AppHelpEngine] Error loading knowledge base:', error);
  }

  knowledgeBaseCache = topics;
  knowledgeBaseLoaded = true;

  console.log(`[AppHelpEngine] Loaded ${topics.length} help topics`);
  return topics;
}

/**
 * Parse markdown content into help topics
 */
function parseMarkdownToTopics(content: string, filename: string): HelpTopic[] {
  const topics: HelpTopic[] = [];

  // Split by ## headers
  const sections = content.split(/^## /gm).filter(s => s.trim());

  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0]?.trim() || '';

    if (!title) continue;

    const body = lines.slice(1).join('\n').trim();

    // Extract keywords from title and first line
    const keywords = title.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3)
      .concat(filename.replace('.md', '').split(/[-_]/));

    // Determine category from filename
    let category: HelpTopic['category'] = 'general';
    if (filename.includes('nav') || filename.includes('sidebar')) category = 'navigation';
    else if (filename.includes('upload')) category = 'upload';
    else if (filename.includes('chat')) category = 'chat';
    else if (filename.includes('folder')) category = 'folders';
    else if (filename.includes('setting')) category = 'settings';
    else if (filename.includes('feature')) category = 'feature';

    topics.push({
      id: `kb-${filename}-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
      keywords: [...new Set(keywords)],
      title,
      content: body,
      category,
    });
  }

  return topics;
}

/**
 * Search help topics by query
 */
export function searchHelpTopics(
  query: string,
  options: {
    limit?: number;
    category?: HelpTopic['category'];
  } = {}
): { topic: HelpTopic; score: number }[] {
  const { limit = 3, category } = options;

  const topics = loadKnowledgeBase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const results: { topic: HelpTopic; score: number }[] = [];

  for (const topic of topics) {
    // Filter by category if specified
    if (category && topic.category !== category) continue;

    let score = 0;

    // Check keyword matches
    for (const keyword of topic.keywords) {
      if (queryLower.includes(keyword)) {
        score += 0.3;
      }
      for (const qWord of queryWords) {
        if (keyword.includes(qWord) || qWord.includes(keyword)) {
          score += 0.2;
        }
      }
    }

    // Check title match
    if (topic.title.toLowerCase().includes(queryLower)) {
      score += 0.5;
    }

    // Check content match
    const contentLower = topic.content.toLowerCase();
    for (const qWord of queryWords) {
      if (contentLower.includes(qWord)) {
        score += 0.1;
      }
    }

    if (score > 0.2) {
      results.push({ topic, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Get help response for a query
 */
export function getHelpResponse(
  query: string,
  language: string = 'en'
): {
  found: boolean;
  response: string;
  topics: HelpTopic[];
  confidence: number;
} {
  const isPortuguese = language.toLowerCase().startsWith('pt');

  const results = searchHelpTopics(query, { limit: 3 });

  if (results.length === 0) {
    return {
      found: false,
      response: isPortuguese
        ? `Não encontrei informações específicas sobre isso. Posso ajudar com:\n- Navegação e interface\n- Upload de documentos\n- Perguntas sobre documentos\n- Configurações da conta\n\nTente perguntar algo mais específico!`
        : `I couldn't find specific information about that. I can help with:\n- Navigation and interface\n- Uploading documents\n- Asking questions about documents\n- Account settings\n\nTry asking something more specific!`,
      topics: [],
      confidence: 0,
    };
  }

  const topResult = results[0];
  const confidence = Math.min(topResult.score, 1);

  // Build response
  let response = '';

  if (results.length === 1 || topResult.score > 0.7) {
    // Single clear answer
    response = `**${topResult.topic.title}**\n\n${topResult.topic.content}`;
  } else {
    // Multiple possible topics
    response = isPortuguese
      ? `Encontrei algumas informações relacionadas:\n\n`
      : `Here's what I found:\n\n`;

    for (const result of results.slice(0, 2)) {
      response += `**${result.topic.title}**\n${result.topic.content}\n\n---\n\n`;
    }
  }

  // Add related topics suggestion
  if (topResult.topic.relatedTopics && topResult.topic.relatedTopics.length > 0) {
    const relatedTitles = topResult.topic.relatedTopics
      .map(id => {
        const related = loadKnowledgeBase().find(t => t.id === id);
        return related?.title;
      })
      .filter(Boolean);

    if (relatedTitles.length > 0) {
      response += isPortuguese
        ? `\n**Tópicos relacionados:** ${relatedTitles.join(', ')}`
        : `\n**Related topics:** ${relatedTitles.join(', ')}`;
    }
  }

  return {
    found: true,
    response,
    topics: results.map(r => r.topic),
    confidence,
  };
}

/**
 * Get all help topics for a category
 */
export function getTopicsByCategory(category: HelpTopic['category']): HelpTopic[] {
  const topics = loadKnowledgeBase();
  return topics.filter(t => t.category === category);
}

/**
 * Get all available categories
 */
export function getHelpCategories(): { category: HelpTopic['category']; count: number; label: string }[] {
  const topics = loadKnowledgeBase();

  const categoryLabels: Record<HelpTopic['category'], string> = {
    navigation: 'Navigation',
    feature: 'Features',
    upload: 'Uploading Files',
    chat: 'Chat & Questions',
    folders: 'Folders',
    settings: 'Settings',
    general: 'General',
  };

  const counts: Record<string, number> = {};
  for (const topic of topics) {
    counts[topic.category] = (counts[topic.category] || 0) + 1;
  }

  return Object.entries(categoryLabels).map(([category, label]) => ({
    category: category as HelpTopic['category'],
    count: counts[category] || 0,
    label,
  }));
}

/**
 * Detect if query is asking for help
 */
export function isHelpQuery(query: string): boolean {
  const helpPatterns = [
    /how (do|can|to) i/i,
    /como (eu )?(faço|posso|faz)/i,
    /where (is|can i find|do i)/i,
    /onde (fica|está|encontro)/i,
    /what is the/i,
    /o que é/i,
    /help (me )?(with|about)/i,
    /me ajud(e|a)/i,
    /can you (show|tell|explain)/i,
    /pode (me )?(mostrar|explicar)/i,
    /how does.*work/i,
    /como funciona/i,
  ];

  const featureKeywords = [
    'upload', 'download', 'search', 'find', 'folder', 'document',
    'chat', 'question', 'setting', 'account', 'password', 'navigation',
    'sidebar', 'menu', 'button', 'carregar', 'enviar', 'buscar',
    'procurar', 'pasta', 'documento', 'pergunta', 'configuração',
  ];

  // Check patterns
  for (const pattern of helpPatterns) {
    if (pattern.test(query)) {
      return true;
    }
  }

  // Check keywords with question context
  const queryLower = query.toLowerCase();
  const isQuestion = queryLower.includes('?') ||
    queryLower.startsWith('how') ||
    queryLower.startsWith('what') ||
    queryLower.startsWith('where') ||
    queryLower.startsWith('como') ||
    queryLower.startsWith('onde') ||
    queryLower.startsWith('o que');

  if (isQuestion) {
    for (const keyword of featureKeywords) {
      if (queryLower.includes(keyword)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Preload knowledge base at startup
 */
export function preloadKnowledgeBase(): void {
  console.log('[AppHelpEngine] Preloading knowledge base...');
  loadKnowledgeBase();
}

/**
 * Clear knowledge base cache (for hot reload)
 */
export function clearKnowledgeBaseCache(): void {
  knowledgeBaseCache = null;
  knowledgeBaseLoaded = false;
  console.log('[AppHelpEngine] Cache cleared');
}

export default {
  searchHelpTopics,
  getHelpResponse,
  getTopicsByCategory,
  getHelpCategories,
  isHelpQuery,
  preloadKnowledgeBase,
  clearKnowledgeBaseCache,
};
