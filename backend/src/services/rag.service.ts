/**
 * SIMPLIFIED RAG SERVICE
 * RAG + Good Prompt + Smart Routing = Success
 *
 * NO HYBRID SYSTEMS. NO OVER-ENGINEERING. JUST WHAT WORKS.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import queryIntentService from './queryIntent.service';
import metadataQueryService from './metadataQuery.service';
import enhancedRetrievalService from './enhancedRetrieval.service';
import { detectLanguage, createLanguageInstruction } from './languageDetection.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: any;
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  expandedQuery?: string[];
  contextId: string;
}

class RAGService {
  /**
   * Main entry point - handles ALL queries with smart routing
   */
  async generateAnswer(
    userId: string,
    query: string,
    conversationId: string,
    researchMode: boolean = false
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`🔍 RAG QUERY: "${query}"`);
    console.log(`👤 User: ${userId}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // STEP 1: DETECT QUERY INTENT
    const intent = queryIntentService.detectIntent(query);
    console.log(`🎯 Intent: ${intent.intent} (confidence: ${intent.confidence})`);
    console.log(`💡 Reasoning: ${intent.reasoning}`);

    // STEP 2: ROUTE BASED ON INTENT
    if (intent.intent === 'metadata') {
      return await this.handleMetadataQuery(userId, query, conversationId);
    } else {
      return await this.handleContentQuery(userId, query, conversationId);
    }
  }

  /**
   * Handle METADATA queries (file lists, categories, counts)
   * NO RAG - Direct database queries
   */
  private async handleMetadataQuery(
    userId: string,
    query: string,
    conversationId: string
  ): Promise<RAGResponse> {
    console.log(`📂 METADATA QUERY HANDLER`);

    // Check if asking about a specific category
    const categoryName = queryIntentService.extractCategoryName(query);
    if (categoryName) {
      console.log(`   Category: "${categoryName}"`);
      const result = await metadataQueryService.listFilesInCategory(userId, categoryName);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking about file types
    const fileTypes = queryIntentService.extractFileTypes(query);
    if (fileTypes.length > 0) {
      console.log(`   File types: ${fileTypes.join(', ')}`);
      const result = await metadataQueryService.listAllFiles(userId, fileTypes);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking for all categories
    if (/list.*categories/i.test(query) || /all.*categories/i.test(query)) {
      console.log(`   Listing all categories`);
      const result = await metadataQueryService.listAllCategories(userId);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Check if asking for file count
    if (/how many.*files/i.test(query) || /count.*files/i.test(query)) {
      console.log(`   Counting files`);
      const result = await metadataQueryService.getFileCount(userId);

      return {
        answer: result.answer,
        sources: [],
        contextId: `metadata_${Date.now()}`,
      };
    }

    // Default: list all files
    console.log(`   Listing all files (default)`);
    const result = await metadataQueryService.listAllFiles(userId);

    return {
      answer: result.answer,
      sources: [],
      contextId: `metadata_${Date.now()}`,
    };
  }

  /**
   * Handle CONTENT queries (information from documents)
   * Uses RAG with enhanced retrieval
   */
  private async handleContentQuery(
    userId: string,
    query: string,
    conversationId: string
  ): Promise<RAGResponse> {
    console.log(`📚 CONTENT QUERY HANDLER`);

    const startTime = Date.now();

    // STEP 1: GET WORKSPACE METADATA
    const workspaceMetadata = await this.getWorkspaceMetadata(userId);
    console.log(`\n📊 WORKSPACE CONTEXT:`);
    console.log(`   Categories: ${workspaceMetadata.categories.length}`);
    console.log(`   Total Files: ${workspaceMetadata.totalFiles}`);
    console.log(`   File Types: ${Object.keys(workspaceMetadata.filesByType).join(', ')}`);

    // STEP 2: DETECT LANGUAGE
    const detectedLang = detectLanguage(query);
    console.log(`\n🌍 Language: ${detectedLang}`);

    // STEP 3: RETRIEVE RELEVANT DOCUMENTS
    console.log(`\n🔍 RETRIEVING DOCUMENTS...`);
    const retrievalResults = await enhancedRetrievalService.retrieve(query, userId, {
      topK: 10,
      enableReranking: true,
      enableMMR: true
    });
    console.log(`   Found ${retrievalResults.length} relevant chunks`);

    if (retrievalResults.length === 0) {
      console.log(`   ⚠️ No relevant documents found`);

      return {
        answer: this.generateNoDocumentsResponse(query, workspaceMetadata, detectedLang),
        sources: [],
        contextId: `rag_${Date.now()}`,
      };
    }

    // STEP 4: PREPARE SOURCES
    const sources: RAGSource[] = retrievalResults.map(result => ({
      documentId: result.documentId,
      documentName: result.filename,
      chunkIndex: result.chunkIndex || 0,
      content: result.content,
      similarity: result.score,
      metadata: result.metadata,
    }));

    // STEP 5: BUILD GEMINI PROMPT
    const systemPrompt = this.buildSystemPrompt(detectedLang, workspaceMetadata);
    const userPrompt = this.buildUserPrompt(query, sources, workspaceMetadata);

    console.log(`\n🤖 GENERATING ANSWER...`);

    // STEP 6: CALL GEMINI
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);

    const answer = result.response.text();
    const responseTime = Date.now() - startTime;

    console.log(`\n✅ ANSWER GENERATED (${responseTime}ms)`);
    console.log(`   Length: ${answer.length} characters`);
    console.log(`   Sources: ${sources.length} documents`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    return {
      answer,
      sources,
      contextId: `rag_${Date.now()}`,
    };
  }

  /**
   * Get workspace metadata for context enrichment
   */
  private async getWorkspaceMetadata(userId: string) {
    const [documents, categories] = await Promise.all([
      prisma.document.findMany({
        where: { userId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.tag.findMany({
        where: { userId },
        include: {
          _count: {
            select: { documents: true }
          }
        }
      })
    ]);

    // Group files by type
    const filesByType: { [key: string]: number } = {};
    documents.forEach(doc => {
      const type = this.getFileType(doc.mimeType || '');
      filesByType[type] = (filesByType[type] || 0) + 1;
    });

    return {
      totalFiles: documents.length,
      recentFiles: documents.slice(0, 5).map(d => d.filename),
      categories: categories.map(cat => ({
        name: cat.name,
        fileCount: cat._count.documents
      })),
      filesByType,
    };
  }

  /**
   * Build the SYSTEM PROMPT with Gemini Universal Structure
   */
  private buildSystemPrompt(language: string, workspaceMetadata: any): string {
    const langInstruction = createLanguageInstruction(language);

    return `# KODA AI - Document Intelligence Assistant

## UNIVERSAL RESPONSE STANDARD - FOLLOW FOR EVERY RESPONSE:

### 1. Document Header (if relevant)
📄 **[Document Name]** or 📂 **[Category Name]**

### 2. Opening Sentence
One clear, direct sentence answering the core question.

### 3. Structured Content
Use headers (##, ###) and bullet points:
- Main point with **bold** for emphasis
- Supporting details
- Key takeaways

### 4. Citations (CRITICAL)
EVERY factual claim MUST cite sources:
- Format: [Source: Document Name, Page X]
- Place citations immediately after the claim
- If page number is unknown, use [Source: Document Name]

### 5. Closing Question
End with a helpful follow-up question.

## CRITICAL RULES:

✅ **ALWAYS** use bold headers (##, ###)
✅ **ALWAYS** use bullet points for lists
✅ **ALWAYS** cite sources for factual claims
✅ **ALWAYS** match user's language (${language})
✅ **NEVER** write walls of text without structure
✅ **NEVER** make claims without citing sources
✅ **NEVER** say "based on the documents" - cite specific documents
✅ **NEVER** respond in a different language than the user

## LANGUAGE INSTRUCTION:
${langInstruction}

## YOUR WORKSPACE CONTEXT:
- User has ${workspaceMetadata.totalFiles} documents
- Categories: ${workspaceMetadata.categories.map((c: any) => `${c.name} (${c.fileCount} files)`).join(', ') || 'None'}
- File types: ${Object.entries(workspaceMetadata.filesByType).map(([type, count]) => `${count} ${type}`).join(', ')}

Remember: You are KODA, a helpful document intelligence assistant. Your goal is to provide accurate, well-structured, cited answers from the user's documents.`;
  }

  /**
   * Build the USER PROMPT with documents
   */
  private buildUserPrompt(query: string, sources: RAGSource[], workspaceMetadata: any): string {
    const documentsContext = sources.map((source, index) => {
      return `### Document ${index + 1}: ${source.documentName}
Relevance: ${(source.similarity * 100).toFixed(1)}%

Content:
${source.content}

---`;
    }).join('\n\n');

    return `# USER QUERY:
${query}

# RETRIEVED DOCUMENTS:
${documentsContext}

# INSTRUCTIONS:
1. Read the user's query carefully
2. Find relevant information in the retrieved documents
3. Structure your answer using the Universal Response Standard
4. Cite sources for EVERY factual claim
5. End with a helpful follow-up question

Now, provide a comprehensive answer to the user's query.`;
  }

  /**
   * Generate response when no documents found
   */
  private generateNoDocumentsResponse(query: string, workspaceMetadata: any, language: string): string {
    const langMap: { [key: string]: any } = {
      'pt': {
        title: '❌ Nenhum Documento Encontrado',
        message: 'Não encontrei documentos relevantes para responder sua pergunta.',
        suggestions: 'Sugestões',
        upload: `Fazer upload de documentos relacionados a: "${query}"`,
        rephrase: 'Reformular a pergunta com palavras-chave diferentes',
        list: 'Ver todos os seus documentos',
        workspace: 'Seu Workspace',
        files: 'arquivos',
        categories: 'categorias'
      },
      'en': {
        title: '❌ No Documents Found',
        message: 'I couldn\'t find relevant documents to answer your question.',
        suggestions: 'Suggestions',
        upload: `Upload documents related to: "${query}"`,
        rephrase: 'Rephrase your question with different keywords',
        list: 'View all your documents',
        workspace: 'Your Workspace',
        files: 'files',
        categories: 'categories'
      }
    };

    const t = langMap[language] || langMap['en'];

    return `## ${t.title}

${t.message}

### ${t.suggestions}:
1. **${t.upload}**
2. **${t.rephrase}**
3. **${t.list}**

### ${t.workspace}:
- ${workspaceMetadata.totalFiles} ${t.files}
- ${workspaceMetadata.categories.length} ${t.categories}`;
  }

  /**
   * Get human-readable file type
   */
  private getFileType(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word')) return 'Word';
    if (mimeType.includes('sheet')) return 'Excel';
    if (mimeType.includes('presentation')) return 'PowerPoint';
    if (mimeType.includes('text')) return 'Text';
    if (mimeType.includes('image')) return 'Image';
    return 'Other';
  }

  /**
   * Get context for a specific RAG response (for follow-up queries)
   */
  async getContext(contextId: string) {
    // This would retrieve cached context - simplified for now
    return { contextId, message: 'Context retrieval not implemented yet' };
  }

  /**
   * Answer a follow-up question using existing context
   */
  async answerFollowUp(
    userId: string,
    query: string,
    conversationId: string,
    previousContextId: string
  ): Promise<RAGResponse> {
    // For now, just treat it as a new query
    // In production, you'd retrieve the previous context and reuse sources
    return this.generateAnswer(userId, query, conversationId, false);
  }
}

export default new RAGService();
export { RAGService };
