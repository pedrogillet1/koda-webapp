/** File Management Intent Service - Minimal Stub */
export type FileManagementIntent = 'none' | 'open' | 'delete' | 'rename' | 'move';

class FileManagementIntentService {
  detectIntent(query: string): FileManagementIntent {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('open')) return 'open';
    if (lowerQuery.includes('delete')) return 'delete';
    if (lowerQuery.includes('rename')) return 'rename';
    if (lowerQuery.includes('move')) return 'move';
    return 'none';
  }

  extractFileName(query: string): string | null {
    return null;
  }
}

export default new FileManagementIntentService();
