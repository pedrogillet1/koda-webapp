/**
 * KODA PRODUCT HELP SERVICE V2
 * Comprehensive product knowledge base for all UI screens and features
 *
 * This service provides:
 * - Detailed answers about how to use Koda features
 * - UI navigation guidance for all screens
 * - Feature explanations with step-by-step instructions
 * - Troubleshooting help
 * - Onboarding guidance
 *
 * Performance Target: <2s (was 8.3s)
 *
 * Key principle: Uses comprehensive static product knowledge base, NOT user documents
 */

import geminiGateway from './geminiGateway.service';

// ============================================================================
// COMPREHENSIVE PRODUCT KNOWLEDGE BASE
// ============================================================================

interface TopicInfo {
  keywords: string[];
  question: string;
  answer: string;
}

interface ScreenInfo {
  screen_name: string;
  description: string;
  topics: Record<string, TopicInfo>;
}

type ProductKnowledge = Record<string, ScreenInfo>;

const PRODUCT_KNOWLEDGE: ProductKnowledge = {
  login: {
    screen_name: "Login",
    description: "User authentication screen for accessing Koda",
    topics: {
      how_to_login: {
        keywords: ["login", "sign in", "access", "enter", "log in", "entrar", "acessar", "iniciar sessao"],
        question: "How do I log in to Koda?",
        answer: "To log in to Koda:\n1. Go to the Koda login page\n2. Enter your registered email address\n3. Enter your password\n4. Click the 'Sign In' button\n5. If credentials are correct, you'll be redirected to the main chat interface"
      },
      forgot_password: {
        keywords: ["forgot", "password", "reset", "recover", "esqueci", "senha", "recuperar"],
        question: "What if I forgot my password?",
        answer: "If you forgot your password:\n1. Click 'Forgot Password?' link on the login page\n2. Enter your registered email address\n3. Click 'Send Recovery Email'\n4. Check your email for a password reset link\n5. Follow the link to create a new password"
      },
      login_errors: {
        keywords: ["error", "wrong", "incorrect", "invalid", "failed", "erro", "incorreto", "invalido"],
        question: "Why can't I log in?",
        answer: "Common login issues and solutions:\n- **Invalid credentials**: Double-check your email and password\n- **Account not verified**: Check your email for verification link\n- **Account locked**: Too many failed attempts - wait 15 minutes or reset password\n- **Browser issues**: Clear cache/cookies or try incognito mode"
      }
    }
  },
  signup: {
    screen_name: "Sign Up",
    description: "Account creation screen for new users",
    topics: {
      how_to_signup: {
        keywords: ["signup", "sign up", "register", "create account", "new account", "cadastrar", "criar conta", "registrar"],
        question: "How do I create a Koda account?",
        answer: "To create a Koda account:\n1. Click 'Sign Up' or 'Create Account' on the login page\n2. Enter your full name\n3. Enter a valid email address\n4. Create a strong password (min 8 characters, with letters and numbers)\n5. Accept the Terms of Service\n6. Click 'Create Account'\n7. Check your email and click the verification link"
      },
      password_requirements: {
        keywords: ["password", "requirements", "strong", "secure", "senha", "requisitos"],
        question: "What are the password requirements?",
        answer: "Koda password requirements:\n- Minimum 8 characters\n- At least one uppercase letter\n- At least one lowercase letter\n- At least one number\n- Special characters recommended for extra security"
      },
      verification_email: {
        keywords: ["verification", "verify", "email", "confirm", "verificacao", "confirmar"],
        question: "I didn't receive the verification email",
        answer: "If you didn't receive the verification email:\n1. Check your spam/junk folder\n2. Make sure you entered the correct email\n3. Wait a few minutes - emails can be delayed\n4. Click 'Resend Verification Email' on the login page\n5. Add noreply@koda.ai to your contacts"
      }
    }
  },
  recover_access: {
    screen_name: "Recover Access",
    description: "Password recovery and account access restoration",
    topics: {
      recovery_process: {
        keywords: ["recover", "access", "forgot", "reset", "recuperar", "acesso"],
        question: "How do I recover my account access?",
        answer: "To recover your account:\n1. Go to the login page\n2. Click 'Forgot Password?'\n3. Enter your registered email\n4. Click 'Send Recovery Email'\n5. Open the email and click the reset link\n6. Create a new password\n7. Log in with your new password"
      },
      recovery_link_expired: {
        keywords: ["expired", "link", "invalid", "expirado", "invalido"],
        question: "My recovery link expired",
        answer: "Recovery links expire after 24 hours for security. If your link expired:\n1. Go back to the login page\n2. Click 'Forgot Password?' again\n3. Request a new recovery email\n4. Use the new link within 24 hours"
      }
    }
  },
  verification_code: {
    screen_name: "Verification Code",
    description: "Two-factor authentication and verification",
    topics: {
      enter_code: {
        keywords: ["code", "verification", "2fa", "two factor", "codigo", "verificacao"],
        question: "Where do I enter my verification code?",
        answer: "To enter your verification code:\n1. Check your email or authenticator app for the 6-digit code\n2. Enter the code in the verification field\n3. Click 'Verify' or press Enter\n4. The code expires in 10 minutes\n5. If expired, click 'Resend Code'"
      },
      code_not_working: {
        keywords: ["not working", "invalid", "wrong", "nao funciona", "invalido"],
        question: "My verification code isn't working",
        answer: "If your code isn't working:\n1. Make sure you're using the most recent code\n2. Check that you entered all 6 digits correctly\n3. Verify the code hasn't expired (10 min limit)\n4. Request a new code if needed\n5. Check your timezone settings"
      }
    }
  },
  set_new_password: {
    screen_name: "Set New Password",
    description: "Password creation after recovery",
    topics: {
      create_password: {
        keywords: ["new password", "create", "set", "change", "nova senha", "criar", "alterar"],
        question: "How do I set a new password?",
        answer: "To set your new password:\n1. Enter your new password (min 8 characters)\n2. Include uppercase, lowercase, and numbers\n3. Re-enter to confirm\n4. Click 'Set Password'\n5. You'll be redirected to login with your new password"
      }
    }
  },
  chat: {
    screen_name: "Chat",
    description: "Main conversational interface for interacting with Koda AI",
    topics: {
      how_to_chat: {
        keywords: ["chat", "talk", "ask", "question", "conversar", "perguntar", "falar"],
        question: "How do I chat with Koda?",
        answer: "To chat with Koda:\n1. Type your question in the input field at the bottom\n2. Press Enter or click the Send button\n3. Wait for Koda's response (usually 2-5 seconds)\n4. Continue the conversation with follow-up questions\n5. Start a new chat anytime with the 'New Chat' button"
      },
      ask_about_documents: {
        keywords: ["document", "file", "content", "search", "documento", "arquivo", "buscar", "procurar"],
        question: "How do I ask questions about my documents?",
        answer: "To ask about your documents:\n1. Make sure documents are uploaded first\n2. Ask naturally: 'What does the contract say about...'\n3. Reference specific documents: 'In the Q3 report...'\n4. Koda will search and cite sources\n5. Follow up for more details"
      },
      conversation_history: {
        keywords: ["history", "previous", "conversations", "saved", "historico", "anteriores", "salvos"],
        question: "Where are my previous conversations?",
        answer: "Your conversation history:\n1. Click the sidebar icon (left side)\n2. See list of past conversations\n3. Click any conversation to continue it\n4. Conversations are auto-saved\n5. Use search to find specific chats"
      },
      new_conversation: {
        keywords: ["new", "start", "fresh", "clear", "novo", "iniciar", "limpar"],
        question: "How do I start a new conversation?",
        answer: "To start a new conversation:\n1. Click 'New Chat' button in the sidebar or top bar\n2. Or use keyboard shortcut Ctrl+N / Cmd+N\n3. This creates a fresh conversation\n4. Your previous chat is saved automatically"
      },
      citations: {
        keywords: ["citation", "source", "reference", "where", "citacao", "fonte", "referencia", "onde"],
        question: "How do I see where answers come from?",
        answer: "Koda provides source citations:\n1. Look for [Source: Document Name] in responses\n2. Click the citation to see the original text\n3. Multiple sources may be cited\n4. Citations show exact document and page/section"
      }
    }
  },
  documents: {
    screen_name: "Documents",
    description: "Document library and management interface",
    topics: {
      view_documents: {
        keywords: ["view", "see", "list", "documents", "library", "ver", "listar", "documentos", "biblioteca"],
        question: "How do I view my documents?",
        answer: "To view your documents:\n1. Click 'Documents' in the sidebar\n2. See all uploaded files in a grid or list\n3. Use search to filter by name\n4. Sort by date, name, or type\n5. Click a document to preview"
      },
      document_actions: {
        keywords: ["delete", "rename", "move", "download", "actions", "excluir", "renomear", "mover", "baixar", "acoes"],
        question: "What can I do with my documents?",
        answer: "Available document actions:\n- **Preview**: Click to view content\n- **Download**: Download original file\n- **Rename**: Click the edit icon or right-click\n- **Move**: Drag to folder or use Move option\n- **Delete**: Click delete icon (trash)\n- **Share**: Generate shareable link (coming soon)"
      },
      search_documents: {
        keywords: ["search", "find", "filter", "buscar", "encontrar", "filtrar"],
        question: "How do I search my documents?",
        answer: "To search documents:\n1. Use the search bar at the top of Documents\n2. Type document name or keywords\n3. Results filter in real-time\n4. Filter by file type using dropdown\n5. Filter by date uploaded"
      },
      document_status: {
        keywords: ["status", "processing", "ready", "failed", "estado", "processando", "pronto", "falhou"],
        question: "What do the document status icons mean?",
        answer: "Document status indicators:\n- **Green checkmark**: Ready - fully processed\n- **Blue spinner**: Processing - wait a moment\n- **Yellow warning**: Partial - some content extracted\n- **Red X**: Failed - try re-uploading\n- **Clock icon**: Queued - waiting to process"
      }
    }
  },
  upload_modal: {
    screen_name: "Upload Modal",
    description: "Document upload interface",
    topics: {
      how_to_upload: {
        keywords: ["upload", "add", "import", "new document", "carregar", "adicionar", "importar", "novo documento"],
        question: "How do I upload documents?",
        answer: "To upload documents:\n1. Click the 'Upload' button (top bar or Documents page)\n2. Drag and drop files OR click to browse\n3. Select one or multiple files\n4. Click 'Upload' to start\n5. Wait for processing to complete"
      },
      supported_formats: {
        keywords: ["format", "type", "supported", "accept", "formato", "tipo", "suportado", "aceito"],
        question: "What file formats are supported?",
        answer: "Koda supports these formats:\n- **Documents**: PDF, DOCX, DOC, TXT\n- **Spreadsheets**: XLSX, XLS, CSV\n- **Presentations**: PPTX, PPT\n- **Images**: PNG, JPG, JPEG, GIF (with OCR)\n- **Max size**: 50MB per file"
      },
      upload_limits: {
        keywords: ["limit", "size", "maximum", "how many", "limite", "tamanho", "maximo", "quantos"],
        question: "Are there upload limits?",
        answer: "Upload limits:\n- **File size**: 50MB per file\n- **Batch upload**: Up to 10 files at once\n- **Storage**: Depends on your plan\n- **Tip**: Split large files if over limit"
      }
    }
  },
  upload_progress: {
    screen_name: "Upload Progress",
    description: "Upload status and progress tracking",
    topics: {
      track_progress: {
        keywords: ["progress", "status", "uploading", "processing", "progresso", "status", "carregando", "processando"],
        question: "How do I track upload progress?",
        answer: "Track your uploads:\n1. Progress bar shows upload percentage\n2. 'Uploading' = file transferring\n3. 'Processing' = AI analyzing content\n4. 'Complete' = ready to use\n5. Check Documents page for final status"
      },
      upload_failed: {
        keywords: ["failed", "error", "stuck", "problem", "falhou", "erro", "travado", "problema"],
        question: "My upload failed, what do I do?",
        answer: "If upload fails:\n1. Check file format is supported\n2. Verify file isn't corrupted\n3. Ensure file size under 50MB\n4. Check internet connection\n5. Try uploading again\n6. Contact support if persists"
      }
    }
  },
  document_preview: {
    screen_name: "Document Preview",
    description: "Document content viewer",
    topics: {
      preview_document: {
        keywords: ["preview", "view", "open", "read", "visualizar", "ver", "abrir", "ler"],
        question: "How do I preview a document?",
        answer: "To preview a document:\n1. Go to Documents page\n2. Click on any document\n3. Preview opens in side panel\n4. Scroll through content\n5. Click 'Open Full' for expanded view"
      },
      preview_features: {
        keywords: ["features", "options", "tools", "recursos", "opcoes", "ferramentas"],
        question: "What can I do in document preview?",
        answer: "Preview features:\n- **Scroll**: Navigate through pages\n- **Zoom**: Use +/- or scroll wheel\n- **Search**: Find text within document\n- **Download**: Get original file\n- **Full screen**: Expand for better reading"
      }
    }
  },
  folder_system: {
    screen_name: "Folder System",
    description: "Document organization with folders",
    topics: {
      create_folder: {
        keywords: ["create", "new", "folder", "add", "criar", "nova", "pasta", "adicionar"],
        question: "How do I create a folder?",
        answer: "To create a folder:\n1. Go to Documents page\n2. Click 'New Folder' button\n3. Enter folder name\n4. Press Enter or click Create\n5. Folder appears in your library"
      },
      organize_documents: {
        keywords: ["organize", "move", "arrange", "sort", "organizar", "mover", "arranjar", "ordenar"],
        question: "How do I organize documents into folders?",
        answer: "To organize documents:\n1. Select documents (click checkboxes)\n2. Drag to desired folder, OR\n3. Right-click > 'Move to Folder'\n4. Select destination folder\n5. Documents are moved instantly"
      },
      nested_folders: {
        keywords: ["nested", "subfolder", "inside", "hierarchy", "aninhado", "subpasta", "dentro", "hierarquia"],
        question: "Can I create folders inside folders?",
        answer: "Yes, nested folders are supported:\n1. Open a folder\n2. Click 'New Folder' inside it\n3. Name your subfolder\n4. Create as many levels as needed\n5. Navigate with breadcrumbs"
      },
      delete_folder: {
        keywords: ["delete", "remove", "folder", "excluir", "remover", "pasta"],
        question: "How do I delete a folder?",
        answer: "To delete a folder:\n1. Right-click the folder\n2. Select 'Delete Folder'\n3. Choose what to do with contents:\n   - Move documents out first, OR\n   - Delete folder and all contents\n4. Confirm deletion"
      }
    }
  },
  settings_account: {
    screen_name: "Account Settings",
    description: "Account management and preferences",
    topics: {
      account_info: {
        keywords: ["account", "info", "details", "conta", "informacoes", "detalhes"],
        question: "Where can I see my account information?",
        answer: "To view account info:\n1. Click your profile icon (top right)\n2. Select 'Settings'\n3. Go to 'Account' tab\n4. See email, name, plan details\n5. View account creation date"
      },
      change_email: {
        keywords: ["change", "email", "update", "alterar", "atualizar"],
        question: "How do I change my email?",
        answer: "To change your email:\n1. Go to Settings > Account\n2. Click 'Change Email'\n3. Enter new email address\n4. Enter your password to confirm\n5. Verify new email via link sent"
      },
      delete_account: {
        keywords: ["delete", "account", "close", "remove", "excluir", "conta", "fechar", "remover"],
        question: "How do I delete my account?",
        answer: "To delete your account:\n1. Go to Settings > Account\n2. Scroll to 'Danger Zone'\n3. Click 'Delete Account'\n4. Read the warning carefully\n5. Type 'DELETE' to confirm\n6. All data will be permanently removed"
      }
    }
  },
  settings_profile: {
    screen_name: "Profile Settings",
    description: "User profile customization",
    topics: {
      update_profile: {
        keywords: ["profile", "name", "photo", "picture", "perfil", "nome", "foto", "imagem"],
        question: "How do I update my profile?",
        answer: "To update your profile:\n1. Go to Settings > Profile\n2. Click on your avatar to change photo\n3. Edit your display name\n4. Add a bio (optional)\n5. Click 'Save Changes'"
      },
      profile_photo: {
        keywords: ["photo", "picture", "avatar", "image", "foto", "imagem", "avatar"],
        question: "How do I change my profile photo?",
        answer: "To change profile photo:\n1. Go to Settings > Profile\n2. Click on current avatar\n3. Select 'Upload Photo'\n4. Choose image (JPG, PNG)\n5. Crop if needed\n6. Click 'Save'"
      }
    }
  },
  settings_security: {
    screen_name: "Security Settings",
    description: "Account security configuration",
    topics: {
      change_password: {
        keywords: ["change", "password", "security", "alterar", "senha", "seguranca"],
        question: "How do I change my password?",
        answer: "To change your password:\n1. Go to Settings > Security\n2. Click 'Change Password'\n3. Enter current password\n4. Enter new password (8+ chars)\n5. Confirm new password\n6. Click 'Update Password'"
      },
      two_factor: {
        keywords: ["2fa", "two factor", "authenticator", "dois fatores", "autenticador"],
        question: "How do I enable two-factor authentication?",
        answer: "To enable 2FA:\n1. Go to Settings > Security\n2. Find 'Two-Factor Authentication'\n3. Click 'Enable'\n4. Scan QR code with authenticator app\n5. Enter verification code\n6. Save backup codes securely"
      },
      active_sessions: {
        keywords: ["sessions", "devices", "logged in", "sessoes", "dispositivos", "conectado"],
        question: "How do I see active sessions?",
        answer: "To view active sessions:\n1. Go to Settings > Security\n2. Scroll to 'Active Sessions'\n3. See all devices logged in\n4. Click 'Sign Out' on any device\n5. 'Sign Out All' to log out everywhere"
      }
    }
  },
  settings_language: {
    screen_name: "Language Settings",
    description: "Language and localization preferences",
    topics: {
      change_language: {
        keywords: ["language", "idioma", "lingua", "change", "alterar", "mudar"],
        question: "How do I change the interface language?",
        answer: "To change language:\n1. Go to Settings > Language\n2. Click language dropdown\n3. Select your preferred language:\n   - English\n   - Portuguese (Brasileiro)\n   - Spanish\n4. Interface updates immediately"
      },
      response_language: {
        keywords: ["response", "answer", "koda", "ai", "resposta", "idioma"],
        question: "Can Koda respond in different languages?",
        answer: "Yes! Koda is multilingual:\n- Responds in your question's language\n- Or set preferred response language\n- Go to Settings > Language\n- Choose 'AI Response Language'\n- Works with Portuguese, English, Spanish"
      }
    }
  },
  settings_storage: {
    screen_name: "Storage Settings",
    description: "Storage usage and management",
    topics: {
      check_storage: {
        keywords: ["storage", "space", "usage", "limit", "armazenamento", "espaco", "uso", "limite"],
        question: "How do I check my storage usage?",
        answer: "To check storage:\n1. Go to Settings > Storage\n2. See visual usage bar\n3. View breakdown by file type\n4. See largest documents\n5. Check remaining space"
      },
      free_storage: {
        keywords: ["free", "clear", "delete", "space", "liberar", "limpar", "excluir", "espaco"],
        question: "How do I free up storage space?",
        answer: "To free up storage:\n1. Go to Settings > Storage\n2. Review largest files\n3. Delete unused documents\n4. Empty trash (permanent delete)\n5. Consider upgrading plan for more space"
      }
    }
  }
};

// ============================================================================
// LEGACY FAQ (kept for backward compatibility)
// ============================================================================

const KODA_FAQ: Record<string, string> = {
  'what is koda': 'Koda is an intelligent document assistant that helps you search, analyze, and get answers from your documents using AI. Upload your files and ask questions in natural language to find information quickly.',
  'what can koda do': 'Koda can: 1) Search across all your documents using natural language, 2) Answer questions based on document content, 3) Summarize documents and extract key information, 4) Organize files with folders, 5) Support multiple languages (English, Portuguese, Spanish).',
  'supported formats': 'Koda supports: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, CSV, and images (PNG, JPG, JPEG, GIF). OCR is automatically applied to images and scanned PDFs.',
  'file size limit': 'The maximum file size is 50MB per document. For very large files, consider splitting them into smaller parts.',
  'is my data secure': 'Yes, your documents are encrypted at rest and in transit. We do not share your data with third parties. Your documents are only accessible to you.',
  'multiple languages': 'Yes, Koda supports multiple languages including English, Portuguese, and Spanish. You can upload documents in any language and ask questions in your preferred language.'
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

class KodaProductHelpService {
  private static instance: KodaProductHelpService;

  private constructor() {}

  public static getInstance(): KodaProductHelpService {
    if (!KodaProductHelpService.instance) {
      KodaProductHelpService.instance = new KodaProductHelpService();
    }
    return KodaProductHelpService.instance;
  }

  /**
   * Handle product help query
   * Tries comprehensive knowledge base first, falls back to LLM if needed
   */
  public async handleProductQuery(query: string): Promise<string> {
    const queryLower = query.toLowerCase();

    // 1. Try matching against comprehensive knowledge base
    const kbMatch = this.matchKnowledgeBase(queryLower);
    if (kbMatch) {
      return kbMatch;
    }

    // 2. Try legacy FAQ match
    const faqAnswer = this.matchFAQ(queryLower);
    if (faqAnswer) {
      return faqAnswer;
    }

    // 3. Fall back to LLM with full product knowledge context
    return this.generateLLMAnswer(query);
  }

  /**
   * Match query against comprehensive knowledge base
   */
  private matchKnowledgeBase(query: string): string | null {
    let bestMatch: { screen: string; topic: string; score: number } | null = null;
    let highestScore = 0;

    // Search through all screens and topics
    for (const [screenKey, screen] of Object.entries(PRODUCT_KNOWLEDGE)) {
      for (const [topicKey, topic] of Object.entries(screen.topics)) {
        const score = this.calculateMatchScore(query, topic.keywords);
        if (score > highestScore && score >= 0.3) {
          highestScore = score;
          bestMatch = { screen: screenKey, topic: topicKey, score };
        }
      }
    }

    if (bestMatch) {
      const screen = PRODUCT_KNOWLEDGE[bestMatch.screen];
      const topic = screen.topics[bestMatch.topic];
      return this.formatTopicResponse(screen, topic);
    }

    return null;
  }

  /**
   * Calculate match score between query and keywords
   */
  private calculateMatchScore(query: string, keywords: string[]): number {
    let matchCount = 0;
    const queryWords = query.split(/\s+/);

    for (const keyword of keywords) {
      // Direct inclusion check
      if (query.includes(keyword)) {
        matchCount += keyword.split(/\s+/).length; // Weight multi-word keywords higher
        continue;
      }
      // Word-by-word check
      const keywordWords = keyword.split(/\s+/);
      for (const kw of keywordWords) {
        if (queryWords.some(qw => qw.includes(kw) || kw.includes(qw))) {
          matchCount += 0.5;
        }
      }
    }

    return matchCount / Math.max(keywords.length, 1);
  }

  /**
   * Format a topic response
   */
  private formatTopicResponse(screen: ScreenInfo, topic: TopicInfo): string {
    return `**${screen.screen_name}** - ${topic.question}\n\n${topic.answer}`;
  }

  /**
   * Match query against legacy FAQ entries
   */
  private matchFAQ(query: string): string | null {
    for (const [key, answer] of Object.entries(KODA_FAQ)) {
      if (query.includes(key) || this.fuzzyMatch(query, key)) {
        return answer;
      }
    }

    // Common variations
    if (query.includes('what is') && query.includes('koda')) {
      return KODA_FAQ['what is koda'];
    }
    if (query.includes('format') || query.includes('file type') || query.includes('support')) {
      return KODA_FAQ['supported formats'];
    }
    if (query.includes('secure') || query.includes('privacy') || query.includes('safe')) {
      return KODA_FAQ['is my data secure'];
    }
    if (query.includes('language') || query.includes('idioma')) {
      return KODA_FAQ['multiple languages'];
    }

    return null;
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(query: string, key: string): boolean {
    const queryWords = query.split(/\s+/);
    const keyWords = key.split(/\s+/);

    let matchCount = 0;
    for (const keyWord of keyWords) {
      if (queryWords.some(qw => qw.includes(keyWord) || keyWord.includes(qw))) {
        matchCount++;
      }
    }

    return matchCount >= keyWords.length * 0.7;
  }

  /**
   * Generate answer using LLM with full product knowledge context
   */
  private async generateLLMAnswer(query: string): Promise<string> {
    const context = this.buildFullProductContext();

    const response = await geminiGateway.generateContent({
      prompt: `You are Koda's help assistant. Answer this question about how to use Koda based ONLY on the following product knowledge. Do not make up features that aren't listed.

PRODUCT KNOWLEDGE:
${context}

USER QUESTION: "${query}"

Provide a helpful, step-by-step answer. Be concise and practical. Format with markdown for readability. If the question is not about Koda features, politely redirect to document-related help.`,
      config: {
        maxOutputTokens: 500,
        temperature: 0.3
      }
    });

    return response.text;
  }

  /**
   * Build comprehensive product context for LLM
   */
  private buildFullProductContext(): string {
    let context = 'KODA PRODUCT KNOWLEDGE BASE:\n\n';

    for (const [, screen] of Object.entries(PRODUCT_KNOWLEDGE)) {
      context += `=== ${screen.screen_name.toUpperCase()} ===\n`;
      context += `${screen.description}\n\n`;

      for (const [, topic] of Object.entries(screen.topics)) {
        context += `Q: ${topic.question}\n`;
        context += `A: ${topic.answer}\n\n`;
      }
    }

    context += '\n=== FREQUENTLY ASKED QUESTIONS ===\n\n';
    for (const [question, answer] of Object.entries(KODA_FAQ)) {
      context += `Q: ${question}\nA: ${answer}\n\n`;
    }

    return context;
  }

  /**
   * Get help for a specific screen
   */
  public getScreenHelp(screenKey: string): string | null {
    const screen = PRODUCT_KNOWLEDGE[screenKey];
    if (!screen) return null;

    let response = `**${screen.screen_name}**\n${screen.description}\n\n`;
    response += '**Available Help Topics:**\n';

    for (const [, topic] of Object.entries(screen.topics)) {
      response += `- ${topic.question}\n`;
    }

    return response;
  }

  /**
   * Get all available screens for help
   */
  public getAvailableScreens(): string[] {
    return Object.keys(PRODUCT_KNOWLEDGE);
  }

  /**
   * Handle onboarding help
   */
  public getOnboardingHelp(): string {
    return `Welcome to Koda! Here's how to get started:

**1. Create Your Account**
- Sign up with your email
- Verify your email address
- Set up your profile

**2. Upload Your Documents**
- Click the Upload button
- Drag & drop or browse files
- Supported: PDF, DOCX, XLSX, PPTX, TXT, images
- Wait for processing (10-30 seconds)

**3. Start Asking Questions**
- Type your question naturally
- Koda searches all your documents
- Get answers with source citations

**4. Organize Your Files**
- Create folders
- Move documents
- Filter searches by folder

**Supported Languages:** English, Portuguese, Spanish

What would you like to do first?`;
  }

  /**
   * Handle meta AI questions
   */
  public getMetaAIResponse(): string {
    return `I'm Koda, your intelligent document assistant! I can help you:

- **Search** through your documents using natural language
- **Answer questions** based on your document content
- **Summarize** documents and extract key information
- **Organize** your files with folders
- **Analyze** data and provide insights

I support **English**, **Portuguese**, and **Spanish**.

I use advanced AI to understand your documents and give you accurate answers with source citations. How can I help you today?`;
  }
}

// Export singleton instance
export const kodaProductHelpService = KodaProductHelpService.getInstance();
