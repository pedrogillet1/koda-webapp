/** Conversation Context Service - Minimal Stub */
class ConversationContextService {
  async getContext(conversationId: string) { return []; }
  async addContext(conversationId: string, context: any) { return; }
}
export default new ConversationContextService();
