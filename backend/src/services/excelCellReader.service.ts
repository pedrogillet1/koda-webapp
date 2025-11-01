/** Excel Cell Reader Service - Stub */
// This service reads specific cells from Excel files
class ExcelCellReaderService {
  async readCell(params: any) {
    // Stub: Would read Excel cell
    return {
      success: false,
      message: 'Excel cell reading not implemented',
      value: '',
      cellAddress: '',
      sheetName: '',
      documentName: ''
    };
  }
}
export default new ExcelCellReaderService();
