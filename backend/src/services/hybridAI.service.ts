/**
 * Hybrid AI Service
 * Intelligently routes queries between document knowledge and general AI knowledge
 */

import queryIntentClassifier, { QueryIntent } from './queryIntentClassifier.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import pineconeService from './pinecone.service';
import vectorEmbeddingService from './vectorEmbedding.service';
import prisma from '../config/database';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export interface HybridResponse {
  answer: string;
  intent: QueryIntent;
  sources?: any[];
  responseTime: number;
  documents?: DocumentMetadata[]; // ⚡ NEW: Document metadata for frontend display
}

export interface DocumentMetadata {
  id: string;
  name: string;
  type: string; // 'pdf', 'docx', 'xlsx', 'pptx', 'image', etc.
  mimeType: string;
  previewUrl: string;
  downloadUrl: string;
  score?: number; // Relevance score from search
}

class HybridAIService {
  /**
   * Generate response using hybrid intelligence
   */
  async generateResponse(
    query: string,
    userId: string,
    options: any = {}
  ): Promise<HybridResponse> {
    const startTime = Date.now();

    // Step 1: Classify query intent
    const intent = queryIntentClassifier.classify(query);
    console.log(`🎯 Query Intent: ${intent.intent} (confidence: ${intent.confidence})`);
    console.log(`📝 Reasoning: ${intent.reasoning}`);

    // Step 2: Handle based on intent
    let answer = '';
    let sources: any[] = [];

    if (intent.intent === 'general') {
      // Pure general knowledge - no document retrieval
      answer = await this.generateGeneralKnowledgeResponse(query);
    } else if (intent.intent === 'document') {
      // Document-specific query - use RAG
      const { answer: docAnswer, sources: docSources } =
        await this.generateDocumentResponse(query, userId, intent);
      answer = docAnswer;
      sources = docSources;
    } else if (intent.intent === 'hybrid') {
      // Hybrid - combine both
      const { answer: hybridAnswer, sources: hybridSources } =
        await this.generateHybridResponse(query, userId, intent);
      answer = hybridAnswer;
      sources = hybridSources;
    }

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Hybrid response time: ${totalTime}ms`);

    return {
      answer,
      intent,
      sources,
      responseTime: totalTime,
    };
  }

  /**
   * Generate streaming response with hybrid intelligence
   */
  async generateStreamingResponse(
    query: string,
    userId: string,
    onChunk: (chunk: string) => void,
    options: any = {}
  ): Promise<HybridResponse> {
    const startTime = Date.now();

    console.log(`\n🔍 [HYBRID AI STREAMING] ==========================================`);
    console.log(`📝 [Query]: "${query}"`);

    // 📂 SPECIAL HANDLER: File listing queries (e.g., "what excel did i upload", "which excel did i upload")
    const fileListingPattern = /(what|which).*(excel|spreadsheet|xlsx|pdf|docx|pptx|document|file)s?.*(upload|did i|have i|got)/i;
    if (fileListingPattern.test(query)) {
      console.log('📂 Detected file listing query - querying database for filenames');

      // Detect file type from query
      let mimeTypeFilter: string | undefined;
      if (/excel|spreadsheet|xlsx/i.test(query)) {
        mimeTypeFilter = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (/pdf/i.test(query)) {
        mimeTypeFilter = 'application/pdf';
      } else if (/docx|word/i.test(query)) {
        mimeTypeFilter = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (/pptx|powerpoint|presentation/i.test(query)) {
        mimeTypeFilter = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      }

      // Query database for files
      const docs = await prisma.document.findMany({
        where: {
          userId,
          ...(mimeTypeFilter && { mimeType: mimeTypeFilter }),
          status: 'completed'
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          filename: true,
          createdAt: true,
          fileSize: true,
          mimeType: true
        }
      });

      console.log(`📂 Found ${docs.length} file(s) matching query`);

      // Format response based on file type
      const fileType = mimeTypeFilter
        ? (mimeTypeFilter.includes('sheet') ? 'Excel' :
           mimeTypeFilter.includes('pdf') ? 'PDF' :
           mimeTypeFilter.includes('wordprocessing') ? 'Word' : 'PowerPoint')
        : 'document';

      let answer: string;
      if (docs.length === 0) {
        answer = `You haven't uploaded any ${fileType} files yet.`;
      } else {
        const fileList = docs.map((doc, i) => {
          const date = new Date(doc.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          const sizeMB = doc.fileSize ? (doc.fileSize / (1024 * 1024)).toFixed(2) : 'unknown';
          return `${i + 1}. **${doc.filename}** (${date}, ${sizeMB} MB)`;
        }).join('\n');

        answer = `You have uploaded **${docs.length}** ${fileType} file(s):\n\n${fileList}\n\nYou can ask me questions about the content of any of these files!`;
      }

      // Send the complete answer at once (it's a database query, not AI generation)
      onChunk(answer);

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ File listing response time: ${totalTime}ms`);

      return {
        answer,
        intent: { intent: 'document', confidence: 1.0, reasoning: 'File listing query', retrievalCount: 0, needsContext: false },
        sources: [],
        responseTime: totalTime,
      };
    }

    // Step 1: Classify query intent
    const intent = queryIntentClassifier.classify(query);
    console.log(`🎯 [Intent]: ${intent.intent} (confidence: ${intent.confidence})`);
    console.log(`📝 [Reasoning]: ${intent.reasoning}`);

    // Step 2: Handle based on intent
    let answer = '';
    let sources: any[] = [];
    let documents: DocumentMetadata[] = [];

    // ⚡ NEW: Handle capability questions
    if (intent.intent === 'capability') {
      answer = await this.streamCapabilityResponse(query, onChunk);
    }
    // ⚡ NEW: Handle document requests (user wants the file)
    else if (intent.intent === 'document_request') {
      documents = await this.searchDocumentsByName(query, userId);

      // Check for ambiguity
      if (documents.length === 0) {
        answer = await this.streamDocumentNotFoundResponse(query, onChunk);
      } else if (documents.length === 1) {
        answer = await this.streamDocumentRequestResponse(query, documents[0], onChunk);
      } else {
        // Ambiguous - multiple documents match
        answer = await this.streamAmbiguousDocumentResponse(query, documents, onChunk);
      }
    }
    // Handle general knowledge
    else if (intent.intent === 'general') {
      answer = await this.streamGeneralKnowledgeResponse(query, onChunk, intent);
    }
    // Handle document information queries
    else if (intent.intent === 'document') {
      const { answer: docAnswer, sources: docSources } =
        await this.streamDocumentResponse(query, userId, intent, onChunk, options);
      answer = docAnswer;
      sources = docSources;
    }
    // Handle hybrid queries
    else if (intent.intent === 'hybrid') {
      const { answer: hybridAnswer, sources: hybridSources } =
        await this.streamHybridResponse(query, userId, intent, onChunk);
      answer = hybridAnswer;
      sources = hybridSources;
    }

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Hybrid streaming response time: ${totalTime}ms`);

    return {
      answer,
      intent,
      sources,
      documents, // ⚡ NEW: Include document metadata for frontend
      responseTime: totalTime,
    };
  }

  /**
   * Generate general knowledge response (no documents)
   */
  private async generateGeneralKnowledgeResponse(query: string): Promise<string> {
    const systemPrompt = `You are KODA, a helpful AI assistant.

Answer the user's question clearly and accurately using your general knowledge.

Guidelines:
- Provide accurate, up-to-date information
- Be concise but thorough
- Use examples when helpful
- Format your response with markdown
- If you're not sure about something, say so

Important: This is a general knowledge question. Do NOT reference any user documents.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return text.trim();
  }

  /**
   * Stream general knowledge response
   */
  private async streamGeneralKnowledgeResponse(
    query: string,
    onChunk: (chunk: string) => void,
    intent?: QueryIntent
  ): Promise<string> {
    // ⚡ INTELLIGENT PROMPT - Simple and smart
    const systemPrompt = `You are Koda, a helpful AI assistant.

Think intelligently about this question:

1. What is the user asking for?
   - A quick definition? Give 2-3 short paragraphs.
   - An explanation? Explain clearly but keep it concise.
   - Instructions? Provide clear steps.

2. How much detail do they need?
   - Simple questions deserve simple answers.
   - Don't write a textbook for a simple question.
   - Be helpful but concise.

FORMATTING:
Write in short, readable paragraphs with line breaks.
Never use bullet points or numbered lists.

REMEMBER:
You're having a conversation. Answer naturally. If someone asks "what is net profit", they want to understand the concept, not read a finance textbook. Use common sense.

Important: This is a general knowledge question. Do NOT reference any user documents.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 300,  // Reasonable limit for general knowledge
        temperature: 0.7,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContentStream(fullPrompt);

    let fullResponse = '';

    try {
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        if (chunkText && chunkText.length > 0) {
          onChunk(chunkText);
        }
      }
    } catch (error) {
      console.error('Error streaming general knowledge response:', error);
    }

    return fullResponse.trim();
  }

  /**
   * Generate document-specific response (RAG)
   */
  private async generateDocumentResponse(
    query: string,
    userId: string,
    intent: QueryIntent
  ): Promise<{ answer: string; sources: any[] }> {
    console.log(`\n🎯 [SMART RETRIEVAL] Analyzing query: "${query}"`);

    // 🎯 SMART SLIDE DETECTION - Check if user is asking about a specific slide
    const slidePattern = /slide\s+(\d+)/i;
    const slideMatch = query.match(slidePattern);

    let results: any[] = [];
    let context = '';

    if (slideMatch) {
      const slideNumber = parseInt(slideMatch[1], 10);
      console.log(`🎯 [SLIDE DETECTED] User asking about slide ${slideNumber}`);
      console.log(`   Using metadata filter instead of semantic search`);

      // Use metadata-based retrieval for specific slide
      results = await pineconeService.searchBySlideNumber(userId, slideNumber, 10);

      if (results.length > 0) {
        console.log(`✅ [SLIDE FOUND] Retrieved ${results.length} chunks from slide ${slideNumber}`);
        context = results
          .map((r: any) => r.content)
          .filter((c: any) => c && c.trim())
          .join('\n\n');
      } else {
        console.log(`⚠️ [SLIDE NOT FOUND] No content found for slide ${slideNumber}`);
        context = `[Slide ${slideNumber} was not found in the uploaded documents]`;
      }
    } else {
      // Regular semantic search for general queries
      console.log(`🔍 [SEMANTIC SEARCH] Using standard retrieval`);
      console.log(`   Top K: ${intent.retrievalCount || 20}`);
      console.log(`   Min Similarity: 0.5`);

      const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);
      results = await pineconeService.searchSimilarChunks(
        queryEmbedding,
        userId,
        intent.retrievalCount || 20,
        0.5
      );

      console.log(`✅ [Pinecone Results]: Found ${results.length} chunks`);

      context = results
        .map((r: any) => `${r.metadata?.content || r.content || ''}`)
        .filter((c: any) => c.trim())
        .join('\n\n');
    }

    const systemPrompt = `You are Koda, a personal document assistant. Your role is to help users find, understand, and manage their documents.

IMPORTANT RULES:
1. Always check documents FIRST before using general knowledge
2. When users ask about concepts like "lista 11" or document names, refer to THEIR documents, not general definitions
3. If a user asks "what is X" and X matches a document name, talk about THEIR document, not the general concept
4. Be specific about which document you're referencing (mention the document name)

Document content:
${context || 'No relevant content found in documents.'}

---

Answer based on the question type:

1. "What is [concept]?" questions → If this matches a document name, explain what's IN the document. Otherwise, give a 2-3 sentence definition.

2. "Tell me about [document]" questions → Comprehensive overview with bold section titles covering all major topics. 1-2 sentences per section.

3. Specific questions → Natural paragraphs, appropriate detail.

Always mention which document you're referencing. Keep responses scannable. Use line breaks. Match your length to what's being asked.

After answering, suggest a helpful next action (e.g., "Would you like to know more about any specific part of this document?" or "I can also help you find related documents.")`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: 0.7,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return {
      answer: text.trim(),
      sources: results,
    };
  }

  /**
   * Stream document-specific response (RAG)
   */
  private async streamDocumentResponse(
    query: string,
    userId: string,
    intent: QueryIntent,
    onChunk: (chunk: string) => void,
    options: any = {}
  ): Promise<{ answer: string; sources: any[] }> {
    console.log(`\n🎯 [SMART RETRIEVAL] Analyzing query: "${query}"`);

    // ⚡ Check if a specific document is attached
    const attachedDocumentId = options.attachedDocumentId;
    if (attachedDocumentId) {
      console.log(`📎 [ATTACHED DOCUMENT] Restricting search to document: ${attachedDocumentId}`);
    }

    // 🎯 SMART SLIDE DETECTION - Check if user is asking about a specific slide
    const slidePattern = /slide\s+(\d+)/i;
    const slideMatch = query.match(slidePattern);

    // 📊 SMART SHEET DETECTION - Check if user is asking about a specific Excel sheet
    const sheetPattern = /sheet\s+(\d+)/i;
    const sheetMatch = query.match(sheetPattern);

    let results: any[] = [];
    let context = '';

    if (slideMatch) {
      const slideNumber = parseInt(slideMatch[1], 10);
      console.log(`🎯 [SLIDE DETECTED] User asking about slide ${slideNumber}`);
      console.log(`   Using metadata filter instead of semantic search`);

      // Use metadata-based retrieval for specific slide
      results = await pineconeService.searchBySlideNumber(userId, slideNumber, 10, attachedDocumentId);

      if (results.length > 0) {
        console.log(`✅ [SLIDE FOUND] Retrieved ${results.length} chunks from slide ${slideNumber}`);
        context = results
          .map((r: any) => r.content)
          .filter((c: any) => c && c.trim())
          .join('\n\n');
      } else {
        console.log(`⚠️ [SLIDE NOT FOUND] No content found for slide ${slideNumber}`);
        context = `[Slide ${slideNumber} was not found in the uploaded documents]`;
      }
    } else if (sheetMatch) {
      const sheetNumber = parseInt(sheetMatch[1], 10);
      console.log(`📊 [SHEET DETECTED] User asking about Excel sheet ${sheetNumber}`);
      console.log(`   Using metadata filter instead of semantic search`);

      // Use metadata-based retrieval for specific sheet
      // ⚡ Retrieve MORE chunks (100) to ensure we get all rows from the sheet
      results = await pineconeService.searchBySheetNumber(userId, sheetNumber, 100, attachedDocumentId);

      if (results.length > 0) {
        console.log(`✅ [SHEET FOUND] Retrieved ${results.length} chunks from sheet ${sheetNumber}`);

        // 🐛 DEBUG: Log the actual content of the first 3 chunks
        console.log(`\n📋 [DEBUG] First 3 chunks from sheet ${sheetNumber}:`);
        results.slice(0, 3).forEach((r: any, idx: number) => {
          console.log(`\n   Chunk ${idx + 1}:`);
          console.log(`   Content: ${(r.content || '').substring(0, 200)}...`);
          console.log(`   Metadata:`, JSON.stringify(r.metadata, null, 2));
        });

        context = results
          .map((r: any) => r.content)
          .filter((c: any) => c && c.trim())
          .join('\n\n');

        console.log(`\n📄 [DEBUG] Total context length: ${context.length} characters`);
        console.log(`📄 [DEBUG] Context preview: ${context.substring(0, 500)}...\n`);
      } else {
        console.log(`⚠️ [SHEET NOT FOUND] No content found for sheet ${sheetNumber}`);
        context = `[Sheet ${sheetNumber} was not found in the uploaded documents]`;
      }
    } else {
      // Regular semantic search for general queries
      console.log(`🔍 [SEMANTIC SEARCH] Using standard retrieval`);
      const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);
      results = await pineconeService.searchSimilarChunks(
        queryEmbedding,
        userId,
        intent.retrievalCount || 20,
        0.5,
        attachedDocumentId  // ⚡ Filter by attached document
      );

      context = results
        .map((r: any) => `${r.metadata?.content || r.content || ''}`)
        .filter((c: any) => c.trim())
        .join('\n\n');
    }

    // ⚡ INTELLIGENT SYSTEM PROMPT - Koda's Personal Assistant Identity
    const systemPrompt = `You are Koda, a personal document assistant. Your role is to help users find, understand, and manage their documents.

IMPORTANT RULES:
1. ALWAYS check documents FIRST before using general knowledge
2. When users ask about concepts that match document names (e.g., "lista 11"), refer to THEIR documents, not general definitions
3. If a user asks "what is X" and X matches a document name, talk about THEIR document, not the general concept
4. Be specific about which document you're referencing (always mention the document name)
5. After answering, suggest a helpful next action to guide the user

Document content:
${context || 'No relevant content found in documents.'}

---

Think intelligently about each question before answering:

1. What is the user actually asking for?
   - A quick fact? Give a brief answer.
   - An explanation of one thing? Explain that thing well.
   - An overview of a whole document? Cover the main topics.

2. Is this about THEIR documents or general knowledge?
   - If it's in the documents, answer from the documents and mention which document.
   - If it's general knowledge, give a SHORT, clear explanation (2-3 paragraphs max). Don't write a textbook.

3. How much detail do they need?
   - Simple questions deserve simple answers.
   - Complex questions deserve thorough answers.
   - Use your judgment.

FORMATTING:
Write in short, readable paragraphs with line breaks between them.
Never use bullet points or numbered lists.
For longer answers covering multiple topics, use bold section titles.

HELPFUL SUGGESTIONS:
Always end your response with a helpful suggestion for what the user can do next, such as:
- "Would you like to know more about any specific part of this document?"
- "I can also help you find related documents."
- "Would you like me to summarize another section?"

REMEMBER:
You're a personal assistant having a conversation with a person. Answer naturally with the right amount of detail for what they're asking. Use common sense. Always think before you answer.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 2000,  // Reasonable limit, let AI decide actual length
        temperature: 0.7,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContentStream(fullPrompt);

    let fullResponse = '';

    try {
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        if (chunkText && chunkText.length > 0) {
          onChunk(chunkText);
        }
      }
    } catch (error) {
      console.error('Error streaming document response:', error);
    }

    return {
      answer: fullResponse.trim(),
      sources: results,
    };
  }

  /**
   * Generate hybrid response (general + document knowledge)
   */
  private async generateHybridResponse(
    query: string,
    userId: string,
    intent: QueryIntent
  ): Promise<{ answer: string; sources: any[] }> {
    // Retrieve relevant document chunks
    const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);
    const results = await pineconeService.searchSimilarChunks(
      queryEmbedding,
      userId,
      intent.retrievalCount || 5,
      0.5
    );

    const context = results
      .map((r: any) => `${r.metadata?.content || r.content || ''}`)
      .filter((c: any) => c.trim())
      .join('\n\n');

    const systemPrompt = `You are KODA, an intelligent AI assistant that combines general knowledge with document-specific insights.

The user's question requires both general explanation and specific information from their documents.

Context from user's documents:
${context || 'No relevant content found in documents.'}

Guidelines:
1. First, provide a clear general explanation of the concept/topic
2. Then, show how it applies to or appears in their documents
3. Use the document context to provide specific examples
4. If documents are relevant, cite specific information
5. Be thorough but clear
6. Use markdown formatting with sections

Structure your response like:
**General Explanation**: [concept explanation]
**In Your Documents**: [specific findings from context]`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.5,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return {
      answer: text.trim(),
      sources: results,
    };
  }

  /**
   * Stream hybrid response (general + document knowledge)
   */
  private async streamHybridResponse(
    query: string,
    userId: string,
    intent: QueryIntent,
    onChunk: (chunk: string) => void
  ): Promise<{ answer: string; sources: any[] }> {
    // Retrieve relevant document chunks
    const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);
    const results = await pineconeService.searchSimilarChunks(
      queryEmbedding,
      userId,
      intent.retrievalCount || 5,
      0.5
    );

    const context = results
      .map((r: any) => `${r.metadata?.content || r.content || ''}`)
      .filter((c: any) => c.trim())
      .join('\n\n');

    const systemPrompt = `You are KODA, an intelligent AI assistant that combines general knowledge with document-specific insights.

The user's question requires both general explanation and specific information from their documents.

Context from user's documents:
${context || 'No relevant content found in documents.'}

Guidelines:
1. First, provide a clear general explanation of the concept/topic
2. Then, show how it applies to or appears in their documents
3. Use the document context to provide specific examples
4. If documents are relevant, cite specific information
5. Be thorough but clear
6. Use markdown formatting with sections

Structure your response like:
**General Explanation**: [concept explanation]
**In Your Documents**: [specific findings from context]`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.5,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContentStream(fullPrompt);

    let fullResponse = '';

    try {
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        if (chunkText && chunkText.length > 0) {
          onChunk(chunkText);
        }
      }
    } catch (error) {
      console.error('Error streaming hybrid response:', error);
    }

    return {
      answer: fullResponse.trim(),
      sources: results,
    };
  }

  /**
   * ⚡ NEW: Handle capability questions (user asking about Koda)
   */
  private async streamCapabilityResponse(
    query: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const systemPrompt = `You are Koda, a personal document assistant.

Explain what you can do for the user. Be welcoming, helpful, and specific.

Your capabilities include:
- Finding and providing documents when requested
- Answering questions about document content
- Explaining information from documents
- Helping users discover what documents they have
- Summarizing document content
- Extracting specific information from Excel, PDF, Word, and PowerPoint files

Keep your response friendly, concise (2-3 paragraphs), and actionable.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.8,
      },
    });

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContentStream(fullPrompt);

    let fullResponse = '';
    try {
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        if (chunkText && chunkText.length > 0) {
          onChunk(chunkText);
        }
      }
    } catch (error) {
      console.error('Error streaming capability response:', error);
    }

    return fullResponse.trim();
  }

  /**
   * ⚡ NEW: Handle document request (single document found)
   */
  private async streamDocumentRequestResponse(
    query: string,
    document: DocumentMetadata,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const response = `I found your document **${document.name}**.

You can view or download it using the document card below.

Would you like me to explain what's inside this document?`;

    // Stream the response character by character for smooth animation
    for (const char of response) {
      onChunk(char);
      await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay per character
    }

    return response;
  }

  /**
   * ⚡ NEW: Handle ambiguous document request (multiple documents found)
   */
  private async streamAmbiguousDocumentResponse(
    query: string,
    documents: DocumentMetadata[],
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const docList = documents
      .map((doc, index) => `${index + 1}. **${doc.name}** (${doc.type.toUpperCase()})`)
      .join('\n');

    const response = `I found ${documents.length} documents matching your request:

${docList}

Which one would you like? You can click on the document cards below or tell me the number.`;

    // Stream the response character by character
    for (const char of response) {
      onChunk(char);
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    return response;
  }

  /**
   * ⚡ NEW: Handle document not found
   */
  private async streamDocumentNotFoundResponse(
    query: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const response = `I couldn't find a document matching "${query}" in your files.

You can try:
- Uploading the document if you haven't already
- Checking the spelling of the document name
- Asking me to list your documents with "what documents do I have?"`;

    // Stream the response character by character
    for (const char of response) {
      onChunk(char);
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    return response;
  }

  /**
   * ⚡ NEW: Search for documents by name with fuzzy matching
   * Returns document metadata for frontend display
   */
  private async searchDocumentsByName(
    query: string,
    userId: string
  ): Promise<DocumentMetadata[]> {
    console.log(`🔍 [DOCUMENT SEARCH] Searching for documents matching: "${query}"`);

    // Extract potential document name from query
    // Remove common request keywords
    const cleanQuery = query
      .toLowerCase()
      .replace(/^(give|send|show|get|fetch|provide|share|i want|i need|download|open|access)\s+(me\s+)?/i, '')
      .trim();

    console.log(`   Cleaned query: "${cleanQuery}"`);

    // Search documents in database by filename
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: 'processed',
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        createdAt: true,
      },
    });

    // Filter by filename manually (case-insensitive)
    const filteredDocuments = documents.filter(doc =>
      doc.filename.toLowerCase().includes(cleanQuery.toLowerCase())
    ).slice(0, 10); // Limit to 10 matches

    console.log(`   Found ${filteredDocuments.length} matching documents`);

    // Convert to DocumentMetadata format
    const documentMetadata: DocumentMetadata[] = filteredDocuments.map(doc => ({
      id: doc.id,
      name: doc.filename,
      type: this.getFileType(doc.mimeType),
      mimeType: doc.mimeType,
      previewUrl: `${config.FRONTEND_URL || 'http://localhost:3000'}/documents/${doc.id}`,
      downloadUrl: `http://localhost:5000/api/documents/${doc.id}/stream`,
    }));

    return documentMetadata;
  }

  /**
   * ⚡ NEW: Get file type from mime type
   */
  private getFileType(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'docx';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'xlsx';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'pptx';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('text')) return 'text';
    return 'file';
  }
}

export default new HybridAIService();
// Force restart
