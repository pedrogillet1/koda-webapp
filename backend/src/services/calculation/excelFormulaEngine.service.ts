/**
 * Excel Formula Engine Service
 * Executes Excel formulas and handles what-if scenarios
 *
 * Uses HyperFormula for full Excel compatibility including:
 * - Formula evaluation with cell references
 * - What-if scenario analysis
 * - Formula dependency tracking
 * - Multi-sheet support
 */

import * as XLSX from 'xlsx';

// Dynamic import for HyperFormula
let HyperFormula: any = null;
try {
  HyperFormula = require('hyperformula').HyperFormula;
} catch {
  console.warn('⚠️ HyperFormula not installed. Install with: npm install hyperformula');
}

export interface ExcelFormulaResult {
  success: boolean;
  value?: any;
  formula?: string;
  error?: string;
  dependencies?: string[];
  dependents?: string[];
  executionTime?: number;
  scenarios?: WhatIfScenario[];
}

export interface WhatIfScenario {
  cellAddress: string;
  newValue: any;
  affectedCells?: Map<string, any>;
}

export interface WhatIfResult {
  success: boolean;
  originalValues: Map<string, any>;
  newValues: Map<string, any>;
  changedCells: string[];
  error?: string;
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  formulaCount: number;
}

export interface ExcelDocumentInfo {
  documentId: string;
  sheets: SheetInfo[];
  totalFormulas: number;
  loadedAt: Date;
}

class ExcelFormulaEngineService {
  private hfInstances: Map<string, any> = new Map();
  private documentInfo: Map<string, ExcelDocumentInfo> = new Map();
  private whatIfBackups: Map<string, Map<string, any>> = new Map();
  private initialized: boolean = false;
  private standalonehf: any = null;

  /**
   * Initialize the Excel Formula Engine
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (!HyperFormula) {
      console.error('[EXCEL ENGINE] HyperFormula not available');
      return false;
    }

    try {
      // Create a standalone HyperFormula instance for direct formula evaluation
      this.standalonehf = HyperFormula.buildEmpty({
        licenseKey: 'gpl-v3',
        useColumnIndex: true,
        useRowIndex: true,
      });
      this.standalonehf.addSheet('Sheet1');
      this.initialized = true;
      console.log('✅ [EXCEL ENGINE] Initialized successfully');
      return true;
    } catch (error: any) {
      console.error('[EXCEL ENGINE] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Get engine status
   */
  getStatus(): { initialized: boolean; hyperformulaLoaded: boolean; documentsLoaded: number } {
    return {
      initialized: this.initialized,
      hyperformulaLoaded: !!HyperFormula,
      documentsLoaded: this.hfInstances.size,
    };
  }

  /**
   * Evaluate a formula directly without needing a document
   */
  async evaluateFormula(formula: string): Promise<ExcelFormulaResult> {
    const startTime = Date.now();

    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.standalonehf) {
      return {
        success: false,
        error: 'HyperFormula not initialized',
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Ensure formula starts with =
      const formulaStr = formula.startsWith('=') ? formula : `=${formula}`;

      // Use a temporary cell for evaluation
      const sheetId = this.standalonehf.getSheetId('Sheet1');

      // Use a cell for evaluation (row 0, col 0)
      this.standalonehf.setCellContents(
        { sheet: sheetId, col: 0, row: 0 },
        [[formulaStr]]
      );

      const value = this.standalonehf.getCellValue({ sheet: sheetId, col: 0, row: 0 });

      // Check for HyperFormula error types
      if (value && typeof value === 'object' && value.type) {
        // This is an error object from HyperFormula
        return {
          success: false,
          error: value.type || 'Formula error',
          formula: formulaStr,
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        value,
        formula: formulaStr,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Load Excel file into HyperFormula engine
   */
  async loadExcelFile(buffer: Buffer, documentId: string): Promise<ExcelDocumentInfo> {
    const startTime = Date.now();

    if (!HyperFormula) {
      throw new Error('HyperFormula not installed. Install with: npm install hyperformula');
    }

    try {
      // Read workbook with formulas
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: true,
        cellDates: true,
        cellNF: true,
        cellStyles: true,
      });

      // Create HyperFormula instance
      const hf = HyperFormula.buildEmpty({
        licenseKey: 'gpl-v3',
        useColumnIndex: true,
        useRowIndex: true,
      });

      const sheets: SheetInfo[] = [];
      let totalFormulas = 0;

      // Load each sheet
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const { data, formulaCount } = this.convertSheetToArray(sheet);

        // Add sheet to HyperFormula
        const sheetId = hf.addSheet(sheetName);
        hf.setSheetContent(sheetId, data);

        sheets.push({
          name: sheetName,
          rowCount: data.length,
          columnCount: data.length > 0 ? Math.max(...data.map(row => row.length)) : 0,
          formulaCount,
        });

        totalFormulas += formulaCount;
      }

      // Store instance
      this.hfInstances.set(documentId, hf);

      const info: ExcelDocumentInfo = {
        documentId,
        sheets,
        totalFormulas,
        loadedAt: new Date(),
      };

      this.documentInfo.set(documentId, info);

      console.log(`✅ [EXCEL ENGINE] Loaded ${sheets.length} sheets with ${totalFormulas} formulas for document ${documentId} in ${Date.now() - startTime}ms`);

      return info;
    } catch (error: any) {
      console.error('[EXCEL ENGINE] Failed to load Excel file:', error);
      throw error;
    }
  }

  /**
   * Load Excel from file path
   */
  async loadExcelFromPath(filePath: string, documentId: string): Promise<ExcelDocumentInfo> {
    const fs = require('fs');
    const buffer = fs.readFileSync(filePath);
    return this.loadExcelFile(buffer, documentId);
  }

  /**
   * Convert XLSX sheet to array format for HyperFormula
   */
  private convertSheetToArray(sheet: XLSX.WorkSheet): { data: any[][]; formulaCount: number } {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const data: any[][] = [];
    let formulaCount = 0;

    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row: any[] = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];

        if (cell) {
          // If cell has formula, use formula; otherwise use value
          if (cell.f) {
            row.push(`=${cell.f}`);
            formulaCount++;
          } else if (cell.t === 'd') {
            // Date type
            row.push(cell.v);
          } else if (cell.t === 'b') {
            // Boolean type
            row.push(cell.v);
          } else if (cell.t === 'n') {
            // Number type
            row.push(cell.v);
          } else if (cell.t === 's') {
            // String type
            row.push(cell.v);
          } else {
            row.push(cell.v);
          }
        } else {
          row.push(null);
        }
      }
      data.push(row);
    }

    return { data, formulaCount };
  }

  /**
   * Check if document is loaded
   */
  isLoaded(documentId: string): boolean {
    return this.hfInstances.has(documentId);
  }

  /**
   * Get document info
   */
  getDocumentInfo(documentId: string): ExcelDocumentInfo | undefined {
    return this.documentInfo.get(documentId);
  }

  /**
   * Get cell value (calculated result)
   */
  getCellValue(documentId: string, sheetName: string, cellAddress: string): ExcelFormulaResult {
    const startTime = Date.now();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return {
          success: false,
          error: 'Excel file not loaded',
        };
      }

      const sheetId = hf.getSheetId(sheetName);
      if (sheetId === undefined) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found`,
        };
      }

      const address = this.parseAddress(cellAddress);
      const value = hf.getCellValue({
        sheet: sheetId,
        col: address.col,
        row: address.row,
      });

      const formula = hf.getCellFormula({
        sheet: sheetId,
        col: address.col,
        row: address.row,
      });

      return {
        success: true,
        value,
        formula: formula || undefined,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get multiple cell values
   */
  getCellValues(
    documentId: string,
    sheetName: string,
    cellAddresses: string[]
  ): Map<string, ExcelFormulaResult> {
    const results = new Map<string, ExcelFormulaResult>();

    for (const address of cellAddresses) {
      results.set(address, this.getCellValue(documentId, sheetName, address));
    }

    return results;
  }

  /**
   * Get range of cell values
   */
  getRangeValues(
    documentId: string,
    sheetName: string,
    startCell: string,
    endCell: string
  ): ExcelFormulaResult {
    const startTime = Date.now();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return {
          success: false,
          error: 'Excel file not loaded',
        };
      }

      const sheetId = hf.getSheetId(sheetName);
      if (sheetId === undefined) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found`,
        };
      }

      const start = this.parseAddress(startCell);
      const end = this.parseAddress(endCell);

      const values: any[][] = [];
      for (let row = start.row; row <= end.row; row++) {
        const rowValues: any[] = [];
        for (let col = start.col; col <= end.col; col++) {
          rowValues.push(hf.getCellValue({ sheet: sheetId, col, row }));
        }
        values.push(rowValues);
      }

      return {
        success: true,
        value: values,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Set cell value - creates document if it doesn't exist
   */
  setCellValue(
    documentId: string,
    sheetName: string,
    cellAddress: string,
    value: any
  ): ExcelFormulaResult {
    const startTime = Date.now();

    try {
      let hf = this.hfInstances.get(documentId);

      // Create HyperFormula instance if it doesn't exist
      if (!hf) {
        if (!HyperFormula) {
          return {
            success: false,
            error: 'HyperFormula not installed',
          };
        }
        hf = HyperFormula.buildEmpty({
          licenseKey: 'gpl-v3',
          useColumnIndex: true,
          useRowIndex: true,
        });
        this.hfInstances.set(documentId, hf);
        this.documentInfo.set(documentId, {
          documentId,
          sheets: [],
          totalFormulas: 0,
          loadedAt: new Date(),
        });
      }

      // Get or create sheet
      let sheetId: number;
      const existingSheets = hf.getSheetNames();
      if (!existingSheets.includes(sheetName)) {
        // Sheet doesn't exist, create it
        hf.addSheet(sheetName);
        const info = this.documentInfo.get(documentId);
        if (info) {
          info.sheets.push({
            name: sheetName,
            rowCount: 0,
            columnCount: 0,
            formulaCount: 0,
          });
        }
      }
      sheetId = hf.getSheetId(sheetName);

      const address = this.parseAddress(cellAddress);
      hf.setCellContents(
        { sheet: sheetId, col: address.col, row: address.row },
        [[value]]
      );

      // Get the new calculated value
      const newValue = hf.getCellValue({
        sheet: sheetId,
        col: address.col,
        row: address.row,
      });

      return {
        success: true,
        value: newValue,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Add a sheet to a document
   */
  addSheet(documentId: string, sheetName: string): boolean {
    try {
      let hf = this.hfInstances.get(documentId);

      // Create HyperFormula instance if it doesn't exist
      if (!hf) {
        if (!HyperFormula) {
          return false;
        }
        hf = HyperFormula.buildEmpty({
          licenseKey: 'gpl-v3',
          useColumnIndex: true,
          useRowIndex: true,
        });
        this.hfInstances.set(documentId, hf);
        this.documentInfo.set(documentId, {
          documentId,
          sheets: [],
          totalFormulas: 0,
          loadedAt: new Date(),
        });
      }

      const existingSheetId = hf.getSheetId(sheetName);
      if (existingSheetId !== undefined) {
        return true; // Sheet already exists
      }

      hf.addSheet(sheetName);

      const info = this.documentInfo.get(documentId);
      if (info) {
        info.sheets.push({
          name: sheetName,
          rowCount: 0,
          columnCount: 0,
          formulaCount: 0,
        });
      }

      return true;
    } catch (error) {
      console.error('[EXCEL ENGINE] Error adding sheet:', error);
      return false;
    }
  }

  /**
   * Execute what-if scenario
   */
  async executeWhatIf(
    documentId: string,
    sheetName: string,
    scenarios: WhatIfScenario[]
  ): Promise<ExcelFormulaResult & { scenarios?: WhatIfScenario[] }> {
    const startTime = Date.now();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return {
          success: false,
          error: 'Excel file not loaded',
        };
      }

      const sheetId = hf.getSheetId(sheetName);
      if (sheetId === undefined) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found`,
        };
      }

      // Store original values for revert
      const originalValues = new Map<string, any>();
      for (const scenario of scenarios) {
        const address = this.parseAddress(scenario.cellAddress);
        const originalValue = hf.getCellValue({ sheet: sheetId, col: address.col, row: address.row });
        originalValues.set(scenario.cellAddress, originalValue);
      }

      // Store backup for revert
      this.whatIfBackups.set(documentId, originalValues);

      // Apply scenarios
      for (const scenario of scenarios) {
        const address = this.parseAddress(scenario.cellAddress);
        hf.setCellContents(
          { sheet: sheetId, col: address.col, row: address.row },
          [[scenario.newValue]]
        );
      }

      console.log(`✅ [EXCEL ENGINE] What-if scenario executed in ${Date.now() - startTime}ms`);

      return {
        success: true,
        scenarios,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Revert what-if scenario to original values
   */
  async revertWhatIf(documentId: string): Promise<ExcelFormulaResult> {
    const startTime = Date.now();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return {
          success: false,
          error: 'Excel file not loaded',
        };
      }

      const backup = this.whatIfBackups.get(documentId);
      if (!backup) {
        return {
          success: false,
          error: 'No what-if scenario to revert',
        };
      }

      // Restore original values
      const backupEntries = Array.from(backup.entries());
      for (const [cellAddress, originalValue] of backupEntries) {
        // Need to figure out which sheet the cell was in - assume Sheet1 for now
        // In a real implementation, we'd store sheet info in the backup
        const sheetNames = hf.getSheetNames();
        for (const sheetName of sheetNames) {
          const sheetId = hf.getSheetId(sheetName);
          if (sheetId !== undefined) {
            try {
              const address = this.parseAddress(cellAddress);
              hf.setCellContents(
                { sheet: sheetId, col: address.col, row: address.row },
                [[originalValue]]
              );
              break;
            } catch {
              continue;
            }
          }
        }
      }

      // Clear backup
      this.whatIfBackups.delete(documentId);

      console.log(`✅ [EXCEL ENGINE] What-if scenario reverted in ${Date.now() - startTime}ms`);

      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute what-if and automatically revert changes
   */
  async executeWhatIfWithRevert(
    documentId: string,
    sheetName: string,
    scenarios: WhatIfScenario[]
  ): Promise<ExcelFormulaResult> {
    const hf = this.hfInstances.get(documentId);
    if (!hf) {
      return {
        success: false,
        error: 'Excel file not loaded',
      };
    }

    // Store original values for scenario cells
    const originalScenarioValues: Array<{ address: string; value: any }> = [];
    const sheetId = hf.getSheetId(sheetName);

    if (sheetId === undefined) {
      return {
        success: false,
        error: `Sheet "${sheetName}" not found`,
      };
    }

    for (const scenario of scenarios) {
      const address = this.parseAddress(scenario.cellAddress);
      const originalValue = hf.getCellValue({ sheet: sheetId, col: address.col, row: address.row });
      originalScenarioValues.push({ address: scenario.cellAddress, value: originalValue });
    }

    // Execute what-if
    const result = await this.executeWhatIf(documentId, sheetName, scenarios);

    // Revert changes
    for (const { address, value } of originalScenarioValues) {
      const addr = this.parseAddress(address);
      hf.setCellContents(
        { sheet: sheetId, col: addr.col, row: addr.row },
        [[value]]
      );
    }

    return result;
  }

  /**
   * Get formula dependencies (what cells does this formula depend on)
   */
  getFormulaDependencies(
    documentId: string,
    sheetName: string,
    cellAddress: string
  ): ExcelFormulaResult {
    const startTime = Date.now();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return {
          success: false,
          error: 'Excel file not loaded',
        };
      }

      const sheetId = hf.getSheetId(sheetName);
      if (sheetId === undefined) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found`,
        };
      }

      const address = this.parseAddress(cellAddress);
      const precedents = hf.getCellPrecedents({
        sheet: sheetId,
        col: address.col,
        row: address.row,
      });

      // Return just cell addresses without sheet prefix for same-sheet references
      const dependencies = precedents.map((p: any) => {
        const cellAddr = this.encodeAddress(p.col, p.row);
        const pSheetName = hf.getSheetName(p.sheet);
        return pSheetName === sheetName ? cellAddr : `${pSheetName}!${cellAddr}`;
      });

      return {
        success: true,
        dependencies,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get cells that depend on this cell (dependents)
   */
  getCellDependents(
    documentId: string,
    sheetName: string,
    cellAddress: string
  ): ExcelFormulaResult {
    const startTime = Date.now();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return {
          success: false,
          error: 'Excel file not loaded',
        };
      }

      const sheetId = hf.getSheetId(sheetName);
      if (sheetId === undefined) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found`,
        };
      }

      const address = this.parseAddress(cellAddress);
      const dependents = hf.getCellDependents({
        sheet: sheetId,
        col: address.col,
        row: address.row,
      });

      // Return just cell addresses without sheet prefix for same-sheet references
      const dependentsList = dependents.map((d: any) => {
        const cellAddr = this.encodeAddress(d.col, d.row);
        const dSheetName = hf.getSheetName(d.sheet);
        return dSheetName === sheetName ? cellAddr : `${dSheetName}!${cellAddr}`;
      });

      return {
        success: true,
        dependents: dependentsList,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Evaluate a formula in the context of a document (without storing in a cell)
   */
  evaluateFormulaInDocument(documentId: string, formula: string): ExcelFormulaResult {
    const startTime = Date.now();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return {
          success: false,
          error: 'Excel file not loaded',
        };
      }

      // Ensure formula starts with =
      const formulaStr = formula.startsWith('=') ? formula : `=${formula}`;

      // Use a temporary cell for evaluation
      const sheetId = hf.getSheetId(hf.getSheetNames()[0]);
      const dimensions = hf.getSheetDimensions(sheetId);

      // Use a cell far outside the data range
      const tempRow = dimensions.height + 1000;
      const tempCol = 0;

      hf.setCellContents(
        { sheet: sheetId, col: tempCol, row: tempRow },
        [[formulaStr]]
      );

      const value = hf.getCellValue({ sheet: sheetId, col: tempCol, row: tempRow });

      // Clear the temporary cell
      hf.setCellContents(
        { sheet: sheetId, col: tempCol, row: tempRow },
        [[null]]
      );

      return {
        success: true,
        value,
        formula: formulaStr,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get all formulas in a sheet
   */
  getAllFormulas(documentId: string, sheetName: string): Map<string, string> {
    const formulas = new Map<string, string>();

    try {
      const hf = this.hfInstances.get(documentId);
      if (!hf) {
        return formulas;
      }

      const sheetId = hf.getSheetId(sheetName);
      if (sheetId === undefined) {
        return formulas;
      }

      const dimensions = hf.getSheetDimensions(sheetId);

      for (let row = 0; row < dimensions.height; row++) {
        for (let col = 0; col < dimensions.width; col++) {
          const formula = hf.getCellFormula({ sheet: sheetId, col, row });
          if (formula) {
            formulas.set(this.encodeAddress(col, row), formula);
          }
        }
      }
    } catch (error) {
      console.error('[EXCEL ENGINE] Error getting formulas:', error);
    }

    return formulas;
  }

  /**
   * Get sheet names
   */
  getSheetNames(documentId: string): string[] {
    const hf = this.hfInstances.get(documentId);
    if (!hf) {
      return [];
    }
    return hf.getSheetNames();
  }

  /**
   * Alias for getCellDependents - used by tests
   */
  getFormulaDependents(
    documentId: string,
    sheetName: string,
    cellAddress: string
  ): ExcelFormulaResult {
    return this.getCellDependents(documentId, sheetName, cellAddress);
  }

  /**
   * Alias for unload - used by tests
   */
  unloadDocument(documentId: string): boolean {
    try {
      this.unload(documentId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse cell address (e.g., "A1" -> {col: 0, row: 0})
   */
  private parseAddress(address: string): { col: number; row: number } {
    // Remove sheet reference if present
    const cleanAddress = address.includes('!') ? address.split('!')[1] : address;

    const match = cleanAddress.match(/^([A-Z]+)(\d+)$/i);
    if (!match) {
      throw new Error(`Invalid cell address: ${address}`);
    }

    const col = this.columnToIndex(match[1].toUpperCase());
    const row = parseInt(match[2]) - 1;
    return { col, row };
  }

  /**
   * Encode address ({col: 0, row: 0} -> "A1")
   */
  private encodeAddress(col: number, row: number): string {
    return `${this.indexToColumn(col)}${row + 1}`;
  }

  /**
   * Convert column letter to index (A=0, B=1, ..., Z=25, AA=26, ...)
   */
  private columnToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 65 + 1);
    }
    return index - 1;
  }

  /**
   * Convert index to column letter (0=A, 1=B, ..., 25=Z, 26=AA, ...)
   */
  private indexToColumn(index: number): string {
    let col = '';
    index++;
    while (index > 0) {
      const remainder = (index - 1) % 26;
      col = String.fromCharCode(65 + remainder) + col;
      index = Math.floor((index - 1) / 26);
    }
    return col;
  }

  /**
   * Clean up instance
   */
  unload(documentId: string): void {
    const hf = this.hfInstances.get(documentId);
    if (hf) {
      hf.destroy();
    }
    this.hfInstances.delete(documentId);
    this.documentInfo.delete(documentId);
    console.log(`🗑️ [EXCEL ENGINE] Unloaded document ${documentId}`);
  }

  /**
   * Clean up all instances
   */
  unloadAll(): void {
    const entries = Array.from(this.hfInstances.entries());
    for (const [, hf] of entries) {
      hf.destroy();
    }
    this.hfInstances.clear();
    this.documentInfo.clear();
    console.log('🗑️ [EXCEL ENGINE] Unloaded all documents');
  }

  /**
   * Get statistics about loaded documents
   */
  getStats(): {
    loadedDocuments: number;
    totalSheets: number;
    totalFormulas: number;
  } {
    let totalSheets = 0;
    let totalFormulas = 0;

    const infoValues = Array.from(this.documentInfo.values());
    for (const info of infoValues) {
      totalSheets += info.sheets.length;
      totalFormulas += info.totalFormulas;
    }

    return {
      loadedDocuments: this.hfInstances.size,
      totalSheets,
      totalFormulas,
    };
  }
}

// Export both the class and the singleton instance
export { ExcelFormulaEngineService };
export default new ExcelFormulaEngineService();
