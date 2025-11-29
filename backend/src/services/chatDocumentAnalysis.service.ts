/** Chat Document Analysis Service - Stub */

class ChatDocumentAnalysisService {
  async analyzeDocument(_documentId: string, _userId: string) {
    return { analysis: '', summary: '' };
  }
  async analyzeDocuments(_userId: string, _options: any) {
    return { analysis: '', summary: '' };
  }
  async editAttachment(_userId: string, _options: any) {
    return { success: true };
  }
  async exportToDocuments(_userId: string, _options: any) {
    return { documentId: '' };
  }
  async getAttachment(_attachmentId: string, _userId: string) {
    return null;
  }
}

export default new ChatDocumentAnalysisService();
