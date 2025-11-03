import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * LLM Intent Detector Service
 *
 * Uses Gemini 2.0 Flash to understand user intent flexibly.
 * Replaces rigid regex patterns with natural language understanding.
 *
 * Handles:
 * - File actions (list, search, locate, rename, delete, etc.)
 * - Semantic variations and synonyms
 * - Multilingual requests
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
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Detect user intent using LLM
   */
  async detectIntent(query: string): Promise<IntentResult> {
    const prompt = `You are an intent detection system for KODA, a document management AI assistant.

Analyze the following user query and determine the intent.

**Available Intents:**
1. **list_files** - User wants to see a list of files
   - Examples: "show files", "list documents", "what files are there", "give me all pdfs", "show me the documents"

2. **search_files** - User wants to find files by name/keyword
   - Examples: "find document about X", "search for files containing Y", "locate files with Z in the name"

3. **file_location** - User wants to know where a file is stored
   - Examples: "where is document X", "what folder is Y in", "location of file Z", "where can I find X"

4. **rename_file** - User wants to rename a file
   - Examples: "rename X to Y", "change file name from X to Y", "call document X as Y instead"

5. **delete_file** - User wants to delete a file
   - Examples: "delete document X", "remove file Y", "erase Z", "get rid of X"

6. **metadata_query** - User wants information about files (size, type, date, count)
   - Examples: "how many files", "what's the size of X", "when was Y uploaded", "file count"

7. **rag_query** - User wants to ask questions about document content (default)
   - Examples: "what does document X say about Y", "explain concept Z", "summarize X"

8. **greeting** - User is greeting or making small talk
   - Examples: "hello", "hi", "how are you", "good morning", "olá", "hola"

**User Query:** "${query}"

**Instructions:**
- Respond ONLY with valid JSON
- Determine the most likely intent
- Extract relevant parameters (filenames, keywords, etc.)
- Provide confidence score (0.0 to 1.0)

**Response Format:**
{
  "intent": "intent_name",
  "confidence": 0.95,
  "parameters": {
    "filename": "example.pdf",
    "keyword": "search term",
    "newName": "new_name.pdf"
  }
}

**Rules:**
- If query is about file CONTENT → "rag_query"
- If query is about file EXISTENCE/LOCATION → "file_location" or "search_files" or "list_files"
- If query is about file METADATA (size, date, count) → "metadata_query"
- If query is an ACTION (rename, delete) → corresponding action intent
- If query is a greeting → "greeting"
- Default to "rag_query" if uncertain

Respond with JSON only:`;

    try {
      const result = await this.model.generateContent(prompt);
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

    const fileActions = ['list_files', 'search_files', 'rename_file', 'delete_file', 'file_location'];

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
