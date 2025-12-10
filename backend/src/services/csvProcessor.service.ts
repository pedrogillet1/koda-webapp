/**
 * ============================================================================
 * CSV PROCESSOR SERVICE
 * ============================================================================
 *
 * PURPOSE: Extract text from CSV files and convert to readable format
 *
 * FEATURES:
 * - Parse CSV with proper handling of quotes, delimiters
 * - Convert to human-readable text format
 * - Handle various CSV encodings
 * - Error handling for malformed CSV
 *
 * CREATED: To fix missing csvProcessor.service.ts issue
 */

interface ExtractionResult {
  text: string;
  confidence?: number;
  pageCount?: number;
  wordCount?: number;
  language?: string;
}

class CSVProcessorService {
  /**
   * Process CSV buffer and extract text
   *
   * @param buffer - CSV file as Buffer
   * @returns Extraction result with text, word count, and confidence
   */
  async processCSV(buffer: Buffer): Promise<ExtractionResult> {
    try {
      console.log('[CSV] Processing CSV file...');

      // Convert buffer to string (try UTF-8 first)
      let csvContent: string;
      try {
        csvContent = buffer.toString('utf-8');
      } catch (error) {
        // Fallback to latin1 if UTF-8 fails
        console.warn('[CSV] UTF-8 decoding failed, trying latin1...');
        csvContent = buffer.toString('latin1');
      }

      // Simple CSV parsing (handles basic cases)
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

      if (lines.length === 0) {
        console.warn('[CSV] Empty CSV file');
        return {
          text: '',
          wordCount: 0,
          confidence: 1.0,
          pageCount: undefined,
          language: undefined,
        };
      }

      // Parse CSV lines
      const rows: string[][] = [];
      for (const line of lines) {
        // Simple CSV parsing (handles quotes and commas)
        const row = this.parseCSVLine(line);
        if (row.length > 0) {
          rows.push(row);
        }
      }

      if (rows.length === 0) {
        console.warn('[CSV] No valid rows found in CSV');
        return {
          text: '',
          wordCount: 0,
          confidence: 1.0,
          pageCount: undefined,
          language: undefined,
        };
      }

      // Convert to readable text format
      const text = this.convertToText(rows);
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

      console.log(`[CSV] Processed ${rows.length} rows, ${wordCount} words`);

      return {
        text,
        wordCount,
        confidence: 1.0,
        pageCount: undefined,
        language: undefined,
      };

    } catch (error: any) {
      console.error('[CSV] Error processing CSV:', error.message);
      throw new Error(`Failed to process CSV: ${error.message}`);
    }
  }

  /**
   * Parse a single CSV line handling quotes and commas
   *
   * @param line - CSV line string
   * @returns Array of cell values
   */
  private parseCSVLine(line: string): string[] {
    const cells: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // End of cell
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    // Add last cell
    cells.push(currentCell.trim());

    return cells;
  }

  /**
   * Convert CSV rows to readable text format
   *
   * @param rows - Array of CSV rows
   * @returns Formatted text
   */
  private convertToText(rows: string[][]): string {
    if (rows.length === 0) {
      return '';
    }

    const lines: string[] = [];

    // Assume first row is header
    const headers = rows[0];
    const hasHeaders = headers.length > 0 && headers.some(h => h.length > 0);

    if (hasHeaders) {
      // Add header
      lines.push('=== CSV Data ===');
      lines.push('');
      lines.push(`Headers: ${headers.join(', ')}`);
      lines.push('');

      // Add data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowData: string[] = [];

        for (let j = 0; j < row.length && j < headers.length; j++) {
          if (row[j]) {
            rowData.push(`${headers[j]}: ${row[j]}`);
          }
        }

        if (rowData.length > 0) {
          lines.push(`Row ${i}:`);
          lines.push(rowData.join(', '));
          lines.push('');
        }
      }
    } else {
      // No headers, just list all rows
      lines.push('=== CSV Data ===');
      lines.push('');

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length > 0) {
          lines.push(`Row ${i + 1}: ${row.join(', ')}`);
        }
      }
    }

    return lines.join('\n');
  }
}

// Export singleton instance
const csvProcessorService = new CSVProcessorService();
export default csvProcessorService;

// Also export the class for testing
export { CSVProcessorService };
