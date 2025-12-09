/**
 * Koda Streaming Controller (Layer 3)
 *
 * This is the ONLY service responsible for ALL streaming logic.
 * Replaces: streamingFixes, UTF-8 handlers, token smoothing, and all streaming-related code.
 *
 * Architecture: Mimics ChatGPT's token stream controller
 */

interface StreamingOptions {
  chunkSize?: number; // Characters per chunk
  delayMs?: number; // Delay between chunks (for smooth animation)
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  enableSmoothing?: boolean;
  preserveFormatting?: boolean;
}

interface StreamingState {
  buffer: string;
  position: number;
  isStreaming: boolean;
  isPaused: boolean;
  isStopped: boolean;
  chunks: string[];
  totalChunks: number;
}

class KodaStreamingController {
  private readonly DEFAULT_CHUNK_SIZE = 10; // Characters
  private readonly DEFAULT_DELAY_MS = 30; // Milliseconds
  private readonly UTF8_SAFE_BOUNDARY = /[\r\n\s.,;:!?]/; // Safe places to split

  private state: StreamingState = {
    buffer: '',
    position: 0,
    isStreaming: false,
    isPaused: false,
    isStopped: false,
    chunks: [],
    totalChunks: 0,
  };

  /**
   * MAIN ENTRY POINT
   * Stream text character-by-character with smooth animation
   */
  public async streamText(
    text: string,
    options: StreamingOptions = {}
  ): Promise<void> {
    const {
      chunkSize = this.DEFAULT_CHUNK_SIZE,
      delayMs = this.DEFAULT_DELAY_MS,
      onChunk,
      onComplete,
      onError,
      enableSmoothing = true,
      preserveFormatting = true,
    } = options;

    try {
      // Reset state
      this.resetState();

      // Normalize text
      const normalizedText = this.normalizeForStreaming(text, preserveFormatting);

      // Split into chunks
      const chunks = enableSmoothing
        ? this.createSmoothChunks(normalizedText, chunkSize)
        : this.createSimpleChunks(normalizedText, chunkSize);

      // Update state
      this.state.buffer = normalizedText;
      this.state.chunks = chunks;
      this.state.totalChunks = chunks.length;
      this.state.isStreaming = true;

      // Stream chunks
      for (let i = 0; i < chunks.length; i++) {
        // Check if stopped
        if (this.state.isStopped) {
          break;
        }

        // Wait if paused
        while (this.state.isPaused && !this.state.isStopped) {
          await this.sleep(100);
        }

        // Send chunk
        const chunk = chunks[i];
        this.state.position += chunk.length;

        if (onChunk) {
          onChunk(chunk);
        }

        // Delay before next chunk (except for last chunk)
        if (i < chunks.length - 1 && delayMs > 0) {
          await this.sleep(delayMs);
        }
      }

      // Complete
      this.state.isStreaming = false;

      if (onComplete && !this.state.isStopped) {
        onComplete(normalizedText);
      }
    } catch (error) {
      this.state.isStreaming = false;

      if (onError) {
        onError(error as Error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Stream from an async generator (for LLM streaming)
   */
  public async streamFromGenerator(
    generator: AsyncGenerator<string> | AsyncIterable<string>,
    options: StreamingOptions = {}
  ): Promise<string> {
    const {
      onChunk,
      onComplete,
      onError,
      preserveFormatting = true,
    } = options;

    try {
      this.resetState();
      this.state.isStreaming = true;

      let fullText = '';
      let buffer = '';

      for await (const token of generator) {
        // Check if stopped
        if (this.state.isStopped) {
          break;
        }

        // Wait if paused
        while (this.state.isPaused && !this.state.isStopped) {
          await this.sleep(100);
        }

        // Add token to buffer
        buffer += token;

        // Process buffer when we have enough content or hit a boundary
        if (buffer.length >= this.DEFAULT_CHUNK_SIZE || this.isAtBoundary(buffer)) {
          const processedChunk = this.processStreamingChunk(buffer, preserveFormatting);

          if (processedChunk && onChunk) {
            onChunk(processedChunk);
            fullText += processedChunk;
          }

          buffer = '';
        }
      }

      // Process remaining buffer
      if (buffer.length > 0) {
        const processedChunk = this.processStreamingChunk(buffer, preserveFormatting);

        if (processedChunk && onChunk) {
          onChunk(processedChunk);
          fullText += processedChunk;
        }
      }

      // Complete
      this.state.isStreaming = false;

      if (onComplete && !this.state.isStopped) {
        onComplete(fullText);
      }

      return fullText;
    } catch (error) {
      this.state.isStreaming = false;

      if (onError) {
        onError(error as Error);
        return '';
      } else {
        throw error;
      }
    }
  }

  /**
   * Stream directly from LLM response with pass-through
   * Used when LLM is already providing streamed chunks
   */
  public processLLMChunk(chunk: string): string {
    // Fix any UTF-8 issues in the chunk
    return this.fixUTF8(chunk);
  }

  /**
   * Pause streaming
   */
  public pause(): void {
    if (this.state.isStreaming) {
      this.state.isPaused = true;
    }
  }

  /**
   * Resume streaming
   */
  public resume(): void {
    if (this.state.isStreaming && this.state.isPaused) {
      this.state.isPaused = false;
    }
  }

  /**
   * Stop streaming
   */
  public stop(): void {
    this.state.isStopped = true;
    this.state.isStreaming = false;
    this.state.isPaused = false;
  }

  /**
   * Get current streaming state
   */
  public getState(): Readonly<StreamingState> {
    return { ...this.state };
  }

  /**
   * Check if streaming is active
   */
  public isActive(): boolean {
    return this.state.isStreaming;
  }

  /**
   * Reset streaming state
   */
  public resetState(): void {
    this.state = {
      buffer: '',
      position: 0,
      isStreaming: false,
      isPaused: false,
      isStopped: false,
      chunks: [],
      totalChunks: 0,
    };
  }

  /**
   * Normalize text for streaming
   * - Fix UTF-8 issues
   * - Normalize line breaks
   * - Preserve formatting if needed
   */
  private normalizeForStreaming(text: string, preserveFormatting: boolean): string {
    // Fix UTF-8 encoding issues
    text = this.fixUTF8(text);

    // Normalize line breaks
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');

    if (!preserveFormatting) {
      // Remove excessive whitespace
      text = text.replace(/[ \t]+/g, ' ');
      text = text.replace(/\n{3,}/g, '\n\n');
    }

    return text.trim();
  }

  /**
   * Fix UTF-8 encoding issues (mojibake)
   */
  public fixUTF8(text: string): string {
    // Common UTF-8 encoding issues - using array to avoid duplicate key issue
    const replacements: Array<[string, string]> = [
      ['â€"', '—'],  // em dash
      ['â€"', '–'],  // en dash
      ['â€œ', '"'],
      ['â€', '"'],
      ['â€™', "'"],
      ['Ã§', 'ç'],
      ['Ã£', 'ã'],
      ['Ã©', 'é'],
      ['Ã¡', 'á'],
      ['Ã³', 'ó'],
      ['Ã­', 'í'],
      ['Ãº', 'ú'],
      ['Ã', 'à'],
      ['Ã´', 'ô'],
      ['Ãª', 'ê'],
      ['Ã¢', 'â'],
      ['Ã±', 'ñ'],
      ['Â°', '°'],
      ['Â²', '²'],
      ['Â³', '³'],
      ['Â´', '´'],
      ['Âº', 'º'],
      ['Âª', 'ª'],
    ];

    for (const [broken, fixed] of replacements) {
      text = text.replace(new RegExp(broken, 'g'), fixed);
    }

    return text;
  }

  /**
   * Create smooth chunks (variable size, break at word/sentence boundaries)
   */
  private createSmoothChunks(text: string, targetSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      currentChunk += char;

      // Check if we should break here
      if (currentChunk.length >= targetSize) {
        // Look ahead for a good breaking point (up to 10 chars)
        let breakPoint = currentChunk.length;
        let foundBreak = false;

        for (let j = 0; j < 10 && i + j + 1 < text.length; j++) {
          if (this.UTF8_SAFE_BOUNDARY.test(text[i + j + 1])) {
            // Add characters up to the break point
            for (let k = 0; k <= j; k++) {
              if (i + k + 1 < text.length) {
                currentChunk += text[i + k + 1];
              }
            }
            i += j + 1;
            foundBreak = true;
            break;
          }
        }

        chunks.push(currentChunk);
        currentChunk = '';
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Create simple chunks (fixed size)
   */
  private createSimpleChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, Math.min(i + chunkSize, text.length)));
    }

    return chunks;
  }

  /**
   * Check if we're at a safe boundary for breaking
   */
  private isAtBoundary(text: string): boolean {
    if (text.length === 0) return false;

    const lastChar = text[text.length - 1];
    return this.UTF8_SAFE_BOUNDARY.test(lastChar);
  }

  /**
   * Process a streaming chunk
   * - Ensure UTF-8 safety
   * - Apply incremental formatting
   */
  private processStreamingChunk(chunk: string, preserveFormatting: boolean): string {
    // Fix UTF-8 issues
    chunk = this.fixUTF8(chunk);

    // Ensure chunk ends at a safe UTF-8 boundary
    chunk = this.ensureUTF8Safety(chunk);

    return chunk;
  }

  /**
   * Ensure chunk ends at a safe UTF-8 boundary
   */
  private ensureUTF8Safety(chunk: string): string {
    if (chunk.length === 0) return chunk;

    // Check if chunk ends with incomplete UTF-8 sequence
    const lastChar = chunk[chunk.length - 1];
    const lastCharCode = lastChar.charCodeAt(0);

    // If last character is a high surrogate, it's incomplete
    if (lastCharCode >= 0xD800 && lastCharCode <= 0xDBFF) {
      // Remove incomplete character
      return chunk.substring(0, chunk.length - 1);
    }

    return chunk;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get progress percentage
   */
  public getProgress(): number {
    if (this.state.buffer.length === 0) return 0;
    return Math.round((this.state.position / this.state.buffer.length) * 100);
  }
}

// Export singleton instance
export const kodaStreamingController = new KodaStreamingController();

// Export class for testing
export { KodaStreamingController };
