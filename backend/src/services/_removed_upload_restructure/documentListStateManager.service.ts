/**
 * ============================================================================
 * DOCUMENT LIST STATE MANAGER SERVICE
 * ============================================================================
 *
 * Memory Engine 3.0 - Manages the list of documents shown to users
 *
 * Purpose:
 * - Store document lists when user asks "show my files", "list documents", etc.
 * - Enable reference resolution like "the first one", "open it", "that document"
 * - Persist state in conversation for multi-turn context
 *
 * Storage Format:
 * documentList: [
 *   { id: "uuid", name: "report.pdf", type: "pdf", index: 0 },
 *   { id: "uuid", name: "data.xlsx", type: "xlsx", index: 1 },
 *   ...
 * ]
 */

import prisma from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentListItem {
  id: string;
  name: string;
  type: string;       // file extension or mime type
  index: number;      // position in list (0-based)
  folderId?: string;
  folderName?: string;
}

export interface DocumentListState {
  documents: DocumentListItem[];
  lastUpdated: string;
  lastDocumentId?: string;  // Last explicitly referenced document
}

// ============================================================================
// DOCUMENT LIST STATE MANAGER
// ============================================================================

class DocumentListStateManager {

  /**
   * Get the document list for a conversation
   */
  public async getDocumentList(conversationId: string): Promise<DocumentListItem[]> {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { documentList: true },
      });

      if (!conversation?.documentList) {
        return [];
      }

      // Parse JSON if needed
      const state = conversation.documentList as unknown as DocumentListState;
      return state?.documents || [];
    } catch (error) {
      console.error('[DocumentListStateManager] Error getting document list:', error);
      return [];
    }
  }

  /**
   * Set the document list for a conversation
   * Called when user asks "show my files", "list documents", etc.
   */
  public async setDocumentList(
    conversationId: string,
    documents: Array<{ id: string; name: string; type?: string; folderId?: string; folderName?: string }>
  ): Promise<void> {
    try {
      // Build indexed document list
      const documentList: DocumentListItem[] = documents.map((doc, index) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type || this.getFileType(doc.name),
        index,
        folderId: doc.folderId,
        folderName: doc.folderName,
      }));

      const state: DocumentListState = {
        documents: documentList,
        lastUpdated: new Date().toISOString(),
      };

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { documentList: state as any },
      });

      console.log(`[DocumentListStateManager] Saved ${documentList.length} documents for conversation ${conversationId}`);
    } catch (error) {
      console.error('[DocumentListStateManager] Error setting document list:', error);
    }
  }

  /**
   * Set the last referenced document ID
   * Called when user explicitly mentions a document by name
   */
  public async setLastDocument(conversationId: string, documentId: string): Promise<void> {
    try {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastDocumentId: documentId },
      });
      console.log(`[DocumentListStateManager] Set last document: ${documentId}`);
    } catch (error) {
      console.error('[DocumentListStateManager] Error setting last document:', error);
    }
  }

  /**
   * Get the last referenced document ID
   */
  public async getLastDocument(conversationId: string): Promise<string | null> {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { lastDocumentId: true },
      });
      return conversation?.lastDocumentId || null;
    } catch (error) {
      console.error('[DocumentListStateManager] Error getting last document:', error);
      return null;
    }
  }

  /**
   * Get document by index (for "the first one", "the second one", etc.)
   */
  public async getDocumentByIndex(conversationId: string, index: number): Promise<DocumentListItem | null> {
    const documents = await this.getDocumentList(conversationId);
    if (index >= 0 && index < documents.length) {
      return documents[index];
    }
    return null;
  }

  /**
   * Get document by name (partial match)
   */
  public async getDocumentByName(conversationId: string, name: string): Promise<DocumentListItem | null> {
    const documents = await this.getDocumentList(conversationId);
    const lowerName = name.toLowerCase();

    // Exact match first
    const exact = documents.find(d => d.name.toLowerCase() === lowerName);
    if (exact) return exact;

    // Partial match
    const partial = documents.find(d => d.name.toLowerCase().includes(lowerName));
    return partial || null;
  }

  /**
   * Clear the document list for a conversation
   */
  public async clearDocumentList(conversationId: string): Promise<void> {
    try {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          documentList: { set: null } as any,
          lastDocumentId: null,
        },
      });
    } catch (error) {
      console.error('[DocumentListStateManager] Error clearing document list:', error);
    }
  }

  /**
   * Helper: Extract file type from filename
   */
  private getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }
}

// Export singleton instance
export const documentListStateManager = new DocumentListStateManager();
export default documentListStateManager;
