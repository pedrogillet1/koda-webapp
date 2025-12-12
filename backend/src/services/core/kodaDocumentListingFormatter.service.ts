/**
 * @file kodaDocumentListingFormatter.service.ts
 * @description
 * Service to format rich document listings with full metadata including dates, size, format,
 * language, topics, and folders. Generates stats blocks summarizing the listing and supports
 * load more pagination markers when total documents exceed those shown.
 *
 * Filenames in listings are rendered bold only (no underline).
 */

import { format as formatDate, parseISO } from 'date-fns';

/**
 * Interface representing a document's metadata.
 */
export interface DocumentMetadata {
  id: string;
  filename: string;
  sizeBytes: number;
  format: string;
  language: string;
  topics: string[];
  folders: string[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Interface representing the formatted document for listing.
 */
export interface FormattedDocument {
  id: string;
  filenameHTML: string;
  sizeFormatted: string;
  format: string;
  language: string;
  topics: string[];
  folders: string[];
  createdAtFormatted: string;
  updatedAtFormatted: string;
}

/**
 * Interface representing the stats block summarizing the document listing.
 */
export interface DocumentStats {
  totalDocuments: number;
  totalSizeFormatted: string;
  uniqueFormats: string[];
  uniqueLanguages: string[];
  uniqueTopics: string[];
  uniqueFolders: string[];
}

/**
 * Interface representing the formatted document listing result.
 */
export interface DocumentListingResult {
  documents: FormattedDocument[];
  stats: DocumentStats;
  loadMoreMarker?: LoadMoreMarker;
}

/**
 * Interface representing the load more pagination marker.
 */
export interface LoadMoreMarker {
  remainingCount: number;
  message: string;
}

/**
 * Service class to format document listings with metadata, stats, and pagination.
 */
export class KodaDocumentListingFormatterService {
  private static readonly DATE_DISPLAY_FORMAT = 'MMM d, yyyy';

  /**
   * Formats a list of documents with full metadata, generates stats block,
   * and adds a load more marker if total documents exceed those shown.
   *
   * @param documents - Array of DocumentMetadata to format.
   * @param totalDocuments - Total number of documents available (may be greater than documents.length).
   * @param maxDocumentsToShow - Maximum number of documents to show before adding load more marker.
   * @returns DocumentListingResult containing formatted documents, stats, and optional load more marker.
   * @throws {Error} Throws if inputs are invalid.
   */
  public formatDocumentListing(
    documents: DocumentMetadata[],
    totalDocuments: number,
    maxDocumentsToShow: number
  ): DocumentListingResult {
    if (!Array.isArray(documents)) {
      throw new Error('Invalid argument: documents must be an array.');
    }
    if (typeof totalDocuments !== 'number' || totalDocuments < 0) {
      throw new Error('Invalid argument: totalDocuments must be a non-negative number.');
    }
    if (typeof maxDocumentsToShow !== 'number' || maxDocumentsToShow <= 0) {
      throw new Error('Invalid argument: maxDocumentsToShow must be a positive number.');
    }

    // Limit documents to maxDocumentsToShow
    const documentsToFormat = documents.slice(0, maxDocumentsToShow);

    // Format each document
    const formattedDocuments = documentsToFormat.map((doc) => this.formatSingleDocument(doc));

    // Generate stats block
    const stats = this.generateStatsBlock(documents);

    // Determine if load more marker is needed
    const remainingCount = totalDocuments - documentsToFormat.length;
    const loadMoreMarker =
      remainingCount > 0
        ? {
            remainingCount,
            message: `Load more (${remainingCount} more document${remainingCount > 1 ? 's' : ''})`,
          }
        : undefined;

    return {
      documents: formattedDocuments,
      stats,
      loadMoreMarker,
    };
  }

  /**
   * Formats a single document's metadata into a display-friendly format.
   * Filename is wrapped in <strong> tags (bold only, no underline).
   *
   * @param doc - DocumentMetadata to format.
   * @returns FormattedDocument with formatted fields.
   */
  private formatSingleDocument(doc: DocumentMetadata): FormattedDocument {
    if (!doc) {
      throw new Error('Invalid document: document cannot be null or undefined.');
    }

    const filenameHTML = `<strong>${this.escapeHTML(doc.filename)}</strong>`;
    const sizeFormatted = this.formatBytes(doc.sizeBytes);
    const createdAtFormatted = this.formatDateString(doc.createdAt);
    const updatedAtFormatted = this.formatDateString(doc.updatedAt);

    return {
      id: doc.id,
      filenameHTML,
      sizeFormatted,
      format: doc.format,
      language: doc.language,
      topics: Array.isArray(doc.topics) ? [...doc.topics] : [],
      folders: Array.isArray(doc.folders) ? [...doc.folders] : [],
      createdAtFormatted,
      updatedAtFormatted,
    };
  }

  /**
   * Generates a stats block summarizing the document listing.
   *
   * @param documents - Array of DocumentMetadata to summarize.
   * @returns DocumentStats with aggregated information.
   */
  private generateStatsBlock(documents: DocumentMetadata[]): DocumentStats {
    const totalDocuments = documents.length;
    const totalSizeBytes = documents.reduce((acc, doc) => acc + (doc.sizeBytes || 0), 0);

    const uniqueFormats = new Set<string>();
    const uniqueLanguages = new Set<string>();
    const uniqueTopics = new Set<string>();
    const uniqueFolders = new Set<string>();

    for (const doc of documents) {
      if (doc.format) uniqueFormats.add(doc.format);
      if (doc.language) uniqueLanguages.add(doc.language);
      if (Array.isArray(doc.topics)) {
        for (const topic of doc.topics) {
          if (topic) uniqueTopics.add(topic);
        }
      }
      if (Array.isArray(doc.folders)) {
        for (const folder of doc.folders) {
          if (folder) uniqueFolders.add(folder);
        }
      }
    }

    return {
      totalDocuments,
      totalSizeFormatted: this.formatBytes(totalSizeBytes),
      uniqueFormats: Array.from(uniqueFormats).sort(),
      uniqueLanguages: Array.from(uniqueLanguages).sort(),
      uniqueTopics: Array.from(uniqueTopics).sort(),
      uniqueFolders: Array.from(uniqueFolders).sort(),
    };
  }

  /**
   * Formats a byte size number into a human-readable string (e.g., "1.2 MB").
   *
   * @param bytes - Number of bytes.
   * @returns Formatted string representing size.
   */
  private formatBytes(bytes: number): string {
    if (typeof bytes !== 'number' || bytes < 0) {
      return '0 B';
    }
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);

    // Show one decimal place for sizes >= 1 KB
    const sizeFormatted = i === 0 ? size.toString() : size.toFixed(1);

    return `${sizeFormatted} ${units[i]}`;
  }

  /**
   * Formats an ISO date string into a human-readable date string.
   *
   * @param isoDate - ISO date string.
   * @returns Formatted date string (e.g., "Jan 15, 2023").
   */
  private formatDateString(isoDate: string): string {
    if (!isoDate) {
      return 'Unknown date';
    }
    try {
      const date = parseISO(isoDate);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return formatDate(date, KodaDocumentListingFormatterService.DATE_DISPLAY_FORMAT);
    } catch {
      return 'Invalid date';
    }
  }

  /**
   * Escapes HTML special characters in a string to prevent XSS.
   *
   * @param str - String to escape.
   * @returns Escaped string safe for HTML insertion.
   */
  private escapeHTML(str: string): string {
    if (typeof str !== 'string') {
      return '';
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
