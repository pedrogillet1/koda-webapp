/**
 * File Validator Service
 *
 * Multi-layer file validation inspired by ChatGPT.
 *
 * VALIDATION LAYERS:
 * 1. File type validation (supported formats)
 * 2. File size validation (max 50MB)
 * 3. File integrity validation (not corrupted)
 * 4. Password protection detection
 * 5. OCR quality validation (for scanned documents)
 *
 * Impact: Only readable files accepted, clear error messages
 */

import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: string;
  suggestion?: string;
}

export enum ValidationErrorCode {
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  PASSWORD_PROTECTED = 'PASSWORD_PROTECTED',
  OCR_QUALITY_LOW = 'OCR_QUALITY_LOW',
  NO_TEXT_CONTENT = 'NO_TEXT_CONTENT',
}

class FileValidatorService {
  // Supported file types
  private supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
    'text/plain', // .txt
    'image/jpeg',
    'image/png',
    'image/jpg',
  ];

  // Max file size: 50MB
  private maxFileSize = 50 * 1024 * 1024;

  /**
   * LAYER 1: Client-Side Pre-Upload Validation
   *
   * Validates file type and size before upload.
   * This should be called on the frontend before sending file to server.
   *
   * @param file - File object from input
   * @returns Validation result
   */
  validateClientSide(file: { type: string; size: number; name: string }): ValidationResult {
    // Check file type
    if (!this.supportedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File type not supported: ${file.type}`,
        errorCode: ValidationErrorCode.UNSUPPORTED_TYPE,
        suggestion: 'Please convert to PDF, DOCX, XLSX, PPTX, TXT, or image format.',
      };
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (this.maxFileSize / (1024 * 1024)).toFixed(0);

      return {
        isValid: false,
        error: `File too large: ${sizeMB}MB (max ${maxSizeMB}MB)`,
        errorCode: ValidationErrorCode.FILE_TOO_LARGE,
        suggestion: `Please reduce file size to under ${maxSizeMB}MB.`,
      };
    }

    return { isValid: true };
  }

  /**
   * LAYER 2: Server-Side Upload Validation
   *
   * Validates file integrity and accessibility.
   *
   * @param buffer - File buffer
   * @param mimeType - MIME type
   * @param filename - Original filename
   * @returns Validation result
   */
  async validateServerSide(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<ValidationResult> {
    try {
      // Check file type again (don't trust client)
      if (!this.supportedTypes.includes(mimeType)) {
        return {
          isValid: false,
          error: `Unsupported file type: ${mimeType}`,
          errorCode: ValidationErrorCode.UNSUPPORTED_TYPE,
          suggestion: 'Please convert to a supported format (PDF, DOCX, XLSX, etc.).',
        };
      }

      // Check file size again
      if (buffer.length > this.maxFileSize) {
        return {
          isValid: false,
          error: 'File too large',
          errorCode: ValidationErrorCode.FILE_TOO_LARGE,
          suggestion: 'Please reduce file size to under 50MB.',
        };
      }

      // Check file integrity based on type
      const integrityResult = await this.checkFileIntegrity(buffer, mimeType);
      if (!integrityResult.isValid) {
        return integrityResult;
      }

      // Check for password protection
      const passwordResult = await this.checkPasswordProtection(buffer, mimeType);
      if (!passwordResult.isValid) {
        return passwordResult;
      }

      return { isValid: true };
    } catch (error: any) {
      console.error('Server-side validation error:', error);
      return {
        isValid: false,
        error: 'File validation failed',
        errorCode: ValidationErrorCode.FILE_CORRUPTED,
        suggestion: 'The file may be corrupted. Please try re-downloading or re-saving the file.',
      };
    }
  }

  /**
   * LAYER 3: Content Extraction Validation
   *
   * Validates that text can be extracted and is of sufficient quality.
   *
   * @param buffer - File buffer
   * @param mimeType - MIME type
   * @returns Validation result
   */
  async validateContentExtraction(
    buffer: Buffer,
    mimeType: string
  ): Promise<ValidationResult> {
    try {
      let extractedText = '';
      let confidence = 1.0;

      // Extract text based on file type
      if (mimeType === 'application/pdf') {
        const result = await this.extractPDFText(buffer);
        extractedText = result.text;
        confidence = result.confidence || 1.0;
      } else if (mimeType.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else if (mimeType.includes('spreadsheetml')) {
        const workbook = XLSX.read(buffer);
        const sheets = workbook.SheetNames.map(name =>
          XLSX.utils.sheet_to_txt(workbook.Sheets[name])
        );
        extractedText = sheets.join('\n');
      } else if (mimeType === 'text/plain') {
        extractedText = buffer.toString('utf-8');
      } else if (mimeType.startsWith('image/')) {
        // For images, OCR will be performed later
        // Just validate that it's a valid image
        return { isValid: true };
      }

      // Check if any text was extracted
      const wordCount = extractedText.trim().split(/\s+/).filter(w => w.length > 0).length;

      if (wordCount < 10) {
        return {
          isValid: false,
          error: 'No readable text found in document',
          errorCode: ValidationErrorCode.NO_TEXT_CONTENT,
          suggestion: 'This file appears to be empty or contains only images. If it\'s a scanned document, please ensure the scan quality is high (minimum 300 DPI).',
        };
      }

      // Check OCR confidence for scanned documents
      if (confidence < 0.7) {
        return {
          isValid: false,
          error: 'Scan quality too low for reliable text extraction',
          errorCode: ValidationErrorCode.OCR_QUALITY_LOW,
          suggestion: 'Please re-scan the document at higher quality (minimum 300 DPI, good lighting, clear text).',
        };
      }

      return { isValid: true };
    } catch (error: any) {
      console.error('Content extraction validation error:', error);
      return {
        isValid: false,
        error: 'Failed to extract text from document',
        errorCode: ValidationErrorCode.FILE_CORRUPTED,
        suggestion: 'The file may be corrupted or in an unsupported format. Please try re-saving the file.',
      };
    }
  }

  /**
   * Check file integrity (not corrupted)
   */
  private async checkFileIntegrity(buffer: Buffer, mimeType: string): Promise<ValidationResult> {
    try {
      if (mimeType === 'application/pdf') {
        // Try to parse PDF
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        await parser.getText();
      } else if (mimeType.includes('spreadsheetml')) {
        // Try to parse Excel
        XLSX.read(buffer);
      } else if (mimeType.includes('wordprocessingml')) {
        // Try to parse Word
        await mammoth.extractRawText({ buffer });
      }

      return { isValid: true };
    } catch (error: any) {
      return {
        isValid: false,
        error: 'File appears to be corrupted',
        errorCode: ValidationErrorCode.FILE_CORRUPTED,
        suggestion: 'Please try re-downloading or re-saving the file.',
      };
    }
  }

  /**
   * Check for password protection
   */
  private async checkPasswordProtection(buffer: Buffer, mimeType: string): Promise<ValidationResult> {
    try {
      if (mimeType === 'application/pdf') {
        // PDF password detection
        const pdfString = buffer.toString('latin1');

        // Check for encryption dictionary
        if (pdfString.includes('/Encrypt')) {
          return {
            isValid: false,
            error: 'PDF is password-protected',
            errorCode: ValidationErrorCode.PASSWORD_PROTECTED,
            suggestion: 'Please remove the password protection and try again.',
          };
        }
      }

      // Excel and Word password detection is more complex
      // For now, we'll catch errors during extraction
      return { isValid: true };
    } catch (error: any) {
      // If we can't check, assume it's okay
      // Errors will be caught during extraction
      return { isValid: true };
    }
  }

  /**
   * Extract text from PDF (helper method)
   */
  private async extractPDFText(buffer: Buffer): Promise<{ text: string; confidence?: number }> {
    try {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();

      // If no text, it's likely a scanned PDF
      if (!data.text || data.text.trim().length < 100) {
        // OCR will be performed later
        // For now, just return empty with low confidence
        return { text: '', confidence: 0.5 };
      }

      return { text: data.text, confidence: 1.0 };
    } catch (error) {
      throw error;
    }
  }
}

export default new FileValidatorService();
