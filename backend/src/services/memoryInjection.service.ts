/**
 * ============================================================================
 * MEMORY INJECTION SERVICE
 * ============================================================================
 *
 * Memory Engine 3.0 - Injects conversation memory into LLM prompts
 *
 * Purpose:
 * - Add context about documents shown to user
 * - Include last referenced document info
 * - Enhance LLM understanding of conversation state
 *
 * Injection Format:
 * ```
 * [CONVERSATION CONTEXT]
 * The user was previously shown these documents:
 * 1. report.pdf
 * 2. data.xlsx
 * 3. presentation.pptx
 *
 * The user last referenced: report.pdf
 *
 * When the user says "the first one" or "it", they mean one of these documents.
 * [END CONTEXT]
 * ```
 */

import { documentListStateManager, DocumentListItem } from './documentListStateManager.service';
import prisma from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryContext {
  documentList: DocumentListItem[];
  lastDocumentId: string | null;
  lastDocumentName: string | null;
  hasContext: boolean;
}

// ============================================================================
// MEMORY INJECTION SERVICE
// ============================================================================

class MemoryInjectionService {

  /**
   * Get the memory context for a conversation
   */
  public async getMemoryContext(conversationId: string): Promise<MemoryContext> {
    const documentList = await documentListStateManager.getDocumentList(conversationId);
    const lastDocumentId = await documentListStateManager.getLastDocument(conversationId);

    let lastDocumentName: string | null = null;
    if (lastDocumentId && documentList.length > 0) {
      const lastDoc = documentList.find(d => d.id === lastDocumentId);
      lastDocumentName = lastDoc?.name || null;
    }

    return {
      documentList,
      lastDocumentId,
      lastDocumentName,
      hasContext: documentList.length > 0,
    };
  }

  /**
   * Build the memory context string to inject into the prompt
   */
  public buildContextString(context: MemoryContext): string {
    if (!context.hasContext) {
      return '';
    }

    const lines: string[] = [];
    lines.push('[CONVERSATION MEMORY]');

    if (context.documentList.length > 0) {
      lines.push('The user was previously shown these documents:');
      context.documentList.forEach((doc, index) => {
        lines.push(`${index + 1}. ${doc.name}`);
      });
      lines.push('');
    }

    if (context.lastDocumentName) {
      lines.push(`The user last referenced: "${context.lastDocumentName}"`);
      lines.push('');
    }

    lines.push('IMPORTANT: When the user says "the first one", "the second document", "it", "this", or "that document", they are referring to one of these documents.');
    lines.push('DO NOT ask for clarification if the reference is clear from the list above.');
    lines.push('[END MEMORY]');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Inject memory context into a prompt
   */
  public async injectMemory(conversationId: string, prompt: string): Promise<string> {
    const context = await this.getMemoryContext(conversationId);

    if (!context.hasContext) {
      return prompt;
    }

    const contextString = this.buildContextString(context);
    console.log(`[MemoryInjection] Injecting context with ${context.documentList.length} documents`);

    return `${contextString}\n${prompt}`;
  }

  /**
   * Build a system message with memory context
   */
  public async buildSystemMemoryPrompt(conversationId: string): Promise<string | null> {
    const context = await this.getMemoryContext(conversationId);

    if (!context.hasContext) {
      return null;
    }

    return this.buildContextString(context);
  }

  /**
   * Get recent conversation history with memory context
   */
  public async getConversationWithMemory(
    conversationId: string,
    messageLimit: number = 10
  ): Promise<{
    messages: Array<{ role: string; content: string }>;
    memoryContext: MemoryContext;
  }> {
    // Get recent messages
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: messageLimit,
      select: {
        role: true,
        content: true,
      },
    });

    // Reverse to get chronological order
    const chronologicalMessages = messages.reverse();

    // Get memory context
    const memoryContext = await this.getMemoryContext(conversationId);

    return {
      messages: chronologicalMessages,
      memoryContext,
    };
  }

  /**
   * Create an enhanced prompt with document context for the LLM
   */
  public async createEnhancedPrompt(
    conversationId: string,
    userQuery: string,
    resolvedDocumentName?: string
  ): Promise<string> {
    const context = await this.getMemoryContext(conversationId);

    let enhancedPrompt = userQuery;

    // If a document reference was resolved, make it explicit
    if (resolvedDocumentName) {
      enhancedPrompt = `[The user is referring to the document "${resolvedDocumentName}"]\n\n${userQuery}`;
    }

    // Add document list context if available
    if (context.hasContext) {
      const contextString = this.buildContextString(context);
      enhancedPrompt = `${contextString}\nUser query: ${enhancedPrompt}`;
    }

    return enhancedPrompt;
  }
}

// Export singleton instance
export const memoryInjectionService = new MemoryInjectionService();
export default memoryInjectionService;
