/**
 * CSV Processor Service
 * Converts CSV files to structured markdown tables with statistics
 * - Parses CSV with proper type detection
 * - Generates summary statistics
 * - Creates markdown tables
 * - Handles large files with pagination
 * - Detects data types (numbers, dates, text)
 */

import Papa from 'papaparse';
import { markdownTable } from 'markdown-table';
import { ExtractionResult } from './textExtraction.service';

interface CSVColumn {
  name: string;
  type: 'number' | 'date' | 'boolean' | 'text';
  nullCount: number;
  uniqueCount: number;
  sampleValues: any[];
}

interface CSVStatistics {
  rowCount: number;
  columnCount: number;
  columns: CSVColumn[];
  hasHeaders: boolean;
  delimiter: string;
}

class CSVProcessorService {
  private readonly MAX_ROWS_PREVIEW = 100; // Show first 100 rows in preview
  private readonly MAX_CELL_LENGTH = 100; // Truncate long cell values

  /**
   * Process CSV file and convert to markdown with statistics
   */
  async processCSV(buffer: Buffer, maxRows: number = 1000): Promise<ExtractionResult> {
    try {
      console.log('📊 [CSV Processor] Processing CSV file...');

      const csvContent = buffer.toString('utf-8');

      // Parse CSV with Papa Parse
      const parseResult = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true, // Auto-detect numbers, booleans
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });

      if (parseResult.errors.length > 0) {
        console.warn('⚠️ [CSV Processor] Parse errors:', parseResult.errors);
      }

      const data = parseResult.data as any[];
      const headers = parseResult.meta.fields || [];

      if (data.length === 0) {
        throw new Error('CSV file is empty or could not be parsed');
      }

      console.log(`   Rows: ${data.length}, Columns: ${headers.length}`);

      // Generate statistics
      const stats = this.generateStatistics(data, headers, parseResult.meta.delimiter || ',');

      // Create markdown output
      let markdown = this.createMarkdown(data, headers, stats, maxRows);

      const wordCount = markdown.split(/\s+/).filter(w => w.length > 0).length;

      console.log(`✅ [CSV Processor] Converted to markdown (${markdown.length} chars, ${wordCount} words)`);

      return {
        text: markdown,
        wordCount,
        confidence: 1.0,
      };
    } catch (error: any) {
      console.error('❌ [CSV Processor] Error:', error);
      throw new Error(`Failed to process CSV: ${error.message}`);
    }
  }

  /**
   * Generate statistics about the CSV data
   */
  private generateStatistics(data: any[], headers: string[], delimiter: string): CSVStatistics {
    const columns: CSVColumn[] = headers.map(header => {
      const values = data.map(row => row[header]);
      const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');

      return {
        name: header,
        type: this.detectColumnType(nonNullValues),
        nullCount: data.length - nonNullValues.length,
        uniqueCount: new Set(nonNullValues).size,
        sampleValues: nonNullValues.slice(0, 5),
      };
    });

    return {
      rowCount: data.length,
      columnCount: headers.length,
      columns,
      hasHeaders: headers.length > 0 && headers[0] !== '',
      delimiter,
    };
  }

  /**
   * Detect column data type
   */
  private detectColumnType(values: any[]): 'number' | 'date' | 'boolean' | 'text' {
    if (values.length === 0) return 'text';

    // Check if all values are numbers
    const numericCount = values.filter(v => typeof v === 'number' && !isNaN(v)).length;
    if (numericCount / values.length > 0.8) return 'number';

    // Check if all values are booleans
    const booleanCount = values.filter(v =>
      typeof v === 'boolean' ||
      (typeof v === 'string' && ['true', 'false', 'yes', 'no', '1', '0'].includes(v.toLowerCase()))
    ).length;
    if (booleanCount / values.length > 0.8) return 'boolean';

    // Check if all values are dates
    const dateCount = values.filter(v => {
      if (typeof v === 'string') {
        const date = new Date(v);
        return !isNaN(date.getTime()) && v.match(/\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}/);
      }
      return false;
    }).length;
    if (dateCount / values.length > 0.8) return 'date';

    return 'text';
  }

  /**
   * Create markdown output with tables and statistics
   */
  private createMarkdown(data: any[], headers: string[], stats: CSVStatistics, maxRows: number): string {
    let markdown = '# CSV Data Analysis\n\n';

    // Add summary section
    markdown += '## Summary\n\n';
    markdown += `- **Total Rows:** ${stats.rowCount.toLocaleString()}\n`;
    markdown += `- **Total Columns:** ${stats.columnCount}\n`;
    markdown += `- **Delimiter:** \`${stats.delimiter}\`\n\n`;

    // Add column information
    markdown += '## Column Information\n\n';

    const columnInfoTable = [
      ['Column', 'Type', 'Non-Null', 'Unique Values', 'Sample Values'],
      ...stats.columns.map(col => [
        col.name,
        col.type,
        `${stats.rowCount - col.nullCount} (${((1 - col.nullCount / stats.rowCount) * 100).toFixed(1)}%)`,
        col.uniqueCount.toString(),
        col.sampleValues.slice(0, 3).map(v => this.formatValue(v)).join(', '),
      ])
    ];

    markdown += markdownTable(columnInfoTable) + '\n\n';

    // Add numeric column statistics if any
    const numericColumns = stats.columns.filter(col => col.type === 'number');
    if (numericColumns.length > 0) {
      markdown += '## Numeric Column Statistics\n\n';

      const statsTable = [
        ['Column', 'Min', 'Max', 'Mean', 'Median'],
        ...numericColumns.map(col => {
          const values = data
            .map(row => row[col.name])
            .filter(v => typeof v === 'number' && !isNaN(v))
            .sort((a, b) => a - b);

          const min = values.length > 0 ? Math.min(...values) : 0;
          const max = values.length > 0 ? Math.max(...values) : 0;
          const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          const median = values.length > 0 ? values[Math.floor(values.length / 2)] : 0;

          return [
            col.name,
            this.formatNumber(min),
            this.formatNumber(max),
            this.formatNumber(mean),
            this.formatNumber(median),
          ];
        })
      ];

      markdown += markdownTable(statsTable) + '\n\n';
    }

    // Add data preview
    const previewRows = Math.min(data.length, this.MAX_ROWS_PREVIEW);
    markdown += `## Data Preview (First ${previewRows} of ${stats.rowCount} rows)\n\n`;

    const dataToShow = data.slice(0, previewRows);
    const dataTable = [
      headers,
      ...dataToShow.map(row =>
        headers.map(header => this.formatCellValue(row[header]))
      )
    ];

    markdown += markdownTable(dataTable) + '\n\n';

    // Add truncation notice if needed
    if (stats.rowCount > this.MAX_ROWS_PREVIEW) {
      markdown += `*Note: Showing first ${this.MAX_ROWS_PREVIEW} of ${stats.rowCount.toLocaleString()} total rows. `;
      markdown += `${(stats.rowCount - this.MAX_ROWS_PREVIEW).toLocaleString()} rows omitted.*\n\n`;
    }

    return markdown;
  }

  /**
   * Format a value for display in sample values
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return this.formatNumber(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';

    const str = String(value);
    if (str.length > 30) return str.substring(0, 30) + '...';
    return str;
  }

  /**
   * Format a number for display
   */
  private formatNumber(num: number): string {
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toFixed(2);
  }

  /**
   * Format a cell value for the data table
   */
  private formatCellValue(value: any): string {
    if (value === null || value === undefined || value === '') return '';

    let str = String(value);

    // Truncate long values
    if (str.length > this.MAX_CELL_LENGTH) {
      str = str.substring(0, this.MAX_CELL_LENGTH) + '...';
    }

    // Escape pipe characters for markdown tables
    str = str.replace(/\|/g, '\\|');

    // Remove newlines
    str = str.replace(/\n/g, ' ');

    return str;
  }

  /**
   * Parse CSV from string (alternative method)
   */
  async parseCSVString(csvContent: string, options?: Papa.ParseConfig): Promise<any[]> {
    const parseResult = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      ...options,
    });

    if (parseResult.errors.length > 0) {
      console.warn('CSV parse errors:', parseResult.errors);
    }

    return parseResult.data as any[];
  }

  /**
   * Detect delimiter from CSV content
   */
  detectDelimiter(csvContent: string): string {
    const firstLine = csvContent.split('\n')[0];
    const delimiters = [',', ';', '\t', '|'];

    let maxCount = 0;
    let detectedDelimiter = ',';

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp('\\' + delimiter, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delimiter;
      }
    }

    return detectedDelimiter;
  }
}

export default new CSVProcessorService();
