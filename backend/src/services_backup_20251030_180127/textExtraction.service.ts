import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as visionService from './vision.service';
import sharp from 'sharp';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// Use require for pdf-parse to avoid ESM/CommonJS issues
const pdfParse = require('pdf-parse').pdf;

export interface ExtractionResult {
  text: string;
  confidence?: number;
  pageCount?: number;
  wordCount?: number;
  language?: string;
}

/**
 * Preprocess image to improve OCR accuracy
 * Increases resolution, enhances contrast, sharpens text, and removes noise
 */
const preprocessImage = async (inputBuffer: Buffer): Promise<Buffer> => {
  try {
    console.log('🔧 Preprocessing image for better OCR...');

    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    let pipeline = image;

    // Step 1: Increase resolution if too low (minimum 1500px width for good OCR)
    if (metadata.width && metadata.width < 1500) {
      const scale = 1500 / metadata.width;
      pipeline = pipeline.resize(
        Math.round(metadata.width * scale),
        metadata.height ? Math.round(metadata.height * scale) : undefined,
        { kernel: 'lanczos3' } // High-quality resampling
      );
      console.log(`  ↑ Scaled up ${scale.toFixed(2)}x to improve resolution`);
    }

    // Step 2: Convert to grayscale (reduces noise, improves OCR)
    pipeline = pipeline.grayscale();

    // Step 3: Normalize contrast (makes text stand out)
    pipeline = pipeline.normalize();

    // Step 4: Sharpen text edges
    pipeline = pipeline.sharpen({
      sigma: 1.5,
      m1: 1.0,
      m2: 0.5
    });

    // Step 5: Remove noise with median filter
    pipeline = pipeline.median(3);

    const processedBuffer = await pipeline.toBuffer();
    console.log('✅ Image preprocessing completed');

    return processedBuffer;
  } catch (error) {
    console.warn('⚠️ Image preprocessing failed, using original:', error);
    return inputBuffer; // Fallback to original if preprocessing fails
  }
};

/**
 * Post-process OCR text to fix common recognition errors
 */
const postProcessOCRText = (text: string): string => {
  if (!text || text.trim().length === 0) {
    return text;
  }

  let cleaned = text;

  // 1. Fix spacing issues
  cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces to single
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines

  // 2. Fix punctuation spacing
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1'); // Remove space before punctuation
  cleaned = cleaned.replace(/([.,!?;:])(\S)/g, '$1 $2'); // Add space after punctuation if missing

  // 3. Fix common OCR character mistakes (only in word contexts)
  // These are applied carefully to avoid breaking intentional numbers/symbols
  const charCorrections: Array<{ pattern: RegExp; replacement: string }> = [
    // Fix "0" (zero) mistaken as "O" in words
    { pattern: /(?<=[a-zA-Z])0(?=[a-zA-Z])/g, replacement: 'O' },
    // Fix "1" (one) mistaken as "l" or "I" in words
    { pattern: /(?<=[a-z])1(?=[a-z])/g, replacement: 'l' },
    // Fix "|" (pipe) mistaken as "I"
    { pattern: /\|(?=[a-zA-Z])|(?<=[a-zA-Z])\|/g, replacement: 'I' },
  ];

  charCorrections.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, replacement);
  });

  // 4. Fix common word typos
  const wordCorrections: Record<string, string> = {
    'teh': 'the',
    'adn': 'and',
    'taht': 'that',
    'hte': 'the',
    'recieve': 'receive',
    'occured': 'occurred',
    'thier': 'their',
    'whcih': 'which'
  };

  Object.entries(wordCorrections).forEach(([wrong, right]) => {
    const pattern = new RegExp(`\\b${wrong}\\b`, 'gi');
    cleaned = cleaned.replace(pattern, right);
  });

  // 5. Final cleanup
  cleaned = cleaned.trim();

  return cleaned;
};

/**
 * Extract text from PDF document
 * @param buffer - PDF file buffer
 * @returns Extracted text and metadata
 */
export const extractTextFromPDF = async (buffer: Buffer): Promise<ExtractionResult> => {
  try {
    const data: any = await pdfParse(buffer);

    // If no text found, might be a scanned PDF - use OCR
    if (!data.text || data.text.trim().length === 0) {
      console.log('📄 PDF appears to be scanned, using OCR with preprocessing...');
      const ocrResult = await visionService.extractTextFromScannedPDF(buffer);

      // Post-process the OCR text
      const cleanedText = postProcessOCRText(ocrResult.text);

      return {
        text: cleanedText,
        confidence: ocrResult.confidence,
        pageCount: data.numpages,
        wordCount: cleanedText.split(/\s+/).filter((w: any) => w.length > 0).length,
        language: ocrResult.language,
      };
    }

    // Native text extraction - apply basic cleanup
    const cleanedText = postProcessOCRText(data.text);

    return {
      text: cleanedText,
      pageCount: data.numpages,
      wordCount: cleanedText.split(/\s+/).filter((w: any) => w.length > 0).length,
      confidence: 1.0, // Native text extraction has 100% confidence
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

/**
 * Extract text from Word document (.doc, .docx)
 * @param buffer - Word file buffer
 * @returns Extracted text and metadata
 */
export const extractTextFromWord = async (buffer: Buffer): Promise<ExtractionResult> => {
  try {
    console.log(`📝 Extracting text from Word document (buffer size: ${buffer.length} bytes)`);

    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    if (result.messages && result.messages.length > 0) {
      console.log('ℹ️ Mammoth extraction messages:', result.messages);
    }

    if (!text || text.trim().length === 0) {
      console.warn('⚠️ Word document appears to be empty or text could not be extracted');
      return {
        text: '',
        wordCount: 0,
        confidence: 0,
      };
    }

    console.log(`✅ Extracted ${text.length} characters from Word document`);

    // Post-process to clean up text
    const cleanedText = postProcessOCRText(text);

    return {
      text: cleanedText,
      wordCount: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
      confidence: 1.0,
    };
  } catch (error: any) {
    console.error('Error extracting text from Word document:', error);
    console.error('Error details:', error.message || error);

    // Provide user-friendly error messages
    if (error.message?.includes('zip file') || error.message?.includes('central directory')) {
      throw new Error(`Word document appears to be corrupted or incomplete (${buffer.length} bytes). Please try re-uploading the file.`);
    }

    throw new Error(`Failed to extract text from Word document: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Extract text from Excel spreadsheet (.xls, .xlsx) with proper structure preservation
 * @param buffer - Excel file buffer
 * @returns Extracted text and metadata with structured data
 */
export const extractTextFromExcel = async (buffer: Buffer): Promise<ExtractionResult> => {
  try {
    console.log('📊 Extracting structured data from Excel spreadsheet...');
    console.log(`   Buffer size: ${buffer.length} bytes`);

    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Excel file buffer is empty');
    }

    // Check minimum file size (valid Excel files are at least ~1KB)
    if (buffer.length < 1024) {
      throw new Error(`Excel file appears to be too small (${buffer.length} bytes). Minimum expected: 1KB`);
    }

    // Try to read workbook with full cell information including formulas and types
    let workbook;
    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: true,  // Preserve formulas
        cellStyles: true,   // Preserve styles
        cellDates: true,    // Parse dates properly
        cellNF: true        // Number formats
      });
    } catch (readError: any) {
      console.error('❌ Excel file reading failed:', readError.message);

      // Provide specific error messages based on common failures
      if (readError.message?.includes('Unsupported file') || readError.message?.includes('ZIP')) {
        throw new Error(`Excel file appears to be corrupted or in an unsupported format. Expected .xlsx or .xls file.`);
      }
      if (readError.message?.includes('encrypted') || readError.message?.includes('password')) {
        throw new Error(`Excel file is password-protected. Please remove the password and try again.`);
      }

      throw new Error(`Failed to read Excel file: ${readError.message}`);
    }

    // Validate workbook structure
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets or is empty');
    }

    console.log(`   Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(', ')}`);

    let allText = '';
    let totalCells = 0;
    let processedSheets = 0;
    let emptySheets = 0;

    // Extract structured text from all sheets
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      try {
        const sheet = workbook.Sheets[sheetName];

        // Validate sheet exists
        if (!sheet) {
          console.warn(`⚠️ Sheet "${sheetName}" is null or undefined, skipping`);
          allText += `\n=== Sheet ${sheetIndex + 1}: ${sheetName} (Not Found) ===\n`;
          return;
        }

        // Convert sheet to JSON to preserve structure and data types
        let jsonData;
        try {
          jsonData = XLSX.utils.sheet_to_json(sheet, {
            header: 1,           // Use array of arrays format
            defval: '',          // Default value for empty cells
            blankrows: false,    // Skip blank rows
            raw: false           // Format values (dates, numbers, etc.)
          });
        } catch (sheetError: any) {
          console.error(`❌ Error processing sheet "${sheetName}":`, sheetError.message);
          allText += `\n=== Sheet ${sheetIndex + 1}: ${sheetName} (Error: ${sheetError.message}) ===\n`;
          return;
        }

        // Check if sheet is empty
        if (!jsonData || jsonData.length === 0) {
          console.log(`   📄 Sheet "${sheetName}" is empty`);
          emptySheets++;
          allText += `\n=== Sheet ${sheetIndex + 1}: ${sheetName} (Empty) ===\n`;
          return;
        }

        // Calculate actual column count
        const columnCount = Math.max(...jsonData.map((row: any) => Array.isArray(row) ? row.length : 0));

        allText += `\n=== Sheet ${sheetIndex + 1}: ${sheetName} ===\n`;
        allText += `Rows: ${jsonData.length}, Columns: ${columnCount}\n\n`;

        let sheetCellCount = 0;

        // Format as a readable table
        (jsonData as any[][]).forEach((row: any[], rowIndex: number) => {
          if (!row || row.length === 0) return;

          try {
            // Header row (first row) - mark it clearly
            if (rowIndex === 0) {
              const headers = row.map((cell: any) => {
                if (cell === null || cell === undefined) return '""';
                return `"${String(cell).substring(0, 100)}"`;
              }).join(' | ');
              allText += 'Headers: ' + headers + '\n';
              allText += '-'.repeat(80) + '\n';
            } else {
              // Data rows - preserve cell types and values
              const rowText = row.map((cell: any, colIndex: number) => {
                if (cell === null || cell === undefined || cell === '') return '';

                try {
                  // Try to preserve data types in text representation
                  if (typeof cell === 'number') {
                    // Handle special number cases
                    if (isNaN(cell)) return 'NaN';
                    if (!isFinite(cell)) return 'Infinity';
                    return cell.toString();
                  } else if (typeof cell === 'boolean') {
                    return cell ? 'TRUE' : 'FALSE';
                  } else if (cell instanceof Date) {
                    return cell.toISOString();
                  } else {
                    // String or other types - truncate very long values
                    const cellStr = String(cell).substring(0, 500);
                    return `"${cellStr}"`;
                  }
                } catch (cellError) {
                  console.warn(`⚠️ Error formatting cell [${rowIndex}, ${colIndex}]:`, cellError);
                  return '[Error]';
                }
              }).join(' | ');

              if (rowText.trim()) {
                allText += `Row ${rowIndex}: ${rowText}\n`;
                sheetCellCount += row.filter((c: any) => c !== null && c !== undefined && c !== '').length;
              }
            }
          } catch (rowError) {
            console.warn(`⚠️ Error processing row ${rowIndex} in sheet "${sheetName}":`, rowError);
            allText += `Row ${rowIndex}: [Error processing row]\n`;
          }
        });

        allText += '\n';
        totalCells += sheetCellCount;
        processedSheets++;
        console.log(`   ✅ Sheet "${sheetName}": ${jsonData.length} rows, ${sheetCellCount} data cells`);

      } catch (sheetError: any) {
        console.error(`❌ Unexpected error processing sheet "${sheetName}":`, sheetError);
        allText += `\n=== Sheet: ${sheetName} (Critical Error) ===\n`;
        allText += `Error: ${sheetError.message}\n\n`;
      }
    });

    // Validate that we extracted meaningful data
    if (processedSheets === 0) {
      throw new Error(`Failed to process any sheets. All ${workbook.SheetNames.length} sheet(s) were empty or had errors.`);
    }

    if (totalCells === 0) {
      console.warn('⚠️ No data cells found in Excel file');
      return {
        text: `Excel file has ${workbook.SheetNames.length} sheet(s) but contains no data cells.`,
        wordCount: 0,
        confidence: 0.5,
      };
    }

    // Add comprehensive summary
    const summary = `Excel Spreadsheet Analysis
Total Sheets: ${workbook.SheetNames.length}
Processed Sheets: ${processedSheets}
Empty Sheets: ${emptySheets}
Total Data Cells: ${totalCells}
Average Cells per Sheet: ${Math.round(totalCells / processedSheets)}
`;

    allText = summary + allText;

    console.log(`✅ Successfully extracted structured data from ${processedSheets}/${workbook.SheetNames.length} sheet(s), ${totalCells} total cells`);

    return {
      text: allText.trim(),
      wordCount: allText.split(/\s+/).filter((w) => w.length > 0).length,
      confidence: processedSheets === workbook.SheetNames.length ? 1.0 : 0.8,
    };

  } catch (error: any) {
    console.error('❌ Error extracting text from Excel:', error);
    console.error('Error stack:', error.stack);

    // Provide user-friendly error messages
    const errorMessage = error.message || 'Unknown error';

    // Check for common error patterns
    if (errorMessage.includes('corrupted') || errorMessage.includes('ZIP') || errorMessage.includes('Unsupported')) {
      throw new Error(`Excel file is corrupted or in an unsupported format. Please verify the file is a valid .xlsx or .xls file and try again.`);
    }

    if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
      throw new Error(`Excel file is password-protected. Please remove the password protection and upload again.`);
    }

    if (errorMessage.includes('empty') || errorMessage.includes('no sheets')) {
      throw new Error(errorMessage);
    }

    // Generic fallback
    throw new Error(`Failed to extract text from Excel spreadsheet: ${errorMessage}`);
  }
};

/**
 * Extract text from PowerPoint presentation (.pptx)
 * @param buffer - PowerPoint file buffer
 * @returns Extracted text and metadata
 */
export const extractTextFromPowerPoint = async (buffer: Buffer): Promise<ExtractionResult> => {
  try {
    console.log('📊 Extracting text from PowerPoint presentation...');

    const AdmZip = require('adm-zip');
    const xml2js = require('xml2js');

    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    let allText = '';
    let slideCount = 0;

    // Extract text from each slide
    for (const entry of zipEntries) {
      // Look for slide XML files (ppt/slides/slide1.xml, slide2.xml, etc.)
      if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml$/)) {
        slideCount++;
        const slideXml = entry.getData().toString('utf8');

        try {
          const parser = new xml2js.Parser();
          const result = await parser.parseStringPromise(slideXml);

          // Extract text from the slide
          const slideText = extractTextFromSlideXml(result, slideCount);
          if (slideText.trim()) {
            allText += `\n\n=== Slide ${slideCount} ===\n${slideText}`;
          }
        } catch (xmlError) {
          console.warn(`⚠️ Failed to parse slide ${slideCount}:`, xmlError);
          allText += `\n\n=== Slide ${slideCount} ===\n[Failed to parse slide content]`;
        }
      }
    }

    if (slideCount === 0) {
      throw new Error('No slides found in PowerPoint file');
    }

    // Clean up the text
    const cleanedText = postProcessOCRText(allText);

    console.log(`✅ Extracted text from ${slideCount} slides (${cleanedText.length} characters)`);

    return {
      text: cleanedText,
      pageCount: slideCount,
      wordCount: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
      confidence: 1.0,
    };
  } catch (error: any) {
    console.error('❌ Error extracting text from PowerPoint:', error);

    // Check if it's a corrupted file
    if (error.message?.includes('invalid zip') || error.message?.includes('corrupted')) {
      throw new Error('PowerPoint file appears to be corrupted. Please verify the file integrity.');
    }

    // Check if adm-zip is missing
    if (error.code === 'MODULE_NOT_FOUND' && error.message?.includes('adm-zip')) {
      throw new Error('PowerPoint extraction module not installed. Please run: npm install adm-zip xml2js');
    }

    throw new Error(`Failed to extract text from PowerPoint: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Extract text from parsed slide XML object
 * Recursively traverse the XML structure to find text nodes
 */
function extractTextFromSlideXml(slideXml: any, slideNumber: number): string {
  let text = '';

  // Recursive function to extract text from XML nodes
  function extractText(node: any): string {
    let result = '';

    if (!node) return result;

    // If node is a string, return it
    if (typeof node === 'string') {
      return node + ' ';
    }

    // If node is an array, process each element
    if (Array.isArray(node)) {
      for (const item of node) {
        result += extractText(item);
      }
      return result;
    }

    // If node is an object, process its properties
    if (typeof node === 'object') {
      // Look for text content in 'a:t' tags (text runs)
      if (node['a:t']) {
        result += extractText(node['a:t']) + ' ';
      }

      // Look for text in 'a:p' tags (paragraphs)
      if (node['a:p']) {
        result += extractText(node['a:p']) + '\n';
      }

      // Look for text in 'a:r' tags (text runs)
      if (node['a:r']) {
        result += extractText(node['a:r']);
      }

      // Recursively process all other properties
      for (const key in node) {
        if (key !== 'a:t' && key !== 'a:p' && key !== 'a:r') {
          result += extractText(node[key]);
        }
      }
    }

    return result;
  }

  text = extractText(slideXml);

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();

  return text;
}

/**
 * Extract text from plain text file
 * @param buffer - Text file buffer
 * @returns Extracted text and metadata
 */
export const extractTextFromPlainText = async (buffer: Buffer): Promise<ExtractionResult> => {
  try {
    const text = buffer.toString('utf-8');

    // Post-process to clean up text
    const cleanedText = postProcessOCRText(text);

    return {
      text: cleanedText,
      wordCount: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
      confidence: 1.0,
    };
  } catch (error) {
    console.error('Error extracting text from plain text file:', error);
    throw new Error('Failed to extract text from plain text file');
  }
};

/**
 * Extract text from image file (JPEG, PNG, etc.)
 * @param buffer - Image file buffer
 * @returns Extracted text and metadata using OCR
 */
export const extractTextFromImage = async (buffer: Buffer): Promise<ExtractionResult> => {
  try {
    console.log('🖼️ Extracting text from image with preprocessing...');

    // Preprocess image for better OCR accuracy
    const preprocessedBuffer = await preprocessImage(buffer);

    // Perform OCR on preprocessed image
    const ocrResult = await visionService.extractTextFromImage(preprocessedBuffer);

    // Post-process the extracted text
    const cleanedText = postProcessOCRText(ocrResult.text);

    console.log(`✅ Extracted ${cleanedText.length} characters from image (confidence: ${ocrResult.confidence?.toFixed(1)}%)`);

    return {
      text: cleanedText,
      confidence: ocrResult.confidence,
      wordCount: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
      language: ocrResult.language,
    };
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw new Error('Failed to extract text from image');
  }
};

/**
 * Enhanced text extraction with advanced features
 * Includes: table extraction, layout analysis, and structure-aware chunking
 * @param buffer - File buffer
 * @param mimeType - MIME type of the document
 * @param options - Advanced extraction options
 * @returns Enhanced extraction result with structure and chunks
 */
export const extractTextAdvanced = async (
  buffer: Buffer,
  mimeType: string,
  options: {
    extractTables?: boolean;
    analyzeLayout?: boolean;
    structuredChunking?: boolean;
    maxChunkSize?: number;
  } = {}
): Promise<ExtractionResult & {
  tables?: any[];
  layout?: any;
  chunks?: any[];
  structure?: any;
}> => {
  try {
    console.log('🚀 [Advanced Extraction] Starting enhanced extraction...');

    // Step 1: Basic text extraction
    const basicResult = await extractText(buffer, mimeType);
    console.log(`   ✅ Basic extraction: ${basicResult.wordCount} words`);

    const result: any = { ...basicResult };

    // Step 2: Extract tables (for PDFs and images)
    if (options.extractTables !== false && (mimeType === 'application/pdf' || mimeType.startsWith('image/'))) {
      try {
        const tableExtractor = require('./tableExtractor.service').default;
        const tableResult = mimeType === 'application/pdf'
          ? await tableExtractor.extractTablesFromPDF(buffer)
          : await tableExtractor.extractTablesFromImage(buffer);

        if (tableResult.tables.length > 0) {
          result.tables = tableResult.tables;
          result.text = tableExtractor.insertTablesIntoMarkdown(result.text, tableResult.tables);
          console.log(`   📊 Extracted ${tableResult.tables.length} tables`);
        }
      } catch (error) {
        console.warn('   ⚠️ Table extraction failed:', error);
      }
    }

    // Step 3: Analyze layout (for PDFs and images)
    if (options.analyzeLayout && (mimeType === 'application/pdf' || mimeType.startsWith('image/'))) {
      try {
        const layoutAnalyzer = require('./layoutAnalyzer.service').default;
        const layoutResult = mimeType === 'application/pdf'
          ? await layoutAnalyzer.analyzePDFLayout(buffer)
          : await layoutAnalyzer.analyzeImageLayout(buffer);

        if (layoutResult.hasMultiColumn) {
          result.layout = layoutResult;
          result.text = layoutResult.combinedText; // Use layout-aware text
          console.log(`   📐 Multi-column layout detected (${layoutResult.averageColumns.toFixed(1)} avg columns)`);
        }
      } catch (error) {
        console.warn('   ⚠️ Layout analysis failed:', error);
      }
    }

    // Step 4: Structure-aware chunking
    if (options.structuredChunking !== false) {
      try {
        const documentStructure = require('./documentStructure.service').default;
        const structure = documentStructure.parseStructure(result.text, 'markdown');
        const chunks = documentStructure.createStructureAwareChunks(
          structure,
          options.maxChunkSize || 1000
        );

        result.structure = structure;
        result.chunks = chunks;
        console.log(`   ✂️ Created ${chunks.length} structure-aware chunks`);
      } catch (error) {
        console.warn('   ⚠️ Structure-aware chunking failed:', error);
      }
    }

    console.log('✅ [Advanced Extraction] Complete!');
    return result;
  } catch (error) {
    console.error('❌ [Advanced Extraction] Error:', error);
    throw error;
  }
};

/**
 * Main text extraction function - automatically detects document type
 * @param buffer - File buffer
 * @param mimeType - MIME type of the document
 * @returns Extracted text and metadata
 */
export const extractText = async (
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> => {
  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractTextFromPDF(buffer);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractTextFromWord(buffer);

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return await extractTextFromExcel(buffer);

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      case 'application/vnd.ms-powerpoint':
        return await extractTextFromPowerPoint(buffer);

      case 'text/plain':
        return await extractTextFromPlainText(buffer);

      case 'text/html':
        // Use HTML processor for proper structure preservation
        const htmlProcessor = require('./htmlProcessor.service').default;
        return await htmlProcessor.processHTML(buffer);

      case 'text/csv':
        // Use CSV processor for structured table output
        const csvProcessor = require('./csvProcessor.service').default;
        return await csvProcessor.processCSV(buffer);

      case 'application/zip':
      case 'application/x-zip-compressed':
        // Use ZIP processor for archive extraction
        const zipProcessor = require('./zipProcessor.service').default;
        const zipResult = await zipProcessor.processZIP(buffer);
        return {
          text: zipResult.text,
          wordCount: zipResult.wordCount,
          confidence: zipResult.confidence,
        };

      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
      case 'image/tiff':
      case 'image/bmp':
        return await extractTextFromImage(buffer);

      default:
        throw new Error(`Unsupported document type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error in text extraction:', error);
    throw error;
  }
};
