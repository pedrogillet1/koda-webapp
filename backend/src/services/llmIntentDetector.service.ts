import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * LLM Intent Detector Service
 *
 * Uses Gemini 2.5 Flash to understand user intent flexibly.
 * Replaces rigid regex patterns with natural language understanding.
 *
 * Handles:
 * - File actions (list, search, locate, rename, delete, etc.)
 * - Semantic variations and synonyms
 * - Multilingual requests
 *
 * Updated: Nov 26, 2025 - Improved prompt with negative examples to fix create_folder misclassification
 */

interface IntentResult {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
}

class LLMIntentDetectorService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Detect user intent using LLM
   */
  async detectIntent(query: string, conversationHistory: Array<{role: string, content: string}> = []): Promise<IntentResult> {
    // Build conversation context for reference resolution
    let contextSection = '';
    if (conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5); // Last 5 messages
      contextSection = `\n**Recent Conversation Context:**\n${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n`;
    }

    const prompt = `You are a highly precise intent detection system for KODA, a document management AI assistant.
Your primary goal is to accurately classify the user's intent based on the query and the rules provided.

**Analyze the following user query and determine the single most likely intent.**
${contextSection}

**--- INTENT DEFINITIONS ---**

1. **create_folder**
   - **Description**: User wants to create a **NEW** folder that does not exist yet.
   - **Keywords**: "create", "make", "new folder", "criar", "nueva", "créer"
   - **Examples (EN)**: "create folder X", "make folder called Y", "new folder Z", "create a folder named X"
   - **Examples (PT)**: "criar pasta X", "fazer pasta chamada Y", "nova pasta Z", "crie uma pasta X"
   - **Examples (ES)**: "crear carpeta X", "hacer carpeta llamada Y", "nueva carpeta Z", "crea una carpeta X"
   - **Examples (FR)**: "créer dossier X", "faire dossier nommé Y", "nouveau dossier Z", "crée un dossier X"
   - **CRITICAL RULE**: This intent is ONLY for the explicit creation of a NEW folder. If the user is asking to see, list, or find files *within* an existing folder, the intent is **list_files** or **search_files**, NOT create_folder.
   - **NEGATIVE EXAMPLES - DO NOT USE create_folder FOR**: "in folder X", "in the X folder", "show me folder Y", "what's in the Z folder", "files in folder", "documents in the folder", "show me all files in folder X"
   - **Extract**: folderName

2. **list_files**
   - **Description**: User wants to see, find, or list files, often within a specific folder or of a certain type.
   - **Keywords**: "show", "list", "find", "what files", "which documents", "in the folder", "all files", "give me", "mostrar", "listar", "montrer"
   - **Examples (EN)**: "show files", "list documents", "what files are there", "give me all pdfs", "show me the documents", "which documents I have", "show files in folder X", "list all PDFs", "show me all Excel and PDF files in the Financials folder"
   - **Examples (PT)**: "mostrar arquivos", "listar documentos", "que arquivos existem", "me dê todos os pdfs", "mostre-me os documentos", "quais documentos eu tenho", "mostrar arquivos na pasta X"
   - **Examples (ES)**: "mostrar archivos", "listar documentos", "qué archivos hay", "dame todos los pdfs", "muéstrame los documentos", "cuáles documentos tengo"
   - **Examples (FR)**: "montrer fichiers", "lister documents", "quels fichiers existent", "donne-moi tous les pdfs", "montre-moi les documents", "quels documents j'ai"
   - **CRITICAL RULE**: Any query asking to see/show/list files IN a folder is list_files, not create_folder.
   - **Extract**: folderName (optional), fileType (optional - e.g., "pdf", "word", "excel")

3. **search_files**
   - **Description**: User wants to find files by name or keyword search.
   - **Keywords**: "find", "search", "locate", "look for", "buscar", "chercher"
   - **Examples**: "find document about X", "search for files containing Y", "locate files with Z in the name"
   - **Extract**: keyword, filename (optional)

4. **file_location**
   - **Description**: User wants to know where a specific file is stored.
   - **Keywords**: "where is", "what folder is", "location of", "where can I find"
   - **Examples**: "where is document X", "what folder is Y in", "location of file Z", "where can I find X"
   - **Extract**: filename

5. **move_files**
   - **Description**: User wants to move files to a different folder.
   - **Keywords**: "move", "put", "transfer", "mover", "déplacer"
   - **Examples (EN)**: "move X to folder Y", "put document X in folder Y", "transfer X to Y folder"
   - **Examples (PT)**: "mover X para pasta Y", "colocar documento X na pasta Y", "transferir X para pasta Y"
   - **Examples (ES)**: "mover X a carpeta Y", "poner documento X en carpeta Y", "transferir X a carpeta Y"
   - **Examples (FR)**: "déplacer X vers dossier Y", "mettre document X dans dossier Y", "transférer X vers dossier Y"
   - **Extract**: targetFolder, filename

6. **rename_file**
   - **Description**: User wants to rename a file or folder.
   - **Keywords**: "rename", "change name", "call it", "renomear", "renombrar", "renommer"
   - **Examples (EN)**: "rename X to Y", "change file name from X to Y", "call document X as Y instead", "rename folder X to Y"
   - **Examples (PT)**: "renomear X para Y", "mudar nome do arquivo de X para Y", "chamar documento X de Y", "renomear pasta X para Y"
   - **Examples (ES)**: "renombrar X a Y", "cambiar nombre del archivo de X a Y", "llamar documento X como Y", "renombrar carpeta X a Y"
   - **Examples (FR)**: "renommer X en Y", "changer nom du fichier de X à Y", "appeler document X comme Y", "renommer dossier X en Y"
   - **Extract**: oldFilename, newFilename

7. **delete_file**
   - **Description**: User wants to delete a file.
   - **Keywords**: "delete", "remove", "erase", "get rid of", "excluir", "eliminar", "supprimer"
   - **Examples (EN)**: "delete document X", "remove file Y", "erase Z", "get rid of X"
   - **Examples (PT)**: "excluir documento X", "remover arquivo Y", "apagar Z", "eliminar X"
   - **Examples (ES)**: "eliminar documento X", "borrar archivo Y", "borrar Z", "deshacerse de X"
   - **Examples (FR)**: "supprimer document X", "enlever fichier Y", "effacer Z", "se débarrasser de X"
   - **Extract**: filename

8. **show_file**
   - **Description**: User wants to preview/see/view/open a specific FILE (not folder). This includes ALL natural ways of asking to see a file.
   - **Keywords**: "show me", "open", "view", "see", "display", "pull up", "bring up", "present", "reveal", "look at", "check", "review", "examine", "inspect", "read", "abrir", "ouvrir", "ver", "mostrar"

   - **PATTERN 1 - Direct Commands (EN)**: "show me X file", "open X document", "display X.pdf", "view X", "pull up X", "bring up X", "present X", "let me see X file", "let me look at X", "let me check X"
   - **PATTERN 2 - Polite Requests (EN)**: "can I see X file?", "could you show me X?", "would you open X?", "can you display X?", "could you pull up X?", "would you mind showing X?", "please show me X"
   - **PATTERN 3 - Indirect Requests (EN)**: "I need to see X file", "I want to look at X", "I'd like to review X", "I should check X", "I have to examine X", "I must review X"
   - **PATTERN 4 - Question-Based (EN)**: "what's in the X file?", "what does X say?", "where is X file?", "how does X look?"
   - **PATTERN 5 - Implied Actions (EN)**: "X file please", "X document?", "the X document", "I'm looking for X file", "need X file", "need the X file"

   - **Examples (PT)**: "me mostra X", "mostre o X", "pode abrir X?", "quero ver X", "preciso ver X", "o que tem no X?", "abre o X", "deixa eu ver X", "pode me mostrar X?"
   - **Examples (ES)**: "muéstrame X", "abre X", "¿puedes mostrarme X?", "quiero ver X", "necesito ver X", "¿qué hay en X?", "déjame ver X"
   - **Examples (FR)**: "montre-moi X", "ouvre X", "peux-tu me montrer X?", "je veux voir X", "j'ai besoin de voir X", "qu'y a-t-il dans X?", "laisse-moi voir X"

   - **CONTEXT RESOLUTION**: If user says "this file", "that document", "the file", "it", "the one about X", "the paper on Y", or similar contextual reference, look at the conversation context above and extract the actual filename from the previous messages. Return the real filename, NOT the contextual reference.
   - **TOPIC RESOLUTION**: If user says "the document about trading" or "the paper on machine learning", extract the topic and return it as the filename search term.

   - **Extract**: filename (the file name, topic reference, or contextual reference resolved to actual filename)

9. **show_folder**
   - **Description**: User wants to preview/see/view/open a specific FOLDER (not file) to see its contents (files and subfolders).
   - **Keywords**: "show folder", "open folder", "view folder", "display folder", "what's in folder", "folder contents", "abrir pasta", "ouvrir dossier", "mostrar carpeta"

   - **PATTERN 1 - Direct Commands (EN)**: "show me X folder", "open X folder", "display X folder", "view X folder", "show folder X", "open the X folder"
   - **PATTERN 2 - Polite Requests (EN)**: "can I see X folder?", "could you show me X folder?", "would you open X folder?", "can you display X folder?", "please show me X folder"
   - **PATTERN 3 - Content Queries (EN)**: "what's in X folder?", "what's inside X folder?", "show me what's in X folder", "what files are in X folder?", "what's in the X folder?"
   - **PATTERN 4 - Implied Actions (EN)**: "X folder please", "the X folder", "I'm looking for X folder", "need the X folder", "show X folder"

   - **Examples (PT)**: "mostre a pasta X", "abrir pasta X", "o que tem na pasta X?", "mostrar pasta X", "quero ver a pasta X", "pode abrir a pasta X?", "deixa eu ver a pasta X"
   - **Examples (ES)**: "muéstrame la carpeta X", "abrir carpeta X", "¿qué hay en la carpeta X?", "mostrar carpeta X", "quiero ver la carpeta X", "déjame ver la carpeta X"
   - **Examples (FR)**: "montre-moi le dossier X", "ouvrir dossier X", "qu'y a-t-il dans le dossier X?", "montrer dossier X", "je veux voir le dossier X"

   - **CRITICAL RULE**: This intent is ONLY for showing/opening EXISTING folders to view their contents. If user is creating a new folder, use create_folder instead.
   - **NEGATIVE EXAMPLES - DO NOT USE show_folder FOR**: "create folder X", "make folder X", "new folder X" (these are create_folder)

   - **Extract**: folderName (the folder name to show)

10. **metadata_query**
   - **Description**: User wants information about files (size, type, date, count).
   - **Keywords**: "how many", "size of", "when was", "file count", "statistics", "quantos", "combien"
   - **Examples**: "how many files", "what's the size of X", "when was Y uploaded", "file count", "what types of documents", "how many PDFs do I have", "show me file statistics", "how many Word documents in folder X"
   - **Extract**: queryType (optional - "count", "size", "types"), fileTypes (optional array - ["pdf", "word", "excel"]), folderName (optional)

11. **rag_query** (Default Fallback)
    - **Description**: User is asking a question about the **CONTENT** of one or more documents.
    - **CRITICAL RULE**: If the query is not a clear file management action (create, list, move, delete, rename, etc.), it is a rag_query.
    - **Examples**: "what does document X say about Y", "explain concept Z", "summarize X", "what are the main points in the report"

11. **greeting**
    - **Description**: User is greeting or making small talk.
    - **Examples**: "hello", "hi", "how are you", "good morning", "olá", "hola", "bonjour"

**--- DECISION-MAKING PROCESS ---**

Follow this hierarchy strictly:

1. **Check for greetings first**: If the query is a simple greeting, return "greeting".

2. **Check for explicit file management actions**: Look for action verbs like create, move, rename, delete.
   - "create folder X" → create_folder
   - "move X to Y" → move_files
   - "rename X to Y" → rename_file
   - "delete X" → delete_file

3. **Check for viewing/listing requests**: Look for show, list, find, what files.
   - If asking to see files IN a folder → **list_files** (NOT create_folder!)
   - If asking to open/view a specific file → **show_file**
   - If asking to open/view a specific folder → **show_folder**
   - If asking where a file is → **file_location**

4. **Check for metadata queries**: Look for how many, count, size, statistics.
   - → metadata_query

5. **Default to rag_query**: If none of the above match clearly, assume the user is asking about document content.

**--- CRITICAL DISAMBIGUATION ---**

**"folder" in query does NOT automatically mean create_folder!**
- "Show me files in the Reports folder" → **list_files** (folderName: "Reports")
- "What's in the Marketing folder" → **list_files** (folderName: "Marketing") OR **show_folder** (folderName: "Marketing")
- "Show me the Marketing folder" → **show_folder** (folderName: "Marketing")
- "Open the Marketing folder" → **show_folder** (folderName: "Marketing")
- "Create a new folder called Reports" → **create_folder** (folderName: "Reports")

The key distinction:
- create_folder = making something NEW (verbs: create, make, new)
- list_files = viewing FILES INSIDE an existing folder (verbs: show files in, list files in, what files in)
- show_folder = viewing a FOLDER ITSELF and its contents (verbs: show folder, open folder, view folder)

**User Query:** "${query}"

**Parameter Extraction Rules:**
- When extracting filenames, remove file extensions (.pdf, .docx, etc.) and normalize spaces/underscores/hyphens
  Example: "move koda checklist to folder X" → extract filename as "koda" (will match "koda_checklist.pdf")
- When extracting folder names, remove the word 'folder' from the extracted name
  Example: "move X to koda12 folder" → extract targetFolder as "koda12" (not "koda12 folder")
- For fileType, use lowercase: "pdf", "word", "excel", "image", etc.

**Response Format (JSON only):**
{
  "intent": "intent_name",
  "confidence": 0.95,
  "parameters": {
    "folderName": "folder name if applicable",
    "filename": "file name if applicable",
    "keyword": "search term if applicable",
    "oldFilename": "for rename operations",
    "newFilename": "for rename operations",
    "targetFolder": "for move operations",
    "fileType": "pdf/word/excel if filtering by type",
    "fileTypes": ["pdf", "word"],
    "queryType": "count/size/types for metadata"
  }
}

Respond with JSON only:`;

    try {
      // ✅ FIX: Add 10-second timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM intent detection timeout (10s)')), 10000)
      );

      const result = await Promise.race([
        this.model.generateContent(prompt),
        timeoutPromise
      ]);

      const responseText = result.response.text();

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const intentResult: IntentResult = JSON.parse(jsonText);

      // Validate result
      if (!intentResult.intent || typeof intentResult.confidence !== 'number') {
        throw new Error('Invalid intent result format');
      }

      // ✅ FIX: Validate required parameters for each intent
      if (intentResult.intent === 'create_folder' && !intentResult.parameters?.folderName) {
        console.error('❌ create_folder intent missing folderName parameter');
        throw new Error('Missing folderName parameter');
      }

      if (intentResult.intent === 'move_files' && (!intentResult.parameters?.filename || !intentResult.parameters?.targetFolder)) {
        console.error('❌ move_files intent missing required parameters', intentResult.parameters);
        throw new Error('Missing filename or targetFolder parameter');
      }

      if (intentResult.intent === 'rename_file' && (!intentResult.parameters?.oldFilename || !intentResult.parameters?.newFilename)) {
        console.error('❌ rename_file intent missing required parameters');
        throw new Error('Missing oldFilename or newFilename parameter');
      }

      if (intentResult.intent === 'show_file' && !intentResult.parameters?.filename) {
        console.error('❌ show_file intent missing filename parameter');
        throw new Error('Missing filename parameter');
      }

      // Log for debugging
      console.log(`🧠 LLM Intent Detection:`, {
        query: query.substring(0, 50),
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        parameters: intentResult.parameters,
      });

      return intentResult;
    } catch (error) {
      console.error('❌ Error detecting intent with LLM:', error);
      // Fallback to default intent
      return {
        intent: 'rag_query',
        confidence: 0.5,
        parameters: {},
      };
    }
  }

  /**
   * Detect if query is a greeting in any language
   */
  async isGreeting(query: string): Promise<boolean> {
    const result = await this.detectIntent(query);
    return result.intent === 'greeting' && result.confidence > 0.7;
  }

  /**
   * Detect if query is about file metadata (size, count, type, date)
   */
  async isMetadataQuery(query: string): Promise<boolean> {
    const result = await this.detectIntent(query);
    return result.intent === 'metadata_query' && result.confidence > 0.7;
  }

  /**
   * Detect if query is about file location
   */
  async isFileLocationQuery(query: string): Promise<boolean> {
    const result = await this.detectIntent(query);
    return result.intent === 'file_location' && result.confidence > 0.7;
  }

  /**
   * Detect specific file action intent
   */
  async detectFileAction(query: string): Promise<{ action: string | null; parameters: Record<string, any> }> {
    const result = await this.detectIntent(query);

    const fileActions = ['list_files', 'search_files', 'rename_file', 'delete_file', 'file_location', 'show_file', 'show_folder'];

    if (fileActions.includes(result.intent) && result.confidence > 0.7) {
      return {
        action: result.intent,
        parameters: result.parameters,
      };
    }

    return {
      action: null,
      parameters: {},
    };
  }
}

export const llmIntentDetectorService = new LLMIntentDetectorService();
