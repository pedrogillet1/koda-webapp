/**
 * Document Index Service
 * Pre-loads all user documents into context so Koda knows what exists
 * This enables Koda to answer "do I have a paper about X" without RAG retrieval
 */

import prisma from '../config/database';
import cacheService from './cache.service';
import folderSummaryService from './folderSummary.service';

interface DocumentInfo {
  id: string;
  filename: string;
  folderName: string | null;
  folderPath: string | null;
  mimeType: string;
  status: string;
}

interface FolderInfo {
  id: string;
  name: string;
  path: string;
  documentCount: number;
  summary: string;
}

interface DocumentIndex {
  totalDocuments: number;
  completedDocuments: number;
  processingDocuments: number;
  uploadingDocuments: number;
  folders: FolderInfo[];
  documents: DocumentInfo[];
  generatedAt: Date;
}

class DocumentIndexService {
  private readonly CACHE_KEY_PREFIX = 'document_index';
  private readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Get complete document index for a user
   * Returns all documents and folders with their info
   */
  async getDocumentIndex(userId: string): Promise<DocumentIndex> {
    // Check cache first
    const cacheKey = `${this.CACHE_KEY_PREFIX}:${userId}`;
    const cached = await cacheService.get<DocumentIndex>(cacheKey);
    if (cached) {
      console.log(`📋 [DOC INDEX] Cache hit for user ${userId.substring(0, 8)}...`);
      return cached;
    }

    console.log(`📋 [DOC INDEX] Building index for user ${userId.substring(0, 8)}...`);

    // Get all documents with folder info
    const documents = await prisma.documents.findMany({
      where: { userId },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        status: true,
        folders: {
          select: {
            id: true,
            name: true,
            path: true,
          }
        }
      },
      orderBy: { filename: 'asc' }
    });

    // Get all folders with summaries
    const folders = await folderSummaryService.getUserFolderIndex(userId);

    // Count by status
    const statusCounts = {
      completed: 0,
      processing: 0,
      uploading: 0,
    };

    documents.forEach(doc => {
      if (doc.status === 'completed') statusCounts.completed++;
      else if (doc.status === 'processing') statusCounts.processing++;
      else if (doc.status === 'uploading') statusCounts.uploading++;
    });

    const index: DocumentIndex = {
      totalDocuments: documents.length,
      completedDocuments: statusCounts.completed,
      processingDocuments: statusCounts.processing,
      uploadingDocuments: statusCounts.uploading,
      folders,
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        folderName: doc.folders?.name || null,
        folderPath: doc.folders?.path || null,
        mimeType: doc.mimeType,
        status: doc.status,
      })),
      generatedAt: new Date(),
    };

    // Cache the index
    await cacheService.set(cacheKey, index, { ttl: this.CACHE_TTL });
    console.log(`✅ [DOC INDEX] Built index: ${index.totalDocuments} docs, ${index.folders.length} folders`);

    return index;
  }

  /**
   * Build compact context string for LLM prompt injection
   * This is what gets injected into the system prompt
   */
  async buildProactiveContext(userId: string): Promise<string> {
    const index = await this.getDocumentIndex(userId);

    // Build compact summary
    const lines: string[] = [];

    lines.push(`## User's Document Library Overview`);
    lines.push(`Total: ${index.totalDocuments} documents (${index.completedDocuments} indexed, ${index.processingDocuments} processing, ${index.uploadingDocuments} pending)`);
    lines.push('');

    // Folder summaries
    if (index.folders.length > 0) {
      lines.push(`### Folders (${index.folders.length}):`);
      for (const folder of index.folders) {
        lines.push(`- **${folder.name}** (${folder.path}): ${folder.documentCount} files - ${folder.summary}`);
      }
      lines.push('');
    }

    // Document list - compact format
    // Only include completed documents (indexed ones)
    const completedDocs = index.documents.filter(d => d.status === 'completed');

    if (completedDocs.length > 0) {
      lines.push(`### Indexed Documents (${completedDocs.length}):`);

      // Group by folder for better organization
      const byFolder = new Map<string, DocumentInfo[]>();
      for (const doc of completedDocs) {
        const key = doc.folderName || 'Root';
        if (!byFolder.has(key)) {
          byFolder.set(key, []);
        }
        byFolder.get(key)!.push(doc);
      }

      Array.from(byFolder.entries()).forEach(([folderName, docs]) => {
        lines.push(`**${folderName}:**`);
        docs.forEach(doc => {
          // Compact format: just filename (type is inferred from extension)
          lines.push(`  - ${doc.filename}`);
        });
      });
    }

    // Note about pending documents
    if (index.uploadingDocuments > 0 || index.processingDocuments > 0) {
      lines.push('');
      lines.push(`*Note: ${index.uploadingDocuments + index.processingDocuments} documents are still being processed and not yet searchable.*`);
    }

    return lines.join('\n');
  }

  /**
   * Search document index by filename pattern
   * Returns matching documents without using RAG
   */
  async searchByFilename(userId: string, pattern: string): Promise<DocumentInfo[]> {
    const index = await this.getDocumentIndex(userId);
    const lowerPattern = pattern.toLowerCase();

    return index.documents.filter(doc =>
      doc.filename.toLowerCase().includes(lowerPattern)
    );
  }

  /**
   * Check if a document exists by topic/keyword in filename
   * Returns true if any document filename matches
   */
  async hasDocumentAbout(userId: string, topic: string): Promise<{ exists: boolean; matches: DocumentInfo[] }> {
    const matches = await this.searchByFilename(userId, topic);
    return {
      exists: matches.length > 0,
      matches: matches.slice(0, 5), // Return top 5 matches
    };
  }

  /**
   * Invalidate document index cache for a user
   * Call this when documents are added/removed/updated
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}:${userId}`;
    await cacheService.set(cacheKey, null, { ttl: 1 }); // Expire immediately
    console.log(`🗑️ [DOC INDEX] Invalidated cache for user ${userId.substring(0, 8)}...`);
  }
}

export default new DocumentIndexService();
