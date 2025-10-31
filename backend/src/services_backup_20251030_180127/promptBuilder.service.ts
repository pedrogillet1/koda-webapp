/** Prompt Builder Service - Minimal Stub */
class PromptBuilderService {
  build(query: string, context: string) { 
    return `Question: ${query}\n\nContext: ${context}\n\nPlease provide a detailed answer.`;
  }
}
export default new PromptBuilderService();
