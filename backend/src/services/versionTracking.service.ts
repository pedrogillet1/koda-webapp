/**
 * Version Tracking Service - Phase 2 Week 7-8
 * Handles document versioning and temporal awareness
 * Enables KODA to track document versions and answer time-based queries
 */

import prisma from '../config/database';

export interface DocumentVersion {
  id: string;
  filename: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isLatest: boolean;
  parentVersionId: string | null;
}

export interface VersionComparison {
  oldVersion: DocumentVersion;
  newVersion: DocumentVersion;
  changesSummary: string;
  timeDifference: string;
}

export interface TemporalQuery {
  isTemporalQuery: boolean;
  queryType: 'latest' | 'specific_version' | 'changes_since' | 'previous' | 'history' | null;
  documentName?: string;
  timeReference?: Date;
  versionNumber?: number;
}

class VersionTrackingService {
  /**
   * Detect if query has temporal intent
   */
  detectTemporalIntent(query: string): TemporalQuery {
    const queryLower = query.toLowerCase();

    // Latest version patterns
    if (
      /latest|newest|current|most recent/i.test(queryLower)
    ) {
      return {
        isTemporalQuery: true,
        queryType: 'latest',
        documentName: this.extractDocumentName(query)
      };
    }

    // Previous version patterns
    if (
      /previous|old|earlier|prior|before/i.test(queryLower)
    ) {
      return {
        isTemporalQuery: true,
        queryType: 'previous',
        documentName: this.extractDocumentName(query)
      };
    }

    // Changes/comparison patterns
    if (
      /changes?|difference|compare|what.*(changed|updated|modified)/i.test(queryLower) &&
      /since|from|between|version/i.test(queryLower)
    ) {
      return {
        isTemporalQuery: true,
        queryType: 'changes_since',
        documentName: this.extractDocumentName(query),
        timeReference: this.extractTimeReference(query)
      };
    }

    // Version history patterns
    if (
      /history|versions?|all.*versions?|revisions?/i.test(queryLower)
    ) {
      return {
        isTemporalQuery: true,
        queryType: 'history',
        documentName: this.extractDocumentName(query)
      };
    }

    // Specific version patterns
    const versionMatch = queryLower.match(/version\s*(\d+)/);
    if (versionMatch) {
      return {
        isTemporalQuery: true,
        queryType: 'specific_version',
        versionNumber: parseInt(versionMatch[1]),
        documentName: this.extractDocumentName(query)
      };
    }

    return {
      isTemporalQuery: false,
      queryType: null
    };
  }

  /**
   * Extract document name from query
   */
  private extractDocumentName(query: string): string | undefined {
    // Look for quoted document names
    const quotedMatch = query.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }

    // Look for common document patterns
    const docMatch = query.match(/(?:document|file|doc)\s+([a-zA-Z0-9_\-\.]+)/i);
    if (docMatch) {
      return docMatch[1];
    }

    return undefined;
  }

  /**
   * Extract time reference from query
   */
  private extractTimeReference(query: string): Date | undefined {
    const now = new Date();

    // Yesterday
    if (/yesterday/i.test(query)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Last week
    if (/last week/i.test(query)) {
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return lastWeek;
    }

    // Last month
    if (/last month/i.test(query)) {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return lastMonth;
    }

    // Specific date pattern (e.g., "since Jan 15", "after 2024-01-15")
    const dateMatch = query.match(/(?:since|after|from)\s+(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return new Date(dateMatch[1]);
    }

    return undefined;
  }

  /**
   * Get document version history
   */
  async getVersionHistory(
    userId: string,
    documentId: string
  ): Promise<DocumentVersion[]> {
    // Get the document and all its versions
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId
      },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!document) {
      return [];
    }

    // Build version tree
    const versions: DocumentVersion[] = [];
    let currentDoc = document;
    let versionNumber = 1;

    // Add current document as latest version
    versions.push({
      id: currentDoc.id,
      filename: currentDoc.filename,
      createdAt: currentDoc.createdAt,
      updatedAt: currentDoc.updatedAt,
      version: versionNumber,
      isLatest: true,
      parentVersionId: currentDoc.parentVersionId
    });

    // Add all child versions
    for (const version of currentDoc.versions) {
      versionNumber++;
      versions.push({
        id: version.id,
        filename: version.filename,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        version: versionNumber,
        isLatest: false,
        parentVersionId: version.parentVersionId
      });
    }

    return versions;
  }

  /**
   * Get latest version of a document by name
   */
  async getLatestVersion(
    userId: string,
    documentName: string
  ): Promise<DocumentVersion | null> {
    const document = await prisma.document.findFirst({
      where: {
        userId,
        filename: {
          contains: documentName,
          mode: 'insensitive'
        },
        status: 'completed'
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (!document) {
      return null;
    }

    return {
      id: document.id,
      filename: document.filename,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      version: 1, // Latest is always version 1
      isLatest: true,
      parentVersionId: document.parentVersionId
    };
  }

  /**
   * Get previous version of a document
   */
  async getPreviousVersion(
    userId: string,
    documentId: string
  ): Promise<DocumentVersion | null> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId
      }
    });

    if (!document || !document.parentVersionId) {
      return null;
    }

    const parentDoc = await prisma.document.findFirst({
      where: {
        id: document.parentVersionId,
        userId
      }
    });

    if (!parentDoc) {
      return null;
    }

    return {
      id: parentDoc.id,
      filename: parentDoc.filename,
      createdAt: parentDoc.createdAt,
      updatedAt: parentDoc.updatedAt,
      version: 0, // Previous version
      isLatest: false,
      parentVersionId: parentDoc.parentVersionId
    };
  }

  /**
   * Compare two document versions
   */
  async compareVersions(
    userId: string,
    oldVersionId: string,
    newVersionId: string
  ): Promise<VersionComparison | null> {
    const [oldDoc, newDoc] = await Promise.all([
      prisma.document.findFirst({
        where: { id: oldVersionId, userId }
      }),
      prisma.document.findFirst({
        where: { id: newVersionId, userId }
      })
    ]);

    if (!oldDoc || !newDoc) {
      return null;
    }

    // Calculate time difference
    const timeDiff = newDoc.updatedAt.getTime() - oldDoc.updatedAt.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let timeDifference = '';
    if (days > 0) {
      timeDifference = `${days} day${days > 1 ? 's' : ''}`;
      if (hours > 0) {
        timeDifference += ` and ${hours} hour${hours > 1 ? 's' : ''}`;
      }
    } else if (hours > 0) {
      timeDifference = `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const minutes = Math.floor(timeDiff / (1000 * 60));
      timeDifference = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    // Generate change summary
    let changesSummary = `Updated ${timeDifference} ago`;
    if (oldDoc.fileSize !== newDoc.fileSize) {
      const sizeDiff = newDoc.fileSize - oldDoc.fileSize;
      const sizeDiffKB = Math.abs(sizeDiff / 1024).toFixed(2);
      changesSummary += `. File size ${sizeDiff > 0 ? 'increased' : 'decreased'} by ${sizeDiffKB}KB`;
    }

    return {
      oldVersion: {
        id: oldDoc.id,
        filename: oldDoc.filename,
        createdAt: oldDoc.createdAt,
        updatedAt: oldDoc.updatedAt,
        version: 1,
        isLatest: false,
        parentVersionId: oldDoc.parentVersionId
      },
      newVersion: {
        id: newDoc.id,
        filename: newDoc.filename,
        createdAt: newDoc.createdAt,
        updatedAt: newDoc.updatedAt,
        version: 2,
        isLatest: true,
        parentVersionId: newDoc.parentVersionId
      },
      changesSummary,
      timeDifference
    };
  }

  /**
   * Get documents changed since a specific date
   */
  async getDocumentsChangedSince(
    userId: string,
    since: Date
  ): Promise<DocumentVersion[]> {
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: 'completed',
        updatedAt: {
          gte: since
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: 1,
      isLatest: true,
      parentVersionId: doc.parentVersionId
    }));
  }

  /**
   * Find document by name (fuzzy matching)
   */
  async findDocumentByName(
    userId: string,
    documentName: string
  ): Promise<{ id: string; filename: string } | null> {
    const document = await prisma.document.findFirst({
      where: {
        userId,
        filename: {
          contains: documentName,
          mode: 'insensitive'
        },
        status: 'completed'
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        filename: true
      }
    });

    return document;
  }

  /**
   * Check if document has versions
   */
  async hasVersions(documentId: string): Promise<boolean> {
    const count = await prisma.document.count({
      where: {
        OR: [
          { parentVersionId: documentId },
          { id: documentId, parentVersionId: { not: null } }
        ]
      }
    });

    return count > 0;
  }
}

export const versionTrackingService = new VersionTrackingService();
export default versionTrackingService;
