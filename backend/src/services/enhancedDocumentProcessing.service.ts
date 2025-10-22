import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import vectorEmbeddingService from './vectorEmbedding.service';

const pdfParse = require('pdf-parse').pdf;

interface ChunkWithMetadata {
  content: string;
  metadata: {
    page?: number;
    pageCount?: number;
    cell?: string;
    sheet?: string;
    slide?: number;
    part?: number; // For multi-part slides
    paragraph?: number;
    section?: string;
    startChar?: number;
    endChar?: number;
  };
}

/**
 * Enhanced Document Processing Service
 * Extracts text with metadata for RAG deep linking
 */
class EnhancedDocumentProcessingService {
  private readonly CHUNK_SIZE = 8000; // tokens (~32k characters)
  private readonly CHUNK_OVERLAP = 500; // tokens (~2k characters)

  /**
   * Process PDF with page-level metadata
   * @param buffer - PDF file buffer
   * @param documentId - Document ID
   * @returns Array of chunks with page metadata
   */
  async processPDF(buffer: Buffer, documentId: string): Promise<void> {
    try {
      const data: any = await pdfParse(buffer);
      const chunks: ChunkWithMetadata[] = [];

      // Extract text per page if available
      if (data.text && data.text.length > 0) {
        // For PDF, we'll chunk the entire text but try to maintain page boundaries
        const text = data.text;
        const pageCount = data.numpages || 1;

        // Estimate characters per page
        const charsPerPage = Math.ceil(text.length / pageCount);

        // Create chunks with page tracking
        let currentPosition = 0;
        let chunkIndex = 0;

        while (currentPosition < text.length) {
          const chunkEnd = Math.min(currentPosition + this.CHUNK_SIZE * 4, text.length);
          const chunkText = text.substring(currentPosition, chunkEnd);

          // Estimate which page this chunk is on
          const estimatedPage = Math.floor(currentPosition / charsPerPage) + 1;

          chunks.push({
            content: chunkText,
            metadata: {
              page: estimatedPage,
              pageCount: pageCount,
              startChar: currentPosition,
              endChar: chunkEnd
            }
          });

          // Move forward with overlap
          currentPosition += (this.CHUNK_SIZE - this.CHUNK_OVERLAP) * 4;
          chunkIndex++;
        }

        console.log(`📄 Processed PDF: ${chunks.length} chunks across ${pageCount} pages`);
      } else {
        // Scanned PDF - single chunk for now
        chunks.push({
          content: '[Scanned PDF - text extraction requires OCR]',
          metadata: {
            page: 1,
            pageCount: data.numpages || 1
          }
        });
      }

      // Store embeddings
      await vectorEmbeddingService.storeDocumentEmbeddings(documentId, chunks);
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }

  /**
   * Process Excel with cell-level metadata
   * @param buffer - Excel file buffer
   * @param documentId - Document ID
   * @returns Array of chunks with cell/sheet metadata
   */
  async processExcel(buffer: Buffer, documentId: string): Promise<void> {
    try {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: true,
        cellStyles: true,
        cellDates: true,
        cellNF: true
      });

      const chunks: ChunkWithMetadata[] = [];

      console.log(`📊 Excel file has ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}`);

      // Process each sheet
      workbook.SheetNames.forEach((sheetName, sheetIndex) => {
        console.log(`  Processing sheet ${sheetIndex + 1}/${workbook.SheetNames.length}: "${sheetName}"`);
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          console.warn(`  ⚠️ Sheet "${sheetName}" is empty or null, skipping`);
          return;
        }

        // Convert to JSON to get cell data
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
          raw: false
        });

        if (!jsonData || jsonData.length === 0) {
          console.warn(`  ⚠️ Sheet "${sheetName}" has no data, skipping`);
          return;
        }

        console.log(`  ✅ Sheet "${sheetName}": ${jsonData.length} rows found`);

        // Get cell references
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

        // STRATEGY 1: Create cell-level chunks for individual cell queries
        // This allows queries like "What is in cell B7 on sheet 2?" to work
        (jsonData as any[][]).forEach((row: any[], rowIndex: number) => {
          row.forEach((cellValue: any, colIndex: number) => {
            if (cellValue === null || cellValue === undefined || cellValue === '') return;

            const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            const cellObj = sheet[cellRef];

            // Get formula if exists
            const formula = cellObj?.f ? `=${cellObj.f}` : null;

            // Create cell-specific chunk
            const cellContent = formula
              ? `Cell ${cellRef} on sheet "${sheetName}" (Sheet ${sheetIndex + 1}): ${cellValue} (formula: ${formula})`
              : `Cell ${cellRef} on sheet "${sheetName}" (Sheet ${sheetIndex + 1}): ${cellValue}`;

            chunks.push({
              content: cellContent,
              metadata: {
                sheet: sheetName,
                cell: cellRef,
                startChar: rowIndex,
                endChar: colIndex
              }
            });
          });
        });

        // STRATEGY 2: Create row-based chunks for context and broader queries
        let currentChunk = '';
        let currentChunkSize = 0;
        let chunkStartRow = 0;
        let cellsInChunk: string[] = [];

        (jsonData as any[][]).forEach((row: any[], rowIndex: number) => {
          const rowCells: string[] = [];
          const rowText = row.map((cell: any, colIndex: number) => {
            if (cell === null || cell === undefined || cell === '') return '';
            const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            rowCells.push(cellRef);
            return `[${cellRef}] ${cell}`;
          }).filter(t => t).join(' | ');

          if (rowText) {
            const rowLine = `Row ${rowIndex + 1}: ${rowText}\n`;

            // Check if adding this row would exceed chunk size
            if (currentChunkSize + rowLine.length > this.CHUNK_SIZE * 4) {
              // Save current chunk
              if (currentChunk) {
                chunks.push({
                  content: `Sheet: ${sheetName}\n${currentChunk}`,
                  metadata: {
                    sheet: sheetName,
                    section: `Rows ${chunkStartRow + 1}-${rowIndex}`,
                    startChar: chunkStartRow,
                    endChar: rowIndex
                  }
                });
              }

              // Start new chunk with overlap
              currentChunk = rowLine;
              currentChunkSize = rowLine.length;
              chunkStartRow = rowIndex;
              cellsInChunk = [...rowCells];
            } else {
              currentChunk += rowLine;
              currentChunkSize += rowLine.length;
              cellsInChunk.push(...rowCells);
            }
          }
        });

        // Add remaining chunk
        if (currentChunk) {
          chunks.push({
            content: `Sheet: ${sheetName}\n${currentChunk}`,
            metadata: {
              sheet: sheetName,
              section: `Rows ${chunkStartRow + 1}-${jsonData.length}`,
              startChar: chunkStartRow,
              endChar: jsonData.length
            }
          });
        }
      });

      console.log(`📊 Processed Excel: ${chunks.length} chunks across ${workbook.SheetNames.length} sheets (including cell-level and row-level chunks)`);

      // Store embeddings
      await vectorEmbeddingService.storeDocumentEmbeddings(documentId, chunks);
    } catch (error) {
      console.error('Error processing Excel:', error);
      throw error;
    }
  }

  /**
   * Process Word with paragraph-level metadata
   * @param buffer - Word file buffer
   * @param documentId - Document ID
   * @returns Array of chunks with paragraph metadata
   */
  async processWord(buffer: Buffer, documentId: string): Promise<void> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        throw new Error('Word document is empty');
      }

      // Split by paragraphs
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
      const chunks: ChunkWithMetadata[] = [];

      let currentChunk = '';
      let currentChunkSize = 0;
      let chunkStartParagraph = 0;
      let currentParagraph = 0;

      paragraphs.forEach((paragraph, index) => {
        const paragraphText = `Paragraph ${index + 1}: ${paragraph}\n\n`;

        if (currentChunkSize + paragraphText.length > this.CHUNK_SIZE * 4) {
          // Save current chunk
          if (currentChunk) {
            chunks.push({
              content: currentChunk,
              metadata: {
                paragraph: chunkStartParagraph + 1,
                section: `Paragraphs ${chunkStartParagraph + 1}-${currentParagraph}`,
                startChar: chunkStartParagraph,
                endChar: currentParagraph
              }
            });
          }

          // Start new chunk
          currentChunk = paragraphText;
          currentChunkSize = paragraphText.length;
          chunkStartParagraph = index;
        } else {
          currentChunk += paragraphText;
          currentChunkSize += paragraphText.length;
        }

        currentParagraph = index;
      });

      // Add remaining chunk
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          metadata: {
            paragraph: chunkStartParagraph + 1,
            section: `Paragraphs ${chunkStartParagraph + 1}-${currentParagraph + 1}`,
            startChar: chunkStartParagraph,
            endChar: currentParagraph + 1
          }
        });
      }

      console.log(`📝 Processed Word: ${chunks.length} chunks across ${paragraphs.length} paragraphs`);

      // Store embeddings
      await vectorEmbeddingService.storeDocumentEmbeddings(documentId, chunks);
    } catch (error) {
      console.error('Error processing Word:', error);
      throw error;
    }
  }

  /**
   * Process PowerPoint with slide-level metadata
   * @param buffer - PowerPoint file buffer
   * @param documentId - Document ID
   * @param filename - Original filename (optional, for better searchability)
   * @returns Array of chunks with slide metadata
   */
  async processPowerPoint(buffer: Buffer, documentId: string, filename?: string): Promise<void> {
    try {
      console.log(`📊 Processing PowerPoint: ${documentId}${filename ? ` (${filename})` : ''}`);

      // Extract text from PowerPoint using textExtraction service
      const { extractTextFromPowerPoint } = require('./textExtraction.service');
      const extractionResult = await extractTextFromPowerPoint(buffer);

      if (!extractionResult.text || extractionResult.text.trim().length === 0) {
        console.warn('⚠️ PowerPoint has no extractable text');
        // Store a minimal chunk indicating empty presentation
        const emptyContent = filename
          ? `📄 File: ${filename} | [PowerPoint presentation with no text content]`
          : '[PowerPoint presentation with no text content]';
        await vectorEmbeddingService.storeDocumentEmbeddings(documentId, [{
          content: emptyContent,
          metadata: { slide: 1, filename }
        }]);
        return;
      }

      const chunks: ChunkWithMetadata[] = [];

      // Split by slide markers (=== Slide N ===)
      const slidePattern = /=== Slide (\d+) ===/g;
      const slides: { slideNumber: number; content: string }[] = [];

      let lastIndex = 0;
      let match;

      while ((match = slidePattern.exec(extractionResult.text)) !== null) {
        const slideNumber = parseInt(match[1], 10);
        const slideStart = match.index + match[0].length;

        // Get content from previous slide
        if (slides.length > 0) {
          slides[slides.length - 1].content = extractionResult.text
            .substring(lastIndex, match.index)
            .trim();
        }

        slides.push({
          slideNumber,
          content: ''
        });

        lastIndex = slideStart;
      }

      // Add content for last slide
      if (slides.length > 0) {
        slides[slides.length - 1].content = extractionResult.text
          .substring(lastIndex)
          .trim();
      }

      console.log(`📊 Found ${slides.length} slides in PowerPoint`);

      // Create chunks for each slide
      slides.forEach((slide) => {
        if (slide.content && slide.content.length > 0) {
          // If slide content is very long, split it into smaller chunks
          if (slide.content.length > this.CHUNK_SIZE * 4) {
            let position = 0;
            let partNumber = 1;

            while (position < slide.content.length) {
              const chunkEnd = Math.min(position + this.CHUNK_SIZE * 4, slide.content.length);
              const chunkText = slide.content.substring(position, chunkEnd);

              // Add filename prefix to content for better searchability
              const contentWithFilename = filename
                ? `📄 File: ${filename} | Slide ${slide.slideNumber} | ${chunkText}`
                : chunkText;

              chunks.push({
                content: contentWithFilename,
                metadata: {
                  slide: slide.slideNumber,
                  part: partNumber,
                  startChar: position,
                  endChar: chunkEnd,
                  filename
                }
              });

              position += (this.CHUNK_SIZE - this.CHUNK_OVERLAP) * 4;
              partNumber++;
            }
          } else {
            // Single chunk for the slide
            // Add filename prefix to content for better searchability
            const contentWithFilename = filename
              ? `📄 File: ${filename} | Slide ${slide.slideNumber} | ${slide.content}`
              : slide.content;

            chunks.push({
              content: contentWithFilename,
              metadata: {
                slide: slide.slideNumber,
                filename
              }
            });
          }
        }
      });

      if (chunks.length === 0) {
        console.warn('⚠️ No chunks created from PowerPoint');
        const fallbackContent = filename
          ? `📄 File: ${filename} | ${extractionResult.text}`
          : extractionResult.text;
        chunks.push({
          content: fallbackContent,
          metadata: { slide: 1, filename }
        });
      }

      console.log(`📊 Processed PowerPoint: ${chunks.length} chunks from ${slides.length} slides`);

      await vectorEmbeddingService.storeDocumentEmbeddings(documentId, chunks);
    } catch (error) {
      console.error('Error processing PowerPoint:', error);
      throw error;
    }
  }

  /**
   * Process plain text file
   * @param buffer - Text file buffer
   * @param documentId - Document ID
   * @returns Array of chunks
   */
  async processPlainText(buffer: Buffer, documentId: string): Promise<void> {
    try {
      const text = buffer.toString('utf-8');

      if (!text || text.trim().length === 0) {
        throw new Error('Text file is empty');
      }

      const chunks: ChunkWithMetadata[] = [];
      let currentPosition = 0;

      while (currentPosition < text.length) {
        const chunkEnd = Math.min(currentPosition + this.CHUNK_SIZE * 4, text.length);
        const chunkText = text.substring(currentPosition, chunkEnd);

        chunks.push({
          content: chunkText,
          metadata: {
            startChar: currentPosition,
            endChar: chunkEnd
          }
        });

        currentPosition += (this.CHUNK_SIZE - this.CHUNK_OVERLAP) * 4;
      }

      console.log(`📄 Processed text file: ${chunks.length} chunks`);

      await vectorEmbeddingService.storeDocumentEmbeddings(documentId, chunks);
    } catch (error) {
      console.error('Error processing plain text:', error);
      throw error;
    }
  }

  /**
   * Main processing function - automatically detects document type
   * @param buffer - File buffer
   * @param mimeType - MIME type of the document
   * @param documentId - Document ID
   * @param filename - Original filename (optional, for better searchability)
   */
  async processDocument(buffer: Buffer, mimeType: string, documentId: string, filename?: string): Promise<void> {
    try {
      console.log(`🔄 Processing document ${documentId} with MIME type: ${mimeType}${filename ? ` (${filename})` : ''}`);

      switch (mimeType) {
        case 'application/pdf':
          await this.processPDF(buffer, documentId);
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          await this.processWord(buffer, documentId);
          break;

        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          await this.processExcel(buffer, documentId);
          break;

        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          await this.processPowerPoint(buffer, documentId, filename);
          break;

        case 'text/plain':
        case 'text/html':
        case 'text/csv':
          await this.processPlainText(buffer, documentId);
          break;

        default:
          console.warn(`Unsupported document type for RAG processing: ${mimeType}`);
          // Create a single chunk with basic content
          await vectorEmbeddingService.storeDocumentEmbeddings(documentId, [{
            content: '[Document type not supported for semantic search]',
            metadata: {}
          }]);
      }

      console.log(`✅ Successfully processed document ${documentId} for RAG`);
    } catch (error) {
      console.error('Error in enhanced document processing:', error);
      throw error;
    }
  }
}

export default new EnhancedDocumentProcessingService();
