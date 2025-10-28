/**
 * Conversation Context Service
 * Manages conversation-level context (folder/category scope)
 * Persists context across messages in a conversation
 */

import { PrismaClient, Conversation } from '@prisma/client';

const prisma = new PrismaClient();

export type ContextType = 'folder' | 'category' | 'document' | null;

export interface ConversationContext {
  type: ContextType;
  id: string | null;
  name: string | null;
  meta?: any;
}

export class ConversationContextService {

  /**
   * Save context to conversation
   */
  async saveContext(
    conversationId: string,
    context: ConversationContext
  ): Promise<Conversation> {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        contextType: context.type,
        contextId: context.id,
        contextName: context.name,
        contextMeta: context.meta || null
      }
    });
  }

  /**
   * Get current context for conversation
   */
  async getContext(conversationId: string): Promise<ConversationContext | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        contextType: true,
        contextId: true,
        contextName: true,
        contextMeta: true
      }
    });

    if (!conversation || !conversation.contextType || !conversation.contextId) {
      return null;
    }

    return {
      type: conversation.contextType as ContextType,
      id: conversation.contextId,
      name: conversation.contextName,
      meta: conversation.contextMeta
    };
  }

  /**
   * Clear context from conversation
   */
  async clearContext(conversationId: string): Promise<Conversation> {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        contextType: null,
        contextId: null,
        contextName: null,
        contextMeta: null
      }
    });
  }

  /**
   * Check if conversation has active context
   */
  async hasContext(conversationId: string): Promise<boolean> {
    const context = await this.getContext(conversationId);
    return context !== null;
  }

  /**
   * Get context display string for user
   */
  async getContextDisplay(conversationId: string): Promise<string | null> {
    const context = await this.getContext(conversationId);
    
    if (!context) {
      return null;
    }

    switch (context.type) {
      case 'folder':
        return `📁 Folder: ${context.name}`;
      case 'category':
        return `📂 Category: ${context.name}`;
      case 'document':
        return `📄 Document: ${context.name}`;
      default:
        return null;
    }
  }

  /**
   * Validate that context entity still exists
   */
  async validateContext(conversationId: string): Promise<boolean> {
    const context = await this.getContext(conversationId);
    
    if (!context || !context.id) {
      return false;
    }

    try {
      switch (context.type) {
        case 'folder':
          const folder = await prisma.folder.findUnique({
            where: { id: context.id }
          });
          return folder !== null;

        case 'category':
          const category = await prisma.category.findUnique({
            where: { id: context.id }
          });
          return category !== null;

        case 'document':
          const document = await prisma.document.findUnique({
            where: { id: context.id }
          });
          return document !== null;

        default:
          return false;
      }
    } catch (error) {
      console.error('Error validating context:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new ConversationContextService();
