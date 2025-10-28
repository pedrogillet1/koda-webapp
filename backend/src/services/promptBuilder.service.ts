/**
 * Prompt Builder Service
 * Constructs context-aware AI prompts based on query intent
 * Provides clear instructions to the AI about folder/category scope
 */

import { QueryIntent } from './queryParser.service';
import { RerankResult } from './reranker.service';

export interface PromptContext {
  intent: QueryIntent;
  folderName?: string;
  categoryName?: string;
  documentName?: string;
  searchTerm?: string;
  retrievedChunks: RerankResult[];
  conversationHistory?: Array<{ role: string; content: string }>;
}

export class PromptBuilderService {

  /**
   * Build system prompt with context awareness
   */
  buildSystemPrompt(context: PromptContext): string {
    const basePrompt = `You are KODA, an intelligent document assistant. Your role is to help users understand and find information in their documents.

IMPORTANT INSTRUCTIONS:
- Always base your answers on the provided document context
- If information isn't in the context, say so clearly
- Be concise and direct in your responses
- Cite specific documents when referencing information`;

    // Add folder-specific instructions
    if (context.folderName && context.intent !== QueryIntent.GENERAL_SEARCH) {
      return `${basePrompt}

FOLDER SCOPE:
You are currently helping with folder "${context.folderName}".
- ONLY use information from documents in this folder
- If asked about other folders, politely clarify that you're focused on "${context.folderName}"
- All retrieved documents are from this folder`;
    }

    // Add category-specific instructions
    if (context.categoryName) {
      return `${basePrompt}

CATEGORY SCOPE:
You are helping with category "${context.categoryName}".
- Focus on documents in this category
- Provide category-specific insights when relevant`;
    }

    return basePrompt;
  }

  /**
   * Build user prompt with retrieved context
   */
  buildUserPrompt(
    userQuery: string,
    context: PromptContext
  ): string {
    const { intent, folderName, searchTerm, retrievedChunks } = context;

    // Format retrieved chunks
    const formattedChunks = this.formatRetrievedChunks(retrievedChunks);

    // Build prompt based on intent
    switch (intent) {
      case QueryIntent.FOLDER_LIST:
        return this.buildFolderListPrompt(userQuery, folderName!, formattedChunks);

      case QueryIntent.FOLDER_SEARCH:
        return this.buildFolderSearchPrompt(
          userQuery,
          folderName!,
          searchTerm!,
          formattedChunks
        );

      case QueryIntent.FOLDER_SUMMARY:
        return this.buildFolderSummaryPrompt(userQuery, folderName!, formattedChunks);

      case QueryIntent.GENERAL_SEARCH:
      default:
        return this.buildGeneralSearchPrompt(userQuery, formattedChunks);
    }
  }

  /**
   * Build prompt for "What's in folder X?" queries
   */
  private buildFolderListPrompt(
    query: string,
    folderName: string,
    chunks: string
  ): string {
    return `The user asked: "${query}"

FOLDER: ${folderName}

RELEVANT DOCUMENTS AND CONTENT:
${chunks}

Please provide a helpful overview of what's in this folder. List the main documents and briefly describe their key content or purpose. Organize your response in a clear, scannable format.`;
  }

  /**
   * Build prompt for "Find X in folder Y" queries
   */
  private buildFolderSearchPrompt(
    query: string,
    folderName: string,
    searchTerm: string,
    chunks: string
  ): string {
    return `The user is searching for information about "${searchTerm}" in folder "${folderName}".

Original query: "${query}"

RELEVANT CONTENT FROM FOLDER "${folderName}":
${chunks}

Please answer the user's question based on the documents in this folder. Focus specifically on information related to "${searchTerm}". If the information isn't found in these documents, say so clearly.`;
  }

  /**
   * Build prompt for "Summarize folder X" queries
   */
  private buildFolderSummaryPrompt(
    query: string,
    folderName: string,
    chunks: string
  ): string {
    return `The user asked for a summary of folder "${folderName}".

Original query: "${query}"

CONTENT FROM FOLDER "${folderName}":
${chunks}

Please provide a comprehensive summary of this folder. Include:
1. Main themes or topics covered
2. Key documents and their purposes
3. Any important findings or insights
4. Overall organization and structure

Keep it concise but informative.`;
  }

  /**
   * Build prompt for general search queries (no folder scope)
   */
  private buildGeneralSearchPrompt(query: string, chunks: string): string {
    return `The user asked: "${query}"

RELEVANT DOCUMENT CONTENT:
${chunks}

Please answer the user's question based on the provided context. Be specific and cite documents when relevant.`;
  }

  /**
   * Format retrieved chunks for the prompt
   */
  private formatRetrievedChunks(chunks: RerankResult[]): string {
    if (chunks.length === 0) {
      return '[No relevant documents found]';
    }

    return chunks
      .map((chunk, idx) => {
        const docName = chunk.filename || 'Unknown Document';
        const content = chunk.content || '';
        const page = chunk.metadata?.pageNumber || chunk.pageNumber || '?';

        return `
[Document ${idx + 1}: ${docName} (Page ${page})]
${content.trim()}
---`;
      })
      .join('\n');
  }

  /**
   * Build complete prompt for AI
   */
  buildCompletePrompt(
    userQuery: string,
    context: PromptContext
  ): { systemPrompt: string; userPrompt: string } {
    return {
      systemPrompt: this.buildSystemPrompt(context),
      userPrompt: this.buildUserPrompt(userQuery, context)
    };
  }
}

// Export singleton instance
export default new PromptBuilderService();
