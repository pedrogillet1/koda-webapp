/**
 * Metadata Extraction Service
 * Extracts comprehensive metadata from documents
 *
 * Features:
 * - File properties (author, creation date, modification date)
 * - Content analysis (language, topics, entities)
 * - Document statistics (page count, word count, file size)
 * - Type-specific metadata (tables, images, signatures)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface DocumentMetadata {
  filename: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  uploadDate: Date;

  // Extracted properties
  author?: string;
  creationDate?: Date;
  modificationDate?: Date;

  // Content statistics
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;

  // Language detection
  language?: string;

  // AI-generated metadata
  topics?: string[];
  entities?: string[];
  summary?: string;

  // Content flags
  hasSignature?: boolean;
  hasTables?: boolean;
  hasImages?: boolean;
}

class MetadataExtractionService {
  /**
   * Extract metadata from document buffer
   */
  async extractMetadata(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    extractedText: string
  ): Promise<DocumentMetadata> {
    console.log(`📊 [MetadataExtraction] Extracting metadata for ${filename}...`);

    const baseMetadata: DocumentMetadata = {
      filename,
      fileType: this.getFileType(mimeType),
      fileSize: buffer.length,
      mimeType,
      uploadDate: new Date(),
    };

    try {
      // Extract type-specific metadata
      const typeSpecificMetadata = await this.extractTypeSpecificMetadata(buffer, mimeType);

      // Extract content-based metadata
      const contentMetadata = await this.extractContentMetadata(extractedText);

      // Detect language
      const language = this.detectLanguage(extractedText);

      // Extract entities and topics using AI
      const aiMetadata = await this.extractAIMetadata(extractedText);

      const fullMetadata = {
        ...baseMetadata,
        ...typeSpecificMetadata,
        ...contentMetadata,
        language,
        ...aiMetadata,
      };

      console.log(`✅ [MetadataExtraction] Extracted metadata for ${filename}`);
      return fullMetadata;
    } catch (error) {
      console.error(`❌ [MetadataExtraction] Error extracting metadata:`, error);
      return baseMetadata;
    }
  }

  /**
   * Extract type-specific metadata based on file type
   */
  private async extractTypeSpecificMetadata(
    buffer: Buffer,
    mimeType: string
  ): Promise<Partial<DocumentMetadata>> {
    switch (mimeType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.extractWordMetadata(buffer);

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await this.extractExcelMetadata(buffer);

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return await this.extractPowerPointMetadata(buffer);

      case 'application/pdf':
        return await this.extractPDFMetadata(buffer);

      default:
        return {};
    }
  }

  /**
   * Extract Word document metadata
   */
  private async extractWordMetadata(buffer: Buffer): Promise<Partial<DocumentMetadata>> {
    try {
      const AdmZip = require('adm-zip');
      const xml2js = require('xml2js');

      const zip = new AdmZip(buffer);
      const coreXml = zip.readAsText('docProps/core.xml');
      const appXml = zip.readAsText('docProps/app.xml');

      const parser = new xml2js.Parser();
      const coreData = await parser.parseStringPromise(coreXml);
      const appData = await parser.parseStringPromise(appXml);

      const metadata: Partial<DocumentMetadata> = {};

      // Extract author
      if (coreData['cp:coreProperties']?.['dc:creator']) {
        metadata.author = coreData['cp:coreProperties']['dc:creator'][0];
      }

      // Extract dates
      if (coreData['cp:coreProperties']?.['dcterms:created']) {
        metadata.creationDate = new Date(coreData['cp:coreProperties']['dcterms:created'][0]['_']);
      }
      if (coreData['cp:coreProperties']?.['dcterms:modified']) {
        metadata.modificationDate = new Date(coreData['cp:coreProperties']['dcterms:modified'][0]['_']);
      }

      // Extract page count
      if (appData['Properties']?.['Pages']) {
        metadata.pageCount = parseInt(appData['Properties']['Pages'][0], 10);
      }

      return metadata;
    } catch (error) {
      console.warn('⚠️ [MetadataExtraction] Failed to extract Word metadata:', error);
      return {};
    }
  }

  /**
   * Extract Excel metadata
   */
  private async extractExcelMetadata(buffer: Buffer): Promise<Partial<DocumentMetadata>> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const metadata: Partial<DocumentMetadata> = {
        pageCount: workbook.SheetNames.length, // Sheet count as "pages"
        hasTables: true, // Excel always has tables
      };

      return metadata;
    } catch (error) {
      console.warn('⚠️ [MetadataExtraction] Failed to extract Excel metadata:', error);
      return {};
    }
  }

  /**
   * Extract PowerPoint metadata
   */
  private async extractPowerPointMetadata(buffer: Buffer): Promise<Partial<DocumentMetadata>> {
    try {
      const AdmZip = require('adm-zip');
      const xml2js = require('xml2js');

      const zip = new AdmZip(buffer);
      const coreXml = zip.readAsText('docProps/core.xml');
      const appXml = zip.readAsText('docProps/app.xml');

      const parser = new xml2js.Parser();
      const coreData = await parser.parseStringPromise(coreXml);
      const appData = await parser.parseStringPromise(appXml);

      const metadata: Partial<DocumentMetadata> = {};

      // Extract author
      if (coreData['cp:coreProperties']?.['dc:creator']) {
        metadata.author = coreData['cp:coreProperties']['dc:creator'][0];
      }

      // Extract dates
      if (coreData['cp:coreProperties']?.['dcterms:created']) {
        metadata.creationDate = new Date(coreData['cp:coreProperties']['dcterms:created'][0]['_']);
      }

      // Extract slide count
      if (appData['Properties']?.['Slides']) {
        metadata.pageCount = parseInt(appData['Properties']['Slides'][0], 10);
      }

      metadata.hasImages = true; // PPTs usually have images

      return metadata;
    } catch (error) {
      console.warn('⚠️ [MetadataExtraction] Failed to extract PowerPoint metadata:', error);
      return {};
    }
  }

  /**
   * Extract PDF metadata
   */
  private async extractPDFMetadata(buffer: Buffer): Promise<Partial<DocumentMetadata>> {
    try {
      // Basic PDF metadata extraction
      // For more advanced extraction, could use pdf-lib or similar
      return {
        hasImages: true, // Assume PDFs may have images
      };
    } catch (error) {
      console.warn('⚠️ [MetadataExtraction] Failed to extract PDF metadata:', error);
      return {};
    }
  }

  /**
   * Extract content-based metadata
   */
  private async extractContentMetadata(text: string): Promise<Partial<DocumentMetadata>> {
    const metadata: Partial<DocumentMetadata> = {
      wordCount: this.countWords(text),
      characterCount: text.length,
      hasSignature: this.detectSignature(text),
      hasTables: this.detectTables(text),
    };

    return metadata;
  }

  /**
   * Extract AI-generated metadata (topics, entities, summary)
   */
  private async extractAIMetadata(text: string): Promise<Partial<DocumentMetadata>> {
    try {
      // Limit text length for API call
      const truncatedText = text.substring(0, 10000);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analyze the following document and extract:
1. Main topics (max 5, comma-separated)
2. Key entities (people, companies, locations - max 10, comma-separated)
3. One-sentence summary

Document text:
${truncatedText}

Respond in JSON format:
{
  "topics": ["topic1", "topic2", ...],
  "entities": ["entity1", "entity2", ...],
  "summary": "One sentence summary"
}`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          topics: parsed.topics || [],
          entities: parsed.entities || [],
          summary: parsed.summary || '',
        };
      }

      return {};
    } catch (error) {
      console.warn('⚠️ [MetadataExtraction] Failed to extract AI metadata:', error);
      return {};
    }
  }

  /**
   * Detect language from text
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    // For more accurate detection, could use a library like franc

    const sample = text.substring(0, 1000).toLowerCase();

    // Portuguese indicators
    const ptPatterns = /\b(o|a|os|as|de|da|do|das|dos|em|na|no|nas|nos|para|com|por)\b/g;
    const ptMatches = (sample.match(ptPatterns) || []).length;

    // English indicators
    const enPatterns = /\b(the|a|an|of|in|to|for|with|on|at|from|by|about|as|into)\b/g;
    const enMatches = (sample.match(enPatterns) || []).length;

    // Spanish indicators
    const esPatterns = /\b(el|la|los|las|de|del|en|y|que|es|por|para|con|una?)\b/g;
    const esMatches = (sample.match(esPatterns) || []).length;

    const max = Math.max(ptMatches, enMatches, esMatches);

    if (max === ptMatches) return 'pt';
    if (max === enMatches) return 'en';
    if (max === esMatches) return 'es';

    return 'unknown';
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Detect if document contains signature
   */
  private detectSignature(text: string): boolean {
    const signaturePatterns = [
      /signature/i,
      /signed by/i,
      /electronically signed/i,
      /\/s\//i, // Electronic signature marker
      /assinado por/i, // Portuguese
      /firmado por/i, // Spanish
    ];

    return signaturePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detect if document contains tables
   */
  private detectTables(text: string): boolean {
    // Look for table-like structures
    const tablePatterns = [
      /\|[\s\S]*\|/m, // Markdown tables
      /\t.*\t/m, // Tab-separated values
      /\b(table|tabela|tabla)\b/i, // Explicit table mentions
    ];

    return tablePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Get file type from MIME type
   */
  private getFileType(mimeType: string): string {
    const typeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-powerpoint': 'ppt',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'image/jpeg': 'jpg',
      'image/png': 'png',
    };

    return typeMap[mimeType] || 'unknown';
  }
}

export default new MetadataExtractionService();
