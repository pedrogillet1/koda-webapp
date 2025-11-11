/** Document Export Service - Minimal Stub (Non-MVP) */

interface ExportDocumentParams {
  format: 'pdf' | 'docx' | 'xlsx';
  markdownContent?: string;
  filename?: string;
}

class DocumentExportService {
  async exportToPdf() { return null; }
  async exportToWord() { return null; }
  async exportDocument(params: ExportDocumentParams): Promise<Buffer | null> { return null; }
}
export default new DocumentExportService();
