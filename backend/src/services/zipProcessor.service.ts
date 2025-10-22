/**
 * ZIP Processor Service
 * Extracts and processes all files from ZIP archives
 * - Recursive extraction of nested ZIPs
 * - Process each file with appropriate extractor
 * - Combine all content into single markdown document
 * - Preserve directory structure in output
 * - Support for password-protected ZIPs (if password provided)
 */

import AdmZip from 'adm-zip';
import path from 'path';
import { ExtractionResult, extractText } from './textExtraction.service';
import htmlProcessor from './htmlProcessor.service';
import csvProcessor from './csvProcessor.service';

interface ProcessedFile {
  path: string;
  filename: string;
  type: string;
  size: number;
  content: string;
  success: boolean;
  error?: string;
}

interface ZIPExtractionResult extends ExtractionResult {
  fileCount?: number;
  successCount?: number;
  failedCount?: number;
  processedFiles?: ProcessedFile[];
}

class ZIPProcessorService {
  private readonly SUPPORTED_EXTENSIONS = new Set([
    '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
    '.txt', '.md', '.csv', '.html', '.htm',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.bmp'
  ]);

  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
  private readonly MAX_TOTAL_FILES = 100; // Maximum number of files to process

  /**
   * Process ZIP archive and extract all supported files
   */
  async processZIP(buffer: Buffer, password?: string): Promise<ZIPExtractionResult> {
    try {
      console.log('📦 [ZIP Processor] Processing ZIP archive...');
      console.log(`   Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Load ZIP archive
      const zip = new AdmZip(buffer);

      // Get all entries
      const entries = zip.getEntries();
      console.log(`   Found ${entries.length} entries`);

      // Filter out directories and get only files
      const fileEntries = entries.filter(entry => !entry.isDirectory);
      console.log(`   ${fileEntries.length} files (${entries.length - fileEntries.length} directories)`);

      // Filter supported files
      const supportedFiles = fileEntries.filter(entry => {
        const ext = path.extname(entry.entryName).toLowerCase();
        return this.SUPPORTED_EXTENSIONS.has(ext);
      });

      console.log(`   ${supportedFiles.length} supported files for processing`);

      if (supportedFiles.length === 0) {
        return {
          text: '# ZIP Archive\n\nNo supported files found in archive.',
          wordCount: 0,
          confidence: 1.0,
          fileCount: fileEntries.length,
          successCount: 0,
          failedCount: 0,
          processedFiles: [],
        };
      }

      // Limit number of files
      const filesToProcess = supportedFiles.slice(0, this.MAX_TOTAL_FILES);
      if (supportedFiles.length > this.MAX_TOTAL_FILES) {
        console.warn(`   ⚠️ Limiting to first ${this.MAX_TOTAL_FILES} files`);
      }

      // Process each file
      const processedFiles: ProcessedFile[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (const entry of filesToProcess) {
        try {
          const result = await this.processEntry(zip, entry, password);
          processedFiles.push(result);

          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error: any) {
          console.error(`❌ Failed to process ${entry.entryName}:`, error.message);
          processedFiles.push({
            path: entry.entryName,
            filename: path.basename(entry.entryName),
            type: path.extname(entry.entryName),
            size: entry.header.size,
            content: '',
            success: false,
            error: error.message,
          });
          failedCount++;
        }
      }

      // Create combined markdown
      const markdown = this.createCombinedMarkdown(processedFiles, fileEntries.length);
      const wordCount = markdown.split(/\s+/).filter(w => w.length > 0).length;

      console.log(`✅ [ZIP Processor] Processed ${successCount}/${filesToProcess.length} files successfully`);
      if (failedCount > 0) {
        console.warn(`   ⚠️ ${failedCount} files failed to process`);
      }

      return {
        text: markdown,
        wordCount,
        confidence: successCount / filesToProcess.length,
        fileCount: fileEntries.length,
        successCount,
        failedCount,
        processedFiles,
      };
    } catch (error: any) {
      console.error('❌ [ZIP Processor] Error:', error);

      if (error.message?.includes('encrypted') || error.message?.includes('password')) {
        throw new Error('ZIP file is password-protected. Please provide the password.');
      }

      throw new Error(`Failed to process ZIP archive: ${error.message}`);
    }
  }

  /**
   * Process a single entry from the ZIP
   */
  private async processEntry(zip: AdmZip, entry: AdmZip.IZipEntry, password?: string): Promise<ProcessedFile> {
    const filename = path.basename(entry.entryName);
    const ext = path.extname(entry.entryName).toLowerCase();
    const size = entry.header.size;

    console.log(`   📄 Processing: ${entry.entryName} (${(size / 1024).toFixed(1)} KB)`);

    // Check file size
    if (size > this.MAX_FILE_SIZE) {
      throw new Error(`File too large (${(size / 1024 / 1024).toFixed(1)} MB > ${this.MAX_FILE_SIZE / 1024 / 1024} MB)`);
    }

    try {
      // Extract file data
      const fileData: Buffer = entry.getData();

      // Determine MIME type from extension
      const mimeType = this.getMimeType(ext);

      // Process based on file type
      let result: ExtractionResult;

      if (ext === '.html' || ext === '.htm') {
        result = await htmlProcessor.processHTML(fileData);
      } else if (ext === '.csv') {
        result = await csvProcessor.processCSV(fileData);
      } else {
        result = await extractText(fileData, mimeType);
      }

      return {
        path: entry.entryName,
        filename,
        type: ext,
        size,
        content: result.text,
        success: true,
      };
    } catch (error: any) {
      throw new Error(`Failed to extract ${filename}: ${error.message}`);
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.txt': 'text/plain',
      '.md': 'text/plain',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.bmp': 'image/bmp',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Create combined markdown document from all processed files
   */
  private createCombinedMarkdown(processedFiles: ProcessedFile[], totalFiles: number): string {
    let markdown = '# ZIP Archive Contents\n\n';

    // Add summary
    const successFiles = processedFiles.filter(f => f.success);
    const failedFiles = processedFiles.filter(f => !f.success);

    markdown += '## Summary\n\n';
    markdown += `- **Total Files in Archive:** ${totalFiles}\n`;
    markdown += `- **Processed Files:** ${processedFiles.length}\n`;
    markdown += `- **Successfully Extracted:** ${successFiles.length}\n`;
    if (failedFiles.length > 0) {
      markdown += `- **Failed to Extract:** ${failedFiles.length}\n`;
    }
    markdown += '\n';

    // Add file listing
    markdown += '## Files Processed\n\n';
    processedFiles.forEach((file, index) => {
      const status = file.success ? '✅' : '❌';
      markdown += `${index + 1}. ${status} \`${file.path}\` (${(file.size / 1024).toFixed(1)} KB)`;
      if (file.error) {
        markdown += ` - *Error: ${file.error}*`;
      }
      markdown += '\n';
    });
    markdown += '\n---\n\n';

    // Add content from each file
    successFiles.forEach((file, index) => {
      markdown += `## File ${index + 1}: ${file.filename}\n\n`;
      markdown += `**Path:** \`${file.path}\`\n`;
      markdown += `**Type:** ${file.type}\n`;
      markdown += `**Size:** ${(file.size / 1024).toFixed(1)} KB\n\n`;
      markdown += '### Content\n\n';
      markdown += file.content + '\n\n';
      markdown += '---\n\n';
    });

    // Add failed files section if any
    if (failedFiles.length > 0) {
      markdown += '## Failed Files\n\n';
      failedFiles.forEach((file, index) => {
        markdown += `${index + 1}. **${file.filename}** (\`${file.path}\`)\n`;
        markdown += `   - Error: ${file.error}\n`;
      });
      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Get list of files in ZIP without extracting
   */
  async listFiles(buffer: Buffer): Promise<string[]> {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    return entries
      .filter(entry => !entry.isDirectory)
      .map(entry => entry.entryName);
  }

  /**
   * Check if ZIP is password-protected
   */
  isPasswordProtected(buffer: Buffer): boolean {
    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.header.flags & 0x01) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}

export default new ZIPProcessorService();
