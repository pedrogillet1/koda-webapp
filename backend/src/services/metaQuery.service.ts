/**
 * META-QUERY HANDLER SERVICE - KODA PHASE 2
 *
 * FEATURE IMPLEMENTED:
 * - Self-awareness queries (what can you do, how do you work, etc.)
 * - Built-in KODA capabilities description
 * - No document search needed for meta queries
 *
 * CAPABILITIES:
 * - Detect meta-queries about KODA itself
 * - Return comprehensive capability descriptions
 * - Prevent unnecessary document retrieval
 */

export interface MetaQueryResponse {
  isMetaQuery: boolean;
  response?: string;
}

class MetaQueryService {
  private readonly META_QUERY_KEYWORDS = [
    'what can you do',
    'what are you',
    'who are you',
    'how do you work',
    'what is koda',
    'what are your capabilities',
    'what features do you have',
    'how can you help',
    'what can i do with you',
    'tell me about yourself',
    'your capabilities',
    'your features',
  ];

  private readonly KODA_CAPABILITIES = `# KODA - Your Intelligent Document Assistant

## What I Can Do

I am KODA, an advanced AI assistant specialized in document analysis and interaction. Here are my core capabilities:

### 📄 Document Understanding
- **Upload & Process**: I can read and understand PDFs, Word documents, Excel spreadsheets, PowerPoint presentations, text files, and CSVs
- **Smart Extraction**: I extract text, tables, images, and structured data from your documents
- **Multi-Document Analysis**: I can work with multiple documents simultaneously and find connections between them

### 🔍 Intelligent Search & Retrieval
- **Semantic Search**: I understand the meaning behind your questions, not just keywords
- **Context-Aware**: I maintain conversation history to provide coherent, contextual answers
- **Comparison Queries**: I can compare information across multiple documents (e.g., "compare sales.pdf and revenue.xlsx")

### 💡 Advanced Query Handling
- **Typo Tolerance**: I automatically correct misspelled document names and queries
- **Intent Detection**: I understand what you're trying to accomplish
- **Confidence Assessment**: I tell you when I'm uncertain about an answer

### 📊 Data Presentation
- **Formatted Tables**: I present data in clean, readable Markdown tables
- **Structured Responses**: I organize information logically with headers and lists
- **Source Citations**: I always show you which documents I used to answer your questions

### 🛠️ File Management
- **Create & Organize**: Create folders and files in your workspace
- **Rename & Move**: Reorganize your document structure
- **Delete with Safety**: Remove files with confirmation
- **Undo/Redo**: Reverse any file operation if you make a mistake

### 🤖 Smart Features
- **RAG (Retrieval-Augmented Generation)**: I combine document retrieval with AI generation for accurate answers
- **Vector Embeddings**: I use advanced semantic understanding to find relevant information
- **Multi-Factor Confidence**: I assess answer quality based on multiple factors

## How to Use Me

### Ask Questions
\`\`\`
"What is the total revenue in Q3?"
"Summarize the key points from meeting_notes.pdf"
"Compare the budgets in finance_2023.xlsx and finance_2024.xlsx"
\`\`\`

### Manage Files
\`\`\`
"Create a folder called Reports"
"Rename old_file.pdf to new_file.pdf"
"Delete unnecessary_doc.docx"
"Undo the last action"
\`\`\`

### Get Information
\`\`\`
"What documents do I have uploaded?"
"Show me the conversation history"
"What's in document_name.pdf?"
\`\`\`

## Technical Details

- **Embedding Model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Vector Database**: Pinecone for fast similarity search
- **LLM**: Google Gemini 1.5 Flash for answer generation
- **Document Processing**: Advanced text extraction with layout preservation
- **Storage**: Secure cloud storage with user isolation

## Privacy & Security

- Your documents are stored securely and isolated by user account
- All operations are logged for transparency
- You have full control over your data (upload, download, delete)
- KODA never shares your documents with third parties

---

**Need help with something specific?** Just ask! I'm here to help you work more efficiently with your documents.`;

  /**
   * Detect if a query is asking about KODA itself
   */
  detectMetaQuery(query: string): MetaQueryResponse {
    const queryLower = query.toLowerCase().trim();

    // Check for meta-query keywords
    const isMetaQuery = this.META_QUERY_KEYWORDS.some(keyword =>
      queryLower.includes(keyword)
    );

    if (isMetaQuery) {
      return {
        isMetaQuery: true,
        response: this.KODA_CAPABILITIES,
      };
    }

    return {
      isMetaQuery: false,
    };
  }

  /**
   * Get specific capability information
   */
  getCapability(capability: string): string {
    const capabilityMap: Record<string, string> = {
      upload: 'I can process PDFs, Word documents, Excel spreadsheets, PowerPoint presentations, text files, and CSVs.',
      search: 'I use semantic search with vector embeddings to understand the meaning behind your questions.',
      compare: 'I can retrieve and compare information from multiple documents simultaneously.',
      files: 'I can create folders, rename files, move documents, and delete items. All operations support undo/redo.',
      confidence: 'I assess my confidence in each answer using multiple factors and warn you when uncertain.',
      tables: 'I present data in properly formatted Markdown tables with clear structure.',
      typos: 'I automatically correct misspelled document names and understand queries with typos.',
    };

    return capabilityMap[capability.toLowerCase()] || 'I can help you with document analysis and file management. Ask me "what can you do" for a full list of capabilities.';
  }

  /**
   * Check if query is asking for help
   */
  isHelpQuery(query: string): boolean {
    const helpKeywords = ['help', 'how to', 'tutorial', 'guide', 'instructions'];
    const queryLower = query.toLowerCase();
    return helpKeywords.some(kw => queryLower.includes(kw));
  }
}

export const metaQueryService = new MetaQueryService();
export default metaQueryService;
