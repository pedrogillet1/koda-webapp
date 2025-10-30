/**
 * Response Post-Processor Service - Minimal Stub
 * IMPORTANT: Does NOT truncate responses
 */

interface PostProcessOptions {
  maxLength?: number;
  format?: string;
}

class ResponsePostProcessorService {
  /**
   * Post-process a response
   * NOTE: This is a minimal stub that does NOT truncate or modify responses
   */
  async process(response: string, options: PostProcessOptions = {}): Promise<string> {
    // DO NOT truncate - just return as-is
    return response;
  }

  /**
   * Clean up response formatting
   */
  cleanFormatting(response: string): string {
    // Minimal cleanup - just trim whitespace
    return response.trim();
  }
}

export default new ResponsePostProcessorService();
