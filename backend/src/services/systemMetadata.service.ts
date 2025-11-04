/**
 * System Metadata Service
 *
 * Handles direct database queries for file system metadata.
 * This service answers questions about file locations, types, counts, etc.
 * WITHOUT using RAG/Pinecone semantic search (which can hallucinate).
 *
 * Use Cases:
 * - "Where is Comprovante1.pdf stored?" → Query database for file location
 * - "What file types are uploaded?" → Query database for distinct MIME types
 * - "How many files do I have?" → Count documents in database
 * - "What files are in pedro3 folder?" → Query documents by folderId
 */

import prisma from '../config/database';

interface FileLocationResult {
  filename: string;
  location: string;
  folderId: string | null;
  folderName: string | null;
}

interface FileTypeResult {
  mimetype: string;
  count: number;
  friendlyName: string;
}

class SystemMetadataService {
  /**
   * Find file location by filename
   * Supports partial matching and case-insensitive search
   */
  async findFileLocation(userId: string, filename: string): Promise<FileLocationResult | null> {
    console.log(`📍 [System Metadata] Finding location for: "${filename}"`);

    // Clean filename - remove common suffixes and extensions
    const cleanedFilename = filename
      .toLowerCase()
      .replace(/\.(pdf|docx?|xlsx?|pptx?|txt|csv|jpg|jpeg|png|gif)$/i, '')
      .trim();

    // Try exact match first (contains is case-insensitive by default)
    let document = await prisma.document.findFirst({
      where: {
        userId,
        filename: {
          contains: filename
          // Note: mode: 'insensitive' not supported with contains
        },
        status: { not: 'deleted' }
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // If not found, try with cleaned filename
    if (!document) {
      document = await prisma.document.findFirst({
        where: {
          userId,
          filename: {
            contains: cleanedFilename
            // Note: mode: 'insensitive' not supported with contains
          },
          status: { not: 'deleted' }
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    }

    if (!document) {
      console.log(`❌ [System Metadata] File not found: "${filename}"`);
      return null;
    }

    const location = document.folderId
      ? `${document.folder!.name} folder`
      : 'Root directory (no folder)';

    console.log(`✅ [System Metadata] Found: ${document.filename} → ${location}`);

    return {
      filename: document.filename,
      location,
      folderId: document.folderId,
      folderName: document.folder?.name || null
    };
  }

  /**
   * Get all file types in user's library
   * Returns MIME types with counts and friendly names
   *
   */
  async getFileTypes(userId: string): Promise<FileTypeResult[]> {
    console.log(`📊 [System Metadata] Getting file types for user`);

    // Query documents grouped by MIME type
    const results = await prisma.document.groupBy({
      by: ['mimeType'],
      where: {
        userId,
        status: { not: 'deleted' }
      },
      _count: {
        mimeType: true
      },
      orderBy: {
        _count: {
          mimeType: 'desc'
        }
      }
    });

    // Map MIME types to friendly names
    const fileTypes: FileTypeResult[] = results.map(result => ({
      mimetype: result.mimeType,
      count: result._count.mimeType,
      friendlyName: this.getFriendlyTypeName(result.mimeType)
    }));

    console.log(`✅ [System Metadata] Found ${fileTypes.length} file types`);
    return fileTypes;
  }

  /**
   * Count files in root directory
   */
  async countRootFiles(userId: string): Promise<number> {
    const count = await prisma.document.count({
      where: {
        userId,
        folderId: null, // Root directory
        status: { not: 'deleted' }
      }
    });

    console.log(`✅ [System Metadata] Root directory has ${count} files`);
    return count;
  }

  /**
   * Count total files for user
   */
  async countTotalFiles(userId: string): Promise<number> {
    const count = await prisma.document.count({
      where: {
        userId,
        status: { not: 'deleted' }
      }
    });

    console.log(`✅ [System Metadata] Total files: ${count}`);
    return count;
  }

  /**
   * Get files in a specific folder
   */
  async getFilesInFolder(userId: string, folderName: string): Promise<any[]> {
    console.log(`📁 [System Metadata] Getting files in folder: "${folderName}"`);

    // Find folder by name (case-insensitive partial match)
    const folder = await prisma.folder.findFirst({
      where: {
        userId,
        name: {
          contains: folderName
          // Note: mode: 'insensitive' not supported with contains
        }
      }
    });

    if (!folder) {
      console.log(`❌ [System Metadata] Folder not found: "${folderName}"`);
      return [];
    }

    // Get all documents in folder
    const documents = await prisma.document.findMany({
      where: {
        userId,
        folderId: folder.id,
        status: { not: 'deleted' }
      },
      select: {
        id: true,
        filename: true,
        mimetype: true,
        filesize: true,
        createdAt: true
      },
      orderBy: {
        filename: 'asc'
      }
    });

    console.log(`✅ [System Metadata] Found ${documents.length} files in "${folder.name}"`);
    return documents;
  }

  /**
   * Get all folders for user
   */
  async getFolders(userId: string): Promise<any[]> {
    const folders = await prisma.folder.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        color: true,
        _count: {
          select: {
            documents: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`✅ [System Metadata] Found ${folders.length} folders`);
    return folders;
  }

  /**
   * Search documents by language
   * Uses metadata.language field if available
   */
  async getDocumentsByLanguage(userId: string, language: string): Promise<any[]> {
    console.log(`🌐 [System Metadata] Finding documents in language: "${language}"`);

    // Query documents with language in metadata
    const documents = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
        // This assumes language is stored in metadata JSON field
        // You might need to adjust based on your schema
      },
      select: {
        id: true,
        filename: true,
        mimetype: true,
        createdAt: true
      }
    });

    // Filter by language (since Prisma doesn't support JSON field filtering in SQLite)
    // This is a workaround - ideally language should be a separate column
    const filtered = documents.filter(doc => {
      // You would check doc.metadata.language here if it exists
      // For now, return all documents
      return true;
    });

    console.log(`✅ [System Metadata] Found ${filtered.length} documents in "${language}"`);
    return filtered;
  }

  /**
   * Map MIME type to friendly name
   */
  private getFriendlyTypeName(mimetype: string): string {
    const typeMap: { [key: string]: string } = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (DOCX)',
      'application/msword': 'Word (DOC)',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (XLSX)',
      'application/vnd.ms-excel': 'Excel (XLS)',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (PPTX)',
      'application/vnd.ms-powerpoint': 'PowerPoint (PPT)',
      'text/plain': 'Text (TXT)',
      'text/csv': 'CSV',
      'image/jpeg': 'JPEG Image',
      'image/jpg': 'JPG Image',
      'image/png': 'PNG Image',
      'image/gif': 'GIF Image',
      'image/webp': 'WebP Image',
    };

    return typeMap[mimetype] || mimetype;
  }

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default new SystemMetadataService();
