/** Conversation Naming Service - Minimal Stub */
class ConversationNamingService {
  async generateTitle(query: string, response: string): Promise<string> {
    return query.substring(0, 50) + (query.length > 50 ? '...' : '');
  }
}
export default new ConversationNamingService();
