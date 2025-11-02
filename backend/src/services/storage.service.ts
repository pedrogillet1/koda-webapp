/** Storage Service - Minimal Stub (Non-MVP) */
class StorageService {
  async uploadFile(file: any) {
    // Stub: Would upload file to storage
    return { url: '', key: '' };
  }
  async deleteFile(key: string) {
    // Stub: Would delete file from storage
    return true;
  }
  async getSignedUrl(key: string) {
    // Stub: Would get signed URL
    return '';
  }
}
export default new StorageService();
