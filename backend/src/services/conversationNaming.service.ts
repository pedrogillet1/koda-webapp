/** Conversation Naming Service - Minimal Stub */
export function shouldGenerateName(messageCount: number): boolean {
  return messageCount === 1;
}

export async function generateConversationName(firstMessage: string): Promise<string> {
  return firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
}
